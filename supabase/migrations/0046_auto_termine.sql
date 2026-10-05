-- ============================================================================
-- FC Fasanerie-Nord - Migration 0046: Automatische Mitteilungen, AM3 Termine
--
-- Plan und Entscheidungen: .design-sync/reference/app/auto-mitteilungen/PHASE0.md,
-- Annahmen: auto-mitteilungen/ANNAHMEN.md (T1 bis T8). Bausteine aus 0043.
--
-- Ein Erzeuger: Trigger trg_events_notify auf public.events.
--
--   termin_neu        neuer kuenftiger Termin (App, Serie, BFV-Sync). Sammler je
--                     Ausloeser, 30 Minuten ab dem ersten; aus dem BFV-Sync je
--                     Lauf, fruehestens 08:00 (F2, F5). An alle verknuepften
--                     Spieler ausser dem Ausloeser (F1).
--   termin_geaendert  Datum, Uhrzeit oder Ort eines kuenftigen Termins aendern
--                     sich, oder ein abgesagter Termin findet doch statt.
--                     Sammler je Ausloeser, 10 Minuten; beim Zusammenfassen nur,
--                     was sich gegenueber dem Ausgangswert noch unterscheidet.
--                     Mehrere Termine (Serie) -> eine Nachricht. An alle Spieler
--                     ausser Urlaub/verletzt am Termin (F3) und dem Ausloeser.
--   termin_abgesagt   ein kuenftiger Termin -> "abgesagt". Direkt eingereiht,
--                     2 Minuten Karenz ("Findet statt" davor nimmt sie zurueck),
--                     aus dem BFV-Sync fruehestens 08:00. Empfaenger wie oben.
--
-- Loeschen eines Termins erzeugt keine Nachricht (T5), raeumt aber noch nicht
-- gesammelte Eintraege weg. Steht die "neu"-Meldung eines Termins noch aus,
-- erzeugen Aenderung und Absage nichts (die Spieler kennen ihn noch nicht).
--
-- Nichts rueckwirkend: nur Aenderungen ab jetzt, nur kuenftige Termine.
-- Der Trigger faengt eigene Fehler ab; ein Termin scheitert nie an einer
-- Mitteilung.
--
-- Vorlage termin_neu (T7, wie K1): Titel "📅 {anzahl}" mit "1 neuer Termin" /
-- "3 neue Termine", Text "Jetzt zu- oder absagen: {liste}" (sonst ".." nach dem
-- Datum). Nur wenn der Text noch dem Auslieferungsstand entspricht.
--
-- RECHTE: alle neuen Funktionen SECURITY DEFINER, kein grant (Trigger, Cron).
-- Aufbau: EIN do-Block (conventions.md).
-- ============================================================================

begin;

do $migration$
declare
  v_fehl   text[] := '{}';
  v_x      text[];
  v_club   uuid;
  v_prof   uuid;
  v_ev     uuid;
  v_n      integer;
  v_t      text;
  v_ab     timestamptz;
