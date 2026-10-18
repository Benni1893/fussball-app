# Abschluss Nachtlauf 18.10.2026

Alle Blöcke liegen auf `main`, sind gepusht, und die Produktion ist bestätigt, wo Code betroffen war. Keine Konten geändert, keine Einstellungen in Vercel oder Supabase, keine Mitteilungen oder Mails ausgelöst. Fremde Prozesse (`hyperframes render`) blieben unberührt.

| Block | Ergebnis | Commit | Build |
|---|---|---|---|
| 0 Bestandsaufnahme | erledigt: weder Scroll-Fix noch Design-Referenz war vorhanden | – | – |
| 1 Referenz für Claude Design | **erledigt**, Upload bestätigt | `c85fe42` | unverändert `2026-10-18-A` (kein App-Code) |
| 2 Scroll-Fehler Rückmeldungen-Blatt | **erledigt**, Produktion bestätigt | `a3ba61b` | `2026-10-18-B` |
| 3 Demo-Bereinigung | **erledigt** (3a Sicherung vollständig, Trockenlauf genau wie erwartet) | `815b565` | – (Datenbank) |
| 4 App im sauberen Zustand | **erledigt**, ein Fehler behoben, Produktion bestätigt | `fc6dbab` | `2026-10-18-C` |
| 5 Start vorbereiten | **erledigt** | `0088290` | – |

Prüfungen vor jedem Commit mit App-Code, jeweils in der LF-Kopie und alle grün:
- Pflichtliste 25/25
- `rechtpruef`, `kassenbannerpruef`, `scrollfixpruef`, `startzustandpruef`
- `check-conventions`, `validate` und Build

## Block 1: Referenz für Claude Design

- **Upload bestätigt: ja.** Projekt „FC Fasanerie-Nord App“, nach dem Schreiben per Dateiliste gegengelesen.
  - Design-System: 38 Dateien (27 Karten, `styles.css`, `tokens/`, `fonts/`, `assets/`, `_ds_sync.json`).
  - `einfuehrung/ist/`: 84 Bilder und `INDEX.md`, dazu `einfuehrung/README.md`.
- **Bilder je Rolle:**

  | Rolle | Bilder |
  |---|---|
  | Spieler | 11 |
  | Trainer ohne Spielerrolle | 15 |
  | Kassenwart | 16 |
  | Spielertrainer | 23 |
  | Neues Mitglied (Einführung) | 4 |
  | Bausteine | 15 |

  Beim reinen Trainer fehlen 5 Ansichten (Rückmeldungen, Push bestätigen, Platz, Bank, Formation): Der Klickweg ist nicht nachspielbar, die Ansichten gleichen denen des Spielertrainers. Das steht in `INDEX.md`.
- **Ältere Referenzen** sind nicht gelöscht, sondern mit `VERALTET.md` markiert (`templates/`, `screenshots/`, `uploads/`).
- **Karten:** keine toten Karten gefunden. Die Profil-Karte und `conventions.md` zeigen jetzt die aktuellen Status-Knöpfe (`st-raster`/`st-knopf` statt der alten `st-chips`). Kassenbanner, Einstellungen v2 und Nachschliff Oktober waren schon im Bundle.
- Nachweis in `.design-sync/reference/einfuehrung/REFERENZ-BEREIT.md`.

## Block 2: Scroll-Fehler

- **Ursache:**
  - `sheetSwipeToClose` hing einen **nicht-passiven** `touchmove` an das ganze Blatt und schrieb bei **jeder** Fingerbewegung `transform` ins Blatt, auch beim normalen Scrollen der Namensliste. Gemessen: 4 Schreibvorgänge je Geste.
  - Dazu lag dauerhaft ein nicht-passiver `touchmove` am Fenster (Pull-to-Refresh), auch bei offenem Blatt.
  - WebKit wartet dann bei jedem Scrollschritt auf JavaScript.
- **Behoben in:**
  - Rückmeldungen-Blatt, Kalender-Abo-Blatt und Termin-Menü der Trainer-Ansicht (gemeinsamer Baustein).
  - Kader-Vollbild der Trainer-Ansicht: hatte einen eigenen nicht-passiven Handler und nutzt jetzt den Baustein.
  - Pull-to-Refresh: Der Handler hängt nur noch während einer Ziehgeste ganz oben.
  - `overscroll-behavior: contain` für Listen in Blättern: Rückmeldungen, Mein Status (`.nsb-felder`), Katalog-Blatt, Aufstellungs-Blatt, Dialoge.
  - Strafe hinzufügen und Kasse hatten es schon. Das Wischen in der Kasse war bereits passiv.
- **Nachher:** WebKit und Chromium grün.
  - Die Liste scrollt bis unten, der Hintergrund bleibt stehen.
  - Kein nicht-passiver `touchmove` bei offenem Blatt.
  - Ziehen am Griff schließt das Blatt, ebenso Ziehen bei Liste ganz oben.
- **Aufnahmen** vorher und nachher: `.design-sync/reference/app/scrollfix/`.
- **Grenze:** Playwright kann nicht nativ wischen. Die Gesten laufen synthetisch gegen die Handler, das Scrollen per Mausrad. Auf dem iPhone gegenprüfen.

## Block 3: Demo-Bereinigung

**Sicherung:**
- Vollsicherung `supabase/cleanup/backup-2026-10-18/full.dump`: 1 876 277 Byte, `pg_dump` 17.6, 62 Datenblöcke, SHA-256 `3a92a744…6cbea3fa`.
- Dazu JSON der Gruppe A im selben Ordner. Beides nur lokal, per `.gitignore` ausgeschlossen.
- `pgtools` danach wieder gelöscht.
- Rezept zum Zurückspielen: `supabase/cleanup/WIEDERHERSTELLEN.md`.

