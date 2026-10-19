-- ============================================================================
-- Prüfung zu Migration 0078 (keine Auto-Strafe, wenn der Meldeschluss weniger
-- als 24 h nach der Freigabe liegt; Übersicht nach Meldeschluss zählt diese
-- Spieler nicht als offen). Ändert nichts: eine Untertransaktion, die immer
-- zurückgerollt wird; Ergebnisse überleben nur in einer Variablen.
--   Neu   = Konto über Einladung, freigegeben vor 10 h (anfrage_freigeben)
--   Grenze= freigegeben genau 25 h vor dem Meldeschluss (gilt als alt)
--   Alt   = Kadereintrag ohne Konto, angelegt vor 10 Tagen
-- ============================================================================

drop table if exists pg_temp.pruef_0078;
create temp table pruef_0078 (nr serial, fall text, erwartet text, ergebnis text, urteil text);

do $pruef$
declare
  v_club uuid; v_admin uuid; v_tok text := 'pruef0078' || replace(gen_random_uuid()::text, '-', '');
  v_neu uuid := gen_random_uuid(); v_tr uuid := gen_random_uuid();
  v_pneu uuid; v_pgr uuid := gen_random_uuid(); v_palt uuid := gen_random_uuid();
  v_e1 uuid := gen_random_uuid(); v_e2 uuid := gen_random_uuid(); v_e3 uuid := gen_random_uuid();
  v_n int; v_s text; v_j jsonb; v_erg jsonb := '[]'; v_aktiv int;
