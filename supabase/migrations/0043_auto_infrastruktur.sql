-- ============================================================================
-- FC Fasanerie-Nord - Migration 0043: Automatische Mitteilungen, AM1
--                                     Infrastruktur
--
-- Plan und Entscheidungen: .design-sync/reference/app/auto-mitteilungen/PHASE0.md
--
-- Diese Migration erzeugt noch KEINE Nachricht. Sie legt die Bausteine an,
-- die AM2 bis AM5 benutzen:
--
--   1. Hilfen fuer Texte: deutsches Datum, Uhrzeit, Termintitel.
--   2. Empfaenger: Profile zu einem Spieler, zu einer Rolle, alle verknuepften
--      Spieler (wahlweise ohne Urlaub/verletzt).
--   3. Regel "Ausloeser bekommt keine Nachricht" an EINER Stelle, mit der
--      Ausnahme Strafen (Entscheidung F1, 05.10.2026).
--   4. "Fruehestens 08:00 Ortszeit" fuer Nachrichten aus dem naechtlichen
--      BFV-Sync (F2, F5).
--   5. Sammler: eine interne Tabelle, in der Ereignisse mit {anzahl}/{namen}/
--      {liste} gesammelt und spaeter zu EINER Nachricht je Profil
--      zusammengefasst werden. Das Buendeln im Dispatcher haengt nur Texte
--      aneinander und behaelt den ersten Titel - fuer "3 Strafen" falsch.
--      Ein pg_cron-Job ruft alle 2 Minuten notify_sammler_flush(); die
--      Zusammenfassung je Kategorie (notify_flush_<kategorie>) kommt mit AM2
--      bis AM4. Ohne sie tut der Job nichts.
--   6. Verfallszeit: notification_outbox.gueltig_bis. notify_enqueue setzt sie
--      bei ttl_regel = 'bis_zeitpunkt' aus p_ttl_bis; notification_due laesst
--      abgelaufene Zeilen weg; der taegliche Aufraeumjob markiert sie
--      ("verfallen"). Sonst ginge eine Erinnerung, die in der Ruhezeit lag,
--      nach dem Meldeschluss noch raus.
--
-- RECHTE (Regel aus 0042): alle neuen Funktionen SECURITY DEFINER mit
-- Eigentuemer postgres, KEIN grant an anon/authenticated - aufgerufen werden
-- sie nur von Triggern, pg_cron und anderen internen Funktionen. Die Tabelle
-- notification_sammler: RLS an, keine Policy, revoke all von anon und
-- authenticated. notify_enqueue behaelt seine Rechte (nur service_role).
--
-- BEWUSST NICHT GEAENDERT: api/dispatch-push.js, push_claim, die Vorlagen,
-- Schalter und Ruhezeiten.
--
-- EINGESPIELT am 05.10.2026 ohne Fehler; Pruefskript
-- supabase/checks/0043_auto_pruef.sql: 83/83 PASS.
-- Gedacht als eine Transaktion. Der SQL-Editor fuehrt begin/commit aber nicht
-- verlaesslich als eine aus (Vorfall 0044, conventions.md); kuenftige
-- Migrationen mit Gegenprobe laufen deshalb als ein einziger do-Block.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1) Texthilfen
-- ----------------------------------------------------------------------------
-- Die Beispieldaten des Katalogs nutzen "20.09." (Termine) und "20.09.2026"
-- (Strafen, Absage, Aenderung); beide Formen gibt es deshalb.
create or replace function public.notify_datum_kurz(p date)
returns text language sql immutable set search_path = public
as $$ select to_char(p, 'DD.MM.'); $$;

create or replace function public.notify_datum_lang(p date)
returns text language sql immutable set search_path = public
as $$ select to_char(p, 'DD.MM.YYYY'); $$;

-- events.time ist Text ("12:30"). Leer bleibt leer (optionaler Platzhalter).
create or replace function public.notify_uhrzeit(p text)
returns text language sql immutable set search_path = public
as $$ select case when nullif(btrim(coalesce(p, '')), '') is null then null
                  else left(btrim(p), 5) || ' Uhr' end; $$;

-- Wie summaryFor im Kalender-Feed: beim Spiel der Gegner, sonst der Titel.
create or replace function public.notify_termin_titel(p_event uuid)
returns text language sql stable security definer set search_path = public
as $$
  select case when e.type = 'spiel' then coalesce(nullif(e.opponent, ''), e.title)
              else e.title end
    from public.events e where e.id = p_event;
