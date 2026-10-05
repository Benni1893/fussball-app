-- ============================================================================
-- Prüfung zu Migration 0043 (Automatische Mitteilungen, AM1 Infrastruktur).
-- NACH dem Einspielen im SQL-Editor ausführen. Ändert nichts: jeder Fall läuft
-- in einer eigenen Untertransaktion, die am Ende immer zurückgerollt wird.
-- Muster wie supabase/checks/0042_rechtepruef.sql.
--
-- Rollen: anon, Spieler, Trainer, Kassenwart, Admin (wie 0042), service_role
-- (Dispatcher) und "intern" (postgres, so laufen Trigger und pg_cron).
--
-- Erwartung je Fall:
--   verweigert  Fehler 42501
--   ok          gelingt
--   wert:<x>    gelingt, Ergebnis genau <x>
-- ============================================================================

drop table if exists pg_temp.pruef_0043;
create temp table pruef_0043 (nr int, rolle text, fall text, erwartet text, ergebnis text, urteil text);

do $pruef$
declare
  v_admin    uuid;
  v_nutzer   uuid;
  v_club     uuid;
  v_aspieler uuid;
  v_spiel    uuid;
  v_nr       int := 0;
  v_txt      text;
  v_ok       boolean;
  v_state    text;
  v_msg      text;
  v_urteil   text;
  AUSSEN constant text[] := array['anon','Spieler','Trainer','Kassenwart','Admin'];
  r record;
  f record;
