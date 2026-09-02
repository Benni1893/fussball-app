-- ============================================================================
-- FC Fasanerie-Nord - TESTDATEN EINSPIELEN  (Produktion, Verein 'fcfn')
--
-- - Fuegt NUR ein. Alles ist mit is_testdaten = true markiert.
-- - Idempotent: feste Codes (tp01..tp20, te01) + ON CONFLICT / NOT EXISTS.
--   Beliebig oft ausfuehrbar, ohne Duplikate oder Fehler.
-- - Ruehrt echte Daten NICHT an (kein update/delete auf echten Zeilen).
--
-- Ausfuehren: Supabase Dashboard -> SQL Editor -> einfuegen -> Run.
-- Entfernen spaeter: remove_testdaten.sql
-- ============================================================================

-- 0) Flag-Spalte auf allen betroffenen Tabellen sicherstellen (idempotent) -----
alter table public.players       add column if not exists is_testdaten boolean not null default false;
alter table public.fines         add column if not exists is_testdaten boolean not null default false;
alter table public.rsvps         add column if not exists is_testdaten boolean not null default false;
alter table public.player_status add column if not exists is_testdaten boolean not null default false;
alter table public.events        add column if not exists is_testdaten boolean not null default false;

-- 1) 20 Testspieler (2 Tor / 7 Abwehr / 7 Mittelfeld / 4 Angriff) -------------
--    Nummern 71-90, damit sie nicht mit echten Ruecknummern kollidieren.
insert into public.players (club_id, code, name, number, position, is_testdaten)
select c.id, v.code, v.name, v.number, v.position, true
from public.clubs c
cross join (values
  -- Tor (2)
  ('tp01','Michael Fuchs',    71,'TW'),
  ('tp02','Andreas Vogel',    72,'TW'),
  -- Abwehr (7): 4x IV, 3x AV
  ('tp03','Christian Böhm',   73,'IV'),
  ('tp04','Stefan Winkler',   74,'IV'),
  ('tp05','Thomas Ziegler',   75,'IV'),
  ('tp06','Markus Brandt',    76,'IV'),
  ('tp07','Sven Kaiser',      77,'AV'),
  ('tp08','Dominik Busch',    78,'AV'),
  ('tp09','Patrick Sommer',   79,'AV'),
  -- Mittelfeld (7): 4x ZM, 3x OM
  ('tp10','Alexander Reuter', 80,'ZM'),
  ('tp11','Fabian Kern',      81,'ZM'),
  ('tp12','Philipp Lorenz',   82,'ZM'),
  ('tp13','Benjamin Arndt',   83,'ZM'),
  ('tp14','Tobias Engel',     84,'OM'),
  ('tp15','Marcel Frank',     85,'OM'),
  ('tp16','Kevin Hartmann',   86,'OM'),
  -- Angriff (4): ST
  ('tp17','Dennis Pohl',      87,'ST'),
  ('tp18','Robin Seidel',     88,'ST'),
  ('tp19','Jan Böttcher',     89,'ST'),
  ('tp20','Marvin Schuster',  90,'ST')
) as v(code, name, number, position)
where c.slug = 'fcfn'
on conflict (club_id, code) do nothing;

-- 2) Status: 3x verletzt, 1x angeschlagen ------------------------------------
insert into public.player_status (player_id, status, status_note, status_since, is_testdaten)
select p.id, v.status, v.note, current_date - 7, true
from public.players p
join (values
  ('tp05','verletzt',    'Muskelfaserriss'),
  ('tp09','verletzt',    'Bänderdehnung'),
  ('tp18','verletzt',    'Knieprobleme'),
  ('tp15','angeschlagen','Erkältung')
) as v(pcode, status, note) on v.pcode = p.code and p.is_testdaten
on conflict (player_id) do update
  set status = excluded.status, status_note = excluded.status_note, is_testdaten = true;

