# LLM Commit

Generate Git commit messages from staged changes with **LM Studio, Ollama, OpenAI or a Custom OpenAI-compatible API**. Requires VS Code 1.80 or later and a configured reachable HTTP provider.

**Apple Foundation Models is no longer supported.** The native integration and Swift build have been removed. An existing `"llm-commit.provider": "apple"` value produces a controlled error. Select a new provider yourself: settings and credentials are never automatically migrated to another provider, and no replacement network request is made.

## Setup and providers

Stage changes, choose the intended repository in Source Control and run **LLM Commit: Generate Message** (sparkle icon). Existing or concurrently edited drafts are preserved; protected generated results remain available in a separate unsaved editor. Multiple repositories without command context require a conscious selection.

| Provider value | Endpoint | Default model |
|---|---|---|
| `lm-studio` (default) | `http://127.0.0.1:1234/v1/chat/completions` | `qwen2.5-coder-7b-instruct` |
| `ollama` | `http://127.0.0.1:11434/v1/chat/completions` | `qwen2.5-coder:7b` |
| `openai` | `https://api.openai.com/v1/chat/completions` | `gpt-4.1` |
| `custom` | Explicit `llm-commit.apiUrl` | `qwen2.5-coder-7b-instruct` compatibility default; override to match your server |

Run your local server and load its intended model. For OpenAI, run **LLM Commit: Set API Key**. For Custom, set URL/model and save a key only if your endpoint needs one. Model availability is determined by your backend; these are project defaults, not a promise of external service availability.

## Configuration

```json
{
  "llm-commit.provider": "lm-studio",
  "llm-commit.model": {
    "lm-studio": "qwen2.5-coder-7b-instruct",
    "ollama": "qwen2.5-coder:7b"
  },
  "llm-commit.maxDiffLength": 4000,
  "llm-commit.timeoutSeconds": 120
}
```

- `llm-commit.model` defaults to `{}`: each provider resolves its own default. Explicit provider entries respect VS Code user/workspace configuration hierarchy. A legacy explicit string deliberately overrides all four providers. No silent normalization or model transfer from another provider's map entry.
- `llm-commit.apiUrl` is used only by Custom. Fixed preset endpoints cannot be overridden through workspace URLs.
- `llm-commit.prompt` must be non-empty and contain `{diff}`. Every placeholder receives the same literal diff, including dollar tokens and Unicode.
- `llm-commit.maxDiffLength` is an integer from 1 to 100000 Unicode code points. Longer diffs are visibly truncated; this is not a token budget.
- `llm-commit.timeoutSeconds` is an integer from 1 to 600, default 120, covering transport and response body after authorization. Cancellation and extension deactivation abort outstanding HTTP work; stale output cannot overwrite newer results.

## Security and privacy

Review staged files for sensitive content. Generating sends the bounded diff/prompt to the selected HTTP provider. No cloud fallback exists.

- Credentials are stored in VS Code SecretStorage, bound to provider and API origin. Separate authorization is bound to that destination and the execution context. Workspace Trust is required for HTTP generation and key management; trust alone does not authorize a Custom destination.
- External endpoints require HTTPS. HTTP is restricted to loopback (`localhost`, `127.0.0.1`, `::1`). Redirects are blocked; TLS certificate and hostname verification remain active.
- LM Studio/Ollama presets remain keyless. Custom requires conscious origin authorization. OpenAI requires a saved key. Use **Set API Key** / **Remove API Key** for the current destination.
- Deprecated `llm-commit.apiKey` settings are never sent directly. User-level migration requires explicit confirmation and a successful SecretStorage save/read-back. Workspace keys are not automatically imported. Legacy settings are not automatically deleted; cancellation/errors preserve existing data.
- Local unchanged approvals may be reused. Remote approvals are session-scoped because `remoteName` alone is not a unique host. Loopback always refers to the actual extension host. Real Remote validation remains open.
- Unknown transport errors, raw server responses and Authorization values are not exposed in diagnostics.

## Development and complete local VSIX

Node baseline `.node-version` 26.13.0, pnpm 11.25.0; manifest developer range >=22.13.0. Runtime compatibility is separately tested in the embedded Node 16.17.1 of VS Code 1.80.

