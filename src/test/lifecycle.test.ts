import { httpTransport, HttpRequest } from "../transport";
import * as assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "./transport-fixture";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function cancellation() {
  let cancelled = false;
  const listeners = new Set<() => void>();
  return {
    get isCancellationRequested() { return cancelled; },
    onCancellationRequested: (listener: () => void) => { listeners.add(listener); return { dispose: () => { listeners.delete(listener); } }; },
    cancel: () => { cancelled = true; for (const listener of [...listeners]) { listener(); } },
    get listenerCount() { return listeners.size; },
  };
}
function fixture(provider = "lm-studio", count = 1) {
  const settings: Record<string, unknown> = { provider, prompt: "Generate {diff}", maxDiffLength: 4000, model: {}, timeoutSeconds: 120 };
  const timers = new Map<object, { callback: () => void; ms: number }>();
  const timerApi = { setTimeout: (callback: () => void, ms: number) => { const handle = { unref() {} }; timers.set(handle, { callback, ms }); return handle; }, clearTimeout: (handle: object) => { timers.delete(handle); } };
  const tokens: ReturnType<typeof cancellation>[] = [];
  const progressOptions: Array<{ cancellable?: boolean; location?: unknown }> = [];
  const commands = new Map<string, (context?: unknown) => Promise<void>>();
  const subscriptions: Array<{ dispose(): void }> = [];
  const closeListeners = new Set<unknown>();
  const notices: string[] = [];
  const previews: unknown[] = [];
  const requests: Array<{ init: RequestInit; result: ReturnType<typeof deferred<Response>>; jsonCalls: number }> = [];
  const repos = Array.from({ length: count }, (_, index) => ({ rootUri: { scheme: "file", path: `/repo-${index}`, fsPath: `/repo-${index}`, toString: () => `file:///repo-${index}` }, inputBox: { value: "" }, diff: async () => "+dummy diff" }));
  const api = { repositories: repos, onDidCloseRepository: (listener: unknown) => { closeListeners.add(listener); return { dispose: () => { closeListeners.delete(listener); } }; } };
  let picker: ReturnType<typeof deferred<unknown>> | undefined;
  let pickToken: unknown;
  let nativeFetch = false;
  let approval: ReturnType<typeof deferred<string | undefined>> | undefined;
  const vscode = {
    env: { machineId: "phase4-test-host" }, ProgressLocation: { SourceControl: 1, Notification: 15 },
    commands: { registerCommand: (name: string, handler: (context?: unknown) => Promise<void>) => { commands.set(name, handler); return { dispose() {} }; } },
    workspace: { isTrusted: true, getConfiguration: () => ({ get: (name: string, fallback?: unknown) => Object.prototype.hasOwnProperty.call(settings, name) ? settings[name] : fallback, inspect: () => ({}) }), openTextDocument: async (options: unknown) => { previews.push(options); return options; } },
    extensions: { getExtension: () => ({ isActive: true, exports: { getAPI: () => api } }) },
    window: {
      withProgress: async (options: { cancellable?: boolean }, task: (progress: { report(): void }, token: ReturnType<typeof cancellation>) => Promise<void>) => {
        const token = cancellation(); tokens.push(token); progressOptions.push(options); return task({ report() {} }, token);
      },
      showQuickPick: async (items: unknown[], _options: unknown, token?: ReturnType<typeof cancellation>) => { pickToken = token; return picker ? picker.promise : items[0]; },
      showTextDocument: async () => undefined,
      showWarningMessage: async (message: string, _options?: unknown, action?: string) => { notices.push(message); return approval ? approval.promise : action; },
      showErrorMessage: (message: string) => { notices.push(message); },
      showInformationMessage: (message: string) => { notices.push(message); },
    },
  };
  const output = { exports: {} as { activate(context: unknown): void; deactivate(): void | Promise<void> } };
  const fetchStub = async (url: string, init: RequestInit) => {
    const result = deferred<Response>(); const request = { init, result, jsonCalls: 0 }; requests.push(request);
    if (nativeFetch) { return httpTransport(url, init as HttpRequest); }
    return result.promise;
  };
  runInNewContext(readFileSync(join(__dirname, "../extension.js"), "utf8"), {
    exports: output.exports, module: output, process, AbortController, AbortSignal,
    console: { error: (...values: unknown[]) => notices.push(values.map(String).join(" ")) },
    require: (id: string) => id === "vscode" ? vscode : id === "node:timers" ? timerApi : id === "./security" ? require("../security") : require(id), fetch: fetchStub,
  });
  output.exports.activate({ subscriptions, extensionPath: ".", secrets: { get: async () => undefined }, globalState: { get: () => undefined, update: async () => undefined } });
  return {
    settings, timers, tokens, progressOptions, notices, requests, repos, previews, closeListeners,
    get pickToken() { return pickToken; }, set picker(value: ReturnType<typeof deferred<unknown>> | undefined) { picker = value; },
    set approval(value: ReturnType<typeof deferred<string | undefined>> | undefined) { approval = value; },
    set nativeFetch(value: boolean) { nativeFetch = value; },
    run: (index?: number) => commands.get("llm-commit.generate")!(index === undefined ? undefined : repos[index]),
    respond: (index: number, text: string, body?: Promise<unknown>) => {
      requests[index].result.resolve({ ok: true, status: 200, json: () => { requests[index].jsonCalls++; return body ?? Promise.resolve({ choices: [{ message: { content: text } }] }); }, body: { cancel: async () => undefined } } as unknown as Response);
    },
    expire: (ms: number) => { for (const [handle, timer] of [...timers]) { if (timer.ms === ms) { timers.delete(handle); timer.callback(); } } },
    deactivate: () => output.exports.deactivate(),
    dispose: () => { for (const resource of subscriptions) { resource.dispose(); } },
  };
}
async function until(condition: () => boolean) {
  const deadline = Date.now() + 1500;
  while (Date.now() < deadline) { if (condition()) { return; } await new Promise<void>(yes => setTimeout(yes, 1)); }
  assert.fail("Expected operation state was not reached");
}
async function finishes(task: Promise<void>) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { assert.equal(await Promise.race([task.then(() => true), new Promise<boolean>(yes => { timer = setTimeout(() => yes(false), 100); })]), true, "Cancelled operation must settle without waiting for a transport or process response"); }
  finally { if (timer) { clearTimeout(timer); } }
}

