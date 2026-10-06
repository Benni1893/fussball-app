# Delta Tokens und Bausteine

Stand 06.10.2026, nur gelesen, Commit `035d3fc`. Kein Code geändert.

Soll: `PAKET-README.md` (Abschnitte „Design-Tokens“ und „Bausteine“), die Vorlagen `referenz/Final A…E *.dc.html` und das Design-System der Vorlage `referenz/_ds/fc-fasanerie-nord-app-…/tokens/tokens.css` (134 Tokens) mit `_ds_app.css`.
Ist: `styles.css` (`:root` Zeilen 5–184, 140 Tokens), `app.js`, `index.html`, `db.js`, `.design-sync/conventions.md`, `.design-sync/cards/**`.
Zählweise: „app.js n“ heißt n wörtliche Vorkommen des Klassennamens in app.js (Wortgrenze, kein Teilstring). Ein Vorkommen in einer Schleife zählt einmal.

**Vorab, vier Befunde, die das Paket nicht erwähnt:**

1. **Blau fehlt in der App.** README nennt `--blau-700` und `--blau-050` „unverändert“. In `styles.css` gibt es aber keinen einzigen `--blau-*`-Token. Sie stehen nur in der `tokens.css` der Vorlage. Seit dem 18.09.2026 ist Urlaub in der App bewusst grau (`--grad-urlaub` = `--muted → #55635c`, styles.css:125; `.st-grau`, styles.css:2855–2857; conventions.md:93–97). Das Paket führt Blau für Urlaub wieder ein („Blau nur für Urlaub“). Das ist eine Rücknahme einer früheren Entscheidung und braucht ein ausdrückliches OK.
2. **Die `tokens.css` der Vorlage ist älter als die App.** Die Vorlagen sind gegen sie gerendert. Abweichend sind `--bg-1`, `--bg-2`, `--shadow-card`, `--shadow`, `--shadow-sm` und `--grad-urlaub`. Wer nach Bild nachbaut, misst also die alten Werte (Tabelle 1b).
3. **`--muted` neu hält 4,5:1 auf dem App-Grund der App nicht.** README rechnet 4,7:1 auf `--bg-2` mit dem Vorlagenwert `#e7eae9`. Die App hat `--bg-2: #e0e4e2` (styles.css:74, bewusst eine Stufe dunkler). Darauf kommt `#5c6a63` nur auf **4,43:1**. Das betrifft jeden `--muted`-Text direkt auf dem Seitengrund (Gruppenkopf, Hinweistexte, Segment-Spur), weil `body` den Verlauf `--grad-app` über die ganze Seitenhöhe zieht (styles.css:2895–2899). Lösungen in Abschnitt 4.
4. **`.edge-green`, `.edge-gold`, `.edge-red`, `.kasse-save` und `.set-verwaltung` gibt es nicht mehr bzw. sie sind tot.** `.edge-*` stehen weder in styles.css noch in app.js (nur noch in conventions.md der Vorlage). `.kasse-save` und `.set-verwaltung` sind in styles.css definiert, aber nirgends erzeugt. Der Randstreifen, den das Paket entfernen will, ist heute `.kpi.is-warn::before` (styles.css:403–406, 2932).

---

## 1. Tokens

### 1a. Tokens aus PAKET-README

| Token | Ist-Wert (styles.css) | Soll-Wert | Art | Fundstelle |
|---|---|---|---|---|
| `--muted` | `#66756d` | `#5c6a63` | geändert | styles.css:65. Vorlagen setzen den Wert 177-mal als Hex inline statt über den Token |
| `--muted-2` | `#5d6b63` (nur für getönte Flächen) | entfällt, geht in `--muted` auf (Abstand 1 Stufe, praktisch gleich) | Ist-Token, Vorschlag streichen | styles.css:66–68; genutzt styles.css:2537, 2555, 2565 |
| `--grad-btn` | `linear-gradient(180deg, var(--green-550) 0%, var(--green-650) 100%)` | `linear-gradient(180deg, var(--green-600) 0%, var(--green-700) 100%)` | geändert | styles.css:105. In den Vorlagen 18-mal inline ausgeschrieben |
| `--h-btn` | `46px` | `48px` | geändert | styles.css:175 |
| `--h-btn-lg` | `48px` | Alias `var(--h-btn)` | geändert | styles.css:176 |
| `--amber-ink` | fehlt | `#8a5a08` | neu | Vorlagen 12-mal inline `#8a5a08` |
| `--amber-line` | fehlt | `#ecd3a6` | neu | Vorlagen 1-mal inline |
| `--fs-betrag` | fehlt | `40px`, dazu 800 und −0,03em | neu | Ein Custom Property trägt nur einen Wert. Vorschlag: `--fs-betrag: 40px` als Größe, Gewicht und Sperrung in der Klasse (oder `font`-Kurzform als eigener Token) |
| `--fs-titel` | fehlt | `26px` / 800 / −0,02em | neu | heute `.page-head h1` 1.4rem = 21 px (styles.css:379), `.tv-head h1` 25 px (2919), Übersicht 22 px (2466) |
| `--fs-kpi` | fehlt | `21px` / 800 | neu | heute `.kpi-value` 19 px (styles.css:409, 419) |
| `--fs-zeile` | fehlt | `16px` / 700 | neu | heute 14 bis 16 je Zeilenart |
| `--fs-neben` | fehlt | `13px` / 500, Mindestgröße | neu | heute viele 11 und 12 px Nebentexte (`.kpi-sub`, `.mb-sub`, `.set-hint`, `.laz-note`, `.task-sub`, `.kat-sub`, `.tv-bn` 9 px) |
| `--fs-etikett` | fehlt | `12px` / 700 / Versal / .06em | neu | heute `.lbl`, `.kpi-label`, `.mb-label`, `.set-label`, `.ein-titel` 11 px .68px |
| `--sp-1` … `--sp-6` | fehlen | `4 8 12 16 24 32` px | neu | |
| `--green-700` | `#1b5e3f` | gleich | gleich | styles.css:18 |
| `--green-800` | `#144a37` | gleich | gleich | styles.css:17 |
| `--green-600` | `#237a52` | gleich | gleich | styles.css:19 |
| `--red-600` | `#c0392b` | gleich | gleich | styles.css:48 |
| `--red-700` | `#a5281b` | gleich | gleich | styles.css:50 |
| `--gold-ink` | `#7a5a0c` | gleich | gleich | styles.css:39 |
| `--blau-700` | **fehlt** | `#1d5a8a` | README „unverändert“, in der App **neu** | nur DS tokens.css:91 |
| `--blau-050` | **fehlt** | `#e7f0f7` | README „unverändert“, in der App **neu** | nur DS tokens.css:93 |
| `--blau-line` | **fehlt** | `#c3dbea` (Rand Urlaub-Kachel) | in der App **neu** | nur DS tokens.css:94 |
| `--blau-600` | **fehlt** | `#2e7bb5` (Vorlagen 2-mal) | in der App **neu** | nur DS tokens.css:92 |
| `--grad-urlaub` | `linear-gradient(180deg, var(--muted), #55635c)` (grau, Hex im Token) | DS: `linear-gradient(180deg, var(--blau-600), var(--blau-700))` | geändert, falls Blau freigegeben | styles.css:125 |
| `--grad-task-green/-red/-gold` | vorhanden | gleich | gleich | styles.css:136–138 |
| `--green-task-ink`, `--red-ink` | vorhanden | gleich | gleich | styles.css:89, 56 |

