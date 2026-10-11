-- ============================================================================
-- FC Fasanerie-Nord - Migration 0064: Onboarding Nacharbeit 5, Kassenwart-Wunsch
--
--   1. profiles.kassenwart_wunsch: bei der Registrierung ueber den
--      Spieler-Link angekreuzt ("Ich bin Kassenwart"). Der Wunsch allein gibt
--      KEIN Recht; Rechte haengen weiter nur an user_roles.
--   2. anfragen_liste und mein_konto zeigen den Wunsch.
--   3. anfrage_freigeben(p_profil, p_player, p_name, p_kassenwart): der Trainer
--      entscheidet getrennt: Spieler freigeben ja/nein (freigeben/ablehnen) und
--      Kassenwart bestaetigen ja/nein. Erst die Bestaetigung vergibt die Rolle
--      und setzt die PayPal-Frage (E8). Beides wird protokolliert.
--   4. anfrage_ablehnen: ein offener Wunsch verfaellt mit, protokolliert.
--
-- RECHTE: wie 0061 (Rollenpruefung in den Funktionen).
-- Aufbau: EIN do-Block, Gegenprobe am Ende (zurueckgerollt).
-- ============================================================================

begin;

do $migration$
declare
  v_fehl text[] := '{}';
  v_admin uuid; v_club uuid; v_tok text;
  v_a uuid := gen_random_uuid(); v_b uuid := gen_random_uuid(); v_c uuid := gen_random_uuid();
