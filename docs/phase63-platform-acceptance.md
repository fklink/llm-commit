# Phase 6.3 – Reale Plattformabnahme

Stand: 1. November 2026. Grundlage sind die vollständige Phase-6.3-Anweisung einschließlich der nachgereichten Abschnitte 4–8, die drei Phase-6.2-Berichte und die vorhandenen Validierungsskripte.

**Ergebnis: verfügbare Windows- und Laborprüfungen abgeschlossen; die plattformübergreifende Abnahme bleibt offen. Release-Reife weiterhin 6/10, keine Releaseempfehlung.** Keine neue reale Linux-, Apple- oder Remote-Umgebung ist hinzugekommen. Kein erfolgreicher Windows-Test wird als Ersatz dafür gewertet.

## 1. Tatsächlich verfügbare Umgebungen

Die Erfassung erfolgte erneut in der bereitgestellten Windows-Sitzung: Betriebssystem/Architektur, ausführbare Werkzeuge, Sitzungsmerkmale, WSL-Ausgabe, vorhandene VS-Code-Installationen und Testartefakte. Es wurden keine fremden Hosts kontaktiert, keine VM-/Container-Infrastruktur eingerichtet und keine Zugangsdaten gesucht.

| Umgebung | Befund | Status der Plattformprüfung |
|---|---|---|
| Windows x64 | Realer Windows-Host, NT 10.0.26300; VS Code 1.80.0 / Node 16.17.1 sowie 1.144.0 / Node 24.22.1 | **Erfolgreich** für die unten aufgeführten automatisierten Prüfungen |
| Linux | Keine zugängliche Linux-Sitzung; keine gefundenen Docker-/Podman-/nerdctl-/Multipass-/QEMU-Werkzeuge | **Nicht durchgeführt** |
| Apple-Silicon-macOS | Kein zugänglicher Mac, kein Swift-Compiler, kein `bin/fm-cli` | **Nicht durchgeführt** |
| Remote-SSH | OpenSSH-Client vorhanden; keine SSH-Sitzung, keine Benutzer-SSH-Konfiguration und kein vom Nutzer genanntes autorisiertes Testziel | **Nicht durchgeführt**; Clientinstallation allein ist keine Testumgebung |
| Dev Containers | Keine zugängliche Container-Laufzeit, keine devcontainer-CLI | **Nicht durchgeführt** |
| WSL | `wsl.exe` vorhanden, Ausgabe ausdrücklich „Windows-Subsystem für Linux ist nicht installiert“ | **Nicht durchgeführt** |
| Remote-/Trust-Testdoubles | Bestehende Sicherheits- und Git-Regressionen | **Simuliert**, keine reale Remote-Abnahme |
| Unternehmensnetzwerk | Eigene lokale HTTP-/TLS-/Proxy-Fixtures vorhanden; kein verwalteter Proxy oder Unternehmens-Truststore | Laborprüfungen **Erfolgreich**; reale Unternehmensabnahme **Nicht durchgeführt** |

Die Umgebungsprüfung betrifft zugängliche Ressourcen dieser Sitzung; sie beweist nicht, dass außerhalb dieser Sitzung keinerlei Server existieren. `wsl --list --quiet` lieferte die Nicht-installiert-Meldung, beendete sich aber innerhalb von zehn Sekunden nicht. Der eigene Diagnoseprozess wurde beendet. Kein WSL installiert. Das ist eine Werkzeug-/Umgebungsgrenze und kein neu belegter Extension-Fehler.

## 2. Erneut ausgeführte Windows-Prüfungen

Vorhandene Infrastruktur wurde wiederverwendet: `scripts/installed-platform-suite.cjs`, `compatibility-probe.cjs`, `proxy-compatibility-probe.cjs`, `tls-transport-probe.cjs`, `validate-apple.cjs` und die bestehenden isolierten Launcher/Profile. Nur Ergebnisdateien und kleine Pfadanpassungen der bereits vorhandenen temporären Launcher wurden im neuen temporären Artefaktverzeichnis abgelegt. Keine neue Testinfrastruktur oder Projektdependency.

