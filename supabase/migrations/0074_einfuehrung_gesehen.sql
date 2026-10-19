-- ============================================================================
-- FC Fasanerie-Nord - Migration 0074: Einfuehrung je Rolle "gesehen"
--
-- Nach der ersten Anmeldung sieht jeder einmal die Einfuehrung zu seiner Rolle
-- (Entwurf .design-sync/concepts/einfuehrung/). Gemerkt wird serverseitig je
-- Konto und Teil, damit sie auf einem neuen Geraet nicht wiederkommt und bei
-- einer neuen Rolle nur der neue Teil erscheint.
--
--   Tabelle einfuehrung_gesehen (user_id, teil, gesehen_am)
--     teil: 'spieler' | 'trainer' | 'kassenwart'
--   RLS: lesen und anlegen nur die eigene Zeile. Kein Aendern, kein Loeschen,
--   kein Zugriff fuer anon.
--   Konto loeschen: konto_entfernen_intern loescht auth.users, die Kaskade
--   ueber profiles nimmt die Zeilen mit.
--
-- Aufbau: EIN do-Block, Gegenprobe am Ende (zwei Pruefkonten, zurueckgerollt).
-- ============================================================================

begin;

do $migration$
declare
  v_fehl text[] := '{}';
  v_club uuid; v_a uuid := gen_random_uuid(); v_b uuid := gen_random_uuid();
  v_tok text := 'gp0074' || replace(gen_random_uuid()::text, '-', '');
  v_n int; v_r text;
begin
  -- ---- Vorher: Name frei, Bezug vorhanden -------------------------------------
  if to_regclass('public.einfuehrung_gesehen') is not null then
    raise exception 'Tabelle einfuehrung_gesehen gibt es schon.';
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.profiles'::regclass and contype = 'p') then
    raise exception 'profiles hat keinen Primaerschluessel.';
  end if;

  create table public.einfuehrung_gesehen (
    user_id    uuid not null references public.profiles(id) on delete cascade,
    teil       text not null check (teil in ('spieler','trainer','kassenwart')),
    gesehen_am timestamptz not null default now(),
    primary key (user_id, teil)
  );
  comment on table public.einfuehrung_gesehen is
    'Welche Teile der Einfuehrung (spieler, trainer, kassenwart) ein Konto gesehen oder uebersprungen hat. Nur eigene Zeilen, nur lesen und anlegen.';

  alter table public.einfuehrung_gesehen enable row level security;
  revoke all on public.einfuehrung_gesehen from anon, authenticated;
  grant select, insert on public.einfuehrung_gesehen to authenticated;

  create policy einfuehrung_gesehen_sel on public.einfuehrung_gesehen
    for select to authenticated using (user_id = auth.uid());
  create policy einfuehrung_gesehen_ins on public.einfuehrung_gesehen
    for insert to authenticated with check (user_id = auth.uid());

  -- ---- Gegenprobe ------------------------------------------------------------
  if has_table_privilege('anon', 'public.einfuehrung_gesehen', 'select') then v_fehl := v_fehl || 'anon darf lesen'::text; end if;
  if has_table_privilege('authenticated', 'public.einfuehrung_gesehen', 'update') then v_fehl := v_fehl || 'authenticated darf aendern'::text; end if;
  if has_table_privilege('authenticated', 'public.einfuehrung_gesehen', 'delete') then v_fehl := v_fehl || 'authenticated darf loeschen'::text; end if;

  select id into v_club from public.clubs where slug = 'fcfn';
  begin
    update public.einladungen set widerrufen_am = now() where widerrufen_am is null and art = 'spieler';
    insert into public.einladungen (club_id, token) values (v_club, v_tok);
    insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
      (v_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gp0074a@invalid.local',
       jsonb_build_object('name', 'Gegen Eins', 'einladung', v_tok), now(), now()),
      (v_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gp0074b@invalid.local',
       jsonb_build_object('name', 'Gegen Zwei', 'einladung', v_tok), now(), now());
    insert into public.einfuehrung_gesehen (user_id, teil) values (v_b, 'trainer');

    perform set_config('request.jwt.claims', json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    -- eigene Zeile anlegen, doppelt ohne Fehler (on conflict do nothing wie in db.js)
    insert into public.einfuehrung_gesehen (user_id, teil) values (v_a, 'spieler') on conflict do nothing;
    insert into public.einfuehrung_gesehen (user_id, teil) values (v_a, 'spieler') on conflict do nothing;
    select string_agg(teil, ',') into v_r from public.einfuehrung_gesehen;
    if v_r is distinct from 'spieler' then v_fehl := v_fehl || ('sieht: ' || coalesce(v_r, '-')); end if;
    -- fremde Zeile anlegen: verboten
    begin
      insert into public.einfuehrung_gesehen (user_id, teil) values (v_b, 'kassenwart');
      v_fehl := v_fehl || 'fremde Zeile angelegt'::text;
    exception when insufficient_privilege then null;
    end;
    -- unbekannter Teil: verboten
    begin
      insert into public.einfuehrung_gesehen (user_id, teil) values (v_a, 'admin');
      v_fehl := v_fehl || 'Teil admin angelegt'::text;
    exception when check_violation then null;
    end;
    -- aendern und loeschen: kein Recht
    begin
      update public.einfuehrung_gesehen set gesehen_am = now();
      v_fehl := v_fehl || 'aendern ging'::text;
    exception when insufficient_privilege then null;
    end;
    begin
      delete from public.einfuehrung_gesehen;
      v_fehl := v_fehl || 'loeschen ging'::text;
    exception when insufficient_privilege then null;
    end;
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);

    -- anon
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    execute 'set local role anon';
    begin
      select count(*) into v_n from public.einfuehrung_gesehen;
      v_fehl := v_fehl || 'anon liest'::text;
    exception when insufficient_privilege then null;
    end;
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);

    -- Konto loeschen nimmt die Zeilen mit
    delete from auth.users where id = v_a;
    select count(*) into v_n from public.einfuehrung_gesehen where user_id = v_a;
    if v_n <> 0 then v_fehl := v_fehl || 'Kaskade fehlt'::text; end if;

    raise exception using errcode = 'P0074', message = 'zurückrollen';
  exception when sqlstate 'P0074' then null;
  end;
  if exists (select 1 from auth.users where id in (v_a, v_b)) then v_fehl := v_fehl || 'Pruefkonten nicht zurueckgerollt'::text; end if;
  if exists (select 1 from public.einfuehrung_gesehen) then v_fehl := v_fehl || 'Tabelle nicht leer'::text; end if;

  if array_length(v_fehl, 1) > 0 then
    raise exception 'Gegenprobe 0074 fehlgeschlagen: %', v_fehl;
  end if;
  raise notice 'Gegenprobe 0074 bestanden.';
end
$migration$;

commit;

-- RUECKBAU (nicht automatisch): drop table public.einfuehrung_gesehen;