begin
  select id into v_club from public.clubs where slug = 'fcfn';
  select r.user_id into v_admin from public.user_roles r join public.profiles p on p.id = r.user_id and p.freigabe = 'aktiv' where r.role = 'admin' limit 1;
  begin
    update public.einladungen set widerrufen_am = now() where widerrufen_am is null and art = 'spieler';
    insert into public.einladungen (club_id, token) values (v_club, v_tok);
    insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
      (v_neu, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pruef0078n@invalid.local', jsonb_build_object('name', 'Prüf Neu', 'einladung', v_tok), now(), now()),
      (v_tr,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pruef0078t@invalid.local', jsonb_build_object('name', 'Prüf Trainer', 'einladung', v_tok), now(), now());
    -- Freigabe wie in der App (Admin), danach auf "vor 10 Stunden" datiert
    perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
    perform public.anfrage_freigeben(v_neu);
    perform public.anfrage_freigeben(p_profil => v_tr, p_ohne_kader => true);
    perform set_config('request.jwt.claims', '', true);
    update public.profiles set entschieden_am = now() - interval '10 hours' where id = v_neu returning player_id into v_pneu;
    insert into public.user_roles (user_id, role, club_id) values (v_tr, 'coach', v_club);
    insert into public.players (id, club_id, code, name, created_at) values
      (v_pgr, v_club, 'pr78g', 'Prüf Grenze', now() - interval '50 hours'),
      (v_palt, v_club, 'pr78a', 'Prüf Alt', now() - interval '10 days');

    -- 1) Spiel vor 1 h, Meldeschluss vor 25 h, niemand hat geantwortet
    insert into public.events (id, club_id, type, title, date, time, auto_fine)
      values (v_e1, v_club, 'spiel', 'Prüfung 0078 Spiel', (now() at time zone 'Europe/Berlin')::date, to_char((now() at time zone 'Europe/Berlin') - interval '1 hour', 'HH24:MI'), true);
    update public.events set starts_at = now() - interval '1 hour', deadline_at = now() - interval '25 hours', auto_fined_at = null where id = v_e1;
    perform public.apply_event_fines();
    select count(*) into v_n from public.fines where event_id = v_e1 and player_id = v_pneu;
    v_erg := v_erg || jsonb_build_array(jsonb_build_array('Neu (freigegeben 10 h vor Anpfiff): keine Strafe „keine Rückmeldung“', '0', v_n::text));
    select count(*) into v_n from public.fines where event_id = v_e1 and player_id = v_pgr;
    v_erg := v_erg || jsonb_build_array(jsonb_build_array('Grenze (25 h vor Meldeschluss): Strafe', '1', v_n::text));
    select count(*) into v_n from public.fines where event_id = v_e1 and player_id = v_palt;
    v_erg := v_erg || jsonb_build_array(jsonb_build_array('Alt (10 Tage): Strafe', '1', v_n::text));

    -- 2) Training in 2 h, Meldeschluss vor 1 h: verspätete Zusage
    insert into public.events (id, club_id, type, title, date, time, auto_fine)
      values (v_e2, v_club, 'training', 'Prüfung 0078 Training', (now() at time zone 'Europe/Berlin')::date, '23:59', true);
    update public.events set starts_at = now() + interval '2 hours', deadline_at = now() - interval '1 hour' where id = v_e2;
    insert into public.rsvps (club_id, event_id, player_id, status) values (v_club, v_e2, v_pneu, 'zu'), (v_club, v_e2, v_palt, 'zu');
    select count(*) into v_n from public.fines where event_id = v_e2 and player_id = v_pneu;
    v_erg := v_erg || jsonb_build_array(jsonb_build_array('Neu: verspätete Zusage ohne Strafe', '0', v_n::text));
    select count(*) into v_n from public.fines where event_id = v_e2 and player_id = v_palt;
    v_erg := v_erg || jsonb_build_array(jsonb_build_array('Alt: verspätete Zusage kostet', '1', v_n::text));

    -- 3) Übersicht nach Meldeschluss: Training in 2,5 h, Meldeschluss vor 30 min
    insert into public.events (id, club_id, type, title, date, time, auto_fine)
      values (v_e3, v_club, 'training', 'Prüfung 0078 Übersicht', ((now() + interval '150 minutes') at time zone 'Europe/Berlin')::date,
              to_char((now() + interval '150 minutes') at time zone 'Europe/Berlin', 'HH24:MI'), true);
    -- Start und Meldeschluss rechnen die Trigger aus Datum und Uhrzeit (Training: 3 h vorher -> vor 30 min)
    perform public.notify_cron_rueckmeldung();
    select (n.text) into v_s from public.notification_outbox n
     where n.profile_id = v_tr and n.kategorie = 'meldeschluss_uebersicht' and n.dedup_key like 'meldeschluss:' || v_e3 || ':%' limit 1;
    select count(*) into v_aktiv from public.players pl
     where pl.club_id = v_club and pl.ausgeschieden_am is null and pl.id <> v_pneu
       and not exists (select 1 from public.rsvps r where r.event_id = v_e3 and r.player_id = pl.id)
       and not public.notify_spieler_faellt_aus_am(pl.id, (select date from public.events where id = v_e3));
    v_erg := v_erg || jsonb_build_array(jsonb_build_array('Übersicht nach Meldeschluss zählt den Neuen nicht als offen',
      '❓ ' || v_aktiv, coalesce(substring(v_s from '❓ [0-9]+'), 'keine Mitteilung')));

    -- 4) mein_konto liefert freigegeben_am
    perform set_config('request.jwt.claims', json_build_object('sub', v_neu, 'role', 'authenticated')::text, true);
    v_j := public.mein_konto();
    perform set_config('request.jwt.claims', '', true);
    v_erg := v_erg || jsonb_build_array(jsonb_build_array('mein_konto liefert freigegeben_am', 'ja', case when v_j->>'freigegeben_am' is not null then 'ja' else 'nein' end));

    raise exception using errcode = 'P0078', message = 'zurückrollen';
  exception when sqlstate 'P0078' then null;
  end;
  insert into pruef_0078 (fall, erwartet, ergebnis, urteil)
    select x->>0, x->>1, x->>2, case when x->>1 = x->>2 then 'PASS' else 'FAIL' end from jsonb_array_elements(v_erg) x;
  select count(*) into v_n from (select id from auth.users where id in (v_neu, v_tr) union all select id from public.players where id in (v_pgr, v_palt)
    union all select id from public.events where id in (v_e1, v_e2, v_e3)) z;
  insert into pruef_0078 (fall, erwartet, ergebnis, urteil) values ('Prüfdaten danach gelöscht', '0', v_n::text, case when v_n = 0 then 'PASS' else 'FAIL' end);
end
$pruef$;

select nr, fall, erwartet, ergebnis, urteil from pruef_0078
union all
select null, 'SUMME: ' || count(*) || ' Fälle, ' || count(*) filter (where urteil = 'PASS') || ' PASS, '
       || count(*) filter (where urteil = 'FAIL') || ' FAIL', null, null, null from pruef_0078
order by nr nulls last;
