# Übergabe: Überarbeitung FC Fasanerie-Nord App

## Überblick

Gestalterische Überarbeitung der gesamten Mannschafts-App (iPhone Safari, 390 px). Ziel ist kein neues Design, sondern Einheitlichkeit: eine Flächensprache, feste Schriftstufen, weniger Kleingedrucktes, ein Primärknopf, ein Gruppenkopf, ein Listenmuster, gleiche Begriffe in Konto und Kasse. **Keine Funktion fällt weg.** Wo etwas aus einer Ansicht verschwindet, steht unten, wo es jetzt liegt.

## Über die Dateien in diesem Paket

Die HTML-Dateien unter `referenz/` sind **Gestaltungsvorlagen**, kein Produktionscode. Sie sind mit Inline-Styles gebaut, damit jeder Wert direkt ablesbar ist. Aufgabe ist, die Vorlagen **in der bestehenden App nachzubauen**: `index.html`, `app.js`, `styles.css` mit `tokens/tokens.css` und `_ds_app.css`. Dabei gilt weiter die Klassensprache des Design-Systems (semantische Klassen, keine Utilities, Farben nur über Tokens). Hex-Werte, die in den Vorlagen inline stehen, werden in der App zu Tokens.

Öffnen: `referenz/Final Alle Screens.dc.html` zeigt alle 28 Screens untereinander. Die Teil-Dateien A bis E enthalten die Screens einzeln.

## Detailtreue

**High-Fidelity.** Farben, Schriftgrößen, Abstände, Radien und Texte sind endgültig. Nachbauen nach Vorlage, gemessen in CSS-px bei 390 px Breite.

## Harte Regeln (unverändert, gelten weiter)

1. Alles Antippbare mindestens 44 px (`--tap`). Sichtbar kleinere Elemente bekommen eine unsichtbare `::after`-Trefferfläche.
2. Eingabefelder 16 px Schrift.
3. Kein waagerechtes Scrollen.
4. Textkontrast mindestens 4,5:1.
5. Keine Emojis, Symbole als Linien-SVG (stroke 1,8, round caps/joins).
6. App-Rahmen bleibt: fixe Kopfzeile (Wappen, Mannschaftsname mittig, Zahnrad rechts), Bottom-Nav Übersicht, Kalender, Katalog, Konto plus fünfter Tab je Rolle.

---

## Umsetzungsreihenfolge

Nach jedem Schritt muss die App lauffähig sein. Nach jedem Schritt anhalten und zeigen.

1. **Tokens** (Abschnitt „Design-Tokens“). Wirkt sofort app-weit.
2. **Primärknopf vereinheitlichen.** Alle Primärhandlungen auf `.btn-primary`.
3. **Gruppenkopf** `.group-head` einführen und alle alten Köpfe ersetzen.
4. **Marken und Chips** auf Satzschreibung und Bedeutungsfarben.
5. **Kacheln und Listenzeilen** (getönte Kacheln, Goldwürfel mit Strich).
6. **Screens A bis E** der Reihe nach.

---

## Design-Tokens

### Geändert

| Token | Alt | Neu | Grund |
|---|---|---|---|
| `--muted` | `#66756d` | `#5c6a63` | 5,7:1 auf Weiß, 4,7:1 auf `--bg-2` (vorher 4,0:1) |
| `--grad-btn` | `linear-gradient(180deg, var(--green-550), var(--green-650))` | `linear-gradient(180deg, var(--green-600) 0%, var(--green-700) 100%)` | Weiß auf Knopf 5,3:1 bis 7,7:1 statt 3,88:1 |
| `--h-btn` | `46px` | `48px` | eine Knopfhöhe; `--h-btn-lg` wird Alias auf `--h-btn` |

### Neu

| Token | Wert | Verwendung |
|---|---|---|
| `--amber-ink` | `#8a5a08` | Amber-Schrift unter 18 px (5,9:1 auf `--amber-050`) |
| `--amber-line` | `#ecd3a6` | Rand getönter Amber-Kachel |
| `--fs-betrag` | `40px` / 800 / letter-spacing −0,03em | ein großer Betrag pro Ansicht |
| `--fs-titel` | `26px` / 800 / −0,02em | Seitentitel |
| `--fs-kpi` | `21px` / 800 | Kennzahl in Kachel |
| `--fs-zeile` | `16px` / 700 | Zeilentitel |
| `--fs-neben` | `13px` / 500 | Nebentext, **Mindestgröße** für Fließ- und Hinweistext |
| `--fs-etikett` | `12px` / 700 / Versal / letter-spacing .06em | nur Versal-Etiketten und Marken |
| `--sp-1` … `--sp-6` | `4 8 12 16 24 32` px | Abstandsraster. Seitenrand 16, zwischen Karten 12, zwischen Gruppen 24 |

