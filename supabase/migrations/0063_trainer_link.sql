-- ============================================================================
-- FC Fasanerie-Nord - Migration 0063: Onboarding Nacharbeit 4, Trainer-Link
--
--   1. einladungen: art ('spieler' | 'trainer'), gueltig_bis, benutzt_am,
--      benutzt_von. Der Spieler-Link bleibt einer je Mannschaft bis zum
--      Widerruf (E9). Trainer-Links erzeugt NUR der Admin; jeder gilt genau
--      einmal und laeuft nach 7 Tagen ab; widerrufbar.
--   2. handle_new_user: Registrierung ueber einen Trainer-Link -> Konto sofort
--      aktiv mit den Rollen Spieler und Trainer, ohne Freigabe; Link wird
--      dabei verbraucht. Onboarding bleibt offen (profiles.onboarding_offen),
--      kein Kadereintrag.
--   3. mein_kadereintrag(p_player, p_neu, p_spielt): im offenen Onboarding
--      eines Trainer-Link-Kontos einen Kadereintrag ohne Konto waehlen, einen
--      neuen anlegen oder "spielt nicht mit". onboarding_abschliessen().
--   4. Protokoll fuer Erzeugen, Widerrufen und Verbrauch.
--
-- RECHTE: neue RPCs an authenticated (Rollenpruefung in der Funktion).
-- Aufbau: EIN do-Block, Gegenprobe am Ende (zurueckgerollt).
-- ============================================================================

begin;

do $migration$
declare
  v_fehl text[] := '{}';
  v_admin uuid; v_club uuid; v_tok text; v_r jsonb; v_neu uuid := gen_random_uuid(); v_neu2 uuid := gen_random_uuid();
  v_pl uuid; v_id uuid;
