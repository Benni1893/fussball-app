-- ============================================================================
-- FC Fasanerie-Nord - Migration 0057: Robustheit der Zustellung
--
-- Befunde aus der Robustheitspruefung vom 06.10.2026 (ABSCHLUSS.md):
--   R1  push_mark_error setzte error; notification_due laesst solche Zeilen
--       dauerhaft weg. Ein voruebergehender Fehler beim Push-Dienst verwarf die
--       Nachricht also endgueltig, obwohl api/dispatch-push.js "der naechste
--       Lauf versucht es erneut" annimmt. Jetzt: Spalte versuche; bis zu 5
--       Versuche mit wachsendem Abstand (5, 10, 15, 20 Minuten), nur solange
--       die Zeile gueltig ist; danach bzw. nach Ablauf bleibt der Fehler stehen.
--       Ein Geraet, das 404/410 meldet, entfernt der Dispatcher wie bisher;
--       hat das Profil danach keins mehr, gilt die Zeile beim naechsten Lauf
--       als erledigt (In-App-Eintrag).
--   R2  push_claim reicht die beim Einreihen berechnete Lebensdauer an den
--       Push-Dienst weiter. Nach einem Rueckstau konnte eine Erinnerung dort
--       noch nach dem Meldeschluss liegen. Jetzt kuerzt push_claim ttl_seconds
--       beim Abholen auf die Restzeit bis gueltig_bis (mindestens 60 s).
--   R3  in_quiet_hours prueft "jetzt"; fuer Pruefungen der Zeitumstellung gibt
--       es in_quiet_hours_at(von, bis, zeitpunkt), in_quiet_hours ruft sie mit
--       now() (Verhalten unveraendert).
--
-- RECHTE: push_mark_error, push_claim, in_quiet_hours behalten ihre Rechte
-- (create or replace). in_quiet_hours_at: nur service_role (wie in_quiet_hours,
-- 0042b), kein anon/authenticated.
-- Aufbau: EIN do-Block (conventions.md).
-- ============================================================================

begin;

do $migration$
declare
  v_fehl text[] := '{}';
  v_prof uuid; v_id uuid; v_r record; v_ttl integer;
  v_rechte text;
