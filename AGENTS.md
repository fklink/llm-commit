# Entwicklungsregeln für LLM Commit

Diese Regeln gelten im gesamten Repository. Aktuelle ausdrückliche Nutzerfreigaben bestimmen den Arbeitsumfang; diese Datei erteilt selbst keine Implementierungs-, Upgrade- oder Releasefreigabe. Bereits erteilte passende Freigaben gelten weiter. Aktualisiert nach Phase 8.2: 3. November 2026.

## Einstieg und Arbeitsablauf

1. Zuerst [Projektstatus](docs/PROJECT_STATUS.md), [Issues](docs/ISSUES.md), [Entscheidungen](docs/DECISIONS.md) und den relevanten Detailbericht lesen. Ältere Berichte sind historische Messungen, keine aktuellen Freigaben.
2. Git-Status und betroffene Dateien erfassen. Bestehende uncommittete Änderungen erhalten; keine fremden Änderungen zurücksetzen. Für begrenzte Arbeiten vor/nachher Dateihashes vergleichen.
3. Nur den genehmigten Umfang bearbeiten. Keine Nebenfehler, umfassenden Refactorings, zusätzlichen Dependencies, Mindestversions- oder Releasearchitekturänderungen ohne passende Freigabe. Analyse, Tests und Vorschläge berechtigen nicht automatisch zur Umsetzung.
4. Nach Möglichkeit zuerst einen aussagekräftigen reproduzierenden Regressionstest schreiben, dann eine kleine Korrektur. Dokumentationsänderungen benötigen Link-/Fakten-/Konsistenzprüfungen statt einer künstlich aufgeblähten Produkttestsuite.
5. Verfügbare relevante Prüfungen ausführen und tatsächliche Befehle, Umgebungen, Ergebnisse, Ausnahmen und Risiken dokumentieren. Fehlende Hardware ausdrücklich nennen; mit unabhängigen ausführbaren Prüfungen fortfahren.
6. Keine Commits, Pushes, Tags, Releases, Veröffentlichung oder destruktiven Aktionen ohne ausdrückliche entsprechende Freigabe. Keine neue Entwicklungsphase eigenständig starten.

## Architektur und Konventionen

- TypeScript und bestehende öffentliche VS-Code-/Git-APIs verwenden. Bestehende Flat-Config-Regeln und Typecheck einhalten; klare Typen, explizite Zustände und kleine Schnittstellen bevorzugen. Keine neuen Frameworks ohne begründete Freigabe.
- `src/extension.ts` orchestriert Commands, Git-Kontext, Prompt-/Providerauflösung, Operationen. `src/security.ts` ist die HTTP-Sicherheitsgrenze. `src/transport.ts` implementiert den schmalen nativen POST-/JSON-Transport. Apple Foundation Models, Swift-CLI und native Prozessverwaltung sind seit Phase 7 entfernt. Vorgeschlagene weitere Module sind noch nicht implementiert.
- Diff und Ergebnisübernahme müssen dieselbe ausgewählte Repository-Instanz verwenden. Identität/Anfragereihenfolge nach Repository-Root-URI führen, weil Git-API-Wrapper wechseln können. Expliziten ungültigen Kontext nicht still auf ein anderes Repository umbiegen.
- Vorhandene Entwürfe niemals automatisch ersetzen. Nur anfangs exakt leeres und am Ende unverändertes Eingabefeld, offenes Repository und neueste gültige Anfrage automatisch befüllen. Geschützte Ergebnisse zugänglich erhalten; abgebrochene Ergebnisse nicht übernehmen. Die InputBox bietet keine vollständige Bearbeitungshistorie.
- Pro Operation eigener Controller, Timer und Ressourcenbesitz. Alte Ergebnisse dürfen neuere nicht überholen; unterschiedliche Repositorys bleiben unabhängig. HTTP-Requests und Timer bei Deaktivierung zuverlässig abbrechen und bereinigen.
- Alle vier HTTP-Provider verwenden denselben Literal-Promptbuilder. Keine String-Ersetzung mit Diff als Replacement-String. Konfiguration und externe Antworten zur Laufzeit validieren; explizite gültige Modellnamen und VS-Code-Konfigurationshierarchie erhalten.

## Sicherheitsinvarianten

