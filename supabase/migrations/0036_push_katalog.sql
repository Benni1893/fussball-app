-- ============================================================================
-- FC Fasanerie-Nord - Migration 0036: Push-Katalog mit Vorschau
--
-- Alle Texte der Benachrichtigungen stehen ab hier in EINER Tabelle, nicht in
-- Triggern und nicht im Frontend. Zwei Gruende:
--   1. Texte aendern heisst dann eine Zeile aendern, kein Deploy.
--   2. Jede Nachricht laesst sich vorher einmal echt aufs eigene Handy
--      schicken und ansehen, bevor sie an die Mannschaft geht.
--
-- Platzhalter stehen in geschweiften Klammern: {betrag}, {datum}, {namen}.
-- Erlaubt ist je Kategorie genau die Liste in der Spalte platzhalter. Fehlt
-- beim Rendern ein Wert oder steht ein unbekannter Platzhalter in der
-- Vorlage, wird NICHT gesendet - die Zeile bekommt einen Fehler und bleibt
-- liegen. Lieber keine Nachricht als "{betrag}" auf dem Sperrbildschirm.
--
-- TTL: ttl_regel 'fix' nimmt ttl_sekunden unveraendert. 'bis_zeitpunkt'
-- rechnet die Restzeit bis zu einem uebergebenen Zeitpunkt (Meldeschluss,
-- Anpfiff) und deckelt sie bei ttl_sekunden. Eine Erinnerung, die erst nach
-- dem Meldeschluss ankaeme, soll gar nicht mehr ankommen.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Der Katalog
-- ----------------------------------------------------------------------------
create table if not exists public.notification_templates (
  kategorie               text primary key,
  titel_vorlage           text not null,
  text_vorlage            text not null,
  deep_link_vorlage       text,
  urgency                 text not null default 'normal' check (urgency in ('normal','high')),
  ttl_regel               text not null default 'fix' check (ttl_regel in ('fix','bis_zeitpunkt')),
  ttl_sekunden            integer not null default 86400 check (ttl_sekunden between 60 and 2419200),
  platzhalter             text[] not null default '{}',
  beispiel_daten          jsonb  not null default '{}',
  empfaenger_beschreibung text not null,
  ausloeser_beschreibung  text not null,
  aktiv                   boolean not null default true,
  updated_at              timestamptz not null default now(),
  updated_by              uuid references public.profiles(id) on delete set null,
  constraint notification_templates_kat_chk check (kategorie in (
    'strafe_neu','zahlung_bestaetigt','zahlung_abgelehnt','zahlung_gemeldet',
    'absage_kurzfristig','termin_geaendert','termin_neu',
    'rueckmeldung_erinnerung','unterbesetzung','meldeschluss_uebersicht',
    'strafen_offen','test'))
);

comment on table  public.notification_templates is
  'Die Texte aller Benachrichtigungen. Einzige Quelle - Trigger und Frontend enthalten keine Texte.';
comment on column public.notification_templates.platzhalter is
  'Welche {namen} diese Kategorie kennt. Alles andere in der Vorlage ist ein Fehler.';
comment on column public.notification_templates.beispiel_daten is
  'Werte fuer die Vorschau. Leben bei der Vorlage, damit die Vorschau mitwaechst.';
comment on column public.notification_templates.ttl_regel is
  'fix = ttl_sekunden. bis_zeitpunkt = Restzeit bis zum uebergebenen Zeitpunkt, gedeckelt bei ttl_sekunden.';

alter table public.notification_templates enable row level security;

-- Lesen nur Admin. Der Dispatcher arbeitet mit dem Service-Role-Key und
-- umgeht RLS ohnehin; die Texte gehen normale Nutzer nichts an.
drop policy if exists notif_tpl_sel on public.notification_templates;
create policy notif_tpl_sel on public.notification_templates
  for select to authenticated using (public.is_admin());
-- Schreiben ausschliesslich ueber set_notification_template().

-- ----------------------------------------------------------------------------
-- 2) Vorschau-Kennzeichen an der Outbox
-- ----------------------------------------------------------------------------
alter table public.notification_outbox
  add column if not exists ist_vorschau boolean not null default false;

comment on column public.notification_outbox.ist_vorschau is
  'Von "An mich senden" erzeugt. Umgeht Ruhezeiten und Kategorie-Schalter, in der Liste als Vorschau markiert.';

