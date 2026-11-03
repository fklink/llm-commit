# Kandidat A – dauerhafte Übernahme und Abnahme

Stand: 2026-11-01. Ausschließlich der ausdrücklich freigegebene Kandidat A wurde übernommen. Kein B/C/D, keine weiteren Major-Upgrades, keine Änderungen an Extension- oder Testquellen. Keine Commits, Pushes, Releases oder Phase 6.

## Geänderte Dateien in dieser Übernahme

- pnpm-workspace.yaml: exakt zwei Eltern-Overrides ergänzt.
- pnpm-lock.yaml: exakt die erfolgreich geprüfte Kandidat-A-Lockdatei übernommen.
- docs/candidate-a-upgrade.md: dieser Bericht mit Abnahme und befristeter Risikoakzeptanz.
- docs/candidate-a-audit.json: vollständiger aktueller Audit mit allen konkreten Pfaden.
- docs/candidate-a-graph.json: vollständige Lockfile-Graphen vorher/nachher, Versionsdelta und tatsächlich aufgelöster Graph.
- docs/phase5-toolchain.md: Verweis auf den nachfolgenden autorisierten Vier-Befunde-Stand; historische Phase-5-Zahlen bleiben nachvollziehbar.
- CHANGELOG.md: dokumentierte Übernahme und Audit-Ergebnis.

Die bereits vorher vorhandenen uncommitteten Änderungen der Phasen 1–5 bleiben erhalten. package.json, Entwicklerwerkzeuge, webpack.config.js, alle acht bisherigen Quell-/Testdateien und die Sicherheitsmechanismen wurden nicht geändert.

## Paketkonfiguration und Graphvergleich

```yaml
overrides:
  "mocha@10>serialize-javascript": 7.1.3
  "terser-webpack-plugin@5>serialize-javascript": 7.1.3
```

| Pfad | Vorher | Nachher |
|---|---|---|
| mocha 10.8.2 → serialize-javascript | 6.0.2 | **7.1.3** |
| @vscode/test-cli 0.0.10 → mocha 10.8.2 → serialize-javascript | 6.0.2 | **7.1.3** |
| webpack 5.100.2 → terser-webpack-plugin 5.3.14 → serialize-javascript (auch über ts-loader/webpack-cli-Peers) | 6.0.2 | **7.1.3** |
| nicht mehr benötigtes randombytes | 2.1.0 | entfernt |
| safe-buffer | 5.1.2 und 5.2.1 | nur 5.1.2 anderer Aufrufer bleibt |

Keine andere Paketfamilie hat ein Versionsdelta. Die Anzahl der gesperrten Paket-/Versionseinträge sinkt von 332 auf 330. webpack bleibt 5.100.2, webpack-cli 5.1.4, ESLint 8.57.1, TypeScript 5.8.3 und Mocha 10.8.2. Die wenigen entfernten Einträge sind ausschließlich die nicht mehr benötigte Zufallszahl-Abhängigkeit der alten Serialisiererversion und deren Buffer-Abhängigkeit.

Die gesamte Lockdatei stimmt bytegenau mit dem experimentell bestandenen Kandidaten A überein, SHA-256: **33E277A06C5C4FB0371BD00A91AE00264398B3862C86D5D409F2914ABE07E447**. Der rekursiv durch tatsächliche Node-Modulauflösung erfasste Graph hat 327 eindeutige Paket-/Versionsknoten einschließlich Projektwurzel und 529 Abhängigkeits-/Peer-Kanten und stimmt vollständig mit der getesteten Installation von A überein. Nur serialize-javascript@7.1.3 wird über diese Pfade geladen.

Zusätzlich zu pnpm list --depth Infinity --json wurde die tatsächliche Dateisystem-/Node-Auflösung geprüft: die vorhandene exFAT-/Hoisted-Installation enthält ältere pnpm-Layoutmetadaten und deduplizierte/ausgeblendete Listenäste. Diese Layoutangaben allein sind kein Nachweis geladener Versionen. Vier nicht als Paket aufgelöste Namen sind identisch in beiden Graphen: das Windows-optionale fsevents sowie die Node-Builtins events, string_decoder und punycode. Sie wurden nicht als neue fehlende Laufzeitabhängigkeiten gewertet.

Die maschinenlesbare [Graphdatei](candidate-a-graph.json) enthält auch die vollständigen gesperrten Knoten und Kanten vor/nach der Änderung; der [Audit](candidate-a-audit.json) enthält sämtliche gemeldeten konkreten Peer-/Elternpfade.

## Audit-Abnahme

| Schweregrad | Vorher | Nachher |
|---|---:|---:|
| Hoch | 1 | **0** |
| Mittel | 3 | **2** |
| Niedrig | 3 | **2** |
| Gesamt | 7 | **4** |
| Produktionsaudit | 0 | **0** |

