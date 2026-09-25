/* Abo-Hinweis und Einstellungs-Abschnitt bei 390 px: Hoehen, Trefferflaechen,
   Kontraste - und die Frage, ob das X den Chevron verdeckt.
   Aufruf: node .design-sync/shots/abobild.mjs                               */
import { chromium } from 'playwright';
import path from 'node:path';
import { starte } from './server.mjs';

const { server, basis } = await starte(process.cwd());
const b = await chromium.launch({ channel: 'chrome' });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
const CAL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M3 9h18M8 2.5v4M16 2.5v4"/></svg>';
const kachel = (hinweis) => `<div class="kal-abo-wrap"${hinweis ? '' : ' id="alt"'}>
  <button class="card kal-abo${hinweis ? ' hat-x' : ''}" type="button">
    <span class="kal-abo-ic" aria-hidden="true">${CAL}</span>
    <span class="kal-abo-main"><span class="kal-abo-t">${hinweis ? 'Termine im Handy-Kalender?' : 'Termine im Kalender abonnieren'}</span></span>
    <span class="kal-abo-chev" aria-hidden="true">&rsaquo;</span>
  </button>
  ${hinweis ? '<button class="kal-abo-x" type="button" aria-label="Hinweis ausblenden">&#10005;</button>' : ''}
</div>`;

await p.setContent(`<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="${basis}/styles.css">
<style>body{margin:0;background:var(--grad-app)}#view{padding:12px 16px}</style>
<main class="view" id="view">
  <div class="page-head"><h1>Kalender</h1></div>
  <div class="kal-seg" role="tablist">
    <button class="kal-seg-b is-on" type="button">Alle</button><button class="kal-seg-b" type="button">Spiele</button>
    <button class="kal-seg-b" type="button">Training</button><button class="kal-seg-b" type="button">Sonstiges</button>
  </div>
  <button class="kal-neu" type="button"><span>Termin hinzufügen</span></button>
  ${kachel(true)}
  <div class="event-list">
    <div class="card tk"><div class="tk-kopf">
      <span class="tk-datum"><span class="d-wd">Di</span><span class="d-day num">22</span><span class="d-mon">Sep</span></span>
      <span class="tk-kopf-main"><span class="tk-oben"><span class="tk-zeit num">19:30 – 21:00 Uhr</span></span>
      <span class="tk-titel">Training</span></span></div>
      <div class="tk-body"><div class="tk-rsvp">
        <button class="tk-btn is-on" type="button">Zusage</button><button class="tk-btn is-ab" type="button">Absage</button>
      </div></div></div>
  </div>
  <div style="height:18px"></div>
  <div class="set-section">
    <div class="section-title"><h2>Kalender-Abo</h2></div>
    <div class="card card-pad">
      <p class="set-hint">Alle Termine der Mannschaft landen automatisch in deinem Handy-Kalender
      und ändern sich dort mit, wenn ein Termin verschoben oder abgesagt wird.</p>
      <button class="btn btn-primary" type="button">Termine abonnieren</button>
      <button class="btn btn-soft" type="button">Link kopieren</button>
    </div>
  </div>
  <div style="height:18px"></div>
  ${kachel(false)}
</main>`, { waitUntil: 'networkidle' });
await p.waitForTimeout(400);

console.log(JSON.stringify(await p.evaluate(() => {
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const zahl = (s) => s.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number);
  const L = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  const K = (a, c) => { const x = L(a), y = L(c), h = Math.max(x, y), l = Math.min(x, y); return +((h + 0.05) / (l + 0.05)).toFixed(2); };
  const r = (e) => { const b2 = e.getBoundingClientRect(); return { x: +b2.left.toFixed(1), y: +b2.top.toFixed(1), b: +b2.width.toFixed(1), h: +b2.height.toFixed(1) }; };
  const hinweis = document.querySelector('.kal-abo.hat-x');
  const alt = document.querySelector('#alt .kal-abo');
  const x = document.querySelector('.kal-abo-x');
  const chev = document.querySelector('.kal-abo.hat-x .kal-abo-chev');
  const xr = x.getBoundingClientRect(), cr = chev.getBoundingClientRect();
  const tap = parseFloat(getComputedStyle(x, '::after').height);
  const mitte = (b2) => [b2.left + b2.width / 2, b2.top + b2.height / 2];
  const wer = (pt) => { const e = document.elementFromPoint(pt[0], pt[1]); return e ? (e.className || e.tagName) : null; };
  return {
    hoehe: { hinweis: r(hinweis).h, ohneX: r(alt).h },
    x: { kasten: r(x), treffer: tap + 'px', farbe: getComputedStyle(x).color,
         kontrastAufWeiss: K(zahl(getComputedStyle(x).color), [255, 255, 255]) },
    chevron: r(chev),
    // Trefferflaeche des X = 44 um seine Mitte. Liegt der Chevron darin?
    chevronUnterX: (cr.left + cr.width / 2) > (xr.left + xr.width / 2 - 22),
    trefferChevron: wer(mitte(cr)),
    trefferX: wer(mitte(xr)),
    trefferKachelMitte: wer([r(hinweis).x + 60, r(hinweis).y + r(hinweis).h / 2]),
    einstellungen: [...document.querySelectorAll('.set-section .btn')].map((e) => ({ text: e.textContent.trim(), h: r(e).h, b: r(e).b })),
    setHint: { kontrast: K(zahl(getComputedStyle(document.querySelector('.set-hint')).color), [255, 255, 255]) },
    titelBreite: (() => { const e = document.querySelector(".kal-abo-t"); const rg = document.createRange(); rg.selectNodeContents(e);
      return { text: +rg.getBoundingClientRect().width.toFixed(1), platz: +e.parentElement.getBoundingClientRect().width.toFixed(1) }; })(),
    titel: { kontrast: K(zahl(getComputedStyle(document.querySelector('.kal-abo-t')).color), [255, 255, 255]), zeilen: Math.round(r(document.querySelector('.kal-abo-t')).h / parseFloat(getComputedStyle(document.querySelector('.kal-abo-t')).lineHeight)) },
    seiteScrollt: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  };
}), null, 1));

const el = await p.locator('.kal-abo-wrap').first();
await el.screenshot({ path: path.join(process.cwd(), '.design-sync', 'reference', 'compare', 'abo-hinweis.png') });
await p.screenshot({ path: path.join(process.cwd(), '.design-sync', 'reference', 'compare', 'abo-kalender.png'), clip: { x: 0, y: 0, width: 390, height: 430 } });
await p.locator('.set-section').screenshot({ path: path.join(process.cwd(), '.design-sync', 'reference', 'compare', 'abo-einstellungen.png') });
await b.close(); server.close();
