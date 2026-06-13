-- ============================================================================
-- FC Fasanerie-Nord - Migration 0009: Verspaetete Absage SOFORT bestrafen
--
-- Bisher: Termin-Strafen entstehen erst zum Anpfiff (Cron, Migration 0008).
-- Neu: Sagt ein Spieler NACH dem Meldeschluss ab, entsteht die 8-EUR-Strafe
--      (k05) sofort - server-seitig per Trigger auf rsvps. Bestaetigt er statt-
--      dessen wieder zu (oder zieht die Absage zurueck), wird die noch offene
--      Auto-Absagestrafe wieder entfernt. So spiegelt das Strafen-Konto immer
--      den aktuellen Stand; der Cron zum Anpfiff bleibt der finale Abgleich
--      (keine Rueckmeldung -> 25 EUR Spiel / 15 EUR Training).
--
-- Idempotent ueber die Eindeutigkeit (event_id, player_id) aus 0008.
-- ============================================================================

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

  if tg_op <> 'DELETE' and new.status = 'ab'
     and now() > v_deadline and now() < e.starts_at then
    -- Verspaetete Absage -> 8 EUR sofort (idempotent)
    insert into public.fines (club_id, player_id, catalog_id, date, paid, note, event_id, auto, created_at)
    values (e.club_id, v_pid, v_cat, e.date, false,
            'Automatisch: verspätete Absage zu ' || e.title, v_eid, true, now())
    on conflict (event_id, player_id) do nothing;
  else
    -- Zusage ODER zurueckgezogene Rueckmeldung -> noch offene Auto-Absagestrafe weg
    delete from public.fines
     where event_id = v_eid and player_id = v_pid
       and auto = true and paid = false and catalog_id = v_cat;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_rsvp_late_cancel on public.rsvps;
create trigger trg_rsvp_late_cancel
  after insert or update or delete on public.rsvps
  for each row execute function public.rsvp_late_cancel_fine();
