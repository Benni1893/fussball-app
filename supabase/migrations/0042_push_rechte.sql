-- ============================================================================
-- FC Fasanerie-Nord - Migration 0042: Push-Rechte dicht (Hotfix)
--
-- Befund aus Phase 0 "Einstellungen v2" (03.10.2026), live geprueft:
-- Postgres gibt jeder neuen Funktion EXECUTE fuer PUBLIC, und Supabase legt
-- per Default-Privileges noch anon, authenticated und service_role dazu. Bei
-- den Push-Funktionen aus 0034 bis 0039 wurde das nie zurueckgenommen. Folge:
--
--   notify_enqueue      jeder (auch ohne Anmeldung, nur mit dem oeffentlichen
--                       Schluessel) konnte an JEDES Profil eine Nachricht
--                       einreihen, mit frei gewaehlten Platzhalterwerten -
--                       also faktisch Freitext - und mit p_vorschau = true
--                       an Schalter, Rolle und Ruhezeit vorbei.
--   push_claim          lieferte die fertigen Texte fremder Nachrichten.
--   push_mark_sent/_error  konnten Zustellungen unterdruecken.
--   notification_due    die Sicht gehoert postgres und lief ohne
--                       security_invoker: sie umging die RLS der Outbox und
--                       war fuer anon lesbar.
--   send_test_notification  ohne Rollenpruefung.
--
-- Was diese Migration tut:
--   1. notify_enqueue: Vorschau nur fuer Admin, serverseitig geprueft.
--   2. send_test_notification: nur Admin.
--   3. EXECUTE entziehen (PUBLIC, anon, authenticated) fuer alles, was nur
--      der Dispatcher oder die Datenbank selbst aufruft. Der Dispatcher
--      (api/dispatch-push.js) arbeitet mit dem Service-Key und behaelt sein
--      Recht ausdruecklich. pg_cron laeuft als postgres (Eigentuemer) und ist
--      vom Entzug nicht betroffen. send_test_notification und
--      send_preview_notification sind SECURITY DEFINER mit Eigentuemer
--      postgres und rufen notify_enqueue deshalb weiter auf.
--   4. notification_due: security_invoker an, Lesen nur service_role.
--   5. Default Privileges: neue Funktionen bekommen KEIN EXECUTE mehr fuer
--      PUBLIC, anon und authenticated.
--
-- AB DIESER MIGRATION GILT: jede Funktion, die das Frontend aufruft, bekommt
-- in ihrer Migration ein ausdrueckliches
--     grant execute on function public.<name>(<argumente>) to authenticated;
-- Ohne diese Zeile ist sie fuer die App nicht aufrufbar - absichtlich. Was
-- nur der Server braucht, bekommt "to service_role". Steht auch in
-- .design-sync/conventions.md ("Neue Datenbankfunktionen").
--
-- Fuer welche Rolle die Default Privileges gelten (geprueft 03.10.2026):
--   * Migrationen laufen im SQL-Editor als postgres; alle 55 Funktionen in
--     public gehoeren postgres. Die Eintraege, die anon und authenticated
--     EXECUTE geben, stehen in pg_default_acl fuer Rolle postgres, Schema
--     public. Genau die nimmt Abschnitt 5 zurueck.
--   * Fuer supabase_admin gibt es einen gleichlautenden Eintrag. postgres ist
--     kein Mitglied von supabase_admin und kann ihn nicht aendern. Er greift
--     nur fuer Objekte, die die Plattform selbst anlegt, nicht fuer unsere
--     Migrationen.
--   * EXECUTE fuer PUBLIC ist kein Eintrag je Schema, sondern der eingebaute
--     globale Standard von Postgres. Ein "in schema public ... from public"
--     wirkt darauf nicht, weil Schema-Eintraege nur zum globalen Standard
--     hinzukommen. PUBLIC wird deshalb global (ohne "in schema") entzogen,
--     ebenfalls nur fuer Objekte von postgres.
--   * Bestehende Funktionen aendern sich dadurch nicht; Default Privileges
--     gelten nur fuer kuenftig angelegte. Tabellen und Sequenzen bleiben bei
--     ihren Defaults (dort schuetzt RLS).
--
-- BEWUSST NICHT GEAENDERT: Tabellen und ihre Policies (RLS ist dort dicht,
-- nur select-Policies), set_notification_template und
-- send_preview_notification (pruefen is_admin() bereits), alle Schreibwege
-- der Nutzer (upsert/delete_push_subscription, set_notification_prefs,
-- delete_preview_notifications, notification_infos), der Versand selbst.
--
-- Laeuft als eine Transaktion. Schlaegt die Gegenprobe fehl, wird nichts
-- gespeichert. Wiederholbar.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1) notify_enqueue: Vorschau nur fuer Admin
-- ----------------------------------------------------------------------------
-- Inhalt wie 0038, eine Pruefung mehr. auth.uid() liest den Aufrufer aus dem
-- JWT, auch wenn der Aufruf ueber eine SECURITY-DEFINER-Funktion kommt - die
-- Pruefung greift also auch dort. Aufrufe ohne Anmeldung (Service-Key, Cron)
-- duerfen keine Vorschau erzeugen; das braucht heute auch niemand.
create or replace function public.notify_enqueue(
  p_profile    uuid,
  p_kategorie  text,
  p_daten      jsonb   default '{}',
  p_dedup      text    default null,
  p_bundle     text    default null,
  p_tag        text    default null,
  p_not_before timestamptz default now(),
  p_ttl_bis    timestamptz default null,
  p_vorschau   boolean default false
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  t        public.notification_templates%rowtype;
  v_titel  text;
  v_text   text;
  v_link   text;
  v_ttl    integer;
  v_fehler text := null;
  v_id     uuid;
begin
  if p_profile is null then return null; end if;

  if coalesce(p_vorschau, false) and not public.is_admin() then
    raise exception 'Vorschau nur fuer Admin.' using errcode = '42501';
  end if;

  select * into t from public.notification_templates where kategorie = p_kategorie;
  if t.kategorie is null then
    raise exception 'Unbekannte Kategorie: %', p_kategorie;
  end if;
  if not t.aktiv and not p_vorschau then
    return null;
  end if;

  begin
    v_titel := public.render_vorlage(t.titel_vorlage,     p_daten, t.platzhalter, t.platzhalter_optional);
    v_text  := public.render_vorlage(t.text_vorlage,      p_daten, t.platzhalter, t.platzhalter_optional);
    v_link  := public.render_vorlage(t.deep_link_vorlage, p_daten, t.platzhalter, t.platzhalter_optional);
  exception when others then
    v_fehler := left(sqlerrm, 400);
    v_titel  := t.titel_vorlage;
    v_text   := t.text_vorlage;
    v_link   := t.deep_link_vorlage;
  end;

  if t.ttl_regel = 'bis_zeitpunkt' and p_ttl_bis is not null then
    v_ttl := greatest(60, least(t.ttl_sekunden,
               floor(extract(epoch from (p_ttl_bis - now())))::integer));
  else
    v_ttl := t.ttl_sekunden;
  end if;

  insert into public.notification_outbox
    (profile_id, kategorie, titel, text, deep_link, tag, urgency, ttl_seconds,
     dedup_key, bundle_key, not_before, ist_vorschau, error)
  values
    (p_profile, p_kategorie, left(v_titel, 120), left(v_text, 400), v_link,
     coalesce(p_tag, p_kategorie), t.urgency, v_ttl,
     p_dedup, p_bundle, p_not_before, p_vorschau, v_fehler)
  on conflict (dedup_key) do nothing
  returning id into v_id;

  return v_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- 2) Testnachricht nur fuer Admin
