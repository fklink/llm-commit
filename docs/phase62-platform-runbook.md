# Phase 6.2 – Reproduzierbare Plattformabnahme und CI-Vorschlag

Diese Anleitung ist vorbereitet. Linux, macOS und echte Remote-Verbindungen wurden hier **nicht ausgeführt**. Das Fehlen von Hardware wird nicht durch Plattformvariablen oder Testdoubles verdeckt. Ergebnisse müssen OS, Architektur, VS-Code-/Node-Version, Hostort, Paket-SHA und Status enthalten.

## Reale Linux-/Mac-Hostabnahme

Voraussetzungen: Git, passende VS-Code-Binaries einschließlich 1.80.0, Node 24 und vorhandenes pnpm 11.25.0. Linux benötigt einen funktionierenden Desktop/Keyring; Xvfb allein garantiert kein SecretStorage-Backend. Ein bewusst verwendetes alternatives Backend separat ausweisen, niemals als erfolgreicher System-Keyring-Test darstellen. VS Code nicht als root betreiben. Installation nur in isolierte Profile.

1. Projekt unverändert übernehmen, Lockhash erfassen, frozen installieren, lint/typecheck/compile-tests/compile/package und Headless-/Packagingtests ausführen. Auf üblichen Linux-/Mac-Dateisystemen genügt `pnpm install --frozen-lockfile`; `--node-linker=hoisted` war eine lokale exFAT-Anpassung. Keine Lockmigration akzeptieren.
2. Mit dem bereits isoliert geprüften VSCE 3.6.2 ein **Test-VSIX ohne Applebinary** erzeugen: `node scripts/package-test-vsix.cjs <vsce-cli> <artifact-directory>/test.vsix`. Inspektion mit Node 24: `node scripts/inspect-test-vsix.cjs <vsce-cli> <artifact-directory>/test.vsix <artifact-directory>/inspection.json`. Toolchain-Audit separat erfassen. Ein vorhandenes Windows-Testpaket kann ebenfalls mit dokumentiertem SHA übertragen werden.
3. Folgende POSIX-Testumgebung außerhalb des Projekts vorbereiten. `CODE_CLI` bezeichnet den plattformspezifischen CLI-Starter, `CODE_EXE` die echte ausführbare Anwendung für test-electron. Auf macOS beispielsweise die Binary unter `Visual Studio Code.app/Contents/MacOS/Electron`; nicht das `.app`-Verzeichnis.

```sh
export PROJECT="$PWD"
export ARTIFACTS="$(mktemp -d)"
export CODE_CLI="/absolute/path/to/code"
export CODE_EXE="/absolute/path/to/native/code-executable"
export TEST_VSIX="/absolute/path/to/test.vsix"
mkdir -p "$ARTIFACTS/helper" "$ARTIFACTS/workspace" "$ARTIFACTS/profile/User" "$ARTIFACTS/extensions"
git -C "$ARTIFACTS/workspace" init
cat > "$ARTIFACTS/helper/package.json" <<'JSON'
{"name":"phase6-probe","publisher":"local-validation","version":"0.0.1","engines":{"vscode":"^1.80.0"},"main":"main.js","activationEvents":["*"]}
JSON
cat > "$ARTIFACTS/helper/main.js" <<'JS'
exports.activate = context => ({ secrets: context.secrets });
JS
cat > "$ARTIFACTS/profile/User/settings.json" <<'JSON'
{"telemetry.telemetryLevel":"off","update.mode":"none","extensions.autoUpdate":false,"git.openRepositoryInParentFolders":"always"}
JSON
"$CODE_CLI" --install-extension "$TEST_VSIX" --extensions-dir "$ARTIFACTS/extensions" --user-data-dir "$ARTIFACTS/profile" --force
```

4. Eigene kurzlebige TLS-Fixtures bereitstellen (keine fremden privaten Schlüssel übertragen). Beispiel mit OpenSSL und Konfigurationsdatei, ohne System-Truststore zu ändern:

