-- ============================================================================
-- FC Fasanerie-Nord - Migration 0044: BFV-Sync sagt keine gespielten Spiele
--                                     mehr ab
--
-- Befund (auto-mitteilungen/PHASE0.md, Teilpaket "BFV-Sync"): der BFV-Feed
-- enthaelt nur kuenftige Spiele und kein STATUS-Feld. sync_bfv_matches setzte
-- jeden BFV-Termin, dessen UID im Feed fehlt, auf "abgesagt" - auch jedes
-- gespielte Spiel am Morgen danach. Folge: alle 8 vergangenen BFV-Spiele
-- (09.08. bis 04.10.2026) stehen auf "abgesagt"; der Kalender-Feed schreibt
-- dafuer STATUS:CANCELLED, und die Abo-Kalender aller Mitglieder zeigen
-- gespielte Spiele als abgesagt.
--
-- Diese Migration:
--   1. sync_bfv_matches sagt nur noch KUENFTIGE Termine ab, die im Feed fehlen.
--      Vergangene bleiben, wie sie sind. Sonst nichts geaendert.
--   2. Datenkorrektur: die vergangenen BFV-Termine mit Status "abgesagt"
--      zurueck auf "geplant" (genau 8, inkl. 09.08.). events_bump_ical_seq
--      erhoeht dabei ical_seq, damit die Abo-Kalender den Stand nachziehen.
--
-- Rueckwirkend entsteht nichts (geprueft in PHASE0.md, abgesichert in der
-- Gegenprobe): keine Strafe (auto_fine = false bei allen 8; apply_event_fines
-- wertet den Status ohnehin nicht aus), keine Nachricht (kein Erzeuger auf
-- events), Rueckmeldungen unveraendert.
--
-- Die Teamerkennung fuer "FC Fasanerie-Nord II" steckt im Parser
-- (api/sync-bfv.js), nicht hier; der naechste Sync korrigiert Heim/Gegner der
-- drei Freundschaftsspiele ueber den bestehenden Update-Pfad.
--
-- Rechte: sync_bfv_matches bleibt bei service_role (create or replace
-- behaelt die Rechte; Gegenprobe).
--
-- Setzt 0043 voraus (notification_sammler wird in der Gegenprobe gezaehlt).
--
-- EINGESPIELT am 05.10.2026 (17:52 UTC) ohne Gegenprobe, diese nachgeholt mit
-- supabase/checks/0044_bfv_pruef.sql. Ablauf: Versuch 1 scheiterte an
-- "uuid = uuid[]" (any((select ...)) wird als Unterabfrage gelesen), Versuch 2
-- ebenfalls ohne Rest. Versuch 3 schrieb Funktion und Datenkorrektur fest
-- (gleiche Transaktion), danach fand die Gegenprobe ihre temporaere
-- Hilfstabelle nicht mehr (42P01). Der SQL-Editor fuehrt begin/commit nicht
-- verlaesslich als eine Transaktion aus (conventions.md).
--
-- Diese Datei ist deshalb umgebaut: alles in EINEM do-Block (Funktion per
-- execute), ohne Hilfstabelle; damit eine einzige, atomare Anweisung. Wirkung
-- wie eingespielt. NICHT erneut ausfuehren: die Gegenprobe erwartet 8 zu
-- korrigierende Spiele und bricht auf dem heutigen Stand (0) ab.
-- ============================================================================

begin;

do $migration$
declare
  -- Ausgangszaehler fuer die Gegenprobe
  v_strafen    bigint;
  v_outbox     bigint;
  v_sammler    bigint;
  v_rsvps      bigint;
  v_korrektur  uuid[];
  v_kuenftig   text[];
  v_anzahl     integer;
  -- Gegenprobe
  v_fehl       text[] := '{}';
  v_n          integer;
  v_feed       jsonb;
  v_ziel       uuid;
