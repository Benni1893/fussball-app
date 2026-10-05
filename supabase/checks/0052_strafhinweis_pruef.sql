-- ============================================================================
-- Prüfung zu Migration 0052 (Strafhinweis nur bei Terminen mit Auto-Strafe).
-- Ändert nichts; Muster wie 0048_rueckmeldung_pruef.sql, dazu "fehler:<Text>".
-- ============================================================================

drop table if exists pg_temp.pruef_0052;
create temp table pruef_0052 (nr int, rolle text, fall text, erwartet text, ergebnis text, urteil text);

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
    format('insert into public.players (id, club_id, code, name) values (%L, %L, %L, %L)', v_sp, v_club, 'pruef0052', 'Prüfspieler 0052'),
    format('update public.profiles set player_id = %L where id = %L', v_sp, v_nutzer),
    format('delete from public.player_status where player_id = %L', v_aspieler)];
  v_coach := format('insert into public.user_roles (user_id, role, club_id) select %L, ''coach'', %L where not exists (select 1 from public.user_roles where user_id = %L and role = ''coach'')', v_nutzer, v_club, v_nutzer);
  v_zweiter := format('insert into public.players (id, club_id, code, name) values (%L, %L, %L, %L)', v_sp2, v_club, 'pruef0052b', 'Prüfspieler Zwei');
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
        -- ---- Rechte und Vorlage --------------------------------------------
        ('notify_cron_rueckmeldung', null::text[], array['select public.notify_cron_rueckmeldung()::text'], null::text[], null::text, 'verweigert', AUSSEN),
        ('Vorlage: {strafhinweis} optional, im Text, Beispielwert', null, null, null,
         'select text_vorlage || '' | '' || (''strafhinweis'' = any(platzhalter))::text || '' | '' || array_to_string(platzhalter_optional, '','') || '' | '' || (beispiel_daten->>''strafhinweis'') from public.notification_templates where kategorie = ''rueckmeldung_erinnerung''',
         'wert:{datum} {uhrzeit} · Meldeschluss {meldeschluss}. {strafhinweis} | true | strafhinweis | Ohne Antwort wird''s teuer.', array['intern']),
        ('Vorschau mit Beispieldaten zeigt den Hinweis', null, null, null,
         'select public.render_vorlage(text_vorlage, beispiel_daten, platzhalter, platzhalter_optional) from public.notification_templates where kategorie = ''rueckmeldung_erinnerung''',
         'wert:20.09. 12:30 Uhr · Meldeschluss morgen 12:30 Uhr. Ohne Antwort wird''s teuer.', array['intern']),

        -- ---- Versand ------------------------------------------------------
        ('Termin mit Auto-Strafe: mit Hinweis', v_basis || array[format('insert into public.events (id, club_id, type, title, date, time, status, quelle, auto_fine) select %L, %L, ''training'', ''Prüftermin'', (x at time zone ''Europe/Berlin'')::date, to_char(x at time zone ''Europe/Berlin'', ''HH24:MI''), ''geplant'', ''manuell'', true from (select date_trunc(''minute'', now() + interval ''26 hours'') as x) q', v_e1, v_club)],
         null, array['select public.notify_cron_rueckmeldung()'], format('select o.text = public.notify_datum_kurz(e.date) || '' '' || public.notify_uhrzeit(e.time) || '' · Meldeschluss '' || public.notify_meldeschluss_text(e.deadline_at) || ''. Ohne Antwort wird''''s teuer.'' from public.notification_outbox o join public.events e on e.id = %L where o.kategorie = ''rueckmeldung_erinnerung'' and o.profile_id = %L and o.dedup_key like %L', v_e1, v_admin, 'erinnerung:' || v_e1 || ':%'), 'wert:true', array['intern']),
        ('Termin ohne Auto-Strafe (z. B. BFV): ohne Hinweis, ohne Leerzeichen am Ende', v_basis || array[format('insert into public.events (id, club_id, type, title, date, time, status, quelle, auto_fine) select %L, %L, ''training'', ''Prüftermin'', (x at time zone ''Europe/Berlin'')::date, to_char(x at time zone ''Europe/Berlin'', ''HH24:MI''), ''geplant'', ''manuell'', false from (select date_trunc(''minute'', now() + interval ''26 hours'') as x) q', v_e1, v_club)],
         null, array['select public.notify_cron_rueckmeldung()'], format('select o.text = public.notify_datum_kurz(e.date) || '' '' || public.notify_uhrzeit(e.time) || '' · Meldeschluss '' || public.notify_meldeschluss_text(e.deadline_at) || ''.'' from public.notification_outbox o join public.events e on e.id = %L where o.kategorie = ''rueckmeldung_erinnerung'' and o.profile_id = %L and o.dedup_key like %L', v_e1, v_admin, 'erinnerung:' || v_e1 || ':%'), 'wert:true', array['intern']),
        ('BFV-Spiel (auto_fine = false wie im Bestand): ohne Hinweis',
         v_basis || array[format('insert into public.events (id, club_id, type, title, date, time, status, quelle, auto_fine) select %L, %L, ''training'', ''Prüftermin'', (x at time zone ''Europe/Berlin'')::date, to_char(x at time zone ''Europe/Berlin'', ''HH24:MI''), ''geplant'', ''manuell'', false from (select date_trunc(''minute'', now() + interval ''47 hours'') as x) q', v_e1, v_club), format('update public.events set type = ''spiel'', quelle = ''bfv'', opponent = ''Prüfgegner'', bfv_uid = ''pruef0052'' where id = %L', v_e1)],
         null, array['select public.notify_cron_rueckmeldung()'],
         format('select (count(*) = 1 and bool_and(text not like ''%%teuer%%''))::text from public.notification_outbox where kategorie = ''rueckmeldung_erinnerung'' and profile_id = %L and dedup_key like %L', v_admin, 'erinnerung:' || v_e1 || ':%'),
         'wert:true', array['intern']),
        ('Admin kann {strafhinweis} im Text verschieben (Push-Texte)', null,
         array['select public.set_notification_template(''rueckmeldung_erinnerung'', ''⏳ Bist du dabei? {termin_titel}'', ''{strafhinweis} {datum} {uhrzeit} · Meldeschluss {meldeschluss}.'', true)::text'],
         null, 'select text_vorlage from public.notification_templates where kategorie = ''rueckmeldung_erinnerung''',
         'wert:{strafhinweis} {datum} {uhrzeit} · Meldeschluss {meldeschluss}.', array['Admin']),
        ('Admin kann den Hinweis ganz weglassen', null,
         array['select public.set_notification_template(''rueckmeldung_erinnerung'', ''⏳ Bist du dabei? {termin_titel}'', ''{datum} {uhrzeit} · Meldeschluss {meldeschluss}.'', true)::text'],
         null, null, 'ok', array['Admin']),
        ('Spieler darf Push-Texte nicht ändern', null,
         array['select public.set_notification_template(''rueckmeldung_erinnerung'', ''x'', ''{strafhinweis}'', true)::text'],
         null, null, 'fehler:Nur Admin', array['Spieler'])
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
        raise exception using errcode = 'P0052', message = 'zurückrollen';
      exception when others then
        if sqlstate <> 'P0052' then v_state := sqlstate; v_msg := sqlerrm; end if;
      end;
      v_urteil := case
        when f.erwartet = 'verweigert' then case when not v_ok and v_state = '42501' then 'PASS' else 'FAIL' end
        when f.erwartet = 'ok' then case when v_ok then 'PASS' else 'FAIL' end
        when f.erwartet like 'wert:%' then case when v_ok and v_txt = substr(f.erwartet, 6) then 'PASS' else 'FAIL' end
        when f.erwartet like 'fehler:%' then case when not v_ok and v_msg like '%' || substr(f.erwartet, 8) || '%' then 'PASS' else 'FAIL' end
      end;
      insert into pruef_0052 values (v_nr, r.rolle, f.fall, f.erwartet,
        case when v_ok then 'gelungen: ' || coalesce(left(v_txt, 160), '(null)') else 'abgelehnt: ' || v_state || ' ' || left(v_msg, 160) end,
        v_urteil);
    end loop;
  end loop;
end
$pruef$;

select nr, rolle, fall, erwartet, ergebnis, urteil from pruef_0052
union all
select null, 'SUMME', count(*) || ' Fälle: ' || count(*) filter (where urteil = 'PASS') || ' PASS, '
       || count(*) filter (where urteil = 'FAIL') || ' FAIL', null, null, null from pruef_0052
order by nr nulls last;
