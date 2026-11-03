import { runInNewContext as runVm } from "node:vm";
/** Keep existing command fixtures isolated: their old fetch stubs now inject the transport. */
export function runInNewContext(source: string, context: Record<string, unknown>): void {
  const load = context.require as (id: string) => unknown;
  context.require = (id: string) => id === "./transport" ? { httpTransport: context.fetch } : load(id);
  runVm(source, context);
}
/** Test data only, not a Fetch polyfill or a production global. */
export function testResponse(body: string, init: { status?: number } = {}): Response {
  const status = init.status ?? 200;
  return { status, ok: status >= 200 && status < 300, json: async () => JSON.parse(body) as unknown, text: async () => body, body: { cancel: async () => undefined } } as unknown as Response;
}
