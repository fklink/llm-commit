"use strict";
const { test } = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { checkAudit, auditFingerprint, verifyArchive, hash, roots, config } = require("./lib.cjs");
const baseline = require("../../docs/phase7-evidence.json").audits.project;
const clone = value => JSON.parse(JSON.stringify(value));
const beforeDeadline = new Date("2026-11-02T12:00:00Z");
test("mandatory host pins retain minimum and tested current version", () => { assert.equal(config.vscode[0], "1.80.0"); assert.ok(/^\d+\.\d+\.\d+$/.test(config.vscode[1])); assert.equal(config.node, fs.readFileSync(path.resolve(__dirname, "../../.node-version"), "utf8").trim()); assert.equal("pnpm@" + config.pnpm, require("../../package.json").packageManager); });
test("exact known project findings remain visible within existing review window", () => { const result = checkAudit(clone(baseline), baseline, 1, beforeDeadline); assert.equal(result.findings, 4); assert.match(result.status, /not audit-clean/); });
test("new dependency paths on a known advisory block CI", () => { const report = clone(baseline); Object.values(report.advisories)[0].findings[0].paths.push(".>new>attacker-path"); assert.throws(() => checkAudit(report, baseline, 1, beforeDeadline), /New or changed/); });
test("severity or version changes block CI", () => { for (const change of [entry => { entry.severity = "critical"; }, entry => { entry.findings[0].version = "999.0.0"; }]) { const report = clone(baseline); change(Object.values(report.advisories)[0]); assert.throws(() => checkAudit(report, baseline, 1, beforeDeadline), /New or changed/); } });
test("risk acceptance expires at the review date", () => { assert.throws(() => checkAudit(baseline, baseline, 1, new Date("2026-12-01T00:00:00Z")), /expired/); });
test("invalid audit JSON shapes, registry errors and inconsistent status fail closed", () => { for (const [report, status] of [[{ error: { code: "DUMMY_REGISTRY_ERROR" } }, 1], [baseline, null], [baseline, 0]]) { assert.throws(() => checkAudit(report, baseline, status, beforeDeadline)); } });
test("zero findings remain valid after deadline", () => { const clean = { advisories: {}, metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0 } } }; assert.equal(checkAudit(clean, { advisories: {} }, 0, new Date("2027-01-01T00:00:00Z")).findings, 0); });
test("changed dev/prod reachability changes audit fingerprint", () => { const item = Object.values(baseline.advisories)[0], other = clone(item); other.findings[0].dev = !other.findings[0].dev; assert.notEqual(auditFingerprint(item), auditFingerprint(other)); });
test("tampered downloaded VSIX is rejected before installation", () => { const root = fs.mkdtempSync(path.join(os.tmpdir(), "llm-ci-integrity-")), file = path.join(root, "dummy.vsix"); try { fs.writeFileSync(file, "dummy-original"); const reference = { sha256: hash(file), productionBundleSHA256: "a".repeat(64), entries: Array(8).fill({}) }; assert.equal(verifyArchive(file, reference), reference); fs.writeFileSync(file, "dummy-tampered"); assert.throws(() => verifyArchive(file, reference), /checksum/); } finally { fs.unlinkSync(file); fs.rmdirSync(root); } });
test("private TLS fixtures cannot be placed under archived reports", () => { const previous = [process.env.LLM_CI_REPORTS, process.env.LLM_CI_PRIVATE]; try { process.env.LLM_CI_REPORTS = path.join(os.tmpdir(), "dummy-ci-reports"); process.env.LLM_CI_PRIVATE = path.join(process.env.LLM_CI_REPORTS, "private"); assert.throws(() => roots(), /outside archived/); } finally { for (const [index, name] of ["LLM_CI_REPORTS", "LLM_CI_PRIVATE"].entries()) { if (previous[index] === undefined) { delete process.env[name]; } else { process.env[name] = previous[index]; } } } });
test("packager findings do not inherit project risk acceptance", () => { const tools = require("../../docs/phase7-evidence.json").audits.isolatedPackager; for (const date of [beforeDeadline, new Date("2027-01-01T00:00:00Z")]) { assert.throws(() => checkAudit(tools, tools, 1, date, false), /no approved risk acceptance/); } });
test("global bootstrap refuses to mutate a local developer installation", () => { const previous = process.env.GITHUB_ACTIONS; try { process.env.GITHUB_ACTIONS = "false"; assert.throws(() => require("./bootstrap.cjs").main(), /restricted to GitHub Actions/); } finally { if (previous === undefined) { delete process.env.GITHUB_ACTIONS; } else { process.env.GITHUB_ACTIONS = previous; } } });
test("audit fingerprints are independent of finding/path order", () => { const report = clone(baseline); for (const entry of Object.values(report.advisories)) { entry.findings.reverse(); for (const finding of entry.findings) { finding.paths.reverse(); } } assert.equal(checkAudit(report, baseline, 1, beforeDeadline).findings, 4); });
test("incomplete producer inspection is rejected even for an intact file", () => { const root = fs.mkdtempSync(path.join(os.tmpdir(), "llm-ci-reference-")), file = path.join(root, "dummy.vsix"); try { fs.writeFileSync(file, "dummy"); assert.throws(() => verifyArchive(file, { sha256: hash(file), entries: [] }), /Incomplete/); } finally { fs.unlinkSync(file); fs.rmdirSync(root); } });
test("reports cannot overwrite the source checkout", () => { const previous = [process.env.LLM_CI_REPORTS, process.env.LLM_CI_PRIVATE]; try { process.env.LLM_CI_REPORTS = path.resolve(__dirname, "../.."); process.env.LLM_CI_PRIVATE = path.join(os.tmpdir(), "dummy-private-outside"); assert.throws(() => roots(), /outside the repository/); } finally { for (const [index, name] of ["LLM_CI_REPORTS", "LLM_CI_PRIVATE"].entries()) { if (previous[index] === undefined) { delete process.env[name]; } else { process.env[name] = previous[index]; } } } });
test("CI bootstrap rejects disabled TLS before any global installation", () => { const previous = [process.env.GITHUB_ACTIONS, process.env.NODE_TLS_REJECT_UNAUTHORIZED]; try { process.env.GITHUB_ACTIONS = "true"; process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; assert.throws(() => require("./bootstrap.cjs").main(), /TLS verification must remain enabled/); } finally { for (const [index, name] of ["GITHUB_ACTIONS", "NODE_TLS_REJECT_UNAUTHORIZED"].entries()) { if (previous[index] === undefined) { delete process.env[name]; } else { process.env[name] = previous[index]; } } } });

