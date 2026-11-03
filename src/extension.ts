import { httpTransport } from "./transport";
import * as vscode from "vscode";
import { randomUUID } from "node:crypto";
import { hostname } from "node:os";
import { setTimeout, clearTimeout } from "node:timers";
import { ApiSecurity, SecurityError, createTarget } from "./security";
/** Pure generation validation. Errors deliberately never include configured values or response bodies. */
class GenerationError extends Error {
  constructor(message: string) { super(message); this.name = "GenerationError"; }
}
const MAX_DIFF_LENGTH = 100000;
type Provider = "lm-studio" | "ollama" | "openai" | "custom";
type HttpProvider = Provider;
const defaults: Record<HttpProvider, string> = {
  "lm-studio": "qwen2.5-coder-7b-instruct",
  ollama: "qwen2.5-coder:7b",
  openai: "gpt-4.1",
  custom: "qwen2.5-coder-7b-instruct",
};
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function readProvider(value: unknown): Provider {
  if (value === "apple") { throw new GenerationError("Apple Foundation Models is no longer supported. Select LM Studio, Ollama, OpenAI or Custom explicitly in LLM Commit settings. No request was sent."); }
  if (value === undefined) { return "lm-studio"; }
  if (typeof value === "string" && ["lm-studio", "ollama", "openai", "custom"].includes(value)) { return value as Provider; }
  throw new GenerationError("Select a supported provider in LLM Commit settings.");
}
function modelName(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || /[\x00-\x1f\x7f]/.test(value)) {
    throw new GenerationError("The model setting must contain a non-empty model name without control characters.");
  }
  return value; // Preserve explicit identifiers; trim is used only to detect blank values.
}
function resolveModel(provider: HttpProvider, setting: unknown): string {
  if (setting === undefined) { return defaults[provider]; }
  // Existing string settings are intentional shared overrides. New defaults are
  // an empty provider map, so automatic values never cross provider boundaries.
  if (typeof setting === "string") { return modelName(setting); }
  if (!isRecord(setting)) { throw new GenerationError("The model setting must be a model name or a provider-to-model object."); }
  for (const [key, value] of Object.entries(setting)) {
    if (!Object.prototype.hasOwnProperty.call(defaults, key)) { throw new GenerationError("The model object contains an unsupported provider. Use lm-studio, ollama, openai or custom."); }
    modelName(value);
  }
  return Object.prototype.hasOwnProperty.call(setting, provider) ? modelName(setting[provider]) : defaults[provider];
}
function buildPrompt(diff: string, template: unknown, maxDiffLength: unknown): string {
  if (typeof maxDiffLength !== "number" || !Number.isInteger(maxDiffLength) || maxDiffLength < 1 || maxDiffLength > MAX_DIFF_LENGTH) {
    throw new GenerationError("maxDiffLength must be an integer between 1 and 100000 Unicode code points.");
  }
  if (typeof template !== "string" || !template.trim() || !template.includes("{diff}")) {
    throw new GenerationError("The prompt template must be non-empty and contain the {diff} placeholder.");
  }
  // Bound iteration and preserve complete Unicode code points without allocating
  // an array for the entire diff. ASCII behavior is unchanged.
  let offset = 0;
  let count = 0;
  for (const character of diff) {
    if (count === maxDiffLength) { break; }
    offset += character.length;
    count++;
  }
  const literalDiff = offset < diff.length ? `${diff.slice(0, offset)}\n... (diff truncated)` : diff;
  return template.replace(/\{diff\}/g, () => literalDiff);
}
function stripQuotes(text: string): string {
  return ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'")))
    ? text.slice(1, -1).trim() : text;
}
function parseCompletion(data: unknown): string {
  if (!isRecord(data) || !Array.isArray(data.choices) || data.choices.length === 0) {
    throw new GenerationError("The API returned no usable completion choices.");
  }
  const choice: unknown = data.choices[0];
  if (!isRecord(choice) || !isRecord(choice.message) || typeof choice.message.content !== "string") {
    throw new GenerationError("The API completion must contain a message with text content.");
  }
  // A missing reason is allowed for existing OpenAI-compatible local providers.
  if (choice.finish_reason !== undefined && choice.finish_reason !== "stop") {
    throw new GenerationError("The API returned an incomplete or unsupported completion. No commit message was applied.");
  }
  let message = stripQuotes(choice.message.content.trim());
  message = message.replace(/^commit message:/i, "").trim();
  message = message.replace(/^message:/i, "").trim();
  message = stripQuotes(message);
  if (!message) { throw new GenerationError("The API returned an empty commit message."); }
  return message;
}


