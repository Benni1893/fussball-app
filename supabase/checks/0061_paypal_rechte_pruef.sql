-- ============================================================================
-- Prüfung Onboarding Nacharbeit 3: PayPal-Link nur Kassenwart und Admin.
-- Keine eigene Migration; die Rechte stehen in paypal_setzen (0061) und in
-- der RLS von team_settings (nur Lesen für Mitglieder, kein Schreiben).
-- Ändert nichts: jeder Fall läuft in einer Untertransaktion, die immer
-- zurückgerollt wird. Muster wie 0061 bis 0065.
-- Prüfkonto T (über den Spieler-Link, wartet oder freigegeben), die Rolle der
-- Zeile kommt dazu. Im Fall steht der Link auf "pruefkasse".
-- ============================================================================

drop table if exists pg_temp.pruef_paypal;
create temp table pruef_paypal (nr int, rolle text, fall text, erwartet text, ergebnis text, urteil text);

do $pruef$
declare
  v_club uuid; v_admin uuid;
  v_t uuid := gen_random_uuid(); v_p1 uuid := gen_random_uuid();
  v_tok text := 'pruefpp' || replace(gen_random_uuid()::text, '-', '');
  v_basis text[]; v_frei text[];
  v_nr int := 0; v_txt text; v_ok boolean; v_state text; v_msg text; v_urteil text; s text; i int; v_sub uuid;
  r record; f record;
