import * as assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "./transport-fixture";

const dummyKey = "dummy-phase3-key";
const manifest = JSON.parse(readFileSync(join(__dirname, "../../package.json"), "utf8"));
function fixture(provider = "lm-studio", diff = "+dummy diff") {
  const user: Record<string, unknown> = { provider };
  const workspace: Record<string, unknown> = {};
  const calls: Array<{ model: unknown; messages: Array<{ content: string }> }> = [];
  const errors: string[] = [];
  const commands = new Map<string, () => Promise<void>>();
  const secrets = new Map<string, string>();
  const approvals = new Map<string, boolean>();
  const repo = { rootUri: { toString: () => "file:///dummy" }, inputBox: { value: "" }, diff: async () => diff };
  const api = { repositories: [repo] };
  let responseData: unknown = { choices: [{ message: { content: "fix: dummy response" } }] };
  let status = 200;
  let invalidJson = false;
  const get = (key: string, fallback?: unknown) => {
    const lower = Object.prototype.hasOwnProperty.call(user, key) ? user[key] : manifest.contributes.configuration.properties[`llm-commit.${key}`]?.default ?? fallback;
    if (!Object.prototype.hasOwnProperty.call(workspace, key)) { return lower; }
    const higher = workspace[key];
    if (lower && higher && typeof lower === "object" && typeof higher === "object" && !Array.isArray(lower) && !Array.isArray(higher)) { return { ...lower, ...higher }; }
    return higher;
  };
  const vscode = {
    env: { machineId: "phase3-dummy-host" }, ProgressLocation: { SourceControl: 1 },
    workspace: { isTrusted: true, getConfiguration: () => ({ get, inspect: (key: string) => ({ globalValue: user[key], workspaceValue: workspace[key] }) }) },
    extensions: { getExtension: () => ({ isActive: true, exports: { getAPI: () => api } }) },
    commands: { registerCommand: (name: string, callback: () => Promise<void>) => { commands.set(name, callback); return { dispose() {} }; } },
    window: {
      withProgress: async (_options: unknown, callback: (progress: { report(): void }) => Promise<void>) => callback({ report() {} }),
      showErrorMessage: (message: string) => { errors.push(message); },
      showWarningMessage: async (message: string, _options?: unknown, action?: string) => { errors.push(message); return action; },
      showInformationMessage: (message: string) => { errors.push(message); },
      showInputBox: async () => dummyKey,
    },
  };
  const output = { exports: {} as { activate(context: unknown): void } };
  runInNewContext(readFileSync(join(__dirname, "../extension.js"), "utf8"), {
    exports: output.exports, module: output, AbortController, process,
    console: { error: (...values: unknown[]) => errors.push(values.map(String).join(" ")) },
    require: (id: string) => id === "vscode" ? vscode : id === "./security" ? require("../security") : id.startsWith("./") ? require(join(__dirname, "..", id)) : require(id),
    fetch: async (_url: string, options: RequestInit) => {
      assert.equal(options.redirect, "error"); calls.push(JSON.parse(options.body as string));
      return { ok: status >= 200 && status < 300, status, statusText: dummyKey,
        json: async () => { if (invalidJson) { throw new SyntaxError(dummyKey); } return responseData; },
        text: async () => { throw new Error("Raw error body must never be read"); },
      };
    },
  });
  output.exports.activate({ subscriptions: [], extensionPath: ".", secrets: {
    get: async (key: string) => secrets.get(key), store: async (key: string, value: string) => { secrets.set(key, value); }, delete: async (key: string) => { secrets.delete(key); },
  }, globalState: { get: (key: string) => approvals.get(key), update: async (key: string, value: boolean) => { approvals.set(key, value); } } });
  return {
    user, workspace, calls, errors, repo, secrets, approvals,
    set data(value: unknown) { responseData = value; }, set status(value: number) { status = value; }, set invalidJson(value: boolean) { invalidJson = value; },
    key: () => commands.get("llm-commit.setApiKey")!(),
    removeKey: () => commands.get("llm-commit.removeApiKey")!(),
    run: async () => { repo.inputBox.value = ""; await commands.get("llm-commit.generate")!(); },
  };
}

