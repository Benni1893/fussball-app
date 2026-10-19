# Abschluss Nachtlauf 19.10.2026

Alles Gepushte war vorher grün geprüft. Echtdaten (Benjamin Lauck, Termine) sind unverändert. Gelöscht wurden nur das Konto von Rascha und die Testdaten.

## Was live ist

**Produktion:** https://fasanerie-nord-2.vercel.app mit Build `2026-10-18-E`. Bestätigt nach jedem Push.

| Commit | Inhalt |
|---|---|
| `9b76048` | Teil A Einführung je Rolle, Teil A2 „So geht's“, Migration 0074 |
| `4d909e5` | Ehemalige Spieler nicht mehr mitzählen, Migration 0075 (nur Datenbank, Build bleibt) |
| `c1243d5` | Produktionstest mit Testkonto, Skript und Aufnahmen |
| (dieser Commit) | Teil B: Doku `STARTTAG.md`, `NOTES.md` und dieser Bericht |

Die Migrationen sind in der Produktion eingespielt. Beide haben vorher ihre Gegenprobe bestanden:

| Migration | Was | Prüfung |
|---|---|---|
| 0074 | neue Tabelle `einfuehrung_gesehen` | 12 von 12 PASS |
| 0075 | Ehemalige Spieler werden nicht mehr mitgezählt | 9 von 9 PASS |

Vor 0075 habe ich die drei geänderten Funktionen gesichert, lokal in `supabase/cleanup/backup-2026-10-19/`.

Die Regel „vor jeder Migration eine Sicherung“ kam erst mit deiner zweiten Nachricht. 0074 war da schon eingespielt. Es ist aber nur eine neue, leere Tabelle, rückgängig mit `drop table public.einfuehrung_gesehen`.

**Prüfungen vor dem Push:**
- Pflichtliste, alle 30 Skripte grün, in der LF-Kopie. Dazu kommen die neue Prüfung der Einführung, validate, check-conventions und der Build.
- Gegen den Entwurf gemessen: höchstens 2 px Abweichung, verursacht durch den 1-px-Rand der Ausschnitte.
- Produktionstest mit Testkonto in Chromium und WebKit, je 12 von 12 grün. Testkonto und Testspieler sind danach vollständig gelöscht, nachgeprüft mit 0 Zeilen in allen Tabellen.

## Teil A: Einführung

Die Einführung erscheint einmal nach Freigabe und Onboarding, je Rolle genau wie im Entwurf:

| Rolle | Seiten |
|---|---|
| Spieler | 8 |
| Trainer ohne Kadereintrag | 8 |
| Kassenwart | 9 |
| Spielertrainer | 9 |

- Mehrere Rollen werden ohne doppelte Seiten zusammengesetzt.
- Bekommt jemand später eine neue Rolle, sieht er beim nächsten Öffnen nur deren Seiten und „Alles bereit“.
- „Überspringen“ zählt als gesehen. Der Merker liegt in der Datenbank je Konto und Teil.
- Die Seite „Zum Home-Bildschirm“ erscheint nur außerhalb der Home-Bildschirm-App.
- Auf der Seite „Mitteilungen“ steht auf dem iPhone in Safari ein Hinweis statt des Knopfs.

**Abweichungen vom Entwurf** (Begründung in `.design-sync/concepts/einfuehrung/PLAN.md`):
- Der Katalog zeigt die ersten 5 Posten des echten Katalogs statt der Beispielposten.
- Die Seite „Mitteilungen“ entfällt, wenn Mitteilungen auf dem Gerät schon an sind.
- Auf der Seite „Termine abonnieren“ steht die Karte des erkannten Handys oben, wie im bestehenden Abo-Blatt.

**Auch du siehst die Einführung:** Dein Konto hatte noch nichts gesehen. Beim nächsten Öffnen kommt sie deshalb einmal für Spielertrainer plus Kasse, denn als Admin gelten Trainer- und Kassenrechte. „Überspringen“ beendet sie sofort.

## Teil A2: So geht's

