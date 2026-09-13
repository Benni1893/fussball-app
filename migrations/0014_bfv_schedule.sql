-- ============================================================================
-- FC Fasanerie-Nord - Migration 0014: BFV-Spielplan (Schema + Einstellungen + RLS)
--
-- Erweitert events um BFV-Felder (vorhandene opponent/home/starts_at/location
-- werden weiterverwendet), ergaenzt clubs.ical_url und passt die Schreibrechte
-- an (events + iCal-URL: coach/treasurer/admin). Die Sync-Funktion folgt in
-- Schritt 3.
-- ============================================================================

-- 1) events erweitern -------------------------------------------------------
alter table public.events add column if not exists bfv_uid      text;
alter table public.events add column if not exists wettbewerb   text;   -- z.B. Meisterschaften / Freundschaftsspiele
alter table public.events add column if not exists liga         text;
alter table public.events add column if not exists spielstaette text;
alter table public.events add column if not exists adresse      text;
alter table public.events add column if not exists status       text not null default 'geplant';
alter table public.events add column if not exists quelle       text not null default 'manuell';

-- Wertebereiche absichern
alter table public.events drop constraint if exists events_status_chk;
alter table public.events add  constraint events_status_chk check (status in ('geplant','abgesagt'));
alter table public.events drop constraint if exists events_quelle_chk;
alter table public.events add  constraint events_quelle_chk check (quelle in ('manuell','bfv'));

-- bfv_uid eindeutig (NULLs sind in Postgres verschieden -> manuelle Spiele stoeren nicht)
create unique index if not exists uq_events_bfv_uid on public.events(bfv_uid);

-- 2) iCal-URL in den Vereinseinstellungen -----------------------------------
alter table public.clubs add column if not exists ical_url text;

-- 3) RLS: events schreiben coach/treasurer/admin (bisher nur coach/admin) ----
drop policy if exists events_ins on public.events;
create policy events_ins on public.events for insert to authenticated
  with check (public.has_role('coach') or public.has_role('treasurer') or public.has_role('admin'));
drop policy if exists events_upd on public.events;
create policy events_upd on public.events for update to authenticated
  using      (public.has_role('coach') or public.has_role('treasurer') or public.has_role('admin'))
  with check (public.has_role('coach') or public.has_role('treasurer') or public.has_role('admin'));
drop policy if exists events_del on public.events;
create policy events_del on public.events for delete to authenticated
  using (public.has_role('coach') or public.has_role('treasurer') or public.has_role('admin'));

-- 4) iCal-URL setzen: nur coach/treasurer/admin -----------------------------
--    Ueber eine Funktion, damit keine breite UPDATE-Policy auf clubs noetig ist
--    (Name/Season etc. bleiben unveraenderbar).
create or replace function public.set_ical_url(p_url text)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not (public.has_role('coach') or public.has_role('treasurer') or public.has_role('admin')) then
    raise exception 'Nur Trainer/Kassenwart/Admin duerfen die iCal-URL setzen.';
  end if;
  update public.clubs
     set ical_url = nullif(btrim(coalesce(p_url, '')), '')
   where slug = 'fcfn';
end;
$$;

grant execute on function public.set_ical_url(text) to authenticated;
