# Roadmap nach Phase 8.2

Stand: 3. November 2026. **7/10, keine Releaseempfehlung.** [Status](PROJECT_STATUS.md) · [Issues](ISSUES.md) · [Entscheidungen](DECISIONS.md). Vorschläge sind keine Implementierungs- oder Releasefreigabe.

## Abgeschlossen bzw. bewusst entfallen

Kernfehler BUG-001/002/003/005/006/007 und ARCH-002 sind implementiert abgesichert; BUG-004 unter den geprüften Windows-Hosts behoben. ARCH-001 ist durch die ausdrückliche Entfernung der nativen Funktion und den Windows-fähigen vollständigen Build erledigt. Apple Foundation Models, Swift-Build, Apple-Inferenz und native Paketvarianten sind keine weiteren Produktziele. Historische offene Mac-Inferenznachweise werden nicht als nachträglich bestanden umgedeutet. Details: [Phase 7](phase7-removal.md).

## P1 – Verbleibende HTTP-Plattformabnahmen

| Reihenfolge | Aufgabe | Abschlusskriterium |
|---|---|---|
| 1 | Reale Linux- und macOS-HTTP-Runner bereitstellen | Unveränderte Frozen-Installation, Lint/Typecheck, beide Builds, vollständiges VSIX, Minimum/aktuelle VS-Code-Version, Git, Keyring/SecretStorage, Workspace Trust, TLS und HTTP-Lifecycle. Kein Swift/Xcode notwendig |
| 2 | SSH, Dev Containers und WSL real prüfen | Autorisierte Ziele und Laufzeiten; tatsächlicher Hostort, Loopback/Forwarding, Repository-Auswahl, Entwurfsschutz, Trust und getrennte Kontext-/Empfängerfreigaben nachweisen |
| 3 | Enterprise-Support präzisieren | Verwaltete Auth-/PAC-/HTTPS-Proxy- und CA-/Systemstoreumgebung im echten Host prüfen. Bekannte Node-16-CA-Grenze zunächst dort reproduzieren; kein TLS-Bypass |
| 4 | Manuelle HTTP-UX-Abnahme ergänzen | Echte Trust-/Consentdialoge, Providerwechsel, reale lokale Modellserver. Der automatisierte installierte Command aus Phase 7 simuliert nur die Consent-Antwort für die eigene Dummy-Origin |

Die bestehenden Runbooks/Fixtures wiederverwenden und ihre historische Swift-/Apple-Anleitung nicht auf den aktuellen Umfang übertragen. Neue Produktfehler zunächst dokumentieren, Lösungsvorschlag konkretisieren und getrennt freigeben.

## Fristgebunden – Dependency-Sicherheit

**Sicherheitsprüfung spätestens 1. Dezember 2026 oder vor der nächsten Releasefreigabe, je nachdem früher.** Neue Befunde oder belegte Ausnutzbarkeit verlangen frühere Neubewertung.

- Vier offene Projektbefunde je Erreichbarkeit und unterstützter korrigierter Elternversion prüfen; Kandidat-A-Overrides erhalten. Keine pauschalen Force-Upgrades oder Kandidat-B/C/D-Übernahme.
- Die zwei Packagerbefunde sind durch B1 behoben; den separaten Graph weiter auditieren, keine Deckung neuer Befunde durch Projekt-Risikoakzeptanz. Node-24-ZIP-Inspektionsjob erhalten, Node-26-Sperre nicht umgehen.
- Gezielte Elternmigrationen nur experimentell mit Lint, Typen, beiden Builds, Worker/Coverage/Cache, Host- und Paketmatrix bewerten. Breiter minimatch-11-Override brach zuvor Coverage.
- Produktionsaudit separat führen; null Meldungen sind kein genereller Nachweis für sichere Buildinputs.

## P2 – CI und Releaseautomatisierung

Die Qualitäts-CI ist in [Phase 8](phase8-ci.md) implementiert und lokal unter Windows validiert. Die folgenden Punkte sind verbleibende reale Abnahme-/Releasegates; die Workflowdatei allein ist kein erfolgreicher Runnerlauf. Das unveränderte Packager-Audit-Gate besteht seit B1 lokal mit null Befunden; ein tatsächlicher Runnerlauf fehlt.

Der jetzige lokale Windows-Paketbau ist vollständig, aber keine Releasepipeline. Nach eigener Freigabe:

