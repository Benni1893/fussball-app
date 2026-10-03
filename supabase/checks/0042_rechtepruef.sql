-- ============================================================================
-- Prüfung zu Migration 0042 + 0042b (Rechte). NACH dem Einspielen beider im
-- SQL-Editor ausführen. Ändert nichts:
--   * Jeder Fall läuft in einer eigenen Untertransaktion, die am Ende IMMER
--     zurückgerollt wird (Erfolg wie Fehler). Eingereihte Nachrichten,
--     beanspruchte Outbox-Zeilen, angelegte Rückmeldungen, geänderte Termine
--     und die vorübergehend vergebenen Rollen Trainer/Kassenwart
--     verschwinden damit wieder. pg_cron sieht davon nichts.
--   * Ergebnis landet in einer temporären Tabelle dieser Sitzung.
--
-- Rollen werden simuliert wie PostgREST es tut: SET ROLE plus JWT-Claims
-- (auth.uid() liest request.jwt.claims). Profile:
--   Admin       = das Profil mit Rolle admin
--   Spieler     = ein Profil ohne admin
--   Trainer     = dasselbe Profil + Rolle coach (nur in der Untertransaktion)
--   Kassenwart  = dasselbe Profil + Rolle treasurer (nur in der Untertransaktion)
--
-- WICHTIG (Lehre aus dem ersten Lauf): jeder Fall liefert seinen Wert als
-- Text an PL/pgSQL zurück ("execute ... into"). Ein Aufruf in einer
-- Unterabfrage, deren Spalte niemand liest, wird bei STABLE/IMMUTABLE-
-- Funktionen vom Planer verworfen - dann prüft Postgres auch keine Rechte.
--
-- Erwartung je Fall:
--   verweigert  Fehler 42501 (Recht entzogen oder Rollenprüfung mit 42501)
--   nein        irgendein Fehler, außer 23503 (Fremdschlüssel hieße: der
--               Aufruf ist durchgekommen und erst am Profil gescheitert)
--   ok          gelingt
--   leer        gelingt, Ergebnis 0
--   voll        gelingt, Ergebnis > 0
--   eins        gelingt, Ergebnis genau 1
--   wahr        gelingt, Ergebnis true
-- ============================================================================

drop table if exists pg_temp.pruef_0042;
create temp table pruef_0042 (
  nr        int,
  rolle     text,
  fall      text,
  erwartet  text,
  ergebnis  text,
  urteil    text
);

do $pruef$
declare
  v_admin    uuid;
  v_nutzer   uuid;
  v_club     uuid;
  v_aspieler uuid;     -- Spieler des Admin-Profils (fuer die Trigger-Faelle)
  v_ev_frei  uuid;     -- Termin ohne Rueckmeldung dieses Spielers
  v_ev       uuid;     -- irgendein Termin
  v_fremd    constant uuid := '00000000-0000-0000-0000-000000000000';
  v_nr       int := 0;
  v_txt      text;
  v_ok       boolean;
  v_state    text;
  v_msg      text;
  v_urteil   text;
  ALLE_AUSSER_SR constant text[] := array['anon','Spieler','Trainer','Kassenwart','Admin'];
  NICHT_ADMIN    constant text[] := array['anon','Spieler','Trainer','Kassenwart'];
  ANGEMELDET     constant text[] := array['Spieler','Trainer','Kassenwart','Admin'];
  r          record;
  f          record;
