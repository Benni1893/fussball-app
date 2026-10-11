-- ============================================================================
-- FC Fasanerie-Nord - Migration 0071: Zahlungsziel der fuenf alten Meldungen
--
-- Ausdrueckliche Entscheidung des Nutzers vom 11.10.2026: die fuenf am
-- 28.09.2026 gemeldeten, noch unbestaetigten Zahlungen (vor 0065, ohne
-- Zahlungsziel) einmalig dem damaligen Link-Halter zuordnen, wenn es der
-- heutige ist, und das protokollieren.
--
-- Befund: Am 28.09. stand der PayPal-Name fest im Code der Live-App
-- (app.js, PAYPAL_ME = "Teamkassefasanerie", unveraendert seit 05.06.).
-- Heute ist derselbe Name hinterlegt, paypal_von ist das Konto, das die
-- Kasse damals als Admin fuehrte (Rolle Kassenwart seit 05.10.). Also:
-- derselbe Link, dieselbe Person.
--
-- Geaendert werden NUR zahlung_an, zahlung_an_name, zahlung_an_paypal der
-- fuenf Zeilen. Kein Statuswechsel, deshalb kein Push, kein Verlaufseintrag,
-- kein Zuschlag (alle Trigger reagieren nur auf Statuswechsel).
-- Aufbau: EIN do-Block mit Gegenprobe.
-- ============================================================================

begin;

do $migration$
declare
  v_ids uuid[] := array['1ce79e20-6631-4880-a95d-49126a9ab2c1', 'f376c831-ad42-40b5-b93b-d991cfd00602',
                        '6836f73b-4fe0-4fcc-bcf6-2b424d753ac8', 'e3f04748-0a7a-4c55-83a6-cc76227953d2',
                        '99a7b026-7a05-4ed6-9ad8-b45a23fa3d0c']::uuid[];
  v_halter uuid; v_link text; v_n integer;
  v_outbox integer; v_sammler integer; v_log integer; v_summe_vorher numeric; v_summe_nachher numeric;
begin
  select paypal_von, paypal_name into v_halter, v_link from public.team_settings limit 1;
  if v_link is distinct from 'Teamkassefasanerie' or v_halter is null then
    raise exception 'Abbruch: heutiger Link ist nicht der vom 28.09. (%).', v_link;
  end if;
  -- genau diese fuenf, alle gemeldet am 28.09., ohne Ziel
  select count(*) into v_n from public.fines f
   where f.id = any(v_ids) and f.status = 'gemeldet' and f.zahlung_an is null and not f.an_vorherigen
     and exists (select 1 from public.fine_status_log l where l.fine_id = f.id and l.to_status = 'gemeldet'
                  and l.changed_at::date = date '2026-09-28');
  if v_n <> 5 then raise exception 'Abbruch: erwartet 5 passende Meldungen, gefunden %.', v_n; end if;
  if (select count(*) from public.fines where status = 'gemeldet' and zahlung_an is null) <> 5 then
    raise exception 'Abbruch: es gibt weitere Meldungen ohne Ziel.';
  end if;

  select count(*) into v_outbox from public.notification_outbox;
  select count(*) into v_sammler from public.notification_sammler;
  select count(*) into v_log from public.fine_status_log;
  select sum(coalesce(base_amount, 0) + coalesce(surcharge, 0)) into v_summe_vorher from public.fines;

  update public.fines
     set zahlung_an = v_halter, zahlung_an_name = public.konto_name(v_halter), zahlung_an_paypal = v_link
   where id = any(v_ids);

  insert into public.konto_protokoll (akteur, ziel, ziel_name, aktion, details)
  values (null, v_halter, public.konto_name(v_halter), 'zahlungsziel_nachgetragen',
          jsonb_build_object('anzahl', 5, 'strafen', to_jsonb(v_ids), 'paypal', v_link,
                             'grund', 'Meldungen vom 28.09.2026 vor 0065, Entscheidung des Nutzers vom 11.10.2026'));

  -- Gegenprobe
  if (select count(*) from public.fines where id = any(v_ids) and zahlung_an = v_halter and zahlung_an_paypal = v_link and status = 'gemeldet' and not an_vorherigen) <> 5 then
    raise exception 'Gegenprobe 0071: Zuordnung unvollstaendig.';
  end if;
  if (select anzahl from public.kassenwart_offen_intern(v_halter)) <> 5 then
    raise exception 'Gegenprobe 0071: offene Meldungen zaehlen nicht.';
  end if;
  select sum(coalesce(base_amount, 0) + coalesce(surcharge, 0)) into v_summe_nachher from public.fines;
  if (select count(*) from public.notification_outbox) <> v_outbox or (select count(*) from public.notification_sammler) <> v_sammler
     or (select count(*) from public.fine_status_log) <> v_log or v_summe_nachher <> v_summe_vorher then
    raise exception 'Gegenprobe 0071: Nebenwirkung (Outbox, Sammler, Verlauf oder Betraege).';
  end if;
  raise notice 'Gegenprobe 0071 bestanden: 5 Meldungen an %, Link %.', public.konto_name(v_halter), v_link;
end
$migration$;

commit;

-- RUECKBAU (nicht automatisch): fuer die fuenf ids zahlung_an, zahlung_an_name,
-- zahlung_an_paypal auf null; Protokollzeile 'zahlungsziel_nachgetragen' loeschen.
