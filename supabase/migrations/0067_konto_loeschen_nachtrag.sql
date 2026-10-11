-- ============================================================================
-- FC Fasanerie-Nord - Migration 0067: Konto loeschen, Nachtrag zu 0063/0065
--
-- konto_entfernen_intern (0061) anonymisiert jetzt auch die neuen Angaben:
--   - einladungen.benutzt_von (Trainer-Link, 0063) -> null
--   - fines.zahlung_an / zahlung_an_name / zahlung_an_paypal (Zahlungsziel,
--     0065): Konto und PayPal-Name weg, Name wird "gelöschtes Konto". Die
--     Markierung an_vorherigen bleibt (sie sagt nichts ueber die Person).
-- Sonst unveraendert gegenueber 0061.
-- Aufbau: EIN do-Block, Gegenprobe am Ende (zurueckgerollt).
-- ============================================================================

begin;

do $migration$
declare
  v_fehl text[] := '{}';
  v_admin uuid; v_club uuid; v_tok text; v_k uuid := gen_random_uuid(); v_sp uuid := gen_random_uuid(); v_pl uuid; v_f uuid; v_l jsonb;
begin
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

  -- --------------------------------------------------------------------------
  -- Gegenprobe: Kassenwart mit Zahlung und Trainer-Link wird geloescht
  -- --------------------------------------------------------------------------
  select user_id into v_admin from public.user_roles where role = 'admin' limit 1;
  select id into v_club from public.clubs where slug = 'fcfn';
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
    v_tok := (public.einladung_holen())->>'token';
    v_l := public.trainer_link_erzeugen();
    insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
      (v_k,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gp0067a@invalid.local', jsonb_build_object('name', 'Kasse Weg', 'einladung', v_l->>'token'), now(), now()),
      (v_sp, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gp0067b@invalid.local', jsonb_build_object('name', 'Zahlt', 'einladung', v_tok), now(), now());
    perform public.anfrage_freigeben(v_sp);
    select player_id into v_pl from public.profiles where id = v_sp;
    perform public.rolle_setzen(v_k, 'treasurer', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_k, 'role', 'authenticated')::text, true);
    perform public.paypal_setzen('kasseweg');
    insert into public.fines (club_id, player_id, offense, base_amount, date, status) values (v_club, v_pl, 'Prüf', 4, current_date, 'offen') returning id into v_f;
    update public.fines set status = 'gemeldet' where id = v_f;
    if (select zahlung_an_name from public.fines where id = v_f) <> 'Kasse Weg' then v_fehl := v_fehl || 'Aufbau'::text; end if;
    perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
    perform public.mitglied_entfernen(v_k);
    if (select coalesce(zahlung_an::text, '-') || '/' || zahlung_an_name || '/' || coalesce(zahlung_an_paypal, '-') from public.fines where id = v_f) <> '-/gelöschtes Konto/-' then
      v_fehl := v_fehl || 'Zahlungsziel'::text;
    end if;
    if (select benutzt_von from public.einladungen where id = (v_l->>'id')::uuid) is not null then v_fehl := v_fehl || 'Trainer-Link'::text; end if;
    if exists (select 1 from public.fines where zahlung_an_name = 'Kasse Weg' or zahlung_an_paypal = 'kasseweg') then v_fehl := v_fehl || 'Reste'::text; end if;
    perform set_config('request.jwt.claims', '', true);
    raise exception using errcode = 'P0067', message = 'zurückrollen';
  exception when sqlstate 'P0067' then null;
  end;

  if array_length(v_fehl, 1) > 0 then
    raise exception 'Gegenprobe 0067 fehlgeschlagen: %', v_fehl;
  end if;
  raise notice 'Gegenprobe 0067 bestanden.';
end
$migration$;

commit;

-- RUECKBAU (nicht automatisch): konto_entfernen_intern wie 0061.
