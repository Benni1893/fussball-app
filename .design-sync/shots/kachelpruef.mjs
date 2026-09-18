/* Misst die beiden Trainer-Kacheln in einem Gerüst mit dem echten Stylesheet -
   ohne Anmeldung, weil kein Testkonto vorhanden ist. Die Werte werden gegen
   die Messung aus .design-sync/reference/trainer-kacheln-v2.png gehalten.   */
import { chromium } from 'playwright';
import path from 'node:path';
import { starte } from './server.mjs';

const { server, basis } = await starte(process.cwd());
const b = await chromium.launch({ channel: 'chrome' });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' });
const p = await ctx.newPage();

const markup = `
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="${basis}/styles.css">
<style>body{margin:0;background:var(--bg);padding:0 16px}</style>
<div id="view" class="view" style="padding:0">
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
  <span class="tv-kader-kopf"><span class="tv-kader-t">Kader</span><span class="tv-kader-n num">16 Spieler</span><span class="tv-garrow">›</span></span>
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
</div>`;
await p.setContent(markup, { waitUntil: 'networkidle' });
await p.waitForTimeout(600);

const sel = ['.tv-next', '.tv-next-kopf', '.tv-next-lbl', '.tv-next-bdg', '.tv-next-zeile',
  '.tv-next-datum', '.tv-next-datum b', '.tv-next-datum i', '.tv-next-t', '.tv-next-m',
  '.tv-next-zahlen', '.tv-nz', '.tv-nz b', '.tv-nz span', '.tv-next-fuss', '.tv-next-btn',
  '.tv-kader', '.tv-kader-kopf', '.tv-kader-t', '.tv-kader-n', '.tv-garrow',
  '.tv-kbar', '.tv-kbar i', '.tv-kleg', '.tv-kstat', '.tv-kstat i', '.tv-kstat b'];
console.log(await p.evaluate((s) => {
  const basis = document.querySelector('.tv-next').getBoundingClientRect();
  const kad = document.querySelector('.tv-kader').getBoundingClientRect();
  return s.map((x) => {
    const e = document.querySelector(x); if (!e) return x.padEnd(20) + 'FEHLT';
    const r = e.getBoundingClientRect(); const c = getComputedStyle(e);
    const o = x.startsWith('.tv-kader') || x.startsWith('.tv-kbar') || x.startsWith('.tv-kstat') || x === '.tv-garrow' ? kad.top : basis.top;
    return x.padEnd(20) + ('rel ' + (r.top - o).toFixed(1)).padEnd(11)
      + ('h ' + r.height.toFixed(1)).padEnd(9) + ('x ' + r.left.toFixed(1)).padEnd(9)
      + ('b ' + r.width.toFixed(1)).padEnd(9) + c.fontSize + '/' + c.fontWeight;
  }).join('\n');
}, sel));
console.log("--- Diagnose .tv-kstat ---");
console.log(await p.evaluate(() => {
  const e = document.querySelector(".tv-kstat"); const c = getComputedStyle(e);
  const k = [...e.children].map((x) => x.tagName + " " + x.getBoundingClientRect().width.toFixed(1) + "x" + x.getBoundingClientRect().height.toFixed(1) + " d=" + getComputedStyle(x).display).join(" | ");
  return "display=" + c.display + " flexDirection=" + c.flexDirection + " flexWrap=" + c.flexWrap
    + " whiteSpace=" + c.whiteSpace + " | Kinder: " + k;
}));
await p.screenshot({ path: path.join(process.cwd(), '.design-sync', 'reference', 'app', 'trainer-kacheln-ist.png'), fullPage: true });

console.log("--- Regeln ---");
console.log(await p.evaluate(() => {
  const d = document.documentElement;
  const klein = [];
  document.querySelectorAll("#view button").forEach((e) => {
    const r = e.getBoundingClientRect(); if (r.height && r.height < 43.5) klein.push(e.className + " " + r.height.toFixed(0));
  });
  const ueber = [...document.querySelectorAll("#view *")].filter((e) => e.getBoundingClientRect().right > 390.5)
    .map((e) => e.className).slice(0, 5);
  const lum = (hex) => { const c = hex.match(new RegExp("[0-9.]+","g")).map(Number).slice(0,3).map((v) => { v/=255; return v<=0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); });
    return 0.2126*c[0] + 0.7152*c[1] + 0.0722*c[2]; };
  const kon = (sel) => { const e = document.querySelector(sel); if (!e) return sel + " fehlt";
    let bg = "rgb(255, 255, 255)", n = e;
    while (n && n !== document.documentElement) { const b = getComputedStyle(n).backgroundColor;
      if (b && b !== "rgba(0, 0, 0, 0)") { bg = b; break; } n = n.parentElement; }
    const l1 = lum(getComputedStyle(e).color), l2 = lum(bg);
    const v = (Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05);
    return sel + " " + v.toFixed(2) + ":1"; };
  return "waagerecht " + d.scrollWidth + " = " + d.clientWidth
    + " | ueber den Rand: " + (ueber.length ? ueber.join(", ") : "nichts")
    + " | unter 44px: " + (klein.length ? klein.join(", ") : "keine")
    + " | Kontrast: " + [".tv-next-lbl", ".tv-next-bdg", ".tv-next-datum i", ".tv-next-m",
        ".tv-nz b.is-zu", ".tv-nz b.is-ab", ".tv-nz b.is-of", ".tv-nz span",
        ".tv-next-btn", ".tv-kader-n", ".tv-kstat"].map(kon).join("  ");
}));
await b.close(); server.close();
