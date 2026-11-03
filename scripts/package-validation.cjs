"use strict";

const REQUIRED = ["package.json", "README.md", "LICENSE", "CHANGELOG.md", "images/icon.png", "dist/extension.js"];

function validatePaths(files) {
  const allowed = new Set(REQUIRED);
  const seen = new Set();
  for (const file of files) {
    if (file.includes("\\") || file.startsWith("/") || file.split("/").includes("..")) { throw new Error("Unsafe package path"); }
    const key = file.toLowerCase();
    if (seen.has(key)) { throw new Error("Duplicate package path"); }
    seen.add(key);
    if (!allowed.has(file)) { throw new Error(`Unexpected package file: ${file}`); }
  }
  for (const file of allowed) { if (!files.includes(file)) { throw new Error(`Required package file missing: ${file}`); } }
}
function validateManifest(manifest) {
  const provider = manifest.contributes?.configuration?.properties?.["llm-commit.provider"];
  if (JSON.stringify(provider?.enum) !== JSON.stringify(["custom", "lm-studio", "ollama", "openai"]) || provider.default !== "lm-studio") { throw new Error("Unexpected provider manifest"); }
  if (manifest.engines?.vscode !== "^1.80.0") { throw new Error("Unexpected minimum version"); }
  if (manifest.scripts?.["vscode:prepublish"] !== "npm run package" || Object.entries(manifest.scripts || {}).some(([name, value]) => /swift|xcode|fm-cli/i.test(name + " " + value))) { throw new Error("Unexpected native prepublish requirement"); }
}
function validateBundle(source) {
  if (/fm-cli|FoundationModels|generateWithApple|runFMCli|node:child_process/.test(source)) { throw new Error("Removed native integration in bundle"); }
}
module.exports = { REQUIRED, validatePaths, validateManifest, validateBundle };
