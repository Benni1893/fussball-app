# Gerätetest vor dem Start

Stand: Build `2026-10-18-C`, Produktion https://fasanerie-nord-2.vercel.app, nach der Startbereinigung vom 18.10.2026

## Geräte

Jede Zeile hat vier Kästchen, eins je Gerät.

| Kürzel | Gerät |
|---|---|
| **iS** | iPhone, Safari |
| **iH** | iPhone, Home-Bildschirm-App |
| **AC** | OnePlus, Chrome |
| **AA** | OnePlus, installierte App |

`—` heißt: auf diesem Gerät nicht relevant.

## Rollen

| Kürzel | Rolle |
|---|---|
| **Sp** | Spieler |
| **Tr** | Trainer |
| **Kw** | Kassenwart |
| **ST** | Spielertrainer (Spieler + Trainer) |

## 0. Vorbereitung: wer testet als was

Es gibt nur zwei Konten: deins (Spieler, Kassenwart, Admin) und `rascha.k@yahoo.com` (Spieler, ohne Kadereintrag). Lege **keine** Testkonten an.

**Datenstand seit der Bereinigung:** Im Kader steht nur noch **Benjamin Lauck** (dein Eintrag, fit). Es gibt keine Strafen,
keine Zu- oder Absagen und keine Aufstellungen. Die Vorlage „4-3-3 Standard“ ist leer. Termine: alle BFV-Spiele und die
künftigen, von Hand angelegten Trainings. Deshalb:
- Das Kassenbanner zeigt „0,00 €“, „Noch keine Strafen“ und „Nichts offen“.
- Listen (Kasse, Konto › Mannschaft, Rückmeldungen-Blatt, Kader) sind leer oder haben genau einen Eintrag (dich). Das ist so richtig.
- Alles, was du im Test anlegst, betrifft nur dich. Aufräumen siehe Abschnitt 11.

- [ ] **Kw:** Das ist dein Konto, so wie es ist.
- [ ] **Sp, nur Anzeige:** Einstellungen › Rollen › „Ansicht testen als“ › Spieler. Oben erscheint die Leiste „Vorschau als Spieler · nur Anzeige“. Zurück über „Zur Admin-Ansicht“.
- [ ] **Tr und ST:** Unter Einstellungen › Rollen gibst du dir selbst die Rolle Trainer. Damit bist du Spielertrainer. **Am Ende wieder entfernen** (Abschnitt 11).
- [ ] **Tr ohne Spieler:** Es gibt kein Konto dafür. Nur über „Ansicht testen als“ › Trainer ansehen, ohne Aktionen.

## 1. Anmeldung und Einladungslink

| Rolle | Ich tue | Ich sehe | iS | iH | AC | AA |
|---|---|---|---|---|---|---|
| alle | Abmelden, dann erneut anmelden | Anmeldeseite mit Wappen; nach der Anmeldung die Übersicht | ☐ | ☐ | ☐ | ☐ |
| alle | Auf der Anmeldeseite „Datenschutz“, dann „Impressum“ tippen | Beide Seiten öffnen ohne Anmeldung; „‹ Zurück zur App“ führt zurück | ☐ | ☐ | ☐ | ☐ |
| Tr/Admin | Einstellungen › Rollen › Einladungslink kopieren, in einem **privaten Tab** öffnen | „Konto erstellen · Einladung von …“ mit Name, Kassenwart-Haken, E-Mail, Passwort. **Nicht absenden.** | ☐ | — | ☐ | — |
| — | Einladungslink mit geändertem Token im privaten Tab öffnen | „Anmelden“ mit Hinweis „nicht mehr gültig“, keine Registrierung möglich | ☐ | — | ☐ | — |
| alle | „Passwort vergessen?“ mit deiner eigenen Adresse | Hinweis „Reset-Link gesendet“, Mail kommt an. Absender und Link notieren (offener Punkt Mail-Absender, siehe Startbereitschaft) | ☐ | — | ☐ | — |

## 2. Übersicht mit Hero

