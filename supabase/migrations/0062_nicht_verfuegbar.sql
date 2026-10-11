-- ============================================================================
-- FC Fasanerie-Nord - Migration 0062: Onboarding Nacharbeit 2,
--                                     Gesundheitsstatus nur mit Einwilligung
--
--   1. Neuer neutraler Status 'nicht_verfuegbar' (keine Gesundheitsangabe).
--   2. set_player_status: 'angeschlagen' und 'verletzt' nur fuer Spieler mit
--      gueltiger Einwilligung Gesundheit (Spieler ohne Konto haben keine, also
--      nie). Ohne Einwilligung nur 'fit', 'urlaub', 'nicht_verfuegbar', und
--      zwar OHNE Notiz (die Notiz wird verworfen).
--   3. Umwandlung bestehender Eintraege: 'angeschlagen'/'verletzt' von
--      Spielern ohne Einwilligung -> 'nicht_verfuegbar', Notiz leer,
--      "voraussichtlich bis" und "seit" bleiben. (Ausdruecklich freigegeben,
--      Paket Onboarding Nacharbeit, Punkt 2.)
--   4. Widerruf der Einwilligung: genauso umwandeln (statt wie in 0061 auf fit).
--   5. 'nicht_verfuegbar' zaehlt wie 'verletzt': fehlt am Termintag
--      (notify_spieler_faellt_aus[_am] -> Rueckmelde-Push, Nachfrage), Text in
--      der Status-Ablauf-Mitteilung (0059).
--   6. gesundheit_erlaubt_liste(): Spieler-IDs mit gueltiger Einwilligung,
--      fuer Trainer/Admin alle, sonst nur der eigene; Wartende nichts.
--
-- RECHTE: gesundheit_erlaubt_liste an authenticated, Hilfsfunktion intern.
-- Aufbau: EIN do-Block, Gegenprobe am Ende (zurueckgerollt).
-- ============================================================================

begin;

do $migration$
declare
  v_fehl text[] := '{}';
  v_vorher integer; v_umgewandelt integer;
  v_admin uuid; v_club uuid; v_pl uuid; v_neu uuid := gen_random_uuid(); v_tok text; v_t text;
