# DELTA: „Final Alle Screens“ gegen die App (Phase 0, 06.10.2026)

Quelle: Claude-Design-Projekt „FC Fasanerie-Nord Design-Review“, gespiegelt nach
`referenz/` (byte-genau gegen die Projektliste geprüft; die Auslieferung fügt Skripte und
C2PA-Metadaten ein, die entfernt sind). Übergabe-README: `PAKET-README.md`.
Soll-Bilder und Soll-Maße je Screen: `soll/` (`.design-sync/shots/finalsoll.mjs`, 390 px,
Maßstab 1). Pixelabgleich: `.design-sync/shots/finalmess.mjs`, Vorschriften je Screen in
`finalscreens.mjs`.

Die Einzeltabellen (Element | Ist | Soll | Art | Aufwand | Fundstelle) stehen unten in den
Abschnitten A, B, C, D/E und Tokens; sie wurden je Teil parallel erstellt und hier
zusammengeführt.

## Überblick

| Teil | Screens | Delta-Zeilen | Schema/Backend |
|---|---|---|---|
| Tokens und Bausteine | app-weit | 19 neue, 3 geänderte Tokens; 15 Bausteine | nein |
| A Übersicht, Kalender | 01 bis 04 (05 gestrichen) | rund 90 | **ja**: Treffen-Uhrzeit `events.treffen` (03) |
| B Trainer, Kader | 06, 07, 07b, 07c, 08, 09, 10 | rund 60 | nein (freie Position = fehlender Schlüssel in `lineups.slots`) |
| C Konto, Kasse, Katalog | 11 bis 17 | rund 80 | nein (`mark_fines_paid(uuid[], text)` bucht mehrere Strafen) |
| D/E Einstellungen, Unterseiten | 18 bis 21, 23 bis 25, 27, 28 (22 und 26 ausgenommen) | rund 110 | nein |

**Ausgenommen** (Folgepaket „Anmeldung und Onboarding“ in PLAN.md): 22 Anmeldung und
Onboarding, „Position statt Rückennummer“ im Profil (21), Mehr-Blatt (05) und Rollen (26).

## Änderungen mit Schema oder Backend

| # | Änderung | Grund | Migration |
|---|---|---|---|
| S1 | Spalte `events.treffen text` (Treffzeit „HH:MM“, leer erlaubt) | 03 Termin anlegen zeigt „Anstoß 13:30 · Treffen 12:45“; bisher keine Treffzeit | eigene Migration, ein do-Block mit Gegenprobe; RLS der Tabelle bleibt (Spalte erbt die bestehenden Policies) |
| S2 | keine weitere | 07b/07c aus `slots` ableitbar; Buchen über `mark_fines_paid`; „Verbindung trennen“ über `set_ical_url('')`; Passwort über `DB.updatePassword` | entfällt |

## Funktionen, die heute existieren und in der Vorlage fehlen (bleiben, im Stil der Vorlage)

Sammelliste der Einzelabschnitte (A: 18, B: 6, C: 8, D/E: 26 Punkte). Die wichtigsten:

| Funktion | Ort im neuen Design |
|---|---|
| In Kalender speichern, Teilen, Kader-Info teilen | Menü ··· des Hero bzw. der Terminkarte, für alle Rollen geöffnet |
| Termin bearbeiten, absagen, löschen; Serie | Menü ··· der Terminkarte (Trainer, Admin) |
| Rückmeldungen: Push senden mit Empfängerzahl, Bestätigung, 12-h-Sperre; Teilen; Übersicht teilen | Fuß des Rückmeldungen-Blatts (drei Knöpfe, verbindlich) |
| Aufstellung speichern, Bankspieler entfernen, Abgesagte/Unbeantwortete aufstellen | Platz-Unterkopf (Speichern), Kreuz am Bankplatz, Gruppe „Weitere“ im Blatt |
| Status „bis“-Datum | Status-Blatt 10 unter dem Grund |
| Überweisung als Zahlart, Entfernen automatischer Strafen, Verlauf | Blatt Buchen (Segment Bar / PayPal / Überweisung), Menü ··· je Strafe |
| Konto-Filter „Alle“, Mahnzuschlag-Hinweis | Segment Mannschaft; Hinweis unter der Erhöhungs-Marke |
| Testnachricht (nur Admin), Strafhinweis, Vorschau iOS/Android, Push-Zustände | Mitteilungen bzw. Push-Texte (Bearbeiten-Ebene) |
| „Dringendes trotzdem zustellen“ | Ruhezeiten (ersetzt die Vorlagen-Ausnahme „Spieltag“) |
| Rollen | Zeile in Verwaltung, führt auf die bestehende Rollen-Ansicht |
| Abmelden, Build-Kennung | Profil (Abmelden), Diagnose (Version) |

## Festlegungen für fehlende Entscheidungen (Annahmen, im Abschluss aufgeführt)

| # | Festlegung | Grund |
|---|---|---|
| D1 | Tokens der Vorlage gelten (`--bg-1`, `--bg-2`, `--shadow-card` aus `tokens.css` der Vorlage) | sonst erreicht `--muted` neu auf `--bg-2` nur 4,43:1 |
| D2 | **Blau für Urlaub** wird eingeführt (`--blau-050/600/700/line`) | Vorlage gilt; kippt die Festlegung „Urlaub grau“ vom 18.09.2026 |
| D3 | Zähler der Aufgabenzeilen behalten die heutigen Flächen (`--grad-chip-red`, `--grad-chip-gold`) | Vorlagenfarben 3,97:1 bzw. 2,93:1, Vorgabe 4,5:1 geht vor |
| D4 | Hero-Pille „Nächster Termin“ und „LV frei“ bekommen kontrastsichere Farben (dunkle Pille) | 3,63:1 bzw. 2,93:1 |
| D5 | Treffzeit als neue Spalte (S1) | Vorlage gilt, nötiges Backend |
| D6 | „Aufstellung veröffentlicht“ (19, 25) wird **nicht** gebaut, als Folgepaket vorgemerkt | neue Push-Kategorie mit Erzeuger, ändert die abgeschlossene Push-Automatik |
| D7 | Mitteilungen nach Thema gegliedert (Termine, Strafen, Trainer, Kasse); sichtbar bleibt nur, was die Rolle betrifft | Vorlage gilt; Rollenfilter bleibt (kategorie_erlaubt) |
| D8 | `#kasse=pruefen` und `#strafen=meine` bleiben als Deep Links, zeigen auf „Gemeldet“ bzw. Segment „Ich“ | Push-Vorlagen in der Datenbank zeigen darauf |
| D9 | Karte „Nächstes Spiel“ auf der Übersicht entfällt, das Spiel steht unter „Danach“ | Vorlage zeigt sie nicht; keine Funktion geht verloren |
| D10 | `--fs-betrag`: Kontobetrag 52 px wie gezeichnet, sonst 40 px | Widerspruch README (40) und Vorlage (52) |

## Verbindliche Vorgaben, die von der Vorlage abweichen

Bottom-Nav (Übersicht, Kalender, Katalog, Konto plus fünfter Tab je Rolle; die Soll-Bilder
zeigen „Mehr“), Trefferflächen ≥ 44 px (Chips, „+“, ···, Segment per `::after`, `.ks-seg-b`
ohne `overflow: hidden`), Kontrast ≥ 4,5:1 (D1, D3, D4), Rückmeldungen-Blatt mit drei
Knöpfen statt „Alle 7 erinnern“ + „Teilen“, Push-Texte und Testnachricht nur für Admin,
keine Gedankenstriche (heute u. a. `app.js` 2162, 4386, 4411, 6024, 7197) und keine
ASCII-Umlaute, keine Funktion fällt weg.

---

## Delta Tokens und Bausteine

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

### 1. Tokens

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

### 2. Bausteine

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

### 3. Tote Klassen und Tokens (heute schon)

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

### 4. Kontrastprüfung der Soll-Farbpaare

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

### 5. Trefferflächen unter 44 px laut Vorlage

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

---

## Delta A · Übersicht, Kalender, Termin anlegen, Rückmeldungen

Stand 06.10.2026, nur gelesen. Soll: `PAKET-README.md`, `referenz/Final A Übersicht und Kalender.dc.html`, `soll/01–04`. Ist: `app.js`, `styles.css`, `index.html`, `landkarte/bilder/admin/{dashboard,kalender,kalender--terminModal,dashboard--rsvpSheet}.png`.
Zeilenangaben beziehen sich auf den Stand von Commit `035d3fc`.

**Voraussetzung aus den Bausteinen (vor Screen A, wirkt auf alle vier Screens):**

| Element | Ist | Soll | Art | Aufwand | Fundstelle |
|---|---|---|---|---|---|
| `--muted` | `#66756d` (4,0:1 auf `--bg-2`) | `#5c6a63` | Styling | S | styles.css:65 |
| `--grad-btn` | `--green-550 → --green-650` | `180deg, --green-600 0%, --green-700 100%` | Styling | S | styles.css:105 |
| `--h-btn` / `--h-btn-lg` | 46 / 48 | 48, `--h-btn-lg` Alias | Styling | S | styles.css:175–176 |
| `--amber-ink`, `--amber-line` | fehlen | `#8a5a08`, `#ecd3a6` | Styling | S | styles.css `:root` |
| `--blau-700/600/050/line` | fehlen in der App (nur im DS-Paket) | `#1d5a8a`, `#2e7bb5`, `#e7f0f7`, `#c3dbea` | Styling | S | styles.css `:root`; `--grad-urlaub` styles.css:125 heute grau |
| `--fs-betrag/-titel/-kpi/-zeile/-neben/-etikett`, `--sp-1…6` | fehlen | 40, 26, 21, 16, 13, 12 px; 4 8 12 16 24 32 | Styling | S | styles.css `:root` |
| `.group-head` | `.section-title` 15/700 Satzschrift, `.sec-mini` 11/800 .08em, Rand 20/14 | 12/700 Versal .06em `--muted`, 24 oben, 8 unten; Verweis rechts 15/600 `--green-800`, ohne Unterstreichung, „›“, `::after` 44 | Styling + Frontend-Logik | M | styles.css:431–437, 1987–1999; app.js:614, 698, 701, 704, 707, 1185 |
| `.btn-primary` | `.rs2-btn`, `.kal-neu`, Termin-„Anlegen“ eigene Stile | ein `.btn-primary`, 16/700, 48, Radius 12, `--shadow-btn`; gesperrt `--line`/`--muted` | Styling | M | styles.css:875, 2950; 502–509; 1388–1391 |
| Marke/Plakette | Versal 11/800 (`.dn-zust`, `.tk-bdg`, `.tag`) | Pille 12/700 Satzschreibung, Innenabstand 3 10, Bedeutungsfarben | Styling | S | styles.css:463–470, 586–591 |
| Fußzeile „Neu laden“ | auf jeder Seite | entfällt; „App neu laden“ steht schon in Einstellungen (app.js:2194), Ziehen bleibt | Frontend-Logik | S | index.html:231–233; app.js:6726–6729; styles.css:1645 |

---

### 01 Übersicht

| Element | Ist | Soll | Art | Aufwand | Fundstelle |
|---|---|---|---|---|---|
| Seitentitel „Servus, Name“ | 22/800 | 26/800, letter-spacing −.02em (`--fs-titel`) | Styling | S | styles.css:2466, 2917; app.js:686–689 |
| Rollenpille | „ADMIN“ Versal 10/700 .6px, Schrift `--green-900`, Innenabstand 3 8 | „Admin“ Satzschreibung 12/700, Schrift `--gold-ink`, `--grad-gold`, Rand `--gold-line`, 3 10, Abstand zum Titel 10 | Styling + Frontend-Logik (Text) | S | app.js:507–512; styles.css:2468–2476 |
| Abstand Titel → Hero | 14 | 16 | Styling | S | styles.css:378 |
| Hero-Karte | `.card.tk`, Radius 14 | Radius 16, Schatten `0 1px 1px rgba(16,40,30,.05), 0 18px 34px -18px rgba(11,49,37,.55)` (neues Token) | Styling | S | styles.css:561; app.js:692 |
| Hero-Kopf Fläche | `--grad-tk-kopf` 180deg `--green-800 → --green-900`, min 86, Innenabstand 12 14 | `158deg, --green-750 0%, --green-900 55%, --green-950 100%`, Innenabstand 16 12 18 16, senkrecht gestapelt, Abstand 14; 3-px-Goldlinie unten `90deg --gold-400 → --gold-700`; Zierkreis 160 px, Rand 1,5 px `rgba(255,255,255,.08)` rechts oben | Styling | M | app.js:2419–2429; styles.css:564–568 |
| Hero-Kopf Pille | fehlt | „Nächster Termin“ 12/700, `--gold-400` auf `rgba(227,194,92,.18)`, Rand `rgba(227,194,92,.5)` | Frontend-Logik + Styling | S | app.js:2419ff. (nur `opts.hero`) |
| Hero-Menü ··· | fehlt im Hero (`!opts.hero`) | Kreis 44, `rgba(255,255,255,.12)`, für **alle Rollen** (enthält mindestens „In Kalender speichern“) | Frontend-Logik | M | app.js:2428, 2529–2555 (`openTkMenu` bricht für Nicht-Trainer ab) |
| Goldwürfel Hero | 48 breit, Wochentag 10, Tag 22, Monat 9 | 56 × 66, Radius 12, Schatten `0 6px 14px -6px rgba(0,0,0,.5)`; Wochentag 12/700 `--gold-ink`, Tag 26/800 `--green-800`, Monat 12/700 Versal `--gold-ink` | Styling | S | styles.css:570–577 |
| Hero-Titel | 19/800 | 28/800, −.025em, Zeilenhöhe 1.05 | Styling | S | styles.css:592–595 |
| Hero-Zeitzeile | über dem Titel mit Marke „HEIM“: „15:00 – 16:45 Uhr“ 13/600 | unter dem Titel 15/600 `rgba(255,255,255,.85)`: „Morgen · 19:30 bis 21:00 Uhr“; relativer Tag (Heute/Morgen/Wochentag) neu; „bis“ statt Gedankenstrich; Heim/Auswärts als Text („Spiel · Auswärts“ wie in 02) statt Versal-Marke | Frontend-Logik | S | app.js:2408–2410, 2424 |
| Ortszeile | eingelassenes Feld 60 hoch, Goldkachel 37 mit Pin, zwei Zeilen (Name 14/700, Adresse 13), Pille „ROUTE“ 11/800 Versal | flache Zeile min 52, Innenabstand 0 16, Linie unten `--line`; Linien-Pin, Name einzeilig 15/600 mit Auslassung, rechts „Route ›“ 15/600 `--green-800`; ganze Zeile bleibt Link | Styling | S | app.js:2434–2446; styles.css:611–640 |
| Zu-/Absage | 2 Spalten, Abstand 14, 46 hoch, Radius 14, 16/800, gewählt `--green-badge-bg` + Rand 1 px; Text bleibt „Zusage“ | Abstand 8, Innenabstand 14 16 4, 48 hoch, Radius 12, 16/700; gewählt `--green-050`, Rand 1,5 px `--green-700`, Schrift `--green-800`, **Text wechselt auf „Zugesagt“** (analog „Abgesagt“); ungewählt `--grad-btn-sec`, Rand `--line-soft-3`, Schrift `--ink` | Styling + Frontend-Logik | S | app.js:2451–2454; styles.css:642–654 |
| Meldeschluss | eigene Zeile „Meldeschluss: 21h 00m“ mit roter Countdown-Pille | rechts in der Rückmeldungen-Zeile „Meldeschluss in 21 h“ 13/600 `--red-700`; Countdown-Logik bleibt, Format „in 21 h“ | Frontend-Logik | M | app.js:2457–2460, 2337–2350, `startCountdowns` 376 |
| Rückmeldungen-Zeile (Trainer) | eingelassenes Feld: „ZUSAGEN“ 11/800, rechts „5 offen ›“ 15/800 Gold, Balken, „9 zugesagt · 2 abgesagt · 5 offen“ | flache Zeile, Linie oben, Innenabstand 12 16, min 56; oben „Rückmeldungen“ 13/700 `--ink` und Meldeschluss; Balken 6, Spur `--track-bar`, grün `--green-600` (rot `--red-600` für Absagen bleibt); darunter „1 zu · 0 ab · 15 offen“ 13 `--muted`, Zahlen fett `--ink`; rechts „›“ 20 `--green-chev`; ganze Zeile öffnet 04 | Styling + Frontend-Logik (Text) | M | app.js:2463–2477; styles.css:658–668 |
| Aufstellung / Kader | zwei getrennte Felder, Abstand 10; „AUFSTELLUNG 11/11 ›“, „KADER-INFO 16 Spieler ›“ (öffnet Kader-Info-Text) | ein Raster, Linie oben, Trennlinie dazwischen, je min 56, Innenabstand 0 16; Etikett 12/700 Versal `--muted`; Wert 17/800: „11 von 11“ `--gold-ink`, „15 fit“ `--green-800`; „›“ 18 `--green-chev`. „Kader“ führt zur Kaderansicht, Zahl = fitte Spieler | Styling + Frontend-Logik | M | app.js:2479–2491; styles.css:671–676 |
| „In Kalender speichern“ | unterstrichener Link am Kartenende | entfällt aus der Karte, ins Menü ··· | Frontend-Logik | S | app.js:2516–2517 |
| Push-Hinweis „Nichts mehr verpassen?“ | Kachel mit Goldsymbol über dem Hero | nicht in der Vorlage; bleibt, im Stil der Abo-Zeile aus 02 (siehe Abschnitt Funktionen) | Styling | S | app.js:690, 1587–1601 |
| Gruppenkopf „Heute zu tun“ | „Was heute liegt“ 15/700 | „Heute zu tun“, `.group-head` | Frontend-Logik (Text) + Styling | S | app.js:614 |
| Aufgabenzeile Maße | min 52, Innenabstand 13 14, Radius 14, Titel 14/700, Neben 12/500 | min 64, Innenabstand 0 16, Radius 14, Titel 16/700, Neben 13; Abstand 8 | Styling | S | styles.css:2479–2497 |
| Aufgabe „Zahlungen bestätigen“ | Neben „Kassenwart · seit heute“, Zähler `--grad-chip-red` | Neben „Kasse · seit 6 Tagen“; Zähler laut Vorlage `--grad-edge-red` (Kontrast siehe Abschnitt 4) | Frontend-Logik (Text) | S | app.js:565; styles.css:2503 |
| Aufgabe „Ohne Rückmeldung“ | Neben „Erinnerung senden“ | „Training Di · Erinnerung senden“ (Terminart + Wochentag); Zähler `--green-800` statt `--grad-chip-on` | Frontend-Logik + Styling | S | app.js:592–595; styles.css:2521 |
| Aufgabe Aufstellung | Titel „Aufstellung So 4. Okt“, Neben „x von 11 gesetzt“, Zähler = gesetzte Plätze, `--grad-chip-gold` weiß | Titel „Elf aufstellen“, Neben „So 25. Okt · SV Am Hart“, Zähler = Anzahl offener Aufstellungen, `--grad-edge-gold` mit Schrift `--gold-ink-2` | Frontend-Logik + Styling | S | app.js:581–586; styles.css:2512 |
| Reihenfolge Aufgaben | eigene Rückmeldung, Zahlungen, Aufstellung, Ohne Rückmeldung | Zahlungen, Ohne Rückmeldung, Elf aufstellen (eigene „Rückmeldung fehlt“ bleibt, vorn) | Frontend-Logik | S | app.js:532–603 |
| Mein Konto, Kopf | nur für reine Spieler; für Trainer/Kasse ohne Kopf | für alle Verknüpften mit Offenem: „Mein Konto“ + „Alle Strafen ›“ | Frontend-Logik | S | app.js:697–699 |
| Kontobanner Etikett | 11/700 .68px | 12/700 .08em Versal `--muted` | Styling | S | styles.css:1555 |
| Kontobanner Fläche | `--card`, Rand `--line`, `--shadow-sm`, Innenabstand 18 16 16 | `--grad-card`, Rand `--line-soft`, `--shadow-card`, 20 16 16, Abstand 10 | Styling | S | styles.css:1547–1554 |
| Kontobanner Betrag | 52/800 | 52/800 laut Vorlage (README-Token `--fs-betrag` sagt 40, Widerspruch, Vorlage gilt) | keiner | – | styles.css:1556 |
| Kontobanner Unterzeile | „offen von 620,00 € · 35 Strafen“ 12 | „3 Strafen offen · **8 gemeldet**“ 13, gemeldet 700 `--amber-ink` | Frontend-Logik | S | app.js:4409–4411 |
| Fortschrittsbalken `.mb-bar` | vorhanden | entfällt | Frontend-Logik | S | app.js:4412 |
| Bezahlknopf | `--h-btn-xl` 52, 16, volle Breite | 52, 17/700, seitlich 8 eingerückt, Abstand oben 6, `.btn-primary` | Styling | S | styles.css:1569 |
| Fuß „Zahlung melden“ | unterstrichener Link 13/700, rechts „Erhöhung in …“ 12 `--muted` | „Zahlung melden ›“ 14/600 `--green-800` ohne Unterstreichung; rechts rote Marke „Erhöhung in 1h 50m“ `--red-050`/`--red-700` 12/700; Linie oben, min 44 | Styling + Frontend-Logik | S | app.js:4417–4420; styles.css:1571–1576 |
| Mannschaftskasse / Meine Strafen (Geldzeilen) | eigene Karten unter dem Konto für Trainer/Kasse | nicht in der Vorlage, siehe Abschnitt Funktionen | Frontend-Logik | S | app.js:669–683 |
| Karte „Nächstes Spiel“ | zweite Terminkarte, wenn der Hero kein Spiel ist | nicht in der Vorlage; das Spiel erscheint als Danach-Zeile (Entscheidung, siehe Abschnitt Funktionen) | Frontend-Logik | S | app.js:645–651, 701–702 |
| Danach, Kopf | „DANACH“ 11/800, „Kalender ›“ nur ohne Spielkarte | `.group-head`, „Kalender ›“ immer | Frontend-Logik | S | app.js:704 |
| Danach-Zeile | min 68, Innenabstand 10 14; Würfel 48 (10/22/9); Titel 15/700; Neben „HEIM · 15:00 – 16:45 Uhr“ | min 68, Innenabstand 0 16; Farbstrich 4 px links (6 vom Rand, 16 oben/unten), `--green-900` Spiel, `--green-450` Training (Sonstiges nicht definiert, Vorschlag `--gold-500`); Würfel 42 × 56 Radius 9 (12/19/12, Tag `--green-800`); Titel 16/700 (Spiel 16/800, Auslassung); Neben 13 `--muted`: Spiel „Spiel · 13:30 Uhr · Auswärts“, Training „19:30 Uhr“ (nur Beginn) | Styling + Frontend-Logik | M | app.js:2372–2387; styles.css:453–462 |
| Danach-Marke | Versal 11/800; Offen gold | Satzschreibung 12/700; Zugesagt `--green-badge-bg`/`--green-800`, **Offen rot** `--red-050`/`--red-700`; Abgesagt nicht definiert (Vorschlag neutral `--line`/`--ink`, sonst gleich wie Offen) | Styling | S | styles.css:463–470 |
| Mein Status, Beschriftung | „fit“, „angeschlagen“, „verletzt“, „Urlaub“ | „Fit“, „Angeschlagen“, „Verletzt“, „Urlaub“ | Frontend-Logik | S | app.js:121–126 (auch Kader und Profil betroffen) |
| Mein Status, Knöpfe | Chips 2×2, Abstand 10, 52 hoch, Radius 14, 15; gewählt je Status gefärbt (gold, rot, grau) | 2×2, Abstand 8, 48 hoch, Radius 12, 16; **gewählt immer Primärgrün** `--grad-btn` + weißes Häkchen-SVG, 700; sonst `.btn-soft` 600 mit Punkt 8 px (`--amber-600`, `--red-600`, `--blau-600`; bei Fit keiner) | Styling + Frontend-Logik (SVG, Punkt) | M | app.js:132–152; styles.css:473–475, 1400–1403, 2846–2849 |
| Gedankenstriche | „15:00 – 16:45 Uhr“, „Meldeschluss vorbei – …“, „Zahlung gemeldet – wartet …“, „… Zuordnung – danach …“ | Komma, Punkt oder „bis“ | Frontend-Logik | S | app.js:2376, 2408, 2347, 4411, 4386 |

### 02 Kalender