suite("Phase 4 HTTP cancellation and lifecycle", () => {
  test("success supplies a signal and releases timer and cancellation listener", async () => {
    const f = fixture(); const task = f.run(); await until(() => f.requests.length === 1); assert.ok(f.requests[0].init.signal);
    f.respond(0, "fix: success"); await task; assert.equal(f.repos[0].inputBox.value, "fix: success"); assert.equal(f.timers.size, 0); assert.equal(f.tokens[0].listenerCount, 0);
  });
  test("notification progress is cancellable", async () => {
    const f = fixture(); const task = f.run(); await until(() => f.requests.length === 1);
    assert.equal(f.progressOptions[0].cancellable, true); assert.equal(f.progressOptions[0].location, 15); f.respond(0, "fix: done"); await task;
  });
  test("cancel before headers aborts HTTP silently and preserves the draft", async () => {
    const f = fixture(); f.repos[0].inputBox.value = "keep draft"; const task = f.run(); await until(() => f.requests.length === 1);
    f.tokens[0].cancel(); await finishes(task); assert.equal(f.requests[0].init.signal?.aborted, true); assert.equal(f.repos[0].inputBox.value, "keep draft"); assert.equal(f.notices.length, 0); assert.equal(f.timers.size, 0); assert.equal(f.closeListeners.size, 0);
  });
  test("cancel during response body rejects immediately and ignores late JSON", async () => {
    const f = fixture(); const body = deferred<unknown>(); const task = f.run(); await until(() => f.requests.length === 1); f.respond(0, "", body.promise); await until(() => f.requests[0].jsonCalls === 1);
    f.tokens[0].cancel(); await finishes(task); body.resolve({ choices: [{ message: { content: "fix: late body" } }] }); await new Promise<void>(yes => setTimeout(yes, 0)); assert.equal(f.repos[0].inputBox.value, ""); assert.equal(f.notices.length, 0);
  });
  test("timeout has a distinct message, aborts HTTP and clears resources", async () => {
    const f = fixture(); const task = f.run(); await until(() => f.requests.length === 1); assert.ok([...f.timers.values()].some(timer => timer.ms === 120000));
    f.expire(120000); await finishes(task); assert.equal(f.requests[0].init.signal?.aborted, true); assert.ok(f.notices.some(message => /timed out/i.test(message))); assert.equal(f.timers.size, 0);
  });
  test("a slow successful body within the deadline is accepted", async () => {
    const f = fixture(); const body = deferred<unknown>(); const task = f.run(); await until(() => f.requests.length === 1); f.respond(0, "", body.promise); await until(() => f.requests[0].jsonCalls === 1);
    assert.ok(f.timers.size > 0); body.resolve({ choices: [{ message: { content: "fix: slow success" } }] }); await task; assert.equal(f.repos[0].inputBox.value, "fix: slow success"); assert.equal(f.timers.size, 0);
  });
  test("cancel one repository without cancelling another", async () => {
    const f = fixture("lm-studio", 2); const a = f.run(0); await until(() => f.requests.length === 1); const b = f.run(1); await until(() => f.requests.length === 2);
    f.tokens[0].cancel(); await finishes(a); assert.equal(f.requests[1].init.signal?.aborted, false); f.respond(1, "fix: B"); await b; assert.equal(f.repos[1].inputBox.value, "fix: B"); assert.equal(f.repos[0].inputBox.value, "");
  });
  test("a late response after cancellation is never parsed or previewed", async () => {
    const f = fixture(); const task = f.run(); await until(() => f.requests.length === 1); f.tokens[0].cancel(); await finishes(task); f.respond(0, "fix: late"); await new Promise<void>(yes => setTimeout(yes, 0)); assert.equal(f.requests[0].jsonCalls, 0); assert.equal(f.previews.length, 0);
  });
  test("deactivate aborts HTTP immediately without notices", async () => {
    const f = fixture(); const task = f.run(); await until(() => f.requests.length === 1); f.deactivate(); await finishes(task); assert.equal(f.requests[0].init.signal?.aborted, true); assert.equal(f.notices.length, 0); assert.equal(f.timers.size, 0); assert.equal(f.closeListeners.size, 0);
  });
  test("context disposal also aborts every active request", async () => {
    const f = fixture("lm-studio", 2); const a = f.run(0); await until(() => f.requests.length === 1); const b = f.run(1); await until(() => f.requests.length === 2); f.dispose(); await finishes(Promise.all([a, b]).then(() => undefined)); assert.ok(f.requests.every(request => request.init.signal?.aborted)); assert.equal(f.timers.size, 0);
  });
  test("a late rejection after cancellation is consumed without raw error disclosure", async () => {
    const f = fixture(); const task = f.run(); await until(() => f.requests.length === 1); f.tokens[0].cancel(); await finishes(task); f.requests[0].result.reject(new Error("dummy-sensitive-response")); await new Promise<void>(yes => setTimeout(yes, 0)); assert.equal(f.notices.length, 0);
  });
  test("same-repository cancellation cannot revive an older request", async () => {
    const f = fixture(); const older = f.run(); await until(() => f.requests.length === 1); const newer = f.run(); await until(() => f.requests.length === 2);
    f.tokens[1].cancel(); await finishes(newer); f.respond(0, "fix: older preserved"); await older; assert.equal(f.repos[0].inputBox.value, ""); assert.equal(f.previews.length, 1);
  });
  test("cancel while repository picker is open ends the command without sending", async () => {
    const f = fixture("lm-studio", 2); f.picker = deferred<unknown>(); const task = f.run(); await until(() => f.pickToken !== undefined); f.tokens[0].cancel(); await finishes(task); assert.equal(f.requests.length, 0); assert.ok(f.pickToken); assert.equal(f.closeListeners.size, 0);
  });
  test("late authorization after cancellation never sends a request", async () => {
    const f = fixture("custom"); const approval = deferred<string | undefined>(); f.approval = approval; f.settings.apiUrl = "https://dummy-authorized.invalid/v1"; const task = f.run(); await until(() => f.notices.some(message => message.includes("Allow sending")));
    f.tokens[0].cancel(); await finishes(task); approval.resolve("Authorize API origin"); await new Promise<void>(yes => setTimeout(yes, 0)); assert.equal(f.requests.length, 0); assert.equal(f.timers.size, 0);
  });
  for (const value of [0, -1, 1.5, 601, "120", null, NaN, Infinity]) {
    test(`invalid timeoutSeconds ${value} is rejected before sending`, async () => { const f = fixture(); f.settings.timeoutSeconds = value; await f.run(); assert.equal(f.requests.length, 0); assert.ok(f.notices.some(message => message.includes("timeoutSeconds"))); });
  }
});