Behoben: [GHSA-5c6j-r48x-rmvq](https://github.com/advisories/GHSA-5c6j-r48x-rmvq) (Serialisierungs-Code-Injection), [GHSA-qj8w-gfj5-8c6v](https://github.com/advisories/GHSA-qj8w-gfj5-8c6v) (Array-ähnlicher CPU-Verbrauch) und [GHSA-m5mm-p8h7-m29v](https://github.com/advisories/GHSA-m5mm-p8h7-m29v) (Funktionsquelltext-/HTML-Escaping). Keiner der drei Einträge steht im abschließenden Audit. Vollständiger Audit endet wegen der vier bewusst sichtbaren Restbefunde mit Exit 1, Produktionsaudit mit Exit 0. Keine Audit-Ausnahmen oder Unterdrückung wurden eingeführt.

## Tatsächlich ausgeführte Prüfungen

Node 26.13.0, pnpm 11.25.0 und isolierter VS-Code-1.144.0-Extension-Host.

| Prüfung / Befehl | Ergebnis |
|---|---|
| pnpm install --frozen-lockfile --node-linker=hoisted --ignore-scripts --config.confirmModulesPurge=false | bestanden; initiale Installation auf exFAT |
| pnpm install --frozen-lockfile --node-linker=hoisted | bestanden, auch ohne --ignore-scripts; Lockdatei unverändert |
| pnpm run lint | bestanden |
| pnpm run typecheck | bestanden |
| pnpm run compile-tests | bestanden |
| pnpm run compile | Entwicklungsbuild bestanden |
| pnpm run package | Produktionsbuild bestanden |
| pnpm run test:headless | **194 bestanden**, sieben Hosttests ausdrücklich übersprungen |
| pnpm exec vscode-test --config .vscode-test/candidate-a-acceptance.config.mjs | **203 bestanden**, Exit 0 |
| zwei echte Mocha-Worker mit der installierten Bibliothek | **2 Tests bestanden** |
| bestehende c8/test-exclude.shouldInstrument-Coverage-API | bestanden |
| webpack-Dateicache direkt im D:-Checkout | **abweichend:** Verzeichnis-Snapshot schlägt mit EINVAL fehl; Builds selbst erfolgreich |
| webpack-Dateicache in frischer NTFS-Kopie des dauerhaft übernommenen Stands | **bestanden:** kalter/warm geladener Cache, Packdatei vorhanden |
| pnpm audit --json | vier erwartete Restbefunde, Exit 1 |
| pnpm audit --prod --json | null Befunde, Exit 0 |
| exakter Lock-/Versions- und tatsächlich aufgelöster Graphvergleich | identisch zu Kandidat A, keine anderen Versionsänderungen |
| SHA-256 aller bisherigen src-Dateien und package.json | unverändert |
| Git-Diff-/zusätzliche Whitespace-Prüfung | bestanden |

Der Host wurde nach dem Produktionsbuild direkt über die vorhandene CLI gestartet, damit pretest nicht wieder ein Entwicklungsbundle darüber schreibt. Er verwendet ein frisches temporäres Profil, Workspace und Extensionverzeichnis. Die 203 Tests umfassen 43 Phase-1-Sicherheits-, 32 Phase-2-Git-, 83 Phase-3-Provider-/Prompt- und 43 Phase-4-Lifecycle-Tests, den bestehenden Beispieltest und eine temporäre Produktionsbundle-Aktivierungsprobe. Die sieben Headless-Ausnahmen liefen im Host tatsächlich. Nur Dummy-Schlüssel, keine kostenpflichtigen Modellaufrufe. Die temporäre Hostkonfiguration wurde anschließend entfernt.

### Dateicache-Abweichung, ohne Scope-Erweiterung

Der direkte D:-Lauf meldet im webpack.FileSystemInfo-Snapshot EINVAL beim Lesen von Verzeichnissen wie <REPOSITORY_ROOT>, <REPOSITORY_PARENT> und dem Checkout. Die reguläre Projektkonfiguration aktiviert diesen zusätzlichen persistenten Dateicache nicht. Es wurde weder ein Snapshot-Sicherheitscheck abgeschwächt noch webpack aktualisiert. Eine frische NTFS-Kopie wurde aus dem **bereits dauerhaft übernommenen** Hauptbaum erstellt, mit identischer Lockdatei frozen installiert und kalt/warm geprüft. Dort werden Packdatei und geladener Cache nachgewiesen.

Das Ergebnis ist somit ein erfolgreicher Cache-Kompatibilitätsnachweis auf NTFS bei dokumentierter Einschränkung im exFAT-/Hoisted-Checkout, keine pauschale Zusage für den Dateicache auf D:. Die genaue Plattform-/Snapshot-Ursache wurde außerhalb dieses begrenzten Upgrades nicht behoben. Ein erster NTFS-Prüfer kontrollierte versehentlich den alten Cachepfad; nach Korrektur ausschließlich des temporären Prüfers bestand ein neuer kalter und warmer Lauf. Keine weiteren Kandidaten oder Abhängigkeiten wurden dafür übernommen.

## Vier Restbefunde und genehmigte vorläufige Risikoakzeptanz

**Erneute Prüfung: 1. Dezember 2026 oder nächste Releasefreigabe, je nachdem was früher eintritt.** Diese befristete Akzeptanz gilt nur für die folgenden vier bekannten Befunde bei den beschriebenen Bedingungen. Sie gilt ausdrücklich nicht automatisch für neue Befunde oder später nachgewiesene Ausnutzbarkeit. Keine automatische Verlängerung. Das Datum ist hier dokumentiert; es wurde keine Automatisierung angelegt.

| Advisory / Version | Konkreter Abhängigkeitspfad | Begründung und Bedingungen |
|---|---|---|
| [GHSA-8fgc-7cc6-rx7x](https://github.com/advisories/GHSA-8fgc-7cc6-rx7x), webpack 5.100.2, niedrig | webpack direkt; ts-loader → webpack; webpack-cli und @webpack-cli/configtest/info/serve → webpack | Betroffen ist experiments.buildHttp/HttpUriPlugin mit kontrollierbaren URLs; im Projekt nicht aktiviert/verwendet. Phase-1-API-Empfängerbindung ist davon unabhängig. Vor Aktivierung neu bewerten; Fix ab 5.104.1 benötigt separat freizugebenden internen Major-Wechsel. |
| [GHSA-38r7-794h-5758](https://github.com/advisories/GHSA-38r7-794h-5758), webpack 5.100.2, niedrig | dieselben webpack-/Peerpfade | HTTP-Build-Redirectfunktion ist nicht eingeschaltet. Die API-Redirectsperre bleibt unverändert. Gemeinsamer späterer Fix mit dem anderen webpack-Befund; kein Kandidat B übernommen. |
| [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249), minimatch 3.1.5/5.1.9/9.0.9, mittel | ESLint → @eslint/eslintrc, @humanwhocodes/config-array bzw. file-entry-cache → flat-cache → rimraf → glob → minimatch; Test-CLI → c8 → test-exclude → minimatch/glob; Mocha → minimatch/glob; TypeScript-ESTree und Test-CLI/glob-10 → minimatch | Muster stammen aus kontrollierter Projekt-/Testkonfiguration, nicht aus API-Antworten. Keine konkrete Ausnutzung für diese Aufrufer nachgewiesen. Ein breiter 11er-Ersatz brach im Experiment die bestehende Coverage-API; nur unterstützte Elternmigration/Backports prüfen. Bei extern kontrollierten Mustern oder belegtem Angriff früher neu bewerten. |
| [GHSA-3g3m-2fjr-6pw4](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4), glob 10.5.0, mittel | @vscode/test-cli 0.0.10 → glob 10.5.0 | Betroffener Pfad ist fortgesetzte Traversierung nach AbortSignal; dieser Aufrufer verwendet kein solches Abbruchbudget. Phase-4-Abbruch nutzt glob nicht. Vor Einführung eines Glob-Signalbudgets erneut prüfen; Kandidat D ist nicht übernommen. |

Alle exakten Peer-/Elternvarianten stehen zusätzlich vollständig in candidate-a-audit.json. Das Ausnutzungsrisiko ist anhand der aktuell verwendeten Funktionen begrenzt, nicht durch den bloßen Status „Entwicklungsabhängigkeit“ ausgeschlossen. Neue Advisories, neue Angriffsnachweise oder Änderungen an Mustern/Build-HTTP/Workeroptionen erfordern sofortige Neubewertung.

## Weitere Grenzen

serialize-javascript 7 benötigt Node >=20; der deklarierte Entwicklerbereich >=22.13 erfüllt dies. Tests gegen alte VS-Code-Minimum-Hosts können eine gesonderte Tooling-Lösung benötigen. Vollständiger Swift-/macOS-Prepublish, tatsächliche Apple-Inferenz, reales Remote Development und vollständige VSIX-Inhaltsprüfung wurden hier nicht durchgeführt. package bedeutet weiterhin JavaScript-Produktionsbundle, kein Release.

Die übernommenen Abhängigkeiten sind exakt A; Sicherheits-/Git-/Provider-/Prompt-/Lifecycle-Quellen bleiben unverändert. Die Cache-Plattformabweichung ist dokumentiert, keine zusätzliche Dependencykorrektur oder Phase 6 wurde begonnen.
