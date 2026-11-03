import { getEventListeners } from "node:events";
import * as assert from "node:assert/strict";
import { createServer, Server, RequestListener } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import type { Socket, AddressInfo } from "node:net";
import { readFileSync } from "node:fs";
import { gzipSync, deflateSync, brotliCompressSync } from "node:zlib";
import { httpTransport, HttpRequest } from "../transport";
import { ApiSecurity, createTarget, credentialId } from "../security";
const payload = JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: "fix: native HTTP 🦊" } }] });
function options(signal?: AbortSignal): HttpRequest { return { method: "POST", redirect: "error", headers: { "Content-Type": "application/json", Authorization: "Bearer dummy-transport-key" }, body: "+dummy $& 🦊\nline", signal }; }
async function local(handler: RequestListener, tls = false) {
  const server: Server = tls ? createHttpsServer({ key: readFileSync(process.env.LLM_COMMIT_TEST_TLS_KEY!), cert: readFileSync(process.env.LLM_COMMIT_TEST_TLS_CERT!) }, handler) : createServer(handler);
  const sockets = new Set<Socket>(); server.on("connection", socket => { sockets.add(socket); socket.on("close", () => sockets.delete(socket)); });
  await new Promise<void>(yes => server.listen(0, "127.0.0.1", yes));
  return { server, url: `${tls ? "https" : "http"}://127.0.0.1:${(server.address() as AddressInfo).port}/v1`, close: async () => { for (const socket of sockets) { socket.destroy(); } await new Promise<void>(yes => server.close(() => yes())); } };
}
suite("Phase 6.1 native HTTP transport", function () {
  this.timeout(10000);
  test("literal UTF-8 POST, authorization and response work without Fetch globals", async () => {
    let body = ""; const s = await local((req, res) => { assert.equal(req.headers.authorization, "Bearer dummy-transport-key"); assert.equal(req.method, "POST"); req.setEncoding("utf8"); req.on("data", chunk => body += chunk); req.on("end", () => res.end(payload)); });
    try { const r = await httpTransport(s.url, options()); assert.equal(r.status, 200); assert.deepEqual(await r.json(), JSON.parse(payload)); assert.equal(body, options().body); } finally { await s.close(); }
  });
  for (const [encoding, compress] of [["gzip", gzipSync], ["deflate", deflateSync], ["br", brotliCompressSync]] as const) {
    test(`decodes ${encoding} JSON`, async () => { const s = await local((_req, res) => { res.setHeader("Content-Encoding", encoding); res.end(compress(Buffer.from(payload))); }); try { assert.deepEqual(await (await httpTransport(s.url, options())).json(), JSON.parse(payload)); } finally { await s.close(); } });
  }
  test("BOM-prefixed JSON remains compatible", async () => { const s = await local((_req, res) => res.end("\uFEFF" + payload)); try { assert.deepEqual(await (await httpTransport(s.url, options())).json(), JSON.parse(payload)); } finally { await s.close(); } });
  test("pre-aborted requests send nothing", async () => { let hits = 0; const s = await local((_req, res) => { hits++; res.end(payload); }); try { const c = new AbortController(); c.abort(); await assert.rejects(httpTransport(s.url, options(c.signal))); assert.equal(hits, 0); } finally { await s.close(); } });
  test("abort before headers closes the native request", async () => { let received!: () => void; const ready = new Promise<void>(yes => received = yes); let disconnected!: () => void; const closed = new Promise<void>(yes => disconnected = yes); const s = await local((req, _res) => { req.socket.on("close", disconnected); received(); }); try { const c = new AbortController(); const task = httpTransport(s.url, options(c.signal)); const rejected = assert.rejects(task); await ready; c.abort(); await rejected; await closed; } finally { await s.close(); } });
  test("abort during a delayed body closes the stream and rejects JSON", async () => { const s = await local((_req, res) => { res.writeHead(200); res.write('{"choices":['); }); try { const c = new AbortController(); const r = await httpTransport(s.url, options(c.signal)); const task = assert.rejects(r.json()); c.abort(); await task; } finally { await s.close(); } });
  test("slow body within the deadline succeeds", async () => { const s = await local((_req, res) => { res.writeHead(200); res.write(payload.slice(0, 5)); setTimeout(() => res.end(payload.slice(5)), 25); }); try { assert.deepEqual(await (await httpTransport(s.url, options())).json(), JSON.parse(payload)); } finally { await s.close(); } });
  test("caller timeout destroys a stalled body", async () => { const s = await local((_req, res) => { res.writeHead(200); res.write("{"); }); const c = new AbortController(); const timer = setTimeout(() => c.abort(), 40); try { await assert.rejects((async () => (await httpTransport(s.url, options(c.signal))).json())()); } finally { clearTimeout(timer); await s.close(); } });
  test("body cancel is safe before JSON is read", async () => { const s = await local((_req, res) => { res.writeHead(200); res.write("{"); }); try { const r = await httpTransport(s.url, options()); await r.body?.cancel(); await assert.rejects(r.json()); } finally { await s.close(); } });
  test("parallel requests abort independently", async () => { let hits = 0; const s = await local((_req, res) => { if (++hits === 1) { res.writeHead(200); res.write("{"); } else { res.end(payload); } }); try { const c = new AbortController(); const first = await httpTransport(s.url, options(c.signal)); const second = httpTransport(s.url, options()); c.abort(); await assert.rejects(first.json()); assert.deepEqual(await (await second).json(), JSON.parse(payload)); } finally { await s.close(); } });
  test("redirect never sends credentials/body to its destination", async () => { let forwarded = 0; const target = await local((_req, res) => { forwarded++; res.end(payload); }); const s = await local((_req, res) => { res.writeHead(307, { Location: target.url }); res.end("dummy-sensitive-error"); }); try { const r = await httpTransport(s.url, options()); assert.equal(r.status, 307); assert.equal(forwarded, 0); } finally { await s.close(); await target.close(); } });
  test("security boundary still rejects native redirects", async () => { const s = await local((_req, res) => { res.writeHead(302, { Location: "https://dummy.invalid" }); res.end(); }); try { const target = createTarget("custom", s.url, { id: "dummy", label: "dummy", persistent: false }); const security = new ApiSecurity({ readTarget: () => target, isTrusted: () => true, secrets: { get: async () => undefined, store: async () => undefined, delete: async () => undefined }, approvals: { get: () => undefined, update: async () => undefined }, confirm: async () => true, inputKey: async () => undefined, chooseMigration: async () => undefined, readLegacy: () => undefined, reviewLegacy: async () => undefined, warn() {}, transport: httpTransport }); await assert.rejects(security.request("dummy"), /redirect/); } finally { await s.close(); } });
  for (const [name, content] of [["invalid JSON", "dummy-sensitive-not-json"], ["empty body", ""]]) { test(`rejects ${name} without disclosing raw data`, async () => { const s = await local((_req, res) => res.end(content)); try { await assert.rejects((await httpTransport(s.url, options())).json(), error => !String(error).includes("dummy-sensitive")); } finally { await s.close(); } }); }
  test("error status is exposed without reading raw error text", async () => { const s = await local((_req, res) => { res.writeHead(500); res.end("dummy-sensitive-error"); }); try { const r = await httpTransport(s.url, options()); assert.equal(r.ok, false); assert.equal(r.status, 500); await r.body?.cancel(); } finally { await s.close(); } });
  test("truncated response body rejects instead of hanging", async () => { const s = await local((_req, res) => { res.writeHead(200, { "Content-Length": 10000 }); res.write("{"); setTimeout(() => res.destroy(), 10); }); try { await assert.rejects((async () => (await httpTransport(s.url, options())).json())()); } finally { await s.close(); } });
  test("untrusted HTTPS certificate remains rejected", async function () { if (!process.env.LLM_COMMIT_TEST_TLS_KEY) { this.skip(); return; } const s = await local((_req, res) => res.end(payload), true); try { await assert.rejects(httpTransport(s.url, options())); } finally { await s.close(); } });
  test("completed JSON releases its abort listener", async () => { const s = await local((_req, res) => res.end(payload)); const c = new AbortController(); try { await (await httpTransport(s.url, options(c.signal))).json(); assert.equal(getEventListeners(c.signal, "abort").length, 0); } finally { await s.close(); } });
  test("malformed compression rejects without raw disclosure", async () => { const s = await local((_req, res) => { res.setHeader("Content-Encoding", "gzip"); res.end("dummy-sensitive-not-gzip"); }); try { await assert.rejects((await httpTransport(s.url, options())).json(), error => !String(error).includes("dummy-sensitive")); } finally { await s.close(); } });
  test("unsupported protocol cannot dispatch", async () => { await assert.rejects(httpTransport("file:///dummy", options())); });
  test("native transmission preserves key origin binding", async () => {
    let got: string | undefined; let otherGot: string | undefined;
    const s = await local((req, res) => { got = req.headers.authorization; res.end(payload); });
    const other = await local((req, res) => { otherGot = req.headers.authorization; res.end(payload); });
    try {
      let target = createTarget("custom", s.url, { id: "dummy", label: "dummy", persistent: false });
      const original = target;
      const stored = JSON.stringify({ version: 1, provider: "custom", origin: target.origin, key: "dummy-bound-key" });
      const manager = new ApiSecurity({ readTarget: () => target, isTrusted: () => true, secrets: { get: async id => id === credentialId(original) ? stored : undefined, store: async () => undefined, delete: async () => undefined }, approvals: { get: () => undefined, update: async () => undefined }, confirm: async () => true, inputKey: async () => undefined, chooseMigration: async () => undefined, readLegacy: () => undefined, reviewLegacy: async () => undefined, warn() {}, transport: httpTransport });
      await (await manager.request("dummy")).json(); assert.equal(got, "Bearer dummy-bound-key");
      target = createTarget("custom", other.url, target.execution);
      await (await manager.request("dummy")).json(); assert.equal(otherGot, undefined);
    } finally { await s.close(); await other.close(); }
  });
});
