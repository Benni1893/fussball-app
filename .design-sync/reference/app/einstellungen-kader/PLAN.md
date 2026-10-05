# Plan: Einstellungen und Kader (F1 bis F14)

**Diese Datei ist die Quelle für die Nummern F1 bis F14.** Jede Sitzung, die an
Einstellungen oder Kader arbeitet, liest sie zuerst. Commit-Messages nennen das
F-Kürzel von hier.

Herkunft: Analyse vom 26.09.2026, 21:16 Uhr, freigegeben 21:19 Uhr. Der Text
unten ist wörtlich aus dem Sitzungsprotokoll übernommen
(`070eddff-…jsonl`), nicht rekonstruiert. Nur die Pfadangaben im Abschnitt 0
sind überholt: die Bilder liegen inzwischen in diesem Ordner, und
`einstellungenneu .png` heißt jetzt `einstellungenneu2.png`.

## Stand (02.10.2026)

| # | Stand |
|---|---|
| F1 | fertig, einschließlich Hash-Fix (`switchView` räumt `#ein=` weg) |
| F2, F3, F4 | fertig (Zeilenbaustein, Profilkarte, Werte rechts; Verwaltungsgruppe mit Strafenkatalog als Zeile) |
| F5 | fertig (`pnAbschnittHtml` aufgetrennt, steckt im Gerüst-Commit) |
| F6 | fertig (ein Einstieg: `Push-Texte` unter VERWALTUNG) |
| F7, F8 | fertig (INFO-Gruppe, Abmelden-Karte mit Zweizeiler) |
| F9 | offen, BFV in Zeilenform |
| F10 | fertig (kompakter Titel, steckt im Gerüst-Commit) |
| F11 bis F13 | offen, Kader |
| F14 | offen, `.design-sync`-Karten, `conventions.md`, `validate.sh`, Token-Zähler |
| B1 | fertig: Migration 0041 eingespielt am 01.10.2026, Nachkontrolle bestätigt (Beschreibung ohne internen Bezeichner, Deep Link der Testnachricht auf `#ein=mitteilungen`, keine Vorlage mehr auf `#ansicht=einstellungen`). |
| L1 | fertig: `landkartenmodul.mjs` (Stand-in für `db.js`, erfundene Testdaten, Uhr fest auf Fr 02.10.2026 18:00), `landkartenrauch.mjs` grün für alle sechs Profile, 0 Requests an Supabase |
| L2 | fertig: `landkarte.mjs` + `landkartenregeln.mjs`, Ergebnis `.design-sync/landkarte/landkarte.json` (Bilder in `.gitignore`); Tiefengrenze 6, sechs Profile parallel, rund 4 Minuten |
| L3 | fertig: `landkartenlayout.mjs` erzeugt `.design-sync/landkarte/landkarte.html` (Bilder relativ verlinkt), dazu nicht versioniert unter `bilder/` ein PNG je Rolle (`rollen/<profil>.png`) und die eigenständige `landkarte-komplett.html` (JPEG eingebettet, 9,6 MB, Grenze 15 MB) |
| L3b | fertig: Zoomen/Verschieben (Mausrad, Ziehen, Pinch, Knöpfe), Stränge je Rolle (Strang = Ansicht des Zustands, Mehr-Menü eigener Strang, Zu- und Ausgänge als Stummel), „Nur diesen Weg zeigen“, Brotkrumen, Auswahl im URL (`?rolle=…&strang=…&weg=…`); gilt für `landkarte.html` und `landkarte-komplett.html` (9,6 MB) |
| L4 | fertig: `landkartendrift.mjs` und `landkartenrauch.mjs` auf der Pflichtliste (jetzt 18), sprechender Name je Knoten (`name`, `nameQuelle`, Regeln und Liste `NAMEN` in `landkartenregeln.mjs`), `strang` in `landkarte.json`, Abschnitt „App-Landkarte“ in `NOTES.md`, `build.sh` legt Landkarte und Rollenbilder ins Bundle (`ds-bundle/landkarte/`) |
| A | offen, Aufräumen (Nebenbefunde aus der Landkarten-Analyse, siehe unten) |
| E1 | fertig 03.10.2026 (Paket „Einstellungen v2 + Push-Erinnerung“): Migration 0042 (Push-Rechte) und 0042b (Rechte nach Vollinventar) eingespielt, `supabase/checks/0042_rechtepruef.sql` 166/166, anon-HTTP 22/22 abgelehnt, Smoke-Test am Handy 8/8, Testnachricht angekommen. Einzelheiten: `einstellungen-v2/PHASE0.md`. |

