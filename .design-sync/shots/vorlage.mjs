/* Rendert die Vorlage .design-sync/concepts/App in 2a - High End.dc.html in
   iPhone-Groesse und legt jeden .ph-Rahmen einzeln als PNG ab.
   Aufruf aus dem Repo-Wurzelverzeichnis: node .design-sync/shots/vorlage.mjs   */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const OUT  = path.join(ROOT, '.design-sync', 'reference', 'vorlage');
fs.mkdirSync(OUT, { recursive: true });

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
               '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml' };

const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
  // assets/ liegt im Repo-Wurzelverzeichnis, die Vorlage zwei Ebenen tiefer.
  const file = path.join(ROOT, rel.replace(/^\.design-sync\/concepts\/assets\//, 'assets/'));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end('nicht gefunden'); return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;

// Frame-ID in der Vorlage -> Dateiname
const SCREENS = {
  'f-uebersicht-trainer': 'uebersicht-trainer',
  'f-uebersicht-spieler': 'uebersicht-spieler',
  'f-kalender':           'kalender',
  'f-lineup-pick':        'trainer-spielauswahl',
  'f-lineup-pitch':       'trainer-platz',
  'f-konto':              'konto',
  'f-katalog':            'katalog',
  'f-kasse':              'kasse',
  'f-einstellungen':      'einstellungen',
  'f-profil':             'profil',
  'f-rollen':             'rollen',
  'f-mehr':               'mehr',
  'f-anmeldung':          'anmeldung',
  'f-spielerwahl':        'spielerzuordnung',
};

const browser = await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({
  viewport: { width: 1400, height: 900 },   // breit, damit alle Rahmen nebeneinander stehen
  deviceScaleFactor: 3,
});
const page = await ctx.newPage();
// <x-dc>/<helmet> sind unbekannte Elemente - ohne die Runtime brauchen sie block.
await page.addInitScript(() => {
  document.addEventListener('DOMContentLoaded', () => {
    const s = document.createElement('style');
    s.textContent = 'x-dc{display:block}helmet{display:none}';
    document.head.appendChild(s);
  });
});
const url = `http://127.0.0.1:${PORT}/.design-sync/concepts/${encodeURIComponent('App in 2a - High End.dc.html')}`;
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);   // Webfont

const mass = {};
for (const [id, name] of Object.entries(SCREENS)) {
  const el = await page.$(`#${id} .ph`);
  if (!el) { console.log('FEHLT in der Vorlage: ' + id); continue; }
  await el.screenshot({ path: path.join(OUT, name + '.png') });
  const box = await el.boundingBox();
  mass[name] = { w: Math.round(box.width), h: Math.round(box.height) };
}
console.log(JSON.stringify(mass, null, 1));
await browser.close();
server.close();
