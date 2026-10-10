-- ============================================================================
-- Prüfung zu Migration 0059 (Nachschliff C4: status_abgelaufen).
-- Ändert nichts: jeder Fall läuft in einer Untertransaktion, die immer
-- zurückgerollt wird. Muster wie 0050_nachfrage_pruef.sql.
-- Empfänger ist das Nicht-Admin-Profil mit der Trainerrolle (im Fall
-- vergeben); der Admin hat keine Trainerrolle und bekommt nichts. Zwei
-- vorhandene Spieler bekommen im Fall einen abgelaufenen Status, alle
-- anderen gelten im Fall als fit. Der Erzeuger läuft mit festem p_jetzt.
-- ============================================================================

drop table if exists pg_temp.pruef_0059;
create temp table pruef_0059 (nr int, rolle text, fall text, erwartet text, ergebnis text, urteil text);

do $pruef$
declare
  v_admin  uuid;
  v_nutzer uuid;
  v_club   uuid;
  v_p1 uuid; v_n1 text; v_p2 uuid; v_n2 text;
  v_basis  text[];
  v_zwei   text;
  v_lauf   text;
  zaehl    text;
  v_nr int := 0; v_txt text; v_ok boolean; v_state text; v_msg text; v_urteil text; s text; i int;
  r record; f record;
