-- ============================================================================
-- FC Fasanerie-Nord - Migration 0008: Automatische Strafen bei Terminen
--
-- Regel (ausgewertet zum Beginn des Termins):
--   * "zugesagt"                        -> keine Strafe
--   * "abgesagt" vor Meldeschluss       -> keine Strafe (rechtzeitig)
--   * "abgesagt" nach Meldeschluss      -> 8 EUR  (k05 Verspaetete Absage)
--   * keine Rueckmeldung                -> 25 EUR Spiel (k04) / 15 EUR Training (k03)
-- Meldeschluss: Spiel 24 h vorher, Training 3 h vorher. Nur Spiele + Trainings.
-- Server-seitig, idempotent (auto_fined_at + Eindeutigkeit je Termin/Spieler).
-- ============================================================================

-- 1) events: Startzeitpunkt + Steuerung der Automatik -----------------------
alter table public.events add column if not exists starts_at     timestamptz;
alter table public.events add column if not exists auto_fine     boolean not null default true;
alter table public.events add column if not exists auto_fined_at timestamptz;

-- starts_at aus Datum + Uhrzeit (lokale Zeit Europe/Berlin) pflegen
create or replace function public.events_set_starts_at()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Nur (neu) berechnen, wenn noetig. So bleibt ein bewusst gesetztes
  -- starts_at (z. B. beim Testen) erhalten, solange Datum/Uhrzeit gleich sind.
  if tg_op = 'INSERT'
     or new.date is distinct from old.date
     or new.time is distinct from old.time
     or new.starts_at is null then
    if new.time is not null and btrim(new.time) <> '' then
      new.starts_at := (new.date::text || ' ' || new.time || ':00')::timestamp at time zone 'Europe/Berlin';
    else
      new.starts_at := (new.date::text || ' 00:00:00')::timestamp at time zone 'Europe/Berlin';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_events_starts_at on public.events;
create trigger trg_events_starts_at
  before insert or update on public.events
  for each row execute function public.events_set_starts_at();

-- Bestehende Termine einmal "anfassen" -> Trigger berechnet starts_at
update public.events set auto_fine = auto_fine;

-- Demo-/Altbestand NICHT rueckwirkend bestrafen: bereits begonnene Termine als
-- "schon abgerechnet" markieren. Die Automatik greift nur fuer kuenftige Termine.
update public.events set auto_fined_at = now()
 where starts_at is not null and starts_at <= now() and auto_fined_at is null;

-- 2) fines: Verknuepfung zum Termin + Kennzeichnung "automatisch" ------------
alter table public.fines add column if not exists event_id uuid references public.events(id) on delete set null;
alter table public.fines add column if not exists auto     boolean not null default false;

-- Eindeutig je (Termin, Spieler): verhindert Doppel-Strafen. NULL-event_id
-- (manuelle Strafen) sind in Postgres jeweils verschieden -> kein Konflikt.
create unique index if not exists uq_fines_event_player on public.fines(event_id, player_id);

-- 3) Automatik: faellige Termin-Strafen anlegen -----------------------------
create or replace function public.apply_event_fines()
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_ev       record;
  v_deadline timestamptz;
  v_inserted integer;
  v_count    integer := 0;
begin
  for v_ev in
    select * from public.events
     where type in ('spiel','training')
       and auto_fine = true
       and starts_at is not null
       and starts_at <= now()
       and auto_fined_at is null
  loop
    v_deadline := v_ev.starts_at
                  - (case when v_ev.type = 'spiel' then interval '24 hours' else interval '3 hours' end);

    insert into public.fines (club_id, player_id, catalog_id, date, paid, note, event_id, auto, created_at)
    select v_ev.club_id, p.id, k.id, v_ev.date, false,
           'Automatisch: ' || reason.txt || ' zu ' || v_ev.title,
           v_ev.id, true, now()
    from public.players p
    left join public.rsvps r on r.event_id = v_ev.id and r.player_id = p.id
    cross join lateral (
      select
        case
          when r.status = 'zu' then null
          when r.status = 'ab' and r.updated_at <= v_deadline then null               -- rechtzeitig abgesagt
          when r.status = 'ab' then 'k05'                                             -- verspaetete Absage
          else case when v_ev.type = 'spiel' then 'k04' else 'k03' end                -- keine Rueckmeldung
        end as kcode,
        case when r.status = 'ab' then 'verspätete Absage' else 'keine Rückmeldung' end as txt
    ) reason
    join public.fine_catalog k on k.club_id = v_ev.club_id and k.code = reason.kcode
    where p.club_id = v_ev.club_id
      and reason.kcode is not null
    on conflict (event_id, player_id) do nothing;

    get diagnostics v_inserted = row_count;
    v_count := v_count + v_inserted;

    update public.events set auto_fined_at = now() where id = v_ev.id;
  end loop;

  return v_count;
end;
$$;

-- 4) Taeglicher/haeufiger Cron-Job (alle 15 Minuten) ------------------------
create extension if not exists pg_cron;
select cron.unschedule(jobid) from cron.job where jobname = 'apply-event-fines';
select cron.schedule('apply-event-fines', '*/15 * * * *', $$select public.apply_event_fines();$$);

-- 5) RLS: Loeschen von Strafen - treasurer/admin generell, coach fuer Auto-Strafen
drop policy if exists fines_del on fines;
create policy fines_del on fines for delete to authenticated
  using (
    public.has_role('treasurer') or public.has_role('admin')
    or (auto = true and public.has_role('coach'))
  );

-- 6) Einmal ausfuehren (kuenftige Termine; Altbestand ist als erledigt markiert).
select public.apply_event_fines();
