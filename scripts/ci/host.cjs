"use strict";
const assert = require("node:assert/strict");
const { fs, path, os, cp, project, config, roots, hash, json, run, must, fixtureEnv } = require("./lib.cjs");
const { verifyPackage } = require("./tasks.cjs");
const { resolveUnixLauncher, invokeInstaller } = require("./launcher.cjs");
function cliScript(executable) {
  const base = path.dirname(executable), candidates = [path.join(base, "resources/app/out/cli.js"), path.resolve(base, "../Resources/app/out/cli.js")];
  for (const entry of fs.readdirSync(base, { withFileTypes: true })) { if (entry.isDirectory()) { candidates.push(path.join(base, entry.name, "resources/app/out/cli.js")); } }
  const found = candidates.filter(file => fs.existsSync(file));
  if (found.length !== 1) { throw new Error("Cannot uniquely resolve the official Code CLI script"); } return found[0];
}
async function main() {
  if (process.platform === "linux" && !process.env.DISPLAY) { throw new Error("Linux host tests require Xvfb DISPLAY; run through dbus-run-session and xvfb-run"); }
  const directory = path.resolve(process.argv[2] || "");
  const reference = verifyPackage(directory), { privateRoot } = roots();
  const { downloadAndUnzipVSCode, runTests } = require("@vscode/test-electron");
  const helper = path.join(privateRoot, "helper"); fs.mkdirSync(helper, { recursive: true });
  fs.writeFileSync(path.join(helper, "package.json"), JSON.stringify({ name: "phase6-probe", publisher: "local-validation", version: "0.0.1", engines: { vscode: "^1.80.0" }, main: "main.js", activationEvents: ["*"] }));
  fs.writeFileSync(path.join(helper, "main.js"), "exports.activate = context => ({ secrets: context.secrets });");
  const results = [];
  for (const version of config.vscode) {
    const host = path.join(privateRoot, "host-" + version), profile = path.join(host, "profile"), extensions = path.join(host, "extensions"), workspace = path.join(host, "workspace");
    try {
      for (const folder of [path.join(profile, "User"), extensions, workspace]) { fs.mkdirSync(folder, { recursive: true }); }
      fs.writeFileSync(path.join(profile, "User/settings.json"), JSON.stringify({ "telemetry.telemetryLevel": "off", "update.mode": "none", "extensions.autoUpdate": false, "git.openRepositoryInParentFolders": "always", "security.workspace.trust.enabled": false }));
      must(run("git", ["-C", workspace, "init", "--quiet"], "git-init-" + version), "Temporary Git repository");
      const override = process.env[version === "1.80.0" ? "LLM_CI_CODE_MINIMUM" : "LLM_CI_CODE_CURRENT"];
      const downloaded = override ? fs.realpathSync(override) : await downloadAndUnzipVSCode({ version, cachePath: path.join(privateRoot, "vscode-cache"), timeout: 120000 });
      const diagnosis = { version, platform: process.platform, arch: process.arch,
        displayPresent: !!process.env.DISPLAY, sessionBusPresent: !!process.env.DBUS_SESSION_BUS_ADDRESS,
        profile: path.relative(privateRoot, profile), extensions: path.relative(privateRoot, extensions) };
      let executable;
      try {
        const env = { ...process.env };
        delete env.VSCODE_IPC_HOOK_CLI;
        let launcher, prefix;
        if (process.platform === "win32") {
          executable = downloaded;
          launcher = executable;
          prefix = [cliScript(executable), ...(version === "1.80.0" ? ["--ms-enable-electron-run-as-node"] : [])];
          env.ELECTRON_RUN_AS_NODE = "1";
        } else {
          const resolved = resolveUnixLauncher(downloaded, process.platform);
          executable = resolved.runtime;
          launcher = resolved.launcher;
          prefix = [];
          delete env.ELECTRON_RUN_AS_NODE;
        }
        diagnosis.runtime = path.basename(executable);
        diagnosis.launcherRelativeToRuntime = path.relative(path.dirname(executable), launcher);
        diagnosis.launcherChecked = process.platform === "win32" ? "spawn probe" : "regular executable file";
        const profileArgs = ["--extensions-dir", extensions, "--user-data-dir", profile];
        diagnosis.probe = invokeInstaller(launcher, [...prefix, ...profileArgs, "--version"], env);
        if (diagnosis.probe.status !== 0 || diagnosis.probe.stdout.version !== version) {
          throw new Error("VS Code CLI version probe failed for " + version);
        }
        diagnosis.install = invokeInstaller(launcher, [...prefix, ...profileArgs, "--install-extension", path.join(directory, config.vsix), "--force"], env);
        if (diagnosis.install.status !== 0) {
          throw new Error("VSIX installation failed for " + version);
        }
      } catch (error) {
        diagnosis.failure = error.message;
        throw error;
      } finally {
        json("install-" + version + "-diagnostics.json", diagnosis);
      }
      const output = path.join(roots().reports, "host-" + version + ".json");
      const launchArgs = [workspace, "--user-data-dir", profile, "--extensions-dir", extensions, "--disable-gpu", "--skip-welcome", "--skip-release-notes", "--disable-workspace-trust"];
      if (process.platform === "linux") { launchArgs.push("--password-store=basic"); }
      await runTests({ vscodeExecutablePath: executable, extensionDevelopmentPath: [helper], extensionTestsPath: path.join(project, "scripts/ci/installed-entry.cjs"), extensionTestsEnv: { ...fixtureEnv(), LLM_CI_HOST_TLS_REPORT: path.join(roots().reports, "tls-host-" + version + ".json"), LLM_COMMIT_INSTALLED_ROOT: extensions, LLM_COMMIT_COMPATIBILITY_REPORT: output, LLM_COMMIT_REAL_GIT_PROBE: "1", LLM_COMMIT_TEST_WORKSPACE_ROOT: workspace }, launchArgs });
      const report = JSON.parse(fs.readFileSync(output, "utf8"));
      assert.equal(report.status, "passed"); assert.equal(report.vscode, version); assert.equal(report.platform, process.platform); assert.equal(report.realInstalledGitGeneration?.status, "passed");
      assert.equal(hash(path.join(report.extensionPath, "dist/extension.js")), reference.productionBundleSHA256);
      const installedManifest = JSON.parse(fs.readFileSync(path.join(report.extensionPath, "package.json"), "utf8")); delete installedManifest.__metadata; assert.deepEqual(installedManifest, require("../../package.json"));
      results.push({ version, status: "passed", node: report.node, platform: process.platform, arch: process.arch, sameVSIX: reference.sha256, realGitAndHTTP: true, consentUI: "simulated exact owned dummy origin", secretStorage: process.platform === "linux" ? "real API with explicit basic dummy-only backend; OS keyring NOT verified" : "real helper API; cross-session durability NOT verified" });
    } catch (error) { results.push({ version, status: "failed", reason: error.message }); console.error("Host " + version + " failed: " + error.message); }
  }
  json("host-matrix.json", { results, mandatoryMinimum: "1.80.0", displayPresent: !!process.env.DISPLAY, platform: process.platform, arch: process.arch });
  if (results.some(result => result.status !== "passed")) { throw new Error("One or more mandatory installed-host runs failed"); }
}
module.exports = { cliScript, main };
if (require.main === module) { main().catch(error => { console.error(error.message); process.exitCode = 1; }); }
