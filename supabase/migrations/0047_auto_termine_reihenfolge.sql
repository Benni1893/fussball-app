-- ============================================================================
-- FC Fasanerie-Nord - Migration 0047: AM3 Korrektur, Reihenfolge der Aenderungen
--
-- Befund aus supabase/checks/0046_termine_pruef.sql (Fall "hin und zurueck"):
-- notify_flush_termin_geaendert nimmt je Termin den fruehesten Sammler-Eintrag
-- als Ausgangswert und sortiert nach erstellt_at. Zwei Aenderungen in DERSELBEN
-- Transaktion haben dasselbe erstellt_at (now()); die Reihenfolge war dann
-- zufaellig, der Zwischenstand konnte als Ausgangswert gelten.
--
-- Korrektur: der Trigger legt in daten zusaetzlich 'zeit' = clock_timestamp()
-- ab, das Zusammenfassen sortiert zuerst danach. Sonst unveraendert (beide
-- Funktionen wie in 0046). Bereits gesammelte Eintraege ohne 'zeit' kommen
-- zuerst (nulls first) - wie bisher.
--
-- Aufbau: EIN do-Block (conventions.md).
-- ============================================================================

begin;

do $migration$
declare
  v_fehl text[] := '{}';
  v_club uuid; v_prof uuid; v_ev uuid; v_t text;
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
      select jsonb_agg(daten order by (daten->>'zeit')::timestamptz nulls first, erstellt_at, id) into v_daten from weg;
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

  revoke execute on function public.notify_events_ereignis()        from public, anon, authenticated;
  revoke execute on function public.notify_flush_termin_geaendert() from public, anon, authenticated;

  -- Gegenprobe: hin und zurueck in einer Transaktion -> nichts; einmal -> Text.
  select p.id, pl.club_id into v_prof, v_club from public.profiles p join public.players pl on pl.id = p.player_id limit 1;
  begin
    insert into public.events (club_id, type, title, date, time, status, quelle)
    values (v_club, 'training', 'Gegenprobe', current_date + 40, '19:00', 'geplant', 'manuell') returning id into v_ev;
    delete from public.notification_sammler where erstellt_at >= now();
    update public.events set time = '20:00' where id = v_ev;
    update public.events set time = '19:00' where id = v_ev;
    update public.notification_sammler set faellig_ab = now() - interval '1 second' where erstellt_at >= now();
    perform public.notify_flush_termin_geaendert();
    if exists (select 1 from public.notification_outbox where kategorie = 'termin_geaendert' and created_at >= now()) then
      v_fehl := v_fehl || 'hin und zurück erzeugt eine Nachricht'::text;
    end if;
    update public.events set time = '20:00' where id = v_ev;
    update public.events set time = '21:00' where id = v_ev;
    update public.notification_sammler set faellig_ab = now() - interval '1 second' where erstellt_at >= now();
    perform public.notify_flush_termin_geaendert();
    select max(text) into v_t from public.notification_outbox where kategorie = 'termin_geaendert' and profile_id = v_prof and created_at >= now();
    if v_t is distinct from public.notify_datum_lang(current_date + 40) || ': Beginn jetzt 21:00 statt 19:00 Uhr' then
      v_fehl := v_fehl || ('zweimal geändert: ' || coalesce(v_t, '-'));
    end if;
    raise exception using errcode = 'P0047', message = 'zurückrollen';
  exception when sqlstate 'P0047' then null;
  end;
  if has_function_privilege('authenticated', 'public.notify_flush_termin_geaendert()', 'execute') then
    v_fehl := v_fehl || 'Rechte'::text;
  end if;

  if array_length(v_fehl, 1) > 0 then
    raise exception 'Gegenprobe 0047 fehlgeschlagen: %', v_fehl;
  end if;
  raise notice 'Gegenprobe 0047 bestanden.';
end
$migration$;

commit;
