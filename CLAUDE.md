# FC Fasanerie-Nord, Mannschafts-App

**Sprache:** Antworten an den Nutzer immer auf Deutsch.

Projektregeln stehen in `.design-sync/conventions.md`, Arbeitsnotizen in
`.design-sync/NOTES.md`, Pakete und Reihenfolge in
`.design-sync/reference/app/einstellungen-kader/PLAN.md`.

## Datenbankzugang

- **Schreibzugriff** über `SUPABASE_DB_URL` aus `.env.local` (Repo-Wurzel, per
  `.gitignore` ausgeschlossen). Den Wert nie ausgeben, nie committen, nie in
  andere Dateien schreiben.
- Ausführen mit dem Werkzeug außerhalb des Repos:
  `node C:/Users/Benjamin/fussball-app-db/werkzeug/sql.mjs <datei.sql>` bzw.
  `-e "<sql>"`. Eine Datei läuft als **ein** Simple-Query, wie im SQL-Editor.
- **Migrationen nur als ein einziger `do`-Block mit Gegenprobe**
  (`conventions.md`, Abschnitt „Migrationen: ein einziger `do`-Block“).
  Eingespielte Migrationen werden nie nachträglich geändert; Korrekturen
  kommen als neue Migration.
- Zu jeder Migration ein **Prüfskript** in `supabase/checks/` nach dem
  bekannten Muster (Untertransaktion je Fall, immer zurückgerollt, Rollen über
  `set local role` plus `request.jwt.claims`, Tabelle mit PASS/FAIL).
- **Vor größeren Paketen eine Sicherung** (Schema und Daten) außerhalb des
  Repos, Ordner `C:/Users/Benjamin/fussball-app-db/sicherungen/`.
- Der **Supabase-MCP bleibt lesend** (`supabase_read_only_user`).
- Datenbankänderungen sind sofort live. Nichts, was bestehende Nutzerdaten
  (Strafen, Rückmeldungen, Termine, Profile) ändert oder löscht oder
  rückwirkend Strafen oder Nachrichten erzeugt, ohne ausdrückliche
  Entscheidung.
