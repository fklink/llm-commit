# Phase 6 – Release-Readiness-Bericht

Nachfolgender Stand: [Phase 6.1](phase61-http-compatibility.md) behebt den hier historisch dokumentierten fetch-/Mindestversionsblocker. Die ursprünglichen Befunde und übrigen Releasegates bleiben zur Nachvollziehbarkeit erhalten.

Stand: 2026-11-01. **Release-Reife: 4/10. Nicht zur Veröffentlichung freigegeben.** Ausschließlich Release-/Plattformvalidierung und kleine Packaging-Korrekturen; keine Änderung produktiver Extension-Logik, Mindestversion oder Projektabhängigkeiten. Keine Commits, Pushes, Marketplace-Veröffentlichung oder nachfolgende Phase.

## Prüfstatus

Jede folgende Prüfung ist einem dieser Status zugeordnet: **Erfolgreich ausgeführt**, **Fehlgeschlagen**, **Nur simuliert**, **Nicht ausführbar**, **Noch offen**. Ein erfolgreiches Test-VSIX ist ausdrücklich kein vollständiges Apple-Release-Paket.

## 1. Geprüfter Projektstand

Manifest evertjunior.llm-commit, Version 0.2.0, main ./dist/extension.js, engines.vscode ^1.80.0, Entwickler-Node >=22.13.0. Kein browser-Entry-Point, keine explizite extensionKind-Vorgabe, keine Runtime-Dependencies. Produktionsbundle enthält die Extension und ihre Sicherheitsgrenze; vscode und Node-Builtins sind extern. TypScript-Ziel ES2022/Node16-Modulauflösung.

Vor Beginn wurde der bestehende uncommittete Arbeitsbaum der Phasen 1–5 einschließlich Kandidat A per Git-Status und Dateihashes erfasst; keine Änderungen daraus gingen verloren. Alle bisherigen src-Dateien, package.json, pnpm-lock.yaml und pnpm-workspace.yaml sind gegenüber diesem Phase-6-Ausgangsstand unverändert. Lock-SHA-256: **33E277A06C5C4FB0371BD00A91AE00264398B3862C86D5D409F2914ABE07E447**. Die zwei Kandidat-A-Overrides bleiben erhalten. [Maschinenlesbare Nachweise](phase6-evidence.json) enthalten auch den ursprünglichen Git-Status.

**Erfolgreich ausgeführt:** Manifest-, Entry-Point-, webpack-, Ignore-, Prepublish- und Swift-Quellprüfung. Bisheriger Prepublish führt zuerst Swift aus und setzt eine geeignete Mac-/POSIX-Umgebung voraus. Er wurde nicht als unter Windows erfolgreich dargestellt.

## 2. VSIX-Packaging und Installierbarkeit

**Erfolgreich ausgeführt:** Produktionsbuild, streng geprüfte VSCE-Dateiliste, zehn Packaging-Regressionstests, VSIX-Erstellung, tatsächliche ZIP-Inhaltsprüfung und Installation in frische Profile von VS Code 1.80.0 und 1.144.0. @vscode/vsce 3.6.2 wurde ausschließlich in einem temporären NTFS-Toolprojekt versionsfest installiert; seine Lockdatei und Risiken gehören nicht zum Projektgraph.

