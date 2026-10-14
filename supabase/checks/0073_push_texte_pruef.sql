-- ============================================================================
-- Prüfung zu Migration 0073 (Paket Rechtliches, Teil A): Push-Texte ohne
-- Gesundheitsangaben.
-- Ändert nichts: jeder Fall läuft in einer Untertransaktion, die immer
-- zurückgerollt wird. Muster wie 0072_widerruf_datum_pruef.sql.
--
-- Teil 1 durchsucht alle Erzeuger (Funktionen, die notify_enqueue,
-- notify_sammeln oder den Postausgang beschreiben), die Trigger, die Vorlagen
-- und den heutigen Postausgang. Kein Push-Text darf verletzt, angeschlagen,
-- die Statusnotiz oder das Datum "voraussichtlich bis" enthalten.
-- Teil 2 lässt status_abgelaufen mit einem Prüfkonto (Trainerrolle) und zwei
-- Prüf-Spielern laufen (Ablauf 2030, kein echter Status liegt dort) und liest
-- den Text aus dem Postausgang. Echte Trainer bekommen in derselben,
-- zurückgerollten Untertransaktion ebenfalls eine Zeile; sie wird nie
-- festgeschrieben, der Versand sieht sie also nie.
-- Teil 3 (ID-Protokoll): die IDs aller Prüfzeilen stehen am Ende in der
-- Tabelle; der letzte Fall prüft über genau diese IDs, dass keine übrig ist.
-- ============================================================================

drop table if exists pg_temp.pruef_0073;
create temp table pruef_0073 (nr int, rolle text, fall text, erwartet text, ergebnis text, urteil text);

do $pruef$
declare
  v_club uuid;
  v_t uuid := gen_random_uuid();
  v_p1 uuid := gen_random_uuid();
  v_p2 uuid := gen_random_uuid();
  v_tok text := 'pruef0073' || replace(gen_random_uuid()::text, '-', '');
  v_erzeuger text := $q$
    select p.oid, p.proname, pg_get_functiondef(p.oid) d
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prokind = 'f'
       and p.proname not in ('notify_enqueue', 'notify_sammeln', 'render_vorlage')
       and (pg_get_functiondef(p.oid) ilike '%notify_enqueue%' or pg_get_functiondef(p.oid) ilike '%notify_sammeln%'
            or pg_get_functiondef(p.oid) ~* 'insert\s+into\s+public\.notification_outbox')$q$;
  v_verboten text := '(verletz|angeschlagen|voraussichtlich)';
  v_basis text[];
  v_lauf1 text; v_lauf2 text; v_text text;
  v_nr int := 0; v_txt text; v_ok boolean; v_state text; v_msg text; v_urteil text; s text; i int;
  f record;
