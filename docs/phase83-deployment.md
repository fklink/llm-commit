# Phase 8.3 – Kontrollierter Bereitstellungsplan

Stand: **3. November 2026**. Ausschließlich Vorbereitung. **Keine Branch-Erstellung, kein Staging, Commit, Push, Fetch, Workflow-Dispatch, Tag, PR, Merge oder Release ausgeführt.** Git und GitHub wurden lesend abgefragt. [Exaktes Dateimanifest und Evidenz](phase83-manifest.json), [letzte vollständige Produktvalidierung: Phase 8.2](phase82-packager.md).

**Zur separaten Freigabe vorgeschlagen:** ein neuer Entwicklungsbranch `codex/ci-first-platform-run` vom unten genannten HEAD, ein Konsolidierungscommit der exakt gelisteten Änderungen und ein expliziter Push dieses Branches zu `origin`. **Dieser Push würde den ersten CI-Lauf automatisch auslösen**, sofern Actions und die erforderlichen Runner im Repository zugelassen sind. Keine Freigabe für `main`, PR-/Mergeaktionen oder Veröffentlichung enthalten.

## 1. Tatsächlicher Repositoryzustand

| Merkmal | Lokal nachgewiesener Zustand |
|---|---|
| Aktueller Branch | `main` |
| HEAD | `0a2c0860dea969e3a42f24802c3418c3ea545aab` |
| Letzter Commit | `feat: add Apple Foundation Models as a provider` |
| Lokale Remote-Tracking-Refs | Die lokalen Tracking-Refs und der lesend abgefragte Live-Ref `refs/heads/main` zeigen auf denselben HEAD. |
| Remote / wirksame Push-URL | `origin`, `https://github.com/evertjr/llm-commit.git`; genau eine Push-URL, kein abweichendes pushurl, keine eingebetteten Zugangsdaten |
| Repository laut Manifest | `evertjr/llm-commit`, entspricht der Remote-URL |
| Vorgeschlagener Zielbranch | `codex/ci-first-platform-run`, Name lokal gültig, lokal noch nicht vorhanden; bei der Live-Abfrage ebenfalls nicht vorhanden |
| Index | Leer bezüglich Änderungen: nichts gestagt |
| Konflikte/Operationen | Keine unmerged Indexeinträge, kein laufender Merge/Rebase/Cherry-pick |
| Lokale Hooks | Kein eigener hooksPath, keine aktiven nicht-Sample-Hooks gefunden; vor späterer Ausführung erneut prüfen |
| Push-Konfiguration | Kein Mirror-/Follow-Tags-Wert gesetzt; später trotzdem exakter Ref und `--no-follow-tags`, kein Force-Push |

**Frühere Phasen sind noch nicht in HEAD enthalten.** Zu Beginn: acht geänderte vorhandene Dateien, drei Löschungen, 64 neue Dateien; 83 vorhandene versionierbare Dateien im Arbeitsbaum. Die Änderungen von Phase 1 bis 8.2 liegen als gemeinsamer uncommitteter Stand vor, nicht als getrennte Phasencommits. Es gibt keine weiteren lokalen Entwicklungsbranches. „Keine Mergekonflikte“ bedeutet hier ausdrücklich nicht, dass diese Änderungen bereits zusammengeführt oder veröffentlicht wären.

Phase 8.3 ergänzt diesen Plan und das Manifest, aktualisiert drei Statusdokumente und bereinigt Pfadmetadaten in sieben bereits vorgesehenen Berichten. Da diese drei Dokumente bereits unversioniert waren, steigt der geplante Commitumfang auf **77 Pfade: acht M, 66 A, drei D**. Elf weitere vorhandene HEAD-Dateien bleiben unverändert; daraus ergibt sich ein Zielbaum von 85 vorhandenen Dateien. Das Manifest enthält auch diese unveränderten Voraussetzungen und ihre Hashes. Sein eigener Hash ist wegen Selbstreferenz bewusst null; der Hash der fertigen Manifestdatei wird separat im Abschluss ausgegeben.

### Zuordnung der bereits vorhandenen Änderungen

