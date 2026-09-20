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
  `styles.css` heraus (aktuell Zeilen 5–172, in `config.json` als
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

**Nachtrag 18.09.2026 — gefüllte Statuschips halten 4,5:1**

„angeschlagen" und „verletzt" trugen weiße Schrift auf den hellen
Kantenverläufen: 1,7:1 bzw. 4,0:1 am oberen Ende. Beide haben jetzt einen
eigenen, dunkleren Verlauf; die Farbfamilie bleibt.

- `--grad-chip-gold: --amber-700 → --gold-ink` (4,6:1 bis 6,4:1)
- `--grad-chip-red:  --red-600 → --red-700` (5,4:1 bis 7,2:1)

Warum eigene Tokens und nicht `--grad-edge-gold` / `--grad-edge-red`
abdunkeln: an diesen beiden hängen neun weitere Stellen — Kartenkanten,
Terminkarten, Kennzahlkacheln, Profilbalken —, die rein dekorativ sind und
hell bleiben sollen. Damit haben jetzt alle vier gefüllten Chips ihren
eigenen Verlauf: `--grad-chip-on` (grün), `--grad-chip-gold`,
`--grad-chip-red`, `--grad-urlaub` (grau). 133 Tokens, Tokenblock
Zeile 5-167.

Bei „angeschlagen" wäre auch dunkle Schrift auf hellem Gold denkbar gewesen.
Das scheitert am Verlauf selbst: `--gold-ink-2` kommt auf `--gold-400` auf
4,46:1 und auf `--gold-700` nur auf 2,93:1 — über die ganze Fläche hält
keine einzige Textfarbe. Der dunkle Verlauf mit weißer Schrift ist außerdem
das Muster der drei anderen Chips.

**Noch offen:** `.task-row.is-lineup .task-num` und `.task-row.is-pay
.task-num` im Aufgabenblock haben denselben Fehler (weiße Zahl auf
`--grad-edge-gold` 1,7:1 bzw. `--grad-edge-red` 4,0:1). Ein Wechsel auf die
beiden neuen Chip-Verläufe würde reichen; war nicht Teil des Auftrags.

**Nachtrag 18.09.2026 — Plaketten im Aufgabenblock und ALLE.png**

Die drei `.task-num` trugen weiße Zahlen auf den hellen Kantenverläufen und
reißen damit dieselbe Regel wie die Statuschips: `--grad-edge-gold` 1,7:1,
`--grad-edge-red` 4,0:1, `--grad-edge-green` 3,2:1 (jeweils am oberen Ende).
Alle drei laufen jetzt über die Chip-Verläufe — `--grad-chip-gold`,
`--grad-chip-red`, `--grad-chip-on` — und liegen zwischen 4,6:1 und 12,2:1.
Der Auftrag nannte nur die ersten beiden; die grüne kam beim Nachrechnen
dazu und ist dieselbe Ursache in derselben Regelgruppe.

`ALLE.png` ist neu gebaut, weiter aus den vorhandenen Aufnahmen. Zwei
Änderungen am Bauskript:

- Die Trainer-Kachel kommt aus `.design-sync/shots/geruest.mjs` — der
  Ansicht mit dem echten Stylesheet, echter Kopfzeile und Navigation, aber
  fest eingesetzten Beispieldaten. Sie trägt im Raster die Marke **GERÜST**,
  und unter dem Raster steht, was das heißt.
- Jede Kachel nennt jetzt neben den Maßen ihre **Aufnahmezeit**. Damit ist im
  Bild selbst sichtbar, welche Kacheln alt sind: die zwölf App-Aufnahmen
  stammen vom 17.09., zeigen also weder die neuen Trainer-Kacheln noch die
  seither korrigierten Kontraste im Aufgabenblock.

Sobald wieder ein Testkonto da ist: `node .design-sync/shots/app.mjs` neu
laufen lassen, den Geruest-Eintrag in `alle.mjs` auf
`trainer-spielauswahl` zurückstellen und `alle.mjs` erneut bauen.

## Vorlage termin-und-kalender-v2.png (18.09.2026)

Bild 1426×865, Karten 329 Bildpunkte breit = 358 CSS-px, Maßstab 0,919.
Gemessen mit `.design-sync/shots/bild.mjs`. **Kein Playwright gegen die App** —
es gibt weiterhin kein Testkonto; geprüft wurde über die Vorschaukarten.

Gemessen und gebaut: Kopfband 86 hoch, Datumskachel 48×61, ⋯-Kreis 38,
Innenrand 14, Bausteine im Körper 10 auseinander, Ortzeile mit 37er
Symbolkachel und ROUTE-Pille 57×23, Knöpfe 158×47 mit 14 Abstand,
Zusagen-Balken 6 hoch.

**Abweichungen aus dem Schärfe-Check**

- `--shadow-card` und `--shadow` waren `0 8px 20px -14px` — ein 20px-Nebel.
  Jetzt zweistufig: `0 0 0 1px rgba(16,40,30,.06)` als Kante plus
  `0 3px 8px -3px rgba(16,40,30,.20)`. Blur 8 statt 20, Versatz 3.
- `--bg-1`/`--bg-2` eine Stufe dunkler (`#e9ecea`/`#e0e4e2` statt
  `#eef0ef`/`#e7eae9`). Kartenweiß gegen Seitengrund steigt damit von
  1,145:1 auf 1,19:1 oben und von 1,211:1 auf 1,283:1 unten. `--bg` selbst
  bleibt, sonst würden alle Tint-Flächen mitwandern.
- `transform: scale(…)` auf `:active` ist von allen Karten und Kartenkindern
  entfernt (`.th-body`, `.ev-foot`, `.task-row`, `.tile`, `.sg-stat`,
  `.mini-ev`, `.kpi-tapbar`) und durch einen Farbwechsel ersetzt. Ein
  `transform` im Druckzustand hebt die Karte auf eine eigene Ebene und
  rastert sie neu — genau der weiche Eindruck. Geblieben sind drei
  `transform` außerhalb von Karten: Pull-to-Refresh-Animation,
  Platzmarkierung und Bankplatz.
- `backdrop-filter` steht weiterhin nur auf der Navigation.
- Alle Maße der Terminkarte sind ganzzahlig.

**Abweichungen vom Bild**

- **Meldeschluss und die Acht-Euro-Warnung** stehen unter der Knopfzeile; die
  Vorlage zeichnet sie nicht. Ohne sie fährt man in die Strafe.
- **Absage-Grund, BFV-Abweichung und die Marke „manuell geändert"** bleiben
  sichtbar im Kartenkörper, „übernehmen" als Textlink direkt in der Zeile.
- **Stift, Löschen und „Zurücksetzen auf BFV-Daten"** liegen hinter dem
  ⋯-Knopf, den die Vorlage zeigt, ohne sein Ziel zu nennen.
- **Zusage/Absage erscheint nur bei verknüpftem Konto.** Ein reiner Trainer
  ohne Spielerzuordnung sieht die Knöpfe nicht — er hätte nichts zu melden.
- **Der Ortsname darf umbrechen** statt gekürzt zu werden. Bei 390px passt
  „BSA Lerchenauer Straße" neben die ROUTE-Pille nicht in eine Zeile; ein
  abgeschnittener Ortsname hilft niemandem.
- **K7 ist überholt**: die Karte trägt die eigene Rückmeldung auch für
  Trainer, die Zeile `.th-self` im Hero entfällt (Commit 2).

**Commit 2 (Übersicht), 18.09.2026**

Hero und „Nächstes Spiel" sind jetzt dieselbe `.tk` wie im Kalender, mit
`{hero:true}`: ohne ⋯-Knopf und ohne BFV-Hinweis — Bearbeiten, Löschen und
die BFV-Pflege gehören in den Kalender, nicht auf die Übersicht.

Kein Termin steht zweimal: der nächste offene Termin ist der Hero; ist das
bereits das nächste Spiel, entfällt der Abschnitt „Nächstes Spiel"; „Danach"
lässt beide aus. Die Logik stand schon so da und blieb unverändert.

`.th-self` ist ersatzlos entfernt — die Karte trägt die eigene Rückmeldung
auch für Trainer. Damit ist K7 endgültig erledigt.

Fünf Kontextpunkte aus der Vorlage übernommen: Geldzeile mit Marke über dem
Betrag und Chevron (`.geld`), „DANACH" als kleine Marke mit „Kalender ›",
die Danach-Zeilen mit Datumskachel, Zeit und Zustandsplakette in einer Karte
(`.dn-liste`), „MEIN STATUS" im 2×2-Raster
(`.st-wahl[data-kompakt]`). Punkt 8 (Vorschau-Leiste) wie besprochen nicht —
sie bleibt fix über der Navigation, sonst vergisst man die laufende Vorschau.

**Aufgeräumt**: die Abschnitte Termin-Hero, Geldkacheln, Spieltag-Karte und
kompakte Terminzeile sind aus `styles.css` raus, ebenso der tote Rest des
Blocks Termin-Karten (`.event`, `.ev-*`, `.e-*`, `.kal-cta*`). Geblieben sind
`.event-list` als Klammer, die `.tag`-Familie, `.venue-link` und die
Paarungsauszeichnung, jetzt unter `.tk-titel`. Die Klassen `.edge-green`,
`.edge-gold` und `.edge-red` gibt es nicht mehr — die Terminkarte trägt ein
Kopfband statt einer Kante; die Tokens `--grad-edge-*` leben weiter in
Kennzahlkacheln und Profilbalken.

Kontraste aller neuen Textstellen gerechnet, niedrigster Wert 4,61:1
(`.tk-ort-a` auf `--surface-2`). Trefferflächen: `.tk-menue` 38 sichtbar mit
44er `::after`, `.tk-route` 23 mit 44er `::after`, alles andere mindestens 44.

**Feinschliff nach dem iPhone-Test, 18.09.2026**

Sechs Punkte, alle Werte aus `termin-und-kalender-v2.png` gemessen.

1. **Plakette HEIM/AUSWÄRTS deckend.** Sie trug `--grad-gold`
   (#fdf6e4 → #f6ebcd) — ein heller Verlauf auf dunklem Grund liest sich wie
   Transparenz. Gemessen ist der Grund **#eac66b**; gebaut mit `--gold-400`
   (#e3c25c) plus `--gold-700` als eigener Rand, Schrift `--green-900`:
   **7,03:1**. Kein rgba im Spiel.
2. **Abstände oben.** Gemessen: Titel-Unterkante zur Filterleiste **17,4**,
   Filterleiste zum Knopf **12,0**. Gebaut `.seg { margin: 14px 0 12px }` —
   14 statt 17,4, weil die Titel-Box rund 3 px unter der Schriftunterkante
   endet. Auf der Übersicht bekommt die erste Kachel dieselben 14 px
   (`.page-head + .tk`); das Bild zeigt die Anrede nicht, deshalb derselbe
   Rhythmus wie im Kalender.
3. **Gleiche Höhen.** Die beiden Spielerkarten im Bild sind exakt gleich hoch
   (252,4 CSS). Daraus: Kopfband **86**, Innenrand **14**, Abstand **14**,
   Ortzeile **60**, Knopfzeile **46**. Gebaut und nachgemessen: Kopfband 87,
   Ortzeile 60, Knopfzeile 46 — über alle Varianten identisch. Zusätzliche
   Höhe bringen nur der Zusagen-Block (80) und die beiden Kacheln (74).
   Ausnahme: trägt eine Karte Marken („Abgesagt", „manuell geändert"),
   wächst das Kopfband auf 95 — das ist ein Sonderzustand, kein Unterschied
   zwischen Training und Spiel.
   **Preis dafür:** Ortsname und Adresse stehen jetzt einzeilig mit
   Auslassungspunkten. Die volle Adresse steckt im `title` des Ziels, und ein
   Tipp auf die Zeile öffnet die Karten-App.
4. **„Termin hinzufügen"** trug `.btn.btn-primary`, und dessen `--grad-btn`
   (green-550 → green-650) überschrieb die Klasse weiter unten im
   Stylesheet. Die Klassen `btn btn-primary` sind aus dem Markup raus;
   `.kal-neu` ist eigenständig und trägt `--grad-chip-on` — dasselbe
   Dunkelgrün wie Kopfband, gefüllte Chips und Zusage-Knopf.
5. **Ganze Ortzeile antippbar.** Die Zeile ist jetzt selbst das `<a>` zur
   Karten-App, 60 px hoch. Die Pille „ROUTE" ist nur noch Hinweis
   (`aria-hidden`), kein eigenes Ziel mehr — zwei verschachtelte Links wären
   für VoiceOver doppelt.
6. **Balken zur Zählzeile.** Gemessen **14,2** von der Balkenunterkante zur
   Schriftoberkante. `margin-top` von 10 auf **12** — mit der halben
   Zeilenhöhe von 2,5 ergibt das 14,5.

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

**Feinkorrekturen nach dem iPhone-Test, 20.09.**

- **Kalender-Filterleiste, Ursache statt Symptom.** Die Chips wirkten
  unterschiedlich breit, weil `.seg { display: block; height: 100% }` aus dem
  Diagramm-Abschnitt den gleichnamigen Behälter der Filterleiste überschrieb
  (spätere Zeile gewinnt). Das Raster war die ganze Zeit vierspaltig, kam nur
  nie zum Tragen. Umbenannt auf `.kal-seg` / `.kal-seg-b`.
- **Chiphöhe bleibt 42 px**, nicht die am 13.09. notierten 34 px: aus
  `termin-und-kalender-v2.png` gemessen 42,4. Trefferfläche 44 über `::after`.
- **Beschriftungen unverändert.** Bei 390 ist jedes Segment 84 breit, die
  längste Beschriftung „Sonstiges" misst 65,7 — 18,3 Luft. Gekürzt wird erst,
  wenn sie umbricht; `white-space: nowrap` hält das auch bei größerer
  Systemschrift fest.