1. Quell-/Lock-/Compiler-/Bundle-/VSIXhash, gepinnte Entwickler- und eingebettete Hostversionen, isolierte Profile und dauerhaft archivierte Logs als reproduzierbare Gates festlegen.
2. Windows/Linux/macOS-HTTP-Matrix mit Minimum und festgelegtem aktuellem Host; nur tatsächlich ausgeführte Architekturen zusagen. Keine nativen Apple-Buildjobs oder Paketvarianten einführen.
3. Paket-Allowlist, unverändertes Manifest, Credential-/Entwicklungsartefaktausschluss, tatsächliche Installation und Git-/Dummy-HTTP-Generierung prüfen. Projekt- und Packager-Audits vor jeder Releasefreigabe neu bewerten.
4. Versions-/Provenienz-/Signaturpolitik gesondert entscheiden. Veröffentlichung und Zugangstokens bleiben ein eigener ausdrücklicher Freigabeschritt; keine Publishingrechte im reinen Validierungsjob.

## P2 – Wartbarkeit und Dokumentation

- Orchestrierung nur bei nachweisbarem Nutzen schrittweise trennen, ohne Git-/Sicherheitssemantik zu verändern. Bestehende Security-/Transportgrenzen und Regressionen erhalten.
- Git-API-Typisierung und tatsächliche Remote-Hostplatzierung prüfen. Eine explizite Workspace-Präferenz ist weiterhin eine gesondert freizugebende Verhaltensänderung.
- Sichere Diagnose nur mit redigierten Metadaten bewerten. InputBox hat keine Edit-Historie; keine nicht belegte Vollständigkeit zusagen.
- Historische Berichte erhalten, aktuelle Anleitungen am Vier-Provider-Umfang pflegen. Fehlende reale Nachweise nicht durch Dokumentationsupdates schließen.

## P3 – Ungeprüfte Funktionsideen, nicht freigegeben

| Idee | Nutzen und vorab zu bewertende Kosten |
|---|---|
| Opt-in-OutputChannel | Verständlichere Lifecycle-/Verbindungsdiagnose; Secret-/Diffredaktion, UX, Wartung und Performance zuerst absichern |
| Vorschau vor jeder Übernahme | Bewusstes Prüfen auch bei leerem Entwurf; gegen vorhandene unsaved Ergebnis-Editoren abwägen, Git-/Anfrageordnung erhalten |
| Explizite HTTP-Providerprofile | Vereinfachter Zielwechsel; nur bei belegtem Bedarf, ohne automatisches Übertragen von Modellen, Freigaben oder Credentials |

## Drei nächste Maßnahmen

1. Den vorhandenen Workflow nach separater Repositorybereitstellungsfreigabe erstmals real auf allen drei GitHub-Runnern ausführen; sechs Hostkombinationen und Artefakte prüfen, danach offene Remote-/Enterpriseabnahme ergänzen.
2. Vier Projektbefunde bis zum Sicherheitsstichtag bzw. vor Release neu bewerten und den bereinigten Packagergraph weiter separat auditieren.
3. Anschließend den nachgewiesenen lokalen Paketprozess mit konkretem CI-/Releaseplan separat freigeben; keine neue Entwicklung oder Veröffentlichung automatisch beginnen.

## Historischer vorbereiteter Freigabeschritt – Phase 8.1, inzwischen umgesetzt

[Analyse und Ablaufplan](phase81-preparation.md): zuerst ausschließlich VSCE 3.9.2 mit scoped glob 14.0.3 / minimatch 11.0.4 und geprüftem isoliertem Lock freigeben, übernehmen und erneut validieren. Dies ist ein Vorschlag; Hauptgraph und Audit-Gate bleiben derzeit unverändert. Anschließend konkrete Branch-/Dateiumfangs- und erste Lauffreigabe einholen. Der Push startet den vorhandenen Workflow automatisch; keine unbemerkte Bereitstellung. Danach tatsächlich sechs Hostkombinationen und Artefakte abnehmen. Weder vorbereitete CI noch erfolgreiche Windows-Experimente ersetzen die offenen Linux-/macOS-/Remote-Nachweise.

## Aktueller nächster Schritt nach Phase 8.2

B1 ist dauerhaft übernommen und lokal vollständig bestanden; der vorbereitete Freigabeschritt aus Phase 8.1 ist damit abgeschlossen. Jetzt ausschließlich konkrete Bereitstellung und ersten tatsächlichen Windows-/Linux-/macOS-Actions-Lauf gesondert freigeben, einschließlich automatischem Push-Trigger und überprüftem uncommittetem Projektumfang. Keine erneute Packager-Risikoakzeptanz nötig. [Phase 8.2](phase82-packager.md). Keine Veröffentlichung; Release-Reife bleibt bis zu realen Plattformnachweisen 7/10.
