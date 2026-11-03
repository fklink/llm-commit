# Projektstatus – LLM Commit

Stand: **3. November 2026, nach Phase 8.2 (isolierter Packager B1; Produktumfang unverändert seit Phase 7)**. [Regeln](../AGENTS.md) · [Issues](ISSUES.md) · [Roadmap](ROADMAP.md) · [Entscheidungen](DECISIONS.md).

**Release-Reife: 7/10; keine Releaseempfehlung oder Veröffentlichungsfreigabe.** Maßgeblich sind [Phase 8.2: dauerhaftes Packager-Upgrade](phase82-packager.md) mit [Evidenz](phase82-evidence.json) sowie der unveränderte Produktstand aus [Phase 7](phase7-removal.md). Der frühere Stand 6/10 bleibt in den unveränderten Phase-6.2/6.3-Berichten historisch korrekt.

## Aktueller Produktumfang

Version 0.2.0, VS Code `^1.80.0`, ausschließlich **LM Studio, Ollama, OpenAI und Custom OpenAI-kompatible HTTP-APIs**. Apple Foundation Models, Swift-CLI, native Prozessverwaltung und native Buildvoraussetzungen sind entfernt. Ein alter Providerwert `apple` führt zu einem verständlichen Fehler: keine automatische Umstellung, kein Ersatzrequest, keine Änderung bestehender Credentials oder Freigaben. Der Nutzer wählt einen neuen Provider selbst.

`src/extension.ts` orchestriert Commands, Git, Provider/Prompt/Antwort und HTTP-Operationen; `src/security.ts` bleibt die unveränderte Sicherheitsgrenze, `src/transport.ts` der unveränderte Node-16-kompatible HTTP-/HTTPS-Transport. Keine neuen Provider, Runtime-Dependencies oder explizite Hostplatzierung. Entwickler-Node `>=22.13.0`, aufgezeichnete Baseline 26.13.0; pnpm 11.25.0. Eingebetteter Mindesthost separat: Node 16.17.1.

## Phasenstatus und Nachweise