-- ----------------------------------------------------------------------------
create or replace function public.send_test_notification()
returns uuid
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.'; end if;
  if not public.is_admin() then
    raise exception 'Nur Admin.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.push_subscriptions where profile_id = auth.uid()) then
    raise exception 'Fuer dieses Konto ist noch kein Geraet angemeldet.';
  end if;

  return public.notify_enqueue(
    p_profile   => auth.uid(),
    p_kategorie => 'test',
    p_daten     => '{}'::jsonb,
    -- Zeitstempel im Schluessel: zweimal druecken soll zweimal ankommen.
    p_dedup     => 'test:' || auth.uid()::text || ':' || extract(epoch from clock_timestamp())::bigint::text,
    p_tag       => 'test');
end;
$$;

-- ----------------------------------------------------------------------------
-- 3) EXECUTE entziehen
-- ----------------------------------------------------------------------------
-- Einreihen: nur noch ueber die SECURITY-DEFINER-Funktionen mit Pruefung
-- (send_test_notification, send_preview_notification, spaeter die Nachfrage
-- aus P1) und ueber den Server. Niemand von aussen uebergibt mehr Daten.
revoke execute on function public.notify_enqueue(uuid, text, jsonb, text, text, text, timestamptz, timestamptz, boolean)
  from public, anon, authenticated;
grant  execute on function public.notify_enqueue(uuid, text, jsonb, text, text, text, timestamptz, timestamptz, boolean)
  to service_role;

