-- ============================================================================
-- FC Fasanerie-Nord - Migration 0034: Push-Infrastruktur
--
-- Drei Tabellen, ein Versandweg. NICHTS sendet direkt aus einem Trigger -
-- alles laeuft ueber notification_outbox, und nur der Dispatcher auf Vercel
-- (api/dispatch-push.js) nimmt Zeilen heraus und verschickt sie. So ist jede
-- Nachricht nachvollziehbar, wiederholbar und zugleich die Datenquelle fuer
-- die spaetere In-App-Liste.
--
--   push_subscriptions   ein Geraet je Zeile (Endpoint ist der Schluessel)
--   notification_prefs   was will dieser Nutzer, und wann nicht
--   notification_outbox  jede einzelne Nachricht, vor und nach dem Versand
--
-- Schreibzugriffe der Nutzer laufen ausschliesslich ueber SECURITY-DEFINER-
-- Funktionen mit auth.uid()-Pruefung; direkte Schreib-Policies gibt es nicht.
-- Der Dispatcher arbeitet mit dem Service-Role-Key und umgeht RLS ohnehin.
--
-- Angestossen wird der Versand von pg_cron im Minutentakt, aber nur wenn
-- wirklich etwas faellig ist - push_dispatch_tick() prueft das zuerst und
-- ruft den Endpunkt nur dann per pg_net. Adresse und gemeinsames Geheimnis
-- stehen im Vault, nicht hier im Quelltext.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Geraete
-- ----------------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  endpoint     text not null unique,
  p256dh       text not null,
  auth         text not null,
  platform     text,
  user_agent   text,
  created_at      timestamptz not null default now(),
  last_success_at timestamptz,
  failed_count    integer not null default 0
);
create index if not exists idx_push_subs_profile on public.push_subscriptions(profile_id);

comment on table public.push_subscriptions is
  'Ein Geraet je Zeile. Der Endpoint ist eindeutig - dasselbe Geraet kann nicht doppelt registriert sein.';
comment on column public.push_subscriptions.failed_count is
  'Fehlversuche in Folge. Ab 5 wird die Zeile geloescht, 404/410 loeschen sofort.';

alter table public.push_subscriptions enable row level security;

drop policy if exists push_subs_sel on public.push_subscriptions;
create policy push_subs_sel on public.push_subscriptions
  for select to authenticated using (profile_id = auth.uid());
-- Kein insert/update/delete fuer Nutzer: alles ueber die Funktionen unten.

-- ----------------------------------------------------------------------------
-- 2) Einstellungen je Profil
-- ----------------------------------------------------------------------------
create table if not exists public.notification_prefs (
  profile_id uuid primary key references public.profiles(id) on delete cascade,

  -- Spieler
  strafe_neu              boolean not null default true,
  zahlung_bestaetigt      boolean not null default true,
  zahlung_abgelehnt       boolean not null default true,
  rueckmeldung_erinnerung boolean not null default true,
  termin_geaendert        boolean not null default true,
  termin_neu              boolean not null default true,
  strafen_offen           boolean not null default false,   -- als einzige aus
  -- Kassenwart
  zahlung_gemeldet        boolean not null default true,
  -- Trainer
  absage_kurzfristig      boolean not null default true,
  meldeschluss_uebersicht boolean not null default true,
  unterbesetzung          boolean not null default true,

  -- Ruhezeiten in Ortszeit Europe/Berlin
  quiet_from time not null default '22:00',
  quiet_to   time not null default '08:00',
  -- Duerfen zeitkritische Nachrichten die Ruhezeit durchbrechen?
  quiet_override_urgent boolean not null default true,

  updated_at timestamptz not null default now()
);

comment on column public.notification_prefs.strafen_offen is
  'Erinnerung an alte offene Strafen. Standard AUS - das ist Mahnung, nicht Information.';
comment on column public.notification_prefs.quiet_override_urgent is
  'true = Nachrichten mit urgency high kommen auch nachts durch (kurzfristige Absage, Meldeschluss).';

