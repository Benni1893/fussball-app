/* Diagnose zur Gerätematrix: öffnet einen Zustand der Landkarte und meldet
   für einen Selektor Größe, Mitte und was an den vier Prüfpunkten (±21,5 px)
   liegt. Aufruf:
   node .design-sync/shots/gmdiag.mjs <profil> <schluessel> <selektor> [breite] [schrift] */
import fs from 'node:fs';
import { chromium } from 'playwright';
import { starte } from './server.mjs';
import { installiere, warteAufApp, neuerKontext } from './landkartenmodul.mjs';
import { AUSLOESER, UEBERLAGERUNGEN, zustandImBrowser } from './landkartenregeln.mjs';
import { kandidatenImBrowser } from './landkarte.mjs';

const [profil, schl, sel, breite = '390', schrift = '100'] = process.argv.slice(2);
const lk = JSON.parse(fs.readFileSync('.design-sync/landkarte/landkarte.json', 'utf8'));
const n = lk.profile[profil].knoten.find((k) => k.schluessel === schl);
if (!n) { console.log('Zustand fehlt'); process.exit(2); }
const { server, basis } = await starte(process.cwd());
const b = await chromium.launch({ channel: 'chrome' });
const ctx = await neuerKontext(b);
const page = await ctx.newPage();
await installiere(page, profil);
await page.goto(basis, { waitUntil: 'load' });
await warteAufApp(page);
for (const s of n.pfad) {
  const z = await page.evaluate(zustandImBrowser, UEBERLAGERUNGEN);
  await page.evaluate(kandidatenImBrowser, { ausloeser: AUSLOESER, ueberlagerungen: UEBERLAGERUNGEN, oben: z.oben, istStart: s.global === true, nurArt: s.art, nurWert: s.wert });
  await page.evaluate(() => { const e = document.querySelector('[data-landkarte-ziel]'); e.removeAttribute('data-landkarte-ziel'); e.click(); });
  await page.waitForTimeout(450);
}
await page.setViewportSize({ width: Number(breite), height: 844 });
await page.waitForTimeout(300);
if (schrift !== '100') await page.evaluate((f) => {
  const els = [document.documentElement, ...document.querySelectorAll('body, body *')];
  const w = els.map((e) => [e, parseFloat(getComputedStyle(e).fontSize), getComputedStyle(e).lineHeight]);
  for (const [e, fs, lh] of w) { e.style.setProperty('font-size', fs * f + 'px', 'important'); if (/px$/.test(lh)) e.style.setProperty('line-height', parseFloat(lh) * f + 'px', 'important'); }
}, Number(schrift) / 100);
console.log(await page.evaluate((sel) => {
  const sig = (e) => e ? e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).slice(0, 3).join('.') : '') : '-';
  return [...document.querySelectorAll(sel)].filter((e) => e.getClientRects().length).slice(0, 4).map((el) => {
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect(), cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2;
    const cs = getComputedStyle(el), after = getComputedStyle(el, '::after');
    const p = [[-21.5, 0], [21.5, 0], [0, -21.5], [0, 21.5]].map(([dx, dy]) => sig(document.elementFromPoint(cx + dx, cy + dy)));
    return `${sig(el)} ${Math.round(r.width)}x${Math.round(r.height)} "${(el.innerText || el.value || '').trim().slice(0, 30)}"  ::after ${after.content !== 'none' ? after.height + ' ' + after.position : '-'}\n   L ${p[0]}\n   R ${p[1]}\n   O ${p[2]}\n   U ${p[3]}`;
  }).join('\n');
}, sel));
await b.close(); server.close();