```sh
cat > "$ARTIFACTS/tls.cnf" <<'CONF'
[req]
distinguished_name=dn
x509_extensions=ext
prompt=no
[dn]
CN=127.0.0.1
[ext]
subjectAltName=IP:127.0.0.1
basicConstraints=critical,CA:TRUE
CONF
openssl req -x509 -newkey rsa:2048 -nodes -days 2 -config "$ARTIFACTS/tls.cnf" -keyout "$ARTIFACTS/test-key.pem" -out "$ARTIFACTS/test-cert.pem"
chmod 600 "$ARTIFACTS/test-key.pem"
export LLM_COMMIT_TEST_TLS_KEY="$ARTIFACTS/test-key.pem"
export LLM_COMMIT_TEST_TLS_CERT="$ARTIFACTS/test-cert.pem"
pnpm run test:headless
```

5. Folgenden Launcher als `$ARTIFACTS/run-host.cjs` ablegen; Auflösung der Projektabhängigkeit erfolgt über den tatsächlichen Checkout. Auf Linux bei Bedarf mit vorbereitetem Desktop `xvfb-run -a node "$ARTIFACTS/run-host.cjs"` starten, sonst `node ...`. Für jede VS-Code-Version ein frisches Profil verwenden.

```js
const path = require("node:path");
const fs = require("node:fs");
const { runTests } = require(path.join(process.env.PROJECT, "node_modules/@vscode/test-electron"));
const root = process.env.ARTIFACTS;
runTests({
  vscodeExecutablePath: process.env.CODE_EXE,
  extensionDevelopmentPath: [path.join(root, "helper")],
  extensionTestsPath: path.join(process.env.PROJECT, "scripts/installed-platform-suite.cjs"),
  extensionTestsEnv: {
    LLM_COMMIT_INSTALLED_ROOT: path.join(root, "extensions"),
    LLM_COMMIT_COMPATIBILITY_REPORT: path.join(root, "installed-host.json"),
    LLM_COMMIT_TEST_TLS_KEY: process.env.LLM_COMMIT_TEST_TLS_KEY,
    LLM_COMMIT_TEST_TLS_CERT: process.env.LLM_COMMIT_TEST_TLS_CERT
  },
  launchArgs: [path.join(root, "workspace"), "--user-data-dir", path.join(root, "profile"),
    "--extensions-dir", path.join(root, "extensions"), "--disable-gpu", "--skip-welcome",
    "--skip-release-notes", "--disable-workspace-trust"]
}).catch(() => { process.exitCode = 1; });
```

Erwartet werden 226 bestandene Tests, echte Paketaktivierung, Git-Repository, Helper-SecretStorage, lokales Fixture-HTTP und keine offenen Testfehler. Die deaktivierte Trust-UI ist nur für diese kontrollierten Fixtures vorgesehen. Workspace Trust zusätzlich interaktiv in einem neuen Profil mit nicht vertrauenswürdigem Workspace testen: kein API-Versand, keine Freigabeübernahme. Testberichte dürfen keine Rohschlüssel enthalten.

6. `scripts/proxy-compatibility-probe.cjs` im gleichen isolierten Host als `extensionTestsPath` starten; Report über `LLM_COMMIT_PROXY_REPORT` schreiben. Für den optionalen Tunnel eine zweite Test-CA mit SAN `DNS:phase62.invalid` erzeugen und `LLM_COMMIT_PROXY_TLS_KEY/CERT` setzen. Nur dieser Adapter vertraut ihr ausdrücklich. Ein vollständiger Nachweis der installierten Extension mit Unternehmens-CA verlangt einen separaten realen administrierten Store.
7. Echten lokalen Modellserver anschließend manuell verwenden: Dummy-Diff generieren, bestehenden Entwurf erhalten, während Generierung editieren, abbrechen, Timeout und zwei Repositorys prüfen. Netzwerkfehler, nicht erreichbares Ziel und Dateipfade mit Leerzeichen/Unicode dokumentieren. Reine Fixtures nicht als reale Ollama-/LM-Studio-Inferenz zählen.

## Apple Foundation Models: strikt getrennte Gates

Voraussetzungen: echter Apple-Silicon-Mac, macOS 26+, Swift 6.2+, Apple Intelligence aktiviert, Modell heruntergeladen und tatsächlich verfügbar. Aus der Swift-Manifestplattform folgt keine erfolgreiche Hardware-/Modellprüfung. Intel-HTTP und Apple-Inferenz getrennt behandeln. Die vorhandene Quelle verwendet `SystemLanguageModel.default` und meldet unter anderem `device_not_eligible`, `apple_intelligence_not_enabled` und `model_not_ready`.

