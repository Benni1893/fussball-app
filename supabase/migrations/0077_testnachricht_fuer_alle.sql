-- ============================================================================
-- FC Fasanerie-Nord - Migration 0077: Testnachricht fuer alle (Block 3, 19.10.2026)
--
-- "Testnachricht senden" war nur fuer den Admin (0042). Jetzt darf jedes
-- freigegebene Konto sich selbst eine Testnachricht schicken - nur an die
-- eigene Person (wie bisher auth.uid()), mit Sperre gegen Dauerfeuer:
--   hoechstens eine je Minute und fuenf je 24 Stunden.
-- Die Sperre zaehlt die eigenen Zeilen der Kategorie 'test' in
-- notification_outbox (bleiben 90 Tage stehen, 0040).
-- Aufbau: EIN do-Block, Gegenprobe am Ende (Pruefkonten, zurueckgerollt).
-- ============================================================================

begin;

do $migration$
declare
  v_fehl text[] := '{}';
  v_club uuid; v_tok text := 'gp0077' || replace(gen_random_uuid()::text, '-', '');
  v_a uuid := gen_random_uuid(); v_w uuid := gen_random_uuid();
  v_n int; v_s text; v_i int;
begin
  if pg_get_functiondef('public.send_test_notification'::regproc) !~ 'is_admin' then
    raise exception 'send_test_notification ist nicht mehr admin-only - schon eingespielt?';
  end if;

  execute $ddl$
  create or replace function public.send_test_notification()
  returns uuid language plpgsql security definer set search_path = public
  as $$
  declare v_letzte timestamptz; v_heute integer;
  begin
    if auth.uid() is null then raise exception 'Nicht angemeldet.'; end if;
    -- 0077: jedes freigegebene Konto, nur an sich selbst
    if not exists (select 1 from public.profiles where id = auth.uid() and freigabe = 'aktiv') then
      raise exception 'Erst nach der Freigabe.' using errcode = '42501';
    end if;
    if not exists (select 1 from public.push_subscriptions where profile_id = auth.uid()) then
      raise exception 'Für dieses Konto ist noch kein Gerät angemeldet.';
    end if;
    -- Sperre gegen Dauerfeuer: eine je Minute, fuenf je 24 Stunden
    select max(created_at), count(*) filter (where created_at > now() - interval '24 hours')
      into v_letzte, v_heute
      from public.notification_outbox where profile_id = auth.uid() and kategorie = 'test';
    if v_letzte is not null and v_letzte > now() - interval '1 minute' then
      raise exception 'Bitte warte eine Minute bis zur nächsten Testnachricht.' using errcode = 'P0T01';
    end if;
    if coalesce(v_heute, 0) >= 5 then
      raise exception 'Heute schon fünf Testnachrichten. Morgen geht es wieder.' using errcode = 'P0T02';
    end if;

    return public.notify_enqueue(
      p_profile   => auth.uid(),
      p_kategorie => 'test',
      p_daten     => '{}'::jsonb,
      -- Zeitstempel im Schluessel: zweimal druecken soll zweimal ankommen.
      p_dedup     => 'test:' || auth.uid()::text || ':' || extract(epoch from clock_timestamp())::bigint::text,
      p_tag       => 'test');
  end;
  $$
  $ddl$;

  -- ---- Gegenprobe ------------------------------------------------------------
  if not has_function_privilege('authenticated', 'public.send_test_notification()', 'execute') then v_fehl := v_fehl || 'grant fehlt'::text; end if;
  if has_function_privilege('anon', 'public.send_test_notification()', 'execute') then v_fehl := v_fehl || 'anon darf'::text; end if;
  select id into v_club from public.clubs where slug = 'fcfn';
  begin
    update public.einladungen set widerrufen_am = now() where widerrufen_am is null and art = 'spieler';
    insert into public.einladungen (club_id, token) values (v_club, v_tok);
    insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
      (v_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gp0077a@invalid.local', jsonb_build_object('name', 'Gegen Spieler', 'einladung', v_tok), now(), now()),
      (v_w, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gp0077w@invalid.local', jsonb_build_object('name', 'Gegen Wartend', 'einladung', v_tok), now(), now());
    update public.profiles set freigabe = 'aktiv' where id = v_a;
    insert into public.push_subscriptions (profile_id, endpoint, p256dh, auth) values
      (v_a, 'https://pruef.invalid/0077/a', 'x', 'x'), (v_w, 'https://pruef.invalid/0077/w', 'x', 'x');

    -- Spieler (kein Admin): erste Testnachricht geht, an sich selbst
    perform set_config('request.jwt.claims', json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
    perform public.send_test_notification();
    select count(*) into v_n from public.notification_outbox where kategorie = 'test' and profile_id = v_a;
    if v_n <> 1 then v_fehl := v_fehl || ('Spieler: ' || v_n || ' Testnachrichten'); end if;
    -- sofort noch einmal: Sperre
    v_s := 'ging';
    begin perform public.send_test_notification(); exception when sqlstate 'P0T01' then v_s := 'gesperrt'; end;
    if v_s <> 'gesperrt' then v_fehl := v_fehl || 'Minutensperre fehlt'::text; end if;
    -- fuenf in 24 Stunden: alte Zeilen vordatieren, dann ist die sechste gesperrt
    update public.notification_outbox set created_at = now() - interval '2 hours' where kategorie = 'test' and profile_id = v_a;
    -- vier weitere aus den letzten 24 Stunden (direkt, der Dedup-Schluessel waere in derselben Sekunde gleich)
    insert into public.notification_outbox (profile_id, kategorie, titel, text, dedup_key, created_at)
      select v_a, 'test', 'Test', 'Test', 'gp0077:' || g, now() - interval '3 hours' from generate_series(1, 4) g;
    v_s := 'ging';
    begin perform public.send_test_notification(); exception when sqlstate 'P0T02' then v_s := 'gesperrt'; end;
    if v_s <> 'gesperrt' then v_fehl := v_fehl || 'Tagessperre fehlt'::text; end if;
    -- Wartendes Konto: abgelehnt
    perform set_config('request.jwt.claims', json_build_object('sub', v_w, 'role', 'authenticated')::text, true);
    v_s := 'ging';
    begin perform public.send_test_notification(); exception when insufficient_privilege then v_s := 'abgelehnt'; end;
    if v_s <> 'abgelehnt' then v_fehl := v_fehl || 'wartendes Konto durfte'::text; end if;
    perform set_config('request.jwt.claims', '', true);
    -- nie an andere
    select count(*) into v_n from public.notification_outbox where kategorie = 'test' and profile_id not in (v_a) and created_at > now() - interval '1 minute';
    if v_n <> 0 then v_fehl := v_fehl || 'Testnachricht an andere'::text; end if;

    raise exception using errcode = 'P0077', message = 'zurückrollen';
  exception when sqlstate 'P0077' then null;
  end;
  if exists (select 1 from auth.users where id in (v_a, v_w)) then v_fehl := v_fehl || 'Pruefkonten nicht zurueckgerollt'::text; end if;

  if array_length(v_fehl, 1) > 0 then
    raise exception 'Gegenprobe 0077 fehlgeschlagen: %', v_fehl;
  end if;
  raise notice 'Gegenprobe 0077 bestanden.';
end
$migration$;

commit;

-- RUECKBAU (nicht automatisch): Funktion aus supabase/cleanup/backup-2026-10-19/funktionen-vor-0077.txt (admin-only).
