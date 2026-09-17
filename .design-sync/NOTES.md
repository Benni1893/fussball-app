# design-sync — Notizen zu diesem Repo

Projekt: **FC Fasanerie-Nord App** · `7e48a82b-b7ba-40ea-9e6b-30040a24c0d8`
https://claude.ai/design/p/7e48a82b-b7ba-40ea-9e6b-30040a24c0d8

## Warum hier nichts vom Konverter läuft

Die App ist eine reine Vanilla-JS-PWA: kein `package.json`, kein Lockfile, kein
Build, kein React, kein Storybook. Das Markup entsteht imperativ per `innerHTML`
in `app.js`. Der mitgelieferte design-sync-Konverter setzt eine kompilierte
Komponentenbibliothek voraus und ist damit **nicht anwendbar** — er wurde in
diesem Repo nie ausgeführt und `package-validate.mjs` gibt es hier nicht.

Stattdessen: **CSS-only-Design-System**, deterministisch gebaut aus `styles.css`
und `index.html`. Ein React-Wrapper wurde bewusst *nicht* geschrieben — das wäre
eine Nachbildung des Markups gewesen, die neben `app.js` hätte gepflegt werden
müssen. Diese Entscheidung hat der Nutzer am 09.09.2026 so getroffen.

## Ablauf eines erneuten Syncs

```sh
bash .design-sync/build.sh              # baut ds-bundle/ neu
bash .design-sync/validate.sh           # Klassen, Tokens, @import-Kette, Pfade
bash .design-sync/check-conventions.sh  # jeden Namen aus conventions.md prüfen
```

Alle drei müssen sauber durchlaufen, dann hochladen. `ds-bundle/_ds_sync.json`
hält die Hashes von `styles.css`, `index.html`, `conventions.md` und jeder Karte —
Version im Projekt dagegenhalten, dann ist sofort klar, was sich geändert hat.

`ds-bundle/` ist Bauergebnis und steht in `.gitignore`. Durabel sind nur die
Dateien unter `.design-sync/`.

## Risiken beim nächsten Lauf

- **Zeilennummern des Tokenblocks.** `build.sh` schneidet `:root` aus
  `styles.css` heraus (aktuell Zeilen 5–168, in `config.json` als
  `tokenBlockLines`). Verschiebt sich der Block, **bricht der Bau mit klarer
  Meldung ab** statt falsch zu schneiden — dann nur die beiden Zahlen in
  `build.sh` und `config.json` nachziehen.
- **Neue Klassenfamilien.** Wächst `styles.css` um einen Bereich, den keine Karte
  zeigt, merkt das kein Skript. Die Abschnittskommentare in `styles.css`
  (`/* ---------- … ---------- */`) sind die Liste, gegen die man prüft. Noch
  nicht als Karte abgebildet: Aufstellungs-Builder (`.pl-chip`, Trainerseite v2),
  Kasse V2, Diagramme, Pull-to-Refresh, PayPal-Button.
- **Inter kommt vom Google-CDN** (`fonts/inter.css`, per `@import`). Blockiert die
  Vorschau-Umgebung externe Stylesheets, greift lautlos der System-Stack aus der
  `body`-Regel. Sieht dann nur leicht anders aus, ist kein Fehler.

## Befunde im Repo (nicht behoben, nur notiert)

- **Spielzeile der Platzansicht bleibt hell.** Vorlage 2c und der Screenshot
  zeichnen die Zeile mit Gegner, Datum und Formation im dunkelgruenen Verlauf.
  Dort gibt es keine App-Kopfzeile; in der App ist die feste Kopfzeile mit Logo
  und Zahnrad ein Fixpunkt. Beide gruen waeren zwei gleiche Leisten
  uebereinander. Entscheidung vom 13.09.2026: die Spielzeile bleibt hell mit
  grauer Trennlinie. Die Masse der Vorlage gelten weiter - 14px oben und unten,
  16px seitlich, 12px Luecke, 24px-Symbole mit 44px-Trefferflaeche, Titel 15px
  mit 1,2 Zeilenhoehe, Unterzeile 11,5px.

- **Tote Tokens nach der Vorlagen-Umstellung (fuer Paket 14).** Weder styles.css
  noch app.js benutzen noch `--spiel-heim`, `--spiel-ausw`, `--fs-event-time`,
  `--typ-training` oder `--typ-sonstiges`; sie haengen nur noch an Karten unter
  `.design-sync/cards/`. Erst Karten neu zeichnen, dann die fuenf streichen und
  die Tokenblock-Zeilen in build.sh/config.json/NOTES.md/conventions.md nachziehen.

- **Tote Klassen nach der Vorlagen-Umstellung (fuer Paket 14).** Die Uebersicht
  nutzt seit Commit 2 weder `.kpi-rows`/`.kpi-row` noch `.grid-2` noch die
  Kachelvariante `.kpi-tap`/`.kpi-go`/`.kpi-body`. Die letzten drei sind noch in
  einer Karte unter `.design-sync/cards/` referenziert - `validate.sh` bricht ab,
  wenn man sie vorher entfernt. Also erst die Karten in Paket 14 neu zeichnen,
  dann alle sechs Familien streichen.

