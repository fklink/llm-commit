"use strict";
// Run only as a VS Code extension-test entry point; no project runtime changes.
exports.run = async () => {
  const vscode = require("vscode");
  const fs = require("node:fs");
  const http = require("node:http");
  const assert = require("node:assert/strict");
  const report = { vscode: vscode.version, node: process.versions.node, platform: process.platform, arch: process.arch, remoteName: vscode.env.remoteName || null, fetch: typeof globalThis.fetch, AbortController: typeof AbortController, AbortSignal: typeof AbortSignal };
  try {
    const extension = vscode.extensions.getExtension("evertjunior.llm-commit");
    assert.ok(extension);
    await extension.activate();
    report.extensionPath = extension.extensionPath;
    report.extensionKind = extension.extensionKind;
    const commands = await vscode.commands.getCommands(true);
    assert.ok(["generate", "setApiKey", "removeApiKey"].every(name => commands.includes("llm-commit." + name)));
    report.activation = true;
    const git = await vscode.extensions.getExtension("vscode.git").activate();
    const api = git.getAPI(1);
    report.gitApi = typeof api.openRepository === "function" && typeof api.onDidCloseRepository === "function";
    assert.ok(report.gitApi);
    report.repositoryRoots = [];
    for (const folder of vscode.workspace.workspaceFolders || []) { const repository = await api.openRepository(folder.uri); assert.ok(repository); report.repositoryRoots.push(repository.rootUri.toString()); }
    report.workspaceFolders = vscode.workspace.workspaceFolders?.length || 0;
    const storageProbe = vscode.extensions.getExtension("local-validation.phase6-probe");
    if (storageProbe) {
      const probe = await storageProbe.activate();
      const key = "phase6-dummy-compatibility-key";
      try { await probe.secrets.store(key, "dummy-key-only"); assert.equal(await probe.secrets.get(key), "dummy-key-only"); report.secretStorage = true; }
      finally { await probe.secrets.delete(key); }
    }
    assert.equal(typeof AbortController, "function");
    assert.equal(typeof AbortSignal, "function");
    const path = require("node:path");
    const previousBundle = process.env.LLM_COMMIT_REGRESSION_BUNDLE_PATH;
    process.env.LLM_COMMIT_REGRESSION_BUNDLE_PATH = path.join(extension.extensionPath, "dist/extension.js");
    try { await require("./http-node16-regression.cjs").run(); report.nativeHttp = true; report.installedBundleHttpGeneration = true; }
    finally { if (previousBundle === undefined) { delete process.env.LLM_COMMIT_REGRESSION_BUNDLE_PATH; } else { process.env.LLM_COMMIT_REGRESSION_BUNDLE_PATH = previousBundle; } }
    if (process.env.LLM_COMMIT_REAL_GIT_PROBE === "1") {
      const folder = vscode.workspace.workspaceFolders?.[0];
      assert.ok(folder && process.env.LLM_COMMIT_TEST_WORKSPACE_ROOT);
      assert.equal(path.relative(fs.realpathSync(process.env.LLM_COMMIT_TEST_WORKSPACE_ROOT), fs.realpathSync(folder.uri.fsPath)), "");
      const repository = await api.openRepository(folder.uri); assert.ok(repository);
      const config = vscode.workspace.getConfiguration("llm-commit", folder.uri);
      const keys = ["provider", "model", "prompt", "maxDiffLength", "timeoutSeconds", "apiUrl"];
      const previous = Object.fromEntries(keys.map(key => [key, config.inspect(key)?.workspaceValue]));
      const initialDraft = repository.inputBox.value;
      const ownedFile = path.join(folder.uri.fsPath, "phase7-controlled-" + require("node:crypto").randomUUID() + ".txt");
      assert.equal(fs.existsSync(ownedFile), false);
      let server, provider, hits = 0, received, hasAuthorization = false;
      for (const [name, port] of [["custom", 0]]) {
        const candidate = http.createServer((request, response) => {
          hits++; hasAuthorization ||= !!request.headers.authorization;
          let body = ""; request.on("data", chunk => { body += chunk; });
          request.on("end", () => { received = JSON.parse(body); response.setHeader("Content-Type", "application/json"); response.end(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: "fix: phase7 staged dummy" } }] })); });
        });
        try { await new Promise((resolve, reject) => { candidate.once("error", reject); candidate.listen(port, "127.0.0.1", resolve); }); server = candidate; provider = name; break; }
        catch (error) { if (error.code !== "EADDRINUSE") { throw error; } }
      }
      assert.ok(server, "Controlled local dummy server unavailable");
      try {
        const values = { provider, model: "dummy-phase7-model", prompt: "Generate {diff}", maxDiffLength: 4000, timeoutSeconds: 5, apiUrl: "http://127.0.0.1:" + server.address().port + "/v1/chat/completions" };
        for (const [key, value] of Object.entries(values)) { await config.update(key, value, vscode.ConfigurationTarget.Workspace); }
        fs.writeFileSync(ownedFile, "phase7 dummy Unicode ä and literal $&" + String.fromCharCode(10));
        await repository.add([ownedFile]); await repository.status();
        repository.inputBox.value = "";
        report.realGitCommand = { trusted: vscode.workspace.isTrusted, configuredProvider: vscode.workspace.getConfiguration("llm-commit").get("provider"), stagedDiffLength: (await repository.diff(true)).length };
        const targetAPI = require("node:module").createRequire(path.join(extension.extensionPath, "dist/extension.js"))("vscode");
        const originalWarning = targetAPI.window.showWarningMessage;
        let confirmations = 0;
        // Only the UI answer is a double: exact owned dummy origin, no credentials.
        targetAPI.window.showWarningMessage = async (message, options, action) => {
          if (action === "Authorize API origin" && message.includes("custom at " + new URL(values.apiUrl).origin + " ")) { confirmations++; return action; }
          return originalWarning(message, options, action);
        };
        try { await vscode.commands.executeCommand("llm-commit.generate"); }
        finally { targetAPI.window.showWarningMessage = originalWarning; }
        report.realGitCommand.hits = hits; report.realGitCommand.simulatedConsentResponses = confirmations;
        assert.equal(repository.inputBox.value, "fix: phase7 staged dummy");
        assert.equal(hits, 1); assert.equal(hasAuthorization, false);
        assert.equal(received.model, "dummy-phase7-model");
        assert.ok(received.messages[0].content.includes("phase7 dummy Unicode ä and literal $&"));
        report.realInstalledGitGeneration = { status: "passed", provider, requests: hits, stagedDiffObserved: true, scmInputUpdated: true, authorizationHeaderAbsent: true, gitAndHttpDoublesUsed: false, consentUI: "exact owned origin confirmation simulated" };
      } finally {
        repository.inputBox.value = initialDraft;
        for (const key of keys) { await config.update(key, previous[key], vscode.ConfigurationTarget.Workspace); }
        await new Promise(resolve => server.close(resolve));
      }
    }
    report.status = "passed";
  } catch (error) { report.status = "failed"; report.failure = error.code || error.name; throw error; }
  finally { if (process.env.LLM_COMMIT_COMPATIBILITY_REPORT) { fs.writeFileSync(process.env.LLM_COMMIT_COMPATIBILITY_REPORT, JSON.stringify(report, null, 2) + "\n"); } console.log("PHASE6_COMPATIBILITY " + JSON.stringify(report)); }
};
