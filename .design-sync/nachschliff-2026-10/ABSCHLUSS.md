# Nachschliff Oktober: Abschluss

Stand 09.10.2026, Build **2026-10-09-P**. Vorlage: Claude-Design-Projekt
„Nachschliff Oktober Final.dc.html“, gespiegelt nach
`.design-sync/reference/app/nachschliff-2026-10/soll/`. Umgesetzt über die
vorhandenen Klassen und Tokens in `styles.css`, die Vorlage selbst liegt nicht
in der App.

## Ergebnis in Kürze

- **A1 bis A8, D1 bis D6, E1 bis E3 und C1 bis C5 sind umgesetzt**, je ein
  Commit (A gesammelt), Build A bis P.
- **Zwei Migrationen**, beide mit Gegenprobe im Probelauf (zurückgerollt),
  danach eingespielt, je mit Prüfskript:
  - **0059** status_abgelaufen (C4);
  - **0060** undo_fine_payment (C5/E3).
  An bestehenden Daten wurde nichts geändert. Es entstanden keine Strafen und
  keine Mitteilungen, es gab keine Test-Pushs.
- **Pflichtliste 22/22 grün.**
- **390-px-Vergleich:**
  - `finalmess.mjs`: 27/27 Screens grün, 15 davon gegen Nachschliff-Referenzen;
  - `nsmess.mjs`: alle 17 Elemente grün gegen die Nachschliff-Vorlage.
- **Gerätematrix-Teillauf:**
  - 28 Zustände in allen Rollen, je 9 Breiten × 2 Schriftgrößen × 3
    Varianten;
  - **0 Befunde** außerhalb der Ausnahmeliste.
  - Drei Gruppen aus dem ersten Lauf sind behoben (Abschnitt 4).
- Sicherung vor den Migrationen:
  `C:/Users/Benjamin/fussball-app-db/sicherungen/2026-10-09_vor-0059-status-ablauf`
  (18 Tabellen, 792 Zeilen, Schema).

## 1. Stand je Punkt

### Teil A (Layout, ein Commit f7a2065)

| Punkt | Umsetzung |
|---|---|
| A1 Mein Konto | Kontokachel unten so viel Abstand wie oben (Fußzeile der Kachel unten 6 px statt 0). |
| A2 Zusage/Absage | Zwischen Trennlinie und Kartenende mittig: unten 14 px wie oben. |
| A3 Kasse-Segment | Zähler bei „Gemeldet“ nicht mehr gequetscht: Segmente nach Inhalt (flex 1 1 auto, 10 px Innenrand), Zähler 22 px breit mit 6 px Abstand. Unter 360 px 4 px Innenrand (Mindestbreite der Gerätematrix). Zeile „1 von 5 · Alle bestätigen“ oben und unten je 12 px. Die Zone von „Alle bestätigen“ reicht oben und unten je 6 px (halbe Lücke), siehe Abschnitt 4. |
| A4 Konto › Mannschaft | Zeilen mit gleichem Innenabstand oben und unten (10/10, Mindesthöhe 60). |
| A5 Strafe verhängen | Fuß deckend, fest am Blattende außerhalb des Scrollbereichs, mit Safe Area. |
| A6 Einstellungen | Zeilentitel auf `--fs-zeile` 16/700 wie in der übrigen App. |
| A7 Scroll-Sperre | Global: eine Sperre, die sich nach den offenen Ebenen richtet (MutationObserver auf body). Alle Blätter, Dialoge und Seiten zählen, auch iOS (position fixed mit Rücksprung). |
| A8 Zeilenmuster | Kasse und Konto › Mannschaft teilen ein Muster: Name mit Auslassungspunkten, Betrag in fester rechter Spalte (mind. 76 px, tabellarische Ziffern). Geprüft bei 320 px und 130 % in der Gerätematrix. |

### Teil B (pixelgenau bei 390 px)

