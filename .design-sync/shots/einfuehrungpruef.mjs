/* Einfuehrung je Rolle und "So geht's", Stand Block 2 (19.10.2026,
   Plan: .design-sync/concepts/einfuehrung/PLAN.md). Stand-in, Chromium und
   WebKit, je 390 und 375 px.
   Teil 1 Einfuehrung:
     - erscheint fuer neue Konten, Seitenfolge je Rolle, hoechstens 6 Seiten
     - Ueberschrift hoechstens 5 Woerter, Text hoechstens 2 Saetze / 20 Woerter
     - Abbildungen aus HTML (keine Bilddatei), ohne Rand, passen in die Karte
     - Durchklicken und Ueberspringen merken die richtigen Teile, kommt mit
       gesehenen Teilen nicht wieder, neue Rolle zeigt nur ihre Seiten
     - Wischen per nachgestellter Touch-Geste: links vor, rechts zurueck,
       senkrecht nichts; Listener passiv (defaultPrevented bleibt false)
     - Ueberscrollen: html in der Farbe des Seitenendes, overscroll none
     - Home-Bildschirm entfaellt in der Home-Bildschirm-App, Mitteilungen auf
       dem iPhone in Safari als Hinweis statt Knopf
   Teil 2 "So geht's": erreichbar, Rollenfilter (aus dem Block SG-FRAGEN in
     app.js berechnet), hoechstens 3 Schritte je hoechstens eine Zeile,
     Abbildungen ohne Rand, Einfuehrung ansehen, Links, Zurueck-Leiste,
     Ueberscrollen.
   Bilder: .design-sync/concepts/einfuehrung/ist/<browser>_<breite>_<rolle>_<nr>_<seite>.png
   Aufruf:  node .design-sync/shots/einfuehrungpruef.mjs [--nur-einfuehrung|--sogehts]  */
import { chromium, webkit } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { starte } from './server.mjs';
import { installiere, daten } from './landkartenmodul.mjs';

const AUS = '.design-sync/concepts/einfuehrung/ist';
fs.mkdirSync(AUS, { recursive: true });
const fehler = [];
const pruefe = (ok, t, d) => { console.log((ok ? '  ok   ' : '  FEHL ') + t + (!ok && d !== undefined ? '   ' + d : '')); if (!ok) fehler.push(t); };
const NUR_EF = process.argv.includes('--nur-einfuehrung');
const NUR_SG = process.argv.includes('--sogehts');
const NUR_WK = process.argv.includes('--nur-webkit');
const NUR_CR = process.argv.includes('--nur-chromium');
// Playwright-WebKit unter Windows kennt overscroll-behavior nicht (iOS Safari ab 16 schon): dort zaehlt nur die Farbe.
const osOk = (bname, v) => v === 'none' || (bname === 'webkit' && (v === undefined || v === ''));

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';

const ROLLEN = {
  spieler:        { profil: 'spieler' },
  trainer:        { profil: 'trainer', opts: { rollen: ['player', 'coach'], ohneSpieler: true } },
  kassenwart:     { profil: 'kassenwart' },
  spielertrainer: { profil: 'trainer' },
  admin:          { profil: 'admin' },
};
// iPhone in Safari: Home-Bildschirm ja, Mitteilungen ja (nicht aktiv)
const FOLGE = {
  spieler:        ['sp_termin', 'sp_status', 'sp_strafen', 'sp_los', 'home', 'push'],
  trainer:        ['tr_rueck', 'tr_elf', 'tr_kader', 'tr_rollen', 'home', 'push'],
  kassenwart:     ['sp_termin', 'kw_kasse', 'kw_verhaengen', 'kw_pruefen', 'home', 'push'],
  spielertrainer: ['st_termin', 'tr_elf', 'tr_kader', 'tr_rollen', 'home', 'push'],
  admin:          ['st_termin', 'tr_elf', 'tr_rollen', 'kw_kasse', 'home', 'push'],
};
const TEILE = { spieler: ['spieler'], trainer: ['trainer'], kassenwart: ['spieler', 'kassenwart'], spielertrainer: ['spieler', 'trainer'], admin: ['spieler', 'trainer', 'kassenwart'] };
const HAT = { spieler: { spieler: 1 }, trainer: { trainer: 1 }, kassenwart: { spieler: 1, kassenwart: 1 }, spielertrainer: { spieler: 1, trainer: 1 }, admin: { spieler: 1, trainer: 1, kassenwart: 1, admin: 1 } };

