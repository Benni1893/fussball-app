# DELTA — Konzepte „App in 2a" und „App in 1b" gegen den Ist-Zustand

Stand: 09.09.2026 · Reine technische Analyse, keine Codeänderung.

**Grundlage der Analyse**

| Quelle | Was daraus gelesen wurde |
|---|---|
| `index.html` | App-Rahmen: fixe Kopfzeile (Logo, Titel mittig, Zahnrad), Scroll-Bereich, Bottom-Nav mit 5 Punkten, Mehr-Sheet, Simulations-Leiste |
| `app.js` | Alle 9 Ansichten (`dashboard`, `kalender`, `katalog`, `strafen`, `einstellungen`, `profil`, `lineup`, `kasse`, `admin`) plus Auth-Screens; Rollenlogik `Roles.*`; Aufstellung v2 (`LINEUP_V2 = true`) |
| `styles.css` | Klassensprache, Tokens, Maße |
| `supabase/migrations/0001–0030` | Tabellen `clubs`, `players`, `events`, `fine_catalog`, `fines`, `rsvps`, `profiles`, `user_roles`, `lineups`, `sportstaetten`, `player_status`, `fine_status_log` |
| `.design-sync/NOTES.md`, `.design-sync/conventions.md` | Fixpunkte des Design-Systems |
| `.claude/skills/{feature-workflow,mobile-ui,supabase-patterns}/SKILL.md` | Projektregeln — es gibt **keine** `CLAUDE.md` in diesem Repo, die drei Skills sind der Ersatz |

**Zwei Vorbemerkungen**

1. Die beiden Konzeptdateien liegen seit 11.09.2026 im Repo (`App in 2a.dc.html`, `App in 1b.dc.html`), gespiegelt aus dem Claude-Design-Projekt `b94b7632-ba5c-4dee-8dc0-868818136159`. Geprüft am 11.09.2026: beide enthalten je 14 Ansichten und keine Spuren aus dem Claude-Design-Editor — sie entsprechen also genau dem Stand, gegen den diese Analyse geschrieben wurde. *(Stand 09.09.2026, als die Analyse entstand, lagen sie nur in Claude Design.)*
2. Beispieldaten (Namen, Beträge, Zähler) sind ignoriert. Bewertet sind **Struktur und Verhalten**.

**Legende Status** — `existiert` · `nur Styling` · `neue Frontend-Logik` · `neue Abfrage` · `neues Schema` · `neue Funktion` · `entfällt`

**Legende Aufwand** — `S` = Markup/CSS im Rahmen der vorhandenen Klassen · `M` = neue Frontend-Logik in `app.js`/`db.js`, kein Schema · `L` = Migration, Backend oder neuer Nachrichtenkanal nötig

---

# Teil A — Konzept 2a

2a ist die Weiterentwicklung des heutigen Interfaces: gleiche Kopfzeile, gleicher heller Grund, gleiche Bottom-Nav. Neu sind der Termin-Hero, der Aufgabenblock und die durchgehende Kantenfarbe links an Karten.

## A1 · Übersicht, Trainer/Kassenwart

| Element | Status | Klick- oder Ablaufänderung | Rollen / RLS | Aufwand | Bemerkung |
|---|---|---|---|---|---|
| Kopfzeile Logo + Vereinsname mittig + Zahnrad | existiert | keine | alle | – | `.hdr-title` ist heute schon zentriert, 1:1 übernehmbar |
| Begrüßung „Servus, <Vorname>" | existiert | keine | alle | S | heute `.page-head h1` |
| Rollen-Pille „TRAINER" neben dem Namen | neue Frontend-Logik | keine | zeigt die eigene Rolle, kein RLS-Bezug | S | `Roles.list` + `ROLE_LABEL` liegen bereits im Speicher, heute nur in Einstellungen/Profil sichtbar |
| Termin-Hero „Heute Abend" mit Titel, Zeit, Zusagezähler | neue Frontend-Logik | **Zusage/Absage passiert jetzt auf der Übersicht.** Heute führt die KPI „Nächster Termin" (`data-nav="termin"`) erst in den Kalender, dort wird geantwortet | Zähler nur `coach`/`admin` (heute `showCount`) | M | Ersetzt den Sprung `data-nav="termin"`; die RSVP-Logik selbst (`data-rsvp`, `data-event`) ist unverändert wiederverwendbar |
| Buttons „Zusage" / „Absage" im Hero | existiert | Ort ändert sich (Übersicht statt Kalenderkarte) | alle | S | `.btn-zu` / `.btn-ab` inkl. `.is-on` bleiben |
| Link „Kader ansehen" | neue Frontend-Logik | neuer Tap ohne Ziel — **eine Kaderansicht gibt es heute nicht** | vermutlich `coach`/`admin` | M | Nächstliegend: das heutige „Kader-Status"-Raster als eigene Ansicht. Ziel offen → offene Frage 1 |
| Link „Aufstellung" | existiert | keine | `coach`/`admin`, `lineups`-RLS greift | S | entspricht dem heutigen `data-lineup-edit` auf der Terminkarte |
| Aufgabenblock „Was heute liegt", Zeile *Zahlungen bestätigen* | neue Frontend-Logik | neuer Tap → Kasse, Reiter „Zu prüfen" | nur `treasurer`/`admin` | M | Zahl = `fines` mit `status='gemeldet'`; alle Strafen liegen nach `DB.loadAll()` bereits im Speicher, keine neue Abfrage nötig |
| Aufgabenblock, Zeile *Aufstellung So …* | neue Frontend-Logik | neuer Tap → Aufstellung des Spiels | nur `coach`/`admin` | M | Zahl = gefüllte Slots der aktiven `lineups`-Zeile. **`lineups` ist per RLS für Spieler nicht lesbar** — Zeile darf für Spieler gar nicht erst gebaut werden |
| Aufgabenblock, Zeile *N ohne Rückmeldung* | neue Frontend-Logik | neuer Tap → Liste der Offenen | nur `coach`/`admin` | M | ableitbar aus `rsvps` gegen `players` |
| Aktion „Erinnerung senden" in dieser Zeile | **neue Funktion** | neuer Tap, den es heute nirgends gibt | `coach`/`admin` | L | Es gibt keinen Nachrichtenkanal außer dem Teilen-Dialog (`navigator.share` / WhatsApp-Schema). Siehe Abschnitt 2 |
| Zeile „Meine Strafen · Betrag" | existiert | Tap-Ziel unverändert (Konto) | alle | S | heute KPI „Meine offenen Strafen" |
| Zeile „Mannschaftskasse · Betrag" | existiert | Tap-Ziel unverändert (Kasse) | Tap heute für alle, Ansicht nur `treasurer`/`admin` | S | **Beschriftungskonflikt:** heute heißt die Zahl „Mannschaftskasse offen" = Summe offener Strafen. Das Konzept liest sich wie ein Kassenstand |
| Abschnitt „Danach" + nächste Terminkarte mit Datumsplakette | existiert | keine | alle | S | heute `.event` mit `.event-date` |
| Bottom-Nav, 5 Punkte, aktiver Balken oben | existiert | keine | „Mehr" nur für Trainer/Kassenwart/Admin | – | unverändert |
| 4-Kachel-KPI-Raster | **entfällt** | vier Sprungziele fallen weg | alle | – | siehe Abschnitt 1 |
| „Lazarett" | **entfällt** | – | `coach`/`admin` | – | siehe Abschnitt 1 |
| „Kader-Status" mit Status-Auswahl je Spieler | **entfällt** | Trainer kann den Spielerstatus nirgends mehr setzen | `coach`/`admin` | – | **Funktionsverlust**, siehe Abschnitt 1 |
| „Zuletzt verhängte Strafen" | **entfällt** | – | alle | – | siehe Abschnitt 1 |

## A2 · Übersicht, Spieler

