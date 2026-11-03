# Phase 7 – Apple Foundation Models entfernt

Stand: **2. November 2026**. Umfang: ausdrücklich genehmigte vollständige Entfernung der Apple-Integration einschließlich nachgereichter Abnahmekriterien 1–10. **Implementierung und technische Validierung abgeschlossen; keine Veröffentlichung. Release-Reife: 7/10, keine Releaseempfehlung.** [Maschinenlesbare Evidenz](phase7-evidence.json).

## 1. Entfernte Komponenten und verbleibender Umfang

Unterstützt sind ausschließlich **LM Studio, Ollama, OpenAI und Custom OpenAI-kompatible APIs**. Entfernt wurden:

- Apple-Auswahl/Enum-/Beschreibungseinträge und native Hinweise in aktuellen Manifestsettings.
- `generateWithApple`, `runFMCli`, CLI-Pfad und native Fehlercodetabelle; `execFile`-/Pfadimporte ausschließlich dafür.
- Apple-spezifischer Kindprozess-/Close-/Terminierungszustand der Operation. Eigene HTTP-Abbruchcontroller, Timer, Ressourcen, Anfrage-IDs, unabhängige Repository-Anfragen und Deaktivierung bleiben.
- Swift-Paket, CLI-Quelle, Swift-Buildscript und Apple-Prepublish-Schritt; leere Swift-Verzeichnisse ebenfalls entfernt. Keine native Binary im Projekt/Paket.
- Ausschließlich entfallene Provider-/Prozess-/Real-Child-Tests und zugehörige Testfixture-Simulationen.
- Apple-Mac-Validierungsskript, obsolete Binary-/Swift-Ignorepfade und alter unvollständiger Testpaketmarker.

Der Literal-Promptbuilder, Modellauflösung der vier HTTP-Provider und Antwortvalidierung bleiben. Es wurde keine zusätzliche Runtime-Dependency eingeführt, kein Upgrade durchgeführt, keine Git-Semantik, kein Origin-/SecretStorage-Schema und kein Mindesthost geändert.

## 2. Sicherer Umgang mit alten Einstellungen

Ein bestehender Wert `llm-commit.provider: "apple"` wird als entfernter Provider erkannt. Die Fehlermeldung erklärt, dass der Nutzer LM Studio, Ollama, OpenAI oder Custom ausdrücklich selbst auswählen muss. Kein automatischer Ersatzprovider, keine stille Änderung von User-/Workspacewerten, kein Netzwerkfallback und keine Übernahme vorhandener Keys.

Neue Regressionen prüfen User- und Workspace-Apple-Konfiguration jeweils nach Speicherung eines Dummy-OpenAI-Keys: Generierung, Schlüsselsetup und Schlüsselentfernung senden nichts und verändern weder Einstellungen, Credentialmap noch Approvalmap. Die ursprüngliche Apple-Plattformprüfung im Securitytest wurde in eine plattformunabhängige Fail-closed-Prüfung umgewandelt. Alle anderen Security-Assertions bleiben erhalten.

`src/security.ts`, `src/transport.ts`, Lockdatei und Overrides sind gegenüber Phase-7-Start bytegleich. 14 geschützte Funktionen in `extension.ts` sind nach Normalisierung der Zeilenenden unverändert, darunter komplette Sicherheitsanbindung, Git-Auflösung/Identität, Diff und Entwurfserhaltung, Providerkonfiguration, Prompt-/Antwortvalidierung und HTTP-Generierung. Keine bestehenden Benutzerfreigaben oder Secrets wurden neu zugeordnet.

## 3. Build und vollständiges Paket

`vscode:prepublish` ist jetzt **`npm run package`**, `build:swift` entfällt. Regulärer Entwicklungs-/Produktionsbuild und Prepublish bestanden unter Windows. `swift`, `xcodebuild` und `xcrun` waren nicht verfügbar und wurden nicht benötigt.