Ausnahme Schriftgröße: Beschriftung der Bottom-Nav bleibt 11 px.

### Unverändert, aber wichtig

`--green-700` `#1b5e3f`, `--green-800` `#144a37`, `--green-600` `#237a52`, `--red-600` `#c0392b`, `--red-700` `#a5281b`, `--blau-700` `#1d5a8a`, `--blau-050` `#e7f0f7`, `--gold-ink` `#7a5a0c`. Getönte Kacheln nutzen die vorhandenen `--grad-task-green`, `--grad-task-red`, `--grad-task-gold` mit `--green-task-ink`, `--red-ink` usw.

---

## Bausteine (gelten überall)

### Primärknopf `.btn-primary`
- Fläche `--grad-btn`, Schrift `#fff` 16/700, Höhe 48, Radius 12, Schatten `--shadow-btn`.
- **Einer pro Ansicht oder Blatt.**
- Alle bisherigen Sonderstile entfallen und werden `.btn-primary`: `.tv-next-btn`, `.rs2-btn`, `.kasse-save`, `.tv-primary`, `.auth-submit`. Betrifft „Elf aufstellen“, „Alle erinnern“, „Spiel anlegen“, „Strafe speichern“, „Bestätigen“, „Anmelden“ und „30,00 € jetzt bezahlen“.
- Gesperrt: Fläche `--line`, Schrift `--muted`. **Nie hellgrün.**

### Sekundärknopf `.btn-soft`
- `--grad-btn-sec`, Rand 1 px `--line-soft-3`, Schrift `--ink` 16/700, Höhe 48.
- Gefährliche Handlung (Abmelden, Ablehnen): gleicher Knopf, Schrift `--red-700`.

### Aktive Auswahl
- Aktiver Chip, aktive Formation und „Mein Status“ gewählt nutzen **dasselbe Grün wie der Primärknopf** (`--grad-btn`, weiße Schrift).
- Inaktiver Chip: `--grad-chip`, Rand `--line-soft-2`, 14/600, Höhe 36 (Trefferfläche 44 per `::after`).

### Segment
- Für den Wechsel zwischen 2 bis 4 Ansichten (Kalender Alle/Spiele/Training/Sonstiges, Konto Ich/Mannschaft, Kasse Gemeldet/Offen/Bezahlt, Zahlart Bar/PayPal).
- Spur `--bg-2` mit Rand `--line-soft`, Radius 12, Innenabstand 3.
- Aktiv: weiße Pille Radius 9, `--shadow-sm`, Schrift `--green-800` 14/700; inaktiv 14/600 `--muted`. Höhe 38.

### Hinzufügen-Knopf „+“
- Runder Knopf 36 × 36, Rand 1,5 px `--line-soft-3`, „+“ 20/600 `--green-800`.
- Gleich im Bank-Blatt und im Blatt „Spieler für die Position“. Ersetzt jeden Textknopf „Setzen“.

### Gruppenkopf `.group-head` (neu)
- Ersetzt `.section-title`, `.sec-mini`, `.tv-next-lbl`, `.set-verwaltung` und alle Köpfe innerhalb von Karten.
- 12/700, Versal, letter-spacing .06em, Farbe `--muted`. 24 px Abstand darüber, 8 darunter.
- Rechts optional ein Textverweis (`.link-btn`, 15/600 `--green-800`, mit „›“ wenn er wegführt).

### Karte
- `--grad-card`, Rand 1 px `--line-soft`, Radius 14, `--shadow-card`.
- **Keine Karte in der Karte:** Unterbereiche trennt eine 1-px-Linie `--line`.

### Listenzeile
- Mindesthöhe 52 bis 60 px, Innenabstand 0 16.
- Links optional ein Avatar 36 px rund (`--grad-av`, Initialen 13/800 `--green-800`).
- Mitte: Titel 16/700, darunter Nebenzeile 13 `--muted`.
- Rechts Wert oder Marke, dazu „›“ in `--green-chev` nur, wenn die Zeile wegführt.
- Mehrere Zeilen bilden **eine** Karte mit Trennlinien.
- **Ausnahme Strafenkatalog:** jede Strafe eine eigene Kachel, Abstand 8.

