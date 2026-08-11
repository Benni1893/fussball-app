-- ============================================================================
-- FC Fasanerie-Nord - Migration 0023: Zeitpunkt der letzten BFV-Synchronisierung
--
-- Fuer die Einstellungen-Seite ("Zuletzt synchronisiert: ..."). Wird von der
-- serverseitigen Sync-Function nach einem erfolgreichen Lauf gesetzt.
-- ============================================================================

alter table public.clubs add column if not exists ical_synced_at timestamptz;
