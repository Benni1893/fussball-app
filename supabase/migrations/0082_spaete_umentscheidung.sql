-- ============================================================================
-- FC Fasanerie-Nord - Migration 0082: Strafregel nach Meldeschluss (20.10.2026)
--
-- Bisher kostete jede Aenderung nach Meldeschluss k05. Neu:
--   - Bis Meldeschluss keine Rueckmeldung: zum Anpfiff k03/k04, bei einer
--     Rueckmeldung erst nach Meldeschluss (Zusage oder Absage) k05.
--   - Zusage (rechtzeitig) -> Absage nach Meldeschluss: k05.
--   - Absage (rechtzeitig) -> Zusage nach Meldeschluss: keine Strafe.
--   - Andere spaete Aenderungen ohne Wechsel (Grund geaendert, zurueck zum
--     Stand bei Meldeschluss): keine Strafe.
--   Status-Befreiung (0081), 24-Stunden-Regel (0078), Ehemalige (0075) bleiben.
--
-- Dafuer merkt sich rsvps.meldeschluss_stand den Stand bei Meldeschluss
-- ('keine', 'zu', 'ab'), gesetzt beim ersten Aendern nach Meldeschluss durch
-- einen BEFORE-Trigger. Der Wert vom Client wird immer ueberschrieben.
-- Helfer rsvp_spaet_strafbar(stand, status) entscheidet fuer den Sofort-Trigger
-- (rsvp_late_cancel_fine) und fuer den Anpfiff (apply_event_fines) gleich.
-- Bestehende spaete Rueckmeldungen kuenftiger Termine: Stand unbekannt, gesetzt
-- auf 'keine' (wie bisher strafbar).
-- Aufbau: EIN do-Block, Gegenprobe am Ende.
-- ============================================================================

begin;

