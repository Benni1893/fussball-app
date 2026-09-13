/* Fragt den Datenstand ueber den angemeldeten Client der Seite ab.
   Aufruf: APP_USER=... APP_PASS=... node .design-sync/shots/db-check.mjs   */
import { chromium } from 'playwright';
import { starte } from './server.mjs';

const { server, basis } = await starte(process.cwd());
const b = await chromium.launch({ channel: 'chrome' });
const ctx = await b.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
});
const p = await ctx.newPage();
await p.goto(basis, { waitUntil: 'networkidle' });
await p.waitForTimeout(1200);
await p.fill('input[type="email"]', process.env.APP_USER);
await p.fill('input[type="password"]', process.env.APP_PASS);
await p.click('.auth-submit');
await p.waitForSelector('.app-nav', { timeout: 25000 });
await p.waitForTimeout(2500);

const bericht = await p.evaluate(async () => {
  const out = [];
  const d = await window.DB.loadAll();
  out.push('Spieler (' + d.players.length + '):');
  out.push('  ' + d.players.map((x) => x.name).join(' | '));
  out.push('Aufstellungen:');
  d.lineups.forEach((l) => out.push('  name="' + l.name + '" eventId=' + (l.eventId || 'NULL')
    + ' isTemplate=' + l.isTemplate + ' isActive=' + l.isActive));
  out.push('Strafen: ' + d.strafen.length
    + ' | Status: ' + [...new Set(d.strafen.map((s) => s.status || '(leer)'))].join(' / ')
    + ' | selfReported: ' + d.strafen.filter((s) => s.selfReported).length);
  return out.join('\n');
});
console.log(bericht);
await b.close();
server.close();
