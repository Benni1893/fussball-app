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
const zeig = async (name) => console.log('\n' + name + '\n' + await p.evaluate(() => {
  const r = document.querySelector('.chips');
  if (!r) return '  keine Filterreihe';
  const cs = [...r.querySelectorAll('.chip')];
  const summe = cs.reduce((a, c) => a + c.getBoundingClientRect().width, 0) + (cs.length - 1) * 7;
  return cs.map((c) => '  ' + ('"' + c.textContent.trim() + '"').padEnd(20)
      + Math.round(c.getBoundingClientRect().width) + 'px').join('\n')
    + '\n  ' + 'Summe inkl. Luecken'.padEnd(20) + Math.round(summe) + 'px'
    + '   verfuegbar: ' + Math.round(r.getBoundingClientRect().width) + 'px'
    + '   -> ' + (summe <= r.getBoundingClientRect().width ? 'passt' : 'passt NICHT');
}));
await p.evaluate(() => document.querySelector('.nav-btn[data-view="strafen"]').click()); await p.waitForTimeout(1500);
await zeig('Konto');
await p.evaluate(() => document.getElementById('navMore').click()); await p.waitForTimeout(400);
await p.evaluate(() => document.getElementById('moreKasse').click()); await p.waitForTimeout(1500);
await zeig('Kasse');
await p.evaluate(() => document.querySelector('.nav-btn[data-view="kalender"]').click()); await p.waitForTimeout(1500);
await zeig('Kalender');
await b.close(); server.close();
