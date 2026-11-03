# Phase 8.2 – Packager B1 dauerhaft übernommen

Stand: **3. November 2026**. Genehmigt und umgesetzt wurde ausschließlich B1 aus [Phase 8.1](phase81-preparation.md). **Vollständige lokale Windows-Validierung erfolgreich. Kein Commit, Push, Tag, Workflow-Dispatch, GitHub-Actions-Lauf oder Release.** [Maschinenlesbare Evidenz](phase82-evidence.json).

**Ergebnis:** Der isolierte Packager verwendet VSCE **3.9.2** mit genau zwei eigenen Eltern-Overrides auf glob **14.0.3** und minimatch **11.0.4**. Die beiden bisherigen Packagerbefunde sind behoben, Audit null. Produktionsaudit null; vier bekannte Projektbefunde unter unveränderter befristeter Bewertung. Das **unveränderte Audit-Gate besteht lokal**. Release-Reife bleibt **7/10, keine Releaseempfehlung**: reale Actions-/Linux-/macOS-Nachweise fehlen weiterhin.

## 1. Tatsächlich geänderte Dateien

| Datei | Änderung |
|---|---|
| `.github/packager/package.json` | VSCE exakt 3.9.2 |
| `.github/packager/pnpm-workspace.yaml` – neu | Ausschließlich die zwei freigegebenen Eltern-Overrides im eigenen Toolprojekt |
| `.github/packager/pnpm-lock.yaml` | Bytegenaue Übernahme des abschließend geprüften, engeren B1-Locks |
| `.github/ci-config.json` | VSCE-Pin 3.9.2, übrige Pins unverändert |
| `.github/workflows/ci.yml` | Nur Packager-Stepbezeichnung auf 3.9.2 aktualisiert |
| `scripts/package-test-vsix.cjs` | Versionsguard, Verwendungshinweis und Provenienz auf 3.9.2 |
| `scripts/inspect-test-vsix.cjs` | Diagnose der beibehaltenen Node-26-Sperre aktualisiert: Node 24 weiterhin validierter Pfad, keine unbelegte Aussage zum neuen Reader |
| `scripts/ci/tasks.cjs` | Notwendige Frozen-Installerkorrektur für eigenen Override-Workspace; Audit unverändert |
| `README.md` | Aktuelle Packagerinstallation, Version, getrennte Audit-Anweisung und Berichtlink |
| `AGENTS.md` | Aktuelle Toolpins, eigene Override-/Installationsgrenze und Auditstand |
| `docs/PROJECT_STATUS.md`, `ISSUES.md`, `ROADMAP.md`, `DECISIONS.md` | Aktueller Stand, behobene Toolbefunde, umgesetzte Entscheidung und nächster Freigabeschritt |
| `docs/phase82-packager.md`, `docs/phase82-evidence.json` – neu | Dieser Abschluss und tatsächliche Nachweise |

Keine Änderungen an `src/**`, bestehenden Fachtests, Rootmanifest, Rootlock, Root-Overrides, Mindestversion, Paket-Allowlist, HTTP-/Git-/Sicherheitsarchitektur oder Providerumfang. Frühere Phase-/Auditberichte einschließlich Phase 8.1 bleiben unverändert. 13 zuvor vorhandene Dateien geändert, drei neue Dateien; alle übrigen 67 der 80 erfassten Bestandsdateien unverändert.

## 2. Vorher-/Nachher-Graph und Kandidatenvergleich

| Komponente | Vorher | Nachher |
|---|---|---|
| VSCE | 3.6.2 | **3.9.2** |
| direkter minimatch-Pfad | 3.1.5 | **11.0.4** |
| glob | 11.1.0 | **14.0.3** |
| minimatch unter glob | 10.2.6 | **11.0.4** |
| path-scurry | 2.0.2 | **3.0.0** |
| yauzl | 2.10.0 | **3.4.0** |
| semver | 7.8.5 | **7.8.5**, kein zusätzlicher Wechsel |
| Lock-`packages`-Einträge | 305 | **290** |

