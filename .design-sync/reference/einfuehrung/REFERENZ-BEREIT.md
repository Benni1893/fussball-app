# Referenz für Claude Design: bereit

- **Stand:** 18.10.2026 08:49 (Europe/Berlin)
- **Projekt:** Claude Design „FC Fasanerie-Nord App“ (7e48a82b-b7ba-40ea-9e6b-30040a24c0d8)
- **Upload bestätigt:** ja. Nach dem Schreiben per Dateiliste des Projekts gegengelesen.
  - Design-System: 38 Dateien (`styles.css`, `_ds_app.css`, `tokens/`, `fonts/`, `assets/`, 27 Karten unter `components/`, `_ds_sync.json`, `README.md`).
  - Einführung: `einfuehrung/ist/` mit 84 Bildern und `INDEX.md`, dazu `einfuehrung/README.md`.
  - Ältere Referenzen nicht gelöscht, sondern markiert: `templates/VERALTET.md`, `screenshots/VERALTET.md`, `uploads/VERALTET.md`.

## Bilder je Rolle

| Rolle | Bilder |
|---|---|
| Spieler | 11 |
| Trainer (ohne Spielerrolle) | 15 |
| Kassenwart | 16 |
| Spielertrainer (Spieler + Trainer) | 23 |
| Neues Mitglied (Einführung: Datenschutz, Position, Mitteilungen erlauben, Warten) | 4 |
| Bausteine (Einzelausschnitte) | 15 |
| **Summe** | **84** |

Fünf Trainer-Ansichten (Rückmeldungen-Blatt, Push bestätigen, Platz, Bank, Formation) sind beim reinen Trainer
nicht nachspielbar und sehen aus wie beim Spielertrainer; siehe `ist/INDEX.md`.

Erzeugt mit `node .design-sync/shots/einfuehrungsbilder.mjs` (Stand-in ohne Datenbank, 390 px, Faktor 2).