### Terminzeile (Danach, Weitere Spiele)
- Goldwürfel 42 × 56, Radius 9, `--grad-gold`, darin untereinander:
  - Wochentag 12/700 `--gold-ink`
  - Tag 19/800 `--green-800`
  - Monat 12/700 Versal `--gold-ink`
- Links ein kurzer Farbstrich: 4 px breit, abgerundet, 16 px Abstand oben und unten, 6 px vom Rand. Dunkelgrün `--green-900` für Spiel, hellgrün `--green-450` für Training.

### Kennzahl-Kachel (getönt)
- **Kein Randstreifen mehr.** Die ganze Kachel trägt die Farbe ihrer Bedeutung:
  - Fit, In der Kasse: `--grad-task-green`, Rand `--green-badge-line`, Schrift `--green-task-ink`
  - Offen, Verletzt: `--grad-task-red`, Rand `--red-line`, Schrift `--red-ink`
  - Angeschlagen: `--amber-050`, Rand `--amber-line`, Schrift `--amber-ink`
  - Urlaub: `--blau-050`, Rand `--blau-line`, Schrift `--blau-700`
- Etikett 12/700 Versal, Wert 21/800, gleiche Ziffernbreite, `white-space: nowrap` am Betrag.
- Höchstens zwei Beträge nebeneinander.
- Ersetzt `.edge-green`, `.edge-gold`, `.edge-red` an Kacheln.

### Aufgabenzeile `.task-row`
Farbe nach Bereich, Zähler 34 × 34 Radius 10:
- Zahlungen bestätigen: rot (`--grad-task-red`, Zähler `--grad-edge-red`)
- Ohne Rückmeldung: grün (`--grad-task-green`, Zähler `--green-800`)
- Elf aufstellen: gold (`--grad-task-gold`, Zähler `--grad-edge-gold`)

### Marke / Plakette
- Pille 12/700 in **Satzschreibung** (nicht Versal), Innenabstand 3 10.
- Zugesagt, Fit, Elf steht, Auf der Bank: `--green-badge-bg` / `--green-800`
- Offen, Verletzt, Erhöhung: `--red-050` / `--red-700`
- Gemeldet, Elf offen, Angeschlagen: `--amber-050` / `--amber-ink`
- Urlaub: `--blau-050` / `--blau-700`, **Blau nur für Urlaub**
- Heim, Auswärts, Auf dem Platz, Nicht eingerichtet: neutral, `--line` / `--ink`
- Status-Pillen im Kader tragen zusätzlich einen Punkt 7 px in der Statusfarbe.

### Textverweise
- `--green-800`, 15/600, **ohne Unterstreichung**, „›“ wenn sie wegführen. Unterstrichen nur im Fließtext.

### Hinweistexte
- Nur, wenn eine Folge nicht sichtbar ist (Frist, Erhöhung, Verzögerung bei Google) oder ein Knopf fehlt bzw. gesperrt ist.
- Eine Zeile, 13 px `--muted`, direkt unter dem Element.
- **`.page-head p` (Begleitsatz unter Seitentiteln) entfällt überall.**
- Fußzeile „Neu laden“ (`.app-footer`) entfällt. Aktualisieren geht per Ziehen, außerdem über „App neu laden“ in den Einstellungen.

### Flächensprache
Dunkelgrün als Fläche gibt es nur dreimal:
1. Kopfzeile
2. Spielfeld
3. Termin-Hero bzw. Spielkarte (Spiele im Kalender, nächstes Spiel in der Trainer-Ansicht)

Training im Kalender hat einen hellgrünen Kopf (`--grad-task-green`), Sonstiges einen goldenen (`--grad-task-gold`). Die Zusammenfassung vor dem Speichern bzw. Buchen in der Kasse (`.kasse-sum`) wird **hell**: `--green-050`, Rand `--green-badge-line`, Betrag 21/800 `--green-800`.

---

## Screens

Nummern wie in `Final Alle Screens.dc.html`.

### A · Übersicht und Kalender (`Final A Übersicht und Kalender.dc.html`)

