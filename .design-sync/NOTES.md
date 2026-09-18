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
  `styles.css` heraus (aktuell Zeilen 5–162, in `config.json` als
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

- **Erledigt in Paket 14 (18.09.2026): tote Tokens und Klassen sind raus.**
  Gestrichen wurden die fuenf Tokens `--spiel-heim`, `--spiel-ausw`,
  `--fs-event-time`, `--typ-training`, `--typ-sonstiges` sowie die Regeln
  `.kpi-rows` / `.kpi-row`, `.grid-2`, `.kpi-tap` / `.kpi-body` / `.kpi-go`,
  `.rsvp` / `.rsvp-buttons` / `.rsvp-count`, `.tag-spiel` / `.tag-training` /
  `.tag-heim` / `.tag-ausw`, `.amt-sub`, `.em-ico`, `.toolbar`, `.btn-sm` und
  der tote Selektor `.tv-gcard` in zwei Sammelregeln. Belegt ist die Streichung
  ueber `class="…"`-Vorkommen in app.js und index.html; die dynamisch gesetzten
  `.cd-*`-Klassen blieben deshalb stehen. Tokenblock jetzt Zeile 5-165,
  134 Tokens; build.sh, config.json und conventions.md nachgezogen.

- **Echte App-Klassen ohne CSS-Regel.** Neben `.sim-text` (index.html) betrifft
  das `.mb-top`, `.mb-state`, `.ks-pane`, `.kat-in-name` und `.kat-type` aus
  app.js — die ersten drei erben ihre Darstellung vom Elternelement, die
  letzten beiden dienen nur als JS-Selektor. Alle sechs stehen in `validate.sh`
  als `BEKANNT_UNGESTYLT`, damit die Karten das Markup der App zeigen duerfen.


## Stand der Prüfung (Paket 14, 18.09.2026)

Alle drei Skripte laufen sauber durch, und die Karten sind diesmal auch
**wirklich angesehen** worden: `.design-sync/shots/karten.mjs` lädt jede Karte
in Chrome, misst die Höhe, achtet auf waagerechten Überlauf und sammelt
Konsolenfehler; die Schnappschüsse liegen unter
`.design-sync/reference/karten/`. Ergebnis: 24 von 24 Karten rendern sauber,
Inter wird geladen, keine Karte läuft über die Breite hinaus, keine
Konsolenfehler.

Damit sind die beiden alten Vorbehalte erledigt: die feste Kopfzeile bleibt
dank `transform: translateZ(0)` im Kartenrahmen, und die Terminkarte zeigt in
der schmalen Vorschau dasselbe Bild wie die App.

## Kartensatz (24)

- **Grundlagen** (3): Farben, Typografie, Flächen und Maße
- **App-Rahmen** (4): Kopfzeile, Navigation, Anmeldung, Blätter und Dialoge
- **Bausteine** (7): Schaltflächen, Chips und Filter, Plaketten und Marken,
  Kennzahl-Kacheln, Formular, Listen und Tabelle, Leerzustand
- **Ansichten** (10): Übersicht, Kalender, Trainer-Spielauswahl, Platzansicht,
  Rückmeldungen-Blatt, Konto, Kasse, Katalog, Kader und Status,
  Einstellungen und Profil

Die Gruppe **Ansichten** ist neu: sie zeigt ganze Seiten bei 390px Breite, weil
die Vorlagen seit dem Umbau auf Bildschirmebene gemessen werden und ein
Einzelbaustein die Abstände zwischen den Blöcken nicht mehr erklärt.
`Bausteine/Terminkarte` und `Bausteine/Tabelle` sind entfallen — ihr Inhalt
steht jetzt in `Ansichten/Kalender` bzw. `Bausteine/Listen-und-Tabelle`.


## Vorlage trainer-kacheln-v2.png (18.09.2026)

Nur die beiden obersten Kacheln der Trainer-Ansicht. Bild 364×387, Karte 322
Bildpunkte = 358 CSS-px (Maßstab 0,898). Gemessen mit
`.design-sync/shots/bild.mjs`; gegengemessen mit
`.design-sync/shots/kachelpruef.mjs`, das beide Kacheln in einem Gerüst mit dem
echten `styles.css` rendert und die Kastenmaße ausliest — **ohne Anmeldung**,
weil kein Testkonto zur Verfügung stand. Die laufende App ist damit in diesem
Durchgang nicht gemessen worden.

Ergebnis: Karte „Nächstes Spiel" 358×260 (Vorlage 260,6), Haarlinien bei 112
und 183 (112,5 / 181,5), Knopf bei 197 (197,1). Kaderkarte 358×130 (129,2),
Balken bei 52 (51,2). Alle Bausteine innerhalb von 1,5 CSS-px.

**Bewusste Abweichungen**

- **Die Zahl „4 OFFEN" trägt `--amber-700` (#a3680c), nicht den gemessenen
  `--amber-600` (#b9770e).** Der hellere Ton erreicht auf Weiß nur 3,7:1 und
  reißt damit die 4,5:1-Regel; der dunklere kommt auf 4,6:1. Im Balken und in
  den Legendenpunkten bleibt `--amber-600` — dort gilt die Textregel nicht.
  Das Token ist mit dieser Änderung neu dazugekommen (jetzt 135 Tokens,
  Tokenblock Zeile 5-166).
- **Urlaub ist in Balken und Legende grau (`--dot-off`), nicht blau.** So zeigt
  es die Vorlage. Die Statuschips und die Marke am Namen bleiben blau
  (`--blau-700`) — innerhalb der Kacheln ist der Ton damit ein anderer als im
  Kader. Bewusst so gelassen, weil gemessen.
- **Rückmeldebalken und „N/11 gesetzt" entfallen.** Die drei Kennzahlspalten
  ersetzen den Balken; der Aufstellungsstand steht weiter als Plakette
  „Elf steht" / „offen" in der Spielliste darunter (Entscheidung des Nutzers
  vom 18.09.2026).
- **Die ganze Kaderkarte bleibt antippbar**, nicht nur der Chevron. Die Vorlage
  sagt dazu nichts; eine 358×130 große Fläche als Ziel ist verlässlicher als
  ein 6px breites Zeichen, und die 44px-Regel ist damit ohne Trickserei erfüllt.

**Namenskollision beim Bauen:** `.tv-kl` gab es schon für die Spielerliste im
Kader-Blatt (`app.js`, `tvKaderPanel`). Die Legendenzeile heißt deshalb
`.tv-kstat`. Aufgefallen ist es nur, weil die Zeile im Gerüst dreizeilig
umbrach — ohne Sichtprüfung wäre es durchgerutscht.

**Nachtrag 18.09.2026 — Urlaub ist überall grau, Bernstein als Text dunkler**

Der graue Ton aus der Kaderkachel gilt jetzt für Urlaub in der ganzen App
(Entscheidung des Nutzers). Geändert wurden `.st-choice.is-on.st-urlaub`
(Verlauf `--grad-urlaub`, jetzt `--muted` → `#55635c` mit weißer Schrift,
4,9:1 bis 6,3:1), die Marke am Namen (`.st-blue` heißt jetzt **`.st-grau`**,
`--dot-off` mit `--ink`, 10,7:1) sowie `.lu-ptag.url`, `.tv-tag.url` und
`.tv-pchip.s-url`. Die vier Tokens `--blau-700`, `--blau-600`, `--blau-050`
und `--blau-line` sind damit tot und entfernt — 131 Tokens, Tokenblock
Zeile 5-162.

Die Zahl in der gewählten Kachel des Rückmeldungen-Blatts trägt jetzt
`--gold-ink` statt `--amber-600`: auf `--amber-050` kommt `--amber-600` nur
auf 3,4:1 und selbst `--amber-700` nur auf 4,2:1, `--gold-ink` dagegen auf
5,8:1. Damit gilt die alte Regel wieder ausnahmslos — Schrift auf Goldflächen
immer `--gold-ink` oder `--gold-ink-2`. `--amber-700` bleibt für Text auf
Weiß (die Zahl „OFFEN" in der Spielkarte, 4,6:1).

**Noch offen, nicht angefasst:** die gefüllten Statuschips `.st-angeschlagen`
(weiß auf `--grad-edge-gold`, 1,7:1 bis 2,6:1) und `.st-verletzt` (weiß auf
`--grad-edge-red`, 4,0:1 am oberen Ende) reißen die 4,5:1-Regel. Beide stammen
aus der 2a-Vorlage und waren nicht Teil dieses Auftrags.

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
