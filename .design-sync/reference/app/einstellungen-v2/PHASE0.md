# Paket „Einstellungen v2 + Push-Erinnerung“: Phase 0

Stand 03.10.2026. Nur gelesen, nichts geändert. Einzige neue Datei ist diese.
Quellen: Repo (`main`, sauber, `8a993b6`), Live-Datenbank (nur `select`),
Landkarten-Aufnahmen unter `.design-sync/landkarte/bilder/` (Stand-in, ohne Konto).

---

## a) Vorlagen

Vier neue, unversionierte Dateien (`git status`: `??`), lose in `.design-sync/reference/`:

| Datei | Panels | Unterseite |
|---|---|---|
| `einst.PNG` | 1 Admin · 1b Admin ans Ende gescrollt · 2 Spieler | Hauptseite |
| `einst2.PNG` | 3 Mitteilungen · 4 Mitteilungen gescrollt (kompakter Titel, Admin) · 5 Ruhezeiten | `#ein=mitteilungen`, `#ein=ruhezeiten` |
| `einst3.PNG` | 6 Kalender-Abo · 7 Spielplan (BFV) · 8 Push-Texte | `#ein=kalender`, `#ein=bfv`, **neu** Push-Texte als Unterseite |
| `einst4.PNG` | 9 Push-Text bearbeiten · 10 Diagnose | **neu** (3. Ebene), **neu** Diagnose als Unterseite |

Eindeutig, keine Rückfrage nötig. Panels 1–7 sind inhaltlich fast gleich wie die alte
Vorlage `einstellungen-kader/einstellungenneu*.png` (nach der F1–F8 und F10 gebaut sind).
Wirklich neu sind 8, 9 und 10. Panel 8 der alten Vorlage (Abmelden-Dialog) fehlt in
der neuen; der Dialog bleibt, wie er ist.

Vorschlag zu Beginn von E3: die vier Dateien nach
`.design-sync/reference/app/einstellungen-v2/` verschieben (Namen `einst1.png` bis
`einst4.png`, kleingeschrieben) und die Soll-Ausschnitte je Panel unter
`.design-sync/reference/soll/07_einstellungen-v2_<panel>.png` ablegen.

---

## b) Delta je Unterseite

Ist = Code-Stand `8a993b6` plus Landkarten-Bild. Den Zustand „Push aktiv“ (Mitteilungen,
Ruhezeiten) zeigt die Landkarte nicht, weil Playwright nicht als installierte App läuft;
dort ist das Ist aus dem Code gelesen. Gemessen in px wird erst in E3 ff.

### Hauptseite (Panel 1, 1b, 2)

| Element | Ist | Soll | Art | Aufwand |
|---|---|---|---|---|
| Rollenzeile Profilkarte | Reihenfolge aus `Roles.list` („Spieler · Administrator“) | „Administrator · Spieler“, höchste Rolle zuerst | Frontend-Logik | S |
| Symbol Diagnose | Info-Kreis | Pulslinie | nur Styling (SVG) | S |
| Zeile „App neu laden“ | mit Chevron | ohne Chevron (Aktion, keine Navigation) | nur Styling | S |
| Zeile „Diagnose“ | ruft das Overlay `window.__showDiag()` | öffnet Unterseite `#ein=diagnose` | Frontend-Logik | (in E10) |
| Zeile „Push-Texte“ | Sprung `data-goto="pushkatalog"` (eigene Ansicht) | Unterseite mit „‹ Einstellungen“ | Frontend-Logik | (in E8) |
| Abstände, Gruppen, Abmelden, Build | wie Vorlage | wie Vorlage, Feinmessung in E3 | nur Styling | S |

### Mitteilungen (Panel 3, 4)

| Element | Ist | Soll | Art | Aufwand |
|---|---|---|---|---|
| Außenrahmen | alles in einer `card card-pad` (`data-push-karte`) | kein Außenrahmen, einzelne Karten auf grauem Grund | nur Styling | M |
| „Push auf diesem Gerät“ | Hinweis als graue Unterzeile **in** der Zeile | Karte nur mit Titel und Schalter, Hinweis **unter** der Karte | Styling + Markup | S |
| Kopf „SPIELER · Alle“ | vorhanden | gleich | – | – |
| Symbole der Kategorien | Emoji (💸 ✅ ⚠️ ⏳ ❌ 📅) | farbige Kachel mit Liniensymbol (Gold €, Grün ✓, Rot ⚠, Dunkelgrün Uhr, Rot Kalender-x, Dunkelgrün Kalender-Stift, Grün Kalender-plus, Gold Pfeile) | Styling + SVG | M |
| Admin-Hinweis | eigene Gruppe mit Kopf „Admin“ | nur Hinweistext unter der Karte, neuer Wortlaut „Keine eigenen Kategorien für Admins. Als Admin bekommst du, was deine übrigen Rollen vorsehen.“ | Markup + Text | S |
| Testnachricht | grüner Vollknopf `btn-primary`, **für alle Rollen** | weiße Karte, grünes Sende-Symbol, grüner fetter Text; nur Admin (Ziel 2) | Styling + Rechte | S |
| Reihenfolge Schluss | Hinweis „Die Liste in der App …“ **vor** dem Knopf | Knopf, **dann** der Hinweis | Markup | S |
| Kompakter Titel beim Scrollen | vorhanden (F10) | gleich | – | – |

### Ruhezeiten (Panel 5)

| Element | Ist | Soll | Art | Aufwand |
|---|---|---|---|---|
| Außenrahmen | eine Karte um alles | drei Karten | nur Styling | S |
| „Nachts nicht stören“ | Kopf „Ruhezeiten“ mit Schalter, darunter Zeile mit Titel und Unterzeile | Karte mit Titel und Schalter, Hinweis darunter außerhalb | Markup + Styling | S |
| Von/Bis | `label` + natives `input type=time` nebeneinander | Karte mit zwei Zeilen, Wert rechts in grauer Pille | Styling | M |
| „Dringendes trotzdem zustellen“ | Zeile mit Unterzeile | Karte mit Schalter, Hinweis darunter | Styling | S |

### Kalender-Abo (Panel 6)

| Element | Ist | Soll | Art | Aufwand |
|---|---|---|---|---|
| Aufbau | Karte: Hinweis oben, zwei Knöpfe (grün, weiß) | Karte mit zwei Zeilen: „Termine abonnieren“ (grüne Kachel, grüner fetter Text), „Link kopieren“ (graue Kachel); Hinweis unter der Karte | Markup + Styling | S |

### Spielplan BFV (Panel 7, entspricht F9)

| Element | Ist | Soll | Art | Aufwand |
|---|---|---|---|---|
| Doppelte Überschrift | h1 **und** h3 „Spielplan (BFV)“ | nur h1 | Markup | S |
| Mannschaft | Label MANNSCHAFT, Name fett, Link „Ändern“ | Zeile „Mannschaft“ → Name grau + Chevron; Tippen = Ändern | Markup + Styling | S |
| Zuletzt aktualisiert | Fließtext „Zuletzt aktualisiert: 02.10.2026, 08:27 Uhr. Läuft …“ | Zeile mit Wert rechts „26.09.2026, 06:27“, Hinweis „Läuft zusätzlich täglich automatisch.“ unter der Karte | Markup + Styling | S |
| Jetzt aktualisieren | grüner Vollknopf | weiße Karte mit grüner Symbolkachel und grünem Text | Styling | S |

