-- ============================================================================
-- Prüfung zu Migration 0048 (Automatische Mitteilungen, AM4 Rückmeldung).
-- Seit 0052: Termine hier ohne Auto-Strafe, also ohne Strafhinweis im Text.
-- Ändert nichts: jeder Fall läuft in einer Untertransaktion, die immer
-- zurückgerollt wird. Muster wie 0046_termine_pruef.sql (vor / aktion / nach /
-- pruef). Termine liegen relativ zu jetzt (Training, Meldeschluss 3 Stunden).
-- Der Admin-Spieler empfängt die Erinnerungen; das Nicht-Admin-Profil ist mit
-- einem Prüfspieler verknüpft und je nach Fall Trainer.
-- ============================================================================

drop table if exists pg_temp.pruef_0048;
create temp table pruef_0048 (nr int, rolle text, fall text, erwartet text, ergebnis text, urteil text);

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
    format('insert into public.players (id, club_id, code, name) values (%L, %L, %L, %L)', v_sp, v_club, 'pruef0048', 'Prüfspieler 0048'),
    format('update public.profiles set player_id = %L where id = %L', v_sp, v_nutzer),
    format('delete from public.player_status where player_id = %L', v_aspieler)];
  v_coach := format('insert into public.user_roles (user_id, role, club_id) select %L, ''coach'', %L where not exists (select 1 from public.user_roles where user_id = %L and role = ''coach'')', v_nutzer, v_club, v_nutzer);
  v_zweiter := format('insert into public.players (id, club_id, code, name) values (%L, %L, %L, %L)', v_sp2, v_club, 'pruef0048b', 'Prüfspieler Zwei');
  v_faellig := 'update public.notification_sammler set faellig_ab = now() - interval ''1 second'' where erstellt_at >= now()';
  pruef_erinnerung := format('select count(*)::text || ''/'' || bool_and(o.titel = ''⏳ Bist du dabei? Prüftermin'' and o.text = public.notify_datum_kurz(e.date) || '' '' || public.notify_uhrzeit(e.time) || '' · Meldeschluss '' || public.notify_meldeschluss_text(e.deadline_at) || ''.'' and o.gueltig_bis = e.deadline_at and o.urgency = ''high'' and o.deep_link = ''#termin='' || e.id)::text from public.notification_outbox o join public.events e on e.id = %L where o.kategorie = ''rueckmeldung_erinnerung'' and o.profile_id = %L and o.dedup_key like %L', v_e1, v_admin, 'erinnerung:' || v_e1 || ':%:24');
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
        ('notify_meldeschluss_text', null::text[], array['select public.notify_meldeschluss_text(now())'], null::text[], null::text, 'verweigert', AUSSEN),
        ('notify_cron_rueckmeldung', null, array['select public.notify_cron_rueckmeldung()::text'], null, null, 'verweigert', AUSSEN),
        ('notify_flush_absage_kurzfristig', null, array['select public.notify_flush_absage_kurzfristig()::text'], null, null, 'verweigert', AUSSEN),
        ('keine notify_*-Funktion für anon/authenticated', null, null, null,
         'select count(*)::text from pg_proc p where p.pronamespace = ''public''::regnamespace and p.proname like ''notify\_%'' and p.proname <> ''notify_enqueue'' and (has_function_privilege(''anon'', p.oid, ''execute'') or has_function_privilege(''authenticated'', p.oid, ''execute''))',
         'wert:0', array['intern']),
        ('Trigger trg_rsvps_notify aktiv, Cron alle 5 Minuten', null, null, null,
         'select (select tgenabled::text from pg_trigger where tgname = ''trg_rsvps_notify'') || ''/'' || (select schedule || '' '' || active::text from cron.job where jobname = ''notify-rueckmeldung'')',
         'wert:O/*/5 * * * * true', array['intern']),
        ('Vorlage absage_kurzfristig (R1)', null, null, null,
         'select titel_vorlage from public.notification_templates where kategorie = ''absage_kurzfristig''', 'wert:🚨 {anzahl}', array['intern']),
        ('Meldeschluss als Text: heute / morgen / Datum', null, null, null,
         'select public.notify_meldeschluss_text((((now() at time zone ''Europe/Berlin'')::date + time ''16:30'') at time zone ''Europe/Berlin'')) || '' | '' || public.notify_meldeschluss_text((((now() at time zone ''Europe/Berlin'')::date + 1 + time ''16:30'') at time zone ''Europe/Berlin'')) || '' | '' || (public.notify_meldeschluss_text((((now() at time zone ''Europe/Berlin'')::date + 5 + time ''16:30'') at time zone ''Europe/Berlin'')) = public.notify_datum_kurz((now() at time zone ''Europe/Berlin'')::date + 5) || '' 16:30 Uhr'')::text',
         'wert:heute 16:30 Uhr | morgen 16:30 Uhr | true', array['intern']),

        -- ---- 2) rueckmeldung_erinnerung ------------------------------------
        ('Erinnerung 24 h: Meldeschluss in 23 Stunden, Text, gültig bis Meldeschluss', v_basis || array[format('insert into public.events (id, club_id, type, title, date, time, status, quelle, auto_fine) select %L, %L, ''training'', ''Prüftermin'', (x at time zone ''Europe/Berlin'')::date, to_char(x at time zone ''Europe/Berlin'', ''HH24:MI''), ''geplant'', ''manuell'', false from (select date_trunc(''minute'', now() + interval ''26 hours'') as x) q', v_e1, v_club)],
         null, array['select public.notify_cron_rueckmeldung()'], pruef_erinnerung, 'wert:1/true', array['intern']),
        ('Erinnerung: zweiter Lauf erzeugt nichts Neues', v_basis || array[format('insert into public.events (id, club_id, type, title, date, time, status, quelle, auto_fine) select %L, %L, ''training'', ''Prüftermin'', (x at time zone ''Europe/Berlin'')::date, to_char(x at time zone ''Europe/Berlin'', ''HH24:MI''), ''geplant'', ''manuell'', false from (select date_trunc(''minute'', now() + interval ''26 hours'') as x) q', v_e1, v_club)],
         null, array['select public.notify_cron_rueckmeldung()', 'select public.notify_cron_rueckmeldung()'],
         zaehl_erinnerung,
         'wert:1', array['intern']),
        ('Erinnerung 2 h: Meldeschluss in 1 Stunde', v_basis || array[format('insert into public.events (id, club_id, type, title, date, time, status, quelle, auto_fine) select %L, %L, ''training'', ''Prüftermin'', (x at time zone ''Europe/Berlin'')::date, to_char(x at time zone ''Europe/Berlin'', ''HH24:MI''), ''geplant'', ''manuell'', false from (select date_trunc(''minute'', now() + interval ''4 hours'') as x) q', v_e1, v_club)],
         null, array['select public.notify_cron_rueckmeldung()'],
         format('select count(*)::text from public.notification_outbox where kategorie = ''rueckmeldung_erinnerung'' and profile_id = %L and dedup_key like %L', v_admin, 'erinnerung:' || v_e1 || ':%:2'),
         'wert:1', array['intern']),
        ('Erinnerung: Meldeschluss in 27 Stunden, noch nichts', v_basis || array[format('insert into public.events (id, club_id, type, title, date, time, status, quelle, auto_fine) select %L, %L, ''training'', ''Prüftermin'', (x at time zone ''Europe/Berlin'')::date, to_char(x at time zone ''Europe/Berlin'', ''HH24:MI''), ''geplant'', ''manuell'', false from (select date_trunc(''minute'', now() + interval ''30 hours'') as x) q', v_e1, v_club)],
         null, array['select public.notify_cron_rueckmeldung()'], zaehl_erinnerung, 'wert:0', array['intern']),
        ('Erinnerung: mit Rückmeldung nichts', v_basis || array[format('insert into public.events (id, club_id, type, title, date, time, status, quelle, auto_fine) select %L, %L, ''training'', ''Prüftermin'', (x at time zone ''Europe/Berlin'')::date, to_char(x at time zone ''Europe/Berlin'', ''HH24:MI''), ''geplant'', ''manuell'', false from (select date_trunc(''minute'', now() + interval ''26 hours'') as x) q', v_e1, v_club), format('insert into public.rsvps (club_id, event_id, player_id, status) values (%L, %L, %L, ''zu'') on conflict (event_id, player_id) do update set status = ''zu'', updated_at = now()', v_club, v_e1, v_aspieler)],
         null, array['select public.notify_cron_rueckmeldung()'], zaehl_erinnerung, 'wert:0', array['intern']),
        ('Erinnerung: Urlaub am Termintag nichts (F6, T2)',
         v_basis || array[format('insert into public.events (id, club_id, type, title, date, time, status, quelle, auto_fine) select %L, %L, ''training'', ''Prüftermin'', (x at time zone ''Europe/Berlin'')::date, to_char(x at time zone ''Europe/Berlin'', ''HH24:MI''), ''geplant'', ''manuell'', false from (select date_trunc(''minute'', now() + interval ''26 hours'') as x) q', v_e1, v_club), format('insert into public.player_status (player_id, status, status_until) values (%L, ''urlaub'', current_date + 3)', v_aspieler)],
         null, array['select public.notify_cron_rueckmeldung()'], zaehl_erinnerung, 'wert:0', array['intern']),
        ('Erinnerung: abgesagter Termin nichts', v_basis || array[format('insert into public.events (id, club_id, type, title, date, time, status, quelle, auto_fine) select %L, %L, ''training'', ''Prüftermin'', (x at time zone ''Europe/Berlin'')::date, to_char(x at time zone ''Europe/Berlin'', ''HH24:MI''), ''geplant'', ''manuell'', false from (select date_trunc(''minute'', now() + interval ''26 hours'') as x) q', v_e1, v_club), format('update public.events set status = ''abgesagt'' where id = %L', v_e1)],
         null, array['select public.notify_cron_rueckmeldung()'], zaehl_erinnerung, 'wert:0', array['intern']),
        ('Erinnerung: Termin "sonstiges" ohne Meldeschluss nichts', v_basis || array[format('insert into public.events (id, club_id, type, title, date, time, status, quelle, auto_fine) select %L, %L, ''training'', ''Prüftermin'', (x at time zone ''Europe/Berlin'')::date, to_char(x at time zone ''Europe/Berlin'', ''HH24:MI''), ''geplant'', ''manuell'', false from (select date_trunc(''minute'', now() + interval ''26 hours'') as x) q', v_e1, v_club), format('update public.events set type = ''sonstiges'' where id = %L', v_e1)],
         null, array['select public.notify_cron_rueckmeldung()'], zaehl_erinnerung, 'wert:0', array['intern']),

        -- ---- 3) meldeschluss_uebersicht ------------------------------------
        ('Übersicht: Meldeschluss vor 30 Minuten, an Trainer, Zahlen',
         v_basis || array[v_coach, format('insert into public.events (id, club_id, type, title, date, time, status, quelle, auto_fine) select %L, %L, ''training'', ''Prüftermin'', (x at time zone ''Europe/Berlin'')::date, to_char(x at time zone ''Europe/Berlin'', ''HH24:MI''), ''geplant'', ''manuell'', false from (select date_trunc(''minute'', now() + interval ''2.5 hours'') as x) q', v_e1, v_club), format('insert into public.rsvps (club_id, event_id, player_id, status) values (%L, %L, %L, ''zu'') on conflict (event_id, player_id) do update set status = ''zu'', updated_at = now()', v_club, v_e1, v_aspieler), format('insert into public.rsvps (club_id, event_id, player_id, status) values (%L, %L, %L, ''ab'') on conflict (event_id, player_id) do update set status = ''ab'', updated_at = now()', v_club, v_e1, v_sp)],
         null, array['select public.notify_cron_rueckmeldung()'],
         format('select count(*)::text || ''/'' || bool_and(titel like ''📋 Prüftermin %%'' and text like ''%% · ✅ 1 · ❌ 1 · ❓ %%'' and gueltig_bis = (select starts_at from public.events where id = %L))::text from public.notification_outbox where kategorie = ''meldeschluss_uebersicht'' and profile_id = %L', v_e1, v_nutzer),
         'wert:1/true', array['intern']),
        ('Übersicht: zweiter Lauf nichts Neues', v_basis || array[v_coach, format('insert into public.events (id, club_id, type, title, date, time, status, quelle, auto_fine) select %L, %L, ''training'', ''Prüftermin'', (x at time zone ''Europe/Berlin'')::date, to_char(x at time zone ''Europe/Berlin'', ''HH24:MI''), ''geplant'', ''manuell'', false from (select date_trunc(''minute'', now() + interval ''2.5 hours'') as x) q', v_e1, v_club)],
         null, array['select public.notify_cron_rueckmeldung()', 'select public.notify_cron_rueckmeldung()'],
         format('select count(*)::text from public.notification_outbox where kategorie = ''meldeschluss_uebersicht'' and profile_id = %L', v_nutzer),
         'wert:1', array['intern']),
        ('Übersicht: Meldeschluss vor über einer Stunde, nichts', v_basis || array[v_coach, format('insert into public.events (id, club_id, type, title, date, time, status, quelle, auto_fine) select %L, %L, ''training'', ''Prüftermin'', (x at time zone ''Europe/Berlin'')::date, to_char(x at time zone ''Europe/Berlin'', ''HH24:MI''), ''geplant'', ''manuell'', false from (select date_trunc(''minute'', now() + interval ''1.5 hours'') as x) q', v_e1, v_club)],
         null, array['select public.notify_cron_rueckmeldung()'],
         format('select count(*)::text from public.notification_outbox where kategorie = ''meldeschluss_uebersicht'' and profile_id = %L', v_nutzer),
         'wert:0', array['intern']),

        -- ---- 4) absage_kurzfristig -----------------------------------------
        ('Kurzfristige Absage: Spieler sagt nach Meldeschluss ab, Trainer bekommt Eintrag nach 10 Minuten',
         v_basis || array[v_coach, format('insert into public.events (id, club_id, type, title, date, time, status, quelle, auto_fine) select %L, %L, ''training'', ''Prüftermin'', (x at time zone ''Europe/Berlin'')::date, to_char(x at time zone ''Europe/Berlin'', ''HH24:MI''), ''geplant'', ''manuell'', false from (select date_trunc(''minute'', now() + interval ''2.5 hours'') as x) q', v_e1, v_club)], array[format('insert into public.rsvps (club_id, event_id, player_id, status) values (%L, %L, %L, ''ab'') on conflict (event_id, player_id) do update set status = ''ab'', updated_at = now()', v_club, v_e1, v_aspieler)], null,
         format('select count(*)::text || ''/'' || bool_and(faellig_ab between now() + interval ''9 minutes'' and now() + interval ''11 minutes'')::text from public.notification_sammler where kategorie = ''absage_kurzfristig'' and profile_id = %L', v_nutzer),
         'wert:1/true', array['Admin']),
        ('Kurzfristige Absage: zusammengefasst, Text',
         v_basis || array[v_coach, format('insert into public.events (id, club_id, type, title, date, time, status, quelle, auto_fine) select %L, %L, ''training'', ''Prüftermin'', (x at time zone ''Europe/Berlin'')::date, to_char(x at time zone ''Europe/Berlin'', ''HH24:MI''), ''geplant'', ''manuell'', false from (select date_trunc(''minute'', now() + interval ''2.5 hours'') as x) q', v_e1, v_club)], array[format('insert into public.rsvps (club_id, event_id, player_id, status) values (%L, %L, %L, ''ab'') on conflict (event_id, player_id) do update set status = ''ab'', updated_at = now()', v_club, v_e1, v_aspieler)], array[v_faellig, 'select public.notify_flush_absage_kurzfristig()'],
         format('select count(*)::text || '' | '' || max(titel || '' | '' || (text like ''Prüftermin %% Uhr: '' || %L)::text || '' | '' || deep_link) from public.notification_outbox where kategorie = ''absage_kurzfristig'' and profile_id = %L', v_aname, v_nutzer),
         format('wert:1 | 🚨 1 kurzfristige Absage | true | #termin=%s', v_e1), array['Admin']),
        ('Kurzfristige Absage: zwei Spieler, eine Nachricht',
         v_basis || array[v_coach, format('insert into public.events (id, club_id, type, title, date, time, status, quelle, auto_fine) select %L, %L, ''training'', ''Prüftermin'', (x at time zone ''Europe/Berlin'')::date, to_char(x at time zone ''Europe/Berlin'', ''HH24:MI''), ''geplant'', ''manuell'', false from (select date_trunc(''minute'', now() + interval ''2.5 hours'') as x) q', v_e1, v_club), v_zweiter], array[format('insert into public.rsvps (club_id, event_id, player_id, status) values (%L, %L, %L, ''ab'') on conflict (event_id, player_id) do update set status = ''ab'', updated_at = now()', v_club, v_e1, v_aspieler), format('insert into public.rsvps (club_id, event_id, player_id, status) values (%L, %L, %L, ''ab'') on conflict (event_id, player_id) do update set status = ''ab'', updated_at = now()', v_club, v_e1, v_sp2)], array[v_faellig, 'select public.notify_flush_absage_kurzfristig()'],
         format('select max(titel) || '' | '' || (max(text) like ''%%: '' || %L)::text from public.notification_outbox where kategorie = ''absage_kurzfristig'' and profile_id = %L', v_aname || ', Prüfspieler Zwei', v_nutzer),
         'wert:🚨 2 kurzfristige Absagen | true', array['Admin']),
        ('Kurzfristige Absage: vor dem Zusammenfassen wieder zugesagt, nichts',
         v_basis || array[v_coach, format('insert into public.events (id, club_id, type, title, date, time, status, quelle, auto_fine) select %L, %L, ''training'', ''Prüftermin'', (x at time zone ''Europe/Berlin'')::date, to_char(x at time zone ''Europe/Berlin'', ''HH24:MI''), ''geplant'', ''manuell'', false from (select date_trunc(''minute'', now() + interval ''2.5 hours'') as x) q', v_e1, v_club)], array[format('insert into public.rsvps (club_id, event_id, player_id, status) values (%L, %L, %L, ''ab'') on conflict (event_id, player_id) do update set status = ''ab'', updated_at = now()', v_club, v_e1, v_aspieler), format('insert into public.rsvps (club_id, event_id, player_id, status) values (%L, %L, %L, ''zu'') on conflict (event_id, player_id) do update set status = ''zu'', updated_at = now()', v_club, v_e1, v_aspieler)], array[v_faellig, 'select public.notify_flush_absage_kurzfristig()'],
         'select count(*)::text from public.notification_outbox where kategorie = ''absage_kurzfristig'' and created_at >= now()', 'wert:0', array['Admin']),
        ('Kurzfristige Absage: Trainer sagt selbst ab, bekommt nichts (F1)',
         v_basis || array[format('insert into public.events (id, club_id, type, title, date, time, status, quelle, auto_fine) select %L, %L, ''training'', ''Prüftermin'', (x at time zone ''Europe/Berlin'')::date, to_char(x at time zone ''Europe/Berlin'', ''HH24:MI''), ''geplant'', ''manuell'', false from (select date_trunc(''minute'', now() + interval ''2.5 hours'') as x) q', v_e1, v_club)], array[format('insert into public.rsvps (club_id, event_id, player_id, status) values (%L, %L, %L, ''ab'') on conflict (event_id, player_id) do update set status = ''ab'', updated_at = now()', v_club, v_e1, v_sp)], null,
         format('select count(*)::text from public.notification_sammler where kategorie = ''absage_kurzfristig'' and profile_id = %L', v_nutzer),
         'wert:0', array['Trainer']),
        ('Absage vor Meldeschluss: nichts', v_basis || array[v_coach, format('insert into public.events (id, club_id, type, title, date, time, status, quelle, auto_fine) select %L, %L, ''training'', ''Prüftermin'', (x at time zone ''Europe/Berlin'')::date, to_char(x at time zone ''Europe/Berlin'', ''HH24:MI''), ''geplant'', ''manuell'', false from (select date_trunc(''minute'', now() + interval ''26 hours'') as x) q', v_e1, v_club)], array[format('insert into public.rsvps (club_id, event_id, player_id, status) values (%L, %L, %L, ''ab'') on conflict (event_id, player_id) do update set status = ''ab'', updated_at = now()', v_club, v_e1, v_aspieler)], null,
         'select count(*)::text from public.notification_sammler where kategorie = ''absage_kurzfristig'' and erstellt_at >= now()', 'wert:0', array['Admin']),
        ('Absage nach Beginn: nichts', v_basis || array[v_coach, format('insert into public.events (id, club_id, type, title, date, time, status, quelle, auto_fine) select %L, %L, ''training'', ''Prüftermin'', (x at time zone ''Europe/Berlin'')::date, to_char(x at time zone ''Europe/Berlin'', ''HH24:MI''), ''geplant'', ''manuell'', false from (select date_trunc(''minute'', now() + interval ''-1 hours'') as x) q', v_e1, v_club)], array[format('insert into public.rsvps (club_id, event_id, player_id, status) values (%L, %L, %L, ''ab'') on conflict (event_id, player_id) do update set status = ''ab'', updated_at = now()', v_club, v_e1, v_aspieler)], null,
         'select count(*)::text from public.notification_sammler where kategorie = ''absage_kurzfristig'' and erstellt_at >= now()', 'wert:0', array['Admin'])
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
        raise exception using errcode = 'P0048', message = 'zurückrollen';
      exception when others then
        if sqlstate <> 'P0048' then v_state := sqlstate; v_msg := sqlerrm; end if;
      end;
      v_urteil := case
        when f.erwartet = 'verweigert' then case when not v_ok and v_state = '42501' then 'PASS' else 'FAIL' end
        when f.erwartet = 'ok' then case when v_ok then 'PASS' else 'FAIL' end
        when f.erwartet like 'wert:%' then case when v_ok and v_txt = substr(f.erwartet, 6) then 'PASS' else 'FAIL' end
      end;
      insert into pruef_0048 values (v_nr, r.rolle, f.fall, f.erwartet,
        case when v_ok then 'gelungen: ' || coalesce(left(v_txt, 160), '(null)') else 'abgelehnt: ' || v_state || ' ' || left(v_msg, 160) end,
        v_urteil);
    end loop;
  end loop;
end
$pruef$;

select nr, rolle, fall, erwartet, ergebnis, urteil from pruef_0048
union all
select null, 'SUMME', count(*) || ' Fälle: ' || count(*) filter (where urteil = 'PASS') || ' PASS, '
       || count(*) filter (where urteil = 'FAIL') || ' FAIL', null, null, null from pruef_0048
order by nr nulls last;