- **`.btn-danger` ist zweimal definiert** — Zeile ~459 (roter Text auf weiß,
  `margin-left: 6px`) und Zeile ~500 (roter Text auf `--red-050`, randlos, 700).
  Die zweite gewinnt; die erste ist toter Code bis auf das `margin-left`, das
  jeden `.btn-danger` einrückt. Wer aufräumt: Karte „Buttons" zeigt den Ist-Zustand.
- **`.sim-text`** steht in `index.html:251`, hat aber nirgends eine CSS-Regel; die
  Darstellung erbt von `.sim-bar`. In den Karten bewusst so belassen, damit das
  Markup dem der App entspricht — in `validate.sh` als `BEKANNT_UNGESTYLT` geführt.

## Was in diesem Lauf NICHT geprüft wurde

Eine **visuelle Kontrolle der Karten im Browser** war nicht möglich — die
Chrome-Erweiterung wurde für diese Sitzung abgelehnt. Geprüft ist mechanisch:
jede verwendete Klasse und jedes Token existieren, die `@import`-Kette und alle
relativen Verweise lösen auf. Nicht geprüft ist, wie die Karten *aussehen*.
Beim nächsten Lauf mit Browser lohnt ein Blick auf:

- **Kopfzeile und Navigation**: beide sind `position: fixed`; die Karten halten
  sie mit `transform: translateZ(0)` am Kartenrahmen fest. Sitzt das nicht, kleben
  die Leisten am Rand der Vorschau.
- **Terminkarte**: unter 640px klappt `.rsvp` in eine eigene Zeile um. In einer
  schmalen Vorschaukarte ist das der Normalfall, nicht der Fehlerfall.

## Vorlage trainer-sheet-v2.png (17.09.2026)

Zwei Screens aus `.design-sync/reference/trainer-sheet-v2.png`, Maßstab des
Bildes 0,9 (Rahmen 351 Bildpunkte = 390 CSS-px). Gemessen wurde mit
`.design-sync/shots/bild.mjs` (Farbabtastung und Bandanalyse im Bild),
`rects.mjs` (Kastenmaße im laufenden Arbeitsstand) und `vergleich.mjs`
(Bandlagen Vorlage gegen App, beide auf denselben Maßstab gerechnet, damit die
Kantenglättung gleich breit ausfällt). Die Messauflösung liegt bei **1,1 CSS-px**
= ein Bildpunkt der Vorlage; Abweichungen unter diesem Wert sind nicht belegbar.

**Bewusste Abweichungen, Trainer-Ansicht**

- Der **Papierkorb in der Vorlagenzeile bleibt**. Die Vorlage zeigt an dieser
  Stelle nur die Formationsplakette; ohne Papierkorb wäre keine Vorlage mehr
  löschbar (Gate K1 verlangt den Kreis aus Speichern, Anwenden, Löschen).
- **„Neu ›" führt in die Platzansicht des nächsten Spiels.** Die Vorlage zeigt
  den Verweis, sagt aber nicht, wohin er führt. Eine Vorlage entsteht nur aus
  einer offenen Aufstellung, also ist das der einzige Ort, an dem der Verweis
  etwas bewirken kann. Ohne anstehendes Spiel entfällt er.
- **Titel 25 px und Unterzeile 14 px gelten nur in der Trainer-Ansicht**
  (`.tv-head`). Die Vorlage zeigt die übrigen Ansichten nicht; deren Kopfzeile
  bleibt bei 22 px / 13 px.
- Titel „Trainer": Schriftbild 21,1 px gemessen gegen 20,0 px der Vorlage.
  1,1 px = ein Bildpunkt, nicht weiter verfolgt.

**Bewusste Abweichungen, Rückmeldungen-Blatt**

- **Die drei Kacheln sind der Filter.** Die Vorlage hebt „Offen" hervor und
  listet darunter genau die 15 offenen Spieler; der Fußknopf nennt dieselbe
  Zahl. Das Blatt geht deshalb mit „Offen" auf. Alle drei Gruppen bleiben über
  die Kacheln erreichbar.
- **Bei einer Absage steht der Grund unter dem Namen**, die Zeile wächst dann
  über 44 px hinaus. Die Vorlage zeigt einspaltige Namen ohne Zusatz; ohne
  diesen Zusatz ginge die Angabe des alten Blattes verloren.
- **„Teilen"** gibt die vollständige Übersicht als Text aus (zugesagt,
  abgesagt, offen), **„Alle N erinnern"** den Erinnerungstext an die Offenen
  (Gate S2, Weg b). Die Vorlage beschriftet beide Knöpfe, sagt aber nicht, was
  sie tun.
- **Abdunklung dahinter**: gemessen etwa `rgba(0,0,0,.41)`, im Stylesheet steht
  `rgba(20,28,22,.4)`. Unverändert gelassen — der Ton gilt für alle Blätter.
- Schließen-Kreuz: Kreis rechts bei x 338 statt gemessener 335,6 — 16 px
  Innenrand ist das Raster der ganzen App; die 2,4 px liegen im Messrauschen
  der Rahmenkante.
