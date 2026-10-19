/* Android als echte App (WebAPK statt Verknuepfung), 19.10.2026:
   1. Manifest: Pflichtfelder, Icons 192/512 in echter Groesse, eigenes
      maskable Icon (nicht dieselbe Datei wie "any"), theme/background_color.
   2. Anleitung nennt nur noch "⋮ › App installieren", nicht mehr
      "Zum Startbildschirm hinzufuegen" (Onboarding, Einfuehrung, So geht's).
   3. Einfuehrung, Seite "Auf den Home-Bildschirm": Bietet Chrome die
      Installation an (beforeinstallprompt), steht dort der Knopf
      "App installieren"; er ruft prompt() auf und blaettert weiter. Ohne
      Angebot (iPhone, schon installiert) bleibt die Seite wie bisher.
   Aufruf: node .design-sync/shots/androidpruef.mjs                          */
import { chromium } from 'playwright';
import fs from 'node:fs';
import { starte } from './server.mjs';
import { installiere, daten } from './landkartenmodul.mjs';

const fehler = [];
const pruefe = (ok, t, d) => { console.log((ok ? '  ok   ' : '  FEHL ') + t + (d !== undefined ? '   ' + d : '')); if (!ok) fehler.push(t); };

/* PNG-Groesse aus dem IHDR-Block */
const pngGroesse = (f) => { const b = fs.readFileSync(f); return b.readUInt32BE(16) + 'x' + b.readUInt32BE(20); };

console.log('--- Manifest ---');
const m = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
for (const feld of ['id', 'name', 'short_name', 'start_url', 'scope', 'display', 'theme_color', 'background_color']) pruefe(!!m[feld], 'Feld ' + feld, JSON.stringify(m[feld]));
pruefe(m.display === 'standalone', 'display standalone');
pruefe(!m.prefer_related_applications, 'prefer_related_applications nicht gesetzt');
for (const i of m.icons) pruefe(fs.existsSync(i.src) && pngGroesse(i.src) === i.sizes, `Icon ${i.src} (${i.purpose}) hat echte Groesse ${i.sizes}`, fs.existsSync(i.src) ? pngGroesse(i.src) : 'fehlt');
const any = m.icons.filter((i) => (i.purpose || 'any').split(' ').includes('any')).map((i) => i.sizes);
pruefe(any.includes('192x192') && any.includes('512x512'), 'Icons 192 und 512 (any)', any.join(' '));
const mask = m.icons.find((i) => (i.purpose || '').includes('maskable'));
pruefe(!!mask && mask.sizes === '512x512', 'maskable Icon 512');
pruefe(!!mask && !m.icons.some((i) => i !== mask && i.src === mask.src), 'maskable ist eine eigene Datei mit Rand', mask && mask.src);

console.log('--- Texte ---');
const app = fs.readFileSync('app.js', 'utf8');
pruefe(!/Zum Startbildschirm hinzufügen/.test(app), 'app.js nennt "Zum Startbildschirm hinzufügen" nicht mehr');
pruefe(/<b>App installieren<\/b> wählen/.test(app), 'Onboarding: "⋮ › App installieren"');

/* ---- Einfuehrung mit vorgetaeuschtem Installations-Angebot -------------- */
const { server, basis } = await starte(process.cwd());
const ANDROID = 'Mozilla/5.0 (Linux; Android 11; ONEPLUS A5000) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
const browser = await chromium.launch({ channel: 'chrome' });

async function bisHome(mitAngebot) {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'de-DE', timezoneId: 'Europe/Berlin', serviceWorkers: 'block', userAgent: ANDROID });
  const page = await ctx.newPage();
  const inst = await installiere(page, 'spieler', { daten: daten() });
  await page.goto(basis + '#ein=sogehts', { waitUntil: 'load' });
  await page.waitForFunction(() => !document.getElementById('splash') && !!document.querySelector('[data-sg-ef="eigen"]'), null, { timeout: 20000 });
  if (mitAngebot) await page.evaluate(() => {
    const e = new Event('beforeinstallprompt', { cancelable: true });
    e.prompt = () => { window.__prompt = (window.__prompt || 0) + 1; return Promise.resolve(); };
    e.userChoice = Promise.resolve({ outcome: 'accepted' });
    window.dispatchEvent(e);
  });
  await page.click('[data-sg-ef="eigen"]'); await page.waitForTimeout(300);
  for (let i = 0; i < 8; i++) {
    const id = await page.evaluate(() => (document.querySelector('[data-ef-seite]') || {}).dataset?.efSeite || '');
    if (id === 'home' || !id) break;
    await page.click('[data-ef="weiter"]'); await page.waitForTimeout(150);
  }
  return { ctx, page, inst };
}

console.log('--- Einführung: Chrome bietet die Installation an ---');
{
  const { ctx, page, inst } = await bisHome(true);
  const s = await page.evaluate(() => ({ id: document.querySelector('[data-ef-seite]')?.dataset.efSeite, knopf: (document.querySelector('[data-ef="installieren"]') || {}).textContent || '',
    weg: (document.querySelector('.ef-wege') || {}).textContent || '', spaeter: !!document.querySelector('.ob-fuss [data-ef="weiter"]') }));
  pruefe(s.id === 'home' && s.knopf === 'App installieren', 'Knopf "App installieren" auf der Home-Seite', JSON.stringify(s));
  pruefe(s.spaeter, 'daneben "Nicht jetzt" zum Weiterblättern');
  pruefe(/⋮/.test(s.weg) && /App installieren/.test(s.weg), 'Abbildung: ⋮ › App installieren', s.weg);
  await page.click('[data-ef="installieren"]'); await page.waitForTimeout(300);
  const n = await page.evaluate(() => ({ prompt: window.__prompt || 0, id: document.querySelector('[data-ef-seite]')?.dataset.efSeite }));
  pruefe(n.prompt === 1 && n.id === 'push', 'Tipp ruft prompt() einmal auf und blättert weiter', JSON.stringify(n));
  const b = await inst.bericht();
  pruefe(b.fehler.length === 0 && b.verstoesse.length === 0, 'keine Seitenfehler', JSON.stringify(b.fehler.concat(b.verstoesse)));
  await ctx.close();
}
console.log('--- Einführung: ohne Angebot (iPhone, schon installiert) ---');
{
  const { ctx, page } = await bisHome(false);
  const s = await page.evaluate(() => ({ id: document.querySelector('[data-ef-seite]')?.dataset.efSeite, knopf: !!document.querySelector('[data-ef="installieren"]'),
    weiter: (document.querySelector('.ob-fuss [data-ef="weiter"]') || {}).textContent || '' }));
  pruefe(s.id === 'home' && !s.knopf && /Weiter/.test(s.weiter), 'kein Installieren-Knopf, "Weiter" wie bisher', JSON.stringify(s));
  await ctx.close();
}

await browser.close(); server.close();
console.log(fehler.length === 0 ? '\n--- bestanden ---' : '\n--- NICHT bestanden: ' + fehler.length + ' ---');
process.exit(fehler.length === 0 ? 0 : 1);
