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

await p.evaluate(() => document.querySelector('.nav-btn[data-view="kalender"]').click());
await p.waitForTimeout(1600);

console.log(await p.evaluate(() => {
  const o = [];
  const h = (el) => Math.round(el.getBoundingClientRect().height);
  const c = document.querySelector('.chip');
  const ch = document.querySelector('.chips');
  if (c) {
    o.push('Chip sichtbar   : ' + h(c) + 'px');
    o.push('Chip Treffer    : ' + getComputedStyle(c, '::after').height);
  }
  if (ch) o.push('Filterreihe     : ' + h(ch) + 'px, wrap=' + getComputedStyle(ch).flexWrap);
  const pc = document.querySelector('.page-head + .chips');
  if (pc) o.push('Titel -> Filter : ' + getComputedStyle(pc).marginTop);
  const tr = document.querySelector('.e-trainer');
  if (tr) {
    o.push('Aktionszeile    : ' + h(tr) + 'px');
    o.push('  Inhalt        : ' + [...tr.children]
      .map((x) => x.tagName.toLowerCase() + '.' + String(x.className).split(' ')[0]).join(' + '));
    const ib = tr.querySelector('.icon-btn');
    if (ib) o.push('  Icon-Knopf    : ' + h(ib) + 'px');
    o.push('  Rahmen        : ' + getComputedStyle(tr.querySelector('.link-btn') || tr).borderWidth);
  } else {
    o.push('Aktionszeile    : keine gefunden');
  }
  return o.join('\n');
}));
await b.close();
server.close();
