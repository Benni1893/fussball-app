/* Stand-in fuer db.js und Testdaten der App-Landkarte (Paket L, Schritt L1).

   Die echte app.js laeuft unveraendert im Browser. Ausgetauscht wird nur
   db.js: an seine Stelle tritt ein window.DB, das dieselben Methoden hat,
   aber aus den Testdaten unten liest und Schreibaufrufe nur protokolliert.
   Damit rendert die App je Rolle echt (Rollen kommen ueber myRoles, nicht
   ueber die Admin-Simulation) - ohne Konto, ohne Datenbank.

   Regeln (PLAN.md, "Paket L: Vorgaben"):
   - nur erfundene Namen, keine echten Spielerdaten
   - kein einziger Request an *.supabase.co; jeder wird abgebrochen UND als
     Verstoss gezaehlt, ein Verstoss macht den Lauf rot
   - Schreibaufrufe landen nur in window.__dbProtokoll

   Benutzung:
     const ctx  = await neuerKontext(browser);
     const page = await ctx.newPage();
     const lauf = await installiere(page, 'trainer');
     await page.goto(basis);
     ...
     const b = await lauf.bericht();   // { verstoesse, fehler, hinweise, protokoll }
                                                                              */

/* ---- Uhr ---------------------------------------------------------------
   Freitag, 02.10.2026, 18:00 Uhr Berliner Zeit. Das Heimspiel am Sonntag
   liegt in der Zukunft, sein Meldeschluss (Samstag 15:00) laeuft noch -
   der Countdown steht rot, weil weniger als 24 h bleiben. Die Uhr bleibt
   stehen (setFixedTime), damit jedes Bild gleich aussieht.                 */
export const JETZT = '2026-10-02T18:00:00+02:00';

/* ---- Testdaten -----------------------------------------------------------
   Alle Namen sind erfunden. Der Verein heisst "SV Musterhausen", die
   Gegner "TSV Beispielstadt", "FC Probedorf", "SC Testhausen".           */
const SPIELER = [
  ['p01', 'Anton Feldmann',  1, 'TW'],
  ['p02', 'Bruno Kessler',   2, 'AV'],
  ['p03', 'Carl Lindner',    3, 'AV'],
  ['p04', 'David Morawe',    4, 'IV'],
  ['p05', 'Emil Nordhoff',   5, 'IV'],
  ['p06', 'Felix Oberhaus',  6, 'ZM'],
  ['p07', 'Kilian Thamm',    7, 'ZM'],
  ['p08', 'Gregor Pallas',   8, 'ZM'],
  ['p09', 'Ilja Rennert',    9, 'ST'],
  ['p10', 'Hannes Quast',   10, 'OM'],
  ['p11', 'Jakob Sauter',   11, 'ST'],
  ['p12', 'Oskar Zierer',   12, 'TW'],
  ['p13', 'Lars Ulbrich',   13, 'AV'],
  ['p14', 'Moritz Vogler',  14, 'IV'],
  ['p15', 'Niklas Wendt',   17, 'OM'],
  ['p16', 'Paul Ebert',     19, 'ST'],
];
/* Der angemeldete Nutzer ist in jeder Rolle mit diesem Spieler verknuepft. */
export const EIGENER_SPIELER = 'p06';

const STATUS = {
  p05: { status: 'verletzt',     statusNote: 'Knie',       statusSince: '2026-09-18', statusUntil: '2026-10-20' },
  p11: { status: 'angeschlagen', statusNote: 'Wade',       statusSince: '2026-09-30', statusUntil: null },
  p14: { status: 'urlaub',       statusNote: null,         statusSince: '2026-09-28', statusUntil: '2026-10-10' },
};

/* Termin: id, typ, titel, gegner, heim, datum, zeit, ende, ort, Meldeschluss
   (ISO, wie ihn die Datenbank liefert), serie, quelle, status.            */
function termin(id, typ, titel, gegner, heim, datum, zeit, ort, frist, extra) {
  const startsAt = zeit ? new Date(`${datum}T${zeit}:00+02:00`).toISOString() : null;
  return Object.assign({
    id, typ, titel, gegner, heim, datum, zeit, ort, note: null,
    startsAt, auto: true,
    deadlineAt: frist, deadlineOverrideHours: null,
    status: 'geplant', quelle: 'manuell',
    wettbewerb: null, liga: null,
    spielstaette: null, adresse: null, locationRaw: null,
    ende: null, serieId: null, serieGeaendert: false,
    manuellBearbeitet: {}, bfvOriginal: {}, bfvNeu: {},
  }, extra || {});
}
const frist = (iso) => new Date(iso).toISOString();

