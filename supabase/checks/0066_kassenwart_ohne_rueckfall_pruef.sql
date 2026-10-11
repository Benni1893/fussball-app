-- ============================================================================
-- Prüfung zu Migration 0066 (kein Rückfall beim Kassenwart-Wechsel).
-- Die Rollenfälle ("0066: ...") stehen in 0065_kassenwart_wechsel_pruef.sql,
-- weil sie denselben Aufbau brauchen. Hier nur Bestand und Funktionstext.
-- Ändert nichts.
-- ============================================================================

select fall, urteil from (values
  (1, 'Bestand: keine Strafe ohne Ziel markiert',
   case when (select count(*) from public.fines where an_vorherigen and zahlung_an is null) = 0 then 'PASS' else 'FAIL' end),
  (2, 'Bestand: Meldungen vor 0065 bleiben ohne Ziel',
   case when (select count(*) from public.fines f where f.zahlung_an is not null
               and not exists (select 1 from public.fine_status_log l where l.fine_id = f.id and l.changed_at >= timestamptz '2026-10-11 00:00+02')) = 0
        then 'PASS' else 'FAIL' end),
  (3, 'kassenwart_offen_intern ohne Rückfall auf den Link',
   case when (select prosrc from pg_proc where proname = 'kassenwart_offen_intern' and pronamespace = 'public'::regnamespace) not like '%paypal_von%' then 'PASS' else 'FAIL' end),
  (4, 'rolle_setzen markiert nur Meldungen mit Ziel',
   case when (select prosrc from pg_proc where proname = 'rolle_setzen' and pronamespace = 'public'::regnamespace) not like '%zahlung_an is null%' then 'PASS' else 'FAIL' end),
  (5, 'genau eine Fassung von rolle_setzen',
   case when (select count(*) from pg_proc where proname = 'rolle_setzen' and pronamespace = 'public'::regnamespace) = 1 then 'PASS' else 'FAIL' end)
) as t(nr, fall, urteil)
union all
select 'SUMME', count(*) filter (where urteil = 'PASS') || ' PASS, ' || count(*) filter (where urteil = 'FAIL') || ' FAIL' from (values
  (case when (select count(*) from public.fines where an_vorherigen and zahlung_an is null) = 0 then 'PASS' else 'FAIL' end),
  (case when (select count(*) from public.fines f where f.zahlung_an is not null
               and not exists (select 1 from public.fine_status_log l where l.fine_id = f.id and l.changed_at >= timestamptz '2026-10-11 00:00+02')) = 0
        then 'PASS' else 'FAIL' end),
  (case when (select prosrc from pg_proc where proname = 'kassenwart_offen_intern' and pronamespace = 'public'::regnamespace) not like '%paypal_von%' then 'PASS' else 'FAIL' end),
  (case when (select prosrc from pg_proc where proname = 'rolle_setzen' and pronamespace = 'public'::regnamespace) not like '%zahlung_an is null%' then 'PASS' else 'FAIL' end),
  (case when (select count(*) from pg_proc where proname = 'rolle_setzen' and pronamespace = 'public'::regnamespace) = 1 then 'PASS' else 'FAIL' end)
) as s(urteil);
