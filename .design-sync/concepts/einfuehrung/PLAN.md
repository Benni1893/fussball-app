# Einführung je Rolle und „So geht's“: Plan

Stand 18.10.2026. Quelle ist der Entwurf aus Claude Design, Projekt „FC Fasanerie-Nord App“, Datei `Einfuehrung.dc.html`.

- **Gespiegelt nach** `entwurf/`: Seite, `support.js`, Logo, Design-System-Kopie und die 22 benutzten Referenzbilder in `entwurf/ref/`.
- **Gerendert nach** `soll/`: je Seite ein Bild. Text und gelbe Markierungen stehen in `soll/soll.json`.

Der Entwurf ist eindeutig: eine Datei mit vier Rollen, dazu die Seiten „Tabelle“ und „Abweichungen“. Er verlangt kein neues Backend außer dem Merker „gesehen“, den der Auftrag ohnehin vorsieht.

## Seiten je Rolle (aus dem Entwurf)

| Rolle | Rollenseiten | Gemeinsame Seiten |
|---|---|---|
| Spieler | 01 Termine und Zusage · 02 Mein Status · 03 Strafenkonto · 04 Katalog | Home-Bildschirm · Mitteilungen · Termine abonnieren · Alles bereit |
| Trainer (spielt nicht mit) | 01 Wer kommt? · 02 Elf aufstellen · 03 Kader und Status · 04 Freigeben und Rollen | dieselben vier |
| Kassenwart | 01 Erst mal als Spieler · 02 Die Kasse · 03 Strafe verhängen · 04 Prüfen und verbuchen · 05 PayPal-Link hinterlegen | dieselben vier |
| Spielertrainer | 01 Dein nächster Termin · 02 Wer kommt? · 03 Elf aufstellen · 04 Kader und Status · 05 Freigeben und Rollen | dieselben vier |

## Zusammensetzung in der App

Gespeichert wird „gesehen“ je Teil: `spieler`, `trainer`, `kassenwart`.

**Wer welchen Teil bekommt** (echte Rollen, nie die Admin-Vorschau):

| Teil | Bedingung | Gleiche Regel wie in der App |
|---|---|---|
| `spieler` | Konto mit Kadereintrag | `currentProfile.player_id` |
| `trainer` | Trainer oder Admin | `Roles.canManageEvents()` |
| `kassenwart` | Kassenwart oder Admin | `Roles.canManageFines()` |

**Erstes Mal.** Die Rollenseiten werden ohne doppelte Seiten zusammengesetzt, danach folgen die gemeinsamen Seiten:

| Rollen | Seiten |
|---|---|
| nur Spieler | Spieler 01 bis 04 |
| Spieler und Kasse | Kassenwart 01 bis 05. Kassenwart 01 fasst die Spielerseiten zusammen. |
| Trainer ohne Kadereintrag | Trainer 01 bis 04 |
| Trainer mit Kadereintrag | Spielertrainer 01 bis 05. Spielertrainer 01 zeigt die eigene Zusage. |
| Trainer und Kasse | Spielertrainer 01 bis 05 (ohne Kadereintrag Trainer 01 bis 04), dann Kassenwart 02 bis 05 |

**Neue Rolle später.** Es erscheinen nur die Seiten der neuen Rolle und „Alles bereit“, damit die neue Navigation sichtbar wird. Home-Bildschirm, Mitteilungen und Kalender-Abo kommen nicht noch einmal.
- Neu Kassenwart: Kassenwart 02 bis 05.
- Neu Trainer: Spielertrainer 01 bis 05, ohne Kadereintrag Trainer 01 bis 04.

**Gemeinsame Seiten:**

| Seite | Wann sie erscheint | Was sie nutzt |
|---|---|---|
| Home-Bildschirm | nur, wenn die App nicht schon vom Home-Bildschirm läuft (`istStandalone()`) | – |
| Mitteilungen | nicht, wenn auf diesem Gerät schon aktiv (`pushZustand() === "aktiv"`) | Knopf über `pushAnmelden()`. Auf dem iPhone außerhalb der Home-Bildschirm-App (`ios-install`) steht statt des Knopfs der Hinweis. |
| Termine abonnieren | immer | dieselben Karten wie das Abo-Blatt (`openCalSheet`), mit `webcal`-Link, „Link kopieren“ und „calendar.google.com öffnen“ |
| Alles bereit | immer | Bild der unteren Navigation der Hauptrolle: Spielertrainer, Trainer, Kassenwart oder Spieler |

Der Fortschritt zählt die Seiten des aktuellen Durchgangs.

