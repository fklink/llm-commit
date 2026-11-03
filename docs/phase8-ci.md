# Phase 8 – GitHub-Actions-CI und lokale Validierung

Stand: **2. November 2026**. **CI implementiert und lokal unter Windows validiert; in GitHub Actions nicht ausgeführt.** Keine Commits, Pushes, Tags, Veröffentlichung oder nächste Entwicklungsphase. [Workflow](../.github/workflows/ci.yml), [Versionspins](../.github/ci-config.json), [Evidenz](phase8-evidence.json).

**Release-Reife bleibt 7/10, keine Releaseempfehlung.** Geplante Linux-/macOS-Jobs sind keine erfolgreichen Plattformabnahmen. Das neue Audit-Gate bleibt wegen zweier separat nicht akzeptierter Packagerbefunde ausdrücklich blockierend; es wurde keine Ausnahme oder Dependencykorrektur erfunden.

## 1. Analyse und Implementierungsumfang

Wiederverwendet werden die vorhandenen Lint-/Typecheck-/webpack-/Headlessskripte, die 17 Packagingtests, der vollständige VSIX-Bau und ZIP-Prüfer sowie die installierte Plattform-Suite mit realem Git-/Dummy-HTTP-Probe. Produktive Extension-, Sicherheits-, Git-, Provider-, Prompt-, Transport- und Lifecyclelogik bleiben unverändert. Provider bleiben LM Studio, Ollama, OpenAI und Custom; Minimum `^1.80.0` unverändert.

Neue Dateien:

- `.github/workflows/ci.yml`: drei getrennte Plattformjobs, SHA-gepinnte Actions, schreibgeschützte Repositoryberechtigung, Reports/VSIX-Artefakte.
- `.github/ci-config.json`: exakte Node-/pnpm-/VSCE-/Hostversionen, x64-Matrix, Auditprüfdatum und Actions-SHAs.
- `.github/packager/package.json` und `pnpm-lock.yaml`: isoliertes VSCE 3.6.2, übernommen aus dem bereits geprüften separaten Toolgraph; keine neuen aufgelösten Paketversionen.
- `scripts/ci/bootstrap.cjs`: nur in GitHub Actions zulässige Installation des exakten pnpm, sichere Ermittlung seines tatsächlichen JS-Bins und isolierte Runner-Temp-Verzeichnisse.
- `scripts/ci/lib.cjs`: Shell-freie Prozessaufrufe, Logs/Ergebniscodes, Dateihashes, Audit-Fingerprints, Verzeichnisgrenzen und Paketintegrität.
- `scripts/ci/tasks.cjs`: Vorbereitung, Frozen-Installation, Qualität, einmaliger Paketbau, Audit-Gates, ausgewählte Diagnosen.
- `scripts/ci/host.cjs` und `run-hosts.cjs`: beide verpflichtenden Hostversionen, frische Profile, echte Installation, identischer VSIX-Hash, echter Command und Sammelfehlerstatus.
- `scripts/ci/installed-entry.cjs`: vorhandene Hostsuite plus drei echte TLS-Laborprobes pro eingebettetem Node.
- `scripts/ci/ci.test.cjs`: 16 CI-Sicherheits-/Integritätsregressionen.
- Dieser Bericht und `docs/phase8-evidence.json`.

Bestehende Änderungen: `.vscodeignore` schließt `.github/**` aus; aktuelle Regeln/Status/Issues/Roadmap/Entscheidungen verweisen auf die neue CI. Kein produktiver Quellcode, bestehender Fachtest, Projektmanifest, Projektlock oder Override geändert. Historische Berichte bleiben erhalten.

## 2. Jobmatrix und Abhängigkeiten

| Job | Runner / Architektur | Qualität | Installierte Hosts | Paketstrategie |
|---|---|---|---|---|
| `windows` | `windows-2025`, x64 | Frozen install, Lint, Typen, Entwicklungs-/Produktionsbuild, 205 Headless- und Packaging-/CI-Tests, Audits | 1.80.0 und 1.144.0, beide verpflichtend | Ein vollständiges VSIX einmal bauen, inspizieren, archivieren; dasselbe lokal installieren |
| `linux` | `ubuntu-22.04`, x64 | Eigene Frozen-Installation und alle Qualitätsbefehle, Projekt-/Produktionsaudit | 1.80.0 und 1.144.0 unter `dbus-run-session -- xvfb-run -a` | Ausschließlich dasselbe Windows-VSIX herunterladen und installieren, nicht erneut packen |
| `macos` | `macos-15-intel`, x64 | Eigene Frozen-Installation und alle Qualitätsbefehle, Projekt-/Produktionsaudit | 1.80.0 und 1.144.0 | Dasselbe heruntergeladene VSIX, kein erneutes Packaging |

