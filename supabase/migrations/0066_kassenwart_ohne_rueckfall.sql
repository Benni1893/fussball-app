-- ============================================================================
-- FC Fasanerie-Nord - Migration 0066: Korrektur zu 0065, kein Rueckfall
--
-- 0065 rechnete gemeldete Zahlungen OHNE festgehaltenes Ziel (alle Meldungen
-- vor 0065) dem aktuellen Halter des PayPal-Links zu. Das ist geraten: Wer den
-- Link spaeter setzt (auch ein Testkonto), bekaeme fremde Meldungen, und beim
-- Wechsel wuerden bestehende Strafen markiert. Ab jetzt zaehlen und markiert
-- werden nur Meldungen mit zahlung_an (also ab 0065). Alte Meldungen bleiben
-- unveraendert und ohne Ziel.
--
-- Bestand: an keiner Strafe wurde bisher an_vorherigen gesetzt (Gegenprobe).
-- Aufbau: EIN do-Block, Gegenprobe am Ende (zurueckgerollt).
-- ============================================================================

begin;

do $migration$
declare
  v_fehl text[] := '{}';
  v_admin uuid; v_club uuid; v_tok text; v_alt uuid := gen_random_uuid(); v_sp uuid := gen_random_uuid(); v_pl uuid; v_f uuid; v_alt_n integer;
begin
  if exists (select 1 from public.fines where an_vorherigen) then v_fehl := v_fehl || 'Bestand markiert'::text; end if;

  execute $ddl$
  create or replace function public.kassenwart_offen_intern(p_profil uuid)
  returns table (anzahl integer, summe numeric) language sql stable security definer set search_path = public
  as $$
    select count(*)::integer, coalesce(sum(coalesce(f.base_amount, c.amount, 0) + coalesce(f.surcharge, 0)), 0)
      from public.fines f left join public.fine_catalog c on c.id = f.catalog_id
     where f.status = 'gemeldet' and not f.an_vorherigen and f.zahlung_an = p_profil;
  $$
  $ddl$;
  revoke execute on function public.kassenwart_offen_intern(uuid) from public, anon, authenticated;

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

  -- --------------------------------------------------------------------------
  -- Gegenprobe: Testkasse setzt den Link, alte Meldungen zaehlen nicht zu ihr
  -- --------------------------------------------------------------------------
  select user_id into v_admin from public.user_roles where role = 'admin' limit 1;
  select id into v_club from public.clubs where slug = 'fcfn';
  select count(*) into v_alt_n from public.fines where status = 'gemeldet' and zahlung_an is null;
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
    v_tok := (public.einladung_holen())->>'token';
    insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
      (v_alt, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gp0066a@invalid.local', jsonb_build_object('name', 'Kasse Test', 'einladung', v_tok), now(), now()),
      (v_sp,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gp0066b@invalid.local', jsonb_build_object('name', 'Zahlt', 'einladung', v_tok), now(), now());
    perform public.anfrage_freigeben(v_alt); perform public.anfrage_freigeben(v_sp);
    select player_id into v_pl from public.profiles where id = v_sp;
    perform public.rolle_setzen(v_alt, 'treasurer', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_alt, 'role', 'authenticated')::text, true);
    perform public.paypal_setzen('kassetest');
    perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
    if (public.kassenwart_offen(v_alt))->>'anzahl' <> '0' then v_fehl := v_fehl || 'alte Meldungen gezaehlt'::text; end if;
    insert into public.fines (club_id, player_id, offense, base_amount, date, status) values (v_club, v_pl, 'Prüf', 4, current_date, 'offen') returning id into v_f;
    update public.fines set status = 'gemeldet' where id = v_f;
    if (public.kassenwart_offen(v_alt))->>'anzahl' <> '1' then v_fehl := v_fehl || 'neue Meldung'::text; end if;
    perform public.rolle_setzen(v_alt, 'treasurer', false, true);
    if (select count(*) from public.fines where an_vorherigen) <> 1 or not (select an_vorherigen from public.fines where id = v_f) then v_fehl := v_fehl || 'Markierung'::text; end if;
    if (select count(*) from public.fines where status = 'gemeldet' and zahlung_an is null) <> v_alt_n then v_fehl := v_fehl || 'alte Meldungen veraendert'::text; end if;
    perform set_config('request.jwt.claims', '', true);
    raise exception using errcode = 'P0066', message = 'zurückrollen';
  exception when sqlstate 'P0066' then null;
  end;

  if array_length(v_fehl, 1) > 0 then
    raise exception 'Gegenprobe 0066 fehlgeschlagen: %', v_fehl;
  end if;
  raise notice 'Gegenprobe 0066 bestanden.';
end
$migration$;

commit;

-- RUECKBAU (nicht automatisch): kassenwart_offen_intern und rolle_setzen wie 0065.
