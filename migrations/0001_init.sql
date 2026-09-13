-- ============================================================================
-- FC Fasanerie-Nord - Supabase Migration 0001
-- Schema + Row Level Security + Demo-Daten (uebertragen aus data.js)
--
-- Ausfuehren: Supabase Dashboard -> SQL Editor -> einfuegen -> "Run".
-- Hinweis: Das TRUNCATE weiter unten setzt die Demo-Daten bei erneutem
--          Ausfuehren sauber zurueck.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Tabellen
-- ----------------------------------------------------------------------------
create table if not exists clubs (
  id         uuid primary key default gen_random_uuid(),
  slug       text unique not null,
  name       text not null,
  founded    int,
  season     text,
  created_at timestamptz not null default now()
);

create table if not exists players (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null references clubs(id) on delete cascade,
  code       text not null,
  name       text not null,
  number     int,
  position   text,
  created_at timestamptz not null default now(),
  unique (club_id, code)
);

create table if not exists events (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null references clubs(id) on delete cascade,
  code       text not null,
  type       text not null check (type in ('spiel','training','event')),
  title      text not null,
  opponent   text,
  home       boolean,
  date       date not null,
  time       text,
  location   text,
  note       text,
  created_at timestamptz not null default now(),
  unique (club_id, code)
);

create table if not exists fine_catalog (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null references clubs(id) on delete cascade,
  code       text not null,
  offense    text not null,
  amount     numeric(10,2) not null,
  category   text,
  created_at timestamptz not null default now(),
  unique (club_id, code)
);

create table if not exists fines (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null references clubs(id) on delete cascade,
  player_id  uuid not null references players(id) on delete cascade,
  catalog_id uuid not null references fine_catalog(id) on delete restrict,
  date       date not null,
  paid       boolean not null default false,
  note       text,
  created_at timestamptz not null default now()
);

create table if not exists rsvps (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null references clubs(id) on delete cascade,
  event_id   uuid not null references events(id) on delete cascade,
  player_id  uuid not null references players(id) on delete cascade,
  status     text not null check (status in ('zu','ab')),
  reason     text,
  updated_at timestamptz not null default now(),
  unique (event_id, player_id)
);

create index if not exists idx_players_club  on players(club_id);
create index if not exists idx_events_club   on events(club_id, date);
create index if not exists idx_fines_player  on fines(player_id);
create index if not exists idx_fines_catalog on fines(catalog_id);
create index if not exists idx_rsvps_event   on rsvps(event_id);
create index if not exists idx_rsvps_player  on rsvps(player_id);

-- ----------------------------------------------------------------------------
-- 2) Row Level Security
-- ----------------------------------------------------------------------------
alter table clubs        enable row level security;
alter table players      enable row level security;
alter table events       enable row level security;
alter table fine_catalog enable row level security;
alter table fines        enable row level security;
alter table rsvps        enable row level security;

-- Tabellen-Rechte fuer die oeffentlichen Rollen (RLS schraenkt zusaetzlich ein)
grant usage on schema public to anon, authenticated;
grant select on clubs, players, events, fine_catalog, fines, rsvps to anon, authenticated;
grant insert, update, delete on rsvps to anon, authenticated;
grant update on fines to anon, authenticated;

-- Oeffentliches Lesen (Demo: jeder darf alles sehen)
drop policy if exists read_clubs        on clubs;
create policy read_clubs        on clubs        for select using (true);
drop policy if exists read_players      on players;
create policy read_players      on players      for select using (true);
drop policy if exists read_events       on events;
create policy read_events       on events       for select using (true);
drop policy if exists read_fine_catalog on fine_catalog;
create policy read_fine_catalog on fine_catalog for select using (true);
drop policy if exists read_fines        on fines;
create policy read_fines        on fines        for select using (true);
drop policy if exists read_rsvps        on rsvps;
create policy read_rsvps        on rsvps        for select using (true);

