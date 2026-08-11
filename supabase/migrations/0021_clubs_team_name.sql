-- ============================================================================
-- FC Fasanerie-Nord - Migration 0021: clubs.team_name nachziehen
--
-- Die frühere Migration 0016 (Spalte team_name) war offenbar nie auf dieser
-- Datenbank angewendet worden - der iCal-Sync-PATCH auf team_name prueft sein
-- Ergebnis nicht und schlug daher still fehl. Folge: der Kalender-Feed brach
-- an der clubs-Abfrage (select team_name) mit HTTP 400 ab, und die Paarung
-- nutzte den Fallback-Teamnamen.
--
-- Spalte anlegen und mit dem bekannten Teamnamen befuellen; der naechste
-- BFV-Sync haelt sie danach automatisch aktuell (aus X-WR-CALNAME).
-- ============================================================================

alter table public.clubs add column if not exists team_name text;

update public.clubs set team_name = 'FC Fasanerie-Nord II'
where slug = 'fcfn' and (team_name is null or team_name = '');
