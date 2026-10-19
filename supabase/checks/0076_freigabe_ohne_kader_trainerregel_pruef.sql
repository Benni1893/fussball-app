-- ============================================================================
-- Prüfung zu Migration 0076 (Freigabe ohne Kadereintrag, Trainer-Links weg,
-- mindestens ein Trainer, Mahnzuschlag ab Austritt eingefroren).
-- Ändert nichts: alles läuft in EINER Untertransaktion, die immer
-- zurückgerollt wird. Ergebnisse überleben nur in einer Variablen.
-- ============================================================================

drop table if exists pg_temp.pruef_0076;
create temp table pruef_0076 (nr serial, fall text, erwartet text, ergebnis text, urteil text);

do $pruef$
declare
  v_club uuid; v_admin uuid; v_tok text := 'pruef0076' || replace(gen_random_uuid()::text, '-', '');
  v_a uuid := gen_random_uuid(); v_b uuid := gen_random_uuid(); v_c uuid := gen_random_uuid();
  v_ex uuid := gen_random_uuid(); v_akt uuid := gen_random_uuid(); v_fex uuid := gen_random_uuid(); v_fakt uuid := gen_random_uuid();
  v_s text; v_n numeric; v_msg text;
  v_erg jsonb := '[]';
begin
  select id into v_club from public.clubs where slug = 'fcfn';
  select r.user_id into v_admin from public.user_roles r join public.profiles p on p.id = r.user_id and p.freigabe = 'aktiv' where r.role = 'admin' limit 1;
  begin
    update public.einladungen set widerrufen_am = now() where widerrufen_am is null and art = 'spieler';
    insert into public.einladungen (club_id, token) values (v_club, v_tok);
    insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
      (v_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pruef0076a@invalid.local', jsonb_build_object('name', 'Prüf Eins', 'einladung', v_tok), now(), now()),
      (v_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pruef0076b@invalid.local', jsonb_build_object('name', 'Prüf Zwei', 'einladung', v_tok), now(), now()),
      (v_c, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pruef0076c@invalid.local', jsonb_build_object('name', 'Prüf Drei', 'einladung', v_tok), now(), now());

    perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
    perform public.anfrage_freigeben(p_profil => v_a, p_ohne_kader => true);
    select freigabe || '/' || coalesce(player_id::text, '-') || '/' || coalesce(spielt_mit::text, '-') into v_s from public.profiles where id = v_a;
    v_erg := v_erg || jsonb_build_array(jsonb_build_array('Freigabe ohne Kadereintrag: aktiv, kein Kader, spielt nicht mit', 'aktiv/-/false', v_s));
    select count(*) into v_n from public.players where name = 'Prüf Eins';
    v_erg := v_erg || jsonb_build_array(jsonb_build_array('ohne Kadereintrag legt keinen Kadereintrag an', '0', v_n::text));
    -- alter Aufruf mit vier Parametern wie die App bis Build 2026-10-18-E
    perform public.anfrage_freigeben(p_profil => v_b, p_player => null, p_name => null, p_kassenwart => false);
    perform public.anfrage_freigeben(v_c);
    select count(*) into v_n from public.profiles where id in (v_b, v_c) and player_id is not null and freigabe = 'aktiv';
    v_erg := v_erg || jsonb_build_array(jsonb_build_array('Freigabe mit neuem Kadereintrag wie bisher (auch Aufruf wie Build E)', '2', v_n::text));

    begin perform public.trainer_link_erzeugen(); v_s := 'erzeugt'; exception when others then v_s := sqlstate; end;
    v_erg := v_erg || jsonb_build_array(jsonb_build_array('Trainer-Link erzeugen lehnt ab', '42501', v_s));
    select count(*) into v_n from public.einladungen where art = 'trainer' and widerrufen_am is null and benutzt_am is null;
    v_erg := v_erg || jsonb_build_array(jsonb_build_array('keine offenen Trainer-Links', '0', v_n::text));

    perform public.rolle_setzen(v_b, 'coach', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_b, 'role', 'authenticated')::text, true);
    begin perform public.rolle_setzen(v_b, 'coach', false); v_s := 'abgegeben'; exception when others then v_s := sqlstate; v_msg := sqlerrm; end;
    v_erg := v_erg || jsonb_build_array(jsonb_build_array('letzter Trainer kann die Rolle nicht selbst abgeben', '42501', v_s));
    begin perform public.mitglied_entfernen(v_b); v_s := 'entfernt'; exception when others then v_s := 'abgelehnt'; end;
    v_erg := v_erg || jsonb_build_array(jsonb_build_array('Trainer entfernt sich nicht selbst (eigenes Konto)', 'abgelehnt', v_s));
    perform public.rolle_setzen(v_c, 'coach', true);
    begin perform public.rolle_setzen(v_b, 'coach', false); v_s := 'abgegeben'; exception when others then v_s := sqlstate; end;
    v_erg := v_erg || jsonb_build_array(jsonb_build_array('mit zweitem Trainer darf er abgeben', 'abgegeben', v_s));
    perform set_config('request.jwt.claims', json_build_object('sub', v_c, 'role', 'authenticated')::text, true);
    begin perform public.konto_loeschen(); v_s := 'geloescht'; exception when others then v_s := case when sqlerrm like '%letzte Trainer%' then 'abgelehnt' else sqlerrm end; end;
    v_erg := v_erg || jsonb_build_array(jsonb_build_array('letzter Trainer kann sein Konto nicht löschen', 'abgelehnt', v_s));
    -- B ist kein Trainer mehr: B (nur Spieler) darf C nicht entfernen (keine Leitung)
    perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
    begin perform public.rolle_setzen(v_c, 'coach', false); v_s := 'geaendert'; exception when others then v_s := sqlstate; end;
    v_erg := v_erg || jsonb_build_array(jsonb_build_array('Admin darf den letzten Trainer ändern', 'geaendert', v_s));
    perform set_config('request.jwt.claims', '', true);

    insert into public.players (id, club_id, code, name, ausgeschieden_am) values (v_ex, v_club, 'pr76e', 'Ehemaliger Spieler', now() - interval '10 days');
    insert into public.players (id, club_id, code, name) values (v_akt, v_club, 'pr76a', 'Prüf Aktiv');
    insert into public.fines (id, club_id, player_id, catalog_id, date, created_at)
      select v_fex, v_club, v_ex, k.id, current_date - 30, now() - interval '30 days' from public.fine_catalog k where k.club_id = v_club and k.code = 'k04';
    insert into public.fines (id, club_id, player_id, catalog_id, date, created_at)
      select v_fakt, v_club, v_akt, k.id, current_date - 30, now() - interval '30 days' from public.fine_catalog k where k.club_id = v_club and k.code = 'k04';
    perform public.apply_fine_surcharges();
    select (select surcharge from public.fines where id = v_fex)::int::text || '/' || (select surcharge from public.fines where id = v_fakt)::int::text into v_s;
    v_erg := v_erg || jsonb_build_array(jsonb_build_array('Zuschlag: Ehemaliger eingefroren (20 Tage = 4 €), Aktiver weiter (30 Tage = 8 €)', '4/8', v_s));
    select (public.notify_strafe_betrag(f) - coalesce(f.base_amount, 0))::int into v_n from public.fines f where f.id = v_fex;
    v_erg := v_erg || jsonb_build_array(jsonb_build_array('Betrag in Mitteilungstexten gleich eingefroren', '4', v_n::text));
    perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
    perform public.mark_fines_paid(array[v_fex], 'bar');
    perform set_config('request.jwt.claims', '', true);
    select status || '/' || surcharge::int into v_s from public.fines where id = v_fex;
    v_erg := v_erg || jsonb_build_array(jsonb_build_array('offene Strafe eines Ehemaligen bezahlbar, Zuschlag bleibt 4 €', 'bestätigt/4', v_s));

    raise exception using errcode = 'P0076', message = 'zurückrollen';
  exception when sqlstate 'P0076' then null;
  end;
  insert into pruef_0076 (fall, erwartet, ergebnis, urteil)
    select x->>0, x->>1, x->>2, case when x->>1 = x->>2 then 'PASS' else 'FAIL' end from jsonb_array_elements(v_erg) x;
  select count(*) into v_n from (select id from auth.users where id in (v_a, v_b, v_c) union all select id from public.players where id in (v_ex, v_akt)) z;
  insert into pruef_0076 (fall, erwartet, ergebnis, urteil) values ('Prüfdaten danach gelöscht', '0', v_n::text, case when v_n = 0 then 'PASS' else 'FAIL' end);
end
$pruef$;

select nr, fall, erwartet, ergebnis, urteil from pruef_0076
union all
select null, 'SUMME: ' || count(*) || ' Fälle, ' || count(*) filter (where urteil = 'PASS') || ' PASS, '
       || count(*) filter (where urteil = 'FAIL') || ' FAIL', null, null, null from pruef_0076
order by nr nulls last;
