-- ============================================================================
-- FC Fasanerie-Nord - Migration 0059: Nachschliff C4, Mitteilung an die
--                                     Trainer, wenn "voraussichtlich bis"
--                                     eines Spielerstatus abgelaufen ist
--
-- Auftrag: Nachschliff Oktober, C4, Antworten vom 09.10.2026 (Punkt 8).
--
--   1. Kategorie status_abgelaufen in beiden Check-Constraints, Vorlage
--      (📋, normal dringlich, fix 24 h, Deep Link #ansicht=kader), vom Admin
--      unter Push-Texte aenderbar. Rolle coach (Admin nur mit Trainerrolle,
--      wie kategorie_erlaubt seit 0039).
--   2. Schalter notification_prefs.status_abgelaufen (Standard an), in
--      notification_due und set_notification_prefs (sonst wie 0038/0050).
--   3. Erzeuger notify_cron_status_abgelaufen(p_jetzt): ab 9:00 Uhr Berliner
--      Zeit; Spieler mit Status ungleich fit und status_until = gestern.
--      Je Trainer und Tag EINE Mitteilung (Dedup status_abgelaufen:<Profil>:
--      <Datum>): ein Spieler -> "<Name> wieder verfügbar", mehrere -> "N
--      Spieler wieder verfügbar: A, B". Nur Ablaeufe ab dem Einspielen
--      (status_until >= 09.10.2026), nichts rueckwirkend. Der Status selbst
--      bleibt unveraendert. Ruhezeiten haelt notification_due ein.
--      Cron notify-status-ablauf stuendlich zur vollen Stunde; vor 9 Uhr tut
--      der Lauf nichts, spaetere Laeufe holen einen ausgefallenen nach.
--
-- RECHTE: Erzeuger SECURITY DEFINER, kein grant. Aufbau: EIN do-Block.
-- ============================================================================

begin;

do $migration$
declare
  v_fehl text[] := '{}';
  v_kats text := $k$'strafe_neu','zahlung_bestaetigt','zahlung_abgelehnt','zahlung_gemeldet','absage_kurzfristig','termin_geaendert','termin_abgesagt','termin_neu','rueckmeldung_erinnerung','unterbesetzung','meldeschluss_uebersicht','strafen_offen','test','rueckmeldung_nachfrage','status_abgelaufen'$k$;
  v_prof uuid; v_club uuid; v_p1 uuid; v_p2 uuid; v_n1 text; v_n2 text; v_n integer; v_r integer; v_t text;
begin
  -- --------------------------------------------------------------------------
  -- 1) Kategorie, Vorlage, Rolle
  -- --------------------------------------------------------------------------
  execute 'alter table public.notification_templates drop constraint notification_templates_kat_chk';
  execute 'alter table public.notification_templates add constraint notification_templates_kat_chk check (kategorie in (' || v_kats || '))';
  execute 'alter table public.notification_outbox drop constraint notification_outbox_kat_chk';
  execute 'alter table public.notification_outbox add constraint notification_outbox_kat_chk check (kategorie in (' || v_kats || '))';

  insert into public.notification_templates
    (kategorie, titel_vorlage, text_vorlage, deep_link_vorlage, urgency, ttl_regel, ttl_sekunden,
     platzhalter, platzhalter_optional, beispiel_daten, empfaenger_beschreibung, ausloeser_beschreibung, aktiv)
  values
    ('status_abgelaufen',
     '📋 {kopf}',
     '{detail} Der Status ist noch gesetzt, bitte im Kader prüfen.',
     '#ansicht=kader', 'normal', 'fix', 86400,
     array['kopf','detail','datum'], array['datum'],
     '{"kopf":"Max Muster wieder verfügbar","detail":"Verletzt, voraussichtlich bis 08.10.","datum":"08.10."}'::jsonb,
     'Alle mit der Rolle Trainer.',
     'Am Tag nach „voraussichtlich bis“ um 9:00 Uhr, wenn der Status noch gesetzt ist. Mehrere Spieler am selben Tag kommen in einer Mitteilung.',
     true)
  on conflict (kategorie) do nothing;

  execute $ddl$
  create or replace function public.kategorie_rolle(p_kategorie text)
  returns text language sql immutable set search_path = public
  as $$
    select case p_kategorie
      when 'strafe_neu'              then 'spieler'
      when 'zahlung_bestaetigt'      then 'spieler'
      when 'zahlung_abgelehnt'       then 'spieler'
      when 'rueckmeldung_erinnerung' then 'spieler'
      when 'rueckmeldung_nachfrage'  then 'spieler'
      when 'termin_abgesagt'         then 'spieler'
      when 'termin_geaendert'        then 'spieler'
      when 'termin_neu'              then 'spieler'
      when 'strafen_offen'           then 'spieler'
      when 'absage_kurzfristig'      then 'coach'
      when 'unterbesetzung'          then 'coach'
      when 'meldeschluss_uebersicht' then 'coach'
      when 'status_abgelaufen'       then 'coach'
      when 'zahlung_gemeldet'        then 'treasurer'
      when 'test'                    then 'alle'
      else null                                   -- unbekannt: niemand
    end;
  $$
  $ddl$;
  revoke execute on function public.kategorie_rolle(text) from public, anon, authenticated;

  -- --------------------------------------------------------------------------
  -- 2) Schalter
  -- --------------------------------------------------------------------------
  alter table public.notification_prefs add column if not exists status_abgelaufen boolean not null default true;

  execute $ddl$
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
               when 'rueckmeldung_nachfrage'  then p.rueckmeldung_erinnerung
               when 'unterbesetzung'          then p.unterbesetzung
               when 'meldeschluss_uebersicht' then p.meldeschluss_uebersicht
               when 'strafen_offen'           then p.strafen_offen
               when 'status_abgelaufen'       then p.status_abgelaufen
             end, false))
     and (o.ist_vorschau or o.kategorie = 'test'
          or not public.in_quiet_hours(p.quiet_from, p.quiet_to)
          or (o.urgency = 'high' and p.quiet_override_urgent))
  $ddl$;
  revoke all on public.notification_due from public, anon, authenticated;
  grant select on public.notification_due to service_role;

  execute $ddl$
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
      termin_abgesagt         = coalesce((p_werte->>'termin_abgesagt')::boolean,         termin_abgesagt),
      termin_neu              = coalesce((p_werte->>'termin_neu')::boolean,              termin_neu),
      rueckmeldung_erinnerung = coalesce((p_werte->>'rueckmeldung_erinnerung')::boolean, rueckmeldung_erinnerung),
      unterbesetzung          = coalesce((p_werte->>'unterbesetzung')::boolean,          unterbesetzung),
      meldeschluss_uebersicht = coalesce((p_werte->>'meldeschluss_uebersicht')::boolean, meldeschluss_uebersicht),
      strafen_offen           = coalesce((p_werte->>'strafen_offen')::boolean,           strafen_offen),
      status_abgelaufen       = coalesce((p_werte->>'status_abgelaufen')::boolean,       status_abgelaufen),
      quiet_from              = coalesce((p_werte->>'quiet_from')::time,                 quiet_from),
      quiet_to                = coalesce((p_werte->>'quiet_to')::time,                   quiet_to),
      quiet_override_urgent   = coalesce((p_werte->>'quiet_override_urgent')::boolean,   quiet_override_urgent),
      hint_dismissed_at       = case
                                  when (p_werte->>'hint_dismissed')::boolean is true
                                  then coalesce(hint_dismissed_at, now())
                                  else hint_dismissed_at end,
      updated_at              = now()
    where profile_id = auth.uid();
  end;
  $$
  $ddl$;
  revoke execute on function public.set_notification_prefs(jsonb) from public, anon;
  grant  execute on function public.set_notification_prefs(jsonb) to authenticated;

  -- --------------------------------------------------------------------------
  -- 3) Erzeuger und Cron
  -- --------------------------------------------------------------------------
  execute $ddl$
  create or replace function public.notify_cron_status_abgelaufen(p_jetzt timestamptz default now())
  returns integer language plpgsql security definer set search_path = public
  as $$
  declare
    v_lokal  timestamp := p_jetzt at time zone 'Europe/Berlin';
    v_gest   date      := (p_jetzt at time zone 'Europe/Berlin')::date - 1;
    v_ab     constant date := date '2026-10-09';     -- Einspielen: nichts rueckwirkend
    v_anz    integer; v_namen text; v_einer record; v_kopf text; v_detail text;
    p record; v_id uuid; v_n integer := 0;
  begin
    if extract(hour from v_lokal) < 9 or v_gest < v_ab then return 0; end if;

    select count(*), string_agg(pl.name, ', ' order by pl.name)
      into v_anz, v_namen
      from public.player_status s join public.players pl on pl.id = s.player_id
     where s.status <> 'fit' and s.status_until = v_gest;
    if v_anz = 0 then return 0; end if;

    if v_anz = 1 then
      select pl.name, s.status into v_einer
        from public.player_status s join public.players pl on pl.id = s.player_id
       where s.status <> 'fit' and s.status_until = v_gest;
      v_kopf   := v_einer.name || ' wieder verfügbar';
      v_detail := case v_einer.status when 'verletzt' then 'Verletzt' when 'urlaub' then 'Urlaub' else 'Angeschlagen' end
                  || ', voraussichtlich bis ' || public.notify_datum_kurz(v_gest);
    else
      v_kopf   := v_anz || ' Spieler wieder verfügbar: ' || v_namen;
      select 'Voraussichtlich bis ' || public.notify_datum_kurz(v_gest) || ': '
             || string_agg(pl.name || ' (' || case s.status when 'verletzt' then 'verletzt' when 'urlaub' then 'Urlaub' else 'angeschlagen' end || ')', ', ' order by pl.name) || '.'
        into v_detail
        from public.player_status s join public.players pl on pl.id = s.player_id
       where s.status <> 'fit' and s.status_until = v_gest;
    end if;

    for p in select t.uid as profile_id from public.notify_profile_mit_rolle('coach') as t(uid) loop
      v_id := public.notify_enqueue(p.profile_id, 'status_abgelaufen',
        jsonb_build_object('kopf', v_kopf, 'detail', v_detail, 'datum', public.notify_datum_kurz(v_gest)),
        p_dedup => 'status_abgelaufen:' || p.profile_id || ':' || v_gest);
      if v_id is not null then v_n := v_n + 1; end if;
    end loop;
    return v_n;
  end;
  $$
  $ddl$;
  revoke execute on function public.notify_cron_status_abgelaufen(timestamptz) from public, anon, authenticated;

  perform cron.unschedule('notify-status-ablauf') where exists (select 1 from cron.job where jobname = 'notify-status-ablauf');
  perform cron.schedule('notify-status-ablauf', '0 * * * *', 'select public.notify_cron_status_abgelaufen();');

  -- --------------------------------------------------------------------------
  -- Gegenprobe
  -- --------------------------------------------------------------------------
  if not exists (select 1 from public.notification_templates where kategorie = 'status_abgelaufen' and aktiv and urgency = 'normal' and ttl_regel = 'fix' and deep_link_vorlage = '#ansicht=kader') then
    v_fehl := v_fehl || 'Vorlage'::text;
  end if;
  if public.kategorie_rolle('status_abgelaufen') is distinct from 'coach'
     or public.kategorie_rolle('meldeschluss_uebersicht') is distinct from 'coach'
     or public.kategorie_rolle('rueckmeldung_nachfrage') is distinct from 'spieler' then
    v_fehl := v_fehl || 'kategorie_rolle'::text;
  end if;
  if position('status_abgelaufen' in pg_get_viewdef('public.notification_due'::regclass)) = 0
     or position('rueckmeldung_nachfrage' in pg_get_viewdef('public.notification_due'::regclass)) = 0
     or not exists (select 1 from pg_class where oid = 'public.notification_due'::regclass and reloptions @> array['security_invoker=true'])
     or has_table_privilege('authenticated', 'public.notification_due', 'select')
     or not has_table_privilege('service_role', 'public.notification_due', 'select') then
    v_fehl := v_fehl || 'notification_due'::text;
  end if;
  if position('status_abgelaufen' in pg_get_functiondef('public.set_notification_prefs(jsonb)'::regprocedure)) = 0
     or not has_function_privilege('authenticated', 'public.set_notification_prefs(jsonb)', 'execute')
     or has_function_privilege('anon', 'public.set_notification_prefs(jsonb)', 'execute') then
    v_fehl := v_fehl || 'set_notification_prefs'::text;
  end if;
  if has_function_privilege('authenticated', 'public.notify_cron_status_abgelaufen(timestamptz)', 'execute')
     or has_function_privilege('anon', 'public.notify_cron_status_abgelaufen(timestamptz)', 'execute') then
    v_fehl := v_fehl || 'Rechte Erzeuger'::text;
  end if;
  if not exists (select 1 from cron.job where jobname = 'notify-status-ablauf' and schedule = '0 * * * *' and active) then
    v_fehl := v_fehl || 'Cron-Job'::text;
  end if;
  if (select count(*) from public.notification_prefs where not status_abgelaufen) > 0 then
    v_fehl := v_fehl || 'Standard des Schalters'::text;
  end if;

  -- Mit echten Zeilen, zurueckgerollt: ein Profil bekommt voruebergehend die
  -- Trainerrolle, zwei Spieler einen abgelaufenen Status.
  select p.id, p.club_id into v_prof, v_club from public.profiles p
   where exists (select 1 from public.user_roles ur where ur.user_id = p.id and ur.role = 'admin') limit 1;
  select id, name into v_p1, v_n1 from public.players order by name limit 1;
  select id, name into v_p2, v_n2 from public.players order by name offset 1 limit 1;
  begin
    insert into public.user_roles (user_id, role, club_id) values (v_prof, 'coach', v_club) on conflict do nothing;
    update public.player_status set status = 'fit', status_until = null where status <> 'fit';   -- nur die Faelle der Gegenprobe
    insert into public.player_status (player_id, status, status_until) values (v_p1, 'verletzt', date '2026-10-10')
      on conflict (player_id) do update set status = excluded.status, status_until = excluded.status_until;

    -- vor 9 Uhr: nichts
    v_r := public.notify_cron_status_abgelaufen(timestamp '2026-10-11 08:59' at time zone 'Europe/Berlin');
    if v_r <> 0 then v_fehl := v_fehl || ('vor 9 Uhr: ' || v_r); end if;
    -- 9 Uhr, ein Spieler
    v_r := public.notify_cron_status_abgelaufen(timestamp '2026-10-11 09:00' at time zone 'Europe/Berlin');
    select count(*), max(titel || ' | ' || text || ' | ' || deep_link) into v_n, v_t from public.notification_outbox
     where kategorie = 'status_abgelaufen' and profile_id = v_prof;
    if v_r < 1 or v_n <> 1 or v_t is distinct from '📋 ' || v_n1 || ' wieder verfügbar | Verletzt, voraussichtlich bis 10.10. Der Status ist noch gesetzt, bitte im Kader prüfen. | #ansicht=kader' then
      v_fehl := v_fehl || ('ein Spieler: ' || v_n || ' / ' || coalesce(v_t, '-'));
    end if;
    -- spaeterer Lauf am selben Tag: kein zweites Mal
    v_r := public.notify_cron_status_abgelaufen(timestamp '2026-10-11 10:00' at time zone 'Europe/Berlin');
    if v_r <> 0 then v_fehl := v_fehl || ('doppelt: ' || v_r); end if;
    -- zwei Spieler am selben Tag: eine Sammelmitteilung je Trainer
    update public.player_status set status_until = date '2026-10-12' where player_id = v_p1;
    insert into public.player_status (player_id, status, status_until) values (v_p2, 'urlaub', date '2026-10-12')
      on conflict (player_id) do update set status = excluded.status, status_until = excluded.status_until;
    v_r := public.notify_cron_status_abgelaufen(timestamp '2026-10-13 09:00' at time zone 'Europe/Berlin');
    select count(*), max(titel) into v_n, v_t from public.notification_outbox
     where kategorie = 'status_abgelaufen' and profile_id = v_prof and dedup_key = 'status_abgelaufen:' || v_prof || ':2026-10-12';
    if v_n <> 1 or v_t is distinct from '📋 2 Spieler wieder verfügbar: ' || v_n1 || ', ' || v_n2 then
      v_fehl := v_fehl || ('Sammel: ' || v_n || ' / ' || coalesce(v_t, '-'));
    end if;
    -- Status bleibt unveraendert
    if (select count(*) from public.player_status where player_id in (v_p1, v_p2) and status <> 'fit' and status_until = date '2026-10-12') <> 2 then
      v_fehl := v_fehl || 'Status veraendert'::text;
    end if;
    -- wieder fit: nichts
    update public.player_status set status = 'fit', status_until = date '2026-10-14' where player_id in (v_p1, v_p2);
    v_r := public.notify_cron_status_abgelaufen(timestamp '2026-10-15 09:00' at time zone 'Europe/Berlin');
    if v_r <> 0 then v_fehl := v_fehl || ('fit: ' || v_r); end if;
    -- nichts rueckwirkend: Ablauf vor dem Einspielen
    update public.player_status set status = 'verletzt', status_until = date '2026-10-07' where player_id = v_p1;
    v_r := public.notify_cron_status_abgelaufen(timestamp '2026-10-08 09:00' at time zone 'Europe/Berlin');
    if v_r <> 0 then v_fehl := v_fehl || ('rückwirkend: ' || v_r); end if;
    raise exception using errcode = 'P0059', message = 'zurückrollen';
  exception when sqlstate 'P0059' then null;
  end;

  if array_length(v_fehl, 1) > 0 then
    raise exception 'Gegenprobe 0059 fehlgeschlagen: %', v_fehl;
  end if;
  raise notice 'Gegenprobe 0059 bestanden.';
end
$migration$;

commit;

-- RUECKBAU (nicht automatisch): cron.unschedule('notify-status-ablauf'),
-- Erzeuger loeschen, Vorlage und Outbox-Zeilen der Kategorie loeschen,
-- kategorie_rolle / notification_due / set_notification_prefs wie 0050/0038,
-- Constraints ohne die Kategorie, Spalte notification_prefs.status_abgelaufen
-- entfernen.