// Fragen aus app.js (eine Quelle mit der App)
const app = fs.readFileSync('app.js', 'utf8');
const SG_FRAGEN = new Function(/\/\* SG-FRAGEN-ANFANG \*\/([\s\S]*?)\/\* SG-FRAGEN-ENDE \*\//.exec(app)[1] + '\nreturn SG_FRAGEN;')();
const fragenFuer = (rolle) => SG_FRAGEN.filter((f) => HAT[rolle].admin || f.fuer.some((x) => x === 'alle' || HAT[rolle][x])).map((f) => f.id);

const { server, basis } = await starte(process.cwd());

async function oeffne(browser, rolle, o) {
  const R = ROLLEN[rolle];
  const ctx = await browser.newContext({ viewport: { width: o.breite || 390, height: 844 }, deviceScaleFactor: 2,
    isMobile: browser.browserType().name() === 'chromium' ? true : undefined, hasTouch: true, locale: 'de-DE', timezoneId: 'Europe/Berlin',
    serviceWorkers: 'block', userAgent: o.ua || IPHONE });
  const page = await ctx.newPage();
  page.on('dialog', (d) => d.accept().catch(() => {}));
  if (o.standalone) await page.addInitScript(() => {
    try { Object.defineProperty(Navigator.prototype, 'standalone', { get() { return true; }, configurable: true }); } catch (e) {}
  });
  const inst = await installiere(page, R.profil, { ...(R.opts || {}), daten: daten(), einfuehrung: o.gesehen });
  await page.goto(basis + (o.hash || ''), { waitUntil: 'load' });
  await page.waitForFunction(() => !document.getElementById('splash') && !document.getElementById('__skeleton') && (document.querySelector('.ef-card') || document.querySelector('.app-nav')), null, { timeout: 20000 });
  await page.waitForTimeout(500);
  await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation:none!important}' });
  return { ctx, page, inst };
}
const seite = (page) => page.evaluate(() => { const c = document.querySelector('.ef-card'); return c ? c.getAttribute('data-ef-seite') : null; });
const merken = async (inst) => (await inst.protokoll()).filter((p) => p.methode === 'einfuehrungMerken').map((p) => (p.argumente[0] || []).slice().sort().join(','));
const woerter = (t) => (t.match(/[A-Za-zÄÖÜäöüß0-9…⋮][^\s]*/g) || []).length;

/* Nachgestellte Touch-Geste: touchstart/touchmove/touchend mit Koordinaten,
   cancelable, auf der Karte. Gibt zurueck, ob ein Listener preventDefault rief. */
const wische = (page, dx, dy) => page.evaluate(([dx, dy]) => {
  const ziel = document.querySelector('.ef-card .ef-text') || document.querySelector('.ef-card');
  const r = ziel.getBoundingClientRect(); const x0 = r.left + r.width / 2, y0 = r.top + 10;
  const ev = (typ, x, y) => {
    const e = new Event(typ, { bubbles: true, cancelable: true });
    const t = [{ clientX: x, clientY: y, identifier: 1, target: ziel }];
    Object.defineProperty(e, 'touches', { value: typ === 'touchend' ? [] : t });
    Object.defineProperty(e, 'changedTouches', { value: t });
    ziel.dispatchEvent(e); return e.defaultPrevented;
  };
  const a = ev('touchstart', x0, y0); const b = ev('touchmove', x0 + dx / 2, y0 + dy / 2); const c = ev('touchend', x0 + dx, y0 + dy);
  return a || b || c;
}, [dx, dy]);