const TERMINE = [
  // Vergangen: liefern die automatische Strafe und den Verlauf.
  termin('e-sp0', 'spiel', 'SC Testhausen', 'SC Testhausen', false, '2026-09-27', '15:00', 'Sportpark Testhausen',
         frist('2026-09-26T15:00:00+02:00'), { quelle: 'bfv', liga: 'Kreisliga 2', wettbewerb: 'Meisterschaft' }),
  termin('e-tr0', 'training', 'Training', null, null, '2026-09-29', '19:30', 'Sportplatz Musterhausen',
         frist('2026-09-29T16:30:00+02:00'), { serieId: 'serie-di' }),
  // Zukunft: das Spiel mit Aufstellung, Meldeschluss laeuft.
  termin('e-sp1', 'spiel', 'TSV Beispielstadt', 'TSV Beispielstadt', true, '2026-10-04', '15:00', 'Sportplatz Musterhausen',
         frist('2026-10-03T15:00:00+02:00'), { quelle: 'bfv', liga: 'Kreisliga 2', wettbewerb: 'Meisterschaft', ende: '16:45' }),
  termin('e-tr1', 'training', 'Training', null, null, '2026-10-06', '19:30', 'Sportplatz Musterhausen',
         frist('2026-10-06T16:30:00+02:00'), { serieId: 'serie-di' }),
  termin('e-tr2', 'training', 'Training', null, null, '2026-10-08', '19:30', 'Sportplatz Musterhausen',
         frist('2026-10-08T16:30:00+02:00'), { serieId: 'serie-do' }),
  termin('e-sp2', 'spiel', 'FC Probedorf', 'FC Probedorf', false, '2026-10-11', '13:00', 'Waldstadion Probedorf',
         frist('2026-10-10T13:00:00+02:00'), { quelle: 'bfv', liga: 'Kreisliga 2', wettbewerb: 'Meisterschaft' }),
  termin('e-tr3', 'training', 'Training', null, null, '2026-10-13', '19:30', 'Sportplatz Musterhausen',
         frist('2026-10-13T16:30:00+02:00'), { serieId: 'serie-di' }),
  termin('e-tr4', 'training', 'Training', null, null, '2026-10-15', '19:30', 'Sportplatz Musterhausen',
         frist('2026-10-15T16:30:00+02:00'), { serieId: 'serie-do', status: 'abgesagt' }),
  termin('e-so1', 'sonstiges', 'Mannschaftsabend', null, null, '2026-10-17', '19:00', 'Vereinsheim',
         null, { auto: false }),
];

/* Rueckmeldungen. Zum Heimspiel: 9 Zusagen, 2 Absagen, der Rest offen -
   darunter der eigene Spieler, damit Zusage/Absage-Knoepfe und die
   Trainer-Zeile "Ohne Rueckmeldung" sichtbar sind.                        */
const RUECK = [
  ...['p01', 'p02', 'p03', 'p04', 'p07', 'p08', 'p09', 'p10', 'p13'].map((p) => ['e-sp1', p, 'zu', null]),
  ['e-sp1', 'p12', 'ab', 'Hochzeit eines Freundes'],
  ['e-sp1', 'p16', 'ab', 'Arbeit'],
  ...['p01', 'p02', 'p04', 'p06', 'p08', 'p09'].map((p) => ['e-tr1', p, 'zu', null]),
  ['e-tr1', 'p03', 'ab', 'Schicht'],
  ...['p01', 'p02', 'p03', 'p04', 'p06', 'p07', 'p08', 'p09', 'p10', 'p13', 'p15'].map((p) => ['e-sp0', p, 'zu', null]),
  ['e-sp0', 'p16', 'ab', 'krank'],
];