alter table public.notification_prefs enable row level security;

drop policy if exists notif_prefs_sel on public.notification_prefs;
create policy notif_prefs_sel on public.notification_prefs
  for select to authenticated using (profile_id = auth.uid());

-- Jedes Profil bekommt eine Zeile, bestehende wie neue.
insert into public.notification_prefs (profile_id)
select p.id from public.profiles p
on conflict (profile_id) do nothing;

create or replace function public.profiles_ensure_notification_prefs()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.notification_prefs (profile_id) values (new.id)
  on conflict (profile_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_profiles_notification_prefs on public.profiles;
create trigger trg_profiles_notification_prefs
  after insert on public.profiles
  for each row execute function public.profiles_ensure_notification_prefs();

-- ----------------------------------------------------------------------------
-- 3) Die Outbox
-- ----------------------------------------------------------------------------
create table if not exists public.notification_outbox (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  kategorie    text not null,
  titel        text not null,
  text         text not null,
  deep_link    text,
  tag          text,
  urgency      text not null default 'normal' check (urgency in ('normal','high')),
  ttl_seconds  integer not null default 86400 check (ttl_seconds between 0 and 2419200),
  dedup_key    text unique,
  bundle_key   text,
  not_before   timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  claimed_at   timestamptz,
  sent_at      timestamptz,
  error        text,
  read_at      timestamptz
);

-- Die Kategorien stehen fest. Ein Tippfehler im Trigger soll auffallen, nicht
-- still eine Nachricht erzeugen, die keine Einstellung je erreicht.
alter table public.notification_outbox drop constraint if exists notification_outbox_kat_chk;
alter table public.notification_outbox add  constraint notification_outbox_kat_chk
  check (kategorie in (
    'strafe_neu','zahlung_bestaetigt','zahlung_abgelehnt','zahlung_gemeldet',
    'absage_kurzfristig','termin_geaendert','termin_neu',
    'rueckmeldung_erinnerung','unterbesetzung','meldeschluss_uebersicht',
    'strafen_offen','test'));

create index if not exists idx_outbox_faellig on public.notification_outbox(not_before)
  where sent_at is null and error is null;
create index if not exists idx_outbox_profil on public.notification_outbox(profile_id, created_at desc);

comment on table public.notification_outbox is
  'Jede Nachricht, vor und nach dem Versand. Zugleich die Quelle der In-App-Liste - Zeilen werden nicht geloescht, sondern nach 90 Tagen aufgeraeumt.';
comment on column public.notification_outbox.claimed_at is
  'Vom Dispatcher in Bearbeitung genommen. Verhindert doppelten Versand, wenn zwei Laeufe ueberlappen.';
comment on column public.notification_outbox.dedup_key is
  'Eindeutig ueber die ganze Tabelle - muss daher Profil, Bezug und Kategorie enthalten.';
comment on column public.notification_outbox.bundle_key is
  'Nachrichten mit gleichem Schluessel fasst der Dispatcher zu einer zusammen.';

alter table public.notification_outbox enable row level security;

-- Lesen nur die eigenen Zeilen. Strafen und Betraege stehen im Text; sie
-- gehen niemanden ausser den Betroffenen etwas an.
drop policy if exists outbox_sel on public.notification_outbox;
create policy outbox_sel on public.notification_outbox
  for select to authenticated using (profile_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 4) Ruhezeiten
-- ----------------------------------------------------------------------------
-- Ortszeit Europe/Berlin, mit Uebernachtfall (22:00 bis 08:00).
create or replace function public.in_quiet_hours(p_from time, p_to time)
returns boolean
language sql stable set search_path = public
as $$
  select case
    when p_from = p_to then false                                   -- keine Ruhezeit
    when p_from <  p_to then jetzt.t >= p_from and jetzt.t < p_to    -- z. B. 01:00-06:00
    else                     jetzt.t >= p_from or  jetzt.t < p_to    -- ueber Mitternacht
  end
  from (select (now() at time zone 'Europe/Berlin')::time as t) jetzt;
