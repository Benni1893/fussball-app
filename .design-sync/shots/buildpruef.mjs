/* Build-Kennung an allen Stellen gleich, Caches sicher.
   Anlass (03.10.2026): die Versions-Queries in index.html standen seit
   2026-09-17-D, waehrend BUILD und APP_BUILD weiterliefen, und sw.js hielt
   seinen Cache-Namen fest ("fn-sw-2"). Ohne Browser, ohne Netz.
   Aufruf: node .design-sync/shots/buildpruef.mjs                             */
import fs from 'node:fs';

const fehler = [];
const pruefe = (ok, text, detail) => {
  console.log((ok ? '  ok   ' : '  FEHL ') + text + (detail !== undefined ? '   ' + detail : ''));
  if (!ok) fehler.push(text);
};

const lies = (f) => fs.readFileSync(f, 'utf8');
const app = lies('app.js');
const html = lies('index.html');
const sw = lies('sw.js');
const vercel = JSON.parse(lies('vercel.json'));
const FORM = /^\d{4}-\d{2}-\d{2}-[A-Z]$/;

console.log('--- Build-Kennung ---');
const appBuild = (app.match(/var APP_BUILD = "([^"]+)"/) || [])[1];
const htmlBuild = (html.match(/var BUILD = "([^"]+)"/) || [])[1];
const swVersion = (sw.match(/const VERSION = "([^"]+)"/) || [])[1];
pruefe(FORM.test(appBuild || ''), 'APP_BUILD in app.js hat die Form JJJJ-MM-TT-X', appBuild);
pruefe(htmlBuild === appBuild, 'BUILD in index.html = APP_BUILD', htmlBuild + ' / ' + appBuild);
pruefe(swVersion === 'fn-sw-' + appBuild, 'VERSION in sw.js = "fn-sw-" + APP_BUILD', swVersion);

// Jede Versions-Query in index.html traegt dieselbe Kennung.
const queries = [...html.matchAll(/(?:href|src)="([^"]+)\?v=([^"]+)"/g)].map((m) => [m[1], m[2]]);
pruefe(queries.length >= 3, 'mindestens drei Versions-Queries (styles.css, db.js, app.js)', queries.length);
for (const [datei, v] of queries) pruefe(v === appBuild, 'Versions-Query ' + datei, v);
for (const datei of ['styles.css', 'db.js', 'app.js']) {
  pruefe(queries.some(([d]) => d === datei), datei + ' wird mit Versions-Query geladen');
}
// Lokale Skripte und Stylesheets ohne Query waeren eine vergessene Stelle.
const lokalOhne = [...html.matchAll(/<(?:script|link)[^>]+(?:src|href)="([^"?#:]+\.(?:js|css))"/g)]
  .map((m) => m[1]).filter((d) => !/^config\.js$/.test(d));
pruefe(lokalOhne.length === 0, 'kein lokales Skript oder Stylesheet ohne Versions-Query (ausser config.js)',
  lokalOhne.join(', ') || undefined);

// Prueffixturen duerfen keine feste Kopie der Kennung haben.
const fixturen = fs.readdirSync('.design-sync/shots').filter((f) => f.endsWith('.mjs') && f !== 'buildpruef.mjs');
const feste = fixturen.filter((f) => /APP_BUILD\s*=\s*"\d{4}-\d{2}-\d{2}-[A-Z]"/.test(lies('.design-sync/shots/' + f)));
pruefe(feste.length === 0, 'keine feste APP_BUILD-Kopie in den Pruefskripten', feste.join(', ') || undefined);

console.log('--- Service Worker ---');
pruefe(/caches\.keys\(\)[\s\S]{0,120}if \(k !== VERSION\) await caches\.delete\(k\)/.test(sw),
  'activate loescht jeden Cache ausser dem aktuellen');
pruefe(/self\.skipWaiting\(\)/.test(sw) && /self\.clients\.claim\(\)/.test(sw),
  'neuer Worker uebernimmt sofort (skipWaiting, clients.claim)');
pruefe(/c\.add\(new Request\(OFFLINE, \{ cache: "reload" \}\)\)/.test(sw),
  'install holt die Offline-Seite am HTTP-Cache vorbei');
pruefe(/req\.mode !== "navigate"\) return;/.test(sw),
  'fetch greift nur bei Seitenaufrufen (App-Dateien laufen am Worker vorbei)');
pruefe((sw.match(/caches\.open\(/g) || []).length === 1 && /caches\.open\(VERSION\)/.test(sw),
  'genau ein Cache, benannt nach VERSION');
pruefe(!/cache\.put|c\.put\(|addAll\(/.test(sw), 'kein weiteres Zwischenspeichern von Antworten');

console.log('--- HTTP-Header (vercel.json) ---');
const header = (quelle) => {
  const h = (vercel.headers || []).find((x) => x.source === quelle);
  const c = h && h.headers.find((x) => x.key.toLowerCase() === 'cache-control');
  return c ? c.value : '';
};
pruefe(/no-store/.test(header('/')), '/ wird nie zwischengespeichert (no-store)', header('/'));
pruefe(/no-store/.test(header('/index.html')), '/index.html no-store', header('/index.html'));
pruefe(/no-cache/.test(header('/(.*)\\.(js|css|json)')) && /must-revalidate/.test(header('/(.*)\\.(js|css|json)')),
  'js, css, json: no-cache, must-revalidate (Browser fragt jedes Mal nach)', header('/(.*)\\.(js|css|json)'));

console.log(fehler.length === 0 ? '\n--- bestanden ---' : '\n--- NICHT bestanden: ' + fehler.length + ' ---');
process.exit(fehler.length === 0 ? 0 : 1);