suite("Phase 3 provider models", () => {
  for (const [provider, model] of [["lm-studio", "qwen2.5-coder-7b-instruct"], ["ollama", "qwen2.5-coder:7b"], ["openai", "gpt-4.1"], ["custom", "qwen2.5-coder-7b-instruct"]]) {
    test(`${provider} uses its documented default without an explicit model`, async () => {
      const f = fixture(provider); if (provider === "openai") { await f.key(); }
      await f.run(); assert.equal(f.calls[0]?.model, model);
    });
    test(`${provider} preserves an explicit legacy string override`, async () => {
      const f = fixture(provider); f.user.model = "explicit/dummy:tag"; if (provider === "openai") { await f.key(); }
      await f.run(); assert.equal(f.calls[0]?.model, "explicit/dummy:tag");
    });
  }
  test("provider map never transfers an Ollama-only override to OpenAI", async () => {
    const f = fixture("openai"); f.user.model = { ollama: "dummy-ollama:tag" }; await f.key(); await f.run();
    assert.equal(f.calls[0]?.model, "gpt-4.1"); f.user.provider = "ollama"; await f.run(); assert.equal(f.calls[1]?.model, "dummy-ollama:tag");
  });
  test("workspace provider overrides a user's provider without inheriting its model map entry", async () => {
    const f = fixture("lm-studio"); f.user.model = { "lm-studio": "dummy-local" }; f.workspace.provider = "openai";
    await f.key(); await f.run(); assert.equal(f.calls[0]?.model, "gpt-4.1");
  });
  test("workspace model entries override matching user entries and preserve others", async () => {
    const f = fixture("openai"); f.user.model = { openai: "dummy-user", ollama: "dummy-ollama" }; f.workspace.model = { openai: "dummy-workspace" };
    await f.key(); await f.run(); assert.equal(f.calls[0]?.model, "dummy-workspace"); f.workspace.provider = "ollama"; await f.run(); assert.equal(f.calls[1]?.model, "dummy-ollama");
  });
  test("workspace legacy override takes precedence over a user legacy override", async () => {
    const f = fixture(); f.user.model = "dummy-user"; f.workspace.model = "dummy-workspace"; await f.run(); assert.equal(f.calls[0]?.model, "dummy-workspace");
  });
});

suite("Phase 3 literal prompt building", () => {
  const diff = "+const tokens = [\"$&\", \"$$\", \"$'\", \"$`\", \"{diff}\"];\n+Unicode: ä 🦊 e\u0301\n+second line";
  test("HTTP inserts every diff character literally", async () => {
    const f = fixture("lm-studio", diff); f.user.prompt = "Before\n{diff}\nAfter"; await f.run(); assert.equal(f.calls[0]?.messages[0].content, `Before\n${diff}\nAfter`);
  });
  test("every placeholder is replaced once without recursively replacing diff text", async () => {
    const f = fixture("lm-studio", diff); f.user.prompt = "{diff}\nSEPARATOR\n{diff}"; await f.run(); assert.equal(f.calls[0]?.messages[0].content, `${diff}\nSEPARATOR\n${diff}`);
  });
  test("Unicode truncation counts code points and never splits surrogate pairs", async () => {
    const f = fixture("lm-studio", "🦊äZ"); f.user.prompt = "{diff}"; f.user.maxDiffLength = 2; await f.run();
    assert.equal(f.calls[0]?.messages[0].content, "🦊ä\n... (diff truncated)");
  });
  test("an exact-length diff is not marked as truncated", async () => {
    const f = fixture("lm-studio", "🦊ä"); f.user.prompt = "{diff}"; f.user.maxDiffLength = 2; await f.run(); assert.equal(f.calls[0]?.messages[0].content, "🦊ä");
  });
  test("maximum allowed diff preserves all 100000 code points", async () => {
    const value = "x".repeat(100000); const f = fixture("lm-studio", value); f.user.maxDiffLength = 100000; f.user.prompt = "{diff}"; await f.run(); assert.equal(f.calls[0]?.messages[0].content, value);
  });
});