-- ----------------------------------------------------------------------------
-- 3) Rendern
-- ----------------------------------------------------------------------------
-- Ersetzt {platzhalter} aus dem Datenobjekt. Unbekannter Platzhalter oder
-- fehlender Wert -> Ausnahme. Der Aufrufer faengt sie und schreibt den Fehler
-- in die Outbox, statt etwas Halbfertiges zu senden.
create or replace function public.render_vorlage(p_vorlage text, p_daten jsonb, p_erlaubt text[])
returns text
language plpgsql immutable set search_path = public
as $$
declare
  v_out  text := coalesce(p_vorlage, '');
  v_name text;
  v_wert text;
begin
  for v_name in
    select distinct m[1]
      from regexp_matches(coalesce(p_vorlage, ''), '\{([a-zA-Z0-9_]+)\}', 'g') m
  loop
    if p_erlaubt is not null and array_length(p_erlaubt, 1) is not null
       and not (v_name = any(p_erlaubt)) then
      raise exception 'Unbekannter Platzhalter {%} in der Vorlage.', v_name using errcode = '22023';
    end if;
    v_wert := p_daten ->> v_name;
    if v_wert is null or btrim(v_wert) = '' then
      raise exception 'Kein Wert fuer {%}.', v_name using errcode = '22023';
    end if;
    v_out := replace(v_out, '{' || v_name || '}', v_wert);
  end loop;
  return v_out;
end;
$$;

-- ----------------------------------------------------------------------------
-- 4) notify_enqueue rendert jetzt aus dem Katalog
-- ----------------------------------------------------------------------------
-- Die alte Fassung nahm Titel und Text als Text entgegen. Sie wird ersetzt,
-- nicht ueberladen - sonst bliebe ein zweiter Weg offen, an dem Texte vorbei
-- am Katalog entstehen koennen.
drop function if exists public.notify_enqueue(uuid, text, text, text, text, text, text, integer, text, text, timestamptz);

create or replace function public.notify_enqueue(
  p_profile    uuid,
  p_kategorie  text,
  p_daten      jsonb   default '{}',
  p_dedup      text    default null,
  p_bundle     text    default null,
  p_tag        text    default null,
  p_not_before timestamptz default now(),
  p_ttl_bis    timestamptz default null,     -- nur bei ttl_regel = 'bis_zeitpunkt'
  p_vorschau   boolean default false
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  t          public.notification_templates%rowtype;
  v_titel    text;
  v_text     text;
  v_link     text;
  v_ttl      integer;
  v_fehler   text := null;
  v_id       uuid;
begin
  if p_profile is null then return null; end if;

  select * into t from public.notification_templates where kategorie = p_kategorie;
  if t.kategorie is null then
    raise exception 'Unbekannte Kategorie: %', p_kategorie;
  end if;
  if not t.aktiv and not p_vorschau then
    return null;                      -- abgeschaltet: still nichts tun
  end if;

  -- Rendern. Scheitert es, wird die Zeile trotzdem angelegt - mit Fehler und
  -- ohne Versand. So ist der Fall sichtbar statt spurlos.
  begin
    v_titel := public.render_vorlage(t.titel_vorlage,     p_daten, t.platzhalter);
    v_text  := public.render_vorlage(t.text_vorlage,      p_daten, t.platzhalter);
    v_link  := public.render_vorlage(t.deep_link_vorlage, p_daten, t.platzhalter);
  exception when others then
    v_fehler := left(sqlerrm, 400);
    v_titel  := t.titel_vorlage;
    v_text   := t.text_vorlage;
    v_link   := t.deep_link_vorlage;
  end;

  -- TTL bestimmen.
  if t.ttl_regel = 'bis_zeitpunkt' and p_ttl_bis is not null then
    v_ttl := greatest(60, least(t.ttl_sekunden,
               floor(extract(epoch from (p_ttl_bis - now())))::integer));
  else
    v_ttl := t.ttl_sekunden;
  end if;

  insert into public.notification_outbox
    (profile_id, kategorie, titel, text, deep_link, tag, urgency, ttl_seconds,
     dedup_key, bundle_key, not_before, ist_vorschau, error)
  values
    (p_profile, p_kategorie, left(v_titel, 120), left(v_text, 400), v_link,
     coalesce(p_tag, p_kategorie), t.urgency, v_ttl,
     p_dedup, p_bundle, p_not_before, p_vorschau, v_fehler)
  on conflict (dedup_key) do nothing
  returning id into v_id;

  return v_id;   -- null = schon vorhanden
end;
$$;

-- send_test_notification an die neue Signatur anpassen.
create or replace function public.send_test_notification()
returns uuid
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.'; end if;
  if not exists (select 1 from public.push_subscriptions where profile_id = auth.uid()) then
    raise exception 'Fuer dieses Konto ist noch kein Geraet angemeldet.';
  end if;

  return public.notify_enqueue(
    p_profile   => auth.uid(),
    p_kategorie => 'test',
    p_daten     => '{}'::jsonb,
    -- Zeitstempel im Schluessel: zweimal druecken soll zweimal ankommen.
    p_dedup     => 'test:' || auth.uid()::text || ':' || extract(epoch from clock_timestamp())::bigint::text,
    p_tag       => 'test');
end;
$$;

-- ----------------------------------------------------------------------------
-- 5) Die faellige Sicht kennt jetzt die Vorschau
-- ----------------------------------------------------------------------------
-- Vorschau-Nachrichten umgehen Ruhezeiten und Kategorie-Schalter: der Admin
-- hat gerade auf den Knopf gedrueckt und will sie jetzt sehen.
create or replace view public.notification_due as
select o.*
  from public.notification_outbox o
  join public.notification_prefs p on p.profile_id = o.profile_id
 where o.sent_at is null
   and o.error is null
   and o.not_before <= now()
   and (o.claimed_at is null or o.claimed_at < now() - interval '5 minutes')
   and (o.ist_vorschau or o.kategorie = 'test'
        or coalesce(case o.kategorie
             when 'strafe_neu'              then p.strafe_neu
             when 'zahlung_bestaetigt'      then p.zahlung_bestaetigt
             when 'zahlung_abgelehnt'       then p.zahlung_abgelehnt
             when 'zahlung_gemeldet'        then p.zahlung_gemeldet
             when 'absage_kurzfristig'      then p.absage_kurzfristig
             when 'termin_geaendert'        then p.termin_geaendert
             when 'termin_neu'              then p.termin_neu
             when 'rueckmeldung_erinnerung' then p.rueckmeldung_erinnerung
             when 'unterbesetzung'          then p.unterbesetzung
             when 'meldeschluss_uebersicht' then p.meldeschluss_uebersicht
             when 'strafen_offen'           then p.strafen_offen
           end, false))
   and (o.ist_vorschau or o.kategorie = 'test'
        or not public.in_quiet_hours(p.quiet_from, p.quiet_to)
        or (o.urgency = 'high' and p.quiet_override_urgent));

