-- ============================================================================
-- Prüfung zu Migration 0049 (Automatische Mitteilungen, AM5 offene Strafen).
-- Ändert nichts: jeder Fall läuft in einer Untertransaktion, die immer
-- zurückgerollt wird. Muster wie 0048_rueckmeldung_pruef.sql. Empfänger ist
-- das Nicht-Admin-Profil, verknüpft mit einem Prüfspieler ohne Strafen.
-- ============================================================================

drop table if exists pg_temp.pruef_0049;
create temp table pruef_0049 (nr int, rolle text, fall text, erwartet text, ergebnis text, urteil text);

do $pruef$
declare
  v_admin    uuid;
  v_aspieler uuid;
  v_aname    text;
  v_nutzer   uuid;
  v_club     uuid;
  v_sp       uuid := gen_random_uuid();
  v_sp2      uuid := gen_random_uuid();
  v_e1       uuid := gen_random_uuid();
  v_basis    text[];
  v_coach    text;
  v_zweiter  text;
  v_faellig  text;
  pruef_erinnerung text;
  zaehl_erinnerung text;
  v_nr int := 0; v_txt text; v_ok boolean; v_state text; v_msg text; v_urteil text; s text; i int;
  AUSSEN constant text[] := array['anon','Spieler','Trainer','Kassenwart','Admin'];
  r record; f record;
