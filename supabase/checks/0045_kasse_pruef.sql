-- ============================================================================
-- Prüfung zu Migration 0045 (Automatische Mitteilungen, AM2 Kasse).
-- NACH dem Einspielen im SQL-Editor ausführen. Ändert nichts: jeder Fall läuft
-- in einer eigenen Untertransaktion, die am Ende immer zurückgerollt wird.
-- Muster wie supabase/checks/0043_auto_pruef.sql.
--
-- Jeder Fall legt einen Prüfspieler an ("Prüfspieler 0045") und verknüpft ihn
-- mit einem Nicht-Admin-Profil; beides verschwindet mit dem Zurückrollen.
--
-- Ablauf je Fall:
--   vor     (intern)  Vorbereitung, Liste von Anweisungen
--   aktion  (Rolle)   eine Anweisung als anon / Spieler / Trainer / Kassenwart / Admin
--   nach    (intern)  z. B. Sammler fällig setzen, zusammenfassen
--   pruef   (intern)  liefert den Wert; ohne pruef zählt das Ergebnis der aktion
--
-- Erwartung je Fall:
--   verweigert  Fehler 42501
--   ok          gelingt
--   wert:<x>    gelingt, Ergebnis genau <x>
-- ============================================================================

drop table if exists pg_temp.pruef_0045;
create temp table pruef_0045 (nr int, rolle text, fall text, erwartet text, ergebnis text, urteil text);

do $pruef$
declare
  v_admin    uuid;     -- Admin-Profil mit Spieler
  v_aspieler uuid;
  v_nutzer   uuid;     -- Nicht-Admin-Profil, wird mit dem Prüfspieler verknüpft
  v_club     uuid;
  v_sp       uuid := gen_random_uuid();   -- Prüfspieler
  v_event    uuid;
  v_basis    text[];
  v_kw_admin text;     -- Admin zusätzlich Kassenwart (für zahlung_gemeldet)
  v_faellig  text;     -- Sammler fällig setzen
  v_nr       int := 0;
  v_txt      text;
  v_ok       boolean;
  v_state    text;
  v_msg      text;
  v_urteil   text;
  s          text;
  AUSSEN constant text[] := array['anon','Spieler','Trainer','Kassenwart','Admin'];
  r record;
  f record;
