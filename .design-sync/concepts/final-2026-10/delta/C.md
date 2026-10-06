# Delta C · Konto, Kasse, Katalog (Screens 11 bis 17)

Stand 06.10.2026. Nur gelesen, nichts geändert.

Quellen Soll: `PAKET-README.md` (Tokens, Bausteine, Teil C, „Wo Funktionen jetzt liegen“), `referenz/Final C Konto Kasse Katalog.dc.html`, `soll/11` bis `soll/17` (.png und .json, gemessen bei 390 px).
Quellen Ist: `app.js` (Stand Build 2026-10-06-A), `styles.css`, `db.js`, `supabase/migrations/0030_fine_status.sql`, `0040`, `0045`, `0036`, Aufnahmen `.design-sync/landkarte/bilder/{spieler,kassenwart,admin}/`, `conventions.md`, `NOTES.md`.

Art: **Styling** (nur CSS/Tokens), **Frontend-Logik** (Markup, Rechnen, Ereignisse in `app.js`), **Abfrage** (neue oder geänderte Datenabfrage), **Schema**, **Backend** (RPC/Trigger).
Aufwand: S unter 1 h, M halbe Tag, L ein Tag und mehr.

Gemeinsame Vorarbeit aus den Schritten 1 bis 5 der Umsetzungsreihenfolge (Tokens, `.btn-primary`, `.group-head`, Marken, Kacheln) wird hier vorausgesetzt und nur genannt, wo C sie braucht.

---

## 1. Screens

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

## 2. Kernfragen

- **15 Blatt Buchen:** bestehende RPCs reichen (Begründung oben unter 15). `mark_fines_paid` nimmt `uuid[]`, prüft die Rolle, bucht atomar; erlaubt ist jede nicht leere Zahlart, `bar`, `paypal`, `ueberweisung` funktionieren. Storno je Zeile über `cancel_fine` bzw. `deleteFine`. Push wird vom bestehenden Sammler zu einer Nachricht je Spieler gebündelt. **Kein Backend.**
- **14 Offen nach Spielern gruppiert:** im Frontend aus `DEMO.strafen`, keine neue Abfrage.
- **Konto 11/12:** Zahlen für die Chips und „In der Kasse“ ebenfalls aus `DEMO.strafen`.

## 3. Begriffe

| Alt | Neu | Stellen |
|---|---|---|
| „Zu prüfen“ (Reiter) | „Gemeldet“ | app.js 5032; Leerzustand „Nichts zu prüfen“ 4740; Kachel „2 zu prüfen“ 5046 (entfällt) |
| „Eingegangen“ (Reiter, Chip) | „Bezahlt“ | app.js 4549, 5032, 5049 (entfällt); Leerzustand „Bestätigte Eingänge stehen hier.“ 4788 |
| Marke „eingegangen“ | „bezahlt“ | `STATUS_META["bestätigt"].label` app.js 210; wirkt auch im Verlauf (`histLineHtml`) |
| „Prüfen und verbuchen“ | entfällt | app.js 5059 |
| Kommentare, Konventionen | „Zu prüfen“/„Eingegangen“ | app.js 4613, 4629, 4785, 4808, 4813, 5822; `conventions.md` „Kasse: Reihenfolge statt Filter“, „Zahlart-Symbole“, Klassenzeile Kasse; Prüfskripte `.design-sync/shots/kassepruef.mjs`, `kassebild.mjs`, `kassekarte.mjs`, `kassemodul.mjs` prüfen die Texte und müssen mitgezogen werden |
| Push-Titel `zahlung_gemeldet` | heute „💰 {anzahl} zu prüfen“ (0045, Zeile 358; Daten in `notification_templates`) | sinngemäß „{anzahl} Zahlungen gemeldet“. Datenänderung, über die Ansicht Push-Texte (Admin) oder eine Datenzeile; **kein Schema**. Entscheidung beim Nutzer |

**Deep Link `#kasse=pruefen`:** bleibt technisch bestehen. Der Schlüssel steht in der Datenbank als Ziel der Vorlage `zahlung_gemeldet` (0036, Z. 355) und damit in bereits zugestellten Mitteilungen auf den Geräten; ein Umbenennen ließe alte Mitteilungen auf der Standardansicht landen. Empfehlung: interner Schlüssel `pruefen` bleibt (`kasse.tab`, `KS_TABS`, `data-kstab`, `data-task-pay`), `deepLinkZiel` nimmt zusätzlich `gemeldet` als Alias an (app.js 6534). Ebenso bleibt `#strafen=meine` (Ziel von vier Push-Vorlagen in 0036) und wird auf Segment Ich + Chip Offen abgebildet; `#strafen=alle` auf Segment Mannschaft; `offen|gemeldet|bezahlt` setzen den Chip im Segment Ich (app.js 6533).

## 4. Funktionen, die heute existieren und in der Vorlage fehlen (bleiben)

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

## 5. Änderungen mit Schema oder Backend

**Keine.** Alle Screens 11 bis 17 lassen sich mit `confirm_fines`, `mark_fines_paid(uuid[], text)`, `reject_fine`, `cancel_fine`, `cancel_batch`, `create_fines_batch`, `report_my_payment(text,text)`, `deleteFine` und `loadAll` bauen.

Freiwillig, nicht durch die Vorlage veranlasst:
- Check-Constraint `payment_method in ('bar','ueberweisung','paypal')` analog `reported_method` (Schema, eigene Migration nach den Regeln in `conventions.md`).
- Text der Push-Vorlage `zahlung_gemeldet` ohne „zu prüfen“ (Datenzeile, siehe Abschnitt 3).
- `ksBlattUnpay` schreibt heute direkt auf `fines` (`setFinePaid`, db.js 416) statt über eine RPC; unverändert lassen, nur vermerkt.

## 6. Frühere Entscheidungen, die die Vorlage kippt

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

## 7. Verbindliche Vorgaben, die von der Vorlage abweichen

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
