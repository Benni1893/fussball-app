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
    const [clubs, players, events, katalog, fines, rsvps] = await Promise.all([
      client.from("clubs").select("*").eq("slug", CLUB_SLUG).limit(1),
      client.from("players").select("*").order("number", { ascending: true }),
      client.from("events").select("*").order("date", { ascending: true }),
      client.from("fine_catalog").select("*").order("code", { ascending: true }),
      client.from("fines").select("*").order("date", { ascending: true }),
      client.from("rsvps").select("*"),
    ]);

    for (const res of [clubs, players, events, katalog, fines, rsvps]) {
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
      })),
      events: events.data.map((e) => ({
        id: e.id, typ: e.type, titel: e.title, gegner: e.opponent, heim: e.home,
        datum: e.date, zeit: e.time, ort: e.location, note: e.note,
      })),
      katalog: katalog.data.map((k) => ({
        id: k.id, vergehen: k.offense, betrag: Number(k.amount), kategorie: k.category,
      })),
      strafen: fines.data.map((s) => ({
        id: s.id, playerId: s.player_id, katalogId: s.catalog_id,
        datum: s.date, bezahlt: s.paid, note: s.note,
      })),
      rsvps: rsvps.data.map((r) => ({
        eventId: r.event_id, playerId: r.player_id, status: r.status, grund: r.reason,
      })),
    };
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

  // Strafe als bezahlt/offen markieren.
  async function setFinePaid(fineId, paid) {
    const { error } = await client.from("fines").update({ paid: paid }).eq("id", fineId);
    if (error) throw error;
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

  return {
    client, loadAll, setRsvp, deleteRsvp, setFinePaid,
    getSession, signIn, signUp, signOut, loadProfile, setMyPlayer,
    resetPassword, updatePassword, onPasswordRecovery,
  };
})();
