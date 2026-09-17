/* Liest Kastenmasse aus dem laufenden Arbeitsstand.
   Aufruf: APP_USER=.. APP_PASS=.. node .design-sync/shots/rects.mjs <schritte.json> */
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
const plan = JSON.parse(process.env.PLAN || '{}');
for (const sel of (plan.klicks || [])) { await p.evaluate((s) => { const e = document.querySelector(s); if (e) e.click(); }, sel); await p.waitForTimeout(700); }
console.log(await p.evaluate((sel) => sel.map((s) => {
  const e = document.querySelector(s);
  if (!e) return s.padEnd(26) + 'FEHLT';
  const r = e.getBoundingClientRect(); const c = getComputedStyle(e);
  return s.padEnd(26) + ('y ' + r.top.toFixed(1)).padEnd(10) + ('h ' + r.height.toFixed(1)).padEnd(9)
    + ('x ' + r.left.toFixed(1)).padEnd(9) + ('b ' + r.width.toFixed(1)).padEnd(10)
    + c.fontSize + '/' + c.fontWeight + '  lh ' + c.lineHeight;
}).join('\n'), plan.sel || []));
await b.close(); server.close();