/* Pruefung einer Seite: Textlaengen, Abbildungen, Ueberlauf, Hintergrund */
const seitenInfo = (page) => page.evaluate(() => {
  const k = document.querySelector('.ef-card'); const kr = k.getBoundingClientRect();
  const abb = [...k.querySelectorAll('.ef-abb')].map((a) => {
    const cs = getComputedStyle(a); const r = a.getBoundingClientRect();
    const inner = a.firstElementChild ? getComputedStyle(a.firstElementChild) : cs;
    return { h: Math.round(r.height), links: Math.round(r.left - kr.left), rechts: Math.round(kr.right - r.right),
      rand: [cs.borderTopWidth, cs.borderLeftWidth, cs.outlineStyle, inner.borderTopWidth].join('/'),
      inert: a.hasAttribute('inert') || a.getAttribute('aria-hidden') === 'true', ueber: a.scrollWidth > a.clientWidth + 1 };
  });
  const html = getComputedStyle(document.documentElement);
  return { titel: (k.querySelector('.auth-title') || {}).textContent || '', text: (k.querySelector('.ef-text') || {}).textContent || '',
    abb, bilder: [...k.querySelectorAll('img')].map((i) => i.getAttribute('src')).filter((s) => !/icon-192|logo/.test(s)),
    punkte: k.querySelectorAll('.ef-punkt').length, an: [...k.querySelectorAll('.ef-punkt')].findIndex((p) => p.classList.contains('is-an')),
    skip: !!k.querySelector('[data-ef="ueberspringen"]'), breite: document.documentElement.scrollWidth,
    htmlBg: html.backgroundColor, htmlOs: html.overscrollBehaviorY,
    pushKnopf: !!k.querySelector('[data-ef="push"]'), pushHinweis: !!k.querySelector('[data-ef-push-hinweis]') };
});

