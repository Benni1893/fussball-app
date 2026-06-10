-- ============================================================================
-- FC Fasanerie-Nord - Migration 0003: Zugriff absichern
--
-- Ersetzt die offenen Demo-Regeln aus 0001:
--   * Lesen NUR fuer eingeloggte Nutzer (kein anonymer Zugriff mehr).
--   * Schreiben rollenbasiert (Spieler nur eigene Zu-/Absagen;
--     Kassenwart/Admin duerfen Strafen auf bezahlt setzen).
--
-- Voraussetzung: 0001 + 0002 wurden ausgefuehrt. Die App-Anpassung
-- (Bezahlt-Button nur fuer Kassenwart/Admin) ist bereits committet.
--
-- Ausfuehren: Supabase Dashboard -> SQL Editor -> einfuegen -> "Run".
-- ============================================================================

-- Hilfsfunktion: verknuepfter Spieler des aktuell eingeloggten Nutzers.
create or replace function public.my_player_id()
returns uuid
language sql security definer set search_path = public stable
as $$ select player_id from public.profiles where id = auth.uid(); $$;

grant execute on function public.my_player_id() to authenticated;

-- ----------------------------------------------------------------------------
-- Anonymen Zugriff vollstaendig entziehen
-- ----------------------------------------------------------------------------
revoke select on clubs, players, events, fine_catalog, fines, rsvps from anon;
revoke insert, update, delete on rsvps from anon;
revoke update on fines from anon;

-- ----------------------------------------------------------------------------
-- Lesen: nur eingeloggt (authenticated)
-- ----------------------------------------------------------------------------
drop policy if exists read_clubs        on clubs;
create policy read_clubs        on clubs        for select to authenticated using (true);
drop policy if exists read_players      on players;
create policy read_players      on players      for select to authenticated using (true);
drop policy if exists read_events       on events;
create policy read_events       on events       for select to authenticated using (true);
drop policy if exists read_fine_catalog on fine_catalog;
create policy read_fine_catalog on fine_catalog for select to authenticated using (true);
drop policy if exists read_fines        on fines;
create policy read_fines        on fines        for select to authenticated using (true);
drop policy if exists read_rsvps        on rsvps;
create policy read_rsvps        on rsvps        for select to authenticated using (true);

-- ----------------------------------------------------------------------------
-- Zu-/Absagen: Spieler nur eigene; Trainer/Admin alle
-- ----------------------------------------------------------------------------
drop policy if exists write_rsvps_ins on rsvps;
drop policy if exists write_rsvps_upd on rsvps;
drop policy if exists write_rsvps_del on rsvps;

create policy rsvps_ins on rsvps for insert to authenticated
  with check (player_id = public.my_player_id() or public.my_role() in ('coach','admin'));

create policy rsvps_upd on rsvps for update to authenticated
  using      (player_id = public.my_player_id() or public.my_role() in ('coach','admin'))
  with check (player_id = public.my_player_id() or public.my_role() in ('coach','admin'));

create policy rsvps_del on rsvps for delete to authenticated
  using      (player_id = public.my_player_id() or public.my_role() in ('coach','admin'));

-- ----------------------------------------------------------------------------
-- Strafen auf bezahlt setzen: nur Kassenwart/Admin
-- ----------------------------------------------------------------------------
drop policy if exists write_fines_upd on fines;
create policy fines_upd on fines for update to authenticated
  using      (public.my_role() in ('treasurer','admin'))
  with check (public.my_role() in ('treasurer','admin'));

-- Fertig. Die App land ohne Login keine Daten mehr - genau so soll es sein.