$$;

create or replace function public.notify_betrag(p numeric)
returns text language sql immutable set search_path = public
as $$ select replace(to_char(coalesce(p, 0), 'FM999990.00'), '.', ',') || ' €'; $$;

-- ----------------------------------------------------------------------------
-- 2) Empfaenger
-- ----------------------------------------------------------------------------
-- Urlaub oder verletzt (bis einschliesslich status_until, ohne Datum offen).
create or replace function public.notify_spieler_faellt_aus(p_player uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.player_status s
                  where s.player_id = p_player
                    and s.status in ('urlaub', 'verletzt')
                    and (s.status_until is null
                         or s.status_until >= (now() at time zone 'Europe/Berlin')::date));
$$;

create or replace function public.notify_profile_von_spieler(p_player uuid)
returns setof uuid language sql stable security definer set search_path = public
as $$ select p.id from public.profiles p where p.player_id = p_player; $$;

create or replace function public.notify_profile_mit_rolle(p_rolle text)
returns setof uuid language sql stable security definer set search_path = public
as $$ select distinct r.user_id from public.user_roles r where r.role = p_rolle; $$;

-- Alle verknuepften Spieler; p_ohne_ausfall = true laesst Urlaub/verletzt weg
-- (F3, F6).
create or replace function public.notify_profile_alle_spieler(p_ohne_ausfall boolean)
returns table (profile_id uuid, player_id uuid)
language sql stable security definer set search_path = public
as $$
  select p.id, p.player_id from public.profiles p
   where p.player_id is not null
     and (not p_ohne_ausfall or not public.notify_spieler_faellt_aus(p.player_id));
$$;

-- ----------------------------------------------------------------------------
-- 3) Ausloeser-Regel (F1)
-- ----------------------------------------------------------------------------
-- true = dieses Profil bekommt die Nachricht. Wer ausgeloest hat, bekommt sie
-- nicht - ausser bei Strafen: der betroffene Spieler erfaehrt immer davon,
-- auch wenn er sie selbst ausgeloest oder sich selbst eingetragen hat.
create or replace function public.notify_empfaenger_ok(p_kategorie text, p_profile uuid, p_ausloeser uuid)
returns boolean language sql immutable set search_path = public
as $$
  select p_ausloeser is null
      or p_profile is distinct from p_ausloeser
      or p_kategorie = 'strafe_neu';
$$;

-- ----------------------------------------------------------------------------
-- 4) Fruehestens 08:00 Ortszeit (BFV-Sync, F2/F5)
-- ----------------------------------------------------------------------------
create or replace function public.notify_nicht_vor_acht(p timestamptz)
returns timestamptz language sql stable set search_path = public
as $$
  select case
    when (p at time zone 'Europe/Berlin')::time < time '08:00'
      then (((p at time zone 'Europe/Berlin')::date + time '08:00') at time zone 'Europe/Berlin')
    else p end;
$$;

-- ----------------------------------------------------------------------------
-- 5) Sammler
-- ----------------------------------------------------------------------------
create table if not exists public.notification_sammler (
  id          uuid primary key default gen_random_uuid(),
  kategorie   text not null,
  bezug       text not null,            -- z. B. Termin-ID, Batch-ID, Kassenwart
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  ausloeser   uuid,                     -- auth.uid() beim Ereignis, null = System
  daten       jsonb not null default '{}',
  faellig_ab  timestamptz not null,
  erstellt_at timestamptz not null default now()
);
create index if not exists idx_sammler_faellig on public.notification_sammler(faellig_ab);
create index if not exists idx_sammler_gruppe  on public.notification_sammler(kategorie, bezug, profile_id);

comment on table public.notification_sammler is
  'Interne Sammelstelle fuer Mitteilungen mit {anzahl}/{namen}/{liste}. notify_sammler_flush() fasst faellige Eintraege je Kategorie zu einer Nachricht je Profil zusammen. Kein Zugriff fuer die App.';

alter table public.notification_sammler enable row level security;
revoke all on public.notification_sammler from public, anon, authenticated;

