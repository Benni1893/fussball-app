-- ============================================================================
-- FC Fasanerie-Nord - Migration 0052: Strafhinweis in der Erinnerung nur bei
--                                     Terminen mit Auto-Strafe
--
-- Wunsch 06.10.2026: "Ohne Antwort wird's teuer." nur bei Terminen mit
-- Auto-Strafe (BFV-Spiele haben keine). Geloest ueber den optionalen
-- Platzhalter {strafhinweis}; der Admin pflegt den Text der Erinnerung weiter
-- auf der Seite Push-Texte (der Platzhalter erscheint dort als Baustein).
--
--   1. Vorlage rueckmeldung_erinnerung: {strafhinweis} als optionaler
--      Platzhalter, im Text an Stelle des festen Satzes (nur wenn der Text
--      noch dem Auslieferungsstand entspricht). Beispieldaten: strafhinweis =
--      "Ohne Antwort wird's teuer." - zugleich der Wortlaut, den der Versand
--      einsetzt (eine Quelle fuer Vorschau und Versand).
--   2. notify_cron_rueckmeldung wie in 0048, dazu 'strafhinweis': bei
--      auto_fine der Wortlaut, sonst leer. Leer faellt der Satz samt Abstand
--      weg (render_vorlage raeumt auf).
--
-- RECHTE unveraendert (create or replace). Aufbau: EIN do-Block.
-- ============================================================================

begin;

do $migration$
declare
  v_fehl text[] := '{}';
  v_club uuid; v_prof uuid; v_player uuid; v_ev uuid; v_t text; v_start timestamptz;
  v_rechte text;
