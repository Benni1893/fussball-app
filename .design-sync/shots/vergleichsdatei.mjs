/* Legt denselben Ausschnitt aus Vorlage und Ist-Aufnahme nebeneinander.
   Beide werden ueber die angegebene Referenzbreite auf denselben Massstab
   gebracht, damit man Pixel gegen Pixel halten kann.
   Aufruf: node .design-sync/shots/vergleichsdatei.mjs <name> <Vx,Vy,Vw,Vh,Vskala> <Ix,Iy,Iw,Ih,Iskala> */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const [name, vSpec, iSpec] = process.argv.slice(2);
const z = (s) => s.split(',').map(Number);
const [vx, vy, vw, vh, vs] = z(vSpec);
const [ix, iy, iw, ih, is] = z(iSpec);
const ZIEL = 2;                       // gemeinsamer Massstab: 2 Bildpunkte je CSS-Pixel

const vorlage = fs.readFileSync('.design-sync/reference/termin-und-kalender-v2.png').toString('base64');
const ist     = fs.readFileSync('.design-sync/reference/compare/ist-geruest.png').toString('base64');

const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage();
await p.setContent('<body style="margin:0"><canvas id="c"></canvas></body>');
const daten = await p.evaluate(async (o) => {
  const lade = (d) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = 'data:image/png;base64,' + d; });
  const A = await lade(o.vorlage), B = await lade(o.ist);
  const bw = Math.round(o.vw / o.vs * o.ziel), bh = Math.round(o.vh / o.vs * o.ziel);
  const cw = Math.round(o.iw / o.is * o.ziel), ch = Math.round(o.ih / o.is * o.ziel);
  const H = Math.max(bh, ch) + 34, W = bw + cw + 36;
  const c = document.getElementById('c'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#eceeed'; g.fillRect(0, 0, W, H);
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  g.drawImage(A, o.vx, o.vy, o.vw, o.vh, 12, 26, bw, bh);
  g.drawImage(B, o.ix, o.iy, o.iw, o.ih, bw + 24, 26, cw, ch);
  g.fillStyle = '#1c2620'; g.font = '700 13px Inter, system-ui, sans-serif';
  g.fillText('VORLAGE', 12, 17);
  g.fillText('IST (Gerüst)', bw + 24, 17);
  return c.toDataURL('image/png').split(',')[1];
}, { vorlage, ist, vx, vy, vw, vh, vs, ix, iy, iw, ih, is, ziel: ZIEL });
fs.mkdirSync('.design-sync/reference/compare', { recursive: true });
const ziel = path.join('.design-sync', 'reference', 'compare', name + '.png');
fs.writeFileSync(ziel, Buffer.from(daten, 'base64'));
console.log(ziel);
await b.close();
