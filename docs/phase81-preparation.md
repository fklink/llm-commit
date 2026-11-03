# Phase 8.1 – Packager-Audit und Vorbereitung des ersten CI-Laufs

Stand: **3. November 2026**. Freigabe ausschließlich für Analyse, Vorbereitung und isolierte Experimente. **Keine dauerhafte Toolchain-/Workflowänderung, kein Commit, Push, Dispatch, Tag oder Release.** [Phase 8](phase8-ci.md) bleibt ein unveränderter historischer Nachweis; [Phase-8.1-Evidenz](phase81-evidence.json) enthält neue Messungen und genaue Graphdifferenzen.

**Ergebnis:** Ein reiner Dependency-Override unter VSCE 3.6.2 ist inkompatibel. Empfohlen wird eine separat freizugebende, isolierte Aktualisierung auf **VSCE 3.9.2 mit zwei eng begrenzten Overrides**. Die getestete VSCE-4.1.0-Alternative benötigt mehr Migration. Keine neue Risikoakzeptanz erteilt, das vorhandene Packager-Gate bleibt blockierend. Release-Reife weiterhin **7/10, keine Releaseempfehlung**; GitHub Actions, Linux und macOS wurden nicht ausgeführt.

## 1. Zwei tatsächliche Packagerbefunde

Der neue Baseline-Audit bestätigt zwei mittlere Meldungen im separaten `.github/packager`-Graph, nicht im Runtimegraph der Extension. Das dortige `dev: false` bezeichnet die Dependencies des privaten Toolprojekts; sie werden durch `--no-dependencies` und die Paket-Allowlist nicht Teil des VSIX. Projekt-Audit separat: vier bekannte Befunde; Produktionsaudit null. Der Packager-Audit wurde ausdrücklich mit `--ignore-workspace` ausgeführt: Ein bloßer Wechsel in das Unterverzeichnis kann sonst den übergeordneten Projektgraph prüfen. Der vorhandene CI-Auditschritt besitzt diese Trennung bereits.

| Paket / Advisory | Installierte Versionen und konkrete Pfade | Fix und Wirkung |
|---|---|---|
| minimatch, [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249), CVE-2026-118764, **mittel** | 3.1.5: `.>@vscode/vsce>minimatch`; 10.2.6: `.>@vscode/vsce>glob>minimatch` | Gepatcht ab 11.0.1. Angreifermuster können in der beschriebenen Optimierungsphase CPU-/Speicherverstärkung verursachen. Ein Wechsel über die Majorgrenze ist erforderlich. |
| glob, [GHSA-3g3m-2fjr-6pw4](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4), CVE-2026-118773, **mittel** | 11.1.0: `.>@vscode/vsce>glob` | Gepatcht ab 14.0.2. Abgebrochene Traversierung kann im beschriebenen Fehlerpfad weitere Dateisystemarbeit ausführen. Kein Fix innerhalb der verlangten 11er-Reihe. |

### Tatsächliche Funktionsnutzung und Erreichbarkeit

VSCE 3.6.2 verwendet `glob('**', { cwd, nodir: true, follow, dot: true, ignore: 'node_modules/**' })` zur Dateisammlung. Glob aktiviert intern `optimizationLevel: 2`; das Traversierungsmuster und dessen Ignore sind hier feste Toolwerte. VSCE reicht dabei **kein AbortSignal** weiter. Der spezielle Signalabbruchpfad ist im vorhandenen Packagingaufruf daher nicht nachgewiesen erreichbar. Dies ist keine Aussage, dass glob generell sicher sei oder ein Parent-Prozesstimeout dessen Bibliotheksfehler behebe.

VSCE ruft außerdem den CommonJS-Funktionsexport von minimatch 3 mit `{ dot: true }` für Ignore-/Negationsregeln und Dateieinschlüsse auf. `.vscodeignore` ist Repositoryinhalt und auf einem PR nicht vertrauenswürdig. Die im Advisory beschriebene `firstPhasePreProcess`-Implementierung wurde im direkten 3.1.5-Code nicht gefunden; der Scannerbereich umfasst trotzdem auch diese Version. Ein Beweis der Ausnutzbarkeit dieses alten Zweigs liegt nicht vor. Der indirekte 10.2.6-Zweig enthält die beschriebene Optimierung, erhält hier jedoch feste Globmuster. Advisorybereich, tatsächlicher Aufruf und belegte Ausnutzung werden deshalb ausdrücklich getrennt.

