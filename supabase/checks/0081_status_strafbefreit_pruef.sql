-- ============================================================================
-- Prüfung zu Migration 0081 (keine Auto-Strafe bei Status am Termintag).
-- Ändert nichts: alles in einer Untertransaktion, die immer zurückgerollt wird.
-- Prüfspieler mit altem Anlagedatum (sonst greift die 24-Stunden-Regel).
-- ============================================================================

drop table if exists pg_temp.pruef_0081;
create temp table pruef_0081 (nr serial, fall text, erwartet text, ergebnis text, urteil text);

do $pruef$
declare
  v_club uuid; v_ev uuid; v_ev2 uuid; v_erg jsonb := '[]';
  v_lokal timestamp := (now() at time zone 'Europe/Berlin');
  v_tag date := (now() at time zone 'Europe/Berlin')::date;
  -- name, status, seit (Tage relativ), bis (Tage relativ), alt?, ehemalig?, erwartet Anpfiff, erwartet nach Meldeschluss
  f text[][] := array[
    array['Urlaub am Termintag',         'urlaub',           '-1', '1',  'j', 'n', 'keine', 'keine'],
    array['Urlaub vorbei',               'urlaub',           '-5', '-1', 'j', 'n', 'k03',   'k05'],
    array['Verletzt ohne Bis-Datum',     'verletzt',         '-9', '',   'j', 'n', 'keine', 'keine'],
    array['Angeschlagen am Termintag',   'angeschlagen',     '',   '0',  'j', 'n', 'keine', 'keine'],
    array['Nicht verfügbar ohne Daten',  'nicht_verfuegbar', '',   '',   'j', 'n', 'keine', 'keine'],
    array['Urlaub erst ab morgen',       'urlaub',           '1',  '5',  'j', 'n', 'k03',   'k05'],
    array['Fit',                         'fit',              '',   '',   'j', 'n', 'k03',   'k05'],
    array['Ohne Statuszeile',            '',                 '',   '',   'j', 'n', 'k03',   'k05'],
    array['Neu (24-Stunden-Regel)',      'fit',              '',   '',   'n', 'n', 'keine', 'keine'],
    array['Ehemaliger',                  'fit',              '',   '',   'j', 'j', 'keine', '-']
  ];
  i int; v_pid uuid; v_ids uuid[] := '{}';
begin
  select id into v_club from public.clubs limit 1;
  begin
    -- Echte Spieler fuer die Dauer ausnehmen, damit nur Pruefspieler zaehlen
    update public.players set ausgeschieden_am = now() - interval '1 day' where ausgeschieden_am is null;

    for i in 1 .. array_length(f, 1) loop
      insert into public.players (club_id, code, name, created_at, ausgeschieden_am)
        values (v_club, 'pruef0081_' || i, 'Prüf ' || f[i][1],
                case when f[i][5] = 'j' then now() - interval '60 days' else now() end,
                case when f[i][6] = 'j' then now() - interval '2 days' end)
        returning id into v_pid;
      v_ids := v_ids || v_pid;
      if f[i][2] <> '' then
        insert into public.player_status (player_id, status, status_since, status_until)
          values (v_pid, f[i][2], v_tag + nullif(f[i][3], '')::int, v_tag + nullif(f[i][4], '')::int)
          on conflict (player_id) do update set status = excluded.status, status_since = excluded.status_since, status_until = excluded.status_until;
      end if;
    end loop;

    -- A) Anpfiff eines Trainings ohne Rueckmeldungen (apply_event_fines)
    insert into public.events (club_id, type, title, date, time, status, quelle)
      values (v_club, 'training', 'Prüf 0081 Anpfiff', (v_lokal - interval '2 hours')::date,
              to_char(v_lokal - interval '2 hours', 'HH24:MI'), 'geplant', 'manuell')
      returning id into v_ev;
    update public.events set auto_fine = true where id = v_ev;
    perform public.apply_event_fines();

    -- B) Rueckmeldung nach Meldeschluss (rsvp_late_cancel_fine): Training in 1 h, Meldeschluss vorbei
    insert into public.events (club_id, type, title, date, time, status, quelle, auto_fine)
      values (v_club, 'training', 'Prüf 0081 spät', (v_lokal + interval '1 hour')::date,
              to_char(v_lokal + interval '1 hour', 'HH24:MI'), 'geplant', 'manuell', true)
      returning id into v_ev2;
    for i in 1 .. array_length(f, 1) loop
      if f[i][8] <> '-' then
        insert into public.rsvps (club_id, event_id, player_id, status) values (v_club, v_ev2, v_ids[i], 'ab');
      end if;
    end loop;

    for i in 1 .. array_length(f, 1) loop
      v_erg := v_erg || jsonb_build_array(jsonb_build_array('Anpfiff: ' || f[i][1], f[i][7],
        (select coalesce(string_agg(k.code, ','), 'keine') from public.fines x join public.fine_catalog k on k.id = x.catalog_id where x.event_id = v_ev and x.player_id = v_ids[i])));
      if f[i][8] <> '-' then
        v_erg := v_erg || jsonb_build_array(jsonb_build_array('Absage nach Meldeschluss: ' || f[i][1], f[i][8],
          (select coalesce(string_agg(k.code, ','), 'keine') from public.fines x join public.fine_catalog k on k.id = x.catalog_id where x.event_id = v_ev2 and x.player_id = v_ids[i])));
      end if;
    end loop;

    -- C) Uebersicht nach Meldeschluss: offen = ohne Rueckmeldung, nicht ehemalig, nicht neu, nicht strafbefreit
    v_erg := v_erg || jsonb_build_array(jsonb_build_array('Übersicht: offen beim Anpfiff-Termin', '4',
      (select count(*)::text from public.players pl
        where pl.club_id = v_club and pl.ausgeschieden_am is null
          and not public.neu_vor_meldeschluss(pl.id, (select deadline_at from public.events where id = v_ev))
          and not exists (select 1 from public.rsvps r where r.event_id = v_ev and r.player_id = pl.id)
          and not public.spieler_strafbefreit_am(pl.id, (select date from public.events where id = v_ev)))));
    v_erg := v_erg || jsonb_build_array(jsonb_build_array('Übersicht nutzt den neuen Helfer', 'ja',
      case when pg_get_functiondef('public.notify_cron_rueckmeldung()'::regprocedure) ~ 'not public.spieler_strafbefreit_am\(pl.id, e.date\)' then 'ja' else 'nein' end));

    raise exception using errcode = 'P0001', message = 'rollback';
  exception when raise_exception then
    if sqlerrm <> 'rollback' then v_erg := v_erg || jsonb_build_array(jsonb_build_array('Ablauf', 'ohne Fehler', sqlerrm)); end if;
  end;

  insert into pruef_0081 (fall, erwartet, ergebnis, urteil)
    select e->>0, e->>1, e->>2, case when e->>1 = e->>2 then 'PASS' else 'FAIL' end
    from jsonb_array_elements(v_erg) e;
end $pruef$;

select nr, fall, erwartet, ergebnis, urteil from pruef_0081
union all
select null, 'Summe', null, count(*) filter (where urteil = 'PASS') || ' von ' || count(*), case when bool_and(urteil = 'PASS') then 'PASS' else 'FAIL' end from pruef_0081
order by nr nulls last;
