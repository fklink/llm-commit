# Phase 5: tooling and dependency review

Date: 2026-11-01.

Subsequent authorized Candidate A adoption: the current audit has four findings (two moderate, two low), with zero production findings. See [Candidate A acceptance](candidate-a-upgrade.md), including the approved risk-review date and the filesystem-cache platform limitation. Counts below preserve the original Phase 5 baseline. No extension or existing regression-test sources changed. No commits, pushes, releases or Phase 6 work.

## Baseline captured before edits

The working tree already contained the uncommitted Phase 1–4 implementation: CHANGELOG.md, README.md, package.json and src/extension.ts were modified; src/security.ts and the five phase regression files were untracked. These changes were preserved. Copies of package.json, pnpm-lock.yaml, eslint.config.mjs and .npmrc and hashes of all eight source/test files were captured before Phase 5 edits. The original lockfile SHA-256 was FC05DEBB06207E1E46658615477590F850EAC58BFA4CF695E641B57B5235EA18.

| Tool | Initial installed version | Final version |
|---|---|---|
| Node.js | 26.13.0 | unchanged; recorded in .node-version |
| pnpm | 11.25.0 | unchanged; packageManager pin |
| TypeScript | 5.8.3 | unchanged |
| ESLint | 8.57.1 | unchanged, upstream deprecated |
| TypeScript ESLint parser/plugin | 8.38.0 | unchanged |
| webpack / webpack-cli | 5.100.2 / 5.1.4 | unchanged in approved patch |
| @vscode/test-cli / test-electron | 0.0.10 / 2.5.2 | unchanged |
| Mocha | 10.8.2 (transitive) | same version, explicit devDependency |

The TypeScript parser's declared peers support ESLint ^8.57.0 and TypeScript >=4.8.4 <5.9.0; the installed combination satisfies those constraints. Updating TypeScript indiscriminately could leave the parser's supported range. ESLint support migration is proposed separately below.

The original lint command failed because --ext is unsupported with Flat Config. Existing correctness rules were warnings. There was no named typecheck or headless script, and prior headless validation depended on a transitive Mocha installation. The pretest chain compiles tests, builds the extension and runs lint; the regular test command invokes vscode-test. Development and production webpack commands already worked. Swift prepublish uses POSIX shell commands and requires macOS FoundationModels; this is retained.

Initial pnpm exec invocations attempted implicit installs with the default symlink linker, failing on D: exFAT. pnpm 11 no longer reads non-registry installation/script settings from .npmrc. The pre-existing enable-pre-post-scripts setting was therefore moved to pnpm-workspace.yaml. No global settings were edited.

## Implemented tooling corrections

- lint is now eslint src --max-warnings 0. One Flat Config block scopes the existing parser/plugin/rules to TypeScript. curly, eqeqeq and no-throw-literal are errors; naming and semicolon rules remain intact and warnings also fail the command. No source formatting changes were needed.
- typecheck runs tsc --noEmit. test:headless compiles then uses the public Mocha API through scripts/test-headless.cjs. Mocha is an explicit development dependency at the already installed major/version. The serial runner rejects exclusive tests, discovers compiled regression suites and excludes only the existing host-only sample; integration suites explicitly skip themselves without VS Code.
- packageManager pins pnpm@11.25.0, .node-version records the tested Node 26.13.0, and engines.node records the pnpm requirement >=22.13.0. Only Node 26.13.0 was exercised; no claim is made that all allowed Node releases were tested.
- pnpm-workspace.yaml preserves pre/post-script execution and disables automatic dependency installation before tool runs. Install explicitly from the frozen lockfile. The default node linker is unchanged; exFAT users pass --node-linker=hoisted at installation.
- New development scripts, reports and tool-version configuration are excluded through .vscodeignore. No runtime dependency, extension manifest contribution, Swift source, webpack configuration or existing test configuration was changed.

## Dependency changes retained

Targeted update command (no --latest, --force or cross-major overrides):

    pnpm --config.node-linker=hoisted update diff js-yaml minimatch serialize-javascript ajv flatted brace-expansion picomatch fast-uri browserslist glob --depth Infinity --lockfile-only --ignore-scripts