| Rolle | Ich tue | Ich sehe | iS | iH | AC | AA |
|---|---|---|---|---|---|---|
| Sp | Übersicht öffnen | Hero mit nächstem Termin, Zu-/Absage, Meldeschluss-Countdown; darunter „Danach“, „Mein Status“; ganz unten das Kassenbanner **ohne Pfeile** | ☐ | ☐ | ☐ | ☐ |
| Tr/ST | Übersicht öffnen | Hero mit Zusagezähler; Aufgabenblock; Tipp auf den Zähler öffnet das Rückmeldungen-Blatt | ☐ | ☐ | ☐ | ☐ |
| Kw | Kassenbanner unten: oben auf den Betrag, dann auf „Nichts offen“ tippen | Kasse „Eingegangen“ bzw. „Offen“, beide mit Leerzustand. Bei gemeldeten Strafen: „X € zu prüfen ›“ führt nach „Zu prüfen“ | ☐ | ☐ | ☐ | ☐ |
| alle | Nach unten ziehen (Pull-to-Refresh) | Münze dreht sich, Daten laden neu, nichts springt | ☐ | ☐ | ☐ | ☐ |
| alle | Gerät drehen, dann zurück | Kein waagerechtes Scrollen, Kopf und Navigation bleiben fest | ☐ | ☐ | ☐ | ☐ |

## 3. Kalender: Zusage, Absage, Abo

**Achtung:** Nur Termine verwenden, deren Meldeschluss noch **nicht** vorbei ist. Eine Absage nach Meldeschluss erzeugt automatisch eine Strafe („kurzfristige Absage“) und eine Mitteilung an die Trainer.

| Rolle | Ich tue | Ich sehe | iS | iH | AC | AA |
|---|---|---|---|---|---|---|
| Sp/ST | Bei einem Termin mit offenem Meldeschluss „Zusage“, dann „Absage“ mit Grund, dann wieder „Zusage“ | Knopf wechselt sofort, Grund erscheint unter der Karte. **Aufräumen:** am Ende den ursprünglichen Stand wiederherstellen | ☐ | ☐ | ☐ | ☐ |
| alle | Reiter Spiele / Training / Alle | Liste filtert; Spielkarte dunkel, Training hell | ☐ | ☐ | ☐ | ☐ |
| alle | Ort einer Karte antippen | Google Maps öffnet mit der Adresse | ☐ | ☐ | ☐ | ☐ |
| alle | **iOS:** Einstellungen › Kalender abonnieren › „Im iPhone-Kalender abonnieren“ | iOS fragt nach dem Abonnieren; Termine erscheinen im Kalender. **Entfernen:** iOS-Einstellungen › Kalender › Accounts › Abonnierte Kalender › löschen | ☐ | ☐ | — | — |
| alle | **Android:** „Link kopieren“, dann im Browser **calendar.google.com** › Weitere Kalender › „Per URL“ einfügen (die Google-Kalender-App kann das nicht) | Termine erscheinen nach einiger Zeit in der App. **Entfernen:** calendar.google.com › Einstellungen › Kalender › Abo entfernen | — | — | ☐ | ☐ |
| alle | Einzeltermin › Menü ⋯ › In Kalender übernehmen | .ics-Datei öffnet bzw. wird geladen | ☐ | ☐ | ☐ | ☐ |
| Tr/ST | „Neuer Termin“ anlegen (Training, nächste Woche) | Termin steht im Kalender. **Aufräumen:** ⋯ › „Termin löschen“. Achtung: Neue Termine lösen nach 30 min eine Sammel-Mitteilung „neue Termine“ aus, also sofort wieder löschen | ☐ | — | ☐ | — |

## 4. Katalog

| Rolle | Ich tue | Ich sehe | iS | iH | AC | AA |
|---|---|---|---|---|---|---|
| Sp | Katalog öffnen | Liste mit Beträgen, kein Bearbeiten | ☐ | ☐ | ☐ | ☐ |
| Kw | Eine Strafe öffnen, Betrag ändern, speichern, dann den **alten Betrag wieder eintragen** | Neue Zahl steht sofort, ohne Neuladen | ☐ | — | ☐ | — |

## 5. Konto: Strafen und Kassenbanner