**Wann die Einführung erscheint:** einmal, nach dem ersten vollständigen Laden der App, also nach Freigabe und Onboarding. Das bisherige Onboarding vor der Freigabe bleibt unverändert, auch seine Schritte Home-Bildschirm und Push. Der Merker wird gesetzt bei:
- „Los geht's“,
- „Überspringen“ auf jeder Seite,
- Schließen über das Ende einer Wiederholung.

**Wiederholung:** Einstellungen › So geht's › „Einführung ansehen“ (`#ein=sogehts`) zeigt alle Seiten der eigenen Rollen, einschließlich der gemeinsamen Seiten. Trainer und Admin sehen zusätzlich die vier Rollen einzeln. Die Wiederholung schreibt nichts in die Datenbank und kehrt zu „So geht's“ zurück.

## Verwendete Bausteine (alle vorhanden)

- **Rahmen:** `.auth-wrap`, `.auth-card.ob-card`, `.auth-crest`, `.auth-title`, `.ob-text`, `.ob-fuss`, `.btn.btn-primary.ob-weiter`, `.btn.ob-sek`, `.link-btn.ob-spaeter`, `.ob-hinweis`, `.ob-schritt` („Optional“).
- **Inhalt:**
  - Katalog: `.kat-list` und `.kat-item` über das vorhandene `katRowView()` mit den echten Katalogeinträgen.
  - Home-Bildschirm und Kalender: `.abo-karten`, `.abo-karte`, `.abo-k-t`, `.abo-schritte`, `.abo-btn`, `.abo-hinweis`, `.abo-fuss`.
  - Mitteilungen: `.ob-anl` und `.ob-liste`.
- **Einstellungen:** `.ein-gruppe`, `.ein-zeile` über `einZeileHtml()`, `.group-head`, `einKopfHtml()` mit Zurück-Leiste und Hash-Logik `#ein=`.

## Gelb markierte Abweichungen im Entwurf (neu)

1. **Fortschrittspunkte**, neu:
   - Punkte 8 px in `--dot-off`, die aktuelle Seite als Pille 20 × 8 px in `--green-700`, 6 px Abstand.
   - Sie stehen in einer Zeile links neben „Überspringen“.
   - Umgesetzt als `.ef-kopf`, `.ef-punkte` und `.ef-punkt`, nur mit vorhandenen Tokens.
2. **Ausschnitt-Rahmen** für App-Ansichten, neu:
   - 1 px `--line`, `--radius-md`, Hintergrund `--bg`. Einzelne Bausteine stehen ohne Rahmen mit `--radius`.
   - Umgesetzt als `.ef-rahmen` und `.ef-bild`.
   - Die Bilder sind genau die Ausschnitte des Entwurfs: 24 WebP-Dateien in `assets/einfuehrung/`, zusammen 390 KB. Sie werden erst geladen, wenn die Seite erscheint.
   - Erzeugt mit `.design-sync/shots/einfuehrungausschnitte.mjs`.

## Weitere Abweichungen (bewusst)

| Stelle | Entwurf | App | Grund |
|---|---|---|---|
| Katalog | 5 feste Beispielposten | die ersten 5 Posten des echten Katalogs, gleicher Baustein | Die Texte sollen zur App passen. Bei leerem Katalog entfällt die Liste. |
| Mitteilungen | Seite immer da | entfällt, wenn auf dem Gerät schon aktiv | Ein Knopf ohne Wirkung wäre irreführend. |
| Mitteilungen auf dem iPhone in Safari | Knopf | Hinweis statt Knopf | Vorgabe aus dem Auftrag |
| Kalender | Apple-Karte oben | die Karte des erkannten Systems oben, wie im Abo-Blatt | Gleiche Logik wie das bestehende Blatt. Der Entwurf zeigt den iPhone-Fall. |
| Google-Knopf im Kalender | `.btn` | `.btn.btn-soft` | Wie im bestehenden Abo-Blatt |
| Neue Rolle später | – | nur die neuen Rollenseiten und „Alles bereit“ | Vorgabe aus dem Auftrag |

## Betroffene Dateien

- **`app.js`:**
  - Einführung: Daten, Rendern, Klicks, Start nach `render()` in `init()`.
  - Kalender-Karten als gemeinsame Funktion für das Abo-Blatt und die Einführung, ohne Änderung am Verhalten.
  - Unterseite `sogehts` in `EIN_SEITEN` und eine Zeile „So geht's“ unter Einstellungen › Info.
