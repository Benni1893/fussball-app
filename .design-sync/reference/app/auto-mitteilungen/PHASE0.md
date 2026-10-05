# Paket „Automatische Mitteilungen“: Phase 0

Stand 05.10.2026. Nur gelesen, nichts geändert. Quellen: Live-Datenbank (nur `select`:
`notification_templates`, Trigger, Funktionsquelltexte, Spalten), Migrationen 0034 bis
0042b, `api/dispatch-push.js`.

## Ausgangslage

- **Versandweg steht und ist erprobt:** `notify_enqueue` rendert die Vorlage und schreibt
  eine fertige Zeile in `notification_outbox`; pg_cron ruft jede Minute
  `push_dispatch_tick()`, das nur bei fälligen Zeilen `api/dispatch-push.js` anstößt.
  Die Sicht `notification_due` entscheidet über Fälligkeit: Rolle (`kategorie_erlaubt`),
  Schalter (`notification_prefs`), Ruhezeit (`in_quiet_hours`, `urgency = 'high'` darf mit
  `quiet_override_urgent` durch). Der Dispatcher bündelt Zeilen mit gleichem `bundle_key`
  je Profil, indem er die **Texte aneinanderhängt** und den Titel der ersten Zeile nimmt.
- **Kein Erzeuger:** kein Trigger und kein Cron-Job ruft `notify_enqueue` auf.
- **Nützlich vorhanden:** `fine_status_log` protokolliert jede Statusänderung einer
  Strafe samt `changed_by = auth.uid()` (Trigger `fines_status_audit`); `events` hat
  `deadline_at` (gepflegt per Trigger), `starts_at`, `status`, `quelle` (`bfv`/`manuell`),
  `updated_at` (nur bei echten Änderungen, `events_bump_ical_seq`).

## 1. Je Kategorie: Auslöser, Empfänger, Platzhalter, Link, Dringlichkeit

| Kategorie | Auslöseereignis | Empfänger laut Katalog (Rolle) | Platzhalter | Deep Link | Dringlichkeit, TTL |
|---|---|---|---|---|---|
| `strafe_neu` | Zeile in `fines` mit Status `offen` entsteht: von Hand (`create_fines_batch`, auch mehrere Spieler/Strafen je Aufruf), automatisch zum Anpfiff (`apply_event_fines`) oder sofort bei verspäteter Rückmeldung (`rsvp_late_cancel_fine`) | der betroffene Spieler (spieler) | betrag, grund, datum | `#strafen=meine` | normal, 7 Tage |
| `zahlung_gemeldet` | `report_my_payment`: alle offenen Strafen eines Spielers → `gemeldet` | alle Kassenwarte (treasurer), gesammelt 15 Min. | anzahl, namen, betrag | `#kasse=pruefen` | normal, 3 Tage |
| `zahlung_bestaetigt` | `confirm_fines` / `mark_fines_paid`: Strafen → `bestätigt` (mehrere je Aufruf) | der Spieler (spieler) | anzahl, betrag | `#strafen=meine` | normal, 7 Tage |
| `zahlung_abgelehnt` | `reject_fine`: `gemeldet` → `offen` mit `reject_reason` | der Spieler (spieler) | betrag, grund | `#strafen=meine` | normal, 7 Tage |
| `strafen_offen` | Zeitpunkt: höchstens einmal im Monat; Strafen `offen` älter als 4 Wochen | der Spieler (spieler), Schalter Standard **aus** | betrag, anzahl, datum | `#strafen=meine` | normal, 7 Tage |
| `termin_neu` | Zeile in `events` entsteht (App oder BFV-Sync), gesammelt 30 Min. je Ersteller | alle Spieler (spieler) | anzahl, liste | `#ansicht=kalender` | normal, 7 Tage |
| `termin_geaendert` | `events` UPDATE: `date`, `time` oder Ort (`location_raw`, `spielstaette`, `adresse`) ändert sich, Termin nicht abgesagt | alle Spieler (spieler); Vorlage nannte „Zugesagte“, A1 vertagt die Logikfrage hierher | termin_titel, datum, aenderung | `#termin={id}` | **high**, bis Termin |
| `termin_abgesagt` | `events.status` → `abgesagt` (App oder BFV-Sync) | alle Spieler (spieler) | termin_titel, datum, uhrzeit, grund (optional) | `#ansicht=kalender` | **high**, bis Termin |
| `rueckmeldung_erinnerung` | Zeitpunkt: 24 h und 2 h vor `deadline_at` | Spieler ohne Rückmeldung (spieler) | termin_titel, datum, uhrzeit, meldeschluss | `#termin={id}` | **high**, bis Meldeschluss |
| `absage_kurzfristig` | `rsvps` → `ab` nach `deadline_at`, vor `starts_at`; gesammelt 10 Min. je Termin | alle Trainer (coach) | anzahl, termin_titel, datum, uhrzeit, namen | `#termin={id}` | **high**, bis Termin |
| `meldeschluss_uebersicht` | Zeitpunkt: direkt nach `deadline_at` | alle Trainer (coach) | termin_titel, datum, uhrzeit, zusagen, absagen, offen | `#termin={id}` | normal, bis Termin |
| `unterbesetzung` | Zeitpunkt: vor Meldeschluss unter der Mindestzahl je Termintyp | alle Trainer (coach) | termin_titel, datum, uhrzeit, zusagen, minimum, offen | `#termin={id}` | **high**, bis Termin |
| `test` | Knopf (vorhanden) | nur der Auslöser | – | `#ein=mitteilungen` | – |

