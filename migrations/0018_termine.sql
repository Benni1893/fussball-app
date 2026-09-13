-- ============================================================================
-- FC Fasanerie-Nord - Migration 0018: events -> allgemeine Termine-Tabelle
--
-- Trainer/Kassenwart sollen eigene Termine anlegen koennen (Training,
-- Mannschaftsabend, Spiel, Sonstiges) - in DERSELBEN Tabelle wie die
-- importierten BFV-Spiele, damit Anzeige und RSVP nicht doppelt gebaut werden.
--
-- Aenderungen:
--   1) Bestehende type='event'-Zeilen (Seed) -> 'sonstiges'.
--   2) type-Check auf: spiel | training | mannschaftsabend | sonstiges.
--   3) title darf leer sein (Spiele leiten den Titel aus der Paarung ab).
--   4) Serien-Felder serie_id + serie_geaendert (+ Index).
--   5) code bekommt einen Default (manuelle Inserts muessen keinen liefern).
--
-- Bewusst NICHT geaendert:
--   * RLS: Schreiben bleibt coach/treasurer/admin, Lesen alle (wie gehabt).
--   * status ('geplant'|'abgesagt') - "faellt aus" nutzt 'abgesagt'.
--   * gegner/home/wettbewerb/liga/spielstaette/adresse/location_raw sind schon
--     nullable -> bleiben bei Nicht-Spielen leer.
--   * sync_bfv_matches fasst weiterhin nur quelle='bfv' an.
-- ============================================================================

-- 1) Alten type-Check ZUERST entfernen (sonst verbietet er das Update auf 'sonstiges')
alter table public.events drop constraint if exists events_type_check;

-- 2) Bestands-Zeilen 'event' auf 'sonstiges' umstellen
update public.events set type = 'sonstiges' where type = 'event';

-- 3) Neuen type-Check auf die vier Werte setzen
alter table public.events add constraint events_type_check
  check (type = any (array['spiel','training','mannschaftsabend','sonstiges']));

-- 3) title nullable
alter table public.events alter column title drop not null;

-- 4) Serien-Felder
alter table public.events add column if not exists serie_id uuid;
alter table public.events add column if not exists serie_geaendert boolean not null default false;
create index if not exists events_serie_id_idx on public.events (serie_id) where serie_id is not null;

-- 5) code-Default (manuelle Inserts brauchen keinen Code zu liefern)
alter table public.events alter column code set default gen_random_uuid()::text;
