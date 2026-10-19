-- ============================================================================
-- FC Fasanerie-Nord - Migration 0076: Start mit einem Link (Block 1, 19.10.2026)
--
--   1. Freigabe "Ohne Kadereintrag (spielt nicht mit)":
--      anfrage_freigeben(p_profil, p_player, p_name, p_kassenwart, p_ohne_kader).
--      p_ohne_kader = true: kein Kadereintrag, profiles.spielt_mit = false
--      (wie beim Trainer-Link "Ich spiele nicht mit", 0063). Alte Signatur
--      mit vier Parametern entfaellt (die App ruft mit Namen auf).
--   2. Trainer-Links entfallen: offene werden widerrufen, trainer_link_erzeugen
--      lehnt ab. trainer_links_liste/widerrufen bleiben (leer, schaden nicht).
--   3. Mindestens ein Trainer, zusaetzlich zu "Trainer oder Admin" (leitung_anzahl):
--      Den letzten Trainer kann nur der Admin abgeben lassen - in rolle_setzen,
--      mitglied_entfernen und konto_loeschen. Solange es gar keinen Trainer
--      gibt, greift die Regel nicht (nichts abzugeben).
--   4. Mahnzuschlag ab dem Austritt eingefroren: Fuer Strafen eines Ehemaligen
--      zaehlen die Wochen nur bis players.ausgeschieden_am. Gleiche Formel in
--      apply_fine_surcharges (Cron), fines_settle_surcharge (beim Bezahlen)
--      und notify_strafe_betrag (Texte). Offener Betrag bleibt bezahlbar.
--
-- Aufbau: EIN do-Block, Gegenprobe am Ende (Pruefdaten, zurueckgerollt).
-- ============================================================================

begin;

do $migration$
declare
  v_fehl text[] := '{}';
  v_club uuid; v_admin uuid; v_tok text := 'gp0076' || replace(gen_random_uuid()::text, '-', '');
  v_a uuid := gen_random_uuid(); v_b uuid := gen_random_uuid(); v_c uuid := gen_random_uuid();
  v_ex uuid := gen_random_uuid(); v_akt uuid := gen_random_uuid();
  v_fex uuid := gen_random_uuid(); v_fakt uuid := gen_random_uuid();
  v_r record; v_n int; v_s text; v_ok boolean;
