/* Nimmt jeden Screen der laufenden App in iPhone-Groesse auf.
   Aufruf aus dem Repo-Wurzelverzeichnis:
     APP_USER=... APP_PASS=... node .design-sync/shots/app.mjs [screen ...]
   Ohne Screen-Argumente werden alle aufgenommen.                             */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { starte } from './server.mjs';

const { server, basis: LOKAL } = await starte(process.cwd());
const URL  = process.env.APP_URL || LOKAL;   // leer = Arbeitsstand lokal aufnehmen
const USER = process.env.APP_USER || '';
const PASS = process.env.APP_PASS || '';
const OUT  = path.join(process.cwd(), '.design-sync', 'reference', 'app');
fs.mkdirSync(OUT, { recursive: true });

const only = process.argv.slice(2);
const will = (n) => !only.length || only.includes(n);

const browser = await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 '
           + '(KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
});
const page = await ctx.newPage();
const fehler = [];
page.on('pageerror', (e) => fehler.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') fehler.push('console: ' + m.text()); });

const ruhe = async (ms = 700) => { await page.waitForTimeout(ms); };
// Ganze Seite inklusive fixer Kopfzeile und Nav - so, wie das iPhone sie zeigt.
const schuss = async (name) => {
  await ruhe(350);
  await page.screenshot({ path: path.join(OUT, name + '.png'), fullPage: true });
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  console.log('  ' + name.padEnd(24) + '390 x ' + h);
};
const tippe = async (sel) => { await page.click(sel); await ruhe(500); };
const nav = async (view) => { await tippe(`.nav-btn[data-view="${view}"]`); };

await page.goto(URL, { waitUntil: 'networkidle' });
await ruhe(1200);

// ---- Anmeldung (ohne Konto sichtbar) ---------------------------------------
// Die Nav liegt immer im DOM; entscheidend ist, ob die Anmeldekarte sichtbar ist.
const imLogin = await page.evaluate(() => {
  const c = document.querySelector('.auth-card');
  return !!(c && c.getBoundingClientRect().height > 0);
});
if (imLogin) {
  if (will('anmeldung')) await schuss('anmeldung');
  if (!USER || !PASS) {
    console.log('\nKein Konto gesetzt (APP_USER/APP_PASS) - nur die Anmeldung aufgenommen.');
    await browser.close(); server.close(); process.exit(0);
  }
  await page.fill('.auth-field input[type="email"], input[type="email"]', USER);
  await page.fill('input[type="password"]', PASS);
  await page.click('.auth-submit');
  await page.waitForSelector('.app-nav', { timeout: 25000 });
  await ruhe(1800);
}

// ---- Rollenvorschau umschalten (Admin) -------------------------------------
async function alsRolle(rolle) {
  await nav('dashboard');
  await page.evaluate(() => {
    const b = document.getElementById('navMore');
    if (b) b.click();
  });
  await ruhe(400);
  const admin = await page.$('#moreAdmin');
  if (admin) { await page.evaluate(() => document.getElementById('moreAdmin').click()); await ruhe(900); }
  const sel = `[data-sim="${rolle}"]`;
  if (await page.$(sel)) { await tippe(sel); await ruhe(1200); }
}

// ---- Admin-Sicht ------------------------------------------------------------
if (will('uebersicht-trainer')) { await nav('dashboard'); await schuss('uebersicht-trainer'); }
if (will('kalender'))           { await nav('kalender');  await schuss('kalender'); }
if (will('katalog'))            { await nav('katalog');   await schuss('katalog'); }
if (will('konto'))              { await nav('strafen');   await schuss('konto'); }

// Spezialbereiche liegen hinter dem Mehr-Menue.
async function ueberMehr(id, name) {
  await page.evaluate(() => document.getElementById('navMore').click());
  await ruhe(400);
  if (will(name)) {
    await page.evaluate((i) => document.getElementById(i).click(), id);
    await ruhe(1100);
    await schuss(name);
  } else {
    await page.evaluate(() => { const s = document.getElementById('moreSheet'); if (s) s.hidden = true; });
  }
}
await ueberMehr('moreLineup',        'trainer-spielauswahl');
if (will('trainer-platz')) {
  const karte = await page.$('[data-tvgame]');
  if (karte) { await karte.click(); await ruhe(1200); await schuss('trainer-platz'); }
  else console.log('  trainer-platz            uebersprungen: kein anstehendes Spiel');
}
await ueberMehr('moreKasse',         'kasse');
await ueberMehr('moreKader',         'kader');
await ueberMehr('moreAdmin',         'rollen');
await ueberMehr('moreEinstellungen', 'einstellungen');
await ueberMehr('moreProfil',        'profil');

// Mehr-Menue selbst
if (will('mehr')) {
  await nav('dashboard'); await ruhe(600);
  await page.evaluate(() => document.getElementById('navMore').click());
  await ruhe(500);
  await schuss('mehr');
  await page.evaluate(() => { const s = document.getElementById('moreSheet'); if (s) s.hidden = true; });
}

// ---- Spielersicht ueber die Rollenvorschau ---------------------------------
if (will('uebersicht-spieler')) {
  await alsRolle('player');
  await nav('dashboard');
  await schuss('uebersicht-spieler');
}

if (fehler.length) { console.log('\nSeitenfehler:'); fehler.slice(0, 10).forEach((f) => console.log('  ' + f)); }
await browser.close();
server.close();