| Phase | Ergebnis | Detail |
|---|---|---|
| 1 | SecretStorage, Origin-/Provider-/Kontextbindung, Trust, Migration, redigierte Fehler implementiert | [Historische README-Notizen](../README.md#phase-1-validation-scope), [Security-Tests](../src/test/security.test.ts) |
| 2 | Repository-Auflösung, Draftschutz und URI-/Anfrageordnung implementiert | [Git-/Generierungsregressionen](../src/test/generation.test.ts), [echte Git-Tests](../src/test/git.integration.test.ts) |
| 3 | Providermodelle, Literal-Prompt und Konfigurations-/Antwortvalidierung implementiert | [Provider-Tests](../src/test/provider.test.ts), [Entscheidungen](DECISIONS.md) |
| 4 | HTTP-Abbruch, Deadline, Shutdown und damaliger Apple-Prozessschutz implementiert | [Lifecycle-Tests](../src/test/lifecycle.test.ts); Apple-Teil nun entfernt |
| 5 + Kandidat A | Lint repariert, Audit 57 → sieben → vier; nur genehmigte Overrides | [Toolchain](phase5-toolchain.md), [A-Abnahme](candidate-a-upgrade.md), [Graph](candidate-a-graph.json) |
| 6 | Packaginganalyse und damaligen fetch-Mindestversionsfehler nachgewiesen; historisch 4/10 | [Bericht](phase6-readiness.md), [Evidenz](phase6-evidence.json) |
| 6.1 | Native HTTP-Kompatibilität unter VS Code 1.80 hergestellt, keine Mindestversionserhöhung | [Bericht](phase61-http-compatibility.md), [Evidenz](phase61-evidence.json) |
| 6.2/6.3 | Verfügbare Windows-/Netzwerkprüfungen bestanden; weitere reale Umgebungen fehlten, historisch 6/10 | [6.2](phase62-readiness.md), [6.3](phase63-platform-acceptance.md), [Evidenz](phase63-evidence.json) |
| 7 | Apple vollständig entfernt; vollständiges HTTP-VSIX unter Windows gebaut/installiert; Legacy-Konfiguration sicher abgelehnt | [Abschluss](phase7-removal.md), [Evidenz](phase7-evidence.json) |
| 8 | Drei CI-Jobs, einmaliger Paketbau, gepinnte Tools, installierte Hostmatrix, Audit-/Artefaktgates implementiert und lokal Windows validiert; GitHub Actions nicht ausgeführt | [Bericht](phase8-ci.md), [Evidenz](phase8-evidence.json) |
| 8.1 | Packagerkorrekturen isoliert bewertet und ersten CI-Lauf vorbereitet; keine dauerhafte Übernahme in dieser Phase | [Bericht](phase81-preparation.md), [Evidenz](phase81-evidence.json) |
| 8.2 | B1 dauerhaft übernommen, vollständige lokale Windows-Validierung, Packager-Audit null und unverändertes Gate bestanden; noch kein Cloudlauf | [Bericht](phase82-packager.md), [Evidenz](phase82-evidence.json) |

Die tatsächlich freigegebene Phase 7 ist die Apple-Entfernung; sie ist keine pauschale Umsetzung der gleich nummerierten ursprünglichen Master-Roadmap.

## Letzte tatsächlich ausgeführte Prüfungen – Phase 8.2, lokal Windows

| Prüfung | Ergebnis |
|---|---|
| Frozen-Lockfile-Installation | **Erfolgreich**, lokales exFAT-Hoisted-Flag; Lockfile unverändert |
| Lint, Typecheck, Entwicklungs-/Produktionsbuild, regulärer Prepublish | **Erfolgreich**, keine Swift-/Xcode-Werkzeuge erforderlich |
| Headless mit TLS-Fixture | **Erfolgreich**, 205 bestanden / sieben erwartete Host-Ausnahmen; ohne TLS-Fixture 204 / acht |
| Installierte Suite Windows x64, VS Code 1.80.0 / Node 16.17.1 | **Erfolgreich**, 214 Tests |
| Installierte Suite Windows x64, VS Code 1.144.0 / Node 24.22.1 | **Erfolgreich**, 214 Tests |
| Packaging-/CI-Tests | **Erfolgreich**, 17 Packagingtests und 16 zusätzliche CI-Sicherheits-/Integritätstests |
| Vollständiges lokales VSIX | **Erfolgreich**, acht Archiveinträge, originales Manifest, kein Testmarker und keine native Integration; tatsächliche Installation in beiden Hosts |
| Zusätzlicher realer installierter Command | **Erfolgreich** in beiden Hosts: echter Git-Index, eigener Custom-HTTP-Server, echte SCM-Übernahme. **Simuliert** ausschließlich die Consent-Antwort für die exakte eigene Test-Origin |
| Audit | Vier bekannte Projekt-Entwicklungsbefunde, Produktionsaudit null; separater Packager-Audit null. Unverändertes CI-Audit-Gate lokal bestanden, keine neue Risikoakzeptanz |

Die reduzierte Testzahl bedeutet ausschließlich entfernte Apple-Funktionalität: drei Providerfälle und 13 ausschließlich native Lifecycle-Fälle entfallen; vier neue Provider-/Legacy-Fälle kommen hinzu. Eine frühere Apple/HTTP-Shutdown-Prüfung ist jetzt eine Prüfung zweier unabhängiger HTTP-Anfragen. Security-, Git-, Prompt-, HTTP-/Provider- und sonstige Lifecycle-Assertionen bleiben erhalten. [Detaillierter Abgleich](phase7-removal.md).

Die bestehende VM-Bundleprobe bleibt als zusätzliche Regression erhalten. Sie ist von dem neuen tatsächlichen installierten Command zu unterscheiden. Helper-SecretStorage wird echt geprüft; Remote-/Trust-Policy und viele Serviceinteraktionen bleiben Testdoubles. Automatisierte Hosts deaktivieren die Trust-UI; keine neue interaktive Workspace-Trust-Abnahme behauptet. Kein echter LM-/Ollama-Modelllauf und keine kostenpflichtige Cloudanfrage.

## Plattformmatrix und verbleibende Gates

| Umgebung | Status / offene Prüfung |
|---|---|
| Windows x64 Minimum/aktuell | **Erfolgreich** für aufgeführte automatische Tests und vollständiges HTTP-Paket |
| Linux | CI-Job konfiguriert, tatsächlich **Nicht durchgeführt**: realer Runner, Desktop/Keyring, Host-/Git-/Trust-/TLS-/Lifecycleabnahme fehlen |
| macOS HTTP | CI-Job konfiguriert, tatsächlich **Nicht durchgeführt**: kein realer Mac-Lauf; keine Swift-/FoundationModels-Voraussetzung mehr |
| Apple-Inferenz/native Binary | **Entfallen aus Produktumfang**, kein bestandener Mac-Test |
| Remote-SSH / Container / WSL | Reale Abnahme **Nicht durchgeführt**; Hostort, Loopback, Git-Auswahl und getrennte Freigaben/SecretStorage offen |
| Enterprise | Eigene Proxy-/TLS-Fixtures nachgewiesen; verwaltete CA-/Systemstores, Auth-/PAC-/HTTPS-Proxys weiterhin **Nicht durchgeführt** |
| GitHub Actions / Veröffentlichung | CI implementiert/lokal validiert, **kein tatsächlicher Actions-Lauf**. Keine Veröffentlichungspipeline oder Publishingfreigabe |

## Sicherheit und nächste Schritte

Vier bekannte Projekt-Entwicklungsbefunde (webpack zweimal niedrig, minimatch/glob je mittel) bleiben ausdrücklich offen. Die zwei separaten Packagerbefunde sind durch B1 in Phase 8.2 behoben; die Entfernung nativer Funktionalität hatte diese nicht behoben. [Aktuelles Inventar](ISSUES.md).

**Nächste Sicherheitsprüfung: 1. Dezember 2026 oder vor der nächsten Releasefreigabe, je nachdem früher.** Keine Akzeptanz neuer Befunde oder belegter Ausnutzbarkeit, keine automatische Verlängerung und keine Übertragung auf Packager-Tooling.

1. Verbleibende HTTP-Plattformen Linux/macOS und echte Remote-/Enterpriseumgebungen abnehmen.
2. Vier bekannte Projektbefunde fristgerecht neu bewerten und beide Graphen weiter auf neue Befunde prüfen; weitere Updates nur separat freigeben.
3. Bereitstellung und ersten tatsächlichen CI-Lauf gesondert freigeben; automatische Push-Auslösung berücksichtigen, keine Veröffentlichung.

## Historie und Evidenzgrenzen

Alle bisherigen Phase-/Audit-/Kandidat-A-Berichte bleiben unverändert. Der alte [Releaseplan](release-plan.md) und das [alte Plattform-Runbook](phase62-platform-runbook.md) enthalten inzwischen überholte Apple-/Swift-/fetch-/Testzahlannahmen; sie beschreiben damalige Zustände und sind kein aktueller Packagingbefehl. Aktueller Ablauf steht in [README](../README.md#development-and-complete-local-vsix) und Phase 7.

Die frühere leere `wsl.message` im Phase-6.3-JSON ist weiterhin eine Übernahmelücke: die Meldung befand sich in `wsl-stderr.txt`. Keine nachträgliche Umschreibung des alten Nachweises. Temporäre Rohartefakte sind lokale Belege, kein garantiert dauerhaftes Releasearchiv. Die Dokumentationskonsolidierung vom 1./2. November bleibt eine frühere Arbeit, keine neue Plattformabnahme.

## Phase-8-Abnahmegrenze – historischer Stand

Keine produktive Extension-Logik, Fachtests oder Projektabhängigkeiten geändert. Alle früheren Phase-/Auditberichte bleiben unverändert. Die neue CI wurde mit actionlint geprüft und lokal über ihre tatsächlichen Tasks ausgeführt: vollständiges VSIX, je 214 installierte Hosttests, sechs zusätzliche TLS-Probes, 205 Headless-Tests und separate Auditentscheidung. Die letzte finale kombinierte Prüfung umfasst 17 Packaging- und 16 CI-Tests. Nur eigene Dummy-Gegenstellen; Consent-Antwort simuliert wie in Phase 7.

Die Konfiguration ergibt noch keinen erfolgreichen GitHub-Actions-Lauf. Die zwei bekannten nicht akzeptierten Packagerbefunde lassen das neue Gate rot; Linux/macOS können nach bereitgestelltem Paket unabhängig von diesem späteren Windows-Auditfehler weiterprüfen. Nächster Schritt: separater Freigabeschritt zur Repositorybereitstellung/ersten echten Runnerausführung und bewusste Packager-Risikoentscheidung. Keine Commits, Pushes oder Releases in Phase 8.

## Phase 8.1 – Analyse und Vorbereitung, historischer Stand vor Übernahme

[Bericht](phase81-preparation.md) und [Evidenz](phase81-evidence.json): Packager-Baseline erneut zwei mittlere Befunde, Projekt vier / Produktion null. Isolierte Experimente mit VSCE 3.9.2 und 4.1.0 samt gezielten Overrides bestanden Frozen-Installation, vollständiges VSIX und beide Windows-Hosts; Kandidatengraphen jeweils null Auditbefunde. Empfohlen wird die kleinere 3.9.2-Variante mit glob 14.0.3 / minimatch 11.0.4, **noch nicht dauerhaft übernommen oder freigegeben**. Reiner Override unter 3.6.2 scheiterte an einem Exportbruch.

Hauptworkflow, Tool-Lock und produktive Quellen bleiben unverändert; das bekannte Packager-Gate bleibt blockierend. Kein GitHub-Actions-Lauf, Commit, Push oder Dispatch. Linux/macOS bleiben **Nicht durchgeführt**, Release-Reife **7/10**. Nächste Schritte: konkrete Korrektur freigeben und dauerhaft validieren; danach gesondert Bereitstellung einschließlich automatisch ausgelöstem Push-Lauf freigeben. Die Anleitung berücksichtigt, dass manueller Dispatch einen Workflow im Defaultbranch voraussetzt.

## Phase 8.2 – B1 dauerhaft übernommen

[Abschluss](phase82-packager.md), [Evidenz](phase82-evidence.json): VSCE 3.9.2, eigene Eltern-Overrides glob 14.0.3 / minimatch 11.0.4 und bytegleicher B1-Lock dauerhaft übernommen. Rootgraph und produktive Quellen unverändert. Frozen-Installation im eigenen Tool-Workspace korrigiert; isolierter Audit weiterhin mit --ignore-workspace. 205 Headless, 17 Packaging + 16 CI, je 214 installierte Windows-Hosttests sowie sechs zusätzliche TLS-Probes bestanden. Packager null / Produktion null / vier unverändert befristet bewertete Projektbefunde; unverändertes Audit-Gate lokal bestanden.

Die Abschnitte zu Phase 8/8.1 oben dokumentieren damalige Zustände; deren Packagerblocker ist jetzt behoben. Keine tatsächliche Cloud-/Linux-/macOS-Ausführung, kein Commit, Push oder Dispatch. Release-Reife bleibt 7/10; nächster Schritt ist eine konkrete gesonderte Bereitstellungs- und erste Lauffreigabe.

## Phase 8.3 – nur Bereitstellung vorbereitet

[Konkreter Plan](phase83-deployment.md), [exaktes Manifest](phase83-manifest.json): Arbeitsbaum auf main/0a2c086 weiterhin mit allen uncommitteten Phasenänderungen. Vorgeschlagen sind ein neuer Branch codex/ci-first-platform-run und ein Konsolidierungscommit mit expliziter Dateiliste; noch keine Git-/GitHub-Schreiboperation freigegeben oder ausgeführt. Die sieben Berichte sind von persönlichen Pfadmetadaten bereinigt. Live-Remote und öffentliche Metadaten wurden lesend geprüft. Actions- und Schreibrechte bleiben zu bestätigen. actionlint, 16 CI-Tests und lokale Sicherheits-/Dateiprüfung bestanden; vollständige Produkttests zuletzt Phase 8.2. Release-Reife unverändert 7/10. Nächster Schritt ist die ausdrücklich angefragte Branch-/Commit-/Push- und erste Lauffreigabe, kein Release.