**Lücke `unterbesetzung`:** Die „Mindestzahl je Termintyp“ gibt es nirgends
(`team_settings` hat nur `deadline_spiel_hours`, `deadline_training_hours`). Ohne neue
Spalten (z. B. `min_spiel`, `min_training`) lässt sich die Kategorie nicht bauen
(Frage F4).

**Formate:** Die Beispieldaten mischen „20.09.“ und „20.09.2026“, `uhrzeit` enthält „Uhr“.
Für die Erzeuger braucht es eine kleine SQL-Hilfsfunktion für deutsche Datums- und
Zeitangaben (Europe/Berlin), damit alle Kategorien gleich aussehen. `termin_titel` = beim
Spiel der Gegner, sonst der Titel (wie `summaryFor` im Kalender-Feed).

## 2. Vorschlag je Kategorie

### Gemeinsame Bausteine (eine Migration „Infrastruktur“)

1. **Empfänger-Funktionen** (intern): `profile_fuer_spieler(player_id)` (Profil mit
   `player_id`), `profile_mit_rolle(rolle)` (aus `user_roles`), `profile_alle_spieler()`
   (alle verknüpften Profile). Die Rollenprüfung beim Versand macht weiterhin
   `notification_due`.
2. **Sammler** statt Bündeln im Dispatcher. Das heutige Bündeln hängt Texte aneinander
   und behält den ersten Titel: aus drei Strafen würde „💸 Neue Strafe: 8,00 €“ mit drei
   Texten. Für alle Kategorien mit `{anzahl}`/`{namen}`/`{liste}` schlage ich eine
   interne Tabelle `notification_sammler (kategorie, bezug, profile_id, daten jsonb,
   ausloeser uuid, faellig_ab timestamptz)` vor; ein pg_cron-Job alle 2 Minuten fasst
   fällige Einträge zu **einer** Zeile je Profil zusammen und ruft dann `notify_enqueue`.
   Der Dispatcher bleibt unverändert.
3. **Verfallszeit:** `ttl_regel = 'bis_zeitpunkt'` wirkt heute nur beim Push-Dienst.
   Eine Erinnerung, die wegen der Ruhezeit liegen bleibt, ginge nach dem Meldeschluss
   noch raus. Vorschlag: Spalte `notification_outbox.gueltig_bis`, `notification_due`
   lässt abgelaufene Zeilen weg, der Aufräumjob markiert sie (`error = 'verfallen'`).
