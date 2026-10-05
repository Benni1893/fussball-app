-- ============================================================================
-- FC Fasanerie-Nord - Migration 0045: Automatische Mitteilungen, AM2 Kasse
--                                     (ENTWURF, nicht eingespielt)
--
-- Plan und Entscheidungen: .design-sync/reference/app/auto-mitteilungen/PHASE0.md
-- Bausteine aus 0043 (AM1). Regeln: conventions.md "Erzeuger für Mitteilungen".
--
-- Vier Kategorien, ein Erzeuger: Trigger trg_fines_notify auf public.fines
-- (AFTER INSERT/UPDATE/DELETE). Alles laeuft ueber den Sammler; die
-- Zusammenfassung je Kategorie (notify_flush_<kategorie>) ruft der Cron-Job
-- notify-sammler alle 2 Minuten.
--
--   strafe_neu          neue Strafe mit Status "offen" (von Hand, automatisch
--                       zum Anpfiff, verspaetete Rueckmeldung). Karenz 3 Minuten:
--                       Storno oder Loeschen davor -> keine Nachricht; danach,
--                       solange noch nicht versendet -> Zeile wird zurueckgeholt.
--                       Gruppe = Aufruf (batch_id), sonst Termin, sonst Strafe;
--                       mehrere Strafen einer Gruppe -> EINE Nachricht mit Summe.
--                       Empfaenger: der Spieler, auch wenn er selbst ausgeloest
--                       hat (F1, Ausnahme Strafen).
--   zahlung_gemeldet    Strafe -> "gemeldet". An alle Kassenwarte, gesammelt
--                       15 Minuten ab der ersten Meldung. Beim Zusammenfassen
--                       zaehlen nur Strafen, die dann noch "gemeldet" sind.
--   zahlung_bestaetigt  Strafe -> "bestätigt". An den Spieler, gesammelt
--                       1 Minute (ein Buchungsvorgang = eine Nachricht).
--   zahlung_abgelehnt   "gemeldet" -> "offen" mit Grund. An den Spieler,
--                       gesammelt 1 Minute (eine abgelehnte Meldung mit
--                       mehreren Strafen = eine Nachricht).
--
-- Betrag wie in der App (strafeBetrag): Grundbetrag plus Mahnzuschlag; offen
-- und gemeldet live aus created_at, bestaetigt der eingefrorene Wert.
--
-- Der Trigger faengt jeden eigenen Fehler ab (raise warning): eine Strafe,
-- Meldung oder Buchung scheitert nie an einer Mitteilung.
--
-- Vorlagen (Entscheidung K1, siehe Vorlage an den Nutzer): {anzahl} traegt das
-- Nomen ("1 Zahlung", "3 Strafen"), damit es kein "1 Zahlungen" gibt. Geaendert
-- wird nur, solange der Text noch dem Auslieferungsstand entspricht.
--
-- RECHTE: alle neuen Funktionen SECURITY DEFINER, Eigentuemer postgres, kein
-- grant an anon/authenticated (Trigger und pg_cron).
--
-- Aufbau: EIN do-Block (conventions.md "Migrationen: ein einziger do-Block").
-- ============================================================================

begin;

do $migration$
declare
  v_fehl   text[] := '{}';
  v_x      text[];
  v_prof   uuid;      -- ein Profil mit Spieler
  v_player uuid;
  v_club   uuid;
  v_batch  uuid;
  v_f1     uuid;
  v_f2     uuid;
  v_n      integer;
  v_t      text;
  v_ab     timestamptz;
