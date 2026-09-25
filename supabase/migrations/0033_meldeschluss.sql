-- ============================================================================
-- FC Fasanerie-Nord - Migration 0033: Meldeschluss als EINE Quelle der Wahrheit
--
-- Ausgangslage: Die Regel "Spiel 24 h, Training 3 h vor Anpfiff" stand an
-- FUENF Stellen ausgeschrieben - viermal in SQL (0008 Zeile 80, 0009 Zeile 40,
-- 0010 Zeile 34 und 92) und einmal im Frontend (app.js, meldeschlussMs). An
-- dieser Frist haengt Geld: 8 EUR verspaetete Rueckmeldung, 15/25 EUR keine
-- Rueckmeldung. Laufen die Kopien auseinander, erinnert die App nach der einen
-- Regel und bestraft nach der anderen.
--
-- Diese Migration aendert das VERHALTEN NICHT. Spiel bleibt 24 h, Training
-- bleibt 3 h. Sie macht nur aus fuenf Kopien eine Quelle:
--
--   team_settings.deadline_spiel_hours / _training_hours   Standard je Verein
--   events.deadline_override_hours                         Ausnahme je Termin
--   events.deadline_at                                     das Ergebnis, per
--                                                          Trigger gepflegt
--
-- Ab hier liest ALLES deadline_at: apply_event_fines, der Sofort-Trigger auf
-- rsvps, das Frontend und die kuenftigen Erinnerungen. Gerechnet wird nur noch
-- in compute_deadline().
--
-- Zu den uebrigen Termintypen (sonstiges usw.): Die alte Regel las sich so,
-- als bekaemen sie ueber das else 3 Stunden. Das war nie wirksam - in ALLEN
-- vier SQL-Kopien steht der Typfilter VOR der Fristberechnung:
--   0008 Zeile 73  where type in ('spiel','training')
--   0009 Zeile 34  if e.type not in ('spiel','training') then return
--   0010 Zeile 27  where type in ('spiel','training')
--   0010 Zeile 86  if e.type not in ('spiel','training') then return
-- Der else-Zweig war fuer alles ausser 'training' toter Code, und das
-- Frontend gibt fuer diese Typen ohnehin seit jeher null zurueck (app.js,
-- meldeschlussMs, erste Zeile). compute_deadline liefert deshalb null - das
-- ist keine Verhaltensaenderung, sondern dieselbe Wirkung ohne die
-- irrefuehrende Rechnung. Die Gegenprobe unten vergleicht folgerichtig nur
-- die Typen, die die alte Logik tatsaechlich bestraft hat.
--
-- Bewusst NICHT enthalten: eine Schreibfunktion fuer team_settings. Es gibt
-- noch keine Oberflaeche dafuer; sie kommt zusammen mit der Einstellungsansicht.
-- Bis dahin gelten die Vorgabewerte, also genau der heutige Stand.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Teameinstellungen
-- ----------------------------------------------------------------------------
create table if not exists public.team_settings (
  club_id                 uuid primary key references public.clubs(id) on delete cascade,
  deadline_spiel_hours    integer not null default 24 check (deadline_spiel_hours    between 0 and 336),
  deadline_training_hours integer not null default 3  check (deadline_training_hours between 0 and 336),
  updated_at              timestamptz not null default now()
);

comment on table  public.team_settings is 'Vorgaben je Verein. Aktuell nur der Meldeschluss.';
comment on column public.team_settings.deadline_spiel_hours    is 'Stunden vor Anpfiff, Standard 24.';
comment on column public.team_settings.deadline_training_hours is 'Stunden vor Beginn, Standard 3.';

-- Je bestehendem Verein eine Zeile mit den heutigen Werten.
insert into public.team_settings (club_id)
select c.id from public.clubs c
on conflict (club_id) do nothing;

alter table public.team_settings enable row level security;

-- Lesen: jeder Eingeloggte (das Frontend zeigt die Frist an).
-- Schreiben: keine Policy - Aenderungen laufen spaeter ueber eine
-- SECURITY-DEFINER-Funktion mit Rollenpruefung, wie im Projekt ueblich.
drop policy if exists team_settings_sel on public.team_settings;
create policy team_settings_sel on public.team_settings
  for select to authenticated using (true);

-- ----------------------------------------------------------------------------
-- 2) Ausnahme je Termin
-- ----------------------------------------------------------------------------
alter table public.events add column if not exists deadline_override_hours integer;
alter table public.events drop constraint if exists events_deadline_override_chk;
alter table public.events add  constraint events_deadline_override_chk
  check (deadline_override_hours is null or deadline_override_hours between 0 and 336);

comment on column public.events.deadline_override_hours is
  'Weicht dieser Termin vom Vereinsstandard ab? null = Standard.';

-- ----------------------------------------------------------------------------
-- 3) Das Ergebnis: eine Spalte, die alle lesen
-- ----------------------------------------------------------------------------
alter table public.events add column if not exists deadline_at timestamptz;

