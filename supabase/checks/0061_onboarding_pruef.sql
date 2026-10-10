-- ============================================================================
-- Prüfung zu Migration 0061 (Anmeldung und Onboarding).
-- Ändert nichts: jeder Fall läuft in einer Untertransaktion, die immer
-- zurückgerollt wird. Muster wie 0050_nachfrage_pruef.sql.
-- Im Fall wird ein Prüfkonto über auth.users mit gültigem Einladungstoken
-- angelegt (Trigger handle_new_user). Je Rolle bekommt es den passenden
-- Stand: Wartend (frisch), Spieler (freigegeben, mit Kadereintrag), Trainer,
-- Kassenwart, Admin (jeweils Spieler plus Rolle). anon und intern prüfen
-- Rechte und Daten ohne Konto.
-- ============================================================================

drop table if exists pg_temp.pruef_0061;
create temp table pruef_0061 (nr int, rolle text, fall text, erwartet text, ergebnis text, urteil text);

do $pruef$
declare
  v_club  uuid;
  v_admin uuid;
  v_t     uuid := gen_random_uuid();   -- Prüfkonto
  v_w     uuid := gen_random_uuid();   -- zweites Konto (wartet)
  v_pl    uuid := gen_random_uuid();
  v_tok   text := 'pruef0061' || replace(gen_random_uuid()::text, '-', '');
  v_basis text[];
  v_frei  text[];
  v_nr int := 0; v_txt text; v_ok boolean; v_state text; v_msg text; v_urteil text; s text; i int;
  r record; f record;
