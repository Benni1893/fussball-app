-- ============================================================================
-- FC Fasanerie-Nord - Migration 0011: Fitness-/Verletztenstatus der Spieler
--
-- Jeder Spieler: status (fit | angeschlagen | verletzt), optional Notiz +
-- voraussichtliches Rueckkehrdatum, plus "seit wann".
-- Setzen NUR Trainer/Admin - serverseitig per Funktion erzwungen. Die Tabelle
-- players bleibt sonst schreibgeschuetzt (kein Aendern von Name/Nummer ueber
-- das Statusrecht).
-- ============================================================================

alter table public.players add column if not exists status            text not null default 'fit'
  check (status in ('fit','angeschlagen','verletzt'));
alter table public.players add column if not exists status_note       text;
alter table public.players add column if not exists status_until      date;        -- vor. Rueckkehr
alter table public.players add column if not exists status_since      date;        -- seit wann
alter table public.players add column if not exists status_updated_at timestamptz;

-- Status setzen (nur Trainer/Admin). status_since wird beim Wechsel fit->nicht-fit
-- gesetzt und beim Zuruecksetzen auf fit (mit Notiz/Datum) geleert.
create or replace function public.set_player_status(
  p_player_id uuid,
  p_status    text,
  p_note      text default null,
  p_until     date default null
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  cur text;
begin
  if not (public.has_role('coach') or public.has_role('admin')) then
    raise exception 'Nur Trainer/Admin dürfen den Status setzen.';
  end if;
  if p_status not in ('fit','angeschlagen','verletzt') then
    raise exception 'Ungültiger Status: %', p_status;
  end if;

  select status into cur from public.players where id = p_player_id;
  if cur is null then
    raise exception 'Spieler nicht gefunden.';
  end if;

  update public.players
     set status            = p_status,
         status_note       = case when p_status = 'fit' then null
                                  else nullif(btrim(coalesce(p_note,'')), '') end,
         status_until      = case when p_status = 'fit' then null else p_until end,
         status_since      = case when p_status = 'fit' then null
                                  when cur = 'fit' or status_since is null then current_date
                                  else status_since end,
         status_updated_at = now()
   where id = p_player_id;
end;
$$;

grant execute on function public.set_player_status(uuid, text, text, date) to authenticated;
