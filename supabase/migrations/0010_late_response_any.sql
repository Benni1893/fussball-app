-- ============================================================================
-- FC Fasanerie-Nord - Migration 0010: Verspaetete RUECKMELDUNG (zu ODER ab)
--
-- Neue, einheitliche Regel:
--   * Rueckmeldung (Zusage ODER Absage) VOR Meldeschluss  -> frei
--   * Rueckmeldung (Zusage ODER Absage) NACH Meldeschluss -> 8 EUR (k05)
--   * gar keine Rueckmeldung bis Anpfiff                  -> 25 EUR Spiel (k04)
--                                                            / 15 EUR Training (k03)
-- Ersetzt die Logik aus 0008/0009 (dort galt 8 EUR nur fuer spaete Absage).
-- Idempotent ueber Eindeutigkeit (event_id, player_id).
-- ============================================================================

-- 1) Cron zum Anpfiff: zu/ab gleich behandelt (rechtzeitig vs. verspaetet) ---
create or replace function public.apply_event_fines()
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_ev       record;
  v_deadline timestamptz;
  v_inserted integer;
  v_count    integer := 0;
begin
  for v_ev in
    select * from public.events
     where type in ('spiel','training')
       and auto_fine = true
       and starts_at is not null
       and starts_at <= now()
       and auto_fined_at is null
  loop
    v_deadline := v_ev.starts_at
                  - (case when v_ev.type = 'spiel' then interval '24 hours' else interval '3 hours' end);

    insert into public.fines (club_id, player_id, catalog_id, date, paid, note, event_id, auto, created_at)
    select v_ev.club_id, p.id, k.id, v_ev.date, false,
           'Automatisch: ' || reason.txt || ' zu ' || v_ev.title,
           v_ev.id, true, now()
    from public.players p
    left join public.rsvps r on r.event_id = v_ev.id and r.player_id = p.id
    cross join lateral (
      select
        case
          when r.status is null then case when v_ev.type = 'spiel' then 'k04' else 'k03' end  -- keine Rueckmeldung
          when r.updated_at <= v_deadline then null                                            -- rechtzeitig (zu/ab)
          else 'k05'                                                                            -- verspaetet (zu/ab)
        end as kcode,
        case when r.status is null then 'keine Rückmeldung' else 'verspätete Rückmeldung' end as txt
    ) reason
    join public.fine_catalog k on k.club_id = v_ev.club_id and k.code = reason.kcode
    where p.club_id = v_ev.club_id
      and reason.kcode is not null
    on conflict (event_id, player_id) do nothing;

    get diagnostics v_inserted = row_count;
    v_count := v_count + v_inserted;

    update public.events set auto_fined_at = now() where id = v_ev.id;
  end loop;

  return v_count;
end;
$$;

-- 2) Sofort-Trigger: jede Rueckmeldung nach Meldeschluss -> 8 EUR -----------
create or replace function public.rsvp_late_cancel_fine()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  e          record;
  v_deadline timestamptz;
  v_cat      uuid;
  v_eid      uuid;
  v_pid      uuid;
begin
  if tg_op = 'DELETE' then
    v_eid := old.event_id; v_pid := old.player_id;
  else
    v_eid := new.event_id; v_pid := new.player_id;
  end if;

  select * into e from public.events where id = v_eid;
  if e.id is null or e.type not in ('spiel','training')
     or e.auto_fine = false or e.starts_at is null then
    return coalesce(new, old);
  end if;

  v_deadline := e.starts_at
                - (case when e.type = 'spiel' then interval '24 hours' else interval '3 hours' end);

  select id into v_cat from public.fine_catalog where club_id = e.club_id and code = 'k05';
  if v_cat is null then
    return coalesce(new, old);
  end if;

  if tg_op <> 'DELETE' and now() > v_deadline and now() < e.starts_at then
    -- Verspaetete Rueckmeldung (Zusage ODER Absage) -> 8 EUR sofort
    insert into public.fines (club_id, player_id, catalog_id, date, paid, note, event_id, auto, created_at)
    values (e.club_id, v_pid, v_cat, e.date, false,
            'Automatisch: verspätete Rückmeldung zu ' || e.title, v_eid, true, now())
    on conflict (event_id, player_id) do nothing;
  elsif tg_op = 'DELETE' or now() <= v_deadline then
    -- Rechtzeitige Rueckmeldung ODER zurueckgezogen -> offene Auto-Strafe entfernen
    delete from public.fines
     where event_id = v_eid and player_id = v_pid
       and auto = true and paid = false and catalog_id = v_cat;
  end if;
  -- now >= starts_at: nichts tun (Endstand macht der Cron).

  return coalesce(new, old);
end;
$$;
