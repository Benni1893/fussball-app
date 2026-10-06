# Delta B · Trainer und Kader (06, 07, 07b, 07c, 08, 09, 10)

Stand: 06.10.2026, nur gelesen. Kein Code und keine Datenbank geändert.

Quellen Soll: `PAKET-README.md` (Design-Tokens, Bausteine, Abschnitt B, „Wo Funktionen jetzt liegen“), `referenz/Final B Trainer und Kader.dc.html`, `soll/06 … 10 *.png/.json` (Maße in CSS-px bei 390 px, x/y ab Rahmenkante 1 px).
Quellen Ist: `app.js` (Trainer-Ansicht `tvViewGames` ab Z. 3611, Platz `tvViewLineup` ab Z. 3832, Blätter `tvEnsurePanels` ab Z. 4057, Kader `renderKader` Z. 720), `styles.css` (Trainer Z. 1887 bis 2260, Feld-Nachtrag Z. 3031 bis 3045, Kader Z. 2862 ff.), `db.js` Z. 117 bis 147, Migration `supabase/migrations/0012_lineups.sql`, Aufnahmen `landkarte/bilder/trainer/trainer.png`, `trainer__spiel.png`, `trainer__spiel--tvSheetKader.png`, `admin/kader.png`.

Abkürzungen Art: **St** Styling, **FL** Frontend-Logik, **Ab** Abfrage, **Sc** Schema, **Be** Backend.
Zeilennummern beziehen sich auf den Stand von Commit `035d3fc`.

## 0. Voraussetzungen aus den globalen Schritten (Reihenfolge 1 bis 5 im README)

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

## 1. Screens

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

## 2. Freie Positionen (07b, 07c): Reicht das Schema?

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

## 3. Funktionen, die heute existieren und in der Vorlage fehlen (bleiben erhalten)

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

## 4. Änderungen mit Schema oder Backend

**Keine.**

- `lineups.slots`/`bank`/`formation` reichen (Abschnitt 2).
- Status schreiben weiter über RPC `set_player_status(p_player, p_status, p_note, p_until)`. `status_since` liefert die Datenbank schon („seit 28. Sep“).
- Rückmeldungen-Zeile in 06 nutzt das vorhandene Blatt `openRsvpSheet` und vorhandene `rsvps`-Daten.
- Keine neue Abfrage: Spieler, Status, Zusagen und Aufstellungen werden bereits in `DB.loadAll` geladen.
- Nur Frontend: neue Tokens, Markup in `app.js`, Regeln in `styles.css`, Build-Kennung in `index.html` hochzählen (Cache).

---

## 5. Verbindliche Vorgaben, die von der Vorlage abweichen

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
