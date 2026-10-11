/* Onboarding Nacharbeit 1: keine fremden Server beim App-Start.
   Zeichnet jede Netzanfrage auf (auch die, die das Stand-in abfaengt) und
   erlaubt nur die eigene Adresse (lokal = Vercel) und *.supabase.co.
   Geprueft: Anmeldung, angemeldete Rollen, Datenschutz- und Impressumseite.
   Dazu die Quelltexte: keine Verweise auf Google Fonts oder jsDelivr.
   Mit ECHT=1 laeuft die Startseite zusaetzlich mit der echten config.js
   (ohne Stand-in) - das braucht Netz und ist nicht Teil der Pflichtliste.
   Aufruf: node .design-sync/shots/hostpruef.mjs                          */
import { chromium } from 'playwright';
import fs from 'node:fs';
import { starte } from './server.mjs';
import { installiere, warteAufApp } from './landkartenmodul.mjs';

const fehler = [];
const pruefe = (ok, text, detail) => { console.log((ok ? '  ok   ' : '  FEHL ') + text + (detail !== undefined && !ok ? '   ' + detail : '')); if (!ok) fehler.push(text); };
for (const datei of ['index.html', 'app.js', 'db.js', 'sw.js', 'styles.css', 'datenschutz.html', 'impressum.html', 'offline.html', 'fonts/inter.css']) {
  if (!fs.existsSync(datei)) continue;
  const s = fs.readFileSync(datei, 'utf8');
  pruefe(!/fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.jsdelivr\.net|unpkg\.com/.test(s.replace(/\/\*[\s\S]*?\*\//g, '')), datei + ': kein Verweis auf Google Fonts oder jsDelivr');
}
pruefe(fs.existsSync('fonts/inter/inter-latin.woff2') && fs.existsSync('vendor/supabase-js-2.117.3.js'), 'Schrift und supabase-js liegen im Repo');

const { server, basis } = await starte(process.cwd());
const eigen = new URL(basis).host;
const browser = await chromium.launch({ channel: 'chrome' });
const alleHosts = new Set();
async function lauf(name, profil, pfad, echt) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const hosts = new Set();
  page.on('request', (r) => { try { const u = new URL(r.url()); if (/^https?:$/.test(u.protocol)) hosts.add(u.host); } catch (e) {} });
  if (!echt) await installiere(page, profil);
  await page.goto(basis + (pfad || ''), { waitUntil: 'networkidle' });
  if (!echt && !pfad) { try { await warteAufApp(page); } catch (e) {} }
  await page.waitForTimeout(1200);
  const fremd = [...hosts].filter((h) => h !== eigen && !/(^|\.)supabase\.co$/.test(h));
  [...hosts].forEach((h) => alleHosts.add(h === eigen ? 'eigene Adresse' : h));
  pruefe(fremd.length === 0, name + ': nur eigene Adresse und Supabase', JSON.stringify([...hosts]));
  const schrift = await page.evaluate(async () => { await document.fonts.ready; return document.fonts.check('700 16px Inter'); });
  pruefe(schrift, name + ': Inter geladen');
  await ctx.close();
}
await lauf('Anmeldung', 'anmeldung');
await lauf('Spieler', 'spieler');
await lauf('Admin', 'admin');
await lauf('Datenschutz', 'anmeldung', 'datenschutz.html');
await lauf('Impressum', 'anmeldung', 'impressum.html');
if (process.env.ECHT) await lauf('Start mit echter config.js', null, '', true);
console.log('  info  Hosts: ' + [...alleHosts].join(', '));
await browser.close(); server.close();
console.log(fehler.length ? '--- NICHT bestanden: ' + fehler.length + ' ---' : '--- bestanden ---');
process.exit(fehler.length ? 1 : 0);
