-- ============================================================================
-- FC Fasanerie-Nord - Migration 0025: Spieler setzt eigenen Fitnessstatus
--
-- set_player_status erlaubt jetzt zusaetzlich, dass ein Spieler SEINEN EIGENEN
-- Status setzt (p_player_id = my_player_id()). coach/admin duerfen weiter fuer
-- alle setzen. Gelesen wird ueber die RLS von player_status (eigene ODER coach/admin).
-- Direkte Schreib-Policies bleiben bewusst aus – alles laeuft ueber diese Funktion.
-- ============================================================================

create or replace function public.set_player_status(p_player_id uuid, p_status text, p_note text default null, p_until date default null)
returns void
language plpgsql security definer set search_path = public
as $$
declare cur text;
begin
  if not (public.has_role('coach') or public.has_role('admin') or p_player_id = public.my_player_id()) then
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