- **`db.js`:** `einfuehrungGesehen()` und `einfuehrungMerken(teile)`.
- **`styles.css`:** `.ef-*` für Kopfzeile, Punkte und Ausschnitte, `.sg-*` für die Fragen in „So geht's“ (`details` im Zeilenblock).
- **`assets/einfuehrung/*.webp`:** 24 Ausschnitte.
- **Build-Kennung:** `index.html`, `sw.js`, `APP_BUILD`.
- **Prüfung:**
  - neu `.design-sync/shots/einfuehrungpruef.mjs`,
  - Stand-in `landkartenmodul.mjs` um die Tabelle erweitert,
  - `einpruef.mjs` mit einer Zeile mehr unter Info.
- **Migration:** `supabase/migrations/0074_einfuehrung_gesehen.sql` mit Prüfskript `supabase/checks/0074_einfuehrung_gesehen_pruef.sql`.

## Migration: ja

Tabelle `public.einfuehrung_gesehen`:

| Spalte | Typ |
|---|---|
| `user_id` | `uuid`, verweist auf `profiles(id)`, `on delete cascade` |
| `teil` | `text`, nur `spieler`, `trainer` oder `kassenwart` |
| `gesehen_am` | `timestamptz`, Vorgabe `now()` |

Primärschlüssel ist `(user_id, teil)`.

- **RLS:** Lesen und Anlegen nur für die eigene Zeile (`user_id = auth.uid()`). Kein Ändern, kein Löschen und kein Zugriff für `anon`.
- **Konto löschen:** `konto_entfernen_intern` löscht `auth.users`. Die Kaskade über `profiles` nimmt die Zeilen mit, eine Anpassung ist nicht nötig.
- **Gegenprobe vorher:** Tabelle noch nicht vorhanden, Name frei, `profiles.id` ist Primärschlüssel.

## So geht's (A2)

- **Ort:** Einstellungen › Info › „So geht's“ (`#ein=sogehts`). Eine Unterseite mit derselben Hash-Logik und Zurück-Leiste wie die übrigen.
- **Bausteine:**
  - `.group-head` und `.ein-gruppe` mit `einZeileHtml()`.
  - Die Fragen sind native Aufklapper (`details`). Die Zeile darin ist `.ein-zeile`, die Antwort nutzt `.ob-liste` und `.ein-hinweis`.
  - Einziges neues CSS: Marker ausblenden, Pfeil drehen, Innenabstand (`.sg-*`).
- **Inhalt:**
  1. „Einführung ansehen“ zeigt die eigene Einführung. Trainer und Admin sehen zusätzlich „Einführung der Rollen“ mit Spieler, Trainer (spielt nicht mit), Kassenwart und Spielertrainer.
  2. „Häufige Fragen“, nach Rolle gefiltert. Der Admin sieht alle.
  3. „Frage nicht dabei?“ mit `teamkabine-app@gmx.de`.
- **Texte:** in `FAQ.md`, erzeugt aus dem Block `SG-FRAGEN` in `app.js` mit `node .design-sync/shots/faqliste.mjs`.
- **Prüfung der Antworten:** Jede Antwort ist an `app.js`, `db.js`, den Migrationen und den Funktionen in der Produktion geprüft. Bewusst weggelassen:
  - feste Euro-Beträge, denn sie stehen im Katalog und können sich ändern,
  - feste Stunden für den Meldeschluss, denn sie sind je Termin einstellbar,
  - „E-Mail bestätigen“, denn das ist abgeschaltet,
  - „Testnachricht senden“, denn das gibt es nur für Admins.

## Fehlt in der App

