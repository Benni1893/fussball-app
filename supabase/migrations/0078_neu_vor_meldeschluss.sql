-- ============================================================================
-- FC Fasanerie-Nord - Migration 0078: Keine Auto-Strafe kurz nach der Freigabe
--
-- Regel (19.10.2026): Liegt der Meldeschluss eines Termins weniger als
-- 24 Stunden nach der Freigabe eines Spielers, bekommt dieser Spieler fuer
-- diesen Termin keine automatische Strafe - weder "keine Rueckmeldung" beim
-- Anpfiff (apply_event_fines) noch "verspaetete Rueckmeldung" (Trigger
-- rsvp_late_cancel_fine). Die Uebersicht nach Meldeschluss an die Trainer
-- zaehlt ihn nicht als offen (notify_cron_rueckmeldung).
--
-- Freigabezeitpunkt eines Kadereintrags: entschieden_am des verknuepften
-- Kontos (anfrage_freigeben, Trainer-Link), sonst die Anlage des
-- Kadereintrags (players.created_at). Neue Hilfsfunktionen:
--   spieler_freigegeben_am(player) -> timestamptz
--   neu_vor_meldeschluss(player, deadline) -> boolean
-- mein_konto liefert zusaetzlich 'freigegeben_am', damit die App fuer Neue
-- keine 8 € androht.
--
-- Sonst wortgleich mit dem Stand nach 0075. Aufbau: EIN do-Block, Gegenprobe
-- am Ende (Pruefdaten, zurueckgerollt).
-- ============================================================================

begin;

do $migration$
declare
  v_fehl text[] := '{}';
  v_club uuid; v_admin uuid; v_tok text := 'gp0078' || replace(gen_random_uuid()::text, '-', '');
  v_neu uuid := gen_random_uuid(); v_alt uuid := gen_random_uuid(); v_pneu uuid := gen_random_uuid(); v_palt uuid := gen_random_uuid();
  v_ev uuid := gen_random_uuid(); v_ev2 uuid := gen_random_uuid();
  v_n int; v_s text; v_j jsonb;
