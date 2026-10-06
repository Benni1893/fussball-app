/* Paket „Final Alle Screens“: Pixelabgleich Soll | Ist.
   Soll: .design-sync/concepts/final-2026-10/soll/<Screen>.png/.json (finalsoll.mjs).
   Ist:  App über den Landkarten-Stand-in (keine Datenbank), 390 px breit, Maßstab 1,
         Fensterhöhe = Höhe des Soll-Bilds (Kopfzeile oben, Bottom-Nav unten wie in der
         Vorlage). Gemessen werden dieselben Werte wie im Soll (Kanten, Schrift, Farben).
   Zuordnung: Elemente mit gleichem eigenem Text (Reihenfolge innerhalb gleicher Texte).
   Ausgabe je Screen:
     .design-sync/concepts/final-2026-10/ist/<Screen>.png        Ist-Bild
     .design-sync/concepts/final-2026-10/vergleich/<Screen>.png  Soll | Ist
     Konsole: Abweichungen > Toleranz (Kanten ±1 px, Schrift exakt, Farben exakt)
   Aufruf: node .design-sync/shots/finalmess.mjs "01 Übersicht" ["02 Kalender" …] | alle
   Rückgabewert 0 nur, wenn alle gewählten Screens innerhalb der Toleranz liegen und kein
   Request an Supabase ging.                                                          */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { starte } from './server.mjs';
import { installiere, warteAufApp } from './landkartenmodul.mjs';
import { SCREENS } from './finalscreens.mjs';

const BASIS = path.join(process.cwd(), '.design-sync', 'concepts', 'final-2026-10');
const SOLL = path.join(BASIS, 'soll'), IST = path.join(BASIS, 'ist'), VGL = path.join(BASIS, 'vergleich');
for (const d of [IST, VGL]) fs.mkdirSync(d, { recursive: true });
const TOL = Number(process.env.TOL || 1);

let wahl = process.argv.slice(2);
if (!wahl.length || wahl[0] === 'alle') wahl = Object.keys(SCREENS);

function messeImBrowser(sel) {
  const root = sel ? document.querySelector(sel) : document.body;
  const r0 = { left: 0, top: 0 };
  const out = [];
  for (const e of root.querySelectorAll('*')) {
    const r = e.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const cs = getComputedStyle(e);
    if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) continue;
    const eigenerText = [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(' ').trim();
    const flaeche = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || cs.backgroundImage !== 'none' || cs.borderTopWidth !== '0px';
    if (!eigenerText && !flaeche) continue;
    out.push({
      tag: e.tagName.toLowerCase(), text: eigenerText.slice(0, 60), cls: (e.className && e.className.baseVal === undefined ? e.className : '') || '',
      x: Math.round(r.left - r0.left), y: Math.round(r.top - r0.top), w: Math.round(r.width), h: Math.round(r.height),
      fs: cs.fontSize, fw: cs.fontWeight, lh: cs.lineHeight, ls: cs.letterSpacing, farbe: cs.color,
      bg: cs.backgroundColor, bgi: cs.backgroundImage === 'none' ? '' : cs.backgroundImage.slice(0, 160),
      rand: cs.borderTopWidth + ' ' + cs.borderTopColor, radius: cs.borderTopLeftRadius, schatten: cs.boxShadow === 'none' ? '' : cs.boxShadow,
    });
  }
  return { breite: 390, hoehe: Math.round(document.documentElement.scrollHeight), elemente: out };
}

// Soll-Rahmen sind 392 breit (1 px Rand je Seite): Soll-Koordinaten um 1 verschieben.
function vergleiche(soll, ist, ausnahmen) {
  const nachText = (liste) => {
    const m = new Map();
    for (const e of liste) { if (!e.text) continue; const k = e.text; if (!m.has(k)) m.set(k, []); m.get(k).push(e); }
    return m;
  };
  const S = nachText(soll.elemente.map((e) => ({ ...e, x: e.x - 1, y: e.y - 1 }))), I = nachText(ist.elemente);
  const befunde = [], fehlend = [], gefunden = [];
  for (const [text, liste] of S) {
    const il = I.get(text) || [];
    liste.forEach((s, i) => {
      const t = il[i];
      if (!t) { fehlend.push(text); return; }
      gefunden.push(text);
      if ((ausnahmen || []).some((a) => text.includes(a))) return;
      const d = [];
      for (const k of ['x', 'y', 'w', 'h']) if (Math.abs(s[k] - t[k]) > TOL) d.push(k + ' ' + s[k] + '→' + t[k]);
      for (const k of ['fs', 'fw', 'farbe', 'ls']) if (s[k] !== t[k]) d.push(k + ' ' + s[k] + '→' + t[k]);
      if (d.length) befunde.push('"' + text + '": ' + d.join(', '));
    });
  }
  return { befunde, fehlend, gefunden };
}