begin
  -- 1) Status
  alter table public.player_status drop constraint player_status_status_check;
  alter table public.player_status add constraint player_status_status_check
    check (status in ('fit', 'angeschlagen', 'verletzt', 'urlaub', 'nicht_verfuegbar'));

  -- 2) Einwilligung je Spieler
  execute $ddl$
  create or replace function public.gesundheit_erlaubt_fuer(p_player uuid)
  returns boolean language sql stable security definer set search_path = public
  as $$
    select exists (select 1 from public.profiles p join public.einwilligungen e
                     on e.profile_id = p.id and e.art = 'gesundheit' and e.widerrufen_am is null
                    where p.player_id = p_player);
  $$
  $ddl$;
  revoke execute on function public.gesundheit_erlaubt_fuer(uuid) from public, anon, authenticated;

  execute $ddl$
  create or replace function public.gesundheit_erlaubt_liste()
  returns uuid[] language sql stable security definer set search_path = public
  as $$
    select case
      when public.ist_leitung() then coalesce((select array_agg(p.player_id) from public.profiles p
             join public.einwilligungen e on e.profile_id = p.id and e.art = 'gesundheit' and e.widerrufen_am is null
            where p.player_id is not null), '{}')
      when public.ist_mitglied() and public.my_player_id() is not null and public.gesundheit_erlaubt_fuer(public.my_player_id())
        then array[public.my_player_id()]
      else '{}'::uuid[] end;
  $$
  $ddl$;
  revoke execute on function public.gesundheit_erlaubt_liste() from public, anon;
  grant  execute on function public.gesundheit_erlaubt_liste() to authenticated;

  execute $ddl$
  create or replace function public.set_player_status(p_player_id uuid, p_status text, p_note text default null, p_until date default null)
  returns void language plpgsql security definer set search_path = public
  as $$
  declare
    cur  text;
    v_me uuid := public.my_player_id();
    v_ok boolean;
    v_note text;
  begin
    if not (public.has_role('coach') or public.has_role('admin')
            or (v_me is not null and p_player_id = v_me and public.ist_mitglied())) then
      raise exception 'Nur Trainer/Admin oder der eigene Status.';
    end if;
    if p_status not in ('fit', 'angeschlagen', 'verletzt', 'urlaub', 'nicht_verfuegbar') then
      raise exception 'Ungültiger Status: %', p_status;
    end if;
    if not exists (select 1 from public.players where id = p_player_id) then
      raise exception 'Spieler nicht gefunden.';
    end if;
    v_ok := public.gesundheit_erlaubt_fuer(p_player_id);
    if p_status in ('angeschlagen', 'verletzt') and not v_ok then
      raise exception 'Für diesen Status fehlt die Einwilligung zum Gesundheitsstatus. Möglich sind fit, Urlaub und nicht verfügbar.' using errcode = '42501';
    end if;
    -- Ohne Einwilligung keine Notiz (sie koennte Gesundheitsangaben enthalten).
    v_note := case when p_status = 'fit' or not v_ok then null else nullif(btrim(coalesce(p_note, '')), '') end;

    select status into cur from public.player_status where player_id = p_player_id;
    insert into public.player_status (player_id, status, status_note, status_until, status_since, updated_at)
    values (p_player_id, p_status, v_note,
            case when p_status = 'fit' then null else p_until end,
            case when p_status = 'fit' then null else current_date end,
            now())
    on conflict (player_id) do update set
      status       = p_status,
      status_note  = v_note,
      status_until = case when p_status = 'fit' then null else p_until end,
      status_since = case when p_status = 'fit' then null
                          when cur is null or cur = 'fit' or public.player_status.status_since is null then current_date
                          else public.player_status.status_since end,
      updated_at   = now();
  end;
  $$
  $ddl$;

  -- 4) Widerruf: umwandeln statt zuruecksetzen
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
      -- Widerruf Gesundheit (Nacharbeit 2): angeschlagen/verletzt -> nicht verfuegbar,
      -- "voraussichtlich bis" bleibt, Notizen weg.
      select player_id into v_pl from public.profiles where id = auth.uid();
      if v_pl is not null then
        update public.player_status set status = 'nicht_verfuegbar', status_note = null, updated_at = now()
         where player_id = v_pl and status in ('angeschlagen','verletzt');
        update public.player_status set status_note = null, updated_at = now() where player_id = v_pl and status_note is not null;
      end if;
    end if;
    return public.mein_konto();
  end;
  $$
  $ddl$;

  -- 5) Faellt aus: auch 'nicht_verfuegbar'
  execute $ddl$
  create or replace function public.notify_spieler_faellt_aus(p_player uuid)
  returns boolean language sql stable security definer set search_path = public
  as $$
    select exists (select 1 from public.player_status s
                    where s.player_id = p_player
                      and s.status in ('urlaub', 'verletzt', 'nicht_verfuegbar')
                      and (s.status_until is null
                           or s.status_until >= (now() at time zone 'Europe/Berlin')::date));
  $$
  $ddl$;
  execute $ddl$
  create or replace function public.notify_spieler_faellt_aus_am(p_player uuid, p_tag date)
  returns boolean language sql stable security definer set search_path = public
  as $$
      select exists (select 1 from public.player_status s
                      where s.player_id = p_player and s.status in ('urlaub', 'verletzt', 'nicht_verfuegbar')
                        and (s.status_until is null or s.status_until >= p_tag));
  $$
  $ddl$;
  revoke execute on function public.notify_spieler_faellt_aus(uuid), public.notify_spieler_faellt_aus_am(uuid, date) from public, anon, authenticated;

  execute $ddl$
  create or replace function public.notify_cron_status_abgelaufen(p_jetzt timestamptz default now())
  returns integer language plpgsql security definer set search_path = public
  as $$
  declare
    v_lokal  timestamp := p_jetzt at time zone 'Europe/Berlin';
    v_gest   date      := (p_jetzt at time zone 'Europe/Berlin')::date - 1;
    v_ab     constant date := date '2026-10-09';     -- Einspielen: nichts rueckwirkend
    v_anz    integer; v_namen text; v_einer record; v_kopf text; v_detail text;
    p record; v_id uuid; v_n integer := 0;
  begin
    if extract(hour from v_lokal) < 9 or v_gest < v_ab then return 0; end if;

    select count(*), string_agg(pl.name, ', ' order by pl.name)
      into v_anz, v_namen
      from public.player_status s join public.players pl on pl.id = s.player_id
     where s.status <> 'fit' and s.status_until = v_gest;
    if v_anz = 0 then return 0; end if;

    if v_anz = 1 then
      select pl.name, s.status into v_einer
        from public.player_status s join public.players pl on pl.id = s.player_id
       where s.status <> 'fit' and s.status_until = v_gest;
      v_kopf   := v_einer.name || ' wieder verfügbar';
      v_detail := case v_einer.status when 'verletzt' then 'Verletzt' when 'urlaub' then 'Urlaub'
                                      when 'nicht_verfuegbar' then 'Nicht verfügbar' else 'Angeschlagen' end
                  || ', voraussichtlich bis ' || public.notify_datum_kurz(v_gest);
    else
      v_kopf   := v_anz || ' Spieler wieder verfügbar: ' || v_namen;
      select 'Voraussichtlich bis ' || public.notify_datum_kurz(v_gest) || ': '
             || string_agg(pl.name || ' (' || case s.status when 'verletzt' then 'verletzt' when 'urlaub' then 'Urlaub'
                                                when 'nicht_verfuegbar' then 'nicht verfügbar' else 'angeschlagen' end || ')', ', ' order by pl.name) || '.'
        into v_detail
        from public.player_status s join public.players pl on pl.id = s.player_id
       where s.status <> 'fit' and s.status_until = v_gest;
    end if;

    for p in select t.uid as profile_id from public.notify_profile_mit_rolle('coach') as t(uid) loop
      v_id := public.notify_enqueue(p.profile_id, 'status_abgelaufen',
        jsonb_build_object('kopf', v_kopf, 'detail', v_detail, 'datum', public.notify_datum_kurz(v_gest)),
        p_dedup => 'status_abgelaufen:' || p.profile_id || ':' || v_gest);
      if v_id is not null then v_n := v_n + 1; end if;
    end loop;
    return v_n;
  end;
  $$
  $ddl$;
  revoke execute on function public.notify_cron_status_abgelaufen(timestamptz) from public, anon, authenticated;

  -- 3) Umwandlung bestehender Eintraege (freigegeben)
  select count(*) into v_vorher from public.player_status;
  update public.player_status s set status = 'nicht_verfuegbar', status_note = null, updated_at = now()
   where s.status in ('angeschlagen', 'verletzt') and not public.gesundheit_erlaubt_fuer(s.player_id);
  get diagnostics v_umgewandelt = row_count;
  raise notice 'Umgewandelt in nicht_verfuegbar: %', v_umgewandelt;

  -- --------------------------------------------------------------------------
  -- Gegenprobe
  -- --------------------------------------------------------------------------
  if (select count(*) from public.player_status) <> v_vorher then v_fehl := v_fehl || 'Zeilenzahl'::text; end if;
  if exists (select 1 from public.player_status s where s.status in ('angeschlagen','verletzt') and not public.gesundheit_erlaubt_fuer(s.player_id)) then
    v_fehl := v_fehl || 'Gesundheit ohne Einwilligung uebrig'::text;
  end if;
  if exists (select 1 from public.player_status s where s.status_note is not null and s.status = 'nicht_verfuegbar') then
    v_fehl := v_fehl || 'Notiz bei nicht_verfuegbar'::text;
  end if;
  if has_function_privilege('authenticated', 'public.gesundheit_erlaubt_fuer(uuid)', 'execute')
     or not has_function_privilege('authenticated', 'public.gesundheit_erlaubt_liste()', 'execute') then
    v_fehl := v_fehl || 'Rechte'::text;
  end if;

  select user_id into v_admin from public.user_roles where role = 'admin' limit 1;
  select id into v_club from public.clubs where slug = 'fcfn';
  begin
    v_pl := gen_random_uuid();
    insert into public.players (id, club_id, code, name) values (v_pl, v_club, 'gp0062', 'Gegen Probe 0062');
    perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
    -- Spieler ohne Konto: verletzt verboten, nicht verfuegbar ohne Notiz
    begin
      perform public.set_player_status(v_pl, 'verletzt', 'Knie', current_date + 3);
      v_fehl := v_fehl || 'verletzt ohne Konto erlaubt'::text;
    exception when sqlstate '42501' then null;
    end;
    perform public.set_player_status(v_pl, 'nicht_verfuegbar', 'Knie', current_date + 3);
    if (select status || '/' || coalesce(status_note, '-') || '/' || (status_until = current_date + 3)::text from public.player_status where player_id = v_pl) <> 'nicht_verfuegbar/-/true' then
      v_fehl := v_fehl || 'nicht_verfuegbar'::text;
    end if;
    perform public.set_player_status(v_pl, 'urlaub', 'Malle', current_date + 5);
    if (select coalesce(status_note, '-') from public.player_status where player_id = v_pl) <> '-' then
      v_fehl := v_fehl || 'Notiz ohne Einwilligung gespeichert'::text;
    end if;
    -- Konto mit Einwilligung: verletzt mit Notiz, Widerruf wandelt um
    v_tok := 'gp0062' || replace(gen_random_uuid()::text, '-', '');
    update public.einladungen set widerrufen_am = now() where club_id = v_club and widerrufen_am is null;
    insert into public.einladungen (club_id, token) values (v_club, v_tok);
    insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
    values (v_neu, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gegenprobe0062@invalid.local',
            jsonb_build_object('name', 'Gegen Probe', 'einladung', v_tok), now(), now());
    update public.profiles set freigabe = 'aktiv', player_id = v_pl where id = v_neu;
    perform set_config('request.jwt.claims', json_build_object('sub', v_neu, 'role', 'authenticated')::text, true);
    perform public.einwilligung_setzen('gesundheit', true, 'G1');
    perform public.set_player_status(v_pl, 'verletzt', 'Knie', current_date + 4);
    if (select status || '/' || coalesce(status_note, '-') from public.player_status where player_id = v_pl) <> 'verletzt/Knie' then
      v_fehl := v_fehl || 'verletzt mit Einwilligung'::text;
    end if;
    if not (v_pl = any(public.gesundheit_erlaubt_liste())) then v_fehl := v_fehl || 'Liste eigen'::text; end if;
    perform public.einwilligung_setzen('gesundheit', false, null);
    if (select status || '/' || coalesce(status_note, '-') || '/' || (status_until = current_date + 4)::text from public.player_status where player_id = v_pl) <> 'nicht_verfuegbar/-/true' then
      v_fehl := v_fehl || 'Widerruf wandelt nicht um'::text;
    end if;
    if not public.notify_spieler_faellt_aus_am(v_pl, current_date + 1) then v_fehl := v_fehl || 'faellt aus'::text; end if;
    if array_length(public.gesundheit_erlaubt_liste(), 1) is not null then v_fehl := v_fehl || 'Liste nach Widerruf'::text; end if;
    perform set_config('request.jwt.claims', '', true);
    raise exception using errcode = 'P0062', message = 'zurückrollen';
  exception when sqlstate 'P0062' then null;
  end;

  if array_length(v_fehl, 1) > 0 then
    raise exception 'Gegenprobe 0062 fehlgeschlagen: %', v_fehl;
  end if;
  raise notice 'Gegenprobe 0062 bestanden.';
end
$migration$;

commit;

-- RUECKBAU (nicht automatisch): Constraint ohne 'nicht_verfuegbar' erst, wenn
-- kein Eintrag mehr diesen Status hat; set_player_status und
-- einwilligung_setzen wie 0061, notify_spieler_faellt_aus[_am] wie 0043/0050,
-- notify_cron_status_abgelaufen wie 0059, neue Funktionen loeschen.
-- Die Umwandlung laesst sich nicht zurueckdrehen (Notizen sind geleert).