### 1b. Unterschiede `tokens.css` (Vorlage) zu `styles.css :root`

| Token | Ist (styles.css) | Vorlage (tokens.css) | Bewertung | Fundstelle |
|---|---|---|---|---|
| `--bg-1` | `#e9ecea` | `#eef0ef` | Ist bewusst dunkler („damit die weiße Karte eine Kante hat“). Bleibt, aber siehe Kontrast `--muted` | styles.css:72 |
| `--bg-2` | `#e0e4e2` | `#e7eae9` | wie oben; mit `--muted` neu nur 4,43:1 | styles.css:74 |
| `--shadow-card` | `0 0 0 1px rgba(16,40,30,.06), 0 3px 8px -3px rgba(16,40,30,.20)` | `0 1px 1px rgba(16,40,30,.04), 0 8px 20px -14px rgba(16,40,30,.45)` | Ist bewusst schärfer (Kommentar styles.css:141–142). Vorlagen zeigen den weichen alten Schatten | styles.css:143 |
| `--shadow` | wie `--shadow-card` Ist | wie `--shadow-card` Vorlage | dito | styles.css:159 |
| `--shadow-sm` | `… rgba(15,61,46,.10)` | `… rgba(15,61,46,.08)` | unter Messgrenze, bleibt | styles.css:158 |
| `--grad-urlaub` | grau | blau | siehe 1a | styles.css:125 |
| `--blau-700/600/050/line` | fehlen | vorhanden | siehe 1a | |
| `--amber-700` | `#a3680c` | fehlt | Ist-Token; als Text auf Weiß 4,62:1. Mit `--amber-ink` (5,92:1) doppelt. Vorschlag: Textstellen auf `--amber-ink`, `--amber-700` nur noch in `--grad-chip-gold` | styles.css:60; genutzt 112, 417, 1940 |
| `--muted-2` | `#5d6b63` | fehlt | siehe 1a, streichen | styles.css:66 |
| `--seg-bg` | `#e2e8e4` | fehlt | Ist-Token (= `--line`). Vorlage nimmt für die Segment-Spur `--bg-2`. Vorschlag: Spur bleibt `--seg-bg`, dann hält `--muted` 4,57:1 | styles.css:82 |
| `--grad-chip-gold` | `--amber-700 → --gold-ink` | fehlt | Ist-Token, trägt weiße Ziffern 4,6–6,4:1. Bleibt (siehe Aufgabenzeile) | styles.css:112 |
| `--grad-chip-red` | `--red-600 → --red-700` | fehlt | Ist-Token, 5,4–7,2:1. Bleibt (siehe Aufgabenzeile) | styles.css:113 |
| `--grad-tk-kopf` | `--green-800 → --green-900` | fehlt | Ist-Token Terminkarte. Soll-Hero nutzt `--grad-hd`-Winkel 158deg 750→900→950 | styles.css:126 |
| `--tk-menue` | `rgba(255,255,255,.14)` | fehlt | Vorlage `.12`; unter Messgrenze | styles.css:127 |
| `--bdg-venue-bg/-line/-fg` | `#3c643b` / `#75803a` / `#f6e8c2` | fehlen | Ist-Tokens Heim/Auswärts. Kandidat für die Hero-Pille (Kontrast 5,15:1 statt 3,63:1) | styles.css:133–135 |

### 1c. Hex-Werte, die in den Vorlagen inline stehen und Token werden müssen

| Hex | Anzahl | Ziel-Token | Bemerkung |
|---|---|---|---|
| `#5c6a63` | 177 | `--muted` | |
| `#fff` | 87 | `--card` bzw. bleibt `#fff` als Schrift auf Grün | |
| `#8a5a08` | 12 | `--amber-ink` (neu) | |
| `#ecd3a6` | 1 | `--amber-line` (neu) | |
| `#2a7541` | 2 | **fehlt im README.** Vorschlag `--pitch-green-2` | Spielfeldstreifen im Wechsel alle 44 px (Screen 07) |
| `linear-gradient(180deg,var(--green-600),var(--green-700))` | 18 | `--grad-btn` neu | |

Folgen im Werkzeug: `config.json` `tokenBlockLines: "5-184"` muss nach jeder Tokenänderung nachgezogen werden (build.sh:25–27 bricht sonst ab). `check-conventions.sh:25–27` prüft die Zahl „(140 Tokens)“ in conventions.md. Neu dazu kommen 2 Amber, 4 Blau, 6 Schriftstufen, 6 Abstände, 1 Spielfeld = 19; weg `--muted-2` (und ggf. `--amber-700`) ergibt **158 oder 157**.

---

## 2. Bausteine

Aufwand: S unter 1 h, M halber Tag, L mehr.

