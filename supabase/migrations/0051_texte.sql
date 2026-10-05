-- ============================================================================
-- FC Fasanerie-Nord - Migration 0051: Textkorrekturen (mit P1 entschieden)
--
-- Entscheidungen 04.10./05.10.2026 (einstellungen-v2/PHASE0.md, A1 bis A11 und
-- "ASCII-Ersatzschreibungen"; PLAN.md: "Die Migration zu P1 enthaelt
-- ausserdem die Datenbanktexte"):
--   - strafe_neu, Ausloeser-Beschreibung ohne Gedankenstrich (Komma).
--   - A10: strafen_offen, Ausloeser-Beschreibung "Hoechstens einmal im Monat."
--     (ohne "Standard AUS.").
--   - Fehlermeldungen mit ASCII-Ersatzschreibung aus dem Bereich Einstellungen:
--     send_test_notification, send_preview_notification,
--     set_notification_template, render_vorlage, upsert_push_subscription,
--     set_ical_url, notify_enqueue.
--
-- Die Funktionen sind aus den LIVE-Definitionen erzeugt (pg_get_functiondef);
-- geaendert ist nur der jeweilige Meldungstext. create or replace behaelt die
-- Rechte. Texte der Vorlagen nur, solange der Auslieferungsstand gilt.
--
-- Aufbau: EIN do-Block (conventions.md).
-- ============================================================================

begin;

do $migration$
declare
  v_fehl text[] := '{}';
  v_rechte_vorher text;
begin
  select string_agg(p.oid::regprocedure::text || '=' || coalesce(p.proacl::text, '-'), ';' order by 1) into v_rechte_vorher
    from pg_proc p where p.oid in ('public.send_test_notification()'::regprocedure, 'public.send_preview_notification(text)'::regprocedure, 'public.set_notification_template(text,text,text,boolean)'::regprocedure, 'public.render_vorlage(text,jsonb,text[],text[])'::regprocedure, 'public.upsert_push_subscription(text,text,text,text,text)'::regprocedure, 'public.set_ical_url(text)'::regprocedure, 'public.notify_enqueue(uuid,text,jsonb,text,text,text,timestamptz,timestamptz,boolean)'::regprocedure);

  -- public.send_test_notification()
  execute $ddl$
CREATE OR REPLACE FUNCTION public.send_test_notification()
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.'; end if;
  if not public.is_admin() then
    raise exception 'Nur Admin.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.push_subscriptions where profile_id = auth.uid()) then
    raise exception 'Für dieses Konto ist noch kein Gerät angemeldet.';
  end if;

  return public.notify_enqueue(
    p_profile   => auth.uid(),
    p_kategorie => 'test',
    p_daten     => '{}'::jsonb,
    -- Zeitstempel im Schluessel: zweimal druecken soll zweimal ankommen.
    p_dedup     => 'test:' || auth.uid()::text || ':' || extract(epoch from clock_timestamp())::bigint::text,
    p_tag       => 'test');
end;
$function$
  $ddl$;

  -- public.send_preview_notification(text)
  execute $ddl$
CREATE OR REPLACE FUNCTION public.send_preview_notification(p_kategorie text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  t      public.notification_templates%rowtype;
  v_zeit text := extract(epoch from clock_timestamp())::bigint::text;
begin
  if not public.is_admin() then raise exception 'Nur Admin.'; end if;
  if not exists (select 1 from public.push_subscriptions where profile_id = auth.uid()) then
    raise exception 'Für dieses Konto ist noch kein Gerät angemeldet.';
  end if;

  select * into t from public.notification_templates where kategorie = p_kategorie;
  if t.kategorie is null then raise exception 'Unbekannte Kategorie: %', p_kategorie; end if;

  return public.notify_enqueue(
    p_profile    => auth.uid(),
    p_kategorie  => p_kategorie,
    p_daten      => t.beispiel_daten,
    p_dedup      => 'vorschau:' || p_kategorie || ':' || auth.uid()::text || ':' || v_zeit,
    -- Kategorie UND Zeitstempel: verschiedene Kategorien fallen nicht
    -- zusammen, und dieselbe Kategorie zweimal legt sich nebeneinander.
    p_tag        => 'vorschau-' || p_kategorie || '-' || v_zeit,
    p_not_before => now(),
    p_ttl_bis    => now() + interval '1 hour',
    p_vorschau   => true);
end;
$function$
  $ddl$;

  -- public.set_notification_template(text,text,text,boolean)
  execute $ddl$
CREATE OR REPLACE FUNCTION public.set_notification_template(p_kategorie text, p_titel text, p_text text, p_aktiv boolean DEFAULT NULL::boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_admin() then raise exception 'Nur Admin.'; end if;
  if coalesce(btrim(p_titel),'') = '' or coalesce(btrim(p_text),'') = '' then
    raise exception 'Titel und Text dürfen nicht leer sein.';
  end if;

  perform public.render_vorlage(p_titel, t.beispiel_daten, t.platzhalter, t.platzhalter_optional),
          public.render_vorlage(p_text,  t.beispiel_daten, t.platzhalter, t.platzhalter_optional)
     from public.notification_templates t where t.kategorie = p_kategorie;

  update public.notification_templates set
    titel_vorlage = p_titel,
    text_vorlage  = p_text,
    aktiv         = coalesce(p_aktiv, aktiv),
    updated_at    = now(),
    updated_by    = auth.uid()
  where kategorie = p_kategorie;

  if not found then raise exception 'Unbekannte Kategorie: %', p_kategorie; end if;
end;
$function$
  $ddl$;

  -- public.render_vorlage(text,jsonb,text[],text[])
  execute $ddl$
CREATE OR REPLACE FUNCTION public.render_vorlage(p_vorlage text, p_daten jsonb, p_erlaubt text[], p_optional text[] DEFAULT '{}'::text[])
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
declare
  v_out      text := coalesce(p_vorlage, '');
  v_name     text;
  v_wert     text;
  v_geleert  boolean := false;
begin
  for v_name in
    select distinct m[1]
      from regexp_matches(coalesce(p_vorlage, ''), '\{([a-zA-Z0-9_]+)\}', 'g') m
  loop
    if p_erlaubt is not null and array_length(p_erlaubt, 1) is not null
       and not (v_name = any(p_erlaubt)) then
      raise exception 'Unbekannter Platzhalter {%} in der Vorlage.', v_name using errcode = '22023';
    end if;

    v_wert := p_daten ->> v_name;

    if v_wert is null or btrim(v_wert) = '' then
      if p_optional is not null and v_name = any(p_optional) then
        v_out := replace(v_out, '{' || v_name || '}', '');
        v_geleert := true;
        continue;
      end if;
      raise exception 'Kein Wert für {%}.', v_name using errcode = '22023';
    end if;

    v_out := replace(v_out, '{' || v_name || '}', v_wert);
  end loop;

  -- Nur aufraeumen, wenn wirklich etwas weggefallen ist - sonst koennte die
  -- Saeuberung einen gewollten Abstand veraendern.
  if v_geleert then
    v_out := regexp_replace(v_out, '\s+([.,;:!?])', '\1', 'g');   -- " ." -> "."
    v_out := regexp_replace(v_out, '\s{2,}', ' ', 'g');           -- doppelte Abstaende
    v_out := regexp_replace(v_out, '([.!?])\s*\1+', '\1', 'g');   -- ".." -> "."
    v_out := btrim(v_out);
  end if;

  return v_out;
end;
$function$
  $ddl$;

  -- public.upsert_push_subscription(text,text,text,text,text)
  execute $ddl$
CREATE OR REPLACE FUNCTION public.upsert_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_platform text DEFAULT NULL::text, p_user_agent text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.'; end if;
  if coalesce(btrim(p_endpoint),'') = '' or coalesce(btrim(p_p256dh),'') = ''
     or coalesce(btrim(p_auth),'') = '' then
    raise exception 'Unvollständige Anmeldedaten.';
  end if;

  insert into public.push_subscriptions
    (profile_id, endpoint, p256dh, auth, platform, user_agent, failed_count)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, left(p_platform, 40), left(p_user_agent, 400), 0)
  on conflict (endpoint) do update set
    profile_id   = auth.uid(),
    p256dh       = excluded.p256dh,
    auth         = excluded.auth,
    platform     = excluded.platform,
    user_agent   = excluded.user_agent,
    failed_count = 0;
end;
$function$
  $ddl$;

  -- public.set_ical_url(text)
  execute $ddl$
CREATE OR REPLACE FUNCTION public.set_ical_url(p_url text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not (public.has_role('coach') or public.has_role('treasurer') or public.has_role('admin')) then
    raise exception 'Nur Trainer, Kassenwart oder Admin dürfen die iCal-URL setzen.';
  end if;
  update public.clubs
     set ical_url = nullif(btrim(coalesce(p_url, '')), '')
   where slug = 'fcfn';
end;
$function$
  $ddl$;

  -- public.notify_enqueue(uuid,text,jsonb,text,text,text,timestamptz,timestamptz,boolean)
  execute $ddl$
CREATE OR REPLACE FUNCTION public.notify_enqueue(p_profile uuid, p_kategorie text, p_daten jsonb DEFAULT '{}'::jsonb, p_dedup text DEFAULT NULL::text, p_bundle text DEFAULT NULL::text, p_tag text DEFAULT NULL::text, p_not_before timestamp with time zone DEFAULT now(), p_ttl_bis timestamp with time zone DEFAULT NULL::timestamp with time zone, p_vorschau boolean DEFAULT false)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    raise exception 'Vorschau nur für Admin.' using errcode = '42501';
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
     dedup_key, bundle_key, not_before, ist_vorschau, error, gueltig_bis)
  values
    (p_profile, p_kategorie, left(v_titel, 120), left(v_text, 400), v_link,
     coalesce(p_tag, p_kategorie), t.urgency, v_ttl,
     p_dedup, p_bundle, p_not_before, p_vorschau, v_fehler,
     case when t.ttl_regel = 'bis_zeitpunkt' and not coalesce(p_vorschau, false) then p_ttl_bis end)
  on conflict (dedup_key) do nothing
  returning id into v_id;

  return v_id;
end;
$function$
  $ddl$;

  update public.notification_templates
     set ausloeser_beschreibung = 'Eine Strafe wird verhängt, von Hand oder automatisch zum Anpfiff.', updated_at = now()
   where kategorie = 'strafe_neu' and ausloeser_beschreibung = 'Eine Strafe wird verhängt - von Hand oder automatisch zum Anpfiff.';
  update public.notification_templates
     set ausloeser_beschreibung = 'Höchstens einmal im Monat.', updated_at = now()
   where kategorie = 'strafen_offen' and ausloeser_beschreibung = 'Höchstens einmal im Monat. Standard AUS.';

  -- Gegenprobe
  if position('''Für dieses Konto ist noch kein Gerät angemeldet.''' in pg_get_functiondef('public.send_test_notification()'::regprocedure)) = 0 then v_fehl := v_fehl || 'public.send_test_notification()'::text; end if;
  if position('''Für dieses Konto ist noch kein Gerät angemeldet.''' in pg_get_functiondef('public.send_preview_notification(text)'::regprocedure)) = 0 then v_fehl := v_fehl || 'public.send_preview_notification(text)'::text; end if;
  if position('''Titel und Text dürfen nicht leer sein.''' in pg_get_functiondef('public.set_notification_template(text,text,text,boolean)'::regprocedure)) = 0 then v_fehl := v_fehl || 'public.set_notification_template(text,text,text,boolean)'::text; end if;
  if position('''Kein Wert für {%}.''' in pg_get_functiondef('public.render_vorlage(text,jsonb,text[],text[])'::regprocedure)) = 0 then v_fehl := v_fehl || 'public.render_vorlage(text,jsonb,text[],text[])'::text; end if;
  if position('''Unvollständige Anmeldedaten.''' in pg_get_functiondef('public.upsert_push_subscription(text,text,text,text,text)'::regprocedure)) = 0 then v_fehl := v_fehl || 'public.upsert_push_subscription(text,text,text,text,text)'::text; end if;
  if position('''Nur Trainer, Kassenwart oder Admin dürfen die iCal-URL setzen.''' in pg_get_functiondef('public.set_ical_url(text)'::regprocedure)) = 0 then v_fehl := v_fehl || 'public.set_ical_url(text)'::text; end if;
  if position('''Vorschau nur für Admin.''' in pg_get_functiondef('public.notify_enqueue(uuid,text,jsonb,text,text,text,timestamptz,timestamptz,boolean)'::regprocedure)) = 0 then v_fehl := v_fehl || 'public.notify_enqueue(uuid,text,jsonb,text,text,text,timestamptz,timestamptz,boolean)'::text; end if;
  if exists (select 1 from public.notification_templates where kategorie = 'strafe_neu' and ausloeser_beschreibung like '% - %') then
    v_fehl := v_fehl || 'strafe_neu Beschreibung'::text;
  end if;
  if exists (select 1 from public.notification_templates where kategorie = 'strafen_offen' and ausloeser_beschreibung <> 'Höchstens einmal im Monat.') then
    v_fehl := v_fehl || 'strafen_offen Beschreibung'::text;
  end if;
  if (select string_agg(p.oid::regprocedure::text || '=' || coalesce(p.proacl::text, '-'), ';' order by 1)
        from pg_proc p where p.oid in ('public.send_test_notification()'::regprocedure, 'public.send_preview_notification(text)'::regprocedure, 'public.set_notification_template(text,text,text,boolean)'::regprocedure, 'public.render_vorlage(text,jsonb,text[],text[])'::regprocedure, 'public.upsert_push_subscription(text,text,text,text,text)'::regprocedure, 'public.set_ical_url(text)'::regprocedure, 'public.notify_enqueue(uuid,text,jsonb,text,text,text,timestamptz,timestamptz,boolean)'::regprocedure)) is distinct from v_rechte_vorher then
    v_fehl := v_fehl || 'Rechte verändert'::text;
  end if;
  begin
    perform public.render_vorlage('{a}', '{}'::jsonb, array['a']);
    v_fehl := v_fehl || 'render_vorlage wirft nicht'::text;
  exception when sqlstate '22023' then
    if sqlerrm <> 'Kein Wert für {a}.' then v_fehl := v_fehl || ('render_vorlage: ' || sqlerrm); end if;
  end;

  if array_length(v_fehl, 1) > 0 then
    raise exception 'Gegenprobe 0051 fehlgeschlagen: %', v_fehl;
  end if;
  raise notice 'Gegenprobe 0051 bestanden.';
end
$migration$;

commit;
