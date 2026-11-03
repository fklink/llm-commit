# Architekturentscheidungen

Stand: 3. November 2026. ADR-001 bis ADR-009 dokumentieren den historischen Stand bis Phase 6.3. **ADR-010 ersetzt alle Apple-/Swift-/nativen Packaging-Annahmen dieser älteren Entscheidungen.** HTTP-Sicherheits-/Git-Invarianten bleiben erhalten. **ADR-013 dokumentiert den genehmigten aktuellen Packagerstand und ersetzt die noch offenen B1-Übernahmeannahmen in ADR-012 sowie ältere Toolpins.** Entscheidungen erteilen keine neue Implementierungsfreigabe. [Projektstatus](PROJECT_STATUS.md) · [Issues](ISSUES.md) · [Roadmap](ROADMAP.md) · [Regeln](../AGENTS.md).

## ADR-001 – SecretStorage, Empfänger und Ausführungskontext

**Status: implementiert, Phase 1; erhalten bis 6.3.**

Problem: Workspace-Endpunkte dürfen keine vorhandenen Schlüssel an fremde Empfänger lenken. `ApiSecurity` ist deshalb eine eigene Sicherheitsgrenze in [src/security.ts](../src/security.ts).

Entscheidung: Credential-ID enthält Provider und kanonischen API-Origin; gespeicherter JSON-Datensatz prüft Version, Provider, Origin und Schlüssel. Die Sendefreigabe enthält zusätzlich die Ausführungskontext-ID. Es sind unterschiedliche Identitäten: das Credential selbst trägt nicht die Remote-Sitzungs-ID als Schlüsselbestandteil. Workspace Trust ersetzt die Origin-Freigabe nicht. Nach asynchronen Schritten werden Trust, Provider, vollständige Ziel-URL und Kontext erneut geprüft.

Lokale Zustimmung ist an `local:<machineId>` gebunden und darf für unveränderte Ziele wiederverwendet werden. Remote nutzt eine zufällige flüchtige `remote-session`-ID; `remoteName`/Hostname sind keine dauerhaft verlässliche Remote-Autorität. Freigaben bleiben deshalb je Remote-Host-Sitzung gültig, nicht automatisch auf andere Sitzungen übertragbar. Echte SSH-/Container-/WSL-Abnahme fehlt weiterhin.

Preset-URLs sind fest, LM Studio/Ollama schlüssellos; authentifizierte lokale Server nutzen Custom. Externe Ziele benötigen HTTPS, HTTP bleibt auf erlaubten Loopback beschränkt. Credentials/Fragmente in URLs und Redirects werden abgelehnt. Migration erfolgt nur bewusst aus Benutzerkonfiguration; speichern/zurücklesen, dann manuelle Altwertbereinigung anbieten. Keine automatische Löschung, kein Workspace-Key-Import oder Legacy-Sendefallback. Grund: keine atomare Compare-and-delete-API; Abbruch/Fehler und konkurrierende Änderungen dürfen keinen Datenverlust erzeugen.

