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

await p.evaluate(() => document.querySelector('.nav-btn[data-view="strafen"]').click());
await p.waitForTimeout(1600);

console.log(await p.evaluate(() => {
  const o = [], h = (el) => Math.round(el.getBoundingClientRect().height);
  const k = document.querySelector('.kpi');
  if (k) { const c = getComputedStyle(k);
    o.push('Kennzahl        : ' + h(k) + 'px, innen ' + c.paddingTop + '/' + c.paddingLeft); }
  const ch = document.querySelector('.kpi-grid + .chips');
  if (ch) { const r1 = document.querySelector('.kpi-grid').getBoundingClientRect(), r2 = ch.getBoundingClientRect();
    o.push('Kacheln -> Chips: ' + Math.round(r2.top - r1.bottom) + 'px Luft, z-index=' + getComputedStyle(ch).zIndex); }
  const l = document.querySelector('.fine-list');
  if (l) { const r1 = document.querySelector('.chips').getBoundingClientRect();
    o.push('Chips -> Liste  : ' + Math.round(l.getBoundingClientRect().top - r1.bottom) + 'px'); }
  return o.join('\n');
}));
await b.close();
server.close();
