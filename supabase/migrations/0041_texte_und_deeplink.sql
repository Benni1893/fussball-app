-- ============================================================================
-- FC Fasanerie-Nord - Migration 0041: interner Bezeichner raus, Deep Link um
--
-- Zwei Textkorrekturen am Push-Katalog. Kein DDL, keine Policy, keine
-- Funktion - nur zwei Felder in notification_templates.
--
-- 1) ausloeser_beschreibung von 'termin_abgesagt' nennt heute den internen
--    Bezeichner "termin_geaendert". Dieser Text steht nicht irgendwo im Log,
--    sondern steht ueber notification_infos() WOERTLICH auf dem Bildschirm,
--    als graue Unterzeile der Schalterzeile "Termin faellt aus". Die neue
--    Vorlage (einstellungen-kader/einstellungenneu2.png, Panel 3) zeigt dort
--    den sichtbaren Namen der anderen Kategorie in Anfuehrungszeichen.
--
-- 2) deep_link_vorlage von 'test' zeigt auf '#ansicht=einstellungen'. Die
--    Einstellungen bekommen mit diesem Paket Unterseiten; der Knopf
--    "Testnachricht senden" sitzt auf der Unterseite "Mitteilungen", und
--    genau dorthin soll die Nachricht zurueckfuehren.
--
-- BEWUSST NICHT GEAENDERT: notify_enqueue, send_test_notification, die
-- Trigger, die Outbox und der Versand. Der Deep Link wird beim EINREIHEN
-- festgeschrieben: notify_enqueue (0038) rendert deep_link_vorlage und
-- schreibt das Ergebnis in notification_outbox.deep_link, api/dispatch-push.js
-- liest ihn beim Versand von dort. Die Umstellung greift deshalb nur fuer
-- Testnachrichten, die NACH dieser Migration eingereiht werden; schon
-- eingereihte, noch nicht versendete behalten den alten Link (bei der
-- Gegenprobe vom 01.10.2026: keine solche Zeile in der Outbox).
--
-- Laeuft als eine Transaktion (begin/commit): schlaegt die Gegenprobe fehl,
-- wird nichts gespeichert. Wiederholbar - ein zweiter Lauf setzt dieselben
-- Werte und aendert nur updated_at.
-- ============================================================================

begin;

update public.notification_templates
set    ausloeser_beschreibung = 'Ein Termin wird abgesagt. Zeit- und Ortsänderungen laufen über „Termin geändert“.',
       updated_at             = now()
where  kategorie = 'termin_abgesagt';

update public.notification_templates
set    deep_link_vorlage = '#ein=mitteilungen',
       updated_at = now()
where  kategorie = 'test';

-- ----------------------------------------------------------------------------
-- Gegenprobe
-- ----------------------------------------------------------------------------
do $$
declare
  n_bez int;
  n_dl  int;
begin
  select count(*) into n_bez from public.notification_templates
   where kategorie = 'termin_abgesagt' and ausloeser_beschreibung like '%termin\_geaendert%';
  if n_bez > 0 then
    raise exception 'Der interne Bezeichner steht noch in der Beschreibung.';
  end if;

  -- Genau eine Zeile muss den neuen Text tragen - faengt auch den Fall ab,
  -- dass die Zeile fehlt und das UPDATE ins Leere gegangen ist.
  select count(*) into n_bez from public.notification_templates
   where kategorie = 'termin_abgesagt'
     and ausloeser_beschreibung = 'Ein Termin wird abgesagt. Zeit- und Ortsänderungen laufen über „Termin geändert“.';
  if n_bez <> 1 then
    raise exception 'Beschreibung von termin_abgesagt nicht genau einmal gesetzt (% Zeilen).', n_bez;
  end if;

  select count(*) into n_dl from public.notification_templates
   where kategorie = 'test' and deep_link_vorlage = '#ein=mitteilungen';
  if n_dl <> 1 then
    raise exception 'Deep Link der Testnachricht steht nicht auf #ein=mitteilungen.';
  end if;

  -- Sonst zeigt nichts mehr auf die alte Sammelansicht.
  select count(*) into n_dl from public.notification_templates
   where deep_link_vorlage = '#ansicht=einstellungen';
  if n_dl > 0 then
    raise notice 'Hinweis: % Vorlage(n) zeigen noch auf #ansicht=einstellungen.', n_dl;
  end if;
end;
$$;

commit;

-- ============================================================================
-- RUECKBAU (nicht automatisch ausgefuehrt - bei Bedarf als Block ausfuehren)
-- ============================================================================
-- update public.notification_templates
-- set    ausloeser_beschreibung = 'Ein Termin wird abgesagt. Zeit- und Ortsänderungen laufen über termin_geaendert.',
--        updated_at             = now()
-- where  kategorie = 'termin_abgesagt';
--
-- update public.notification_templates
-- set    deep_link_vorlage = '#ansicht=einstellungen',
--        updated_at = now()
-- where  kategorie = 'test';