```sh
pnpm install --frozen-lockfile
pnpm run lint
pnpm run typecheck
pnpm run compile
pnpm run package
pnpm run vscode:prepublish
pnpm run test:headless
node --test scripts/package-validation.test.cjs
```

On exFAT only, add `--node-linker=hoisted` to installation. `package` builds the JavaScript production bundle. `vscode:prepublish` runs that build without native tools. **Swift, Xcode and Apple-specific build tools are not required.**

Use the isolated, pinned VSCE 3.9.2 installation in `.github/packager`, without adding it to project dependencies. Its own workspace configuration contains only the approved parent overrides for glob 14.0.3 and minimatch 11.0.4. Install inside that workspace so pnpm reads those overrides:

```sh
(cd .github/packager && pnpm install --frozen-lockfile --ignore-scripts)
# Run the following two commands with the pinned packaging Node 24.22.1:
node scripts/package-test-vsix.cjs <isolated-vsce-cli> <output.vsix>
node scripts/inspect-test-vsix.cjs <isolated-vsce-cli> <output.vsix> <inspection.json>
```

The script filenames are retained for compatibility. They now build/inspect the **complete four-provider VSIX**, with the real prepublish hook, unchanged manifest and no historical test marker. ZIP inspection uses the validated Node 24.22.1 environment; Node 26 remains outside the validated packaging path and its inspection guard remains. Audit the tool separately with `pnpm --dir .github/packager --ignore-workspace audit --json`; this audit flag is deliberately absent from its own-workspace installation. Complete local packaging is not permission to publish.

See the current [Phase 8.2 packager report](docs/phase82-packager.md), the [Phase 7 product report](docs/phase7-removal.md), [project status](docs/PROJECT_STATUS.md), [issues](docs/ISSUES.md), [roadmap](docs/ROADMAP.md) and [development rules](AGENTS.md). Real Linux, macOS HTTP and Remote/enterprise tests remain separate acceptance gates. Historical reports below describe earlier code and do not imply that the removed provider is available today.

<details>
<summary>Historical validation notes through Phase 6.1 — superseded where Phase 7 changes the product scope</summary>

### Phase 1 validation scope

Security regression tests are in src/test/security.test.ts and use dummy credentials only. They cover origin/provider binding, execution-context consent, migration failures, restricted mode, command wiring and a real local redirect server. Command-wiring tests simulate VS Code services; they are not a substitute for a real Extension Host or OS credential-store test. Apple runtime validation requires supported macOS hardware.

### Reproducing the security checks

Install the existing lockfile without lifecycle scripts, then compile and run the security suite:

```powershell
pnpm install --frozen-lockfile --ignore-scripts
pnpm exec tsc --noEmit
pnpm run compile-tests
node -e 'const path=require("node:path"); const Mocha=require(require.resolve("mocha",{paths:[path.dirname(require.resolve("@vscode/test-cli"))]})); const runner=new Mocha({ui:"tdd",timeout:15000}); runner.addFile("out/test/security.test.js"); runner.run(failures=>{process.exitCode=failures?1:0;});'
pnpm run compile
pnpm run package
```

On exFAT, pnpm's default symlink-based layout is unsupported. Use the one-off installation flag `--node-linker=hoisted`; do not change the lockfile or repository configuration. The programmatic Mocha entry point avoids an incompatibility between the locked legacy Mocha CLI dependencies and Node 26.

Validation on 2026-11-01:

- TypeScript typecheck, test compilation, development build and production bundle: passed.
- Permanent security suite: 43 tests passed, using dummy keys only, including a local HTTP redirect server.
- VS Code 1.144.0 with an isolated temporary profile: 46 tests passed (43 security tests, the existing sample, plus two temporary integration checks for production-bundle activation and genuine SecretStorage save/reuse/removal). The dummy SecretStorage entry was removed in a finally block. This checks the real API in one session; it does not prove storage durability across application restarts or every operating system.
- The workspace-key regression was also run against the original HEAD in memory and failed as expected.
- Direct Flat Config lint (`pnpm exec eslint src`): passed. The unchanged `pnpm run lint` script fails because `--ext` is unsupported with Flat Config; correcting that script remains a later phase.
- Dependency declarations and pnpm-lock.yaml: unchanged. No commits or releases were created.

