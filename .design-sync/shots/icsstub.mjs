/* Fester Datensatz und ein Renderer fuer die Vercel-Functions, damit der
   iCal-Ausgang ohne Netz, ohne Supabase und ohne Uhrzeit-Zufall reproduzierbar
   ist. Wird von icspruef.mjs und von der Refactor-Kontrolle benutzt.

   Die fuenf Termine decken die Zweige ab, die der Feed kennt: Spiel heim,
   Spiel auswaerts (ohne Koordinaten, mit Notiz), Training mit Zeit, Termin
   ohne Zeit (ganztaegig, abgesagt, Semikolon und Komma im Titel) und einer
   ueber Mitternacht.                                                         */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

export const CLUB = { id: 'club-1', team_name: 'FC Fasanerie-Nord II', name: 'FC Fasanerie-Nord', slug: 'fcfn' };
export const TOKEN = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';

export const EVENTS = [
  { id: 'e1', type: 'spiel', title: null, opponent: 'VfB Sparta München', home: true,
    date: '2026-09-20', time: '12:30', ende: '14:30', starts_at: '2026-09-20T10:30:00Z',
    location_raw: 'BSA Lerchenauer Straße, Lerchenauer Str. 220, Kunstrasen 2',
    spielstaette: 'BSA Lerchenauer Straße', note: null, status: 'geplant',
    ical_seq: 0, updated_at: '2026-09-18T08:00:00Z' },
  { id: 'e2', type: 'spiel', title: null, opponent: 'FT München-Gern 2', home: false,
    date: '2026-09-27', time: '10:00', ende: '12:00', starts_at: '2026-09-27T08:00:00Z',
    location_raw: 'Sportpark Stadtsparkasse, Hanauer Str. 20, Kunstrasen',
    spielstaette: 'Sportpark Stadtsparkasse', note: 'Treffpunkt 9:00 am Vereinsheim; Trikots mitbringen',
    status: 'geplant', ical_seq: 2, updated_at: '2026-09-19T17:45:00Z' },
  { id: 'e3', type: 'training', title: 'Training', opponent: null, home: null,
    date: '2026-09-22', time: '19:30', ende: '21:00', starts_at: '2026-09-22T17:30:00Z',
    location_raw: 'BSA Lerchenauer Straße, Lerchenauer Str. 220, Platz 2',
    spielstaette: 'BSA Lerchenauer Straße', note: null, status: 'geplant',
    ical_seq: 0, updated_at: '2026-09-01T06:00:00Z' },
  { id: 'e4', type: 'sonstiges', title: 'Mannschaftsabend; Bowling, Essen', opponent: null, home: null,
    date: '2026-10-03', time: null, ende: null, starts_at: null,
    location_raw: null, spielstaette: null, note: null, status: 'abgesagt',
    ical_seq: 1, updated_at: '2026-09-15T12:00:00Z' },
  { id: 'e5', type: 'sonstiges', title: 'Hallenturnier, Nachtschicht', opponent: null, home: null,
    date: '2026-11-14', time: '22:00', ende: '01:30', starts_at: '2026-11-14T21:00:00Z',
    location_raw: 'Sporthalle am Hart, Kieferngartenstr. 5, Halle',
    spielstaette: 'Sporthalle am Hart', note: null, status: 'geplant',
    ical_seq: 0, updated_at: '2026-10-30T09:15:00Z' },
];

/* Schluessel wie in der Function: klein, ohne Diakritika und Sonderzeichen. */
function normAddr(s) {
  return String(s || '').toLowerCase()
    .replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '');
}
/* Nur zwei der drei Adressen haben Koordinaten - damit ist auch der Zweig
   "LOCATION ohne GEO" im Datensatz. */
export const ORTE = [
  { adresse_norm: normAddr(EVENTS[0].location_raw), lat: 48.2025, lng: 11.5461,
    name: 'BSA Lerchenauer Straße', adresse: 'Lerchenauer Str. 220' },
  { adresse_norm: normAddr(EVENTS[2].location_raw), lat: 48.2025, lng: 11.5461,
    name: 'BSA Lerchenauer Straße', adresse: 'Lerchenauer Str. 220' },
  { adresse_norm: normAddr(EVENTS[4].location_raw), lat: 48.1899, lng: 11.5902,
    name: 'Sporthalle am Hart', adresse: 'Kieferngartenstr. 5' },
];

const FIX = new Date('2026-09-20T09:00:00Z');

/* Laedt eine Vercel-Function mit gefaelschtem fetch und eingefrorener Uhr und
   gibt zurueck, was sie gesendet haette. */
export async function renderFunction(pfad, query, extraRows) {
  const echtesFetch = globalThis.fetch;
  const echtesDate = globalThis.Date;
  process.env.SUPABASE_URL = 'https://stub.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'stub-service-key';

  class EingefroreneZeit extends echtesDate {
    constructor(...a) { if (a.length === 0) super(FIX.getTime()); else super(...a); }
    static now() { return FIX.getTime(); }
  }
  globalThis.Date = EingefroreneZeit;

  globalThis.fetch = async (url) => {
    const u = String(url);
    const gib = (rows) => ({ ok: true, status: 200, json: async () => rows });
    if (u.includes('profiles?')) {
      return gib(u.includes(encodeURIComponent(TOKEN)) || u.includes(TOKEN) ? [{ club_id: CLUB.id }] : []);
    }
    if (u.includes('clubs?')) return gib([CLUB]);
    if (u.includes('sportstaetten?')) return gib(ORTE);
    if (u.includes('events?')) {
      // [?&] davor, sonst trifft der Ausdruck auch club_id=eq.
      const m = /[?&]id=eq\.([^&]+)/.exec(u);
      const rows = m ? EVENTS.filter((e) => e.id === decodeURIComponent(m[1])) : EVENTS;
      return gib(extraRows ? extraRows(rows, u) : rows);
    }
    throw new Error('Unerwarteter Aufruf: ' + u);
  };

  let status = 200, body = '', kopf = {};
  const res = {
    setHeader(k, v) { kopf[k] = v; },
    status(n) { status = n; return this; },
    send(b) { body = b; return this; },
    end(b) { if (b != null) body = b; return this; },
  };
  try {
    delete require.cache[require.resolve(pfad)];
    const handler = require(pfad);
    await handler({ query: query || {} }, res);
  } finally {
    globalThis.fetch = echtesFetch;
    globalThis.Date = echtesDate;
  }
  return { status, body, kopf };
}