begin
  select ur.user_id into v_admin from public.user_roles ur
    join public.profiles p on p.id = ur.user_id and p.player_id is not null where ur.role = 'admin' limit 1;
  select player_id into v_aspieler from public.profiles where id = v_admin;
  select club_id, name into v_club, v_aname from public.players where id = v_aspieler;
  select p.id into v_nutzer from public.profiles p where p.player_id is null
     and not exists (select 1 from public.user_roles ur where ur.user_id = p.id and ur.role = 'admin') limit 1;
  if v_admin is null or v_nutzer is null then raise exception 'Admin mit Spieler oder freies Profil fehlt.'; end if;

  v_basis := array[
    format('insert into public.players (id, club_id, code, name) values (%L, %L, %L, %L)', v_sp, v_club, 'pruef0049', 'Prüfspieler 0049'),
    format('update public.profiles set player_id = %L where id = %L', v_sp, v_nutzer),
    format('delete from public.player_status where player_id = %L', v_aspieler)];
  v_coach := format('insert into public.user_roles (user_id, role, club_id) select %L, ''coach'', %L where not exists (select 1 from public.user_roles where user_id = %L and role = ''coach'')', v_nutzer, v_club, v_nutzer);
  v_zweiter := format('insert into public.players (id, club_id, code, name) values (%L, %L, %L, %L)', v_sp2, v_club, 'pruef0049b', 'Prüfspieler Zwei');
  v_faellig := 'update public.notification_sammler set faellig_ab = now() - interval ''1 second'' where erstellt_at >= now()';
  pruef_erinnerung := format('select count(*)::text || ''/'' || bool_and(o.titel = ''⏳ Bist du dabei? Prüftermin'' and o.text = public.notify_datum_kurz(e.date) || '' '' || public.notify_uhrzeit(e.time) || '' · Meldeschluss '' || public.notify_meldeschluss_text(e.deadline_at) || ''. Ohne Antwort wird''''s teuer.'' and o.gueltig_bis = e.deadline_at and o.urgency = ''high'' and o.deep_link = ''#termin='' || e.id)::text from public.notification_outbox o join public.events e on e.id = %L where o.kategorie = ''rueckmeldung_erinnerung'' and o.profile_id = %L and o.dedup_key like %L', v_e1, v_admin, 'erinnerung:' || v_e1 || ':%:24');
  zaehl_erinnerung := format('select count(*)::text from public.notification_outbox where kategorie = ''rueckmeldung_erinnerung'' and profile_id = %L and dedup_key like %L', v_admin, 'erinnerung:' || v_e1 || ':%');

  for r in
    select * from (values
      (1, 'anon', null::text), (2, 'Spieler', null), (3, 'Trainer', 'coach'),
      (4, 'Kassenwart', 'treasurer'), (5, 'Admin', null), (6, 'service_role', null), (7, 'intern', null)
    ) as t(ord, rolle, zusatzrolle) order by ord
  loop
    for f in
      select * from (values
        -- ---- 1) Rechte, Cron, Vorlage --------------------------------------
        ('notify_cron_strafen_offen', null::text[], array['select public.notify_cron_strafen_offen()::text'], null::text[], null::text, 'verweigert', AUSSEN),
        ('Cron am 1. um 16:00 UTC', null, null, null,
         'select schedule || '' '' || active::text from cron.job where jobname = ''notify-strafen-offen''', 'wert:0 16 1 * * true', array['intern']),
        ('Vorlage strafen_offen (S2)', null, null, null,
         'select titel_vorlage || '' / '' || text_vorlage from public.notification_templates where kategorie = ''strafen_offen''',
         'wert:💸 Offene Strafen: {betrag} / {anzahl}, älteste vom {datum}.', array['intern']),

        -- ---- 2) Erinnerung -------------------------------------------------
        ('offene Strafe älter als 28 Tage: Nachricht über alle offenen, Text',
         v_basis || array[format('insert into public.fines (club_id, player_id, date, offense, base_amount, status, created_at) values (%L, %L, current_date - 30, ''Prüfung'', 5, ''offen'', now() - interval ''30 days'')', v_club, v_sp), format('insert into public.fines (club_id, player_id, date, offense, base_amount, status, created_at) values (%L, %L, current_date - 2, ''Prüfung'', 3, ''offen'', now() - interval ''2 days'')', v_club, v_sp)],
         null, array['select public.notify_cron_strafen_offen()'],
         format('select count(*)::text || '' | '' || max(titel || '' | '' || text || '' | '' || deep_link) from public.notification_outbox where kategorie = ''strafen_offen'' and profile_id = %L', v_nutzer),
         format('wert:1 | 💸 Offene Strafen: 16,00 € | 2 Strafen, älteste vom %s. | #strafen=meine', public.notify_datum_lang(current_date - 30)), array['intern']),
        ('zweiter Lauf im selben Monat: nichts Neues',
         v_basis || array[format('insert into public.fines (club_id, player_id, date, offense, base_amount, status, created_at) values (%L, %L, current_date - 30, ''Prüfung'', 5, ''offen'', now() - interval ''30 days'')', v_club, v_sp)],
         null, array['select public.notify_cron_strafen_offen()', 'select public.notify_cron_strafen_offen()'],
         format('select count(*)::text from public.notification_outbox where kategorie = ''strafen_offen'' and profile_id = %L', v_nutzer),
         'wert:1', array['intern']),
        ('nur junge Strafen (20 Tage): nichts',
         v_basis || array[format('insert into public.fines (club_id, player_id, date, offense, base_amount, status, created_at) values (%L, %L, current_date - 20, ''Prüfung'', 5, ''offen'', now() - interval ''20 days'')', v_club, v_sp)],
         null, array['select public.notify_cron_strafen_offen()'],
         format('select count(*)::text from public.notification_outbox where kategorie = ''strafen_offen'' and profile_id = %L', v_nutzer),
         'wert:0', array['intern']),
        ('alte Strafe gemeldet: nichts',
         v_basis || array[format('insert into public.fines (club_id, player_id, date, offense, base_amount, status, created_at) values (%L, %L, current_date - 30, ''Prüfung'', 5, ''gemeldet'', now() - interval ''30 days'')', v_club, v_sp)],
         null, array['select public.notify_cron_strafen_offen()'],
         format('select count(*)::text from public.notification_outbox where kategorie = ''strafen_offen'' and profile_id = %L', v_nutzer),
         'wert:0', array['intern']),
        ('alte Strafe storniert: nichts',
         v_basis || array[format('insert into public.fines (club_id, player_id, date, offense, base_amount, status, created_at) values (%L, %L, current_date - 30, ''Prüfung'', 5, ''storniert'', now() - interval ''30 days'')', v_club, v_sp)],
         null, array['select public.notify_cron_strafen_offen()'],
         format('select count(*)::text from public.notification_outbox where kategorie = ''strafen_offen'' and profile_id = %L', v_nutzer),
         'wert:0', array['intern']),
        ('Schalter aus (Standard): Zeile entsteht, ist aber nicht fällig',
         v_basis || array[format('insert into public.fines (club_id, player_id, date, offense, base_amount, status, created_at) values (%L, %L, current_date - 30, ''Prüfung'', 5, ''offen'', now() - interval ''30 days'')', v_club, v_sp), format('update public.notification_prefs set strafen_offen = false where profile_id = %L', v_nutzer)],
         null, array['select public.notify_cron_strafen_offen()'],
         format('select (select count(*) from public.notification_outbox where kategorie = ''strafen_offen'' and profile_id = %L)::text || ''/'' || (select count(*) from public.notification_due where kategorie = ''strafen_offen'' and profile_id = %L)::text', v_nutzer, v_nutzer),
         'wert:1/0', array['intern'])
      ) as t(fall, vor, aktion, nach, pruef, erwartet, rollen)
      where r.rolle = any(t.rollen)
    loop
      v_nr := v_nr + 1;
      v_ok := false; v_txt := null; v_state := null; v_msg := null;
      begin
        if r.zusatzrolle is not null then
          insert into public.user_roles (user_id, role, club_id) values (v_nutzer, r.zusatzrolle, v_club);
        end if;
        foreach s in array coalesce(f.vor, '{}'::text[]) loop execute s; end loop;
        if r.rolle = 'anon' then
          perform set_config('request.jwt.claims', '{"role":"anon"}', true);
          execute 'set local role anon';
        elsif r.rolle = 'service_role' then
          perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
          execute 'set local role service_role';
        elsif r.rolle <> 'intern' then
          perform set_config('request.jwt.claims',
            json_build_object('sub', case when r.rolle = 'Admin' then v_admin else v_nutzer end, 'role', 'authenticated')::text, true);
          execute 'set local role authenticated';
        end if;
        if f.aktion is not null then
          for i in 1 .. array_length(f.aktion, 1) loop
            if f.pruef is null and i = array_length(f.aktion, 1) then execute f.aktion[i] into v_txt; else execute f.aktion[i]; end if;
          end loop;
        end if;
        if r.rolle <> 'intern' then
          execute 'reset role';
          perform set_config('request.jwt.claims', '', true);
        end if;
        foreach s in array coalesce(f.nach, '{}'::text[]) loop execute s; end loop;
        if f.pruef is not null then execute f.pruef into v_txt; end if;
        v_ok := true;
        raise exception using errcode = 'P0049', message = 'zurückrollen';
      exception when others then
        if sqlstate <> 'P0049' then v_state := sqlstate; v_msg := sqlerrm; end if;
      end;
      v_urteil := case
        when f.erwartet = 'verweigert' then case when not v_ok and v_state = '42501' then 'PASS' else 'FAIL' end
        when f.erwartet = 'ok' then case when v_ok then 'PASS' else 'FAIL' end
        when f.erwartet like 'wert:%' then case when v_ok and v_txt = substr(f.erwartet, 6) then 'PASS' else 'FAIL' end
      end;
      insert into pruef_0049 values (v_nr, r.rolle, f.fall, f.erwartet,
        case when v_ok then 'gelungen: ' || coalesce(left(v_txt, 160), '(null)') else 'abgelehnt: ' || v_state || ' ' || left(v_msg, 160) end,
        v_urteil);
    end loop;
  end loop;
end
$pruef$;

select nr, rolle, fall, erwartet, ergebnis, urteil from pruef_0049
union all
select null, 'SUMME', count(*) || ' Fälle: ' || count(*) filter (where urteil = 'PASS') || ' PASS, '
       || count(*) filter (where urteil = 'FAIL') || ' FAIL', null, null, null from pruef_0049
order by nr nulls last;