begin
  -- 1) Spalten
  alter table public.einladungen add column if not exists art text not null default 'spieler';
  alter table public.einladungen add constraint einladungen_art_chk check (art in ('spieler', 'trainer'));
  alter table public.einladungen add column if not exists gueltig_bis timestamptz;
  alter table public.einladungen add column if not exists benutzt_am timestamptz;
  alter table public.einladungen add column if not exists benutzt_von uuid;
  drop index if exists public.einladungen_eine_gueltige;
  create unique index einladungen_eine_gueltige on public.einladungen(club_id) where widerrufen_am is null and art = 'spieler';

  alter table public.profiles add column if not exists onboarding_offen boolean not null default false;
  alter table public.profiles add column if not exists spielt_mit boolean;

  -- 2) Gueltigkeit: Spieler-Link bis Widerruf; Trainer-Link einmal, 7 Tage
  execute $ddl$
  create or replace function public.einladung_gueltig(p_token text)
  returns uuid language sql stable security definer set search_path = public
  as $$
    select id from public.einladungen
     where token = btrim(coalesce(p_token, '')) and widerrufen_am is null
       and (art = 'spieler' or (benutzt_am is null and gueltig_bis > now()))
     limit 1;
  $$
  $ddl$;
  revoke execute on function public.einladung_gueltig(text) from public, anon, authenticated;

  execute $ddl$
  create or replace function public.einladung_pruefen(p_token text)
  returns jsonb language plpgsql stable security definer set search_path = public
  as $$
  declare v_id uuid; v_art text;
  begin
    v_id := public.einladung_gueltig(p_token);
    select art into v_art from public.einladungen where id = v_id;
    return jsonb_build_object('gueltig', v_id is not null, 'art', v_art,
      'mannschaft', case when v_id is not null then (select coalesce(team_name, name) from public.clubs where slug = 'fcfn') end);
  end;
  $$
  $ddl$;
  revoke execute on function public.einladung_pruefen(text) from public;
  grant  execute on function public.einladung_pruefen(text) to anon, authenticated;

  -- Spieler-Link: wie 0061, aber nur Art 'spieler'
  execute $ddl$
  create or replace function public.einladung_holen()
  returns jsonb language plpgsql security definer set search_path = public
  as $$
  declare e record; v_club uuid;
  begin
    if not public.ist_leitung() then raise exception 'Nur Trainer oder Admin.' using errcode = '42501'; end if;
    select id into v_club from public.clubs where slug = 'fcfn';
    select * into e from public.einladungen where club_id = v_club and widerrufen_am is null and art = 'spieler';
    if e.id is null then
      insert into public.einladungen (club_id, token, erstellt_von, art)
      values (v_club, replace(gen_random_uuid()::text, '-', ''), auth.uid(), 'spieler') returning * into e;
      perform public.protokollieren('einladung_erstellt', null, jsonb_build_object('einladung', e.id));
    end if;
    return jsonb_build_object('token', e.token, 'erstellt_am', e.erstellt_am);
  end;
  $$
  $ddl$;
  execute $ddl$
  create or replace function public.einladung_erneuern()
  returns jsonb language plpgsql security definer set search_path = public
  as $$
  declare v_club uuid; v_alt uuid;
  begin
    if not public.ist_leitung() then raise exception 'Nur Trainer oder Admin.' using errcode = '42501'; end if;
    select id into v_club from public.clubs where slug = 'fcfn';
    update public.einladungen set widerrufen_am = now(), widerrufen_von = auth.uid()
     where club_id = v_club and widerrufen_am is null and art = 'spieler' returning id into v_alt;
    perform public.protokollieren('einladung_erneuert', null, jsonb_build_object('alt', v_alt));
    return public.einladung_holen();
  end;
  $$
  $ddl$;

  -- 3) Trainer-Links (nur Admin)
  execute $ddl$
  create or replace function public.trainer_link_erzeugen()
  returns jsonb language plpgsql security definer set search_path = public
  as $$
  declare e record;
  begin
    if not public.has_role('admin') then raise exception 'Trainer-Links erzeugt nur der Admin.' using errcode = '42501'; end if;
    insert into public.einladungen (club_id, token, erstellt_von, art, gueltig_bis)
    select id, replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''), auth.uid(), 'trainer', now() + interval '7 days'
      from public.clubs where slug = 'fcfn'
    returning * into e;
    perform public.protokollieren('trainer_link_erstellt', null, jsonb_build_object('einladung', e.id, 'gueltig_bis', e.gueltig_bis));
    return jsonb_build_object('id', e.id, 'token', e.token, 'gueltig_bis', e.gueltig_bis);
  end;
  $$
  $ddl$;
  execute $ddl$
  create or replace function public.trainer_links_liste()
  returns jsonb language plpgsql stable security definer set search_path = public
  as $$
  begin
    if not public.has_role('admin') then raise exception 'Nur der Admin.' using errcode = '42501'; end if;
    return coalesce((select jsonb_agg(jsonb_build_object(
        'id', e.id, 'token', case when e.widerrufen_am is null and e.benutzt_am is null and e.gueltig_bis > now() then e.token end,
        'erstellt_am', e.erstellt_am, 'gueltig_bis', e.gueltig_bis, 'benutzt_am', e.benutzt_am,
        'benutzt_von', case when e.benutzt_von is not null then public.konto_name(e.benutzt_von) end,
        'widerrufen_am', e.widerrufen_am,
        'stand', case when e.widerrufen_am is not null then 'widerrufen' when e.benutzt_am is not null then 'benutzt'
                      when e.gueltig_bis <= now() then 'abgelaufen' else 'offen' end)
        order by e.erstellt_am desc)
      from public.einladungen e where e.art = 'trainer' and e.erstellt_am > now() - interval '60 days'), '[]'::jsonb);
  end;
  $$
  $ddl$;
  execute $ddl$
  create or replace function public.trainer_link_widerrufen(p_id uuid)
  returns void language plpgsql security definer set search_path = public
  as $$
  begin
    if not public.has_role('admin') then raise exception 'Nur der Admin.' using errcode = '42501'; end if;
    update public.einladungen set widerrufen_am = now(), widerrufen_von = auth.uid()
     where id = p_id and art = 'trainer' and widerrufen_am is null and benutzt_am is null;
    if not found then raise exception 'Link nicht gefunden, schon benutzt oder widerrufen.'; end if;
    perform public.protokollieren('trainer_link_widerrufen', null, jsonb_build_object('einladung', p_id));
  end;
  $$
  $ddl$;

  -- 4) Registrierung
  execute $ddl$
  create or replace function public.handle_new_user()
  returns trigger language plpgsql security definer set search_path = public
  as $$
  declare v_club uuid; v_einl uuid; v_art text; v_name text; p record;
  begin
    select id into v_club from public.clubs where slug = 'fcfn' limit 1;
    v_einl := public.einladung_gueltig(new.raw_user_meta_data->>'einladung');
    if v_einl is null then
      raise exception 'Registrierung nur mit gültigem Einladungslink.' using errcode = '42501';
    end if;
    select art into v_art from public.einladungen where id = v_einl;
    v_name := left(btrim(regexp_replace(coalesce(new.raw_user_meta_data->>'name', ''), '\s+', ' ', 'g')), 60);
    if length(v_name) < 2 then
      raise exception 'Bitte gib deinen Namen an.' using errcode = '22023';
    end if;

    if v_art = 'trainer' then
      -- einmalig: verbrauchen; wer zu spaet kommt, scheitert
      update public.einladungen set benutzt_am = now(), benutzt_von = new.id
       where id = v_einl and benutzt_am is null and widerrufen_am is null and gueltig_bis > now();
      if not found then raise exception 'Registrierung nur mit gültigem Einladungslink.' using errcode = '42501'; end if;
      insert into public.profiles (id, email, club_id, freigabe, anzeigename, angefragt_am, eingeladen_ueber, onboarding_offen, entschieden_am)
      values (new.id, new.email, v_club, 'aktiv', v_name, now(), v_einl, true, now())
      on conflict (id) do nothing;
      insert into public.user_roles (user_id, role, club_id) values (new.id, 'player', v_club), (new.id, 'coach', v_club)
      on conflict (user_id, role, club_id) do nothing;
      insert into public.konto_protokoll (akteur, ziel, ziel_name, aktion, details)
      values (new.id, new.id, v_name, 'registriert_trainer', jsonb_build_object('einladung', v_einl));
      return new;
    end if;

    insert into public.profiles (id, email, club_id, freigabe, anzeigename, angefragt_am, eingeladen_ueber)
    values (new.id, new.email, v_club, 'wartet', v_name, now(), v_einl)
    on conflict (id) do nothing;
    insert into public.user_roles (user_id, role, club_id)
    values (new.id, 'player', v_club)
    on conflict (user_id, role, club_id) do nothing;
    insert into public.konto_protokoll (akteur, ziel, ziel_name, aktion, details)
    values (new.id, new.id, v_name, 'registriert', jsonb_build_object('einladung', v_einl));
    begin
      for p in select distinct r.user_id from public.user_roles r join public.profiles pr on pr.id = r.user_id and pr.freigabe = 'aktiv'
                where r.role in ('coach','admin') loop
        perform public.notify_enqueue(p.user_id, 'anfrage_neu', jsonb_build_object('name', v_name),
          p_dedup => 'anfrage_neu:' || new.id || ':' || p.user_id);
      end loop;
    exception when others then
      raise warning 'anfrage_neu: % %', sqlstate, sqlerrm;
    end;
    return new;
  end;
  $$
  $ddl$;
  revoke execute on function public.handle_new_user() from public, anon, authenticated;

  -- 5) Onboarding des Trainer-Link-Kontos
  execute $ddl$
  create or replace function public.mein_kadereintrag(p_player uuid default null, p_neu boolean default false, p_spielt boolean default true)
  returns jsonb language plpgsql security definer set search_path = public
  as $$
  declare p record; v_club uuid; v_code text; v_pl uuid;
  begin
    if auth.uid() is null then raise exception 'Nicht angemeldet.'; end if;
    select * into p from public.profiles where id = auth.uid() for update;
    if not (p.freigabe = 'aktiv' and p.onboarding_offen and p.player_id is null) then
      raise exception 'Nur im offenen Onboarding ohne Kadereintrag.' using errcode = '42501';
    end if;
    if not coalesce(p_spielt, true) then
      update public.profiles set spielt_mit = false where id = auth.uid();
      perform public.protokollieren('kader_spielt_nicht_mit', auth.uid());
      return public.mein_konto();
    end if;
    select id into v_club from public.clubs where slug = 'fcfn';
    if p_neu then
      select 'p' || lpad((coalesce(max(nullif(regexp_replace(code, '\D', '', 'g'), '')::integer), 0) + 1)::text, 2, '0')
        into v_code from public.players where club_id = v_club;
      insert into public.players (club_id, code, name, hauptposition)
      values (v_club, v_code, p.anzeigename, p.wunsch_position) returning id into v_pl;
    else
      if p_player is null or not exists (select 1 from public.players where id = p_player and ausgeschieden_am is null)
         or exists (select 1 from public.profiles where player_id = p_player) then
        raise exception 'Dieser Kadereintrag ist nicht frei.';
      end if;
      v_pl := p_player;
      update public.players set hauptposition = coalesce(hauptposition, p.wunsch_position) where id = v_pl;
    end if;
    update public.profiles set player_id = v_pl, spielt_mit = true where id = auth.uid();
    perform public.protokollieren('kader_zugeordnet', auth.uid(), jsonb_build_object('kadereintrag', v_pl, 'neu', p_neu));
    return public.mein_konto();
  end;
  $$
  $ddl$;
  execute $ddl$
  create or replace function public.onboarding_abschliessen()
  returns jsonb language plpgsql security definer set search_path = public
  as $$
  begin
    if auth.uid() is null then raise exception 'Nicht angemeldet.'; end if;
    update public.profiles set onboarding_offen = false where id = auth.uid();
    return public.mein_konto();
  end;
  $$
  $ddl$;

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
      'mannschaft', (select coalesce(team_name, name) from public.clubs where slug = 'fcfn'));
  end;
  $$
  $ddl$;

  revoke execute on function public.trainer_link_erzeugen(), public.trainer_links_liste(), public.trainer_link_widerrufen(uuid),
    public.mein_kadereintrag(uuid, boolean, boolean), public.onboarding_abschliessen() from public, anon;
  grant execute on function public.trainer_link_erzeugen(), public.trainer_links_liste(), public.trainer_link_widerrufen(uuid),
    public.mein_kadereintrag(uuid, boolean, boolean), public.onboarding_abschliessen() to authenticated;

  -- --------------------------------------------------------------------------
  -- Gegenprobe
  -- --------------------------------------------------------------------------
  if (select count(*) from public.einladungen where art <> 'spieler') > 0 then v_fehl := v_fehl || 'Bestand art'::text; end if;
  if has_function_privilege('anon', 'public.trainer_link_erzeugen()', 'execute') then v_fehl := v_fehl || 'Rechte'::text; end if;

  select user_id into v_admin from public.user_roles where role = 'admin' limit 1;
  select id into v_club from public.clubs where slug = 'fcfn';
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
    v_r := public.trainer_link_erzeugen();
    v_tok := v_r->>'token'; v_id := (v_r->>'id')::uuid;
    if (public.einladung_pruefen(v_tok))->>'art' <> 'trainer' then v_fehl := v_fehl || 'pruefen art'::text; end if;
    -- Spieler-Link unabhaengig daneben
    if (public.einladung_holen())->>'token' = v_tok then v_fehl := v_fehl || 'Spieler-Link = Trainer-Link'::text; end if;
    -- Registrierung ueber Trainer-Link: aktiv, Spieler + Trainer, Onboarding offen
    insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
    values (v_neu, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gegenprobe0063@invalid.local',
            jsonb_build_object('name', 'Gegen Trainer', 'einladung', v_tok), now(), now());
    if (select freigabe || '/' || onboarding_offen::text || '/' || coalesce(player_id::text, '-') from public.profiles where id = v_neu) <> 'aktiv/true/-'
       or (select string_agg(role, ',' order by role) from public.user_roles where user_id = v_neu) <> 'coach,player' then
      v_fehl := v_fehl || 'Trainer-Konto'::text;
    end if;
    -- zweite Registrierung mit demselben Link scheitert (einmalig)
    begin
      insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
      values (v_neu2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gegenprobe0063b@invalid.local',
              jsonb_build_object('name', 'Zweiter', 'einladung', v_tok), now(), now());
      v_fehl := v_fehl || 'Trainer-Link zweimal'::text;
    exception when sqlstate '42501' then null;
    end;
    -- Kader im Onboarding: neuer Eintrag
    perform set_config('request.jwt.claims', json_build_object('sub', v_neu, 'role', 'authenticated')::text, true);
    perform public.meine_position_setzen('abwehr');
    perform public.mein_kadereintrag(null, true, true);
    select player_id into v_pl from public.profiles where id = v_neu;
    if (select name || '/' || coalesce(hauptposition, '-') from public.players where id = v_pl) <> 'Gegen Trainer/abwehr' then
      v_fehl := v_fehl || 'Kader neu'::text;
    end if;
    begin
      perform public.mein_kadereintrag(null, true, true);  -- zweites Mal verboten
      v_fehl := v_fehl || 'Kader zweimal'::text;
    exception when sqlstate '42501' then null;
    end;
    perform public.onboarding_abschliessen();
    if (select onboarding_offen from public.profiles where id = v_neu) then v_fehl := v_fehl || 'abschliessen'::text; end if;
    -- Trainer (nicht Admin) erzeugt keinen Trainer-Link
    begin
      perform public.trainer_link_erzeugen();
      v_fehl := v_fehl || 'Trainer erzeugt Trainer-Link'::text;
    exception when sqlstate '42501' then null;
    end;
    -- abgelaufen und widerrufen
    perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
    v_r := public.trainer_link_erzeugen();
    update public.einladungen set gueltig_bis = now() - interval '1 minute' where id = (v_r->>'id')::uuid;
    if (public.einladung_pruefen(v_r->>'token'))->>'gueltig' <> 'false' then v_fehl := v_fehl || 'abgelaufen gueltig'::text; end if;
    v_r := public.trainer_link_erzeugen();
    perform public.trainer_link_widerrufen((v_r->>'id')::uuid);
    if (public.einladung_pruefen(v_r->>'token'))->>'gueltig' <> 'false' then v_fehl := v_fehl || 'widerrufen gueltig'::text; end if;
    if jsonb_array_length(public.trainer_links_liste()) < 3 then v_fehl := v_fehl || 'Liste'::text; end if;
    perform set_config('request.jwt.claims', '', true);
    raise exception using errcode = 'P0063', message = 'zurückrollen';
  exception when sqlstate 'P0063' then null;
  end;

  if array_length(v_fehl, 1) > 0 then
    raise exception 'Gegenprobe 0063 fehlgeschlagen: %', v_fehl;
  end if;
  raise notice 'Gegenprobe 0063 bestanden.';
end
$migration$;

commit;

-- RUECKBAU (nicht automatisch): Trainer-Link-Funktionen und
-- mein_kadereintrag/onboarding_abschliessen loeschen, einladung_gueltig/
-- _pruefen/_holen/_erneuern, handle_new_user und mein_konto wie 0061, Index
-- wieder auf (club_id) where widerrufen_am is null (erst ohne Trainer-Links),
-- Spalten entfernen.
