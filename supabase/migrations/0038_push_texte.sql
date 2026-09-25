-- ============================================================================
-- FC Fasanerie-Nord - Migration 0038: Neue Push-Texte, Emoji-System,
--                                     Kategorie termin_abgesagt
--
-- Drei Dinge auf einmal, weil sie zusammengehoeren:
--
-- 1. EMOJI-SYSTEM. Je ein Zeichen am Titelanfang, immer dasselbe fuer
--    dieselbe Art von Nachricht. Wer haeufig Push bekommt, erkennt die Art
--    vor dem Lesen:
--      🚨 dringend, Trainer muss reagieren   ⏳ Frist laeuft
--      💸 Spieler schuldet Geld              💰 Geld zu pruefen
--      ✅ erledigt                           ⚠️ Problem
--      📅 Termin-Info                        ❌ Ausfall
--      📋 Uebersicht                         🔔 Test
--    Steht auch in conventions.md, damit kuenftige Kategorien dem folgen.
--
-- 2. OPTIONALE PLATZHALTER. Bisher warf render_vorlage bei jedem fehlenden
--    Wert. termin_abgesagt braucht einen Grund, der fehlen darf - ein Termin
--    faellt manchmal einfach aus. Neue Spalte platzhalter_optional: diese
--    Namen duerfen fehlen, werden dann entfernt, und der Satz wird
--    aufgeraeumt (kein doppelter Abstand, kein Leerzeichen vor dem Punkt,
--    kein einzeln stehender Punkt).
--
-- 3. KATEGORIE termin_abgesagt. termin_geaendert deckt ab jetzt nur noch
--    Zeit- und Ortsaenderungen ab; der Ausfall bekommt einen eigenen Text,
--    einen eigenen Schalter und ein eigenes Zeichen.
--
-- ZWEI TEXTE WEICHEN VOM ENTWURF AB, beide begruendet unten am Katalog:
--   meldeschluss_uebersicht  Uhrzeit vom Titel in den Text (Titel sonst 41)
--   rueckmeldung_erinnerung  Datum und Uhrzeit im Text ergaenzt
--   unterbesetzung           desgleichen
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Die neue Kategorie in allen Listen
-- ----------------------------------------------------------------------------
alter table public.notification_outbox drop constraint if exists notification_outbox_kat_chk;
alter table public.notification_outbox add  constraint notification_outbox_kat_chk
  check (kategorie in (
    'strafe_neu','zahlung_bestaetigt','zahlung_abgelehnt','zahlung_gemeldet',
    'absage_kurzfristig','termin_geaendert','termin_abgesagt','termin_neu',
    'rueckmeldung_erinnerung','unterbesetzung','meldeschluss_uebersicht',
    'strafen_offen','test'));

alter table public.notification_templates drop constraint if exists notification_templates_kat_chk;
alter table public.notification_templates add  constraint notification_templates_kat_chk
  check (kategorie in (
    'strafe_neu','zahlung_bestaetigt','zahlung_abgelehnt','zahlung_gemeldet',
    'absage_kurzfristig','termin_geaendert','termin_abgesagt','termin_neu',
    'rueckmeldung_erinnerung','unterbesetzung','meldeschluss_uebersicht',
    'strafen_offen','test'));

-- Eigener Schalter, Standard an. Gehoert zur Gruppe Terminaenderungen.
alter table public.notification_prefs
  add column if not exists termin_abgesagt boolean not null default true;

comment on column public.notification_prefs.termin_abgesagt is
  'Termin faellt aus. Gehoert zur Gruppe Terminaenderungen, Standard an.';

-- ----------------------------------------------------------------------------
-- 2) Optionale Platzhalter
-- ----------------------------------------------------------------------------
alter table public.notification_templates
  add column if not exists platzhalter_optional text[] not null default '{}';

comment on column public.notification_templates.platzhalter_optional is
  'Diese Platzhalter duerfen fehlen. Sie werden dann entfernt und der Satz aufgeraeumt.';

-- Die Signatur aendert sich, deshalb erst loeschen: eine zweite Fassung
-- daneben waere bei drei Argumenten mehrdeutig.
drop function if exists public.render_vorlage(text, jsonb, text[]);