| Prüfung | Ergebnis | Nachweisgrenze |
|---|---|---|
| `pnpm run lint` | **Erfolgreich**, Exit 0 | Bestehender Projekt-Lintumfang |
| `pnpm run typecheck` | **Erfolgreich**, Exit 0 | Keine produktiven Quellen verändert |
| `pnpm run compile`, `pnpm run package` | **Erfolgreich**, beide Exit 0 | Entwicklungs-/Produktionsbundle; `package` ist kein vollständiges natives VSIX |
| `pnpm run test:headless` mit privaten Dummy-TLS-Fixtures | **Erfolgreich**, 217 bestanden, sieben erwartete Host-Ausnahmen | Testskript kompiliert auch die Tests neu |
| Installierte Suite unter VS Code 1.80.0 / Node 16.17.1 | **Erfolgreich**, 226 bestanden, Exit 0 | Realer Windows-Extension-Host |
| Installierte Suite unter VS Code 1.144.0 / Node 24.22.1 | **Erfolgreich**, 226 bestanden, Exit 0 | Realer Windows-Extension-Host |
| `node --test scripts/package-validation.test.cjs` | **Erfolgreich**, zehn bestanden | Dateiallowlist und Testpaketvertrag |
| Neun direkte TLS-Prüfungen auf Node 16/24/26 | **Erfolgreich** | Privater Test-Trust-Anker, falscher Hostname, Abbruch während Body; echte lokale TLS-Sockets |
| Git-Diff-/Whitespaceprüfung | **Erfolgreich** | Zusätzlich Hashvergleich aller 59 vor Phase 6.3 erfassten Projektdateien |
| Neue Frozen-Installation | **Nicht durchgeführt** auf Windows | Keine Dependencies verändert; unveränderte Lockdatei. Erfolgreicher Phase-6.2-Frozen-Lauf bleibt historischer Nachweis |

Die installierten Kompatibilitätsprobes bestätigen Aktivierung, registrierte Commands, echte Git-API und geöffnetes Repository sowie tatsächliches Speichern/Lesen/Löschen eines Dummy-Secrets durch den isolierten Helper. Die Generierung verwendet das tatsächlich installierte Bundle und einen echten lokalen HTTP-Server; UI-, Konfigurations- und SCM-Komponenten dieses Generierungsprobes sind Testdoubles. Kein kostenpflichtiger Modellaufruf und keine behauptete reale Ollama-/LM-Studio-Inferenz.

Die gesamten vorhandenen Sicherheits-, Git-, Provider-, Prompt-, Transport- und Lifecycle-Suiten sind erfolgreich. Dazu gehören Empfänger-/Providerbindung, Migration, Workspace-Trust-Guards, Repository-Auswahl, Entwurfsschutz, Antwortreihenfolge, Prompt-Literalersetzung, JSON-/Konfigurationsvalidierung, Redirectsperre, Benutzerabbruch und Timeout. Workspace-Trust-Policy und Remote-Kontextwechsel werden hierbei **simuliert** geprüft. Die isolierten automatisierten Hosts starten mit deaktivierter Trust-UI; ein echter interaktiver Trust-Entzug ist damit **nicht durchgeführt**.

## 3. Linux und Apple Foundation Models

| Zielprüfung | Status in Phase 6.3 | Erforderliche Voraussetzung |
|---|---|---|
| Linux: Frozen-Installation, Lint/Typecheck, beide Builds | **Nicht durchgeführt** | Echte Linux-Laufzeit, Git, Node/pnpm entsprechend Runbook und unveränderte Lockdatei |
| Linux: VSIX-Installation, Aktivierung, Hosttests, Git-Auswahl, Pfade | **Nicht durchgeführt** | Passende VS-Code-Binaries Minimum/aktuell, isolierte Profile und echtes installiertes Test-VSIX |
| Linux: SecretStorage, Workspace Trust | **Nicht durchgeführt** | Funktionierender Desktop/Keyring bzw. ausdrücklich dokumentiertes Backend; interaktive Trust-Abnahme |
| Linux: HTTP/HTTPS, Timeout/Abbruch | **Nicht durchgeführt** | Kontrollierte lokale Server und TLS-Fixtures unter Linux |
| Apple-Preflight auf vorhandenem Windows | **Erfolgreich als Negativprüfung**, erwarteter Exit 2 | Meldet fehlenden echten Apple-Silicon-Mac; keine Mac-Simulation |
| Swift-Build und Prüfung der nativen Binary | **Nicht durchgeführt** | Apple Silicon, macOS 26+, Swift 6.2+, Framework/SDK |
| FoundationModels-Verfügbarkeit / CLI-Smoke | **Nicht durchgeführt** | Tatsächlich aktiviertes Apple Intelligence, bereitgestelltes Modell; `--check` muss `available` melden |
| Tatsächliche Apple-Modellinferenz | **Nicht durchgeführt** | Erfolgreiche Verfügbarkeitsprüfung und Dummy-Prompt auf realem Modell |
| Apple-Timeout, Abbruch und Prozessbereinigung | **Nicht durchgeführt** | Echte Inferenz und beobachteter eigener CLI-Prozess; stdin-Prozesskill allein genügt nicht |
| Vollständiges VSIX mit Apple-Binary; Installation und Apple-Provider | **Nicht durchgeführt** | Geprüftes natives Artefakt, sicherer Stagingprozess, Ausführungsrechte und installierte Mac-Abnahme |