-- ----------------------------------------------------------------------------
-- 6) Schreibwege fuer den Admin
-- ----------------------------------------------------------------------------
create or replace function public.set_notification_template(
  p_kategorie text, p_titel text, p_text text, p_aktiv boolean default null
)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Nur Admin.'; end if;
  if coalesce(btrim(p_titel),'') = '' or coalesce(btrim(p_text),'') = '' then
    raise exception 'Titel und Text duerfen nicht leer sein.';
  end if;

  -- Vorab gegen die Beispieldaten rendern. Eine Vorlage mit unbekanntem
  -- Platzhalter darf gar nicht erst gespeichert werden - sonst faellt der
  -- Fehler erst auf, wenn die Nachricht gebraucht wird.
  perform public.render_vorlage(p_titel, t.beispiel_daten, t.platzhalter),
          public.render_vorlage(p_text,  t.beispiel_daten, t.platzhalter)
     from public.notification_templates t where t.kategorie = p_kategorie;

  update public.notification_templates set
    titel_vorlage = p_titel,
    text_vorlage  = p_text,
    aktiv         = coalesce(p_aktiv, aktiv),
    updated_at    = now(),
    updated_by    = auth.uid()
  where kategorie = p_kategorie;

  if not found then raise exception 'Unbekannte Kategorie: %', p_kategorie; end if;
end;
$$;

-- "An mich senden": rendert mit den Beispieldaten und schickt ausschliesslich
-- an den Aufrufer - auch bei Kategorien, die sonst an die ganze Mannschaft
-- gehen. p_profile ist fest auth.uid(), der Aufrufer kann kein Ziel waehlen.
create or replace function public.send_preview_notification(p_kategorie text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare t public.notification_templates%rowtype;
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
    p_dedup      => 'vorschau:' || p_kategorie || ':' || auth.uid()::text || ':'
                    || extract(epoch from clock_timestamp())::bigint::text,
    -- Eigener tag je Kategorie, sonst ersetzt die naechste Vorschau die
    -- vorige auf dem Sperrbildschirm statt sich danebenzulegen.
    p_tag        => 'vorschau-' || p_kategorie,
    p_not_before => now(),
    p_ttl_bis    => now() + interval '1 hour',
    p_vorschau   => true);
end;
$$;

create or replace function public.delete_preview_notifications()
returns integer
language plpgsql security definer set search_path = public
as $$
declare v_n integer;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.'; end if;
  delete from public.notification_outbox
   where profile_id = auth.uid() and ist_vorschau = true;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

