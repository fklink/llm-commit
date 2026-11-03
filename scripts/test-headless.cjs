"use strict";

const { readdirSync } = require("node:fs");
const { join } = require("node:path");
const Mocha = require("mocha");

// Use the public API rather than depending on a transitive CLI entry point.
const runner = new Mocha({ ui: "tdd", timeout: 15000, forbidOnly: true });
const testDirectory = join(__dirname, "..", "out", "test");
const files = readdirSync(testDirectory).filter(file => file.endsWith(".test.js") && file !== "extension.test.js").sort();
if (files.length === 0) { throw new Error("No compiled regression tests found. Run pnpm run compile-tests."); }
for (const file of files) { runner.addFile(join(testDirectory, file)); }
runner.run(failures => { process.exitCode = failures ? 1 : 0; });
