"use strict";
// Portable installed-VSIX entry point for @vscode/test-electron; no extension development path for LLM Commit.
exports.run = () => new Promise((resolve, reject) => {
  const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict");
  const Mocha = require("mocha"), vscode = require("vscode");
  const suite = new Mocha({ ui: "tdd", timeout: 20000, forbidOnly: true });
  const directory = path.resolve(__dirname, "../out/test");
  for (const file of fs.readdirSync(directory).filter(file => file.endsWith(".test.js")).sort()) { suite.addFile(path.join(directory, file)); }
  suite.suite.emit("pre-require", global, __filename, suite);
  global.suite("Installed platform compatibility", () => global.test("activates the installed archive and probes Git, SecretStorage and HTTP", async function () { this.timeout(process.env.LLM_COMMIT_REAL_GIT_PROBE === "1" ? 180000 : 20000);
    assert.ok(process.env.LLM_COMMIT_INSTALLED_ROOT, "Set isolated installed extensions root");
    const extension = vscode.extensions.getExtension("evertjunior.llm-commit");
    assert.ok(extension);
    const relative = path.relative(path.resolve(process.env.LLM_COMMIT_INSTALLED_ROOT), extension.extensionPath);
    assert.ok(relative && relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative));
    // A helper extension is required to exercise genuine SecretStorage.
    assert.ok(vscode.extensions.getExtension("local-validation.phase6-probe"));
    await require("./compatibility-probe.cjs").run();
  }));
  suite.run(failures => failures ? reject(new Error(failures + " platform test failures")) : resolve());
});
