-- ============================================================================
-- FC Fasanerie-Nord - Migration 0056: Konsistenz der Mitteilungen
--
-- Befunde aus der Konsistenzpruefung vom 06.10.2026 (ABSCHLUSS.md):
--   K1  unterbesetzung ("Zu wenig Zusagen") hat keinen Erzeuger (F4): Vorlage
--       aktiv = false. Push-Texte zeigt "aus", "Alle an mich senden" laesst sie
--       weg; die Seite Mitteilungen blendet den Schalter aus (Frontend).
--   K3  Strafhinweis-Wortlaut im Push-Texte-Editor pflegbar (aus Paket A):
--       RPC set_notification_strafhinweis(p_text), nur Admin, schreibt
--       beispiel_daten.strafhinweis der Erinnerung - dieselbe Quelle, aus der
--       der Versand liest (0052). grant an authenticated, Rollenpruefung in der
--       Funktion (Regel aus 0042).
--   K7  termin_neu: Verfall statt fester 7 Tage bis zum Beginn des letzten
--       genannten Termins (ttl_regel bis_zeitpunkt, hoechstens 7 Tage). Nach
--       einem Versand-Rueckstau kuendigt keine Nachricht Vergangenes an.
--       notify_flush_termin_neu wie in 0046, dazu p_ttl_bis.
-- Aufbau: EIN do-Block (conventions.md).
-- ============================================================================

begin;

do $migration$
declare
  v_fehl text[] := '{}';
  v_admin uuid; v_nutzer uuid; v_club uuid; v_prof uuid; v_player uuid; v_ev uuid; v_t text;
begin
  -- K1
  update public.notification_templates set aktiv = false, updated_at = now() where kategorie = 'unterbesetzung';

  -- K3
  execute $ddl$
  create or replace function public.set_notification_strafhinweis(p_text text)
  returns text language plpgsql security definer set search_path = public
  as $$
  declare v_text text := btrim(coalesce(p_text, ''));
  begin
    if not public.is_admin() then
      raise exception 'Nur Admin.' using errcode = '42501';
    end if;
    if v_text = '' then
      raise exception 'Der Strafhinweis darf nicht leer sein. Wer ihn nicht will, nimmt {strafhinweis} aus dem Text.';
    end if;
    if length(v_text) > 80 then
      raise exception 'Der Strafhinweis darf höchstens 80 Zeichen haben.';
    end if;
    if v_text ~ '[{}]' then
      raise exception 'Der Strafhinweis darf keine geschweiften Klammern enthalten.';
    end if;
    update public.notification_templates
       set beispiel_daten = beispiel_daten || jsonb_build_object('strafhinweis', v_text),
           updated_at = now(), updated_by = auth.uid()
     where kategorie = 'rueckmeldung_erinnerung';
    return v_text;
  end;
  $$
  $ddl$;
  revoke execute on function public.set_notification_strafhinweis(text) from public, anon;
  grant  execute on function public.set_notification_strafhinweis(text) to authenticated;

  -- K7
  update public.notification_templates set ttl_regel = 'bis_zeitpunkt', updated_at = now()
   where kategorie = 'termin_neu' and ttl_regel = 'fix';
  execute $ddl$
  create or replace function public.notify_flush_termin_neu()
  returns integer language plpgsql security definer set search_path = public
  as $$
  declare g record; v_ids uuid[]; v_ok uuid[]; v_n integer := 0; v_bis timestamptz;
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

      select array_agg(e.id), max(e.starts_at) into v_ok, v_bis from public.events e
       where e.id = any(v_ids) and e.status = 'geplant' and e.starts_at > now();
      continue when v_ok is null;

      perform public.notify_enqueue(g.profile_id, 'termin_neu',
        jsonb_build_object(
          'anzahl', public.notify_anzahl(array_length(v_ok, 1), 'neuer Termin', 'neue Termine'),
          'liste',  public.notify_termin_liste(v_ok)),
        p_dedup => 'termin_neu:' || g.bezug || ':' || g.profile_id || ':' || floor(extract(epoch from g.ab))::bigint,
        p_ttl_bis => v_bis);   -- 0056: verfaellt, wenn der letzte genannte Termin begonnen hat
      v_n := v_n + 1;
    end loop;
    return v_n;
  end;
  $$
  $ddl$;
  revoke execute on function public.notify_flush_termin_neu() from public, anon, authenticated;

  -- --------------------------------------------------------------------------
  -- Gegenprobe
  -- --------------------------------------------------------------------------
  if exists (select 1 from public.notification_templates where kategorie = 'unterbesetzung' and aktiv) then
    v_fehl := v_fehl || 'unterbesetzung aktiv'::text;
  end if;
  if not has_function_privilege('authenticated', 'public.set_notification_strafhinweis(text)', 'execute')
     or has_function_privilege('anon', 'public.set_notification_strafhinweis(text)', 'execute')
     or has_function_privilege('authenticated', 'public.notify_flush_termin_neu()', 'execute') then
    v_fehl := v_fehl || 'Rechte'::text;
  end if;
  select ur.user_id into v_admin from public.user_roles ur where ur.role = 'admin' limit 1;
  select p.id into v_nutzer from public.profiles p
   where not exists (select 1 from public.user_roles ur where ur.user_id = p.id and ur.role = 'admin') limit 1;
  -- als Admin: speichern wirkt, der Versand liest es
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
    perform public.set_notification_strafhinweis('Ohne Antwort kostet es 8 €.');
    perform set_config('request.jwt.claims', '', true);
    if (select beispiel_daten->>'strafhinweis' from public.notification_templates where kategorie = 'rueckmeldung_erinnerung') <> 'Ohne Antwort kostet es 8 €.' then
      v_fehl := v_fehl || 'Strafhinweis nicht gespeichert'::text;
    end if;
    raise exception using errcode = 'P0056', message = 'zurückrollen';
  exception when sqlstate 'P0056' then null;
  end;
  -- als Nicht-Admin: verweigert
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', v_nutzer, 'role', 'authenticated')::text, true);
    perform public.set_notification_strafhinweis('x');
    v_fehl := v_fehl || 'Nicht-Admin darf Strafhinweis setzen'::text;
  exception when sqlstate '42501' then null;
  end;
  perform set_config('request.jwt.claims', '', true);
  -- termin_neu bekommt gueltig_bis = Beginn des (letzten) Termins
  select p.id, p.player_id, pl.club_id into v_prof, v_player, v_club
    from public.profiles p join public.players pl on pl.id = p.player_id limit 1;
  begin
    insert into public.events (club_id, type, title, date, time, status, quelle, auto_fine)
    values (v_club, 'training', 'Gegenprobe', current_date + 4, '19:00', 'geplant', 'manuell', false) returning id into v_ev;
    update public.notification_sammler set faellig_ab = now() - interval '1 second' where erstellt_at >= now();
    perform public.notify_flush_termin_neu();
    if not exists (select 1 from public.notification_outbox o join public.events e on e.id = v_ev
                    where o.kategorie = 'termin_neu' and o.profile_id = v_prof and o.created_at >= now() and o.gueltig_bis = e.starts_at) then
      v_fehl := v_fehl || 'termin_neu ohne gueltig_bis'::text;
    end if;
    raise exception using errcode = 'P0056', message = 'zurückrollen';
  exception when sqlstate 'P0056' then null;
  end;

  if array_length(v_fehl, 1) > 0 then
    raise exception 'Gegenprobe 0056 fehlgeschlagen: %', v_fehl;
  end if;
  raise notice 'Gegenprobe 0056 bestanden.';
end
$migration$;

commit;