Das vorhandene [Runbook](phase62-platform-runbook.md) reicht für die Vorbereitung aus und wurde nicht dupliziert oder umgebaut. Swift-Kompilierung, `--check`, echte Inferenz und installierte Integration bleiben vier getrennte Nachweise. Es wurde kein vollständiges natives VSIX erzeugt. Das Phase-6.2-Testpaket ohne Applebinary wurde unter Windows erneut **aus seiner vorhandenen Installation** getestet, nicht erneut installiert. Archiv- und installierte Bundlehashes stimmen weiterhin mit den Phase-6.2-Nachweisen überein.

## 4. Remote-Abnahme

Alle realen SSH-/Container-/WSL-Prüfungen sind **Nicht durchgeführt**, weil die entsprechenden Umgebungen fehlen. Aus den erfolgreichen lokalen Hosts (`remoteName=null`, `extensionKind=1`) folgt keine Platzierungsentscheidung für Remote.

| Prüfpunkt | Vorhandener Nachweis | Offene reale Abnahme |
|---|---|---|
| Extension-Host-Platzierung | **Erfolgreich** lokal; **Nicht durchgeführt** remote | Tatsächlichen Prozess-/Hostort je Verbindung mit „Show Running Extensions“ aufzeichnen |
| Netzwerkziele / Loopback | **Erfolgreich** lokale Fixtures; **Nicht durchgeführt** remote | Client- und Remote-Fixture unterscheiden; `127.0.0.1` und bewusstes Portforwarding nach tatsächlichem Hostort prüfen |
| Workspace Trust | **Simuliert**, Regressionen bestanden | In echter Remote-Sitzung Vertrauen widerrufen, keinen API-Versand zulassen |
| SecretStorage / Empfängerbindung | **Erfolgreich** Helper-Speicher lokal; **Simuliert** Sicherheitslogik/Remote-Wechsel | Dummy-Credential lokal/remote, andere Autorität bei gleichem `remoteName`, neue Sitzung und Zieländerung prüfen |
| Git-Repository-Auswahl | **Erfolgreich** reale Windows-Git-Integration; **Simuliert** weitere Kontextfälle | Zwei Remote-Repositories, expliziter SCM-Kontext, entfernte/geschlossene Repositories |

Der bestehende Schutz bleibt unverändert: provider- und ursprungsgebundene Freigaben; flüchtige Remote-Sitzungskennungen statt persistenter Wiederverwendung allein nach `remoteName`. Das Bestehen dieser Regressionen ist kein Beleg dafür, dass alle realen Remote-Hosts und deren Speichersysteme abgenommen sind. Es wurde kein lokales Secret an einen anderen Host übertragen.

## 5. Unternehmensnetzwerkprüfungen

Nur eigene lokale kontrollierte Gegenstellen, reservierte `.invalid`-Ziele und private Testzertifikate. Keine echte Proxy-Anmeldung, keine bezahlten APIs und kein TLS-Bypass. System-/Benutzertruststores wurden nicht verändert.