-- Schreibrechte nur dort, wo die App sie aktuell braucht (Demo ohne Login)
drop policy if exists write_rsvps_ins on rsvps;
create policy write_rsvps_ins on rsvps for insert with check (true);
drop policy if exists write_rsvps_upd on rsvps;
create policy write_rsvps_upd on rsvps for update using (true) with check (true);
drop policy if exists write_rsvps_del on rsvps;
create policy write_rsvps_del on rsvps for delete using (true);
drop policy if exists write_fines_upd on fines;
create policy write_fines_upd on fines for update using (true) with check (true);

-- ----------------------------------------------------------------------------
-- 3) Demo-Daten (1:1 aus data.js)
-- ----------------------------------------------------------------------------
truncate table rsvps, fines, fine_catalog, events, players, clubs cascade;

insert into clubs (slug, name, founded, season)
values ('fcfn', 'FC Fasanerie-Nord e.V.', 1977, 'Saison 2025/26');

insert into players (club_id, code, name, number, position)
select c.id, v.code, v.name, v.number, v.position
from clubs c
cross join (values
  ('p01','Tobias Wagner',1,'TW'),
  ('p02','Jan Krüger',2,'AV'),
  ('p03','Paul Neumann',3,'AV'),
  ('p04','Max Bauer',4,'IV'),
  ('p05','Leon Schmidt',5,'IV'),
  ('p06','Jonas Becker',6,'ZM'),
  ('p07','Felix Hofmann',7,'OM'),
  ('p08','David Wolf',8,'ZM'),
  ('p09','Niklas Fischer',9,'ST'),
  ('p10','Lukas Weber',10,'OM'),
  ('p11','Tim Richter',11,'ST'),
  ('p14','Moritz Schäfer',14,'ZM'),
  ('p16','Simon Lang',16,'AV'),
  ('p17','Florian Huber',17,'OM'),
  ('p19','Daniel Koch',19,'ST'),
  ('p21','Sebastian Maier',21,'TW')
) as v(code, name, number, position)
where c.slug = 'fcfn';

insert into events (club_id, code, type, title, opponent, home, date, time, location, note)
select c.id, v.code, v.type, v.title, v.opponent, v.home, v.date, v.time, v.location, v.note
from clubs c
cross join (values
  ('e01','training','Abschlusstraining',     null::text,           null::boolean, date '2026-06-04','19:00','Sportgelände Fasanerie, Platz 2','Standards & Spielformen'),
  ('e02','spiel',   'Heimspiel',             'SV Lochhausen',       true,          date '2026-06-07','15:00','Sportgelände Fasanerie, Hauptplatz','Treffen 13:30 Uhr am Platz'),
  ('e03','training','Mannschaftstraining',    null,                 null,          date '2026-06-09','19:00','Sportgelände Fasanerie, Platz 2',null),
  ('e04','training','Mannschaftstraining',    null,                 null,          date '2026-06-11','19:00','Sportgelände Fasanerie, Platz 2',null),
  ('e05','spiel',   'Auswärtsspiel',         'TSV Allach',          false,         date '2026-06-13','14:00','Bezirkssportanlage Allach','Fahrgemeinschaften ab Vereinsheim 12:15 Uhr'),
  ('e06','training','Mannschaftstraining',    null,                 null,          date '2026-06-16','19:00','Sportgelände Fasanerie, Platz 2',null),
  ('e07','training','Mannschaftstraining',    null,                 null,          date '2026-06-18','19:00','Sportgelände Fasanerie, Platz 2',null),
  ('e08','event',   'Sommerfest des Vereins', null,                 null,          date '2026-06-19','17:00','Vereinsheim & Festzelt','Mit Familien – Helfer für Grillstand gesucht'),
  ('e09','spiel',   'Heimspiel',             'FC Phönix München',   true,          date '2026-06-21','15:00','Sportgelände Fasanerie, Hauptplatz','Letztes Heimspiel der Saison'),
  ('e10','event',   'Mannschaftsabend',       null,                 null,          date '2026-06-25','20:00','Gaststätte Zum Fasan','Saisonabschluss & Ehrungen'),
  ('e11','training','Mannschaftstraining',    null,                 null,          date '2026-06-23','19:00','Sportgelände Fasanerie, Platz 2',null),
  ('e12','spiel',   'Auswärtsspiel',         'SpVgg Feldmoching',   false,         date '2026-06-28','13:00','Sportplatz Feldmoching','Saisonfinale')
) as v(code, type, title, opponent, home, date, time, location, note)
where c.slug = 'fcfn';

