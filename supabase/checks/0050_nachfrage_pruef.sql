-- ============================================================================
-- Prüfung zu Migration 0050 (P1 serverseitig: send_rsvp_reminder).
-- Ändert nichts: jeder Fall läuft in einer Untertransaktion, die immer
-- zurückgerollt wird. Muster wie 0048_rueckmeldung_pruef.sql, dazu die
-- Erwartung "fehler:<Text>" (Fehler mit diesem Text, nicht 42501).
-- Empfänger ist der Admin (seine Geräte werden im Fall durch ein Prüfgerät
-- ersetzt); das Nicht-Admin-Profil ist Trainer und mit einem Prüfspieler
-- verknüpft, zählt also als "selbst".
-- ============================================================================

drop table if exists pg_temp.pruef_0050;
create temp table pruef_0050 (nr int, rolle text, fall text, erwartet text, ergebnis text, urteil text);

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
    format('insert into public.players (id, club_id, code, name) values (%L, %L, %L, %L)', v_sp, v_club, 'pruef0050', 'Prüfspieler 0050'),
    format('update public.profiles set player_id = %L where id = %L', v_sp, v_nutzer),
    format('delete from public.player_status where player_id = %L', v_aspieler),
    format('delete from public.push_subscriptions where profile_id = %L', v_admin),
    format('insert into public.push_subscriptions (profile_id, endpoint, p256dh, auth) values (%L, ''https://pruef.invalid/0050'', ''x'', ''x'')', v_admin),
    format('update public.notification_prefs set rueckmeldung_erinnerung = true where profile_id = %L', v_admin)];
  v_coach := format('insert into public.user_roles (user_id, role, club_id) select %L, ''coach'', %L where not exists (select 1 from public.user_roles where user_id = %L and role = ''coach'')', v_nutzer, v_club, v_nutzer);
  v_zweiter := format('insert into public.players (id, club_id, code, name) values (%L, %L, %L, %L)', v_sp2, v_club, 'pruef0050b', 'Prüfspieler Zwei');
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
        -- ---- 1) Rechte -----------------------------------------------------
        ('send_rsvp_reminder als anon, Spieler, Kassenwart', v_basis || array[format('insert into public.events (id, club_id, type, title, date, time, status, quelle, auto_fine) select %L, %L, ''training'', ''Prüftermin'', (x at time zone ''Europe/Berlin'')::date, to_char(x at time zone ''Europe/Berlin'', ''HH24:MI''), ''geplant'', ''manuell'', false from (select date_trunc(''minute'', now() + interval ''50 hours'') as x) q', v_e1, v_club)], array[format('select public.send_rsvp_reminder(%L, true)::text', v_e1)], null::text[], null::text, 'verweigert', array['anon','Spieler','Kassenwart']),
        ('send_rsvp_reminder als Trainer und Admin (nur zählen)', v_basis || array[format('insert into public.events (id, club_id, type, title, date, time, status, quelle, auto_fine) select %L, %L, ''training'', ''Prüftermin'', (x at time zone ''Europe/Berlin'')::date, to_char(x at time zone ''Europe/Berlin'', ''HH24:MI''), ''geplant'', ''manuell'', false from (select date_trunc(''minute'', now() + interval ''50 hours'') as x) q', v_e1, v_club)], array[format('select (public.send_rsvp_reminder(%L, true) ->> ''nur_zaehlen'')', v_e1)], null, null, 'wert:true', array['Trainer','Admin']),
        ('authenticated darf genau 28 Funktionen (26 aus 0042b + send_rsvp_reminder + set_notification_strafhinweis seit 0056)', null, null, null,
         'select count(*)::text || ''/'' || bool_or(p.proname = ''send_rsvp_reminder'')::text from pg_proc p where p.pronamespace = ''public''::regnamespace and has_function_privilege(''authenticated'', p.oid, ''execute'')',
         'wert:28/true', array['intern']),
        ('keine notify_*-Funktion für anon/authenticated', null, null, null,
         'select count(*)::text from pg_proc p where p.pronamespace = ''public''::regnamespace and p.proname like ''notify\_%'' and p.proname <> ''notify_enqueue'' and (has_function_privilege(''anon'', p.oid, ''execute'') or has_function_privilege(''authenticated'', p.oid, ''execute''))',
         'wert:0', array['intern']),
        ('Vorlage, Rolle, Constraint', null, null, null,
         'select (select titel_vorlage || '' / '' || urgency || '' / '' || ttl_regel from public.notification_templates where kategorie = ''rueckmeldung_nachfrage'') || '' / '' || public.kategorie_rolle(''rueckmeldung_nachfrage'') || '' / '' || (pg_get_constraintdef((select oid from pg_constraint where conname = ''notification_outbox_kat_chk'')) like ''%rueckmeldung_nachfrage%'')::text',
         'wert:⏳ Bitte zurückmelden: {termin_titel} / normal / bis_zeitpunkt / spieler / true', array['intern']),

        -- ---- 2) Zählen und Senden ------------------------------------------
        ('nur zählen: Admin mit Gerät zählt, Trainer selbst nicht, nichts eingereiht', v_basis || array[format('insert into public.events (id, club_id, type, title, date, time, status, quelle, auto_fine) select %L, %L, ''training'', ''Prüftermin'', (x at time zone ''Europe/Berlin'')::date, to_char(x at time zone ''Europe/Berlin'', ''HH24:MI''), ''geplant'', ''manuell'', false from (select date_trunc(''minute'', now() + interval ''50 hours'') as x) q', v_e1, v_club)],
         array[format('select (public.send_rsvp_reminder(%L, true) ->> ''gesendet'')', v_e1)], null, null, 'wert:1', array['Trainer']),
        ('nur zählen reiht nichts ein', v_basis || array[format('insert into public.events (id, club_id, type, title, date, time, status, quelle, auto_fine) select %L, %L, ''training'', ''Prüftermin'', (x at time zone ''Europe/Berlin'')::date, to_char(x at time zone ''Europe/Berlin'', ''HH24:MI''), ''geplant'', ''manuell'', false from (select date_trunc(''minute'', now() + interval ''50 hours'') as x) q', v_e1, v_club)], array[format('select public.send_rsvp_reminder(%L, true)::text', v_e1)], null, format('select count(*)::text from public.notification_outbox where kategorie = ''rueckmeldung_nachfrage'' and dedup_key like %L', 'nachfrage:' || v_e1 || ':%'), 'wert:0', array['Trainer']),
        ('senden: eine Zeile an den Admin, Text, normal, gültig bis Beginn', v_basis || array[format('insert into public.events (id, club_id, type, title, date, time, status, quelle, auto_fine) select %L, %L, ''training'', ''Prüftermin'', (x at time zone ''Europe/Berlin'')::date, to_char(x at time zone ''Europe/Berlin'', ''HH24:MI''), ''geplant'', ''manuell'', false from (select date_trunc(''minute'', now() + interval ''50 hours'') as x) q', v_e1, v_club)],
         array[format('select public.send_rsvp_reminder(%L, false)::text', v_e1)], null,
         format('select count(*)::text || '' | '' || max(o.titel || '' | '' || o.deep_link) || '' | '' || bool_and(o.urgency = ''normal'' and o.gueltig_bis = e.starts_at and o.text = public.notify_datum_kurz(e.date) || '' '' || public.notify_uhrzeit(e.time) || ''. Dein Trainer wartet noch auf deine Zu- oder Absage.'')::text from public.notification_outbox o join public.events e on e.id = %L where o.kategorie = ''rueckmeldung_nachfrage'' and o.profile_id = %L', v_e1, v_admin),
         format('wert:1 | ⏳ Bitte zurückmelden: Prüftermin | #termin=%s | true', v_e1), array['Trainer']),
        ('Sperre: zweiter Aufruf gesperrt, nächste Möglichkeit in 12 Stunden, keine neue Zeile', v_basis || array[format('insert into public.events (id, club_id, type, title, date, time, status, quelle, auto_fine) select %L, %L, ''training'', ''Prüftermin'', (x at time zone ''Europe/Berlin'')::date, to_char(x at time zone ''Europe/Berlin'', ''HH24:MI''), ''geplant'', ''manuell'', false from (select date_trunc(''minute'', now() + interval ''50 hours'') as x) q', v_e1, v_club)],
         array[format('select public.send_rsvp_reminder(%L, false)::text', v_e1), format('select (r->>''gesperrt'') || ''/'' || ((r->>''naechste_moeglich'')::timestamptz between now() + interval ''11 hours 59 minutes'' and now() + interval ''12 hours 1 minute'')::text || ''/'' || (r->>''gesendet'') from (select public.send_rsvp_reminder(%L, false) as r) q', v_e1)],
         null, null, 'wert:true/true/0', array['Trainer']),
        ('Sperre gilt für jeden: Nachfrage eines anderen vor 11 Stunden',
         v_basis || array[format('insert into public.events (id, club_id, type, title, date, time, status, quelle, auto_fine) select %L, %L, ''training'', ''Prüftermin'', (x at time zone ''Europe/Berlin'')::date, to_char(x at time zone ''Europe/Berlin'', ''HH24:MI''), ''geplant'', ''manuell'', false from (select date_trunc(''minute'', now() + interval ''50 hours'') as x) q', v_e1, v_club), format('insert into public.notification_outbox (profile_id, kategorie, titel, text, dedup_key, created_at) values (%L, ''rueckmeldung_nachfrage'', ''x'', ''x'', %L, now() - interval ''11 hours'')', v_nutzer, 'nachfrage:' || v_e1 || ':alt')],
         array[format('select (public.send_rsvp_reminder(%L, false) ->> ''gesperrt'')', v_e1)], null, null, 'wert:true', array['Admin']),
        ('nach 13 Stunden wieder möglich',
         v_basis || array[format('insert into public.events (id, club_id, type, title, date, time, status, quelle, auto_fine) select %L, %L, ''training'', ''Prüftermin'', (x at time zone ''Europe/Berlin'')::date, to_char(x at time zone ''Europe/Berlin'', ''HH24:MI''), ''geplant'', ''manuell'', false from (select date_trunc(''minute'', now() + interval ''50 hours'') as x) q', v_e1, v_club), format('insert into public.notification_outbox (profile_id, kategorie, titel, text, dedup_key, created_at, sent_at) values (%L, ''rueckmeldung_nachfrage'', ''x'', ''x'', %L, now() - interval ''13 hours'', now() - interval ''13 hours'')', v_nutzer, 'nachfrage:' || v_e1 || ':alt')],
         array[format('select public.send_rsvp_reminder(%L, false)::text', v_e1)], null,
         format('select count(*)::text from public.notification_outbox where kategorie = ''rueckmeldung_nachfrage'' and profile_id = %L and created_at >= now()', v_admin),
         'wert:1', array['Trainer']),
        ('mit Rückmeldung: nicht gezählt, nichts gesendet',
         v_basis || array[format('insert into public.events (id, club_id, type, title, date, time, status, quelle, auto_fine) select %L, %L, ''training'', ''Prüftermin'', (x at time zone ''Europe/Berlin'')::date, to_char(x at time zone ''Europe/Berlin'', ''HH24:MI''), ''geplant'', ''manuell'', false from (select date_trunc(''minute'', now() + interval ''50 hours'') as x) q', v_e1, v_club), format('insert into public.rsvps (club_id, event_id, player_id, status) values (%L, %L, %L, ''zu'')', v_club, v_e1, v_aspieler)],
         array[format('select (public.send_rsvp_reminder(%L, false) ->> ''gesendet'')', v_e1)], null, null, 'wert:0', array['Trainer']),
        ('Urlaub am Termintag: ausgenommen (Entscheidung 1)',
         v_basis || array[format('insert into public.events (id, club_id, type, title, date, time, status, quelle, auto_fine) select %L, %L, ''training'', ''Prüftermin'', (x at time zone ''Europe/Berlin'')::date, to_char(x at time zone ''Europe/Berlin'', ''HH24:MI''), ''geplant'', ''manuell'', false from (select date_trunc(''minute'', now() + interval ''50 hours'') as x) q', v_e1, v_club), format('insert into public.player_status (player_id, status, status_until) values (%L, ''urlaub'', current_date + 5)', v_aspieler)],
         array[format('select public.send_rsvp_reminder(%L, false)::text', v_e1)], null,
         format('select count(*)::text from public.notification_outbox where kategorie = ''rueckmeldung_nachfrage'' and profile_id = %L and created_at >= now()', v_admin),
         'wert:0', array['Trainer']),
        ('Schalter aus: abgeschaltet gezählt, nichts eingereiht',
         v_basis || array[format('insert into public.events (id, club_id, type, title, date, time, status, quelle, auto_fine) select %L, %L, ''training'', ''Prüftermin'', (x at time zone ''Europe/Berlin'')::date, to_char(x at time zone ''Europe/Berlin'', ''HH24:MI''), ''geplant'', ''manuell'', false from (select date_trunc(''minute'', now() + interval ''50 hours'') as x) q', v_e1, v_club), format('update public.notification_prefs set rueckmeldung_erinnerung = false where profile_id = %L', v_admin)],
         array[format('select (public.send_rsvp_reminder(%L, false) ->> ''abgeschaltet'')', v_e1)], null, null, 'wert:1', array['Trainer']),
        ('ohne Gerät: ohne_abo gezählt, nichts eingereiht',
         v_basis || array[format('insert into public.events (id, club_id, type, title, date, time, status, quelle, auto_fine) select %L, %L, ''training'', ''Prüftermin'', (x at time zone ''Europe/Berlin'')::date, to_char(x at time zone ''Europe/Berlin'', ''HH24:MI''), ''geplant'', ''manuell'', false from (select date_trunc(''minute'', now() + interval ''50 hours'') as x) q', v_e1, v_club), format('delete from public.push_subscriptions where profile_id = %L', v_admin)],
         array[format('select (public.send_rsvp_reminder(%L, false) ->> ''ohne_abo'')', v_e1)], null, null, 'wert:1', array['Trainer']),
        ('Ruhezeit: in_ruhezeit und zustellung_ab',
         v_basis || array[format('insert into public.events (id, club_id, type, title, date, time, status, quelle, auto_fine) select %L, %L, ''training'', ''Prüftermin'', (x at time zone ''Europe/Berlin'')::date, to_char(x at time zone ''Europe/Berlin'', ''HH24:MI''), ''geplant'', ''manuell'', false from (select date_trunc(''minute'', now() + interval ''50 hours'') as x) q', v_e1, v_club), format('update public.notification_prefs set quiet_from = ''00:00'', quiet_to = ''23:59'' where profile_id = %L', v_admin)],
         array[format('select (r->>''in_ruhezeit'') || ''/'' || (r->>''zustellung_ab'') from (select public.send_rsvp_reminder(%L, false) as r) q', v_e1)], null, null,
         'wert:1/23:59', array['Trainer']),
        ('Termin hat begonnen: Fehler', v_basis || array[format('insert into public.events (id, club_id, type, title, date, time, status, quelle, auto_fine) select %L, %L, ''training'', ''Prüftermin'', (x at time zone ''Europe/Berlin'')::date, to_char(x at time zone ''Europe/Berlin'', ''HH24:MI''), ''geplant'', ''manuell'', false from (select date_trunc(''minute'', now() + interval ''-1 hours'') as x) q', v_e1, v_club)], array[format('select public.send_rsvp_reminder(%L, false)::text', v_e1)], null, null, 'fehler:schon begonnen', array['Trainer']),
        ('Termin fällt aus: Fehler', v_basis || array[format('insert into public.events (id, club_id, type, title, date, time, status, quelle, auto_fine) select %L, %L, ''training'', ''Prüftermin'', (x at time zone ''Europe/Berlin'')::date, to_char(x at time zone ''Europe/Berlin'', ''HH24:MI''), ''geplant'', ''manuell'', false from (select date_trunc(''minute'', now() + interval ''50 hours'') as x) q', v_e1, v_club), format('update public.events set status = ''abgesagt'' where id = %L', v_e1)],
         array[format('select public.send_rsvp_reminder(%L, false)::text', v_e1)], null, null, 'fehler:fällt aus', array['Trainer']),

        -- ---- 3) Zustellbarkeit über notification_due -----------------------
        ('Schalter "Erinnerung" an, keine Ruhezeit: fällig',
         v_basis || array[format('insert into public.events (id, club_id, type, title, date, time, status, quelle, auto_fine) select %L, %L, ''training'', ''Prüftermin'', (x at time zone ''Europe/Berlin'')::date, to_char(x at time zone ''Europe/Berlin'', ''HH24:MI''), ''geplant'', ''manuell'', false from (select date_trunc(''minute'', now() + interval ''50 hours'') as x) q', v_e1, v_club), format('update public.notification_prefs set rueckmeldung_erinnerung = true, quiet_from = ''00:00'', quiet_to = ''00:00'' where profile_id = %L', v_admin)],
         array[format('select public.send_rsvp_reminder(%L, false)::text', v_e1)], null,
         format('select count(*)::text from public.notification_due where kategorie = ''rueckmeldung_nachfrage'' and profile_id = %L', v_admin),
         'wert:1', array['Trainer']),
        ('Schalter danach aus: nicht mehr fällig',
         v_basis || array[format('insert into public.events (id, club_id, type, title, date, time, status, quelle, auto_fine) select %L, %L, ''training'', ''Prüftermin'', (x at time zone ''Europe/Berlin'')::date, to_char(x at time zone ''Europe/Berlin'', ''HH24:MI''), ''geplant'', ''manuell'', false from (select date_trunc(''minute'', now() + interval ''50 hours'') as x) q', v_e1, v_club), format('update public.notification_prefs set quiet_from = ''00:00'', quiet_to = ''00:00'' where profile_id = %L', v_admin)],
         array[format('select public.send_rsvp_reminder(%L, false)::text', v_e1)], array[format('update public.notification_prefs set rueckmeldung_erinnerung = false where profile_id = %L', v_admin)],
         format('select count(*)::text from public.notification_due where kategorie = ''rueckmeldung_nachfrage'' and profile_id = %L', v_admin),
         'wert:0', array['Trainer'])
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
        raise exception using errcode = 'P0050', message = 'zurückrollen';
      exception when others then
        if sqlstate <> 'P0050' then v_state := sqlstate; v_msg := sqlerrm; end if;
      end;
      v_urteil := case
        when f.erwartet = 'verweigert' then case when not v_ok and v_state = '42501' then 'PASS' else 'FAIL' end
        when f.erwartet = 'ok' then case when v_ok then 'PASS' else 'FAIL' end
        when f.erwartet like 'wert:%' then case when v_ok and v_txt = substr(f.erwartet, 6) then 'PASS' else 'FAIL' end
        when f.erwartet like 'fehler:%' then case when not v_ok and v_state <> '42501' and v_msg like '%' || substr(f.erwartet, 8) || '%' then 'PASS' else 'FAIL' end
      end;
      insert into pruef_0050 values (v_nr, r.rolle, f.fall, f.erwartet,
        case when v_ok then 'gelungen: ' || coalesce(left(v_txt, 160), '(null)') else 'abgelehnt: ' || v_state || ' ' || left(v_msg, 160) end,
        v_urteil);
    end loop;
  end loop;
end
$pruef$;

select nr, rolle, fall, erwartet, ergebnis, urteil from pruef_0050
union all
select null, 'SUMME', count(*) || ' Fälle: ' || count(*) filter (where urteil = 'PASS') || ' PASS, '
       || count(*) filter (where urteil = 'FAIL') || ' FAIL', null, null, null from pruef_0050
order by nr nulls last;