Remote behavior is covered with simulated execution contexts. Real Remote Development, the declared VS Code minimum version, macOS SecretStorage and Apple inference still need their own environment-specific checks.

## Repository selection and commit draft protection

- An SCM command uses the repository identified by its root URI. A URI context uses the Git API's own repository resolution, including nested repositories it exposes.
- Without an explicit context, one repository is selected directly. Multiple repositories require a Quick Pick with their full paths; cancelling sends no request.
- A stale explicit SCM root never silently falls back to another repository. Selection is checked again after asynchronous operations.
- The same selected Git API repository instance provides the staged diff and receives the result. Request ordering and close events use the repository URI because Git API wrappers may be recreated.
- The commit input is filled automatically only if it was exactly empty at request start, is still unchanged, the repository has remained open and this request is still the newest one for that repository.
- Existing drafts, including whitespace-only drafts, are never automatically replaced. The Git InputBox API exposes its value but no edit-history event; the guard compares the starting and final values.
- Protected, superseded and closed-repository results are opened in separate unsaved git-commit editors with preview disabled. The editor does not steal keyboard focus. Copy the message manually if you want to replace your draft.
- If opening an editor fails, a dialog keeps the generated text visible and offers an explicit copy action. Clipboard contents are not changed automatically.
- Overlapping requests for different repositories are independent. Request IDs are assigned at command invocation, so an old picker resolving late cannot supersede a newer generation.
- Request state and temporary close listeners are cleaned up on completion or extension disposal. Phase 2 originally prevented stale application; Phase 4 adds the cancellation and timeouts described below.

### Phase 2 validation (2026-11-01)

New tests are in src/test/generation.test.ts (28 command-level regression tests) and src/test/git.integration.test.ts (4 real Git integration tests). The latter run inside the VS Code Extension Host and are explicitly skipped in headless Mocha. They initialize and stage dummy files in temporary repositories without commits, use real Git/SCM/input/document APIs, and simulate model transport and progress UI. Only their verified temporary directories are removed during cleanup.

- Before implementation, 20 of the initial 23 regression tests failed against Phase 1. Additional delayed-selection and unavailable-input failures were reproduced before their fixes.
- Final headless run: 71 passed (28 Phase 2 regressions plus all 43 unchanged Phase 1 security tests).
- Final isolated VS Code 1.144.0 Extension Host run: 77 passed (the same 71, four real Git integration tests, the existing sample and a temporary production-bundle command-activation smoke test).
- TypeScript typecheck, test compilation, development build, production build and direct Flat Config lint passed.
- Initial host-test setup failures involving namespace getters, Windows path casing and progress UI were corrected in the test harness; no proposed API was enabled.
- The known lint-script issue, Node 26 legacy Mocha CLI issue and npm warning about the existing .npmrc are unchanged. The Mocha API and direct Flat Config command were used for validation.
- Security implementation, Phase 1 security test file, manifest, dependencies and lockfile were verified unchanged by SHA-256 comparison with the Phase 2 starting state. Provider model defaults and prompt processing were also verified unchanged.

After compiling tests, run both permanent headless suites with the existing Mocha dependency:

```powershell
node -e 'const path=require("node:path"); const Mocha=require(require.resolve("mocha",{paths:[path.dirname(require.resolve("@vscode/test-cli"))]})); const runner=new Mocha({ui:"tdd",timeout:15000}); for(const file of ["generation.test.js","security.test.js"])runner.addFile("out/test/"+file); runner.run(failures=>{process.exitCode=failures?1:0;});'
```

The existing VS Code test configuration discovers the real Git integration test file as well. The validated host run used the existing VS Code installation, an isolated temporary profile and a temporary Mocha runner through @vscode/test-electron.runTests. Remote and macOS behavior and the declared VS Code minimum version still require their own environment checks.

## Phase 3 validation and compatibility

HTTP and Apple generation share the same prompt builder. Diff replacement is literal, including $&, $$, dollar/backtick tokens, Unicode, newlines and literal {diff} text inside a diff. Repeated template placeholders each receive the same diff; inserted text is not processed recursively. Truncation preserves complete Unicode code points. Invalid templates, limits, model settings and Custom URL parameter types are rejected before model execution.