| Prüfung | Status / Messergebnis | Bedeutung |
|---|---|---|
| Explizites VS-Code-`http.proxy`, `proxySupport=override` | **Erfolgreich** in beiden echten Hosts: HTTP erreicht den Proxy | Hostintegration vermittelt den nativen Transport |
| HTTPS durch CONNECT mit ausdrücklich gesetzter privater Test-CA | **Erfolgreich** in beiden Hosts: kompletter Tunnel/JSON-Body | CA nur im vorhandenen Laboradapter; Hostname und `rejectUnauthorized=true` bleiben erhalten |
| Derselbe Tunnel ohne Trust-Anker | **Erfolgreich als Negativprüfung**: Verbindung wird abgelehnt | Kein Abschalten der Zertifikatsprüfung |
| Kontrolliert abgelehnter CONNECT-Tunnel | **Erfolgreich als Negativprüfung**, Proxykontakt messbar, Verbindung scheitert kontrolliert | Das bewusst gescheiterte Request ist kein Nachweis erfolgreicher HTTPS-Generierung |
| Proxyvariablen beim VS-Code-Hoststart | **Erfolgreich**: je Host ein HTTP-Request und ein CONNECT zum exakt kontrollierten Ziel | Startup-Verhalten erneut bestätigt |
| Änderung von Proxyvariablen erst in laufender Sitzung | **Fehlgeschlagen für die gewünschte Proxyverbindung**, kein Proxykontakt | Bereits in Phase 6.2 gemessene Grenze; keine neu entdeckte Regression |
| Proxyvariablen in reinem Node-16/24/26-Modus ohne zusätzliche Aktivierung | **Fehlgeschlagen für die Proxyverbindung**, kein Proxykontakt | Nicht mit dem gepatchten VS-Code-Host gleichsetzen |
| `NODE_EXTRA_CA_CERTS` vor Start, ohne Testadapter | **Erfolgreich** unter Node 24/26; **Fehlgeschlagen** unter Node 16 im Electron-Run-as-Node-Modus | Kein allgemeiner Nachweis für OS-Truststores oder den vollständigen Extension Host; bestehende Phase-6.2-Grenze bestätigt |
| Falscher TLS-Hostname / nicht vertrauenswürdiges Zertifikat | **Erfolgreich als Negativprüfung**, Verbindung abgelehnt | TLS-Prüfung aktiv |
| Eigenes geschlossenes Ziel / laufender Bodyabbruch | **Erfolgreich als Negativprüfung**, kontrolliertes Scheitern | Keine vertraulichen Rohantworten in den Probeberichten |
| Systemproxy/PAC/WPAD, authentifizierter Proxy, HTTPS-Proxyserver | **Nicht durchgeführt** | Kein eingerichteter Systemproxy bzw. bereitgestellte Unternehmensinfrastruktur |
| Unternehmens-CA im administrierten System-Truststore | **Nicht durchgeführt** | Kein entsprechender Truststore/verwalteter Host verfügbar |

Die Windows-Benutzerkonfiguration meldet keinen aktivierten manuellen Proxy, keine Proxyadresse, keine PAC-Adresse und kein aktiviertes AutoDetect. Daraus wird keine allgemeine Aussage über unbekannte Unternehmensrichtlinien abgeleitet.

