/* Logo in der Kopfzeile (Startbefund 19.10.2026, OnePlus Nord, Android 11):
   Beim Kaltstart der Home-Bildschirm-App scheitert die erste Anfrage an
   assets/logo.png, ein gescheitertes <img> laedt nie neu. Es blieb das kaputte
   Bildsymbol mit Alt-Text "FC Fasanerie-Nord", daneben der Titel ein zweites Mal.
   Geprueft (Chromium und WebKit, 390 px, Stand-in):
   1. Kopfzeilen-Logo hat alt="" und feste Masse (kein doppelter Name).
   2. Erste Anfrage scheitert: Bild ist bis zum Neuladen unsichtbar, laedt
      danach von selbst, ohne Neustart.
   3. Jede Anfrage scheitert: kein kaputtes Symbol, Titel genau einmal.
   4. Service Worker (nur Chromium): logo.png liegt nach der Installation im
      Cache und kommt offline aus ihm. Ein Geraet mit dem alten Worker (ohne
      Logo im Cache) bekommt es nach dem Update ohne Neuinstallation.
   Aufruf: node .design-sync/shots/logopruef.mjs                             */
import { chromium, webkit } from 'playwright';
import fs from 'node:fs';
import http from 'node:http';
import { starte } from './server.mjs';
import { installiere, warteAufApp, daten } from './landkartenmodul.mjs';

const fehler = [];
const pruefe = (ok, t, d) => { console.log((ok ? '  ok   ' : '  FEHL ') + t + (d !== undefined ? '   ' + d : '')); if (!ok) fehler.push(t); };
const { server, basis } = await starte(process.cwd());

const html = fs.readFileSync('index.html', 'utf8');
const kopfImg = (html.match(/<header class="app-header">[\s\S]*?<img[^>]*>/) || [''])[0].match(/<img[^>]*>/);
console.log('--- Markup ---');
pruefe(!!kopfImg && /alt=""/.test(kopfImg[0]), 'Kopfzeilen-Logo hat alt=""', kopfImg && kopfImg[0]);
pruefe(!!kopfImg && /width="\d+"/.test(kopfImg[0]) && /height="\d+"/.test(kopfImg[0]), 'Kopfzeilen-Logo hat width und height');

const zustand = (page) => page.evaluate(() => {
  const i = document.querySelector('.app-header .crest-logo');
  const t = document.getElementById('hdrTitle');
  const cs = i ? getComputedStyle(i) : null;
  return {
    da: !!i, nw: i ? i.naturalWidth : -1, sichtbar: cs ? cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0' : false,
    alt: i ? i.getAttribute('alt') : null,
    titel: t ? t.textContent.trim() : '',
    kopfText: (document.querySelector('.app-header').innerText || '').trim(),
  };
});

async function lauf(btyp, bname, fall) {
  const browser = await btyp.launch(bname === 'chromium' ? { channel: 'chrome' } : {});
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, locale: 'de-DE', timezoneId: 'Europe/Berlin', serviceWorkers: 'block' });
  const page = await ctx.newPage();
  await installiere(page, 'spieler', { daten: daten() });
  let anfragen = 0;
  await page.route(/\/assets\/logo\.png(\?|$)/, (route) => {
    // Nur das Kopfzeilen-Logo zaehlen: die Anfrage kommt vom <img> in der Kopfzeile oder seinem Neuversuch.
    anfragen++;
    if (fall === 'immer' || anfragen === 1) return route.abort('internetdisconnected');
    return route.continue();
  });
  await page.goto(basis, { waitUntil: 'load' });
  await warteAufApp(page).catch(() => {});
  const frueh = await zustand(page);
  await page.waitForFunction(() => { const i = document.querySelector('.app-header .crest-logo'); return i && i.naturalWidth > 0; }, null, { timeout: 8000 }).catch(() => {});
  if (fall === 'immer') await page.waitForTimeout(5000);
  const spaet = await zustand(page);
  await browser.close();
  return { frueh, spaet, anfragen };
}

for (const [bname, btyp] of [['chromium', chromium], ['webkit', webkit]]) {
  console.log('\n===== ' + bname + ' =====');
  const a = await lauf(btyp, bname, 'einmal');
  pruefe(a.spaet.da && a.spaet.alt === '', bname + ': Logo da, alt=""', JSON.stringify(a.spaet));
  pruefe(a.anfragen >= 2, bname + ': nach dem Fehlschlag neu angefordert', a.anfragen + ' Anfragen');
  pruefe(a.spaet.nw > 0 && a.spaet.sichtbar, bname + ': Logo erscheint ohne Neustart', JSON.stringify(a.spaet));
  pruefe(a.spaet.kopfText === a.spaet.titel && !!a.spaet.titel, bname + ': Name genau einmal in der Kopfzeile (Text = Titel)', JSON.stringify(a.spaet.kopfText));

  const b = await lauf(btyp, bname, 'immer');
  pruefe(b.spaet.nw === 0 && !b.spaet.sichtbar, bname + ': dauerhafter Fehler, Bild unsichtbar statt kaputtes Symbol', JSON.stringify(b.spaet));
  pruefe(b.spaet.kopfText === b.spaet.titel && !!b.spaet.titel, bname + ': dauerhafter Fehler, Name genau einmal (Text = Titel)', JSON.stringify(b.spaet.kopfText));
}