### Push-Texte (Panel 8, neu als Unterseite)

| Element | Ist | Soll | Art | Aufwand |
|---|---|---|---|---|
| Ort | eigene Ansicht `pushkatalog`, Titel „Push-Nachrichten“, Zurück-Chevron der App | Unterseite `#ein=pushtexte`, „‹ Einstellungen“, Titel „Push-Texte“ | Frontend-Logik (Route) | M |
| Kopfkarte | Hinweis + zwei Knöpfe in einer Karte | Karte mit Zeilen „Alle an mich senden“ (grün), „Vorschauen löschen“ (grau, Mülleimer); Hinweis darunter, gekürzt | Markup + Styling | S |
| Liste | 13 aufgeklappte Karten je Kategorie mit internem Namen (`absage_kurzfristig`), Vorschau, Eingabefeldern | Gruppen TRAINER / SPIELER, je Zeile Kachel, sichtbarer Name, „An …“, Marke „zeitkritisch“, Chevron | Frontend-Logik | M |
| Gruppen | keine | nach `kategorie_rolle`: Trainer (3), Kasse (1), Spieler (8 + neue Erinnerung), dazu „Test“ | Frontend-Logik | S |

### Push-Text bearbeiten (Panel 9, neu, 3. Ebene)

| Element | Ist | Soll | Art | Aufwand |
|---|---|---|---|---|
| Route | – | `#ein=pushtexte` + Kategorie, Zurück „‹ Push-Texte“ | Frontend-Logik (Hash-Muster erweitern) | M |
| Kopf | – | Titel = sichtbarer Name, Marke + „An alle Trainer · nach Meldeschluss“ | Frontend-Logik (Kurztexte je Kategorie) | S |
| Vorschau | iOS **und** Android nebeneinander | Umschalter „Sperrbildschirm | Hell“, eine Vorschau | Frontend-Logik + Styling | M |
| Felder | „Titel 24/40“, „Text …/110“ wie heute | gleich, neue Optik | Styling | S |
| Platzhalter | Liste `{anzahl} {termin}` als Code | Chips, Tippen fügt an der Cursorposition ein | Frontend-Logik | S |
| Knöpfe | „An mich senden“; bei Änderung „Vorlage speichern“ + „Verwerfen“ | nur „An mich senden“ zu sehen | siehe Liste unten | S |

### Diagnose (Panel 10, neu als Unterseite)

| Element | Ist | Soll | Art | Aufwand |
|---|---|---|---|---|
| Ort | Overlay aus `index.html` ersetzt die Ansicht | Unterseite `#ein=diagnose` | Frontend-Logik | M |
| STATUS | Monospace-Block | Karte: App „● Läuft“, Version „26.09.2026 · H“, Online, Als App installiert, Letzter Fehler | Frontend-Logik + Styling | M |
| HILFE BEI PROBLEMEN | drei Knöpfe, „Vorheriger Start“ als `details` | Zeilen: Neu laden, Cache leeren und neu laden, Protokoll kopieren, Protokoll dieses Starts ›, Protokoll vorheriger Start › | Frontend-Logik | M |

### Heute vorhanden, in der Vorlage nicht zu sehen (nichts davon fällt weg)

1. Mitteilungen in den Zuständen „In-App-Browser“, „iOS: erst installieren“, „Browser kann kein Push“, „blockiert“, „bereit“ samt „App installieren“. Bleiben, bekommen die neue Kartenoptik.
2. Ruhezeiten ohne eingerichtetes Push: Hinweis + „Zu den Mitteilungen“. Bleibt.
3. Gruppen „Trainer“ und „Kasse“ in Mitteilungen (die Vorlage zeigt nur „Spieler“). Bleiben.
4. Rückmeldetext `cal-copied` nach „Link kopieren“, Kalender-Blatt `data-cal-sheet`. Bleiben.
5. BFV: Zustand „nicht verbunden“ (Adressfeld, Speichern, Abbrechen), Meldung `bfvMsg`, Wert „noch nie“. Bleiben.
6. Push-Texte: „Vorlage speichern“ und „Verwerfen“ (erscheinen nur nach einer Änderung, wie heute), Fehlerhinweis bei unbekanntem Platzhalter (sperrt „An mich senden“), Marke „aus“ für inaktive Vorlagen, Kennzeichen optionaler Platzhalter, Empfänger- und Auslöserbeschreibung, Fortschritt bei „Alle an mich senden“. Bleiben.
7. Push-Texte: Android-Vorschau. Siehe Frage 7.
8. Diagnose: „Grund“, Hinweis bei abweichender HTML- und App-Version (Cache), Phasenliste. Wandern in „Protokoll dieses Starts“, die Versionswarnung in die Zeile „Version“.
9. Overlay `__showDiag()` für Watchdog, `?debug=1` und Wiedereinstieg. Bleibt unverändert, nur der Einstieg aus den Einstellungen geht auf die Unterseite.
10. Globaler Link „Neu laden“ unter jeder Ansicht (`index.html:233`). Gehört nicht zu den Einstellungen, bleibt.
11. Abmelden-Bestätigung (`window.confirm`). Bleibt.

---

## c) Push-Infrastruktur

**Es gibt einen funktionierenden serverseitigen Sendeweg.** Letzte Zustellungen am
25.09.2026, jeweils rund 30 bis 60 Sekunden nach dem Einreihen. Kein Stopp nötig.

| Teil | Wo | Was |
|---|---|---|
| Abos | `push_subscriptions` (0034) | ein Gerät je Zeile, Schlüssel `endpoint`. Schreiben nur über `upsert_push_subscription` / `delete_push_subscription`. Live: 2 Geräte, 1 Profil. |
| Einstellungen | `notification_prefs` (0034, 0038) | ein Schalter je Kategorie, `quiet_from`/`quiet_to`, `quiet_override_urgent`. Schreiben über `set_notification_prefs`. |
| Vorlagen | `notification_templates` (0036, 0038) | Titel, Text, `deep_link_vorlage`, `urgency`, `ttl_regel`, Platzhalter (Pflicht und optional), Beispieldaten, Beschreibungen, `aktiv`. |
| Einreihen | `notify_enqueue(p_profile, p_kategorie, p_daten, …)` (0038) | liest die Vorlage, rendert Titel, Text **und Deep Link** mit `render_vorlage`, schreibt **fertigen** Text in `notification_outbox`. Fehlt ein Wert: Zeile mit `error`, wird nie gesendet. |
| Fälligkeit | Sicht `notification_due` (0039) | nicht gesendet, `not_before` erreicht, Rolle passt (`kategorie_erlaubt`), Schalter an, **Ruhezeit**: `not in_quiet_hours(...) or (urgency = 'high' and quiet_override_urgent)`. Test und Vorschau umgehen Schalter und Ruhezeit. |
| Anstoß | pg_cron `push-dispatch` jede Minute → `push_dispatch_tick()` | ruft nur, wenn etwas fällig ist, per `pg_net` `api/dispatch-push.js` mit Geheimnis aus dem Vault. |
| Versand | `api/dispatch-push.js` (Vercel, `web-push`, Service-Key) | `push_claim` → bündeln → an alle Geräte des Profils → `push_mark_sent`; 404/410 löscht das Gerät. Ohne Gerät gilt die Zeile als erledigt (bleibt als In-App-Eintrag). |
| Deep Link | `sw.js:98` `notificationclick` → `routeDeepLink` | `#termin=<id>` wird schon verstanden (`app.js` `deepLinkZiel`). |
| Ruhezeiten außerhalb der Nacht | – | Nachrichten in der Ruhezeit bleiben liegen und gehen danach raus (die Sicht lässt sie einfach noch nicht durch). |
| Testnachricht | `send_test_notification()` | reiht Kategorie `test` an **sich selbst** ein (Vorlage „🔔 Testnachricht“, Deep Link `#ein=mitteilungen`), umgeht Schalter und Ruhezeit. Verlangt nur Anmeldung und ein eigenes Gerät, **keine Rolle**. |

