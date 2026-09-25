-- ============================================================================
-- FC Fasanerie-Nord - Migration 0031: Status "urlaub"
--
-- Bisher erlaubt: 'fit', 'angeschlagen', 'verletzt'. Geprueft wird das an zwei
-- Stellen, die hier beide 'urlaub' dazubekommen:
--   1. player_status.status  (Check-Constraint, angelegt in 0024)
--   2. set_player_status()   (Pruefung in der Funktion, zuletzt 0026)
--
-- NICHT angefasst: players.status. Die Spalte wurde in Migration 0024 zusammen
-- mit status_note, status_until, status_since und status_updated_at aus players
-- ENTFERNT ("kein Leseweg fuer Spieler mehr"); der Status lebt seitdem allein
-- in player_status. Ein Constraint darauf lief in einen 42703 (column "status"
-- does not exist). Der Block unten fasst players nur noch an, falls die Spalte
-- in einer Umgebung wider Erwarten doch existiert.
--
-- NICHT noetig: Spalten fuer "voraussichtlich bis" und Notiz gibt es bereits -
-- player_status.status_until (date) und player_status.status_note (text), beide
-- aus 0024.
--
-- RLS bleibt unveraendert: gelesen wird ueber player_status_sel (coach/admin
-- sehen alle, jeder sonst nur den eigenen Eintrag), geschrieben ausschliesslich
-- ueber set_player_status(); direkte Schreib-Policies gibt es weiterhin keine.
-- Die Rechtepruefung bleibt wortgleich zu 0026, inklusive der dort geschlossenen
-- NULL-Falle bei my_player_id().
--
-- Die Migration ist mehrfach ausfuehrbar.
-- ============================================================================

-- 1. player_status: Check-Constraint erweitern --------------------------------
--    Der Constraint wird ueber den Katalog gesucht statt ueber einen geratenen
--    Namen - so greift es auch, wenn er anders heisst.
do $$
declare
  c_name text;
begin
  select con.conname into c_name
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace ns on ns.oid = rel.relnamespace
   where ns.nspname = 'public'
     and rel.relname = 'player_status'
     and con.contype = 'c'
     and pg_get_constraintdef(con.oid) ilike '%status%angeschlagen%'
   limit 1;

  if c_name is not null then
    execute format('alter table public.player_status drop constraint %I', c_name);
  end if;

  alter table public.player_status
    add constraint player_status_status_check
    check (status in ('fit', 'angeschlagen', 'verletzt', 'urlaub'));
end
$$;

-- 2. players: nur anfassen, wenn die Spalte existiert --------------------------
--    In dieser Datenbank existiert sie seit 0024 nicht mehr; der Block ist fuer
--    Umgebungen da, in denen 0024 nicht gelaufen ist.
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'players' and column_name = 'status'
  ) then
    alter table public.players drop constraint if exists players_status_check;
    alter table public.players
      add constraint players_status_check
      check (status in ('fit', 'angeschlagen', 'verletzt', 'urlaub'));
  end if;
end
$$;

-- 3. set_player_status: 'urlaub' zulassen -------------------------------------
create or replace function public.set_player_status(
  p_player_id uuid,
  p_status    text,
  p_note      text default null,
  p_until     date default null
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  cur  text;
  v_me uuid := public.my_player_id();
begin
  -- Rechte wie in 0026: Trainer/Admin fuer alle, sonst nur der eigene Eintrag.
  -- v_me explizit auf NOT NULL pruefen, sonst faellt der Guard offen.
  if not (public.has_role('coach') or public.has_role('admin')
          or (v_me is not null and p_player_id = v_me)) then
    raise exception 'Nur Trainer/Admin oder der eigene Status.';
  end if;
  if p_status not in ('fit', 'angeschlagen', 'verletzt', 'urlaub') then
    raise exception 'Ungültiger Status: %', p_status;
  end if;
  if not exists (select 1 from public.players where id = p_player_id) then
    raise exception 'Spieler nicht gefunden.';
  end if;

  select status into cur from public.player_status where player_id = p_player_id;

  -- 'fit' loescht Notiz, Datum und "seit wann"; jeder andere Status behaelt sie.
  insert into public.player_status (player_id, status, status_note, status_until, status_since, updated_at)
  values (
    p_player_id, p_status,
    case when p_status = 'fit' then null else nullif(btrim(coalesce(p_note, '')), '') end,
    case when p_status = 'fit' then null else p_until end,
    case when p_status = 'fit' then null else current_date end,
    now()
  )
  on conflict (player_id) do update set
    status       = p_status,
    status_note  = case when p_status = 'fit' then null else nullif(btrim(coalesce(p_note, '')), '') end,
    status_until = case when p_status = 'fit' then null else p_until end,
    status_since = case when p_status = 'fit' then null
                        when cur is null or cur = 'fit' or public.player_status.status_since is null then current_date
                        else public.player_status.status_since end,
    updated_at   = now();
end;
$$;
