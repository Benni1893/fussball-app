-- ============================================================================
-- FC Fasanerie-Nord - Migration 0049: Automatische Mitteilungen, AM5
--                                     monatliche Erinnerung an offene Strafen
--
-- Plan: auto-mitteilungen/PHASE0.md, Annahmen S1 bis S3 in ANNAHMEN.md.
--
--   strafen_offen  pg_cron am 1. jedes Monats um 16:00 UTC (18:00 Sommerzeit,
--                  17:00 Winterzeit). An jeden Spieler, der mindestens eine
--                  offene Strafe hat, die vor mehr als 28 Tagen angelegt wurde.
--                  Betrag und Anzahl ueber ALLE offenen Strafen (nicht
--                  gemeldet, nicht storniert), Datum = aeltestes Vergehen.
--                  Hoechstens einmal im Monat (dedup je Spieler, Profil, Monat).
--                  Zugestellt nur mit eingeschaltetem Schalter (Standard aus).
--
-- Nichts rueckwirkend im Sinne neuer Strafen: die Erinnerung betrifft
-- bestehende offene Strafen und ist die entschiedene Kategorie; sie laeuft
-- erst am naechsten 1. und nur fuer, wer den Schalter einschaltet.
--
-- Vorlage (S2, wie K1): Text "{anzahl}, älteste vom {datum}." mit
-- "1 Strafe" / "9 Strafen". Nur wenn der Auslieferungsstand noch gilt.
--
-- RECHTE: SECURITY DEFINER, kein grant. Aufbau: EIN do-Block.
-- ============================================================================

begin;

do $migration$
declare
  v_fehl text[] := '{}';
  v_x    text[];
  v_club uuid; v_prof uuid; v_player uuid; v_n integer; v_t text;
begin
  execute $ddl$
  create or replace function public.notify_cron_strafen_offen()
  returns integer language plpgsql security definer set search_path = public
  as $$
  declare s record; p record; v_id uuid; v_n integer := 0;
    v_monat text := to_char(now() at time zone 'Europe/Berlin', 'YYYY-MM');
  begin
    for s in
      select f.player_id, count(*) as anz, sum(public.notify_strafe_betrag(f)) as summe, min(f.date) as aelteste
        from public.fines f
       where f.status = 'offen'
       group by f.player_id
      having min(f.created_at) < now() - interval '28 days'
    loop
      for p in select t.uid as profile_id from public.notify_profile_von_spieler(s.player_id) as t(uid) loop
        v_id := public.notify_enqueue(p.profile_id, 'strafen_offen',
          jsonb_build_object(
            'betrag', public.notify_betrag(s.summe),
            'anzahl', public.notify_anzahl(s.anz::integer, 'Strafe', 'Strafen'),
            'datum',  public.notify_datum_lang(s.aelteste)),
          p_dedup => 'strafen_offen:' || s.player_id || ':' || p.profile_id || ':' || v_monat);
        if v_id is not null then v_n := v_n + 1; end if;
      end loop;
    end loop;
    return v_n;
  end;
  $$
  $ddl$;

  revoke execute on function public.notify_cron_strafen_offen() from public, anon, authenticated;

  perform cron.unschedule('notify-strafen-offen') where exists (select 1 from cron.job where jobname = 'notify-strafen-offen');
  perform cron.schedule('notify-strafen-offen', '0 16 1 * *', 'select public.notify_cron_strafen_offen();');

  update public.notification_templates
     set text_vorlage = '{anzahl}, älteste vom {datum}.',
         beispiel_daten = beispiel_daten || '{"anzahl":"9 Strafen"}'::jsonb,
         updated_at = now()
   where kategorie = 'strafen_offen' and text_vorlage = '{anzahl} Strafen, älteste vom {datum}.';

  -- --------------------------------------------------------------------------
  -- Gegenprobe
  -- --------------------------------------------------------------------------
  if has_function_privilege('authenticated', 'public.notify_cron_strafen_offen()', 'execute')
     or has_function_privilege('anon', 'public.notify_cron_strafen_offen()', 'execute') then
    v_fehl := v_fehl || 'Rechte'::text;
  end if;
  if not exists (select 1 from cron.job where jobname = 'notify-strafen-offen' and schedule = '0 16 1 * *') then
    v_fehl := v_fehl || 'Cron-Job fehlt'::text;
  end if;
  if exists (select 1 from public.notification_templates where kategorie = 'strafen_offen' and text_vorlage <> '{anzahl}, älteste vom {datum}.') then
    v_fehl := v_fehl || 'Vorlage nicht ersetzt'::text;
  end if;

  select p.id, p.player_id, pl.club_id into v_prof, v_player, v_club
    from public.profiles p join public.players pl on pl.id = p.player_id limit 1;
  begin
    -- nur die Strafen der Gegenprobe zaehlen: die bestehenden des Spielers voruebergehend storniert
    update public.fines set status = 'storniert' where player_id = v_player and status = 'offen';
    insert into public.fines (club_id, player_id, date, offense, base_amount, status, created_at)
    values (v_club, v_player, current_date - 30, 'Gegenprobe', 5, 'offen', now() - interval '30 days'),
           (v_club, v_player, current_date - 2, 'Gegenprobe', 3, 'offen', now() - interval '2 days');
    perform public.notify_cron_strafen_offen();
    perform public.notify_cron_strafen_offen();
    select count(*), max(titel || ' | ' || text) into v_n, v_t from public.notification_outbox
     where kategorie = 'strafen_offen' and profile_id = v_prof and created_at >= now();
    if v_n <> 1 or v_t is distinct from '💸 Offene Strafen: ' || public.notify_betrag(5 + 8 + 3) || ' | 2 Strafen, älteste vom ' || public.notify_datum_lang(current_date - 30) || '.' then
      v_fehl := v_fehl || ('Erinnerung: ' || v_n || ' / ' || coalesce(v_t, '-'));
    end if;
    raise exception using errcode = 'P0049', message = 'zurückrollen';
  exception when sqlstate 'P0049' then null;
  end;

  if array_length(v_fehl, 1) > 0 then
    raise exception 'Gegenprobe 0049 fehlgeschlagen: %', v_fehl;
  end if;
  raise notice 'Gegenprobe 0049 bestanden.';
end
$migration$;

commit;

-- RUECKBAU (nicht automatisch):
-- do $$ begin
--   perform cron.unschedule('notify-strafen-offen');
--   drop function if exists public.notify_cron_strafen_offen();
--   update public.notification_templates set text_vorlage = '{anzahl} Strafen, älteste vom {datum}.',
--     beispiel_daten = beispiel_daten || '{"anzahl":"9"}' where kategorie = 'strafen_offen' and text_vorlage = '{anzahl}, älteste vom {datum}.';
-- end $$;
