import type { HttpRequest, HttpResponse } from "./transport";
/** Security boundary for HTTP providers. No workspace data is stored as authorization. */
export interface ExecutionContext {
  id: string;
  label: string;
  persistent: boolean;
}
export interface ApiTarget {
  provider: string;
  url: string;
  origin: string;
  execution: ExecutionContext;
}
interface SecurityOptions {
  readTarget(): ApiTarget;
  isTrusted(): boolean;
  secrets: {
    get(id: string): PromiseLike<string | undefined>;
    store(id: string, value: string): PromiseLike<void>;
    delete(id: string): PromiseLike<void>;
  };
  approvals: {
    get(id: string): boolean | undefined;
    update(id: string, value: boolean): PromiseLike<void>;
  };
  confirm(message: string, action: string): PromiseLike<boolean>;
  inputKey(label: string): PromiseLike<string | undefined>;
  chooseMigration(label: string): PromiseLike<"migrate" | "new" | undefined>;
  readLegacy(): string | undefined;
  reviewLegacy(expected: string): PromiseLike<void>;
  warn(message: string): void;
  transport(url: string, init: HttpRequest): Promise<HttpResponse>;
}
export class SecurityError extends Error {
  constructor(message: string) { super(message); this.name = "SecurityError"; }
}
const presets: Record<string, string> = {
  "lm-studio": "http://127.0.0.1:1234/v1/chat/completions",
  ollama: "http://127.0.0.1:11434/v1/chat/completions",
  openai: "https://api.openai.com/v1/chat/completions",
};
export function createTarget(provider: string, value: string, execution: ExecutionContext): ApiTarget {
  if (provider !== "custom" && !Object.prototype.hasOwnProperty.call(presets, provider)) {
    throw new SecurityError("Select a supported HTTP provider in LLM Commit settings.");
  }
  let url: URL;
  try { url = new URL(value); } catch { throw new SecurityError("The API endpoint must be a valid HTTP or HTTPS URL."); }
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.username || url.password || url.hash || (url.protocol !== "https:" && !(url.protocol === "http:" && loopback))) {
    throw new SecurityError("Use HTTPS for external API endpoints. HTTP is allowed only on loopback. URL credentials and fragments are not allowed.");
  }
  if (provider !== "custom" && url.href !== presets[provider]) {
    throw new SecurityError("A provider preset cannot use a different API endpoint. Select Custom instead.");
  }
  return { provider, url: url.href, origin: url.origin, execution: { ...execution } };
}
export function credentialId(target: ApiTarget): string {
  return `llm-commit.credential.v1:${JSON.stringify([target.provider, target.origin])}`;
}
export function authorizationId(target: ApiTarget): string {
  return `llm-commit.authorized.v1:${JSON.stringify([target.provider, target.origin, target.execution.id])}`;
}
function ensureRequestActive(signal?: AbortSignal): void {
  if (signal?.aborted) { throw new SecurityError("The API request was cancelled."); }
}
function description(target: ApiTarget): string {
  return `${target.provider} at ${target.origin} (${target.execution.label})`;
}
/** A saved credential is usable only after authorization in the current execution context. */
export class ApiSecurity {
  private readonly sessionApprovals = new Set<string>();
  private managingKey = false;
  private readonly options: SecurityOptions;
  constructor(options: SecurityOptions) { this.options = options; }

