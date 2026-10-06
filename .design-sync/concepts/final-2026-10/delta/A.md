# Delta A · Übersicht, Kalender, Termin anlegen, Rückmeldungen

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

## 01 Übersicht

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

## 02 Kalender

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

## 03 Termin anlegen (Blatt)

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

## 04 Rückmeldungen-Blatt

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

## 2. Funktionen, die heute existieren und in der Vorlage fehlen

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

## 3. Änderungen mit Schema oder Backend

1. **Treffen-Zeit (Schema, neu):** Spalte `events.treffen time null` (Migration 0058, ein `do`-Block mit Gegenprobe). Dazu `db.js:78` (Mapping `treffen`), `terminRow` app.js:2810, `saveTerminEdit` app.js:2835, `saveBfvEdit` app.js:2859 (Zusatzfeld wie `ende`), Anzeige Kalenderkopf. Prüfen: Kalender-Feed-Trigger aus 0020 (Zeile 29–32) und Text der .ics-Beschreibung, falls Treffen dort erscheinen soll; `termin_geaendert` darf durch Treffen nicht auslösen, wenn nicht gewollt. Ohne Freigabe entfällt „Treffen“ in 02 und 03.
2. **Push senden (Backend vorhanden):** RPC `send_rsvp_reminder(p_event uuid, p_nur_zaehlen boolean)` aus Migration 0050 ist live, `grant` an `authenticated` gesetzt. Neu nur im Frontend: `DB.sendRsvpReminder(eventId, nurZaehlen)` in db.js (Muster `client.rpc`, db.js:145ff.). Keine Schemaänderung.
3. Sonst **keine**: relativer Tag, „Elf steht/offen“, „15 fit“, Terminart-Farben und Anzahl offener Aufstellungen kommen aus geladenen Daten.

## 4. Verbindliche Vorgaben des Nutzers, die von der Vorlage abweichen

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
