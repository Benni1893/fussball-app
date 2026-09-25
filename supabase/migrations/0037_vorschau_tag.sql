-- ============================================================================
-- FC Fasanerie-Nord - Migration 0037: Vorschauen stapeln statt ersetzen
--
-- In 0036 bekam jede Vorschau den tag 'vorschau-<kategorie>'. Der tag hatte
-- einen guten Grund: bei "Alle an mich senden" sollen die elf Kategorien
-- nicht zu einer Mitteilung zusammenfallen. Er hat aber eine Nebenwirkung,
-- die beim Testen im Weg steht - zweimal dieselbe Kategorie gesendet, und die
-- zweite Mitteilung ERSETZT die erste, statt sich danebenzulegen. Genau das
-- will man beim Ausprobieren nicht: man drueckt, schaut, drueckt wieder und
-- vergleicht.
--
-- Der Zeitstempel im tag loest beides: je Kategorie verschieden UND je Druck
-- verschieden.
--
-- Im Echtbetrieb bleibt es beim sprechenden tag ohne Zeitstempel - dort ist
-- das Ersetzen gewollt ("2 Absagen" wird zu "3 Absagen", eine Mitteilung).
-- Diese Aenderung betrifft ausschliesslich die Vorschau.
-- ============================================================================

create or replace function public.send_preview_notification(p_kategorie text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  t      public.notification_templates%rowtype;
  v_zeit text := extract(epoch from clock_timestamp())::bigint::text;
begin
  if not public.is_admin() then raise exception 'Nur Admin.'; end if;
  if not exists (select 1 from public.push_subscriptions where profile_id = auth.uid()) then
    raise exception 'Fuer dieses Konto ist noch kein Geraet angemeldet.';
  end if;

  select * into t from public.notification_templates where kategorie = p_kategorie;
  if t.kategorie is null then raise exception 'Unbekannte Kategorie: %', p_kategorie; end if;

  return public.notify_enqueue(
    p_profile    => auth.uid(),
    p_kategorie  => p_kategorie,
    p_daten      => t.beispiel_daten,
    p_dedup      => 'vorschau:' || p_kategorie || ':' || auth.uid()::text || ':' || v_zeit,
    -- Kategorie UND Zeitstempel: verschiedene Kategorien fallen nicht
    -- zusammen, und dieselbe Kategorie zweimal legt sich nebeneinander.
    p_tag        => 'vorschau-' || p_kategorie || '-' || v_zeit,
    p_not_before => now(),
    p_ttl_bis    => now() + interval '1 hour',
    p_vorschau   => true);
end;
$$;
