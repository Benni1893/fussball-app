-- ============================================================================
-- FC Fasanerie-Nord - Migration 0042b: Rechte nach Vollinventar
--
-- Folgt auf 0042 (Push-Rechte). Vollinventar vom 03.10.2026: alle 45
-- Funktionen und alle 18 Tabellen/Sichten in public, auf die anon oder
-- authenticated Rechte hatten, je mit Nutzer, Begruendung und Urteil
-- (.design-sync/reference/app/einstellungen-v2/PHASE0.md, Abschnitt
-- "Vollinventar"). Alles ohne Begruendung wird hier zugemacht.
--
-- GRUNDSATZ: erst alles entziehen, dann ausdruecklich freigeben.
--   * Funktionen: EXECUTE fuer PUBLIC, anon und authenticated bei JEDER
--     Funktion in public entzogen (alle Signaturen, ausser Funktionen von
--     Erweiterungen). Danach bekommt authenticated genau die Funktionen, die
--     das Frontend (db.js) aufruft oder die in einer RLS-Policy stehen.
--     service_role behaelt seine Rechte (wird nirgends entzogen) und bekommt
--     zur Klarheit die, die der Server braucht, noch einmal ausdruecklich.
--   * anon bekommt GAR NICHTS mehr in public: die App liest und schreibt
--     vor der Anmeldung nichts (init() zeigt ohne Sitzung sofort die
--     Anmeldung, loadAll() laeuft erst danach). Gilt fuer Funktionen,
--     Tabellen, Sichten und Sequenzen.
--   * authenticated verliert TRUNCATE, REFERENCES und TRIGGER auf allen
--     Tabellen. TRUNCATE unterliegt keiner RLS; PostgREST bietet es zwar
--     nicht an, aber ein Recht ohne Nutzen gehoert weg. SELECT, INSERT,
--     UPDATE, DELETE bleiben - dort entscheidet die RLS.
--   * Default Privileges fuer kuenftige Tabellen und Sequenzen entsprechend
--     (Funktionen hat 0042 schon erledigt).
--
-- WAS SICH NICHT AENDERT:
--   * Trigger. Postgres prueft EXECUTE auf eine Triggerfunktion nur beim
--     Anlegen des Triggers, nicht beim Feuern. Die Prueffaelle in
--     supabase/checks/0042_rechtepruef.sql (rsvp anlegen, Termin aendern)
--     belegen das nach dem Einspielen.
--   * pg_cron (apply_event_fines, apply_fine_surcharges, push_dispatch_tick,
--     notification_outbox_cleanup) laeuft als postgres = Eigentuemer.
--   * Interne Hilfsfunktionen (compute_deadline, kategorie_rolle,
--     render_vorlage, has_role ...) werden nur aus SECURITY-DEFINER-Funktionen
--     heraus aufgerufen (geprueft per pg_proc.prosrc) und laufen dort als
--     postgres.
--   * Die Sicht notification_due (security_invoker) liest nur service_role;
--     sie ruft kategorie_erlaubt und in_quiet_hours auf, beide behalten
--     service_role ausdruecklich.
--   * api/sync-bfv.js ruft sync_bfv_matches mit dem Service-Key und
--     my_roles mit dem Token des Nutzers (authenticated).
--
-- WARUM 0042 kategorie_erlaubt NICHT "uebersehen" hat: die Rechte waren nach
-- 0042 richtig (proacl {postgres=X, service_role=X}; echter Aufruf als anon
-- ueber PostgREST: 42501). Die fuenf FAIL im ersten Prueflauf waren ein
-- Fehler des Pruefskripts: kategorie_erlaubt ist STABLE, und in
-- "select count(*) from (select f(...)) x" verwirft der Planer den
-- ungenutzten Ausdruck - die Funktion wird nie aufgerufen, also auch nie
-- auf Rechte geprueft. Das Pruefskript wertet den Rueckgabewert jetzt aus.
-- Die Gegenprobe unten prueft trotzdem ueber ALLE Signaturen und PUBLIC.
--
-- Laeuft als eine Transaktion. Schlaegt die Gegenprobe fehl, wird nichts
-- gespeichert. Wiederholbar.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1) Funktionen: alles entziehen
-- ----------------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and not exists (select 1 from pg_depend d
                        where d.classid = 'pg_proc'::regclass and d.objid = p.oid
                          and d.deptype = 'e')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.sig);
  end loop;