  private snapshot(): ApiTarget {
    if (!this.options.isTrusted()) { throw new SecurityError("Trust this workspace before using HTTP generation or managing API keys."); }
    const target = this.options.readTarget();
    return createTarget(target.provider, target.url, target.execution);
  }
  private assertCurrent(target: ApiTarget): void {
    const current = this.snapshot();
    if (current.provider !== target.provider || current.url !== target.url || current.execution.id !== target.execution.id) {
      throw new SecurityError("The API destination changed during authorization. Run the command again.");
    }
  }
  private async authorize(target: ApiTarget, signal?: AbortSignal): Promise<void> {
    ensureRequestActive(signal);
    const id = authorizationId(target);
    if (this.sessionApprovals.has(id) || (target.execution.persistent && this.options.approvals.get(id) === true)) {
      this.assertCurrent(target); return;
    }
    const approved = await this.options.confirm(
      `Allow sending staged changes and credentials assigned to ${description(target)}? Authorization covers this provider and API origin only.`, "Authorize API origin"
    );
    ensureRequestActive(signal);
    this.assertCurrent(target);
    if (!approved) { throw new SecurityError("API origin authorization was cancelled. Nothing was sent."); }
    if (target.execution.persistent) { await this.options.approvals.update(id, true); }
    this.assertCurrent(target);
    ensureRequestActive(signal);
    this.sessionApprovals.add(id);
  }
  private async readKey(target: ApiTarget): Promise<string | undefined> {
    const saved = await this.options.secrets.get(credentialId(target));
    this.assertCurrent(target);
    if (saved === undefined) { return undefined; }
    let record: unknown;
    try { record = JSON.parse(saved); } catch { throw new SecurityError("The saved API credential is invalid. Use LLM Commit: Set API Key to replace it."); }
    const value = record as { version?: unknown; provider?: unknown; origin?: unknown; key?: unknown } | null;
    if (!value || value.version !== 1 || value.provider !== target.provider || value.origin !== target.origin || typeof value.key !== "string" || !value.key.trim() || /[\r\n]/.test(value.key)) {
      throw new SecurityError("The saved API credential does not match this destination. Use LLM Commit: Set API Key.");
    }
    return value.key;
  }
  async request(body: string, signal?: AbortSignal, onTransportStart?: () => void): Promise<HttpResponse> {
    try {
      ensureRequestActive(signal);
      const target = this.snapshot();
      const localPreset = target.provider === "lm-studio" || target.provider === "ollama";
      const key = localPreset ? undefined : await this.readKey(target);
      ensureRequestActive(signal);
      if (!localPreset && !key && this.options.readLegacy()) {
        throw new SecurityError("A legacy user API key needs migration. Run LLM Commit: Set API Key before generating.");
      }
      if (target.provider === "openai" && !key) {
        throw new SecurityError("OpenAI requires a key. Run LLM Commit: Set API Key.");
      }
      if (!localPreset) { await this.authorize(target, signal); }
      ensureRequestActive(signal);
      this.assertCurrent(target);
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (key) { headers.Authorization = `Bearer ${key}`; }
      // Never forward a diff or a credential through a redirect, even to the same origin.
      onTransportStart?.();
      ensureRequestActive(signal);
      const response = await this.options.transport(target.url, { method: "POST", headers, body, redirect: "error", signal });
      if (signal?.aborted) {
        // A transport that ignores abort may deliver headers late. Do not decode
        // or leak that body; consume any cancellation rejection locally.
        void response.body?.cancel().catch(() => undefined);
        ensureRequestActive(signal);
      }
      if (response.status >= 300 && response.status < 400) {
        throw new SecurityError("The API returned a redirect. Configure its direct endpoint; redirects are not followed.");
      }
      return response;
    } catch (error) {
      ensureRequestActive(signal);
      if (error instanceof SecurityError) { throw error; }
      // Transport/storage exceptions may contain headers, response data or secrets.
      throw new SecurityError("The secure API request failed. Check the service, direct endpoint and saved credentials.");
    }
  }
  async configureKey(): Promise<void> {
    if (this.managingKey) { throw new SecurityError("Another API key operation is in progress."); }
    this.managingKey = true;
    try {
      const target = this.snapshot();
      if (target.provider !== "custom" && target.provider !== "openai") {
        throw new SecurityError("LM Studio and Ollama presets are keyless. Select Custom to configure an authenticated endpoint.");
      }
      const legacy = this.options.readLegacy();
      let migrate = false;
      let key: string | undefined;
      if (legacy) {
        const choice = await this.options.chooseMigration(description(target));
        this.assertCurrent(target);
        if (!choice) { return; }
        migrate = choice === "migrate";
      }
      key = migrate ? legacy : await this.options.inputKey(description(target));
      this.assertCurrent(target);
      if (key === undefined) { return; }
      key = key.trim();
      if (!key || /[\r\n]/.test(key)) { throw new SecurityError("Enter a non-empty API key without line breaks."); }
      const confirmed = await this.options.confirm(`Save or replace the API key for ${description(target)} and authorize this origin?`, "Save API key");
      this.assertCurrent(target);
      if (!confirmed) { return; }
      const id = credentialId(target);
      const record = JSON.stringify({ version: 1, provider: target.provider, origin: target.origin, key });
      await this.options.secrets.store(id, record);
      // Verify persistence before offering manual cleanup of the legacy configuration.
      if (await this.options.secrets.get(id) !== record) { throw new SecurityError("The saved key could not be verified. The legacy setting was kept."); }
      this.assertCurrent(target);
      const approval = authorizationId(target);
      if (target.execution.persistent) { await this.options.approvals.update(approval, true); }
      this.assertCurrent(target);
      this.sessionApprovals.add(approval);
      if (migrate && legacy && await this.options.confirm("The key is safely stored. Open the legacy user setting for manual removal? It will not be deleted automatically.", "Review legacy setting")) {
        this.assertCurrent(target);
        try { await this.options.reviewLegacy(legacy); }
        catch { this.options.warn("The secure key was saved, but the legacy user setting could not be opened. Review it manually when ready; it was not deleted."); }
      }
    } catch (error) {
      if (error instanceof SecurityError) { throw error; }
      throw new SecurityError("The API key operation failed. Legacy settings were not intentionally removed; check the saved key before retrying.");
    } finally { this.managingKey = false; }
  }
  async removeKey(): Promise<void> {
    if (this.managingKey) { throw new SecurityError("Another API key operation is in progress."); }
    this.managingKey = true;
    try {
      const target = this.snapshot();
      const confirmed = await this.options.confirm(`Remove the saved API key for ${description(target)}? Other origins are unchanged.`, "Remove API key");
      this.assertCurrent(target);
      if (confirmed) { await this.options.secrets.delete(credentialId(target)); }
    } catch (error) {
      if (error instanceof SecurityError) { throw error; }
      throw new SecurityError("The saved API key could not be removed. Try again.");
    } finally { this.managingKey = false; }
  }
}
