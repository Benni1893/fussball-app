-- ============================================================================
-- FC Fasanerie-Nord – Migration 0030: Statusmodell für Strafen
--
-- Führt das Statusmodell offen | gemeldet | bestätigt | storniert ein, dazu
-- Vorgangs-ID (batch_id), Zahlart, Ablehnungsgrund, eine Audit-Tabelle und die
-- RPCs, über die künftig ALLE Statuswechsel laufen (serverseitig per Rolle/
-- Übergang erzwungen). Diese Migration verschärft die fines-Schreib-RLS bewusst
-- NICHT – die alte App schreibt weiter direkt auf fines, ein Sync-Trigger hält
-- status <-> paid/self_reported in beide Richtungen konsistent. Die RLS-
-- Verriegelung (nur noch via RPC) folgt separat NACH dem UI-Deploy.
--
-- Idempotent: mehrfaches Ausführen bricht nichts.
-- ============================================================================

-- 1) Neue Spalten auf fines
alter table public.fines add column if not exists status         text;
alter table public.fines add column if not exists batch_id       uuid;
alter table public.fines add column if not exists payment_method text;
alter table public.fines add column if not exists reject_reason  text;

-- 2) Backfill: jede bestehende Strafe bekommt GENAU EINEN Status (nur NULLs).
update public.fines set status = case
    when paid and self_reported then 'gemeldet'
    when paid                   then 'bestätigt'
    else 'offen'
  end
  where status is null;

alter table public.fines alter column status set default 'offen';
alter table public.fines alter column status set not null;

alter table public.fines drop constraint if exists fines_status_chk;
alter table public.fines add  constraint fines_status_chk
  check (status in ('offen','gemeldet','bestätigt','storniert'));

-- 3) Audit-Tabelle
create table if not exists public.fine_status_log (
  id          uuid primary key default gen_random_uuid(),
  fine_id     uuid not null references public.fines(id) on delete cascade,
  from_status text,
  to_status   text not null,
  method      text,
  reason      text,
  changed_by  uuid,
  changed_at  timestamptz not null default now()
);
create index if not exists idx_fine_status_log_fine on public.fine_status_log(fine_id);

alter table public.fine_status_log enable row level security;
drop policy if exists fsl_read on public.fine_status_log;
create policy fsl_read on public.fine_status_log for select to authenticated
  using (public.has_role('treasurer') or public.has_role('admin'));
grant select on public.fine_status_log to authenticated;

-- 4) Sync-Trigger (status <-> paid/self_reported) + Audit-Trigger
create or replace function public.fines_status_sync() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'INSERT' then
    if NEW.status is null then
      NEW.status := case when NEW.paid and NEW.self_reported then 'gemeldet'
                         when NEW.paid then 'bestätigt' else 'offen' end;
    else
      NEW.paid          := (NEW.status = 'bestätigt');
      NEW.self_reported := (NEW.status = 'gemeldet');
    end if;
  elsif TG_OP = 'UPDATE' then
    if NEW.status is distinct from OLD.status then
      NEW.paid          := (NEW.status = 'bestätigt');
      NEW.self_reported := (NEW.status = 'gemeldet');
    elsif (NEW.paid is distinct from OLD.paid)
       or (NEW.self_reported is distinct from OLD.self_reported) then
      NEW.status := case when NEW.paid and NEW.self_reported then 'gemeldet'
                         when NEW.paid then 'bestätigt' else 'offen' end;
    end if;
  end if;
  return NEW;
end $$;
drop trigger if exists trg_fines_status_sync on public.fines;
create trigger trg_fines_status_sync before insert or update on public.fines
  for each row execute function public.fines_status_sync();

create or replace function public.fines_status_audit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'INSERT' then
    insert into public.fine_status_log(fine_id, from_status, to_status, method, reason, changed_by)
      values (NEW.id, null, NEW.status, NEW.payment_method, NEW.reject_reason, auth.uid());
  elsif NEW.status is distinct from OLD.status then
    insert into public.fine_status_log(fine_id, from_status, to_status, method, reason, changed_by)
      values (NEW.id, OLD.status, NEW.status, NEW.payment_method, NEW.reject_reason, auth.uid());
  end if;
  return NEW;
end $$;
drop trigger if exists trg_fines_status_audit on public.fines;
create trigger trg_fines_status_audit after insert or update on public.fines
  for each row execute function public.fines_status_audit();

-- 5) RPCs (SECURITY DEFINER, Rollen- + Übergangsprüfung). Die neue UI nutzt nur diese.