4. **Karenz bei Strafen:** `strafe_neu` mit `not_before = now() + 3 Minuten`; wird die
   Strafe vorher storniert oder gelöscht, löscht ein Trigger die noch ungesendete Zeile
   (Sonderfall 3a).

### Je Kategorie

| Kategorie | Erzeuger | Deduplizierung (`dedup_key`) | Bündeln | Ruhezeit / Schalter |
|---|---|---|---|---|
| `strafe_neu` | Trigger `AFTER INSERT` auf `fines` (Status `offen`, nicht `storniert`) | `strafe_neu:<fine_id>` | über den Sammler je Spieler und Aufruf (`batch_id`, bei Auto-Strafen je Termin): mehrere Strafen → ein Text mit Summe | `notification_due` (normal: wartet die Ruhezeit ab) |
| `zahlung_gemeldet` | Trigger auf `fine_status_log` (`to_status = 'gemeldet'`) → Sammler, `faellig_ab = erste Meldung + 15 Min.` | `zahlung_gemeldet:<kassenwart>:<fenster>` | ja, alle Meldungen im Fenster je Kassenwart | normal |
| `zahlung_bestaetigt` | Trigger auf `fine_status_log` (`→ bestätigt`) → Sammler, 1 Min. | `zahlung_bestaetigt:<player>:<paid_at>` | je Spieler und Buchungsvorgang | normal |
| `zahlung_abgelehnt` | Trigger auf `fine_status_log` (`gemeldet → offen` mit Grund) | `zahlung_abgelehnt:<fine_id>:<changed_at>` | nein | normal |
| `strafen_offen` | pg_cron monatlich (z. B. am 1., 18:00 Ortszeit) | `strafen_offen:<player>:<JJJJ-MM>` | – | Schalter Standard aus |
| `termin_neu` | Trigger `AFTER INSERT` auf `events` → Sammler je Ersteller (`auth.uid()`, beim BFV-Sync „bfv“), `faellig_ab = erster + 30 Min.` | `termin_neu:<profil>:<sammel-id>` | ja, `anzahl` + `liste` | normal |
| `termin_geaendert` | Trigger `AFTER UPDATE` auf `events` (Zeit/Ort) → Sammler je Termin mit den **Ausgangswerten**, `faellig_ab = +10 Min.`; beim Ausführen nur senden, wenn sich gegenüber dem Ausgangswert noch etwas unterscheidet | `termin_geaendert:<event>:<sammel-id>` | ja, mehrere Änderungen in 10 Min. → eine Nachricht; zurückgeändert → keine | high (siehe F2 zum BFV-Sync nachts) |
| `termin_abgesagt` | Trigger `AFTER UPDATE` auf `events` (`status → abgesagt`), nur wenn `starts_at > now()` | `termin_abgesagt:<event>` | nein | high |
| `rueckmeldung_erinnerung` | pg_cron alle 5 Min.: Termine, deren `deadline_at` im Fenster [jetzt+24 h, +5 Min.) bzw. [jetzt+2 h, +5 Min.) liegt | `erinnerung:<event>:<player>:24` bzw. `:2` | nein | high, `gueltig_bis = deadline_at` |
| `absage_kurzfristig` | Trigger auf `rsvps` (→ `ab`, nach `deadline_at`, vor `starts_at`) → Sammler je Termin, `faellig_ab = erste Absage + 10 Min.` | `absage_kurzfristig:<event>:<trainer>:<sammel-id>` | ja, `anzahl` + `namen` | high, `gueltig_bis = starts_at` |
| `meldeschluss_uebersicht` | pg_cron alle 5 Min.: Termine mit `deadline_at` in den letzten 5 Min., noch nicht gemeldet | `meldeschluss:<event>:<trainer>` | nein | normal, `gueltig_bis = starts_at` |
| `unterbesetzung` | pg_cron mit der 24-h-Erinnerung: Zusagen < Mindestzahl (setzt F4 voraus) | `unterbesetzung:<event>:<trainer>` | nein | high |

Alle Erzeuger gehen über `notify_enqueue` mit `p_vorschau = false`; Ruhezeiten, Schalter
und Rolle prüft wie bisher allein `notification_due`. Termine in der Vergangenheit und
abgesagte Termine erzeugen nichts (außer `termin_abgesagt` selbst, und nur für künftige).