type StopReason = "user" | "timeout" | "deactivated" | "completed";
class OperationStopped extends Error {
  constructor(readonly reason: StopReason) { super("Generation stopped."); }
}
class GenerationOperation implements vscode.Disposable {
  readonly controller = new AbortController();
  readonly signal = this.controller.signal;
  private reason: StopReason | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private readonly resources = new Set<vscode.Disposable>();
  private disposed = false;
  throwIfStopped(): void { if (this.signal.aborted) { throw new OperationStopped(this.reason || "deactivated"); } }
  abort(reason: StopReason): void {
    if (!this.signal.aborted) { this.reason = reason; this.stopTimer(); this.controller.abort(); }
  }
  startTimer(milliseconds: number): void {
    this.throwIfStopped(); this.stopTimer();
    this.timer = setTimeout(() => { this.timer = undefined; this.abort("timeout"); }, milliseconds);
    this.timer.unref();
  }
  stopTimer(): void { if (this.timer) { clearTimeout(this.timer); this.timer = undefined; } }
  add(resource: vscode.Disposable): void {
    if (this.disposed) { try { resource.dispose(); } catch { /* finish remaining cleanup */ } } else { this.resources.add(resource); }
  }
  wait<T>(task: PromiseLike<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const cleanup = () => this.signal.removeEventListener("abort", stopped);
      const stopped = () => { cleanup(); reject(new OperationStopped(this.reason || "deactivated")); };
      this.signal.addEventListener("abort", stopped, { once: true });
      // Always attach both handlers, including when already aborted: late failures
      // from APIs that cannot cancel their own work must not become unhandled.
      Promise.resolve(task).then(value => {
        cleanup();
        if (this.signal.aborted) { stopped(); } else { resolve(value); }
      }, error => {
        cleanup();
        if (this.signal.aborted) { stopped(); } else { reject(error); }
      });
      if (this.signal.aborted) { stopped(); }
    });
  }
  dispose(): void {
    if (this.disposed) { return; }
    this.disposed = true; this.abort("completed"); this.stopTimer();
    for (const resource of this.resources) { try { resource.dispose(); } catch { /* one failed disposable must not strand other resources */ } }
    this.resources.clear();
  }
}
function timeoutMilliseconds(value: unknown): number {
  if (value === undefined) { return 120000; }
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 600) {
    throw new GenerationError("timeoutSeconds must be an integer between 1 and 600.");
  }
  return value * 1000;
}
let stopActiveGenerations: (() => Promise<void>) | undefined;

interface OpenAIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ProviderConfig {
  apiUrl: string;
}

function getProviderConfig(provider: string): ProviderConfig {
  const config = vscode.workspace.getConfiguration("llm-commit");


  let apiUrl: string;


  switch (provider) {
    case "lm-studio":
      apiUrl = "http://127.0.0.1:1234/v1/chat/completions";
      break;
    case "ollama":
      apiUrl = "http://127.0.0.1:11434/v1/chat/completions";
      break;
    case "openai":
      apiUrl = "https://api.openai.com/v1/chat/completions";
      break;
    case "custom":
    default:
      const configuredUrl = config.get<unknown>("apiUrl");
      if (configuredUrl !== undefined && (typeof configuredUrl !== "string" || !configuredUrl.trim())) {
        throw new GenerationError("The Custom API URL must be a non-empty HTTP or HTTPS URL.");
      }
      apiUrl = configuredUrl === undefined ? "http://localhost:1234/v1/chat/completions" : configuredUrl as string;
      break;
  }

  return {
    apiUrl,
  };
}

