/* Punkt 4: Abo-Blatt. Prueft (a) die Reihenfolge der beiden Karten je
   Geraet gegen die echte Funktion aus app.js, (b) die gebaute Google-URL,
   (c) Trefferflaechen und Kontraste am gerenderten Blatt.                   */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { starte } from './server.mjs';

/* ---- (a) und (b): die Funktionen woertlich aus app.js ziehen ------------ */
const quelle = fs.readFileSync('app.js', 'utf8');
const schnitt = (von, bis) => {
  const a = quelle.indexOf(von);
  const b = quelle.indexOf(bis, a);
  if (a < 0 || b < 0) throw new Error('Funktion nicht gefunden: ' + von);
  return quelle.slice(a, b);
};
const code = schnitt('  function istAppleGeraet() {', '  /* Bottom-Sheet');
const bauen = new Function('navigator', code + '\n return { istAppleGeraet, googleAboUrl };');

const geraete = [
  ['iPhone iOS 17', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1', 0],
  ['iPad iPadOS 17', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.5 Safari/605.1.15', 5],
  ['Android 14 Chrome', 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36', 5],
  ['Desktop Chrome', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36', 0],
  ['Desktop Safari', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.5 Safari/605.1.15', 0],
];
const ICS = 'https://fc-fasanerie-nord.vercel.app/api/calendar/abc123.ics';
console.log('--- Reihenfolge und Google-URL ---');
for (const [name, ua, touch] of geraete) {
  const f = bauen({ userAgent: ua, maxTouchPoints: touch });
  const zuerstAndroid = /Android/i.test(ua) && !f.istAppleGeraet();
  console.log(name.padEnd(18), 'oben:', zuerstAndroid ? 'Android' : 'iPhone ', ' apple=' + f.istAppleGeraet());
}
console.log('Google-URL:', bauen({ userAgent: '', maxTouchPoints: 0 }).googleAboUrl(ICS));

/* ---- (c): das Blatt rendern -------------------------------------------- */
const { server, basis } = await starte(process.cwd());
const b = await chromium.launch({ channel: 'chrome' });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
const webcal = ICS.replace(/^https?:/i, 'webcal:');
const google = bauen({ userAgent: '', maxTouchPoints: 0 }).googleAboUrl(ICS);
await p.setContent(`<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="${basis}/styles.css">
<style>body{margin:0;background:var(--grad-app);min-height:844px}</style>
<div class="more-sheet">
  <button class="more-backdrop" data-sheet-close aria-label="Schließen"></button>
  <div class="more-panel" role="dialog" aria-modal="true" aria-label="Termine abonnieren">
    <div class="more-title">Termine abonnieren</div>
    <p class="sheet-desc">Alle Termine automatisch in deinem Handy-Kalender.</p>
    <div class="abo-karten">
      <section class="abo-karte">
        <div class="abo-k-t">iPhone und iPad</div>
        <a class="btn btn-primary abo-btn" data-cal-open href="${webcal}">Zum Kalender hinzufügen</a>
      </section>
      <section class="abo-karte">
        <div class="abo-k-t">Android · Google Kalender</div>
        <a class="btn btn-primary abo-btn" data-cal-google href="${google}" target="_blank" rel="noopener noreferrer">Im Google Kalender öffnen</a>
        <button class="btn btn-soft abo-btn" data-cal-copy type="button">Link kopieren</button>
        <p class="abo-hinweis">In der Google-Kalender-App lässt sich ein Abo nicht anlegen.
        Öffne dafür einmal calendar.google.com im Browser, dort „Weitere Kalender › Per URL“, und füge den Link ein —
        danach erscheint der Kalender von selbst in der Android-App.</p>
      </section>
    </div>
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
    return (grund.match(/rgba?\([^)]+\)/g) || ['rgb(255,255,255)']).map((c) => K(zahl(s.color), zahl(c))); };
  const el = (s) => document.querySelector(s);
  const mass = (s) => { const e = el(s), r = e.getBoundingClientRect();
    return { h: +r.height.toFixed(1), b: +r.width.toFixed(1), kontrast: kon(e) }; };
  return {
    apple: mass('[data-cal-open]'), google: mass('[data-cal-google]'), kopieren: mass('[data-cal-copy]'),
    zuruecksetzen: mass('[data-cal-regen]'),
    hinweis: { kontrast: kon(el('.abo-hinweis')), zeilen: Math.round(el('.abo-hinweis').getBoundingClientRect().height / parseFloat(getComputedStyle(el('.abo-hinweis')).lineHeight)) },
    karteTitel: kon(el('.abo-k-t')),
    rueckmeldung: kon(el('.cal-copied')),
    blattHoehe: +el('.more-panel').getBoundingClientRect().height.toFixed(1),
    seiteScrollt: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  };
}), null, 1));
await p.screenshot({ path: path.join(process.cwd(), '.design-sync', 'reference', 'compare', 'p4-abo.png'), clip: { x: 0, y: 844 - 470, width: 390, height: 470 } });
await b.close(); server.close();
