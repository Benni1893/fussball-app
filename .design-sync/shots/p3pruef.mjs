/* Punkt 3: Plakette HEIM/AUSWAERTS. Liest die gerechneten Farben und die
   tatsaechliche Pixelfarbe der Flaeche, rechnet den Kontrast aus.           */
import { chromium } from 'playwright';
import path from 'node:path';
import { starte } from './server.mjs';
const { server, basis } = await starte(process.cwd());
const b = await chromium.launch({ channel: 'chrome' });
const ctx = await b.newContext({ viewport: { width: 390, height: 500 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
await p.setContent(`<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="${basis}/styles.css">
<style>body{margin:0;background:var(--grad-app)}#view{padding:12px 16px;display:flex;flex-direction:column;gap:12px}</style>
<main class="view" id="view">
 <div class="card tk"><div class="tk-kopf">
   <span class="tk-datum"><span class="d-wd">So</span><span class="d-day num">20</span><span class="d-mon">Sep</span></span>
   <span class="tk-kopf-main"><span class="tk-oben"><span class="tk-bdg">Heim</span><span class="tk-zeit num">12:30 Uhr</span></span>
   <span class="tk-titel">VfB Sparta München</span></span>
   <button class="tk-menue" type="button">⋯</button></div></div>
 <div class="card tk"><div class="tk-kopf">
   <span class="tk-datum"><span class="d-wd">Sa</span><span class="d-day num">27</span><span class="d-mon">Sep</span></span>
   <span class="tk-kopf-main"><span class="tk-oben"><span class="tk-bdg">Auswärts</span><span class="tk-zeit num">10:00 Uhr</span></span>
   <span class="tk-titel">FT München-Gern 2</span></span></div></div>
</main>`, { waitUntil: 'networkidle' });
await p.waitForTimeout(400);
console.log(JSON.stringify(await p.evaluate(() => {
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const zahl = (s) => s.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number);
  const L = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  const K = (a, b) => { const x = L(a), y = L(b), h = Math.max(x, y), l = Math.min(x, y); return +((h + 0.05) / (l + 0.05)).toFixed(2); };
  return [...document.querySelectorAll('.tk-bdg')].map((e) => {
    const s = getComputedStyle(e), r = e.getBoundingClientRect();
    return { text: e.textContent, h: +r.height.toFixed(1), b: +r.width.toFixed(1),
      flaeche: s.backgroundColor, rand: s.borderTopWidth + ' ' + s.borderTopColor, schrift: s.color,
      kontrast: K(zahl(s.color), zahl(s.backgroundColor)),
      randGegenFlaeche: K(zahl(s.borderTopColor), zahl(s.backgroundColor)) };
  });
}), null, 1));
await p.screenshot({ path: path.join(process.cwd(), '.design-sync', 'reference', 'compare', 'p3-plakette.png'), clip: { x: 0, y: 0, width: 390, height: 230 } });
await b.close(); server.close();
