/* Bandanalyse eines App-Screenshots (390 CSS breit, beliebiger Faktor).
   Grundfarbe je Zeile = Pixel bei x=3 (Rand), damit ein Verlauf nicht stoert.
   Aufruf: node .design-sync/shots/appbild.mjs <pfad> <vonCss> <bisCss> [x0] [x1] [grundHex] */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const [datei, von, bis, x0 = '16', x1 = '374', grund = ''] = process.argv.slice(2);
const b64 = readFileSync(datei).toString('base64');
const br = await chromium.launch({ channel: 'chrome' });
const p = await br.newPage();
await p.setContent('<canvas id="c"></canvas>');
console.log(JSON.stringify(await p.evaluate(async (a) => {
  const img = new Image();
  await new Promise((ok) => { img.onload = ok; img.src = 'data:image/png;base64,' + a.d; });
  const c = document.getElementById('c'); c.width = img.width; c.height = img.height;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
  const dat = g.getImageData(0, 0, c.width, c.height).data;
  const S = img.width / 390;
  const at = (x, y) => { const i = (Math.round(y) * c.width + Math.round(x)) * 4; return [dat[i], dat[i+1], dat[i+2]]; };
  const fest = a.grund ? [parseInt(a.grund.slice(1,3),16), parseInt(a.grund.slice(3,5),16), parseInt(a.grund.slice(5,7),16)] : null;
  const out = []; let s = null;
  for (let y = Math.round(a.von*S); y <= Math.round(a.bis*S); y++) {
    const gr = fest || at(3, y);
    let voll = false;
    for (let x = Math.round(a.x0*S); x < Math.round(a.x1*S); x++) {
      const [r,gg,b] = at(x,y);
      if (Math.abs(r-gr[0])>7||Math.abs(gg-gr[1])>7||Math.abs(b-gr[2])>7) { voll = true; break; }
    }
    if (voll && s===null) s = y;
    if (!voll && s!==null) { out.push((s/S).toFixed(1)+'..'+((y-1)/S).toFixed(1)+' h='+((y-s)/S).toFixed(1)); s = null; }
  }
  if (s!==null) out.push((s/S).toFixed(1)+'..'+(+a.bis).toFixed(1));
  return out;
}, { d: b64, von: +von, bis: +bis, x0: +x0, x1: +x1, grund })));
await br.close();