**01 Übersicht**
- Titel „Servus, Lukas“ 26/800, daneben Rollenpille gold.
- **Termin-Hero:** dunkelgrüner Kopf mit Verlauf `158deg, --green-750 → --green-900 → --green-950` und 3 px Goldlinie unten. Darin:
  - Pille „Nächster Termin“ in Gold auf Transparenz, Menü ··· (44 px)
  - Goldwürfel 56 × 66
  - Titel 28/800, Zeit 15/600
- Unter dem Kopf:
  1. Ortszeile mit Pin und „Route ›“
  2. Zu-/Absage nebeneinander, 48 hoch
  3. Zeile Rückmeldungen mit Balken, „1 zu · 0 ab · 15 offen“ und „Meldeschluss in 21 h“. Die ganze Zeile öffnet das Rückmeldungen-Blatt.
  4. Zwei Felder Aufstellung „11 von 11“ und Kader „15 fit“, nebeneinander mit Trennlinie, jeweils mit „›“
- **Heute zu tun:** getönte Aufgabenzeilen, jede einzeln, Abstand 8.
- **Mein Konto:** Kontobanner, siehe 11. Gruppenkopf rechts „Alle Strafen ›“.
- **Danach:** Terminzeilen mit Goldwürfel und Strich, rechts Marke. Gruppenkopf rechts „Kalender ›“.
- **Mein Status:** vier Knöpfe im 2er-Raster (Fit, Angeschlagen, Verletzt, Urlaub), direkt antippbar. Gewählt: Primärgrün mit Häkchen; sonst Sekundärknopf mit Farbpunkt.
- „In Kalender speichern“ und Teilen liegen im Menü ··· des Hero.

**02 Kalender**
- Titel plus Textverweis „+ Termin“ rechts (nur Trainer und Admin).
- Segment Alle / Spiele / Training / Sonstiges.
- Zeile „Kalender abonnieren ›“ mit Schließen-Kreuz.
- Terminkarten, Farbe nach Art:
  - Training: hellgrüner Kopf mit Goldlinie, wenn es der nächste Termin ist
  - Spiel: dunkler Kopf, darunter Ortszeile
  - Sonstiges: goldener Kopf
- Jede Karte hat Zu-/Absage und eine Zusagenzeile.
- „In Kalender speichern“, Bearbeiten und Absagen liegen im Menü ··· jeder Karte.

**03 Termin anlegen** (Blatt)
- Terminart als drei Kacheln Spiel / Training / Sonstiges mit Farbstrich.
- Felder als gruppierte Liste mit linkem Label 13/600 `--muted`: Gegner, Spielort (Segment Heim/Auswärts), Datum, Anstoß mit „Treffen“-Zeit, Ort, Notiz.
- Wiederholung als Segment Einmalig / Wöchentlich. Systemradios und Fieldset-Rahmen entfallen.
- Primärknopf über volle Breite, Text nach Art: „Spiel anlegen“, „Training anlegen“ oder „Termin anlegen“.

**04 Rückmeldungen-Blatt**
- Balken zeigt Zusagen grün **und** Absagen rot.
- Drei Kacheln Zu / Ab / Offen; die gewählte Kachel in Amber mit Rand `--amber-600` und Schrift `--amber-ink`.
- Namensraster 2-spaltig.
- Fuß: „Alle 7 erinnern“ als Primärknopf, „Teilen“ als Sekundärknopf.

**05 Mehr-Blatt:** gestrichen, betrifft die Beta, folgt separat. Vorerst unverändert lassen.

### B · Trainer und Kader (`Final B Trainer und Kader.dc.html`)

**06 Trainer · Spielauswahl**
- Spielkarte mit dunklem Kopf wie der Hero: „Nächstes Spiel · Auswärts“ in Gold, Gegner 22/800, Zeit „in 6 Tagen“.
- Darunter Rückmeldungen-Zeile mit Balken, dann „Elf aufstellen“ als Primärknopf.
- Karte Kader mit Balken und „15 fit · 1 verletzt“ sowie „16 Spieler ›“.
- Weitere Spiele als Terminzeilen mit Marke „Elf steht“ (grün) oder „Elf offen“ (amber).
- Vorlagen als Zeilen: Name oben, Formation und Datum in der Nebenzeile. Löschen liegt im Menü ··· mit Rückfrage.

