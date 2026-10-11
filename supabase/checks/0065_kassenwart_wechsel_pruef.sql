-- ============================================================================
-- Prüfung zu Migration 0065 (Kassenwart-Wechsel).
-- Ändert nichts: jeder Fall läuft in einer Untertransaktion, die immer
-- zurückgerollt wird. Muster wie 0061 bis 0064.
-- Im Fall: Kassenwart K mit PayPal-Link "pruefkasse", Spieler T mit
-- Kadereintrag P1 und zwei an K gemeldeten Strafen (5 und 7 Euro), ein
-- zweites Konto N (wird neuer Kassenwart), Leitung TR (Trainer oder Admin).
-- Meldungen ohne festgehaltenes Ziel (vor 0065) zählen seit 0066 zu
-- niemandem; v_alt_n bleibt deshalb 0.
-- ============================================================================

drop table if exists pg_temp.pruef_0065;
create temp table pruef_0065 (nr int, rolle text, fall text, erwartet text, ergebnis text, urteil text);

do $pruef$
declare
  v_club uuid; v_admin uuid; v_alt_n integer;
  v_t uuid := gen_random_uuid(); v_k uuid := gen_random_uuid(); v_n uuid := gen_random_uuid(); v_tr uuid := gen_random_uuid();
  v_p1 uuid := gen_random_uuid(); v_f1 uuid := gen_random_uuid(); v_f2 uuid := gen_random_uuid(); v_f3 uuid := gen_random_uuid();
  v_tok text := 'pruef0065' || replace(gen_random_uuid()::text, '-', '');
  v_basis text[]; v_frei text[];
  v_nr int := 0; v_txt text; v_ok boolean; v_state text; v_msg text; v_urteil text; s text; i int; v_sub uuid;
  r record; f record;
  u text := 'insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values (%L, ''00000000-0000-0000-0000-000000000000'', ''authenticated'', ''authenticated'', %L, %L, now(), now())';
