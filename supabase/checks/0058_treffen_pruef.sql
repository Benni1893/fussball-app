-- ============================================================================
-- Prüfung zu Migration 0058 (Treffzeit events.treffen).
-- Ändert nichts; Muster wie 0053_termin_geloescht_pruef.sql. Jeder Fall läuft
-- in einer Untertransaktion und wird zurückgerollt.
-- ============================================================================

drop table if exists pg_temp.pruef_0058;
create temp table pruef_0058 (nr int, rolle text, fall text, erwartet text, ergebnis text, urteil text);

do $pruef$
declare
  v_admin    uuid;
  v_aspieler uuid;
  v_nutzer   uuid;
  v_club     uuid;
  v_sp       uuid := gen_random_uuid();
  v_e1       uuid := gen_random_uuid();
  d1 date := current_date + 40;
  v_basis    text[];
  v_termin   text;
  v_leeren   text;
  v_nr int := 0; v_txt text; v_ok boolean; v_state text; v_msg text; v_urteil text; s text; i int;
  r record; f record;
begin
  select ur.user_id into v_admin from public.user_roles ur
    join public.profiles p on p.id = ur.user_id and p.player_id is not null where ur.role = 'admin' limit 1;
  select player_id into v_aspieler from public.profiles where id = v_admin;
  select club_id into v_club from public.players where id = v_aspieler;
  select p.id into v_nutzer from public.profiles p where p.player_id is null
     and not exists (select 1 from public.user_roles ur where ur.user_id = p.id and ur.role = 'admin') limit 1;
  if v_admin is null or v_nutzer is null then raise exception 'Admin mit Spieler oder freies Profil fehlt.'; end if;

  v_basis := array[
    format('insert into public.players (id, club_id, code, name) values (%L, %L, %L, %L)', v_sp, v_club, 'pruef0058', 'Prüfspieler 0058'),
    format('update public.profiles set player_id = %L where id = %L', v_sp, v_nutzer)];
  v_termin := format('insert into public.events (id, club_id, type, title, opponent, home, date, time, status, quelle) values (%L, %L, ''spiel'', ''Prüfgegner'', ''Prüfgegner'', false, %L, ''13:30'', ''geplant'', ''manuell'')', v_e1, v_club, d1);
  -- Neu-Meldung des Prüftermins wegräumen, damit nur Folgen der Aktion zählen
  v_leeren := 'delete from public.notification_sammler where erstellt_at >= now()';

  for r in
    select * from (values
      (1, 'anon', null::text), (2, 'Spieler', null), (3, 'Trainer', 'coach'),
      (4, 'Kassenwart', 'treasurer'), (5, 'Admin', null), (6, 'intern', null)
    ) as t(ord, rolle, zusatzrolle) order by ord
  loop
    for f in
      select * from (values
        ('Spalte treffen: text, optional, kein Termin hat eine Treffzeit', null::text[], null::text[], null::text[],
         'select (select data_type || ''|'' || is_nullable from information_schema.columns where table_schema = ''public'' and table_name = ''events'' and column_name = ''treffen'') || ''|'' || (select count(*) from public.events where treffen is not null and id <> ''00000000-0000-0000-0000-000000000000'')::text',
         'wert:text|YES|0', array['intern']),
        ('anon liest keine Termine', null, array['select count(treffen)::text from public.events'], null, null,
         'verweigert', array['anon']),
        ('Trainer legt Spiel mit Treffzeit an', v_basis,
         array[replace(v_termin, '''geplant'', ''manuell'')', '''geplant'', ''manuell'')') , format('update public.events set treffen = ''12:45'' where id = %L', v_e1)],
         null, format('select treffen from public.events where id = %L', v_e1), 'wert:12:45', array['Trainer', 'Admin']),
        ('Treffzeit ändern: keine Mitteilung, keine neue .ics-Sequenz', v_basis || array[v_termin, v_leeren],
         array[format('update public.events set treffen = ''12:45'' where id = %L', v_e1)], null,
         format('select (select count(*) from public.notification_sammler where erstellt_at >= now())::text || ''/'' || (select count(*) from public.notification_outbox where created_at >= now())::text || ''/'' || (select ical_seq from public.events where id = %L)::text', v_e1),
         'wert:0/0/0', array['Trainer']),
        ('falsches Format abgelehnt (7:5)', v_basis || array[v_termin],
         array[format('update public.events set treffen = ''7:5'' where id = %L', v_e1)], null, null,
         'fehler:23514', array['Trainer']),
        ('Spieler kann die Treffzeit nicht setzen', v_basis || array[v_termin],
         array[format('update public.events set treffen = ''12:00'' where id = %L', v_e1)], null,
         format('select coalesce(treffen, ''-'') from public.events where id = %L', v_e1), 'wert:-', array['Spieler']),
        ('Kassenwart pflegt Termine (wie alle Terminfelder, 0042)', v_basis || array[v_termin],
         array[format('update public.events set treffen = ''12:00'' where id = %L', v_e1)], null,
         format('select coalesce(treffen, ''-'') from public.events where id = %L', v_e1), 'wert:12:00', array['Kassenwart'])
      ) as t(fall, vor, aktion, nach, pruef, erwartet, rollen)
      where r.rolle = any(t.rollen)
    loop
      v_nr := v_nr + 1;
      v_ok := false; v_txt := null; v_state := null; v_msg := null;
      begin
        if r.zusatzrolle is not null then
          insert into public.user_roles (user_id, role, club_id) values (v_nutzer, r.zusatzrolle, v_club);
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
        raise exception using errcode = 'P0058', message = 'zurückrollen';
      exception when others then
        if sqlstate <> 'P0058' then v_state := sqlstate; v_msg := sqlerrm; end if;
      end;
      v_urteil := case
        when f.erwartet = 'verweigert' then case when not v_ok and v_state = '42501' then 'PASS' else 'FAIL' end
        when f.erwartet = 'ok' then case when v_ok then 'PASS' else 'FAIL' end
        when f.erwartet like 'fehler:%' then case when not v_ok and v_state = substr(f.erwartet, 8) then 'PASS' else 'FAIL' end
        when f.erwartet like 'wert:%' then case when v_ok and v_txt = substr(f.erwartet, 6) then 'PASS' else 'FAIL' end
      end;
      insert into pruef_0058 values (v_nr, r.rolle, f.fall, f.erwartet,
        case when v_ok then 'gelungen: ' || coalesce(left(v_txt, 160), '(null)') else 'abgelehnt: ' || v_state || ' ' || left(v_msg, 160) end,
        v_urteil);
    end loop;
  end loop;
end
$pruef$;

select nr, rolle, fall, erwartet, ergebnis, urteil from pruef_0058
union all
select null, 'SUMME', count(*) || ' Fälle: ' || count(*) filter (where urteil = 'PASS') || ' PASS, '
       || count(*) filter (where urteil = 'FAIL') || ' FAIL', null, null, null from pruef_0058
order by nr nulls last;
