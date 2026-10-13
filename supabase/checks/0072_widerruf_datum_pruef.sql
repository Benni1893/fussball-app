-- ============================================================================
-- Prüfung zu Migration 0072 (Widerruf Gesundheit löscht Status, Notiz UND Datum).
-- Ändert nichts: jeder Fall läuft in einer Untertransaktion, die immer
-- zurückgerollt wird. Muster wie 0062_nicht_verfuegbar_pruef.sql.
-- Im Fall: Prüfkonto (Einladungstoken) mit eigenem Kadereintrag P1.
-- "Spieler+E" = Prüfkonto mit Gesundheits-Einwilligung.
-- ============================================================================

drop table if exists pg_temp.pruef_0072;
create temp table pruef_0072 (nr int, rolle text, fall text, erwartet text, ergebnis text, urteil text);

do $pruef$
declare
  v_club uuid;
  v_t uuid := gen_random_uuid();
  v_p1 uuid := gen_random_uuid();
  v_tok text := 'pruef0072' || replace(gen_random_uuid()::text, '-', '');
  v_basis text[];
  v_nr int := 0; v_txt text; v_ok boolean; v_state text; v_msg text; v_urteil text; s text; i int;
  v_zeile text;
  r record; f record;
begin
  select id into v_club from public.clubs where slug = 'fcfn';
  v_zeile := format('select status || ''/'' || coalesce(status_note, ''-'') || ''/'' || coalesce(status_until::text, ''-'') from public.player_status where player_id = %L', v_p1);
  v_basis := array[
    'update public.einladungen set widerrufen_am = now() where widerrufen_am is null',
    format('insert into public.einladungen (club_id, token) values (%L, %L)', v_club, v_tok),
    format('insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values (%L, ''00000000-0000-0000-0000-000000000000'', ''authenticated'', ''authenticated'', ''pruef0072@invalid.local'', %L, now(), now())', v_t, jsonb_build_object('name', 'Prüf Konto', 'einladung', v_tok)),
    format('insert into public.players (id, club_id, code, name) values (%L, %L, ''pr72a'', ''Prüf Eins'')', v_p1, v_club),
    format('update public.profiles set freigabe = ''aktiv'', player_id = %L where id = %L', v_p1, v_t),
    format('insert into public.einwilligungen (profile_id, art, fassung) values (%L, ''datenschutz'', ''G1'')', v_t)];

  for r in
    select * from (values
      (1, 'anon', false), (2, 'Spieler', false), (3, 'Spieler+E', true), (4, 'intern', false)
    ) as t(ord, rolle, einwilligung) order by ord
  loop
    for f in
      select * from (values
        -- ---- Widerruf: Status, Notiz und Datum weg -------------------------------------
        ('Widerruf: verletzt mit Notiz und Datum -> nicht verfügbar, ohne Notiz, ohne Datum', null::text[],
         array[format('select public.set_player_status(%L, ''verletzt'', ''Knie'', current_date + 6)::text', v_p1), 'select public.einwilligung_setzen(''gesundheit'', false, null)::text']::text[], null::text[],
         v_zeile, 'wert:nicht_verfuegbar/-/-', array['Spieler+E']),
        ('Widerruf: angeschlagen mit Notiz und Datum -> nicht verfügbar, ohne Notiz, ohne Datum', null,
         array[format('select public.set_player_status(%L, ''angeschlagen'', ''Wade'', current_date + 2)::text', v_p1), 'select public.einwilligung_setzen(''gesundheit'', false, null)::text'], null,
         v_zeile, 'wert:nicht_verfuegbar/-/-', array['Spieler+E']),
        ('Widerruf: Zeitpunkt gespeichert, keine aktive Einwilligung mehr', null,
         array['select public.einwilligung_setzen(''gesundheit'', false, null)::text'], null,
         format('select count(*) filter (where widerrufen_am is not null) || ''/'' || count(*) filter (where widerrufen_am is null) from public.einwilligungen where profile_id = %L and art = ''gesundheit''', v_t),
         'wert:1/0', array['Spieler+E']),

        -- ---- Erteilen danach startet leer ---------------------------------------------
        ('Erteilen nach Widerruf: alter Status, Notiz und Datum kommen nicht zurück', null,
         array[format('select public.set_player_status(%L, ''verletzt'', ''Knie'', current_date + 6)::text', v_p1), 'select public.einwilligung_setzen(''gesundheit'', false, null)::text',
               'select public.einwilligung_setzen(''gesundheit'', true, ''G1'')::text'], null,
         v_zeile, 'wert:nicht_verfuegbar/-/-', array['Spieler+E']),
        ('Erteilen nach Widerruf: neue Einwilligung aktiv', null,
         array['select public.einwilligung_setzen(''gesundheit'', false, null)::text', 'select public.einwilligung_setzen(''gesundheit'', true, ''G1'')::text'], null,
         format('select count(*)::text from public.einwilligungen where profile_id = %L and art = ''gesundheit'' and widerrufen_am is null', v_t),
         'wert:1', array['Spieler+E']),
        ('Erteilen nach Widerruf: verletzt ohne Notiz/Datum bleibt leer (nichts Altes übernommen)', null,
         array[format('select public.set_player_status(%L, ''verletzt'', ''Knie'', current_date + 6)::text', v_p1), 'select public.einwilligung_setzen(''gesundheit'', false, null)::text',
               'select public.einwilligung_setzen(''gesundheit'', true, ''G1'')::text', format('select public.set_player_status(%L, ''verletzt'', null, null)::text', v_p1)], null,
         v_zeile, 'wert:verletzt/-/-', array['Spieler+E']),

        -- ---- Abgrenzung ------------------------------------------------------------------
        ('Widerruf: Urlaub mit Datum bleibt (keine Gesundheitsangabe)', null,
         array[format('select public.set_player_status(%L, ''urlaub'', null, current_date + 4)::text', v_p1), 'select public.einwilligung_setzen(''gesundheit'', false, null)::text'], null,
         format('select status || ''/'' || (status_until = current_date + 4)::text from public.player_status where player_id = %L', v_p1), 'wert:urlaub/true', array['Spieler+E']),
        ('Widerruf ohne Status: fit bleibt fit', null,
         array[format('select public.set_player_status(%L, ''fit'', null, null)::text', v_p1), 'select public.einwilligung_setzen(''gesundheit'', false, null)::text'], null,
         v_zeile, 'wert:fit/-/-', array['Spieler+E']),
        ('nach Widerruf: verletzt wieder verboten', null,
         array['select public.einwilligung_setzen(''gesundheit'', false, null)::text', format('select public.set_player_status(%L, ''verletzt'', null, null)::text', v_p1)], null, null, 'verweigert', array['Spieler+E']),
        ('Spieler ohne Einwilligung: Widerruf ändert nichts', null,
         array[format('select public.set_player_status(%L, ''nicht_verfuegbar'', null, current_date + 3)::text', v_p1), 'select public.einwilligung_setzen(''gesundheit'', false, null)::text'], null,
         format('select status || ''/'' || (status_until = current_date + 3)::text from public.player_status where player_id = %L', v_p1), 'wert:nicht_verfuegbar/true', array['Spieler']),
        ('Datenschutz lässt sich nicht widerrufen', null,
         array['select public.einwilligung_setzen(''datenschutz'', false, null)::text'], null, null, 'fehler:nur mit dem Löschen', array['Spieler']),
        ('anon ruft die Funktion nicht auf', null, array['select public.einwilligung_setzen(''gesundheit'', false, null)::text'], null, null, 'verweigert', array['anon']),

        -- ---- Rechte und Bestand ------------------------------------------------------------
        ('grant: authenticated darf, anon nicht', null, null, null,
         'select has_function_privilege(''authenticated'', ''public.einwilligung_setzen(text, boolean, text)'', ''execute'')::text || ''/'' || has_function_privilege(''anon'', ''public.einwilligung_setzen(text, boolean, text)'', ''execute'')::text',
         'wert:true/false', array['intern']),
        ('Bestand: kein Datum, keine Notiz, kein Gesundheitsstatus nach Widerruf', null, null, null,
         'select count(*)::text from public.player_status s join public.profiles p on p.player_id = s.player_id
            where exists (select 1 from public.einwilligungen e where e.profile_id = p.id and e.art = ''gesundheit'' and e.widerrufen_am is not null)
              and not exists (select 1 from public.einwilligungen e where e.profile_id = p.id and e.art = ''gesundheit'' and e.widerrufen_am is null)
              and (s.status in (''angeschlagen'', ''verletzt'') or s.status_note is not null)',
         'wert:0', array['intern'])
      ) as t(fall, vor, aktion, nach, pruef, erwartet, rollen)
      where r.rolle = any(t.rollen)
    loop
      v_nr := v_nr + 1;
      v_ok := false; v_txt := null; v_state := null; v_msg := null;
      begin
        foreach s in array v_basis loop execute s; end loop;
        if r.einwilligung then
          insert into public.einwilligungen (profile_id, art, fassung) values (v_t, 'gesundheit', 'G1');
        end if;
        foreach s in array coalesce(f.vor, '{}'::text[]) loop execute s; end loop;
        if r.rolle = 'anon' then
          perform set_config('request.jwt.claims', '{"role":"anon"}', true);
          execute 'set local role anon';
        elsif r.rolle <> 'intern' then
          perform set_config('request.jwt.claims', json_build_object('sub', v_t, 'role', 'authenticated')::text, true);
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
        raise exception using errcode = 'P0072', message = 'zurückrollen';
      exception when others then
        if sqlstate <> 'P0072' then v_state := sqlstate; v_msg := sqlerrm; end if;
      end;
      v_urteil := case
        when f.erwartet = 'verweigert' then case when not v_ok and v_state = '42501' then 'PASS' else 'FAIL' end
        when f.erwartet = 'ok' then case when v_ok then 'PASS' else 'FAIL' end
        when f.erwartet like 'wert:%' then case when v_ok and coalesce(v_txt, '') = substr(f.erwartet, 6) then 'PASS' else 'FAIL' end
        when f.erwartet like 'fehler:%' then case when not v_ok and v_state <> '42501' and v_msg like '%' || substr(f.erwartet, 8) || '%' then 'PASS' else 'FAIL' end
      end;
      insert into pruef_0072 values (v_nr, r.rolle, f.fall, f.erwartet,
        case when v_ok then 'gelungen: ' || coalesce(left(v_txt, 200), '(null)') else 'abgelehnt: ' || v_state || ' ' || left(v_msg, 160) end, v_urteil);
    end loop;
  end loop;
end
$pruef$;

select nr, rolle, fall, erwartet, ergebnis, urteil from pruef_0072
union all
select null, 'SUMME', count(*) || ' Fälle: ' || count(*) filter (where urteil = 'PASS') || ' PASS, '
       || count(*) filter (where urteil = 'FAIL') || ' FAIL', null, null, null from pruef_0072
order by nr nulls last;