Offene Voraussetzungen: eigener administrierter Testproxy einschließlich Authentifizierungsfällen/PAC, verwaltete Windows-/Linux-/Mac-Hosts mit erlaubter CA-Bereitstellung, kontrollierte HTTPS-Gegenstelle und Messung im tatsächlichen Extension Host. API-Authorization und Proxy-Authorization müssen getrennt bleiben. Sichere CA-Einrichtung bevorzugen; bei fehlendem Trust kontrolliert abbrechen. Der gesonderte [Proxy-/Trust-Plan aus Phase 6.2](phase62-readiness.md#proxy-trust-plan-für-eine-gesonderte-freigabe) bleibt ein Lösungsvorschlag, keine Implementierung. Kein eigener Proxyagent oder unsicherer TLS-Fallback ergänzt.

## 6. Technische Probleme und Sicherheitsstatus

**Keine neue produktive Regression nachgewiesen.** Erneut bestätigt sind fehlende reale Testumgebungen sowie die bereits dokumentierten Grenzen bei dynamischen Proxyvariablen und dem zusätzlichen CA-Trust im Node-16-Electron-Testmodus. Die Diagnosezeitüberschreitung des nicht installierten WSL wird als Werkzeugproblem getrennt geführt. Es wurden keine produktiven Fehler eigenständig behoben.

Zusätzlich erneut ausgeführt: vollständiger Dependency Audit mit **vier** Befunden (zwei niedrig, zwei mittel; erwarteter Exit 1) und Produktionsaudit mit **null** Befunden (Exit 0). Advisory-Mengen wurden mit Phase 6.2 verglichen. Weiterhin betroffen: webpack/GHSA-8fgc-7cc6-rx7x und GHSA-38r7-794h-5758, minimatch/GHSA-g3hv-75wg-m249, glob/GHSA-3g3m-2fjr-6pw4. Konkrete aktuelle Pfade stehen in der Evidenzdatei; keine neuen Overrides oder Upgrades.

Die befristete Akzeptanz endet weiterhin am **1. Dezember 2026 oder bei der nächsten Releasefreigabe, je nachdem früher**; neue Befunde oder belegte Ausnutzbarkeit sind nicht erfasst. Der separate Packager-Audit aus Phase 6.2 mit zwei mittleren Tooling-Befunden wurde in Phase 6.3 **Nicht durchgeführt**; vor Release neu bewerten. Keine behauptete frische Freigabe dieses Toolings.

## 7. Release-Blocker und konkrete nächste Maßnahme

1. **Apple/native Paketabnahme:** echter geeigneter Mac; Build, Verfügbarkeit, Inferenz, Prozess-Lifecycle und installierter Apple-Provider müssen separat bestehen. Ohne Binary bleibt das Testpaket unvollständig.
2. **Linux:** realer Runner mit Desktop/Keyring, VS Code Minimum/aktuell und installiertem Paket. Vollständige Runbook-Prüfung einschließlich Trust und Lifecycle.
3. **Remote:** je freigegebener SSH-Host, Container und WSL tatsächliche Platzierung, Loopback, Repository-Auswahl und getrennte Sicherheitsfreigaben prüfen.
4. **Enterprise:** verwaltete Proxy-/CA-Umgebung bereitstellen oder den behaupteten Supportumfang entsprechend begrenzen. Erst bei im echten Host belegter Lücke einen gesonderten produktiven Patch freigeben.
5. **Release-Security:** Auditakzeptanz und Packagerbefunde vor nächster Freigabe erneut bewerten; keine automatische Verlängerung.

**Release-Reife: unverändert 6/10.** Nach dem bestehenden Raster: Regressionen/Build 2/2, Windows Minimum/aktuell 2/2, Packaging 1/2, Linux/Apple/Remote 0/3, Sicherheitsnachweise 1/1 mit klar begrenztem Umfang. Wiederholte Windows-Tests erhöhen die Verlässlichkeit vorhandener Nachweise, schließen aber kein neues Plattform-Gate. Deshalb keine Aufwertung und keine Releaseempfehlung.

**Empfohlene nächste Maßnahme:** Zugang zu einem Apple-Silicon-Mac (macOS 26+, Swift 6.2+, verfügbares Modell) und einem realen Linux-Runner bereitstellen; dann das vorhandene Runbook ausführen. Für Remote zusätzlich ein ausdrücklich freigegebenes Ziel nennen. Keine zusätzliche Infrastruktur erfinden und keine Produktänderung als Ersatz für fehlende Nachweise.

## 8. Dateien, Unverändertheit und Abschluss

Neu angelegt wurden ausschließlich:

- `docs/phase63-platform-acceptance.md` – dieser vollständige Bericht.
- `docs/phase63-evidence.json` – Inventar, echte Hostberichte, Testzahlen, Proxy-/TLS-Messungen, Auditpfade und Hashnachweise.

Alle 59 vor Phase 6.3 erfassten Projektdateien sind bytegleich geblieben, einschließlich Produktionscode, Swift, Sicherheitsmechanismen, Tests, Manifest, Mindestversion, Lockdatei und Releasekonfiguration. Bereits vorhandene uncommittete Änderungen früherer Phasen wurden nicht zurückgesetzt. Das Produktionsbundle stimmt nach erneutem Build mit dem geprüften installierten Bundle überein.

Die Rohlogs und ausschließlich privaten Testartefakte liegen im in der Evidenzdatei genannten temporären Verzeichnis. Keine Commits, Pushes, Releases oder nächste Entwicklungsphase. Die kontrollierte Phase-6.3-Validierung ist im tatsächlich verfügbaren Umfang abgeschlossen; fehlende reale Plattformabnahmen bleiben ausdrücklich offene Release-Blocker.
