/* Vergleicht Bandlagen zwischen Vorlage (trainer-sheet-v2.png) und einem
   App-Screenshot. Der App-Schuss wird auf denselben Massstab 0,9 gerechnet,
   damit die Kantenglaettung gleich breit ausfaellt und die Zahlen vergleichbar
   sind. Aufruf:
     node .design-sync/shots/vergleich.mjs <appshot> <rahmen:1|2> <vonCss> <bisCss> [x0] [x1] [grund] */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const [appShot, rahmen, von, bis, x0 = '16', x1 = '374', grund = ''] = process.argv.slice(2);
const vorlage = readFileSync('.design-sync/reference/trainer-sheet-v2.png').toString('base64');
const app = readFileSync(appShot).toString('base64');

const br = await chromium.launch({ channel: 'chrome' });
const p = await br.newPage();
await p.setContent('<canvas id="a"></canvas><canvas id="b"></canvas>');
const erg = await p.evaluate(async (o) => {
  const lade = (d) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = 'data:image/png;base64,' + d; });
  const S = 0.9;                       // Massstab der Vorlage
  const L = o.rahmen === '1' ? 82 : 465, T = 23;

  // --- Vorlage ---
  const iv = await lade(o.vorlage);
  const ca = document.getElementById('a'); ca.width = iv.width; ca.height = iv.height;
  const ga = ca.getContext('2d', { willReadFrequently: true }); ga.drawImage(iv, 0, 0);
  const da = ga.getImageData(0, 0, ca.width, ca.height).data;
  const pxV = (x, y) => { const i = (Math.round(y) * ca.width + Math.round(x)) * 4; return [da[i], da[i+1], da[i+2]]; };

  // --- App, auf 0,9 heruntergerechnet ---
  const ia = await lade(o.app);
  const cb = document.getElementById('b');
  cb.width = Math.round(390 * S); cb.height = Math.round(ia.height / ia.width * 390 * S);
  const gb = cb.getContext('2d', { willReadFrequently: true });
  gb.drawImage(ia, 0, 0, cb.width, cb.height);
  const db = gb.getImageData(0, 0, cb.width, cb.height).data;
  const pxA = (x, y) => { const i = (Math.round(y) * cb.width + Math.round(x)) * 4; return [db[i], db[i+1], db[i+2]]; };

  const baender = (px, ox, oy, vonC, bisC) => {
    const a = Math.round(ox + o.x0 * S), b = Math.round(ox + o.x1 * S);
    const fest = o.grund ? [1,3,5].map(i => parseInt(o.grund.slice(i, i+2), 16)) : null;
    const out = []; let s = null;
    for (let y = Math.round(oy + vonC * S); y <= Math.round(oy + bisC * S); y++) {
      const gr = fest || px(Math.max(0, ox + 3), y);
      let voll = false;
      for (let x = a; x < b; x++) {
        const c = px(x, y);
        if (Math.abs(c[0]-gr[0])>7 || Math.abs(c[1]-gr[1])>7 || Math.abs(c[2]-gr[2])>7) { voll = true; break; }
      }
      if (voll && s === null) s = y;
      if (!voll && s !== null) { out.push([+(((s-oy)/S).toFixed(1)), +(((y-1-oy)/S).toFixed(1))]); s = null; }
    }
    if (s !== null) out.push([+(((s-oy)/S).toFixed(1)), bisC]);
    return out;
  };
  return { vorlage: baender(pxV, L, T, +o.von, +o.bis), app: baender(pxA, 0, 0, +o.von, +o.bis) };
}, { vorlage, app, rahmen, von, bis, x0: +x0, x1: +x1, grund });

const zeile = (n, b) => n.padEnd(8) + b.map(([a, c]) => a.toFixed(1) + '..' + c.toFixed(1) + ' (h ' + (c - a + 1.1).toFixed(1) + ')').join('   ');
console.log(zeile('Vorlage', erg.vorlage));
console.log(zeile('App', erg.app));
const hoehen = (b) => b.map((x) => +(x[1] - x[0] + 1.1).toFixed(1));
const luecken = (b) => b.map((x, i) => (i ? +(x[0] - b[i-1][1] - 1.1).toFixed(1) : 0));
console.log('Hoehe V ', hoehen(erg.vorlage).join('  '));
console.log('Hoehe A ', hoehen(erg.app).join('  '));
console.log('Luecke V', luecken(erg.vorlage).join('  '));
console.log('Luecke A', luecken(erg.app).join('  '));
await br.close();