-- Eintrag anlegen. Die Faelligkeit der GRUPPE (kategorie, bezug, profile)
-- bestimmt der erste Eintrag: spaetere Eintraege derselben Gruppe uebernehmen
-- dessen faellig_ab ("gesammelt ueber 15 Minuten ab der ersten Meldung").
create or replace function public.notify_sammeln(
  p_kategorie text, p_bezug text, p_profile uuid, p_ausloeser uuid,
  p_daten jsonb, p_faellig_ab timestamptz
)
returns void language plpgsql security definer set search_path = public
as $$
declare v_ab timestamptz;
begin
  if p_profile is null then return; end if;
  if not public.notify_empfaenger_ok(p_kategorie, p_profile, p_ausloeser) then return; end if;
  select min(faellig_ab) into v_ab from public.notification_sammler
   where kategorie = p_kategorie and bezug = p_bezug and profile_id = p_profile;
  insert into public.notification_sammler (kategorie, bezug, profile_id, ausloeser, daten, faellig_ab)
  values (p_kategorie, p_bezug, p_profile, p_ausloeser, coalesce(p_daten, '{}'), coalesce(v_ab, p_faellig_ab));
end;
$$;

-- Ruft je Kategorie mit faelligen Eintraegen notify_flush_<kategorie>(), falls
-- es sie gibt (AM2 bis AM4). Fehlt sie, bleiben die Eintraege liegen - das
-- faellt in der Gegenprobe der jeweiligen Migration auf, nicht still.
create or replace function public.notify_sammler_flush()
returns integer language plpgsql security definer set search_path = public
as $$
declare r record; v_n integer := 0; v_fn regprocedure;
begin
  for r in select distinct kategorie from public.notification_sammler where faellig_ab <= now() loop
    v_fn := to_regprocedure('public.notify_flush_' || r.kategorie || '()');
    if v_fn is not null then
      execute 'select public.notify_flush_' || r.kategorie || '()';
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;
end;
$$;

-- ----------------------------------------------------------------------------
-- 6) Verfallszeit
-- ----------------------------------------------------------------------------
alter table public.notification_outbox add column if not exists gueltig_bis timestamptz;
comment on column public.notification_outbox.gueltig_bis is
  'Nach diesem Zeitpunkt wird die Zeile nicht mehr zugestellt (z. B. Erinnerung nach Meldeschluss). Gesetzt von notify_enqueue bei ttl_regel = bis_zeitpunkt.';

-- notify_enqueue: wie 0042, dazu gueltig_bis. Signatur unveraendert, damit
-- die bestehenden Aufrufer (send_test_notification, send_preview_notification)
-- und die Rechte (nur service_role) bleiben.
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
$$;

-- notification_due: wie 0039/0042, dazu der Verfall. security_invoker bleibt.
create or replace view public.notification_due with (security_invoker = true) as
select o.*
  from public.notification_outbox o
  join public.notification_prefs p on p.profile_id = o.profile_id
 where o.sent_at is null
   and o.error is null
   and o.not_before <= now()
   and (o.gueltig_bis is null or o.gueltig_bis > now())
   and (o.claimed_at is null or o.claimed_at < now() - interval '5 minutes')
   and (o.ist_vorschau or public.kategorie_erlaubt(o.profile_id, o.kategorie))
   and (o.ist_vorschau or o.kategorie = 'test'
        or coalesce(case o.kategorie
             when 'strafe_neu'              then p.strafe_neu
             when 'zahlung_bestaetigt'      then p.zahlung_bestaetigt
             when 'zahlung_abgelehnt'       then p.zahlung_abgelehnt
             when 'zahlung_gemeldet'        then p.zahlung_gemeldet
             when 'absage_kurzfristig'      then p.absage_kurzfristig
             when 'termin_geaendert'        then p.termin_geaendert
             when 'termin_abgesagt'         then p.termin_abgesagt
             when 'termin_neu'              then p.termin_neu
             when 'rueckmeldung_erinnerung' then p.rueckmeldung_erinnerung
             when 'unterbesetzung'          then p.unterbesetzung
             when 'meldeschluss_uebersicht' then p.meldeschluss_uebersicht
             when 'strafen_offen'           then p.strafen_offen
           end, false))
   and (o.ist_vorschau or o.kategorie = 'test'
        or not public.in_quiet_hours(p.quiet_from, p.quiet_to)
        or (o.urgency = 'high' and p.quiet_override_urgent));

