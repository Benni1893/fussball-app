-- ============================================================================
-- FC Fasanerie-Nord - Migration 0022: Sportstaetten-Koordinaten
--
-- Apple Kalender macht einen Ort erst zuverlaessig antippbar, wenn Koordinaten
-- dabeistehen (GEO / X-APPLE-STRUCTURED-LOCATION). Diese Tabelle haelt pro
-- Sportstaette (per normalisierter Adresse) Breiten-/Laengengrad.
--
-- Befuellt wird sie manuell in den Einstellungen (nur Trainer/Kassenwart),
-- KEIN automatisches Geocoding. Der Feed liest sie per service_role.
--
-- adresse_norm: kleingeschriebene Adresse ohne Diakritika/Sonderzeichen -
-- stabiler Abgleichschluessel (identisch in Feed und UI aus location_raw
-- berechnet). unique -> ein Eintrag pro Sportstaette, Upsert moeglich.
-- ============================================================================

create table if not exists public.sportstaetten (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  adresse       text not null,
  adresse_norm  text not null unique,
  lat           numeric,
  lng           numeric,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.sportstaetten enable row level security;

-- Lesen: alle (Koordinaten sind nicht schuetzenswert; UI braucht den Stand).
create policy sportstaetten_read on public.sportstaetten
  for select using (true);

-- Schreiben: nur coach/treasurer/admin (zusaetzlich zur Frontend-Gate).
create policy sportstaetten_ins on public.sportstaetten
  for insert to authenticated
  with check (public.has_role('coach') or public.has_role('treasurer') or public.has_role('admin'));
create policy sportstaetten_upd on public.sportstaetten
  for update to authenticated
  using      (public.has_role('coach') or public.has_role('treasurer') or public.has_role('admin'))
  with check (public.has_role('coach') or public.has_role('treasurer') or public.has_role('admin'));
create policy sportstaetten_del on public.sportstaetten
  for delete to authenticated
  using (public.has_role('coach') or public.has_role('treasurer') or public.has_role('admin'));