**Nebenbefund, außerhalb dieses Pakets, aber wichtig:** Kein Trigger und kein Cron-Job
ruft `notify_enqueue` auf. In der Datenbank rufen es nur `send_test_notification` und
`send_preview_notification`. Die Outbox enthält ausschließlich Test- und Vorschauzeilen.
Das heißt: **keine** der automatischen Nachrichten (neue Strafe, Erinnerung 24 h / 2 h vor
Meldeschluss, kurzfristige Absage, Termin geändert …) wird heute je erzeugt, obwohl die
Seite Mitteilungen sie mit Schaltern anbietet. Die manuelle Erinnerung aus P1 wäre die
erste echte Nachricht über diesen Weg. Vorschlag: als eigenes Paket vormerken (Frage 11).

---

## d) Rechte heute

Live geprüft (`has_function_privilege`, `has_table_privilege`, `pg_policies`).
Rollen in `user_roles`: `player`, `coach`, `treasurer`, `admin` (live vergeben sind nur
`admin` und `player`). Die Admin-Simulation im UI ändert nur die Anzeige; der Server
prüft immer die echte Rolle.

| Handlung | UI | Server | Lücke |
|---|---|---|---|
| Push-Texte lesen | Einstieg und Ansicht nur `Roles.isAdmin()` | RLS `notif_tpl_sel`: nur `is_admin()` | keine |
| Beschreibungen lesen (Unterzeilen in Mitteilungen) | alle | `notification_infos()`: nur Beschreibung, Dringlichkeit, Rolle, ohne Vorlagen | keine, so gewollt |
| Push-Texte ändern | nur Admin | `set_notification_template`: `is_admin()`-Prüfung; Tabelle ohne Schreib-Policy, RLS sperrt direktes Schreiben | keine |
| Vorschau an sich senden | nur Admin | `send_preview_notification`: `is_admin()` | keine |
| Vorschauen löschen | nur Admin | nur eigene Zeilen | keine |
| **Testnachricht** | **alle** Rollen (Zustand „aktiv“) | jede angemeldete Person mit Gerät | **Ziel 2 verletzt: UI und Server** |
| **`notify_enqueue` direkt** | – | ausführbar für `anon` **und** `authenticated` (Standardrecht `PUBLIC`, nie entzogen) | **kritisch**: jeder, auch ohne Anmeldung mit dem öffentlichen Schlüssel, kann an **jedes** Profil eine Nachricht jeder Kategorie einreihen, mit **frei gewählten Platzhalterwerten** (z. B. `{termin_titel}` = beliebiger Text, also faktisch Freitext), und mit `p_vorschau = true` Schalter, Rolle und Ruhezeit umgehen. Verstößt direkt gegen Ziel 3. |
| **`push_claim`, `push_mark_sent`, `push_mark_error`** | – | ausführbar für `anon` und `authenticated` | **kritisch**: liefert fertige Texte fremder Nachrichten (Strafbeträge) und kann Zustellungen unterdrücken |
| **Sicht `notification_due`** | – | `select` für `anon` und `authenticated`, ohne `security_invoker`, gehört `postgres` → umgeht die RLS der Outbox | **kritisch**: alle fälligen Nachrichten aller Nutzer lesbar |
| `push_subscription_ok/_failed`, `push_dispatch_tick`, `notification_outbox_cleanup`, `kategorie_erlaubt` | – | ausführbar für `anon` und `authenticated` | mittel bis gering: Gerät löschen (braucht den Endpoint), Versand anstoßen, Rollen fremder Profile abfragen |
| `profiles_ensure_notification_prefs` | – | ausführbar, ist aber eine Triggerfunktion | gering, gehört trotzdem zugemacht |

Tabellen sind sauber: volle Tabellenrechte für `anon`/`authenticated` (Supabase-Standard),
aber RLS an und nur `select`-Policies auf eigene Zeilen bzw. Admin.

---

## e) Erinnerungs-Push: Vorschlag (nicht gebaut)

**Vorlage, neuer Schlüssel `rueckmeldung_nachfrage`** (die Nachfrage des Trainers, getrennt
von der automatischen `rueckmeldung_erinnerung`, damit der Admin beide Texte einzeln pflegt):

| Feld | Vorschlag |
|---|---|
| `titel_vorlage` | `⏳ Bitte zurückmelden: {termin_titel}` (⏳ = „Frist läuft“ im Emoji-System aus 0038) |
| `text_vorlage` | `{datum} {uhrzeit}. Dein Trainer wartet noch auf deine Zu- oder Absage.` |
| `deep_link_vorlage` | `#termin={termin_id}` (Routing vorhanden) |
| `platzhalter` | `termin_titel, datum, uhrzeit, meldeschluss, termin_id` |
| `platzhalter_optional` | `uhrzeit, meldeschluss` (Termine ohne Uhrzeit oder Meldeschluss gibt es) |
| `urgency` | `high`, siehe Frage 4 |
| `ttl_regel` | `bis_zeitpunkt` (bis Anpfiff), gedeckelt 24 h |
| Schalter | **kein neuer**: gilt der bestehende Schalter „Erinnerung an Zu- oder Absage“ (`rueckmeldung_erinnerung`). Die Seite Mitteilungen bleibt dadurch unverändert. |
| Rolle | `kategorie_rolle` → `spieler` |
| Beschreibungen | Empfänger „Spieler ohne Rückmeldung zu diesem Termin.“, Auslöser „Ein Trainer tippt im Rückmeldungen-Blatt auf „Push senden“.“ |

**Auslösen:** eine RPC `send_rsvp_reminder(p_event uuid, p_nur_zaehlen boolean)`,
`security definer`, Prüfung `has_role('coach') or has_role('admin')` mit der echten Rolle.
Der Aufrufer übergibt **nur die Termin-ID**, keinen Text und keine Empfänger. Mit
`p_nur_zaehlen = true` liefert sie die Zahlen für den Bestätigungsschritt, ohne zu senden;
so stimmen Anzeige und Versand garantiert überein.

