"use strict";
// Legacy script filename retained; now packages the complete four-provider extension.
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { validatePaths, validateManifest, validateBundle } = require("./package-validation.cjs");
async function main() {
  const [cliArgument, outputArgument] = process.argv.slice(2);
  if (!cliArgument || !outputArgument) { throw new Error("Usage: node scripts/package-test-vsix.cjs <vsce-3.9.2-cli> <output.vsix>"); }
  const cli = fs.realpathSync(path.resolve(cliArgument));
  const toolRoot = path.dirname(cli);
  if (JSON.parse(fs.readFileSync(path.join(toolRoot, "package.json"), "utf8")).version !== "3.9.2") { throw new Error("Use the validated isolated @vscode/vsce 3.9.2 tool"); }
  const project = path.resolve(__dirname, "..");
  const manifest = JSON.parse(fs.readFileSync(path.join(project, "package.json"), "utf8"));
  validateManifest(manifest);
  const vsce = require(toolRoot);
  validatePaths(await vsce.listFiles({ cwd: project, packageManager: vsce.PackageManager.None }));
  const output = path.resolve(outputArgument);
  // Run the actual manifest prepublish, without stage-only edits or skipping hooks.
  const result = spawnSync(process.execPath, [cli, "package", "--no-dependencies", "--out", output], { cwd: project, stdio: "inherit" });
  if (result.error) { throw result.error; }
  if (result.status !== 0) { throw new Error("VSCE packaging failed"); }
  validateBundle(fs.readFileSync(path.join(project, manifest.main), "utf8"));
  fs.writeFileSync(output + ".provenance.json", JSON.stringify({ kind: "complete HTTP-provider VSIX; publication not authorized", vsce: "3.9.2", nativeProviderIntegration: false, prepublish: manifest.scripts["vscode:prepublish"], manifestUnchanged: true, output }, null, 2) + "\n");
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
