/* Vorlagen-Datensatz für finalmess.mjs: bildet die Beispieldaten der Vorlage
   „Final Alle Screens“ nach (Verein „FC Fasanerie-Nord 2“, Nutzer „Lukas Weber“,
   Training Di 6. Okt, Spiel So 11. Okt gegen FC Teutonia Mün. 2 …), soweit sie
   sich nicht widersprechen. Die Vorlage nutzt je Screen eigene Zahlen (z. B.
   Rückmeldungen 1/0/15 in 01, 7/2 in 04; 238 offene Strafen bei 16 Spielern);
   solche datenabhängigen Werte nimmt finalscreens.mjs je Screen aus.
   Uhr: Montag, 05.10.2026, 19:30 Uhr – Training morgen, Meldeschluss in 21 h.   */
import { daten as landkarte } from './landkartenmodul.mjs';

export const JETZT_VORLAGE = '2026-10-05T19:30:00+02:00';

const SPIELER = [
  ['p01', 'Anton Feldmann',  1, 'TW'],
  ['p02', 'Bruno Kessler',   2, 'AV'],
  ['p03', 'Carl Lindner',    3, 'AV'],
  ['p04', 'Jonas Reich',     6, 'IV'],
  ['p05', 'Emil Nordhoff',   5, 'IV'],
  ['p06', 'Lukas Weber',     8, 'ZM'],
  ['p07', 'Max Bauer',       7, 'ZM'],
  ['p08', 'Jonas Becker',   10, 'ZM'],
  ['p09', 'Niklas Fischer',  9, 'ST'],
  ['p10', 'Felix Hofmann',  11, 'OM'],
  ['p11', 'Florian Huber',  14, 'ST'],
  ['p12', 'Oskar Zierer',   12, 'TW'],
  ['p13', 'Daniel Koch',     4, 'IV'],
  ['p14', 'Simon Lang',     13, 'AV'],
  ['p15', 'Tim Richter',    17, 'OM'],
  ['p16', 'Paul Ebert',     19, 'ST'],
];
const STATUS = {
  p05: { status: 'verletzt', statusNote: 'Knie', statusSince: '2026-09-28', statusUntil: null },
};

