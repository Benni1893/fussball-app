/* Einfuehrung je Rolle und "So geht's" (Plan: .design-sync/concepts/einfuehrung/PLAN.md).
   Stand-in, 390 px, Chromium und WebKit.
   Teil 1 Einfuehrung: erscheint fuer neue Konten, Seitenfolge je Rolle,
     Durchklicken und Ueberspringen merken die richtigen Teile, kommt mit
     gesehenen Teilen nicht wieder, neue Rolle zeigt nur ihren Teil,
     Home-Bildschirm entfaellt in der Home-Bildschirm-App, Mitteilungen auf
     dem iPhone in Safari als Hinweis statt Knopf.
   Teil 2 Messung (Chromium, neutrale Kennung wie im Entwurf): je Seite die
     Lage der Bausteine relativ zur Karte gegen den Entwurf.
   Teil 3 "So geht's": erreichbar, Einfuehrung ansehen, Rollenfilter, Links,
     Zurueck-Leiste.
   Bilder: .design-sync/concepts/einfuehrung/ist/<browser>_<rolle>_<nr>_<seite>.png
   Messung: .design-sync/concepts/einfuehrung/ist/messung.json
   Aufruf:  node .design-sync/shots/einfuehrungpruef.mjs                    */
import { chromium, webkit } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { starte } from './server.mjs';
import { installiere, daten } from './landkartenmodul.mjs';

const AUS = '.design-sync/concepts/einfuehrung/ist';
fs.mkdirSync(AUS, { recursive: true });
const fehler = [];
const pruefe = (ok, t, d) => { console.log((ok ? '  ok   ' : '  FEHL ') + t + (!ok && d !== undefined ? '   ' + d : '')); if (!ok) fehler.push(t); };

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';

const ROLLEN = {
  spieler:        { profil: 'spieler' },
  trainer:        { profil: 'trainer', opts: { rollen: ['player', 'coach'], ohneSpieler: true } },
  kassenwart:     { profil: 'kassenwart' },
  spielertrainer: { profil: 'trainer' },
  admin:          { profil: 'admin' },
};
// Erwartete Folge fuer ein neues Konto (iPhone in Safari: Home-Bildschirm ja, Mitteilungen ja)
const GEMEINSAM = ['home', 'push', 'kalender', 'fertig'];
const FOLGE = {
  spieler:        ['s_termine', 's_status', 's_konto', 's_katalog', ...GEMEINSAM],
  trainer:        ['t_rueck', 't_elf', 't_kader', 't_rollen', ...GEMEINSAM],
  kassenwart:     ['k_spieler', 'k_kasse', 'k_verhaengen', 'k_pruefen', 'k_paypal', ...GEMEINSAM],
  spielertrainer: ['st_termin', 'st_rueck', 'st_elf', 'st_kader', 'st_rollen', ...GEMEINSAM],
  admin:          ['st_termin', 'st_rueck', 'st_elf', 'st_kader', 'st_rollen', 'k_kasse', 'k_verhaengen', 'k_pruefen', 'k_paypal', ...GEMEINSAM],
};
const TEILE = { spieler: ['spieler'], trainer: ['trainer'], kassenwart: ['spieler', 'kassenwart'], spielertrainer: ['spieler', 'trainer'], admin: ['spieler', 'trainer', 'kassenwart'] };
// Entwurfsseite je App-Seite (fuer die Messung)
const ENTWURF = {
  spieler: 'Spieler', trainer: 'Trainer (spielt nicht mit)', kassenwart: 'Kassenwart', spielertrainer: 'Spielertrainer',
};

const { server, basis } = await starte(process.cwd());

async function oeffne(browser, rolle, o) {
  const R = ROLLEN[rolle];
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: browser.browserType().name() !== 'firefox' && browser.browserType().name() !== 'webkit' ? true : undefined,
    hasTouch: true, locale: 'de-DE', timezoneId: 'Europe/Berlin', serviceWorkers: 'block', ...(o.ua ? { userAgent: o.ua } : {}) });
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
async function warteBilder(page) {
  await page.waitForFunction(() => [...document.querySelectorAll('.ef-card img')].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 8000 }).catch(() => {});
}

