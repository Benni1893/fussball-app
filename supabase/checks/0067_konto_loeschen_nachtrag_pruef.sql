-- ============================================================================
-- Prüfung zu Migration 0067 (Konto löschen anonymisiert Trainer-Link und
-- Zahlungsziel). Der Rollenfall ("0067: ...") steht in
-- 0065_kassenwart_wechsel_pruef.sql, weil er denselben Aufbau braucht.
-- Hier nur Bestand und Funktionstext. Ändert nichts.
-- ============================================================================

with f(nr, fall, ok) as (values
  (1, 'konto_entfernen_intern leert benutzt_von',
   (select prosrc from pg_proc where proname = 'konto_entfernen_intern' and pronamespace = 'public'::regnamespace) like '%set benutzt_von = null where benutzt_von = p_profil%'),
  (2, 'konto_entfernen_intern anonymisiert das Zahlungsziel',
   (select prosrc from pg_proc where proname = 'konto_entfernen_intern' and pronamespace = 'public'::regnamespace) like '%zahlung_an_name = ''gelöschtes Konto'', zahlung_an_paypal = null where zahlung_an = p_profil%'),
  (3, 'Bestand: kein Zahlungsziel auf ein gelöschtes Konto',
   not exists (select 1 from public.fines x where x.zahlung_an is not null and not exists (select 1 from auth.users u where u.id = x.zahlung_an))),
  (4, 'Bestand: kein Trainer-Link verweist auf ein gelöschtes Konto',
   not exists (select 1 from public.einladungen e where e.benutzt_von is not null and not exists (select 1 from auth.users u where u.id = e.benutzt_von))),
  (5, 'konto_entfernen_intern nicht aufrufbar',
   not has_function_privilege('authenticated', 'public.konto_entfernen_intern(uuid, text)', 'execute'))
)
select nr::text, fall, case when ok then 'PASS' else 'FAIL' end as urteil from f
union all
select 'SUMME', count(*) filter (where ok) || ' PASS, ' || count(*) filter (where not ok) || ' FAIL', null from f
order by 1;