function termin(id, typ, titel, gegner, heim, datum, zeit, ort, frist, extra) {
  const startsAt = zeit ? new Date(`${datum}T${zeit}:00+02:00`).toISOString() : null;
  return Object.assign({
    id, typ, titel, gegner, heim, datum, zeit, ort, note: null,
    startsAt, auto: true, deadlineAt: frist ? new Date(frist).toISOString() : null, deadlineOverrideHours: null,
    status: 'geplant', quelle: 'manuell', wettbewerb: null, liga: null,
    spielstaette: null, adresse: null, locationRaw: null,
    ende: null, serieId: null, serieGeaendert: false,
    manuellBearbeitet: {}, bfvOriginal: {}, bfvNeu: {}, treffen: null,
  }, extra || {});
}
const TERMINE = [
  termin('e-sp0', 'spiel', 'FC Hochbrück', 'FC Hochbrück', true, '2026-10-04', '13:00', 'Sportanlage Lechelstraße',
         '2026-10-03T13:00:00+02:00', { quelle: 'bfv', wettbewerb: 'Meisterschaften' }),
  termin('e-tr1', 'training', 'Training', null, null, '2026-10-06', '19:30', 'Sportanlage Lechelstraße',
         '2026-10-06T16:30:00+02:00', { ende: '21:00', serieId: 'serie-di' }),
  termin('e-tr2', 'training', 'Training', null, null, '2026-10-08', '19:30', 'Sportanlage Lechelstraße',
         '2026-10-08T16:30:00+02:00', { ende: '21:00', serieId: 'serie-do' }),
  termin('e-sp1', 'spiel', 'FC Teutonia Mün. 2', 'FC Teutonia Mün. 2', false, '2026-10-11', '13:30', 'Sportanlage Kunstrasen Thusnelda',
         '2026-10-10T13:30:00+02:00', { quelle: 'bfv', wettbewerb: 'Meisterschaften', treffen: '12:45' }),
  termin('e-so1', 'sonstiges', 'Mannschaftsabend', null, null, '2026-10-16', '20:00', 'Vereinsheim', null, { auto: false }),
  termin('e-sp2', 'spiel', 'SC Grüne Heide 2', 'SC Grüne Heide 2', true, '2026-10-18', '12:30', 'Sportanlage Lechelstraße',
         '2026-10-17T12:30:00+02:00', { quelle: 'bfv', wettbewerb: 'Meisterschaften' }),
  termin('e-sp3', 'spiel', 'SV Am Hart', 'SV Am Hart', false, '2026-10-25', '12:45', 'Sportanlage Am Hart',
         '2026-10-24T12:45:00+02:00', { quelle: 'bfv', wettbewerb: 'Meisterschaften' }),
];
// Training morgen: nur der eigene Spieler hat zugesagt (1 zu · 0 ab · 15 offen).
const RUECK = [
  ['e-tr1', 'p06', 'zu', null],
  ['e-tr2', 'p06', 'zu', null],
  ['e-sp1', 'p01', 'zu', null],
];
const KATALOG = [
  ['k1', 'Zu spät zum Spiel oder Treffpunkt', 10],
  ['k2', 'Unentschuldigtes Fehlen (Training)', 15],
  ['k3', 'Unentschuldigtes Fehlen (Spiel)', 25],
  ['k4', 'Verspätete Absage (unter 24 Std.)', 8],
  ['k5', 'Zu spät zum Training', 0, { typ: 'staffel', einheit: 'Minuten', proEinheit: 1, schritt: 5, maxBetrag: 10 }],
  ['k6', 'Handy klingelt in der Besprechung', 5],
  ['k7', 'Gelb-Rote Karte (Meckern)', 12],
  ['k8', 'Rote Karte (unsportlich)', 20],
  ['k9', 'Trikot vergessen', 3],
].map(([id, vergehen, betrag, x]) => Object.assign({ id, vergehen, betrag, kategorie: null, typ: 'fixed', einheit: null, proEinheit: null, schritt: null, maxBetrag: null }, x || {}));

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
// Eigenes Konto: 30,00 € offen; die älteste offene Strafe erhöht sich in 1h 50m
// (angelegt vor 7 Tagen minus 1h 50m). 8 gemeldet (zusammen 104,00 €).
const STRAFEN = [
  strafe('f01', 'p06', 'k1', 'Zu spät zum Spiel', 5, '2026-10-03', 'offen'),
  strafe('f03', 'p06', 'k6', 'Handy klingelt in der Besprechung', 5, '2026-10-02', 'offen'),
  strafe('f02', 'p06', null, 'Vergessene Zahlung Mannschaftskasse', 20, '2026-10-01', 'offen',
         { createdAt: '2026-09-28T19:20:00Z' }),
  ...[12, 15, 10, 25, 12, 10, 12, 8].map((b, i) => strafe('g0' + i, 'p06', 'k7', 'Gelb-Rote Karte (Meckern)', b, '2026-09-2' + (i % 8), 'gemeldet',
      { sagtZahlart: 'paypal', gemeldetAm: '2026-09-29T14:42:00Z' })),
  strafe('f10', 'p10', 'k7', 'Gelb-Rote Karte (Meckern)', 20, '2026-05-10', 'offen'),
  strafe('f11', 'p10', null, 'Duschen mit Socken', 5, '2026-09-26', 'offen'),
  strafe('f12', 'p10', 'k5', 'Zu spät zum Training', 12, '2026-09-22', 'offen'),
  strafe('f13', 'p15', 'k3', 'Unentschuldigtes Fehlen (Spiel)', 25, '2026-05-10', 'offen'),
  strafe('f14', 'p11', 'k8', 'Rote Karte (unsportlich)', 22, '2026-09-26', 'offen'),
  strafe('f15', 'p07', null, 'Vergessene Zahlung', 20, '2026-10-01', 'offen'),
  strafe('f16', 'p09', 'k4', 'Verspätete Absage (unter 24 Std.)', 10, '2026-09-26', 'offen'),
  strafe('f20', 'p06', 'k9', 'Trikot vergessen', 3, '2026-09-13', 'bestätigt'),
];
const AUFSTELLUNGEN = [
  { id: 'l-01', eventId: 'e-sp1', name: 'Gegen Teutonia', formation: '4-4-2',
    slots: { TW: 'p01', LV: 'p02', LIV: 'p04', RIV: 'p13', RV: 'p03', LM: 'p07', LZM: 'p08', RZM: 'p10', RM: 'p15', LST: 'p09', RST: 'p14' },
    bank: ['p12'], isActive: true, isTemplate: false, updatedAt: '2026-10-04T10:00:00Z' },
  { id: 'l-02', eventId: 'e-sp2', name: 'Gegen Grüne Heide', formation: '4-3-3',
    slots: { TW: 'p01', LV: 'p02', LIV: 'p04', RIV: 'p13', RV: 'p03', LZM: 'p07', ZM: 'p08', RZM: 'p10', LA: 'p15', ST: 'p09', RA: 'p14' },
    bank: [], isActive: true, isTemplate: false, updatedAt: '2026-10-04T10:00:00Z' },
  { id: 'l-t1', eventId: null, name: 'Standard', formation: '4-3-3', slots: {}, bank: [], isActive: false, isTemplate: true, updatedAt: '2026-09-17T10:00:00Z' },
  { id: 'l-t2', eventId: null, name: 'Grundelf', formation: '4-2-3-1', slots: {}, bank: [], isActive: false, isTemplate: true, updatedAt: '2026-09-20T10:00:00Z' },
];

export function vorlageDaten() {
  const d = landkarte();
  return Object.assign(d, {
    teamName: 'FC Fasanerie-Nord 2',
    icalUrl: 'https://example.invalid/spielplan/fc-fasanerie-nord-2.ics',
    verein: { name: 'FC Fasanerie-Nord e.V.', team: '2. Herrenmannschaft', saison: 'Saison 2026/27', gegruendet: 1968 },
    players: SPIELER.map(([id, name, nr, pos]) => Object.assign(
      { id, code: id, name, nr, pos, status: 'fit', statusNote: null, statusUntil: null, statusSince: null }, STATUS[id] || {})),
    events: TERMINE,
    katalog: KATALOG,
    strafen: STRAFEN,
    rsvps: RUECK.map(([eventId, playerId, status, grund]) => ({ eventId, playerId, status, grund })),
    lineups: AUFSTELLUNGEN,
  });
}
