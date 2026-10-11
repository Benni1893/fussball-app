-- ============================================================================
-- Prüfung zu Migration 0071 (Zahlungsziel der fünf Meldungen vom 28.09.).
-- Ändert nichts.
-- ============================================================================
with ids as (select jsonb_array_elements_text(details->'strafen')::uuid as id, details
               from public.konto_protokoll where aktion = 'zahlungsziel_nachgetragen'),
f(nr, fall, ok) as (values
  (1, 'genau ein Protokolleintrag mit fünf Strafen',
   (select count(*) from public.konto_protokoll where aktion = 'zahlungsziel_nachgetragen') = 1 and (select count(*) from ids) = 5),
  (2, 'die fünf tragen Ziel und Link Teamkassefasanerie',
   (select count(*) from public.fines x join ids on ids.id = x.id where x.zahlung_an is not null and x.zahlung_an_paypal = 'Teamkassefasanerie') = 5),
  (3, 'Status unverändert (gemeldet, oder später regulär bestätigt/abgelehnt)',
   not exists (select 1 from public.fines x join ids on ids.id = x.id where x.status not in ('gemeldet', 'bestätigt', 'offen'))),
  (4, 'kein Verlaufseintrag durch den Nachtrag (Meldung weiter vom 28.09.)',
   (select count(*) from public.fines x join ids on ids.id = x.id
     where exists (select 1 from public.fine_status_log l where l.fine_id = x.id and l.to_status = 'gemeldet' and l.changed_at::date = date '2026-09-28')) = 5),
  (5, 'keine Meldung mehr ohne Ziel aus der Zeit vor 0065',
   not exists (select 1 from public.fines x where x.status = 'gemeldet' and x.zahlung_an is null
                and exists (select 1 from public.fine_status_log l where l.fine_id = x.id and l.to_status = 'gemeldet' and l.changed_at < timestamptz '2026-10-11 00:00+02')))
)
select nr::text, fall, case when ok then 'PASS' else 'FAIL' end as urteil from f
union all
select 'SUMME', count(*) filter (where ok) || ' PASS, ' || count(*) filter (where not ok) || ' FAIL', null from f
order by 1;