$$;

-- ----------------------------------------------------------------------------
-- 5) Was ist faellig?
--    Eine Sicht, damit Dispatcher und Anstoss dieselbe Bedingung benutzen.
-- ----------------------------------------------------------------------------
create or replace view public.notification_due as
select o.*
  from public.notification_outbox o
  join public.notification_prefs p on p.profile_id = o.profile_id
 where o.sent_at is null
   and o.error is null
   and o.not_before <= now()
   -- In Bearbeitung? Nach 5 Minuten gilt ein Lauf als abgestuerzt und die
   -- Zeile wird wieder frei.
   and (o.claimed_at is null or o.claimed_at < now() - interval '5 minutes')
   -- Kategorie eingeschaltet? Ein unbekannter Wert ergibt null und faellt
   -- heraus - lieber nicht senden als falsch senden.
   and coalesce(case o.kategorie
         when 'strafe_neu'              then p.strafe_neu
         when 'zahlung_bestaetigt'      then p.zahlung_bestaetigt
         when 'zahlung_abgelehnt'       then p.zahlung_abgelehnt
         when 'zahlung_gemeldet'        then p.zahlung_gemeldet
         when 'absage_kurzfristig'      then p.absage_kurzfristig
         when 'termin_geaendert'        then p.termin_geaendert
         when 'termin_neu'              then p.termin_neu
         when 'rueckmeldung_erinnerung' then p.rueckmeldung_erinnerung
         when 'unterbesetzung'          then p.unterbesetzung
         when 'meldeschluss_uebersicht' then p.meldeschluss_uebersicht
         when 'strafen_offen'           then p.strafen_offen
         when 'test'                    then true      -- der Nutzer hat gerade gedrueckt
       end, false)
   -- Ruhezeit? Zeitkritisches darf durch, wenn der Nutzer es erlaubt.
   and (o.kategorie = 'test'
        or not public.in_quiet_hours(p.quiet_from, p.quiet_to)
        or (o.urgency = 'high' and p.quiet_override_urgent));

comment on view public.notification_due is
  'Faellige Nachrichten. Dispatcher und push_dispatch_tick benutzen dieselbe Sicht, damit der Anstoss nicht anders urteilt als der Versand.';

-- ----------------------------------------------------------------------------
-- 6) Schreibwege der Nutzer
-- ----------------------------------------------------------------------------
-- Geraet anmelden. Wechselt der Endpoint den Besitzer (geteiltes Geraet),
-- uebernimmt der neue Nutzer die Zeile.
create or replace function public.upsert_push_subscription(
  p_endpoint text, p_p256dh text, p_auth text,
  p_platform text default null, p_user_agent text default null
)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.'; end if;
  if coalesce(btrim(p_endpoint),'') = '' or coalesce(btrim(p_p256dh),'') = ''
     or coalesce(btrim(p_auth),'') = '' then
    raise exception 'Unvollstaendige Anmeldedaten.';
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
$$;

