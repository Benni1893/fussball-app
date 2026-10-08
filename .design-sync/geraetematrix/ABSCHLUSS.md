# Gerätematrix: Abschluss

Nachtlauf 07./08.10.2026, Build **2026-10-08-A**. Ohne Test-Pushs, ohne
Datenbankänderung. Werkzeug: `.design-sync/shots/geraetematrix.mjs`.

## Ergebnis in Kürze

- **182 Zustände** aus der Landkarte geprüft: alle Ansichten, Unterseiten,
  Blätter und Menüs, je Rolle (vor der Anmeldung, Spieler, Trainer,
  Kassenwart, Trainer+Kassenwart, Admin). Alle wurden erreicht, und es gab
  keinen einzigen Request an Supabase.
- Die Zustände liefen jeweils **9 Breiten × 2 Schriftgrößen × 3 Varianten**,
  insgesamt 9828 Kombinationen.
- Vorher **4226 Einzelbefunde in 73 Gruppen**, nachher **793 in 22 Gruppen**.
- Waagerechtes Scrollen, Umbrüche in Wort/Betrag/Datum und Verdecktes:
  **keine mehr**.
- Was bleibt, sind Fälle ohne eindeutige Lösung (Abschnitt 4):
  - überlappende 44-px-Tippzonen benachbarter Elemente;
  - native Eingabefelder mit langem Inhalt;
  - zwei Überlappungen ohne Auswirkung.
- Bei 390 px stimmt die App weiter mit der Vorlage überein: alle 27 Screens
  grün (`finalmess.mjs alle`). Pflichtliste 20/20.
- Kontaktbogen zum Ansehen: **`kontaktbogen-320-130.png`** (18 Ansichten bei
  320 px und 130 %, Chromium mit Inter).

## 1. Matrix

| Achse | Werte |
|---|---|
| Breite (Höhe) | 320 (568), 360 (776), 375 (667), 384 (830), 390 (844), 393 (852), 412 (891), 414 (896), 430 (932) |
| Engine | Chromium 153 (Android-UA, DPR 2,625), WebKit 26.6 (iPhone-UA, DPR 3) |
| Schrift | Inter (Webfont geladen); unter Chromium zusätzlich **Roboto** als Systemschrift (Webfont fehlt, Android-Umbrüche) |
| Schriftgröße | 100 % und 130 % (jede berechnete Schrift- und Zeilenhöhe × 1,3, wie die Textvergrößerung von Android und iOS) |
| Safe Area | iPhone 47 oder 59 px oben und 34 px unten, SE 20 px oben; Android 24 px unten (Gestenleiste) |

Je Kombination gelten diese Prüfungen:
- waagerechtes Scrollen;
- abgeschnittener Text ohne gewollte Ellipse;
- Schnitt von Textzeilen und Bedienelementen;
- Trefferfläche: Prüfpunkte 21,5 px um die Mitte müssen das Element selbst treffen;
- verdeckt am Scrollanfang und -ende unter Kopf, Nav, Blattfuß oder Safe Area;
- Umbruch mitten in Wort, Betrag, Datum oder Uhrzeit.

Ich habe nur die Bilder der Befunde angesehen.

**Messartefakte, im Werkzeug behoben:**
- WebKit unter Windows zeichnet variable TTF-Schriften nur in einer Stärke.
  Jetzt laufen statische Schnitte 400 bis 900 von @fontsource.
- CSS-Übergänge animierten die künstliche Vergrößerung. Jetzt sind sie
  während der Messung aus.
- Zusätzlich lädt das Werkzeug einen Zustand frisch, falls eine Vergrößerung
  stehen bleibt.

Runde 0 enthält diese Artefakte noch, das gilt vor allem für WebKit.

| Runde | Stand | Einzelbefunde | Gruppen |
|---|---|---|---|
| 0 | Ausgangslage | 4226 | 73 |
| 1 | Korrekturen 1, statische Schriften | 1579 | 37 |
| 2 | Korrekturen 2 (Rollen, Katalogkopf, Bank-Blatt) | 835 | 30 |
| 3 | ohne Übergänge (Messfehler weg) | 808 | 24 |
| final | Schließen im Formations-Blatt | 793 | 22 |

## 2. Behobene Befunde

Alle Korrekturen ändern bei 390 px und 100 % nichts an der Darstellung (Messung grün). CSS am Ende von `styles.css` (Block „GERÄTEMATRIX“), Texte in `app.js`.

