-- ============================================================================
-- Prüfung zu Migration 0062 (Gesundheitsstatus nur mit Einwilligung).
-- Ändert nichts: jeder Fall läuft in einer Untertransaktion, die immer
-- zurückgerollt wird. Muster wie 0061_onboarding_pruef.sql.
-- Im Fall: Prüfkonto (Einladungstoken) mit eigenem Kadereintrag P1, dazu ein
-- Kadereintrag P2 ohne Konto. "Spieler+E" = Prüfkonto mit Einwilligung.
-- ============================================================================

drop table if exists pg_temp.pruef_0062;
create temp table pruef_0062 (nr int, rolle text, fall text, erwartet text, ergebnis text, urteil text);

do $pruef$
declare
  v_club uuid; v_admin uuid;
  v_t uuid := gen_random_uuid();
  v_p1 uuid := gen_random_uuid(); v_p2 uuid := gen_random_uuid();
  v_tok text := 'pruef0062' || replace(gen_random_uuid()::text, '-', '');
  v_basis text[]; v_frei text[];
  v_nr int := 0; v_txt text; v_ok boolean; v_state text; v_msg text; v_urteil text; s text; i int;
  r record; f record;
begin
  select id into v_club from public.clubs where slug = 'fcfn';
  select user_id into v_admin from public.user_roles where role = 'admin' limit 1;
  v_basis := array[
    'update public.einladungen set widerrufen_am = now() where widerrufen_am is null',
    format('insert into public.einladungen (club_id, token) values (%L, %L)', v_club, v_tok),
    format('insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values (%L, ''00000000-0000-0000-0000-000000000000'', ''authenticated'', ''authenticated'', ''pruef0062@invalid.local'', %L, now(), now())', v_t, jsonb_build_object('name', 'Prüf Konto', 'einladung', v_tok)),
    format('insert into public.players (id, club_id, code, name) values (%L, %L, ''pr62a'', ''Prüf Eins''), (%L, %L, ''pr62b'', ''Prüf Zwei ohne Konto'')', v_p1, v_club, v_p2, v_club)];
  v_frei := v_basis || array[format('update public.profiles set freigabe = ''aktiv'', player_id = %L where id = %L', v_p1, v_t)];

  for r in
    select * from (values
      (1, 'anon', null::text, false), (2, 'Wartend', null, false), (3, 'Spieler', null, false), (4, 'Spieler+E', null, true),
      (5, 'Trainer', 'coach', false), (6, 'Admin', 'admin', false), (7, 'intern', null, false)
    ) as t(ord, rolle, zusatzrolle, einwilligung) order by ord
  loop
    for f in
      select * from (values
        -- ---- Rechte ----------------------------------------------------------------
        ('Liste der Einwilligungen lesen', null::text[], array['select coalesce(array_length(public.gesundheit_erlaubt_liste(), 1), 0)::text']::text[], null::text[], null::text, 'verweigert', array['anon']),
        ('Liste: wartend leer, Spieler ohne Einwilligung leer', null, array['select coalesce(array_length(public.gesundheit_erlaubt_liste(), 1), 0)::text'], null, null, 'wert:0', array['Wartend','Spieler']),
        ('Liste: Spieler mit Einwilligung sieht nur sich', null, array[format('select (public.gesundheit_erlaubt_liste() = array[%L::uuid])::text', v_p1)], null, null, 'wert:true', array['Spieler+E']),
        ('Liste: Trainer sieht die Spieler mit Einwilligung', array[format('insert into public.einwilligungen (profile_id, art, fassung) values (%L, ''gesundheit'', ''G1'')', v_t)],
         array[format('select (%L::uuid = any(public.gesundheit_erlaubt_liste()))::text', v_p1)], null, null, 'wert:true', array['Trainer','Admin']),
        ('Hilfsfunktion nicht aufrufbar', null, array[format('select public.gesundheit_erlaubt_fuer(%L)::text', v_p1)], null, null, 'verweigert', array['anon','Wartend','Spieler','Trainer']),
        ('wartend setzt keinen Status', null, array[format('select public.set_player_status(%L, ''urlaub'', null, null)::text', v_p1)], null, null, 'fehler:Nur Trainer', array['Wartend']),

        -- ---- Ohne Einwilligung -------------------------------------------------------
        ('Spieler ohne Einwilligung: verletzt verboten', null, array[format('select public.set_player_status(%L, ''verletzt'', null, null)::text', v_p1)], null, null, 'verweigert', array['Spieler']),
        ('Spieler ohne Einwilligung: angeschlagen verboten', null, array[format('select public.set_player_status(%L, ''angeschlagen'', null, null)::text', v_p1)], null, null, 'verweigert', array['Spieler']),
        ('Spieler ohne Einwilligung: nicht verfügbar ohne Notiz, Datum bleibt', null,
         array[format('select public.set_player_status(%L, ''nicht_verfuegbar'', ''Knie'', current_date + 3)::text', v_p1)], null,
         format('select status || ''/'' || coalesce(status_note, ''-'') || ''/'' || (status_until = current_date + 3)::text from public.player_status where player_id = %L', v_p1),
         'wert:nicht_verfuegbar/-/true', array['Spieler']),
        ('Spieler ohne Einwilligung: Urlaub ohne Notiz', null,
         array[format('select public.set_player_status(%L, ''urlaub'', ''Mallorca'', current_date + 5)::text', v_p1)], null,
         format('select status || ''/'' || coalesce(status_note, ''-'') from public.player_status where player_id = %L', v_p1), 'wert:urlaub/-', array['Spieler']),
        ('Trainer: Spieler ohne Konto nicht verletzt', null, array[format('select public.set_player_status(%L, ''verletzt'', null, null)::text', v_p2)], null, null, 'verweigert', array['Trainer','Admin']),
        ('Trainer: Spieler ohne Konto nicht verfügbar ohne Notiz', null,
         array[format('select public.set_player_status(%L, ''nicht_verfuegbar'', ''Bänder'', current_date + 10)::text', v_p2)], null,
         format('select status || ''/'' || coalesce(status_note, ''-'') from public.player_status where player_id = %L', v_p2), 'wert:nicht_verfuegbar/-', array['Trainer']),
        ('Trainer: Konto ohne Einwilligung nicht angeschlagen', null, array[format('select public.set_player_status(%L, ''angeschlagen'', null, null)::text', v_p1)], null, null, 'verweigert', array['Trainer']),

        -- ---- Mit Einwilligung ---------------------------------------------------------
        ('Spieler mit Einwilligung: verletzt mit Notiz', null,
         array[format('select public.set_player_status(%L, ''verletzt'', ''Knie'', current_date + 3)::text', v_p1)], null,
         format('select status || ''/'' || coalesce(status_note, ''-'') from public.player_status where player_id = %L', v_p1), 'wert:verletzt/Knie', array['Spieler+E']),
        ('Trainer: Konto mit Einwilligung angeschlagen', array[format('insert into public.einwilligungen (profile_id, art, fassung) values (%L, ''gesundheit'', ''G1'')', v_t)],
         array[format('select public.set_player_status(%L, ''angeschlagen'', ''Wade'', null)::text', v_p1)], null,
         format('select status || ''/'' || coalesce(status_note, ''-'') from public.player_status where player_id = %L', v_p1), 'wert:angeschlagen/Wade', array['Trainer']),
        -- seit 0072: auch das Datum ist nach dem Widerruf weg
        ('Widerruf: verletzt wird nicht verfügbar, Notiz und Datum weg', null,
         array[format('select public.set_player_status(%L, ''verletzt'', ''Knie'', current_date + 6)::text', v_p1), 'select public.einwilligung_setzen(''gesundheit'', false, null)::text'], null,
         format('select status || ''/'' || coalesce(status_note, ''-'') || ''/'' || coalesce(status_until::text, ''-'') from public.player_status where player_id = %L', v_p1),
         'wert:nicht_verfuegbar/-/-', array['Spieler+E']),
        ('nach dem Widerruf: verletzt wieder verboten', null,
         array['select public.einwilligung_setzen(''gesundheit'', false, null)::text', format('select public.set_player_status(%L, ''verletzt'', null, null)::text', v_p1)], null, null, 'verweigert', array['Spieler+E']),

        -- ---- Folgen und Bestand ----------------------------------------------------------
        ('nicht verfügbar fehlt am Termintag (Rückmelde-Push, Nachfrage)', array[format('insert into public.player_status (player_id, status, status_until) values (%L, ''nicht_verfuegbar'', current_date + 2)', v_p2)], null, null,
         format('select public.notify_spieler_faellt_aus_am(%L, current_date + 1)::text || ''/'' || public.notify_spieler_faellt_aus(%L)::text || ''/'' || public.notify_spieler_faellt_aus_am(%L, current_date + 3)::text', v_p2, v_p2, v_p2),
         'wert:true/true/false', array['intern']),
        ('Status-Ablauf-Mitteilung nennt nicht verfügbar', array[format('insert into public.user_roles (user_id, role, club_id) select %L, ''coach'', %L', v_t, v_club), format('update public.profiles set freigabe = ''aktiv'' where id = %L', v_t),
           'update public.player_status set status = ''fit'', status_until = null where status <> ''fit''', format('insert into public.player_status (player_id, status, status_until) values (%L, ''nicht_verfuegbar'', date ''2026-10-20'')', v_p2)],
         array['select public.notify_cron_status_abgelaufen(timestamp ''2026-10-21 09:00'' at time zone ''Europe/Berlin'')::text'], null,
         format('select max(text) from public.notification_outbox where kategorie = ''status_abgelaufen'' and profile_id = %L', v_t),
         'wert:Nicht verfügbar, voraussichtlich bis 20.10. Der Status ist noch gesetzt, bitte im Kader prüfen.', array['intern']),
        ('Bestand: kein angeschlagen oder verletzt ohne Einwilligung', null, null, null,
         'select count(*)::text from public.player_status s where s.status in (''angeschlagen'', ''verletzt'') and not exists (select 1 from public.profiles p join public.einwilligungen e on e.profile_id = p.id and e.art = ''gesundheit'' and e.widerrufen_am is null where p.player_id = s.player_id)',
         'wert:0', array['intern']),
        ('Bestand: nicht verfügbar ohne Notiz', null, null, null,
         'select count(*)::text from public.player_status where status = ''nicht_verfuegbar'' and status_note is not null', 'wert:0', array['intern']),
        ('Status-Check kennt nicht verfügbar', null, null, null,
         'select (pg_get_constraintdef((select oid from pg_constraint where conname = ''player_status_status_check'')) like ''%nicht_verfuegbar%'')::text', 'wert:true', array['intern'])
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
        raise exception using errcode = 'P0062', message = 'zurückrollen';
      exception when others then
        if sqlstate <> 'P0062' then v_state := sqlstate; v_msg := sqlerrm; end if;
      end;
      v_urteil := case
        when f.erwartet = 'verweigert' then case when not v_ok and v_state = '42501' then 'PASS' else 'FAIL' end
        when f.erwartet = 'ok' then case when v_ok then 'PASS' else 'FAIL' end
        when f.erwartet like 'wert:%' then case when v_ok and coalesce(v_txt, '') = substr(f.erwartet, 6) then 'PASS' else 'FAIL' end
        when f.erwartet like 'fehler:%' then case when not v_ok and v_state <> '42501' and v_msg like '%' || substr(f.erwartet, 8) || '%' then 'PASS' else 'FAIL' end
      end;
      insert into pruef_0062 values (v_nr, r.rolle, f.fall, f.erwartet,
        case when v_ok then 'gelungen: ' || coalesce(left(v_txt, 200), '(null)') else 'abgelehnt: ' || v_state || ' ' || left(v_msg, 160) end, v_urteil);
    end loop;
  end loop;
end
$pruef$;

select nr, rolle, fall, erwartet, ergebnis, urteil from pruef_0062
union all
select null, 'SUMME', count(*) || ' Fälle: ' || count(*) filter (where urteil = 'PASS') || ' PASS, '
       || count(*) filter (where urteil = 'FAIL') || ' FAIL', null, null, null from pruef_0062
order by nr nulls last;