create or replace function public.delete_push_subscription(p_endpoint text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.'; end if;
  delete from public.push_subscriptions
   where endpoint = p_endpoint and profile_id = auth.uid();
end;
$$;

-- Einstellungen. null laesst den jeweiligen Wert stehen.
create or replace function public.set_notification_prefs(p_werte jsonb)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.'; end if;

  insert into public.notification_prefs (profile_id) values (auth.uid())
  on conflict (profile_id) do nothing;

  update public.notification_prefs set
    strafe_neu              = coalesce((p_werte->>'strafe_neu')::boolean,              strafe_neu),
    zahlung_bestaetigt      = coalesce((p_werte->>'zahlung_bestaetigt')::boolean,      zahlung_bestaetigt),
    zahlung_abgelehnt       = coalesce((p_werte->>'zahlung_abgelehnt')::boolean,       zahlung_abgelehnt),
    zahlung_gemeldet        = coalesce((p_werte->>'zahlung_gemeldet')::boolean,        zahlung_gemeldet),
    absage_kurzfristig      = coalesce((p_werte->>'absage_kurzfristig')::boolean,      absage_kurzfristig),
    termin_geaendert        = coalesce((p_werte->>'termin_geaendert')::boolean,        termin_geaendert),
    termin_neu              = coalesce((p_werte->>'termin_neu')::boolean,              termin_neu),
    rueckmeldung_erinnerung = coalesce((p_werte->>'rueckmeldung_erinnerung')::boolean, rueckmeldung_erinnerung),
    unterbesetzung          = coalesce((p_werte->>'unterbesetzung')::boolean,          unterbesetzung),
    meldeschluss_uebersicht = coalesce((p_werte->>'meldeschluss_uebersicht')::boolean, meldeschluss_uebersicht),
    strafen_offen           = coalesce((p_werte->>'strafen_offen')::boolean,           strafen_offen),
    quiet_from              = coalesce((p_werte->>'quiet_from')::time,                 quiet_from),
    quiet_to                = coalesce((p_werte->>'quiet_to')::time,                   quiet_to),
    quiet_override_urgent   = coalesce((p_werte->>'quiet_override_urgent')::boolean,   quiet_override_urgent),
    updated_at              = now()
  where profile_id = auth.uid();
end;
$$;

-- Die eine Einfuegestelle. Phase 2 und 3 rufen sie aus ihren Triggern.
create or replace function public.notify_enqueue(
  p_profile uuid, p_kategorie text, p_titel text, p_text text,
  p_deep_link text default null, p_tag text default null,
  p_urgency text default 'normal', p_ttl integer default 86400,
  p_dedup text default null, p_bundle text default null,
  p_not_before timestamptz default now()
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_id uuid;
begin
  if p_profile is null then return null; end if;

  insert into public.notification_outbox
    (profile_id, kategorie, titel, text, deep_link, tag, urgency, ttl_seconds,
     dedup_key, bundle_key, not_before)
  values
    (p_profile, p_kategorie, left(p_titel, 120), left(p_text, 400), p_deep_link,
     p_tag, p_urgency, p_ttl, p_dedup, p_bundle, p_not_before)
  on conflict (dedup_key) do nothing
  returning id into v_id;

  return v_id;   -- null = war schon da
end;
$$;

-- "Testnachricht senden" aus den Einstellungen.
create or replace function public.send_test_notification()
returns uuid
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.'; end if;
  if not exists (select 1 from public.push_subscriptions where profile_id = auth.uid()) then
    raise exception 'Fuer dieses Konto ist noch kein Geraet angemeldet.';
  end if;

  return public.notify_enqueue(
    auth.uid(), 'test',
    'Benachrichtigungen sind aktiv',
    'Wenn du das liest, kommen Nachrichten auf diesem Geraet an.',
    '#ansicht=einstellungen', 'test-' || auth.uid()::text,
    'normal', 600,
    -- Der Zeitstempel im Schluessel: zweimal druecken soll zweimal ankommen.
    'test-' || auth.uid()::text || '-' || extract(epoch from clock_timestamp())::bigint::text,
    null, now());
end;
$$;

grant execute on function public.upsert_push_subscription(text, text, text, text, text) to authenticated;
grant execute on function public.delete_push_subscription(text)                          to authenticated;
grant execute on function public.set_notification_prefs(jsonb)                           to authenticated;
grant execute on function public.send_test_notification()                                to authenticated;

-- ----------------------------------------------------------------------------
-- 7) Was der Dispatcher braucht (laeuft mit Service-Role-Key)
-- ----------------------------------------------------------------------------
-- Zeilen in Bearbeitung nehmen. skip locked: zwei ueberlappende Laeufe greifen
-- sich nicht dieselbe Nachricht.
create or replace function public.push_claim(p_limit integer default 100)
returns setof public.notification_outbox
language plpgsql security definer set search_path = public
as $$
begin
  return query
  with faellig as (
    select o.id from public.notification_due o
     order by o.urgency desc, o.not_before
     limit greatest(1, least(p_limit, 500))
     for update skip locked
  )
  update public.notification_outbox o
     set claimed_at = now()
    from faellig f
   where o.id = f.id
  returning o.*;
end;
$$;

create or replace function public.push_mark_sent(p_ids uuid[])
returns void
language sql security definer set search_path = public
as $$
  update public.notification_outbox
     set sent_at = now(), error = null
   where id = any(p_ids);
$$;

create or replace function public.push_mark_error(p_id uuid, p_error text)
returns void
language sql security definer set search_path = public
as $$
  update public.notification_outbox
     set error = left(p_error, 400), claimed_at = null
   where id = p_id;
$$;

-- Zustellung geglueckt bzw. gescheitert - Geraet pflegen.
create or replace function public.push_subscription_ok(p_endpoint text)
returns void
language sql security definer set search_path = public
as $$
  update public.push_subscriptions
     set last_success_at = now(), failed_count = 0
   where endpoint = p_endpoint;
$$;

-- 404/410 vom Push-Dienst: das Geraet gibt es nicht mehr. Sonst hochzaehlen
-- und ab dem fuenften Fehlversuch aufgeben.
create or replace function public.push_subscription_failed(p_endpoint text, p_gone boolean default false)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if p_gone then
    delete from public.push_subscriptions where endpoint = p_endpoint;
    return;
  end if;
  update public.push_subscriptions
     set failed_count = failed_count + 1
   where endpoint = p_endpoint;
  delete from public.push_subscriptions
   where endpoint = p_endpoint and failed_count >= 5;
end;
$$;

-- ----------------------------------------------------------------------------
-- 8) Anstoss im Minutentakt - aber nur, wenn es etwas zu tun gibt
-- ----------------------------------------------------------------------------
-- Adresse und Geheimnis stehen im Vault, damit sie nicht im Quelltext dieser
-- Datei landen und nicht im Repo. Namen der Eintraege:
--   push_dispatch_url     https://<projekt>.vercel.app/api/dispatch-push
--   push_dispatch_secret  dasselbe Geheimnis wie PUSH_DISPATCH_SECRET in Vercel
create or replace function public.push_dispatch_tick()
returns void
language plpgsql security definer set search_path = public, vault
as $$
declare
  v_url    text;
  v_secret text;
