-- ============================================================================
-- FC Fasanerie-Nord - Migration 0026: NULL-Falle in set_player_status schliessen
--
-- Vorher: if not (coach or admin or p_player_id = my_player_id()) then raise;
-- Bei my_player_id() = NULL (nicht verknuepfter Nutzer) ergibt der Vergleich
-- NULL, die ganze Bedingung NULL, und "if not NULL" loest KEINE Exception aus
-- -> der Guard fiel OFFEN und ein beliebiger eingeloggter Nutzer konnte fremde
-- Status setzen. Fix: my_player_id() explizit auf NOT NULL pruefen.
-- ============================================================================

create or replace function public.set_player_status(p_player_id uuid, p_status text, p_note text default null, p_until date default null)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  cur text;
  v_me uuid := public.my_player_id();
begin
  if not (public.has_role('coach') or public.has_role('admin')
          or (v_me is not null and p_player_id = v_me)) then
    raise exception 'Nur Trainer/Admin oder der eigene Status.';
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