/* ===== Teil 1: Einfuehrung ===== */
for (const [bname, btyp] of (NUR_SG ? [] : [['chromium', chromium], ['webkit', webkit]].filter(([n]) => (!NUR_WK || n === 'webkit') && (!NUR_CR || n === 'chromium')))) {
  const browser = await btyp.launch(bname === 'chromium' ? { channel: 'chrome' } : {});
  for (const breite of [390, 375]) {
    console.log('\n===== ' + bname + ' ' + breite + ' px =====');
    for (const rolle of Object.keys(ROLLEN)) {
      const { ctx, page, inst } = await oeffne(browser, rolle, { gesehen: [], breite });
      const ids = [];
      for (let i = 0; i < 10; i++) {
        const s = await seite(page);
        if (!s) break;
        ids.push(s);
        await page.waitForTimeout(150);
        if (breite === 390 && (bname === 'webkit' || rolle === 'admin' || rolle === 'trainer')) await page.screenshot({ path: path.join(AUS, bname + '_' + breite + '_' + rolle + '_' + String(i + 1).padStart(2, '0') + '_' + s + '.png'), fullPage: true });
        const x = await seitenInfo(page);
        const saetze = (x.text.match(/[.!?](\s|$)/g) || []).length;
        pruefe(woerter(x.titel) <= 5 && woerter(x.text) <= 20 && saetze <= 2 && x.titel.length > 0,
          `${rolle} ${i + 1} ${s}: Überschrift ${woerter(x.titel)} Wörter, Text ${woerter(x.text)} Wörter / ${saetze} Sätze`, JSON.stringify([x.titel, x.text]));
        pruefe(x.an === i && x.skip && x.breite <= breite && x.bilder.length === 0, `${rolle} ${i + 1}: Punkt, Überspringen, kein Querscrollen, keine Bilddatei`, JSON.stringify(x).slice(0, 300));
        for (const a of x.abb) pruefe(a.h > 20 && a.links >= 0 && a.rechts >= 0 && !a.ueber && a.inert && /^0px\/0px\/none\/0px$/.test(a.rand),
          `${rolle} ${i + 1}: Abbildung sichtbar, in der Karte, ohne Rand, nicht bedienbar`, JSON.stringify(a));
        pruefe(x.htmlBg === 'rgb(10, 44, 33)' && osOk(bname, x.htmlOs), `${rolle} ${i + 1}: Überscrollen ohne Farbkante (html wie Seitenende)`, x.htmlBg + ' ' + x.htmlOs);
        if (s === 'push') pruefe(x.pushHinweis && !x.pushKnopf, `${rolle}: iPhone in Safari - Hinweis statt Knopf`);
        if (['sp_termin', 'st_termin', 'tr_rueck', 'tr_elf', 'tr_kader', 'tr_rollen', 'kw_kasse', 'kw_pruefen', 'sp_los', 'sp_status', 'sp_strafen'].indexOf(s) >= 0)
          pruefe(x.abb.length >= 1, `${rolle} ${s}: hat eine Abbildung`);
        await page.click('[data-ef="weiter"]');
        await page.waitForTimeout(200);
      }
      pruefe(JSON.stringify(ids) === JSON.stringify(FOLGE[rolle]) && ids.length <= 6, `${rolle}: Seitenfolge (${ids.length} Seiten)`, JSON.stringify(ids));
      const nachher = await page.evaluate(() => ({ ef: !!document.querySelector('.ef-card'), auth: document.body.classList.contains('auth-mode'), html: document.documentElement.className }));
      pruefe(!nachher.ef && !nachher.auth && !/ef-offen/.test(nachher.html), `${rolle}: danach die App, html ohne ef-offen`, JSON.stringify(nachher));
      pruefe(JSON.stringify(await merken(inst)) === JSON.stringify([TEILE[rolle].slice().sort().join(',')]), `${rolle}: gemerkt ${TEILE[rolle].join('+')}`, JSON.stringify(await merken(inst)));
      const b = await inst.bericht();
      pruefe(b.fehler.length === 0 && b.verstoesse.length === 0, `${rolle}: Stand-in ohne Fehler`, JSON.stringify(b.fehler.concat(b.verstoesse).slice(0, 3)));
      await ctx.close();
    }

    // Wischen (nachgestellte Touch-Geste)
    {
      const { ctx, page } = await oeffne(browser, 'spieler', { gesehen: [], breite });
      const p1 = await seite(page);
      const prev1 = await wische(page, -120, 8); await page.waitForTimeout(250);
      const p2 = await seite(page);
      const prev2 = await wische(page, 0, -200); await page.waitForTimeout(250);
      const p3 = await seite(page);
      const prev3 = await wische(page, 30, 4); await page.waitForTimeout(250);
      const p4 = await seite(page);
      const prev4 = await wische(page, 120, -10); await page.waitForTimeout(250);
      const p5 = await seite(page);
      const prev5 = await wische(page, 140, 0); await page.waitForTimeout(250);
      const p6 = await seite(page);
      pruefe(p1 === 'sp_termin' && p2 === 'sp_status', 'Wischen nach links: nächste Seite', p1 + ' -> ' + p2);
      pruefe(p3 === 'sp_status', 'senkrecht wischen: Seite bleibt (Scrollen bleibt möglich)', p3);
      pruefe(p4 === 'sp_status', 'kurzes Wischen unter 50 px: Seite bleibt', p4);
      pruefe(p5 === 'sp_termin', 'Wischen nach rechts: vorige Seite', p5);
      pruefe(p6 === 'sp_termin', 'auf der ersten Seite nach rechts: bleibt', p6);
      pruefe(!prev1 && !prev2 && !prev3 && !prev4 && !prev5, 'Touch-Listener passiv (kein preventDefault)');
      // bis zum Ende wischen schliesst
      for (let i = 0; i < 8 && (await seite(page)); i++) { await wische(page, -150, 0); await page.waitForTimeout(220); }
      pruefe(!(await seite(page)), 'nach der letzten Seite wischen: Einführung zu');
      await ctx.close();
    }

    if (breite === 390) {
      console.log('\n--- Rollenwechsel, gesehen, standalone, Android ---');
      for (const [rolle, gesehen, soll, teil] of [
        ['kassenwart', ['spieler'], ['kw_kasse', 'kw_verhaengen', 'kw_pruefen'], 'kassenwart'],
        ['spielertrainer', ['spieler'], ['st_termin', 'tr_elf', 'tr_kader', 'tr_rollen'], 'trainer'],
        ['admin', ['spieler', 'kassenwart'], ['st_termin', 'tr_elf', 'tr_kader', 'tr_rollen'], 'trainer'],
      ]) {
        const { ctx, page, inst } = await oeffne(browser, rolle, { gesehen });
        const ids = [];
        for (let i = 0; i < 10; i++) { const s = await seite(page); if (!s) break; ids.push(s); await page.click('[data-ef="weiter"]'); await page.waitForTimeout(150); }
        pruefe(JSON.stringify(ids) === JSON.stringify(soll) && JSON.stringify(await merken(inst)) === JSON.stringify([teil]), `${rolle} (gesehen: ${gesehen.join('+')}): ${ids.join(' ')}`, JSON.stringify([ids, await merken(inst)]));
        await ctx.close();
      }
      for (const rolle of ['spieler', 'admin']) {
        const { ctx, page, inst } = await oeffne(browser, rolle, { gesehen: TEILE[rolle] });
        await page.waitForTimeout(500);
        pruefe(!(await seite(page)) && (await merken(inst)).length === 0, `${rolle}: mit gesehenen Teilen keine Einführung`);
        await ctx.close();
      }
      {
        const { ctx, page, inst } = await oeffne(browser, 'kassenwart', { gesehen: [] });
        await page.click('[data-ef="weiter"]'); await page.waitForTimeout(200);
        await page.click('[data-ef="ueberspringen"]'); await page.waitForTimeout(400);
        pruefe(!(await seite(page)) && JSON.stringify(await merken(inst)) === '["kassenwart,spieler"]', 'Überspringen auf Seite 2 zählt als gesehen');
        await ctx.close();
      }
      {
        const { ctx, page } = await oeffne(browser, 'spieler', { gesehen: [], standalone: true });
        const ids = [];
        for (let i = 0; i < 10; i++) { const s = await seite(page); if (!s) break; ids.push(s); await page.click('[data-ef="weiter"]'); await page.waitForTimeout(150); }
        pruefe(ids.indexOf('home') < 0 && ids.length <= 6 && ids[ids.length - 1] === 'push', 'Home-Bildschirm-App: ohne Seite Home-Bildschirm', ids.join(' '));
        await ctx.close();
      }
      if (bname === 'chromium') {
        const { ctx, page } = await oeffne(browser, 'spieler', { gesehen: [], ua: ANDROID });
        for (let i = 0; i < 10; i++) { const s = await seite(page); if (!s || s === 'push') break; await page.click('[data-ef="weiter"]'); await page.waitForTimeout(150); }
        const p = await page.evaluate(() => ({ knopf: !!document.querySelector('[data-ef="push"]'), nicht: (document.querySelector('.ob-fuss .ob-spaeter') || {}).textContent }));
        pruefe(p.knopf && /Nicht jetzt/.test(p.nicht || ''), 'Android: Knopf „Mitteilungen erlauben“ und „Nicht jetzt“', JSON.stringify(p));
        await ctx.close();
      }
    }
  }
  await browser.close();
}

