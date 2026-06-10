-- ============================================================================
-- FC Fasanerie-Nord - Migration 0005: Bezahlen per Vertrauensprinzip
--
-- - fines bekommt: self_reported (selbst gemeldet), paid_at (Zeitstempel),
--   paid_by (wer gemeldet hat).
-- - Funktion report_my_payment(): ein Spieler meldet SEINE offenen Strafen
--   selbst als bezahlt. Server-seitig erzwungen -> nur eigene, nur offene.
-- - Zuruecksetzen (bezahlt -> offen) bleibt per RLS (0004) nur treasurer/admin.
-- ============================================================================

alter table fines add column if not exists self_reported boolean not null default false;
alter table fines add column if not exists paid_at       timestamptz;
alter table fines add column if not exists paid_by        uuid references auth.users(id) on delete set null;

-- Spieler meldet die eigene Zahlung. Gibt die Anzahl betroffener Strafen zurueck.
create or replace function public.report_my_payment()
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  v_player uuid;
  v_count  integer;
begin
  select player_id into v_player from public.profiles where id = auth.uid();
  if v_player is null then
    raise exception 'Dein Konto ist noch keinem Spieler zugeordnet.';
  end if;

  update public.fines
     set paid = true,
         self_reported = true,
         paid_at = now(),
         paid_by = auth.uid()
   where player_id = v_player
     and paid = false;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.report_my_payment() to authenticated;