**Zeilenzahlen:**

| Tabelle | vorher | nachher |
|---|---|---|
| fines | 317 | 0 |
| fine_status_log | 291 | 0 |
| players | 16 | 1 („Benjamin Lauck“, Nr. 10, OM, mit deinem Konto verknüpft) |
| player_status | 16 | 1 (fit, ohne Datum und Notiz) |
| rsvps | 38 | 0 |
| lineups | 11 | 1 (Vorlage „4-3-3 Standard“, Positionen und Bank leer) |
| events | 60 | 27 (alle 22 BFV unverändert, 5 künftige von Hand) |
| konto_protokoll | 2 | 1 |
| notification_outbox | 41 | 41, unversandt 0 → 0, auch 16 Minuten später |
| notification_sammler | 0 | 0 |
| Gruppe B (clubs, team_settings, Katalog 14, Push-Texte 20, Einladung, Einwilligungen, Profile, Rollen, Prefs, Push-Abos, auth.users 2) | | unverändert |

**Gelöschte Termine (33):** alle von Hand angelegt, Datum vor dem 18.10., keiner mit BFV-Kennung. Vollständige Liste in `supabase/cleanup/2026-10-18-geloeschte-termine.md`.
- **Juni:** Training 04., 09., 11., 16., 18., 23.06.; Spiele 07.06. „Heimspiel“, 13.06. „Auswärtsspiel“, 21.06. „Heimspiel“, 28.06. „Auswärtsspiel“; Sonstiges 19.06. „Sommerfest des Vereins“, 25.06. „Mannschaftsabend“.
- **August bis Oktober:** Training 06., 11., 13., 18., 20., 25., 27.08.; 01., 03., 08., 10., 15., 17., 22., 24., 29.09.; 01., 06., 08., 13., 15.10.

## Block 4: Startzustand

- **Gefunden und behoben:** Die Übersicht brach für einen Trainer **ohne eigenen Kadereintrag** ab, also nach Trainer-Link mit „Ich spiele nicht mit“. Statt der Seite stand `Cannot read properties of undefined (reading 'name')`, weil die Begrüßung `me.name` las. Jetzt steht der Name aus dem Konto da, sonst „Servus!“. Das hätte am Starttag jeden nicht mitspielenden Trainer getroffen.
- **Geprüft und in Ordnung**, für alle Rollen (Spieler, Trainer, Kassenwart, Spielertrainer, Admin):
  - Kassenbanner im Saisonstart: 0,00 €, „Noch keine Strafen“, „Nichts offen“.
  - Leerzustände in Konto › Ich und Mannschaft sowie in allen drei Reitern der Kasse.
  - Kader mit einem Spieler, Rückmeldungen-Blatt mit einem Spieler.
  - Trainer-Ansicht mit leerer Vorlage, Mein Status fit, Hero mit dem nächsten Termin.
  - Kein `undefined`, `NaN` oder `null`, keine Fehler im Startprotokoll.
- Bilder: `.design-sync/reference/app/startzustand/`.

## Selbst entschieden

- **Eine zusätzliche Strafe mitgelöscht:** In der Nacht stand **eine Strafe mehr** in der Datenbank als im Befund (317 statt 316). Sie wurde am 18.10. um 00:26 Uhr von Hand angelegt, für den Demo-Spieler „Moritz Schäfer“, offen. Nach deiner Entscheidung „alle Strafen löschen“ habe ich sie mitgelöscht. Sie steckt in beiden Sicherungen.
- **Status von „Benjamin Lauck“:** Auch `status_since` (Beginn des Status) ist geleert. Bei der Vorlage habe ich neben den Positionen die Bank geleert.
- **Reiner Trainer im Stand-in:** Der Trainer ohne Spielerrolle entsteht über eine neue, optionale Rollen-Übersteuerung (`rollen`, `ohneSpieler`). Ohne Option verhält sich das Stand-in wie vorher.
- **Upload:** Das Bundle ging ohne die Landkarte hoch (31 MB). Der Marker `_ds_needs_recompile` ist dabei, damit Claude Design den Kartenindex neu baut.
- **Pull-to-Refresh:** Der Handler hängt jetzt nur während der Geste. Auf dem iPhone kurz prüfen, ob das Ziehen oben auf der Übersicht noch wie gewohnt wirkt; den Bounce verhindert weiterhin `overscroll-behavior: none` am `body`.

## Morgen zu entscheiden

1. `[E-MAIL]` in Datenschutz (2×) und Impressum (1×) eintragen.
2. Supabase-Dashboard: Verträge zur Auftragsverarbeitung mit Supabase und Vercel, Site URL und Redirect URLs, Mail-Absender bzw. eigener SMTP.
3. `rascha.k@yahoo.com`: seit 10.06. ungenutzt, Rolle Spieler, kein Kadereintrag. Behalten oder entfernen?
4. Wer ist Trainer? Trainer-Link oder dir die Trainerrolle geben (`STARTTAG.md`).
5. Künftige von Hand angelegte Termine bestätigen: Training 20., 22., 27., 29.10., Mannschaftsabend 13.11.
6. War die Strafe vom 18.10. 00:26 ein bewusster Test von dir? Sie ist gelöscht; zurückholen über `WIEDERHERSTELLEN.md`.
7. Gerätetest nach `.design-sync/GERAETETEST-START.md`, besonders das Scrollen im Rückmeldungen-Blatt auf dem iPhone.