| Punkt | Commit | Umsetzung |
|---|---|---|
| D1 Kachel Mannschaftskasse | 2dbd51a | Für alle Rollen mit gleichem Inhalt; führt zu Konto › Mannschaft. |
| D2 Termin-Menü | 2d59231 | Popover statt Blatt; alle bisherigen Einträge bleiben, die zerstörenden stehen im roten Block unter dem Trennband. |
| D3 Strafe hinzufügen/bearbeiten | 305360c | Blatt mit Feldmuster (Label 12/700, Feld 46, Abstand 14), Segment Festbetrag/Staffel, bei Staffel je, Einheit und max darunter. |
| D4 Mein Status | 8f30d4b | Raster mit vier Knöpfen, gewählter Status farbig mit Haken; Blatt „Voraussichtlich bis“. |
| D5 Kennzahl Offen | a535735 | Nur die zwei Kacheln in Konto › Mannschaft (weiß, mit Anzahl); keine Kennzahlen in der Kassenansicht. |
| D6 Fuß Rückmeldungen | f3e67d6 | Kader-Zeile (fit · verletzt · Urlaub), „Übersicht teilen | Push senden“, Bestätigungsdialog. |
| E1 (D7) Aufstellung Mehr | cf0d0a7 | Blatt „Aufstellung“ mit dem bestehenden Formationseditor im Kopf der Vorlagen-Gruppe; kein neues Favoritenkonzept, kein Backend. |
| E2 (D8) Bank-Blatt | 1304710 | „Auf dem Platz“, verletzt und Urlaub ausgeblendet; Angeschlagene wählbar mit Pille in `--amber-050` und Text in `--gold-ink-2`; Fußzeile zählt alle ausgeblendeten Gruppen; Kopf mit „Fertig“. |
| E3 (D9) Strafe Bezahlt | 7c49976 | Blatt mit Zeitleiste aus fine_status_log; „Buchung rückgängig“ über die neue RPC (C5). |

### Teil C (Funktion)

| Punkt | Commit | Umsetzung |
|---|---|---|
| C1 Mein Status | 5d63d15 | Gewählter Status farbig; Datum und Notiz über `set_player_status` (0031) in einem Aufruf. Fit setzt direkt und leert beides. |
| C2 Push senden | 6abf65a | Über P1 (`send_rsvp_reminder`, 0050). Empfänger ohne Zu- oder Absage, nicht verletzt oder im Urlaub. Bestätigung mit Anzahl, danach „An N gesendet“. Sperre 12 Stunden, letzter Versand sichtbar. Text aus Push-Texte. „Rückmeldung teilen“ entfällt, „Übersicht teilen“ bleibt. |
| C3 Kader erreichbar | 0869e69 | Aus dem Rückmeldungen-Blatt und von der Terminkarte des Trainers. Die Kachel „Kader · N fit“ lief vorher ins Leere. |
| C4 Status abgelaufen | 54c823f | Siehe Abschnitt 3, Migration 0059. |
| C5 Backend für E | 4932cb6 | Migration 0060 `undo_fine_payment`. E1 und E2 brauchen kein Backend. |

Nach dem Teillauf der Gerätematrix kam ein Abschluss-Commit dazu (Build P,
Abschnitt 4).

## 2. Tokens

- **Neu:**
  - `--ov-soft: rgba(10,44,33,.18)`;
  - `--shadow-pop` für das Popover.
- `--ov-soft` gilt für alle Blätter und Dialoge (`.more-backdrop, .modal-ov,
  .lu-scrim, .tv-scrim, .ks-seite-ov, .kat-blatt-hg`). Die Blattkanten heben
  sich weiter über Fläche, Radius 18 und `--shadow-sheet` ab; geprüft in den
  Vergleichsbildern 04, 08, 15, 16 und D3/D4/E1 bis E3.
- Wo `_ds` der Vorlage vom Repo abweicht (Stand September), gilt das Repo.
- `--gold-600` und `--gold-050` sind nicht nachgebaut. Für Gold-Text gilt
  `--gold-ink`/`--gold-ink-2`, für Gold-Flächen `--gold-badge-bg`.
- Token-Block in `styles.css` Zeile 5 bis 195 (build.sh TOKEN_LAST=195).

## 3. Migrationen

### 0059 status_abgelaufen (C4)

- **Kategorie und Vorlage:**
  - Kategorie `status_abgelaufen`, Vorlage „📋 {kopf}“ / „{detail} Der
    Status ist noch gesetzt, bitte im Kader prüfen.“;
  - Deep Link `#ansicht=kader`, normal dringlich, 24 h gültig;
  - unter Push-Texte änderbar.
- **Empfänger:** alle mit der Rolle Trainer. Der Admin bekommt sie nur mit
  Trainerrolle (`kategorie_erlaubt`). Live gibt es zurzeit **kein Konto mit
  Trainerrolle**, die Mitteilung geht also erst an jemanden, sobald jemand
  die Rolle hat.