| Rolle | Ich tue | Ich sehe | iS | iH | AC | AA |
|---|---|---|---|---|---|---|
| Sp | Konto › Ich | Kontobanner mit eigenem offenen Betrag, Zahlknopf (PayPal), Chips Offen/Gemeldet/Bezahlt | ☐ | ☐ | ☐ | ☐ |
| Sp | Konto › Mannschaft | Kassenbanner: „In der Kasse“, Balken mit „% der Strafen bezahlt“, „Noch offen“; bei gemeldeten Strafen einzeilig „davon X € gemeldet“; keine Pfeile; darunter Chips und Liste | ☐ | ☐ | ☐ | ☐ |
| Kw | Konto › Mannschaft, alle drei Stellen im Banner antippen | Eingegangen / Offen / Zu prüfen; Pfeile sichtbar; jeder Tipp trifft beim ersten Mal | ☐ | ☐ | ☐ | ☐ |
| Sp | „Zahlen“ (PayPal) antippen | PayPal.me öffnet mit Betrag. **Nicht zahlen**, zurück zur App | ☐ | ☐ | ☐ | ☐ |

## 6. Kasse (Kassenwart): ein Durchlauf mit dir selbst

Alles mit **1,00 € an dich selbst**. Die stornierte Strafe bleibt als „storniert“ im Verlauf stehen und zählt in keiner Summe; ganz löschen geht in der App nicht.

| Rolle | Ich tue | Ich sehe | iS | iH | AC | AA |
|---|---|---|---|---|---|---|
| Kw | Kasse › „Strafe verhängen“ › dich wählen › freie Strafe 1,00 € › speichern | Knopf „1 Strafe · 1,00 € speichern“; Strafe steht unter „Offen“ | ☐ | — | ☐ | — |
| Kw | Mitteilung abwarten (Push an) | „💸 Neue Strafe: 1,00 €“; Tipp öffnet Konto › Ich | — | ☐ | ☐ | ☐ |
| Sp | Konto › Ich › „Zahlung melden“ › bar | Strafe steht unter „Gemeldet“, im Banner „davon 1,00 € gemeldet“ | ☐ | — | ☐ | — |
| Kw | Kasse › Zu prüfen › „Bestätigen“ | Strafe unter „Eingegangen“, Kassenstand +1,00 € | ☐ | — | ☐ | — |
| Kw | Eingegangen › Strafe antippen › „Buchung rückgängig“, dann unter Offen › Menü ··· › „Storno“ | Strafe wieder offen, danach storniert; Summen wie vorher. **Aufräumen erledigt** | ☐ | — | ☐ | — |

## 7. Trainer und Aufstellung (Tr/ST, Trainerrolle aus Abschnitt 0)

| Rolle | Ich tue | Ich sehe | iS | iH | AC | AA |
|---|---|---|---|---|---|---|
| Tr/ST | Mehr › Trainer › nächstes Spiel | Spielauswahl, Platz mit Formation, Bank | ☐ | ☐ | ☐ | ☐ |
| Tr/ST | Formation wechseln, Spieler auf Positionen setzen, tauschen | Scheiben bewegen sich, Bank zählt, kein waagerechtes Scrollen | ☐ | ☐ | ☐ | ☐ |
| Tr/ST | „Aufstellung speichern“ | Gespeichert-Hinweis. **Aufräumen:** „Aufstellung löschen“ | ☐ | — | ☐ | — |
| Tr/ST | Mehr › Kader | Liste mit Status, Status eines Spielers ansehen (nicht ändern) | ☐ | ☐ | ☐ | ☐ |

## 8. Rückmeldungen-Blatt und „Push senden“ (Tr/ST)

**Achtung:** „Push senden“ geht an **alle** mit offener Rückmeldung zu diesem Termin. `rascha.k@yahoo.com` hat keinen Kadereintrag und steht deshalb nicht in der Liste; offen bist nach der Bereinigung nur du. Prüfe die Liste trotzdem vor dem Senden. Vorher im Blatt nachsehen, wer offen ist; sonst nur ansehen und nicht senden.

