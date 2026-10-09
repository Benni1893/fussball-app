-- ============================================================================
-- FC Fasanerie-Nord - Migration 0060: Nachschliff C5 (fuer E3), Buchung
--                                     zuruecknehmen
--
-- Auftrag: Nachschliff Oktober, C5/E3, Antwort vom 09.10.2026 (Punkt 11).
--
-- Bisher setzte "Buchung rückgängig" im Kassen-Blatt fines direkt zurueck
-- (paid = false). Die Zahlart blieb stehen, und der Verlauf zeigte nicht,
-- welche Buchung zurueckgenommen wurde.
--
--   undo_fine_payment(p_id): nur Kassenwart oder Admin. Nur eine bestaetigte
--   Strafe; danach offen, payment_method, paid_at und paid_by leer. Der
--   Audit-Trigger (0030) schreibt den Schritt bestaetigt -> offen in
--   fine_status_log; die Funktion ergaenzt dort die vorherige Zahlart und
--   den Grund "Buchung rückgängig". Keine Mitteilung (notify_fines_ereignis
--   kennt bestaetigt -> offen nicht). Die Selbstmeldung (reported_method,
--   reported_note) bleibt als Geschichte stehen.
--
-- Nichts an bestehenden Daten: die Migration legt nur die Funktion an.
-- RECHTE: authenticated (Rollenpruefung in der Funktion). Aufbau: EIN do-Block.
-- ============================================================================

begin;

do $migration$
declare
  v_fehl text[] := '{}';
  v_admin uuid; v_frei uuid; v_club uuid; v_player uuid; v_fine uuid; v_t text; v_n integer; v_sammler integer;
begin
  execute $ddl$
  create or replace function public.undo_fine_payment(p_id uuid)
  returns void
  language plpgsql security definer set search_path = public
  as $$
  declare v_alt text;
  begin
    if not (public.has_role('treasurer') or public.has_role('admin')) then
      raise exception 'Nur Kassenwart/Admin.' using errcode = '42501';
    end if;
    select payment_method into v_alt from public.fines where id = p_id and status = 'bestätigt' for update;
    if not found then
      raise exception 'Strafe nicht gefunden oder nicht bezahlt.';
    end if;
    update public.fines
       set status = 'offen', payment_method = null, paid_at = null, paid_by = null
     where id = p_id;
    -- Den Schritt hat trg_fines_status_audit eben geschrieben (method = NEW,
    -- also leer); vorherige Zahlart und Grund ergaenzen.
    update public.fine_status_log
       set method = v_alt, reason = 'Buchung rückgängig'
     where id = (select id from public.fine_status_log
                  where fine_id = p_id and from_status = 'bestätigt' and to_status = 'offen' and changed_at = now()
                  order by changed_at desc limit 1);
  end;
  $$
  $ddl$;
  revoke execute on function public.undo_fine_payment(uuid) from public, anon;
  grant  execute on function public.undo_fine_payment(uuid) to authenticated;

  -- --------------------------------------------------------------------------
  -- Gegenprobe
  -- --------------------------------------------------------------------------
  if not has_function_privilege('authenticated', 'public.undo_fine_payment(uuid)', 'execute')
     or has_function_privilege('anon', 'public.undo_fine_payment(uuid)', 'execute') then
    v_fehl := v_fehl || 'Rechte'::text;
  end if;

  select ur.user_id into v_admin from public.user_roles ur where ur.role = 'admin' limit 1;
  select club_id into v_club from public.profiles where id = v_admin;
  select p.id into v_frei from public.profiles p
   where not exists (select 1 from public.user_roles ur where ur.user_id = p.id and ur.role in ('admin', 'treasurer')) limit 1;
  select id into v_player from public.players order by name limit 1;
  begin
    insert into public.fines (club_id, player_id, date, offense, base_amount, status, payment_method, paid_at, paid_by)
    values (v_club, v_player, current_date - 3, 'Gegenprobe 0060', 5, 'bestätigt', 'paypal', now(), v_admin)
    returning id into v_fine;
    select count(*) into v_sammler from public.notification_sammler;

    -- ohne Kassenrolle: verweigert
    if v_frei is not null then
      perform set_config('request.jwt.claims', json_build_object('sub', v_frei, 'role', 'authenticated')::text, true);
      begin
        perform public.undo_fine_payment(v_fine);
        v_fehl := v_fehl || 'ohne Rolle erlaubt'::text;
      exception when sqlstate '42501' then null;
      end;
    end if;

    perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
    perform public.undo_fine_payment(v_fine);
    select status || '/' || paid::text || '/' || coalesce(payment_method, '-') || '/' || coalesce(paid_at::text, '-') || '/' || coalesce(paid_by::text, '-')
      into v_t from public.fines where id = v_fine;
    if v_t is distinct from 'offen/false/-/-/-' then v_fehl := v_fehl || ('Strafe: ' || coalesce(v_t, '-')); end if;
    select count(*), max(coalesce(method, '-') || '/' || coalesce(reason, '-') || '/' || coalesce(changed_by::text, '-'))
      into v_n, v_t from public.fine_status_log where fine_id = v_fine and from_status = 'bestätigt' and to_status = 'offen';
    if v_n <> 1 or v_t is distinct from 'paypal/Buchung rückgängig/' || v_admin then
      v_fehl := v_fehl || ('Verlauf: ' || v_n || ' / ' || coalesce(v_t, '-'));
    end if;
    if (select count(*) from public.notification_sammler) <> v_sammler then
      v_fehl := v_fehl || 'Mitteilung ausgelöst'::text;
    end if;
    -- zweiter Aufruf: nicht mehr bezahlt
    begin
      perform public.undo_fine_payment(v_fine);
      v_fehl := v_fehl || 'zweimal möglich'::text;
    exception when others then
      if sqlerrm not like '%nicht bezahlt%' then v_fehl := v_fehl || ('zweimal: ' || sqlerrm); end if;
    end;
    perform set_config('request.jwt.claims', '', true);
    raise exception using errcode = 'P0060', message = 'zurückrollen';
  exception when sqlstate 'P0060' then null;
  end;

  if array_length(v_fehl, 1) > 0 then
    raise exception 'Gegenprobe 0060 fehlgeschlagen: %', v_fehl;
  end if;
  raise notice 'Gegenprobe 0060 bestanden.';
end
$migration$;

commit;

-- RUECKBAU (nicht automatisch):
--   drop function if exists public.undo_fine_payment(uuid);