Neue Paketidentitäten: `@vscode/vsce@3.9.2`, `glob@14.0.3`, `minimatch@11.0.4`, `path-scurry@3.0.0`, `@isaacs/nonrecursive-glob-match@1.0.3`, `yauzl@3.4.0`. 21 alte Identitäten entfallen; vollständige Liste, Snapshots und aufgelöste Pfade in der Evidenz. Diese transitiven Änderungen entsprechen ausschließlich dem genehmigten B1-Graph. Keine VSCE-4-Migration, zusätzlichen Overrides oder sonstigen Versionswechsel.

Verifizierte Pfade:

```text
. > @vscode/vsce@3.9.2 > glob@14.0.3
. > @vscode/vsce@3.9.2 > minimatch@11.0.4
. > @vscode/vsce@3.9.2 > glob@14.0.3 > minimatch@11.0.4
```

Die installierten Versionen wurden zusätzlich über die tatsächliche Modulauflösung des Packagers geprüft; nicht nur aus dem Manifest abgelesen. Lock-SHA-256 vor/nach Installation und nach allen Tests:

```text
955568ce171e914d1a822bccf7f5ee1892419ee1bc3907af1fcdb027a0de7bb0
```

**Bytegleich zum freigegebenen B1-Kandidaten aus Phase 8.1**, alle 290 Paketidentitäten und der vollständige Lock unverändert. Keine Neuauflösung im Hauptarbeitsbaum nötig. Rootgraph und Root-Kandidat-A-Overrides sind per Vorher-/Nachher-Hashes unverändert.

## 3. Notwendige Abweichung beim Installationsaufruf

Der zunächst unverändert ausgeführte CI-Installer verwendete `--dir .github/packager --ignore-workspace install --frozen-lockfile --ignore-scripts`. Dieser erste reale Lauf ist **Fehlgeschlagen** mit `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`: Das Flag ignoriert auch die neue eigene `pnpm-workspace.yaml` mit den erforderlichen Overrides. Der Fehler wurde vor der Korrektur reproduziert und samt Log/Exitcode erhalten.

Die minimale notwendige Korrektur in `installPackager()` führt dieselbe Frozen-Installation mit **cwd `.github/packager`** und ohne `--ignore-workspace` aus. Dadurch wird ausschließlich dessen eigener Workspace samt zwei Overrides geladen. Der erneute reale Frozen-Lauf war **Erfolgreich**, Lockhash unverändert. Das ist eine Aufrufanpassung zur Einbindung der genehmigten Konfiguration, keine Graphabweichung oder Erweiterung des Upgrades.

Der Audit bleibt ausdrücklich `pnpm --dir .github/packager --ignore-workspace audit --json`, damit der Tool-Lock statt des übergeordneten Projektgraphs auditiert wird. Auditfunktion und Policybibliothek wurden nicht verändert. Produktionsbuild, echter Prepublish, Paketprüfung, Installation und Hosttests behalten ihren Ablauf.

## 4. Tatsächlich ausgeführte Validierung

**Windows x64**; Entwickler-Node **26.13.0**, pnpm **11.25.0**; Paketbau/ZIP-Inspektion **Node 24.22.1**. Frozen-Installationen nutzten ausschließlich lokal das bereits dokumentierte exFAT-Flag `--node-linker=hoisted`, keine globale Linkeränderung. Der Packager installierte mit `--ignore-scripts`.

Die vorhandenen CI-Tasks wurden tatsächlich ausgeführt:

```text
node scripts/ci/tasks.cjs prepare
node scripts/ci/tasks.cjs install
node scripts/ci/tasks.cjs install-packager
node scripts/ci/tasks.cjs quality
node scripts/ci/tasks.cjs package        # Node 24.22.1, PATH für echten Prepublish entsprechend gesetzt
node scripts/ci/run-hosts.cjs            # wieder Node 26.13.0
node scripts/ci/tasks.cjs audit --packager
node scripts/ci/tasks.cjs diagnostics
```

`quality`: `pnpm run lint`, `typecheck`, `compile`, `package`, `test:headless` einschließlich Testkompilierung; anschließend `node --test scripts/package-validation.test.cjs scripts/ci/ci.test.cjs`. Der Paketbau führte den unveränderten echten Hook `npm run vscode:prepublish` → `npm run package` aus. Vorhandene private TLS-Fixtures wurden neu erzeugt.

