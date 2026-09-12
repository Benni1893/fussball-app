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
  `styles.css` heraus (aktuell Zeilen 5–161, in `config.json` als
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