**Empfänger:** alle Spieler des Vereins ohne Zeile in `rsvps` mit Status für diesen
Termin (dieselbe Regel wie `ohneRueckmeldung()` im Frontend; Termine haben keinen eigenen
Kader), die mit einem Profil verknüpft sind **und** ein Gerät haben. Spieler ohne Gerät
werden nur gezählt, es wird für sie **keine** Zeile eingereiht. Ruhezeit, Schalter und
Rolle prüft wie immer `notification_due`; `notify_enqueue` bekommt `p_vorschau = false`
fest verdrahtet.

Rückgabe, und daraus die Meldung im UI: `offen` (gesamt), `ausgenommen` (Urlaub/verletzt,
falls Frage 1 mit ja), `gesendet` (eingereiht an Spieler mit Gerät und eingeschaltetem
Schalter), `ohne_abo`, `abgeschaltet` (Gerät da, Schalter aus), `naechste_moeglich`.
„Gesendet an N“ heißt „eingereiht“; liegt jemand in seiner Ruhezeit, kommt es dort später an.
Das sagt die Meldung ehrlich: „An 3 gesendet · 2 ohne Push-Abo“ und, falls zutreffend,
„1 hat Erinnerungen abgeschaltet“.

**Sendesperre, Vorschlag:** je Termin höchstens **eine Nachfrage alle 12 Stunden**, egal
welcher Trainer, und keine mehr nach Beginn des Termins. Technisch über den
`dedup_key = 'nachfrage:' || termin || ':' || profil || ':' || <12-h-Fenster>` (die Outbox
hat ihn ohnehin als `unique`) plus eine Prüfung in der RPC auf die letzte Nachfrage zu
diesem Termin. Begründung: Bei einem Termin mit Meldeschluss 24 h vorher reichen zwei
Nachfragen (am Vortag, am Spieltag) und die Sperre hält zwei Trainer davon ab, dieselbe
Mannschaft im Minutenabstand doppelt anzuschreiben. Das UI zeigt bei aktiver Sperre statt
„Push senden“ den Hinweis „Erinnert um 18:04 · wieder ab 06:04“. Kürzere oder längere
Fenster sind eine Zahl in der RPC (Frage 5).

**Fundstellen von „erinnern“ heute:**

| Stelle | Code | Was passiert heute | P1 |
|---|---|---|---|
| Rückmeldungen-Blatt, Fuß | `app.js:1120`, Handler `1146` | „Alle N erinnern“ → Teilen-Fenster mit `erinnernText()` (Namen der Offenen) | wird „Push senden“ |
| Rückmeldungen-Blatt, Fuß | `app.js:1122`, Handler `1147` | „Teilen“ → Teilen-Fenster mit `rueckmeldeText()` (Zugesagt, Abgesagt, Offen) | siehe Frage 2 |
| Terminkarte, Feld „Zusagen · N offen ›“ | `app.js:2367` | öffnet das Blatt | unverändert, führt aufs neue Blatt |
| Übersicht, Aufgabenzeile „Ohne Rückmeldung · Erinnerung senden“ (Trainer, Spielertrainer, Admin) | `app.js:594` | öffnet das Blatt | unverändert, führt aufs neue Blatt |
| Klick-Handler `data-remind` | `app.js:6186` | toter Handler, kein Element erzeugt ihn mehr (steht schon in Paket A) | siehe Frage 3 |

Einen eigenen „erinnern“-Knopf im Hero gibt es nicht mehr; Hero und Spielertrainer-Zeile
laufen beide über die Aufgabenzeile ins Blatt. P1 ändert damit nur das Blatt.

---

## Fragen an dich

1. **Urlaub und verletzt ausnehmen?** Empfehlung: **ja**, beide ausnehmen. Die App wertet
   Urlaub überall wie verletzt („nicht einsatzbereit“). Der Bestätigungsschritt zeigt dann
   „3 Spieler ohne Rückmeldung · 1 im Urlaub/verletzt ausgenommen“. Die Kachel „Offen“ im
   Blatt zählt weiter alle, wie heute.
2. **Welcher Text für „Teilen“?** Heute hat das Blatt schon zwei Knöpfe: „Alle N erinnern“
   (Text mit den Namen der Offenen) und „Teilen“ (Gesamtübersicht Zugesagt/Abgesagt/Offen).
   Dein Auftrag sagt „Teilen“ mit dem bisherigen Text (Namen der Offenen). Würde ich nur
   zwei Knöpfe bauen, fiele die Gesamtübersicht weg. Empfehlung: **drei Knöpfe**: „Push
   senden“ (Hauptknopf, volle Breite), darunter „Teilen“ (= bisheriger Erinnern-Text,
   wörtlich unverändert) und „Übersicht teilen“ (= heutiges „Teilen“, unverändert).
   Alternative: zwei Knöpfe, und die Gesamtübersicht entfällt ausdrücklich.
3. **Toten Handler `data-remind` in P1 mit entfernen** oder wie geplant in Paket A?
   Empfehlung: in P1, weil er der alte Erinnern-per-Teilen-Weg ist.
4. **Dringlichkeit der Nachfrage:** `high` (kommt auch in der Ruhezeit an, wenn der
   Spieler „Dringendes trotzdem zustellen“ an hat; der Hinweistext auf der Seite
   Ruhezeiten nennt „die Erinnerung an die Rückmeldung“ schon als dringend) oder
   `normal` (wartet immer bis zum Ende der Ruhezeit)? Empfehlung: `high`.
5. **Sendesperre 12 Stunden je Termin**, keine Nachfrage nach Beginn. Einverstanden?
6. **Push-Texte als Unterseite der Einstellungen** (`#ein=pushtexte`, dahinter die
   Bearbeiten-Seite). Das kehrt Entscheidung 7 vom 26.09. („Sprünge bleiben“) um, die
   Vorlage verlangt es aber. Einverstanden? Die alte Ansicht `pushkatalog` würde dann
   auf die Unterseite umgeleitet, damit alte Links nicht ins Leere gehen.
7. **Vorschau im Bearbeiten:** Die Vorlage zeigt „Sperrbildschirm | Hell“ statt iOS und
   Android nebeneinander. Empfehlung: drei Segmente „Sperrbildschirm | Hell | Android“,
   damit die Android-Vorschau nicht verloren geht. Alternative: genau wie Vorlage, Android
   entfällt ausdrücklich.
8. **Empfängertexte unter den Push-Texten:** Die Vorlage schreibt bei „Termin geändert“
   „An alle Zugesagten“; tatsächlich geht die Nachricht laut Katalog an alle Spieler.
   Empfehlung: Kurztexte je Kategorie im Frontend, aber **wahr** („An alle Spieler“).
9. **Diagnose:** „Protokoll dieses Starts“ und „Protokoll vorheriger Start“ als eigene
   dritte Ebene (wie Push-Text bearbeiten). Einverstanden?
10. **Reihenfolge gegenüber PLAN.md:** Dieses Paket übernimmt dort Schritt 3
    (Inhaltsabgleich der Unterseiten), Schritt 4 (F9) und Schritt 5 (F14). Kader F11–F13
    und Paket A kommen danach. Ich trage das in PLAN.md im ersten Commit ein.
    Einverstanden?
11. **Fehlende automatische Nachrichten** (Abschnitt c): als eigenes Paket vormerken?

---

## f) Dateien und Migrationen je Teilpaket

