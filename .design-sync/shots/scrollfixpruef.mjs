/* Scroll im Rückmeldungen-Blatt und in den übrigen Blättern (Nachtlauf 18.10.2026).
   Stand-in ohne Datenbank, 390 x 844, Touch an, WebKit und Chromium. Der Kader
   wird auf 30 erfundene Spieler erweitert, zum nächsten Spiel gibt es keine
   Rückmeldung: die Namensliste unter „Offen“ ist lang und muss scrollen.
   Gemessen:
     - Liste scrollt bis unten (Mausrad über der Liste), Hintergrund bleibt stehen
     - eine Scroll-Geste in der Liste (Finger nach oben) schreibt nichts ins Blatt
       und wird nicht abgefangen
     - nicht-passive touchmove-Listener, solange das Blatt offen ist
     - Ziehen am Griff schließt das Blatt, Ziehen bei Liste ganz oben auch
     - Long Tasks (nur Chromium) während des Scrollens
   Aufruf: node .design-sync/shots/scrollfixpruef.mjs [vorher|nachher] [videoordner]
   Ohne Argument: nachher (mit Prüfung, Rückgabe 1 bei Fehler).               */
import { chromium, webkit } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { starte } from './server.mjs';
import { installiere, warteAufApp, daten } from './landkartenmodul.mjs';

const MODUS = process.argv[2] || 'nachher';
const VIDEO = process.argv[3];
const fehler = [];
const pruefe = (ok, t, d) => { console.log((ok ? '  ok   ' : '  FEHL ') + t + (!ok && d !== undefined ? '   ' + d : '')); if (!ok) fehler.push(t); };

// 30 Spieler, keine Rückmeldung zum Spiel e-sp1
function langeListe() {
  const d = daten();
  const vor = ['Anton', 'Ben', 'Carl', 'Dario', 'Elias', 'Finn', 'Gabriel', 'Hannes', 'Ilias', 'Jonas', 'Kilian', 'Luca', 'Malte', 'Noah'];
  const nach = ['Achter', 'Brandl', 'Christ', 'Dorn', 'Engel', 'Feld', 'Graf', 'Hecht', 'Imhof', 'Jung', 'Kern', 'Lutz', 'Mohr', 'Nagel'];
  const muster = d.players[0];
  for (let i = 0; i < 14; i++) d.players.push({ ...muster, id: 'px' + i, name: vor[i] + ' ' + nach[i], nummer: 30 + i, number: 30 + i, status: 'fit', statusNote: null, statusUntil: null });
  d.rsvps = d.rsvps.filter((r) => r.eventId !== 'e-sp1');
  return d;
}

// Vor dem App-Code: Registrierung aller touchmove-Listener mitschreiben (passiv oder nicht)
const LISTENER_PROTOKOLL = () => {
  window.__tm = [];
  const add = EventTarget.prototype.addEventListener, rem = EventTarget.prototype.removeEventListener;
  const passiv = (o) => (typeof o === 'object' && o !== null ? !!o.passive : false);
  const ziel = (t) => t === window ? 'window' : t === document ? 'document' : (t && t.id ? '#' + t.id : (t && t.className ? '.' + String(t.className).split(' ')[0] : '?'));
  EventTarget.prototype.addEventListener = function (typ, fn, o) {
    if (typ === 'touchmove') window.__tm.push({ t: this, fn, passiv: passiv(o), ziel: ziel(this), weg: false });
    return add.call(this, typ, fn, o);
  };
  EventTarget.prototype.removeEventListener = function (typ, fn, o) {
    if (typ === 'touchmove') for (const e of window.__tm) if (e.t === this && e.fn === fn) e.weg = true;
    return rem.call(this, typ, fn, o);
  };
};

// Touch-Geste per synthetischen Events (Handler-Logik; native Scrolls kann Playwright nicht wischen)
async function geste(page, sel, punkte) {
  return page.evaluate(({ sel, punkte }) => {
    const el = document.querySelector(sel); if (!el) return null;
    const r = el.getBoundingClientRect(), x = r.left + r.width / 2;
    const ev = (typ, y) => { const e = new Event(typ, { bubbles: true, cancelable: true }); const t = [{ clientX: x, clientY: y, identifier: 1, target: el }];
      Object.defineProperty(e, 'touches', { value: typ === 'touchend' ? [] : t }); Object.defineProperty(e, 'changedTouches', { value: t }); return e; };
    const y0 = r.top + Math.min(r.height / 2, punkte.start);
    let verhindert = 0;
    const s = ev('touchstart', y0); el.dispatchEvent(s); if (s.defaultPrevented) verhindert++;
    for (const d of punkte.wege) { const m = ev('touchmove', y0 + d); el.dispatchEvent(m); if (m.defaultPrevented) verhindert++; }
    const e = ev('touchend', y0 + punkte.wege[punkte.wege.length - 1]); el.dispatchEvent(e);
    return { verhindert };
  }, { sel, punkte });
}