- **Ort:** Einstellungen › Info › „So geht's“.
- **Einführung ansehen:** Trainer und Admin sehen zusätzlich die vier Einführungen der Rollen.
- **13 Fragen:** nach Rolle gefiltert, du als Admin siehst alle. Jede Antwort ist an Code und Datenbank geprüft. Die Texte stehen in `.design-sync/concepts/einfuehrung/FAQ.md`.
- **Kontakt:** unten „Frage nicht dabei?“ mit teamkabine-app@gmx.de.

## Fix: Ehemalige Spieler

Nach „Aus der Mannschaft entfernen“ oder „Konto löschen“ bleibt der Kadereintrag als „Ehemaliger Spieler“ stehen.

**Behoben, weil es eindeutige Fehler derselben Art waren:**

| Stelle | Fehler vorher |
|---|---|
| `apply_event_fines` | Ehemalige hätten bei jedem Spiel und Training „keine Rückmeldung“ als Strafe bekommen. |
| `notify_cron_rueckmeldung` | Die „Übersicht nach Meldeschluss“ an die Trainer zählte Ehemalige als offen. |
| `send_rsvp_reminder` | „Push senden“ im Rückmeldungen-Blatt zählte Ehemalige als offen. |

**Geprüft und in Ordnung, ohne Änderung:**

| Stelle | Warum in Ordnung |
|---|---|
| Push-Erinnerungen (24 h und 2 h vor Meldeschluss) | Gehen nur an Konten. Ein Ehemaliger hat keins mehr. |
| Monatliche Strafenerinnerung | Geht nur an Konten. |
| Neue Termine, geänderte Termine, Ausfall | Gehen nur an Konten. |
| Status abgelaufen | Der Status wird beim Entfernen gelöscht. |
| Rückmeldungen-Blatt, Zusagezähler, Aufstellung, Kader-Info, Kader | Die App lädt Ehemalige getrennt (`DEMO.ehemalige`). Diese Ansichten nutzen nur die aktiven Spieler. |
| Kassen-Summen | Enthalten die offenen Strafen der Ehemaligen, so gewollt. Sie bleiben offen und lassen sich bezahlen oder verbuchen. Im Prüfskript nachgewiesen. |

**Unklar, nicht geändert (siehe Fragen):**
- Der Mahnzuschlag (`apply_fine_surcharges`) läuft bei offenen Strafen von Ehemaligen weiter.
- Mehrere Ehemalige heißen alle „Ehemaliger Spieler“ und sind in der Kasse nicht zu unterscheiden.

## Teil B

1. **Konto `rascha.k@yahoo.com` gelöscht.**
   - Vorher geprüft: kein Kadereintrag, keine Zusagen, keine Strafen, kein Bezug in Protokoll, Kasse oder Einladungen.
   - Gelöscht aus Supabase Auth samt Identität, Profil, Rolle und Mitteilungs-Einstellungen. Danach überall 0 Zeilen, es gibt nur noch dein Konto.
   - Sicherung der Zeilen lokal in `supabase/cleanup/backup-2026-10-19/`.
2. **Künftige Termine abgehakt** in `NOTES.md` und `STARTTAG.md`.
   - Neu seit gestern: Um 06:27 Uhr hat der BFV-Abgleich ein Spiel eingetragen, das Auswärtsspiel bei VfB Sparta München am 18.04.2027.
   - Um 08:00 Uhr kam dazu „📅 1 neuer Termin“ an dein Handy. Das ist der normale Abgleich und hat nichts mit meiner Arbeit zu tun.
3. **Ablauf mit einem Link:** Antworten unten.
4. **Doku:**
   - „Trainer festlegen“ ist ersetzt durch den Ablauf mit einem Link: neue Tabelle in `STARTTAG.md`, Kurzfassung in `NOTES.md`.
   - Einführung, „So geht's“ und der Fix sind als erledigt eingetragen.
   - Offen bleiben die Verträge zur Auftragsverarbeitung, der Test der Passwort-Mail, der Gerätetest und „Fehlt in der App“.
   - Die kaputten USB-Pfade (`D:asanerie…`) sind korrigiert.

### Antworten zum Ablauf mit einem Link

