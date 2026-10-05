-- ============================================================================
-- Prüfung zu Migration 0053 (gelöschter künftiger Termin = Absage-Nachricht),
-- seit 0054/0055 über den Sammler (Fälle mit Zusammenfassen).
-- Ändert nichts; Muster wie 0046_termine_pruef.sql. Der Trainer (Nicht-Admin,
-- mit Prüfspieler verknüpft) löscht, der Admin empfängt.
-- ============================================================================

drop table if exists pg_temp.pruef_0053;
create temp table pruef_0053 (nr int, rolle text, fall text, erwartet text, ergebnis text, urteil text);

do $pruef$
declare
  v_admin    uuid;
  v_aspieler uuid;
  v_nutzer   uuid;
  v_club     uuid;
  v_sp       uuid := gen_random_uuid();
  v_e1       uuid := gen_random_uuid();
  v_e2       uuid := gen_random_uuid();
  v_e3       uuid := gen_random_uuid();
  v_serie    uuid := gen_random_uuid();
  d1 date := current_date + 40;  d2 date := current_date + 47;  d3 date := current_date + 54;
  k1 text; k2 text; k3 text; l1 text;
  v_basis    text[];
  v_termin   text;   -- ein Termin, dessen Neu-Meldung schon raus ist
  v_serie3   text;   -- drei Serientermine, Neu-Meldung raus
  v_faellig  text;
  v_feed     jsonb;
  v_feed_neu jsonb;
  v_feed_ohne jsonb;
  v_bfv_ziel uuid;
  v_nr int := 0; v_txt text; v_ok boolean; v_state text; v_msg text; v_urteil text; s text; i int;
  AUSSEN constant text[] := array['anon','Spieler','Trainer','Kassenwart','Admin'];
  r record; f record;
