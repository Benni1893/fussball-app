-- ============================================================================
-- Prüfung zu Migration 0068 (Code neuer Kadereinträge).
-- Ändert nichts: jeder Fall läuft in einer Untertransaktion, die immer
-- zurückgerollt wird. Rollen über set local role plus request.jwt.claims.
-- ============================================================================

drop table if exists pg_temp.pruef_0068;
create temp table pruef_0068 (nr int, fall text, erwartet text, ergebnis text, urteil text);

do $pruef$
declare
  v_club uuid; v_admin uuid; v_tok text; v_a uuid; v_txt text; v_soll text; v_n bigint;
  f record;
begin
  select id into v_club from public.clubs where slug = 'fcfn';
  select user_id into v_admin from public.user_roles where role = 'admin' limit 1;
  for f in select * from (values
      (1, 'Ehemaliger mit x-Code zählt nicht', array['insert into public.players (club_id, code, name, ausgeschieden_am) select id, ''x9999999f'', ''Ehemaliger Spieler'', now() from public.clubs where slug = ''fcfn'''], 'naechster'),
      (2, 'fremde Codes (e2e…) zählen nicht', array['insert into public.players (club_id, code, name) select id, ''e2etr998877'', ''Test'' from public.clubs where slug = ''fcfn'''], 'naechster'),
      (3, 'über 99: dreistellig, nicht gekürzt', array['insert into public.players (club_id, code, name) select id, ''p099'', ''Neunundneunzig'' from public.clubs where slug = ''fcfn'''], 'p100'),
      (4, 'p07 zählt als 7', array['update public.players set code = code where false'], 'naechster')
    ) as t(nr, fall, vor, erwartet) order by nr
  loop
    v_txt := null;
    begin
      execute f.vor[1];
      select coalesce(max(substring(code from '^p([0-9]{1,9})$')::bigint), 0) + 1 into v_n from public.players where club_id = v_club;
      v_soll := case when f.erwartet = 'naechster' then 'p' || lpad(v_n::text, greatest(2, length(v_n::text)), '0') else f.erwartet end;
      perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
      v_tok := (public.einladung_holen())->>'token';
      v_a := gen_random_uuid();
      insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
        (v_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pruef0068@invalid.local', jsonb_build_object('name', 'Prüf Neu', 'einladung', v_tok), now(), now());
      execute 'set local role authenticated';
      perform public.anfrage_freigeben(v_a);
      execute 'reset role';
      select pl.code into v_txt from public.profiles p join public.players pl on pl.id = p.player_id where p.id = v_a;
      perform set_config('request.jwt.claims', '', true);
      raise exception using errcode = 'P0068', message = 'zurückrollen';
    exception when sqlstate 'P0068' then null;
      when others then v_txt := 'Fehler: ' || sqlerrm;
    end;
    insert into pruef_0068 values (f.nr, f.fall, v_soll, v_txt, case when v_txt = v_soll then 'PASS' else 'FAIL' end);
  end loop;
end
$pruef$;

select nr, fall, erwartet, ergebnis, urteil from pruef_0068
union all
select null, 'SUMME: ' || count(*) || ' Fälle: ' || count(*) filter (where urteil = 'PASS') || ' PASS, ' || count(*) filter (where urteil = 'FAIL') || ' FAIL', null, null, null from pruef_0068
order by nr nulls last;
