# Automatische Mitteilungen: Abschluss (05.10.2026)

Auftrag vom 05.10.2026: Datenbankzugang, AM2 abschließen, Sicherung, dann AM3, AM4, AM5 und
P1 serverseitig eigenständig, Bericht am Ende. Alle Datenbankänderungen sind **live**;
die Frontend-Änderung aus AM5 (Hinweis weg, Build 2026-10-05-C) geht erst mit dem Push.
**Nichts ist gepusht.**

## Auf einen Blick

- Migrationen 0045 bis 0051 eingespielt, jede als ein `do`-Block mit Gegenprobe.
- Eine Korrektur-Migration (0047) aus einer roten Prüfrunde; kein Teilpaket brauchte mehr als zwei Runden.
- Alle Prüfskripte 0042 bis 0051 grün: **452 Fälle, 452 PASS**. Pflichtliste nach jedem Commit **20/20**.
- Zustelltest ohne Gerät: alle 12 Kategorien eingereiht, vom Dispatcher geholt und ohne Fehler als gesendet markiert.
- Keine Stopp-Regel ausgelöst: keine Nutzerdaten geändert oder gelöscht, keine Rechte oder RLS bestehender Tabellen außer dem beschlossenen `grant` für `send_rsvp_reminder`, nichts rückwirkend, keine Test-Push an echte Geräte.
- Sicherung vor AM3: `C:\Users\Benjamin\fussball-app-db\sicherungen\2026-10-05_vor-AM3` (613 KB; 18 Tabellen, 787 Zeilen als JSON, Schema aus dem Katalog: 77 Funktionen, 39 Policies, 11 Trigger, Rechte, Cron-Jobs). `pg_dump` fehlt, `npx supabase db dump` braucht Docker; deshalb das Node-Skript `fussball-app-db\werkzeug\sicherung.mjs`.

## Je Kategorie

Wartezeit = vom Ereignis bis zur Zeile in der Outbox; danach holt der Dispatcher im Minutentakt
(Ruhezeit und Schalter des Empfängers gelten wie immer, `high` darf mit „Dringendes trotzdem
zustellen“ durch). „Live“ heißt: Erzeuger aktiv. Wo heute niemand die Empfängerrolle hat, steht es dabei.