- Phasen 1–4: Sicherheitsgrenze, SecretStorage-/Origin-/Kontextbindung, Git-Zuordnung/Draftschutz, Provider-/Promptvalidierung und Lifecycle samt Tests; aktuelle Quellen und historische README-/Changelognachweise.
- Phase 5/Kandidat A: ESLint-/Toolchainkorrekturen, Rootmanifest/Lock und zwei gezielte serialize-javascript-Overrides. Die gelöschte `.npmrc` enthielt nur `enable-pre-post-scripts = true`; der Wechsel zur pnpm-Workspacekonfiguration ist im [Phase-5-Bericht](phase5-toolchain.md) dokumentiert.
- Phasen 6–6.3: Node-16-kompatibler HTTP-Transport, HTTPS-/Proxy-/Host-/Packagingprobes und Nachweise. Nicht ausgeführte Plattformen bleiben so gekennzeichnet.
- Phase 7: Vier HTTP-Provider, sichere Ablehnung von `apple`, Entfernung der beiden Swift-Dateien, JavaScript-Prepublish, vollständiges VSIX und Paket-Allowlist.
- Phase 8: CI-Orchestrierung, Versionspins, einmaliger Paketbau, sechs verpflichtende Hostkombinationen, Artefakte und Audit-Gates.
- Phasen 8.1/8.2: unveränderte historische Analyse, dauerhaftes isoliertes VSCE-3.9.2-B1-Upgrade samt eigenen glob-/minimatch-Overrides und vollständiger lokaler Abnahme.

Diese Zuordnung stammt aus Quell-/Test-/Berichtabgleich; ohne Phasencommits ist keine zeilenweise Git-Provenienz nach Phase möglich. Der geplante Commit ist **keine reine Workflowdateiänderung**: Er konsolidiert ausdrücklich alle bereits freigegebenen Produkt-/Test-/Toolingarbeiten bis 8.2.

## 2. Exakter Commitumfang

Kennzeichnung: `A` neu aufnehmen, `M` vorhandenen Inhalt aktualisieren, `D` bereits vorhandene Löschung übernehmen. **Keine Verzeichnis-Globs, kein `git add .`, kein globales `git add -A`.** Die vollständige pathweise Liste folgt; dieselbe Liste steht maschinenlesbar unter `commitChanges` im Manifest. Dokumentation wird zur Nachvollziehbarkeit mit aufgenommen, auch wenn die meisten Berichte keine technische Laufzeitvoraussetzung der CI sind.

### CI-Workflow und Orchestrierung

```text
A .github/ci-config.json
A .github/workflows/ci.yml
A scripts/ci/bootstrap.cjs
A scripts/ci/host.cjs
A scripts/ci/installed-entry.cjs
A scripts/ci/lib.cjs
A scripts/ci/run-hosts.cjs
A scripts/ci/tasks.cjs
```

### Dependency-, Lock- und Toolchain-Dateien

```text
A .github/packager/package.json
A .github/packager/pnpm-lock.yaml
A .github/packager/pnpm-workspace.yaml
A .node-version
D .npmrc
M package.json
M pnpm-lock.yaml
A pnpm-workspace.yaml
```

### Build-, Packaging- und Projektkonfiguration

```text
M .gitignore
M .vscodeignore
M eslint.config.mjs
A scripts/inspect-test-vsix.cjs
A scripts/package-test-vsix.cjs
A scripts/package-validation.cjs
```

### Dokumentation und Nachweise

```text
A AGENTS.md
M CHANGELOG.md
A docs/candidate-a-audit.json
A docs/candidate-a-graph.json
A docs/candidate-a-upgrade.md
A docs/DECISIONS.md
A docs/ISSUES.md
A docs/phase5-audit-after.json
A docs/phase5-audit-before.json
A docs/phase5-toolchain.md
A docs/phase6-audit.json
A docs/phase6-evidence.json
A docs/phase6-packager-audit.json
A docs/phase6-readiness.md
A docs/phase61-evidence.json
A docs/phase61-http-compatibility.md
A docs/phase62-evidence.json
A docs/phase62-platform-runbook.md
A docs/phase62-readiness.md
A docs/phase63-evidence.json
A docs/phase63-platform-acceptance.md
A docs/phase7-evidence.json
A docs/phase7-removal.md
A docs/phase8-ci.md
A docs/phase8-evidence.json
A docs/phase81-evidence.json
A docs/phase81-preparation.md
A docs/phase82-evidence.json
A docs/phase82-packager.md
A docs/phase83-deployment.md
A docs/phase83-manifest.json
A docs/PROJECT_STATUS.md
A docs/release-plan.md
A docs/ROADMAP.md
M README.md
```

