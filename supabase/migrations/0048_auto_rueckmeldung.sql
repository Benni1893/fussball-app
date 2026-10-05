-- ============================================================================
-- FC Fasanerie-Nord - Migration 0048: Automatische Mitteilungen, AM4 Rueckmeldung
--
-- Plan und Entscheidungen: auto-mitteilungen/PHASE0.md, Annahmen R1 bis R5 in
-- auto-mitteilungen/ANNAHMEN.md. Bausteine aus 0043, Empfaengerhilfe aus 0046.
--
--   rueckmeldung_erinnerung  pg_cron alle 5 Minuten. Spiele und Trainings mit
--                            Meldeschluss: Erinnerung, wenn er in 22 bis 24
--                            Stunden liegt, und noch einmal in 0 bis 2 Stunden
--                            (R3). An verknuepfte Spieler ohne Rueckmeldung,
--                            ohne Urlaub/verletzt am Termintag (F6, T2).
--                            Gueltig bis Meldeschluss.
--   meldeschluss_uebersicht  derselbe Cron: Meldeschluss in der letzten Stunde
--                            vorbei, Termin noch nicht begonnen. An alle
--                            Trainer, einmal je Termin. Gueltig bis Beginn.
--   absage_kurzfristig       Trigger auf rsvps: Absage nach Meldeschluss und vor
--                            Beginn. Sammler je Termin und Trainer, 10 Minuten
--                            ab der ersten; beim Zusammenfassen nur, wer dann
--                            noch abgesagt hat. Ausloeser ausgenommen (F1).
--   unterbesetzung           entfaellt vorerst (F4).
--
-- Nichts rueckwirkend: der Cron betrachtet nur kuenftige Termine und
-- Meldeschluesse im genannten Fenster; jede Nachricht hat einen dedup_key, ein
-- zweiter Lauf erzeugt nichts. Der Trigger faengt eigene Fehler ab.
--
-- Vorlage absage_kurzfristig (R1, wie K1): Titel "🚨 {anzahl}" mit
-- "1 kurzfristige Absage" / "2 kurzfristige Absagen".
--
-- RECHTE: alle neuen Funktionen SECURITY DEFINER, kein grant.
-- Aufbau: EIN do-Block (conventions.md).
-- ============================================================================

begin;

do $migration$
declare
  v_fehl text[] := '{}';
  v_x    text[];
  v_club uuid; v_prof uuid; v_player uuid; v_ev uuid; v_n integer; v_t text;
  v_start timestamptz;