**Reihenfolge ab hier, kein Vorziehen:**
1. ~~Migration 0041: zuerst die Gegenprobe, dann die zwei Updates.~~ erledigt 01.10.2026.
2. Paket L, App-Landkarte. Am 02.10.2026 bewusst vor den Inhaltsabgleich gezogen. Ein Commit je Schritt:
   - L1 Stand-in für `db.js` und Testdaten (`landkartenmodul.mjs`)
   - L2 Crawler mit Zustandserkennung und Kanten (`landkarte.mjs`)
   - L3 Layout: `landkarte.html` (Spalte je Rolle, Ebenen, SVG-Pfeile, Klick vergrößert) plus PNG je Rolle
   - L3b Bedienung: Zoomen und Verschieben, Stränge einzeln, Weg zu einem Zustand, Auswahl im URL
   - L4 Drift-Prüfung auf die Pflichtliste, `NOTES.md`, Weg nach Claude Design über `build.sh`; dazu ein sprechender deutscher Name je Knoten (bevorzugt aus der sichtbaren Überschrift, sonst aus der Namensliste in `landkartenregeln.mjs`), die Drift-Prüfung wird rot, wenn ein Knoten keinen sprechenden Namen hat
3. ~~Inhaltsabgleich der vier Unterseiten~~, ~~F9~~, ~~F14~~: ersetzt am 03.10.2026 durch das Paket
   **„Einstellungen v2 + Push-Erinnerung“** (Vorlagen `einst1.png` bis `einst4.png`, Plan und
   Entscheidungen in `.design-sync/reference/app/einstellungen-v2/PHASE0.md`). Reihenfolge dort:
   E1 Rechte serverseitig (fertig), E2 UI-Rechte, E3 bis E10 je Unterseite (E7 = F9), P1
   Erinnerungs-Push im Rückmeldungen-Blatt, F14 Design-System-Karten.
   - **Migration 0043 (mit P1) enthält außerdem die Datenbanktexte** (Entscheidung 04.10.2026, keine eigene Migration): Beschreibung „Neue Strafe“ ohne Gedankenstrich („Eine Strafe wird verhängt - von Hand …“), A10 („Höchstens einmal im Monat. Standard AUS.“) und die übrigen Text-Abweichungen aus PHASE0.md (A1 bis A11 am 05.10.2026 wie vorgeschlagen entschieden; von ihnen braucht nur A10 die Datenbank, die übrigen sind Frontend in E8/E9). Dazu die Fehlermeldungen mit ASCII-Ersatzschreibung aus dem Bereich Einstellungen (send_test_notification, send_preview_notification, set_notification_template, render_vorlage, upsert_push_subscription, set_ical_url, notify_enqueue; Liste in PHASE0.md).
4. Kleines Paket **„Anmeldung ohne Selbstregistrierung“** (Entscheidung 05.10.2026), direkt nach
   dem Einstellungs-Paket, vor „Automatische Mitteilungen“. Die Selbstregistrierung bleibt in
   Supabase abgeschaltet; die App soll das nicht mehr verschweigen:
   - „Noch kein Konto? Jetzt registrieren“ auf der Anmeldeseite durch „Konto beim Admin anfragen“
     ersetzen (`app.js` `renderLogin`).
   - Fehlermeldung „Signups not allowed for this instance“ übersetzen (`authErrorText`).
   - Satz auf der Rollen-Seite anpassen („Neue erscheinen hier, sobald sie sich registriert haben.“).