| Baustein | Ist-Klassen und Werte (styles.css:Zeile) | Soll | Zu ersetzende Alt-Klassen (Vorkommen app.js) | Aufwand |
|---|---|---|---|---|
| **Primärknopf** `.btn-primary` | drei Schichten: `.btn-primary` `--green-800` voll (875), `.btn` 46/15/600 Radius 10 (761, 2938), Endschicht `--grad-btn` + `--shadow-btn` 15/700 (2950–2958). Gesperrt heute `opacity:.5` (2638, 2748, 2313) = hellgrün | `--grad-btn` neu, `#fff` 16/700, Höhe 48, Radius 12 (`--radius-md`), `--shadow-btn`. Gesperrt Fläche `--line`, Schrift `--muted`, kein `opacity` | `.tv-next-btn` (1946; app.js 1: 3669 „Elf aufstellen“) · `.rs2-btn` (1388; app.js 1: 1120 „Alle erinnern“) · `.tv-primary` (2116; app.js 2: 3852, 3857, zweizeilig mit `<small>`) · `.auth-submit` (1713; app.js 3: 7127, 7151, 7266 als Selektor) · `.kasse-save` (2313; app.js **0**, tot) · zusätzlich nicht im README: `.kal-neu` (502; app.js 1: 1179, entfällt laut Screen 02 zugunsten „+ Termin“) · `.ks-neu` (1588; app.js 1: 5055 „Strafe verhängen“) · `.abo-btn.btn-primary` mit `--grad-chip-on` (1192; app.js 2: 965, 978) · `.tv-kall` `--green-600` flach (2178; app.js 1) · `.rs2-btn2` als Sekundär (1392; app.js 1: 1122). `.btn-primary` selbst: app.js 24 | M |
| **Sekundärknopf** `.btn-soft` | `.btn-soft` `#eef2ef` .85rem (873) und Endschicht `--grad-btn-sec` 15 px (2959); `.btn` Grundknopf ist schon `--grad-btn-sec`, `--line-soft-3` (2938–2948). Gefährlich: `.btn-danger` `--red-050`-Fläche `--red-600` (896), `.btn.set-logout` (955), `.ks-storno` (2430) | `--grad-btn-sec`, Rand 1 px `--line-soft-3`, `--ink` 16/700, 48. Gefährlich gleicher Knopf, Schrift `--red-700` | `.btn-soft` app.js 7 · `.btn-danger` 3 · `.rs2-btn2` 1 · `.tv-ghost` 1 (auf Dunkel, 2113) · Hex `#eef2ef` in 873 wird überflüssig | S |
| **Aktive Auswahl** | `.chip.is-active` `--grad-chip-on` (2971) · `.kal-seg-b.is-on` `--grad-chip-on` (498) · `.tv-fpill.on` `--grad-chip-on` (2074) · `.zart.is-on` (2733) · `.st-choice.is-on.st-fit` `--grad-chip-on` (2846), `.st-choice.is-on` Grundregel `--green-600` (1401) · `.kasse-chip.is-on` `--green-700` (2296, tot) | aktiv = `--grad-btn`, weiße Schrift (dasselbe Grün wie Primär). Inaktiv `--grad-chip`, Rand `--line-soft-2`, 14/600, Höhe 36 | Wechsel `--grad-chip-on` → `--grad-btn` an `.chip.is-active`, `.tv-fpill.on`, `.st-choice.is-on.st-fit`, `.zart.is-on` (app.js: `chip` 8, `tv-fpill` 1, `st-choice` 1, `zart` 2). `.chip` heute 13 px, Höhe 34 (2962–2969), Soll 14/600, 36 | S |
| **Segment** | `.kal-seg` Kasten weiß mit Rand, aktiv dunkelgrün (482–498) · `.ks-seg` Spur `--seg-bg`, aktiv weiß `--green-800` (2530–2545) · `.zart-row` Spur `--seg-bg`, aktiv dunkelgrün (2717–2733) | Spur `--bg-2` mit Rand `--line-soft`, Radius 12, Innenabstand 3. Aktiv weiße Pille Radius 9, `--shadow-sm`, `--green-800` 14/700; inaktiv 14/600 `--muted`. Höhe 38 | `.kal-seg`/`.kal-seg-b` (app.js 1/1: 1176) auf `.ks-seg`-Muster umstellen; `.ks-seg-b` Höhe 44 → 38, Radius 11 → 9, inaktiv `--muted-2` 700 → `--muted` 600; `.zart` 64 hoch mit Symbol bleibt eigene Form oder wird Segment Bar/PayPal (Screen 15). Neue Einsätze: Konto Ich/Mannschaft, Termin Heim/Auswärts, Einmalig/Wöchentlich | M |
| **Hinzufügen-Knopf „+“** | gibt es nicht. Nächstes: `.tv-bplus` „+“ 16/700 `--muted` im Bankplatz (2232; app.js 1: 3877). Textknopf „Setzen“ existiert in app.js nicht mehr | rund 36 × 36, Rand 1,5 px `--line-soft-3`, „+“ 20/600 `--green-800`; `::after` 44 | neu, z. B. `.add-btn`. Bank-Blatt (Zeilen mit `.tv-tag placed` „vergeben“, app.js 4210) und neues Blatt 07c | S |
| **Gruppenkopf** `.group-head` | `.section-title` 15/700 `--ink`, Satzschrift, 20 oben 8 unten (431–437) · `.sec-mini` 11/800 .08em, 20/14 (1987–1999) · `.tv-next-lbl` 11/800 .08em (1894) · `.tv-bank-h` .95rem/700 `--ink` (2214) · `.ein-titel` 11/700 .68px `--green-700` (1055) · `.ein-gkopf-t` 11/700 `--green-700` (1164) · `.set-label` 11/700 (953) · `.ks-bl-lbl` (2745) · `.abo-k-t` 11/800 `--green-800` (1186) · `.lu-kgroup h4`, `.tv-kg h4` (1847, 2182) | 12/700 Versal .06em `--muted`, 24 oben, 8 unten; rechts optional `.link-btn` 15/600 `--green-800` ohne Unterstreichung, „›“ wenn wegführend, Trefferfläche per `::after` | `.section-title` app.js **16** (614, 698, 701, 704, 707, 753, 765, 821, 1185, 1217, 1831, 2260, 2289, 3626, 3736, 5059) · davon `.sec-mini` **5** (701, 704, 707, 3626, 3736) · `.tv-next-lbl` 1 (3656) · `.set-verwaltung` **0** (tot, styles.css:956) · `.tv-bank-h` 1 (3863) · `.ein-titel` 2 · `.ein-gkopf-t` 1 · `.ks-bl-lbl` 4 · `.abo-k-t` 2. `.set-sub` (2) nutzt `.section-title` mit `<h3>`. `.kasse-verbuchen` (5059) entfällt laut Screen 13 | M |
| **Karte** | `.card` Grund `border:1px solid var(--line)`, `--shadow` (378–388), Endschicht `--line-soft`, `--shadow-card`, `--grad-card` (2927–2931). Radius 14. Viele Eigenkarten: `.krow` `--shadow-sm` (2419), `.kat-item` `--card` flach (1466), `.ein-gruppe` `--line` + `--shadow` (1060), `.pr-list` `--line` ohne Schatten (2788), `.mine-banner` `--shadow-sm` (1548, Endschicht überschreibt) | `--grad-card`, Rand 1 px `--line-soft`, Radius 14, `--shadow-card`. Keine Karte in der Karte, Unterbereiche durch 1 px `--line` | `.card` app.js 34. Abweichler angleichen: `.ein-gruppe`, `.pr-list`, `.krow`, `.kat-item`, `.ks-wahl-b`. Karte in Karte prüfen bei `.abo-karte` (1182, Rand + eigener Grund in Karte) und `.ks-bl-sum` | S |
| **Listenzeile** | uneinheitlich: `.dn-zeile` 68/15 (454), `.pr-row` 52/14 (2789), `.laz-row` 56/14 eigene Karte (2869), `.kad-row` (2863), `.ein-zeile` 48/16 500 (1066), `.rs2-zeile`, `.tv-grow` (2004), `.krow` 16/700 (2419), `.more-item` 50/15 (336). Avatar `.avatar` mit `--grad-av` (2980). Chevron `.kal-abo-chev`/`.geld-chev`/`.tv-garrow` in `--dot-off` | 52–60 hoch, Innenabstand 0 16; Avatar 36 rund `--grad-av`, Initialen 13/800 `--green-800`; Titel 16/700, Nebenzeile 13 `--muted`; rechts Wert/Marke, „›“ in `--green-chev` nur wenn wegführend; mehrere Zeilen = eine Karte mit Trennlinien. Ausnahme Katalog: eigene Kachel, Abstand 8 | gemeinsame Klasse fehlt. Vorschlag: `.row` + `.row-av` `.row-main` `.row-t` `.row-s` `.row-end` `.row-chev`. Chevron-Farbe `--dot-off` (1,56:1, styles.css:552) an `.kal-abo-chev`, `.geld-chev`, `.tv-garrow` → `--green-chev` (4,91:1). `.laz-row` von Einzelkarte auf Zeile in Karte | L |
| **Terminzeile** | `.dn-zeile` ohne Würfel (454–470) · `.tv-grow` mit `.tv-gdate` (2004–2012). Würfel heute `.tk-datum`/`.d-wd`/`.d-day`/`.d-mon` (577) | Goldwürfel 42 × 56 Radius 9 `--grad-gold`: Wochentag 12/700 `--gold-ink`, Tag 19/800 `--green-800`, Monat 12/700 Versal `--gold-ink`; Strich links 4 px, 16 oben/unten, 6 vom Rand: `--green-900` Spiel, `--green-450` Training | `.dn-zeile` app.js 1, `.tv-grow` 1, `.tv-gdate` 1 auf ein Muster. `.pr-bar` 6 × 34 mit `--grad-edge-*` (2792) ist ein ähnlicher Strich, aber für Rückmeldungen | M |
| **Kennzahl-Kachel** | `.kpi` weiß `--grad-kpi`, Etikett 11 px .68px, Wert 19/800 `--green-800`, Warnkachel mit 4-px-Streifen `.kpi.is-warn::before` `--grad-edge-red` (393–419, 2932) · `.kpi-value.is-rot/.is-gold` (416–417) · `.geld` (442–449) · `.tk-kachel` (673) · `.tv-nz` (1918) · `.rs2-kachel` (1361–1365) | getönt nach Bedeutung, kein Streifen: grün `--grad-task-green`/`--green-badge-line`/`--green-task-ink`; rot `--grad-task-red`/`--red-line`/`--red-ink`; amber `--amber-050`/`--amber-line`/`--amber-ink`; Urlaub `--blau-050`/`--blau-line`/`--blau-700`. Etikett 12/700 Versal, Wert 21/800 `tabular-nums`, `nowrap` | `.edge-green/.edge-gold/.edge-red`: **0** in app.js und styles.css (gibt es nicht mehr). Tatsächlich zu ersetzen: `.kpi.is-warn` (app.js 2: 746, 4564) und die Streifenregel 403–406, 2932. `.kpi` app.js 8: Kader 736/741/746, Konto Mannschaft 4564/4569, Kasse 5038/5043/5048 (`.kpi-tapbar`, entfällt laut Screen 13). Neue Modifikatoren z. B. `.kpi.is-gruen/.is-rot/.is-amber/.is-urlaub` | M |
| **Aufgabenzeile** `.task-row` | vorhanden (2480–2524), Zähler 34 × 34 Radius 10. Zähler-Flächen: rot `--grad-chip-red`, gold `--grad-chip-gold` 12 px, grün `--grad-chip-on`; Höhe `--h-row` 52, Titel 14/700, Unterzeile 12 | Zähler rot `--grad-edge-red`, gold `--grad-edge-gold`, grün `--green-800`; Vorlage 64 hoch, Zähler 15/800 | app.js 1 (617, `is-${z.art}`). **Achtung Kontrast:** Soll-Zähler rot (Weiß oben 3,97:1) und gold (`--gold-ink-2` unten 2,93:1) fallen durch. Empfehlung: Ist-Flächen `--grad-chip-red`/`--grad-chip-gold` behalten, nur grün auf `--green-800` | S |
| **Marke / Plakette** | Versal und klein: `.tag` .68rem Versal (703), Endschicht `.badge, .st-badge, .tag` 10/700 .4px (2976) · `.dn-zust` 11/800 Versal (463) · `.tk-bdg` 10/800 Versal (586) · `.tv-next-bdg` 10/800 (1898) · `.tv-gchip`, `.tv-tpl-chip` 12/700 (2017, 2039) · `.lu-ptag` .62rem, `.tv-tag` 10 px (1858, 2192) · `.cd` .72rem (809) · `.badge` .72rem (2803) | Pille 12/700 Satzschreibung, Innenabstand 3 10. Grün `--green-badge-bg`/`--green-800`; rot `--red-050`/`--red-700`; amber `--amber-050`/`--amber-ink`; Urlaub `--blau-050`/`--blau-700`; neutral `--line`/`--ink`. Kader-Pillen mit Punkt 7 px | eine Klasse (z. B. `.mark` + `.is-gruen/-rot/-amber/-urlaub/-neutral`) statt `.tag` (app.js 14), `.badge` (8), `.st-badge` (2), `.dn-zust` (1), `.tk-bdg` (1), `.tv-gchip` (1), `.tv-tpl-chip` (1), `.lu-ptag` (3), `.tv-tag` (3), `.cd` (2). Amber-Schrift heute `--amber-600` an `.tag-friendly`, `.tag-manuell` (712, 714), `.cd-amber` (820), `.st-amber` (840), `.lu-ptag.ang` (1860), `.tv-tag.ang` (2194): **3,35:1, Bestandsfehler** | M |
| **Textverweise** | `.link-btn` `--green-700`, unterstrichen, 600, `min-height:44px` (1651–1653); Ausnahmen ohne Unterstreichung in `.sec-mini` (1992) und `.ks-kopf` (2650) mit `::after` | `--green-800`, 15/600, ohne Unterstreichung, „›“ wenn wegführend; unterstrichen nur im Fließtext | `.link-btn` app.js 17. `.linklike` (2437, tot). `.venue-link` unterstrichen `--green-700` (717) → Ortszeile „Route ›“ | S |
| **Hinweistexte** | `.set-hint` 12 px (958), `.mb-note` 12 (1566), `.abo-hinweis` 13 (1193), `.tv-ro-note` 13, `.kat-sub` 11, `.page-head p` 13 (380) | eine Zeile 13 px `--muted` direkt unter dem Element; `.page-head p` entfällt überall; `.app-footer` entfällt | `.page-head p` app.js mindestens 3 (3618, 4358, 7166) · `.mb-note` 3 (4386, 4413, 4421) · `.mb-bar` 1 (4412) · `.app-footer` index.html:232–234 (app.js 0, Klick über `#resetBtn`) · `.krow-actions` 1 (4726, wandert ins Blatt 15) | S |
| **Flächensprache** | Dunkelgrün heute zusätzlich an `.kasse-sum` `--green-900` mit Hex `#cfe3d8`, `#eaf4ee` (2305–2311), `.kal-neu` `--grad-chip-on` (502), `.abo-btn.btn-primary` (1192), `.tv-cta` `--green-900` (2106), `.ein-ic.dunkelgruen` (1086), `.sw` an `--grad-chip-on` (1287) | nur Kopfzeile, Spielfeld, Termin-Hero/Spielkarte. `.kasse-sum` hell `--green-050`, Rand `--green-badge-line`, Betrag 21/800 `--green-800`. Training-Kopf `--grad-task-green`, Sonstiges `--grad-task-gold`. Symbolkacheln 32 × 32 `--green-050` mit `--green-800` | `.kasse-sum` app.js 1 (4682). `.ein-ic` 4 Farben (1084–1088) → eine. `.sw` an: Soll `--green-700` flach | S |

