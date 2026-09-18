/* Prueft die Spielertrainer-Zeile im Termin-Hero.
   Das Testkonto ist mit keinem Spieler verknuepft, deshalb wird die
   Verknuepfung nur IM BROWSER vorgetaeuscht - die Datenbank bleibt unberuehrt.
   Gepruefte Faelle:
     A  verknuepft, keine eigene Rueckmeldung  -> Zeile steht
     B  verknuepft, eigene Rueckmeldung liegt  -> Zeile weg
     C  nicht verknuepft                       -> Zeile nie (Ist-Zustand)     */
import { chromium } from 'playwright';
import { starte } from './server.mjs';

const fall = process.argv[2] || 'A';
const { server, basis } = await starte(process.cwd());
const b = await chromium.launch({ channel: 'chrome' });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' });
const p = await ctx.newPage();
const fehler = [];
p.on('pageerror', (e) => fehler.push('pageerror: ' + e.message));

if (fall !== 'C') {
  await p.route('**/app.js*', async (route) => {
    const res = await route.fetch();
    let src = await res.text();
    const alt = 'if (!currentProfile.player_id) { renderPlayerLink();';
    if (!src.includes(alt)) throw new Error('Einhaengepunkt fehlt');
    src = src.replace(alt, 'currentProfile.player_id = currentProfile.player_id || (DEMO.players[0] || {}).id;\n      if (!currentProfile.player_id) { renderPlayerLink();');
    if (fall === 'B') {
      const a2 = 'const r         = state.rsvp[e.id + "|" + state.currentPlayerId] || {};';
      if (!src.includes(a2)) throw new Error('Einhaengepunkt 2 fehlt');
      src = src.replace(a2, 'const r         = { status: "zu", grund: "" };');
    }
    await route.fulfill({ response: res, body: src, headers: { ...res.headers(), 'content-type': 'application/javascript' } });
  });
}

await p.goto(basis, { waitUntil: 'networkidle' }); await p.waitForTimeout(1200);
await p.fill('input[type="email"]', process.env.APP_USER);
await p.fill('input[type="password"]', process.env.APP_PASS);
await p.click('.auth-submit'); await p.waitForSelector('.app-nav', { timeout: 25000 }); await p.waitForTimeout(2500);

const zeig = async (was, fn) => console.log(('  ' + was).padEnd(34) + await p.evaluate(fn));
console.log('Fall ' + fall + ':');
await zeig('Hero vorhanden', () => document.querySelector('.termin-hero') ? 'ja' : 'nein');
await zeig('Trainer-Knopfzeile', () => document.querySelector('.th-actions') ? 'ja' : 'nein');
await zeig('Selbst-Zeile', () => document.querySelector('.th-self') ? 'ja' : 'nein');
await zeig('Text links', () => (document.querySelector('.th-self-t') || {}).textContent || '-');
await zeig('Knopfmasse sichtbar', () => [...document.querySelectorAll('.th-mini')].map((e) => { const r = e.getBoundingClientRect(); return e.textContent + ' ' + r.width.toFixed(0) + 'x' + r.height.toFixed(0); }).join(', ') || '-');
await zeig('Trefferflaeche 44 px', () => {
  const a = document.querySelectorAll('.th-mini'); if (!a.length) return '-';
  return [...a].map((e) => { const r = e.getBoundingClientRect();
    const tr = (dy) => { const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2 + dy); return t && t.closest('.th-mini') === e; };
    return e.textContent + ': ' + (tr(-21) && tr(21) ? 'ja' : 'nein'); }).join(', ');
});
await zeig('waagerecht', () => document.documentElement.scrollWidth + ' = ' + document.documentElement.clientWidth);
if (fall === 'A') await p.screenshot({ path: '.design-sync/reference/app/uebersicht-spielertrainer.png', fullPage: true });
console.log('  Fehler: ' + (fehler.length ? fehler.join(' | ') : 'keine'));
await b.close(); server.close();
