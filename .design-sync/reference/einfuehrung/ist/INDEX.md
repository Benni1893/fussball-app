# Referenz für Claude Design: Einführung, Ist-Stand der App

Erzeugt mit `.design-sync/shots/einfuehrungsbilder.mjs` am 18.10.2026, 02:32:53.
Stand-in ohne Datenbank: erfundene Mannschaft „SV Musterhausen 2“, 16 Spieler, mehrere Termine, offene, gemeldete und bezahlte Strafen.
Breite 390 px, Faktor 2. Ganze Seiten als `<rolle>_<ansicht>.png`, offene Blätter im Bildschirmausschnitt, Bausteine als `baustein_<name>.png`.

Rollen: Spieler · Trainer (ohne Spielerrolle) · Kassenwart · Spielertrainer (Spieler + Trainer) · Neues Mitglied (Einführung).

| Datei | Rolle | Zu sehen |
|---|---|---|
| `spieler_uebersicht.png` | Spieler | Übersicht mit Hero (nächster Termin, Zu-/Absage), Danach, Mein Status, Kassenbanner |
| `spieler_kalender.png` | Spieler | Kalender mit Terminkarten und Zusage/Absage |
| `spieler_kalender-abo.png` | Spieler | Blatt „Termine abonnieren“ (iPhone / Android) |
| `spieler_mein-status.png` | Spieler | Mein Status: Blatt „Voraussichtlich bis“ mit Datum und Notiz |
| `spieler_konto-ich.png` | Spieler | Konto, Reiter Ich: Kontobanner, Chips, eigene Strafen |
| `spieler_konto-mannschaft.png` | Spieler | Konto, Reiter Mannschaft: Kassenbanner, Chips, Strafenliste des Teams |
| `spieler_einstellungen.png` | Spieler | Einstellungen, Übersicht |
| `spieler_einstellungen-mitteilungen.png` | Spieler | Einstellungen › Mitteilungen |
| `spieler_einstellungen-ruhezeiten.png` | Spieler | Einstellungen › Ruhezeiten |
| `spieler_einstellungen-kalender.png` | Spieler | Einstellungen › Kalender abonnieren |
| `spieler_einstellungen-profil.png` | Spieler | Einstellungen › Profil |
| `trainer_uebersicht.png` | Trainer (ohne Spielerrolle) | Übersicht mit Hero (nächster Termin, Zu-/Absage), Danach, Mein Status, Kassenbanner |
| `trainer_kalender.png` | Trainer (ohne Spielerrolle) | Kalender mit Terminkarten und Zusage/Absage |
| `trainer_kalender-abo.png` | Trainer (ohne Spielerrolle) | Blatt „Termine abonnieren“ (iPhone / Android) |
| `trainer_konto-mannschaft.png` | Trainer (ohne Spielerrolle) | Konto, Reiter Mannschaft: Kassenbanner, Chips, Strafenliste des Teams |
| `trainer_trainer-spiel-waehlen.png` | Trainer (ohne Spielerrolle) | Trainer-Ansicht: Spiel wählen, Kader-Kachel, Vorlagen |
| `trainer_trainer-vorlagen.png` | Trainer (ohne Spielerrolle) | Trainer-Ansicht: Menü einer Vorlage |
| `trainer_kader.png` | Trainer (ohne Spielerrolle) | Kader mit Kennzahlen und Status je Spieler |
| `trainer_einladung-anfragen.png` | Trainer (ohne Spielerrolle) | Rollen verwalten: Einladung, Offene Anfragen, Mitglieder, Protokoll |
| `trainer_anfrage-freigeben.png` | Trainer (ohne Spielerrolle) | Blatt Anfrage freigeben mit Kader-Zuordnung |
| `trainer_einstellungen.png` | Trainer (ohne Spielerrolle) | Einstellungen, Übersicht |
| `trainer_einstellungen-mitteilungen.png` | Trainer (ohne Spielerrolle) | Einstellungen › Mitteilungen |
| `trainer_einstellungen-ruhezeiten.png` | Trainer (ohne Spielerrolle) | Einstellungen › Ruhezeiten |
| `trainer_einstellungen-kalender.png` | Trainer (ohne Spielerrolle) | Einstellungen › Kalender abonnieren |
| `trainer_einstellungen-bfv.png` | Trainer (ohne Spielerrolle) | Einstellungen › Spielplan BFV |
| `trainer_einstellungen-profil.png` | Trainer (ohne Spielerrolle) | Einstellungen › Profil |
| `kassenwart_uebersicht.png` | Kassenwart | Übersicht mit Hero (nächster Termin, Zu-/Absage), Danach, Mein Status, Kassenbanner |
| `kassenwart_kalender.png` | Kassenwart | Kalender mit Terminkarten und Zusage/Absage |
| `kassenwart_kalender-abo.png` | Kassenwart | Blatt „Termine abonnieren“ (iPhone / Android) |
| `kassenwart_mein-status.png` | Kassenwart | Mein Status: Blatt „Voraussichtlich bis“ mit Datum und Notiz |
| `kassenwart_konto-ich.png` | Kassenwart | Konto, Reiter Ich: Kontobanner, Chips, eigene Strafen |
| `kassenwart_konto-mannschaft.png` | Kassenwart | Konto, Reiter Mannschaft: Kassenbanner, Chips, Strafenliste des Teams |
| `kassenwart_kasse-pruefen.png` | Kassenwart | Kasse, Reiter Prüfen und verbuchen |
| `kassenwart_kasse-offen.png` | Kassenwart | Kasse, Reiter Offen |
| `kassenwart_kasse-eingegangen.png` | Kassenwart | Kasse, Reiter Eingegangen |
| `kassenwart_strafe-verhaengen.png` | Kassenwart | Strafe verhängen (Spieler und Strafen wählen) |
| `kassenwart_einstellungen.png` | Kassenwart | Einstellungen, Übersicht |
| `kassenwart_einstellungen-mitteilungen.png` | Kassenwart | Einstellungen › Mitteilungen |
| `kassenwart_einstellungen-ruhezeiten.png` | Kassenwart | Einstellungen › Ruhezeiten |
| `kassenwart_einstellungen-kalender.png` | Kassenwart | Einstellungen › Kalender abonnieren |
| `kassenwart_einstellungen-profil.png` | Kassenwart | Einstellungen › Profil |
| `kassenwart_einstellungen-paypal.png` | Kassenwart | Einstellungen › Profil › PayPal-Link |
| `spielertrainer_uebersicht.png` | Spielertrainer (Spieler + Trainer) | Übersicht mit Hero (nächster Termin, Zu-/Absage), Danach, Mein Status, Kassenbanner |
| `spielertrainer_kalender.png` | Spielertrainer (Spieler + Trainer) | Kalender mit Terminkarten und Zusage/Absage |
| `spielertrainer_kalender-abo.png` | Spielertrainer (Spieler + Trainer) | Blatt „Termine abonnieren“ (iPhone / Android) |
| `spielertrainer_mein-status.png` | Spielertrainer (Spieler + Trainer) | Mein Status: Blatt „Voraussichtlich bis“ mit Datum und Notiz |
| `spielertrainer_konto-ich.png` | Spielertrainer (Spieler + Trainer) | Konto, Reiter Ich: Kontobanner, Chips, eigene Strafen |
| `spielertrainer_konto-mannschaft.png` | Spielertrainer (Spieler + Trainer) | Konto, Reiter Mannschaft: Kassenbanner, Chips, Strafenliste des Teams |
| `spielertrainer_rueckmeldungen.png` | Spielertrainer (Spieler + Trainer) | Rückmeldungen-Blatt: Balken, Kacheln, Namenslisten, Push senden |
| `spielertrainer_rueckmeldungen-push.png` | Spielertrainer (Spieler + Trainer) | Rückmeldungen-Blatt: Bestätigung „Push senden“ |
| `spielertrainer_trainer-spiel-waehlen.png` | Spielertrainer (Spieler + Trainer) | Trainer-Ansicht: Spiel wählen, Kader-Kachel, Vorlagen |
| `spielertrainer_trainer-platz.png` | Spielertrainer (Spieler + Trainer) | Trainer-Ansicht: Platz mit Formation und Bank |
| `spielertrainer_trainer-bank.png` | Spielertrainer (Spieler + Trainer) | Trainer-Ansicht: Blatt Spieler für die Bank |
| `spielertrainer_trainer-formation.png` | Spielertrainer (Spieler + Trainer) | Trainer-Ansicht: Formation wählen |
| `spielertrainer_trainer-vorlagen.png` | Spielertrainer (Spieler + Trainer) | Trainer-Ansicht: Menü einer Vorlage |
| `spielertrainer_kader.png` | Spielertrainer (Spieler + Trainer) | Kader mit Kennzahlen und Status je Spieler |
| `spielertrainer_kader-status.png` | Spielertrainer (Spieler + Trainer) | Kader: Status eines Spielers setzen |
| `spielertrainer_einladung-anfragen.png` | Spielertrainer (Spieler + Trainer) | Rollen verwalten: Einladung, Offene Anfragen, Mitglieder, Protokoll |
| `spielertrainer_anfrage-freigeben.png` | Spielertrainer (Spieler + Trainer) | Blatt Anfrage freigeben mit Kader-Zuordnung |
| `spielertrainer_einstellungen.png` | Spielertrainer (Spieler + Trainer) | Einstellungen, Übersicht |
| `spielertrainer_einstellungen-mitteilungen.png` | Spielertrainer (Spieler + Trainer) | Einstellungen › Mitteilungen |
| `spielertrainer_einstellungen-ruhezeiten.png` | Spielertrainer (Spieler + Trainer) | Einstellungen › Ruhezeiten |
| `spielertrainer_einstellungen-kalender.png` | Spielertrainer (Spieler + Trainer) | Einstellungen › Kalender abonnieren |
| `spielertrainer_einstellungen-bfv.png` | Spielertrainer (Spieler + Trainer) | Einstellungen › Spielplan BFV |
| `spielertrainer_einstellungen-profil.png` | Spielertrainer (Spieler + Trainer) | Einstellungen › Profil |
| `neu_einfuehrung-datenschutz.png` | Neues Mitglied | Einführung Schritt Datenschutz (Zustimmung, Gesundheitsangaben mit Alters-Haken) |
| `neu_einfuehrung-position.png` | Neues Mitglied | Einführung Schritt Position |
| `neu_einfuehrung-push.png` | Neues Mitglied | Einführung Schritt Mitteilungen erlauben (Home-Bildschirm-App) |
| `neu_einfuehrung-warten.png` | Neues Mitglied | Einführung: Warte auf Freigabe |
| `baustein_zusage-knoepfe.png` | Spieler | Zusage/Absage-Knöpfe der Terminkarte |
| `baustein_terminkarte.png` | Spieler | Terminkarte (Hero) mit Kopf, Ort, Meldeschluss, Zu-/Absage |
| `baustein_terminkarte-kalender.png` | Spieler | Terminkarte im Kalender |
| `baustein_kassenbanner-spieler.png` | Spieler | Kassenbanner, Spieler-Sicht (nur lesend) |
| `baustein_kassenbanner-kassenwart.png` | Kassenwart | Kassenbanner, Kassenwart-Sicht (Pfeile, drei Sprungziele) |
| `baustein_status-chips.png` | Spieler | Mein Status: Status-Chips (fit, angeschlagen, verletzt, Urlaub) |
| `baustein_kontobanner.png` | Spieler | Kontobanner (Reiter Ich) |
| `baustein_strafen-zeile.png` | Spieler | Strafen-Zeile mit Betrag in Statusfarbe |
| `baustein_mitteilungen-zeile.png` | Spieler | Mitteilungen-Zeile mit Schalter (.sw) |
| `baustein_danach-liste.png` | Spieler | Danach-Liste der nächsten Termine |
| `baustein_aufgaben.png` | Kassenwart | Aufgabenblock |
| `baustein_bottom-nav-spieler.png` | Spieler | Untere Navigation, Spieler |
| `baustein_bottom-nav-trainer.png` | Trainer (ohne Spielerrolle) | Untere Navigation, Trainer |
| `baustein_bottom-nav-kassenwart.png` | Kassenwart | Untere Navigation, Kassenwart |
| `baustein_bottom-nav-spielertrainer.png` | Spielertrainer (Spieler + Trainer) | Untere Navigation, Spielertrainer |

## Anzahl je Rolle

- spieler: 11
- trainer: 15
- kassenwart: 16
- spielertrainer: 23
- neu: 4
- baustein: 15

## Nicht aufgenommen

- trainer/rueckmeldungen (Klickweg dashboard+rsvpSheet nicht nachspielbar, Ansicht gleich wie spielertrainer_rueckmeldungen.png)
- trainer/rueckmeldungen-push (Klickweg dashboard+rsvpSheet+pushModal nicht nachspielbar, Ansicht gleich wie spielertrainer_rueckmeldungen-push.png)
- trainer/trainer-platz (Klickweg trainer/spiel nicht nachspielbar, Ansicht gleich wie spielertrainer_trainer-platz.png)
- trainer/trainer-bank (Klickweg trainer/spiel+tvSheetKader#bank nicht nachspielbar, Ansicht gleich wie spielertrainer_trainer-bank.png)
- trainer/trainer-formation (Klickweg trainer/spiel+tvSheetForm nicht nachspielbar, Ansicht gleich wie spielertrainer_trainer-formation.png)