create or replace function public.render_vorlage(
  p_vorlage text, p_daten jsonb, p_erlaubt text[], p_optional text[] default '{}'
)
returns text
language plpgsql immutable set search_path = public
as $$
declare
  v_out      text := coalesce(p_vorlage, '');
  v_name     text;
  v_wert     text;
  v_geleert  boolean := false;
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
      if p_optional is not null and v_name = any(p_optional) then
        v_out := replace(v_out, '{' || v_name || '}', '');
        v_geleert := true;
        continue;
      end if;
      raise exception 'Kein Wert fuer {%}.', v_name using errcode = '22023';
    end if;

    v_out := replace(v_out, '{' || v_name || '}', v_wert);
  end loop;

  -- Nur aufraeumen, wenn wirklich etwas weggefallen ist - sonst koennte die
  -- Saeuberung einen gewollten Abstand veraendern.
  if v_geleert then
    v_out := regexp_replace(v_out, '\s+([.,;:!?])', '\1', 'g');   -- " ." -> "."
    v_out := regexp_replace(v_out, '\s{2,}', ' ', 'g');           -- doppelte Abstaende
    v_out := regexp_replace(v_out, '([.!?])\s*\1+', '\1', 'g');   -- ".." -> "."
    v_out := btrim(v_out);
  end if;

  return v_out;
end;
$$;

grant execute on function public.render_vorlage(text, jsonb, text[], text[]) to authenticated;

-- ----------------------------------------------------------------------------
-- 3) notify_enqueue reicht die optionale Liste durch
-- ----------------------------------------------------------------------------
create or replace function public.notify_enqueue(
  p_profile    uuid,
  p_kategorie  text,
  p_daten      jsonb   default '{}',
  p_dedup      text    default null,
  p_bundle     text    default null,
  p_tag        text    default null,
  p_not_before timestamptz default now(),
  p_ttl_bis    timestamptz default null,
  p_vorschau   boolean default false
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  t        public.notification_templates%rowtype;
  v_titel  text;
  v_text   text;
  v_link   text;
  v_ttl    integer;
  v_fehler text := null;
  v_id     uuid;
begin
  if p_profile is null then return null; end if;

  select * into t from public.notification_templates where kategorie = p_kategorie;
  if t.kategorie is null then
    raise exception 'Unbekannte Kategorie: %', p_kategorie;
  end if;
  if not t.aktiv and not p_vorschau then
    return null;
  end if;

  begin
    v_titel := public.render_vorlage(t.titel_vorlage,     p_daten, t.platzhalter, t.platzhalter_optional);
    v_text  := public.render_vorlage(t.text_vorlage,      p_daten, t.platzhalter, t.platzhalter_optional);
    v_link  := public.render_vorlage(t.deep_link_vorlage, p_daten, t.platzhalter, t.platzhalter_optional);
  exception when others then
    v_fehler := left(sqlerrm, 400);
    v_titel  := t.titel_vorlage;
    v_text   := t.text_vorlage;
    v_link   := t.deep_link_vorlage;
  end;

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

  return v_id;
end;
$$;

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

  perform public.render_vorlage(p_titel, t.beispiel_daten, t.platzhalter, t.platzhalter_optional),
          public.render_vorlage(p_text,  t.beispiel_daten, t.platzhalter, t.platzhalter_optional)
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

-- ----------------------------------------------------------------------------
-- 4) Einstellungen und faellige Sicht kennen die neue Kategorie
-- ----------------------------------------------------------------------------
create or replace function public.set_notification_prefs(p_werte jsonb)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.'; end if;

  insert into public.notification_prefs (profile_id) values (auth.uid())
  on conflict (profile_id) do nothing;

  update public.notification_prefs set
    strafe_neu              = coalesce((p_werte->>'strafe_neu')::boolean,              strafe_neu),
    zahlung_bestaetigt      = coalesce((p_werte->>'zahlung_bestaetigt')::boolean,      zahlung_bestaetigt),
    zahlung_abgelehnt       = coalesce((p_werte->>'zahlung_abgelehnt')::boolean,       zahlung_abgelehnt),
    zahlung_gemeldet        = coalesce((p_werte->>'zahlung_gemeldet')::boolean,        zahlung_gemeldet),
    absage_kurzfristig      = coalesce((p_werte->>'absage_kurzfristig')::boolean,      absage_kurzfristig),
    termin_geaendert        = coalesce((p_werte->>'termin_geaendert')::boolean,        termin_geaendert),
    termin_abgesagt         = coalesce((p_werte->>'termin_abgesagt')::boolean,         termin_abgesagt),
    termin_neu              = coalesce((p_werte->>'termin_neu')::boolean,              termin_neu),
    rueckmeldung_erinnerung = coalesce((p_werte->>'rueckmeldung_erinnerung')::boolean, rueckmeldung_erinnerung),
    unterbesetzung          = coalesce((p_werte->>'unterbesetzung')::boolean,          unterbesetzung),
    meldeschluss_uebersicht = coalesce((p_werte->>'meldeschluss_uebersicht')::boolean, meldeschluss_uebersicht),
    strafen_offen           = coalesce((p_werte->>'strafen_offen')::boolean,           strafen_offen),
    quiet_from              = coalesce((p_werte->>'quiet_from')::time,                 quiet_from),
    quiet_to                = coalesce((p_werte->>'quiet_to')::time,                   quiet_to),
    quiet_override_urgent   = coalesce((p_werte->>'quiet_override_urgent')::boolean,   quiet_override_urgent),
    hint_dismissed_at       = case
                                when (p_werte->>'hint_dismissed')::boolean is true
                                then coalesce(hint_dismissed_at, now())
                                else hint_dismissed_at end,
    updated_at              = now()
  where profile_id = auth.uid();