const { resolveUnixLauncher, invokeInstaller } = require("./launcher.cjs");
function launcherFixture(t, files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "llm-launcher-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const relative of files) {
    const file = path.join(root, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, "", { mode: 0o755 });
  }
  return root;
}
test("Linux uses the official CLI launcher beside the downloaded runtime", t => {
  const root = launcherFixture(t, ["code", "bin/code"]);
  const runtime = path.join(root, "code");
  assert.deepEqual(resolveUnixLauncher(runtime, "linux"), {
    runtime, launcher: path.join(root, "bin/code")
  });
});
test("macOS resolves the bundle executable rather than assuming Electron", t => {
  const bundle = "Visual Studio Code.app/Contents/";
  const root = launcherFixture(t, [bundle + "MacOS/Code", bundle + "Resources/app/bin/code", bundle + "Info.plist"]);
  const guess = path.join(root, bundle, "MacOS/Electron");
  const resolved = resolveUnixLauncher(guess, "darwin", plist => {
    assert.equal(plist, path.join(root, bundle, "Info.plist"));
    return "Code";
  });
  assert.equal(resolved.runtime, path.join(root, bundle, "MacOS/Code"));
  assert.equal(resolved.launcher, path.join(root, bundle, "Resources/app/bin/code"));
  assert.throws(() => resolveUnixLauncher(guess, "darwin", () => "../Code"), /invalid bundle executable/);
  assert.throws(() => resolveUnixLauncher(guess, "darwin", () => "Missing"), /runtime.*ENOENT/);
});
test("missing or invalid CLI launchers are rejected before spawning", t => {
  const root = launcherFixture(t, ["code"]);
  const runtime = path.join(root, "code");
  assert.throws(() => resolveUnixLauncher(runtime, "linux"), /launcher.*ENOENT/);
  fs.mkdirSync(path.join(root, "bin/code"), { recursive: true });
  assert.throws(() => resolveUnixLauncher(runtime, "linux"), /launcher.*regular file/);
});
test("installer passes VSIX and profile arguments literally and reports only safe output", () => {
  const args = ["--install-extension", "fixture path/dummy.vsix", "--user-data-dir", "dummy profile"];
  const script = "if (JSON.stringify(process.argv.slice(1)) !== " + JSON.stringify(JSON.stringify(args)) +
    ") process.exit(2); console.log('Extension installed successfully.'); console.error('Authorization: Bearer dummy-secret');";
  const result = invokeInstaller(process.execPath, ["-e", script, "--", ...args], process.env);
  assert.equal(result.status, 0);
  assert.equal(result.stdout.installed, true);
  assert.equal(result.stderr.hadOutput, true);
  assert.doesNotMatch(JSON.stringify(result), /dummy-secret|fixture path|dummy profile/);
});
test("installer preserves exit failures, blank output and spawn error codes", t => {
  const failed = invokeInstaller(process.execPath, ["-e", "process.exit(1)"], process.env);
  assert.equal(failed.status, 1);
  assert.equal(failed.stderr.hadOutput, false);
  const root = launcherFixture(t, []);
  const missing = invokeInstaller(path.join(root, "missing"), [], process.env);
  assert.equal(missing.error, "ENOENT");
  assert.equal(missing.status, null);
});

