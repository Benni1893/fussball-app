/* Ehemalige in der App (Block 1, Migration 0076): Der Mahnzuschlag eines
   Ehemaligen zaehlt nur bis zum Austritt - gleiche Rechnung wie
   apply_fine_surcharges. Stand-in, Uhr 02.10.2026 18:00.
   Strafe vom 02.09. (30 Tage, 8 €), Austritt am 22.09. (10 Tage):
   eingefroren 2 Stufen = 4 €, also 12 €; ohne Austritt waeren es 16 €.
   Zum Vergleich ein aktiver Spieler mit gleich alter Strafe: 16 €.
   Aufruf: node .design-sync/shots/ehemaligepruef.mjs                      */
import { chromium } from 'playwright';
import { starte } from './server.mjs';
import { installiere, warteAufApp, daten } from './landkartenmodul.mjs';

const fehler = [];
const pruefe = (ok, t, d) => { console.log((ok ? '  ok   ' : '  FEHL ') + t + (!ok && d !== undefined ? '   ' + d : '')); if (!ok) fehler.push(t); };

const d = daten();
d.ehemalige = [{ id: 'px1', code: 'x1', name: 'Ehemaliger Spieler', nr: null, pos: null, status: 'fit', statusNote: null, statusUntil: null, statusSince: null,
                 ausgeschiedenAm: '2026-09-22T18:00:00Z' }];
const alt = (id, playerId) => ({ id, playerId, katalogId: 'k1', datum: '2026-09-02', bezahlt: false, note: null, selfReported: false, paidAt: null,
  status: 'offen', batchId: null, zahlart: null, ablehnGrund: null, sagtZahlart: null, sagtNote: null, gemeldetAm: null,
  grundbetrag: 8, zuschlag: 0, zuschlagAt: null, createdAt: '2026-09-02T17:00:00Z', eventId: null, auto: false, vergehen: 'Verspätete Rückmeldung' });
d.strafen = [alt('fx1', 'px1'), alt('fa1', 'p05')];

const { server, basis } = await starte(process.cwd());
const browser = await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'de-DE', timezoneId: 'Europe/Berlin' });
const page = await ctx.newPage();
const inst = await installiere(page, 'kassenwart', { daten: d });
await page.goto(basis + '#kasse=offen', { waitUntil: 'load' }); await warteAufApp(page);
await page.waitForTimeout(800);
const text = await page.evaluate(() => document.getElementById('view').innerText.replace(/ /g, ' '));
const zeile = (name) => (text.split('\n').map((z, i, a) => [z, a.slice(i, i + 4).join(' ')]).find(([z]) => z.includes(name)) || [])[1] || '';
const ex = zeile('Ehemalig'), akt = zeile('Emil Nordhoff');
pruefe(/12,00 €/.test(ex) && !/16,00 €/.test(ex), 'Ehemaliger: Zuschlag ab Austritt eingefroren (12,00 €)', ex);
pruefe(/16,00 €/.test(akt), 'aktiver Spieler: Zuschlag läuft weiter (16,00 €)', akt);
// Block 3: Anzeige "Ehemalig · ausgetreten am TT.MM.JJJJ", ohne Nummer
pruefe(/Ehemalig · ausgetreten am 22.09.2026/.test(text) && !/Ehemaliger Spieler/.test(text), 'Ehemaliger heißt „Ehemalig · ausgetreten am 22.09.2026“', ex);
const b = await inst.bericht();
pruefe(b.fehler.length === 0 && b.verstoesse.length === 0, 'Stand-in ohne Fehler', JSON.stringify(b.fehler.concat(b.verstoesse).slice(0, 3)));
await browser.close(); server.close();
console.log(fehler.length ? `\n--- ${fehler.length} Beanstandung(en) ---` : '\n--- bestanden ---');
process.exit(fehler.length ? 1 : 0);
