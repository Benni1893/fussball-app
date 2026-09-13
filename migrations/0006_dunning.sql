-- ============================================================================
-- FC Fasanerie-Nord - Migration 0006: Automatische Mahnstufe (Zuschlag)
--
-- Regel: Ist eine Strafe 7 Tage nach ihrem Datum noch offen, +2 EUR. Danach je
-- weitere angefangene Woche erneut +2 EUR, gedeckelt bei 10 EUR (max 5 Stufen).
-- Sobald bezahlt, friert der Betrag ein (Cron fasst nur offene Strafen an).
--
-- Datenmodell:
--   base_amount          = Grundbetrag (Schnappschuss aus dem Katalog, unveraendert)
--   surcharge            = aufgelaufener Mahnzuschlag (getrennt gefuehrt)
--   surcharge_updated_at = Datum der letzten Erhoehung (Nachvollziehbarkeit)
-- Gesamtbetrag = base_amount + surcharge.
-- ============================================================================

-- 1) Neue Spalten ------------------------------------------------------------
alter table public.fines add column if not exists base_amount          numeric(8,2);
alter table public.fines add column if not exists surcharge            numeric(8,2) not null default 0;
alter table public.fines add column if not exists surcharge_updated_at date;

-- Grundbetrag fuer bestehende Strafen einmalig aus dem Katalog uebernehmen.
update public.fines f
   set base_amount = c.amount
  from public.fine_catalog c
 where f.catalog_id = c.id
   and f.base_amount is null;

-- Kuenftige Strafen: Grundbetrag automatisch aus dem Katalog setzen, falls leer.
create or replace function public.fines_set_base_amount()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.base_amount is null then
    select amount into new.base_amount
      from public.fine_catalog where id = new.catalog_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_fines_base_amount on public.fines;
create trigger trg_fines_base_amount
  before insert on public.fines
  for each row execute function public.fines_set_base_amount();

-- 2) Automatik: faellige Zuschlaege berechnen -------------------------------
--    Zielwert = min(5, floor(Tage/7)) * 2. Da der Wert nur aus dem Datum
--    abgeleitet wird, ist ein erneuter Lauf am selben Tag wirkungslos
--    (idempotent) - es wird nichts doppelt aufaddiert. surcharge_updated_at
--    wird nur gesetzt, wenn sich der Zuschlag tatsaechlich aendert.
create or replace function public.apply_fine_surcharges()
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_count integer;
begin
  update public.fines
     set surcharge            = least(5, greatest(0, (current_date - fines.date) / 7)) * 2,
         surcharge_updated_at = current_date
   where paid = false
     and least(5, greatest(0, (current_date - fines.date) / 7)) * 2 <> surcharge;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- 3) Taeglicher Cron-Job (pg_cron) ------------------------------------------
--    Falls "create extension" hier scheitert: in Supabase unter
--    Database > Extensions die Erweiterung "pg_cron" aktivieren und dann
--    diese Migration erneut ausfuehren.
create extension if not exists pg_cron;

-- evtl. vorhandenen gleichnamigen Job entfernen (sauberer Re-Run der Migration)
select cron.unschedule(jobid)
  from cron.job
 where jobname = 'apply-fine-surcharges-daily';

-- taeglich um 03:15 Uhr (Serverzeit/UTC) alle offenen Strafen pruefen
select cron.schedule(
  'apply-fine-surcharges-daily',
  '15 3 * * *',
  $$select public.apply_fine_surcharges();$$
);

-- 4) Einmal sofort ausfuehren, damit der Stand direkt stimmt.
select public.apply_fine_surcharges();
