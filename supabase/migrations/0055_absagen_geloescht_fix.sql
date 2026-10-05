-- ============================================================================
-- FC Fasanerie-Nord - Migration 0055: Korrektur zu 0054
--
-- Befund aus supabase/checks/0053_termin_geloescht_pruef.sql (Fall "schon
-- abgesagt, dann geloescht"): Wird ein Termin auf "Faellt aus" gesetzt und
-- innerhalb der 2 Minuten geloescht, verwarf notify_flush_termin_abgesagt den
-- gesammelten Eintrag, weil der Termin fehlte; der Loesch-Zweig erzeugt fuer
-- einen schon abgesagten Termin bewusst keinen zweiten. Ergebnis: gar keine
-- Nachricht. Korrektur: ein abgesagter Eintrag zaehlt auch, wenn der Termin
-- inzwischen geloescht ist; nur "Findet statt" (Termin wieder geplant)
-- verwirft ihn. Sonst unveraendert wie 0054.
-- Aufbau: EIN do-Block (conventions.md).
-- ============================================================================

begin;

do $migration$
declare
  v_fehl text[] := '{}';
  v_club uuid; v_prof uuid; v_player uuid; v_ev uuid; v_n integer;
begin
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
          -- inzwischen "Findet statt": weg. Abgesagt und danach geloescht: zaehlt weiter (0055).
          continue when e.id is not null and e.status <> 'abgesagt';
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

  revoke execute on function public.notify_flush_termin_abgesagt() from public, anon, authenticated;

  -- Gegenprobe: abgesagt, dann geloescht -> eine Nachricht
  select p.id, p.player_id, pl.club_id into v_prof, v_player, v_club
    from public.profiles p join public.players pl on pl.id = p.player_id limit 1;
  begin
    delete from public.player_status where player_id = v_player;
    insert into public.events (club_id, type, title, date, time, status, quelle, auto_fine)
    values (v_club, 'training', 'Gegenprobe', current_date + 6, '19:00', 'geplant', 'manuell', false) returning id into v_ev;
    delete from public.notification_sammler where erstellt_at >= now();
    update public.events set status = 'abgesagt' where id = v_ev;
    delete from public.events where id = v_ev;
    update public.notification_sammler set faellig_ab = now() - interval '1 second' where erstellt_at >= now();
    perform public.notify_flush_termin_abgesagt();
    select count(*) into v_n from public.notification_outbox
     where kategorie = 'termin_abgesagt' and profile_id = v_prof and created_at >= now() and titel = '❌ Gegenprobe fällt aus';
    if v_n <> 1 then v_fehl := v_fehl || ('abgesagt, dann gelöscht: ' || v_n); end if;
    raise exception using errcode = 'P0055', message = 'zurückrollen';
  exception when sqlstate 'P0055' then null;
  end;
  if has_function_privilege('authenticated', 'public.notify_flush_termin_abgesagt()', 'execute') then
    v_fehl := v_fehl || 'Rechte'::text;
  end if;

  if array_length(v_fehl, 1) > 0 then
    raise exception 'Gegenprobe 0055 fehlgeschlagen: %', v_fehl;
  end if;
  raise notice 'Gegenprobe 0055 bestanden.';
end
$migration$;

commit;
