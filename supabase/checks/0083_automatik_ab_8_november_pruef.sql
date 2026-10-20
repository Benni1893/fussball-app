-- ============================================================================
-- Prüfung zu Migration 0083 (Automatik ab 8.11.2026, Meldeschluss Spiel
-- Freitag 12:00). Ändert nichts: Untertransaktion, immer zurückgerollt.
-- ============================================================================

drop table if exists pg_temp.pruef_0083;
create temp table pruef_0083 (nr serial, fall text, erwartet text, ergebnis text, urteil text);

do $pruef$
declare
  v_club uuid; v_admin uuid; v_erg jsonb := '[]'; v_r record;
  fz text[][] := array[
    -- typ, datum, zeit, override, erwartete Automatik, erwarteter Meldeschluss (Berlin)
    array['spiel',    '2026-11-07', '14:00', '',   'false', '2026-11-06 12:00'],
    array['spiel',    '2026-11-08', '11:00', '',   'true',  '2026-11-06 12:00'],
    array['spiel',    '2026-11-14', '15:00', '',   'true',  '2026-11-13 12:00'],
    array['spiel',    '2026-11-11', '19:30', '',   'true',  '2026-11-10 19:30'],
    array['spiel',    '2026-11-15', '14:00', '48', 'true',  '2026-11-13 14:00'],
    array['training', '2026-11-05', '19:30', '',   'false', '2026-11-05 16:30'],
    array['training', '2026-11-10', '19:30', '',   'true',  '2026-11-10 16:30'],
    array['sonstiges','2026-11-12', '19:30', '',   'false', 'leer'],
    array['spiel',    '2027-03-28', '15:00', '',   'true',  '2027-03-26 12:00']   -- Sommerzeit
  ];
  i int;
begin
  select id into v_club from public.clubs limit 1;
  select user_id into v_admin from public.user_roles where role = 'admin' limit 1;
  for i in 1 .. array_length(fz, 1) loop
    begin
      perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
      set local role authenticated;
      insert into public.events (club_id, type, title, date, time, status, quelle, auto_fine, deadline_override_hours)
        values (v_club, fz[i][1], 'Prüf 0083', fz[i][2]::date, fz[i][3], 'geplant', 'manuell', false, nullif(fz[i][4], '')::int)
        returning auto_fine, deadline_at into v_r;
      raise exception using errcode = 'P0001', message = v_r.auto_fine::text || ' | ' ||
        coalesce(to_char(v_r.deadline_at at time zone 'Europe/Berlin', 'YYYY-MM-DD HH24:MI'), 'leer');
    exception when others then
      v_erg := v_erg || jsonb_build_array(jsonb_build_array(
        'neu: ' || fz[i][1] || ' ' || fz[i][2] || ' ' || fz[i][3] || coalesce(' (eigener Wert ' || nullif(fz[i][4], '') || ' h)', ''),
        fz[i][5] || ' | ' || fz[i][6], sqlerrm));
    end;
  end loop;

  v_erg := v_erg || jsonb_build_array(jsonb_build_array('Bestand: Automatik vor 8.11. an', '0',
    (select count(*)::text from public.events where type in ('spiel','training') and starts_at > now() and date < '2026-11-08' and auto_fine)));
  v_erg := v_erg || jsonb_build_array(jsonb_build_array('Bestand: Automatik ab 8.11. aus', '0',
    (select count(*)::text from public.events where type in ('spiel','training') and starts_at > now() and date >= '2026-11-08' and not auto_fine)));

  insert into pruef_0083 (fall, erwartet, ergebnis, urteil)
    select e->>0, e->>1, e->>2, case when e->>1 = e->>2 then 'PASS' else 'FAIL' end
    from jsonb_array_elements(v_erg) e;
end $pruef$;

select nr, fall, erwartet, ergebnis, urteil from pruef_0083
union all
select null, 'Summe', null, count(*) filter (where urteil = 'PASS') || ' von ' || count(*), case when bool_and(urteil = 'PASS') then 'PASS' else 'FAIL' end from pruef_0083
order by nr nulls last;
