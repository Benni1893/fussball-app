import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const V = readFileSync('.design-sync/reference/termin-und-kalender-v2.png').toString('base64');
const I = readFileSync('.design-sync/reference/compare/ist-geruest.png').toString('base64');
const br = await chromium.launch({ channel: 'chrome' });
const p = await br.newPage();
await p.setContent('<body></body>');
const out = await p.evaluate(async (o) => {
  const mk = async (d) => {
    const img = new Image();
    await new Promise((ok) => { img.onload = ok; img.src = 'data:image/png;base64,' + d; });
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0);
    const D = g.getImageData(0, 0, c.width, c.height).data, W = c.width;
    const rgb = (x, y) => { const i = (Math.round(y) * W + Math.round(x)) * 4; return [D[i], D[i+1], D[i+2]]; };
    const h2 = (n) => n.toString(16).padStart(2, '0');
    const hex = (x, y) => { const q = rgb(x, y); return '#' + h2(q[0]) + h2(q[1]) + h2(q[2]); };
    const lum = (x, y) => { const q = rgb(x, y); return 0.299*q[0] + 0.587*q[1] + 0.114*q[2]; };
    return { rgb, hex, lum };
  };
  const A = await mk(o.V), B = await mk(o.I);
  const band = (im, x0, x1, y0, y1) => {
    const z = []; let sp = 0;
    for (let y = y0; y <= y1; y++) { let m = 255; for (let x = x0; x <= x1; x++) { const l = im.lum(x, y); if (l < m) m = l; } z.push(m); sp = Math.max(sp, 255 - m); }
    const gr = 255 - sp * 0.5;
    const idx = z.map((m, i) => (m < gr ? i : -1)).filter((i) => i >= 0);
    return { oben: y0 + idx[0], unten: y0 + idx[idx.length - 1], n: idx.length };
  };
  const spalte = (im, x, y0, y1) => { const r=[]; for (let y=y0;y<=y1;y++) r.push(y+':'+im.hex(x,y)); return r.join(' '); };
  const zeile  = (im, y, x0, x1) => { const r=[]; for (let x=x0;x<=x1;x++) r.push(x+':'+im.hex(x,y)); return r.join(' '); };
  return {
    i_h1: band(B, 48, 1122, 240, 350),
    v_h1: band(A, 8, 340, 28, 66),
    // AUSWAERTS-Plakette in der Spieler-Spiel-Karte
    aus_spalte: spalte(A, 100, 640, 672),
    aus_zeile: zeile(A, 655, 60, 170),
    kopf_um_aus: [A.hex(50, 655), A.hex(180, 655), A.hex(50, 640), A.hex(50, 672)],
  };
}, { V, I });
console.log(JSON.stringify(out, null, 1));
await br.close();
