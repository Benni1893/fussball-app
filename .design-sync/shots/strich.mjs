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
await p.evaluate(() => document.getElementById('navMore').click()); await p.waitForTimeout(400);
await p.evaluate(() => document.getElementById('moreLineup').click()); await p.waitForTimeout(1600);
console.log(await p.evaluate(() => {
  const t = document.querySelector('.tv-mehr');
  if (!t) return 'Umschalter nicht da (weniger als vier Spiele)';
  const c = getComputedStyle(t), pf = t.querySelector('.tv-pfeil');
  return 'Text        : "' + t.textContent.trim() + '"\n'
       + 'Ruhe        : ' + c.textDecorationLine + '\n'
       + 'Pfeil       : ' + (pf ? getComputedStyle(pf).textDecorationLine : '-');
}));
// Hover und Fokus pruefen
await p.hover('.tv-mehr').catch(() => {});
await p.waitForTimeout(150);
console.log('Hover       : ' + await p.evaluate(() => getComputedStyle(document.querySelector('.tv-mehr')).textDecorationLine));
await p.evaluate(() => document.querySelector('.tv-mehr').focus());
await p.waitForTimeout(150);
console.log('Fokus       : ' + await p.evaluate(() => getComputedStyle(document.querySelector('.tv-mehr')).textDecorationLine));
await b.close(); server.close();
