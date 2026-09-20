/* Prueft den Kalender-Kopf bei 390 px: gleiche Chipbreiten, kein Umbruch,
   kein waagerechtes Scrollen, sichtbare Hoehe und Trefferflaeche.
   Aufruf: node .design-sync/shots/kopfpruef.mjs                              */
import { chromium } from 'playwright';
import path from 'node:path';
import { starte } from './server.mjs';

const { server, basis } = await starte(process.cwd());
const b = await chromium.launch({ channel: 'chrome' });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
await p.setContent(`<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="${basis}/styles.css">
<style>body{margin:0;background:var(--grad-app)}#view{padding:12px 16px}</style>
<main class="view" id="view">
  <div class="page-head"><h1>Kalender</h1></div>
  <div class="kal-seg" role="tablist">
    <button class="kal-seg-b is-on" type="button">Alle</button>
    <button class="kal-seg-b" type="button">Spiele</button>
    <button class="kal-seg-b" type="button">Training</button>
    <button class="kal-seg-b" type="button">Sonstiges</button>
  </div>
</main>`, { waitUntil: 'networkidle' });
await p.waitForTimeout(400);
const mass = await p.evaluate(() => {
  const chips = [...document.querySelectorAll('.kal-seg-b')];
  const zeilen = (el) => {
    const r = document.createRange(); r.selectNodeContents(el);
    const boxen = [...r.getClientRects()].filter((b) => b.width > 0 && b.height > 0);
    const oben = new Set(boxen.map((b) => Math.round(b.top)));
    return oben.size || 1;
  };
  const leiste = document.querySelector('.kal-seg');
  return {
    chips: chips.map((c) => { const r = c.getBoundingClientRect(); return {
      text: c.textContent, b: +r.width.toFixed(2), h: +r.height.toFixed(2),
      zeilen: zeilen(c), ueberlauf: c.scrollWidth > c.clientWidth + 0.5,
      treffer: getComputedStyle(c, '::after').height, textB: (()=>{const r=document.createRange();r.selectNodeContents(c);return +r.getBoundingClientRect().width.toFixed(2);})() }; }),
    leiste: (() => { const r = leiste.getBoundingClientRect(); return { x: +r.left.toFixed(1), b: +r.width.toFixed(2), h: +r.height.toFixed(2) }; })(),
    seiteScrollt: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    scrollBreite: document.documentElement.scrollWidth,
  };
});
console.log(JSON.stringify(mass, null, 1));
await p.screenshot({ path: path.join(process.cwd(), '.design-sync', 'reference', 'compare', 'p2-filterleiste.png'), clip: { x: 0, y: 0, width: 390, height: 210 } });
await b.close(); server.close();
