import * as assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext, testResponse } from "./transport-fixture";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function uri(path: string) {
  return { scheme: "file", path, fsPath: path, toString: () => `file://${path}` };
}
function repository(path: string) {
  let value = "";
  const writes: string[] = [];
  let diffCalls = 0;
  let diffTask: Promise<string> | undefined;
  return {
    rootUri: uri(path),
    inputBox: { get value() { return value; }, set value(next: string) { writes.push(next); value = next; } },
    writes,
    edit: (text: string) => { value = text; },
    get diffCalls() { return diffCalls; },
    set diffTask(task: Promise<string> | undefined) { diffTask = task; },
    diff: async (cached: boolean) => { assert.equal(cached, true); diffCalls++; return diffTask ?? `+changes in ${path}`; },
  };
}
type TestRepository = ReturnType<typeof repository>;
function generationFixture(paths = ["/repo-a"]) {
  const repos = paths.map(repository);
  const commands = new Map<string, (context?: unknown) => Promise<void>>();
  const closeListeners = new Set<(repo: TestRepository) => void>();
  const subscriptions: Array<{ dispose(): void }> = [];
  const requests: Array<{ body: string; result: ReturnType<typeof deferred<Response>> }> = [];
  const documents: Array<{ content: string; language: string }> = [];
  const shown: unknown[] = [];
  const messages: string[] = [];
  const picks: unknown[][] = [];
  const copies: string[] = [];
  let choice = 0;
  let pickTask: Promise<unknown> | undefined;
  let editorFails = false;
  let clipboardChoice = false;
  const api = {
    repositories: repos.slice(),
    onDidCloseRepository: (listener: (repo: TestRepository) => void) => {
      closeListeners.add(listener); return { dispose: () => { closeListeners.delete(listener); } };
    },
    getRepository: (resource: { path: string }) => api.repositories.filter(repo => resource.path === repo.rootUri.path || resource.path.startsWith(repo.rootUri.path + "/")).sort((a, b) => b.rootUri.path.length - a.rootUri.path.length)[0] ?? null,
  };
  const config: Record<string, unknown> = { provider: "lm-studio", model: "dummy-model", prompt: "Generate: {diff}", maxDiffLength: 4000 };
  const vscode = {
    env: { machineId: "dummy-generation-host", clipboard: { writeText: async (value: string) => { copies.push(value); } } },
    ProgressLocation: { SourceControl: 1 },
    workspace: {
      isTrusted: true,
      getConfiguration: () => ({ get: (key: string) => config[key], inspect: () => ({}) }),
      openTextDocument: async (options: { content: string; language: string }) => { documents.push(options); return options; },
    },
    extensions: { getExtension: () => ({ isActive: true, exports: { getAPI: () => api } }) },
    commands: { registerCommand: (name: string, handler: (context?: unknown) => Promise<void>) => { commands.set(name, handler); return { dispose() {} }; } },
    window: {
      withProgress: async (_options: unknown, fn: (progress: { report(): void }) => Promise<void>) => fn({ report() {} }),
      showQuickPick: async (items: unknown[]) => { picks.push(items); return pickTask ?? items[choice]; },
      showInformationMessage: async (message: string) => { messages.push(message); },
      showWarningMessage: async (message: string) => { messages.push(message); },
      showErrorMessage: async (message: string, options?: { detail?: string }, action?: string) => { messages.push(message); if (options?.detail) { messages.push(options.detail); } return clipboardChoice ? action : undefined; },
      showTextDocument: async (document: unknown, options: { preview: boolean }) => { if (editorFails) { throw new Error("dummy editor failure"); } assert.equal(options.preview, false); shown.push(document); },
    },
  };
  const module = { exports: {} as { activate(context: unknown): void } };
  runInNewContext(readFileSync(join(__dirname, "../extension.js"), "utf8"), {
    module, exports: module.exports, process, AbortController, console: { error() {} },
    require: (id: string) => id === "vscode" ? vscode : id === "./security" ? require("../security") : require(id),
    fetch: async (_url: string, options: RequestInit) => { const result = deferred<Response>(); requests.push({ body: options.body as string, result }); return result.promise; },
  });
  module.exports.activate({ subscriptions, extensionPath: ".", secrets: { get: async () => undefined }, globalState: { get: () => undefined } });
  return {
    repos, api, requests, documents, shown, messages, picks, closeListeners, copies,
    set choice(value: number) { choice = value; },
    set pickTask(value: Promise<unknown> | undefined) { pickTask = value; },
    set editorFails(value: boolean) { editorFails = value; },
    set clipboardChoice(value: boolean) { clipboardChoice = value; },
    run: async (context?: unknown) => { const command = commands.get("llm-commit.generate"); assert.ok(command); await command(context); },
    respond: (index: number, content: string) => requests[index].result.resolve(testResponse(JSON.stringify({ choices: [{ message: { content } }] }))),
    remove: (repo: TestRepository) => { api.repositories = api.repositories.filter(item => item !== repo); for (const listener of closeListeners) { listener(repo); } },
    dispose: () => { for (const disposable of subscriptions) { disposable.dispose(); } },
  };
}
async function until(condition: () => boolean) {
  for (let i = 0; i < 100; i++) { if (condition()) { return; } await new Promise<void>(resolve => setTimeout(resolve, 0)); }
  assert.fail("The expected asynchronous step was not reached");
}