const KATALOG = [
  { id: 'k1', vergehen: 'Verspätete Rückmeldung', betrag: 8,  kategorie: 'Termine',   typ: 'fixed',   einheit: null, proEinheit: null, schritt: null, maxBetrag: null },
  { id: 'k2', vergehen: 'Zu spät zum Training',   betrag: 0,  kategorie: 'Termine',   typ: 'staffel', einheit: 'Minuten', proEinheit: 1, schritt: 5, maxBetrag: 10 },
  { id: 'k3', vergehen: 'Gelbe Karte wegen Meckern', betrag: 10, kategorie: 'Spiel',  typ: 'fixed',   einheit: null, proEinheit: null, schritt: null, maxBetrag: null },
  { id: 'k4', vergehen: 'Handy in der Kabine',    betrag: 5,  kategorie: 'Kabine',    typ: 'fixed',   einheit: null, proEinheit: null, schritt: null, maxBetrag: null },
  { id: 'k5', vergehen: 'Trikot vergessen',       betrag: 3,  kategorie: 'Kabine',    typ: 'fixed',   einheit: null, proEinheit: null, schritt: null, maxBetrag: null },
];

/* Strafen: offen, gemeldet, bestaetigt, storniert. Die eigenen offenen
   Strafen (p06) machen "Zahlung melden" moeglich; die gemeldeten fuellen
   den Kassen-Reiter "Zu pruefen".                                         */
function strafe(id, playerId, katalogId, vergehen, betrag, datum, status, extra) {
  return Object.assign({
    id, playerId, katalogId, datum, bezahlt: status === 'bestätigt', note: null,
    selfReported: status === 'gemeldet', paidAt: status === 'bestätigt' ? `${datum}T20:00:00Z` : null,
    status, batchId: null, zahlart: status === 'bestätigt' ? 'bar' : null, ablehnGrund: null,
    sagtZahlart: null, sagtNote: null, gemeldetAm: null,
    grundbetrag: betrag, zuschlag: 0, zuschlagAt: null,
    createdAt: `${datum}T12:00:00Z`, eventId: null, auto: false, vergehen,
  }, extra || {});
}
const STRAFEN = [
  strafe('f01', 'p06', 'k1', 'Verspätete Rückmeldung', 8, '2026-09-27', 'offen', { eventId: 'e-sp0', auto: true }),
  strafe('f02', 'p06', 'k4', 'Handy in der Kabine', 5, '2026-09-29', 'offen'),
  strafe('f03', 'p06', 'k5', 'Trikot vergessen', 3, '2026-09-13', 'bestätigt', { batchId: 'b-01' }),
  strafe('f04', 'p02', 'k3', 'Gelbe Karte wegen Meckern', 10, '2026-09-27', 'gemeldet',
         { sagtZahlart: 'paypal', sagtNote: 'Gerade überwiesen', gemeldetAm: '2026-10-01T19:12:00Z' }),
  strafe('f05', 'p03', 'k2', 'Zu spät zum Training', 5, '2026-09-29', 'gemeldet',
         { sagtZahlart: 'bar', gemeldetAm: '2026-10-02T09:40:00Z', note: '25 Minuten' }),
  strafe('f06', 'p09', 'k1', 'Verspätete Rückmeldung', 8, '2026-08-30', 'offen',
         { eventId: null, auto: true, zuschlag: 2, zuschlagAt: '2026-09-27T00:00:00Z' }),
  strafe('f07', 'p10', 'k4', 'Handy in der Kabine', 5, '2026-09-20', 'storniert'),
  strafe('f08', 'p12', 'k5', 'Trikot vergessen', 3, '2026-09-13', 'bestätigt', { batchId: 'b-01', zahlart: 'ueberweisung' }),
  strafe('f09', 'p16', 'k1', 'Verspätete Rückmeldung', 8, '2026-09-27', 'offen', { eventId: 'e-sp0', auto: true }),
];

/* Aufstellung zum Heimspiel: 4-4-2, nur Spieler mit Zusage. */
const AUFSTELLUNGEN = [
  { id: 'l-01', eventId: 'e-sp1', name: 'Gegen Beispielstadt', formation: '4-4-2',
    slots: { TW: 'p01', LV: 'p02', LIV: 'p04', RIV: 'p13', RV: 'p03', LM: 'p07', LZM: 'p08', RZM: 'p10', RM: 'p15', LST: 'p09', RST: 'p11' },
    bank: ['p12'], isActive: true, isTemplate: false, updatedAt: '2026-10-02T10:00:00Z' },
  { id: 'l-02', eventId: null, name: 'Grundelf', formation: '4-2-3-1',
    slots: {}, bank: [], isActive: false, isTemplate: true, updatedAt: '2026-09-20T10:00:00Z' },
];

