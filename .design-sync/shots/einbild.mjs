/* Rendert die neuen Einstellungen bei 390 px und misst nach, was die Vorlage
   verlangt: Zeilenhoehen, Tippflaechen, waagerechter Ueberlauf, Kontrast der
   Schrift auf den Symbolkacheln und in den Zeilen. Das Markup kommt woertlich
   aus app.js (einmodul.mjs), nicht aus einem Nachbau.

   Aufruf: node .design-sync/shots/einbild.mjs                             */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ladeEin } from './einmodul.mjs';

const ZIEL = '.design-sync/reference/compare';
fs.mkdirSync(ZIEL, { recursive: true });

const E = ladeEin();
let fehler = 0, gut = 0;
const sage = (ok, text, zusatz) => {
  if (ok) { gut++; console.log('  ok   ' + text); }
  else { fehler++; console.log('  FEHL ' + text + (zusatz ? '  [' + zusatz + ']' : '')); }
};

function seite(inhalt) {
  return '<!doctype html>\n' +
    '<html lang="de"><head><meta charset="utf-8">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
    '<link rel="stylesheet" href="../../../styles.css">\n' +
    '<style>\n' +
    '  html, body { margin: 0; }\n' +
    '  body { background: var(--grad-app); }\n' +
    '  .huelle { width: 390px; }\n' +
    '  .kopf { height: 56px; background: var(--grad-hd); }\n' +
    '  .view { padding: 18px 16px 16px; }\n' +
    '</style></head>\n' +
    '<body><div class="huelle"><div class="kopf"></div><main class="view">' + inhalt + '</main></div></body></html>';
}

/* WCAG-Kontrast. Nimmt die tatsaechlich gerenderte Farbe, nicht die Absicht. */
const KONTRAST = `(() => {
  const lum = (c) => { const t = c.map((v) => { v = v / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * t[0] + 0.7152 * t[1] + 0.0722 * t[2]; };
  const zahl = (s) => (s.match(/[0-9.]+/g) || []).slice(0, 3).map(Number);
  window.__k = (el, hinter) => {
    const v = getComputedStyle(el), h = getComputedStyle(hinter);
    const a = lum(zahl(v.color)), b = lum(zahl(h.backgroundColor));
    return Math.round(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)) * 100) / 100;
  };
})()`;

const br = await chromium.launch({ channel: 'chrome' });
const p = await br.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
let skriptfehler = 0;
p.on('pageerror', (e) => { skriptfehler++; console.log('  SKRIPTFEHLER ' + e.message); });

async function zeige(html, datei) {
  const f = path.join(ZIEL, '_tmp.html');
  fs.writeFileSync(f, html);
  await p.goto(pathToFileURL(path.resolve(f)).href);
  await p.waitForTimeout(150);
  await p.evaluate(KONTRAST);
  if (datei) { await p.screenshot({ path: path.join(ZIEL, datei), fullPage: true }); console.log('  Bild ' + datei); }
}

/* ---- 1. Uebersicht als Admin --------------------------------------------- */
console.log('--- Uebersicht Admin ---');
E.setRollen(['admin', 'player']);
await zeige(seite(E.uebersichtHtml()), 'Einstellungen-Uebersicht-Admin.png');

const mass = await p.evaluate(() => {
  const z = Array.from(document.querySelectorAll('.ein-zeile'));
  return {
    zeilen: z.map((e) => ({ t: e.querySelector('.ein-zeile-t').textContent, h: Math.round(e.getBoundingClientRect().height) })),
    kacheln: Array.from(document.querySelectorAll('.ein-ic')).map((e) => {
      const r = e.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height), bg: getComputedStyle(e).backgroundColor };
    }),
    profil: Math.round(document.querySelector('.ein-profil').getBoundingClientRect().height),
    abmelden: Math.round(document.querySelector('.ein-abmelden').getBoundingClientRect().height),
    breite: document.documentElement.scrollWidth,
    gruppen: document.querySelectorAll('.ein-gruppe').length,
  };
});

sage(mass.breite <= 390, 'kein waagerechter Ueberlauf', mass.breite + 'px');
sage(mass.zeilen.length === 8, '8 Zeilen als Admin', String(mass.zeilen.length));
sage(mass.gruppen === 4, '4 Gruppen (Haupt, Verwaltung, Info, Abmelden)', String(mass.gruppen));
for (const z of mass.zeilen) sage(z.h >= 44, 'Zeile "' + z.t + '" mindestens 44 hoch', z.h + 'px');
sage(mass.zeilen.every((z) => z.h === 49), 'alle Zeilen 49px wie gemessen', mass.zeilen.map((z) => z.h).join('/'));
sage(mass.kacheln.every((k) => k.w === 30 && k.h === 30), 'Symbolkacheln 30x30', JSON.stringify(mass.kacheln[0]));
sage(mass.abmelden >= 44, 'Abmelden mindestens 44 hoch', mass.abmelden + 'px');
sage(mass.profil >= 44, 'Profilkarte mindestens 44 hoch', mass.profil + 'px');

/* Die vier Kachelfarben der Vorlage, gemessen aus einstellungenneu.png. */
const SOLL = {
  'rgb(31, 112, 73)': '--green-650',
  'rgb(15, 61, 46)': '--green-900',
  'rgb(150, 119, 42)': '--gold-chev',
  'rgb(93, 107, 99)': '--muted-2',
};
const unbekannt = mass.kacheln.map((k) => k.bg).filter((b) => !SOLL[b]);
sage(unbekannt.length === 0, 'nur Kachelfarben aus dem Tokenblock', unbekannt.join(' '));

