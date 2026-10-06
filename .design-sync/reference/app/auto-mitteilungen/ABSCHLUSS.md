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


## Morgenprüfung 06.10.2026

Lesend geprüft um 08:54 Uhr Ortszeit.

| Prüfung | Ergebnis |
|---|---|
| BFV-Nachtlauf gelaufen | ja: drei BFV-Termine um 04:27 UTC (06:27 Ortszeit) aktualisiert, sonst keine Änderung |
| vergangene BFV-Spiele auf „abgesagt“ | 0 (künftige ebenfalls 0) |
| Freundschaftsspiele 2027 | 13.02. TSV Schwabhausen II, 21.02. ATSV Kirchseeon II, 28.02. TSG Pasing II: jeweils `home = true`, Titel „Heimspiel“, Gegner nur der Verein; Kalender-Version je +1 |
| Termin-Nachrichten aus dem Lauf | keine: weder im Sammler noch in der Outbox seit 05.10. 22:00 UTC. Richtig so, denn geändert haben sich nur Titel, Heim und Gegner, nicht Datum, Uhrzeit oder Ort; neue oder fehlende Spiele gab es nicht. Die 08:00-Regel kam deshalb noch nicht zum Tragen. |
| Cron-Jobs seit 05.10. 20:00 UTC | alle erfolgreich: `push-dispatch` 775, `notify-sammler` 388, `notify-rueckmeldung` 155, `apply-event-fines` 52, `apply-fine-surcharges-daily` 1, `notification-cleanup` 1; kein Lauf mit anderem Status |
| Outbox-Fehler seit 05.10. 20:00 UTC | 0 |

Keine Auffälligkeit, nichts geändert.


## Abschluss 06.10.2026: Konsistenz, Robustheit, Live-Durchlauf

Auftrag vom 06.10.2026 („Push-Automatik in sich schlüssig abschließen“). Sicherung vorher:
`C:\Users\Benjamin\fussball-app-db\sicherungen\2026-10-06_vor-Abschluss` (649 KB).

### Konsistenzmatrix (Endstand)

U/v = Urlaub oder verletzt am Termintag. F1 = Auslöser bekommt nichts. „bis Beginn“ usw. =
`gueltig_bis`. Prüfskript = wo die Kategorie mit echten Zeilen geprüft wird; die Matrix selbst
prüft `0056_konsistenz_pruef.sql` (Rollen, aktive Kategorien, Erzeuger, Emoji, Deep Links,
Dringlichkeit, Verfall, Texte, Platzhalter).

