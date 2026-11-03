"use strict";
const fs = require("node:fs"), path = require("node:path"), cp = require("node:child_process");
const config = require("../../.github/ci-config.json");
function npmCLI(executable = process.execPath) {
  const base = path.dirname(executable);
  return [path.join(base, "node_modules/npm/bin/npm-cli.js"), path.resolve(base, "../lib/node_modules/npm/bin/npm-cli.js")].find(file => fs.existsSync(file));
}
function main() {
  if (process.env.GITHUB_ACTIONS !== "true") { throw new Error("Global CI bootstrap is restricted to GitHub Actions; use existing local pnpm via LLM_CI_PNPM_CLI"); }
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0") { throw new Error("TLS verification must remain enabled in CI bootstrap"); }
  if (process.versions.node !== config.node) { throw new Error("Unexpected bootstrap Node version"); }
  if (!process.env.RUNNER_TEMP) { throw new Error("RUNNER_TEMP missing"); }
  fs.appendFileSync(process.env.GITHUB_ENV, "LLM_CI_REPORTS=" + path.join(process.env.RUNNER_TEMP, "llm-commit-ci-reports") + "\nLLM_CI_PRIVATE=" + path.join(process.env.RUNNER_TEMP, "llm-commit-ci-private") + "\n");
  const cli = npmCLI(); if (!cli) { throw new Error("setup-node npm CLI not found"); }
  cp.execFileSync(process.execPath, [cli, "install", "--global", "--ignore-scripts", "--no-audit", "--no-fund", "pnpm@" + config.pnpm], { stdio: "inherit", timeout: 180000 });
  const prefix = cp.execFileSync(process.execPath, [cli, "prefix", "--global"], { encoding: "utf8" }).trim();
  fs.appendFileSync(process.env.GITHUB_PATH, (process.platform === "win32" ? prefix : path.join(prefix, "bin")) + "\n");
  const globalRoot = cp.execFileSync(process.execPath, [cli, "root", "--global"], { encoding: "utf8" }).trim();
  const packageRoot = path.join(globalRoot, "pnpm");
  const manifest = JSON.parse(fs.readFileSync(path.join(packageRoot, "package.json"), "utf8"));
  if (manifest.version !== config.pnpm) { throw new Error("Unexpected globally installed pnpm version"); }
  const pnpm = path.resolve(packageRoot, typeof manifest.bin === "string" ? manifest.bin : manifest.bin.pnpm);
  if (!fs.existsSync(pnpm)) { throw new Error("Pinned pnpm CLI missing"); }
  if (!process.env.RUNNER_TEMP) { throw new Error("RUNNER_TEMP missing"); }
  fs.appendFileSync(process.env.GITHUB_ENV, "LLM_CI_PNPM_CLI=" + pnpm + "\nLLM_CI_REPORTS=" + path.join(process.env.RUNNER_TEMP, "llm-commit-ci-reports") + "\nLLM_CI_PRIVATE=" + path.join(process.env.RUNNER_TEMP, "llm-commit-ci-private") + "\n");
}
module.exports = { npmCLI, main };
if (require.main === module) { try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; } }
