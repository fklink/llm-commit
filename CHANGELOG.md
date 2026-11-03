# Change Log

All notable changes to the "llm-commit" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

### Removed

- Remove Apple Foundation Models, the Swift CLI, native child-process execution and native build requirements. Supported providers are LM Studio, Ollama, OpenAI and Custom OpenAI-compatible APIs.
- Reject legacy Apple provider settings with an explicit selection message; never automatically change provider, settings, credentials or network destination.
- Build a complete HTTP-provider VSIX on Windows through the real JavaScript-only prepublish; preserve origin-bound security, Git/draft protection and HTTP cancellation/timeout/shutdown.
- Update regression and packaging validation for the reduced product scope. Historical Apple entries below describe previous versions only.


### Fixed

- Fix BUG-004 on VS Code 1.80 / Node 16 with a narrow native HTTP/HTTPS JSON transport, without new dependencies or a minimum-version change.
- Preserve origin-bound authorization, redirect blocking, verified TLS, streaming cancellation, timeout and existing prompt/draft/request-order guards; add real HTTP/TLS and old-host regressions.

- Exclude compiled tests, redundant builds, lockfiles and local configuration from VSIX test packaging.
- Add strict packaging regression tests, a labeled non-release VSIX workflow, archive checks and an installed-host compatibility probe.
- Document the measured VS Code 1.80 fetch incompatibility without changing the minimum or runtime logic; record open native Apple/Remote release gates.

- Repair the Flat Config lint command, enforce correctness failures and verify TypeScript coverage.
- Add explicit typecheck/headless scripts, a direct Mocha devDependency and Node/pnpm version records.
- Move pnpm 11 script configuration to YAML; keep installation explicit and document frozen/exFAT usage.
- Update compatible development dependencies: reduce audit findings from 57 to 7; retain major-dependent findings for separate approval.
- Preserve all Phase 1–4 sources and regressions; document complete audit evidence and packaging limits.

- Add per-request HTTP timeout and cancellation through response-body reception; reject late cancelled results without touching drafts.
- Add cancellable progress notifications, independent request cleanup and asynchronous extension shutdown.
- Harden Apple CLI stdin/error handling and termination while retaining the 60-second native limit and 1 MiB buffer; await child close during shutdown.
- Add bounded timeoutSeconds configuration (default 120 seconds, 1–600; Apple capped at 60 seconds).
- Add 43 Phase 4 lifecycle regressions, including real local HTTP streams and controlled native children; preserve all Phase 1–3 assertions.

- Resolve provider-specific automatic models without the previous global Qwen default shadowing OpenAI; support provider mappings in the existing model setting while preserving explicit legacy strings.
- Use the Ollama model tag qwen2.5-coder:7b by default.
- Build HTTP and Apple prompts with literal replacement of every diff placeholder and Unicode-safe truncation.
- Validate positive bounded integer diff limits, prompt placeholders, model configurations and Custom URL parameter types before generation.
- Validate HTTP completion JSON, text and finish reasons at runtime, with fixed error messages and no raw-response disclosure.
- Add 80 Phase 3 command regressions and three real configuration-hierarchy tests; preserve all earlier safety and Git tests.

- Resolve the Git repository from SCM/URI context, or an explicit picker when multiple repositories are open.
- Preserve existing and concurrently edited commit drafts; retain generated alternatives in separate unsaved editors.
- Order overlapping requests per repository URI, including fresh Git API wrappers and delayed repository selection.
- Handle repository closure/removal and unavailable input fields without applying stale results; dispose temporary listeners.
- Add 28 Phase 2 regression tests and four real Git integration tests without changing Phase 1 security behavior.

### Security

- Adopt only approved Candidate A: scope Mocha 10 and Terser webpack plugin 5 to serialize-javascript 7.1.3; remove all three related findings (audit 7 → 4, production 0).
- Record actual graph equality with the reviewed candidate, full regression validation and the exFAT filesystem-cache limitation with a successful NTFS check.
- Accept only the four documented remaining findings until December 1, 2026 or the next release approval, whichever comes first; new findings or proven exploitability require reassessment.

- Store API keys in SecretStorage with explicit provider and API-origin binding.
- Require user-controlled Custom-origin authorization, scoped to the execution context; remote approvals last for the extension-host session.
- Restrict external HTTP, block redirects, and require workspace trust for HTTP generation and key management.
- Add fault-tolerant, explicitly confirmed migration of legacy user keys; workspace keys are never sent or automatically migrated.
- Avoid logging transport exceptions or displaying server error bodies that could echo credentials.
- Add dummy-key security regression tests, command-adapter tests and a local redirect test.

## [0.2.0] - 2026-03-26

### Added

- Apple Foundation Models provider — on-device, private, zero configuration (macOS 26+, Apple Silicon)
- Bundled Swift CLI (`fm-cli`) that bridges Apple's FoundationModels framework
- Clear error messages for Apple Intelligence availability states (device not eligible, not enabled, model downloading)
- Platform guard for non-macOS systems selecting the Apple provider

## [0.1.0] - 2025-01-27

### Added

- Initial release of LLM Commit extension
- Generate Git commit messages using OpenAI-compatible APIs
- Support for various API providers (OpenAI, LM Studio, Ollama, LocalAI, etc.)
- Configurable API endpoint, model, and API key
- Customizable prompt template with diff placeholder
- Maximum diff length configuration to prevent overly long requests
- Integration with VS Code Source Control panel
- Progress indication during message generation
- Comprehensive error handling with specific error messages
