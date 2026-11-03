"use strict";
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), cp = require("node:child_process"), crypto = require("node:crypto");
const project = path.resolve(__dirname, "../..");
const config = require("../../.github/ci-config.json");
function roots() {
  if (!process.env.LLM_CI_REPORTS || !process.env.LLM_CI_PRIVATE) { throw new Error("Set isolated LLM_CI_REPORTS and LLM_CI_PRIVATE directories"); }
  const reports = path.resolve(process.env.LLM_CI_REPORTS), privateRoot = path.resolve(process.env.LLM_CI_PRIVATE);
  const contains = (parent, child) => {
    const relative = path.relative(parent, child);
    return !relative || (!path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(".." + path.sep));
  };
  if (contains(reports, privateRoot)) { throw new Error("Private fixtures must be outside archived reports"); }
  if (contains(project, reports) || contains(project, privateRoot)) { throw new Error("CI fixtures and reports must be outside the repository"); }
  fs.mkdirSync(reports, { recursive: true }); fs.mkdirSync(privateRoot, { recursive: true });
  return { reports, privateRoot };
}
function hash(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"); }
function json(name, data) { fs.writeFileSync(path.join(roots().reports, name), JSON.stringify(data, null, 2) + "\n"); }
function run(executable, args, label, options = {}) {
  const { reports } = roots();
  const result = cp.spawnSync(executable, args, { cwd: project, encoding: "utf8", timeout: 300000, maxBuffer: 32 * 1024 * 1024, ...options });
  fs.writeFileSync(path.join(reports, label + ".log"), (result.stdout || "") + (result.stderr || ""));
  json(label + "-result.json", { executable: path.basename(executable), args, status: result.status, signal: result.signal, error: result.error?.code || null, node: process.versions.node, platform: process.platform, arch: process.arch });
  console.log(label + ": exit " + result.status + (result.error ? " (" + result.error.code + ")" : ""));
  return result;
}
function must(result, label) { if (result.error || result.status !== 0) { throw new Error(label + " failed; inspect archived log/result"); } return result; }
function pnpm(args, label, options = {}) {
  const cli = process.env.LLM_CI_PNPM_CLI;
  if (!cli || !fs.existsSync(cli)) { throw new Error("LLM_CI_PNPM_CLI must point to the pinned pnpm JS entry point"); }
  return run(process.execPath, [cli, ...args], label, options);
}
function fixtureEnv() { const { privateRoot } = roots(); return { ...process.env, LLM_COMMIT_TEST_TLS_KEY: path.join(privateRoot, "tls-key.pem"), LLM_COMMIT_TEST_TLS_CERT: path.join(privateRoot, "tls-cert.pem") }; }
function auditFingerprint(advisory) {
  return JSON.stringify({ id: advisory.github_advisory_id, package: advisory.module_name, severity: advisory.severity,
    findings: advisory.findings.map(f => ({ version: f.version, dev: f.dev, optional: f.optional, bundled: f.bundled, paths: [...f.paths].sort() })).sort((a, b) => JSON.stringify(a) < JSON.stringify(b) ? -1 : JSON.stringify(a) > JSON.stringify(b) ? 1 : 0) });
}
function checkAudit(report, baseline, exitCode, now = new Date(), acceptKnown = true) {
  if (!report || !report.advisories || typeof report.advisories !== "object" || Array.isArray(report.advisories) || !report.metadata?.vulnerabilities || ![0, 1].includes(exitCode)) { throw new Error("Invalid audit response or audit infrastructure failure"); }
  const entries = Object.values(report.advisories), known = new Set(Object.values(baseline.advisories).map(auditFingerprint));
  const total = Object.values(report.metadata.vulnerabilities).reduce((a, b) => a + b, 0);
  if (total !== entries.length || (exitCode === 0 && entries.length)) { throw new Error("Inconsistent audit counts/status"); }
  if (entries.some(item => !known.has(auditFingerprint(item)))) { throw new Error("New or changed advisory, severity, version or dependency path; explicit reassessment required"); }
  if (entries.length && !acceptKnown) { throw new Error("Known tool findings have no approved risk acceptance; gate remains blocking"); }
  if (entries.length && now.toISOString().slice(0, 10) >= config.reviewBefore) { throw new Error("Audit risk review expired; explicit reassessment required"); }
  return { findings: entries.length, status: entries.length ? "known findings within existing review window; not audit-clean" : "no findings", reviewBefore: config.reviewBefore };
}
function verifyArchive(vsix, reference) {
  if (!reference || !/^[a-f0-9]{64}$/.test(reference.sha256 || "") || hash(vsix) !== reference.sha256) { throw new Error("VSIX checksum differs from producer inspection"); }
  if (!/^[a-f0-9]{64}$/.test(reference.productionBundleSHA256 || "") || reference.entries?.length !== 8) { throw new Error("Incomplete producer inspection"); }
  return reference;
}
module.exports = { fs, path, os, cp, project, config, roots, hash, json, run, must, pnpm, fixtureEnv, auditFingerprint, checkAudit, verifyArchive };
