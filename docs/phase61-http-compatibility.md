# Phase 6.1 – BUG-004: HTTP-Kompatibilität mit VS Code 1.80

Stand: 2026-11-01. **BUG-004 ist für die tatsächlich geprüften Windows-Hosts behoben.** engines.vscode bleibt ^1.80.0. Keine neuen Dependencies, keine Git-/Apple- oder Release-Architekturänderung, keine Commits/Pushes/Veröffentlichung und keine Folgephase.

## 1. Ursache und Regression zuerst

Der reale VS-Code-1.80.0-Host verwendet Node 16.17.1 ohne globales fetch. Der bisherige Sicherheitsadapter delegierte seinen bereits autorisierten POST an genau dieses Global. Header-/Bodyvalidierung konnte daran nichts ändern: die HTTP-Anfrage wurde nicht gesendet und kein Committext übernommen.

Vor der Korrektur wurde scripts/http-node16-regression.cjs erstellt und mit der tatsächlichen 1.80-Code.exe im Node-Modus ausgeführt. Der kompilierte Generierungscommand mit eigenem loopbackgebundenem OpenAI-kompatiblem Dummyserver ließ das Eingabefeld leer; die gezielte Assertion schlug mit Exit 1 fehl. Nach der Korrektur besteht derselbe Fall mit tatsächlich empfangenem POST und übernommener Dummy-Nachricht. Es wird weder fetch noch Response in den VM-Kontext eingeschleust.

Die spätere installierte Bundle-Probe liest exakt das aus dem Test-VSIX installierte dist/extension.js. SCM, Konfiguration und Zustimmung werden in dieser Command-Probe als explizite Testdoubles bereitgestellt; HTTP-Verbindung, Node-Laufzeit und Bundlecode sind real. Daneben prüfen die Hosts echte Git-/SecretStorage-APIs und die bestehende reale Git-Integration. Es wird kein manueller vollständiger UI-/Modell-Inferenzlauf behauptet.

## 2. Node-API-Analyse

| API | Node 16.17.1 / Konsequenz |
|---|---|
| global fetch | fehlt; produktive Abhängigkeit entfernt |
| Request/Response/Headers/Web-ReadableStream | kein produktiver Runtime-Bedarf mehr; nur schmale eigene POST-/JSON-Typen |
| AbortController / AbortSignal / EventTarget | vorhanden; bisheriger Operation-Controller bleibt Eigentümer von Abbruch/Timeout |
| http.request / https.request | vorhanden; dieselbe native Implementierung auf alten und aktuellen Hosts |
| request.destroy / IncomingMessage / async iteration | vorhanden; real für Header- und Bodyabbruch, End-/Fehlerprüfung getestet |
| TLS/Hostname/CA-Prüfung | aktiv, rejectUnauthorized ausdrücklich true; keine unsichere Umgehungsoption |
| zlib gzip/deflate/Brotli, Buffer/URL | vorhanden; Kompression, UTF-8/BOM und mehrteilige Bodies getestet |
| Timer.unref, crypto.randomUUID, execFile mit signal | von Node 16 unterstützt; bestehende Timer-/Apple-Prozesslogik unverändert und Regressionen erfolgreich |
| http.Server.closeAllConnections | erst in neuerem Node vorhanden; nur Testcleanup wurde optional gemacht |

Es wurde keine weitere produktive API-Inkompatibilität in den verwendeten Pfaden festgestellt. Die bestehenden VS-Code-API-Typen wurden zusätzlich gegen exakt 1.80.0 geprüft. Dies ist getrennt vom realen Runtime-Nachweis.

## 3. Alternativen und gewählte Lösung

| Option | Sicherheits-/Wartungsbewertung | Entscheidung |
|---|---|---|
| A: Node http/https | Keine neue Lieferkette; ein gemeinsamer, kleiner JSON-POST-Pfad. Ressourcen, TLS, Redirects und Fehler müssen explizit geprüft werden; genau dafür sind die neuen Tests vorhanden. | Gewählt |
| B: Fetch-Bibliothek/Polyfill | Node-fetch 3 ist grundsätzlich eine bewertbare Node-16-Option, bringt aber zusätzliche Dependencies, ESM-/Bundling- und Node-Stream-Adapterbedarf. Undici 5 unterstützt Node 16, ist laut Upstream seit 2024-04-30 EOL; aktuelle Undici-Linien verlangen neuere Node-Versionen. | Kein ungeprüfter Bibliothekseinbau; kein ungewarteter Undici-Fallback |
| C: Mindestversion erhöhen | Würde die zugesagte Kompatibilität einschränken und benötigt separate Zustimmung sowie einen getesteten neuen Mindesthost. | Nicht nötig, nicht umgesetzt |

