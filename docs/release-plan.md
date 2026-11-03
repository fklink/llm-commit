# Phase 6 – Release-/CI-Plan, noch keine Releasefreigabe

Dieser Plan beschreibt die notwendigen Schritte vor einer Veröffentlichung. Er implementiert keine CI/CD- oder Release-Architekturmigration. Produktionslogik, `engines.vscode`, Projektabhängigkeiten und Swift-Releaseprozess bleiben unverändert.

## Kleine, bereits ausgeführte Korrekturen

Die alte VSCE-Dateiliste enthielt `out/test/*.test.js`, weitere `out`-Builds und `pnpm-lock.yaml`. `.vscodeignore` schließt sie jetzt aus. Ein strenger Dateilistenprüfer mit zehn Regressionstests verhindert zusätzliche Entwicklungs-/Secretdateien und unsichere Pfade. Ein separater Testpaket-Script verwendet nur freigegebene Ressourcen und kennzeichnet das Paket ausdrücklich als ohne Apple-Binary und nicht releasefähig.

## Reproduzierbares Testpaket

1. Node 26.13.0 / pnpm 11.25.0 und unveränderte Kandidat-A-Lockdatei verwenden. Auf exFAT: `pnpm install --frozen-lockfile --node-linker=hoisted`.
2. `pnpm run lint`, `pnpm run typecheck`, `pnpm run compile-tests`, `pnpm run compile`, `pnpm run package`, `pnpm run test:headless` ausführen.
3. `node --test scripts/package-validation.test.cjs` ausführen.
4. In einem separaten NTFS-Toolverzeichnis `@vscode/vsce` exakt `3.6.2` installieren und dessen eigene Lockdatei einfrieren. Keine Installation in den Projektgraph und kein ungepinntes `npx`/`dlx latest`.
5. `node scripts/package-test-vsix.cjs <isolierter-vsce-cli> <ausgabe-phase6-test.vsix>` ausführen. Das Script prüft die Toolversion und die echte VSCE-Dateiliste. Die erzeugte temporäre Kopie entfernt nur dort den Swift-Prepublish und ergänzt Displayname/Markierungsdatei. Das Projektmanifest bleibt unverändert.
6. Das Archiv mit `scripts/inspect-test-vsix.cjs <vsce-cli> <test.vsix> <bericht.json>` unter **Node 24** prüfen. Der alte Yauzl-Leser von VSCE 3.6.2 bleibt unter der vorhandenen Node-26-Laufzeit ohne Abschluss stehen; der Prüfer bricht dort bewusst verständlich ab. Der Test verwendete den Node-24.22.1-Modus der installierten Code.exe (`ELECTRON_RUN_AS_NODE=1`), ohne Node global umzubauen. Für eine spätere CI ist ein festgelegter separater Node-24-Tooljob oder ein neu geprüfter Packager vorzusehen.
7. VSIX in frischen Profil-/Extensionverzeichnissen installieren. `scripts/compatibility-probe.cjs` als Extension-Host-Test ausführen; `LLM_COMMIT_COMPATIBILITY_REPORT` setzt den JSON-Ausgabepfad. Ein temporärer Validierungshelfer kann SecretStorage mit genau einem Dummy-Eintrag prüfen und ihn im finally löschen. Keine echten Schlüssel verwenden.
8. Die bisherigen Hosttests gegen die **installierte** Extension ausführen; das Projekt darf nicht zugleich als LLM-Development-Extension geladen werden. Ein temporärer Smoke-Test prüft den tatsächlichen Installationspfad. Erwartung im vorhandenen aktuellen Windows-Host: 203 bestanden.

Der Prozess ist hinsichtlich Versionen, Inhalt und Prüfungen reproduzierbar. Byte-identische VSIX-Builds über verschiedene Verzeichnisse/Rechner wurden nicht nachgewiesen: ZIP-Zeitstempel und webpack-Modulkennungen können variieren. Der konkrete Prüflauf dokumentiert Inhalt, Größe und SHA-256. Ein Testpaket ohne `bin/fm-cli` ist niemals ein vollständiges Apple-Release.

## Mindestversion – gesonderte Produktentscheidung erforderlich

VS Code 1.80.0 wurde tatsächlich ausgeführt: Node 16.17.1, kein globales fetch. Activation, Git-API, AbortController/AbortSignal und eine Dummy-SecretStorage-Probe funktionieren. Die unveränderte produktive HTTP-Funktion ruft globales fetch auf und ist deshalb dort nicht lauffähig. Eine erfolgreiche 1.80-Typprüfung mit den sonstigen Node-18-Entwicklertypen behebt diese Laufzeitlücke nicht.

Bevorzugter Vorschlag bei Erhalt der zugesagten Mindestversion: einen explizit genehmigten Node-16-kompatiblen HTTP-Transport implementieren und dessen Abbruch, Antwortkörper, Redirect-Sperre, Empfängerbindung und Fehlerredaktion in echten 1.80-/aktuellen Hosts erneut prüfen. Ob ein eingebauter http/https-Adapter oder eine zusätzliche Bibliothek sinnvoll ist, bedarf einer getrennten Bewertung/Freigabe. Keine Polyfill- oder Runtime-Abhängigkeit wurde hier eingebaut.

Alternative: nach gesonderter Zustimmung die Mindestversion auf eine **tatsächlich getestete** Hostversion mit verfügbaren APIs anheben und Typen/Testmatrix daran ausrichten. Hier ist nur 1.144.0 erfolgreich nachgewiesen; eine erste geeignete Zwischenversion wird nicht aus der Node-Versionsnummer erraten. `engines.vscode` bleibt `^1.80.0`.

