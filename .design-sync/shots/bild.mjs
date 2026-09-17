/* Misst Farben und Abstaende direkt aus einer Bilddatei.
   Aufruf: node .design-sync/shots/bild.mjs <pfad> [befehl...]                  */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const datei = process.argv[2];
const b64 = readFileSync(datei).toString('base64');
const br = await chromium.launch({ channel: 'chrome' });
const p = await br.newPage();
await p.setContent('<canvas id="c"></canvas>');
await p.evaluate(async (d) => {
  const img = new Image();
  await new Promise((ok) => { img.onload = ok; img.src = 'data:image/png;base64,' + d; });
  const c = document.getElementById('c');
  c.width = img.width; c.height = img.height;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0);
  const dat = g.getImageData(0, 0, c.width, c.height).data;
  window.W = c.width; window.H = c.height; window.D = dat;
  window.hex = (x, y) => {
    const i = (Math.round(y) * c.width + Math.round(x)) * 4;
    const h = (n) => n.toString(16).padStart(2, '0');
    return '#' + h(dat[i]) + h(dat[i + 1]) + h(dat[i + 2]);
  };
  // Alle Farbwechsel entlang einer Spalte oder Zeile
  window.kanten = (fest, von, bis, achse) => {
    const out = []; let vor = null;
    for (let i = von; i <= bis; i++) {
      const f = achse === 'y' ? window.hex(fest, i) : window.hex(i, fest);
      if (vor !== null && f !== vor) out.push({ bei: i, von: vor, zu: f });
      vor = f;
    }
    return out;
  };
}, b64);

const befehl = process.argv.slice(3).join(' ');
if (befehl) console.log(JSON.stringify(await p.evaluate(befehl), null, 1));
else console.log(await p.evaluate(() => window.W + 'x' + window.H));
await br.close();