-- 3) Strafen aus dem BESTEHENDEN Katalog: 8 offen, 4 bezahlt -----------------
insert into public.fines (club_id, player_id, catalog_id, date, paid, note, is_testdaten)
select c.id, p.id, k.id, v.date, v.paid, v.note, true
from public.clubs c
cross join (values
  ('tp03','k02', date '2026-08-12', false, '15 Min zu spät'::text),
  ('tp05','k04', date '2026-08-14', false, null::text),
  ('tp07','k01', date '2026-08-15', true,  null::text),
  ('tp09','k10', date '2026-08-16', false, 'Geburtstag ohne Brezen'::text),
  ('tp11','k07', date '2026-08-18', true,  null::text),
  ('tp12','k09', date '2026-08-19', false, null::text),
  ('tp14','k06', date '2026-08-20', true,  null::text),
  ('tp16','k08', date '2026-08-21', false, 'Notbremse'::text),
  ('tp18','k11', date '2026-08-22', false, null::text),
  ('tp20','k12', date '2026-08-23', false, 'Elfmeter drüber'::text),
  ('tp04','k14', date '2026-08-24', true,  null::text),
  ('tp08','k03', date '2026-08-26', false, null::text)
) as v(pcode, kcode, date, paid, note)
join public.players p      on p.club_id = c.id and p.code = v.pcode and p.is_testdaten
join public.fine_catalog k on k.club_id = c.id and k.code = v.kcode
where c.slug = 'fcfn'
  and not exists (
    select 1 from public.fines f
    where f.is_testdaten and f.player_id = p.id and f.catalog_id = k.id and f.date = v.date
  );

-- 4) Test-Spiel (naechste Woche). auto_fine = FALSE -> KEINE Auto-Strafen! ----
insert into public.events (club_id, code, type, title, opponent, home, date, time, location, note, auto_fine, is_testdaten)
select c.id, 'te01', 'spiel', 'Testspiel (Testdaten)', 'SV Musterstadt', true,
       current_date + 7, '15:00', 'Sportgelände Fasanerie, Hauptplatz', 'Nur zum Testen', false, true
from public.clubs c
where c.slug = 'fcfn'
on conflict (club_id, code) do update
  set date = excluded.date, auto_fine = false, is_testdaten = true;

-- 5) Gemischte RSVPs fuer das Test-Spiel (13x zu, 4x ab, Rest ohne Antwort) ---
insert into public.rsvps (club_id, event_id, player_id, status, reason, is_testdaten)
select c.id, e.id, p.id, v.status, v.reason, true
from public.clubs c
join public.events  e on e.club_id = c.id and e.code = 'te01'
cross join (values
  ('tp01','zu', null::text), ('tp03','zu', null::text), ('tp04','zu', null::text),
  ('tp06','zu', null::text), ('tp07','zu', null::text), ('tp10','zu', null::text),
  ('tp11','zu', null::text), ('tp13','zu', null::text), ('tp15','zu', null::text),
  ('tp16','zu', null::text), ('tp17','zu', null::text), ('tp19','zu', null::text),
  ('tp20','zu', null::text),
  ('tp02','ab', 'Urlaub'), ('tp05','ab', 'Verletzt'), ('tp08','ab', 'Arbeit'), ('tp12','ab', 'Krank')
) as v(pcode, status, reason)
join public.players p on p.club_id = c.id and p.code = v.pcode and p.is_testdaten
where c.slug = 'fcfn'
on conflict (event_id, player_id) do nothing;

-- 6) Kontrolle: wie viele Testdaten stehen jetzt drin? -----------------------
select 'players'       as tabelle, count(*) from public.players       where is_testdaten
union all select 'player_status', count(*) from public.player_status where is_testdaten
union all select 'fines',         count(*) from public.fines         where is_testdaten
union all select 'events',        count(*) from public.events        where is_testdaten
union all select 'rsvps',         count(*) from public.rsvps         where is_testdaten;
-- Erwartet: players=20, player_status=4, fines=12, events=1, rsvps=17.