| # | Was fehlt | Wo es auffällt | Vorschlag | Aufwand |
|---|---|---|---|---|
| 1 | **Behoben am 19.10.2026 mit Migration 0075** (Prüfskript `0075_ehemalige_pruef.sql`, 9 von 9 PASS). Zusätzlich zählen „Übersicht nach Meldeschluss“ und „Push senden“ Ehemalige nicht mehr als offen. Ursprünglicher Befund: **Ehemalige Spieler bekamen weiter automatische Strafen.** `apply_event_fines` geht über alle `players` ohne Filter auf `ausgeschieden_am`. Nach „Aus der Mannschaft entfernen“ oder „Konto löschen“ bekäme der Eintrag „Ehemaliger Spieler“ bei jedem Spiel und Training „keine Rückmeldung“ (in der Produktion geprüft). Heute gibt es keine Ehemaligen, deshalb noch keine Treffer. | FAQ „Ein Spieler verlässt die Mannschaft“ | Migration: `and p.ausgeschieden_am is null` in `apply_event_fines`. Dabei prüfen, ob die übrigen Funktionen über `players` (u. a. `notify_cron_rueckmeldung`, `send_rsvp_reminder`) dieselbe Bedingung brauchen. Prüfskript dazu. | ca. 1 Std. **Vor dem ersten Austritt beheben.** |
| 2 | Kadereintrag ohne Konto entfernen (oder anlegen) | FAQ „Ein Spieler verlässt die Mannschaft“ | RPC `kader_entfernen(p_player)`: nur Trainer oder Admin, nur ohne verknüpftes Konto, wie `konto_entfernen_intern` ohne Konto-Teil. Dazu ein Knopf im Status-Blatt des Kaders. | 0,5 bis 1 Tag |
| 3 | Betrag einer eingetragenen Strafe ändern | FAQ „Strafe falsch eingetragen“ (heute: stornieren und neu anlegen) | „Betrag ändern“ im Detail-Blatt einer offenen Strafe, RPC mit Eintrag in `fine_status_log` | ca. 0,5 Tag |
| 4 | Datenauskunft in der App | FAQ „Konto löschen oder Daten anfragen“ (heute: Mail an die Kontaktadresse) | „Meine Daten herunterladen“ im Profil: RPC `meine_daten()` liefert JSON. Dazu `id="rechte"` an „7. Ihre Rechte“ in der Datenschutzerklärung und ein direkter Link darauf. | ca. 0,5 Tag (Anker 5 Min.) |
| 5 | Kassenwart gibt die Kasse selbst ab | FAQ „Der Kassenwart wechselt“ (heute: macht ein Trainer) | „Kasse abgeben“ im Profil: RPC, die nur die eigene Rolle entfernt, mit derselben Behandlung offener Meldungen | 2 bis 3 Std. |
| 6 | „Testnachricht senden“ nur für Admins | FAQ „Ich bekomme keine Mitteilungen“ | Für alle freischalten, damit jeder Push selbst prüfen kann | ca. 1 Std. |

## Weitere Fragen (Vorschlag, nicht eingebaut)

1. **Verletzt oder im Urlaub eintragen** (alle): Mein Status mit „Voraussichtlich bis“. Dazu die Einwilligung für Gesundheitsangaben.
2. **Termin anlegen oder absagen** (Trainer): Kalender und Spielplan BFV.
3. **Aufstellung erstellen und teilen** (Trainer)
4. **Strafe verhängen** (Kassenwart): Katalog, individuell, mehrere Spieler.
5. **„Noch nicht freigegeben“ und „noch keinem Spieler zugeordnet“** (neue Spieler)

## Block 2 (19.10.2026): Überarbeitung nach dem iPhone-Test

### Feedback und Umsetzung

| Feedback | Umsetzung |
|---|---|
| Screenshots wirken unscharf und billig | Keine Bilddateien mehr. Jede Abbildung ist echtes HTML mit den Klassen und Tokens der App und festen Beispieldaten. Sie ist verkleinert (CSS `zoom`), gestochen scharf, ohne Rahmen und nur der entscheidende Ausschnitt. `assets/einfuehrung/` entfällt. |
| Punkte zeigen Wischen, Wischen geht nicht | Wischen nach links und rechts mit passiven Touch-Listenern, ohne `preventDefault`. Senkrechtes Scrollen bleibt. Erst ab 50 px waagerecht und deutlich waagerechter als senkrecht. |
| Farbkante unten beim Scrollen | In der Einführung und in „So geht's“ bekommt `html` die Farbe des unteren Seitenendes. Dazu `overscroll-behavior: none` am `html`, nur dort. |
| Zu lang | Höchstens 6 Seiten je Person, auch bei mehreren Rollen. Überschrift höchstens 5 Wörter, höchstens 2 Sätze mit zusammen höchstens 20 Wörtern. Das Kalender-Abo wandert nach „So geht's“. |

### Seiten