begin
  select ur.user_id into v_admin from public.user_roles ur where ur.role = 'admin' limit 1;
  select p.id, p.club_id into v_nutzer, v_club from public.profiles p
   where not exists (select 1 from public.user_roles ur where ur.user_id = p.id and ur.role = 'admin') limit 1;
  select player_id into v_aspieler from public.profiles where id = v_admin;
  select e.id into v_spiel from public.events e where e.type = 'spiel' and coalesce(e.opponent, '') <> '' limit 1;
  if v_admin is null or v_nutzer is null or v_aspieler is null then
    raise exception 'Für die Prüfung fehlt ein Admin-Profil mit Spieler oder ein Nicht-Admin-Profil.';
  end if;

  for r in
    select * from (values
      (1, 'anon', null::text), (2, 'Spieler', null), (3, 'Trainer', 'coach'),
      (4, 'Kassenwart', 'treasurer'), (5, 'Admin', null), (6, 'service_role', null), (7, 'intern', null)
    ) as t(ord, rolle, zusatzrolle) order by ord
  loop
    for f in
      select * from (values
        -- ---- 1) Keine neue Funktion von außen ------------------------------
        ('notify_datum_kurz', null, 'select public.notify_datum_kurz(current_date)::text', 'verweigert', AUSSEN),
        ('notify_uhrzeit', null, 'select public.notify_uhrzeit(''12:30'')::text', 'verweigert', AUSSEN),
        ('notify_betrag', null, 'select public.notify_betrag(8)::text', 'verweigert', AUSSEN),
        ('notify_termin_titel', null, format('select public.notify_termin_titel(%L::uuid)::text', v_spiel), 'verweigert', AUSSEN),
        ('notify_spieler_faellt_aus', null, format('select public.notify_spieler_faellt_aus(%L::uuid)::text', v_aspieler), 'verweigert', AUSSEN),
        ('notify_profile_von_spieler', null, format('select count(*)::text from public.notify_profile_von_spieler(%L::uuid)', v_aspieler), 'verweigert', AUSSEN),
        ('notify_profile_mit_rolle', null, 'select count(*)::text from public.notify_profile_mit_rolle(''admin'')', 'verweigert', AUSSEN),
        ('notify_profile_alle_spieler', null, 'select count(*)::text from public.notify_profile_alle_spieler(true)', 'verweigert', AUSSEN),
        ('notify_empfaenger_ok', null, format('select public.notify_empfaenger_ok(''termin_neu'', %L::uuid, null)::text', v_admin), 'verweigert', AUSSEN),
        ('notify_nicht_vor_acht', null, 'select public.notify_nicht_vor_acht(now())::text', 'verweigert', AUSSEN),
        ('notify_sammeln', null, format('select public.notify_sammeln(''termin_neu'', ''pruef'', %L::uuid, null, ''{}''::jsonb, now())::text', v_admin), 'verweigert', AUSSEN),
        ('notify_sammler_flush', null, 'select public.notify_sammler_flush()::text', 'verweigert', AUSSEN),
        ('notification_sammler lesen', null, 'select count(*)::text from public.notification_sammler', 'verweigert', AUSSEN),
        ('notification_due lesen', null, 'select count(*)::text from public.notification_due', 'verweigert', AUSSEN),

        -- ---- 2) Dispatcher arbeitet weiter ---------------------------------
        ('notification_due lesen (Dispatcher)', null, 'select count(*)::text from public.notification_due', 'ok', array['service_role']),
        ('push_claim (Dispatcher)', null, 'select count(*)::text from public.push_claim(1)', 'ok', array['service_role']),

        -- ---- 3) Bausteine mit echten Zeilen (intern) ------------------------
        ('Texthilfen', null,
         'select public.notify_datum_kurz(''2026-09-20'') || ''|'' || public.notify_datum_lang(''2026-09-20'') || ''|'' || public.notify_uhrzeit(''12:30'') || ''|'' || public.notify_betrag(128.5)',
         'wert:20.09.|20.09.2026|12:30 Uhr|128,50 €', array['intern']),
        ('08:00-Regel: 04:27 UTC (06:27 Ortszeit) wird 06:00 UTC', null,
         'select (public.notify_nicht_vor_acht(''2026-10-05 04:27+00'') = ''2026-10-05 06:00+00''::timestamptz)::text', 'wert:true', array['intern']),
        ('Termintitel beim Spiel = Gegner', null,
         format('select (public.notify_termin_titel(%L::uuid) = (select opponent from public.events where id = %L::uuid))::text', v_spiel, v_spiel), 'wert:true', array['intern']),
        ('Sammler: zwei Einträge einer Gruppe, gleiche Fälligkeit',
         -- eine Anweisung, zwei Aufrufe nacheinander: der zweite sieht den ersten
         format('select public.notify_sammeln(''zahlung_gemeldet'', ''pruef0043'', %L::uuid, null, ''{"n":1}''::jsonb, now() + interval ''15 minutes''), ', v_admin)
         || format('public.notify_sammeln(''zahlung_gemeldet'', ''pruef0043'', %L::uuid, null, ''{"n":2}''::jsonb, now() + interval ''40 minutes'')', v_admin),
         'select count(*)::text || ''/'' || count(distinct faellig_ab)::text from public.notification_sammler where bezug = ''pruef0043''',
         'wert:2/1', array['intern']),
        ('Auslöser bekommt keine Nachricht (termin_neu)',
         format('select public.notify_sammeln(''termin_neu'', ''pruef0043'', %L::uuid, %L::uuid, ''{}''::jsonb, now())', v_admin, v_admin),
         'select count(*)::text from public.notification_sammler where bezug = ''pruef0043''', 'wert:0', array['intern']),
        ('Ausnahme Strafen: Auslöser bekommt sie doch (strafe_neu)',
         format('select public.notify_sammeln(''strafe_neu'', ''pruef0043'', %L::uuid, %L::uuid, ''{}''::jsonb, now())', v_admin, v_admin),
         'select count(*)::text from public.notification_sammler where bezug = ''pruef0043''', 'wert:1', array['intern']),
        -- Seit AM3 hat termin_neu eine Zusammenfassung; unterbesetzung bekommt keine (F4).
        -- Sammeln und Zusammenfassen in der Vorbereitung, Zählen danach (Snapshot).
        ('Flush ohne Zusammenfassung für die Kategorie lässt Einträge liegen',
         format('select public.notify_sammeln(''unterbesetzung'', ''pruef0043'', %L::uuid, null, ''{}''::jsonb, now() - interval ''1 minute''), public.notify_sammler_flush()', v_admin),
         'select count(*)::text from public.notification_sammler where bezug = ''pruef0043''',
         'wert:1', array['intern']),
        ('Abgelaufene Outbox-Zeile ist nicht fällig',
         format('insert into public.notification_outbox (profile_id, kategorie, titel, text, dedup_key, not_before, gueltig_bis) values (%L, ''test'', ''P'', ''P'', ''pruef0043:alt'', now() - interval ''1 minute'', now() - interval ''1 second'')', v_admin),
         'select count(*)::text from public.notification_due where dedup_key = ''pruef0043:alt''', 'wert:0', array['intern']),
        ('Gültige Outbox-Zeile ist fällig',
         format('insert into public.notification_outbox (profile_id, kategorie, titel, text, dedup_key, not_before, gueltig_bis) values (%L, ''test'', ''P'', ''P'', ''pruef0043:neu'', now() - interval ''1 minute'', now() + interval ''1 hour'')', v_admin),
         'select count(*)::text from public.notification_due where dedup_key = ''pruef0043:neu''', 'wert:1', array['intern']),
        -- Einreihen in der Vorbereitung, Lesen danach: dieselbe Anweisung sähe die Zeile nicht.
        ('notify_enqueue setzt gueltig_bis bei bis_zeitpunkt',
         format('select public.notify_enqueue(%L::uuid, ''absage_kurzfristig'', ''{"anzahl":"1","termin_titel":"T","datum":"01.01.","uhrzeit":"12:00 Uhr","namen":"N","termin_id":"x"}''::jsonb, p_dedup => ''pruef0043:ttl'', p_ttl_bis => now() + interval ''2 hours'')', v_admin),
         'select (gueltig_bis is not null)::text from public.notification_outbox where dedup_key = ''pruef0043:ttl''',
         'wert:true', array['intern']),
        ('Urlaub fällt aus der Spielerliste',
         format('insert into public.player_status (player_id, status, status_since) values (%L, ''urlaub'', current_date) on conflict (player_id) do update set status = ''urlaub'', status_until = null', v_aspieler),
         format('select ((select count(*) from public.notify_profile_alle_spieler(true) where player_id = %L) = 0 and (select count(*) from public.notify_profile_alle_spieler(false) where player_id = %L) = 1)::text', v_aspieler, v_aspieler),
         'wert:true', array['intern'])
      ) as t(fall, vorbereitung, sql, erwartet, rollen)
      where r.rolle = any(t.rollen)
    loop
      v_nr := v_nr + 1;
      v_ok := false; v_txt := null; v_state := null; v_msg := null;
      begin
        if r.zusatzrolle is not null then
          insert into public.user_roles (user_id, role, club_id) values (v_nutzer, r.zusatzrolle, v_club);
        end if;
        if f.vorbereitung is not null then execute f.vorbereitung; end if;
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
        execute f.sql into v_txt;
        v_ok := true;
        raise exception using errcode = 'P0043', message = 'zurückrollen';
      exception when others then
        if sqlstate <> 'P0043' then v_state := sqlstate; v_msg := sqlerrm; end if;
      end;
      v_urteil := case
        when f.erwartet = 'verweigert' then case when not v_ok and v_state = '42501' then 'PASS' else 'FAIL' end
        when f.erwartet = 'ok' then case when v_ok then 'PASS' else 'FAIL' end
        when f.erwartet like 'wert:%' then case when v_ok and v_txt = substr(f.erwartet, 6) then 'PASS' else 'FAIL' end
      end;
      insert into pruef_0043 values (v_nr, r.rolle, f.fall, f.erwartet,
        case when v_ok then 'gelungen: ' || coalesce(left(v_txt, 60), '(null)') else 'abgelehnt: ' || v_state || ' ' || left(v_msg, 120) end,
        v_urteil);
    end loop;
  end loop;
end
$pruef$;

select nr, rolle, fall, erwartet, ergebnis, urteil from pruef_0043
union all
select null, 'SUMME', count(*) || ' Fälle: ' || count(*) filter (where urteil = 'PASS') || ' PASS, '
       || count(*) filter (where urteil = 'FAIL') || ' FAIL', null, null, null from pruef_0043
order by nr nulls last;