/* Push-Katalog: Texte wie in der Datenbank, Beispieldaten mit erfundenen
   Namen. Daraus entstehen auch die Zeilen von notification_infos().       */
const vorlage = (kategorie, rolle, titel_vorlage, text_vorlage, deep_link_vorlage, urgency, platzhalter, beispiel_daten, empfaenger_beschreibung, ausloeser_beschreibung, platzhalter_optional) => ({
  kategorie, rolle, titel_vorlage, text_vorlage, deep_link_vorlage, urgency,
  ttl_regel: urgency === 'high' ? 'bis_zeitpunkt' : 'fix', ttl_sekunden: 86400,
  platzhalter, beispiel_daten, empfaenger_beschreibung, ausloeser_beschreibung,
  aktiv: true, updated_at: '2026-10-01T21:29:53Z', updated_by: null,
  platzhalter_optional: platzhalter_optional || [],
});
const VORLAGEN = [
  vorlage('absage_kurzfristig', 'coach', '🚨 {anzahl} kurzfristige Absagen', '{termin_titel} {datum} {uhrzeit}: {namen}', '#termin={termin_id}', 'high',
          ['anzahl', 'termin_titel', 'datum', 'uhrzeit', 'namen', 'termin_id'],
          { anzahl: '2', termin_titel: 'Training', datum: '06.10.', uhrzeit: '19:30 Uhr', namen: 'Carl Lindner, Paul Ebert', termin_id: 'beispiel' },
          'Alle Trainer.', 'Absage nach Meldeschluss. Gesammelt über 10 Minuten je Termin.'),
  vorlage('meldeschluss_uebersicht', 'coach', '📋 {termin_titel} {datum}', '{uhrzeit} · ✅ {zusagen} · ❌ {absagen} · ❓ {offen}', '#termin={termin_id}', 'normal',
          ['termin_titel', 'datum', 'uhrzeit', 'zusagen', 'absagen', 'offen', 'termin_id'],
          { termin_titel: 'TSV Beispielstadt', datum: '04.10.', uhrzeit: '15:00 Uhr', zusagen: '9', absagen: '2', offen: '5', termin_id: 'beispiel' },
          'Alle Trainer.', 'Direkt nach Meldeschluss.'),
  vorlage('rueckmeldung_erinnerung', 'spieler', '⏳ Bist du dabei? {termin_titel}', "{datum} {uhrzeit} · Meldeschluss {meldeschluss}. Ohne Antwort wird's teuer.", '#termin={termin_id}', 'high',
          ['termin_titel', 'datum', 'uhrzeit', 'meldeschluss', 'termin_id'],
          { termin_titel: 'TSV Beispielstadt', datum: '04.10.', uhrzeit: '15:00 Uhr', meldeschluss: 'morgen 15:00 Uhr', termin_id: 'beispiel' },
          'Spieler ohne Rückmeldung zu diesem Termin.', '24 Stunden und 2 Stunden vor Meldeschluss.'),
  vorlage('strafe_neu', 'spieler', '💸 Neue Strafe: {betrag}', '{grund}, {datum}. Bar, Überweisung oder PayPal.', '#strafen=meine', 'normal',
          ['betrag', 'grund', 'datum'], { betrag: '8,00 €', grund: 'Verspätete Rückmeldung', datum: '27.09.2026' },
          'Der betroffene Spieler, sonst niemand.', 'Eine Strafe wird verhängt - von Hand oder automatisch zum Anpfiff.'),
  vorlage('strafen_offen', 'spieler', '💸 Offene Strafen: {betrag}', '{anzahl} Strafen, älteste vom {datum}.', '#strafen=meine', 'normal',
          ['betrag', 'anzahl', 'datum'], { betrag: '23,00 €', anzahl: '3', datum: '30.08.2026' },
          'Spieler mit Strafen, die älter als vier Wochen sind.', 'Höchstens einmal im Monat. Standard AUS.'),
  vorlage('termin_abgesagt', 'spieler', '❌ {termin_titel} fällt aus', '{datum} {uhrzeit}. {grund}', '#ansicht=kalender', 'high',
          ['termin_titel', 'datum', 'uhrzeit', 'grund', 'termin_id'],
          { termin_titel: 'Training', datum: '15.10.2026', uhrzeit: '19:30 Uhr', grund: 'Platz gesperrt.', termin_id: 'beispiel' },
          'Alle Spieler.', 'Ein Termin wird abgesagt. Zeit- und Ortsänderungen laufen über „Termin geändert“.', ['grund']),
  vorlage('termin_geaendert', 'spieler', '📅 {termin_titel} geändert', '{datum}: {aenderung}', '#termin={termin_id}', 'high',
          ['termin_titel', 'datum', 'aenderung', 'termin_id'],
          { termin_titel: 'FC Probedorf', datum: '11.10.2026', aenderung: 'Anstoß jetzt 14:00 statt 13:00 Uhr', termin_id: 'beispiel' },
          'Alle Spieler.', 'Zeit oder Ort eines Termins ändert sich. Der Ausfall hat eine eigene Kategorie.'),
  vorlage('termin_neu', 'spieler', '📅 {anzahl} neue Termine', '{liste}. Jetzt zu- oder absagen.', '#ansicht=kalender', 'normal',
          ['anzahl', 'liste'], { anzahl: '3', liste: 'Training 06.10., Training 08.10., FC Probedorf 11.10.' },
          'Alle Spieler.', 'Neue Termine im Kalender. Gesammelt über 30 Minuten je Ersteller.'),
  vorlage('test', null, '🔔 Testnachricht', 'Benachrichtigungen funktionieren ✅', '#ein=mitteilungen', 'normal',
          [], {}, 'Nur der Auslöser selbst.', 'Knopf "Testnachricht senden" in den Einstellungen.'),
  vorlage('unterbesetzung', 'coach', '🚨 Zu wenig Leute: {termin_titel}', '{datum} {uhrzeit}: {zusagen} von {minimum}, {offen} offen. Nachhaken!', '#termin={termin_id}', 'high',
          ['termin_titel', 'datum', 'uhrzeit', 'zusagen', 'minimum', 'offen', 'termin_id'],
          { termin_titel: 'TSV Beispielstadt', datum: '04.10.', uhrzeit: '15:00 Uhr', zusagen: '9', minimum: '11', offen: '5', termin_id: 'beispiel' },
          'Alle Trainer.', 'Vor Meldeschluss unter der Mindestzahl je Termintyp.'),
  vorlage('zahlung_abgelehnt', 'spieler', '⚠️ Zahlung nicht bestätigt', '{betrag}: {grund}. Bitte mit dem Kassenwart klären.', '#strafen=meine', 'normal',
          ['betrag', 'grund'], { betrag: '10,00 €', grund: 'Betrag stimmt nicht überein' },
          'Der Spieler, dessen Zahlung abgelehnt wurde.', 'Der Kassenwart lehnt eine gemeldete Zahlung ab.'),
  vorlage('zahlung_bestaetigt', 'spieler', '✅ Zahlung bestätigt', '{anzahl} Strafen, {betrag} verbucht.', '#strafen=meine', 'normal',
          ['anzahl', 'betrag'], { anzahl: '2', betrag: '13,00 €' },
          'Der Spieler, dessen Zahlung bestätigt wurde.', 'Der Kassenwart bestätigt eine gemeldete Zahlung.'),
  vorlage('zahlung_gemeldet', 'treasurer', '💰 {anzahl} Zahlungen zu prüfen', '{namen}, {betrag}. Jetzt bestätigen.', '#kasse=pruefen', 'normal',
          ['anzahl', 'namen', 'betrag'], { anzahl: '2', namen: 'Bruno Kessler, Carl Lindner', betrag: '15,00 €' },
          'Alle Kassenwarte.', 'Ein Spieler meldet eine Zahlung. Gesammelt über 15 Minuten.'),
];

