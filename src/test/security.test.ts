import { httpTransport } from "../transport";
import * as assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { ApiSecurity, SecurityError, createTarget, credentialId, authorizationId } from "../security";

import type { ApiTarget } from "../security";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext, testResponse } from "./transport-fixture";

const execution = { id: "local-test", label: "Local test host", persistent: true };
const dummyKey = "dummy-phase-one-key";
function fixture(provider = "custom", url = "https://approved.invalid/v1/chat/completions") {
  let current = createTarget(provider, url, execution);
  const secrets = new Map<string, string>();
  const approvals = new Map<string, boolean>();
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const prompts: string[] = [];
  let trusted = true;
  let consent = true;
  let input: string | undefined = dummyKey;
  let legacy: string | undefined;
  let migration: "migrate" | "new" | undefined = "migrate";
  let failStore = false;
  let failCleanup = false;
  let onConfirm: (() => void) | undefined;
  let onSecretGet: (() => void) | undefined;
  let cleanupCalls = 0;
  const warnings: string[] = [];
  const options = {
    readTarget: () => current,
    isTrusted: () => trusted,
    secrets: {
      get: async (id: string) => { onSecretGet?.(); return secrets.get(id); },
      store: async (id: string, value: string) => { if (failStore) { throw new Error(dummyKey); } secrets.set(id, value); },
      delete: async (id: string) => { secrets.delete(id); },
    },
    approvals: {
      get: (id: string) => approvals.get(id),
      update: async (id: string, value: boolean) => { approvals.set(id, value); },
    },
    confirm: async (message: string, _action: string) => { prompts.push(message); onConfirm?.(); return consent; },
    inputKey: async (_label: string) => input,
    chooseMigration: async (_label: string) => migration,
    readLegacy: () => legacy,
    reviewLegacy: async (expected: string) => { cleanupCalls++; if (failCleanup) { throw new Error(dummyKey); } assert.ok(expected); /* Opening settings never deletes a concurrent user edit. */ },
    warn: (message: string) => { warnings.push(message); },
    transport: async (targetUrl: string, init: RequestInit) => { calls.push({ url: targetUrl, init }); return testResponse("{}", { status: 200 }); },
  };
  const security = new ApiSecurity(options);
  return {
    security, options, secrets, approvals, calls, prompts, warnings,
    get current() { return current; },
    set current(value: ApiTarget) { current = value; },
    set trusted(value: boolean) { trusted = value; },
    set consent(value: boolean) { consent = value; },
    set input(value: string | undefined) { input = value; },
    get legacy() { return legacy; },
    set legacy(value: string | undefined) { legacy = value; },
    set migration(value: "migrate" | "new" | undefined) { migration = value; },
    set failStore(value: boolean) { failStore = value; },
    set failCleanup(value: boolean) { failCleanup = value; },
    set onConfirm(value: (() => void) | undefined) { onConfirm = value; },
    set onSecretGet(value: (() => void) | undefined) { onSecretGet = value; },
    get cleanupCalls() { return cleanupCalls; },
  };
}