All retained existing-package version changes stay within their previous majors. The additional browserslist data dependency is transitive development tooling. The final lockfile, rather than floating ranges, defines the installation.

| Package | Before | After |
|---|---|---|
| ajv | 6.12.6, 8.17.1 | 6.15.0, 8.20.0 |
| baseline-browser-mapping | not present | 2.11.34 |
| brace-expansion | 1.1.12, 2.0.2 | 1.1.21, 2.1.7 |
| browserslist | 4.25.1 | 4.29.5 |
| caniuse-lite | 1.0.30001727 | 1.0.30001820 |
| diff | 5.2.0 | 5.2.2 |
| electron-to-chromium | 1.5.191 | 1.5.472 |
| fast-uri | 3.0.6 | 3.1.9 |
| flatted | 3.3.3 | 3.4.4 |
| glob | 10.4.5, 7.2.3, 8.1.0 | 10.5.0, 7.2.3, 8.1.0 |
| js-yaml | 4.1.0 | 4.3.2 |
| minimatch | 3.1.2, 5.1.6, 9.0.5 | 3.1.5, 5.1.9, 9.0.9 |
| node-releases | 2.0.19 | 2.0.63 |
| picomatch | 2.3.1 | 2.3.2 |
| update-browserslist-db | 1.1.3 | 1.3.4 |

An intermediate webpack 5.112.2 candidate passed builds and 203 host tests, but inspection identified es-module-lexer 1→2 and ajv-formats 2→3. That candidate was discarded and the original lockfile restored before reapplying only the compatible updates above. The final validated tree keeps webpack 5.100.2; its two low-severity reports are not claimed fixed. No dependency-major upgrade remains in this patch.

## Audit comparison and reachability

Counts are pnpm audit findings, not unique vulnerable packages or executable exploit paths.

| Severity | Before | Final |
|---|---:|---:|
| Critical | 0 | 0 |
| High | 37 | 1 |
| Moderate | 14 | 3 |
| Low | 6 | 3 |
| Total | 57 | 7 |

Both production-only audits report zero dependencies and zero findings: this extension declares no runtime dependencies and bundles its implementation. This is not a guarantee about the safety of build inputs or the generated artifact. All reported paths are development tooling. The full machine-readable before/after snapshots include every affected version, severity, advisory and actual dependency path: [before](phase5-audit-before.json), [after](phase5-audit-after.json). No findings are suppressed or excluded from the final audit.

Prioritized assessment covering all reported packages:

| Priority / packages | Actual dependency route and affected operation | Assessment |
|---|---|---|
| P1 serialize-javascript | mocha (direct and through test-cli); webpack → terser-webpack-plugin; same routes through ts-loader/webpack-cli peers | One high RCE, one moderate CPU exhaustion, one low HTML/script-embedding finding remain. Mocha serializes worker options in parallel mode; our runs are serial. Terser serializes build/cache options. Untrusted objects/options in tooling can matter; model response strings never enter these modules. The HTML embedding condition is absent in the Node extension. Do not treat the remaining high finding as resolved. |
| P2 minimatch / glob | ESLint/eslintrc/config-array/cache/rimraf, TypeScript ESTree, test-cli/c8/Mocha | Existing high ReDoS and glob CLI command-injection findings cleared within their majors. The moderate globparts amplification and glob abort-traversal reports remain. Project patterns are controlled and test-cli does not pass an AbortSignal in inspected calls; no extension HTTP cancellation uses glob. Registry ranges still cover installed majors, so keep the reports open. |
| P2 js-yaml / flatted | ESLint configuration/cache; Mocha YAML options | Reported parser/cache vulnerabilities cleared by same-major updates. Developer-controlled configuration/cache paths, not provider JSON handling. |
| P2 ajv / fast-uri | ESLint/eslintrc and webpack/ts-loader/schema-utils/ajv-formats | Reported schema/URI parser issues cleared by compatible updates. Build/lint schemas and configuration are involved; the extension does not bundle these validators. |
| P2 brace-expansion / picomatch | minimatch/glob and chokidar/readdirp under the test CLI | Reported pattern-processing issues cleared; affects developer file discovery/watch behavior. |
| P2 browserslist | webpack → browserslist | Reported issues cleared together with its browser/release data dependencies. Only build-target resolution is involved. |
| P3 webpack | direct and via ts-loader/webpack-cli peers | Two low buildHttp/HttpUriPlugin SSRF reports remain. webpack.config.js targets node and does not enable experiments.buildHttp/HttpUriPlugin or import HTTP modules. The vulnerable optional feature is not configured here; a fixed parent still needs transitive major review. |
| P3 diff | test-cli → Mocha → diff (also explicit Mocha after the change) | Low patch-parsing/applying DoS report cleared by 5.2.2. Mocha uses diff for assertion reporting; this is separate from Git diff prompt processing. |