-- Spieler meldet SEINE offenen Strafen -> 'gemeldet' (Verhaltensänderung ggü. 0005).
create or replace function public.report_my_payment() returns integer
language plpgsql security definer set search_path = public as $$
declare v_player uuid; v_count integer;
begin
  select player_id into v_player from public.profiles where id = auth.uid();
  if v_player is null then
    raise exception 'Dein Konto ist noch keinem Spieler zugeordnet.';
  end if;
  update public.fines set status = 'gemeldet'
    where player_id = v_player and status = 'offen';
  get diagnostics v_count = row_count;
  return v_count;
end $$;
grant execute on function public.report_my_payment() to authenticated;

-- Mehrfach-Anlage in EINER Transaktion, gemeinsame batch_id.
create or replace function public.create_fines_batch(p_rows jsonb, p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_batch uuid := gen_random_uuid(); r jsonb;
begin
  if not (public.has_role('treasurer') or public.has_role('admin')) then
    raise exception 'Nur Kassenwart/Admin darf Strafen anlegen.';
  end if;
  if p_rows is null or jsonb_array_length(p_rows) = 0 then
    raise exception 'Keine Strafen uebergeben.';
  end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    insert into public.fines
      (club_id, player_id, catalog_id, date, offense, base_amount, surcharge,
       auto, paid, status, batch_id, note)
    values (
      (select club_id from public.players where id = (r->>'player_id')::uuid),
      (r->>'player_id')::uuid,
      nullif(r->>'catalog_id','')::uuid,
      coalesce((r->>'date')::date, current_date),
      r->>'offense',
      (r->>'base_amount')::numeric,
      0, false, false, 'offen', v_batch,
      coalesce(nullif(r->>'note',''), p_note)
    );
  end loop;
  return v_batch;
end $$;
grant execute on function public.create_fines_batch(jsonb, text) to authenticated;

create or replace function public.confirm_fines(p_ids uuid[], p_method text default null)
returns integer language plpgsql security definer set search_path = public as $$
declare v_n integer;
begin
  if not (public.has_role('treasurer') or public.has_role('admin')) then
    raise exception 'Nur Kassenwart/Admin.';
  end if;
  update public.fines
    set status = 'bestätigt', payment_method = coalesce(p_method, payment_method),
        paid_at = now(), paid_by = auth.uid(), reject_reason = null
    where id = any(p_ids) and status in ('offen','gemeldet');
  get diagnostics v_n = row_count;
  return v_n;
end $$;
grant execute on function public.confirm_fines(uuid[], text) to authenticated;

create or replace function public.mark_fines_paid(p_ids uuid[], p_method text)
returns integer language plpgsql security definer set search_path = public as $$
declare v_n integer;
begin
  if not (public.has_role('treasurer') or public.has_role('admin')) then
    raise exception 'Nur Kassenwart/Admin.';
  end if;
  if coalesce(btrim(p_method),'') = '' then
    raise exception 'Zahlart erforderlich.';
  end if;
  update public.fines
    set status = 'bestätigt', payment_method = p_method,
        paid_at = now(), paid_by = auth.uid(), reject_reason = null
    where id = any(p_ids) and status in ('offen','gemeldet');
  get diagnostics v_n = row_count;
  return v_n;
end $$;
grant execute on function public.mark_fines_paid(uuid[], text) to authenticated;

create or replace function public.reject_fine(p_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.has_role('treasurer') or public.has_role('admin')) then
    raise exception 'Nur Kassenwart/Admin.';
  end if;
  if coalesce(btrim(p_reason),'') = '' then
    raise exception 'Ablehnungsgrund erforderlich.';
  end if;
  update public.fines
    set status = 'offen', reject_reason = p_reason, payment_method = null, paid_at = null
    where id = p_id and status = 'gemeldet';
  if not found then raise exception 'Strafe ist nicht im Status gemeldet.'; end if;
end $$;
grant execute on function public.reject_fine(uuid, text) to authenticated;

create or replace function public.cancel_batch(p_batch uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare v_n integer;
begin
  if not (public.has_role('treasurer') or public.has_role('admin')) then
    raise exception 'Nur Kassenwart/Admin.';
  end if;
  update public.fines set status = 'storniert'
    where batch_id = p_batch and status <> 'storniert';
  get diagnostics v_n = row_count;
  return v_n;
end $$;
grant execute on function public.cancel_batch(uuid) to authenticated;

create or replace function public.cancel_fine(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.has_role('treasurer') or public.has_role('admin')) then
    raise exception 'Nur Kassenwart/Admin.';
  end if;
  update public.fines set status = 'storniert' where id = p_id and status <> 'storniert';
  if not found then raise exception 'Strafe nicht gefunden oder bereits storniert.'; end if;
end $$;
grant execute on function public.cancel_fine(uuid) to authenticated;
