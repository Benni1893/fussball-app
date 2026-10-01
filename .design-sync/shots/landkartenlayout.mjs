/* App-Landkarte, Schritt L3: Layout aus landkarte.json.

   Liest .design-sync/landkarte/landkarte.json (Ergebnis von landkarte.mjs)
   und baut daraus eine Seite: eine Spalte je Rolle, eine Zeile je Ebene
   (Tiefe im Klickpfad), SVG-Pfeile fuer die Kanten. Ueberfahren hebt die
   Kanten einer Karte hervor und zeigt ihre Ausloeser, Klick vergroessert
   das Bild und listet Klickpfad, Ausgaenge und Eingaenge.

   Ausgabe
     .design-sync/landkarte/landkarte.html                      versioniert,
         Bilder relativ verlinkt (bilder/<profil>/*.png)
     .design-sync/landkarte/bilder/rollen/<profil>.png          nicht versioniert,
         eine Spalte je Bild
     .design-sync/landkarte/bilder/landkarte-komplett.html      nicht versioniert,
         eigenstaendig: alle Bilder als JPEG eingebettet (Vorschau 300 px,
         gross 480 px), muss unter 15 MB bleiben

   Braucht die Bilder aus einem Lauf von landkarte.mjs. Kein Request nach
   aussen: die Seite hat keine externen Abhaengigkeiten, der Server ist lokal.

   Rot (Rueckgabewert 1): Bild fehlt, Seitenfehler, Kante ohne Knoten,
   eigenstaendige Fassung 15 MB oder groesser.

   Aufruf: node .design-sync/shots/landkartenlayout.mjs                   */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { starte } from './server.mjs';

const ZIEL = '.design-sync/landkarte';
const BILDER = path.join(ZIEL, 'bilder');
const ROLLEN = path.join(BILDER, 'rollen');
const KOMPLETT = path.join(BILDER, 'landkarte-komplett.html');
const REIHENFOLGE = ['anmeldung', 'spieler', 'trainer', 'kassenwart', 'trainerkassenwart', 'admin'];
const VORSCHAU = { breite: 300, qualitaet: 0.72 };
const GROSS = { breite: 480, qualitaet: 0.6 };
const GRENZE = 15 * 1024 * 1024;

const daten = JSON.parse(fs.readFileSync(path.join(ZIEL, 'landkarte.json'), 'utf8'));
let rot = 0;
const fehler = (t) => { console.error('ROT  ' + t); rot++; };

for (const p of REIHENFOLGE) if (!daten.profile[p]) fehler('Profil fehlt in landkarte.json: ' + p);
for (const p of Object.keys(daten.profile)) if (!REIHENFOLGE.includes(p)) fehler('Profil ohne Spalte: ' + p);
for (const p of REIHENFOLGE) {
  const da = new Set(daten.profile[p].knoten.map((n) => n.schluessel));
  for (const k of daten.profile[p].kanten) if (!da.has(k.von) || !da.has(k.nach)) fehler(`Kante ohne Knoten in ${p}: ${k.von} -> ${k.nach}`);
}
if (rot) process.exit(1);

