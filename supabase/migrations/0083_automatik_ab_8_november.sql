-- ============================================================================
-- FC Fasanerie-Nord - Migration 0083: Uebergangsphase (20.10.2026)
--
-- 1. Strafen-Automatik erst ab Sonntag, 8. November 2026: kuenftige Trainings
--    und Spiele vor dem 8.11. auto_fine = false, ab dem 8.11. true. Neue
--    Termine ebenso (Trigger aus 0080 bekommt die Datumsgrenze).
-- 2. Meldeschluss Spiel: Freitag 12:00 (Europe/Berlin) vor dem Spiel, wenn das
--    Spiel am Samstag oder Sonntag ist. Spiele unter der Woche wie bisher
--    (team_settings.deadline_spiel_hours, 24 h). Ein eigener Wert am Termin
--    (deadline_override_hours) geht weiter vor. Training unveraendert (3 h).
--    deadline_at aller kuenftigen Termine wird neu berechnet (ohne Mitteilung:
--    notify_events_ereignis reagiert nur auf Datum, Uhrzeit, Ort, Status).
-- Aufbau: EIN do-Block, Gegenprobe am Ende.
-- ============================================================================

begin;

do $migration$
declare
  v_def text; v_alt text; v_n int; v_out int; v_sam int; v_seq bigint;
begin
  if pg_get_functiondef('public.events_auto_fine_standard()'::regprocedure) ~ '2026-11-08' then
    raise exception 'schon eingespielt?';
  end if;
  if exists (select 1 from public.fines where auto) then raise exception 'Vorprobe: es gibt Auto-Strafen'; end if;
  select count(*) into v_out from public.notification_outbox;
  select count(*) into v_sam from public.notification_sammler;
  select coalesce(sum(ical_seq), 0) into v_seq from public.events;

  -- 2) Meldeschluss Spiel am Wochenende: Freitag 12:00
  execute $ddl$
  create or replace function public.compute_deadline(p_club uuid, p_type text, p_starts_at timestamp with time zone, p_override integer)
   returns timestamp with time zone
   language sql stable security definer set search_path to 'public'
  as $$
    select case
      -- Nur Spiele und Trainings kennen einen Meldeschluss.
      when p_type not in ('spiel','training') then null
      when p_starts_at is null                then null      -- ganztaegig: kein Meldeschluss
      -- 0083: Spiel am Samstag/Sonntag ohne eigenen Wert -> Freitag davor 12:00 (Berlin)
      when p_type = 'spiel' and p_override is null
           and extract(isodow from (p_starts_at at time zone 'Europe/Berlin')) in (6, 7) then
        (((p_starts_at at time zone 'Europe/Berlin')::date
          - (extract(isodow from (p_starts_at at time zone 'Europe/Berlin'))::int - 5))::timestamp
          + time '12:00') at time zone 'Europe/Berlin'
      else p_starts_at - (
        coalesce(
          p_override,
          (select case when p_type = 'spiel' then s.deadline_spiel_hours
                       else s.deadline_training_hours end
             from public.team_settings s where s.club_id = p_club),
          -- Notnagel, falls ein Verein keine Zeile hat: die bisherigen Werte.
          case when p_type = 'spiel' then 24 else 3 end
        )::int * interval '1 hour')
    end;
  $$;
  $ddl$;

  -- 1) Neue Termine: Automatik erst ab 8.11.
  v_def := pg_get_functiondef('public.events_auto_fine_standard()'::regprocedure);
  v_alt := 'and new.starts_at > now() then';
  if (length(v_def) - length(replace(v_def, v_alt, ''))) / length(v_alt) <> 1 then raise exception 'Stelle im Trigger nicht eindeutig'; end if;
  execute replace(v_def, v_alt, 'and new.starts_at > now() and new.date >= date ''2026-11-08'' then  -- 0083: Uebergangsphase');

  -- Bestand: kuenftige Termine, Automatik nach Datum, Meldeschluss neu (BEFORE-Trigger rechnet)
  update public.events set auto_fine = (date >= date '2026-11-08'),
         deadline_override_hours = deadline_override_hours
   where type in ('spiel', 'training') and starts_at > now();
  get diagnostics v_n = row_count;
  raise notice 'kuenftige Trainings/Spiele neu gesetzt: %', v_n;

  -- Gegenprobe
  if exists (select 1 from public.events where type in ('spiel','training') and starts_at > now() and date < '2026-11-08' and auto_fine) then
    raise exception 'Gegenprobe: Automatik vor dem 8.11. an';
  end if;
  if exists (select 1 from public.events where type in ('spiel','training') and starts_at > now() and date >= '2026-11-08' and not auto_fine) then
    raise exception 'Gegenprobe: Automatik ab dem 8.11. aus';
  end if;
  if exists (select 1 from public.events e where e.starts_at > now() and e.deadline_at is distinct from
             public.compute_deadline(e.club_id, e.type, e.starts_at, e.deadline_override_hours)) then
    raise exception 'Gegenprobe: Meldeschluss nicht neu berechnet';
  end if;
  if exists (select 1 from public.events e where e.type = 'spiel' and e.starts_at > now() and e.deadline_override_hours is null
               and extract(isodow from (e.starts_at at time zone 'Europe/Berlin')) in (6, 7)
               and (extract(isodow from (e.deadline_at at time zone 'Europe/Berlin')) <> 5
                    or (e.deadline_at at time zone 'Europe/Berlin')::time <> time '12:00'
                    or (e.starts_at at time zone 'Europe/Berlin')::date - (e.deadline_at at time zone 'Europe/Berlin')::date not in (1, 2))) then
    raise exception 'Gegenprobe: Wochenendspiel ohne Freitag 12:00';
  end if;
  if exists (select 1 from public.events e where e.type = 'training' and e.starts_at > now() and e.deadline_override_hours is null
               and e.deadline_at <> e.starts_at - interval '3 hours') then
    raise exception 'Gegenprobe: Training-Meldeschluss veraendert';
  end if;
  if (select count(*) from public.notification_outbox) <> v_out or (select count(*) from public.notification_sammler) <> v_sam then
    raise exception 'Gegenprobe: Mitteilung entstanden';
  end if;
  if (select coalesce(sum(ical_seq), 0) from public.events) <> v_seq then raise exception 'Gegenprobe: Kalender-Sequenz veraendert'; end if;
  if exists (select 1 from public.fines where auto) then raise exception 'Gegenprobe: Auto-Strafe entstanden'; end if;
  raise notice '0083 ok';
end $migration$;

commit;