| Rolle | Ich tue | Ich sehe | iS | iH | AC | AA |
|---|---|---|---|---|---|---|
| Tr/ST | Hero › Zusagezähler antippen | Blatt mit Balken, Kacheln Zusagen/Absagen/Offen, Liste mit Absagegründen | ☐ | ☐ | ☐ | ☐ |
| Tr/ST | Wischen, daneben tippen, Drehen | Blatt schließt sauber, Navigation kommt zurück | ☐ | ☐ | ☐ | ☐ |
| Tr/ST | Nur wenn allein offen: „Push senden“ › bestätigen | „An 1 gesendet“, danach Sperre mit Zeit des letzten Versands; „⏳ Bitte zurückmelden …“ kommt an | — | ☐ | ☐ | ☐ |

## 9. Einstellungen

| Rolle | Ich tue | Ich sehe | iS | iH | AC | AA |
|---|---|---|---|---|---|---|
| alle | Zahnrad › Mitteilungen | Schalter je Kategorie, Sammelschalter, Ruhezeiten | ☐ | ☐ | ☐ | ☐ |
| Sp | Profil › Mein Status › „Angeschlagen“ | Ohne Einwilligung: Blatt „Gesundheitsstatus erlauben“, „Erlauben“ grau bis zum Alters-Haken; Link „Mehr dazu“ springt zu 3d. Dann erlauben, Status setzen. **Aufräumen:** Status „Fit“, Einwilligung im Profil wieder ausschalten, falls vorher aus | ☐ | ☐ | ☐ | ☐ |
| alle | Profil › Position ändern, dann zurück | Neue Position im Profil und im Kader | ☐ | — | ☐ | — |
| alle | Profil › Datenschutz / Impressum | Seiten öffnen, `[E-MAIL]` noch Platzhalter, vor dem Start eintragen | ☐ | ☐ | ☐ | ☐ |
| alle | Einstellungen › Diagnose | Build `2026-10-17-B` | ☐ | ☐ | ☐ | ☐ |
| alle | Feld antippen (z. B. Suche in der Kasse), tippen, Tastatur schließen | Kein Zoom, Navigation verschwindet mit Tastatur und kommt zurück; **kein grüner Kasten um die Seite** (Fix 17.10.) | ☐ | ☐ | ☐ | ☐ |

## 10. Push: Erlaubnis und Empfang

**iOS:** Push gibt es nur in der Home-Bildschirm-App (iOS 16.4 oder neuer). In Safari steht ein Hinweis statt des Schalters.

| Rolle | Ich tue | Ich sehe | iS | iH | AC | AA |
|---|---|---|---|---|---|---|
| alle | Einstellungen › Mitteilungen › „Mitteilungen erlauben“ | Systemabfrage, danach Status „aktiv“ | — | ☐ | ☐ | ☐ |
| alle | „Testnachricht senden“ | Innerhalb einer Minute „🔔 Testnachricht“, auch bei gesperrtem Bildschirm | — | ☐ | ☐ | ☐ |
| alle | Testnachricht antippen, App war geschlossen | App startet direkt auf Einstellungen › Mitteilungen | — | ☐ | ☐ | ☐ |
| alle | Testnachricht antippen, App lief im Hintergrund | Kein zweites Fenster, Sprung an dieselbe Stelle | — | ☐ | ☐ | ☐ |
| alle | Mitteilungen in der App ausschalten | Status „aus“; das Gerät bekommt nichts mehr (Testnachricht ist dann nicht möglich) | — | ☐ | ☐ | ☐ |
| alle | Wieder einschalten | Status „aktiv“; Testnachricht kommt | — | ☐ | ☐ | ☐ |

## 11. Aufräumen am Ende

- [ ] Trainerrolle bei dir wieder entfernen (Einstellungen › Rollen), falls du sie nicht behalten willst
- [ ] Zu-/Absagen auf den ursprünglichen Stand
- [ ] Status „Fit“, Gesundheits-Einwilligung wie vorher
- [ ] Testtermin gelöscht, Aufstellung gelöscht
- [ ] Teststrafe storniert (Abschnitt 6)
- [ ] Kalender-Abos auf den Testgeräten entfernt, falls nicht gewollt
- [ ] Katalogbetrag zurückgesetzt
- [ ] „Ansicht testen als“ beendet („Zur Admin-Ansicht“)

Mitteilungen, die beim Test entstehen, löscht die App selbst nach 90 Tagen aus dem Postausgang.
