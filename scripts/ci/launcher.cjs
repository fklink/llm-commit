"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { resolveCliPathFromVSCodeExecutablePath } = require("@vscode/test-electron");

function readBundleExecutable(plist) {
  const result = spawnSync("/usr/bin/plutil", ["-extract", "CFBundleExecutable", "raw", "-o", "-", plist], {
    encoding: "utf8", timeout: 5000
  });
  if (result.error || result.status !== 0) {
    throw new Error("Cannot read CFBundleExecutable from VS Code Info.plist");
  }
  return result.stdout.trim();
}

function requireExecutable(file, label) {
  try {
    if (!fs.statSync(file).isFile()) { throw new Error("not a regular file"); }
    fs.accessSync(file, fs.constants.X_OK);
  } catch (error) {
    throw new Error(label + " is not executable: " + (error.code || "not a regular file"));
  }
}

function resolveUnixLauncher(downloadedRuntime, platform, bundleExecutable = readBundleExecutable) {
  let runtime = downloadedRuntime;
  if (platform === "darwin") {
    const executableDirectory = path.dirname(downloadedRuntime);
    const name = bundleExecutable(path.resolve(executableDirectory, "../Info.plist"));
    if (!/^[\w .-]+$/.test(name) || name === "." || name === "..") {
      throw new Error("VS Code Info.plist has an invalid bundle executable");
    }
    runtime = path.join(executableDirectory, name);
  }
  const launcher = resolveCliPathFromVSCodeExecutablePath(runtime, platform === "darwin" ? "darwin" : "linux-x64");
  requireExecutable(runtime, "VS Code runtime");
  requireExecutable(launcher, "VS Code CLI launcher");
  return { runtime, launcher };
}

function safeOutput(output) {
  const text = output || "";
  return {
    hadOutput: text.trim().length > 0,
    version: text.split(/\r?\n/).find(line => /^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(line)) || null,
    installed: /\binstalled successfully\b/i.test(text),
    categories: [
      ["not found", /not found|no such file/i],
      ["permission", /permission denied|access denied/i],
      ["display", /cannot open display|missing x server/i],
      ["library", /error while loading shared libraries/i],
      ["incompatible", /not compatible|incompatible/i]
    ].filter(([, pattern]) => pattern.test(text)).map(([category]) => category)
  };
}

function invokeInstaller(command, args, env) {
  const result = spawnSync(command, args, {
    encoding: "utf8", env, timeout: 120000, maxBuffer: 1024 * 1024, shell: false
  });
  return {
    status: result.status, signal: result.signal, error: result.error?.code || null,
    stdout: safeOutput(result.stdout), stderr: safeOutput(result.stderr)
  };
}

module.exports = { resolveUnixLauncher, invokeInstaller };