### Tests und kontrollierte Plattformprobes

```text
A scripts/ci/ci.test.cjs
A scripts/compatibility-probe.cjs
A scripts/http-node16-regression.cjs
A scripts/installed-platform-suite.cjs
A scripts/package-validation.test.cjs
A scripts/proxy-compatibility-probe.cjs
A scripts/test-headless.cjs
A scripts/tls-transport-probe.cjs
A src/test/generation.test.ts
A src/test/git.integration.test.ts
A src/test/lifecycle.test.ts
A src/test/provider.test.ts
A src/test/security.test.ts
A src/test/transport-fixture.ts
A src/test/transport.test.ts
```

### Produktiver Extension-Code und genehmigte native Löschungen

```text
M src/extension.ts
A src/security.ts
A src/transport.ts
D swift/fm-cli/Package.swift
D swift/fm-cli/Sources/main.swift
```

### Bereits in HEAD enthaltene unveränderte Voraussetzungen

```text
.vscode-test.mjs
.vscode/extensions.json
.vscode/launch.json
.vscode/settings.json
.vscode/tasks.json
LICENSE
images/icon.png
src/test/extension.test.ts
tsconfig.json
vsc-extension-quickstart.md
webpack.config.js
```

Diese Dateien sind Teil des resultierenden Checkout-Baums, benötigen aber kein Staging. Insbesondere ist das PNG ein bereits vorhandenes Produktasset und keine neue Binärdatei.

### Technisch erforderlich gegenüber bewusst mitgeführter Dokumentation

Produktquellen, TypeScript-Tests, Paket-/Buildkonfiguration, die tatsächlich aufgerufenen Runner-/Packaging-Skripte und Locks müssen zusammen bereitgestellt werden. `docs/phase7-evidence.json` ist trotz historischem Namen **eine echte CI-Abhängigkeit**: `tasks.cjs` und `ci.test.cjs` laden daraus die unveränderte Auditbaseline. Diese Datei darf nicht still weggelassen oder als bloß temporäre Ausgabe behandelt werden. README/Changelog/License/Icon sind Paketinhalt.

Andere historische Berichte, Proxy-Sonderprobes, Entwicklungsanleitungen und dieser Bereitstellungsplan sind nicht alle Voraussetzung jedes Jobs. Sie werden bewusst vollständig zur Audit-/Freigabekette mitgeführt. Das Manifest unterscheidet technische Verwendung und Nachvollziehbarkeit. Es löscht oder bereinigt keine früheren Projektdateien.

## 3. Sicherheits- und Artefaktprüfung

**Erfolgreich geprüft, mit begrenzter Aussagekraft:** alle 83 ursprünglichen versionierbaren Dateien, anschließend auch die ergänzten Plandateien und Dokumentationsänderungen. Bestehendes isoliertes Secretlint 10.2.2 mit Recommend-Preset und No-Dotenv-Regel verwendet; keine neue Dependency installiert. Zusätzlich Muster-/Dateinamen-/Binärprüfung und manuelle Prüfung der wenigen Treffer.

