-- ============================================================================
-- FC Fasanerie-Nord - Migration 0007: Mahnzuschlag ab created_at + Einfrieren
--
-- Aenderungen gegenueber 0006:
--  * Die 7-Tage-Frist startet ab created_at (Anlage durch den Kassenwart),
--    NICHT ab dem Vergehens-Datum (date bleibt reine Info-Spalte).
--  * Berechnung sekundengenau (Schwelle 7 Tage = 604800 s) - exakt dieselbe
--    Formel wie im Frontend, damit Anzeige und Cron nie auseinanderlaufen.
--  * Neuer Trigger: sobald paid false->true springt (Kassenwart ODER
--    Selbstmeldung), wird der Zuschlag auf den aktuell faelligen Wert
--    eingefroren. Damit ist der eingefrorene Betrag exakt der angezeigte.
--
-- created_at existiert bereits (Migration 0001). Keine neuen Spalten noetig.
-- Regel: ab 7 Tagen +2 EUR, je weitere angefangene Woche +2 EUR, Deckel 5
-- Stufen / 10 EUR. Bezahlte Strafen frieren ein (Cron fasst nur offene an).
-- ============================================================================

-- 1) Cron-Funktion neu: Zielwert aus created_at ----------------------------
--    Zielwert = min(5, floor(Sekunden_seit_created_at / 604800)) * 2.
--    Idempotent: ein erneuter Lauf am selben Tag liefert denselben Zielwert
--    und aendert daher nichts (kein doppeltes Aufaddieren).
create or replace function public.apply_fine_surcharges()
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_count integer;
begin
  update public.fines
     set surcharge            = least(5, greatest(0, floor(extract(epoch from (now() - created_at)) / 604800)))::int * 2,
         surcharge_updated_at = current_date
   where paid = false
     and least(5, greatest(0, floor(extract(epoch from (now() - created_at)) / 604800)))::int * 2 <> surcharge;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- 2) Einfrier-Trigger: Zuschlag beim Bezahlen festschreiben -----------------
--    Greift, wenn paid von false/NULL auf true wechselt. Schreibt den aktuell
--    faelligen Zuschlag fest - egal ob der Cron heute schon lief.
create or replace function public.fines_settle_surcharge()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.paid = true and (old.paid is distinct from true) then
    new.surcharge            := least(5, greatest(0, floor(extract(epoch from (now() - new.created_at)) / 604800)))::int * 2;
    new.surcharge_updated_at := current_date;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_fines_settle_surcharge on public.fines;
create trigger trg_fines_settle_surcharge
  before update on public.fines
  for each row execute function public.fines_settle_surcharge();

-- 3) Stand sofort neu berechnen (jetzt ab created_at). Der taegliche Cron-Job
--    aus 0006 ruft dieselbe Funktion auf und bleibt unveraendert bestehen.
select public.apply_fine_surcharges();
