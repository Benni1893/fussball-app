-- ============================================================================
-- Prüfung zu Migration 0064 (Kassenwart-Wunsch).
-- Ändert nichts: jeder Fall läuft in einer Untertransaktion, die immer
-- zurückgerollt wird. Muster wie 0061 bis 0063.
-- Im Fall: Prüfkonto T über den Spieler-Link MIT Kassenwart-Wunsch (wartet,
-- oder freigegeben mit Kadereintrag P1, Wunsch nicht bestätigt), ein zweites
-- wartendes Konto W ohne Wunsch. Die Rolle "Wunsch abgelehnt" ist T nach der
-- Freigabe ohne Bestätigung.
-- ============================================================================

drop table if exists pg_temp.pruef_0064;
create temp table pruef_0064 (nr int, rolle text, fall text, erwartet text, ergebnis text, urteil text);

do $pruef$
declare
  v_club uuid; v_admin uuid;
  v_t uuid := gen_random_uuid(); v_w uuid := gen_random_uuid(); v_tl uuid := gen_random_uuid();
  v_p1 uuid := gen_random_uuid(); v_f uuid;
  v_tok text := 'pruef0064' || replace(gen_random_uuid()::text, '-', '');
  v_basis text[]; v_frei text[];
  v_nr int := 0; v_txt text; v_ok boolean; v_state text; v_msg text; v_urteil text; s text; i int; v_sub uuid;
  r record; f record;
