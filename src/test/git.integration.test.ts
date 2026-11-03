import * as assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promises as fs, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import { promisify } from "node:util";
import { runInNewContext, testResponse } from "./transport-fixture";
import type * as VSCode from "vscode";

interface RealRepository {
  rootUri: VSCode.Uri;
  inputBox: { value: string };
  status(): Promise<void>;
  diff(cached?: boolean): Promise<string>;
}
interface RealGitAPI {
  repositories: RealRepository[];
  onDidCloseRepository: VSCode.Event<RealRepository>;
  openRepository(uri: VSCode.Uri): Promise<RealRepository | null>;
  getRepository(uri: VSCode.Uri): RealRepository | null;
}
const exec = promisify(execFile);

const fixturePrefix = "llm-commit-phase2-git-";
async function createGitFixture(parent: string): Promise<string> {
  const canonicalParent = await fs.realpath(parent);
  return fs.mkdtemp(join(canonicalParent, fixturePrefix));
}
async function removeGitFixture(root: string, parent: string): Promise<void> {
  const target = resolve(root);
  assert.equal(relative(await fs.realpath(parent), dirname(target)), "");
  assert.ok(basename(target).startsWith(fixturePrefix));
  await fs.rm(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

suite("Git fixture paths", () => {
  test("creates and cleans an owned repository through a temporary directory alias", async () => {
    const outer = await createGitFixture(tmpdir());
    try {
      const physical = join(outer, "physical");
      const alias = join(outer, "alias");
      await fs.mkdir(physical);
      await fs.symlink(physical, alias, "junction");
      const fixture = await createGitFixture(alias);
      assert.equal(relative(await fs.realpath(physical), dirname(fixture)), "");
      await exec("git", ["init", "--quiet", fixture]);
      await assert.rejects(removeGitFixture(fixture, outer));
      await removeGitFixture(fixture, alias);
      await assert.rejects(fs.access(fixture), { code: "ENOENT" });
    } finally {
      await removeGitFixture(outer, tmpdir());
    }
  });
});

suite("Phase 2 real Git integration", function () {
  this.timeout(20000);
  let vscode: typeof VSCode;
  let git: RealGitAPI;
  let root: string | undefined;
  let a: RealRepository;
  let b: RealRepository;
  const failures: string[] = [];
  setup(async function () {
    // Real API tests are run by the Extension Host; headless Mocha skips this suite.
    try { vscode = require("vscode") as typeof VSCode; } catch { this.skip(); return; }
    if (root) { return; }
    const extension = vscode.extensions.getExtension<{ getAPI(version: 1): RealGitAPI }>("vscode.git");
    assert.ok(extension, "Built-in Git extension must be available");
    await extension.activate(); git = extension.exports.getAPI(1);
    // Canonicalize the parent before creating a repository via an 8.3 alias.
    root = await createGitFixture(tmpdir());
    const repositories: RealRepository[] = [];
    for (const name of ["repo-a", "repo-b"]) {
      const folder = join(root, name); await fs.mkdir(folder);
      await exec("git", ["init", "--quiet", folder]);
      await fs.writeFile(join(folder, "dummy.txt"), `dummy staged ${name}\n`);
      await exec("git", ["-C", folder, "add", "dummy.txt"]);
      const uri = vscode.Uri.file(folder);
      const repo = await git.openRepository(uri) ?? git.getRepository(uri);
      assert.ok(repo, "Expected the opened temporary Git repository");
      assert.equal(relative(folder, await fs.realpath(repo.rootUri.fsPath)), "");
      await repo.status(); repositories.push(repo);
    }
    [a, b] = repositories;
  });
  suiteTeardown(async () => {
    if (!root) { return; }
    try {
      for (const repo of git.repositories.filter(repo => relative(root!, dirname(repo.rootUri.fsPath)) === "")) {
        await vscode.commands.executeCommand("git.close", repo.rootUri);
      }
    } finally {
      await removeGitFixture(root, tmpdir());
    }
  });
  function command() {
    const handlers = new Map<string, (context?: unknown) => Promise<void>>();
    const subscriptions: VSCode.Disposable[] = [];
    const requests: Array<{ body: string; resolve(response: Response): void }> = [];
    const api = {
      get repositories() { return git.repositories.filter(repo => relative(root!, dirname(repo.rootUri.fsPath)) === ""); },
      onDidCloseRepository: git.onDidCloseRepository,
      getRepository: (resource: VSCode.Uri) => git.getRepository(resource),
    };
    const config: Record<string, unknown> = { provider: "lm-studio", model: "dummy-model", prompt: "Generate {diff}", maxDiffLength: 4000 };
    const services = {
      env: vscode.env,
      ProgressLocation: vscode.ProgressLocation,
      extensions: { getExtension: () => ({ isActive: true, exports: { getAPI: () => api } }) },
      commands: { registerCommand: (name: string, handler: (context?: unknown) => Promise<void>) => { handlers.set(name, handler); return { dispose() {} }; } },
      workspace: {
        get isTrusted() { return vscode.workspace.isTrusted; },
        getConfiguration: () => ({ get: (key: string) => config[key], inspect: () => ({}) }),
        openTextDocument: (options: { content: string; language: string }) => vscode.workspace.openTextDocument(options),
      },
      window: {
        withProgress: async (_options: unknown, task: (progress: { report(): void }) => Promise<void>) => task({ report() {} }),
        showTextDocument: vscode.window.showTextDocument,
        showQuickPick: async (items: Array<{ repo: RealRepository }>) => items.find(item => item.repo.rootUri.toString() === b.rootUri.toString()),
        showWarningMessage: async (message: string) => { failures.push(message); return undefined; },
        showInformationMessage: async (message: string) => { failures.push(message); return undefined; },
        showErrorMessage: async (message: string) => { failures.push(message); return undefined; },
      },
    };
    const module = { exports: {} as { activate(context: unknown): void } };
    runInNewContext(readFileSync(join(__dirname, "../extension.js"), "utf8"), {
      module, exports: module.exports, process, AbortController, console: { error() {} },
      require: (id: string) => id === "vscode" ? services : id === "./security" ? require("../security") : require(id),
      fetch: async (_url: string, init: RequestInit) => new Promise<Response>(yes => requests.push({ body: init.body as string, resolve: yes })),
    });
    module.exports.activate({ subscriptions, extensionPath: resolve(__dirname, "../.."), secrets: { get: async () => undefined }, globalState: { get: () => undefined } });
    return {
      requests,
      run: (context?: unknown) => handlers.get("llm-commit.generate")!(context),
      respond: (index: number, content: string) => requests[index].resolve(testResponse(JSON.stringify({ choices: [{ message: { content } }] }))),
      dispose: () => subscriptions.forEach(item => item.dispose()),
    };
  }
  async function waitFor(condition: () => boolean) {
    const deadline = Date.now() + 7500;
    while (Date.now() < deadline) { if (condition()) { return; } await new Promise<void>(yes => setTimeout(yes, 5)); }
    assert.fail(`Expected Git operation did not finish. ${failures.join("; ")}`);
  }
  test("real SCM SourceControl context reads and updates repository B", async () => {
    const c = command(); const scm = vscode.scm.createSourceControl("phase2-test", "Phase 2 test", b.rootUri);
    a.inputBox.value = ""; b.inputBox.value = "";
    try {
      const task = c.run(scm); await waitFor(() => c.requests.length === 1);
      assert.ok(c.requests[0].body.includes("dummy staged repo-b")); assert.ok(!c.requests[0].body.includes("dummy staged repo-a"));
      c.respond(0, "fix: real repository B"); await task;
      assert.equal(a.inputBox.value, ""); assert.equal(b.inputBox.value, "fix: real repository B");
    } finally { scm.dispose(); c.dispose(); }
  });
  test("real existing input is preserved and result remains in an untitled document", async () => {
    const c = command(); b.inputBox.value = "real draft";
    try {
      const task = c.run({ rootUri: b.rootUri }); await waitFor(() => c.requests.length === 1);
      c.respond(0, "fix: real alternative"); await task;
      assert.equal(b.inputBox.value, "real draft");
      assert.ok(vscode.workspace.textDocuments.some(document => document.isUntitled && document.getText() === "fix: real alternative"));
    } finally { c.dispose(); }
  });
  test("real Git wrappers keep reversed responses associated with the same repository", async () => {
    const c = command(); b.inputBox.value = "";
    try {
      const older = c.run({ rootUri: b.rootUri }); await waitFor(() => c.requests.length === 1);
      const newer = c.run({ rootUri: b.rootUri }); await waitFor(() => c.requests.length === 2);
      c.respond(1, "fix: real newer"); await newer; c.respond(0, "fix: real older"); await older;
      assert.equal(b.inputBox.value, "fix: real newer");
      assert.ok(vscode.workspace.textDocuments.some(document => document.isUntitled && document.getText() === "fix: real older"));
    } finally { c.dispose(); }
  });
  test("real close event protects a removed repository's input and result", async () => {
    const c = command(); b.inputBox.value = "";
    try {
      const task = c.run({ rootUri: b.rootUri }); await waitFor(() => c.requests.length === 1);
      await vscode.commands.executeCommand("git.close", b.rootUri);
      c.respond(0, "fix: real closed repository"); await task;
      assert.equal(b.inputBox.value, "");
      assert.ok(vscode.workspace.textDocuments.some(document => document.isUntitled && document.getText() === "fix: real closed repository"));
    } finally { c.dispose(); }
  });
});
