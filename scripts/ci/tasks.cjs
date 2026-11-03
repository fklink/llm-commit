"use strict";
const { fs, path, os, cp, project, config, roots, hash, json, run, must, pnpm, fixtureEnv, checkAudit, verifyArchive } = require("./lib.cjs");
function read(file) { return JSON.parse(fs.readFileSync(file, "utf8")); }
function inputs() {
  const files = ["package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", ".node-version", ".github/packager/pnpm-lock.yaml"];
  function visit(directory) { for (const entry of fs.readdirSync(directory, { withFileTypes: true })) { const file = path.join(directory, entry.name); if (entry.isDirectory()) { visit(file); } else { files.push(path.relative(project, file)); } } }
  visit(path.join(project, "src")); return Object.fromEntries(files.sort().map(file => [file, hash(path.join(project, file))]));
}
function verifyInputs() {
  const before = read(path.join(roots().reports, "inputs.json"));
  if (JSON.stringify(inputs()) !== JSON.stringify(before)) { throw new Error("Source, manifest, dependency configuration or frozen lock changed during CI"); }
}
function prepare() {
  if (process.arch !== config.architecture) { throw new Error("Unexpected runner architecture; only the declared x64 matrix is configured"); }
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0") { throw new Error("TLS verification must remain enabled in CI"); }
  if (process.versions.node !== config.node) { throw new Error("Unexpected quality Node version"); }
  const version = must(pnpm(["--version"], "pnpm-version"), "pnpm version").stdout.trim();
  if (version !== config.pnpm || require("../../package.json").packageManager !== "pnpm@" + config.pnpm || fs.readFileSync(path.join(project, ".node-version"), "utf8").trim() !== config.node) { throw new Error("Toolchain pins disagree"); }
  json("environment.json", { platform: process.platform, arch: process.arch, os: os.release(), node: process.versions.node, pnpm: version, imageOS: process.env.ImageOS || null, imageVersion: process.env.ImageVersion || null, githubActions: process.env.GITHUB_ACTIONS === "true", run: process.env.GITHUB_RUN_ID || null, attempt: process.env.GITHUB_RUN_ATTEMPT || null, source: process.env.GITHUB_SHA || null, displayPresent: !!process.env.DISPLAY });
  json("inputs.json", inputs());
  const { privateRoot } = roots();
  const ssl = process.env.LLM_CI_OPENSSL || (process.platform === "win32" && fs.existsSync("C:/Program Files/Git/usr/bin/openssl.exe") ? "C:/Program Files/Git/usr/bin/openssl.exe" : "openssl");
  must(run(ssl, ["version"], "openssl-version"), "OpenSSL");
  const settings = path.join(privateRoot, "tls.cnf");
  fs.writeFileSync(settings, "[req]\ndistinguished_name=dn\nx509_extensions=ext\nprompt=no\n[dn]\nCN=127.0.0.1\n[ext]\nsubjectAltName=IP:127.0.0.1\nbasicConstraints=critical,CA:TRUE\n");
  must(run(ssl, ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-sha256", "-days", "2", "-config", settings, "-keyout", path.join(privateRoot, "tls-key.pem"), "-out", path.join(privateRoot, "tls-cert.pem")], "tls-fixture"), "TLS fixture generation");
  const wrong = path.join(privateRoot, "wrong-host.cnf");
  fs.writeFileSync(wrong, fs.readFileSync(settings, "utf8").replace(/127\.0\.0\.1/g, "127.0.0.2"));
  must(run(ssl, ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-sha256", "-days", "2", "-config", wrong, "-keyout", path.join(privateRoot, "wrong-host-key.pem"), "-out", path.join(privateRoot, "wrong-host-cert.pem")], "wrong-host-fixture"), "Wrong-host TLS fixture");
  if (process.platform !== "win32") { for (const name of ["tls-key.pem", "wrong-host-key.pem"]) { fs.chmodSync(path.join(privateRoot, name), 0o600); } }
}
function install() {
  const args = ["install", "--frozen-lockfile"];
  if (process.env.LLM_CI_LOCAL_HOISTED === "1" && process.env.GITHUB_ACTIONS !== "true") { args.push("--node-linker=hoisted"); }
  must(pnpm(args, "frozen-install"), "Frozen project install"); verifyInputs();
}
function installPackager() {
  const args = ["install", "--frozen-lockfile", "--ignore-scripts"];
  if (process.env.LLM_CI_LOCAL_HOISTED === "1" && process.env.GITHUB_ACTIONS !== "true") { args.push("--node-linker=hoisted"); }
  must(pnpm(args, "frozen-packager-install", { cwd: path.join(project, ".github/packager") }), "Frozen isolated packager install"); verifyInputs();
}
function quality() {
  if (process.versions.node !== config.node) { throw new Error("Quality job must use the project Node pin"); }
  for (const command of ["lint", "typecheck", "compile", "package", "test:headless"]) { must(pnpm(["run", command], command.replace(":", "-"), { env: fixtureEnv() }), command); }
  must(run(process.execPath, ["--test", "scripts/package-validation.test.cjs", "scripts/ci/ci.test.cjs"], "packaging-and-ci-tests"), "Packaging and CI regression tests");
  verifyInputs();
}
function audit(withPackager) {
  const prior = require("../../docs/phase7-evidence.json").audits;
  const jobs = [["project", ["audit", "--json"], prior.project, true], ["production", ["audit", "--prod", "--json"], { advisories: {} }, false]];
  if (withPackager) { jobs.push(["packager", ["--dir", ".github/packager", "--ignore-workspace", "audit", "--json"], prior.isolatedPackager, false]); }
  const outcome = []; let failed = false;
  for (const [name, args, baseline, accepted] of jobs) {
    const result = pnpm(args, "audit-" + name);
    try {
      let report; try { report = JSON.parse(result.stdout); } catch { throw new Error("Audit did not return valid JSON; registry/network infrastructure failure"); } json("audit-" + name + ".json", report);
      const decision = checkAudit(report, baseline, result.status, new Date(), accepted);
      if (!accepted && decision.findings) { throw new Error("Known " + name + " findings have no approved risk acceptance; gate remains blocking"); }
      outcome.push({ name, exit: result.status, gate: "passed", ...decision });
    } catch (error) { failed = true; outcome.push({ name, exit: result.status, gate: "failed", reason: error.message }); }
  }
  json("audit-policy.json", { decisions: outcome, failed, rule: "Only exact project findings within approved review window; no packager waiver, no suppression of raw audit" });
  verifyInputs(); if (failed) { throw new Error("Audit gate failed; see audit-policy.json and raw audits"); }
}
function packageVSIX() {
  if (process.versions.node !== config.packagingNode) { throw new Error("Packaging/ZIP inspection requires pinned Node " + config.packagingNode); }
  const directory = path.join(roots().reports, "package"); fs.mkdirSync(directory, { recursive: true });
  const tool = path.join(project, ".github/packager/node_modules/@vscode/vsce/vsce"), vsix = path.join(directory, config.vsix);
  must(run(process.execPath, ["scripts/package-test-vsix.cjs", tool, vsix], "vsix-build"), "Complete VSIX build");
  must(run(process.execPath, ["scripts/inspect-test-vsix.cjs", tool, vsix, path.join(directory, "inspection.json")], "vsix-inspection"), "VSIX contents inspection");
  verifyInputs();
}
function verifyPackage(directory) {
  const reference = read(path.join(directory, "inspection.json"));
  verifyArchive(path.join(directory, config.vsix), reference);
  json("transferred-package.json", { sha256: reference.sha256, bytes: fs.statSync(path.join(directory, config.vsix)).size, verifiedSameInspectedArtifact: true });
  return reference;
}
function diagnostics() {
  const { privateRoot, reports } = roots();
  for (const label of config.vscode) {
    const source = path.join(privateRoot, "host-" + label, "profile", "logs");
    function copy(directory, relative = "") {
      if (!fs.existsSync(directory)) { return; }
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const from = path.join(directory, entry.name), next = path.join(relative, entry.name);
        if (entry.isDirectory()) { copy(from, next); }
        else if (entry.isFile() && /\.(log|txt)$/.test(entry.name)) { const destination = path.join(reports, "vscode-logs", label, next); fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.copyFileSync(from, destination); }
      }
    }
    copy(source);
  }
  json("diagnostic-scope.json", { archived: "Selected own VS Code logs and command reports only", excluded: ["TLS private keys", "profile databases", "globalStorage", "node_modules", "user environment dump"], recordedAt: new Date().toISOString() });
}
async function main() {
  const [task, arg] = process.argv.slice(2);
  if (task === "prepare") { prepare(); }
  else if (task === "install") { install(); }
  else if (task === "install-packager") { installPackager(); }
  else if (task === "quality") { quality(); }
  else if (task === "audit") { audit(arg === "--packager"); }
  else if (task === "package") { packageVSIX(); }
  else if (task === "verify-package") { verifyPackage(path.resolve(arg)); }
  else if (task === "diagnostics") { diagnostics(); }
  else { throw new Error("Unknown CI task"); }
}
module.exports = { inputs, verifyInputs, verifyPackage, main };
if (require.main === module) { main().catch(error => { console.error(error.message); try { json("failure-" + (process.argv[2] || "unknown") + ".json", { task: process.argv[2], reason: error.message }); } catch {} process.exitCode = 1; }); }
