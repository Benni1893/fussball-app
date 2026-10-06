-- ============================================================================
-- FC Fasanerie-Nord - Migration 0058: Treffzeit am Termin
--
-- Vorlage "Final Alle Screens", Screens 02 und 03: Spiele zeigen neben dem
-- Anstoss eine Treffzeit ("13:30 Uhr · Treffen 12:45"), der Termin-Dialog hat
-- dafuer ein Feld. Neue Spalte events.treffen (Text "HH:MM" wie time/ende,
-- optional). Keine Daten werden geaendert, kein Termin bekommt eine Treffzeit.
--
-- Bewusst:
--   - trg_events_notify reagiert weiter nur auf Datum, Beginn und Ort: eine
--     geaenderte Treffzeit loest keine Mitteilung "Termin geaendert" aus.
--   - events_bump_ical_seq bleibt unveraendert (die .ics-Datei enthaelt die
--     Treffzeit nicht).
--
-- RECHTE: keine Aenderung. Die Tabellenrechte von authenticated gelten fuer
-- die neue Spalte mit; RLS-Policies bleiben, wie sie sind (0042).
-- Aufbau: EIN do-Block (conventions.md).
-- ============================================================================

begin;

do $migration$
declare
  v_fehl text[] := '{}';
  v_rechte_vor text; v_rechte_nach text;
  v_pol_vor text; v_pol_nach text;
  v_zeilen_vor bigint; v_zeilen_nach bigint;
  v_id uuid; v_seq_vor integer; v_seq_nach integer; v_out_vor bigint; v_out_nach bigint;
begin
  select string_agg(grantee || ':' || privilege_type, ',' order by grantee, privilege_type) into v_rechte_vor
    from information_schema.table_privileges
   where table_schema = 'public' and table_name = 'events' and grantee in ('anon', 'authenticated');
  select string_agg(policyname || ':' || cmd || ':' || coalesce(qual, '') || ':' || coalesce(with_check, ''), ';' order by policyname) into v_pol_vor
    from pg_policies where schemaname = 'public' and tablename = 'events';
  select count(*) into v_zeilen_vor from public.events;

  alter table public.events add column if not exists treffen text null;
  alter table public.events drop constraint if exists events_treffen_format;
  alter table public.events add constraint events_treffen_format
    check (treffen is null or treffen ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
  comment on column public.events.treffen is 'Treffzeit "HH:MM" (optional), Vorlage Final 02/03';

  -- Gegenprobe ---------------------------------------------------------------
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'events'
                    and column_name = 'treffen' and data_type = 'text' and is_nullable = 'YES') then
    v_fehl := v_fehl || 'Spalte treffen fehlt'::text;
  end if;
  if exists (select 1 from public.events where treffen is not null) then
    v_fehl := v_fehl || 'Treffzeit gesetzt'::text;
  end if;
  select string_agg(grantee || ':' || privilege_type, ',' order by grantee, privilege_type) into v_rechte_nach
    from information_schema.table_privileges
   where table_schema = 'public' and table_name = 'events' and grantee in ('anon', 'authenticated');
  if v_rechte_nach is distinct from v_rechte_vor then
    v_fehl := v_fehl || ('Rechte ' || coalesce(v_rechte_vor, '-') || ' -> ' || coalesce(v_rechte_nach, '-'));
  end if;
  select string_agg(policyname || ':' || cmd || ':' || coalesce(qual, '') || ':' || coalesce(with_check, ''), ';' order by policyname) into v_pol_nach
    from pg_policies where schemaname = 'public' and tablename = 'events';
  if v_pol_nach is distinct from v_pol_vor then
    v_fehl := v_fehl || 'Policies veraendert'::text;
  end if;
  select count(*) into v_zeilen_nach from public.events;
  if v_zeilen_nach <> v_zeilen_vor then
    v_fehl := v_fehl || 'Zeilenzahl'::text;
  end if;

  -- Treffzeit setzen: keine Mitteilung, keine neue .ics-Sequenz, Format geprueft.
  -- (Untertransaktion, wird immer zurueckgerollt.)
  begin
    select id, ical_seq into v_id, v_seq_vor from public.events
     where date > current_date order by date limit 1;
    if v_id is not null then
      select count(*) into v_out_vor from public.notification_outbox;
      update public.events set treffen = '12:45' where id = v_id;
      select ical_seq into v_seq_nach from public.events where id = v_id;
      select count(*) into v_out_nach from public.notification_outbox;
      if v_seq_nach <> v_seq_vor then v_fehl := v_fehl || 'ical_seq erhoeht'::text; end if;
      if v_out_nach <> v_out_vor then v_fehl := v_fehl || 'Mitteilung ausgeloest'::text; end if;
      begin
        update public.events set treffen = '25:00' where id = v_id;
        v_fehl := v_fehl || 'Format 25:00 angenommen'::text;
      exception when check_violation then null;
      end;
    end if;
    raise exception using errcode = 'P0058', message = 'zurückrollen';
  exception when sqlstate 'P0058' then null;
  end;

  if array_length(v_fehl, 1) > 0 then
    raise exception 'Gegenprobe 0058 fehlgeschlagen: %', v_fehl;
  end if;
  raise notice 'Gegenprobe 0058 bestanden.';
end
$migration$;

commit;
