-- ============================================================================
-- 0029_catalog_staffel.sql  -  Gestaffelte Strafen im Strafenkatalog
--
-- Der Katalog kann bisher NUR Festbetraege (fine_catalog.amount). Diese Migration
-- ergaenzt einen Typ 'staffel': Betrag je angefangener Einheit (z.B. 2 EUR je 5 Min),
-- mit Einheit-Label und optionalem Hoechstbetrag.
--
-- Die Tabelle `fines` bleibt UNANGETASTET: Beim Verhaengen speichert die App den
-- berechneten Betrag (base_amount) und den Grund (offense) als Snapshot -> eine
-- verhaengte Strafe behaelt Betrag/Grund, auch wenn der Katalog spaeter geaendert wird.
--
-- Nur additive Spalten (idempotent). Bestehende Eintraege bleiben 'fixed'.
-- Ausfuehren: Supabase Dashboard -> SQL Editor -> einfuegen -> Run.
-- ============================================================================

alter table public.fine_catalog add column if not exists fine_type   text not null default 'fixed';  -- 'fixed' | 'staffel'
alter table public.fine_catalog add column if not exists unit_label  text;            -- z.B. 'Minuten'
alter table public.fine_catalog add column if not exists unit_amount numeric(8,2);     -- Betrag je angefangene Einheit
alter table public.fine_catalog add column if not exists unit_step   integer;          -- je angefangene N Einheiten (z.B. 5)
alter table public.fine_catalog add column if not exists max_amount  numeric(8,2);     -- optionaler Deckel (NULL = keiner)

-- Typ absichern (idempotent).
alter table public.fine_catalog drop constraint if exists fine_catalog_type_chk;
alter table public.fine_catalog add  constraint fine_catalog_type_chk check (fine_type in ('fixed','staffel'));

-- Staffel-Eintraege brauchen Schrittweite >= 1 und einen Betrag je Einheit.
alter table public.fine_catalog drop constraint if exists fine_catalog_staffel_chk;
alter table public.fine_catalog add  constraint fine_catalog_staffel_chk check (
  fine_type <> 'staffel'
  or (unit_step is not null and unit_step >= 1 and unit_amount is not null and unit_amount >= 0)
);

-- Kontrolle
select id, code, offense, fine_type, amount, unit_label, unit_amount, unit_step, max_amount
from public.fine_catalog order by code;
