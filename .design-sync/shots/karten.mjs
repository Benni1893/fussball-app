/* Sichtprüfung der Vorschaukarten: jede Karte im Browser laden, Höhe messen,
   Konsolenfehler sammeln und einen Schnappschuss ablegen.
   Aufruf: node .design-sync/shots/karten.mjs                                */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { starte } from './server.mjs';

const { server, basis } = await starte(process.cwd());
const OUT = path.join(process.cwd(), '.design-sync', 'reference', 'karten');
fs.mkdirSync(OUT, { recursive: true });

const karten = [];
for (const gruppe of fs.readdirSync('ds-bundle/components')) {
  for (const name of fs.readdirSync(path.join('ds-bundle/components', gruppe))) {
    karten.push([gruppe, name]);
  }
}

const b = await chromium.launch({ channel: 'chrome' });
const ctx = await b.newContext({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 });
let schlecht = 0;
for (const [gruppe, name] of karten) {
  const p = await ctx.newPage();
  const fehler = [];
  p.on('pageerror', (e) => fehler.push('pageerror: ' + e.message));
  p.on('requestfailed', (r) => fehler.push('laden: ' + r.url()));
  p.on('response', (r) => { if (r.status() >= 400 && !r.url().endsWith('/favicon.ico')) fehler.push(r.status() + ': ' + r.url()); });
  const url = `${basis}/ds-bundle/components/${gruppe}/${name}/${name}.html`;
  await p.goto(url, { waitUntil: 'networkidle' });
  await p.waitForTimeout(400);
  const mass = await p.evaluate(() => {
    const d = document.documentElement;
    const ungestylt = [...document.querySelectorAll('.sp > div > *')]
      .filter((e) => e.getBoundingClientRect().height === 0).length;
    return { h: d.scrollHeight, w: d.scrollWidth, ungestylt,
             schrift: getComputedStyle(document.body).fontFamily.split(',')[0] };
  });
  await p.screenshot({ path: path.join(OUT, gruppe + '__' + name + '.png'), fullPage: true });
  const ok = mass.h > 200 && mass.w <= 441 && !fehler.length;
  if (!ok) schlecht++;
  console.log((ok ? '  ok   ' : '  FEHL ') + (gruppe + '/' + name).padEnd(44)
    + String(mass.w).padStart(4) + ' x ' + String(mass.h).padStart(5)
    + '  ' + mass.schrift + (fehler.length ? '  ' + fehler.join(' | ') : ''));
  await p.close();
}
console.log(schlecht ? '--- ' + schlecht + ' Karten auffaellig ---' : '--- alle ' + karten.length + ' Karten rendern sauber ---');
await b.close(); server.close();