| Prüfung | Tatsächliches Ergebnis |
|---|---|
| Projekt-Frozen-Installation | **Erfolgreich**, Rootlock unverändert |
| Packager-Frozen-Installation | Erster Aufruf **Fehlgeschlagen**, nach notwendiger Workspacekorrektur **Erfolgreich**, Kandidatenlock unverändert |
| Lint / Typecheck / Entwicklungs-/Produktionsbuild / Testkompilierung | **Erfolgreich**, Exit 0 |
| Headless mit TLS-Fixture | **Erfolgreich**, **205 bestanden**, sieben erwartete Host-Ausnahmen |
| Packaging- und CI-Tests | **Erfolgreich**, **17 + 16 = 33 bestanden** |
| Vollständiges VSIX inklusive Prepublish | **Erfolgreich**, acht Archiveinträge, 55.366 Bytes |
| Archiv-/Inhaltsprüfung | **Erfolgreich**, sechs Runtime-Ressourcen plus zwei Metadaten, originales Manifest und unverändertes Produktionsbundle; keine native Integration, Entwicklungsartefakte oder Fund im begrenzten Credentialmusterscan |
| Installation + Hostsuite VS Code 1.80.0 / Node 16.17.1 | **Erfolgreich**, **214 Tests**, genau das geprüfte VSIX |
| Installation + Hostsuite VS Code 1.144.0 / Node 24.22.1 | **Erfolgreich**, **214 Tests**, dasselbe geprüfte VSIX |
| Git-/HTTP-Generierung | **Erfolgreich** in beiden Hosts: realer gestagter Git-Diff, installierter Command, eigener flüchtiger Dummy-HTTP-Server und echte SCM-Übernahme |
| Consentdialog | **Simuliert**, ausschließlich die Antwort für die exakte eigene Dummy-Origin; keine manuelle Trust-/Consent-UX-Abnahme behauptet |
| Zusätzliche HTTPS-/Hostname-/Bodyabbruch-Probes | **Erfolgreich**, je drei im eingebetteten Node 16 und 24; echte lokale TLS-Sockets, private Test-CA im gekennzeichneten Laboradapter |
| Sicherheits-, Git-, Provider-, Prompt-, HTTP-/Lifecycle-Regressionen | **Erfolgreich** als Bestandteil der bestehenden Headless-/Hostsuiten, keine Assertion entfernt |
| actionlint 1.7.12 / Node-Syntax angepasster Skripte | **Erfolgreich**; optionale Shellcheck-/Pyflakes-Tools nicht vorhanden |
| Git-Diff-/Whitespace-, Dokumentations-/Link-/Scopeprüfung | **Erfolgreich**, Nachweise in der Evidenz |
| GitHub Actions / Linux / macOS | **Nicht durchgeführt**, kein Workflow gestartet oder bereitgestellt |

Die Testhosts verwenden isolierte Profile/Extensionverzeichnisse und nur den SecretStorage-Testhelper als Development-Extension. Die LLM-Extension wurde tatsächlich aus dem VSIX installiert. Die aktuelle gepinnte 1.144.0 stammt aus dem in Phase 8.1 offiziell geladenen isolierten Archiv; keine mehrdeutige automatisch aktualisierte lokale Anwendung verwendet. Nur Dummy-Zugangsdaten und kontrollierte lokale Server, keine kostenpflichtige Modellanfrage und keine TLS-Deaktivierung.

## 5. Audit und Sicherheitsmeldungen

| Graph | Befunde vorher → nachher | Rohaudit / unverändertes Gate |
|---|---|---|
| Isolierter Packager | **2 mittel → 0** | Exit **0**, Gate **bestanden**, keine Akzeptanz benötigt |
| Projektentwicklung | **4 → 4**: zwei niedrig, zwei mittel | Rohaudit Exit **1** bleibt sichtbar; Gate erkennt exakt dieselben befristet bewerteten Fingerprints und besteht |
| Produktion | **0 → 0** | Exit **0**, Gate **bestanden** |

