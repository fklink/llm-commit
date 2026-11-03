"use strict";
// Validation only: owned loopback proxy, reserved .invalid targets, dummy credentials.
exports.run = async () => {
  const fs = require("node:fs"), http = require("node:http"), assert = require("node:assert/strict");
  const { httpTransport } = require("../out/transport.js");
  let vscode;
  try { vscode = require("vscode"); } catch { /* standalone Node */ }
  const report = { platform: process.platform, node: process.versions.node, vscode: vscode?.version || null, results: [] };
  let proxyHits = 0, connectHits = 0;
  const tlsFixture = process.env.LLM_COMMIT_PROXY_TLS_CERT && process.env.LLM_COMMIT_PROXY_TLS_KEY;
  let tlsServer, tlsPort, trustedTransport;
  if (tlsFixture) {
    const https = require("node:https"), vm = require("node:vm");
    const cert = fs.readFileSync(process.env.LLM_COMMIT_PROXY_TLS_CERT);
    tlsServer = https.createServer({ cert, key: fs.readFileSync(process.env.LLM_COMMIT_PROXY_TLS_KEY) }, (req, res) => { req.resume(); res.end('{"tunnel":true}'); });
    await new Promise(resolve => tlsServer.listen(0, "127.0.0.1", resolve));
    tlsPort = tlsServer.address().port;
    const output = { exports: {} };
    // Laboratory-only CA injection; never changes extension or OS trust stores.
    vm.runInNewContext(fs.readFileSync(require.resolve("../out/transport.js"), "utf8"), { module: output, exports: output.exports, URL, Buffer, require: id => id === "node:https" ? { request: (url, options, callback) => https.request(url, { ...options, ca: cert }, callback) } : require(id) });
    trustedTransport = output.exports.httpTransport;
  }
  const sockets = new Set();
  const proxy = http.createServer((req, res) => {
    proxyHits++;
    // No generic forwarding, external targets or secrets are accepted.
    if (req.url !== "http://phase62.invalid/v1") { res.writeHead(403); res.end(); return; }
    req.resume(); res.end('{"proxy":true}');
  });
  proxy.on("connect", (req, socket, head) => {
    connectHits++;
    if (!tlsFixture || req.url !== `phase62.invalid:${tlsPort}`) { socket.end("HTTP/1.1 502 Test proxy refuses tunneling\r\n\r\n"); return; }
    const upstream = require("node:net").connect(tlsPort, "127.0.0.1", () => { socket.write("HTTP/1.1 200 Connection Established\r\n\r\n"); if (head.length) { upstream.write(head); } socket.pipe(upstream); upstream.pipe(socket); });
    sockets.add(upstream); upstream.on("close", () => sockets.delete(upstream));
    upstream.on("error", () => socket.destroy()); socket.on("error", () => upstream.destroy()); socket.on("close", () => upstream.destroy());
  });
  proxy.on("connection", socket => { sockets.add(socket); socket.on("close", () => sockets.delete(socket)); });
  await new Promise(resolve => proxy.listen(0, "127.0.0.1", resolve));
  const proxyUrl = `http://127.0.0.1:${proxy.address().port}`;
  const names = ["HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy", "NO_PROXY", "no_proxy"];
  const before = Object.fromEntries(names.map(name => [name, process.env[name]]));
  const config = vscode?.workspace.getConfiguration("http");
  const previous = config ? Object.fromEntries(["proxy", "proxySupport", "proxyStrictSSL"].map(key => [key, config.inspect(key)?.globalValue])) : {};
  async function attempt(label, url, transport = httpTransport) {
    const start = { http: proxyHits, connect: connectHits };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    let completed = false;
    try { const response = await transport(url, { method: "POST", redirect: "error", headers: {}, body: "dummy", signal: controller.signal }); await response.json(); completed = true; }
    catch (error) { assert.equal(error.message, "The HTTP transport could not complete the request."); }
    finally { clearTimeout(timer); }
    report.results.push({ label, completed, httpProxyHits: proxyHits - start.http, connectProxyHits: connectHits - start.connect });
  }
  try {
    for (const name of names) { delete process.env[name]; }
    if (config) { await config.update("proxy", "", true); await config.update("proxySupport", "off", true); }
    await attempt("reserved-host-direct-control", "http://phase62.invalid/v1");
    for (const name of names.filter(name => !name.toLowerCase().startsWith("no_"))) { process.env[name] = proxyUrl; }
    process.env.NO_PROXY = ""; process.env.no_proxy = "";
    await attempt("environment-http-proxy", "http://phase62.invalid/v1");
    await attempt("environment-https-proxy", "https://phase62.invalid/v1");
    if (config) {
      await config.update("proxy", proxyUrl, true); await config.update("proxySupport", "override", true); await config.update("proxyStrictSSL", true, true);
      await attempt("vscode-http-proxy", "http://phase62.invalid/v1");
      await attempt("vscode-https-proxy", "https://phase62.invalid/v1");
      if (tlsFixture) {
        await attempt("vscode-https-tunnel-test-ca", `https://phase62.invalid:${tlsPort}/v1`, trustedTransport);
        assert.equal(report.results[report.results.length - 1].completed, true);
        await attempt("vscode-https-tunnel-untrusted-ca", `https://phase62.invalid:${tlsPort}/v1`);
        assert.equal(report.results[report.results.length - 1].completed, false);
      }
    }
    // An owned local HTTP server proves that the transport itself is working.
    const origin = http.createServer((req, res) => { req.resume(); res.end('{"local":true}'); });
    await new Promise(resolve => origin.listen(0, "127.0.0.1", resolve));
    const url = `http://127.0.0.1:${origin.address().port}/v1`;
    try { await attempt("local-provider-control", url); assert.equal(report.results[report.results.length - 1].completed, true); }
    finally { await new Promise(resolve => origin.close(resolve)); }
    await attempt("closed-owned-port", url);
    assert.equal(report.results[report.results.length - 1].completed, false);
  } finally {
    for (const name of names) { if (before[name] === undefined) { delete process.env[name]; } else { process.env[name] = before[name]; } }
    if (config) { for (const [key, value] of Object.entries(previous)) { await config.update(key, value, true); } }
    for (const socket of sockets) { socket.destroy(); }
    await new Promise(resolve => proxy.close(resolve)); if (tlsServer) { await new Promise(resolve => tlsServer.close(resolve)); }
    if (process.env.LLM_COMMIT_PROXY_REPORT) { fs.writeFileSync(process.env.LLM_COMMIT_PROXY_REPORT, JSON.stringify(report, null, 2) + "\n"); }
    console.log("PROXY_PROBE " + JSON.stringify(report));
  }
};
if (require.main === module) { exports.run().catch(() => { console.error("Proxy validation failed; inspect controlled test setup."); process.exitCode = 1; }); }
