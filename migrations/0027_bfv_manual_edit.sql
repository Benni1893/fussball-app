-- ============================================================================
-- FC Fasanerie-Nord - Migration 0027: BFV-Spiele manuell bearbeitbar
--
-- Trainer/Kassenwart/Admin duerfen BFV-Spiele bearbeiten (Datum/Uhrzeit/Ort/
-- Notiz). Der taegliche BFV-Sync darf manuell geaenderte Felder NICHT
-- ueberschreiben. Ausserdem wird erkannt, wenn der BFV die Zeit/Adresse SPAETER
-- selbst aendert (Drift), ohne automatisch zu ueberschreiben.
--
-- Logische Felder (Gruppen):
--   start = date + time
--   ort   = location/location_raw/spielstaette/adresse
--   (Notiz/Ende sind reine Zusatzfelder -> der Sync schreibt sie ohnehin nie.)
--
-- manuell_bearbeitet {start:true, ort:true} = welche Gruppe ueberschrieben ist
-- bfv_original       = BFV-Wert zum Zeitpunkt der Aenderung (eingefroren)
-- bfv_neu            = aktueller BFV-Wert, WENN er vom Original abweicht (Drift)
-- updated_at         = fuer LAST-MODIFIED im iCal-Feed
-- ============================================================================

alter table public.events
  add column if not exists manuell_bearbeitet jsonb not null default '{}'::jsonb,
  add column if not exists bfv_original       jsonb not null default '{}'::jsonb,
  add column if not exists bfv_neu            jsonb not null default '{}'::jsonb,
  add column if not exists updated_at         timestamptz not null default now();

-- SEQUENCE-Zaehler + updated_at bei inhaltlicher Aenderung setzen.
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
    new.ical_seq   := coalesce(old.ical_seq, 0) + 1;
    new.updated_at := now();
  end if;
  return new;
end;
$$;

-- Sync: manuell ueberschriebene Gruppen schuetzen, Drift in bfv_neu festhalten.
create or replace function public.sync_bfv_matches(p_matches jsonb)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
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
        -- START (Datum/Uhrzeit): nur uebernehmen, wenn NICHT manuell geaendert
        date = case when (e.manuell_bearbeitet->>'start')::boolean is true then e.date else (m->>'date')::date end,
        time = case when (e.manuell_bearbeitet->>'start')::boolean is true then e.time else m->>'time' end,
        -- ORT: nur uebernehmen, wenn NICHT manuell geaendert
        location     = case when (e.manuell_bearbeitet->>'ort')::boolean is true then e.location     else v_loc end,
        location_raw = case when (e.manuell_bearbeitet->>'ort')::boolean is true then e.location_raw else m->>'location_raw' end,
        spielstaette = case when (e.manuell_bearbeitet->>'ort')::boolean is true then e.spielstaette else m->>'spielstaette' end,
        adresse      = case when (e.manuell_bearbeitet->>'ort')::boolean is true then e.adresse      else m->>'adresse' end,
        -- bfv_neu jedes Mal neu bilden: nur bei manuell UND Abweichung vom Original
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

  if array_length(v_uids, 1) is not null then
    update public.events
       set status = 'abgesagt'
     where club_id = v_club and quelle = 'bfv' and status <> 'abgesagt'
       and not (bfv_uid = any(v_uids));
    get diagnostics v_cancelled = row_count;
  end if;

  return jsonb_build_object('updated', v_upd, 'new', v_new, 'cancelled', v_cancelled);
end;
$$;

grant execute on function public.sync_bfv_matches(jsonb) to service_role;