begin
  -- --------------------------------------------------------------------------
  -- 0) Ausgangszaehler
  -- --------------------------------------------------------------------------
  select count(*) into v_strafen from public.fines;
  select count(*) into v_outbox  from public.notification_outbox;
  select count(*) into v_sammler from public.notification_sammler;
  select count(*) into v_rsvps   from public.rsvps;
  v_korrektur := array(select id from public.events
                        where quelle = 'bfv' and status = 'abgesagt' and starts_at <= now()
                        order by date);
  v_kuenftig  := array(select id || ':' || status from public.events
                        where quelle = 'bfv' and starts_at > now() order by id);
  v_anzahl    := coalesce(array_length(v_korrektur, 1), 0);

  -- --------------------------------------------------------------------------
  -- 1) sync_bfv_matches: nur kuenftige Termine absagen
  -- --------------------------------------------------------------------------
  -- Inhalt wie live (0027 und folgende), geaendert ist nur die letzte update-
  -- Anweisung (Bedingung "noch nicht begonnen").
  execute $ddl$
  create or replace function public.sync_bfv_matches(p_matches jsonb)
  returns jsonb
  language plpgsql security definer set search_path = public
  as $function$
  declare
    v_club      uuid;
    v_new       int := 0;
    v_upd       int := 0;
    v_cancelled int := 0;
    m           jsonb;
    v_uid       text;
    v_exists    boolean;
    v_uids      text[] := '{}';
    v_title     text;
    v_loc       text;
  begin
    select id into v_club from public.clubs where slug = 'fcfn';
    if v_club is null then
      raise exception 'Club fcfn nicht gefunden';
    end if;

    for m in select value from jsonb_array_elements(coalesce(p_matches, '[]'::jsonb)) t(value)
    loop
      v_uid := m->>'bfv_uid';
      if v_uid is null or v_uid = '' then
        continue;
      end if;
      v_uids := array_append(v_uids, v_uid);

      v_title := case when (m->>'heim')::boolean is true then 'Heimspiel'
                      when (m->>'heim')::boolean is false then 'Auswärtsspiel'
                      else 'Spiel' end;
      v_loc := nullif(btrim(
                 coalesce(m->>'spielstaette','') ||
                 case when coalesce(m->>'adresse','') <> '' then ', ' || (m->>'adresse') else '' end
               ), '');

      select exists(select 1 from public.events where club_id = v_club and bfv_uid = v_uid)
        into v_exists;

      if v_exists then
        update public.events e set
          type       = 'spiel',
          title      = v_title,
          opponent   = m->>'gegner',
          home       = (m->>'heim')::boolean,
          wettbewerb = m->>'wettbewerb',
          liga       = m->>'liga',
          status     = 'geplant',
          quelle     = 'bfv',
          date = case when (e.manuell_bearbeitet->>'start')::boolean is true then e.date else (m->>'date')::date end,
          time = case when (e.manuell_bearbeitet->>'start')::boolean is true then e.time else m->>'time' end,
          location     = case when (e.manuell_bearbeitet->>'ort')::boolean is true then e.location     else v_loc end,
          location_raw = case when (e.manuell_bearbeitet->>'ort')::boolean is true then e.location_raw else m->>'location_raw' end,
          spielstaette = case when (e.manuell_bearbeitet->>'ort')::boolean is true then e.spielstaette else m->>'spielstaette' end,
          adresse      = case when (e.manuell_bearbeitet->>'ort')::boolean is true then e.adresse      else m->>'adresse' end,
          bfv_neu = (
            (case when (e.manuell_bearbeitet->>'start')::boolean is true
                    and ((e.bfv_original->>'date') is distinct from (m->>'date')
                         or (e.bfv_original->>'time') is distinct from (m->>'time'))
                  then jsonb_build_object('date', m->>'date', 'time', m->>'time')
                  else '{}'::jsonb end)
            ||
            (case when (e.manuell_bearbeitet->>'ort')::boolean is true
                    and ((e.bfv_original->>'location_raw') is distinct from (m->>'location_raw'))
                  then jsonb_build_object('location_raw', m->>'location_raw',
                                          'spielstaette', m->>'spielstaette',
                                          'adresse', m->>'adresse')
                  else '{}'::jsonb end)
          )
        where e.club_id = v_club and e.bfv_uid = v_uid;
        v_upd := v_upd + 1;
      else
        insert into public.events (
          club_id, code, type, title, opponent, home, date, time, location, note,
          bfv_uid, wettbewerb, liga, spielstaette, adresse, location_raw, status, quelle, auto_fine
        ) values (
          v_club, 'bfv:' || v_uid, 'spiel', v_title,
          m->>'gegner', (m->>'heim')::boolean, (m->>'date')::date, m->>'time', v_loc, null,
          v_uid, m->>'wettbewerb', m->>'liga', m->>'spielstaette', m->>'adresse',
          nullif(m->>'location_raw', ''),
          'geplant', 'bfv', false
        );
        v_new := v_new + 1;
      end if;
    end loop;

    -- Der BFV-Feed enthaelt nur kuenftige Spiele und kennt kein STATUS-Feld. Ein
    -- fehlendes kuenftiges Spiel ist die einzige Absage, die er ausdruecken kann;
    -- ein fehlendes vergangenes Spiel ist schlicht ausgetragen.
    if array_length(v_uids, 1) is not null then
      update public.events
         set status = 'abgesagt'
       where club_id = v_club and quelle = 'bfv' and status <> 'abgesagt'
         and not (bfv_uid = any(v_uids))
         and coalesce(starts_at,
                      (date + time '23:59') at time zone 'Europe/Berlin') > now();
      get diagnostics v_cancelled = row_count;
    end if;

    return jsonb_build_object('updated', v_upd, 'new', v_new, 'cancelled', v_cancelled);
  end;
  $function$
  $ddl$;

  -- --------------------------------------------------------------------------
  -- 2) Datenkorrektur: gespielte Spiele wieder "geplant"
  -- --------------------------------------------------------------------------
  update public.events
     set status = 'geplant'
   where id = any(v_korrektur);

  -- --------------------------------------------------------------------------
  -- Gegenprobe
  -- --------------------------------------------------------------------------
  -- Genau die 8 Spiele, alle BFV, alle vergangen, jetzt "geplant".
  if v_anzahl <> 8 then
    v_fehl := v_fehl || ('erwartet 8 Korrekturen, gefunden ' || v_anzahl);
  end if;
  select count(*) into v_n from public.events
   where id = any(v_korrektur) and status = 'geplant' and quelle = 'bfv' and starts_at <= now();
  if v_n <> v_anzahl then
    v_fehl := v_fehl || ('nicht alle korrigierten Spiele stehen auf geplant: ' || v_n);
  end if;
  if exists (select 1 from public.events where quelle = 'bfv' and status = 'abgesagt' and starts_at <= now()) then
    v_fehl := v_fehl || 'noch vergangene BFV-Spiele auf abgesagt'::text;
  end if;

  -- Kein kuenftiger Termin veraendert.
  if array(select id || ':' || status from public.events where quelle = 'bfv' and starts_at > now() order by id)
     is distinct from v_kuenftig then
    v_fehl := v_fehl || 'künftige BFV-Termine verändert'::text;
  end if;

  -- Nichts rueckwirkend ausgeloest.
  if (select count(*) from public.fines) <> v_strafen then v_fehl := v_fehl || 'Anzahl Strafen verändert'::text; end if;
  if (select count(*) from public.notification_outbox) <> v_outbox then v_fehl := v_fehl || 'Outbox-Zeilen entstanden'::text; end if;
  if (select count(*) from public.notification_sammler) <> v_sammler then v_fehl := v_fehl || 'Sammler-Zeilen entstanden'::text; end if;
  if (select count(*) from public.rsvps) <> v_rsvps then v_fehl := v_fehl || 'Rückmeldungen verändert'::text; end if;
  if exists (select 1 from public.events where id = any(v_korrektur) and auto_fine) then
    v_fehl := v_fehl || 'ein korrigiertes Spiel hat auto_fine'::text;
  end if;

  -- apply_event_fines laeuft (zurueckgerollt): keine Strafe fuer die 8 Spiele.
  begin
    perform public.apply_event_fines();
    select count(*) into v_n from public.fines where event_id = any(v_korrektur);
    if v_n <> 0 then v_fehl := v_fehl || ('apply_event_fines erzeugt Strafen für korrigierte Spiele: ' || v_n); end if;
    raise exception using errcode = 'P0044', message = 'zurückrollen';
  exception when sqlstate 'P0044' then null;
  end;

  -- Neue Regel mit echtem Aufruf (zurueckgerollt): Feed mit allen kuenftigen
  -- Spielen ausser einem. Erwartung: genau dieses eine wird abgesagt, kein
  -- vergangenes.
  begin
    select id into v_ziel from public.events
     where quelle = 'bfv' and status = 'geplant' and starts_at > now() order by starts_at limit 1;
    select jsonb_agg(jsonb_build_object(
             'bfv_uid', e.bfv_uid, 'gegner', e.opponent, 'heim', e.home,
             'wettbewerb', e.wettbewerb, 'liga', e.liga, 'date', e.date::text, 'time', e.time,
             'spielstaette', e.spielstaette, 'adresse', e.adresse, 'location_raw', e.location_raw))
      into v_feed
      from public.events e
     where e.quelle = 'bfv' and e.starts_at > now() and e.id <> v_ziel;
    perform public.sync_bfv_matches(v_feed);
    if (select status from public.events where id = v_ziel) <> 'abgesagt' then
      v_fehl := v_fehl || 'künftiges, fehlendes Spiel wird nicht abgesagt'::text;
    end if;
    if exists (select 1 from public.events where quelle = 'bfv' and status = 'abgesagt' and starts_at <= now()) then
      v_fehl := v_fehl || 'Sync sagt weiterhin vergangene Spiele ab'::text;
    end if;
    raise exception using errcode = 'P0044', message = 'zurückrollen';
  exception when sqlstate 'P0044' then null;
  end;

  -- Rechte unveraendert: nur service_role.
  if has_function_privilege('anon', 'public.sync_bfv_matches(jsonb)'::regprocedure, 'execute')
     or has_function_privilege('authenticated', 'public.sync_bfv_matches(jsonb)'::regprocedure, 'execute')
     or not has_function_privilege('service_role', 'public.sync_bfv_matches(jsonb)'::regprocedure, 'execute') then
    v_fehl := v_fehl || 'Rechte von sync_bfv_matches verändert'::text;
  end if;

  if array_length(v_fehl, 1) > 0 then
    raise exception 'Gegenprobe 0044 fehlgeschlagen: %', v_fehl;
  end if;
  raise notice 'Gegenprobe 0044 bestanden: % Spiele korrigiert, Strafen/Outbox/Sammler/Rückmeldungen unverändert.', v_anzahl;
end
$migration$;

commit;

-- ============================================================================
-- RUECKBAU (nicht automatisch ausgefuehrt)
-- Die Datenkorrektur laesst sich nicht sinnvoll zuruecknehmen (die Spiele
-- waren nie abgesagt). Fuer die Funktion: Fassung aus 0027 erneut ausfuehren.
-- ============================================================================