-- Aufraeumen: wie 0034, dazu abgelaufene, nie gesendete Zeilen markieren.
create or replace function public.notification_outbox_cleanup()
returns integer
language plpgsql security definer set search_path = public
as $$
declare v_n integer;
begin
  update public.notification_outbox
     set error = 'verfallen'
   where sent_at is null and error is null and gueltig_bis is not null and gueltig_bis < now();
  delete from public.notification_outbox where created_at < now() - interval '90 days';
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- ----------------------------------------------------------------------------
-- 7) Rechte: nichts fuer anon/authenticated (Default Privileges seit 0042 geben
--    ohnehin kein EXECUTE; das revoke macht es unabhaengig davon eindeutig).
-- ----------------------------------------------------------------------------
revoke execute on function public.notify_datum_kurz(date)                         from public, anon, authenticated;
revoke execute on function public.notify_datum_lang(date)                         from public, anon, authenticated;
revoke execute on function public.notify_uhrzeit(text)                            from public, anon, authenticated;
revoke execute on function public.notify_termin_titel(uuid)                       from public, anon, authenticated;
revoke execute on function public.notify_betrag(numeric)                          from public, anon, authenticated;
revoke execute on function public.notify_spieler_faellt_aus(uuid)                 from public, anon, authenticated;
revoke execute on function public.notify_profile_von_spieler(uuid)                from public, anon, authenticated;
revoke execute on function public.notify_profile_mit_rolle(text)                  from public, anon, authenticated;
revoke execute on function public.notify_profile_alle_spieler(boolean)            from public, anon, authenticated;
revoke execute on function public.notify_empfaenger_ok(text, uuid, uuid)          from public, anon, authenticated;
revoke execute on function public.notify_nicht_vor_acht(timestamptz)              from public, anon, authenticated;
revoke execute on function public.notify_sammeln(text, text, uuid, uuid, jsonb, timestamptz) from public, anon, authenticated;
revoke execute on function public.notify_sammler_flush()                          from public, anon, authenticated;
-- in_quiet_hours/kategorie_erlaubt brauchen service_role weiter (0042b);
-- notify_enqueue bleibt bei service_role (create or replace behaelt Rechte).

-- ----------------------------------------------------------------------------
-- 8) pg_cron: Sammler alle 2 Minuten
-- ----------------------------------------------------------------------------
select cron.unschedule('notify-sammler')
 where exists (select 1 from cron.job where jobname = 'notify-sammler');
select cron.schedule('notify-sammler', '*/2 * * * *', $$select public.notify_sammler_flush();$$);

-- ----------------------------------------------------------------------------
-- Gegenprobe
-- ----------------------------------------------------------------------------
do $$
declare
  v_fehl text[] := '{}';
  v_x    text[];
  v_id   uuid;
  v_n    integer;
