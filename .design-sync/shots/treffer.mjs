import { chromium } from 'playwright';
import { starte } from './server.mjs';
const { server, basis } = await starte(process.cwd());
const b = await chromium.launch({ channel: 'chrome' });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' });
const p = await ctx.newPage();
await p.goto(basis, { waitUntil: 'networkidle' }); await p.waitForTimeout(1200);
await p.fill('input[type="email"]', process.env.APP_USER);
await p.fill('input[type="password"]', process.env.APP_PASS);
await p.click('.auth-submit'); await p.waitForSelector('.app-nav', { timeout: 25000 }); await p.waitForTimeout(2200);
for (const s of (process.env.KLICKS || '').split(',').filter(Boolean)) {
  await p.evaluate((x) => { const e = document.querySelector(x); if (e) e.click(); }, s); await p.waitForTimeout(800);
}
console.log(await p.evaluate(() => {
  const out = [];
  document.querySelectorAll('#view .sec-mini .link-btn').forEach((e) => {
    const r = e.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const treffer = (dy) => { const t = document.elementFromPoint(cx, cy + dy); return t && (t === e || e.contains(t) || t.closest('.link-btn') === e); };
    out.push(e.textContent.trim() + ': oben ' + (treffer(-21) ? 'ja' : 'nein') + ', unten ' + (treffer(21) ? 'ja' : 'nein'));
  });
  return out.join(' | ');
}));
await b.close(); server.close();