begin
  -- --------------------------------------------------------------------------
  -- 1) Hilfen
  -- --------------------------------------------------------------------------
  -- Urlaub/verletzt AM TAG des Termins (status_until einschliesslich, ohne Datum offen).
  execute $ddl$
  create or replace function public.notify_spieler_faellt_aus_am(p_player uuid, p_tag date)
  returns boolean language sql stable security definer set search_path = public
  as $$
    select exists (select 1 from public.player_status s
                    where s.player_id = p_player and s.status in ('urlaub', 'verletzt')
                      and (s.status_until is null or s.status_until >= p_tag));
  $$
  $ddl$;

  execute $ddl$
  create or replace function public.notify_profile_spieler_am(p_tag date)
  returns table (profile_id uuid, player_id uuid)
  language sql stable security definer set search_path = public
  as $$
    select p.id, p.player_id from public.profiles p
     where p.player_id is not null and not public.notify_spieler_faellt_aus_am(p.player_id, p_tag);
  $$
  $ddl$;

  -- Ort eines Termins fuer den Text.
  execute $ddl$
  create or replace function public.notify_termin_ort(e public.events)
  returns text language sql immutable set search_path = public
  as $$ select coalesce(nullif(btrim(e.location), ''), nullif(btrim(e.location_raw), ''), nullif(btrim(e.spielstaette), ''), 'offen'); $$
  $ddl$;

  -- "Training 22.09., VfB Sparta München 27.09." - hoechstens 5, dann "und N weitere".
  execute $ddl$
  create or replace function public.notify_termin_liste(p_ids uuid[])
  returns text language sql stable security definer set search_path = public
  as $$
    with t as (
      select public.notify_termin_titel(e.id) || ' ' || public.notify_datum_kurz(e.date) as txt,
             row_number() over (order by e.starts_at, e.id) as nr, count(*) over () as n
        from public.events e where e.id = any(p_ids))
    select string_agg(txt, ', ' order by nr) filter (where nr <= 5)
           || case when max(n) > 5 then ' und ' || (max(n) - 5) || ' weitere' else '' end
      from t;
  $$
  $ddl$;

  -- Was hat sich gegenueber dem Ausgangswert geaendert? null = nichts.
  execute $ddl$
  create or replace function public.notify_termin_aenderung(e public.events, p_alt jsonb)
  returns text language plpgsql stable security definer set search_path = public
  as $$
  declare
    v_teile text[] := '{}';
    v_neu   text := nullif(btrim(e.time), '');
    v_alt   text := nullif(btrim(p_alt->>'time'), '');
  begin
    if coalesce((p_alt->>'wieder')::boolean, false) then
      return 'Findet doch statt';
    end if;
    if (p_alt->>'date')::date is distinct from e.date then
      v_teile := v_teile || ('Verlegt vom ' || public.notify_datum_kurz((p_alt->>'date')::date)
                             || ' auf ' || public.notify_datum_kurz(e.date));
    end if;
    if v_alt is distinct from v_neu then
      v_teile := v_teile || ((case when e.type = 'spiel' then 'Anstoß' else 'Beginn' end) || ' jetzt ' ||
        case when v_neu is not null and v_alt is not null then v_neu || ' statt ' || v_alt || ' Uhr'
             else coalesce(v_neu || ' Uhr', 'ganztägig') || ' statt ' || coalesce(v_alt || ' Uhr', 'ganztägig') end);
    end if;
    if (p_alt->>'ort') is distinct from public.notify_termin_ort(e) then
      v_teile := v_teile || ('Ort: ' || public.notify_termin_ort(e));
    end if;
    return nullif(array_to_string(v_teile, '; '), '');
  end;
  $$
  $ddl$;

  -- --------------------------------------------------------------------------
  -- 2) Erzeuger: Trigger auf events
  -- --------------------------------------------------------------------------
  execute $ddl$
  create or replace function public.notify_events_ereignis()
  returns trigger language plpgsql security definer set search_path = public
  as $$
  declare
    v_uid    uuid := auth.uid();
    v_bfv    boolean;
    v_wer    text;
    v_ab10   timestamptz;
    v_neu_offen boolean;
    v_n      integer;
    r        record;
  begin
    begin
      if tg_op = 'DELETE' then
        delete from public.notification_sammler
         where kategorie in ('termin_neu', 'termin_geaendert') and daten->>'event_id' = old.id::text;
        return null;
      end if;

      v_bfv := v_uid is null and new.quelle = 'bfv';
      v_wer := case when v_uid is not null then 'nutzer:' || v_uid::text
                    when new.quelle = 'bfv' then 'bfv' else 'system' end;

      if tg_op = 'INSERT' then
        if new.status = 'geplant' and new.starts_at > now() then
          for r in select a.profile_id from public.notify_profile_alle_spieler(false) a loop
            perform public.notify_sammeln('termin_neu', v_wer, r.profile_id, v_uid,
              jsonb_build_object('event_id', new.id),
              case when v_bfv then public.notify_nicht_vor_acht(now() + interval '2 minutes')
                   else now() + interval '30 minutes' end);
          end loop;
        end if;
        return null;
      end if;

      -- UPDATE: nur kuenftige Termine
      if new.starts_at is null or new.starts_at <= now() then return null; end if;
      v_neu_offen := exists (select 1 from public.notification_sammler
                              where kategorie = 'termin_neu' and daten->>'event_id' = new.id::text);
      v_ab10 := case when v_bfv then public.notify_nicht_vor_acht(now() + interval '10 minutes')
                     else now() + interval '10 minutes' end;

      if old.status = 'geplant' and new.status = 'abgesagt' then
        delete from public.notification_sammler
         where kategorie in ('termin_neu', 'termin_geaendert') and daten->>'event_id' = new.id::text;
        if not v_neu_offen then
          for r in select a.profile_id from public.notify_profile_spieler_am(new.date) a loop
            if public.notify_empfaenger_ok('termin_abgesagt', r.profile_id, v_uid) then
              perform public.notify_enqueue(r.profile_id, 'termin_abgesagt',
                jsonb_build_object(
                  'termin_titel', public.notify_termin_titel(new.id),
                  'datum',        public.notify_datum_lang(new.date),
                  'uhrzeit',      coalesce(public.notify_uhrzeit(new.time), 'ganztägig'),
                  'termin_id',    new.id::text),
                p_dedup      => 'termin_abgesagt:' || new.id || ':' || r.profile_id || ':' || new.ical_seq,
                p_not_before => case when v_bfv then greatest(now() + interval '2 minutes', public.notify_nicht_vor_acht(now()))
                                     else now() + interval '2 minutes' end,
                p_ttl_bis    => new.starts_at);
            end if;
          end loop;
        end if;

      elsif old.status = 'abgesagt' and new.status = 'geplant' then
        -- Absage noch nicht raus: still zuruecknehmen. Sonst "Findet doch statt".
        with weg as (
          delete from public.notification_outbox o
           where o.kategorie = 'termin_abgesagt' and o.sent_at is null and o.claimed_at is null
             and o.dedup_key like 'termin_abgesagt:' || new.id || ':%'
          returning 1)
        select count(*) into v_n from weg;
        if v_n = 0 then
          for r in select a.profile_id from public.notify_profile_spieler_am(new.date) a loop
            perform public.notify_sammeln('termin_geaendert', v_wer, r.profile_id, v_uid,
              jsonb_build_object('event_id', new.id, 'wieder', true), v_ab10);
          end loop;
        end if;

      elsif old.status = 'geplant' and new.status = 'geplant' and not v_neu_offen
            and (new.date is distinct from old.date
                 or nullif(btrim(new.time), '') is distinct from nullif(btrim(old.time), '')
                 or public.notify_termin_ort(new) is distinct from public.notify_termin_ort(old)) then
        for r in select a.profile_id from public.notify_profile_spieler_am(new.date) a loop
          perform public.notify_sammeln('termin_geaendert', v_wer, r.profile_id, v_uid,
            jsonb_build_object('event_id', new.id, 'date', old.date, 'time', old.time,
                               'ort', public.notify_termin_ort(old)), v_ab10);
        end loop;
      end if;
    exception when others then
      raise warning 'notify_events_ereignis (%): % %', tg_op, sqlstate, sqlerrm;
    end;
    return null;
  end;
  $$
  $ddl$;

  execute 'drop trigger if exists trg_events_notify on public.events';
  execute 'create trigger trg_events_notify after insert or update or delete on public.events
             for each row execute function public.notify_events_ereignis()';

  -- --------------------------------------------------------------------------
  -- 3) Zusammenfassen
  -- --------------------------------------------------------------------------
  execute $ddl$
  create or replace function public.notify_flush_termin_neu()
  returns integer language plpgsql security definer set search_path = public
  as $$
  declare g record; v_ids uuid[]; v_ok uuid[]; v_n integer := 0;
  begin
    for g in
      select s.bezug, s.profile_id, min(s.faellig_ab) as ab from public.notification_sammler s
       where s.kategorie = 'termin_neu' group by s.bezug, s.profile_id having min(s.faellig_ab) <= now()
    loop
      with weg as (
        delete from public.notification_sammler s
         where s.kategorie = 'termin_neu' and s.bezug = g.bezug and s.profile_id = g.profile_id
        returning (s.daten->>'event_id')::uuid as event_id)
      select array_agg(distinct event_id) into v_ids from weg;
      continue when v_ids is null;

      select array_agg(e.id) into v_ok from public.events e
       where e.id = any(v_ids) and e.status = 'geplant' and e.starts_at > now();
      continue when v_ok is null;

      perform public.notify_enqueue(g.profile_id, 'termin_neu',
        jsonb_build_object(
          'anzahl', public.notify_anzahl(array_length(v_ok, 1), 'neuer Termin', 'neue Termine'),
          'liste',  public.notify_termin_liste(v_ok)),
        p_dedup => 'termin_neu:' || g.bezug || ':' || g.profile_id || ':' || floor(extract(epoch from g.ab))::bigint);
      v_n := v_n + 1;
    end loop;
    return v_n;
  end;
  $$
  $ddl$;

  execute $ddl$
  create or replace function public.notify_flush_termin_geaendert()
  returns integer language plpgsql security definer set search_path = public
  as $$
  declare
    g record; d jsonb; e public.events; v_txt text;
    v_daten jsonb; v_gesehen text[]; v_ids uuid[]; v_texte text[]; v_n integer := 0;
    v_erst public.events; v_bis timestamptz; v_anz integer;
  begin
    for g in
      select s.bezug, s.profile_id, min(s.faellig_ab) as ab from public.notification_sammler s
       where s.kategorie = 'termin_geaendert' group by s.bezug, s.profile_id having min(s.faellig_ab) <= now()
    loop
      with weg as (
        delete from public.notification_sammler s
         where s.kategorie = 'termin_geaendert' and s.bezug = g.bezug and s.profile_id = g.profile_id
        returning s.daten, s.erstellt_at, s.id)
      select jsonb_agg(daten order by erstellt_at, id) into v_daten from weg;
      continue when v_daten is null;

      v_gesehen := '{}'; v_ids := '{}'; v_texte := '{}'; v_bis := null; v_erst := null;
      -- je Termin zaehlt der frueheste Eintrag (Ausgangswert)
      for d in select x from jsonb_array_elements(v_daten) x loop
        continue when (d->>'event_id') = any(v_gesehen);
        v_gesehen := v_gesehen || (d->>'event_id');
        select * into e from public.events where id = (d->>'event_id')::uuid;
        continue when e.id is null or e.status <> 'geplant' or e.starts_at <= now();
        v_txt := public.notify_termin_aenderung(e, d);
        continue when v_txt is null;
        v_ids := v_ids || e.id; v_texte := v_texte || v_txt;
        v_bis := greatest(v_bis, e.starts_at);
        if v_erst.id is null or e.starts_at < v_erst.starts_at then v_erst := e; end if;
      end loop;
      v_anz := coalesce(array_length(v_ids, 1), 0);
      continue when v_anz = 0;

      perform public.notify_enqueue(g.profile_id, 'termin_geaendert',
        case when v_anz = 1 then jsonb_build_object(
               'termin_titel', public.notify_termin_titel(v_erst.id),
               'datum',        public.notify_datum_lang(v_erst.date),
               'aenderung',    v_texte[1],
               'termin_id',    v_erst.id::text)
             else jsonb_build_object(
               'termin_titel', public.notify_anzahl(v_anz, 'Termin', 'Termine'),
               'datum',        'ab ' || public.notify_datum_lang(v_erst.date),
               'aenderung',    case when (select count(distinct t) from unnest(v_texte) t) = 1 then v_texte[1]
                                    else public.notify_termin_liste(v_ids) end,
               'termin_id',    v_erst.id::text)
        end,
        p_dedup   => 'termin_geaendert:' || g.bezug || ':' || g.profile_id || ':' || floor(extract(epoch from g.ab))::bigint,
        p_ttl_bis => v_bis);
      v_n := v_n + 1;
    end loop;
    return v_n;
  end;
  $$
  $ddl$;

  -- --------------------------------------------------------------------------
  -- 4) Rechte
  -- --------------------------------------------------------------------------
  revoke execute on function public.notify_spieler_faellt_aus_am(uuid, date)       from public, anon, authenticated;
  revoke execute on function public.notify_profile_spieler_am(date)                from public, anon, authenticated;
  revoke execute on function public.notify_termin_ort(public.events)               from public, anon, authenticated;
  revoke execute on function public.notify_termin_liste(uuid[])                    from public, anon, authenticated;
  revoke execute on function public.notify_termin_aenderung(public.events, jsonb)  from public, anon, authenticated;
  revoke execute on function public.notify_events_ereignis()                       from public, anon, authenticated;
  revoke execute on function public.notify_flush_termin_neu()                      from public, anon, authenticated;
  revoke execute on function public.notify_flush_termin_geaendert()                from public, anon, authenticated;

  -- --------------------------------------------------------------------------
  -- 5) Vorlage termin_neu (T7)
  -- --------------------------------------------------------------------------
  update public.notification_templates
     set titel_vorlage = '📅 {anzahl}',
         text_vorlage  = 'Jetzt zu- oder absagen: {liste}',
         beispiel_daten = beispiel_daten || '{"anzahl":"3 neue Termine"}'::jsonb,
         updated_at = now()
   where kategorie = 'termin_neu'
     and titel_vorlage = '📅 {anzahl} neue Termine' and text_vorlage = '{liste}. Jetzt zu- oder absagen.';

  -- --------------------------------------------------------------------------
  -- Gegenprobe
  -- --------------------------------------------------------------------------
  select array_agg(p.oid::regprocedure::text) into v_x
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname like 'notify\_%' and p.proname <> 'notify_enqueue'
     and (has_function_privilege('anon', p.oid, 'execute')
          or has_function_privilege('authenticated', p.oid, 'execute')
          or exists (select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a where a.grantee = 0));
  if v_x is not null then v_fehl := v_fehl || ('von außen ausführbar: ' || array_to_string(v_x, ', ')); end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_events_notify' and tgrelid = 'public.events'::regclass) then
    v_fehl := v_fehl || 'Trigger trg_events_notify fehlt'::text;
  end if;
  if exists (select 1 from public.notification_templates where kategorie = 'termin_neu' and titel_vorlage <> '📅 {anzahl}') then
    v_fehl := v_fehl || 'Vorlage termin_neu nicht ersetzt'::text;
  end if;

  select p.id, pl.club_id into v_prof, v_club from public.profiles p join public.players pl on pl.id = p.player_id limit 1;
  if v_prof is null then
    v_fehl := v_fehl || 'kein Profil mit Spieler für die Gegenprobe'::text;
  else
    begin
      -- neu: Sammler, 30 Minuten, zusammengefasst
      insert into public.events (club_id, type, title, date, time, status, quelle)
      values (v_club, 'training', 'Gegenprobe', current_date + 40, '19:00', 'geplant', 'manuell') returning id into v_ev;
      select count(*), min(faellig_ab) into v_n, v_ab from public.notification_sammler
       where kategorie = 'termin_neu' and profile_id = v_prof and daten->>'event_id' = v_ev::text;
      if v_n <> 1 or v_ab < now() + interval '29 minutes' or v_ab > now() + interval '31 minutes' then
        v_fehl := v_fehl || ('termin_neu: Sammler ' || v_n);
      end if;
      update public.notification_sammler set faellig_ab = now() - interval '1 second' where erstellt_at >= now();
      perform public.notify_flush_termin_neu();
      select max(titel || ' | ' || text) into v_t from public.notification_outbox
       where kategorie = 'termin_neu' and profile_id = v_prof and created_at >= now();
      if v_t is distinct from '📅 1 neuer Termin | Jetzt zu- oder absagen: Gegenprobe ' || public.notify_datum_kurz(current_date + 40) then
        v_fehl := v_fehl || ('termin_neu: Text ' || coalesce(v_t, '-'));
      end if;

      -- geaendert: Uhrzeit, 10 Minuten, Text
      update public.events set time = '20:00' where id = v_ev;
      select count(*) into v_n from public.notification_sammler
       where kategorie = 'termin_geaendert' and profile_id = v_prof and daten->>'event_id' = v_ev::text;
      if v_n <> 1 then v_fehl := v_fehl || ('termin_geaendert: Sammler ' || v_n); end if;
      update public.notification_sammler set faellig_ab = now() - interval '1 second' where erstellt_at >= now();
      perform public.notify_flush_termin_geaendert();
      select max(titel || ' | ' || text) into v_t from public.notification_outbox
       where kategorie = 'termin_geaendert' and profile_id = v_prof and created_at >= now();
      if v_t is distinct from '📅 Gegenprobe geändert | ' || public.notify_datum_lang(current_date + 40) || ': Beginn jetzt 20:00 statt 19:00 Uhr' then
        v_fehl := v_fehl || ('termin_geaendert: Text ' || coalesce(v_t, '-'));
      end if;

      -- abgesagt: direkt, 2 Minuten Karenz; findet statt davor: zurueckgenommen
      update public.events set status = 'abgesagt' where id = v_ev;
      select count(*), min(not_before) into v_n, v_ab from public.notification_outbox
       where kategorie = 'termin_abgesagt' and profile_id = v_prof and dedup_key like 'termin_abgesagt:' || v_ev || ':%';
      if v_n <> 1 or v_ab < now() + interval '110 seconds' or v_ab > now() + interval '130 seconds' then
        v_fehl := v_fehl || ('termin_abgesagt: ' || v_n);
      end if;
      update public.events set status = 'geplant' where id = v_ev;
      select count(*) into v_n from public.notification_outbox
       where kategorie = 'termin_abgesagt' and dedup_key like 'termin_abgesagt:' || v_ev || ':%';
      if v_n <> 0 then v_fehl := v_fehl || 'termin_abgesagt: Findet statt nimmt die Absage nicht zurück'::text; end if;

      raise exception using errcode = 'P0046', message = 'zurückrollen';
    exception when sqlstate 'P0046' then null;
    end;
  end if;

  if array_length(v_fehl, 1) > 0 then
    raise exception 'Gegenprobe 0046 fehlgeschlagen: %', v_fehl;
  end if;
  raise notice 'Gegenprobe 0046 bestanden.';
end
$migration$;

commit;

-- RUECKBAU (nicht automatisch), als ein do-Block:
-- do $$ begin
--   drop trigger if exists trg_events_notify on public.events;
--   drop function if exists public.notify_flush_termin_neu(), public.notify_flush_termin_geaendert(),
--     public.notify_events_ereignis(), public.notify_termin_aenderung(public.events, jsonb),
--     public.notify_termin_liste(uuid[]), public.notify_termin_ort(public.events),
--     public.notify_profile_spieler_am(date), public.notify_spieler_faellt_aus_am(uuid, date);
--   delete from public.notification_sammler where kategorie in ('termin_neu','termin_geaendert');
--   update public.notification_templates set titel_vorlage = '📅 {anzahl} neue Termine',
--     text_vorlage = '{liste}. Jetzt zu- oder absagen.', beispiel_daten = beispiel_daten || '{"anzahl":"3"}'
--    where kategorie = 'termin_neu' and titel_vorlage = '📅 {anzahl}';
-- end $$;