const { execFileSync, spawnSync } = require("node:child_process");
function secretServiceFixture(t, mode) {
  const root = launcherFixture(t, ["private/.keep"]);
  const privateRoot = path.join(root, "private");
  const hooks = path.join(root, "hooks.sh");
  const marker = path.join(root, "host-ran");
  fs.writeFileSync(hooks, [
    'dbus-run-session() { shift; DBUS_SESSION_BUS_ADDRESS=fixture-bus "$@"; }',
    'openssl() { printf "%064d\\n" 1; }',
    'gnome-keyring-daemon() { cat >/dev/null; exec sleep 30; }',
    'gdbus() {',
    '  case "$*" in',
    '    *NameHasOwner*) [[ "$FIXTURE_MODE" != bad-bus ]] || return 1; echo "(false,)" ;;',
    '    *GetConnectionUnixProcessID*) [[ "$FIXTURE_MODE" != missing ]] || return 1; printf "(uint32 %s,)\\n" "$keyring_pid" ;;',
    '    *ReadAlias*) echo "(objectpath \"/org/freedesktop/secrets/collection/login\",)" ;;',
    '    *Properties.Get*Locked*) if [[ "$FIXTURE_MODE" == locked ]]; then echo "(<true>,)"; else echo "(<false>,)"; fi ;;',
    '    *SearchItems*) if [[ -f "$FIXTURE_MARKER" && "$FIXTURE_MODE" != no-encryption ]]; then echo "([objectpath \"/org/freedesktop/secrets/collection/login/1\"], @ao [])"; else echo "(@ao [], @ao [])"; fi ;;',
    '    *) return 2 ;;',
    '  esac',
    '}',
    'timeout() { shift; "$@"; }',
    'secret-tool() { case "$1" in store) cat >/dev/null; [[ "$FIXTURE_MODE" != uninitialized ]] ;; lookup) printf "%s" llm-commit-secret-service-dummy ;; clear) return 0 ;; esac; }',
    'xvfb-run() { [[ "$DBUS_SESSION_BUS_ADDRESS" == fixture-bus ]] || return 2; touch "$FIXTURE_MARKER"; [[ "$FIXTURE_MODE" != host-fails ]]; }'
  ].join("\n") + "\n");
  const bash = process.platform === "win32"
    ? path.resolve(execFileSync("git", ["--exec-path"], { encoding: "utf8" }).trim(), "../../../bin/bash.exe")
    : "bash";
  const unixPath = value => value.replace(/\\/g, "/");
  const result = spawnSync(bash, ["scripts/ci/linux-secret-service.sh", "unused-host"], {
    encoding: "utf8", timeout: 15000,
    env: { ...process.env, BASH_ENV: unixPath(hooks), LLM_CI_PRIVATE: unixPath(privateRoot),
      FIXTURE_MODE: mode, FIXTURE_MARKER: unixPath(marker) }
  });
  assert.ifError(result.error);
  assert.deepEqual(fs.readdirSync(privateRoot), [".keep"], "private fixture must be removed");
  return { ...result, hostRan: fs.existsSync(marker) };
}
test("Secret Service roundtrip gates the host and cleans the isolated session", t => {
  const result = secretServiceFixture(t, "ready");
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.hostRan, true);
  assert.match(result.stdout, /encrypted host keyring item observed/);
});
for (const [mode, message] of [
  ["bad-bus", /D-Bus session unavailable/],
  ["missing", /Secret Service did not become available/],
  ["locked", /default collection is locked/],
  ["uninitialized", /Secret Service store failed/],
  ["no-encryption", /No host keyring item observed/],
  ["host-fails", /Linux host tests failed/]
]) {
  test("Secret Service fails closed and cleans up: " + mode, t => {
    const result = secretServiceFixture(t, mode);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, message);
    assert.equal(result.hostRan, mode === "no-encryption" || mode === "host-fails");
  });
}
