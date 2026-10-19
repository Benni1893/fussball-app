/* Schneidet die App-Ausschnitte der Einfuehrung genau so aus dem Entwurf,
   wie Claude Design sie zeigt (Bild ganz oder Rahmen mit aspect-ratio und
   top-Versatz), und legt sie als WebP unter assets/einfuehrung/ ab.
   Je Ausschnitt eine Datei; gleiche Quelle mit gleichem Ausschnitt nur einmal.
   Ausgabe zusaetzlich: .design-sync/concepts/einfuehrung/ausschnitte.json
   (Seite -> Dateien, Art "bild" oder "rahmen", Seitenverhaeltnis).
   Aufruf:  node .design-sync/shots/einfuehrungausschnitte.mjs             */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { starte } from './server.mjs';

const ZIEL = 'assets/einfuehrung';
fs.mkdirSync(ZIEL, { recursive: true });
const { server, basis } = await starte(process.cwd());
const b = await chromium.launch({ channel: 'chrome' });
const page = await (await b.newContext({ viewport: { width: 1600, height: 1200 } })).newPage();
await page.goto(basis + '.design-sync/concepts/einfuehrung/entwurf/Einfuehrung.dc.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

const ergebnis = await page.evaluate(async () => {
  const seiten = {};
  const dateien = {};
  for (const fig of document.querySelectorAll('figure[data-screen-label]')) {
    const label = fig.getAttribute('data-screen-label');
    const liste = [];
    for (const img of fig.querySelectorAll('img[src^="ref/"]')) {
      await img.decode().catch(() => {});
      const src = img.getAttribute('src');
      const nw = img.naturalWidth, nh = img.naturalHeight;
      const rahmen = img.style.position === 'absolute' ? img.parentElement : null;
      let sy = 0, sh = nh, art = 'bild', ar = null;
      if (rahmen) {
        // aspect-ratio:780 / 440 und top:calc(-1040 / 440 * 100%) -> Einheiten der 780 px breiten Vorlage
        // Rohes style-Attribut: der Browser rechnet calc() in .style schon aus.
        const m = /aspect-ratio:\s*([\d.]+)\s*\/\s*([\d.]+)/.exec(rahmen.getAttribute('style') || '');
        const t = /top:\s*calc\(-?([\d.]+)\s*\/\s*([\d.]+)/.exec(img.getAttribute('style') || '');
        const bw = +m[1], bh = +m[2];
        // Falls die Laufzeit calc() schon zu einem Prozentwert gemacht hat: % der Rahmenhoehe.
        const p = /top:\s*(?:calc\()?\s*-?([\d.]+)%/.exec(img.getAttribute('style') || '');
        const top = t ? +t[1] : p ? Math.round(+p[1] / 100 * bh) : 0;
        const f = nw / bw;
        sy = Math.round(top * f); sh = Math.round(bh * f); art = 'rahmen'; ar = bw + ' / ' + bh;
      }
      const name = src.replace(/^ref\//, '').replace(/\.png$/, '') + (art === 'rahmen' ? '-' + sy : '');
      if (!dateien[name]) {
        const c = document.createElement('canvas');
        c.width = nw; c.height = sh;
        c.getContext('2d').drawImage(img, 0, sy, nw, sh, 0, 0, nw, sh);
        dateien[name] = { daten: c.toDataURL('image/webp', 0.82), w: nw, h: sh };
      }
      liste.push({ datei: name + '.webp', art, ar: ar || (nw + ' / ' + nh), w: nw, h: sh });
    }
    seiten[label] = liste;
  }
  return { seiten, dateien };
});

let summe = 0;
for (const [name, d] of Object.entries(ergebnis.dateien)) {
  const buf = Buffer.from(d.daten.split(',')[1], 'base64');
  fs.writeFileSync(path.join(ZIEL, name + '.webp'), buf);
  summe += buf.length;
  console.log(name + '.webp', d.w + 'x' + d.h, Math.round(buf.length / 1024) + ' KB');
}
fs.writeFileSync('.design-sync/concepts/einfuehrung/ausschnitte.json', JSON.stringify(ergebnis.seiten, null, 1));
console.log(Object.keys(ergebnis.dateien).length + ' Dateien, ' + Math.round(summe / 1024) + ' KB');
await b.close(); server.close();