end
$$;

-- ----------------------------------------------------------------------------
-- 2) authenticated: ausdruecklich freigeben
-- ----------------------------------------------------------------------------
-- a) In RLS-Policies (ohne sie scheitert jedes Lesen der Tabellen)
grant execute on function public.has_role(text)    to authenticated;
grant execute on function public.is_admin()        to authenticated;
grant execute on function public.my_player_id()    to authenticated;

-- b) Aufrufe aus db.js (Rollenpruefung jeweils in der Funktion)
grant execute on function public.my_roles()                                   to authenticated;  -- db.js myRoles, api/sync-bfv.js
grant execute on function public.set_my_player(uuid)                          to authenticated;  -- Spieler zuordnen
grant execute on function public.set_player_status(uuid, text, text, date)    to authenticated;
grant execute on function public.set_lineup_active(uuid)                      to authenticated;
grant execute on function public.set_ical_url(text)                           to authenticated;
grant execute on function public.my_calendar_token()                          to authenticated;
grant execute on function public.regenerate_calendar_token()                  to authenticated;
grant execute on function public.set_calendar_hint(boolean, boolean)          to authenticated;
grant execute on function public.create_fines_batch(jsonb, text)              to authenticated;
grant execute on function public.confirm_fines(uuid[], text)                  to authenticated;
grant execute on function public.mark_fines_paid(uuid[], text)                to authenticated;
grant execute on function public.reject_fine(uuid, text)                      to authenticated;
grant execute on function public.cancel_batch(uuid)                           to authenticated;
grant execute on function public.cancel_fine(uuid)                            to authenticated;
grant execute on function public.report_my_payment(text, text)                to authenticated;  -- nur die neue Signatur (0040)
grant execute on function public.upsert_push_subscription(text, text, text, text, text) to authenticated;
grant execute on function public.delete_push_subscription(text)               to authenticated;
grant execute on function public.set_notification_prefs(jsonb)                to authenticated;
grant execute on function public.notification_infos()                         to authenticated;
grant execute on function public.send_test_notification()                     to authenticated;  -- prueft is_admin()
grant execute on function public.send_preview_notification(text)              to authenticated;  -- prueft is_admin()
grant execute on function public.set_notification_template(text, text, text, boolean) to authenticated;  -- prueft is_admin()
grant execute on function public.delete_preview_notifications()               to authenticated;  -- nur eigene Zeilen

-- ----------------------------------------------------------------------------
-- 3) service_role: was der Server braucht, ausdruecklich
-- ----------------------------------------------------------------------------
grant execute on function public.sync_bfv_matches(jsonb)                      to service_role;  -- api/sync-bfv.js
grant execute on function public.my_roles()                                   to service_role;
grant execute on function public.push_claim(integer)                          to service_role;  -- api/dispatch-push.js
grant execute on function public.push_mark_sent(uuid[])                       to service_role;
grant execute on function public.push_mark_error(uuid, text)                  to service_role;
grant execute on function public.push_subscription_ok(text)                   to service_role;
grant execute on function public.push_subscription_failed(text, boolean)      to service_role;
grant execute on function public.notify_enqueue(uuid, text, jsonb, text, text, text, timestamptz, timestamptz, boolean) to service_role;
grant execute on function public.kategorie_erlaubt(uuid, text)                to service_role;  -- in notification_due
grant execute on function public.in_quiet_hours(time, time)                   to service_role;  -- in notification_due

-- ----------------------------------------------------------------------------
-- 4) Tabellen, Sichten, Sequenzen
-- ----------------------------------------------------------------------------
revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke truncate, references, trigger on all tables in schema public from authenticated;

-- ----------------------------------------------------------------------------
-- 5) Default Privileges fuer kuenftige Tabellen und Sequenzen (Rolle postgres)
-- ----------------------------------------------------------------------------
alter default privileges for role postgres in schema public
  revoke all on tables from anon;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon;
alter default privileges for role postgres in schema public
  revoke truncate, references, trigger on tables from authenticated;