begin
  select ur.user_id into v_admin from public.user_roles ur where ur.role = 'admin' limit 1;
  select club_id into v_club from public.profiles where id = v_admin;
  select p.id into v_nutzer from public.profiles p
   where not exists (select 1 from public.user_roles ur where ur.user_id = p.id and ur.role = 'admin') limit 1;
  select id, name into v_p1, v_n1 from public.players order by name limit 1;
  select id, name into v_p2, v_n2 from public.players order by name offset 1 limit 1;
  if v_admin is null or v_nutzer is null or v_p2 is null then raise exception 'Admin, freies Profil oder zwei Spieler fehlen.'; end if;

  v_basis := array[
    format('insert into public.user_roles (user_id, role, club_id) select %L, ''coach'', %L where not exists (select 1 from public.user_roles where user_id = %L and role = ''coach'')', v_nutzer, v_club, v_nutzer),
    format('delete from public.user_roles where user_id = %L and role = ''coach''', v_admin),
    format('insert into public.notification_prefs (profile_id) values (%L) on conflict (profile_id) do nothing', v_nutzer),
    format('update public.notification_prefs set status_abgelaufen = true, quiet_from = ''00:00'', quiet_to = ''00:00'' where profile_id = %L', v_nutzer),
    'update public.player_status set status = ''fit'', status_until = null where status <> ''fit''',
    format('insert into public.player_status (player_id, status, status_until) values (%L, ''verletzt'', date ''2026-10-10'') on conflict (player_id) do update set status = excluded.status, status_until = excluded.status_until', v_p1)];
  v_zwei := format('insert into public.player_status (player_id, status, status_until) values (%L, ''urlaub'', date ''2026-10-10'') on conflict (player_id) do update set status = excluded.status, status_until = excluded.status_until', v_p2);
  v_lauf := 'select public.notify_cron_status_abgelaufen(timestamp ''2026-10-11 09:00'' at time zone ''Europe/Berlin'')::text';
  zaehl  := format('select count(*)::text from public.notification_outbox where kategorie = ''status_abgelaufen'' and profile_id = %L', v_nutzer);

  for r in
    select * from (values
      (1, 'anon', null::text), (2, 'Spieler', null), (3, 'Trainer', 'coach'),
      (4, 'Kassenwart', 'treasurer'), (5, 'Admin', null), (6, 'intern', null)
    ) as t(ord, rolle, zusatzrolle) order by ord
  loop
    for f in
      select * from (values
        -- ---- 1) Rechte -----------------------------------------------------
        ('Erzeuger nicht aufrufbar (auch nicht als Trainer oder Admin)', null::text[], array[v_lauf], null::text[], null::text, 'verweigert', array['anon','Spieler','Trainer','Kassenwart','Admin']),
        ('Schalter status_abgelaufen über set_notification_prefs ausschalten', v_basis,
         array['select public.set_notification_prefs(''{"status_abgelaufen": false}''::jsonb)::text'], null,
         format('select status_abgelaufen::text from public.notification_prefs where profile_id = %L', v_nutzer), 'wert:false', array['Trainer']),
        ('authenticated darf genau 48 Funktionen (mit 0060 und 0061), keine notify_cron_*', null, null, null,
         'select count(*)::text || ''/'' || count(*) filter (where p.proname like ''notify\_cron\_%'')::text from pg_proc p where p.pronamespace = ''public''::regnamespace and has_function_privilege(''authenticated'', p.oid, ''execute'')',
         'wert:48/0', array['intern']),
        ('Vorlage, Rolle, Constraint, Schalter-Standard', null, null, null,
         'select (select titel_vorlage || '' / '' || urgency || '' / '' || ttl_regel || '' / '' || deep_link_vorlage from public.notification_templates where kategorie = ''status_abgelaufen'') || '' / '' || public.kategorie_rolle(''status_abgelaufen'') || '' / '' || (pg_get_constraintdef((select oid from pg_constraint where conname = ''notification_outbox_kat_chk'')) like ''%status_abgelaufen%'')::text || '' / '' || (select column_default from information_schema.columns where table_schema = ''public'' and table_name = ''notification_prefs'' and column_name = ''status_abgelaufen'')',
         'wert:📋 {kopf} / normal / fix / #ansicht=kader / coach / true / true', array['intern']),
        ('Cron stündlich zur vollen Stunde', null, null, null,
         'select schedule || '' / '' || command from cron.job where jobname = ''notify-status-ablauf'' and active',
         'wert:0 * * * * / select public.notify_cron_status_abgelaufen();', array['intern']),
        ('Admin ohne Trainerrolle darf die Kategorie nicht bekommen', v_basis, null, null,
         format('select public.kategorie_erlaubt(%L, ''status_abgelaufen'')::text || ''/'' || public.kategorie_erlaubt(%L, ''status_abgelaufen'')::text', v_admin, v_nutzer),
         'wert:false/true', array['intern']),

        -- ---- 2) Erzeuger ---------------------------------------------------
        ('vor 9 Uhr: nichts', v_basis, array['select public.notify_cron_status_abgelaufen(timestamp ''2026-10-11 08:59'' at time zone ''Europe/Berlin'')::text'], null, zaehl, 'wert:0', array['intern']),
        ('9 Uhr, ein Spieler: Titel, Text, Deep Link', v_basis, array[v_lauf], null,
         format('select count(*)::text || '' | '' || max(titel || '' | '' || text || '' | '' || deep_link || '' | '' || urgency) from public.notification_outbox where kategorie = ''status_abgelaufen'' and profile_id = %L', v_nutzer),
         format('wert:1 | 📋 %s wieder verfügbar | Verletzt, voraussichtlich bis 10.10. Der Status ist noch gesetzt, bitte im Kader prüfen. | #ansicht=kader | normal', v_n1), array['intern']),
        ('nur Trainer: der Admin bekommt keine Zeile', v_basis, array[v_lauf], null,
         format('select count(*)::text from public.notification_outbox where kategorie = ''status_abgelaufen'' and profile_id = %L', v_admin), 'wert:0', array['intern']),
        ('einmal je Ablauf: spätere Läufe am Tag reihen nichts nach', v_basis,
         array[v_lauf, 'select public.notify_cron_status_abgelaufen(timestamp ''2026-10-11 10:00'' at time zone ''Europe/Berlin'')::text', 'select public.notify_cron_status_abgelaufen(timestamp ''2026-10-11 22:00'' at time zone ''Europe/Berlin'')::text'], null,
         zaehl, 'wert:1', array['intern']),
        ('ausgefallener 9-Uhr-Lauf: der nächste holt nach', v_basis,
         array['select public.notify_cron_status_abgelaufen(timestamp ''2026-10-11 11:00'' at time zone ''Europe/Berlin'')::text'], null, zaehl, 'wert:1', array['intern']),
        ('zwei Spieler am selben Tag: eine Sammelmitteilung, Dedup je Trainer und Datum', v_basis || array[v_zwei], array[v_lauf], null,
         format('select count(*)::text || '' | '' || max(titel) || '' | '' || max(text) || '' | '' || max(dedup_key) from public.notification_outbox where kategorie = ''status_abgelaufen'' and profile_id = %L', v_nutzer),
         format('wert:1 | 📋 2 Spieler wieder verfügbar: %s, %s | Voraussichtlich bis 10.10.: %s (verletzt), %s (Urlaub). Der Status ist noch gesetzt, bitte im Kader prüfen. | status_abgelaufen:%s:2026-10-10', v_n1, v_n2, v_n1, v_n2, v_nutzer), array['intern']),
        ('angeschlagen zählt auch', v_basis || array[format('update public.player_status set status = ''angeschlagen'' where player_id = %L', v_p1)], array[v_lauf], null,
         format('select max(text) from public.notification_outbox where kategorie = ''status_abgelaufen'' and profile_id = %L', v_nutzer),
         'wert:Angeschlagen, voraussichtlich bis 10.10. Der Status ist noch gesetzt, bitte im Kader prüfen.', array['intern']),
        ('Status bleibt unverändert', v_basis, array[v_lauf], null,
         format('select status || ''/'' || status_until from public.player_status where player_id = %L', v_p1), 'wert:verletzt/2026-10-10', array['intern']),
        ('wieder fit: nichts', v_basis || array[format('update public.player_status set status = ''fit'' where player_id = %L', v_p1)], array[v_lauf], null, zaehl, 'wert:0', array['intern']),
        ('anderes Datum (übermorgen bis): nichts', v_basis || array[format('update public.player_status set status_until = date ''2026-10-11'' where player_id = %L', v_p1)], array[v_lauf], null, zaehl, 'wert:0', array['intern']),
        ('nichts rückwirkend: Ablauf vor dem Einspielen', v_basis || array[format('update public.player_status set status_until = date ''2026-10-07'' where player_id = %L', v_p1)],
         array['select public.notify_cron_status_abgelaufen(timestamp ''2026-10-08 09:00'' at time zone ''Europe/Berlin'')::text'], null, zaehl, 'wert:0', array['intern']),

        -- ---- 3) Zustellbarkeit über notification_due -----------------------
        ('Schalter an, keine Ruhezeit: fällig', v_basis, array[v_lauf], null,
         format('select count(*)::text from public.notification_due where kategorie = ''status_abgelaufen'' and profile_id = %L', v_nutzer), 'wert:1', array['intern']),
        ('Schalter aus: nicht fällig', v_basis, array[v_lauf], array[format('update public.notification_prefs set status_abgelaufen = false where profile_id = %L', v_nutzer)],
         format('select count(*)::text from public.notification_due where kategorie = ''status_abgelaufen'' and profile_id = %L', v_nutzer), 'wert:0', array['intern']),
        ('Ruhezeit: wartet (nicht fällig, nicht verworfen)', v_basis, array[v_lauf], array[format('update public.notification_prefs set quiet_from = ''00:00'', quiet_to = ''23:59'' where profile_id = %L', v_nutzer)],
         format('select (select count(*) from public.notification_due where kategorie = ''status_abgelaufen'' and profile_id = %L)::text || ''/'' || (select count(*) from public.notification_outbox where kategorie = ''status_abgelaufen'' and profile_id = %L and sent_at is null and error is null)::text', v_nutzer, v_nutzer),
         'wert:0/1', array['intern']),
        ('Trainerrolle entzogen: nicht fällig', v_basis, array[v_lauf], array[format('delete from public.user_roles where user_id = %L and role = ''coach''', v_nutzer)],
         format('select count(*)::text from public.notification_due where kategorie = ''status_abgelaufen'' and profile_id = %L', v_nutzer), 'wert:0', array['intern'])
      ) as t(fall, vor, aktion, nach, pruef, erwartet, rollen)
      where r.rolle = any(t.rollen)
    loop
      v_nr := v_nr + 1;
      v_ok := false; v_txt := null; v_state := null; v_msg := null;
      begin
        if r.zusatzrolle is not null then
          insert into public.user_roles (user_id, role, club_id) select v_nutzer, r.zusatzrolle, v_club
           where not exists (select 1 from public.user_roles where user_id = v_nutzer and role = r.zusatzrolle);
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
        raise exception using errcode = 'P0059', message = 'zurückrollen';
      exception when others then
        if sqlstate <> 'P0059' then v_state := sqlstate; v_msg := sqlerrm; end if;
      end;
      v_urteil := case
        when f.erwartet = 'verweigert' then case when not v_ok and v_state = '42501' then 'PASS' else 'FAIL' end
        when f.erwartet like 'wert:%' then case when v_ok and v_txt = substr(f.erwartet, 6) then 'PASS' else 'FAIL' end
      end;
      insert into pruef_0059 values (v_nr, r.rolle, f.fall, f.erwartet,
        case when v_ok then 'gelungen: ' || coalesce(left(v_txt, 200), '(null)') else 'abgelehnt: ' || v_state || ' ' || left(v_msg, 160) end,
        v_urteil);
    end loop;
  end loop;
end
$pruef$;

select nr, rolle, fall, erwartet, ergebnis, urteil from pruef_0059
union all
select null, 'SUMME', count(*) || ' Fälle: ' || count(*) filter (where urteil = 'PASS') || ' PASS, '
       || count(*) filter (where urteil = 'FAIL') || ' FAIL', null, null, null from pruef_0059
order by nr nulls last;