/* Lage der Bausteine relativ zur Karte - gleiche Abfrage fuer App und Entwurf. */
const LAGE = (wurzel) => {
  const karte = wurzel.querySelector('.auth-card');
  const k = karte.getBoundingClientRect();
  const box = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.left - k.left), y: Math.round(r.top - k.top), w: Math.round(r.width), h: Math.round(r.height) }; };
  const alle = (sel) => [...karte.querySelectorAll(sel)].map(box);
  return {
    karte: { w: Math.round(k.width), h: Math.round(k.height) },
    punkte: box(karte.querySelector('[role="img"]')),
    ueberspringen: box(karte.querySelector('.ob-spaeter')),
    wappen: box(karte.querySelector('.auth-crest')),
    titel: box(karte.querySelector('.auth-title')),
    text: box(karte.querySelector('.ob-text')),
    // Bild im Rahmen: der Rahmen zaehlt (im Entwurf ist das Bild absolut und so gross wie die ganze Vorlage)
    bilder: [...karte.querySelectorAll('img')].filter((i) => !i.closest('.auth-crest')).map((i) => box(i.closest('.ef-rahmen') || (getComputedStyle(i).position === 'absolute' ? i.parentElement : i))),
    liste: box(karte.querySelector('.kat-list, .abo-karten, .ob-anl')),
    knopf: box(karte.querySelector('.ob-fuss .btn')),
    hinweis: alle('.ob-hinweis'),
  };
};