HTTP response JSON is treated as unknown until the choices array, first choice, message and text content have been validated. Empty normalized messages and incomplete/unsupported finish reasons are rejected. Missing finish_reason remains accepted for existing OpenAI-compatible servers; when supplied, it must be stop. Invalid JSON and error HTTP statuses produce fixed messages without raw bodies, configured values or exception details. The Phase 1 HTTPS, trust, origin binding and redirect rules remain in force.

Validation on 2026-11-01:

- The first 70 Phase 3 tests were written before implementation; 34 failed against Phase 2.
- Final new coverage: 80 command-level tests plus three real VS Code configuration-hierarchy tests in src/test/provider.test.ts. Apple prompts use a simulated CLI and never invoke an actual model.
- Headless run: 151 passed; seven host-only tests were explicitly skipped (three configuration tests and four existing real Git tests).
- Isolated VS Code 1.144.0 Extension Host run: 160 passed, including all new tests, 43 unchanged Phase 1 security tests, 32 unchanged Phase 2 Git tests, the existing sample and a temporary production-bundle activation smoke test.
- Typecheck, test compilation, development and production builds, direct Flat Config lint and Git diff checks passed. The known lint-script and old CLI compatibility issues remain unchanged.
- SHA-256 and source-region comparisons verified unchanged security implementation, all Phase 1/2 test files, Git request/draft logic, Apple process execution, dependency declarations and lockfile. Only generation validation, the model/prompt/limit manifest properties and this phase's tests/documentation changed.

The new tests use dummy credentials and simulated HTTP responses only. No paid API requests, dependency upgrades, commits or releases were made. Real Apple inference, Remote Development and the declared minimum VS Code version still require their respective environment checks. HTTP timeout and cancellation were subsequently implemented in Phase 4 below.

To include Phase 3 in the existing headless checks after compiling tests:

```powershell
node -e 'const path=require("node:path"); const Mocha=require(require.resolve("mocha",{paths:[path.dirname(require.resolve("@vscode/test-cli"))]})); const runner=new Mocha({ui:"tdd",timeout:15000}); for(const file of ["provider.test.js","generation.test.js","security.test.js"])runner.addFile("out/test/"+file); runner.run(failures=>{process.exitCode=failures?1:0;});'
```

## Phase 4: cancellation, timeouts and lifecycle

Generation now uses a cancellable VS Code progress notification, including while repository selection is open. Cancel stops that operation quietly; a timeout produces a distinct warning. Other repositories and requests remain independent. Existing drafts, repository selection and request ordering remain protected. Cancelled output is neither decoded after cancellation nor applied or opened as an alternative result.

Set `llm-commit.timeoutSeconds` to an integer from 1 to 600 (default 120). For HTTP it covers transport and response-body decoding, starting immediately before sending, after key lookup and origin authorization. Repository selection and consent do not consume the timeout. This accommodates slower local models without allowing an indefinitely stalled response. Apple uses the smaller of this setting and its existing 60-second limit; its native 60-second guard and 1 MiB output buffer remain in place.

The existing request-ID registry owns each operation's AbortController, timer and temporary subscriptions. HTTP receives its own AbortSignal through the existing security transport. Cancellation checks around asynchronous authorization prevent a late approval from starting a cancelled request. Origin binding, redirect blocking, Remote authorization policy, key migration and SecretStorage architecture are unchanged. Newer-request ordering remains unchanged; beginning a new request does not cancel an unrelated operation.

Apple subprocesses receive an abort signal and are terminated with SIGKILL when cancelled, timed out or disposed. Only the extension's own direct CLI child is targeted. The current Swift CLI performs inference and writes stdout/stderr; it does not require a file-write cleanup grace period. Input-stream errors, synchronous writes, startup failures and early process exit receive controlled errors. Unknown stderr and native exception text are never shown. Deactivation aborts active HTTP and Apple work, disposes timers/listeners and returns a promise that waits for owned child-process close events. Swift source changes were unnecessary.

### Phase 4 validation (2026-11-01)

