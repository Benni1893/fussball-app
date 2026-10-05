-- ============================================================================
-- Prüfung zu Migration 0044 (BFV-Sync sagt nur noch künftige Spiele ab).
-- NACH dem Einspielen im SQL-Editor ausführen. Ändert nichts: jeder Fall läuft
-- in einer eigenen Untertransaktion, die am Ende immer zurückgerollt wird.
-- Muster wie supabase/checks/0043_auto_pruef.sql.
--
-- Holt den Teil der Gegenprobe nach, der beim Einspielen am 05.10.2026 nicht
-- gelaufen ist (Sync-Regel mit echtem Aufruf, apply_event_fines), und sichert
-- die Verlegung mit neuer UID ab.
--
-- Rollen: anon, Spieler, Admin (Rechte), service_role (api/sync-bfv.js) und
-- "intern" (postgres).
--
-- Erwartung je Fall:
--   verweigert  Fehler 42501
--   ok          gelingt
--   wert:<x>    gelingt, Ergebnis genau <x>
-- ============================================================================

drop table if exists pg_temp.pruef_0044;
create temp table pruef_0044 (nr int, rolle text, fall text, erwartet text, ergebnis text, urteil text);

do $pruef$
declare
  v_admin    uuid;
  v_nutzer   uuid;
  v_ziel     uuid;
  v_ziel_uid text;
  v_feed     jsonb;   -- alle künftigen BFV-Spiele, wie der Feed sie liefern würde
  v_ohne     jsonb;   -- dasselbe ohne v_ziel (Absage)
  v_verlegt  jsonb;   -- dasselbe, v_ziel mit neuer UID (Verlegung)
  v_nr       int := 0;
  v_txt      text;
  v_ok       boolean;
  v_state    text;
  v_msg      text;
  v_urteil   text;
  v_zaehler  constant text :=
    '(select count(*) from public.fines)::text || ''/'' || (select count(*) from public.notification_outbox)::text'
    || ' || ''/'' || (select count(*) from public.notification_sammler)::text || ''/'' || (select count(*) from public.rsvps)::text';
  v_vorher   text;
  r record;
  f record;
