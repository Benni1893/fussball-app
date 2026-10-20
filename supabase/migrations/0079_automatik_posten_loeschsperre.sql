-- ============================================================================
-- FC Fasanerie-Nord - Migration 0079: Automatik-Posten nicht loeschbar (20.10.2026)
--
-- Die Strafen-Automatik (apply_event_fines, rsvp_late_cancel_fine) sucht ihre
-- Posten im Strafenkatalog ueber den Code: k03 keine Rueckmeldung Training,
-- k04 keine Rueckmeldung Spiel, k05 Rueckmeldung nach Meldeschluss. Fehlt ein
-- Posten, vergibt die Automatik still keine Strafe. Name und Betrag bleiben
-- aenderbar, Loeschen sperrt ein Trigger fuer jede Rolle.
-- Aufbau: EIN do-Block, Gegenprobe am Ende (Untertransaktionen, zurueckgerollt).
-- ============================================================================

begin;

do $migration$
declare
  v_n int; v_ok boolean;
begin
  if exists (select 1 from pg_trigger where tgname = 'trg_fine_catalog_auto_sperre') then
    raise exception 'Trigger gibt es schon - schon eingespielt?';
  end if;
  if (select count(*) from public.fine_catalog where code in ('k03','k04','k05')) <> 3 then
    raise exception 'Vorprobe: k03, k04, k05 nicht vollstaendig';
  end if;

  execute $ddl$
  create or replace function public.fine_catalog_auto_sperre()
  returns trigger language plpgsql set search_path = public
  as $$
  begin
    if old.code in ('k03', 'k04', 'k05') then
      raise exception 'Dieser Posten wird automatisch vergeben und kann nicht gelöscht werden.' using errcode = '42501';
    end if;
    return old;
  end $$;
  $ddl$;

  execute $ddl$
  create trigger trg_fine_catalog_auto_sperre before delete on public.fine_catalog
    for each row execute function public.fine_catalog_auto_sperre()
  $ddl$;

  -- Gegenprobe 1: k05 loeschen scheitert
  v_ok := false;
  begin
    delete from public.fine_catalog where code = 'k05';
  exception when insufficient_privilege then v_ok := true;
  end;
  if not v_ok then raise exception 'Gegenprobe: k05 liess sich loeschen'; end if;

  -- Gegenprobe 2: ein anderer Posten bleibt loeschbar (zurueckgerollt)
  begin
    delete from public.fine_catalog where code = 'k27';
    get diagnostics v_n = row_count;
    raise exception using errcode = 'P0001', message = 'rollback:' || v_n;
  exception when raise_exception then
    if sqlerrm <> 'rollback:1' then raise exception 'Gegenprobe: k27 nicht loeschbar (%)', sqlerrm; end if;
  end;

  -- Gegenprobe 3: Name und Betrag bleiben aenderbar (zurueckgerollt)
  begin
    update public.fine_catalog set offense = offense || ' x', amount = amount + 1 where code = 'k03';
    get diagnostics v_n = row_count;
    raise exception using errcode = 'P0001', message = 'rollback:' || v_n;
  exception when raise_exception then
    if sqlerrm <> 'rollback:1' then raise exception 'Gegenprobe: k03 nicht aenderbar (%)', sqlerrm; end if;
  end;

  if (select count(*) from public.fine_catalog) <> 25 then raise exception 'Gegenprobe: Katalog veraendert'; end if;
  raise notice '0079 ok';
end $migration$;

commit;
