-- ============================================================================
-- FC Fasanerie-Nord - Migration 0039: Kategorien an Rollen binden
--
-- Bisher entschied allein der Schalter in notification_prefs, ob eine
-- Nachricht zugestellt wird. Das reicht nicht: wer die Trainerrolle verliert,
-- behaelt seinen eingeschalteten Schalter fuer "Kurzfristige Absagen" - und
-- bekaeme weiter die Absagen der ganzen Mannschaft zu sehen.
--
-- Ab hier gilt BEIDES: der Schalter UND die Rolle. Die Einstellungen bleiben
-- dabei gespeichert; sie greifen nur nicht mehr. Bekommt jemand die Rolle
-- zurueck, gilt wieder, was er einmal eingestellt hat.
--
-- Zweiter Punkt: die Einstellungsansicht will je Kategorie eine Zeile
-- anzeigen, wann die Nachricht kommt - und zwar aus dem Katalog, damit der
-- Text nicht doppelt gepflegt wird. notification_templates ist aber
-- Admin-only lesbar. Statt die Tabelle zu oeffnen (dort stehen auch die
-- Rohvorlagen und Beispieldaten) gibt eine Funktion genau die drei
-- beschreibenden Felder heraus.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Welche Rolle braucht eine Kategorie?
-- ----------------------------------------------------------------------------
-- 'spieler' heisst hier: mit einem Spieler verknuepft (profiles.player_id).
-- Es ist keine Rolle in user_roles - ein Trainer ohne Spielerverknuepfung
-- bekommt deshalb keine Strafen-Nachrichten, und das ist richtig so.
create or replace function public.kategorie_rolle(p_kategorie text)
returns text
language sql immutable set search_path = public
as $$
  select case p_kategorie
    when 'strafe_neu'              then 'spieler'
    when 'zahlung_bestaetigt'      then 'spieler'
    when 'zahlung_abgelehnt'       then 'spieler'
    when 'rueckmeldung_erinnerung' then 'spieler'
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
$$;

comment on function public.kategorie_rolle(text) is
  'Welche Rolle eine Kategorie voraussetzt. spieler = mit einem Spieler verknuepft, nicht user_roles.';

-- Darf dieses Profil diese Kategorie ueberhaupt bekommen?
-- security definer, weil user_roles und profiles fuer den Aufrufer nicht
-- zwingend lesbar sind - der Dispatcher fragt fremde Profile ab.
create or replace function public.kategorie_erlaubt(p_profile uuid, p_kategorie text)
returns boolean
language plpgsql stable security definer set search_path = public
as $$
declare v_rolle text;
begin
  v_rolle := public.kategorie_rolle(p_kategorie);
  if v_rolle is null then return false; end if;            -- unbekannte Kategorie
  if v_rolle = 'alle' then return true; end if;

  if v_rolle = 'spieler' then
    return exists (select 1 from public.profiles
                    where id = p_profile and player_id is not null);
  end if;

  -- Admin bekommt NICHT automatisch alles: wer die Uebersicht nach
  -- Meldeschluss will, braucht die Trainerrolle. Sonst laege der Unterschied
  -- zwischen Verwalten und Mitspielen nur noch im Schalter.
  return exists (select 1 from public.user_roles
                  where user_id = p_profile and role = v_rolle);
end;
$$;

grant execute on function public.kategorie_rolle(text)          to authenticated;
grant execute on function public.kategorie_erlaubt(uuid, text)  to authenticated;

-- ----------------------------------------------------------------------------
-- 2) Die faellige Sicht prueft jetzt Schalter UND Rolle
-- ----------------------------------------------------------------------------
create or replace view public.notification_due as
select o.*
  from public.notification_outbox o
  join public.notification_prefs p on p.profile_id = o.profile_id
 where o.sent_at is null
   and o.error is null
   and o.not_before <= now()
   and (o.claimed_at is null or o.claimed_at < now() - interval '5 minutes')
   -- NEU: die Rolle muss heute noch passen. Gilt auch fuer die Vorschau -
   -- ein Admin ohne Trainerrolle soll sich die Trainer-Nachricht ansehen
   -- koennen, deshalb ist die Vorschau ausgenommen.
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

comment on view public.notification_due is
  'Faellige Nachrichten: nicht gesendet, Zeit erreicht, nicht in Bearbeitung, Rolle passt, Kategorie eingeschaltet, Ruhezeit beachtet.';

-- ----------------------------------------------------------------------------
-- 3) Die beschreibenden Felder des Katalogs fuer alle Angemeldeten
-- ----------------------------------------------------------------------------
-- Nur diese drei Spalten. Die Rohvorlagen, Beispieldaten und der Rest der
-- Tabelle bleiben Admin-only - die Einstellungsansicht braucht sie nicht.
create or replace function public.notification_infos()
returns table (
  kategorie text,
  empfaenger_beschreibung text,
  ausloeser_beschreibung text,
  urgency text,
  aktiv boolean,
  rolle text
)
language sql stable security definer set search_path = public
as $$
  select t.kategorie, t.empfaenger_beschreibung, t.ausloeser_beschreibung,
         t.urgency, t.aktiv, public.kategorie_rolle(t.kategorie)
    from public.notification_templates t
   where t.kategorie <> 'test'
   order by t.kategorie;
$$;

grant execute on function public.notification_infos() to authenticated;

comment on function public.notification_infos() is
  'Beschreibende Felder des Katalogs fuer die Einstellungsansicht. Ohne Vorlagen und Beispieldaten.';

-- ----------------------------------------------------------------------------
-- 4) Gegenprobe
-- ----------------------------------------------------------------------------
do $$
declare
  v_fehlt text[];
  v_n     integer;
begin
  -- Jede Kategorie der Outbox muss eine Rolle haben, sonst wird sie nie
  -- zugestellt und niemand merkt es.
  select array_agg(k) into v_fehlt from (
    select unnest(array[
      'strafe_neu','zahlung_bestaetigt','zahlung_abgelehnt','zahlung_gemeldet',
      'absage_kurzfristig','termin_geaendert','termin_abgesagt','termin_neu',
      'rueckmeldung_erinnerung','unterbesetzung','meldeschluss_uebersicht',
      'strafen_offen','test']) as k
  ) x where public.kategorie_rolle(x.k) is null;

  if v_fehlt is not null then
    raise exception 'Ohne Rolle und damit unzustellbar: % - Migration abgebrochen.', v_fehlt;
  end if;

  -- Eine unbekannte Kategorie muss abgewiesen werden.
  if public.kategorie_rolle('gibt_es_nicht') is not null then
    raise exception 'Unbekannte Kategorie bekommt eine Rolle - Migration abgebrochen.';
  end if;

  select count(*) into v_n from public.notification_infos();
  raise notice 'Rollen gesetzt fuer 13 Kategorien, notification_infos liefert % Zeilen (ohne test).', v_n;
end;
$$;