5. Paket **„Automatische Mitteilungen“**, direkt nach „Anmeldung ohne Selbstregistrierung“, vor Kader.
   Trigger und Cron-Jobs, die neue Strafe, Zahlung bestätigt/abgelehnt/gemeldet, Erinnerung
   24 h und 2 h vor Meldeschluss, kurzfristige Absage, zu wenig Zusagen, Übersicht nach
   Meldeschluss, Termin neu/geändert/abgesagt und offene Strafen in die Outbox schreiben,
   ausschließlich über `notify_enqueue` mit den Vorlagen aus `notification_templates`.
   Zugestellt wird nach den Schaltern und Ruhezeiten der Seite Mitteilungen (die Sicht
   `notification_due` prüft das bereits). Heute reiht kein Trigger und kein Cron-Job etwas
   ein (PHASE0.md, Abschnitt c); bis dahin trägt die Seite Mitteilungen einen dezenten
   Hinweis (E4). **Nicht bauen vor Freigabe.**
   - **Offene Entscheidung:** Wer eine Aktion auslöst (z. B. eine Strafe verhängt, eine
     Zahlung bestätigt, einen Termin ändert), bekommt darüber keine Nachricht, auch wenn er
     selbst betroffen ist. Festhalten und vor dem Bau bestätigen lassen.
6. Kader F11 bis F13.
7. Paket A, Aufräumen (siehe unten). `data-remind` entfällt dort, es wird in P1 entfernt.

**Vor dem Rollout bei weiteren Vereinen (nur vorgemerkt, 05.10.2026):** Paket **„Aufnahme neuer
Mitglieder“**. Registrierung mit Freigabe durch den Admin: neue Konten sehen nichts, bis ein Admin
sie freigibt; dazu ein Einladungslink o. ä. Grund: heute darf jedes angemeldete Konto alle Strafen
lesen (Policy `read_fines`: `true`) und sich über `set_my_player` einen noch freien Spieler
zuordnen. Eine offene Registrierung hieße deshalb: jeder mit dem Link sieht die Kasse. Deshalb ist
die Selbstregistrierung abgeschaltet (PHASE0.md, Abschnitt „Testkonto und Selbstregistrierung“).

### Paket L: Vorgaben (02.10.2026)
- Sechs Spalten: vor der Anmeldung, Spieler, Trainer, Kassenwart, Trainer+Kassenwart, Admin.
- Rollen kommen echt über das Stand-in (`myRoles`), nicht über die Admin-Simulation.
- Testdaten nur mit erfundenen Namen, keine echten Spielerdaten.
- Kein einziger Request an Supabase: jeder Request an `*.supabase.co` lässt den Lauf rot werden.
- Schreibaufrufe des Stand-ins werden nur protokolliert.
- `app.js` und die bestehenden Prüfskripte bleiben unverändert. Wäre eine Änderung an `app.js` nötig: stoppen und melden.
- Versioniert werden nur `landkarte.html` und `landkarte.json`, die PNGs stehen in `.gitignore`.
- Ablauf je Commit: Dateiliste zeigen, nach OK umsetzen, Pflichtliste 18/18 grün (16/16 bis L3b) (versionierte Bilder per `git restore` zurück), Commit, Push erst nach OK. Eine Sitzung je Commit, am Ende der Startsatz für die nächste Sitzung.

