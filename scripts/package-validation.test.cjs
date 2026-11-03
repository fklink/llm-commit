"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { REQUIRED, validatePaths } = require("./package-validation.cjs");
test("accepts the exact bundled runtime resources", () => validatePaths(REQUIRED));
test("rejects the obsolete incomplete test-package marker", () => assert.throws(() => validatePaths([...REQUIRED, "PHASE6-TEST-PACKAGE.txt"])));
for (const file of ["out/test/security.test.js", "pnpm-lock.yaml", "node_modules/mocha/index.js", ".env", "private.key", "../escape.js"]) {
  test(`rejects development, secret or unsafe artifact ${file}`, () => assert.throws(() => validatePaths([...REQUIRED, file])));
}
test("rejects duplicate archive paths independent of case", () => assert.throws(() => validatePaths([...REQUIRED, "README.MD"])));
test("rejects a missing production entry point", () => assert.throws(() => validatePaths(REQUIRED.filter(file => file !== "dist/extension.js"))));

test("complete package manifest exposes only supported HTTP providers", () => {
  const { validateManifest } = require("./package-validation.cjs");
  validateManifest(require("../package.json"));
});
test("rejects a manifest that reintroduces the removed provider", () => {
  const { validateManifest } = require("./package-validation.cjs");
  const manifest = JSON.parse(JSON.stringify(require("../package.json")));
  manifest.contributes.configuration.properties["llm-commit.provider"].enum.push("apple");
  assert.throws(() => validateManifest(manifest), /provider/i);
});
test("rejects native prepublish requirements", () => {
  const { validateManifest } = require("./package-validation.cjs");
  const manifest = JSON.parse(JSON.stringify(require("../package.json")));
  manifest.scripts["vscode:prepublish"] = "swift build";
  assert.throws(() => validateManifest(manifest), /prepublish/i);
});
test("HTTP bundle may explain removed settings but cannot launch a native provider", () => {
  const { validateBundle } = require("./package-validation.cjs");
  validateBundle('throw new Error("Apple Foundation Models is no longer supported")');
  for (const source of ['require("node:child_process")', 'join(root, "bin", "fm-cli")', 'FoundationModels', 'generateWithApple']) {
    assert.throws(() => validateBundle(source), /native integration/i);
  }
});
for (const file of ["bin/fm-cli", "swift/fm-cli/Package.swift", "AGENTS.md"]) {
  test(`rejects removed native or development resource ${file}`, () => assert.throws(() => validatePaths([...REQUIRED, file])));
}
