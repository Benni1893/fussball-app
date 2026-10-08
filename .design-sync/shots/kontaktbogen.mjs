/* Kontaktbogen der Gerätematrix: die wichtigsten Ansichten bei 320 px und
   130 % Schrift (Chromium, Inter, Android-Safe-Area) nebeneinander.
   Ausgabe: .design-sync/geraetematrix/kontaktbogen-320-130.png
            .design-sync/geraetematrix/kontaktbogen/<n>.png (Einzelbilder)
   Aufruf:  node .design-sync/shots/kontaktbogen.mjs [variante]           */
import fs from 'node:fs';
import path from 'node:path';
import { chromium, webkit } from 'playwright';
import { starte } from './server.mjs';
import { installiere, warteAufApp } from './landkartenmodul.mjs';
import { AUSLOESER, UEBERLAGERUNGEN, zustandImBrowser } from './landkartenregeln.mjs';
import { kandidatenImBrowser } from './landkarte.mjs';
import { VARIANTEN, SAFE, SA, GEWICHTE, schriftDateien, skaliereImBrowser } from './geraetematrix.mjs';

const ZIEL = '.design-sync/geraetematrix';
const BREITE = 320, HOEHE = 568, SCHRIFT = 130;
const variante = process.argv[2] || 'chromium-inter';
const v = VARIANTEN[variante];
const AUSWAHL = [
  ['admin', 'dashboard', 'Übersicht'],
  ['admin', 'kalender', 'Kalender'],
  ['admin', 'dashboard+terminModal', 'Termin bearbeiten'],
  ['admin', 'dashboard+rsvpSheet', 'Rückmeldungen'],
  ['admin', 'trainer', 'Trainer'],
  ['admin', 'trainer/spiel', 'Platz'],
  ['admin', 'trainer/spiel+tvSheetKader', 'Bank-Blatt'],
  ['admin', 'kader', 'Kader'],
  ['admin', 'strafen', 'Konto'],
  ['admin', 'kasse/pruefen', 'Kasse Gemeldet'],
  ['admin', 'kasse/offen', 'Kasse Offen'],
  ['admin', 'kasse/strafe-katalog+ksSeite', 'Strafe verhängen'],
  ['admin', 'katalog', 'Katalog'],
  ['admin', 'einstellungen', 'Einstellungen'],
  ['admin', 'einstellungen/profil', 'Profil'],
  ['admin', 'einstellungen/bfv', 'Spielplan BFV'],
  ['admin', 'rollen-verwalten', 'Rollen'],
  ['spieler', 'dashboard+zmBl', 'Zahlung melden'],
];

const lk = JSON.parse(fs.readFileSync('.design-sync/landkarte/landkarte.json', 'utf8'));
const schrift = await schriftDateien(v.familie);
const { server, basis } = await starte(process.cwd());
const browser = v.engine === 'webkit' ? await webkit.launch() : await chromium.launch({ channel: 'chrome' });
const einzeln = path.join(ZIEL, 'kontaktbogen');
fs.rmSync(einzeln, { recursive: true, force: true });
fs.mkdirSync(einzeln, { recursive: true });
const bilder = [];
for (const [i, [profil, schl, titel]] of AUSWAHL.entries()) {
  const n = lk.profile[profil].knoten.find((k) => k.schluessel === schl);
  if (!n) { console.log('fehlt', profil, schl); continue; }
  const ctx = await browser.newContext({ viewport: { width: BREITE, height: HOEHE }, deviceScaleFactor: 2, hasTouch: true,
    isMobile: v.engine === 'chromium' ? true : undefined, userAgent: v.ua, locale: 'de-DE', timezoneId: 'Europe/Berlin', serviceWorkers: 'block' });
  const page = await ctx.newPage();
  await installiere(page, profil);
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => {
    const m = route.request().url().match(/\/gm\/(\d+)\.woff2/);
    if (m) return route.fulfill({ status: 200, contentType: 'font/woff2', body: schrift[m[1]] });
    return route.fulfill({ status: 200, contentType: 'text/css', body: GEWICHTE.map((w) => "@font-face{font-family:'Inter';font-weight:" + w
      + ";font-display:block;src:url(https://fonts.gstatic.com/gm/" + w + ".woff2) format('woff2');}").join('') });
  });
  await page.route(/\/(styles\.css|index\.html)(\?|$)|\/$/, async (route) => {
    const r = await route.fetch();
    if (!/css|html/.test(r.headers()['content-type'] || '')) return route.fulfill({ response: r });
    return route.fulfill({ response: r, body: SA(await r.text()) });
  });
  await page.goto(basis, { waitUntil: 'load' });
  await warteAufApp(page);
  const sa = SAFE[v.engine](BREITE);
  await page.evaluate((sa) => { const s = document.documentElement.style; s.setProperty('--gm-sa-top', sa.top + 'px'); s.setProperty('--gm-sa-bottom', sa.bottom + 'px'); }, sa);
  for (const s of n.pfad) {
    const z = await page.evaluate(zustandImBrowser, UEBERLAGERUNGEN);
    const t = await page.evaluate(kandidatenImBrowser, { ausloeser: AUSLOESER, ueberlagerungen: UEBERLAGERUNGEN, oben: z.oben, istStart: s.global === true, nurArt: s.art, nurWert: s.wert });
    if (!t.length) break;
    await page.evaluate(() => { const e = document.querySelector('[data-landkarte-ziel]'); e.removeAttribute('data-landkarte-ziel'); e.click(); });
    await page.waitForTimeout(450);
  }
  await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; animation-duration: 0s !important; }' });
  await page.evaluate(skaliereImBrowser, { an: true, faktor: SCHRIFT / 100 });
  await page.waitForTimeout(150);
  const datei = path.join(einzeln, String(i + 1).padStart(2, '0') + '.png');
  await page.screenshot({ path: datei });
  bilder.push({ titel, datei: fs.readFileSync(datei).toString('base64') });
  await ctx.close();
}
// Bogen: sechs Spalten
const html = `<!doctype html><meta charset="utf-8"><body style="margin:0;padding:24px;background:#dfe6e2;font:600 15px system-ui">
<div style="font:800 22px system-ui;margin-bottom:6px">Gerätematrix · ${BREITE} px · Schrift ${SCHRIFT} % · ${v.titel} (${v.schriftName})</div>
<div style="margin-bottom:18px;color:#3b4a43">Stand ${new Date().toISOString().slice(0, 10)} · erzeugt mit kontaktbogen.mjs</div>
<div style="display:grid;grid-template-columns:repeat(6,${BREITE}px);gap:18px">
${bilder.map((b) => `<figure style="margin:0"><img src="data:image/png;base64,${b.datei}" style="width:${BREITE}px;display:block;border-radius:10px;box-shadow:0 2px 10px rgba(0,0,0,.18)"><figcaption style="margin-top:6px">${b.titel}</figcaption></figure>`).join('')}
</div></body>`;
const p2 = await (await browser.newContext({ viewport: { width: 6 * BREITE + 5 * 18 + 48, height: 800 }, deviceScaleFactor: 1 })).newPage();
await p2.setContent(html);
const ausgabe = path.join(ZIEL, `kontaktbogen-${BREITE}-${SCHRIFT}.png`);
await p2.screenshot({ path: ausgabe, fullPage: true });
await browser.close(); server.close();
console.log('Kontaktbogen:', ausgabe, bilder.length, 'Ansichten');