| Element | Ist | Soll | Art | Aufwand | Fundstelle |
|---|---|---|---|---|---|
| Titelzeile | „Kalender“ 22/800, darunter großer Knopf „+ Termin hinzufügen“ (`.kal-neu`, 48, Dunkelgrün) | „Kalender“ 26/800 links, rechts Textverweis „+ Termin“ 15/700 `--green-800`, min 44 (nur Trainer/Admin) | Frontend-Logik + Styling | S | app.js:1175, 1179; styles.css:502–509 |
| Segment | weiße Karte, Rand `--line`, Radius 14, Innenabstand 4, Abstand 4, Knopf 42; aktiv `--grad-chip-on` weiß | Spur `--bg-2`, Rand `--line-soft`, Radius 12, Innenabstand 3, Abstand 2; aktiv weiße Pille Radius 9 `--shadow-sm` 14/700 `--green-800`; inaktiv 14/600 `--muted`; Höhe 38 (`::after` 44 bleibt); Abstand oben 12 | Styling | S | styles.css:482–498 |
| Abo-Zeile | „Termine im Handy-Kalender?“ 15/700 `--ink`, Goldkachel 34 mit Symbol, „›“ grau, X sichtbar 26 | Karte min 52, Innenabstand 0 4 0 16; Linien-Kalendersymbol `--green-800` ohne Kachel; „Kalender abonnieren ›“ 15/600 `--green-800`; X als 44 × 44-Fläche rechts in der Zeile | Styling + Frontend-Logik (Text) | S | app.js:924–935; styles.css:520–555 |
| Abstand zwischen Karten | 16 (`.event-list`) | 12 | Styling | S | styles.css `.event-list` |
| Kopf Training | Dunkelgrün wie alle | `180deg --green-task-1 → --green-task-2`, Linie unten `--green-badge-line`; 3-px-Goldlinie nur beim nächsten Termin; Titel `--green-task-ink`, Zeit `--green-task-ink-2`; Würfel mit Rand `--gold-line` | Styling + Frontend-Logik (Klasse je Art, „ist nächster“) | M | app.js:2419; styles.css:564–568 |
| Kopf Spiel | 180deg `--green-800 → --green-900` | `158deg --green-800 → --green-900` | Styling | S | styles.css:126 |
| Kopf Sonstiges | Dunkelgrün | `--grad-task-gold`, Linie unten `--gold-line-2`; Würfel weiß mit Rand `--gold-line`; Titel `--gold-ink-2`, Zeile `--gold-ink` | Styling + Frontend-Logik | S | wie oben |
| Kopf Überzeile | Marke „HEIM“ Versal + Zeit oben | 13/700: Training „Nächster Termin · morgen“ (`--gold-ink`) bzw. nichts; Spiel „Spiel · Auswärts“ (`--gold-400`); Sonstiges „Sonstiges“ (`--gold-ink`) | Frontend-Logik | S | app.js:2410, 2424 |
| Kopf Titel / Zeit | Titel 19/800; Zeit über dem Titel 13/600 | Titel 21/800 −.02em; Zeit darunter 13/600: „19:30 bis 21:00 Uhr“, Spiel „13:30 Uhr · Treffen 12:45“ | Styling + Frontend-Logik (+ Schema für Treffen) | M | app.js:2408, 2425; styles.css:581, 592 |
| Kopf Innenabstand / Würfel | 12 14, Würfel 48 breit (10/22/9) | 12 12 14 14, Abstand 12; Würfel 48 × 56 Radius 10 (12/22/12) | Styling | S | styles.css:564–577 |
| Menü ··· | nur Trainer, 38 sichtbar + `::after` | 44 sichtbar für alle Rollen; Spiel `rgba(255,255,255,.12)` weiße Punkte, Training `rgba(255,255,255,.7)` dunkle Punkte | Styling + Frontend-Logik | S | app.js:2428; styles.css:599–604 |
| Menü-Inhalt | Termin bearbeiten, Zurücksetzen auf BFV-Daten, Termin löschen (nur `canManageSchedule`) | In Kalender speichern (alle), Bearbeiten, Absagen; dazu bleibend: Kader-Info teilen, Zurücksetzen auf BFV-Daten, Löschen (siehe Funktionen) | Frontend-Logik | M | app.js:2529–2555, 6120 |
| Ortszeile (Spiel) | eingelassenes Feld 60 | flache Zeile min 48, Abstand 8, Linie unten, „Route ›“ wie 01 | Styling | S | app.js:2434–2446 |
| Zu-/Absage | 46, Abstand 14, 16/800 | Innenabstand 12 16 16 (Training 14 16 16), Abstand 8, **44** hoch, 15/700; gewählt wie 01 („Zugesagt“) | Styling + Frontend-Logik | S | app.js:2451–2454 |
| Zusagenzeile | Trainer: großes Feld „ZUSAGEN … offen ›“ + Balken + Kacheln Aufstellung/Kader-Info | eine Zeile 13 `--muted`: links „1 zu · 0 ab · 15 offen ›“ (öffnet 04, nur Trainer), rechts „Meldeschluss in 21 h“ 600 `--red-700` **oder** bei Spielen „Elf steht ›“ / „Elf offen ›“ 600 `--gold-ink` (öffnet Aufstellung); kein Balken, keine Kacheln | Frontend-Logik + Styling | M | app.js:2463–2492 |
| Zusagenzeile Spieler | nur Meldeschluss-Zeile | rechts Meldeschluss, links nichts (Spieler sehen keine fremden Rückmeldungen, RLS) | Frontend-Logik | S | app.js:2450–2461 |
| „In Kalender speichern“ | Link in jeder Karte | ins Menü ··· | Frontend-Logik | S | app.js:2516 |
| Notiz `.tk-notiz` | 13/500 `--amber-600` | `--amber-ink` (Kontrast) | Styling | S | styles.css:691 |
| Marken Freundschaft / Abgesagt / manuell geändert | `.tag` Versal | Marke Satzschreibung (neutral bzw. rot) | Styling | S | app.js:2415–2417 |
| Kopf „Vergangene Termine“ | `.section-title` | `.group-head` | Styling | S | app.js:1185 |
| Leerzustand | `.empty` Text | `.empty`: Liniensymbol 24, Satz 15/600 | Styling | S | app.js:1183 |
| Gedankenstriche | „19:30 – 21:00 Uhr“, BFV-Hinweis, 8-€-Warnung | „bis“, Punkt | Frontend-Logik | S | app.js:2408, 2347 |

### 03 Termin anlegen (Blatt)

| Element | Ist | Soll | Art | Aufwand | Fundstelle |
|---|---|---|---|---|---|
| Behälter | mittiger Dialog `.modal` (Radius 16, Innenabstand 18) | Bottom-Sheet: Griff 36 × 5 `--dot-off`; weißer Kopf Radius 18 oben, Linie unten; Körper `--bg`, Innenabstand 16, Abstand 16 | Frontend-Logik + Styling | M | app.js:2654–2710; styles.css:879–891 |
| Titel / Schließen | „Termin anlegen“ 1.1rem, „×“ ohne Fläche `--muted` | 19/800 −.02em; Kreis 44 `--surface-6` mit Linien-X | Styling | S | app.js:2658–2659 |
| Terminart | `<select>` „Typ“ (Training vorgewählt) | drei Kacheln Spiel / Training / Sonstiges, min 56, Radius 12, Abstand 8, Farbstrich 22 × 6 (`--green-900`, `--green-450`, `--gold-500`); gewählt `--green-050`, Rand 1,5 `--green-700`, 14/700 `--green-800`; sonst weiß, Rand `--line-soft-3`, 14/600 | Frontend-Logik + Styling | M | app.js:2667–2673, 2726–2733 |
| Felder | einzelne Felder mit Label darüber 0.8rem, Rahmen je Feld | gruppierte Liste: weiße Karte Radius 14, Rand `--line-soft`; Zeilen min 52, Innenabstand 0 16, Linie dazwischen; Label links 76 breit 13/600 `--muted`; Wert 16/500 randlos (16 px bleibt) | Styling | M | app.js:2674–2691; styles.css:902–914 |
| Label-Texte | „Ort (vollständige Adresse)“, „Notiz für die Spieler (optional)“, Platzhalter „z. B. Sportanlage …“, „optional“ | „Ort“ (Platzhalter „Straße, Ort“), „Notiz“ (Platzhalter „Für die Spieler“) | Frontend-Logik | S | app.js:2688–2691 |
| Spielort | `<select>` Heimspiel/Auswärtsspiel | Segment Heim / Auswärts: Spur `--bg-2` Radius 10, Innenabstand 3; aktiv weiß Radius 8, 32 hoch, 14/700 `--green-800`; `::after` 44 | Frontend-Logik + Styling | S | app.js:2680–2681 |
| Titel-Feld | bei Training/Sonstiges „Titel“ | nicht gezeichnet (Spiel zeigt „Gegner“); bleibt für Training/Sonstiges als erste Zeile „Titel“ | Frontend-Logik | S | app.js:2674–2676 |
| Datum | `type=date`, „02.10.2026“ | Zeile „Datum“, Anzeige „So, 11. Okt 2026“ (natives Feld darunter, Anzeige formatiert) | Frontend-Logik | M | app.js:2683 |
| Beginn / Treffen | „Start“ und „Ende“ nebeneinander | Zeile „Anstoß“ (Training/Sonstiges: „Beginn“) 13:30, rechts „Treffen 12:45“ 13 `--muted`; **Treffen ist neu** | Frontend-Logik + Schema | M | app.js:2684–2687 |
| Ende | Feld „Ende“ | nicht gezeichnet; bleibt als eigene Zeile „Ende“ (Funktion) | Frontend-Logik | S | app.js:2686 |
| Wiederholung | `fieldset` mit Systemradios, „Wiederholen bis“ | Gruppenkopf „Wiederholung“ + Segment Einmalig / Wöchentlich (wie Kalender-Segment, 38); „Wiederholen bis“ als Listenzeile bei Wöchentlich; Fieldset-Rahmen entfällt | Frontend-Logik + Styling | M | app.js:2693–2699, 2734–2748; styles.css:919–923 |
| Zusammenfassung Serie | `.tf-summary` `--green-050` | bleibt, Stil wie `.kasse-sum` hell (`--green-050`, Rand `--green-badge-line`) | Styling | S | app.js:2700; styles.css:924 |
| Primärknopf | „Anlegen“ links, schmal | volle Breite, 48, `.btn-primary`; Text „Spiel anlegen“ / „Training anlegen“ / „Termin anlegen“ je Art | Frontend-Logik + Styling | S | app.js:2704 |
| Bearbeiten-Modus | Löschen, Fällt aus/Findet statt, Speichern nebeneinander | Primär „Speichern“ volle Breite; „Absagen“/„Findet statt“ als `.btn-soft`; „Löschen“ als `.btn-soft` mit roter Schrift (nicht gezeichnet) | Frontend-Logik + Styling | S | app.js:2701–2705 |
| BFV-Spiel (gesperrt) | Block „Heim – Gast“, Hinweis | bleibt; ohne Gedankenstrich, als erste Listenzeile mit Hinweis 13 `--muted` | Frontend-Logik | S | app.js:2661–2666 |
| Fehlerhinweis | `.modal-hint` 0.82rem grün | eine Zeile 13, `--red-700` direkt über dem Knopf | Styling | S | app.js:2706; styles.css:890 |
| Tastatur | Dialog scrollt in sich | Blatt endet über der Tastatur (`--kb`, wie `.ks-seite`) | Frontend-Logik | M | app.js `visualViewport`-Logik |

### 04 Rückmeldungen-Blatt

| Element | Ist | Soll | Art | Aufwand | Fundstelle |
|---|---|---|---|---|---|
| Griff | 34 × 4, `--line`, Rand oben 7 | 36 × 5, `--dot-off`, Innenabstand oben 8 | Styling | S | styles.css:1338 |
| Schließen | 36, `--bg`, Rand oben 3 | 44, `--surface-6`, Linien-X | Styling | S | styles.css:1344–1350 |
| Unterzeile | „So 4. Okt · TSV Beispielstadt · Frist Sa 15:00“, Abstand 5 | Abstand 4, Format „Di 6. Okt · Training · Frist Di 16:30“ (gleich) | Styling | S | app.js:1063–1072 |
| Balken | 7 hoch, nur Zusagen grün, Rand 16 16 0 | 6 hoch, Zusagen `--green-600` **und** Absagen `--red-600`, Spur `--track-sheet`, Innenabstand 14 16 0 | Frontend-Logik + Styling | S | app.js:1109–1110; styles.css:1352–1353 |
| Kacheln Beschriftung | „ZUGESAGT / ABGESAGT / OFFEN“ 9/800 | „Zu / Ab / Offen“ 12/700 Versal .06em `--muted` | Frontend-Logik + Styling | S | app.js:1112–1114; styles.css:1361 |
| Kacheln Werte | 16/800 `--green-700` alle | 21/800: Zu `--green-800`, Ab `--red-700`, gewählt `--amber-ink` | Styling | S | styles.css:1362 |
| Kacheln Maße | min 46, Innenabstand 10 10 0, Abstand 9, Rand `--line` | min 56, Innenabstand 8 12, mittig, Abstand 8, Rand `--line-soft-2`, Radius 12 | Styling | S | styles.css:1355–1360 |
| Gewählte Kachel | Rand 1 `--amber-600`, Schrift `--gold-ink` | Rand 1,5 `--amber-600`, `--amber-050`, Schrift `--amber-ink` | Styling | S | styles.css:1364–1365 |
| Namensraster | Zeile 44, Innenabstand 5, Abstand 6/10, Grund `--bg`, Kürzel 30 Radius 8 `--green-050` 11/800, Name 14/600 | Zeile 48, Innenabstand 0 10, Abstand 8/8, Grund `--surface-2`, Kürzel 32 Radius 9 `--grad-av` 12/800, Name 15/600, Abstand 10 | Styling | S | styles.css:1367–1381 |
| Absagegrund | 12/500 | 13 (Mindestgröße), bleibt | Styling | S | styles.css:1384 |
| Leere Gruppe | „niemand in dieser Gruppe“ 13 | `.empty`-Muster | Styling | S | app.js:1117 |
| Fuß, Rahmen | Linie oben, Innenabstand 10 16 0, Abstand 11 | Rand oben 16, Linie oben, Innenabstand 12 16 20, Abstand 10 | Styling | S | styles.css:1387 |
| Fuß, Knöpfe | „Alle N erinnern“ (`.rs2-btn` `--green-700` 15/800) öffnet Teilen-Text mit Namen; „Teilen“ (`.rs2-btn2`) öffnet Gesamtübersicht | Vorlage: „Alle 7 erinnern“ `.btn-primary` + „Teilen“ `.btn-soft` 16/700 Innenabstand 0 18. **Verbindlich (Nutzer):** drei Knöpfe, siehe Abschnitt 4 | Frontend-Logik + Styling + Abfrage | L | app.js:1118–1123, 1143–1149; styles.css:1388–1397 |
| Gedankenstrich im Teilen-Text | „Name – Grund“, leere Gruppe „–“ | „Name, Grund“ bzw. „niemand“ | Frontend-Logik | S | app.js:1082 |

---

### 2. Funktionen, die heute existieren und in der Vorlage fehlen

| Funktion | Heute | Vorschlag im Stil der Vorlage |
|---|---|---|
| Kader-Info teilen (fertiger Kadertext) | Kachel „Kader-Info“ in Hero und Spielkarte | Menü ··· von Hero und Spielkarte: „Kader-Info teilen“ (nur Trainer, nur Spiel). Kachel heißt künftig „Kader“ und führt zur Kaderansicht |
| In Kalender speichern (.ics je Termin) | Link in jeder Karte | erste Zeile im Menü ··· für **alle Rollen**; `openTkMenu` darf dafür nicht mehr bei Nicht-Trainern abbrechen |
| Termin bearbeiten, löschen, BFV zurücksetzen | Menü ··· | bleibt dort; dazu „Absagen“ / „Findet statt“ direkt im Menü (heute nur im Bearbeiten-Dialog) |
| BFV-Abweichung übernehmen | Hinweiszeile mit „übernehmen“ in der Karte | bleibt im Kartenkörper als Hinweis 13 `--gold-ink-2`, Verweis 15/600 ohne Unterstreichung, `::after` 44 |
| 8-€-Warnung nach Meldeschluss | `.tk-warn` rot | bleibt unter Zu-/Absage (Hinweisregel: Folge nicht sichtbar) |
| Absagegrund eigener Absage | `.tk-grund` | bleibt, 13 `--red-700` unter den Knöpfen |
| Notiz zum Termin | `.tk-notiz` | bleibt, 13 `--amber-ink` |
| Marken Freundschaft / Abgesagt / manuell geändert, roter Kopf bei Absage | im Kopf | bleiben als Satzschreibung-Marken in der Überzeile; abgesagt: Kopf `--grad-chip-red`, Titel durchgestrichen |
| Push-Hinweis „Nichts mehr verpassen?“ | Kachel auf der Übersicht | bleibt über dem Hero, im Aufbau der Abo-Zeile aus 02 (min 52, Liniensymbol, Text 15/600 `--green-800` mit „›“, X 44) |
| Abo-Hinweis bedingt (nach erster Rückmeldung, unter der Karte) | `aboHinweisPlatz` | Logik bleibt, nur neues Aussehen |
| Mannschaftskasse (offene Summe, Sprung zur Kasse) und „Meine Strafen“ ohne Verknüpfung | Geldzeilen unter dem Konto | Listenzeile in einer Karte unter dem Kontobanner: „Mannschaftskasse“ 16/700, Nebenzeile „offen“, Betrag rechts `--red-600`, „›“ (nur Trainer/Kasse). Alternativ in Mehr › Kasse; Entscheidung des Nutzers |
| Karte „Nächstes Spiel“ auf der Übersicht | zweite Terminkarte mit Zu-/Absage, Rückmeldungen, Aufstellung | Vorlage zeigt das Spiel als Danach-Zeile. Vorschlag: Karte entfällt, Danach-Zeile führt zur Karte im Kalender (`data-nav-event` vorhanden), Aufstellung bleibt über „Elf aufstellen“. Nutzer muss zustimmen, sonst bleibt die Karte unter „Danach“ |
| Status-Datum und -Notiz („voraussichtlich bis“, „Notiz“) | Felder unter den Statusknöpfen | bleiben als gruppierte Liste unter dem Raster (Label links 13/600) |
| Mahnzuschlag im Kontobanner („inkl. 2,00 € Mahnzuschlag“) | `.mb-note` | Hinweis 13 `--muted` unter der Unterzeile (Folge nicht sichtbar). README streicht `.mb-note` nur für den Gemeldet-Satz |
| Kontobanner ohne Verknüpfung / schuldenfrei | eigene Zustände | bleiben; Text ohne Gedankenstrich |
| Ende-Zeit, Titel bei Training/Sonstiges, „Wiederholen bis“, Serienzusammenfassung, Serien-Rückfrage | Termin-Dialog | als weitere Listenzeilen bzw. heller Kasten im Blatt, siehe 03 |
| Rückmeldungen nach Zu / Ab filtern (Kacheln antippbar) | `data-rsfilter` | bleibt, nur Stil |
| Gesamtübersicht teilen (Zugesagt, Abgesagt, Offen) | Knopf „Teilen“ | Knopf „Übersicht teilen“ (Abschnitt 4) |
| Rollenvorschau „Ansicht als …“ | Admin | bleibt; Push-Knopf in der Vorschau ausblenden (Server prüft die echte Rolle) |

### 3. Änderungen mit Schema oder Backend

1. **Treffen-Zeit (Schema, neu):** Spalte `events.treffen time null` (Migration 0058, ein `do`-Block mit Gegenprobe). Dazu `db.js:78` (Mapping `treffen`), `terminRow` app.js:2810, `saveTerminEdit` app.js:2835, `saveBfvEdit` app.js:2859 (Zusatzfeld wie `ende`), Anzeige Kalenderkopf. Prüfen: Kalender-Feed-Trigger aus 0020 (Zeile 29–32) und Text der .ics-Beschreibung, falls Treffen dort erscheinen soll; `termin_geaendert` darf durch Treffen nicht auslösen, wenn nicht gewollt. Ohne Freigabe entfällt „Treffen“ in 02 und 03.
2. **Push senden (Backend vorhanden):** RPC `send_rsvp_reminder(p_event uuid, p_nur_zaehlen boolean)` aus Migration 0050 ist live, `grant` an `authenticated` gesetzt. Neu nur im Frontend: `DB.sendRsvpReminder(eventId, nurZaehlen)` in db.js (Muster `client.rpc`, db.js:145ff.). Keine Schemaänderung.
3. Sonst **keine**: relativer Tag, „Elf steht/offen“, „15 fit“, Terminart-Farben und Anzahl offener Aufstellungen kommen aus geladenen Daten.

### 4. Verbindliche Vorgaben des Nutzers, die von der Vorlage abweichen

| Vorgabe | Vorlage | Umsetzung |
|---|---|---|
| Rückmeldungen-Blatt mit **drei** Knöpfen | „Alle 7 erinnern“ (Primär) + „Teilen“ | Oben „Push senden“ `.btn-primary` volle Breite 48; darunter zwei `.btn-soft` je 1fr, 48: „Teilen“ (= heutiger `erinnernText()`, wörtlich) und „Übersicht teilen“ (= heutiger `rueckmeldeText()`). Ohne Offene: „Push senden“ und „Teilen“ entfallen, „Übersicht teilen“ volle Breite. Fuß wird höher (ca. 48 + 8 + 48), Namensliste scrollt (`.rs2-liste` bleibt flex) |
| Ablauf „Push senden“ | – | Beim Öffnen des Blatts `send_rsvp_reminder(id, true)`; Knopf erst nach Antwort aktiv. Tipp → Bestätigung (Dialog `.modal-sm`): „An N Spieler senden?“, darunter eine Zeile je Wert > 0: „X ohne Push-Abo“, „Y ohne Konto“, „Z haben Erinnerungen abgeschaltet“, „W im Urlaub oder verletzt, ausgenommen“; Knöpfe „Senden“ (Primär), „Abbrechen“. Danach `(id, false)` und Meldung „An 3 gesendet · 2 ohne Push-Abo“; bei `in_ruhezeit > 0` zusätzlich „1 in der Ruhezeit, Zustellung ab HH:MM“ (`zustellung_ab`). Bei `gesendet = 0` ehrliche Meldung statt Erfolg |
| 12-h-Sperre sichtbar | – | `gesperrt = true`: Knopf gesperrt (Fläche `--line`, Schrift `--muted-2`, nie hellgrün) mit Text „Push gesendet“ und Hinweis 13 darunter „Erinnert um 18:04 · wieder ab 06:04“ aus `letzte` und `naechste_moeglich`. Nach Terminbeginn kein Push |
| Wer sieht Push | – | nur echte Rolle Trainer oder Admin (`Roles.isRealAdmin()` bzw. echte Coach-Rolle), nicht in der Rollenvorschau; Fehler 42501 als Meldung „Keine Berechtigung“ |
| Bottom-Nav Übersicht, Kalender, Katalog, Konto + rollenabhängiger 5. Tab | zeigt fünften Tab „Mehr“ (Admin) | stimmt überein; 5. Tab bleibt rollenabhängig (Mehr / Trainer / Kasse / Profil, app.js:7044–7058); Mehr-Blatt unverändert (05 gestrichen) |
| Trefferflächen ≥ 44 | Spielort-Segment 32, Kalender-Segment 38, Textverweise 13–15 px („1 zu · 0 ab · 15 offen ›“, „Elf steht ›“, „Alle Strafen ›“, „Kalender ›“, „+ Termin“) | jeweils `::after` mit `--tap`; die beiden Verweise der Kalender-Zusagenzeile je eigene Fläche 44 hoch, ohne Überlappung; Kalender-Zu-/Absage genau 44 |
| Kontrast ≥ 4,5:1 | Zähler „Zahlungen bestätigen“ weiß auf `--grad-edge-red` (oben 4,0:1 laut styles.css:2503) | `--grad-chip-red` behalten |
| Kontrast | Zähler „Elf aufstellen“ `--gold-ink-2` auf `--grad-edge-gold` | vor Übernahme messen; sonst heutiges `--grad-chip-gold` mit Weiß |
| Kontrast | Segment inaktiv `--muted` auf `--bg-2` | nur mit neuem `--muted` `#5c6a63` (4,7:1); Token-Schritt zuerst |
| Kontrast | gesperrter Knopf `--muted` auf `--line` | `--muted-2` verwenden, messen |
| Kontrast | „Pal“ in `--pp-cyan` `#009cde` auf Weiß (ca. 3:1) | Markenzeichen, heute schon so; als Ausnahme festhalten oder `--pp-blue` |
| Kontrast | `.tk-notiz` `--amber-600` auf Weiß | `--amber-ink` |
| Keine Gedankenstriche | Vorlage nutzt „bis“; App heute „–“ an 7 Stellen | app.js:1082, 2347, 2376, 2408, 2663, 4386, 4411 umstellen |
| Keine ASCII-Umlaute | Vorlage sauber | neue Texte („Übersicht teilen“, „Push gesendet“, Bestätigung) mit echten Umlauten; Kommentare im Code unberührt |
| Keine Funktion fällt weg | Vorlage zeigt weniger | siehe Abschnitt 2; offen bleiben zur Entscheidung: Karte „Nächstes Spiel“, Platz der Mannschaftskasse, Treffen-Spalte |
| Statusfarbe Urlaub | Vorlage Blau (`--blau-*`) | App heute Grau (`--grad-urlaub` aus `--muted`, conventions „kein eigenes Bunt“); Vorlage ersetzt das, Tokens fehlen und kommen neu |

---

## Delta B · Trainer und Kader (06, 07, 07b, 07c, 08, 09, 10)

Stand: 06.10.2026, nur gelesen. Kein Code und keine Datenbank geändert.

Quellen Soll: `PAKET-README.md` (Design-Tokens, Bausteine, Abschnitt B, „Wo Funktionen jetzt liegen“), `referenz/Final B Trainer und Kader.dc.html`, `soll/06 … 10 *.png/.json` (Maße in CSS-px bei 390 px, x/y ab Rahmenkante 1 px).
Quellen Ist: `app.js` (Trainer-Ansicht `tvViewGames` ab Z. 3611, Platz `tvViewLineup` ab Z. 3832, Blätter `tvEnsurePanels` ab Z. 4057, Kader `renderKader` Z. 720), `styles.css` (Trainer Z. 1887 bis 2260, Feld-Nachtrag Z. 3031 bis 3045, Kader Z. 2862 ff.), `db.js` Z. 117 bis 147, Migration `supabase/migrations/0012_lineups.sql`, Aufnahmen `landkarte/bilder/trainer/trainer.png`, `trainer__spiel.png`, `trainer__spiel--tvSheetKader.png`, `admin/kader.png`.

Abkürzungen Art: **St** Styling, **FL** Frontend-Logik, **Ab** Abfrage, **Sc** Schema, **Be** Backend.
Zeilennummern beziehen sich auf den Stand von Commit `035d3fc`.

### 0. Voraussetzungen aus den globalen Schritten (Reihenfolge 1 bis 5 im README)

Abschnitt B setzt diese Tokens und Bausteine voraus. Fehlen sie, muss B sie mitbringen.