| Kategorie | Erzeuger | Vorlage | Schalter (Mitteilungen) | Push-Texte | Empfänger | F1 | U/v | Ruhezeit / Dringlichkeit | 08:00 bei BFV | Wartezeit / Bündelung | Verfall | Deep Link | Prüfskript |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `strafe_neu` | Trigger `fines` | aktiv | Neue Strafe | ja | der Spieler | Ausnahme: auch an den Auslöser | nicht ausgenommen | normal, wartet Ruhezeit ab | kein BFV-Weg | 3 Min., je Aufruf eine | 7 Tage fest | `#strafen=meine` | 0045 |
| `zahlung_gemeldet` | Trigger `fines` | aktiv | Zahlung gemeldet (Kasse) | ja | alle Kassenwarte | ja | nicht betroffen | normal | kein BFV-Weg | 15 Min. | 3 Tage fest | `#kasse=pruefen` | 0045 |
| `zahlung_bestaetigt` | Trigger `fines` | aktiv | Zahlung bestätigt | ja | der Spieler | ja | nicht ausgenommen | normal | kein BFV-Weg | 1 Min. | 7 Tage fest | `#strafen=meine` | 0045 |
| `zahlung_abgelehnt` | Trigger `fines` | aktiv | Zahlung abgelehnt | ja | der Spieler | ja | nicht ausgenommen | normal | kein BFV-Weg | 1 Min. | 7 Tage fest | `#strafen=meine` | 0045 |
| `termin_neu` | Trigger `events` | aktiv | Neue Termine | ja | alle Spieler | ja | nicht ausgenommen (T3) | normal | ja | 30 Min. je Auslöser, BFV je Lauf | bis Beginn des letzten (0056) | `#ansicht=kalender` | 0046, 0056 |
| `termin_geaendert` | Trigger `events` | aktiv | Termin geändert | ja | alle Spieler | ja | ausgenommen (F3) | zeitkritisch | ja | 10 Min. je Auslöser, Serie eine | bis Beginn | `#termin=` | 0046, 0047 |
| `termin_abgesagt` | Trigger `events` (Status und Löschen) | aktiv | Termin fällt aus | ja | alle Spieler | ja | ausgenommen | zeitkritisch | ja | 2 Min. je Auslöser, Serie eine | bis Beginn | `#ansicht=kalender` | 0046, 0053, 0054 |
| `rueckmeldung_erinnerung` | Cron alle 5 Min. | aktiv | Erinnerung an Zu- oder Absage | ja, mit Strafhinweis | Spieler ohne Rückmeldung | kein Auslöser | ausgenommen (F6) | zeitkritisch | kein BFV-Weg | 24 h und 2 h vor Meldeschluss | bis Meldeschluss | `#termin=` | 0048, 0052, 0056 |
| `rueckmeldung_nachfrage` | RPC `send_rsvp_reminder` (Knopf folgt) | aktiv | bewusst kein eigener, gilt „Erinnerung“ | ja | Spieler ohne Rückmeldung mit Gerät | ja | ausgenommen | normal (Entscheidung 4) | kein BFV-Weg | sofort, Sperre 12 h | bis Beginn | `#termin=` | 0050 |
| `absage_kurzfristig` | Trigger `rsvps` | aktiv | Kurzfristige Absagen | ja | alle Trainer | ja | nicht betroffen | zeitkritisch | kein BFV-Weg | 10 Min. je Termin | bis Beginn | `#termin=` | 0048 |
| `meldeschluss_uebersicht` | Cron alle 5 Min. | aktiv | Übersicht nach Meldeschluss | ja | alle Trainer | kein Auslöser | „offen“ ohne U/v | normal | kein BFV-Weg | einmal, erste Stunde | bis Beginn | `#termin=` | 0048 |
| `strafen_offen` | Cron monatlich | aktiv | Monatliche Erinnerung (Standard aus) | ja | der Spieler | kein Auslöser | nicht ausgenommen | normal | kein BFV-Weg | einmal im Monat | 7 Tage fest | `#strafen=meine` | 0049 |
| `unterbesetzung` | keiner (F4) | **aus** | ausgeblendet (folgt) | ja, „aus“ | entfällt | entfällt | entfällt | zeitkritisch | entfällt | entfällt | bis Beginn | `#termin=` | 0056 |
| `test` | Knopf, nur Admin | aktiv | keiner nötig | ja | nur der Auslöser | entfällt | entfällt | übergeht Ruhezeit | entfällt | sofort | fest | `#ein=mitteilungen` | 0042, 0051 |

Alle Zellen sind grün oder begründet: `rueckmeldung_nachfrage` nutzt den Schalter der
Erinnerung (Entscheidung zu P1), `unterbesetzung` ist bis F4 aus und ohne Schalter, `test`
braucht keinen.

### Befunde und Behebungen

| # | Befund | Behebung |
|---|---|---|
| K1 | „Zu wenig Zusagen“ hatte Schalter und aktive Vorlage, aber keinen Erzeuger. | Vorlage aus (0056), Schalter auf der Seite Mitteilungen entfernt, im Ruhezeiten-Hinweis nicht mehr genannt (Build 2026-10-06-A); `prefspruef` prüft das. |
| K2 | Seite Push-Texte: zwei Gedankenstriche in sichtbaren Texten. | Komma bzw. Doppelpunkt. |
| K3 | Strafhinweis-Wortlaut nur per Migration änderbar. | Feld „Strafhinweis“ in der Karte der Erinnerung, RPC `set_notification_strafhinweis` (nur Admin, 80 Zeichen, nicht leer, ohne Klammern), dieselbe Quelle wie der Versand (0056). |
| K4 | Emoji-Tabelle in `conventions.md` ohne `rueckmeldung_nachfrage`. | Ergänzt (⏳). |
| K5 | `termin_neu` mit fester Lebensdauer von 7 Tagen. | Verfällt mit dem Beginn des letzten genannten Termins (0056). |
| K6 | Hinweis „Automatisch kommen bisher nur …“ | War seit Build 2026-10-05-C weg und ist gepusht; geprüft von `einpruef`. |
| K7 | Platzhalter | Alle 14 Vorlagen rendern mit ihren Beispieldaten ohne `{…}`, keine Outbox-Zeile ist je an einem Platzhalter gescheitert; die Erzeuger liefern alle Pflicht-Platzhalter (exakte Texte in den Prüfskripten). |