## 3. Sonderfälle

**a) Strafe storniert kurz nach dem Verhängen.** Karenz von 3 Minuten (`not_before`).
Storno (`cancel_fine`, `cancel_batch` → `storniert`) oder Löschen (z. B. hebt
`rsvp_late_cancel_fine` die Auto-Strafe auf, wenn die Rückmeldung zurückgezogen wird)
löscht die ungesendete Outbox-Zeile bzw. den Sammler-Eintrag. Nach dem Versand: keine
„Strafe aufgehoben“-Nachricht (gibt es im Katalog nicht; bei Bedarf eigene Kategorie).

**b) Termin mehrfach geändert in kurzer Zeit.** Bündeln über den Sammler: 10 Minuten
nach der ersten Änderung eine Nachricht mit dem Endstand gegenüber dem Ausgangswert
(„Anstoß jetzt 14:00 statt 12:30 Uhr“, „Ort: …“). Wird in den 10 Minuten zurückgeändert,
geht nichts raus. Bei Absage innerhalb des Fensters: die Änderung verfällt, es geht nur
`termin_abgesagt`.

**c) Erinnerung 24 h / 2 h nur an Spieler ohne Rückmeldung.** Empfänger = verknüpfte
Spieler ohne Zeile in `rsvps` für den Termin, **ohne** Spieler mit Status Urlaub oder
verletzt (`player_status`), wie für die Nachfrage aus P1 entschieden. Zum Versandzeitpunkt
nicht erneut prüfbar (die Zeile ist fertig gerendert); wer zwischen Einreihen und Versand
antwortet, bekommt sie trotzdem. Abhilfe ohne Dispatcher-Umbau: `gueltig_bis` knapp
halten und das 5-Minuten-Fenster klein; optional später ein Abgleich in `push_claim`.

**d) BFV-Sync in der Nacht (04:00 UTC = 06:00 Ortszeit im Sommer).** Der Sync aktualisiert
bei jedem Lauf alle BFV-Termine; `updated_at` ändert sich aber nur bei echten Änderungen.
Er sagt außerdem **jedes vergangene Spiel am Morgen danach ab** (der Feed enthält es nicht
mehr). Folgen ohne Gegenmaßnahme: eine Absage-Push für jedes gespielte Spiel und
Terminänderungs-Pushs um 06:00, die als `high` mit „Dringendes trotzdem zustellen“
(Standard an) die Ruhezeit durchbrechen. Vorschlag: Absagen nur für künftige Termine;
Änderungen und neue Termine aus dem Sync mit `not_before` = nächstes Ende der Ruhezeit
bzw. 08:00 Ortszeit, oder als `normal` (Frage F2).

**e) Wiederholung und Doppelläufe.** Jeder Erzeuger trägt einen `dedup_key`; die Outbox
hat ihn `unique`, `notify_enqueue` macht `on conflict do nothing`. Ein Cron-Lauf, der
zweimal kommt, oder ein Trigger, der zweimal feuert, erzeugt keine zweite Nachricht.

## 4. Frage an dich: Wer eine Aktion selbst auslöst, bekommt keine Nachricht?

Beispiel: Der Kassenwart trägt sich selbst eine Strafe ein; ein Spieler, der zugleich
Kassenwart ist, meldet eine Zahlung und wäre selbst Empfänger von „Zahlungen zu prüfen“;
ein Trainer ändert einen Termin und bekäme „Termin geändert“.

