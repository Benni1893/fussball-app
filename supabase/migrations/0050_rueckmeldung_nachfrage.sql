-- ============================================================================
-- FC Fasanerie-Nord - Migration 0050: P1 serverseitig, Nachfrage per Push
--
-- Plan und Entscheidungen: .design-sync/reference/app/einstellungen-v2/PHASE0.md,
-- Abschnitt e) und Entscheidungen 1, 4, 5 (03.10.2026). Annahmen N1 bis N4 in
-- auto-mitteilungen/ANNAHMEN.md. Der Knopf im Rueckmeldungen-Blatt kommt nach
-- dem Design-Review; diese Migration ist nur die Server-Seite.
--
--   1. Kategorie rueckmeldung_nachfrage in beiden Check-Constraints, Vorlage
--      (normal dringlich, gueltig bis Beginn, hoechstens 24 h), Rolle spieler,
--      Schalter = "Erinnerung an Zu- oder Absage" (rueckmeldung_erinnerung) in
--      notification_due. Sonst ist die Sicht unveraendert (wie 0043).
--   2. RPC send_rsvp_reminder(p_event, p_nur_zaehlen): nur Trainer oder Admin
--      (echte Rolle). Der Aufrufer gibt nur die Termin-ID. Empfaenger: Spieler
--      ohne Rueckmeldung, ohne Urlaub/verletzt am Termintag (Entscheidung 1),
--      mit Konto, Geraet und eingeschaltetem Schalter. Sperre: je Termin eine
--      Nachfrage in 12 Stunden, egal welcher Trainer; keine nach Beginn
--      (Entscheidung 5). p_nur_zaehlen = true liefert die Zahlen ohne Senden.
--      Rueckgabe jsonb: offen, ausgenommen, ohne_konto, ohne_abo, abgeschaltet,
--      gesendet, in_ruhezeit, zustellung_ab, gesperrt, letzte, naechste_moeglich.
--
-- RECHTE: send_rsvp_reminder -> authenticated (Rollenpruefung in der Funktion),
-- sonst nichts fuer anon/authenticated. Aufbau: EIN do-Block.
-- ============================================================================

begin;

do $migration$
declare
  v_fehl text[] := '{}';
  v_kats text := $k$'strafe_neu','zahlung_bestaetigt','zahlung_abgelehnt','zahlung_gemeldet','absage_kurzfristig','termin_geaendert','termin_abgesagt','termin_neu','rueckmeldung_erinnerung','unterbesetzung','meldeschluss_uebersicht','strafen_offen','test','rueckmeldung_nachfrage'$k$;
  v_club uuid; v_prof uuid; v_player uuid; v_ev uuid; v_r jsonb; v_n integer;
