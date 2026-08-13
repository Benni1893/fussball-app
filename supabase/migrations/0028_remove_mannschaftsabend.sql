-- ============================================================================
-- FC Fasanerie-Nord - Migration 0028: Typ "mannschaftsabend" entfernen
--
-- Kuenftig nur noch: spiel | training | sonstiges. Bestehende Mannschaftsabende
-- werden zu "sonstiges"; ein leerer Titel wird auf "Mannschaftsabend" gesetzt,
-- damit keine Information verloren geht.
-- ============================================================================

-- 1) Titel sichern, wo leer (bevor der Typ wechselt)
update public.events
   set title = 'Mannschaftsabend'
 where type = 'mannschaftsabend' and (title is null or btrim(title) = '');

-- 2) Typ umstellen ('sonstiges' ist im alten CHECK bereits erlaubt)
update public.events set type = 'sonstiges' where type = 'mannschaftsabend';

-- 3) CHECK-Constraint auf drei Werte reduzieren
alter table public.events drop constraint if exists events_type_check;
alter table public.events add constraint events_type_check
  check (type = any (array['spiel','training','sonstiges']));
