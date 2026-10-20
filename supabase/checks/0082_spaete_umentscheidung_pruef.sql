-- ============================================================================
-- Prüfung zu Migration 0082 (Strafregel nach Meldeschluss). Ändert nichts:
-- alles in einer Untertransaktion, die immer zurückgerollt wird.
-- Ablauf: Training in 1 h mit Meldeschluss am Anpfiff (rechtzeitige
-- Rückmeldungen), dann Meldeschluss 3 h vorher (vorbei, spaete Änderungen),
-- dann Anpfiff in die Vergangenheit und apply_event_fines.
-- ============================================================================

drop table if exists pg_temp.pruef_0082;
create temp table pruef_0082 (nr serial, fall text, erwartet text, ergebnis text, urteil text);

do $pruef$
declare
  v_club uuid; v_ev uuid; v_erg jsonb := '[]';
  v_lokal timestamp := (now() at time zone 'Europe/Berlin');
  v_tag date := (now() at time zone 'Europe/Berlin')::date;
  -- fall, rechtzeitig, spaet (Folge, Komma), Status, alt?, ehemalig?, erwartet nach spaet, erwartet nach Anpfiff
  f text[][] := array[
    array['keine Rückmeldung -> Zusage spät',   '',   'zu',    '',       'j', 'n', 'k05',   'k05'],
    array['keine Rückmeldung -> Absage spät',   '',   'ab',    '',       'j', 'n', 'k05',   'k05'],
    array['gar nichts',                         '',   '',      '',       'j', 'n', 'keine', 'k03'],
    array['Zusage -> Absage spät',              'zu', 'ab',    '',       'j', 'n', 'k05',   'k05'],
    array['Absage -> Zusage spät',              'ab', 'zu',    '',       'j', 'n', 'keine', 'keine'],
    array['Absage -> Zusage -> Absage spät',    'ab', 'zu,ab', '',       'j', 'n', 'keine', 'keine'],
    array['Zusage -> Absage -> Zusage spät',    'zu', 'ab,zu', '',       'j', 'n', 'k05',   'k05'],
    array['Zusage rechtzeitig, nichts mehr',    'zu', '',      '',       'j', 'n', 'keine', 'keine'],
    array['Absage spät Grund geändert',         'ab', 'ab',    '',       'j', 'n', 'keine', 'keine'],
    array['Urlaub: nichts',                     '',   '',      'urlaub', 'j', 'n', 'keine', 'keine'],
    array['Urlaub: Zusage -> Absage spät',      'zu', 'ab',    'urlaub', 'j', 'n', 'keine', 'keine'],
    array['Neu (24 h): Zusage spät',            '',   'zu',    '',       'n', 'n', 'keine', 'keine'],
    array['Neu (24 h): nichts',                 '',   '',      '',       'n', 'n', 'keine', 'keine'],
    array['Ehemaliger: nichts',                 '',   '',      '',       'j', 'j', 'keine', 'keine']
  ];
  i int; v_pid uuid; v_ids uuid[] := '{}'; s text;
  code_von text := 'select coalesce(string_agg(k.code, '',''), ''keine'') from public.fines x join public.fine_catalog k on k.id = x.catalog_id where x.event_id = $1 and x.player_id = $2';
  v_c text;
begin
  select id into v_club from public.clubs limit 1;
  begin
    update public.players set ausgeschieden_am = now() - interval '1 day' where ausgeschieden_am is null;
    for i in 1 .. array_length(f, 1) loop
      insert into public.players (club_id, code, name, created_at, ausgeschieden_am)
        values (v_club, 'pruef0082_' || i, 'Prüf ' || f[i][1],
                case when f[i][5] = 'j' then now() - interval '60 days' else now() end,
                case when f[i][6] = 'j' then now() - interval '2 days' end)
        returning id into v_pid;
      v_ids := v_ids || v_pid;
      if f[i][4] <> '' then
        insert into public.player_status (player_id, status, status_since, status_until) values (v_pid, f[i][4], v_tag - 1, v_tag + 1);
      end if;
    end loop;

    -- 1) Training in 1 h, Meldeschluss am Anpfiff (noch nicht vorbei): rechtzeitige Rueckmeldungen
    insert into public.events (club_id, type, title, date, time, status, quelle, auto_fine, deadline_override_hours)
      values (v_club, 'training', 'Prüf 0082', (v_lokal + interval '1 hour')::date,
              to_char(v_lokal + interval '1 hour', 'HH24:MI'), 'geplant', 'manuell', true, 0)
      returning id into v_ev;
    for i in 1 .. array_length(f, 1) loop
      if f[i][2] <> '' then
        insert into public.rsvps (club_id, event_id, player_id, status, updated_at)
          values (v_club, v_ev, v_ids[i], f[i][2], now() - interval '3 hours');
      end if;
    end loop;

    -- 2) Meldeschluss 3 h vor Anpfiff -> vorbei. Spaete Aenderungen.
    update public.events set deadline_override_hours = 3 where id = v_ev;
    for i in 1 .. array_length(f, 1) loop
      if f[i][3] <> '' then
        foreach s in array string_to_array(f[i][3], ',') loop
          insert into public.rsvps (club_id, event_id, player_id, status, reason, updated_at)
            values (v_club, v_ev, v_ids[i], s, 'spät ' || s, now())
            on conflict (event_id, player_id) do update set status = excluded.status, reason = excluded.reason, updated_at = excluded.updated_at;
        end loop;
      end if;
    end loop;
    for i in 1 .. array_length(f, 1) loop
      execute code_von into v_c using v_ev, v_ids[i];
      v_erg := v_erg || jsonb_build_array(jsonb_build_array('nach Meldeschluss: ' || f[i][1], f[i][7], v_c));
    end loop;

    -- 3) Anpfiff vorbei: Termin 2 h in die Vergangenheit, Endstand
    update public.events set date = (v_lokal - interval '2 hours')::date, time = to_char(v_lokal - interval '2 hours', 'HH24:MI') where id = v_ev;
    perform public.apply_event_fines();
    for i in 1 .. array_length(f, 1) loop
      execute code_von into v_c using v_ev, v_ids[i];
      v_erg := v_erg || jsonb_build_array(jsonb_build_array('Anpfiff: ' || f[i][1], f[i][8], v_c));
    end loop;

    -- 4) Client kann den Stand nicht setzen
    update public.rsvps set meldeschluss_stand = 'ab' where event_id = v_ev and player_id = v_ids[4];
    v_erg := v_erg || jsonb_build_array(jsonb_build_array('Stand vom Client überschrieben', 'zu',
      (select coalesce(meldeschluss_stand, 'leer') from public.rsvps where event_id = v_ev and player_id = v_ids[4])));

    raise exception using errcode = 'P0001', message = 'rollback';
  exception when raise_exception then
    if sqlerrm <> 'rollback' then v_erg := v_erg || jsonb_build_array(jsonb_build_array('Ablauf', 'ohne Fehler', sqlerrm)); end if;
  end;

  insert into pruef_0082 (fall, erwartet, ergebnis, urteil)
    select e->>0, e->>1, e->>2, case when e->>1 = e->>2 then 'PASS' else 'FAIL' end
    from jsonb_array_elements(v_erg) e;
end $pruef$;

select nr, fall, erwartet, ergebnis, urteil from pruef_0082
union all
select null, 'Summe', null, count(*) filter (where urteil = 'PASS') || ' von ' || count(*), case when bool_and(urteil = 'PASS') then 'PASS' else 'FAIL' end from pruef_0082
order by nr nulls last;