Die bestehenden Skriptnamen `package-test-vsix.cjs` und `inspect-test-vsix.cjs` bleiben für Aufrufkompatibilität erhalten. Sie erzeugen/prüfen jetzt das **vollständige HTTP-Provider-VSIX**, nicht mehr ein temporär verändertes Testmanifest:

- Regulärer VSCE-Package-Lauf vom Projekt aus, mit tatsächlichem Prepublish-Hook.
- Originales Manifest und Displayname bleiben im Archiv unverändert; kein gelöschter Hook, kein Testmarker.
- Die sechs erlaubten Runtime-Ressourcen plus zwei VSIX-Metadatendateien ergeben **acht Archiveinträge**.
- Entwicklungs-/Secretartefakte bleiben ausgeschlossen, `AGENTS.md` wird zusätzlich ausgeschlossen. Die strenge Allowlist wird nicht erweitert.
- Manifestprüfer erzwingt vier Provider, unverändertes Minimum und JavaScript-Prepublish; Bundleprüfung weist native Integrationssignaturen zurück.

Artefakt: `llm-commit-0.2.0-phase7.vsix`, **55.169 Bytes**, SHA-256 `f2fbf4526fd9f5a4bd83f9b7ec207411f88ca8733921ed48973ed29fed246915`. Bundle-SHA-256 `519dfcc2228c276dd6bce455dfcbb8eb6800c0c488e6d3a64ce19797da371675`. Vollständige Archiveinträge und Größen in der Evidenz. „Vollständig“ bezieht sich auf die bewusst auf vier HTTP-Provider begrenzte Extension; das ist keine Releasefreigabe.

ZIP-Inspektion mit isoliertem VSCE 3.6.2 unter Node 24 bestanden. Die vorhandene Sperre gegen den bekannten Node-26-/Yauzl-Readerstillstand bleibt. Nach Installation ergänzt VS Code selbst `__metadata` im installierten Manifest; nur diese Installermetadaten werden beim Vergleich ausgeklammert. Das Manifest im VSIX wird ohne diese Ausnahme exakt mit der Projektdatei verglichen.

## 4. Tatsächlich installierter Command in beiden Hosts

Das komplette VSIX wurde tatsächlich in neue isolierte Profil-/Extensionverzeichnisse unter **VS Code 1.80.0 / Node 16.17.1** und der lokal installierten aktuellen Version **1.144.0 / Node 24.22.1** installiert. Das Projekt wurde dabei nicht parallel als LLM-Development-Extension geladen; nur ein isolierter SecretStorage-Testhelper war Development-Extension.

Zusätzlich zur bisherigen VM-Bundleprobe wurde der tatsächlich registrierte `llm-commit.generate`-Command aufgerufen:

1. Eigene temporäre Git-Repositories ohne Commits, echte Dummy-Dateien mit Unicode und `$&`, über reale Git-API gestagt.
2. Eigener kurzlebiger HTTP-Server auf einem freien Loopbackport; Konfiguration im isolierten Testworkspace auf Custom mit Dummy-Modell/Prompt.
3. Tatsächlicher installierter Command liest den realen gestagten Diff und durchläuft produktive Provider-, Sicherheits- und Transportpfade.
4. Je Host genau **eine** HTTP-Anfrage, korrekter Prompt-/Diffinhalt, **kein Authorization-Header**, erwartete Antwort im echten SCM-Eingabefeld.
5. Testeinstellungen und ursprüngliches Test-SCM-Feld werden wiederhergestellt; eigener Server geschlossen. Nur neu angelegte Testprofile erhalten die eigene Dummy-Originfreigabe; bestehende Benutzerprofile bleiben unberührt.

