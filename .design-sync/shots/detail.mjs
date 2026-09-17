/* Misst einzelne Bausteine im laufenden Arbeitsstand nach.
   Aufruf: APP_USER=... APP_PASS=... node .design-sync/shots/detail.mjs      */
import { chromium } from 'playwright';
import { starte } from './server.mjs';

const { server, basis } = await starte(process.cwd());
const b = await chromium.launch({ channel: 'chrome' });
const ctx = await b.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
});
const p = await ctx.newPage();
await p.goto(basis, { waitUntil: 'networkidle' });
await p.waitForTimeout(1200);
await p.fill('input[type="email"]', process.env.APP_USER);
await p.fill('input[type="password"]', process.env.APP_PASS);
await p.click('.auth-submit');
await p.waitForSelector('.app-nav', { timeout: 25000 });
await p.waitForTimeout(2200);

await p.evaluate(() => { document.getElementById('navMore').click(); }); await p.waitForTimeout(400);
 await p.evaluate(() => document.getElementById('moreKader').click());
await p.waitForTimeout(1600);

console.log(await p.evaluate(() => {
  const h1 = document.querySelector('.page-head h1');
  const rows = document.querySelectorAll('.ks-row');
  const chips = document.querySelectorAll('.ks-row .st-choice');
  const leer = document.querySelector('.empty');
  return 'Titel: ' + (h1 ? h1.textContent : '-')
    + ' | Zeilen: ' + rows.length + ' | Chips gesamt: ' + chips.length
    + ' | Hoehe: ' + document.documentElement.scrollHeight
    + (leer ? ' | Hinweis: ' + leer.textContent.trim().slice(0,50) : '');
}));
await b.close();
server.close();
