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
  const lauf = (im, y, x0, x1, ist) => { let a=null,b=null; for (let x=x0;x<=x1;x++) if (ist(im.rgb(x,y))) { if(a===null)a=x; b=x; } return {l:a,r:b,w:a===null?null:b-a+1}; };
  const senk = (im, x, y0, y1, ist) => { let a=null,b=null; for (let y=y0;y<=y1;y++) if (ist(im.rgb(x,y))) { if(a===null)a=y; b=y; } return {o:a,u:b,h:a===null?null:b-a+1}; };
  const weiss = (c) => c[0]>248 && c[1]>248 && c[2]>248;
  const gr = (c) => c[1]>c[0]+20 && c[1]>c[2]+10 && c[1]<200;
  const spalte = (im, x, y0, y1) => { const r=[]; for (let y=y0;y<=y1;y++) r.push(y+':'+im.hex(x,y)); return r.join(' '); };
  return {
    v_behX: lauf(A, 77, 0, 360, weiss),
    v_kartenX: lauf(A, 150, 700, 1070, weiss),       // Trainer-Spiel-Karte, Koerper weiss
    v_ortkarteX: lauf(A, 160, 700, 1070, (c)=>c[0]>244&&c[1]>244&&c[2]>240),
    v_neuSpalte: spalte(A, 60, 130, 184),
    v_zusageSpalte: spalte(A, 745, 200, 252),
    v_fitSpalte: spalte(A, 380, 393, 446),
    v_zusageX: lauf(A, 226, 700, 1070, gr),
    v_fitX: lauf(A, 418, 356, 710, gr),
    v_segX: lauf(A, 98, 0, 360, gr),
    i_behX: lauf(B, 385, 0, 1170, weiss),
    i_zahlen: band(B, 132, 725, 1632, 1700),
    i_offen: band(B, 700, 1030, 1495, 1580),
    v_offen: band(A, 930, 1030, 264, 292),
    i_lbl: band(B, 132, 325, 1500, 1580),
    v_lbl: band(A, 740, 815, 264, 292),
    v_zahlen: band(A, 740, 940, 303, 330),
    v_barSpalte: spalte(A, 950, 288, 306),
    i_barSpalte: spalte(B, 900, 1598, 1636),
  };
}, { V, I });
console.log(JSON.stringify(out, null, 1));
await br.close();
