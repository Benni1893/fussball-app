-- ============================================================================
-- FC Fasanerie-Nord - Startbereinigung 18.10.2026: Demo-Daten entfernen
--
-- Freigegeben im Nachtlauf-Auftrag vom 18.10.2026 mit diesen Entscheidungen:
--   - Kadereintrag efec0956-... ("Lukas Weber", mit bennilauck@gmail.com
--     verknuepft) bleibt, heisst "Benjamin Lauck"; Nummer und Position bleiben.
--     Status fit ohne Bis-Datum und Notiz. Verknuepfung zum Konto bleibt.
--   - Alle uebrigen 15 Kadereintraege, alle Strafen (317, Verlauf 291 per
--     Kaskade), alle Rueckmeldungen (38) werden geloescht.
--   - Termine: BFV bleibt vollstaendig. Von Hand angelegte Termine mit Datum
--     in der Vergangenheit (33) werden geloescht, kuenftige (5) bleiben.
--   - Aufstellungen zu Terminen (10) geloescht; Vorlage "4-3-3 Standard"
--     bleibt mit Name und Formation, alle Positionen und die Bank leer.
--   - konto_protokoll: nur "zahlungsziel_nachgetragen" (1) geloescht.
--   - notification_outbox, Konten (auch rascha.k@yahoo.com) und Gruppe B
--     unveraendert.
--
-- Vorher: Vollsicherung supabase/cleanup/backup-2026-10-18/full.dump und
-- node supabase/cleanup/2026-10-18-demo-backup.mjs ("Sicherung vollstaendig").
-- Trockenlauf: dieselbe Datei mit "rollback;" statt des letzten "commit;".
-- Ausfuehren: node C:/Users/Benjamin/fussball-app-db/werkzeug/sql.mjs <Datei>
--
-- Trigger beim Loeschen (geprueft 18.10.2026), keiner erzeugt etwas Neues:
--   fines DELETE -> notify_strafe_zurueckziehen: entfernt nur nicht versandte
--     "Neue Strafe"-Mitteilungen. Kein Push.
--   rsvps DELETE -> rsvp_late_cancel_fine: loescht offene Auto-Strafen des
--     Termins/Spielers (sind ohnehin weg). Legt keine Strafe an.
--   events DELETE -> notify_events_ereignis: meldet nur kuenftige, geplante
--     Termine (starts_at > now()). Geloescht werden nur vergangene.
--   fines_status_audit nur bei INSERT/UPDATE.
--   player_status/players/lineups/konto_protokoll: keine Push-Trigger.
-- Die Gegenprobe prueft trotzdem: keine neuen unversandten Mitteilungen,
-- Sammler leer, keine Strafen, Gruppe B unveraendert. Sonst ROLLBACK.
-- ============================================================================

begin;

do $bereinigung$
declare
  c_benni constant uuid := 'efec0956-6ef2-4def-b06c-f37b1522b1a9';
  c_heute constant date := (now() at time zone 'Europe/Berlin')::date;
  v_fehl text[] := '{}';
  n bigint;
  v_outbox_offen_vorher bigint; v_outbox_vorher bigint;
  v_b_vorher text; v_b_nachher text;
  v_bfv_vorher text; v_bfv_nachher text;
  v_b_sql constant text := $q$
    select string_agg(t || '=' || n, ',' order by t) from (
      select 'clubs' t, count(*) n from public.clubs union all
      select 'team_settings', count(*) from public.team_settings union all
      select 'fine_catalog', count(*) from public.fine_catalog union all
      select 'notification_templates', count(*) from public.notification_templates union all
      select 'einladungen', count(*) from public.einladungen union all
      select 'einwilligungen', count(*) from public.einwilligungen union all
      select 'profiles', count(*) from public.profiles union all
      select 'user_roles', count(*) from public.user_roles union all
      select 'notification_prefs', count(*) from public.notification_prefs union all
      select 'push_subscriptions', count(*) from public.push_subscriptions union all
      select 'sportstaetten', count(*) from public.sportstaetten union all
      select 'auth.users', count(*) from auth.users) x $q$;
