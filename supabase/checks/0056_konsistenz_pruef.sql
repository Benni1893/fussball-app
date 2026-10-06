-- ============================================================================
-- Prüfung zu Migration 0056 (Konsistenz der Mitteilungen) und Konsistenzmatrix.
-- Ändert nichts; Muster wie 0050_nachfrage_pruef.sql ("fehler:<Text>").
-- Die Matrix-Fälle prüfen alle Kategorien gemeinsam (Vorlage, Rolle, Erzeuger,
-- Emoji, Deep Link, Dringlichkeit, Verfall, Texte, Platzhalter).
-- ============================================================================

drop table if exists pg_temp.pruef_0056;
create temp table pruef_0056 (nr int, rolle text, fall text, erwartet text, ergebnis text, urteil text);

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
    format('insert into public.players (id, club_id, code, name) values (%L, %L, %L, %L)', v_sp, v_club, 'pruef0056', 'Prüfspieler 0056'),
    format('update public.profiles set player_id = %L where id = %L', v_sp, v_nutzer),
    format('delete from public.player_status where player_id = %L', v_aspieler),
    format('delete from public.push_subscriptions where profile_id = %L', v_admin),
    format('insert into public.push_subscriptions (profile_id, endpoint, p256dh, auth) values (%L, ''https://pruef.invalid/0050'', ''x'', ''x'')', v_admin),
    format('update public.notification_prefs set rueckmeldung_erinnerung = true where profile_id = %L', v_admin)];
  v_coach := format('insert into public.user_roles (user_id, role, club_id) select %L, ''coach'', %L where not exists (select 1 from public.user_roles where user_id = %L and role = ''coach'')', v_nutzer, v_club, v_nutzer);
  v_zweiter := format('insert into public.players (id, club_id, code, name) values (%L, %L, %L, %L)', v_sp2, v_club, 'pruef0056b', 'Prüfspieler Zwei');
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
        -- ---- 1) Strafhinweis-Editor -----------------------------------------
        ('set_notification_strafhinweis: nur Admin', null::text[], array['select public.set_notification_strafhinweis(''x'')'], null::text[], null::text, 'verweigert', array['anon','Spieler','Trainer','Kassenwart']),
        ('Admin speichert den Strafhinweis', null, array['select public.set_notification_strafhinweis(''  Ohne Antwort kostet es 8 €.  '')'], null,
         'select beispiel_daten->>''strafhinweis'' from public.notification_templates where kategorie = ''rueckmeldung_erinnerung''',
         'wert:Ohne Antwort kostet es 8 €.', array['Admin']),
        ('leer: Fehler', null, array['select public.set_notification_strafhinweis(''   '')'], null, null, 'fehler:darf nicht leer', array['Admin']),
        ('länger als 80 Zeichen: Fehler', null, array['select public.set_notification_strafhinweis(repeat(''x'', 81))'], null, null, 'fehler:höchstens 80', array['Admin']),
        ('Platzhalter im Hinweis: Fehler', null, array['select public.set_notification_strafhinweis(''Achtung {datum}'')'], null, null, 'fehler:geschweiften', array['Admin']),
        ('der Versand nimmt den gespeicherten Hinweis (Termin mit Auto-Strafe)', v_basis || array[format('insert into public.events (id, club_id, type, title, date, time, status, quelle, auto_fine) select %L, %L, ''training'', ''Prüftermin'', (x at time zone ''Europe/Berlin'')::date, to_char(x at time zone ''Europe/Berlin'', ''HH24:MI''), ''geplant'', ''manuell'', true from (select date_trunc(''minute'', now() + interval ''26 hours'') as x) q', v_e1, v_club)],
         array['select public.set_notification_strafhinweis(''Ohne Antwort kostet es 8 €.'')'], array['select public.notify_cron_rueckmeldung()'],
         format('select (text like ''%%Uhr. Ohne Antwort kostet es 8 €.'')::text from public.notification_outbox where kategorie = ''rueckmeldung_erinnerung'' and profile_id = %L and dedup_key like %L', v_admin, 'erinnerung:' || v_e1 || ':%'),
         'wert:true', array['Admin']),

        -- ---- 2) unterbesetzung, termin_neu --------------------------------
        ('unterbesetzung (F4) ist aus', null, null, null,
         'select aktiv::text from public.notification_templates where kategorie = ''unterbesetzung''', 'wert:false', array['intern']),
        ('termin_neu verfällt mit dem letzten genannten Termin', v_basis,
         array[format('insert into public.events (id, club_id, type, title, date, time, status, quelle, auto_fine) select %L, %L, ''training'', ''Prüftermin'', (x at time zone ''Europe/Berlin'')::date, to_char(x at time zone ''Europe/Berlin'', ''HH24:MI''), ''geplant'', ''manuell'', false from (select date_trunc(''minute'', now() + interval ''50 hours'') as x) q', v_e1, v_club), format('insert into public.events (club_id, type, title, date, time, status, quelle, auto_fine) values (%L, ''training'', ''Prüftermin'', current_date + 9, ''19:00'', ''geplant'', ''manuell'', false)', v_club)],
         array['update public.notification_sammler set faellig_ab = now() - interval ''1 second'' where erstellt_at >= now()', 'select public.notify_flush_termin_neu()'],
         format('select (count(*) = 1 and bool_and(gueltig_bis = (((current_date + 9)::date + time ''19:00'') at time zone ''Europe/Berlin'')))::text from public.notification_outbox where kategorie = ''termin_neu'' and profile_id = %L and created_at >= now()', v_admin),
         'wert:true', array['Trainer']),

        -- ---- 3) Konsistenzmatrix ------------------------------------------
        ('jede Kategorie (außer test) hat eine Rolle', null, null, null,
         'select count(*)::text from public.notification_templates where kategorie <> ''test'' and public.kategorie_rolle(kategorie) is null', 'wert:0', array['intern']),
        ('aktive Kategorien = die zwölf mit Erzeuger plus test', null, null, null,
         'select string_agg(kategorie, '','' order by kategorie) from public.notification_templates where aktiv',
         'wert:absage_kurzfristig,meldeschluss_uebersicht,rueckmeldung_erinnerung,rueckmeldung_nachfrage,strafe_neu,strafen_offen,termin_abgesagt,termin_geaendert,termin_neu,test,zahlung_abgelehnt,zahlung_bestaetigt,zahlung_gemeldet', array['intern']),
        ('jeder Erzeuger ist da (Trigger, Cron, Zusammenfassungen, RPC)', null, null, null,
         'select ((select count(*) from pg_trigger where tgname in (''trg_fines_notify'', ''trg_events_notify'', ''trg_rsvps_notify'') and tgenabled = ''O'') || ''/'' || (select count(*) from cron.job where jobname in (''notify-sammler'', ''notify-rueckmeldung'', ''notify-strafen-offen'', ''push-dispatch'') and active) || ''/'' || (select count(*) from pg_proc where pronamespace = ''public''::regnamespace and proname in (''notify_flush_strafe_neu'', ''notify_flush_zahlung_gemeldet'', ''notify_flush_zahlung_bestaetigt'', ''notify_flush_zahlung_abgelehnt'', ''notify_flush_termin_neu'', ''notify_flush_termin_geaendert'', ''notify_flush_termin_abgesagt'', ''notify_flush_absage_kurzfristig'', ''notify_cron_rueckmeldung'', ''notify_cron_strafen_offen'', ''send_rsvp_reminder''))) ',
         'wert:3/4/11', array['intern']),
        ('Titel-Emoji je Kategorie wie in conventions.md', null, null, null,
         'select count(*)::text from public.notification_templates t join (values (''strafe_neu'',''💸''),(''strafen_offen'',''💸''),(''zahlung_gemeldet'',''💰''),(''zahlung_bestaetigt'',''✅''),(''zahlung_abgelehnt'',''⚠️''),(''termin_neu'',''📅''),(''termin_geaendert'',''📅''),(''termin_abgesagt'',''❌''),(''rueckmeldung_erinnerung'',''⏳''),(''rueckmeldung_nachfrage'',''⏳''),(''absage_kurzfristig'',''🚨''),(''unterbesetzung'',''🚨''),(''meldeschluss_uebersicht'',''📋''),(''test'',''🔔'')) e(k, z) on e.k = t.kategorie where t.titel_vorlage not like e.z || '' %''',
         'wert:0', array['intern']),
        ('Deep Links nur auf bekannte Ziele', null, null, null,
         'select count(*)::text from public.notification_templates where deep_link_vorlage !~ ''^#(termin=\{termin_id\}|strafen=meine|kasse=pruefen|ansicht=kalender|ein=mitteilungen)$''',
         'wert:0', array['intern']),
        ('zeitkritisch = die Arten im Ruhezeiten-Hinweis (+ unterbesetzung, aus)', null, null, null,
         'select string_agg(kategorie, '','' order by kategorie) from public.notification_templates where urgency = ''high''',
         'wert:absage_kurzfristig,rueckmeldung_erinnerung,termin_abgesagt,termin_geaendert,unterbesetzung', array['intern']),
        ('zeitgebundene Kategorien verfallen (bis_zeitpunkt)', null, null, null,
         'select string_agg(kategorie, '','' order by kategorie) from public.notification_templates where ttl_regel = ''bis_zeitpunkt''',
         'wert:absage_kurzfristig,meldeschluss_uebersicht,rueckmeldung_erinnerung,rueckmeldung_nachfrage,termin_abgesagt,termin_geaendert,termin_neu,unterbesetzung', array['intern']),
        ('Texte ohne Gedankenstrich und ohne ASCII-Umlaute', null, null, null,
         'select count(*)::text from public.notification_templates where (titel_vorlage || '' '' || text_vorlage || '' '' || coalesce(empfaenger_beschreibung, '''') || '' '' || coalesce(ausloeser_beschreibung, '''') || '' '' || beispiel_daten::text) ~ ''(–|—| - |\m(fuer|ueber|Geraet|koennen|duerfen|muessen|Rueckmeldung|zurueck|faellt|bestaetigt|pruefen)\M)''',
         'wert:0', array['intern']),
        ('jede Vorlage rendert mit ihren Beispieldaten (kein {…} im Versand)', null, null, null,
         'select count(*)::text || ''/'' || (select count(*) from public.notification_templates)::text from public.notification_templates where public.render_vorlage(titel_vorlage, beispiel_daten, platzhalter, platzhalter_optional) !~ ''[{}]'' and public.render_vorlage(text_vorlage, beispiel_daten, platzhalter, platzhalter_optional) !~ ''[{}]''',
         'wert:14/14', array['intern']),
        ('keine Outbox-Zeile ist je an einem Platzhalter gescheitert', null, null, null,
         'select count(*)::text from public.notification_outbox where error like ''Kein Wert%%'' or error like ''Unbekannter Platzhalter%%''', 'wert:0', array['intern'])
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
        raise exception using errcode = 'P0056', message = 'zurückrollen';
      exception when others then
        if sqlstate <> 'P0056' then v_state := sqlstate; v_msg := sqlerrm; end if;
      end;
      v_urteil := case
        when f.erwartet = 'verweigert' then case when not v_ok and v_state = '42501' then 'PASS' else 'FAIL' end
        when f.erwartet = 'ok' then case when v_ok then 'PASS' else 'FAIL' end
        when f.erwartet like 'wert:%' then case when v_ok and v_txt = substr(f.erwartet, 6) then 'PASS' else 'FAIL' end
        when f.erwartet like 'fehler:%' then case when not v_ok and v_state <> '42501' and v_msg like '%' || substr(f.erwartet, 8) || '%' then 'PASS' else 'FAIL' end
      end;
      insert into pruef_0056 values (v_nr, r.rolle, f.fall, f.erwartet,
        case when v_ok then 'gelungen: ' || coalesce(left(v_txt, 160), '(null)') else 'abgelehnt: ' || v_state || ' ' || left(v_msg, 160) end,
        v_urteil);
    end loop;
  end loop;
end
$pruef$;

select nr, rolle, fall, erwartet, ergebnis, urteil from pruef_0056
union all
select null, 'SUMME', count(*) || ' Fälle: ' || count(*) filter (where urteil = 'PASS') || ' PASS, '
       || count(*) filter (where urteil = 'FAIL') || ' FAIL', null, null, null from pruef_0056
order by nr nulls last;
