-- ============================================================================
-- FC Fasanerie-Nord - Migration 0061: Anmeldung und Onboarding (O1)
--
-- Auftrag: Paket "Anmeldung und Onboarding", Entscheidungen E1 bis E11 und
-- Schutzregeln (11.10.2026). Bestandsaufnahme: .design-sync/onboarding/PHASE0.md.
--
-- NUR ADDITIV fuer die Live-App auf main: Die drei bestehenden Konten bleiben
-- aktiv mit ihren Rollen, ihre Sicht aendert sich nicht. Neu ist:
--
--   1. Freigabestatus profiles.freigabe (wartet | aktiv | abgelehnt). Die
--      bestehenden Zeilen bekommen 'aktiv', neue Konten starten mit 'wartet'.
--      ist_mitglied() = eigenes Profil aktiv. has_role() und my_roles() gelten
--      nur fuer Mitglieder; die Lese-Policies, die bisher using (true) hatten
--      (clubs, events, fines, fine_catalog, players, team_settings), lesen nur
--      noch fuer Mitglieder. Ein wartendes Konto sieht keine Mannschaftsdaten.
--   2. Einladung: Tabelle einladungen, ein gueltiger Link je Mannschaft bis
--      zum Widerruf (E9). handle_new_user legt ein Konto nur mit gueltigem
--      Token aus den Metadaten an (sonst Abbruch, E1) und speichert den Namen
--      (E6). Neue Anfrage -> Push an Trainer und Admin (anfrage_neu).
--   3. Freigabe: anfragen_liste, kader_frei, anfrage_freigeben (Zuordnung zu
--      einem Kadereintrag ohne Konto oder neuer Eintrag), anfrage_ablehnen.
--      Push an die Person (konto_freigegeben).
--   4. Rollen: mitglieder_liste, rolle_setzen (Trainer vergibt Trainer und
--      Kassenwart, nie Admin; Admin alles; mindestens ein Konto mit Trainer
--      oder Admin bleibt), Push an die Person (rolle_geaendert).
--   5. Protokoll konto_protokoll (wer, wann, was) fuer Freigabe, Ablehnung,
--      Rollenaenderung, Einladung, Kontoloeschung und Entfernen.
--   6. Position players.hauptposition (torwart | abwehr | mittelfeld | sturm),
--      aus den Kuerzeln abgeleitet; position und number bleiben (E7).
--   7. PayPal-Link der Mannschaft team_settings.paypal_name, vorbelegt mit dem
--      heutigen Wert; nur Kassenwart/Admin; Abfrage beim neuen Kassenwart;
--      faellt weg, wenn der Hinterleger die Rolle verliert (E8).
--   8. Einwilligungen (datenschutz, gesundheit) mit Zeitpunkt und Fassung.
--      Ohne Einwilligung Gesundheit kein Status angeschlagen/verletzt fuer
--      Spieler mit Konto; Widerruf loescht Status, Notiz und Datum (E11).
--   9. Konto loeschen bzw. aus der Mannschaft entfernen mit Anonymisierung:
--      Kadereintrag bleibt als "Ehemaliger Spieler" fuer die Kasse (Betraege
--      ohne Personenbezug), Status, Rueckmeldungen, Notizen, Push-Daten,
--      Einwilligungen und das Konto selbst werden geloescht.
--  10. BFV-Einstellungen: set_ical_url nur noch Trainer und Admin (E5).
--
-- RECHTE: alle neuen Tabellen mit RLS ohne Policies (nur ueber RPCs). Neue RPCs
-- ausdruecklich an authenticated; einladung_pruefen auch an anon.
-- Aufbau: EIN do-Block, Gegenprobe am Ende (zurueckgerollt).
-- ============================================================================

begin;

do $migration$
declare
  v_fehl text[] := '{}';
  v_kats text := $k$'strafe_neu','zahlung_bestaetigt','zahlung_abgelehnt','zahlung_gemeldet','absage_kurzfristig','termin_geaendert','termin_abgesagt','termin_neu','rueckmeldung_erinnerung','unterbesetzung','meldeschluss_uebersicht','strafen_offen','test','rueckmeldung_nachfrage','status_abgelaufen','anfrage_neu','konto_freigegeben','rolle_geaendert'$k$;
  v_club uuid; v_admin uuid; v_kasse uuid; v_tok text; v_neu uuid := gen_random_uuid(); v_neu2 uuid := gen_random_uuid();
  v_r jsonb; v_n integer; v_t text; v_pl uuid;