begin
  select string_agg(p.oid::regprocedure::text || '=' || coalesce(p.proacl::text, '-'), ';' order by 1) into v_rechte
    from pg_proc p where p.oid in ('public.push_mark_error(uuid,text)'::regprocedure, 'public.push_claim(integer)'::regprocedure,
                                   'public.in_quiet_hours(time,time)'::regprocedure);

  alter table public.notification_outbox add column if not exists versuche integer not null default 0;

  -- R1
  execute $ddl$
  create or replace function public.push_mark_error(p_id uuid, p_error text)
  returns void language sql security definer set search_path = public
  as $$
    update public.notification_outbox
       set versuche   = versuche + 1,
           claimed_at = null,
           error      = case when versuche + 1 >= 5 or (gueltig_bis is not null and gueltig_bis <= now())
                             then left(p_error, 400) end,
           not_before = case when versuche + 1 >= 5 or (gueltig_bis is not null and gueltig_bis <= now())
                             then not_before
                             else now() + (versuche + 1) * interval '5 minutes' end
     where id = p_id;
  $$
  $ddl$;

  -- R2
  execute $ddl$
  create or replace function public.push_claim(p_limit integer default 100)
  returns setof public.notification_outbox language plpgsql security definer set search_path = public
  as $$
  begin
    return query
    with faellig as (
      select o.id from public.notification_due o
       order by o.urgency desc, o.not_before
       limit greatest(1, least(p_limit, 500))
       for update skip locked
    )
    update public.notification_outbox o
       set claimed_at  = now(),
           ttl_seconds = case when o.gueltig_bis is not null
                              then greatest(60, least(o.ttl_seconds, floor(extract(epoch from (o.gueltig_bis - now())))::integer))
                              else o.ttl_seconds end
      from faellig f
     where o.id = f.id
    returning o.*;
  end;
  $$
  $ddl$;

  -- R3
  execute $ddl$
  create or replace function public.in_quiet_hours_at(p_from time, p_to time, p_zeit timestamptz)
  returns boolean language sql stable set search_path = public
  as $$
    select case
      when p_from = p_to then false                                   -- keine Ruhezeit
      when p_from <  p_to then jetzt.t >= p_from and jetzt.t < p_to    -- z. B. 01:00-06:00
      else                     jetzt.t >= p_from or  jetzt.t < p_to    -- ueber Mitternacht
    end
    from (select (p_zeit at time zone 'Europe/Berlin')::time as t) jetzt;
  $$
  $ddl$;
  execute $ddl$
  create or replace function public.in_quiet_hours(p_from time, p_to time)
  returns boolean language sql stable set search_path = public
  as $$ select public.in_quiet_hours_at(p_from, p_to, now()); $$
  $ddl$;
  revoke execute on function public.in_quiet_hours_at(time, time, timestamptz) from public, anon, authenticated;
  grant  execute on function public.in_quiet_hours_at(time, time, timestamptz) to service_role;

  -- --------------------------------------------------------------------------
  -- Gegenprobe
  -- --------------------------------------------------------------------------
  if (select string_agg(p.oid::regprocedure::text || '=' || coalesce(p.proacl::text, '-'), ';' order by 1)
        from pg_proc p where p.oid in ('public.push_mark_error(uuid,text)'::regprocedure, 'public.push_claim(integer)'::regprocedure,
                                       'public.in_quiet_hours(time,time)'::regprocedure)) is distinct from v_rechte then
    v_fehl := v_fehl || 'Rechte verändert'::text;
  end if;
  if has_function_privilege('authenticated', 'public.in_quiet_hours_at(time,time,timestamptz)', 'execute')
     or not has_function_privilege('service_role', 'public.in_quiet_hours_at(time,time,timestamptz)', 'execute') then
    v_fehl := v_fehl || 'Rechte in_quiet_hours_at'::text;
  end if;

  select id into v_prof from public.profiles limit 1;
  begin
    -- R1: vier voruebergehende Fehler -> jedes Mal wieder frei, spaeter faellig; der fuenfte bleibt
    insert into public.notification_outbox (profile_id, kategorie, titel, text, dedup_key, ist_vorschau)
    values (v_prof, 'test', 'Gegenprobe', 'Gegenprobe', 'gegenprobe0057:r1', true) returning id into v_id;
    perform public.push_mark_error(v_id, 'keine Zustellung');
    select * into v_r from public.notification_outbox where id = v_id;
    if v_r.error is not null or v_r.versuche <> 1 or v_r.not_before < now() + interval '299 seconds' then
      v_fehl := v_fehl || 'R1 erster Fehler'::text;
    end if;
    perform public.push_mark_error(v_id, 'keine Zustellung');
    perform public.push_mark_error(v_id, 'keine Zustellung');
    perform public.push_mark_error(v_id, 'keine Zustellung');
    perform public.push_mark_error(v_id, 'keine Zustellung');
    select * into v_r from public.notification_outbox where id = v_id;
    if v_r.error is distinct from 'keine Zustellung' or v_r.versuche <> 5 then
      v_fehl := v_fehl || ('R1 fünfter Fehler: ' || coalesce(v_r.error, '-') || ' / ' || v_r.versuche);
    end if;
    -- abgelaufene Zeile: sofort endgueltig
    insert into public.notification_outbox (profile_id, kategorie, titel, text, dedup_key, ist_vorschau, gueltig_bis)
    values (v_prof, 'test', 'Gegenprobe', 'Gegenprobe', 'gegenprobe0057:r1b', true, now() - interval '1 second') returning id into v_id;
    perform public.push_mark_error(v_id, 'keine Zustellung');
    if (select error from public.notification_outbox where id = v_id) is null then
      v_fehl := v_fehl || 'R1 abgelaufene Zeile wieder frei'::text;
    end if;
    -- R2: Restzeit beim Abholen
    insert into public.notification_outbox (profile_id, kategorie, titel, text, dedup_key, ist_vorschau, gueltig_bis, ttl_seconds, not_before)
    values (v_prof, 'test', 'Gegenprobe', 'Gegenprobe', 'gegenprobe0057:r2', true, now() + interval '10 minutes', 86400, now() - interval '1 minute')
    returning id into v_id;
    perform 1 from public.push_claim(500);
    select ttl_seconds into v_ttl from public.notification_outbox where id = v_id;
    if v_ttl is null or v_ttl < 590 or v_ttl > 600 then
      v_fehl := v_fehl || ('R2 ttl ' || coalesce(v_ttl::text, '-'));
    end if;
    raise exception using errcode = 'P0057', message = 'zurückrollen';
  exception when sqlstate 'P0057' then null;
  end;

  -- R3: Zeitumstellung 25.10.2026 (02:00 CEST -> 02:00 CET wird 03:00 -> 02:00)
  if public.in_quiet_hours_at('22:00', '08:00', '2026-10-24 06:30+00')             -- 08:30 Sommerzeit
     or not public.in_quiet_hours_at('22:00', '08:00', '2026-10-25 06:30+00')      -- 07:30 Winterzeit
     or public.in_quiet_hours_at('22:00', '08:00', '2026-10-25 07:00+00')          -- 08:00 Winterzeit
     or public.notify_nicht_vor_acht('2026-10-25 05:00+00') <> '2026-10-25 07:00+00'::timestamptz
     or public.notify_nicht_vor_acht('2026-10-24 05:00+00') <> '2026-10-24 06:00+00'::timestamptz then
    v_fehl := v_fehl || 'R3 Zeitumstellung'::text;
  end if;

  if array_length(v_fehl, 1) > 0 then
    raise exception 'Gegenprobe 0057 fehlgeschlagen: %', v_fehl;
  end if;
  raise notice 'Gegenprobe 0057 bestanden.';
end
$migration$;

commit;