/* Laeuft im Browser: baut die Karte aus #daten und zeichnet die Pfeile. */
function client() {
  const D = JSON.parse(document.getElementById('daten').textContent);
  const nur = new URLSearchParams(location.search).get('rolle');
  if (nur) document.body.classList.add('einzeln');
  const KARTE = 120, LUECKE = 18, MAX_REIHE = 5;
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const kurz = (t, n) => (t.length > n ? t.slice(0, n - 1) + '…' : t);

  const profile = D.reihenfolge.filter((p) => !nur || p === nur).map((id) => ({ id, ...D.profile[id] }));
  const knoten = new Map();
  for (const p of profile) for (const n of p.knoten) knoten.set(p.id + '|' + n.schluessel, { ...n, profil: p.id, aus: [], ein: [] });
  const bild = (n, gross) => (D.bilder ? D.bilder[n.profil + '|' + n.schluessel][gross ? 'g' : 'k'] : n.bild);
  /* Native Dialoge (confirm/alert) haben kein Bild: als Kasten mit ihrem Text zeichnen. */
  const vorschau = (n, gross) => {
    if (n.dialog) {
      const d = el('div', 'dialog');
      d.append(el('small', '', n.dialog.typ), el('p', '', n.dialog.text));
      return d;
    }
    const img = el('img');
    img.src = bild(n, gross); img.alt = n.ueberschrift || n.ansicht;
    if (!gross) { img.width = KARTE; img.height = Math.round(KARTE * 2532 / 1170); }
    img.onerror = () => { img.replaceWith(el('span', 'fehlt', 'Bild fehlt – landkarte.mjs laufen lassen')); };
    return img;
  };
  const name = (n) => n.ueberschrift || (n.dialog ? 'Dialog' : n.ansicht);
  const zusatz = (n) => (n.oben.length ? n.oben.join(' › ') : n.unter || (n.tiefe === 0 ? 'Start' : n.ansicht));

  /* Doppelte Kanten (gleiches Paar, andere Ausloeser) zu einer zusammenfassen. */
  const kanten = [];
  for (const p of profile) {
    const paare = new Map();
    for (const k of p.kanten) {
      const id = k.von + '>' + k.nach;
      if (!paare.has(id)) { paare.set(id, { profil: p.id, von: p.id + '|' + k.von, nach: p.id + '|' + k.nach, texte: [] }); kanten.push(paare.get(id)); }
      const t = (k.text || k.art).replace(/\s+/g, ' ').trim();
      if (!paare.get(id).texte.includes(t)) paare.get(id).texte.push(t);
    }
  }
  for (const k of kanten) { knoten.get(k.von).aus.push(k); knoten.get(k.nach).ein.push(k); }

  const nKnoten = profile.reduce((s, p) => s + p.knoten.length, 0);
  const nKanten = profile.reduce((s, p) => s + p.kanten.length, 0);
  const kopf = document.getElementById('kopf');
  kopf.append(
    el('h1', '', nur ? 'App-Landkarte · ' + profile[0].titel : 'App-Landkarte'),
    el('p', 'meta', `Stand der Testdaten ${D.jetzt.slice(8, 10)}.${D.jetzt.slice(5, 7)}.${D.jetzt.slice(0, 4)} ${D.jetzt.slice(11, 16)} · ${nKnoten} Zustände · ${nKanten} Kanten · Tiefengrenze ${D.maxTiefe} · erzeugt von ${D.erzeugtVon}`),
  );
  const legende = el('p', 'legende');
  legende.innerHTML = '<span class="l l-tief"></span> eine Ebene tiefer <span class="l l-quer"></span> gleiche Ebene <span class="l l-zurueck"></span> zurück nach oben'
    + (nur ? '' : ' · Karte überfahren zeigt ihre Auslöser, Klick vergrößert');
  kopf.append(legende);
  if (D.nichtErreichteAusloeser && D.nichtErreichteAusloeser.length) {
    kopf.append(el('p', 'warnung', 'Nicht verfolgt (Tiefengrenze): ' + D.nichtErreichteAusloeser.map((a) => JSON.stringify(a)).join(', ')));
  }

  const ebenen = Math.max(...profile.map((p) => Math.max(...p.knoten.map((n) => n.tiefe)))) + 1;
  const karte = document.getElementById('karte');
  karte.style.gridTemplateColumns = '64px ' + profile.map(() => 'max-content').join(' ');
  karte.append(el('div', 'ecke'));
  for (const p of profile) {
    const h = el('div', 'spaltenkopf');
    h.append(el('strong', '', p.titel), el('span', '', `${p.knoten.length} Zustände · ${p.kanten.length} Kanten` + (p.rollen ? ' · ' + p.rollen.join(', ') : '')));
    karte.append(h);
  }
  const karten = new Map();
  for (let e = 0; e < ebenen; e++) {
    karte.append(el('div', 'ebene' + (e % 2 ? ' ungerade' : ''), 'Ebene ' + e));
    for (const p of profile) {
      const reihe = Math.max(1, Math.min(MAX_REIHE, Math.max(...Array.from({ length: ebenen }, (_, i) => p.knoten.filter((n) => n.tiefe === i).length))));
      const zelle = el('div', 'zelle' + (e % 2 ? ' ungerade' : ''));
      zelle.style.width = reihe * KARTE + (reihe - 1) * LUECKE + 'px';
      for (const n0 of p.knoten.filter((n) => n.tiefe === e)) {
        const n = knoten.get(p.id + '|' + n0.schluessel);
        const b = el('button', 'karte' + (n.tiefe === 0 ? ' start' : ''));
        b.type = 'button';
        b.title = n.schluessel;
        b.append(vorschau(n, false), el('strong', '', name(n)), el('span', '', kurz(zusatz(n), 26)));
        b.addEventListener('mouseenter', () => fokus(n, true));
        b.addEventListener('mouseleave', () => fokus(n, false));
        b.addEventListener('click', () => zeige(n));
        karten.set(p.id + '|' + n.schluessel, b);
        zelle.append(b);
      }
      karte.append(zelle);
    }
  }

  const svg = document.createElementNS(NS, 'svg');
  svg.id = 'pfeile';
  karte.append(svg);
  const pfadVon = new Map();
  function zeichne() {
    svg.replaceChildren();
    svg.setAttribute('width', karte.scrollWidth); svg.setAttribute('height', karte.scrollHeight);
    const defs = document.createElementNS(NS, 'defs');
    for (const id of ['m', 'm-aus', 'm-ein']) defs.insertAdjacentHTML('beforeend',
      `<marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z"/></marker>`);
    svg.append(defs);
    const w = karte.getBoundingClientRect();
    const r = (b) => { const q = b.getBoundingClientRect(); return { l: q.left - w.left, t: q.top - w.top, b: q.bottom - w.top, x: (q.left + q.right) / 2 - w.left }; };
    for (const k of kanten) {
      const s = r(karten.get(k.von)), t = r(karten.get(k.nach));
      const ts = knoten.get(k.von).tiefe, tt = knoten.get(k.nach).tiefe;
      const art = tt > ts ? 'tief' : tt === ts ? 'quer' : 'zurueck';
      let d;
      if (t.t > s.b) {
        const c = Math.max(24, (t.t - s.b) / 2);
        d = `M${s.x},${s.b} C${s.x},${s.b + c} ${t.x},${t.t - c} ${t.x},${t.t - 2}`;
      } else if (Math.abs(t.t - s.t) < 2) {
        const h = 26 + Math.abs(t.x - s.x) * 0.12;
        d = `M${s.x},${s.t} C${s.x},${s.t - h} ${t.x},${t.t - h} ${t.x},${t.t - 2}`;
      } else {
        const c = Math.max(24, (s.t - t.b) / 2);
        d = `M${s.x},${s.t} C${s.x},${s.t - c} ${t.x},${t.b + c} ${t.x},${t.b + 2}`;
      }
      const g = document.createElementNS(NS, 'g');
      g.setAttribute('class', 'kante ' + art);
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', d);
      g.append(p);
      svg.append(g);
      const mitte = p.getPointAtLength(p.getTotalLength() / 2);
      const text = document.createElementNS(NS, 'text');
      text.setAttribute('x', mitte.x); text.setAttribute('y', mitte.y - 4);
      text.textContent = kurz(k.texte.join(' / '), 34);
      g.append(text);
      pfadVon.set(k, g);
    }
  }
  function fokus(n, an) {
    svg.classList.toggle('fokus', an);
    for (const k of n.aus) pfadVon.get(k)?.classList.toggle('aus', an);
    for (const k of n.ein) pfadVon.get(k)?.classList.toggle('ein', an);
    for (const k of n.aus) if (an) svg.append(pfadVon.get(k));
    for (const k of n.ein) if (an) svg.append(pfadVon.get(k));
  }

  const box = document.getElementById('gross');
  function zeige(n) {
    const inhalt = box.querySelector('.inhalt');
    inhalt.replaceChildren();
    const img = vorschau(n, true);
    const info = el('div', 'info');
    info.append(el('p', 'rolle', D.profile[n.profil].titel + ' · Ebene ' + n.tiefe), el('h2', '', name(n)), el('code', '', n.schluessel));
    info.append(el('h3', '', 'Klickpfad'));
    const pfad = el('ol');
    if (!n.pfad.length) pfad.append(el('li', 'leer', 'Startzustand'));
    for (const s of n.pfad) pfad.append(el('li', '', kurz((s.text || s.art).replace(/\s+/g, ' '), 60)));
    info.append(pfad);
    for (const [titel, liste, ziel] of [['Ausgänge', n.aus, 'nach'], ['Eingänge', n.ein, 'von']]) {
      info.append(el('h3', '', `${titel} (${liste.length})`));
      const ul = el('ul');
      for (const k of liste) {
        const z = knoten.get(k[ziel]);
        const li = el('li');
        const a = el('button', 'sprung', name(z) + ' · ' + kurz(zusatz(z), 24));
        a.type = 'button';
        a.addEventListener('click', () => zeige(z));
        li.append(a, el('span', '', kurz(k.texte.join(' / '), 50)));
        ul.append(li);
      }
      info.append(ul);
    }
    inhalt.append(img, info);
    box.hidden = false;
  }
  const zu = () => { box.hidden = true; };
  box.addEventListener('click', (e) => { if (e.target === box || e.target.classList.contains('schliessen')) zu(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') zu(); });

  zeichne();
  addEventListener('resize', zeichne);
  document.fonts.ready.then(() => { zeichne(); window.__fertig = true; });
}

const CSS = `
:root { --grund: #f4f7f5; --flaeche: #ffffff; --band: #e9eeeb; --text: #14211b; --leise: #5d6b64; --linie: #c9d2cd;
  --gruen: #1f7a4d; --aus: #1f7a4d; --ein: #b5541c; --kante: rgba(40, 70, 60, .38); }
* { box-sizing: border-box; }
html, body { margin: 0; background: var(--grund); color: var(--text); font: 14px/1.4 system-ui, -apple-system, 'Segoe UI', sans-serif; }
main { width: max-content; min-width: 100%; padding: 20px 24px 40px; }
.einzeln main { min-width: 0; }
.einzeln #kopf { max-width: 640px; }
#kopf h1 { margin: 0 0 4px; font-size: 22px; }
#kopf p { margin: 0 0 6px; color: var(--leise); font-size: 13px; }
#kopf .warnung { color: #a1361b; }
.legende .l { display: inline-block; width: 28px; height: 0; border-top: 2px solid var(--kante); vertical-align: middle; margin: 0 4px 0 10px; }
.legende .l:first-child { margin-left: 0; }
.legende .l-quer { border-top-style: dotted; } .legende .l-zurueck { border-top-style: dashed; }
#karte { position: relative; display: grid; margin-top: 16px; background: var(--flaeche); border: 1px solid var(--linie); border-radius: 12px; overflow: hidden; }
.ecke, .spaltenkopf { position: sticky; top: 0; z-index: 2; background: var(--flaeche); border-bottom: 1px solid var(--linie); }
.spaltenkopf { padding: 12px 20px 10px; border-left: 1px solid var(--linie); }
.spaltenkopf strong { display: block; font-size: 16px; }
.spaltenkopf span { color: var(--leise); font-size: 12px; }
.ebene { padding: 16px 8px; font-size: 12px; font-weight: 600; color: var(--leise); writing-mode: vertical-rl; transform: rotate(180deg); text-align: right; }
.zelle { display: flex; flex-wrap: wrap; align-content: flex-start; gap: 44px 18px; padding: 40px 20px 24px; border-left: 1px solid var(--linie); box-sizing: content-box; }
.ungerade { background: var(--band); }
.karte { all: unset; cursor: pointer; width: 120px; display: flex; flex-direction: column; gap: 2px; position: relative; z-index: 1; }
.karte img, .karte .fehlt, .karte .dialog { width: 120px; height: 260px; border-radius: 10px; border: 1px solid var(--linie); background: #fff; object-fit: cover; object-position: top; display: block; }
.karte .fehlt, #gross .fehlt { display: flex; align-items: center; justify-content: center; text-align: center; padding: 8px; color: var(--leise); font-size: 12px; }
.dialog { display: flex; flex-direction: column; justify-content: center; gap: 6px; padding: 10px; background: #f8f9f8 !important; }
.dialog small { font-size: 10px; text-transform: uppercase; letter-spacing: .06em; color: var(--leise); }
.dialog p { margin: 0; padding: 10px; background: #fff; border: 1px solid var(--linie); border-radius: 8px; font-size: 11px; white-space: pre-line; box-shadow: 0 2px 8px rgba(0, 0, 0, .08); }
#gross .dialog { padding: 32px; } #gross .dialog p { font-size: 16px; padding: 20px; }
.karte.start img { outline: 3px solid var(--gruen); outline-offset: 1px; }
.karte:hover img, .karte:focus-visible img { outline: 3px solid var(--aus); outline-offset: 1px; }
.karte strong { font-size: 12px; margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.karte span { font-size: 11px; color: var(--leise); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
#pfeile { position: absolute; left: 0; top: 0; pointer-events: none; z-index: 3; overflow: visible; }
#pfeile path { fill: none; stroke: var(--kante); stroke-width: 1.4; marker-end: url(#m); }
#pfeile marker path { fill: var(--kante); stroke: none; }
#m-aus path { fill: var(--aus) !important; } #m-ein path { fill: var(--ein) !important; }
#pfeile .quer path { stroke-dasharray: 2 3; } #pfeile .zurueck path { stroke-dasharray: 6 4; }
#pfeile text { display: none; font-size: 11px; font-weight: 600; text-anchor: middle; paint-order: stroke; stroke: #fff; stroke-width: 4px; stroke-linejoin: round; }
#pfeile.fokus .kante { opacity: .15; }
#pfeile.fokus .aus, #pfeile.fokus .ein { opacity: 1; }
#pfeile .aus path { stroke: var(--aus); stroke-width: 2.4; marker-end: url(#m-aus); }
#pfeile .ein path { stroke: var(--ein); stroke-width: 2.4; marker-end: url(#m-ein); }
#pfeile .aus text { display: block; fill: var(--aus); } #pfeile .ein text { display: block; fill: var(--ein); transform: translateY(15px); }
#gross { position: fixed; inset: 0; z-index: 10; background: rgba(10, 20, 15, .72); display: flex; align-items: center; justify-content: center; padding: 24px; }
#gross[hidden] { display: none; }
#gross .inhalt { display: flex; gap: 24px; max-height: 100%; background: var(--flaeche); border-radius: 14px; padding: 20px; position: relative; }
#gross .inhalt > img, #gross .inhalt > .fehlt, #gross .inhalt > .dialog { height: min(86vh, 900px); width: auto; aspect-ratio: 1170 / 2532; border-radius: 12px; border: 1px solid var(--linie); }
#gross .info { width: 340px; overflow-y: auto; max-height: min(86vh, 900px); }
#gross .rolle { margin: 0; color: var(--leise); font-size: 12px; }
#gross h2 { margin: 2px 0 4px; font-size: 20px; }
#gross h3 { margin: 16px 0 4px; font-size: 13px; text-transform: uppercase; letter-spacing: .04em; color: var(--leise); }
#gross code { font-size: 12px; color: var(--leise); word-break: break-all; }
#gross ol, #gross ul { margin: 0; padding-left: 20px; }
#gross li { margin: 3px 0; font-size: 13px; }
#gross li span { display: block; color: var(--leise); font-size: 12px; }
#gross .leer { color: var(--leise); list-style: none; margin-left: -20px; }
#gross .sprung { all: unset; cursor: pointer; color: var(--gruen); font-weight: 600; text-decoration: underline; text-underline-offset: 2px; }
#gross .schliessen { position: absolute; top: 8px; right: 12px; border: 0; background: none; font-size: 24px; cursor: pointer; color: var(--leise); }
`;

function seite(bilder) {
  const json = JSON.stringify({
    erzeugtVon: daten.erzeugtVon, jetzt: daten.jetzt, maxTiefe: daten.maxTiefe,
    nichtErreichteAusloeser: daten.nichtErreichteAusloeser, reihenfolge: REIHENFOLGE, profile: daten.profile, bilder,
  }).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>App-Landkarte</title>
<!-- Erzeugt von .design-sync/shots/landkartenlayout.mjs aus landkarte.json. Nicht von Hand bearbeiten. -->
<style>${CSS}</style>
</head>
<body>
<main>
<header id="kopf"></header>
<div id="karte"></div>
</main>
<div id="gross" hidden><div class="inhalt"></div><button class="schliessen" type="button" aria-label="Schließen">×</button></div>
<script type="application/json" id="daten">${json}</script>
<script>(${client.toString()})();</script>
</body>
</html>
`;
}

/* Bilder pruefen: ohne Lauf von landkarte.mjs gibt es keine PNGs. */
const alle = REIHENFOLGE.flatMap((p) => daten.profile[p].knoten.map((n) => ({ p, n })));
for (const { n } of alle) if (!n.bild && !n.dialog) fehler('Knoten ohne Bild und ohne Dialog: ' + n.schluessel);
for (const { n } of alle) if (n.bild && !fs.existsSync(path.join(ZIEL, n.bild))) fehler('Bild fehlt: ' + n.bild + ' (zuerst landkarte.mjs laufen lassen)');
if (rot) process.exit(1);

fs.writeFileSync(path.join(ZIEL, 'landkarte.html'), seite(null));
console.log('geschrieben ' + path.join(ZIEL, 'landkarte.html'));

const { server, basis } = await starte();
const browser = await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 2 });
ctx.on('request', (r) => { if (!r.url().startsWith(basis) && !r.url().startsWith('data:')) fehler('Request nach aussen: ' + r.url()); });
const page = await ctx.newPage();
page.on('pageerror', (e) => fehler('Seitenfehler: ' + e.message));
const url = basis + ZIEL.replace(/\\/g, '/') + '/landkarte.html';

async function bereit() {
  await page.waitForFunction(() => window.__fertig === true);
  await page.waitForFunction(() => [...document.images].every((i) => i.complete));
  const kaputt = await page.evaluate(() => document.querySelectorAll('.fehlt').length);
  if (kaputt) fehler(kaputt + ' Bilder nicht geladen: ' + page.url());
}

/* Gesamtansicht einmal laden: Seitenfehler und Bilder pruefen. */
await page.goto(url, { waitUntil: 'load' });
await bereit();

/* PNG je Rolle: nur die eine Spalte. */
fs.rmSync(ROLLEN, { recursive: true, force: true });
fs.mkdirSync(ROLLEN, { recursive: true });
for (const p of REIHENFOLGE) {
  await page.goto(url + '?rolle=' + p, { waitUntil: 'load' });
  await bereit();
  await page.locator('main').screenshot({ path: path.join(ROLLEN, p + '.png') });
  console.log('Bild    ' + path.join(ROLLEN, p + '.png'));
}

/* Eigenstaendige Fassung: Bilder im Browser verkleinern und als JPEG einbetten. */
const bilder = {};
for (const { p, n } of alle) {
  if (!n.bild) continue;
  const quelle = basis + (ZIEL + '/' + n.bild).replace(/\\/g, '/');
  bilder[p + '|' + n.schluessel] = await page.evaluate(async ({ quelle, stufen }) => {
    const bmp = await createImageBitmap(await (await fetch(quelle)).blob());
    const aus = {};
    for (const [k, s] of Object.entries(stufen)) {
      const c = document.createElement('canvas');
      c.width = s.breite; c.height = Math.round(bmp.height * s.breite / bmp.width);
      const g = c.getContext('2d');
      g.imageSmoothingQuality = 'high';
      g.drawImage(bmp, 0, 0, c.width, c.height);
      aus[k] = c.toDataURL('image/jpeg', s.qualitaet);
    }
    return aus;
  }, { quelle, stufen: { k: VORSCHAU, g: GROSS } });
}
fs.writeFileSync(KOMPLETT, seite(bilder));
const groesse = fs.statSync(KOMPLETT).size;
console.log(`geschrieben ${KOMPLETT}  ${(groesse / 1024 / 1024).toFixed(1)} MB (${groesse} Bytes)`);
if (groesse >= GRENZE) fehler('eigenstaendige Fassung zu gross: ' + groesse + ' Bytes');

/* Eigenstaendige Fassung ohne Server oeffnen: muss ohne jeden Request laufen. */
const ohne = await browser.newContext({ viewport: { width: 1400, height: 900 } });
ohne.on('request', (r) => { if (!r.url().startsWith('file:') && !r.url().startsWith('data:')) fehler('Request aus komplett: ' + r.url()); });
const p2 = await ohne.newPage();
p2.on('pageerror', (e) => fehler('Seitenfehler komplett: ' + e.message));
await p2.goto('file:///' + path.resolve(KOMPLETT).replace(/\\/g, '/'), { waitUntil: 'load' });
await p2.waitForFunction(() => window.__fertig === true);
const kaputt2 = await p2.evaluate(() => document.querySelectorAll('.fehlt').length);
if (kaputt2) fehler(kaputt2 + ' Bilder in komplett nicht geladen');

await browser.close();
server.close();
console.log(rot ? `ROT (${rot})` : 'GRÜN');
process.exit(rot ? 1 : 0);