| Teilpaket | Dateien | Migration |
|---|---|---|
| **E1** Rechte serverseitig | `supabase/migrations/0042_push_rechte.sql` (neu), `PLAN.md` (Stand) | **0042**: `revoke execute … from public, anon, authenticated` auf `notify_enqueue`, `push_claim`, `push_mark_sent`, `push_mark_error`, `push_subscription_ok`, `push_subscription_failed`, `push_dispatch_tick`, `notification_outbox_cleanup`, `kategorie_erlaubt`, `profiles_ensure_notification_prefs`, `render_vorlage` (nur `anon`); Sicht `notification_due`: `revoke select from anon, authenticated`; `send_test_notification`: zusätzlich `is_admin()`-Prüfung. Gegenprobe im `do`-Block (Rechte per `has_function_privilege` prüfen), Rückbau-Teil auskommentiert. Von dir eingespielt. Der Dispatcher nutzt den Service-Key und pg_cron läuft als `postgres`; beide sind vom Entzug nicht betroffen. |
| **E2** UI-Rechte | `app.js`, `index.html` (Build), `.design-sync/shots/pushpruef.mjs` bzw. `einpruef.mjs` (Fall „Testnachricht nur Admin“) | – |
| **E3** Hauptseite | `app.js`, `styles.css`, `index.html`, `einpruef.mjs`, Vorlagen verschieben nach `reference/app/einstellungen-v2/`, Soll-Ausschnitte unter `reference/soll/` | – |
| **E4** Mitteilungen | `app.js`, `styles.css`, `index.html`, `einpruef.mjs`, `prefspruef.mjs` | – |
| **E5** Ruhezeiten | `app.js`, `styles.css`, `index.html`, `einpruef.mjs` | – |
| **E6** Kalender-Abo | `app.js`, `styles.css`, `index.html`, `einpruef.mjs`, ggf. `abopruef.mjs` | – |
| **E7** Spielplan BFV (F9) | `app.js`, `styles.css`, `index.html`, `einpruef.mjs` | – |
| **E8** Push-Texte Liste | `app.js`, `styles.css`, `index.html`, `einpruef.mjs`, `deeplinkpruef.mjs` (neue Route), `landkartenregeln.mjs` (Name des neuen Knotens) | – |
| **E9** Push-Text bearbeiten | `app.js`, `styles.css`, `index.html`, `einpruef.mjs`, `landkartenregeln.mjs` | – |
| **E10** Diagnose | `app.js`, `styles.css`, `index.html` (nur Build, das Overlay bleibt), `einpruef.mjs`, `landkartenregeln.mjs` | – |
| **P1** Erinnerungs-Push | `supabase/migrations/0043_rueckmeldung_nachfrage.sql` (neu), `db.js` (`sendRsvpReminder`), `app.js` (Blatt, Bestätigungsschritt, Meldung), `styles.css`, `index.html`, neues Prüfskript `.design-sync/shots/nachfragepruef.mjs` (Teilen-Text alt/neu wörtlich, Zählung, Sperre), `landkartenmodul.mjs` (Stand-in kennt die neue RPC, nur protokollieren) | **0043**: Kategorie in beiden Check-Constraints, Vorlage, `kategorie_rolle`, Zuordnung zum Schalter `rueckmeldung_erinnerung` in `notification_due`, RPC `send_rsvp_reminder` mit Sperre, `grant execute … to authenticated`. Von dir eingespielt. |
| **F14** Design-System | `.design-sync/cards/Ansichten/Einstellungen-und-Profil.html`, `Benachrichtigungs-Schalter.html`, `Benachrichtigungen.html`, `Push-Katalog.html`, `Rueckmeldungen-Blatt.html`, `.design-sync/conventions.md`, `.design-sync/validate.sh`, `.design-sync/NOTES.md`, `PLAN.md` | – |

Hinweise zum Ablauf:
- `app.js` wird in fast jedem Teilpaket geändert; das ist in diesem Paket Kern der Arbeit
  (die Regel „bei app.js stoppen“ galt für Paket L).
- Landkarten-Drift: jede Oberflächenänderung lässt `landkartendrift` neu crawlen; neue
  Knoten (Push-Texte, Bearbeiten, Diagnose) brauchen einen Namen in `landkartenregeln.mjs`,
  sonst wird die Prüfung rot. `landkarte.json` und `landkarte.html` werden dann je
  Teilpaket mit neu erzeugt und mit committet.
- Neue Tokens sind nach erstem Blick nicht nötig (Grün-Abstufungen, Gold, Grau, Rot sind
  vorhanden; die rote Marke „zeitkritisch“ gibt es als `tag-cancelled`). Bestätigt wird
  das erst beim Messen.
- Testkonto mit Testspieler nur für die Messläufe ab E3, danach gelöscht, das Löschen
  per Abfrage bestätigt.
- Build-Kennung je Commit hochzählen (`app.js` `APP_BUILD`, `index.html` `BUILD` und die
  Versions-Query).

---

## Entscheidungen (03.10.2026)

| # | Entscheidung |
|---|---|
| E1 | Hotfix zuerst und allein, eigener Commit. `notify_enqueue` ohne EXECUTE für anon/authenticated; Vorschau nur Admin (serverseitig); `push_claim`, `push_mark_sent`, `push_mark_error` nur service_role; `notification_due` nicht mehr für anon/authenticated, `security_invoker`; Testnachricht nur Admin. Danach Prüfung als anon, Spieler, Trainer, Kassenwart per direktem RPC-Aufruf und Prüfung der Outbox (30 Tage) auf Einträge, die nicht aus der App stammen können. |
| 1 | Urlaub und verletzt werden ausgenommen. |
| 2 | Drei Knöpfe: „Push senden“, „Teilen“ (bisheriger Erinnern-Text), „Übersicht teilen“. |
| 3 | `data-remind` wird in P1 entfernt. |
| 4 | Nachfrage mit **normaler** Dringlichkeit, Ruhezeiten gelten. Liegt der Versand in der Ruhezeit, sagt die Bestätigung „wird um HH:MM zugestellt“. |
| 5 | Sperre 12 Stunden je Termin, keine Nachfrage nach Beginn. Bei aktiver Sperre zeigt der Knopf, wann es wieder geht. |
| 6 | Push-Texte als Unterseite, nur für Admin sichtbar. |
| 7 | Android bleibt in der Vorschau. |
| 8 | Empfängertexte nach dem tatsächlichen Katalog. Abweichungen siehe unten, Entscheidung je Fall durch dich. |
| 9 | Protokolle als 3. Ebene. |
| 10 | Ersetzt die Schritte 3 bis 5 in PLAN.md. |
| 11 | Eigenes Paket „Automatische Mitteilungen“ direkt nach diesem, vor Kader. Bis dahin auf der Seite Mitteilungen ein dezenter Hinweis, dass automatische Nachrichten noch nicht aktiv sind (gehört zu E4). |

Reihenfolge: E1 (Hotfix), E2, E3 bis E10, P1, F14. Weiter nur nach Freigabe je Migration.

## Abweichungen Vorlage ↔ Katalog (Frage 8, zur Entscheidung je Fall)

Katalog = `notification_templates` live, Stand 03.10.2026.

