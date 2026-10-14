-- ============================================================================
-- FC Fasanerie-Nord - Migration 0073: Mitteilung "Status abgelaufen" ohne
--                                     Statusangaben
--
-- Paket Rechtliches, Teil A (14.10.2026). Die Datenschutzerklaerung sagt in
-- 3e: "Mitteilungen enthalten keine Gesundheitsangaben." Bisher (0059/0062)
-- nannte status_abgelaufen die Statusart (verletzt, angeschlagen, Urlaub,
-- nicht verfuegbar) und das Datum "voraussichtlich bis". Der Inhalt einer
-- Mitteilung geht an den Push-Dienst des Geraeteherstellers.
--
--   notify_cron_status_abgelaufen: neutrale Texte, fuer alle Statusarten gleich,
--   ohne Statusart und ohne Bis-Datum. Titel immer "📋 Status abgelaufen".
--     ein Spieler: "<Name>: Status ist abgelaufen, bitte im Kader prüfen."
--     mehrere:     "Status abgelaufen bei <Name>, <Name>. Bitte im Kader prüfen."
--   Vorlage: Text nur noch {detail}, Platzhalter {datum} entfaellt (wird nicht
--   mehr uebergeben), Beispieldaten neutral.
--
-- Unveraendert: Ausloeser (ab 9 Uhr, status_until = gestern, nichts vor dem
-- 09.10.2026), Empfaenger (Rolle coach), Dedup je Trainer und Tag, Deep Link
-- #ansicht=kader, Cron-Job, Rechte (kein grant). Im Postausgang liegt heute
-- keine Zeile dieser Kategorie (geprueft vor dem Einspielen), es gibt also
-- nichts Altes umzuschreiben.
-- Aufbau: EIN do-Block, Gegenprobe am Ende (Pruefkonto mit Trainerrolle und
-- zwei Pruef-Spieler, Datum 2030, alles zurueckgerollt).
-- ============================================================================

begin;

do $migration$
declare
  v_fehl text[] := '{}';
  v_club uuid; v_t uuid := gen_random_uuid(); v_p1 uuid := gen_random_uuid(); v_p2 uuid := gen_random_uuid();
  v_tok text := 'gp0073' || replace(gen_random_uuid()::text, '-', '');
  v_r integer; v_n integer; v_x text;
  v_outbox_vorher text; v_outbox_nachher text;