begin
  if to_regprocedure('public.neu_vor_meldeschluss(uuid, timestamptz)') is not null then
    raise exception 'neu_vor_meldeschluss gibt es schon - schon eingespielt?';
  end if;

  execute $ddl$
  create function public.spieler_freigegeben_am(p_player uuid)
  returns timestamptz language sql stable security definer set search_path = public
  as $$
    select coalesce((select max(pr.entschieden_am) from public.profiles pr where pr.player_id = p_player),
                    (select pl.created_at from public.players pl where pl.id = p_player));
  $$
  $ddl$;
  execute $ddl$
  create function public.neu_vor_meldeschluss(p_player uuid, p_deadline timestamptz)
  returns boolean language sql stable security definer set search_path = public
  as $$
    select p_deadline is not null
       and coalesce(public.spieler_freigegeben_am(p_player) > p_deadline - interval '24 hours', false);
  $$
  $ddl$;
  revoke all on function public.spieler_freigegeben_am(uuid) from public, anon, authenticated;
  revoke all on function public.neu_vor_meldeschluss(uuid, timestamptz) from public, anon, authenticated;

  -- ---- apply_event_fines ----------------------------------------------------
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
        and not public.neu_vor_meldeschluss(p.id, v_deadline)   -- 0078: Meldeschluss weniger als 24 h nach Freigabe
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

  -- ---- rsvp_late_cancel_fine (Trigger) --------------------------------------
  execute $ddl$
  create or replace function public.rsvp_late_cancel_fine()
  returns trigger language plpgsql security definer set search_path = public
  as $$
  declare
    e          record;
    v_deadline timestamptz;
    v_cat      uuid;
    v_eid      uuid;
    v_pid      uuid;
  begin
    if tg_op = 'DELETE' then
      v_eid := old.event_id; v_pid := old.player_id;
    else
      v_eid := new.event_id; v_pid := new.player_id;
    end if;

    select * into e from public.events where id = v_eid;
    if e.id is null or e.type not in ('spiel','training')
       or e.auto_fine = false or e.starts_at is null then
      return coalesce(new, old);
    end if;

    v_deadline := coalesce(
      e.deadline_at,
      public.compute_deadline(e.club_id, e.type, e.starts_at, e.deadline_override_hours));

    select id into v_cat from public.fine_catalog where club_id = e.club_id and code = 'k05';
    if v_cat is null then
      return coalesce(new, old);
    end if;

    if tg_op <> 'DELETE' and now() > v_deadline and now() < e.starts_at then
      -- 0078: Meldeschluss weniger als 24 h nach Freigabe -> keine Strafe
      if public.neu_vor_meldeschluss(v_pid, v_deadline) then
        return coalesce(new, old);
      end if;
      -- Verspaetete Rueckmeldung (Zusage ODER Absage) -> 8 EUR sofort
      insert into public.fines (club_id, player_id, catalog_id, date, paid, note, event_id, auto, created_at)
      values (e.club_id, v_pid, v_cat, e.date, false,
              'Automatisch: verspätete Rückmeldung zu ' || e.title, v_eid, true, now())
      on conflict (event_id, player_id) do nothing;
    elsif tg_op = 'DELETE' or now() <= v_deadline then
      -- Rechtzeitige Rueckmeldung ODER zurueckgezogen -> offene Auto-Strafe entfernen
      delete from public.fines
       where event_id = v_eid and player_id = v_pid
         and auto = true and paid = false and catalog_id = v_cat;
    end if;
    -- now >= starts_at: nichts tun (Endstand macht der Cron).

    return coalesce(new, old);
  end;
  $$
  $ddl$;

  -- ---- notify_cron_rueckmeldung (Uebersicht nach Meldeschluss) ----------------
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
         and not public.neu_vor_meldeschluss(pl.id, e.deadline_at)   -- 0078: gerade erst freigegeben
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

  -- ---- mein_konto: freigegeben_am dazu ---------------------------------------
  execute $ddl$
  create or replace function public.mein_konto()
  returns jsonb language plpgsql stable security definer set search_path = public
  as $$
  declare p record; v_ds record; v_ge record;
  begin
    if auth.uid() is null then raise exception 'Nicht angemeldet.'; end if;
    select * into p from public.profiles where id = auth.uid();
    if p.id is null then return jsonb_build_object('freigabe', 'unbekannt'); end if;
    select fassung, erteilt_am into v_ds from public.einwilligungen where profile_id = p.id and art = 'datenschutz' and widerrufen_am is null;
    select fassung, erteilt_am into v_ge from public.einwilligungen where profile_id = p.id and art = 'gesundheit' and widerrufen_am is null;
    return jsonb_build_object(
      'freigabe', p.freigabe,
      'name', public.konto_name(p.id),
      'anzeigename', p.anzeigename,
      'email', p.email,
      'hat_spieler', p.player_id is not null,
      'position', coalesce((select hauptposition from public.players where id = p.player_id), p.wunsch_position),
      'datenschutz', case when v_ds.fassung is not null then jsonb_build_object('fassung', v_ds.fassung, 'am', v_ds.erteilt_am) end,
      'gesundheit', case when v_ge.fassung is not null then jsonb_build_object('fassung', v_ge.fassung, 'am', v_ge.erteilt_am) end,
      'paypal_frage', p.paypal_frage and public.has_role('treasurer'),
      'leitung', public.ist_leitung(),
      'onboarding_offen', p.onboarding_offen,
      'spielt_mit', p.spielt_mit,
      'kassenwart_wunsch', p.kassenwart_wunsch,
      -- 0078: fuer die Regel "Meldeschluss weniger als 24 h nach Freigabe"
      'freigegeben_am', case when p.player_id is not null then public.spieler_freigegeben_am(p.player_id) else p.entschieden_am end,
      'mannschaft', (select coalesce(team_name, name) from public.clubs where slug = 'fcfn'));
  end;
  $$
  $ddl$;

  -- ---- Gegenprobe ------------------------------------------------------------
  if has_function_privilege('authenticated', 'public.neu_vor_meldeschluss(uuid, timestamptz)', 'execute') then v_fehl := v_fehl || 'Hilfsfunktion offen'::text; end if;
  if not has_function_privilege('authenticated', 'public.mein_konto()', 'execute') then v_fehl := v_fehl || 'grant mein_konto fehlt'::text; end if;
  select id into v_club from public.clubs where slug = 'fcfn';
  select r.user_id into v_admin from public.user_roles r join public.profiles pr on pr.id = r.user_id and pr.freigabe = 'aktiv' where r.role = 'admin' limit 1;
  begin
    -- Spiel vor 1 Stunde, Meldeschluss vor 25 Stunden
    insert into public.events (id, club_id, type, title, date, time, auto_fine)
      values (v_ev, v_club, 'spiel', 'Gegenprobe 0078', (now() at time zone 'Europe/Berlin')::date, to_char((now() at time zone 'Europe/Berlin') - interval '1 hour', 'HH24:MI'), true);
    update public.events set starts_at = now() - interval '1 hour', deadline_at = now() - interval '25 hours', auto_fined_at = null where id = v_ev;
    -- neu: Kadereintrag und Konto, freigegeben vor 10 Stunden (nach Meldeschluss - 24 h)
    update public.einladungen set widerrufen_am = now() where widerrufen_am is null and art = 'spieler';
    insert into public.einladungen (club_id, token) values (v_club, v_tok);
    insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
      (v_neu, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gp0078n@invalid.local', jsonb_build_object('name', 'Gegen Neu', 'einladung', v_tok), now(), now());
    insert into public.players (id, club_id, code, name, created_at) values (v_pneu, v_club, 'gp78n', 'Gegen Neu', now() - interval '10 hours');
    update public.profiles set freigabe = 'aktiv', player_id = v_pneu, entschieden_am = now() - interval '10 hours' where id = v_neu;
    -- alt: Kadereintrag ohne Konto, angelegt vor 10 Tagen
    insert into public.players (id, club_id, code, name, created_at) values (v_palt, v_club, 'gp78a', 'Gegen Alt', now() - interval '10 days');
    perform public.apply_event_fines();
    select count(*) into v_n from public.fines where event_id = v_ev and player_id = v_pneu;
    if v_n <> 0 then v_fehl := v_fehl || 'Neuer bekam Auto-Strafe'::text; end if;
    select count(*) into v_n from public.fines where event_id = v_ev and player_id = v_palt;
    if v_n <> 1 then v_fehl := v_fehl || 'Alter bekam keine Auto-Strafe'::text; end if;
    -- verspaetete Rueckmeldung: Training in 2 h, Meldeschluss vor 1 h (Training: 3 h vorher)
    insert into public.events (id, club_id, type, title, date, time, auto_fine)
      values (v_ev2, v_club, 'training', 'Gegenprobe 0078 b', (now() at time zone 'Europe/Berlin')::date, '23:59', true);
    update public.events set starts_at = now() + interval '2 hours', deadline_at = now() - interval '1 hour' where id = v_ev2;
    insert into public.rsvps (club_id, event_id, player_id, status) values (v_club, v_ev2, v_pneu, 'zu'), (v_club, v_ev2, v_palt, 'zu');
    select count(*) into v_n from public.fines where event_id = v_ev2 and player_id = v_pneu;
    if v_n <> 0 then v_fehl := v_fehl || 'Neuer bekam Verspaetet-Strafe'::text; end if;
    select count(*) into v_n from public.fines where event_id = v_ev2 and player_id = v_palt;
    if v_n <> 1 then v_fehl := v_fehl || 'Alter bekam keine Verspaetet-Strafe'::text; end if;
    -- mein_konto liefert freigegeben_am
    perform set_config('request.jwt.claims', json_build_object('sub', v_neu, 'role', 'authenticated')::text, true);
    v_j := public.mein_konto();
    perform set_config('request.jwt.claims', '', true);
    if v_j->>'freigegeben_am' is null then v_fehl := v_fehl || 'mein_konto ohne freigegeben_am'::text; end if;

    raise exception using errcode = 'P0078', message = 'zurückrollen';
  exception when sqlstate 'P0078' then null;
  end;
  if exists (select 1 from public.players where id in (v_pneu, v_palt)) or exists (select 1 from auth.users where id = v_neu) then
    v_fehl := v_fehl || 'Pruefdaten nicht zurueckgerollt'::text;
  end if;

  if array_length(v_fehl, 1) > 0 then
    raise exception 'Gegenprobe 0078 fehlgeschlagen: %', v_fehl;
  end if;
  raise notice 'Gegenprobe 0078 bestanden.';
end
$migration$;

commit;

-- RUECKBAU (nicht automatisch): Funktionen aus supabase/cleanup/backup-2026-10-19/funktionen-vor-0078.txt,
-- drop function public.neu_vor_meldeschluss(uuid, timestamptz); drop function public.spieler_freigegeben_am(uuid);