do $migration$
declare
  v_def text; v_alt text; v_neu text; v_n int; i int;
  stellen constant text[][] := array[
    array['public.apply_event_fines()',
          'when r.updated_at <= v_deadline then null',
          'when not public.rsvp_spaet_strafbar(r.meldeschluss_stand, r.status) then null  /* 0082 */'],
    array['public.rsvp_late_cancel_fine()',
          '-- Verspaetete Rueckmeldung (Zusage ODER Absage) -> 8 EUR sofort',
          E'-- 0082: nur strafbar ohne Rueckmeldung bis Meldeschluss oder bei Zusage -> Absage\n      if not public.rsvp_spaet_strafbar(new.meldeschluss_stand, new.status) then\n        return coalesce(new, old);\n      end if;\n      -- Rueckmeldung nach Meldeschluss -> k05 sofort']
  ];
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'rsvps' and column_name = 'meldeschluss_stand') then
    raise exception 'meldeschluss_stand gibt es schon - schon eingespielt?';
  end if;

  alter table public.rsvps add column meldeschluss_stand text
    constraint rsvps_meldeschluss_stand_chk check (meldeschluss_stand in ('keine', 'zu', 'ab'));

  execute $ddl$
  create function public.rsvp_spaet_strafbar(p_stand text, p_status text)
  returns boolean language sql immutable set search_path = public
  as $$
    select coalesce(p_stand = 'keine' or (p_stand = 'zu' and p_status = 'ab'), false);
  $$;
  $ddl$;
  revoke all on function public.rsvp_spaet_strafbar(text, text) from public, anon, authenticated;

  execute $ddl$
  create function public.rsvps_meldeschluss_stand()
  returns trigger language plpgsql security definer set search_path = public
  as $$
  declare e record; v_deadline timestamptz;
  begin
    select * into e from public.events where id = new.event_id;
    if e.id is not null and e.type in ('spiel', 'training') and e.starts_at is not null then
      v_deadline := coalesce(e.deadline_at,
        public.compute_deadline(e.club_id, e.type, e.starts_at, e.deadline_override_hours));
    end if;
    if v_deadline is null or now() >= e.starts_at then
      -- kein Fenster (kein Termin mit Frist, oder schon angepfiffen): Stand bleibt
      new.meldeschluss_stand := case when tg_op = 'UPDATE' then old.meldeschluss_stand end;
    elsif now() <= v_deadline then
      new.meldeschluss_stand := null;                     -- vor Meldeschluss
    elsif tg_op = 'INSERT' then
      new.meldeschluss_stand := 'keine';                  -- erste Rueckmeldung nach Meldeschluss
    else
      new.meldeschluss_stand := coalesce(old.meldeschluss_stand,
        case when old.updated_at <= v_deadline then old.status else 'keine' end);
    end if;
    return new;
  end $$;
  $ddl$;
  revoke all on function public.rsvps_meldeschluss_stand() from public, anon, authenticated;
  execute $ddl$
  create trigger trg_rsvps_meldeschluss_stand before insert or update on public.rsvps
    for each row execute function public.rsvps_meldeschluss_stand()
  $ddl$;

  -- Bestand: spaete Rueckmeldungen kuenftiger Termine -> 'keine' (wie bisher strafbar)
  alter table public.rsvps disable trigger trg_rsvps_meldeschluss_stand;
  alter table public.rsvps disable trigger trg_rsvp_late_cancel;
  alter table public.rsvps disable trigger trg_rsvps_notify;
  update public.rsvps r set meldeschluss_stand = 'keine'
    from public.events e
   where e.id = r.event_id and e.starts_at > now() and e.deadline_at is not null and r.updated_at > e.deadline_at;
  get diagnostics v_n = row_count;
  raise notice 'Bestand auf keine gesetzt: %', v_n;
  alter table public.rsvps enable trigger trg_rsvps_meldeschluss_stand;
  alter table public.rsvps enable trigger trg_rsvp_late_cancel;
  alter table public.rsvps enable trigger trg_rsvps_notify;

  for i in 1 .. array_length(stellen, 1) loop
    v_def := pg_get_functiondef(stellen[i][1]::regprocedure);
    v_alt := stellen[i][2]; v_neu := stellen[i][3];
    if (length(v_def) - length(replace(v_def, v_alt, ''))) / length(v_alt) <> 1 then
      raise exception 'Stelle in % nicht genau einmal gefunden', stellen[i][1];
    end if;
    execute replace(v_def, v_alt, v_neu);
    if pg_get_functiondef(stellen[i][1]::regprocedure) !~ 'rsvp_spaet_strafbar' then
      raise exception 'Gegenprobe: % nicht umgeschrieben', stellen[i][1];
    end if;
  end loop;

  -- Gegenprobe: bisherige Regeln weiter drin
  if pg_get_functiondef('public.apply_event_fines()'::regprocedure) !~ 'ausgeschieden_am is null'
     or pg_get_functiondef('public.apply_event_fines()'::regprocedure) !~ 'neu_vor_meldeschluss'
     or pg_get_functiondef('public.apply_event_fines()'::regprocedure) !~ 'spieler_strafbefreit_am'
     or pg_get_functiondef('public.rsvp_late_cancel_fine()'::regprocedure) !~ 'neu_vor_meldeschluss'
     or pg_get_functiondef('public.rsvp_late_cancel_fine()'::regprocedure) !~ 'spieler_strafbefreit_am' then
    raise exception 'Gegenprobe: Ehemalige, 24-Stunden-Regel oder Status-Befreiung fehlt';
  end if;
  if (select count(*) from pg_trigger where tgrelid = 'public.rsvps'::regclass and not tgisinternal and tgenabled = 'O') <> 3 then
    raise exception 'Gegenprobe: Trigger auf rsvps nicht alle aktiv';
  end if;
  if exists (select 1 from public.fines where auto) then raise exception 'Gegenprobe: Auto-Strafe entstanden'; end if;
  raise notice '0082 ok';
end $migration$;

commit;