| Element | Ist | Soll | Art | Aufwand | Fundstelle |
|---|---|---|---|---|---|
| `--muted` | `#66756d` | `#5c6a63` | St | S | styles.css Z. 65 |
| `--grad-btn` | `--green-550 → --green-650` | `--green-600 → --green-700` (Soll-JSON: `rgb(35,122,82) → rgb(27,94,63)`) | St | S | styles.css Z. 105 |
| `--h-btn` | 46 px, `--h-btn-lg` 48 | 48 px, `--h-btn-lg` Alias | St | S | styles.css Z. 175 f. |
| `--amber-ink`, `--amber-line` | fehlen | `#8a5a08`, `#ecd3a6` | St | S | styles.css `:root` |
| `--blau-050`, `--blau-700`, `--blau-line` | **fehlen** (README nennt sie „unverändert“, sind aber nicht definiert) | `#e7f0f7`, `#1d5a8a`, Rand `#c3dbea` (aus 09-JSON), Punkt `#2e7bb5` (aus 10-JSON) | St | S | styles.css `:root` |
| `--pitch-green-2` | fehlt | `#2a7541` (zweiter Rasenstreifen) | St | S | styles.css Z. 28 |
| `--fs-titel/-kpi/-zeile/-neben/-etikett`, `--sp-1…6` | fehlen | 26/800, 21/800, 16/700, 13/500, 12/700 Versal .06em; 4 8 12 16 24 32 | St | S | styles.css `:root` |
| `.group-head` | fehlt; heute `.section-title.sec-mini` 11/800 .08em | 12/700 Versal, ls .06em (0,72 px), `--muted`, 24 darüber, 8 darunter; rechts `.link-btn` 15/600 `--green-800` ohne Unterstreichung | St | S | styles.css Z. 1987 bis 2000 |
| `.btn-primary` | `--green-800` flach | `--grad-btn`, 16/700 weiß, 48 hoch, Radius 12, `--shadow-btn`; gesperrt `--line`/`--muted` | St | S | styles.css Z. 875 |
| `.btn-soft` | vorhanden, abweichend | `--grad-btn-sec`, Rand 1 px `--line-soft-3` (JSON `rgba(16,40,30,.14)`), 16/700 `--ink`, 48 hoch (Soll-JSON Blätter: 50) | St | S | styles.css |
| „+“-Knopf (neu) | fehlt | rund 36 × 36 (Soll-JSON 38 × 38), Rand 1,5 px `--line-soft-3`, „+“ 20/600 `--green-800`, `::after` 44 px | St | S | neu |
| Marke `.badge`/Plakette | `.tv-tag` 10/800 mit Sperrung, `.st-badge` .68rem | Pille 12/700 Satzschreibung, Innenabstand 3 10, Höhe 21; Farben je Bedeutung (s. Tabellen) | St | S | styles.css Z. 2191 bis 2198, Z. 839 |
| `.avatar` | 32 px, Grund `--green-700`, Schrift `--gold-500` 12/700 | 36 px, `--grad-av`, Initialen 13/800 `--green-800` | St | S | styles.css Z. 1511. Achtung: global benutzt, Wirkung in Kasse/Rollen prüfen |

---

### 1. Screens

### 06 Trainer · Spielauswahl