---

## 3. Tote Klassen und Tokens (heute schon)

Belegt per Skript: jede Klasse aus einem Selektor in styles.css (Kommentare entfernt), gesucht mit Wortgrenze in `app.js`, `index.html`, `db.js`. Dynamisch gebaute Namen sind geprüft und ausgenommen: `is-pay/is-lineup/is-rsvp` (app.js:617 `is-${z.art}`), `st-fit/st-angeschlagen/st-verletzt/st-urlaub` (app.js:136 `"st-" + wert`). `ev-…` wird nur als Element-ID gebaut (app.js:2519, 6481), deshalb sind die `.ev-*`-Klassen wirklich tot.

**Klassen ohne Verwendung (styles.css:Zeile)**

- Altes Kopf-/Konto-Gerüst: `.brand` 260, `.crest` 261, `.brand-text` 263–265, 1742, `.user-switch` 267–268, `.ident` `.ident-name` `.ident-role` 1661–1663, `.logout-btn` 1664, 1668
- Alte Terminkarte: `.ev-rsvp` 733–735, `.rsvp-cancelled` 735, `.rsvp-reason` 776, `.ev-foot` `.ev-dot` `.is-tap` 739–758, `.e-trainer` `.e-tr-rechts` 853–865, `.lu-jump` 870, `.event-date` `.typ-spiel` 2994–2995, `.cd-wrap` 806, `.e-bfv` 963, `.bfv-drift` 964–965, `.bfv-reset` 966, `.bfv-find` 960
- Alter Kalenderkopf: `.kal-cta` `.kal-cta-btn` `.kal-cta-txt` `.kal-cta-sec` 1307–1320, `.page-head-row` 901
- Alte Abo-Seite: `.cal-sub` `.cal-sub-title` `.cal-sub-desc` `.cal-link` `.cal-actions` `.cal-hint` `.cal-regen` 927–935, 950
- Alte Einstellungen: `.set-profile` `.set-row` `.set-val` `.set-logout` 951–955, **`.set-verwaltung` 956**, `.set-greet-name` `.set-greet-role` 971–972
- Alte Aufstellung: `.lu-controls` `.lu-row` `.lu-activebadge` `.lu-main` `.lu-pitch-wrap` `.lu-side` `.lu-group` `.lu-count` `.pl-pool` `.pl-empty` 1412–1445, `.tv-btnp` `.tv-btns` 2169–2170, `.s-url` 2207
- Alte Kasse: `.kasse-add` 1586, 2290, `.kasse-lbl` `.kasse-count` `.kasse-players` `.kasse-chip` `.kasse-select` `.kasse-two` `.kasse-staffel` 2291–2301, **`.kasse-save` 2313**, `.kasse-paid` 2314–2315, `.kasse-chosen` 2328, `.kasse-modes` `.kasse-mode` 2330–2334, `.kasse-bulk` 2415, `.ks-done` 2366, `.paid-self-btn` 1629–1635, `.linklike` 2437, `.kat-edit-row2` 1495
- Diagramme: `.chart-row` `.chart-card` `.chart-title` `.donut-wrap` `.chart-legend` `.lg-dot` `.bars` `.bar-head` `.bar-track` `.bar-fill` `.seg` `.seg-paid` `.seg-open` `.bar-sub` `.bars-legend` 1598–1622