begin
  -- --------------------------------------------------------------------------
  -- 1) Betrag und Gruppe einer Strafe
  -- --------------------------------------------------------------------------
  execute $ddl$
  create or replace function public.notify_strafe_betrag(f public.fines)
  returns numeric language sql stable security definer set search_path = public
  as $$
    select coalesce(f.base_amount, (select c.amount from public.fine_catalog c where c.id = f.catalog_id), 0)
         + case when f.status = 'bestätigt' then coalesce(f.surcharge, 0)
                else least(5, greatest(0, floor(extract(epoch from (now() - f.created_at)) / 604800)))::int * 2
           end;
  $$
  $ddl$;

  execute $ddl$
  create or replace function public.notify_strafe_bezug(f public.fines)
  returns text language sql immutable set search_path = public
  as $$
    select coalesce('batch:' || f.batch_id::text, 'termin:' || f.event_id::text, 'strafe:' || f.id::text);
  $$
  $ddl$;

  -- Anzahl mit Nomen: 1 Strafe, 2 Strafen.
  execute $ddl$
  create or replace function public.notify_anzahl(p_n integer, p_einzahl text, p_mehrzahl text)
  returns text language sql immutable set search_path = public
  as $$ select p_n || ' ' || case when p_n = 1 then p_einzahl else p_mehrzahl end; $$
  $ddl$;

  -- --------------------------------------------------------------------------
  -- 2) Strafe zurueckziehen (Storno oder Loeschen)
  -- --------------------------------------------------------------------------
  -- Vor dem Zusammenfassen: Sammler-Eintrag weg. Danach, noch nicht versendet:
  -- die Outbox-Zeile der Gruppe weg, wenn in der Gruppe keine aktive Strafe
  -- mehr steht. Nach dem Versand: nichts (keine "Strafe aufgehoben"-Nachricht).
  execute $ddl$
  create or replace function public.notify_strafe_zurueckziehen(p_fine uuid, p_player uuid, p_bezug text)
  returns void language plpgsql security definer set search_path = public
  as $$
  begin
    delete from public.notification_sammler
     where kategorie = 'strafe_neu' and daten->>'fine_id' = p_fine::text;
    if not exists (select 1 from public.fines f
                    where f.player_id = p_player and f.id <> p_fine and f.status <> 'storniert'
                      and public.notify_strafe_bezug(f) = p_bezug) then
      delete from public.notification_outbox o
       where o.kategorie = 'strafe_neu' and o.sent_at is null and o.claimed_at is null
         and o.dedup_key like 'strafe_neu:' || p_bezug || ':%';
    end if;
  end;
  $$
  $ddl$;

  -- --------------------------------------------------------------------------
  -- 3) Erzeuger: Trigger auf fines
  -- --------------------------------------------------------------------------
  execute $ddl$
  create or replace function public.notify_fines_ereignis()
  returns trigger language plpgsql security definer set search_path = public
  as $$
  declare
    v_uid uuid := auth.uid();
    v_p   uuid;
  begin
    begin
      if tg_op = 'INSERT' then
        if new.status = 'offen' then
          for v_p in select public.notify_profile_von_spieler(new.player_id) loop
            perform public.notify_sammeln('strafe_neu', public.notify_strafe_bezug(new), v_p, v_uid,
              jsonb_build_object('fine_id', new.id), now() + interval '3 minutes');
          end loop;
        end if;

      elsif tg_op = 'UPDATE' then
        if new.status is distinct from old.status then
          if new.status = 'gemeldet' then
            for v_p in select public.notify_profile_mit_rolle('treasurer') loop
              perform public.notify_sammeln('zahlung_gemeldet', 'kasse', v_p, v_uid,
                jsonb_build_object('fine_id', new.id), now() + interval '15 minutes');
            end loop;
          elsif new.status = 'bestätigt' then
            for v_p in select public.notify_profile_von_spieler(new.player_id) loop
              perform public.notify_sammeln('zahlung_bestaetigt', new.player_id::text, v_p, v_uid,
                jsonb_build_object('fine_id', new.id), now() + interval '1 minute');
            end loop;
          elsif old.status = 'gemeldet' and new.status = 'offen' then
            for v_p in select public.notify_profile_von_spieler(new.player_id) loop
              perform public.notify_sammeln('zahlung_abgelehnt', new.player_id::text, v_p, v_uid,
                jsonb_build_object('fine_id', new.id), now() + interval '1 minute');
            end loop;
          elsif new.status = 'storniert' then
            perform public.notify_strafe_zurueckziehen(new.id, new.player_id, public.notify_strafe_bezug(new));
          end if;
        end if;

      elsif tg_op = 'DELETE' then
        perform public.notify_strafe_zurueckziehen(old.id, old.player_id, public.notify_strafe_bezug(old));
      end if;
    exception when others then
      raise warning 'notify_fines_ereignis (%): % %', tg_op, sqlstate, sqlerrm;
    end;
    return null;
  end;
  $$
  $ddl$;

  execute 'drop trigger if exists trg_fines_notify on public.fines';
  execute 'create trigger trg_fines_notify after insert or update or delete on public.fines
             for each row execute function public.notify_fines_ereignis()';

  -- --------------------------------------------------------------------------
  -- 4) Zusammenfassen je Kategorie (ruft notify_sammler_flush aus 0043)
  -- --------------------------------------------------------------------------
  -- Muster: faellige Gruppen waehlen, Eintraege der Gruppe loeschen und die
  -- Strafen-IDs mitnehmen (ein zweiter, gleichzeitiger Lauf findet dann
  -- nichts mehr), mit dem heutigen Stand der Strafen rechnen, einreihen.
  -- dedup_key enthaelt die Faelligkeit der Gruppe: ein Doppellauf erzeugt
  -- keine zweite Zeile, eine spaetere Gruppe mit gleichem Bezug schon.

  execute $ddl$
  create or replace function public.notify_flush_strafe_neu()
  returns integer language plpgsql security definer set search_path = public
  as $$
  declare
    g record; v_ids uuid[]; v_n integer := 0;
    v_anz integer; v_sum numeric; v_gruende text; v_von date; v_bis date;
  begin
    for g in
      select s.bezug, s.profile_id, min(s.faellig_ab) as ab
        from public.notification_sammler s
       where s.kategorie = 'strafe_neu'
       group by s.bezug, s.profile_id
      having min(s.faellig_ab) <= now()
    loop
      with weg as (
        delete from public.notification_sammler s
         where s.kategorie = 'strafe_neu' and s.bezug = g.bezug and s.profile_id = g.profile_id
        returning (s.daten->>'fine_id')::uuid as fine_id)
      select array_agg(fine_id) into v_ids from weg;
      continue when v_ids is null;

      select count(*), sum(public.notify_strafe_betrag(f)),
             string_agg(distinct f.offense, ', '), min(f.date), max(f.date)
        into v_anz, v_sum, v_gruende, v_von, v_bis
        from public.fines f where f.id = any(v_ids) and f.status <> 'storniert';
      continue when v_anz = 0;

      perform public.notify_enqueue(g.profile_id, 'strafe_neu',
        jsonb_build_object(
          'betrag', public.notify_betrag(v_sum),
          'grund',  case when v_anz = 1 then coalesce(v_gruende, 'Strafe')
                         else v_anz || ' Strafen: ' || coalesce(v_gruende, '') end,
          'datum',  case when v_von = v_bis then public.notify_datum_lang(v_von)
                         else public.notify_datum_kurz(v_von) || ' bis ' || public.notify_datum_lang(v_bis) end),
        p_dedup => 'strafe_neu:' || g.bezug || ':' || g.profile_id || ':' || floor(extract(epoch from g.ab))::bigint);
      v_n := v_n + 1;
    end loop;
    return v_n;
  end;
  $$
  $ddl$;

  execute $ddl$
  create or replace function public.notify_flush_zahlung_gemeldet()
  returns integer language plpgsql security definer set search_path = public
  as $$
  declare
    g record; v_ids uuid[]; v_n integer := 0;
    v_spieler integer; v_sum numeric; v_namen text;
  begin
    for g in
      select s.bezug, s.profile_id, min(s.faellig_ab) as ab
        from public.notification_sammler s
       where s.kategorie = 'zahlung_gemeldet'
       group by s.bezug, s.profile_id
      having min(s.faellig_ab) <= now()
    loop
      with weg as (
        delete from public.notification_sammler s
         where s.kategorie = 'zahlung_gemeldet' and s.bezug = g.bezug and s.profile_id = g.profile_id
        returning (s.daten->>'fine_id')::uuid as fine_id)
      select array_agg(fine_id) into v_ids from weg;
      continue when v_ids is null;

      -- Nur was noch zu pruefen ist; schon bestaetigt oder abgelehnt zaehlt nicht.
      select count(distinct f.player_id), sum(public.notify_strafe_betrag(f)),
             string_agg(distinct p.name, ', ')
        into v_spieler, v_sum, v_namen
        from public.fines f join public.players p on p.id = f.player_id
       where f.id = any(v_ids) and f.status = 'gemeldet';
      continue when v_spieler = 0;

      perform public.notify_enqueue(g.profile_id, 'zahlung_gemeldet',
        jsonb_build_object(
          'anzahl', public.notify_anzahl(v_spieler, 'Zahlung', 'Zahlungen'),
          'namen',  v_namen,
          'betrag', public.notify_betrag(v_sum)),
        p_dedup => 'zahlung_gemeldet:' || g.profile_id || ':' || floor(extract(epoch from g.ab))::bigint);
      v_n := v_n + 1;
    end loop;
    return v_n;
  end;
  $$
  $ddl$;

  execute $ddl$
  create or replace function public.notify_flush_zahlung_bestaetigt()
  returns integer language plpgsql security definer set search_path = public
  as $$
  declare
    g record; v_ids uuid[]; v_n integer := 0; v_anz integer; v_sum numeric;
  begin
    for g in
      select s.bezug, s.profile_id, min(s.faellig_ab) as ab
        from public.notification_sammler s
       where s.kategorie = 'zahlung_bestaetigt'
       group by s.bezug, s.profile_id
      having min(s.faellig_ab) <= now()
    loop
      with weg as (
        delete from public.notification_sammler s
         where s.kategorie = 'zahlung_bestaetigt' and s.bezug = g.bezug and s.profile_id = g.profile_id
        returning (s.daten->>'fine_id')::uuid as fine_id)
      select array_agg(fine_id) into v_ids from weg;
      continue when v_ids is null;

      select count(*), sum(public.notify_strafe_betrag(f)) into v_anz, v_sum
        from public.fines f where f.id = any(v_ids) and f.status = 'bestätigt';
      continue when v_anz = 0;

      perform public.notify_enqueue(g.profile_id, 'zahlung_bestaetigt',
        jsonb_build_object(
          'anzahl', public.notify_anzahl(v_anz, 'Strafe', 'Strafen'),
          'betrag', public.notify_betrag(v_sum)),
        p_dedup => 'zahlung_bestaetigt:' || g.profile_id || ':' || floor(extract(epoch from g.ab))::bigint);
      v_n := v_n + 1;
    end loop;
    return v_n;
  end;
  $$
  $ddl$;

  execute $ddl$
  create or replace function public.notify_flush_zahlung_abgelehnt()
  returns integer language plpgsql security definer set search_path = public
  as $$
  declare
    g record; v_ids uuid[]; v_n integer := 0; v_anz integer; v_sum numeric; v_gruende text;
  begin
    for g in
      select s.bezug, s.profile_id, min(s.faellig_ab) as ab
        from public.notification_sammler s
       where s.kategorie = 'zahlung_abgelehnt'
       group by s.bezug, s.profile_id
      having min(s.faellig_ab) <= now()
    loop
      with weg as (
        delete from public.notification_sammler s
         where s.kategorie = 'zahlung_abgelehnt' and s.bezug = g.bezug and s.profile_id = g.profile_id
        returning (s.daten->>'fine_id')::uuid as fine_id)
      select array_agg(fine_id) into v_ids from weg;
      continue when v_ids is null;

      select count(*), sum(public.notify_strafe_betrag(f)), string_agg(distinct f.reject_reason, '; ')
        into v_anz, v_sum, v_gruende
        from public.fines f where f.id = any(v_ids) and f.status = 'offen' and f.reject_reason is not null;
      continue when v_anz = 0;

      perform public.notify_enqueue(g.profile_id, 'zahlung_abgelehnt',
        jsonb_build_object('betrag', public.notify_betrag(v_sum), 'grund', v_gruende),
        p_dedup => 'zahlung_abgelehnt:' || g.profile_id || ':' || floor(extract(epoch from g.ab))::bigint);
      v_n := v_n + 1;
    end loop;
    return v_n;
  end;
  $$
  $ddl$;

  -- --------------------------------------------------------------------------
  -- 5) Rechte
  -- --------------------------------------------------------------------------
  revoke execute on function public.notify_strafe_betrag(public.fines)                 from public, anon, authenticated;
  revoke execute on function public.notify_strafe_bezug(public.fines)                  from public, anon, authenticated;
  revoke execute on function public.notify_anzahl(integer, text, text)                 from public, anon, authenticated;
  revoke execute on function public.notify_strafe_zurueckziehen(uuid, uuid, text)      from public, anon, authenticated;
  revoke execute on function public.notify_fines_ereignis()                            from public, anon, authenticated;
  revoke execute on function public.notify_flush_strafe_neu()                          from public, anon, authenticated;
  revoke execute on function public.notify_flush_zahlung_gemeldet()                    from public, anon, authenticated;
  revoke execute on function public.notify_flush_zahlung_bestaetigt()                  from public, anon, authenticated;
  revoke execute on function public.notify_flush_zahlung_abgelehnt()                   from public, anon, authenticated;

  -- --------------------------------------------------------------------------
  -- 6) Vorlagen: {anzahl} mit Nomen (K1). Nur der Auslieferungsstand wird
  --    ersetzt; hat der Admin den Text schon geaendert, bleibt er.
  -- --------------------------------------------------------------------------
  update public.notification_templates
     set titel_vorlage = '💰 {anzahl} zu prüfen',
         beispiel_daten = beispiel_daten || '{"anzahl":"2 Zahlungen"}'::jsonb,
         updated_at = now()
   where kategorie = 'zahlung_gemeldet' and titel_vorlage = '💰 {anzahl} Zahlungen zu prüfen';
  update public.notification_templates
     set text_vorlage = '{anzahl}, {betrag} verbucht.',
         beispiel_daten = beispiel_daten || '{"anzahl":"3 Strafen"}'::jsonb,
         updated_at = now()
   where kategorie = 'zahlung_bestaetigt' and text_vorlage = '{anzahl} Strafen, {betrag} verbucht.';

  -- --------------------------------------------------------------------------
  -- Gegenprobe
  -- --------------------------------------------------------------------------
  -- Keine notify_*-Funktion von aussen (ausser notify_enqueue: service_role).
  select array_agg(p.oid::regprocedure::text) into v_x
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname like 'notify\_%' and p.proname <> 'notify_enqueue'
     and (has_function_privilege('anon', p.oid, 'execute')
          or has_function_privilege('authenticated', p.oid, 'execute')
          or exists (select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a where a.grantee = 0));
  if v_x is not null then v_fehl := v_fehl || ('von außen ausführbar: ' || array_to_string(v_x, ', ')); end if;

  if not exists (select 1 from pg_trigger where tgname = 'trg_fines_notify' and tgrelid = 'public.fines'::regclass) then
    v_fehl := v_fehl || 'Trigger trg_fines_notify fehlt'::text;
  end if;

  -- Vorlagen ohne "1 Zahlungen" (nur pruefen, wenn der Auslieferungsstand ersetzt wurde
  -- oder schon passt).
  select string_agg(kategorie, ', ') into v_t from public.notification_templates
   where (kategorie = 'zahlung_gemeldet' and titel_vorlage = '💰 {anzahl} Zahlungen zu prüfen')
      or (kategorie = 'zahlung_bestaetigt' and text_vorlage = '{anzahl} Strafen, {betrag} verbucht.');
  if v_t is not null then v_fehl := v_fehl || ('Vorlage nicht ersetzt: ' || v_t); end if;

  -- Mit echten Zeilen, zurueckgerollt.
  select p.id, p.player_id, pl.club_id into v_prof, v_player, v_club
    from public.profiles p join public.players pl on pl.id = p.player_id limit 1;
  if v_prof is null then
    v_fehl := v_fehl || 'kein Profil mit Spieler für die Gegenprobe'::text;
  else
    begin
      v_batch := gen_random_uuid();
      insert into public.fines (club_id, player_id, date, offense, base_amount, status, batch_id)
      values (v_club, v_player, '2026-10-01', 'Gegenprobe A', 5, 'offen', v_batch) returning id into v_f1;
      insert into public.fines (club_id, player_id, date, offense, base_amount, status, batch_id)
      values (v_club, v_player, '2026-10-03', 'Gegenprobe B', 3, 'offen', v_batch) returning id into v_f2;

      -- zwei Eintraege, eine Gruppe, Karenz rund 3 Minuten
      select count(*), min(faellig_ab) into v_n, v_ab from public.notification_sammler
       where kategorie = 'strafe_neu' and bezug = 'batch:' || v_batch;
      if v_n <> 2 or v_ab < now() + interval '170 seconds' or v_ab > now() + interval '190 seconds' then
        v_fehl := v_fehl || ('strafe_neu: Sammler ' || v_n || ', fällig ' || coalesce(v_ab::text, '-'));
      end if;

      -- zusammenfassen: eine Zeile mit Summe
      update public.notification_sammler set faellig_ab = now() - interval '1 second'
       where kategorie = 'strafe_neu' and bezug = 'batch:' || v_batch;
      perform public.notify_flush_strafe_neu();
      select count(*), max(titel || ' | ' || text) into v_n, v_t from public.notification_outbox
       where dedup_key like 'strafe_neu:batch:' || v_batch || ':%';
      if v_n <> 1 or v_t <> '💸 Neue Strafe: 8,00 € | 2 Strafen: Gegenprobe A, Gegenprobe B, 01.10. bis 03.10.2026. Bar, Überweisung oder PayPal.' then
        v_fehl := v_fehl || ('strafe_neu: Outbox ' || v_n || ' / ' || coalesce(v_t, '-'));
      end if;

      -- beide storniert, noch nicht versendet: Zeile zurueckgeholt
      update public.fines set status = 'storniert' where id in (v_f1, v_f2);
      select count(*) into v_n from public.notification_outbox where dedup_key like 'strafe_neu:batch:' || v_batch || ':%';
      if v_n <> 0 then v_fehl := v_fehl || 'strafe_neu: Storno nach dem Zusammenfassen holt die Zeile nicht zurück'::text; end if;

      raise exception using errcode = 'P0045', message = 'zurückrollen';
    exception when sqlstate 'P0045' then null;
    end;

    begin
      -- Storno in der Karenz: kein Sammler-Eintrag bleibt
      insert into public.fines (club_id, player_id, date, offense, base_amount, status, batch_id)
      values (v_club, v_player, current_date, 'Gegenprobe C', 5, 'offen', gen_random_uuid()) returning id into v_f1;
      update public.fines set status = 'storniert' where id = v_f1;
      select count(*) into v_n from public.notification_sammler where daten->>'fine_id' = v_f1::text;
      if v_n <> 0 then v_fehl := v_fehl || 'strafe_neu: Storno in der Karenz lässt den Eintrag stehen'::text; end if;
      raise exception using errcode = 'P0045', message = 'zurückrollen';
    exception when sqlstate 'P0045' then null;
    end;
  end if;

  if array_length(v_fehl, 1) > 0 then
    raise exception 'Gegenprobe 0045 fehlgeschlagen: %', v_fehl;
  end if;
  raise notice 'Gegenprobe 0045 bestanden.';