Das plausible Schadensbild ist Ressourcenverbrauch/Jobabbruch; diese beiden Advisories belegen keine Secretentwendung oder Codeausführung. Ein PR kann ohnehin Repositorycode, Buildskripte und Muster ändern. Deshalb sind isolierte kurzlebige Runner, fehlende produktive Secrets und minimale Tokenrechte entscheidend. Lokale Releasevorbereitung darf daraus keine generelle Vertrauensannahme ableiten.

## 2. Varianten und Empfehlung

| Variante | Experiment / Ergebnis | Sicherheitsgewinn | Kompatibilität und Aufwand |
|---|---|---|---|
| A: VSCE 3.6.2 behalten, nur gezielte Overrides | glob 14.0.3, minimatch 11.0.4: Frozen-Installation und Audit null, **Dateisammlung fehlgeschlagen**: `(0 , minimatch_1.default) is not a function` | Scannerbefunde entfallen, aber Paketbau nicht funktionsfähig | Verwerfen. Moderner minimatch-Export ist kein alter Funktionsdefault; kein ungeprüfter Adapter oder Bibliothekspatch. |
| B1: VSCE innerhalb Major 3 aktualisieren | **3.9.2**, scoped glob **14.0.3**, scoped minimatch **11.0.4**: Paketbau, Inspektion und beide Windows-Hosts bestanden; Audit null | Beide Packagerbefunde im geprüften Graph beseitigt | **Empfohlen.** Kleinere Graphänderung, bestehender VSCE-Ablauf bleibt. Zwei ausdrücklich freizugebende transitive Majorwechsel bleiben nötig. |
| B2: Packaging-Werkzeug aktualisieren | **VSCE 4.1.0**, scoped minimatch **11.0.4**: Paketbau, Inspektion und beide Windows-Hosts bestanden; Audit null | Glob entfällt durch tinyglobby; minimatch wird korrigiert | Funktionierende Alternative, aber breiterer Majorwechsel: neuer Traversierer, Markdown-/HTML-/Keyring-/ZIP-Abhängigkeiten und Node mindestens 22. Noch keine Publishing-/Signiermigration validiert. |
| C: begrenzte Risikoakzeptanz | **Nicht umgesetzt oder genehmigt** | Keine Behebung; nur explizite Entscheidung über begrenzte Entwicklungsrisiken | Technisch möglich mit exakten Advisory-/Versions-/Pfad-Fingerprints und Ablaufdatum. Neue Befunde/Erreichbarkeit dürfen nicht passieren. Wegen funktionierender B1-Korrektur aktuell nicht bevorzugt. |