-- ----------------------------------------------------------------------------
-- Gegenprobe - ueber ALLE Funktionen und Signaturen, einschliesslich PUBLIC
-- ----------------------------------------------------------------------------
do $$
declare
  v_fehl   text[] := '{}';
  v_soll   text[] := array[
    'has_role(text)', 'is_admin()', 'my_player_id()',
    'my_roles()', 'set_my_player(uuid)', 'set_player_status(uuid,text,text,date)',
    'set_lineup_active(uuid)', 'set_ical_url(text)', 'my_calendar_token()',
    'regenerate_calendar_token()', 'set_calendar_hint(boolean,boolean)',
    'create_fines_batch(jsonb,text)', 'confirm_fines(uuid[],text)',
    'mark_fines_paid(uuid[],text)', 'reject_fine(uuid,text)', 'cancel_batch(uuid)',
    'cancel_fine(uuid)', 'report_my_payment(text,text)',
    'upsert_push_subscription(text,text,text,text,text)', 'delete_push_subscription(text)',
    'set_notification_prefs(jsonb)', 'notification_infos()', 'send_test_notification()',
    'send_preview_notification(text)', 'set_notification_template(text,text,text,boolean)',
    'delete_preview_notifications()'];
  v_ist    text[];
  v_x      text[];
  v_server text[] := array[
    'sync_bfv_matches(jsonb)', 'push_claim(integer)', 'push_mark_sent(uuid[])',
    'push_mark_error(uuid,text)', 'push_subscription_ok(text)',
    'push_subscription_failed(text,boolean)', 'kategorie_erlaubt(uuid,text)',
    'in_quiet_hours(time without time zone,time without time zone)',
    'notify_enqueue(uuid,text,jsonb,text,text,text,timestamp with time zone,timestamp with time zone,boolean)'];