begin
  select id into v_club from public.clubs where slug = 'fcfn';
  select user_id into v_admin from public.user_roles where role = 'admin' limit 1;
  v_basis := array[
    'update public.einladungen set widerrufen_am = now() where widerrufen_am is null and art = ''spieler''',
    format('insert into public.einladungen (club_id, token) values (%L, %L)', v_club, v_tok),
    format('insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values (%L, ''00000000-0000-0000-0000-000000000000'', ''authenticated'', ''authenticated'', ''pruefpp@invalid.local'', %L, now(), now())', v_t, jsonb_build_object('name', 'Prüf PayPal', 'einladung', v_tok)),
    format('update public.team_settings set paypal_name = ''pruefkasse'', paypal_von = %L', v_admin),
    format('insert into public.players (id, club_id, code, name) values (%L, %L, ''prppa'', ''Prüf Eins'')', v_p1, v_club)];
  v_frei := v_basis || array[format('update public.profiles set freigabe = ''aktiv'', player_id = %L where id = %L', v_p1, v_t)];

  for r in
    select * from (values
      (1, 'anon', null::text), (2, 'Wartend', null), (3, 'Spieler', null), (4, 'Trainer', 'coach'),
      (5, 'Kassenwart', 'treasurer'), (6, 'Admin', 'admin'), (7, 'intern', null)
    ) as t(ord, rolle, zusatzrolle) order by ord
  loop
    for f in
      select * from (values
        ('PayPal-Link setzen', null::text[], array['select public.paypal_setzen(''trainerkasse'')::text']::text[], null::text[], null::text, 'verweigert', array['anon','Wartend','Spieler','Trainer']),
        ('PayPal-Link setzen: Kassenwart und Admin', null, array['select public.paypal_setzen(''neuekasse'')::text'], null,
         'select paypal_name from public.team_settings', 'wert:neuekasse', array['Kassenwart','Admin']),
        ('PayPal-Link löschen (leer)', null, array['select public.paypal_setzen('''')::text'], null, null, 'verweigert', array['Wartend','Spieler','Trainer']),
        ('Teameinstellungen direkt ändern', null, array['update public.team_settings set paypal_name = ''trainerkasse'', paypal_von = auth.uid()'], null,
         'select paypal_name from public.team_settings', 'wert:pruefkasse', array['Wartend','Spieler','Trainer','Kassenwart','Admin']),
        ('Teameinstellungen direkt anlegen', null, array[format('insert into public.team_settings (club_id, paypal_name) values (%L, ''trainerkasse'')', v_club)], null, null, 'verweigert', array['anon','Spieler','Trainer']),
        ('PayPal-Frage erledigen ändert den Link nicht', null, array['select public.paypal_frage_erledigt()::text'], null,
         'select paypal_name from public.team_settings', 'wert:pruefkasse', array['Trainer']),
        ('Link lesen: Mitglieder ja', null, array['select coalesce((select paypal_name from public.team_settings), ''-'')'], null, null, 'wert:pruefkasse', array['Spieler','Trainer']),
        ('Link lesen: wartend nein', null, array['select coalesce((select paypal_name from public.team_settings), ''-'')'], null, null, 'wert:-', array['Wartend']),
        ('Keine weitere Funktion schreibt den Link für Trainer', null, null, null,
         'select string_agg(p.proname, '','' order by p.proname) from pg_proc p where p.pronamespace = ''public''::regnamespace and p.prosrc ~* ''update\s+public\.team_settings\s+set\s+paypal'' and has_function_privilege(''authenticated'', p.oid, ''execute'')',
         'wert:paypal_setzen,rolle_setzen', array['intern'])
      ) as t(fall, vor, aktion, nach, pruef, erwartet, rollen)
      where r.rolle = any(t.rollen)
    loop
      v_nr := v_nr + 1;
      v_ok := false; v_txt := null; v_state := null; v_msg := null;
      begin
        foreach s in array (case when r.rolle in ('anon','Wartend') then v_basis else v_frei end) loop execute s; end loop;
        if r.zusatzrolle is not null then
          insert into public.user_roles (user_id, role, club_id) values (v_t, r.zusatzrolle, v_club) on conflict do nothing;
        end if;
        foreach s in array coalesce(f.vor, '{}'::text[]) loop execute s; end loop;
        v_sub := v_t;
        if r.rolle = 'anon' then
          perform set_config('request.jwt.claims', '{"role":"anon"}', true);
          execute 'set local role anon';
        elsif r.rolle <> 'intern' then
          perform set_config('request.jwt.claims', json_build_object('sub', v_sub, 'role', 'authenticated')::text, true);
          execute 'set local role authenticated';
        end if;
        if f.aktion is not null then
          for i in 1 .. array_length(f.aktion, 1) loop
            if f.pruef is null and f.nach is null and i = array_length(f.aktion, 1) then execute f.aktion[i] into v_txt; else execute f.aktion[i]; end if;
          end loop;
        end if;
        if r.rolle <> 'intern' then execute 'reset role'; end if;
        foreach s in array coalesce(f.nach, '{}'::text[]) loop execute s; end loop;
        perform set_config('request.jwt.claims', '', true);
        if f.pruef is not null then execute f.pruef into v_txt; end if;
        v_ok := true;
        raise exception using errcode = 'P0061', message = 'zurückrollen';
      exception when others then
        if sqlstate <> 'P0061' then v_state := sqlstate; v_msg := sqlerrm; end if;
      end;
      v_urteil := case
        when f.erwartet = 'verweigert' then case when not v_ok and v_state = '42501' then 'PASS' else 'FAIL' end
        when f.erwartet = 'ok' then case when v_ok then 'PASS' else 'FAIL' end
        when f.erwartet like 'wert:%' then case when v_ok and coalesce(v_txt, '') = substr(f.erwartet, 6) then 'PASS' else 'FAIL' end
        when f.erwartet like 'fehler:%' then case when not v_ok and v_state <> '42501' and v_msg like '%' || substr(f.erwartet, 8) || '%' then 'PASS' else 'FAIL' end
      end;
      insert into pruef_paypal values (v_nr, r.rolle, f.fall, f.erwartet,
        case when v_ok then 'gelungen: ' || coalesce(left(v_txt, 200), '(null)') else 'abgelehnt: ' || v_state || ' ' || left(v_msg, 160) end, v_urteil);
    end loop;
  end loop;
end
$pruef$;

select nr, rolle, fall, erwartet, ergebnis, urteil from pruef_paypal
union all
select null, 'SUMME', count(*) || ' Fälle: ' || count(*) filter (where urteil = 'PASS') || ' PASS, '
       || count(*) filter (where urteil = 'FAIL') || ' FAIL', null, null, null from pruef_paypal
order by nr nulls last;