- Keine Hinweise auf echte API-/GitHub-/AWS-Schlüssel oder credentialhaltige Remote-URLs. Keine PEM-Private-Key-Blöcke, privaten Zertifikatdateien, SecretStorage-/SQLite-Dateien, Testprofile, VSIX-Archive oder Logdateien im vorgesehenen Dateibestand.
- Mustertreffer: vier ausdrücklich erkennbare Dummywerte/-URL in kontrollierten Tests; ein Fehlalarm durch `jsonwebtoken` mit Versionsnummer in einem Lock-Snapshot. Keine sensiblen Werte in die neue Evidenz kopiert. Secretlint selbst meldete keine Befunde.
- Einzige Binärdatei: bestehendes `images/icon.png` (32.001 Bytes), kein neues Binary. `.vscode/*.json` sind vorhandene Projekt-Tasks/Launch-Einstellungen, keine persönlichen Benutzer- oder Testprofile; keine Zugangsdaten darin gefunden.
- **29.251 ignorierte lokale Dateien**: 16.819 Root-node_modules, 12.408 Packager-node_modules, 22 unter out, zwei unter dist. Keine davon in der Freigabeliste. Kein unerwartetes ignoriertes Top-Level-Artefakt gefunden. `.git`, temporäre Testprofile, TLS-Fixtures und das lokale Prüf-VSIX gehören nicht in den Commit.
- Private Test-CAs/Schlüssel und Hostprofile werden nur über Umgebungsvariablen bzw. getrennte Tempverzeichnisse verwendet; keine Fixtures in Paket-/Git-Bestand eingebettet. Die VSIX-Allowlist ist unverändert und schließt CI, Tests und Berichte aus dem Produktpaket aus.

### Datenschutzkorrektur vor Bereitstellung

Sieben bereits vorgesehene Dateien wurden bereinigt: `docs/candidate-a-upgrade.md`, `docs/phase62-evidence.json`, `docs/phase63-evidence.json`, `docs/phase7-evidence.json`, `docs/phase8-evidence.json`, `docs/phase81-evidence.json` und `docs/phase82-evidence.json`. Neutrale Platzhalter ersetzen persönliche Benutzer-, Temp- und Checkout-Pfade einschließlich der eindeutigen Temp-Laufkennungen. Relative Unterpfade, Werkzeugnamen, Testergebnisse und Auditdaten bleiben erhalten.

Der strukturierte JSON-Vergleich bestätigt ausschließlich Pfadersetzungen in Stringwerten. Die erneute Prüfung umfasst 85 Dateien im Zielbaum, davon 84 Textdateien mit Secretlint ohne Befund, 16 bestandene CI-Tests einschließlich Auditbaseline- und Waiver-Tests sowie 157 geprüfte Links. Manifest-, Hash- und Whitespace-Prüfung waren erfolgreich. Das vollständige Auditobjekt aus Phase 7 ist strukturell identisch. Der neue Dateihash kennzeichnet die redigierte Fassung. Historisch aufgezeichnete Prüfsummen bezeichnen weiterhin den damaligen Validierungsstand. Der feste Windows-Git/OpenSSL-Programmpfad in `scripts/ci/tasks.cjs` ist ein technischer Fallback.

Ein Secretlint-/Musterscan beweist keine vollständige Secretfreiheit. Neue Dateien oder Änderungen nach dieser Prüfung müssen erneut geprüft werden. Vorhandene Dummywerte sind ausschließlich Testdaten; keine kostenpflichtigen Modellanfragen verwendet.

## 4. Lokal geprüfte CI-Voraussetzungen