| Befund (vorher) | Wo | Korrektur |
|---|---|---|
| Uhrzeit bricht vor „Uhr“ um („16:45 / Uhr“), sogar bei 390 px mit Roboto | Terminkarte, Übersicht, Danach, Trainer | geschütztes Leerzeichen vor „Uhr“ |
| Datum bricht um („30. / Sep“) | Kader, Kasse Offen, Konto, Vorlagen („geändert …“), Termin-Auswahl | geschütztes Leerzeichen in Tag und Monat (Teilen-Texte unverändert) |
| Betrag bricht vor „€“ um („15,00 / €“) | Kasse (Stapelkopf, Summen, Zeilen), Katalog, Konto, Buchen | `euro()` behält sein geschütztes Leerzeichen; die App ersetzte es bisher durch ein normales |
| Bottom-Nav: „Übersicht“ läuft über den Rand (320/130) | alle Ansichten | Beschriftung mit Ellipse |
| Segmente „Alle · Spiele · Training · Sonstiges“ und „Gemeldet 2 · Offen · Bezahlt“ laufen über (320/130), Seite scrollt seitlich | Kalender, Kasse | unter 360 px nach Inhalt verteilt, schmalerer Innenabstand |
| „Überweisung“ abgeschnitten (bis 393/130) | Blatt „Zahlung melden“ | Spalten mindestens so breit wie ihr Wort |
| „Rückennummer“, „Kommentar“ laufen in den Wert (130 %) | Profil, Strafe verhängen, Termin-Blatt | Beschriftungsspalte wächst mit langem Wort |
| Kader-Kennzahl: Zahl rechts abgeschnitten („Angeschlagen 1“, bis 375/130) | Kader | Zahl bleibt, Wort wird gekürzt |
| Termin-Blatt: Liste schrumpft, letzte Zeile beschnitten (320) | Termin anlegen/bearbeiten | Liste schrumpft nicht, Blatt scrollt |
| Eingabefelder nur 20 px hoch (Trefferfläche) | Termin-Blatt (Titel, Gegner, Ort) | Feld füllt die Zeile (52 px) |
| Uhrzeitfeld „Ende“ nur 31 px breit | Termin-Blatt (Training) | mindestens 44 px |
| Formationspillen: 44-px-Zone vom Scrollbereich gekappt (38 px) | Platz | Innenabstand am Scrollbereich, Außenabstand ausgeglichen |
| Name läuft unter die Marke „Auf dem Platz“ (bis 375, auch 100 %) | Bank-Blatt, Kasse Offen | Name kürzt sich mit Ellipse |
| „Meldeschluss in 21 h“ abgeschnitten / unter dem Chevron (320 bis 375/130) | Übersicht, Kalender | darf in die nächste Zeile rutschen |
| „Mannschaft“ unter dem Wert „SV Musterhausen 2“ (bis 375/130) | Spielplan BFV | Wert wird gekürzt |
| **Spalten Kassenwart und Admin abgeschnitten, nicht erreichbar** (lange E-Mail, alle Breiten bis 414) | Rollen verwalten | feste Rollenspalten zu 48 px, Name und E-Mail mit Ellipse; Kästchen-Zonen überlappen nicht mehr |
| „+ Strafe“ läuft über den Rand (320/130) | Katalog | Kopf darf umbrechen, Verweis rutscht unter den Titel |
| Bank-Blatt: letzte Zeile unter der Home-Leiste (alle iPhones) | Bank-Blatt | Abstand für die Safe Area, wenn die Fußzeile leer ist |
| Schließen-× 43 px breit | Teilen-Fenster | 44 × 44 px |
| Schließen-× im Formations-Blatt zusammengedrückt (320/130) | Formations-Blatt | schrumpft nicht |
| Zu-/Absage-Knöpfe und weitere Knöpfe erben die App-Schrift nicht (Safari: Systemschrift statt Inter) | überall | Knöpfe und Felder erben die Schrift |

Prüfskript `kassepruef.mjs`: vergleicht Beträge jetzt mit normalisiertem geschütztem Leerzeichen (die Prüfungen selbst unverändert).

## 3. Iterationen

- Runde 1: eine Korrektur traf das Buchen-Blatt bei 390 px (Name gekürzt). Ich habe sie auf Bank-Blatt und Kasse Offen begrenzt.
- Runde 1: die BFV-Korrektur verschob in den Push-Texten den Chevron. Sie greift jetzt nur in Zeilen mit Wert (`:has`).
- Runde 2: Die E-Mail-Umbrechung in den Rollen war ein Umbruch mitten im Wort. Ersetzt durch feste Spalten und Ellipse.

Kein Befund brauchte mehr als drei Runden.

## 4. Unklare Fälle (nicht angefasst)

- **Überlappende Tippzonen benachbarter Elemente.** Jedes Element hat für sich 44 px, aber die Zone des Nachbarn reicht hinein.
  - Betroffen:
    - Zusage/Absage über „9 zu · 2 ab · 5 offen ›“ in den Kalenderkarten;
    - „Alle bestätigen“ über der Prüfkarte;
    - „Spieler wählen ›“ über dem ersten Bankplatz;
    - × am Bankplatz neben dem nächsten Platz;
    - „+ Neu“ bei den Vorlagen;
    - Konto-Chips bei 375/130;
    - Rollen-Kästchen bei 130 %.
  - Eine Lösung braucht mehr Abstand und ändert das Layout der Vorlage. Das ist eine Entscheidung.
- **Native Eingabefelder mit langem Inhalt** („Sportplatz Musterhausen“, Push-Titel, Katalogname bei 320/130, Datumsfeld im Status-Blatt). Der Text rollt im Feld, wie es Eingabefelder tun. Kein Fehler, aber bei 320 px sieht man den Ortsnamen nicht ganz.
- **Datumswürfel bei 130 %**: Wochentag und Tag rücken im festen Würfel 2 bis 3 px übereinander. Der Würfel hat feste Maße aus der Vorlage; er müsste mitwachsen oder die Schrift begrenzen.
- **Teilen-Fenster (alt)**: Die Zone des × reicht über die Unterzeile „Text frei anpassen …“. Keine Auswirkung außer einem Tipp auf die Unterzeile, der schließt.
- **„Anleitung ›“ in Kalender abonnieren (320) und „Neu laden“ in der Fußzeile (384, 430)**: Die Zone stößt unten an den Bildschirmrand oder die Nav, bei Scrollende frei.
- **Segment-Knopf „Alle“ (320/130)**: Nach der Verteilung nach Inhalt ist er schmaler als 44 px. Die Zone reicht in „Spiele“.
- Nicht nachgestellt: SF Pro (iPhone-Systemschrift, unter Windows nicht verfügbar). Ohne geladenes Inter fiele iOS darauf zurück. Die Roboto-Variante deckt den Fall „Webfont fehlt“ für Android ab.

## 5. Befunde nach dem letzten Lauf

Screenshots liegen lokal unter `.design-sync/geraetematrix/befunde/` (177 MB, per `.gitignore` nicht versioniert; neu erzeugbar mit `node .design-sync/shots/geraetematrix.mjs`). Pfade relativ zu `.design-sync/geraetematrix/`.

793 Einzelbefunde in 22 Gruppen.

