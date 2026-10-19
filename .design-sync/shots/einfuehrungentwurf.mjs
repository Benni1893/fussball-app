/* Liest den Entwurf der Einfuehrung (Claude Design, gespiegelt nach
   .design-sync/concepts/einfuehrung/entwurf/Einfuehrung.dc.html): je Seite
   (data-screen-label) ein Bild und der Text, dazu gelbe Markierungen.
   Ausgabe: .design-sync/concepts/einfuehrung/soll/<label>.png + soll.json
   Aufruf:  node .design-sync/shots/einfuehrungentwurf.mjs                  */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { starte } from './server.mjs';
const AUS = '.design-sync/concepts/einfuehrung/soll';
fs.mkdirSync(AUS, { recursive: true });
const { server, basis } = await starte(process.cwd());
const b = await chromium.launch({ channel: 'chrome' });
const page = await (await b.newContext({ viewport: { width: 1600, height: 1200 }, deviceScaleFactor: 1 })).newPage();
await page.goto(basis + '.design-sync/concepts/einfuehrung/entwurf/Einfuehrung.dc.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.evaluate(() => document.fonts.ready);
const liste = await page.evaluate(() => [...document.querySelectorAll('[data-screen-label]')].map((e, i) => {
  e.setAttribute('data-ew-nr', String(i));
  const r = e.getBoundingClientRect();
  // gelb markiert: Hintergrund/Rand in Gelbtönen
  const gelb = [...e.querySelectorAll('*')].filter((x) => { const cs = getComputedStyle(x); return /rgb\((2[3-5]\d), (2[0-5]\d), (\d{1,2}|1\d\d)\)/.test(cs.backgroundColor) && x.innerText && x.innerText.trim().length > 3; })
    .map((x) => x.innerText.trim().replace(/\s+/g, ' ')).filter((t, j, a) => a.indexOf(t) === j).slice(0, 20);
  return { nr: i, label: e.getAttribute('data-screen-label'), w: Math.round(r.width), h: Math.round(r.height), text: e.innerText.trim(), gelb };
}));
for (const s of liste) {
  const el = await page.$(`[data-ew-nr="${s.nr}"]`);
  try { await el.screenshot({ path: path.join(AUS, s.label.replace(/[^\wäöüÄÖÜß() -]/g, '').replace(/\s+/g, '_') + '.png') }); } catch (e) { s.bildFehler = e.message.split('\n')[0]; }
}
fs.writeFileSync(path.join(AUS, 'soll.json'), JSON.stringify(liste, null, 1));
console.log(liste.map((s) => s.label + ' ' + s.w + 'x' + s.h).join('\n'));
await b.close(); server.close();
