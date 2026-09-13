-- ============================================================================
-- FC Fasanerie-Nord - Migration 0012: Aufstellungen (Lineups)
--
-- Pro Spiel mehrere benannte Varianten, eine davon aktiv. Zusaetzlich Vorlagen
-- (event_id NULL) zum Anwenden auf andere Spiele. Lesen UND Schreiben nur
-- Trainer/Admin (RLS). Die aktive Aufstellung speist die Kader-Info-Nachricht.
-- ============================================================================

create table if not exists public.lineups (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references public.clubs(id) on delete cascade,
  event_id    uuid references public.events(id) on delete cascade,   -- NULL = Vorlage
  name        text not null,
  formation   text not null,
  slots       jsonb not null default '{}'::jsonb,   -- { slotKey: playerId }
  bank        jsonb not null default '[]'::jsonb,   -- [playerId, ...]
  is_active   boolean not null default false,
  is_template boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_lineups_event on public.lineups(event_id);
-- Hoechstens EINE aktive Variante je Spiel:
create unique index if not exists uq_lineups_active_event
  on public.lineups(event_id) where is_active and event_id is not null;

alter table public.lineups enable row level security;
grant select, insert, update, delete on public.lineups to authenticated;

drop policy if exists lineups_read on public.lineups;
create policy lineups_read on public.lineups for select to authenticated
  using (public.has_role('coach') or public.has_role('admin'));
drop policy if exists lineups_ins on public.lineups;
create policy lineups_ins on public.lineups for insert to authenticated
  with check (public.has_role('coach') or public.has_role('admin'));
drop policy if exists lineups_upd on public.lineups;
create policy lineups_upd on public.lineups for update to authenticated
  using (public.has_role('coach') or public.has_role('admin'))
  with check (public.has_role('coach') or public.has_role('admin'));
drop policy if exists lineups_del on public.lineups;
create policy lineups_del on public.lineups for delete to authenticated
  using (public.has_role('coach') or public.has_role('admin'));

-- Eine Variante atomar als aktiv setzen (alle anderen des Spiels inaktiv).
create or replace function public.set_lineup_active(p_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_event uuid;
begin
  if not (public.has_role('coach') or public.has_role('admin')) then
    raise exception 'Nur Trainer/Admin.';
  end if;
  select event_id into v_event from public.lineups where id = p_id;
  if v_event is null then
    raise exception 'Vorlagen koennen nicht aktiv gesetzt werden.';
  end if;
  update public.lineups set is_active = false, updated_at = now()
   where event_id = v_event and id <> p_id and is_active;
  update public.lineups set is_active = true, updated_at = now()
   where id = p_id;
end;
$$;

grant execute on function public.set_lineup_active(uuid) to authenticated;
