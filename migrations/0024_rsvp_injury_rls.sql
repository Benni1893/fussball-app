-- ============================================================================
-- FC Fasanerie-Nord - Migration 0024: RSVP- und Verletzungs-Sichtbarkeit (RLS)
--
-- Kern der Aenderung liegt in der Datenbank, nicht im Frontend.
--
-- 1) RSVP: Spieler sehen NUR ihre eigene Zu-/Absage. coach/admin sehen alle.
--    (Schreiben war bereits korrekt: eigene ODER coach/admin.)
-- 2) Verletzungen: aus players ausgelagert in eine eigene Tabelle player_status,
--    weil RLS zeilen- und nicht spaltenbasiert ist. Lesen: coach/admin ODER
--    eigener Eintrag. Schreiben nur ueber set_player_status (SECURITY DEFINER).
--    Danach die Status-Spalten aus players entfernen (kein API-Leseweg mehr).
-- ============================================================================

-- 1) RSVP: SELECT einschraenken (vorher read_rsvps USING (true)) --------------
drop policy if exists read_rsvps on public.rsvps;
create policy rsvps_sel on public.rsvps
  for select to authenticated
  using (player_id = public.my_player_id() or public.has_role('coach') or public.has_role('admin'));

-- 2) Verletzungen in eigene Tabelle -----------------------------------------
create table if not exists public.player_status (
  player_id    uuid primary key references public.players(id) on delete cascade,
  status       text not null default 'fit' check (status in ('fit','angeschlagen','verletzt')),
  status_note  text,
  status_until date,
  status_since date,
  updated_at   timestamptz not null default now()
);

alter table public.player_status enable row level security;

-- Lesen: coach/admin (alle) ODER der eigene Eintrag.
create policy player_status_sel on public.player_status
  for select to authenticated
  using (public.has_role('coach') or public.has_role('admin') or player_id = public.my_player_id());
-- KEINE direkten Schreib-Policies: Schreiben laeuft ausschliesslich ueber
-- set_player_status() (SECURITY DEFINER, umgeht RLS, prueft coach/admin selbst).

grant select on public.player_status to authenticated;

-- Bestehende Status aus players uebernehmen.
insert into public.player_status (player_id, status, status_note, status_until, status_since, updated_at)
select id, coalesce(status,'fit'), status_note, status_until, status_since, coalesce(status_updated_at, now())
from public.players
on conflict (player_id) do nothing;

-- set_player_status: schreibt jetzt in player_status (Upsert), Guard bleibt.
create or replace function public.set_player_status(p_player_id uuid, p_status text, p_note text default null, p_until date default null)
returns void
language plpgsql security definer set search_path = public
as $$
declare cur text;
begin
  if not (public.has_role('coach') or public.has_role('admin')) then
    raise exception 'Nur Trainer/Admin dürfen den Status setzen.';
  end if;
  if p_status not in ('fit','angeschlagen','verletzt') then
    raise exception 'Ungültiger Status: %', p_status;
  end if;
  if not exists (select 1 from public.players where id = p_player_id) then
    raise exception 'Spieler nicht gefunden.';
  end if;

  select status into cur from public.player_status where player_id = p_player_id;

  insert into public.player_status (player_id, status, status_note, status_until, status_since, updated_at)
  values (
    p_player_id, p_status,
    case when p_status = 'fit' then null else nullif(btrim(coalesce(p_note,'')), '') end,
    case when p_status = 'fit' then null else p_until end,
    case when p_status = 'fit' then null else current_date end,
    now()
  )
  on conflict (player_id) do update set
    status       = p_status,
    status_note  = case when p_status = 'fit' then null else nullif(btrim(coalesce(p_note,'')), '') end,
    status_until = case when p_status = 'fit' then null else p_until end,
    status_since = case when p_status = 'fit' then null
                        when cur is null or cur = 'fit' or public.player_status.status_since is null then current_date
                        else public.player_status.status_since end,
    updated_at   = now();
end;
$$;

-- Status-Spalten aus players entfernen (kein Leseweg fuer Spieler mehr).
alter table public.players
  drop column if exists status,
  drop column if exists status_note,
  drop column if exists status_until,
  drop column if exists status_since,
  drop column if exists status_updated_at;