suite("Phase 1 API security", () => {
  test("SEC-001: a workspace origin change never receives the user origin's key", async () => {
    const f = fixture();
    await f.security.configureKey();
    f.current = createTarget("custom", "https://workspace.invalid/v1/chat/completions", execution);
    await f.security.request("{}");
    assert.equal((f.calls[0].init.headers as Record<string, string>).Authorization, undefined);
    assert.equal(f.secrets.size, 1);
  });
  test("a provider change cannot reuse a credential at the same origin", async () => {
    const f = fixture("openai", "https://api.openai.com/v1/chat/completions");
    await f.security.configureKey();
    f.current = createTarget("custom", f.current.url, execution);
    await f.security.request("{}");
    assert.equal((f.calls[0].init.headers as Record<string, string>).Authorization, undefined);
  });
  test("an unchanged authorized target survives a new manager without another prompt", async () => {
    const f = fixture();
    await f.security.configureKey();
    const count = f.prompts.length;
    await new ApiSecurity(f.options).request("{}");
    await f.security.request("{}");
    assert.equal(f.prompts.length, count);
    assert.equal((f.calls[0].init.headers as Record<string, string>).Authorization, `Bearer ${dummyKey}`);
  });
  test("denied target authorization sends nothing", async () => {
    const f = fixture(); f.consent = false;
    await assert.rejects(() => f.security.request("{}"), SecurityError);
    assert.equal(f.calls.length, 0);
  });
  test("changed endpoint during consent invalidates the decision", async () => {
    const f = fixture();
    f.onConfirm = () => { f.current = createTarget("custom", "https://changed.invalid/v1", execution); };
    await assert.rejects(() => f.security.request("{}"), SecurityError);
    assert.equal(f.calls.length, 0); assert.equal(f.approvals.size, 0);
  });
  test("changed path during secret lookup also stops the request", async () => {
    const f = fixture(); await f.security.configureKey();
    f.onSecretGet = () => { f.current = createTarget("custom", "https://approved.invalid/changed", execution); };
    await assert.rejects(() => f.security.request("{}"), SecurityError);
    assert.equal(f.calls.length, 0);
  });
  test("restricted mode prevents HTTP requests and credential changes", async () => {
    const f = fixture(); f.trusted = false;
    await assert.rejects(() => f.security.request("{}"), SecurityError);
    await assert.rejects(() => f.security.configureKey(), SecurityError);
    assert.equal(f.calls.length, 0); assert.equal(f.secrets.size, 0);
  });
  test("missing OpenAI key fails before sending", async () => {
    const f = fixture("openai", "https://api.openai.com/v1/chat/completions");
    await assert.rejects(() => f.security.request("{}"), /Set API Key/);
    assert.equal(f.calls.length, 0);
  });
  test("custom endpoints can remain keyless", async () => {
    const f = fixture(); await f.security.request("{}");
    assert.equal((f.calls[0].init.headers as Record<string, string>).Authorization, undefined);
  });
  for (const [provider, url] of [["lm-studio", "http://127.0.0.1:1234/v1/chat/completions"], ["ollama", "http://127.0.0.1:11434/v1/chat/completions"]]) {
    test(`${provider} remains local and keyless without a consent loop`, async () => {
      const f = fixture(provider, url); await f.security.request("{}"); await f.security.request("{}");
      assert.equal(f.prompts.length, 0); assert.equal(f.calls.length, 2);
      assert.equal((f.calls[0].init.headers as Record<string, string>).Authorization, undefined);
    });
  }
  test("custom loopback permits explicitly bound credentials", async () => {
    const f = fixture("custom", "http://[::1]:1234/v1"); await f.security.configureKey(); await f.security.request("{}");
    assert.equal((f.calls[0].init.headers as Record<string, string>).Authorization, `Bearer ${dummyKey}`);
  });
  test("URL normalization keeps origin identity stable", () => {
    const a = createTarget("custom", "https://EXAMPLE.invalid:443/v1", execution);
    const b = createTarget("custom", "https://example.invalid/v2", execution);
    assert.equal(credentialId(a), credentialId(b));
    assert.notEqual(credentialId(a), credentialId(createTarget("custom", "https://example.invalid:444/v1", execution)));
  });
  for (const url of ["http://external.invalid/v1", "http://localhost.attacker.invalid/v1", "https://user:dummy@host.invalid/v1", "file:///tmp/a", "not a URL"]) {
    test(`rejects unsafe endpoint ${url}`, () => { assert.throws(() => createTarget("custom", url, execution), SecurityError); });
  }
  test("provider presets cannot be substituted with a custom host", () => {
    assert.throws(() => createTarget("openai", "https://other.invalid/v1", execution), SecurityError);
    assert.throws(() => createTarget("ollama", "http://127.0.0.1:9999/v1", execution), SecurityError);
    assert.throws(() => createTarget("unknown", "https://other.invalid/v1", execution), SecurityError);
  });
  test("a different remote execution context needs approval, once per session", async () => {
    const f = fixture(); await f.security.configureKey();
    const count = f.prompts.length;
    f.current = createTarget("custom", f.current.url, { id: "remote-session-a", label: "Remote test host A", persistent: false });
    await f.security.request("{}"); await f.security.request("{}");
    assert.equal(f.prompts.length, count + 1);
    assert.ok(f.prompts.at(-1)?.includes("Remote test host A"));
    assert.equal(f.approvals.has(authorizationId(f.current)), false);
    f.current = createTarget("custom", f.current.url, { id: "remote-session-b", label: "Remote test host B", persistent: false });
    f.consent = false;
    await assert.rejects(() => f.security.request("{}"), SecurityError);
    assert.equal(f.calls.length, 2);
  });
  test("cancelled migration retains the legacy value and sends nothing", async () => {
    const f = fixture(); f.legacy = dummyKey; f.migration = undefined;
    await f.security.configureKey();
    assert.equal(f.legacy, dummyKey); assert.equal(f.secrets.size, 0); assert.equal(f.calls.length, 0);
  });
  test("failed secret storage preserves legacy settings and hides the exception", async () => {
    const f = fixture(); f.legacy = dummyKey; f.failStore = true;
    await assert.rejects(() => f.security.configureKey(), e => e instanceof SecurityError && !e.message.includes(dummyKey));
    assert.equal(f.legacy, dummyKey); assert.equal(f.cleanupCalls, 0);
  });
  test("successful migration stores before offering manual legacy cleanup", async () => {
    const f = fixture(); f.legacy = dummyKey;
    await f.security.configureKey();
    assert.equal(f.legacy, dummyKey); assert.equal(f.secrets.size, 1);
    await f.security.request("{}");
    assert.equal((f.calls[0].init.headers as Record<string, string>).Authorization, `Bearer ${dummyKey}`);
  });
  test("failed cleanup leaves a working secret and the legacy value intact", async () => {
    const f = fixture(); f.legacy = dummyKey; f.failCleanup = true;
    await f.security.configureKey();
    assert.equal(f.legacy, dummyKey); assert.equal(f.secrets.size, 1);
    assert.ok(f.warnings.length > 0); assert.ok(f.warnings.every(w => !w.includes(dummyKey)));
  });
  test("cancelled input does not replace an existing secret", async () => {
    const f = fixture(); await f.security.configureKey(); const previous = f.secrets.get(credentialId(f.current));
    f.input = undefined; await f.security.configureKey();
    assert.equal(f.secrets.get(credentialId(f.current)), previous);
  });
  test("legacy credentials are never used as a sending fallback", async () => {
    const f = fixture(); f.legacy = dummyKey;
    await assert.rejects(() => f.security.request("{}"), /Set API Key/);
    assert.equal(f.calls.length, 0);
  });
  test("removing credentials does not remove another origin's secret", async () => {
    const f = fixture(); await f.security.configureKey(); const firstId = credentialId(f.current);
    f.current = createTarget("custom", "https://second.invalid/v1", execution); await f.security.configureKey();
    await f.security.removeKey();
    assert.ok(f.secrets.has(firstId)); assert.equal(f.secrets.has(credentialId(f.current)), false);
  });
  test("transport failures cannot expose a key through their error text", async () => {
    const f = fixture(); await f.security.configureKey();
    const manager = new ApiSecurity({ ...f.options, transport: async () => { throw new Error(dummyKey); } });
    await assert.rejects(() => manager.request("{}"), e => e instanceof SecurityError && !e.message.includes(dummyKey));
  });
  test("redirects never receive a second request, body or credentials", async () => {
    let followed = 0;
    const server = createServer((req, res) => {
      if (req.url === "/redirect") { res.writeHead(307, { Location: "/receiver" }); res.end(); }
      else { followed++; res.end("{}"); }
    });
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    try {
      const f = fixture("custom", `http://127.0.0.1:${(server.address() as AddressInfo).port}/redirect`);
      const manager = new ApiSecurity({ ...f.options, transport: (url, init) => httpTransport(url, init) });
      await manager.configureKey();
      await assert.rejects(() => manager.request('{"dummy":"diff"}'), SecurityError);
      assert.equal(followed, 0);
    } finally { server.closeAllConnections?.(); await new Promise<void>(resolve => server.close(() => resolve())); }
  });
});


