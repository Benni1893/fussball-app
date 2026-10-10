-- ============================================================================
-- Prüfung zu Migration 0051 (Textkorrekturen). Ändert nichts; Muster wie
-- 0050_nachfrage_pruef.sql. Die Meldungen werden über echte Aufrufe als die
-- jeweilige Rolle ausgelöst.
-- ============================================================================

drop table if exists pg_temp.pruef_0051;
create temp table pruef_0051 (nr int, rolle text, fall text, erwartet text, ergebnis text, urteil text);

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
    format('insert into public.players (id, club_id, code, name) values (%L, %L, %L, %L)', v_sp, v_club, 'pruef0051', 'Prüfspieler 0051'),
    format('update public.profiles set player_id = %L where id = %L', v_sp, v_nutzer),
    format('delete from public.player_status where player_id = %L', v_aspieler),
    format('delete from public.push_subscriptions where profile_id = %L', v_admin),
    format('insert into public.push_subscriptions (profile_id, endpoint, p256dh, auth) values (%L, ''https://pruef.invalid/0050'', ''x'', ''x'')', v_admin),
    format('update public.notification_prefs set rueckmeldung_erinnerung = true where profile_id = %L', v_admin)];
  v_coach := format('insert into public.user_roles (user_id, role, club_id) select %L, ''coach'', %L where not exists (select 1 from public.user_roles where user_id = %L and role = ''coach'')', v_nutzer, v_club, v_nutzer);
  v_zweiter := format('insert into public.players (id, club_id, code, name) values (%L, %L, %L, %L)', v_sp2, v_club, 'pruef0051b', 'Prüfspieler Zwei');
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
        -- ---- Meldungen über echte Aufrufe ----------------------------------
        ('Testnachricht ohne Gerät', v_basis || array[format('delete from public.push_subscriptions where profile_id = %L', v_admin)],
         array['select public.send_test_notification()::text'], null::text[], null::text, 'fehler:Für dieses Konto ist noch kein Gerät angemeldet.', array['Admin']),
        ('Vorschau ohne Gerät', v_basis || array[format('delete from public.push_subscriptions where profile_id = %L', v_admin)],
         array['select public.send_preview_notification(''strafe_neu'')::text'], null, null, 'fehler:Für dieses Konto ist noch kein Gerät angemeldet.', array['Admin']),
        ('Push-Text leer', null, array['select public.set_notification_template(''strafe_neu'', '''', '''', true)::text'], null, null, 'fehler:Titel und Text dürfen nicht leer sein.', array['Admin']),
        ('Gerät anmelden mit leeren Daten', null, array['select public.upsert_push_subscription('''', '''', '''', null, null)::text'], null, null, 'fehler:Unvollständige Anmeldedaten.', array['Spieler']),
        ('iCal-URL als Spieler', null, array['select public.set_ical_url(''https://example.invalid/x.ics'')::text'], null, null, 'verweigert', array['Spieler']),   -- seit 0061 nur Trainer und Admin (42501)
        -- direkt aufrufen: ungenutzt würde der Planer die IMMUTABLE-Funktion weglassen
        ('Vorlage ohne Wert', null, array['select public.render_vorlage(''{a}'', ''{}''::jsonb, array[''a''])'], null, null,
         'fehler:Kein Wert für {a}.', array['intern']),
        ('Vorschau als Spieler über notify_enqueue: kein Recht', null,
         array[format('select public.notify_enqueue(%L, ''test'', ''{}''::jsonb, p_vorschau => true)::text', v_admin)], null, null, 'verweigert', array['Spieler']),
        ('Beschreibungen ohne Gedankenstrich, A10', null, null, null,
         'select (select ausloeser_beschreibung from public.notification_templates where kategorie = ''strafe_neu'') || '' / '' || (select ausloeser_beschreibung from public.notification_templates where kategorie = ''strafen_offen'')',
         'wert:Eine Strafe wird verhängt, von Hand oder automatisch zum Anpfiff. / Höchstens einmal im Monat.', array['intern']),
        ('keine ASCII-Ersatzschreibung mehr in den sieben Meldungen', null, null, null,
         'select count(*)::text from pg_proc p where p.oid in (''public.send_test_notification()''::regprocedure, ''public.send_preview_notification(text)''::regprocedure, ''public.set_notification_template(text,text,text,boolean)''::regprocedure, ''public.render_vorlage(text,jsonb,text[],text[])''::regprocedure, ''public.upsert_push_subscription(text,text,text,text,text)''::regprocedure, ''public.set_ical_url(text)''::regprocedure, ''public.notify_enqueue(uuid,text,jsonb,text,text,text,timestamptz,timestamptz,boolean)''::regprocedure) and pg_get_functiondef(p.oid) ~ ''(Fuer dieses|Geraet angemeldet|duerfen|Kein Wert fuer|Unvollstaendige|Vorschau nur fuer)''',
         'wert:0', array['intern']),
        ('Rechte: Einstellungsfunktionen weiter für authenticated, notify_enqueue nicht', null, null, null,
         'select (has_function_privilege(''authenticated'', ''public.send_test_notification()'', ''execute'') and has_function_privilege(''authenticated'', ''public.set_notification_template(text,text,text,boolean)'', ''execute'') and has_function_privilege(''authenticated'', ''public.upsert_push_subscription(text,text,text,text,text)'', ''execute'') and has_function_privilege(''authenticated'', ''public.set_ical_url(text)'', ''execute'') and not has_function_privilege(''authenticated'', ''public.notify_enqueue(uuid,text,jsonb,text,text,text,timestamptz,timestamptz,boolean)'', ''execute'') and not has_function_privilege(''anon'', ''public.render_vorlage(text,jsonb,text[],text[])'', ''execute''))::text',
         'wert:true', array['intern'])
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
        raise exception using errcode = 'P0051', message = 'zurückrollen';
      exception when others then
        if sqlstate <> 'P0051' then v_state := sqlstate; v_msg := sqlerrm; end if;
      end;
      v_urteil := case
        when f.erwartet = 'verweigert' then case when not v_ok and v_state = '42501' then 'PASS' else 'FAIL' end
        when f.erwartet = 'ok' then case when v_ok then 'PASS' else 'FAIL' end
        when f.erwartet like 'wert:%' then case when v_ok and v_txt = substr(f.erwartet, 6) then 'PASS' else 'FAIL' end
        when f.erwartet like 'fehler:%' then case when not v_ok and v_state <> '42501' and v_msg like '%' || substr(f.erwartet, 8) || '%' then 'PASS' else 'FAIL' end
      end;
      insert into pruef_0051 values (v_nr, r.rolle, f.fall, f.erwartet,
        case when v_ok then 'gelungen: ' || coalesce(left(v_txt, 160), '(null)') else 'abgelehnt: ' || v_state || ' ' || left(v_msg, 160) end,
        v_urteil);
    end loop;
  end loop;
end
$pruef$;

select nr, rolle, fall, erwartet, ergebnis, urteil from pruef_0051
union all
select null, 'SUMME', count(*) || ' Fälle: ' || count(*) filter (where urteil = 'PASS') || ' PASS, '
       || count(*) filter (where urteil = 'FAIL') || ' FAIL', null, null, null from pruef_0051
order by nr nulls last;
