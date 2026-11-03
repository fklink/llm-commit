"use strict";
exports.run = async () => {
  const fs = require("node:fs"), https = require("node:https"), path = require("node:path"), assert = require("node:assert/strict");
  const vm = require("node:vm");
  const compiled = path.resolve(__dirname, "../out/transport.js");
  const output = { exports: {} };
  // Test-only explicit trust anchor; real TLS and hostname verification remain enabled.
  vm.runInNewContext(fs.readFileSync(compiled, "utf8"), { exports: output.exports, module: output, URL, Buffer, require: id => id === "node:https" ? { request: (url, options, callback) => https.request(url, { ...options, ca: fs.readFileSync(process.env.LLM_COMMIT_TEST_TLS_CERT) }, callback) } : require(id) });
  const { httpTransport } = output.exports;
  let hits = 0;
  const sockets = new Set();
  const server = https.createServer({ key: fs.readFileSync(process.env.LLM_COMMIT_TEST_TLS_KEY), cert: fs.readFileSync(process.env.LLM_COMMIT_TEST_TLS_CERT) }, (req, res) => { hits++; assert.equal(req.headers.authorization, "Bearer dummy-tls-key"); req.resume(); if (process.env.LLM_COMMIT_TEST_TLS_ABORT === "1") { res.writeHead(200); res.write('{"dummy":'); } else { res.end('{"dummy":true}'); } });
  server.on("connection", socket => { sockets.add(socket); socket.on("close", () => sockets.delete(socket)); });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const controller = new AbortController();
    const request = httpTransport(`https://127.0.0.1:${server.address().port}/v1`, { method: "POST", redirect: "error", headers: { Authorization: "Bearer dummy-tls-key" }, body: "dummy", signal: controller.signal });
    if (process.env.LLM_COMMIT_TEST_TLS_REJECT === "1") { await assert.rejects(request); assert.equal(hits, 0); }
    else if (process.env.LLM_COMMIT_TEST_TLS_ABORT === "1") { const response = await request; const rejected = assert.rejects(response.json()); controller.abort(); await rejected; assert.equal(hits, 1); }
    else { assert.equal((await (await request).json()).dummy, true); assert.equal(hits, 1); }
    console.log("TLS_PROBE passed Node " + process.versions.node + "; expected rejection=" + (process.env.LLM_COMMIT_TEST_TLS_REJECT === "1") + "; body abort=" + (process.env.LLM_COMMIT_TEST_TLS_ABORT === "1"));
  } finally { for (const socket of sockets) { socket.destroy(); } await new Promise(resolve => server.close(resolve)); }
};
if (require.main === module) { exports.run().catch(error => { console.error(error); process.exitCode = 1; }); }
