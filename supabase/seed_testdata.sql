-- ============================================================================
-- FC Fasanerie-Nord - TESTDATEN (Seed)
-- Im Supabase SQL-Editor ausfuehren.
--
--   ANWENDEN:  Abschnitt "== SEED ==" markieren + Run.  (Ist wiederholbar –
--              vorhandene Testdaten werden zuerst entfernt, dann neu gesetzt.)
--   ENTFERNEN: Abschnitt "== CLEANUP ==" (unten, auskommentiert) markieren + Run.
--
-- Alle Testdaten sind eindeutig markiert und beruehren KEINE echten Daten:
--   * Termine mit code 'sd01'..'sd08'
--   * Strafen mit note-Praefix '[TEST]'
--   * Verletzten-Status nur bei p05/p07 (Cleanup setzt zurueck auf 'fit')
-- Termine liegen relativ zu HEUTE (current_date + N Tage) -> immer aktuell.
-- ============================================================================

-- ============================ == SEED == ====================================

-- 0) evtl. vorhandene Testdaten entfernen (macht das Seed wiederholbar)
delete from public.rsvps where event_id in (select id from public.events where code like 'sd%');
delete from public.fines  where note like '[TEST]%';
delete from public.events where code like 'sd%';

-- 1) Kommende Termine (relativ zu heute)
insert into public.events (club_id, code, type, title, opponent, home, date, time, location, note)
select c.id, v.code, v.type, v.title, v.opponent, v.home,
       current_date + v.dp, v.time, v.location, v.note
from public.clubs c
cross join (values
  ('sd01','training','Mannschaftstraining', null::text,          null::boolean, 3,  '19:00','Sportgelände Fasanerie, Platz 2', null::text),
  ('sd02','spiel',   'Heimspiel',           'SV Musterstadt',    true,          6,  '15:00','Sportgelände Fasanerie, Hauptplatz','Treffen 13:30 Uhr am Platz'),
  ('sd03','training','Mannschaftstraining', null,                null,          8,  '19:00','Sportgelände Fasanerie, Platz 2', null),
  ('sd04','spiel',   'Auswärtsspiel',       'TSV Beispielheim',  false,         12, '14:00','Sportpark Beispielheim','Fahrgemeinschaften ab Vereinsheim 12:00 Uhr'),
  ('sd05','training','Abschlusstraining',   null,                null,          15, '19:00','Sportgelände Fasanerie, Platz 2','Standards & Spielformen'),
  ('sd06','event',   'Mannschaftsabend',    null,                null,          17, '19:30','Gaststätte Zum Fasan', null),
  ('sd07','spiel',   'Heimspiel',           'FC Beispielstadt',  true,          20, '15:00','Sportgelände Fasanerie, Hauptplatz', null),
  ('sd08','training','Mannschaftstraining', null,                null,          22, '19:00','Sportgelände Fasanerie, Platz 2', null)
) as v(code, type, title, opponent, home, dp, time, location, note)
where c.slug = 'fcfn';

-- 2) Zu-/Absagen fuer die kommenden Termine
insert into public.rsvps (club_id, event_id, player_id, status, reason)
select c.id, e.id, p.id, v.status, v.reason
from public.clubs c
cross join (values
  ('sd02','p01','zu', null::text), ('sd02','p04','zu', null), ('sd02','p06','zu', null),
  ('sd02','p10','zu', null), ('sd02','p11','ab', 'Urlaub'), ('sd02','p17','ab', 'Arbeit'),
  ('sd04','p09','zu', null), ('sd04','p10','zu', null), ('sd04','p05','ab', 'Verletzt'),
  ('sd07','p10','zu', null), ('sd07','p07','zu', null), ('sd07','p04','zu', null)
) as v(ecode, pcode, status, reason)
join public.events e  on e.club_id = c.id and e.code = v.ecode
join public.players p on p.club_id = c.id and p.code = v.pcode
where c.slug = 'fcfn';

-- 3) Zuletzt verhaengte Strafen ([TEST]-Notiz; teils "alt" -> Mahnzuschlag)
insert into public.fines (club_id, player_id, catalog_id, date, paid, note, created_at)
select c.id, p.id, k.id, current_date - v.age, v.paid,
       '[TEST]' || case when v.note <> '' then ' ' || v.note else '' end,
       now() - (v.age || ' days')::interval
from public.clubs c
cross join (values
  ('p02','k01', 5,  false, 'Stau auf der A9'),
  ('p03','k05', 12, false, ''),
  ('p05','k03', 22, false, ''),
  ('p07','k07', 40, false, 'Meckern'),
  ('p08','k11', 3,  true,  ''),
  ('p09','k12', 18, false, 'Elfmeter drüber'),
  ('p10','k10', 30, false, 'Geburtstag vergessen'),
  ('p11','k02', 8,  false, '20 Min zu spät'),
  ('p14','k09', 6,  true,  ''),
  ('p16','k06', 2,  false, 'Handy in Besprechung'),
  ('p17','k13', 45, false, ''),
  ('p19','k08', 15, false, 'Notbremse')
) as v(pcode, kcode, age, paid, note)
join public.players p      on p.club_id = c.id and p.code = v.pcode
join public.fine_catalog k on k.club_id = c.id and k.code = v.kcode
where c.slug = 'fcfn';

-- 4) Zwei Spieler ins Lazarett
update public.players set status='verletzt',    status_since=current_date-6, status_until=current_date+14, status_note='Muskelfaserriss',      status_updated_at=now() where code='p05';
update public.players set status='angeschlagen', status_since=current_date-2, status_until=null,            status_note='leichte Knieprobleme', status_updated_at=now() where code='p07';

-- 5) Mahnzuschlaege gleich berechnen (sonst macht es der naechtliche Cron)
select public.apply_fine_surcharges();


-- ============================ == CLEANUP == =================================
-- Zum Entfernen ALLER Testdaten: die folgenden 4 Zeilen markieren + Run.
/*
delete from public.rsvps  where event_id in (select id from public.events where code like 'sd%');
delete from public.fines  where note like '[TEST]%';
delete from public.events where code like 'sd%';
update public.players set status='fit', status_since=null, status_until=null, status_note=null, status_updated_at=now() where code in ('p05','p07');
*/
