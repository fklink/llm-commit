import { request as requestHttp, IncomingMessage } from "node:http";
import { request as requestHttps } from "node:https";
import { Transform } from "node:stream";
import { createGunzip, createInflate, createBrotliDecompress } from "node:zlib";

/** Only the JSON POST contract consumed by the security boundary; no Fetch globals. */
export interface HttpRequest {
  method: "POST";
  headers: Record<string, string>;
  body: string;
  redirect: "error";
  signal?: AbortSignal;
}
export interface HttpResponse {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
  readonly body?: { cancel(): Promise<void> } | null;
}
const transportError = () => new Error("The HTTP transport could not complete the request.");

/** Native Node 16+ transport. It never follows redirects or relaxes TLS verification. */
export async function httpTransport(value: string, options: HttpRequest): Promise<HttpResponse> {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || options.method !== "POST" || options.redirect !== "error") { throw transportError(); }
    if (options.signal?.aborted) { throw transportError(); }
    return await new Promise<HttpResponse>((resolve, reject) => {
      let incoming: IncomingMessage | undefined;
      let decoded: Transform | undefined;
      let failure: Error | undefined;
      const cleanup = () => options.signal?.removeEventListener("abort", abort);
      const request = (url.protocol === "https:" ? requestHttps : requestHttp)(url, {
        method: "POST", headers: { ...options.headers, "Content-Length": Buffer.byteLength(options.body, "utf8") },
        agent: false, ...(url.protocol === "https:" ? { rejectUnauthorized: true } : {}),
      }, response => {
        incoming = response;
        response.on("error", () => { failure = transportError(); decoded?.destroy(failure); });
        response.once("aborted", () => { failure = transportError(); decoded?.destroy(failure); });
        response.once("close", cleanup);
        const status = response.statusCode || 0;
        let reading: Promise<unknown> | undefined;
        const cancel = async () => { failure = transportError(); request.destroy(); response.destroy(); decoded?.destroy(failure); cleanup(); };
        resolve({
          ok: status >= 200 && status < 300, status, body: { cancel },
          json: () => reading ??= (async () => {
            try {
              if (failure || options.signal?.aborted || (response.destroyed && !response.complete)) { throw transportError(); }
              const encoding = String(response.headers["content-encoding"] || "identity").trim().toLowerCase();
              if (encoding === "gzip") { decoded = createGunzip(); }
              else if (encoding === "deflate") { decoded = createInflate(); }
              else if (encoding === "br") { decoded = createBrotliDecompress(); }
              else if (encoding !== "identity") { throw transportError(); }
              const source = decoded || response;
              if (decoded) { response.pipe(decoded); }
              const chunks: Buffer[] = [];
              for await (const chunk of source) { if (options.signal?.aborted) { throw transportError(); } chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)); }
              if (failure || options.signal?.aborted || !response.complete) { throw transportError(); }
              return JSON.parse(Buffer.concat(chunks).toString("utf8").replace(/^\uFEFF/, "")) as unknown;
            } catch { await cancel(); throw transportError(); }
            finally { cleanup(); }
          })(),
        });
        // Node does not redirect automatically. Close an unread redirect body immediately.
        if (status >= 300 && status < 400) { response.destroy(); cleanup(); }
      });
      const abort = () => { failure = transportError(); request.destroy(failure); incoming?.destroy(failure); decoded?.destroy(failure); cleanup(); };
      request.on("error", () => { failure = transportError(); incoming?.destroy(failure); decoded?.destroy(failure); cleanup(); reject(failure); });
      request.once("close", () => { if (!incoming) { cleanup(); } });
      options.signal?.addEventListener("abort", abort, { once: true });
      if (options.signal?.aborted) { abort(); return; }
      request.end(options.body, "utf8");
    });
  } catch { throw transportError(); }
}