## Geplante CI-/Build-Gates – vor Implementierung abstimmen

| Gate | Geplanter Nachweis | Noch nötige Freigabe/Umgebung |
|---|---|---|
| Source/Tooling | Frozen-Lockdatei, Lint, Typprüfung, Produktionsbuild, 194 Headless-Tests, Packaging-Tests, Projekt- und separater Tool-Audit | Festgelegte Runner und Toolversionen; Projektgraph nicht ungeplant aktualisieren |
| VS-Code-Matrix | deklarierte Mindestversion plus festgelegte aktuelle Version; Linux mit Xvfb, Windows, macOS; installierte VSIX statt nur Source Host | Mindestversionslösung; zusätzliche reale Plattformrunner |
| macOS Apple Silicon | macOS 26+, Swift 6.2+, Framework und Apple Intelligence verfügbar; eigener realer Mac | Zugänglicher geeigneter Mac; kein simuliertes Ergebnis als Inferenznachweis |
| Native Artefakte | aus dem geprüften Swift-Quellstand bauen; `file`, `lipo -info`, `otool -l` und Berechtigungen prüfen; `fm-cli --check` und Dummy-stdin-Probe; Fehler/Abbruch/Timeout/Prozessende real prüfen | Signatur-/Provenienzrichtlinie, Architektur- und Mindest-OS-Prüfung |
| Package | validierte Binary unter `bin/fm-cli`, JavaScript-Bundle, README/Lizenz/Icon; scharfe Allowlist inklusive gezielt erlaubter Binary; keine Tests/Secrets/Dependencies | Vollständiges Paket erst nach Apple-Gate; keine unbegutachteten fremden Binaries kopieren |
| Remote | SSH, Container und WSL: tatsächliche Hostplatzierung, Git-API-Verfügbarkeit, Modellserver-Loopback, SecretStorage und neue Sitzungsfreigabe prüfen | Autorisierte Ziele, Container-Engine bzw. installierte WSL-Umgebung |
| Security/Release | frischer Audit, vier akzeptierte Befunde vor Release neu entscheiden, Packager-Befunde separat bewerten, exakten VSIX-Inhalt/Hash und Installation abnehmen | Ausdrückliche Releasefreigabe; bisherige Risikoakzeptanz genügt nicht |

Zunächst den bestehenden universellen Releaseansatz untersuchen und mit einer aus dem geprüften Quellstand gebauten Apple-Silicon-Binary validieren. Plattformabhängige VSIX-Targets wie `darwin-arm64` sind eine mögliche spätere Strategie, aber eine wesentliche Distributionsänderung und nicht implementiert. Windows-/Linux-HTTP-Tests ersetzen keine Apple-Funktionsprüfung. Auf Intel-Macs/älteren macOS-Versionen darf keine Apple-Kompatibilität behauptet werden.

## Remote-Entscheidungen

Das Manifest legt `extensionKind` nicht explizit fest. Im lokalen installierten Test meldet die Extension `UI` (1). Daraus wird keine Remote-Platzierung abgeleitet. Für eine Git-/Prozess-nahe Extension ist eine explizite Workspace-Präferenz ein zu prüfender Vorschlag; sie verändert Verhalten und benötigt vor Übernahme eine gesonderte Zustimmung und echte Remote-Tests.

Loopback meint immer den tatsächlich ausführenden Host. Bei einem entfernten Workspace-Host müssen LM Studio/Ollama dort erreichbar sein oder ein bewusst eingerichtetes Forwarding existieren. Apple benötigt einen geeigneten **ausführenden** Mac; ein lokaler Mac allein genügt nicht für einen Linux-Remote-Host. Die bestehenden Remote-Autorisierungen sind sitzungsgebunden; sie wurden nicht geändert. Dummy-Tests aus Phase 1 simulieren unterschiedliche Ausführungskontexte, keine echte SSH-/Container-/WSL-Verbindung. SecretStorage-API-Funktion lokal ist kein Nachweis für Schlüsselablage, Synchronisierung oder Neuverbindung auf einem konkreten Remote-Host.

## Versionierung und Freigabecheckliste

- Manifestversion bleibt 0.2.0. Vor einer tatsächlichen Releasefreigabe prüfen, welche Version bereits veröffentlicht ist, und einen expliziten Versions-/Tagplan freigeben lassen.
- Aktueller Arbeitsbaum enthält uncommittete Phasen 1–6; daraus wurde kein signierter/quellenfixierter Release gebaut. Später reproduzierbaren Quellstand und Artefaktprovenienz festlegen. Keine Commits/Tags/Pushes in dieser Phase.
- Mindestversionsblocker beheben oder genehmigt eingrenzen; alle unterstützten Plattformen und Remote-Modi real abnehmen.
- Reale Mac-Inferenz, Binary-Architektur/Mindest-OS/Signatur und ausführbares Dateibit bestätigen. Windows-ZIP-Metadaten nicht als POSIX-/Mac-Berechtigungsnachweis verwenden.
- Den separat getesteten Packager vor Release neu bewerten: sein eigener Audit ist nicht Teil des Projekt-Audits und derzeit ebenfalls nicht leer. Keine stillschweigende Übernahme seiner Risiken.
- Vollständiges VSIX lokal installieren, Paketmanifest/Native-Dateien/Dateiliste/Secretprüfung/Größe/Hash protokollieren und nach Dokumentationsänderungen das finale Artefakt nochmals prüfen.
- Erst danach separate menschliche Releasefreigabe. Keine automatische Veröffentlichung, Tokens oder Marketplace-Pushes im vorgeschlagenen Validierungsworkflow.
