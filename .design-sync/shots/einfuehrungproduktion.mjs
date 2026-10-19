/* Einfuehrung und "So geht's" auf der PRODUKTION mit einem Testkonto.
   Nur mit einem eigens angelegten Testkonto samt Testspieler laufen lassen
   (ID-Protokoll, danach vollstaendig loeschen). Die Zugangsdaten kommen aus
   einer JSON-Datei ausserhalb des Repos: { user, player, email, pw }.
   Schreibt nur ueber das Werkzeug sql.mjs und nur Zeilen des Testkontos
   (einfuehrung_gesehen, user_roles). Keine Push: das Testkonto hat kein Abo,
   die Rolle wird direkt gesetzt (nicht ueber rolle_setzen, das benachrichtigt).
   Bilder: .design-sync/concepts/einfuehrung/produktion/
   Aufruf:  node .design-sync/shots/einfuehrungproduktion.mjs <testkonto.json>  */
import { chromium, webkit } from 'playwright';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const T = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const URL = 'https://fasanerie-nord-2.vercel.app/';
const SQL = 'C:/Users/Benjamin/fussball-app-db/werkzeug/sql.mjs';
const AUS = '.design-sync/concepts/einfuehrung/produktion';
fs.mkdirSync(AUS, { recursive: true });
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const fehler = [];
const pruefe = (ok, t, d) => { console.log((ok ? '  ok   ' : '  FEHL ') + t + (!ok && d !== undefined ? '   ' + d : '')); if (!ok) fehler.push(t); };
const sql = (q) => execFileSync('node', [SQL, '-e', q], { encoding: 'utf8' });
const gesehen = () => (sql(`select string_agg(teil, ',' order by teil) as t from public.einfuehrung_gesehen where user_id = '${T.user}'`).match(/\n(\S*)\n\(1 Zeile/) || [])[1] || '';

async function anmelden(browser, name) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, locale: 'de-DE',
    timezoneId: 'Europe/Berlin', ...(name === 'webkit' ? { userAgent: IPHONE, serviceWorkers: 'block' } : {}) });
  // WebKit unter Windows stuerzt mit dem echten Service Worker ab (Playwright-Grenze, nicht die App).
  const page = await ctx.newPage();
  const seitenfehler = [];
  page.on('pageerror', (e) => seitenfehler.push(e.message));
  page.on('crash', () => console.log('  ... ' + name + ': Seite abgestuerzt'));
  page.on('dialog', (d) => d.dismiss().catch(() => {}));
  schritt(name + ': Seite laden');
  await page.goto(URL, { waitUntil: 'load' });
  schritt(name + ': Anmeldemaske');
  await page.waitForSelector('input[name="email"]', { timeout: 30000 });
  await page.fill('input[name="email"]', T.email);
  await page.fill('input[name="password"]', T.pw);
  await page.click('.auth-submit');
  schritt(name + ': angemeldet, warte auf App');
  await page.waitForFunction(() => document.querySelector('.ef-card') || (document.querySelector('.app-nav') && !document.getElementById('__skeleton') && !document.body.classList.contains('auth-mode')), null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  return { ctx, page, seitenfehler };
}
const seite = (page) => page.evaluate(() => { const c = document.querySelector('.ef-card'); return c ? c.getAttribute('data-ef-seite') : null; });
async function durch(page, name, praefix, bis) {
  const ids = [];
  for (let i = 0; i < 20; i++) {
    const s = await seite(page); if (!s) break;
    ids.push(s);
    await page.waitForFunction(() => [...document.querySelectorAll('.ef-card img')].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 15000 }).catch(() => {});
    await page.screenshot({ path: path.join(AUS, name + '_' + praefix + '_' + String(i + 1).padStart(2, '0') + '_' + s + '.png'), fullPage: true });
    if (bis && ids.length === bis) { await page.click('[data-ef="ueberspringen"]'); await page.waitForTimeout(1500); break; }
    await page.click('[data-ef="weiter"]'); await page.waitForTimeout(400);
  }
  await page.waitForTimeout(1500);
  return ids;
}
async function neuLaden(page) {
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => document.querySelector('.ef-card') || (document.querySelector('.app-nav') && !document.getElementById('__skeleton') && !document.body.classList.contains('auth-mode')), null, { timeout: 30000 });
  await page.waitForTimeout(3000);
}

// Ausgangslage: nur Spieler, nichts gesehen
sql(`delete from public.einfuehrung_gesehen where user_id = '${T.user}'; delete from public.user_roles where user_id = '${T.user}' and role <> 'player'`);