**Präzise Nachweisgrenze:** Nur die Antwort des modalen Autorisierungsdialogs wird mit einem Testdouble bestätigt, ausschließlich wenn Aktion und exakte selbst kontrollierte Dummy-Origin passen. Danach wird die originale UI-Methode wiederhergestellt. Sicherheitslogik, persistierte Testfreigabe, Command, Git, HTTP und SCM sind echt; keine Git-/HTTP-Doubles in diesem zusätzlichen Probe. Echte manuelle Dialog-/Trust-Abnahme ist **Nicht durchgeführt**. Automatisierte Hosts nutzen `--disable-workspace-trust`; die Trust-Policy bleibt separat durch Regressionen mit Doubles geprüft.

Die Presetports 1234/11434 waren belegt. Es wurde weder ein dort vorhandener Server angesprochen noch beendet. Der Probe wurde deshalb auf die eigene Custom-Origin umgestellt. Es gab keine echten Modell- oder kostenpflichtigen API-Aufrufe.

## 5. Regressionen und Qualitätsprüfungen

Vor den Korrekturen wurden vier neue Provider-/Prepublish-/Legacy-Tests geschrieben; **alle vier schlugen erwartungsgemäß fehl**. Die neuen Packaging-Vertragstests wurden vor Ergänzung der Prüffunktionen ebenfalls rot ausgeführt. Nach Implementierung:

| Prüfung | Status / Ergebnis |
|---|---|
| `pnpm install --frozen-lockfile --node-linker=hoisted` | **Erfolgreich**, Exit 0, Lockfile unverändert; lokales exFAT-Flag |
| `pnpm run lint`, `typecheck`, Testkompilierung | **Erfolgreich**, Exit 0 |
| `pnpm run compile`, `package`, `vscode:prepublish` | **Erfolgreich**, Exit 0, JavaScript-only |
| Headless mit privaten TLS-Fixtures | **Erfolgreich**, **205 bestanden**, sieben hostgebundene Ausnahmen |
| Headless ohne TLS-Fixture | **Erfolgreich**, 204 bestanden, acht Ausnahmen; zusätzlicher TLS-Fall benötigt Zertifikatsdateien |
| Installierte Hostsuite Minimum | **Erfolgreich**, **214 bestanden**, inklusive echter zusätzlicher Git-/HTTP-Generierung |
| Installierte Hostsuite 1.144.0 | **Erfolgreich**, **214 bestanden**, gleiche Prüfungen |
| Packagingtests | **Erfolgreich**, **17 bestanden** |
| Neun zusätzliche TLS-Probes | **Erfolgreich**, Trust, falscher Hostname und Bodyabbruch auf Node 16/24/26 |
| Vollständiger VSIX-Bau / Inspektion | **Erfolgreich**, acht Einträge, Hash-/Originalmanifest-/Allowlist-/Secretmusterprüfung |
| Tatsächliche isolierte Installation | **Erfolgreich**, beide Hosts, gleiches Bundle wie im inspizierten Archiv |
| Dependency Audit | **Erfolgreich ausgeführt**, Exit 1 wegen vier bekannten Restbefunden |
| Produktionsaudit | **Erfolgreich**, Exit 0, null Befunde |
| Separater Packager-Audit | **Erfolgreich ausgeführt**, Exit 1 wegen zwei weiterhin offenen mittleren Befunden |
| Git-Diff / Whitespace / historische Hashes | **Erfolgreich**; 18 historische Bericht-/Evidenzdateien unverändert |
| Reale Linux-/macOS-/Remote-/Enterpriseabnahme | **Nicht durchgeführt**, keine neuen entsprechenden Umgebungen bereitgestellt |
| Echte Consent-/Trustdialog-UX | **Nicht durchgeführt**; Consent-Antwort im automatisierten Probe ausdrücklich **Simuliert** |

### Nachvollziehbare Testzählung