insert into fine_catalog (club_id, code, offense, amount, category)
select c.id, v.code, v.offense, v.amount, v.category
from clubs c
cross join (values
  ('k01','Zu spät zum Training',5,'Pünktlichkeit'),
  ('k02','Zu spät zum Spiel / Treffpunkt',10,'Pünktlichkeit'),
  ('k03','Unentschuldigtes Fehlen (Training)',15,'Absagen'),
  ('k04','Unentschuldigtes Fehlen (Spiel)',25,'Absagen'),
  ('k05','Verspätete Absage (< 24 Std.)',8,'Absagen'),
  ('k06','Handy klingelt in der Besprechung',5,'Verhalten'),
  ('k07','Gelb-Rote Karte (Meckern)',10,'Karten'),
  ('k08','Rote Karte (unsportlich)',20,'Karten'),
  ('k09','Trikot / Ausrüstung vergessen',5,'Ausrüstung'),
  ('k10','Geburtstag ohne Kuchen / Brezen',15,'Tradition'),
  ('k11','Duschen mit Socken',3,'Spaß'),
  ('k12','Elfmeter im Spiel verschossen',5,'Spiel'),
  ('k13','Falscher Torjubel / Eigenlob',3,'Spaß'),
  ('k14','Vergessene Zahlung Mannschaftskasse',10,'Kasse')
) as v(code, offense, amount, category)
where c.slug = 'fcfn';

insert into fines (club_id, player_id, catalog_id, date, paid, note)
select c.id, p.id, k.id, v.date, v.paid, v.note
from clubs c
cross join (values
  ('p11','k02', date '2026-05-10', false, '15 Min zu spät'),
  ('p07','k07', date '2026-05-10', false, null::text),
  ('p04','k01', date '2026-05-12', true,  null),
  ('p10','k10', date '2026-05-15', false, 'Geburtstag vergessen'),
  ('p06','k09', date '2026-05-19', true,  null),
  ('p09','k12', date '2026-05-24', false, 'Strafstoß über das Tor'),
  ('p11','k11', date '2026-05-24', true,  null),
  ('p17','k03', date '2026-05-26', false, null),
  ('p08','k06', date '2026-05-28', true,  null),
  ('p05','k01', date '2026-05-30', false, 'Stau auf der A99'),
  ('p19','k08', date '2026-06-01', false, 'Notbremse'),
  ('p07','k13', date '2026-06-02', false, null),
  ('p04','k14', date '2026-06-03', true,  null),
  ('p10','k01', date '2026-06-04', false, null),
  ('p16','k09', date '2026-06-04', true,  null)
) as v(pcode, kcode, date, paid, note)
join players p      on p.club_id = c.id and p.code = v.pcode
join fine_catalog k on k.club_id = c.id and k.code = v.kcode
where c.slug = 'fcfn';

insert into rsvps (club_id, event_id, player_id, status, reason)
select c.id, e.id, p.id, v.status, v.reason
from clubs c
cross join (values
  ('e02','p01','zu', null::text),
  ('e02','p04','zu', null),
  ('e02','p06','zu', null),
  ('e02','p09','zu', null),
  ('e02','p10','zu', null),
  ('e02','p11','ab', 'Urlaub'),
  ('e02','p17','ab', 'Arbeit'),
  ('e03','p01','zu', null),
  ('e03','p04','zu', null),
  ('e03','p05','ab', 'Verletzt'),
  ('e05','p09','ab', 'Familienfeier'),
  ('e05','p08','zu', null)
) as v(ecode, pcode, status, reason)
join events e  on e.club_id = c.id and e.code = v.ecode
join players p on p.club_id = c.id and p.code = v.pcode
where c.slug = 'fcfn';

-- Fertig. Erwartete Zeilen: clubs=1, players=16, events=12,
-- fine_catalog=14, fines=15, rsvps=12.