begin
  select ur.user_id into v_admin from public.user_roles ur
    join public.profiles p on p.id = ur.user_id and p.player_id is not null where ur.role = 'admin' limit 1;
  select player_id into v_aspieler from public.profiles where id = v_admin;
  select club_id into v_club from public.players where id = v_aspieler;
  select p.id into v_nutzer from public.profiles p where p.player_id is null
     and not exists (select 1 from public.user_roles ur where ur.user_id = p.id and ur.role = 'admin') limit 1;
  if v_admin is null or v_nutzer is null then raise exception 'Admin mit Spieler oder freies Profil fehlt.'; end if;
  k1 := public.notify_datum_kurz(d1); k2 := public.notify_datum_kurz(d2); k3 := public.notify_datum_kurz(d3);
  l1 := public.notify_datum_lang(d1);

  v_basis := array[
    format('insert into public.players (id, club_id, code, name) values (%L, %L, %L, %L)', v_sp, v_club, 'pruef0053', 'Prüfspieler 0053'),
    format('update public.profiles set player_id = %L where id = %L', v_sp, v_nutzer),
    -- der Admin-Spieler ist in den Fällen fit
    format('delete from public.player_status where player_id = %L', v_aspieler)];
  v_termin := format('insert into public.events (id, club_id, type, title, date, time, status, quelle) values (%L, %L, ''training'', ''Prüftermin'', %L, ''19:00'', ''geplant'', ''manuell'')', v_e1, v_club, d1);
  v_serie3 := format('insert into public.events (id, club_id, type, title, date, time, status, quelle, serie_id) values (%L, %L, ''training'', ''Prüftermin'', %L, ''19:00'', ''geplant'', ''manuell'', %L), (%L, %L, ''training'', ''Prüftermin'', %L, ''19:00'', ''geplant'', ''manuell'', %L), (%L, %L, ''training'', ''Prüftermin'', %L, ''19:00'', ''geplant'', ''manuell'', %L)',
                     v_e1, v_club, d1, v_serie, v_e2, v_club, d2, v_serie, v_e3, v_club, d3, v_serie);
  -- "Neu-Meldung schon raus": die gesammelten Neu-Einträge wegräumen
  v_faellig := 'update public.notification_sammler set faellig_ab = now() - interval ''1 second'' where erstellt_at >= now()';

  -- BFV-Feed aus dem Bestand (alle künftigen Spiele), dazu eine neue UID bzw. ohne das erste
  select jsonb_agg(jsonb_build_object('bfv_uid', e.bfv_uid, 'gegner', e.opponent, 'heim', e.home,
           'wettbewerb', e.wettbewerb, 'liga', e.liga, 'date', e.date::text, 'time', e.time,
           'spielstaette', e.spielstaette, 'adresse', e.adresse, 'location_raw', e.location_raw) order by e.starts_at)
    into v_feed from public.events e where e.quelle = 'bfv' and e.starts_at > now();
  select id into v_bfv_ziel from public.events where quelle = 'bfv' and status = 'geplant' and starts_at > now() order by starts_at limit 1;
  v_feed_neu := v_feed || jsonb_build_array(jsonb_build_object('bfv_uid', 'pruef0053-neu', 'gegner', 'Prüfverein', 'heim', true,
           'wettbewerb', 'Freundschaftsspiele', 'liga', '', 'date', d1::text, 'time', '15:00',
           'spielstaette', 'Prüfplatz', 'adresse', 'Prüfweg 1', 'location_raw', 'Prüfplatz, Prüfweg 1'));
  select jsonb_agg(x) into v_feed_ohne from jsonb_array_elements(v_feed) x
   where x->>'bfv_uid' <> (select bfv_uid from public.events where id = v_bfv_ziel);

  for r in
    select * from (values
      (1, 'anon', null::text), (2, 'Spieler', null), (3, 'Trainer', 'coach'),
      (4, 'Kassenwart', 'treasurer'), (5, 'Admin', null), (6, 'service_role', null), (7, 'intern', null)
    ) as t(ord, rolle, zusatzrolle) order by ord
  loop
    for f in
      select * from (values
        -- ---- Rechte --------------------------------------------------------
        ('keine notify_*-Funktion für anon/authenticated', null::text[], null::text[], null::text[],
         'select count(*)::text from pg_proc p where p.pronamespace = ''public''::regnamespace and p.proname like ''notify\_%'' and p.proname <> ''notify_enqueue'' and (has_function_privilege(''anon'', p.oid, ''execute'') or has_function_privilege(''authenticated'', p.oid, ''execute''))',
         'wert:0', array['intern']),

        -- ---- Löschen ------------------------------------------------------
        ('künftiger Termin gelöscht: Absage an Admin, Text, dringend, gültig bis zum geplanten Beginn', v_basis || array[v_termin, 'delete from public.notification_sammler where erstellt_at >= now()'],
         array[format('delete from public.events where id = %L', v_e1)], array[v_faellig, 'select public.notify_flush_termin_abgesagt()'],
         format('select count(*)::text || '' | '' || max(titel || '' | '' || text || '' | '' || deep_link) || '' | '' || bool_and(urgency = ''high'' and gueltig_bis = ((%L::date + time ''19:00'') at time zone ''Europe/Berlin''))::text from public.notification_outbox where kategorie = ''termin_abgesagt'' and profile_id = %L and created_at >= now()', d1, v_admin),
         format('wert:1 | ❌ Prüftermin fällt aus | %s 19:00 Uhr. | #ansicht=kalender | true', l1), array['Trainer']),
        ('Trainer löscht: bekommt selbst nichts (F1)', v_basis || array[v_termin, 'delete from public.notification_sammler where erstellt_at >= now()'],
         array[format('delete from public.events where id = %L', v_e1)], array[v_faellig, 'select public.notify_flush_termin_abgesagt()'], format('select count(*)::text from public.notification_outbox where kategorie = ''termin_abgesagt'' and profile_id = %L and created_at >= now()', v_nutzer), 'wert:0', array['Trainer']),
        ('mit Rückmeldungen gelöscht: Empfänger trotzdem alle, Rückmeldungen weg (Cascade)',
         v_basis || array[v_termin, 'delete from public.notification_sammler where erstellt_at >= now()',
           format('insert into public.rsvps (club_id, event_id, player_id, status) values (%L, %L, %L, ''zu''), (%L, %L, %L, ''ab'')', v_club, v_e1, v_aspieler, v_club, v_e1, v_sp)],
         array[format('delete from public.events where id = %L', v_e1)], array[v_faellig, 'select public.notify_flush_termin_abgesagt()'],
         format('select (select count(*) from public.notification_outbox where kategorie = ''termin_abgesagt'' and profile_id = %L and created_at >= now())::text || ''/'' || (select count(*) from public.rsvps where event_id = %L)::text', v_admin, v_e1),
         'wert:1/0', array['Trainer']),
        ('Urlaub am Termintag: nichts',
         v_basis || array[v_termin, 'delete from public.notification_sammler where erstellt_at >= now()', format('insert into public.player_status (player_id, status, status_until) values (%L, ''urlaub'', %L)', v_aspieler, d1)],
         array[format('delete from public.events where id = %L', v_e1)], array[v_faellig, 'select public.notify_flush_termin_abgesagt()'], format('select count(*)::text from public.notification_outbox where kategorie = ''termin_abgesagt'' and profile_id = %L and created_at >= now()', v_admin), 'wert:0', array['Trainer']),
        ('vergangener Termin gelöscht: still',
         v_basis || array[format('insert into public.events (id, club_id, type, title, date, time, status, quelle) values (%L, %L, ''training'', ''Prüftermin'', current_date - 2, ''19:00'', ''geplant'', ''manuell'')', v_e1, v_club)],
         array[format('delete from public.events where id = %L', v_e1)], array[v_faellig, 'select public.notify_flush_termin_abgesagt()'], format('select count(*)::text from public.notification_outbox where kategorie = ''termin_abgesagt'' and profile_id = %L and created_at >= now()', v_admin), 'wert:0', array['Trainer']),
        ('schon abgesagt, dann gelöscht: genau eine Nachricht (0055)', v_basis || array[v_termin, 'delete from public.notification_sammler where erstellt_at >= now()'],
         array[format('update public.events set status = ''abgesagt'' where id = %L', v_e1), format('delete from public.events where id = %L', v_e1)], array[v_faellig, 'select public.notify_flush_termin_abgesagt()'], format('select count(*)::text from public.notification_outbox where kategorie = ''termin_abgesagt'' and profile_id = %L and created_at >= now()', v_admin), 'wert:1', array['Trainer']),
        ('Neu-Meldung steht noch aus: still (T9)', v_basis,
         array[v_termin, format('delete from public.events where id = %L', v_e1)], array[v_faellig, 'select public.notify_flush_termin_abgesagt()'],
         'select (select count(*) from public.notification_sammler where erstellt_at >= now())::text || ''/'' || (select count(*) from public.notification_outbox where created_at >= now())::text',
         'wert:0/0', array['Trainer']),
        ('Spiel gelöscht: Titel ist der Gegner', v_basis || array[v_termin, 'delete from public.notification_sammler where erstellt_at >= now()', format('update public.events set type = ''spiel'', opponent = ''Prüfgegner'' where id = %L', v_e1)],
         array[format('delete from public.events where id = %L', v_e1)], array[v_faellig, 'select public.notify_flush_termin_abgesagt()'],
         format('select max(titel) from public.notification_outbox where kategorie = ''termin_abgesagt'' and profile_id = %L and created_at >= now()', v_admin),
         'wert:❌ Prüfgegner fällt aus', array['Trainer'])
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
        raise exception using errcode = 'P0053', message = 'zurückrollen';
      exception when others then
        if sqlstate <> 'P0053' then v_state := sqlstate; v_msg := sqlerrm; end if;
      end;
      v_urteil := case
        when f.erwartet = 'verweigert' then case when not v_ok and v_state = '42501' then 'PASS' else 'FAIL' end
        when f.erwartet = 'ok' then case when v_ok then 'PASS' else 'FAIL' end
        when f.erwartet like 'wert:%' then case when v_ok and v_txt = substr(f.erwartet, 6) then 'PASS' else 'FAIL' end
      end;
      insert into pruef_0053 values (v_nr, r.rolle, f.fall, f.erwartet,
        case when v_ok then 'gelungen: ' || coalesce(left(v_txt, 160), '(null)') else 'abgelehnt: ' || v_state || ' ' || left(v_msg, 160) end,
        v_urteil);
    end loop;
  end loop;
end
$pruef$;

select nr, rolle, fall, erwartet, ergebnis, urteil from pruef_0053
union all
select null, 'SUMME', count(*) || ' Fälle: ' || count(*) filter (where urteil = 'PASS') || ' PASS, '
       || count(*) filter (where urteil = 'FAIL') || ' FAIL', null, null, null from pruef_0053
order by nr nulls last;