begin
  -- --------------------------------------------------------------------------
  -- 1) Spalten
  -- --------------------------------------------------------------------------
  alter table public.profiles add column if not exists freigabe text not null default 'aktiv';
  alter table public.profiles add constraint profiles_freigabe_chk check (freigabe in ('wartet','aktiv','abgelehnt'));
  alter table public.profiles alter column freigabe set default 'wartet';
  alter table public.profiles add column if not exists anzeigename text;
  alter table public.profiles add column if not exists angefragt_am timestamptz;
  alter table public.profiles add column if not exists wunsch_position text;
  alter table public.profiles add constraint profiles_wunsch_position_chk check (wunsch_position in ('torwart','abwehr','mittelfeld','sturm'));
  alter table public.profiles add column if not exists eingeladen_ueber uuid;
  alter table public.profiles add column if not exists entschieden_von uuid;
  alter table public.profiles add column if not exists entschieden_am timestamptz;
  alter table public.profiles add column if not exists paypal_frage boolean not null default false;

  alter table public.players add column if not exists hauptposition text;
  alter table public.players add constraint players_hauptposition_chk check (hauptposition in ('torwart','abwehr','mittelfeld','sturm'));
  alter table public.players add column if not exists ausgeschieden_am timestamptz;
  update public.players set hauptposition = case
      when upper(position) in ('TW','T','TOR') then 'torwart'
      when upper(position) in ('AV','IV','LV','RV','V','ABW') then 'abwehr'
      when upper(position) in ('ZM','OM','DM','LM','RM','M','MIT') then 'mittelfeld'
      when upper(position) in ('ST','MS','LA','RA','S','STU') then 'sturm'
    end
   where hauptposition is null and position is not null;

  alter table public.team_settings add column if not exists paypal_name text;
  alter table public.team_settings add column if not exists paypal_von uuid;
  alter table public.team_settings add column if not exists paypal_am timestamptz;
  select user_id into v_kasse from public.user_roles where role = 'treasurer' order by created_at limit 1;
  update public.team_settings set paypal_name = 'Teamkassefasanerie', paypal_von = v_kasse, paypal_am = now()
   where paypal_name is null;

  alter table public.notification_prefs add column if not exists anfrage_neu boolean not null default true;

  -- --------------------------------------------------------------------------
  -- 2) Neue Tabellen (RLS an, keine Policies: Zugriff nur ueber RPCs)
  -- --------------------------------------------------------------------------
  create table if not exists public.einladungen (
    id            uuid primary key default gen_random_uuid(),
    club_id       uuid not null references public.clubs(id) on delete cascade,
    token         text not null unique,
    erstellt_von  uuid,
    erstellt_am   timestamptz not null default now(),
    widerrufen_am timestamptz,
    widerrufen_von uuid
  );
  create unique index if not exists einladungen_eine_gueltige on public.einladungen(club_id) where widerrufen_am is null;

  create table if not exists public.konto_protokoll (
    id        bigint generated always as identity primary key,
    zeit      timestamptz not null default now(),
    akteur    uuid,
    ziel      uuid,
    ziel_name text,
    aktion    text not null,
    details   jsonb not null default '{}'
  );
  create index if not exists konto_protokoll_zeit on public.konto_protokoll(zeit desc);

  create table if not exists public.einwilligungen (
    id            uuid primary key default gen_random_uuid(),
    profile_id    uuid not null references public.profiles(id) on delete cascade,
    art           text not null check (art in ('datenschutz','gesundheit')),
    fassung       text not null,
    erteilt_am    timestamptz not null default now(),
    widerrufen_am timestamptz
  );
  create unique index if not exists einwilligungen_eine_aktive on public.einwilligungen(profile_id, art) where widerrufen_am is null;

  alter table public.einladungen enable row level security;
  alter table public.konto_protokoll enable row level security;
  alter table public.einwilligungen enable row level security;
  revoke all on public.einladungen, public.konto_protokoll, public.einwilligungen from public, anon, authenticated;

  -- --------------------------------------------------------------------------
  -- 3) Mitgliedschaft, Rollen
  -- --------------------------------------------------------------------------
  execute $ddl$
  create or replace function public.ist_mitglied()
  returns boolean language sql stable security definer set search_path = public
  as $$ select exists (select 1 from public.profiles where id = auth.uid() and freigabe = 'aktiv'); $$
  $ddl$;
  execute $ddl$
  create or replace function public.has_role(p_role text)
  returns boolean language sql stable security definer set search_path = public
  as $$ select public.ist_mitglied() and exists (select 1 from public.user_roles where user_id = auth.uid() and role = p_role); $$
  $ddl$;
  execute $ddl$
  create or replace function public.my_roles()
  returns text[] language sql stable security definer set search_path = public
  as $$ select case when public.ist_mitglied()
                    then coalesce((select array_agg(role) from public.user_roles where user_id = auth.uid()), '{}')
                    else '{}'::text[] end; $$
  $ddl$;
  execute $ddl$
  create or replace function public.ist_leitung()
  returns boolean language sql stable security definer set search_path = public
  as $$ select public.has_role('coach') or public.has_role('admin'); $$
  $ddl$;
  -- Anzahl aktiver Konten mit Trainer oder Admin, optional ohne eine Rolle eines Kontos.
  execute $ddl$
  create or replace function public.leitung_anzahl(p_ohne_profil uuid default null, p_ohne_rolle text default null)
  returns integer language sql stable security definer set search_path = public
  as $$
    select count(distinct r.user_id)::integer
      from public.user_roles r join public.profiles p on p.id = r.user_id and p.freigabe = 'aktiv'
     where r.role in ('coach','admin')
       and not (p_ohne_profil is not null and r.user_id = p_ohne_profil and (p_ohne_rolle is null or r.role = p_ohne_rolle));
  $$
  $ddl$;

  -- Lese-Policies: bisher using (true), jetzt nur Mitglieder.
  drop policy if exists read_clubs on public.clubs;
  create policy read_clubs on public.clubs for select to authenticated using (public.ist_mitglied());
  drop policy if exists read_events on public.events;
  create policy read_events on public.events for select to authenticated using (public.ist_mitglied());
  drop policy if exists read_fines on public.fines;
  create policy read_fines on public.fines for select to authenticated using (public.ist_mitglied());
  drop policy if exists read_fine_catalog on public.fine_catalog;
  create policy read_fine_catalog on public.fine_catalog for select to authenticated using (public.ist_mitglied());
  drop policy if exists read_players on public.players;
  create policy read_players on public.players for select to authenticated using (public.ist_mitglied());
  drop policy if exists team_settings_sel on public.team_settings;
  create policy team_settings_sel on public.team_settings for select to authenticated using (public.ist_mitglied());

  -- Spieler waehlen und Kalender-Token nur fuer Mitglieder.
  execute $ddl$
  create or replace function public.set_my_player(p_player_id uuid)
  returns void language plpgsql security definer set search_path = public
  as $$
  begin
    if not public.ist_mitglied() then raise exception 'Dein Konto ist noch nicht freigegeben.' using errcode = '42501'; end if;
    if p_player_id is not null and exists (
      select 1 from public.profiles where player_id = p_player_id and id <> auth.uid()
    ) then
      raise exception 'Dieser Spieler ist bereits einem anderen Konto zugeordnet.';
    end if;
    update public.profiles set player_id = p_player_id where id = auth.uid();
  end;
  $$
  $ddl$;
  execute $ddl$
  create or replace function public.my_calendar_token()
  returns text language plpgsql security definer set search_path = public
  as $$
  declare v_tok text;
  begin
    if auth.uid() is null then raise exception 'Nicht angemeldet.'; end if;
    if not public.ist_mitglied() then raise exception 'Dein Konto ist noch nicht freigegeben.' using errcode = '42501'; end if;
    select calendar_token into v_tok from public.profiles where id = auth.uid();
    if v_tok is null then
      v_tok := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
      update public.profiles set calendar_token = v_tok where id = auth.uid();
    end if;
    return v_tok;
  end;
  $$
  $ddl$;
  execute $ddl$
  create or replace function public.regenerate_calendar_token()
  returns text language plpgsql security definer set search_path = public
  as $$
  declare v_tok text;
  begin
    if auth.uid() is null then raise exception 'Nicht angemeldet.'; end if;
    if not public.ist_mitglied() then raise exception 'Dein Konto ist noch nicht freigegeben.' using errcode = '42501'; end if;
    v_tok := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
    update public.profiles set calendar_token = v_tok where id = auth.uid();
    return v_tok;
  end;
  $$
  $ddl$;

  -- BFV: nur Trainer und Admin (E5).
  execute $ddl$
  create or replace function public.set_ical_url(p_url text)
  returns void language plpgsql security definer set search_path = public
  as $$
  begin
    if not public.ist_leitung() then
      raise exception 'Nur Trainer oder Admin dürfen den Spielplan einstellen.' using errcode = '42501';
    end if;
    update public.clubs set ical_url = nullif(btrim(coalesce(p_url, '')), '') where slug = 'fcfn';
  end;
  $$
  $ddl$;

  -- --------------------------------------------------------------------------
  -- 4) Protokoll, Hilfen
  -- --------------------------------------------------------------------------
  execute $ddl$
  create or replace function public.konto_name(p_profil uuid)
  returns text language sql stable security definer set search_path = public
  as $$
    select coalesce(pl.name, p.anzeigename, split_part(p.email, '@', 1), 'Konto')
      from public.profiles p left join public.players pl on pl.id = p.player_id
     where p.id = p_profil;
  $$
  $ddl$;
  execute $ddl$
  create or replace function public.protokollieren(p_aktion text, p_ziel uuid, p_details jsonb default '{}')
  returns void language sql security definer set search_path = public
  as $$
    insert into public.konto_protokoll (akteur, ziel, ziel_name, aktion, details)
    values (auth.uid(), p_ziel, public.konto_name(p_ziel), p_aktion, coalesce(p_details, '{}'));
  $$
  $ddl$;
  execute $ddl$
  create or replace function public.einladung_gueltig(p_token text)
  returns uuid language sql stable security definer set search_path = public
  as $$ select id from public.einladungen where token = btrim(coalesce(p_token, '')) and widerrufen_am is null limit 1; $$
  $ddl$;

  -- --------------------------------------------------------------------------
  -- 5) Push-Kategorien (AM-Muster): anfrage_neu, konto_freigegeben, rolle_geaendert
  -- --------------------------------------------------------------------------
  execute 'alter table public.notification_templates drop constraint notification_templates_kat_chk';
  execute 'alter table public.notification_templates add constraint notification_templates_kat_chk check (kategorie in (' || v_kats || '))';
  execute 'alter table public.notification_outbox drop constraint notification_outbox_kat_chk';
  execute 'alter table public.notification_outbox add constraint notification_outbox_kat_chk check (kategorie in (' || v_kats || '))';

  insert into public.notification_templates
    (kategorie, titel_vorlage, text_vorlage, deep_link_vorlage, urgency, ttl_regel, ttl_sekunden,
     platzhalter, platzhalter_optional, beispiel_daten, empfaenger_beschreibung, ausloeser_beschreibung, aktiv)
  values
    ('anfrage_neu', '📋 Neue Anfrage: {name}', '{name} möchte in die Mannschaft. Bitte freigeben oder ablehnen.',
     '#ansicht=admin', 'normal', 'fix', 259200, array['name'], array[]::text[],
     '{"name":"Max Muster"}'::jsonb,
     'Alle mit der Rolle Trainer oder Admin.', 'Jemand registriert sich über den Einladungslink.', true),
    ('konto_freigegeben', '✅ Du bist freigegeben', 'Willkommen bei {mannschaft}. Ab jetzt siehst du Termine und kannst zu- oder absagen.',
     '#ansicht=dashboard', 'normal', 'fix', 604800, array['mannschaft'], array[]::text[],
     '{"mannschaft":"FC Fasanerie-Nord 2"}'::jsonb,
     'Die Person, deren Anfrage freigegeben wurde.', 'Trainer oder Admin geben eine Anfrage frei.', true),
    ('rolle_geaendert', '🔑 Deine Rolle hat sich geändert', '{aenderung}',
     '#ein=profil', 'normal', 'fix', 259200, array['aenderung'], array[]::text[],
     '{"aenderung":"Du bist jetzt Kassenwart."}'::jsonb,
     'Die Person, deren Rolle sich ändert.', 'Trainer oder Admin vergeben oder entziehen eine Rolle.', true)
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
      when 'test'                    then 'alle'
      else null
    end;
  $$
  $ddl$;
  revoke execute on function public.kategorie_rolle(text) from public, anon, authenticated;

  execute $ddl$
  create or replace function public.kategorie_erlaubt(p_profile uuid, p_kategorie text)
  returns boolean language plpgsql stable security definer set search_path = public
  as $$
  declare v_rolle text;
  begin
    v_rolle := public.kategorie_rolle(p_kategorie);
    if v_rolle is null then return false; end if;
    if v_rolle = 'alle' then return true; end if;
    if v_rolle = 'spieler' then
      return exists (select 1 from public.profiles where id = p_profile and player_id is not null and freigabe = 'aktiv');
    end if;
    -- 'leitung' = Trainer oder Admin (Onboarding: Anfragen gehen an beide).
    if v_rolle = 'leitung' then
      return exists (select 1 from public.user_roles r join public.profiles p on p.id = r.user_id and p.freigabe = 'aktiv'
                      where r.user_id = p_profile and r.role in ('coach','admin'));
    end if;
    -- Admin bekommt NICHT automatisch alles (0039).
    return exists (select 1 from public.user_roles where user_id = p_profile and role = v_rolle);
  end;
  $$
  $ddl$;
  revoke execute on function public.kategorie_erlaubt(uuid, text) from public, anon, authenticated;
  grant  execute on function public.kategorie_erlaubt(uuid, text) to service_role;

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
             end, false))
     and (o.ist_vorschau or o.kategorie = 'test'
          or not public.in_quiet_hours(p.quiet_from, p.quiet_to)
          or (o.urgency = 'high' and p.quiet_override_urgent))
  $ddl$;
  revoke all on public.notification_due from public, anon, authenticated;
  grant select on public.notification_due to service_role;

  execute $ddl$
  create or replace function public.set_notification_prefs(p_werte jsonb)
  returns void language plpgsql security definer set search_path = public
  as $$
  begin
    if auth.uid() is null then raise exception 'Nicht angemeldet.'; end if;
    insert into public.notification_prefs (profile_id) values (auth.uid()) on conflict (profile_id) do nothing;
    update public.notification_prefs set
      strafe_neu              = coalesce((p_werte->>'strafe_neu')::boolean,              strafe_neu),
      zahlung_bestaetigt      = coalesce((p_werte->>'zahlung_bestaetigt')::boolean,      zahlung_bestaetigt),
      zahlung_abgelehnt       = coalesce((p_werte->>'zahlung_abgelehnt')::boolean,       zahlung_abgelehnt),
      zahlung_gemeldet        = coalesce((p_werte->>'zahlung_gemeldet')::boolean,        zahlung_gemeldet),
      absage_kurzfristig      = coalesce((p_werte->>'absage_kurzfristig')::boolean,      absage_kurzfristig),
      termin_geaendert        = coalesce((p_werte->>'termin_geaendert')::boolean,        termin_geaendert),
      termin_abgesagt         = coalesce((p_werte->>'termin_abgesagt')::boolean,         termin_abgesagt),
      termin_neu              = coalesce((p_werte->>'termin_neu')::boolean,              termin_neu),
      rueckmeldung_erinnerung = coalesce((p_werte->>'rueckmeldung_erinnerung')::boolean, rueckmeldung_erinnerung),
      unterbesetzung          = coalesce((p_werte->>'unterbesetzung')::boolean,          unterbesetzung),
      meldeschluss_uebersicht = coalesce((p_werte->>'meldeschluss_uebersicht')::boolean, meldeschluss_uebersicht),
      strafen_offen           = coalesce((p_werte->>'strafen_offen')::boolean,           strafen_offen),
      status_abgelaufen       = coalesce((p_werte->>'status_abgelaufen')::boolean,       status_abgelaufen),
      anfrage_neu             = coalesce((p_werte->>'anfrage_neu')::boolean,             anfrage_neu),
      quiet_from              = coalesce((p_werte->>'quiet_from')::time,                 quiet_from),
      quiet_to                = coalesce((p_werte->>'quiet_to')::time,                   quiet_to),
      quiet_override_urgent   = coalesce((p_werte->>'quiet_override_urgent')::boolean,   quiet_override_urgent),
      hint_dismissed_at       = case when (p_werte->>'hint_dismissed')::boolean is true
                                     then coalesce(hint_dismissed_at, now()) else hint_dismissed_at end,
      updated_at              = now()
    where profile_id = auth.uid();
  end;
  $$
  $ddl$;

  -- --------------------------------------------------------------------------
  -- 6) Registrierung (Trigger auf auth.users)
  -- --------------------------------------------------------------------------
  execute $ddl$
  create or replace function public.handle_new_user()
  returns trigger language plpgsql security definer set search_path = public
  as $$
  declare v_club uuid; v_einl uuid; v_name text; p record;
  begin
    select id into v_club from public.clubs where slug = 'fcfn' limit 1;
    v_einl := public.einladung_gueltig(new.raw_user_meta_data->>'einladung');
    if v_einl is null then
      raise exception 'Registrierung nur mit gültigem Einladungslink.' using errcode = '42501';
    end if;
    v_name := left(btrim(regexp_replace(coalesce(new.raw_user_meta_data->>'name', ''), '\s+', ' ', 'g')), 60);
    if length(v_name) < 2 then
      raise exception 'Bitte gib deinen Namen an.' using errcode = '22023';
    end if;
    insert into public.profiles (id, email, club_id, freigabe, anzeigename, angefragt_am, eingeladen_ueber)
    values (new.id, new.email, v_club, 'wartet', v_name, now(), v_einl)
    on conflict (id) do nothing;
    insert into public.user_roles (user_id, role, club_id)
    values (new.id, 'player', v_club)
    on conflict (user_id, role, club_id) do nothing;
    insert into public.konto_protokoll (akteur, ziel, ziel_name, aktion, details)
    values (new.id, new.id, v_name, 'registriert', jsonb_build_object('einladung', v_einl));
    -- Push an Trainer und Admin; ein Fehler hier darf die Registrierung nicht verhindern.
    begin
      for p in select distinct r.user_id from public.user_roles r join public.profiles pr on pr.id = r.user_id and pr.freigabe = 'aktiv'
                where r.role in ('coach','admin') loop
        perform public.notify_enqueue(p.user_id, 'anfrage_neu', jsonb_build_object('name', v_name),
          p_dedup => 'anfrage_neu:' || new.id || ':' || p.user_id);
      end loop;
    exception when others then
      raise warning 'anfrage_neu: % %', sqlstate, sqlerrm;
    end;
    return new;
  end;
  $$
  $ddl$;

  -- --------------------------------------------------------------------------
  -- 7) Einladung
  -- --------------------------------------------------------------------------
  execute $ddl$
  create or replace function public.einladung_pruefen(p_token text)
  returns jsonb language plpgsql stable security definer set search_path = public
  as $$
  declare v_ok boolean;
  begin
    v_ok := public.einladung_gueltig(p_token) is not null;
    return jsonb_build_object('gueltig', v_ok,
      'mannschaft', case when v_ok then (select coalesce(team_name, name) from public.clubs where slug = 'fcfn') end);
  end;
  $$
  $ddl$;
  execute $ddl$
  create or replace function public.einladung_holen()
  returns jsonb language plpgsql security definer set search_path = public
  as $$
  declare e record; v_club uuid;
  begin
    if not public.ist_leitung() then raise exception 'Nur Trainer oder Admin.' using errcode = '42501'; end if;
    select id into v_club from public.clubs where slug = 'fcfn';
    select * into e from public.einladungen where club_id = v_club and widerrufen_am is null;
    if e.id is null then
      insert into public.einladungen (club_id, token, erstellt_von)
      values (v_club, replace(gen_random_uuid()::text, '-', ''), auth.uid()) returning * into e;
      perform public.protokollieren('einladung_erstellt', null, jsonb_build_object('einladung', e.id));
    end if;
    return jsonb_build_object('token', e.token, 'erstellt_am', e.erstellt_am);
  end;
  $$
  $ddl$;
  execute $ddl$
  create or replace function public.einladung_erneuern()
  returns jsonb language plpgsql security definer set search_path = public
  as $$
  declare v_club uuid; v_alt uuid;
  begin
    if not public.ist_leitung() then raise exception 'Nur Trainer oder Admin.' using errcode = '42501'; end if;
    select id into v_club from public.clubs where slug = 'fcfn';
    update public.einladungen set widerrufen_am = now(), widerrufen_von = auth.uid()
     where club_id = v_club and widerrufen_am is null returning id into v_alt;
    perform public.protokollieren('einladung_erneuert', null, jsonb_build_object('alt', v_alt));
    return public.einladung_holen();
  end;
  $$
  $ddl$;

  -- --------------------------------------------------------------------------
  -- 8) Mein Konto, Onboarding, Einwilligungen, Position
  -- --------------------------------------------------------------------------
  execute $ddl$
  create or replace function public.mein_konto()
  returns jsonb language plpgsql stable security definer set search_path = public
  as $$
  declare p record; v_ds record; v_ge record;
  begin
    if auth.uid() is null then raise exception 'Nicht angemeldet.'; end if;
    select * into p from public.profiles where id = auth.uid();
    if p.id is null then return jsonb_build_object('freigabe', 'unbekannt'); end if;
    select fassung, erteilt_am into v_ds from public.einwilligungen where profile_id = p.id and art = 'datenschutz' and widerrufen_am is null;
    select fassung, erteilt_am into v_ge from public.einwilligungen where profile_id = p.id and art = 'gesundheit' and widerrufen_am is null;
    return jsonb_build_object(
      'freigabe', p.freigabe,
      'name', public.konto_name(p.id),
      'anzeigename', p.anzeigename,
      'email', p.email,
      'hat_spieler', p.player_id is not null,
      'position', coalesce((select hauptposition from public.players where id = p.player_id), p.wunsch_position),
      'datenschutz', case when v_ds.fassung is not null then jsonb_build_object('fassung', v_ds.fassung, 'am', v_ds.erteilt_am) end,
      'gesundheit', case when v_ge.fassung is not null then jsonb_build_object('fassung', v_ge.fassung, 'am', v_ge.erteilt_am) end,
      'paypal_frage', p.paypal_frage and public.has_role('treasurer'),
      'leitung', public.ist_leitung(),
      'mannschaft', (select coalesce(team_name, name) from public.clubs where slug = 'fcfn'));
  end;
  $$
  $ddl$;
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
      -- Widerruf Gesundheit: Status, Notiz und Datum loeschen (E11).
      select player_id into v_pl from public.profiles where id = auth.uid();
      if v_pl is not null then
        update public.player_status set status = 'fit', status_note = null, status_until = null, status_since = null, updated_at = now()
         where player_id = v_pl and status in ('angeschlagen','verletzt');
        update public.player_status set status_note = null, updated_at = now() where player_id = v_pl and status_note is not null;
      end if;
    end if;
    return public.mein_konto();
  end;
  $$
  $ddl$;
  execute $ddl$
  create or replace function public.meine_position_setzen(p_position text)
  returns jsonb language plpgsql security definer set search_path = public
  as $$
  declare v_pl uuid;
  begin
    if auth.uid() is null then raise exception 'Nicht angemeldet.'; end if;
    if p_position not in ('torwart','abwehr','mittelfeld','sturm') then raise exception 'Unbekannte Position.'; end if;
    select player_id into v_pl from public.profiles where id = auth.uid();
    if v_pl is not null and public.ist_mitglied() then
      update public.players set hauptposition = p_position where id = v_pl;
    else
      update public.profiles set wunsch_position = p_position where id = auth.uid();
    end if;
    return public.mein_konto();
  end;
  $$
  $ddl$;

  -- Status: Gesundheit nur mit Einwilligung des Kontos (Spieler ohne Konto wie bisher).
  execute $ddl$
  create or replace function public.set_player_status(p_player_id uuid, p_status text, p_note text default null, p_until date default null)
  returns void language plpgsql security definer set search_path = public
  as $$
  declare
    cur  text;
    v_me uuid := public.my_player_id();
    v_konto uuid;
  begin
    if not (public.has_role('coach') or public.has_role('admin')
            or (v_me is not null and p_player_id = v_me and public.ist_mitglied())) then
      raise exception 'Nur Trainer/Admin oder der eigene Status.';
    end if;
    if p_status not in ('fit', 'angeschlagen', 'verletzt', 'urlaub') then
      raise exception 'Ungültiger Status: %', p_status;
    end if;
    if not exists (select 1 from public.players where id = p_player_id) then
      raise exception 'Spieler nicht gefunden.';
    end if;
    if p_status in ('angeschlagen', 'verletzt') then
      select id into v_konto from public.profiles where player_id = p_player_id;
      if v_konto is not null and not exists (select 1 from public.einwilligungen
            where profile_id = v_konto and art = 'gesundheit' and widerrufen_am is null) then
        raise exception 'Für diesen Status fehlt die Einwilligung zum Gesundheitsstatus.' using errcode = '42501';
      end if;
    end if;

    select status into cur from public.player_status where player_id = p_player_id;
    insert into public.player_status (player_id, status, status_note, status_until, status_since, updated_at)
    values (
      p_player_id, p_status,
      case when p_status = 'fit' then null else nullif(btrim(coalesce(p_note, '')), '') end,
      case when p_status = 'fit' then null else p_until end,
      case when p_status = 'fit' then null else current_date end,
      now()
    )
    on conflict (player_id) do update set
      status       = p_status,
      status_note  = case when p_status = 'fit' then null else nullif(btrim(coalesce(p_note, '')), '') end,
      status_until = case when p_status = 'fit' then null else p_until end,
      status_since = case when p_status = 'fit' then null
                          when cur is null or cur = 'fit' or public.player_status.status_since is null then current_date
                          else public.player_status.status_since end,
      updated_at   = now();
  end;
  $$
  $ddl$;

  -- --------------------------------------------------------------------------
  -- 9) Freigabe
  -- --------------------------------------------------------------------------
  execute $ddl$
  create or replace function public.anfragen_liste()
  returns jsonb language plpgsql stable security definer set search_path = public
  as $$
  begin
    if not public.ist_leitung() then raise exception 'Nur Trainer oder Admin.' using errcode = '42501'; end if;
    return coalesce((select jsonb_agg(jsonb_build_object(
        'id', p.id, 'name', p.anzeigename, 'email', p.email, 'angefragt_am', p.angefragt_am,
        'position', p.wunsch_position, 'freigabe', p.freigabe,
        'datenschutz', exists (select 1 from public.einwilligungen e where e.profile_id = p.id and e.art = 'datenschutz' and e.widerrufen_am is null))
        order by p.angefragt_am)
      from public.profiles p where p.freigabe = 'wartet'), '[]'::jsonb);
  end;
  $$
  $ddl$;
  execute $ddl$
  create or replace function public.kader_frei()
  returns jsonb language plpgsql stable security definer set search_path = public
  as $$
  begin
    if not public.ist_leitung() then raise exception 'Nur Trainer oder Admin.' using errcode = '42501'; end if;
    return coalesce((select jsonb_agg(jsonb_build_object('id', pl.id, 'name', pl.name, 'nummer', pl.number, 'position', pl.hauptposition) order by pl.name)
      from public.players pl
     where pl.ausgeschieden_am is null
       and not exists (select 1 from public.profiles p where p.player_id = pl.id)), '[]'::jsonb);
  end;
  $$
  $ddl$;
  execute $ddl$
  create or replace function public.anfrage_freigeben(p_profil uuid, p_player uuid default null, p_name text default null)
  returns jsonb language plpgsql security definer set search_path = public
  as $$
  declare p record; v_club uuid; v_pl uuid; v_code text; v_name text;
  begin
    if not public.ist_leitung() then raise exception 'Nur Trainer oder Admin.' using errcode = '42501'; end if;
    select * into p from public.profiles where id = p_profil for update;
    if p.id is null or p.freigabe <> 'wartet' then raise exception 'Keine offene Anfrage.'; end if;
    select id into v_club from public.clubs where slug = 'fcfn';
    if p_player is not null then
      if not exists (select 1 from public.players where id = p_player and ausgeschieden_am is null) then
        raise exception 'Kadereintrag nicht gefunden.';
      end if;
      if exists (select 1 from public.profiles where player_id = p_player) then
        raise exception 'Dieser Kadereintrag hat schon ein Konto.';
      end if;
      v_pl := p_player;
      update public.players set hauptposition = coalesce(hauptposition, p.wunsch_position) where id = v_pl;
    else
      v_name := left(btrim(coalesce(nullif(btrim(p_name), ''), p.anzeigename, '')), 60);
      if length(v_name) < 2 then raise exception 'Name fehlt.'; end if;
      select 'p' || lpad((coalesce(max(nullif(regexp_replace(code, '\D', '', 'g'), '')::integer), 0) + 1)::text, 2, '0')
        into v_code from public.players where club_id = v_club;
      insert into public.players (club_id, code, name, hauptposition)
      values (v_club, v_code, v_name, p.wunsch_position) returning id into v_pl;
    end if;
    update public.profiles set player_id = v_pl, freigabe = 'aktiv', entschieden_von = auth.uid(), entschieden_am = now()
     where id = p_profil;
    perform public.protokollieren('freigegeben', p_profil,
      jsonb_build_object('kadereintrag', v_pl, 'neu', p_player is null));
    perform public.notify_enqueue(p_profil, 'konto_freigegeben',
      jsonb_build_object('mannschaft', (select coalesce(team_name, name) from public.clubs where slug = 'fcfn')),
      p_dedup => 'konto_freigegeben:' || p_profil);
    return jsonb_build_object('profil', p_profil, 'spieler', v_pl);
  end;
  $$
  $ddl$;
  execute $ddl$
  create or replace function public.anfrage_ablehnen(p_profil uuid)
  returns void language plpgsql security definer set search_path = public
  as $$
  begin
    if not public.ist_leitung() then raise exception 'Nur Trainer oder Admin.' using errcode = '42501'; end if;
    update public.profiles set freigabe = 'abgelehnt', entschieden_von = auth.uid(), entschieden_am = now()
     where id = p_profil and freigabe = 'wartet';
    if not found then raise exception 'Keine offene Anfrage.'; end if;
    perform public.protokollieren('abgelehnt', p_profil);
  end;
  $$
  $ddl$;

  -- --------------------------------------------------------------------------
  -- 10) Rollen
  -- --------------------------------------------------------------------------
  execute $ddl$
  create or replace function public.mitglieder_liste()
  returns jsonb language plpgsql stable security definer set search_path = public
  as $$
  begin
    if not public.ist_leitung() then raise exception 'Nur Trainer oder Admin.' using errcode = '42501'; end if;
    return coalesce((select jsonb_agg(jsonb_build_object(
        'id', p.id, 'name', public.konto_name(p.id), 'email', p.email, 'ich', p.id = auth.uid(),
        'hat_spieler', p.player_id is not null,
        'rollen', coalesce((select jsonb_agg(r.role order by r.role) from public.user_roles r where r.user_id = p.id), '[]'::jsonb))
        order by public.konto_name(p.id))
      from public.profiles p where p.freigabe = 'aktiv'), '[]'::jsonb);
  end;
  $$
  $ddl$;
  execute $ddl$
  create or replace function public.rolle_setzen(p_profil uuid, p_rolle text, p_an boolean)
  returns jsonb language plpgsql security definer set search_path = public
  as $$
  declare v_club uuid; v_hat boolean; v_txt text;
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
    v_txt := 'Du bist ' || case when p_an then 'jetzt ' else 'nicht mehr ' end
             || case p_rolle when 'coach' then 'Trainer' when 'treasurer' then 'Kassenwart' else 'Admin' end || '.';
    if p_profil <> auth.uid() then
      perform public.notify_enqueue(p_profil, 'rolle_geaendert', jsonb_build_object('aenderung', v_txt),
        p_dedup => 'rolle_geaendert:' || p_profil || ':' || p_rolle || ':' || (extract(epoch from clock_timestamp()) * 1000)::bigint);
    end if;
    -- Wer sich selbst die Leitung nimmt, liest die Liste danach nicht mehr.
    return case when public.ist_leitung() then public.mitglieder_liste() else '[]'::jsonb end;
  end;
  $$
  $ddl$;
  execute $ddl$
  create or replace function public.protokoll_liste(p_anzahl integer default 50)
  returns jsonb language plpgsql stable security definer set search_path = public
  as $$
  begin
    if not public.ist_leitung() then raise exception 'Nur Trainer oder Admin.' using errcode = '42501'; end if;
    return coalesce((select jsonb_agg(x order by (x->>'zeit') desc) from (
      select jsonb_build_object('zeit', k.zeit, 'aktion', k.aktion, 'ziel', k.ziel_name,
                                'wer', coalesce(public.konto_name(k.akteur), 'gelöschtes Konto'), 'details', k.details) x
        from public.konto_protokoll k order by k.zeit desc limit greatest(1, least(coalesce(p_anzahl, 50), 200))) q), '[]'::jsonb);
  end;
  $$
  $ddl$;

  -- --------------------------------------------------------------------------
  -- 11) PayPal (E8)
  -- --------------------------------------------------------------------------
  execute $ddl$
  create or replace function public.paypal_setzen(p_name text)
  returns jsonb language plpgsql security definer set search_path = public
  as $$
  declare v text;
  begin
    if not (public.has_role('treasurer') or public.has_role('admin')) then
      raise exception 'Nur Kassenwart oder Admin.' using errcode = '42501';
    end if;
    v := btrim(coalesce(p_name, ''));
    v := regexp_replace(v, '^(https?://)?(www\.)?paypal\.me/', '', 'i');
    v := regexp_replace(v, '/.*$', '');
    if v <> '' and v !~ '^[A-Za-z0-9._-]{2,40}$' then
      raise exception 'Bitte nur den PayPal.me-Namen oder den Link angeben.';
    end if;
    update public.team_settings set paypal_name = nullif(v, ''), paypal_von = case when v = '' then null else auth.uid() end, paypal_am = now()
     where club_id = (select id from public.clubs where slug = 'fcfn');
    update public.profiles set paypal_frage = false where id = auth.uid();
    perform public.protokollieren('paypal_geaendert', auth.uid(), jsonb_build_object('gesetzt', v <> ''));
    return jsonb_build_object('paypal_name', nullif(v, ''));
  end;
  $$
  $ddl$;
  execute $ddl$
  create or replace function public.paypal_frage_erledigt()
  returns void language sql security definer set search_path = public
  as $$ update public.profiles set paypal_frage = false where id = auth.uid(); $$
  $ddl$;

  -- --------------------------------------------------------------------------
  -- 12) Konto loeschen / aus der Mannschaft entfernen (E11)
  -- --------------------------------------------------------------------------
  execute $ddl$
  create or replace function public.konto_entfernen_intern(p_profil uuid, p_aktion text)
  returns void language plpgsql security definer set search_path = public
  as $$
  declare v_pl uuid; v_code text;
  begin
    select player_id into v_pl from public.profiles where id = p_profil;
    insert into public.konto_protokoll (akteur, ziel, ziel_name, aktion, details)
    values (case when auth.uid() = p_profil then null else auth.uid() end, p_profil, 'gelöschtes Konto', p_aktion,
            jsonb_build_object('kadereintrag', v_pl));
    if v_pl is not null then
      delete from public.player_status where player_id = v_pl;
      delete from public.rsvps where player_id = v_pl;
      update public.fines set note = null, reported_note = null, reject_reason = null where player_id = v_pl;
      v_code := 'x' || substr(md5(v_pl::text), 1, 8);
      update public.players set name = 'Ehemaliger Spieler', code = v_code, number = null, position = null,
                                hauptposition = null, ausgeschieden_am = now()
       where id = v_pl;
    end if;
    update public.fine_status_log set changed_by = null where changed_by = p_profil;
    update public.einladungen set erstellt_von = null where erstellt_von = p_profil;
    update public.einladungen set widerrufen_von = null where widerrufen_von = p_profil;
    update public.konto_protokoll set ziel_name = 'gelöschtes Konto' where ziel = p_profil;
    update public.konto_protokoll set akteur = null where akteur = p_profil;
    update public.team_settings set paypal_name = null, paypal_von = null, paypal_am = now() where paypal_von = p_profil;
    update public.notification_templates set updated_by = null where updated_by = p_profil;
    update public.profiles set entschieden_von = null where entschieden_von = p_profil;
    -- Konto selbst: profiles, user_roles, Push-Daten, Einstellungen, Einwilligungen per Kaskade.
    delete from auth.users where id = p_profil;
  end;
  $$
  $ddl$;
  revoke execute on function public.konto_entfernen_intern(uuid, text) from public, anon, authenticated;

  execute $ddl$
  create or replace function public.konto_loeschen()
  returns void language plpgsql security definer set search_path = public
  as $$
  begin
    if auth.uid() is null then raise exception 'Nicht angemeldet.'; end if;
    if public.ist_leitung() and public.leitung_anzahl(auth.uid(), null) = 0 then
      raise exception 'Du bist das letzte Konto mit Trainer- oder Admin-Rolle. Gib die Rolle erst an jemand anderen.';
    end if;
    perform public.konto_entfernen_intern(auth.uid(), 'konto_geloescht');
  end;
  $$
  $ddl$;
  execute $ddl$
  create or replace function public.mitglied_entfernen(p_profil uuid)
  returns void language plpgsql security definer set search_path = public
  as $$
  begin
    if not public.ist_leitung() then raise exception 'Nur Trainer oder Admin.' using errcode = '42501'; end if;
    if p_profil = auth.uid() then raise exception 'Das eigene Konto löschst du im Profil.'; end if;
    if not exists (select 1 from public.profiles where id = p_profil) then raise exception 'Konto nicht gefunden.'; end if;
    if exists (select 1 from public.user_roles where user_id = p_profil and role = 'admin') and not public.has_role('admin') then
      raise exception 'Den Admin entfernt nur der Admin.' using errcode = '42501';
    end if;
    if public.leitung_anzahl(p_profil, null) = 0 then
      raise exception 'Mindestens ein Konto muss Trainer oder Admin bleiben.';
    end if;
    perform public.konto_entfernen_intern(p_profil, 'entfernt');
  end;
  $$
  $ddl$;

  -- --------------------------------------------------------------------------
  -- 13) Rechte
  -- --------------------------------------------------------------------------
  revoke execute on function public.ist_mitglied(), public.ist_leitung(), public.leitung_anzahl(uuid, text),
    public.konto_name(uuid), public.protokollieren(text, uuid, jsonb), public.einladung_gueltig(text)
    from public, anon, authenticated;
  -- has_role/my_roles/ist_mitglied werden in RLS-Policies ausgewertet (security definer, Aufrufrecht noetig).
  grant execute on function public.ist_mitglied() to authenticated;
  grant execute on function public.ist_leitung() to authenticated;
  revoke execute on function public.einladung_pruefen(text) from public;
  grant  execute on function public.einladung_pruefen(text) to anon, authenticated;
  revoke execute on function public.einladung_holen(), public.einladung_erneuern(), public.mein_konto(),
    public.einwilligung_setzen(text, boolean, text), public.meine_position_setzen(text), public.anfragen_liste(),
    public.kader_frei(), public.anfrage_freigeben(uuid, uuid, text), public.anfrage_ablehnen(uuid),
    public.mitglieder_liste(), public.rolle_setzen(uuid, text, boolean), public.protokoll_liste(integer),
    public.paypal_setzen(text), public.paypal_frage_erledigt(), public.konto_loeschen(), public.mitglied_entfernen(uuid)
    from public, anon;
  grant execute on function public.einladung_holen(), public.einladung_erneuern(), public.mein_konto(),
    public.einwilligung_setzen(text, boolean, text), public.meine_position_setzen(text), public.anfragen_liste(),
    public.kader_frei(), public.anfrage_freigeben(uuid, uuid, text), public.anfrage_ablehnen(uuid),
    public.mitglieder_liste(), public.rolle_setzen(uuid, text, boolean), public.protokoll_liste(integer),
    public.paypal_setzen(text), public.paypal_frage_erledigt(), public.konto_loeschen(), public.mitglied_entfernen(uuid)
    to authenticated;
  revoke execute on function public.handle_new_user() from public, anon, authenticated;

  -- --------------------------------------------------------------------------
  -- Gegenprobe
  -- --------------------------------------------------------------------------
  if (select count(*) from public.profiles where freigabe <> 'aktiv') > 0 then v_fehl := v_fehl || 'bestehende Konten nicht aktiv'::text; end if;
  if (select count(*) from public.user_roles) <> 5 then v_fehl := v_fehl || 'Rollen veraendert'::text; end if;
  if (select paypal_name from public.team_settings limit 1) is distinct from 'Teamkassefasanerie' then v_fehl := v_fehl || 'PayPal-Vorbelegung'::text; end if;
  if (select count(*) from public.players where position is not null and hauptposition is null) > 0 then v_fehl := v_fehl || 'Hauptposition'::text; end if;
  if has_function_privilege('anon', 'public.anfrage_freigeben(uuid, uuid, text)', 'execute')
     or not has_function_privilege('anon', 'public.einladung_pruefen(text)', 'execute')
     or has_function_privilege('authenticated', 'public.konto_entfernen_intern(uuid, text)', 'execute')
     or has_table_privilege('authenticated', 'public.einwilligungen', 'select') then
    v_fehl := v_fehl || 'Rechte'::text;
  end if;

  select ur.user_id into v_admin from public.user_roles ur where ur.role = 'admin' limit 1;
  select id into v_club from public.clubs where slug = 'fcfn';
  begin
    -- bestehendes Mitglied sieht weiter alles
    perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
    if not public.ist_mitglied() or not public.has_role('admin') or array_length(public.my_roles(), 1) < 1 then
      v_fehl := v_fehl || 'Admin nicht Mitglied'::text;
    end if;
    v_tok := (public.einladung_holen())->>'token';
    -- Registrierung ohne Token scheitert
    begin
      insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
      values (v_neu2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gegenprobe0061b@invalid.local', '{"name":"Ohne Link"}', now(), now());
      v_fehl := v_fehl || 'ohne Token registriert'::text;
    exception when sqlstate '42501' then null;
    end;
    -- Registrierung mit Token: wartet, Push an Leitung
    insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
    values (v_neu, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gegenprobe0061@invalid.local',
            jsonb_build_object('name', 'Gegen Probe', 'einladung', v_tok), now(), now());
    if (select freigabe || '/' || anzeigename from public.profiles where id = v_neu) is distinct from 'wartet/Gegen Probe' then
      v_fehl := v_fehl || 'neues Konto nicht wartend'::text;
    end if;
    if not exists (select 1 from public.notification_outbox where kategorie = 'anfrage_neu' and profile_id = v_admin and dedup_key = 'anfrage_neu:' || v_neu || ':' || v_admin) then
      v_fehl := v_fehl || 'anfrage_neu fehlt'::text;
    end if;
    -- wartendes Konto sieht nichts
    perform set_config('request.jwt.claims', json_build_object('sub', v_neu, 'role', 'authenticated')::text, true);
    if public.ist_mitglied() or public.has_role('player') or array_length(public.my_roles(), 1) is not null then
      v_fehl := v_fehl || 'wartend ist Mitglied'::text;
    end if;
    if (public.mein_konto())->>'freigabe' <> 'wartet' then v_fehl := v_fehl || 'mein_konto'::text; end if;
    perform public.meine_position_setzen('abwehr');
    perform public.einwilligung_setzen('datenschutz', true, 'P1');
    -- Freigabe mit neuem Kadereintrag
    perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
    if jsonb_array_length(public.anfragen_liste()) < 1 then v_fehl := v_fehl || 'anfragen_liste'::text; end if;
    v_r := public.anfrage_freigeben(v_neu, null, null);
    v_pl := (v_r->>'spieler')::uuid;
    if (select name || '/' || coalesce(hauptposition, '-') from public.players where id = v_pl) is distinct from 'Gegen Probe/abwehr'
       or (select freigabe from public.profiles where id = v_neu) <> 'aktiv' then
      v_fehl := v_fehl || ('Freigabe: ' || v_r::text);
    end if;
    if not exists (select 1 from public.notification_outbox where kategorie = 'konto_freigegeben' and profile_id = v_neu) then
      v_fehl := v_fehl || 'konto_freigegeben fehlt'::text;
    end if;
    -- Rollen: Kassenwart vergeben, Schutzregel
    perform public.rolle_setzen(v_neu, 'treasurer', true);
    if not (select paypal_frage from public.profiles where id = v_neu) then v_fehl := v_fehl || 'paypal_frage'::text; end if;
    perform public.rolle_setzen(v_neu, 'coach', true);
    begin
      perform public.rolle_setzen(v_admin, 'admin', false);   -- es bleibt v_neu als Trainer: erlaubt
    exception when others then v_fehl := v_fehl || ('Admin abgeben: ' || sqlerrm); end;
    perform set_config('request.jwt.claims', json_build_object('sub', v_neu, 'role', 'authenticated')::text, true);
    begin
      perform public.rolle_setzen(v_neu, 'coach', false);      -- letzter Berechtigter: verboten
      v_fehl := v_fehl || 'letzter Trainer entzogen'::text;
    exception when others then null;
    end;
    begin
      perform public.rolle_setzen(v_admin, 'admin', true);     -- Trainer vergibt nie Admin
      v_fehl := v_fehl || 'Trainer vergab Admin'::text;
    exception when sqlstate '42501' then null;
    end;
    -- Kassenwart setzt PayPal, Entzug loescht ihn
    perform public.paypal_setzen('https://paypal.me/Gegenprobe/5');
    if (select paypal_name from public.team_settings limit 1) <> 'Gegenprobe' then v_fehl := v_fehl || 'paypal_setzen'::text; end if;
    perform public.rolle_setzen(v_neu, 'treasurer', false);
    if (select paypal_name from public.team_settings limit 1) is not null then v_fehl := v_fehl || 'paypal bleibt'::text; end if;
    -- Gesundheit: ohne Einwilligung kein verletzt, Widerruf loescht
    perform set_config('request.jwt.claims', json_build_object('sub', v_neu, 'role', 'authenticated')::text, true);
    begin
      perform public.set_player_status(v_pl, 'verletzt', 'Knie', current_date + 3);
      v_fehl := v_fehl || 'verletzt ohne Einwilligung'::text;
    exception when sqlstate '42501' then null;
    end;
    perform public.einwilligung_setzen('gesundheit', true, 'G1');
    perform public.set_player_status(v_pl, 'verletzt', 'Knie', current_date + 3);
    perform public.einwilligung_setzen('gesundheit', false, 'G1');
    if (select status || coalesce(status_note, '') || coalesce(status_until::text, '') from public.player_status where player_id = v_pl) <> 'fit' then
      v_fehl := v_fehl || 'Widerruf loescht nicht'::text;
    end if;
    -- Konto loeschen: Admin ist wieder einziger -> v_neu darf als Trainer loeschen, da Admin? Admin hat admin abgegeben;
    -- also zuerst Admin zurueck (als v_neu nicht moeglich), daher Loeschen von v_neu muss scheitern.
    begin
      perform public.konto_loeschen();
      v_fehl := v_fehl || 'letzter Berechtigter geloescht'::text;
    exception when others then null;
    end;
    raise exception using errcode = 'P0061', message = 'zurückrollen';
  exception when sqlstate 'P0061' then null;
  end;

  -- zweiter Durchgang: Loeschen mit Anonymisierung (zurueckgerollt)
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
    v_tok := (public.einladung_holen())->>'token';
    insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
    values (v_neu, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gegenprobe0061@invalid.local',
            jsonb_build_object('name', 'Gegen Probe', 'einladung', v_tok), now(), now());
    v_pl := ((public.anfrage_freigeben(v_neu, null, null))->>'spieler')::uuid;
    insert into public.fines (club_id, player_id, date, offense, base_amount, status, note) values (v_club, v_pl, current_date, 'Gegenprobe', 5, 'offen', 'Notiz');
    insert into public.rsvps (club_id, event_id, player_id, status) select v_club, id, v_pl, 'zu' from public.events order by date desc limit 1;
    perform set_config('request.jwt.claims', json_build_object('sub', v_neu, 'role', 'authenticated')::text, true);
    perform public.konto_loeschen();
    if exists (select 1 from auth.users where id = v_neu) or exists (select 1 from public.profiles where id = v_neu) then
      v_fehl := v_fehl || 'Konto nicht geloescht'::text;
    end if;
    if (select name || '/' || (ausgeschieden_am is not null)::text from public.players where id = v_pl) <> 'Ehemaliger Spieler/true'
       or exists (select 1 from public.rsvps where player_id = v_pl)
       or (select count(*) from public.fines where player_id = v_pl and base_amount = 5 and note is null) <> 1 then
      v_fehl := v_fehl || 'Anonymisierung'::text;
    end if;
    -- erneuerter Link: alter ungueltig
    perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
    v_t := (public.einladung_erneuern())->>'token';
    if (public.einladung_pruefen(v_tok))->>'gueltig' <> 'false' or (public.einladung_pruefen(v_t))->>'gueltig' <> 'true' then
      v_fehl := v_fehl || 'Einladung erneuern'::text;
    end if;
    perform set_config('request.jwt.claims', '', true);
    raise exception using errcode = 'P0061', message = 'zurückrollen';
  exception when sqlstate 'P0061' then null;
  end;

  if array_length(v_fehl, 1) > 0 then
    raise exception 'Gegenprobe 0061 fehlgeschlagen: %', v_fehl;
  end if;
  raise notice 'Gegenprobe 0061 bestanden.';
end
$migration$;

commit;

-- RUECKBAU (nicht automatisch): Policies read_* wieder using (true), has_role
-- und my_roles wie 0004, handle_new_user wie 0004, set_my_player wie 0002,
-- Kalender-Token wie 0020, set_ical_url wie 0051, set_player_status wie 0031,
-- kategorie_rolle/notification_due/set_notification_prefs wie 0059,
-- kategorie_erlaubt wie 0039, neue Funktionen und Tabellen loeschen,
-- Spalten entfernen (erst nach Pruefung, ob neue Konten existieren).