function createApiSecurity(context: vscode.ExtensionContext): ApiSecurity {
  // Remote authorities cannot be reliably identified by remoteName alone.
  // Re-authorize once per remote extension-host session, never once per request.
  const execution = vscode.env.remoteName
    ? { id: `remote-session:${randomUUID()}`, label: `Remote extension host (${vscode.env.remoteName}, ${hostname()})`, persistent: false }
    : { id: `local:${vscode.env.machineId}`, label: "Local extension host", persistent: true };
  const readLegacy = () => {
    const value = vscode.workspace.getConfiguration("llm-commit").inspect<string>("apiKey")?.globalValue;
    return typeof value === "string" && value.trim() ? value : undefined;
  };
  return new ApiSecurity({
    readTarget: () => {
      const provider = vscode.workspace.getConfiguration("llm-commit").get<string>("provider") || "lm-studio";
      return createTarget(provider, getProviderConfig(provider).apiUrl, execution);
    },
    isTrusted: () => vscode.workspace.isTrusted,
    secrets: context.secrets,
    approvals: {
      get: id => context.globalState.get<boolean>(id),
      update: (id, value) => context.globalState.update(id, value),
    },
    confirm: async (message, action) => await vscode.window.showWarningMessage(message, { modal: true }, action) === action,
    inputKey: label => vscode.window.showInputBox({
      title: "LLM Commit: Set API Key", prompt: `API key for ${label}`, password: true, ignoreFocusOut: true,
    }),
    chooseMigration: async label => {
      const choice = await vscode.window.showWarningMessage(
        `A legacy user API key exists. Assign it explicitly to ${label}, or enter a new key. Workspace API keys are never imported automatically.`,
        { modal: true }, "Migrate user key", "Enter new key"
      );
      return choice === "Migrate user key" ? "migrate" : choice === "Enter new key" ? "new" : undefined;
    },
    readLegacy,
    reviewLegacy: async expected => {
      if (readLegacy() !== expected) { throw new Error("Legacy user setting changed; it was kept."); }
      // Configuration.update has no compare-and-delete operation. Manual cleanup avoids
      // deleting a concurrent edit in another window after the last inspection.
      await vscode.commands.executeCommand("workbench.action.openSettings", "llm-commit.apiKey");
    },
    warn: message => { void vscode.window.showWarningMessage(message); },
    transport: httpTransport,
  });
}