begin
  select coalesce(proacl::text, '-') into v_rechte from pg_proc where oid = 'public.notify_cron_rueckmeldung()'::regprocedure;

  update public.notification_templates
     set platzhalter = array['termin_titel','datum','uhrzeit','meldeschluss','strafhinweis','termin_id'],
         platzhalter_optional = array['strafhinweis'],
         text_vorlage = '{datum} {uhrzeit} · Meldeschluss {meldeschluss}. {strafhinweis}',
         beispiel_daten = beispiel_daten || jsonb_build_object('strafhinweis', 'Ohne Antwort wird''s teuer.'),
         updated_at = now()
   where kategorie = 'rueckmeldung_erinnerung'
     and text_vorlage = '{datum} {uhrzeit} · Meldeschluss {meldeschluss}. Ohne Antwort wird''s teuer.';
  -- Hat der Admin den Text schon geaendert: Platzhalter trotzdem verfuegbar machen.
  update public.notification_templates
     set platzhalter = array['termin_titel','datum','uhrzeit','meldeschluss','strafhinweis','termin_id'],
         platzhalter_optional = array['strafhinweis'],
         beispiel_daten = beispiel_daten || jsonb_build_object('strafhinweis', 'Ohne Antwort wird''s teuer.')
   where kategorie = 'rueckmeldung_erinnerung' and not ('strafhinweis' = any(platzhalter));

  execute $ddl$
  create or replace function public.notify_cron_rueckmeldung()
  returns integer language plpgsql security definer set search_path = public
  as $$
  declare
    e record; p record; v_n integer := 0; v_stufe text; v_id uuid;
    v_hinweis text;
    v_zu integer; v_ab integer; v_offen integer;
  begin
    -- Wortlaut des Strafhinweises aus den Beispieldaten der Vorlage (eine Quelle
    -- fuer Vorschau und Versand); leer bei Terminen ohne Auto-Strafe.
    select coalesce(nullif(btrim(t.beispiel_daten->>'strafhinweis'), ''), 'Ohne Antwort wird''s teuer.')
      into v_hinweis from public.notification_templates t where t.kategorie = 'rueckmeldung_erinnerung';

    -- Erinnerung an Spieler ohne Rueckmeldung
    for e in
      select ev.*, case when ev.deadline_at <= now() + interval '2 hours' then '2' else '24' end as stufe
        from public.events ev
       where ev.status = 'geplant' and ev.type in ('spiel', 'training')
         and ev.deadline_at is not null and ev.starts_at > now()
         and (ev.deadline_at > now() and ev.deadline_at <= now() + interval '2 hours'
              or ev.deadline_at > now() + interval '22 hours' and ev.deadline_at <= now() + interval '24 hours')
    loop
      for p in
        select a.profile_id from public.notify_profile_spieler_am(e.date) a
         where not exists (select 1 from public.rsvps r where r.event_id = e.id and r.player_id = a.player_id)
      loop
        v_id := public.notify_enqueue(p.profile_id, 'rueckmeldung_erinnerung',
          jsonb_build_object(
            'termin_titel', public.notify_termin_titel(e.id),
            'datum',        public.notify_datum_kurz(e.date),
            'uhrzeit',      coalesce(public.notify_uhrzeit(e.time), 'ganztägig'),
            'meldeschluss', public.notify_meldeschluss_text(e.deadline_at),
            'strafhinweis', case when e.auto_fine then v_hinweis else '' end,
            'termin_id',    e.id::text),
          p_dedup   => 'erinnerung:' || e.id || ':' || p.profile_id || ':' || e.stufe,
          p_ttl_bis => e.deadline_at);
        if v_id is not null then v_n := v_n + 1; end if;
      end loop;
    end loop;

    -- Uebersicht nach Meldeschluss an die Trainer
    for e in
      select ev.* from public.events ev
       where ev.status = 'geplant' and ev.type in ('spiel', 'training')
         and ev.deadline_at is not null and ev.starts_at > now()
         and ev.deadline_at <= now() and ev.deadline_at > now() - interval '1 hour'
    loop
      select count(*) filter (where r.status = 'zu'), count(*) filter (where r.status = 'ab')
        into v_zu, v_ab from public.rsvps r where r.event_id = e.id;
      select count(*) into v_offen from public.players pl
       where pl.club_id = e.club_id
         and not exists (select 1 from public.rsvps r where r.event_id = e.id and r.player_id = pl.id)
         and not public.notify_spieler_faellt_aus_am(pl.id, e.date);
      for p in select t.uid as profile_id from public.notify_profile_mit_rolle('coach') as t(uid) loop
        v_id := public.notify_enqueue(p.profile_id, 'meldeschluss_uebersicht',
          jsonb_build_object(
            'termin_titel', public.notify_termin_titel(e.id),
            'datum',        public.notify_datum_kurz(e.date),
            'uhrzeit',      coalesce(public.notify_uhrzeit(e.time), 'ganztägig'),
            'zusagen', v_zu::text, 'absagen', v_ab::text, 'offen', v_offen::text,
            'termin_id',    e.id::text),
          p_dedup   => 'meldeschluss:' || e.id || ':' || p.profile_id,
          p_ttl_bis => e.starts_at);
        if v_id is not null then v_n := v_n + 1; end if;
      end loop;
    end loop;
    return v_n;
  end;
  $$
  $ddl$;

  revoke execute on function public.notify_cron_rueckmeldung() from public, anon, authenticated;

  -- Gegenprobe
  if (select coalesce(proacl::text, '-') from pg_proc where oid = 'public.notify_cron_rueckmeldung()'::regprocedure) is distinct from v_rechte then
    v_fehl := v_fehl || 'Rechte verändert'::text;
  end if;
  if not exists (select 1 from public.notification_templates where kategorie = 'rueckmeldung_erinnerung'
                  and 'strafhinweis' = any(platzhalter) and 'strafhinweis' = any(platzhalter_optional)) then
    v_fehl := v_fehl || 'Platzhalter fehlt'::text;
  end if;

  select p.id, p.player_id, pl.club_id into v_prof, v_player, v_club
    from public.profiles p join public.players pl on pl.id = p.player_id limit 1;
  begin
    delete from public.player_status where player_id = v_player;
    v_start := date_trunc('minute', now() + interval '26 hours');
    -- mit Auto-Strafe
    insert into public.events (club_id, type, title, date, time, status, quelle, auto_fine)
    values (v_club, 'training', 'Gegenprobe', (v_start at time zone 'Europe/Berlin')::date,
            to_char(v_start at time zone 'Europe/Berlin', 'HH24:MI'), 'geplant', 'manuell', true) returning id into v_ev;
    perform public.notify_cron_rueckmeldung();
    select text into v_t from public.notification_outbox where dedup_key like 'erinnerung:' || v_ev || ':' || v_prof || ':%';
    if v_t is null or v_t not like '%Uhr. Ohne Antwort wird''s teuer.' then
      v_fehl := v_fehl || ('mit Auto-Strafe: ' || coalesce(v_t, '-'));
    end if;
    -- ohne Auto-Strafe
    update public.events set auto_fine = false, title = 'Gegenprobe B' where id = v_ev;
    delete from public.notification_outbox where dedup_key like 'erinnerung:' || v_ev || ':%';
    perform public.notify_cron_rueckmeldung();
    select text into v_t from public.notification_outbox where dedup_key like 'erinnerung:' || v_ev || ':' || v_prof || ':%';
    if v_t is null or v_t like '%teuer%' or v_t not like '%Meldeschluss morgen __:__ Uhr.' then
      v_fehl := v_fehl || ('ohne Auto-Strafe: ' || coalesce(v_t, '-'));
    end if;
    raise exception using errcode = 'P0052', message = 'zurückrollen';
  exception when sqlstate 'P0052' then null;
  end;

  if array_length(v_fehl, 1) > 0 then
    raise exception 'Gegenprobe 0052 fehlgeschlagen: %', v_fehl;
  end if;
  raise notice 'Gegenprobe 0052 bestanden.';
end
$migration$;

commit;
