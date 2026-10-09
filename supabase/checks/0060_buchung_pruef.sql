-- ============================================================================
-- Prüfung zu Migration 0060 (Nachschliff C5: undo_fine_payment).
-- Ändert nichts: jeder Fall läuft in einer Untertransaktion, die immer
-- zurückgerollt wird. Muster wie 0050_nachfrage_pruef.sql.
-- Geprüft wird an einer Prüfstrafe, die im Fall angelegt wird.
-- ============================================================================

drop table if exists pg_temp.pruef_0060;
create temp table pruef_0060 (nr int, rolle text, fall text, erwartet text, ergebnis text, urteil text);

do $pruef$
declare
  v_admin  uuid;
  v_nutzer uuid;
  v_club   uuid;
  v_player uuid;
  v_fine   uuid := gen_random_uuid();
  v_basis  text[];
  undo     text;
  v_nr int := 0; v_txt text; v_ok boolean; v_state text; v_msg text; v_urteil text; s text; i int;
  r record; f record;
begin
  select ur.user_id into v_admin from public.user_roles ur where ur.role = 'admin' limit 1;
  select club_id into v_club from public.profiles where id = v_admin;
  select p.id into v_nutzer from public.profiles p
   where not exists (select 1 from public.user_roles ur where ur.user_id = p.id and ur.role in ('admin', 'treasurer', 'coach')) limit 1;
  select id into v_player from public.players order by name limit 1;
  if v_admin is null or v_nutzer is null then raise exception 'Admin oder freies Profil fehlt.'; end if;

  v_basis := array[format('insert into public.fines (id, club_id, player_id, date, offense, base_amount, status, payment_method, paid_at, paid_by) values (%L, %L, %L, current_date - 3, ''Prüfstrafe 0060'', 5, ''bestätigt'', ''ueberweisung'', now(), %L)', v_fine, v_club, v_player, v_admin)];
  undo := format('select public.undo_fine_payment(%L)::text', v_fine);

  for r in
    select * from (values
      (1, 'anon', null::text), (2, 'Spieler', null), (3, 'Trainer', 'coach'),
      (4, 'Kassenwart', 'treasurer'), (5, 'Admin', null), (6, 'intern', null)
    ) as t(ord, rolle, zusatzrolle) order by ord
  loop
    for f in
      select * from (values
        ('zurücknehmen ohne Kassenrolle', v_basis, array[undo], null::text[], null::text, 'verweigert', array['anon','Spieler','Trainer']),
        ('zurücknehmen: offen, Zahlart, bezahlt am und von leer', v_basis, array[undo], null,
         format('select status || ''/'' || paid::text || ''/'' || coalesce(payment_method, ''-'') || ''/'' || coalesce(paid_at::text, ''-'') || ''/'' || coalesce(paid_by::text, ''-'') from public.fines where id = %L', v_fine),
         'wert:offen/false/-/-/-', array['Kassenwart','Admin']),
        ('Verlauf: ein Schritt bestätigt -> offen mit vorheriger Zahlart und Grund', v_basis, array[undo], null,
         format('select count(*)::text || ''/'' || max(method || ''/'' || reason) from public.fine_status_log where fine_id = %L and from_status = ''bestätigt'' and to_status = ''offen''', v_fine),
         'wert:1/ueberweisung/Buchung rückgängig', array['Kassenwart']),
        ('keine Mitteilung an den Spieler', v_basis, array[undo], null,
         format('select (select count(*) from public.notification_sammler where daten::text like %L)::text || ''/'' || (select count(*) from public.notification_outbox where created_at >= now())::text', '%' || v_fine || '%'),
         'wert:0/0', array['Kassenwart']),
        ('zweimal: Fehler', v_basis, array[undo, undo], null, null, 'fehler:nicht bezahlt', array['Kassenwart']),
        ('offene Strafe: Fehler', v_basis || array[format('update public.fines set status = ''offen'' where id = %L', v_fine)], array[undo], null, null, 'fehler:nicht bezahlt', array['Admin']),
        ('gemeldete Strafe: Fehler (dafür gibt es Ablehnen)', v_basis || array[format('update public.fines set status = ''gemeldet'' where id = %L', v_fine)], array[undo], null, null, 'fehler:nicht bezahlt', array['Admin']),
        ('stornierte Strafe: Fehler', v_basis || array[format('update public.fines set status = ''storniert'' where id = %L', v_fine)], array[undo], null, null, 'fehler:nicht bezahlt', array['Admin']),
        ('Rechte: authenticated ja, anon nein', null, null, null,
         'select has_function_privilege(''authenticated'', ''public.undo_fine_payment(uuid)'', ''execute'')::text || ''/'' || has_function_privilege(''anon'', ''public.undo_fine_payment(uuid)'', ''execute'')::text',
         'wert:true/false', array['intern'])
      ) as t(fall, vor, aktion, nach, pruef, erwartet, rollen)
      where r.rolle = any(t.rollen)
    loop
      v_nr := v_nr + 1;
      v_ok := false; v_txt := null; v_state := null; v_msg := null;
      begin
        if r.zusatzrolle is not null then
          insert into public.user_roles (user_id, role, club_id) select v_nutzer, r.zusatzrolle, v_club
           where not exists (select 1 from public.user_roles where user_id = v_nutzer and role = r.zusatzrolle);
        end if;
        foreach s in array coalesce(f.vor, '{}'::text[]) loop execute s; end loop;
        if r.rolle = 'anon' then
          perform set_config('request.jwt.claims', '{"role":"anon"}', true);
          execute 'set local role anon';
        elsif r.rolle <> 'intern' then
          perform set_config('request.jwt.claims',
            json_build_object('sub', case when r.rolle = 'Admin' then v_admin else v_nutzer end, 'role', 'authenticated')::text, true);
          execute 'set local role authenticated';
        end if;
        if f.aktion is not null then
          for i in 1 .. array_length(f.aktion, 1) loop
            if f.pruef is null and i = array_length(f.aktion, 1) then execute f.aktion[i] into v_txt; else execute f.aktion[i]; end if;
          end loop;
        end if;
        if r.rolle <> 'intern' then
          execute 'reset role';
          perform set_config('request.jwt.claims', '', true);
        end if;
        foreach s in array coalesce(f.nach, '{}'::text[]) loop execute s; end loop;
        if f.pruef is not null then execute f.pruef into v_txt; end if;
        v_ok := true;
        raise exception using errcode = 'P0060', message = 'zurückrollen';
      exception when others then
        if sqlstate <> 'P0060' then v_state := sqlstate; v_msg := sqlerrm; end if;
      end;
      v_urteil := case
        when f.erwartet = 'verweigert' then case when not v_ok and v_state = '42501' then 'PASS' else 'FAIL' end
        when f.erwartet like 'wert:%' then case when v_ok and v_txt = substr(f.erwartet, 6) then 'PASS' else 'FAIL' end
        when f.erwartet like 'fehler:%' then case when not v_ok and v_state <> '42501' and v_msg like '%' || substr(f.erwartet, 8) || '%' then 'PASS' else 'FAIL' end
      end;
      insert into pruef_0060 values (v_nr, r.rolle, f.fall, f.erwartet,
        case when v_ok then 'gelungen: ' || coalesce(left(v_txt, 200), '(null)') else 'abgelehnt: ' || v_state || ' ' || left(v_msg, 160) end,
        v_urteil);
    end loop;
  end loop;
end
$pruef$;

select nr, rolle, fall, erwartet, ergebnis, urteil from pruef_0060
union all
select null, 'SUMME', count(*) || ' Fälle: ' || count(*) filter (where urteil = 'PASS') || ' PASS, '
       || count(*) filter (where urteil = 'FAIL') || ' FAIL', null, null, null from pruef_0060
order by nr nulls last;