- Zugangsdaten ausschließlich aus `SecretStorage` mit validiertem Provider-/Origin-Datensatz verwenden. Credential-ID bindet Provider und Origin; die zusätzliche Sendefreigabe bindet Provider, Origin und Ausführungskontext. Workspacekonfiguration ist keine Sicherheitsfreigabe.
- HTTP-Generierung und Schlüsselverwaltung verlangen Workspace Trust. Ziel/Trust nach asynchronen Schritten erneut prüfen. Preset-URLs nicht durch Workspacewerte ersetzen; LM Studio/Ollama bleiben schlüssellos. Custom benötigt bewusste passende Origin-Freigabe; OpenAI benötigt einen gespeicherten Schlüssel.
- Unveränderte sicher genehmigte lokale Ziele dürfen Freigaben wiederverwenden. Remote-Freigaben bleiben sitzungsgebunden; `remoteName` allein ist keine eindeutige Serveridentität. Loopback bezeichnet den tatsächlichen Extension Host.
- Externe Ziele nur über HTTPS; HTTP nur für erlaubte Loopback-Hosts. Keine URL-Zugangsdaten/Fragmente. Redirects niemals verfolgen. TLS-Zertifikats-/Hostnamenprüfung niemals deaktivieren, auch nicht für Tests oder Unternehmensumgebungen.
- Keine Secrets, Authorization-Header, sensiblen Diffs, Rohantworten oder unbekannten Exception-/stderr-Inhalte in Diagnoseausgaben. Feste bzw. kontrollierte Fehlermeldungen beibehalten.
- Legacy-Keys niemals direkt senden oder als Fallback nutzen; Workspace-Keys nicht automatisch migrieren. Migration ist bewusst, speichert und liest SecretStorage zurück; alte Benutzerkonfiguration wird nicht automatisch gelöscht. Abbruch/Fehler dürfen keinen Schlüsselverlust verursachen.
- Nur Dummy-Schlüssel und kontrollierte Testserver. Keine kostenpflichtigen Modellanfragen. Private TLS-Testschlüssel außerhalb des Repositorys/Pakets halten. Test-CA-Injektion bleibt ein ausdrücklich gekennzeichneter Laboradapter und kein Produktions-Trust-Bypass.

## Toolchain und Qualität

Manifest: VS Code `^1.80.0`, Entwickler-Node `>=22.13.0`; `.node-version` dokumentiert die geprüfte Node-26.13.0-Baseline, `packageManager` pnpm 11.25.0. Die Extension läuft im eingebetteten Host-Node, auf VS Code 1.80 nachgewiesen Node 16.17.1. Deshalb kein neues produktives globales `fetch` oder unbewiesene neuere Node-API einführen. Versionsänderungen gesondert freigeben.

Installation nur im genehmigten Arbeitsumfang, mit unveränderter Lockdatei: `pnpm install --frozen-lockfile`. Auf exFAT einmalig `--node-linker=hoisted` ergänzen; keine globale Linkeränderung oder Lockdateilöschung. Die zwei gezielten Kandidat-A-Overrides in `pnpm-workspace.yaml` erhalten; keine Force-Upgrades oder ungeprüften globalen Overrides.

Für produktive Änderungen nach Relevanz und Verfügbarkeit:

- `pnpm run lint`, `pnpm run typecheck`, `pnpm run compile-tests`.
- `pnpm run compile`, `pnpm run package` (nur Produktionsbundle).
- `pnpm run test:headless`; für die TLS-Prüfung gültige private Fixtures über `LLM_COMMIT_TEST_TLS_KEY/CERT` bereitstellen. Zuletzt 205 bestanden / sieben Host-Ausnahmen; ohne TLS-Fixture 204 / acht. Das ist ein Nachweisstand, keine erlaubte Obergrenze für neue Tests.
- Installierte Hostsuite gemäß [CI-/Plattform-Anleitung](docs/phase8-ci.md), Minimum und geprüfte aktuelle Version. Isolierte Profile/Extension-Verzeichnisse, echte VSIX-Installation; nicht parallel den Projektbaum als LLM-Development-Extension laden. Zuletzt je 214 bestanden. Realen SecretStorage-Helper von simulierten Command-/Konfigurationsteilen unterscheiden.
- `node --test scripts/package-validation.test.cjs`, aktuell 17 Tests. Bei Transport-/Lifecycleänderungen vorhandene HTTP-/TLS-/Proxyprobes ergänzend ausführen.
- `pnpm audit --json`, `pnpm audit --prod --json` und Git-Diff-/Whitespaceprüfung; Befunde sichtbar lassen, keine Unterdrückung zur grünen Anzeige. Separaten Packager-Audit nicht mit dem Projekt-Audit vermischen.

Ergebnisse als **Erfolgreich**, **Fehlgeschlagen**, **Simuliert** oder **Nicht durchgeführt** führen; erwartete Ablehnung als bestandene Negativprüfung kennzeichnen. Testzahl, OS/Architektur, VS-Code-/Node-Version, Fixture-/Helpergrenzen und Artefakthash festhalten. Ein Typcheck oder Windows-Test ersetzt keinen echten Plattformlauf.

## Packaging, Freigabe und Dokumentationspflege

