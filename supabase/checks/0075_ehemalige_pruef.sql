-- ============================================================================
-- Prüfung zu Migration 0075 (Ehemalige Spieler nicht mehr mitzählen).
-- Ändert nichts: alles läuft in EINER Untertransaktion, die immer
-- zurückgerollt wird - Prüfkonto, Prüfspieler, Termine und Strafen sind
-- danach wieder weg (Gegenkontrolle am Ende).
--
-- Ablauf wie in der App: Ein Prüfkonto registriert sich (Einladung), wird
-- freigegeben und einem eigenen Kadereintrag zugeordnet, bekommt eine Strafe.
-- Dann entfernt ein Admin es über mitglied_entfernen ("Aus der Mannschaft
-- entfernen"). Danach:
--   - keine automatische Strafe beim nächsten Spiel
--   - keine Erinnerung und keine Nachfrage per Push, zählt bei "Push senden"
--     nicht mehr als offen
--   - die alte Strafe bleibt offen, sichtbar und lässt sich verbuchen
-- ============================================================================

drop table if exists pg_temp.pruef_0075;
create temp table pruef_0075 (nr serial, fall text, erwartet text, ergebnis text, urteil text);

do $pruef$
declare
  v_club uuid; v_admin uuid;
  v_t uuid := gen_random_uuid(); v_pl uuid := gen_random_uuid();
  v_alt uuid := gen_random_uuid(); v_ev uuid := gen_random_uuid(); v_ev2 uuid := gen_random_uuid();
  v_tok text := 'pruef0075' || replace(gen_random_uuid()::text, '-', '');
  v_n int; v_s text; v_r jsonb; v_vor int; v_nach int;
  procedure_dummy int;
  v_erg jsonb := '[]';  -- Ergebnisse ueberleben das Zurueckrollen nur in einer Variablen
begin
  select id into v_club from public.clubs where slug = 'fcfn';
  select r.user_id into v_admin from public.user_roles r join public.profiles p on p.id = r.user_id and p.freigabe = 'aktiv'
   where r.role = 'admin' limit 1;
  if v_admin is null then
    insert into pruef_0075 (fall, erwartet, ergebnis, urteil) values ('Admin-Konto vorhanden', 'ja', 'nein', 'FAIL');
    return;
  end if;

  begin
    -- Prüfkonto über eine Einladung, freigegeben, eigener Kadereintrag
    update public.einladungen set widerrufen_am = now() where widerrufen_am is null and art = 'spieler';
    insert into public.einladungen (club_id, token) values (v_club, v_tok);
    insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
      (v_t, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pruef0075@invalid.local',
       jsonb_build_object('name', 'Prüf Ehemalig', 'einladung', v_tok), now(), now());
    insert into public.players (id, club_id, code, name) values (v_pl, v_club, 'pr75', 'Prüf Ehemalig');
    update public.profiles set freigabe = 'aktiv', player_id = v_pl where id = v_t;
    insert into public.push_subscriptions (profile_id, endpoint, p256dh, auth)
      values (v_t, 'https://pruef.invalid/0075/' || v_t, 'x', 'x');
    -- alte Strafe, offen
    insert into public.fines (id, club_id, player_id, catalog_id, date, note)
      select v_alt, v_club, v_pl, k.id, current_date - 5, 'Prüfung 0075' from public.fine_catalog k where k.club_id = v_club and k.code = 'k04';
    -- künftiges Training ohne Rückmeldung: "Push senden" vorher zählen
    insert into public.events (id, club_id, type, title, date, time, auto_fine)
      values (v_ev2, v_club, 'training', 'Prüfung 0075 Training', current_date + 3, '19:00', false);
    perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
    v_r := public.send_rsvp_reminder(v_ev2, true); v_vor := (v_r->>'offen')::int;

    -- Entfernen wie in der App (Admin)
    perform public.mitglied_entfernen(v_t);
    v_r := public.send_rsvp_reminder(v_ev2, true); v_nach := (v_r->>'offen')::int;
    perform set_config('request.jwt.claims', '', true);

    select name || '/' || (ausgeschieden_am is not null)::text into v_s from public.players where id = v_pl;
    v_erg := v_erg || jsonb_build_array(jsonb_build_array('Kadereintrag nach dem Entfernen', 'Ehemaliger Spieler/true', coalesce(v_s, 'weg'), case when v_s = 'Ehemaliger Spieler/true' then 'PASS' else 'FAIL' end));
    v_erg := v_erg || jsonb_build_array(jsonb_build_array('Push senden zählt den Ehemaligen nicht mehr als offen', 'eins weniger', v_vor || ' -> ' || v_nach, case when v_vor - v_nach = 1 then 'PASS' else 'FAIL' end));

    -- vergangenes Spiel mit Auto-Strafe
    insert into public.events (id, club_id, type, title, date, time, auto_fine)
      values (v_ev, v_club, 'spiel', 'Prüfung 0075 Spiel', (now() at time zone 'Europe/Berlin')::date, to_char((now() at time zone 'Europe/Berlin') - interval '1 hour', 'HH24:MI'), true);
    update public.events set starts_at = now() - interval '1 hour', auto_fined_at = null where id = v_ev;
    perform public.apply_event_fines();
    select count(*) into v_n from public.fines where event_id = v_ev and player_id = v_pl;
    v_erg := v_erg || jsonb_build_array(jsonb_build_array('keine automatische Strafe nach dem Entfernen', '0', v_n::text, case when v_n = 0 then 'PASS' else 'FAIL' end));
    select count(*) into v_n from public.fines f join public.players p on p.id = f.player_id
     where f.event_id = v_ev and p.ausgeschieden_am is null;
    select count(*) into procedure_dummy from public.players where club_id = v_club and ausgeschieden_am is null;
    v_erg := v_erg || jsonb_build_array(jsonb_build_array('aktive Spieler bekommen die Auto-Strafe weiterhin', 'alle ohne Rückmeldung (' || procedure_dummy || ')', v_n::text, case when v_n = procedure_dummy then 'PASS' else 'FAIL' end));

    -- keine Push an das gelöschte Konto: Erinnerungen laufen, nichts an den Ehemaligen
    update public.events set deadline_override_hours = null where id = v_ev2;
    perform public.notify_cron_rueckmeldung();
    perform public.notify_cron_strafen_offen();
    select count(*) into v_n from public.notification_outbox where profile_id = v_t;
    v_erg := v_erg || jsonb_build_array(jsonb_build_array('keine Mitteilung an das entfernte Konto', '0', v_n::text, case when v_n = 0 then 'PASS' else 'FAIL' end));
    select count(*) into v_n from public.push_subscriptions where profile_id = v_t;
    v_erg := v_erg || jsonb_build_array(jsonb_build_array('Push-Abo des entfernten Kontos gelöscht', '0', v_n::text, case when v_n = 0 then 'PASS' else 'FAIL' end));

    -- alte Strafe bleibt offen und sichtbar (Admin über RLS)
    perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    select f.status into v_s from public.fines f where f.id = v_alt;
    execute 'reset role';
    v_erg := v_erg || jsonb_build_array(jsonb_build_array('alte Strafe bleibt offen und für die Kasse sichtbar', 'offen', coalesce(v_s, 'nicht sichtbar'), case when v_s = 'offen' then 'PASS' else 'FAIL' end));
    -- und lässt sich verbuchen
    perform public.mark_fines_paid(array[v_alt], 'bar');
    perform set_config('request.jwt.claims', '', true);
    select (paid)::text || '/' || status into v_s from public.fines where id = v_alt;
    v_erg := v_erg || jsonb_build_array(jsonb_build_array('alte Strafe lässt sich als bezahlt buchen', '…/bestätigt', coalesce(v_s, 'weg'), case when v_s like '%/bestätigt' then 'PASS' else 'FAIL' end));

    raise exception using errcode = 'P0075', message = 'zurückrollen';
  exception when sqlstate 'P0075' then null;
  end;
  insert into pruef_0075 (fall, erwartet, ergebnis, urteil)
    select x->>0, x->>1, x->>2, x->>3 from jsonb_array_elements(v_erg) x;

  -- Gegenkontrolle: Prüfdaten weg
  select count(*) into v_n from (
    select id from auth.users where id = v_t union all select id from public.players where id = v_pl
    union all select id from public.events where id in (v_ev, v_ev2) union all select id from public.fines where id = v_alt) x;
  insert into pruef_0075 (fall, erwartet, ergebnis, urteil) values
    ('Prüfdaten danach gelöscht', '0', v_n::text, case when v_n = 0 then 'PASS' else 'FAIL' end);
end
$pruef$;

select nr, fall, erwartet, ergebnis, urteil from pruef_0075
union all
select null, 'SUMME: ' || count(*) || ' Fälle, ' || count(*) filter (where urteil = 'PASS') || ' PASS, '
       || count(*) filter (where urteil = 'FAIL') || ' FAIL', null, null, null from pruef_0075
order by nr nulls last;