begin
  -- --------------------------------------------------------------------------
  -- 1) Meldeschluss als Text: "heute 16:00 Uhr", "morgen 16:00 Uhr", sonst "20.09. 16:00 Uhr"
  -- --------------------------------------------------------------------------
  execute $ddl$
  create or replace function public.notify_meldeschluss_text(p timestamptz)
  returns text language sql stable set search_path = public
  as $$
    select case (p at time zone 'Europe/Berlin')::date - (now() at time zone 'Europe/Berlin')::date
             when 0 then 'heute'
             when 1 then 'morgen'
             else public.notify_datum_kurz((p at time zone 'Europe/Berlin')::date) end
           || ' ' || to_char(p at time zone 'Europe/Berlin', 'HH24:MI') || ' Uhr';
  $$
  $ddl$;

  -- --------------------------------------------------------------------------
  -- 2) Cron: Erinnerung und Uebersicht
  -- --------------------------------------------------------------------------
  execute $ddl$
  create or replace function public.notify_cron_rueckmeldung()
  returns integer language plpgsql security definer set search_path = public
  as $$
  declare
    e record; p record; v_n integer := 0; v_stufe text; v_id uuid;
    v_zu integer; v_ab integer; v_offen integer;
  begin
    -- Erinnerung an Spieler ohne Rueckmeldung
    for e in
      select ev.*, case when ev.deadline_at <= now() + interval '2 hours' then '2' else '24' end as stufe
        from public.events ev
       where ev.status = 'geplant' and ev.type in ('spiel', 'training')
         and ev.deadline_at is not null and ev.starts_at > now()
         and (ev.deadline_at > now() and ev.deadline_at <= now() + interval '2 hours'
              or ev.deadline_at > now() + interval '22 hours' and ev.deadline_at <= now() + interval '24 hours')
    loop
      for p in
        select a.profile_id from public.notify_profile_spieler_am(e.date) a
         where not exists (select 1 from public.rsvps r where r.event_id = e.id and r.player_id = a.player_id)
      loop
        v_id := public.notify_enqueue(p.profile_id, 'rueckmeldung_erinnerung',
          jsonb_build_object(
            'termin_titel', public.notify_termin_titel(e.id),
            'datum',        public.notify_datum_kurz(e.date),
            'uhrzeit',      coalesce(public.notify_uhrzeit(e.time), 'ganztägig'),
            'meldeschluss', public.notify_meldeschluss_text(e.deadline_at),
            'termin_id',    e.id::text),
          p_dedup   => 'erinnerung:' || e.id || ':' || p.profile_id || ':' || e.stufe,
          p_ttl_bis => e.deadline_at);
        if v_id is not null then v_n := v_n + 1; end if;
      end loop;
    end loop;

    -- Uebersicht nach Meldeschluss an die Trainer
    for e in
      select ev.* from public.events ev
       where ev.status = 'geplant' and ev.type in ('spiel', 'training')
         and ev.deadline_at is not null and ev.starts_at > now()
         and ev.deadline_at <= now() and ev.deadline_at > now() - interval '1 hour'
    loop
      select count(*) filter (where r.status = 'zu'), count(*) filter (where r.status = 'ab')
        into v_zu, v_ab from public.rsvps r where r.event_id = e.id;
      select count(*) into v_offen from public.players pl
       where pl.club_id = e.club_id
         and not exists (select 1 from public.rsvps r where r.event_id = e.id and r.player_id = pl.id)
         and not public.notify_spieler_faellt_aus_am(pl.id, e.date);
      for p in select t.uid as profile_id from public.notify_profile_mit_rolle('coach') as t(uid) loop
        v_id := public.notify_enqueue(p.profile_id, 'meldeschluss_uebersicht',
          jsonb_build_object(
            'termin_titel', public.notify_termin_titel(e.id),
            'datum',        public.notify_datum_kurz(e.date),
            'uhrzeit',      coalesce(public.notify_uhrzeit(e.time), 'ganztägig'),
            'zusagen', v_zu::text, 'absagen', v_ab::text, 'offen', v_offen::text,
            'termin_id',    e.id::text),
          p_dedup   => 'meldeschluss:' || e.id || ':' || p.profile_id,
          p_ttl_bis => e.starts_at);
        if v_id is not null then v_n := v_n + 1; end if;
      end loop;
    end loop;
    return v_n;
  end;
  $$
  $ddl$;

  -- --------------------------------------------------------------------------
  -- 3) Kurzfristige Absage: Trigger auf rsvps
  -- --------------------------------------------------------------------------
  execute $ddl$
  create or replace function public.notify_rsvps_ereignis()
  returns trigger language plpgsql security definer set search_path = public
  as $$
  declare v_uid uuid := auth.uid(); e record; p record;
  begin
    begin
      if new.status = 'ab' and (tg_op = 'INSERT' or old.status is distinct from 'ab') then
        select * into e from public.events where id = new.event_id;
        if e.id is not null and e.status = 'geplant' and e.deadline_at is not null
           and now() > e.deadline_at and now() < e.starts_at then
          for p in select t.uid as profile_id from public.notify_profile_mit_rolle('coach') as t(uid) loop
            perform public.notify_sammeln('absage_kurzfristig', e.id::text, p.profile_id, v_uid,
              jsonb_build_object('player_id', new.player_id), now() + interval '10 minutes');
          end loop;
        end if;
      end if;
    exception when others then
      raise warning 'notify_rsvps_ereignis (%): % %', tg_op, sqlstate, sqlerrm;
    end;
    return null;
  end;
  $$
  $ddl$;

  execute 'drop trigger if exists trg_rsvps_notify on public.rsvps';
  execute 'create trigger trg_rsvps_notify after insert or update on public.rsvps
             for each row execute function public.notify_rsvps_ereignis()';

  execute $ddl$
  create or replace function public.notify_flush_absage_kurzfristig()
  returns integer language plpgsql security definer set search_path = public
  as $$
  declare g record; v_spieler uuid[]; e record; v_namen text; v_anz integer; v_n integer := 0;
  begin
    for g in
      select s.bezug, s.profile_id, min(s.faellig_ab) as ab from public.notification_sammler s
       where s.kategorie = 'absage_kurzfristig' group by s.bezug, s.profile_id having min(s.faellig_ab) <= now()
    loop
      with weg as (
        delete from public.notification_sammler s
         where s.kategorie = 'absage_kurzfristig' and s.bezug = g.bezug and s.profile_id = g.profile_id
        returning (s.daten->>'player_id')::uuid as player_id)
      select array_agg(distinct player_id) into v_spieler from weg;
      continue when v_spieler is null;

      select * into e from public.events where id = g.bezug::uuid;
      continue when e.id is null or e.status <> 'geplant' or e.starts_at <= now();

      -- nur, wer jetzt noch abgesagt hat
      select count(*), string_agg(pl.name, ', ' order by pl.name) into v_anz, v_namen
        from public.rsvps r join public.players pl on pl.id = r.player_id
       where r.event_id = e.id and r.status = 'ab' and r.player_id = any(v_spieler);
      continue when v_anz = 0;

      perform public.notify_enqueue(g.profile_id, 'absage_kurzfristig',
        jsonb_build_object(
          'anzahl',       public.notify_anzahl(v_anz, 'kurzfristige Absage', 'kurzfristige Absagen'),
          'termin_titel', public.notify_termin_titel(e.id),
          'datum',        public.notify_datum_kurz(e.date),
          'uhrzeit',      coalesce(public.notify_uhrzeit(e.time), 'ganztägig'),
          'namen',        v_namen,
          'termin_id',    e.id::text),
        p_dedup   => 'absage_kurzfristig:' || e.id || ':' || g.profile_id || ':' || floor(extract(epoch from g.ab))::bigint,
        p_ttl_bis => e.starts_at);
      v_n := v_n + 1;
    end loop;
    return v_n;
  end;
  $$
  $ddl$;

  -- --------------------------------------------------------------------------
  -- 4) Rechte und Cron
  -- --------------------------------------------------------------------------
  revoke execute on function public.notify_meldeschluss_text(timestamptz)   from public, anon, authenticated;
  revoke execute on function public.notify_cron_rueckmeldung()              from public, anon, authenticated;
  revoke execute on function public.notify_rsvps_ereignis()                 from public, anon, authenticated;
  revoke execute on function public.notify_flush_absage_kurzfristig()       from public, anon, authenticated;

  perform cron.unschedule('notify-rueckmeldung') where exists (select 1 from cron.job where jobname = 'notify-rueckmeldung');
  perform cron.schedule('notify-rueckmeldung', '*/5 * * * *', 'select public.notify_cron_rueckmeldung();');

  -- --------------------------------------------------------------------------
  -- 5) Vorlage absage_kurzfristig (R1)
  -- --------------------------------------------------------------------------
  update public.notification_templates
     set titel_vorlage = '🚨 {anzahl}',
         beispiel_daten = beispiel_daten || '{"anzahl":"2 kurzfristige Absagen"}'::jsonb,
         updated_at = now()
   where kategorie = 'absage_kurzfristig' and titel_vorlage = '🚨 {anzahl} kurzfristige Absagen';

  -- --------------------------------------------------------------------------
  -- Gegenprobe
  -- --------------------------------------------------------------------------
  select array_agg(p.oid::regprocedure::text) into v_x
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname like 'notify\_%' and p.proname <> 'notify_enqueue'
     and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute')
          or exists (select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a where a.grantee = 0));
  if v_x is not null then v_fehl := v_fehl || ('von außen ausführbar: ' || array_to_string(v_x, ', ')); end if;
  if not exists (select 1 from cron.job where jobname = 'notify-rueckmeldung' and schedule = '*/5 * * * *') then
    v_fehl := v_fehl || 'Cron-Job notify-rueckmeldung fehlt'::text;
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_rsvps_notify') then
    v_fehl := v_fehl || 'Trigger trg_rsvps_notify fehlt'::text;
  end if;

  select p.id, p.player_id, pl.club_id into v_prof, v_player, v_club
    from public.profiles p join public.players pl on pl.id = p.player_id limit 1;
  begin
    -- Training in 26 Stunden: Meldeschluss (3 h) in 23 Stunden -> 24-h-Erinnerung
    delete from public.player_status where player_id = v_player;
    v_start := date_trunc('minute', now() + interval '26 hours');
    insert into public.events (club_id, type, title, date, time, status, quelle, auto_fine)
    values (v_club, 'training', 'Gegenprobe', (v_start at time zone 'Europe/Berlin')::date,
            to_char(v_start at time zone 'Europe/Berlin', 'HH24:MI'), 'geplant', 'manuell', false)
    returning id into v_ev;
    perform public.notify_cron_rueckmeldung();
    perform public.notify_cron_rueckmeldung();   -- Doppellauf
    select count(*), max(titel) into v_n, v_t from public.notification_outbox
     where kategorie = 'rueckmeldung_erinnerung' and profile_id = v_prof and dedup_key like 'erinnerung:' || v_ev || ':%';
    if v_n <> 1 or v_t <> '⏳ Bist du dabei? Gegenprobe' then
      v_fehl := v_fehl || ('Erinnerung 24 h: ' || v_n || ' / ' || coalesce(v_t, '-'));
    end if;
    -- mit Rueckmeldung: keine weitere
    insert into public.rsvps (club_id, event_id, player_id, status) values (v_club, v_ev, v_player, 'zu');
    update public.events set time = to_char((now() + interval '4 hours') at time zone 'Europe/Berlin', 'HH24:MI'),
                             date = ((now() + interval '4 hours') at time zone 'Europe/Berlin')::date where id = v_ev;
    perform public.notify_cron_rueckmeldung();
    select count(*) into v_n from public.notification_outbox
     where kategorie = 'rueckmeldung_erinnerung' and dedup_key like 'erinnerung:' || v_ev || ':%:2';
    if v_n <> 0 then v_fehl := v_fehl || 'Erinnerung trotz Rückmeldung'::text; end if;
    raise exception using errcode = 'P0048', message = 'zurückrollen';
  exception when sqlstate 'P0048' then null;
  end;

  if array_length(v_fehl, 1) > 0 then
    raise exception 'Gegenprobe 0048 fehlgeschlagen: %', v_fehl;
  end if;
  raise notice 'Gegenprobe 0048 bestanden.';
end
$migration$;

commit;

-- RUECKBAU (nicht automatisch), als ein do-Block:
-- do $$ begin
--   perform cron.unschedule('notify-rueckmeldung');
--   drop trigger if exists trg_rsvps_notify on public.rsvps;
--   drop function if exists public.notify_flush_absage_kurzfristig(), public.notify_rsvps_ereignis(),
--     public.notify_cron_rueckmeldung(), public.notify_meldeschluss_text(timestamptz);
--   delete from public.notification_sammler where kategorie = 'absage_kurzfristig';
--   update public.notification_templates set titel_vorlage = '🚨 {anzahl} kurzfristige Absagen',
--     beispiel_daten = beispiel_daten || '{"anzahl":"2"}' where kategorie = 'absage_kurzfristig' and titel_vorlage = '🚨 {anzahl}';
-- end $$;
