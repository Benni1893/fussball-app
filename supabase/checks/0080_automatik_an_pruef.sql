-- ============================================================================
-- Prüfung zu Migration 0080 (Strafen-Automatik an). Ändert nichts: jeder Fall
-- in einer Untertransaktion, die immer zurückgerollt wird.
-- ============================================================================

drop table if exists pg_temp.pruef_0080;
create temp table pruef_0080 (nr serial, fall text, erwartet text, ergebnis text, urteil text);

do $pruef$
declare
  v_club uuid; v_admin uuid; v_alt uuid; v_neu uuid; v_ev uuid; v_auto boolean; v_s text;
  v_erg jsonb := '[]'; v_lokal timestamp := (now() at time zone 'Europe/Berlin');
begin
  select id into v_club from public.clubs limit 1;
  select user_id into v_admin from public.user_roles where role = 'admin' limit 1;

  -- 1-3: neue Termine als Admin über die Schnittstelle, wie die App (auto_fine false)
  for v_s in select unnest(array['training:+3', 'spiel:+3', 'sonstiges:+3', 'training:-3']) loop
    begin
      perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
      set local role authenticated;
      insert into public.events (club_id, type, title, date, time, status, quelle, auto_fine)
        values (v_club, split_part(v_s, ':', 1), 'Prüf 0080', v_lokal::date + split_part(v_s, ':', 2)::int, '19:30', 'geplant', 'manuell', false)
        returning auto_fine into v_auto;
      raise exception using errcode = 'P0001', message = 'auto:' || v_auto;
    exception when others then
      v_erg := v_erg || jsonb_build_array(jsonb_build_array('neuer Termin ' || v_s || ' Tage',
        case when v_s in ('training:+3', 'spiel:+3') then 'auto:true' else 'auto:false' end, sqlerrm));
    end;
  end loop;

  -- 5-6: Anpfiff eines Trainings ohne Rückmeldungen. Alter Spieler bekommt k03
  -- mit dem Katalogbetrag, neuer Spieler (24-Stunden-Regel) nichts.
  begin
    select id into v_alt from public.players where ausgeschieden_am is null order by created_at limit 1;
    insert into public.players (club_id, code, name) values (v_club, 'pruef0080', 'Prüf Neu') returning id into v_neu;
    insert into public.events (club_id, type, title, date, time, status, quelle)
      values (v_club, 'training', 'Prüf 0080 Anpfiff', (v_lokal - interval '2 hours')::date,
              to_char(v_lokal - interval '2 hours', 'HH24:MI'), 'geplant', 'manuell')
      returning id into v_ev;
    update public.events set auto_fine = true where id = v_ev;
    delete from public.rsvps where event_id = v_ev;
    perform public.apply_event_fines();
    v_erg := v_erg || jsonb_build_array(jsonb_build_array('Anpfiff: alter Spieler',
      'k03 5.00', (select coalesce(string_agg(k.code || ' ' || f.base_amount, ','), 'keine') from public.fines f join public.fine_catalog k on k.id = f.catalog_id where f.event_id = v_ev and f.player_id = v_alt)));
    v_erg := v_erg || jsonb_build_array(jsonb_build_array('Anpfiff: neuer Spieler (24 h)',
      'keine', (select coalesce(string_agg(f.base_amount::text, ','), 'keine') from public.fines f where f.event_id = v_ev and f.player_id = v_neu)));
    raise exception using errcode = 'P0001', message = 'rollback';
  exception when raise_exception then
    if sqlerrm <> 'rollback' then v_erg := v_erg || jsonb_build_array(jsonb_build_array('Anpfiff', 'ohne Fehler', sqlerrm)); end if;
  end;

  -- 7: alle künftigen Trainings und Spiele mit Automatik
  v_erg := v_erg || jsonb_build_array(jsonb_build_array('künftige Trainings/Spiele ohne Automatik', '0',
    (select count(*)::text from public.events where type in ('spiel','training') and starts_at > now() and not auto_fine)));

  insert into pruef_0080 (fall, erwartet, ergebnis, urteil)
    select e->>0, e->>1, e->>2, case when e->>1 = e->>2 then 'PASS' else 'FAIL' end
    from jsonb_array_elements(v_erg) e;
end $pruef$;

select nr, fall, erwartet, ergebnis, urteil from pruef_0080
union all
select null, 'Summe', null, count(*) filter (where urteil = 'PASS') || ' von ' || count(*), case when bool_and(urteil = 'PASS') then 'PASS' else 'FAIL' end from pruef_0080
order by nr nulls last;
