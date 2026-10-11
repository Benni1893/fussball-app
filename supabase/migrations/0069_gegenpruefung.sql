-- ============================================================================
-- FC Fasanerie-Nord - Migration 0069: Nachtrag aus der Gegenpruefung
--
--   1. ist_mitglied(): Ein Konto im offenen Onboarding (Trainer-Link, 0063)
--      gilt erst nach der Datenschutz-Zustimmung als Mitglied. Damit greifen
--      auch has_role/ist_leitung und alle RLS-Regeln erst danach. Bestehende
--      Konten (onboarding_offen = false) sind nicht betroffen.
--   2. rolle_setzen: Kassenwart kann sich niemand selbst geben, ausser dem
--      Admin. Sonst koennte ein Trainer ueber sich selbst den PayPal-Link
--      aendern (Punkt 3).
--   3. konto_entfernen_intern: Entfernen oder Loeschen eines Kassenwarts mit
--      offenen Meldungen markiert diese "an vorherigen Kassenwart gezahlt",
--      bevor das Zahlungsziel anonymisiert wird.
--   4. set_my_player (0061): Wer schon einen Kadereintrag hat, kann ihn nicht
--      selbst wechseln oder loesen (E6: der Trainer ordnet zu). Konten ohne
--      Kadereintrag waehlen wie bisher.
-- Aufbau: EIN do-Block, Gegenprobe am Ende (zurueckgerollt).
-- ============================================================================

begin;

do $migration$
declare
  v_fehl text[] := '{}';
  v_admin uuid; v_club uuid; v_tok text; v_t uuid := gen_random_uuid(); v_k uuid := gen_random_uuid(); v_s uuid := gen_random_uuid();
  v_pl uuid; v_frei uuid := gen_random_uuid(); v_f uuid; v_ok boolean; v_n integer;