Die Ausgangsdateiliste enthielt out/test/*.test.js, out/extension.js, out/security.js und pnpm-lock.yaml. Dieser echte Ausgangsfall wurde vor der Ignore-Korrektur als Fehler reproduziert. .vscodeignore schließt diese Dateien jetzt aus; zusätzliche lokale Konfigurationen werden ausgeschlossen. Der strenge Wrapper lehnt auch unbekannte Ressourcen, Secrets-Dateinamen, doppelte/unsichere Pfade und fehlende Entry-Points ab.

Das finale **Testpaket** hat **56.207 Bytes (54.89 KiB)**, neun Dateien, 97.801 unkomprimierte Bytes. SHA-256: **316470d9308f2e5fb74ef72d3441450e821be173c526fb94bf5004a34db0c643**. Der Paketinhalt enthält keine Testdateien, Source Maps, Lockdatei, node_modules, Tool-/Audit-/Diagnoseartefakte oder lokalen Konfigurationsdateien.

| Archivdatei | Bytes | Unix-Modusmetadaten |
|---|---:|---|
| extension.vsixmanifest | 2857 | 100664 |
| [Content_Types].xml | 462 | 100664 |
| extension/readme.md | 25381 | 100664 |
| extension/PHASE6-TEST-PACKAGE.txt | 121 | 100666 |
| extension/package.json | 7167 | 100644 |
| extension/LICENSE.txt | 1083 | 100666 |
| extension/changelog.md | 5342 | 100664 |
| extension/images/icon.png | 32001 | 100666 |
| extension/dist/extension.js | 23387 | 100666 |

Alle Dateien sind regulär, ohne ausführbare Bits; die Windows-abgeleiteten Moduswerte 0644/0664/0666 sind **kein** POSIX-/Mac-Berechtigungsnachweis. Native Binary-Berechtigungen sind **Noch offen**, da keine Binary enthalten ist. Die für den aktuellen Windows-Installationspfad nötigen Ressourcen/Pfade wurden real geprüft.

Nur im temporären Testmanifest wurden der Displayname als Validierung ohne Apple-Binary gekennzeichnet und der Swift-Prepublish entfernt. Der Prüfer vergleicht das gesamte Paketmanifest mit exakt diesen zwei erlaubten Abweichungen; engines.vscode und Beiträge bleiben identisch. Eine zusätzliche PHASE6-TEST-PACKAGE.txt warnt vor einer Releaseverwendung. Das enthaltene JavaScript-Bundle stimmt bytegenau mit dem gebauten Produktionsbundle überein (SHA-256 d5852074c70207012a6f5f141e95851bd647fb691dff56dfef904de897938339). Die produktive Manifestdatei wurde nicht verändert.

**Nicht ausführbar:** vollständiger bestehender Swift-Prepublish auf diesem Windows-System. **Noch offen:** vollständiges Release-VSIX mit geprüfter Apple-Binary, Mac-/Linux-Installation, Signatur/Provenienz und POSIX-Dateirechte.

## 3. VS-Code-Kompatibilitätsmatrix

| Umgebung / Prüfung | Ergebnis | Status |
|---|---|---|
| Windows x64, VS Code 1.80.0, Node 16.17.1 / Electron 22.3.14 | Test-VSIX installiert; Aktivierung und drei Befehle vorhanden; AbortController/Signal, Git-API und Dummy-SecretStorage funktionieren | Erfolgreich ausgeführt |
| derselbe echte 1.80-Host: HTTP-Laufzeitvoraussetzung | globales fetch ist undefined; dedizierte Kompatibilitätsprüfung endet mit Exit 1 | **Fehlgeschlagen** |
| Windows x64, VS Code 1.144.0, Node 24.22.1 / Electron 43.8.3 | installiertes VSIX aktiviert; APIs, Dummy-SecretStorage und kontrollierter HTTP-Aufruf mit AbortSignal/Redirectregel funktionieren | Erfolgreich ausgeführt |
| 1.144.0, echtes Multi-Root mit zwei temporären Git-Repositories | beide Wurzeln über echte Git-API geöffnet; vollständige 203er-Suite gegen installiertes VSIX erfolgreich | Erfolgreich ausgeführt |
| exakt @types/vscode 1.80.0, getrennte Typprüfung aller Projektquellen | Typecheck erfolgreich; Projekt-Typen/Lockdatei nicht geändert | Erfolgreich ausgeführt |
| Linux / macOS als tatsächliche Extension Hosts | keine entsprechenden Systeme verfügbar | Nicht ausführbar |
| SSH / Dev Container / WSL als echte Remote-Sitzung | keine Remote-Ziele, Container-Engine oder installierte WSL verfügbar | Nicht ausführbar |

Die Probe lädt LLM Commit aus dem isolierten extensions-Verzeichnis, nicht als Source-Development-Extension. Nur ein separater lokaler Validierungshelfer wird als Development-Extension geladen und stellt für die API-Probe seine eigene SecretStorage-Instanz bereit. Jeder Dummy-Eintrag wurde im finally gelöscht. Damit wird die reale API lokal in einer Sitzung geprüft; keine Aussage über Schlüsselbeständigkeit über Betriebssystem-/Profilneustarts oder Remote-Speicher ist damit verbunden.

## 4. Node.js- und Mindestversionsblocker

**Fehlgeschlagen:** vollständige Unterstützung der deklarierten Mindestversion. Die unveränderte produktive Transportfunktion ruft globales fetch auf; genau dieses Global fehlt im real ausgeführten Node-16.17.1-Host. Dieser Befund ist unabhängig davon, dass der Node-26-Build und die 1.80-API-Typprüfung bestehen. Die Node-18-Entwicklertypen können Globals deklarieren, die der alte Host nicht bereitstellt.

Ein kompletter Modell-Generierungsaufruf wurde nicht gegen bereits laufende Dienste gesendet: sowohl 1234 als auch 11434 waren belegt. Die Probe hat ausschließlich eigene Bindungen versucht und vorhandene Server nicht angesprochen. Der spätere isolierte HTTP-API-Test benutzt einen vom System vergebenen eigenen Port. Er prüft die native Hostfunktion, nicht einen echten Modellanbieter oder einen vollständigen Produktionscommand mit Modellantwort. Die bisherigen Command-/Securitytests bleiben die dafür vorhandene simulierte Abdeckung.

**Noch offen, separate Freigabe erforderlich:** Node-16-kompatibler HTTP-Transport unter Erhalt der Mindestversion oder bewusst genehmigte Anhebung auf eine tatsächlich validierte neue Mindestversion. Keine Produktionskorrektur und keine Mindestversionsanhebung wurden vorgenommen. Das konkrete Vorgehen steht im [Releaseplan](release-plan.md).

**Fehlgeschlagen (Werkzeug, nicht Extension):** ZIP-Lesen mit VSCE-3.6.2/Yauzl unter Node 26 blieb ohne Abschluss. Der Prüfer hat Timeout-/Versionsschutz; kein fehlender Bericht wird als Erfolg akzeptiert. **Erfolgreich ausgeführt:** dieselbe finale Archivprüfung unter Node 24.22.1. Frühere CLI-Startprobleme wurden mit den offiziellen Code-CLI-Einstiegspunkten und dem zusätzlichen 1.80-Electron-Startargument im temporären Testhelfer gelöst, ohne Produktänderung.

## 5. Apple-/macOS-Validierung

| Prüfung | Nachweis | Status |
|---|---|---|
| Package.swift | deklariert Swift-Tools 6.2 und macOS 26; keine externen Swift-Paketabhängigkeiten | Erfolgreich ausgeführt, statisch |
| Swift-Quellpfad | FoundationModels/SystemLanguageModel, stdin-Lesen, stdout-Antwort und statische Fehlercodes nachvollzogen | Erfolgreich ausgeführt, statisch |
| TypeScript-Anbindung | bin/fm-cli, stdin, 1-MiB-Limit, 60-s-Grenze, AbortSignal/SIGKILL, Fehlerredaktion und Warten auf close in vorhandenen Tests | Erfolgreich ausgeführt mit kontrollierten Node-Kindprozessen; Apple-Inferenz Nur simuliert |
| installierte Swift-Version / tatsächlicher Mac | Swift und geeigneter Mac fehlen | Nicht ausführbar |
| macOS-26-Framework und Apple Intelligence | keine reale Hardware-/Systemprüfung | Nicht ausführbar |
| reale arm64-Binary bauen, Architektur/Mindest-OS/Signatur/Modus prüfen | keine Binary vorhanden | Noch offen |
| fm-cli --check, echtes Modell, stdin-Antwort, Fehler, Timeout/Abbruch/Prozessbereinigung auf dem Mac | nicht ausgeführt | Noch offen |

Apple Foundation Models ist für den hier dokumentierten Funktionsumfang auf macOS 26+ und Apple Silicon ausgelegt. Das Paketmanifest allein beschränkt die CPU nicht und beweist keine Intel-/ARM-Binary-Kompatibilität. Der bisherige Swift-Build erzeugt die Architektur seines Buildhosts; kein Universal-/Crossbuild wurde behauptet. Der native Pfad des Test-VSIX fehlt bewusst. Kein fremdes ungeprüftes Binary wurde hinzugefügt.

## 6. Remote Development

**Erfolgreich ausgeführt:** lokale Hostmessung zeigt remoteName null und ExtensionKind.UI (1). Weil das Manifest keine feste extensionKind vorgibt, ist das kein Nachweis einer konkreten SSH-/Container-/WSL-Platzierung. Git-API, native Prozesse und Loopback hängen vom tatsächlich gewählten Host ab.

**Nur simuliert:** Phase-1-Tests zu Remote-Ausführungskontexten, Empfängerbindung und sitzungsgebundener Zustimmung bleiben erfolgreich. **Nicht ausführbar:** reale SSH-, Container- und WSL-Session. SSH-Client/Remote-Erweiterungen sind lokal vorhanden, aber kein autorisiertes Testziel; WSL selbst ist nicht installiert und keine Container-Engine wurde gefunden. Es wurden keine fremden Hosts kontaktiert oder Konten konfiguriert.

**Noch offen:** Hostplatzierung und Zugriff auf die Git-Extension über Hostgrenzen, tatsächlicher Loopback-Modellserver, SecretStorage-Ablage/Neuverbindung und Apple-Verfügbarkeit am ausführenden Host. Eine explizite Workspace-Präferenz ist ein Vorschlag mit Verhaltensänderung und nicht ohne separate Zustimmung gesetzt worden.

## 7. Regressionen und Qualitätsprüfungen

| Prüfung | Tatsächliches Ergebnis | Status |
|---|---|---|
| Frozen-Lockfile-Installation, exFAT mit hoisted-Flag | erfolgreich, Lockdatei unverändert | Erfolgreich ausgeführt |
| pnpm run lint / typecheck / compile-tests | erfolgreich | Erfolgreich ausgeführt |
| pnpm run compile / package | Entwicklungs-/Produktionsbuild erfolgreich | Erfolgreich ausgeführt |
| pnpm run test:headless | 194 bestanden; sieben hostabhängige Tests ausdrücklich übersprungen | Erfolgreich ausgeführt |
| installierter aktueller VSIX-Host | 203 bestanden; alle sieben Hosttests tatsächlich ausgeführt | Erfolgreich ausgeführt |
| node --test scripts/package-validation.test.cjs | zehn bestanden, einschließlich reproduziertem alten Artefakt-Leck | Erfolgreich ausgeführt |
| installiertes VSIX / Mindestversion | erwarteter negativer fetch-Nachweis | Fehlgeschlagen |
| Git-Diff-/Whitespace- und Quellhashprüfung | keine produktiven Quellen/Manifest-/Dependencyänderungen | Erfolgreich ausgeführt |

Die 203 Tests setzen sich aus 43 Sicherheitstests, 32 Git-/Entwurfstests, 83 Provider-/Prompttests, 43 Lifecycle-Tests, bestehendem Beispiel und einem temporären Installed-VSIX-Smoke-Test zusammen. Keine echten Schlüssel oder bezahlten Modellanfragen. Sicherheits-/Git-/Prompt-/Abbruchlogik blieb unangetastet.

## 8. Release-Sicherheitsprüfung

**Erfolgreich ausgeführt:** Archiv-Allowlist, keine Tests/Secrets-Konfigurationsdateien/Entwicklungsabhängigkeiten im Paket, Credential-Musterscan ohne Treffer, unveränderte Sicherheitsquellen und bytegleicher Produktionsbundle-Inhalt. VSCE-Secretprüfung wurde nicht über Allow-Secrets-Flags abgeschaltet. Kein Test- oder Provenienzreport mit lokalen Profilpfaden liegt im VSIX. Ein Musterscan beweist nicht die Abwesenheit jedes denkbaren Secrets; eine weitere manuelle Prüfung des finalen echten Releaseartefakts bleibt Gate.

**Erfolgreich ausgeführt:** Projekt-Audit neu bewertet, weiterhin zwei niedrige webpack- und zwei mittlere minimatch/glob-Befunde; Produktionsaudit 0. Vollständige Pfade: [aktueller Projektaudit](phase6-audit.json). buildHttp ist weiterhin aus; Muster sind kontrolliert und die Test-CLI nutzt kein Glob-Abbruchbudget. Diese Kontextbewertung bestätigt keine pauschale Harmlosigkeit und ersetzt keine erneute Entscheidung unmittelbar vor einer tatsächlichen Releasefreigabe. Die bestehende Akzeptanz endet weiterhin am 1. Dezember 2026 oder der nächsten Releasefreigabe, je nachdem was früher eintritt; neue Ausnutzbarkeit/neue Befunde sind nicht umfasst.

**Noch offen:** Freigabe des separat verwendeten Packaging-Werkzeugs für eine echte Releasepipeline. Dessen isolierter Audit meldet zusätzlich zwei mittlere minimatch-/glob-Befunde; sie wurden nicht dem Projektgraph hinzugefügt und sind nicht von dessen Risikoakzeptanz gedeckt. [Werkzeugaudit](phase6-packager-audit.json). Keine ungeplanten Upgrades zur Auditbereinigung vorgenommen.

**Erfolgreich ausgeführt, statisch/Regression:** Netzwerkanfragen der Extension bleiben am bisherigen Sicherheits-/Commandpfad mit Trust-, Origin-, Schlüssel- und Redirectkontrollen. **Noch offen:** vollständige Netzwerktrace auf jeder Plattform; Hintergrunddienste des VS-Code-Hosts werden nicht der Extension zugerechnet. Keine Behauptung einer vollständigen Netzwerkauditierung aller Hostprozesse.

## 9. Reproduzierbarer Releaseprozess / CI

[Release-/CI-Plan](release-plan.md) beschreibt Source-/Tooling-, Mindestversions-/aktuellen Host-, Mac-/Native-, Paket-, Remote- und Security-Gates, Versionierung und manuelle Freigabe. Kein CI-Workflow und keine Plattformdistributionsmigration wurden eingerichtet. Größere Änderungen bedürfen zusätzlicher Zustimmung. Das heutige Paket ist ein nachvollziehbar gebautes Testartefakt; eine rechnerübergreifende Byte-Reproduzierbarkeit von webpack/ZIP wurde nicht behauptet.

## 10. Priorisierte Blocker und Maßnahmen

| Priorität | Maßnahme | Voraussetzung |
|---|---|---|
| P0 | fetch-Lücke der tatsächlich deklarierten Mindestversion lösen oder Mindestversion genehmigt eingrenzen | separate Produktfreigabe; beide Hosttests wiederholen |
| P0 | echte Mac-/Apple-Binary aus geprüftem Quellstand bauen und inferieren/abbrechen/aufräumen | geeigneter macOS-26-/Swift-6.2-/Apple-Silicon-Host |
| P1 | tatsächliche Remote-Hostplatzierung, Git und Modellserver/SecretStorage auf SSH/Container/WSL prüfen | autorisierte reale Ziele; ggf. genehmigte extensionKind-Entscheidung |
| P1 | Linux-/macOS-HTTP-Hosts und finales vollständiges VSIX testen | reale Plattformrunner; native Dateirechte und Provenienz |
| P1 | vier Projektbefunde und zwei Werkzeugbefunde unmittelbar vor Release neu entscheiden | keine automatische Risikoakzeptanz übernehmen |
| P2 | CI gemäß Plan, fixierter Quell-/Versionsstand, Artefakt-/Releasecheckliste | separate Zustimmung; keine Veröffentlichung in dieser Phase |

## 11. Bewertung 4/10

Build/Regressionsbasis **2/2**; Testpackaging/Installation **1/2** (kein natives vollständiges Paket); deklarierte Mindestversionskompatibilität **0/2**; reale weitere Plattformen/Apple/Remote **0/2**; Sicherheits-/Releasegates **1/2** (Nachweise/Plan vorhanden, offene Befunde und fehlende Freigaben). Gesamt **4/10**. Die erfolgreichen Windows-/Regressionstests rechtfertigen keinen vollständigen Release- oder Plattformnachweis.

## 12. Geänderte Dateien / Grenzen

Geändert: .vscodeignore, README.md, CHANGELOG.md. Neu: scripts/package-validation.cjs, scripts/package-validation.test.cjs, scripts/package-test-vsix.cjs, scripts/inspect-test-vsix.cjs, scripts/compatibility-probe.cjs sowie dieser Bericht, release-plan.md und die drei phase6-JSON-Nachweisdateien. Die produktiven src-Dateien, vorhandenen Tests, package.json, Projekt-Lockdatei und Overrides bleiben unverändert.

Keine eigenständige Releasefreigabe. Das finale Test-VSIX liegt nur im temporären Validierungsverzeichnis; es ist kein Marketplace-/Releaseartefakt. Offene Plattformtests wurden weder erfunden noch als Simulationserfolg umgedeutet.

Primärreferenzen: [VS-Code Publishing](https://code.visualstudio.com/api/working-with-extensions/publishing-extension), [Extension Hosts](https://code.visualstudio.com/api/advanced-topics/extension-host), [Remote Extensions](https://code.visualstudio.com/api/advanced-topics/remote-extensions). Die tatsächlichen Versions-/API-Ergebnisse stammen aus den hier beschriebenen realen Testprozessen, nicht aus einer Annahme über die Node-Version.