/* ===== Teil 1: Einfuehrung ===== */
const NUR_MESSUNG = process.argv.includes("--messung");
const NUR_SG = process.argv.includes("--sogehts");
for (const [bname, btyp, ua] of (NUR_MESSUNG || NUR_SG ? [] : [['chromium', chromium, IPHONE], ['webkit', webkit, IPHONE]])) {
  const browser = await btyp.launch(bname === 'chromium' ? { channel: 'chrome' } : {});
  console.log('\n===== ' + bname + ' =====');
  for (const rolle of Object.keys(ROLLEN)) {
    console.log('\n--- ' + rolle + ': neues Konto, durchklicken ---');
    const { ctx, page, inst } = await oeffne(browser, rolle, { gesehen: [], ua });
    const ids = [];
    for (let i = 0; i < 20; i++) {
      const s = await seite(page);
      if (!s) break;
      ids.push(s);
      await warteBilder(page);
      if (bname === 'webkit' && i === 0) await page.screenshot({ path: path.join(AUS, bname + '_' + rolle + '_' + String(i + 1).padStart(2, '0') + '_' + s + '.png'), fullPage: true });
      const info = await page.evaluate(() => ({
        punkte: document.querySelectorAll('.ef-punkt').length, an: [...document.querySelectorAll('.ef-punkt')].findIndex((p) => p.classList.contains('is-an')),
        skip: !!document.querySelector('[data-ef="ueberspringen"]'), nav: getComputedStyle(document.querySelector('.app-nav') || document.body).display,
        breite: document.documentElement.scrollWidth, bildFehler: [...document.querySelectorAll('.ef-card img')].filter((i) => !i.naturalWidth).map((i) => i.src),
        pushKnopf: !!document.querySelector('[data-ef="push"]'), pushHinweis: !!document.querySelector('[data-ef-push-hinweis]'),
        kat: document.querySelectorAll('.ef-card .kat-item').length, abo: document.querySelectorAll('.ef-card .abo-karte').length,
        webcal: (document.querySelector('.ef-card [data-cal-open]') || {}).href || '' }));
      if (info.punkte !== ids.length && i === 0) {}
      pruefe(info.an === i && info.skip && info.breite <= 390 && info.bildFehler.length === 0, `${rolle} Seite ${i + 1} ${s}: Punkt ${info.an + 1}/${info.punkte}, Überspringen, keine Querverschiebung, Bilder geladen`, JSON.stringify(info));
      if (s === 'push') pruefe(info.pushHinweis && !info.pushKnopf, `${rolle}: iPhone in Safari - Hinweis statt Knopf`, JSON.stringify(info));
      if (s === 's_katalog') pruefe(info.kat === 5, `${rolle}: Katalog mit 5 echten Posten`, info.kat);
      if (s === 'kalender') pruefe(info.abo === 2 && /^webcal:\/\/.+\/api\/calendar\/landkarte-token\.ics$/.test(info.webcal), `${rolle}: Kalender-Abo mit beiden Karten und webcal-Link`, info.webcal);
      if (s === 'home') pruefe(info.abo === 2, `${rolle}: Home-Bildschirm mit iPhone- und Android-Anleitung`);
      await page.click('[data-ef="weiter"]');
      await page.waitForTimeout(250);
    }
    pruefe(JSON.stringify(ids) === JSON.stringify(FOLGE[rolle]), `${rolle}: Seitenfolge`, JSON.stringify(ids));
    const nachher = await page.evaluate(() => ({ ef: !!document.querySelector('.ef-card'), nav: !!document.querySelector('.app-nav'), auth: document.body.classList.contains('auth-mode'), view: (document.getElementById('view') || {}).innerText?.length || 0 }));
    pruefe(!nachher.ef && !nachher.auth && nachher.view > 50, `${rolle}: danach die App`, JSON.stringify(nachher));
    pruefe(JSON.stringify(await merken(inst)) === JSON.stringify([TEILE[rolle].slice().sort().join(',')]), `${rolle}: gemerkt ${TEILE[rolle].join('+')}`, JSON.stringify(await merken(inst)));
    const b = await inst.bericht();
    pruefe(b.fehler.length === 0 && b.verstoesse.length === 0, `${rolle}: Stand-in ohne Fehler`, JSON.stringify(b.fehler.concat(b.verstoesse).slice(0, 3)));
    await ctx.close();

    // Ueberspringen auf Seite 2
    {
      const { ctx, page, inst } = await oeffne(browser, rolle, { gesehen: [], ua });
      await page.click('[data-ef="weiter"]'); await page.waitForTimeout(200);
      await page.click('[data-ef="ueberspringen"]'); await page.waitForTimeout(400);
      const weg = !(await seite(page));
      pruefe(weg && JSON.stringify(await merken(inst)) === JSON.stringify([TEILE[rolle].slice().sort().join(',')]), `${rolle}: Überspringen auf Seite 2 zählt als gesehen`, JSON.stringify(await merken(inst)));
      await ctx.close();
    }
    // Alles gesehen: kommt nicht wieder
    {
      const { ctx, page, inst } = await oeffne(browser, rolle, { gesehen: TEILE[rolle], ua });
      await page.waitForTimeout(600);
      pruefe(!(await seite(page)) && (await merken(inst)).length === 0, `${rolle}: mit gesehenen Teilen keine Einführung`);
      await ctx.close();
    }
  }

  console.log('\n--- Rollenwechsel: nur der neue Teil ---');
  for (const [rolle, gesehen, soll, teil] of [
    ['kassenwart', ['spieler'], ['k_kasse', 'k_verhaengen', 'k_pruefen', 'k_paypal', 'fertig'], 'kassenwart'],
    ['spielertrainer', ['spieler'], ['st_termin', 'st_rueck', 'st_elf', 'st_kader', 'st_rollen', 'fertig'], 'trainer'],
    ['admin', ['spieler', 'kassenwart'], ['st_termin', 'st_rueck', 'st_elf', 'st_kader', 'st_rollen', 'fertig'], 'trainer'],
    ['trainer', [], FOLGE.trainer, 'trainer'],
  ]) {
    const { ctx, page, inst } = await oeffne(browser, rolle, { gesehen, ua });
    const ids = [];
    for (let i = 0; i < 20; i++) { const s = await seite(page); if (!s) break; ids.push(s); await page.click('[data-ef="weiter"]'); await page.waitForTimeout(150); }
    pruefe(JSON.stringify(ids) === JSON.stringify(soll) && JSON.stringify(await merken(inst)) === JSON.stringify([teil]), `${rolle} (gesehen: ${gesehen.join('+') || '-'}): ${ids.join(' ')}`, JSON.stringify([ids, await merken(inst)]));
    await ctx.close();
  }

  console.log('\n--- Home-Bildschirm-App: ohne Seite "Zum Home-Bildschirm" ---');
  {
    const { ctx, page } = await oeffne(browser, 'spieler', { gesehen: [], ua, standalone: true });
    const ids = [];
    for (let i = 0; i < 20; i++) { const s = await seite(page); if (!s) break; ids.push(s); await page.click('[data-ef="weiter"]'); await page.waitForTimeout(150); }
    pruefe(ids.indexOf('home') < 0 && ids.indexOf('kalender') >= 0, 'standalone: keine Seite Home-Bildschirm', ids.join(' '));
    await ctx.close();
  }
  if (bname === 'chromium') {
    console.log('\n--- Android: Mitteilungen mit Knopf ---');
    const { ctx, page } = await oeffne(browser, 'spieler', { gesehen: [], ua: ANDROID });
    for (let i = 0; i < 20; i++) { const s = await seite(page); if (!s || s === 'push') break; await page.click('[data-ef="weiter"]'); await page.waitForTimeout(150); }
    const p = await page.evaluate(() => ({ knopf: !!document.querySelector('[data-ef="push"]'), nicht: !!document.querySelector('.ob-fuss [data-ef="weiter"].ob-spaeter'),
      erste: (document.querySelector('.ef-card .abo-k-t') || {}).textContent }));
    pruefe(p.knopf && p.nicht, 'Android: Knopf „Mitteilungen erlauben“ und „Nicht jetzt“', JSON.stringify(p));
    await ctx.close();
  }
  await browser.close();
}

