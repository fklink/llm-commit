# Issues und Auditinventar

Stand: 3. November 2026, aktualisiert nach Phase 8.2. [Projektstatus](PROJECT_STATUS.md) · [Roadmap](ROADMAP.md) · [Entscheidungen](DECISIONS.md). Status beruht auf vorhandenen Quell-/Test-/Auditnachweisen, dem frischen Phase-8.2-Audit und den unverändert erhaltenen historischen Berichten.

„Behoben“ gilt jeweils für den angegebenen Implementierungs-/Prüfumfang. „Offen“ kann fehlende Abnahme bedeuten; das ist nicht automatisch ein nachgewiesener Produktfehler. Prüfstatus separat: **Erfolgreich**, **Fehlgeschlagen**, **Simuliert**, **Nicht durchgeführt**. Ursprüngliche Befundkennungen werden erhalten; ergänzende Themen unten bekommen keine erfundenen ursprünglichen Auditnummern.

## Ursprüngliche technische Befunde

| ID | Befund | Tatsächlicher Status | Beleg und verbleibende Grenze |
|---|---|---|---|
| SEC-001 | Workspace-Ziel und Zugangsdaten unsicher kombiniert | **Behoben**, Phase 1 | [SecretStorage/Origin/Trust/Migration](DECISIONS.md#adr-001--secretstorage-empfänger-und-ausführungskontext), [Security-Tests](../src/test/security.test.ts); reale Remote-/Keyringmatrix weiterhin offen |
| SEC-002 | Verwundbare Dependencies | **Teilweise behoben, vier Projektbefunde offen** | 57 → sieben in Phase 5, sieben → vier durch A; Produktionsaudit null. Packager separat, siehe unten |
| BUG-001 | Vorhandene bzw. bearbeitete Entwürfe überschrieben | **Behoben**, Phase 2 | [Generation](../src/test/generation.test.ts), [echte Git-Tests](../src/test/git.integration.test.ts); API-Wertvergleich kann Edit-und-zurück nicht erkennen |
| BUG-002 | Falsches Repository bei mehreren Repositories | **Behoben**, Phase 2 | Kontext/Picker, gleiche ausgewählte Instanz, URI-Identität und Close-Prüfungen; tatsächliche Remote-Git-Abnahme noch offen |
| BUG-003 | Falscher OpenAI-Modelldefault | **Behoben**, Phase 3 | [Providerauflösung](DECISIONS.md#adr-003--providermodelle-in-einer-bestehenden-einstellung), [Provider-Tests](../src/test/provider.test.ts); expliziter Legacy-String bleibt bewusster gemeinsamer Override |
| BUG-004 | HTTP/globales fetch inkompatibel mit Minimum | **Behoben für geprüfte Windows-Hosts**, Phase 6.1 | [Patch](phase61-http-compatibility.md), [Phase 6.3](phase63-platform-acceptance.md); VS Code 1.80/Node 16.17.1 und 1.144/Node 24.22.1 erfolgreich, echte Linux-/Mac-Matrix fehlt |
| BUG-005 | JavaScript-Replacement verändert Diffinhalt | **Behoben**, Phase 3 | Callback-Literalbuilder für die vier HTTP-Provider; gemeinsame Apple-Nutzung nur historisch, Unicode/Mehrfachplatzhalter; bewusste begrenzte Kürzung bleibt |
| BUG-006 | Fehlender kontrollierter HTTP-Abbruch/Lifecycle | **Behoben**, Phase 4 | [Lifecycle-Tests](../src/test/lifecycle.test.ts), native Transportregressionen; Apple-Prozesse in Phase 7 entfernt; HTTP-Abbruch/Deaktivierung weiterhin bestanden |
| BUG-007 | Unzureichende Konfigurations-/Antwortvalidierung | **Behoben**, Phase 3 | Laufzeitvalidierung von Limits/Prompt/Modell/JSON/Text/Finishreason; keine Rohantworten im Fehlerpfad |
| ARCH-001 | Plattformabhängiger Swift-Build/Releaseablauf | **Behoben durch Entfernung**, Phase 7 | Keine native Funktion mehr; Prepublish und vollständiges Vier-Provider-VSIX unter Windows validiert. Dies ist kein bestandener Mac-/Inferenztest |
| ARCH-002 | ESLint Flat Config/Skript-Konflikt | **Behoben**, Phase 5 | [Toolchainbericht](phase5-toolchain.md); aktueller Lint Exit 0 in Phase 6.3, ursprünglicher `--ext`-Fehler historisch |
| ARCH-003 | Fehlende funktionale Tests | **Für Kernpfade behoben**, Plattformdeckung offen | Sicherheits-/Git-/Provider-/Lifecycle-/Transporttests vorhanden; zuletzt 205 Headless + sieben Host-Ausnahmen, je 214 Hosttests; keine vollständige Mac-/Linux-/Remote-Testabdeckung behaupten |

Die Originalkennungen ARCH-001/003 stammen aus der vorgegebenen Master-Roadmap. Deren ursprüngliche Phasennummern entsprechen nicht der später tatsächlich ausgeführten Folge bis 6.3; diese Zuordnung eröffnet keine neue Phase.

## Vier verbleibende Projekt-Auditmeldungen

Letzter frischer Stand: [Phase-8.2-Evidenz](phase82-evidence.json), Feld `audits.project`. Alle Meldungen sind Entwicklungsabhängigkeiten, zwei niedrig/zwei mittel; Produktionsaudit null. Das ist keine automatische Unausnutzbarkeitsbehauptung. Vollständige konkrete Eltern-/Peerpfade sind dort und im [Kandidat-A-Audit](candidate-a-audit.json) enthalten.

| Advisory / Paket / Version | Pfade (Gruppen) | Status, Erreichbarkeit und korrigierter Bereich |
|---|---|---|
| [GHSA-8fgc-7cc6-rx7x](https://github.com/advisories/GHSA-8fgc-7cc6-rx7x), webpack 5.100.2, niedrig | direkt; ts-loader → webpack; webpack-cli sowie @webpack-cli/configtest/info/serve → webpack | **Offen, befristet akzeptiert.** buildHttp/HttpUriPlugin nicht aktiviert; URL-Allowlist-SSRF-Pfad nicht im Build benutzt. Fix ≥5.104.1; unterstützten Eltern-/Transitivwechsel separat prüfen |
| [GHSA-38r7-794h-5758](https://github.com/advisories/GHSA-38r7-794h-5758), webpack 5.100.2, niedrig | dieselben webpack-Pfade | **Offen, befristet akzeptiert.** Build-HTTP-Redirectpfad nicht aktiviert. Fix ≥5.104.0; nicht mit Extension-API-Redirectsperre verwechseln |
| [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249), minimatch 3.1.5/5.1.9/9.0.9, mittel | ESLint/eslintrc/config-array/cache/rimraf/glob; TypeScript-ESTree; test-cli/c8/test-exclude; Mocha/glob | **Offen, befristet akzeptiert.** Muster in der derzeitigen Projekt-/Testkonfiguration kontrolliert; keine konkrete Ausnutzung belegt. Fix ≥11.0.1; breiter Override brach experimentell Coverage, daher Elternmigration statt pauschalem Austausch |
| [GHSA-3g3m-2fjr-6pw4](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4), glob 10.5.0, mittel | @vscode/test-cli 0.0.10 → glob | **Offen, befristet akzeptiert.** Betroffene fortgesetzte Traversierung nach AbortSignal; geprüfter Aufrufer nutzt dieses Budget nicht. Fix ≥14.0.2; separates Upgrade nötig |

**Nächste Sicherheitsprüfung: 1. Dezember 2026 oder vor der nächsten Releasefreigabe, je nachdem früher.** Akzeptanz gilt ausschließlich für diese vier dokumentierten Befunde unter den bisherigen Bedingungen; keine automatische Verlängerung, keine Übertragung auf neue Befunde oder später bewiesene Ausnutzbarkeit. [Genehmigte Kandidat-A-Abnahme](candidate-a-upgrade.md).

Kandidat A behob serialize-javascript/GHSA-5c6j-r48x-rmvq, GHSA-qj8w-gfj5-8c6v und GHSA-m5mm-p8h7-m29v durch exakt 7.1.3 unter Mocha 10 und Terser webpack plugin 5. Kein Kandidat B/C/D übernommen; nicht pauschal alle serialize-/Toolingrisiken als geschlossen darstellen.

## Separate Packaging-Tooling-Befunde

Isoliertes `@vscode/vsce` 3.9.2 ist **nicht** Projektdependency. **Beide früheren Packagerbefunde sind in Phase 8.2 behoben**, neuer isolierter Audit null; siehe [Evidenz](phase82-evidence.json), Feld `audits.isolatedPackager`. Das unveränderte Gate besteht lokal und blockiert weiterhin neue Befunde. Keine Risikoakzeptanz erforderlich oder erteilt. Historische Baseline: [Phase 8.1](phase81-preparation.md) und [Werkzeugaudit](phase6-packager-audit.json). Die gleichnamigen Advisories im Projektgraph bleiben ausdrücklich offen.

| Advisory | Tatsächlicher Toolpfad | Bewertung / Maßnahme |
|---|---|---|
| GHSA-g3hv-75wg-m249, mittel | Früher VSCE → minimatch 3.1.5 sowie VSCE → glob → minimatch 10.2.6; jetzt beide Pfade minimatch 11.0.4 | **Behoben im Packager – Phase 8.2**, Audit null; Projektpfade separat weiter offen |
| GHSA-3g3m-2fjr-6pw4, mittel | Früher VSCE → glob 11.1.0; jetzt VSCE 3.9.2 → glob 14.0.3 | **Behoben im Packager – Phase 8.2**, Audit null; Projektpfad separat weiter offen |

## Ergänzende bekannte Grenzen und offene Prüfpunkte

| Thema | Status / Priorität | Nächster Nachweis bzw. Lösungsvorschlag |
|---|---|---|
| Echte Linux-/macOS-HTTP-/Remote-/Enterprise-Abnahme | **Offen** für zugesagten Umfang | Apple-Foundation-Models-Abnahme entfällt; übrige Umgebungen real bereitstellen und prüfen |
| Früher fehlendes natives vollständiges VSIX | **Erledigt durch Produktumfangsänderung**, Phase 7 | Vollständiges HTTP-VSIX ohne native Funktion gebaut/installiert; keine native Apple-Unterstützung mehr |
| InputBox-Wertvergleich erkennt Edit-und-zurück nicht | **Bekannte API-Grenze**, keine weitere Korrektur freigegeben | API hat keine Edit-Historie; Draftregeln erhalten. Mögliche Vorschau-UX erst separat bewerten |
| Proxyvariablen erst während Sitzung geändert | **Fehlgeschlagen für Proxyverbindung**, bestehende Kompatibilitätsgrenze | Geprüfte Startup-/VS-Code-Konfiguration verwenden; kein genereller Proxydefekt belegt |
| Zusätzliche CA im Node-16-Electron-Run-as-Node-Modus | **Fehlgeschlagen im Labor**, echter Enterprise-Host **Nicht durchgeführt** | Reales Host-/Truststoreverhalten zuerst reproduzieren, TLS nie deaktivieren; [sicherer Folgeplan](phase62-readiness.md) |
| VSCE/Yauzl-ZIP-Inspektion unter Node 26 | **Bekanntes Werkzeugproblem** | Geprüften Node-24-Inspektionsjob nutzen; bestehende Sperre erhalten, Packagerupdate nur separat |
| webpack-Dateicache im exFAT/Hoisted-Checkout | **Bekannte Plattformgrenze** | EINVAL bei Verzeichnissnapshots; regulärer Projektbuild nutzt diesen Zusatzcache nicht. Kalter/warmer NTFS-Lauf bestanden; [A-Bericht](candidate-a-upgrade.md), keine generelle exFAT-Cachezusage |
| Modaler Consent/Git-/SecretStorage-Aufruf nicht zwangsweise abbrechbar | **Bekannte API-Grenze** | Nicht mehr warten, späten Dispatch/Ergebnis verhindern; Dialog kann offen bleiben, serverseitige Arbeit nicht rückgängig machbar |
| WSL-Diagnoseprozess beendet sich nicht zeitnah | **Umgebungs-/Werkzeugproblem** | Zehnsekunden-Diagnose beendet; stderr meldet nicht installiert. Kein Produktfehler, kein WSL eigenständig installieren |
| Historische Dokumentationsabweichungen/Evidenzarchiv | **Eingeordnet, Roharchiv weiterhin offen** | [Statusabgleich](PROJECT_STATUS.md), alte Berichte erhalten, vor Release dauerhafte Provenienz/Logs bereitstellen |

## Vollständiges historisches Advisoryinventar

Die folgende Tabelle überführt **alle 57 Registry-Datensätze** des ursprünglichen [Phase-5-Audits](phase5-audit-before.json). Mehrere Versionszweige desselben Advisory bleiben getrennte Datensätze; Zeilenzahl ist nicht die Anzahl eindeutiger Pakete oder ausnutzbarer Pfade. Status ist gegen [Phase 5 danach](phase5-audit-after.json), [Kandidat A](candidate-a-audit.json) und [Phase 6.3](phase63-evidence.json) abgeglichen. Behobene Meldungen bleiben sichtbar, werden nicht als aktuelle Restbefunde gezählt. Ursprüngliche vollständige Pfade und Korrekturbereiche bleiben in den verlinkten Audit-JSONs erhalten.

| Registry-ID | Advisory | Paket / damalige Version(en) | Damaliger Schweregrad | Heutiger Status |
|---|---|---|---|---|
| 1109842 | [GHSA-5j98-mcp5-4vw2](https://github.com/advisories/GHSA-5j98-mcp5-4vw2) | glob 10.4.5 | high | **Behoben – Phase 5**, kompatible Toolchainupdates |
| 1112705 | [GHSA-73rr-hh4g-fpgx](https://github.com/advisories/GHSA-73rr-hh4g-fpgx) | diff 5.2.0 | low | **Behoben – Phase 5**, kompatible Toolchainupdates |
| 1112715 | [GHSA-mh29-5h37-fv8m](https://github.com/advisories/GHSA-mh29-5h37-fv8m) | js-yaml 4.1.0 | moderate | **Behoben – Phase 5**, kompatible Toolchainupdates |
| 1113041 | [GHSA-8fgc-7cc6-rx7x](https://github.com/advisories/GHSA-8fgc-7cc6-rx7x) | webpack 5.100.2 | low | **Offen**; aktuell 5.100.2, befristet akzeptiert |
| 1113042 | [GHSA-38r7-794h-5758](https://github.com/advisories/GHSA-38r7-794h-5758) | webpack 5.100.2 | low | **Offen**; aktuell 5.100.2, befristet akzeptiert |
| 1113459 | [GHSA-3ppc-4f35-3m26](https://github.com/advisories/GHSA-3ppc-4f35-3m26) | minimatch 3.1.2 | high | **Behoben – Phase 5**, kompatible Toolchainupdates |
| 1113461 | [GHSA-3ppc-4f35-3m26](https://github.com/advisories/GHSA-3ppc-4f35-3m26) | minimatch 5.1.6 | high | **Behoben – Phase 5**, kompatible Toolchainupdates |
| 1113465 | [GHSA-3ppc-4f35-3m26](https://github.com/advisories/GHSA-3ppc-4f35-3m26) | minimatch 9.0.5 | high | **Behoben – Phase 5**, kompatible Toolchainupdates |
| 1113538 | [GHSA-7r86-cg39-jmmj](https://github.com/advisories/GHSA-7r86-cg39-jmmj) | minimatch 3.1.2 | high | **Behoben – Phase 5**, kompatible Toolchainupdates |
| 1113540 | [GHSA-7r86-cg39-jmmj](https://github.com/advisories/GHSA-7r86-cg39-jmmj) | minimatch 5.1.6 | high | **Behoben – Phase 5**, kompatible Toolchainupdates |
| 1113544 | [GHSA-7r86-cg39-jmmj](https://github.com/advisories/GHSA-7r86-cg39-jmmj) | minimatch 9.0.5 | high | **Behoben – Phase 5**, kompatible Toolchainupdates |
| 1113546 | [GHSA-23c5-xmqv-rm74](https://github.com/advisories/GHSA-23c5-xmqv-rm74) | minimatch 3.1.2 | high | **Behoben – Phase 5**, kompatible Toolchainupdates |
| 1113548 | [GHSA-23c5-xmqv-rm74](https://github.com/advisories/GHSA-23c5-xmqv-rm74) | minimatch 5.1.6 | high | **Behoben – Phase 5**, kompatible Toolchainupdates |
| 1113552 | [GHSA-23c5-xmqv-rm74](https://github.com/advisories/GHSA-23c5-xmqv-rm74) | minimatch 9.0.5 | high | **Behoben – Phase 5**, kompatible Toolchainupdates |
| 1113686 | [GHSA-5c6j-r48x-rmvq](https://github.com/advisories/GHSA-5c6j-r48x-rmvq) | serialize-javascript 6.0.2 | high | **Behoben – Kandidat A**, serialize-javascript 7.1.3 |
| 1113714 | [GHSA-2g4f-4pwh-qvx6](https://github.com/advisories/GHSA-2g4f-4pwh-qvx6) | ajv 6.12.6 | moderate | **Behoben – Phase 5**, kompatible Toolchainupdates |
| 1113715 | [GHSA-2g4f-4pwh-qvx6](https://github.com/advisories/GHSA-2g4f-4pwh-qvx6) | ajv 8.17.1 | moderate | **Behoben – Phase 5**, kompatible Toolchainupdates |
| 1114526 | [GHSA-25h7-pfq9-p65f](https://github.com/advisories/GHSA-25h7-pfq9-p65f) | flatted 3.3.3 | high | **Behoben – Phase 5**, kompatible Toolchainupdates |
| 1115540 | [GHSA-f886-m6hf-6m8v](https://github.com/advisories/GHSA-f886-m6hf-6m8v) | brace-expansion 1.1.12 | moderate | **Behoben – Phase 5**, kompatible Toolchainupdates |
| 1115541 | [GHSA-f886-m6hf-6m8v](https://github.com/advisories/GHSA-f886-m6hf-6m8v) | brace-expansion 2.0.2 | moderate | **Behoben – Phase 5**, kompatible Toolchainupdates |
| 1115549 | [GHSA-3v7f-55p6-f55p](https://github.com/advisories/GHSA-3v7f-55p6-f55p) | picomatch 2.3.1 | moderate | **Behoben – Phase 5**, kompatible Toolchainupdates |
| 1115552 | [GHSA-c2c7-rcm5-vvqj](https://github.com/advisories/GHSA-c2c7-rcm5-vvqj) | picomatch 2.3.1 | high | **Behoben – Phase 5**, kompatible Toolchainupdates |
| 1119440 | [GHSA-qj8w-gfj5-8c6v](https://github.com/advisories/GHSA-qj8w-gfj5-8c6v) | serialize-javascript 6.0.2 | moderate | **Behoben – Kandidat A**, serialize-javascript 7.1.3 |
| 1121860 | [GHSA-h67p-54hq-rp68](https://github.com/advisories/GHSA-h67p-54hq-rp68) | js-yaml 4.1.0 | moderate | **Behoben – Phase 5**, kompatible Toolchainupdates |
| 1123896 | [GHSA-3jxr-9vmj-r5cp](https://github.com/advisories/GHSA-3jxr-9vmj-r5cp) | brace-expansion 2.0.2 | high | **Behoben – Phase 5**, kompatible Toolchainupdates |
| 1123897 | [GHSA-3jxr-9vmj-r5cp](https://github.com/advisories/GHSA-3jxr-9vmj-r5cp) | brace-expansion 1.1.12 | high | **Behoben – Phase 5**, kompatible Toolchainupdates |
| 1123911 | [GHSA-52cp-r559-cp3m](https://github.com/advisories/GHSA-52cp-r559-cp3m) | js-yaml 4.1.0 | high | **Behoben – Phase 5**, kompatible Toolchainupdates |
| 1124064 | [GHSA-v2hh-gcrm-f6hx](https://github.com/advisories/GHSA-v2hh-gcrm-f6hx) | fast-uri 3.0.6 | high | **Behoben – Phase 5**, kompatible Toolchainupdates |
| 1130588 | [GHSA-mh99-v99m-4gvg](https://github.com/advisories/GHSA-mh99-v99m-4gvg) | brace-expansion 1.1.12 | high | **Behoben – Phase 5**, kompatible Toolchainupdates |
| 1130589 | [GHSA-mh99-v99m-4gvg](https://github.com/advisories/GHSA-mh99-v99m-4gvg) | brace-expansion 2.0.2 | high | **Behoben – Phase 5**, kompatible Toolchainupdates |
| 1130720 | [GHSA-7p8r-x3mc-p8w7](https://github.com/advisories/GHSA-7p8r-x3mc-p8w7) | fast-uri 3.0.6 | high | **Behoben – Phase 5**, kompatible Toolchainupdates |
| 1130736 | [GHSA-rgw5-rvv9-x895](https://github.com/advisories/GHSA-rgw5-rvv9-x895) | brace-expansion 2.0.2 | high | **Behoben – Phase 5**, kompatible Toolchainupdates |
| 1130737 | [GHSA-rgw5-rvv9-x895](https://github.com/advisories/GHSA-rgw5-rvv9-x895) | brace-expansion 1.1.12 | high | **Behoben – Phase 5**, kompatible Toolchainupdates |
| 1138115 | [GHSA-5p4m-2wfm-xmqj](https://github.com/advisories/GHSA-5p4m-2wfm-xmqj) | js-yaml 4.1.0 | high | **Behoben – Phase 5**, kompatible Toolchainupdates |
| 1145559 | [GHSA-q3j6-qgpj-74h6](https://github.com/advisories/GHSA-q3j6-qgpj-74h6) | fast-uri 3.0.6 | high | **Behoben – Phase 5**, kompatible Toolchainupdates |
| 1153168 | [GHSA-v39h-62p7-jpjc](https://github.com/advisories/GHSA-v39h-62p7-jpjc) | fast-uri 3.0.6 | high | **Behoben – Phase 5**, kompatible Toolchainupdates |
| 1153171 | [GHSA-c83g-rgw3-j3cx](https://github.com/advisories/GHSA-c83g-rgw3-j3cx) | browserslist 4.25.1 | high | **Behoben – Phase 5**, kompatible Toolchainupdates |
| 1153172 | [GHSA-73wf-gq98-2v4g](https://github.com/advisories/GHSA-73wf-gq98-2v4g) | browserslist 4.25.1 | high | **Behoben – Phase 5**, kompatible Toolchainupdates |
| 1158524 | [GHSA-f65p-4m7j-42xc](https://github.com/advisories/GHSA-f65p-4m7j-42xc) | fast-uri 3.0.6 | high | **Behoben – Phase 5**, kompatible Toolchainupdates |
| 1158530 | [GHSA-jqff-g426-hqxp](https://github.com/advisories/GHSA-jqff-g426-hqxp) | fast-uri 3.0.6 | high | **Behoben – Phase 5**, kompatible Toolchainupdates |
| 1193727 | [GHSA-2883-xcg3-v3hh](https://github.com/advisories/GHSA-2883-xcg3-v3hh) | js-yaml 4.1.0 | high | **Behoben – Phase 5**, kompatible Toolchainupdates |
| 1204921 | [GHSA-4c8g-83qw-93j6](https://github.com/advisories/GHSA-4c8g-83qw-93j6) | fast-uri 3.0.6 | high | **Behoben – Phase 5**, kompatible Toolchainupdates |
| 1239943 | [GHSA-qw65-cvwx-89v3](https://github.com/advisories/GHSA-qw65-cvwx-89v3) | fast-uri 3.0.6 | high | **Behoben – Phase 5**, kompatible Toolchainupdates |
| 1240091 | [GHSA-hrr3-gc8f-f4qj](https://github.com/advisories/GHSA-hrr3-gc8f-f4qj) | fast-uri 3.0.6 | moderate | **Behoben – Phase 5**, kompatible Toolchainupdates |
| 1240100 | [GHSA-q2hr-2g5m-vwhr](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr) | brace-expansion 1.1.12 | moderate | **Behoben – Phase 5**, kompatible Toolchainupdates |
| 1240101 | [GHSA-q2hr-2g5m-vwhr](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr) | brace-expansion 2.0.2 | moderate | **Behoben – Phase 5**, kompatible Toolchainupdates |
| 1240104 | [GHSA-qhr7-859c-m2p7](https://github.com/advisories/GHSA-qhr7-859c-m2p7) | brace-expansion 1.1.12 | high | **Behoben – Phase 5**, kompatible Toolchainupdates |
| 1240105 | [GHSA-qhr7-859c-m2p7](https://github.com/advisories/GHSA-qhr7-859c-m2p7) | brace-expansion 2.0.2 | high | **Behoben – Phase 5**, kompatible Toolchainupdates |
| 1240108 | [GHSA-6j4f-fj2g-mc7p](https://github.com/advisories/GHSA-6j4f-fj2g-mc7p) | brace-expansion 1.1.12 | high | **Behoben – Phase 5**, kompatible Toolchainupdates |
| 1240109 | [GHSA-6j4f-fj2g-mc7p](https://github.com/advisories/GHSA-6j4f-fj2g-mc7p) | brace-expansion 2.0.2 | high | **Behoben – Phase 5**, kompatible Toolchainupdates |
| 1241196 | [GHSA-rf6f-7fwh-wjgh](https://github.com/advisories/GHSA-rf6f-7fwh-wjgh) | flatted 3.3.3 | high | **Behoben – Phase 5**, kompatible Toolchainupdates |
| 1243082 | [GHSA-m5mm-p8h7-m29v](https://github.com/advisories/GHSA-m5mm-p8h7-m29v) | serialize-javascript 6.0.2 | low | **Behoben – Kandidat A**, serialize-javascript 7.1.3 |
| 1243098 | [GHSA-w74x-v6f9-j3xg](https://github.com/advisories/GHSA-w74x-v6f9-j3xg) | fast-uri 3.0.6 | moderate | **Behoben – Phase 5**, kompatible Toolchainupdates |
| 1243101 | [GHSA-xhq7-xmqj-769h](https://github.com/advisories/GHSA-xhq7-xmqj-769h) | fast-uri 3.0.6 | low | **Behoben – Phase 5**, kompatible Toolchainupdates |
| 1243107 | [GHSA-333x-w4r6-6crp](https://github.com/advisories/GHSA-333x-w4r6-6crp) | fast-uri 3.0.6 | low | **Behoben – Phase 5**, kompatible Toolchainupdates |
| 1244012 | [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) | minimatch 9.0.5, 3.1.2, 5.1.6 | moderate | **Offen**; aktuell 9.0.9, 3.1.5, 5.1.9, befristet akzeptiert |
| 1244013 | [GHSA-3g3m-2fjr-6pw4](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4) | glob 10.4.5 | moderate | **Offen**; aktuell 10.5.0, befristet akzeptiert |

## Phase 7 – bewusste Umfangsänderung (historischer Stand)

Apple Foundation Models wird nicht mehr unterstützt. Die alten Apple-Test-/Build-/Inferenzbefunde bleiben in historischen Berichten erhalten; ihre Produktvoraussetzung ist entfallen. Legacy-Auswahl löst keinen automatischen Providerwechsel oder Request aus. [Abschluss und Testzählungsdelta](phase7-removal.md). SEC-002 und beide Toolingbefunde bleiben ausdrücklich offen; nächste Sicherheitsprüfung 1. Dezember 2026 oder vor der nächsten Releasefreigabe, je nachdem früher.

## Phase 8 – Automatisierung ist noch keine Plattformabnahme (historischer Stand)

Drei GitHub-Actions-Jobs und sechs verpflichtende Hostkombinationen sind konfiguriert; lokal unter Windows validiert, noch kein echter Actions-/Linux-/Mac-Lauf. Kein offener Plattformbefund wird deshalb als behoben markiert. 16 neue CI-Regressionen sichern Auditpolicy, Integrität und Isolation; Source-/Fachtests unverändert. Die zwei Packagerbefunde bleiben ein expliziter CI-Gateblocker, die vier Projektbefunde befristet unter unveränderten Bedingungen. [Details](phase8-ci.md).

## Packager-Neubewertung – Phase 8.1, historischer Stand vor Übernahme

Frischer Baseline-Audit: **weiterhin zwei mittlere Befunde offen**, dieselben minimatch-/glob-Advisories und konkreten Pfade. Projekt-Audit unverändert vier, Produktion null; Sicherheitsprüftermin bleibt 1. Dezember 2026 oder vor der nächsten Releasefreigabe, früherer Termin maßgeblich. Keine Packager-Risikoakzeptanz erteilt.

Die [isolierte Validierung](phase81-preparation.md) beseitigte die Packagerbefunde experimentell mit VSCE 3.9.2 plus glob 14.0.3 / minimatch 11.0.4; die 4.1.0-Alternative bestand ebenfalls. **Keine dauerhafte Übernahme:** Befunde im tatsächlichen Hauptgraph bleiben offen, Gate bleibt blockierend. Reiner Override unter 3.6.2 ist wegen inkompatiblem minimatch-Export verworfen. [Neue Audits/Graphen/Hostnachweise](phase81-evidence.json). Kein neuer nachgewiesener Produktfehler; lokale CLI-Mehrdeutigkeit nach VS-Code-Update wurde durch einen isolierten offiziellen Testdownload behandelt.

## Phase 8.2 – tatsächlicher dauerhafter Stand

B1 übernommen und lokal vollständig validiert: beide separaten Toolbefunde behoben, Projekt vier unverändert / Produktion null. Historische Phase-7/8/8.1-Abschnitte und Berichte beschreiben deren damalige offenen Befunde. Kein neuer produktiver Fehler. Die notwendige Installerkorrektur lädt den eigenen Packager-Workspace bei der Frozen-Installation; Audit-Isolation und Gate bleiben unverändert. Reale Linux-/macOS-/GitHub-Actions-Nachweise weiterhin offen. [Abschluss und Prüfergebnisse](phase82-packager.md).

## Phase 8.3 – Bereitstellungsgrenzen und Metadaten

Kein neuer nachgewiesener Produkt- oder Dependencyfehler. Die Sicherheits-/Dateiprüfung des geplanten Commitbestands findet keine echten Zugangsdaten, privaten Schlüssel, Profile oder unbeabsichtigten Archive/Logs; bestehendes Secretlint ohne Befunde. Die sieben Berichte wurden gemäß [Plan](phase83-deployment.md) gezielt redigiert. Die Auditbaseline ist strukturell identisch. Das Zielrepository ist öffentlich. Schreibrechte, Actions-Freigabe und Runnerkontingente sind vor dem Push zu bestätigen. Kein Actions-Lauf; alle Plattformgates und vier Projektbefunde bleiben im bisherigen Status.