### Paket A: Aufräumen (Nebenbefunde vom 02.10.2026, nicht anfassen bis dahin)
- **Globale Entscheidung offen (04.10.2026, aus E3): Kartenschatten app-weit an die Vorlage angleichen, ja/nein.** Die Vorlagen von Claude Design zeigen einen weicheren, längeren Schatten (Auslauf rund 21 px) als `--shadow` (rund 12 px). Nicht für die Einstellungen allein angleichen. Zur Entscheidung vorbereiten: Vorher/Nachher-Ausschnitte von zwei, drei Ansichten (z. B. Einstellungen, Übersicht, Kasse) mit dem heutigen und dem angeglichenen Schatten. Seitenhintergrund (`--bg-1`) und iPhone-Rahmen der Vorlage bleiben wie besprochen.
- Übersichtskachel `data-nav="kasse"` führt auf Konto mit Filter „offen“, nicht auf die Kasse (`app.js` Handler bei 6206). Klären, ob gewollt.
- Toter Code: `luPanel`/`luMore` und die alte Aufstellung, seit `LINEUP_V2 = true` unerreichbar (`app.js` um 3433-3451, `confirm` bei 3324, `prompt` bei 3294).
- Fehlermeldungen mit ASCII-Ersatzschreibung außerhalb der Einstellungen (04.10.2026, aus E5): `create_fines_batch` „Keine Strafen uebergeben.“, `report_my_payment` „Bitte eine gueltige Zahlart angeben.“, `set_lineup_active` „Vorlagen koennen nicht aktiv gesetzt werden.“ Braucht eine Migration; Liste in `einstellungen-v2/PHASE0.md`.
- Vier verwaiste Handler ohne erzeugendes Element: `data-remind`, `data-toggle-paid`, `data-del-fine`, `data-paypal` (Selektor bei `app.js` 5809).
- 5. Tab bei Trainer+Kassenwart (ohne Admin): Beschriftung „Trainer“ mit Platz-Symbol, öffnet aber das Mehr-Menü statt der Aufstellung (`setupPrimaryNavTab`, `app.js` 6931-6939: Beschriftung nach höchster Rolle, Ziel nach Anzahl der Spezialbereiche). Klären, ob „Mehr“ gemeint ist. Der Rauchtest `landkartenrauch.mjs` prüft das tatsächliche Verhalten. Nachgetragen am 02.10.2026.

---

# Phase 1 — Analyse: Einstellungen + Kader

## 0. Design-Dateien

Der Pfad im Auftrag war der Platzhalter `[PFAD EINTRAGEN]`. Einen Design-Ordner gibt es nicht; die vier neuen Dateien liegen lose in [.design-sync/reference/app/](.design-sync/reference/app/), alle vom 26.09. abends:

| Datei | Panels |
|---|---|
| `einstellungenneu.png` | 1 Admin · 1b ans Ende gescrollt · 2 Spieler · 8 Abmelden bestätigen |
| `einstellungenneu .png` *(Leerzeichen vor `.png`)* | 3 Mitteilungen · 4 gescrollt · 5 Ruhezeiten · 6 Kalender-Abo |
| `einstellungenneu1.png` | 7 Spielplan (BFV) |
| `kaderneu.png` | A1 Liste · A2 Status ändern |

Die Panelnummern 1–8 laufen über drei Dateien durch und ergeben einen zusammenhängenden Satz. Ich behandle sie als eine Vorlage.

**Gute Nachricht vorweg:** die Icon-Kacheln sind Grün-Abstufungen, Gold und ein neutrales Grau, die Abmelden-Schrift ist Rot. Alles im bestehenden Token-Satz (`--green-600/700/900`, `--gold-600`, `--muted-2`, `--red-600`). **Keine neuen Farben nötig.**

---

## 1. Inventar Einstellungen

### Übersicht (Panel 1 / 1b / 2)

| Element | Wert im Design | Quelle |
|---|---|---|
| h1 | `Einstellungen` | — |
| Profilkarte | Avatar `LW`, `Lukas Weber`, `Administrator · Spieler`, E-Mail, Chevron | `currentProfile`, `Roles.list`, `playerById` |
| Gruppe 1 (ohne Überschrift) | `Mitteilungen` → `An` · `Ruhezeiten` → `22:00 bis 08:00` · `Kalender-Abo` | `pushPrefs`, Abo-Status |
| `VERWALTUNG` | `Spielplan (B…` → `FC Fasanerie-Nor…` · `Strafenkatalog` · `Push-Texte` | `DEMO.teamName` |
| `INFO` | `Diagnose` · `App neu laden` | — |
| Abmelden | weiße Karte, roter Text, volle Breite | — |
| Fuß | `Build 2026-09-26-F` | `APP_BUILD` |

Panel 2 (Spieler) = identisch **ohne** `VERWALTUNG`.

### Unterseiten

