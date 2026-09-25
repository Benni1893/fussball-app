/* Service Worker im echten Browser: registriert er sich, uebernimmt er die
   Kontrolle, liefert er offline die Offline-Seite, und laesst er alles andere
   in Ruhe? Dazu das Manifest gegen die Plattform-Anforderungen.
   Aufruf: node .design-sync/shots/swpruef.mjs                                */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { starte } from './server.mjs';

const fehler = [];
const pruefe = (ok, text, detail) => {
  console.log((ok ? '  ok   ' : '  FEHL ') + text + (detail !== undefined ? '   ' + detail : ''));
  if (!ok) fehler.push(text);
};

/* ---- 1. Manifest ------------------------------------------------------- */
console.log('--- manifest.json ---');
const m = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
for (const feld of ['id', 'name', 'short_name', 'start_url', 'scope', 'display']) {
  pruefe(!!m[feld], 'Feld ' + feld, JSON.stringify(m[feld]));
}
pruefe(m.display === 'standalone', 'display ist standalone', m.display);
const groessen = (m.icons || []).map((i) => i.sizes);
pruefe(groessen.includes('192x192'), 'Icon 192', groessen.join(' '));
pruefe(groessen.includes('512x512'), 'Icon 512');
pruefe((m.icons || []).some((i) => (i.purpose || '').includes('maskable')), 'maskable vorhanden');
const html = fs.readFileSync('index.html', 'utf8');
pruefe(/rel="apple-touch-icon"/.test(html), 'apple-touch-icon im HTML');
pruefe(/rel="manifest"/.test(html), 'Manifest verlinkt');
// Das badge-Icon kommt erst mit Phase 1b (Auswahl steht aus).
pruefe(!fs.existsSync('assets/badge-96.png'), 'badge-96 noch nicht vorhanden (Phase 1b)', 'erwartet');

/* ---- 2. Diagnose-Knopf -------------------------------------------------- */
console.log('--- Diagnose-Knopf ---');
pruefe(!/getRegistrations\(\)\.then\(function\(rs\)\{ rs\.forEach\(function\(x\)\{ x\.unregister\(\); \}\); \}\)/.test(html),
  'deregistriert den Service Worker NICHT mehr');
pruefe(/indexOf\("fn-sw-"\) !== 0/.test(html), 'laesst den Worker-Cache stehen');

/* ---- 3. Im Browser ------------------------------------------------------ */
const { server, basis } = await starte(process.cwd());
const b = await chromium.launch({ channel: 'chrome' });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
const konsole = [];
p.on('console', (msg) => { if (msg.type() === 'error') konsole.push(msg.text()); });

await p.goto(basis, { waitUntil: 'load' });
const bereit = await p.evaluate(async () => {
  if (!('serviceWorker' in navigator)) return { da: false };
  const r = await navigator.serviceWorker.ready;
  return { da: true, scope: r.scope, state: r.active && r.active.state, controller: !!navigator.serviceWorker.controller };
});
console.log('--- Registrierung ---');
pruefe(bereit.da, 'Service Worker verfuegbar');
await p.waitForFunction(async () => {
  const r = await navigator.serviceWorker.ready; return r.active && r.active.state === 'activated';
}, null, { timeout: 5000 }).catch(() => {});
const zustand = await p.evaluate(async () => (await navigator.serviceWorker.ready).active.state);
pruefe(zustand === 'activated', 'aktiviert', zustand);
pruefe(/\/$/.test(bereit.scope || ''), 'Scope ist die Wurzel', bereit.scope);

// clients.claim: die bereits offene Seite wird uebernommen (evtl. einen Tick spaeter).
await p.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 5000 }).catch(() => {});
pruefe(await p.evaluate(() => !!navigator.serviceWorker.controller), 'kontrolliert die offene Seite (clients.claim)');

const konsoleOnline = konsole.slice();
console.log('--- Offline ---');
await ctx.setOffline(true);
const r = await p.goto(basis, { waitUntil: 'load' }).catch(() => null);
pruefe(!!r && r.status() === 200, 'Navigation liefert eine Antwort', r ? r.status() : 'keine');
const txt = await p.evaluate(() => document.body.textContent || '');
pruefe(/Keine Verbindung/.test(txt), 'Offline-Seite erscheint');
// Nicht-Navigationen bleiben unberuehrt: styles.css muss offline scheitern.
const css = await p.evaluate(async (u) => {
  try { const x = await fetch(u + 'styles.css'); return 'status ' + x.status; }
  catch (e) { return 'fehlgeschlagen'; }
}, basis);
pruefe(css === 'fehlgeschlagen', 'styles.css wird NICHT aus dem Worker bedient', css);
await ctx.setOffline(false);

console.log('--- Cache-Inhalt ---');
const inhalt = await p.evaluate(async () => {
  const namen = await caches.keys();
  const out = {};
  for (const n of namen) out[n] = (await (await caches.open(n)).keys()).map((q) => q.url.split('/').pop());
  return out;
});
console.log('  ' + JSON.stringify(inhalt));
const alle = Object.values(inhalt).flat();
pruefe(alle.length === 1 && alle[0] === 'offline.html', 'genau eine Datei im Cache', alle.join(', ') || 'leer');
pruefe(!alle.includes('app.js') && !alle.includes('styles.css') && !alle.includes('index.html'),
  'keine App-Datei im Cache - no-cache-Header bleiben massgeblich');

pruefe(konsoleOnline.length === 0, 'keine Konsolenfehler im Online-Betrieb', konsoleOnline.join(' | ') || 'keine');
console.log('  (im Offline-Test erwartet und ignoriert: ' + (konsole.length - konsoleOnline.length) + ' x ERR_INTERNET_DISCONNECTED)');

await p.screenshot({ path: path.join(process.cwd(), '.design-sync', 'reference', 'compare', 'sw-offline.png'), clip: { x: 0, y: 0, width: 390, height: 420 } });
await b.close(); server.close();

console.log(fehler.length === 0 ? '\n--- bestanden ---' : '\n--- NICHT bestanden: ' + fehler.length + ' ---');
process.exit(fehler.length === 0 ? 0 : 1);