- **Zeitpunkt:** Cron `notify-status-ablauf` läuft stündlich. Die Mitteilung
  entsteht ab 9:00 Uhr Berliner Zeit für jeden Spieler mit Status ungleich
  fit und „voraussichtlich bis“ = gestern. Das gilt für verletzt, Urlaub und
  angeschlagen. Fällt der 9-Uhr-Lauf aus, holt ihn der nächste nach.
- **Bündeln:** eine Mitteilung je Trainer und Tag (Dedup
  `status_abgelaufen:<Profil>:<Datum>`):
  - ein Spieler: „Max Muster wieder verfügbar“ / „Verletzt, voraussichtlich
    bis 08.10. Der Status ist noch gesetzt, bitte im Kader prüfen.“;
  - mehrere Spieler: „2 Spieler wieder verfügbar: A, B“ / „Voraussichtlich
    bis 08.10.: A (verletzt), B (Urlaub). …“.
- **Grenzen:**
  - nur Abläufe ab dem 09.10.2026, nichts rückwirkend;
  - der Status selbst bleibt unverändert;
  - Ruhezeiten hält `notification_due` ein.
- **Schalter:**
  - Spalte `notification_prefs.status_abgelaufen`, Standard an;
  - in `notification_due` und `set_notification_prefs`;
  - in der App unter Mitteilungen › Für Trainer: „Status abgelaufen“.
- **Prüfungen:**
  - Prüfskript `supabase/checks/0059_status_abgelaufen_pruef.sql`: 25/25;
  - `0056_konsistenz_pruef.sql` auf 15 Kategorien nachgezogen: 21/21;
  - Emoji-Tabelle in `conventions.md`: 📋 = Übersicht, Trainer soll
    nachsehen.
- **Hinweis zur Textlänge:** Bei mehreren Spielern mit langen Namen kann der
  Titel über 40 Zeichen gehen. Der Sperrbildschirm kürzt dann, der volle Text
  steht in der App.

### 0060 undo_fine_payment (C5, für E3)

- **Wer und was:** nur Kassenwart oder Admin, nur für eine bestätigte
  Strafe.
- **Ergebnis:** Die Strafe steht wieder auf offen; Zahlart, bezahlt am und
  bezahlt von sind leer.
- **Verlauf:** Der Schritt steht im Verlauf (`fine_status_log`) mit der
  vorherigen Zahlart und dem Grund „Buchung rückgängig“. In der Zeitleiste
  heißt er „Zurückgenommen · wieder offen, vorher Überweisung“.
- **Keine Mitteilung** an den Spieler.
- **Vorher:** Ein direktes Update ließ die Zahlart stehen.
- **Prüfungen:**
  - Prüfskript `supabase/checks/0060_buchung_pruef.sql`: 12/12;
  - `0050_nachfrage_pruef.sql` zählt jetzt 29 Funktionen für authenticated.

Alle Prüfskripte von 0042 bis 0060 laufen grün.

## 4. Gerätematrix (Teillauf)

Lauf über alle betroffenen und neuen Zustände: 28 Schlüssel, je Rolle, wo
erreichbar. Breiten 320 bis 430, Schrift 100 und 130 %, Chromium mit Inter,
Chromium mit Roboto und WebKit mit Inter.

| Lauf | Ordner | Einzelbefunde außerhalb der Ausnahmen |
|---|---|---|
| 1 (Build O) | `geraetematrix/nachschliff-2026-10/` | 797 in 3 Gruppen |
| 2 (Korrekturen, mit den zwei neuen Zuständen) | `…-r2/` | 768 in 1 Gruppe |
| 3 (nur Termin-Menü) | `…-r3/` | 0 |
| **Schluss (Build P)** | `…-final/` | **0** |
| Push-Texte nach der letzten CSS-Änderung | `…-final-pushtexte/` | 0 |

Ausnahmen: nur `zone-alle-bestaetigen` (156 Fundstellen).

**Behoben (Korrektur-Commit, Build P):**

1. **Termin-Menü (D2), „zu klein unten“ bei jeder Zeile.**
   - Die Zeilen sind 44 px hoch. Das Popover lag auf krummen Positionen
     (z. B. y = 226,19), dazu kommt DPR 2,625. Der Treffertest rundet den
     unteren Rand der Zeile auf die 1-px-Linie bzw. das Band darunter.
   - Jetzt rundet das Popover seine Lage auf ganze Pixel, und die Fläche
     jeder Zeile reicht unsichtbar 1 px über die Linie.
   - Keine sichtbare Änderung; D2 bleibt grün.
