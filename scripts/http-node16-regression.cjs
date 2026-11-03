"use strict";
// Regression: actual compiled command, native loopback server, no fetch/Response globals.
exports.run = async () => {
  const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), http = require("node:http"), vm = require("node:vm");
  let calls = 0;
  const server = http.createServer((request, response) => { calls++; request.resume(); response.end(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: "fix: node16 HTTP compatibility" } }] })); });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const repo = { rootUri: { toString: () => "file:///phase61-dummy" }, inputBox: { value: "" }, diff: async () => "+dummy staged content" };
  const commands = new Map(), notices = [], subscriptions = [];
  const settings = { provider: "custom", apiUrl: `http://127.0.0.1:${server.address().port}/v1`, model: {}, prompt: "Generate {diff}", maxDiffLength: 4000, timeoutSeconds: 2 };
  const vscode = { env: { machineId: "phase61-dummy-local" }, ProgressLocation: { Notification: 15 }, workspace: { isTrusted: true, getConfiguration: () => ({ get: (key, fallback) => settings[key] ?? fallback, inspect: () => ({}) }) }, extensions: { getExtension: () => ({ isActive: true, exports: { getAPI: () => ({ repositories: [repo] }) } }) }, commands: { registerCommand: (id, fn) => { commands.set(id, fn); return { dispose() {} }; } }, window: { withProgress: async (_options, fn) => fn({ report() {} }), showWarningMessage: async (message, _options, action) => { notices.push(message); return action; }, showErrorMessage: message => notices.push(message), showInformationMessage: message => notices.push(message) } };
  const compiled = process.env.LLM_COMMIT_REGRESSION_BUNDLE_PATH || path.resolve(__dirname, "../out/extension.js"), output = { exports: {} };
  try {
    vm.runInNewContext(fs.readFileSync(compiled, "utf8"), { module: output, exports: output.exports, process, AbortController, URL, Buffer, console, require: id => id === "vscode" ? vscode : id.startsWith("./") ? require(path.resolve(path.dirname(compiled), id)) : require(id) });
    output.exports.activate({ subscriptions, extensionPath: path.resolve(__dirname, ".."), secrets: { get: async () => undefined }, globalState: { get: () => undefined, update: async () => undefined } });
    await commands.get("llm-commit.generate")(repo);
    assert.equal(repo.inputBox.value, "fix: node16 HTTP compatibility", "HTTP generation must work without global fetch/Response");
    assert.equal(calls, 1);
    console.log("NODE16_HTTP_REGRESSION passed; Node " + process.versions.node + "; native request received; no fetch global supplied.");
  } finally { await output.exports.deactivate?.(); for (const disposable of subscriptions) { disposable.dispose(); } server.closeAllConnections?.(); await new Promise(resolve => server.close(resolve)); }
};
if (require.main === module) { exports.run().catch(error => { console.error(error); process.exitCode = 1; }); }
