-- ============================================================================
-- FC Fasanerie-Nord - Migration 0004: Rollen- & Rechtesystem (Mehrfach-Rollen)
--
-- - Neue Tabelle user_roles (ein Nutzer kann mehrere Rollen haben).
-- - Hilfsfunktionen has_role / my_roles / is_admin (SECURITY DEFINER).
-- - RLS-Policies pro Tabelle gemaess Rechte-Matrix.
-- - Bestehende Rollen aus profiles.role werden uebernommen.
--
-- Rechte-Matrix (Vereinigung bei Mehrfach-Rollen):
--   players      : lesen alle Eingeloggten; kein Schreiben
--   events       : lesen alle; schreiben coach/admin
--   rsvps        : lesen alle; schreiben eigene ODER coach/admin
--   fine_catalog : lesen alle; schreiben treasurer/admin
--   fines        : lesen alle; schreiben (bezahlt/verhaengen) treasurer/admin
--   user_roles   : lesen eigene (Admin alle); schreiben nur admin
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Tabelle user_roles
-- ----------------------------------------------------------------------------
create table if not exists user_roles (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null check (role in ('player','coach','treasurer','admin')),
  club_id    uuid references clubs(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, role, club_id)
);
create index if not exists idx_user_roles_user on user_roles(user_id);

-- ----------------------------------------------------------------------------
-- 2) Hilfsfunktionen (SECURITY DEFINER -> umgehen RLS, keine Rekursion)
-- ----------------------------------------------------------------------------
create or replace function public.has_role(p_role text)
returns boolean language sql security definer set search_path = public stable
as $$ select exists(select 1 from public.user_roles where user_id = auth.uid() and role = p_role); $$;

create or replace function public.my_roles()
returns text[] language sql security definer set search_path = public stable
as $$ select coalesce(array_agg(role), '{}') from public.user_roles where user_id = auth.uid(); $$;

create or replace function public.is_admin()
returns boolean language sql security definer set search_path = public stable
as $$ select public.has_role('admin'); $$;

grant execute on function public.has_role(text) to authenticated;
grant execute on function public.my_roles()      to authenticated;
grant execute on function public.is_admin()      to authenticated;

-- ----------------------------------------------------------------------------
-- 3) Bestandsdaten uebernehmen + Basisrolle 'player' fuer alle Profile
-- ----------------------------------------------------------------------------
-- vorhandene Einzelrolle aus profiles uebernehmen (z. B. den gesetzten Admin)
insert into user_roles (user_id, role, club_id)
select p.id, p.role, coalesce(p.club_id, (select id from clubs where slug='fcfn' limit 1))
from profiles p
where p.role is not null
on conflict (user_id, role, club_id) do nothing;

-- jeder bestehende Nutzer bekommt mindestens die Basisrolle 'player'
insert into user_roles (user_id, role, club_id)
select p.id, 'player', coalesce(p.club_id, (select id from clubs where slug='fcfn' limit 1))
from profiles p
on conflict (user_id, role, club_id) do nothing;

-- ----------------------------------------------------------------------------
-- 4) Trigger: neue Nutzer bekommen Profil + Basisrolle 'player'
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
declare v_club uuid;
begin
  select id into v_club from public.clubs where slug = 'fcfn' limit 1;
  insert into public.profiles (id, email, club_id)
  values (new.id, new.email, v_club)
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role, club_id)
  values (new.id, 'player', v_club)
  on conflict (user_id, role, club_id) do nothing;
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 5) RLS + Rechte auf user_roles
-- ----------------------------------------------------------------------------
alter table user_roles enable row level security;
grant select, insert, update, delete on user_roles to authenticated;

drop policy if exists user_roles_read on user_roles;
create policy user_roles_read on user_roles for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists user_roles_ins on user_roles;
create policy user_roles_ins on user_roles for insert to authenticated
  with check (public.is_admin());

drop policy if exists user_roles_upd on user_roles;
create policy user_roles_upd on user_roles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists user_roles_del on user_roles;
create policy user_roles_del on user_roles for delete to authenticated
  using (public.is_admin());

-- ----------------------------------------------------------------------------
-- 6) events: schreiben nur coach/admin
-- ----------------------------------------------------------------------------
grant insert, update, delete on events to authenticated;
drop policy if exists events_ins on events;
create policy events_ins on events for insert to authenticated
  with check (public.has_role('coach') or public.has_role('admin'));
drop policy if exists events_upd on events;
create policy events_upd on events for update to authenticated
  using (public.has_role('coach') or public.has_role('admin'))
  with check (public.has_role('coach') or public.has_role('admin'));
drop policy if exists events_del on events;
create policy events_del on events for delete to authenticated
  using (public.has_role('coach') or public.has_role('admin'));

-- ----------------------------------------------------------------------------
-- 7) fine_catalog: schreiben nur treasurer/admin
-- ----------------------------------------------------------------------------
grant insert, update, delete on fine_catalog to authenticated;
drop policy if exists catalog_ins on fine_catalog;
create policy catalog_ins on fine_catalog for insert to authenticated
  with check (public.has_role('treasurer') or public.has_role('admin'));
drop policy if exists catalog_upd on fine_catalog;
create policy catalog_upd on fine_catalog for update to authenticated
  using (public.has_role('treasurer') or public.has_role('admin'))
  with check (public.has_role('treasurer') or public.has_role('admin'));
drop policy if exists catalog_del on fine_catalog;
create policy catalog_del on fine_catalog for delete to authenticated
  using (public.has_role('treasurer') or public.has_role('admin'));

-- ----------------------------------------------------------------------------
-- 8) fines: lesen alle (bleibt); schreiben nur treasurer/admin
-- ----------------------------------------------------------------------------
grant insert, update, delete on fines to authenticated;
drop policy if exists fines_upd on fines;
create policy fines_upd on fines for update to authenticated
  using (public.has_role('treasurer') or public.has_role('admin'))
  with check (public.has_role('treasurer') or public.has_role('admin'));
drop policy if exists fines_ins on fines;
create policy fines_ins on fines for insert to authenticated
  with check (public.has_role('treasurer') or public.has_role('admin'));
drop policy if exists fines_del on fines;
create policy fines_del on fines for delete to authenticated
  using (public.has_role('treasurer') or public.has_role('admin'));

-- ----------------------------------------------------------------------------
-- 9) rsvps: schreiben eigene ODER coach/admin
-- ----------------------------------------------------------------------------
drop policy if exists rsvps_ins on rsvps;
create policy rsvps_ins on rsvps for insert to authenticated
  with check (player_id = public.my_player_id() or public.has_role('coach') or public.has_role('admin'));
drop policy if exists rsvps_upd on rsvps;
create policy rsvps_upd on rsvps for update to authenticated
  using      (player_id = public.my_player_id() or public.has_role('coach') or public.has_role('admin'))
  with check (player_id = public.my_player_id() or public.has_role('coach') or public.has_role('admin'));
drop policy if exists rsvps_del on rsvps;
create policy rsvps_del on rsvps for delete to authenticated
  using      (player_id = public.my_player_id() or public.has_role('coach') or public.has_role('admin'));

-- Fertig. players/events/fine_catalog/fines/rsvps bleiben fuer alle
-- Eingeloggten LESBAR (Lese-Policies aus 0003); geschrieben wird rollenbasiert.