2. **Kasse-Segment, nur mit Roboto.**
   - Die Zone von „Alle bestätigen“ reichte oben bis auf 0,5 px an die Zone
     des Segments heran. Je nach Schriftmaß deckte sie den unteren Prüfpunkt
     des Segments zu.
   - Jetzt reicht sie oben wie unten je 6 px (halbe Lücke, A3 „oben und unten
     gleich“).
   - Die Ausnahme `zone-alle-bestaetigen` nennt deshalb oben und unten.
3. **Push-Texte bei 320 px und 130 %.**
   - „Erinnerung vor Meldeschluss“ lief in die Marke „zeitkritisch“. Ursache
     sind die Zeilentitel in 16/700 seit A6: „Meldeschluss“ ist breiter als
     die Spalte.
   - Jetzt behält der Titel seine Mindestbreite, und die Marke kürzt erst bei
     Platzmangel mit Auslassungspunkten.
   - Bei 390 px ist das Bild pixelgleich, die Referenz E 25 ist mit Grund
     erneuert.

**Neu in der Landkarte und damit in der Matrix:**
- `trainer/spiel+tvSheetKader#bank` (Bank-Blatt);
- `kasse+ksBl#detail` (Strafe mit Verlauf).
Vorher liefen beide unter dem Schlüssel des Kader- bzw. Buchen-Blatts und
wurden nicht eigens geprüft. Beide haben 0 Befunde.

Ein voller Nachtlauf über alle Zustände steht aus und läuft nur auf deinen
Befehl.

## 5. Referenzen bei 390 px

Neue oder geänderte Nachschliff-Referenzen liegen in
`.design-sync/concepts/final-2026-10/soll-nachschliff/` (je `.png` und
`.json`, Grund in `REFERENZEN.json`).

| Referenz | Grund |
|---|---|
| 01 Übersicht | D4 Mein Status, gewählter Status farbig mit Haken |
| 04 Rückmeldungen | D6 Fuß des Rückmeldungen-Blatts |
| 08 Bank-Blatt | E2 nur Wählbare, Kopf mit Platzmarken und Fertig, Fußzeile Ausgeblendet |
| 11 Konto Ich | A1 Kontokachel unten 6 px |
| 12 Konto Mannschaft | D5 Kennzahlen; A4/A8 Zeilenmuster |
| 13 Kasse Gemeldet | **A3** Segment und Zähler, Zeile „1 von 2 · Alle bestätigen“ 12/12; A8 |
| 14 Kasse Offen | **A3** Segment; A8 Zeilenmuster |
| 15 Buchen | A8 Zeilenmuster im Blatt |
| 16 Strafe verhängen | A5 Fuß am Blattende |
| 18 Einstellungen | **A6** Zeilentitel 16/700 |
| 19 Mitteilungen | **A6** |
| E 23 Ruhezeiten | **A6** |
| E 24 Spielplan BFV | **A6** |
| E 25 Push-Texte | **A6**, dazu C4: Eintrag „Status abgelaufen“ unter Für Trainer |
| E 27 Diagnose | **A6** |

Die übrigen 12 Screens messen weiter gegen die Final-Vorlage mit ihren
bisherigen Ausnahmen. Die Bauteile aus Teil B misst zusätzlich `nsmess.mjs`
gegen die Nachschliff-Vorlage. Ausgabe in
`.design-sync/nachschliff-2026-10/{soll,ist,vergleich}/` (nicht versioniert).

## 6. Ist-Screenshots

Die Ausgangslage sind die iPhone-Screenshots **IMG_0688 bis IMG_0700**
(`.design-sync/concepts/IMG_0688.PNG` bis `IMG_0700.PNG`, Kopien in
`soll/ist/`). Sie sind wie vereinbart nicht im Repo (`.gitignore`).

## 7. Landkarte, Pflichtliste

- **Neue Zustände in der Landkarte:**
  - `dashboard+statusFenster`, `profil+statusFenster`,
    `einstellungen/profil+statusFenster` (D4);
  - `trainer/spiel+tvSheetKader#bank` (E2, Bank-Blatt als eigener Zustand);
  - `kasse+ksBl#detail` (E3, Strafe mit Verlauf);
  - neue Kanten zum Kader (C3, `rs-kader`).
