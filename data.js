/* ===========================================================================
   FC Fasanerie-Nord e.V. – Mannschafts-App
   Demo-Datensatz (rein lokal, dient nur zur Veranschaulichung)
   =========================================================================== */

window.DEMO = {

  /* --- Verein -------------------------------------------------------------- */
  verein: {
    name: "FC Fasanerie-Nord e.V.",
    gegruendet: 1977,
    team: "1. Herrenmannschaft",
    saison: "Saison 2025/26",
  },

  /* --- Kader --------------------------------------------------------------- */
  // pos: TW (Torwart), AV (Außenverteidiger), IV (Innenverteidiger),
  //      ZM (zentrales Mittelfeld), OM (offensives Mittelfeld), ST (Stürmer)
  players: [
    { id: "p01", name: "Tobias Wagner",   nr: 1,  pos: "TW" },
    { id: "p02", name: "Jan Krüger",      nr: 2,  pos: "AV" },
    { id: "p03", name: "Paul Neumann",    nr: 3,  pos: "AV" },
    { id: "p04", name: "Max Bauer",       nr: 4,  pos: "IV" },
    { id: "p05", name: "Leon Schmidt",    nr: 5,  pos: "IV" },
    { id: "p06", name: "Jonas Becker",    nr: 6,  pos: "ZM" },
    { id: "p07", name: "Felix Hofmann",   nr: 7,  pos: "OM" },
    { id: "p08", name: "David Wolf",      nr: 8,  pos: "ZM" },
    { id: "p09", name: "Niklas Fischer",  nr: 9,  pos: "ST" },
    { id: "p10", name: "Lukas Weber",     nr: 10, pos: "OM" },
    { id: "p11", name: "Tim Richter",     nr: 11, pos: "ST" },
    { id: "p14", name: "Moritz Schäfer",  nr: 14, pos: "ZM" },
    { id: "p16", name: "Simon Lang",      nr: 16, pos: "AV" },
    { id: "p17", name: "Florian Huber",   nr: 17, pos: "OM" },
    { id: "p19", name: "Daniel Koch",     nr: 19, pos: "ST" },
    { id: "p21", name: "Sebastian Maier", nr: 21, pos: "TW" },
  ],

  /* --- Termine (Kalender) -------------------------------------------------- */
  // typ: "spiel" | "training" | "event"
  // Heutiges Datum im Demo-Kontext: 05.06.2026
  events: [
    { id: "e01", typ: "training", titel: "Abschlusstraining",            datum: "2026-06-04", zeit: "19:00", ort: "Sportgelände Fasanerie, Platz 2", note: "Standards & Spielformen" },
    { id: "e02", typ: "spiel",    titel: "Heimspiel",   gegner: "SV Lochhausen",   heim: true,  datum: "2026-06-07", zeit: "15:00", ort: "Sportgelände Fasanerie, Hauptplatz", note: "Treffen 13:30 Uhr am Platz" },
    { id: "e03", typ: "training", titel: "Mannschaftstraining",          datum: "2026-06-09", zeit: "19:00", ort: "Sportgelände Fasanerie, Platz 2" },
    { id: "e04", typ: "training", titel: "Mannschaftstraining",          datum: "2026-06-11", zeit: "19:00", ort: "Sportgelände Fasanerie, Platz 2" },
    { id: "e05", typ: "spiel",    titel: "Auswärtsspiel", gegner: "TSV Allach",     heim: false, datum: "2026-06-13", zeit: "14:00", ort: "Bezirkssportanlage Allach", note: "Fahrgemeinschaften ab Vereinsheim 12:15 Uhr" },
    { id: "e06", typ: "training", titel: "Mannschaftstraining",          datum: "2026-06-16", zeit: "19:00", ort: "Sportgelände Fasanerie, Platz 2" },
    { id: "e07", typ: "training", titel: "Mannschaftstraining",          datum: "2026-06-18", zeit: "19:00", ort: "Sportgelände Fasanerie, Platz 2" },
    { id: "e08", typ: "event",    titel: "Sommerfest des Vereins",       datum: "2026-06-19", zeit: "17:00", ort: "Vereinsheim & Festzelt", note: "Mit Familien – Helfer für Grillstand gesucht" },
    { id: "e09", typ: "spiel",    titel: "Heimspiel",   gegner: "FC Phönix München", heim: true, datum: "2026-06-21", zeit: "15:00", ort: "Sportgelände Fasanerie, Hauptplatz", note: "Letztes Heimspiel der Saison" },
    { id: "e10", typ: "event",    titel: "Mannschaftsabend",             datum: "2026-06-25", zeit: "20:00", ort: "Gaststätte Zum Fasan", note: "Saisonabschluss & Ehrungen" },
    { id: "e11", typ: "training", titel: "Mannschaftstraining",          datum: "2026-06-23", zeit: "19:00", ort: "Sportgelände Fasanerie, Platz 2" },
    { id: "e12", typ: "spiel",    titel: "Auswärtsspiel", gegner: "SpVgg Feldmoching", heim: false, datum: "2026-06-28", zeit: "13:00", ort: "Sportplatz Feldmoching", note: "Saisonfinale" },
  ],

  /* --- Voreingestellte Rückmeldungen (Demo) -------------------------------- */
  // status: "zu" (Zusage) | "ab" (Absage)
  // Diese Werte werden beim ersten Start in den lokalen Speicher übernommen.
  rsvpSeed: [
    { eventId: "e02", playerId: "p01", status: "zu" },
    { eventId: "e02", playerId: "p04", status: "zu" },
    { eventId: "e02", playerId: "p06", status: "zu" },
    { eventId: "e02", playerId: "p09", status: "zu" },
    { eventId: "e02", playerId: "p10", status: "zu" },
    { eventId: "e02", playerId: "p11", status: "ab", grund: "Urlaub" },
    { eventId: "e02", playerId: "p17", status: "ab", grund: "Arbeit" },
    { eventId: "e03", playerId: "p01", status: "zu" },
    { eventId: "e03", playerId: "p04", status: "zu" },
    { eventId: "e03", playerId: "p05", status: "ab", grund: "Verletzt" },
    { eventId: "e05", playerId: "p09", status: "ab", grund: "Familienfeier" },
    { eventId: "e05", playerId: "p08", status: "zu" },
  ],

  /* --- Strafenkatalog ------------------------------------------------------ */
  // betrag in Euro
  katalog: [
    { id: "k01", vergehen: "Zu spät zum Training",                betrag: 5,  kategorie: "Pünktlichkeit" },
    { id: "k02", vergehen: "Zu spät zum Spiel / Treffpunkt",      betrag: 10, kategorie: "Pünktlichkeit" },
    { id: "k03", vergehen: "Unentschuldigtes Fehlen (Training)",  betrag: 15, kategorie: "Absagen" },
    { id: "k04", vergehen: "Unentschuldigtes Fehlen (Spiel)",     betrag: 25, kategorie: "Absagen" },
    { id: "k05", vergehen: "Verspätete Absage (< 24 Std.)",       betrag: 8,  kategorie: "Absagen" },
    { id: "k06", vergehen: "Handy klingelt in der Besprechung",   betrag: 5,  kategorie: "Verhalten" },
    { id: "k07", vergehen: "Gelb-Rote Karte (Meckern)",           betrag: 10, kategorie: "Karten" },
    { id: "k08", vergehen: "Rote Karte (unsportlich)",            betrag: 20, kategorie: "Karten" },
    { id: "k09", vergehen: "Trikot / Ausrüstung vergessen",       betrag: 5,  kategorie: "Ausrüstung" },
    { id: "k10", vergehen: "Geburtstag ohne Kuchen / Brezen",     betrag: 15, kategorie: "Tradition" },
    { id: "k11", vergehen: "Duschen mit Socken",                  betrag: 3,  kategorie: "Spaß" },
    { id: "k12", vergehen: "Elfmeter im Spiel verschossen",       betrag: 5,  kategorie: "Spiel" },
    { id: "k13", vergehen: "Falscher Torjubel / Eigenlob",        betrag: 3,  kategorie: "Spaß" },
    { id: "k14", vergehen: "Vergessene Zahlung Mannschaftskasse", betrag: 10, kategorie: "Kasse" },
  ],

  /* --- Verhängte Strafen --------------------------------------------------- */
  // bezahlt: true | false
  strafen: [
    { id: "s01", playerId: "p11", katalogId: "k02", datum: "2026-05-10", bezahlt: false, note: "15 Min zu spät" },
    { id: "s02", playerId: "p07", katalogId: "k07", datum: "2026-05-10", bezahlt: false },
    { id: "s03", playerId: "p04", katalogId: "k01", datum: "2026-05-12", bezahlt: true  },
    { id: "s04", playerId: "p10", katalogId: "k10", datum: "2026-05-15", bezahlt: false, note: "Geburtstag vergessen" },
    { id: "s05", playerId: "p06", katalogId: "k09", datum: "2026-05-19", bezahlt: true  },
    { id: "s06", playerId: "p09", katalogId: "k12", datum: "2026-05-24", bezahlt: false, note: "Strafstoß über das Tor" },
    { id: "s07", playerId: "p11", katalogId: "k11", datum: "2026-05-24", bezahlt: true  },
    { id: "s08", playerId: "p17", katalogId: "k03", datum: "2026-05-26", bezahlt: false },
    { id: "s09", playerId: "p08", katalogId: "k06", datum: "2026-05-28", bezahlt: true  },
    { id: "s10", playerId: "p05", katalogId: "k01", datum: "2026-05-30", bezahlt: false, note: "Stau auf der A99" },
    { id: "s11", playerId: "p19", katalogId: "k08", datum: "2026-06-01", bezahlt: false, note: "Notbremse" },
    { id: "s12", playerId: "p07", katalogId: "k13", datum: "2026-06-02", bezahlt: false },
    { id: "s13", playerId: "p04", katalogId: "k14", datum: "2026-06-03", bezahlt: true  },
    { id: "s14", playerId: "p10", katalogId: "k01", datum: "2026-06-04", bezahlt: false },
    { id: "s15", playerId: "p16", katalogId: "k09", datum: "2026-06-04", bezahlt: true  },
  ],

  /* --- Demo-„aktueller Nutzer" -------------------------------------------- */
  currentPlayerId: "p10", // Lukas Weber
};