suite("Phase 3 configuration validation", () => {
  for (const value of [0, -1, 1.5, NaN, Infinity, "4000", null, 100001]) {
    test(`rejects invalid maxDiffLength ${String(value)} before HTTP`, async () => {
      const f = fixture(); f.user.maxDiffLength = value; await f.run(); assert.equal(f.calls.length, 0); assert.ok(f.errors.some(message => message.includes("maxDiffLength")));
    });
  }
  for (const value of ["", "   ", "No placeholder", "{DIFF}", 123, null]) {
    test(`rejects invalid prompt ${JSON.stringify(value)} before HTTP`, async () => {
      const f = fixture(); f.user.prompt = value; await f.run(); assert.equal(f.calls.length, 0); assert.ok(f.errors.some(message => message.toLowerCase().includes("prompt")));
    });
  }
  for (const value of ["", "   ", 5, null, [], { unknown: "dummy" }, { "lm-studio": "" }, { "lm-studio": 9 }, "dummy\ninvalid"]) {
    test(`rejects invalid model ${JSON.stringify(value)} before HTTP`, async () => {
      const f = fixture(); f.user.model = value; await f.run(); assert.equal(f.calls.length, 0); assert.ok(f.errors.some(message => message.toLowerCase().includes("model")));
    });
  }
  test("unknown provider does not generate or expose its configured value", async () => {
    const f = fixture(dummyKey); await f.run(); assert.equal(f.calls.length, 0); assert.ok(f.errors.length > 0); assert.ok(f.errors.every(message => !message.includes(dummyKey)));
  });
  test("invalid Custom URL is still rejected by Phase 1 without a request", async () => {
    const f = fixture("custom"); f.user.apiUrl = "http://external.invalid/v1"; await f.run(); assert.equal(f.calls.length, 0);
  });
});

suite("Phase 3 response validation", () => {
  for (const [name, value] of [
    ["null body", null], ["array body", []], ["missing choices", {}], ["empty choices", { choices: [] }],
    ["non-array choices", { choices: {} }], ["null choice", { choices: [null] }], ["missing message", { choices: [{}] }],
    ["null message", { choices: [{ message: null }] }], ["null content", { choices: [{ message: { content: null } }] }],
    ["numeric content", { choices: [{ message: { content: 9 } }] }], ["structured content", { choices: [{ message: { content: [{ text: "dummy" }] } }] }],
    ["empty content", { choices: [{ message: { content: "  " } }] }], ["empty normalized message", { choices: [{ message: { content: '"message: "' } }] }],
    ["truncated completion", { choices: [{ finish_reason: "length", message: { content: "fix: truncated" } }] }],
    ["filtered completion", { choices: [{ finish_reason: "content_filter", message: { content: "fix: filtered" } }] }],
  ] as Array<[string, unknown]>) {
    test(`rejects ${name} without applying a draft`, async () => {
      const f = fixture(); f.data = value; await f.run(); assert.equal(f.repo.inputBox.value, ""); assert.ok(f.errors.length > 0);
    });
  }
  test("invalid JSON has a useful static error and never exposes raw exceptions", async () => {
    const f = fixture(); f.invalidJson = true; await f.run(); assert.equal(f.repo.inputBox.value, ""); assert.ok(f.errors.some(message => message.includes("JSON"))); assert.ok(f.errors.every(message => !message.includes(dummyKey)));
  });
  test("legacy response without finish_reason remains supported", async () => {
    const f = fixture(); await f.run(); assert.equal(f.repo.inputBox.value, "fix: dummy response");
  });
  test("valid completion is normalized without changing inner message content", async () => {
    const f = fixture(); f.data = { choices: [{ finish_reason: "stop", message: { content: '"commit message: fix: preserve $& 🦊"' } }] }; await f.run(); assert.equal(f.repo.inputBox.value, "fix: preserve $& 🦊");
  });
  for (const status of [201, 204, 400, 401, 404, 429, 500]) {
    test(`HTTP ${status} has controlled behavior without reading raw error text`, async () => {
      const f = fixture(); f.status = status; if (status === 204) { f.invalidJson = true; }
      await f.run();
      if (status === 201) { assert.equal(f.repo.inputBox.value, "fix: dummy response"); } else { assert.equal(f.repo.inputBox.value, ""); assert.ok(f.errors.length > 0); }
      assert.ok(f.errors.every(message => !message.includes(dummyKey)));
    });
  }
});
suite("Phase 3 additional boundary checks", () => {
  for (const value of ["", " ", null, 7, ["https://dummy.invalid/v1"]]) {
    test(`invalid Custom URL type/value ${JSON.stringify(value)} is rejected before sending`, async () => {
      const f = fixture("custom"); f.user.apiUrl = value; await f.run(); assert.equal(f.calls.length, 0); assert.ok(f.errors.some(message => message.includes("URL")));
    });
  }
  test("invalid model configuration does not prevent secure key setup", async () => {
    const f = fixture("openai"); f.user.model = ""; await f.key(); assert.ok(f.errors.some(message => message.includes("Save or replace"))); await f.run(); assert.equal(f.calls.length, 0);
  });
  test("malformed response objects never reveal sensitive raw content", async () => {
    const f = fixture(); f.data = { choices: [{ message: { content: { authorization: dummyKey } } }] };
    await f.run(); assert.equal(f.repo.inputBox.value, ""); assert.ok(f.errors.length > 0); assert.ok(f.errors.every(message => !message.includes(dummyKey)));
  });
  test("lower length bound allows exactly one Unicode code point", async () => {
    const f = fixture("lm-studio", "🦊X"); f.user.prompt = "{diff}"; f.user.maxDiffLength = 1; await f.run(); assert.equal(f.calls[0]?.messages[0].content, "🦊\n... (diff truncated)");
  });
  test("an explicit null finish reason is treated as incomplete", async () => {
    const f = fixture(); f.data = { choices: [{ finish_reason: null, message: { content: "fix: partial" } }] }; await f.run(); assert.equal(f.repo.inputBox.value, "");
  });
});

