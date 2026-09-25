/* Zwei Entwuerfe fuer das Android-Badge-Icon (Statusleiste).
   Android nimmt nur den Alphakanal und faerbt ihn weiss - deshalb rein
   monochrom auf transparentem Grund. Geliefert wird 96x96, angezeigt wird es
   bei rund 24 dp; die Vorschau zeigt beides plus eine Statusleisten-Simulation.
   Aufruf: node .design-sync/shots/badge.mjs                                  */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const ZIEL = path.join(process.cwd(), '.design-sync', 'reference', 'compare');
fs.mkdirSync(ZIEL, { recursive: true });

/* Variante A - Fussball. Bewusst grob: bei 24 px zerfaellt ein echtes
   Fuenfeck-Sechseck-Muster zu Grau. Ein voller Kreis mit einem zentralen
   Fuenfeck und fuenf angeschnittenen Ecken bleibt als Ball lesbar. */
const BALL = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96">
  <defs><mask id="m">
    <rect width="96" height="96" fill="#000"/>
    <circle cx="48" cy="48" r="42" fill="#fff"/>
    <!-- zentrales Fuenfeck -->
    <path d="M48 27 L66 40 L59 61 L37 61 L30 40 Z" fill="#000"/>
    <!-- fuenf angeschnittene Ecken am Rand -->
    <path d="M48 6 L57 19 L48 24 L39 19 Z" fill="#000"/>
    <path d="M90 37 L82 50 L72 44 L74 33 Z" fill="#000"/>
    <path d="M74 88 L66 76 L75 68 L84 75 Z" fill="#000"/>
    <path d="M22 88 L30 76 L21 68 L12 75 Z" fill="#000"/>
    <path d="M6 37 L14 50 L24 44 L22 33 Z" fill="#000"/>
  </mask></defs>
  <rect width="96" height="96" fill="#fff" mask="url(#m)"/>
</svg>`;

/* Variante B - "FN". Sehr fett und eng, sonst verschwinden die Buchstaben. */
const FN = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96">
  <g fill="#fff">
    <!-- F -->
    <rect x="10" y="22" width="15" height="52" rx="2"/>
    <rect x="10" y="22" width="34" height="14" rx="2"/>
    <rect x="10" y="41" width="28" height="13" rx="2"/>
    <!-- N: zwei Staemme plus schmale Diagonale; die beiden Punzen muessen
         offen bleiben, sonst wird daraus bei 24 px ein Klotz. -->
    <rect x="52" y="22" width="13" height="52" rx="2"/>
    <rect x="73" y="22" width="13" height="52" rx="2"/>
    <path d="M52 22 L63 22 L86 58 L86 74 L75 74 L52 38 Z"/>
  </g>
</svg>`;

const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage();

/* 1. Die beiden PNG in Originalgroesse erzeugen */
for (const [name, svg] of [['ball', BALL], ['fn', FN]]) {
  await p.setViewportSize({ width: 96, height: 96 });
  await p.setContent(`<body style="margin:0;background:transparent">${svg}</body>`);
  await p.screenshot({ path: path.join(ZIEL, 'badge-' + name + '-96.png'), omitBackground: true });
}

/* 2. Vergleichsblatt */
const kachel = (titel, svg) => `
  <section>
    <h2>${titel}</h2>
    <div class="reihe">
      <div class="feld dunkel"><div class="gross">${svg}</div><span>96 px</span></div>
      <div class="feld dunkel"><div class="klein">${svg}</div><span>24 px (Anzeige)</span></div>
      <div class="feld hell"><div class="klein schwarz">${svg}</div><span>24 px, helle Leiste</span></div>
    </div>
    <div class="bar">
      <span class="zeit">9:41</span>
      <span class="mini">${svg}</span>
      <span class="spacer"></span>
      <span class="sys">▮▮▮ ▲ ▰</span>
    </div>
  </section>`;

await p.setViewportSize({ width: 760, height: 900 });
await p.setContent(`<body>
<style>
  body { margin:0; padding:24px; background:#eceeed; font:14px/1.5 Inter, system-ui, sans-serif; color:#1c2620; }
  h1 { font-size:17px; margin:0 0 4px; }
  .hint { color:#66756d; font-size:13px; margin:0 0 20px; }
  section { margin-bottom:26px; }
  h2 { font-size:13px; text-transform:uppercase; letter-spacing:.06em; color:#144a37; margin:0 0 10px; }
  .reihe { display:flex; gap:12px; align-items:stretch; }
  .feld { display:flex; flex-direction:column; align-items:center; gap:8px; padding:14px 18px; border-radius:12px; }
  .feld span { font-size:11px; color:#8b968f; }
  .dunkel { background:#17181a; } .dunkel span { color:#9aa29c; }
  .hell { background:#f2f4f3; border:1px solid #e2e8e4; }
  .gross svg { width:96px; height:96px; display:block; }
  .klein svg { width:24px; height:24px; display:block; }
  .schwarz svg rect[fill="#fff"], .schwarz svg g[fill="#fff"] { fill:#3c4440 !important; }
  .bar { margin-top:12px; display:flex; align-items:center; gap:8px; height:28px; padding:0 12px;
         background:#17181a; color:#fff; border-radius:8px 8px 0 0; font-size:12px; font-weight:600; }
  .bar .mini svg { width:17px; height:17px; display:block; }
  .bar .spacer { flex:1; }
  .bar .sys { letter-spacing:2px; font-size:10px; }
</style>
<h1>Badge-Icon für die Android-Statusleiste</h1>
<p class="hint">Android nutzt nur den Alphakanal und färbt ihn weiß. Die dritte Spalte zeigt, wie es auf einer hellen Leiste aussähe. Ganz unten je eine Statusleisten-Simulation bei echter Größe.</p>
${kachel('Variante A — Fußball', BALL)}
${kachel('Variante B — „FN"', FN)}
</body>`);
await p.locator('body').screenshot({ path: path.join(ZIEL, 'badge-vergleich.png') });

await b.close();
console.log('geschrieben:');
for (const f of ['badge-ball-96.png', 'badge-fn-96.png', 'badge-vergleich.png']) {
  console.log('  .design-sync/reference/compare/' + f + '  ' + fs.statSync(path.join(ZIEL, f)).size + ' Bytes');
}
