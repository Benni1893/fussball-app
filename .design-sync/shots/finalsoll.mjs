/* Paket „Final Alle Screens“ (Oktober 2026): Soll-Bilder und Soll-Maße.
   Öffnet die gespiegelten Teil-Dateien aus .design-sync/concepts/final-2026-10/referenz/
   (lokal, ohne Netz außer Google Fonts), sucht jeden Rahmen mit data-screen-label
   und schreibt je Screen:
     .design-sync/concepts/final-2026-10/soll/<Label>.png    Bild bei 390 px, Maßstab 1
     .design-sync/concepts/final-2026-10/soll/<Label>.json   Kanten, Schrift, Farben aller
                                                              sichtbaren Elemente mit Text
   Aufruf: node .design-sync/shots/finalsoll.mjs [A B C D E]                     */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { starte } from './server.mjs';

const TEILE = {
  A: 'Final A Übersicht und Kalender.dc.html',
  B: 'Final B Trainer und Kader.dc.html',
  C: 'Final C Konto Kasse Katalog.dc.html',
  D: 'Final D Einstellungen und Anmeldung.dc.html',
  E: 'Final E Unterseiten.dc.html',
};
const wahl = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(TEILE);
const REF = '.design-sync/concepts/final-2026-10/referenz/';
const OUT = path.join(process.cwd(), '.design-sync', 'concepts', 'final-2026-10', 'soll');
fs.mkdirSync(OUT, { recursive: true });

const { server, basis } = await starte();
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
let anzahl = 0;
for (const t of wahl) {
  await page.goto(basis + REF + encodeURIComponent(TEILE[t]), { waitUntil: 'networkidle' });
  // Teil E hat keine data-screen-label: dort traegt die Bildunterschrift den Namen.
  await page.waitForSelector('[data-screen-label], figure > figcaption', { timeout: 20000 });
  await page.evaluate(() => { for (const fig of document.querySelectorAll('figure')) { const cap = fig.querySelector('figcaption'); const rahmen = cap && cap.nextElementSibling; if (rahmen && !rahmen.hasAttribute('data-screen-label')) rahmen.setAttribute('data-screen-label', 'E ' + cap.textContent.trim()); } });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(800);
  const labels = await page.$$eval('[data-screen-label]', (els) => els.map((e) => e.getAttribute('data-screen-label')));
  for (let i = 0; i < labels.length; i++) {
    const el = (await page.$$('[data-screen-label]'))[i];
    if (!(await el.isVisible())) { console.log(t, labels[i], 'unsichtbar, übersprungen'); continue; }
    const name = labels[i].replace(/[\\/:*?"<>|]/g, '-');
    await el.screenshot({ path: path.join(OUT, name + '.png') });
    const masse = await el.evaluate((root) => {
      const r0 = root.getBoundingClientRect();
      const out = [];
      for (const e of root.querySelectorAll('*')) {
        const r = e.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        const cs = getComputedStyle(e);
        const eigenerText = [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(' ').trim();
        const flaeche = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || cs.backgroundImage !== 'none' || cs.borderTopWidth !== '0px';
        if (!eigenerText && !flaeche) continue;
        out.push({
          tag: e.tagName.toLowerCase(), text: eigenerText.slice(0, 60),
          x: Math.round(r.left - r0.left), y: Math.round(r.top - r0.top), w: Math.round(r.width), h: Math.round(r.height),
          fs: cs.fontSize, fw: cs.fontWeight, lh: cs.lineHeight, ls: cs.letterSpacing, farbe: cs.color,
          bg: cs.backgroundColor, bgi: cs.backgroundImage === 'none' ? '' : cs.backgroundImage.slice(0, 160),
          rand: cs.borderTopWidth + ' ' + cs.borderTopColor, radius: cs.borderTopLeftRadius, schatten: cs.boxShadow === 'none' ? '' : cs.boxShadow,
        });
      }
      return { breite: Math.round(r0.width), hoehe: Math.round(r0.height), elemente: out };
    });
    fs.writeFileSync(path.join(OUT, name + '.json'), JSON.stringify(masse, null, 1));
    console.log(t, name, masse.breite + ' x ' + masse.hoehe, masse.elemente.length + ' Elemente');
    anzahl++;
  }
}
await browser.close(); server.close();
console.log('\n' + anzahl + ' Screens nach ' + path.relative(process.cwd(), OUT));