| Kürzel | Überschrift | Text | Abbildung |
|---|---|---|---|
| `sp_termin` | Zu- oder absagen | Sag bei jedem Termin zu oder ab. Nach dem Meldeschluss kostet es eine Strafe. | Terminkarte mit „Zusage“ und „Absage“ |
| `sp_status` | Verletzt oder im Urlaub? | Stell es unter Mein Status ein, gern mit Datum. Der Trainer sieht es sofort. | die vier Status-Knöpfe |
| `sp_strafen` | Strafen bezahlen | Unter Konto siehst du, was offen ist. Zahl per PayPal oder melde deine Barzahlung. | Kontobanner mit Bezahlknopf |
| `st_termin` | Dein nächster Termin | Oben sagst du selbst zu oder ab. Darunter siehst du, wer schon geantwortet hat. | Terminkarte mit Rückmeldebalken |
| `tr_rueck` | Wer kommt? | Tipp im nächsten Termin auf Rückmeldungen. „Push senden“ erinnert alle, die noch offen sind. | Kacheln Zugesagt, Abgesagt, Offen |
| `tr_elf` | Elf aufstellen | Unter Trainer wählst du Formation, Startelf und Bank. Gute Aufstellungen speicherst du als Vorlage. | nächstes Spiel mit „Elf aufstellen“ |
| `tr_kader` | Kader und Status | Im Kader siehst du, wer fit ist und wer fehlt. Den Status kannst du auch selbst setzen. | drei Kaderzeilen mit Status |
| `tr_rollen` | Freigeben und Rollen | Neue Anfragen gibst du unter Einstellungen › Rollen frei. Dort machst du auch Trainer und Kassenwart. | Anfrage und Mitglieder |
| `kw_kasse` | Die Kasse im Blick | Die Übersicht zeigt Kassenstand und Offenes. Ein Tipp darauf öffnet die Kasse. | Kassenbanner |
| `kw_verhaengen` | Strafe verhängen | In der Kasse tippst du auf „+ Strafe verhängen“. Spieler und Strafe wählen, fertig. | Knopf und zwei Katalogzeilen |
| `kw_pruefen` | Zahlungen bestätigen | Gemeldete Zahlungen stehen unter Gemeldet. Bestätige sie, sobald das Geld da ist. | Reiter Gemeldet, Offen, Bezahlt und eine Meldung |
| `home` | Auf den Home-Bildschirm | Nur so kommen auf dem iPhone Mitteilungen an. Danach öffnest du die App über das Symbol. | Weg als Kette: iPhone „Teilen › Zum Home-Bildschirm › Hinzufügen“, Android „⋮ › App installieren“ |
| `push` | Mitteilungen erlauben | Die App erinnert dich an Termine und meldet neue Strafen. Ruhezeiten stellst du selbst ein. | eine Mitteilung als Muster |
| `sp_los` | Los geht's | Unten wechselst du die Bereiche. Hilfe findest du unter Einstellungen › So geht's. | untere Navigation |

### Folge je Rolle

Die Rollenseiten stehen in fester Rangfolge. Danach folgen „Home-Bildschirm“ (nur außerhalb der Home-Bildschirm-App) und „Mitteilungen“ (nur wenn noch nicht an). Von den Rollenseiten kommen so viele dazu, dass es höchstens 6 Seiten werden. Der Knopf auf der letzten Seite heißt „Los geht's“.

| Rollen | Rangfolge der Rollenseiten |
|---|---|
| Spieler | `sp_termin`, `sp_status`, `sp_strafen`, `sp_los` |
| Trainer ohne Kadereintrag | `tr_rueck`, `tr_elf`, `tr_kader`, `tr_rollen` |
| Kassenwart (mit Kadereintrag) | `sp_termin`, `kw_kasse`, `kw_verhaengen`, `kw_pruefen`, `sp_status`, `sp_strafen` |
| Spielertrainer | `st_termin`, `tr_elf`, `tr_kader`, `tr_rollen`, `sp_status` |
| Spielertrainer und Kasse (auch Admin) | `st_termin`, `tr_elf`, `tr_rollen`, `kw_kasse`, `tr_kader`, `kw_verhaengen` |
| Trainer ohne Kadereintrag und Kasse | `tr_rueck`, `tr_elf`, `tr_rollen`, `kw_kasse`, `tr_kader`, `kw_verhaengen` |

**Neue Rolle später:** Es erscheinen nur die Seiten der neuen Rolle, höchstens 4, ohne Home-Bildschirm und Mitteilungen.
- Neu Trainer: `st_termin` bzw. `tr_rueck`, dann `tr_elf`, `tr_kader`, `tr_rollen`.
- Neu Kasse: `kw_kasse`, `kw_verhaengen`, `kw_pruefen`.

### Häufige Fragen

Höchstens 3 nummerierte Schritte, jeder höchstens eine Zeile. Neu dazu kommen:
- Verletzt oder im Urlaub
- Termin anlegen oder absagen
- Aufstellung erstellen und teilen
- Strafe verhängen
- „Noch nicht freigegeben“

Die Antworten berücksichtigen Block 1: Freigabe ohne Kadereintrag, keine Trainer-Links, mindestens ein Trainer. Der volle Wortlaut steht in `FAQ.md`, erzeugt aus `app.js`.