- New permanent suite: src/test/lifecycle.test.ts, 43 tests. The initial cancellation, timeout, shutdown and stdin-error regressions failed before implementation; a real-child shutdown test also reproduced premature deactivation completion before its fix.
- Headless: 194 passed; seven host-only Git/configuration tests explicitly skipped.
- Isolated VS Code 1.144.0 Extension Host: 203 passed, including all 43 new lifecycle tests, 43 Phase 1 security tests, 32 Phase 2 Git tests, 83 Phase 3 provider/configuration tests, the existing sample and a temporary production-bundle activation smoke test. The isolated run exited with code 0.
- TypeScript typecheck, test compilation, development build, production build, direct Flat Config lint and Git diff checks passed.
- Coverage includes cancellation before headers and during response decoding, timeout, slow success, late resolution/rejection, picker/authorization cancellation, independent parallel operations, draft preservation and mixed-provider shutdown. Controlled local HTTP streams prove actual connection closure; real Node children prove stdin delivery, success, cancellation, timeout, missing-executable handling and close-event waiting. Apple-specific behavior additionally uses controllable process simulations. Only dummy keys are used; no paid model calls occur.
- Existing Phase 1–3 test assertions are unchanged; their VM fixtures only gain the standard AbortController global. Source-region comparisons verify unchanged credential management and prompt/provider helpers. Apart from the new timeout property, the Phase 3 manifest is unchanged. Dependencies and lockfile are unchanged; no Swift changes, commits, pushes or releases were made.
- The existing lint-script failure (Flat Config rejects --ext), legacy CLI/Node 26 compatibility issue and npm configuration warning remain outside this phase. Validation uses direct lint and programmatic Mocha. VS Code emitted environment/startup warnings without test failures.

Public VS Code APIs do not provide forced cancellation of an in-flight Git call, SecretStorage operation or modal authorization dialog. The generation stops waiting, consumes late failures and guards against late model dispatch/result application; an already displayed dialog may still require dismissal. Real HTTP transport and owned subprocesses are actively aborted. Cancellation cannot undo provider work already accepted remotely. The real macOS Foundation Models runtime, Remote Development and minimum supported VS Code version remain environment-specific checks; a macOS smoke test is the safe follow-up before release. Existing Git InputBox value-comparison limitations remain unchanged.

BUG-006 is fixed by the validated HTTP timeout/cancellation and shutdown handling. Phase 5 requires separate approval; recommended follow-up is the roadmap's build/tooling and release validation, including the known lint script, without mixing it into this patch.

After compiling, include all phases in the headless run:

```powershell
node -e 'const Mocha=require("mocha"); const runner=new Mocha({ui:"tdd",timeout:15000}); for(const file of ["lifecycle.test.js","provider.test.js","generation.test.js","git.integration.test.js","security.test.js"])runner.addFile("out/test/"+file); runner.run(failures=>{process.exitCode=failures?1:0;});'
```

## Development tooling (Phase 5)

The tested baseline is Node 26.13.0 (see .node-version) and pnpm 11.25.0 (packageManager). Install with pnpm install --frozen-lockfile; on exFAT add --node-linker=hoisted. Installation is explicit: running a tool does not reinstall dependencies automatically.

Run pnpm run lint, pnpm run typecheck, pnpm run test:headless, pnpm run compile and pnpm run package. pnpm run test runs the Extension Host with its existing pretest checks; use an isolated workspace/profile for configuration integration tests. Headless tests intentionally skip seven host-only checks. Production bundling does not build a VSIX; full prepublish still requires macOS/Swift.

Phase 5 fixes ARCH-002 and reduces SEC-002 from 57 to seven audit findings, all in development tooling; production audit remains empty. Remaining major-dependent fixes require separate approval. See the [complete Phase 5 report](docs/phase5-toolchain.md) for versions, every advisory/path, validation, platform constraints and the upgrade proposal. Historical phase reports above describe their original validation dates; their lint-script limitation is fixed by this phase.

## Phase 6 release validation

Phase 6 originally found that the declared VS Code 1.80 host lacks global fetch. Phase 6.1 replaces that dependency with a native Node HTTP/HTTPS transport and validates HTTP generation on the unchanged minimum and the current Windows host. See the [BUG-004 compatibility patch](docs/phase61-http-compatibility.md). Remaining Apple/Remote/platform release gates are still open. The Windows test VSIX is explicitly incomplete without the Apple binary. See [release readiness](docs/phase6-readiness.md) and the [proposed release/CI gates](docs/release-plan.md) for measured compatibility, open macOS/Remote checks and security gates.

</details>