- **3/4 Mitteilungen** — Schalter `Push auf diesem Gerät` + Hinweis; Gruppe `SPIELER` mit Sammelschalter `Alle`; 8 Zeilen (Icon, Titel, Beschreibung, Schalter): Neue Strafe, Zahlung bestätigt, Zahlung abgelehnt, Erinnerung an Zu- oder Absage, Termin fällt aus, Termin geändert, Neue Termine, Monatliche Erinnerung an offene Strafen; Admin-Hinweis; `Testnachricht senden`; Schlusshinweis. Panel 4 zeigt: beim Scrollen klappt der große Titel in die Zurück-Leiste (`‹ Einstellungen   Mitteilungen`).
- **5 Ruhezeiten** — `Nachts nicht stören` + Hinweis, `Von 22:00` / `Bis 08:00`, `Dringendes trotzdem zustellen` + Hinweis.
- **6 Kalender-Abo** — `Termine abonnieren`, `Link kopieren`, Hinweis.
- **7 Spielplan (BFV)** — `Mannschaft` → `FC Fasanerie-Nord 2` mit Chevron, `Zuletzt aktualisiert` → `26.09.2026, 06:27`, Hinweis `Läuft zusätzlich täglich automatisch.`, Karten-Knopf `Jetzt aktualisieren`.
- **8 Abmelden** — nativer Dialog: `Abmelden?` / `Du wirst auf diesem Gerät abgemeldet.` / `Abbrechen` | `Abmelden`.

### Ist-Zustand

