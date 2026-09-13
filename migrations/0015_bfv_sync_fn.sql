-- ============================================================================
-- FC Fasanerie-Nord - Migration 0015: BFV-Sync Reconciliation-Funktion
--
-- Nimmt die serverseitig geparsten Spiele (jsonb-Array) und spiegelt sie in
-- events:
--   * Upsert ueber bfv_uid  -> interne events.id bleibt stabil (RSVPs reissen
--     nicht ab), keine Duplikate (idempotent).
--   * BFV-Spiele, die NICHT mehr im Feed sind -> status='abgesagt' (nicht loeschen).
--   * Manuelle Spiele (quelle='manuell') werden NIE angefasst.
-- Rueckgabe: { updated, new, cancelled }.
--
-- Aufruf erfolgt aus der Vercel-Function mit dem service_role-Key.
-- ============================================================================

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
      continue; -- ohne UID kein stabiler Upsert -> ueberspringen
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
      update public.events set
        type         = 'spiel',
        title        = v_title,
        opponent     = m->>'gegner',
        home         = (m->>'heim')::boolean,
        date         = (m->>'date')::date,
        time         = m->>'time',
        location     = v_loc,
        wettbewerb   = m->>'wettbewerb',
        liga         = m->>'liga',
        spielstaette = m->>'spielstaette',
        adresse      = m->>'adresse',
        status       = 'geplant',
        quelle       = 'bfv'
      where club_id = v_club and bfv_uid = v_uid;
      v_upd := v_upd + 1;
    else
      insert into public.events (
        club_id, code, type, title, opponent, home, date, time, location, note,
        bfv_uid, wettbewerb, liga, spielstaette, adresse, status, quelle, auto_fine
      ) values (
        v_club, 'bfv:' || v_uid, 'spiel', v_title,
        m->>'gegner', (m->>'heim')::boolean, (m->>'date')::date, m->>'time', v_loc, null,
        v_uid, m->>'wettbewerb', m->>'liga', m->>'spielstaette', m->>'adresse',
        'geplant', 'bfv', false   -- Auto-Strafen fuer Import-Spiele bewusst AUS (kann spaeter aktiviert werden)
      );
      v_new := v_new + 1;
    end if;
  end loop;

  -- Nur wenn wir tatsaechlich Spiele erhalten haben: fehlende BFV-Spiele absagen.
  -- (Schutz: bei leerem/fehlerhaftem Feed nicht versehentlich alles absagen.)
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
