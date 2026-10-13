-- ============================================================================
-- FC Fasanerie-Nord - Migration 0072: Widerruf Gesundheit loescht auch das Datum
--
-- Abnahme 13.10.2026, Befund B3, Entscheidung des Nutzers: Das Kriterium
-- "nach Widerruf sind Status, Notiz und Datum weg" bleibt. Bisher (0062) wurde
-- angeschlagen/verletzt zu "nicht verfuegbar", die Notiz geloescht, das Datum
-- "voraussichtlich bis" (status_until) blieb stehen.
--
--   einwilligung_setzen('gesundheit', false): fuer die umgewandelten Zeilen
--   (angeschlagen/verletzt) zusaetzlich status_until = null.
--
-- Unveraendert: Urlaub und ein schon gesetztes "nicht verfuegbar" behalten ihr
-- Datum (keine Gesundheitsangabe); Notizen werden wie bisher immer geloescht.
-- Nur der Branch "onboarding" ruft die Funktion auf (db.js); main kennt sie
-- nicht. Keine Datenaenderung am Bestand: Heute hat niemand die Einwilligung
-- widerrufen. Das grant (authenticated) bleibt bei create or replace erhalten.
-- Aufbau: EIN do-Block, Gegenprobe am Ende (Pruefkonto, zurueckgerollt).
-- ============================================================================

begin;

do $migration$
declare
  v_fehl text[] := '{}';
  v_club uuid; v_t uuid := gen_random_uuid(); v_pl uuid := gen_random_uuid();
  v_tok text := 'gp0072' || replace(gen_random_uuid()::text, '-', '');
  v_status_vorher text; v_status_nachher text; v_r text;
begin
  execute $ddl$
  create or replace function public.einwilligung_setzen(p_art text, p_an boolean, p_fassung text)
  returns jsonb language plpgsql security definer set search_path = public
  as $$
  declare v_pl uuid;
  begin
    if auth.uid() is null then raise exception 'Nicht angemeldet.'; end if;
    if p_art not in ('datenschutz','gesundheit') then raise exception 'Unbekannte Einwilligung.'; end if;
    if p_an then
      if coalesce(btrim(p_fassung), '') = '' then raise exception 'Fassung fehlt.'; end if;
      update public.einwilligungen set widerrufen_am = now()
       where profile_id = auth.uid() and art = p_art and widerrufen_am is null and fassung <> btrim(p_fassung);
      insert into public.einwilligungen (profile_id, art, fassung)
      select auth.uid(), p_art, btrim(p_fassung)
       where not exists (select 1 from public.einwilligungen where profile_id = auth.uid() and art = p_art and widerrufen_am is null);
    else
      if p_art = 'datenschutz' then raise exception 'Die Datenschutz-Zustimmung lässt sich nur mit dem Löschen des Kontos zurücknehmen.'; end if;
      update public.einwilligungen set widerrufen_am = now()
       where profile_id = auth.uid() and art = p_art and widerrufen_am is null;
      -- Widerruf Gesundheit (0062, 0072): angeschlagen/verletzt -> nicht verfuegbar,
      -- ohne Notiz und ohne "voraussichtlich bis"; Notizen immer weg.
      select player_id into v_pl from public.profiles where id = auth.uid();
      if v_pl is not null then
        update public.player_status set status = 'nicht_verfuegbar', status_note = null, status_until = null, updated_at = now()
         where player_id = v_pl and status in ('angeschlagen','verletzt');
        update public.player_status set status_note = null, updated_at = now() where player_id = v_pl and status_note is not null;
      end if;
    end if;
    return public.mein_konto();
  end;
  $$
  $ddl$;

  -- ---- Gegenprobe ------------------------------------------------------------
  if not has_function_privilege('authenticated', 'public.einwilligung_setzen(text, boolean, text)', 'execute') then
    v_fehl := v_fehl || 'grant authenticated fehlt'::text;
  end if;
  select md5(coalesce(string_agg(row_to_json(s)::text, '|' order by player_id), '')) into v_status_vorher from public.player_status s;
  select id into v_club from public.clubs where slug = 'fcfn';
  begin
    update public.einladungen set widerrufen_am = now() where widerrufen_am is null and art = 'spieler';
    insert into public.einladungen (club_id, token) values (v_club, v_tok);
    insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
      (v_t, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gp0072@invalid.local',
       jsonb_build_object('name', 'Gegen Widerruf', 'einladung', v_tok), now(), now());
    insert into public.players (id, club_id, code, name) values (v_pl, v_club, 'gp72', 'Gegen Widerruf');
    update public.profiles set freigabe = 'aktiv', player_id = v_pl where id = v_t;
    insert into public.einwilligungen (profile_id, art, fassung) values (v_t, 'datenschutz', 'G1'), (v_t, 'gesundheit', 'G1');
    insert into public.player_status (player_id, status, status_note, status_until) values (v_pl, 'verletzt', 'Knie', current_date + 6);
    perform set_config('request.jwt.claims', json_build_object('sub', v_t, 'role', 'authenticated')::text, true);

    perform public.einwilligung_setzen('gesundheit', false, null);
    select status || '/' || coalesce(status_note, '-') || '/' || coalesce(status_until::text, '-') into v_r from public.player_status where player_id = v_pl;
    if v_r <> 'nicht_verfuegbar/-/-' then v_fehl := v_fehl || ('Widerruf: ' || v_r); end if;

    perform public.einwilligung_setzen('gesundheit', true, 'G1');
    select status || '/' || coalesce(status_note, '-') || '/' || coalesce(status_until::text, '-') into v_r from public.player_status where player_id = v_pl;
    if v_r <> 'nicht_verfuegbar/-/-' then v_fehl := v_fehl || ('Erteilen danach: ' || v_r); end if;

    -- Urlaub mit Datum bleibt beim Widerruf (keine Gesundheitsangabe)
    update public.player_status set status = 'urlaub', status_until = current_date + 4 where player_id = v_pl;
    perform public.einwilligung_setzen('gesundheit', false, null);
    select status || '/' || coalesce(status_until::text, '-') into v_r from public.player_status where player_id = v_pl;
    if v_r <> 'urlaub/' || (current_date + 4)::text then v_fehl := v_fehl || ('Urlaub: ' || v_r); end if;

    perform set_config('request.jwt.claims', '', true);
    raise exception using errcode = 'P0072', message = 'zurückrollen';
  exception when sqlstate 'P0072' then null;
  end;
  -- keine Nebenwirkung am Bestand
  select md5(coalesce(string_agg(row_to_json(s)::text, '|' order by player_id), '')) into v_status_nachher from public.player_status s;
  if v_status_nachher is distinct from v_status_vorher then v_fehl := v_fehl || 'player_status veraendert'::text; end if;
  if exists (select 1 from auth.users where id = v_t) then v_fehl := v_fehl || 'Pruefkonto nicht zurueckgerollt'::text; end if;

  if array_length(v_fehl, 1) > 0 then
    raise exception 'Gegenprobe 0072 fehlgeschlagen: %', v_fehl;
  end if;
  raise notice 'Gegenprobe 0072 bestanden.';
end
$migration$;

commit;

-- RUECKBAU (nicht automatisch): einwilligung_setzen wie 0062 (ohne status_until = null).