suite("Phase 2 Git context and draft protection", () => {
  test("single repository receives its own message without a picker", async () => {
    const f = generationFixture(); const task = f.run(); await until(() => f.requests.length === 1);
    f.respond(0, "fix: single"); await task;
    assert.equal(f.repos[0].inputBox.value, "fix: single"); assert.equal(f.picks.length, 0);
  });
  test("explicit API repository B controls both diff and input", async () => {
    const f = generationFixture(["/repo-a", "/repo-b"]); const task = f.run(f.repos[1]); await until(() => f.requests.length === 1);
    assert.ok(f.requests[0].body.includes("/repo-b")); f.respond(0, "fix: B"); await task;
    assert.equal(f.repos[0].diffCalls, 0); assert.equal(f.repos[0].inputBox.value, ""); assert.equal(f.repos[1].inputBox.value, "fix: B");
  });
  test("actual SCM rootUri resolves repository B", async () => {
    const f = generationFixture(["/repo-a", "/repo-b"]); const task = f.run({ id: "git", rootUri: uri("/repo-b") }); await until(() => f.requests.length === 1);
    f.respond(0, "fix: SCM B"); await task; assert.equal(f.repos[1].inputBox.value, "fix: SCM B"); assert.equal(f.picks.length, 0);
  });
  test("multiple repositories without context require a deliberate picker", async () => {
    const f = generationFixture(["/repo-a", "/repo-b"]); f.choice = 1;
    const task = f.run(); await until(() => f.requests.length === 1); f.respond(0, "fix: selected B"); await task;
    assert.equal(f.picks.length, 1); assert.equal(f.repos[1].inputBox.value, "fix: selected B");
  });
  test("cancelled repository picker sends nothing", async () => {
    const f = generationFixture(["/repo-a", "/repo-b"]); f.choice = -1; await f.run();
    assert.equal(f.requests.length, 0); assert.equal(f.repos[0].diffCalls, 0);
  });
  test("existing draft stays unchanged and generated result is opened", async () => {
    const f = generationFixture(); f.repos[0].edit("my existing draft");
    const task = f.run(); await until(() => f.requests.length === 1); f.respond(0, "fix: alternative"); await task;
    assert.equal(f.repos[0].inputBox.value, "my existing draft"); assert.equal(f.documents[0]?.content, "fix: alternative"); assert.equal(f.shown.length, 1);
  });
  test("editing during generation preserves the edit and the generated result", async () => {
    const f = generationFixture(); const task = f.run(); await until(() => f.requests.length === 1);
    f.repos[0].edit("typed while waiting"); f.respond(0, "fix: generated"); await task;
    assert.equal(f.repos[0].inputBox.value, "typed while waiting"); assert.equal(f.documents[0]?.content, "fix: generated");
  });
  test("clearing an existing draft does not authorize automatic replacement", async () => {
    const f = generationFixture(); f.repos[0].edit("original"); const task = f.run(); await until(() => f.requests.length === 1);
    f.repos[0].edit(""); f.respond(0, "fix: alternative"); await task;
    assert.equal(f.repos[0].inputBox.value, ""); assert.equal(f.documents[0]?.content, "fix: alternative");
  });
  test("older response cannot overwrite a newer response for the same repo", async () => {
    const f = generationFixture(); const older = f.run(); await until(() => f.requests.length === 1);
    const newer = f.run(); await until(() => f.requests.length === 2);
    f.respond(1, "fix: newer"); await newer; f.respond(0, "fix: older"); await older;
    assert.equal(f.repos[0].inputBox.value, "fix: newer"); assert.equal(f.documents[0]?.content, "fix: older");
  });
  test("an older response is not applied even while the newer request is pending", async () => {
    const f = generationFixture(); const older = f.run(); await until(() => f.requests.length === 1);
    const newer = f.run(); await until(() => f.requests.length === 2);
    f.respond(0, "fix: stale"); await older; assert.equal(f.repos[0].inputBox.value, "");
    f.respond(1, "fix: current"); await newer; assert.equal(f.repos[0].inputBox.value, "fix: current");
  });
  test("requests for different repositories remain independent", async () => {
    const f = generationFixture(["/repo-a", "/repo-b"]); const a = f.run(f.repos[0]); await until(() => f.requests.length === 1);
    const b = f.run(f.repos[1]); await until(() => f.requests.length === 2);
    f.respond(1, "fix: B"); await b; f.respond(0, "fix: A"); await a;
    assert.equal(f.repos[0].inputBox.value, "fix: A"); assert.equal(f.repos[1].inputBox.value, "fix: B"); assert.equal(f.documents.length, 0);
  });
  test("removed repository is never written and its result remains accessible", async () => {
    const f = generationFixture(); const task = f.run(); await until(() => f.requests.length === 1);
    f.remove(f.repos[0]); f.respond(0, "fix: removed repo"); await task;
    assert.equal(f.repos[0].writes.length, 0); assert.equal(f.documents[0]?.content, "fix: removed repo"); assert.equal(f.closeListeners.size, 0);
  });
  test("close and reopen of the same repository instance invalidates the old request", async () => {
    const f = generationFixture(); const task = f.run(); await until(() => f.requests.length === 1);
    f.remove(f.repos[0]); f.api.repositories.push(f.repos[0]); f.respond(0, "fix: old session"); await task;
    assert.equal(f.repos[0].writes.length, 0); assert.equal(f.documents[0]?.content, "fix: old session");
  });
  test("repository removed while diff is pending causes no model request", async () => {
    const f = generationFixture(); const diff = deferred<string>(); f.repos[0].diffTask = diff.promise;
    const task = f.run(); await until(() => f.repos[0].diffCalls === 1); f.remove(f.repos[0]); diff.resolve("+late diff"); await task;
    assert.equal(f.requests.length, 0); assert.equal(f.closeListeners.size, 0);
  });
  test("a stale explicit SCM context never falls back to another repository", async () => {
    const f = generationFixture(); await f.run({ rootUri: uri("/removed-repo") }); assert.equal(f.requests.length, 0); assert.equal(f.repos[0].diffCalls, 0);
  });
  test("invalid context falls back to deliberate selection when ambiguous", async () => {
    const f = generationFixture(["/repo-a", "/repo-b"]); f.choice = 1; const task = f.run({ nonsense: true });
    await until(() => f.requests.length === 1); f.respond(0, "fix: picked B"); await task;
    assert.equal(f.picks.length, 1); assert.equal(f.repos[1].inputBox.value, "fix: picked B");
  });
  test("nested SCM roots select the exact child, not the parent", async () => {
    const f = generationFixture(["/parent", "/parent/child"]); const task = f.run({ rootUri: uri("/parent/child") });
    await until(() => f.requests.length === 1); f.respond(0, "fix: child"); await task;
    assert.equal(f.repos[0].diffCalls, 0); assert.equal(f.repos[1].inputBox.value, "fix: child");
  });
  test("URI context delegates nested-file resolution to Git API", async () => {
    const f = generationFixture(["/parent", "/parent/child"]); const task = f.run(uri("/parent/child/file.ts"));
    await until(() => f.requests.length === 1); f.respond(0, "fix: nested file"); await task; assert.equal(f.repos[1].inputBox.value, "fix: nested file");
  });
  test("missing repository is handled without generation", async () => {
    const f = generationFixture([]); await f.run(); assert.equal(f.requests.length, 0); assert.ok(f.messages.length > 0);
  });
  test("repository removed while selection is open is not used", async () => {
    const f = generationFixture(["/repo-a", "/repo-b"]); const pick = deferred<unknown>(); f.pickTask = pick.promise;
    const task = f.run(); await until(() => f.picks.length === 1); const item = f.picks[0][1]; f.remove(f.repos[1]); pick.resolve(item); await task;
    assert.equal(f.requests.length, 0);
  });
  test("diff failure releases the per-request close listener", async () => {
    const f = generationFixture(); f.repos[0].diffTask = Promise.reject(new Error("dummy diff failure"));
    await f.run(); assert.equal(f.requests.length, 0); assert.equal(f.closeListeners.size, 0);
  });
  test("disposing extension resources invalidates requests and removes listeners", async () => {
    const f = generationFixture(); const task = f.run(); await until(() => f.requests.length === 1);
    f.dispose(); assert.equal(f.closeListeners.size, 0); f.respond(0, "fix: deactivated"); await task; assert.equal(f.repos[0].writes.length, 0);
  });
  test("editor failure offers a deliberate clipboard fallback", async () => {
    const f = generationFixture(); f.repos[0].edit("preserve draft"); f.editorFails = true; f.clipboardChoice = true;
    const task = f.run(); await until(() => f.requests.length === 1); f.respond(0, "fix: copy fallback"); await task;
    assert.equal(f.repos[0].inputBox.value, "preserve draft"); assert.equal(f.copies[0], "fix: copy fallback");
  });
});
suite("Phase 2 Git API wrapper identity", () => {
  test("fresh API wrappers share one request identity per repository URI", async () => {
    const f = generationFixture(); const originals = f.api.repositories.slice();
    Object.defineProperty(f.api, "repositories", { get: () => originals.map(repo => ({ ...repo, inputBox: repo.inputBox, diff: repo.diff })) });
    const older = f.run({ rootUri: uri("/repo-a") }); await until(() => f.requests.length === 1);
    const newer = f.run({ rootUri: uri("/repo-a") }); await until(() => f.requests.length === 2);
    f.respond(1, "fix: newer wrapper"); await newer; f.respond(0, "fix: older wrapper"); await older;
    assert.equal(f.repos[0].inputBox.value, "fix: newer wrapper"); assert.equal(f.documents[0]?.content, "fix: older wrapper");
  });
  test("close event carrying another API wrapper invalidates the request", async () => {
    const f = generationFixture(); const task = f.run(); await until(() => f.requests.length === 1);
    for (const listener of f.closeListeners) { listener({ ...f.repos[0] }); }
    f.respond(0, "fix: closed wrapper"); await task;
    assert.equal(f.repos[0].writes.length, 0); assert.equal(f.documents[0]?.content, "fix: closed wrapper");
  });
});
suite("Phase 2 delayed selection", () => {
  test("an older picker resolving after a newer generation cannot start a stale request", async () => {
    const f = generationFixture(["/repo-a", "/repo-b"]); const pick = deferred<unknown>(); f.pickTask = pick.promise;
    const older = f.run(); await until(() => f.picks.length === 1);
    const newer = f.run(f.repos[1]); await until(() => f.requests.length === 1);
    f.respond(0, "fix: latest selection"); await newer;
    pick.resolve(f.picks[0][1]); await older;
    assert.equal(f.requests.length, 1); assert.equal(f.repos[1].inputBox.value, "fix: latest selection");
  });
});
suite("Phase 2 unavailable commit input", () => {
  test("unavailable input getter still preserves the generated message", async () => {
    const f = generationFixture(); const task = f.run(); await until(() => f.requests.length === 1);
    Object.defineProperty(f.repos[0].inputBox, "value", { get: () => { throw new Error("dummy closed input"); } });
    f.respond(0, "fix: unavailable getter"); await task;
    assert.equal(f.repos[0].writes.length, 0); assert.equal(f.documents[0]?.content, "fix: unavailable getter");
  });
  test("unavailable input setter still preserves the generated message", async () => {
    const f = generationFixture(); const task = f.run(); await until(() => f.requests.length === 1);
    Object.defineProperty(f.repos[0].inputBox, "value", { get: () => "", set: () => { throw new Error("dummy closed input"); } });
    f.respond(0, "fix: unavailable setter"); await task;
    assert.equal(f.repos[0].writes.length, 0); assert.equal(f.documents[0]?.content, "fix: unavailable setter");
  });
});