begin
  select id into v_club from public.clubs where slug = 'fcfn';
  select user_id into v_admin from public.user_roles where role = 'admin' limit 1;
  v_alt_n := 0;  -- seit 0066 zaehlen Meldungen ohne Ziel zu niemandem
  v_basis := array[
    'update public.einladungen set widerrufen_am = now() where widerrufen_am is null and art = ''spieler''',
    format('insert into public.einladungen (club_id, token) values (%L, %L)', v_club, v_tok),
    format(u, v_t, 'pruef0065t@invalid.local', jsonb_build_object('name', 'Prüf Spieler', 'einladung', v_tok)),
    format(u, v_k, 'pruef0065k@invalid.local', jsonb_build_object('name', 'Prüf Kasse', 'einladung', v_tok)),
    format(u, v_n, 'pruef0065n@invalid.local', jsonb_build_object('name', 'Prüf Neu', 'einladung', v_tok)),
    format(u, v_tr, 'pruef0065tr@invalid.local', jsonb_build_object('name', 'Prüf Leitung', 'einladung', v_tok)),
    format('update public.profiles set freigabe = ''aktiv'' where id in (%L, %L, %L)', v_k, v_n, v_tr),
    format('insert into public.user_roles (user_id, role, club_id) values (%L, ''treasurer'', %L)', v_k, v_club),
    format('update public.team_settings set paypal_name = ''pruefkasse'', paypal_von = %L', v_k),
    format('insert into public.players (id, club_id, code, name) values (%L, %L, ''pr65a'', ''Prüf Eins'')', v_p1, v_club),
    format('insert into public.fines (id, club_id, player_id, offense, base_amount, date, status) values (%L, %L, %L, ''Prüf eins'', 5, current_date, ''offen''), (%L, %L, %L, ''Prüf zwei'', 7, current_date, ''offen''), (%L, %L, %L, ''Prüf drei'', 3, current_date, ''offen'')',
           v_f1, v_club, v_p1, v_f2, v_club, v_p1, v_f3, v_club, v_p1),
    format('update public.fines set status = ''gemeldet'' where id in (%L, %L)', v_f1, v_f2)];
  v_frei := v_basis || array[format('update public.profiles set freigabe = ''aktiv'', player_id = %L where id = %L', v_p1, v_t)];

  for r in
    select * from (values
      (1, 'anon', null::text), (2, 'Wartend', null), (3, 'Spieler', null), (4, 'Kassenwart', null),
      (5, 'Trainer', 'coach'), (6, 'Admin', 'admin'), (7, 'intern', null)
    ) as t(ord, rolle, zusatzrolle) order by ord
  loop
    for f in
      select * from (values
        -- ---- Zahlungsziel ----------------------------------------------------------
        ('Meldung hält Kassenwart und PayPal-Link fest', null::text[], null::text[], null::text[],
         format('select string_agg(zahlung_an_name || '':'' || zahlung_an_paypal || '':'' || (zahlung_an = %L)::text, '','') from public.fines where id in (%L, %L)', v_k, v_f1, v_f2),
         'wert:Prüf Kasse:pruefkasse:true,Prüf Kasse:pruefkasse:true', array['intern']),
        ('Spieler meldet selbst: Ziel ist der Halter des Links', null, array['select public.report_my_payment(''paypal'', null)::text'], null,
         format('select zahlung_an_name || '':'' || coalesce(zahlung_an_paypal, ''-'') from public.fines where id = %L', v_f3), 'wert:Prüf Kasse:pruefkasse', array['Spieler']),
        ('Meldung ohne Link: kein Ziel', array['update public.team_settings set paypal_name = null, paypal_von = null'], array['select public.report_my_payment(''bar'', null)::text'], null,
         format('select coalesce(zahlung_an::text, ''-'') from public.fines where id = %L', v_f3), 'wert:-', array['Spieler']),
        ('Bestätigen ohne Meldung: Ziel ist, wer bestätigt', null, array[format('select public.confirm_fines(array[%L::uuid], ''bar'')::text', v_f3)], null,
         format('select zahlung_an_name || '':'' || coalesce(zahlung_an_paypal, ''-'') from public.fines where id = %L', v_f3), 'wert:Prüf Kasse:pruefkasse', array['Kassenwart']),
        ('Bestätigen einer Meldung: Ziel bleibt', null, array[format('select public.confirm_fines(array[%L::uuid], ''paypal'')::text', v_f1)], null,
         format('select status || '':'' || zahlung_an_name from public.fines where id = %L', v_f1), 'wert:bestätigt:Prüf Kasse', array['Kassenwart']),
        ('Zurück auf offen löscht das Ziel', null, array[format('select public.confirm_fines(array[%L::uuid], ''paypal'')::text', v_f1), format('select public.undo_fine_payment(%L)::text', v_f1)], null,
         format('select status || '':'' || coalesce(zahlung_an::text, ''-'') || '':'' || an_vorherigen::text from public.fines where id = %L', v_f1), 'wert:offen:-:false', array['Kassenwart']),
        ('Ziel selbst ändern', null, array[format('update public.fines set zahlung_an = %L, an_vorherigen = true where id = %L', v_t, v_f1)], null,
         format('select (zahlung_an = %L)::text || '':'' || an_vorherigen::text from public.fines where id = %L', v_k, v_f1), 'wert:true:false', array['Wartend','Spieler']),
        ('Spieler sieht das Ziel seiner Strafe', null, array[format('select zahlung_an_name from public.fines where id = %L', v_f1)], null, null, 'wert:Prüf Kasse', array['Spieler']),

        -- ---- Offene Meldungen --------------------------------------------------------
        ('Offene Meldungen lesen', null, array[format('select public.kassenwart_offen(%L)::text', v_k)], null, null, 'verweigert', array['anon','Wartend','Spieler','Kassenwart']),
        ('Offene Meldungen: Anzahl und Summe', null,
         array[format('select ((public.kassenwart_offen(%L))->>''anzahl'')::integer - %s || '':'' || (((public.kassenwart_offen(%L))->>''summe'')::numeric >= 12)::text', v_k, v_alt_n, v_k)],
         null, null, 'wert:2:true', array['Trainer','Admin']),
        ('Interne Zählung nicht aufrufbar', null, array[format('select (public.kassenwart_offen_intern(%L)).anzahl::text', v_k)], null, null, 'verweigert', array['anon','Wartend','Spieler','Kassenwart','Trainer']),

        -- ---- Wechsel -------------------------------------------------------------------
        ('Entziehen mit offenen Meldungen ohne Bestätigung: Abbruch', null,
         array[format('select public.rolle_setzen(%L, ''treasurer'', false)::text', v_k)], null, null, 'fehler:Offene Meldungen', array['Trainer','Admin']),
        ('Trotzdem wechseln: Meldungen markiert, bleiben gemeldet, Link weg', null,
         array[format('select public.rolle_setzen(%L, ''treasurer'', true)::text', v_n), format('select public.rolle_setzen(%L, ''treasurer'', false, true)::text', v_k)], null,
         format('select (select count(*) from public.fines where id in (%L, %L) and status = ''gemeldet'' and an_vorherigen and zahlung_an = %L)::text || '':'' || (select coalesce(paypal_name, ''-'') from public.team_settings) || '':'' || (select count(*) from public.user_roles where user_id = %L and role = ''treasurer'')::text || '':'' || ((public.kassenwart_offen_intern(%L)).anzahl)::text', v_f1, v_f2, v_k, v_k, v_k),
         'wert:2:-:0:0', array['Trainer']),
        ('Trotzdem wechseln: protokolliert mit Anzahl', null,
         array[format('select public.rolle_setzen(%L, ''treasurer'', false, true)::text', v_k)], null,
         format('select ((details->>''offen'')::integer - %s)::text from public.konto_protokoll where ziel = %L and aktion = ''kassenwart_gewechselt''', v_alt_n, v_k), 'wert:2', array['Admin']),
        ('Push an den alten Kassenwart mit Hinweis', null,
         array[format('select public.rolle_setzen(%L, ''treasurer'', false, true)::text', v_k)], null,
         format('select titel || '' / '' || (text = ''Du bist nicht mehr Kassenwart. Dein PayPal-Link wird nicht mehr angezeigt. '' || (2 + %s) || '' offene Meldungen gehen an die neue Kasse.'')::text from public.notification_outbox where profile_id = %L and kategorie = ''kasse_abgegeben''', v_alt_n, v_k),
         'wert:🔑 Kasse abgegeben / true', array['Trainer']),
        ('Push an den neuen Kassenwart', null,
         array[format('select public.rolle_setzen(%L, ''treasurer'', true)::text', v_n)], null,
         format('select titel || '' / '' || text || '' / '' || (select paypal_frage::text from public.profiles where id = %L) from public.notification_outbox where profile_id = %L and kategorie = ''kasse_neu''', v_n, v_n),
         'wert:🔑 Du bist jetzt Kassenwart / Bitte hinterlege deinen PayPal-Link, damit die Mannschaft an dich zahlen kann. / true', array['Admin']),
        ('Ohne offene Meldungen: Entziehen ohne Rückfrage', array[format('update public.fines set status = ''offen'' where id in (%L, %L)', v_f1, v_f2), 'update public.fines set zahlung_an = gen_random_uuid() where status = ''gemeldet'' and zahlung_an is null'],
         array[format('select public.rolle_setzen(%L, ''treasurer'', false)::text', v_k)], null,
         format('select count(*)::text from public.user_roles where user_id = %L and role = ''treasurer''', v_k), 'wert:0', array['Trainer']),
        ('Mehrere Kassenwarte: Entziehen des einen lässt den Link des anderen', array[format('insert into public.user_roles (user_id, role, club_id) values (%L, ''treasurer'', %L)', v_n, v_club)],
         array[format('select public.rolle_setzen(%L, ''treasurer'', false, true)::text', v_n)], null,
         'select coalesce(paypal_name, ''-'') from public.team_settings', 'wert:pruefkasse', array['Trainer']),
        ('Neuer Link erst nach dem Setzen sichtbar', array[format('update public.team_settings set paypal_name = null, paypal_von = null')],
         array['select coalesce((select paypal_name from public.team_settings), ''-'')'], null, null, 'wert:-', array['Spieler']),
        ('Rolle setzen', null, array[format('select public.rolle_setzen(%L, ''treasurer'', false, true)::text', v_k)], null, null, 'verweigert', array['anon','Wartend','Spieler','Kassenwart']),

        -- ---- Vorlagen und Bestand ----------------------------------------------------------
        ('Vorlagen kasse_neu und kasse_abgegeben', null, null, null,
         'select string_agg(kategorie || '':'' || left(titel_vorlage, 1) || '':'' || aktiv::text, '','' order by kategorie) from public.notification_templates where kategorie in (''kasse_neu'', ''kasse_abgegeben'')',
         'wert:kasse_abgegeben:🔑:true,kasse_neu:🔑:true', array['intern']),
        ('Kategorien für alle erlaubt', null, null, null,
         format('select public.kategorie_erlaubt(%L, ''kasse_neu'')::text || '':'' || public.kategorie_erlaubt(%L, ''kasse_abgegeben'')::text', v_t, v_t), 'wert:true:true', array['intern']),
        ('Nur eine Fassung von rolle_setzen', null, null, null,
         'select count(*)::text from pg_proc where proname = ''rolle_setzen'' and pronamespace = ''public''::regnamespace', 'wert:1', array['intern']),
        ('0066: alte Meldungen ohne Ziel zählen nicht zum Halter des Links', array['update public.fines set zahlung_an = null, zahlung_an_name = null, zahlung_an_paypal = null where id in (''' || v_f1 || ''', ''' || v_f2 || ''')'],
         array[format('select ((public.kassenwart_offen(%L))->>''anzahl'')', v_k)], null, null, 'wert:0', array['Trainer']),
        ('0066: Wechsel lässt alte Meldungen unmarkiert', array['update public.fines set zahlung_an = null, zahlung_an_name = null, zahlung_an_paypal = null where id in (''' || v_f1 || ''', ''' || v_f2 || ''')'],
         array[format('select public.rolle_setzen(%L, ''treasurer'', false)::text', v_k)], null,
         'select count(*)::text from public.fines where an_vorherigen', 'wert:0', array['Trainer']),
        ('0067: Löschen des Kassenwarts anonymisiert das Zahlungsziel', null, array[format('select public.mitglied_entfernen(%L)::text', v_k)], null,
         format('select string_agg(coalesce(zahlung_an::text, ''-'') || '':'' || zahlung_an_name || '':'' || coalesce(zahlung_an_paypal, ''-''), '','') from public.fines where id in (%L, %L)', v_f1, v_f2),
         'wert:-:gelöschtes Konto:-,-:gelöschtes Konto:-', array['Admin']),
        ('Bestand: Markierung nur bei gemeldet oder bestätigt', null, null, null,
         'select count(*)::text from public.fines where an_vorherigen and status not in (''gemeldet'', ''bestätigt'')', 'wert:0', array['intern'])
      ) as t(fall, vor, aktion, nach, pruef, erwartet, rollen)
      where r.rolle = any(t.rollen)
    loop
      v_nr := v_nr + 1;
      v_ok := false; v_txt := null; v_state := null; v_msg := null;
      begin
        foreach s in array (case when r.rolle in ('anon','Wartend') then v_basis else v_frei end) loop execute s; end loop;
        if r.zusatzrolle is not null then
          insert into public.user_roles (user_id, role, club_id) values (v_tr, r.zusatzrolle, v_club) on conflict do nothing;
        end if;
        foreach s in array coalesce(f.vor, '{}'::text[]) loop execute s; end loop;
        v_sub := case when r.rolle in ('Trainer','Admin') then v_tr when r.rolle = 'Kassenwart' then v_k else v_t end;
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
        raise exception using errcode = 'P0065', message = 'zurückrollen';
      exception when others then
        if sqlstate <> 'P0065' then v_state := sqlstate; v_msg := sqlerrm; end if;
      end;
      v_urteil := case
        when f.erwartet = 'verweigert' then case when not v_ok and v_state = '42501' then 'PASS' else 'FAIL' end
        when f.erwartet = 'ok' then case when v_ok then 'PASS' else 'FAIL' end
        when f.erwartet like 'wert:%' then case when v_ok and coalesce(v_txt, '') = substr(f.erwartet, 6) then 'PASS' else 'FAIL' end
        when f.erwartet like 'fehler:%' then case when not v_ok and v_state <> '42501' and v_msg like '%' || substr(f.erwartet, 8) || '%' then 'PASS' else 'FAIL' end
      end;
      insert into pruef_0065 values (v_nr, r.rolle, f.fall, f.erwartet,
        case when v_ok then 'gelungen: ' || coalesce(left(v_txt, 200), '(null)') else 'abgelehnt: ' || v_state || ' ' || left(v_msg, 160) end, v_urteil);
    end loop;
  end loop;
end
$pruef$;

select nr, rolle, fall, erwartet, ergebnis, urteil from pruef_0065
union all
select null, 'SUMME', count(*) || ' Fälle: ' || count(*) filter (where urteil = 'PASS') || ' PASS, '
       || count(*) filter (where urteil = 'FAIL') || ' FAIL', null, null, null from pruef_0065
order by nr nulls last;
