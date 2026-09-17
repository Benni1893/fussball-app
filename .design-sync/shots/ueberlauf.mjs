/* Misst, warum eine Filterreihe seitlich scrollt: scrollWidth gegen clientWidth
   und welche Kinder ueber den Inhaltsbereich hinausragen.                     */
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

const pruefe = async (name) => {
  const r = await p.evaluate(() => {
    const el = document.querySelector('.chips');
    if (!el) return null;
    const c = getComputedStyle(el), b = el.getBoundingClientRect();
    const innenL = parseFloat(c.paddingLeft), innenR = parseFloat(c.paddingRight);
    const inhalt = b.width - innenL - innenR;
    const kinder = [...el.children].map((k) => {
      const kb = k.getBoundingClientRect(), kc = getComputedStyle(k);
      return { text: (k.textContent || '').trim().slice(0, 18) || '(leer)',
               breite: Math.round(kb.width * 10) / 10,
               rechts: Math.round((kb.right - (b.left + innenL)) * 10) / 10,
               shrink: kc.flexShrink, tag: k.tagName.toLowerCase() };
    });
    return {
      box: Math.round(b.width), scrollWidth: el.scrollWidth, clientWidth: el.clientWidth,
      innen: c.paddingLeft + ' / ' + c.paddingRight,
      aussen: c.marginLeft + ' / ' + c.marginRight,
      overflowX: c.overflowX, touch: c.touchAction, snap: c.scrollSnapType,
      inhaltsbreite: Math.round(inhalt), kinder,
      vorher: getComputedStyle(el, '::before').content, nachher: getComputedStyle(el, '::after').content,
    };
  });
  console.log('\n=== ' + name + ' ===');
  if (!r) { console.log('  keine Filterreihe'); return; }
  console.log('  Box ' + r.box + 'px, Innenabstand ' + r.innen + ', Aussenrand ' + r.aussen);
  console.log('  Inhaltsbereich (clientWidth) ' + r.clientWidth + 'px   scrollWidth ' + r.scrollWidth + 'px'
    + '   -> ' + (r.scrollWidth > r.clientWidth ? 'UEBERLAUF um ' + (r.scrollWidth - r.clientWidth) + 'px' : 'kein Ueberlauf'));
  console.log('  overflow-x=' + r.overflowX + '  touch-action=' + r.touch + '  scroll-snap=' + r.snap);
  console.log('  Pseudo-Elemente: ::before=' + r.vorher + '  ::after=' + r.nachher);
  for (const k of r.kinder) {
    const raus = k.rechts > r.clientWidth;
    console.log('    ' + ('"' + k.text + '"').padEnd(22) + k.breite + 'px, endet bei ' + k.rechts + 'px'
      + ' shrink=' + k.shrink + (raus ? '   <== ragt hinaus' : ''));
  }
};
const wisch = async (name) => {
  const vor = await p.evaluate(() => document.querySelector('.chips').scrollLeft);
  const box = await p.evaluate(() => { const b = document.querySelector('.chips').getBoundingClientRect();
    return { x: Math.round(b.left + b.width * 0.8), y: Math.round(b.top + b.height / 2) }; });
  // echter horizontaler Wisch nach links
  await p.mouse.move(box.x, box.y);
  await p.mouse.down();
  for (let i = 1; i <= 8; i++) await p.mouse.move(box.x - i * 20, box.y);
  await p.mouse.up();
  await p.waitForTimeout(250);
  const nachWisch = await p.evaluate(() => document.querySelector('.chips').scrollLeft);
  // Zusatzprobe: laesst es sich ueberhaupt programmatisch schieben?
  const erzwungen = await p.evaluate(() => {
    const el = document.querySelector('.chips');
    el.scrollLeft = 300;
    return el.scrollLeft;
  });
  console.log('  Wisch: scrollLeft ' + vor + ' -> ' + nachWisch
    + ' | erzwungen -> ' + erzwungen
    + (nachWisch === vor && erzwungen === 0 ? '   UNVERSCHIEBBAR' : '   VERSCHIEBT SICH'));
};

await p.evaluate(() => document.querySelector('.nav-btn[data-view="strafen"]').click()); await p.waitForTimeout(1500);
await pruefe('Konto'); await wisch('Konto');
await p.evaluate(() => document.getElementById('navMore').click()); await p.waitForTimeout(400);
await p.evaluate(() => document.getElementById('moreKasse').click()); await p.waitForTimeout(1500);
await pruefe('Kasse'); await wisch('Kasse');
await p.evaluate(() => document.querySelector('.nav-btn[data-view="kalender"]').click()); await p.waitForTimeout(1500);
await pruefe('Kalender'); await wisch('Kalender');
await b.close(); server.close();