end;
$$;

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
             when 'termin_abgesagt'         then p.termin_abgesagt
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
-- 5) Die neuen Texte
-- ----------------------------------------------------------------------------
update public.notification_templates set titel_vorlage = '💸 Neue Strafe: {betrag}',
  text_vorlage = '{grund}, {datum}. Bar, Überweisung oder PayPal.', updated_at = now()
  where kategorie = 'strafe_neu';

update public.notification_templates set titel_vorlage = '✅ Zahlung bestätigt',
  text_vorlage = '{anzahl} Strafen, {betrag} verbucht.', updated_at = now()
  where kategorie = 'zahlung_bestaetigt';

update public.notification_templates set titel_vorlage = '⚠️ Zahlung nicht bestätigt',
  text_vorlage = '{betrag}: {grund}. Bitte mit dem Kassenwart klären.', updated_at = now()
  where kategorie = 'zahlung_abgelehnt';

update public.notification_templates set titel_vorlage = '💰 {anzahl} Zahlungen zu prüfen',
  text_vorlage = '{namen}, {betrag}. Jetzt bestätigen.', updated_at = now()
  where kategorie = 'zahlung_gemeldet';

update public.notification_templates set titel_vorlage = '🚨 {anzahl} kurzfristige Absagen',
  text_vorlage = '{termin_titel} {datum} {uhrzeit}: {namen}', updated_at = now()
  where kategorie = 'absage_kurzfristig';

-- termin_geaendert deckt ab jetzt NUR Zeit- und Ortsaenderungen ab.
update public.notification_templates set titel_vorlage = '📅 {termin_titel} geändert',
  text_vorlage = '{datum}: {aenderung}',
  ausloeser_beschreibung = 'Zeit oder Ort eines Termins ändert sich. Der Ausfall hat eine eigene Kategorie.',
  updated_at = now()
  where kategorie = 'termin_geaendert';

update public.notification_templates set titel_vorlage = '📅 {anzahl} neue Termine',
  text_vorlage = '{liste}. Jetzt zu- oder absagen.', updated_at = now()
  where kategorie = 'termin_neu';

-- ABWEICHUNG 1: Datum und Uhrzeit im Text ergaenzt. Der Entwurf nannte nur den
-- Meldeschluss - dann weiss der Spieler, bis wann er antworten muss, aber
-- nicht, wann gespielt wird. Beides passt bequem (80 von 110 Zeichen).
update public.notification_templates set titel_vorlage = '⏳ Bist du dabei? {termin_titel}',
  text_vorlage = '{datum} {uhrzeit} · Meldeschluss {meldeschluss}. Ohne Antwort wird''s teuer.',
  updated_at = now()
  where kategorie = 'rueckmeldung_erinnerung';

-- ABWEICHUNG 2: desgleichen. Ohne Datum weiss der Trainer nicht, welcher der
-- kommenden Termine unterbesetzt ist, wenn zwei gegen denselben Gegner laufen.
update public.notification_templates set titel_vorlage = '🚨 Zu wenig Leute: {termin_titel}',
  text_vorlage = '{datum} {uhrzeit}: {zusagen} von {minimum}, {offen} offen. Nachhaken!',
  updated_at = now()
  where kategorie = 'unterbesetzung';

-- ABWEICHUNG 3, erzwungen: der Titel aus dem Entwurf misst mit einem langen
-- Gegnernamen 41 Zeichen und wird auf dem Sperrbildschirm abgeschnitten.
-- Die Uhrzeit wandert in den Text, wo sie vor den Zahlen gut steht.
update public.notification_templates set titel_vorlage = '📋 {termin_titel} {datum}',
  text_vorlage = '{uhrzeit} · ✅ {zusagen} · ❌ {absagen} · ❓ {offen}',
  beispiel_daten = '{"termin_titel":"VfB Sparta München","datum":"20.09.","uhrzeit":"12:30 Uhr","zusagen":"12","absagen":"3","offen":"4","termin_id":"beispiel"}',
  updated_at = now()
  where kategorie = 'meldeschluss_uebersicht';

