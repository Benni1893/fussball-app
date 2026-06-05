# FC Fasanerie-Nord · Mannschafts-App

Eine schlanke Web-App für die 1. Herrenmannschaft des **FC Fasanerie-Nord e.V.** –
ganz ohne Build-Schritt, einfach `index.html` im Browser öffnen.

## Funktionen

- **Übersicht** – Dashboard mit nächsten Terminen, offenen Strafen & Kennzahlen
- **Kalender** – Spiele, Trainings und Team-Events mit **Zu-/Absage** (inkl. Grund)
- **Strafenkatalog** – verbindliche Liste aller Vergehen und Beträge
- **Strafen-Konto** – offene & beglichene Strafen, mit
  - Ring-Diagramm **Bezahlt vs. Offen**
  - Balken-Diagramm **Top-Beitragende**
  - **PayPal.Me-Button** zum Begleichen offener Strafen *(Platzhalter-Konto, echte Integration in Phase 4)*

## Technik

- Reines **HTML / CSS / Vanilla JavaScript**, keine Abhängigkeiten, kein Build
- Demo-Daten getrennt von der UI-Logik (`data.js`)
- Zustand (Zu-/Absagen, bezahlte Strafen) lokal im Browser (`localStorage`)
- Diagramme als handgemachtes SVG

## Dateien

| Datei | Inhalt |
|-------|--------|
| `index.html` | Grundgerüst, Header, Navigation |
| `styles.css` | Design-System (Vereinsfarben Grün/Gold) |
| `data.js`    | Demo-Daten (Kader, Termine, Strafen, Katalog) |
| `app.js`     | Anwendungslogik, Ansichten, Diagramme, Interaktion |

## Lokal starten

`index.html` per Doppelklick öffnen – fertig. (Node.js wird **nicht** benötigt.)

## Roadmap (Auszug)

- Echtes Backend mit Benutzerkonten & Rollen (Admin / Trainer / Kassenwart / Spieler)
- Vollständige PayPal-Integration inkl. Zahlungsabgleich
- Mehrgeräte-Synchronisierung der Daten

> Demo-Anwendung · Daten sind frei erfunden.
