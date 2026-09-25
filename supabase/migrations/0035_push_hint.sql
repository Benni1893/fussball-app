-- ============================================================================
-- FC Fasanerie-Nord - Migration 0035: Hinweis auf Benachrichtigungen
--
-- Nachtrag zu 0034. Dort fehlte die Spalte fuer den einmaligen, wegklickbaren
-- Hinweis, dass es Benachrichtigungen gibt. Er gehoert an dieselbe Stelle wie
-- der Kalender-Hinweis aus 0032: serverseitig ans Profil, nicht in den
-- localStorage - sonst taucht er auf jedem neuen Geraet wieder auf.
--
-- Die Spalte sitzt in notification_prefs, nicht in profiles: sie gehoert
-- thematisch dorthin, und notification_prefs hat mit set_notification_prefs
-- bereits einen Schreibweg mit auth.uid()-Pruefung.
-- ============================================================================

alter table public.notification_prefs
  add column if not exists hint_dismissed_at timestamptz;

comment on column public.notification_prefs.hint_dismissed_at is
  'Hinweis "Benachrichtigungen verfuegbar" weggetippt oder erledigt. null = noch zeigen.';

-- set_notification_prefs um das eine Feld erweitern. Wortgleich zu 0034,
-- nur die letzte Zuweisung ist neu. Monoton wie beim Kalender-Hinweis:
-- einmal gesetzt bleibt gesetzt, ein wiederholter Versuch verschiebt nichts.
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