| Element | Status | Klick- oder Ablaufänderung | Rollen / RLS | Aufwand | Bemerkung |
|---|---|---|---|---|---|
| Termin-Hero ohne Zusagezähler | neue Frontend-Logik | wie A1, aber ohne Zahlen | `player` | M | entspricht dem heutigen `showCount`-Zweig |
| Ort mit Stecknadel im Hero | existiert | keine | alle | S | `.venue-link` + `VENUE_PIN`, öffnet Google Maps |
| Meldeschluss-Countdown | existiert | keine | alle | S | `meldeschlussMs()` rechnet fix Start − 24 h (Spiel) bzw. − 3 h (Training) |
| Block „Mein Konto" mit Betrag, PayPal, „Zahlung melden" | existiert | **wandert von der Konto-Ansicht auf die Übersicht** | nur bei verknüpftem Konto (`profiles.player_id`) | M | heute `.mine-banner` in `renderStrafen`. Doppelpflege vermeiden: als eine Funktion bauen, zweimal einsetzen |
| „nächste Erhöhung in …" | existiert | keine | eigener Spieler | S | `mahnCountdown()` |
| Abschnitt „Danach" mit zwei Terminkarten | existiert | keine | alle | S | – |
| Bottom-Nav mit 4 Punkten (ohne „Mehr") | existiert | keine | `player` | – | entspricht `navMore` display:none |

## A3 · Kalender

| Element | Status | Klick- oder Ablaufänderung | Rollen / RLS | Aufwand | Bemerkung |
|---|---|---|---|---|---|
| Filterreihe Alle / Spiele / Training / Sonstiges | existiert | keine | alle | – | `.toolbar` + `.chip.is-active` |
| Button „Termin hinzufügen" | existiert | keine | `canManageSchedule` (`coach`/`admin`) | – | – |
| Button „In meinen Kalender" mit Unterzeile | existiert | keine | alle | S | öffnet das Abo-Sheet (`calendar_token` aus `profiles`) |
| Terminkarte mit Datumsplakette, Titel, Zeit, Ort | existiert | keine | alle | S | – |
| Zusage/Absage direkt an der Karte | existiert | keine | alle | – | – |
| Zeile „Meldeschluss in … · N/16 zugesagt" | existiert | keine | Zähler nur `coach`/`admin` | S | – |
| Zusatz „Aufstellung 10/11" in derselben Zeile | neue Frontend-Logik | keine | **nur `coach`/`admin`** | M | `lineups` ist per RLS für Spieler gesperrt; im Konzept steht die Angabe in einer Zeile, die auch Spieler sehen → muss rollenabhängig getrennt werden |
| Bearbeiten-Stift an der Terminkarte | **entfällt** | Termine lassen sich nicht mehr bearbeiten | `canManageSchedule` | – | **Funktionsverlust**, siehe Abschnitt 1 |
| „Kader-Info erstellen" an Spielkarten | **entfällt** | Teilen-Dialog nicht mehr erreichbar | `coach`/`admin` | – | **Funktionsverlust**, siehe Abschnitt 1 |
| BFV-Abweichungshinweis (andere Zeit/Adresse, Wert übernehmen, zurücksetzen) | **entfällt** | Drift zum Spielplan bleibt unbemerkt | `canManageSchedule` | – | **Funktionsverlust**, siehe Abschnitt 1 |
| Tags „manuell geändert" / „Abgesagt" / „Freundschaft" | teilweise | – | alle | S | Konzept zeigt nur „Training"; die anderen Tags fehlen im Entwurf, sind im System aber vorhanden |
| Abschnitt „Vergangene Termine", abgedimmt | existiert | keine | alle | – | – |

## A4 · Aufstellung, Spielauswahl

| Element | Status | Klick- oder Ablaufänderung | Rollen / RLS | Aufwand | Bemerkung |
|---|---|---|---|---|---|
| Liste kommender Spiele mit Datumsplakette | existiert | keine | `coach`/`admin` | S | heute `.tv-gcard` |
| Zustandsmarke „aktiv" / „offen" | existiert | keine | `coach`/`admin` | S | aus `lineups.is_active` |
| Abschnitt „Vorlagen" mit benannten Aufstellungen | neue Frontend-Logik | neuer Tap → Vorlage anwenden | `coach`/`admin`, RLS vorhanden | M | **Schema existiert** (`lineups.is_template`, `event_id NULL`), die Legacy-Ansicht konnte das. **Aufstellung v2 zeigt Vorlagen bewusst nicht mehr** — Wiedereinführung ist eine Produktentscheidung → offene Frage 2 |
| Einleitungssatz „Spiel wählen" | existiert | keine | `coach`/`admin` | – | – |

## A5 · Aufstellung, Platz und Bank

| Element | Status | Klick- oder Ablaufänderung | Rollen / RLS | Aufwand | Bemerkung |
|---|---|---|---|---|---|
| Eigene Zurück-Leiste statt App-Kopfzeile | nur Styling | Logo und Zahnrad verschwinden auf diesem Screen | `coach`/`admin` | S | **Verstoß gegen den Fixpunkt Kopfzeile**, siehe Abschnitt 4 |
| Kopfzeile mit Gegner, Datum, Formation, N/11 | existiert | keine | `coach`/`admin` | – | heute `.tv-top` / `.tv-hi` zusätzlich **unter** der App-Kopfzeile |
| Formationsleiste mit Favoriten + „Weitere" | existiert | keine | `coach`/`admin` | – | `tvFormbarHtml()`, Favoriten in `tvFav` |
| Spielfeld mit besetzten Positionen | existiert | keine | `coach`/`admin` | S | `tvPitchHtml()` |
| Tippen auf eine Position → Kader-Vollbild | existiert, **im Entwurf nicht dargestellt** | – | `coach`/`admin` | – | Das ist „Variante B"; der Entwurf zeigt nur das Ergebnis, nicht den Auswahlweg → Abschnitt 4 |
| Bank mit 7 Plätzen, leere gestrichelt | existiert | keine | `coach`/`admin` | S | – |
| Button „Aufstellung speichern" mit N/11 | existiert | keine | `coach`/`admin` | – | – |
| „⋯"-Menü | existiert | keine | `coach`/`admin` | – | Inhalt heute: übernehmen / Favoriten bearbeiten / leeren. Entwurf zeigt den Inhalt nicht |
| Bottom-Nav | **entfällt auf diesem Screen** | Wechsel in andere Tabs nur noch über Zurück | `coach`/`admin` | – | **Verstoß gegen den Fixpunkt Bottom-Nav**, siehe Abschnitt 4 |
| Hinweis „Vom letzten Spiel übernehmen" bei leerer Elf | **entfällt** | Einstiegshilfe fällt weg | `coach`/`admin` | – | `tvEmptyCta()`, siehe Abschnitt 1 |
| „Nur ansehen"-Zustand bei vergangenen Spielen | **entfällt** | – | `coach`/`admin` | – | `tv.readonly`, siehe Abschnitt 1 |

## A6 · Strafen-Konto

| Element | Status | Klick- oder Ablaufänderung | Rollen / RLS | Aufwand | Bemerkung |
|---|---|---|---|---|---|
| Eigener Kontoblock mit Betrag offen/gesamt | existiert | keine | nur bei verknüpftem Spieler | S | heute `.mine-banner` mit Verlauf; Konzept macht daraus eine weiße Karte mit roter Kante |
| Zustandssatz „Du hast noch offene Strafen" | existiert | keine | eigener Spieler | – | – |
| Mahn-Countdown | existiert | keine | eigener Spieler | – | – |
| PayPal-Button | existiert | keine | eigener Spieler | S | `paypalMeLink()` |
| „Zahlung melden" | existiert | keine | eigener Spieler, setzt `fines.status` auf `gemeldet` | – | – |
| Hinweissatz „Freunde & Familie" | existiert | keine | eigener Spieler | – | – |
| Zwei Kennzahlen (Summe offen, Kontostand) | existiert | keine | alle | S | – |
| Filterreihe mit 4 Einträgen | existiert, **gekürzt** | Filter „Alle" fehlt im Entwurf | alle | S | heute 5 Filter: Offen, Gemeldet, Eingegangen, Meine Strafen, Alle |
| Strafenliste mit Initialen, Vergehen, Datum, Betrag, Zustandsmarke | existiert | keine | alle | S | – |
| Marke „automatisch" an auto-erzeugten Strafen | existiert | keine | alle | S | `fines.auto` |
| Ablehnungsgrund unter der Zeile | existiert, **im Entwurf nicht gezeigt** | – | betroffener Spieler | – | `fines.reject_reason` |

## A7 · Strafenkatalog

| Element | Status | Klick- oder Ablaufänderung | Rollen / RLS | Aufwand | Bemerkung |
|---|---|---|---|---|---|
| Titel + Begleitsatz | existiert | keine | alle | S | – |
| Katalogzeile mit Bezeichnung und Betrag | existiert | keine | Lesen alle | S | – |
| **Kategorie als Unterzeile** | neue Frontend-Logik | keine | alle | M | Spalte `fine_catalog.category` **existiert**, wird aber beim Anlegen fest auf `null` gesetzt (`db.js`) und nirgends angezeigt. Also kein Schema, aber Eingabefeld plus Nachpflege der Bestandsdaten |
| Marke „gestaffelt" + Preis je Einheit | existiert | keine | alle | – | `fine_type`, `unit_amount`, `unit_step`, `unit_label`, `max_amount` |
| Button „Strafe hinzufügen" | existiert | keine | `canEditCatalog` (`treasurer`/`admin`) | S | – |
| Bearbeiten- und Löschen-Symbol je Zeile | **entfällt** | Katalog nur noch lesbar | `treasurer`/`admin` | – | **Funktionsverlust**, siehe Abschnitt 1 |
| Zeilen-Bearbeitungsformular (fest/gestaffelt) | **entfällt** | – | `treasurer`/`admin` | – | siehe Abschnitt 1 |

## A8 · Kasse

| Element | Status | Klick- oder Ablaufänderung | Rollen / RLS | Aufwand | Bemerkung |
|---|---|---|---|---|---|
| Drei Kennzahlen Offen / Gemeldet / Eingegangen | existiert | keine | `treasurer`/`admin` | – | `.kpi-grid.kpi-3` |
| Spielerauswahl als Zeile mit Chevron | existiert | keine | `treasurer`/`admin` | S | öffnet Auswahl-Sheet |
| Katalogliste mit Häkchen und Mengensteuerung | existiert | keine | `treasurer`/`admin` | S | – |
| Eingabefeld für gestaffelte Bezugsgröße | existiert, **im Entwurf nicht gezeigt** | – | `treasurer`/`admin` | – | erscheint heute nur bei ausgewählter Staffel-Position |
| Individuelle Strafe (Betrag, Grund, Hinzufügen) | existiert | keine | `treasurer`/`admin` | S | – |
| Bereits hinzugefügte freie Strafen als Chips | existiert, **im Entwurf nicht gezeigt** | – | `treasurer`/`admin` | – | `.ks-ichip` |
| Datum und Kommentar | existiert | keine | `treasurer`/`admin` | S | Datumsfeld ist heute ein echtes `type="date"`, im Entwurf nur Text |
| Zusammenfassung „N Spieler × M Strafen = Betrag" | existiert | keine | `treasurer`/`admin` | S | `kasseSummaryHtml()` |
| Button „Strafen speichern" | existiert | keine | `treasurer`/`admin`, RLS auf `fines` | – | – |
| Reiter Zu prüfen / Offen / Eingegangen mit Zählern | existiert | keine | `treasurer`/`admin` | – | – |
| Zeile mit „Eingang bestätigen" / „Ablehnen" | existiert | keine | `treasurer`/`admin`, schreibt `fines.status` + `fine_status_log` | S | Ablehnen fragt heute nach einem Grund |

## A9 · Einstellungen

| Element | Status | Klick- oder Ablaufänderung | Rollen / RLS | Aufwand | Bemerkung |
|---|---|---|---|---|---|
| Karte „Mein Profil" mit Name, Rollen, E-Mail | existiert | keine | alle | S | – |
| Abmelden | existiert | keine | alle | S | im Entwurf ein voller Button statt Textlink |
| BFV-Bereich mit Mannschaftsname, Zeitstempel, „Jetzt aktualisieren" | existiert | keine | **nur `admin`** | S | `set_ical_url` prüft die Rolle zusätzlich im Funktionskörper |
| „Ändern" für die BFV-Adresse | existiert | keine | `admin` | – | schaltet auf das Eingabefeld um |
| Karte „Strafenkatalog öffnen" | existiert | keine | `canManageSchedule` | S | – |
| Build-Zeile mit Diagnose-Link | existiert | keine | alle | – | – |
| Sportstätten-Koordinaten | existiert, **abgeschaltet** | – | `admin` | – | `sportstaettenCardHtml()` ist im Code, aber per Konstante deaktiviert. Beide Konzepte zeigen es nicht — konsistent mit dem Ist-Zustand |

## A10 · Profil

| Element | Status | Klick- oder Ablaufänderung | Rollen / RLS | Aufwand | Bemerkung |
|---|---|---|---|---|---|
| Kopfkarte mit Initialen, Name, Rolle, Rückennummer | teilweise | keine | alle | S | Name und Rolle existieren; Initialen-Kreis und Nummer sind neu, `players.number` ist vorhanden |
| „Mein Fitnessstatus" mit drei Auswahlmarken | existiert | keine | eigener Spieler, RLS aus 0025/0026 erlaubt Selbstsetzen | – | – |
| Abschnitt „Meine Rückmeldungen" | neue Frontend-Logik | neue Liste | eigener Spieler | M | ableitbar aus `rsvps`, keine neue Abfrage |
| Hinweis „Konto noch keinem Spieler zugeordnet" | existiert, **im Entwurf nicht gezeigt** | – | nicht verknüpfte Konten | – | Leerzustand fehlt im Entwurf |

## A11 · Rollen verwalten

| Element | Status | Klick- oder Ablaufänderung | Rollen / RLS | Aufwand | Bemerkung |
|---|---|---|---|---|---|
| Karte „Ansicht testen als" mit vier Marken | existiert | keine | nur `admin` | S | reine Anzeigesimulation |
| Tabelle Mitglied × Trainer/Kassenwart/Admin | existiert | keine | nur `admin`, `user_roles` schreibbar nur für `admin` | S | Spaltenköpfe im Entwurf auf „Tr/Ka/Ad" gekürzt |
| Kästchen statt echter Checkbox | nur Styling | keine | `admin` | S | Tap-Fläche muss bei 44px bleiben |
| Zeile mit Initialen, Name, E-Mail | existiert | keine | `admin` | S | – |
| Zählsatz unter der Tabelle | existiert | keine | `admin` | – | – |
| Ladezustand „Lade Mitglieder …" | existiert, **im Entwurf nicht gezeigt** | – | `admin` | – | `listMembers()` ist asynchron |

## A12 · Mehr-Menü

| Element | Status | Klick- oder Ablaufänderung | Rollen / RLS | Aufwand | Bemerkung |
|---|---|---|---|---|---|
| Abdunklung + Blatt von unten | existiert | keine | `coach`/`treasurer`/`admin` | – | `.more-sheet` mit `hidden` |
| Einträge Aufstellung, Kasse, Rollen, Einstellungen, Profil | existiert | keine | je Eintrag rollenabhängig eingeblendet | – | Entwurf zeigt alle fünf gleichzeitig — das sieht real nur ein Admin mit allen Rollen |
| Simulations-Leiste bei aktiver Vorschau | existiert, **im Entwurf nicht gezeigt** | – | `admin` | – | `.sim-bar` erhöht zusätzlich das untere Padding |

## A13 · Anmeldung und Spielerzuordnung

| Element | Status | Klick- oder Ablaufänderung | Rollen / RLS | Aufwand | Bemerkung |
|---|---|---|---|---|---|
| Grüne Fläche, weiße Karte, Wappen, Titel, Untertitel | existiert | keine | abgemeldet | S | `body.auth-mode` blendet Nav und Fußzeile aus |
| E-Mail- und Passwortfeld | existiert | keine | – | S | Felder müssen bei 16px bleiben |
| „Anmelden", „Passwort vergessen?", „Jetzt registrieren" | existiert | keine | – | – | – |
| Fehler- und Hinweisfeld | existiert, **im Entwurf nicht gezeigt** | – | – | – | `.auth-error` / `.auth-info` |
| Spielerzuordnung als Liste mit Initialen und Nummer | existiert | keine | frisch registrierte Konten | S | heute `.pick-grid` / `.pick-player` |
| Screen „Neues Passwort" nach Reset-Link | existiert, **fehlt im Entwurf** | – | – | – | `renderResetPassword()` |

---

# Teil B — Konzept 1b

1b setzt pro Ansicht einen dunkelgrünen Kopfblock, der Lage **und** Hauptaktion trägt, darunter eine Dreier-Kennzahlenreihe. Gold ist die Aktionsfarbe. Zeilen, die sich nur in der Rahmung von 2a unterscheiden, sind hier gekürzt — bewertet wird das Delta.

## B1 · Übersicht, Trainer/Kassenwart

| Element | Status | Klick- oder Ablaufänderung | Rollen / RLS | Aufwand | Bemerkung |
|---|---|---|---|---|---|
| Dunkler Kopfblock statt Kopfzeile + Hero | nur Styling | Zahnrad fehlt auf diesem Screen, an seiner Stelle steht die Rollen-Pille | alle | M | **Verstoß gegen den Fixpunkt Kopfzeile**, siehe Abschnitt 4. Zusätzlich: die App-Kopfzeile ist `position: fixed`, ein mitscrollender Kopfblock ist ein anderes Layoutmodell |
| Eyebrow „Nächster Termin · in 4 Std." | neue Frontend-Logik | keine | alle | S | relative Zeit statt festem Datum, `eventStartMs()` liefert die Basis |
| Terminname + Zeit im Kopfblock | neue Frontend-Logik | keine | alle | M | wie A1-Hero, nur auf dunklem Grund |
| Goldene Zahl „0/16 zugesagt" | existiert | keine | nur `coach`/`admin` | S | – |
| Button „Kader anschreiben" (gold) | existiert | **Umbenennung** von „Kader-Info erstellen" und Umzug von der Terminkarte in den Kopfblock | `coach`/`admin` | M | Teilen-Dialog bleibt unverändert. Achtung: der Text wird heute aus **der aktiven Aufstellung** gebaut — ohne Aufstellung ist die Nachricht dünn |
| Button „Aufstellung" (Geisterbutton) | existiert | keine | `coach`/`admin` | S | – |
| Kennzahlenreihe Zu prüfen / Offen / Verletzt | neue Frontend-Logik | drei neue Tap-Ziele | *Zu prüfen* nur `treasurer`/`admin`, *Verletzt* nur `coach`/`admin` | M | „Verletzt" ist die verdichtete Fassung des heutigen Lazaretts. **Die Reihe hat drei feste Plätze, aber rollenabhängig unterschiedlich viele Inhalte** — für einen reinen Spieler bleiben Lücken → offene Frage 3 |
| Aufgabenblock „Was heute liegt" | neue Frontend-Logik | wie A1 | wie A1 | M | identisch zu 2a |
| Abschnitt „Danach" | existiert | keine | alle | S | – |
| Goldener Balken über dem aktiven Nav-Punkt | nur Styling | keine | alle | S | heute grün |
| 4-Kachel-Raster, Lazarett-Liste, Kader-Status, „Zuletzt verhängte Strafen" | **entfällt** | wie A1 | – | – | siehe Abschnitt 1 |

## B2 · Übersicht, Spieler

| Element | Status | Klick- oder Ablaufänderung | Rollen / RLS | Aufwand | Bemerkung |
|---|---|---|---|---|---|
| Kopfblock mit Zusage (gold) und Absage (Geisterbutton) | neue Frontend-Logik | Zusage passiert im Kopfblock | `player` | M | – |
| Goldene Zahl „6:12 bis Meldeschluss" | existiert | keine | alle | S | – |
| Trennlinie + Ortszeile im Kopfblock | nur Styling | keine | alle | S | – |
| Kennzahlen Meine Strafen / Meine Quote / Status | teils neu | drei neue Tap-Ziele | eigener Spieler | M/L | *Meine Strafen* und *Status* existieren. **„Meine Quote" ist neu** — aus `rsvps` ableitbar, aber ohne Definition (Zusagen ÷ Termine? nur Trainings? ab Saisonstart?) nicht baubar → offene Frage 4 |
| Liste der eigenen offenen Strafen | neue Frontend-Logik | eigene Strafen stehen jetzt auf der Übersicht | eigener Spieler | M | Teilmenge der Konto-Ansicht |
| PayPal + „Melden" als Buttonpaar | existiert | Ort ändert sich | eigener Spieler | S | – |

## B3 · Kalender

| Element | Status | Klick- oder Ablaufänderung | Rollen / RLS | Aufwand | Bemerkung |
|---|---|---|---|---|---|
| Kopfblock „7 Spiele / 11 Trainings / 18 Termine" | neue Frontend-Logik | keine | alle | M | rein rechnerisch aus den geladenen Terminen, entspricht der heutigen KPI „Kommende Spiele · in der Restsaison" |
| **Filterreihe im dunklen Kopfblock** | neue Frontend-Logik | Filter wandern nach oben in den Kopf | alle | M | `.chip`-Zustandslogik bleibt, braucht aber eine zweite Farbfassung für dunklen Grund |
| „Termin hinzufügen" (gold) + „In meinen Kalender" (Geist) im Kopfblock | existiert | beide Aktionen wandern aus dem Inhalt in den Kopf | Hinzufügen nur `canManageSchedule` | M | **Bei einem Spieler bleibt nur ein Button übrig** — der Kopfblock muss mit einem Button umgehen können |
| Terminkarten ohne farbige Außenkante | nur Styling | keine | alle | S | Farbe sitzt als Balken innen |
| Rest wie A3 | – | – | – | – | inklusive derselben Verluste: Stift, Kader-Info, BFV-Drift |

## B4 · Aufstellung, Spielauswahl

| Element | Status | Klick- oder Ablaufänderung | Rollen / RLS | Aufwand | Bemerkung |
|---|---|---|---|---|---|
| Kopfblock zeigt das **nächste** Spiel mit „10/11 gesetzt" | neue Frontend-Logik | direkter Einstieg statt Auswahl, die Liste wird zur Zweitwahl | `coach`/`admin` | M | gute Verkürzung des heutigen Zwei-Schritt-Wegs |
| „Aufstellung fortsetzen" (gold) | existiert | ein Tap weniger als heute | `coach`/`admin` | S | – |
| „Vorlagen" (Geisterbutton) + Vorlagenliste | neue Frontend-Logik | neuer Tap | `coach`/`admin` | M | wie A4: Schema vorhanden, v2 zeigt es bewusst nicht → offene Frage 2 |
| Liste weiterer Spiele | existiert | keine | `coach`/`admin` | S | – |

## B5 · Aufstellung, Platz und Bank

| Element | Status | Klick- oder Ablaufänderung | Rollen / RLS | Aufwand | Bemerkung |
|---|---|---|---|---|---|
| Kopfblock mit Zurück, Gegner, „⋯", Meta, N/11 | nur Styling | Logo und Zahnrad verschwinden | `coach`/`admin` | S | **Verstoß Kopfzeile**, Abschnitt 4 |
| **Formationsleiste im dunklen Kopfblock** | nur Styling | Formationswechsel liegt weiter oben, oberhalb des Platzes | `coach`/`admin` | M | Bedenken: der Kopfblock scrollt mit. Heute steht die Leiste direkt über dem Platz und bleibt im Blick |
| Platz, Bank, goldener Speicher-Button | existiert | keine | `coach`/`admin` | S | – |
| Bottom-Nav | **entfällt** | – | – | – | **Verstoß Bottom-Nav**, Abschnitt 4 |

## B6 · Strafen-Konto

| Element | Status | Klick- oder Ablaufänderung | Rollen / RLS | Aufwand | Bemerkung |
|---|---|---|---|---|---|
| Eigener Kontostand groß in Gold im Kopfblock | nur Styling | keine | eigener Spieler | M | ersetzt `.mine-banner`. **Gold für einen Schuldbetrag** widerspricht der heutigen Farbsprache (offen = rot) → offene Frage 5 |
| Countdown rechts im Kopfblock | existiert | keine | eigener Spieler | S | – |
| PayPal (gold) + „Melden" (Geist) | existiert | keine | eigener Spieler | S | – |
| Kennzahlen Summe offen / Gemeldet / Kontostand | teils neu | keine | alle | S | „Gemeldet" als eigene Kennzahl ist neu, aber ableitbar |
| Filterreihe mit 4 Einträgen, Liste | existiert | „Alle" fehlt | alle | S | wie A6 |

## B7 · Strafenkatalog

| Element | Status | Klick- oder Ablaufänderung | Rollen / RLS | Aufwand | Bemerkung |
|---|---|---|---|---|---|
| Kopfblock „14 Positionen · 3,00–25,00 € · 2 gestaffelt" | neue Frontend-Logik | keine | alle | M | rein rechnerisch |
| „Strafe hinzufügen" (gold) im Kopfblock | existiert | Button wandert von unten nach oben | `canEditCatalog` | S | **Für Spieler bleibt der Kopfblock ohne Aktion** |
| **„Sortieren" (Geisterbutton)** | **neues Schema** | neuer Tap | `treasurer`/`admin` | L | `fine_catalog` hat keine Sortierspalte, heute ist die Reihenfolge die Ladereihenfolge. Siehe Abschnitt 2 |
| Kategorie als Unterzeile | neue Frontend-Logik | keine | alle | M | wie A7 |
| Bearbeiten/Löschen je Zeile | **entfällt** | wie A7 | – | – | siehe Abschnitt 1 |

## B8 · Kasse

| Element | Status | Klick- oder Ablaufänderung | Rollen / RLS | Aufwand | Bemerkung |
|---|---|---|---|---|---|
| Kopfblock „Mannschaftskasse" mit Gesamtvolumen in Gold | neue Frontend-Logik | keine | `treasurer`/`admin` | S | Zahl existiert bereits als KPI |
| „Strafen verhängen" (gold) + „Prüfen (5)" (Geist) | neue Frontend-Logik | zwei Sprungmarken innerhalb derselben Seite | `treasurer`/`admin` | M | heute steht beides untereinander auf einer langen Seite; Sprungmarken oder zwei Unterseiten wären neu |
| Kennzahlenreihe | existiert | keine | `treasurer`/`admin` | S | – |
| Zusammenfassung vor dem Speichern **auf dunkelgrünem Grund** | nur Styling | keine | `treasurer`/`admin` | S | gute Betonung des verbindlichen Schritts |
| Rest wie A8 | – | – | – | – | – |

## B9 · Einstellungen

| Element | Status | Klick- oder Ablaufänderung | Rollen / RLS | Aufwand | Bemerkung |
|---|---|---|---|---|---|
| Kopfblock trägt die Identität (Name, Rollen, Initialen) | nur Styling | keine | alle | S | schlüssige Übertragung des Prinzips |
| „Abmelden" als Geisterbutton im Kopfblock | existiert | Abmelden rückt an die prominenteste Stelle der Seite | alle | S | Bedenken: versehentliches Abmelden wird wahrscheinlicher → offene Frage 6 |
| E-Mail und Spielerzuordnung als Listenzeilen | existiert / teils neu | keine | alle | S | Zeile „Spieler · Nr." ist neu, Daten vorhanden |
| BFV-Karte, Katalog-Karte, Build-Zeile | existiert | keine | BFV nur `admin` | S | – |

## B10 · Profil

| Element | Status | Klick- oder Ablaufänderung | Rollen / RLS | Aufwand | Bemerkung |
|---|---|---|---|---|---|
| **Fitnessstatus als Auswahlreihe im dunklen Kopfblock** | nur Styling | keine | eigener Spieler | M | Zustandsfarben müssen auf dunklem Grund neu definiert werden (heute `.st-fit` / `.st-angeschlagen` / `.st-verletzt`) |
| Position „Stürmer" in der Unterzeile | existiert | keine | alle | S | `players.position` |
| Kennzahl „Zusagen 82%" | neue Abfrage | keine | eigener Spieler | M | ableitbar, Definition offen → offene Frage 4 |
| **Kennzahl „Einsätze 9 von 11 Spielen"** | **neues Schema** | keine | eigener Spieler | L | Es gibt **keine Einsatzdaten**. `lineups` hält die *geplante* Aufstellung, nicht die gespielte, und ist für Spieler per RLS gesperrt. Siehe Abschnitt 2 |
| Kennzahl „Offen 10,00 €" | existiert | keine | eigener Spieler | S | – |
| Liste „Meine Rückmeldungen" | neue Frontend-Logik | keine | eigener Spieler | M | wie A10 |

## B11 · Rollen verwalten

| Element | Status | Klick- oder Ablaufänderung | Rollen / RLS | Aufwand | Bemerkung |
|---|---|---|---|---|---|
| Kopfblock „16 Mitglieder · 2 Trainer · 1 Kassenwart · 1 Admin" | neue Frontend-Logik | keine | `admin` | M | aus `listMembers()` ableitbar |
| **Rollen-Vorschau im dunklen Kopfblock** | nur Styling | keine | `admin` | S | schlüssig — es ist ein Werkzeug, kein Inhalt |
| Tabelle, Kästchen, Hinweissatz | existiert | keine | `admin` | S | wie A11 |

## B12 · Mehr-Menü · B13 · Anmeldung und Spielerzuordnung

| Element | Status | Klick- oder Ablaufänderung | Rollen / RLS | Aufwand | Bemerkung |
|---|---|---|---|---|---|
| Mehr-Blatt über dem Kopfblock | existiert | keine | rollenabhängig | – | wie A12 |
| Anmeldung ganzflächig grün, weiße Karte, goldener Button | existiert | keine | abgemeldet | S | einzige Abweichung: Primärbutton gold statt grün |
| Spielerzuordnung mit Kopfblock „Willkommen!" | existiert | keine | frische Konten | S | wie A13 |
| Fehlerfeld, Hinweisfeld, „Neues Passwort"-Screen | **fehlt im Entwurf** | – | – | – | wie A13 |

---

# 1. Entfällt oder verschiebt sich

Alles Folgende existiert heute in der App und fehlt in einem oder beiden Konzepten.

| Was | Fehlt in | Absicht oder Versehen | Empfehlung |
|---|---|---|---|
| **Vier-Kachel-Übersicht** (Nächster Termin, Kommende Spiele, Meine offenen Strafen, Mannschaftskasse offen), alle antippbar | 2a und 1b | **Absicht** — beide ersetzen sie bewusst durch Hero bzw. Kennzahlenreihe | Ersetzen, aber die vier Sprungziele erhalten: Termin → Hero, Spiele → Kalender-Kopf, Meine Strafen und Kasse → eigene Zeilen. In 2a ist das gelöst, in 1b fehlt „Kommende Spiele" als Sprung |
| **Kader-Status** — Trainer setzt fit/angeschlagen/verletzt je Spieler auf der Übersicht | 2a und 1b | **Versehen** — beide zeigen nur noch die Zahl „Verletzt: 2" bzw. gar nichts | **Blockierend.** Ohne Ersatz kann das Trainerteam den Spielerstatus nicht mehr pflegen. Vorschlag: eigene Kaderansicht, erreichbar über den in 2a schon gezeichneten Link „Kader ansehen" |
| **Lazarett-Liste** (wer ist raus, seit wann, bis wann, Notiz) | 2a und 1b | **Absicht** (verdichtet), aber Informationsverlust | In dieselbe Kaderansicht verschieben; die Kennzahl „Verletzt: 2" aus 1b ist die richtige Zusammenfassung |
| **„Zuletzt verhängte Strafen"** auf der Übersicht | 2a und 1b | **Absicht** | Verzichtbar — der Inhalt steht vollständig im Konto |
| **Kader-Info erstellen** an der Terminkarte (Teilen-Dialog, WhatsApp/Kopieren) | 2a | **Versehen** | Wieder aufnehmen. 1b hat es als „Kader anschreiben" im Kopfblock — der bessere Ort, weil dort auch die Aufstellung sitzt, aus der der Text gebaut wird |
| **Bearbeiten-Stift auf Terminkarten** (Termin ändern, inklusive Serienabfrage) | 2a und 1b | **Versehen** | Blockierend für `canManageSchedule`. Am kleinsten: Stift wie heute rechts in der Kartenzeile belassen |
| **BFV-Abweichungshinweis** (andere Zeit/Adresse, Wert übernehmen, auf BFV zurücksetzen) plus Marke „manuell geändert" | 2a und 1b | **Versehen** | Blockierend. Ohne diesen Block läuft der Spielplan lautlos auseinander |
| **Katalog bearbeiten und löschen** (Zeilen-Formular fest/gestaffelt) | 2a und 1b | **Versehen** — beide zeigen nur „hinzufügen" | Blockierend für `treasurer`/`admin` |
| **Filter „Alle"** im Strafen-Konto | 2a und 1b | vermutlich Versehen | Wieder aufnehmen, kostet nichts |
| **„Vom letzten Spiel übernehmen"-Einstieg** bei leerer Aufstellung | 2a und 1b | **Versehen** | Wieder aufnehmen, das ist der schnellste Weg zur Elf |
| **„Nur ansehen"-Zustand** der Aufstellung bei vergangenen Spielen | 2a und 1b | **Versehen** | Wieder aufnehmen, sonst wären alte Aufstellungen editierbar |
| **Kader-Vollbild beim Tippen auf eine Position** (Variante B) | im Entwurf beider Konzepte nicht dargestellt | vermutlich nur nicht gezeichnet | Klären, bevor gebaut wird — siehe Abschnitt 4 |
| **Bottom-Nav auf dem Aufstellungs-Screen** | 2a und 1b | unklar | Muss zurück, siehe Abschnitt 4 |
| **Bezugsgrößen-Feld für Staffelstrafen** und **Chips freier Strafen** in der Kasse | 2a und 1b | nur nicht gezeichnet | Kein Handlungsbedarf, beim Bauen nicht vergessen |
| **Fehler- und Hinweisfeld der Anmeldung**, **„Neues Passwort"-Screen** | 2a und 1b | nur nicht gezeichnet | Kein Handlungsbedarf |
| **Simulations-Leiste** bei aktiver Rollen-Vorschau | 2a und 1b | nur nicht gezeichnet | Beim Bauen das zusätzliche untere Padding beachten (`body.simulating`) |
| **Ladezustand** der Rollen-Tabelle | 2a und 1b | nur nicht gezeichnet | Kein Handlungsbedarf |
| **Sportstätten-Koordinaten** | beide | konsistent — ist heute schon abgeschaltet | Kein Handlungsbedarf |

---

# 2. Braucht Schema oder Backend

Geprüft gegen `supabase/migrations/0001–0030`. Reihenfolge: sicher nötig → nur bei bestimmter Auslegung nötig → **nicht** nötig.

### Sicher nötig

| Stelle | Warum | Minimaler Migrationsvorschlag (ein Satz) |
|---|---|---|
| **„Erinnerung senden"** (2a und 1b, Aufgabenblock) | Es gibt keinen Nachrichtenkanal: der Teilen-Dialog ist ein manueller Anstoß durch den Trainer, keine Zustellung an Spieler | Zusätzlich zum Frontend braucht es einen serverseitigen Versandweg und eine Tabelle, die je Termin festhält, wann zuletzt erinnert wurde, damit nicht mehrfach gesendet wird — Schreibrecht nur für `coach`/`admin` |
| **„Einsätze 9 von 11 Spielen"** (1b, Profil) | Es gibt keine Einsatzdaten; `lineups` hält die *geplante* Aufstellung und ist per RLS für Spieler gesperrt | Eine Tabelle für tatsächliche Einsätze je Spiel und Spieler, für alle lesbar und nur von `coach`/`admin` schreibbar, plus ein Weg, sie nach dem Spiel zu füllen |
| **„Sortieren" im Katalog** (1b) | `fine_catalog` hat keine Sortierspalte, die Reihenfolge ist heute die Ladereihenfolge | Eine Ganzzahl-Spalte für die Anzeigereihenfolge an `fine_catalog`, vorbelegt aus der heutigen Reihenfolge, schreibbar nur für `treasurer`/`admin` |

### Nur bei einer bestimmten Auslegung nötig

| Stelle | Warum | Minimaler Migrationsvorschlag (ein Satz) |
|---|---|---|
| **Meldeschluss je Termin** | Beide Konzepte zeigen den Countdown so, wie er heute schon rechnet: fix 24 h vor Spielen, 3 h vor Trainings (`meldeschlussMs()`). **Nur wenn der Vorlauf je Termin einstellbar werden soll**, ist etwas zu tun | Eine Stunden-Spalte an `events`, die leer den heutigen Regelwert bedeutet, schreibbar für `coach`/`admin` |
| **Katalog-Kategorien** | Die Spalte `fine_catalog.category` **existiert**, wird beim Anlegen aber fest auf `null` gesetzt und nirgends angezeigt | Kein Schema — nur Eingabefeld, Anzeige und eine einmalige Nachpflege der Bestandszeilen |
| **Aufstellungsvorlagen** | Schema und RLS sind vollständig da (`lineups.is_template`, `event_id NULL`, `set_lineup_active`), nur die aktive Ansicht v2 zeigt sie nicht mehr | Kein Schema — reine Frontend-Entscheidung |
| **Aufgabenblock-Aggregation** | Alle Zutaten liegen nach `DB.loadAll()` bereits im Speicher: Strafen mit Status, RSVPs, aktive Aufstellung | Kein Schema — erst wenn die Ladezeit spürbar leidet, lohnt eine zusammenfassende Datenbankfunktion |
| **Zusagenquote** | Aus `rsvps` und `events` ableitbar | Kein Schema — es fehlt nur die **Definition**, siehe offene Frage 4 |

### Nicht nötig

| Stelle | Warum |
|---|---|
| **Restsaison-Zähler** („7 Spiele", „11 Trainings", „18 Termine") | Wird heute schon so gerechnet, KPI „Kommende Spiele · in der Restsaison" |
| **„Kader anschreiben"** (1b) | Ist die vorhandene Funktion „Kader-Info erstellen" unter neuem Namen an neuem Ort, Text wird aus Termin plus aktiver Aufstellung gebaut |
| **Kennzahlen der Kasse** (Offen/Gemeldet/Eingegangen) | Existieren bereits als Dreier-KPI |
| **Katalog-Kennzahlen** (Anzahl, Spanne, Anzahl gestaffelt) | Rein rechnerisch aus dem geladenen Katalog |
| **Mitglieder- und Rollenzähler** (1b) | Rein rechnerisch aus `listMembers()` |
| **Fitnessstatus im Kopfblock** (1b) | `player_status` und die Selbstsetz-Policy aus 0025/0026 sind vorhanden |

---

# 3. Umsetzungspakete

Reihenfolge: erst Styling, dann Logik, dann Schema. Jedes Paket ist für sich testbar und als eigener PR mergebar. Vorher gilt weiter die Regel aus `feature-workflow`: betroffene Dateien zeigen, Bestätigung abwarten, ein Feature pro Durchgang.

### Paket 0 — Entscheidung und Fixpunkte klären
**Dateien:** keine, nur diese Datei fortschreiben
**Aufwand:** S
**Inhalt:** Konzept festlegen, die offenen Fragen am Ende beantworten, die Fixpunkt-Verstöße aus Abschnitt 4 auflösen.
**iPhone-Test:** entfällt.

### Paket 1 — Karten- und Zeilensprache angleichen
**Dateien:** `styles.css`
**Aufwand:** S
**Inhalt:** Kantenfarbe links an Karten (grün/gold/rot), 14px-Radius durchziehen, Zeilenhöhen und Abstände der Listen vereinheitlichen, Datumsplakette angleichen. Kein Markup, kein `app.js`.
**iPhone-Test:** Als Spieler → Kalender → hoch und runter scrollen: alle Terminkarten haben dieselbe Kante links, keine Karte ist breiter als der Bildschirm, kein waagerechtes Scrollen.

### Paket 1a — App-weite 44px-Tap-Flächen *(nachgetragen am 11.09.2026)*
**Dateien:** `styles.css`
**Aufwand:** M — klein im Umfang, aber breit in der Wirkung: die Regel fasst jede Schaltfläche der App an
**Inhalt:** Das Basis-`.btn` hat heute **keine** `min-height` und liegt bei rund 35px, `.link-btn` hat gar keine. Damit verfehlen alle Schaltflächen außerhalb der bereits angehobenen Stellen und alle Textlinks in Zeilen die harte 44px-Regel aus `conventions.md`. Das ist eine **vorbestehende Abweichung**, kein Konzeptfehler — beide Konzepte erben sie nur. Punktuelle Ausnahmen existieren bereits (`.bfv-actions .btn`, `.cal-actions .btn`, `.st-choice`, `.venue-link`, `.lu-jump`), sie sollen in der allgemeinen Regel aufgehen.
**Bereits erledigt, nicht mehr Teil dieses Pakets:** `.chip` wurde in **Paket 7a** global auf 44px angehoben (Entscheidung vom 11.09.2026: eine Chip-Höhe nur für den Kalender hätte genau die Inkonsistenz erzeugt, vor der `conventions.md` warnt). Die Zu-/Absage-Flächen liegen in Übersicht (`.th-rsvp .btn`, Paket 3) und Kalender (`.ev-rsvp .btn`, Paket 7a) bereits bei 46px.
**Was übrig bleibt:** `min-height` an `.btn` und `.link-btn` — betrifft vor allem Kasse, Einstellungen, Katalog und die Dialoge.
**Warum weiterhin eigenes Paket:** Die Regel verschiebt Zeilenhöhen und Umbrüche in Ansichten, die sonst in keinem Paket angefasst werden. Das gehört einmal bewusst und einzeln getestet, nicht als Nebenwirkung in ein Feature-Paket.
**Reihenfolge:** Vor den Logik-Paketen, nach Paket 1.
**iPhone-Test:** Als Kassenwart → Kasse → die Schaltflächen „Hinzufügen", „Eingang bestätigen" und „Ablehnen" mit dem Daumen treffen, ohne zu zielen. Dann → Einstellungen → „Abmelden" und „Strafenkatalog öffnen". Nichts darf umbrechen, keine Karte darf höher werden als nötig, kein waagerechtes Scrollen.

**✅ Erledigt am 11.09.2026** — zusammen mit Paket 13. Angehoben: `.btn` und `.link-btn` global, `.kat-in`, `.kasse-qty .qty-btn`, `.modal-x`. Sechs punktuelle 44px-Regeln, die dadurch überflüssig wurden, sind entfallen. `.btn-danger` stand zweimal im Blatt (Befund aus `NOTES.md`) und wurde zu einer Definition zusammengeführt — das sichtbare Ergebnis der Kaskade blieb unverändert.

**Zwei bewusste Ausnahmen von der 44px-Regel:**

| Element | Höhe | Warum |
|---|---|---|
| `.ks-ichip` (Chip „freie Strafe") | ~32px | Der Chip ist nicht antippbar, nur sein X. Das X hat eine **unsichtbare** 44px-Trefferfläche per `::before` bekommen — dasselbe Muster, das `.tv-slot` auf dem Spielfeld schon nutzt. Der Chip wächst dadurch nicht. |
| `.role-box` (Checkbox in der Rollen-Tabelle) | 24px | Eine native Checkbox in einer Tabellenzelle. 44px hieße entweder sichtbar vergrößern oder die Tabelle in Zeilen mit Schaltern umbauen — beides eine Layoutänderung. Von Browser-Standard auf 24px angehoben, den Rest trägt die Zeilenhöhe. **Bleibt eine offene Abweichung**, auflösbar nur mit einem Umbau der Rollen-Tabelle. |

**Noch übrig, klein:** `.lu-jump` und `.btn-sm` tragen weiterhin ein eigenes `min-height: 44px`, das seit der Basisregel wirkungslos ist. Nicht mitentfernt, weil beide nicht auf der abgestimmten Liste standen.

### Paket 2 — Kopf und Navigation
**Dateien:** `styles.css`, bei 1b zusätzlich `index.html`
**Aufwand:** 2a = S · 1b = M
**Inhalt:** Bei 2a nur Feinschliff der bestehenden Kopfzeile plus aktiver Nav-Balken. Bei 1b der dunkle Kopfblock je Ansicht, inklusive der Frage, wie er sich zur fixen Kopfzeile verhält.
**iPhone-Test:** Als Trainer → jeden Tab einmal öffnen → Logo und Zahnrad sind überall sichtbar, die Bottom-Nav bleibt stehen, unten bleibt kein heller Streifen, beim Öffnen der Tastatur rutscht nichts.

### Paket 3 — Termin-Hero auf der Übersicht
**Dateien:** `app.js` (`renderDashboard`), `styles.css`
**Aufwand:** M
**Inhalt:** Nächster Termin als Block oben mit Zusage/Absage, die vier Kacheln weichen den beiden Geldzeilen. Sprungziele der alten Kacheln erhalten.
**iPhone-Test:** Als Spieler → Übersicht → „Zusage" tippen → Button wird grün, Kalender zeigt denselben Zustand, nach „Neu laden" bleibt er.

### Paket 4 — Kaderansicht als Ersatz für Kader-Status und Lazarett
**Dateien:** `app.js` (neue Ansicht), `index.html` (Eintrag im Mehr-Menü), `styles.css`
**Aufwand:** M
**Inhalt:** Der heutige Kader-Status und das Lazarett ziehen aus der Übersicht in eine eigene Ansicht, erreichbar über „Kader ansehen".
**iPhone-Test:** Als Trainer → Mehr → Kader → bei einem Spieler „verletzt" wählen, Notiz eintragen → Spieler erscheint sofort im Lazarett-Teil, die Kennzahl „Verletzt" auf der Übersicht zählt hoch.

### Paket 5 — Aufgabenblock „Was heute liegt"
**Dateien:** `app.js` (`renderDashboard`), `styles.css`
**Aufwand:** M
**Inhalt:** Drei Zeilen, jede rollenabhängig, jede mit Sprungziel. **Ohne** „Erinnerung senden".
**iPhone-Test:** Als Kassenwart → Übersicht → Zeile „N Zahlungen bestätigen" tippen → landet in der Kasse im Reiter „Zu prüfen", die Zahl in der Zeile stimmt mit der im Reiter überein. Dieselbe Übersicht als Spieler öffnen → die Zeile ist nicht da.

**✅ Erledigt am 11.09.2026** — zusammen mit der Umstellung auf die Vorlage „App in 2a - High End". Gebaut als **fünf** mögliche Zeilen statt drei, jede an Rolle **und** Datenlage gebunden, frei kombinierbar: eigene fehlende Rückmeldung (Spieler), gemeldete Zahlungen (Kassenwart), unvollständige Aufstellung (Trainer), fehlende Rückmeldungen im Team (Trainer), und „Keine offenen Strafen" als ruhige grüne Bestätigung. Trifft keine Zeile zu, entfällt der Block ganz. „Erinnerung senden" ist wie festgelegt **nicht** gebaut.

**Neue Klassenfamilie für Paket 14:** `.task-list`, `.task-row` mit `.is-pay` / `.is-lineup` / `.is-rsvp` / `.is-clear`, `.task-num`, `.task-main`, `.task-title`, `.task-sub`, `.task-go`. Dazu `.kasse-toggle` (eingeklappte Kasse) und die überarbeitete `.mine-banner`-Familie mit `.mb-bar` und `.mb-foot`.

### Paket 6 — Konto- und Kassenansicht angleichen
**Dateien:** `app.js` (`renderStrafen`, `renderKasse`), `styles.css`
**Aufwand:** M
**Inhalt:** Kontoblock als gemeinsame Funktion für Übersicht und Konto, Kennzahlenreihe, Filter inklusive „Alle", Zustandsmarken.
**iPhone-Test:** Als Spieler mit offener Strafe → Übersicht → „Zahlung melden" → Zustand wechselt auf „gemeldet", das Konto zeigt denselben Zustand, der Kassenwart sieht den Eintrag im Reiter „Zu prüfen".

### Paket 7 — Kalender und Aufstellung nachziehen
**Dateien:** `app.js` (`renderKalender`, `eventCard`, `tvViewGames`, `tvViewLineup`), `styles.css`
**Aufwand:** M
**Inhalt:** Karten- und Kopfgestaltung übernehmen. **Stift, Kader-Info und BFV-Block bleiben**, Bottom-Nav bleibt auf dem Aufstellungs-Screen, der Variante-B-Ablauf bleibt unangetastet. Bei 1b zusätzlich Filter und Formationsleiste in den Kopfblock.
**iPhone-Test:** Als Trainer → Kalender → Stift an einem Termin → Zeit ändern → Karte zeigt sofort die neue Zeit und die Marke „manuell geändert". Dann → Aufstellung → Position antippen → Kader-Vollbild öffnet sich, Spieler wählen, speichern → „11/11 gesetzt".

### Paket 8 — Katalog-Kategorien sichtbar und pflegbar
**Dateien:** `db.js`, `app.js` (`katRowView`, `katRowEdit`), `styles.css` — **kein** Schema
**Aufwand:** M
**Inhalt:** Vorhandene Spalte `category` anzeigen, im Formular pflegbar machen, Bestandszeilen einmalig nachtragen.
**iPhone-Test:** Als Kassenwart → Katalog → Position bearbeiten → Kategorie eintragen, speichern → Kategorie steht sofort unter der Bezeichnung, auch nach „Neu laden".

### Paket 9 — Aufstellungsvorlagen zurückholen (optional)
**Dateien:** `app.js` (`tvViewGames`, `tvOpenMenu`), `styles.css` — **kein** Schema
**Aufwand:** M
**Inhalt:** Vorhandene Vorlagen aus `lineups` wieder anzeigen und anwendbar machen.
**iPhone-Test:** Als Trainer → Aufstellung → Vorlagen → eine Vorlage anwenden → Elf steht, Formation stimmt, Speichern legt die Aufstellung am gewählten Spiel an.

### Paket 10 — Sortierung des Katalogs (Schema)
**Dateien:** neue Migration, `db.js`, `app.js`
**Aufwand:** L
**Inhalt:** Sortierspalte an `fine_catalog`. Migration zuerst, Zwischenbestätigung, dann Frontend.
**iPhone-Test:** Als Kassenwart → Katalog → Sortieren → zwei Positionen tauschen → Reihenfolge bleibt nach „Neu laden" und ist auch für einen Spieler gleich.

### Paket 11 — Einsätze je Spieler (Schema)
**Dateien:** neue Migration, `db.js`, `app.js` (`renderProfil`, Aufstellung)
**Aufwand:** L
**Inhalt:** Nur wenn 1b gewählt wird und die Kennzahl „Einsätze" bleiben soll.
**iPhone-Test:** Als Trainer → nach einem Spiel Einsätze erfassen → als betroffener Spieler → Profil → „Einsätze" zählt hoch.

### Paket 12 — Erinnerung senden (Backend)
**Dateien:** neue Migration, neue serverseitige Route unter `api/`, `app.js`
**Aufwand:** L
**Inhalt:** Zuletzt und als eigenes Paket, weil es als Einziges einen neuen Zustellweg braucht.
**iPhone-Test:** Als Trainer → Übersicht → „Erinnerung senden" → Bestätigung erscheint, ein zweiter Tap kurz danach ist gesperrt, ein betroffener Spieler bekommt die Nachricht.

### Paket 13 — Aufräumen *(läuft mit, nachgetragen am 11.09.2026)*
**Dateien:** `app.js`, `styles.css`
**Aufwand:** S
**Inhalt:** Beim Umbau sind Funktionen und Regeln verwaist. Alle wurden bewusst stehen gelassen, weil Aufräumen nicht in ein Feature-Paket gehört — hier gesammelt, damit nichts verloren geht. Jede Stelle trägt im Code bereits einen Kommentar.

| Was | Wo | Verwaist seit | Warum |
|---|---|---|---|
| `eventTitel()` | `app.js` | Paket 3 | letzter Aufruf lag in der alten „Nächster Termin"-Kachel |
| `.rsvp`, `.rsvp-buttons` | `styles.css` | Paket 7a | Terminkarte stapelt, Zu-/Absage liegt in `.ev-rsvp` |
| `.tag-training` | `styles.css` | Paket 7a | Typ-Marke als Text entfällt, Kante und Titel tragen den Typ |
| `.ev-sep`, `.rsvp-count` | `styles.css` | Rückmeldungs-Sheet | Zähler sitzt jetzt im antippbaren Eintrag |
| `.tv-gdate` samt Kindregeln | `styles.css` | Paket 7b | Spielauswahl nutzt die Datumsplakette `.event-date` |
| **`sheetViews` steht doppelt** | `app.js` Zeile 2196 und 3512 | vorbestehend | zwei identische Listen bestimmen, wann der „Mehr"-Tab aktiv gilt. **Keine tote Regel, sondern eine Stolperstelle:** wer eine Ansicht ergänzt und nur eine Kopie pflegt, bekommt einen stillen Fehler in der Navigationsmarkierung |

**Reihenfolge:** jederzeit, unabhängig von allem anderen. Die `sheetViews`-Doppelung lohnt zuerst, weil sie als Einzige aktiv schaden kann.
**iPhone-Test:** Nach dem Aufräumen einmal jede Ansicht öffnen und auf sichtbare Änderungen achten — es darf **keine** geben. Besonders: Terminkarte mit Zu-/Absage, Trainer-Spielauswahl, Rückmeldungs-Sheet, und der „Mehr"-Tab muss in Kader, Trainer, Kasse, Rollen und Einstellungen als aktiv markiert bleiben.

**✅ Teilweise erledigt am 11.09.2026.** Entfernt: `eventTitel()`, `.ev-sep`, `.tv-gdate` samt Kindregeln. Die `sheetViews`-Doppelung ist aufgelöst — eine Konstante `SHEET_VIEWS`, beide Stellen greifen darauf zu.

**Vier Klassen konnten NICHT entfernt werden:** `.rsvp`, `.rsvp-buttons`, `.rsvp-count` und `.tag-training` werden von den Design-System-Karten unter `.design-sync/cards/` noch verwendet, und `validate.sh` bricht ab, wenn eine Karte eine Klasse nutzt, die `styles.css` nicht definiert. Auflösung siehe Paket 14.

### Paket 14 — Design-System nachziehen *(neu am 11.09.2026)*
**Dateien:** `.design-sync/cards/Bausteine/Terminkarte.html`, `.design-sync/cards/Bausteine/Badges-und-Tags.html`, danach `styles.css`; Läufe von `build.sh`, `validate.sh`, `check-conventions.sh`
**Aufwand:** M
**Inhalt:** Die Karte **Terminkarte ist seit Paket 7a veraltet** — sie zeigt das alte dreispaltige Layout mit `.rsvp` und `.rsvp-buttons`, das die App nicht mehr hat, sowie die Typ-Marke „Training", die entfallen ist. Die Karte auf den heutigen Aufbau bringen: `.ev-head` mit Datumsplakette und Inhalt, `.ev-rsvp` über die volle Breite, `.ev-status`, `.e-trainer`. In **Badges-und-Tags** die Marke „Training" streichen. Erst danach können die vier oben genannten Klassen aus `styles.css` weg.
**Warum eigenes Paket:** Es ändert, was das Design-System dokumentiert, und verlangt einen vollständigen design-sync-Lauf mit anschließendem Hochladen — das ist keine unsichtbare Aufräumarbeit.
**Hinweis aus `NOTES.md`:** Noch gar nicht als Karte abgebildet sind Aufstellungs-Builder, Kasse V2, Pull-to-Refresh und der PayPal-Button. Dazu kommen seit den letzten Paketen `.termin-hero`, `.kpi-rows`, die Kader-Ansicht und das Rückmeldungs-Sheet. Wer dieses Paket angeht, sollte gleich prüfen, ob diese Familien Karten bekommen.
**iPhone-Test:** entfällt — betrifft nur das Design-System, nicht die App. Prüfung ist, dass alle drei Skripte sauber durchlaufen.

---

# 4. Verstöße gegen die Fixpunkte

Grundlage: `.design-sync/conventions.md` (App-Rahmen, zwei harte Regeln), `.claude/skills/mobile-ui/SKILL.md`, `.design-sync/NOTES.md`.

| # | Fixpunkt | Verstoß | Konzept | Auflösung |
|---|---|---|---|---|
| 1 | **Kopfzeile mit Logo und Zahnrad, `position: fixed`, auf jeder angemeldeten Ansicht** | Der Aufstellungs-Screen ersetzt sie durch eine eigene Zurück-Leiste, Logo und Zahnrad fehlen | 2a **und** 1b | App-Kopfzeile stehen lassen, die Zurück-Leiste wie heute **darunter** als `.tv-top` führen |
| 2 | dito | Der dunkle Kopfblock trägt auf Übersicht (Trainer), Katalog, Kasse, Aufstellung, Mehr-Menü und Spielerzuordnung **kein Zahnrad**, an seiner Stelle steht die Rollen-Pille | nur 1b | Zahnrad zusätzlich aufnehmen, oder verbindlich festlegen, dass Einstellungen nur noch über „Mehr" erreichbar sind |
| 3 | dito | Der Kopfblock scrollt mit dem Inhalt; die heutige Kopfzeile ist fix und trägt ihre Höhe zur Laufzeit in `--header-h` ein | nur 1b | Entweder eine schlanke fixe Kopfzeile **über** dem scrollenden Kopfblock, oder der Kopfblock wird selbst fix und `--header-h` wird je Ansicht neu gemessen. Zweiteres ist deutlich mehr Arbeit |
| 4 | **Bottom-Nav bleibt sichtbar** | Der Aufstellungs-Screen hat keine | 2a **und** 1b | Nav wieder aufnehmen, das untere Padding muss Nav plus `env(safe-area-inset-bottom)` abdecken |
| 5 | **Aufstellung Variante B** (Tippen-zum-Zuweisen mit Kader-Vollbild) | Der Auswahlweg ist in keinem Entwurf dargestellt, beide zeigen nur die fertige Elf | 2a **und** 1b | Nicht ändern. Der Entwurf bildet nur den Endzustand ab, beim Bauen bleibt `tvOpenKader()` unangetastet |
| 6 | dito | Beide Konzepte führen eine **Vorlagen-Liste** ein, die die aktive Aufstellung v2 bewusst nicht mehr zeigt | 2a **und** 1b | Produktentscheidung, siehe offene Frage 2 |
| 7 | dito | 1b verschiebt die Formationsleiste in den mitscrollenden Kopfblock, weg vom Platz | nur 1b | Leiste über dem Platz belassen |
| 8 | **Alles Antippbare mindestens 44px** | Filtermarken sind 34px (2a) bzw. 32px (1b) hoch | 2a **und** 1b | **Vorbestehende Abweichung**: `.chip` liegt heute bei rund 33px, das Basis-`.btn` bei rund 35px, `.link-btn` ohne Mindesthöhe. Kein neuer Fehler, aber 1b macht es minimal schlimmer. Als **Paket 1a** eigenständig eingeplant |
| 9 | **Eingabefelder auf 16px** | In den Entwürfen sind Felder als Text dargestellt (15px), nicht als echte Felder | 2a **und** 1b | Reine Darstellungssache, beim Bauen das `.kat-in`-Muster mit 16px verwenden |
| 10 | **Farbsprache: offen = rot, erledigt = dunkelgrün** | 1b zeigt den eigenen offenen Betrag groß in **Gold** | nur 1b | Siehe offene Frage 5 |
| 11 | **Keine Utilities, semantische Klassen** | Beide Entwürfe arbeiten mit kurzen technischen Klassennamen (`.bd`, `.rt`, `.rs`, `.sg`) | 2a **und** 1b | Nur Entwurfssprache, bei der Umsetzung gilt die Klassenliste aus `conventions.md` |
| 12 | **Kein Hex im Markup, nur Tokens** | Beide Entwürfe setzen Farben teils direkt | 2a **und** 1b | Nur Entwurfssprache, bei der Umsetzung über `tokens/tokens.css` |

Zusätzlich für den nächsten design-sync-Lauf relevant (aus `NOTES.md`): beide Konzepte fügen Klassenfamilien hinzu, die noch keine Karte zeigt — Kopfblock, Kennzahlenreihe, Aufgabenblock. `build.sh` merkt das nicht von selbst.

---

# Offene Fragen

1. **„Kader ansehen"** (2a, Übersicht) — wohin führt der Tap? Eine Kaderansicht gibt es heute nicht. Soll sie der neue Ort für Kader-Status und Lazarett werden?
2. **Aufstellungsvorlagen** — sollen sie zurückkommen? Schema und RLS sind vollständig vorhanden, die aktive Ansicht v2 zeigt sie bewusst nicht. Das ist eine Produkt-, keine Technikfrage.
3. **Kennzahlenreihe bei 1b** — die Reihe hat drei feste Plätze, aber je Rolle unterschiedlich viele Inhalte. Soll sie auf zwei schrumpfen, sollen Plätze aufgefüllt werden, oder fällt sie für Spieler ganz weg?
4. **„Zusagenquote"** (1b) — wie definiert? Zusagen geteilt durch alle Termine, nur Trainings, oder nur seit Saisonstart? Zählen abgesagte Termine mit? Ohne Definition ist die Zahl nicht baubar.
5. **Gold für offene Beträge** (1b, Konto) — heute ist offen immer rot und erledigt dunkelgrün. Soll Gold diese Regel für den eigenen Kontostand aufheben?
6. **„Abmelden" im Kopfblock** (1b, Einstellungen) — soll die auffälligste Aktion der Seite das Abmelden sein, oder bleibt es ein zurückhaltender Textlink wie heute?
7. **„Mannschaftskasse"** (beide, Übersicht) — meint die Zeile weiterhin die Summe offener Strafen, oder soll daraus ein echter Kassenstand werden? Letzteres wäre eine neue Rechnung.
8. **Meldeschluss** — bleibt es bei der festen Regel (24 h vor Spielen, 3 h vor Trainings), oder soll er je Termin einstellbar werden?
9. **1b-Kopfblock und `position: fixed`** — mitscrollend oder fix? Die Antwort entscheidet, ob Paket 2 klein oder groß wird.
10. ~~**Konzeptdateien im Repo**~~ — **erledigt am 11.09.2026**: beide Dateien liegen jetzt unter `.design-sync/concepts/` und stimmen mit dem analysierten Stand überein. Offen bleibt nur, ob sie mitcommittet werden sollen — der Ordner steht aktuell als `??` in `git status`.

---

# Empfehlung

**2a als Basis, mit drei Anleihen aus 1b.** 2a ist technisch die günstigere Wahl, weil es den App-Rahmen unangetastet lässt: die fixe Kopfzeile mit Logo und Zahnrad, die Bottom-Nav und das Höhenmodell über `--header-h` bleiben, wodurch Paket 2 auf Feinschliff zusammenschrumpft und die iPhone-Fallstricke aus `mobile-ui` gar nicht erst aufgehen. 1b verlangt dagegen ein neues Layoutmodell — ein Kopfblock je Ansicht, der entweder mitscrollt oder selbst fix wird und dann je Ansicht neu vermessen werden muss — und verstößt zusätzlich in sechs Ansichten gegen den Zahnrad-Fixpunkt, was jeweils eine Einzelentscheidung erzwingt. Aus 1b übernehmenswert sind drei Dinge, die keinen Rahmenumbau brauchen: die Dreier-Kennzahlenreihe statt des Vier-Kachel-Rasters, „Kader anschreiben" als Aktion an der Aufstellung statt als Knopf an der Terminkarte, und die dunkelgrüne Zusammenfassung vor dem Speichern in der Kasse. Unabhängig von der Wahl sind Stift, BFV-Abweichungshinweis, Katalog-Bearbeitung und Kader-Status blockierende Rückschritte in beiden Entwürfen und müssen vor dem ersten Logik-Paket geklärt sein — sonst verliert die App Funktionen, die kein Styling zurückbringt.