grant execute on function public.set_notification_template(text, text, text, boolean) to authenticated;
grant execute on function public.send_preview_notification(text)                      to authenticated;
grant execute on function public.delete_preview_notifications()                       to authenticated;

-- ----------------------------------------------------------------------------
-- 7) Die Starttexte
-- ----------------------------------------------------------------------------
-- Zwei Titel sind gegenueber dem Entwurf GEKUERZT, weil sie sonst auf dem
-- Sperrbildschirm abgeschnitten werden (ueber 40 Zeichen mit echten Daten -
-- "VfB Sparta Muenchen" ist ein langer, aber realer Gegnername):
--   rueckmeldung_erinnerung: Datum aus dem Titel in den Text geholt
--   unterbesetzung:          desgleichen
-- Alles andere steht wortgleich so da, wie vorgegeben.
insert into public.notification_templates
  (kategorie, titel_vorlage, text_vorlage, deep_link_vorlage, urgency,
   ttl_regel, ttl_sekunden, platzhalter, beispiel_daten,
   empfaenger_beschreibung, ausloeser_beschreibung)
values
  ('strafe_neu',
   'Neue Strafe: {betrag}', '{grund}, {datum}', '#strafen=meine', 'normal',
   'fix', 604800, array['betrag','grund','datum'],
   '{"betrag":"8,00 €","grund":"Verspätete Rückmeldung","datum":"20.09.2026"}',
   'Der betroffene Spieler, sonst niemand.',
   'Eine Strafe wird verhängt - von Hand oder automatisch zum Anpfiff.'),

  ('zahlung_bestaetigt',
   'Zahlung bestätigt', '{anzahl} Strafen, {betrag} sind verbucht', '#strafen=meine', 'normal',
   'fix', 604800, array['anzahl','betrag'],
   '{"anzahl":"3","betrag":"43,50 €"}',
   'Der Spieler, dessen Zahlung bestätigt wurde.',
   'Der Kassenwart bestätigt eine gemeldete Zahlung.'),

  ('zahlung_abgelehnt',
   'Zahlung nicht bestätigt', '{betrag}: {grund}', '#strafen=meine', 'normal',
   'fix', 604800, array['betrag','grund'],
   '{"betrag":"43,50 €","grund":"Betrag stimmt nicht überein"}',
   'Der Spieler, dessen Zahlung abgelehnt wurde.',
   'Der Kassenwart lehnt eine gemeldete Zahlung ab.'),

  ('zahlung_gemeldet',
   '{anzahl} Zahlungen zu prüfen', '{namen}, {betrag}', '#kasse=pruefen', 'normal',
   'fix', 259200, array['anzahl','namen','betrag'],
   '{"anzahl":"2","namen":"Max Bauer, Tobias Klein","betrag":"43,50 €"}',
   'Alle Kassenwarte.',
   'Ein Spieler meldet eine Zahlung. Gesammelt über 15 Minuten.'),

  ('absage_kurzfristig',
   '{anzahl} kurzfristige Absagen', '{termin_titel} {datum} {uhrzeit}: {namen}', '#termin={termin_id}', 'high',
   'bis_zeitpunkt', 86400, array['anzahl','termin_titel','datum','uhrzeit','namen','termin_id'],
   '{"anzahl":"2","termin_titel":"Training","datum":"22.09.","uhrzeit":"19:30 Uhr","namen":"Max Bauer, Tobias Klein","termin_id":"beispiel"}',
   'Alle Trainer.',
   'Absage nach Meldeschluss. Gesammelt über 10 Minuten je Termin.'),

  ('termin_geaendert',
   '{termin_titel} geändert', '{datum}: {aenderung}', '#termin={termin_id}', 'high',
   'bis_zeitpunkt', 86400, array['termin_titel','datum','aenderung','termin_id'],
   '{"termin_titel":"VfB Sparta München","datum":"20.09.2026","aenderung":"Anstoß jetzt 14:00 statt 12:30 Uhr","termin_id":"beispiel"}',
   'Alle Spieler.',
   'Zeit oder Ort eines Termins ändert sich, oder er wird abgesagt.'),

  ('termin_neu',
   '{anzahl} neue Termine', '{liste}', '#ansicht=kalender', 'normal',
   'fix', 604800, array['anzahl','liste'],
   '{"anzahl":"3","liste":"Training 22.09., Training 24.09., VfB Sparta München 27.09."}',
   'Alle Spieler.',
   'Neue Termine im Kalender. Gesammelt über 30 Minuten je Ersteller.'),

  ('rueckmeldung_erinnerung',
   '{termin_titel}: Zu- oder Absage?', '{datum} {uhrzeit} · Meldeschluss {meldeschluss}', '#termin={termin_id}', 'high',
   'bis_zeitpunkt', 86400, array['termin_titel','datum','uhrzeit','meldeschluss','termin_id'],
   '{"termin_titel":"VfB Sparta München","datum":"20.09.","uhrzeit":"12:30 Uhr","meldeschluss":"morgen 12:30 Uhr","termin_id":"beispiel"}',
   'Spieler ohne Rückmeldung zu diesem Termin.',
   '24 Stunden und 2 Stunden vor Meldeschluss.'),

  ('unterbesetzung',
   '{termin_titel}: erst {zusagen} Zusagen', '{datum} {uhrzeit} · mindestens {minimum} nötig, {offen} ohne Rückmeldung', '#termin={termin_id}', 'high',
   'bis_zeitpunkt', 86400, array['termin_titel','datum','uhrzeit','zusagen','minimum','offen','termin_id'],
   '{"termin_titel":"VfB Sparta München","datum":"20.09.","uhrzeit":"12:30 Uhr","zusagen":"7","minimum":"11","offen":"4","termin_id":"beispiel"}',
   'Alle Trainer.',
   'Vor Meldeschluss unter der Mindestzahl je Termintyp.'),

  ('meldeschluss_uebersicht',
   '{termin_titel} {datum} {uhrzeit}', '{zusagen} Zusagen, {absagen} Absagen, {offen} ohne Rückmeldung', '#termin={termin_id}', 'normal',
   'bis_zeitpunkt', 86400, array['termin_titel','datum','uhrzeit','zusagen','absagen','offen','termin_id'],
   '{"termin_titel":"Training","datum":"22.09.","uhrzeit":"19:30 Uhr","zusagen":"12","absagen":"3","offen":"4","termin_id":"beispiel"}',
   'Alle Trainer.',
   'Direkt nach Meldeschluss.'),

  ('strafen_offen',
   'Offene Strafen: {betrag}', '{anzahl} Strafen, älteste vom {datum}', '#strafen=meine', 'normal',
   'fix', 604800, array['betrag','anzahl','datum'],
   '{"betrag":"128,50 €","anzahl":"9","datum":"12.08.2026"}',
   'Spieler mit Strafen, die älter als vier Wochen sind.',
   'Höchstens einmal im Monat. Standard AUS.'),

  ('test',
   'Testnachricht', 'Benachrichtigungen funktionieren', '#ansicht=einstellungen', 'normal',
   'fix', 600, array[]::text[], '{}',
   'Nur der Auslöser selbst.',
   'Knopf "Testnachricht senden" in den Einstellungen.')
