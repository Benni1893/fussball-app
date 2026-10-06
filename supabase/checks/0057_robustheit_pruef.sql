-- ============================================================================
-- Prüfung zu Migration 0057 (Robustheit der Zustellung) und den Fällen aus
-- Teil 3: ohne Abo, abgelaufenes Abo, mehrere Geräte, Versandausfall,
-- doppelter Lauf, Zeitumstellung 25.10.2026. Ändert nichts; Muster wie
-- 0050_nachfrage_pruef.sql. Was nur der Dispatcher (api/dispatch-push.js)
-- entscheidet, belegt der Zustelltest mit dem Testkonto (ABSCHLUSS.md).
-- ============================================================================

drop table if exists pg_temp.pruef_0057;
create temp table pruef_0057 (nr int, rolle text, fall text, erwartet text, ergebnis text, urteil text);

do $pruef$
declare
  v_admin    uuid;
  v_aspieler uuid;
  v_aname    text;
  v_nutzer   uuid;
  v_club     uuid;
  v_sp       uuid := gen_random_uuid();
  v_sp2      uuid := gen_random_uuid();
  v_e1       uuid := gen_random_uuid();
  v_basis    text[];
  v_coach    text;
  v_zweiter  text;
  v_faellig  text;
  pruef_erinnerung text;
  zaehl_erinnerung text;
  v_nr int := 0; v_txt text; v_ok boolean; v_state text; v_msg text; v_urteil text; s text; i int;
  AUSSEN constant text[] := array['anon','Spieler','Trainer','Kassenwart','Admin'];
  r record; f record;