begin
  -- Jede Soll-Signatur muss es geben (Tippfehler faellt hier auf).
  select array_agg(s) into v_x from unnest(v_soll || v_server) s
   where to_regprocedure('public.' || s) is null;
  if v_x is not null then v_fehl := v_fehl || ('unbekannte Signatur: ' || array_to_string(v_x, ', ')); end if;

  -- PUBLIC oder anon in irgendeiner proacl? (proacl null = eingebauter
  -- Standard = PUBLIC darf; deshalb acldefault einsetzen.)
  select array_agg(p.oid::regprocedure::text order by 1) into v_x
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and not exists (select 1 from pg_depend d where d.classid = 'pg_proc'::regclass
                      and d.objid = p.oid and d.deptype = 'e')
     and (exists (select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                   where a.grantee in (0, 'anon'::regrole))
          or has_function_privilege('anon', p.oid, 'execute'));
  if v_x is not null then v_fehl := v_fehl || ('PUBLIC/anon darf: ' || array_to_string(v_x, ', ')); end if;

  -- authenticated darf GENAU die Soll-Liste.
  select array_agg(replace(p.oid::regprocedure::text, 'public.', '') order by 1) into v_ist
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and has_function_privilege('authenticated', p.oid, 'execute');
  select array_agg(s) into v_x from unnest(v_ist) s where s <> all(v_soll);
  if v_x is not null then v_fehl := v_fehl || ('authenticated darf zu viel: ' || array_to_string(v_x, ', ')); end if;
  select array_agg(s) into v_x from unnest(v_soll) s where s <> all(coalesce(v_ist, '{}'));
  if v_x is not null then v_fehl := v_fehl || ('authenticated fehlt: ' || array_to_string(v_x, ', ')); end if;

  -- Server-Funktionen fuer service_role.
  select array_agg(s) into v_x from unnest(v_server) s
   where not has_function_privilege('service_role', ('public.' || s)::regprocedure, 'execute');
  if v_x is not null then v_fehl := v_fehl || ('service_role fehlt: ' || array_to_string(v_x, ', ')); end if;

  -- anon: kein Recht auf irgendeine Tabelle, Sicht oder Sequenz.
  select array_agg(c.relname::text order by 1) into v_x
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('r','v','m','p','f')
     and (has_table_privilege('anon', c.oid, 'select') or has_table_privilege('anon', c.oid, 'insert')
       or has_table_privilege('anon', c.oid, 'update') or has_table_privilege('anon', c.oid, 'delete')
       or has_table_privilege('anon', c.oid, 'truncate') or has_table_privilege('anon', c.oid, 'references')
       or has_table_privilege('anon', c.oid, 'trigger'));
  if v_x is not null then v_fehl := v_fehl || ('anon hat Tabellenrechte: ' || array_to_string(v_x, ', ')); end if;
  select array_agg(c.relname::text order by 1) into v_x
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'S'
     and (has_sequence_privilege('anon', c.oid, 'usage') or has_sequence_privilege('anon', c.oid, 'select')
       or has_sequence_privilege('anon', c.oid, 'update'));
  if v_x is not null then v_fehl := v_fehl || ('anon hat Sequenzrechte: ' || array_to_string(v_x, ', ')); end if;

  -- authenticated: kein TRUNCATE/REFERENCES/TRIGGER.
  select array_agg(c.relname::text order by 1) into v_x
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('r','p')
     and (has_table_privilege('authenticated', c.oid, 'truncate')
       or has_table_privilege('authenticated', c.oid, 'references')
       or has_table_privilege('authenticated', c.oid, 'trigger'));
  if v_x is not null then v_fehl := v_fehl || ('authenticated hat TRUNCATE/REFERENCES/TRIGGER: ' || array_to_string(v_x, ', ')); end if;

  -- Das Frontend muss weiter lesen koennen (RLS entscheidet ueber Zeilen).
  select array_agg(t) into v_x
    from unnest(array['clubs','players','events','fine_catalog','fines','rsvps','lineups',
                      'sportstaetten','player_status','fine_status_log','profiles','user_roles',
                      'push_subscriptions','notification_prefs','notification_templates',
                      'notification_outbox','team_settings']) t
   where not has_table_privilege('authenticated', ('public.' || t)::regclass, 'select');
  if v_x is not null then v_fehl := v_fehl || ('authenticated liest nicht mehr: ' || array_to_string(v_x, ', ')); end if;

  -- Default Privileges: anon nichts auf Tabellen/Sequenzen, authenticated
  -- kein TRUNCATE/REFERENCES/TRIGGER, Funktionen wie in 0042.
  if exists (
    select 1 from pg_default_acl d, aclexplode(d.defaclacl) a
     where d.defaclrole = 'postgres'::regrole
       and d.defaclnamespace = 'public'::regnamespace
       and (   (a.grantee = 'anon'::regrole and d.defaclobjtype in ('r','S','f'))
            or (a.grantee = 'authenticated'::regrole and d.defaclobjtype = 'r'
                and a.privilege_type in ('TRUNCATE','REFERENCES','TRIGGER'))
            or (a.grantee = 'authenticated'::regrole and d.defaclobjtype = 'f'))
  ) then
    v_fehl := v_fehl || 'Default Privileges geben noch zu viel'::text;
  end if;

  if array_length(v_fehl, 1) > 0 then
    raise exception 'Gegenprobe 0042b fehlgeschlagen: %', v_fehl;
  end if;
  raise notice 'Gegenprobe 0042b bestanden: authenticated darf % Funktionen, anon nichts.', array_length(v_soll, 1);
end;
$$;

commit;

-- ============================================================================
-- RUECKBAU (nicht automatisch ausgefuehrt - bei Bedarf als Block ausfuehren)
-- Stellt den Stand nach 0042 her (anon und authenticated wieder wie vorher).
-- ============================================================================
-- begin;
-- do $$ declare r record; begin
--   for r in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--             where n.nspname = 'public'
--               and p.proname not in ('notify_enqueue','push_claim','push_mark_sent','push_mark_error',
--                                     'push_subscription_ok','push_subscription_failed','push_dispatch_tick',
--                                     'notification_outbox_cleanup','profiles_ensure_notification_prefs',
--                                     'kategorie_erlaubt','render_vorlage')
--   loop execute format('grant execute on function %s to public, anon, authenticated', r.sig); end loop;
-- end $$;
-- grant execute on function public.render_vorlage(text, jsonb, text[], text[]) to authenticated;
-- grant all on all tables    in schema public to anon;
-- grant all on all sequences in schema public to anon;
-- grant truncate, references, trigger on all tables in schema public to authenticated;
-- revoke all on public.notification_due from anon, authenticated;  -- bleibt wie 0042
-- alter default privileges for role postgres in schema public grant all on tables to anon;
-- alter default privileges for role postgres in schema public grant all on sequences to anon;
-- alter default privileges for role postgres in schema public grant truncate, references, trigger on tables to authenticated;
-- commit;
