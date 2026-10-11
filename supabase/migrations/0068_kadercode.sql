-- ============================================================================
-- FC Fasanerie-Nord - Migration 0068: Code neuer Kadereintraege
--
-- anfrage_freigeben (0061/0064) und mein_kadereintrag (0063) bildeten den Code
-- eines neuen Kadereintrags als 'p' || lpad(max(Ziffern aller Codes) + 1, 2).
-- Zwei Fehler:
--   - Ziffern aus fremden Codes zaehlten mit, etwa aus dem Code eines
--     anonymisierten Ehemaligen ('x' || md5-Teil, 0061), und ergaben grosse
--     Zahlen;
--   - lpad(..., 2) kuerzt laengere Zahlen auf zwei Stellen.
-- Folge: Nach der ersten Kontoloeschung konnte eine Freigabe mit neuem
-- Kadereintrag an "players_club_id_code_key" scheitern (im E2E-Lauf gefunden).
-- Neu: nur Codes p<Zahl> zaehlen, Laenge mindestens zwei Stellen, nie
-- gekuerzt. Bestehende Codes bleiben unveraendert.
-- Aufbau: EIN do-Block, Gegenprobe am Ende (zurueckgerollt).
-- ============================================================================

begin;

do $migration$
declare
  v_fehl text[] := '{}';
  v_admin uuid; v_club uuid; v_tok text; v_a uuid := gen_random_uuid(); v_b uuid := gen_random_uuid(); v_c uuid := gen_random_uuid();
  v_soll text;
begin
  execute $ddl$
  create or replace function public.anfrage_freigeben(p_profil uuid, p_player uuid default null, p_name text default null, p_kassenwart boolean default false)
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
      -- 0068: nur Codes der Form p<Zahl> zaehlen (nicht 'x...' der Ehemaligen), und lpad kuerzt nicht.
      select 'p' || lpad(n::text, greatest(2, length(n::text)), '0') into v_code
        from (select coalesce(max(substring(code from '^p([0-9]{1,9})$')::bigint), 0) + 1 as n
                from public.players where club_id = v_club) z;
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
      -- 0068: nur Codes der Form p<Zahl> zaehlen (nicht 'x...' der Ehemaligen), und lpad kuerzt nicht.
      select 'p' || lpad(n::text, greatest(2, length(n::text)), '0') into v_code
        from (select coalesce(max(substring(code from '^p([0-9]{1,9})$')::bigint), 0) + 1 as n
                from public.players where club_id = v_club) z;
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

  -- --------------------------------------------------------------------------
  -- Gegenprobe: ein Ehemaliger mit 'x'-Code, dann zwei neue Eintraege
  -- --------------------------------------------------------------------------
  select user_id into v_admin from public.user_roles where role = 'admin' limit 1;
  select id into v_club from public.clubs where slug = 'fcfn';
  select 'p' || lpad(n::text, greatest(2, length(n::text)), '0') into v_soll
    from (select coalesce(max(substring(code from '^p([0-9]{1,9})$')::bigint), 0) + 1 as n from public.players where club_id = v_club) z;
  begin
    insert into public.players (club_id, code, name, ausgeschieden_am) values (v_club, 'x9876543a', 'Ehemaliger Spieler', now()), (v_club, 'e2etr123456', 'Test', null);
    perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
    v_tok := (public.einladung_holen())->>'token';
    insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
      (v_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gp0068a@invalid.local', jsonb_build_object('name', 'Neu Eins', 'einladung', v_tok), now(), now()),
      (v_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gp0068b@invalid.local', jsonb_build_object('name', 'Neu Zwei', 'einladung', v_tok), now(), now());
    perform public.anfrage_freigeben(v_a);
    perform public.anfrage_freigeben(v_b);
    if (select string_agg(pl.code, ',' order by pl.code) from public.profiles p join public.players pl on pl.id = p.player_id where p.id in (v_a, v_b))
       <> v_soll || ',' || 'p' || lpad((substring(v_soll from 2)::int + 1)::text, 2, '0') then
      v_fehl := v_fehl || 'Codes Freigabe'::text;
    end if;
    -- Trainer-Link: neuer Eintrag im Onboarding
    v_tok := (public.trainer_link_erzeugen())->>'token';
    insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
      (v_c, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gp0068c@invalid.local', jsonb_build_object('name', 'Neu Drei', 'einladung', v_tok), now(), now());
    perform set_config('request.jwt.claims', json_build_object('sub', v_c, 'role', 'authenticated')::text, true);
    perform public.mein_kadereintrag(null, true, true);
    if (select pl.code from public.profiles p join public.players pl on pl.id = p.player_id where p.id = v_c)
       <> 'p' || lpad((substring(v_soll from 2)::int + 2)::text, 2, '0') then
      v_fehl := v_fehl || 'Code Trainer-Link'::text;
    end if;
    perform set_config('request.jwt.claims', '', true);
    raise exception using errcode = 'P0068', message = 'zurückrollen';
  exception when sqlstate 'P0068' then null;
  end;

  if array_length(v_fehl, 1) > 0 then
    raise exception 'Gegenprobe 0068 fehlgeschlagen: %', v_fehl;
  end if;
  raise notice 'Gegenprobe 0068 bestanden (naechster Code %).', v_soll;
end
$migration$;

commit;

-- RUECKBAU (nicht automatisch): anfrage_freigeben wie 0064, mein_kadereintrag wie 0063.
