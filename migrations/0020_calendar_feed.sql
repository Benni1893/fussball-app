-- ============================================================================
-- FC Fasanerie-Nord - Migration 0020: Persoenlicher iCal-Feed
--
-- Spieler koennen alle Team-Termine in ihren Handy-Kalender abonnieren.
--   * profiles.calendar_token: geheimer, eindeutiger Token = Berechtigung
--     fuer den Feed-Endpunkt (kein Login moeglich, Kalender-Apps koennen sich
--     nicht anmelden). Wird beim ersten Abruf per RPC angelegt.
--   * events.ical_seq: SEQUENCE-Zaehler; steigt bei inhaltlicher Aenderung,
--     damit Kalender-Apps Aktualisierungen erkennen.
--   * RPCs (SECURITY DEFINER), weil normale Spieler profiles nicht selbst
--     schreiben duerfen (RLS: UPDATE nur Admin).
--
-- Token = zwei zufaellige UUIDs ohne Bindestriche (64 Hex-Zeichen, >32,
-- kryptografischer RNG von gen_random_uuid, URL-sicher). Kein pgcrypto noetig.
-- ============================================================================

-- 1) Token-Spalte (geheim, eindeutig)
alter table public.profiles add column if not exists calendar_token text unique;

-- 2) SEQUENCE-Zaehler pro Termin
alter table public.events add column if not exists ical_seq integer not null default 0;

-- Zaehler nur hochsetzen, wenn sich ein im Feed sichtbares Feld aendert.
create or replace function public.events_bump_ical_seq()
returns trigger language plpgsql as $$
begin
  if new.title        is distinct from old.title
     or new.type         is distinct from old.type
     or new.date         is distinct from old.date
     or new.time         is distinct from old.time
     or new.ende         is distinct from old.ende
     or new.location_raw is distinct from old.location_raw
     or new.note         is distinct from old.note
     or new.status       is distinct from old.status
     or new.opponent     is distinct from old.opponent
     or new.home         is distinct from old.home then
    new.ical_seq := coalesce(old.ical_seq, 0) + 1;
  end if;
  return new;
end;
$$;

drop trigger if exists events_bump_ical_seq on public.events;
create trigger events_bump_ical_seq before update on public.events
  for each row execute function public.events_bump_ical_seq();

-- 3) Eigenen Token holen (bei Bedarf anlegen). Nur der eingeloggte Nutzer.
create or replace function public.my_calendar_token()
returns text
language plpgsql security definer set search_path = public
as $$
declare v_tok text;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.'; end if;
  select calendar_token into v_tok from public.profiles where id = auth.uid();
  if v_tok is null then
    v_tok := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
    update public.profiles set calendar_token = v_tok where id = auth.uid();
  end if;
  return v_tok;
end;
$$;

-- 4) Token neu erzeugen (falls Link versehentlich weitergegeben wurde).
create or replace function public.regenerate_calendar_token()
returns text
language plpgsql security definer set search_path = public
as $$
declare v_tok text;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.'; end if;
  v_tok := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  update public.profiles set calendar_token = v_tok where id = auth.uid();
  return v_tok;
end;
$$;

grant execute on function public.my_calendar_token()         to authenticated;
grant execute on function public.regenerate_calendar_token() to authenticated;