begin
  select ur.user_id into v_admin from public.user_roles ur
    join public.profiles p on p.id = ur.user_id and p.player_id is not null where ur.role = 'admin' limit 1;
  select player_id into v_aspieler from public.profiles where id = v_admin;
  select club_id, name into v_club, v_aname from public.players where id = v_aspieler;
  select p.id into v_nutzer from public.profiles p where p.player_id is null
     and not exists (select 1 from public.user_roles ur where ur.user_id = p.id and ur.role = 'admin') limit 1;
  if v_admin is null or v_nutzer is null then raise exception 'Admin mit Spieler oder freies Profil fehlt.'; end if;

  v_basis := array[
    format('insert into public.players (id, club_id, code, name) values (%L, %L, %L, %L)', v_sp, v_club, 'pruef0057', 'Prüfspieler 0057'),
    format('update public.profiles set player_id = %L where id = %L', v_sp, v_nutzer),
    format('delete from public.player_status where player_id = %L', v_aspieler),
    format('delete from public.push_subscriptions where profile_id = %L', v_admin),
    format('insert into public.push_subscriptions (profile_id, endpoint, p256dh, auth) values (%L, ''https://pruef.invalid/0050'', ''x'', ''x'')', v_admin),
    format('update public.notification_prefs set rueckmeldung_erinnerung = true where profile_id = %L', v_admin)];
  v_coach := format('insert into public.user_roles (user_id, role, club_id) select %L, ''coach'', %L where not exists (select 1 from public.user_roles where user_id = %L and role = ''coach'')', v_nutzer, v_club, v_nutzer);
  v_zweiter := format('insert into public.players (id, club_id, code, name) values (%L, %L, %L, %L)', v_sp2, v_club, 'pruef0057b', 'Prüfspieler Zwei');
  v_faellig := 'update public.notification_sammler set faellig_ab = now() - interval ''1 second'' where erstellt_at >= now()';
  pruef_erinnerung := format('select count(*)::text || ''/'' || bool_and(o.titel = ''⏳ Bist du dabei? Prüftermin'' and o.text = public.notify_datum_kurz(e.date) || '' '' || public.notify_uhrzeit(e.time) || '' · Meldeschluss '' || public.notify_meldeschluss_text(e.deadline_at) || ''. Ohne Antwort wird''''s teuer.'' and o.gueltig_bis = e.deadline_at and o.urgency = ''high'' and o.deep_link = ''#termin='' || e.id)::text from public.notification_outbox o join public.events e on e.id = %L where o.kategorie = ''rueckmeldung_erinnerung'' and o.profile_id = %L and o.dedup_key like %L', v_e1, v_admin, 'erinnerung:' || v_e1 || ':%:24');
  zaehl_erinnerung := format('select count(*)::text from public.notification_outbox where kategorie = ''rueckmeldung_erinnerung'' and profile_id = %L and dedup_key like %L', v_admin, 'erinnerung:' || v_e1 || ':%');

  for r in
    select * from (values
      (1, 'anon', null::text), (2, 'Spieler', null), (3, 'Trainer', 'coach'),
      (4, 'Kassenwart', 'treasurer'), (5, 'Admin', null), (6, 'service_role', null), (7, 'intern', null)
    ) as t(ord, rolle, zusatzrolle) order by ord
  loop
    for f in
      select * from (values
        -- ---- Rechte --------------------------------------------------------
        ('in_quiet_hours_at nur für service_role', null::text[], array['select public.in_quiet_hours_at(''22:00'', ''08:00'', now())::text'], null::text[], null::text, 'verweigert', AUSSEN),

        -- ---- R1 Wiederholung ------------------------------------------------
        ('vorübergehender Fehler: wieder frei, 5 Minuten später, kein Fehler', array[format('insert into public.notification_outbox (id, profile_id, kategorie, titel, text, dedup_key, ist_vorschau) values (%L, %L, ''test'', ''P'', ''P'', ''pruef0057:a'', true)', v_e1, v_admin)],
         null, array[format('select public.push_mark_error(%L, ''keine Zustellung'')', v_e1)],
         format('select versuche::text || ''/'' || coalesce(error, ''-'') || ''/'' || (not_before between now() + interval ''299 seconds'' and now() + interval ''301 seconds'')::text || ''/'' || (claimed_at is null)::text from public.notification_outbox where id = %L', v_e1),
         'wert:1/-/true/true', array['intern']),
        ('fünfter Fehler: bleibt stehen', array[format('insert into public.notification_outbox (id, profile_id, kategorie, titel, text, dedup_key, ist_vorschau, versuche) values (%L, %L, ''test'', ''P'', ''P'', ''pruef0057:b'', true, 4)', v_e1, v_admin)],
         null, array[format('select public.push_mark_error(%L, ''keine Zustellung'')', v_e1)],
         format('select versuche::text || ''/'' || coalesce(error, ''-'') from public.notification_outbox where id = %L', v_e1),
         'wert:5/keine Zustellung', array['intern']),
        ('abgelaufene Zeile: kein neuer Versuch', array[format('insert into public.notification_outbox (id, profile_id, kategorie, titel, text, dedup_key, ist_vorschau, gueltig_bis) values (%L, %L, ''test'', ''P'', ''P'', ''pruef0057:c'', true, now() - interval ''1 second'')', v_e1, v_admin)],
         null, array[format('select public.push_mark_error(%L, ''keine Zustellung'')', v_e1)],
         format('select coalesce(error, ''-'') from public.notification_outbox where id = %L', v_e1),
         'wert:keine Zustellung', array['intern']),
        ('nach dem Warten wieder fällig', array[format('insert into public.notification_outbox (id, profile_id, kategorie, titel, text, dedup_key, ist_vorschau) values (%L, %L, ''test'', ''P'', ''P'', ''pruef0057:d'', true)', v_e1, v_admin)],
         null, array[format('select public.push_mark_error(%L, ''keine Zustellung'')', v_e1), format('update public.notification_outbox set not_before = now() - interval ''1 second'' where id = %L', v_e1)],
         format('select count(*)::text from public.notification_due where id = %L', v_e1), 'wert:1', array['intern']),

        -- ---- R2 Restzeit beim Abholen ---------------------------------------
        ('push_claim kürzt die Lebensdauer auf die Restzeit', array[format('insert into public.notification_outbox (id, profile_id, kategorie, titel, text, dedup_key, ist_vorschau, gueltig_bis, ttl_seconds, not_before) values (%L, %L, ''test'', ''P'', ''P'', ''pruef0057:e'', true, now() + interval ''10 minutes'', 86400, now() - interval ''1 minute'')', v_e1, v_admin)],
         null, array['select count(*) from public.push_claim(500)'],
         format('select (ttl_seconds between 590 and 600)::text from public.notification_outbox where id = %L', v_e1), 'wert:true', array['intern']),
        ('ohne Verfall bleibt die Lebensdauer', array[format('insert into public.notification_outbox (id, profile_id, kategorie, titel, text, dedup_key, ist_vorschau, ttl_seconds, not_before) values (%L, %L, ''test'', ''P'', ''P'', ''pruef0057:f'', true, 604800, now() - interval ''1 minute'')', v_e1, v_admin)],
         null, array['select count(*) from public.push_claim(500)'],
         format('select ttl_seconds::text from public.notification_outbox where id = %L', v_e1), 'wert:604800', array['intern']),

        -- ---- Abos -----------------------------------------------------------
        ('abgelaufenes Abo (404/410): Gerät wird entfernt', v_basis, null, array['select public.push_subscription_failed(''https://pruef.invalid/0050'', true)'],
         format('select count(*)::text from public.push_subscriptions where profile_id = %L', v_admin), 'wert:0', array['intern']),
        ('fünf Fehlschläge in Folge: Gerät wird entfernt, ein Erfolg setzt zurück', v_basis, null,
         array['select public.push_subscription_failed(''https://pruef.invalid/0050'')', 'select public.push_subscription_failed(''https://pruef.invalid/0050'')',
               'select public.push_subscription_ok(''https://pruef.invalid/0050'')',
               'select public.push_subscription_failed(''https://pruef.invalid/0050'')', 'select public.push_subscription_failed(''https://pruef.invalid/0050'')',
               'select public.push_subscription_failed(''https://pruef.invalid/0050'')', 'select public.push_subscription_failed(''https://pruef.invalid/0050'')'],
         format('select failed_count::text from public.push_subscriptions where profile_id = %L', v_admin), 'wert:4', array['intern']),
        ('mehrere Geräte: eine Zeile je Nachricht, nicht je Gerät', v_basis || array[format('insert into public.push_subscriptions (profile_id, endpoint, p256dh, auth) values (%L, ''https://pruef.invalid/0057b'', ''x'', ''x'')', v_admin), format('insert into public.events (id, club_id, type, title, date, time, status, quelle, auto_fine) select %L, %L, ''training'', ''Prüftermin'', (x at time zone ''Europe/Berlin'')::date, to_char(x at time zone ''Europe/Berlin'', ''HH24:MI''), ''geplant'', ''manuell'', false from (select date_trunc(''minute'', now() + interval ''50 hours'') as x) q', v_e1, v_club)],
         array[format('select public.send_rsvp_reminder(%L, false)::text', v_e1)], null,
         format('select count(*)::text from public.notification_outbox where kategorie = ''rueckmeldung_nachfrage'' and profile_id = %L and created_at >= now()', v_admin),
         'wert:1', array['Trainer']),

        -- ---- Versandausfall, Rückstau ---------------------------------------
        ('Rückstau: abgelaufene Erinnerung wird nicht mehr zugestellt und als verfallen markiert',
         v_basis || array[format('insert into public.notification_outbox (id, profile_id, kategorie, titel, text, dedup_key, not_before, gueltig_bis, created_at) values (%L, %L, ''rueckmeldung_erinnerung'', ''P'', ''P'', ''pruef0057:g'', now() - interval ''5 hours'', now() - interval ''1 hour'', now() - interval ''5 hours'')', v_e1, v_admin)],
         null, array['select public.notification_outbox_cleanup()'],
         format('select (select count(*) from public.notification_due where id = %L)::text || ''/'' || (select coalesce(error, ''-'') from public.notification_outbox where id = %L)', v_e1, v_e1),
         'wert:0/verfallen', array['intern']),
        ('Rückstau: Strafe von vor drei Tagen kommt noch (feste Lebensdauer 7 Tage)',
         v_basis || array[format('update public.notification_prefs set strafe_neu = true, quiet_from = ''00:00'', quiet_to = ''00:00'' where profile_id = %L', v_admin),
           format('insert into public.notification_outbox (id, profile_id, kategorie, titel, text, dedup_key, not_before, created_at) values (%L, %L, ''strafe_neu'', ''P'', ''P'', ''pruef0057:h'', now() - interval ''3 days'', now() - interval ''3 days'')', v_e1, v_admin)],
         null, null, format('select count(*)::text from public.notification_due where id = %L', v_e1), 'wert:1', array['intern']),

        -- ---- Doppelter Lauf -------------------------------------------------
        ('Sammler zweimal zusammengefasst: eine Nachricht', v_basis || array[format('insert into public.fines (club_id, player_id, date, offense, base_amount, status, batch_id) values (%L, %L, current_date, ''Prüfung'', 5, ''offen'', gen_random_uuid())', v_club, v_aspieler)],
         null, array['update public.notification_sammler set faellig_ab = now() - interval ''1 second'' where erstellt_at >= now()', 'select public.notify_sammler_flush()', 'select public.notify_sammler_flush()'],
         format('select count(*)::text from public.notification_outbox where kategorie = ''strafe_neu'' and profile_id = %L and created_at >= now()', v_admin), 'wert:1', array['intern']),

        -- ---- Zeitumstellung 25.10.2026 --------------------------------------
        ('Ruhezeit 22 bis 8 Uhr um die Umstellung', null, null, null,
         'select public.in_quiet_hours_at(''22:00'', ''08:00'', ''2026-10-24 05:30+00'')::text || public.in_quiet_hours_at(''22:00'', ''08:00'', ''2026-10-24 06:30+00'')::text || public.in_quiet_hours_at(''22:00'', ''08:00'', ''2026-10-25 06:30+00'')::text || public.in_quiet_hours_at(''22:00'', ''08:00'', ''2026-10-25 07:00+00'')::text || public.in_quiet_hours_at(''22:00'', ''08:00'', ''2026-10-24 19:30+00'')::text || public.in_quiet_hours_at(''22:00'', ''08:00'', ''2026-10-25 21:30+00'')::text',
         'wert:truefalsetruefalsefalsetrue', array['intern']),
        ('frühestens 08:00 (BFV) um die Umstellung', null, null, null,
         'select to_char(public.notify_nicht_vor_acht(''2026-10-24 04:27+00'') at time zone ''UTC'', ''HH24:MI'') || ''/'' || to_char(public.notify_nicht_vor_acht(''2026-10-25 04:27+00'') at time zone ''UTC'', ''HH24:MI'') || ''/'' || to_char(public.notify_nicht_vor_acht(''2026-10-26 04:27+00'') at time zone ''UTC'', ''HH24:MI'')',
         'wert:06:00/07:00/07:00', array['intern']),
        ('Termin am 25.10. und 24.10., 19:00 Uhr: Beginn und Meldeschluss in Ortszeit', v_basis,
         array[format('insert into public.events (id, club_id, type, title, date, time, status, quelle, auto_fine) values (%L, %L, ''training'', ''Prüftermin'', ''2026-10-25'', ''19:00'', ''geplant'', ''manuell'', false), (gen_random_uuid(), %L, ''training'', ''Prüftermin B'', ''2026-10-24'', ''19:00'', ''geplant'', ''manuell'', false)', v_e1, v_club, v_club)],
         null,
         'select string_agg(to_char(starts_at at time zone ''UTC'', ''HH24:MI'') || ''-'' || to_char(deadline_at at time zone ''Europe/Berlin'', ''HH24:MI''), '','' order by date) from public.events where title in (''Prüftermin'', ''Prüftermin B'') and date in (''2026-10-24'', ''2026-10-25'')',
         'wert:17:00-16:00,18:00-16:00', array['Trainer']),
        ('Erinnerung 24 h vor dem Meldeschluss am 26.10. kommt am 25.10. um 16:00 Ortszeit (echte 24 Stunden)', null, null, null,
         'select to_char(((''2026-10-26''::date + time ''16:00'') at time zone ''Europe/Berlin'' - interval ''24 hours'') at time zone ''Europe/Berlin'', ''DD.MM. HH24:MI'')',
         'wert:25.10. 16:00', array['intern'])
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
        elsif r.rolle = 'service_role' then
          perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
          execute 'set local role service_role';
        elsif r.rolle <> 'intern' then
          perform set_config('request.jwt.claims',
            json_build_object('sub', case when r.rolle = 'Admin' then v_admin else v_nutzer end, 'role', 'authenticated')::text, true);
          execute 'set local role authenticated';
        end if;
        if f.aktion is not null then
          for i in 1 .. array_length(f.aktion, 1) loop
            if f.pruef is null and i = array_length(f.aktion, 1) then execute f.aktion[i] into v_txt; else execute f.aktion[i]; end if;
          end loop;
        end if;
        if r.rolle <> 'intern' then
          execute 'reset role';
          perform set_config('request.jwt.claims', '', true);
        end if;
        foreach s in array coalesce(f.nach, '{}'::text[]) loop execute s; end loop;
        if f.pruef is not null then execute f.pruef into v_txt; end if;
        v_ok := true;
        raise exception using errcode = 'P0057', message = 'zurückrollen';
      exception when others then
        if sqlstate <> 'P0057' then v_state := sqlstate; v_msg := sqlerrm; end if;
      end;
      v_urteil := case
        when f.erwartet = 'verweigert' then case when not v_ok and v_state = '42501' then 'PASS' else 'FAIL' end
        when f.erwartet = 'ok' then case when v_ok then 'PASS' else 'FAIL' end
        when f.erwartet like 'wert:%' then case when v_ok and v_txt = substr(f.erwartet, 6) then 'PASS' else 'FAIL' end
        when f.erwartet like 'fehler:%' then case when not v_ok and v_state <> '42501' and v_msg like '%' || substr(f.erwartet, 8) || '%' then 'PASS' else 'FAIL' end
      end;
      insert into pruef_0057 values (v_nr, r.rolle, f.fall, f.erwartet,
        case when v_ok then 'gelungen: ' || coalesce(left(v_txt, 160), '(null)') else 'abgelehnt: ' || v_state || ' ' || left(v_msg, 160) end,
        v_urteil);
    end loop;
  end loop;
end
$pruef$;

select nr, rolle, fall, erwartet, ergebnis, urteil from pruef_0057
union all
select null, 'SUMME', count(*) || ' Fälle: ' || count(*) filter (where urteil = 'PASS') || ' PASS, '
       || count(*) filter (where urteil = 'FAIL') || ' FAIL', null, null, null from pruef_0057
order by nr nulls last;