/* Einstellungen der Mitteilungen: Ruhezeit 22-8 Uhr, fast alles an. */
const PREFS = {
  strafe_neu: true, zahlung_bestaetigt: true, zahlung_abgelehnt: true, rueckmeldung_erinnerung: true,
  termin_abgesagt: true, termin_geaendert: true, termin_neu: true, strafen_offen: false,
  zahlung_gemeldet: true, absage_kurzfristig: true, meldeschluss_uebersicht: true, unterbesetzung: true,
  quiet_from: '22:00:00', quiet_to: '08:00:00', quiet_override_urgent: true,
  hint_dismissed_at: null, updated_at: '2026-09-25T18:00:00Z',
};

/* Alles, was loadAll() liefert - in genau seiner Form (deutsche Feldnamen). */
export function daten() {
  return {
    clubId: 'club-1',
    icalUrl: 'https://example.invalid/spielplan/sv-musterhausen-2.ics',
    icalSyncedAt: '2026-10-02T06:27:00Z',
    teamName: 'SV Musterhausen 2',
    verein: { name: 'SV Musterhausen e.V.', team: '1. Herrenmannschaft', saison: 'Saison 2026/27', gegruendet: 1968 },
    players: SPIELER.map(([id, name, nr, pos]) => Object.assign(
      { id, code: id, name, nr, pos, status: 'fit', statusNote: null, statusUntil: null, statusSince: null },
      STATUS[id] || {})),
    events: TERMINE,
    sportstaetten: [],
    katalog: KATALOG,
    strafen: STRAFEN,
    rsvps: RUECK.map(([eventId, playerId, status, grund]) => ({ eventId, playerId, status, grund })),
    lineups: AUFSTELLUNGEN,
  };
}