/* ===== Teil 2: So geht's ===== */
const ZIEL = {
  '#ein=profil': () => !!document.querySelector('.pr-kopf'),
  '#ein=mitteilungen': () => (document.querySelector('.ein-h1') || {}).textContent === 'Mitteilungen',
  '#ein=ruhezeiten': () => (document.querySelector('.ein-h1') || {}).textContent === 'Ruhezeiten',
  '#ein=kalender': () => (document.querySelector('.ein-h1') || {}).textContent === 'Kalender abonnieren',
  '#ansicht=admin': () => /^Rollen verwalten/.test(document.getElementById('view').innerText),
  '#ansicht=kalender': () => !!document.querySelector('.nav-btn.is-active[data-view="kalender"]'),
  '#ansicht=dashboard': () => !!document.querySelector('.nav-btn.is-active[data-view="dashboard"]'),
  '#kasse=offen': () => /Kasse/.test(document.getElementById('view').innerText),
  '#strafen=offen': () => !!document.querySelector('[data-kseg="ich"]'),
};
const sgSeite = (page) => page.evaluate(() => ({ h1: (document.querySelector('.ein-h1') || {}).textContent || '', sg: !!document.querySelector('.sg-fragen') }));

for (const [bname, btyp] of (NUR_EF ? [] : [['chromium', chromium], ['webkit', webkit]].filter(([n]) => (!NUR_WK || n === 'webkit') && (!NUR_CR || n === 'chromium')))) {
  const browser = await btyp.launch(bname === 'chromium' ? { channel: 'chrome' } : {});
  for (const breite of [390, 375]) {
    console.log("\n===== So geht's " + bname + ' ' + breite + ' px =====');
    for (const rolle of Object.keys(ROLLEN)) {
      const { ctx, page, inst } = await oeffne(browser, rolle, { gesehen: TEILE[rolle], breite, hash: '#ansicht=einstellungen' });
      await page.click('[data-ein="sogehts"]'); await page.waitForTimeout(400);
      let s = await sgSeite(page);
      const kopf = await page.evaluate(() => ({ back: (document.querySelector('[data-ein-back]') || {}).textContent || '', hash: location.hash,
        htmlBg: getComputedStyle(document.documentElement).backgroundColor, os: getComputedStyle(document.documentElement).overscrollBehaviorY }));
      pruefe(s.h1 === "So geht's" && s.sg && /Einstellungen/.test(kopf.back) && kopf.hash === '#ein=sogehts', `${rolle}: So geht's erreichbar, Zurück-Leiste`, JSON.stringify([s, kopf]));
      pruefe(kopf.htmlBg === 'rgb(231, 234, 233)' && osOk(bname, kopf.os), `${rolle}: Überscrollen ohne Farbkante (html wie Seitenende)`, kopf.htmlBg + ' ' + kopf.os);
      const ids = await page.evaluate(() => [...document.querySelectorAll('[data-sg-frage]')].map((d) => d.dataset.sgFrage));
      pruefe(JSON.stringify(ids) === JSON.stringify(fragenFuer(rolle)), `${rolle}: Rollenfilter (${ids.length} Fragen)`, JSON.stringify(ids));
      // alle aufklappen: Schritte, Zeilen, Abbildungen
      await page.evaluate(() => document.querySelectorAll('[data-sg-frage]').forEach((d) => { d.open = true; }));
      await page.waitForTimeout(200);
      const fr = await page.evaluate(() => [...document.querySelectorAll('[data-sg-frage]')].map((d) => {
        const li = [...d.querySelectorAll('.sg-schritte li')];
        const zeilen = li.map((l) => { const r = document.createRange(); r.selectNodeContents(l); return new Set([...r.getClientRects()].map((x) => Math.round(x.top))).size; });
        const abb = [...d.querySelectorAll('.ef-abb')].map((a) => { const cs = getComputedStyle(a); return { h: Math.round(a.getBoundingClientRect().height), ueber: a.scrollWidth > a.clientWidth + 1, rand: cs.borderTopWidth + '/' + cs.outlineStyle }; });
        return { id: d.dataset.sgFrage, n: li.length, zeilen, abb };
      }));
      for (const f of fr) {
        pruefe(f.n >= 1 && f.n <= 3 && f.zeilen.every((z) => z === 1), `${rolle} ${f.id}: ${f.n} Schritte, je eine Zeile`, JSON.stringify(f.zeilen));
        for (const a of f.abb) pruefe(a.h > 10 && !a.ueber && a.rand === '0px/none', `${rolle} ${f.id}: Abbildung ohne Rand, passt`, JSON.stringify(a));
      }
      if (bname === 'chromium' && breite === 390) await page.screenshot({ path: path.join(AUS, 'sogehts_' + rolle + '_offen.png'), fullPage: true });
      await page.evaluate(() => document.querySelectorAll('[data-sg-frage]').forEach((d) => { d.open = false; }));
      const mail = await page.evaluate(() => (document.querySelector('.sg-kontakt a') || {}).href || '');
      pruefe(mail === 'mailto:teamkabine-app@gmx.de', `${rolle}: Kontakt teamkabine-app@gmx.de`, mail);

      if (breite === 390) {
        // Einfuehrung ansehen: eigene Folge, endet wieder auf So geht's, schreibt nichts
        await page.click('[data-sg-ef="eigen"]'); await page.waitForTimeout(300);
        const folge = [];
        for (let i = 0; i < 10; i++) { const x = await seite(page); if (!x) break; folge.push(x); await page.click('[data-ef="weiter"]'); await page.waitForTimeout(150); }
        s = await sgSeite(page);
        pruefe(JSON.stringify(folge) === JSON.stringify(FOLGE[rolle]) && s.h1 === "So geht's" && (await merken(inst)).length === 0,
          `${rolle}: Einführung ansehen zeigt die eigene Folge, zurück auf So geht's, nichts gemerkt`, JSON.stringify([folge, s]));
        const html = await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
        pruefe(html === 'rgb(231, 234, 233)', `${rolle}: nach der Einführung wieder Hintergrund von So geht's`, html);
        if (HAT[rolle].trainer) {
          for (const [r, erste] of [['spieler', 'sp_termin'], ['trainer', 'tr_rueck'], ['kassenwart', 'sp_termin'], ['spielertrainer', 'st_termin']]) {
            await page.click(`[data-sg-ef="${r}"]`); await page.waitForTimeout(300);
            const x = await seite(page);
            await page.click('[data-ef="ueberspringen"]'); await page.waitForTimeout(300);
            s = await sgSeite(page);
            pruefe(x === erste && s.h1 === "So geht's", `${rolle}: Einführung ${r} beginnt mit ${erste}, Überspringen führt zurück`, JSON.stringify([x, s]));
          }
        }
        // Links
        const links = await page.evaluate(() => [...document.querySelectorAll('[data-sg-frage]')].flatMap((d) => [...d.querySelectorAll('.sg-link')].map((l) => ({ frage: d.dataset.sgFrage, ziel: l.dataset.sgZiel || l.getAttribute('href'), text: l.textContent }))));
        for (const l of links) {
          if (!/^#/.test(l.ziel)) { pruefe(l.ziel === 'datenschutz.html', `${rolle}: ${l.frage} › ${l.text} -> ${l.ziel}`); continue; }
          s = await sgSeite(page);
          if (s.h1 !== "So geht's") { await page.evaluate(() => { location.hash = '#ein=sogehts'; }); await page.waitForTimeout(500); }
          await page.evaluate((f) => { document.querySelector(`[data-sg-frage="${f}"]`).open = true; }, l.frage);
          await page.click(`[data-sg-frage="${l.frage}"] [data-sg-ziel="${l.ziel}"]`); await page.waitForTimeout(600);
          const ok = await page.evaluate(`(${ZIEL[l.ziel].toString()})()`);
          const html2 = await page.evaluate(() => document.documentElement.className);
          pruefe(ok && !/sg-offen/.test(html2), `${rolle}: ${l.frage} › ${l.text} -> ${l.ziel}`, JSON.stringify(await page.evaluate(() => [location.hash, (document.getElementById('view').innerText || '').slice(0, 80)])));
          if (/^#ein=/.test(l.ziel)) {
            await page.click('[data-ein-back]'); await page.waitForTimeout(500);
            s = await sgSeite(page);
            pruefe(s.h1 === "So geht's", `${rolle}: Zurück aus ${l.ziel} führt auf So geht's`, JSON.stringify(s));
          }
        }
        await page.evaluate(() => { location.hash = '#ein=sogehts'; }); await page.waitForTimeout(500);
        await page.click('[data-ein-back]'); await page.waitForTimeout(500);
        const ueb = await page.evaluate(() => ({ h1: (document.querySelector('.page-head h1') || {}).textContent || '', zeile: !!document.querySelector('[data-ein="sogehts"]'), html: document.documentElement.className }));
        pruefe(ueb.h1 === 'Einstellungen' && ueb.zeile && !/sg-offen/.test(ueb.html), `${rolle}: Zurück-Leiste führt auf Einstellungen, html wieder normal`, JSON.stringify(ueb));
      }
      const b = await inst.bericht();
      pruefe(b.fehler.length === 0 && b.verstoesse.length === 0, `${rolle}: Stand-in ohne Fehler`, JSON.stringify(b.fehler.concat(b.verstoesse).slice(0, 3)));
      await ctx.close();
    }
  }
  await browser.close();
}

server.close();
console.log(fehler.length ? `\n--- ${fehler.length} Beanstandung(en) ---` : '\n--- bestanden ---');
process.exit(fehler.length ? 1 : 0);