comment on column public.events.deadline_at is
  'Meldeschluss, per Trigger aus compute_deadline gepflegt. NICHT von Hand setzen.';

-- Die einzige Stelle, an der die Frist gerechnet wird.
-- security definer, weil der Trigger team_settings unabhaengig von der RLS
-- des Schreibenden lesen koennen muss.
create or replace function public.compute_deadline(
  p_club uuid, p_type text, p_starts_at timestamptz, p_override integer
)
returns timestamptz
language sql stable security definer set search_path = public
as $$
  select case
    -- Nur Spiele und Trainings kennen einen Meldeschluss. Alle vier alten
    -- SQL-Kopien filtern vor der Rechnung auf diese beiden Typen, das
    -- Frontend ebenso - fuer alles andere gab es nie eine wirksame Frist.
    when p_type not in ('spiel','training') then null
    when p_starts_at is null                then null      -- ganztaegig: kein Meldeschluss
    else p_starts_at - (
      coalesce(
        p_override,
        (select case when p_type = 'spiel' then s.deadline_spiel_hours
                     else s.deadline_training_hours end
           from public.team_settings s where s.club_id = p_club),
        -- Notnagel, falls ein Verein keine Zeile hat: die bisherigen Werte.
        case when p_type = 'spiel' then 24 else 3 end
      )::int * interval '1 hour')
  end;
$$;

-- Trigger auf events. ACHTUNG, REIHENFOLGE: Postgres feuert gleichzeitige
-- Trigger in alphabetischer Namensreihenfolge. Diese Berechnung braucht das
-- starts_at, das trg_events_starts_at (0008) im selben BEFORE-Durchgang
-- gerade erst gesetzt hat - deshalb der Name mit z. Wer einen der beiden
-- Trigger umbenennt, muss diese Ordnung wiederherstellen.
create or replace function public.events_set_deadline_at()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.deadline_at := public.compute_deadline(
    new.club_id, new.type, new.starts_at, new.deadline_override_hours);
  return new;
end;
$$;

drop trigger if exists trg_events_zdeadline on public.events;
create trigger trg_events_zdeadline
  before insert or update on public.events
  for each row execute function public.events_set_deadline_at();

-- Die Abhaengigkeit an beiden Objekten hinterlegen, damit sie beim naechsten
-- Lesen auffaellt - auch dem, der nur einen der beiden Trigger vor sich hat.
comment on trigger trg_events_zdeadline on public.events is
  'Setzt deadline_at. Muss NACH trg_events_starts_at feuern (alphabetische Reihenfolge, s < z) - braucht dessen starts_at.';
comment on trigger trg_events_starts_at on public.events is
  'Setzt starts_at aus date+time (Europe/Berlin). Muss VOR trg_events_zdeadline feuern (alphabetische Reihenfolge, s < z).';

-- Aendert ein Verein seine Vorgabe, gelten die neuen Werte fuer die
-- ZUKUENFTIGEN Termine dieses Vereins ohne eigene Ausnahme.
-- Vergangene Termine behalten ihre Frist: apply_event_fines laeuft ueber
-- auto_fined_at, und eine nachtraeglich verschobene Frist koennte dort
-- rueckwirkend anders strafen als zum Zeitpunkt des Termins gegolten hat.
create or replace function public.team_settings_refresh_events()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.events e
     set deadline_at = public.compute_deadline(e.club_id, e.type, e.starts_at, e.deadline_override_hours)
   where e.club_id = new.club_id
     and e.deadline_override_hours is null
     and e.starts_at > now();
  return new;
end;
$$;

drop trigger if exists trg_team_settings_refresh on public.team_settings;
create trigger trg_team_settings_refresh
  after update on public.team_settings
  for each row execute function public.team_settings_refresh_events();

-- Bestandsdaten einmalig fuellen. Ergibt exakt dieselben Werte wie die bisher
-- ausgeschriebene Regel - das ist der Punkt.
update public.events e
   set deadline_at = public.compute_deadline(e.club_id, e.type, e.starts_at, e.deadline_override_hours)
 where e.deadline_at is distinct from
       public.compute_deadline(e.club_id, e.type, e.starts_at, e.deadline_override_hours);

-- ----------------------------------------------------------------------------
-- 4) Die beiden Strafen-Funktionen lesen ab jetzt deadline_at
--    (wortgleich zu 0010, nur die Fristberechnung ist ersetzt)
-- ----------------------------------------------------------------------------
create or replace function public.apply_event_fines()
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_ev       record;
  v_deadline timestamptz;
  v_inserted integer;
  v_count    integer := 0;