| Element | Ist | Soll | Art | Aufwand | Fundstelle |
|---|---|---|---|---|---|
| Seitentitel | `h1` „Trainer“ 1.4rem/800 | 26/800, ls −0,52 px, `--ink`, y 79 | St | S | app.js Z. 3617; styles.css Z. 379 |
| Begleitsatz | „Spiel wählen, danach baust du die Elf auf dem Platz.“ | entfällt (`.page-head p` entfällt überall) | FL | S | app.js Z. 3618 |
| Spielkarte, Rahmen | weiße `.card.tv-next`, Radius 14 | Karte 358 × 259, Radius 16, Rand 1 px `rgba(16,40,30,.1)`, Schatten `0 18px 34px -18px rgba(11,49,37,.55)` | St | S | styles.css Z. 1887 |
| Spielkarte, Kopf | weiß, Etikett „NÄCHSTES SPIEL“ 11/800 Versal, Plakette „Heim/Auswärts“ rechts | **dunkler Kopf** 356 × 98, `linear-gradient(158deg, --green-750 0%, --green-900 55%, --green-950 100%)`, Radius 15 oben, unten 3-px-Goldlinie `linear-gradient(90deg, --gold-400, #c39a22)` | St + FL (Markup) | M | app.js Z. 3655 bis 3663; styles.css Z. 1890 bis 1905 |
| Spielkarte, Eyebrow | Etikett + getrennte Plakette | eine Zeile „Nächstes Spiel · Auswärts“ 13/700 `--gold-400` (#e3c25c), Heim/Auswärts wandert in den Text | FL | S | app.js Z. 3656 f. |
| Datum | Tag 22/800 + Monat 9/700 ohne Kachel | **Goldwürfel** 56 × 66, Radius 12, `--grad-gold` (#fdf6e4 → #f6ebcd), Schatten `0 6px 14px -6px rgba(0,0,0,.5)`; Wochentag „So“ 12/700 `--gold-ink`, Tag 26/800 `--green-800`, Monat „OKT“ 12/700 Versal `--gold-ink` | St + FL | S | app.js Z. 3660; styles.css Z. 1908 bis 1913 |
| Gegner | 20/800 `--ink` | 22/800 weiß, ls −0,44 px, Ellipse | St | S | styles.css Z. 1915 |
| Zeitzeile | „15:00 Uhr · Anpfiff in 2 Tagen“ 13/500 `--muted` | „13:30 Uhr · in 6 Tagen“ 14/600 `rgba(255,255,255,.85)` | St + FL (Text „Anpfiff“ entfällt) | S | app.js Z. 3638 bis 3643 (`anpfiffText`), Z. 3653 |
| Rückmeldungen | drei Kennzahlspalten Zugesagt/Abgesagt/Offen (18/800, Etikett 9/800) | **eine Zeile**: Titel „Rückmeldungen“ 13/700 `--ink`; Balken 304 × 6, Spur `#cfd8d2`, Zusagen `--green-600`, Absagen `--red-600` (wie 04); darunter „**1** zu · **0** ab · **15** offen“ 13 `--muted`, Zahlen 13/700 `--ink`; rechts „›“ 20 `--green-chev`. Ganze Zeile öffnet das Rückmeldungen-Blatt | St + FL | M | app.js Z. 3664 bis 3668; Blatt existiert: `openRsvpSheet(eventId)` Z. 1126 |
| „Elf aufstellen“ | `.tv-next-btn` flach `--green-700`, 15/800, Radius 14 | `.btn-primary` 324 × 48, Radius 12, `--grad-btn`; `.tv-next-btn` entfällt | St | S | app.js Z. 3669; styles.css Z. 1946 bis 1952 |
| Kaderkarte, Rahmen | 358 × 129, Innenrand 16 | 358 × 92, Radius 14, Innenrand 16 | St | S | styles.css Z. 1957 bis 1960 |
| Kaderkarte, Kopf | „Kader“ 15/800; „16 Spieler“ 13/500 grau + Pfeil | „Kader“ 16/700; „16 Spieler ›“ als Textverweis 15/600 `--green-800` | St | S | app.js Z. 3700 bis 3703; styles.css Z. 1961 bis 1966 |
| Kaderbalken | 7 hoch, Urlaub `--dot-off` grau | 6 hoch (324 breit), Spur `#cfd8d2`, Fit `--green-600`, Angeschlagen `--amber-600`, Verletzt `--red-600`, **Urlaub blau** (`--blau-500`/#2e7bb5) | St | S | styles.css Z. 1968 bis 1973 |
| Kaderlegende | Raster 2 × 2 mit Punkten, immer alle vier Werte | eine Zeile ohne Punkte, nur Werte > 0: „**15** fit · **1** verletzt“ 13 `--muted`, Zahl 13/700 `--ink`, Verletzt-Zahl `--red-700` | St + FL | S | app.js Z. 3695 bis 3697 (`tvKaderKarteHtml`); styles.css Z. 1975 bis 1983 |
| Gruppenkopf „Weitere Spiele“ | `.section-title.sec-mini` 11/800 | `.group-head` 12/700, rechts „Alle ›“ 15/600 `--green-800` | St | S | app.js Z. 3626 bis 3629 |
| Spielzeile, Höhe | 60 px, Innenabstand 0 14 | 69 px, Karte 358 breit, Trennlinie 1 px `--line` (#e2e8e4) | St | S | styles.css Z. 2004 bis 2009 |
| Spielzeile, Strich | fehlt | Farbstrich 4 × 36, Radius voll, `--green-900` (Spiel), 6 px vom Rand, 16 oben/unten | St + FL | S | app.js Z. 3716 |
| Spielzeile, Datum | Tag 19/800 + Monat 10/700 grau, ohne Kachel | Goldwürfel 42 × 56, Radius 9: Wochentag 12/700 `--gold-ink`, Tag 19/800 `--green-800`, Monat 12/700 Versal `--gold-ink` | St + FL (Wochentag ergänzen) | S | app.js Z. 3717 f.; styles.css Z. 2010 bis 2012 |
| Spielzeile, Text | Gegner 15/700; „12:30 · Heim“ | Gegner 16/700; „12:30 Uhr · Heim“ 13 `--muted` | St + FL | S | app.js Z. 3719 f. |
| Spielzeile, Marke | „Elf steht“ grün / „offen“ neutral mit Rand, Höhe 28 | „Elf steht“ `--green-badge-bg` (#e6f2ea) / `--green-800`; „**Elf offen**“ `--amber-050` / `--amber-ink`; 12/700, Höhe 21 | St + FL (Text) | S | app.js Z. 3721; styles.css Z. 2017 bis 2023 |
| Spielzeile, Pfeil | „›“ `--dot-off` 18/700 | „›“ 18/400 `--green-chev` (#4c7a64, 4,9:1) | St | S | styles.css Z. 2024 |
| Gruppenkopf „Vorlagen“ | „Neu ›“ | „+ Neu“ 15/600 `--green-800` (Verhalten bleibt: führt ins nächste Spiel mit Hinweis) | FL | S | app.js Z. 3736 bis 3738 |
| Vorlagenzeile | Name 15/700, „geändert am 20. Sep“, rechts Formationsplakette gold + Papierkorb | Höhe 61; Name 16/700; Nebenzeile „4-3-3 · geändert 17. Sep“ 13 `--muted` (Formation in die Nebenzeile, „am“ entfällt); rechts **Menü ···** (44 px) | St + FL | S | app.js Z. 3745 bis 3758; styles.css Z. 2031 bis 2045 |
| Vorlage löschen | Papierkorb direkt, `confirm` | im Menü ··· „Vorlage löschen“, dann bestehende Rückfrage | FL | M (kleines Menü-Blatt oder Wiederverwendung von `tvSheetMenu`) | app.js Z. 3749, Z. 3769 bis 3775, Z. 4275 |
| Leerzustände | „Kein anstehendes Spiel …“, „Noch keine Vorlage. Speichere …“ in `.card-pad` | Muster `.empty`: Liniensymbol 24, ein Satz 15/600 | St | S | app.js Z. 3620, Z. 3741 bis 3744 |
| 5. Tab | „Trainer“ (Spielfeld-Symbol) für reine Trainer, „Mehr“ für Admin | Bild zeigt „Mehr“ aktiv (Admin-Sicht). Rollenlogik bleibt, siehe Abschnitt 5 | keine | S | app.js Z. 7038 bis 7064 |

### 07 Platz und Bank

| Element | Ist | Soll | Art | Aufwand | Fundstelle |
|---|---|---|---|---|---|
| Unterkopf | 14 16 Innenabstand, weiß, Linie unten | 390 × 57 weiß; Zurück links (Trefferfläche 44), Menü ··· rechts (44) | St | S | app.js Z. 3839 bis 3844; styles.css Z. 2061 bis 2063 |
| Titel | „vs. “/„@ “ + Gegner, 15/700 | „vs. FC Teutonia Mün. 2“ 16/700. Soll schreibt auch bei Auswärtsspiel „vs.“ (07b „vs. SV Am Hart Mün.“ ist laut 06 auswärts) | St + FL | S | app.js Z. 3841 |
| Unterzeile | „4. Okt · 15:00 · 4-4-2 · 11/11“ 11,5/500 | „So 11. Okt · 13:30 · 11 von 11“ 13/400 `--muted`: Wochentag dazu, Formation entfällt (steht in den Chips), „n von 11“ | St + FL | S | app.js Z. 3842; styles.css Z. 2066 |
| Formationschips | Höhe 33, Radius `--radius-btn`, 12/700, inaktiv `--muted`; aktiv `--grad-chip-on` | Pille Höhe 38, Radius voll; aktiv `--grad-btn`, weiß 14/700; inaktiv `--grad-chip`, Rand 1 px `rgba(16,40,30,.12)`, 14/600 `--ink`; Abstand 8; `::after` 44 bleibt | St | S | styles.css Z. 2067 bis 2075 |
| „Weitere“ | „Weitere ›“, Strichlinie, `--card` | „Weitere“ als normaler Chip, ohne Strichlinie, ohne „›“ | St + FL | S | app.js Z. 3830; styles.css Z. 2076 |
| Spielfeld, Fläche | SVG `viewBox 68×105`, `aspect-ratio 68/95` (≈ 358 × 500), Overlay-Streifen 9,09 % plus zwei Radialverläufe | 358 × **440** fest, Radius 14; Streifen `repeating-linear-gradient(--pitch-green 0 44px, #2a7541 44px 88px)`; Radialverläufe entfallen | St | M | app.js Z. 3812 bis 3814 (`tvPitchBg`); styles.css Z. 2083 bis 2086, Z. 3031 bis 3043 |
| Spielfeld, Linien | Strich 0,3 `rgba(255,255,255,.3)`, Mittelpunkt | 1 px `rgba(255,255,255,.35)`; Außenlinie 10 px eingerückt, Radius 4; Mittelkreis 92; Strafräume 172 × 71 | St | S | app.js Z. 3813 |
| Spielerscheibe | 34 px, Nummer 13/800 | **40 px**, `linear-gradient(#fff, #eef3f0)`, Nummer 15/800 `--green-800`, `--shadow-disc` bleibt | St | S | styles.css Z. 2092 f., Z. 3045 |
| Spielername | 10/700, max. 52 px, Textschatten | 13/700 weiß, darunter (Kontrast 5,1:1 auf #2e7d46, 5,7:1 auf #2a7541); Breite muss bei vier Spielern pro Reihe auf ca. 80 px begrenzt bleiben (Ellipse) | St | S | styles.css Z. 2098 |
| Bank, Kopf | „Bank“ .95rem/700 + „1/7“ rechts grau | `.group-head` „Bank · 1 von 7“, rechts Textverweis „Spieler wählen ›“ (öffnet 08) | St + FL | S | app.js Z. 3863; styles.css Z. 2213 bis 2216 |
| Bank, Raster | 7 Plätze in einer Reihe (`flex`), gestrichelt | **4er-Raster**, Abstand 8, Platz 84 × 56 (README 54), Radius 12, Rand 1 px `rgba(16,40,30,.12)` durchgehend | St | S | styles.css Z. 2217 bis 2225 |
| Bank, freier Platz | „+“ 16/700 über „frei“ 9/600 | eine Zeile „+ frei“ 13/600 `--muted` auf `#f8fbf9`, ohne Strichlinie | St + FL | S | app.js Z. 3876 f.; styles.css Z. 2227, Z. 2232 |
| Bank, belegter Platz | Nummer 13/800, Name 9/600 grau, Kreuz „×“ oben rechts (13 px, Fläche ca. 20 px) | Nummer 15/700 `--green-800`, Name 13/400 `--ink`, Fläche `linear-gradient(#fff, #f8fbf9)`. **Kein Kreuz im Bild**, siehe Abschnitt 3 | St + FL | S | app.js Z. 3869 bis 3874; styles.css Z. 2126 bis 2131, Z. 2228 bis 2231 |
| Speichern | `.tv-primary` 54 hoch, „Aufstellung speichern“ + „11/11 gesetzt“ klein | nicht im Bild (Bild endet an der Nav). README: `.tv-primary` wird `.btn-primary`. Bleibt als Primärknopf 48 unter der Bank, ohne Zusatzzeile (Zahl steht im Unterkopf) | St + FL | S | app.js Z. 3852; styles.css Z. 2116 bis 2118 |
| Markieren zum Tauschen | goldener Ring 3 px `--gold-500` + Skalierung 1,08 | nicht in der Vorlage. Muss sich vom Gold der freien Position (07b) unterscheiden, Vorschlag weißer Ring 3 px plus Skalierung | St | S | styles.css Z. 2094, Z. 2124 |
| Übernehmen-Overlay | „Vom letzten Spiel übernehmen“, Primär „Übernehmen &amp; anpassen“, „Leer starten“ | nicht in der Vorlage, bleibt. Knopf auf `.btn-primary`, „Leer starten“ als `.btn-soft` auf dunklem Grund prüfen | St | S | app.js Z. 3855 bis 3859; styles.css Z. 2100 bis 2113 |
| Nur ansehen | „Vergangenes Spiel – nur ansehen, nicht bearbeiten“ | bleibt, Text ohne Gedankenstrich: „Vergangenes Spiel. Nur ansehen.“ | FL | S | app.js Z. 3851 |

### 07b Platz · Position frei (neu)

| Element | Ist | Soll | Art | Aufwand | Fundstelle |
|---|---|---|---|---|---|
| Zähler im Unterkopf | „10/11“ grau im Fließtext | „**10 von 11**“ 13/700 `--gold-ink` (#7a5a0c, 6,4:1), nur wenn < 11 | St + FL | S | app.js Z. 3842 |
| Hinweiszeile (neu) | fehlt | über dem Platz, 358 × 46, Radius 12, `--grad-task-gold` (#fdf6e4 → #f8eed3), Rand 1 px `--gold-line-2` (#e8d9a8); Punkt 8 px `#c39a22`; Text 14/600 `--gold-ink-2` (#6b4e0a, 7,2:1); rechts „Besetzen ›“ 14/700. Ganze Zeile ist Knopf | St + FL | M | neu in `tvViewLineup`, app.js Z. 3845 f. |
| Hinweistext, eine frei | fehlt | „1 Position frei: Linksverteidiger“ + „Besetzen ›“ | FL | S | neu |
| Hinweistext, mehrere frei | fehlt | „3 Positionen frei“ + „Nächste besetzen ›“; das Blatt 07c läuft der Reihe nach durch alle freien Positionen | FL | M | neu (Warteschlange, z. B. `tv.fillQueue`) |
| Langname der Position | fehlt; Blatt zeigt nur Rolle („Spieler für AV“) | Zuordnung Slot-Key → Langname nötig: TW Torwart, LV Linksverteidiger, RV Rechtsverteidiger, LIV/RIV/CIV Innenverteidiger links/rechts/zentral, LWB/RWB Linker/Rechter Schienenspieler, DM/LDM/RDM Defensives Mittelfeld, ZM/LZM/RZM Zentrales Mittelfeld, LM/RM Linkes/Rechtes Mittelfeld, OM/LOM/ZOM/ROM Offensives Mittelfeld, LA/RA Links-/Rechtsaußen, ST/LST/RST Stürmer. Begriffe vom Nutzer bestätigen lassen | FL | S | neu neben `FORMATIONS`, app.js Z. 3085 |
| Freie Position auf dem Feld | Scheibe 34 px `--green-900`, Rand 2 px gestrichelt `rgba(255,255,255,.5)`, Rollenkürzel „AV“ 10/800 | **Ring 44 px** (JSON 48 inkl. Rand), Rand 2 px `--gold-400`, Fläche `rgba(227,194,92,.22)`, Halo 6 px, „+“ 22/600 weiß | St + FL | S | app.js Z. 3821; styles.css Z. 2092, Z. 2095 |
| Beschriftung freie Position | keine (nur Kürzel in der Scheibe) | „LV frei“ 13/700 `--gold-400` unter dem Ring. **Kontrast nur 2,9:1 auf #2e7d46**, Abweichung siehe Abschnitt 5 | St + FL | S | app.js Z. 3822 |
| Wann sichtbar | entfällt | Vorschlag: Hinweis bei 1 bis 10 gesetzten Spielern. Bei 0 steht das Übernehmen-Overlay bzw. das leere Feld; Hinweis „11 Positionen frei“ wäre Lärm. Entscheidung durch Nutzer | FL | S | app.js Z. 3847 |

### 07c Blatt · Spieler für die Position (neu, ersetzt `tvSheetKader` im Positionsmodus)

| Element | Ist | Soll | Art | Aufwand | Fundstelle |
|---|---|---|---|---|---|
| Blattform | **Vollbild** (`.tv-kfull`, top 0, Radius 0) | Bottom-Sheet, Radius 18 oben, Griff 36 × 5 `#c6d2cb`, Höhe nach Inhalt (Bild 696) | St | S | styles.css Z. 2156, Z. 2257 |
| Titel | „Spieler für AV“ 16/700 | Langname „Linksverteidiger“ 19/800, ls −0,38 px | St + FL | S | app.js Z. 4147 |
| Unterzeile | „Passenden Spieler antippen“ | „Position frei · 3 Zugesagte passen“ 13 `--muted` (Zahl = Gruppe 1) | FL | S | app.js Z. 4148 |
| Schließen | 44 × 44 rund `--bg` | 44 × 44 rund `#eef3f0` (gleich) | keine | S | styles.css Z. 2162 |
| Gruppierung | nach Mannschaftsteil (Tor, Abwehr, Mittelfeld, Angriff), Sprung zur Gruppe der Rolle | **nach Eignung**: „Passt zur Position“, „Weitere Zugesagte“, „Nicht verfügbar“ (`.group-head`) | FL | M | app.js Z. 4195 bis 4217 (`tvRenderKaderBody`) |
| Regel „Passt“ | `lbAffRank` existiert, wird nur zum Sortieren genutzt | zugesagt, nicht verletzt/Urlaub, nicht auf Feld oder Bank, `lbAffRank(p.pos, slot.role)` 0 oder 1 (Bild: für AV passen AV, AV, IV; ZM steht unter „Weitere“) | FL | S | app.js Z. 3154 bis 3156 |
| Regel „Weitere Zugesagte“ | – | übrige Zugesagte; Bankspieler mit Marke „Auf der Bank“ statt „+“ | FL | S | neu |
| Regel „Nicht verfügbar“ | Zeilen rosa/grau getönt, Marke „verletzt“, „Urlaub“ grau | Marke „Verletzt“ (`--red-050`/`--red-700`), „Urlaub“ (`--blau-050`/`--blau-700`); keine Tönung | St + FL | S | app.js Z. 4209 f.; styles.css Z. 2186 bis 2198 |
| Abgesagt, ohne Rückmeldung | Marke „abgesagt“ bzw. „o. Rückm.“, antippbar | **in der Vorlage nicht vorgesehen**. Vorschlag siehe Abschnitt 3 | FL | S | app.js Z. 3570 bis 3578 (`tvAvail`) |
| Liste | jede Zeile eigene Karte 48 hoch, Abstand 8, Nummernkreis 30 | **eine Karte** je Gruppe, Radius 14, Rand 1 px `rgba(16,40,30,.1)`, Zeilen 57 hoch mit Trennlinie `#e2e8e4` | St | S | styles.css Z. 2184 bis 2185 |
| Zeile | Nummernkreis, Name 14/700, Position 11 | Avatar 36 (Initialen 13/800), Name 16/700, Nebenzeile „AV · zugesagt“ 13 `--muted` | St + FL | S | app.js Z. 4211 f.; styles.css Z. 2187 bis 2190 |
| Rechts | Marke „verfügbar“/„vergeben“/Status; ganze Zeile antippbar | „+“-Knopf 38 × 38 (Trefferfläche 44) **oder** Marke (Auf der Bank, Verletzt, Urlaub) | St + FL | S | app.js Z. 4210 f., Z. 4262 |
| Fuß | nur bei belegter Position „Position „AV“ leeren“ rot | Sekundärknopf „Position leer lassen“ 358 × 50, Radius 12, 16/700 `--ink`: schließt bzw. springt zur nächsten freien Position | St + FL | S | app.js Z. 4200, Z. 4260 |
| Wischen zum Schließen | vorhanden (Vollbild) | bleibt, auf Sheet-Höhe anpassen | FL | S | app.js Z. 4071 bis 4090 |

### 08 Blatt · Spieler für die Bank

| Element | Ist | Soll | Art | Aufwand | Fundstelle |
|---|---|---|---|---|---|
| Blattform | Vollbild `.tv-kfull` | Bottom-Sheet, Radius 18, Griff, Bild 587 hoch | St | S | wie 07c |
| Titel/Unterzeile | „Spieler für die Bank“ / „Ersatzspieler antippen (1/7)“ | „Spieler für die Bank“ 19/800 / „1 von 7 belegt“ 13 `--muted` | St + FL | S | app.js Z. 4159 f. |
| Sammelknopf | `.tv-kall` grün gefüllt „Alle Zugesagten auf die Bank (n)“, gesperrt grau + Erklärzeile („Keine zugesagten Spieler frei“) | Sekundärknopf „Alle 3 freien Zugesagten setzen“ 358 × 50; **nur sichtbar, wenn Kandidaten da sind**; Erklärzeile entfällt | St + FL | S | app.js Z. 4175 bis 4184; styles.css Z. 2178 bis 2180 |
| Gruppenköpfe | „TOR 2“ 12/800 Versal, Zahl mit Deckkraft .6 | `.group-head` „Tor · 2“, „Abwehr · 6“ | St + FL | S | app.js Z. 4205; styles.css Z. 2182 f. |
| Liste | Einzelkarten 48 hoch | eine Karte je Gruppe, Zeilen 57 | St | S | styles.css Z. 2184 f. |
| Zeile links | Nummernkreis 30 `--green-050` | Rückennummer ohne Kreis 15/800 `--green-800` (kein Avatar, anders als 07c) | St | S | styles.css Z. 2188 |
| Zeile Mitte | Name 14/700, Position 11 | Name 16/700, „IV · zugesagt“ 13 `--muted` | St + FL | S | app.js Z. 4212 |
| Rechts wählbar | Marke „verfügbar“, ganze Zeile antippbar | „+“-Knopf 38 × 38 | St + FL | S | app.js Z. 4210 |
| Rechts belegt | „vergeben“ `--green-800` gefüllt, Zeile 45 % Deckkraft | „Auf dem Platz“ neutral (`--line`/`--ink`, 12,5:1) bzw. „Auf der Bank“ grün; volle Deckkraft | St + FL | S | app.js Z. 4207 bis 4210; styles.css Z. 2186, Z. 2198 |
| Status | rosa Zeile + Text „verletzt“ rot, „Urlaub“ grau | keine Tönung; „Verletzt“ rot, „Urlaub“ blau | St | S | styles.css `.s-verl` usw. |
| Volle Bank | Toast „Bank ist voll (7)“ | bleibt | keine | S | app.js Z. 4157 |

### 09 Kader

| Element | Ist | Soll | Art | Aufwand | Fundstelle |
|---|---|---|---|---|---|
| Kopf | Zurück-Chevron + „Kader“ | „Kader“ 26/800, ls −0,52 px. Zurück-Chevron fehlt im Bild, bleibt aber (Weg zurück zur Trainer-Ansicht) | St | S | app.js Z. 733 |
| Kennzahlen | 3 Kacheln „Spieler 16 / im Kader“, „Fit 13 / einsatzbereit“, „Nicht fit 3 / …“ mit rotem Randstreifen | **4 getönte Kacheln im 2er-Raster**, je 175 × 51, Abstand 8, Radius 14; Etikett links 15/700, Zahl rechts 21/800 gleiche Ziffernbreite. Fit `--grad-task-green`/Rand #c8e0d2/Schrift #14503a; Angeschlagen `--amber-050`/`--amber-line`/`--amber-ink`; Verletzt `--grad-task-red`/`--red-line`/#7d1f14; Urlaub `--blau-050`/#c3dbea/`--blau-700`. Kein Randstreifen | St + FL | M | app.js Z. 735 bis 751; styles.css Z. 392 bis 411, Z. 2932 f. |
| Gesamtzahl Spieler | eigene Kachel | entfällt hier; steht auf der Kaderkarte in 06 („16 Spieler ›“) | FL | S | app.js Z. 736 bis 740 |
| Gruppe „Fällt aus“ | Abschnitt „Lazarett“ **unten**, Einzelkarten mit „seit … · zurück …/offenes Ende“, Notiz eigene Zeile, Marke rechts | **oben**, `.group-head` „Fällt aus“; eine Karte, Zeile 62: Avatar 36, Name 16/700, Nebenzeile „Knie · seit 28. Sep“ 13 `--muted`; rechts Status-Pille | St + FL | M | app.js Z. 765 bis 783 |
| „zurück am“ | in der Lazarett-Zeile | im Bild nicht zu sehen. Bleibt als Teil der Nebenzeile, wenn gesetzt: „Knie · bis 12. Okt“ | FL | S | app.js Z. 771 |
| Gruppe „Einsatzbereit · 15“ | „Kader-Status“: **alle** Spieler, je Karte mit vier Chips inline + Datum/Notiz-Feldern | nur Fitte, eine Karte, Zeilen 57: Avatar, Name 16/700, Status-Pille. Kein Chip-Raster mehr in der Liste | St + FL | M | app.js Z. 753 bis 763 |
| Status-Pille | `.st-badge` .68rem, nur bei nicht fit | Pille 12/700, Höhe 22, Punkt 7 px in Statusfarbe, „▾“; Fit `--green-badge-bg`/`--green-800`, Verletzt `--red-050`/`--red-700`, Angeschlagen `--amber-050`/`--amber-ink`, Urlaub `--blau-050`/`--blau-700` | St + FL | S | app.js Z. 174 bis 185; styles.css Z. 839 bis 841 |
| Urlaubsfarbe | grau (`st-grau`, `--dot-off`) | blau, nur für Urlaub | St | S | app.js Z. 177 |
| Antippen | Chips direkt in der Zeile | ganze Zeile öffnet Blatt 10 | FL | M | app.js Z. 761, Handler `data-status-set` |
| Leer | „Alle fit – kein Eintrag“ | Gruppe „Fällt aus“ entfällt, wenn leer (ohne Gedankenstrich-Text) | FL | S | app.js Z. 783 |

### 10 Blatt · Status ändern (neu)

| Element | Ist | Soll | Art | Aufwand | Fundstelle |
|---|---|---|---|---|---|
| Blatt | fehlt; Status wird inline in der Kaderzeile gesetzt | Bottom-Sheet 390 × 340, Radius 18, Griff | St + FL | M | neu; Muster `blattAuf/blattZu` app.js Z. 2612 |
| Kopf | – | Avatar 40 (14/800), Name 19/800 ls −0,38, „IV · Nr. 5“ 13 `--muted` (`players.position`, `players.number`) | St + FL | S | Daten in `DEMO.players` (`pos`, `nr`), db.js Z. 64 |
| Statusknöpfe | 4 Chips nebeneinander, gewählt voll gefärbt (grün/amber/rot) | 2er-Raster 175 × 50, Radius 12, `--grad-btn-sec`, Rand 1 px `rgba(16,40,30,.14)`, 16/600 `--ink`, Punkt 8 px (Fit #237a52, Angeschlagen #b9770e, Verletzt #c0392b, Urlaub #2e7bb5). **Gewählt getönt mit Rand** (Verletzt: Grund #fbeae8, Rand 1 px #c0392b, Schrift #a5281b 16/700) | St + FL | S | app.js Z. 132 bis 152 (`statusWahlHtml`); styles.css Z. 1400 bis 1403 |
| Grund | Feld „Notiz“ (optional), speichert beim Verlassen | Feld 358 × 50, Radius 12, Grund #fcfdfc, Rand `rgba(16,40,30,.14)`, Schrift 16 | St + FL | S | app.js Z. 143 bis 146, Z. 7219 bis 7228 |
| Datum „voraussichtlich bis“ | Feld vorhanden | **nicht im Bild**. Bleibt als zweites Feld unter „Grund“ (siehe Abschnitt 3) | FL | S | app.js Z. 139 bis 142 |
| Speichern | sofort beim Chip-Tipp bzw. beim Verlassen des Feldes | ausdrücklich per Primärknopf „Speichern“ 358 × 48; Schreiben weiter über `DB.setPlayerStatus` (RPC `set_player_status`) | FL | S | app.js Z. 156 bis 172; db.js Z. 534 |
| Gleicher Baustein an anderen Orten | `statusWahlHtml` auch in Übersicht („Mein Status“) und Profil | dort gilt Vorlage A (01). Kader darf den gemeinsamen Baustein nicht für A/D brechen | FL | S | app.js Z. 707 f. |

---

### 2. Freie Positionen (07b, 07c): Reicht das Schema?

**Antwort: Ja. Kein Schema, kein Backend.**

So wird heute gespeichert (`supabase/migrations/0012_lineups.sql`, `db.js` Z. 129 bis 139):

```
lineups.formation  text            z. B. '4-4-2'
lineups.slots      jsonb  '{}'     { slotKey: playerId }   z. B. { "TW": "<uuid>", "LIV": "<uuid>", … }
lineups.bank       jsonb  '[]'     [ playerId, … ]  (max. 7, Frontend-Grenze TV_BANK_MAX)
```

- Welche Positionen es gibt, steht nicht in der Datenbank, sondern in der Konstante `FORMATIONS` (app.js Z. 3085 ff.): je Formation 11 Einträge `{ key, role, x, y }`.
- Eine Position ist **frei, wenn ihr `key` in `slots` fehlt**. `tvCleanAssign()` (Z. 3923) schreibt nur belegte Keys, leere fallen heraus. Beim Laden filtert `tvOpenGame()` (Z. 3802) zusätzlich Spieler-IDs heraus, die es nicht mehr gibt; deren Position wird damit automatisch frei.
- Die Zählung „n von 11“, „Elf steht/Elf offen“ (`tvGameRow`, Z. 3711 bis 3715) und die Kader-Info (`buildKaderInfoText`, Z. 2973 ff.: fällt bei unvollständiger Elf auf die Zusagenliste zurück) arbeiten bereits mit dieser Regel. 07b ist also nur eine Ableitung: `FORMATIONS[formation].filter(s => !slots[s.key])`.
- 07c braucht Zusagen (`state.rsvp`, aus `rsvps`), Status (`player_status`, als `p.status`) und Position (`players.position`, als `p.pos`). Alles wird beim Start bereits geladen (db.js Z. 19 bis 28). **Keine neue Abfrage.**
- „Position leer lassen“ ist eine reine Bedienhandlung (Blatt schließen oder zur nächsten freien Position springen). Sie muss nicht gespeichert werden, weil die Vorlage den Hinweis zeigt, solange eine Position frei ist.
- Nur falls der Nutzer später „bewusst leer gelassen“ dauerhaft unterscheiden will (Hinweis ausblenden), ginge das ohne Migration als `{ "LV": null }` in `slots`. Dann müssten `tvCleanAssign` und `tvGameRow` `null` gesondert behandeln. Das verlangt die Vorlage nicht.
- RLS bleibt: `lineups` lesen/schreiben nur `coach`/`admin`, `set_lineup_active` unverändert.

---

### 3. Funktionen, die heute existieren und in der Vorlage fehlen (bleiben erhalten)

| Funktion | Heute | Vorschlag, wo |
|---|---|---|
| Aufstellung speichern + aktiv setzen | `.tv-primary` „Aufstellung speichern“ unter der Bank (Z. 3852, 3925 bis 3946) | `.btn-primary` „Aufstellung speichern“ unter dem Bankraster in 07. Der einzige Primärknopf der Ansicht |
| Rückfrage bei ungespeicherten Änderungen (Speichern/Verwerfen/Abbrechen) | `tvUnsavedDialog` Z. 3994 | unverändert; Knöpfe auf `.btn-primary`/`.btn-soft` (rot)/`.btn-soft` |
| Vom letzten Spiel übernehmen | Overlay auf leerem Feld + Menü ··· (Z. 3847, 3855, 4243) | Overlay bleibt bei 0 Gesetzten; Menüpunkt bleibt |
| Vorlage speichern, Vorlage anwenden | Menü ··· der Platzansicht (Z. 4244 bis 4247) | bleibt im Menü ··· des Unterkopfs |
| Favoriten-Formationen bearbeiten (2 bis 4, lokal gespeichert) | Menü ··· und Formationsblatt (Z. 4219 bis 4238) | bleibt; Blatt „Formation wechseln“ über Chip „Weitere“ |
| Aufstellung leeren | Menü ··· rot (Z. 4249) | bleibt im Menü ··· |
| Tauschen per Tipp (Feld ↔ Feld, Feld ↔ Bank) | Markierung mit Goldring (Z. 4106 bis 4142) | bleibt; Markierung in Weiß statt Gold, damit sie nicht wie eine freie Position aussieht |
| Spieler von der Bank nehmen | Kreuz „×“ im Bankplatz (Z. 3874, 4288) | Vorlage zeigt kein Kreuz. Vorschlag: Kreuz bleibt, oben rechts im 84 × 56-Platz, Strich-SVG 12 px, Trefferfläche 44 per `::after`. Alternative: markierter Bankplatz blendet im Bank-Gruppenkopf „Von der Bank nehmen“ ein |
| Bankspieler direkt auf eine Position setzen | im Kader-Vollbild antippbar (`tvAssign` nimmt ihn von der Bank) | 07c zeigt „Auf der Bank“ als Marke. Weg bleibt über Tauschen per Tipp |
| Abgesagte und Spieler ohne Rückmeldung aufstellen | antippbar mit Marke „abgesagt“ bzw. „o. Rückm.“ | 07c/08: eigene Gruppe „Ohne Rückmeldung“ mit „+“ und Nebenzeile „keine Rückmeldung“; Abgesagte unter „Nicht verfügbar“ mit neutraler Marke „Abgesagt“ |
| Verletzte/Urlauber trotzdem aufstellen | heute antippbar | Vorlage zeigt nur Marke. Damit keine Funktion wegfällt: Zeile antippen → Rückfrage „Trotzdem aufstellen?“. Entscheidung durch Nutzer |
| Angeschlagen erkennbar | Marke „angeschlagen“ | Nebenzeile „AV · zugesagt · angeschlagen“ (Amber nur als Punkt, Text `--muted`) |
| Nur-Ansehen vergangener Spiele | `tv.readonly`, Hinweiszeile (Z. 3851) | bleibt, Text ohne Gedankenstrich |
| Sprung aus Spielkarte mit Rückkehr an Ursprung und Scrollposition, Deep-Link `#lineup=` | Z. 3964 bis 4054 | unverändert |
| Liste „Weitere Spiele“ kürzen/„Alle“ | `tv.alleSpiele` (Z. 3627 f.) | bleibt, „Alle ›“ bzw. „Weniger ›“ |
| Vorlage „Neu“ ohne offene Aufstellung | führt in das nächste Spiel + Toast | bleibt hinter „+ Neu“ |
| Status-Datum „voraussichtlich bis“ (`status_until`) | Feld im Kader | Blatt 10: zweites Feld unter „Grund“, nur wenn nicht Fit |
| Gesamtzahl Spieler | Kachel im Kader | Kaderkarte 06 („16 Spieler ›“) |
| „zurück am …“/„offenes Ende“ | Lazarett-Zeile | Nebenzeile in „Fällt aus“: „Knie · bis 12. Okt“; ohne Datum nur „Knie · seit 28. Sep“ |
| Wischen zum Schließen der Spielerauswahl | Vollbild-Gesten (Z. 4071 ff.) | auf die neuen Bottom-Sheets 07c/08 übertragen |
| Toasts („Gespeichert & aktiv gesetzt“ usw.) | `tvToast` | bleiben; Texte ohne Gedankenstrich (siehe Abschnitt 5) |

---

### 4. Änderungen mit Schema oder Backend

**Keine.**

- `lineups.slots`/`bank`/`formation` reichen (Abschnitt 2).
- Status schreiben weiter über RPC `set_player_status(p_player, p_status, p_note, p_until)`. `status_since` liefert die Datenbank schon („seit 28. Sep“).
- Rückmeldungen-Zeile in 06 nutzt das vorhandene Blatt `openRsvpSheet` und vorhandene `rsvps`-Daten.
- Keine neue Abfrage: Spieler, Status, Zusagen und Aufstellungen werden bereits in `DB.loadAll` geladen.
- Nur Frontend: neue Tokens, Markup in `app.js`, Regeln in `styles.css`, Build-Kennung in `index.html` hochzählen (Cache).

---

### 5. Verbindliche Vorgaben, die von der Vorlage abweichen

| Vorgabe | Stelle in der Vorlage | Abweichung in der Umsetzung |
|---|---|---|
| Trefferflächen ≥ 44 px | „+“-Knopf 38 × 38 (07c, 08), Formationschips 38 hoch, Status-Pille 22 hoch (09), Textverweise „Alle ›“, „+ Neu“, „Spieler wählen ›“ 19 hoch, Menü ··· der Vorlagenzeile, Spielerscheibe 40 | `::after` bzw. `::before` mit `--tap` (44). Pille in 09: ganze Zeile (57) ist die Fläche. Scheibe: vorhandenes `.tv-slot::before` 44. Bank-Kreuz: `::after` 44 |
| Kontrast ≥ 4,5:1 | „LV frei“ 13/700 `--gold-400` auf Rasen: **2,9:1** (#2e7d46) bzw. 3,3:1 (#2a7541) | Beschriftung weiß 13/700 (5,1:1) mit Goldring als Kennung, oder Etikett auf dunkler Pille `--green-900` mit Gold-Schrift (7,0:1). Vorschlag: dunkle Pille, Farbe bleibt erkennbar |
| Kontrast ≥ 4,5:1 | Statuspunkt Amber #b9770e (3,7:1 auf Weiß) | nur Punkt, kein Text; zulässig, da Text daneben in `--ink`/`--amber-ink` |
| Kontrast ≥ 4,5:1 | übrige Soll-Paare geprüft: Name weiß auf Rasen 5,1:1, „+ frei“ 5,5:1, Hinweis gold 7,2:1, „10 von 11“ 6,4:1, „Elf offen“ 5,4:1, Urlaub 6,3:1, Verletzt 6,2:1, Pfeil `--green-chev` 4,9:1, Gold auf Hero 7,0:1 | keine Abweichung |
| Keine Gedankenstriche in App-Texten | Vorlage selbst sauber | heute im B-Bereich zu ersetzen: „Alle fit – kein Eintrag“ (Z. 783), „Vergangenes Spiel – nur ansehen …“ (Z. 3851), Overlay „… – fehlende Spieler werden …“ (Z. 3856), Toasts „Übernommen – n/11 gesetzt“ (Z. 3910), „1 Platz leer – ohne Zusage oder verletzt“ (Z. 3794), Platzhalter „–“ für fehlende Rückennummer (Z. 4212, Vorschlag: leer lassen) |
| Keine ASCII-Umlaute in sichtbaren Texten | Vorlage sauber | in den sichtbaren Strings des B-Bereichs keine gefunden (ae/oe/ue nur in Kommentaren). Neue Texte („Verfügbar“, „Nächste besetzen“, „Rückmeldungen“) mit echten Umlauten |
| Keine Funktion fällt weg | Vorlage zeigt weder Speichern, Bank-Entfernen, Abgesagte/ohne Rückmeldung noch „bis“-Datum | siehe Abschnitt 3; alle bleiben |
| Bottom-Nav Übersicht/Kalender/Katalog/Konto + rollenabhängiger 5. Tab | Soll-Bilder 06, 07, 09 zeigen „Mehr“ aktiv (Admin-Sicht) | `setupPrimaryNavTab` (Z. 7038) bleibt: reiner Trainer „Trainer“ (Spielfeld-Symbol, führt direkt in 06), Kassenwart „Kasse“, Admin oder Mehrfachrolle „Mehr“, reiner Spieler kein 5. Tab. Kader erreichbar über Kaderkarte in 06 und Mehr-Blatt |
| Ein Primärknopf je Ansicht | 07 ohne Primärknopf im Bild | „Aufstellung speichern“ ist der eine Primärknopf in 07; Overlay „Übernehmen &amp; anpassen“ erscheint nur bei leerem Feld, dann ist Speichern sinnlos. Vorschlag: Speichern bei 0 Gesetzten und ohne Änderung ausgeblendet |
| Eingabefelder 16 px | Blatt 10 „Grund“ 16 px | eingehalten; Datumsfeld ebenfalls 16 px (`--fs-input`) |
| Kein waagerechtes Scrollen | Formationschips (4 × ca. 80 + Abstände = 327 px) passen; bei 4 Favoriten plus „Weitere“ nicht | `.tv-formbar` scrollt heute waagerecht (Z. 2067). Vorschlag: höchstens 3 Favoriten sichtbar + „Weitere“, oder Umbruch in zweite Zeile |
| Kein Text unter 13 px | Bank-Name heute 9 px, „frei“ 9 px, Spielername 10 px, Unterkopf 11,5 px, Marken 10 px | alle auf Vorlagenwerte (13 bzw. 12 für Versal/Marken) |

---

## Delta C · Konto, Kasse, Katalog (Screens 11 bis 17)

Stand 06.10.2026. Nur gelesen, nichts geändert.

Quellen Soll: `PAKET-README.md` (Tokens, Bausteine, Teil C, „Wo Funktionen jetzt liegen“), `referenz/Final C Konto Kasse Katalog.dc.html`, `soll/11` bis `soll/17` (.png und .json, gemessen bei 390 px).
Quellen Ist: `app.js` (Stand Build 2026-10-06-A), `styles.css`, `db.js`, `supabase/migrations/0030_fine_status.sql`, `0040`, `0045`, `0036`, Aufnahmen `.design-sync/landkarte/bilder/{spieler,kassenwart,admin}/`, `conventions.md`, `NOTES.md`.

Art: **Styling** (nur CSS/Tokens), **Frontend-Logik** (Markup, Rechnen, Ereignisse in `app.js`), **Abfrage** (neue oder geänderte Datenabfrage), **Schema**, **Backend** (RPC/Trigger).
Aufwand: S unter 1 h, M halbe Tag, L ein Tag und mehr.

Gemeinsame Vorarbeit aus den Schritten 1 bis 5 der Umsetzungsreihenfolge (Tokens, `.btn-primary`, `.group-head`, Marken, Kacheln) wird hier vorausgesetzt und nur genannt, wo C sie braucht.

---

### 1. Screens

### 11 · Konto, Ich

| Element | Ist | Soll | Art | Aufwand | Fundstelle |
|---|---|---|---|---|---|
| Seitentitel | „Strafen-Konto“ 22 px/800 (`.page-head h1`, zweite Regel bei styles.css 2466 überschreibt 1.4rem), davor Zurück-Chevron `navBackChevronHtml()` | „Strafen-Konto“ 26/800, letter-spacing −0,02em (`--fs-titel`); Chevron bleibt, wenn über Sprung erreicht | Styling | S | app.js 4557, styles.css 379, 2466 |
| Segment Ich / Mannschaft | fehlt; stattdessen Chips „Meine“ und „Alle“ | Segment 2-spaltig, Spur `--bg-2`, Rand 1 px `--line-soft`, Radius 12, Innenabstand 3, Lücke 2; Pille aktiv weiß, Radius 9, `--shadow-sm`, 14/700 `--green-800`; inaktiv 14/600 `--muted`; Höhe 38 (Spur 46). 12 px unter dem Titel | Frontend-Logik + Styling | M | app.js 4372 (`strafenFilter`), 4546–4552, 4576–4578 |
| Kontobanner Fläche | `.mine-banner`: `--card`, Rand `--line`, `--shadow-sm`, Innenabstand 18 16 16, `margin-top:16` | `--grad-card`, Rand 1 px `--line-soft`, Radius 14, `--shadow-card`, Innenabstand 20 16 16, Lücke 10, zentriert, 12 px unter dem Segment | Styling | S | app.js 4406, styles.css 1547 |
| Etikett | „Dein Konto · Name“ 11/700, ls .68px | 12/700 Versal, ls .08em (Vorlage; Token `--fs-etikett` hat .06em, Abweichung klären), `--muted` | Styling | S | styles.css 1555 |
| Betrag | 52/800, −.035em, `--red-600`, schuldenfrei `--green-800` | unverändert 52/800 (README nennt `--fs-betrag` 40, die Vorlage misst 52: 52 übernehmen, 40 gilt für Kasse 13) | – | – | styles.css 1556, 1578 |
| Unterzeile | „offen von 16,00 € · 3 Strafen“ 12/500 | „3 Strafen offen · **8 gemeldet**“ 13 px `--muted`, „gemeldet“ 700 `--amber-ink`; Teil „gemeldet“ nur, wenn > 0 | Frontend-Logik + Styling | S | app.js 4409–4411, styles.css 1560 |
| Fortschrittsbalken `.mb-bar` | vorhanden (Anteil erledigt) | **entfällt** | Frontend-Logik | S | app.js 4403–4404, 4412; styles.css 1561–1565 |
| Hinweis Mahnzuschlag `.mb-note` | „inkl. 2,00 € Mahnzuschlag“ | in der Vorlage nicht gezeigt, README streicht nur den Gemeldet-Hinweis. **Bleibt** (siehe Abschnitt 4): in die Unterzeile, „3 Strafen offen, inkl. 2,00 € Zuschlag · 8 gemeldet“ | Frontend-Logik | S | app.js 4393, 4413 |
| Hinweis gemeldet `.mb-note` | „8 Strafen gemeldet · Kassenwart bestätigt den Eingang“ | **entfällt** (geht in die Unterzeile auf) | Frontend-Logik | S | app.js 4421 |
| Bezahlknopf | `.btn-primary.mb-pay` 100 % breit, `--h-btn-xl` 52, 16 px | „30,00 € jetzt bezahlen“ Höhe 52, Radius 12, **17/700**, `--grad-btn` neu, `--shadow-btn`, seitlich 8 px eingerückt (308 breit bei 358 Karte), 6 px Abstand oben | Styling | S | app.js 4415, styles.css 1569 |
| PayPal-Zeile | „über PayPal · Freunde & Familie“ | gleich; 13 px `--muted`, Wortmarke 15/800 kursiv `--pp-blue`/`--pp-cyan` | Styling (Prüfen) | S | app.js 4416, styles.css 1570 |
| Fußzeile | `.mb-foot`: Trennlinie, `padding-top:12`, „Zahlung melden“ als unterstrichener Textknopf 13/700; rechts „Erhöhung in“ Text plus Countdown-Pille `.cd` in Stufenfarbe (neutral, amber, rot) | Trennlinie `--line`, Mindesthöhe 44, seitlich 8 eingerückt; links „Zahlung melden ›“ 14/600 `--green-800` **ohne Unterstreichung**; rechts **eine** Marke „Erhöhung in 1h 50m“ 12/700, Pille 3 10, `--red-050`/`--red-700` | Frontend-Logik + Styling | S | app.js 4417–4420, styles.css 1571–1576, 809–826 |
| Status-Chips | „Offen / Gemeldet / Eingegangen / Meine / Alle“ ohne Zahl, Höhe 44, 13,6 px, aktiv `--green-700` flach | drei Chips „Offen 3 / Gemeldet 8 / Bezahlt 24“ mit Anzahl im aktuellen Segment, Höhe 36 (Trefferfläche 44 per `::after`, vorhanden), 14 px, aktiv `--grad-btn` + `--shadow-btn` 14/700 weiß, inaktiv `--grad-chip`, Rand `--line-soft-2`, 14/600; 16 px unter dem Banner | Frontend-Logik + Styling | M | app.js 4546–4552, 4576; styles.css 1519–1542 |
| Liste eigene Strafen | je Strafe eine Karte `.fine-row` mit Avatar, Name 14/700, Nebenzeile 12, Betrag 15/800, Marke „offen“ | **eine** Karte mit Trennlinien `--line`, Zeile Mindesthöhe 60, Innenabstand 0 16; Titel = Vergehen 16/700 mit Ellipse, Nebenzeile Datum „3. Okt“ 13 `--muted`; rechts Betrag 16/800 `--red-600`. **Kein Avatar, keine Marke** | Frontend-Logik + Styling | M | app.js 4580–4595, styles.css 2275–2287 |
| Zusätze je Zeile | „· automatisch“, „Abgelehnt: Grund“ (`.fine-reason`) | in der Vorlage nicht gezeigt, **bleiben** in der Nebenzeile bzw. als zweite Nebenzeile 13 px `--red-700` | Frontend-Logik | S | app.js 4587–4588 |
| Betragsfarbe in Gemeldet/Bezahlt | rot nur bei offen, sonst `--green-800` | Vorlage zeigt nur Offen. Vorschlag: Offen `--red-600`, Gemeldet `--amber-ink`, Bezahlt `--green-800` | Styling | S | styles.css 2286 |
| Sortierung | nach Status, dann Datum absteigend | unverändert (je Chip ein Status) | – | – | app.js 4543–4544 |
| Leerzustand | „Keine Strafen in dieser Auswahl.“ | Muster `.empty`: Liniensymbol 24, Satz 15/600 | Styling | S | app.js 4595 |
| Nicht zugeordnetes Konto | Banner „Noch keinem Spieler zugeordnet“ mit Satz „… Zuordnung – danach …“ | nicht in der Vorlage, bleibt; **Gedankenstrich ersetzen** | Frontend-Logik | S | app.js 4380–4387 |
| Schuldenfrei | „Du bist schuldenfrei“ bzw. „Zahlung gemeldet – wartet auf Bestätigung“ | bleibt; **Gedankenstrich ersetzen** („Zahlung gemeldet, wartet auf Bestätigung“) | Frontend-Logik | S | app.js 4411 |
| Mannschafts-Kacheln im Ich-Segment | „Summe offen“ und „Kontostand“ stehen immer | nur im Segment Mannschaft (12) | Frontend-Logik | S | app.js 4563–4574 |
| Blatt „Zahlung melden“ | `zmBl`, drei Zahlart-Chips, Notiz, Zähler | keine Vorlage in C, bleibt; nur Bausteine nachziehen (Primärknopf, Segment statt `.zart-row`, siehe 15) | Styling | S | app.js 4430–4515 |
| Bottom-Nav | Konto aktiv | unverändert | – | – | – |

### 12 · Konto, Mannschaft

| Element | Ist | Soll | Art | Aufwand | Fundstelle |
|---|---|---|---|---|---|
| Titel, Segment | wie 11 | wie 11, „Mannschaft“ aktiv | Frontend-Logik | (in 11) | app.js 4556 |
| Kontobanner | steht auch hier | **nicht** im Segment Mannschaft (Vorlage zeigt direkt die Kacheln) | Frontend-Logik | S | app.js 4561 |
| Kachel links | „Summe offen“ `.kpi.is-warn`, weiß mit rotem Randstreifen `::before`, Etikett 11, Wert 19, Nebenzeile „4 offene Strafen“ 11 | „Offen“: `--grad-task-red`, Rand `--red-line`, Radius 14, `--shadow-card`, Innenabstand 14, Lücke 4; Etikett 12/700 Versal .06em `--red-ink-2`; Wert 21/800 `--red-ink`, tabular, nowrap. **Keine Nebenzeile**. Höhe 74 | Styling + Frontend-Logik | S | app.js 4564–4568, styles.css 392–419 |
| Kachel rechts | „Kontostand“ = offen + bestätigt, Nebenzeile „Gesamtvolumen Saison“ | „In der Kasse“ = Summe **bestätigt**: `--grad-task-green`, Rand `--green-badge-line`, Etikett `--green-task-ink-2`, Wert `--green-task-ink`. **Bedeutung ändert sich** (siehe Abschnitt 6) | Frontend-Logik + Styling | S | app.js 4536, 4569–4573 |
| Raster | `.kpi-grid` Lücke 8, `margin-top:14` | 2 Spalten, Lücke 10, 12 unter dem Segment | Styling | S | styles.css 392 |
| Chips | wie 11 | „Offen 238 / Gemeldet 8 / Bezahlt 58“, Zahlen über die ganze Mannschaft, 16 unter den Kacheln | Frontend-Logik | (in 11) | – |
| Liste | Einzelkarten mit Avatar 32 (`--green-700`, Schrift gold 12/700), Name 14/700, Marke | eine Karte mit Trennlinien; Zeile 60, Avatar 36 rund `--grad-av` + `--shadow-av`, Initialen 13/800 `--green-800`; Name 16/700; Nebenzeile „Vergessene Zahlung · 1. Okt“ 13 `--muted` mit Ellipse; Betrag 16/800 `--red-600`. Keine Marke, kein „›“ | Frontend-Logik + Styling | M | app.js 4582–4594, styles.css 1510–1515, 2275 |
| Handlungen | keine (nur Ansicht) | „Nur Ansicht, keine Kassenhandlungen“, deckt sich | – | – | – |

### 13 · Kasse, Gemeldet

| Element | Ist | Soll | Art | Aufwand | Fundstelle |
|---|---|---|---|---|---|
| Titel | „Kasse“ 22/800 mit Chevron | „Kasse“ 26/800 | Styling | S | app.js 5035 |
| Kennzahl-Kacheln (3) | Offen / Gemeldet / Eingegangen, antippbar `.kpi-tapbar` | **entfallen** | Frontend-Logik | S | app.js 5037–5053, styles.css 2371–2386 |
| „Strafe verhängen“ | `.ks-neu` unter den Kacheln: 52 hoch, 17/700, Plus-Symbol 20, Radius `--radius-md` | „+ Strafe verhängen“ als `.btn-primary`: 48 hoch, 16/700, Radius 12, 12 unter dem Titel, volle Breite; „+“ als Text | Styling + Frontend-Logik | S | app.js 5055–5057, styles.css 1586–1596 |
| Gruppenkopf „Prüfen und verbuchen“ | `.section-title.kasse-verbuchen` | **entfällt** | Frontend-Logik | S | app.js 5059, styles.css 1585 |
| Segment Reiter | `.ks-seg`: `--seg-bg`, Radius `--radius`, Innenabstand 4, Lücke 4, Knöpfe 44 hoch, Radius 11, 14/700 `--muted-2`, Zähler in allen drei Reitern 500 | Spur `--bg-2`, Rand 1 px `--line-soft`, Radius 12, Innenabstand 3, Lücke 2, Höhe 38 (Trefferfläche 44 per `::after`, Spur 46); aktiv weiß Radius 9 `--shadow-sm` 14/700 `--green-800`, inaktiv 14/600 `--muted` (auf `--bg-2` 4,7:1); **Zähler nur an „Gemeldet“** als Amber-Plakette 20 hoch, min 20 breit, Innenabstand 0 5, `--amber-050`/`--amber-ink` 12 px; 16 unter dem Knopf | Styling + Frontend-Logik | S | app.js 5031–5032, 5061–5064; styles.css 2530–2545 |
| Beschriftungen | „Zu prüfen“, „Offen“, „Eingegangen“ | „Gemeldet“, „Offen“, „Bezahlt“; Reihenfolge Gemeldet zuerst bleibt | Frontend-Logik | S | app.js 5032 |
| Kopfzeile des Stapels | „1 von 8“ und „Alle bestätigen“ **in** der Karte (`.ks-kopf`, 14/700 `--green-700`) | **über** der Karte: links „1 von 8 · 104,00 €“ 12/700 Versal .06em `--muted` (Summe aller Meldungen neu), rechts „Alle bestätigen“ 15/600 `--green-800`, Grundlinie; 16 unter dem Segment, 8 über der Karte | Frontend-Logik + Styling | S | app.js 4752–4755, styles.css 2647–2657 |
| Geisterkarten | entfernt (Entscheidung 25.09.) | **wieder da**: zwei Karten dahinter, 8 bzw. 16 eingerückt, 7 bzw. 14 tiefer, weiß, Rand `--line-soft`, Radius 14, Deckkraft .85 / .6 | Styling + Frontend-Logik | S | app.js 4750, styles.css 2640 |
| Karte | `.card.ks-card` Innenabstand 16 16 18 | `--grad-card`, Rand `--line-soft`, Radius 14, `--shadow-card`, Innenabstand 24 16 16, Höhe 340 (Knöpfe unten, `margin-top:auto`) | Styling | S | styles.css 2641 |
| Avatar | 56, Fläche `--green-050`, 17 px | 56, `--grad-av`, `--shadow-av`, 18/800 `--green-800` | Styling | S | styles.css 2660 |
| Name, Grund | 19/700; Grund 14 | Name 19/**800**, 6 Abstand; Grund 15 `--muted` | Styling | S | styles.css 2662–2663 |
| Betrag | 34/800 | **40/800** −.03em `--green-800` tabular (`--fs-betrag`) | Styling | S | styles.css 2664 |
| Meta | Symbol + „PayPal · gemeldet 28.09., 16:42“ 14 | gleicher Text 13 `--muted`; Zahlart-Symbol in der Vorlage nicht gezeigt, bleibt (Konvention Zahlart-Symbole) | Styling | S | app.js 4746–4760 |
| Zitat des Spielers | „„zahle bar …““ 14 | nicht in der Vorlage, **bleibt** | – | – | app.js 4761 |
| Knöpfe | `.ks-actions` 1:1, `--h-btn-lg`, „Ablehnen“ `.btn` | Raster 1fr : 1,4fr, Lücke 8, 48 hoch; „Ablehnen“ `.btn-soft` Schrift `--red-700`; „Bestätigen“ `.btn-primary` | Styling | S | app.js 4762–4765, styles.css 2669–2670 |
| Wischen im Stapel | vorhanden | bleibt | – | – | app.js 5256 |
| Ablehnen-Grund | `window.prompt` | keine Vorlage; bleibt | – | – | app.js 5894 |
| Leerzustand | „Nichts zu prüfen“ | „Nichts gemeldet“ o. ä., Muster `.empty` | Frontend-Logik | S | app.js 4740 |
| Bottom-Nav | Kassenwart: 5. Tab „Kasse“; Admin: über „Mehr“ | Vorlage zeigt „Mehr“ aktiv (Admin-Sicht); Kassenwart-Tab bleibt | – | – | – |

### 14 · Kasse, Offen

| Element | Ist | Soll | Art | Aufwand | Fundstelle |
|---|---|---|---|---|---|
| Kopf, Knopf, Segment | wie 13 | wie 13, „Offen“ aktiv | – | (in 13) | – |
| Summenzeile | fehlt (stand in der Kachel „Offen“) | links „238 Strafen · 41 Spieler“ 12/700 Versal `--muted`, rechts Betrag 21/800 `--red-600` tabular; Grundlinie; 16 unter dem Segment | Frontend-Logik + Styling | S | app.js 5020–5023 |
| Liste | **je Strafe** eine Karte `.krow` (Name, Betrag, Vergehen, „verhängt 30.08.2026“, Angabe, Ablehnungsgrund, Knöpfe) | **je Spieler** eine Zeile in **einer** Karte: Avatar 36, Name 16/700, Nebenzeile „6 Strafen · älteste 10. Mai“ (bei 1: „1 Strafe · 1. Okt“) 13 `--muted`, Betrag 16/800 `--red-600`, „›“ 18 `--green-chev`; Zeile 60, Innenabstand 0 16, Trennlinien | Frontend-Logik + Styling | M | app.js 4716–4733, 4779–4783; styles.css 2418–2433 |
| Sortierung | `KS_REIHENFOLGE.offen = "alt"`: älteste Strafe zuerst | nach **Betrag** absteigend (bei Gleichstand Name). Kippt die Entscheidung vom 26.09., siehe Abschnitt 6 | Frontend-Logik | S | app.js 4811, 5029 |
| Knöpfe je Strafe `.krow-actions` | „Storno“ bzw. „Entfernen“ (Auto) und „Als bezahlt buchen“ | **entfallen**, wandern ins Blatt 15 | Frontend-Logik | S | app.js 4726–4731 |
| Tipp auf Zeile | öffnet Detail-Blatt (Verlauf) der einen Strafe | öffnet Blatt 15 des Spielers | Frontend-Logik | S | app.js 5862–5863 |
| Angabe des Spielers / Ablehnungsgrund | je Karte `.ks-sag` und `.fine-reason` | nicht mehr in der Liste, wandern in Blatt 15 (je Zeile) | Frontend-Logik | S | app.js 4724–4725 |
| Leerzustand | „Keine offenen Posten“ | Muster `.empty` | Styling | S | app.js 4780 |

**Abfrage für 14:** keine neue nötig. `DB.loadAll()` lädt `fines` vollständig (`select *`, db.js 24) in `DEMO.strafen`; `aktiveStrafen()` blendet Storno aus. Gruppieren je `playerId`, Summe über `strafeBetrag(s)` (enthält den Mahnzuschlag wie in Konto und Banner), Anzahl, ältestes `datum`, sortieren, alles rein rechnend. Bei 238 Strafen trivial. Rein rechnende Funktion (z. B. `ksOffenNachSpieler(liste)`) neben `ksSortieren` legen, damit `kassepruef.mjs` sie ohne Browser prüfen kann.

### 15 · Blatt Buchen (neu, ersetzt das bisherige Einzel-Buchen-Blatt)

| Element | Ist | Soll | Art | Aufwand | Fundstelle |
|---|---|---|---|---|---|
| Blatt | `ksBl` (`.tv-sheet.ks-bl`), Inhalt „buchen“ für **eine** Strafe, Kopf „Als bezahlt buchen“ mit Griff und `×` | Blatt weiß, Radius 18 oben, `--shadow-sheet`, Griff 36 × 5 `--dot-off`; über `blattAuf`/`blattZu` | Frontend-Logik | M | app.js 5643–5747 |
| Kopf | Summenkasten `.ks-bl-sum` (Name, Betrag, Vergehen · Datum) | Avatar 40 `--grad-av` 14/800; Name 19/800 −.02em; Nebenzeile „6 offene Strafen · 72,00 €“ 13 `--muted`; rechts Schließen 44 rund `--surface-6`, Kreuz 16 | Frontend-Logik + Styling | S | app.js 5676–5679 |
| Strafenliste | fehlt | Karte ohne Fläche, Rand `--line-soft`, Radius 14, 16 Rand; Zeile 56, Innenabstand 0 4 0 14; Kästchen 22 Radius 6 (an: `--green-700` mit weißem Haken 14; aus: Rand 1,5 `--dot-off`); Titel 16/700 Ellipse; Datum 13 `--muted`; Betrag 16/800 `--ink`; Menü ··· 44 × 44 (Symbol 20). **Alle vorausgewählt** | Frontend-Logik + Styling | M | neu |
| Trefferfläche Kästchen | – | 22 sichtbar: ganze Zeile schaltet um (Zeile 56 ≥ 44), Menü fängt den Tipp vorher ab (Muster `role="button"` wie `.krow`) | Frontend-Logik | S | neu |
| Menü ··· je Zeile | – | „Storno“ (mit Rückfrage, `cancel_fine`); bei automatischer Strafe stattdessen „Entfernen“ (`deleteFine`); **zusätzlich „Verlauf“** (heutiges Detail-Blatt, siehe Abschnitt 4) | Frontend-Logik | M | app.js 5900–5908, 5708–5720 |
| Angabe/Ablehnung je Zeile | in der Karte | Nebenzeile ergänzen: „10. Mai · Spieler: bar“ bzw. „Abgelehnt: Grund“ in `--red-700` | Frontend-Logik | S | app.js 4704–4710 |
| Gruppenkopf „Zahlart“ | `.lbl.ks-bl-lbl` | `.group-head` 12/700 Versal, 24 darüber, 8 darunter | Styling | S | app.js 5688 |
| Zahlart | `.zart-row`: drei Chips **PayPal · Bar · Überweisung**, 64 hoch, Symbol über Text, gewählt dunkelgrün `--grad-chip-on` | Segment 2-spaltig **Bar / PayPal** (Segment-Baustein, 38 hoch, weiße Pille). Überweisung muss bleiben → Segment 3-spaltig, siehe Abschnitt 7 | Frontend-Logik + Styling | S | app.js 4775, 5685–5689; styles.css 2725–2745 |
| Vorbelegung Zahlart | Angabe des Spielers, sonst PayPal; Hinweis „Vorausgewählt nach Angabe des Spielers.“ | nicht in der Vorlage. Vorschlag: haben alle angehakten Strafen dieselbe Angabe, diese; sonst PayPal. Hinweiszeile 13 px bleibt nur dann | Frontend-Logik | S | app.js 5684, 5690 |
| Zusammenfassung | keine (Betrag im Knopf) | hell: `--green-050`, Rand `--green-badge-line`, Radius 12, Innenabstand 12 14; links „2 Strafen, bar“ 15/600, rechts Betrag 21/800 `--green-800`; 16 unter dem Segment; folgt Auswahl und Zahlart | Frontend-Logik + Styling | S | neu (`.kasse-sum` hell, siehe 16) |
| Primärknopf | „12,00 € PayPal buchen“ (`.ks-bl-cta`, 52) | „Als bezahlt buchen“ 48, 12 unter der Zusammenfassung; gesperrt bei leerer Auswahl (Fläche `--line`, Schrift `--muted`) | Frontend-Logik + Styling | S | app.js 5691, styles.css 2753 |
| Buchen | `DB.markFinesPaid([id], method)` einzeln | `DB.markFinesPaid(ausgewählteIds, method)` in **einem** Aufruf; Toast „2 Strafen gebucht“; Rückgabe (Anzahl) mit Auswahl vergleichen und bei Abweichung melden | Frontend-Logik | S | app.js 5733–5747, db.js 464 |
| Detail-Blatt mit Verlauf und „Buchung rückgängig“ | `ksBlatt.art = "detail"` | bleibt, erreichbar über „Verlauf“ (Offen) und Tipp auf Zeile (Bezahlt) | – | – | app.js 5692–5698, 5749 |

**Reichen die bestehenden RPCs? Ja, kein Backend nötig.**

- `mark_fines_paid(p_ids uuid[], p_method text)` (0030, Z. 163–180) bucht beliebig viele Strafen in **einem** `update … where id = any(p_ids) and status in ('offen','gemeldet')`, also atomar. Rolle `treasurer`/`admin` wird in der Funktion geprüft, `grant … to authenticated` steht (0030, 0042b).
- Zahlarten: die Funktion verlangt nur einen nicht leeren Text. Auf `fines.payment_method` gibt es **keinen** Check (nur `reported_method` hat seit 0040 `in ('bar','ueberweisung','paypal')`). `bar` und `paypal` gehen also, `ueberweisung` ebenso. Die Werteliste hält heute nur der Client (`KASSE_ZAHLARTEN`).
- Mitteilung: der Trigger aus 0045 sammelt `zahlung_bestaetigt` je Spieler mit 1 Minute Karenz (`notify_sammeln(…, new.player_id::text, …)`). Eine Sammelbuchung ergibt daher **eine** Push an den Spieler („{anzahl} Strafen, {betrag} verbucht“).
- Storno je Zeile: `cancel_fine(uuid)` vorhanden; automatische Strafen entfernt die App heute mit `DB.deleteFine` (direktes `delete`, RLS). Beides sofort ausführen, nicht mit dem Buchen bündeln. Wer mehrere storniert, bekommt keinen gebündelten Storno-Push, sondern `notify_strafe_zurueckziehen` je Strafe (holt noch nicht versandte `strafe_neu` zurück); das ist das heutige Verhalten.
- Wünschenswert, aber nicht nötig: `mark_fines_paid` lehnt fremde Zahlarten nicht ab. Ein Check auf `payment_method` wäre eine Schema-Änderung und hat mit der Vorlage nichts zu tun (siehe Abschnitt 5).

### 16 · Strafe verhängen (Blatt)

| Element | Ist | Soll | Art | Aufwand | Fundstelle |
|---|---|---|---|---|---|
| Ablauf | Drei Stufen: Vollbild-Wähler `ksWahl` („Strafe aus Katalog hinzufügen“ / „Individuelle Strafe“) → Vollbild-Spielerauswahl `ksSheet` → Eingabeseite `#ksSeite` (an `<body>`, Kopf mit „‹ Zurück“, Titel „Strafe aus Katalog“, `×`) | **ein** Blatt „Strafe verhängen“; Spieler über „Auswählen ›“ (Spielerauswahl bleibt als Blatt darüber), „Individuell ›“ als Textverweis holt den Freitext-Block. Wähler entfällt | Frontend-Logik | L | app.js 5590–5637, 5466–5584, 4970–5017, 5087–5239 |
| Hülle | Vollbild `.ks-seite`, Fuß `.ks-fuss` fest unten | Blatt mit Griff, Kopf weiß mit Linie `--line`, Titel 19/800 −.02em links, Schließen 44 rund `--surface-6`; Inhalt `--bg`, Innenabstand 16. Fester Fuß bleibt (Konvention „Bestätigen sitzt unten“, Abschnitt 7) | Styling + Frontend-Logik | M | styles.css 2600–2638 |
| Hash `#strafe=katalog/individuell` | Zustand der Seite | bleibt (`#strafe=katalog` öffnet das Blatt, `individuell` mit offenem Freitext-Block) | Frontend-Logik | S | app.js 5136–5143, 6550–6558 |
| Spieler | `.kasse-picker` „3 Spieler gewählt ›“ plus Chips `.ks-gchip` | Gruppenkopf „Spieler“ mit „Auswählen ›“ 15/600 rechts; Chips entfernbar: 36 hoch, Innenabstand 0 8 0 14, `--green-050`, Rand `--green-badge-line`, 14/700 `--green-800`, Kreuz 12 (Trefferfläche 44 per `::after`) | Frontend-Logik + Styling | S | app.js 4997–5001, styles.css 2318, 2575–2590 |
| Gruppenkopf Katalog | „Aus dem Katalog“ + Hinweis „antippen zum Auswählen“ (`.kasse-sub`, 13 px/800) | `.group-head` „Aus dem Katalog“ (24 darüber), rechts „Individuell ›“; Hinweis **entfällt** | Frontend-Logik + Styling | S | app.js 4900 |
| Katalogliste | Einzelkacheln `.kasse-catrow`, gewählt grün getönt mit Rahmen, Kästchen `.ks-check` | **eine** weiße Karte, Rand `--line-soft`, Radius 14, Trennlinien; Zeile 52, Innenabstand 8 16; Kästchen 22 Radius 6 wie 15; Name 16/600; Staffel als Nebenzeile „je 5 Minuten“ 13; Betrag 16/800 `--green-800`. Gewählte Zeile **ohne** Tönung | Styling + Frontend-Logik | M | app.js 4874–4896, styles.css 2337–2364 |
| Menge ×n, Bezugsgröße Staffel | Plus/Minus und Eingabefeld unter der gewählten Zeile | nicht in der Vorlage, **bleiben** (unter der Zeile in derselben Karte) | – | – | app.js 4886–4894 |
| Marke „gestaffelt“ | Badge in der Zeile | entfällt; Staffel steht in der Nebenzeile | Frontend-Logik | S | app.js 4883 |
| Individuell | eigener Block mit Betrag, Grund, „Hinzufügen“, Chips | Block bleibt, öffnet über „Individuell ›“; Felder als gruppierte Zeilen | Frontend-Logik + Styling | M | app.js 4961–4968 |
| Datum und Kommentar | Gruppe „Datum & Kommentar“ (13/800), `input type=date`, Textarea | Gruppenkopf „Datum und Kommentar“; **eine** Karte mit zwei Zeilen 52 hoch, linkes Label 76 breit 13/600 `--muted`, Wert 16/500 („Fr, 2. Okt 2026“, „Optional“ als Platzhalter `--muted`) | Styling + Frontend-Logik | M | app.js 5006–5008 |
| Zusammenfassung | `.kasse-sum` **dunkel** (`--green-900`, Schrift weiß, Summe gold) mit vier Zeilen (Vorgang, Betrag je Spieler, Datum, Kommentar, Summe) | **hell**: `--green-050`, Rand `--green-badge-line`, Radius 12, Innenabstand 12 14; **eine** Zeile „1 Strafe für Paul Ebert“ 15/600 links, Betrag 21/800 `--green-800` rechts. Bei mehreren Spielern z. B. „6 Strafen für 3 Spieler“ | Styling + Frontend-Logik | S | app.js 4676–4689, styles.css 2305–2312 |
| Leere Zusammenfassung | „Erst Spieler auswählen.“ u. a. | Vorlage zeigt keinen Leerzustand; Hinweiszeile 13 px bleibt (Knopf gesperrt, Hinweis erlaubt) | – | – | app.js 4679–4681 |
| Primärknopf | `.ks-fuss-btn` 52, Text trägt das Ergebnis „3 Strafen · 30,00 € speichern“, gesperrt `opacity:.5` | „Strafe speichern“ 48; gesperrt Fläche `--line`, Schrift `--muted` („nie hellgrün“). Ergebnis steht in der Zusammenfassung | Frontend-Logik + Styling | S | app.js 5013–5015, 5148–5156; styles.css 2636–2637 |
| Speichern | `create_fines_batch` | unverändert | – | – | app.js 5307, db.js 442 |

### 17 · Strafenkatalog

| Element | Ist | Soll | Art | Aufwand | Fundstelle |
|---|---|---|---|---|---|
| Kopf | „Strafenkatalog“ 22 px plus Begleitsatz „Beträge gelten für die ganze Mannschaft. Änderungen wirken ab sofort.“ | Titel 26/800 links, rechts „+ Strafe“ Textverweis 15/700 `--green-800`, Mindesthöhe 44 (nur `canEditCatalog`); **Begleitsatz entfällt** | Frontend-Logik + Styling | S | app.js 4357–4358 |
| „Strafe hinzufügen“ | `.kat-add` gestrichelter Knopf unter der Liste | entfällt, ersetzt durch „+ Strafe“ im Kopf | Frontend-Logik + Styling | S | app.js 4365, styles.css 1500–1508 |
| Kachel | `.kat-item`: `--card`, Innenabstand 12 14, `--h-row`, Lücke über `.kat-list` | `--grad-card`, Rand `--line-soft`, Radius 14, `--shadow-card`, Innenabstand 8 16, Mindesthöhe 56 (Vorlage misst 74 bei zweizeiligem Namen), Lücke 8, 12 unter dem Titel | Styling | S | styles.css 1466–1471 |
| Name | 14/600 | 16/600, Zeilenhöhe 1,3 | Styling | S | styles.css 1472 |
| Staffel | Betrag „1,00 € / 5 Minuten“ 14 px, Marke „gestaffelt“, Nebenzeile „max 10,00 €“ 11 px | Betrag „1,00 €“ 16/800, Nebenzeile „je 5 Minuten“ 13 `--muted`; **Deckel bleibt**: „je 5 Minuten · max 10,00 €“. Marke entfällt | Frontend-Logik + Styling | S | app.js 4307–4326, styles.css 1474–1476 |
| Betrag | 16/800 `--green-800` | gleich, tabular, nowrap | – | – | – |
| Stift und Mülleimer | je Zeile `.kat-actions` (44er `.icon-btn`) | **entfallen**; Kachel trägt „›“ 18 `--green-chev` und ist als Ganzes antippbar (nur Bearbeitende) | Frontend-Logik | S | app.js 4322–4325 |
| Bearbeiten | Inline: die Kachel wird zum Formular `.kat-edit` mit Haken/Kreuz | Tipp öffnet **Bearbeiten-Blatt** `.kat-edit` (Felder wie heute) mit Primärknopf „Speichern“ und dort **„Löschen“** (Sekundär, rot, mit Rückfrage). Gleiches Blatt für „+ Strafe“ | Frontend-Logik + Styling | M | app.js 4328–4353, 5816–5821, Handler `data-kat-*` |
| Spieleransicht | Kacheln ohne Knöpfe | Kacheln ohne „›“, nicht antippbar | Frontend-Logik | S | app.js 4355 |
| Kategorien | nicht angezeigt (K5) | keine Kategorien, deckt sich | – | – | app.js 4314 |
| Autofokus | `nameInput.focus()` beim Inline-Bearbeiten | im Blatt **kein** Autofokus (Konvention „keine Fokus beim Öffnen“) | Frontend-Logik | S | app.js 4367–4368 |

---

### 2. Kernfragen

- **15 Blatt Buchen:** bestehende RPCs reichen (Begründung oben unter 15). `mark_fines_paid` nimmt `uuid[]`, prüft die Rolle, bucht atomar; erlaubt ist jede nicht leere Zahlart, `bar`, `paypal`, `ueberweisung` funktionieren. Storno je Zeile über `cancel_fine` bzw. `deleteFine`. Push wird vom bestehenden Sammler zu einer Nachricht je Spieler gebündelt. **Kein Backend.**
- **14 Offen nach Spielern gruppiert:** im Frontend aus `DEMO.strafen`, keine neue Abfrage.
- **Konto 11/12:** Zahlen für die Chips und „In der Kasse“ ebenfalls aus `DEMO.strafen`.

### 3. Begriffe

| Alt | Neu | Stellen |
|---|---|---|
| „Zu prüfen“ (Reiter) | „Gemeldet“ | app.js 5032; Leerzustand „Nichts zu prüfen“ 4740; Kachel „2 zu prüfen“ 5046 (entfällt) |
| „Eingegangen“ (Reiter, Chip) | „Bezahlt“ | app.js 4549, 5032, 5049 (entfällt); Leerzustand „Bestätigte Eingänge stehen hier.“ 4788 |
| Marke „eingegangen“ | „bezahlt“ | `STATUS_META["bestätigt"].label` app.js 210; wirkt auch im Verlauf (`histLineHtml`) |
| „Prüfen und verbuchen“ | entfällt | app.js 5059 |
| Kommentare, Konventionen | „Zu prüfen“/„Eingegangen“ | app.js 4613, 4629, 4785, 4808, 4813, 5822; `conventions.md` „Kasse: Reihenfolge statt Filter“, „Zahlart-Symbole“, Klassenzeile Kasse; Prüfskripte `.design-sync/shots/kassepruef.mjs`, `kassebild.mjs`, `kassekarte.mjs`, `kassemodul.mjs` prüfen die Texte und müssen mitgezogen werden |
| Push-Titel `zahlung_gemeldet` | heute „💰 {anzahl} zu prüfen“ (0045, Zeile 358; Daten in `notification_templates`) | sinngemäß „{anzahl} Zahlungen gemeldet“. Datenänderung, über die Ansicht Push-Texte (Admin) oder eine Datenzeile; **kein Schema**. Entscheidung beim Nutzer |

**Deep Link `#kasse=pruefen`:** bleibt technisch bestehen. Der Schlüssel steht in der Datenbank als Ziel der Vorlage `zahlung_gemeldet` (0036, Z. 355) und damit in bereits zugestellten Mitteilungen auf den Geräten; ein Umbenennen ließe alte Mitteilungen auf der Standardansicht landen. Empfehlung: interner Schlüssel `pruefen` bleibt (`kasse.tab`, `KS_TABS`, `data-kstab`, `data-task-pay`), `deepLinkZiel` nimmt zusätzlich `gemeldet` als Alias an (app.js 6534). Ebenso bleibt `#strafen=meine` (Ziel von vier Push-Vorlagen in 0036) und wird auf Segment Ich + Chip Offen abgebildet; `#strafen=alle` auf Segment Mannschaft; `offen|gemeldet|bezahlt` setzen den Chip im Segment Ich (app.js 6533).

### 4. Funktionen, die heute existieren und in der Vorlage fehlen (bleiben)

| Funktion | Heute | Vorschlag wo |
|---|---|---|
| Zahlart **Überweisung** | dritter Chip im Buchen-Blatt und in „Zahlung melden“ | drittes Segment „Überweisung“ in 15 (und in „Zahlung melden“). Breite: 352/3 ≈ 115 px reicht für „Überweisung“ 14/600 knapp; sonst Kurzform nur im Segment |
| Mahnzuschlag-Hinweis | `.mb-note` „inkl. X Mahnzuschlag“ | Unterzeile des Banners (11) |
| Automatische Strafe **entfernen** (statt Storno) | Knopf „Entfernen“ (`deleteFine`) | Menü ··· in 15 statt „Storno“ |
| **Verlauf** einer Strafe | Detail-Blatt per Tipp auf Karte (Offen, Gemeldet, Eingegangen) | Gemeldet: Tipp auf Karte bleibt; Offen: Menü ··· „Verlauf“ in 15; Bezahlt: Tipp auf Zeile bleibt |
| **Buchung rückgängig** | im Detail-Blatt (Bezahlt) | bleibt dort |
| Angabe des Spielers und Ablehnungsgrund an offenen Strafen | `.ks-sag`, `.fine-reason` in `.krow` | Nebenzeile je Zeile in 15; im Konto als Nebenzeile |
| Vorbelegung der Zahlart nach Angabe | Buchen-Blatt | 15, Regel siehe Tabelle |
| Zitat des Spielers in der Prüfkarte | `.ks-zitat` | bleibt in 13 unter der Meta-Zeile |
| Reiter „Bezahlt“ (Liste neueste Buchung zuerst) | `.ks-ein` | keine Vorlage; Liste bleibt im Stil 14 (eine Karte, Zeilen 60); dazu Summenzeile „58 Zahlungen“ / Betrag `--green-800` analog 14 |
| Summe aller **Gemeldet** und **Bezahlt** | Kacheln | Gemeldet in „1 von 8 · 104,00 €“, Bezahlt in der Summenzeile des Reiters, Mannschaft-Kachel „In der Kasse“ |
| Filter **„Alle“** im Konto (alle Status zusammen) | Chip „Alle“ | geht in der Vorlage nicht auf (Segment ersetzt nur „Meine“). Vorschlag: erneuter Tipp auf den aktiven Chip hebt die Auswahl auf und zeigt alle Status; sonst bewusst streichen (Nutzerentscheid) |
| „Gesamtvolumen Saison“ (offen + bezahlt) | Kachel „Kontostand“ | entfällt durch „In der Kasse“; bei Bedarf als Nebenzeile der Kachel. Nutzerentscheid |
| Menge ×n und Bezugsgröße bei Staffel | Eingabeseite | 16 unter der gewählten Katalogzeile |
| Gemischter Vorgang Katalog + individuell, mehrere Spieler | Eingabeseite mit „Auch …“ | 16 mit „Individuell ›“ und Spieler-Chips |
| Rückfrage beim Schließen mit Eingaben | `ksSeiteBeruehrt()` | bleibt im Blatt 16 |
| Hash-Zustand `#strafe=` | Eingabeseite | Blatt 16 |
| Spieler wischen im Prüfstapel, „Alle bestätigen“ je Zahlart gruppiert | vorhanden | bleibt |
| Countdown-Stufen (neutral, amber, rot, gedeckelt) | `.cd-*` | Vorlage zeigt rot. Vorschlag: Marke rot nur ab letzter Woche, sonst amber; gedeckelt neutral „Höchststand erreicht“. Nutzerentscheid |
| Konto nicht zugeordnet, schuldenfrei | Banner-Varianten | bleiben im Bannerstil |
| Rollen-Vorschau/Admin-Zugriff auf Kasse über „Mehr“ | vorhanden | unverändert |

### 5. Änderungen mit Schema oder Backend

**Keine.** Alle Screens 11 bis 17 lassen sich mit `confirm_fines`, `mark_fines_paid(uuid[], text)`, `reject_fine`, `cancel_fine`, `cancel_batch`, `create_fines_batch`, `report_my_payment(text,text)`, `deleteFine` und `loadAll` bauen.

Freiwillig, nicht durch die Vorlage veranlasst:
- Check-Constraint `payment_method in ('bar','ueberweisung','paypal')` analog `reported_method` (Schema, eigene Migration nach den Regeln in `conventions.md`).
- Text der Push-Vorlage `zahlung_gemeldet` ohne „zu prüfen“ (Datenzeile, siehe Abschnitt 3).
- `ksBlattUnpay` schreibt heute direkt auf `fines` (`setFinePaid`, db.js 416) statt über eine RPC; unverändert lassen, nur vermerkt.

### 6. Frühere Entscheidungen, die die Vorlage kippt

| Entscheidung | Wo festgehalten | Vorlage |
|---|---|---|
| Zusammenfassung `.kasse-sum` **dunkel** (`--green-900`, Summe gold) | styles.css 2305–2311; `conventions.md` Klassenliste; Flächensprache „Dunkelgrün bleibt der Handlung vorbehalten“ | **hell** (`--green-050`, Betrag 21/800 `--green-800`), eine Zeile statt fünf |
| Knopf trägt das Ergebnis („3 Strafen · 30,00 € speichern“, „12,00 € PayPal buchen“) | `conventions.md` „Eine Seite statt eines Abschnitts“, „Bestätigen sitzt unten“ | Knopf nur Verb („Strafe speichern“, „Als bezahlt buchen“), Ergebnis in der Zusammenfassung |
| „Offen“ **älteste Strafe zuerst**, je Strafe eine Karte („wer eine Schuld eintreibt, fängt bei der ältesten an“) | `conventions.md` „Kasse: Reihenfolge statt Filter“, `KS_REIHENFOLGE`, NOTES 26.09. | je Spieler, nach **Betrag**; die älteste Strafe steht nur noch in der Nebenzeile |
| Geisterkarten im Prüfstapel entfernt | NOTES 25.09. („Geisterkarten und Seitenpunkte sind entfallen“) | zwei Geisterkarten wieder sichtbar |
| Zahlart-Reihenfolge **PayPal · Bar · Überweisung**, drei Chips mit Symbol, gewählt dunkelgrün | NOTES 26.09. („bleibt entgegen dem Entwurf“), `KASSE_ZAHLARTEN`, `conventions.md` Zahlart-Symbole | Segment **Bar / PayPal**, ohne Symbole, gewählt weiße Pille |
| Drei Kennzahl-Kacheln oben in der Kasse, antippbar, Gold als `--amber-700` | NOTES 25.09., B6 | entfallen |
| Zähler in allen drei Reitern | `.ks-seg-n` | nur an „Gemeldet“ (Amber) |
| Gruppenkopf „Prüfen und verbuchen“ (B6) | app.js 5059, styles.css 1585 | entfällt |
| Kennzahl mit rotem Randstreifen (`.kpi.is-warn::before`) | styles.css 404 | getönte Kachel ohne Streifen |
| „Kontostand · Gesamtvolumen Saison“ = offen + bezahlt | app.js 4569–4573 | „In der Kasse“ = nur bezahlt (andere Zahl) |
| Strafe verhängen als **Vollbildseite** mit Wähler zweier Wege und Zurück | `conventions.md` „Eine Seite statt eines Abschnitts“, NOTES 26.09. | ein Blatt, Individuell als Textverweis |
| Katalog: Bearbeiten **inline** in der Kachel, Stift/Mülleimer | app.js 4307–4353 | Bearbeiten-Blatt per Tipp, Löschen dort |
| Konto-Banner mit Fortschrittsbalken | app.js 4403 („High End“) | ohne Balken |
| Countdown-Farbe nach Stufe | `.cd-neutral/amber/red` | Marke rot |
| Avatar der Prüfkarte ruhig (`--green-050`) | styles.css 2658–2661 | `--grad-av` mit Schatten |

### 7. Verbindliche Vorgaben, die von der Vorlage abweichen

| Vorgabe | Stelle in der Vorlage | Umsetzung |
|---|---|---|
| Trefferfläche ≥ 44 | Segment-Pillen 38 (11, 12, 13, 14, 15) | unsichtbares `::after` 44 hoch; Spur 46 bietet Platz |
| | Chips 36 (11, 12), Spieler-Chips 36 und Kreuz 12 (16) | `::after` 44; Kreuz eigene 44er-Fläche wie `.ks-ichip .chip-x::before` |
| | Kästchen 22 (15, 16) | ganze Zeile 52/56 als Trefferfläche |
| | Textverweise „Alle bestätigen“, „Zahlung melden ›“, „Auswählen ›“, „Individuell ›“ (Texthöhe 17–19) | `::after` 44 wie `.ks-kopf .link-btn` |
| | Amber-Zähler 20 im Segment | ist Teil der Pille, keine eigene Fläche |
| Kontrast ≥ 4,5:1 | `--muted` auf `--bg-2` | erst mit neuem `--muted` #5c6a63 (4,7:1); bis Token-Schritt 1 nicht auf `--bg-2` verwenden (heute `--muted-2`) |
| | Weiß auf `--grad-btn` | erst mit neuem `--grad-btn` (600 → 700); heute 3,88:1 (bekannt, Paket `.btn-primary`-Kontrast) |
| | Amber-Plakette, „8 gemeldet“ | `--amber-ink` #8a5a08 als Token anlegen (Vorlage inline Hex) |
| | „›“ in `--green-chev`, Geisterkarten | dekorativ, nicht textrelevant; „›“ hat zusätzlich die Zeilenbeschriftung |
| | Gesperrter Knopf | Fläche `--line`, Schrift `--muted` prüfen (Ziel 4,5:1, nicht `opacity:.5`) |
| Keine Gedankenstriche, keine ASCII-Umlaute in sichtbaren Texten | Vorlage sauber | **Ist** hat zwei Gedankenstriche im Konto (app.js 4386 „Zuordnung – danach“, 4411 „gemeldet – wartet“) und „—“ als Ersatztext in `vergehenName` (app.js 195). Beim Umbau ersetzen. Kommentare im Code bleiben ASCII wie bisher |
| Keine Funktion fällt weg | Überweisung, Entfernen (Auto), Verlauf, Rückgängig, Mahnzuschlag, Menge/Staffel, „Alle“, Kontostand | siehe Abschnitt 4 |
| Bestätigen sitzt unten (Konvention) | 16 hat den Knopf am Ende des Inhalts | fester Fuß `.ks-fuss` bleibt, Zusammenfassung direkt darüber im Scrollbereich |
| Eingabefelder 16 px | Datum/Kommentar als Zeilen | echtes `input type=date` und `textarea` mit 16 px in der Zeile, Label 13/600 links |
| Keine Emojis | – | Push-Titel `zahlung_gemeldet` trägt 💰 (Datenzeile, nicht Teil von C) |
| `--fs-etikett` .06em | Bannerkopf .08em | auf Token .06em vereinheitlichen oder Ausnahme dokumentieren |

---

## Umfang und Risiken (Kurzfassung)

1. Umfang: 7 Screens, rund 80 Zeilen Delta, überwiegend Styling und Frontend-Logik; **kein Schema, kein Backend**. Grob 4 bis 5 Tage, davon L: Blatt 16 (Wähler und Vollbildseite zu einem Blatt), M: Blatt 15, Offen gruppiert, Konto-Segment, Katalog-Blatt.
2. RPCs reichen: `mark_fines_paid(uuid[])` bucht mehrere Strafen atomar mit jeder Zahlart (kein Check auf `payment_method`), der Push-Sammler bündelt je Spieler.
3. Risiko Funktionsverlust: Überweisung, „Entfernen“ für Auto-Strafen, Verlauf, Konto-Filter „Alle“ und Kontostand fehlen in der Vorlage. Platz dafür ist im Abschnitt 4 vorgeschlagen; „Alle“, Kontostand und Countdown-Farbe brauchen eine Entscheidung.
4. Risiko Entscheidungen: Die Vorlage kippt 15 frühere Festlegungen (helle Zusammenfassung, Sortierung nach Betrag, Geisterkarten, Zahlart Bar/PayPal, Knopftext ohne Ergebnis u. a.). Vor dem Bau einzeln bestätigen lassen.
5. Risiko Technik: Deep Links `#kasse=pruefen` und `#strafen=meine` stehen in Push-Vorlagen der Datenbank und bleiben als Schlüssel. Die Prüfskripte `kassepruef/kassebild/kassekarte/kassemodul.mjs` hängen an alten Texten und Klassen und müssen mitwandern. Kontrastwerte sind erst nach Token-Schritt 1 (`--muted`, `--grad-btn`) erfüllt.

---

## Delta D und E: Einstellungen, Unterseiten, Profil

Stand 06.10.2026, nur gelesen. Code `main` `035d3fc` (Build `2026-10-06-A`), keine Änderung an Code oder Datenbank.

Quellen Soll: `PAKET-README.md` (Design-Tokens, Bausteine, D, E, „Wo Funktionen jetzt liegen“), `referenz/Final D Einstellungen und Anmeldung.dc.html`, `referenz/Final E Unterseiten.dc.html`, Maße aus `soll/*.json` (CSS-px bei 390, Ursprung x = 1 wegen Rahmen; Seitenrand also x 17 = 16 px).
Quellen Ist: `app.js`, `styles.css`, `index.html`, Aufnahmen `.design-sync/landkarte/bilder/admin/`, Paketdoku `.design-sync/reference/app/einstellungen-v2/PHASE0.md`.

**Ausgenommen** (nicht bauen, nur vermerkt):
- 22 Anmeldung und Onboarding.
- 21: „Position statt Rückennummer“. Die Zeile bleibt „Rückennummer“ (siehe 21).
- Mehr-Blatt (05) und Rollen-Screen (26, in der Vorlage per `show: !cap.startsWith('26')` ausgeblendet). Die Zeile „Rollen“ in 18 führt auf die bestehende Ansicht `renderAdmin()`.

**Stand des Vorgängerpakets:** E1 bis E6 sind gebaut (Hauptseite, Mitteilungen, Ruhezeiten, Kalender-Abo nach `einst1–3.png`). E7 (BFV), E8/E9 (Push-Texte als Unterseite, Bearbeiten als 3. Ebene) und E10 (Diagnose als Unterseite) sind **nicht** gebaut: Push-Texte ist noch die eigene Ansicht `pushkatalog` („Push-Nachrichten“, `app.js:1385`), Diagnose noch das Overlay `window.__showDiag` aus `index.html:99`. Die Delta-Liste geht vom Code aus, nicht vom Plan.

---

### 0. Gemeinsame Bausteine (gelten für alle Screens unten)

Einmal bauen, dann wirken sie auf 18 bis 28. In den Screen-Tabellen steht nur noch, was davon abweicht.

| Element | Ist | Soll | Art | Aufwand | Fundstelle im Code |
|---|---|---|---|---|---|
| Token `--muted` | `#66756d` | `#5c6a63` (5,7:1 auf Weiß) | Styling | S | `styles.css:65` |
| Token `--grad-btn` | `--green-550 → --green-650` | `--green-600 → --green-700` | Styling | S | `styles.css:105` |
| Token `--h-btn` | 46 px | 48 px | Styling | S | `styles.css:175` |
| Token `--shadow-card` / `--shadow` | `0 0 0 1px rgba(16,40,30,.06), 0 3px 8px -3px rgba(16,40,30,.20)` | `0 1px 1px rgba(16,40,30,.04), 0 8px 20px -14px rgba(16,40,30,.45)` (Vorlage-Token, gemessen in allen JSON) | Styling | S (wirkt app-weit) | `styles.css:143`, `:159` |
| Neue Tokens | fehlen | `--amber-ink #8a5a08`, `--amber-line #ecd3a6`, `--fs-*`, `--sp-1…6`; für D/E nur `--fs-titel`, `--fs-zeile`, `--fs-neben`, `--fs-etikett` nötig | Styling | S | `styles.css` `:root` (die App hat keine `tokens/tokens.css`/`_ds_app.css`, Tokens liegen in `styles.css`) |
| Zurück-Verweis „‹ Einstellungen“ | klebende Leiste `.ein-kopf` 52 hoch, 17/500 `--green-700`, Chevron 26 px, Titel klappt beim Scrollen hinein | Textzeile 15/600 `--green-800`, Höhe 44, oben 12 px Innenabstand (y 71), nicht als Leiste gezeichnet | Styling | S | `einKopfHtml` `app.js:2046`, `.ein-kopf`/`.ein-back` `styles.css:989–1018` |
| Seitentitel Unterseite | `.ein-h1` 26/800, `-.025em`, Rand `7 0 22` | 26/800, `-.02em` (−0,52 px), Oberkante y 115 direkt unter dem Verweis, erste Karte 16 px darunter (y 162) | Styling | S | `styles.css:1021` |
| Gruppenkopf `.group-head` | `.ein-titel`/`.ein-gkopf-t` 11/700, `.68px`, `--green-700`, Einzug 15 px | 12/700 Versal, `.06em`, `--muted`, **kein Einzug** (x 17 = Kartenkante), 24 über, 8 unter | Styling | S | `styles.css:1055`, `:1160–1164` |
| Karte (Zeilengruppe) | `.ein-gruppe`: `--card`, Rand 1 px `--line`, `--shadow`, Abstand 22 | `--grad-card`, Rand 1 px `--line-soft`, Radius 14, `--shadow-card` | Styling | S | `styles.css:1060` |
| Trennlinie in der Karte | ab x 55 (hinter der Kachel) | über die volle Breite, `border-top: 1px solid var(--line)` | Styling | S | `styles.css:1075`, `:1150` |
| Chevron „›“ | 20 px `--muted`, Deckkraft .6 | 18 px `--green-chev` (`#4c7a64`), bei roten Zeilen `--red-chev` | Styling | S | `.ein-chev` `styles.css:1093` |
| iOS-Schalter `.sw` | 51 × 31, Rand 1 px `--line`, aus `--surface-3`, an `--grad-chip-on` (750→900), Knauf 25 px, `--shadow-sm` | 51 × 31 ohne Rand, aus `--line`, an flach `--green-700`, Knauf 27 px bei 2 px, Schatten `0 2px 4px rgba(0,0,0,.2)` | Styling | S | `styles.css:1273–1292` (Trefferfläche `::after` 44 bleibt) |
| Primärknopf | Unterseiten: `.btn.btn-primary` (`--green-800` flach bzw. `styles.css:2950`), Abo-Blatt `--grad-chip-on` | `.btn-primary`: `--grad-btn`, 48 hoch, Radius 12, 16/700 weiß, `--shadow-btn`; einer pro Ansicht | Styling | S | `styles.css:875`, `:1192`, `:2950` |
| Sekundärknopf | `.btn-soft` 15 px, `#eef2ef` | `.btn-soft`: `--grad-btn-sec`, Rand 1 px `--line-soft-3`, `--shadow-btn-sec`, 16/700 `--ink`, 48 (+2 Rand = 50 gemessen) | Styling | S | `styles.css:873`, `:2959` |
| Statuskarte (20, 24) | gibt es nicht | Karte, Innenabstand 16, Spalte mit Abstand 8 bis 10: Titel 16/700 links, Marke rechts (12/700, Pille, Innenabstand 3 10), darunter Satz 13 `--muted` | Styling + Markup | S | neu |
| Unterseiten-Zeile (E) | `.ein-zeile` 48 hoch, 16/500 | Titel 16/600, Nebenzeile 13 `--muted` Zeilenhöhe 1,4, Wert rechts 15/500 `--muted`, optional Schalter / Chevron / Nummernkreis | Styling | S | `einZeileHtml` `app.js:2058` |
| Zeilenhöhe E | – | Vorlage: `min-height:56px; padding:8px 16px`. Die Vorlage rechnet `content-box`, gemessen also **72/73 px**; die App hat `* { box-sizing: border-box }` (`styles.css:186`) und käme auf **56 px**. **Entscheidung nötig**, Empfehlung 56 (passt zu „Listenzeile 52 bis 60“ im README; 72 ist ein Rechenrest der Vorlage). | Styling | S | – |

---

### 18 Einstellungen

Soll: `soll/18 Einstellungen.png/.json`, Höhe 917. Ist: `renderEinUebersicht` `app.js:2153`, Aufnahme `landkarte/bilder/admin/einstellungen.png`.

| Element | Ist | Soll | Art | Aufwand | Fundstelle im Code |
|---|---|---|---|---|---|
| Titel „Einstellungen“ | `.page-head.ein-start h1` 26 px, `margin-top:-3px` | 26/800, `-.02em`, Oberkante y 79 (20 px unter der Kopfzeile), Breite 358 | Styling | S | `app.js:2165`, `styles.css:1110` |
| Profilzeile Karte | `.ein-profil` 12/14 Innenabstand, 81 hoch, Rand `--line`, Abstand 22 | Karte 358 × 74 (min. 72), y 126 (16 unter Titel), Innenabstand 0 16, Abstand 12 | Styling | S | `app.js:2167`, `styles.css:1036` |
| Avatar | 54 px, Initialen 18 | 44 px, `--grad-av`, `--shadow-av`, Initialen 15/800 `--green-800` | Styling | S | `styles.css:1046` |
| Name | 18/800 | 16/700 | Styling | S | `styles.css:1048` |
| Rollenzeile | 13/500: „Administrator · Spieler“ (`ROLE_LABEL`, höchste zuerst) | 13/400 `--muted`: „Admin · Spieler · Profil ansehen“ (Kurzform „Admin“, Zusatz „Profil ansehen“) | Frontend-Logik | S | `einRollenText` `app.js:2145`, `ROLE_LABEL` `app.js:6978` |
| E-Mail in der Profilzeile | dritte Zeile 13/500 | **entfällt hier**, wandert ins Profil (README „Wo Funktionen jetzt liegen“) | Markup | S | `app.js:2172` |
| Gruppe 1 Kopf | ohne Kopf | Kopf „Für mich“ (y 224, Karte ab y 247) | Markup | S | `app.js:2177` |
| Gruppe 1 Zeilen | Mitteilungen · Ruhezeiten · Kalender-Abo | Mitteilungen „An“ · Ruhezeiten „22 bis 8 Uhr“ · **Kalender abonnieren** „Aus“ | Markup + Frontend-Logik | S | `app.js:2178–2180`, `EIN_SEITEN` `app.js:1940` |
| Wert Mitteilungen | „An“ / „Aus“ / „Nicht eingerichtet“ | „An“ (Vorlage zeigt nur den Fall an); übrige Werte bleiben, Kurzform prüfen (Breite) | Frontend-Logik | S | `einMitteilungenWert` `app.js:2123` |
| Wert Ruhezeiten | „22:00 bis 08:00“ bzw. „Aus“ | „22 bis 8 Uhr“: volle Stunden ohne „:00“ und ohne führende Null, sonst „22:30 bis 8 Uhr“ | Frontend-Logik | S | `einRuhezeitWert` `app.js:2132` |
| Wert Kalender abonnieren | keiner | „Aus“ / „An“ aus `currentProfile.calendar_subscribe_started_at` (dieselbe Quelle wie Statuskarte 20) | Frontend-Logik | S | `hinweisMerken` `app.js:909` |
| Gruppe Verwaltung Kopf | `.ein-titel` grün 11 px | „Verwaltung“ nach Gruppenkopf-Baustein (y 431) | Styling | S | `app.js:2184` |
| Zeile Spielplan | „Spielplan (BFV)“, Wert Teamname, abgeschnitten „Spielplan (B…“ / „SV Musterhause…“ | „Spielplan BFV“, Wert „Verbunden“ bzw. „Nicht verbunden“ (aus `DEMO.icalUrl`), nur Admin | Frontend-Logik | S | `app.js:2186` |
| Zeile Strafenkatalog | Kachel gold, Symbol `liste` | Kachel einheitlich, Symbol Buch (`book`), Sprung `goto: katalog` bleibt | Styling | S | `app.js:2187` |
| Zeile Push-Texte | `goto: pushkatalog` (eigene Ansicht), nur Admin | Unterseite `#ein=pushtexte`, nur Admin | Frontend-Logik (Route) | M | `app.js:2188`, `EIN_SEITEN`, `SHEET_VIEWS` `app.js:416` |
| Zeile Rollen | **fehlt** (Rollen nur im Mehr-Blatt `#moreAdmin`) | neue Zeile „Rollen“, Wert Mitgliederzahl („16“), Symbol Person, nur Admin, Ziel: bestehende Ansicht `admin` (`renderAdmin`) | Frontend-Logik + Abfrage | S | neu; `renderAdmin` `app.js:7172`, `DB.listMembers` `db.js:577` |
| Zahl hinter Rollen | – | braucht `DB.listMembers()` (admin-only, schon vorhanden) oder `DEMO.players.length`; Empfehlung: Zahl erst nach dem Laden, vorher ohne Wert (kein Warten beim Öffnen) | Abfrage | S | `db.js:577` |
| Gruppe Info | Diagnose (Overlay), App neu laden ohne Chevron | „Info“: Diagnose `#ein=diagnose` ›, App neu laden (Vorlage mit ›, siehe Abschnitt 4) | Frontend-Logik | M (mit 27) | `app.js:2193–2194`, Handler `app.js:5926` |
| Symbolkacheln | 30 × 30, Radius 8, vier Flächenfarben (`gruen` `--green-650`, `dunkelgruen` `--green-900`, `gold` `--gold-chev`, `grau` `--muted`), Symbol weiß | **einheitlich** 32 × 32, Radius 9, Fläche `--green-050` (`#e9f3ee`), Liniensymbol 18 px `--green-800`, Strich 1,8 | Styling | S | `.ein-ic*` `styles.css:1079–1088`, Aufrufe mit `ton:` `app.js:2178–2194` |
| Symbole (Pfade Vorlage) | eigene: `glocke`, `mond`, `kalender`, `tabelle`, `liste`, `sprech`, `puls`, `neu` | bell `M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5h4`, moon, cal, list (Tabelle), **book** `M5 4h14v16H7a2 2 0 0 1-2-2zM5 18a2 2 0 0 1 2-2h12M9 8h6M9 11h4`, msg, **user** `M12 12a4 4 0 1 0 0-8a4 4 0 0 0 0 8zM4 20a8 8 0 0 1 16 0`, pulse, reload | Styling (SVG) | S | `einIcon` `app.js:2092` |
| Zeile | 48 hoch, Innenabstand 7 19 7 13, Titel 16/500 | 52 (53 mit Linie), Innenabstand 0 16, Abstand 12, Titel 16/600 (x 78), Wert 13/400 `--muted` | Styling | S | `styles.css:1066–1094` |
| Abmelden | eigene Karte rot 16/700 unter Info | **fehlt in 18**, liegt jetzt im Profil (21) | Markup | S | `app.js:2197` |
| Build-Zeile | `.ein-build` 12 px unter Abmelden | **fehlt in 18**; Build steht in Diagnose › Version (27) | Markup | S | `app.js:2160`, `:2201` |
| Abstände Gruppen | 22 / Kopf 24+8 | Kopf 24 über, 8 unter; Karten y 247 / 454 / 714 | Styling | S | – |

---

### 19 Mitteilungen

Soll: `soll/19 Mitteilungen.png/.json`, Höhe 610. Ist: `pushAbschnittHtml("mitteilungen")` `app.js:1826`, `pnAbschnittHtml` `:1783`, `pnGruppenHtml` `:1703`, `PN_GRUPPEN` `:1612`.

| Element | Ist | Soll | Art | Aufwand | Fundstelle im Code |
|---|---|---|---|---|---|
| Kopf | `einKopfHtml` + `.ein-h1` | Baustein „‹ Einstellungen“ (y 71) + Titel (y 115) | Styling | S | `app.js:2233` |
| Hauptschalter-Karte | Zeile mit grüner Glocke, „Push auf diesem Gerät“, Hinweis darunter „Gilt nur hier. Die Auswahl darunter gilt für alle deine Geräte …“ | eigene Karte 358 × 62 (min. 60), **ohne Kachel**, Titel „Mitteilungen erlauben“ 16/700, Nebenzeile „Auf diesem iPhone aktiv“ 13 `--muted`, Schalter rechts (x 307) | Markup + Styling | S | `app.js:1793–1798` |
| Nebenzeile Hauptschalter | – | zustandsabhängig: „Auf diesem iPhone aktiv“ / „Auf diesem Gerät aktiv“ (Android, Desktop) / „Auf diesem iPhone aus“; Gerätename aus `istAppleGeraet()` | Frontend-Logik | S | `app.js:942` |
| Hinweis „Gilt nur hier …“ | Zeile unter der Karte | in der Vorlage nicht vorhanden; Empfehlung: entfällt, sein Inhalt steckt in „Auf diesem iPhone“ | Markup | S | `app.js:1797` |
| Gliederung | nach Rolle: Spieler, Trainer, Kasse (nur was man ist), Kopf mit Sammelschalter „Alle“ | nach Thema: „Termine“, „Strafen“; kein Sammelschalter | Frontend-Logik | M | `PN_GRUPPEN`, `pnGruppenFuer` `app.js:1639` |
| Zeile | Kachel 30 farbig, Titel 16/500, Beschreibung aus `notification_infos` 13 px, Schalter | **ohne Kachel**, Titel 16/600 (x 34), **ohne Nebenzeile**, Schalter rechts, Zeile 52/53 | Styling + Markup | S | `einSchalterZeileHtml` `app.js:1687`, `pnZeileHtml` `:1696` |
| Termine: „Neuer oder geänderter Termin“ | zwei Schalter `termin_neu` („Neue Termine“), `termin_geaendert` („Termin geändert“) | ein Schalter | Frontend-Logik | S (ein Schalter schreibt beide Felder; „gemischt“ zeigt sich als an) | `app.js:1621–1622` |
| Termine: „Erinnerung vor Meldeschluss“ | `rueckmeldung_erinnerung` „Erinnerung an Zu- oder Absage“ | Name aus der Vorlage | Frontend-Text | S | `app.js:1619` |
| Termine: „Aufstellung veröffentlicht“ | **gibt es nicht** (keine Kategorie, kein Erzeuger) | in der Vorlage an | Schema + Backend (falls gebaut) | L | – (siehe Abschnitt 3) |
| Strafen: „Neue Strafe“, „Zahlung bestätigt“ | vorhanden (`strafe_neu`, `zahlung_bestaetigt`) | gleich | – | – | `app.js:1616–1617` |
| Weitere Kategorien | `zahlung_abgelehnt`, `termin_abgesagt`, `strafen_offen`, Trainer `absage_kurzfristig`, `meldeschluss_uebersicht`, Kasse `zahlung_gemeldet` | in der Vorlage nicht gezeigt | bleiben (Abschnitt 2) | S | `app.js:1618–1633` |
| „Zu wenig Zusagen“ | ausgeblendet (F4) | nicht in der Vorlage | unverändert ausgeblendet | – | Kommentar `app.js:1627` |
| Gruppenkarten | Abstand Kopf 25/11 | Termine-Karte y 271 (Kopf y 248), Strafen-Karte y 478 (Kopf y 455) | Styling | S | `styles.css:1160` |
| Schalter aus | `--surface-3` mit Rand | `--line` (`#e2e8e4`) ohne Rand, Knauf links bei 2 px | Styling | S | `styles.css:1273` |

---

### 20 Kalender abonnieren

Soll: `soll/20 Kalender-Abo.png/.json`, Höhe 606. „Eine Ebene statt Seite plus Blatt“. Ist: Unterseite `app.js:2215–2227` (zwei Zeilen „Termine abonnieren“ öffnet `openCalSheet`, „Link kopieren“), Blatt `openCalSheet` `app.js:955–1031`.

| Element | Ist | Soll | Art | Aufwand | Fundstelle im Code |
|---|---|---|---|---|---|
| Titel | „Kalender-Abo“ | „Kalender abonnieren“ (auch in der Leiste und in `EIN_SEITEN`) | Frontend-Text | S | `app.js:1943` |
| Statuskarte | fehlt | Karte 358 × 97 (y 162): „Status“ 16/700, Marke „Nicht eingerichtet“ (`--line`/`--ink`) bzw. „Eingerichtet“ (`--green-badge-bg`/`--green-800`), Satz „Termine erscheinen im Handy-Kalender und bleiben aktuell.“ 13 `--muted` (zweizeilig, 324 breit) | Markup + Frontend-Logik | S | neu |
| Quelle des Status | – | `currentProfile.calendar_subscribe_started_at` (gesetzt beim Tippen auf Abonnieren/Kopieren/Google); kein echter Nachweis eines Abos, nur „begonnen“. Für „Eingerichtet“ reicht das nach Vorlage; ein echter Nachweis bräuchte Zugriffsprotokoll im Feed (nicht vorgeschlagen) | Frontend-Logik | S | `app.js:909–921` |
| Gruppe „iPhone und iPad“ | im Blatt: Karte „iPhone und iPad“, Knopf „Zum Kalender hinzufügen“ (`webcal:`) | Gruppenkopf (y 283) + Primärknopf „Im iPhone-Kalender abonnieren“ 358 × 48 (y 306), Ziel `webcal:`-Adresse direkt | Markup + Frontend-Logik | M (Token muss beim Rendern da sein: `ensureCalendarToken` vorziehen) | `app.js:957–966` |
| Gruppe „Android und Google“ | im Blatt: Hinweis, drei Schritte, „Link kopieren“ (primär), „calendar.google.com öffnen“ (sekundär), Fußzeile 24 h | Kopf (y 378) + **Sekundär**knopf „Link kopieren“ 358 × 50 (y 401), darunter Zeile min. 44: „Google übernimmt Änderungen bis zu 24 h später.“ 13 `--muted` links, „Anleitung ›“ 15/600 `--green-800` rechts; Schritte und Google-Knopf ins Blatt 28 | Markup | M | `app.js:967–981` |
| „Link zurücksetzen“ | Textverweis im Blatt, `window.confirm` | eigene Karte 358 × 62 (y 519, 20 über): „Link zurücksetzen“ 16/700 `--red-700`, „Der alte Link funktioniert danach nicht mehr.“ 13 `--muted`, Chevron `--red-chev`; Rückfrage bleibt | Markup | S | `app.js:993`, Handler `:1016` |
| Rückmeldung „Link kopiert“ / „Neuer Link erstellt“ | `.cal-copied` im Blatt bzw. `data-cal-copied-profil` | bleibt, unter dem betroffenen Knopf (Vorlage zeigt keinen Zustand) | Markup | S | `app.js:2227` |
| Hinweis unter der Karte | „Alle Termine der Mannschaft landen automatisch …“ | entfällt (Satz steckt in der Statuskarte) | Markup | S | `app.js:2225` |
| Reihenfolge nach Gerät | Blatt stellt Android zuerst, wenn erkannt (`zuerstAndroid`) | Vorlage: iPhone zuerst | Frontend-Logik, Entscheidung | S | `app.js:982` |
| Gesperrt ohne Token | `aria-disabled` an beiden Knöpfen | Primärknopf gesperrt: Fläche `--line`, Schrift `--muted` (README) | Styling | S | `app.js:960` |

---

### 21 Profil

Soll: `soll/21 Profil.png/.json`, Höhe 570. Ist: `renderProfil` `app.js:2244`, Aufnahme `landkarte/bilder/admin/profil.png`.

| Element | Ist | Soll | Art | Aufwand | Fundstelle im Code |
|---|---|---|---|---|---|
| Ebene | eigene Ansicht `profil` mit `.page-head` „Profil“, ohne Zurück | Unterseite mit „‹ Einstellungen“ (y 71), **ohne** Seitentitel | Frontend-Logik (Route) | M | `app.js:439`, Sprung `data-view-jump="profil"` `app.js:2167`, `DEEP_ANSICHTEN` `app.js:6511` |
| Kopf | Karte `.pr-head`: Avatar links, Name, „Spieler · Administrator · Nr. 6“ | ohne Karte, zentriert: Avatar 76 (y 123), Initialen 26/800; Name 22/800 `-.02em` (y 207); Rollenpillen (y 241) | Markup + Styling | S | `app.js:2284–2287` |
| Rollenpillen | Text, Reihenfolge aus `Roles.list` (nicht sortiert, anders als 18) | Pillen 12/700, Innenabstand 3 10: „Admin“ `--grad-gold`, Rand `--gold-line`, `--gold-ink`; „Spieler“ `--line`/`--ink`; höchste zuerst (`einRollenText`-Folge); Trainer `--green-badge-bg`/`--green-800`, Kassenwart `--amber-050`/`--amber-ink` (aus E-Datei, Rollen-Tags) | Frontend-Logik + Styling | S | `app.js:2249` |
| Gruppe „Konto“ | fehlt | Kopf (y 288) + Karte 358 × 160 mit Zeilen 52/53: Etikett links 84 breit 13/600 `--muted`, Wert 15/500 | Markup | S | neu |
| Zeile E-Mail | (stand in 18) | Wert `currentProfile.email`, eine Zeile mit Auslassung, ohne Chevron | Markup | S | – |
| Zeile Position | – | **ausgenommen.** Stattdessen „Rückennummer“ mit `player.nr`, ohne Chevron (nicht änderbar), nur wenn ein Spieler verknüpft ist | Markup | S | `app.js:2250` |
| Zeile Passwort „Ändern ›“ | **gibt es nicht** im Profil (nur „Passwort vergessen?“ in der Anmeldung und das Reset-Formular) | Zeile führt in ein Blatt „Neues Passwort“ (Feld 16 px, Primärknopf), nutzt `DB.updatePassword` | Frontend-Logik | M | `db.js:558`, Formular `app.js:7137–7151` als Vorbild |
| Abmelden | in 18 als rote Kartenzeile | Sekundärknopf 358 × 50 (y 495, 24 über), Rand 1 px `--red-line`, Schrift 16/700 `--red-700`; Rückfrage `window.confirm` bleibt | Markup + Styling | S | Handler `app.js:5937` |
| „Mein Fitnessstatus“, „Meine Rückmeldungen“ | vorhanden | nicht in der Vorlage | bleiben (Abschnitt 2) | – | `app.js:2288–2294` |
| Konto ohne Spieler | `.empty` „Dein Konto ist noch keinem Spieler zugeordnet …“ | nicht in der Vorlage | bleibt, unter der Gruppe Konto | S | `app.js:2294` |

---

### 23 Ruhezeiten

Soll: `soll/E 23 Ruhezeiten.png/.json`, Höhe 559. Ist: `pnRuhezeitHtml` `app.js:1733`, `pnZeitZeileHtml` `:1763`.

| Element | Ist | Soll | Art | Aufwand | Fundstelle im Code |
|---|---|---|---|---|---|
| Aufbau | drei Karten: „Nachts nicht stören“, Von/Bis, „Dringendes trotzdem zustellen“, zwei Hinweise darunter | zwei Gruppen mit Kopf: „Nachts stumm“ (Karte 358 × 220, y 193) und „Ausnahmen“ (Karte 358 × 74, y 460) | Markup | S | `app.js:1740–1755` |
| Hauptschalter | „Nachts nicht stören“ | „Ruhezeiten aktiv“, erste Zeile der Karte „Nachts stumm“ | Frontend-Text | S | `app.js:1741` |
| Hinweis „In diesem Zeitraum kommt nichts an. Was liegen bleibt, wird danach zugestellt.“ | unter der Karte | nicht in der Vorlage; Folge nicht sichtbar, also nach README-Regel als eine Zeile 13 px unter der Karte behalten | Markup | S | `app.js:1744` |
| Von / Bis | Zeit-Pille 70 × 36, `--surface-6`, 16/700, unsichtbares `input type=time` darüber | Zeilen in derselben Karte: Titel 16/600, Wert rechts 15/500 `--muted` („22:00“), Chevron; Wert bleibt 24-h-Anzeige, das native Feld liegt weiter unsichtbar über der rechten Seite (≥ 44 hoch) | Styling + Markup | S | `styles.css:1119–1145` |
| Ausnahmen: „Spieltag · Am Spieltag immer zustellen“ | **gibt es nicht**. Vorhanden ist „Dringendes trotzdem zustellen“ (`quiet_override_urgent`, nur `urgency = high`) mit Hinweis „Kurzfristige Absagen, Terminausfall, Terminänderung und die Erinnerung an die Rückmeldung.“ | Schalter mit Nebenzeile | Entscheidung: (a) bestehenden Schalter in der Vorlagenform zeigen, Titel/Nebenzeile wahr lassen („Dringendes zustellen · Absagen, Ausfall, Änderung, Erinnerung“) = Frontend S; (b) wörtlich „Spieltag“ = Schema + Backend L | S bzw. L | `app.js:1749–1755` |
| Sichtbarkeit Von/Bis und Ausnahme | nur wenn Ruhezeit an | Vorlage zeigt Zustand „an“ | unverändert | – | `app.js:1745` |
| Ohne eingerichtetes Push | Karte „Ruhezeiten gelten für Benachrichtigungen …“ + „Zu den Mitteilungen“ | nicht in der Vorlage | bleibt, neue Kartenoptik, Knopf als `.btn-soft` | S | `app.js:1837–1841` |
| Wert in 18 | „22:00 bis 08:00“ | „22 bis 8 Uhr“ | siehe 18 | S | `app.js:2132` |

---

### 24 Spielplan BFV

Soll: `soll/E 24 Spielplan BFV.png/.json`, Höhe 722. Ist: `bfvSectionHtml` `app.js:1194` (E7/F9 nicht gebaut).

| Element | Ist | Soll | Art | Aufwand | Fundstelle im Code |
|---|---|---|---|---|---|
| Titel | h1 „Spielplan (BFV)“ **und** h3 „Spielplan (BFV)“ in der Karte | nur „Spielplan BFV“ | Markup + Text | S | `app.js:1217`, `:1944` |
| Statuskarte | Fließtext „Zuletzt aktualisiert: 02.10.2026, 08:27 Uhr. Läuft zusätzlich täglich automatisch.“ | Karte 358 × 79 (y 162): „Verbindung“ 16/700, Marke „Verbunden“ (`--green-badge-bg`/`--green-800`), Satz „Zuletzt abgeglichen heute, 14:30“ (relativ: heute/gestern/Datum) | Markup + Frontend-Logik | S | `app.js:1196`, `:1203`, `fmtTs` |
| „Läuft zusätzlich täglich automatisch.“ | Teil des Fließtexts | nicht in der Vorlage; Folge nicht sichtbar → eine Hinweiszeile 13 px unter dem Knopf behalten | Markup | S | `app.js:1203` |
| Gruppe „Mannschaft“ | Label MANNSCHAFT, Name fett, Verweis „Ändern“ | Kopf (y 265) + Karte 358 × 220 (y 288): Verein „FC Fasanerie-Nord“, Mannschaft „Herren 2“ ›, Saison „2026/27“ | Markup + Frontend-Logik | M | `app.js:1199–1201` |
| Verein / Mannschaft trennen | ein Feld `clubs.team_name` („FC Fasanerie-Nord 2“) | zwei Werte | Frontend-Logik: Verein = Teamname ohne Zählnummer bzw. fester Vereinsname, Mannschaft = Rest; Bezeichnung „Herren 2“ gibt es in den Daten nicht. Empfehlung: Verein „FC Fasanerie-Nord“, Mannschaft = `team_name` | S | `db.js:54` |
| Saison | nicht gespeichert | „2026/27“ | Frontend-Logik: aus dem heutigen Datum (Juli bis Juni), keine Spalte nötig | S | – |
| Mannschaft › | „Ändern“ setzt `bfvEditing` (Adressfeld) | Tippen auf die Zeile = Ändern | Frontend-Logik | S | `data-bfv-change` |
| Gruppe „Verbindung“ / „Verbindung trennen“ | **gibt es nicht** | Karte 358 × 74 (y 555): „Verbindung trennen“ 16/600 `--red-700`, „Bereits übernommene Spiele bleiben.“ 13 `--muted`, › | Frontend-Logik | S | neu; `DB.setIcalUrl("")` (`db.js:283`) setzt `ical_url = null` (`set_ical_url`, Migration 0051). Rückfrage nötig. |
| Folge „Spiele bleiben“ | – | stimmt: `api/sync-bfv.js:151` bricht ohne URL mit 400 ab, `sync_bfv_matches` läuft nicht, nichts wird abgesagt. Nebenwirkung: der nächtliche Cron meldet jede Nacht 400 (nur Protokoll) | – | – | `api/sync-bfv.js:150–151` |
| „Jetzt aktualisieren“ | `.btn.btn-primary` in der Karte | Primärknopf „Jetzt abgleichen“ 358 × 48 (y 649, 20 unter der letzten Karte) | Text + Styling | S | `app.js:1205` |
| Zustand „nicht verbunden“ | Adressfeld, „Speichern“, „Abbrechen“ | nicht in der Vorlage | bleibt (Abschnitt 2) | S | `app.js:1206–1214` |
| Meldung `bfvMsg` | `.bfv-msg` | nicht in der Vorlage | bleibt, 13 px unter dem Knopf | S | `app.js:1197` |
| Chevron „Verbindung trennen“ | – | Vorlage `--green-chev` (in 20 bei roter Zeile `--red-chev`); Empfehlung einheitlich `--red-chev` | Styling | S | – |

---

### 25 Push-Texte

Soll: `soll/E 25 Push-Texte.png/.json`, Höhe 632. Ist: `renderPushKatalog` `app.js:1385`, `katZeileHtml` `:1322`, `katStrafhinweisHtml` `:1377`, Aufnahme `landkarte/bilder/admin/push-nachrichten.png`. Nur Admin (UI `Roles.isAdmin()`, Server RLS `notif_tpl_sel`, `set_notification_template`/`send_preview_notification` mit `is_admin()`).

| Element | Ist | Soll | Art | Aufwand | Fundstelle im Code |
|---|---|---|---|---|---|
| Ort | eigene Ansicht `pushkatalog`, Titel „Push-Nachrichten“, App-Zurück-Chevron | Unterseite `#ein=pushtexte`, „‹ Einstellungen“, Titel „Push-Texte“ (142 breit); alte Ansicht leitet um | Frontend-Logik (Route) | M | `app.js:416`, `:444`, `EIN_SEITEN` `:1940` |
| Kopfkarte | Hinweis + „Alle an mich senden“ (primär) + „Vorschauen löschen“ | in der Vorlage nicht vorhanden | bleibt (Abschnitt 2) | S | `app.js:1400–1407` |
| Liste | eine aufgeklappte Karte je Kategorie mit internem Namen (`absage_kurzfristig`), Marken, An/Wann, Vorschau iOS+Android, Felder Titel/Text, Platzhalter, Knöpfe | Gruppen mit Kopf („Termine“ y 170, „Strafen“ y 437), Zeilen: sichtbarer Name 16/600, Nebenzeile = Textvorlage 13 `--muted` (z. B. „Neu: {Termin} am {Datum}“), › | Frontend-Logik | M | `katZeileHtml` `app.js:1322` |
| Zeilenziel | – | 3. Ebene „Push-Text bearbeiten“ (`#ein=pushtexte` + Kategorie, Zurück „‹ Push-Texte“) mit Vorschau, Feldern, Strafhinweis, Knöpfen (wie PHASE0 E9) | Frontend-Logik | L | neu, Hash-Muster `einZielAusHash` `app.js:1964` erweitern |
| Gruppierung | keine | Vorlage nach Thema (Termine, Strafen); PHASE0 Entscheidung A11: nach `kategorie_rolle` (Trainer, Kasse, Spieler, System). **Entscheidung nötig** (Abschnitt 4) | Frontend-Logik | S | – |
| Namen | interner Schlüssel | sichtbare Namen, dieselben wie in 19 (`PN_GRUPPEN`-Namen), nicht die Vorlagennamen „Neuer Termin“/„Erinnerung“/„Aufstellung“ | Frontend-Logik | S | `PN_GRUPPEN` |
| Nebenzeile = Textvorlage | – | echter Text mit echten Platzhaltern (`{termin_titel}`, nicht `{Termin}`; PHASE0 A6), einzeilig mit Auslassung | Frontend-Logik | S | `v.text_vorlage` |
| Zeile „Aufstellung · Die Elf für {Gegner} steht“ | keine Vorlage, keine Kategorie | – | nicht bauen ohne Abschnitt 3 | – | – |
| Marken „zeitkritisch“, „aus“ | `tag-cancelled` / `tag-manuell` | nicht in der Vorlage | bleiben in der Zeile rechts vor dem ›, Satzschreibung (Marke rot `--red-050`/`--red-700`, neutral `--line`/`--ink`) | S | `app.js:1334–1335` |
| Testkategorie `test` | als Karte in der Liste | nicht in der Vorlage | bleibt (Gruppe „System“) | S | – |

---

### 27 Diagnose

Soll: `soll/E 27 Diagnose.png/.json`, Höhe 718. Ist: Overlay `window.__showDiag` `index.html:99–124`, Einstieg `app.js:5926`, Aufnahme `landkarte/bilder/admin/diagnose.png`.

| Element | Ist | Soll | Art | Aufwand | Fundstelle im Code |
|---|---|---|---|---|---|
| Ort | Overlay ersetzt die Ansicht (kein Zurück, Monospace) | Unterseite `#ein=diagnose` mit „‹ Einstellungen“; Overlay bleibt für Watchdog, `?debug=1`, Wiedereinstieg | Frontend-Logik | M | `app.js:5926–5933`, `index.html:151–159` |
| Gruppe „App“ | Monospace-Block | Kopf (y 170) + Karte 358 × 220: Version, Zuletzt geladen, Offline-Speicher | Markup | S | neu |
| Version | „Build HTML: … App: …“ | Wert rechts. Vorlage „2.14.0“; App hat keine Semver, Wert = `APP_BUILD` („2026-10-06-A“); bei Abweichung HTML/App rote Nebenzeile „HTML 2026-…, Cache prüfen“ | Frontend-Logik | S | `app.js:10`, `:2160–2162` |
| Zuletzt geladen | – (Phasen mit ms) | „heute, 14:58“ aus dem Startzeitpunkt (`__boot`-Protokoll) | Frontend-Logik | S | `index.html` Boot-Protokoll |
| Offline-Speicher | – | „Aktiv“ / „Aus“: `navigator.serviceWorker.controller` vorhanden | Frontend-Logik | S | `sw.js` |
| Gruppe „Gerät“ | „Standalone (PWA): nein Online: ja“ | Kopf (y 437) + Karte 358 × 147: Mitteilungen „Erlaubt“ (`Notification.permission`: Erlaubt/Blockiert/Nicht gefragt), Als App installiert „Ja“/„Nein“ (`istStandalone()`) | Frontend-Logik | S | `app.js:1462`, `:1511` |
| „Bericht kopieren“ | „Log kopieren“ (`dgK`) | Sekundärknopf 358 × 50 (y 617), darunter „Für Rückfragen an den Admin.“ 13 `--muted` zentriert | Markup | S | `index.html:122` |
| Online, Letzter Fehler, Grund, Phasen | im Block | nicht in der Vorlage | bleiben (Abschnitt 2) | S | `index.html:99–124` |
| „Neu laden“, „Cache leeren und neu laden“, „Vorheriger Start (Log)“ | Knöpfe/`details` | nicht in der Vorlage | bleiben (Abschnitt 2) | S | `index.html:120–124` |

---

### 28 Blatt · Anleitung Google

Soll: `soll/E 28 Blatt · Anleitung Google.png/.json`, Höhe 594. Ist: Schritte stehen in der Android-Karte des Blatts `openCalSheet` `app.js:967–981`.

| Element | Ist | Soll | Art | Aufwand | Fundstelle im Code |
|---|---|---|---|---|---|
| Form | Teil des Blatts „Termine abonnieren“ | README: eigenes Blatt, geöffnet über „Anleitung ›“ in 20. Die Vorlage zeichnet es als Seite mit „‹ Einstellungen“; als Blatt gebaut gilt der Blatt-Rahmen (`.more-sheet`, Griff, Schließen, Wischen) | Frontend-Logik | M | `openCalSheet` als Vorbild |
| Titel | „Termine abonnieren“ / Karte „Android / Google Kalender“ | „Für Google“ 26/800 | Text | S | `app.js:969`, `:989` |
| Schritte | `ol.abo-schritte` mit drei Punkten | Gruppenkopf „In drei Schritten“ (y 170) + Karte 358 × 222: Nummernkreis 28 × 28 `--green-050`, Ziffer 13/800 `--green-800`, Titel 16/600 (x 74), Nebenzeile 13 `--muted` | Markup + Styling | S | `app.js:972–977` |
| Schritt 1 | „Link kopieren.“ | „Link kopieren“ · „Mit dem Knopf unten.“ | Text | S | – |
| Schritt 2 | „calendar.google.com im Browser öffnen, ggf. auf „Desktop-Version“ umschalten, links bei „Weitere Kalender“ auf das Plus, dann „Per URL“.“ | „calendar.google.com öffnen“ · „Im Browser, links bei „Weitere Kalender“ auf Plus, dann „Per URL“.“; der Teil „Desktop-Version“ fehlt in der Vorlage (Abschnitt 2); Vorlage setzt ein gerades `"` statt `“` (Abschnitt 5) | Text | S | `app.js:974` |
| Schritt 3 | „Link einfügen, „Kalender hinzufügen“.“ | „Link einfügen“ · „Mit „Kalender hinzufügen“ bestätigen.“ | Text | S | `app.js:976` |
| Knöpfe | „Link kopieren“ primär, „calendar.google.com öffnen“ sekundär | **umgekehrt**: Primär „calendar.google.com öffnen“ 358 × 48 (y 435, `GOOGLE_ADD_URL`, neuer Tab), Sekundär „Link kopieren“ 358 × 50 (y 493) | Markup | S | `app.js:978–979`, `GOOGLE_ADD_URL` `app.js:948` |
| Fußzeile | „Änderungen erscheinen bei Google mit bis zu 24 Stunden Verzögerung.“ | „Google übernimmt Änderungen bis zu 24 h später.“ 13 `--muted`, zentriert (y 553) | Text | S | `app.js:980` |
| Hinweis oben „Das Abo lässt sich nur einmalig über die Web-Oberfläche anlegen …“ | vorhanden | nicht in der Vorlage | Abschnitt 2 | S | `app.js:970` |
| „Abo begonnen“ merken | Kopieren und Google-Knopf rufen `hinweisMerken(false, true)` | muss im neuen Blatt und in 20 gleich bleiben (speist den Status „Eingerichtet“) | Frontend-Logik | S | `app.js:1008`, `:1013` |

---

### 2. Funktionen, die heute existieren und in der Vorlage fehlen

Alle bleiben. Vorschlag, wo sie im Stil der Vorlage hinkommen (Gruppenkopf + gruppierte Zeilen, Hinweistext 13 px nur bei unsichtbarer Folge).

| # | Funktion | Heute | Vorschlag |
|---|---|---|---|
| 1 | **Testnachricht senden** (nur Admin, UI und Server) | Kartenzeile mit grüner Sende-Kachel unter den Gruppen in Mitteilungen | Mitteilungen, eigene Gruppe „Test“ ganz unten, eine Zeile „Testnachricht senden“ 16/700 `--green-800` mit Symbol in der neuen hellen Kachel, nur für `rollen.includes("admin")` (`pnTestKnopfHtml` unverändert als Schranke). Alternative: Zeile in Push-Texte, Gruppe „System“. |
| 2 | **Strafhinweis** (`{strafhinweis}`, nur Termine mit Auto-Strafe) | Feld + „Strafhinweis speichern“ in der Karte `rueckmeldung_erinnerung` | 3. Ebene „Push-Text bearbeiten“ von „Erinnerung vor Meldeschluss“: eigene Gruppe „Strafhinweis“ unter den Feldern, Feld 16 px (max. 80), Hinweiszeile „Nur bei Terminen mit Auto-Strafe.“, Sekundärknopf „Strafhinweis speichern“ |
| 3 | **Push-Texte-Vorschau** iOS und Android | beide nebeneinander in jeder Karte | 3. Ebene: Segment „Sperrbildschirm / Hell / Android“ (PHASE0 Entscheidung 7), eine Vorschau |
| 4 | Push-Texte bearbeiten: Felder Titel/Text mit Zähler 40/110, Platzhalterliste, Fehler bei unbekanntem Platzhalter (sperrt Senden), „Vorlage speichern“/„Verwerfen“ nach Änderung, „An mich senden“, An/Wann-Beschreibung | in jeder Karte | 3. Ebene, gruppiert: Gruppe „Text“ (Felder), Platzhalter als Chips, Gruppe „Empfänger“ (An/Wann als Zeilen), Primär „An mich senden“ bzw. nach Änderung Primär „Vorlage speichern“ + Sekundär „Verwerfen“ |
| 5 | „Alle an mich senden“ (mit Fortschritt), „Vorschauen löschen“, Meldung | Kopfkarte der Push-Ansicht | Push-Texte oben rechts Textverweis „Alle senden“ (Muster `s.action` der E-Datei, 15/700 `--green-800`, 44 hoch); „Vorschauen löschen“ als Zeile in eigener Gruppe „Vorschauen“ unten; Meldung als Hinweiszeile darunter. Der lange Begleitsatz entfällt bis auf „Geht nur an dich, ohne Ruhezeit.“ |
| 6 | Marken „zeitkritisch“, „aus“ | Kartenkopf | Zeile rechts vor dem › (Satzschreibung) |
| 7 | **„Dringendes trotzdem zustellen“** (`quiet_override_urgent`) | eigene Karte + Hinweis | Ruhezeiten, Gruppe „Ausnahmen“, in der Form der Spieltag-Zeile der Vorlage (Schalter + Nebenzeile mit den vier Kategorien). Siehe 23 / Abschnitt 4. |
| 8 | Ruhezeit-Hinweis „Was liegen bleibt, wird danach zugestellt.“ | unter der Karte | eine Hinweiszeile unter „Nachts stumm“ |
| 9 | Ruhezeiten ohne Push: „Zu den Mitteilungen“ | Karte | Karte mit Satz, `.btn-soft` |
| 10 | Mitteilungen-Zustände: In-App-Browser, iOS erst installieren (drei Schritte), Browser kann kein Push, blockiert (Schritte je System), bereit („Kurzfristige Absagen …“ + „App installieren“) | Karte mit Text | statt der Hauptschalter-Karte eine Statuskarte (Muster 20: Titel, Marke „Nicht möglich“/„Blockiert“/„Nicht eingerichtet“, Satz), Schritte als nummerierte Zeilen wie 28, „App installieren“ als Primärknopf |
| 11 | Mitteilungen: Gruppen Trainer und Kasse, Kategorien `zahlung_abgelehnt`, `termin_abgesagt`, `strafen_offen`, `absage_kurzfristig`, `meldeschluss_uebersicht`, `zahlung_gemeldet` | Rollen-Gruppen | Thema-Gruppen erweitern: „Termine“ (+ Termin fällt aus), „Strafen“ (+ Zahlung abgelehnt, Monatliche Erinnerung), dazu „Für Trainer“ und „Für die Kasse“ nur bei der Rolle. Filter `pnGruppenFuer`/`kategorie_erlaubt` bleibt. |
| 12 | Sammelschalter „Alle“ je Gruppe (mit Zustand gemischt) | Gruppenkopf | rechts im Gruppenkopf als Textverweis „Alle an“/„Alle aus“ (15/600, 44 hoch); ein zweiter Schalter im Kopf passt nicht zum Gruppenkopf-Baustein |
| 13 | Beschreibungen aus `notification_infos` (Wann kommt die Nachricht) | Nebenzeile jeder Schalterzeile | 13-px-Nebenzeile behalten (sonst ist die Folge unsichtbar); Vorlage zeigt keine, Entscheidung |
| 14 | Admin-Hinweis „Keine eigenen Kategorien für Admins …“, Schlusshinweis „Die Liste in der App zeigt alles …“ | Hinweise | je eine Hinweiszeile unter der letzten Gruppe |
| 15 | Hinweis „Automatische Nachrichten …“ | `AUTO_MITTEILUNGEN_AKTIV = true`, also aus | bleibt aus, Baustein bleibt |
| 16 | **Kalender-Abo-Varianten**: Blatt `calSheet` aus der Kalender-Kopfzeile, Abo-Kachel mit X (`aboKachelHtml`, Hinweis nach Rückmeldung), Push-Hinweis-Kachel, Android-zuerst-Reihenfolge, Rückmeldungen „Link kopiert“/„Neuer Link erstellt“, gesperrt ohne Token | Blatt + Unterseite | Kalender-Tab „Kalender abonnieren ›“ führt auf die Unterseite `#ein=kalender` (eine Ebene, ein Ort); das Blatt `openCalSheet` entfällt als Inhalt, seine Handler (webcal, Kopieren, Zurücksetzen, `hinweisMerken`) ziehen um. Kachel mit X bleibt als Einstieg. Android-zuerst: Gruppen tauschen, wenn Android erkannt. |
| 17 | Google-Schritt „ggf. auf Desktop-Version umschalten“, Hinweis „nur einmalig über die Web-Oberfläche“ | Android-Karte | Blatt 28: Nebenzeile Schritt 2 um „Am Handy ggf. Desktop-Version wählen.“ ergänzen; Einmal-Hinweis als Hinweiszeile unter den Schritten |
| 18 | BFV „nicht verbunden“: Adressfeld, Speichern, Abbrechen, Meldung, „noch nie“ | Karte | 24 im Zustand „Nicht verbunden“: Statuskarte mit Marke „Nicht verbunden“, Gruppe „Adresse“ mit Feld (16 px) und Hinweiszeile, Primär „Verbinden“, Sekundär „Abbrechen“ |
| 19 | BFV „Läuft zusätzlich täglich automatisch.“ | Fließtext | Hinweiszeile unter „Jetzt abgleichen“ |
| 20 | Diagnose: Online, Letzter Fehler, Grund, Phasen, Neu laden, Cache leeren und neu laden, Protokoll vorheriger Start, HTML-/App-Versionswarnung | Overlay | 27: Gruppe „Gerät“ + Zeile „Online“; Gruppe „App“ + „Letzter Fehler“ (Wert oder „Keiner“); neue Gruppe „Hilfe“ mit Zeilen „Cache leeren und neu laden“, „Protokoll dieses Starts ›“, „Protokoll vorheriger Start ›“ (3. Ebene, PHASE0 Entscheidung 9); Grund/Phasen in „Protokoll dieses Starts“; „Neu laden“ = „App neu laden“ in 18 |
| 21 | Build-Zeile unter den Einstellungen | `.ein-build` | Diagnose › Version |
| 22 | **Rollen-Seite** mit Rollen-Häkchen, Selbstentzug-Rückfrage, „Ansicht testen als“ (Simulation), Mitgliederzahl | Ansicht `admin`, Einstieg Mehr-Blatt | Einstieg zusätzlich über 18 › Rollen; Seite selbst unverändert (26 gestrichen, Beta). Mehr-Blatt-Eintrag bleibt (05 unverändert). |
| 23 | Profil: Mein Fitnessstatus (4 Status), Meine Rückmeldungen (5 nächste Termine), Konto ohne Spieler | Profil | unter „Konto“: Gruppe „Mein Status“ im Muster der Übersicht (vier Knöpfe 2er-Raster, gewählt Primärgrün mit Häkchen), Gruppe „Meine Rückmeldungen“ als Terminzeilen mit Marke; Abmelden bleibt ganz unten |
| 24 | Abmelden-Rückfrage | `window.confirm` | bleibt |
| 25 | „App neu laden“ | Info-Gruppe | bleibt (in der Vorlage vorhanden) |
| 26 | Mitteilungen Kompakt-Titel beim Scrollen (F10) | `.ein-kopf.is-kompakt` | Vorlage zeigt nur den ungescrollten Zustand; behalten, aber Leiste im neuen Stil (15/600 `--green-800`) |

---

### 3. Änderungen mit Schema oder Backend

**Für den Nachbau nach Vorlage: keine**, wenn die Entscheidungen unten wie empfohlen fallen. Alles Übrige ist Frontend (`app.js`, `styles.css`, `index.html`) und nutzt bestehende Funktionen (`set_ical_url`, `updatePassword`, `listMembers`, `set_notification_prefs`, `calendar_subscribe_started_at`).

Schema/Backend wird nötig nur, wenn die Vorlage wörtlich genommen wird:

| Vorlagenelement | Was es bräuchte | Aufwand | Empfehlung |
|---|---|---|---|
| 19/25 „Aufstellung veröffentlicht“ (Schalter und Push-Text „Die Elf für {Gegner} steht“) | neue Kategorie in den Check-Constraints von `notification_prefs`/`notification_outbox`/`notification_templates`, Spalte in `notification_prefs`, Vorlage, `kategorie_rolle`, Erzeuger beim Veröffentlichen einer Aufstellung (Trigger auf `lineups` oder RPC), Zuordnung in `notification_due`, Deep Link | L | nicht in diesem Paket; als eigenes Paket vormerken. Bis dahin Zeile weglassen (kein Schalter ohne Erzeuger, Regel aus F4). |
| 23 „Ausnahme Spieltag · Am Spieltag immer zustellen“ | neue Spalte `quiet_override_spieltag`, `set_notification_prefs` erweitern, `notification_due` um „heute ist ein Spiel des Vereins“ ergänzen | L | nicht bauen; bestehendes „Dringendes trotzdem zustellen“ in Vorlagenform zeigen |
| 20 Status „Eingerichtet“ als echter Nachweis | Zugriffszeit je Token im Feed `api/calendar.js` schreiben (service_role), Spalte in `profiles` | M | nicht nötig; „begonnen“-Zeitstempel reicht |
| 24 „Saison“ als gespeicherter Wert | Spalte in `clubs` | S | nicht nötig, aus dem Datum rechnen |

Nebenbefund (kein Muss): Nach „Verbindung trennen“ ruft der Cron `sync-bfv` weiter jede Nacht auf und bekommt 400 „Keine iCal-URL …“. Harmlos; wer es sauber will, lässt `api/sync-bfv.js` ohne URL mit 200 „nichts zu tun“ antworten (Backend, S).

---

### 4. Frühere Entscheidungen, die die Vorlage kippt

Vergleich mit `einstellungen-v2/PHASE0.md` (E3 bis E6, Entscheidungen 03. und 05.10.2026) und den früheren Vorlagen `einst1–4.png`.

| # | Früher (Quelle) | Vorlage jetzt | Bewertung |
|---|---|---|---|
| K1 | Symbolkacheln in vier Flächenfarben, weißes Symbol: grün `--green-650`, dunkelgrün `--green-900`, gold `--gold-chev`, rot `--red-700`, grau `--muted` (E3, E4, `einst1/2.png`) | einheitlich `--green-050` mit Symbol `--green-800`, 32 × 32, Radius 9 | gekippt; gilt in 18. In 19 entfallen Kacheln ganz (E4 hatte sie je Kategorie eingeführt, inkl. selbst gewählter Symbole für Trainer/Kasse) |
| K2 | Kalender-Abo: Unterseite mit zwei Zeilen, „Termine abonnieren“ öffnet das Blatt (E6) | eine Ebene: Statuskarte, Knöpfe direkt, Anleitung als kleines Blatt | gekippt |
| K3 | Gruppentitel grün `--green-700` 11 px, Einzug 15 (E3/E4, gemessen) | `--muted` 12 px, `.06em`, ohne Einzug | gekippt |
| K4 | Zeile 48 px, Titel 16/500, Wert 15/400, Chevron grau `--muted`·0,6, Trennlinie ab x 55 (E3) | 52 px, 16/600, Wert 13 px, Chevron `--green-chev`, Linie über volle Breite | gekippt |
| K5 | Profilkarte Avatar 54, Name 18/800, Rolle „Administrator · Spieler“, E-Mail-Zeile (E3) | Avatar 44, Name 16/700, „Admin · Spieler · Profil ansehen“, E-Mail im Profil | gekippt |
| K6 | „App neu laden“ ohne Chevron, weil Aktion (E3, `einst1.png`) | mit Chevron | Widerspruch zur README-Regel „› nur, wenn die Zeile wegführt“. **Empfehlung: ohne Chevron lassen** (README schlägt Bild) |
| K7 | Abmelden als rote Kartenzeile auf der Hauptseite, Build darunter (E3, F8) | Abmelden im Profil als Sekundärknopf, Build nicht mehr sichtbar | gekippt |
| K8 | „Kartenschatten bewusst nicht angeglichen“, `--shadow` app-weit (E3) | Vorlage verlangt `--shadow-card` mit langem Auslauf | gekippt, wirkt app-weit |
| K9 | Schalter an `--grad-chip-on` mit Rand (E4) | flach `--green-700`, ohne Rand | gekippt |
| K10 | Ruhezeiten: drei Karten, Zeit-Pille 70 × 36 grau (E5) | eine Karte „Nachts stumm“ mit Wertzeilen + Karte „Ausnahmen“ | gekippt |
| K11 | Mitteilungen gegliedert nach Rolle (Spieler, Trainer, Kasse) mit Sammelschalter (F6/E4) | nach Thema (Termine, Strafen), ohne Sammelschalter | gekippt; Rollenfilter muss erhalten bleiben |
| K12 | Push-Texte gruppiert nach `kategorie_rolle` inkl. Gruppe System (Entscheidung A11) | nach Thema | gekippt, **Entscheidung nötig**; Empfehlung: dieselben Themen-Gruppen wie in 19, damit beide Seiten gleich lesen |
| K13 | Push-Texte-Kopf: Zeilen „Alle an mich senden“ (grün), „Vorschauen löschen“ (E8-Plan, `einst3.png`) | kein Kopf | Funktion bleibt (Abschnitt 2 Nr. 5) |
| K14 | Diagnose: Gruppen STATUS und HILFE BEI PROBLEMEN (E10-Plan, `einst4.png`) | Gruppen App und Gerät, nur „Bericht kopieren“ | gekippt; Hilfe-Zeilen bleiben (Abschnitt 2 Nr. 20) |
| K15 | Zurück-Leiste klebend, 17/500 `--green-700`, Kompakt-Titel (F10/E4) | einfacher Verweis 15/600 `--green-800` | Optik gekippt, Verhalten bleibt |
| K16 | BFV-Plan E7: „Zuletzt aktualisiert“ als Zeile mit Wert, „Jetzt aktualisieren“ als weiße Karte mit grüner Kachel | Statuskarte + Primärknopf „Jetzt abgleichen“ | gekippt |
| K17 | Unterseitentitel „Kalender-Abo“, „Spielplan (BFV)“ | „Kalender abonnieren“, „Spielplan BFV“ | gekippt |
| K18 | Profil: eigene Ansicht ohne Zurück, Rollen unsortiert, „Nr. 6“ in der Rollenzeile | Unterseite der Einstellungen | gekippt (Position ausgenommen) |

---

### 5. Verbindliche Vorgaben, die von der Vorlage abweichen

| Vorgabe | Wo die Vorlage abweicht oder offen lässt | Umsetzung |
|---|---|---|
| **Push-Texte und Testnachricht nur Admin** (serverseitig: RLS `notif_tpl_sel`, `set_notification_template`, `send_preview_notification`, `send_test_notification` mit `is_admin()`; UI `Roles.isAdmin()`, `pnTestKnopfHtml`) | Vorlage zeigt 18 nur in der Admin-Sicht; keine Aussage für andere Rollen; Testnachricht fehlt ganz | Zeile „Push-Texte“, „Spielplan BFV“, „Rollen“ nur Admin; „Strafenkatalog“ für Admin und Kassenwart (`canEditCatalog`); Gruppe „Verwaltung“ nur, wenn eine Zeile übrig bleibt; Route `#ein=pushtexte` mit `darf: Roles.isAdmin`; Testnachricht nur Admin, auch nicht ausgegraut. Pflichtfälle in `einpruef`/`pushpruef` bleiben. |
| **Trefferflächen ≥ 44** | Schalter sichtbar 31 hoch; Nummernkreise 28 (nicht antippbar); „Anleitung ›“ 19 hoch in einer 44er-Zeile; Zurück-Verweis 44 hoch über volle Breite | Schalter behalten `::after` 44 × 44; „Anleitung ›“ mit Trefferfläche 44 (`::after` oder Zeilenhöhe); Zeit-Feld unsichtbar ≥ 44 über dem Wert; Zeilen ≥ 52 |
| **Kontrast ≥ 4,5:1** | Werte 13 px `#5c6a63` auf Weiß 5,7:1 (ok); Marke „Nicht eingerichtet“ `--ink` auf `--line` (ok); Chevron `--green-chev` ist Schmuck (Zeile trägt die Bedeutung); gesperrter Primärknopf `--muted` auf `--line` ≈ 4,8:1 (knapp ok, prüfen nach Token-Wechsel); `--red-chev` nur Schmuck | nach dem Token-Wechsel `--muted` einmal mit der Kontrastprüfung messen; keine hellgrüne Sperrfläche |
| **Keine Gedankenstriche, keine ASCII-Umlaute in sichtbaren Texten** | Vorlage selbst sauber, aber Schritt 2 in 28 schließt mit geradem `"` („Weitere Kalender\"“), muss `“` sein. Im Ist-Code (Bereich dieses Pakets) stehen noch: `app.js:2162` „Versionen unterschiedlich – evtl. Cache“, `app.js:6024` „unterwegs – kommt in bis zu einer Minute“, `app.js:7197` „Reine Anzeige-Vorschau – ändert nichts …“, Platzhalter „—“ für fehlenden Namen/Teamnamen `app.js:2156`, `:2157`, `:2186`, `:7183` | beim Umbau ersetzen (Komma/Punkt; „—“ durch „Kein Name“ bzw. leer). Daten-Text „Eine Strafe wird verhängt - von Hand …“ ist laut 0051 bereits korrigiert. |
| **Keine Funktion fällt weg** | Vorlage lässt weg: Abmelden auf der Hauptseite (wandert ins Profil), Build, Testnachricht, Strafhinweis, Vorschau, Sammelschalter, Beschreibungen, sechs Kategorien, Trainer/Kasse-Gruppen, Push-Zustände, BFV-Eingabe, Diagnose-Hilfen, Fitnessstatus und Rückmeldungen im Profil, Rollen-Simulation | Abschnitt 2, alle mit Platz |
| **„Zu wenig Zusagen“ ausgeblendet (F4)** | nicht in der Vorlage | bleibt ausgeblendet, kein Schalter, kein Push-Text in der Liste bis es einen Erzeuger gibt |
| **Kein Schalter ohne Erzeuger** (Konsistenzprüfung 06.10.2026) | „Aufstellung veröffentlicht“, „Spieltag“ | weglassen bzw. auf Bestehendes abbilden (Abschnitt 3) |
| **Eingabefelder 16 px** | Blatt „Neues Passwort“, BFV-Adresse, Push-Text-Felder, Strafhinweis | 16 px, wie heute |

---

## Offene Entscheidungen (kurz)

1. Zeilenhöhe Unterseiten: 56 (empfohlen) oder 72 wie gemessen.
2. Mitteilungen und Push-Texte nach Thema (Vorlage) statt nach Rolle; Sammelschalter als Textverweis.
3. „Neuer oder geänderter Termin“ als ein Schalter für zwei Kategorien oder zwei Zeilen.
4. Beschreibungen unter den Schaltern behalten (empfohlen) oder streichen.
5. Ausnahme „Spieltag“ auf „Dringendes trotzdem zustellen“ abbilden (empfohlen).
6. „Aufstellung veröffentlicht“ als eigenes Paket vormerken.
7. „App neu laden“ ohne Chevron (empfohlen, README-Regel).
8. Kalender-Tab und Abo-Kachel führen auf die Unterseite statt aufs Blatt; Android-zuerst behalten.
9. Testnachricht in Mitteilungen (empfohlen) oder in Push-Texte.
10. Profil als Unterseite `#ein=profil` (Hash-Route und `DEEP_ANSICHTEN` anpassen).

---
