-- ============================================================================
-- Prüfung zu Migration 0069 (Nachtrag aus der Gegenprüfung).
-- Ändert nichts: jeder Fall läuft in einer Untertransaktion, die immer
-- zurückgerollt wird. Rollen über set local role plus request.jwt.claims.
-- Aufbau je Fall: Trainer-Link-Konto TL (Onboarding offen), Trainer TR,
-- Kassenwart K mit PayPal-Link und einer an ihn gemeldeten Strafe, Spieler S.
-- ============================================================================

drop table if exists pg_temp.pruef_0069;
create temp table pruef_0069 (nr int, rolle text, fall text, erwartet text, ergebnis text, urteil text);

do $pruef$
declare
  v_club uuid; v_admin uuid; v_tok text; v_ttok text;
  v_tl uuid; v_tr uuid; v_k uuid; v_s uuid; v_pl uuid; v_frei uuid; v_f uuid;
  v_txt text; v_ok boolean; v_state text; v_msg text; s text;
  f record;
  u text := 'insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values (%L, ''00000000-0000-0000-0000-000000000000'', ''authenticated'', ''authenticated'', %L, %L, now(), now())';
begin
  select id into v_club from public.clubs where slug = 'fcfn';
  select user_id into v_admin from public.user_roles where role = 'admin' limit 1;
  for f in select * from (values
    (1, 'TL', 'vor der Zustimmung: keine Leitung', array['select public.ist_leitung()::text'], null::text, 'wert:false'),
    (2, 'TL', 'vor der Zustimmung: keine Strafen lesbar', array['select count(*)::text from public.fines'], null, 'wert:0'),
    (3, 'TL', 'vor der Zustimmung: keine Anfragen', array['select public.anfragen_liste()::text'], null, 'verweigert'),
    (4, 'TL', 'nach der Zustimmung: Leitung', array['select public.einwilligung_setzen(''datenschutz'', true, ''DS-2026-10'')::text', 'select public.ist_leitung()::text'], null, 'wert:true'),
    (5, 'TR', 'Trainer gibt sich selbst Kassenwart', array['select public.rolle_setzen(auth.uid(), ''treasurer'', true)::text'], null, 'verweigert'),
    (6, 'TR', 'Trainer gibt einem anderen Kassenwart', array['select public.rolle_setzen(''S'', ''treasurer'', true)::text'],
       'select count(*)::text from public.user_roles where user_id = ''S'' and role = ''treasurer''', 'wert:1'),
    (7, 'Admin', 'Admin gibt sich selbst Kassenwart', array['select public.rolle_setzen(auth.uid(), ''treasurer'', true)::text'],
       'select count(*)::text from public.user_roles where user_id = ''ADM'' and role = ''treasurer''', 'wert:1'),
    (8, 'S', 'Spieler wechselt seinen Kadereintrag selbst', array['select public.set_my_player(''FREI'')::text'], null, 'verweigert'),
    (9, 'S', 'Spieler löst seinen Kadereintrag selbst', array['select public.set_my_player(null)::text'], null, 'verweigert'),
    (10, 'S0', 'Konto ohne Kadereintrag wählt einen freien', array['select public.set_my_player(''FREI'')::text'],
       'select (player_id = ''FREI'')::text from public.profiles where id = ''S''', 'wert:true'),
    (11, 'TR', 'Kassenwart entfernen: offene Meldung markiert, Ziel anonym', array['select public.mitglied_entfernen(''K'')::text'],
       'select status || ''/'' || an_vorherigen::text || ''/'' || zahlung_an_name || ''/'' || coalesce(zahlung_an_paypal, ''-'') from public.fines where id = ''F''', 'wert:gemeldet/true/gelöschtes Konto/-'),
    (12, 'K', 'Kassenwart löscht sein Konto: offene Meldung markiert', array['select public.konto_loeschen()::text'],
       'select an_vorherigen::text || ''/'' || zahlung_an_name from public.fines where id = ''F''', 'wert:true/gelöschtes Konto'),
    (14, 'TL', '0070: Abschluss ohne Zustimmung verweigert', array['select public.onboarding_abschliessen()::text'], null, 'verweigert'),
    (15, 'TL', '0070: ohne Zustimmung auch mit abgeschlossenem Onboarding keine Leitung', array['select public.ist_leitung()::text'], null, 'wert:false'),
    (13, 'intern', 'Bestand: alle bisherigen Konten weiter Mitglied', null,
       'select count(*)::text from public.profiles where freigabe = ''aktiv'' and onboarding_offen and email not like ''%@invalid.local''', 'wert:0')
  ) as t(nr, rolle, fall, aktion, pruef, erwartet) order by nr
  loop
    v_ok := false; v_txt := null; v_state := null; v_msg := null;
    begin
      v_tl := gen_random_uuid(); v_tr := gen_random_uuid(); v_k := gen_random_uuid(); v_s := gen_random_uuid(); v_frei := gen_random_uuid();
      perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
      v_tok := (public.einladung_holen())->>'token';
      v_ttok := (public.trainer_link_erzeugen())->>'token';
      execute format(u, v_tl, 'pruef0069tl@invalid.local', jsonb_build_object('name', 'Prüf TL', 'einladung', v_ttok));
      execute format(u, v_tr, 'pruef0069tr@invalid.local', jsonb_build_object('name', 'Prüf Trainer', 'einladung', v_tok));
      execute format(u, v_k, 'pruef0069k@invalid.local', jsonb_build_object('name', 'Prüf Kasse', 'einladung', v_tok));
      execute format(u, v_s, 'pruef0069s@invalid.local', jsonb_build_object('name', 'Prüf Spieler', 'einladung', v_tok));
      perform public.anfrage_freigeben(v_tr); perform public.anfrage_freigeben(v_k); perform public.anfrage_freigeben(v_s);
      perform public.rolle_setzen(v_tr, 'coach', true);
      perform public.rolle_setzen(v_k, 'treasurer', true);
      insert into public.players (id, club_id, code, name) values (v_frei, v_club, 'pr69frei', 'Prüf Frei');
      if f.rolle = 'S0' then update public.profiles set player_id = null where id = v_s; end if;
      if f.nr = 15 then update public.profiles set onboarding_offen = false where id = v_tl; end if;
      select player_id into v_pl from public.profiles where id = v_tr;
      perform set_config('request.jwt.claims', json_build_object('sub', v_k, 'role', 'authenticated')::text, true);
      perform public.paypal_setzen('pruefkasse69');
      insert into public.fines (club_id, player_id, offense, base_amount, date, status) values (v_club, v_pl, 'Prüf', 4, current_date, 'offen') returning id into v_f;
      update public.fines set status = 'gemeldet' where id = v_f;
      if f.rolle <> 'intern' then
        perform set_config('request.jwt.claims', json_build_object('sub',
          case f.rolle when 'TL' then v_tl when 'TR' then v_tr when 'Admin' then v_admin when 'K' then v_k else v_s end, 'role', 'authenticated')::text, true);
        execute 'set local role authenticated';
      end if;
      if f.aktion is not null then
        for i in 1 .. array_length(f.aktion, 1) loop
          s := replace(replace(replace(replace(f.aktion[i], '''S''', quote_literal(v_s)), '''FREI''', quote_literal(v_frei)), '''K''', quote_literal(v_k)), '''F''', quote_literal(v_f));
          if f.pruef is null and i = array_length(f.aktion, 1) then execute s into v_txt; else execute s; end if;
        end loop;
      end if;
      execute 'reset role';
      perform set_config('request.jwt.claims', '', true);
      if f.pruef is not null then
        execute replace(replace(replace(replace(replace(f.pruef, '''ADM''', quote_literal(v_admin)), '''S''', quote_literal(v_s)), '''FREI''', quote_literal(v_frei)), '''K''', quote_literal(v_k)), '''F''', quote_literal(v_f)) into v_txt;
      end if;
      v_ok := true;
      raise exception using errcode = 'P0069', message = 'zurückrollen';
    exception when others then
      if sqlstate <> 'P0069' then v_state := sqlstate; v_msg := sqlerrm; v_ok := false; end if;
    end;
    insert into pruef_0069 values (f.nr, f.rolle, f.fall, f.erwartet,
      case when v_ok then 'gelungen: ' || coalesce(v_txt, '(null)') else 'abgelehnt: ' || coalesce(v_state, '') || ' ' || left(coalesce(v_msg, ''), 140) end,
      case when f.erwartet = 'verweigert' then case when not v_ok and v_state = '42501' then 'PASS' else 'FAIL' end
           else case when v_ok and coalesce(v_txt, '') = substr(f.erwartet, 6) then 'PASS' else 'FAIL' end end);
  end loop;
end
$pruef$;

select nr, rolle, fall, erwartet, ergebnis, urteil from pruef_0069
union all
select null, 'SUMME', count(*) || ' Fälle: ' || count(*) filter (where urteil = 'PASS') || ' PASS, ' || count(*) filter (where urteil = 'FAIL') || ' FAIL', null, null, null from pruef_0069
order by nr nulls last;