Hinweis: `.kasse-add` und `.ks-neu` teilen sich die Regel 1586; `.ks-neu` lebt. `.hdr-gear` und `.app-footer` kommen nur in index.html vor, nicht tot.

**Tokens ohne Verwendung** (definiert in `:root`, kein `var(--x)` in styles.css, app.js, index.html, db.js)

- `--gold-600` (styles.css:31)
- `--gold-050` (styles.css:33)
- `--track-bar` (styles.css:95)

**Konsequenz für die Karten:** `.design-sync/cards` nutzen noch Klassen, die das Paket ersetzt (`.tv-next-btn`, `.rs2-btn`, `.tv-primary`, `.auth-submit`, `.section-title`, `.sec-mini`, `.tv-next-lbl`, `.set-verwaltung`, `.mb-bar`, `.mb-note`, `.app-footer`, `.kal-neu`, `.ks-neu`, `.krow-actions`, `.st-grau`). `validate.sh:34–46` prüft, dass jede Kartenklasse im Bundle existiert. Wer Klassen löscht, muss die Karten im selben Schritt nachziehen (früher F14).

---

## 4. Kontrastprüfung der Soll-Farbpaare

WCAG 2.x. Grenze 4,5:1, für Text ab 18,66 px fett (bzw. 24 px normal) 3:1. Bei Verläufen ist das schwächere Ende gerechnet. **UNTER** = fällt durch.