on conflict (kategorie) do nothing;

-- ----------------------------------------------------------------------------
-- 8) Gegenprobe: rendert jede Vorlage mit ihren Beispieldaten sauber durch?
-- ----------------------------------------------------------------------------
do $$
declare
  t public.notification_templates%rowtype;
  v_titel text; v_text text; v_link text;
  v_fehler integer := 0;
  v_lang   integer := 0;
begin
  for t in select * from public.notification_templates loop
    begin
      v_titel := public.render_vorlage(t.titel_vorlage,     t.beispiel_daten, t.platzhalter);
      v_text  := public.render_vorlage(t.text_vorlage,      t.beispiel_daten, t.platzhalter);
      v_link  := public.render_vorlage(t.deep_link_vorlage, t.beispiel_daten, t.platzhalter);
    exception when others then
      raise warning 'Kategorie %: % ', t.kategorie, sqlerrm;
      v_fehler := v_fehler + 1;
      continue;
    end;
    -- Ab diesen Laengen kuerzen die Sperrbildschirme.
    if length(v_titel) > 40 then
      raise warning 'Kategorie %: Titel % Zeichen - wird abgeschnitten: %', t.kategorie, length(v_titel), v_titel;
      v_lang := v_lang + 1;
    end if;
    if length(v_text) > 110 then
      raise warning 'Kategorie %: Text % Zeichen - wird abgeschnitten.', t.kategorie, length(v_text);
      v_lang := v_lang + 1;
    end if;
  end loop;

  if v_fehler > 0 then
    raise exception 'Katalog: % Vorlagen rendern nicht - Migration abgebrochen.', v_fehler;
  end if;
  raise notice 'Katalog: % Vorlagen rendern sauber, % ueber der Laengengrenze.',
    (select count(*) from public.notification_templates), v_lang;
end;
$$;
