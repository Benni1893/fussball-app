import { chromium } from 'playwright';
import { starte } from './server.mjs';
const { server, basis } = await starte(process.cwd());
const b = await chromium.launch({ channel: 'chrome' });
const ctx = await b.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:3, isMobile:true, hasTouch:true,
  userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' });
const p = await ctx.newPage();
await p.goto(basis, { waitUntil:'networkidle' }); await p.waitForTimeout(1200);
console.log(await p.evaluate(() => {
  const out = [];
  let el = document.querySelector('.auth-card');
  while (el && el !== document.documentElement) {
    const c = getComputedStyle(el), r = el.getBoundingClientRect();
    out.push(`${el.tagName.toLowerCase()}${el.id?'#'+el.id:''}${el.className?'.'+String(el.className).split(' ').join('.'):''}`
      + ` b=${Math.round(r.width*10)/10} pad=${c.paddingLeft}/${c.paddingRight} maxw=${c.maxWidth}`);
    el = el.parentElement;
  }
  return out.join('\n');
}));
await b.close(); server.close();