| Bereich | Bis 6.3 | Nach Phase 7 | Grund |
|---|---:|---:|---|
| Security | 43 | 43 | Alter Apple-Plattformfall wird Legacy-Fail-closed-Fall |
| Git-/Generation | 32 | 32 | Unverändert |
| Provider/Prompt/Validierung | 83 | 84 | Drei ausschließlich Apple-Fälle entfernt; vier neue Fälle (davon User/Workspace parametrisiert) |
| Lifecycle | 43 | 30 | 13 ausschließlich native Fälle entfernt; gemischter Apple/HTTP-Shutdown durch zwei unabhängige HTTP-Anfragen ersetzt |
| Transport | 23 | 23 | Unverändert |
| Funktionale Summe | 224 | 212 | Nur entfallene Funktionalität entfernt |
| Host inkl. Sample und installiertem Probe | 226 | 214 | Sieben echte Git-/Konfigurationstests laufen im Host statt Headless-Ausnahme |

AST-Abgleich bestätigt unveränderte Assertions sämtlicher behaltenen Testtitel. Die umbenannten/ersetzten Fälle sind separat im Evidenzdelta aufgelistet; sie werden nicht als unverändert ausgegeben. Weitere Fachassertionen wurden nicht abgeschwächt. Die niedrigere Zahl ist kein Weglassen von HTTP-/Security-/Git-Funktionalität.

## 6. Dateien

**Geändert:**

- `src/extension.ts` – Provider-/CLI-/Prozessentfernung, kontrollierte Legacy-Meldung, HTTP-Shutdown ohne nativen Close-Zustand.
- `src/test/provider.test.ts`, `src/test/lifecycle.test.ts`, `src/test/security.test.ts` – nur entfallene Fälle/Fixtures und neue bzw. angepasste Regressionen.
- `package.json` – Providerumfang, Beschreibungen und Prepublish; Dependencydeklarationen/Mindestversion unverändert.
- `.gitignore`, `.vscodeignore` – obsolete native Pfade entfernt, Entwicklungsdokument ausgeschlossen.
- `scripts/package-validation.cjs`, `scripts/package-validation.test.cjs`, `scripts/package-test-vsix.cjs`, `scripts/inspect-test-vsix.cjs` – vollständiger Paketvertrag und native Ausschlüsse.
- `scripts/compatibility-probe.cjs`, `scripts/installed-platform-suite.cjs` – zusätzlicher realer installierter Command, isolierter Kontext und begrenzte Consent-Simulation.
- `README.md`, `CHANGELOG.md`, `AGENTS.md`, `docs/PROJECT_STATUS.md`, `docs/ROADMAP.md`, `docs/ISSUES.md`, `docs/DECISIONS.md` – aktueller Vier-Provider-Stand; alte Apple-Historie klar als historisch markiert.

**Gelöscht:** `swift/fm-cli/Package.swift`, `swift/fm-cli/Sources/main.swift`, `scripts/validate-apple.cjs`.

**Neu:** dieser Bericht und `docs/phase7-evidence.json`. Keine andere Dependency-/Git-/HTTP-Sicherheitsdatei wurde geändert. Alle vorhandenen uncommitteten Änderungen aus früheren Phasen wurden erhalten.

## 7. Bundle-, Manifest- und VSIX-Kontrolle

Keine Swift-/FoundationModels-/CLI-/Child-Process-Integration im produktiven Bundle. Keine Apple-Providerauswahl, native Buildscripts oder Binarypfade im Manifest. Keine nativen, Swift-, Test-/Entwicklungs-, Lock- oder Secretdateien im VSIX. Der begrenzte Credentialmusterscan meldet keinen Treffer, ist aber kein mathematischer Beweis der Abwesenheit beliebiger Secrets.

Verbleibender Text ist beabsichtigt: der produktive Legacy-Fehler nennt den entfernten Provider, Regressionen/Prüfmuster weisen dessen Wiedereinführung zurück und historische README-/Changelog-/Berichtsinhalte dokumentieren frühere Zustände. Diese Texte sind keine verbliebenen Integrationsbestandteile. Historische Berichte wurden nicht rückwirkend umgeschrieben.

## 8. Abweichungen und Werkzeuggrenzen