const { server, basis } = await starte(process.cwd());
for (const [name, typ] of [['webkit', webkit], ['chromium', chromium]]) {
  console.log('\n--- ' + name + ' (' + MODUS + ') ---');
  const browser = await typ.launch(name === 'chromium' ? { channel: 'chrome' } : {});
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: name === 'chromium', deviceScaleFactor: 2,
    ...(VIDEO ? { recordVideo: { dir: VIDEO, size: { width: 390, height: 844 } } } : {}) });
  const page = await ctx.newPage();
  await page.addInitScript(LISTENER_PROTOKOLL);
  await installiere(page, 'trainer', { daten: langeListe() });
  await page.goto(basis, { waitUntil: 'load' }); await warteAufApp(page);
  // Hintergrund etwas gescrollt, damit "steht still" messbar ist
  await page.evaluate(() => window.scrollTo(0, 120)); await page.waitForTimeout(200);
  await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(200);
  await page.click('[data-rsvp-sheet="e-sp1"]'); await page.waitForTimeout(700);
  const L = '#rsvpSheet .rs2-liste', P = '#rsvpSheet .more-panel';
  const start = await page.evaluate((L) => { const l = document.querySelector(L);
    return { offen: l ? l.querySelectorAll('.rs2-zeile').length : 0, ueber: l ? l.scrollHeight - l.clientHeight : 0, bodyTop: document.body.style.top, sy: window.scrollY }; }, L);
  pruefe(start.offen >= 20 && start.ueber > 100, name + ': lange Liste unter Offen (' + start.offen + ' Namen, ' + start.ueber + ' px Überhang)', JSON.stringify(start));

  // Long Tasks (Chromium) mitschreiben
  await page.evaluate(() => { window.__lt = 0; try { new PerformanceObserver((l) => { window.__lt += l.getEntries().length; }).observe({ entryTypes: ['longtask'] }); } catch (e) { window.__lt = -1; } });
  // Stilaenderungen am Blatt zaehlen
  await page.evaluate((P) => { window.__stil = 0; new MutationObserver((m) => { window.__stil += m.length; }).observe(document.querySelector(P), { attributes: true, attributeFilter: ['style'] }); }, P);

  // 1) Scroll-Geste in der Liste, Liste oben, Finger nach oben (= weiter nach unten lesen)
  const g1 = await geste(page, L, { start: 200, wege: [-8, -20, -40, -80, -120, -160] });
  const stil1 = await page.evaluate(() => window.__stil);
  // 2) Mausrad über der Liste bis ganz unten
  const box = await page.$eval(L, (l) => { const r = l.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await page.mouse.move(box.x, box.y);
  for (let i = 0; i < 12; i++) { await page.mouse.wheel(0, 250); await page.waitForTimeout(60); }
  await page.waitForTimeout(400);
  const nachRad = await page.evaluate((L) => { const l = document.querySelector(L); return { top: Math.round(l.scrollTop), max: l.scrollHeight - l.clientHeight, bodyTop: document.body.style.top, sy: window.scrollY, lt: window.__lt }; }, L);
  // 3) Liste unten, Finger nach unten (zurück nach oben lesen): kein Ziehen des Blatts
  await page.evaluate(() => { window.__stil = 0; });
  const g3 = await geste(page, L, { start: 200, wege: [10, 30, 60, 100, 140] });
  const stil3 = await page.evaluate(() => window.__stil);
  const offen3 = await page.evaluate(() => !!document.querySelector('#rsvpSheet'));
  // 4) nicht-passive touchmove-Listener, solange das Blatt offen ist
  const np = await page.evaluate(() => window.__tm.filter((e) => !e.weg && !e.passiv && (e.t === window || e.t === document || document.contains(e.t))).map((e) => e.ziel));

  console.log('  Messung: Geste Liste oben/Finger hoch: ' + stil1 + ' Stiländerungen am Blatt, ' + (g1 && g1.verhindert) + ' abgefangen · Rad: scrollTop ' + nachRad.top + '/' + nachRad.max +
    ', Hintergrund ' + JSON.stringify([start.sy, nachRad.sy, start.bodyTop, nachRad.bodyTop]) + ' · Liste unten/Finger runter: ' + stil3 + ' Stiländerungen, ' + (g3 && g3.verhindert) + ' abgefangen · nicht-passive touchmove: ' + JSON.stringify(np) + ' · Long Tasks: ' + nachRad.lt);
  if (MODUS === 'nachher') {
    pruefe(stil1 === 0 && g1.verhindert === 0, name + ': Scroll-Geste in der Liste ändert das Blatt nicht und wird nicht abgefangen', stil1 + '/' + g1.verhindert);
    pruefe(nachRad.top >= nachRad.max - 2, name + ': Liste scrollt bis unten', nachRad.top + '/' + nachRad.max);
    pruefe(nachRad.sy === start.sy && nachRad.bodyTop === start.bodyTop, name + ': Hintergrund bleibt stehen', JSON.stringify([start, nachRad]));
    pruefe(stil3 === 0 && g3.verhindert === 0 && offen3, name + ': Liste nicht oben, Finger runter: Blatt bleibt, Liste scrollt', stil3 + '/' + g3.verhindert);
    pruefe(np.length === 0, name + ': kein nicht-passiver touchmove-Listener, solange das Blatt offen ist', JSON.stringify(np));
  }
  // 5) Ziehen am Griff schließt
  await page.evaluate((L) => { document.querySelector(L).scrollTop = 0; }, L);
  const g5 = await geste(page, '#rsvpSheet .rs2-griff', { start: 2, wege: [20, 60, 120, 160] });
  await page.waitForTimeout(500);
  const zu5 = await page.evaluate(() => !document.querySelector('#rsvpSheet'));
  if (MODUS === 'nachher') pruefe(zu5, name + ': Ziehen am Griff schließt das Blatt', JSON.stringify(g5));
  // 6) Liste ganz oben, Finger nach unten in der Liste: schließt ebenfalls
  await page.click('[data-rsvp-sheet="e-sp1"]'); await page.waitForTimeout(600);
  await geste(page, L, { start: 40, wege: [20, 60, 120, 160] }); await page.waitForTimeout(500);
  const zu6 = await page.evaluate(() => !document.querySelector('#rsvpSheet'));
  if (MODUS === 'nachher') pruefe(zu6, name + ': Liste ganz oben, nach unten ziehen schließt das Blatt');

  // Andere Blätter: Kalender-Abo, Mein Status, Kader (Trainer), Kasse (Reiter wischen)
  if (MODUS === 'nachher') {
    await page.goto(basis + '#ansicht=kalender', { waitUntil: 'load' }); await warteAufApp(page);
    const abo = await page.$('[data-cal-sheet]');
    if (abo) {
      await abo.click(); await page.waitForTimeout(500);
      const np2 = await page.evaluate(() => window.__tm.filter((e) => !e.weg && !e.passiv && (e.t === window || e.t === document || document.contains(e.t))).map((e) => e.ziel));
      pruefe(np2.length === 0, name + ': Kalender-Abo-Blatt ohne nicht-passiven touchmove-Listener', JSON.stringify(np2));
      await geste(page, '#calSheet .more-panel', { start: 10, wege: [30, 80, 140] }); await page.waitForTimeout(500);
      pruefe(await page.evaluate(() => !document.querySelector('#calSheet:not([hidden])')), name + ': Kalender-Abo-Blatt schließt beim Ziehen');
    }
  }
  await ctx.close(); await browser.close();
  if (VIDEO) {
    const v = fs.readdirSync(VIDEO).filter((f) => f.endsWith('.webm') && !/^(vorher|nachher)-/.test(f));
    for (const f of v) fs.renameSync(path.join(VIDEO, f), path.join(VIDEO, `${MODUS}-${name}.webm`));
  }
}
server.close();
console.log(fehler.length ? `\n--- ${fehler.length} Beanstandung(en) ---` : '\n--- ' + (MODUS === 'nachher' ? 'bestanden' : 'Messung vorher abgeschlossen') + ' ---');
process.exit(MODUS === 'nachher' && fehler.length ? 1 : 0);