| Kategorie | Auslöser | Empfänger | Wartezeit | Beispieltext | Status |
|---|---|---|---|---|---|
| `strafe_neu` | neue offene Strafe (von Hand, Anpfiff, verspätete Rückmeldung) | der Spieler, **auch als Auslöser** (F1) | 3 Min. Karenz, mehrere eines Aufrufs = eine | 💸 Neue Strafe: 8,00 € · Verspätete Rückmeldung, 20.09.2026. Bar, Überweisung oder PayPal. | live (AM2) |
| `zahlung_gemeldet` | Strafe → gemeldet | alle Kassenwarte, außer Auslöser | 15 Min. ab der ersten | 💰 2 Zahlungen zu prüfen · Max Bauer, Tobias Klein, 43,50 €. Jetzt bestätigen. | live; Kassenwart: nur du |
| `zahlung_bestaetigt` | Strafe → bestätigt | der Spieler, außer Auslöser | 1 Min. | ✅ Zahlung bestätigt · 3 Strafen, 43,50 € verbucht. | live |
| `zahlung_abgelehnt` | gemeldet → offen mit Grund | der Spieler, außer Auslöser | 1 Min. | ⚠️ Zahlung nicht bestätigt · 43,50 €: Betrag stimmt nicht überein. Bitte mit dem Kassenwart klären. | live |
| `termin_neu` | neuer künftiger Termin (App, Serie, BFV) | alle Spieler, außer Auslöser | 30 Min. je Auslöser; BFV je Lauf ab 08:00 | 📅 3 neue Termine · Jetzt zu- oder absagen: Training 22.09., Training 24.09., VfB Sparta München 27.09. | live (AM3) |
| `termin_geaendert` | Datum, Uhrzeit, Ort; „Findet doch statt“ | alle Spieler ohne Urlaub/verletzt am Termintag, außer Auslöser | 10 Min. je Auslöser; BFV ab 08:00; Serie = eine | 📅 VfB Sparta München geändert · 20.09.2026: Anstoß jetzt 14:00 statt 12:30 Uhr | live |
| `termin_abgesagt` | künftiger Termin → abgesagt **oder gelöscht** (0053) | wie geändert | 2 Min. je Auslöser gesammelt, mehrere = eine (0054); BFV ab 08:00 | ❌ VfB Sparta München fällt aus · 20.09.2026 12:30 Uhr. | live |
| `rueckmeldung_erinnerung` | Meldeschluss in 22 bis 24 h bzw. 0 bis 2 h | Spieler ohne Rückmeldung, ohne Urlaub/verletzt | Cron alle 5 Min. | ⏳ Bist du dabei? VfB Sparta München · 20.09. 12:30 Uhr · Meldeschluss morgen 12:30 Uhr. Ohne Antwort wird's teuer. (der letzte Satz nur mit Auto-Strafe, 0052) | live (AM4) |
| `absage_kurzfristig` | Absage nach Meldeschluss, vor Beginn | alle Trainer, außer Auslöser | 10 Min. je Termin | 🚨 2 kurzfristige Absagen · Training 22.09. 19:30 Uhr: Max Bauer, Tobias Klein | live; **heute kein Trainer** |
| `meldeschluss_uebersicht` | Meldeschluss vorbei (erste Stunde) | alle Trainer | Cron alle 5 Min. | 📋 VfB Sparta München 20.09. · 12:30 Uhr · ✅ 12 · ❌ 3 · ❓ 4 | live; **heute kein Trainer** |
| `unterbesetzung` | entfällt | niemand | keine | keiner | **aus** (F4) |
| `strafen_offen` | 1. des Monats 16:00 UTC, offene Strafe älter als 28 Tage | der Spieler (Schalter Standard aus) | einmal im Monat | 💸 Offene Strafen: 128,50 € · 9 Strafen, älteste vom 12.08.2026. | live (AM5) |
| `rueckmeldung_nachfrage` | Trainer/Admin ruft `send_rsvp_reminder` | Spieler ohne Rückmeldung mit Gerät, ohne Urlaub/verletzt, außer Auslöser | sofort, Sperre 12 h je Termin | ⏳ Bitte zurückmelden: VfB Sparta München · 20.09. 12:30 Uhr. Dein Trainer wartet noch auf deine Zu- oder Absage. | Server live, **Knopf fehlt** (nach dem Design-Review) |

Heute ist nur ein Profil mit einem Spieler verknüpft (deins). Spieler-Nachrichten gehen deshalb
vorerst nur an dich, Trainer-Nachrichten an niemanden.

## Prüfskripte

| Skript | Ergebnis | Runden |
|---|---|---|
| `0042_rechtepruef.sql` | 166/166 | Nachlauf |
| `0043_auto_pruef.sql` | 83/83 | 2 Fälle nachgezogen (s. u.) |
| `0044_bfv_pruef.sql` | 13/13 | 1 Fall nachgezogen (s. u.) |
| `0045_kasse_pruef.sql` | 57/57 | 1 Fall nachgezogen (s. u.) |
| `0046_termine_pruef.sql` (0046, 0047) | 50/50 | Runde 1: 48/50 (ein echter Fehler → 0047, ein Fehler im Prüfskript); Runde 2 grün |
| `0048_rueckmeldung_pruef.sql` | 37/37 | Runde 1: 34/37 (Zählung im Prüfskript); Runde 2 grün |
| `0049_strafen_offen_pruef.sql` | 13/13 | Runde 1 |
| `0050_nachfrage_pruef.sql` | 23/23 | Runde 1 |
| `0051_texte_pruef.sql` | 10/10 | Runde 2 (Planer ließ eine ungenutzte IMMUTABLE-Funktion weg) |
| **Summe** | **452/452** | |