begin
  select ur.user_id into v_admin from public.user_roles ur where ur.role = 'admin' limit 1;
  select p.id into v_nutzer from public.profiles p
   where not exists (select 1 from public.user_roles ur where ur.user_id = p.id and ur.role = 'admin') limit 1;
  select id, bfv_uid into v_ziel, v_ziel_uid from public.events
   where quelle = 'bfv' and status = 'geplant' and starts_at > now() order by starts_at limit 1;
  if v_admin is null or v_nutzer is null or v_ziel is null then
    raise exception 'Für die Prüfung fehlt ein Admin, ein Nicht-Admin oder ein künftiges BFV-Spiel.';
  end if;

  select jsonb_agg(jsonb_build_object(
           'bfv_uid', e.bfv_uid, 'gegner', e.opponent, 'heim', e.home,
           'wettbewerb', e.wettbewerb, 'liga', e.liga, 'date', e.date::text, 'time', e.time,
           'spielstaette', e.spielstaette, 'adresse', e.adresse, 'location_raw', e.location_raw))
    into v_feed
    from public.events e where e.quelle = 'bfv' and e.starts_at > now();
  select jsonb_agg(x) into v_ohne from jsonb_array_elements(v_feed) x where x->>'bfv_uid' <> v_ziel_uid;
  select jsonb_agg(case when x->>'bfv_uid' = v_ziel_uid
                        then jsonb_set(x, '{bfv_uid}', '"pruef0044-neue-uid"') else x end)
    into v_verlegt from jsonb_array_elements(v_feed) x;
  execute 'select ' || v_zaehler into v_vorher;

  for r in
    select * from (values
      (1, 'anon'), (2, 'Spieler'), (3, 'Admin'), (4, 'service_role'), (5, 'intern')
    ) as t(ord, rolle) order by ord
  loop
    for f in
      select * from (values
        -- Der Sync laeuft in "vorbereitung" (eigene Anweisung): eine Abfrage in
        -- derselben Anweisung saehe seine Schreibvorgaenge nicht (Snapshot).
        -- ---- 1) Rechte: nur der Server ruft den Sync --------------------------
        ('sync_bfv_matches aufrufen', null,
         format('select public.sync_bfv_matches(%L::jsonb)::text', v_feed),
         'verweigert', array['anon','Spieler','Admin']),
        ('sync_bfv_matches aufrufen (api/sync-bfv.js), vollständiger Feed', null,
         format('select (public.sync_bfv_matches(%L::jsonb)->>''cancelled'')', v_feed),
         'wert:0', array['service_role']),

        -- ---- 2) Datenstand nach 0044 ----------------------------------------
        ('kein vergangenes BFV-Spiel auf abgesagt', null,
         'select count(*)::text from public.events where quelle = ''bfv'' and status = ''abgesagt'' and starts_at <= now()',
         'wert:0', array['intern']),
        ('die 8 Spiele vom 09.08. bis 04.10. stehen auf geplant', null,
         'select count(*)::text from public.events where quelle = ''bfv'' and status = ''geplant'' and starts_at <= now() and date between ''2026-08-09'' and ''2026-10-04''',
         'wert:8', array['intern']),
        ('keine Strafen für vergangene BFV-Spiele', null,
         'select count(*)::text from public.fines f join public.events e on e.id = f.event_id where e.quelle = ''bfv'' and e.starts_at <= now()',
         'wert:0', array['intern']),

        -- ---- 3) Sync-Regel mit echtem Aufruf --------------------------------
        ('vollständiger Feed: nichts abgesagt, Vergangenes bleibt geplant',
         format('select public.sync_bfv_matches(%L::jsonb)', v_feed),
         'select count(*)::text from public.events where quelle = ''bfv'' and status = ''abgesagt''',
         'wert:0', array['intern']),
        ('künftiges Spiel fehlt: genau dieses abgesagt, kein vergangenes',
         format('select public.sync_bfv_matches(%L::jsonb)', v_ohne),
         format('select (select status from public.events where id = %L::uuid) || ''/'' || (select count(*) from public.events where quelle = ''bfv'' and status = ''abgesagt'')::text', v_ziel),
         'wert:abgesagt/1', array['intern']),
        ('leerer Feed: keine Absage (Schutz bleibt)',
         'select public.sync_bfv_matches(''[]''::jsonb)',
         'select count(*)::text from public.events where quelle = ''bfv'' and status = ''abgesagt''',
         'wert:0', array['intern']),
        ('Verlegung mit neuer UID: altes abgesagt, neues angelegt',
         format('select public.sync_bfv_matches(%L::jsonb)', v_verlegt),
         format('select (select status from public.events where id = %L::uuid) || ''/'' || (select count(*) from public.events where bfv_uid = ''pruef0044-neue-uid'' and status = ''geplant'')::text', v_ziel),
         'wert:abgesagt/1', array['intern']),
        -- Seit AM3 meldet ein Sync mit neuer UID zu Recht einen neuen Termin; "nichts
        -- ausgelöst" gilt für den unveränderten Feed.
        ('Sync mit unverändertem Feed löst nichts aus: Strafen/Outbox/Sammler/Rückmeldungen unverändert',
         format('select public.sync_bfv_matches(%L::jsonb)', v_feed),
         format('select ((%s) = %L)::text', v_zaehler, v_vorher),
         'wert:true', array['intern']),

        -- ---- 4) Strafenlauf ------------------------------------------------
        ('apply_event_fines: keine Strafe für vergangene BFV-Spiele',
         'select public.apply_event_fines()',
         'select count(*)::text from public.fines f join public.events e on e.id = f.event_id where e.quelle = ''bfv'' and e.starts_at <= now()',
         'wert:0', array['intern'])
      ) as t(fall, vorbereitung, sql, erwartet, rollen)
      where r.rolle = any(t.rollen)
    loop
      v_nr := v_nr + 1;
      v_ok := false; v_txt := null; v_state := null; v_msg := null;
      begin
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
        raise exception using errcode = 'P0044', message = 'zurückrollen';
      exception when others then
        if sqlstate <> 'P0044' then v_state := sqlstate; v_msg := sqlerrm; end if;
      end;
      v_urteil := case
        when f.erwartet = 'verweigert' then case when not v_ok and v_state = '42501' then 'PASS' else 'FAIL' end
        when f.erwartet = 'ok' then case when v_ok then 'PASS' else 'FAIL' end
        when f.erwartet like 'wert:%' then case when v_ok and v_txt = substr(f.erwartet, 6) then 'PASS' else 'FAIL' end
      end;
      insert into pruef_0044 values (v_nr, r.rolle, f.fall, f.erwartet,
        case when v_ok then 'gelungen: ' || coalesce(left(v_txt, 60), '(null)') else 'abgelehnt: ' || v_state || ' ' || left(v_msg, 120) end,
        v_urteil);
    end loop;
  end loop;
end
$pruef$;

select nr, rolle, fall, erwartet, ergebnis, urteil from pruef_0044
union all
select null, 'SUMME', count(*) || ' Fälle: ' || count(*) filter (where urteil = 'PASS') || ' PASS, '
       || count(*) filter (where urteil = 'FAIL') || ' FAIL', null, null, null from pruef_0044
order by nr nulls last;