-- Was nur der Dispatcher braucht: ausschliesslich service_role.
revoke execute on function public.push_claim(integer)                     from public, anon, authenticated;
revoke execute on function public.push_mark_sent(uuid[])                  from public, anon, authenticated;
revoke execute on function public.push_mark_error(uuid, text)             from public, anon, authenticated;
revoke execute on function public.push_subscription_ok(text)              from public, anon, authenticated;
revoke execute on function public.push_subscription_failed(text, boolean) from public, anon, authenticated;
grant  execute on function public.push_claim(integer)                     to service_role;
grant  execute on function public.push_mark_sent(uuid[])                  to service_role;
grant  execute on function public.push_mark_error(uuid, text)             to service_role;
grant  execute on function public.push_subscription_ok(text)              to service_role;
grant  execute on function public.push_subscription_failed(text, boolean) to service_role;

-- Was nur pg_cron (als postgres) oder ein Trigger aufruft: niemand von aussen.
revoke execute on function public.push_dispatch_tick()                  from public, anon, authenticated;
revoke execute on function public.notification_outbox_cleanup()         from public, anon, authenticated;
revoke execute on function public.profiles_ensure_notification_prefs()  from public, anon, authenticated;

-- Verraet Rolle und Spielerverknuepfung beliebiger Profile. Wird nur in der
-- Sicht notification_due gebraucht, nicht im Frontend.
revoke execute on function public.kategorie_erlaubt(uuid, text) from public, anon, authenticated;
grant  execute on function public.kategorie_erlaubt(uuid, text) to service_role;

-- Rein rechnend und ohne Tabellenzugriff, fuer Angemeldete harmlos (0038
-- gibt es authenticated ausdruecklich). Nur ohne Anmeldung zu.
revoke execute on function public.render_vorlage(text, jsonb, text[], text[]) from public, anon;

-- ----------------------------------------------------------------------------
-- 4) Die faellige Sicht
-- ----------------------------------------------------------------------------
-- security_invoker: wer die Sicht liest, unterliegt der RLS der Outbox wie
-- beim direkten Lesen. push_claim und push_dispatch_tick laufen als
-- Eigentuemer postgres und sehen weiter alles; service_role umgeht RLS.
alter view public.notification_due set (security_invoker = true);
revoke all    on public.notification_due from public, anon, authenticated, service_role;
grant  select on public.notification_due to service_role;

-- ----------------------------------------------------------------------------
-- 5) Default Privileges fuer kuenftige Funktionen
-- ----------------------------------------------------------------------------
-- Global (alle Schemata) fuer PUBLIC, im Schema public fuer anon und
-- authenticated. service_role behaelt seinen Default. Begruendung im Kopf.
alter default privileges for role postgres
  revoke execute on functions from public;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated;

-- ----------------------------------------------------------------------------
-- Gegenprobe
-- ----------------------------------------------------------------------------
do $$
declare
  r       record;
  v_fehl  text[] := '{}';
