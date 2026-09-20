/* Prueft die Zeile "In Kalender speichern" in der Terminkarte: vorhanden in
   allen Kartenvarianten, 44px Trefferflaeche, Kontrast, keine Ueberbreite.  */
import { chromium } from 'playwright';
import path from 'node:path';
import { starte } from './server.mjs';
const { server, basis } = await starte(process.cwd());
const b = await chromium.launch({ channel: 'chrome' });
const ctx = await b.newContext({ viewport: { width: 390, height: 900 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
await p.goto(basis + '/.design-sync/cards/Ansichten/Kalender.html', { waitUntil: 'networkidle' });
await p.waitForTimeout(400);
console.log(JSON.stringify(await p.evaluate(() => {
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const zahl = (s) => s.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number);
  const L = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  const K = (a, c) => { const x = L(a), y = L(c), h = Math.max(x, y), l = Math.min(x, y); return +((h + 0.05) / (l + 0.05)).toFixed(2); };
  const karten = [...document.querySelectorAll('.card.tk')];
  return {
    kartenMitLink: karten.filter((k) => k.querySelector('.tk-ics')).length + ' von ' + karten.length,
    letztesKind: karten.every((k) => { const b2 = k.querySelector('.tk-body'); return !b2 || b2.lastElementChild.classList.contains('tk-ics'); }),
    knoepfe: [...document.querySelectorAll('.tk-ics .link-btn')].map((e) => {
      const s = getComputedStyle(e), r = e.getBoundingClientRect();
      return { h: +r.height.toFixed(1), b: +r.width.toFixed(1), fs: s.fontSize,
        kontrast: K(zahl(s.color), [255, 255, 255]), text: e.textContent };
    }),
    seiteScrollt: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  };
}), null, 1));
await p.locator('.card.tk').first().screenshot({ path: path.join(process.cwd(), '.design-sync', 'reference', 'compare', 'p2-ics-link.png') });
await b.close(); server.close();
