-- ============================================================================
-- FC Fasanerie-Nord - Migration 0065: Onboarding Nacharbeit 6, Kassenwart-Wechsel
--
--   1. fines: zahlung_an (Konto des Kassenwarts), zahlung_an_name,
--      zahlung_an_paypal, an_vorherigen. Ein Trigger haelt beim Melden
--      (gemeldet) und beim Bestaetigen (bestaetigt) fest, an welchen
--      Kassenwart und welchen PayPal-Link die Zahlung ging. Zurueck auf offen
--      loescht die Angabe wieder. Bestehende Zeilen bleiben unveraendert.
--   2. kassenwart_offen(p_profil): Anzahl und Summe der gemeldeten, noch nicht
--      bestaetigten Zahlungen an diesen Kassenwart (Trainer/Admin).
--   3. rolle_setzen(p_profil, p_rolle, p_an, p_trotzdem): beim Entziehen von
--      Kassenwart mit offenen Meldungen ohne p_trotzdem Abbruch; mit
--      p_trotzdem werden die Meldungen als "an vorherigen Kassenwart gezahlt"
--      markiert und bleiben fuer den neuen Kassenwart sichtbar. Protokoll.
--      Push: kasse_neu an den neuen, kasse_abgegeben an den alten Kassenwart
--      (statt rolle_geaendert), Ruhezeiten ueber notification_due.
--   4. Push-Kategorien kasse_neu, kasse_abgegeben (AM-Muster, 🔑).
--
-- RECHTE: kassenwart_offen an authenticated (Rollenpruefung in der Funktion).
-- Aufbau: EIN do-Block, Gegenprobe am Ende (zurueckgerollt).
-- ============================================================================

begin;

do $migration$
declare
  v_fehl text[] := '{}';
  v_kats text := $k$'strafe_neu','zahlung_bestaetigt','zahlung_abgelehnt','zahlung_gemeldet','absage_kurzfristig','termin_geaendert','termin_abgesagt','termin_neu','rueckmeldung_erinnerung','unterbesetzung','meldeschluss_uebersicht','strafen_offen','test','rueckmeldung_nachfrage','status_abgelaufen','anfrage_neu','konto_freigegeben','rolle_geaendert','kasse_neu','kasse_abgegeben'$k$;
  v_admin uuid; v_club uuid; v_tok text; v_alt uuid := gen_random_uuid(); v_neu uuid := gen_random_uuid(); v_sp uuid := gen_random_uuid();
  v_pl uuid; v_f1 uuid; v_f2 uuid; v_r jsonb; v_ok boolean; v_alt_n integer;
