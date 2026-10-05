-- ============================================================================
-- Prüfung zu Migration 0046 und 0047 (Automatische Mitteilungen, AM3 Termine).
-- Seit 0054 gehen Absagen über den Sammler (Fälle mit Zusammenfassen).
-- Ändert nichts: jeder Fall läuft in einer Untertransaktion, die immer
-- zurückgerollt wird. Muster wie 0045_kasse_pruef.sql.
--
-- Ablauf je Fall:
--   vor     (intern)  Vorbereitung, Liste von Anweisungen
--   aktion  (Rolle)   Liste von Anweisungen als anon / Spieler / Trainer /
--                     Kassenwart / Admin / service_role
--   nach    (intern)  z. B. Sammler fällig setzen, zusammenfassen
--   pruef   (intern)  liefert den Wert; ohne pruef zählt die letzte aktion
--
-- Empfänger in den Fällen ist das Admin-Profil (mit Spieler); das
-- Nicht-Admin-Profil ist mit einem Prüfspieler verknüpft und löst als
-- Trainer aus. Alles verschwindet mit dem Zurückrollen.
-- ============================================================================

drop table if exists pg_temp.pruef_0046;
create temp table pruef_0046 (nr int, rolle text, fall text, erwartet text, ergebnis text, urteil text);

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
    format('insert into public.players (id, club_id, code, name) values (%L, %L, %L, %L)', v_sp, v_club, 'pruef0046', 'Prüfspieler 0046'),
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
  v_feed_neu := v_feed || jsonb_build_array(jsonb_build_object('bfv_uid', 'pruef0046-neu', 'gegner', 'Prüfverein', 'heim', true,
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
        -- ---- 1) Rechte -----------------------------------------------------
        ('notify_spieler_faellt_aus_am', null::text[], array[format('select public.notify_spieler_faellt_aus_am(%L, current_date)::text', v_aspieler)], null::text[], null::text, 'verweigert', AUSSEN),
        ('notify_profile_spieler_am', null, array['select count(*)::text from public.notify_profile_spieler_am(current_date)'], null, null, 'verweigert', AUSSEN),
        ('notify_termin_liste', null, array['select public.notify_termin_liste(array[gen_random_uuid()])'], null, null, 'verweigert', AUSSEN),
        ('notify_flush_termin_neu', null, array['select public.notify_flush_termin_neu()::text'], null, null, 'verweigert', AUSSEN),
        ('notify_flush_termin_geaendert', null, array['select public.notify_flush_termin_geaendert()::text'], null, null, 'verweigert', AUSSEN),
        ('keine notify_*-Funktion für anon/authenticated', null, null, null,
         'select count(*)::text from pg_proc p where p.pronamespace = ''public''::regnamespace and p.proname like ''notify\_%'' and p.proname <> ''notify_enqueue'' and (has_function_privilege(''anon'', p.oid, ''execute'') or has_function_privilege(''authenticated'', p.oid, ''execute''))',
         'wert:0', array['intern']),
        ('Trigger trg_events_notify aktiv', null, null, null,
         'select tgenabled::text from pg_trigger where tgname = ''trg_events_notify'' and tgrelid = ''public.events''::regclass', 'wert:O', array['intern']),
        ('Vorlage termin_neu (T7)', null, null, null,
         'select titel_vorlage || '' / '' || text_vorlage from public.notification_templates where kategorie = ''termin_neu''',
         'wert:📅 {anzahl} / Jetzt zu- oder absagen: {liste}', array['intern']),

        -- ---- 2) termin_neu -------------------------------------------------
        ('termin_neu: Trainer legt an, Admin bekommt Eintrag nach 30 Minuten, Trainer selbst nicht (F1)', v_basis,
         array[v_termin], null,
         format('select (select count(*) from public.notification_sammler where kategorie = ''termin_neu'' and profile_id = %L and faellig_ab between now() + interval ''29 minutes'' and now() + interval ''31 minutes'')::text || ''/'' || (select count(*) from public.notification_sammler where kategorie = ''termin_neu'' and profile_id = %L)::text', v_admin, v_nutzer),
         'wert:1/0', array['Trainer']),
        ('termin_neu: Serie mit drei Terminen ergibt eine Nachricht', v_basis,
         array[v_serie3], array[v_faellig, 'select public.notify_flush_termin_neu()'],
         format('select count(*)::text || '' | '' || max(titel || '' | '' || text || '' | '' || deep_link) from public.notification_outbox where kategorie = ''termin_neu'' and profile_id = %L and created_at >= now()', v_admin),
         format('wert:1 | 📅 3 neue Termine | Jetzt zu- oder absagen: Prüftermin %s, Prüftermin %s, Prüftermin %s | #ansicht=kalender', k1, k2, k3), array['Trainer']),
        ('termin_neu: Termin in der Vergangenheit, nichts', v_basis,
         array[format('insert into public.events (club_id, type, title, date, time, status, quelle) values (%L, ''training'', ''Prüftermin'', current_date - 3, ''19:00'', ''geplant'', ''manuell'')', v_club)], null,
         'select count(*)::text from public.notification_sammler where kategorie = ''termin_neu'' and erstellt_at >= now()', 'wert:0', array['Trainer']),
        ('termin_neu: Termin vor dem Zusammenfassen gelöscht, nichts', v_basis,
         array[v_termin, format('delete from public.events where id = %L', v_e1)], array[v_faellig, 'select public.notify_flush_termin_neu()'],
         'select (select count(*) from public.notification_sammler where kategorie = ''termin_neu'' and erstellt_at >= now())::text || ''/'' || (select count(*) from public.notification_outbox where kategorie = ''termin_neu'' and created_at >= now())::text',
         'wert:0/0', array['Trainer']),
        ('termin_neu: Absage, solange die Neu-Meldung aussteht, erzeugt nichts (T9)', v_basis,
         array[v_termin, format('update public.events set status = ''abgesagt'' where id = %L', v_e1)], null,
         'select (select count(*) from public.notification_sammler where erstellt_at >= now())::text || ''/'' || (select count(*) from public.notification_outbox where kategorie = ''termin_abgesagt'' and created_at >= now())::text',
         'wert:0/0', array['Trainer']),
        ('termin_neu: BFV-Sync mit neuem Spiel, gesammelt je Lauf, frühestens 08:00', v_basis,
         array[format('select public.sync_bfv_matches(%L::jsonb)::text', v_feed_neu)], null,
         format('select count(*)::text || ''/'' || bool_and(bezug = ''bfv'' and faellig_ab = public.notify_nicht_vor_acht(now() + interval ''2 minutes''))::text from public.notification_sammler where kategorie = ''termin_neu'' and profile_id = %L', v_admin),
         'wert:1/true', array['service_role']),
        ('BFV-Sync mit unverändertem Feed erzeugt nichts', v_basis,
         array[format('select public.sync_bfv_matches(%L::jsonb)::text', v_feed)], null,
         'select (select count(*) from public.notification_sammler where erstellt_at >= now())::text || ''/'' || (select count(*) from public.notification_outbox where created_at >= now())::text',
         'wert:0/0', array['service_role']),

        -- ---- 3) termin_geaendert -------------------------------------------
        ('termin_geaendert: Uhrzeit, Text nach 10 Minuten', v_basis || array[v_termin, 'delete from public.notification_sammler where erstellt_at >= now()'],
         array[format('update public.events set time = ''20:00'' where id = %L', v_e1)],
         array[v_faellig, 'select public.notify_flush_termin_geaendert()'],
         format('select count(*)::text || '' | '' || max(titel || '' | '' || text || '' | '' || deep_link) from public.notification_outbox where kategorie = ''termin_geaendert'' and profile_id = %L and created_at >= now()', v_admin),
         format('wert:1 | 📅 Prüftermin geändert | %s: Beginn jetzt 20:00 statt 19:00 Uhr | #termin=%s', l1, v_e1), array['Trainer']),
        ('termin_geaendert: hin und zurück geändert, nichts', v_basis || array[v_termin, 'delete from public.notification_sammler where erstellt_at >= now()'],
         array[format('update public.events set time = ''20:00'' where id = %L', v_e1), format('update public.events set time = ''19:00'' where id = %L', v_e1)],
         array[v_faellig, 'select public.notify_flush_termin_geaendert()'],
         'select count(*)::text from public.notification_outbox where kategorie = ''termin_geaendert'' and created_at >= now()', 'wert:0', array['Trainer']),
        ('termin_geaendert: Serie, drei Termine, eine Nachricht (T6)', v_basis || array[v_serie3, 'delete from public.notification_sammler where erstellt_at >= now()'],
         array[format('update public.events set time = ''20:00'' where serie_id = %L', v_serie)],
         array[v_faellig, 'select public.notify_flush_termin_geaendert()'],
         format('select count(*)::text || '' | '' || max(titel || '' | '' || text) from public.notification_outbox where kategorie = ''termin_geaendert'' and profile_id = %L and created_at >= now()', v_admin),
         format('wert:1 | 📅 3 Termine geändert | ab %s: Beginn jetzt 20:00 statt 19:00 Uhr', l1), array['Trainer']),
        ('termin_geaendert: Datum verlegt', v_basis || array[v_termin, 'delete from public.notification_sammler where erstellt_at >= now()'],
         array[format('update public.events set date = date + 1 where id = %L', v_e1)],
         array[v_faellig, 'select public.notify_flush_termin_geaendert()'],
         format('select max(text) from public.notification_outbox where kategorie = ''termin_geaendert'' and profile_id = %L and created_at >= now()', v_admin),
         format('wert:%s: Verlegt vom %s auf %s', public.notify_datum_lang(d1 + 1), k1, public.notify_datum_kurz(d1 + 1)), array['Trainer']),
        ('termin_geaendert: Ort geändert', v_basis || array[v_termin, 'delete from public.notification_sammler where erstellt_at >= now()'],
         array[format('update public.events set location = ''Prüfplatz Nord'' where id = %L', v_e1)],
         array[v_faellig, 'select public.notify_flush_termin_geaendert()'],
         format('select max(text) from public.notification_outbox where kategorie = ''termin_geaendert'' and profile_id = %L and created_at >= now()', v_admin),
         format('wert:%s: Ort: Prüfplatz Nord', l1), array['Trainer']),
        ('termin_geaendert: Urlaub am Termintag, kein Eintrag (F3, T2)',
         v_basis || array[v_termin, 'delete from public.notification_sammler where erstellt_at >= now()',
           format('insert into public.player_status (player_id, status, status_until) values (%L, ''urlaub'', %L)', v_aspieler, d1)],
         array[format('update public.events set time = ''20:00'' where id = %L', v_e1)], null,
         format('select count(*)::text from public.notification_sammler where kategorie = ''termin_geaendert'' and profile_id = %L', v_admin),
         'wert:0', array['Trainer']),
        ('termin_geaendert: Urlaub endet vor dem Termin, Eintrag (T2)',
         v_basis || array[v_termin, 'delete from public.notification_sammler where erstellt_at >= now()',
           format('insert into public.player_status (player_id, status, status_until) values (%L, ''urlaub'', %L)', v_aspieler, d1 - 1)],
         array[format('update public.events set time = ''20:00'' where id = %L', v_e1)], null,
         format('select count(*)::text from public.notification_sammler where kategorie = ''termin_geaendert'' and profile_id = %L', v_admin),
         'wert:1', array['Trainer']),
        ('termin_geaendert: Änderung, solange die Neu-Meldung aussteht, nichts (T9)', v_basis,
         array[v_termin, format('update public.events set time = ''20:00'' where id = %L', v_e1)], null,
         'select count(*)::text from public.notification_sammler where kategorie = ''termin_geaendert'' and erstellt_at >= now()', 'wert:0', array['Trainer']),

        -- ---- 4) termin_abgesagt --------------------------------------------
        ('termin_abgesagt: Trainer sagt ab, Admin bekommt sie (seit 0054 über den Sammler), gültig bis Beginn', v_basis || array[v_termin, 'delete from public.notification_sammler where erstellt_at >= now()'],
         array[format('update public.events set status = ''abgesagt'' where id = %L', v_e1)], array[v_faellig, 'select public.notify_flush_termin_abgesagt()'],
         format('select count(*)::text || '' | '' || max(titel || '' | '' || text || '' | '' || deep_link) || '' | '' || bool_and(gueltig_bis = (select starts_at from public.events where id = %L) and urgency = ''high'')::text from public.notification_outbox where kategorie = ''termin_abgesagt'' and profile_id = %L and created_at >= now()', v_e1, v_admin),
         format('wert:1 | ❌ Prüftermin fällt aus | %s 19:00 Uhr. | #ansicht=kalender | true', l1), array['Trainer']),
        ('termin_abgesagt: Admin sagt ab, bekommt selbst nichts (F1), verknüpfter Spieler schon', v_basis || array[v_termin, 'delete from public.notification_sammler where erstellt_at >= now()'],
         array[format('update public.events set status = ''abgesagt'' where id = %L', v_e1)], array[v_faellig, 'select public.notify_flush_termin_abgesagt()'],
         format('select (select count(*) from public.notification_outbox where kategorie = ''termin_abgesagt'' and profile_id = %L and created_at >= now())::text || ''/'' || (select count(*) from public.notification_outbox where kategorie = ''termin_abgesagt'' and profile_id = %L and created_at >= now())::text', v_admin, v_nutzer),
         'wert:0/1', array['Admin']),
        ('termin_abgesagt: Findet statt vor dem Versand, nichts (T4)', v_basis || array[v_termin, 'delete from public.notification_sammler where erstellt_at >= now()'],
         array[format('update public.events set status = ''abgesagt'' where id = %L', v_e1), format('update public.events set status = ''geplant'' where id = %L', v_e1)],
         array[v_faellig, 'select public.notify_flush_termin_geaendert()'],
         'select (select count(*) from public.notification_outbox where kategorie in (''termin_abgesagt'', ''termin_geaendert'') and created_at >= now())::text',
         'wert:0', array['Trainer']),
        ('termin_abgesagt: Findet statt nach dem Versand, "Findet doch statt" (T4)', v_basis || array[v_termin, 'delete from public.notification_sammler where erstellt_at >= now()'],
         array[format('update public.events set status = ''abgesagt'' where id = %L', v_e1)],
         array[v_faellig, 'select public.notify_flush_termin_abgesagt()', 'update public.notification_outbox set sent_at = now() where kategorie = ''termin_abgesagt'' and created_at >= now()',
               format('update public.events set status = ''geplant'' where id = %L', v_e1),
               v_faellig, 'select public.notify_flush_termin_geaendert()'],
         format('select max(text) from public.notification_outbox where kategorie = ''termin_geaendert'' and profile_id = %L and created_at >= now()', v_admin),
         format('wert:%s: Findet doch statt', l1), array['Trainer']),
        ('termin_abgesagt: vergangener Termin, nichts',
         v_basis || array[format('insert into public.events (id, club_id, type, title, date, time, status, quelle) values (%L, %L, ''training'', ''Prüftermin'', current_date - 2, ''19:00'', ''geplant'', ''manuell'')', v_e1, v_club)],
         array[format('update public.events set status = ''abgesagt'' where id = %L', v_e1)], null,
         'select count(*)::text from public.notification_outbox where kategorie = ''termin_abgesagt'' and created_at >= now()', 'wert:0', array['Trainer']),
        ('termin_abgesagt: BFV-Spiel fehlt im Feed, Absage frühestens 08:00', v_basis,
         array[format('select public.sync_bfv_matches(%L::jsonb)::text', v_feed_ohne)], null,
         format('select count(*)::text || ''/'' || bool_and(faellig_ab = greatest(now() + interval ''2 minutes'', public.notify_nicht_vor_acht(now())))::text from public.notification_sammler where kategorie = ''termin_abgesagt'' and profile_id = %L and daten->>''event_id'' = %L', v_admin, v_bfv_ziel),
         'wert:1/true', array['service_role']),
        ('Termin gelöscht: ausstehende Änderung verfällt, seit 0053 Absage-Nachricht statt T5', v_basis || array[v_termin, 'delete from public.notification_sammler where erstellt_at >= now()'],
         array[format('update public.events set time = ''20:00'' where id = %L', v_e1), format('delete from public.events where id = %L', v_e1)],
         array[v_faellig, 'select public.notify_flush_termin_geaendert()', 'select public.notify_flush_termin_abgesagt()'],
         'select (select count(*) from public.notification_sammler where erstellt_at >= now())::text || ''/'' || (select count(*) from public.notification_outbox where created_at >= now())::text',
         'wert:0/1', array['Trainer'])
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
        raise exception using errcode = 'P0046', message = 'zurückrollen';
      exception when others then
        if sqlstate <> 'P0046' then v_state := sqlstate; v_msg := sqlerrm; end if;
      end;
      v_urteil := case
        when f.erwartet = 'verweigert' then case when not v_ok and v_state = '42501' then 'PASS' else 'FAIL' end
        when f.erwartet = 'ok' then case when v_ok then 'PASS' else 'FAIL' end
        when f.erwartet like 'wert:%' then case when v_ok and v_txt = substr(f.erwartet, 6) then 'PASS' else 'FAIL' end
      end;
      insert into pruef_0046 values (v_nr, r.rolle, f.fall, f.erwartet,
        case when v_ok then 'gelungen: ' || coalesce(left(v_txt, 160), '(null)') else 'abgelehnt: ' || v_state || ' ' || left(v_msg, 160) end,
        v_urteil);
    end loop;
  end loop;
end
$pruef$;

select nr, rolle, fall, erwartet, ergebnis, urteil from pruef_0046
union all
select null, 'SUMME', count(*) || ' Fälle: ' || count(*) filter (where urteil = 'PASS') || ' PASS, '
       || count(*) filter (where urteil = 'FAIL') || ' FAIL', null, null, null from pruef_0046
order by nr nulls last;