/* ===== Teil 2: Messung gegen den Entwurf (Chromium, neutrale Kennung) ===== */
if (!NUR_SG) console.log('\n===== Messung gegen den Entwurf =====');
if (!NUR_SG) {
  const browser = await chromium.launch({ channel: 'chrome' });
  const ectx = await browser.newContext({ viewport: { width: 1600, height: 1200 } });
  const ep = await ectx.newPage();
  await ep.goto(basis + '.design-sync/concepts/einfuehrung/entwurf/Einfuehrung.dc.html', { waitUntil: 'networkidle' });
  await ep.waitForTimeout(1500);
  const messung = {};
  for (const rolle of ['spieler', 'trainer', 'kassenwart', 'spielertrainer']) {
    const { ctx, page } = await oeffne(browser, rolle, { gesehen: [] });
    for (let i = 0; i < 20; i++) {
      const s = await seite(page); if (!s) break;
      await warteBilder(page);
      const label = ENTWURF[rolle] + ' ' + String(i + 1).padStart(2, '0');
      const ist = await page.evaluate(`(${LAGE.toString()})(document)`);
      const soll = await ep.evaluate(`(${LAGE.toString()})(document.querySelector('[data-screen-label="${label}"]'))`);
      const d = [];
      const vergleiche = (name, a, b) => {
        if (!a && !b) return; if (!a || !b) { d.push({ name, fehlt: !a ? 'App' : 'Entwurf' }); return; }
        const m = Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.w - b.w), Math.abs(a.h - b.h));
        if (m > 0) d.push({ name, abw: m, app: a, entwurf: b });
      };
      for (const k of ['punkte', 'ueberspringen', 'wappen', 'titel', 'text', 'liste', 'knopf']) vergleiche(k, ist[k], soll[k]);
      const nb = Math.max(ist.bilder.length, soll.bilder.length);
      for (let j = 0; j < nb; j++) vergleiche('bild' + (j + 1), ist.bilder[j], soll.bilder[j]);
      const nh = Math.max(ist.hinweis.length, soll.hinweis.length);
      for (let j = 0; j < nh; j++) vergleiche('hinweis' + (j + 1), ist.hinweis[j], soll.hinweis[j]);
      vergleiche('karte', { x: 0, y: 0, ...ist.karte }, { x: 0, y: 0, ...soll.karte });
      const max = d.reduce((m, x) => Math.max(m, x.abw || 999), 0);
      messung[label] = { seite: s, max, abweichungen: d };
      console.log('  ' + label.padEnd(32) + s.padEnd(13) + (d.length ? 'max ' + max + ' px: ' + d.map((x) => x.name + (x.fehlt ? ' fehlt in ' + x.fehlt : ' ' + x.abw)).join(', ') : 'deckungsgleich'));
      await page.screenshot({ path: path.join(AUS, 'mess_' + rolle + '_' + String(i + 1).padStart(2, '0') + '_' + s + '.png'), fullPage: true });
      await page.click('[data-ef="weiter"]'); await page.waitForTimeout(200);
    }
    await ctx.close();
  }
  fs.writeFileSync(path.join(AUS, 'messung.json'), JSON.stringify(messung, null, 1));
  await browser.close();
}