| # | Stelle | Vorlage | Katalog / App | Vorschlag |
|---|---|---|---|---|
| A1 | Push-Texte, „Termin geändert“ | „An alle Zugesagten“ | Empfänger „Alle Spieler.“ | Text: „An alle Spieler“ |
| A2 | Push-Texte, „Neue Termine“ | „An alle“ | „Alle Spieler.“ | Text: „An alle Spieler“ |
| A3 | Push-Texte, „Neue Strafe“ | „An den Spieler“ | „Der betroffene Spieler, sonst niemand.“ | passt sinngemäß, so übernehmen |
| A4 | Push-Texte, „Kurzfristige Absage“ | Name im Singular | Seite Mitteilungen sagt „Kurzfristige Absagen“ | ein Name für beide Seiten; Vorschlag „Kurzfristige Absagen“ |
| A5 | Push-Text bearbeiten, Feld Titel | „{anzahl} kurzfristige Absagen“ | „🚨 {anzahl} kurzfristige Absagen“ (Emoji-System 0038) | Feld zeigt den echten Text mit Emoji |
| A6 | Push-Text bearbeiten, Feld Text und Chips | Platzhalter `{termin}`, fünf Chips | Platzhalter heißt `{termin_titel}`, dazu `{termin_id}` (sechs Chips) | echte Namen; `termin_id` als Chip zeigen oder ausblenden (gehört nur in den Deep Link, nicht in Titel/Text) – Vorschlag: ausblenden |
| A7 | Push-Text bearbeiten, Vorschau | Titel ohne Emoji | Sperrbildschirm zeigt das Emoji | Vorschau rendert den echten Text |
| A8 | Symbol „Neue Strafe“ | Push-Texte: gold „!“ im Kreis; Mitteilungen: gold € | – | in beiden Listen dasselbe Symbol; Vorschlag €  |
| A9 | Push-Texte, Marke „zeitkritisch“ | nur bei den drei gezeigten | live `high` auch bei „Erinnerung an Zu- oder Absage“ und „Termin fällt aus“ | Marke aus dem Katalog (`urgency`), also auch dort |
| A10 | Mitteilungen, Unterzeile „Monatliche Erinnerung an offene Strafen“ | „Höchstens einmal im Monat.“ | „Höchstens einmal im Monat. Standard AUS.“ | Text im Katalog kürzen (Datenänderung, eigene Migration) oder so lassen |
| A11 | Push-Texte, Gruppen | nur TRAINER, SPIELER, je eine Auswahl | dazu KASSE (`zahlung_gemeldet`), „Übersicht nach Meldeschluss“, alle acht Spieler-Kategorien, „Test“, ab P1 die Nachfrage | alle zeigen, Gruppen nach `kategorie_rolle`, „Test“ als eigene Gruppe SYSTEM |

---

## Prüflauf 1 zu 0042 (03.10.2026): Befund

**Ergebnis:** 62 PASS, 5 FAIL bei 67 Fällen (Gegenprobe 0042 bestanden).

**Die 5 FAIL (kategorie_erlaubt, Fälle 8, 21, 34, 47, 58) sind ein Fehler im Prüfskript, kein offenes Recht.**
- Rechte live: eine einzige Signatur `kategorie_erlaubt(uuid,text)`, `proacl = {postgres=X, service_role=X}`, kein PUBLIC, kein anon, kein authenticated.
- Echter Aufruf als anon über PostgREST: `401 · 42501 permission denied for function kategorie_erlaubt`.
- Ursache: `kategorie_erlaubt` ist `STABLE`. In `select count(*) from (select f(...)) x` verwirft der Planer den ungenutzten Ausdruck (Plan: nur `Aggregate → Result`, kein Funktionsaufruf). Ohne Aufruf keine Rechteprüfung. Die übrigen Fälle trafen `VOLATILE`-Funktionen; die bleiben im Plan und wurden richtig abgelehnt.
- Die Gegenprobe in 0042 (`has_function_privilege`) war richtig. 0042b prüft trotzdem über **alle** Signaturen und PUBLIC (proacl samt `acldefault`).
- Prüfskript neu: jeder Fall gibt seinen Wert per `execute … into` an PL/pgSQL zurück.

**67 statt 77:** meine Ankündigung war falsch gerechnet. Das Skript hatte 13 Fälle je Nicht-Admin-Rolle (4 × 13 = 52), 11 für Admin und 4 für service_role, zusammen 67. Es fehlte kein Fall. Das neue Skript hat 166 Fälle.

**Dispatcher-Pfad:** `notification_due` ruft `kategorie_erlaubt(o.profile_id, o.kategorie)` und `in_quiet_hours(...)` auf (Sichtdefinition live). Mit `security_invoker` laufen beide mit den Rechten des Lesenden. `push_claim` und `push_dispatch_tick` sind SECURITY DEFINER (postgres); `api/dispatch-push.js` liest die Sicht nicht direkt, nur über `push_claim`. service_role hat auf beide ausdrücklich EXECUTE (0042 bzw. 0042b). Neue Fälle mit echten Zeilen: fällige Testzeile erscheint in der Sicht und wird von `push_claim` geholt; Zeile ohne passende Rolle bleibt draußen; dieselbe Zeile mit Trainerrolle wird fällig.

## Outbox ab Einführung von notify_enqueue (0038, 25.09.2026)

16 Zeilen, 25.09.2026 16:46 bis 19:51 UTC, alle gesendet, keine mit Fehler.

| Prüfung | Treffer |
|---|---|
| Kategorie weder `test` noch Vorschau (es gibt keinen Erzeuger dafür) | 0 |
| Vorschau eines Nicht-Admins | 0 |
| Testnachricht eines Nicht-Admins | 0 |
| ohne `dedup_key` | 0 |
| `dedup_key` außerhalb der App-Muster (`test-<profil>-<zeit>` aus 0034, `test:<profil>:<zeit>`, `vorschau:<kategorie>:<profil>:<zeit>`) | 0 |
| Profile | 1 (Admin) |

Alle 16 Zeilen lassen sich den Klicks vom 25.09. zuordnen: 3 Testnachrichten, 13 Vorschauen. **Kein Hinweis auf Einträge von außen.** Grenze der Aussage: Wer die Muster nachahmt, fiele nicht auf; ebenso wenig ein missbräuchliches `push_mark_sent` (es gab nie ungesendete Zeilen, die man hätte unterdrücken können).

## Vollinventar nach 0042 (03.10.2026)

Live abgefragt: jede Funktion, Sicht und Tabelle in `public`, auf die anon oder authenticated ein Recht hatten. „Nutzer“ = Fundstelle im Code bzw. in der Datenbank. Urteil **ok** = bleibt, **zu** = 0042b entzieht.

### Funktionen (45)