begin
  -- ---- Vorher -------------------------------------------------------------------
  if pg_get_function_identity_arguments('public.anfrage_freigeben'::regproc) <> 'p_profil uuid, p_player uuid, p_name text, p_kassenwart boolean' then
    raise exception 'anfrage_freigeben hat nicht die erwartete Signatur - schon eingespielt?';
  end if;
  if to_regprocedure('public.trainer_anzahl(uuid)') is not null then raise exception 'trainer_anzahl gibt es schon.'; end if;

  -- ---- 1. Freigabe ohne Kadereintrag ---------------------------------------------
  drop function public.anfrage_freigeben(uuid, uuid, text, boolean);
  execute $ddl$
  create function public.anfrage_freigeben(p_profil uuid, p_player uuid default null, p_name text default null,
                                           p_kassenwart boolean default false, p_ohne_kader boolean default false)
  returns jsonb language plpgsql security definer set search_path = public
  as $$
  declare p record; v_club uuid; v_pl uuid; v_code text; v_name text; v_kw boolean;
  begin
    if not public.ist_leitung() then raise exception 'Nur Trainer oder Admin.' using errcode = '42501'; end if;
    select * into p from public.profiles where id = p_profil for update;
    if p.id is null or p.freigabe <> 'wartet' then raise exception 'Keine offene Anfrage.'; end if;
    select id into v_club from public.clubs where slug = 'fcfn';
    if coalesce(p_ohne_kader, false) then
      -- 0076: spielt nicht mit - kein Kadereintrag, wie "Ich spiele nicht mit" beim Trainer-Link
      v_pl := null;
    elsif p_player is not null then
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
           kassenwart_wunsch = false, paypal_frage = paypal_frage or v_kw,
           spielt_mit = case when coalesce(p_ohne_kader, false) then false else spielt_mit end
     where id = p_profil;
    perform public.protokollieren('freigegeben', p_profil,
      jsonb_build_object('kadereintrag', v_pl, 'neu', p_player is null and not coalesce(p_ohne_kader, false),
                         'ohne_kader', coalesce(p_ohne_kader, false)));
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
    return jsonb_build_object('profil', p_profil, 'spieler', v_pl, 'kassenwart', v_kw, 'ohne_kader', coalesce(p_ohne_kader, false));
  end;
  $$
  $ddl$;
  revoke all on function public.anfrage_freigeben(uuid, uuid, text, boolean, boolean) from public, anon;
  grant execute on function public.anfrage_freigeben(uuid, uuid, text, boolean, boolean) to authenticated;

  -- ---- 2. Trainer-Links entfallen ------------------------------------------------
  update public.einladungen set widerrufen_am = now()
   where art = 'trainer' and widerrufen_am is null and benutzt_am is null;
  execute $ddl$
  create or replace function public.trainer_link_erzeugen()
  returns jsonb language plpgsql security definer set search_path = public
  as $$
  begin
    raise exception 'Trainer-Links gibt es nicht mehr. Alle kommen über den Spieler-Link, Trainer vergibst du unter Rollen.' using errcode = '42501';
  end;
  $$
  $ddl$;

  -- ---- 3. Mindestens ein Trainer -------------------------------------------------
  execute $ddl$
  create function public.trainer_anzahl(p_ohne_profil uuid default null)
  returns integer language sql stable security definer set search_path = public
  as $$
    select count(distinct r.user_id)::integer
      from public.user_roles r join public.profiles p on p.id = r.user_id and p.freigabe = 'aktiv'
     where r.role = 'coach' and (p_ohne_profil is null or r.user_id <> p_ohne_profil);
  $$
  $ddl$;
  revoke all on function public.trainer_anzahl(uuid) from public, anon, authenticated;

  execute $ddl$
  create or replace function public.rolle_setzen(p_profil uuid, p_rolle text, p_an boolean, p_trotzdem boolean default false)
  returns jsonb language plpgsql security definer set search_path = public
  as $$
  declare v_club uuid; v_hat boolean; v_txt text; v_off record; v_hinweis text := '';
  begin
    if not public.ist_leitung() then raise exception 'Nur Trainer oder Admin.' using errcode = '42501'; end if;
    if p_rolle not in ('coach','treasurer','admin') then raise exception 'Unbekannte Rolle.'; end if;
    if p_rolle = 'admin' and not public.has_role('admin') then
      raise exception 'Die Rolle Admin vergibt nur der Admin.' using errcode = '42501';
    end if;
    -- 0069: Kassenwart gibt sich niemand selbst, ausser dem Admin (sonst waere Punkt 3 umgehbar).
    if p_rolle = 'treasurer' and p_an and p_profil = auth.uid() and not public.has_role('admin') then
      raise exception 'Kassenwart vergibt dir ein anderer Trainer oder der Admin.' using errcode = '42501';
    end if;
    if not exists (select 1 from public.profiles where id = p_profil and freigabe = 'aktiv') then
      raise exception 'Konto nicht gefunden oder nicht freigegeben.';
    end if;
    v_hat := exists (select 1 from public.user_roles where user_id = p_profil and role = p_rolle);
    if v_hat = p_an then return case when public.ist_leitung() then public.mitglieder_liste() else '[]'::jsonb end; end if;
    select id into v_club from public.clubs where slug = 'fcfn';
    if p_an then
      insert into public.user_roles (user_id, role, club_id) values (p_profil, p_rolle, v_club) on conflict do nothing;
      if p_rolle = 'treasurer' then update public.profiles set paypal_frage = true where id = p_profil; end if;
    else
      if p_rolle in ('coach','admin') and public.leitung_anzahl(p_profil, p_rolle) = 0 then
        raise exception 'Mindestens ein Konto muss Trainer oder Admin bleiben.';
      end if;
      -- 0076: den letzten Trainer gibt nur der Admin ab
      if p_rolle = 'coach' and public.trainer_anzahl(p_profil) = 0 and not public.has_role('admin') then
        raise exception 'Der letzte Trainer kann die Rolle nicht abgeben. Das kann nur der Admin ändern.' using errcode = '42501';
      end if;
      if p_rolle = 'treasurer' then
        select * into v_off from public.kassenwart_offen_intern(p_profil);
        if v_off.anzahl > 0 and not coalesce(p_trotzdem, false) then
          raise exception 'Offene Meldungen an diesen Kassenwart: % (% €).', v_off.anzahl, v_off.summe using errcode = 'P0K01';
        end if;
        if v_off.anzahl > 0 then
          -- Die Meldungen bleiben gemeldet und gehen an die neue Kasse, markiert.
          update public.fines f set an_vorherigen = true
           where f.status = 'gemeldet' and not f.an_vorherigen and f.zahlung_an = p_profil;
          perform public.protokollieren('kassenwart_gewechselt', p_profil,
            jsonb_build_object('rolle', 'treasurer', 'offen', v_off.anzahl, 'summe', v_off.summe));
          v_hinweis := ' ' || v_off.anzahl || case when v_off.anzahl = 1 then ' offene Meldung geht' else ' offene Meldungen gehen' end || ' an die neue Kasse.';
        end if;
      end if;
      delete from public.user_roles where user_id = p_profil and role = p_rolle;
      if p_rolle = 'treasurer' then
        update public.profiles set paypal_frage = false where id = p_profil;
        -- E8: Der Link des bisherigen Kassenwarts wird nicht mehr gezeigt.
        update public.team_settings set paypal_name = null, paypal_von = null, paypal_am = now()
         where paypal_von = p_profil;
      end if;
    end if;
    perform public.protokollieren(case when p_an then 'rolle_vergeben' else 'rolle_entzogen' end, p_profil,
      jsonb_build_object('rolle', p_rolle));
    if p_profil <> auth.uid() then
      if p_rolle = 'treasurer' then
        perform public.notify_enqueue(p_profil, case when p_an then 'kasse_neu' else 'kasse_abgegeben' end,
          case when p_an then '{}'::jsonb else jsonb_build_object('hinweis', v_hinweis) end,
          p_dedup => 'kasse:' || p_profil || ':' || (extract(epoch from clock_timestamp()) * 1000)::bigint);
      else
        v_txt := 'Du bist ' || case when p_an then 'jetzt ' else 'nicht mehr ' end
                 || case p_rolle when 'coach' then 'Trainer' else 'Admin' end || '.';
        perform public.notify_enqueue(p_profil, 'rolle_geaendert', jsonb_build_object('aenderung', v_txt),
          p_dedup => 'rolle_geaendert:' || p_profil || ':' || p_rolle || ':' || (extract(epoch from clock_timestamp()) * 1000)::bigint);
      end if;
    end if;
    return case when public.ist_leitung() then public.mitglieder_liste() else '[]'::jsonb end;
  end;
  $$
  $ddl$;

  execute $ddl$
  create or replace function public.mitglied_entfernen(p_profil uuid)
  returns void language plpgsql security definer set search_path = public
  as $$
  begin
    if not public.ist_leitung() then raise exception 'Nur Trainer oder Admin.' using errcode = '42501'; end if;
    if p_profil = auth.uid() then raise exception 'Das eigene Konto löschst du im Profil.'; end if;
    if not exists (select 1 from public.profiles where id = p_profil) then raise exception 'Konto nicht gefunden.'; end if;
    if exists (select 1 from public.user_roles where user_id = p_profil and role = 'admin') and not public.has_role('admin') then
      raise exception 'Den Admin entfernt nur der Admin.' using errcode = '42501';
    end if;
    if public.leitung_anzahl(p_profil, null) = 0 then
      raise exception 'Mindestens ein Konto muss Trainer oder Admin bleiben.';
    end if;
    -- 0076: den letzten Trainer entfernt nur der Admin
    if exists (select 1 from public.user_roles where user_id = p_profil and role = 'coach')
       and public.trainer_anzahl(p_profil) = 0 and not public.has_role('admin') then
      raise exception 'Das ist der letzte Trainer. Entfernen kann ihn nur der Admin.' using errcode = '42501';
    end if;
    perform public.konto_entfernen_intern(p_profil, 'entfernt');
  end;
  $$
  $ddl$;

  execute $ddl$
  create or replace function public.konto_loeschen()
  returns void language plpgsql security definer set search_path = public
  as $$
  begin
    if auth.uid() is null then raise exception 'Nicht angemeldet.'; end if;
    if public.ist_leitung() and public.leitung_anzahl(auth.uid(), null) = 0 then
      raise exception 'Du bist das letzte Konto mit Trainer- oder Admin-Rolle. Gib die Rolle erst an jemand anderen.';
    end if;
    -- 0076: der letzte Trainer gibt die Rolle erst weiter (der Admin darf)
    if public.has_role('coach') and public.trainer_anzahl(auth.uid()) = 0 and not public.has_role('admin') then
      raise exception 'Du bist der letzte Trainer. Mach erst jemand anderen zum Trainer.';
    end if;
    perform public.konto_entfernen_intern(auth.uid(), 'konto_geloescht');
  end;
  $$
  $ddl$;

  -- ---- 4. Mahnzuschlag ab Austritt eingefroren ------------------------------------
  execute $ddl$
  create or replace function public.apply_fine_surcharges()
  returns integer language plpgsql security definer set search_path = public
  as $$
  declare
    v_count integer;
  begin
    -- 0076: Wochen zaehlen bei Ehemaligen nur bis zum Austritt
    update public.fines f
       set surcharge            = least(5, greatest(0, floor(extract(epoch from (least(now(), coalesce(p.ausgeschieden_am, now())) - f.created_at)) / 604800)))::int * 2,
           surcharge_updated_at = current_date
      from public.players p
     where p.id = f.player_id
       and f.paid = false
       and least(5, greatest(0, floor(extract(epoch from (least(now(), coalesce(p.ausgeschieden_am, now())) - f.created_at)) / 604800)))::int * 2 <> f.surcharge;

    get diagnostics v_count = row_count;
    return v_count;
  end;
  $$
  $ddl$;

  execute $ddl$
  create or replace function public.fines_settle_surcharge()
  returns trigger language plpgsql security definer set search_path = public
  as $$
  declare v_aus timestamptz;
  begin
    if new.paid = true and (old.paid is distinct from true) then
      -- 0076: bei Ehemaligen eingefroren ab dem Austritt
      select ausgeschieden_am into v_aus from public.players where id = new.player_id;
      new.surcharge            := least(5, greatest(0, floor(extract(epoch from (least(now(), coalesce(v_aus, now())) - new.created_at)) / 604800)))::int * 2;
      new.surcharge_updated_at := current_date;
    end if;
    return new;
  end;
  $$
  $ddl$;

  execute $ddl$
  create or replace function public.notify_strafe_betrag(f public.fines)
  returns numeric language sql stable security definer set search_path = public
  as $$
    select coalesce(f.base_amount, (select c.amount from public.fine_catalog c where c.id = f.catalog_id), 0)
         + case when f.status = 'bestätigt' then coalesce(f.surcharge, 0)
                else least(5, greatest(0, floor(extract(epoch from (
                       least(now(), coalesce((select p.ausgeschieden_am from public.players p where p.id = f.player_id), now()))
                       - f.created_at)) / 604800)))::int * 2
           end;
  $$
  $ddl$;

  -- ---- Gegenprobe ------------------------------------------------------------
  if has_function_privilege('anon', 'public.anfrage_freigeben(uuid, uuid, text, boolean, boolean)', 'execute') then v_fehl := v_fehl || 'anon darf freigeben'::text; end if;
  if not has_function_privilege('authenticated', 'public.anfrage_freigeben(uuid, uuid, text, boolean, boolean)', 'execute') then v_fehl := v_fehl || 'grant freigeben fehlt'::text; end if;
  if has_function_privilege('authenticated', 'public.trainer_anzahl(uuid)', 'execute') then v_fehl := v_fehl || 'trainer_anzahl offen'::text; end if;
  select count(*) into v_n from public.einladungen where art = 'trainer' and widerrufen_am is null and benutzt_am is null;
  if v_n <> 0 then v_fehl := v_fehl || 'offene Trainer-Links'::text; end if;

  select id into v_club from public.clubs where slug = 'fcfn';
  select r.user_id into v_admin from public.user_roles r join public.profiles p on p.id = r.user_id and p.freigabe = 'aktiv' where r.role = 'admin' limit 1;
  begin
    update public.einladungen set widerrufen_am = now() where widerrufen_am is null and art = 'spieler';
    insert into public.einladungen (club_id, token) values (v_club, v_tok);
    insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
      (v_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gp0076a@invalid.local', jsonb_build_object('name', 'Gegen Eins', 'einladung', v_tok), now(), now()),
      (v_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gp0076b@invalid.local', jsonb_build_object('name', 'Gegen Zwei', 'einladung', v_tok), now(), now()),
      (v_c, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gp0076c@invalid.local', jsonb_build_object('name', 'Gegen Drei', 'einladung', v_tok), now(), now());

    -- 1. Freigabe ohne Kadereintrag (als Admin)
    perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
    perform public.anfrage_freigeben(v_a, null, null, false, true);
    select freigabe || '/' || coalesce(player_id::text, '-') || '/' || coalesce(spielt_mit::text, '-') into v_s from public.profiles where id = v_a;
    if v_s <> 'aktiv/-/false' then v_fehl := v_fehl || ('ohne Kader: ' || v_s); end if;
    perform public.anfrage_freigeben(v_b);   -- neuer Kadereintrag wie bisher
    perform public.anfrage_freigeben(v_c);
    select count(*) into v_n from public.profiles where id in (v_b, v_c) and player_id is not null and freigabe = 'aktiv';
    if v_n <> 2 then v_fehl := v_fehl || 'Freigabe mit Kader kaputt'::text; end if;

    -- 2. Trainer-Link erzeugen lehnt ab
    v_ok := false;
    begin perform public.trainer_link_erzeugen(); exception when insufficient_privilege then v_ok := true; end;
    if not v_ok then v_fehl := v_fehl || 'Trainer-Link erzeugt'::text; end if;

    -- 3. letzter Trainer: B wird Trainer (Admin), B kann es sich nicht nehmen, Admin darf
    perform public.rolle_setzen(v_b, 'coach', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_b, 'role', 'authenticated')::text, true);
    v_ok := false;
    begin perform public.rolle_setzen(v_b, 'coach', false); exception when insufficient_privilege then v_ok := true; end;
    if not v_ok then v_fehl := v_fehl || 'letzter Trainer gab Rolle ab'::text; end if;
    -- B kann C zum Trainer machen, danach darf B abgeben
    perform public.rolle_setzen(v_c, 'coach', true);
    perform public.rolle_setzen(v_b, 'coach', false);
    if exists (select 1 from public.user_roles where user_id = v_b and role = 'coach') then v_fehl := v_fehl || 'Abgabe mit zweitem Trainer ging nicht'::text; end if;
    -- C ist jetzt letzter Trainer: Konto loeschen verboten
    perform set_config('request.jwt.claims', json_build_object('sub', v_c, 'role', 'authenticated')::text, true);
    v_ok := false;
    begin perform public.konto_loeschen(); exception when others then v_ok := sqlerrm like '%letzte Trainer%'; end;
    if not v_ok then v_fehl := v_fehl || 'letzter Trainer konnte Konto loeschen'::text; end if;
    -- Admin darf den letzten Trainer abgeben lassen
    perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
    perform public.rolle_setzen(v_c, 'coach', false);
    if exists (select 1 from public.user_roles where user_id = v_c and role = 'coach') then v_fehl := v_fehl || 'Admin konnte letzten Trainer nicht aendern'::text; end if;
    perform set_config('request.jwt.claims', '', true);

    -- 4. Mahnzuschlag: Strafen von vor 30 Tagen, Ehemaliger seit 10 Tagen
    insert into public.players (id, club_id, code, name, ausgeschieden_am) values (v_ex, v_club, 'gp76e', 'Ehemaliger Spieler', now() - interval '10 days');
    insert into public.players (id, club_id, code, name) values (v_akt, v_club, 'gp76a', 'Gegen Aktiv');
    insert into public.fines (id, club_id, player_id, catalog_id, date, created_at)
      select v_fex, v_club, v_ex, k.id, current_date - 30, now() - interval '30 days' from public.fine_catalog k where k.club_id = v_club and k.code = 'k04';
    insert into public.fines (id, club_id, player_id, catalog_id, date, created_at)
      select v_fakt, v_club, v_akt, k.id, current_date - 30, now() - interval '30 days' from public.fine_catalog k where k.club_id = v_club and k.code = 'k04';
    perform public.apply_fine_surcharges();
    select (select surcharge from public.fines where id = v_fex)::int::text || '/' || (select surcharge from public.fines where id = v_fakt)::int::text into v_s;
    if v_s <> '4/8' then v_fehl := v_fehl || ('Zuschlag ex/aktiv: ' || coalesce(v_s, '-')); end if;
    select public.notify_strafe_betrag(f) - coalesce(f.base_amount, 0) into v_n from public.fines f where f.id = v_fex;
    if v_n <> 4 then v_fehl := v_fehl || ('Text-Betrag ex: ' || v_n); end if;
    update public.fines set paid = true, status = 'bestätigt', payment_method = 'bar', paid_at = now() where id = v_fex;
    select surcharge into v_n from public.fines where id = v_fex;
    if v_n <> 4 then v_fehl := v_fehl || ('beim Bezahlen: ' || v_n); end if;

    raise exception using errcode = 'P0076', message = 'zurückrollen';
  exception when sqlstate 'P0076' then null;
  end;
  if exists (select 1 from auth.users where id in (v_a, v_b, v_c)) or exists (select 1 from public.players where id in (v_ex, v_akt)) then
    v_fehl := v_fehl || 'Pruefdaten nicht zurueckgerollt'::text;
  end if;

  if array_length(v_fehl, 1) > 0 then
    raise exception 'Gegenprobe 0076 fehlgeschlagen: %', v_fehl;
  end if;
  raise notice 'Gegenprobe 0076 bestanden.';
end
$migration$;

commit;

-- RUECKBAU (nicht automatisch): Funktionen aus supabase/cleanup/backup-2026-10-19/funktionen-vor-0076.txt,
-- anfrage_freigeben mit vier Parametern wieder anlegen (grant authenticated), drop function trainer_anzahl(uuid).
