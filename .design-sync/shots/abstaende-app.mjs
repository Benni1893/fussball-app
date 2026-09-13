import { chromium } from 'playwright';
import { starte } from './server.mjs';
const { server, basis } = await starte(process.cwd());
const b = await chromium.launch({ channel: 'chrome' });
const ctx = await b.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:3, isMobile:true, hasTouch:true,
  userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' });
const p = await ctx.newPage();
await p.goto(basis, { waitUntil:'networkidle' }); await p.waitForTimeout(1200);
await p.fill('input[type="email"]', process.env.APP_USER);
await p.fill('input[type="password"]', process.env.APP_PASS);
await p.click('.auth-submit');
await p.waitForSelector('.app-nav', { timeout:25000 }); await p.waitForTimeout(2200);

const luft = `(q) => {
  const x = document.querySelector(q.a), y = document.querySelector(q.b);
  if (!x || !y) return null;
  return Math.round(y.getBoundingClientRect().top - x.getBoundingClientRect().bottom);
}`;
const F = new Function('return ' + luft)();
const zeig = async (titel, paare) => {
  console.log('\n' + titel);
  for (const [name, a, c] of paare) {
    const v = await p.evaluate(F, { a, b: c });
    console.log('  ' + name.padEnd(32) + (v == null ? '(nicht da)' : v + 'px'));
  }
};
const geh = async (id) => { await p.evaluate(() => document.querySelector('.nav-btn[data-view="dashboard"]').click()); await p.waitForTimeout(400);
  await p.evaluate(() => document.getElementById('navMore').click()); await p.waitForTimeout(400);
  await p.evaluate((i) => document.getElementById(i).click(), id); await p.waitForTimeout(1300); };

await p.evaluate(() => document.querySelector('.nav-btn[data-view="dashboard"]').click()); await p.waitForTimeout(1200);
await zeig('App Uebersicht', [
  ['Anrede -> Hero', '.page-head', '.termin-hero'],
  ['Hero -> Abschnitt', '.termin-hero', '.section-title'],
  ['Abschnitt -> Aufgabenliste', '.section-title', '.task-list'],
  ['Aufgabenzeile -> Zeile', '.task-row:nth-child(1)', '.task-row:nth-child(2)'],
  ['Aufgabenliste -> Geldzeile', '.task-list', '.tile-rows'],
]);
await p.evaluate(() => document.querySelector('.nav-btn[data-view="kalender"]').click()); await p.waitForTimeout(1400);
await zeig('App Kalender', [
  ['Titel -> Chips', '.page-head', '.chips'],
  ['Chips -> Knoepfe', '.chips', '.kal-cta'],
  ['Knoepfe -> Liste', '.kal-cta', '.event-list'],
  ['Karte -> Karte', '.event:nth-child(1)', '.event:nth-child(2)'],
]);
await p.evaluate(() => document.querySelector('.nav-btn[data-view="strafen"]').click()); await p.waitForTimeout(1400);
await zeig('App Konto', [
  ['Kontoblock -> Kacheln', '.mine-banner', '.kpi-grid'],
  ['Kacheln -> Chips', '.kpi-grid', '.chips'],
  ['Chips -> Liste', '.chips', '.fine-list'],
  ['Zeile -> Zeile', '.fine-row:nth-child(1)', '.fine-row:nth-child(2)'],
]);
await p.evaluate(() => document.querySelector('.nav-btn[data-view="katalog"]').click()); await p.waitForTimeout(1400);
await zeig('App Katalog', [
  ['Begleitsatz -> Liste', '.page-head p', '.kat-list'],
  ['Karte -> Karte', '.kat-item:nth-child(1)', '.kat-item:nth-child(2)'],
  ['Liste -> Knopf', '.kat-list', '.kat-add'],
]);
await geh('moreKasse');
await zeig('App Kasse', [
  ['Titel -> Kacheln', '.page-head', '.kpi-grid'],
  ['Kacheln -> Knopf', '.kpi-grid', '.kasse-toggle'],
  ['Knopf -> Abschnitt', '.kasse-toggle', '.kasse-verbuchen'],
  ['Abschnitt -> Chips', '.kasse-verbuchen', '.ks-tabs'],
]);

await b.close(); server.close();