suite("Phase 3 real VS Code configuration hierarchy", function () {
  this.timeout(15000);
  let vscode: typeof import("vscode");
  let config: import("vscode").WorkspaceConfiguration;
  let previous: { globalValue?: unknown; workspaceValue?: unknown };
  setup(function () {
    try { vscode = require("vscode") as typeof import("vscode"); } catch { this.skip(); return; }
    if (!vscode.workspace.workspaceFolders?.length) { this.skip(); return; }
    config = vscode.workspace.getConfiguration("llm-commit");
    previous = config.inspect<unknown>("model") ?? {};
  });
  teardown(async () => {
    if (!config || !previous) { return; }
    await config.update("model", previous.workspaceValue, vscode.ConfigurationTarget.Workspace);
    await config.update("model", previous.globalValue, vscode.ConfigurationTarget.Global);
  });
  test("real configuration merges per-provider entries with workspace precedence", async () => {
    await config.update("model", { openai: "dummy-global", ollama: "dummy-ollama" }, vscode.ConfigurationTarget.Global);
    await config.update("model", { openai: "dummy-workspace" }, vscode.ConfigurationTarget.Workspace);
    const effective = vscode.workspace.getConfiguration("llm-commit").get<unknown>("model");
    assert.deepEqual(effective, { openai: "dummy-workspace", ollama: "dummy-ollama" });
    const f = fixture("openai"); f.user.model = effective; await f.key(); await f.run(); assert.equal(f.calls[0]?.model, "dummy-workspace");
  });
  test("real workspace string overrides a global string", async () => {
    await config.update("model", "dummy-global", vscode.ConfigurationTarget.Global);
    await config.update("model", "dummy-workspace", vscode.ConfigurationTarget.Workspace);
    assert.equal(vscode.workspace.getConfiguration("llm-commit").get("model"), "dummy-workspace");
  });
  test("real model default is an empty provider map", async () => {
    await config.update("model", undefined, vscode.ConfigurationTarget.Global);
    await config.update("model", undefined, vscode.ConfigurationTarget.Workspace);
    assert.deepEqual(vscode.workspace.getConfiguration("llm-commit").get("model"), {});
  });
});
suite("Phase 3 explicit identifier compatibility", () => {
  test("a non-empty explicitly configured model identifier is not silently normalized", async () => {
    const f = fixture(); f.user.model = "  explicit dummy identifier  "; await f.run(); assert.equal(f.calls[0]?.model, "  explicit dummy identifier  ");
  });
});

suite("Phase 7 supported providers and legacy settings", () => {
  test("manifest exposes exactly the four HTTP providers", () => {
    assert.deepEqual(manifest.contributes.configuration.properties["llm-commit.provider"].enum, ["custom", "lm-studio", "ollama", "openai"]);
  });
  test("prepublish needs only the JavaScript production build", () => {
    assert.equal(manifest.scripts["vscode:prepublish"], "npm run package");
    assert.equal(manifest.scripts["build:swift"], undefined);
  });
  for (const source of ["user", "workspace"] as const) {
    test("legacy Apple selection in " + source + " settings cannot send or mutate credentials", async () => {
      const f = fixture("openai"); await f.key();
      f[source].provider = "apple";
      const settings = JSON.stringify([f.user, f.workspace]);
      const saved = JSON.stringify([...f.secrets]); const approvals = JSON.stringify([...f.approvals]);
      f.errors.length = 0;
      await f.run(); await f.key(); await f.removeKey();
      assert.equal(f.calls.length, 0); assert.equal(f.repo.inputBox.value, "");
      assert.equal(JSON.stringify([...f.secrets]), saved); assert.equal(JSON.stringify([...f.approvals]), approvals);
      assert.equal(JSON.stringify([f.user, f.workspace]), settings);
      assert.ok(f.errors.some(message => /no longer supported/i.test(message)));
      assert.ok(f.errors.every(message => !message.includes(dummyKey)));
    });
  }
});