| Bereich | Befund |
|---|---|
| Trigger | Ungefiltertes `push`, `pull_request`, `workflow_dispatch`; keine Branch-/Pfadfilter |
| Push-Auswirkung | Neuer Branchpush **löst CI aus**, auch ohne PR; spätere Branch-/Main-/Tagpushes sind durch den ungefilterten Trigger nicht ausgenommen |
| Rechte | `contents: read`, übrige Tokenrechte nicht zusätzlich gewährt; Checkout `persist-credentials: false`; keine Secrets/PATs/Marketplace-/OIDC-Rechte verlangt |
| Aktionen | Vier vollständige SHA-Pins aus `.github/ci-config.json`; keine unkontrollierten Action-Tags |
| Toolpins | Node 26.13.0, pnpm 11.25.0; Paketbau/Inspektion 24.22.1; VSCE 3.9.2 mit genau zwei eigenen Overrides |
| Jobs | `windows` auf windows-2025; `linux` auf ubuntu-22.04; `macos` auf macos-15-intel; x64 |
| Matrix | Je 1.80.0 und 1.144.0 verpflichtend; sechs Hostkombinationen |
| Abhängigkeiten | Windows erzeugt Paket; Linux/macOS benötigen `vsix_ready`. Nach erfolgreichem Paketupload dürfen sie trotz späterem Windows-Host-/Auditfehler prüfen; ohne Paket werden sie übersprungen |
| Linux-Display | `dbus-run-session -- xvfb-run -a`, Vorprüfung beider Programme; Basic-SecretStorage ausschließlich Dummybackend, kein OS-Keyring-Nachweis |
| Packaging | Ein geprüftes Windows-VSIX; Hash/Inspektionsbericht weitergeben, auf allen OS tatsächlich installieren; keine erneuten VSIX-Bauten |
| Audits | Projekt-/Produktionsaudit pro OS, separater Packager unter Windows mit --ignore-workspace. Kein Waiver für neue Toolbefunde; Projektakzeptanz spätestens 1. Dezember 2026 oder vor Release, früherer Termin maßgeblich |
| Installation | Frozen-Locks; Packagerinstallation im eigenen Workspace, dabei kein --ignore-workspace, damit die eigenen Overrides gelesen werden |
| Cache | Kein Dependencycache, automatischer pnpm-Cache explizit aus |
| Timeouts | Jobs 45/40/40 Minuten, Hostmatrix 20 Minuten, sonstige Tasks typischerweise fünf Minuten; Bootstrap drei Minuten |
| Artefakte | Ein Paketartefakt plus Reportartefakte je OS/Attempt, 14 Tage; Logs auch bei Fehlern vorgesehen, keine privaten Fixtures/Profildatenbanken |
| Parallelität | Neuere Runs derselben Workflow-/Ref-Gruppe brechen ältere ab; Push und PR können unterschiedliche Ref-Gruppen und zusätzliche Läufe erzeugen |

**Tatsächlich in Phase 8.3 ausgeführt:** actionlint 1.7.12 erfolgreich (optionale Shellcheck/Pyflakes nicht verfügbar), 16 CI-Regressionsprüfungen erfolgreich, Secretlint-/Muster-/Scope-/Dokumentationsprüfungen. Keine erneute Installation, kein Build oder vollständiger Produktsuitenlauf, weil keinerlei Produkt-/Toolingänderung vorgenommen wurde. Der letzte vollständige reale Nachweis bleibt Phase 8.2: 205 Headless / 33 Packaging+CI / je 214 installierte Windows-Hosttests und zusätzliche TLS-Probes; Packager null / Produktion null / Projekt vier, unverändertes Gate lokal bestanden.

### Öffentliche Prüfung und offene Voraussetzungen vor dem Push

