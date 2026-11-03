# Phase 6.2 – Release-Readiness, 1. November 2026

**Bewertung: 6/10, keine Releaseempfehlung.** Die Windows-HTTP-Kompatibilität einschließlich Mindestversion ist erneut bestätigt. Eine vollständige plattformübergreifende Freigabe scheitert weiterhin an fehlenden realen Linux-, Remote- und Apple-Abnahmen sowie dem fehlenden nativen Paketartefakt. Diese Bewertung ist keine Freigabe zum Veröffentlichen.

Bewertungsraster: Regressionen/Build 2/2, Windows Mindest-/aktuelle Version 2/2, Paketnachweis 1/2 (nur JavaScript-Testpaket), Linux/Apple/Remote 0/3, Security-Nachweise 1/1 mit ausdrücklich offenen Unternehmensprüfungen. Keine Aufwertung durch Simulationen.

## Umfang und Nachweise

Produktionsquellen, Swift-Paket, Manifest, Mindestversion, Lockdatei, Overrides und Packaging-Regeln wurden in dieser Phase nicht geändert. Drei kleine Validierungsskripte und dieser Bericht mit Runbook und maschinenlesbaren Belegen wurden ergänzt. Keine Commits, Pushes, Veröffentlichungen oder Folgephase.

Neu:

- `scripts/proxy-compatibility-probe.cjs`: kontrollierte eigene HTTP-/CONNECT-Gegenstelle, reservierte `.invalid`-Ziele, zeitlich begrenzte Anfragen; Wiederherstellung veränderter Einstellungen ausschließlich im isolierten Testprofil. Optionaler privater Test-Trust-Anker nur im VM-Testadapter.
- `scripts/installed-platform-suite.cjs`: portabler Extension-Host-Einstieg für das tatsächlich installierte VSIX; verhindert versehentliche Prüfung des Entwicklungsverzeichnisses und verlangt den SecretStorage-Helfer.
- `scripts/validate-apple.cjs`: echte Plattformprüfung, getrennte Build-/Verfügbarkeits-/Inferenz-/Prozessprüfungen; legt weder ein Releasebinary noch eine Signatur an.
- `docs/phase62-evidence.json`: frische Auditpfade, Hostberichte, Proxy-/TLS-Ergebnisse, Paketinspektion, unveränderte Baseline und Loghashes.
- `docs/phase62-platform-runbook.md`: reproduzierbare Linux-/Mac-/Remote-Abnahme und CI-Vorschlag.

Die Rohartefakte liegen außerhalb des Repositorys im in der Evidenzdatei bezeichneten temporären Verzeichnis. Private Testschlüssel bleiben dort und werden nicht ins Paket oder Repository übernommen. Ausschließlich Dummy-Eingaben und Dummy-Zugangsdaten, keine kostenpflichtige Modellanfrage. Lokale Fixture-Server sind keine laufende Ollama-/LM-Studio-Installation; deren reale Modellinferenz ist nicht nachgewiesen.

## Release-Readiness-Matrix

P1 = Freigabeblocker für den angegebenen Supportumfang; P2 = begrenzte Kompatibilitäts-/Infrastrukturfrage; P3 = befristet dokumentiertes Entwicklungsrisiko. Fehlende Nachweise sind keine bewiesenen Produktfehler.

