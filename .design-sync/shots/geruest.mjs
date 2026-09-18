/* Nimmt die Trainer-Ansicht als GERUESTAUFNAHME auf: echtes styles.css,
   echte Kopfzeile und Navigation, aber fest eingesetzte Beispieldaten statt
   der laufenden App. Nur noetig, solange kein Testkonto zur Verfuegung steht.
   Ergebnis: .design-sync/reference/app/trainer-spielauswahl-geruest.png      */
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import { starte } from './server.mjs';

const { server, basis } = await starte(process.cwd());
const b = await chromium.launch({ channel: 'chrome' });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' });
const p = await ctx.newPage();

// Kopfzeile und Navigation woertlich aus index.html uebernehmen, damit das
// Geruest denselben Rahmen zeigt wie die echten Aufnahmen.
const roh = fs.readFileSync('index.html', 'utf8');
const stueck = (von, bis) => { const a = roh.indexOf(von), z = roh.indexOf(bis, a); return roh.slice(a, z + bis.length); };
const kopf = stueck('<header class="app-header">', '</header>')
  .replace(new RegExp("src=\"(assets/[^\"]+)\"", "g"), (m, f) => 'src="' + basis + '/' + f + '"');
const nav  = stueck('<nav class="app-nav"', '</nav>');

const markup = `<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="${basis}/styles.css">
${kopf}
<div class="scroll-area"><main class="view" id="view">
  <div class="page-head tv-head"><h1>Trainer</h1>
    <p>Spiel wählen, danach baust du die Elf auf dem Platz.</p></div>

  <div class="card tv-next">
    <div class="tv-next-kopf"><span class="tv-next-lbl">Nächstes Spiel</span><span class="tv-next-bdg">Heim</span></div>
    <div class="tv-next-zeile">
      <span class="tv-next-datum"><b class="num">20</b><i>Sep</i></span>
      <span class="tv-next-main"><span class="tv-next-t">VfB Sparta München</span>
      <span class="tv-next-m num">12:30 Uhr · Anpfiff in 3 Tagen</span></span>
    </div>
    <div class="tv-next-zahlen">
      <div class="tv-nz"><b class="num is-zu">11</b><span>Zugesagt</span></div>
      <div class="tv-nz"><b class="num is-ab">1</b><span>Abgesagt</span></div>
      <div class="tv-nz"><b class="num is-of">4</b><span>Offen</span></div>
    </div>
    <div class="tv-next-fuss"><button class="tv-next-btn">Elf aufstellen</button></div>
  </div>

  <button class="card tv-kader">
    <span class="tv-kader-kopf"><span class="tv-kader-t">Kader</span>
      <span class="tv-kader-n num">16 Spieler</span><span class="tv-garrow">›</span></span>
    <span class="tv-kbar" role="img" aria-label="12 fit, 2 angeschlagen, 1 verletzt, 1 Urlaub">
      <i class="is-fit" style="width:75.00%"></i><i class="is-ang" style="width:12.50%"></i><i class="is-verl" style="width:6.25%"></i><i class="is-url" style="width:6.25%"></i>
    </span>
    <span class="tv-kleg">
      <span class="tv-kstat"><i class="is-fit"></i><b class="num">12</b><span>fit</span></span>
      <span class="tv-kstat"><i class="is-ang"></i><b class="num">2</b><span>angeschlagen</span></span>
      <span class="tv-kstat"><i class="is-verl"></i><b class="num">1</b><span>verletzt</span></span>
      <span class="tv-kstat"><i class="is-url"></i><b class="num">1</b><span>Urlaub</span></span>
    </span>
  </button>

  <div class="section-title sec-mini"><h2>Weitere Spiele</h2><button class="link-btn">Alle &rsaquo;</button></div>
  <div class="card tv-glist">
    <button class="tv-grow">
      <span class="tv-gdate"><span class="d-day num">27</span><span class="d-mon">Sep</span></span>
      <span class="tv-gmain"><span class="tv-gopp">FT München-Gern 2</span>
        <span class="tv-gmeta num">10:00 · Auswärts</span></span>
      <span class="tv-gchip">Elf steht</span><span class="tv-garrow">›</span>
    </button>
    <button class="tv-grow">
      <span class="tv-gdate"><span class="d-day num">4</span><span class="d-mon">Okt</span></span>
      <span class="tv-gmain"><span class="tv-gopp">SV Olympiadorf München</span>
        <span class="tv-gmeta num">12:30 · Heim</span></span>
      <span class="tv-gchip is-offen">offen</span><span class="tv-garrow">›</span>
    </button>
  </div>

  <div class="section-title sec-mini"><h2>Vorlagen</h2><button class="link-btn">Neu &rsaquo;</button></div>
  <div class="card tv-tpls">
    <div class="tv-tpl">
      <span class="tv-tpl-main"><span class="tv-tpl-n">4-3-3 Standard</span>
        <span class="rs">geändert am 17. Sep</span></span>
      <span class="tv-tpl-chip num">4-3-3</span>
      <button class="icon-btn" aria-label="Vorlage löschen">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>
      </button>
    </div>
  </div>
</main>
<footer class="app-footer"><button class="link-btn">Neu laden</button></footer></div>
${nav}`;

await p.setContent(markup, { waitUntil: 'networkidle' });
await p.evaluate(() => {
  document.querySelectorAll('.nav-btn').forEach((e, i) => e.classList.toggle('is-active', i === 4));
  const m = document.getElementById('navMore'); if (m) m.style.display = '';
});
await p.waitForTimeout(600);
const ziel = path.join(process.cwd(), '.design-sync', 'reference', 'app', 'trainer-spielauswahl-geruest.png');
await p.screenshot({ path: ziel, fullPage: true });
const h = await p.evaluate(() => document.documentElement.scrollHeight);
console.log('  trainer-spielauswahl-geruest   390 x ' + h);
await b.close(); server.close();