begin
  -- ---- Vorpruefung: Stand wie im Befund? ----------------------------------------
  if (select count(*) from public.fines) <> 317 then v_fehl := v_fehl || 'fines <> 317'::text; end if;   -- 316 im Befund + 1 am 18.10. 00:26
  if (select count(*) from public.fine_status_log) <> 291 then v_fehl := v_fehl || 'fine_status_log <> 291'::text; end if;
  if (select count(*) from public.players) <> 16 then v_fehl := v_fehl || 'players <> 16'::text; end if;
  if (select count(*) from public.player_status) <> 16 then v_fehl := v_fehl || 'player_status <> 16'::text; end if;
  if (select count(*) from public.rsvps) <> 38 then v_fehl := v_fehl || 'rsvps <> 38'::text; end if;
  if (select count(*) from public.lineups) <> 11 or (select count(*) from public.lineups where is_template) <> 1 then v_fehl := v_fehl || 'lineups'::text; end if;
  if (select count(*) from public.events) <> 60 then v_fehl := v_fehl || 'events <> 60'::text; end if;
  if (select count(*) from public.events where quelle = 'bfv') <> 22 then v_fehl := v_fehl || 'bfv <> 22'::text; end if;
  if (select count(*) from public.events where quelle = 'manuell' and date < c_heute and starts_at < now()) <> 33 then v_fehl := v_fehl || 'manuell vergangen <> 33'::text; end if;
  if exists (select 1 from public.events where quelle = 'manuell' and date < c_heute and (bfv_uid is not null or quelle = 'bfv')) then v_fehl := v_fehl || 'BFV-Termin unter den zu loeschenden'::text; end if;
  if (select count(*) from public.konto_protokoll where aktion = 'zahlungsziel_nachgetragen') <> 1 then v_fehl := v_fehl || 'konto_protokoll'::text; end if;
  if not exists (select 1 from public.profiles p join auth.users u on u.id = p.id
                  where u.email = 'bennilauck@gmail.com' and p.player_id = c_benni) then
    v_fehl := v_fehl || 'Verknuepfung Bennis Konto nicht wie im Befund'::text;
  end if;
  if (select count(*) from public.profiles where player_id is not null and player_id <> c_benni) <> 0 then
    v_fehl := v_fehl || 'weiteres Profil mit Kadereintrag'::text;
  end if;
  if array_length(v_fehl, 1) > 0 then
    raise exception 'Vorpruefung fehlgeschlagen, nichts geaendert: %', v_fehl;
  end if;
  execute v_b_sql into v_b_vorher;
  select md5(string_agg(row_to_json(e)::text, '|' order by id)) into v_bfv_vorher from public.events e where quelle = 'bfv';
  select count(*), count(*) filter (where sent_at is null and error is null) into v_outbox_vorher, v_outbox_offen_vorher from public.notification_outbox;

  -- ---- Aendern und Loeschen (Abhaengigkeitsreihenfolge) ----------------------------
  delete from public.lineups where not is_template;                                   get diagnostics n = row_count; if n <> 10  then v_fehl := v_fehl || ('lineups ' || n); end if;
  update public.lineups set slots = '{}'::jsonb, bank = '[]'::jsonb, updated_at = now() where is_template;  get diagnostics n = row_count; if n <> 1 then v_fehl := v_fehl || ('Vorlage ' || n); end if;
  delete from public.fines;                                                            get diagnostics n = row_count; if n <> 317 then v_fehl := v_fehl || ('fines ' || n); end if;
  delete from public.rsvps;                                                            get diagnostics n = row_count; if n <> 38  then v_fehl := v_fehl || ('rsvps ' || n); end if;
  delete from public.player_status where player_id <> c_benni;                         get diagnostics n = row_count; if n <> 15  then v_fehl := v_fehl || ('player_status ' || n); end if;
  update public.player_status set status = 'fit', status_note = null, status_until = null, status_since = null, updated_at = now()
   where player_id = c_benni;                                                          get diagnostics n = row_count; if n <> 1   then v_fehl := v_fehl || ('Status Benni ' || n); end if;
  delete from public.players where id <> c_benni;                                      get diagnostics n = row_count; if n <> 15  then v_fehl := v_fehl || ('players ' || n); end if;
  update public.players set name = 'Benjamin Lauck' where id = c_benni;                get diagnostics n = row_count; if n <> 1   then v_fehl := v_fehl || ('Umbenennen ' || n); end if;
  delete from public.events where quelle = 'manuell' and date < c_heute and starts_at < now();  get diagnostics n = row_count; if n <> 33 then v_fehl := v_fehl || ('events ' || n); end if;
  delete from public.konto_protokoll where aktion = 'zahlungsziel_nachgetragen';       get diagnostics n = row_count; if n <> 1   then v_fehl := v_fehl || ('konto_protokoll ' || n); end if;

  -- ---- Gegenprobe ------------------------------------------------------------------
  if (select count(*) from public.fines) <> 0 then v_fehl := v_fehl || 'fines nicht leer (Auto-Strafe?)'::text; end if;
  if (select count(*) from public.fine_status_log) <> 0 then v_fehl := v_fehl || 'fine_status_log nicht leer'::text; end if;
  if (select count(*) from public.rsvps) <> 0 then v_fehl := v_fehl || 'rsvps nicht leer'::text; end if;
  if (select count(*) from public.players) <> 1 or not exists (select 1 from public.players where id = c_benni and name = 'Benjamin Lauck' and number = 10 and position = 'OM') then
    v_fehl := v_fehl || 'players: nicht genau Benjamin Lauck (Nr. 10, OM)'::text; end if;
  if (select count(*) from public.player_status) <> 1 or not exists (select 1 from public.player_status where player_id = c_benni and status = 'fit' and status_note is null and status_until is null) then
    v_fehl := v_fehl || 'player_status nicht fit'::text; end if;
  if (select count(*) from public.lineups) <> 1 or not exists (select 1 from public.lineups where is_template and name = '4-3-3 Standard' and slots = '{}'::jsonb and bank = '[]'::jsonb) then
    v_fehl := v_fehl || 'Vorlage nicht leer vorhanden'::text; end if;
  if (select count(*) from public.events) <> 27 or (select count(*) from public.events where quelle = 'manuell') <> 5 then v_fehl := v_fehl || 'events <> 27 / manuell <> 5'::text; end if;
  select md5(string_agg(row_to_json(e)::text, '|' order by id)) into v_bfv_nachher from public.events e where quelle = 'bfv';
  if v_bfv_nachher is distinct from v_bfv_vorher then v_fehl := v_fehl || 'BFV-Termine veraendert'::text; end if;
  if not exists (select 1 from public.profiles p join auth.users u on u.id = p.id where u.email = 'bennilauck@gmail.com' and p.player_id = c_benni) then
    v_fehl := v_fehl || 'Verknuepfung verloren'::text; end if;
  if (select count(*) from public.notification_sammler) <> 0 then v_fehl := v_fehl || 'Sammler nicht leer'::text; end if;
  if (select count(*) from public.notification_outbox where sent_at is null and error is null) > v_outbox_offen_vorher
     or (select count(*) from public.notification_outbox) <> v_outbox_vorher then
    v_fehl := v_fehl || 'Postausgang veraendert'::text; end if;
  execute v_b_sql into v_b_nachher;
  if v_b_nachher is distinct from v_b_vorher then v_fehl := v_fehl || ('Gruppe B veraendert: ' || v_b_vorher || ' -> ' || v_b_nachher); end if;

  if array_length(v_fehl, 1) > 0 then
    raise exception 'Gegenprobe fehlgeschlagen, alles zurueckgerollt: %', v_fehl;
  end if;
  raise notice 'Bereinigung bestanden. Gruppe B: %', v_b_nachher;