| Plattform / Umgebung | Tatsächlicher Aufbau | Prüfungen / Ergebnis | Problem / Schwere | Maßnahme / fehlende Voraussetzung |
|---|---|---|---|---|
| Windows x64 Minimum | Windows 11, VS Code 1.80.0, Node 16.17.1, isoliertes Profil, installiertes Test-VSIX | **Erfolgreich:** 226 Hosttests, Aktivierung, echte Git-API/-Repos, SecretStorage des Helfers; Generierung mit installiertem Bundle und realem lokalem HTTP, UI/Providerkonfiguration dabei Testdoubles | Kein Fehler der Mindestkompatibilität gefunden; kein vollständiger manueller Provider-/UI-Test | Manuelle Abnahme mit echtem lokalen Modellserver vor Release |
| Windows x64 aktuell | VS Code 1.144.0, Node 24.22.1 | **Erfolgreich:** dieselben 226 Tests und Paketaktivierung; SecretStorage, Git, Draft-/Reihenfolgeschutz | Native Apple-Funktion fehlt im Testpaket, P1 für vollständiges Release | Mac-Artefakt und installierte native Integration prüfen |
| Windows HTTP/HTTPS | Eigene HTTP-/TLS-Fixtures; Node 16/24/26; zwei echte VS-Code-Hosts | **Erfolgreich:** native HTTP-Generierung, TLS-Trust/Hostname/Bodyabbruch, Redirectsperre, Timeout/Benutzerabbruch und Antwortvalidierung; neun zusätzliche direkte TLS-Probes | Private CA im Laboradapter ist keine konfigurierte Unternehmens-CA | Truststore-Abnahme separat |
| Windows Proxy | Eigener HTTP-Proxy, exakte erlaubte Ziele, eigene CONNECT-TLS-Gegenstelle | **Erfolgreich:** `http.proxy` mit `proxySupport=override`: HTTP und HTTPS-Tunnel mit Test-CA in beiden Hosts; untrusted CA wird abgelehnt. Proxyvariablen beim Hoststart: HTTP und CONNECT erreichen Proxy | Laufende Änderung der Umgebungsvariablen greift im Test nicht; reine Node-Modi nutzen sie ohne zusätzliche Aktivierung nicht. Auth-/PAC-/HTTPS-Proxyserver nicht geprüft, P2 | Unterstützte Startkonfiguration dokumentieren; keine pauschale Behauptung fehlender Proxyunterstützung |
| Windows Systemproxy / Enterprise | Systemproxy war nicht eingerichtet; keine Unternehmens-CA verfügbar | **Nicht geprüft:** PAC/WPAD, OS-Truststore, TLS-Inspection, Proxy-Authentifizierung. **Labor:** zusätzliche CA funktioniert bei Node 24/26 im Electron-/Node-Modus; bei Node 16 wird sie dort nicht übernommen | Keine belastbare Unternehmensfreigabe, P1 bei entsprechendem Supportversprechen | Reale verwaltete Umgebung, Adminbereitstellung des Test-Truststores; kein TLS-Bypass |
| Linux x64/arm64 | Keine Linux-Laufzeit verfügbar; WSL nicht installiert; kein Docker/Podman/VM | **Nicht geprüft:** VSIX-Installation, Hostaktivierung, Git, SecretStorage, Pfade, HTTP/HTTPS, Lifecycle | Plattformnachweis fehlt, P1 | Reale Linux-Runner mit Desktop/Keyring bzw. dokumentiertem SecretStorage-Backend; Runbook ausführen |
| macOS / Apple Silicon | Kein Mac, kein Swift-Compiler, kein `bin/fm-cli` | **Nicht geprüft:** Swift-Build, ausführbares Artefakt, `--check`, echte Inferenz, installierte Integration. Windows-Preflight meldet korrekt blockiert (Exit 2) | Zentrales beworbenes Feature und Paket fehlen, P1 | Apple Silicon, macOS 26+, Swift 6.2+, aktiviertes Apple Intelligence und verfügbares Modell |
| macOS Intel / weitere Architekturen | Nur Quell-/Manifestanalyse | **Nicht geprüft:** HTTP-Pfad auf Intel; Apple-Modellunterstützung nicht aus erfolgreichem Cross-Build ableitbar | Kein Architekturnachweis, P2; kein Universalbinary vorhanden | HTTP auf Intel separat testen, Apple-Zweig ausdrücklich an reale Verfügbarkeit binden |
| Remote-SSH / Container / WSL | Keine autorisierten SSH-Ziele, keine Container-Laufzeit, kein WSL | **Simuliert:** Sicherheitsregressionen für getrennte Remote-Kontexte bestehen. **Nicht geprüft:** echter Hostort, Loopback, Keyring, Trust, erneute Sitzung | Reale Platzierung/Netzwerkerreichbarkeit offen, P1 für Remote-Support | Je Umgebung echte Verbindung mit freigegebenen Testzielen; keine Weiterverwendung lokaler Schlüssel voraussetzen |
| Vollständiges VSIX | Neu gebautes JavaScript-Testpaket, 57.065 B, neun Archiveinträge | **Erfolgreich:** Allowlist, Bundlehash, Installation in beiden Windows-Versionen; kein Fund im begrenzten Secretmusterscan | **Unvollständig:** Applebinary fehlt. Windows-Dateimodi beweisen keine POSIX-Ausführbarkeit, P1 | Native Mac-Artefakte erstellen, nach Installation Ausführungsrechte und Inferenz prüfen |

## Tatsächlich ausgeführte Prüfungen