Die öffentliche API bestätigt Sichtbarkeit **public**, Defaultbranch `main` und je null sichtbare Workflows und Läufe. Die öffentliche Abfrage der Zielbranchregeln und Rulesets liefert jeweils eine leere Liste. Der Actions-Berechtigungsendpunkt antwortet ohne Authentifizierung mit HTTP 401. Schreibrechte, vollständige wirksame Regeln, Actions-Freigabe und Repositorykontingente bleiben offen. Das offizielle [Runnerinventar](https://github.com/actions/runner-images) führt die drei vorgesehenen Labels. Eine tatsächliche Zuteilung ist erst im Lauf nachweisbar.

Vor der späteren Bereitstellung bleiben folgende Punkte zu bestätigen:

1. Actions ist im Repository und gegebenenfalls übergeordneten Organisations-/Enterpriserichtlinien aktiviert; Workflow nicht deaktiviert. Die vier SHA-gepinnten GitHub-Actions sind zugelassen. Öffentliche [GitHub-Administrationsdokumentation](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository) beschreibt diese Richtlinien.
2. Standard-hosted Runner für Windows/Linux/macOS, erforderliche Images, Parallelitäts-/Minuten-/Speicherkontingente und 14-Tage-Aufbewahrung verfügbar/erlaubt; Netzwerkzugriff auf Node/npm/VS-Code-Downloads und Actions-Artefakte zugelassen. Lokale Pins und früher geprüfte Downloadverfügbarkeit beweisen keine tatsächliche Runnerzuteilung.
3. Berechtigung des Benutzers zur Brancherstellung und zum Push einschließlich Änderung von `.github/workflows/**`; Rulesets/Branchschutz und eventuelle Freigaben/SSO beachten. Vorhandene sichere Authentifizierung verwenden, keine Token im Repository oder Chat ablegen. Workflow-Lauf selbst benötigt keine Modell-/Publishingsecrets.
4. Den geprüften, redigierten Umfang für das öffentliche Repository bestätigen.
5. Für spätere Fork-PRs kann abhängig von Repo-/Org-Richtlinien eine [Maintainerfreigabe](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/approve-runs-from-forks) nötig sein. Der erste vorgeschlagene eigene Branchpush ist kein Fork-PR. Keine Ausweichlösung mit `pull_request_target`, erweiterten Tokenrechten oder TLS-Abschaltung.
6. Live-Remotezustand, Nichtvorhandensein des neuen Zielbranches und unveränderter lokaler HEAD/Manifestumfang müssen nach gesonderter Freigabe vor Schreiboperationen erneut kontrolliert werden. Der lokale `origin/main`-Ref ist kein aktueller GitHub-Nachweis.

## 5. Konkreter späterer Bereitstellungsablauf

**Nur Plan, nicht ausgeführt.** Empfohlen wird ein einzelner Konsolidierungscommit mit folgendem Titel und Inhalt:

```text
ci: consolidate validated HTTP extension and add cross-platform checks

Consolidate the approved security, Git, provider and Node 16 transport work.
Retain four HTTP providers and remove the native Apple integration.
Add regression and installed-VSIX validation with frozen toolchains.
Configure Windows, Linux and macOS checks for VS Code 1.80 and 1.144.
Adopt the approved isolated VSCE 3.9.2 B1 graph and preserve strict audits.
Document validation evidence, remaining risks and deployment boundaries.
```

1. Nach Freigabe zuerst nur lesend lokalen HEAD, Branch/Index, alle Manifesthashes und Remoteziel prüfen; neue oder veränderte Inhalte führen zum Stopp und erneuter Prüfung. Live-Remote dann lesend kontrollieren. Existiert `codex/ci-first-platform-run` bereits, nicht überschreiben oder Force-Push verwenden; neue Entscheidung einholen. Kein automatischer Merge/Rebase mit zwischenzeitlichen Remoteänderungen.
2. Genau vom geprüften HEAD den neuen Branch anlegen, ohne Reset/Clean und unter Erhalt der Arbeitsbaumänderungen. Dies ist eine Git-Schreiboperation und braucht die angefragte Freigabe, löst für sich aber keine CI aus.
3. Ausschließlich die 77 im Manifest genannten Pfade explizit stagen, einschließlich der drei vorhandenen Löschungen. Eine temporäre Pfadliste kann aus `commitChanges[].path` erzeugt werden; jedes Element ist ein geprüfter Literalpfad, keine Verzeichnisfreigabe. Kein blindes Add oder `--force`, keine ignorierten Dateien. Vorher/nachher Index gegen die Liste und den vollständigen geplanten Zielbaum prüfen.
4. `git diff --cached --name-status`, `--check` sowie Inhalt/Dateizahl prüfen. Keine staged Extras oder versehentlichen Teilhunks. Nach Staging Indexblobs erneut auf Geheimnisse prüfen; Git kann Zeilenenden normalisieren. Raw-Datei-SHA-256 im Manifest bindet den geprüften Arbeitsbaum, nicht ungeprüft einen Git-Blob nach CRLF-Konvertierung. Bestehende LF-/CRLF-Warnungen nicht mit einer ungeplanten Konfigurationsänderung „reparieren“.
5. Genau einen Commit mit obigem Inhalt erstellen. Commit-Identität und lokale Signier-/Hookrichtlinien beachten; unerwartete Hookänderungen nicht umgehen. SHA und Tree danach dokumentieren. Kein `--amend`, Tag, Hook-Bypass oder weiterer Produktpatch. Ein lokaler Commit allein löst keine GitHub-Actions-Ausführung aus.
6. **Erster CI-auslösender Schritt:** ausschließlich den neu geprüften Commit/Branch mit folgendem expliziten Ziel pushen:

```text
git push --no-follow-tags --set-upstream origin HEAD:refs/heads/codex/ci-first-platform-run
```

   Ziel: `https://github.com/evertjr/llm-commit.git`, ausschließlich `refs/heads/codex/ci-first-platform-run`; weder `main` noch andere Refs/Tags. Kein Force-Push. **Push und erster automatisch ausgelöster CI-Lauf müssen gemeinsam genehmigt sein.** Nicht als vermeintlich folgenlose Dateibereitstellung behandeln.
7. Run-URL, Commit-SHA, Event `push`, Branch und Attempt erfassen. Vollständigen Lauf beobachten; keinen zusätzlichen Dispatch oder PR erstellen. Manueller `workflow_dispatch` wäre ebenfalls eine schreibende CI-Auslösung und setzt laut [GitHub](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow) außerdem einen Workflow im Defaultbranch voraus. Kein Main-Merge nur zum Starten.

### Nach dem Push tatsächlich prüfen

- Genau genehmigter Commit und erwartete Workflowdatei; keine zweite unbemerkte Ausführung/Änderung. Drei Jobs, tatsächliche Runnerimages/Architekturen und Toolversionen aufzeichnen.
- Sechs verpflichtende Hostkombinationen; Mindesthost 1.80.0 nicht als optional behandeln. Erfolgreiche Installation, echte Git-/Dummy-HTTP-Generierung und TLS-/Lifecycle-Nachweise von bloßem Build/Simulation trennen.
- Paketartefakt samt Manifest/Inhaltsprüfung und identischen VSIX-/Bundlehashes in den Installationsberichten aller Jobs. Der neue Cloud-VSIX-Hash muss nicht dem lokalen Phase-8.2-ZIP entsprechen; entscheidend ist die identische Weitergabe innerhalb desselben Runs.
- Rohaudits und Policyentscheidung: erwartungsgemäß Packager null / Produktion null / Projekt vier unter unveränderten Regeln. Jede neue Meldung, abweichender Pfad, Registryfehler oder abgelaufene Akzeptanz bleibt blockierend.
- Reports/Fehlerlogs für alle OS auch bei Fehlern sichern. Übersprungene Jobs oder fehlende Uploads nicht als bestanden behandeln. Harte Stornos können Diagnosen verhindern; kein erfundener Plattformnachweis.
- Separaten tatsächlichen CI-Abnahmebericht erstellen; produktive Fehler nur dokumentieren und gezielte Folgefreigabe einholen. Kein Marketplace-Release, Tag, Merge oder automatisches Nachbessern. Release-Reife bis dahin weiterhin **7/10, keine Releaseempfehlung**.

## 6. Angefragter Freigabeumfang

Erbeten ist ausschließlich die Freigabe für **Branch `codex/ci-first-platform-run` ab HEAD `0a2c0860dea969e3a42f24802c3418c3ea545aab`, genau einen Commit der 77 Manifestpfade in der redigierten Fassung sowie den expliziten Push dieses Branches zu `origin` und den dadurch automatisch ausgelösten ersten CI-Lauf**. Vorherige Owner-/Policybestätigungen und erneuter Hash-/Remoteabgleich bleiben Bedingungen, keine stillschweigend nachgewiesenen Einstellungen.

Die Freigabe umfasst nicht Main-/PR-/Merge-/Tag-/Releaseaktionen, weitere Änderungen oder Aufweichungen der Sicherheits-/Auditregeln. Bis zur Antwort bleiben alle beschriebenen Git-/GitHub-Schreiboperationen unausgeführt. Die Datenschutzkorrektur betrifft sieben historische Dateien sowie den Plan, das Manifest und die aktuellen Verweise in Projektstatus, Issues und Entscheidungen. Die Liste der 77 Commitpfade bleibt gleich.