Unverändertes VSCE 3.9.2 verlangt `glob ^13.0.6` und `minimatch ^10.2.2`; ein bloßer Minorwechsel reicht nicht zur Behebung. VSCE 4.1.0 verlangt weiterhin `minimatch ^10.2.6`; auch dort reicht ein reiner Werkzeugwechsel nicht. Die überprüften Paketdaten und [VSCE-3.9.2-Releaseinformationen](https://github.com/microsoft/vscode-vsce/releases/tag/v3.9.2) sowie [VSCE 4.1.0](https://github.com/microsoft/vscode-vsce/releases/tag/v4.1.0) sind in der Evidenz referenziert.

### Konkreter B1-Vorschlag für eine spätere Freigabe

Nur im isolierten Packagerprojekt:

```yaml
# .github/packager/pnpm-workspace.yaml – Vorschlag, noch NICHT im Projekt angelegt
# .github/packager/package.json: @vscode/vsce exakt 3.9.2

overrides:
  "@vscode/vsce@3.9.2>glob": "14.0.3"
  "@vscode/vsce@3.9.2>minimatch": "11.0.4"
```

Die Overrides stehen in einer eigenen Tool-Workspacekonfiguration, nicht in den Projekt-Overrides. pnpm 11 ignorierte die zunächst experimentell gewählte `package.json.pnpm.overrides`-Platzierung; diese Vorprobes wurden nicht als korrigierte Graphen gewertet. Maßgeblich sind die danach tatsächlich aufgelösten YAML-Overrides, Laufzeitversionen, Graphen und Audits.

Der aus dem vorhandenen Lock abgeleitete, abschließend geprüfte B1-Graph fügt **sechs Paketidentitäten hinzu**, entfernt **21** und enthält 290 statt 305 `packages`-Einträge. Neue Identitäten: `@vscode/vsce@3.9.2`, `glob@14.0.3`, `minimatch@11.0.4`, `path-scurry@3.0.0`, `@isaacs/nonrecursive-glob-match@1.0.3`, `yauzl@3.4.0`. Der vorherige semver 7.8.5 bleibt erhalten. Vollständige Entfernliste und Lockhash stehen in der Evidenz. Der erste frische B1-Resolve hatte zusätzlich semver 7.8.6; empfohlen wird ausschließlich der engere aus der Baseline abgeleitete Graph.

B2 fügt 27 Paketidentitäten hinzu und entfernt 196 gegenüber derselben Baseline; 136 Einträge verbleiben. Weniger Gesamtpakete bedeutet nicht automatisch eine kompatiblere Migration. Beide Kandidaten verlangen weiterhin gepinnte, eingefrorene Lockfiles und Inhaltsprüfung.

Bei späterer Übernahme sind die Versionsguards und Provenienztexte in `scripts/package-test-vsix.cjs`, CI-Konfiguration, Workflow-Stepbezeichnung sowie aktuelle Dokumentation gezielt anzupassen. Der echte Prepublish, Paket-Allowlist, Mindesthost und Produktionscode bleiben erhalten. In diesem Experiment wurde ausschließlich die Versionsprüfung/-kennzeichnung im **temporären** Packaging-Skript auf den jeweiligen Toolpin gesetzt; der vollständige Prüfablauf blieb aktiv. Node 24.22.1 wurde beibehalten. Yauzl 3 könnte die bisherige Node-26-Grenze ändern, ist dafür aber **nicht validiert**; keine Nebenmigration empfohlen.

## 3. Tatsächlich ausgeführte Experimente

**Windows x64, Node 26.13.0, pnpm 11.25.0; Packaging Node 24.22.1.** Temporäre vollständige Quellkopie und separate Toolverzeichnisse auf lokalem NTFS, kein Git-Worktree und keine `.git`-Änderung. Projekt-Frozen-Installation und gemeinsame unveränderte Produkttests wurden einmal für beide funktionsfähigen Packager ausgeführt. Tool-Frozen-Installationen, vollständige VSIX und installierte Hosttests wurden pro Kandidat ausgeführt.

| Prüfung | Tatsächliches Ergebnis |
|---|---|
| Projekt-Frozen-Installation | **Erfolgreich**, Rootmanifest, Rootlock und Overrides unverändert |
| Lint / Typecheck / Entwicklungs- und Produktionsbuild | **Erfolgreich**, vorhandene CI-Tasks in der Kopie |
| Headless mit privater TLS-Fixture | **Erfolgreich**, 205 bestanden / sieben Host-Ausnahmen |
| Packaging- und CI-Tests | **Erfolgreich**, 17 + 16 = 33; CI-Tests im Hauptbaum zusätzlich separat 16 bestanden |
| Tool-Frozen-Installationen | **Erfolgreich** für A, B1 und B2; ursprüngliche Auflösung erfolgte vorher bewusst nicht frozen, ausschließlich im Experiment |
| A-Dateisammlung | **Fehlgeschlagen**, Exportbruch; kein nutzbares VSIX behauptet |
| B1/B2-Dateisammlung | **Erfolgreich**, dieselben sechs Runtime-Ressourcen wie Baseline |
| B1/B2-VSIX inklusive echtem Prepublish | **Erfolgreich**, jeweils acht Archiveinträge, originales Manifest, kein nativer Provider, keine Entwicklungsartefakte |
| B1/B2 installiert: VS Code 1.80.0 / Node 16.17.1 | **Erfolgreich**, je 214 Hosttests und drei zusätzliche TLS-Probes |
| B1/B2 installiert: VS Code 1.144.0 / Node 24.22.1 | **Erfolgreich**, je 214 Hosttests und drei zusätzliche TLS-Probes |
| Tatsächlicher Git-/HTTP-Command, SCM-Ergebnis | **Erfolgreich** für beide Pakete/beide Hosts. **Simuliert** ausschließlich Consentantwort für exakte eigene Dummy-Origin |
| Neuer Baseline-/Projekt-/Produktionsaudit | **Erfolgreich ausgeführt**, Packager zwei, Projekt vier, Produktion null; ungeändertes Packager-Gate bleibt blockierend |
| Kandidaten-Audits B1/B2 | **Erfolgreich**, jeweils null Befunde; kein Nachweis allgemeiner Unverwundbarkeit |
| actionlint 1.7.12 / CI-Regressionssuite | **Erfolgreich**, unveränderter Workflow; Shellcheck/Pyflakes nicht vorhanden |
| GitHub Actions, Linux, macOS | **Nicht durchgeführt**, keine Runnerausführung ausgelöst |

Der erste lokale Hostversuch bestand Minimum, konnte den aktuellen Host aber wegen zweier Ressourcenverzeichnisse in der automatisch aktualisierten lokalen VS-Code-Anwendung nicht eindeutig auflösen (1.144.0 und 1.144.1). Das ist eine kontrollierte Resolverablehnung, kein Packagerfehler. Wiederholung mit offiziell heruntergeladener isolierter **1.144.0** bestand. Beide Versuche bleiben in der Evidenz sichtbar. Die CI verwendet bereits isolierte versionsgenaue Downloads; ein produktiver Fix ist nicht erforderlich und wurde nicht vorgenommen.

Private Test-CA/Schlüssel und Dummyprofile liegen außerhalb von Repo/Paket. TLS-/Hostnameprüfung bleibt aktiv; Tests verwenden lokale Server, keine kostenpflichtige Modellanfrage. Realer Helper-SecretStorage ist keine Abnahme dauerhafter OS-Keyrings, interaktiver Trust-UX oder Remote-Kontexte. Artefakthashes, tatsächliche Befehle, Logs und Graphdifferenzen stehen in der Evidenz; Paketcontainer sind wegen Metadaten/Reihenfolge nicht als bitidentisch versprochen, das Produktionsbundle ist identisch.

## 4. Workflowprüfung und Anpassungsbedarf

Der Workflow wurde **nicht geändert**. Aktuelle Überprüfung:

- `contents: read`, alle weiteren Tokenrechte implizit nicht gewährt; Checkout ohne persistierte Credentials. Keine Secrets/PATs/Marketplace- oder OIDC-Publishingrechte erforderlich. Aktionen benötigen lediglich die normale Actions-Artefaktinfrastruktur.
- `pull_request`, kein `pull_request_target`, keine privilegierte nachgelagerte Workflowausführung. Unvertrauenswürdigen PR-Code nur auf GitHub-hosted kurzlebigen Runnern testen; keine produktiven Secrets hinzufügen. Repository-/Organisationsrichtlinien und eventuelle Freigabe externer Beiträge müssen vor Bereitstellung vom Owner geprüft werden.
- Alle vier Action-SHAs erneut über offizielle `action.yml` geprüft (HTTP 200, Node-24-Actions). Versionspins Node 26.13.0 / pnpm 11.25.0 sowie Packaging-Node 24.22.1 vorhanden. Offizielle Nodearchive und sechs Hostdownloadziele erneut erreichbar; das ist keine Runnerausführung.
- `windows-2025`, `ubuntu-22.04`, `macos-15-intel` stehen im [offiziellen Runnerinventar](https://github.com/actions/runner-images). Architektur x64; keine automatische ARM64-Umschaltung. Kontingente, zugelassene Actions und tatsächliche Imageversionen dieses Repositories sind nicht nachgewiesen.
- Kein Dependencycache und explizit deaktivierter automatischer pnpm-Cache; Frozen-Installationen je Graph. Bootstrap selbst wurde nicht als GitHub-Lauf ausgeführt.
- Ein Windows-VSIX; nach erfolgreichem Upload identischer Hash/Inspektionsbericht an Linux/macOS. Auch spätere Windows-Audit-/Hostfehler lassen die übrigen Plattformprüfungen bei vorhandenem Paket zu. Fehlender Upload bleibt blockierend. Für den ersten Nachweis vollständigen Workflow neu ausführen, keine Mischung verschiedener Teilwiederholungen.
- Linux: vorhandenes `dbus-run-session -- xvfb-run -a`, fehlende Werkzeuge führen zu Fehler. Basic-SecretStorage nur für Dummyprofile; kein sicherer OS-Keyring-Nachweis. Keine Abschaltung von TLS-/OS-Sicherheitsprüfungen.
- Jobtimeouts 45/40/40 Minuten; allgemeine Taskprozesse fünf Minuten, Hostmatrix 20 Minuten, Download-Idlelimit 120 Sekunden, Bootstrap drei Minuten. Harte Jobabbrüche können letzte Diagnosen verhindern. Laufzeiten auf hosted Runnern bleiben zu messen.
- Separate Reports je OS/Versuch, Logs und Exitcodes, Paketinspektion/Provenienz, 14 Tage Aufbewahrung. Keine privaten TLS-Fixtures/Profildatenbanken im Upload; Paket wird nicht doppelt als Report archiviert.

**Notwendige Änderungen erst bei genehmigter B1-Übernahme:** exakten isolierten Toolgraph samt eigener Overrides übernehmen, Versionsguards/Labels/Provenienz aktualisieren und vorhandene strenge Tests erneut ausführen. Audit-Gate selbst muss weder abgeschaltet noch aufgeweicht werden: ein sauberer Packager-Audit darf bereits passieren. Projekt-Auditakzeptanz unverändert bis spätestens **1. Dezember 2026 oder vor der nächsten Releasefreigabe**, früherer Termin maßgeblich.

## 5. Kontrollierter erster GitHub-Actions-Lauf

Diese Anleitung wurde **nicht ausgeführt**:

1. Zuerst B1-Korrektur konkret freigeben und dauerhaft lokal validieren; alternativ ausdrücklich eng begrenzte Packagerakzeptanz entscheiden. Kein grüner Gesamtlauf mit den derzeit unverändert offenen Packagerbefunden erwarten.
2. Owner prüft Repository/Defaultbranch, Actions-Freigaben, zulässige SHA-gepinnte Actions, hosted Runner-/Speicherkontingent sowie Verhalten bei Fork-PRs. Keine Modell- oder Veröffentlichungstokens bereitstellen. Gesamten vorhandenen uncommitteten Projektstand prüfen; die CI hängt von Dateien früherer Phasen ab. Kein blindes `git add .` und keine bestehenden Nutzeränderungen übergehen.
3. Gesonderte Bereitstellungsfreigabe muss Zielbranch, konkreten geprüften Dateiumfang/Commit und **den dadurch ausgelösten ersten Lauf** umfassen. Der vorhandene `push`-Trigger startet beim Push automatisch; deshalb keinen Push als vermeintlich reine Bereitstellung behandeln.
4. Erst nach dieser Freigabe auf einem überprüften `codex/…`-Branch bereitstellen und den automatischen Push-Lauf beobachten. Kein zusätzlicher manueller Lauf nötig. `workflow_dispatch` ist eine Alternative, sobald die Workflowdatei im Defaultbranch liegt; [GitHub verlangt diese Voraussetzung](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow). Kein ungeprüfter Defaultbranch-Merge nur zum Starten.
5. Run-URL, SHA, Auslöser und Attempt dokumentieren. Drei Jobs und sechs Hostkombinationen, echte VSIX-Installation, Git-/HTTP-/TLS-Ergebnisse, Raw-Audits und Gateentscheidung prüfen. Artefakthash gegen Erzeugerbericht und alle Installationsberichte abgleichen; Fehlerlogs archivieren. Ein bereitgestelltes Artefakt oder grüner Windows-Build ersetzt keinen Linux-/Mac-Lauf.
6. Fehlgeschlagene/übersprungene Kombinationen ausdrücklich benennen. Keine automatischen Dependency-Upgrades, TLS-Bypässe oder produktiven Fehlerkorrekturen. Nach vollständiger Auswertung separaten CI-Abnahmebericht erstellen. Erst danach neue Plattformbewertung; kein Marketplace-Release, Tag oder Veröffentlichungsautomatismus.

## 6. Verbleibende Risiken und nächste Freigabe

B1 ist unter beiden Windows-Hosts erfolgreich getestet, aber transitive Majorwechsel bleiben eine bewusste Kompatibilitätsentscheidung; andere Projekte/Muster sind nicht generell abgenommen. Native Tool-Login-/Signierfunktionen wurden nicht getestet und werden für lokales Packaging nicht benötigt. Linux/macOS, Remote-SSH/Container/WSL, sichere native Keyrings und verwaltete Unternehmens-Truststores bleiben offene Nachweise. HTTP-/Git-/SecretStorage-Produktlogik bleibt unverändert.

**Empfohlene nächste Freigabe:** ausschließlich B1 dauerhaft übernehmen: VSCE **3.6.2 → 3.9.2**, zwei Eltern-Overrides auf glob **14.0.3** und minimatch **11.0.4**, zugehöriger getesteter Tool-Lock und notwendige Versions-/Dokumentationsanpassungen; keine Änderungen am Projektgraph, keine VSCE-4-Migration, keine neue Risikoakzeptanz. Danach gesonderte Bereitstellungs-/Lauffreigabe anhand des konkreten geprüften Repositoryzustands. Phase 8.1 endet hier mit Vorbereitung, nicht mit einem gestarteten Lauf.