// Executes the compiled extension adapter with fake VS Code services and a dummy transport.
// This verifies command wiring without claiming to be a real Extension Host integration test.
function extensionFixture() {
  const user: Record<string, unknown> = {};
  const workspace: Record<string, unknown> = { provider: "custom", apiUrl: "https://user-target.invalid/v1/chat/completions" };
  const commands = new Map<string, () => Promise<void>>();
  const secrets = new Map<string, string>();
  const approvals = new Map<string, boolean>();
  const requests: Array<{ url: string; init: RequestInit }> = [];
  const messages: string[] = [];
  const defaults: Record<string, unknown> = { provider: "lm-studio", model: "qwen2.5-coder-7b-instruct", prompt: "Generate: {diff}", maxDiffLength: 4000 };
  let trusted = true;
  let status = 200;
  let responseBodyRead = false;
  const vscode = {
    env: { machineId: "dummy-machine", remoteName: undefined },
    ConfigurationTarget: { Global: 1 }, ProgressLocation: { SourceControl: 1 },
    workspace: {
      get isTrusted() { return trusted; },
      getConfiguration: () => ({
        get: (name: string) => workspace[name] ?? user[name] ?? defaults[name],
        inspect: (name: string) => ({ globalValue: user[name], workspaceValue: workspace[name] }),
        update: async (name: string, value: unknown, target: number) => { assert.equal(target, 1); user[name] = value; },
      }),
    },
    commands: { executeCommand: async (name: string, setting: string) => { assert.equal(name, "workbench.action.openSettings"); assert.equal(setting, "llm-commit.apiKey"); }, registerCommand: (name: string, handler: () => Promise<void>) => { commands.set(name, handler); return { dispose() {} }; } },
    extensions: { getExtension: () => ({ isActive: true, exports: { getAPI: () => ({ repositories: [{ diff: async () => "+dummy staged diff", inputBox: { value: "" } }] }) } }) },
    window: {
      showWarningMessage: async (message: string, _options: unknown, action: string) => { messages.push(message); return action; },
      showErrorMessage: (message: string) => { messages.push(message); },
      showInformationMessage: (message: string) => { messages.push(message); },
      showInputBox: async (options: { password: boolean }) => { assert.equal(options.password, true); return dummyKey; },
      withProgress: async (_options: unknown, fn: (progress: { report(): void }) => Promise<void>) => fn({ report() {} }),
    },
  };
  const output = { exports: {} as { activate(context: unknown): void } };
  const transport = async (url: string, init: RequestInit) => {
    requests.push({ url, init });
    return {
      ok: status === 200, status,
      text: async () => { responseBodyRead = true; return JSON.stringify({ error: { message: dummyKey } }); },
      json: async () => ({ choices: [{ message: { content: "fix: dummy message" } }] }),
    };
  };
  runInNewContext(readFileSync(join(__dirname, "../extension.js"), "utf8"), {
    exports: output.exports, module: output, AbortController,
    require: (id: string) => id === "vscode" ? vscode : id === "./security" ? require("../security") : require(id),
    fetch: transport, process, console: { error: (...values: unknown[]) => { messages.push(values.map(String).join(" ")); } },
  });
  output.exports.activate({
    subscriptions: [], extensionPath: ".",
    secrets: { get: async (id: string) => secrets.get(id), store: async (id: string, value: string) => { secrets.set(id, value); }, delete: async (id: string) => { secrets.delete(id); } },
    globalState: { get: (id: string) => approvals.get(id), update: async (id: string, value: boolean) => { approvals.set(id, value); } },
  });
  return {
    user, workspace, requests, messages, secrets,
    run: async (name: string) => { const handler = commands.get(name); assert.ok(handler); await handler(); },
    set trusted(value: boolean) { trusted = value; },
    set status(value: number) { status = value; },
    get responseBodyRead() { return responseBodyRead; },
  };
}