[app.js:1844](app.js#L1844) `renderEinstellungen()` — **eine flache Seite**, vier `.set-section`-Blöcke, keine Unterseiten, keine Routen. Inhaltlich ist fast alles schon da: Profilblock, Kalender-Abo, `pnAbschnittHtml()` (Mitteilungen **und** Ruhezeiten in einem Block), `bfvSectionHtml()`, Strafenkatalog-Sprung, Push-Nachrichten-Sprung, Build + `?debug=1`-Link, `data-logout` mit `window.confirm("Wirklich abmelden?")`.

---

## 2. Inventar Kader

**A1 Liste:** h1 `Kader` · drei KPI-Kacheln (`SPIELER 16 / im Kader`, `FIT 13 / einsatzbereit`, `NICHT FIT 3 / fallen aus`, rot mit roter Kante) · Überschrift `Kader-Status` · **Segment-Filter `Alle 16 | Fit 13 | Nicht fit 3`** · **eine** Karte mit Gruppenköpfen `NICHT FIT · 3` und `FIT · 13` · Zeilen = Avatar, Name fett, graue Unterzeile (`Knie · seit 18.09.`, `bis 04.10.`), Status-Pille rechts (`● verletzt` rot, `● angeschlagen` bernstein, `● Urlaub` grau, `● fit` grün).

**A2 Status ändern:** Bottom Sheet, Greifer, Avatar + Name + `Status ändern` + ✕, 2×2-Raster (`fit`, `angeschlagen` gewählt mit ✓, `verletzt`, `Urlaub`), grüner `Speichern` über volle Breite.

### Ist-Zustand

[app.js:720](app.js#L720) `renderKader()` — KPI-Kacheln (Untertitel der dritten lautet `angeschlagen, verletzt oder im Urlaub`), dann `.kad-list` mit **einer Karte pro Spieler**, in der die vier Status-Chips *inline* stehen ([`statusWahlHtml()`](app.js#L132)), plus ein **eigener Abschnitt „Lazarett"** darunter. Kein Filter, keine Gruppenköpfe, kein Blatt. Sichtbar nur für `Roles.canManageEvents()` (coach/admin).

---

## 3. Backend — Gap-Liste

Ich habe den Datenweg durchgeprüft. **Das Backend trägt beide Designs fast vollständig.**

| Bedarf aus dem Design | Vorhanden? |
|---|---|
| Status `fit / angeschlagen / verletzt / urlaub` | ✅ `player_status`, Check-Constraint erweitert in `0031` |
| Notiz, „bis", „seit" für die Unterzeile | ✅ `status_note`, `status_until`, `status_since`; in [db.js:65-66](db.js#L65-L66) gemappt |
| Schreiben mit Rollenprüfung | ✅ `set_player_status(uuid,text,text,date)`, `SECURITY DEFINER`, Guard coach/admin oder eigener Spieler |
| Mitteilungs-Kategorien, Sammelschalter, Ruhezeiten | ✅ `notification_prefs`, `set_notification_prefs`, `notification_infos()` |
| Zeilen-Beschreibungen | ✅ aus `notification_infos().ausloeser_beschreibung` |
| Testnachricht | ✅ `sendTestNotification` |
| BFV: Mannschaft, Zeitstempel, Sync | ✅ `set_ical_url`, `syncNow`, Cron in `vercel.json` |
| Kalender-Abo-Token | ✅ |

**Einziger echter Backend-Posten:**

> **B1 — Interner Bezeichner im UI-Text.** [supabase/migrations/0038_push_texte.sql:366](supabase/migrations/0038_push_texte.sql#L366) setzt für `termin_abgesagt` die Beschreibung auf
> `Ein Termin wird abgesagt. Zeit- und Ortsänderungen laufen über termin_geaendert.`
> Dieser Text landet über `notification_infos()` **wörtlich auf dem Bildschirm**. Das Design zeigt stattdessen `… laufen über „Termin geändert".` Behebung: neue Migration mit einem `update` auf diese eine Zeile. Reversibel, kein DDL.

**Berührung bestehender Funktionen (wie gefordert vorab genannt):** B1 fasst eine Datenzeile im Push-Katalog an. Trigger, Outbox, Versand, `confirm_fines`, `reject_fine`, `mark_fines_paid`, Push-Registrierung, Kalender-Abo, BFV-Sync und PayPal bleiben unberührt. Sonst plane ich **keine** Migration — es sei denn, du beantwortest Frage 2 mit „ja" (siehe unten, dann kommt eine RLS-Änderung dazu).

---

## 4. Frontend — Gap-Liste

| # | Was fehlt | Aufwand |
|---|---|---|
| F1 | **Unterseiten-Gerüst**: Route, Zurück-Leiste mit Vorstufen-Namen, Slide-Übergang, `prefers-reduced-motion`, Scrollposition der Übersicht merken | groß, einmalig |
| F2 | Übersicht als Gruppenzeilen (Icon-Kachel, Titel, Wert rechts, Chevron), Zeilen ≥ 44 px | mittel |
| F3 | Profilkarte mit Avatar-Initialen und Chevron statt „Angemeldet als …" | klein |
| F4 | Rechte Werte berechnen: `An`/`Aus`, `22:00 bis 08:00`, Mannschaftsname | klein |
| F5 | `pnAbschnittHtml()` **auftrennen** in Unterseite Mitteilungen und Unterseite Ruhezeiten | mittel |
| F6 | Doppelte Einstiege zusammenführen: `Push-Nachrichten verwalten` ([app.js:1739](app.js#L1739), im Admin-Block der Mitteilungen) und `Push-Nachrichten öffnen` ([app.js:1901](app.js#L1901)) → **eine** Zeile `Push-Texte` unter VERWALTUNG | klein |
| F7 | INFO-Gruppe: `Diagnose` ruft das **schon vorhandene** `window.__showDiag()` aus [index.html:110ff](index.html#L110) direkt auf statt über `?debug=1` (spart einen Neustart); `App neu laden` → `location.reload()` | klein |
| F8 | Abmelden als eigene Karte mit rotem Text | klein |
| F9 | BFV-Unterseite als Zeilenform (Mannschaft / Zuletzt aktualisiert) statt der heutigen Kartenform | klein |
| F10 | Kompakter Titel in der Zurück-Leiste beim Scrollen (Panel 4) | klein |
| F11 | **Kader**: Segment-Filter, Gruppenköpfe in *einer* Karte, Status-Pille rechts, Unterzeile aus `statusNote` + `statusSince` + `statusUntil` | mittel |
| F12 | **Kader**: Status-Blatt über den bestehenden `blattAuf`/`blattZu`-Controller, 2×2-Raster, `Speichern` | mittel |
| F13 | KPI-Untertitel `fallen aus` statt `angeschlagen, verletzt oder im Urlaub` | trivial |
| F14 | `.design-sync`: neue Klassen in `conventions.md`, `validate.sh`, Token-Zähler, Karten | mittel |

**Wichtig zu `statusWahlHtml()`:** die Funktion wird an **drei** Stellen benutzt — Übersicht ([app.js:708](app.js#L708)), Kader ([app.js:761](app.js#L761)), Profil ([app.js:1960](app.js#L1960)). Ich baue für das Kader-Blatt einen **neuen** Baustein und lasse `statusWahlHtml()` für Übersicht und Profil unverändert, damit dort nichts kippt.

---

## 5. Fragen

Die Reihenfolge ist nach Auswirkung sortiert. Zu jeder steht meine Empfehlung — ein „ok, so" reicht mir.

**1 · Echte Pfade oder Hash?**
Der Auftrag nennt `/einstellungen/mitteilungen`. Dafür bräuchte [vercel.json](vercel.json) einen Catch-all-Rewrite auf `index.html`, den es heute bewusst nicht gibt (nur die beiden `.ics`-Regeln und der Cron). Die App routet durchgängig über Hashes (`#ansicht=`, `#kasse=`, `#strafe=`), auch alle Push-Deep-Links.
→ **Empfehlung: `#ein=mitteilungen` usw.** Browser-Zurück, Wisch-Zurück und Deep Links aus Push verhalten sich identisch, ohne am Hosting zu drehen. Wenn dir die schöne URL wichtig ist, baue ich die Rewrite-Regel — sag es jetzt, nicht später.

**2 · Sieht ein einfacher Spieler den Kader?**
Heute nein (coach/admin). Das Design zeigt keine Spieler-Variante. **Und das ist keine reine Frontend-Frage:** die Select-Policy auf `player_status` ([0024:33-35](supabase/migrations/0024_rsvp_injury_rls.sql#L33-L35)) gibt einem Spieler nur die **eigene** Zeile. Der Kader mit fremden Verletzungen, Notizen (`Knie`) und Rückkehrdaten wäre eine neue Policy **und** eine Datenschutz-Entscheidung — Gesundheitsdaten sind heikler als Strafbeträge, bei denen du selbst gesagt hast „nur an den Betroffenen".
→ **Empfehlung: Kader bleibt coach/admin.** Spieler setzen ihren Status weiter im Profil.

**3 · Wo werden Notiz und „bis" bearbeitet?**
Das Blatt in A2 zeigt nur vier Knöpfe und `Speichern` — die Liste zeigt aber `Knie` und `bis 04.10.`. Heute sind beide Felder inline bearbeitbar. Ersatzlos gestrichen wäre das ein Funktionsverlust.
→ **Empfehlung: das Blatt blendet „Notiz" und „voraussichtlich bis" unter dem Raster ein, sobald etwas anderes als `fit` gewählt ist.** Panel A2 zeigt den Moment direkt nach dem Tippen auf „angeschlagen", da ist das Einblenden noch nicht passiert. Das ist eine Ergänzung zur Vorlage — deshalb frage ich.

**4 · Fällt „Lazarett" weg?**
Das Design führt die Nicht-Fitten als Gruppe `NICHT FIT · 3` oben in derselben Karte. Der heutige separate Lazarett-Abschnitt wäre dann doppelt.
→ **Empfehlung: Lazarett entfällt**, seine Informationen (seit / bis / Notiz) wandern in die graue Unterzeile.

**5 · Abmelden-Dialog.**
Panel 8 ist der native iOS-Dialog, zweizeilig. `window.confirm` kann das über einen Zeilenumbruch, zeigt auf iOS aber zusätzlich die Domain darüber.
→ **Empfehlung: `window.confirm("Abmelden?\n\nDu wirst auf diesem Gerät abgemeldet.")`.** Alternativ ein eigenes Blatt im App-Stil — dann weicht es aber sichtbar vom Design ab.

**6 · Profilkarten-Chevron.**
Führt er auf die bestehende Profil-Ansicht (`renderProfil`, mit eigenem Status und Rückmeldungen)?
→ **Empfehlung: ja**, und der heutige Knopf „Profil öffnen" entfällt dafür.

**7 · Strafenkatalog und Push-Texte.**
Beides sind heute eigene Vollbild-Ansichten im „Mehr"-Menü. Werden das jetzt Unterseiten von Einstellungen (mit `‹ Einstellungen`), oder bleiben es Sprünge wie bisher?
→ **Empfehlung: Sprünge lassen, nur die Zeile wandert unter VERWALTUNG.** Beide sind umfangreiche Arbeitsansichten, keine Einstellungen — und ein Umbau würde zwei funktionierende Ansichten ohne Not anfassen.

**8 · Was heißt `Mitteilungen · An`?**
Zwei Lesarten: (a) der Gerät-Schalter ist an, (b) irgendeine Kategorie ist an.
→ **Empfehlung: (a)** — `An`, wenn Push auf diesem Gerät läuft, sonst `Aus`, und `Nicht eingerichtet`, solange es kein Abo gibt.

---

## 6. Plan nach deinem OK

1. **Migration** `0041` — der eine Beschreibungstext (B1). Du spielst sie ein, ich warte auf deine Bestätigung. Falls Frage 2 „ja" wird, kommt die Policy dazu und ich nenne sie dir vorher einzeln.
2. **Frontend Einstellungen** — F1 zuerst (Routen-/Unterseiten-Gerüst), dann F2–F10.
3. **Frontend Kader** — F11–F13.
4. **Prüfung** — `einstellungpruef.mjs` und `kaderpruef.mjs` nach dem Muster von `kassepruef.mjs` (reine Funktionen wörtlich aus `app.js`, ohne Browser), Messlauf bei 390 px auf Kontrast, Tippflächen, Überlauf, Scrollpositionen; `.design-sync`-Karten und `conventions.md` nachziehen; Build-Stempel hoch.
5. **Abnahme** — Durchklick als Admin und als Spieler, Abschlussbericht.

Kein Code, bis du zu den acht Fragen etwas sagst.

---

## Entscheidungen (26.09.2026, 21:19 Uhr, wörtlich)

OK, Plan freigegeben. Zu den Fragen:

1 Hash-Routen (#ein=mitteilungen usw.). Kein Rewrite in vercel.json.
2 Kader bleibt coach/admin. Keine neue Policy, keine Gesundheitsdaten für Spieler.
3 Ja: Notiz und "voraussichtlich bis" blenden im Blatt ein, sobald nicht "fit" gewählt ist. Beim Wechsel auf "fit" Notiz und bis-Datum leeren, so wie es set_player_status heute handhabt; prüf das, bevor du es annimmst.
4 Lazarett entfällt, Infos wandern in die Unterzeile.
5 window.confirm mit Zweizeiler, wie empfohlen.
6 Ja, Chevron führt auf renderProfil, "Profil öffnen" entfällt.
7 Sprünge bleiben, nur die Zeilen wandern unter VERWALTUNG.
8 Lesart (a), inkl. "Nicht eingerichtet".

Zusätzlich:
- Benenne "einstellungenneu .png" (Leerzeichen) in "einstellungenneu2.png" um und lege alle vier Dateien in .design-sync/reference/app/einstellungen-kader/ ab, damit die Vorlage eindeutig bleibt. Referenzen in conventions.md entsprechend.
- Migration 0041 mit Down-Teil (alter Text zurück). Ich spiele sie ein und melde mich.
- statusWahlHtml() für Übersicht und Profil unverändert lassen, wie du vorschlägst.
- Leer-Zustände im Kader: Filter "Nicht fit" mit 0 Spielern braucht einen Leerhinweis statt einer leeren Karte.
- Deep Links aus bestehenden Push-Nachrichten, die heute auf die Einstellungen zeigen, auf die neuen #ein=-Routen umbiegen und im Abschlussbericht auflisten.

Starte mit F1.