/* Kontrast: weisses Symbol auf der Kachel, Zeilentitel und Wert auf der Karte. */
const k = await p.evaluate(() => {
  const ic = document.querySelector('.ein-ic.gold');
  const t = document.querySelector('.ein-zeile-t');
  const w = document.querySelector('.ein-zeile-w');
  const g = document.querySelector('.ein-gruppe');
  return { kachelGold: window.__k(ic, ic), titel: window.__k(t, g), wert: window.__k(w, g) };
});
sage(k.kachelGold >= 3, 'Symbol auf der Goldkachel mindestens 3:1', k.kachelGold + ':1');
sage(k.titel >= 4.5, 'Zeilentitel mindestens 4,5:1', k.titel + ':1');
sage(k.wert >= 4.5, 'Wert rechts mindestens 4,5:1', k.wert + ':1');

/* ---- 2. Uebersicht als Spieler ------------------------------------------- */
console.log('--- Uebersicht Spieler ---');
E.setRollen(['player']);
await zeige(seite(E.uebersichtHtml()), 'Einstellungen-Uebersicht-Spieler.png');
const sp = await p.evaluate(() => ({
  zeilen: Array.from(document.querySelectorAll('.ein-zeile-t')).map((e) => e.textContent),
  titel: Array.from(document.querySelectorAll('.ein-titel')).map((e) => e.textContent),
}));
sage(sp.titel.indexOf('Verwaltung') === -1, 'Spieler sieht keine Verwaltung', sp.titel.join('/'));
sage(['Strafenkatalog', 'Push-Texte', 'Spielplan (BFV)'].every((x) => sp.zeilen.indexOf(x) === -1),
  'keine Verwaltungszeilen fuer Spieler', sp.zeilen.join('/'));
sage(['Mitteilungen', 'Ruhezeiten', 'Kalender-Abo'].every((x) => sp.zeilen.indexOf(x) !== -1),
  'die drei eigenen Zeilen sind da', sp.zeilen.join('/'));

/* ---- 3. Kopf einer Unterseite -------------------------------------------- */
console.log('--- Unterseite: Kopf und Uebergang ---');
E.setRollen(['admin', 'player']);
const kopf = E.einKopfHtml('Mitteilungen') +
  '<div class="ein-body ein-anim-rein"><h1 class="ein-h1" tabindex="-1">Mitteilungen</h1>' +
  '<div class="card card-pad" style="height:1400px">Platzhalter</div></div>';
await zeige(seite(kopf), 'Einstellungen-Unterseite-Kopf.png');

const u = await p.evaluate(() => {
  const kopfEl = document.querySelector('.ein-kopf');
  const back = document.querySelector('.ein-back');
  const t = document.querySelector('.ein-kopf-t');
  return {
    klebt: getComputedStyle(kopfEl).position,
    backH: Math.round(back.getBoundingClientRect().height),
    backText: back.textContent.replace(/\s+/g, ' ').trim(),
    titelVerborgen: getComputedStyle(t).opacity,
    h1: getComputedStyle(document.querySelector('.ein-h1')).fontSize,
    breite: document.documentElement.scrollWidth,
  };
});
sage(u.klebt === 'sticky', 'Zurueck-Leiste klebt', u.klebt);
sage(u.backH >= 44, 'Zurueck mindestens 44 hoch', u.backH + 'px');
sage(/Einstellungen$/.test(u.backText), 'Zurueck traegt den Namen der vorigen Ebene', u.backText);
sage(u.titelVerborgen === '0', 'kompakter Titel ist oben noch verborgen', u.titelVerborgen);
sage(u.breite <= 390, 'kein waagerechter Ueberlauf', u.breite + 'px');
console.log('  (h1 der Unterseite: ' + u.h1 + ')');

// Gescrollt: der Titel muss auftauchen. Die Klasse setzt in der App
// einScrollBeobachter; hier wird nur geprueft, dass die CSS-Regel greift.
await p.evaluate(() => document.querySelector('.ein-kopf').classList.add('is-kompakt'));
await p.waitForTimeout(260);
const nach = await p.evaluate(() => getComputedStyle(document.querySelector('.ein-kopf-t')).opacity);
sage(nach === '1', 'kompakter Titel erscheint mit .is-kompakt', nach);

/* ---- 4. Bewegung aus, wenn der Nutzer sie abbestellt hat ----------------- */
console.log('--- prefers-reduced-motion ---');
await p.emulateMedia({ reducedMotion: 'reduce' });
await zeige(seite(kopf));
const anim = await p.evaluate(() => getComputedStyle(document.querySelector('.ein-body')).animationName);
sage(anim === 'none', 'kein Uebergang bei reduzierter Bewegung', anim);
await p.emulateMedia({ reducedMotion: null });

await br.close();
fs.rmSync(path.join(ZIEL, '_tmp.html'), { force: true });
console.log('');
sage(skriptfehler === 0, 'keine Skriptfehler beim Rendern', String(skriptfehler));
console.log(fehler ? '--- ' + fehler + ' Beanstandung(en), ' + gut + ' ok ---' : '--- alles gruen (' + gut + ' Pruefungen) ---');
process.exit(fehler ? 1 : 0);
