-- ============================================================================
-- Prüfung zu Migration 0077 (Testnachricht für alle, nur an sich selbst,
-- Sperre gegen Dauerfeuer). Ändert nichts: eine Untertransaktion, die immer
-- zurückgerollt wird; Ergebnisse überleben nur in einer Variablen.
-- ============================================================================

drop table if exists pg_temp.pruef_0077;
create temp table pruef_0077 (nr serial, fall text, erwartet text, ergebnis text, urteil text);

do $pruef$
declare
  v_club uuid; v_tok text := 'pruef0077' || replace(gen_random_uuid()::text, '-', '');
  v_a uuid := gen_random_uuid(); v_t uuid := gen_random_uuid(); v_w uuid := gen_random_uuid(); v_o uuid := gen_random_uuid();
  v_s text; v_n int; v_erg jsonb := '[]';
begin
  select id into v_club from public.clubs where slug = 'fcfn';
  begin
    update public.einladungen set widerrufen_am = now() where widerrufen_am is null and art = 'spieler';
    insert into public.einladungen (club_id, token) values (v_club, v_tok);
    insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
      (v_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pruef0077a@invalid.local', jsonb_build_object('name', 'Prüf Spieler', 'einladung', v_tok), now(), now()),
      (v_t, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pruef0077t@invalid.local', jsonb_build_object('name', 'Prüf Trainer', 'einladung', v_tok), now(), now()),
      (v_w, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pruef0077w@invalid.local', jsonb_build_object('name', 'Prüf Wartend', 'einladung', v_tok), now(), now()),
      (v_o, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pruef0077o@invalid.local', jsonb_build_object('name', 'Prüf Ohne Gerät', 'einladung', v_tok), now(), now());
    update public.profiles set freigabe = 'aktiv' where id in (v_a, v_t, v_o);
    insert into public.user_roles (user_id, role, club_id) values (v_t, 'coach', v_club);
    insert into public.push_subscriptions (profile_id, endpoint, p256dh, auth) values
      (v_a, 'https://pruef.invalid/0077/a', 'x', 'x'), (v_t, 'https://pruef.invalid/0077/t', 'x', 'x'), (v_w, 'https://pruef.invalid/0077/w', 'x', 'x');

    perform set_config('request.jwt.claims', json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
    begin perform public.send_test_notification(); v_s := 'gesendet'; exception when others then v_s := sqlerrm; end;
    v_erg := v_erg || jsonb_build_array(jsonb_build_array('Spieler darf sich eine Testnachricht schicken', 'gesendet', v_s));
    select count(*) into v_n from public.notification_outbox where kategorie = 'test' and profile_id = v_a;
    v_erg := v_erg || jsonb_build_array(jsonb_build_array('sie geht an ihn selbst', '1', v_n::text));
    begin perform public.send_test_notification(); v_s := 'gesendet'; exception when sqlstate 'P0T01' then v_s := 'gesperrt'; when others then v_s := sqlerrm; end;
    v_erg := v_erg || jsonb_build_array(jsonb_build_array('zweite innerhalb einer Minute gesperrt', 'gesperrt', v_s));
    update public.notification_outbox set created_at = now() - interval '3 hours' where kategorie = 'test' and profile_id = v_a;
    insert into public.notification_outbox (profile_id, kategorie, titel, text, dedup_key, created_at)
      select v_a, 'test', 'Test', 'Test', 'pruef0077:' || g, now() - interval '3 hours' from generate_series(1, 4) g;
    begin perform public.send_test_notification(); v_s := 'gesendet'; exception when sqlstate 'P0T02' then v_s := 'gesperrt'; when others then v_s := sqlerrm; end;
    v_erg := v_erg || jsonb_build_array(jsonb_build_array('sechste in 24 Stunden gesperrt', 'gesperrt', v_s));

    perform set_config('request.jwt.claims', json_build_object('sub', v_t, 'role', 'authenticated')::text, true);
    begin perform public.send_test_notification(); v_s := 'gesendet'; exception when others then v_s := sqlerrm; end;
    v_erg := v_erg || jsonb_build_array(jsonb_build_array('Trainer (kein Admin) darf', 'gesendet', v_s));

    perform set_config('request.jwt.claims', json_build_object('sub', v_w, 'role', 'authenticated')::text, true);
    begin perform public.send_test_notification(); v_s := 'gesendet'; exception when insufficient_privilege then v_s := 'abgelehnt'; when others then v_s := sqlerrm; end;
    v_erg := v_erg || jsonb_build_array(jsonb_build_array('nicht freigegebenes Konto abgelehnt', 'abgelehnt', v_s));

    perform set_config('request.jwt.claims', json_build_object('sub', v_o, 'role', 'authenticated')::text, true);
    begin perform public.send_test_notification(); v_s := 'gesendet'; exception when others then v_s := case when sqlerrm like '%kein Gerät%' then 'kein Gerät' else sqlerrm end; end;
    v_erg := v_erg || jsonb_build_array(jsonb_build_array('ohne angemeldetes Gerät: Hinweis', 'kein Gerät', v_s));
    perform set_config('request.jwt.claims', '', true);

    select count(*) into v_n from public.notification_outbox where kategorie = 'test' and created_at > now() - interval '1 minute' and profile_id not in (v_a, v_t);
    v_erg := v_erg || jsonb_build_array(jsonb_build_array('keine Testnachricht an andere Konten', '0', v_n::text));
    v_erg := v_erg || jsonb_build_array(jsonb_build_array('anon darf nicht', 'false', has_function_privilege('anon', 'public.send_test_notification()', 'execute')::text));

    raise exception using errcode = 'P0077', message = 'zurückrollen';
  exception when sqlstate 'P0077' then null;
  end;
  insert into pruef_0077 (fall, erwartet, ergebnis, urteil)
    select x->>0, x->>1, x->>2, case when x->>1 = x->>2 then 'PASS' else 'FAIL' end from jsonb_array_elements(v_erg) x;
  select count(*) into v_n from auth.users where id in (v_a, v_t, v_w, v_o);
  insert into pruef_0077 (fall, erwartet, ergebnis, urteil) values ('Prüfdaten danach gelöscht', '0', v_n::text, case when v_n = 0 then 'PASS' else 'FAIL' end);
end
$pruef$;

select nr, fall, erwartet, ergebnis, urteil from pruef_0077
union all
select null, 'SUMME: ' || count(*) || ' Fälle, ' || count(*) filter (where urteil = 'PASS') || ' PASS, '
       || count(*) filter (where urteil = 'FAIL') || ' FAIL', null, null, null from pruef_0077
order by nr nulls last;
