/* Abo-Blatt. Prueft (a) die Reihenfolge der beiden Karten je Geraet gegen die
   echte Funktion aus app.js, (b) Trefferflaechen, Kontraste und Breite am
   gerenderten Blatt.                                                        */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { starte } from './server.mjs';

/* ---- (a): die Erkennung woertlich aus app.js ziehen --------------------- */
const quelle = fs.readFileSync('app.js', 'utf8');
const schnitt = (von, bis) => {
  const a = quelle.indexOf(von);
  const b = quelle.indexOf(bis, a);
  if (a < 0 || b < 0) throw new Error('Nicht gefunden: ' + von);
  return quelle.slice(a, b);
};
const code = schnitt('  function istAppleGeraet() {', '  // Direktseite');
const bauen = new Function('navigator', code + '\n return { istAppleGeraet };');

const geraete = [
  ['iPhone iOS 17', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1', 0],
  ['iPad iPadOS 17', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.5 Safari/605.1.15', 5],
  ['Android 14 Chrome', 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36', 5],
  ['Desktop Chrome', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36', 0],
  ['Desktop Safari', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.5 Safari/605.1.15', 0],
];
console.log('--- Reihenfolge ---');
for (const [name, ua, touch] of geraete) {
  const f = bauen({ userAgent: ua, maxTouchPoints: touch });
  const zuerstAndroid = /Android/i.test(ua) && !f.istAppleGeraet();
  console.log(name.padEnd(18), 'oben:', zuerstAndroid ? 'Android' : 'iPhone ', ' apple=' + f.istAppleGeraet());
}

/* ---- Die beiden Karten woertlich aus app.js uebernehmen ----------------- */
const GOOGLE_ADD_URL = 'https://calendar.google.com/calendar/u/0/r/settings/addbyurl';
const ICS = 'https://fc-fasanerie-nord.vercel.app/api/calendar/abc123.ics';
const webcal = ICS.replace(/^https?:/i, 'webcal:');
const roh = schnitt('    const karteApple = `', '    const zuerstAndroid');
const karten = new Function('esc', 'webcal', 'aus', 'GOOGLE_ADD_URL',
  roh + '\n return { karteApple, karteAndroid };')((x) => x, webcal, '', GOOGLE_ADD_URL);

/* ---- (b): das Blatt rendern -------------------------------------------- */
const { server, basis } = await starte(process.cwd());
const b = await chromium.launch({ channel: 'chrome' });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
await p.setContent(`<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="${basis}/styles.css">
<style>body{margin:0;background:var(--grad-app);min-height:844px}</style>
<div class="more-sheet">
  <button class="more-backdrop" data-sheet-close aria-label="Schließen"></button>
  <div class="more-panel" role="dialog" aria-modal="true" aria-label="Termine abonnieren">
    <div class="more-title">Termine abonnieren</div>
    <p class="sheet-desc">Alle Termine automatisch in deinem Handy-Kalender.</p>
    <div class="abo-karten">${karten.karteApple}${karten.karteAndroid}</div>
    <div class="cal-copied" data-cal-copied>Link kopiert</div>
    <div class="sheet-links"><button class="link-btn cal-reset" data-cal-regen>Link zurücksetzen</button></div>
  </div>
</div>`, { waitUntil: 'networkidle' });
await p.waitForTimeout(400);
console.log('--- gerendertes Blatt bei 390 ---');
console.log(JSON.stringify(await p.evaluate(() => {
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const zahl = (s) => s.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number);
  const L = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  const K = (a, c) => { const x = L(a), y = L(c), h = Math.max(x, y), l = Math.min(x, y); return +((h + 0.05) / (l + 0.05)).toFixed(2); };
  const kon = (el) => { const s = getComputedStyle(el);
    const grund = s.backgroundColor === 'rgba(0, 0, 0, 0)' ? s.backgroundImage : s.backgroundColor;
    const stops = grund.match(/rgba?\([^)]+\)/g);
    if (stops) return stops.map((c) => K(zahl(s.color), zahl(c)));
    // durchsichtig: naechster gemalter Vorfahr
    let e = el.parentElement;
    while (e && getComputedStyle(e).backgroundColor === 'rgba(0, 0, 0, 0)' && getComputedStyle(e).backgroundImage === 'none') e = e.parentElement;
    const s2 = getComputedStyle(e);
    const g2 = s2.backgroundImage !== 'none' ? s2.backgroundImage : s2.backgroundColor;
    return (g2.match(/rgba?\([^)]+\)/g) || ['rgb(255,255,255)']).map((c) => K(zahl(s.color), zahl(c)));
  };
  const el = (s) => document.querySelector(s);
  const mass = (s) => { const e = el(s); if (!e) return null; const r = e.getBoundingClientRect();
    return { h: +r.height.toFixed(1), b: +r.width.toFixed(1), kontrast: kon(e) }; };
  return {
    appleKnopf:   mass('[data-cal-open]'),
    kopieren:     mass('[data-cal-copy]'),
    googleOeffnen: mass('a[href^="https://calendar.google.com"]'),
    zuruecksetzen: mass('[data-cal-regen]'),
    einleitung:   { kontrast: kon(el('.abo-karte:last-child .abo-hinweis')) },
    schritte:     { kontrast: kon(el('.abo-schritte')), n: document.querySelectorAll('.abo-schritte li').length },
    zusatzzeile:  { kontrast: kon(el('.abo-fuss')), text: el('.abo-fuss').textContent.trim() },
    rueckmeldung: kon(el('.cal-copied')),
    nochGoogleCid: /calendar\/r\?cid=/.test(document.body.innerHTML),
    blattHoehe:   +el('.more-panel').getBoundingClientRect().height.toFixed(1),
    seiteScrollt: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    scrollBreite: document.documentElement.scrollWidth,
  };
}), null, 1));
const h = await p.evaluate(() => Math.ceil(document.querySelector('.more-panel').getBoundingClientRect().height) + 12);
await p.screenshot({ path: path.join(process.cwd(), '.design-sync', 'reference', 'compare', 'p4-abo.png'), clip: { x: 0, y: 844 - h, width: 390, height: h } });
await b.close(); server.close();