Damit sind sechs Hostkombinationen konfiguriert. ARM64 ist nicht Teil dieser Matrix. Beide Versionen werden je aktivem Job auch dann versucht, wenn eine davon fehlschlägt; der Gesamtstatus bleibt dann fehlgeschlagen. Keine Mindestversionsprüfung wird mit `continue-on-error` abgeschwächt.

Linux/macOS hängen am bereitgestellten, bereits inhaltlich geprüften Paket. Der Windows-Job exportiert `vsix_ready` nach erfolgreichem Artifact-Upload. Ist dieser Schritt erfolgreich, dürfen Linux/macOS auch dann weiterlaufen, wenn spätere Windows-Host-/Auditprüfungen fehlschlagen. Ohne gültiges Paket bleiben sie übersprungen; der fehlgeschlagene Erzeugerjob verhindert einen grünen Gesamtlauf. Storno wird respektiert, konkurrierende Läufe desselben Refs werden beendet.

## 3. Versionen und nachgewiesene Verfügbarkeit

| Werkzeug | Pin / Verwendung | Tatsächlicher Nachweis |
|---|---|---|
| Entwickler-Node | **26.13.0**, unveränderte `.node-version`, alle drei Qualitätsjobs | Offizielle SHASUM-Datei listet Windows x64, Linux x64, Darwin x64/arm64; lokal Windows ausgeführt |
| pnpm | **11.25.0**, unverändertes `packageManager` | Offizieller Registryeintrag vorhanden, Engine `>=22.13`; lokal Frozen-Installation und Skripte ausgeführt |
| Packaging-/ZIP-Node | **24.22.1**, nur Windows-Paketphase | Bekannte Node-26-/Yauzl-Grenze umgehen, ohne den Reader oder Dependencies zu ändern. Standalone Windows-ZIP SHA-256 geprüft, lokal tatsächlich verwendet |
| VSCE | **3.6.2**, isolierter eingefrorener Toolgraph | Bestehender separater Lockfile übernommen; lokale Frozen-Installation und Paketbau bestanden |
| VS Code | **1.80.0** und **1.144.0** | Offizielle versionsgenaue Downloads für Windows/Linux/Darwin per HEAD erreichbar; lokal beide Windows-Hosts tatsächlich ausgeführt |
| Workflow-Linter | **actionlint 1.7.12**, nur lokale Validierung | Offizielles Release-ZIP gegen dessen SHA-256-Datei geprüft; Workflow-Syntax erfolgreich validiert |

Downloadverfügbarkeit ist **kein** Laufzeitnachweis auf einem GitHub-Runner. Es wird nicht darauf vertraut, dass diese Node-/pnpm-Versionen vorinstalliert sind: `setup-node` installiert die exakte Node-Version, Bootstrap installiert ausschließlich das gepinnte pnpm. Projektprüfungen laufen unter Node 26; nur die Paketphase verwendet Node 24 und wechselt danach zurück. Entwickler-Node und eingebetteter Host-Node werden getrennt erfasst.

Die offiziellen Runnerlabels sind versioniert, aber ihre Images nicht bitweise eingefroren. `ImageOS`, `ImageVersion`, OS, Architektur, tatsächlicher Node/pnpm-Stand und GitHub-Runmetadaten werden archiviert. macOS ist bewusst Intel. Ubuntu 22.04 vermeidet zusätzliche Ubuntu-24-AppArmor-/ältere-Electron-Konflikte; es gibt keine globale Sandbox-/OS-Sicherheitsänderung als Fallback. Fehlen Display-/Buswerkzeuge, schlägt der Job mit Diagnose fehl.

Actions sind auf überprüfte Commit-SHAs gepinnt:

| Action | Release | SHA |
|---|---|---|
| checkout | v7.0.1 | `3d3c42e5aac5ba805825da76410c181273ba90b1` |
| setup-node | v7.1.0 | `949feb2413d6458794dcd2491c4babbbce0c15c1` |
| upload-artifact | v7.0.2 | `cf430e030ddbb5b0abf93d22962f4752f3646cd9` |
| download-artifact | v8.0.2 | `9000827ccba6bdab643e8b6fd33ac0654aef8333` |