| Funktion | Nutzer | Begründung | anon | authenticated |
|---|---|---|---|---|
| `has_role(text)` | RLS-Policies fast aller Tabellen, DEFINER-Funktionen | Policy-Funktion | zu | ok |
| `is_admin()` | RLS `profiles`, `user_roles`, `notification_templates` | Policy-Funktion | zu | ok |
| `my_player_id()` | RLS `rsvps`, `player_status` | Policy-Funktion | zu | ok |
| `my_roles()` | `db.js` myRoles, `api/sync-bfv.js` (Token des Nutzers) | eigene Rollen | zu | ok |
| `set_my_player(uuid)` | `db.js` setMyPlayer | Erstzuordnung | zu | ok |
| `set_player_status(uuid,text,text,date)` | `db.js` setPlayerStatus | Prüfung coach/admin oder eigener Spieler | zu | ok |
| `set_lineup_active(uuid)` | `db.js:145` | Prüfung coach/admin | zu | ok |
| `set_ical_url(text)` | `db.js:283` | Prüfung coach/treasurer/admin | zu | ok |
| `my_calendar_token()` | `db.js:301` | eigenes Token | zu | ok |
| `regenerate_calendar_token()` | `db.js:317` | eigenes Token | zu | ok |
| `set_calendar_hint(boolean,boolean)` | `db.js:309` | eigenes Profil | zu | ok |
| `create_fines_batch(jsonb,text)` | `db.js:446` | Prüfung treasurer/admin | zu | ok |
| `confirm_fines(uuid[],text)` | `db.js:453` | Prüfung treasurer/admin | zu | ok |
| `mark_fines_paid(uuid[],text)` | `db.js:460` | Prüfung treasurer/admin | zu | ok |
| `reject_fine(uuid,text)` | `db.js:467` | Prüfung treasurer/admin | zu | ok |
| `cancel_batch(uuid)` | `db.js:473` | Prüfung treasurer/admin | zu | ok |
| `cancel_fine(uuid)` | `db.js:478` | Prüfung treasurer/admin | zu | ok |
| `report_my_payment(text,text)` | `db.js:424` | eigener Spieler | zu | ok |
| `report_my_payment()` | niemand (alte Signatur vor 0040) | keine | zu | **zu** |
| `upsert_push_subscription(…)` | `db.js:327` | eigenes Gerät | zu | ok |
| `delete_push_subscription(text)` | `db.js:337` | eigenes Gerät | zu | ok |
| `set_notification_prefs(jsonb)` | `db.js:361` | eigene Einstellungen | zu | ok |
| `notification_infos()` | `db.js:356` | nur Beschreibungen | zu | ok |
| `send_test_notification()` | `db.js:365` | prüft is_admin() (0042) | zu | ok |
| `send_preview_notification(text)` | `db.js:385` | prüft is_admin() | zu | ok |
| `set_notification_template(…)` | `db.js:378` | prüft is_admin() | zu | ok |
| `delete_preview_notifications()` | `db.js:390` | nur eigene Zeilen | zu | ok |
| `sync_bfv_matches(jsonb)` | `api/sync-bfv.js` mit Service-Key | **keine Rollenprüfung**, legt Termine an und sagt sie ab | **zu** | **zu** (service_role ok) |
| `apply_event_fines()` | pg_cron (postgres) | keine Rollenprüfung, verhängt Strafen | **zu** | **zu** |
| `apply_fine_surcharges()` | pg_cron (postgres) | keine Rollenprüfung, ändert Zuschläge | **zu** | **zu** |
| `compute_deadline(…)` | nur DEFINER-Funktionen (Trigger, apply_event_fines) | intern | zu | zu |
| `my_role()` | niemand (alt) | keine | zu | zu |
| `in_quiet_hours(time,time)` | Sicht `notification_due` | intern | zu | zu (service_role ok) |
| `kategorie_rolle(text)` | `kategorie_erlaubt`, `notification_infos` (beide DEFINER) | intern | zu | zu |
| `render_vorlage(…)` | `notify_enqueue`, `set_notification_template` (beide DEFINER); Frontend rechnet selbst (`katRender`) | intern | (0042) | zu |
| 10 Triggerfunktionen (`events_bump_ical_seq`, `events_set_deadline_at`, `events_set_starts_at`, `fines_set_base_amount`, `fines_settle_surcharge`, `fines_status_audit`, `fines_status_sync`, `handle_new_user`, `rsvp_late_cancel_fine`, `team_settings_refresh_events`) | Trigger | EXECUTE wird nur beim Anlegen des Triggers geprüft, nicht beim Feuern | zu | zu |

Die Push-Funktionen aus 0042 (`notify_enqueue`, `push_*`, `kategorie_erlaubt` …) waren nach 0042 schon zu.

### Tabellen, Sichten, Sequenzen

| Objekt | anon vorher | authenticated vorher | Urteil |
|---|---|---|---|
| alle 17 Tabellen | volle Tabellenrechte (Supabase-Standard), RLS ohne anon-Policy außer `sportstaetten_read` (Rolle PUBLIC, `true`) | volle Rechte, RLS mit Policies | **anon: alles zu** (die App liest vor der Anmeldung nichts: `init()` ruft ohne Sitzung `renderLogin()`, `loadAll()` erst danach). **authenticated: TRUNCATE, REFERENCES, TRIGGER zu** (TRUNCATE unterliegt keiner RLS, kein Nutzer). SELECT/INSERT/UPDATE/DELETE bleiben, die RLS entscheidet. |
| `notification_due` | (0042: zu) | (0042: zu) | ok, nur service_role |
| Sequenzen | anon USAGE/SELECT/UPDATE | – | anon zu |

Spalten-Defaults nutzen nur eingebaute Funktionen (`gen_random_uuid`, `now`), Check-Constraints keine aus `public`.

Default Privileges (Rolle postgres, Schema public) entsprechend: anon nichts auf neue Tabellen und Sequenzen, authenticated kein TRUNCATE/REFERENCES/TRIGGER auf neue Tabellen. Funktionen: seit 0042.

---

## Belege vor dem Einspielen von 0042b (03.10.2026)

### Alle Supabase-Zugriffe im Repo

Gesucht in allen versionierten Dateien außer `node_modules`, `ds-bundle`, `preview` nach `.rpc(`, `.from(`, `rest/v1`, `createClient`, `supabase.co`, `SUPABASE_*`.

