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
await p.waitForSelector('.app-nav', { timeout:25000 }); await p.waitForTimeout(2000);
await p.evaluate(() => document.querySelector('.nav-btn[data-view="dashboard"]').click());
await p.waitForTimeout(1200);
console.log(await p.evaluate(() => {
  const o = [];
  for (const sel of ['.termin-hero', '.termin-hero .lbl', '.th-top', '.th-body', '.th-title', '.th-time', '.th-count']) {
    const e = document.querySelector(sel); if (!e) { o.push(sel + ': fehlt'); continue; }
    const r = e.getBoundingClientRect(), c = getComputedStyle(e);
    o.push(sel.padEnd(22) + `x=${Math.round(r.x)} y=${Math.round(r.y)} b=${Math.round(r.width)} h=${Math.round(r.height)} disp=${c.display} wrap=${c.flexWrap}`);
  }
  const h = document.querySelector('.termin-hero');
  const cs = h ? getComputedStyle(h, '::before') : null;
  if (cs) o.push('Kante ::before        w=' + cs.width + ' h=' + cs.height + ' left=' + cs.left + ' top=' + cs.top + ' pos=' + cs.position);
  if (h) o.push('Hero border           ' + getComputedStyle(h).borderWidth + ' radius=' + getComputedStyle(h).borderRadius + ' overflow=' + getComputedStyle(h).overflow);
  return o.join('\n');
}));
await b.close(); server.close();