Nachweis: [README Sicherheit/Migration](../README.md#security-and-privacy), [Security-Tests](../src/test/security.test.ts), [Phase 6.3](phase63-platform-acceptance.md). Helper-Speicherung im echten Windows-Host ist nachgewiesen; sämtliche Credentialabläufe auf realen Remote-/Mac-Keyrings damit nicht.

## ADR-002 – Repository-Instanz, URI-Identität und Anfrageordnung

**Status: implementiert, Phase 2; Lifecycle ergänzt in Phase 4.**

SCM-Root-Kontext zuerst, URI-Kontext über Git-API, genau ein Repository direkt, sonst bewusster Quick Pick. Ungültiger expliziter Kontext darf nicht still ein anderes Repository wählen. Diff und Übernahme verwenden dieselbe ausgewählte Repository-Instanz.

Anfrageregistrierung/Close-Zuordnung verwenden dagegen Root-URI-Identität, weil Git-API-Wrapper wechseln können; Testdoubles ohne URI haben einen Instanzfallback. IDs werden bereits beim Command-Aufruf vergeben, damit ein später aufgelöster alter Picker keine neue Anfrage verdrängt. Offensein und Neuheit werden nach asynchronen Schritten und vor Übernahme geprüft; verschiedene Repositories bleiben unabhängig.

Ein vorhandener Anfangsentwurf, selbst nur Whitespace, wird nicht automatisch ersetzt. Automatische Übernahme nur bei anfangs exakt leerem, am Ende unverändertem Feld und weiterhin gültiger Anfrage. Geschützte/veraltete Ergebnisse in eigenen ungespeicherten git-commit-Editoren erhalten, bei Editorfehler Dialog/Kopieraktion; Clipboard nicht automatisch verändern. Abgebrochene Ergebnisse werden nicht übernommen/als Alternative geöffnet.

Grenze: InputBox hat keine vollständige Edit-Historie. Eine Bearbeitung mit identischer Wiederherstellung des Anfangswerts kann durch Wertvergleich nicht erkannt werden. Das ist ausdrücklich keine Zusage einer vollständigen Historienerkennung.

Nachweis: [README Git/Entwurf](../README.md#repository-selection-and-commit-draft-protection), [Generierungstests](../src/test/generation.test.ts), [echte Git-Tests](../src/test/git.integration.test.ts), [Phase 6.3](phase63-platform-acceptance.md).

## ADR-003 – Providermodelle in einer bestehenden Einstellung

**Status: implementiert, Phase 3.**

`llm-commit.model` unterstützt ein Provider-zu-Modell-Objekt; Manifestdefault `{}` überlässt automatische Werte dem Provider. Keine zusätzlichen Modellsettings pro Provider. VS Code liefert Benutzer-/Workspacehierarchie; expliziter gültiger Legacy-String bleibt absichtlich ein gemeinsamer Override für alle HTTP-Provider. Das ist dokumentierte Rückwärtskompatibilität, kein unbeabsichtigtes Übertragen eines Manifestdefaults.

| Provider | Aktueller Code-Default | Bedeutung |
|---|---|---|
| LM Studio | `qwen2.5-coder-7b-instruct` | Vorhandener lokaler Standard erhalten |
| Ollama | `qwen2.5-coder:7b` | Ollama-Tag-Syntax |
| OpenAI | `gpt-4.1` | OpenAI-spezifischer Standard statt globalem Qwen-Default |
| Custom | `qwen2.5-coder-7b-instruct` | Bestehender kompatibler Standard; passend zum Server explizit überschreibbar |
| Apple | keine Modellnameneinstellung | Swift verwendet `SystemLanguageModel.default` |

Das sind Projektdefaults, keine Aussage über aktuell beim Nutzer geladene Modelle, externe Verfügbarkeit oder künftige Anbieterempfehlungen. Explizite Modellnamen werden erhalten, aber leere Werte/Steuerzeichen, unbekannte Objektschlüssel und falsche Typen kontrolliert zurückgewiesen.

Nachweis: [src/extension.ts](../src/extension.ts), [Manifest](../package.json), [Provider-/Hierarchietests](../src/test/provider.test.ts), [README Phase 3](../README.md#phase-3-validation-and-compatibility).

## ADR-004 – Gemeinsamer Literal-Prompt und Laufzeitvalidierung

**Status: implementiert, Phase 3.**

HTTP und Apple verwenden denselben Builder. `{diff}` global mit Callback ersetzen; Dollar-Ersetzungstokens und im Diff enthaltenes `{diff}` bleiben literal und werden nicht rekursiv interpretiert. Begrenzung erfolgt vor Einsetzung und Unicode-Codepoint-sicher. `maxDiffLength`: positive Ganzzahl 1–100000, Default 4000. Prompt: nicht leer, mindestens ein `{diff}`. Bewusste Kürzung oberhalb der Grenze ist kein Versprechen, einen beliebig großen Diff vollständig zu senden.

HTTP-JSON als `unknown` behandeln: choices/erstes Element/message/Text und nichtleere normalisierte Nachricht prüfen. Falls vorhanden muss `finish_reason` `stop` sein; fehlender Grund bleibt für existierende kompatible Server erlaubt. Ungültiges JSON, Typfehler, unvollständige Antwort und HTTP-Fehler kontrolliert behandeln. Keine Rohantwort oder Konfigurationswerte in Fehlermeldungen.

Nachweis: [Provider-Tests](../src/test/provider.test.ts), [Transporttests](../src/test/transport.test.ts), [README Phase 3](../README.md#phase-3-validation-and-compatibility).

## ADR-005 – Operation als Eigentümer von Abbruch, Timer und Ressourcen

**Status: implementiert, Phase 4; unter nativem Transport erhalten.**

Jede Operation hat eigenen AbortController, Timer und temporäre Ressourcen. HTTP-Zeitlimit startet unmittelbar vor Versand nach Autorisierung und umfasst Bodydecodierung; Auswahl und Consent verbrauchen es nicht. `timeoutSeconds` ist Ganzzahl 1–600, Default 120. Apple verwendet das kleinere Limit daraus und 60 Sekunden; nativer Outputpuffer bleibt 1 MiB.

Abbruch-/Aktivitätsprüfungen verhindern späten Versand bzw. späte Übernahme. HTTP-Signal beendet echte Requests/Streams. Eigener direkter Apple-Kindprozess wird bei Abbruch/Timeout/Dispose beendet; Shutdown wartet auf dessen `close`. Kein globales Prozesskillen. Öffentliche APIs können Git-/SecretStorage-Aufrufe und modale Dialoge nicht zwangsweise abbrechen; die Operation hört auf zu warten und verwirft späte Ergebnisse. Bereits serverseitig angenommene Modellarbeit lässt sich dadurch nicht rückgängig machen.

Nachweis: [Lifecycle-Tests](../src/test/lifecycle.test.ts), [README Phase 4](../README.md#phase-4-cancellation-timeouts-and-lifecycle), [Phase 6.3](phase63-platform-acceptance.md). Echte Apple-Inferenzabbrüche auf Mac sind **Nicht durchgeführt**; Node-Kindprozess-/CLI-Doubles ersetzen sie nicht.

## ADR-006 – Nativer HTTP-/HTTPS-Transport für Node 16

**Status: implementiert und in echten Windows-Hosts validiert, Phase 6.1.**

Ursache von BUG-004: VS Code 1.80.0 / Node 16.17.1 hat kein globales `fetch`. Typdeklarationen mit Entwicklerversionen bewiesen keine Runtimeverfügbarkeit. Gewählt wurde [src/transport.ts](../src/transport.ts) mit Node-Builtins `http`/`https`, statt Fetch-Polyfill, zusätzlicher Runtime-Lieferkette oder nicht gesondert freigegebener Mindestversionsanhebung. `engines.vscode` bleibt `^1.80.0`.

Schmaler POST-/Stringbody-/JSON-Vertrag, kein allgemeiner Fetch-Polyfill. Header pro Anfrage, UTF-8-Content-Length, `agent:false`, kein eigener globaler Requestzustand. Redirects nicht folgen und 3xx-Body schließen; Security-Grenze weist Redirects zusätzlich zurück. `rejectUnauthorized:true`, Hostname/CA-Prüfung aktiv. Body wird vollständig gelesen, JSON anschließend an bestehende Inhaltsvalidierung übergeben; gzip/deflate/Brotli/BOM unterstützt. Stream-/Trunkierungs-/Kompressionsfehler und Abbruch führen zu festen redigierten Fehlern und Ressourcenbereinigung.

Alternativen wurden im [Patchbericht](phase61-http-compatibility.md) bewertet: Bibliothek würde zusätzliche Adapter-/Bundling-/Wartungsprüfung brauchen; alte Undici-Linie wurde nicht eingebaut; Mindestversion musste nicht erhöht werden. Keine Aussage über aktuelle Bibliotheksversionen aus dieser historischen Entscheidung ableiten.

Nachweis: [Node-16-Regression](../scripts/http-node16-regression.cjs), [Transporttests](../src/test/transport.test.ts), [Phase-6.1-Evidenz](phase61-evidence.json), erneut [Phase 6.3](phase63-evidence.json). Linux/macOS bleiben echte offene Nachweise.

## ADR-007 – Hostvermittelte Proxy-/Trust-Unterstützung zuerst messen

**Status: vorhandenes Verhalten gemessen; zusätzlicher Produktpatch nicht freigegeben.**

Native Requests werden in den geprüften VS-Code-Hosts durch deren Netzwerkintegration vermittelt: explizite VS-Code-Proxykonfiguration und beim Start gesetzte Proxyvariablen erreichen kontrollierte HTTP-/CONNECT-Ziele. Späte Änderung der Umgebungsvariablen greift im Test nicht. Reiner Node-Modus ohne weitere Aktivierung ist nicht gleich dem Extension Host.

Der HTTPS-Tunnel ist mit privater Test-CA im Laboradapter erfolgreich und ohne Trust-Anker korrekt abgelehnt. `NODE_EXTRA_CA_CERTS` funktioniert im geprüften Node-24/26-Modus, nicht im Node-16-Electron-Run-as-Node-Modus. Daraus folgt weder ein genereller Proxydefekt noch eine Freigabe verwalteter Systemtruststores. Kein eigener Proxyagent, kein TLS-Fallback und kein Produktions-CA-Override ergänzt. Erst tatsächliche Lücke im echten verwalteten Host reproduzieren und einen gesonderten sicheren Patch bewerten.

Nachweis: [Phase 6.3 Netzwerk](phase63-platform-acceptance.md), [Proxyprobe](../scripts/proxy-compatibility-probe.cjs), [sicherer Folgeplan](phase62-readiness.md).

## ADR-008 – Begrenzte Dependencykorrektur, getrennte Auditgraphen

**Status: Phase 5 und ausschließlich Kandidat A übernommen.**

Toolchain wurde mit kompatiblen Änderungen gehärtet, ARCH-002 behoben. Kandidat A erzwingt ausschließlich `mocha@10>serialize-javascript` und `terser-webpack-plugin@5>serialize-javascript` exakt 7.1.3. Tatsächlicher Graph wurde geprüft; entfernte randombytes/safe-buffer-Einträge waren ausschließlich nicht mehr benötigte transitive Pfade. Keine B/C/D-Upgrades.

Vier Projekt-Entwicklungsbefunde bleiben sichtbar; null Produktionsbefunde ist kein genereller Sicherheitsbeweis. Zwei separate Packagerbefunde gehören nicht zum Projektgraph und nicht zu dessen Risikoakzeptanz. Befristete Neubewertung **1. Dezember 2026 oder vor der nächsten Releasefreigabe, je nachdem früher**; keine Übertragung auf neue Befunde/Ausnutzbarkeit.

Nachweis: [Toolchainbericht](phase5-toolchain.md), [Kandidat-A-Abnahme](candidate-a-upgrade.md), [Graph](candidate-a-graph.json), [Issues](ISSUES.md).

## ADR-009 – Testpaket ist kein vollständiges natives Release

**Status: Testpackaging implementiert; vollständige Releasearchitektur offen.**

Strenge Ressourcen-Allowlist, Ausschluss von Entwicklungs-/Secretdateien, begrenzter Secretmusterscan und isoliertes VSCE 3.6.2. Nur im temporären Testmanifest werden Swift-Prepublish entfernt und Kennzeichnung/Marker ergänzt. Die sechs Runtime-Ressourcen und neun Archiveinträge sind kein geprüftes Apple-Release mit Binary. Node-24-ZIP-Inspektion ist belegt; vorhandene Node-26-Sperre wird nicht umgangen.

Produktiver Prepublish baut weiterhin Swift mit POSIX-Kommandos. Native Binary, Architektur, Rechte, Modellverfügbarkeit, Inferenz, Signatur-/Quarantänepolitik und installierte Funktion müssen separat abgenommen werden. Plattformtargets, neue CI und explizite Remote-Hostpräferenz sind Vorschläge, keine umgesetzten Entscheidungen. [Runbook/Matrix](phase62-platform-runbook.md) ist aktueller Vorschlag; [release-plan.md](release-plan.md) enthält ältere, inzwischen überholte Mindestversions-/Testzahlabschnitte, siehe [Statusabgleich](PROJECT_STATUS.md).

Nachweis: [Packagingprüfer](../scripts/package-validation.cjs), [zehn Packagingtests](../scripts/package-validation.test.cjs), [Phase 6.3](phase63-platform-acceptance.md). Aktueller Score **6/10, keine Releaseempfehlung**.

## ADR-010 – Vier HTTP-Provider, keine native Apple-Integration

**Status: implementiert und unter Windows validiert, Phase 7 (2. November 2026).** [Abschlussbericht](phase7-removal.md), [Evidenz](phase7-evidence.json).

Ausdrücklich genehmigte Produktentscheidung: Apple Foundation Models vollständig entfernen. Provider sind ausschließlich LM Studio, Ollama, OpenAI und Custom. Swift-Projekt, CLI-Aufrufe/Fehlercodes/Binarypfade, Apple-Unterprozessbesitz, ausschließlich zugehörige Tests und Mac-Validierungsskript sind entfernt. Es gibt keinen Ersatzprovider und keine automatische Migration alter Werte: 'apple' führt zu einem verständlichen Fehler, ohne Netzwerk, Konfigurationsänderung oder Credential-Neuzuordnung.

HTTP-Operationen behalten eigene Controller, Deadline, Anfragekennungen und Ressourcenbereinigung. Nur die nun ungenutzte Kindprozess-Terminierungsverwaltung entfällt. Gleiche Git-Instanz/URI-Identität, Draftschutz, Prompt-Literalersetzung, Providerdefaults, Antwortvalidierung und vollständige Sicherheitsgrenze bleiben erhalten. Credential- und Autorisierungs-IDs werden nicht geändert.

Prepublish ist 'npm run package', ohne Swift/Xcode/POSIX-Native-Build. Die bestehenden Packaging-Skriptnamen bleiben erhalten; sie erzeugen jetzt das vollständige Vier-Provider-VSIX aus dem tatsächlichen Manifest, ohne stage-spezifische Manifeständerung oder alten Testmarker. Die sechs Runtime-Ressourcen und zwei VSIX-Metadatendateien ergeben acht Archiveinträge. Strenge Allowlist, Bundle-/Manifestprüfung und isoliertes VSCE 3.6.2 bleiben; ZIP-Inspektion unter geprüftem Node 24.

Reale Installation unter VS Code 1.80/Node 16 und 1.144/Node 24 sowie tatsächlicher Command mit realem gestagtem Git-Diff, eigener Custom-Gegenstelle und SCM-Übernahme bestanden. **Nur die Antwort des Consentdialogs ist simuliert und ausschließlich für die exakte eigene Dummy-Origin erlaubt**; keine Git-/HTTP-Doubles in diesem zusätzlichen Probe. Keine produktive Freigabe umgangen oder bestehende Benutzerfreigabe verändert. Die isolierten Testprofile enthalten ausschließlich eigene Testzustände.

Apple-Inferenz-/Native-Binary-Gates sind durch bewusste Umfangsänderung entfallen, nicht durch bestandene Mac-Tests. macOS-HTTP, Linux, Remote und Unternehmensumgebungen bleiben offene reale Nachweise. Vier Projekt- und zwei separate Packagerbefunde bleiben nach neuem Audit offen. Release-Reife jetzt **7/10, keine Releaseempfehlung**. Die ursprüngliche Phase-6.3-Bewertung 6/10 bleibt historisch korrekt.

## ADR-011 – Gepinnte CI, ein Paket und getrennte Audit-Gates

**Status: Phase 8 implementiert und lokal Windows validiert; in GitHub Actions nicht ausgeführt.** [Bericht](phase8-ci.md), [Workflow](../.github/workflows/ci.yml), [Evidenz](phase8-evidence.json).

Drei getrennte x64-Jobs (Windows 2025, Ubuntu 22.04, macOS 15 Intel), jeweils VS Code 1.80.0 und 1.144.0. Node 26.13.0/pnpm 11.25.0 bleiben für Qualität; nur einmaliger Windows-VSIX-Bau und ZIP-Inspektion verwenden den bereits geprüften Node 24.22.1. Isoliertes VSCE 3.6.2 samt vorhandener Lockdatei wird ohne Projektdependencyänderung eingefroren.

Ein inhaltlich geprüftes VSIX wird mit Referenzhash an alle Jobs verteilt und tatsächlich installiert. Andere OS bauen zur Qualität lokal, ersetzen das heruntergeladene Paket aber nicht. Fehler einer Hostversion bleiben blockierend, beide Versionen werden versucht. Nach erfolgreichem Paketupload können Linux/macOS auch bei späterem Windows-Host-/Auditfehler prüfen.

Raw-Audits bleiben sichtbar; nur exakte bestehende Projektbefunde vor dem bisherigen Prüftermin dürfen passieren. Keine automatische Packagerakzeptanz: zwei offene mittlere Toolbefunde halten das Gate rot. Neue Pfade, Versionen, Schweregrade, Registryfehler, abgelaufene Akzeptanz oder manipulierte Pakete blockieren. Eine menschliche Neubewertung von Erreichbarkeit und vor Release bleibt erforderlich.

Read-only Repositorytoken, keine gespeicherten Checkoutcredentials, keine Secrets oder Veröffentlichung. Nur eigene Dummy-Server; private TLS-/Profildateien getrennt von Reports. Linux nutzt Xvfb/DBus und ausdrücklich einen Basic-Dummy-Speicherbackend; kein Nachweis sicherer nativer Keyrings. Standard-Runnerimages sind veränderlich, ihre tatsächlich beobachteten Versionen werden protokolliert. Keine neue Produktions-, TLS- oder Providerarchitektur. Release-Reife unverändert 7/10.

## ADR-012 – Packagerkorrektur vor erster CI-Bereitstellung vorbereiten

**Status: vorgeschlagen und isoliert Windows-validiert, Phase 8.1; nicht dauerhaft genehmigt/implementiert.** [Analyse](phase81-preparation.md), [Evidenz](phase81-evidence.json).

VSCE 3.6.2 kann minimatch 11 nicht als bisherigen CommonJS-Funktionsdefault verwenden; ein auditfreier Override allein ist daher unbrauchbar. Bevorzugter Vorschlag: isoliertes VSCE 3.9.2 mit zwei exakt auf diesen Elternpin beschränkten Overrides auf glob 14.0.3 und minimatch 11.0.4. Der engere Graph erhält semver 7.8.5. VSCE 4.1.0 mit minimatch-Override funktioniert ebenfalls, verursacht aber eine breitere Major-Migration. Beide vollständigen VSIX bestanden echte Windows-Installationen und je 214 Tests auf Minimum/1.144.0; Linux/macOS/GitHub Actions wurden nicht ausgeführt.

Keine geerbte oder neue Packager-Risikoakzeptanz, keine Audit-Gateabschwächung. Hauptgraph und Workflow bleiben in dieser Analysephase unverändert. Erst konkrete dauerhafte Korrektur freigeben/validieren, dann gesondert den Repositoryumfang und die Bereitstellung **einschließlich automatischem Push-Trigger** genehmigen. Manueller Dispatch setzt einen im Defaultbranch vorhandenen Workflow voraus. Kein Veröffentlichen, Commit oder Push in der Vorbereitung; Release-Reife bleibt 7/10.

## ADR-013 – B1 dauerhaft, eigener Installationsworkspace und unverändertes Gate

**Status: durch Nutzer für Phase 8.2 freigegeben und dauerhaft implementiert, lokal Windows validiert.** [Bericht](phase82-packager.md), [Evidenz](phase82-evidence.json). ADR-012 ist für B1 umgesetzt; die Aussagen zu noch ausstehender Übernahme in älteren ADRs sind historisch.

Isoliertes VSCE 3.9.2 mit genau zwei eigenen Eltern-Overrides auf glob 14.0.3 und minimatch 11.0.4. Bytegleicher freigegebener B1-Lock, semver 7.8.5 erhalten, keine Änderungen am Projektgraph oder produktiven Quellen. Versionsguards, Provenienz und Workflow-Stepbezeichnung angepasst. Node 24.22.1 bleibt für Paketbau/ZIP-Prüfung; keine ungeprüfte Freigabe von Node 26 aufgrund des neuen Yauzl.

Der zuerst ausgeführte vorhandene Frozen-Installer scheiterte reproduzierbar, weil --ignore-workspace auch die neu benötigten eigenen Overrides ignorierte. Notwendige kleine Anpassung: Installationsprozess mit cwd .github/packager und ohne dieses Flag; Audit weiterhin explizit mit --ignore-workspace. Kein Lock-Neuauflösen oder zusätzlicher Override.

205 Headless, 33 Packaging-/CI-Tests und je 214 installierte Windows-Hosttests inklusive echtem Git/Dummy-HTTP sowie zusätzlichen TLS-Probes bestanden. Packager null / Produktion null, Projekt vier unter derselben befristeten Bewertung. Das unveränderte Audit-Gate besteht lokal ohne Waiver; kein Cloudlauf und keine Bereitstellungs-/Releasefreigabe. Release-Reife bleibt 7/10.

## ADR-014 – Expliziter Konsolidierungsumfang vor erstem CI-Push

**Status: Phase 8.3 vorbereitet, Branch-/Commit-/Pushfreigabe ausstehend; nicht ausgeführt.** [Plan](phase83-deployment.md), [Manifest](phase83-manifest.json).

Der aktuelle main-HEAD enthält noch die ursprüngliche Apple-Integration; Phasen 1–8.2 sind gemeinsam uncommittet. Ein reiner Workflowcommit würde benötigten Produkt-/Test-/Toolingcode und die Auditbaseline auslassen. Vorgeschlagen wird daher genau ein klar benannter Konsolidierungscommit aller 77 geprüften Manifestpfade auf neuem Branch codex/ci-first-platform-run. Kein blindes Staging, keine ignorierten Artefakte, kein automatischer Merge mit ungeprüften Remoteänderungen. Sieben historische Berichte sind von persönlichen Pfadmetadaten bereinigt. Das Manifest bindet den redigierten Stand.

Ein späterer expliziter Branchpush löst wegen ungefiltertem push-Trigger automatisch CI aus und muss diese Ausführung mit freigeben. Branch/Commit lokal allein lösen keine Cloud-CI aus. Keine Main-/PR-/Merge-/Tag-/Veröffentlichungsfreigabe. Live-Refs und öffentliche Repositorymetadaten wurden lesend geprüft. Actions-/Org-Richtlinien, Kontingente und Schreibrechte sind vor der Bereitstellung zu bestätigen. Produkt-/Dependency-/Sicherheitsstand aus Phase 8.2 unverändert, Release-Reife 7/10.