begin
  alter table public.profiles add column if not exists kassenwart_wunsch boolean not null default false;

  -- 1) Registrierung: wie 0063, dazu der Wunsch beim Spieler-Link
  execute $ddl$
  create or replace function public.handle_new_user()
  returns trigger language plpgsql security definer set search_path = public
  as $$
  declare v_club uuid; v_einl uuid; v_art text; v_name text; v_wunsch boolean; p record;
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

    v_wunsch := lower(coalesce(new.raw_user_meta_data->>'kassenwart', '')) in ('true', '1', 'ja');
    insert into public.profiles (id, email, club_id, freigabe, anzeigename, angefragt_am, eingeladen_ueber, kassenwart_wunsch)
    values (new.id, new.email, v_club, 'wartet', v_name, now(), v_einl, v_wunsch)
    on conflict (id) do nothing;
    insert into public.user_roles (user_id, role, club_id)
    values (new.id, 'player', v_club)
    on conflict (user_id, role, club_id) do nothing;
    insert into public.konto_protokoll (akteur, ziel, ziel_name, aktion, details)
    values (new.id, new.id, v_name, 'registriert', jsonb_build_object('einladung', v_einl, 'kassenwart_wunsch', v_wunsch));
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

  -- 2) Anfragen mit Wunsch
  execute $ddl$
  create or replace function public.anfragen_liste()
  returns jsonb language plpgsql stable security definer set search_path = public
  as $$
  begin
    if not public.ist_leitung() then raise exception 'Nur Trainer oder Admin.' using errcode = '42501'; end if;
    return coalesce((select jsonb_agg(jsonb_build_object(
        'id', p.id, 'name', p.anzeigename, 'email', p.email, 'angefragt_am', p.angefragt_am,
        'position', p.wunsch_position, 'freigabe', p.freigabe, 'kassenwart_wunsch', p.kassenwart_wunsch,
        'datenschutz', exists (select 1 from public.einwilligungen e where e.profile_id = p.id and e.art = 'datenschutz' and e.widerrufen_am is null))
        order by p.angefragt_am)
      from public.profiles p where p.freigabe = 'wartet'), '[]'::jsonb);
  end;
  $$
  $ddl$;

  -- 3) Freigabe mit getrennter Kassenwart-Entscheidung
  drop function if exists public.anfrage_freigeben(uuid, uuid, text);
  execute $ddl$
  create function public.anfrage_freigeben(p_profil uuid, p_player uuid default null, p_name text default null, p_kassenwart boolean default false)
  returns jsonb language plpgsql security definer set search_path = public
  as $$
  declare p record; v_club uuid; v_pl uuid; v_code text; v_name text; v_kw boolean;
  begin
    if not public.ist_leitung() then raise exception 'Nur Trainer oder Admin.' using errcode = '42501'; end if;
    select * into p from public.profiles where id = p_profil for update;
    if p.id is null or p.freigabe <> 'wartet' then raise exception 'Keine offene Anfrage.'; end if;
    select id into v_club from public.clubs where slug = 'fcfn';
    if p_player is not null then
      if not exists (select 1 from public.players where id = p_player and ausgeschieden_am is null) then
        raise exception 'Kadereintrag nicht gefunden.';
      end if;
      if exists (select 1 from public.profiles where player_id = p_player) then
        raise exception 'Dieser Kadereintrag hat schon ein Konto.';
      end if;
      v_pl := p_player;
      update public.players set hauptposition = coalesce(hauptposition, p.wunsch_position) where id = v_pl;
    else
      v_name := left(btrim(coalesce(nullif(btrim(p_name), ''), p.anzeigename, '')), 60);
      if length(v_name) < 2 then raise exception 'Name fehlt.'; end if;
      select 'p' || lpad((coalesce(max(nullif(regexp_replace(code, '\D', '', 'g'), '')::integer), 0) + 1)::text, 2, '0')
        into v_code from public.players where club_id = v_club;
      insert into public.players (club_id, code, name, hauptposition)
      values (v_club, v_code, v_name, p.wunsch_position) returning id into v_pl;
    end if;
    v_kw := coalesce(p_kassenwart, false) and p.kassenwart_wunsch;
    update public.profiles set player_id = v_pl, freigabe = 'aktiv', entschieden_von = auth.uid(), entschieden_am = now(),
           kassenwart_wunsch = false, paypal_frage = paypal_frage or v_kw
     where id = p_profil;
    perform public.protokollieren('freigegeben', p_profil,
      jsonb_build_object('kadereintrag', v_pl, 'neu', p_player is null));
    if p.kassenwart_wunsch then
      if v_kw then
        insert into public.user_roles (user_id, role, club_id) values (p_profil, 'treasurer', v_club) on conflict do nothing;
        perform public.protokollieren('kassenwart_bestaetigt', p_profil, jsonb_build_object('rolle', 'treasurer'));
      else
        perform public.protokollieren('kassenwart_nicht_bestaetigt', p_profil);
      end if;
    end if;
    perform public.notify_enqueue(p_profil, 'konto_freigegeben',
      jsonb_build_object('mannschaft', (select coalesce(team_name, name) from public.clubs where slug = 'fcfn')),
      p_dedup => 'konto_freigegeben:' || p_profil);
    return jsonb_build_object('profil', p_profil, 'spieler', v_pl, 'kassenwart', v_kw);
  end;
  $$
  $ddl$;
  revoke execute on function public.anfrage_freigeben(uuid, uuid, text, boolean) from public, anon;
  grant execute on function public.anfrage_freigeben(uuid, uuid, text, boolean) to authenticated;

  execute $ddl$
  create or replace function public.anfrage_ablehnen(p_profil uuid)
  returns void language plpgsql security definer set search_path = public
  as $$
  declare v_wunsch boolean;
  begin
    if not public.ist_leitung() then raise exception 'Nur Trainer oder Admin.' using errcode = '42501'; end if;
    select kassenwart_wunsch into v_wunsch from public.profiles where id = p_profil and freigabe = 'wartet' for update;
    if not found then raise exception 'Keine offene Anfrage.'; end if;
    update public.profiles set freigabe = 'abgelehnt', entschieden_von = auth.uid(), entschieden_am = now(), kassenwart_wunsch = false
     where id = p_profil;
    perform public.protokollieren('abgelehnt', p_profil);
    if v_wunsch then perform public.protokollieren('kassenwart_nicht_bestaetigt', p_profil); end if;
  end;
  $$
  $ddl$;

  -- mein_konto: wie 0063, dazu der offene Wunsch
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
      'mannschaft', (select coalesce(team_name, name) from public.clubs where slug = 'fcfn'));
  end;
  $$
  $ddl$;

  -- --------------------------------------------------------------------------
  -- Gegenprobe
  -- --------------------------------------------------------------------------
  select user_id into v_admin from public.user_roles where role = 'admin' limit 1;
  select id into v_club from public.clubs where slug = 'fcfn';
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
    v_tok := (public.einladung_holen())->>'token';
    insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
      (v_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gp0064a@invalid.local', jsonb_build_object('name', 'Kasse Ja', 'einladung', v_tok, 'kassenwart', true), now(), now()),
      (v_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gp0064b@invalid.local', jsonb_build_object('name', 'Kasse Nein', 'einladung', v_tok, 'kassenwart', true), now(), now()),
      (v_c, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gp0064c@invalid.local', jsonb_build_object('name', 'Ohne Wunsch', 'einladung', v_tok), now(), now());
    if (select count(*) from public.profiles where id in (v_a, v_b) and kassenwart_wunsch) <> 2
       or (select kassenwart_wunsch from public.profiles where id = v_c) then v_fehl := v_fehl || 'Wunsch gespeichert'::text; end if;
    if (select count(*) from jsonb_array_elements(public.anfragen_liste()) x where (x->>'kassenwart_wunsch')::boolean) < 2 then v_fehl := v_fehl || 'Liste'::text; end if;
    if exists (select 1 from public.user_roles where user_id in (v_a, v_b) and role = 'treasurer') then v_fehl := v_fehl || 'Rolle zu frueh'::text; end if;
    perform public.anfrage_freigeben(v_a, null, null, true);
    perform public.anfrage_freigeben(v_b, null, null, false);
    perform public.anfrage_freigeben(v_c, null, null, true);  -- ohne Wunsch: keine Rolle
    if (select string_agg(user_id::text, ',') from public.user_roles where user_id in (v_a, v_b, v_c) and role = 'treasurer') is distinct from v_a::text
      then v_fehl := v_fehl || 'Rolle'::text; end if;
    if not (select paypal_frage from public.profiles where id = v_a) or (select paypal_frage from public.profiles where id = v_b) then v_fehl := v_fehl || 'PayPal-Frage'::text; end if;
    if (select count(*) from public.konto_protokoll where ziel in (v_a, v_b) and aktion in ('kassenwart_bestaetigt', 'kassenwart_nicht_bestaetigt')) <> 2 then v_fehl := v_fehl || 'Protokoll'::text; end if;
    perform set_config('request.jwt.claims', '', true);
    raise exception using errcode = 'P0064', message = 'zurückrollen';
  exception when sqlstate 'P0064' then null;
  end;

  if array_length(v_fehl, 1) > 0 then
    raise exception 'Gegenprobe 0064 fehlgeschlagen: %', v_fehl;
  end if;
  raise notice 'Gegenprobe 0064 bestanden.';
end
$migration$;

commit;

-- RUECKBAU (nicht automatisch): anfrage_freigeben(uuid,uuid,text,boolean)
-- loeschen und die 3-stellige Fassung aus 0061 wieder anlegen;
-- handle_new_user wie 0063, anfragen_liste/anfrage_ablehnen wie 0061,
-- mein_konto wie 0063, Spalte kassenwart_wunsch entfernen.