begin
  -- Nichts faellig? Dann auch kein Aufruf. Spart den Grossteil der Minuten.
  if not exists (select 1 from public.notification_due limit 1) then
    return;
  end if;

  select decrypted_secret into v_url    from vault.decrypted_secrets where name = 'push_dispatch_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_dispatch_secret';

  if v_url is null or v_secret is null then
    raise warning 'push_dispatch_tick: push_dispatch_url oder push_dispatch_secret fehlt im Vault.';
    return;
  end if;

  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'x-push-secret', v_secret),
    body    := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
end;
$$;

create extension if not exists pg_cron;

select cron.unschedule('push-dispatch')
 where exists (select 1 from cron.job where jobname = 'push-dispatch');
select cron.schedule('push-dispatch', '* * * * *', $$select public.push_dispatch_tick();$$);

-- ----------------------------------------------------------------------------
-- 9) Aufraeumen: die Outbox ist die In-App-Liste der letzten 30 Tage,
--    aufgehoben wird sie 90 Tage.
-- ----------------------------------------------------------------------------
create or replace function public.notification_outbox_cleanup()
returns integer
language plpgsql security definer set search_path = public
as $$
declare v_n integer;
begin
  delete from public.notification_outbox where created_at < now() - interval '90 days';
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

select cron.unschedule('notification-cleanup')
 where exists (select 1 from cron.job where jobname = 'notification-cleanup');
select cron.schedule('notification-cleanup', '17 4 * * *', $$select public.notification_outbox_cleanup();$$);
