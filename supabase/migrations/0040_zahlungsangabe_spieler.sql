-- ============================================================================
-- FC Fasanerie-Nord - Migration 0040: Angabe des Spielers zur Zahlung
--
-- Das neue Kassendesign zeigt an drei Stellen, WAS DER SPIELER GESAGT HAT:
--   "PayPal - gemeldet heute, 18:42"  und  "Per PayPal an die Kasse geschickt."
--   in "Zu pruefen", den bernsteinfarbenen Balken in "Offen" und den Hinweis
--   "Vorausgewaehlt nach Angabe des Spielers." im Buchen-Blatt.
--
-- Heute gibt es diese Angabe nicht: report_my_payment() nimmt keine Argumente
-- und setzt nur den Status. payment_method gehoert dem Kassenwart (er schreibt
-- sie beim Buchen), note gehoert der Anlage. Beide duerfen nicht ueberladen
-- werden, sonst laesst sich Behauptung und Buchung nicht mehr auseinander
-- halten - genau das ist der Grund fuer zwei eigene Spalten.
--
-- BEWUSST NICHT GEAENDERT: confirm_fines, mark_fines_paid, reject_fine,
-- create_fines_batch, cancel_fine, cancel_batch. Insbesondere raeumt
-- reject_fine die Angabe NICHT weg - abgelehnt heisst, der Kassenwart
-- widerspricht der Behauptung, nicht dass sie nie gemacht wurde. Dadurch
-- traegt eine wieder offene Strafe den Balken aus Bild 2.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Zwei Spalten an fines
-- ----------------------------------------------------------------------------
alter table public.fines add column if not exists reported_method text;
alter table public.fines add column if not exists reported_note   text;

-- Dieselben drei Werte wie payment_method sie im Client kennt. Als Constraint,
-- damit kein Tippfehler aus einem anderen Weg in die Anzeige durchschlaegt.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'fines_reported_method_chk') then
    alter table public.fines add constraint fines_reported_method_chk
      check (reported_method is null or reported_method in ('bar','ueberweisung','paypal'));
  end if;
end;
$$;

comment on column public.fines.reported_method is
  'Zahlart, die der SPIELER angegeben hat. Behauptung, keine Buchung - gebucht wird in payment_method.';
comment on column public.fines.reported_note is
  'Freier Text des Spielers zur Zahlung, z. B. "zahle bar am Donnerstag". Hoechstens 140 Zeichen.';

-- ----------------------------------------------------------------------------
-- 2) Melden mit Angabe
-- ----------------------------------------------------------------------------
-- Die bestehende report_my_payment() OHNE Argumente bleibt unveraendert
-- bestehen, damit die heutige Spieleransicht weiterlaeuft, solange sie die
-- beiden Felder noch nicht anbietet. PostgREST unterscheidet die beiden
-- Signaturen am Rumpf der Anfrage.
create or replace function public.report_my_payment(p_method text, p_note text default null)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  v_player uuid;
  v_count  integer;
  v_note   text;
begin
  select player_id into v_player from public.profiles where id = auth.uid();
  if v_player is null then
    raise exception 'Dein Konto ist noch keinem Spieler zugeordnet.';
  end if;

  if p_method is null or p_method not in ('bar','ueberweisung','paypal') then
    raise exception 'Bitte eine gueltige Zahlart angeben.';
  end if;

  -- Der Text landet als Zitat in der Kasse. Laenge begrenzen, damit die Karte
  -- nicht von einem Absatz gesprengt wird; leer heisst null, nicht "".
  v_note := nullif(btrim(coalesce(p_note, '')), '');
  if v_note is not null and length(v_note) > 140 then
    v_note := left(v_note, 140);
  end if;

  update public.fines
     set status          = 'gemeldet',
         reported_method = p_method,
         reported_note   = v_note
   where player_id = v_player and status = 'offen';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.report_my_payment(text, text) to authenticated;

comment on function public.report_my_payment(text, text) is
  'Spieler meldet seine offenen Strafen als bezahlt und sagt dazu, wie und ggf. wann.';

-- ----------------------------------------------------------------------------
-- 3) Gegenprobe
-- ----------------------------------------------------------------------------
do $$
declare
  v_n integer;
begin
  select count(*) into v_n from information_schema.columns
   where table_schema = 'public' and table_name = 'fines'
     and column_name in ('reported_method','reported_note');
  if v_n <> 2 then
    raise exception 'Spalten fehlen - Migration abgebrochen.';
  end if;

  -- Die alte Signatur muss erhalten geblieben sein, sonst faellt die heutige
  -- Spieleransicht aus.
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'report_my_payment' and p.pronargs = 0
  ) then
    raise exception 'report_my_payment() ohne Argumente ist verschwunden - Migration abgebrochen.';
  end if;

  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'report_my_payment' and p.pronargs = 2
  ) then
    raise exception 'report_my_payment(text, text) fehlt - Migration abgebrochen.';
  end if;

  raise notice 'Spalten reported_method und reported_note angelegt, beide Signaturen von report_my_payment vorhanden.';
end;
$$;