| Text | Fläche | Verhältnis | Grenze | Ergebnis | Wo |
|---|---|---|---|---|---|
| `#fff` | `--green-600` `#237a52` | 5,28:1 | 4,5 | ok | `--grad-btn` neu oben: Primärknopf, aktiver Chip, aktive Formation |
| `#fff` | `--green-700` `#1b5e3f` | 7,72:1 | 4,5 | ok | `--grad-btn` neu unten |
| `#fff` | `--green-550` `#2d9265` | 3,88:1 | 4,5 | **UNTER** | Ist `--grad-btn` oben, heute an allen `.btn-primary` |
| `--muted` neu `#5c6a63` | `--line` `#e2e8e4` | 4,57:1 | 4,5 | ok, knapp | gesperrter Primärknopf |
| `--muted` neu | `#fff` | 5,68:1 | 4,5 | ok | Nebentext auf Karte |
| `--muted` neu | `--bg` `#f4f7f5` | 5,27:1 | 4,5 | ok | |
| `--muted` neu | `--bg-1` Ist `#e9ecea` | 4,77:1 | 4,5 | ok | Seitengrund oben |
| `--muted` neu | **`--bg-2` Ist `#e0e4e2`** | **4,43:1** | 4,5 | **UNTER** | Seitengrund unten: Gruppenkopf, Hinweistext auf Grund; Segment-Spur, wenn sie `--bg-2` nimmt |
| `--muted` neu | `--bg-2` Vorlage `#e7eae9` | 4,69:1 | 4,5 | ok | Wert, mit dem README rechnet |
| `--muted` neu | `--seg-bg` `#e2e8e4` | 4,57:1 | 4,5 | ok | Segment-Spur, wenn `--seg-bg` bleibt |
| `--muted` neu | `--track-sheet` `#dfe5e1` | 4,45:1 | 4,5 | **UNTER** | nur falls Text auf Blattbalken-Spur |
| `--muted` neu | `--surface-3` / `--surface-4` | 5,41 / 5,45:1 | 4,5 | ok | inaktiver Chip, „+ frei“ im Bankplatz |
| `--muted` neu | `--green-050` / `--green-task-2` / `--amber-050` | 5,01 / 4,78 / 5,17:1 | 4,5 | ok | helle Zusammenfassung, Training-Kopf, Amber-Kachel |
| `--muted` alt `#66756d` | `--bg-2` Ist / `--seg-bg` | 3,78 / 3,90:1 | 4,5 | **UNTER** | heutiger Zustand |
| `--green-800` | `#fff` | 10,17:1 | 4,5 | ok | Segment aktiv, Textverweis, „+“ |
| `--green-800` | `--av-2` `#e0ebe4` | 8,32:1 | 4,5 | ok | Avatar-Initialen |
| `--ink` | `--surface-3` / `--surface-2` | 14,83 / 14,80:1 | 4,5 | ok | inaktiver Chip, Sekundärknopf |
| `--red-700` | `--surface-2` | 6,83:1 | 4,5 | ok | Sekundärknopf gefährlich |
| `--gold-ink` | `--gold-200` `#f6ebcd` | 5,37:1 | 4,5 | ok | Goldwürfel Wochentag/Monat |
| `--green-800` | `--gold-200` | 8,57:1 | 3 | ok | Goldwürfel Tag 19/800 |
| `--green-task-ink` | `--green-task-2` | 7,89:1 | 4,5 | ok | Kachel grün |
| `--red-ink` | `--red-200` | 8,31:1 | 4,5 | ok | Kachel rot |
| `--amber-ink` | `--amber-050` | 5,39:1 | 4,5 | ok | Kachel/Marke amber |
| `--amber-ink` | `#fff` | 5,92:1 | 4,5 | ok | „8 gemeldet“ |
| `--blau-700` | `--blau-050` | 6,32:1 | 4,5 | ok | Urlaub (falls freigegeben) |
| `--red-600` | `--red-200` | 4,47:1 | 3 | ok nur groß | Betrag 21/800 in roter Kachel. Als kleiner Text **UNTER** (dann `--red-ink`) |
| `--red-600` | `#fff` | 5,44:1 | 4,5 | ok | Kontobanner-Betrag |
| `#fff` | `--red-500` `#d9543f` | 3,97:1 | 4,5 | **UNTER** | Soll-Zähler rot `--grad-edge-red` oben, 15/800 |
| `#fff` | `--red-600` | 5,44:1 | 4,5 | ok | Ist-Zähler `--grad-chip-red` (Empfehlung: behalten) |
| `--gold-ink-2` | `--gold-400` `#e3c25c` | 4,46:1 | 4,5 | **UNTER** | Soll-Zähler gold `--grad-edge-gold` oben |
| `--gold-ink-2` | `--gold-700` `#c39a22` | 2,93:1 | 4,5 | **UNTER** | Soll-Zähler gold unten |
| `#fff` | `--amber-700` / `--gold-ink` | 4,62 / 6,37:1 | 4,5 | ok | Ist-Zähler `--grad-chip-gold` (Empfehlung: behalten) |
| `#fff` | `--green-800` | 10,17:1 | 4,5 | ok | Soll-Zähler grün |
| `--gold-ink-2` / `--red-ink-2` / `--green-task-ink-2` | Aufgabenflächen unten | 6,68 / 6,34 / 5,91:1 | 4,5 | ok | Aufgabentitel und Unterzeilen |
| `--green-800` | `--green-badge-bg` | 8,84:1 | 4,5 | ok | Marke grün |
| `--red-700` | `--red-050` | 6,18:1 | 4,5 | ok | Marke rot |
| `--ink` | `--line` | 12,54:1 | 4,5 | ok | Marke neutral |
| `--amber-600` | `--amber-050` | 3,35:1 | 4,5 | **UNTER** | Bestand: `.tag-friendly`, `.tag-manuell`, `.cd-amber`, `.st-amber`, `.lu-ptag.ang`, `.tv-tag.ang` |
| `--amber-600` | `#fff` | 3,68:1 | 4,5 | **UNTER** | Bestand: `.tk-notiz` (691), `.bfv-drift` (tot), `.sim-exit` (358) |
| `--green-800` | `--green-050` | 8,97:1 | 3 | ok | `.kasse-sum` hell, Betrag 21/800 |
| `--ink` / `--muted` | `--green-050` | 13,74 / 5,01:1 | 4,5 | ok | `.kasse-sum` Text |
| `--ink` | `--green-task-2` / `--gold-250` | 13,11 / 13,48:1 | 4,5 | ok | Training- und Sonstiges-Kopf |
| `#fff` | `--green-750` | 8,50:1 | 4,5 | ok | Hero, hellstes Ende |
| `rgba(255,255,255,.85)` | `--green-750` | 6,65:1 | 4,5 | ok | Hero-Zeit 15/600 |
| `--gold-400` | `--green-750` | 4,91:1 | 4,5 | ok | „Nächstes Spiel · Auswärts“ 13/700 |
| `--gold-400` | Gold 18 % über `--green-750` (`#3c6a44`) | 3,63:1 | 4,5 | **UNTER** | Hero-Pille „Nächster Termin“ 12/700. Ersatz `--bdg-venue-fg` 5,15:1 oder `--gold-200` 5,28:1 |
| `#fff` | `--pitch-green` / `#2a7541` | 5,07 / 5,65:1 | 4,5 | ok | Spielernamen 13/700 |
| `--gold-400` | `--pitch-green` / `#2a7541` | 2,93 / 3,26:1 | 4,5 | **UNTER** | „LV frei“ 13/700 (Textschatten zählt nicht). Ersatz `--gold-100` 4,71 / 5,24:1 |
| `--muted` neu | `#fff` | 5,68:1 | 4,5 | ok | Bottom-Nav 11/600 (Größenausnahme) |
| `--green-700` | `#fff` | 7,72:1 | 4,5 | ok | Bottom-Nav aktiv |
| `--green-chev` (Nicht-Text) | `#fff` | 4,91:1 | 3 | ok | Chevron „›“ |
| `--dot-off` (Nicht-Text) | `#fff` | 1,56:1 | 3 | **UNTER** | Bestand: `.kal-abo-chev`, `.geld-chev`, `.tv-garrow` |

