-- ============================================================================
-- FC Fasanerie-Nord - Migration 0075: Ehemalige Spieler nicht mehr mitzaehlen
--
-- Befund 18.10.2026 (Einfuehrung, PLAN.md "Fehlt in der App" Nr. 1):
-- Nach "Aus der Mannschaft entfernen" oder "Konto loeschen" bleibt der
-- Kadereintrag als "Ehemaliger Spieler" mit ausgeschieden_am stehen (0061),
-- damit alte Strafen ihren Bezug behalten. Drei Stellen gingen trotzdem ueber
-- ALLE players des Vereins:
--
--   1. apply_event_fines: haette Ehemaligen bei jedem Spiel/Training die
--      Strafe "keine Rueckmeldung" verhaengt.
--   2. notify_cron_rueckmeldung, Teil "Uebersicht nach Meldeschluss": zaehlte
--      Ehemalige als "offen" in der Mitteilung an die Trainer.
--   3. send_rsvp_reminder ("Push senden" im Rueckmeldungen-Blatt): zaehlte
--      Ehemalige als offen bzw. "ohne Konto".
--
-- Jeweils nur die Bedingung "ausgeschieden_am is null" dazu, sonst wortgleich
-- mit dem Stand in der Produktion. Bereits verhaengte Strafen bleiben
-- unberuehrt und weiter bezahlbar. Grants bleiben bei create or replace.
-- Aufbau: EIN do-Block, Gegenprobe am Ende (Pruefdaten, zurueckgerollt).
-- ============================================================================

begin;

do $migration$
declare
  v_fehl text[] := '{}';
  v_club uuid; v_akt uuid := gen_random_uuid(); v_ex uuid := gen_random_uuid();
  v_ev uuid := gen_random_uuid(); v_ev2 uuid := gen_random_uuid(); v_alt uuid := gen_random_uuid();
  v_admin uuid; v_n int; v_r jsonb; v_r2 jsonb; v_s text;