Pflichtliste nach jedem Commit: **20/20** (zuletzt nach P1).

**Offen gesagt:** Beim Nachlauf der älteren Skripte waren zwei Fälle rot, die bei deinen Läufen
als grün gemeldet waren: `0045` Fall 53 erwartete „9“, die Spalte ist `numeric(8,2)` und liefert
„9.00“; `0043` Fall 82 las die Outbox in derselben Anweisung, in der `notify_enqueue` schrieb,
und kann die Zeile wegen des Snapshots nie sehen. In dieser Form konnten beide nicht grün sein.
Die Funktionen selbst arbeiten richtig (getrennt geprüft). Beide Fälle sind korrigiert, dazu zwei
Fälle, die voraussetzten, dass es noch keine Termin-Erzeuger gibt.

## Zustellung ohne Gerät

Je Kategorie eine Vorschau-Zeile für das Testkonto (`e-testspieler`, ohne Gerät), gerendert mit
den echten Vorlagen und Beispieldaten: eingereiht 21:57:13, alle 12 bis 21:58:02 vom Dispatcher
geholt und als gesendet markiert, kein Fehler. Danach gelöscht. Dein Gerät war nicht beteiligt.
Echte Zustellung an dein Handy: „Neue Strafe“ am 05.10. um 18:54/18:55 UTC (dein Test).

## Hinweise für dich

- **Push vorher nötig:** Der Hinweis auf der Seite Mitteilungen verschwindet erst mit dem Push (Build 2026-10-05-C).
- **Heute Nacht** (04:00 UTC) läuft der BFV-Sync zum ersten Mal mit AM3. Echte Änderungen, neue oder abgesagte Spiele melden sich frühestens um 08:00. Die drei Freundschaftsspiele bekommen Heim/Gegner korrigiert; das ist keine Datums-, Zeit- oder Ortsänderung und erzeugt nichts.
- **Text „Ohne Antwort wird's teuer.“**: seit Migration 0052 (06.10.2026) über den optionalen Platzhalter `{strafhinweis}`, nur bei Terminen mit Auto-Strafe; bei BFV-Spielen fällt der Satz weg. Den Text pflegst du weiter auf der Seite Push-Texte (Baustein `{strafhinweis}` verschieben oder weglassen). Der Wortlaut des Hinweises steht in den Beispieldaten der Vorlage und gilt für Vorschau und Versand; ändern lässt er sich bisher nur per Migration. Prüfskript `0052_strafhinweis_pruef.sql` 13/13.
- **Trainerrolle:** Solange niemand Trainer ist, kommen „Kurzfristige Absagen“ und „Übersicht nach Meldeschluss“ bei niemandem an.
- **Gelöschte Termine** (Entscheidung 06.10.2026, Migration 0053, Prüfskript `0053_termin_geloescht_pruef.sql` 10/10): ein künftiger, geplanter Termin, der gelöscht wird, löst dieselbe Absage-Nachricht aus wie „Fällt aus“. Die Empfänger hängen nicht an den Rückmeldungen (die per Cascade verschwinden), der Text kommt aus der gelöschten Zeile. Seit Migration 0054 (06.10.2026) werden Absagen gebündelt: Serie ab einem Datum gelöscht oder „Fällt aus“ auf mehrere Termine ergibt eine Nachricht je Spieler („❌ 12 Trainings ab 14.10. fallen aus“, gemischt „Termine“; Text „14.10. bis 23.12.2026 19:30 Uhr.“, Uhrzeit nur wenn bei allen gleich). 0055 korrigiert einen Fall aus dem Prüfskript: „Fällt aus“ und danach gelöscht ergab gar keine Nachricht. Prüfskripte `0053_termin_geloescht_pruef.sql` 9/9, `0054_absagen_pruef.sql` 17/17, `0046_termine_pruef.sql` 50/50.
- **Kopf von 0045** trägt noch „ENTWURF, nicht eingespielt“; eingespielte Dateien ändere ich nicht mehr, maßgeblich ist PHASE0.md.
- **Testkonto** bleibt bis nach P1-Frontend, ohne Spieler, ohne Admin (unverändert).