/* ===== Teil 3: So geht's ===== */
const ALLE_F = ['zusage', 'mitteilungen', 'kalender', 'passwort', 'handy'];
const FRAGEN = {
  spieler:        [...ALLE_F, 'bezahlen', 'konto'],
  trainer:        ['kassenwart', 'paypal', 'verlassen', 'einladen', 'trainer', ...ALLE_F, 'konto'],
  kassenwart:     ['kassenwart', 'paypal', 'storno', ...ALLE_F, 'bezahlen', 'konto'],
  spielertrainer: ['kassenwart', 'paypal', 'verlassen', 'einladen', 'trainer', ...ALLE_F, 'bezahlen', 'konto'],
  admin:          ['kassenwart', 'paypal', 'verlassen', 'einladen', 'trainer', 'storno', ...ALLE_F, 'bezahlen', 'konto'],
};
// Ziel eines Links -> woran man es erkennt
const ZIEL = {
  '#ein=profil': () => !!document.querySelector('.pr-kopf'),
  '#ein=mitteilungen': () => (document.querySelector('.ein-h1') || {}).textContent === 'Mitteilungen',
  '#ein=ruhezeiten': () => (document.querySelector('.ein-h1') || {}).textContent === 'Ruhezeiten',
  '#ein=kalender': () => (document.querySelector('.ein-h1') || {}).textContent === 'Kalender abonnieren',
  '#ansicht=admin': () => /^Rollen verwalten/.test(document.getElementById('view').innerText),
  '#ansicht=kalender': () => !!document.querySelector('.nav-btn.is-active[data-view="kalender"]'),
  '#kasse=offen': () => !!document.querySelector('[data-kasse-tab="offen"].is-on, .ks-seg-b.is-on') && /Kasse/.test(document.getElementById('view').innerText),
  '#strafen=offen': () => !!document.querySelector('[data-kseg="ich"]'),
};
const sgSeite = (page) => page.evaluate(() => ({ h1: (document.querySelector('.ein-h1') || {}).textContent || '', sg: !!document.querySelector('.sg-fragen') }));