/* ---- Profile -------------------------------------------------------------
   Sechs Spalten der Landkarte. "anmeldung" hat keine Sitzung.             */
export const PROFILE = {
  anmeldung:         { titel: 'Vor der Anmeldung',  rollen: null },
  spieler:           { titel: 'Spieler',            rollen: ['player'] },
  trainer:           { titel: 'Trainer',            rollen: ['player', 'coach'] },
  kassenwart:        { titel: 'Kassenwart',         rollen: ['player', 'treasurer'] },
  trainerkassenwart: { titel: 'Trainer+Kassenwart', rollen: ['player', 'coach', 'treasurer'] },
  admin:             { titel: 'Admin',              rollen: ['player', 'admin'] },
};

function profilDaten(name) {
  const p = PROFILE[name];
  if (!p) throw new Error('Unbekanntes Profil: ' + name);
  if (!p.rollen) return { sitzung: null, profil: null, rollen: [] };
  const userId = 'u-' + name;
  const email = name + '@landkarte.example.invalid';
  return {
    sitzung: { user: { id: userId, email }, access_token: 'landkarte' },
    profil: { id: userId, club_id: 'club-1', email, role: 'player', player_id: EIGENER_SPIELER,
              created_at: '2026-08-01T10:00:00Z', calendar_token: null,
              calendar_hint_dismissed_at: null, calendar_subscribe_started_at: null },
    rollen: p.rollen.slice(),
  };
}

/* Mitgliederliste fuer die Rollen-Ansicht: ein Konto je Rolle. */
const MITGLIEDER = [
  { userId: 'u-a', email: 'admin@landkarte.example.invalid',  playerId: 'p06', roles: ['player', 'admin'] },
  { userId: 'u-t', email: 'trainer@landkarte.example.invalid', playerId: 'p08', roles: ['player', 'coach'] },
  { userId: 'u-k', email: 'kasse@landkarte.example.invalid',   playerId: 'p13', roles: ['player', 'treasurer'] },
  { userId: 'u-s', email: 'spieler@landkarte.example.invalid', playerId: 'p02', roles: ['player'] },
  { userId: 'u-n', email: 'neu@landkarte.example.invalid',     playerId: null,  roles: [] },
];

/* ---- Das Stand-in als Quelltext ------------------------------------------
   Wird statt db.js ausgeliefert. Die Methodenliste muss die von db.js genau
   treffen; landkartenrauch.mjs vergleicht beide.                         */
