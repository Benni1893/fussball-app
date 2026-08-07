-- ============================================================================
-- FC Fasanerie-Nord - Migration 0016: Eigener Teamname (aus X-WR-CALNAME)
--
-- Speichert den beim iCal-Sync gelesenen Teamnamen (z. B. "FC Fasanerie-Nord II")
-- in den Vereinseinstellungen. Das Frontend nutzt ihn, um in Paarungen das
-- eigene Team zu erkennen/hervorzuheben - ohne den Namen hart zu verdrahten.
-- Befuellt wird die Spalte automatisch beim naechsten Sync-Lauf.
-- ============================================================================

alter table public.clubs add column if not exists team_name text;