begin
  -- --------------------------------------------------------------------------
  -- 1) Kategorie, Vorlage, Rolle, Schalter
  -- --------------------------------------------------------------------------
  execute 'alter table public.notification_templates drop constraint notification_templates_kat_chk';
  execute 'alter table public.notification_templates add constraint notification_templates_kat_chk check (kategorie in (' || v_kats || '))';
  execute 'alter table public.notification_outbox drop constraint notification_outbox_kat_chk';
  execute 'alter table public.notification_outbox add constraint notification_outbox_kat_chk check (kategorie in (' || v_kats || '))';

  insert into public.notification_templates
    (kategorie, titel_vorlage, text_vorlage, deep_link_vorlage, urgency, ttl_regel, ttl_sekunden,
     platzhalter, platzhalter_optional, beispiel_daten, empfaenger_beschreibung, ausloeser_beschreibung, aktiv)
  values
    ('rueckmeldung_nachfrage',
     '⏳ Bitte zurückmelden: {termin_titel}',
     '{datum} {uhrzeit}. Dein Trainer wartet noch auf deine Zu- oder Absage.',
     '#termin={termin_id}', 'normal', 'bis_zeitpunkt', 86400,
     array['termin_titel','datum','uhrzeit','meldeschluss','termin_id'], array['uhrzeit','meldeschluss'],
     '{"termin_titel":"VfB Sparta München","datum":"20.09.","uhrzeit":"12:30 Uhr","meldeschluss":"morgen 12:30 Uhr","termin_id":"beispiel"}'::jsonb,
     'Spieler ohne Rückmeldung zu diesem Termin.',
     'Ein Trainer tippt im Rückmeldungen-Blatt auf „Push senden“.',
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
      when 'zahlung_gemeldet'        then 'treasurer'
      when 'test'                    then 'alle'
      else null                                   -- unbekannt: niemand
    end;
  $$
  $ddl$;

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
             end, false))
     and (o.ist_vorschau or o.kategorie = 'test'
          or not public.in_quiet_hours(p.quiet_from, p.quiet_to)
          or (o.urgency = 'high' and p.quiet_override_urgent))
  $ddl$;
  -- Rechte der Sicht wie 0042 (create or replace behaelt sie; ausdruecklich):
  revoke all on public.notification_due from public, anon, authenticated;
  grant select on public.notification_due to service_role;

  -- --------------------------------------------------------------------------
  -- 2) RPC send_rsvp_reminder
  -- --------------------------------------------------------------------------
  execute $ddl$
  create or replace function public.send_rsvp_reminder(p_event uuid, p_nur_zaehlen boolean default false)
  returns jsonb language plpgsql security definer set search_path = public
  as $$
  declare
    v_uid uuid := auth.uid();
    e public.events;
    v_letzte timestamptz;
    v_gesperrt boolean;
    v_kreis jsonb;
    v_offen integer; v_aus integer; v_ohne_konto integer; v_ohne_abo integer; v_abgeschaltet integer;
    v_ziel uuid[]; v_ruhe integer; v_ab text; v_gesendet integer := 0;
    v_p uuid;
  begin
    if v_uid is null then
      raise exception 'Nicht angemeldet.' using errcode = '42501';
    end if;
    if not (public.has_role('coach') or public.is_admin()) then
      raise exception 'Nur Trainer oder Admin.' using errcode = '42501';
    end if;
    select * into e from public.events where id = p_event;
    if e.id is null then raise exception 'Termin nicht gefunden.'; end if;
    if e.status = 'abgesagt' then raise exception 'Der Termin fällt aus.'; end if;
    if e.starts_at is null or e.starts_at <= now() then raise exception 'Der Termin hat schon begonnen.'; end if;

    -- Sperre: 12 Stunden je Termin, egal welcher Trainer
    select max(o.created_at) into v_letzte from public.notification_outbox o
     where o.kategorie = 'rueckmeldung_nachfrage' and o.dedup_key like 'nachfrage:' || e.id || ':%';
    v_gesperrt := v_letzte is not null and v_letzte > now() - interval '12 hours';

    -- Spieler des Vereins ohne Rueckmeldung, je eine Zeile
    select coalesce(jsonb_agg(jsonb_build_object(
             'profile_id', pr.id,
             'aus',    public.notify_spieler_faellt_aus_am(pl.id, e.date),
             'abo',    exists (select 1 from public.push_subscriptions s where s.profile_id = pr.id),
             'an',     coalesce(np.rueckmeldung_erinnerung, false),
             'selbst', pr.id is not distinct from v_uid,
             'ruhe',   np.profile_id is not null and public.in_quiet_hours(np.quiet_from, np.quiet_to),
             'ruhe_bis', to_char(np.quiet_to, 'HH24:MI'))), '[]'::jsonb)
      into v_kreis
      from public.players pl
      left join public.profiles pr on pr.player_id = pl.id
      left join public.notification_prefs np on np.profile_id = pr.id
     where pl.club_id = e.club_id
       and not exists (select 1 from public.rsvps rv where rv.event_id = e.id and rv.player_id = pl.id);

    with k as (
      select (x->>'profile_id')::uuid as profile_id, (x->>'aus')::boolean as aus, (x->>'abo')::boolean as abo,
             (x->>'an')::boolean as an, (x->>'selbst')::boolean as selbst, (x->>'ruhe')::boolean as ruhe,
             x->>'ruhe_bis' as ruhe_bis
        from jsonb_array_elements(v_kreis) x)
    select count(*),
           count(*) filter (where aus),
           count(*) filter (where not aus and profile_id is null),
           count(*) filter (where not aus and profile_id is not null and not selbst and not abo),
           count(*) filter (where not aus and profile_id is not null and not selbst and abo and not an),
           array_agg(profile_id) filter (where not aus and profile_id is not null and not selbst and abo and an),
           count(*) filter (where not aus and profile_id is not null and not selbst and abo and an and ruhe),
           max(ruhe_bis) filter (where not aus and profile_id is not null and not selbst and abo and an and ruhe)
      into v_offen, v_aus, v_ohne_konto, v_ohne_abo, v_abgeschaltet, v_ziel, v_ruhe, v_ab
      from k;

    if p_nur_zaehlen then
      v_gesendet := coalesce(array_length(v_ziel, 1), 0);
    elsif not v_gesperrt then
      foreach v_p in array coalesce(v_ziel, '{}'::uuid[]) loop
        if public.notify_enqueue(v_p, 'rueckmeldung_nachfrage',
             jsonb_build_object(
               'termin_titel', public.notify_termin_titel(e.id),
               'datum',        public.notify_datum_kurz(e.date),
               'uhrzeit',      public.notify_uhrzeit(e.time),
               'meldeschluss', case when e.deadline_at is not null then public.notify_meldeschluss_text(e.deadline_at) end,
               'termin_id',    e.id::text),
             p_dedup   => 'nachfrage:' || e.id || ':' || v_p || ':' || floor(extract(epoch from now()) / 43200)::bigint,
             p_ttl_bis => e.starts_at) is not null then
          v_gesendet := v_gesendet + 1;
        end if;
      end loop;
      if v_gesendet > 0 then v_letzte := now(); v_gesperrt := true; end if;
    end if;

    return jsonb_build_object(
      'offen', v_offen, 'ausgenommen', v_aus, 'ohne_konto', v_ohne_konto, 'ohne_abo', v_ohne_abo,
      'abgeschaltet', v_abgeschaltet, 'gesendet', v_gesendet,
      'in_ruhezeit', case when v_gesendet > 0 then v_ruhe else 0 end,
      'zustellung_ab', case when v_gesendet > 0 then v_ab end,
      'gesperrt', v_gesperrt, 'letzte', v_letzte,
      'naechste_moeglich', case when v_letzte is not null then v_letzte + interval '12 hours' end,
      'nur_zaehlen', p_nur_zaehlen);
  end;
  $$
  $ddl$;

  revoke execute on function public.send_rsvp_reminder(uuid, boolean) from public, anon;
  grant  execute on function public.send_rsvp_reminder(uuid, boolean) to authenticated;
  revoke execute on function public.kategorie_rolle(text) from public, anon, authenticated;

  -- --------------------------------------------------------------------------
  -- Gegenprobe
  -- --------------------------------------------------------------------------
  if not exists (select 1 from public.notification_templates where kategorie = 'rueckmeldung_nachfrage' and urgency = 'normal' and ttl_regel = 'bis_zeitpunkt') then
    v_fehl := v_fehl || 'Vorlage fehlt'::text;
  end if;
  if public.kategorie_rolle('rueckmeldung_nachfrage') is distinct from 'spieler'
     or public.kategorie_rolle('zahlung_gemeldet') is distinct from 'treasurer'
     or public.kategorie_rolle('meldeschluss_uebersicht') is distinct from 'coach' then
    v_fehl := v_fehl || 'kategorie_rolle'::text;
  end if;
  if position('rueckmeldung_nachfrage' in pg_get_viewdef('public.notification_due'::regclass)) = 0
     or not exists (select 1 from pg_class where oid = 'public.notification_due'::regclass and reloptions @> array['security_invoker=true'])
     or has_table_privilege('authenticated', 'public.notification_due', 'select')
     or not has_table_privilege('service_role', 'public.notification_due', 'select') then
    v_fehl := v_fehl || 'notification_due'::text;
  end if;
  if not has_function_privilege('authenticated', 'public.send_rsvp_reminder(uuid, boolean)', 'execute')
     or has_function_privilege('anon', 'public.send_rsvp_reminder(uuid, boolean)', 'execute') then
    v_fehl := v_fehl || 'Rechte send_rsvp_reminder'::text;
  end if;

  -- Mit echten Zeilen, zurueckgerollt: als Admin zaehlen, senden, Sperre.
  select p.id, p.player_id, pl.club_id into v_prof, v_player, v_club
    from public.profiles p join public.players pl on pl.id = p.player_id
   where exists (select 1 from public.user_roles ur where ur.user_id = p.id and ur.role = 'admin') limit 1;
  begin
    insert into public.events (club_id, type, title, date, time, status, quelle, auto_fine)
    values (v_club, 'training', 'Gegenprobe', current_date + 3, '19:00', 'geplant', 'manuell', false) returning id into v_ev;
    perform set_config('request.jwt.claims', json_build_object('sub', v_prof, 'role', 'authenticated')::text, true);
    v_r := public.send_rsvp_reminder(v_ev, true);
    if (v_r->>'gesperrt')::boolean or (v_r->>'offen')::int < 1 then
      v_fehl := v_fehl || ('zählen: ' || v_r::text);
    end if;
    v_r := public.send_rsvp_reminder(v_ev, false);
    v_r := public.send_rsvp_reminder(v_ev, false);   -- zweiter Aufruf: gesperrt, nichts Neues
    select count(*) into v_n from public.notification_outbox where kategorie = 'rueckmeldung_nachfrage' and dedup_key like 'nachfrage:' || v_ev || ':%';
    if v_n <> coalesce((select count(*) from public.profiles pr
                          where pr.player_id is not null and pr.id <> v_prof
                            and exists (select 1 from public.push_subscriptions s where s.profile_id = pr.id)), 0) then
      v_fehl := v_fehl || ('gesendet: ' || v_n);
    end if;
    perform set_config('request.jwt.claims', '', true);
    raise exception using errcode = 'P0050', message = 'zurückrollen';
  exception when sqlstate 'P0050' then null;
  end;

  if array_length(v_fehl, 1) > 0 then
    raise exception 'Gegenprobe 0050 fehlgeschlagen: %', v_fehl;
  end if;
  raise notice 'Gegenprobe 0050 bestanden.';
end
$migration$;

commit;

-- RUECKBAU (nicht automatisch): Funktion und Vorlage loeschen, kategorie_rolle
-- und notification_due aus 0039/0043 wiederherstellen, Constraints ohne die
-- neue Kategorie (erst nach dem Loeschen der Outbox-Zeilen dieser Kategorie).