console.log("\n===== So geht's =====");
for (const [bname, btyp] of (NUR_MESSUNG ? [] : [['chromium', chromium], ['webkit', webkit]])) {
  const browser = await btyp.launch(bname === 'chromium' ? { channel: 'chrome' } : {});
  console.log('\n--- ' + bname + ' ---');
  for (const rolle of Object.keys(ROLLEN)) {
    const { ctx, page, inst } = await oeffne(browser, rolle, { gesehen: TEILE[rolle], ua: IPHONE, hash: '#ansicht=einstellungen' });
    // erreichbar ueber Einstellungen › Info
    await page.click('[data-ein="sogehts"]'); await page.waitForTimeout(400);
    let s = await sgSeite(page);
    const kopf = await page.evaluate(() => ({ back: (document.querySelector('[data-ein-back]') || {}).textContent || '', hash: location.hash }));
    pruefe(s.h1 === "So geht's" && s.sg && /Einstellungen/.test(kopf.back) && kopf.hash === '#ein=sogehts', `${bname} ${rolle}: So geht's erreichbar, Zurück-Leiste, #ein=sogehts`, JSON.stringify([s, kopf]));
    if (bname === 'chromium') {
      await page.screenshot({ path: path.join(AUS, 'sogehts_' + rolle + '.png'), fullPage: true });
      await page.click('[data-sg-frage] > summary'); await page.waitForTimeout(200);
      await page.screenshot({ path: path.join(AUS, 'sogehts_' + rolle + '_offen.png'), fullPage: true });
      await page.click('[data-sg-frage] > summary'); await page.waitForTimeout(200);
    }
    const ids = await page.evaluate(() => [...document.querySelectorAll('[data-sg-frage]')].map((d) => d.dataset.sgFrage));
    pruefe(JSON.stringify(ids) === JSON.stringify(FRAGEN[rolle]), `${bname} ${rolle}: Rollenfilter (${ids.length} Fragen)`, JSON.stringify(ids));
    const rollenEf = await page.evaluate(() => [...document.querySelectorAll('[data-sg-ef]')].map((d) => d.dataset.sgEf));
    const leitung = rolle === 'trainer' || rolle === 'spielertrainer' || rolle === 'admin';
    pruefe(JSON.stringify(rollenEf) === JSON.stringify(leitung ? ['eigen', 'spieler', 'trainer', 'kassenwart', 'spielertrainer'] : ['eigen']), `${bname} ${rolle}: Einführung ansehen${leitung ? ' plus vier Rollen' : ''}`, JSON.stringify(rollenEf));
    const mail = await page.evaluate(() => (document.querySelector('.sg-kontakt a') || {}).href || '');
    pruefe(mail === 'mailto:teamkabine-app@gmx.de', `${bname} ${rolle}: Kontakt teamkabine-app@gmx.de`, mail);

    // Einfuehrung ansehen: eigene Folge, endet wieder auf So geht's, schreibt nichts
    await page.click('[data-sg-ef="eigen"]'); await page.waitForTimeout(300);
    const folge = [];
    for (let i = 0; i < 20; i++) { const x = await seite(page); if (!x) break; folge.push(x); await page.click('[data-ef="weiter"]'); await page.waitForTimeout(150); }
    s = await sgSeite(page);
    pruefe(JSON.stringify(folge) === JSON.stringify(FOLGE[rolle]) && s.h1 === "So geht's" && (await merken(inst)).length === 0,
      `${bname} ${rolle}: Einführung ansehen zeigt die eigene Folge, zurück auf So geht's, nichts gemerkt`, JSON.stringify([folge, s]));
    if (leitung) {
      for (const [r, erste] of [['spieler', 's_termine'], ['trainer', 't_rueck'], ['kassenwart', 'k_spieler'], ['spielertrainer', 'st_termin']]) {
        await page.click(`[data-sg-ef="${r}"]`); await page.waitForTimeout(300);
        const x = await seite(page);
        await page.click('[data-ef="ueberspringen"]'); await page.waitForTimeout(300);
        s = await sgSeite(page);
        pruefe(x === erste && s.h1 === "So geht's", `${bname} ${rolle}: Einführung ${r} beginnt mit ${erste}, Überspringen führt zurück`, JSON.stringify([x, s]));
      }
    }
    // Links
    const links = await page.evaluate(() => [...document.querySelectorAll('[data-sg-frage]')].flatMap((d) => [...d.querySelectorAll('.sg-link')].map((l) => ({ frage: d.dataset.sgFrage, ziel: l.dataset.sgZiel || l.getAttribute('href'), text: l.textContent }))));
    for (const l of links) {
      if (!/^#/.test(l.ziel)) { pruefe(l.ziel === 'datenschutz.html', `${bname} ${rolle}: ${l.frage} › ${l.text} -> ${l.ziel}`); continue; }
      // vorher sicher auf So geht's
      s = await sgSeite(page);
      if (s.h1 !== "So geht's") { await page.evaluate(() => { location.hash = '#ein=sogehts'; }); await page.waitForTimeout(500); }
      await page.evaluate((f) => { const d = document.querySelector(`[data-sg-frage="${f}"]`); d.open = true; }, l.frage);
      await page.click(`[data-sg-frage="${l.frage}"] [data-sg-ziel="${l.ziel}"]`); await page.waitForTimeout(600);
      const ok = await page.evaluate(`(${ZIEL[l.ziel].toString()})()`);
      pruefe(ok, `${bname} ${rolle}: ${l.frage} › ${l.text} -> ${l.ziel}`, JSON.stringify(await page.evaluate(() => [location.hash, (document.getElementById('view').innerText || '').slice(0, 120)])));
      if (/^#ein=/.test(l.ziel)) {
        await page.click('[data-ein-back]'); await page.waitForTimeout(500);
        s = await sgSeite(page);
        pruefe(s.h1 === "So geht's", `${bname} ${rolle}: Zurück aus ${l.ziel} führt auf So geht's`, JSON.stringify(s));
      }
    }
    // Zurueck-Leiste von So geht's
    await page.evaluate(() => { location.hash = '#ein=sogehts'; }); await page.waitForTimeout(500);
    await page.click('[data-ein-back]'); await page.waitForTimeout(500);
    const ueb = await page.evaluate(() => ({ h1: (document.querySelector('.page-head h1') || {}).textContent || '', zeile: !!document.querySelector('[data-ein="sogehts"]') }));
    pruefe(ueb.h1 === 'Einstellungen' && ueb.zeile, `${bname} ${rolle}: Zurück-Leiste führt auf Einstellungen`, JSON.stringify(ueb));
    const b = await inst.bericht();
    pruefe(b.fehler.length === 0 && b.verstoesse.length === 0, `${bname} ${rolle}: Stand-in ohne Fehler`, JSON.stringify(b.fehler.concat(b.verstoesse).slice(0, 3)));
    await ctx.close();
  }
  await browser.close();
}

server.close();
console.log(fehler.length ? `\n--- ${fehler.length} Beanstandung(en) ---` : '\n--- bestanden ---');
process.exit(fehler.length ? 1 : 0);