**07 Platz und Bank**
- Unterkopf mit Zurück, Gegner, „So 11. Okt · 13:30 · 11 von 11“ und Menü.
- Formation als Chips: aktiv in Primärgrün, „Weitere“ als normaler Chip ohne Strichlinie.
- Spielfeld 440 hoch, Streifen `--pitch-green` und `#2a7541` im Wechsel alle 44 px. Spieler als Scheiben 40 px mit Nummer, Name 13/700 weiß darunter.
- Bank: Gruppenkopf „Bank · 1 von 7“ mit „Spieler wählen ›“. Plätze im 4er-Raster, Höhe 54. Freie Plätze als helle Fläche mit „+ frei“ 13 px, ohne Strichlinie.

**07b Platz · Position frei** (neu)
- Unterkopf zeigt „10 von 11“ in `--gold-ink`.
- Über dem Platz eine goldene Hinweiszeile (`--grad-task-gold`):
  - genau eine Position frei: „1 Position frei: Linksverteidiger · Besetzen ›“
  - mehrere frei: „3 Positionen frei · Nächste besetzen ›“; das Blatt 07c führt dann der Reihe nach durch
- Freie Position auf dem Feld: Ring 44 px, Rand 2 px `--gold-400`, Fläche Gold 22 %, Halo 6 px, „+“ weiß; darunter „LV frei“ in `--gold-400`.

**07c Blatt · Spieler für die Position** (neu)
- Kopf mit Positionsname und „Position frei · 3 Zugesagte passen“.
- Drei Gruppen: „Passt zur Position“, „Weitere Zugesagte“, „Nicht verfügbar“.
- Zeilen mit Avatar, Name, Position; rechts der „+“-Knopf oder eine Marke (Auf der Bank, Verletzt, Urlaub).
- Fuß: Sekundärknopf „Position leer lassen“.

**08 Blatt · Spieler für die Bank**
- Sekundärknopf „Alle 3 freien Zugesagten setzen“. Er erscheint nur, wenn freie Zugesagte vorhanden sind; die bisherige Erklärzeile entfällt.
- Gruppen nach Position („Tor · 2“, „Abwehr · 6“) als gruppierte Listen.
- Rechts je Zeile:
  - „+“-Knopf, wenn der Spieler wählbar ist
  - sonst eine Marke: „Auf dem Platz“ (neutral), „Auf der Bank“ (grün), „Verletzt“ (rot), „Urlaub“ (blau)
- **Keine ausgegrauten oder rosa Zeilen mehr.** „vergeben“ entfällt.

**09 Kader**
- Vier getönte Kacheln im 2er-Raster: Fit (grün), Angeschlagen (amber), Verletzt (rot), Urlaub (blau). Jeweils Label links 15/700, Zahl rechts 21/800.
- Gruppe „Fällt aus“ oben, darunter „Einsatzbereit · 15“.
- Jeder Spieler ist eine Zeile mit Avatar, Name und Status-Pille mit Farbpunkt und „▾“. Ein Tipp öffnet 10.

**10 Blatt · Status ändern**
- Kopf mit Avatar, Name, Position.
- Vier Statusknöpfe im 2er-Raster mit Farbpunkt; der gewählte ist getönt mit Rand.
- Feld für den Grund, Primärknopf „Speichern“.

### C · Konto, Kasse, Katalog (`Final C Konto Kasse Katalog.dc.html`)

Begriffe überall gleich: **Offen**, **Gemeldet** (Spieler hat Zahlung gemeldet, Kassenwart prüft), **Bezahlt**. „Zu prüfen“ und „Eingegangen“ entfallen als Namen.

**11 Konto · Ich**
- Segment Ich / Mannschaft.
- Kontobanner (`.mine-banner`), im Aufbau wie bisher, nur schlanker:
  - Etikett, Betrag groß in `--red-600`
  - darunter eine Zeile 13 px „3 Strafen offen · **8 gemeldet**“ (gemeldet in `--amber-ink`)
  - Bezahlknopf „30,00 € jetzt bezahlen“ (Primär, Höhe 52) mit „über PayPal · Freunde & Familie“
  - Trennlinie, dann eine Zeile: links „Zahlung melden ›“ 14/600, rechts die Marke „Erhöhung in 1h 50m“ (rot)
- **Entfallen:** `.mb-bar` (Balken), „offen von 620,00 € · 35 Strafen“, `.mb-note` („8 Strafen gemeldet · Kassenwart bestätigt …“).
- Darunter Status-Chips mit Anzahl „Offen 3 / Gemeldet 8 / Bezahlt 24“. „Meine“ und „Alle“ entfallen und gehen im Segment auf.
- Eigene Strafen als gruppierte Liste ohne Avatar und ohne Marke „offen“.