**Lösung für `--muted` auf `--bg-2`**, eine von drei:
a) `--bg-2` auf den Vorlagenwert `#e7eae9` zurück (4,69:1). Die Karte verliert etwas Kante, die mit dem schärferen `--shadow-card` aber ohnehin da ist.
b) `--muted` eine Stufe dunkler, `#58665f` (4,70:1 auf `#e0e4e2`, 6,0:1 auf Weiß). Weicht vom Paket ab.
c) Kein `--muted`-Text direkt auf dem Seitengrund. Unrealistisch, der Gruppenkopf steht genau dort.
Empfehlung a), ein Token, keine Klassenänderung.

---

## 5. Trefferflächen unter 44 px laut Vorlage

Muster (harte Regel 1, conventions.md:126–130): sichtbar klein lassen, `position: relative` am Element, darüber ein unsichtbares `::after` mit `--tap`, **kein `overflow: hidden`** am Element oder an einem Vorfahren, der die Fläche schneiden würde. Liegen mehrere nebeneinander, die Fläche nur senkrecht dehnen (`left:0; right:0`), damit sich Nachbarn nicht überdecken.

```css
.x { position: relative; }
.x::after { content: ""; position: absolute; top: 50%; left: 50%;
  width: max(100%, var(--tap)); height: max(100%, var(--tap));
  transform: translate(-50%, -50%); }
```