update public.notification_templates set titel_vorlage = '💸 Offene Strafen: {betrag}',
  text_vorlage = '{anzahl} Strafen, älteste vom {datum}.', updated_at = now()
  where kategorie = 'strafen_offen';

update public.notification_templates set titel_vorlage = '🔔 Testnachricht',
  text_vorlage = 'Benachrichtigungen funktionieren ✅', updated_at = now()
  where kategorie = 'test';

-- Die neue Kategorie. {grund} ist optional: ein Termin faellt manchmal
-- einfach aus, und dann soll kein leerer Satz dastehen.
insert into public.notification_templates
  (kategorie, titel_vorlage, text_vorlage, deep_link_vorlage, urgency,
   ttl_regel, ttl_sekunden, platzhalter, platzhalter_optional, beispiel_daten,
   empfaenger_beschreibung, ausloeser_beschreibung)
values
  ('termin_abgesagt',
   '❌ {termin_titel} fällt aus',
   '{datum} {uhrzeit}. {grund}',
   '#ansicht=kalender', 'high',
   'bis_zeitpunkt', 86400,
   array['termin_titel','datum','uhrzeit','grund','termin_id'],
   array['grund'],
   '{"termin_titel":"VfB Sparta München","datum":"20.09.2026","uhrzeit":"12:30 Uhr","grund":"Platz gesperrt.","termin_id":"beispiel"}',
   'Alle Spieler.',
   'Ein Termin wird abgesagt. Zeit- und Ortsänderungen laufen über termin_geaendert.')
on conflict (kategorie) do nothing;

-- ----------------------------------------------------------------------------
-- 6) Gegenprobe
-- ----------------------------------------------------------------------------
-- Gezaehlt wird ohne Variantenselektor (U+FE0F) und ohne Zero-Width-Joiner,
-- damit ein Emoji als EIN Zeichen zaehlt - so wie es auf dem Bildschirm auch
-- eines ist. Postgres length() zaehlt sonst Codepunkte.
do $$
declare
  t public.notification_templates%rowtype;
  v_titel text; v_text text; v_link text;
  v_ohne  text;
  v_fehler integer := 0;
  v_lang   integer := 0;
  v_n      integer := 0;
begin
  for t in select * from public.notification_templates order by kategorie loop
    begin
      v_titel := public.render_vorlage(t.titel_vorlage,     t.beispiel_daten, t.platzhalter, t.platzhalter_optional);
      v_text  := public.render_vorlage(t.text_vorlage,      t.beispiel_daten, t.platzhalter, t.platzhalter_optional);
      v_link  := public.render_vorlage(t.deep_link_vorlage, t.beispiel_daten, t.platzhalter, t.platzhalter_optional);
    exception when others then
      raise warning 'Kategorie %: %', t.kategorie, sqlerrm;
      v_fehler := v_fehler + 1;
      continue;
    end;
    v_n := v_n + 1;

    if length(replace(replace(v_titel, E'️', ''), E'‍', '')) > 40 then
      raise warning 'Kategorie %: Titel zu lang (%): %', t.kategorie,
        length(replace(replace(v_titel, E'️',''), E'‍','')), v_titel;
      v_lang := v_lang + 1;
    end if;
    if length(replace(replace(v_text, E'️', ''), E'‍', '')) > 110 then
      raise warning 'Kategorie %: Text zu lang (%)', t.kategorie,
        length(replace(replace(v_text, E'️',''), E'‍',''));
      v_lang := v_lang + 1;
    end if;
  end loop;

  -- Der optionale Grund muss auch OHNE Wert sauber rendern.
  -- Alias bewusst NICHT t: die Schleifenvariable oben heisst schon so, und
  -- plpgsql kann dann nicht entscheiden, ob t.text_vorlage die Variable oder
  -- die Tabellenspalte meint (42702).
  select public.render_vorlage(tpl.text_vorlage, tpl.beispiel_daten - 'grund',
                               tpl.platzhalter, tpl.platzhalter_optional)
    into v_ohne
    from public.notification_templates tpl where tpl.kategorie = 'termin_abgesagt';

  if v_ohne is null or v_ohne <> '20.09.2026 12:30 Uhr.' then
    raise exception 'termin_abgesagt ohne Grund ergibt "%" statt "20.09.2026 12:30 Uhr." - Migration abgebrochen.', v_ohne;
  end if;

  if v_fehler > 0 then
    raise exception 'Katalog: % Vorlagen rendern nicht - Migration abgebrochen.', v_fehler;
  end if;

  raise notice 'Katalog: % Vorlagen rendern sauber, % ueber der Laengengrenze. Ohne Grund: "%"',
    v_n, v_lang, v_ohne;
end;
$$;