Primärquellen: [Node 16 HTTP](https://nodejs.org/download/release/v16.17.1/docs/api/http.html), [Node 16 HTTPS](https://nodejs.org/download/release/v16.17.1/docs/api/https.html), [Undici-LTS](https://github.com/nodejs/undici#long-term-support), [node-fetch-Modulintegration](https://github.com/node-fetch/node-fetch#loading-and-configuring-the-module).

## 4. Implementierung und Sicherheit

Neues src/transport.ts implementiert ausschließlich den tatsächlich benötigten Vertrag: POST mit Stringbody, festem Headerrecord, redirect:error, optionalem AbortSignal und einer Antwort mit Status, json() und cancel(). Es ist absichtlich kein allgemeiner Fetch-Polyfill.

- http/https folgen selbst keinen Redirects. 3xx-Bodies werden geschlossen; die unveränderte ApiSecurity-Grenze blockiert alle 3xx zusätzlich. Ein zweiter Empfänger erhält weder Body noch Dummy-Authorization.
- Secrets/Origin-/Provider-/Ausführungskontextbindung, Workspace-Trust und Prüfung auf Konfigurationswechsel bleiben vollständig in ApiSecurity. Ein nativer Zwei-Empfänger-Test bestätigt, dass der Schlüssel des ersten Ursprungs nicht am zweiten ankommt.
- HTTPS verwendet rejectUnauthorized:true und den normalen Zertifikats-/Hostnamencheck. Kein globaler TLS-Schalter oder Produkt-CA-Override wird eingeführt. Native Standardvertrauensprüfung auf Node 16 wurde außerdem mit einem anonymen HEAD gegen registry.npmjs.org erfolgreich gemessen. Keine Zugangsdaten wurden dabei übertragen.
- Die bestehende Operation startet den Timeout nach Autorisierung und übergibt ihr Signal. Der Transport zerstört Request, Antwort und gegebenenfalls Decoder auch während eines verzögerten Bodys. Listener werden auf Abschluss/Abbruch entfernt. Fehler vor json() werden gespeichert/abgefangen, damit kein unbehandeltes Stream-Error-Ereignis entsteht.
- Header werden pro Anfrage aufgebaut, Content-Length berücksichtigt UTF-8-Bytes. agent:false vermeidet gemeinsam genutzte Keep-alive-Zustände; es gibt keinen neuen globalen Requestzustand.
- JSON wird vollständig gelesen und danach unverändert als unknown an die bestehende Antwortvalidierung übergeben. gzip/deflate/Brotli und UTF-8-BOM sind unterstützt. Trunkierte Bodies, beschädigte Kompression und ungültiges JSON werden kontrolliert abgewiesen.
- Transportfehler liefern nur eine feste Meldung; keine nativen Exceptiontexte, Rohantworten oder Authorization-Werte werden an UI/Logs durchgereicht. Die vorhandene HTTP-Status-/Prompt-/Modell-/Antwortvalidierung und Fehlerredaktion bleiben unverändert.

Ein exakter Quellvergleich gegen den Patchbeginn zeigt: src/extension.ts unterscheidet sich ausschließlich durch den Transportimport und dessen Delegate. src/security.ts unterscheidet sich ausschließlich durch den Import und die Signaturen der schmalen Transporttypen. Nach Rücknahme genau dieser Stellen sind beide Dateien bytegleich mit der Ausgangsbasis. Damit bleiben auch Git-Auswahl, Commit-Entwurfsschutz, Anfragekennungen, Apple-Steuerung und sämtliche Credential-/Consentmethoden unverändert.

## 5. Geänderte Dateien

- Neu: src/transport.ts; src/test/transport.test.ts (23 Tests); src/test/transport-fixture.ts (Testadapter, kein produktives Polyfill).
- Produktanbindung: src/extension.ts, src/security.ts – ausschließlich die oben beschriebenen Stellen.
- Bestehende Testfixtures: security.test.ts, generation.test.ts, git.integration.test.ts, provider.test.ts, lifecycle.test.ts. Der bisherige HTTP-Stub wird in den neuen Transportimport injiziert; JSON-Testantworten benötigen keine globale Response-Klasse. Testcleanup benutzt closeAllConnections optional. Alle bisherigen Assertions bleiben erhalten; keine Tests deaktiviert.
- Neu: scripts/http-node16-regression.cjs und scripts/tls-transport-probe.cjs. Angepasst: scripts/compatibility-probe.cjs prüft die native Bundle-Generierung statt ein nicht mehr benötigtes fetch-Global zu verlangen.
- Dokumentation: README.md, CHANGELOG.md, historischer Hinweis in docs/phase6-readiness.md, dieser Bericht und phase61-evidence.json.

Manifest, Mindestversion, Lockdatei, Overrides, webpack-/Packaging-Konfiguration und Swift-Quellen bleiben unverändert.

## 6. Tatsächlich ausgeführte Prüfungen

| Prüfung | Ergebnis |
|---|---|
| Node-16-Regressionscommand vor Implementierung | absichtlich fehlgeschlagen; ursprünglicher Fehler reproduziert |
| derselbe Node-16-Regressionscommand nach Implementierung | erfolgreich, realer POST/Body und Commit-Dummytext |
| VS Code 1.80.0 / Node 16.17.1, installiertes Patch-Test-VSIX | **226 bestanden** |
| VS Code 1.144.0 / Node 24.22.1, installiertes Patch-Test-VSIX | **226 bestanden** |
| pnpm run test:headless | **217 bestanden**, sieben hostabhängige Fälle übersprungen |
| Node 16/24/26: lokale vertrauenswürdige TLS-Verbindung, falscher Hostname, Bodyabbruch | **neun TLS-Proben bestanden** |
| Selbstsigniertes, nicht vertrautes HTTPS-Zertifikat | in beiden vollständigen Hostläufen abgewiesen |
| SecretStorage-API / echte Git-API im installierten Host | beide Versionen erfolgreich; nur Dummy-Einträge, danach gelöscht |
| Lint / Typecheck / Testkompilierung | bestanden |
| Entwicklungs-/Produktionsbuild | bestanden |
| exakte 1.80-API-Typprüfung | bestanden, isolierte Typdefinitionen ohne Projektänderung |
| Frozen-Installation auf exFAT | bestanden mit --node-linker=hoisted, Lockdatei unverändert |
| bestehende Packagingtests / Test-VSIX-Archivprüfung | zehn bestanden; neun erwartete Dateien; Bundle bytegleich geprüft |
| Dependency-/Produktionsaudit | unverändert vier Restbefunde / null |
| Scope-, Git-Diff- und Whitespace-Prüfung | bestanden |

226 = die bisherigen 203 Prüfungen inklusive Aktivierungs-Smoke plus 23 neue Transporttests. 217 = die bisherigen 194 Headless-Prüfungen plus 23. Alle sieben Git-/Konfigurations-Hostfälle liefen auf beiden Hosts wirklich. Die Suite deckt weiterhin 43 Sicherheits-, 32 Git-/Entwurfs-, 83 Provider-/Prompt- und 43 Lifecycle-Fälle ab. Kein kostenpflichtiger Modellaufruf, keine echten API-Schlüssel, keine Anfragen an die vorhandenen lokalen Modellserver. Der Dummyserver spricht das benötigte OpenAI-kompatible JSON-Protokoll; tatsächliche Modellinferenz wird nicht behauptet.

Die TLS-Positiv-/Hostname-/Abbruchproben verwenden echte TLS-Verbindungen mit einer ausschließlich im Testadapter explizit gesetzten temporären Test-CA; die produktive Funktion erhält keine CA-Konfiguration. Die Zertifikate/Privatschlüssel sind lokale Dummy-Testartefakte außerhalb von Repository/VSIX. Node 16/Electron übernimmt NODE_EXTRA_CA_CERTS in dieser Testumgebung nicht wie die Entwickler-Node-Laufzeit; deshalb wurde diese Annahme nicht als positiver Vertrauensnachweis verwendet. Default-Ablehnung unvertrauter Zertifikate und öffentliches Default-Vertrauen wurden separat geprüft.

Für vollständige reproduzierbare TLS-Tests vor dem Lauf per OpenSSL ein kurzfristiges Dummy-Schlüsselpaar mit SAN IP:127.0.0.1 im temporären Verzeichnis erzeugen und LLM_COMMIT_TEST_TLS_KEY / LLM_COMMIT_TEST_TLS_CERT setzen. Die zusätzliche Negativprobe verwendet einen ebenfalls nur lokalen Testanker mit falscher SAN IP:127.0.0.2. Ohne gesetzte TLS-Fixture markiert die zusätzliche untrusted-certificate-Testfunktion sich ausdrücklich als übersprungen; die hier angegebenen Abnahmezahlen stammen aus konfigurierten Läufen mit aktivem TLS-Test. Kein privater Testschlüssel ist eingecheckt.

### Testharness-Befunde getrennt vom Produkt

Im ersten alten Hostlauf scheiterte Testcleanup an der Node-18-Servermethode. Sie ist nun optional. Die alte Git-Erweiterung öffnete die außerhalb des Workspace erzeugten temporären Testrepositories bei openRepositoryInParentFolders:never nicht. Dies wurde ausschließlich im isolierten Profil auf always gesetzt; der zeitweise diagnostisch geänderte Git-Testaufbau wurde wieder auf die ursprünglichen Assertions zurückgesetzt. Kein Git-Produktfix wurde durchgeführt.

Ein erster TLS-Vergleich im VM-Test scheiterte an unterschiedlichen Objekt-Prototypen trotz identischem JSON-Inhalt; die Probe prüft nun dessen tatsächlichen Wert statt Cross-Realm-Prototypidentität. Diese Harnessprobleme wurden nicht als Produktfehler kaschiert. Die endgültigen vollständigen Läufe beider Hosts enden mit Exit 0.

## 7. Sicherheits-/Lifecycle-Regressionen und Grenzen

Alle bisherigen Tests zu SecretStorage, Empfängerbindung, Remote-Kontextsimulation, Workspace-Änderungen, Redirects, Fehlerredaktion, Entwurfsschutz, Multi-Repository-Auswahl, umgekehrter Antwortreihenfolge, unabhängigen Anfragen, Abbruch/Timeout und Deaktivierung bleiben grün. Native Streamabbrüche schließen echte lokale Verbindungen; Listenerfreigabe wird zusätzlich geprüft.

Die tatsächliche macOS-/Apple-Inferenz, Linux, Remote-SSH/Container/WSL, Unternehmensproxy-/Zertifikatsumgebungen und ein vollständiges natives Releasepaket bleiben außerhalb dieser Abnahme. Der ältere Node-/Electron-Host wird durch diesen Patch nicht zu einer allgemein aktuell gewarteten Plattform. JSON wird wie zuvor vollständig gepuffert; allgemeine Responsegrößenlimits oder eine Streaming-API wurden nicht als zusätzliche Funktion eingebaut.

Die vier bereits dokumentierten Dependency-Meldungen bleiben unverändert: zwei niedrige webpack-, ein mittlerer minimatch- und ein mittlerer glob-Befund. Produktionsaudit 0. Keine neuen Dependencies, Overrides oder Audit-Ausnahmen. Die bestehende Risikoakzeptanz wird nicht verlängert und ersetzt keine Release-Sicherheitsprüfung.

## 8. Aktualisierte Kompatibilitätsbewertung

**Der konkrete Phase-6-Mindestversions-/HTTP-Blocker ist geschlossen:** der Native-HTTP-Command funktioniert ohne fetch auf Node 16.17.1, und beide tatsächlichen Windows-Hosts bestehen dieselbe gesamte Suite. Die Mindestversion bleibt erhalten. Die Phase-6-Berichte bleiben historische Befunde; daraus wird weder eine vollständige plattformübergreifende Releasefreigabe noch eine neue automatische Releasebewertung abgeleitet.

Maschinenlesbare Ergebnisse: [phase61-evidence.json](phase61-evidence.json). Das Test-VSIX ist weiterhin nur ein markiertes Paket ohne Apple-Binary und kein Release. Die bisherige Release-Architektur wurde nicht geändert.

## 9. Empfehlung

Für die nächste ausdrücklich freizugebende Releasevalidierung denselben Patch auf Linux/macOS und in realen Remote-/Proxy-/Truststore-Umgebungen prüfen, anschließend die weiterhin offenen Apple-Binary-/Inferenz- und vollständigen VSIX-Gates aus Phase 6 abarbeiten. Vor Veröffentlichung erneut Audit und Risikoentscheidung durchführen. Keine dieser weiteren Arbeiten wurde begonnen und keine Extension veröffentlicht.