/* ---- Service Worker ---------------------------------------------------- */
console.log('\n===== Service Worker (chromium) =====');
{
  const swNeu = fs.readFileSync('sw.js', 'utf8');
  // Alter Worker: Stand vor diesem Paket, ohne Logo in FEST und mit anderer VERSION.
  const swAlt = swNeu.replace(/const VERSION = "[^"]+";/, 'const VERSION = "fn-sw-alt";')
    .replace(/const FEST = \[[^\]]*\];/, 'const FEST = ["fonts/inter.css", "fonts/inter/inter-latin.woff2", "fonts/inter/inter-latin-ext.woff2", "vendor/supabase-js-2.117.3.js"];');
  const browser = await chromium.launch({ channel: 'chrome' });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  // Vorschalt-Server statt ctx.route: liefert sw.js alt oder neu, alles andere vom Dateiserver.
  let welcher = 'alt';
  const vor = http.createServer((req, res) => {
    if (req.url.split('?')[0] === '/sw.js') { res.writeHead(200, { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-store' }); res.end(welcher === 'alt' ? swAlt : swNeu); return; }
    http.get(basis + req.url.replace(/^\//, ''), (r) => { res.writeHead(r.statusCode, r.headers); r.pipe(res); }).on('error', () => { res.writeHead(502); res.end(); });
  });
  await new Promise((ok) => vor.listen(0, '127.0.0.1', ok));
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:' + vor.address().port + '/offline.html', { waitUntil: 'load' });
  const inhalt = () => page.evaluate(async () => {
    const out = {};
    for (const n of await caches.keys()) out[n] = (await (await caches.open(n)).keys()).map((q) => q.url.split('/').pop());
    return out;
  });
  await page.evaluate(async () => { await navigator.serviceWorker.register('sw.js'); await navigator.serviceWorker.ready; });
  await page.waitForTimeout(800);
  const vorher = await inhalt();
  pruefe(Object.keys(vorher).join() === 'fn-sw-alt' && !vorher['fn-sw-alt'].includes('logo.png'), 'Ausgangslage: alter Worker ohne Logo im Cache', JSON.stringify(vorher));
  // Update wie beim naechsten Start eines installierten Geraets: Browser prueft sw.js, findet die neue Fassung.
  welcher = 'neu';
  // install laedt alle festen Dateien, activate raeumt den alten Cache weg und uebernimmt
  // dann die Seite (clients.claim) -> controllerchange. Waehrenddessen keine Caches oeffnen.
  const gewechselt = await page.evaluate(async () => {
    const wechsel = new Promise((ok) => navigator.serviceWorker.addEventListener('controllerchange', () => ok(true), { once: true }));
    const r = await navigator.serviceWorker.getRegistration(); await r.update();
    return Promise.race([wechsel, new Promise((ok) => setTimeout(() => ok(false), 30000))]);
  });
  pruefe(gewechselt, 'neuer Worker uebernimmt die offene Seite (controllerchange)');
  // Chrome loescht einen Cache erst, wenn keine Seite mehr einen Verweis darauf haelt (hier: die
  // Ausgangslage-Abfrage oben). Neu laden wie beim naechsten App-Start, dann nur die Namen abfragen.
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(async () => { const k = await caches.keys(); return k.length === 1 && k[0] !== 'fn-sw-alt'; }, null, { timeout: 20000, polling: 500 }).catch(() => {});
  const nachher = await inhalt();
  console.log('  (Worker: ' + JSON.stringify(await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); return { aktiv: r.active && r.active.state, wartend: !!r.waiting, installiert: !!r.installing }; })) + ')');
  const name = (swNeu.match(/const VERSION = "([^"]+)"/) || [])[1];
  pruefe(Object.keys(nachher).join() === name && nachher[name].includes('logo.png'), 'nach dem Update: neuer Cache mit logo.png, alter weg', JSON.stringify(nachher));
  await page.reload({ waitUntil: 'load' });
  await ctx.setOffline(true);
  const offline = await page.evaluate(async () => { try { const r = await fetch('assets/logo.png?r=1'); return r.status + ' ' + (await r.blob()).size; } catch (e) { return 'fehlgeschlagen'; } });
  pruefe(/^200 \d{4,}$/.test(offline), 'offline: logo.png kommt aus dem Worker-Cache', offline);
  await ctx.setOffline(false);
  await browser.close();
  vor.close();
}

server.close();
console.log(fehler.length === 0 ? '\n--- bestanden ---' : '\n--- NICHT bestanden: ' + fehler.length + ' ---');
process.exit(fehler.length === 0 ? 0 : 1);