begin
  -- --------------------------------------------------------------------------
  -- 1) Erzeuger
  -- --------------------------------------------------------------------------
  execute $ddl$
  create or replace function public.notify_cron_status_abgelaufen(p_jetzt timestamptz default now())
  returns integer language plpgsql security definer set search_path = public
  as $$
  declare
    v_lokal  timestamp := p_jetzt at time zone 'Europe/Berlin';
    v_gest   date      := (p_jetzt at time zone 'Europe/Berlin')::date - 1;
    v_ab     constant date := date '2026-10-09';     -- Einspielen 0059: nichts rueckwirkend
    v_anz    integer; v_namen text; v_kopf text; v_detail text;
    p record; v_id uuid; v_n integer := 0;
  begin
    if extract(hour from v_lokal) < 9 or v_gest < v_ab then return 0; end if;

    select count(*), string_agg(pl.name, ', ' order by pl.name)
      into v_anz, v_namen
      from public.player_status s join public.players pl on pl.id = s.player_id
     where s.status <> 'fit' and s.status_until = v_gest;
    if v_anz = 0 then return 0; end if;

    -- 0073: keine Statusart, kein Bis-Datum (Datenschutzerklaerung 3e)
    v_kopf := 'Status abgelaufen';
    if v_anz = 1 then
      v_detail := v_namen || ': Status ist abgelaufen, bitte im Kader prüfen.';
    else
      v_detail := 'Status abgelaufen bei ' || v_namen || '. Bitte im Kader prüfen.';
    end if;

    for p in select t.uid as profile_id from public.notify_profile_mit_rolle('coach') as t(uid) loop
      v_id := public.notify_enqueue(p.profile_id, 'status_abgelaufen',
        jsonb_build_object('kopf', v_kopf, 'detail', v_detail),
        p_dedup => 'status_abgelaufen:' || p.profile_id || ':' || v_gest);
      if v_id is not null then v_n := v_n + 1; end if;
    end loop;
    return v_n;
  end;
  $$
  $ddl$;
  revoke execute on function public.notify_cron_status_abgelaufen(timestamptz) from public, anon, authenticated;

  -- --------------------------------------------------------------------------
  -- 2) Vorlage
  -- --------------------------------------------------------------------------
  update public.notification_templates set
    titel_vorlage        = '📋 {kopf}',
    text_vorlage         = '{detail}',
    platzhalter          = array['kopf','detail'],
    platzhalter_optional = '{}'::text[],
    beispiel_daten       = '{"kopf":"Status abgelaufen","detail":"Max Muster: Status ist abgelaufen, bitte im Kader prüfen."}'::jsonb,
    updated_at           = now()
  where kategorie = 'status_abgelaufen';

  -- --------------------------------------------------------------------------
  -- Gegenprobe
  -- --------------------------------------------------------------------------
  if not exists (select 1 from public.notification_templates
                  where kategorie = 'status_abgelaufen' and aktiv and titel_vorlage = '📋 {kopf}' and text_vorlage = '{detail}'
                    and platzhalter = array['kopf','detail'] and deep_link_vorlage = '#ansicht=kader' and urgency = 'normal' and ttl_regel = 'fix') then
    v_fehl := v_fehl || 'Vorlage'::text;
  end if;
  v_x := pg_get_functiondef('public.notify_cron_status_abgelaufen(timestamptz)'::regprocedure);
  if v_x ~* '(verletzt|angeschlagen|urlaub|nicht_verfuegbar|voraussichtlich|status_note|notify_datum)' then
    v_fehl := v_fehl || 'Erzeuger nennt noch Statusangaben'::text;
  end if;
  if has_function_privilege('authenticated', 'public.notify_cron_status_abgelaufen(timestamptz)', 'execute')
     or has_function_privilege('anon', 'public.notify_cron_status_abgelaufen(timestamptz)', 'execute') then
    v_fehl := v_fehl || 'Rechte Erzeuger'::text;
  end if;
  if not exists (select 1 from cron.job where jobname = 'notify-status-ablauf' and schedule = '0 * * * *' and active) then
    v_fehl := v_fehl || 'Cron-Job'::text;
  end if;

  -- Mit echten Zeilen, zurueckgerollt: Pruefkonto mit Trainerrolle, zwei
  -- Pruef-Spieler mit Ablauf 2030 (kein echter Status liegt dort).
  select md5(coalesce(string_agg(id::text, '|' order by id), '')) into v_outbox_vorher from public.notification_outbox;
  select id into v_club from public.clubs where slug = 'fcfn';
  if exists (select 1 from public.player_status where status_until between date '2029-12-30' and date '2030-01-02') then
    v_fehl := v_fehl || 'Pruefdatum belegt'::text;
  end if;
  begin
    update public.einladungen set widerrufen_am = now() where widerrufen_am is null and art = 'spieler';
    insert into public.einladungen (club_id, token) values (v_club, v_tok);
    insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
      (v_t, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gp0073@invalid.local',
       jsonb_build_object('name', 'Gegen Trainer', 'einladung', v_tok), now(), now());
    update public.profiles set freigabe = 'aktiv' where id = v_t;
    insert into public.user_roles (user_id, role, club_id) values (v_t, 'coach', v_club) on conflict do nothing;
    insert into public.players (id, club_id, code, name) values (v_p1, v_club, 'gp73a', 'Gegen Anton'), (v_p2, v_club, 'gp73b', 'Gegen Berta');

    -- ein Spieler, verletzt mit Notiz
    insert into public.player_status (player_id, status, status_note, status_until) values (v_p1, 'verletzt', 'Knie', date '2029-12-31');
    v_r := public.notify_cron_status_abgelaufen(timestamp '2030-01-01 09:00' at time zone 'Europe/Berlin');
    select count(*), max(titel || ' | ' || text || ' | ' || deep_link) into v_n, v_x from public.notification_outbox
     where kategorie = 'status_abgelaufen' and profile_id = v_t;
    if v_n <> 1 or v_x is distinct from '📋 Status abgelaufen | Gegen Anton: Status ist abgelaufen, bitte im Kader prüfen. | #ansicht=kader' then
      v_fehl := v_fehl || ('ein Spieler: ' || v_n || ' / ' || coalesce(v_x, '-'));
    end if;

    -- zwei Spieler (angeschlagen, Urlaub) am selben Tag
    update public.player_status set status = 'angeschlagen', status_until = date '2030-01-01' where player_id = v_p1;
    insert into public.player_status (player_id, status, status_until) values (v_p2, 'urlaub', date '2030-01-01');
    v_r := public.notify_cron_status_abgelaufen(timestamp '2030-01-02 09:00' at time zone 'Europe/Berlin');
    select count(*), max(titel || ' | ' || text) into v_n, v_x from public.notification_outbox
     where kategorie = 'status_abgelaufen' and profile_id = v_t and dedup_key = 'status_abgelaufen:' || v_t || ':2030-01-01';
    if v_n <> 1 or v_x is distinct from '📋 Status abgelaufen | Status abgelaufen bei Gegen Anton, Gegen Berta. Bitte im Kader prüfen.' then
      v_fehl := v_fehl || ('mehrere: ' || v_n || ' / ' || coalesce(v_x, '-'));
    end if;

    -- kein Text dieser Kategorie nennt Statusart, Notiz oder Datum
    if exists (select 1 from public.notification_outbox where kategorie = 'status_abgelaufen' and profile_id = v_t
                and (titel || ' ' || text) ~* '(verletzt|angeschlagen|urlaub|verfügbar|voraussichtlich|knie|[0-9]{2}\.[0-9]{2}\.)') then
      v_fehl := v_fehl || 'Text mit Statusangabe'::text;
    end if;
    raise exception using errcode = 'P0073', message = 'zurückrollen';
  exception when sqlstate 'P0073' then null;
  end;
  select md5(coalesce(string_agg(id::text, '|' order by id), '')) into v_outbox_nachher from public.notification_outbox;
  if v_outbox_nachher is distinct from v_outbox_vorher then v_fehl := v_fehl || 'Postausgang veraendert'::text; end if;
  if exists (select 1 from auth.users where id = v_t) or exists (select 1 from public.players where id in (v_p1, v_p2)) then
    v_fehl := v_fehl || 'Pruefzeilen nicht zurueckgerollt'::text;
  end if;

  if array_length(v_fehl, 1) > 0 then
    raise exception 'Gegenprobe 0073 fehlgeschlagen: %', v_fehl;
  end if;
  raise notice 'Gegenprobe 0073 bestanden.';
end
$migration$;

commit;

-- RUECKBAU (nicht automatisch): notify_cron_status_abgelaufen wie 0062,
-- Vorlage: text_vorlage '{detail} Der Status ist noch gesetzt, bitte im Kader
-- prüfen.', platzhalter {kopf,detail,datum}, optional {datum}.