Primary advisory references are linked individually below. For the webpack conditions see [userinfo bypass](https://github.com/advisories/GHSA-8fgc-7cc6-rx7x) and [redirect bypass](https://github.com/advisories/GHSA-38r7-794h-5758). [glob CLI's fixed 10.5.0 branch](https://github.com/advisories/GHSA-5j98-mcp5-4vw2) is safe for that particular issue even though the registry's patched_versions field recommends a later major; the final audit clears that finding. See also [ESLint Flat Config flags](https://eslint.org/docs/latest/use/configure/migration-guide#cli-flag-changes) and [pnpm configuration](https://pnpm.io/settings).

## Reproducible commands and actual validation

Use Node 26.13.0 and pnpm 11.25.0 for the exercised baseline. On a filesystem with symlink support:

    pnpm install --frozen-lockfile

On this Windows exFAT checkout, the actual final command is:

    pnpm install --frozen-lockfile --node-linker=hoisted

The initial reinstall additionally used --ignore-scripts and --config.confirmModulesPurge=false. A subsequent ordinary frozen install with the exFAT linker, without --ignore-scripts, succeeded. Repeated installation left the final lockfile hash unchanged: 6B0F58650C3B02EBE1B76FF1168985F05F002AF79D03A130368D42C888872E6E (SHA-256). Do not change the global linker or delete the lockfile. The hoisted layout affects dependency visibility; the runner now explicitly declares its Mocha dependency.

Actual acceptance commands:

| Command / check | Result |
|---|---|
| pnpm install --frozen-lockfile --node-linker=hoisted | Passed, idempotent |
| pnpm run lint | Passed through the regular script |
| pnpm run typecheck | Passed |
| pnpm run compile-tests (also inside headless/pretest) | Passed |
| pnpm run compile (also inside pretest) | Passed |
| pnpm run package | Production build passed |
| pnpm run test:headless | 194 passed, seven host-only tests explicitly pending |
| pnpm run test --config .vscode-test/phase5.config.mjs | 203 passed, zero pending, exit 0 in isolated VS Code 1.144.0 |
| pnpm audit --json | Exit 1 as expected: seven remaining findings |
| pnpm audit --prod --json | Exit 0, zero findings |
| ESLint API coverage and negative probe | All eight TypeScript files covered; curly/eqeqeq/no-throw-literal violations each produce severity 2 |
| Git diff and additional untracked-file whitespace checks | Passed |
| Source/test SHA-256 comparison | All eight existing source/test files unchanged |

The host count comprises 43 Phase 1 security tests, 32 Phase 2 Git tests, 83 Phase 3 provider/configuration tests, 43 Phase 4 lifecycle tests, the existing sample and a temporary bundle-activation smoke test. All keys are dummy values; no paid model requests. The temporary host config and smoke test are ignored validation artifacts. The config uses an explicit installed Code path, temporary workspace/profile/extensions directories, explicit test paths and Mocha TDD/15-second settings. Default project discovery was checked through vscode-test --list-configuration. All host-only Git/configuration tests actually ran.

Tooling/setup problems kept separate from product regressions: the baseline exFAT implicit install failed; one lint run started before installation finished and hit a transient missing file (rerun after completion passed). Initial temporary host-config placement outside the repository failed package resolution; an absolute glob inside a file array was treated literally by this old CLI. Moving the ignored config under .vscode-test and enumerating files resolved both. The regular test CLI now executes successfully on Node 26; the earlier phases' CLI issue was not reproduced in the final install. VS Code emitted existing startup/mutex and shell-deprecation diagnostics; tests exited 0.

## Packaging and platform limits

pnpm run package means the webpack JavaScript production bundle, not a completed VSIX. vscode:prepublish and build:swift remain unchanged; full prepublish cannot run on this Windows host because it requires Swift FoundationModels on supported macOS and POSIX shell commands. The VSIX packager is not a declared tool, and none was downloaded or published. Before an actual release, approve the packager/version, build and include bin/fm-cli on macOS, inspect the VSIX file list, validate minimum VS Code and real Remote/macOS behavior. The declared VS Code minimum and @types/vscode mismatch predate this phase and were not changed. Do not equate passing current-host tests with minimum-version validation.

## Separate proposal requiring approval

SEC-002 is reduced, not fully closed. ARCH-002 is fixed. No major overrides or tooling migrations were applied. Proposed follow-up within a separately approved security/tooling change:

1. Evaluate webpack 5.112.2 with its upstream internal dependency-major changes (es-module-lexer 2, ajv-formats 3). The intermediate candidate passed current regressions, but it is not retained. Repeat the full final acceptance and production-bundle smoke after approval.
2. Evaluate narrowly scoped serialize-javascript 7.1.3 adoption for the Mocha and Terser routes, through parent support where possible. A cross-major override requires explicit approval and worker-option serialization, cache, build and host checks. Merely updating Mocha to 11.7.6 does not fix this: that release still declares serialize-javascript ^6.0.2.
3. Plan parent-compatible ESLint/TypeScript-ESLint and test tooling migration for minimatch >=11.0.1 and glob >=14.0.2. Do not force these globally into consumers expecting majors 3/5/9/10. The current test-cli 0.0.15 still declares glob ^13.0.6 and minimatch ^10.2.5, so updating that parent alone is insufficient. Resolve each consumer's API compatibility or wait for supported backports, then request approval for concrete migration/override choices before applying them.

This is not approval to begin Phase 6. Recommend Phase 6 address the separately authorized release/platform matrix and packaging validation after dependency decisions. Remaining findings must stay visible in audits until actually remedied; no false audit-clean claim.

## Complete initial advisory inventory

The snapshots preserve full paths and patched-version metadata. Each initial registry entry is listed, including multiple version branches of the same advisory.

| Advisory | Initial affected package/version | Severity | Final status |
|---|---|---|---|
| [GHSA-5j98-mcp5-4vw2](https://github.com/advisories/GHSA-5j98-mcp5-4vw2) | glob 10.4.5 | high | cleared |
| [GHSA-73rr-hh4g-fpgx](https://github.com/advisories/GHSA-73rr-hh4g-fpgx) | diff 5.2.0 | low | cleared |
| [GHSA-mh29-5h37-fv8m](https://github.com/advisories/GHSA-mh29-5h37-fv8m) | js-yaml 4.1.0 | moderate | cleared |
| [GHSA-8fgc-7cc6-rx7x](https://github.com/advisories/GHSA-8fgc-7cc6-rx7x) | webpack 5.100.2 | low | remains |
| [GHSA-38r7-794h-5758](https://github.com/advisories/GHSA-38r7-794h-5758) | webpack 5.100.2 | low | remains |
| [GHSA-3ppc-4f35-3m26](https://github.com/advisories/GHSA-3ppc-4f35-3m26) | minimatch 3.1.2 | high | cleared |
| [GHSA-3ppc-4f35-3m26](https://github.com/advisories/GHSA-3ppc-4f35-3m26) | minimatch 5.1.6 | high | cleared |
| [GHSA-3ppc-4f35-3m26](https://github.com/advisories/GHSA-3ppc-4f35-3m26) | minimatch 9.0.5 | high | cleared |
| [GHSA-7r86-cg39-jmmj](https://github.com/advisories/GHSA-7r86-cg39-jmmj) | minimatch 3.1.2 | high | cleared |
| [GHSA-7r86-cg39-jmmj](https://github.com/advisories/GHSA-7r86-cg39-jmmj) | minimatch 5.1.6 | high | cleared |
| [GHSA-7r86-cg39-jmmj](https://github.com/advisories/GHSA-7r86-cg39-jmmj) | minimatch 9.0.5 | high | cleared |
| [GHSA-23c5-xmqv-rm74](https://github.com/advisories/GHSA-23c5-xmqv-rm74) | minimatch 3.1.2 | high | cleared |
| [GHSA-23c5-xmqv-rm74](https://github.com/advisories/GHSA-23c5-xmqv-rm74) | minimatch 5.1.6 | high | cleared |
| [GHSA-23c5-xmqv-rm74](https://github.com/advisories/GHSA-23c5-xmqv-rm74) | minimatch 9.0.5 | high | cleared |
| [GHSA-5c6j-r48x-rmvq](https://github.com/advisories/GHSA-5c6j-r48x-rmvq) | serialize-javascript 6.0.2 | high | remains |
| [GHSA-2g4f-4pwh-qvx6](https://github.com/advisories/GHSA-2g4f-4pwh-qvx6) | ajv 6.12.6 | moderate | cleared |
| [GHSA-2g4f-4pwh-qvx6](https://github.com/advisories/GHSA-2g4f-4pwh-qvx6) | ajv 8.17.1 | moderate | cleared |
| [GHSA-25h7-pfq9-p65f](https://github.com/advisories/GHSA-25h7-pfq9-p65f) | flatted 3.3.3 | high | cleared |
| [GHSA-f886-m6hf-6m8v](https://github.com/advisories/GHSA-f886-m6hf-6m8v) | brace-expansion 1.1.12 | moderate | cleared |
| [GHSA-f886-m6hf-6m8v](https://github.com/advisories/GHSA-f886-m6hf-6m8v) | brace-expansion 2.0.2 | moderate | cleared |
| [GHSA-3v7f-55p6-f55p](https://github.com/advisories/GHSA-3v7f-55p6-f55p) | picomatch 2.3.1 | moderate | cleared |
| [GHSA-c2c7-rcm5-vvqj](https://github.com/advisories/GHSA-c2c7-rcm5-vvqj) | picomatch 2.3.1 | high | cleared |
| [GHSA-qj8w-gfj5-8c6v](https://github.com/advisories/GHSA-qj8w-gfj5-8c6v) | serialize-javascript 6.0.2 | moderate | remains |
| [GHSA-h67p-54hq-rp68](https://github.com/advisories/GHSA-h67p-54hq-rp68) | js-yaml 4.1.0 | moderate | cleared |
| [GHSA-3jxr-9vmj-r5cp](https://github.com/advisories/GHSA-3jxr-9vmj-r5cp) | brace-expansion 2.0.2 | high | cleared |
| [GHSA-3jxr-9vmj-r5cp](https://github.com/advisories/GHSA-3jxr-9vmj-r5cp) | brace-expansion 1.1.12 | high | cleared |
| [GHSA-52cp-r559-cp3m](https://github.com/advisories/GHSA-52cp-r559-cp3m) | js-yaml 4.1.0 | high | cleared |
| [GHSA-v2hh-gcrm-f6hx](https://github.com/advisories/GHSA-v2hh-gcrm-f6hx) | fast-uri 3.0.6 | high | cleared |
| [GHSA-mh99-v99m-4gvg](https://github.com/advisories/GHSA-mh99-v99m-4gvg) | brace-expansion 1.1.12 | high | cleared |
| [GHSA-mh99-v99m-4gvg](https://github.com/advisories/GHSA-mh99-v99m-4gvg) | brace-expansion 2.0.2 | high | cleared |
| [GHSA-7p8r-x3mc-p8w7](https://github.com/advisories/GHSA-7p8r-x3mc-p8w7) | fast-uri 3.0.6 | high | cleared |
| [GHSA-rgw5-rvv9-x895](https://github.com/advisories/GHSA-rgw5-rvv9-x895) | brace-expansion 2.0.2 | high | cleared |
| [GHSA-rgw5-rvv9-x895](https://github.com/advisories/GHSA-rgw5-rvv9-x895) | brace-expansion 1.1.12 | high | cleared |
| [GHSA-5p4m-2wfm-xmqj](https://github.com/advisories/GHSA-5p4m-2wfm-xmqj) | js-yaml 4.1.0 | high | cleared |
| [GHSA-q3j6-qgpj-74h6](https://github.com/advisories/GHSA-q3j6-qgpj-74h6) | fast-uri 3.0.6 | high | cleared |
| [GHSA-v39h-62p7-jpjc](https://github.com/advisories/GHSA-v39h-62p7-jpjc) | fast-uri 3.0.6 | high | cleared |
| [GHSA-c83g-rgw3-j3cx](https://github.com/advisories/GHSA-c83g-rgw3-j3cx) | browserslist 4.25.1 | high | cleared |
| [GHSA-73wf-gq98-2v4g](https://github.com/advisories/GHSA-73wf-gq98-2v4g) | browserslist 4.25.1 | high | cleared |
| [GHSA-f65p-4m7j-42xc](https://github.com/advisories/GHSA-f65p-4m7j-42xc) | fast-uri 3.0.6 | high | cleared |
| [GHSA-jqff-g426-hqxp](https://github.com/advisories/GHSA-jqff-g426-hqxp) | fast-uri 3.0.6 | high | cleared |
| [GHSA-2883-xcg3-v3hh](https://github.com/advisories/GHSA-2883-xcg3-v3hh) | js-yaml 4.1.0 | high | cleared |
| [GHSA-4c8g-83qw-93j6](https://github.com/advisories/GHSA-4c8g-83qw-93j6) | fast-uri 3.0.6 | high | cleared |
| [GHSA-qw65-cvwx-89v3](https://github.com/advisories/GHSA-qw65-cvwx-89v3) | fast-uri 3.0.6 | high | cleared |
| [GHSA-hrr3-gc8f-f4qj](https://github.com/advisories/GHSA-hrr3-gc8f-f4qj) | fast-uri 3.0.6 | moderate | cleared |
| [GHSA-q2hr-2g5m-vwhr](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr) | brace-expansion 1.1.12 | moderate | cleared |
| [GHSA-q2hr-2g5m-vwhr](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr) | brace-expansion 2.0.2 | moderate | cleared |
| [GHSA-qhr7-859c-m2p7](https://github.com/advisories/GHSA-qhr7-859c-m2p7) | brace-expansion 1.1.12 | high | cleared |
| [GHSA-qhr7-859c-m2p7](https://github.com/advisories/GHSA-qhr7-859c-m2p7) | brace-expansion 2.0.2 | high | cleared |
| [GHSA-6j4f-fj2g-mc7p](https://github.com/advisories/GHSA-6j4f-fj2g-mc7p) | brace-expansion 1.1.12 | high | cleared |
| [GHSA-6j4f-fj2g-mc7p](https://github.com/advisories/GHSA-6j4f-fj2g-mc7p) | brace-expansion 2.0.2 | high | cleared |
| [GHSA-rf6f-7fwh-wjgh](https://github.com/advisories/GHSA-rf6f-7fwh-wjgh) | flatted 3.3.3 | high | cleared |
| [GHSA-m5mm-p8h7-m29v](https://github.com/advisories/GHSA-m5mm-p8h7-m29v) | serialize-javascript 6.0.2 | low | remains |
| [GHSA-w74x-v6f9-j3xg](https://github.com/advisories/GHSA-w74x-v6f9-j3xg) | fast-uri 3.0.6 | moderate | cleared |
| [GHSA-xhq7-xmqj-769h](https://github.com/advisories/GHSA-xhq7-xmqj-769h) | fast-uri 3.0.6 | low | cleared |
| [GHSA-333x-w4r6-6crp](https://github.com/advisories/GHSA-333x-w4r6-6crp) | fast-uri 3.0.6 | low | cleared |
| [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) | minimatch 9.0.5, 3.1.2, 5.1.6 | moderate | remains |
| [GHSA-3g3m-2fjr-6pw4](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4) | glob 10.4.5 | moderate | remains |