Im Packager behoben: **GHSA-g3hv-75wg-m249** durch minimatch 11.0.4 an beiden Pfaden sowie **GHSA-3g3m-2fjr-6pw4** durch glob 14.0.3. Gleichnamige Meldungen im Projektgraph bleiben offen; das sind andere Abhängigkeitspfade. Keine automatische Risikoakzeptanz oder Befundunterdrückung. `scripts/ci/lib.cjs` und die Auditfunktion in `tasks.cjs` sind unverändert; neue/geänderte Befunde, Auditfehler oder abgelaufene Projektakzeptanz blockieren weiterhin.

Vier bestehende Projektbefunde: webpack zweimal niedrig, minimatch und glob je mittel; konkrete Pfade und unveränderte Erreichbarkeitsbewertung in [Issues](ISSUES.md) sowie den Raw-Audits der Evidenz. Prüftermin bleibt **1. Dezember 2026 oder vor der nächsten Releasefreigabe, je nachdem früher**. Neue Befunde oder nachgewiesene Ausnutzbarkeit sind nicht von der bisherigen Akzeptanz gedeckt.

## 6. Artefakt, Abweichungen und Risiken

VSIX-SHA-256:

```text
7a659ca7305aaba662d1e84841c12a0504e5210702b22c94db85cbc0cc6762e5
```

Produktionsbundle-SHA-256 unverändert gegenüber Phase 8.1:

```text
519dfcc2228c276dd6bce455dfcbb8eb6800c0c488e6d3a64ce19797da371675
```

**Keine Dependency-Abweichung zum B1-Kandidaten.** Der VSIX-Container ist nicht bytegleich zum Experiment: aktuelle README-Packageranleitung und neu erzeugte ZIP-Metadaten; Manifest und Produktionsbundle unverändert. Beide realen Installationen wurden gegen genau den neuen Inspektionshash geprüft. Das Paket befindet sich im lokalen temporären Evidenzverzeichnis, dessen Pfad in der JSON-Evidenz steht; kein dauerhaft garantiertes Cloudarchiv oder veröffentlichter Download.

Die Node-26-Inspektionssperre bleibt bewusst erhalten. Die aktualisierte Fehlermeldung behauptet nicht, der neue Yauzl habe denselben alten Fehler; Node 26 wurde für diesen Paketpfad nicht neu freigegeben. Publishing, Signieren und native Tool-Login-Funktionen wurden nicht getestet und sind nicht Teil der Freigabe. Null Auditbefunde sind kein allgemeiner Sicherheitsbeweis.

Echte Linux-/macOS-, Remote-SSH-/Container-/WSL-, sichere OS-Keyring-/Neustartbeständigkeits- und Enterprise-Truststoreprüfungen bleiben offen. Reale Helper-SecretStorage-Nutzung und private TLS-Labortests ersetzen diese Nachweise nicht. Keine produktive Funktion verändert.

## 7. CI-Bereitstellungsstatus und Empfehlung

Der lokale Packagerblocker ist behoben. Der Workflow ist **lokal validiert, noch nicht bereitgestellt oder in GitHub Actions ausgeführt**. Windows-, Linux- und macOS-Jobs sowie beide verpflichtenden Hostpins bleiben unverändert. Die Workflowdatei selbst änderte ausschließlich eine Stepbezeichnung; die notwendige Installationskorrektur liegt im Taskskript.

Nächster Schritt ist eine **gesonderte konkrete Bereitstellungs- und erste Lauffreigabe**: Zielbranch, geprüfter vollständiger Dateiumfang einschließlich früherer noch uncommitteter Phasen und automatisch durch Push ausgelöster Lauf. Kein blindes Staging. Anschließend alle drei Jobs/sechs Hostkombinationen, Audits, Logs, identische VSIX-Hashes und Installationsnachweise tatsächlich prüfen. Die [Phase-8.1-Anleitung](phase81-preparation.md#5-kontrollierter-erster-github-actions-lauf) bleibt für den kontrollierten Ablauf relevant; deren vorgelagerte B1-Übernahme ist jetzt erledigt. Kein zusätzlicher manueller Dispatch nötig, wenn der Push bereits startet.

Release-Reife unverändert **7/10**: erfolgreicher lokaler Sicherheits-/Produkt-/Paketnachweis und bereinigtes Tooling, aber keine neuen realen Plattformnachweise. **Keine Releaseempfehlung oder Veröffentlichungsfreigabe. Phase 8.2 endet nach lokaler Validierung.**
