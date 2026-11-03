"use strict";
exports.run = async () => {
  await require("../installed-platform-suite.cjs").run();
  const fs = require("node:fs"), path = require("node:path");
  const names = ["LLM_COMMIT_TEST_TLS_KEY", "LLM_COMMIT_TEST_TLS_CERT", "LLM_COMMIT_TEST_TLS_ABORT", "LLM_COMMIT_TEST_TLS_REJECT"];
  const previous = Object.fromEntries(names.map(name => [name, process.env[name]])), results = [];
  try {
    for (const mode of ["trusted", "hostname-reject", "body-abort"]) {
      const prefix = mode === "hostname-reject" ? "wrong-host" : "tls";
      process.env.LLM_COMMIT_TEST_TLS_KEY = path.join(process.env.LLM_CI_PRIVATE, prefix + "-key.pem");
      process.env.LLM_COMMIT_TEST_TLS_CERT = path.join(process.env.LLM_CI_PRIVATE, prefix + "-cert.pem");
      process.env.LLM_COMMIT_TEST_TLS_ABORT = mode === "body-abort" ? "1" : "0";
      process.env.LLM_COMMIT_TEST_TLS_REJECT = mode === "hostname-reject" ? "1" : "0";
      try { await require("../tls-transport-probe.cjs").run(); results.push({ mode, status: "passed" }); }
      catch { results.push({ mode, status: "failed" }); throw new Error("Installed-host TLS probe failed: " + mode); }
    }
  } finally {
    for (const name of names) { if (previous[name] === undefined) { delete process.env[name]; } else { process.env[name] = previous[name]; } }
    fs.writeFileSync(process.env.LLM_CI_HOST_TLS_REPORT, JSON.stringify({ node: process.versions.node, platform: process.platform, results, trust: "explicit private test CA, real TLS and hostname verification; not an enterprise trust-store proof" }, null, 2) + "\n");
  }
};
