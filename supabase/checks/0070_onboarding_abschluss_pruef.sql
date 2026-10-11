-- ============================================================================
-- Prüfung zu Migration 0070 (Onboarding-Abschluss nur mit Datenschutz).
-- Die Rollenfälle ("0070: ...") stehen in 0069_gegenpruefung_pruef.sql.
-- Hier Bestand und Funktionstext. Ändert nichts.
-- ============================================================================
with f(nr, fall, ok) as (values
  (1, 'onboarding_abschliessen verlangt die Datenschutz-Einwilligung',
   (select prosrc from pg_proc where proname = 'onboarding_abschliessen' and pronamespace = 'public'::regnamespace) like '%art = ''datenschutz''%'),
  (2, 'ist_mitglied prüft Trainer-Link-Konten auf die Einwilligung',
   (select prosrc from pg_proc where proname = 'ist_mitglied' and pronamespace = 'public'::regnamespace) like '%l.art = ''trainer''%'),
  (3, 'Bestand: kein aktives Trainer-Link-Konto ohne Einwilligung',
   not exists (select 1 from public.profiles p join public.einladungen l on l.id = p.eingeladen_ueber and l.art = 'trainer'
               where p.freigabe = 'aktiv' and not exists (select 1 from public.einwilligungen e where e.profile_id = p.id and e.art = 'datenschutz' and e.widerrufen_am is null)))
)
select nr::text, fall, case when ok then 'PASS' else 'FAIL' end as urteil from f
union all
select 'SUMME', count(*) filter (where ok) || ' PASS, ' || count(*) filter (where not ok) || ' FAIL', null from f
order by 1;
