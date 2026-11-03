"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");
const { validatePaths, validateManifest, validateBundle } = require("./package-validation.cjs");
async function main() {
  if (Number(process.versions.node.split(".")[0]) >= 26) { throw new Error("VSCE ZIP inspection is validated on Node 24; Node 26 remains outside the validated packaging path. Use the documented Node 24 inspection command."); }
  const [toolArgument, archiveArgument, reportArgument] = process.argv.slice(2);
  if (!toolArgument || !archiveArgument || !reportArgument) { throw new Error("Usage: node scripts/inspect-test-vsix.cjs <vsce-cli> <test.vsix> <report.json>"); }
  const tool = fs.realpathSync(path.resolve(toolArgument));
  const requireTool = createRequire(path.join(path.dirname(tool), "package.json"));
  const yauzl = requireTool("yauzl");
  const archive = path.resolve(archiveArgument);
  const entries = [];
  const contents = new Map();
  let total = 0;
  await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error("ZIP inspection timed out")), 10000); yauzl.open(archive, { lazyEntries: true }, (error, zip) => {
    if (error) { reject(error); return; }
    zip.on("error", reject);
    zip.on("end", () => { clearTimeout(timer); resolve(); });
    zip.on("entry", entry => {
      if (entry.fileName.endsWith("/")) { zip.readEntry(); return; }
      total += entry.uncompressedSize;
      if (total > 20 * 1024 * 1024 || entry.uncompressedSize > 5 * 1024 * 1024 || (entry.generalPurposeBitFlag & 1)) { zip.close(); reject(new Error("Unexpected encrypted/oversized test package")); return; }
      entries.push({ path: entry.fileName, bytes: entry.uncompressedSize, mode: (entry.externalFileAttributes >>> 16).toString(8) });
      zip.openReadStream(entry, (streamError, stream) => {
        if (streamError) { reject(streamError); return; }
        const chunks = [];
        stream.on("data", chunk => chunks.push(chunk));
        stream.on("error", reject);
        stream.on("end", () => { contents.set(entry.fileName, Buffer.concat(chunks)); zip.readEntry(); });
      });
    });
    zip.readEntry();
  }); });
  const metadata = ["[Content_Types].xml", "extension.vsixmanifest"];
  assert.equal(entries.filter(entry => metadata.includes(entry.path)).length, 2);
  const logical = entries.filter(entry => !metadata.includes(entry.path)).map(entry => {
    if (!entry.path.startsWith("extension/")) { throw new Error("Unexpected archive root"); }
    return entry.path.slice(10).replace(/^LICENSE\.txt$/, "LICENSE").replace(/^readme\.md$/, "README.md").replace(/^changelog\.md$/, "CHANGELOG.md");
  });
  validatePaths(logical);
  const manifest = JSON.parse(contents.get("extension/package.json").toString("utf8"));
  assert.equal(manifest.name, "llm-commit");
  assert.equal(manifest.publisher, "evertjunior");
  assert.equal(manifest.main, "./dist/extension.js");
  assert.equal(manifest.engines.vscode, "^1.80.0");
  const project = path.resolve(__dirname, "..");
  const expectedManifest = JSON.parse(fs.readFileSync(path.join(project, "package.json"), "utf8"));
  assert.deepEqual(manifest, expectedManifest);
  validateManifest(manifest);
  validateBundle(contents.get("extension/dist/extension.js").toString("utf8"));
  const bundleHash = crypto.createHash("sha256").update(contents.get("extension/dist/extension.js")).digest("hex");
  assert.equal(bundleHash, crypto.createHash("sha256").update(fs.readFileSync(path.join(project, "dist/extension.js"))).digest("hex"));
  for (const [name, data] of contents) {
    if (name.endsWith(".png")) { continue; }
    if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|AKIA[0-9A-Z]{16}|sk-(?:proj-)?[A-Za-z0-9_-]{32,}/.test(data.toString("utf8"))) { throw new Error("Potential embedded credential in " + name); }
  }
  const report = { productionBundleSHA256: bundleHash, kind: "complete HTTP-provider VSIX; publication not authorized", bytes: fs.statSync(archive).size, uncompressedBytes: total, sha256: crypto.createHash("sha256").update(fs.readFileSync(archive)).digest("hex"), entries, nativeProviderIntegration: false, developerArtifacts: false, credentialPatternScan: "no matches; not a proof that arbitrary secrets cannot exist", vscodeMinimum: manifest.engines.vscode };
  fs.writeFileSync(path.resolve(reportArgument), JSON.stringify(report, null, 2) + "\n");
  console.log(`Complete HTTP VSIX validated: ${entries.length} files, ${report.bytes} bytes; no native provider integration; not published.`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