| Befund | Ansicht | Breite | Engine | Schrift | Screenshot |
|---|---|---|---|---|---|
| Text abgeschnitten: `div.tf-z > input.tf-in` „Sportplatz Musterhausen“ · Eingabefeld | admin: dashboard+terminModal, trainer: dashboard+terminModal, trainerkassenwart: dashboard+terminModal | 320, 360, 375, 384, 390, 393 | Chromium · Inter, Chromium · Roboto, WebKit · Inter | 100, 130 % | `befunde/chromium-inter/admin/dashboard_terminModal-320-100.png` |
| Text abgeschnitten: `label.pkat-feld > input.pkat-in` „📅 {anzahl} neue Termine“ · Eingabefeld | admin: einstellungen/pushtext/termin_neu | 320, 360, 375, 384, 390, 393 | Chromium · Inter, Chromium · Roboto, WebKit · Inter | 100, 130 % | `befunde/chromium-inter/admin/einstellungen_pushtext_termin_neu-320-130.png` |
| Text abgeschnitten: `div.kat-item.kat-edit > input.kat-in.kat-in-name` „Verspätete Rückmeldung“ · Eingabefeld | admin: katalog+katBlatt, kassenwart: katalog+katBlatt, trainerkassenwart: katalog+katBlatt | 320 | Chromium · Inter, Chromium · Roboto, WebKit · Inter | 130 % | `befunde/chromium-inter/admin/katalog_katBlatt-320-130.png` |
| Text abgeschnitten: `label.sb-feld.sb-datum > input` „2026-10-10“ · Eingabefeld | admin: kader+statusBlatt, trainer: kader+statusBlatt, trainerkassenwart: kader+statusBlatt | 320 | WebKit · Inter | 130 % | `befunde/webkit-inter/admin/kader_statusBlatt-320-130.png` |
| Trefferfläche < 44 px: `div.group-head.ks-stapelkopf > button.link-btn` · zu klein unten | admin: kasse/pruefen, kassenwart: kasse/pruefen, trainerkassenwart: kasse/pruefen | alle | Chromium · Inter, Chromium · Roboto, WebKit · Inter | 100, 130 % | `befunde/chromium-inter/admin/kasse_pruefen-320-100.png` |
| Trefferfläche < 44 px: `div.tk-rsvp > button.tk-btn` · zu klein unten | admin: kalender, trainer: kalender, trainerkassenwart: kalender | alle | Chromium · Inter, Chromium · Roboto, WebKit · Inter | 100 % | `befunde/chromium-inter/admin/kalender-320-100.png` |
| Trefferfläche < 44 px: `button.tv-bslot > span.tv-bx` · zu klein rechts | admin: trainer/spiel, trainer: trainer/spiel, trainerkassenwart: trainer/spiel | 384, 390, 393, 412, 414, 430 | Chromium · Inter, Chromium · Roboto, WebKit · Inter | 100, 130 % | `befunde/chromium-inter/admin/trainer_spiel-384-100.png` |
| Trefferfläche < 44 px: `div.group-head.tv-bank-kopf > button.link-btn` · zu klein unten | admin: trainer/spiel, trainer: trainer/spiel, trainerkassenwart: trainer/spiel | 360, 384, 390, 393, 412, 414, 430 | Chromium · Inter, Chromium · Roboto, WebKit · Inter | 100, 130 % | `befunde/chromium-inter/admin/trainer_spiel-360-100.png` |
| Trefferfläche < 44 px: `div.modal-head > button.modal-x` · zu klein unten | admin: dashboard+rsvpSheet+shareModal, admin: kalender+rsvpSheet+shareModal, admin: trainer+rsvpSheet+shareModal (+6) | 375, 430 | Chromium · Inter, Chromium · Roboto, WebKit · Inter | 130 % | `befunde/chromium-inter/admin/dashboard_rsvpSheet_shareModal-375-130.png` |
| Trefferfläche < 44 px: `div.group-head > button.link-btn` · zu klein rechts | admin: trainer, trainer: trainer, trainerkassenwart: trainer | 360, 384, 390, 393, 412, 414, 430 | Chromium · Roboto | 100 % | `befunde/chromium-roboto/admin/trainer-360-100.png` |
| Trefferfläche < 44 px: `div.tk-unten > button.tk-unten-l` · zu klein unten | admin: kalender, trainer: kalender, trainerkassenwart: kalender | 320, 360, 384, 390, 393 | Chromium · Inter, Chromium · Roboto, WebKit · Inter | 100 % | `befunde/chromium-inter/admin/kalender-360-100.png` |
| Trefferfläche < 44 px: `div.kal-seg > button.kal-seg-b` · zu klein rechts | admin: kalender, kassenwart: kalender, spieler: kalender (+2) | 320 | Chromium · Inter, Chromium · Roboto, WebKit · Inter | 130 % | `befunde/chromium-inter/admin/kalender-320-130.png` |
| Trefferfläche < 44 px: `div.ein-fusszeile > button.link-btn` · zu klein unten | admin: einstellungen/kalender, kassenwart: einstellungen/kalender, spieler: einstellungen/kalender (+2) | 320 | Chromium · Inter, Chromium · Roboto | 100 % | `befunde/chromium-inter/admin/einstellungen_kalender-320-100.png` |
| Trefferfläche < 44 px: `div.kt-chips > button.chip.kt-chip` · zu klein unten | admin: strafen, kassenwart: strafen, spieler: strafen (+2) | 375 | WebKit · Inter | 130 % | `befunde/webkit-inter/admin/strafen-375-130.png` |
| Trefferfläche < 44 px: `footer.app-footer > button#resetBtn.link-btn` · zu klein unten | admin: trainer, admin: einstellungen/pushtext/termin_neu, trainer: trainer (+2) | 384, 430 | Chromium · Inter, Chromium · Roboto | 100, 130 % | `befunde/chromium-inter/admin/trainer-430-130.png` |
| Trefferfläche < 44 px: `td > input.role-box` · zu klein unten | admin: rollen-verwalten | 320, 375 | Chromium · Inter, WebKit · Inter | 130 % | `befunde/chromium-inter/admin/rollen-verwalten-375-130.png` |
| Trefferfläche < 44 px: `div.group-head > button.link-btn` · zu klein unten | kassenwart: dashboard, spieler: dashboard | 384, 390, 412, 414 | Chromium · Inter, WebKit · Inter | 130 % | `befunde/chromium-inter/kassenwart/dashboard-390-130.png` |
| Trefferfläche < 44 px: `div.tk-unten > button.tk-unten-r` · zu klein unten | admin: kalender, trainer: kalender, trainerkassenwart: kalender | 320 | Chromium · Roboto | 100 % | `befunde/chromium-roboto/admin/kalender-320-100.png` |
| Trefferfläche < 44 px: `div.tk-kopfzeile > button.tk-menue` · zu klein unten | admin: kalender, trainer: kalender, trainerkassenwart: kalender | 375 | WebKit · Inter | 100 % | `befunde/webkit-inter/admin/kalender-375-100.png` |
| Trefferfläche < 44 px: `button.tv-bslot > span.tv-bx` · zu klein rechts/unten | admin: trainer/spiel, trainer: trainer/spiel, trainerkassenwart: trainer/spiel | 390 | WebKit · Inter | 100 % | `befunde/webkit-inter/admin/trainer_spiel-390-100.png` |
| Überlappung: `div.modal > p.modal-sub` „Text frei anpassen, dann teilen oder kop“ · div.modal > div.modal-head > button.modal-x | admin: dashboard+rsvpSheet+shareModal, admin: kalender+rsvpSheet+shareModal, admin: trainer+rsvpSheet+shareModal (+6) | 320, 360, 375, 384, 390 | Chromium · Inter, Chromium · Roboto, WebKit · Inter | 100 % | `befunde/chromium-inter/admin/dashboard_rsvpSheet_shareModal-320-100.png` |
| Überlappung: `span.wf.wf-karte > span.wf-wd` „So / 4“ · div.tk-kopfzeile > span.wf.wf-karte > span.wf-day.num | admin: kalender, kassenwart: kalender, spieler: kalender (+2) | alle | Chromium · Inter | 130 % | `befunde/chromium-inter/admin/kalender-320-130.png` |

