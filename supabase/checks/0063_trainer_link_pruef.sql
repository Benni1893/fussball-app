-- ============================================================================
-- Prüfung zu Migration 0063 (Trainer-Link).
-- Ändert nichts: jeder Fall läuft in einer Untertransaktion, die immer
-- zurückgerollt wird. Muster wie 0061/0062.
-- Im Fall: Prüfkonto T über den Spieler-Link (wartet oder freigegeben), dazu
-- ein offener Trainer-Link L (vom Admin), ein Konto TL, das sich über einen
-- zweiten Trainer-Link registriert hat (aktiv, Onboarding offen), und ein
-- Kadereintrag P2 ohne Konto.
-- ============================================================================

drop table if exists pg_temp.pruef_0063;
create temp table pruef_0063 (nr int, rolle text, fall text, erwartet text, ergebnis text, urteil text);

do $pruef$
declare
  v_club uuid; v_admin uuid;
  v_t uuid := gen_random_uuid(); v_tl uuid := gen_random_uuid(); v_x uuid := gen_random_uuid();
  v_p1 uuid := gen_random_uuid(); v_p2 uuid := gen_random_uuid();
  v_l uuid := gen_random_uuid(); v_l2 uuid := gen_random_uuid();
  v_tok text := 'pruef0063' || replace(gen_random_uuid()::text, '-', '');
  v_ltok text := 'pruef0063L' || replace(gen_random_uuid()::text, '-', '');
  v_l2tok text := 'pruef0063M' || replace(gen_random_uuid()::text, '-', '');
  v_neu text;
  v_basis text[]; v_frei text[];
  v_nr int := 0; v_txt text; v_ok boolean; v_state text; v_msg text; v_urteil text; s text; i int; v_sub uuid;
  r record; f record;