end
$migration$;

commit;

-- ============================================================================
-- RUECKBAU (nicht automatisch ausgefuehrt), als ein do-Block:
-- do $$ begin
--   drop trigger if exists trg_fines_notify on public.fines;
--   drop function if exists public.notify_flush_strafe_neu(), public.notify_flush_zahlung_gemeldet(),
--     public.notify_flush_zahlung_bestaetigt(), public.notify_flush_zahlung_abgelehnt(),
--     public.notify_fines_ereignis(), public.notify_strafe_zurueckziehen(uuid, uuid, text),
--     public.notify_anzahl(integer, text, text), public.notify_strafe_bezug(public.fines),
--     public.notify_strafe_betrag(public.fines);
--   delete from public.notification_sammler
--    where kategorie in ('strafe_neu','zahlung_gemeldet','zahlung_bestaetigt','zahlung_abgelehnt');
--   update public.notification_templates set titel_vorlage = '💰 {anzahl} Zahlungen zu prüfen',
--     beispiel_daten = beispiel_daten || '{"anzahl":"2"}' where kategorie = 'zahlung_gemeldet'
--     and titel_vorlage = '💰 {anzahl} zu prüfen';
--   update public.notification_templates set text_vorlage = '{anzahl} Strafen, {betrag} verbucht.',
--     beispiel_daten = beispiel_daten || '{"anzahl":"3"}' where kategorie = 'zahlung_bestaetigt'
--     and text_vorlage = '{anzahl}, {betrag} verbucht.';
-- end $$;
-- ============================================================================
