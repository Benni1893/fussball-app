-- ============================================================================
-- FC Fasanerie-Nord - Migration 0070: Nachtrag zu 0069 (Gegenpruefung Runde 2)
--
-- 0069 band die Mitgliedschaft im offenen Onboarding an die Datenschutz-
-- Zustimmung. onboarding_abschliessen() (0063) setzte onboarding_offen aber
-- ohne Pruefung auf false; ein direkter Aufruf umging so die Sperre.
--   1. onboarding_abschliessen: nur mit gueltiger Datenschutz-Einwilligung.
--   2. ist_mitglied: Konten aus einem Trainer-Link brauchen die Zustimmung
--      immer, unabhaengig von onboarding_offen. Konten aus dem Spieler-Link
--      warten ohnehin auf Freigabe; Bestandskonten sind nicht betroffen.
-- Aufbau: EIN do-Block, Gegenprobe am Ende (zurueckgerollt).
-- ============================================================================

begin;

do $migration$
declare
  v_fehl text[] := '{}';
  v_admin uuid; v_tok text; v_t uuid := gen_random_uuid(); v_ok boolean; v_n integer;
begin
  execute $ddl$
  create or replace function public.ist_mitglied()
  returns boolean language sql stable security definer set search_path = public
  as $$
    select exists (select 1 from public.profiles p where p.id = auth.uid() and p.freigabe = 'aktiv'
                    and (exists (select 1 from public.einwilligungen e where e.profile_id = p.id and e.art = 'datenschutz' and e.widerrufen_am is null)
                         or (not p.onboarding_offen
                             and not exists (select 1 from public.einladungen l where l.id = p.eingeladen_ueber and l.art = 'trainer'))));
  $$
  $ddl$;

  execute $ddl$
  create or replace function public.onboarding_abschliessen()
  returns jsonb language plpgsql security definer set search_path = public
  as $$
  begin
    if auth.uid() is null then raise exception 'Nicht angemeldet.'; end if;
    if not exists (select 1 from public.einwilligungen where profile_id = auth.uid() and art = 'datenschutz' and widerrufen_am is null) then
      raise exception 'Bitte erst dem Datenschutz zustimmen.' using errcode = '42501';
    end if;
    update public.profiles set onboarding_offen = false where id = auth.uid();
    return public.mein_konto();
  end;
  $$
  $ddl$;

  -- Gegenprobe
  select user_id into v_admin from public.user_roles where role = 'admin' limit 1;
  select count(*) into v_n from public.profiles where freigabe = 'aktiv';
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
    if not public.ist_mitglied() then v_fehl := v_fehl || 'Admin kein Mitglied'::text; end if;
    v_tok := (public.trainer_link_erzeugen())->>'token';
    insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
      (v_t, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gp0070@invalid.local', jsonb_build_object('name', 'Gegen Umweg', 'einladung', v_tok), now(), now());
    perform set_config('request.jwt.claims', json_build_object('sub', v_t, 'role', 'authenticated')::text, true);
    v_ok := false; begin perform public.onboarding_abschliessen(); exception when sqlstate '42501' then v_ok := true; end;
    if not v_ok then v_fehl := v_fehl || 'Abschluss ohne Zustimmung'::text; end if;
    -- auch wenn onboarding_offen anders auf false kaeme: ohne Zustimmung kein Mitglied
    update public.profiles set onboarding_offen = false where id = v_t;
    if public.ist_mitglied() or public.ist_leitung() then v_fehl := v_fehl || 'Trainer-Link ohne Zustimmung Mitglied'::text; end if;
    perform public.einwilligung_setzen('datenschutz', true, 'DS-2026-10');
    if not public.ist_leitung() then v_fehl := v_fehl || 'nach Zustimmung keine Leitung'::text; end if;
    perform public.onboarding_abschliessen();
    perform set_config('request.jwt.claims', '', true);
    raise exception using errcode = 'P0070', message = 'zurückrollen';
  exception when sqlstate 'P0070' then null;
  end;
  -- Bestandskonten: alle drei weiterhin Mitglied
  select count(*) into v_n from public.profiles p where p.freigabe = 'aktiv'
     and exists (select 1 from auth.users u where u.id = p.id);
  if v_n <> 3 then v_fehl := v_fehl || ('Bestand ' || v_n); end if;

  if array_length(v_fehl, 1) > 0 then
    raise exception 'Gegenprobe 0070 fehlgeschlagen: %', v_fehl;
  end if;
  raise notice 'Gegenprobe 0070 bestanden.';
end
$migration$;

commit;

-- RUECKBAU (nicht automatisch): ist_mitglied wie 0069, onboarding_abschliessen wie 0063.
