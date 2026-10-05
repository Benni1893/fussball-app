-- ============================================================================
-- FC Fasanerie-Nord - Migration 0054: Absagen buendeln (Serie loeschen, Serie
--                                     "Faellt aus")
--
-- Entscheidung 06.10.2026: Werden mehrere kuenftige Termine in einem Vorgang
-- geloescht oder abgesagt, bekommt jeder Spieler EINE Nachricht, z. B.
-- "❌ 12 Trainings ab 14.10. fallen aus" (gemischte Arten: "12 Termine ab
-- 14.10."). Regeln wie bisher: Empfaenger ohne Urlaub/verletzt am Termintag,
-- Ausloeser ausgenommen, 2 Minuten, aus dem BFV-Sync fruehestens 08:00.
--
--   1. notify_events_ereignis wie in 0053; Absage ("Faellt aus") und
--      Loeschen gehen jetzt in den Sammler (Kategorie termin_abgesagt, je
--      Ausloeser, 2 Minuten ab dem ersten). Die Daten tragen Titel, Art,
--      Datum, Uhrzeit und Beginn (der geloeschte Termin ist sonst weg).
--      "Findet statt" vor dem Zusammenfassen nimmt die Absage still zurueck.
--   2. notify_flush_termin_abgesagt: ein Termin -> Nachricht wie bisher; mehrere
--      -> "{anzahl} {Trainings|Spiele|Termine} ab {erstes Datum}" mit "fallen
--      aus", Text "{von} bis {bis} {gemeinsame Uhrzeit}.". Abgesagte zaehlen
--      nur, wenn sie beim Zusammenfassen noch abgesagt sind.
--   3. Vorlage termin_abgesagt: Titel "❌ {termin_titel} {faellt_aus}" mit
--      "fällt aus" / "fallen aus" (nur wenn der Auslieferungsstand gilt);
--      {uhrzeit} optional (mehrere Termine mit verschiedenen Uhrzeiten).
--
-- Aufbau: EIN do-Block (conventions.md).
-- ============================================================================

begin;

do $migration$
declare
  v_fehl text[] := '{}';
  v_club uuid; v_prof uuid; v_player uuid; v_serie uuid; v_ev uuid; v_n integer; v_t text;
begin
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
    v_ab2    timestamptz;
    r        record;
  begin
    begin
      if tg_op = 'DELETE' then
        -- T5 (06.10.2026): ein kuenftiger, geplanter Termin wird geloescht ->
        -- dieselbe Nachricht wie "Faellt aus". Der Termin ist hier schon weg,
        -- Texte deshalb aus der alten Zeile. Die Empfaenger haengen nicht an
        -- den Rueckmeldungen (die per Cascade verschwinden), sondern an Profil
        -- und Spielerstatus. Steht die Neu-Meldung noch aus: nichts (T9).
        v_neu_offen := exists (select 1 from public.notification_sammler
                                where kategorie = 'termin_neu' and daten->>'event_id' = old.id::text);
        delete from public.notification_sammler
         where kategorie in ('termin_neu', 'termin_geaendert') and daten->>'event_id' = old.id::text;
        if old.status = 'geplant' and old.starts_at > now() and not v_neu_offen then
          v_bfv := v_uid is null and old.quelle = 'bfv';
          v_wer := case when v_uid is not null then 'nutzer:' || v_uid::text
                        when old.quelle = 'bfv' then 'bfv' else 'system' end;
          -- 0054: gesammelt je Ausloeser, 2 Minuten; mehrere Termine -> eine Nachricht.
          -- Der Termin ist gleich weg: alles Noetige steht in den Daten.
          for r in select a.profile_id from public.notify_profile_spieler_am(old.date) a loop
            perform public.notify_sammeln('termin_abgesagt', v_wer, r.profile_id, v_uid,
              jsonb_build_object('event_id', old.id, 'art', 'geloescht',
                'titel', case when old.type = 'spiel' then coalesce(nullif(old.opponent, ''), old.title) else old.title end,
                'type', old.type, 'date', old.date, 'time', old.time, 'starts_at', old.starts_at,
                'zeit', clock_timestamp()),
              case when v_bfv then greatest(now() + interval '2 minutes', public.notify_nicht_vor_acht(now()))
                   else now() + interval '2 minutes' end);
          end loop;
        end if;
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
          v_ab2 := case when v_bfv then greatest(now() + interval '2 minutes', public.notify_nicht_vor_acht(now()))
                        else now() + interval '2 minutes' end;
          for r in select a.profile_id from public.notify_profile_spieler_am(new.date) a loop
            perform public.notify_sammeln('termin_abgesagt', v_wer, r.profile_id, v_uid,
              jsonb_build_object('event_id', new.id, 'art', 'status',
                'titel', public.notify_termin_titel(new.id),
                'type', new.type, 'date', new.date, 'time', new.time, 'starts_at', new.starts_at,
                'zeit', clock_timestamp()),
              v_ab2);
          end loop;
        end if;

      elsif old.status = 'abgesagt' and new.status = 'geplant' then
        -- Absage noch nicht raus: still zuruecknehmen (gesammelt seit 0054, oder
        -- als Einzelzeile von vor 0054). Sonst "Findet doch statt".
        with weg as (
          delete from public.notification_sammler s
           where s.kategorie = 'termin_abgesagt' and s.daten->>'event_id' = new.id::text
          returning 1)
        select count(*) into v_n from weg;
        if v_n = 0 then
          with weg as (
            delete from public.notification_outbox o
             where o.kategorie = 'termin_abgesagt' and o.sent_at is null and o.claimed_at is null
               and o.dedup_key like 'termin_abgesagt:' || new.id || ':%'
            returning 1)
          select count(*) into v_n from weg;
        end if;
        if v_n = 0 then
          for r in select a.profile_id from public.notify_profile_spieler_am(new.date) a loop
            perform public.notify_sammeln('termin_geaendert', v_wer, r.profile_id, v_uid,
              jsonb_build_object('event_id', new.id, 'wieder', true, 'zeit', clock_timestamp()), v_ab10);
          end loop;
        end if;

      elsif old.status = 'geplant' and new.status = 'geplant' and not v_neu_offen
            and (new.date is distinct from old.date
                 or nullif(btrim(new.time), '') is distinct from nullif(btrim(old.time), '')
                 or public.notify_termin_ort(new) is distinct from public.notify_termin_ort(old)) then
        for r in select a.profile_id from public.notify_profile_spieler_am(new.date) a loop
          perform public.notify_sammeln('termin_geaendert', v_wer, r.profile_id, v_uid,
            jsonb_build_object('event_id', new.id, 'date', old.date, 'time', old.time,
                               'ort', public.notify_termin_ort(old), 'zeit', clock_timestamp()), v_ab10);
        end loop;
      end if;
    exception when others then
      raise warning 'notify_events_ereignis (%): % %', tg_op, sqlstate, sqlerrm;
    end;
    return null;
  end;
  $$
  $ddl$;

  execute $ddl$
  create or replace function public.notify_flush_termin_abgesagt()
  returns integer language plpgsql security definer set search_path = public
  as $$
  declare
    g record; d jsonb; v_daten jsonb; v_gesehen text[]; v_n integer := 0;
    v_liste jsonb; v_anz integer; v_erst jsonb; v_von date; v_bis date; v_zeiten text[]; v_typen text[];
    v_ende timestamptz; e public.events;
  begin
    for g in
      select s.bezug, s.profile_id, min(s.faellig_ab) as ab from public.notification_sammler s
       where s.kategorie = 'termin_abgesagt' group by s.bezug, s.profile_id having min(s.faellig_ab) <= now()
    loop
      with weg as (
        delete from public.notification_sammler s
         where s.kategorie = 'termin_abgesagt' and s.bezug = g.bezug and s.profile_id = g.profile_id
        returning s.daten, s.erstellt_at, s.id)
      select jsonb_agg(daten order by (daten->>'zeit')::timestamptz nulls first, erstellt_at, id) into v_daten from weg;
      continue when v_daten is null;

      v_gesehen := '{}'; v_liste := '[]'::jsonb;
      for d in select x from jsonb_array_elements(v_daten) x loop
        continue when (d->>'event_id') = any(v_gesehen);
        v_gesehen := v_gesehen || (d->>'event_id');
        continue when (d->>'starts_at')::timestamptz <= now();
        if d->>'art' = 'status' then
          select * into e from public.events where id = (d->>'event_id')::uuid;
          continue when e.id is null or e.status <> 'abgesagt';   -- inzwischen "Findet statt" (oder geloescht: eigener Eintrag)
        end if;
        v_liste := v_liste || jsonb_build_array(d);
      end loop;
      v_anz := jsonb_array_length(v_liste);
      continue when v_anz = 0;

      select x into v_erst from jsonb_array_elements(v_liste) x order by (x->>'starts_at')::timestamptz limit 1;
      select min((x->>'date')::date), max((x->>'date')::date), max((x->>'starts_at')::timestamptz),
             array_agg(distinct coalesce(nullif(btrim(x->>'time'), ''), '-')), array_agg(distinct x->>'type')
        into v_von, v_bis, v_ende, v_zeiten, v_typen
        from jsonb_array_elements(v_liste) x;

      perform public.notify_enqueue(g.profile_id, 'termin_abgesagt',
        case when v_anz = 1 then jsonb_build_object(
               'termin_titel', v_erst->>'titel',
               'faellt_aus',   'fällt aus',
               'datum',        public.notify_datum_lang((v_erst->>'date')::date),
               'uhrzeit',      coalesce(public.notify_uhrzeit(v_erst->>'time'), 'ganztägig'),
               'termin_id',    v_erst->>'event_id')
             else jsonb_build_object(
               'termin_titel', v_anz || ' ' ||
                 case when v_typen = array['training'] then 'Trainings'
                      when v_typen = array['spiel'] then 'Spiele'
                      else 'Termine' end
                 || ' ab ' || public.notify_datum_kurz(v_von),
               'faellt_aus',   'fallen aus',
               'datum',        case when v_von = v_bis then public.notify_datum_lang(v_von)
                                    else public.notify_datum_kurz(v_von) || ' bis ' || public.notify_datum_lang(v_bis) end,
               'uhrzeit',      case when array_length(v_zeiten, 1) = 1 and v_zeiten[1] <> '-' then public.notify_uhrzeit(v_zeiten[1]) end,
               'termin_id',    v_erst->>'event_id')
        end,
        p_dedup   => 'termin_abgesagt:' || g.bezug || ':' || g.profile_id || ':' || floor(extract(epoch from g.ab))::bigint,
        p_ttl_bis => v_ende);
      v_n := v_n + 1;
    end loop;
    return v_n;
  end;
  $$
  $ddl$;

  revoke execute on function public.notify_events_ereignis()        from public, anon, authenticated;
  revoke execute on function public.notify_flush_termin_abgesagt()  from public, anon, authenticated;

  -- Vorlage
  update public.notification_templates
     set titel_vorlage = '❌ {termin_titel} {faellt_aus}', updated_at = now()
   where kategorie = 'termin_abgesagt' and titel_vorlage = '❌ {termin_titel} fällt aus';
  update public.notification_templates
     set platzhalter = array['termin_titel','faellt_aus','datum','uhrzeit','grund','termin_id'],
         platzhalter_optional = array['grund','uhrzeit'],
         beispiel_daten = beispiel_daten || '{"faellt_aus":"fällt aus"}'::jsonb
   where kategorie = 'termin_abgesagt';

  -- --------------------------------------------------------------------------
  -- Gegenprobe
  -- --------------------------------------------------------------------------
  if has_function_privilege('authenticated', 'public.notify_flush_termin_abgesagt()', 'execute') then
    v_fehl := v_fehl || 'Rechte'::text;
  end if;
  if not exists (select 1 from public.notification_templates where kategorie = 'termin_abgesagt' and titel_vorlage = '❌ {termin_titel} {faellt_aus}') then
    v_fehl := v_fehl || 'Vorlage'::text;
  end if;
  select p.id, p.player_id, pl.club_id into v_prof, v_player, v_club
    from public.profiles p join public.players pl on pl.id = p.player_id limit 1;
  begin
    delete from public.player_status where player_id = v_player;
    v_serie := gen_random_uuid();
    insert into public.events (club_id, type, title, date, time, status, quelle, auto_fine, serie_id)
    select v_club, 'training', 'Gegenprobe', current_date + 10 + 7 * i, '19:00', 'geplant', 'manuell', false, v_serie
      from generate_series(0, 2) i;
    delete from public.notification_sammler where erstellt_at >= now();
    -- Serie geloescht: eine Nachricht
    delete from public.events where serie_id = v_serie;
    update public.notification_sammler set faellig_ab = now() - interval '1 second' where erstellt_at >= now();
    perform public.notify_flush_termin_abgesagt();
    select count(*), max(titel || ' | ' || text) into v_n, v_t from public.notification_outbox
     where kategorie = 'termin_abgesagt' and profile_id = v_prof and created_at >= now();
    if v_n <> 1 or v_t is distinct from '❌ 3 Trainings ab ' || public.notify_datum_kurz(current_date + 10) || ' fallen aus | '
         || public.notify_datum_kurz(current_date + 10) || ' bis ' || public.notify_datum_lang(current_date + 24) || ' 19:00 Uhr.' then
      v_fehl := v_fehl || ('Serie gelöscht: ' || v_n || ' / ' || coalesce(v_t, '-'));
    end if;
    -- einzelner Termin "Faellt aus": wie bisher
    -- gleiche Transaktion = gleiche Faelligkeit = gleicher dedup_key: erste Zeile wegraeumen
    delete from public.notification_outbox where kategorie = 'termin_abgesagt' and created_at >= now();
    insert into public.events (club_id, type, title, date, time, status, quelle, auto_fine)
    values (v_club, 'training', 'Gegenprobe B', current_date + 5, '18:00', 'geplant', 'manuell', false) returning id into v_ev;
    delete from public.notification_sammler where erstellt_at >= now();
    update public.events set status = 'abgesagt' where id = v_ev;
    update public.notification_sammler set faellig_ab = now() - interval '1 second' where erstellt_at >= now();
    perform public.notify_flush_termin_abgesagt();
    select max(titel || ' | ' || text) into v_t from public.notification_outbox
     where kategorie = 'termin_abgesagt' and profile_id = v_prof and created_at >= now() and titel like '%Gegenprobe B%';
    if v_t is distinct from '❌ Gegenprobe B fällt aus | ' || public.notify_datum_lang(current_date + 5) || ' 18:00 Uhr.' then
      v_fehl := v_fehl || ('einzeln: ' || coalesce(v_t, '-'));
    end if;
    raise exception using errcode = 'P0054', message = 'zurückrollen';
  exception when sqlstate 'P0054' then null;
  end;

  if array_length(v_fehl, 1) > 0 then
    raise exception 'Gegenprobe 0054 fehlgeschlagen: %', v_fehl;
  end if;
  raise notice 'Gegenprobe 0054 bestanden.';
end
$migration$;

commit;