begin
  select ur.user_id into v_admin from public.user_roles ur
    join public.profiles p on p.id = ur.user_id and p.player_id is not null
   where ur.role = 'admin' limit 1;
  select player_id into v_aspieler from public.profiles where id = v_admin;
  select club_id into v_club from public.players where id = v_aspieler;
  select p.id into v_nutzer from public.profiles p
   where p.player_id is null
     and not exists (select 1 from public.user_roles ur where ur.user_id = p.id and ur.role = 'admin') limit 1;
  select id into v_event from public.events where club_id = v_club order by date desc limit 1;
  if v_admin is null or v_nutzer is null or v_event is null then
    raise exception 'Für die Prüfung fehlt ein Admin mit Spieler, ein freies Nicht-Admin-Profil oder ein Termin.';
  end if;

  v_basis := array[
    format('insert into public.players (id, club_id, code, name) values (%L, %L, %L, %L)', v_sp, v_club, 'pruef0045', 'Prüfspieler 0045'),
    format('update public.profiles set player_id = %L where id = %L', v_sp, v_nutzer)];
  v_kw_admin := format('insert into public.user_roles (user_id, role, club_id) select %L, ''treasurer'', %L where not exists (select 1 from public.user_roles where user_id = %L and role = ''treasurer'')', v_admin, v_club, v_admin);
  -- nur die in diesem Fall entstandenen Einträge (erstellt_at = Transaktionsbeginn)
  v_faellig := 'update public.notification_sammler set faellig_ab = now() - interval ''1 second'' where erstellt_at >= now()';

  for r in
    select * from (values
      (1, 'anon', null::text), (2, 'Spieler', null), (3, 'Trainer', 'coach'),
      (4, 'Kassenwart', 'treasurer'), (5, 'Admin', null), (6, 'intern', null)
    ) as t(ord, rolle, zusatzrolle) order by ord
  loop
    for f in
      select * from (values
        -- ---- 1) Keine neue Funktion von außen ------------------------------
        ('notify_strafe_betrag', null::text[], 'select public.notify_strafe_betrag(f)::text from public.fines f limit 1', null::text[], null::text, 'verweigert', AUSSEN),
        ('notify_anzahl', null, 'select public.notify_anzahl(1, ''Strafe'', ''Strafen'')', null, null, 'verweigert', AUSSEN),
        ('notify_strafe_zurueckziehen', null, 'select public.notify_strafe_zurueckziehen(gen_random_uuid(), gen_random_uuid(), ''x'')::text', null, null, 'verweigert', AUSSEN),
        ('notify_flush_strafe_neu', null, 'select public.notify_flush_strafe_neu()::text', null, null, 'verweigert', AUSSEN),
        ('notify_flush_zahlung_gemeldet', null, 'select public.notify_flush_zahlung_gemeldet()::text', null, null, 'verweigert', AUSSEN),
        ('notify_flush_zahlung_bestaetigt', null, 'select public.notify_flush_zahlung_bestaetigt()::text', null, null, 'verweigert', AUSSEN),
        ('notify_flush_zahlung_abgelehnt', null, 'select public.notify_flush_zahlung_abgelehnt()::text', null, null, 'verweigert', AUSSEN),
        ('keine notify_*-Funktion für anon/authenticated (auch der Trigger)', null, null, null,
         'select count(*)::text from pg_proc p where p.pronamespace = ''public''::regnamespace and p.proname like ''notify\_%'' and p.proname <> ''notify_enqueue'' and (has_function_privilege(''anon'', p.oid, ''execute'') or has_function_privilege(''authenticated'', p.oid, ''execute''))',
         'wert:0', array['intern']),
        ('Trigger trg_fines_notify aktiv', null, null, null,
         'select tgenabled::text from pg_trigger where tgname = ''trg_fines_notify'' and tgrelid = ''public.fines''::regclass',
         'wert:O', array['intern']),
        ('Vorlagen K1: {anzahl} mit Nomen', null, null, null,
         'select (select titel_vorlage from public.notification_templates where kategorie = ''zahlung_gemeldet'') || '' / '' || (select text_vorlage from public.notification_templates where kategorie = ''zahlung_bestaetigt'') || '' / '' || public.notify_anzahl(1, ''Zahlung'', ''Zahlungen'') || '' / '' || public.notify_anzahl(3, ''Strafe'', ''Strafen'')',
         'wert:💰 {anzahl} zu prüfen / {anzahl}, {betrag} verbucht. / 1 Zahlung / 3 Strafen', array['intern']),
        ('Betrag mit Mahnzuschlag: 5 € vor 15 Tagen angelegt = 9 € (numeric(8,2))',
         v_basis || array[format('insert into public.fines (club_id, player_id, date, offense, base_amount, status, created_at) values (%L, %L, current_date - 15, ''Prüfung Mahnung'', 5, ''offen'', now() - interval ''15 days'')', v_club, v_sp)],
         null, null,
         format('select public.notify_strafe_betrag(f)::text from public.fines f where f.player_id = %L and f.offense = ''Prüfung Mahnung''', v_sp),
         'wert:9.00', array['intern']),

        -- ---- 2) strafe_neu -------------------------------------------------
        ('strafe_neu: Admin trägt Spieler ein, Karenz rund 3 Minuten', v_basis,
         format('select public.create_fines_batch(%L::jsonb)::text', jsonb_build_array(jsonb_build_object('player_id', v_sp, 'offense', 'Prüfung A', 'base_amount', 5))),
         null,
         format('select count(*)::text || ''/'' || bool_and(faellig_ab between now() + interval ''170 seconds'' and now() + interval ''190 seconds'')::text from public.notification_sammler where kategorie = ''strafe_neu'' and profile_id = %L', v_nutzer),
         'wert:1/true', array['Admin']),
        ('strafe_neu: Kassenwart trägt sich selbst ein, bekommt sie trotzdem (F1)', v_basis,
         format('select public.create_fines_batch(%L::jsonb)::text', jsonb_build_array(jsonb_build_object('player_id', v_sp, 'offense', 'Prüfung A', 'base_amount', 5))),
         null,
         format('select count(*)::text from public.notification_sammler where kategorie = ''strafe_neu'' and profile_id = %L', v_nutzer),
         'wert:1', array['Kassenwart']),
        ('strafe_neu: zwei Strafen in einem Aufruf ergeben eine Nachricht mit Summe', v_basis,
         format('select public.create_fines_batch(%L::jsonb)::text', jsonb_build_array(
           jsonb_build_object('player_id', v_sp, 'date', '2026-10-01', 'offense', 'Prüfung A', 'base_amount', 5),
           jsonb_build_object('player_id', v_sp, 'date', '2026-10-03', 'offense', 'Prüfung B', 'base_amount', 3))),
         array[v_faellig, 'select public.notify_flush_strafe_neu()'],
         format('select count(*)::text || '' | '' || max(titel || '' | '' || text || '' | '' || deep_link) from public.notification_outbox where kategorie = ''strafe_neu'' and profile_id = %L and created_at >= now()', v_nutzer),
         'wert:1 | 💸 Neue Strafe: 8,00 € | 2 Strafen: Prüfung A, Prüfung B, 01.10. bis 03.10.2026. Bar, Überweisung oder PayPal. | #strafen=meine', array['Admin']),
        ('strafe_neu: Storno in der Karenz, keine Nachricht', v_basis,
         format('select public.cancel_batch(public.create_fines_batch(%L::jsonb))::text', jsonb_build_array(jsonb_build_object('player_id', v_sp, 'offense', 'Prüfung A', 'base_amount', 5))),
         array[v_faellig, 'select public.notify_flush_strafe_neu()'],
         format('select (select count(*) from public.notification_sammler where kategorie = ''strafe_neu'' and profile_id = %L)::text || ''/'' || (select count(*) from public.notification_outbox where kategorie = ''strafe_neu'' and profile_id = %L and created_at >= now())::text', v_nutzer, v_nutzer),
         'wert:0/0', array['Admin']),
        ('strafe_neu: Storno nach dem Zusammenfassen, noch nicht versendet, Zeile zurückgeholt', v_basis,
         format('select public.create_fines_batch(%L::jsonb)::text', jsonb_build_array(jsonb_build_object('player_id', v_sp, 'offense', 'Prüfung A', 'base_amount', 5))),
         array[v_faellig, 'select public.notify_flush_strafe_neu()',
               format('update public.fines set status = ''storniert'' where player_id = %L', v_sp)],
         format('select count(*)::text from public.notification_outbox where kategorie = ''strafe_neu'' and profile_id = %L and created_at >= now()', v_nutzer),
         'wert:0', array['Admin']),
        ('strafe_neu: Storno nach dem Versand, Zeile bleibt (keine Gegenmeldung)', v_basis,
         format('select public.create_fines_batch(%L::jsonb)::text', jsonb_build_array(jsonb_build_object('player_id', v_sp, 'offense', 'Prüfung A', 'base_amount', 5))),
         array[v_faellig, 'select public.notify_flush_strafe_neu()',
               format('update public.notification_outbox set sent_at = now() where kategorie = ''strafe_neu'' and profile_id = %L and created_at >= now()', v_nutzer),
               format('update public.fines set status = ''storniert'' where player_id = %L', v_sp)],
         format('select count(*)::text from public.notification_outbox where kategorie = ''strafe_neu'' and profile_id = %L and created_at >= now()', v_nutzer),
         'wert:1', array['Admin']),
        ('strafe_neu: automatische Strafe zum Termin, Gruppe je Termin',
         v_basis || array[format('insert into public.fines (club_id, player_id, event_id, date, offense, base_amount, status, auto) values (%L, %L, %L, current_date, ''Prüfung Auto'', 8, ''offen'', true)', v_club, v_sp, v_event)],
         null, null,
         format('select count(*)::text from public.notification_sammler where kategorie = ''strafe_neu'' and profile_id = %L and bezug = %L', v_nutzer, 'termin:' || v_event),
         'wert:1', array['intern']),
        ('strafe_neu: Rückmeldung zurückgezogen, Auto-Strafe gelöscht, kein Eintrag',
         v_basis || array[format('insert into public.fines (club_id, player_id, event_id, date, offense, base_amount, status, auto) values (%L, %L, %L, current_date, ''Prüfung Auto'', 8, ''offen'', true)', v_club, v_sp, v_event),
                          format('delete from public.fines where player_id = %L and event_id = %L', v_sp, v_event)],
         null, null,
         format('select count(*)::text from public.notification_sammler where kategorie = ''strafe_neu'' and profile_id = %L', v_nutzer),
         'wert:0', array['intern']),
        ('strafe_neu: Doppellauf des Zusammenfassens, eine Zeile',
         v_basis || array[format('insert into public.fines (club_id, player_id, date, offense, base_amount, status, batch_id) values (%L, %L, current_date, ''Prüfung A'', 5, ''offen'', gen_random_uuid())', v_club, v_sp)],
         null,
         array[v_faellig, 'select public.notify_flush_strafe_neu()', 'select public.notify_flush_strafe_neu()'],
         format('select count(*)::text from public.notification_outbox where kategorie = ''strafe_neu'' and profile_id = %L and created_at >= now()', v_nutzer),
         'wert:1', array['intern']),
        ('strafe_neu: Spieler ohne Konto, Strafe entsteht, kein Eintrag',
         array[format('insert into public.players (id, club_id, code, name) values (%L, %L, %L, %L)', v_sp, v_club, 'pruef0045', 'Prüfspieler 0045'),
               format('insert into public.fines (club_id, player_id, date, offense, base_amount, status, batch_id) values (%L, %L, current_date, ''Prüfung A'', 5, ''offen'', gen_random_uuid())', v_club, v_sp)],
         null, null,
         format('select (select count(*) from public.fines where player_id = %L)::text || ''/'' || (select count(*) from public.notification_sammler s where s.daten->>''fine_id'' in (select id::text from public.fines where player_id = %L))::text', v_sp, v_sp),
         'wert:1/0', array['intern']),

        -- ---- 3) zahlung_gemeldet -------------------------------------------
        ('zahlung_gemeldet: Spieler meldet, Kassenwart bekommt einen Eintrag nach rund 15 Minuten',
         v_basis || array[v_kw_admin,
           format('insert into public.fines (club_id, player_id, date, offense, base_amount, status) values (%L, %L, current_date, ''Prüfung A'', 5, ''offen'')', v_club, v_sp)],
         'select public.report_my_payment(''bar'')::text', null,
         format('select (count(*) > 0)::text || ''/'' || bool_and(faellig_ab between now() + interval ''890 seconds'' and now() + interval ''910 seconds'')::text from public.notification_sammler where kategorie = ''zahlung_gemeldet'' and profile_id = %L', v_admin),
         'wert:true/true', array['Spieler']),
        ('zahlung_gemeldet: Kassenwart meldet selbst, bekommt nichts (F1), anderer Kassenwart schon',
         v_basis || array[v_kw_admin,
           format('insert into public.fines (club_id, player_id, date, offense, base_amount, status) values (%L, %L, current_date, ''Prüfung A'', 5, ''offen'')', v_club, v_sp)],
         'select public.report_my_payment(''bar'')::text', null,
         format('select (select count(*) from public.notification_sammler where kategorie = ''zahlung_gemeldet'' and profile_id = %L)::text || ''/'' || (select count(*) > 0 from public.notification_sammler where kategorie = ''zahlung_gemeldet'' and profile_id = %L)::text', v_nutzer, v_admin),
         'wert:0/true', array['Kassenwart']),
        ('zahlung_gemeldet: zusammengefasst, Text und Link',
         v_basis || array[v_kw_admin,
           format('insert into public.fines (club_id, player_id, date, offense, base_amount, status) values (%L, %L, current_date, ''Prüfung A'', 5, ''offen''), (%L, %L, current_date, ''Prüfung B'', 3, ''offen'')', v_club, v_sp, v_club, v_sp)],
         'select public.report_my_payment(''bar'')::text',
         array[v_faellig, 'select public.notify_flush_zahlung_gemeldet()'],
         format('select count(*)::text || '' | '' || max(titel || '' | '' || text || '' | '' || deep_link) from public.notification_outbox where kategorie = ''zahlung_gemeldet'' and profile_id = %L and created_at >= now()', v_admin),
         'wert:1 | 💰 1 Zahlung zu prüfen | Prüfspieler 0045, 8,00 €. Jetzt bestätigen. | #kasse=pruefen', array['Spieler']),
        ('zahlung_gemeldet: vor dem Zusammenfassen schon bestätigt, keine Nachricht',
         v_basis || array[v_kw_admin,
           format('insert into public.fines (club_id, player_id, date, offense, base_amount, status) values (%L, %L, current_date, ''Prüfung A'', 5, ''offen'')', v_club, v_sp)],
         'select public.report_my_payment(''bar'')::text',
         array[format('update public.fines set status = ''bestätigt'' where player_id = %L', v_sp), v_faellig, 'select public.notify_flush_zahlung_gemeldet()'],
         format('select count(*)::text from public.notification_outbox where kategorie = ''zahlung_gemeldet'' and profile_id = %L and created_at >= now()', v_admin),
         'wert:0', array['Spieler']),

        -- ---- 4) zahlung_bestaetigt -----------------------------------------
        ('zahlung_bestaetigt: Kassenwart bestätigt zwei Strafen, eine Nachricht',
         v_basis || array[format('insert into public.fines (club_id, player_id, date, offense, base_amount, status) values (%L, %L, current_date, ''Prüfung A'', 5, ''gemeldet''), (%L, %L, current_date, ''Prüfung B'', 3, ''gemeldet'')', v_club, v_aspieler, v_club, v_aspieler)],
         format('select public.confirm_fines(array(select id from public.fines where player_id = %L and offense like ''Prüfung _'' and created_at >= now()), ''bar'')::text', v_aspieler),
         array[v_faellig, 'select public.notify_flush_zahlung_bestaetigt()'],
         format('select count(*)::text || '' | '' || max(titel || '' | '' || text || '' | '' || deep_link) from public.notification_outbox where kategorie = ''zahlung_bestaetigt'' and profile_id = %L and created_at >= now()', v_admin),
         'wert:1 | ✅ Zahlung bestätigt | 2 Strafen, 8,00 € verbucht. | #strafen=meine', array['Kassenwart']),
        ('zahlung_bestaetigt: Kassenwart bestätigt eigene, bekommt nichts (F1)',
         v_basis || array[format('insert into public.fines (club_id, player_id, date, offense, base_amount, status) values (%L, %L, current_date, ''Prüfung A'', 5, ''gemeldet'')', v_club, v_sp)],
         format('select public.confirm_fines(array(select id from public.fines where player_id = %L), ''bar'')::text', v_sp),
         null,
         format('select count(*)::text from public.notification_sammler where kategorie = ''zahlung_bestaetigt'' and profile_id = %L', v_nutzer),
         'wert:0', array['Kassenwart']),

        -- ---- 5) zahlung_abgelehnt ------------------------------------------
        ('zahlung_abgelehnt: zwei Strafen abgelehnt, eine Nachricht mit Grund',
         v_basis || array[format('insert into public.fines (club_id, player_id, date, offense, base_amount, status) values (%L, %L, current_date, ''Prüfung A'', 5, ''gemeldet''), (%L, %L, current_date, ''Prüfung B'', 3, ''gemeldet'')', v_club, v_aspieler, v_club, v_aspieler)],
         format('select string_agg(public.reject_fine(id, ''Betrag fehlt'')::text, '','') from public.fines where player_id = %L and offense like ''Prüfung _'' and created_at >= now()', v_aspieler),
         array[v_faellig, 'select public.notify_flush_zahlung_abgelehnt()'],
         format('select count(*)::text || '' | '' || max(titel || '' | '' || text) from public.notification_outbox where kategorie = ''zahlung_abgelehnt'' and profile_id = %L and created_at >= now()', v_admin),
         'wert:1 | ⚠️ Zahlung nicht bestätigt | 8,00 €: Betrag fehlt. Bitte mit dem Kassenwart klären.', array['Kassenwart']),

        -- ---- 6) Die Kassenwege selbst bleiben offen ------------------------
        ('Kassenwege laufen weiter: anlegen, melden, bestätigen, ablehnen, stornieren',
         v_basis || array[v_kw_admin],
         format('select public.create_fines_batch(%L::jsonb)::text', jsonb_build_array(jsonb_build_object('player_id', v_sp, 'offense', 'Prüfung A', 'base_amount', 5))),
         array[format('update public.fines set status = ''gemeldet'' where player_id = %L', v_sp),
               format('update public.fines set status = ''offen'', reject_reason = ''x'' where player_id = %L', v_sp),
               format('update public.fines set status = ''bestätigt'' where player_id = %L', v_sp),
               format('update public.fines set status = ''storniert'' where player_id = %L', v_sp)],
         format('select string_agg(to_status, ''>'' order by changed_at, ctid) from public.fine_status_log where fine_id in (select id from public.fines where player_id = %L)', v_sp),
         'wert:offen>gemeldet>offen>bestätigt>storniert', array['Admin'])
      ) as t(fall, vor, aktion, nach, pruef, erwartet, rollen)
      where r.rolle = any(t.rollen)
    loop
      v_nr := v_nr + 1;
      v_ok := false; v_txt := null; v_state := null; v_msg := null;
      begin
        if r.zusatzrolle is not null then
          insert into public.user_roles (user_id, role, club_id) values (v_nutzer, r.zusatzrolle, v_club);
        end if;
        foreach s in array coalesce(f.vor, '{}'::text[]) loop execute s; end loop;
        if r.rolle = 'anon' then
          perform set_config('request.jwt.claims', '{"role":"anon"}', true);
          execute 'set local role anon';
        elsif r.rolle <> 'intern' then
          perform set_config('request.jwt.claims',
            json_build_object('sub', case when r.rolle = 'Admin' then v_admin else v_nutzer end, 'role', 'authenticated')::text, true);
          execute 'set local role authenticated';
        end if;
        if f.aktion is not null then
          if f.pruef is null then execute f.aktion into v_txt; else execute f.aktion; end if;
        end if;
        if r.rolle <> 'intern' then
          execute 'reset role';
          perform set_config('request.jwt.claims', '', true);
        end if;
        foreach s in array coalesce(f.nach, '{}'::text[]) loop execute s; end loop;
        if f.pruef is not null then execute f.pruef into v_txt; end if;
        v_ok := true;
        raise exception using errcode = 'P0045', message = 'zurückrollen';
      exception when others then
        if sqlstate <> 'P0045' then v_state := sqlstate; v_msg := sqlerrm; end if;
      end;
      v_urteil := case
        when f.erwartet = 'verweigert' then case when not v_ok and v_state = '42501' then 'PASS' else 'FAIL' end
        when f.erwartet = 'ok' then case when v_ok then 'PASS' else 'FAIL' end
        when f.erwartet like 'wert:%' then case when v_ok and v_txt = substr(f.erwartet, 6) then 'PASS' else 'FAIL' end
      end;
      insert into pruef_0045 values (v_nr, r.rolle, f.fall, f.erwartet,
        case when v_ok then 'gelungen: ' || coalesce(left(v_txt, 140), '(null)') else 'abgelehnt: ' || v_state || ' ' || left(v_msg, 160) end,
        v_urteil);
    end loop;
  end loop;
end
$pruef$;

select nr, rolle, fall, erwartet, ergebnis, urteil from pruef_0045
union all
select null, 'SUMME', count(*) || ' Fälle: ' || count(*) filter (where urteil = 'PASS') || ' PASS, '
       || count(*) filter (where urteil = 'FAIL') || ' FAIL', null, null, null from pruef_0045
order by nr nulls last;