begin
  select id into v_club from public.clubs where slug = 'fcfn';
  select user_id into v_admin from public.user_roles where role = 'admin' limit 1;

  v_basis := array[
    'update public.einladungen set widerrufen_am = now() where widerrufen_am is null',
    format('insert into public.einladungen (club_id, token) values (%L, %L)', v_club, v_tok),
    format('insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values (%L, ''00000000-0000-0000-0000-000000000000'', ''authenticated'', ''authenticated'', ''pruef0061a@invalid.local'', %L, now(), now())',
           v_t, jsonb_build_object('name', 'Prüf Konto', 'einladung', v_tok)),
    format('insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values (%L, ''00000000-0000-0000-0000-000000000000'', ''authenticated'', ''authenticated'', ''pruef0061b@invalid.local'', %L, now(), now())',
           v_w, jsonb_build_object('name', 'Wartet Noch', 'einladung', v_tok))];
  -- freigegeben mit eigenem Kadereintrag
  v_frei := v_basis || array[
    format('insert into public.players (id, club_id, code, name, hauptposition) values (%L, %L, ''pruef61'', ''Prüf Konto'', ''sturm'')', v_pl, v_club),
    format('update public.profiles set freigabe = ''aktiv'', player_id = %L where id = %L', v_pl, v_t)];

  for r in
    select * from (values
      (1, 'anon', null::text), (2, 'Wartend', null), (3, 'Spieler', null), (4, 'Trainer', 'coach'),
      (5, 'Kassenwart', 'treasurer'), (6, 'Admin', 'admin'), (7, 'intern', null)
    ) as t(ord, rolle, zusatzrolle) order by ord
  loop
    for f in
      select * from (values
        -- ---- 1) Wartendes Konto sieht keine Mannschaftsdaten -------------------
        ('Termine, Spieler, Strafen, Katalog, Verein, Einstellungen lesen', null::text[],
         array['select (select count(*) from public.events) + (select count(*) from public.players) + (select count(*) from public.fines) + (select count(*) from public.fine_catalog) + (select count(*) from public.clubs) + (select count(*) from public.team_settings) || ''''']::text[],
         null::text[], null::text, 'wert:0', array['Wartend']),
        ('Rückmeldungen, Status, Aufstellungen lesen', null, array['select (select count(*) from public.rsvps) + (select count(*) from public.player_status) + (select count(*) from public.lineups) || '''''], null, null, 'wert:0', array['Wartend']),
        ('eigene Rollen leer, keine Mitgliedschaft', null, array['select coalesce(array_length(public.my_roles(), 1), 0)::text || ''/'' || public.ist_mitglied()::text || ''/'' || public.has_role(''player'')::text'], null, null, 'wert:0/false/false', array['Wartend']),
        ('mein_konto: wartet, Name aus der Registrierung', null, array['select (k->>''freigabe'') || ''/'' || (k->>''anzeigename'') from (select public.mein_konto() k) q'], null, null, 'wert:wartet/Prüf Konto', array['Wartend']),
        ('Position und Datenschutz im Onboarding setzbar', null, array['select public.meine_position_setzen(''torwart'')::text', 'select (k->>''position'') || ''/'' || (k->''datenschutz''->>''fassung'') from (select public.einwilligung_setzen(''datenschutz'', true, ''2026-10'') k) q'], null, null, 'wert:torwart/2026-10', array['Wartend']),
        ('Spieler selbst wählen gesperrt', null, array['select public.set_my_player((select id from public.players limit 1))::text'], null, null, 'verweigert', array['Wartend']),
        ('Kalender-Token gesperrt', null, array['select public.my_calendar_token()'], null, null, 'verweigert', array['Wartend']),
        ('Strafen melden ohne Kadereintrag scheitert', null, array['select public.report_my_payment(''bar'', null)::text'], null, null, 'fehler:Spieler', array['Wartend']),

        -- ---- 2) Rechte der neuen RPCs ------------------------------------------
        ('Einladung prüfen ohne Konto', null, array[format('select (public.einladung_pruefen(%L))->>''gueltig''', v_tok)], null, null, 'wert:true', array['anon']),
        ('falsches Token ist ungültig', null, array['select (public.einladung_pruefen(''falsch''))->>''gueltig'''], null, null, 'wert:false', array['anon']),
        ('Einladung holen', null, array['select length((public.einladung_holen())->>''token'')::text'], null, null, 'verweigert', array['anon','Wartend','Spieler','Kassenwart']),
        ('Einladung holen als Trainer und Admin', null, array['select ((public.einladung_holen())->>''token'' is not null)::text'], null, null, 'wert:true', array['Trainer','Admin']),
        ('offene Anfragen lesen', null, array['select jsonb_array_length(public.anfragen_liste())::text'], null, null, 'verweigert', array['anon','Wartend','Spieler','Kassenwart']),
        ('offene Anfragen als Trainer und Admin (das zweite Konto wartet)', null, array[format('select (select count(*) from jsonb_array_elements(public.anfragen_liste()) e where e->>''id'' = %L)::text', v_w)], null, null, 'wert:1', array['Trainer','Admin']),
        ('Kader ohne Konto lesen', null, array['select jsonb_array_length(public.kader_frei())::text'], null, null, 'verweigert', array['anon','Wartend','Spieler','Kassenwart']),
        ('freigeben', null, array[format('select public.anfrage_freigeben(%L, null, null)::text', v_w)], null, null, 'verweigert', array['anon','Wartend','Spieler','Kassenwart']),
        ('ablehnen', null, array[format('select public.anfrage_ablehnen(%L)::text', v_w)], null, null, 'verweigert', array['anon','Wartend','Spieler','Kassenwart']),
        ('Mitglieder lesen', null, array['select jsonb_array_length(public.mitglieder_liste())::text'], null, null, 'verweigert', array['anon','Wartend','Spieler','Kassenwart']),
        ('Rolle vergeben', null, array[format('select public.rolle_setzen(%L, ''coach'', true)::text', v_admin)], null, null, 'verweigert', array['anon','Wartend','Spieler','Kassenwart']),
        ('Protokoll lesen', null, array['select jsonb_array_length(public.protokoll_liste(5))::text'], null, null, 'verweigert', array['anon','Wartend','Spieler','Kassenwart']),
        ('PayPal setzen', null, array['select public.paypal_setzen(''Pruef'')::text'], null, null, 'verweigert', array['anon','Wartend','Spieler','Trainer']),
        ('Mitglied entfernen', null, array[format('select public.mitglied_entfernen(%L)::text', v_admin)], null, null, 'verweigert', array['anon','Wartend','Spieler','Kassenwart']),
        ('Spielplan BFV setzen', null, array['select public.set_ical_url(null)::text'], null, null, 'verweigert', array['Wartend','Spieler','Kassenwart']),
        ('Spielplan BFV setzen als Trainer und Admin', null, array['select public.set_ical_url((select ical_url from public.clubs where slug = ''fcfn''))::text'], null, null, 'ok', array['Trainer','Admin']),
        ('neue Tabellen direkt lesen', null, array['select (select count(*) from public.einladungen)::text'], null, null, 'verweigert', array['anon','Wartend','Spieler','Trainer','Kassenwart','Admin']),
        ('Protokoll direkt lesen', null, array['select (select count(*) from public.konto_protokoll)::text'], null, null, 'verweigert', array['Spieler','Trainer','Admin']),
        ('Einwilligungen direkt lesen', null, array['select (select count(*) from public.einwilligungen)::text'], null, null, 'verweigert', array['Wartend','Spieler','Admin']),

        -- ---- 3) Freigabe ---------------------------------------------------------
        ('Freigabe mit neuem Kadereintrag: aktiv, Name, Push an die Person', null,
         array[format('select public.anfrage_freigeben(%L, null, null)::text', v_w)], null,
         format('select p.freigabe || ''/'' || pl.name || ''/'' || (select count(*) from public.notification_outbox o where o.profile_id = p.id and o.kategorie = ''konto_freigegeben'')::text || ''/'' || (select count(*) from public.konto_protokoll k where k.ziel = p.id and k.aktion = ''freigegeben'')::text from public.profiles p join public.players pl on pl.id = p.player_id where p.id = %L', v_w),
         'wert:aktiv/Wartet Noch/1/1', array['Trainer']),
        ('Freigabe mit bestehendem Kadereintrag ohne Konto', array[format('insert into public.players (id, club_id, code, name) values (''00000000-0000-0000-0000-000000006101'', %L, ''pruef61b'', ''Alt Eintrag'')', v_club)],
         array[format('select public.anfrage_freigeben(%L, ''00000000-0000-0000-0000-000000006101'', null)::text', v_w)], null,
         format('select pl.name from public.profiles p join public.players pl on pl.id = p.player_id where p.id = %L', v_w),
         'wert:Alt Eintrag', array['Admin']),
        ('Kadereintrag mit Konto ist nicht zuordenbar', null,
         array[format('select public.anfrage_freigeben(%L, %L, null)::text', v_w, v_pl)], null, null, 'fehler:schon ein Konto', array['Trainer']),
        ('Ablehnen: abgelehnt, sieht weiter nichts, protokolliert', null,
         array[format('select public.anfrage_ablehnen(%L)::text', v_w)], null,
         format('select freigabe || ''/'' || (select count(*) from public.konto_protokoll where ziel = %L and aktion = ''abgelehnt'')::text from public.profiles where id = %L', v_w, v_w),
         'wert:abgelehnt/1', array['Admin']),
        ('neue Anfrage: Push an Trainer und Admin, nicht an Spieler', array[format('update public.profiles set freigabe = ''aktiv'', player_id = null where id = %L', v_t), format('insert into public.user_roles (user_id, role, club_id) values (%L, ''coach'', %L)', v_t, v_club), format('update public.profiles set freigabe = ''aktiv'' where id = %L', v_w)], null,
         array['insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values (''00000000-0000-0000-0000-000000006199'', ''00000000-0000-0000-0000-000000000000'', ''authenticated'', ''authenticated'', ''pruef0061f@invalid.local'', ''{"name":"Dritte Anfrage","einladung":"' || v_tok || '"}'', now(), now())'],
         format('select string_agg(x, '','' order by x) from (select case when profile_id = %L then ''admin'' when profile_id = %L then ''trainer'' when profile_id = %L then ''spieler'' else ''?'' end x from public.notification_outbox where kategorie = ''anfrage_neu'' and dedup_key like ''anfrage_neu:00000000-0000-0000-0000-000000006199:%%'') q', v_admin, v_t, v_w),
         'wert:admin,trainer', array['intern']),

        -- ---- 4) Rollen und Schutzregeln ----------------------------------------
        ('Trainer vergibt Kassenwart', null, array[format('select public.rolle_setzen(%L, ''treasurer'', true)::text', v_admin)], null,
         format('select (select count(*) from public.user_roles where user_id = %L and role = ''treasurer'')::text || ''/'' || (select count(*) from public.konto_protokoll where ziel = %L and aktion in (''rolle_vergeben'', ''rolle_entzogen''))::text', v_admin, v_admin),
         'wert:1/0', array['Trainer']),
        ('Trainer vergibt nie Admin', null, array[format('select public.rolle_setzen(%L, ''admin'', true)::text', v_w)], null, null, 'verweigert', array['Trainer']),
        ('Admin vergibt Admin, Push an die Person', array[format('update public.profiles set freigabe = ''aktiv'' where id = %L', v_w)],
         array[format('select public.rolle_setzen(%L, ''admin'', true)::text', v_w)], null,
         format('select (select count(*) from public.user_roles where user_id = %L and role = ''admin'')::text || ''/'' || (select max(text) from public.notification_outbox where profile_id = %L and kategorie = ''rolle_geaendert'')', v_w, v_w),
         'wert:1/Du bist jetzt Admin.', array['Admin']),
        ('letzter Trainer nimmt sich die Rolle: verboten', array[format('delete from public.user_roles where user_id = %L and role = ''admin''', v_admin)],
         array[format('select public.rolle_setzen(%L, ''coach'', false)::text', v_t)], null, null, 'fehler:Mindestens ein Konto', array['Trainer']),
        ('letzter Berechtigter löscht sein Konto: verboten', array[format('delete from public.user_roles where user_id = %L and role = ''admin''', v_admin)],
         array['select public.konto_loeschen()::text'], null, null, 'fehler:letzte Konto', array['Trainer']),
        ('Trainer nimmt sich die Rolle, solange der Admin bleibt', null,
         array[format('select public.rolle_setzen(%L, ''coach'', false)::text', v_t)], null,
         format('select count(*)::text from public.user_roles where user_id = %L and role = ''coach''', v_t), 'wert:0', array['Trainer']),

        -- ---- 5) Kassenwart und PayPal --------------------------------------------
        ('neuer Kassenwart wird nach PayPal gefragt', array[format('update public.profiles set freigabe = ''aktiv'' where id = %L', v_w)],
         array[format('select public.rolle_setzen(%L, ''treasurer'', true)::text', v_w)], null,
         format('select paypal_frage::text from public.profiles where id = %L', v_w), 'wert:true', array['Admin']),
        ('Kassenwart setzt PayPal aus einem Link', null, array['select public.paypal_setzen(''https://www.paypal.me/Pruefkasse/12'')::text'], null,
         'select paypal_name from public.team_settings', 'wert:Pruefkasse', array['Kassenwart']),
        ('Entzug der Rolle nimmt den Link des Kassenwarts weg', null,
         array['select public.paypal_setzen(''Pruefkasse'')::text'], array[format('select set_config(''request.jwt.claims'', %L, true)', json_build_object('sub', v_admin, 'role', 'authenticated')::text), format('select public.rolle_setzen(%L, ''treasurer'', false)::text', v_t)],
         'select coalesce(paypal_name, ''-'') from public.team_settings', 'wert:-', array['Kassenwart']),
        ('ungültiger PayPal-Name', null, array['select public.paypal_setzen(''a b <c>'')::text'], null, null, 'fehler:PayPal', array['Kassenwart']),

        -- ---- 6) Gesundheit und Einwilligung --------------------------------------
        ('ohne Einwilligung kein Status verletzt', null, array[format('select public.set_player_status(%L, ''verletzt'', ''Knie'', current_date + 2)::text', v_pl)], null, null, 'verweigert', array['Spieler']),
        ('Trainer setzt verletzt nicht ohne Einwilligung des Kontos', null, array[format('select public.set_player_status(%L, ''angeschlagen'', null, null)::text', v_pl)], null, null, 'verweigert', array['Trainer']),
        ('mit Einwilligung möglich, Widerruf löscht Status, Notiz und Datum', null,
         array['select public.einwilligung_setzen(''gesundheit'', true, ''2026-10'')::text', format('select public.set_player_status(%L, ''verletzt'', ''Knie'', current_date + 2)::text', v_pl), 'select public.einwilligung_setzen(''gesundheit'', false, null)::text'], null,
         format('select status || ''/'' || coalesce(status_note, ''-'') || ''/'' || coalesce(status_until::text, ''-'') from public.player_status where player_id = %L', v_pl),
         'wert:fit/-/-', array['Spieler']),
        ('Urlaub geht ohne Einwilligung', null, array[format('select public.set_player_status(%L, ''urlaub'', null, current_date + 5)::text', v_pl)], null, null, 'ok', array['Spieler']),
        ('Datenschutz lässt sich nicht einzeln widerrufen', null, array['select public.einwilligung_setzen(''datenschutz'', false, null)::text'], null, null, 'fehler:Löschen des Kontos', array['Spieler']),

        -- ---- 7) Konto löschen und entfernen --------------------------------------
        ('Konto löschen: Konto weg, Kadereintrag anonym, Kasse bleibt', array[format('insert into public.fines (club_id, player_id, date, offense, base_amount, status, note) values (%L, %L, current_date, ''Prüfstrafe'', 7, ''offen'', ''privat'')', v_club, v_pl),
           format('insert into public.player_status (player_id, status, status_note) values (%L, ''urlaub'', ''Malle'')', v_pl)],
         array['select public.konto_loeschen()::text'], null,
         format('select (select count(*) from auth.users where id = %L)::text || ''/'' || (select name || ''/'' || code from public.players where id = %L) || ''/'' || (select sum(base_amount)::text || ''/'' || count(note)::text from public.fines where player_id = %L) || ''/'' || (select count(*) from public.player_status where player_id = %L)::text', v_t, v_pl, v_pl, v_pl),
         'wert:0/Ehemaliger Spieler/x' || substr(md5(v_pl::text), 1, 8) || '/7.00/0/0', array['Spieler']),
        ('Löschung ist protokolliert ohne Namen', array[format('select 1')], array['select public.konto_loeschen()::text'], null,
         format('select string_agg(distinct coalesce(ziel_name, ''-''), '','') from public.konto_protokoll where ziel = %L', v_t), 'wert:gelöschtes Konto', array['Spieler']),
        ('Trainer entfernt ein Mitglied', array[format('update public.profiles set freigabe = ''aktiv'' where id = %L', v_w)],
         array[format('select public.mitglied_entfernen(%L)::text', v_w)], null,
         format('select (select count(*) from public.profiles where id = %L)::text || ''/'' || (select count(*) from public.konto_protokoll where ziel = %L and aktion = ''entfernt'')::text', v_w, v_w),
         'wert:0/1', array['Trainer']),
        ('Trainer entfernt nicht den Admin', null, array[format('select public.mitglied_entfernen(%L)::text', v_admin)], null, null, 'verweigert', array['Trainer']),

        -- ---- 8) Registrierung, Einladung, bestehende Konten ----------------------
        ('Registrierung ohne Token scheitert', null, null, array['insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values (gen_random_uuid(), ''00000000-0000-0000-0000-000000000000'', ''authenticated'', ''authenticated'', ''pruef0061c@invalid.local'', ''{"name":"Ohne"}'', now(), now())'], null, 'verweigert', array['intern']),
        ('Registrierung mit widerrufenem Token scheitert', null, null, array['update public.einladungen set widerrufen_am = now() where widerrufen_am is null', format('insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values (gen_random_uuid(), ''00000000-0000-0000-0000-000000000000'', ''authenticated'', ''authenticated'', ''pruef0061d@invalid.local'', %L, now(), now())', jsonb_build_object('name', 'Alt', 'einladung', v_tok))], null, 'verweigert', array['intern']),
        ('Registrierung ohne Namen scheitert', null, null, array[format('insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values (gen_random_uuid(), ''00000000-0000-0000-0000-000000000000'', ''authenticated'', ''authenticated'', ''pruef0061e@invalid.local'', %L, now(), now())', jsonb_build_object('name', ' ', 'einladung', v_tok))], null, 'fehler:Namen', array['intern']),
        ('Link erneuern: alter ungültig, neuer gültig', null, array['select (public.einladung_erneuern())->>''token'''], null,
         format('select (public.einladung_pruefen(%L))->>''gueltig'' || ''/'' || (select count(*) from public.einladungen where widerrufen_am is null)::text', v_tok), 'wert:false/1', array['Trainer']),
        ('bestehende Konten sind aktiv, Rollen unverändert', null, null, null,
         'select (select count(*) from public.profiles where freigabe = ''aktiv'' and email not like ''pruef0061%'')::text || ''/'' || (select count(*) from public.user_roles r join public.profiles p on p.id = r.user_id where p.email not like ''pruef0061%'')::text',
         'wert:3/5', array['intern']),
        ('neue Tabellen ohne Policies, RLS an', null, null, null,
         'select (select count(*) from pg_class where relname in (''einladungen'',''konto_protokoll'',''einwilligungen'') and relrowsecurity)::text || ''/'' || (select count(*) from pg_policies where tablename in (''einladungen'',''konto_protokoll'',''einwilligungen''))::text',
         'wert:3/0', array['intern'])
      ) as t(fall, vor, aktion, nach, pruef, erwartet, rollen)
      where r.rolle = any(t.rollen)
    loop
      v_nr := v_nr + 1;
      v_ok := false; v_txt := null; v_state := null; v_msg := null;
      begin
        foreach s in array (case when r.rolle in ('anon','intern','Wartend') then v_basis else v_frei end) loop execute s; end loop;
        if r.zusatzrolle is not null then
          insert into public.user_roles (user_id, role, club_id) values (v_t, r.zusatzrolle, v_club) on conflict do nothing;
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
        if r.rolle <> 'intern' then
          execute 'reset role';
        end if;
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
      insert into pruef_0061 values (v_nr, r.rolle, f.fall, f.erwartet,
        case when v_ok then 'gelungen: ' || coalesce(left(v_txt, 200), '(null)') else 'abgelehnt: ' || v_state || ' ' || left(v_msg, 160) end,
        v_urteil);
    end loop;
  end loop;
end
$pruef$;

select nr, rolle, fall, erwartet, ergebnis, urteil from pruef_0061
union all
select null, 'SUMME', count(*) || ' Fälle: ' || count(*) filter (where urteil = 'PASS') || ' PASS, '
       || count(*) filter (where urteil = 'FAIL') || ' FAIL', null, null, null from pruef_0061
order by nr nulls last;
