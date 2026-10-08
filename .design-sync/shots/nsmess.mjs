/* Paket „Nachschliff Oktober“: Pixelabgleich je Element bei 390 px.
   Soll: .design-sync/reference/app/nachschliff-2026-10/soll/Nachschliff Oktober Final.dc.html
         (lokal gespiegelt). Je Element (D1 … D9) ein Rahmen und darin eine Wurzel.
   Ist:  App über den Landkarten-Stand-in bei 388 px (= Innenbreite der 390er Vorlagen-
         Rahmen mit 1 px Rand), Maßstab 1; Wurzel per Selektor.
   Verglichen werden alle Elemente mit eigenem Text, relativ zur linken oberen Ecke der
   Wurzel: Kanten (±1 px), Schriftgröße, -gewicht, Farbe und Laufweite (exakt).
   Zuordnung über den Text (Reihenfolge innerhalb gleicher Texte); abweichende Daten
   gleicht `ersetze` an (Ist-Text → Soll-Text); `breiteFrei`: Texte, deren Breite und
   Lage an den Daten hängen (Beträge), ohne x/w.
   Ausgabe: .design-sync/nachschliff-2026-10/{soll,ist,vergleich}/<Element>.png
   Aufruf:  node .design-sync/shots/nsmess.mjs [D1 D2 … | alle]                       */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { starte } from './server.mjs';
import { installiere, warteAufApp, neuerKontext } from './landkartenmodul.mjs';
import { AUSLOESER, UEBERLAGERUNGEN, zustandImBrowser } from './landkartenregeln.mjs';
import { kandidatenImBrowser } from './landkarte.mjs';
import { NS_ELEMENTE } from './nselemente.mjs';

const VORLAGE = '.design-sync/reference/app/nachschliff-2026-10/soll/Nachschliff Oktober Final.dc.html';
const AUS = '.design-sync/nachschliff-2026-10';
for (const d of ['soll', 'ist', 'vergleich']) fs.mkdirSync(path.join(AUS, d), { recursive: true });
const TOL = Number(process.env.TOL || 1);
let wahl = process.argv.slice(2);
if (!wahl.length || wahl[0] === 'alle') wahl = Object.keys(NS_ELEMENTE);
const lk = JSON.parse(fs.readFileSync('.design-sync/landkarte/landkarte.json', 'utf8'));

/* Im Browser: Elemente mit eigenem Text unter der Wurzel, relativ zu ihr. */
function messe(root) {
  const r0 = root.getBoundingClientRect();
  const out = [];
  for (const e of root.querySelectorAll('*')) {
    const r = e.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const cs = getComputedStyle(e);
    if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) continue;
    const text = [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.replace(/ /g, ' ').trim()).join(' ').replace(/\s+/g, ' ').trim();
    if (!text) continue;
    out.push({ text: text.slice(0, 60), x: Math.round(r.left - r0.left), y: Math.round(r.top - r0.top), w: Math.round(r.width), h: Math.round(r.height),
      fs: cs.fontSize, fw: cs.fontWeight, farbe: cs.color, ls: cs.letterSpacing === 'normal' ? '0px' : cs.letterSpacing });
  }
  return { w: Math.round(r0.width), h: Math.round(r0.height), elemente: out };
}
function vergleiche(soll, ist, ersetze, ohne, breiteFrei) {
  const norm = (t) => (ersetze && ersetze[t]) || t;
  const gruppe = (liste, f) => { const m = new Map(); for (const e of liste) { const k = f(e.text); if ((ohne || []).includes(k)) continue; if (!m.has(k)) m.set(k, []); m.get(k).push(e); } return m; };
  const S = gruppe(soll.elemente, (t) => t), I = gruppe(ist.elemente, norm);
  const befunde = [], fehlt = [];
  for (const [t, ls] of S) {
    const li = I.get(t) || [];
    ls.forEach((s, i) => {
      const e = li[i]; if (!e) { fehlt.push(t); return; }
      const d = [];
      for (const k of ['x', 'y', 'w', 'h']) if (!((breiteFrei || []).includes(t) && (k === 'w' || k === 'x')) && Math.abs(s[k] - e[k]) > TOL) d.push(k + ' ' + s[k] + '→' + e[k]);
      for (const k of ['fs', 'fw', 'farbe', 'ls']) if (s[k] !== e[k]) d.push(k + ' ' + s[k] + '→' + e[k]);
      if (d.length) befunde.push('"' + t + '": ' + d.join(', '));
    });
  }
  const zuviel = [...I.keys()].filter((t) => !S.has(t));
  return { befunde, fehlt, zuviel };
}

const { server, basis } = await starte(process.cwd());
const browser = await chromium.launch({ channel: 'chrome' });
let alleGruen = true;
// Soll einmal laden
const vctx = await browser.newContext({ viewport: { width: 1600, height: 1200 }, deviceScaleFactor: 1 });
const vpage = await vctx.newPage();
await vpage.goto(basis + '/' + VORLAGE.split('/').map(encodeURIComponent).join('/'), { waitUntil: 'networkidle' });
await vpage.waitForTimeout(800);
await vpage.evaluate(() => document.fonts.ready);
const leinwand = await browser.newPage();