Aus dem unveränderten Checkout, jeweils Artefaktverzeichnis außerhalb des Projekts:

```sh
node scripts/validate-apple.cjs "$ARTIFACTS/apple" preflight
node scripts/validate-apple.cjs "$ARTIFACTS/apple" build
node scripts/validate-apple.cjs "$ARTIFACTS/apple" check
node scripts/validate-apple.cjs "$ARTIFACTS/apple" infer
node scripts/validate-apple.cjs "$ARTIFACTS/apple" lifecycle
```

Die Modi bauen inkrementell in einem privaten Scratch-Verzeichnis. `build` prüft Mach-O, Architektur, Bibliotheken, SHA und Ausführungsrecht. `check` verlangt exakt `available`. Erst `infer` führt echte lokale Modellinferenz mit Dummy-Diff aus; protokolliert wird die Antwortlänge. `lifecycle` beendet ausschließlich den selbst gestarteten Prozess, der auf stdin wartet, und wartet auf dessen `close`-Ereignis. **Dies ist kein Nachweis eines Abbruchs während laufender Modellinferenz.** Der Modus `preflight` beendet sich hier auf Windows erwartungsgemäß mit Exit 2. Die Mac-Zweige sind vorbereitet, noch nicht auf einem Mac validiert.

Weitere zwingende manuelle/Hardware-Gates:

- Dummy-Prompt mit Dollarzeichen, Unicode, Mehrzeileninhalt und `--instructions`; sinnvolle nichtleere Antwort, keine unerwartete Promptverfälschung. Antwortqualität menschlich bewerten.
- Während echter laufender Inferenz Benutzerabbruch und Timeout aus der Extension auslösen; CLI-PID vor/nachher erfassen, Prozessende abwarten, keine veraltete SCM-Übernahme, kein hängender Kindprozess. Ein zu schnell beendeter Modelllauf ist kein bewiesener Inferenzabbruch.
- Verfügbares und nicht verfügbares Modell, fehlendes Binary und fehlendes Ausführungsrecht in isolierten Testpaketen kontrolliert prüfen; niemals Systemrechte global verändern.
- `codesign --verify`/`codesign -dv` und Gatekeeper-/Quarantäneverhalten dokumentieren. Hier wird keine Signatur oder Notarisierung erstellt. Verteilungsanforderungen vor Release ausdrücklich entscheiden.
- Native Datei erst nach erfolgreicher Prüfung in einen **gesondert freizugebenden** Packaging-Stagingprozess übernehmen. Die aktuelle Testpaket-Allowlist nimmt kein `bin/fm-cli` an: diesen Schutz nicht eigenständig umgehen. Vollständiges VSIX auf sauberem Mac installieren, Pfade mit Leerzeichen, Ausführungsrechte und reale Generierung prüfen. Ein Swift-Build allein erfüllt diese Integration nicht.

## Remote-Abnahme

SSH, Dev Container und WSL jeweils mit freigegebenem eigenem Ziel prüfen. Im VS-Code-Befehl „Developer: Show Running Extensions“ den tatsächlichen Hostort feststellen und OS/Arch/`remoteName` aufzeichnen. Die aktuelle lokale Windows-Messung `extensionKind=1` beweist keine Remote-Platzierung. Das Manifest erhält in dieser Phase keine neue `extensionKind`-Vorgabe.

- Eigenen Modell-Fixtureserver einmal auf Client und einmal im Remote-Host starten; `127.0.0.1` bezeichnet den tatsächlichen Ausführungsort. Erfolg, kontrolliertes Fehlschlagen und bewusst eingerichtete Portweiterleitung getrennt berichten.
- Dummy-Key lokal autorisieren, Remote verbinden: keine unbeabsichtigte automatische Weitergabe. Andere Zielautorität bei gleichem `remoteName` und neue Remote-Sitzung erfordern neue passende Freigabe. Der Code nutzt deshalb flüchtige Remote-Sitzungskennungen statt persistenter Freigaben allein nach `remoteName`.
- Workspace Trust widerrufen, Workspace-Endpunkt ändern, während Key-Lookup wechseln: kein unerlaubter Request. Aktuelle Unit-Tests simulieren diese Fälle; echte Hosts bleiben ein zusätzliches Gate.
- SecretStorage am tatsächlichen Host prüfen; kein vorausgesetztes Sharing mit Client oder anderem Remoteziel. Apple-CLI muss am tatsächlichen Ausführungsort vorhanden und dort modellberechtigt sein; keine automatische lokale Ausweichausführung behaupten.

