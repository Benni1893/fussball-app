/* ===========================================================================
   FC Fasanerie-Nord – Datenzugriff (window.DB)

   Kapselt alle Supabase-Zugriffe. Lädt die Daten in genau die Form, die die
   App vorher aus data.js kannte (deutsche Feldnamen) – so bleibt die UI-Logik
   unverändert. Schreibzugriffe (Zu-/Absage, bezahlt) gehen direkt in die DB.

   Benötigt: window.SUPABASE_URL + window.SUPABASE_KEY (aus config.js)
             sowie die Supabase-JS-Bibliothek (per CDN, globales `supabase`).
   =========================================================================== */
window.DB = (function () {
  "use strict";

  const CLUB_SLUG = "fcfn";
  const client = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);

  // Lädt alle Tabellen und formt sie in die bekannte „DEMO"-Struktur um.
  async function loadAll() {
    const [clubs, players, events, katalog, fines, rsvps, lineups] = await Promise.all([
      client.from("clubs").select("*").eq("slug", CLUB_SLUG).limit(1),
      client.from("players").select("*").order("number", { ascending: true }),
      client.from("events").select("*").order("date", { ascending: true }),
      client.from("fine_catalog").select("*").order("code", { ascending: true }),
      client.from("fines").select("*").order("date", { ascending: true }),
      client.from("rsvps").select("*"),
      client.from("lineups").select("*").order("created_at", { ascending: true }),
    ]);

    for (const res of [clubs, players, events, katalog, fines, rsvps, lineups]) {
      if (res.error) throw res.error;
    }

    const club = (clubs.data && clubs.data[0]) || null;

    return {
      clubId: club ? club.id : null,
      verein: {
        name: club ? club.name : "FC Fasanerie-Nord e.V.",
        team: "1. Herrenmannschaft",
        saison: club ? club.season : "",
        gegruendet: club ? club.founded : null,
      },
      players: players.data.map((p) => ({
        id: p.id, code: p.code, name: p.name, nr: p.number, pos: p.position,
        status: p.status || "fit", statusNote: p.status_note,
        statusUntil: p.status_until, statusSince: p.status_since,
      })),
      events: events.data.map((e) => ({
        id: e.id, typ: e.type, titel: e.title, gegner: e.opponent, heim: e.home,
        datum: e.date, zeit: e.time, ort: e.location, note: e.note,
        startsAt: e.starts_at, auto: e.auto_fine,
      })),
      katalog: katalog.data.map((k) => ({
        id: k.id, vergehen: k.offense, betrag: Number(k.amount), kategorie: k.category,
      })),
      strafen: fines.data.map((s) => ({
        id: s.id, playerId: s.player_id, katalogId: s.catalog_id,
        datum: s.date, bezahlt: s.paid, note: s.note,
        selfReported: s.self_reported, paidAt: s.paid_at,
        grundbetrag: s.base_amount != null ? Number(s.base_amount) : null,
        zuschlag: Number(s.surcharge) || 0,
        zuschlagAt: s.surcharge_updated_at,
        createdAt: s.created_at,
        eventId: s.event_id, auto: s.auto,
      })),
      rsvps: rsvps.data.map((r) => ({
        eventId: r.event_id, playerId: r.player_id, status: r.status, grund: r.reason,
      })),
      lineups: (lineups.data || []).map((l) => ({
        id: l.id, eventId: l.event_id, name: l.name, formation: l.formation,
        slots: l.slots || {}, bank: l.bank || [],
        isActive: l.is_active, isTemplate: l.is_template,
      })),
    };
  }

  /* ---- Aufstellungen (nur Trainer/Admin, per RLS) ------------------------ */
  async function saveLineup(lu) {
    const row = {
      club_id: lu.clubId, event_id: lu.eventId || null,
      name: lu.name, formation: lu.formation,
      slots: lu.slots || {}, bank: lu.bank || [],
      is_template: !!lu.isTemplate, updated_at: new Date().toISOString(),
    };
    let res;
    if (lu.id) res = await client.from("lineups").update(row).eq("id", lu.id).select().single();
    else       res = await client.from("lineups").insert(row).select().single();
    if (res.error) throw res.error;
    return res.data;
  }
  async function deleteLineup(id) {
    const { error } = await client.from("lineups").delete().eq("id", id);
    if (error) throw error;
  }
  async function setLineupActive(id) {
    const { error } = await client.rpc("set_lineup_active", { p_id: id });
    if (error) throw error;
  }

  // Zu-/Absage setzen (legt an oder aktualisiert – eindeutig je event+player).
  async function setRsvp(clubId, eventId, playerId, status, reason) {
    const { error } = await client.from("rsvps").upsert(
      {
        club_id: clubId, event_id: eventId, player_id: playerId,
        status: status, reason: reason || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "event_id,player_id" }
    );
    if (error) throw error;
  }

  // Rückmeldung zurücknehmen.
  async function deleteRsvp(eventId, playerId) {
    const { error } = await client
      .from("rsvps").delete()
      .eq("event_id", eventId).eq("player_id", playerId);
    if (error) throw error;
  }

  // Strafe löschen (treasurer/admin generell; coach für Auto-Strafen). RLS erzwingt.
  async function deleteFine(fineId) {
    const { error } = await client.from("fines").delete().eq("id", fineId);
    if (error) throw error;
  }

  // Strafe als bezahlt/offen markieren (Kassenwart/Admin). Beim Zurücksetzen
  // werden Selbstmeldungs-Felder mit geleert.
  async function setFinePaid(fineId, paid) {
    const patch = paid
      ? { paid: true, self_reported: false, paid_at: new Date().toISOString() }
      : { paid: false, self_reported: false, paid_at: null, paid_by: null };
    const { error } = await client.from("fines").update(patch).eq("id", fineId);
    if (error) throw error;
  }

  // Spieler meldet seine eigene Zahlung (setzt eigene offene Strafen auf bezahlt).
  async function reportMyPayment() {
    const { data, error } = await client.rpc("report_my_payment");
    if (error) throw error;
    return data; // Anzahl betroffener Strafen
  }

  /* ---- Authentifizierung & Profil ---------------------------------------- */

  // Aktuelle Sitzung (oder null, wenn nicht eingeloggt).
  async function getSession() {
    const { data } = await client.auth.getSession();
    return data.session;
  }

  // Anmelden mit E-Mail + Passwort.
  async function signIn(email, password) {
    const { data, error } = await client.auth.signInWithPassword({ email: email, password: password });
    if (error) throw error;
    return data;
  }

  // Registrieren mit E-Mail + Passwort (Profil wird per DB-Trigger angelegt).
  async function signUp(email, password) {
    const { data, error } = await client.auth.signUp({ email: email, password: password });
    if (error) throw error;
    return data;
  }

  async function signOut() {
    const { error } = await client.auth.signOut();
    if (error) throw error;
  }

  // Eigenes Profil laden (Rolle + verknüpfter Spieler). null, falls noch keins.
  async function loadProfile(userId) {
    const { data, error } = await client.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (error) throw error;
    return data;
  }

  // Fitness-/Verletztenstatus setzen (nur Trainer/Admin; RLS in der Funktion).
  async function setPlayerStatus(playerId, status, note, until) {
    const { error } = await client.rpc("set_player_status", {
      p_player_id: playerId, p_status: status,
      p_note: note || null, p_until: until || null,
    });
    if (error) throw error;
  }

  // „Welcher Spieler bin ich?" sicher setzen (über DB-Funktion).
  async function setMyPlayer(playerId) {
    const { error } = await client.rpc("set_my_player", { p_player_id: playerId });
    if (error) throw error;
  }

  // Passwort-Reset anstoßen: schickt eine E-Mail mit Wiederherstellungs-Link.
  // redirectTo = aktuelle Seite (muss in Supabase unter "Redirect URLs" erlaubt sein).
  async function resetPassword(email) {
    const redirectTo = window.location.href.split("#")[0];
    const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: redirectTo });
    if (error) throw error;
  }

  // Neues Passwort setzen (nur in der Wiederherstellungs-Sitzung möglich).
  async function updatePassword(newPassword) {
    const { error } = await client.auth.updateUser({ password: newPassword });
    if (error) throw error;
  }

  // Ruft cb auf, wenn die App über einen Passwort-Reset-Link geöffnet wurde.
  function onPasswordRecovery(cb) {
    client.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") cb();
    });
  }

  // Rollen des eingeloggten Nutzers (Array, z. B. ["player","treasurer"]).
  async function myRoles() {
    const { data, error } = await client.rpc("my_roles");
    if (error) throw error;
    return data || [];
  }

  /* ---- Admin: Mitglieder & Rollenverwaltung (nur fuer Admin lesbar/schreibbar) */
  async function listMembers() {
    const [profs, roles] = await Promise.all([
      client.from("profiles").select("id, email, player_id"),
      client.from("user_roles").select("user_id, role"),
    ]);
    if (profs.error) throw profs.error;
    if (roles.error) throw roles.error;
    const byUser = {};
    roles.data.forEach((r) => { (byUser[r.user_id] = byUser[r.user_id] || []).push(r.role); });
    return profs.data.map((p) => ({
      userId: p.id, email: p.email, playerId: p.player_id, roles: byUser[p.id] || [],
    }));
  }

  async function grantRole(userId, role, clubId) {
    const { error } = await client.from("user_roles")
      .insert({ user_id: userId, role: role, club_id: clubId });
    if (error) throw error;
  }

  async function revokeRole(userId, role) {
    const { error } = await client.from("user_roles")
      .delete().eq("user_id", userId).eq("role", role);
    if (error) throw error;
  }

  return {
    client, loadAll, setRsvp, deleteRsvp, setFinePaid, deleteFine,
    saveLineup, deleteLineup, setLineupActive,
    getSession, signIn, signUp, signOut, loadProfile, setMyPlayer, setPlayerStatus,
    resetPassword, updatePassword, onPasswordRecovery, myRoles,
    listMembers, grantRole, revokeRole, reportMyPayment,
  };
})();