begin
  -- ---- Vorher: Spalte und Funktionen wie erwartet --------------------------------
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'players' and column_name = 'ausgeschieden_am') then
    raise exception 'players.ausgeschieden_am fehlt.';
  end if;
  if pg_get_functiondef('public.apply_event_fines'::regproc) ~ 'ausgeschieden' then
    raise exception 'apply_event_fines filtert schon - Migration schon eingespielt?';
  end if;

  -- ---- 1. apply_event_fines ------------------------------------------------------
  execute $ddl$
  create or replace function public.apply_event_fines()
  returns integer language plpgsql security definer set search_path = public
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
      -- Eine Quelle: die gepflegte Spalte. Der coalesce ist nur ein Gurt fuer
      -- Zeilen, die aus irgendeinem Grund ohne Trigger entstanden sind.
      v_deadline := coalesce(
        v_ev.deadline_at,
        public.compute_deadline(v_ev.club_id, v_ev.type, v_ev.starts_at, v_ev.deadline_override_hours));

      insert into public.fines (club_id, player_id, catalog_id, date, paid, note, event_id, auto, created_at)
      select v_ev.club_id, p.id, k.id, v_ev.date, false,
             'Automatisch: ' || reason.txt || ' zu ' || v_ev.title,
             v_ev.id, true, now()
      from public.players p
      left join public.rsvps r on r.event_id = v_ev.id and r.player_id = p.id
      cross join lateral (
        select
          case
            when r.status is null then case when v_ev.type = 'spiel' then 'k04' else 'k03' end  -- keine Rueckmeldung
            when r.updated_at <= v_deadline then null                                            -- rechtzeitig (zu/ab)
            else 'k05'                                                                            -- verspaetet (zu/ab)
          end as kcode,
          case when r.status is null then 'keine Rückmeldung' else 'verspätete Rückmeldung' end as txt
      ) reason
      join public.fine_catalog k on k.club_id = v_ev.club_id and k.code = reason.kcode
      where p.club_id = v_ev.club_id
        and p.ausgeschieden_am is null          -- 0075: Ehemalige bekommen keine Auto-Strafe
        and reason.kcode is not null
      on conflict (event_id, player_id) do nothing;

      get diagnostics v_inserted = row_count;
      v_count := v_count + v_inserted;

      update public.events set auto_fined_at = now() where id = v_ev.id;
    end loop;

    return v_count;
  end;
  $$
  $ddl$;

  -- ---- 2. notify_cron_rueckmeldung -----------------------------------------------
  execute $ddl$
  create or replace function public.notify_cron_rueckmeldung()
  returns integer language plpgsql security definer set search_path = public
  as $$
  declare
    e record; p record; v_n integer := 0; v_stufe text; v_id uuid;
    v_hinweis text;
    v_zu integer; v_ab integer; v_offen integer;
  begin
    -- Wortlaut des Strafhinweises aus den Beispieldaten der Vorlage (eine Quelle
    -- fuer Vorschau und Versand); leer bei Terminen ohne Auto-Strafe.
    select coalesce(nullif(btrim(t.beispiel_daten->>'strafhinweis'), ''), 'Ohne Antwort wird''s teuer.')
      into v_hinweis from public.notification_templates t where t.kategorie = 'rueckmeldung_erinnerung';

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
            'strafhinweis', case when e.auto_fine then v_hinweis else '' end,
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
         and pl.ausgeschieden_am is null          -- 0075: Ehemalige zaehlen nicht als offen
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

  -- ---- 3. send_rsvp_reminder -----------------------------------------------------
  execute $ddl$
  create or replace function public.send_rsvp_reminder(p_event uuid, p_nur_zaehlen boolean default false)
  returns jsonb language plpgsql security definer set search_path = public
  as $$
  declare
    v_uid uuid := auth.uid();
    e public.events;
    v_letzte timestamptz;
    v_gesperrt boolean;
    v_kreis jsonb;
    v_offen integer; v_aus integer; v_ohne_konto integer; v_ohne_abo integer; v_abgeschaltet integer;
    v_ziel uuid[]; v_ruhe integer; v_ab text; v_gesendet integer := 0;
    v_p uuid;
  begin
    if v_uid is null then
      raise exception 'Nicht angemeldet.' using errcode = '42501';
    end if;
    if not (public.has_role('coach') or public.is_admin()) then
      raise exception 'Nur Trainer oder Admin.' using errcode = '42501';
    end if;
    select * into e from public.events where id = p_event;
    if e.id is null then raise exception 'Termin nicht gefunden.'; end if;
    if e.status = 'abgesagt' then raise exception 'Der Termin fällt aus.'; end if;
    if e.starts_at is null or e.starts_at <= now() then raise exception 'Der Termin hat schon begonnen.'; end if;

    -- Sperre: 12 Stunden je Termin, egal welcher Trainer
    select max(o.created_at) into v_letzte from public.notification_outbox o
     where o.kategorie = 'rueckmeldung_nachfrage' and o.dedup_key like 'nachfrage:' || e.id || ':%';
    v_gesperrt := v_letzte is not null and v_letzte > now() - interval '12 hours';

    -- Spieler des Vereins ohne Rueckmeldung, je eine Zeile
    select coalesce(jsonb_agg(jsonb_build_object(
             'profile_id', pr.id,
             'aus',    public.notify_spieler_faellt_aus_am(pl.id, e.date),
             'abo',    exists (select 1 from public.push_subscriptions s where s.profile_id = pr.id),
             'an',     coalesce(np.rueckmeldung_erinnerung, false),
             'selbst', pr.id is not distinct from v_uid,
             'ruhe',   np.profile_id is not null and public.in_quiet_hours(np.quiet_from, np.quiet_to),
             'ruhe_bis', to_char(np.quiet_to, 'HH24:MI'))), '[]'::jsonb)
      into v_kreis
      from public.players pl
      left join public.profiles pr on pr.player_id = pl.id
      left join public.notification_prefs np on np.profile_id = pr.id
     where pl.club_id = e.club_id
       and pl.ausgeschieden_am is null          -- 0075: Ehemalige zaehlen nicht mit
       and not exists (select 1 from public.rsvps rv where rv.event_id = e.id and rv.player_id = pl.id);

    with k as (
      select (x->>'profile_id')::uuid as profile_id, (x->>'aus')::boolean as aus, (x->>'abo')::boolean as abo,
             (x->>'an')::boolean as an, (x->>'selbst')::boolean as selbst, (x->>'ruhe')::boolean as ruhe,
             x->>'ruhe_bis' as ruhe_bis
        from jsonb_array_elements(v_kreis) x)
    select count(*),
           count(*) filter (where aus),
           count(*) filter (where not aus and profile_id is null),
           count(*) filter (where not aus and profile_id is not null and not selbst and not abo),
           count(*) filter (where not aus and profile_id is not null and not selbst and abo and not an),
           array_agg(profile_id) filter (where not aus and profile_id is not null and not selbst and abo and an),
           count(*) filter (where not aus and profile_id is not null and not selbst and abo and an and ruhe),
           max(ruhe_bis) filter (where not aus and profile_id is not null and not selbst and abo and an and ruhe)
      into v_offen, v_aus, v_ohne_konto, v_ohne_abo, v_abgeschaltet, v_ziel, v_ruhe, v_ab
      from k;

    if p_nur_zaehlen then
      v_gesendet := coalesce(array_length(v_ziel, 1), 0);
    elsif not v_gesperrt then
      foreach v_p in array coalesce(v_ziel, '{}'::uuid[]) loop
        if public.notify_enqueue(v_p, 'rueckmeldung_nachfrage',
             jsonb_build_object(
               'termin_titel', public.notify_termin_titel(e.id),
               'datum',        public.notify_datum_kurz(e.date),
               'uhrzeit',      public.notify_uhrzeit(e.time),
               'meldeschluss', case when e.deadline_at is not null then public.notify_meldeschluss_text(e.deadline_at) end,
               'termin_id',    e.id::text),
             p_dedup   => 'nachfrage:' || e.id || ':' || v_p || ':' || floor(extract(epoch from now()) / 43200)::bigint,
             p_ttl_bis => e.starts_at) is not null then
          v_gesendet := v_gesendet + 1;
        end if;
      end loop;
      if v_gesendet > 0 then v_letzte := now(); v_gesperrt := true; end if;
    end if;

    return jsonb_build_object(
      'offen', v_offen, 'ausgenommen', v_aus, 'ohne_konto', v_ohne_konto, 'ohne_abo', v_ohne_abo,
      'abgeschaltet', v_abgeschaltet, 'gesendet', v_gesendet,
      'in_ruhezeit', case when v_gesendet > 0 then v_ruhe else 0 end,
      'zustellung_ab', case when v_gesendet > 0 then v_ab end,
      'gesperrt', v_gesperrt, 'letzte', v_letzte,
      'naechste_moeglich', case when v_letzte is not null then v_letzte + interval '12 hours' end,
      'nur_zaehlen', p_nur_zaehlen);
  end;
  $$
  $ddl$;

  -- ---- Gegenprobe ------------------------------------------------------------
  if not has_function_privilege('authenticated', 'public.send_rsvp_reminder(uuid, boolean)', 'execute') then
    v_fehl := v_fehl || 'grant send_rsvp_reminder fehlt'::text;
  end if;
  select id into v_club from public.clubs where slug = 'fcfn';
  select r.user_id into v_admin from public.user_roles r where r.role = 'admin' limit 1;
  begin
    insert into public.players (id, club_id, code, name) values (v_akt, v_club, 'gp75a', 'Gegen Aktiv');
    insert into public.players (id, club_id, code, name, ausgeschieden_am) values (v_ex, v_club, 'gp75e', 'Ehemaliger Spieler', now());
    -- alte offene Strafe des Ehemaligen
    insert into public.fines (id, club_id, player_id, catalog_id, date, note)
      select v_alt, v_club, v_ex, k.id, current_date - 10, 'Gegenprobe 0075' from public.fine_catalog k where k.club_id = v_club and k.code = 'k04';
    -- vergangener Termin mit Auto-Strafe
    insert into public.events (id, club_id, type, title, date, time, auto_fine)
      values (v_ev, v_club, 'spiel', 'Gegenprobe 0075', (now() at time zone 'Europe/Berlin')::date, to_char((now() at time zone 'Europe/Berlin') - interval '1 hour', 'HH24:MI'), true);
    update public.events set starts_at = now() - interval '1 hour', auto_fined_at = null where id = v_ev;
    perform public.apply_event_fines();
    select count(*) into v_n from public.fines where event_id = v_ev and player_id = v_ex;
    if v_n <> 0 then v_fehl := v_fehl || 'Ehemaliger bekam Auto-Strafe'::text; end if;
    select count(*) into v_n from public.fines where event_id = v_ev and player_id = v_akt;
    if v_n <> 1 then v_fehl := v_fehl || ('Aktiver bekam ' || v_n || ' Auto-Strafen'); end if;
    select status into v_s from public.fines where id = v_alt;
    if v_s is distinct from 'offen' then v_fehl := v_fehl || ('alte Strafe: ' || coalesce(v_s, 'weg')); end if;

    -- Push senden zaehlt den Ehemaligen nicht (als Admin, nur zaehlen)
    if v_admin is not null then
      insert into public.events (id, club_id, type, title, date, time, auto_fine)
        values (v_ev2, v_club, 'training', 'Gegenprobe 0075 b', current_date + 3, '19:00', false);
      perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
      v_r := public.send_rsvp_reminder(v_ev2, true);
      update public.players set ausgeschieden_am = null where id = v_ex;
      v_r2 := public.send_rsvp_reminder(v_ev2, true);
      perform set_config('request.jwt.claims', '', true);
      if (v_r2->>'offen')::int - (v_r->>'offen')::int <> 1 then
        v_fehl := v_fehl || ('Push senden zaehlt Ehemalige: ' || (v_r->>'offen') || ' / ' || (v_r2->>'offen'));
      end if;
    end if;
    raise exception using errcode = 'P0075', message = 'zurückrollen';
  exception when sqlstate 'P0075' then null;
  end;
  if exists (select 1 from public.players where id in (v_akt, v_ex)) or exists (select 1 from public.events where id in (v_ev, v_ev2)) then
    v_fehl := v_fehl || 'Pruefdaten nicht zurueckgerollt'::text;
  end if;
  if pg_get_functiondef('public.notify_cron_rueckmeldung'::regproc) !~ 'pl\.ausgeschieden_am is null' then
    v_fehl := v_fehl || 'notify_cron_rueckmeldung ohne Filter'::text;
  end if;

  if array_length(v_fehl, 1) > 0 then
    raise exception 'Gegenprobe 0075 fehlgeschlagen: %', v_fehl;
  end if;
  raise notice 'Gegenprobe 0075 bestanden.';
end
$migration$;

commit;

-- RUECKBAU (nicht automatisch): die drei Funktionen ohne "ausgeschieden_am is null"
-- (Stand vor 0075, siehe pg_get_functiondef vom 18.10.2026 in diesem Kopf).