## Vorgeschlagene CI-/Release-Architektur (nicht implementiert)

| Job | Reale Umgebung / Matrix | Automatisierbare Gates | Zusätzliche Abnahme |
|---|---|---|---|
| Qualität | Windows x64, Linux x64, macOS arm64; externe Build-Node 24/pnpm 11.25.0 | Frozen install, lint, typecheck, beide Builds, Headless, Packagingtests, Audit, Diff | Auditänderungen bewusst bewerten |
| Installiertes HTTP-VSIX | je OS VS Code 1.80.0 und konkret gepinnte aktuelle Version; Node aus Host messen | Isolierte Installation, 226 Hosttests, TLS/Proxyfixtures, Dateipfade/Bundlehash | Linux Keyring/Desktop; Mindestversion auf aktuellem macOS tatsächlich ausführbar? |
| Architekturen | zusätzliche Linux arm64 / macOS Intel, wenn angeboten | HTTP-/Paketmatrix analog | Keine Architektur aus anderem Runner ableiten |
| Apple | selbst gehosteter Apple-Silicon-Mac mit macOS 26+, Swift 6.2+ | Build, Datei-/Architektur-/Rechteprüfung, `--check`, Dummy-Inferenz, deterministische Prozessbereinigung | Modellbereitstellung, echte Inferenzabbrüche, installierte Integration, Gatekeeper |
| Remote | freigegebener SSH-Host, Dev-Container-Runner, Windows+WSL | Fixtures für Hostort/Loopback/Kontext, soweit sichere UI-Automatisierung möglich | Echte Trust- und Freigabedialoge, Keyring und Hostwechsel |
| Enterprise | verwaltete Testmaschinen, eigener authentifizierter Proxy und CA | Negativ-TLS, CONNECT, Deadline, redigierte Fehler | Systemproxy/PAC, CA-Bereitstellung, Unternehmensrichtlinien |
| Paket-Freigabegate | Download ausschließlich zuvor geprüfter, hashgebundener Artefakte | Bundle-/Native-Hash, Allowlist, Secretcheck, Größenbudget, installierte Smoke-Tests | Native Varianten, Signierung/Notarisierung und befristete Auditakzeptanz separat freigeben |

Einmal bauen, Artefakte mit Compiler-/Lock-/Bundle-/Binaryhash verbinden und auf sauberen Runnern installieren. Windows-/Linux-Pakete dürfen kein dort ausführbar behauptetes Applebinary enthalten; eine macOS-arm64-Variante ist ein Vorschlag, kein bereits implementiertes Releaseverfahren. Ob generisches oder zielplattformspezifisches VSIX ausgeliefert wird, erst nach echter Mac-Abnahme entscheiden. Aktuellen VS-Code-Pin bei jeder Releaseabnahme bewusst aktualisieren, Minimum separat beibehalten. Keine automatischen Secrets, Signierzugänge oder Publishingrechte für diese Validierungsjobs. Kein Workflow und keine neue Releasearchitektur wurden eingerichtet.

Referenzen: [VS Code Netzwerk](https://code.visualstudio.com/docs/setup/network) und [Remote Extensions](https://code.visualstudio.com/api/advanced-topics/remote-extensions) erläutern die unterschiedlichen Host-/Netzwerkebenen; daraus folgt kein pauschaler Nachweis für diese Extension. Maßgeblich bleiben die gemessenen Hostresultate. [Apple Foundation Models](https://developer.apple.com/documentation/foundationmodels) ist die Frameworkreferenz; konkrete Compiler-/OS-Anforderungen hier zusätzlich aus dem vorhandenen Swift-Paket abgelesen.