### Robustheitsfälle

| Fall | Verhalten | Beleg | Ergebnis |
|---|---|---|---|
| Spieler ohne Push-Abo | Zeile gilt als erledigt, bleibt als Eintrag in der App | Zustelltest 05.10. (12 Kategorien) und heute (Testkonto ohne Gerät) | ok |
| abgelaufenes Abo (404/410) | Gerät wird entfernt | echter Lauf: ungültiger Mozilla-Endpunkt, vom Dispatcher entfernt; SQL-Fall in 0057 | ok |
| mehrere Geräte | eine Zeile je Nachricht; Versand an jedes Gerät, eines genügt; Fehlschläge zählen je Gerät, nach 5 entfernt, ein Erfolg setzt zurück | 0057 (Zeilen, Zähler), echter Lauf mit zwei Prüfgeräten | ok |
| **vorübergehender Zustellfehler** | **vorher endgültig verloren**; jetzt bis zu 5 Versuche (5, 10, 15, 20 Min.), nur solange gültig | 0057 (R1), echter Lauf: Versuch 1, neuer Anlauf nach 5 Minuten | **behoben (0057)** |
| Dispatcher-Ausfall über Stunden | zeitgebundene Nachrichten fallen aus `notification_due` und werden als „verfallen“ markiert; **die Lebensdauer beim Push-Dienst wird beim Abholen auf die Restzeit gekürzt** (vorher die volle beim Einreihen); Strafen kommen noch (7 Tage) | 0057 (R2, Rückstau) | **behoben (0057)** |
| doppelter Cron-Lauf | `dedup_key`, Sammler wird beim Zusammenfassen geleert | 0043, 0045, 0048, 0049, 0057 | ok |
| Zeitumstellung 25.10.2026 | Ruhezeit, 08:00-Regel, Beginn und Meldeschluss in Europe/Berlin; Erinnerungsfenster in echten Stunden (25.10. 16:00 für Meldeschluss 26.10. 16:00) | 0057 (in_quiet_hours_at, nicht_vor_acht, Termine am 24./25.10.) | ok |

Echter Dispatcher-Lauf (Testkonto, kein echtes Gerät, 06.10. 21:03 bis 21:10): ungültiger
Mozilla-Endpunkt mit 404/410 entfernt, nicht erreichbarer Host `failed_count = 1`, Zeile mit
Versuch 1 neu eingeplant (21:09:02); nach Entfernen des zweiten Prüfgeräts um 21:10:02 als
erledigt markiert. Testzeilen und Prüfgeräte danach gelöscht, Reste lesend ausgeschlossen.

### Live-Durchlauf an dein Gerät

**Noch offen.** Teil 1 bis 3 waren um 21:11 fertig; der Durchlauf braucht mit den Wartezeiten
rund 20 Minuten und hätte das Fenster bis 21:30 überschritten (ab 22:00 außerdem deine
Ruhezeit). Er startet auf „Live-Test jetzt“ (08:00 bis 21:30). Ablauf, alles per SQL ohne
Auslöser (sonst greift F1), nur dein Profil ist verknüpft; Testtermine ohne Auto-Strafe,
Wartezeiten der Sammler werden für den Test verkürzt:

| Schritt | erwartete Nachricht | gesendet um | Fehler | am Handy angekommen |
|---|---|---|---|---|
| a1 Testtermin „TEST Push“ (Training morgen 19:00) | 📅 1 neuer Termin · Jetzt zu- oder absagen: TEST Push <Datum> | | | |
| a2 Meldeschluss in rund 2 Stunden | ⏳ Bist du dabei? TEST Push · <Datum> 19:00 Uhr · Meldeschluss heute <Zeit> Uhr. (ohne Strafhinweis) | | | |
| b Uhrzeit 19:00 → 20:00 | 📅 TEST Push geändert · <Datum>: Beginn jetzt 20:00 statt 19:00 Uhr | | | |
| c „Fällt aus“ | ❌ TEST Push fällt aus · <Datum> 20:00 Uhr. | | | |
| d1 Strafe als Systemvorgang | 💸 Neue Strafe: 1,00 € · TEST Push Strafe, <Datum>. Bar, Überweisung oder PayPal. | | | |
| d2 Zahlung gemeldet (für dich als Kassenwart) | 💰 1 Zahlung zu prüfen · Lukas Weber, 1,00 €. Jetzt bestätigen. | | | |
| d3 als System bestätigt | ✅ Zahlung bestätigt · 1 Strafe, 1,00 € verbucht. | | | |
| d4 zweite Strafe, gemeldet, abgelehnt | 💸 Neue Strafe … dann ⚠️ Zahlung nicht bestätigt · 1,00 €: TEST Push Ablehnung. Bitte mit dem Kassenwart klären. | | | |
| e Serie aus 3 Testterminen gemeinsam abgesagt | genau eine: ❌ 3 Trainings ab <Datum> fallen aus | | | |
| Aufräumen | keine Nachricht (abgesagte Testtermine und Teststrafen gelöscht) | | | |

### Neue Annahmen, die Spieler merken

1. **Z1:** Eine Push kann bei Störungen beim Push-Dienst bis zu rund 50 Minuten später kommen (bis zu fünf Versuche), statt verloren zu gehen.
2. **Z2:** „Neue Termine“ kommt nach einem längeren Ausfall nicht mehr, wenn die genannten Termine schon begonnen haben.

(Z3 betrifft nur den Admin: Strafhinweis höchstens 80 Zeichen.)

### Nur mit weiteren Konten oder Rollen testbar

- **Trainer:** „Kurzfristige Absagen“ und „Übersicht nach Meldeschluss“ (heute hat niemand die Trainerrolle; als Admin mit zusätzlicher Trainerrolle wäre die Übersicht selbst testbar).
- **Zweiter verknüpfter Spieler:** alles, was der Auslöser nicht bekommt (F1): Zahlung gemeldet durch einen Spieler, bestätigt oder abgelehnt durch dich, Termin neu, geändert oder abgesagt durch dich, kurzfristige Absage.
- **Nachfrage:** braucht den Knopf (nach dem Design-Review), einen Trainer oder Admin und einen anderen Spieler ohne Rückmeldung.

### Commits dieses Auftrags

| Commit | Inhalt |
|---|---|
| `53c57c4` | Morgenprüfung 06.10.2026 in ABSCHLUSS.md |
| `b2a368d` | Konsistenz der Mitteilungen (0056, Build 2026-10-06-A) |
| `d2c15aa` | Robustheit der Zustellung (0057) |
| (dieser) | Abschlussbericht |

Serien bündeln (Teil 1.2) war schon mit `4adaad9` (0054, 0055) erledigt.

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
| R2 | Die Erinnerung gilt für **alle** Spiele und Trainings mit Meldeschluss, auch ohne Auto-Strafe (alle BFV-Spiele). Der Satz „Ohne Antwort wird's teuer.“ kommt seit 0052 (Entscheidung 06.10.2026) über den Platzhalter `{strafhinweis}` nur bei Terminen mit Auto-Strafe. | Eine Erinnerung hilft auch ohne Strafe. |
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

### Konsistenz und Robustheit (Migrationen 0056, 0057)

| # | Annahme | Grund |
|---|---|---|
| Z1 | Scheitert die Zustellung an allen Geräten eines Spielers vorübergehend, versucht der Versand es bis zu **fünfmal** (nach 5, 10, 15 und 20 Minuten), solange die Nachricht gültig ist; danach gilt sie als nicht zustellbar. Meldet ein Gerät „gibt es nicht mehr“ (404/410), wird es entfernt; ohne Gerät bleibt die Nachricht als Eintrag in der App. | Vorher ging eine Nachricht beim ersten Fehler endgültig verloren. |
| Z2 | „Neue Termine“ verfällt, sobald der letzte genannte Termin begonnen hat (höchstens 7 Tage). Nach einem längeren Versandausfall kündigt keine Nachricht Vergangenes an. | Konsistent mit den übrigen zeitgebundenen Kategorien. |
| Z3 | Der Strafhinweis ist höchstens 80 Zeichen lang, nicht leer und ohne geschweifte Klammern; wer ihn nicht will, nimmt `{strafhinweis}` aus dem Text der Erinnerung. | Er steht am Ende einer Push-Nachricht, die bei 110 Zeichen abgeschnitten wird. |