## 6. Werkzeuge, Commit

- `geraetematrix.mjs` ist die Matrix. Ergebnisse in `ergebnis-<variante>.json`. Teilläufe gehen mit `GM_PROFIL`, `GM_BREITEN`, `GM_SCHRIFT` und `GM_NUR`.
- `gmbericht.mjs` erzeugt die Tabelle aus den Ergebnissen.
- `kontaktbogen.mjs` erzeugt `kontaktbogen-320-130.png`.
- `gmdiag.mjs` zeigt für einen Zustand, was an den Prüfpunkten einer Trefferfläche liegt.
- `landkarte.mjs` exportiert jetzt `kandidatenImBrowser`.
- Commit „Gerätematrix: Umbrüche, Überlauf, Trefferflächen bei 320 bis 430 px und 130 % (Build 2026-10-08-A)“.

## 7. iPhone-Testliste

1. Einstellungen, Bedienungshilfen, Textgröße groß: Übersicht und Kalender ohne seitliches Scrollen, „16:45 Uhr“ und „30. Sep“ in einer Zeile.
2. Kasse: Beträge wie „15,00 €“ nie getrennt; Segment „Gemeldet 2 · Offen · Bezahlt“ passt.
3. Bank-Blatt bis ganz nach unten scrollen: die letzte Zeile steht über der Home-Leiste.
4. Rollen verwalten (Admin): alle drei Spalten Tr, Ka, Ad sichtbar und antippbar.
5. Termin anlegen: Tipp irgendwo in die Zeile „Ort“ setzt den Cursor ins Feld.

## Anhang: Ausgangslage (Runde 0)

Mit den damaligen Messartefakten (variable Schrift unter WebKit, Übergänge), deshalb nur zur Einordnung.

