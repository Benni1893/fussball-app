-- ============================================================================
-- Prüfung zu Migration 0079 (Automatik-Posten k03, k04, k05 nicht löschbar).
-- Ändert nichts: jeder Fall in einer Untertransaktion, die immer
-- zurückgerollt wird. Rollen über set local role plus request.jwt.claims.
-- ============================================================================

drop table if exists pg_temp.pruef_0079;
create temp table pruef_0079 (nr serial, fall text, erwartet text, ergebnis text, urteil text);

do $pruef$
declare
  v_admin uuid; v_n int; v_erg jsonb := '[]'; v_s text;
begin
  select ur.user_id into v_admin from public.user_roles ur where ur.role = 'admin' limit 1;

  -- 1-3: als Admin (authenticated) je Automatik-Posten löschen
  for v_s in select unnest(array['k03','k04','k05']) loop
    begin
      perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
      set local role authenticated;
      delete from public.fine_catalog where code = v_s;
      get diagnostics v_n = row_count;
      raise exception using errcode = 'P0001', message = 'geloescht:' || v_n;
    exception
      when insufficient_privilege then v_erg := v_erg || jsonb_build_array(jsonb_build_array(v_s || ' löschen als Admin', 'gesperrt', 'gesperrt'));
      when raise_exception then v_erg := v_erg || jsonb_build_array(jsonb_build_array(v_s || ' löschen als Admin', 'gesperrt', sqlerrm));
    end;
  end loop;

  -- 4: anderer Posten als Admin löschbar
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
    set local role authenticated;
    delete from public.fine_catalog where code = 'k27';
    get diagnostics v_n = row_count;
    raise exception using errcode = 'P0001', message = 'geloescht:' || v_n;
  exception when others then
    v_erg := v_erg || jsonb_build_array(jsonb_build_array('k27 löschen als Admin', 'geloescht:1', sqlerrm));
  end;

  -- 5: Name und Betrag von k05 als Admin änderbar
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
    set local role authenticated;
    update public.fine_catalog set offense = 'Test', amount = 7 where code = 'k05';
    get diagnostics v_n = row_count;
    raise exception using errcode = 'P0001', message = 'geaendert:' || v_n;
  exception when others then
    v_erg := v_erg || jsonb_build_array(jsonb_build_array('k05 ändern als Admin', 'geaendert:1', sqlerrm));
  end;

  -- 6: auch als Eigentümer (postgres) gesperrt
  begin
    delete from public.fine_catalog where code = 'k04';
    raise exception using errcode = 'P0001', message = 'geloescht';
  exception
    when insufficient_privilege then v_erg := v_erg || jsonb_build_array(jsonb_build_array('k04 löschen als postgres', 'gesperrt', 'gesperrt'));
    when raise_exception then v_erg := v_erg || jsonb_build_array(jsonb_build_array('k04 löschen als postgres', 'gesperrt', sqlerrm));
  end;

  insert into pruef_0079 (fall, erwartet, ergebnis, urteil)
    select e->>0, e->>1, e->>2, case when e->>1 = e->>2 then 'PASS' else 'FAIL' end
    from jsonb_array_elements(v_erg) e;
end $pruef$;

select nr, fall, erwartet, ergebnis, urteil from pruef_0079
union all
select null, 'Summe', null, count(*) filter (where urteil = 'PASS') || ' von ' || count(*), case when bool_and(urteil = 'PASS') then 'PASS' else 'FAIL' end from pruef_0079
order by nr nulls last;