## Testanleitung am Handy

Voraussetzungen: Push auf dem Handy aktiv, die jeweiligen Schalter an, außerhalb deiner
Ruhezeit (Standard 22 bis 8 Uhr; bei „Dringendes trotzdem zustellen“ kommen `high`-Nachrichten
auch nachts). Nach jedem Test mit einer Strafe: Strafe wieder stornieren.

| Kategorie | Was tun | Was muss ankommen | Nach wie vielen Minuten |
|---|---|---|---|
| Neue Strafe | Kasse: dir selbst eine Strafe eintragen | „💸 Neue Strafe: <Betrag>“, Tippen öffnet Meine Strafen | 3 bis 6 |
| Neue Strafe, zwei auf einmal | in einem Vorgang zwei Strafen für dich eintragen | **eine** Push „💸 Neue Strafe: <Summe>“, Text „2 Strafen: …“ | 3 bis 6 |
| Storno in der Karenz | eintragen und innerhalb von 3 Minuten stornieren | **nichts** | 10 Minuten warten |
| Erinnerung 24 h | für das Training am 08.10. **nicht** zu- oder absagen | „⏳ Bist du dabei? Training“, Meldeschluss „morgen 16:30 Uhr“ | am 07.10. zwischen 16:30 und 16:35 |
| Erinnerung 2 h | weiter ohne Rückmeldung bleiben | dieselbe Push, Meldeschluss „heute 16:30 Uhr“ | am 08.10. zwischen 14:30 und 14:35 |
| Erinnerung entfällt | vorher zu- oder absagen | **nichts** | |
| Übersicht nach Meldeschluss | dir zusätzlich die Rolle Trainer geben, ein Training abwarten | „📋 Training <Datum>“ mit ✅/❌/❓ | bis 5 Minuten nach Meldeschluss |
| Offene Strafen | Schalter „Monatliche Erinnerung“ an (bei dir an), offene Strafe älter als 4 Wochen | „💸 Offene Strafen: …“ | am 1.11. um 17:00 Uhr (Winterzeit) |

Nicht allein testbar, weil du als Auslöser nichts bekommst (F1): Zahlung gemeldet, bestätigt,
abgelehnt, Termin neu, geändert, abgesagt, kurzfristige Absage. Dafür braucht es ein zweites Konto
mit Spieler bzw. Trainerrolle, das die Aktion auslöst. Die Wege sind mit echten Zeilen in den
Prüfskripten belegt. Termin-Nachrichten aus dem BFV-Sync (ohne Auslöser) kommen bei dir an, sobald
der BFV etwas ändert.

## Commits (nicht gepusht)

| Commit | Inhalt |
|---|---|
| `40b83b8` | CLAUDE.md: Datenbankzugang |
| `21522ba` | AM2: Mitteilungen zur Kasse (0045, Build 2026-10-05-B) |
| `ffa0b40` | AM3: Mitteilungen zu Terminen (0046, 0047) |
| `b016511` | AM4: Mitteilungen zu Rückmeldungen (0048) |
| `d2dc926` | AM5: offene Strafen, Hinweis weg (0049, Build 2026-10-05-C) |
| `e1962bb` | P1 serverseitig: Nachfrage, Textkorrekturen (0050, 0051) |
| (dieser) | Abschlussbericht, PLAN.md, NOTES.md |

Gepusht wird erst nach deinem OK.

---

## Inhalt von ANNAHMEN.md

### AM3 Termine (Migration 0046)