| Element (Vorlage) | sichtbar | Ist heute | Weg auf 44 | Fundstelle Ist |
|---|---|---|---|---|
| Chip inaktiv/aktiv (Formation, Konto-Status „Offen 3“, Rollen) | 36 hoch, ab 14 px Text breiter als 44 | `.chip` 34 mit `::after` senkrecht 44 | Höhe 34 → 36, `::after` bleibt (`left:0; right:0; height: var(--tap)`). `.chips .chip` behält `min-width:0` ohne `overflow` | styles.css:1531–1542, 2962–2969 |
| Formations-Pille | 36 | `.tv-fpill`/`.tv-fmore` 33 mit `::after` | Höhe 36, `::after` bleibt. `.tv-formbar` hat `overflow-x: auto` (2066): schneidet senkrecht nicht, verstößt aber gegen „kein waagerechtes Scrollen“, falls Pillen überlaufen | styles.css:2066–2076 |
| Entfernbarer Spieler-Chip mit „×“ (Screen 16) | Chip 36, „×“ rund 20–24 | `.ks-ichip .chip-x` 24 mit `::before` 44 × 44 | übernehmen; Chip 36, Innenabstand 0 8 0 14, „×“ behält `::before` | styles.css:2403–2412 |
| Hinzufügen-Knopf „+“ | 36 × 36 | gibt es nicht | neues Element mit `::after` 44 × 44 zentriert. Zeile ist 52–60 hoch, Fläche passt. Rechter Rand: Zeile hat 16 Innenabstand, Fläche ragt 4 px darüber, das ist zulässig | neu |
| Segment-Knopf | 38 hoch, ≥ 80 breit | `.ks-seg-b` 44 echt hoch, `.kal-seg-b` 42 mit `::after` | Höhe 38, `::after` senkrecht `height: var(--tap)`. **`.ks-seg-b` hat `overflow: hidden` (2541)**, das schneidet das `::after` ab. Entfernen oder Ellipse an ein inneres `<span>` legen | styles.css:488–498, 2535–2545 |
| Menü ··· im Hero und in Zeilen | Vorlage **44 × 44 sichtbar** (Hero mit Fläche `.12`, Zeilen ohne Fläche, Symbol 20) | `.tk-menue` 38 × 38 mit `::after` 44 | entweder sichtbar auf 44 (Vorlage) oder 38 + `::after` lassen. Neue ··· in Vorlagen-, Weitere-Spiele- und Buchen-Zeilen (Screens 06, 15) brauchen dasselbe Muster | styles.css:599–604 |
| Textverweis im Gruppenkopf („Alle Strafen ›“, „Spieler wählen ›“, „Alle bestätigen“, „Anleitung ›“) | Text 15/600, rund 20 hoch | `.link-btn` `min-height: 44px` (dehnt die Zeile), Ausnahmen `.sec-mini .link-btn` und `.ks-kopf .link-btn` mit `min-height:0` und `::after` | in `.group-head .link-btn`: `min-height:0`, `::after` mit `height: var(--tap)`, `width: calc(100% + 16px)`, rechts bündig. Sonst wächst der Gruppenkopf auf 44 und die Abstände 24/8 stimmen nicht | styles.css:1651–1653, 1992–1999, 2650–2657 |
| „Route ›“ in der Ortszeile, „+ Termin“ neben dem Titel | Text 15/600 bzw. 15/700 | `.tk-route` 23 hoch (633), `.venue-link` 44 | `::after` senkrecht 44 wie oben. „+ Termin“ hat in der Vorlage schon `min-height:44px` | styles.css:631–637, 717 |
| iOS-Schalter | 51 × 31 | `.sw` 51 × 31 mit `::after` 44 × 44 (Kommentar sagt noch 46 × 28) | passt; nur `::after`-Breite auf `max(100%, var(--tap))`, Kommentar 1270–1272 korrigieren | styles.css:1273–1292 |
| Schließen-Kreuz der Abo-Zeile | Vorlage 44 × 44 sichtbar | `.kal-abo-x` 26 mit `::after` 44 | passt | styles.css:545–555 |
| Spielerscheibe auf dem Platz | 40 | `.tv-disc` 34 im `.tv-slot` mit `::before` 44 | Scheibe 34 → 40, `::before` bleibt | styles.css:2087–2092 |
| Kopfzeilen-Zahnrad, Zurück im Unterkopf | 24 bzw. 20 Symbol in 44 | `.hdr-gear` 24 + `::after` 44, `.tv-ic` 24 + `::after` | passt | styles.css:253–259, 2062–2063 |

Nicht betroffen, weil echt ≥ 44: Primär- und Sekundärknopf (48), Zu-/Absage (48), Listenzeilen (52–60), Bankplätze (54), freie Position auf dem Platz (Ring 44), Statusknöpfe (52).

---

## Umfang und Risiken (Kurzfassung)

1. Umfang: 19 neue Tokens, 3 geänderte (`--muted`, `--grad-btn`, `--h-btn`), 1–2 gestrichen; 15 Bausteine, davon Listenzeile (L) und Primärknopf, Gruppenkopf, Segment, Kachel, Marke (je M) die großen Brocken. Rund 30 Stellen in app.js für Primärknopf und Gruppenkopf allein.
2. Entscheidung offen: Blau für Urlaub widerspricht der Festlegung vom 18.09.2026 (grau); `--blau-*` fehlen in der App, README nennt sie fälschlich „unverändert“.
3. Kontrast: `--muted` neu fällt auf dem App-Grund `--bg-2` der App auf 4,43:1; Soll-Zähler rot/gold der Aufgabenzeile, Hero-Pille und „LV frei“ fallen ebenfalls durch. Für alle ist ein Ersatz-Token oben genannt.
4. Vorlagen sind gegen eine ältere `tokens.css` gerendert (weicher `--shadow-card`, hellere `--bg-1/-2`); pixelgenauer Abgleich gegen `soll/*.png` zeigt deshalb Abweichungen, die gewollt sind.
5. Werkzeug: `tokenBlockLines` in config.json, Token-Zähler in conventions.md/check-conventions.sh und die Karten unter `.design-sync/cards` (nutzen 15 der zu ersetzenden Klassen) müssen im selben Commit mitgehen, sonst schlagen build.sh und validate.sh fehl.