| | Für „keine Nachricht an den Auslöser“ | Wider |
|---|---|---|
| Nutzen | Der Auslöser weiß es schon; eine Push wäre Rauschen und wirkt wie ein Fehler. | Wer für sich selbst einträgt, erhält keinen Beleg; bei Strafen „im Namen“ eines anderen Geräts (z. B. Tablet am Platz) fehlt die Bestätigung auf dem eigenen Handy. |
| Konsistenz | Üblich in Team-Apps. | In-App-Liste (Outbox als Quelle) zeigt den Vorgang dann auch nicht, wenn er gar nicht erst eingereiht wird. |
| Technik | Auslöser ist bekannt: `fine_status_log.changed_by`, in Triggern `auth.uid()`, im Sammler das Feld `ausloeser`. Ausschluss = `profile_id <> ausloeser`. | Bei Cron-Erzeugern (Erinnerung, Übersicht) gibt es keinen Auslöser; dort greift die Regel nicht. Beim BFV-Sync ebenfalls nicht. Automatische Strafen (`apply_event_fines`, `rsvp_late_cancel_fine`) laufen ohne bzw. mit dem Spieler selbst als `auth.uid()`: Die verspätete Rückmeldung löst der Spieler aus, er bekäme seine Strafe dann **nicht** gemeldet. Das spricht für eine Ausnahme bei Auto-Strafen. |
| Testbarkeit | Gut prüfbar per SQL in einer zurückgerollten Transaktion: Aktion als Profil A (`set local role authenticated` + Claims) → keine Outbox-Zeile für A, eine für B. | Jede Ausnahme (Auto-Strafen) braucht eigene Fälle. |

**Mein Vorschlag:** Ja, der Auslöser bekommt keine Nachricht, **außer** bei automatisch
entstandenen Strafen (Auto-Strafe zum Anpfiff, verspätete Rückmeldung): dort gilt immer
der betroffene Spieler. Die Regel steht an einer Stelle (Empfänger-Funktion), damit sie
später leicht änderbar ist.

## Weitere Fragen

- **F2 BFV-Sync:** Sollen Änderungen und neue Termine aus dem nächtlichen Sync eine Push
  auslösen? Vorschlag: ja, aber frühestens 08:00 Ortszeit (bzw. Ende der persönlichen
  Ruhezeit, auch bei „Dringendes trotzdem zustellen“), Absagen nur für künftige Termine.
- **F3 `termin_geaendert`:** an alle Spieler (wie Katalog und A1-Text) oder nur an
  Zugesagte und Offene (Absagende interessiert die neue Uhrzeit meist nicht)? Vorschlag:
  Zugesagte und Offene; Text dann „An alle außer Absagen“.
- **F4 `unterbesetzung`:** Mindestzahl je Termintyp als neue Spalten in `team_settings`
  (`min_spiel`, `min_training`, leer = Kategorie aus) und eine Eingabe dafür (Einstellungen
  oder Kader)? Oder die Kategorie bis dahin weglassen? Vorschlag: Spalten anlegen, Eingabe
  im Einstellungs-Paket nach dem Claude-Design-Review, bis dahin leer = keine Nachricht.
- **F5 `termin_neu` aus dem BFV-Sync:** Neue Spiele aus dem Sync melden? Vorschlag: ja,
  gebündelt je Sync-Lauf, frühestens 08:00.
- **F6 Urlaub/verletzt** auch bei der automatischen Erinnerung ausnehmen (wie bei der
  Nachfrage aus P1)? Vorschlag: ja.

## 5. Rechte

Nach der Regel aus 0042 (Default Privileges ohne EXECUTE, ausdrückliches `grant`):

- Alle neuen Funktionen (`profile_fuer_spieler`, `profile_mit_rolle`, Sammler-Flush,
  Cron-Erzeuger, Triggerfunktionen, Datums-Hilfsfunktion) sind `SECURITY DEFINER` mit
  Eigentümer `postgres`, **ohne** `grant` an anon oder authenticated; pg_cron und Trigger
  laufen ohnehin als Eigentümer. `service_role` nur, wo ein Server-Aufruf vorgesehen ist
  (keiner geplant).
- Neue Tabelle `notification_sammler`: RLS an, **keine** Policy, `revoke all … from anon,
  authenticated` (die Default Privileges geben authenticated sonst SELECT/INSERT/UPDATE/
  DELETE; RLS würde sperren, das `revoke` macht es eindeutig).
- `notification_outbox.gueltig_bis`: keine Rechteänderung; `outbox_sel` (eigene Zeilen)
  bleibt.