export function stubQuelle(profilName) {
  const D = {
    daten: daten(),
    profil: profilDaten(profilName),
    vorlagen: VORLAGEN,
    prefs: PREFS,
    mitglieder: MITGLIEDER,
  };
  return `/* Landkarten-Stand-in fuer db.js - Profil ${profilName}. Keine Datenbank. */
window.__dbProtokoll = [];
window.DB = (function () {
  "use strict";
  const D = ${JSON.stringify(D)};
  const kopie = (x) => { try { return JSON.parse(JSON.stringify(x === undefined ? null : x)); } catch (e) { return String(x); } };
  const lies = (wert) => async () => kopie(wert);
  const schreib = (methode, antwort) => async (...argumente) => {
    window.__dbProtokoll.push({ methode, argumente: kopie(argumente) });
    return typeof antwort === "function" ? antwort(...argumente) : kopie(antwort);
  };
  const infos = D.vorlagen.map((v) => ({ kategorie: v.kategorie, empfaenger_beschreibung: v.empfaenger_beschreibung,
    ausloeser_beschreibung: v.ausloeser_beschreibung, urgency: v.urgency, aktiv: v.aktiv, rolle: v.rolle }));
  return {
    client: null,
    /* lesen */
    loadAll: lies(D.daten),
    getSession: lies(D.profil.sitzung),
    loadProfile: lies(D.profil.profil),
    myRoles: lies(D.profil.rollen),
    loadNotificationPrefs: lies(D.profil.sitzung ? D.prefs : null),
    loadNotificationInfos: lies(infos),
    loadNotificationTemplates: lies(D.vorlagen),
    loadPreviewOutbox: lies([]),
    pushSubscriptionBekannt: lies(false),
    myCalendarToken: lies("landkarte-token"),
    listMembers: lies(D.mitglieder),
    fineHistory: async (fineId) => {
      const s = D.daten.strafen.find((x) => x.id === fineId);
      if (!s) return [];
      const v = [{ from: null, to: "offen", method: null, reason: null, by: null, at: s.createdAt }];
      if (s.status === "gemeldet") v.push({ from: "offen", to: "gemeldet", method: s.sagtZahlart, reason: null, by: null, at: s.gemeldetAm });
      if (s.status === "bestätigt") v.push({ from: "offen", to: "bestätigt", method: s.zahlart, reason: null, by: null, at: s.paidAt });
      if (s.status === "storniert") v.push({ from: "offen", to: "storniert", method: null, reason: null, by: null, at: s.createdAt });
      return v;
    },
    onPasswordRecovery: function () {},
    /* schreiben - nur protokollieren */
    setRsvp: schreib("setRsvp"), deleteRsvp: schreib("deleteRsvp"),
    setFinePaid: schreib("setFinePaid"), deleteFine: schreib("deleteFine"), addFines: schreib("addFines"),
    setCalendarHint: schreib("setCalendarHint"),
    upsertPushSubscription: schreib("upsertPushSubscription"), deletePushSubscription: schreib("deletePushSubscription"),
    setNotificationPrefs: schreib("setNotificationPrefs"),
    sendTestNotification: schreib("sendTestNotification", 1),
    setNotificationTemplate: schreib("setNotificationTemplate"),
    sendPreviewNotification: schreib("sendPreviewNotification", 1),
    deletePreviewNotifications: schreib("deletePreviewNotifications", 0),
    insertCatalog: schreib("insertCatalog", (clubId, offense, amount) => ({ id: "k-neu", club_id: clubId, offense, amount })),
    updateCatalog: schreib("updateCatalog"), deleteCatalog: schreib("deleteCatalog"),
    insertEvents: schreib("insertEvents", (rows) => (rows || []).map((r, i) => Object.assign({ id: "e-neu-" + i }, r))),
    updateEvent: schreib("updateEvent"), updateSeriesFrom: schreib("updateSeriesFrom"),
    deleteEvent: schreib("deleteEvent"), deleteSeriesFrom: schreib("deleteSeriesFrom"),
    upsertSportstaette: schreib("upsertSportstaette"),
    regenerateCalendarToken: schreib("regenerateCalendarToken", "landkarte-token-neu"),
    setIcalUrl: schreib("setIcalUrl"),
    syncNow: schreib("syncNow", { ok: true, updated: 0, new: 0, cancelled: 0, parsed: 0 }),
    saveLineup: schreib("saveLineup", (lu) => Object.assign({ id: (lu && lu.id) || "l-neu" }, lu)),
    deleteLineup: schreib("deleteLineup"), setLineupActive: schreib("setLineupActive"),
    signIn: schreib("signIn", {}), signUp: schreib("signUp", {}), signOut: schreib("signOut"),
    setMyPlayer: schreib("setMyPlayer"), setPlayerStatus: schreib("setPlayerStatus"),
    resetPassword: schreib("resetPassword"), updatePassword: schreib("updatePassword"),
    grantRole: schreib("grantRole"), revokeRole: schreib("revokeRole"),
    reportMyPayment: schreib("reportMyPayment", 2),
    createFinesBatch: schreib("createFinesBatch", "b-neu"),
    confirmFines: schreib("confirmFines", (ids) => (ids || []).length),
    markFinesPaid: schreib("markFinesPaid", (ids) => (ids || []).length),
    rejectFine: schreib("rejectFine"),
    cancelBatch: schreib("cancelBatch", 1), cancelFine: schreib("cancelFine"),
  };
})();
`;
}