const { server, basis } = await starte(process.cwd());
const browser = await chromium.launch();
const leinwand = await browser.newPage();
let alleGruen = true;
for (const name of wahl) {
  const cfg = SCREENS[name];
  const sollJson = path.join(SOLL, name + '.json');
  if (!cfg) { console.log('FEHL ' + name + ': keine Messvorschrift in finalscreens.mjs'); alleGruen = false; continue; }
  if (!fs.existsSync(sollJson)) { console.log('FEHL ' + name + ': kein Soll (finalsoll.mjs laufen lassen)'); alleGruen = false; continue; }
  const soll = JSON.parse(fs.readFileSync(sollJson, 'utf8'));
  const hoehe = cfg.hoehe || (soll.hoehe - 2);
  const ctx = await browser.newContext({ viewport: { width: 390, height: hoehe }, deviceScaleFactor: 1, isMobile: true, hasTouch: true,
    locale: 'de-DE', timezoneId: 'Europe/Berlin', serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const inst = await installiere(page, cfg.profil);
  await page.goto(basis, { waitUntil: 'networkidle' });
  await warteAufApp(page);
  if (cfg.vorbereitung) await cfg.vorbereitung(page);
  await page.waitForTimeout(cfg.warte || 400);
  const ist = await page.evaluate(messeImBrowser, cfg.wurzel || null);
  const istPng = await page.screenshot({ clip: { x: 0, y: 0, width: 390, height: hoehe } });
  fs.writeFileSync(path.join(IST, name + '.png'), istPng);
  const sollB64 = fs.readFileSync(path.join(SOLL, name + '.png')).toString('base64');
  const vgl = await leinwand.evaluate(async ([a, b, h]) => {
    const lade = async (d) => { const i = new Image(); await new Promise((ok) => { i.onload = ok; i.src = 'data:image/png;base64,' + d; }); return i; };
    const A = await lade(a), B = await lade(b);
    const c = document.createElement('canvas'); c.width = 390 * 2 + 12; c.height = Math.max(A.height, h);
    const g = c.getContext('2d'); g.fillStyle = '#ff00ff'; g.fillRect(0, 0, c.width, c.height);
    g.drawImage(A, 1, 1, 390, A.height - 2, 0, 0, 390, A.height - 2); g.drawImage(B, 402, 0);
    return c.toDataURL('image/png').split(',')[1];
  }, [sollB64, istPng.toString('base64'), hoehe]);
  fs.writeFileSync(path.join(VGL, name + '.png'), Buffer.from(vgl, 'base64'));
  const v = vergleiche(soll, ist, cfg.ausnahmen);
  const bericht = await inst.bericht();
  const gruen = v.befunde.length === 0 && v.fehlend.filter((t) => !(cfg.ohneText || []).includes(t)).length === 0 && bericht.verstoesse.length === 0 && bericht.fehler.length === 0;
  if (!gruen) alleGruen = false;
  console.log('\n=== ' + name + ' (' + cfg.profil + ') ' + (gruen ? 'GRÜN' : 'ABWEICHUNG') + ' · ' + v.gefunden.length + ' Texte zugeordnet');
  for (const b of v.befunde) console.log('  Δ ' + b);
  const fehlt = v.fehlend.filter((t) => !(cfg.ohneText || []).includes(t));
  if (fehlt.length) console.log('  fehlt im Ist: ' + fehlt.map((t) => '"' + t + '"').join(', '));
  if (bericht.verstoesse.length || bericht.fehler.length) console.log('  Stand-in: ' + bericht.verstoesse.concat(bericht.fehler).join(' | '));
  await ctx.close();
}
await browser.close(); server.close();
process.exit(alleGruen ? 0 : 1);
