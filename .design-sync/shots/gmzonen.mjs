/* Nacharbeit Gerätematrix: misst bei einer Breite die Lücken zwischen
   Elementen, deren erweiterte Tippzonen sich überlappen, und die effektive
   Zone (sichtbarer Kasten plus ::after, beschnitten am Nachbarn).
   Aufruf: node .design-sync/shots/gmzonen.mjs [breite] [schrift]          */
import fs from 'node:fs';
import { chromium } from 'playwright';
import { starte } from './server.mjs';
import { installiere, warteAufApp, neuerKontext } from './landkartenmodul.mjs';
import { AUSLOESER, UEBERLAGERUNGEN, zustandImBrowser } from './landkartenregeln.mjs';
import { kandidatenImBrowser } from './landkarte.mjs';
import { skaliereImBrowser } from './geraetematrix.mjs';

const breite = Number(process.argv[2] || 390), schrift = Number(process.argv[3] || 100);
// [profil, zustand, element, nachbar (Selektor relativ zum Dokument), Richtung]
const PAARE = [
  ['admin', 'kalender', '.tk-unten-l', '.tk-rsvp .tk-btn', 'oben'],
  ['admin', 'kasse/pruefen', '.ks-stapelkopf .link-btn', '.ks-deck .ks-card', 'unten'],
  ['admin', 'trainer/spiel', '.tv-bank-kopf .link-btn', '.tv-bank-row .tv-bslot', 'unten'],
  ['admin', 'trainer/spiel', '.tv-bslot.filled .tv-bx', '.tv-bslot.filled + .tv-bslot', 'rechts'],
  ['admin', 'trainer/spiel', '.tv-bslot.filled .tv-bx', '.tv-bank-kopf .link-btn', 'oben'],
  ['kassenwart', 'dashboard', '.group-head:has(+ .dn-liste) .link-btn', '.dn-liste .dn-zeile', 'unten'],
];
const lk = JSON.parse(fs.readFileSync('.design-sync/landkarte/landkarte.json', 'utf8'));
const { server, basis } = await starte(process.cwd());
const b = await chromium.launch({ channel: 'chrome' });
for (const [profil, schl, sel, nachbar, richtung] of PAARE) {
  const n = lk.profile[profil].knoten.find((k) => k.schluessel === schl);
  const ctx = await neuerKontext(b);
  const page = await ctx.newPage();
  await installiere(page, profil);
  await page.goto(basis, { waitUntil: 'load' });
  await warteAufApp(page);
  for (const s of n.pfad) {
    const z = await page.evaluate(zustandImBrowser, UEBERLAGERUNGEN);
    await page.evaluate(kandidatenImBrowser, { ausloeser: AUSLOESER, ueberlagerungen: UEBERLAGERUNGEN, oben: z.oben, istStart: s.global === true, nurArt: s.art, nurWert: s.wert });
    await page.evaluate(() => { const e = document.querySelector('[data-landkarte-ziel]'); e.removeAttribute('data-landkarte-ziel'); e.click(); });
    await page.waitForTimeout(450);
  }
  await page.setViewportSize({ width: breite, height: 844 });
  await page.addStyleTag({ content: '*{transition:none!important}' });
  await page.waitForTimeout(250);
  if (schrift !== 100) await page.evaluate(skaliereImBrowser, { an: true, faktor: schrift / 100 });
  const r = await page.evaluate(({ sel, nachbar, richtung }) => {
    const el = document.querySelector(sel);
    if (!el) return 'Element fehlt: ' + sel;
    const e = el.getBoundingClientRect();
    // nächster Nachbar in der Richtung
    const kand = [...document.querySelectorAll(nachbar)].filter((x) => x !== el && x.getClientRects().length).map((x) => x.getBoundingClientRect());
    const nb = kand.sort((a, c) => (richtung === 'oben' ? (e.top - a.bottom) - (e.top - c.bottom) : richtung === 'unten' ? (a.top - e.bottom) - (c.top - e.bottom) : (a.left - e.right) - (c.left - e.right)))
      .find((a) => (richtung === 'oben' ? a.bottom <= e.top + 1 : richtung === 'unten' ? a.top >= e.bottom - 1 : a.left >= e.right - 1));
    if (!nb) return 'Nachbar fehlt: ' + nachbar;
    const af = getComputedStyle(el, '::after');
    const luecke = richtung === 'oben' ? e.top - nb.bottom : richtung === 'unten' ? nb.top - e.bottom : nb.left - e.right;
    // Ausdehnung des ::after über den Kasten hinaus (aus dem Layout gemessen)
    const probe = document.createElement('div');
    return { kasten: [Math.round(e.width * 10) / 10, Math.round(e.height * 10) / 10], luecke: Math.round(luecke * 10) / 10,
      after: { top: af.top, bottom: af.bottom, left: af.left, right: af.right, width: af.width, height: af.height, transform: af.transform } };
  }, { sel, nachbar, richtung });
  console.log(`${profil} ${schl} ${sel} -> ${richtung} ${nachbar}:`, JSON.stringify(r));
  await ctx.close();
}
await b.close(); server.close();
