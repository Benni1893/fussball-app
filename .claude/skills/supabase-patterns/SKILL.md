---
name: supabase-patterns
description: RLS-, Rollen- und Datenmuster der FC-Fasanerie-Nord-Datenbank (Supabase/Postgres). Greift bei jeder Migration in supabase/migrations, bei RLS-Policies, Rollenprüfungen, Geldbeträgen, Snapshot-Feldern und bei Client-Konfiguration (anon key). Für DB-Themen den Supabase MCP nutzen, standardmäßig nur lesend.
---

# Supabase-Muster (dieses Projekt)

Projekt-Ref (Supabase MCP): `pjgkgsepjsvewwkffzsm`.

## Rollen
- Interne Codes sind **englisch**: `player`, `coach`, `treasurer`, `admin`
  (Check-Constraint auf `user_roles.role`; Tabelle `user_roles`, ein Nutzer kann mehrere Rollen haben).
- Deutsche Namen sind **nur UI-Labels**: player→Spieler, coach→Trainer, treasurer→Kassenwart, admin→Admin.
- In SQL/Policies immer die englischen Codes verwenden.

## RLS ist Pflicht, Rollenprüfung gehört in die Policy
- **RLS an allen Tabellen aktiv.** Neue Tabelle ⇒ `alter table … enable row level security` + Policies, sonst ist sie dicht/kaputt.
- Rollencheck **nie nur im Frontend**, immer in der Policy über die `SECURITY DEFINER`-Helfer:
  - `public.has_role('coach')`, `public.is_admin()`, `public.my_roles()`
  - Helfer sind `security definer set search_path = public stable` (umgehen RLS, keine Rekursion).
- Etabliertes Muster: **Lesen offen, Schreiben rollenbeschränkt**
  - `create policy read_x on x for select using (true);`
  - Schreiben z. B. `with check (public.has_role('coach') or public.has_role('treasurer') or public.has_role('admin'))`
  - `fine_catalog`: Schreiben nur `treasurer`/`admin`. `user_roles`: Schreiben nur `admin`.
- Schreibt eine `SECURITY DEFINER`-Funktion sensible Daten, **im Funktionskörper erneut `has_role` prüfen** und sonst `raise exception` (Beispiel: `set_ical_url`).

## Geld
- Beträge sind **`numeric` in Euro** (z. B. `8`, `25`, `0.50`) — so liegen die 108 bestehenden Strafen vor. Kein Integer-Cent.
- Spalten: `fine_catalog.amount`, `fines.base_amount`, `fines.surcharge`.
- Neue Geldspalten ebenfalls `numeric` in Euro halten (Konsistenz), nicht mischen.

## Historische Werte als Kopie, nicht als Verweis
- Bei der Erfassung den **Wert in den Datensatz kopieren**, nicht nur auf die Vorlage verweisen.
- Vorbild `fines`: `offense` (Text-Snapshot des Vergehens) und `base_amount` (Betrag-Kopie) stehen direkt in der Zeile; `catalog_id` ist **nullable**.
- Dadurch: Katalogeintrag ändern/löschen lässt die schon verhängten Strafen unverändert.

## Migrationen
- Nummerierte Dateien in `supabase/migrations/` (fortlaufend, aktuell bis `0016`). Neue Nummer hochzählen, nie bestehende ändern.
- **Vor der Migration prüfen:**
  1. **Fremdschlüssel + ON-DELETE-Verhalten** bewusst wählen: `cascade` (club/event/player-Kinder), `restrict` (schützt Referenz, z. B. Katalog), `set null` (optionaler Verweis, z. B. `paid_by`).
  2. **Bestehende Daten**: Reicht `add column … default …`? Kollidiert ein neuer `check`/`unique` mit vorhandenen Zeilen? Erst mit dem MCP lesen (`list_tables verbose`, ggf. `execute_sql` SELECT).
  3. Idempotenz, wo sinnvoll: `if not exists`, `create or replace`.
- Nach DDL **`get_advisors` (security)** laufen lassen: fängt fehlende RLS-Policies u. Ä.

## Client / Keys
- Frontend nutzt **nur den anon key**. `service_role`/Secrets **niemals** ins Frontend, in den Chat oder ins Repo — nur in Vercel-Env (serverseitig, z. B. `api/sync-bfv.js`).
- `.env` wird nicht committet.

## Supabase MCP
- **Standardmäßig nur lesen**: `list_tables`, `list_migrations`, `get_advisors`, `execute_sql` (SELECT).
- Schreibende Aktionen (`apply_migration`, schreibendes `execute_sql`) **vorher ankündigen** und bestätigen lassen.

## Bekannte offene Advisor-Hinweise (Kontext, kein akuter Bug)
- Viele `SECURITY DEFINER`-Funktionen sind für `anon`/`authenticated` ausführbar (WARN). Sie schützen sich intern per `has_role`; bei neuen Funktionen den internen Check nicht vergessen.
- Auth „Leaked Password Protection" ist deaktiviert.
