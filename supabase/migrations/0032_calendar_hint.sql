-- ============================================================================
-- FC Fasanerie-Nord - Migration 0032: Kalender-Abo-Hinweis pro Nutzer merken
--
-- Die Abo-Kachel im Kalender soll nicht dauerhaft Platz wegnehmen. Sie
-- erscheint erst nach der ersten eigenen Rueckmeldung und verschwindet
-- endgueltig, sobald der Nutzer sie wegtippt ODER den Abo-Weg beschritten hat.
-- Beides gehoert serverseitig ans Profil, nicht in den localStorage - sonst
-- taucht der Hinweis auf jedem neuen Geraet wieder auf.
--
--   * profiles.calendar_hint_dismissed_at   - X angetippt
--   * profiles.calendar_subscribe_started_at - eine der drei Handlungen im
--     Abo-Blatt ausgeloest (webcal-Knopf, Link kopieren, Google-Seite oeffnen).
--     Nicht schon das blosse Oeffnen des Blattes: auf Android besteht das
--     Abonnieren aus Kopieren plus Handarbeit in der Weboberflaeche, ein
--     beobachtbares "fertig" gibt es dort nicht. Wer nur hineinschaut, soll
--     den Hinweis wiedersehen.
--
-- Beide Spalten sind reine Zeitstempel und nullable: null = noch nicht
-- passiert. Kein Default, damit die 0-Zeilen-Bestandsdaten unveraendert
-- bleiben und bestehende Nutzer den Hinweis genau einmal bekommen.
--
-- Geschrieben wird ueber eine SECURITY-DEFINER-Funktion, weil die RLS von
-- profiles UPDATE nur Admins erlaubt (Muster wie my_calendar_token aus 0020
-- und set_player_status aus 0025). Eine eigene UPDATE-Policy auf profiles
-- waere der falsche Weg - sie oeffnete die ganze Zeile, nicht diese zwei
-- Spalten.
-- ============================================================================

-- 1) Zwei Zeitstempel am Profil
alter table public.profiles add column if not exists calendar_hint_dismissed_at   timestamptz;
alter table public.profiles add column if not exists calendar_subscribe_started_at timestamptz;

comment on column public.profiles.calendar_hint_dismissed_at is
  'Abo-Hinweis im Kalender weggetippt (X). null = noch sichtbar.';
comment on column public.profiles.calendar_subscribe_started_at is
  'Abo-Weg beschritten: webcal-Knopf, Link kopiert oder Google-Seite geoeffnet. null = noch nicht.';

-- 2) Setzen - nur die eigene Zeile, nur von null auf now().
--
-- Monoton absichtlich: die Funktion darf mehrfach laufen (der Client wiederholt
-- einen fehlgeschlagenen Versuch still im Hintergrund) und verschiebt dabei
-- keinen frueheren Zeitpunkt. Zuruecknehmen ist nicht vorgesehen; wer den
-- Hinweis wiedersehen will, findet den Abschnitt dauerhaft in den
-- Einstellungen.
create or replace function public.set_calendar_hint(
  p_dismissed  boolean default false,
  p_subscribed boolean default false
)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.'; end if;

  update public.profiles
     set calendar_hint_dismissed_at =
           case when p_dismissed then coalesce(calendar_hint_dismissed_at, now())
                else calendar_hint_dismissed_at end,
         calendar_subscribe_started_at =
           case when p_subscribed then coalesce(calendar_subscribe_started_at, now())
                else calendar_subscribe_started_at end
   where id = auth.uid();
end;
$$;

grant execute on function public.set_calendar_hint(boolean, boolean) to authenticated;
