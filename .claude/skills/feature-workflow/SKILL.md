---
name: feature-workflow
description: Arbeitsweise für Änderungen an der FC-Fasanerie-Nord-App. Greift, sobald ein Feature/Bugfix umgesetzt werden soll. Regelt: betroffene Dateien vorab zeigen und auf Bestätigung warten, ein Feature pro Durchgang, DB vor Frontend, Supabase MCP nur lesend, am Ende ein iPhone-Testfall.
---

# Feature-Workflow (dieses Projekt)

## Vor der Umsetzung
- **Betroffene Dateien zuerst auflisten** (welche Datei, was ändert sich grob) und **auf Bestätigung warten**, bevor irgendetwas geändert wird.
- **Ein Feature pro Durchgang.** Keine ungefragten Nebenaufräumarbeiten (kein Umbenennen, Reformatieren, „schnell noch"-Änderungen an fremdem Code). Fällt etwas auf, benennen — nicht eigenmächtig miterledigen.

## Reihenfolge: Datenbank vor Frontend
- Erst die **DB-Änderung** (Migration) umsetzen, **Zwischenbestätigung** einholen (Migration gelaufen?), dann das **Frontend**.
- Grund: Ohne Spalte/Policy läuft das Frontend ins Leere; RLS wird serverseitig erzwungen.

## Supabase MCP
- **Standardmäßig nur lesen** (`list_tables`, `list_migrations`, `get_advisors`, SELECT via `execute_sql`).
- **Schreibvorgänge vorher ankündigen** (`apply_migration`, schreibendes `execute_sql`) und bestätigen lassen.
- Details in [[supabase-patterns]].

## Abschluss
- Am Ende jedes Features **einen konkreten iPhone-Testfall** nennen, den man durchklicken kann:
  Wer (Rolle) → wo (Tab/Screen) → welche Tipps → was muss sichtbar passieren.
  Beispiel: „Als Kassenwart → Mehr → Strafenkatalog → Betrag ändern, speichern → neue Zahl steht sofort, ohne Reload."
- Mobile-Regeln beim Bauen beachten: [[mobile-ui]].

## Git / Deploy (Kontext)
- Push nur nach ausdrücklicher Freigabe. Repo `Benni1893/fussball-app` (public), Vercel deployt automatisch.
- Commit-Nachrichten **ohne Sonderzeichen** wie `>=`, Klammern oder Anführungszeichen — die brechen die PowerShell-Here-String-Übergabe an git.
