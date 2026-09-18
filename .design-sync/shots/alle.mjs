/* Setzt alle App-Screenshots zu einer Uebersichtsdatei zusammen:
   .design-sync/reference/app/ALLE.png - jeder Screen mit Beschriftung
   nebeneinander, sehr lange Screens auf 1600 CSS-Pixel gekappt.
   Aufruf aus dem Repo-Wurzelverzeichnis: node .design-sync/shots/alle.mjs   */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.join(process.cwd(), '.design-sync', 'reference', 'app');
const REIHE = [
  ['anmeldung', 'Anmeldung'],
  ['uebersicht-trainer', 'Übersicht · Trainer'],
  ['uebersicht-spieler', 'Übersicht · Spieler'],
  ['kalender', 'Kalender'],
  ['trainer-spielauswahl-geruest', 'Trainer · Spielauswahl', 'Gerüst'],
  ['trainer-platz', 'Trainer · Platz'],
  ['rueckmeldungen-sheet', 'Rückmeldungen · Blatt'],
  ['kader', 'Kader'],
  ['konto', 'Konto'],
  ['katalog', 'Katalog'],
  ['kasse', 'Kasse'],
  ['einstellungen', 'Einstellungen'],
  ['profil', 'Profil'],
  ['rollen', 'Rollen'],
  ['mehr', 'Mehr'],
];
const MAX = 1600;   // laengere Screens werden gekappt, sonst wird die Datei unlesbar

const karten = [];
for (const [datei, titel, marke] of REIHE) {
  const p = path.join(DIR, datei + '.png');
  if (!fs.existsSync(p)) { console.log('fehlt: ' + datei); continue; }
  const b = fs.readFileSync(p);
  const d = fs.statSync(p).mtime;
  const stand = String(d.getDate()).padStart(2,"0") + "." + String(d.getMonth()+1).padStart(2,"0") + ". " + String(d.getHours()).padStart(2,"0") + ":" + String(d.getMinutes()).padStart(2,"0");
  const h = Math.round(b.readUInt32BE(20) / 3);   // Device-Scale 3 -> CSS-Pixel
  karten.push({ titel, marke, stand, hoehe: h, gekappt: h > MAX,
                daten: 'data:image/png;base64,' + b.toString('base64') });
}

const html = `<style>
  body { margin:0; background:#eceeec; font:13px/1.4 Inter,system-ui,sans-serif; padding:28px; }
  .reihe { display:grid; grid-template-columns:repeat(5, 390px); gap:28px 24px; align-items:start; }
  .karte { flex:none; width:390px; }
  .kopf  { display:flex; align-items:baseline; gap:8px; margin:0 0 8px; }
  .name  { font-weight:700; color:#1c2620; }
  .mass  { font-size:11px; color:#66756d; font-variant-numeric:tabular-nums; }
  .marke { font-size:10px; font-weight:700; letter-spacing:.06em; text-transform:uppercase;
           color:#7a5a0c; background:#fdf6e4; border:1px solid #ecdcae; border-radius:999px; padding:1px 7px; }
  .rahmen{ border:1px solid rgba(16,40,30,.14); border-radius:12px; overflow:hidden;
           background:#fff; box-shadow:0 8px 24px -14px rgba(16,40,30,.5); max-height:${MAX}px; }
  .rahmen img { display:block; width:390px; }
  .kapp  { font-size:11px; color:#a5281b; margin-top:6px; }
</style>
<div class="reihe">
${karten.map((k) => `  <div class="karte">
    <div class="kopf"><span class="name">${k.titel}</span><span class="mass">390 × ${k.hoehe} · ${k.stand}</span>${k.marke ? `<span class="marke">${k.marke}</span>` : ''}</div>
    <div class="rahmen"><img src="${k.daten}"></div>
    ${k.gekappt ? `<div class="kapp">oben ${MAX}px von ${k.hoehe}px</div>` : ''}
  </div>`).join('\n')}
</div>
<p style="margin:22px 2px 0;font-size:12px;color:#66756d">„Gerüst“: mit dem echten Stylesheet gerendert, aber mit fest eingesetzten Beispieldaten statt der laufenden App — solange kein Testkonto zur Verfügung steht. Alle übrigen Kacheln sind Aufnahmen der laufenden App; die Zeit hinter den Massen sagt, wann sie entstanden sind.</p>`;

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 2200, height: 1200 }, deviceScaleFactor: 1 });
await page.setContent(html);
await page.waitForTimeout(800);
const ziel = path.join(DIR, 'ALLE.png');
await page.locator('body').screenshot({ path: ziel });
const b = fs.readFileSync(ziel);
console.log('ALLE.png: ' + b.readUInt32BE(16) + ' x ' + b.readUInt32BE(20)
          + ' (' + Math.round(b.length / 1024) + ' KB, ' + karten.length + ' Screens)');
await browser.close();