begin
  -- Fuer anon und authenticated darf keine dieser Funktionen ausfuehrbar sein.
  for r in
    select p.oid, p.proname
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('notify_enqueue','push_claim','push_mark_sent','push_mark_error',
                         'push_subscription_ok','push_subscription_failed','push_dispatch_tick',
                         'notification_outbox_cleanup','profiles_ensure_notification_prefs',
                         'kategorie_erlaubt')
  loop
    if has_function_privilege('anon', r.oid, 'execute') then
      v_fehl := v_fehl || ('anon darf ' || r.proname);
    end if;
    if has_function_privilege('authenticated', r.oid, 'execute') then
      v_fehl := v_fehl || ('authenticated darf ' || r.proname);
    end if;
  end loop;

  -- Der Dispatcher muss weiterarbeiten koennen.
  for r in
    select p.oid, p.proname
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('push_claim','push_mark_sent','push_mark_error',
                         'push_subscription_ok','push_subscription_failed','notify_enqueue')
  loop
    if not has_function_privilege('service_role', r.oid, 'execute') then
      v_fehl := v_fehl || ('service_role darf nicht ' || r.proname);
    end if;
  end loop;

  -- Die Schreibwege der Nutzer muessen offen bleiben.
  for r in
    select p.oid, p.proname
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('send_test_notification','send_preview_notification',
                         'set_notification_template','delete_preview_notifications',
                         'set_notification_prefs','upsert_push_subscription',
                         'delete_push_subscription','notification_infos')
  loop
    if not has_function_privilege('authenticated', r.oid, 'execute') then
      v_fehl := v_fehl || ('authenticated darf nicht mehr ' || r.proname);
    end if;
  end loop;

  if has_table_privilege('anon', 'public.notification_due', 'select') then
    v_fehl := v_fehl || 'anon liest notification_due'::text;
  end if;
  if has_table_privilege('authenticated', 'public.notification_due', 'select') then
    v_fehl := v_fehl || 'authenticated liest notification_due'::text;
  end if;
  if not has_table_privilege('service_role', 'public.notification_due', 'select') then
    v_fehl := v_fehl || 'service_role liest notification_due nicht'::text;
  end if;
  if not exists (select 1 from pg_class
                  where oid = 'public.notification_due'::regclass
                    and reloptions @> array['security_invoker=true']) then
    v_fehl := v_fehl || 'notification_due ohne security_invoker'::text;
  end if;

  -- Die neuen Pruefungen muessen im Funktionstext stehen.
  if position('Vorschau nur fuer Admin' in pg_get_functiondef(
       'public.notify_enqueue(uuid, text, jsonb, text, text, text, timestamptz, timestamptz, boolean)'::regprocedure)) = 0 then
    v_fehl := v_fehl || 'notify_enqueue ohne Vorschau-Pruefung'::text;
  end if;
  if position('is_admin()' in pg_get_functiondef('public.send_test_notification()'::regprocedure)) = 0 then
    v_fehl := v_fehl || 'send_test_notification ohne Admin-Pruefung'::text;
  end if;

  -- Default Privileges: kein EXECUTE-Default mehr fuer PUBLIC (global) und
  -- fuer anon/authenticated (Schema public), jeweils fuer Objekte von postgres.
  if exists (
    select 1
      from pg_default_acl d, aclexplode(d.defaclacl) a
     where d.defaclrole = 'postgres'::regrole
       and d.defaclobjtype = 'f'
       and a.privilege_type = 'EXECUTE'
       and (   (d.defaclnamespace = 0 and a.grantee = 0)
            or (d.defaclnamespace = 'public'::regnamespace
                and a.grantee in ('anon'::regrole, 'authenticated'::regrole)))
  ) then
    v_fehl := v_fehl || 'Default Privileges geben noch EXECUTE'::text;
  end if;
  -- Ohne globalen Eintrag gilt der eingebaute Standard (PUBLIC = EXECUTE).
  if not exists (select 1 from pg_default_acl
                  where defaclrole = 'postgres'::regrole
                    and defaclnamespace = 0 and defaclobjtype = 'f') then
    v_fehl := v_fehl || 'globaler Default fuer Funktionen fehlt (PUBLIC behielte EXECUTE)'::text;
  end if;

  if array_length(v_fehl, 1) > 0 then
    raise exception 'Gegenprobe 0042 fehlgeschlagen: %', v_fehl;
  end if;
  raise notice 'Gegenprobe 0042 bestanden.';
end;
$$;

commit;

-- ============================================================================
-- RUECKBAU (nicht automatisch ausgefuehrt - bei Bedarf als Block ausfuehren)
-- Stellt die Rechte von vorher her. Die Funktionen behalten ihre neuen
-- Pruefungen; fuer den alten Funktionstext 0038 bzw. 0036 erneut ausfuehren.
-- ============================================================================
-- begin;
-- grant execute on function public.notify_enqueue(uuid, text, jsonb, text, text, text, timestamptz, timestamptz, boolean) to public, anon, authenticated;
-- grant execute on function public.push_claim(integer)                     to public, anon, authenticated;
-- grant execute on function public.push_mark_sent(uuid[])                  to public, anon, authenticated;
-- grant execute on function public.push_mark_error(uuid, text)             to public, anon, authenticated;
-- grant execute on function public.push_subscription_ok(text)              to public, anon, authenticated;
-- grant execute on function public.push_subscription_failed(text, boolean) to public, anon, authenticated;
-- grant execute on function public.push_dispatch_tick()                    to public, anon, authenticated;
-- grant execute on function public.notification_outbox_cleanup()           to public, anon, authenticated;
-- grant execute on function public.profiles_ensure_notification_prefs()    to public, anon, authenticated;
-- grant execute on function public.kategorie_erlaubt(uuid, text)           to public, anon, authenticated;
-- grant execute on function public.render_vorlage(text, jsonb, text[], text[]) to public, anon;
-- alter view public.notification_due reset (security_invoker);
-- grant all on public.notification_due to anon, authenticated, service_role;
-- alter default privileges for role postgres grant execute on functions to public;
-- alter default privileges for role postgres in schema public grant execute on functions to anon, authenticated;
-- commit;