| Befund | Ansicht | Breite | Engine | Schrift | Screenshot |
|---|---|---|---|---|---|
| Text abgeschnitten: `button.zart > span` „Überweisung“ · an button.zart | admin: dashboard+zmBl, admin: strafen+zmBl, kassenwart: dashboard+zmBl (+7) | 320, 360, 375, 384, 390, 393 | Chromium · Inter, Chromium · Roboto, WebKit · Inter | 130 % | `befunde/chromium-inter/admin/dashboard_zmBl-320-130.png` |
| Text abgeschnitten: `div.tf-z > input.tf-in` „Sportplatz Musterhausen“ · Eingabefeld | admin: dashboard+terminModal, trainer: dashboard+terminModal, trainerkassenwart: dashboard+terminModal | 320, 360, 375, 384, 390, 393 | Chromium · Inter, Chromium · Roboto, WebKit · Inter | 100, 130 % | `befunde/chromium-inter/admin/dashboard_terminModal-320-100.png` |
| Text abgeschnitten: `th > abbr` „Ad“ · an div.card.table-wrap | admin: rollen-verwalten | alle | Chromium · Inter, Chromium · Roboto, WebKit · Inter | 100, 130 % | `befunde/chromium-inter/admin/rollen-verwalten-320-100.png` |
| Text abgeschnitten: `div.tf-z > span.tf-l` „Notiz“ · an div.tf-liste | admin: dashboard+terminModal, admin: kalender+terminModal, trainer: dashboard+terminModal (+3) | 320 | Chromium · Inter, Chromium · Roboto, WebKit · Inter | 100, 130 % | `befunde/chromium-inter/admin/dashboard_terminModal-320-130.png` |
| Text abgeschnitten: `div.chips.st-chips > button.chip.st-choice` „Angeschlagen“ · an body | admin: dashboard, admin: einstellungen/profil, admin: profil (+9) | 360, 375, 384, 390, 393, 412, 414, 430 | WebKit · Inter | 100, 130 % | `befunde/webkit-inter/admin/dashboard-360-130.png` |
| Text abgeschnitten: `div.kpi.kad-kpi > span.kpi-value` „1“ · an div.kpi.kad-kpi | admin: kader, trainer: kader, trainerkassenwart: kader | 320, 360, 375, 384 | Chromium · Inter, Chromium · Roboto, WebKit · Inter | 130 % | `befunde/chromium-inter/admin/kader-320-130.png` |
| Text abgeschnitten: `th > abbr` „Ka“ · an div.card.table-wrap | admin: rollen-verwalten | 320, 360, 375, 384, 390, 393, 412 | Chromium · Inter, Chromium · Roboto, WebKit · Inter | 100, 130 % | `befunde/chromium-inter/admin/rollen-verwalten-320-100.png` |
| Text abgeschnitten: `span.tk-rueck-kopf > span.tk-ms.cd` „Meldeschluss in 21 h“ · an div#ev-e-sp1.card.tk | admin: dashboard, kassenwart: dashboard, spieler: dashboard (+2) | 320 | Chromium · Inter, Chromium · Roboto, WebKit · Inter | 130 % | `befunde/chromium-inter/admin/dashboard-320-130.png` |
| Text abgeschnitten: `label.pkat-feld > input.pkat-in` „📅 {anzahl} neue Termine“ · Eingabefeld | admin: einstellungen/pushtext/termin_neu | 320, 360, 375, 384, 390, 393 | Chromium · Inter, Chromium · Roboto, WebKit · Inter | 100, 130 % | `befunde/chromium-inter/admin/einstellungen_pushtext_termin_neu-320-130.png` |
| Text abgeschnitten: `div.kal-seg > button.kal-seg-b` „Sonstiges“ · an body | admin: kalender, kassenwart: kalender, spieler: kalender (+2) | 320 | Chromium · Inter, Chromium · Roboto | 130 % | `befunde/chromium-inter/admin/kalender-320-130.png` |
| Text abgeschnitten: `div.kat-item.kat-edit > input.kat-in.kat-in-name` „Verspätete Rückmeldung“ · Eingabefeld | admin: katalog+katBlatt, kassenwart: katalog+katBlatt, trainerkassenwart: katalog+katBlatt | 320 | Chromium · Inter, Chromium · Roboto, WebKit · Inter | 130 % | `befunde/chromium-inter/admin/katalog_katBlatt-320-130.png` |
| Text abgeschnitten: `div.kpi.kad-kpi > span.kpi-label` „Angeschlagen“ · an div.kpi.kad-kpi | admin: kader, trainer: kader, trainerkassenwart: kader | 320 | Chromium · Inter, WebKit · Inter | 130 % | `befunde/chromium-inter/admin/kader-320-130.png` |
| Text abgeschnitten: `th > abbr` „Tr“ · an div.card.table-wrap | admin: rollen-verwalten | 320, 360, 375 | Chromium · Inter, Chromium · Roboto, WebKit · Inter | 130 % | `befunde/chromium-inter/admin/rollen-verwalten-320-130.png` |
| Text abgeschnitten: `div.tf-z > span.tf-l` „Ort“ · an div.tf-liste | admin: dashboard+terminModal, admin: kalender+terminModal, trainer: dashboard+terminModal (+3) | 320 | WebKit · Inter | 130 % | `befunde/webkit-inter/admin/dashboard_terminModal-320-130.png` |
| Text abgeschnitten: `a.btn.btn-primary > span` „calendar.google.com öffnen“ · an body | kassenwart: einstellungen/google, spieler: einstellungen/google | 384, 390 | WebKit · Inter | 100, 130 % | `befunde/webkit-inter/kassenwart/einstellungen_google-384-130.png` |
| Text abgeschnitten: `div.page-head.h1row > button.link-btn.kal-plus` „+ Strafe“ · an body | admin: katalog, kassenwart: katalog, trainerkassenwart: katalog | 320 | WebKit · Inter | 130 % | `befunde/webkit-inter/admin/katalog-320-130.png` |
| Text abgeschnitten: `label.sb-feld.sb-datum > input` „2026-10-10“ · Eingabefeld | admin: kader+statusBlatt, trainer: kader+statusBlatt, trainerkassenwart: kader+statusBlatt | 320 | WebKit · Inter | 130 % | `befunde/webkit-inter/admin/kader_statusBlatt-320-130.png` |
| Text abgeschnitten: `div > div.rollen-name` „neu@landkarte.example.invalid“ · an div.card.table-wrap | admin: rollen-verwalten | 320 | Chromium · Inter, WebKit · Inter | 130 % | `befunde/chromium-inter/admin/rollen-verwalten-320-130.png` |
| Trefferfläche < 44 px: `div.tv-formbar > button.tv-fpill` · zu klein oben/unten | admin: trainer/spiel, trainer: trainer/spiel, trainerkassenwart: trainer/spiel | alle | Chromium · Inter, Chromium · Roboto, WebKit · Inter | 100, 130 % | `befunde/chromium-inter/admin/trainer_spiel-320-100.png` |
| Trefferfläche < 44 px: `td > input.role-box` · zu klein rechts | admin: rollen-verwalten | alle | Chromium · Inter, Chromium · Roboto, WebKit · Inter | 100, 130 % | `befunde/chromium-inter/admin/rollen-verwalten-320-100.png` |
| Trefferfläche < 44 px: `div.tf-z > input.tf-in` · zu klein oben/unten | admin: dashboard+terminModal, admin: kalender+terminModal, trainer: dashboard+terminModal (+3) | alle | Chromium · Inter, Chromium · Roboto, WebKit · Inter | 100, 130 % | `befunde/chromium-inter/admin/dashboard_terminModal-320-100.png` |
| Trefferfläche < 44 px: `div.modal-head > button.modal-x` · zu klein links/rechts | admin: dashboard+shareModal, admin: kalender+shareModal, trainer: dashboard+shareModal (+3) | alle | Chromium · Inter, Chromium · Roboto, WebKit · Inter | 100, 130 % | `befunde/chromium-inter/admin/dashboard_shareModal-320-100.png` |
| Trefferfläche < 44 px: `div.tf-z.tf-nurtermin > input.tf-in` · zu klein oben/unten | admin: kalender+terminModal, trainer: kalender+terminModal, trainerkassenwart: kalender+terminModal | alle | Chromium · Inter, Chromium · Roboto, WebKit · Inter | 100, 130 % | `befunde/chromium-inter/admin/kalender_terminModal-320-100.png` |
| Trefferfläche < 44 px: `span.tf-nat > input` · zu klein links/rechts | admin: kalender+terminModal, trainer: kalender+terminModal, trainerkassenwart: kalender+terminModal | alle | Chromium · Inter, Chromium · Roboto, WebKit · Inter | 100, 130 % | `befunde/chromium-inter/admin/kalender_terminModal-320-100.png` |
| Trefferfläche < 44 px: `div.group-head.ks-stapelkopf > button.link-btn` · zu klein unten | admin: kasse/pruefen, kassenwart: kasse/pruefen, trainerkassenwart: kasse/pruefen | alle | Chromium · Inter, Chromium · Roboto, WebKit · Inter | 100, 130 % | `befunde/chromium-inter/admin/kasse_pruefen-320-100.png` |
| Trefferfläche < 44 px: `div.tk-rsvp > button.tk-btn` · zu klein unten | admin: kalender, trainer: kalender, trainerkassenwart: kalender | alle | Chromium · Inter, Chromium · Roboto, WebKit · Inter | 100 % | `befunde/chromium-inter/admin/kalender-320-100.png` |
| Trefferfläche < 44 px: `div.tv-formbar > button.tv-fpill.tv-fmore` · zu klein oben/unten | admin: trainer/spiel, trainer: trainer/spiel, trainerkassenwart: trainer/spiel | 360, 375, 384, 390, 393, 412, 414, 430 | Chromium · Inter, Chromium · Roboto, WebKit · Inter | 100, 130 % | `befunde/chromium-inter/admin/trainer_spiel-360-100.png` |
| Trefferfläche < 44 px: `button.tv-bslot > span.tv-bx` · zu klein rechts | admin: trainer/spiel, trainer: trainer/spiel, trainerkassenwart: trainer/spiel | 384, 390, 393, 412, 414, 430 | Chromium · Inter, Chromium · Roboto, WebKit · Inter | 100, 130 % | `befunde/chromium-inter/admin/trainer_spiel-384-100.png` |
| Trefferfläche < 44 px: `div.group-head.tv-bank-kopf > button.link-btn` · zu klein unten | admin: trainer/spiel, trainer: trainer/spiel, trainerkassenwart: trainer/spiel | 360, 384, 390, 393, 412, 414, 430 | Chromium · Inter, Chromium · Roboto, WebKit · Inter | 100, 130 % | `befunde/chromium-inter/admin/trainer_spiel-360-100.png` |
| Trefferfläche < 44 px: `div.modal-head > button.modal-x` · zu klein rechts | admin: dashboard+shareModal, admin: kalender+shareModal, trainer: dashboard+shareModal (+3) | 360, 375, 384, 390, 393, 430 | Chromium · Inter, Chromium · Roboto, WebKit · Inter | 100, 130 % | `befunde/chromium-inter/admin/dashboard_shareModal-375-100.png` |
| Trefferfläche < 44 px: `div.modal-head > button.modal-x` · zu klein unten | admin: dashboard+rsvpSheet+shareModal, admin: kalender+rsvpSheet+shareModal, admin: trainer+rsvpSheet+shareModal (+6) | 320, 375, 430 | Chromium · Inter, Chromium · Roboto, WebKit · Inter | 130 % | `befunde/chromium-inter/admin/dashboard_rsvpSheet_shareModal-320-130.png` |
| Trefferfläche < 44 px: `span.tf-nat > input` · zu klein rechts | admin: dashboard+terminModal, trainer: dashboard+terminModal, trainerkassenwart: dashboard+terminModal | alle | Chromium · Roboto | 100 % | `befunde/chromium-roboto/admin/dashboard_terminModal-320-100.png` |
| Trefferfläche < 44 px: `div.group-head > button.link-btn` · zu klein rechts | admin: trainer, trainer: trainer, trainerkassenwart: trainer | 360, 384, 390, 393, 412, 414, 430 | Chromium · Roboto | 100 % | `befunde/chromium-roboto/admin/trainer-360-100.png` |
| Trefferfläche < 44 px: `div.tk-unten > button.tk-unten-l` · zu klein unten | admin: kalender, trainer: kalender, trainerkassenwart: kalender | 320, 360, 384, 390, 393 | Chromium · Inter, Chromium · Roboto, WebKit · Inter | 100 % | `befunde/chromium-inter/admin/kalender-360-100.png` |
| Trefferfläche < 44 px: `div.ein-fusszeile > button.link-btn` · zu klein unten | admin: einstellungen/kalender, kassenwart: einstellungen/kalender, spieler: einstellungen/kalender (+2) | 320, 414 | Chromium · Inter, Chromium · Roboto, WebKit · Inter | 100 % | `befunde/chromium-inter/admin/einstellungen_kalender-320-100.png` |
| Trefferfläche < 44 px: `div.tv-sh > button.tv-shx` · zu klein links/rechts | admin: trainer/spiel+tvSheetForm, trainer: trainer/spiel+tvSheetForm, trainerkassenwart: trainer/spiel+tvSheetForm | 320 | Chromium · Inter, Chromium · Roboto, WebKit · Inter | 130 % | `befunde/chromium-inter/admin/trainer_spiel_tvSheetForm-320-130.png` |
| Trefferfläche < 44 px: `div.kt-chips > button.chip.kt-chip` · zu klein unten | admin: strafen, spieler: strafen, trainer: strafen | 375 | WebKit · Inter | 130 % | `befunde/webkit-inter/admin/strafen-375-130.png` |
| Trefferfläche < 44 px: `footer.app-footer > button#resetBtn.link-btn` · zu klein unten | admin: trainer, admin: einstellungen/pushtext/termin_neu, trainer: trainer (+2) | 384, 430 | Chromium · Inter, Chromium · Roboto | 100, 130 % | `befunde/chromium-inter/admin/trainer-430-130.png` |
| Trefferfläche < 44 px: `div.tv-sh > button.tv-shx` · zu klein rechts | admin: trainer/spiel+tvSheetForm, trainer: trainer/spiel+tvSheetForm, trainerkassenwart: trainer/spiel+tvSheetForm | 360 | Chromium · Inter, WebKit · Inter | 130 % | `befunde/chromium-inter/admin/trainer_spiel_tvSheetForm-360-130.png` |
| Trefferfläche < 44 px: `div.tk-unten > button.tk-unten-r` · zu klein unten | admin: kalender, trainer: kalender, trainerkassenwart: kalender | 320 | Chromium · Roboto | 100 % | `befunde/chromium-roboto/admin/kalender-320-100.png` |
| Trefferfläche < 44 px: `div.tk-kopfzeile > button.tk-menue` · zu klein unten | admin: kalender, trainer: kalender, trainerkassenwart: kalender | 375 | WebKit · Inter | 100 % | `befunde/webkit-inter/admin/kalender-375-100.png` |
| Trefferfläche < 44 px: `button.tv-bslot > span.tv-bx` · zu klein rechts/unten | admin: trainer/spiel, trainer: trainer/spiel, trainerkassenwart: trainer/spiel | 390 | WebKit · Inter | 100 % | `befunde/webkit-inter/admin/trainer_spiel-390-100.png` |
| Trefferfläche < 44 px: `div.group-head > button.link-btn` · zu klein unten | kassenwart: dashboard, spieler: dashboard | 384, 412, 414 | WebKit · Inter | 130 % | `befunde/webkit-inter/kassenwart/dashboard-412-130.png` |
| Trefferfläche < 44 px: `td > input.role-box` · zu klein rechts/unten | admin: rollen-verwalten | 375 | Chromium · Inter | 130 % | `befunde/chromium-inter/admin/rollen-verwalten-375-130.png` |
| Überlappung: `div.pr-zeile > span.pr-l` „Rückennummer / 6“ · div.ein-gruppe.pr-konto > div.pr-zeile > span.pr-w | admin: einstellungen/profil, admin: profil, kassenwart: einstellungen/profil (+4) | alle | Chromium · Inter, Chromium · Roboto, WebKit · Inter | 130 % | `befunde/chromium-inter/admin/einstellungen_profil-320-130.png` |
| Überlappung: `div.modal > p.modal-sub` „Text frei anpassen, dann teilen oder kop“ · div.modal > div.modal-head > button.modal-x | admin: dashboard+rsvpSheet+shareModal, admin: kalender+rsvpSheet+shareModal, admin: trainer+rsvpSheet+shareModal (+6) | 320, 360, 375, 384, 390 | Chromium · Inter, Chromium · Roboto, WebKit · Inter | 100 % | `befunde/chromium-inter/admin/dashboard_rsvpSheet_shareModal-320-100.png` |
| Überlappung: `span.wf.wf-karte > span.wf-wd` „So / 4“ · div.tk-kopfzeile > span.wf.wf-karte > span.wf-day.num | admin: kalender, kassenwart: kalender, spieler: kalender (+2) | alle | Chromium · Inter | 130 % | `befunde/chromium-inter/admin/kalender-320-130.png` |
| Überlappung: `span.row-main > span.row-t` „Anton Feldmann / Auf dem Platz“ · span.row-end > span.mark > span | admin: trainer/spiel+tvSheetKader, trainer: trainer/spiel+tvSheetKader, trainerkassenwart: trainer/spiel+tvSheetKader | 320, 360, 375, 384 | Chromium · Inter, Chromium · Roboto, WebKit · Inter | 100, 130 % | `befunde/chromium-inter/admin/trainer_spiel_tvSheetKader-320-100.png` |
| Überlappung: `label.tf-z > span.tf-l` „Kommentar / Kommentar“ · div.card.tf-liste > label.tf-z > input.tf-in | admin: kasse/strafe-katalog+ksSeite, kassenwart: kasse/strafe-katalog+ksSeite, trainerkassenwart: kasse/strafe-katalog+ksSeite | 360, 384, 390, 393, 412, 414, 430 | Chromium · Inter, WebKit · Inter | 130 % | `befunde/chromium-inter/admin/kasse_strafe-katalog_ksSeite-384-130.png` |
| Überlappung: `div.chips.st-chips > button.chip.st-choice` „Angeschlagen / Fit“ · div.st-wahl > div.chips.st-chips > button.chip.st-choice | admin: einstellungen/profil, admin: profil, kassenwart: einstellungen/profil (+4) | 384, 390, 393, 412, 414, 430 | WebKit · Inter | 100, 130 % | `befunde/webkit-inter/admin/einstellungen_profil-390-100.png` |
| Überlappung: `span.tk-rueck-kopf > span.tk-ms.cd` „Meldeschluss in 21 h / ›“ · div.tk-body > button.tk-rueck > span.tk-chev | admin: dashboard, trainer: dashboard, trainerkassenwart: dashboard | 360, 375, 384 | Chromium · Inter, Chromium · Roboto, WebKit · Inter | 130 % | `befunde/chromium-inter/admin/dashboard-360-130.png` |
| Überlappung: `button.seg-b.ks-seg-b > b.ks-seg-n` „2 / Offen“ · div.ks-pane > div.seg.ks-seg > button.seg-b.ks-seg-b | admin: kasse/pruefen, admin: kasse/bezahlt, admin: kasse/offen (+6) | 320 | Chromium · Inter, WebKit · Inter | 130 % | `befunde/chromium-inter/admin/kasse_pruefen-320-130.png` |
| Überlappung: `div.kal-seg > button.kal-seg-b` „Training / Sonstiges“ · main#view.view > div.kal-seg > button.kal-seg-b | admin: kalender, kassenwart: kalender, spieler: kalender (+2) | 320 | Chromium · Inter, Chromium · Roboto | 130 % | `befunde/chromium-inter/admin/kalender-320-130.png` |
| Überlappung: `span.ein-schalter-main > span.ein-schalter-t` „Mannschaft / SV Musterhausen 2“ · div.ein-gruppe.ein-gruppe-gross > button.ein-schalter.ein-wertzeile > span.ein-zeit-wert | admin: einstellungen/bfv | 320, 360, 375, 384 | Chromium · Inter, Chromium · Roboto, WebKit · Inter | 130 % | `befunde/chromium-inter/admin/einstellungen_bfv-320-130.png` |
| Überlappung: `span.row-main > span.row-t` „Felix Oberhaus / 3,00 €“ · div.card.ks-liste > button.row.ks-zeile > span.row-end.ks-betrag | admin: kasse/bezahlt, kassenwart: kasse/bezahlt, trainerkassenwart: kasse/bezahlt (+3) | 320, 360 | Chromium · Inter, WebKit · Inter | 130 % | `befunde/chromium-inter/admin/kasse_bezahlt-320-130.png` |
| Überlappung: `span.row-main > span.row-t` „Ilja Rennert / 16,00 €“ · div.card.ks-liste > button.row.ks-zeile > span.row-end.ks-betrag | admin: kasse/offen, kassenwart: kasse/offen, trainerkassenwart: kasse/offen | 320 | Chromium · Inter, WebKit · Inter | 130 % | `befunde/chromium-inter/admin/kasse_offen-320-130.png` |
| Waagerechter Überlauf: `button.nav-btn > span.nav-label` „Übersicht“ | admin: dashboard, admin: dashboard+moreSheet, admin: dashboard+rsvpSheet (+130) | 320 | Chromium · Inter, WebKit · Inter | 130 % | `befunde/chromium-inter/admin/dashboard-320-130.png` |
| Waagerechter Überlauf: `Seite` „scrollWidth 324 > 320“ | admin: kalender, kassenwart: kalender, spieler: kalender (+22) | alle | Chromium · Inter, Chromium · Roboto, WebKit · Inter | 100, 130 % | `befunde/chromium-inter/admin/kalender-320-130.png` |
| Waagerechter Überlauf: `button.chip.st-choice > span.st-dot` | admin: dashboard+moreSheet, kassenwart: dashboard+zmBl, trainerkassenwart: dashboard+zmBl | 393, 412, 414, 430 | WebKit · Inter | 100, 130 % | `befunde/webkit-inter/admin/dashboard_moreSheet-414-130.png` |
| Waagerechter Überlauf: `a.btn.btn-primary > span` „calendar.google.com öffnen“ | kassenwart: einstellungen/google, spieler: einstellungen/google | 384, 390 | WebKit · Inter | 100, 130 % | `befunde/webkit-inter/kassenwart/einstellungen_google-384-130.png` |
| Umbruch in Wort/Betrag/Datum: `span.row-main > span.row-s` „18. Sep“ · Datum | admin: kader, trainer: kader, trainerkassenwart: kader | 320, 360, 375, 390, 393, 412, 414, 430 | Chromium · Inter, Chromium · Roboto, WebKit · Inter | 100, 130 % | `befunde/chromium-inter/admin/kader-320-100.png` |
| Umbruch in Wort/Betrag/Datum: `span.row-main > span.row-s` „20. Okt“ · Datum | admin: kader, trainer: kader, trainerkassenwart: kader | alle | Chromium · Inter, Chromium · Roboto, WebKit · Inter | 100, 130 % | `befunde/chromium-inter/admin/kader-320-100.png` |
| Umbruch in Wort/Betrag/Datum: `span.tk-kopf-main > span.tk-zeit.num` „16:45 Uhr“ · Uhrzeit | admin: dashboard, admin: kalender, kassenwart: dashboard (+7) | 320, 375, 384, 390, 393, 412, 414 | Chromium · Inter, Chromium · Roboto, WebKit · Inter | 100, 130 % | `befunde/chromium-inter/admin/dashboard-390-100.png` |
| Umbruch in Wort/Betrag/Datum: `span.row-main > span.row-s` „27. Sep“ · Datum | admin: kasse/offen, kassenwart: kasse/offen, trainerkassenwart: kasse/offen | 320, 360, 375, 384, 390, 393, 412, 414 | Chromium · Inter, Chromium · Roboto, WebKit · Inter | 100, 130 % | `befunde/chromium-inter/admin/kasse_offen-320-130.png` |
| Umbruch in Wort/Betrag/Datum: `span.dn-main > span.dn-s.num` „15:00 Uhr“ · Uhrzeit | admin: einstellungen/profil, admin: profil, kassenwart: einstellungen/profil (+4) | 320 | Chromium · Inter, WebKit · Inter | 130 % | `befunde/chromium-inter/admin/einstellungen_profil-320-130.png` |
| Umbruch in Wort/Betrag/Datum: `span.row-main > span.row-s` „10,00 €“ · Betrag | admin: kasse/strafe-katalog+ksSeite, kassenwart: kasse/strafe-katalog+ksSeite, trainerkassenwart: kasse/strafe-katalog+ksSeite | 320, 360, 375, 384 | Chromium · Inter, Chromium · Roboto, WebKit · Inter | 100, 130 % | `befunde/chromium-inter/admin/kasse_strafe-katalog_ksSeite-320-100.png` |
| Umbruch in Wort/Betrag/Datum: `div.ks-summe > span.ks-summe-b` „37,00 €“ · Betrag | admin: kasse/offen, kassenwart: kasse/offen, trainerkassenwart: kasse/offen | 320 | Chromium · Inter, Chromium · Roboto, WebKit · Inter | 130 % | `befunde/chromium-inter/admin/kasse_offen-320-130.png` |
| Umbruch in Wort/Betrag/Datum: `div.group-head.ks-stapelkopf > h2` „15,00 €“ · Betrag | admin: kasse/pruefen, kassenwart: kasse/pruefen, trainerkassenwart: kasse/pruefen | 320 | Chromium · Inter, WebKit · Inter | 130 % | `befunde/chromium-inter/admin/kasse_pruefen-320-130.png` |
| Umbruch in Wort/Betrag/Datum: `span.kat-main > span.kat-sub` „10,00 €“ · Betrag | admin: katalog, kassenwart: katalog, trainerkassenwart: katalog | 360 | Chromium · Inter, WebKit · Inter | 130 % | `befunde/chromium-inter/admin/katalog-360-130.png` |
| Umbruch in Wort/Betrag/Datum: `span.tv-tpl-main > span.tv-tpl-s` „20. Sep“ · Datum | admin: trainer, trainer: trainer, trainerkassenwart: trainer | 320 | Chromium · Inter, WebKit · Inter | 130 % | `befunde/chromium-inter/admin/trainer-320-130.png` |
| Umbruch in Wort/Betrag/Datum: `span.row-main > span.row-s` „30. Aug“ · Datum | admin: kasse/offen, kassenwart: kasse/offen, trainerkassenwart: kasse/offen | 320, 360 | Chromium · Roboto, WebKit · Inter | 130 % | `befunde/chromium-roboto/admin/kasse_offen-320-130.png` |
| Umbruch in Wort/Betrag/Datum: `span.kat-main > span.kat-sub` „10,00 €“ · Betrag | spieler: katalog, trainer: katalog | 320 | Chromium · Roboto | 130 % | `befunde/chromium-roboto/spieler/katalog-320-130.png` |
| Verdeckt (Kopf, Nav, Safe Area): `span.row-main > span.row-s` „ST“ · unter Safe Area unten (Scrollende) | admin: trainer/spiel+tvSheetKader, trainer: trainer/spiel+tvSheetKader, trainerkassenwart: trainer/spiel+tvSheetKader | 360, 375, 384, 390, 393, 412, 414, 430 | Chromium · Inter, Chromium · Roboto, WebKit · Inter | 100, 130 % | `befunde/chromium-inter/admin/trainer_spiel_tvSheetKader-360-130.png` |