| Prüfung | Ergebnis |
|---|---|
| `pnpm install --frozen-lockfile --node-linker=hoisted` | Exit 0; Lockdatei unverändert; linker nur wegen exFAT auf diesem Rechner |
| `pnpm run lint`, `typecheck`, `compile-tests`, `compile`, `package` | Alle Exit 0; `package` ist Produktionsbundle, kein vollständiges Release-VSIX |
| `pnpm run test:headless` ohne TLS-Fixture | 216 bestanden, acht ausgenommen; eine zusätzliche TLS-Prüfung benötigt Fixture-Dateien |
| Derselbe Headless-Lauf mit privaten TLS-Fixtures | **217 bestanden, sieben hostgebundene Tests ausgenommen** |
| Vollständige installierte Hostsuite, 1.80 / aktuell | **226 / 226 bestanden**, je Host; inklusive neuem portablen Kompatibilitätseinstieg und vorhandenen Phase-1–6.1-Regressionen |
| `node --test scripts/package-validation.test.cjs` | Zehn bestanden |
| Direkte TLS-Probes | Neun bestanden: Trust, falscher Hostname, Abbruch beim Body auf Node 16/24/26 |
| Proxyprobe separat und im Extension Host | Kontrollen erfolgreich; konkrete Unterstützungsgrenzen siehe Matrix/Evidenz, erwartete negative Fälle sind keine Testerfolge des Verbindungsaufbaus |
| Startup-Proxyprobe | Node 16/24/26 ohne Opt-in: kein Proxykontakt. VS Code Minimum/aktuell: jeweils ein HTTP-Aufruf und ein CONNECT an das exakt kontrollierte Ziel |
| Startup-CA-Probe ohne Testadapter | Node 16/Electron-Modus: CA nicht übernommen; Node 24/26: übernommen. Keine Aussage über OS-Truststore oder vollständigen Extension Host |
| Test-VSIX / ZIP-Inspektion | Paketbau erfolgreich; Inspektion unter Node 24 erfolgreich; installierte Bundlebytes identisch zum Produktionsbundle |
| Apple-Runner auf Windows | Erwartet blockiert, keine simulierte Mac-Abnahme |
| Syntaxchecks der drei neuen Skripte; Git-Diff-/Whitespaceprüfung | Erfolgreich; alle vor Phase 6.2 bestehenden erfassten Dateien unverändert |

Phase-1-Sicherheitsfälle, Kontext-/Keybindung, Workspace Trust, Migration, Promptvalidierung, Redirectschutz, Abbruch, Entwurfsschutz und veraltete Ergebnisse sind in den erfolgreich wiederholten Suiten enthalten. Die echte SecretStorage-Prüfung betrifft den isolierten Helfer; Integration der Extension-Speicherlogik wird zusätzlich durch Regressionen mit Doubles geprüft. Keine pauschale Gleichsetzung mit einer echten Remote- oder Schlüsselbundmigration.

## Audit und verbleibendes Risiko

Frischer Projekt-Audit: **vier** Befunde (zwei niedrig, zwei mittel), Produktionsaudit **null**. Exakte, auch mehrfach auftretende Lockfilepfade und korrigierte Bereiche sind vollständig in `phase62-evidence.json` gespeichert; keine Unterdrückung eingeführt.

| Advisory / Version | Abhängigkeitspfade (Gruppen) | Aktuelle Erreichbarkeit / Maßnahme |
|---|---|---|
| GHSA-8fgc-7cc6-rx7x, webpack 5.100.2, niedrig | direkt; ts-loader → webpack; webpack-cli und configtest/info/serve → webpack | `experiments.buildHttp` nicht aktiviert; fix ab 5.104.1. Nur vertrauenswürdige Buildkonfiguration. Separates Upgrade erforderlich, nicht durchgeführt |
| GHSA-38r7-794h-5758, webpack 5.100.2, niedrig | dieselben webpack-Pfade | HTTP-Build-Redirectfunktion nicht verwendet; fix ab 5.104.0. Kein Bezug zur Extension-API-Redirectsperre |
| GHSA-g3hv-75wg-m249, minimatch 3.1.5/5.1.9/9.0.9, mittel | ESLint/eslintrc/config-array/rimraf/glob; typescript-estree; Mocha/glob; test-cli → c8/test-exclude/glob | Kontrollierte lokale Muster; keine bewiesene Ausnutzung. Fixbereich ≥11.0.1 erfordert unterstützte Elternmigration; breites Override war inkompatibel |
| GHSA-3g3m-2fjr-6pw4, glob 10.5.0, mittel | @vscode/test-cli 0.0.10 → glob | Aufrufer nutzt das betroffene AbortSignal-Budget nicht; Fix ≥14.0.2. Kein Upgrade in dieser Validierung |

Bisherige befristete Risikoakzeptanz bleibt exakt begrenzt: **1. Dezember 2026 oder nächste Releasefreigabe, je nachdem früher**. Neue Befunde oder nachgewiesene Ausnutzbarkeit sind nicht erfasst. Die nächste Releasefreigabe verlangt eine erneute bewusste Bewertung.

