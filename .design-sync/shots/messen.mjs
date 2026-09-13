/* Misst Vorlage und App gegeneinander: fuer jedes Elementpaar die berechneten
   Werte aus beiden DOMs, dazu Farbproben aus den gerenderten Bildern.
   Ausgabe: Referenz / App / Differenz - nur Messwerte, keine Einschaetzung.

   Aufruf:  APP_USER=... APP_PASS=... node .design-sync/shots/messen.mjs <screen>
   Die Paarungen stehen in .design-sync/shots/paare.json.                      */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { starte } from './server.mjs';

const ROOT = process.cwd();
let   URL  = process.env.APP_URL || '';   // leer = Arbeitsstand lokal messen
const USER = process.env.APP_USER || '';
const PASS = process.env.APP_PASS || '';
const screen = process.argv[2];
if (!screen) { console.error('Screen fehlt. Aufruf: node .design-sync/shots/messen.mjs <screen>'); process.exit(1); }

const PAARE = JSON.parse(fs.readFileSync('.design-sync/shots/paare.json', 'utf8'));
const def = PAARE[screen];
if (!def) { console.error('Kein Eintrag fuer "' + screen + '" in paare.json'); process.exit(1); }

const { server, port: PORT, basis: LOKAL } = await starte(ROOT);

/* ---- was gemessen wird ---------------------------------------------------- */
const MESSUNG = `(sel) => {
  const el = document.querySelector(sel);
  if (!el) return null;
  const c = getComputedStyle(el), b = el.getBoundingClientRect();
  const hex = (v) => {
    const m = String(v).match(/rgba?\\(([^)]+)\\)/);
    if (!m) return v;
    const p = m[1].split(',').map((x) => parseFloat(x));
    const h = '#' + p.slice(0,3).map((n) => Math.round(n).toString(16).padStart(2,'0')).join('');
    return (p[3] != null && p[3] < 1) ? h + ' a=' + p[3] : h;
  };
  return {
    'Breite':        Math.round(b.width * 10) / 10 + 'px',
    'Hoehe':         Math.round(b.height * 10) / 10 + 'px',
    'Schriftgroesse':c.fontSize,
    'Schriftgewicht':c.fontWeight,
    'Zeilenabstand': c.lineHeight,
    'Laufweite':     c.letterSpacing,
    'Textfarbe':     hex(c.color),
    'Flaeche':       hex(c.backgroundColor),
    'Verlauf':       c.backgroundImage === 'none' ? '-' : c.backgroundImage.replace(/\\s+/g,' '),
    'Radius':        c.borderRadius,
    'Rand':          c.borderTopWidth + ' ' + c.borderTopStyle + ' ' + hex(c.borderTopColor),
    'Kante links':   c.borderLeftWidth,
    'Schatten':      c.boxShadow === 'none' ? '-' : c.boxShadow.replace(/\\s+/g,' '),
    'Innenabstand':  c.paddingTop + ' ' + c.paddingRight + ' ' + c.paddingBottom + ' ' + c.paddingLeft,
    'Aussenabstand': c.marginTop + ' ' + c.marginRight + ' ' + c.marginBottom + ' ' + c.marginLeft,
    'Ausrichtung':   c.textAlign,
    'Anzeige':       c.display + (c.display.includes('flex') ? ' / ' + c.alignItems + ' / ' + c.justifyContent + ' / Luecke ' + c.gap : ''),
  };
}`;

const browser = await chromium.launch({ channel: 'chrome' });

/* ---- Vorlage -------------------------------------------------------------- */
const ctxV = await browser.newContext({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 2 });
const pv = await ctxV.newPage();
await pv.addInitScript(() => {
  document.addEventListener('DOMContentLoaded', () => {
    const s = document.createElement('style');
    s.textContent = 'x-dc{display:block}helmet{display:none}';
    document.head.appendChild(s);
  });
});
await pv.goto(`http://127.0.0.1:${PORT}/.design-sync/concepts/${encodeURIComponent('App in 2a - High End.dc.html')}`, { waitUntil: 'networkidle' });
await pv.waitForTimeout(700);

/* ---- App ------------------------------------------------------------------ */
const ctxA = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
});
const pa = await ctxA.newPage();
if (!URL) URL = LOKAL;
 await pa.goto(URL, { waitUntil: 'networkidle' });
await pa.waitForTimeout(1200);
const imLogin = await pa.evaluate(() => { const c = document.querySelector('.auth-card'); return !!(c && c.getBoundingClientRect().height > 0); });
if (imLogin && USER && PASS) {
  await pa.fill('input[type="email"]', USER);
  await pa.fill('input[type="password"]', PASS);
  await pa.click('.auth-submit');
  await pa.waitForSelector('.app-nav', { timeout: 25000 });
  await pa.waitForTimeout(1800);
}
// Screen-spezifische Navigation
for (const schritt of (def.weg || [])) {
  await pa.evaluate((s) => { const el = document.querySelector(s); if (el) el.click(); }, schritt);
  await pa.waitForTimeout(900);
}

/* ---- Gegenueberstellung ---------------------------------------------------- */
const zeilen = [];
for (const [name, p] of Object.entries(def.elemente)) {
  const ref = await pv.evaluate(new Function('return ' + MESSUNG)(), `#${def.frame} ${p.ref}`);
  const app = await pa.evaluate(new Function('return ' + MESSUNG)(), p.app);
  if (!ref) { zeilen.push({ el: name, mass: '(in der Vorlage nicht gefunden: ' + p.ref + ')' }); continue; }
  if (!app) { zeilen.push({ el: name, mass: 'FEHLT IN DER APP (' + p.app + ')' }); continue; }
  for (const k of Object.keys(ref)) {
    if (String(ref[k]) === String(app[k])) continue;
    zeilen.push({ el: name, mass: k, ref: ref[k], app: app[k] });
  }
}

const breite = (s, n) => String(s).slice(0, n).padEnd(n);
console.log('\n=== ' + screen + ' — Referenz / App ===\n');
let letzt = '';
for (const z of zeilen) {
  if (z.el !== letzt) { console.log('\n' + z.el); letzt = z.el; }
  if (z.ref === undefined) { console.log('  ' + z.mass); continue; }
  console.log('  ' + breite(z.mass, 15) + ' | ' + breite(z.ref, 46) + ' | ' + breite(z.app, 46));
}
if (!zeilen.length) console.log('Keine Abweichung.');
console.log('\n' + zeilen.filter((z) => z.ref !== undefined).length + ' Abweichungen.');

await browser.close();
server.close();
