-- ============================================================================
-- FC Fasanerie-Nord - Migration 0002: Authentifizierung & Profile
--
-- ADDITIV: legt Profile + Trigger + Hilfsfunktionen an. Aendert die bestehenden
-- Zugriffsregeln (0001) NOCH NICHT -> die App laeuft unveraendert weiter.
-- Die Verriegelung (nur eingeloggt lesen, rollenbasiert schreiben) kommt spaeter
-- in Migration 0003, sobald die Login-Oberflaeche steht.
--
-- Ausfuehren: Supabase Dashboard -> SQL Editor -> einfuegen -> "Run".
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Profil-Tabelle (1 Profil pro Auth-Benutzer)
-- ----------------------------------------------------------------------------
create table if not exists profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  club_id    uuid references clubs(id) on delete set null,
  email      text,
  role       text not null default 'player'
             check (role in ('admin','coach','treasurer','player')),
  player_id  uuid references players(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Ein Spieler kann nur EINEM Konto zugeordnet sein.
create unique index if not exists uniq_profiles_player
  on profiles(player_id) where player_id is not null;

-- ----------------------------------------------------------------------------
-- 2) Auto-Profil beim Registrieren (Trigger auf auth.users)
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role, club_id)
  values (
    new.id,
    new.email,
    'player',
    (select id from public.clubs where slug = 'fcfn' limit 1)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 3) Hilfsfunktionen (Rolle des aktuell eingeloggten Nutzers)
-- ----------------------------------------------------------------------------
create or replace function public.my_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- „Welcher Spieler bin ich?" - setzt sicher den eigenen player_id-Eintrag.
create or replace function public.set_my_player(p_player_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_player_id is not null and exists (
    select 1 from public.profiles
    where player_id = p_player_id and id <> auth.uid()
  ) then
    raise exception 'Dieser Spieler ist bereits einem anderen Konto zugeordnet.';
  end if;

  update public.profiles set player_id = p_player_id where id = auth.uid();
end;
$$;

-- ----------------------------------------------------------------------------
-- 4) RLS auf profiles
-- ----------------------------------------------------------------------------
alter table profiles enable row level security;

grant usage on schema public to authenticated;
grant select, update on profiles to authenticated;
grant execute on function public.my_role()             to authenticated;
grant execute on function public.is_admin()            to authenticated;
grant execute on function public.set_my_player(uuid)   to authenticated;

-- Eigenes Profil lesen; Admins lesen alle.
drop policy if exists profiles_read on profiles;
create policy profiles_read on profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());

-- Direkte Updates nur fuer Admins (z. B. Rolle vergeben). Normale Nutzer
-- aendern ihren Spieler ausschliesslich ueber set_my_player() -> keine
-- Moeglichkeit, sich selbst zum Admin zu machen.
drop policy if exists profiles_update_admin on profiles;
create policy profiles_update_admin on profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Fertig. Bestehende Tabellen/Regeln aus 0001 bleiben unveraendert.
