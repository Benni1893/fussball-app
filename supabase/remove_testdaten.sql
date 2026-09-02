-- ============================================================================
-- FC Fasanerie-Nord - TESTDATEN VOLLSTAENDIG ENTFERNEN
--
-- Loescht AUSSCHLIESSLICH Testdaten: is_testdaten = true, plus alles mit
-- Bezug zu Testspielern / Test-Spiel (faengt evtl. Auto-Strafen mit ab).
-- Echte Daten werden NIE angefasst. Idempotent (beliebig oft ausfuehrbar).
--
-- Ablauf: ERST SCHRITT 1 ausfuehren (nur Zaehlung, loescht nichts) und
--         pruefen. Dann bewusst SCHRITT 2 markieren und ausfuehren.
--         Danach SCHRITT 3 (Verify) - ueberall muss 0 stehen.
-- ============================================================================

-- Flag-Spalten sicherstellen (falls dieses Skript ohne vorheriges Seed laeuft)
alter table public.players       add column if not exists is_testdaten boolean not null default false;
alter table public.fines         add column if not exists is_testdaten boolean not null default false;
alter table public.rsvps         add column if not exists is_testdaten boolean not null default false;
alter table public.player_status add column if not exists is_testdaten boolean not null default false;
alter table public.events        add column if not exists is_testdaten boolean not null default false;


-- ############################################################################
-- SCHRITT 1 - ZAEHLUNG (loescht NICHTS). Zuerst ausfuehren und pruefen.
-- ############################################################################
select 'lineups (Test-Spiel-Bezug)' as tabelle,
       (select count(*) from public.lineups
         where event_id in (select id from public.events where is_testdaten)) as betroffen
union all
select 'rsvps',
       (select count(*) from public.rsvps
         where is_testdaten
            or event_id  in (select id from public.events  where is_testdaten)
            or player_id in (select id from public.players where is_testdaten))
union all
select 'player_status',
       (select count(*) from public.player_status
         where is_testdaten
            or player_id in (select id from public.players where is_testdaten))
union all
select 'fines',
       (select count(*) from public.fines
         where is_testdaten
            or player_id in (select id from public.players where is_testdaten)
            or event_id  in (select id from public.events  where is_testdaten))
union all
select 'events',  (select count(*) from public.events  where is_testdaten)
union all
select 'players', (select count(*) from public.players where is_testdaten);


-- ############################################################################
-- SCHRITT 2 - LOESCHEN.  ERST nach Pruefung von Schritt 1 markieren & ausfuehren.
-- Reihenfolge Kinder -> Eltern (keine Waisen, keine FK-Verletzung).
-- ############################################################################
delete from public.lineups
 where event_id in (select id from public.events where is_testdaten);

delete from public.rsvps
 where is_testdaten
    or event_id  in (select id from public.events  where is_testdaten)
    or player_id in (select id from public.players where is_testdaten);

delete from public.player_status
 where is_testdaten
    or player_id in (select id from public.players where is_testdaten);

delete from public.fines
 where is_testdaten
    or player_id in (select id from public.players where is_testdaten)
    or event_id  in (select id from public.events  where is_testdaten);

delete from public.events  where is_testdaten;

delete from public.players where is_testdaten;


-- ############################################################################
-- SCHRITT 3 - VERIFY. Ueberall muss 0 stehen.
-- ############################################################################
select 'players'       as tabelle, count(*) as rest from public.players       where is_testdaten
union all select 'fines',         count(*) from public.fines         where is_testdaten
union all select 'rsvps',         count(*) from public.rsvps         where is_testdaten
union all select 'player_status', count(*) from public.player_status where is_testdaten
union all select 'events',        count(*) from public.events        where is_testdaten
union all select 'lineups (Test-Spiel-Bezug)',
       (select count(*) from public.lineups
         where event_id in (select id from public.events where is_testdaten));