**12 Konto · Mannschaft**
- Zwei getönte Betragskacheln: „Offen“ (rot) und „In der Kasse“ (grün). Ersetzen „Summe offen“ und „Kontostand · Gesamtvolumen Saison“.
- Chips wie in 11, Mannschaftsliste mit Avatar. Nur Ansicht, keine Kassenhandlungen.

**13 Kasse · Gemeldet**
- „+ Strafe verhängen“ als Primärknopf unter dem Titel.
- Segment Gemeldet / Offen / Bezahlt; an „Gemeldet“ ein Amber-Zähler.
- Die drei Kennzahl-Kacheln oben **entfallen**, ebenso der Gruppenkopf „Prüfen und verbuchen“.
- Zeile „1 von 8 · 104,00 €“ mit Textverweis „Alle bestätigen“.
- Kartenstapel wie bisher: Avatar 56, Name, Grund, Betrag 40/800, Zahlart und Zeitpunkt. Darunter „Ablehnen“ (Sekundär, rot) und „Bestätigen“ (Primär).

**14 Kasse · Offen**
- Summenzeile „238 Strafen · 41 Spieler“ links, Betrag 21/800 rot rechts.
- **Nach Spielern gruppiert**, sortiert nach Betrag: Avatar, Name, „6 Strafen · älteste 10. Mai“, Betrag, „›“.
- Die Knöpfe je Strafe in der Liste (`.krow-actions`) entfallen und wandern ins Blatt 15.

**15 Blatt · Buchen** (neu, ersetzt die Knöpfe in der Liste)
- Kopf mit Avatar, Name, „6 offene Strafen · 72,00 €“.
- Strafen zum Abhaken (vorausgewählt), je Zeile Menü ··· mit **Storno**.
- Zahlart als Segment Bar / PayPal.
- Helle Zusammenfassung „2 Strafen, bar · 25,00 €“, darunter Primärknopf „Als bezahlt buchen“.
- Mehrere Strafen lassen sich auf einmal buchen.

**16 Strafe verhängen** (Blatt)
- Spieler als entfernbare Chips mit „Auswählen ›“.
- „Aus dem Katalog“ als gruppierte Liste mit Häkchen. „Individuell ›“ als Textverweis; der Hinweis „antippen zum Auswählen“ entfällt.
- Datum und Kommentar als gruppierte Felder.
- Helle Zusammenfassung, dann Primärknopf „Strafe speichern“ (gesperrt grau, nie hellgrün).

**17 Strafenkatalog**
- Titel plus „+ Strafe“ als Textverweis (nur Admin und Kassenwart). Begleitsatz entfällt.
- **Jede Strafe eine eigene Kachel**, Abstand 8, Höhe ab 56. Name 16/600, Staffel als Nebenzeile („je 5 Minuten“), Betrag 16/800 `--green-800` rechts, „›“.
- Stift und Mülleimer in der Zeile entfallen. Ein Tipp öffnet das Bearbeiten-Blatt (`.kat-edit`), dort liegt auch Löschen. Spieler sehen die Kacheln ohne „›“.
- **Keine Kategorien.**

### D · Einstellungen und Anmeldung (`Final D Einstellungen und Anmeldung.dc.html`)

**18 Einstellungen**
- Profilzeile oben: Avatar 44, Name, „Admin · Spieler · Profil ansehen“.
- Gruppen mit Kopf:
  - Für mich: Mitteilungen, Ruhezeiten, Kalender abonnieren
  - Verwaltung: Spielplan BFV, Strafenkatalog, Push-Texte, Rollen
  - Info: Diagnose, App neu laden
- Symbolkacheln einheitlich 32 × 32 `--green-050` mit Liniensymbol `--green-800`. Die bisherigen vier Farben entfallen.
- „Spielplan (BFV)“ wird „Spielplan BFV“ mit Wert „Verbunden“, ohne abgeschnittenen Vereinsnamen.

**19 Mitteilungen**
- Hauptschalter in eigener Karte, darunter Gruppen Termine und Strafen mit iOS-Schaltern (51 × 31, an `--green-700`).