| # | Annahme | Grund |
|---|---|---|
| T1 | `termin_abgesagt` geht wie `termin_geaendert` (F3) an alle Spieler **außer Urlaub und verletzt**. | Gleiche Logik wie die entschiedene Änderung; wer ausfällt, braucht die Absage nicht. |
| T2 | „Urlaub oder verletzt“ zählt **am Tag des Termins** (`status_until` einschließlich, ohne Datum offen), nicht am Tag der Nachricht. Gilt für alle Termin- und Rückmeldungsnachrichten. | Wer bis Mittwoch verletzt ist, soll die Absage für Samstag bekommen. |
| T3 | `termin_neu` geht an **alle** verknüpften Spieler, auch an Urlaub und verletzt; nur der Auslöser nicht (F1). | Neue Termine liegen meist nach dem Ausfall; der Katalog sagt „alle Spieler“. |
| T4 | Absage mit **2 Minuten Karenz** (seit 0054 im Sammler, je Auslöser gebündelt). „Findet statt“ davor nimmt sie still zurück; danach geht „Findet doch statt“ als `termin_geaendert`. | Ein Fehlklick auf „Fällt aus“ soll keine Push an alle auslösen. |
| T5 | **Entschieden 06.10.2026 (Migration 0053), ersetzt die Annahme:** Wird ein **künftiger** Termin gelöscht, kommt dieselbe Nachricht wie bei „Fällt aus“ (`termin_abgesagt`, gleiche Empfänger, Urlaub/verletzt ausgenommen, Auslöser ausgenommen, 2 Minuten, BFV ab 08:00). Vergangene oder schon abgesagte Termine löschen bleibt still; steht die Neu-Meldung noch aus, ebenfalls (T9). Seit 0054 (Entscheidung 06.10.2026) gebündelt: mehrere künftige Termine in einem Vorgang gelöscht oder auf „Fällt aus“ gesetzt ergeben **eine** Nachricht je Spieler, z. B. „❌ 12 Trainings ab 14.10. fallen aus“ (gemischt: „Termine“), gesammelt je Auslöser 2 Minuten. | Entscheidung des Nutzers. |
| T6 | Änderungen werden **je Auslöser 10 Minuten** gesammelt. Mehrere Termine (z. B. Serie) ergeben **eine** Nachricht: „📅 3 Termine geändert“, Text „ab <Datum>: <Änderung>“, bei unterschiedlichen Änderungen die Terminliste. | Eine Serienänderung soll nicht zwanzig Pushs auslösen. |
| T7 | Vorlage `termin_neu`: Titel „📅 {anzahl}“ mit „1 neuer Termin“ / „3 neue Termine“, Text „Jetzt zu- oder absagen: {liste}“. Nur ersetzt, solange der Auslieferungsstand gilt. | Wie K1 (keine „1 neue Termine“); außerdem stand nach dem Datum „..“ („27.09.. Jetzt“). |
| T8 | Ganztägige Termine: `{uhrzeit}` = „ganztägig“. Terminlisten zeigen höchstens 5 Einträge, dann „und N weitere“. | `{uhrzeit}` ist Pflicht in den Vorlagen; Push-Texte sind auf 400 Zeichen begrenzt. |
| T9 | Steht die „neu“-Meldung eines Termins noch aus (30 Minuten), erzeugen Änderung oder Absage dieses Termins **nichts**; die Neu-Meldung zeigt dann den Endstand, bei Absage entfällt sie. | Spieler kennen den Termin noch nicht. |

### AM4 Rückmeldung (Migration 0048)