for (const name of wahl) {
  const cfg = NS_ELEMENTE[name];
  if (!cfg) { console.log('FEHL ' + name + ': keine Vorschrift in nselemente.mjs'); alleGruen = false; continue; }
  // --- Soll
  const sollHandle = await vpage.evaluateHandle(({ figur, rahmen, wurzel }) => {
    const fig = document.getElementById(figur);
    const frames = [...fig.children].filter((c) => c.tagName === 'DIV' && /border-radius:\s*28px/.test(c.getAttribute('style') || ''));
    const f = frames[rahmen || 0];
    return wurzel ? new Function('f', 'return (' + wurzel + ')(f)')(f) : f;
  }, cfg.soll);
  const soll = await sollHandle.evaluate(messe);
  const sollPng = await sollHandle.screenshot();
  fs.writeFileSync(path.join(AUS, 'soll', name + '.png'), sollPng);
  // --- Ist
  const ctx = await neuerKontext(browser);
  await ctx.close();
  const ictx = await browser.newContext({ viewport: { width: 388, height: cfg.hoehe || 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true,
    locale: 'de-DE', timezoneId: 'Europe/Berlin', serviceWorkers: 'block' });
  const page = await ictx.newPage();
  const inst = await installiere(page, cfg.ist.profil, cfg.ist.daten ? { daten: cfg.ist.daten() } : undefined);
  await page.goto(basis, { waitUntil: 'load' });
  await warteAufApp(page);
  await page.evaluate(() => document.fonts.ready);
  if (cfg.ist.schluessel) {
    const n = lk.profile[cfg.ist.profil].knoten.find((k) => k.schluessel === cfg.ist.schluessel);
    for (const s of n.pfad) {
      const z = await page.evaluate(zustandImBrowser, UEBERLAGERUNGEN);
      await page.evaluate(kandidatenImBrowser, { ausloeser: AUSLOESER, ueberlagerungen: UEBERLAGERUNGEN, oben: z.oben, istStart: s.global === true, nurArt: s.art, nurWert: s.wert });
      await page.evaluate(() => { const e = document.querySelector('[data-landkarte-ziel]'); e.removeAttribute('data-landkarte-ziel'); e.click(); });
      await page.waitForTimeout(450);
    }
  }
  if (cfg.ist.vorbereitung) await cfg.ist.vorbereitung(page);
  await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation:none!important}' });
  await page.waitForTimeout(300);
  const istHandle = await page.evaluateHandle((sel) => (typeof sel === 'string' ? document.querySelector(sel) : null), cfg.ist.wurzel);
  if (!(await istHandle.evaluate((e) => !!e))) { console.log('FEHL ' + name + ': Ist-Wurzel nicht gefunden (' + cfg.ist.wurzel + ')'); alleGruen = false; await ictx.close(); continue; }
  await istHandle.evaluate((e) => e.scrollIntoView({ block: 'center' }));
  const ist = await istHandle.evaluate(messe);
  const istPng = await istHandle.screenshot();
  fs.writeFileSync(path.join(AUS, 'ist', name + '.png'), istPng);
  const vgl = await leinwand.evaluate(async ([a, b]) => {
    const lade = async (d) => { const i = new Image(); await new Promise((ok) => { i.onload = ok; i.src = 'data:image/png;base64,' + d; }); return i; };
    const A = await lade(a), B = await lade(b);
    const c = document.createElement('canvas'); c.width = A.width + B.width + 12; c.height = Math.max(A.height, B.height);
    const g = c.getContext('2d'); g.fillStyle = '#ff00ff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(A, 0, 0); g.drawImage(B, A.width + 12, 0);
    return c.toDataURL('image/png').split(',')[1];
  }, [sollPng.toString('base64'), istPng.toString('base64')]);
  fs.writeFileSync(path.join(AUS, 'vergleich', name + '.png'), Buffer.from(vgl, 'base64'));
  const v = vergleiche(soll, ist, cfg.ersetze, cfg.ohne, cfg.breiteFrei);
  const mass = [];
  if (Math.abs(soll.w - ist.w) > TOL) mass.push('Breite ' + soll.w + '→' + ist.w);
  if (!cfg.hoeheFrei && Math.abs(soll.h - ist.h) > TOL) mass.push('Höhe ' + soll.h + '→' + ist.h);
  const bericht = await inst.bericht();
  const gruen = !v.befunde.length && !v.fehlt.length && !mass.length && !bericht.verstoesse.length && !bericht.fehler.length;
  if (!gruen) alleGruen = false;
  console.log('\n=== ' + name + ' ' + (gruen ? 'GRÜN' : 'ABWEICHUNG') + ' · ' + soll.elemente.length + ' Soll-Texte');
  for (const m of mass) console.log('  Δ Wurzel ' + m);
  for (const b of v.befunde) console.log('  Δ ' + b);
  if (v.fehlt.length) console.log('  fehlt im Ist: ' + v.fehlt.map((t) => '"' + t + '"').join(', '));
  if (v.zuviel.length && process.env.NS_ZUVIEL) console.log('  nur im Ist: ' + v.zuviel.join(' | '));
  if (bericht.verstoesse.length || bericht.fehler.length) console.log('  Stand-in: ' + bericht.verstoesse.concat(bericht.fehler).join(' | '));
  await ictx.close();
}
await browser.close(); server.close();
process.exit(alleGruen ? 0 : 1);
