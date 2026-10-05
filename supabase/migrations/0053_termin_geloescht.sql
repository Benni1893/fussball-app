-- ============================================================================
-- FC Fasanerie-Nord - Migration 0053: Geloeschter kuenftiger Termin = Absage
--
-- Entscheidung 06.10.2026 (ersetzt Annahme T5): Wird ein kuenftiger, geplanter
-- Termin geloescht, bekommen die Spieler dieselbe Nachricht wie bei "Faellt
-- aus": Kategorie termin_abgesagt, gleiche Empfaenger (alle verknuepften
-- Spieler ausser Urlaub/verletzt am Termintag, ausser dem Ausloeser), gleiche
-- Verzoegerung (2 Minuten, aus dem BFV-Sync fruehestens 08:00), gueltig bis
-- zum geplanten Beginn. Vergangene oder schon abgesagte Termine: still.
-- Steht die Neu-Meldung noch aus (T9): still.
--
-- Hinweis Cascade: rsvps verschwinden mit dem Termin. Die Empfaengerregel der
-- Absage nutzt keine Rueckmeldungen, nur Profile und Spielerstatus (beide
-- bleiben); die Texte kommen aus der alten Zeile (old), nicht aus events.
--
-- notify_events_ereignis wie in 0047, nur der DELETE-Zweig ist neu.
-- Aufbau: EIN do-Block (conventions.md).
-- ============================================================================

begin;

do $migration$
declare
  v_fehl text[] := '{}';
  v_club uuid; v_prof uuid; v_player uuid; v_ev uuid; v_n integer; v_t text; v_ab timestamptz;
  v_rechte text;
begin
  select coalesce(proacl::text, '-') into v_rechte from pg_proc where oid = 'public.notify_events_ereignis()'::regprocedure;

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
          for r in select a.profile_id from public.notify_profile_spieler_am(old.date) a loop
            if public.notify_empfaenger_ok('termin_abgesagt', r.profile_id, v_uid) then
              perform public.notify_enqueue(r.profile_id, 'termin_abgesagt',
                jsonb_build_object(
                  'termin_titel', case when old.type = 'spiel' then coalesce(nullif(old.opponent, ''), old.title) else old.title end,
                  'datum',        public.notify_datum_lang(old.date),
                  'uhrzeit',      coalesce(public.notify_uhrzeit(old.time), 'ganztägig'),
                  'termin_id',    old.id::text),
                p_dedup      => 'termin_abgesagt:' || old.id || ':' || r.profile_id || ':' || old.ical_seq || ':geloescht',
                p_not_before => case when v_bfv then greatest(now() + interval '2 minutes', public.notify_nicht_vor_acht(now()))
                                     else now() + interval '2 minutes' end,
                p_ttl_bis    => old.starts_at);
            end if;
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

  revoke execute on function public.notify_events_ereignis() from public, anon, authenticated;

  -- Gegenprobe
  if (select coalesce(proacl::text, '-') from pg_proc where oid = 'public.notify_events_ereignis()'::regprocedure) is distinct from v_rechte then
    v_fehl := v_fehl || 'Rechte verändert'::text;
  end if;
  select p.id, p.player_id, pl.club_id into v_prof, v_player, v_club
    from public.profiles p join public.players pl on pl.id = p.player_id limit 1;
  begin
    delete from public.player_status where player_id = v_player;
    -- kuenftig, mit Rueckmeldung (Cascade): Absage-Nachricht aus der alten Zeile
    insert into public.events (club_id, type, title, date, time, status, quelle, auto_fine)
    values (v_club, 'training', 'Gegenprobe', current_date + 9, '19:00', 'geplant', 'manuell', false) returning id into v_ev;
    delete from public.notification_sammler where erstellt_at >= now();
    insert into public.rsvps (club_id, event_id, player_id, status) values (v_club, v_ev, v_player, 'zu');
    delete from public.events where id = v_ev;
    select count(*), max(titel || ' | ' || text), min(not_before) into v_n, v_t, v_ab from public.notification_outbox
     where kategorie = 'termin_abgesagt' and profile_id = v_prof and dedup_key like 'termin_abgesagt:' || v_ev || ':%';
    if v_n <> 1 or v_t is distinct from '❌ Gegenprobe fällt aus | ' || public.notify_datum_lang(current_date + 9) || ' 19:00 Uhr.'
       or v_ab < now() + interval '110 seconds' or v_ab > now() + interval '130 seconds' then
      v_fehl := v_fehl || ('künftig gelöscht: ' || v_n || ' / ' || coalesce(v_t, '-'));
    end if;
    -- vergangen: still
    insert into public.events (club_id, type, title, date, time, status, quelle, auto_fine)
    values (v_club, 'training', 'Gegenprobe', current_date - 2, '19:00', 'geplant', 'manuell', false) returning id into v_ev;
    delete from public.events where id = v_ev;
    if exists (select 1 from public.notification_outbox where dedup_key like 'termin_abgesagt:' || v_ev || ':%') then
      v_fehl := v_fehl || 'vergangen gelöscht erzeugt Nachricht'::text;
    end if;
    raise exception using errcode = 'P0053', message = 'zurückrollen';
  exception when sqlstate 'P0053' then null;
  end;

  if array_length(v_fehl, 1) > 0 then
    raise exception 'Gegenprobe 0053 fehlgeschlagen: %', v_fehl;
  end if;
  raise notice 'Gegenprobe 0053 bestanden.';
end
$migration$;

commit;