begin
  execute $ddl$
  create or replace function public.ist_mitglied()
  returns boolean language sql stable security definer set search_path = public
  as $$
    select exists (select 1 from public.profiles p where p.id = auth.uid() and p.freigabe = 'aktiv'
                    and (not p.onboarding_offen
                         or exists (select 1 from public.einwilligungen e where e.profile_id = p.id and e.art = 'datenschutz' and e.widerrufen_am is null)));
  $$
  $ddl$;

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
  revoke execute on function public.rolle_setzen(uuid, text, boolean, boolean) from public, anon;
  grant execute on function public.rolle_setzen(uuid, text, boolean, boolean) to authenticated;


  execute $ddl$
  create or replace function public.konto_entfernen_intern(p_profil uuid, p_aktion text)
  returns void language plpgsql security definer set search_path = public
  as $$
  declare v_pl uuid; v_code text;
  begin
    select player_id into v_pl from public.profiles where id = p_profil;
    insert into public.konto_protokoll (akteur, ziel, ziel_name, aktion, details)
    values (case when auth.uid() = p_profil then null else auth.uid() end, p_profil, 'gelöschtes Konto', p_aktion,
            jsonb_build_object('kadereintrag', v_pl));
    if v_pl is not null then
      delete from public.player_status where player_id = v_pl;
      delete from public.rsvps where player_id = v_pl;
      update public.fines set note = null, reported_note = null, reject_reason = null where player_id = v_pl;
      v_code := 'x' || substr(md5(v_pl::text), 1, 8);
      update public.players set name = 'Ehemaliger Spieler', code = v_code, number = null, position = null,
                                hauptposition = null, ausgeschieden_am = now()
       where id = v_pl;
    end if;
    update public.fine_status_log set changed_by = null where changed_by = p_profil;
    update public.einladungen set erstellt_von = null where erstellt_von = p_profil;
    update public.einladungen set widerrufen_von = null where widerrufen_von = p_profil;
    -- 0069: offene Meldungen an dieses Konto gehen markiert an die Kasse (wie Wechsel mit "trotzdem").
    update public.fines set an_vorherigen = true where zahlung_an = p_profil and status = 'gemeldet' and not an_vorherigen;
    -- 0067: Trainer-Link (0063) und Zahlungsziel (0065) ohne Namen des geloeschten Kontos.
    update public.einladungen set benutzt_von = null where benutzt_von = p_profil;
    update public.fines set zahlung_an = null, zahlung_an_name = 'gelöschtes Konto', zahlung_an_paypal = null where zahlung_an = p_profil;
    update public.konto_protokoll set ziel_name = 'gelöschtes Konto' where ziel = p_profil;
    update public.konto_protokoll set akteur = null where akteur = p_profil;
    update public.team_settings set paypal_name = null, paypal_von = null, paypal_am = now() where paypal_von = p_profil;
    update public.notification_templates set updated_by = null where updated_by = p_profil;
    update public.profiles set entschieden_von = null where entschieden_von = p_profil;
    -- Konto selbst: profiles, user_roles, Push-Daten, Einstellungen, Einwilligungen per Kaskade.
    delete from auth.users where id = p_profil;
  end;
  $$
  $ddl$;
  revoke execute on function public.konto_entfernen_intern(uuid, text) from public, anon, authenticated;


  execute $ddl$
  create or replace function public.set_my_player(p_player_id uuid)
  returns void language plpgsql security definer set search_path = public
  as $$
  begin
    if not public.ist_mitglied() then raise exception 'Dein Konto ist noch nicht freigegeben.' using errcode = '42501'; end if;
    if exists (select 1 from public.profiles where id = auth.uid() and player_id is not null) then
      raise exception 'Deinen Kadereintrag ordnet der Trainer zu.' using errcode = '42501';
    end if;
    if p_player_id is not null and exists (
      select 1 from public.profiles where player_id = p_player_id and id <> auth.uid()
    ) then
      raise exception 'Dieser Spieler ist bereits einem anderen Konto zugeordnet.';
    end if;
    update public.profiles set player_id = p_player_id where id = auth.uid();
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
    -- 1) Trainer-Link-Konto vor und nach der Zustimmung
    v_tok := (public.trainer_link_erzeugen())->>'token';
    insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
      (v_t, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gp0069t@invalid.local', jsonb_build_object('name', 'Gegen Neu', 'einladung', v_tok), now(), now());
    perform set_config('request.jwt.claims', json_build_object('sub', v_t, 'role', 'authenticated')::text, true);
    if public.ist_leitung() or public.has_role('coach') then v_fehl := v_fehl || 'vor Zustimmung Leitung'::text; end if;
    v_ok := false; begin perform public.anfragen_liste(); exception when sqlstate '42501' then v_ok := true; end;
    if not v_ok then v_fehl := v_fehl || 'vor Zustimmung Anfragen'::text; end if;
    perform public.einwilligung_setzen('datenschutz', true, 'DS-2026-10');
    if not public.ist_leitung() then v_fehl := v_fehl || 'nach Zustimmung keine Leitung'::text; end if;
    -- 2) Trainer gibt sich selbst Kassenwart: verboten
    v_ok := false; begin perform public.rolle_setzen(v_t, 'treasurer', true); exception when sqlstate '42501' then v_ok := true; end;
    if not v_ok then v_fehl := v_fehl || 'Selbstvergabe Kassenwart'::text; end if;
    -- 4) Kadereintrag selbst wechseln
    perform public.mein_kadereintrag(null, true, true);
    insert into public.players (id, club_id, code, name) values (v_frei, v_club, 'gp69frei', 'Frei');
    v_ok := false; begin perform public.set_my_player(v_frei); exception when sqlstate '42501' then v_ok := true; end;
    if not v_ok then v_fehl := v_fehl || 'set_my_player Wechsel'::text; end if;
    -- 3) Kassenwart mit offener Meldung wird entfernt
    perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
    v_tok := (public.einladung_holen())->>'token';
    insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
      (v_k, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gp0069k@invalid.local', jsonb_build_object('name', 'Kasse Weg', 'einladung', v_tok), now(), now()),
      (v_s, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gp0069s@invalid.local', jsonb_build_object('name', 'Zahlt', 'einladung', v_tok), now(), now());
    perform public.anfrage_freigeben(v_k); perform public.anfrage_freigeben(v_s);
    perform public.rolle_setzen(v_k, 'treasurer', true);
    select player_id into v_pl from public.profiles where id = v_s;
    perform set_config('request.jwt.claims', json_build_object('sub', v_k, 'role', 'authenticated')::text, true);
    perform public.paypal_setzen('kasseweg69');
    insert into public.fines (club_id, player_id, offense, base_amount, date, status) values (v_club, v_pl, 'Prüf', 4, current_date, 'offen') returning id into v_f;
    update public.fines set status = 'gemeldet' where id = v_f;
    perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
    perform public.mitglied_entfernen(v_k);
    if (select status || '/' || an_vorherigen::text || '/' || zahlung_an_name from public.fines where id = v_f) <> 'gemeldet/true/gelöschtes Konto' then
      v_fehl := v_fehl || 'Entfernen markiert nicht'::text;
    end if;
    -- Bestand: Konten ohne Onboarding unveraendert Mitglied
    select count(*) into v_n from public.profiles p where p.freigabe = 'aktiv' and not p.onboarding_offen and p.email not like '%@invalid.local';
    if v_n <> 3 then v_fehl := v_fehl || ('Bestand ' || v_n); end if;
    perform set_config('request.jwt.claims', '', true);
    raise exception using errcode = 'P0069', message = 'zurückrollen';
  exception when sqlstate 'P0069' then null;
  end;

  if array_length(v_fehl, 1) > 0 then
    raise exception 'Gegenprobe 0069 fehlgeschlagen: %', v_fehl;
  end if;
  raise notice 'Gegenprobe 0069 bestanden.';
end
$migration$;

commit;

-- RUECKBAU (nicht automatisch): ist_mitglied und set_my_player wie 0061,
-- rolle_setzen wie 0066, konto_entfernen_intern wie 0067.
