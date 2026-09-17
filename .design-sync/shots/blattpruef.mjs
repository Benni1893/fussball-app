/* Funktionspruefung des Rueckmeldungen-Blattes. */
import { chromium } from 'playwright';
import { starte } from './server.mjs';
const { server, basis } = await starte(process.cwd());
const b = await chromium.launch({ channel: 'chrome' });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' });
const p = await ctx.newPage();
const fehler = [];
p.on('pageerror', (e) => fehler.push('pageerror: ' + e.message));
p.on('console', (m) => { if (m.type() === 'error') fehler.push('console: ' + m.text()); });
await p.goto(basis, { waitUntil: 'networkidle' }); await p.waitForTimeout(1200);
await p.fill('input[type="email"]', process.env.APP_USER);
await p.fill('input[type="password"]', process.env.APP_PASS);
await p.click('.auth-submit'); await p.waitForSelector('.app-nav', { timeout: 25000 }); await p.waitForTimeout(2200);
await p.evaluate(() => document.querySelector('.nav-btn[data-view="kalender"]').click()); await p.waitForTimeout(900);
await p.evaluate(() => document.querySelector('[data-rsvp-sheet]').click()); await p.waitForTimeout(700);

const zeig = async (was, fn) => console.log(was.padEnd(34) + await p.evaluate(fn));

await zeig('Scroll-Sperre dahinter', () => getComputedStyle(document.body).position + ' / overscroll ' + getComputedStyle(document.documentElement).overscrollBehaviorY);
await zeig('waagerecht', () => document.documentElement.scrollWidth + ' = ' + document.documentElement.clientWidth);
await zeig('Trefferflaechen unter 44', () => {
  const k = [];
  document.querySelectorAll('#rsvpSheet button').forEach((e) => { const r = e.getBoundingClientRect();
    if (r.height && r.height < 43.5) k.push((e.className || 'ohne Klasse') + ' ' + r.height.toFixed(0)); });
  return k.length ? k.join(', ') : 'keine';
});
await zeig('Kreuz: Treffer 21 px darueber', () => { const e = document.querySelector('.rs2-zu'), r = e.getBoundingClientRect();
  const t = document.elementFromPoint(r.left + 18, r.top + 18 - 21); return t && t.closest('.rs2-zu') ? 'ja' : 'nein'; });
await zeig('Start-Filter', () => document.querySelector('.rs2-kachel.is-on .rs2-k-l').textContent + ' / Zeilen ' + document.querySelectorAll('.rs2-zeile').length);
// Filter wechseln
await p.evaluate(() => document.querySelector('[data-rsfilter="zu"]').click()); await p.waitForTimeout(400);
await zeig('nach Tipp auf Zugesagt', () => document.querySelector('.rs2-kachel.is-on .rs2-k-l').textContent + ' / Zeilen ' + document.querySelectorAll('.rs2-zeile').length);
await p.evaluate(() => document.querySelector('[data-rsfilter="ab"]').click()); await p.waitForTimeout(400);
await zeig('nach Tipp auf Abgesagt', () => document.querySelector('.rs2-kachel.is-on .rs2-k-l').textContent + ' / Zeilen ' + document.querySelectorAll('.rs2-zeile').length + ' / leer: ' + !!document.querySelector('.rs2-leer'));
await p.evaluate(() => document.querySelector('[data-rsfilter="offen"]').click()); await p.waitForTimeout(400);
// Teilen
await p.evaluate(() => document.querySelector('[data-rs-teilen]').click()); await p.waitForTimeout(500);
await zeig('Teilen oeffnet Dialog', () => { const t = document.querySelector('.modal textarea, .modal pre, .modal .share-text');
  return t ? 'ja, ' + (t.value || t.textContent).split('\n').length + ' Zeilen' : 'nein'; });
await p.evaluate(() => { const c = document.querySelector('.modal-ov'); if (c) c.click(); }); await p.waitForTimeout(400);
await p.evaluate(() => document.querySelector('[data-rs-erinnern]').click()); await p.waitForTimeout(500);
await zeig('Erinnern oeffnet Dialog', () => { const t = document.querySelector('.modal textarea, .modal pre, .modal .share-text');
  return t ? 'ja, ' + (t.value || t.textContent).split('\n').length + ' Zeilen' : 'nein'; });
await p.evaluate(() => { const c = document.querySelector('.modal-ov'); if (c) c.click(); }); await p.waitForTimeout(400);
// Wisch nach unten schliesst
const panel = await p.$('.rs2-panel'); const box = await panel.boundingBox();
await p.touchscreen.tap(box.x + 195, box.y + 20);
await p.evaluate(() => { const el = document.querySelector('.rs2-panel');
  const t = (typ, y) => el.dispatchEvent(new TouchEvent(typ, { bubbles: true, cancelable: true,
    touches: typ === 'touchend' ? [] : [new Touch({ identifier: 1, target: el, clientX: 195, clientY: y })],
    changedTouches: [new Touch({ identifier: 1, target: el, clientX: 195, clientY: y })] }));
  t('touchstart', 220); t('touchmove', 300); t('touchmove', 420); t('touchend', 420);
});
await p.waitForTimeout(700);
await zeig('Wisch nach unten schliesst', () => document.getElementById('rsvpSheet') ? 'nein, Blatt steht noch' : 'ja');
await zeig('Scroll-Sperre geloest', () => getComputedStyle(document.body).position);
console.log('Fehler: ' + (fehler.length ? fehler.join(' | ') : 'keine'));
await b.close(); server.close();
