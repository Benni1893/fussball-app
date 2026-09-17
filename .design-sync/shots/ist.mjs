import { chromium } from 'playwright';
import { starte } from './server.mjs';
const { server, basis } = await starte(process.cwd());
const b = await chromium.launch({ channel: 'chrome' });
const ctx = await b.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:3, isMobile:true, hasTouch:true,
  userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' });
const p = await ctx.newPage();
await p.goto(basis, { waitUntil:'networkidle' }); await p.waitForTimeout(1200);
await p.fill('input[type="email"]', process.env.APP_USER);
await p.fill('input[type="password"]', process.env.APP_PASS);
await p.click('.auth-submit');
await p.waitForSelector('.app-nav', { timeout:25000 }); await p.waitForTimeout(2200);
await p.evaluate(() => document.getElementById('navMore').click()); await p.waitForTimeout(400);
await p.evaluate(() => document.getElementById('moreLineup').click()); await p.waitForTimeout(1600);
console.log('=== Trainer, Ist-Zustand ===');
console.log(await p.evaluate(() => {
  const o = [], m = (sel, name) => {
    const e = document.querySelector(sel);
    if (!e) { o.push('  ' + name.padEnd(24) + 'FEHLT'); return; }
    const c = getComputedStyle(e), r = e.getBoundingClientRect();
    o.push('  ' + name.padEnd(24) + Math.round(r.width) + 'x' + Math.round(r.height)
      + '  ' + c.fontSize + '/' + c.fontWeight);
  };
  m('.page-head h1', 'Titel');
  m('.tv-kader', 'Kader-Karte');
  m('.tv-kader-z', 'Kader-Zahlen');
  m('.tv-glist', 'Spielliste');
  m('.tv-gcard', 'Spielkarte');
  m('.tv-gchip', 'Spiel-Plakette');
  m('.tv-mehr', 'Umschalter');
  m('.tv-tpls', 'Vorlagenliste');
  o.push('  Naechstes-Spiel-Karte   ' + (document.querySelector('.tv-naechstes') ? 'da' : 'FEHLT'));
  o.push('  Abschnitt WEITERE       ' + ([...document.querySelectorAll('.section-title h2')].map(x=>x.textContent).join(' | ') || '-'));
  return o.join('\n');
}));
// Sheet oeffnen
await p.evaluate(() => document.querySelector('.nav-btn[data-view="dashboard"]').click()); await p.waitForTimeout(900);
const sheet = await p.evaluate(() => { const b2 = document.querySelector('[data-rsvp-sheet]'); if (!b2) return false; b2.click(); return true; });
await p.waitForTimeout(900);
console.log('\n=== Sheet, Ist-Zustand ===');
console.log(sheet ? await p.evaluate(() => {
  const o = [], m = (sel, name) => {
    const e = document.querySelector(sel);
    if (!e) { o.push('  ' + name.padEnd(24) + 'FEHLT'); return; }
    const c = getComputedStyle(e), r = e.getBoundingClientRect();
    o.push('  ' + name.padEnd(24) + Math.round(r.width) + 'x' + Math.round(r.height) + '  ' + c.fontSize + '/' + c.fontWeight);
  };
  m('#rsvpSheet .more-panel', 'Blatt');
  m('#rsvpSheet .more-title', 'Titel');
  m('.rs-group', 'Gruppe');
  m('.rs-head', 'Gruppentitel');
  m('.rs-row', 'Namenszeile');
  o.push('  Schliessen-Knopf        ' + (document.querySelector('#rsvpSheet .sheet-x') ? 'da' : 'FEHLT'));
  o.push('  Kennzahlkacheln         ' + (document.querySelector('#rsvpSheet .kpi') ? 'da' : 'FEHLT'));
  o.push('  Fortschrittsbalken      ' + (document.querySelector('#rsvpSheet .rs-bar') ? 'da' : 'FEHLT'));
  o.push('  Fusszeile mit Knoepfen  ' + (document.querySelector('#rsvpSheet .rs-foot') ? 'da' : 'FEHLT'));
  o.push('  Zweispaltig             ' + (getComputedStyle(document.querySelector('.rs-list') || document.body).display));
  return o.join('\n');
}) : '  Sheet liess sich nicht oeffnen (kein Trainer-Termin sichtbar)');
await b.close(); server.close();