Primärquellen: [Node 26 SHASUMS](https://nodejs.org/dist/v26.13.0/SHASUMS256.txt), [Node 24 SHASUMS](https://nodejs.org/dist/v24.22.1/SHASUMS256.txt), [pnpm 11.25.0 Registrydaten](https://registry.npmjs.org/pnpm/11.25.0), [offizielle Runnerimages](https://github.com/actions/runner-images), [VS-Code-Testdokumentation](https://code.visualstudio.com/api/working-with-extensions/testing-extension). Actions-Pins wurden über die offiziellen GitHub-Release-/Tag-APIs aufgelöst; sie sind keine ungeprüften `latest`-Angaben im Workflow.

## 4. Befehle und Paketwiederverwendung

Bootstrap wird ausschließlich auf einem echten Actions-Runner ausgeführt; lokal verbietet er globale Änderungen. Lokale Reproduktion verwendet den bereits vorhandenen pnpm-JS-Einstieg über `LLM_CI_PNPM_CLI`. `LLM_CI_REPORTS` und `LLM_CI_PRIVATE` müssen getrennt und außerhalb des Checkouts liegen.

```text
node scripts/ci/bootstrap.cjs                 # nur GitHub Actions
node scripts/ci/tasks.cjs prepare
node scripts/ci/tasks.cjs install             # pnpm install --frozen-lockfile
node scripts/ci/tasks.cjs quality
node scripts/ci/tasks.cjs install-packager    # isolierter Frozen-Lauf über exakt gepinntes pnpm
node scripts/ci/tasks.cjs package             # unter Node 24.22.1, nur Windows-Erzeuger
node scripts/ci/run-hosts.cjs                 # unter Node 26.13.0
node scripts/ci/tasks.cjs audit --packager    # Windows; andere Jobs ohne --packager
node scripts/ci/tasks.cjs diagnostics
```

`quality` führt `lint`, `typecheck`, `compile`, `package`, `test:headless` sowie `node --test scripts/package-validation.test.cjs scripts/ci/ci.test.cjs` aus. Testkompilierung ist Bestandteil von `test:headless`. Das normale VSCE-Packaging führt den echten Prepublish-Hook erneut aus; mehr als ein Produktionsbuild ist hier beabsichtigt, ein zweiter VSIX-Packlauf nicht.

Windows erzeugt genau ein `llm-commit-ci.vsix` samt Inspektionsbericht. Der vorhandene strenge Prüfer bestätigt acht Archiveinträge, Originalmanifest, Bundlehash, keine native Integration und keinen Fund im begrenzten Credentialmusterscan. Linux/macOS bauen ihr eigenes Produktionsbundle als Qualitätsprüfung; dieses muss nicht bytegleich mit dem Windows-Bundle sein. Installiert wird ausdrücklich das per SHA-256 identische Erzeuger-VSIX. Nach tatsächlicher Installation werden Bundlehash und Manifest nochmals gegen Erzeugerbericht/Checkout geprüft; nur VS-Codes eigene `__metadata` werden beim installierten Manifest ausgeklammert.

Der erhaltene Phase-7-Probe testet echten Git-Index, tatsächlich registrierten installierten Command, eigenen flüchtigen Custom-HTTP-Server und echtes SCM-Feld. Nur die Consent-Antwort für die exakte eigene Dummy-Origin ist simuliert; keine echte Dialog-/Trust-UX-Abnahme behauptet. Drei zusätzliche TLS-Probes pro Host verwenden reale lokale TLS-Sockets und ausdrücklich private Test-CAs, inklusive Hostnamenablehnung und Bodyabbruch; kein Ersatz für System-/Unternehmens-Truststores.

## 5. Audit-Gates und Sicherheitsmaßnahmen

- `permissions: contents: read`, `persist-credentials: false`; `pull_request`, kein `pull_request_target`. Keine modelbezogenen Secrets, PATs, Marketplace-Zugänge, Commit-/Push-/Tag-/Publish-Schritte.
- Gefrorene Projekt- und separate Tool-Lockfiles; keine Projektdependencyänderung. Packager-Lifecycles bei Installation ausgeschaltet, kein ungepinntes `npx`/`dlx`.
- Shell-freie Node-Prozessaufrufe mit Argumentlisten; Windows-Code-CLI direkt über dessen JS-Skript statt unsicherer `.cmd`-Interpolation. Versionen kommen aus der geprüften Konfiguration, nicht aus Workflow-Inputs.
- Ausschließlich Dummy-Zugangsdaten und eigene Testserver. Private Schlüssel/Hostprofile liegen getrennt von den Artefakten; TLS-Prüfung bleibt aktiv. `NODE_TLS_REJECT_UNAUTHORIZED=0` wird als Fehler abgewiesen.
- Nur ausgewählte eigene VS-Code-Logdateien und Ergebnisberichte werden gesammelt; keine Env-Dumps, SecretStorage-/Profile-Datenbanken oder privaten TLS-Dateien.
- Paket- und Reportartefakte 14 Tage aufbewahren; Reports auch bei Fehlern hochladen. Harte Stornos/Runnerausfälle können Diagnoseuploads verhindern. Der VSIX-Artefaktname ist innerhalb desselben Runs fest, damit spätere Jobwiederholungen dasselbe Paket wiederverwenden können.

Projekt-Audit und Produktionsaudit werden getrennt ausgeführt. Nur die **exakt vier bestehenden Projektbefunde** aus der dokumentierten Phase-7-Baseline dürfen vor dem Prüftermin als bestehendes Risiko erkannt werden. Fingerprint enthält Advisory, Paket, Schweregrad, konkrete Versionen, dev/optional/bundled und alle Pfade. Neue/geänderte Befunde, ungültige Registryantworten oder Audit-Infrastrukturfehler blockieren. Rohaudit bleibt sichtbar, der Status heißt ausdrücklich nicht „audit-clean“. Änderungen an tatsächlicher Erreichbarkeit oder nachgewiesene Ausnutzbarkeit erfordern weiterhin menschliche Neubewertung; ein Fingerprint beweist keine Harmlosigkeit.

**Projektakzeptanz endet spätestens am 1. Dezember 2026 oder vor der nächsten Releasefreigabe.** Ab UTC-Datum 2026-12-01 blockiert der Automat die verbleibenden Befunde; eine frühere Releasefreigabe verlangt manuelle Neubewertung. Keine automatische Verlängerung.

**Separater Packager-Audit: zwei mittlere Befunde, keine genehmigte Akzeptanz.** Deshalb bleibt der Windows-Audit-Schritt derzeit rot. Erfolgreiche Tests/Artefakte werden trotzdem archiviert; Linux/macOS dürfen nach bereitgestelltem Paket weiter prüfen. Das ist eine bewusste Sicherheitsgrenze, kein durch `continue-on-error` versteckter Erfolg und keine stillschweigende neue Risikoakzeptanz. Für einen grünen Gesamtlauf ist eine gesonderte Entscheidung über Korrektur oder begrenzte Packager-Risikoakzeptanz nötig.

## 6. Tatsächlich lokal ausgeführt

**Umgebung: Windows x64, kein Actions-Runner.** Lokaler pnpm-Einstieg bereits vorhanden; keine globale Bootstrapinstallation durchgeführt. Auf exFAT wurde einmalig der dokumentierte Hoisted-Flag genutzt. Die neue isolierte Tool-Frozen-Installation bestand, dauerte hier aber 7m29s; dies ist keine Laufzeitmessung eines GitHub-Runners.

| Prüfung | Ergebnis |
|---|---|
| `actionlint 1.7.12` | **Erfolgreich**, Workflow-Syntax/Expressions/Jobbezüge geprüft; optionale Shellcheck-/Pyflakes-Integration mangels Tools deaktiviert |
| Node-Syntax aller neuen CI-Skripte | **Erfolgreich** |
| CI-Sicherheits-/Integritätsregressionen | **Erfolgreich**, 16 Tests: Auditänderungen/-Ablauf/-Fehlerformen, kein Toolwaiver, manipuliertes VSIX, Pfadgrenzen, lokaler Bootstrapguard |
| Frozen-Projektinstallation | **Erfolgreich**, Rootlock unverändert |
| Separater Frozen-Packager | **Erfolgreich**, bestehender VSCE-3.6.2-Graph unverändert übernommen |
| Lint, Typecheck, beide Builds | **Erfolgreich**, über die neuen CI-Tasks |
| Headless | **Erfolgreich**, 205 bestanden / sieben Host-Ausnahmen, mit privaten TLS-Fixtures |
| Packaging-/CI-Tests | 17 Packagingtests und 16 CI-Tests **Erfolgreich**, insgesamt 33 |
| Paketbau und Inspektion | **Erfolgreich**, Node 24.22.1, acht Archiveinträge |
| Neuer Host-Runner Windows Minimum/aktuell | **Erfolgreich**, je 214 Tests, tatsächliche Installation und Git-/HTTP-Command; identischer VSIX-Hash |
| Zusätzliche TLS-Probes im echten Host | **Erfolgreich**, je drei auf Node 16.17.1 und Node 24.22.1 |
| Projekt-/Produktionsaudit | **Erfolgreich ausgeführt**, vier bekannte Befunde / null; Projektentscheidung befristet erkannt |
| Neuer Packager-Audit | **Erfolgreich ausgeführt**, zwei bekannte mittlere; Policy-Gate **Fehlgeschlagen/blockierend**, erwartungsgemäß ohne Akzeptanz |
| Report-/Fehlerdiagnosesammlung | **Erfolgreich** lokal; tatsächliche Artifact-Uploads **Nicht durchgeführt** |
| Git-Diff, Eingabehashes, Scope-/Linkprüfung | Lokal geprüft; Nachweise in der Evidenz |

Die unabhängigen Produkt-Regressionen sind keine neuen Linux-/Mac-Resultate. Die lokal vorhandenen offiziellen Code-Installationen wurden per expliziten lokalen Overrides verwendet; im Workflow lädt der vorhandene Test-Electron-Downloader die exakten Pins. Dessen reale Downloads wurden lokal per HEAD verifiziert, aber der vollständige sechsfach plattformübergreifende Download-/Start-/Installationsweg wurde nicht ausgeführt.

## 7. Nicht ausgeführt und verbleibende Plattformgrenzen

- **GitHub Actions: Nicht durchgeführt.** Kein Runner verfügbar/gestartet, keine Workflowausführung ausgelöst, kein Commit/Push zur Bereitstellung. Es gibt keine GitHub-Run-URL und keine hochgeladenen CI-Artefakte.
- **Linux und macOS: Nicht durchgeführt.** Vorhandene konfigurierte Jobs schließen diese Releasegates noch nicht. Alle Cloudstatus sind geplant, nicht erfolgreich gemessen.
- Linux nutzt unter Xvfb/DBus ausdrücklich `--password-store=basic` ausschließlich für Dummy-Daten im isolierten Testprofil. Das prüft die reale SecretStorage-API, **nicht** einen sicheren OS-Keyring. Kein Produktions-Flag geändert. Native Keyring-/interaktive Trust-Abnahme bleibt zusätzlich offen.
- macOS-Keychain-/GUI-/ältere-Electron-Kompatibilität auf dem konkreten hosted Image ist unbewiesen. Bei Dialog-/Startproblemen muss der Job mit Diagnose fehlschlagen; kein Cloudfallback oder Sicherheitsbypass.
- Keine ARM64-, Remote-SSH-, Container-, WSL- oder Unternehmens-Truststoreabnahme. Keine Apple-Foundation-Models-Funktion oder Swift-/Xcode-Anforderung wieder eingeführt.
- Die Node-26-ZIP-Reader-Grenze bleibt bekannt; der festgelegte Node-24-Paketschritt wurde lokal bestanden.
- SHA-/Versionspins und Hashprovenienz bedeuten keine bitidentischen ZIPs über unabhängige Runs; Timestamp-/Imageunterschiede bleiben möglich. Das transportierte Artefakt innerhalb eines Runs ist hingegen identisch geprüft.

## 8. Bewertung und nächster Schritt

**7/10 bleibt gerechtfertigt:** sichere Produktregressionen, Windows-Minimum/aktueller Host und vollständiges Paket sind real nachgewiesen. Die CI-Konfiguration und lokale Reproduktion verbessern Wiederholbarkeit, erzeugen aber noch keine realen Linux-/Mac-/Remote-Nachweise. Das offene Packager-Gate und fehlende veröffentlichungsbezogene Freigaben bleiben sichtbar. Keine automatische Releaseempfehlung.

Nächste Maßnahme: nach separater Freigabe zur Repositorybereitstellung den Workflow erstmals tatsächlich auf GitHub-hosted Runnern ausführen, alle sechs Hostkombinationen und Artefakte prüfen und parallel die zwei Packagerbefunde ausdrücklich entscheiden. Etwaige produktive Fehler zunächst dokumentieren und separat freigeben; keine ungeplanten Dependency-Upgrades. Phase 8 endet nach Implementierung/lokaler Validierung, nicht mit einer Veröffentlichung.

Die tatsächliche pnpm-Bindatei und ihr globaler Shimordner werden vom Bootstrap ermittelt und über GITHUB_ENV/GITHUB_PATH an Folgeschritte gegeben. Auch der separate Tool-Frozen-Lauf verwendet den direkten gepinnten JS-Einstieg, nicht ein zufälliges vorinstalliertes pnpm. Report-Uploads schließen die VSIX-Datei aus; nur das eigene Paketartefakt trägt das eine wiederverwendete VSIX. Es gibt keinen geplanten Cronlauf oder automatischen Sicherheitsreminder.