suite("Phase 4 native HTTP transport", () => {
  test("cancellation really closes a controlled local HTTP response stream", async () => {
    let received = false; let disconnected = false;
    const server = createServer((request, response) => { received = true; response.writeHead(200, { "Content-Type": "application/json" }); response.write('{"choices":['); response.on("close", () => { disconnected = true; }); });
    await new Promise<void>(yes => server.listen(0, "127.0.0.1", yes));
    try {
      const f = fixture("custom"); f.settings.apiUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`; f.nativeFetch = true;
      const task = f.run(); await until(() => received); f.tokens[0].cancel(); await finishes(task); await until(() => disconnected); assert.equal(f.repos[0].inputBox.value, ""); assert.equal(f.timers.size, 0);
    } finally { server.closeAllConnections?.(); await new Promise<void>(yes => server.close(() => yes())); }
  });
});

suite("Phase 4 concurrency and remaining HTTP boundaries", () => {
  test("timeout during body reception keeps the draft unchanged", async () => {
    const f = fixture(); const body = deferred<unknown>(); const task = f.run(); await until(() => f.requests.length === 1);
    f.respond(0, "", body.promise); await until(() => f.requests[0].jsonCalls === 1); f.expire(120000); await finishes(task);
    body.reject(new Error("dummy-sensitive-late-body")); await new Promise<void>(yes => setTimeout(yes, 0));
    assert.equal(f.repos[0].inputBox.value, ""); assert.ok(f.notices.some(message => /timed out/i.test(message))); assert.ok(f.notices.every(message => !message.includes("dummy-sensitive")));
  });
  test("one repository can time out while another succeeds", async () => {
    const f = fixture("lm-studio", 2); f.settings.timeoutSeconds = 1; const a = f.run(0); await until(() => f.requests.length === 1);
    f.settings.timeoutSeconds = 2; const b = f.run(1); await until(() => f.requests.length === 2);
    f.expire(1000); await finishes(a); assert.equal(f.requests[1].init.signal?.aborted, false);
    f.respond(1, "fix: independent B"); await b; assert.equal(f.repos[1].inputBox.value, "fix: independent B"); assert.equal(f.timers.size, 0);
  });
  test("a picker completing after cancellation cannot start a model request", async () => {
    const f = fixture("lm-studio", 2); const pick = deferred<unknown>(); f.picker = pick; const task = f.run(); await until(() => f.pickToken !== undefined);
    f.tokens[0].cancel(); await finishes(task); pick.resolve({ repo: f.repos[1] }); await new Promise<void>(yes => setTimeout(yes, 0)); assert.equal(f.requests.length, 0);
  });
  test("authorization waiting does not consume the network timeout", async () => {
    const f = fixture("custom"); const approval = deferred<string | undefined>(); f.approval = approval; f.settings.apiUrl = "https://dummy-authorized.invalid/v1";
    const task = f.run(); await until(() => f.notices.some(message => message.includes("Allow sending"))); assert.equal(f.timers.size, 0);
    approval.resolve("Authorize API origin"); await until(() => f.requests.length === 1); assert.equal(f.timers.size, 1); f.respond(0, "fix: authorized"); await task;
  });
});
suite("Phase 4 completion and mixed shutdown", () => {
  test("headers delivered immediately before cancel are never decoded", async () => {
    const f = fixture(); const task = f.run(); await until(() => f.requests.length === 1);
    f.respond(0, "fix: already delivered"); f.tokens[0].cancel(); await finishes(task);
    assert.equal(f.requests[0].jsonCalls, 0); assert.equal(f.repos[0].inputBox.value, ""); assert.equal(f.previews.length, 0);
  });
  test("shutdown simultaneously aborts independent HTTP requests", async () => {
    const f = fixture("lm-studio", 2); const first = f.run(0); await until(() => f.requests.length === 1);
    const second = f.run(1); await until(() => f.requests.length === 2);
    await f.deactivate(); await finishes(Promise.all([first, second]).then(() => undefined));
    assert.ok(f.requests.every(request => request.init.signal?.aborted)); assert.equal(f.timers.size, 0); assert.equal(f.notices.length, 0);
  });
  test("native transport timeout closes a local response body", async () => {
    let received = false; let disconnected = false;
    const server = createServer((_request, response) => { received = true; response.writeHead(200, { "Content-Type": "application/json" }); response.write('{"choices":['); response.on("close", () => { disconnected = true; }); });
    await new Promise<void>(yes => server.listen(0, "127.0.0.1", yes));
    try {
      const f = fixture("custom"); f.settings.apiUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`; f.nativeFetch = true;
      const task = f.run(); await until(() => received); f.expire(120000); await finishes(task); await until(() => disconnected);
      assert.ok(f.notices.some(message => /timed out/i.test(message))); assert.equal(f.timers.size, 0); assert.equal(f.repos[0].inputBox.value, "");
    } finally { server.closeAllConnections?.(); await new Promise<void>(yes => server.close(() => yes())); }
  });
});