**20 Kalender abonnieren** (eine Ebene statt Seite plus Blatt)
- Statuskarte mit Marke „Nicht eingerichtet“ bzw. „Eingerichtet“ und einem Satz.
- „iPhone und iPad“: Primärknopf „Im iPhone-Kalender abonnieren“.
- „Android und Google“: Sekundärknopf „Link kopieren“, darunter die Zeile „Google übernimmt Änderungen bis zu 24 h später.“ mit „Anleitung ›“. Die drei Schritte stehen in einem Blatt, siehe Teil E.
- „Link zurücksetzen“ als rote Zeile mit Folgesatz, Rückfrage vor dem Ausführen.

**21 Profil**
- Avatar 76, Name, Rollenpillen.
- Gruppe Konto: E-Mail, **Position** (statt Rückennummer), Passwort.
- „Abmelden“ als Sekundärknopf mit roter Schrift.

**22 Anmeldung**
- Bleibt auf dunklem Vereinsgrund (`--grad-auth`).
- Weiße Karte mit Wappen 76, Feldern 48 hoch und „Anmelden“ als Primärknopf.

### E · Unterseiten (`Final E Unterseiten.dc.html`)
Ruhezeiten, Spielplan BFV, Push-Texte, Diagnose, Google-Anleitung. Gleiches Muster: Gruppenkopf plus gruppierte Zeilen. **26 Rollen gestrichen**, betrifft die Beta, folgt separat.

---

## Wo Funktionen jetzt liegen

| Funktion | Vorher | Jetzt |
|---|---|---|
| In Kalender speichern | Textzeile auf jeder Karte | Menü ··· der Terminkarte bzw. des Hero |
| Termin hinzufügen | großer Primärknopf | „+ Termin“ neben dem Titel |
| Vorlage löschen | Mülleimer in der Zeile | Menü ··· mit Rückfrage |
| Strafe bearbeiten/löschen (Katalog) | Stift und Mülleimer | Tipp auf Kachel öffnet `.kat-edit` |
| Buchen, Storno (Kasse Offen) | Knöpfe je Strafe | Blatt Buchen je Spieler |
| Filter Meine / Alle (Konto) | Chips | Segment Ich / Mannschaft |
| Neu laden | Fußzeile jeder Seite | Ziehen zum Aktualisieren, Einstellungen › App neu laden |
| E-Mail | Profilzeile Einstellungen | Profil |

## Bewusst unverändert

Kopfzeile, Bottom-Nav, Farbpalette, Goldwürfel, Inter, Zu-/Absage-Knöpfe, Spielfeld, Kartenstapel „Gemeldet“, Aufbau des Rückmeldungen-Blatts, hierarchische Einstellungen im iOS-Stil, Mehr-Blatt und Rollen (Beta).

## Zustände

Für Laden, kein Netz, Fehler und Leer gibt es noch keine Vorlage. Leerzustand nach Muster `.empty`: Liniensymbol 24 px, ein Satz 15/600, optional ein Knopf.

## Assets

- `assets/logo.png`: Vereinswappen, aus dem Design-System
- `assets/ic-*.svg`: Liniensymbole für Navigation und Bedienung (Haus, Kalender, Buch, Karte, Mehr, Zahnrad, Pin, Kreuz, Häkchen, Zurück)

## Dateien in diesem Paket

- `referenz/Final Alle Screens.dc.html`: alle Screens untereinander
- `referenz/Final A Übersicht und Kalender.dc.html`: 01 bis 04
- `referenz/Final B Trainer und Kader.dc.html`: 06 bis 10, 07b, 07c
- `referenz/Final C Konto Kasse Katalog.dc.html`: 11 bis 17
- `referenz/Final D Einstellungen und Anmeldung.dc.html`: 18 bis 22
- `referenz/Final E Unterseiten.dc.html`: Unterseiten
- `referenz/Design-Review.dc.html`: Befundliste und die sieben Regeln mit Begründung
- `referenz/_ds/…`: Tokens und Schrift, damit die Vorlagen offline laden
- `referenz/support.js`: Laufzeit der Vorlagen, nicht für die App

Vorlagen im Browser öffnen, Werte mit den Entwicklerwerkzeugen ablesen.

## Auftrag an Claude Code (Vorschlag)

> Lies `design_handoff_app_ueberarbeitung/README.md`. Setz die Überarbeitung in dieser App um, in der Reihenfolge des Abschnitts „Umsetzungsreihenfolge“. Halte nach jedem Schritt an, zeig mir die Änderung und warte auf Freigabe. Keine Funktion darf wegfallen. Nutze die bestehenden Klassen und Tokens; neue Werte nur als Tokens.