begin
  select id into v_club from public.clubs where slug = 'fcfn';
  v_basis := array[
    'update public.einladungen set widerrufen_am = now() where widerrufen_am is null',
    format('insert into public.einladungen (club_id, token) values (%L, %L)', v_club, v_tok),
    format('insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values (%L, ''00000000-0000-0000-0000-000000000000'', ''authenticated'', ''authenticated'', ''pruef0073@invalid.local'', %L, now(), now())', v_t, jsonb_build_object('name', 'Prüf Trainer', 'einladung', v_tok)),
    format('update public.profiles set freigabe = ''aktiv'' where id = %L', v_t),
    format('insert into public.user_roles (user_id, role, club_id) values (%L, ''coach'', %L) on conflict do nothing', v_t, v_club),
    format('insert into public.players (id, club_id, code, name) values (%L, %L, ''pr73a'', ''Prüf Anton''), (%L, %L, ''pr73b'', ''Prüf Berta'')', v_p1, v_club, v_p2, v_club)];
  v_lauf1 := 'select public.notify_cron_status_abgelaufen(timestamp ''2030-01-01 09:00'' at time zone ''Europe/Berlin'')::text';
  v_lauf2 := 'select public.notify_cron_status_abgelaufen(timestamp ''2030-01-02 09:00'' at time zone ''Europe/Berlin'')::text';
  v_text  := format('select count(*)::text || '' | '' || coalesce(string_agg(titel || '' | '' || text || '' | '' || deep_link, '' # ''), ''-'') from public.notification_outbox where kategorie = ''status_abgelaufen'' and profile_id = %L', v_t);

  for f in
    select * from (values
      -- ---- Teil 1: Quellen durchsuchen ---------------------------------------------------
      ('Erzeuger: keiner nennt verletzt, angeschlagen oder voraussichtlich', null::text[], null::text[],
       format('select count(*)::text || coalesce('' '' || string_agg(proname, '','' order by proname), '''') from (%s) e where e.d ~* %L', v_erzeuger, v_verboten), 'wert:0'),
      ('Erzeuger: keiner liest die Statusnotiz', null, null,
       format('select count(*)::text || coalesce('' '' || string_agg(proname, '','' order by proname), '''') from (%s) e where e.d ~* ''status_note''', v_erzeuger), 'wert:0'),
      ('Erzeuger: player_status/status_until nur in status_abgelaufen (Auswahl der Namen)', null, null,
       format('select coalesce(string_agg(proname, '','' order by proname), ''-'') from (%s) e where e.d ~* ''(player_status|status_until)''', v_erzeuger), 'wert:notify_cron_status_abgelaufen'),
      ('status_abgelaufen: formatiert kein Datum und nennt keine Statusart', null, null,
       'select (pg_get_functiondef(''public.notify_cron_status_abgelaufen(timestamptz)''::regprocedure) ~* ''(notify_datum|urlaub|nicht_verfuegbar|s\.status\s*(=|when|in)|case\s+.*status)'')::text', 'wert:false'),
      ('Erzeuger: keiner gibt den Absagegrund (rsvps.reason) weiter', null, null,
       format('select count(*)::text || coalesce('' '' || string_agg(proname, '','' order by proname), '''') from (%s) e where e.d ~* ''\mreason\M''', v_erzeuger), 'wert:0'),
      ('Trigger: alle Push-Trigger rufen nur geprüfte Erzeuger', null, null,
       format('select count(*)::text from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname = ''public'' and not t.tgisinternal and t.tgfoid in (select oid from (%s) e) and pg_get_functiondef(t.tgfoid) ~* %L', v_erzeuger, v_verboten), 'wert:0'),
      ('Vorlagen: Titel, Text und Beispiel ohne Gesundheitsangaben', null, null,
       format('select count(*)::text || coalesce('' '' || string_agg(kategorie, '','' order by kategorie), '''') from public.notification_templates where (titel_vorlage || '' '' || text_vorlage || '' '' || beispiel_daten::text) ~* %L', v_verboten), 'wert:0'),
      ('Vorlagen: kein Platzhalter für Status, Notiz oder Bis-Datum', null, null,
       'select count(*)::text from public.notification_templates t, unnest(t.platzhalter) p(name) where p.name ~* ''(status|notiz|note|bis|until)''', 'wert:0'),
      ('Vorlage status_abgelaufen: neutral, Deep Link unverändert', null, null,
       'select titel_vorlage || '' / '' || text_vorlage || '' / '' || array_to_string(platzhalter, '','') || '' / '' || deep_link_vorlage from public.notification_templates where kategorie = ''status_abgelaufen''',
       'wert:📋 {kopf} / {detail} / kopf,detail / #ansicht=kader'),
      ('Postausgang heute: keine Zeile mit Gesundheitsangaben', null, null,
       format('select count(*)::text from public.notification_outbox where (titel || '' '' || text) ~* %L', v_verboten), 'wert:0'),

      -- ---- Teil 2: Testfall mit Prüfkonto ------------------------------------------------
      ('Testfall ein Spieler (verletzt, Notiz "Knie", bis 31.12.)',
       array[format('insert into public.player_status (player_id, status, status_note, status_until) values (%L, ''verletzt'', ''Knie'', date ''2029-12-31'')', v_p1)],
       array[v_lauf1], v_text,
       'wert:1 | 📋 Status abgelaufen | Prüf Anton: Status ist abgelaufen, bitte im Kader prüfen. | #ansicht=kader'),
      ('Testfall ein Spieler (angeschlagen): derselbe Text',
       array[format('insert into public.player_status (player_id, status, status_until) values (%L, ''angeschlagen'', date ''2029-12-31'')', v_p1)],
       array[v_lauf1], v_text,
       'wert:1 | 📋 Status abgelaufen | Prüf Anton: Status ist abgelaufen, bitte im Kader prüfen. | #ansicht=kader'),
      ('Testfall ein Spieler (Urlaub): derselbe Text',
       array[format('insert into public.player_status (player_id, status, status_until) values (%L, ''urlaub'', date ''2029-12-31'')', v_p1)],
       array[v_lauf1], v_text,
       'wert:1 | 📋 Status abgelaufen | Prüf Anton: Status ist abgelaufen, bitte im Kader prüfen. | #ansicht=kader'),
      ('Testfall mehrere (verletzt + nicht verfügbar)',
       array[format('insert into public.player_status (player_id, status, status_note, status_until) values (%L, ''verletzt'', ''Knie'', date ''2030-01-01''), (%L, ''nicht_verfuegbar'', null, date ''2030-01-01'')', v_p1, v_p2)],
       array[v_lauf2], v_text,
       'wert:1 | 📋 Status abgelaufen | Status abgelaufen bei Prüf Anton, Prüf Berta. Bitte im Kader prüfen. | #ansicht=kader'),
      ('Testfall: Outbox-Text ohne Statusart, Notiz und Datum',
       array[format('insert into public.player_status (player_id, status, status_note, status_until) values (%L, ''verletzt'', ''Knie'', date ''2030-01-01''), (%L, ''angeschlagen'', ''Wade'', date ''2030-01-01'')', v_p1, v_p2)],
       array[v_lauf2],
       format('select count(*)::text from public.notification_outbox where kategorie = ''status_abgelaufen'' and profile_id = %L and (titel || '' '' || text) ~* ''(verletz|angeschlagen|urlaub|verfügbar|voraussichtlich|knie|wade|[0-9]{2}\.[0-9]{2}\.)''', v_t), 'wert:0'),
      ('Testfall: Status selbst bleibt unverändert',
       array[format('insert into public.player_status (player_id, status, status_note, status_until) values (%L, ''verletzt'', ''Knie'', date ''2029-12-31'')', v_p1)],
       array[v_lauf1],
       format('select status || ''/'' || status_note || ''/'' || status_until from public.player_status where player_id = %L', v_p1), 'wert:verletzt/Knie/2029-12-31')
    ) as t(fall, vor, aktion, pruef, erwartet)
  loop
    v_nr := v_nr + 1;
    v_ok := false; v_txt := null; v_state := null; v_msg := null;
    begin
      if f.vor is not null or f.aktion is not null then
        foreach s in array v_basis loop execute s; end loop;
      end if;
      foreach s in array coalesce(f.vor, '{}'::text[]) loop execute s; end loop;
      foreach s in array coalesce(f.aktion, '{}'::text[]) loop execute s; end loop;
      if f.pruef is not null then execute f.pruef into v_txt; end if;
      v_ok := true;
      raise exception using errcode = 'P0073', message = 'zurückrollen';
    exception when others then
      if sqlstate <> 'P0073' then v_state := sqlstate; v_msg := sqlerrm; end if;
    end;
    v_urteil := case when v_ok and coalesce(v_txt, '') = substr(f.erwartet, 6) then 'PASS' else 'FAIL' end;
    insert into pruef_0073 values (v_nr, 'intern', f.fall, f.erwartet,
      case when v_ok then 'gelungen: ' || coalesce(left(v_txt, 300), '(null)') else 'abgelehnt: ' || v_state || ' ' || left(v_msg, 160) end, v_urteil);
  end loop;

  -- ---- Teil 3: ID-Protokoll ------------------------------------------------------------
  v_nr := v_nr + 1;
  insert into pruef_0073 values (v_nr, 'intern', 'ID-Protokoll: Prüfkonto, Prüf-Spieler, Einladungstoken', null,
    'konto=' || v_t || ' spieler=' || v_p1 || ',' || v_p2 || ' token=' || v_tok, 'INFO');
  v_nr := v_nr + 1;
  select (select count(*) from auth.users where id = v_t)
       + (select count(*) from public.profiles where id = v_t)
       + (select count(*) from public.user_roles where user_id = v_t)
       + (select count(*) from public.notification_outbox where profile_id = v_t)
       + (select count(*) from public.notification_prefs where profile_id = v_t)
       + (select count(*) from public.players where id in (v_p1, v_p2))
       + (select count(*) from public.player_status where player_id in (v_p1, v_p2))
       + (select count(*) from public.einladungen where token = v_tok)
    into i;
  insert into pruef_0073 values (v_nr, 'intern', 'ID-Protokoll: nach dem Lauf keine Prüfzeile übrig (über die IDs oben)', 'wert:0',
    'gelungen: ' || i, case when i = 0 then 'PASS' else 'FAIL' end);
end
$pruef$;

select nr, rolle, fall, erwartet, ergebnis, urteil from pruef_0073
union all
select null, 'SUMME', count(*) filter (where urteil <> 'INFO') || ' Fälle: ' || count(*) filter (where urteil = 'PASS') || ' PASS, '
       || count(*) filter (where urteil = 'FAIL') || ' FAIL', null, null, null from pruef_0073
order by nr nulls last;
