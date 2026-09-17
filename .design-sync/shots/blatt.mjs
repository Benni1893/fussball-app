/* Nimmt das Rueckmeldungen-Blatt auf (Bildschirmausschnitt, keine ganze Seite). */
import { chromium } from 'playwright';
import path from 'node:path';
import { starte } from './server.mjs';
const { server, basis } = await starte(process.cwd());
const b = await chromium.launch({ channel: 'chrome' });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' });
const p = await ctx.newPage();
await p.goto(basis, { waitUntil: 'networkidle' }); await p.waitForTimeout(1200);
await p.fill('input[type="email"]', process.env.APP_USER);
await p.fill('input[type="password"]', process.env.APP_PASS);
await p.click('.auth-submit'); await p.waitForSelector('.app-nav', { timeout: 25000 }); await p.waitForTimeout(2200);
await p.evaluate(() => document.querySelector('.nav-btn[data-view="kalender"]').click()); await p.waitForTimeout(900);
await p.evaluate(() => document.querySelector('[data-rsvp-sheet]').click()); await p.waitForTimeout(900);
const ziel = path.join(process.cwd(), '.design-sync', 'reference', 'app', 'rueckmeldungen-sheet.png');
await p.screenshot({ path: ziel });
console.log('  rueckmeldungen-sheet      390 x 844');
await b.close(); server.close();
