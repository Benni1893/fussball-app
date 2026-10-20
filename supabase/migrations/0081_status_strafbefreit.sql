-- ============================================================================
-- FC Fasanerie-Nord - Migration 0081: Keine Auto-Strafe bei Status am Termintag
--                                     (Start, 20.10.2026)
--
-- Spieler mit Status verletzt, angeschlagen, urlaub oder nicht_verfuegbar
-- bekommen keine automatische Strafe, wenn der Status am Termintag gilt:
-- status_since leer oder <= Termintag, status_until leer (gilt bis zur
-- Aenderung) oder >= Termintag.
--   1. Neuer Helfer spieler_strafbefreit_am(player, tag), intern.
--   2. apply_event_fines (keine / verspaetete Rueckmeldung zum Anpfiff) und
--      rsvp_late_cancel_fine (Rueckmeldung nach Meldeschluss) nehmen solche
--      Spieler aus.
--   3. Uebersicht nach Meldeschluss an die Trainer (notify_cron_rueckmeldung):
--      zaehlt sie nicht als offen (bisher notify_spieler_faellt_aus_am, ohne
--      angeschlagen und ohne status_since).
--   Erinnerungen und Nachfrage (notify_spieler_faellt_aus_am) bleiben wie sie sind.
-- Die Funktionen werden aus ihrer eingespielten Fassung umgeschrieben (replace
-- je genau einer Stelle, sonst Abbruch); alles andere bleibt Zeichen fuer Zeichen.
-- Aufbau: EIN do-Block, Gegenprobe am Ende.
-- ============================================================================

begin;

do $migration$
declare
  v_def text; v_alt text; v_neu text;
  function_stellen constant text[][] := array[
    array['public.apply_event_fines()',
          'and not public.neu_vor_meldeschluss(p.id, v_deadline)',
          'and not public.neu_vor_meldeschluss(p.id, v_deadline) and not public.spieler_strafbefreit_am(p.id, v_ev.date)  /* 0081 */'],
    array['public.rsvp_late_cancel_fine()',
          'if public.neu_vor_meldeschluss(v_pid, v_deadline) then',
          'if public.neu_vor_meldeschluss(v_pid, v_deadline) or public.spieler_strafbefreit_am(v_pid, e.date) then  -- 0081: Status am Termintag'],
    array['public.notify_cron_rueckmeldung()',
          'and not public.notify_spieler_faellt_aus_am(pl.id, e.date);',
          'and not public.spieler_strafbefreit_am(pl.id, e.date);   -- 0081: Status am Termintag zaehlt nicht als offen']
  ];
  i int;
begin
  if to_regprocedure('public.spieler_strafbefreit_am(uuid,date)') is not null then
    raise exception 'spieler_strafbefreit_am gibt es schon - schon eingespielt?';
  end if;

  -- 1) Helfer
  execute $ddl$
  create function public.spieler_strafbefreit_am(p_player uuid, p_tag date)
  returns boolean language sql stable security definer set search_path = public
  as $$
    select exists (select 1 from public.player_status s
                    where s.player_id = p_player
                      and s.status in ('verletzt', 'angeschlagen', 'urlaub', 'nicht_verfuegbar')
                      and (s.status_since is null or s.status_since <= p_tag)
                      and (s.status_until is null or s.status_until >= p_tag));
  $$;
  $ddl$;
  revoke all on function public.spieler_strafbefreit_am(uuid, date) from public, anon, authenticated;

  -- 2) + 3) Funktionen an genau einer Stelle umschreiben
  for i in 1 .. array_length(function_stellen, 1) loop
    v_def := pg_get_functiondef(function_stellen[i][1]::regprocedure);
    v_alt := function_stellen[i][2]; v_neu := function_stellen[i][3];
    if (length(v_def) - length(replace(v_def, v_alt, ''))) / length(v_alt) <> 1 then
      raise exception 'Stelle in % nicht genau einmal gefunden', function_stellen[i][1];
    end if;
    execute replace(v_def, v_alt, v_neu);
    if pg_get_functiondef(function_stellen[i][1]::regprocedure) !~ 'spieler_strafbefreit_am' then
      raise exception 'Gegenprobe: % nicht umgeschrieben', function_stellen[i][1];
    end if;
  end loop;

  -- Gegenprobe: bisherige Regeln weiter drin, Rechte unveraendert intern
  if pg_get_functiondef('public.apply_event_fines()'::regprocedure) !~ 'ausgeschieden_am is null'
     or pg_get_functiondef('public.apply_event_fines()'::regprocedure) !~ 'neu_vor_meldeschluss'
     or pg_get_functiondef('public.rsvp_late_cancel_fine()'::regprocedure) !~ 'neu_vor_meldeschluss' then
    raise exception 'Gegenprobe: Ehemalige oder 24-Stunden-Regel fehlt';
  end if;
  if has_function_privilege('authenticated', 'public.spieler_strafbefreit_am(uuid,date)', 'execute')
     or has_function_privilege('authenticated', 'public.apply_event_fines()', 'execute') then
    raise exception 'Gegenprobe: Rechte zu weit';
  end if;
  raise notice '0081 ok';
end $migration$;

commit;