- Die erste Harnessprüfung behandelte Windows-Laufwerksbuchstaben unterschiedlich groß; ausschließlich der Guard wurde auf plattformeigenes `path.relative` umgestellt.
- Belegte Presetports wurden sicher vermieden. Eine automatische Anfrage an vorhandene lokale Dienste wäre kein kontrollierter Dummytest gewesen.
- Ohne simulierte Consent-Antwort erreichte der automatisierte Command den eigenen Server nicht. Die End-to-End-Prüfung ist jetzt erfolgreich, aber bestätigt keine echte Dialog-UX. Der UI-Helfer scheiterte bei der Zustandsaufnahme mit `window id ... no longer belongs to Microsoft.VisualStudioCode; current owner is Microsoft.VisualStudioCode`; nach erneuter Auswahl blieb das Problem bestehen. Keine UI-Sicherheitsaktion wurde ausgeführt und keine Produktkorrektur hierfür vorgenommen.
- Der bekannte Legacy-ZIP-Leser bleibt unter Node 26 eingeschränkt; Inspektion unter Node 24 ist bestanden. Keine Tooling-Upgrades als Nebenreparatur.
- VS Code ergänzt Installermetadaten lokal; die Paketquelle selbst ist unverändert verglichen. Keine Behauptung byteidentischer VSIX über Maschinen oder dauerhaft archivierter temporärer Logs.

## 9. Restbefunde, Release-Reife und nächste Aufgabe

Die vier Projektbefunde bleiben **offen**, nicht durch Apple-Entfernung behoben:

- webpack 5.100.2: GHSA-8fgc-7cc6-rx7x und GHSA-38r7-794h-5758, niedrig, Build-HTTP-Feature nicht aktiviert.
- minimatch 3.1.5/5.1.9/9.0.9: GHSA-g3hv-75wg-m249, mittel; kontrollierte Muster, unterstützte Elternmigration nötig.
- glob 10.5.0 unter Test-CLI: GHSA-3g3m-2fjr-6pw4, mittel; betroffener Signalbudgetpfad nicht verwendet.

Separat weiterhin zwei mittlere Toolingmeldungen im isolierten VSCE-Graph: minimatch 3.1.5 direkt / 10.2.6 über glob sowie glob 11.1.0, dieselben beiden minimatch/glob-Advisories. Vollständige neue Auditpfade in der Evidenz. Keine automatische Risikoakzeptanz für Packager oder neue Befunde.

**Sicherheitsprüfung spätestens 1. Dezember 2026 oder vor der nächsten Releasefreigabe, je nachdem früher.** Bestehende begrenzte Akzeptanz wird nicht verlängert und gilt nicht bei neuer nachgewiesener Ausnutzbarkeit.

**7/10:** Qualität 2/2, Windows Minimum/aktueller Host 2/2, vollständiges Paket plus tatsächlicher installierter Git-/HTTP-Command 2/2, andere reale Plattformen/Remote 0/3, Sicherheitsnachweise 1/1 mit offengelegten Restrisiken. Der Punktgewinn beruht auf dem vollständigen Paket im bewusst reduzierten Umfang, nicht auf erfundenen Mac-/Inferenztests. Keine Releaseempfehlung: reale Linux-/macOS-HTTP-, Remote-/Keyring-/Trust- und Enterpriseabnahmen, manuelle UI und gesonderte Audit-/Releaseentscheidung bleiben offen.

**Empfohlene nächste Maßnahme:** den jetzigen vollständigen HTTP-VSIX-Stand mit denselben vorhandenen Fixtures auf realem Linux und macOS sowie autorisierten Remote-/Enterprisezielen prüfen. Keine Swift-/Apple-Inferenzinfrastruktur mehr aufbauen. Danach gezielte Toolchain-/Releaseautomatisierung separat entscheiden und freigeben.

Phase 7 endet hier. Keine Commits, Pushes, Releases, Veröffentlichung oder weitere Entwicklungsphase.
