/* Punkt 1: gewaehlter Zusage-/Absagezustand. Misst die gerechneten Farben am
   gerenderten Knopf und rechnet den WCAG-Kontrast daraus aus.               */
import { chromium } from 'playwright';
import path from 'node:path';
import { starte } from './server.mjs';

const { server, basis } = await starte(process.cwd());
const b = await chromium.launch({ channel: 'chrome' });
const ctx = await b.newContext({ viewport: { width: 390, height: 700 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
const karte = (zu) => `<div class="card tk">
  <div class="tk-kopf"><span class="tk-datum"><span class="d-wd">So</span><span class="d-day num">20</span><span class="d-mon">Sep</span></span>
    <span class="tk-kopf-main"><span class="tk-oben"><span class="tk-bdg">Heim</span><span class="tk-zeit num">12:30 Uhr</span></span>
    <span class="tk-titel">VfB Sparta München</span></span></div>
  <div class="tk-body"><div class="tk-rsvp">
    <button class="tk-btn${zu === 'zu' ? ' is-on' : ''}" type="button">Zusage</button>
    <button class="tk-btn is-ab${zu === 'ab' ? ' is-on' : ''}" type="button">Absage</button>
  </div></div></div>`;
await p.setContent(`<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="${basis}/styles.css">
<style>body{margin:0;background:var(--grad-app)}#view{padding:12px 16px;display:flex;flex-direction:column;gap:12px}</style>
<main class="view" id="view">
  <button class="kal-neu" type="button">Termin hinzufügen</button>
  ${karte('zu')}${karte('ab')}
</main>`, { waitUntil: 'networkidle' });
await p.waitForTimeout(400);
console.log(JSON.stringify(await p.evaluate(() => {
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const zahl = (s) => s.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number);
  const L = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  const K = (a, b) => { const x = L(a), y = L(b), h = Math.max(x, y), l = Math.min(x, y); return +((h + 0.05) / (l + 0.05)).toFixed(2); };
  const info = (el) => { const s = getComputedStyle(el), r = el.getBoundingClientRect();
    return { grund: s.backgroundColor, bild: s.backgroundImage === 'none' ? 'none' : s.backgroundImage,
      schrift: s.color, rand: s.borderTopWidth + ' ' + s.borderTopColor,
      kontrast: (() => { const g = s.backgroundColor.startsWith("rgba(0, 0, 0, 0)") ? s.backgroundImage : s.backgroundColor;
        const stops = g.match(/rgba?([^)]+)/g) || [s.backgroundColor];
        return stops.map((c) => K(zahl(s.color), zahl(c))); })(), h: +r.height.toFixed(1), b: +r.width.toFixed(1) }; };
  const k = [...document.querySelectorAll('.tk-btn')];
  return { zusageGewaehlt: info(k[0]), absageOffen: info(k[1]), zusageOffen: info(k[2]), absageGewaehlt: info(k[3]),
           primaer: (() => { const s = getComputedStyle(document.querySelector('.kal-neu')); return { bild: s.backgroundImage, schrift: s.color }; })() };
}), null, 1));
await p.screenshot({ path: path.join(process.cwd(), '.design-sync', 'reference', 'compare', 'p1-rsvp.png'), clip: { x: 0, y: 0, width: 390, height: 460 } });
await b.close(); server.close();