/* ---- Service Worker -------------------------------------------------------
   Ohne Attrappe haengt "Mitteilungen" an navigator.serviceWorker.ready
   (app.js 1488). Die Attrappe meldet: Push ist auf diesem Geraet nicht
   eingerichtet. Freigegeben am 02.10.2026, app.js bleibt unveraendert.  */
const SW_ATTRAPPE = `(() => {
  const reg = {
    active: {}, scope: "/",
    pushManager: { getSubscription: async () => null,
                   subscribe: async () => { throw new Error("Push ist im Landkartenlauf aus"); } },
    showNotification: async () => {},
    update: async () => {}, unregister: async () => true,
    addEventListener() {}, removeEventListener() {},
  };
  const sw = {
    controller: null, ready: Promise.resolve(reg),
    register: async () => reg, getRegistration: async () => reg, getRegistrations: async () => [reg],
    addEventListener() {}, removeEventListener() {}, startMessages() {},
  };
  try { Object.defineProperty(Navigator.prototype, "serviceWorker", { get() { return sw; }, configurable: true }); } catch (e) {}
})();`;

/* Die Supabase-Bibliothek vom CDN: nur eine Attrappe mit Antwort 200.
   Sperren ginge nicht - der onerror in index.html zeigt sonst die Diagnose. */
const SUPABASE_ATTRAPPE = 'window.supabase = { createClient: function () { return {}; } };';

const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

export async function neuerKontext(browser) {
  return browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
    userAgent: IPHONE_UA, locale: 'de-DE', timezoneId: 'Europe/Berlin', serviceWorkers: 'block',
  });
}

const istSupabase = (url) => { try { return /(^|\.)supabase\.co$/i.test(new URL(url).hostname); } catch (e) { return false; } };

/* Richtet eine Seite fuer ein Profil ein. Vor page.goto aufrufen. */
export async function installiere(page, profilName) {
  const quelle = stubQuelle(profilName);
  const verstoesse = [], fehler = [], hinweise = [];
  let basisHost = null;

  await page.clock.setFixedTime(new Date(JETZT));
  await page.addInitScript(SW_ATTRAPPE);

  page.on('request', (r) => { if (istSupabase(r.url())) verstoesse.push('Request an Supabase: ' + r.method() + ' ' + r.url()); });
  page.on('pageerror', (e) => fehler.push('Seitenfehler: ' + e.message));
  page.on('requestfailed', (r) => {
    if (istSupabase(r.url())) return;   // schon als Verstoss gezaehlt
    const lokal = basisHost && new URL(r.url()).host === basisHost;
    (lokal ? fehler : hinweise).push('Request fehlgeschlagen: ' + r.url() + ' (' + ((r.failure() || {}).errorText || '?') + ')');
  });
  page.on('response', (r) => {
    if (r.status() >= 400 && basisHost && new URL(r.url()).host === basisHost) fehler.push('HTTP ' + r.status() + ': ' + r.url());
  });
  page.on('framenavigated', (f) => { if (f === page.mainFrame() && !basisHost) { try { basisHost = new URL(f.url()).host; } catch (e) {} } });

  await page.route((url) => istSupabase(url.href), (route) => route.abort('blockedbyclient'));
  await page.route(/cdn\.jsdelivr\.net\/npm\/@supabase\//, (route) =>
    route.fulfill({ status: 200, contentType: 'text/javascript', body: SUPABASE_ATTRAPPE }));
  await page.route(/\/db\.js(\?|$)/, (route) =>
    route.fulfill({ status: 200, contentType: 'text/javascript', body: quelle }));

  return {
    profil: profilName,
    verstoesse, fehler, hinweise,
    async protokoll() { return page.evaluate(() => window.__dbProtokoll || []); },
    async bericht() {
      return { verstoesse: verstoesse.slice(), fehler: fehler.slice(), hinweise: hinweise.slice(),
               protokoll: await page.evaluate(() => window.__dbProtokoll || []).catch(() => []) };
    },
  };
}

/* Wartet, bis die App fertig gerendert hat: Login-Maske oder Navigation. */
export async function warteAufApp(page) {
  await page.waitForFunction(() => !!document.querySelector('.auth-submit') ||
    (!!document.querySelector('.app-nav') && !document.getElementById('__skeleton')), null, { timeout: 15000 });
  await page.waitForTimeout(300);
}