begin
  -- Neue Funktionen: weder anon noch authenticated noch PUBLIC.
  select array_agg(p.oid::regprocedure::text) into v_x
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname like 'notify\_%' and p.proname <> 'notify_enqueue'
     and (has_function_privilege('anon', p.oid, 'execute')
          or has_function_privilege('authenticated', p.oid, 'execute')
          or exists (select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a where a.grantee = 0));
  if v_x is not null then v_fehl := v_fehl || ('von außen ausführbar: ' || array_to_string(v_x, ', ')); end if;

  -- notify_enqueue weiterhin nur service_role.
  if has_function_privilege('authenticated', 'public.notify_enqueue(uuid,text,jsonb,text,text,text,timestamptz,timestamptz,boolean)'::regprocedure, 'execute')
     or not has_function_privilege('service_role', 'public.notify_enqueue(uuid,text,jsonb,text,text,text,timestamptz,timestamptz,boolean)'::regprocedure, 'execute') then
    v_fehl := v_fehl || 'notify_enqueue-Rechte verändert'::text;
  end if;

  -- Sammler: keine Rechte fuer anon/authenticated, RLS an.
  if has_table_privilege('anon', 'public.notification_sammler', 'select')
     or has_table_privilege('authenticated', 'public.notification_sammler', 'select')
     or has_table_privilege('authenticated', 'public.notification_sammler', 'insert') then
    v_fehl := v_fehl || 'notification_sammler von außen erreichbar'::text;
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.notification_sammler'::regclass) then
    v_fehl := v_fehl || 'notification_sammler ohne RLS'::text;
  end if;

  -- Sicht: security_invoker und Lesen nur service_role (wie 0042).
  if not exists (select 1 from pg_class where oid = 'public.notification_due'::regclass
                  and reloptions @> array['security_invoker=true']) then
    v_fehl := v_fehl || 'notification_due ohne security_invoker'::text;
  end if;
  if has_table_privilege('authenticated', 'public.notification_due', 'select')
     or not has_table_privilege('service_role', 'public.notification_due', 'select') then
    v_fehl := v_fehl || 'Rechte auf notification_due verändert'::text;
  end if;

  -- Texthilfen
  if public.notify_datum_kurz('2026-09-20') <> '20.09.' or public.notify_datum_lang('2026-09-20') <> '20.09.2026'
     or public.notify_uhrzeit('12:30') <> '12:30 Uhr' or public.notify_uhrzeit('') is not null
     or public.notify_betrag(8) <> '8,00 €' or public.notify_betrag(128.5) <> '128,50 €' then
    v_fehl := v_fehl || 'Texthilfen liefern falsche Formate'::text;
  end if;

  -- 08:00-Regel (Sommerzeit: 04:27 UTC = 06:27 Ortszeit)
  if public.notify_nicht_vor_acht('2026-10-05 04:27+00') <> '2026-10-05 06:00+00'::timestamptz
     or public.notify_nicht_vor_acht('2026-10-05 10:00+00') <> '2026-10-05 10:00+00'::timestamptz then
    v_fehl := v_fehl || 'notify_nicht_vor_acht rechnet falsch'::text;
  end if;

  -- Ausloeser-Regel
  if public.notify_empfaenger_ok('termin_geaendert', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001')
     or not public.notify_empfaenger_ok('strafe_neu', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001')
     or not public.notify_empfaenger_ok('termin_geaendert', '00000000-0000-0000-0000-000000000001', null) then
    v_fehl := v_fehl || 'Auslöser-Regel falsch'::text;
  end if;

  -- Verfall mit echter Zeile, danach zurueckgerollt.
  begin
    insert into public.notification_outbox (profile_id, kategorie, titel, text, dedup_key, not_before, gueltig_bis)
    select p.id, 'test', 'Gegenprobe', 'Gegenprobe', 'gegenprobe0043:abgelaufen', now() - interval '1 minute', now() - interval '1 second'
      from public.profiles p limit 1
    returning id into v_id;
    select count(*) into v_n from public.notification_due where id = v_id;
    if v_n <> 0 then v_fehl := v_fehl || 'abgelaufene Zeile ist fällig'::text; end if;
    raise exception using errcode = 'P0043', message = 'zurückrollen';
  exception when sqlstate 'P0043' then null;
  end;

  if not exists (select 1 from cron.job where jobname = 'notify-sammler') then
    v_fehl := v_fehl || 'Cron-Job notify-sammler fehlt'::text;
  end if;

  if array_length(v_fehl, 1) > 0 then
    raise exception 'Gegenprobe 0043 fehlgeschlagen: %', v_fehl;
  end if;
  raise notice 'Gegenprobe 0043 bestanden.';
end;
$$;

commit;

-- ============================================================================
-- RUECKBAU (nicht automatisch ausgefuehrt)
-- ============================================================================
-- begin;
-- select cron.unschedule('notify-sammler');
-- drop function if exists public.notify_sammler_flush();
-- drop function if exists public.notify_sammeln(text, text, uuid, uuid, jsonb, timestamptz);
-- drop table if exists public.notification_sammler;
-- -- notification_due und notification_outbox_cleanup: Fassung aus 0039 bzw. 0034
-- -- notify_enqueue: Fassung aus 0042
-- alter table public.notification_outbox drop column if exists gueltig_bis;
-- drop function if exists public.notify_nicht_vor_acht(timestamptz), public.notify_empfaenger_ok(text, uuid, uuid),
--   public.notify_profile_alle_spieler(boolean), public.notify_profile_mit_rolle(text),
--   public.notify_profile_von_spieler(uuid), public.notify_spieler_faellt_aus(uuid),
--   public.notify_betrag(numeric), public.notify_termin_titel(uuid), public.notify_uhrzeit(text),
--   public.notify_datum_lang(date), public.notify_datum_kurz(date);
-- commit;