- **Pflichtliste:** 22 Skripte. Neu sind `statuspruef` (C1) und `rspushpruef`
  (C2/C3); `prefspruef` und `kassepruef` sind erweitert.

## 8. iPhone-Testliste

Mit dem eigenen Konto, ohne Pushs an Spieler.

1. **Übersicht, Mein Status:**
   - Angeschlagen wählen, im Blatt ein Datum und eine Notiz eintragen,
     speichern. Die Zeile zeigt „Voraussichtlich bis …“ und die Notiz.
   - „Ändern“ öffnet das Blatt mit den gespeicherten Werten.
   - Fit setzt sofort zurück.
2. **Scroll-Sperre:** Bei offenem Blatt (Status, Rückmeldungen, Strafe
   verhängen, Bank-Blatt) lässt sich die Seite dahinter nicht bewegen. Nach
   dem Schließen steht sie an derselben Stelle.
3. **Terminkarte:**
   - ⋯ öffnet das Popover am Knopf; Tippen daneben schließt es.
   - „Termin löschen“ steht rot unter dem Band.
4. **Rückmeldungen-Blatt:**
   - Die Kader-Zeile öffnet den Kader.
   - „Push senden“ nennt die Anzahl. Nur testen, wenn kein Spieler offen
     ist, oder abbrechen.
5. **Kachel „Kader · N fit“ auf der Terminkarte** öffnet den Kader.
6. **Konto › Mannschaft:**
   - Kacheln Offen und In der Kasse.
   - Lange Namen enden mit „…“, die Beträge stehen bündig rechts.
7. **Kasse:**
   - Segment „Gemeldet 2“ ist nicht gequetscht.
   - „Alle bestätigen“ lässt sich treffen, ohne dass das Segment reagiert.
8. **Strafe verhängen:** Der Fuß steht deckend am Blattende über der
   Home-Leiste, auch mit offener Tastatur.
9. **Kasse › Bezahlt › Strafe antippen:**
   - Die Zeitleiste ist sichtbar.
   - „Buchung rückgängig“ an einer eigenen Teststrafe: danach offen, im
     Verlauf „Zurückgenommen · wieder offen, vorher …“.
10. **Katalog:** Strafe hinzufügen mit Staffel zeigt je, Einheit und max unter
    dem Segment.
11. **Aufstellung:**
    - ⋯ öffnet „Aufstellung“ mit dem Formationseditor oben.
    - Bank-Blatt: verletzt und Urlaub fehlen, Angeschlagene haben eine
      Pille, „Fertig“ schließt.
12. **Einstellungen:**
    - Zeilentitel 16/700.
    - Mitteilungen › Für Trainer zeigt „Status abgelaufen“ (nur mit
      Trainerrolle).
    - Push-Texte zeigt den Eintrag.
13. **C4 live:** Einem Testspieler „verletzt, voraussichtlich bis heute“
    geben. Am nächsten Morgen um 9 Uhr kommt die Mitteilung, sofern das
    eigene Konto die Trainerrolle hat. Der Tipp öffnet den Kader. Danach den
    Status zurücksetzen.

## 9. Commits

| Commit | Inhalt | Build |
|---|---|---|
| f7a2065 | Teil A: Abstände, Spielerlisten, Scroll-Sperre | 2026-10-09-A |
| 2dbd51a | D1 Kachel Mannschaftskasse | B |
| 2d59231 | D2 Termin-Menü als Popover | C |
| 305360c | D3 Blatt Strafe bearbeiten/hinzufügen, leichte Abdunklung | D |
| 8f30d4b | D4 Mein Status mit Blatt | E |
| a535735 | D5 Kennzahlen | F |
| f3e67d6 | D6 Fuß Rückmeldungen, Push-Dialog | G |
| cf0d0a7 | E1 Blatt Mehr der Aufstellung | H |
| 1304710 | E2 Bank-Blatt | I |
| 7c49976 | E3 Blatt Strafe mit Zeitleiste | J |
| 5d63d15 | C1 Mein Status speichert Datum und Notiz | K |
| 6abf65a | C2 Push senden über P1 | L |
| 0869e69 | C3 Kader erreichbar | M |
| 54c823f | C4 Status abgelaufen (Migration 0059) | N |
| 4932cb6 | C5 Buchung zurücknehmen (Migration 0060) | O |
| (dieser) | Abschluss: Gerätematrix-Korrekturen, neue Zustände, Bericht | P |
