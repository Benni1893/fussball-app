/* Schneidet einen Bereich aus und vergroessert ihn. */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
const [datei, x, y, w, h, faktor, ziel] = process.argv.slice(2);
const b64 = readFileSync(datei).toString('base64');
const br = await chromium.launch({ channel: 'chrome' });
const p = await br.newPage();
await p.setContent('<canvas id="c"></canvas>');
const out = await p.evaluate(async (a) => {
  const img = new Image();
  await new Promise((ok) => { img.onload = ok; img.src = 'data:image/png;base64,' + a.d; });
  const c = document.getElementById('c');
  c.width = a.w * a.f; c.height = a.h * a.f;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(img, a.x, a.y, a.w, a.h, 0, 0, c.width, c.height);
  return c.toDataURL('image/png').split(',')[1];
}, { d: b64, x: +x, y: +y, w: +w, h: +h, f: +faktor });
writeFileSync(ziel, Buffer.from(out, 'base64'));
await br.close();
console.log(ziel);