**Klappt es heute, wenn du nur den Spieler-Link teilst?**
- Ja. Jeder registriert sich, landet unter „Offene Anfragen“, und du gibst frei.
- Die Mitteilung „Neue Anfrage“ geht an dich als Admin und an jeden Trainer.
- Einschränkung: Ein Trainer, der **nicht mitspielt**, bekommt bei der Freigabe zwingend einen Kadereintrag. Er zählt dann bei Zusagen mit und bekommt automatische Strafen. „Ich spiele nicht mit“ gibt es nur beim Trainer-Link (siehe Frage 1).

**Wer vergibt die erste Trainerrolle, und wo genau?**
- Du als Admin, nach der Freigabe der Person.
- Der Weg: Einstellungen (Zahnrad) › Verwaltung › „Rollen“ › Mitglieder › Person antippen › Schalter „Trainer“.
- Die Person bekommt die Mitteilung „Du bist jetzt Trainer.“ Beim nächsten Öffnen sieht sie den Trainer-Teil der Einführung.

**Darf ein Trainer die Trainerrolle geben und nehmen, auch sich selbst?**
- Ja. Jeder Trainer darf „Trainer“ bei anderen ein- und ausschalten.
- Sich selbst die Rolle nehmen geht nach der Rückfrage „Dir selbst diese Rolle nehmen?“.
- „Admin“ vergibt nur der Admin. „Kassenwart“ darf sich niemand außer dem Admin selbst geben.

**Gibt es einen Schutz gegen null Trainer?**
- Nur teilweise. Die Datenbank verlangt „Mindestens ein Konto muss Trainer oder Admin bleiben“. Das gilt auch beim Entfernen und Löschen von Konten.
- Weil du Admin bist, könnten alle Trainerrollen abgenommen werden, und es gäbe null Trainer. Die Leitung bliebe dann bei dir.
- Folge: Ohne Trainerrolle bekommt niemand die Trainer-Mitteilungen (kurzfristige Absagen, Übersicht nach Meldeschluss, Status abgelaufen). Sie gehen nur an die Rolle Trainer, nicht an den Admin. Siehe Frage 3.

**Funktionieren zwei Trainer gleichzeitig ohne Fehler?**
- **Freigaben:** Die Anfrage wird beim Freigeben gesperrt. Gibt der Zweite dieselbe Anfrage frei, kommt „Keine offene Anfrage.“, es entsteht nichts doppelt.
- **Push:**
  - „Neue Anfrage“ und die Trainer-Mitteilungen gehen an jeden Trainer einzeln.
  - „Push senden“ hat eine Sperre von 12 Stunden je Termin, egal welcher Trainer sendet. Die Spieler werden also nicht doppelt erinnert.
- **Aufstellung:**
  - Mehrere Aufstellungen je Spiel sind erlaubt, aktiv ist immer genau eine. Das sichert die Datenbank ab.
  - Bearbeiten zwei Trainer **dieselbe** Aufstellung gleichzeitig, gewinnt still das letzte Speichern, ohne Warnung (siehe Frage 4).
  - Lieblingsformationen liegen je Gerät.

**Was müsste geändert werden?**

Nichts davon ist für den Start zwingend:

| # | Änderung | Dateien | Aufwand |
|---|---|---|---|
| a | Bei der Freigabe „Ohne Kadereintrag (spielt nicht mit)“ anbieten. Dann brauchst du den Trainer-Link gar nicht mehr. | Migration: `anfrage_freigeben` mit neuem Parameter, setzt `spielt_mit = false`. App: Freigabe-Blatt (`freigabeOeffnen`). Prüfskript. | 2 bis 3 Std. |
| b | Regel „mindestens ein Trainer“, zusätzlich zur Regel „Trainer oder Admin“. | Migration: Prüfung in `rolle_setzen`, `mitglied_entfernen` und `konto_loeschen`. Prüfskript. | ca. 1 Std. |
| c | Warnung, wenn eine Aufstellung inzwischen von jemand anderem gespeichert wurde. | `saveLineup` in `db.js` prüft `updated_at`. Hinweis in `app.js`. | ca. 2 Std. |

## Fehlt in der App

Details in `.design-sync/concepts/einfuehrung/PLAN.md`:

| # | Was fehlt | Vorschlag | Aufwand |
|---|---|---|---|
| 1 | ~~Ehemalige bekommen Auto-Strafen~~ | behoben (0075) | – |
| 2 | Kadereintrag ohne Konto entfernen oder anlegen | neue RPC und Knopf im Kader | 0,5 bis 1 Tag |
| 3 | Betrag einer eingetragenen Strafe ändern | heute nur stornieren und neu anlegen | ca. 0,5 Tag |
| 4 | Datenauskunft in der App | heute per Mail. Dazu ein Anker `#rechte` in der Datenschutzerklärung | ca. 0,5 Tag |
| 5 | Kassenwart gibt die Kasse selbst ab | heute macht das ein Trainer | 2 bis 3 Std. |
| 6 | „Testnachricht senden“ für alle | heute nur Admin | ca. 1 Std. |

## Fragen an dich

1. **Trainer, der nicht mitspielt, beim Ablauf mit einem Link:** Soll ich bei der Freigabe „Ohne Kadereintrag“ einbauen (a, 2 bis 3 Std.)? Oder bleibt dafür der Trainer-Link, nur für dich als Admin?
2. **Mahnzuschlag bei Ehemaligen:** Sollen offene Strafen eines ausgetretenen Spielers weiter jede Woche teurer werden? Heute werden sie es, bis maximal 10 € Zuschlag.
3. **Schutz „mindestens ein Trainer“:** Willst du die zusätzliche Regel (b)? Heute ist null Trainer möglich, solange du Admin bist. Die Trainer-Mitteilungen kämen dann bei niemandem an.
4. **Gleichzeitiges Bearbeiten einer Aufstellung:** Reicht „das letzte Speichern gewinnt“, oder soll eine Warnung her (c)?
5. **Ehemalige in der Kasse:** Sollen sie unterscheidbar sein, zum Beispiel „Ehemaliger Spieler (Nr. 7)“ oder mit Austrittsdatum? Heute heißen alle gleich.
6. **Weitere Fragen für „So geht's“:** Soll ich diese 5 Vorschläge einbauen?
   - Verletzt oder Urlaub eintragen
   - Termin anlegen oder absagen
   - Aufstellung erstellen und teilen
   - Strafe verhängen
   - „Noch nicht freigegeben“
7. **Fehlt in der App:** Welche der Punkte 2 bis 6 soll ich bauen, und in welcher Reihenfolge?

## Was du auf dem iPhone testen sollst

1. **Einführung:** Die App vom Home-Bildschirm öffnen.
   - Die Einführung erscheint einmal: Spielertrainer plus Kasse, bis zu 12 Seiten (5 Trainer, 4 Kasse, dazu Mitteilungen, Termine abonnieren und Alles bereit).
   - Durchwischen bzw. „Weiter“. Die Bilder sind scharf, nichts ist abgeschnitten.
   - „Überspringen“ beendet sie.
   - Die App schließen und neu öffnen: Die Einführung kommt **nicht** wieder.
2. **Mitteilungen in der Einführung:** In der Home-Bildschirm-App steht der Knopf „Mitteilungen erlauben“, außer Mitteilungen sind schon an, dann fehlt die Seite. In Safari (nicht Home-Bildschirm) steht stattdessen der Hinweis.
3. **Seite „Termine abonnieren“:** „Zum Kalender hinzufügen“ öffnet den iPhone-Kalender mit dem Abo-Dialog.
4. **So geht's:** Einstellungen › „So geht's“.
   - Fragen auf- und zuklappen.
   - Ein Link führt hin, „‹ Zurück“ wieder zurück.
   - „Einführung ansehen“ und eine Rolleneinführung öffnen, dann „Überspringen“: Du landest wieder auf „So geht's“.
   - Die Mail-Adresse öffnet die Mail-App.
5. **Service Worker:** Im Test stürzte nur Playwright-WebKit unter Windows mit dem echten Service Worker nach der Anmeldung ab. Das ist eine Grenze des Testwerkzeugs. Auf dem iPhone bitte trotzdem einmal anmelden und prüfen, dass die App normal lädt.
6. **Aus dem Gerätetest** (`.design-sync/GERAETETEST-START.md`): mindestens Abschnitt 1, 2, 10 und 11.
