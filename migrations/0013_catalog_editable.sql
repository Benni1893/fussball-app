-- ============================================================================
-- FC Fasanerie-Nord - Migration 0013 (Teil 1): Strafenkatalog bearbeitbar
--
-- Vorbereitung am fines-Schema, damit der Strafenkatalog editierbar/loeschbar
-- wird, ohne bestehende Strafen zu beschaedigen:
--   * offense: Bezeichnung als Schnappschuss in fines (Betrag liegt bereits als
--     base_amount vor, Migration 0006). So bleiben Betrag UND Bezeichnung einer
--     Strafe unabhaengig vom Katalog erhalten.
--   * Fremdschluessel fines.catalog_id -> fine_catalog: von ON DELETE RESTRICT
--     auf ON DELETE SET NULL (Katalog loeschen blockt/loescht keine Strafen).
--
-- RLS (Schreiben nur treasurer) folgt in einer separaten Migration (Schritt 2).
-- ============================================================================

-- 1) Bezeichnung als Schnappschuss in fines ---------------------------------
alter table public.fines add column if not exists offense text;

-- Bestehende Strafen aus dem Katalog befuellen
update public.fines f
   set offense = c.offense
  from public.fine_catalog c
 where f.catalog_id = c.id
   and f.offense is null;

-- Trigger erweitern: base_amount UND offense beim Anlegen aus dem Katalog uebernehmen
create or replace function public.fines_set_base_amount()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.catalog_id is not null then
    if new.base_amount is null then
      select amount  into new.base_amount from public.fine_catalog where id = new.catalog_id;
    end if;
    if new.offense is null then
      select offense into new.offense     from public.fine_catalog where id = new.catalog_id;
    end if;
  end if;
  return new;
end;
$$;

-- 2) Fremdschluessel auf ON DELETE SET NULL umstellen -----------------------
alter table public.fines alter column catalog_id drop not null;
alter table public.fines drop constraint fines_catalog_id_fkey;
alter table public.fines add constraint fines_catalog_id_fkey
  foreign key (catalog_id) references public.fine_catalog(id) on delete set null;