async function getGitAPI(operation: GenerationOperation): Promise<GitAPI | undefined> {
  try {
    operation.throwIfStopped();
    const extension = vscode.extensions.getExtension<{ getAPI(version: 1): GitAPI }>("vscode.git");
    if (!extension) {
      vscode.window.showErrorMessage("Git extension is not available.");
      return undefined;
    }
    if (!extension.isActive) {
      await extension.activate();
      operation.throwIfStopped();
    }
    const gitAPI = extension.exports.getAPI(1);
    if (!gitAPI) {
      vscode.window.showErrorMessage("Unable to get Git API.");
      return undefined;
    }
    return gitAPI;
  } catch (error) {
    if (operation.signal.aborted) { return undefined; }
    console.error("Error getting Git API:", error);
    vscode.window.showErrorMessage(
      `Error getting Git API: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return undefined;
  }
}

// Minimal subset of the built-in Git API used by this command.
interface GitRepository {
  readonly rootUri: vscode.Uri;
  readonly inputBox: { value: string };
  diff(cached?: boolean): Promise<string>;
}
interface GitAPI {
  readonly repositories: GitRepository[];
  readonly onDidCloseRepository?: vscode.Event<GitRepository>;
  getRepository?(uri: vscode.Uri): GitRepository | null;
}
type RepositoryKey = string | GitRepository;
function repositoryKey(repo: GitRepository): RepositoryKey {
  // Git API v1 can return fresh wrappers on every access; use the public root URI.
  return repo.rootUri?.toString() ?? repo;
}
function isRepositoryOpen(api: GitAPI, repo: GitRepository): boolean {
  const key = repositoryKey(repo);
  return api.repositories.some(candidate => repositoryKey(candidate) === key);
}
function isContextUri(value: unknown): value is vscode.Uri {
  return !!value && typeof value === "object"
    && typeof (value as vscode.Uri).scheme === "string"
    && typeof (value as vscode.Uri).path === "string"
    && typeof (value as vscode.Uri).toString === "function";
}
async function selectRepository(api: GitAPI, scmContext: unknown, token?: vscode.CancellationToken): Promise<GitRepository | undefined> {
  const repositories = api.repositories;
  if (repositories.length === 0) {
    void vscode.window.showInformationMessage("No Git repository found in the workspace.");
    return undefined;
  }
  const rootUri = scmContext && typeof scmContext === "object"
    ? (scmContext as { rootUri?: unknown }).rootUri : undefined;
  if (isContextUri(rootUri)) {
    const matches = repositories.filter(repo => repo.rootUri?.toString() === rootUri.toString());
    if (matches.length === 1) { return matches[0]; }
    void vscode.window.showWarningMessage("The Git repository from this SCM context is no longer available or is ambiguous. Run the command again.");
    return undefined;
  }
  if (isContextUri(scmContext)) {
    // Delegate nested repository/file resolution to Git instead of guessing by path prefix.
    const repo = api.getRepository?.(scmContext);
    if (repo && isRepositoryOpen(api, repo)) { return repo; }
    void vscode.window.showWarningMessage("No open Git repository matches this URI context.");
    return undefined;
  }
  if (repositories.length === 1) { return repositories[0]; }
  const items = repositories.map(repo => ({
    label: repo.rootUri.path.split("/").filter(Boolean).pop() || "Git repository",
    description: repo.rootUri.fsPath || repo.rootUri.toString(),
    repo,
  }));
  const selected = await vscode.window.showQuickPick(items, {
    title: "LLM Commit: Select Git Repository", placeHolder: "Choose the repository whose staged changes should be used", ignoreFocusOut: true,
  }, token);
  return selected?.repo;
}
async function getStagedDiff(repo: GitRepository, operation: GenerationOperation): Promise<string | null> {
  try {
    const diff = await repo.diff(true);
    if (!diff) {
      void vscode.window.showInformationMessage("No staged changes found.");
      return null;
    }
    return diff;
  } catch (error) {
    if (operation.signal.aborted) { return null; }
    console.error("Error getting git diff:", error);
    void vscode.window.showErrorMessage("Could not read staged changes from the selected Git repository. It may have been closed or removed.");
    return null;
  }
}
async function preserveGeneratedMessage(repo: GitRepository, message: string, reason: string, operation: GenerationOperation): Promise<void> {
  const label = repo.rootUri?.fsPath || repo.rootUri?.toString() || "selected repository";
  try {
    operation.throwIfStopped();
    const document = await operation.wait(vscode.workspace.openTextDocument({ content: message, language: "git-commit" }));
    operation.throwIfStopped();
    await operation.wait(vscode.window.showTextDocument(document, { preview: false, preserveFocus: true }));
    operation.throwIfStopped();
    void vscode.window.showWarningMessage(`${label}: ${reason} The generated message is in a separate unsaved editor; copy it manually if needed.`);
  } catch {
    operation.throwIfStopped();
    // Keep the result visible even when opening an editor fails. Never log it or
    // replace clipboard contents without an explicit user action.
    const action = "Copy generated message";
    const selected = await operation.wait(vscode.window.showErrorMessage(
      "The generated message could not be opened. The commit draft was preserved.",
      { modal: true, detail: message }, action
    ));
    operation.throwIfStopped();
    if (selected === action) {
      try { await vscode.env.clipboard.writeText(message); }
      catch { void vscode.window.showErrorMessage("The clipboard is unavailable. Copy the generated message from the dialog before closing it."); }
    }
  }
}

async function generateWithOpenAI(
  finalPrompt: string,
  model: string,
  security: ApiSecurity,
  operation: GenerationOperation,
  timeout: number
): Promise<string | null> {
  try {
    const messages: OpenAIMessage[] = [
      {
        role: "user",
        content: finalPrompt,
      },
    ];

    operation.throwIfStopped();
    const response = await operation.wait(security.request(JSON.stringify({
      model,
      messages,
      max_tokens: 150,
      temperature: 0.7,
    }), operation.signal, () => operation.startTimer(timeout)));
    operation.throwIfStopped();

    if (!response.ok) {
      const status = response.status;
      let errorMessage = "Failed to generate commit message.";

      if (status === 401) {
        errorMessage = "Authentication failed. Please check your API key.";
      } else if (status === 404) {
        errorMessage = "API endpoint not found. Please check your API URL.";
      } else if (status === 429) {
        errorMessage = "Rate limit exceeded. Please try again later.";
      } else {
        errorMessage = `API request failed (HTTP ${status}). Check the endpoint and provider settings.`;
      }

      vscode.window.showErrorMessage(errorMessage);
      return null;
    }

    let data: unknown;
    try { data = await operation.wait(response.json()); }
    catch { operation.throwIfStopped(); throw new GenerationError("The API returned invalid JSON. No commit message was applied."); }
    operation.throwIfStopped();
    return parseCompletion(data);
  } catch (error: unknown) {
    operation.throwIfStopped();
    // Never surface transport exceptions or server response text: they may echo credentials.
    vscode.window.showErrorMessage(error instanceof SecurityError || error instanceof GenerationError
      ? error.message
      : "The API response could not be processed. Check the provider and endpoint settings.");
    return null;
  }
}

async function generateCommitMessage(
  diff: string,
  security: ApiSecurity,
  operation: GenerationOperation
): Promise<string | null> {
  try {
    const config = vscode.workspace.getConfiguration("llm-commit");
    const provider = readProvider(config.get<unknown>("provider"));
    const timeout = timeoutMilliseconds(config.get<unknown>("timeoutSeconds", 120));
    const finalPrompt = buildPrompt(diff, config.get<unknown>("prompt"), config.get<unknown>("maxDiffLength", 4000));
    const model = resolveModel(provider, config.get<unknown>("model"));
    // Validate the functional URL parameter as well; protocol, origin, trust,
    // credentials and redirects remain exclusively guarded by Phase 1.
    getProviderConfig(provider);
    return await generateWithOpenAI(finalPrompt, model, security, operation, timeout);
  } catch (error) {
    operation.throwIfStopped();
    void vscode.window.showErrorMessage(error instanceof GenerationError
      ? error.message : "The generation configuration could not be read. Check LLM Commit settings.");
    return null;
  } finally { operation.stopTimer(); }
}

export function activate(context: vscode.ExtensionContext) {
  const security = createApiSecurity(context);
  const runKeyCommand = async (operation: () => Promise<void>) => {
    try { await operation(); }
    catch (error) {
      vscode.window.showErrorMessage(error instanceof SecurityError ? error.message : "The API key operation failed.");
    }
  };
  context.subscriptions.push(
    vscode.commands.registerCommand("llm-commit.setApiKey", () => runKeyCommand(() => security.configureKey())),
    vscode.commands.registerCommand("llm-commit.removeApiKey", () => runKeyCommand(() => security.removeKey()))
  );
  // Only active requests are retained. URI keys also cover fresh Git API wrappers.
  const latestRequests = new Map<RepositoryKey, number>();
  const pendingRequests = new Map<number, GenerationOperation>();
  let requestSequence = 0;
  let disposed = false;
  let shutdown: Promise<void> | undefined;
  const stopGenerations = (): Promise<void> => {
    if (shutdown) { return shutdown; }
    disposed = true;
    for (const operation of pendingRequests.values()) {
      operation.abort("deactivated"); operation.dispose();
    }
    latestRequests.clear();
    shutdown = Promise.resolve().then(() => {
      pendingRequests.clear();
      if (stopActiveGenerations === stopGenerations) { stopActiveGenerations = undefined; }
    });
    return shutdown;
  };
  stopActiveGenerations = stopGenerations;
  context.subscriptions.push({ dispose: () => { void stopGenerations(); } });
  const disposable = vscode.commands.registerCommand(
    "llm-commit.generate",
    async (scmContext?: unknown) => {
      if (disposed) { return; }
      const request = ++requestSequence;
      const operation = new GenerationOperation();
      pendingRequests.set(request, operation);
      let closeSubscription: vscode.Disposable | undefined;
      let key: RepositoryKey | undefined;
      try {
        await vscode.window.withProgress({
          location: vscode.ProgressLocation.Notification, title: "Generating commit message with LLM...", cancellable: true,
        }, async (progress, token?: vscode.CancellationToken) => {
          if (token) { operation.add(token.onCancellationRequested(() => operation.abort("user"))); if (token.isCancellationRequested) { operation.abort("user"); } }
          operation.throwIfStopped();
          const gitAPI = await operation.wait(getGitAPI(operation));
          if (!gitAPI || disposed) { return; }
          // Subscribe before selection. Git API close events may carry fresh wrappers.
          const closedRepositories = new Set<RepositoryKey>();
          closeSubscription = gitAPI.onDidCloseRepository?.(closed => {
            const closedKey = repositoryKey(closed);
            closedRepositories.add(closedKey);
            latestRequests.delete(closedKey);
          });
          if (closeSubscription) { operation.add(closeSubscription); }
          let repo: GitRepository | undefined;
          repo = await operation.wait(selectRepository(gitAPI, scmContext, token));
          operation.throwIfStopped();
          if (!repo || disposed) { return; }
          key = repositoryKey(repo);
          const selectedRepo = repo;
          const available = () => !disposed && !closedRepositories.has(repositoryKey(selectedRepo)) && isRepositoryOpen(gitAPI, selectedRepo);
          if (!available()) {
            void vscode.window.showWarningMessage("The selected Git repository was closed or removed. Run the command again.");
            return;
          }
          if (!repo.inputBox || typeof repo.inputBox.value !== "string") {
            void vscode.window.showWarningMessage("Could not find the selected Git repository's commit input box.");
            return;
          }
          const newerRequest = latestRequests.get(key);
          if (newerRequest !== undefined && newerRequest > request) {
            void vscode.window.showInformationMessage("Generation skipped: a newer request already selected this repository.");
            return;
          }
          const initialDraft = repo.inputBox.value;
          latestRequests.set(key, request);
          progress.report({ increment: 10 });
          const diff = await operation.wait(getStagedDiff(selectedRepo, operation));
          operation.throwIfStopped();
          if (!diff) { return; }
          if (!available() || latestRequests.get(key!) !== request) {
            if (!disposed) { void vscode.window.showInformationMessage("Generation skipped: the repository was closed or a newer request was started."); }
            return;
          }
          progress.report({ increment: 30 });
          const generatedMessage = await generateCommitMessage(diff, security, operation);
          operation.throwIfStopped();
          if (!generatedMessage || disposed) { return; }
          progress.report({ increment: 50 });
          let reason: string | undefined;
          if (!available()) { reason = "The repository was closed or removed; its commit input was not changed."; }
          else if (latestRequests.get(key!) !== request) { reason = "A newer generation was started; this older result was not applied."; }
          else if (initialDraft !== "") { reason = "The existing commit draft was preserved."; }
          else {
            try {
              if (selectedRepo.inputBox.value !== initialDraft) { reason = "The commit draft was edited during generation and was preserved."; }
            } catch { reason = "The commit input box is no longer available."; }
          }
          if (reason) {
            await preserveGeneratedMessage(selectedRepo, generatedMessage, reason, operation);
            return;
          }
          operation.throwIfStopped();
          // No await between the final guards and assignment.
          try { selectedRepo.inputBox.value = generatedMessage; }
          catch {
            await preserveGeneratedMessage(selectedRepo, generatedMessage, "The commit input box is no longer available.", operation);
            return;
          }
          progress.report({ increment: 10 });
        });
      } catch (error) {
        if (error instanceof OperationStopped) {
          if (error.reason === "timeout" && !disposed) { void vscode.window.showWarningMessage("Commit generation timed out. Increase timeoutSeconds for a slow HTTP model."); }
        } else if (!disposed) { void vscode.window.showErrorMessage("Commit generation could not be completed for the selected repository."); }
      } finally {
        operation.dispose();
        pendingRequests.delete(request);
        // Retain the high-water mark while an older invocation may still be
        // resolving Git activation or a picker. Completed batches retain no state.
        if (pendingRequests.size === 0) { latestRequests.clear(); }
      }
    }
  );
  context.subscriptions.push(disposable);
}

export function deactivate(): Promise<void> | undefined { return stopActiveGenerations?.(); }