begin
  -- 1) Spalten und Trigger
  alter table public.fines add column if not exists zahlung_an uuid;
  alter table public.fines add column if not exists zahlung_an_name text;
  alter table public.fines add column if not exists zahlung_an_paypal text;
  alter table public.fines add column if not exists an_vorherigen boolean not null default false;

  execute $ddl$
  create or replace function public.fines_zahlung_an()
  returns trigger language plpgsql security definer set search_path = public
  as $$
  declare ts record; v_an uuid;
  begin
    if NEW.status = 'offen' and TG_OP = 'UPDATE' and OLD.status is distinct from 'offen' then
      NEW.zahlung_an := null; NEW.zahlung_an_name := null; NEW.zahlung_an_paypal := null; NEW.an_vorherigen := false;
      return NEW;
    end if;
    if NEW.status not in ('gemeldet', 'bestätigt') then return NEW; end if;
    if TG_OP = 'UPDATE' and NEW.status is not distinct from OLD.status then return NEW; end if;
    if NEW.zahlung_an is not null then return NEW; end if;
    select paypal_name, paypal_von into ts from public.team_settings limit 1;
    if NEW.status = 'gemeldet' then
      v_an := case when ts.paypal_name is not null then ts.paypal_von end;
    else
      -- bestaetigt ohne vorherige Meldung: wer bestaetigt (Kassenwart oder Admin)
      v_an := coalesce(auth.uid(), case when ts.paypal_name is not null then ts.paypal_von end);
    end if;
    if v_an is null then return NEW; end if;
    NEW.zahlung_an := v_an;
    NEW.zahlung_an_name := public.konto_name(v_an);
    NEW.zahlung_an_paypal := case when ts.paypal_von = v_an then ts.paypal_name end;
    return NEW;
  end;
  $$
  $ddl$;
  revoke execute on function public.fines_zahlung_an() from public, anon, authenticated;
  drop trigger if exists trg_fines_zahlung_an on public.fines;
  -- Name nach trg_fines_status_sync: BEFORE-Trigger laufen alphabetisch, der Status steht dann fest.
  create trigger trg_fines_zahlung_an before insert or update on public.fines
    for each row execute function public.fines_zahlung_an();

  -- 2) Offene Meldungen an einen Kassenwart
  execute $ddl$
  create or replace function public.kassenwart_offen_intern(p_profil uuid)
  returns table (anzahl integer, summe numeric) language sql stable security definer set search_path = public
  as $$
    select count(*)::integer, coalesce(sum(coalesce(f.base_amount, c.amount, 0) + coalesce(f.surcharge, 0)), 0)
      from public.fines f left join public.fine_catalog c on c.id = f.catalog_id
     where f.status = 'gemeldet' and not f.an_vorherigen
       and (f.zahlung_an = p_profil
            or (f.zahlung_an is null and exists (select 1 from public.team_settings t where t.paypal_von = p_profil)));
  $$
  $ddl$;
  revoke execute on function public.kassenwart_offen_intern(uuid) from public, anon, authenticated;

  execute $ddl$
  create or replace function public.kassenwart_offen(p_profil uuid)
  returns jsonb language plpgsql stable security definer set search_path = public
  as $$
  declare r record;
  begin
    if not public.ist_leitung() then raise exception 'Nur Trainer oder Admin.' using errcode = '42501'; end if;
    select * into r from public.kassenwart_offen_intern(p_profil);
    return jsonb_build_object('anzahl', r.anzahl, 'summe', r.summe);
  end;
  $$
  $ddl$;
  revoke execute on function public.kassenwart_offen(uuid) from public, anon;
  grant execute on function public.kassenwart_offen(uuid) to authenticated;

  -- 3) Push-Kategorien
  execute 'alter table public.notification_templates drop constraint notification_templates_kat_chk';
  execute 'alter table public.notification_templates add constraint notification_templates_kat_chk check (kategorie in (' || v_kats || '))';
  execute 'alter table public.notification_outbox drop constraint notification_outbox_kat_chk';
  execute 'alter table public.notification_outbox add constraint notification_outbox_kat_chk check (kategorie in (' || v_kats || '))';

  insert into public.notification_templates
    (kategorie, titel_vorlage, text_vorlage, deep_link_vorlage, urgency, ttl_regel, ttl_sekunden,
     platzhalter, platzhalter_optional, beispiel_daten, empfaenger_beschreibung, ausloeser_beschreibung, aktiv)
  values
    ('kasse_neu', '🔑 Du bist jetzt Kassenwart', 'Bitte hinterlege deinen PayPal-Link, damit die Mannschaft an dich zahlen kann.',
     '#ein=profil', 'normal', 'fix', 604800, array[]::text[], array[]::text[], '{}'::jsonb,
     'Die Person, die Kassenwart wird.', 'Trainer oder Admin vergeben die Rolle Kassenwart.', true),
    ('kasse_abgegeben', '🔑 Kasse abgegeben', 'Du bist nicht mehr Kassenwart. Dein PayPal-Link wird nicht mehr angezeigt.{hinweis}',
     '#ein=profil', 'normal', 'fix', 259200, array[]::text[], array['hinweis'], '{"hinweis":" 2 offene Meldungen gehen an die neue Kasse."}'::jsonb,
     'Die Person, die nicht mehr Kassenwart ist.', 'Trainer oder Admin entziehen die Rolle Kassenwart.', true)
  on conflict (kategorie) do nothing;

  execute $ddl$
  create or replace function public.kategorie_rolle(p_kategorie text)
  returns text language sql immutable set search_path = public
  as $$
    select case p_kategorie
      when 'strafe_neu'              then 'spieler'
      when 'zahlung_bestaetigt'      then 'spieler'
      when 'zahlung_abgelehnt'       then 'spieler'
      when 'rueckmeldung_erinnerung' then 'spieler'
      when 'rueckmeldung_nachfrage'  then 'spieler'
      when 'termin_abgesagt'         then 'spieler'
      when 'termin_geaendert'        then 'spieler'
      when 'termin_neu'              then 'spieler'
      when 'strafen_offen'           then 'spieler'
      when 'absage_kurzfristig'      then 'coach'
      when 'unterbesetzung'          then 'coach'
      when 'meldeschluss_uebersicht' then 'coach'
      when 'status_abgelaufen'       then 'coach'
      when 'anfrage_neu'             then 'leitung'
      when 'zahlung_gemeldet'        then 'treasurer'
      when 'konto_freigegeben'       then 'alle'
      when 'rolle_geaendert'         then 'alle'
      when 'kasse_neu'               then 'alle'
      when 'kasse_abgegeben'         then 'alle'
      when 'test'                    then 'alle'
      else null
    end;
  $$
  $ddl$;
  revoke execute on function public.kategorie_rolle(text) from public, anon, authenticated;

  execute $ddl$
  create or replace view public.notification_due with (security_invoker = true) as
  select o.*
    from public.notification_outbox o
    join public.notification_prefs p on p.profile_id = o.profile_id
   where o.sent_at is null
     and o.error is null
     and o.not_before <= now()
     and (o.gueltig_bis is null or o.gueltig_bis > now())
     and (o.claimed_at is null or o.claimed_at < now() - interval '5 minutes')
     and (o.ist_vorschau or public.kategorie_erlaubt(o.profile_id, o.kategorie))
     and (o.ist_vorschau or o.kategorie = 'test'
          or coalesce(case o.kategorie
               when 'strafe_neu'              then p.strafe_neu
               when 'zahlung_bestaetigt'      then p.zahlung_bestaetigt
               when 'zahlung_abgelehnt'       then p.zahlung_abgelehnt
               when 'zahlung_gemeldet'        then p.zahlung_gemeldet
               when 'absage_kurzfristig'      then p.absage_kurzfristig
               when 'termin_geaendert'        then p.termin_geaendert
               when 'termin_abgesagt'         then p.termin_abgesagt
               when 'termin_neu'              then p.termin_neu
               when 'rueckmeldung_erinnerung' then p.rueckmeldung_erinnerung
               when 'rueckmeldung_nachfrage'  then p.rueckmeldung_erinnerung
               when 'unterbesetzung'          then p.unterbesetzung
               when 'meldeschluss_uebersicht' then p.meldeschluss_uebersicht
               when 'strafen_offen'           then p.strafen_offen
               when 'status_abgelaufen'       then p.status_abgelaufen
               when 'anfrage_neu'             then p.anfrage_neu
               when 'konto_freigegeben'       then true
               when 'rolle_geaendert'         then true
               when 'kasse_neu'               then true
               when 'kasse_abgegeben'         then true
             end, false))
     and (o.ist_vorschau or o.kategorie = 'test'
          or not public.in_quiet_hours(p.quiet_from, p.quiet_to)
          or (o.urgency = 'high' and p.quiet_override_urgent))
  $ddl$;
  revoke all on public.notification_due from public, anon, authenticated;
  grant select on public.notification_due to service_role;

  -- 4) Rollen mit Kassenwart-Wechsel
  drop function if exists public.rolle_setzen(uuid, text, boolean);
  execute $ddl$
  create function public.rolle_setzen(p_profil uuid, p_rolle text, p_an boolean, p_trotzdem boolean default false)
  returns jsonb language plpgsql security definer set search_path = public
  as $$
  declare v_club uuid; v_hat boolean; v_txt text; v_off record; v_hinweis text := '';
  begin
    if not public.ist_leitung() then raise exception 'Nur Trainer oder Admin.' using errcode = '42501'; end if;
    if p_rolle not in ('coach','treasurer','admin') then raise exception 'Unbekannte Rolle.'; end if;
    if p_rolle = 'admin' and not public.has_role('admin') then
      raise exception 'Die Rolle Admin vergibt nur der Admin.' using errcode = '42501';
    end if;
    if not exists (select 1 from public.profiles where id = p_profil and freigabe = 'aktiv') then
      raise exception 'Konto nicht gefunden oder nicht freigegeben.';
    end if;
    v_hat := exists (select 1 from public.user_roles where user_id = p_profil and role = p_rolle);
    if v_hat = p_an then return case when public.ist_leitung() then public.mitglieder_liste() else '[]'::jsonb end; end if;
    select id into v_club from public.clubs where slug = 'fcfn';
    if p_an then
      insert into public.user_roles (user_id, role, club_id) values (p_profil, p_rolle, v_club) on conflict do nothing;
      if p_rolle = 'treasurer' then update public.profiles set paypal_frage = true where id = p_profil; end if;
    else
      if p_rolle in ('coach','admin') and public.leitung_anzahl(p_profil, p_rolle) = 0 then
        raise exception 'Mindestens ein Konto muss Trainer oder Admin bleiben.';
      end if;
      if p_rolle = 'treasurer' then
        select * into v_off from public.kassenwart_offen_intern(p_profil);
        if v_off.anzahl > 0 and not coalesce(p_trotzdem, false) then
          raise exception 'Offene Meldungen an diesen Kassenwart: % (% €).', v_off.anzahl, v_off.summe using errcode = 'P0K01';
        end if;
        if v_off.anzahl > 0 then
          -- Die Meldungen bleiben gemeldet und gehen an die neue Kasse, markiert.
          update public.fines f set an_vorherigen = true,
                 zahlung_an = coalesce(f.zahlung_an, p_profil),
                 zahlung_an_name = coalesce(f.zahlung_an_name, public.konto_name(p_profil)),
                 zahlung_an_paypal = coalesce(f.zahlung_an_paypal, (select paypal_name from public.team_settings where paypal_von = p_profil limit 1))
           where f.status = 'gemeldet' and not f.an_vorherigen
             and (f.zahlung_an = p_profil or (f.zahlung_an is null and exists (select 1 from public.team_settings t where t.paypal_von = p_profil)));
          perform public.protokollieren('kassenwart_gewechselt', p_profil,
            jsonb_build_object('rolle', 'treasurer', 'offen', v_off.anzahl, 'summe', v_off.summe));
          v_hinweis := ' ' || v_off.anzahl || case when v_off.anzahl = 1 then ' offene Meldung geht' else ' offene Meldungen gehen' end || ' an die neue Kasse.';
        end if;
      end if;
      delete from public.user_roles where user_id = p_profil and role = p_rolle;
      if p_rolle = 'treasurer' then
        update public.profiles set paypal_frage = false where id = p_profil;
        -- E8: Der Link des bisherigen Kassenwarts wird nicht mehr gezeigt.
        update public.team_settings set paypal_name = null, paypal_von = null, paypal_am = now()
         where paypal_von = p_profil;
      end if;
    end if;
    perform public.protokollieren(case when p_an then 'rolle_vergeben' else 'rolle_entzogen' end, p_profil,
      jsonb_build_object('rolle', p_rolle));
    if p_profil <> auth.uid() then
      if p_rolle = 'treasurer' then
        perform public.notify_enqueue(p_profil, case when p_an then 'kasse_neu' else 'kasse_abgegeben' end,
          case when p_an then '{}'::jsonb else jsonb_build_object('hinweis', v_hinweis) end,
          p_dedup => 'kasse:' || p_profil || ':' || (extract(epoch from clock_timestamp()) * 1000)::bigint);
      else
        v_txt := 'Du bist ' || case when p_an then 'jetzt ' else 'nicht mehr ' end
                 || case p_rolle when 'coach' then 'Trainer' else 'Admin' end || '.';
        perform public.notify_enqueue(p_profil, 'rolle_geaendert', jsonb_build_object('aenderung', v_txt),
          p_dedup => 'rolle_geaendert:' || p_profil || ':' || p_rolle || ':' || (extract(epoch from clock_timestamp()) * 1000)::bigint);
      end if;
    end if;
    return case when public.ist_leitung() then public.mitglieder_liste() else '[]'::jsonb end;
  end;
  $$
  $ddl$;
  revoke execute on function public.rolle_setzen(uuid, text, boolean, boolean) from public, anon;
  grant execute on function public.rolle_setzen(uuid, text, boolean, boolean) to authenticated;

  -- --------------------------------------------------------------------------
  -- Gegenprobe
  -- --------------------------------------------------------------------------
  if exists (select 1 from public.fines where zahlung_an is not null or an_vorherigen) then v_fehl := v_fehl || 'Bestand veraendert'::text; end if;
  if (select count(*) from pg_proc where proname = 'rolle_setzen' and pronamespace = 'public'::regnamespace) <> 1 then v_fehl := v_fehl || 'eine Fassung'::text; end if;

  select user_id into v_admin from public.user_roles where role = 'admin' limit 1;
  select id into v_club from public.clubs where slug = 'fcfn';
  -- Bestehende Meldungen ohne Ziel zaehlen zum Halter des PayPal-Links (in der Probe: Kasse Alt).
  select count(*) into v_alt_n from public.fines where status = 'gemeldet' and zahlung_an is null;
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
    v_tok := (public.einladung_holen())->>'token';
    insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
      (v_alt, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gp0065a@invalid.local', jsonb_build_object('name', 'Kasse Alt', 'einladung', v_tok), now(), now()),
      (v_neu, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gp0065b@invalid.local', jsonb_build_object('name', 'Kasse Neu', 'einladung', v_tok), now(), now()),
      (v_sp,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gp0065c@invalid.local', jsonb_build_object('name', 'Zahlt Brav', 'einladung', v_tok), now(), now());
    perform public.anfrage_freigeben(v_alt); perform public.anfrage_freigeben(v_neu); perform public.anfrage_freigeben(v_sp);
    select player_id into v_pl from public.profiles where id = v_sp;
    perform public.rolle_setzen(v_alt, 'treasurer', true);
    if (select count(*) from public.notification_outbox where profile_id = v_alt and kategorie = 'kasse_neu') <> 1 then v_fehl := v_fehl || 'Push kasse_neu'::text; end if;
    perform set_config('request.jwt.claims', json_build_object('sub', v_alt, 'role', 'authenticated')::text, true);
    perform public.paypal_setzen('kassealt');
    insert into public.fines (club_id, player_id, offense, base_amount, date, status) values
      (v_club, v_pl, 'Prüf eins', 5, current_date, 'offen'), (v_club, v_pl, 'Prüf zwei', 7, current_date, 'offen');
    select id into v_f1 from public.fines where player_id = v_pl and offense = 'Prüf eins';
    select id into v_f2 from public.fines where player_id = v_pl and offense = 'Prüf zwei';
    perform set_config('request.jwt.claims', json_build_object('sub', v_sp, 'role', 'authenticated')::text, true);
    update public.fines set status = 'gemeldet' where id in (v_f1, v_f2);
    if (select count(*) from public.fines where id in (v_f1, v_f2) and zahlung_an = v_alt and zahlung_an_paypal = 'kassealt' and zahlung_an_name = 'Kasse Alt') <> 2 then
      v_fehl := v_fehl || 'Zahlungsziel gemeldet'::text;
    end if;
    perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
    v_r := public.kassenwart_offen(v_alt);
    if (v_r->>'anzahl')::integer <> 2 + v_alt_n or (v_r->>'summe')::numeric < 12 then v_fehl := v_fehl || ('offen ' || v_r::text); end if;
    -- ohne trotzdem: Abbruch, nichts veraendert
    v_ok := false;
    begin
      perform public.rolle_setzen(v_alt, 'treasurer', false);
    exception when sqlstate 'P0K01' then v_ok := true;
    end;
    if not v_ok or not exists (select 1 from public.user_roles where user_id = v_alt and role = 'treasurer') then v_fehl := v_fehl || 'Abbruch'::text; end if;
    -- neuer Kassenwart, dann trotzdem wechseln
    perform public.rolle_setzen(v_neu, 'treasurer', true);
    perform public.rolle_setzen(v_alt, 'treasurer', false, true);
    if (select count(*) from public.fines where id in (v_f1, v_f2) and status = 'gemeldet' and an_vorherigen and zahlung_an = v_alt) <> 2
       or (select count(*) from public.fines where status = 'gemeldet' and an_vorherigen) <> 2 + v_alt_n then v_fehl := v_fehl || 'Markierung'::text; end if;
    if (select paypal_name from public.team_settings) is not null then v_fehl := v_fehl || 'Link versteckt'::text; end if;
    if (select max(text) from public.notification_outbox where profile_id = v_alt and kategorie = 'kasse_abgegeben') not like '% ' || (2 + v_alt_n) || ' offene Meldungen gehen an die neue Kasse.' then v_fehl := v_fehl || 'Push kasse_abgegeben'::text; end if;
    if (public.kassenwart_offen(v_alt))->>'anzahl' <> '0' then v_fehl := v_fehl || 'offen danach'::text; end if;
    -- neuer Kassenwart bestaetigt: Ziel bleibt der alte, Markierung bleibt
    perform set_config('request.jwt.claims', json_build_object('sub', v_neu, 'role', 'authenticated')::text, true);
    perform public.paypal_setzen('kasseneu');
    perform public.confirm_fines(array[v_f1], 'paypal');
    if (select status || '/' || zahlung_an::text || '/' || an_vorherigen::text from public.fines where id = v_f1) <> 'bestätigt/' || v_alt || '/true' then v_fehl := v_fehl || 'Bestaetigung'::text; end if;
    -- direkte Bestaetigung ohne Meldung: Ziel ist der Bestaetigende
    insert into public.fines (club_id, player_id, offense, base_amount, date, status) values (v_club, v_pl, 'Prüf drei', 3, current_date, 'offen') returning id into v_f1;
    perform public.confirm_fines(array[v_f1], 'bar');
    if (select zahlung_an::text || '/' || coalesce(zahlung_an_paypal, '-') from public.fines where id = v_f1) <> v_neu || '/kasseneu' then v_fehl := v_fehl || 'Ziel direkt'::text; end if;
    -- Spieler und Wartende lesen keine offenen Meldungen
    perform set_config('request.jwt.claims', json_build_object('sub', v_sp, 'role', 'authenticated')::text, true);
    v_ok := false;
    begin perform public.kassenwart_offen(v_alt); exception when sqlstate '42501' then v_ok := true; end;
    if not v_ok then v_fehl := v_fehl || 'Recht offen'::text; end if;
    perform set_config('request.jwt.claims', '', true);
    raise exception using errcode = 'P0065', message = 'zurückrollen';
  exception when sqlstate 'P0065' then null;
  end;

  if array_length(v_fehl, 1) > 0 then
    raise exception 'Gegenprobe 0065 fehlgeschlagen: %', v_fehl;
  end if;
  raise notice 'Gegenprobe 0065 bestanden.';
end
$migration$;

commit;

-- RUECKBAU (nicht automatisch): Trigger trg_fines_zahlung_an und Funktionen
-- fines_zahlung_an, kassenwart_offen(_intern) loeschen; rolle_setzen(4) loeschen
-- und die 3-stellige Fassung aus 0061 anlegen; Vorlagen kasse_neu und
-- kasse_abgegeben loeschen, Kategorie-Checks, kategorie_rolle und
-- notification_due wie 0061; Spalten an fines entfernen.