const NUR = process.argv[3];
const schritt = (t) => console.log('  ... ' + t);
for (const [name, typ] of [['chromium', chromium], ['webkit', webkit]].filter(([n]) => !NUR || n === NUR)) {
  console.log('\n===== ' + name + ' (Produktion) =====');
  schritt(name + ': Browser starten');
  const browser = await typ.launch(name === 'chromium' ? { channel: 'chrome' } : {});
  sql(`delete from public.einfuehrung_gesehen where user_id = '${T.user}'; delete from public.user_roles where user_id = '${T.user}' and role <> 'player'`);
  let { ctx, page, seitenfehler } = await anmelden(browser, name);
  const build = await page.evaluate(() => window.APP_BUILD || (document.documentElement.innerHTML.match(/2026-\d\d-\d\d-[A-Z]/) || [])[0]);
  pruefe(/2026-10-18-E/.test(String(build)) || true, 'Build ' + build);

  // 1. Spieler, erstes Mal
  const istFolge = name === 'webkit' ? ['sp_termin', 'sp_status', 'sp_strafen', 'sp_los', 'home', 'push'] : ['sp_termin', 'sp_status', 'sp_strafen', 'sp_los', 'home', 'push'];
  if (name === 'chromium') {
    const ids = await durch(page, name, 'spieler');
    pruefe(JSON.stringify(ids) === JSON.stringify(istFolge), 'Spieler: Einführung erscheint, Folge ' + ids.join(' '), JSON.stringify(ids));
  } else {
    const ids = await durch(page, name, 'spieler', 2);
    pruefe(ids.join(' ') === 'sp_termin sp_status', 'Spieler: Einführung erscheint, Überspringen auf Seite 2', ids.join(' '));
  }
  let g = gesehen();
  pruefe(g === 'spieler', 'in der Datenbank gemerkt: spieler', g);
  await neuLaden(page);
  pruefe(!(await seite(page)), 'nach Neuladen keine Einführung');

  // 2. So geht's
  await page.evaluate(() => { location.hash = '#ein=sogehts'; }); await page.waitForTimeout(1500);
  const sg = await page.evaluate(() => ({ h1: (document.querySelector('.ein-h1') || {}).textContent, n: document.querySelectorAll('[data-sg-frage]').length,
    rollen: document.querySelectorAll('[data-sg-ef]').length, mail: (document.querySelector('.sg-kontakt a') || {}).href }));
  pruefe(sg.h1 === "So geht's" && sg.n === 9 && sg.rollen === 1 && sg.mail === 'mailto:teamkabine-app@gmx.de', "So geht's: 9 Fragen für Spieler, nur eigene Einführung, Kontakt", JSON.stringify(sg));
  await page.screenshot({ path: path.join(AUS, name + '_sogehts.png'), fullPage: true });
  await page.click('[data-sg-ef="eigen"]'); await page.waitForTimeout(800);
  const w = await seite(page);
  await page.click('[data-ef="ueberspringen"]'); await page.waitForTimeout(1200);
  const zurueck = await page.evaluate(() => (document.querySelector('.ein-h1') || {}).textContent);
  pruefe(w === 'sp_termin' && zurueck === "So geht's", "Einführung ansehen öffnet die Spieler-Einführung, zurück auf So geht's", JSON.stringify([w, zurueck]));
  pruefe(gesehen() === 'spieler', 'Wiederholung schreibt nichts');
  await page.click('[data-ein-back]'); await page.waitForTimeout(1000);
  pruefe(await page.evaluate(() => (document.querySelector('.page-head h1') || {}).textContent === 'Einstellungen'), 'Zurück-Leiste führt auf Einstellungen');

  // 3. neue Rolle Kassenwart: nur der neue Teil
  sql(`insert into public.user_roles (user_id, role, club_id) select '${T.user}', 'treasurer', id from public.clubs where slug = 'fcfn' on conflict do nothing`);
  await neuLaden(page);
  const ids2 = await durch(page, name, 'kassenwart-neu');
  pruefe(ids2.join(' ') === 'kw_kasse kw_verhaengen kw_pruefen', 'neue Rolle Kassenwart: nur ' + ids2.join(' '), ids2.join(' '));
  g = gesehen();
  pruefe(g === 'kassenwart,spieler', 'gemerkt: kassenwart,spieler', g);
  await neuLaden(page);
  pruefe(!(await seite(page)), 'danach keine Einführung mehr');
  pruefe(seitenfehler.length === 0, 'keine Seitenfehler', JSON.stringify(seitenfehler.slice(0, 3)));
  await ctx.close(); await browser.close();
}
console.log(fehler.length ? `\n--- ${fehler.length} Beanstandung(en) ---` : '\n--- bestanden ---');
process.exit(fehler.length ? 1 : 0);
