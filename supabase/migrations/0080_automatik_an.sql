-- ============================================================================
-- FC Fasanerie-Nord - Migration 0080: Strafen-Automatik an (Start, 20.10.2026)
--
-- 1. Alle kuenftigen Trainings und Spiele bekommen auto_fine = true.
-- 2. Neue Trainings und Spiele ebenso: App (createTermine) und BFV-Abgleich
--    (sync_bfv_matches) schreiben ausdruecklich auto_fine = false. Ein
--    BEFORE-INSERT-Trigger setzt es fuer kuenftige Trainings und Spiele auf
--    true. Der Name sortiert hinter trg_events_starts_at, damit starts_at schon
--    gesetzt ist. Vergangene Termine bleiben aus (sonst vergaebe
--    apply_event_fines sofort Strafen). Spaeter mit einem Schalter je Termin
--    (NOTES "Nach dem Start") muss dieser Trigger weg oder den Wert der App
--    respektieren.
-- 3. Die 24-Stunden-Regel (0078) bleibt unberuehrt: Gegenprobe ueber
--    neu_vor_meldeschluss.
-- Aufbau: EIN do-Block, Gegenprobe am Ende (zurueckgerollt).
-- ============================================================================

begin;

do $migration$
declare
  v_n int; v_club uuid; v_id uuid; v_auto boolean;
begin
  if exists (select 1 from pg_trigger where tgname = 'trg_events_zz_auto_fine') then
    raise exception 'Trigger gibt es schon - schon eingespielt?';
  end if;
  if exists (select 1 from public.fines) then raise exception 'Vorprobe: es gibt schon Strafen'; end if;

  -- 1) kuenftige Termine
  update public.events set auto_fine = true
   where type in ('spiel', 'training') and starts_at > now() and auto_fine = false;
  get diagnostics v_n = row_count;
  raise notice 'kuenftige Termine eingeschaltet: %', v_n;

  -- 2) neue Termine
  execute $ddl$
  create or replace function public.events_auto_fine_standard()
  returns trigger language plpgsql set search_path = public
  as $$
  begin
    -- 0080: kuenftige Trainings und Spiele immer mit Strafen-Automatik
    if new.type in ('spiel', 'training') and new.starts_at is not null and new.starts_at > now() then
      new.auto_fine := true;
    end if;
    return new;
  end $$;
  $ddl$;
  execute $ddl$
  create trigger trg_events_zz_auto_fine before insert on public.events
    for each row execute function public.events_auto_fine_standard()
  $ddl$;

  -- Gegenprobe (zurueckgerollt): neuer Termin wie aus der App, morgen, auto_fine false
  select id into v_club from public.clubs limit 1;
  begin
    insert into public.events (club_id, type, title, date, time, status, quelle, auto_fine)
      values (v_club, 'training', 'Gegenprobe 0080', (now() at time zone 'Europe/Berlin')::date + 3, '19:30', 'geplant', 'manuell', false)
      returning id, auto_fine into v_id, v_auto;
    if not v_auto then raise exception 'Gegenprobe: neuer Termin ohne Automatik'; end if;
    insert into public.events (club_id, type, title, date, time, status, quelle, auto_fine)
      values (v_club, 'training', 'Gegenprobe 0080 alt', (now() at time zone 'Europe/Berlin')::date - 3, '19:30', 'geplant', 'manuell', false)
      returning auto_fine into v_auto;
    if v_auto then raise exception 'Gegenprobe: vergangener Termin mit Automatik'; end if;
    insert into public.events (club_id, type, title, date, time, status, quelle, auto_fine)
      values (v_club, 'sonstiges', 'Gegenprobe 0080 sonst', (now() at time zone 'Europe/Berlin')::date + 3, '19:30', 'geplant', 'manuell', false)
      returning auto_fine into v_auto;
    if v_auto then raise exception 'Gegenprobe: Sonstiges mit Automatik'; end if;
    raise exception using errcode = 'P0001', message = 'rollback:ok';
  exception when raise_exception then
    if sqlerrm <> 'rollback:ok' then raise; end if;
  end;

  -- Gegenprobe: alle kuenftigen Trainings/Spiele an, nichts Vergangenes geaendert
  if exists (select 1 from public.events where type in ('spiel','training') and starts_at > now() and not auto_fine) then
    raise exception 'Gegenprobe: kuenftiger Termin ohne Automatik';
  end if;
  if exists (select 1 from public.events where starts_at <= now() and auto_fine) then
    raise exception 'Gegenprobe: vergangener Termin mit Automatik';
  end if;
  -- 24-Stunden-Regel weiter vorhanden
  if pg_get_functiondef('public.apply_event_fines'::regproc) !~ 'neu_vor_meldeschluss'
     or pg_get_functiondef('public.rsvp_late_cancel_fine'::regproc) !~ 'neu_vor_meldeschluss' then
    raise exception 'Gegenprobe: 24-Stunden-Regel fehlt';
  end if;
  if exists (select 1 from public.fines) then raise exception 'Gegenprobe: Strafen entstanden'; end if;
  raise notice '0080 ok';
end $migration$;

commit;
