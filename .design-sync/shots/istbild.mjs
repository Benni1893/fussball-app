/* Rendert Kalender-Kopf und Trainer-Spielkarte mit dem echten Stylesheet bei
   390x844 und DSF 3 - die Ist-Seite fuer den Bildvergleich, solange keine
   Geraeteaufnahme vorliegt.
   Ergebnis: .design-sync/reference/compare/ist-geruest.png                    */
import { chromium } from 'playwright';
import path from 'node:path';
import { starte } from './server.mjs';

const { server, basis } = await starte(process.cwd());
const b = await chromium.launch({ channel: 'chrome' });
const ctx = await b.newContext({ viewport: { width: 390, height: 1100 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' });
const p = await ctx.newPage();
const PIN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-6-5.3-6-10a6 6 0 0 1 12 0c0 4.7-6 10-6 10z"/><circle cx="12" cy="11" r="2.2"/></svg>';

await p.setContent(`<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="${basis}/styles.css">
<style>body{margin:0;background:var(--grad-app)}#view{padding:12px 16px}</style>
<main class="view" id="view">
  <div class="page-head"><h1>Kalender</h1></div>
  <div class="kal-seg" role="tablist">
    <button class="kal-seg-b is-on" type="button">Alle</button>
    <button class="kal-seg-b" type="button">Spiele</button>
    <button class="kal-seg-b" type="button">Training</button>
    <button class="kal-seg-b" type="button">Sonstiges</button>
  </div>
  <button class="kal-neu" type="button">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
    <span>Termin hinzufügen</span></button>
  <div class="card tk" id="karte">
    <div class="tk-kopf">
      <span class="tk-datum"><span class="d-wd">So</span><span class="d-day num">20</span><span class="d-mon">Sep</span></span>
      <span class="tk-kopf-main">
        <span class="tk-oben"><span class="tk-bdg">Heim</span><span class="tk-zeit num">12:30 Uhr</span></span>
        <span class="tk-titel">VfB Sparta München</span></span>
      <button class="tk-menue" type="button">⋯</button>
    </div>
    <div class="tk-body">
      <a class="tk-feld tk-ort" href="#">
        <span class="tk-ort-ic" aria-hidden="true">${PIN}</span>
        <span class="tk-ort-main"><span class="tk-ort-n">BSA Lerchenauer Straße</span>
        <span class="tk-ort-a">Lerchenauer Str. 220 · Kunstrasen 2</span></span>
        <span class="tk-route" aria-hidden="true">Route</span></a>
      <div class="tk-rsvp"><button class="tk-btn is-on" type="button">Zusage</button>
        <button class="tk-btn is-ab" type="button">Absage</button></div>
      <button class="tk-feld tk-zusagen" type="button">
        <span class="tk-z-kopf"><span class="tk-z-lbl">Zusagen</span>
        <span class="tk-z-offen num">15 offen<span class="tk-chev">›</span></span></span>
        <span class="tk-bar"><i class="is-zu" style="width:6.25%"></i><i class="is-ab" style="width:0%"></i></span>
        <span class="tk-z-zahlen num"><b>1</b> zugesagt · <b>0</b> abgesagt · <b>15</b> offen</span>
      </button>
    </div>
  </div>
</main>`, { waitUntil: 'networkidle' });
await p.waitForTimeout(700);
const ziel = path.join(process.cwd(), '.design-sync', 'reference', 'compare', 'ist-geruest.png');
await p.screenshot({ path: ziel, fullPage: true });
console.log(JSON.stringify(await p.evaluate(() => {
  const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect();
    return { y: +b.top.toFixed(1), h: +b.height.toFixed(1), x: +b.left.toFixed(1), b: +b.width.toFixed(1) }; };
  const cs = (s, p) => { const e = document.querySelector(s); return e ? getComputedStyle(e)[p] : null; };
  return { karte: r('#karte'), seg: r('.kal-seg'), segb: r('.kal-seg-b.is-on'), h1: r('.page-head h1'),
    neu: r('.kal-neu'), bdg: r('.tk-bdg'), zus: r('.tk-feld.tk-zusagen'), lbl: r('.tk-z-lbl'),
    bar: r('.tk-bar'), zahlen: r('.tk-z-zahlen'),
    segRadius: cs('.kal-seg','borderRadius'), segbRadius: cs('.kal-seg-b','borderRadius'),
    segPad: cs('.kal-seg','padding'), segBg: cs('.kal-seg','backgroundColor'),
    segbBg: cs('.kal-seg-b.is-on','backgroundImage'), zahlenSize: cs('.tk-z-zahlen','fontSize') };
}), null, 1));
await b.close(); server.close();