- `pnpm run package` erzeugt kein VSIX. Der reguläre Prepublish ist JavaScript-only (`npm run package`); Swift/Xcode sind nicht erforderlich. Das vollständige Vier-Provider-VSIX unter Windows bauen, installieren und mit realem Git-/Dummy-HTTP-Command prüfen.
- Vorhandene Paket-Allowlist und Secret-/Entwicklungsartefaktausschlüsse erhalten. Das Paket enthält keine native Integration; vollständiges lokales VSIX bedeutet weiterhin keine Veröffentlichungsfreigabe. Keine Allowlistausweitung als Nebenänderung.
- VSCE 3.9.2 bleibt isoliertes Tooling; ZIP-Inspektion ist unter Node 24 geprüft, unter Node 26 bewusst gesperrt. Keine ungepinnten `npx`-/`dlx latest`-Werkzeuge im Releasepfad.
- Aktueller Status: **7/10, keine Releaseempfehlung**. Vier Projekt-Entwicklungsbefunde, Produktionsaudit null; separater Packager-Audit null nach dem genehmigten B1-Upgrade. Sicherheitsprüfung spätestens **1. Dezember 2026 oder vor der nächsten Releasefreigabe, je nachdem früher**. Keine automatische Akzeptanz neuer Befunde oder nachgewiesener Ausnutzbarkeit.
- Änderungen an Sicherheitsarchitektur, Abhängigkeiten/Overrides, Mindestversion, Hostplatzierung, nativen Paketvarianten und Releaseautomatisierung nur mit passender Freigabe. Routineprüfungen innerhalb bereits genehmigter Arbeit nicht erneut bestätigen lassen.
- Nach Änderungen Status/Issues/Entscheidungen mit Nachweis aktualisieren. Behobene Issues sichtbar erhalten; historische Berichte nicht zu vermeintlich aktuellen Ergebnissen umdeuten. Roadmap-Einträge sind Vorschläge und keine Implementierungsfreigabe.

## Phase 7: entfernte Providerkonfiguration

Die einzigen Provider sind `lm-studio`, `ollama`, `openai`, `custom`. Ein alter Wert `apple` wird mit verständlichem Fehler abgelehnt; niemals auf einen anderen Provider umstellen, Einstellungen ändern, Secrets neu zuordnen oder einen Ersatzrequest starten. Nur der Nutzer wählt einen neuen Provider. Historische Apple-Berichte bleiben unverändert, begründen aber keine aktuelle Funktion oder native Releasevoraussetzung.

## Phase 8: automatisierte Qualitätssicherung

Die GitHub-Actions-CI in .github/workflows/ci.yml ist implementiert und lokal unter Windows validiert, noch nicht in GitHub Actions ausgeführt. Windows/Linux/macOS-Jobs prüfen jeweils VS Code 1.80.0 und 1.144.0. Node 26.13.0/pnpm 11.25.0 bleiben; nur Paketbau/-inspektion nutzt Node 24.22.1. Ein Windows-VSIX wird per Hash in allen Jobs wiederverwendet. Aktueller Packagerstand: [Phase 8.2](docs/phase82-packager.md); ursprüngliche CI: [Phase 8](docs/phase8-ci.md).

Projekt- und isolierten Packager-Lock strikt einfrieren; .github/packager ist kein Teil des Produktionsgraphs. Neue CI-Änderungen zusätzlich mit actionlint und den 16 Tests in scripts/ci/ci.test.cjs prüfen. Keine ungepinnten Actions, Tokens, Marketplace-, Commit-/Push-/Tag-Schritte, TLS-Bypässe oder archivierten privaten Fixtures/Profildaten. Linux-Basic-SecretStorage im Test ist nur für Dummy-Daten und kein OS-Keyring-Nachweis.

Die befristete Projekt-Auditakzeptanz ist auf exakte bekannte Befunde begrenzt. Packagerbefunde haben keine geerbte Akzeptanz. Nach B1 meldet der Packager-Audit null; das unveränderte Gate blockiert weiterhin neue oder geänderte Befunde. Keine erfolgreiche Cloud-/Linux-/Mac-Abnahme behaupten, bevor tatsächlich gemessene Runnerergebnisse vorliegen. Release-Reife bleibt 7/10.

## Phase 8.2: isolierter Packager B1

Nur `.github/packager` verwendet VSCE 3.9.2 mit genau zwei eigenen Eltern-Overrides: `@vscode/vsce@3.9.2>glob` auf 14.0.3 und `@vscode/vsce@3.9.2>minimatch` auf 11.0.4. Den übernommenen geprüften Tool-Lock einfrieren; keine VSCE-4-Migration oder weiteren Overrides ohne Freigabe. Frozen-Installation im eigenen Packager-Workspace ausführen, damit dessen pnpm-workspace.yaml geladen wird; hierbei kein --ignore-workspace. Der getrennte Packager-Audit verwendet weiterhin --ignore-workspace. Das Projekt-Lockfile und dessen Kandidat-A-Overrides bleiben getrennt und unverändert. Lokal vollständiges VSIX und beide Windows-Hosts bestanden; GitHub Actions weiterhin nicht ausgeführt.