begin
  for v_ev in
    select * from public.events
     where type in ('spiel','training')
       and auto_fine = true
       and starts_at is not null
       and starts_at <= now()
       and auto_fined_at is null
  loop
    -- Eine Quelle: die gepflegte Spalte. Der coalesce ist nur ein Gurt fuer
    -- Zeilen, die aus irgendeinem Grund ohne Trigger entstanden sind.
    v_deadline := coalesce(
      v_ev.deadline_at,
      public.compute_deadline(v_ev.club_id, v_ev.type, v_ev.starts_at, v_ev.deadline_override_hours));

    insert into public.fines (club_id, player_id, catalog_id, date, paid, note, event_id, auto, created_at)
    select v_ev.club_id, p.id, k.id, v_ev.date, false,
           'Automatisch: ' || reason.txt || ' zu ' || v_ev.title,
           v_ev.id, true, now()
    from public.players p
    left join public.rsvps r on r.event_id = v_ev.id and r.player_id = p.id
    cross join lateral (
      select
        case
          when r.status is null then case when v_ev.type = 'spiel' then 'k04' else 'k03' end  -- keine Rueckmeldung
          when r.updated_at <= v_deadline then null                                            -- rechtzeitig (zu/ab)
          else 'k05'                                                                            -- verspaetet (zu/ab)
        end as kcode,
        case when r.status is null then 'keine Rückmeldung' else 'verspätete Rückmeldung' end as txt
    ) reason
    join public.fine_catalog k on k.club_id = v_ev.club_id and k.code = reason.kcode
    where p.club_id = v_ev.club_id
      and reason.kcode is not null
    on conflict (event_id, player_id) do nothing;

    get diagnostics v_inserted = row_count;
    v_count := v_count + v_inserted;

    update public.events set auto_fined_at = now() where id = v_ev.id;
  end loop;

  return v_count;
end;
$$;

create or replace function public.rsvp_late_cancel_fine()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  e          record;
  v_deadline timestamptz;
  v_cat      uuid;
  v_eid      uuid;
  v_pid      uuid;
begin
  if tg_op = 'DELETE' then
    v_eid := old.event_id; v_pid := old.player_id;
  else
    v_eid := new.event_id; v_pid := new.player_id;
  end if;

  select * into e from public.events where id = v_eid;
  if e.id is null or e.type not in ('spiel','training')
     or e.auto_fine = false or e.starts_at is null then
    return coalesce(new, old);
  end if;

  v_deadline := coalesce(
    e.deadline_at,
    public.compute_deadline(e.club_id, e.type, e.starts_at, e.deadline_override_hours));

  select id into v_cat from public.fine_catalog where club_id = e.club_id and code = 'k05';
  if v_cat is null then
    return coalesce(new, old);
  end if;

  if tg_op <> 'DELETE' and now() > v_deadline and now() < e.starts_at then
    -- Verspaetete Rueckmeldung (Zusage ODER Absage) -> 8 EUR sofort
    insert into public.fines (club_id, player_id, catalog_id, date, paid, note, event_id, auto, created_at)
    values (e.club_id, v_pid, v_cat, e.date, false,
            'Automatisch: verspätete Rückmeldung zu ' || e.title, v_eid, true, now())
    on conflict (event_id, player_id) do nothing;
  elsif tg_op = 'DELETE' or now() <= v_deadline then
    -- Rechtzeitige Rueckmeldung ODER zurueckgezogen -> offene Auto-Strafe entfernen
    delete from public.fines
     where event_id = v_eid and player_id = v_pid
       and auto = true and paid = false and catalog_id = v_cat;
  end if;
  -- now >= starts_at: nichts tun (Endstand macht der Cron).

  return coalesce(new, old);
end;
$$;

grant execute on function public.compute_deadline(uuid, text, timestamptz, integer) to authenticated;

-- ----------------------------------------------------------------------------
-- 5) Gegenprobe: liefert die neue Spalte fuer jeden bestehenden Termin
--    denselben Wert wie die bisher ausgeschriebene Regel?
--    Verglichen werden nur Spiele und Trainings - die uebrigen Typen hat die
--    alte Logik nie erreicht (Typfilter vor der Rechnung, siehe Kopf), fuer
--    sie gab und gibt es keine Frist.
--    Bricht die Migration ab, wenn auch nur eine Zeile abweicht.
-- ----------------------------------------------------------------------------
do $$
declare v_abweichungen integer;
begin
  select count(*) into v_abweichungen
    from public.events e
   where e.type in ('spiel','training')
     and e.starts_at is not null
     and e.deadline_override_hours is null
     and e.deadline_at is distinct from
         (e.starts_at - (case when e.type = 'spiel' then interval '24 hours' else interval '3 hours' end));

  if v_abweichungen > 0 then
    raise exception 'Meldeschluss weicht bei % Terminen von der alten Regel ab - Migration abgebrochen.', v_abweichungen;
  end if;

  -- Und umgekehrt: kein Termin ausserhalb spiel/training darf eine Frist haben.
  select count(*) into v_abweichungen
    from public.events e
   where e.type not in ('spiel','training')
     and e.deadline_at is not null;

  if v_abweichungen > 0 then
    raise exception 'Meldeschluss bei % Terminen ausserhalb spiel/training gesetzt - Migration abgebrochen.', v_abweichungen;
  end if;

  raise notice 'Meldeschluss: alle bestehenden Termine rechnen unveraendert.';
end;
$$;