Separates isoliertes Packaging-Tooling (`@vscode/vsce` 3.6.2): **zwei mittlere** Auditmeldungen, nicht den vier Projektbefunden hinzurechnen oder als Produktionsabhängigkeiten darstellen: minimatch 3.1.5 direkt unter vsce und 10.2.6 unter vsce → glob; glob 11.1.0 unter vsce (dieselben beiden glob/minimatch-Advisories). Kontrollierte Packaging-Muster reduzieren die derzeit nachgewiesene Erreichbarkeit; keine geprüfte pauschale Risikoakzeptanz für eine künftige Releasepipeline. Vor Freigabe Toolumgebung separat aktualisieren oder explizit bewerten. Keine Upgrades vorgenommen.

Werkzeugproblem getrennt: Der legacy ZIP-Leser aus VSCE 3.6.2 wurde schon in Phase 6.1 unter Node 26 als blockierend erkannt. Die vorhandene Inspektionssperre bleibt erhalten; Inspektion wurde mit Node 24 durchgeführt. Der Projekt-Lintlauf ist erfolgreich. Keine neue ESLint-Reparatur oder Dependencyänderung.

## Proxy-/Trust-Plan für eine gesonderte Freigabe

Es ist **kein generelles Fehlen von Proxyunterstützung** nachgewiesen: VS Code vermittelt native Requests im echten Host. Ein eigener Proxyagent würde dieses Verhalten möglicherweise verdoppeln. Daher zuerst den unterstützten Konfigurationsvertrag festlegen und die Hostintegration regressionsfest machen.

1. Hostmatrix mit Proxyvariablen beim Start, VS-Code-Einstellungen, PAC, Systemproxy und Neustartverhalten prüfen. Proxykonfiguration ohne Geheimnisse diagnostizieren, keine PAC-/Proxy-URLs mit Zugangsdaten loggen.
2. Authentifizierte HTTP-Proxys, CONNECT und HTTPS-Proxyserver getrennt testen. API-Authorization ausschließlich für den autorisierten Ursprung; Proxy-Authorization ausschließlich zum Proxy. Redirects bleiben gesperrt. Plaintext-HTTP-Proxys sehen HTTP-Nutzdaten; dafür kein neues Sicherheitsversprechen ableiten.
3. Reale CA-Kette und Hostname im Tunnel testen, einschließlich abgelaufener/falscher Zertifikate und verwalteter Stores auf allen Hosts. Sichere administrierte Trust-Anker bevorzugen; kein `rejectUnauthorized=false`, kein Abschalten über Workspacekonfiguration. Die Node-16-Electron-CA-Grenze zuerst in einem echten verwalteten Host reproduzieren.
4. Erst bei belegter Lücke einen kleinen Transportpatch separat freigeben: keine parallele Proxyauflösung zum Host, klare Konfigurationspräzedenz und Vertrauensgrenze, Abbruch während CONNECT/DNS/TLS/Body, Proxyfehler redigiert, keine automatischen Credential-Fallbacks auf neue Ziele. Keine zusätzliche Dependency ohne Wartungs-/Node-16-Prüfung.

Der aktuelle sichere Betriebsweg ist die im jeweiligen Host geprüfte Proxy-/Trustkonfiguration. Bei fehlender vertrauenswürdiger CA kontrolliert abbrechen und HTTP-Provider nicht verwenden, statt Zertifikatsprüfung zu umgehen. Apple ist nur nach eigener realer Modellabnahme eine Alternative.

## Priorisierte Release-Blocker und nächste Aufgabe

1. **P1 Apple/VSIX:** realen Apple-Silicon-Mac bereitstellen; Swift-Build, `--check`, Inferenz und installierte Prozess-/Rechteabnahme getrennt durchführen. Kein Paket mit angeblich vollständiger Apple-Unterstützung ohne Binary.
2. **P1 Linux:** installierte Suite mit SecretStorage, Git und TLS auf realem Linux ausführen; x64/arm64-Unterstützung nur nach entsprechendem Nachweis behaupten.
3. **P1 Remote:** tatsächliche Hostplatzierung und Trust-/Empfängerkontexte in SSH, Container und WSL prüfen; keine pauschale Remote-Freigabe aus Unit-Tests.
4. **P1/P2 Enterprise:** reale Proxy-/CA-Matrix vervollständigen, Supportumfang begrenzen oder gezielten Patch gesondert freigeben.
5. **P3 Toolchain:** vier akzeptierte Projektbefunde fristgerecht und zwei Packagerbefunde vor Release neu bewerten; reproduzierbare Node-24-Packagingprüfung verwenden.

**Konkrete nächste Aufgabe:** einen geeigneten Mac und einen Linux-Runner für das beigefügte Runbook bereitstellen und zuerst das vorhandene Swift-CLI ohne Produktänderung real validieren. Danach einen gesondert freizugebenden, durch diese Ergebnisse bestimmten Packaging-/Plattformpatch planen. CI-/Releasearchitektur bleibt ein Vorschlag; keine weitere Phase gestartet.
