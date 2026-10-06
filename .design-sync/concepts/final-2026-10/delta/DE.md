# Delta D und E: Einstellungen, Unterseiten, Profil

Stand 06.10.2026, nur gelesen. Code `main` `035d3fc` (Build `2026-10-06-A`), keine Änderung an Code oder Datenbank.

Quellen Soll: `PAKET-README.md` (Design-Tokens, Bausteine, D, E, „Wo Funktionen jetzt liegen“), `referenz/Final D Einstellungen und Anmeldung.dc.html`, `referenz/Final E Unterseiten.dc.html`, Maße aus `soll/*.json` (CSS-px bei 390, Ursprung x = 1 wegen Rahmen; Seitenrand also x 17 = 16 px).
Quellen Ist: `app.js`, `styles.css`, `index.html`, Aufnahmen `.design-sync/landkarte/bilder/admin/`, Paketdoku `.design-sync/reference/app/einstellungen-v2/PHASE0.md`.

**Ausgenommen** (nicht bauen, nur vermerkt):
- 22 Anmeldung und Onboarding.
- 21: „Position statt Rückennummer“. Die Zeile bleibt „Rückennummer“ (siehe 21).
- Mehr-Blatt (05) und Rollen-Screen (26, in der Vorlage per `show: !cap.startsWith('26')` ausgeblendet). Die Zeile „Rollen“ in 18 führt auf die bestehende Ansicht `renderAdmin()`.

**Stand des Vorgängerpakets:** E1 bis E6 sind gebaut (Hauptseite, Mitteilungen, Ruhezeiten, Kalender-Abo nach `einst1–3.png`). E7 (BFV), E8/E9 (Push-Texte als Unterseite, Bearbeiten als 3. Ebene) und E10 (Diagnose als Unterseite) sind **nicht** gebaut: Push-Texte ist noch die eigene Ansicht `pushkatalog` („Push-Nachrichten“, `app.js:1385`), Diagnose noch das Overlay `window.__showDiag` aus `index.html:99`. Die Delta-Liste geht vom Code aus, nicht vom Plan.

---

## 0. Gemeinsame Bausteine (gelten für alle Screens unten)

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

## 18 Einstellungen

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

## 19 Mitteilungen

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

## 20 Kalender abonnieren

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

## 21 Profil

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

## 23 Ruhezeiten

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

## 24 Spielplan BFV

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

## 25 Push-Texte

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

## 27 Diagnose

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

## 28 Blatt · Anleitung Google

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

## 2. Funktionen, die heute existieren und in der Vorlage fehlen

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

## 3. Änderungen mit Schema oder Backend

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

## 4. Frühere Entscheidungen, die die Vorlage kippt

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

## 5. Verbindliche Vorgaben, die von der Vorlage abweichen

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