begin
  select ur.user_id into v_admin from public.user_roles ur where ur.role = 'admin' limit 1;
  select p.id, p.club_id into v_nutzer, v_club from public.profiles p
   where not exists (select 1 from public.user_roles ur where ur.user_id = p.id and ur.role = 'admin')
   limit 1;
  if v_admin is null or v_nutzer is null then
    raise exception 'Für die Prüfung fehlt ein Admin- oder ein Nicht-Admin-Profil.';
  end if;
  select player_id into v_aspieler from public.profiles where id = v_admin;
  select e.id into v_ev from public.events e order by e.date desc limit 1;
  select e.id into v_ev_frei from public.events e
   where not exists (select 1 from public.rsvps x where x.event_id = e.id and x.player_id = v_aspieler)
   order by e.date desc limit 1;

  for r in
    select * from (values
      (1, 'anon',         null::text),
      (2, 'Spieler',      null),
      (3, 'Trainer',      'coach'),
      (4, 'Kassenwart',   'treasurer'),
      (5, 'Admin',        null),
      (6, 'service_role', null)
    ) as t(ord, rolle, zusatzrolle)
    order by ord
  loop
    for f in
      select * from (values
        -- ---- 1) Push-Interna: nur Server ---------------------------------
        ('notify_enqueue an fremdes Profil', null,
         format('select public.notify_enqueue(%L::uuid, ''test'')::text', v_fremd),
         'verweigert', ALLE_AUSSER_SR),
        ('notify_enqueue mit p_vorschau = true', null,
         format('select public.notify_enqueue(%L::uuid, ''strafe_neu'', ''{}''::jsonb, p_vorschau => true)::text', v_fremd),
         'verweigert', ALLE_AUSSER_SR),
        ('push_claim', null,
         'select count(*)::text from public.push_claim(1)',
         'verweigert', ALLE_AUSSER_SR),
        ('push_mark_sent', null,
         format('select public.push_mark_sent(array[%L::uuid])::text', v_fremd),
         'verweigert', ALLE_AUSSER_SR),
        ('push_mark_error', null,
         format('select public.push_mark_error(%L::uuid, ''x'')::text', v_fremd),
         'verweigert', ALLE_AUSSER_SR),
        ('push_subscription_ok', null,
         'select public.push_subscription_ok(''gibt-es-nicht'')::text',
         'verweigert', ALLE_AUSSER_SR),
        ('push_subscription_failed', null,
         'select public.push_subscription_failed(''gibt-es-nicht'', true)::text',
         'verweigert', ALLE_AUSSER_SR),
        ('push_dispatch_tick', null,
         'select public.push_dispatch_tick()::text',
         'verweigert', ALLE_AUSSER_SR),
        ('kategorie_erlaubt (fremdes Profil)', null,
         format('select public.kategorie_erlaubt(%L::uuid, ''absage_kurzfristig'')::text', v_admin),
         'verweigert', ALLE_AUSSER_SR),
        ('in_quiet_hours', null,
         'select public.in_quiet_hours(''22:00''::time, ''08:00''::time)::text',
         'verweigert', ALLE_AUSSER_SR),
        ('Sicht notification_due lesen', null,
         'select count(*)::text from public.notification_due',
         'verweigert', ALLE_AUSSER_SR),

        -- ---- 2) Nur Admin ------------------------------------------------
        ('send_test_notification', null,
         'select public.send_test_notification()::text',
         'nein', NICHT_ADMIN),
        ('send_preview_notification', null,
         'select public.send_preview_notification(''strafe_neu'')::text',
         'nein', NICHT_ADMIN),
        ('set_notification_template', null,
         'select public.set_notification_template(''test'', ''x'', ''y'')::text',
         'nein', NICHT_ADMIN),
        ('notification_templates lesen', null,
         'select count(*)::text from public.notification_templates',
         'leer', array['Spieler','Trainer','Kassenwart']),
        ('notification_templates lesen', null,
         'select count(*)::text from public.notification_templates',
         'verweigert', array['anon']),
        ('send_test_notification', null,
         'select public.send_test_notification()::text',
         'ok', array['Admin']),
        ('send_preview_notification (Vorschau-Pfad über notify_enqueue)', null,
         'select public.send_preview_notification(''strafe_neu'')::text',
         'ok', array['Admin']),
        ('set_notification_template (unveränderter Text)', null,
         'select public.set_notification_template(''test'', t.titel_vorlage, t.text_vorlage)::text from public.notification_templates t where t.kategorie = ''test''',
         'ok', array['Admin']),
        ('notification_templates lesen', null,
         'select count(*)::text from public.notification_templates',
         'voll', array['Admin']),

        -- ---- 3) Server, Cron, Interna (0042b) ----------------------------
        ('sync_bfv_matches', null,
         'select public.sync_bfv_matches(''[]''::jsonb)::text',
         'verweigert', ALLE_AUSSER_SR),
        ('apply_event_fines', null,
         'select public.apply_event_fines()::text',
         'verweigert', ALLE_AUSSER_SR),
        ('apply_fine_surcharges', null,
         'select public.apply_fine_surcharges()::text',
         'verweigert', ALLE_AUSSER_SR),
        ('compute_deadline', null,
         format('select public.compute_deadline(%L::uuid, ''training'', now(), null)::text', v_club),
         'verweigert', ALLE_AUSSER_SR),
        ('my_role (alt, ungenutzt)', null,
         'select public.my_role()::text',
         'verweigert', ALLE_AUSSER_SR),
        ('report_my_payment() (alte Signatur)', null,
         'select public.report_my_payment()::text',
         'verweigert', ALLE_AUSSER_SR),
        ('kategorie_rolle', null,
         'select public.kategorie_rolle(''test'')::text',
         'verweigert', ALLE_AUSSER_SR),
        ('render_vorlage', null,
         'select public.render_vorlage(''{a}'', ''{"a":"1"}''::jsonb, array[''a''], ''{}''::text[])::text',
         'verweigert', ALLE_AUSSER_SR),
        ('Triggerfunktion direkt (events_set_starts_at)', null,
         'select public.events_set_starts_at()::text',
         'verweigert', ALLE_AUSSER_SR),

        -- ---- 4) App-Funktionen bleiben für Angemeldete -------------------
        ('my_roles', null,
         'select public.my_roles()::text',
         'ok', ANGEMELDET),
        ('my_roles', null,
         'select public.my_roles()::text',
         'verweigert', array['anon']),
        ('notification_infos', null,
         'select count(*)::text from public.notification_infos()',
         'voll', ANGEMELDET),
        ('set_notification_prefs (leer)', null,
         'select public.set_notification_prefs(''{}''::jsonb)::text',
         'ok', ANGEMELDET),
        ('is_admin / has_role / my_player_id', null,
         'select (public.is_admin()::text || public.has_role(''coach'')::text || coalesce(public.my_player_id()::text, ''-''))',
         'ok', ANGEMELDET),
        ('is_admin', null,
         'select public.is_admin()::text',
         'verweigert', array['anon']),

        -- ---- 5) Tabellen lesen (RLS-Funktionen müssen greifen) ----------
        ('events lesen', null,
         'select count(*)::text from public.events',
         'voll', ANGEMELDET),
        ('player_status lesen (Policy mit has_role/my_player_id)', null,
         'select count(*)::text from public.player_status',
         'ok', ANGEMELDET),
        ('rsvps lesen (Policy mit has_role/my_player_id)', null,
         'select count(*)::text from public.rsvps',
         'ok', ANGEMELDET),
        ('profiles lesen (Policy mit is_admin)', null,
         'select count(*)::text from public.profiles',
         'voll', ANGEMELDET),
        ('events lesen', null,
         'select count(*)::text from public.events',
         'verweigert', array['anon']),
        ('sportstaetten lesen', null,
         'select count(*)::text from public.sportstaetten',
         'verweigert', array['anon']),

        -- ---- 6) Trigger feuern weiter (EXECUTE wird beim Feuern nicht geprüft)
        ('Rückmeldung anlegen (Trigger rsvp_late_cancel_fine, compute_deadline)', null,
         case when v_ev_frei is null or v_aspieler is null then 'select ''übersprungen''::text'
              else format('with i as (insert into public.rsvps (club_id, event_id, player_id, status) values (%L, %L, %L, ''zu'') returning 1) select count(*)::text from i',
                          v_club, v_ev_frei, v_aspieler) end,
         'eins', array['Admin']),
        ('Termin ändern (Trigger starts_at, ical_seq, deadline_at)', null,
         format('with u as (update public.events set note = note where id = %L returning 1) select count(*)::text from u', v_ev),
         'eins', array['Admin']),

        -- ---- 7) Dispatcher (service_role) -----------------------------------
        ('kategorie_erlaubt', null,
         format('select public.kategorie_erlaubt(%L::uuid, ''test'')::text', v_admin),
         'wahr', array['service_role']),
        ('sync_bfv_matches ausführbar (Recht, ohne Aufruf)', null,
         'select has_function_privilege(''service_role'', ''public.sync_bfv_matches(jsonb)'', ''execute'')::text',
         'wahr', array['service_role']),
        ('echte fällige Zeile erscheint in notification_due',
         format('insert into public.notification_outbox (profile_id, kategorie, titel, text, dedup_key, not_before) values (%L, ''test'', ''Prüfung'', ''Prüfung'', ''pruef0042:faellig'', now() - interval ''1 minute'')', v_admin),
         'select count(*)::text from public.notification_due where dedup_key = ''pruef0042:faellig''',
         'eins', array['service_role']),
        ('echte fällige Zeile wird von push_claim geholt',
         format('insert into public.notification_outbox (profile_id, kategorie, titel, text, dedup_key, not_before) values (%L, ''test'', ''Prüfung'', ''Prüfung'', ''pruef0042:faellig'', now() - interval ''1 minute'')', v_admin),
         'select count(*)::text from public.push_claim(500) c where c.dedup_key = ''pruef0042:faellig''',
         'eins', array['service_role']),
        ('Zeile ohne passende Rolle bleibt draußen (kategorie_erlaubt filtert)',
         format('insert into public.notification_outbox (profile_id, kategorie, titel, text, urgency, dedup_key, not_before) values (%L, ''absage_kurzfristig'', ''Prüfung'', ''Prüfung'', ''high'', ''pruef0042:rolle'', now() - interval ''1 minute'')', v_nutzer),
         'select count(*)::text from public.notification_due where dedup_key = ''pruef0042:rolle''',
         'leer', array['service_role']),
        ('Gegenprobe: dieselbe Zeile mit Trainerrolle wird fällig',
         format('with neu as (insert into public.user_roles (user_id, role, club_id) values (%L, ''coach'', %L) returning 1) ', v_nutzer, v_club) ||
         format('insert into public.notification_outbox (profile_id, kategorie, titel, text, urgency, dedup_key, not_before) values (%L, ''absage_kurzfristig'', ''Prüfung'', ''Prüfung'', ''high'', ''pruef0042:rolle'', now() - interval ''1 minute'')', v_nutzer),
         'select count(*)::text from public.notification_due where dedup_key = ''pruef0042:rolle''',
         'eins', array['service_role']),
        ('notify_enqueue (Server, ohne Vorschau)', null,
         format('select public.notify_enqueue(%L::uuid, ''test'', p_dedup => ''pruef0042:'' || clock_timestamp()::text)::text', v_admin),
         'ok', array['service_role']),
        ('notify_enqueue mit p_vorschau = true (Server)', null,
         format('select public.notify_enqueue(%L::uuid, ''strafe_neu'', ''{}''::jsonb, p_vorschau => true)::text', v_admin),
         'verweigert', array['service_role'])
      ) as t(fall, vorbereitung, sql, erwartet, rollen)
      where r.rolle = any(t.rollen)
    loop
      v_nr := v_nr + 1;
      v_ok := false; v_txt := null; v_state := null; v_msg := null;

      begin
        -- Vorbereitung als postgres (wird mit zurückgerollt)
        if r.zusatzrolle is not null then
          insert into public.user_roles (user_id, role, club_id) values (v_nutzer, r.zusatzrolle, v_club);
        end if;
        if f.vorbereitung is not null then
          execute f.vorbereitung;
        end if;

        -- Rolle annehmen
        if r.rolle = 'anon' then
          perform set_config('request.jwt.claims', '{"role":"anon"}', true);
          execute 'set local role anon';
        elsif r.rolle = 'service_role' then
          perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
          execute 'set local role service_role';
        else
          perform set_config('request.jwt.claims',
            json_build_object('sub', case when r.rolle = 'Admin' then v_admin else v_nutzer end,
                              'role', 'authenticated')::text, true);
          execute 'set local role authenticated';
        end if;

        execute f.sql into v_txt;
        v_ok := true;
        raise exception using errcode = 'P0042', message = 'zurückrollen';
      exception when others then
        if sqlstate <> 'P0042' then
          v_state := sqlstate; v_msg := sqlerrm;
        end if;
      end;

      -- Hier ist die Untertransaktion zurückgerollt, Rolle wieder postgres.
      v_urteil := case
        when v_ok and v_txt = 'übersprungen' then 'ÜBERSPRUNGEN'
        when f.erwartet = 'verweigert' then case when not v_ok and v_state = '42501' then 'PASS' else 'FAIL' end
        when f.erwartet = 'nein' then case when not v_ok and v_state <> '23503' then 'PASS' else 'FAIL' end
        when f.erwartet = 'ok'   then case when v_ok then 'PASS' else 'FAIL' end
        when f.erwartet = 'leer' then case when v_ok and v_txt = '0' then 'PASS' else 'FAIL' end
        when f.erwartet = 'voll' then case when v_ok and v_txt ~ '^[0-9]+$' and v_txt::bigint > 0 then 'PASS' else 'FAIL' end
        when f.erwartet = 'eins' then case when v_ok and v_txt = '1' then 'PASS' else 'FAIL' end
        when f.erwartet = 'wahr' then case when v_ok and v_txt = 'true' then 'PASS' else 'FAIL' end
      end;

      insert into pruef_0042 values (
        v_nr, r.rolle, f.fall, f.erwartet,
        case when v_ok then 'gelungen: ' || coalesce(left(v_txt, 60), '(null)')
             else 'abgelehnt: ' || v_state || ' ' || left(v_msg, 120) end,
        v_urteil);
    end loop;
  end loop;
end
$pruef$;

select nr, rolle, fall, erwartet, ergebnis, urteil
  from pruef_0042
union all
select null, 'SUMME',
       count(*) || ' Fälle: '
       || count(*) filter (where urteil = 'PASS') || ' PASS, '
       || count(*) filter (where urteil = 'FAIL') || ' FAIL, '
       || count(*) filter (where urteil = 'ÜBERSPRUNGEN') || ' übersprungen',
       null, null, null
  from pruef_0042
order by nr nulls last;