begin
  select id into v_club from public.clubs where slug = 'fcfn';
  select user_id into v_admin from public.user_roles where role = 'admin' limit 1;
  select id into v_f from public.fines order by date desc limit 1;
  v_basis := array[
    'update public.einladungen set widerrufen_am = now() where widerrufen_am is null and art = ''spieler''',
    format('insert into public.einladungen (club_id, token) values (%L, %L)', v_club, v_tok),
    format('insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values (%L, ''00000000-0000-0000-0000-000000000000'', ''authenticated'', ''authenticated'', ''pruef0064@invalid.local'', %L, now(), now())', v_t, jsonb_build_object('name', 'Prüf Kasse', 'einladung', v_tok, 'kassenwart', true)),
    format('insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values (%L, ''00000000-0000-0000-0000-000000000000'', ''authenticated'', ''authenticated'', ''pruef0064w@invalid.local'', %L, now(), now())', v_w, jsonb_build_object('name', 'Prüf Ohne', 'einladung', v_tok)),
    format('insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values (%L, ''00000000-0000-0000-0000-000000000000'', ''authenticated'', ''authenticated'', ''pruef0064tl@invalid.local'', %L, now(), now())', v_tl, jsonb_build_object('name', 'Prüf Leitung', 'einladung', v_tok)),
    format('update public.profiles set freigabe = ''aktiv'' where id = %L', v_tl),
    format('insert into public.players (id, club_id, code, name) values (%L, %L, ''pr64a'', ''Prüf Eins'')', v_p1, v_club)];
  -- "Wunsch abgelehnt": freigegeben, Wunsch erledigt, keine Kassenwart-Rolle
  v_frei := v_basis || array[format('update public.profiles set freigabe = ''aktiv'', player_id = %L, kassenwart_wunsch = false where id = %L', v_p1, v_t)];

  for r in
    select * from (values
      (1, 'anon', null::text), (2, 'Wartend+Wunsch', null), (3, 'Wunsch abgelehnt', null), (4, 'Spieler', null),
      (5, 'Kassenwart', 'treasurer'), (6, 'Trainer', 'coach'), (7, 'Admin', 'admin'), (8, 'intern', null)
    ) as t(ord, rolle, zusatzrolle) order by ord
  loop
    for f in
      select * from (values
        -- ---- Registrierung und Anzeige -------------------------------------------
        ('Wunsch wird gespeichert, ohne Rolle', null::text[], null::text[], null::text[],
         format('select (select kassenwart_wunsch from public.profiles where id = %L)::text || ''/'' || (select kassenwart_wunsch from public.profiles where id = %L)::text || ''/'' || (select count(*) from public.user_roles where user_id = %L and role = ''treasurer'')::text', v_t, v_w, v_t),
         'wert:true/false/0', array['intern']),
        ('mein_konto zeigt den Wunsch', null, array['select (public.mein_konto())->>''kassenwart_wunsch'''], null, null, 'wert:true', array['Wartend+Wunsch']),
        ('Anfragen zeigen den Wunsch', null,
         array[format('select string_agg(x->>''kassenwart_wunsch'', '','' order by x->>''name'') from jsonb_array_elements(public.anfragen_liste()) x where (x->>''id'')::uuid in (%L, %L)', v_t, v_w)],
         null, null, 'wert:true,false', array['Trainer','Admin']),
        ('Anfragen lesen', null, array['select public.anfragen_liste()::text'], null, null, 'verweigert', array['anon','Wartend+Wunsch','Wunsch abgelehnt','Spieler','Kassenwart']),
        ('Wunsch selbst setzen (Profil ändern)', array[format('update public.profiles set kassenwart_wunsch = false where id = %L', v_t)],
         array[format('update public.profiles set kassenwart_wunsch = true where id = %L', v_t)], null,
         format('select kassenwart_wunsch::text from public.profiles where id = %L', v_t), 'wert:false', array['Wartend+Wunsch','Spieler']),

        -- ---- Entscheidung des Trainers ---------------------------------------------------
        ('Freigeben mit Bestätigung: Spieler und Kassenwart, PayPal-Frage', null,
         array[format('select public.anfrage_freigeben(%L, null, null, true)::text', v_t)], null,
         format('select p.freigabe || ''/'' || p.kassenwart_wunsch::text || ''/'' || p.paypal_frage::text || ''/'' || (select string_agg(role, '','' order by role) from public.user_roles where user_id = p.id) || ''/'' || (select count(*) from public.konto_protokoll where ziel = p.id and aktion = ''kassenwart_bestaetigt'')::text from public.profiles p where p.id = %L', v_t),
         'wert:aktiv/false/true/player,treasurer/1', array['Trainer','Admin']),
        ('Freigeben ohne Bestätigung: nur Spieler, protokolliert', null,
         array[format('select public.anfrage_freigeben(%L, null, null, false)::text', v_t)], null,
         format('select p.freigabe || ''/'' || p.kassenwart_wunsch::text || ''/'' || p.paypal_frage::text || ''/'' || (select string_agg(role, '','' order by role) from public.user_roles where user_id = p.id) || ''/'' || (select count(*) from public.konto_protokoll where ziel = p.id and aktion = ''kassenwart_nicht_bestaetigt'')::text from public.profiles p where p.id = %L', v_t),
         'wert:aktiv/false/false/player/1', array['Trainer']),
        ('Bestätigung ohne Wunsch vergibt keine Rolle', null,
         array[format('select public.anfrage_freigeben(%L, null, null, true)::text', v_w)], null,
         format('select (select string_agg(role, '','' order by role) from public.user_roles where user_id = %L)', v_w), 'wert:player', array['Trainer']),
        ('Mehrere Wünsche einzeln entschieden', array[format('update public.profiles set kassenwart_wunsch = true where id = %L', v_w)],
         array[format('select public.anfrage_freigeben(%L, null, null, true)::text', v_t), format('select public.anfrage_freigeben(%L, null, null, false)::text', v_w)], null,
         format('select (select count(*) from public.user_roles where user_id = %L and role = ''treasurer'')::text || ''/'' || (select count(*) from public.user_roles where user_id = %L and role = ''treasurer'')::text', v_t, v_w),
         'wert:1/0', array['Trainer']),
        ('Ablehnen: Wunsch verfällt, protokolliert', null,
         array[format('select public.anfrage_ablehnen(%L)::text', v_t)], null,
         format('select p.freigabe || ''/'' || p.kassenwart_wunsch::text || ''/'' || (select count(*) from public.konto_protokoll where ziel = p.id and aktion = ''kassenwart_nicht_bestaetigt'')::text || ''/'' || (select count(*) from public.user_roles where user_id = p.id and role = ''treasurer'')::text from public.profiles p where p.id = %L', v_t),
         'wert:abgelehnt/false/1/0', array['Admin']),
        ('Freigeben', null, array[format('select public.anfrage_freigeben(%L, null, null, true)::text', v_w)], null, null, 'verweigert', array['anon','Wartend+Wunsch','Wunsch abgelehnt','Spieler','Kassenwart']),

        -- ---- Ohne Bestätigung kein Zugriff auf die Kasse --------------------------------------
        ('Strafen lesen', null, array['select count(*)::text from public.fines'], null, null, 'wert:0', array['Wartend+Wunsch']),
        ('Kassenverlauf lesen', null, array['select count(*)::text from public.fine_status_log'], null, null, 'wert:0', array['Wartend+Wunsch','Wunsch abgelehnt','Spieler']),
        ('Teameinstellungen lesen', null, array['select count(*)::text from public.team_settings'], null, null, 'wert:0', array['Wartend+Wunsch']),
        ('PayPal-Link setzen', null, array['select public.paypal_setzen(''pruefkasse'')::text'], null, null, 'verweigert', array['Wartend+Wunsch','Wunsch abgelehnt','Spieler']),
        ('Zahlung bestätigen', null, array[format('select public.confirm_fines(array[%L::uuid], ''bar'')::text', v_f)], null, null, 'fehler:Nur Kassenwart', array['Wartend+Wunsch','Wunsch abgelehnt','Spieler']),
        ('Strafe ändern', null, array[format('update public.fines set note = ''pruef'' where id = %L', v_f)], null,
         format('select (coalesce(note, '''') = ''pruef'')::text from public.fines where id = %L', v_f), 'wert:false', array['Wartend+Wunsch','Wunsch abgelehnt','Spieler']),
        ('Kassenwart hat Zugriff (Gegenprobe)', null, array['select (count(*) > 0)::text from public.fine_status_log'], null, null, 'wert:true', array['Kassenwart']),

        -- ---- Bestand -----------------------------------------------------------------------
        ('Bestand: niemand hat einen offenen Wunsch und ist aktiv', null, null, null,
         'select count(*)::text from public.profiles where kassenwart_wunsch and freigabe <> ''wartet''', 'wert:0', array['intern']),
        ('Nur eine Fassung von anfrage_freigeben', null, null, null,
         'select count(*)::text from pg_proc where proname = ''anfrage_freigeben'' and pronamespace = ''public''::regnamespace', 'wert:1', array['intern'])
      ) as t(fall, vor, aktion, nach, pruef, erwartet, rollen)
      where r.rolle = any(t.rollen)
    loop
      v_nr := v_nr + 1;
      v_ok := false; v_txt := null; v_state := null; v_msg := null;
      begin
        foreach s in array (case when r.rolle in ('anon','intern','Wartend+Wunsch') then v_basis else v_frei end) loop execute s; end loop;
        if r.zusatzrolle is not null then
          insert into public.user_roles (user_id, role, club_id) values (case when r.rolle in ('Trainer','Admin') then v_tl else v_t end, r.zusatzrolle, v_club) on conflict do nothing;
        end if;
        if r.rolle in ('Trainer','Admin') then execute format('update public.profiles set freigabe = ''wartet'', player_id = null, kassenwart_wunsch = true where id = %L', v_t); end if;
        foreach s in array coalesce(f.vor, '{}'::text[]) loop execute s; end loop;
        v_sub := case when r.rolle in ('Trainer','Admin') then v_tl else v_t end;
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
        raise exception using errcode = 'P0064', message = 'zurückrollen';
      exception when others then
        if sqlstate <> 'P0064' then v_state := sqlstate; v_msg := sqlerrm; end if;
      end;
      v_urteil := case
        when f.erwartet = 'verweigert' then case when not v_ok and v_state = '42501' then 'PASS' else 'FAIL' end
        when f.erwartet = 'ok' then case when v_ok then 'PASS' else 'FAIL' end
        when f.erwartet like 'wert:%' then case when v_ok and coalesce(v_txt, '') = substr(f.erwartet, 6) then 'PASS' else 'FAIL' end
        when f.erwartet like 'fehler:%' then case when not v_ok and v_state <> '42501' and v_msg like '%' || substr(f.erwartet, 8) || '%' then 'PASS' else 'FAIL' end
      end;
      insert into pruef_0064 values (v_nr, r.rolle, f.fall, f.erwartet,
        case when v_ok then 'gelungen: ' || coalesce(left(v_txt, 200), '(null)') else 'abgelehnt: ' || v_state || ' ' || left(v_msg, 160) end, v_urteil);
    end loop;
  end loop;
end
$pruef$;

select nr, rolle, fall, erwartet, ergebnis, urteil from pruef_0064
union all
select null, 'SUMME', count(*) || ' Fälle: ' || count(*) filter (where urteil = 'PASS') || ' PASS, '
       || count(*) filter (where urteil = 'FAIL') || ' FAIL', null, null, null from pruef_0064
order by nr nulls last;
