/* Liest Masse und Farben aus Vorlage UND Ist-Aufnahme. Jede Zahl aus einem
   Pixelscan, nichts abgeleitet.
   Aufruf: node .design-sync/shots/messtabelle.mjs                             */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const V = readFileSync('.design-sync/reference/termin-und-kalender-v2.png').toString('base64');
const I = readFileSync('.design-sync/reference/compare/ist-geruest.png').toString('base64');

const br = await chromium.launch({ channel: 'chrome' });
const p = await br.newPage();
await p.setContent('<body style="margin:0"></body>');
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
    const hex = (x, y) => { const c2 = rgb(x, y); return '#' + h2(c2[0]) + h2(c2[1]) + h2(c2[2]); };
    const lum = (x, y) => { const c2 = rgb(x, y); return 0.299*c2[0] + 0.587*c2[1] + 0.114*c2[2]; };
    return { rgb, hex, lum, W, H: c.height };
  };
  const A = await mk(o.V), B = await mk(o.I);

  /* Tintenband: erste und letzte Zeile, in der ein Pixel deutlich dunkler ist
     als der hellste Wert des Bereichs. Halbe Zeilen werden mitgezaehlt, wenn
     sie die Haelfte des Maximalkontrasts erreichen.                          */
  const band = (im, x0, x1, y0, y1) => {
    const zeilen = [];
    let hell = 0;
    for (let y = y0; y <= y1; y++) {
      let min = 255;
      for (let x = x0; x <= x1; x++) { const l = im.lum(x, y); if (l < min) min = l; }
      zeilen.push(min); if (255 - min > 0) hell = Math.max(hell, 255 - min);
    }
    const grenze = 255 - hell * 0.5;
    const idx = zeilen.map((m, i) => (m < grenze ? i : -1)).filter((i) => i >= 0);
    return { oben: y0 + idx[0], unten: y0 + idx[idx.length - 1], hoehe: idx.length, roh: zeilen.map(Math.round) };
  };
  /* Waagerechter Lauf einer Farbe: Grenzen eines Kastens in einer Zeile */
  const lauf = (im, y, x0, x1, ist) => {
    let a = null, b = null;
    for (let x = x0; x <= x1; x++) { if (ist(im.rgb(x, y))) { if (a === null) a = x; b = x; } }
    return { links: a, rechts: b, breite: a === null ? null : b - a + 1 };
  };
  const senk = (im, x, y0, y1, ist) => {
    let a = null, b = null;
    for (let y = y0; y <= y1; y++) { if (ist(im.rgb(x, y))) { if (a === null) a = y; b = y; } }
    return { oben: a, unten: b, hoehe: a === null ? null : b - a + 1 };
  };
  const gruen = (c) => c[1] > c[0] + 20 && c[1] > c[2] + 10 && c[1] < 200;
  const weiss = (c) => c[0] > 246 && c[1] > 246 && c[2] > 246;

  return {
    // ---------- Punkt 1: Filterleiste ------------------------------------
    v1: {
      titelBand: band(A, 10, 120, 28, 66),
      behaelterX: lauf(A, 100, 0, 360, weiss),
      behaelterY: senk(A, 300, 66, 132, weiss),      // rechts vom aktiven Segment: nur Behaelter
      segY: senk(A, 40, 66, 132, gruen),
      segX: lauf(A, 98, 0, 360, gruen),
      knopfY: senk(A, 40, 124, 180, gruen),
      farbe: { behaelter: A.hex(300, 98), segTop: A.hex(40, 83), segMit: A.hex(40, 98), segUnten: A.hex(40, 115),
               knopfTop: A.hex(40, 138), knopfUnten: A.hex(40, 172), inaktiv: A.hex(0, 0) },
    },
    i1: {
      titelBand: band(B, 30, 360, 84, 200),
      behaelterX: lauf(B, 300, 0, 1170, weiss),
      behaelterY: senk(B, 900, 350, 560, weiss),
      segY: senk(B, 120, 350, 560, gruen),
      segX: lauf(B, 296, 0, 1170, gruen),
      knopfY: senk(B, 120, 560, 740, gruen),
      farbe: { behaelter: B.hex(900, 400), segTop: B.hex(120, 396), segMit: B.hex(120, 440), segUnten: B.hex(120, 508),
               knopfTop: B.hex(120, 578), knopfUnten: B.hex(120, 700) },
    },
    // ---------- Punkt 2: Plakette ----------------------------------------
    v2: {
      spalte: [], zeile: [],
      farbe: { flaeche: A.hex(805, 54), randOben: A.hex(805, 46), randUnten: A.hex(805, 62),
               randLinks: A.hex(791, 54), kopf: A.hex(770, 54), kopfUnten: A.hex(770, 100) },
      proben: Array.from({ length: 30 }, (_, i) => ({ y: 40 + i, c: A.hex(805, 40 + i) })),
      querproben: Array.from({ length: 60 }, (_, i) => ({ x: 780 + i, c: A.hex(780 + i, 54) })),
    },
    i2: {
      farbe: { flaeche: B.hex(300, 870), kopf: B.hex(250, 870) },
      proben: Array.from({ length: 40 }, (_, i) => ({ y: 815 + i * 2, c: B.hex(310, 815 + i * 2) })),
      querproben: Array.from({ length: 40 }, (_, i) => ({ x: 265 + i * 4, c: B.hex(265 + i * 4, 870) })),
    },
    // ---------- Punkt 3: Zusagen-Block ------------------------------------
    v3: {
      lbl: band(A, 745, 812, 264, 292),
      barY: senk(A, 760, 288, 310, (c) => c[1] > c[0] + 15 && c[1] < 200),
      barSpur: senk(A, 950, 288, 310, (c) => Math.abs(c[0] - 232) < 18 && Math.abs(c[1] - 236) < 18 && c[0] < 246),
      zahlen: band(A, 745, 935, 302, 330),
      offen: band(A, 940, 1010, 264, 292),
    },
    i3: {
      lbl: band(B, 132, 330, 1500, 1580),
      barY: senk(B, 150, 1595, 1640, (c) => c[1] > c[0] + 15 && c[1] < 200),
      barSpur: senk(B, 900, 1590, 1645, (c) => Math.abs(c[0] - 232) < 18 && Math.abs(c[1] - 236) < 18 && c[0] < 246),
      zahlen: band(B, 132, 730, 1625, 1690),
      offen: band(B, 980, 1120, 1500, 1580),
    },
    // ---------- Akzentgruen zum Abgleich ----------------------------------
    akzent: {
      v_kopf: [A.hex(950, 40), A.hex(950, 70), A.hex(950, 100)],
      v_zusage: [A.hex(800, 210), A.hex(800, 226), A.hex(800, 242)],
      i_kopf: [B.hex(900, 790), B.hex(900, 850), B.hex(900, 910)],
      i_zusage: [B.hex(300, 1310), B.hex(300, 1360), B.hex(300, 1410)],
    },
  };
}, { V, I });
console.log(JSON.stringify(out));
await br.close();
