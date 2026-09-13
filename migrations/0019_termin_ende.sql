-- ============================================================================
-- FC Fasanerie-Nord - Migration 0019: Endzeit fuer Termine
--
-- Das Termin-Formular erfasst Start- UND Endzeit. events hatte bisher nur
-- time (Start). Neue Spalte ende (Uhrzeit als Text, z. B. "20:30"), nullable
-- - bleibt bei BFV-Spielen und ohne Angabe leer.
-- ============================================================================

alter table public.events add column if not exists ende text;