end
$bereinigung$;

-- ---- Kontrollabfragen (in der Transaktion, vor dem Abschluss) --------------------
select 'fines' pruefung, count(*)::text ist, '0' soll from public.fines
union all select 'fine_status_log', count(*)::text, '0' from public.fine_status_log
union all select 'players', count(*)::text || ' ' || coalesce(string_agg(name || ' Nr.' || coalesce(number::text, '-') || ' ' || coalesce(position, '-'), ','), ''), '1 Benjamin Lauck Nr.10 OM' from public.players
union all select 'player_status', count(*)::text || ' ' || coalesce(string_agg(status || '/' || coalesce(status_until::text, '-') || '/' || coalesce(status_note, '-'), ','), ''), '1 fit/-/-' from public.player_status
union all select 'rsvps', count(*)::text, '0' from public.rsvps
union all select 'lineups', count(*)::text || ' ' || coalesce(string_agg(name || ' ' || slots::text || ' ' || bank::text, ','), ''), '1 4-3-3 Standard {} []' from public.lineups
union all select 'events gesamt', count(*)::text, '27' from public.events
union all select 'events bfv', count(*)::text, '22' from public.events where quelle = 'bfv'
union all select 'events manuell (kuenftig)', count(*)::text, '5' from public.events where quelle = 'manuell'
union all select 'konto_protokoll', count(*)::text, '1' from public.konto_protokoll
union all select 'notification_outbox gesamt', count(*)::text, 'unveraendert' from public.notification_outbox
union all select 'notification_outbox unversandt', count(*)::text, '0' from public.notification_outbox where sent_at is null and error is null
union all select 'notification_sammler', count(*)::text, '0' from public.notification_sammler
union all select 'profiles mit Kadereintrag', count(*)::text, '1' from public.profiles where player_id is not null
union all select 'auth.users', count(*)::text, '2' from auth.users;

commit;