begin
  select id into v_club from public.clubs where slug = 'fcfn';
  select user_id into v_admin from public.user_roles where role = 'admin' limit 1;
  v_neu := format('insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values (%L, ''00000000-0000-0000-0000-000000000000'', ''authenticated'', ''authenticated'', ''pruef0063x@invalid.local'', %L, now(), now())',
                  v_x, jsonb_build_object('name', 'Prüf Dritter', 'einladung', v_ltok));
  v_basis := array[
    'update public.einladungen set widerrufen_am = now() where widerrufen_am is null',
    format('insert into public.einladungen (club_id, token) values (%L, %L)', v_club, v_tok),
    format('insert into public.einladungen (id, club_id, token, art, gueltig_bis, erstellt_von) values (%L, %L, %L, ''trainer'', now() + interval ''7 days'', %L), (%L, %L, %L, ''trainer'', now() + interval ''7 days'', %L)',
           v_l, v_club, v_ltok, v_admin, v_l2, v_club, v_l2tok, v_admin),
    format('insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values (%L, ''00000000-0000-0000-0000-000000000000'', ''authenticated'', ''authenticated'', ''pruef0063@invalid.local'', %L, now(), now())', v_t, jsonb_build_object('name', 'Prüf Konto', 'einladung', v_tok)),
    format('insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values (%L, ''00000000-0000-0000-0000-000000000000'', ''authenticated'', ''authenticated'', ''pruef0063tl@invalid.local'', %L, now(), now())', v_tl, jsonb_build_object('name', 'Prüf Trainer Link', 'einladung', v_l2tok)),
    format('insert into public.players (id, club_id, code, name) values (%L, %L, ''pr63a'', ''Prüf Eins''), (%L, %L, ''pr63b'', ''Prüf Zwei ohne Konto'')', v_p1, v_club, v_p2, v_club)];
  v_frei := v_basis || array[format('update public.profiles set freigabe = ''aktiv'', player_id = %L where id = %L', v_p1, v_t)];

  for r in
    select * from (values
      (1, 'anon', null::text), (2, 'Wartend', null), (3, 'Spieler', null), (4, 'Kassenwart', 'treasurer'),
      (5, 'Trainer', 'coach'), (6, 'TL-Konto', null), (7, 'Admin', 'admin'), (8, 'intern', null)
    ) as t(ord, rolle, zusatzrolle) order by ord
  loop
    for f in
      select * from (values
        -- ---- Erzeugen, Liste, Widerruf: nur Admin ---------------------------------
        ('Trainer-Link erzeugen', null::text[], array['select (public.trainer_link_erzeugen() ? ''token'')::text']::text[], null::text[], null::text, 'verweigert', array['anon','Wartend','Spieler','Kassenwart','Trainer','TL-Konto']),
        ('Trainer-Link erzeugen: einmal, 7 Tage', null, array['select public.trainer_link_erzeugen()::text'], null,
         'select count(*)::text || ''/'' || bool_and(gueltig_bis between now() + interval ''6 days 23 hours'' and now() + interval ''7 days 1 minute'')::text from public.einladungen where art = ''trainer'' and widerrufen_am is null and benutzt_am is null',
         'wert:2/true', array['Admin']),
        ('Liste der Trainer-Links', null, array['select jsonb_array_length(public.trainer_links_liste())::text'], null, null, 'verweigert', array['anon','Wartend','Spieler','Kassenwart','Trainer','TL-Konto']),
        ('Liste: Admin sieht offen und benutzt, Token nur bei offen', null,
         array[format('select string_agg(x->>''stand'' || '':'' || (x->>''token'' is not null)::text, '','' order by x->>''stand'') from jsonb_array_elements(public.trainer_links_liste()) x where (x->>''id'')::uuid in (%L, %L)', v_l, v_l2)],
         null, null, 'wert:benutzt:false,offen:true', array['Admin']),
        ('Widerrufen', null, array[format('select public.trainer_link_widerrufen(%L)::text', v_l)], null, null, 'verweigert', array['anon','Wartend','Spieler','Kassenwart','Trainer','TL-Konto']),
        ('Widerrufen: Admin, danach ungültig', null, array[format('select public.trainer_link_widerrufen(%L)::text', v_l)], null,
         format('select (public.einladung_pruefen(%L))->>''gueltig''', v_ltok), 'wert:false', array['Admin']),
        ('Widerrufen: benutzter Link nicht', null, array[format('select public.trainer_link_widerrufen(%L)::text', v_l2)], null, null, 'fehler:schon benutzt', array['Admin']),
        ('Tabelle einladungen direkt lesen', null, array['select count(*)::text from public.einladungen'], null, null, 'verweigert', array['anon','Wartend','Spieler','Trainer','TL-Konto','Admin']),
        ('Spieler-Link holen: Trainer-Link nie', null, array[format('select ((public.einladung_holen())->>''token'' in (%L, %L))::text', v_ltok, v_l2tok)], null, null, 'wert:false', array['Trainer','Admin']),
        ('Spieler-Link erneuern lässt Trainer-Link stehen', null, array['select public.einladung_erneuern()::text'], null,
         format('select (public.einladung_pruefen(%L))->>''gueltig''', v_ltok), 'wert:true', array['Trainer']),

        -- ---- Prüfen und Registrieren --------------------------------------------------
        ('Link prüfen: offener Trainer-Link', null, array[format('select ((public.einladung_pruefen(%L))->>''gueltig'') || ''/'' || ((public.einladung_pruefen(%L))->>''art'')', v_ltok, v_ltok)], null, null, 'wert:true/trainer', array['anon']),
        ('Link prüfen: benutzter Trainer-Link', null, array[format('select (public.einladung_pruefen(%L))->>''gueltig''', v_l2tok)], null, null, 'wert:false', array['anon']),
        ('Link prüfen: abgelaufen', array[format('update public.einladungen set gueltig_bis = now() - interval ''1 second'' where id = %L', v_l)],
         array[format('select (public.einladung_pruefen(%L))->>''gueltig''', v_ltok)], null, null, 'wert:false', array['anon']),
        ('Link prüfen: Spieler-Link Art spieler', null, array[format('select (public.einladung_pruefen(%L))->>''art''', v_tok)], null, null, 'wert:spieler', array['anon']),
        ('Registrierung über Trainer-Link: aktiv, Spieler und Trainer, ohne Kader', null, array[v_neu], null,
         format('select p.freigabe || ''/'' || p.onboarding_offen::text || ''/'' || coalesce(p.player_id::text, ''-'') || ''/'' || (select string_agg(role, '','' order by role) from public.user_roles where user_id = p.id) from public.profiles p where p.id = %L', v_x),
         'wert:aktiv/true/-/coach,player', array['intern']),
        ('Registrierung über Trainer-Link: Link verbraucht, protokolliert, keine Anfrage', null, array[v_neu], null,
         format('select ((select benutzt_von from public.einladungen where id = %L)::text = %L)::text || ''/'' || (select count(*) from public.konto_protokoll where ziel = %L and aktion = ''registriert_trainer'')::text || ''/'' || (select count(*) from public.notification_outbox where kategorie = ''anfrage_neu'' and dedup_key like ''anfrage_neu:'' || %L || ''%%'')::text', v_l, v_x, v_x, v_x),
         'wert:true/1/0', array['intern']),
        ('Registrierung: benutzter Trainer-Link scheitert', null,
         array[format('insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values (%L, ''00000000-0000-0000-0000-000000000000'', ''authenticated'', ''authenticated'', ''pruef0063y@invalid.local'', %L, now(), now())', v_x, jsonb_build_object('name', 'Zweiter', 'einladung', v_l2tok))],
         null, null, 'verweigert', array['intern']),
        ('Registrierung: abgelaufener Trainer-Link scheitert', array[format('update public.einladungen set gueltig_bis = now() - interval ''1 second'' where id = %L', v_l)],
         array[v_neu], null, null, 'verweigert', array['intern']),
        ('Registrierung: widerrufener Trainer-Link scheitert', array[format('update public.einladungen set widerrufen_am = now() where id = %L', v_l)],
         array[v_neu], null, null, 'verweigert', array['intern']),
        ('Registrierung über Spieler-Link bleibt wartend', null, null, null,
         format('select freigabe || ''/'' || onboarding_offen::text from public.profiles where id = %L', v_t), 'wert:wartet/false', array['intern']),

        -- ---- Onboarding des Trainer-Link-Kontos --------------------------------------------
        ('mein_konto: Onboarding offen, Leitung', null, array['select ((public.mein_konto())->>''onboarding_offen'') || ''/'' || ((public.mein_konto())->>''leitung'') || ''/'' || ((public.mein_konto())->>''hat_spieler'')'], null, null, 'wert:true/true/false', array['TL-Konto']),
        ('Kadereintrag ohne Konto wählen', null, array[format('select public.mein_kadereintrag(%L, false, true)::text', v_p2)], null,
         format('select (player_id = %L)::text || ''/'' || spielt_mit::text from public.profiles where id = %L', v_p2, v_tl), 'wert:true/true', array['TL-Konto']),
        ('Kadereintrag mit Konto nicht wählbar', null, array[format('select public.mein_kadereintrag(%L, false, true)::text', v_p1)], null, null, 'fehler:nicht frei', array['TL-Konto']),
        ('Neuen Kadereintrag anlegen mit Name und Position', null, array['select public.meine_position_setzen(''sturm'')::text', 'select public.mein_kadereintrag(null, true, true)::text'], null,
         format('select pl.name || ''/'' || coalesce(pl.hauptposition, ''-'') from public.profiles p join public.players pl on pl.id = p.player_id where p.id = %L', v_tl), 'wert:Prüf Trainer Link/sturm', array['TL-Konto']),
        ('Spielt nicht mit: kein Kadereintrag', null, array['select public.mein_kadereintrag(null, false, false)::text'], null,
         format('select coalesce(player_id::text, ''-'') || ''/'' || spielt_mit::text from public.profiles where id = %L', v_tl), 'wert:-/false', array['TL-Konto']),
        ('Kadereintrag nur einmal', null, array['select public.mein_kadereintrag(null, true, true)::text', 'select public.mein_kadereintrag(null, true, true)::text'], null, null, 'verweigert', array['TL-Konto']),
        ('Kadereintrag selbst wählen ohne Trainer-Link', null, array[format('select public.mein_kadereintrag(%L, false, true)::text', v_p2)], null, null, 'verweigert', array['anon','Wartend','Spieler','Kassenwart','Trainer','Admin']),
        ('Onboarding abschließen', null, array['select public.onboarding_abschliessen()::text'], null,
         format('select onboarding_offen::text from public.profiles where id = %L', v_tl), 'wert:false', array['TL-Konto']),
        ('Trainer-Link-Konto darf Spieler freigeben (Trainer)', array[format('update public.profiles set freigabe = ''wartet'', player_id = null where id = %L', v_t)], array[format('select public.anfrage_freigeben(%L, %L, null)::text', v_t, v_p2)], null,
         format('select freigabe from public.profiles where id = %L', v_t), 'wert:aktiv', array['TL-Konto']),
        ('Trainer-Link-Konto erzeugt keinen Trainer-Link', null, array['select public.trainer_link_erzeugen()::text'], null, null, 'verweigert', array['TL-Konto']),
        ('Profil selbst ändern (onboarding_offen)', null, array[format('update public.profiles set onboarding_offen = true where id = %L', v_t)], null,
         format('select onboarding_offen::text from public.profiles where id = %L', v_t), 'wert:false', array['Spieler']),

        -- ---- Bestand ---------------------------------------------------------------------
        ('Bestand: ein Spieler-Link je Mannschaft (Index)', null, null, null,
         'select (pg_get_indexdef(''public.einladungen_eine_gueltige''::regclass) like ''%art = ''''spieler''''%'')::text', 'wert:true', array['intern']),
        ('Bestand: Trainer-Links haben ein Ablaufdatum', null, null, null,
         'select count(*)::text from public.einladungen where art = ''trainer'' and gueltig_bis is null', 'wert:0', array['intern'])
      ) as t(fall, vor, aktion, nach, pruef, erwartet, rollen)
      where r.rolle = any(t.rollen)
    loop
      v_nr := v_nr + 1;
      v_ok := false; v_txt := null; v_state := null; v_msg := null;
      begin
        foreach s in array (case when r.rolle in ('anon','intern','Wartend') then v_basis else v_frei end) loop execute s; end loop;
        if r.zusatzrolle is not null then
          insert into public.user_roles (user_id, role, club_id) values (v_t, r.zusatzrolle, v_club) on conflict do nothing;
        end if;
        foreach s in array coalesce(f.vor, '{}'::text[]) loop execute s; end loop;
        v_sub := case when r.rolle = 'TL-Konto' then v_tl else v_t end;
        if r.rolle = 'anon' then
          perform set_config('request.jwt.claims', '{"role":"anon"}', true);
          execute 'set local role anon';
        elsif r.rolle <> 'intern' then
          perform set_config('request.jwt.claims', json_build_object('sub', v_sub, 'role', 'authenticated')::text, true);
          execute 'set local role authenticated';
        end if;
        if f.aktion is not null then
          for i in 1 .. array_length(f.aktion, 1) loop
            if f.pruef is null and f.nach is null and i = array_length(f.aktion, 1) then execute f.aktion[i] into v_txt; else execute f.aktion[i]; end if;
          end loop;
        end if;
        if r.rolle <> 'intern' then execute 'reset role'; end if;
        foreach s in array coalesce(f.nach, '{}'::text[]) loop execute s; end loop;
        perform set_config('request.jwt.claims', '', true);
        if f.pruef is not null then execute f.pruef into v_txt; end if;
        v_ok := true;
        raise exception using errcode = 'P0063', message = 'zurückrollen';
      exception when others then
        if sqlstate <> 'P0063' then v_state := sqlstate; v_msg := sqlerrm; end if;
      end;
      v_urteil := case
        when f.erwartet = 'verweigert' then case when not v_ok and v_state = '42501' then 'PASS' else 'FAIL' end
        when f.erwartet = 'ok' then case when v_ok then 'PASS' else 'FAIL' end
        when f.erwartet like 'wert:%' then case when v_ok and coalesce(v_txt, '') = substr(f.erwartet, 6) then 'PASS' else 'FAIL' end
        when f.erwartet like 'fehler:%' then case when not v_ok and v_state <> '42501' and v_msg like '%' || substr(f.erwartet, 8) || '%' then 'PASS' else 'FAIL' end
      end;
      insert into pruef_0063 values (v_nr, r.rolle, f.fall, f.erwartet,
        case when v_ok then 'gelungen: ' || coalesce(left(v_txt, 200), '(null)') else 'abgelehnt: ' || v_state || ' ' || left(v_msg, 160) end, v_urteil);
    end loop;
  end loop;
end
$pruef$;

select nr, rolle, fall, erwartet, ergebnis, urteil from pruef_0063
union all
select null, 'SUMME', count(*) || ' Fälle: ' || count(*) filter (where urteil = 'PASS') || ' PASS, '
       || count(*) filter (where urteil = 'FAIL') || ' FAIL', null, null, null from pruef_0063
order by nr nulls last;