| Datei | Schlüssel | Zugriff | Durch 0042b gedeckt |
|---|---|---|---|
| `db.js` (einziger Client der App, `createClient(SUPABASE_URL, SUPABASE_KEY)` aus `config.js`, Publishable Key) | vor der Anmeldung: nur Auth-API (`getSession`, `signIn`, `signUp`), kein Zugriff auf `public`. Danach Nutzer-JWT → Rolle **authenticated** | 23 RPCs (alle in der Soll-Liste), Tabellen `clubs`, `players`, `events`, `fine_catalog`, `fines`, `rsvps`, `lineups`, `sportstaetten`, `player_status`, `fine_status_log`, `profiles`, `user_roles`, `push_subscriptions`, `notification_prefs`, `notification_templates`, `notification_outbox` | ja: RPCs in der Soll-Liste, Tabellen behalten SELECT/INSERT/UPDATE/DELETE für authenticated (Gegenprobe prüft das Lesen aller 17) |
| `app.js` | – | kein eigener Supabase-Zugriff, nur über `DB.*`; Treffer waren `Array.from` | – |
| `sw.js`, `index.html` | – | kein Supabase-Zugriff | – |
| `api/calendar.js` (Abo-Feed `/api/calendar/<token>.ics`) | **service_role** (`SUPABASE_SERVICE_ROLE_KEY`) über `macheSb` in `api/_ical.js` | Tabellen `profiles`, `clubs`, `events`, `sportstaetten` | ja, service_role wird nicht angefasst |
| `api/event.js` (Einzel-ICS `/api/event/<token>/<id>.ics`) | **service_role** (`SUPABASE_SERVICE_ROLE_KEY`) über `macheSb` | Tabellen `profiles`, `clubs`, `events`, `sportstaetten` | ja |
| `api/sync-bfv.js` (Cron 04:00 UTC und Knopf „Jetzt aktualisieren“) | Prüfung der Berechtigung: `my_roles` mit **Nutzer-JWT** (`Authorization: Bearer <token>`; `SUPABASE_ANON_KEY` steht nur im `apikey`-Header und bestimmt keine Rolle) oder `CRON_SECRET`. Danach **service_role** für `clubs` und `sync_bfv_matches` | RPC `my_roles` (authenticated), Tabelle `clubs`, RPC `sync_bfv_matches` | ja: `my_roles` für authenticated in der Soll-Liste, `sync_bfv_matches` für service_role ausdrücklich |
| `api/dispatch-push.js` | **service_role** (`SUPABASE_SERVICE_ROLE_KEY`), Aufruf nur mit `PUSH_DISPATCH_SECRET` | RPCs `push_claim`, `push_mark_sent`, `push_mark_error`, `push_subscription_ok`, `push_subscription_failed`, Tabelle `push_subscriptions` | ja |
| `.design-sync/shots/*.mjs` | keiner | `landkartenmodul.mjs` ersetzt den Client durch eine Attrappe und bricht jeden Request an `*.supabase.co` ab; `icsstub.mjs` setzt einen Stub-Schlüssel und fälscht `fetch`. Die übrigen Treffer sind `Array.from`/`Buffer.from`. Die Skripte mit Testkonto (`pruef`, `heropruef`, `blattpruef`) melden sich über die App an → authenticated. | – |

**Kein Endpunkt nutzt den anon-Schlüssel als Rolle.** Kein Abbruchgrund.

### Umgebungsvariablen in Vercel (Projekt `fasanerie-nord-2`, Ziel Production; nur Namen, Werte nicht gelesen)

`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `CRON_SECRET`, `PUSH_DISPATCH_SECRET`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, alle gesetzt. Dass hinter `SUPABASE_SERVICE_ROLE_KEY` wirklich der Service-Schlüssel steht, belegt der Betrieb: der Abo-Feed liest `profiles` per `calendar_token` (für anon gäbe die RLS nichts her), und seit 0042 darf nur noch service_role `push_claim` aufrufen. Der Smoke-Test (Kalender-Abo, Testnachricht) bestätigt beides nach 0042b.

### Sequenzen und Tabellenrechte

- In `public` gibt es **keine Sequenz** und keine `serial`-/Identity-Spalte; alle Schlüssel sind `uuid` mit `gen_random_uuid()`. Kein Insert braucht ein Sequenzrecht; `revoke all on all sequences … from anon` wirkt derzeit auf nichts und deckt nur künftige ab.
- 0042b entzieht authenticated ausdrücklich `truncate, references, trigger` auf allen Tabellen und lässt `select, insert, update, delete` stehen (einzelne Rechte, nicht `all`). Die Gegenprobe prüft beides: kein TRUNCATE/REFERENCES/TRIGGER mehr, SELECT auf allen 17 Tabellen noch da.

### Missbrauchsprüfung Termine, Strafen, Zuschläge

**Termine (57):** 37 `manuell` (ohne `bfv_uid`, angelegt 05.06. bis 07.08. in der App), 20 `bfv`.
- Alle 20 BFV-Termine sind beim Erstimport (07.08. 07:05 UTC) oder in einem nächtlichen Sync-Lauf (04:07 bzw. 04:27 UTC, Cron `0 4 * * *`) angelegt worden; bei allen ist `code = 'bfv:' || bfv_uid`, wie es nur `sync_bfv_matches` schreibt.
- Kein manueller Termin trägt einen BFV-Code oder eine `bfv_uid`.
- Die 7 abgesagten BFV-Termine wurden jeweils am Morgen nach dem Spiel im Sync-Lauf abgesagt (Spiel 23.08. → 24.08. 04:07, …, Spiel 27.09. → 28.09. 04:27). Das ist der normale Ablauf: der BFV-Feed enthält vergangene Spiele nicht mehr. Eine Ausnahme, Spiel 09.08., abgesagt am 13.08. 13:00 UTC, fällt auf den Tag von Migration 0027 (BFV-Bearbeitung), also auf einen manuellen Sync bei der Entwicklung.
- Grenze: ein Fremdaufruf mit gefälschter Liste wäre beim nächsten echten Sync überschrieben worden (Status zurück auf `geplant`, Fremdtermine abgesagt). Es gibt keine Termine, deren Entstehung sich nicht einem Sync-Lauf oder der App zuordnen lässt.

**Strafen (304):** 86 automatisch, 218 von Hand.
- 72 der automatischen liegen im 15-Minuten-Takt von `apply_event_fines`. Die 14 übrigen: 13 vom 12.06. 16:48:09 UTC (Einspielen von Migration 0008, die die Funktion einmal ausführt) und 1 „Verspätete Absage“ vom 12.06. 16:51:45, sekundengleich mit der Absage des Spielers (Trigger `rsvp_late_cancel_fine`).
- Keine doppelte Strafe je Spieler, Termin und Art.
- 29 Handstrafen ohne Batch: alle vor dem Einspielen von 0030 (letzte 05.09. 13:43 UTC), danach nur noch über `create_fines_batch`.
- Statusprotokoll (264 Einträge): jeder Eintrag hat einen Nutzer; keine Bestätigung, Rücknahme oder Stornierung durch jemanden ohne Kassenwart- oder Admin-Rolle.

**Zuschläge:** bei allen 246 offenen Strafen entspricht `surcharge` der Formel aus `apply_fine_surcharges` zum Stand `surcharge_updated_at`; kein Wert über dem Maximum (10 €), kein Datum in der Zukunft. `surcharge_updated_at` ist ein Datum ohne Uhrzeit, ein Lauf außerhalb von 03:15 UTC wäre daran nicht zu erkennen; da die Funktion nur die Formel anwendet, hätte ein Fremdaufruf denselben Wert geschrieben.

**Ergebnis: kein Hinweis auf Missbrauch** bei Terminen, Strafen und Zuschlägen.

---

## Ergebnis E1 (03.10.2026)

| Prüfung | Ergebnis |
|---|---|
| Gegenprobe 0042 | bestanden |
| Gegenprobe 0042b | bestanden |
| `supabase/checks/0042_rechtepruef.sql` | 166/166 PASS |
| anon per HTTP (14 RPCs, 8 Tabellen/Sichten) | 22/22 mit 42501 abgelehnt |
| Smoke-Test am Handy (Anmelden, Zu-/Absage, Kalender-Abo, Einzel-ICS, BFV-Sync, Kasse, Strafe verhängen und stornieren, Testnachricht) | 8/8, Testnachricht angekommen |
| Pflichtliste | 18/18 |

Offen aus E1: das Anlegen eines neuen Kontos (Trigger `handle_new_user`) ist erst mit dem Testkonto ab E3 geprüft.