suite("Phase 1 extension adapter", () => {
  test("actual command wiring never forwards a workspace plaintext key", async () => {
    const f = extensionFixture(); f.workspace.apiKey = "dummy-workspace-key";
    await f.run("llm-commit.generate");
    assert.equal(f.requests.length, 1);
    assert.equal((f.requests[0].init.headers as Record<string, string>).Authorization, undefined);
    assert.equal(f.requests[0].init.redirect, "error");
  });
  test("set command stores a user key without deleting settings; changed workspace gets no key", async () => {
    const f = extensionFixture(); f.user.apiKey = dummyKey;
    await f.run("llm-commit.setApiKey");
    assert.equal(f.secrets.size, 1); assert.equal(f.user.apiKey, dummyKey);
    await f.run("llm-commit.generate");
    assert.equal((f.requests[0].init.headers as Record<string, string>).Authorization, `Bearer ${dummyKey}`);
    f.workspace.apiUrl = "https://workspace-target.invalid/v1/chat/completions";
    await f.run("llm-commit.generate");
    assert.equal(f.requests.length, 1);
  });
  test("untrusted workspace sends no HTTP request", async () => {
    const f = extensionFixture(); f.trusted = false;
    await f.run("llm-commit.generate"); assert.equal(f.requests.length, 0);
  });
  test("server errors cannot echo a dummy credential into notifications or logs", async () => {
    const f = extensionFixture(); await f.run("llm-commit.setApiKey"); f.status = 500;
    await f.run("llm-commit.generate");
    assert.equal(f.responseBodyRead, false);
    assert.ok(f.messages.every(message => !message.includes(dummyKey)));
    assert.ok(f.messages.some(message => message.includes("HTTP 500")));
  });
  test("removed Apple provider fails closed without HTTP", async () => {
    const f = extensionFixture(); f.workspace.provider = "apple";
    await f.run("llm-commit.generate");
    assert.equal(f.requests.length, 0);
    assert.ok(f.messages.some(message => message.includes("no longer supported")));
  });
});
suite("Phase 1 failure recovery", () => {
  test("cancelled save preserves legacy settings without creating a secret", async () => {
    const f = fixture(); f.legacy = dummyKey; f.consent = false;
    await f.security.configureKey();
    assert.equal(f.legacy, dummyKey); assert.equal(f.secrets.size, 0); assert.equal(f.cleanupCalls, 0);
  });
  test("cancelled cleanup keeps both the secure key and legacy value", async () => {
    const f = fixture(); f.legacy = dummyKey;
    f.onConfirm = () => { if (f.prompts.length === 2) { f.consent = false; } };
    await f.security.configureKey();
    assert.equal(f.legacy, dummyKey); assert.equal(f.secrets.size, 1); assert.equal(f.cleanupCalls, 0);
  });
  test("a concurrently edited legacy value is never removed", async () => {
    const f = fixture(); f.legacy = dummyKey;
    f.onConfirm = () => { if (f.prompts.length === 2) { f.legacy = "dummy-new-user-key"; } };
    await f.security.configureKey(); assert.equal(f.legacy, "dummy-new-user-key");
  });
  test("changed destination during save confirmation prevents secret storage", async () => {
    const f = fixture();
    f.onConfirm = () => { f.current = createTarget("custom", "https://changed.invalid/v1", execution); };
    await assert.rejects(() => f.security.configureKey(), SecurityError);
    assert.equal(f.secrets.size, 0);
  });
  test("mismatched stored credential metadata fails closed", async () => {
    const f = fixture();
    f.secrets.set(credentialId(f.current), JSON.stringify({ version: 1, provider: "openai", origin: f.current.origin, key: dummyKey }));
    await assert.rejects(() => f.security.request("{}"), SecurityError); assert.equal(f.calls.length, 0);
  });
  test("failed read-back never deletes the legacy setting", async () => {
    const f = fixture(); f.legacy = dummyKey;
    const manager = new ApiSecurity({ ...f.options, secrets: { ...f.options.secrets, get: async () => undefined } });
    await assert.rejects(() => manager.configureKey(), SecurityError);
    assert.equal(f.legacy, dummyKey); assert.equal(f.cleanupCalls, 0);
  });
  test("failed consent persistence does not delete the migrated legacy key", async () => {
    const f = fixture(); f.legacy = dummyKey;
    const manager = new ApiSecurity({ ...f.options, approvals: { ...f.options.approvals, update: async () => { throw new Error(dummyKey); } } });
    await assert.rejects(() => manager.configureKey(), e => e instanceof SecurityError && !e.message.includes(dummyKey));
    assert.equal(f.legacy, dummyKey); assert.equal(f.cleanupCalls, 0); assert.equal(f.secrets.size, 1);
  });
  test("a stable origin can use another path without repeating consent", async () => {
    const f = fixture(); await f.security.configureKey(); const count = f.prompts.length;
    f.current = createTarget("custom", "https://approved.invalid/other-path", execution);
    await f.security.request("{}"); assert.equal(f.prompts.length, count);
    assert.equal((f.calls[0].init.headers as Record<string, string>).Authorization, `Bearer ${dummyKey}`);
  });
  test("trust revoked during secret lookup prevents transmission", async () => {
    const f = fixture(); await f.security.configureKey(); f.onSecretGet = () => { f.trusted = false; };
    await assert.rejects(() => f.security.request("{}"), SecurityError); assert.equal(f.calls.length, 0);
  });
});