- Gegenprobe in jeder Migration über alle Signaturen (Muster 0042b) plus Prüfskript.

**Prüfskript-Fälle** (`supabase/checks/0043_auto_pruef.sql` o. ä., Muster
`0042_rechtepruef.sql`, alles in zurückgerollten Untertransaktionen):
- anon, Spieler, Trainer, Kassenwart, Admin: keine neue Funktion ausführbar, Sammler nicht lesbar.
- Je Kategorie ein Auslöser mit echten Zeilen → genau die erwarteten Outbox- bzw.
  Sammler-Zeilen, richtige Empfänger, gerenderter Text ohne Fehler, richtiger Deep Link.
- Selbstauslöser (F1): keine Zeile für den Auslöser, Ausnahme Auto-Strafe.
- Storno in der Karenz → Zeile weg; nach der Karenz → Zeile bleibt.
- Termin zweimal geändert in 10 Min. → eine Nachricht; zurückgeändert → keine.
- BFV: vergangenes Spiel abgesagt → keine Nachricht; künftiges → eine.
- Erinnerung: Spieler mit Rückmeldung, Urlaub, verletzt → keine Zeile.
- Ruhezeit: Zeile entsteht, ist aber nicht fällig; `high` mit Override fällig.
- Verfall: Zeile mit `gueltig_bis` in der Vergangenheit erscheint nicht in `notification_due`.
- Doppellauf eines Cron-Erzeugers → keine zweite Zeile.

## 6. Dateien und Migrationen

**Nummern:** 0043 ist für P1 und die Textkorrekturen reserviert, P1 ruht aber mit dem
Einstellungs-Paket. Wird „Automatische Mitteilungen“ zuerst eingespielt, liefe 0044 vor
0043. Das ginge technisch (die Dateien sind unabhängig), ist aber verwirrend, und beide
ändern die Sicht `notification_due`: wer zuletzt kommt, muss die Änderung des anderen
enthalten. **Vorschlag:** Nummern in der Reihenfolge des Einspielens. Dieses Paket bekommt
die nächste freie Nummer zum Zeitpunkt des Baus; P1 rückt dann nach (PLAN.md wird
angepasst). Keine Zusammenlegung mit P1: P1 hängt am Rückmeldungen-Blatt und damit am
Design-Review, dieses Paket nicht.

**Aufteilung** in einzeln prüfbare Teilpakete, je eine Migration:

| Teil | Inhalt | Dateien |
|---|---|---|
| AM1 Infrastruktur | Empfänger-Funktionen, Datumshilfe, `notification_sammler` + Flush-Cron, `gueltig_bis` + `notification_due`, Selbstauslöser-Regel | Migration n, `supabase/checks/<n>_auto_pruef.sql` |
| AM2 Kasse | `strafe_neu` (mit Karenz und Storno), `zahlung_gemeldet`, `zahlung_bestaetigt`, `zahlung_abgelehnt` | Migration n+1, Prüfskript erweitert |
| AM3 Termine | `termin_neu`, `termin_geaendert`, `termin_abgesagt` inkl. BFV-Regeln | Migration n+2, Prüfskript |
| AM4 Rückmeldung | `rueckmeldung_erinnerung`, `absage_kurzfristig`, `meldeschluss_uebersicht`, `unterbesetzung` (falls F4) | Migration n+3, Prüfskript |
| AM5 | `strafen_offen` monatlich; `AUTO_MITTEILUNGEN_AKTIV = true` in `app.js` (Hinweis weg), Build-Kennung | Migration n+4, `app.js`, `index.html`, `sw.js`, `einpruef.mjs` |

Außerdem: `.design-sync/reference/app/einstellungen-kader/PLAN.md` (Stand, Nummern),
`.design-sync/conventions.md` (Muster „Erzeuger über Sammler, dedup_key, gueltig_bis“),
`.design-sync/NOTES.md` (Prüfskript). `api/dispatch-push.js` bleibt unverändert.

Keine Migration wird von mir eingespielt; jede kommt mit Gegenprobe zur Freigabe.
