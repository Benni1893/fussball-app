-- ============================================================================
-- Prüfung zu Migration 0074 (Einführung "gesehen" je Konto und Teil).
-- Ändert nichts: jeder Fall läuft in einer Untertransaktion, die immer
-- zurückgerollt wird. Muster wie 0072_widerruf_datum_pruef.sql.
-- Im Fall: Prüfkonten A und B (Einladungstoken), B hat 'trainer' gesehen.
-- ============================================================================

drop table if exists pg_temp.pruef_0074;
create temp table pruef_0074 (nr int, rolle text, fall text, erwartet text, ergebnis text, urteil text);

do $pruef$
declare
  v_club uuid;
  v_a uuid := gen_random_uuid();
  v_b uuid := gen_random_uuid();
  v_tok text := 'pruef0074' || replace(gen_random_uuid()::text, '-', '');
  v_basis text[];
  v_nr int := 0; v_txt text; v_ok boolean; v_state text; v_msg text; v_urteil text; s text; i int;
  r record; f record;
begin
  select id into v_club from public.clubs where slug = 'fcfn';
  v_basis := array[
    'update public.einladungen set widerrufen_am = now() where widerrufen_am is null',
    format('insert into public.einladungen (club_id, token) values (%L, %L)', v_club, v_tok),
    format('insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values (%L, ''00000000-0000-0000-0000-000000000000'', ''authenticated'', ''authenticated'', ''pruef0074a@invalid.local'', %L, now(), now())', v_a, jsonb_build_object('name', 'Prüf Eins', 'einladung', v_tok)),
    format('insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values (%L, ''00000000-0000-0000-0000-000000000000'', ''authenticated'', ''authenticated'', ''pruef0074b@invalid.local'', %L, now(), now())', v_b, jsonb_build_object('name', 'Prüf Zwei', 'einladung', v_tok)),
    format('insert into public.einfuehrung_gesehen (user_id, teil) values (%L, ''trainer'')', v_b)];

  for r in
    select * from (values (1, 'anon'), (2, 'Konto A'), (3, 'intern')) as t(ord, rolle) order by ord
  loop
    for f in
      select * from (values
        ('eigenen Teil anlegen', array[format('insert into public.einfuehrung_gesehen (user_id, teil) values (%L, ''spieler'')', v_a)]::text[],
         'select string_agg(teil, '','' order by teil) from public.einfuehrung_gesehen', 'wert:spieler', array['Konto A']),
        ('zweimal anlegen mit on conflict do nothing', array[format('insert into public.einfuehrung_gesehen (user_id, teil) values (%L, ''spieler'') on conflict do nothing', v_a),
                                                             format('insert into public.einfuehrung_gesehen (user_id, teil) values (%L, ''spieler'') on conflict do nothing', v_a)],
         'select count(*)::text from public.einfuehrung_gesehen', 'wert:1', array['Konto A']),
        ('mehrere Teile auf einmal', array[format('insert into public.einfuehrung_gesehen (user_id, teil) values (%L, ''spieler''), (%L, ''kassenwart'') on conflict do nothing', v_a, v_a)],
         'select string_agg(teil, '','' order by teil) from public.einfuehrung_gesehen', 'wert:kassenwart,spieler', array['Konto A']),
        ('fremde Zeilen nicht sichtbar', null, 'select count(*)::text from public.einfuehrung_gesehen', 'wert:0', array['Konto A']),
        ('für ein fremdes Konto anlegen', array[format('insert into public.einfuehrung_gesehen (user_id, teil) values (%L, ''kassenwart'')', v_b)], null, 'verweigert', array['Konto A']),
        ('unbekannter Teil', array[format('insert into public.einfuehrung_gesehen (user_id, teil) values (%L, ''admin'')', v_a)], null, 'fehler:check', array['Konto A']),
        ('ändern', array['update public.einfuehrung_gesehen set gesehen_am = now()'], null, 'verweigert', array['Konto A']),
        ('löschen', array['delete from public.einfuehrung_gesehen'], null, 'verweigert', array['Konto A']),
        ('anon liest', array['select count(*)::text from public.einfuehrung_gesehen'], null, 'verweigert', array['anon']),
        ('anon legt an', array[format('insert into public.einfuehrung_gesehen (user_id, teil) values (%L, ''spieler'')', v_a)], null, 'verweigert', array['anon']),
        ('Konto löschen nimmt die Zeilen mit', array[format('delete from auth.users where id = %L', v_b)],
         format('select count(*)::text from public.einfuehrung_gesehen where user_id = %L', v_b), 'wert:0', array['intern']),
        ('RLS an, Rechte: authenticated select/insert, nicht update/delete, anon nichts', null,
         'select (select relrowsecurity from pg_class where oid = ''public.einfuehrung_gesehen''::regclass)::text || ''/'' ||
                 has_table_privilege(''authenticated'', ''public.einfuehrung_gesehen'', ''select'')::text || has_table_privilege(''authenticated'', ''public.einfuehrung_gesehen'', ''insert'')::text || ''/'' ||
                 has_table_privilege(''authenticated'', ''public.einfuehrung_gesehen'', ''update'')::text || has_table_privilege(''authenticated'', ''public.einfuehrung_gesehen'', ''delete'')::text || ''/'' ||
                 has_table_privilege(''anon'', ''public.einfuehrung_gesehen'', ''select'')::text || has_table_privilege(''anon'', ''public.einfuehrung_gesehen'', ''insert'')::text',
         'wert:true/truetrue/falsefalse/falsefalse', array['intern'])
      ) as t(fall, aktion, pruef, erwartet, rollen)
      where r.rolle = any(t.rollen)
    loop
      v_nr := v_nr + 1;
      v_ok := false; v_txt := null; v_state := null; v_msg := null;
      begin
        foreach s in array v_basis loop execute s; end loop;
        if r.rolle = 'anon' then
          perform set_config('request.jwt.claims', '{"role":"anon"}', true);
          execute 'set local role anon';
        elsif r.rolle <> 'intern' then
          perform set_config('request.jwt.claims', json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
          execute 'set local role authenticated';
        end if;
        if f.aktion is not null then
          for i in 1 .. array_length(f.aktion, 1) loop
            if f.pruef is null and i = array_length(f.aktion, 1) then execute f.aktion[i] into v_txt; else execute f.aktion[i]; end if;
          end loop;
        end if;
        if f.pruef is not null then execute f.pruef into v_txt; end if;
        if r.rolle <> 'intern' then execute 'reset role'; end if;
        perform set_config('request.jwt.claims', '', true);
        v_ok := true;
        raise exception using errcode = 'P0074', message = 'zurückrollen';
      exception when others then
        if sqlstate <> 'P0074' then v_state := sqlstate; v_msg := sqlerrm; end if;
      end;
      v_urteil := case
        when f.erwartet = 'verweigert' then case when not v_ok and v_state = '42501' then 'PASS' else 'FAIL' end
        when f.erwartet like 'wert:%' then case when v_ok and coalesce(v_txt, '') = substr(f.erwartet, 6) then 'PASS' else 'FAIL' end
        when f.erwartet like 'fehler:%' then case when not v_ok and v_state = '23514' then 'PASS' else 'FAIL' end
      end;
      insert into pruef_0074 values (v_nr, r.rolle, f.fall, f.erwartet,
        case when v_ok then 'gelungen: ' || coalesce(left(v_txt, 200), '(null)') else 'abgelehnt: ' || v_state || ' ' || left(v_msg, 160) end, v_urteil);
    end loop;
  end loop;
end
$pruef$;

select nr, rolle, fall, erwartet, ergebnis, urteil from pruef_0074
union all
select null, 'SUMME', count(*) || ' Fälle: ' || count(*) filter (where urteil = 'PASS') || ' PASS, '
       || count(*) filter (where urteil = 'FAIL') || ' FAIL', null, null, null from pruef_0074
order by nr nulls last;