| # | Annahme | Grund |
|---|---|---|
| R1 | Vorlage `absage_kurzfristig`: Titel „🚨 {anzahl}“ mit „1 kurzfristige Absage“ / „2 kurzfristige Absagen“. Nur ersetzt, solange der Auslieferungsstand gilt. | Wie K1. |
| R2 | Die Erinnerung gilt für **alle** Spiele und Trainings mit Meldeschluss, auch ohne Auto-Strafe (alle BFV-Spiele). Der Vorlagentext „Ohne Antwort wird's teuer.“ stimmt dort nicht; er bleibt, weil Push-Texte Admin-Sache sind (Hinweis im Abschlussbericht). | Eine Erinnerung hilft auch ohne Strafe. |
| R3 | Erinnerungsfenster: Meldeschluss in **22 bis 24 Stunden** bzw. in **0 bis 2 Stunden**, Cron alle 5 Minuten, je Termin, Spieler und Stufe höchstens einmal. Ein spät angelegter Termin bekommt nur die Stufen, deren Fenster noch kommt. | Vorschlag aus PHASE0.md, mit Spielraum für einen ausgefallenen Cron-Lauf. |
| R4 | Übersicht nach Meldeschluss: einmal je Termin, wenn der Meldeschluss höchstens eine Stunde zurückliegt und der Termin noch nicht begonnen hat. „Offen“ = Spieler des Vereins ohne Rückmeldung, **ohne** Urlaub/verletzt am Termintag. | Ein Spieler im Urlaub ist nicht „offen“. |
| R5 | Kurzfristige Absage: jede neue Absage („ab“, auch Wechsel von „zu“) zwischen Meldeschluss und Beginn; an die Trainer, 10 Minuten gesammelt; wer in der Zeit wieder zusagt, fällt aus der Liste. | Vorschlag aus PHASE0.md. |

### AM5 Offene Strafen (Migration 0049) und Hinweis

| # | Annahme | Grund |
|---|---|---|
| S1 | Auslöser: mindestens eine **offene** Strafe, die vor mehr als **28 Tagen angelegt** wurde (`created_at`, wie der Mahnzuschlag). Betrag und Anzahl über **alle** offenen Strafen des Spielers (nicht gemeldet, nicht storniert), Datum = ältestes Vergehen (`date`). | Katalog „offen älter als 4 Wochen“; die Frist der App zählt ab Anlage. |
| S2 | Vorlage `strafen_offen`: Text „{anzahl}, älteste vom {datum}.“ mit „1 Strafe“ / „9 Strafen“. Nur ersetzt, solange der Auslieferungsstand gilt. | Wie K1. |
| S3 | Zeitpunkt: am **1. jedes Monats um 16:00 UTC** (18:00 Sommerzeit, 17:00 Winterzeit); höchstens einmal im Monat je Spieler. Zugestellt nur mit eingeschaltetem Schalter (Standard aus). | Vorschlag aus PHASE0.md („am 1., 18:00 Ortszeit“); pg_cron rechnet in UTC. |
| S4 | Der Hinweis auf der Seite Mitteilungen verschwindet über die vorgesehene Konstante `AUTO_MITTEILUNGEN_AKTIV = true` (Build 2026-10-05-C). Live erst mit dem Push nach deinem OK. | Vorgabe AM5. |

### P1 serverseitig (Migration 0050) und Texte (0051)

| # | Annahme | Grund |
|---|---|---|
| N1 | Wer die Nachfrage auslöst und selbst ohne Rückmeldung ist (Spielertrainer), bekommt sie nicht (F1) und zählt nur unter „offen“. | Grundregel F1. |
| N2 | Die 12-Stunden-Sperre beginnt erst, wenn mindestens eine Nachricht eingereiht wurde. Erreicht eine Nachfrage niemanden (alle ohne Gerät), darf sofort erneut gefragt werden. | Sonst sperrt ein Versuch ohne Wirkung zwölf Stunden. |
| N3 | Text: Datum kurz, Uhrzeit optional (ganztägig: ohne), Meldeschluss nur als optionaler Platzhalter (steht nicht im Text). Rückgabe zusätzlich `nur_zaehlen`, `letzte`. | Vorschlag aus einstellungen-v2/PHASE0.md, Abschnitt e). |
| N4 | Die mit P1 beschlossenen Textkorrekturen stehen in einer **eigenen** Migration 0051 (aus den Live-Definitionen erzeugt, nur die Meldungstexte geändert). `set_ical_url` sagt jetzt „Nur Trainer, Kassenwart oder Admin dürfen die iCal-URL setzen.“ (Schrägstriche durch Komma und „oder“). | Kleinere, getrennt prüfbare Migration. |
