/* Gerätematrix: jede Ansicht, Unterseite, jedes Blatt und Menü je Rolle
   (alle Zustände aus landkarte.json, Stand-in aus landkartenmodul.mjs) bei
   neun Breiten, zwei Engines und zwei Schriftgrößen automatisch prüfen.

   Varianten (Engine + Schrift):
     chromium-inter    Android mit geladenem Webfont Inter (Normalfall)
     chromium-roboto   Android mit Roboto als Systemschrift (Webfont noch
                       nicht geladen oder offline; Umbrüche wie auf Android)
     webkit-inter      iPhone Safari mit Inter (SF Pro steht unter Windows
                       nicht zur Verfügung; ohne Netz fiele iOS auf SF zurück)
   Die Schriftdateien liegen in .design-sync/geraetematrix/schriften/ (nicht
   versioniert) und werden bei Bedarf von @fontsource (jsdelivr) geladen;
   Google Fonts selbst wird abgefangen, damit der Lauf ohne Netz gleich bleibt.

   Safe Area: env(safe-area-inset-*) wird beim Ausliefern von styles.css und
   index.html auf CSS-Variablen umgeschrieben, die je Breite und Engine
   gesetzt werden (iPhone mit Notch 47/59 oben, 34 unten; SE 20 oben;
   Android 0 oben, 24 unten für die Gestenleiste).

   Schrift 130 %: jede berechnete Schriftgröße (und Zeilenhöhe in px) wird
   mit 1,3 multipliziert, so wie die Textvergrößerung von Android und iOS
   Safari wirkt. Erst alle Werte lesen, dann schreiben (sonst doppelt über em).

   Prüfungen je Kombination (im Browser, pruefeImBrowser):
     ueberlauf     waagerechtes Scrollen der Seite oder Element ragt über den Rand
     abgeschnitten Text über die Kante eines Elements mit overflow hidden, ohne
                   gewollte Ellipse oder line-clamp
     ueberlappung  Textzeilen und Bedienelemente schneiden sich
     treffer       Trefferfläche unter 44 px (Probe 21 px um die Mitte)
     verdeckt      Inhalt am Scrollende unter Kopfzeile, Bottom-Nav, Fußzeile
                   eines Blatts oder in der Safe Area
     umbruch       Wort, Betrag, Datum oder Uhrzeit über zwei Zeilen

   Aufruf: node .design-sync/shots/geraetematrix.mjs [variante ...]
           GM_PROFIL=admin,trainer  GM_BREITEN=320,390  GM_SCHRIFT=100,130
           GM_ZUSTAENDE=kalender,kasse/pruefen (genaue Schlüssel, Teillauf)
   Ausgabe: .design-sync/geraetematrix/ergebnis-<variante>.json
            .design-sync/geraetematrix/befunde/<variante>/... (Bilder)      */
import fs from 'node:fs';
import path from 'node:path';
import { chromium, webkit } from 'playwright';
import { starte } from './server.mjs';
import { PROFILE, installiere, warteAufApp } from './landkartenmodul.mjs';
import { AUSLOESER, UEBERLAGERUNGEN, zustandImBrowser, schluessel } from './landkartenregeln.mjs';
import { kandidatenImBrowser } from './landkarte.mjs';

const ZIEL = '.design-sync/geraetematrix';
const SCHRIFTEN = path.join(ZIEL, 'schriften');
// Teilläufe: GM_AUSGABE=<unterordner> schreibt Ergebnisse und Bilder dorthin
const AUSGABE = process.env.GM_AUSGABE ? path.join(ZIEL, process.env.GM_AUSGABE) : ZIEL;
const RUHE_MS = 450;

export const GERAETE = [
  // Breite, Höhe (sichtbarer Bereich der installierten App), Beispielgeräte
  { b: 320, h: 568, geraete: 'iPhone SE (1.), kleine Android-Geräte' },
  { b: 360, h: 776, geraete: 'Galaxy A-Reihe, Galaxy S8 bis S10' },
  { b: 375, h: 667, geraete: 'iPhone SE (2./3.), iPhone 6 bis 8' },
  { b: 384, h: 830, geraete: 'Xiaomi Redmi, Nokia' },
  { b: 390, h: 844, geraete: 'iPhone 12 bis 14 (Vorlage)' },
  { b: 393, h: 852, geraete: 'iPhone 15, 16, Xiaomi 13' },
  { b: 412, h: 891, geraete: 'Pixel 7 bis 9, Galaxy S2x' },
  { b: 414, h: 896, geraete: 'iPhone 11, XR, 8 Plus' },
  { b: 430, h: 932, geraete: 'iPhone Pro Max, Plus' },
];
export const SAFE = {
  webkit: (b) => (b === 320 || b === 375 ? { top: 20, bottom: 0 } : b === 393 || b === 430 ? { top: 59, bottom: 34 } : { top: 47, bottom: 34 }),
  chromium: (b) => (b === 320 ? { top: 0, bottom: 0 } : { top: 0, bottom: 24 }),
};
export const VARIANTEN = {
  'chromium-inter':  { engine: 'chromium', familie: 'inter',  titel: 'Chromium', schriftName: 'Inter',
    ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36', dpr: 2.625 },
  'chromium-roboto': { engine: 'chromium', familie: 'roboto', titel: 'Chromium', schriftName: 'Roboto',
    ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36', dpr: 2.625 },
  'webkit-inter':    { engine: 'webkit', familie: 'inter', titel: 'WebKit', schriftName: 'Inter',
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1', dpr: 3 },
};
/* Statische Schnitte je Strichstärke (@fontsource, latin): WebKit unter
   Windows zeichnet eine variable TTF nur in einer Stärke. */
export const GEWICHTE = [400, 500, 600, 700, 800, 900];
const QUELLE = (fam, w) => 'https://cdn.jsdelivr.net/npm/@fontsource/' + fam + '/files/' + fam + '-latin-' + w + '-normal.woff2';

export async function schriftDateien(fam) {
  const dateien = {};
  for (const w of GEWICHTE) {
    const datei = path.join(SCHRIFTEN, fam + '-' + w + '.woff2');
    if (!fs.existsSync(datei)) {
      fs.mkdirSync(SCHRIFTEN, { recursive: true });
      const r = await fetch(QUELLE(fam, w));
      if (!r.ok) throw new Error('Schrift nicht ladbar: ' + fam + ' ' + w);
      fs.writeFileSync(datei, Buffer.from(await r.arrayBuffer()));
    }
    dateien[w] = fs.readFileSync(datei);
  }
  return dateien;
}

export const SA = (s) => s.replace(/env\(\s*safe-area-inset-(top|bottom|left|right)\s*(,[^)]*)?\)/g, 'var(--gm-sa-$1, 0px)');

/* ---------------- Ausnahmen ----------------
   Bewusst begrenzte Tippzonen und akzeptierte Fälle aus
   .design-sync/geraetematrix/ABSCHLUSS.md (Nachtrag Nacharbeit, C und E).
   Eine Ausnahme greift nur am passenden Element (el.matches(sel)) und nur
   in der genannten Richtung:
     treffer       alle zu kleinen Richtungen stehen in richtung
     abgeschnitten richtung 'Eingabefeld' (Text rollt im nativen Feld)
     ueberlappung  der Partner passt auf partner
   Ausnahmen werden getrennt gezählt (ergebnis-*.json: profile[].ausnahmen),
   nicht als Befund.                                                        */
export const AUSNAHMEN = [
  { id: 'zone-rueckmeldung', typ: 'treffer', sel: '.tk-unten-l', richtung: ['oben'],
    grund: 'Zone oben auf 5 px begrenzt (halbe Lücke zu Zusage/Absage, 10 px); 144 × 35 px.' },
  { id: 'zone-elf', typ: 'treffer', sel: 'button.tk-unten-r', richtung: ['oben'],
    grund: 'Wie „9 zu · 2 ab ›“: gleiche Zeile unter Absage, oben 5 px.' },
  { id: 'zone-alle-bestaetigen', typ: 'treffer', sel: '.ks-stapelkopf .link-btn', richtung: ['unten'],
    grund: 'Zone unten auf 6 px begrenzt (halbe Lücke zur Prüfkarte, seit Nachschliff A3 12 px); 124 × 37,5 px.' },
  { id: 'zone-spieler-waehlen', typ: 'treffer', sel: '.tv-bank-kopf .link-btn', richtung: ['unten'],
    grund: 'Zone unten auf 6 px begrenzt (halbe Lücke zum ersten Bankplatz, 12 px); 133 × 37,5 px.' },
  { id: 'zone-bank-x', typ: 'treffer', sel: '.tv-bx', richtung: ['rechts', 'oben'],
    grund: 'Rechts 6,5 px (halbe Lücke zum Nachbarplatz, 13 px), oben 8,5 px (halbe Lücke zu „Spieler wählen ›“, 17 px); 37,5 × 39,5 px, über 32 px.' },
  { id: 'zone-danach', typ: 'treffer', sel: '.group-head:has(+ .dn-liste) .link-btn', richtung: ['unten'],
    grund: '„Kalender ›“ über der ersten Danach-Zeile: unten 4,5 px (halbe Lücke, 9 px); 91 × 36 px. Sechste begrenzte Zone aus Abschnitt C.' },
  { id: 'feld-ort', typ: 'abgeschnitten', sel: '.tf-z > input.tf-in', richtung: ['Eingabefeld'],
    grund: 'Langer Wert rollt im nativen Eingabefeld (Termin-Blatt); bewusst nicht angefasst.' },
  { id: 'feld-push-titel', typ: 'abgeschnitten', sel: '.pkat-feld > input.pkat-in', richtung: ['Eingabefeld'],
    grund: 'Langer Push-Titel rollt im nativen Eingabefeld; bewusst nicht angefasst.' },
  { id: 'feld-katalogname', typ: 'abgeschnitten', sel: '.kat-item.kat-edit > input.kat-in-name', richtung: ['Eingabefeld'],
    grund: 'Langer Katalogname rollt im nativen Eingabefeld (320 px, 130 %); bewusst nicht angefasst.' },
  { id: 'feld-status-datum', typ: 'abgeschnitten', sel: '.sb-feld.sb-datum > input', richtung: ['Eingabefeld'],
    grund: 'Natives Datumsfeld im Status-Blatt (WebKit, 320 px, 130 %); bewusst nicht angefasst.' },
  { id: 'teilen-x-unterzeile', typ: 'ueberlappung', sel: '.modal > p.modal-sub', partner: '.modal-head > .modal-x',
    grund: 'Zone des × im Teilen-Fenster reicht über die Unterzeile; sie hat keine Funktion.' },
];

/* ---------------- im Browser ---------------- */

/* Schrift 130 %: an = true setzt, an = false stellt zurück. */
export function skaliereImBrowser({ an, faktor }) {
  const els = [document.documentElement, ...document.querySelectorAll('body, body *')];
  if (!an) {
    for (const e of els) if (e.hasAttribute('data-gm-fs')) {
      const alt = e.getAttribute('data-gm-fs');
      if (alt) e.setAttribute('style', alt); else e.removeAttribute('style');
      e.removeAttribute('data-gm-fs');
    }
    return 0;
  }
  const werte = els.map((e) => { const cs = getComputedStyle(e); return [e, parseFloat(cs.fontSize), cs.lineHeight]; });
  for (const [e, fs, lh] of werte) {
    if (!fs) continue;
    e.setAttribute('data-gm-fs', e.getAttribute('style') || '');
    e.style.setProperty('font-size', (fs * faktor) + 'px', 'important');
    if (/px$/.test(lh)) e.style.setProperty('line-height', (parseFloat(lh) * faktor) + 'px', 'important');
  }
  return werte.length;
}

function pruefeImBrowser({ oben, sa, ausloeserSel, ausnahmen }) {
  const passt = (el, sel) => { try { return !!el && el.nodeType === 1 && el.matches(sel); } catch (e) { return false; } };
  const ausnahme = (typ, el, info) => {
    for (const a of ausnahmen || []) {
      if (a.typ !== typ) continue;
      if (typ === 'ueberlappung') {
        if ((passt(el, a.sel) && passt(info.partner, a.partner)) || (passt(info.partner, a.sel) && passt(el, a.partner))) return a.id;
      } else if (passt(el, a.sel) && info.richtung.every((x) => a.richtung.includes(x))) return a.id;
    }
    return null;
  };
  const W = document.documentElement.clientWidth, H = window.innerHeight;
  const befunde = [];
  const root = oben.length ? document.getElementById(oben[oben.length - 1]) : document.body;
  const sig = (el) => {
    if (!el || el.nodeType !== 1) return '?';
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    const k = [...el.classList].filter((c) => !/^is-|^gm-/.test(c)).slice(0, 2);
    if (k.length) s += '.' + k.join('.');
    return s;
  };
  const pfad = (el) => { const t = []; for (let e = el, i = 0; e && e !== document.body && i < 3; i++, e = e.parentElement) t.unshift(sig(e)); return t.join(' > '); };
  const kurz = (s) => (s || '').replace(/\s+/g, ' ').trim().slice(0, 50);
  const txt = (el) => kurz(el.getAttribute && (el.getAttribute('aria-label') || '') || el.innerText || el.value || '');
  const csCache = new Map();
  const cs = (e) => { let c = csCache.get(e); if (!c) { c = getComputedStyle(e); csCache.set(e, c); } return c; };
  const sichtbar = (el, opazitaetEgal) => {
    if (!el.getClientRects().length) return false;
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      const c = cs(e);
      if (e.hidden || c.display === 'none' || c.visibility === 'hidden') return false;
      if (!opazitaetEgal && parseFloat(c.opacity) === 0) return false;
    }
    return true;
  };
  const markiere = (el) => { if (el && el.setAttribute) el.setAttribute('data-gm-mark', '1'); };
  const schnitt = (a, b) => ({ l: Math.max(a.left, b.left), t: Math.max(a.top, b.top), r: Math.min(a.right, b.right), b: Math.min(a.bottom, b.bottom) });
  const flaeche = (s) => Math.max(0, s.r - s.l) * Math.max(0, s.b - s.t);
  const VIEW = { left: 0, top: 0, right: W, bottom: H };

  // Sichtbarer Ausschnitt eines Elements: Schnitt aller clippenden Vorfahren.
  const clipInfo = (el, selbst) => {
    let box = { ...VIEW }, scroll = false, scrollX = false;
    for (let e = selbst ? el : el.parentElement; e && e !== document.documentElement; e = e.parentElement) {
      const c = cs(e);
      if (c.position === 'fixed') { /* ab hier gilt der Viewport */ }
      const ox = c.overflowX, oy = c.overflowY;
      if (ox !== 'visible' || oy !== 'visible') {
        const r = e.getBoundingClientRect();
        if (ox !== 'visible') { box.left = Math.max(box.left, r.left); box.right = Math.min(box.right, r.right); }
        if (oy !== 'visible') { box.top = Math.max(box.top, r.top); box.bottom = Math.min(box.bottom, r.bottom); }
        if (/auto|scroll/.test(oy)) scroll = true;
        if (/auto|scroll/.test(ox)) scrollX = true;
      }
      if (c.position === 'fixed') break;
    }
    return { box: { left: box.left, top: box.top, right: box.right, bottom: box.bottom }, scroll, scrollX };
  };

  // Deckflächen: fest stehende oder klebende Elemente im obersten Bereich.
  const deckflaechen = () => {
    const liste = [];
    const kandidaten = oben.length ? root.querySelectorAll('*') : document.body.querySelectorAll('*');
    for (const e of kandidaten) {
      const p = cs(e).position;
      if (p !== 'fixed' && p !== 'sticky') continue;
      if (e === root || e.contains(root)) continue;
      if (!sichtbar(e)) continue;
      const r = e.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      // Vollflächige Ebenen (Overlays ohne eigene Fläche) sind keine Deckfläche.
      if (r.height > H * 0.6) continue;
      const bg = cs(e).backgroundColor;
      liste.push({ el: e, r, oben: (r.top + r.bottom) / 2 < H / 2, transparent: /rgba\(.*,\s*0\)$|transparent/.test(bg) && !e.children.length });
    }
    if (sa.top) liste.push({ el: null, name: 'Safe Area oben', r: { left: 0, right: W, top: 0, bottom: sa.top }, oben: true });
    if (sa.bottom) liste.push({ el: null, name: 'Safe Area unten', r: { left: 0, right: W, top: H - sa.bottom, bottom: H }, oben: false });
    return liste;
  };

  const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'OPTION', 'SELECT', 'TEXTAREA', 'svg', 'SVG']);
  // Textzeilen und Bedienelemente im obersten Bereich sammeln.
  const sammle = () => {
    const texte = [], ctl = [];
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = tw.nextNode(); n; n = tw.nextNode()) {
      if (!n.data.trim()) continue;
      const el = n.parentElement;
      if (!el || SKIP.has(el.tagName) || el.closest('svg')) continue;
      if (!sichtbar(el)) continue;
      const rg = document.createRange(); rg.selectNodeContents(n);
      const rects = [...rg.getClientRects()].filter((r) => r.width > 0.5 && r.height > 0.5);
      if (!rects.length) continue;
      const ci = clipInfo(el, true);
      texte.push({ n, el, rects, ci });
    }
    const sel = 'button, a[href], input:not([type=hidden]), select, textarea, [role=button], [role=switch], [role=tab], summary, ' + ausloeserSel;
    for (const el of root.querySelectorAll(sel)) {
      if (!sichtbar(el, el.tagName === 'INPUT' || el.tagName === 'SELECT')) continue;
      if (el.closest('[inert]')) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      // Vollflaechige Ebenen (Abdunkelung hinter Blaettern) sind keine Bedienelemente im Sinne der Pruefung.
      if (r.width * r.height > W * H * 0.5) continue;
      ctl.push({ el, r, ci: clipInfo(el) });
    }
    return { texte, ctl };
  };

  const deck = deckflaechen();
  const unterDeck = (r, el) => deck.find((d) => d.el && d.el !== el && !d.el.contains(el) && !(el.contains && el.contains(d.el)) && flaeche(schnitt(r, d.r)) > 4);
  const { texte, ctl } = sammle();

  // 1. Waagerechter Überlauf
  const se = document.scrollingElement;
  if (se.scrollWidth > W + 1) {
    befunde.push({ typ: 'ueberlauf', el: 'Seite', text: 'scrollWidth ' + se.scrollWidth + ' > ' + W });
  }
  const ragt = new Set();
  for (const el of document.body.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || (r.right <= W + 1 && r.left >= -1)) continue;
    if (!sichtbar(el)) continue;
    const ci = clipInfo(el);
    if (ci.scrollX) continue;                      // in einer gewollt seitlich scrollenden Reihe
    if (ci.box.right < r.right - 1 && ci.box.right <= W + 1 && ci.box.left >= -1 && (r.left >= ci.box.left - 1)) continue; // vom Vorfahren gekappt: zählt als abgeschnitten
    if (el.parentElement && ragt.has(el.parentElement)) { ragt.add(el); continue; }
    const pr = el.parentElement && el.parentElement.getBoundingClientRect();
    ragt.add(el);
    if (pr && (pr.right > W + 1 || pr.left < -1)) continue;
    if (cs(el).position === 'fixed' && (r.left >= W || r.right <= 0)) continue; // ausgeblendet neben dem Bild
    befunde.push({ typ: 'ueberlauf', el: pfad(el), text: txt(el), detail: Math.round(r.left) + '..' + Math.round(r.right) });
    markiere(el);
  }

  // 2. Abgeschnittener Text
  const gewollt = (el, bis) => {
    for (let e = el; e; e = e.parentElement) {
      const c = cs(e);
      if (c.textOverflow === 'ellipsis' || (c.webkitLineClamp && c.webkitLineClamp !== 'none')) return true;
      if (e === bis) break;
    }
    return false;
  };
  for (const t of texte) {
    // Clippende Vorfahren (hidden/clip), die nicht scrollen
    for (let e = t.el; e && e !== document.documentElement; e = e.parentElement) {
      const c = cs(e);
      const hx = /hidden|clip/.test(c.overflowX), hy = /hidden|clip/.test(c.overflowY);
      if (hx || hy) {
        const b = e.getBoundingClientRect();
        const ueber = t.rects.some((r) => (hx && (r.right > b.right + 1 || r.left < b.left - 1)) || (hy && (r.bottom > b.bottom + 1 || r.top < b.top - 1)));
        if (ueber && !gewollt(t.el, e) && sichtbar(e)) {
          befunde.push({ typ: 'abgeschnitten', el: pfad(t.el), text: kurz(t.n.data), detail: 'an ' + sig(e) });
          markiere(t.el);
        }
        break;
      }
      if (/auto|scroll/.test(c.overflowX) || /auto|scroll/.test(c.overflowY)) break;
      if (c.position === 'fixed') break;
    }
  }
  for (const c of ctl) {
    if (c.el.tagName !== 'INPUT' || !/^(text|email|search|tel|url|number|password)?$/.test(c.el.type || '')) continue;
    if (c.el.scrollWidth > c.el.clientWidth + 1 && c.el.value && document.activeElement !== c.el) {
      befunde.push({ typ: 'abgeschnitten', el: pfad(c.el), text: kurz(c.el.value), detail: 'Eingabefeld', ausnahme: ausnahme('abgeschnitten', c.el, { richtung: ['Eingabefeld'] }) });
      markiere(c.el);
    }
  }

  // 3. Umbruch in Wort, Betrag, Datum, Uhrzeit
  const MON = '(?:Jan|Feb|Mär|Apr|Mai|Jun|Jul|Aug|Sep|Okt|Nov|Dez)[a-zä]*\\.?';
  const MUSTER = [
    ['Betrag', new RegExp('\\d[\\d.]*(?:,\\d{2})?[\\s\\u00a0\\u202f]?€', 'g')],
    ['Datum', new RegExp('\\b\\d{1,2}\\.[\\s\\u00a0\\u202f]?' + MON + '(?:[\\s\\u00a0\\u202f]\\d{4})?', 'g')],
    ['Datum', /\b\d{1,2}\.\d{1,2}\.(?:\d{2,4})?/g],
    ['Uhrzeit', /\b\d{1,2}:\d{2}(?:[\s  ]?Uhr)?/g],
    ['Wort', /[^\s  \-‐‑\/·|,.;:()]+/g],
  ];
  for (const t of texte) {
    if (t.rects.length < 2) continue;                // eine Zeile: kein Umbruch möglich
    const tops = new Set(t.rects.map((r) => Math.round(r.top)));
    if (tops.size < 2) continue;
    const d = t.n.data;
    const gemeldet = [];
    for (const [art, re] of MUSTER) {
      re.lastIndex = 0;
      for (let m = re.exec(d); m; m = re.exec(d)) {
        if (m[0].length < 2) continue;
        if (gemeldet.some(([a, b]) => m.index >= a && m.index + m[0].length <= b)) continue;
        const rg = document.createRange();
        rg.setStart(t.n, m.index); rg.setEnd(t.n, m.index + m[0].length);
        const zeilen = new Set([...rg.getClientRects()].filter((r) => r.width > 0.5).map((r) => Math.round(r.top / 4)));
        if (zeilen.size > 1) {
          gemeldet.push([m.index, m.index + m[0].length]);
          befunde.push({ typ: 'umbruch', el: pfad(t.el), text: m[0], detail: art });
          markiere(t.el);
        }
      }
    }
  }

  // 4. Überlappung von Textzeilen und Bedienelementen
  const items = [];
  for (const t of texte) for (const r of t.rects) {
    const s = schnitt(r, t.ci.box);
    if (flaeche(s) < 2) continue;
    if (unterDeck(r, t.el)) continue;
    items.push({ el: t.el, r: { left: s.l, top: s.t, right: s.r, bottom: s.b }, art: 'text', label: kurz(t.n.data) });
  }
  for (const c of ctl) {
    if (parseFloat(cs(c.el).opacity) === 0) continue;
    const s = schnitt(c.r, c.ci.box);
    if (flaeche(s) < 2) continue;
    if (unterDeck(c.r, c.el)) continue;
    items.push({ el: c.el, r: { left: s.l, top: s.t, right: s.r, bottom: s.b }, art: 'ctl', label: txt(c.el) });
  }
  const paare = new Set();
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    const a = items[i], b = items[j];
    if (a.el === b.el || a.el.contains(b.el) || b.el.contains(a.el)) continue;
    const s = schnitt(a.r, b.r);
    const w = s.r - s.l, h = s.b - s.t;
    if (w < 3 || h < 3) continue;
    // Text und Element, in dem der Text liegt (z. B. Beschriftung in einer Kachel mit Knopf darüber)
    if (a.art === 'ctl' && b.art === 'ctl' && (a.el.closest('label') && a.el.closest('label') === b.el.closest('label'))) continue;
    const k = pfad(a.el) + ' | ' + pfad(b.el);
    if (paare.has(k)) continue;
    paare.add(k);
    befunde.push({ typ: 'ueberlappung', el: pfad(a.el), text: a.label + ' / ' + b.label, detail: pfad(b.el) + ' (' + Math.round(w) + '×' + Math.round(h) + ')', ausnahme: ausnahme('ueberlappung', a.el, { partner: b.el }) });
    markiere(a.el); markiere(b.el);
  }

  // 5. Trefferflächen
  for (const c of ctl) {
    const el = c.el;
    if (el.disabled) continue;
    const r = c.r, b = c.ci.box;
    if (r.top < b.top - 0.5 || r.bottom > b.bottom + 0.5 || r.left < b.left - 0.5 || r.right > b.right + 0.5) continue;
    if (unterDeck(r, el)) continue;
    // Verweis im Fließtext ist ausgenommen (WCAG 2.5.8 „inline“)
    if (el.tagName === 'A' && cs(el).display === 'inline' && el.parentElement && el.parentElement.textContent.trim().length > el.textContent.trim().length + 10) continue;
    const cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2;
    /* Prüfpunkt auf einer fremden fixen oder klebenden Fläche (Nav, Kopf, Blattfuß):
       das liegt an der Scrollposition, nicht am Element - zählt nicht. Fixe Ebenen,
       die das Element selbst enthalten (Blatt, Fenster), zählen weiter. */
    const fremdeLeiste = (t, el) => { for (let e = t; e && e.nodeType === 1; e = e.parentElement) { const p = cs(e).position; if ((p === 'fixed' || p === 'sticky') && !e.contains(el)) return true; } return false; };
    const gehoert = (t) => t && (t === el || el.contains(t) || (el.labels && [...el.labels].some((l) => l.contains(t))) || (t.closest('label') && t.closest('label').contains(el)));
    const fehlt = [];
    for (const [dx, dy, n] of [[-21.5, 0, 'links'], [21.5, 0, 'rechts'], [0, -21.5, 'oben'], [0, 21.5, 'unten']]) {
      const x = cx + dx, y = cy + dy;
      if (x < 0 || x >= W || y < 0 || y >= H) continue;
      const t = document.elementFromPoint(x, y);
      if (!gehoert(t) && !fremdeLeiste(t, el)) fehlt.push(n);
    }
    if (fehlt.length) {
      befunde.push({ typ: 'treffer', el: pfad(el), text: txt(el), detail: Math.round(r.width) + '×' + Math.round(r.height) + ', zu klein ' + fehlt.join('/'), ausnahme: ausnahme('treffer', el, { richtung: fehlt }) });
      markiere(el);
    }
  }

  // 6. Verdeckt am Scrollende (Kopfzeile, Bottom-Nav, Fußzeile, Safe Area)
  const scroller = [document.scrollingElement];
  for (const e of root.querySelectorAll('*')) {
    const c = cs(e);
    if (/auto|scroll/.test(c.overflowY) && e.scrollHeight > e.clientHeight + 1 && sichtbar(e)) scroller.push(e);
  }
  if (oben.length) scroller.shift();
  const verdecktGemeldet = new Set();
  for (const sc of scroller) {
    const alt = sc.scrollTop;
    const max = sc.scrollHeight - sc.clientHeight;
    for (const pos of max > 1 ? ['oben', 'unten'] : ['beide']) {
      sc.scrollTop = pos === 'unten' ? max : 0;
      csCache.clear();
      const d2 = deckflaechen();
      const { texte: t2, ctl: c2 } = sammle();
      const kandidaten = [
        ...t2.map((t) => ({ el: t.el, rs: t.rects, ci: t.ci, label: kurz(t.n.data) })),
        ...c2.map((c) => ({ el: c.el, rs: [c.r], ci: c.ci, label: txt(c.el) })),
      ];
      for (const k of kandidaten) {
        if (sc !== document.scrollingElement && !sc.contains(k.el)) continue;
        if (sc === document.scrollingElement && k.ci.scroll) continue;   // liegt in eigenem Scroller
        for (const r of k.rs) {
          const s0 = schnitt(r, k.ci.box);
          if (flaeche(s0) < 2) continue;
          const vis = { left: s0.l, top: s0.t, right: s0.r, bottom: s0.b };
          for (const d of d2) {
            if (d.el && (d.el === k.el || d.el.contains(k.el) || k.el.contains(d.el))) continue;
            if (!d.el) {
              // Safe Area: gilt auch für den Inhalt fester Leisten
            } else if (d.transparent) continue;
            const zaehlt = pos === 'beide' || (pos === 'oben' && d.oben) || (pos === 'unten' && !d.oben);
            if (!zaehlt) continue;
            const s = schnitt(vis, d.r);
            if (s.r - s.l <= 2 || s.b - s.t <= 2) continue;
            const key = pfad(k.el) + '|' + (d.el ? pfad(d.el) : d.name);
            if (verdecktGemeldet.has(key)) continue;
            verdecktGemeldet.add(key);
            befunde.push({ typ: 'verdeckt', el: pfad(k.el), text: k.label, detail: 'unter ' + (d.el ? sig(d.el) : d.name) + (pos === 'unten' ? ' (Scrollende)' : ''), pos });
            markiere(k.el);
          }
        }
      }
    }
    sc.scrollTop = alt;
  }
  // Safe Area auch für feste Leisten selbst (Kopfzeile, Nav), unabhängig vom Scrollen
  csCache.clear();
  return befunde;
}

/* ---------------- Lauf ---------------- */

async function laufeProfil({ browser, basis, variante, profil, knoten, breiten, schriften, schriftBytes, mitBildern, log }) {
  const v = VARIANTEN[variante];
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: v.dpr, isMobile: v.engine === 'chromium' ? true : undefined, hasTouch: true,
    userAgent: v.ua, locale: 'de-DE', timezoneId: 'Europe/Berlin', serviceWorkers: 'block',
  });
  const page = await ctx.newPage();
  const lauf = await installiere(page, profil);
  page.on('dialog', (d) => d.dismiss().catch(() => {}));
  // Webfont lokal statt Google Fonts
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => {
    const u = route.request().url();
    const m = u.match(/\/gm\/(\d+)\.woff2/);
    if (m) return route.fulfill({ status: 200, contentType: 'font/woff2', body: schriftBytes[m[1]] });
    return route.fulfill({ status: 200, contentType: 'text/css',
      body: GEWICHTE.map((w) => "@font-face{font-family:'Inter';font-style:normal;font-weight:" + w
        + ";font-display:block;src:url(https://fonts.gstatic.com/gm/" + w + ".woff2) format('woff2');}").join('') });
  });
  // Safe Area als Variablen
  await page.route(/\/(styles\.css|index\.html)(\?|$)|\/$/, async (route) => {
    // Netz- oder Serveraussetzer: einmal wiederholen, sonst unverändert durchreichen
    for (let versuch = 0; versuch < 3; versuch++) {
      try {
        const r = await route.fetch();
        const ct = r.headers()['content-type'] || '';
        if (!/css|html/.test(ct)) return await route.fulfill({ response: r });
        return await route.fulfill({ response: r, body: SA(await r.text()) });
      } catch (e) { await new Promise((ok) => setTimeout(ok, 300)); }
    }
    return route.continue().catch(() => {});
  });
  const ergebnisse = [], ausnahmen = [], nichtErreicht = [];
  let neuGeladen = 0;
  const lese = () => page.evaluate(zustandImBrowser, UEBERLAGERUNGEN);
  const ausloeserSel = AUSLOESER.map((a) => a.sel).join(', ');

  async function start() {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(basis, { waitUntil: 'load' });
    await warteAufApp(page);
    await page.evaluate(async () => { await document.fonts.ready; });
    // Übergänge aus: sonst animiert die Schriftvergrößerung und die Messung
    // trifft einen Zwischenstand (riesige Schrift nach dem Zurückstellen).
    await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; animation-duration: 0s !important; animation-delay: 0s !important; }' });
  }
  async function klick(schritt) {
    const z = await lese();
    const treffer = await page.evaluate(kandidatenImBrowser, {
      ausloeser: AUSLOESER, ueberlagerungen: UEBERLAGERUNGEN, oben: z.oben,
      istStart: schritt.global === true, nurArt: schritt.art, nurWert: schritt.wert,
    });
    if (!treffer.length) return false;
    const vorher = (AUSLOESER.find((a) => a.art === schritt.art) || {}).vorher;
    await page.evaluate(async (vorher) => {
      const el = document.querySelector('[data-landkarte-ziel]');
      el.removeAttribute('data-landkarte-ziel');
      if (vorher) {
        const vv = [...document.querySelectorAll(vorher)].find((x) => x.getClientRects().length);
        if (vv) { vv.click(); await new Promise((r) => setTimeout(r, 200)); }
      }
      el.click();
    }, vorher || null);
    await page.waitForTimeout(RUHE_MS);
    return true;
  }
  const ruhe = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 60)))));

  /* Rest der Schriftvergrößerung (Inline-Schriftgröße mit !important, die
     beim Zurückstellen nicht erfasst wurde, z. B. weil die App den Teilbaum
     neu gezeichnet hat) - dann wird der Zustand frisch geladen. */
  const rest = () => page.evaluate(() => [...document.querySelectorAll('[style*="font-size"]')]
    .some((e) => e.style.getPropertyPriority('font-size') === 'important'));
  async function erreiche(n) {
    let ok = false;
    for (let versuch = 0; versuch < 2 && !ok; versuch++) {
      try {
        await start();
        ok = true;
        for (const s of n.pfad) if (!(await klick(s))) { ok = false; break; }
        if (ok) { const k = schluessel(await lese()); if (k !== n.schluessel) ok = false; }
      } catch (e) { ok = false; }
    }
    return ok;
  }

  for (const n of knoten) {
    const ok = await erreiche(n);
    if (!ok) { nichtErreicht.push(n.schluessel); log(`  [${profil}] nicht erreicht: ${n.schluessel}`); continue; }
    const z = await lese();
    for (const g of breiten) {
      const sa = SAFE[v.engine](g.b);
      for (const gr of schriften) {
        try {
          await page.evaluate((sa) => { const s = document.documentElement.style; s.setProperty('--gm-sa-top', sa.top + 'px'); s.setProperty('--gm-sa-bottom', sa.bottom + 'px'); }, sa);
          await page.setViewportSize({ width: g.b, height: g.h });
          await page.evaluate(() => window.dispatchEvent(new Event('resize')));
          await ruhe();
          if (gr !== 100) { await page.evaluate(skaliereImBrowser, { an: true, faktor: gr / 100 }); await ruhe(); }
          const alleBefunde = await page.evaluate(pruefeImBrowser, { oben: z.oben, sa, ausloeserSel, ausnahmen: AUSNAHMEN });
          const befunde = alleBefunde.filter((b) => !b.ausnahme);
          for (const b of alleBefunde.filter((x) => x.ausnahme)) ausnahmen.push({ ...b, profil, schluessel: n.schluessel, breite: g.b, schrift: gr });
          let bild = null;
          if (befunde.length && mitBildern) {
            const dir = path.join(AUSGABE, 'befunde', variante, profil);
            fs.mkdirSync(dir, { recursive: true });
            bild = path.join(dir, `${n.schluessel.replace(/[^a-zA-Z0-9_.-]/g, '_')}-${g.b}-${gr}.png`);
            await page.addStyleTag({ content: '[data-gm-mark]{outline:2px solid #e000e0 !important;outline-offset:-1px !important}' }).catch(() => {});
            await page.screenshot({ path: bild }).catch(() => { bild = null; });
          }
          await page.evaluate(() => { document.querySelectorAll('[data-gm-mark]').forEach((e) => e.removeAttribute('data-gm-mark')); });
          if (gr !== 100) {
            await page.evaluate(skaliereImBrowser, { an: false });
            if (await rest()) { neuGeladen++; await erreiche(n); }
          }
          for (const { ausnahme: _a, ...b } of befunde) ergebnisse.push({ ...b, profil, schluessel: n.schluessel, name: n.name, breite: g.b, schrift: gr, bild: bild && bild.replace(/\\/g, '/') });
        } catch (e) {
          ergebnisse.push({ typ: 'fehler', el: '-', text: String(e.message).slice(0, 120), profil, schluessel: n.schluessel, name: n.name, breite: g.b, schrift: gr });
        }
      }
    }
  }
  const bericht = await lauf.bericht();
  await ctx.close();
  return { profil, ergebnisse, ausnahmen, nichtErreicht, neuGeladen, verstoesse: bericht.verstoesse, fehler: bericht.fehler };
}

export async function laufeVariante(variante, opts = {}) {
  const v = VARIANTEN[variante];
  if (!v) throw new Error('Unbekannte Variante: ' + variante);
  const lk = JSON.parse(fs.readFileSync('.design-sync/landkarte/landkarte.json', 'utf8'));
  const profile = (opts.profile || Object.keys(lk.profile)).filter((p) => lk.profile[p]);
  const breiten = GERAETE.filter((g) => !opts.breiten || opts.breiten.includes(g.b));
  const schriften = opts.schriften || [100, 130];
  const schriftBytes = await schriftDateien(v.familie);
  const t0 = Date.now();
  const { server, basis } = await starte(process.cwd());
  const browser = v.engine === 'webkit' ? await webkit.launch() : await chromium.launch({ channel: 'chrome' });
  if (opts.mitBildern !== false) fs.rmSync(path.join(AUSGABE, 'befunde', variante), { recursive: true, force: true });
  const log = opts.log || ((s) => console.log(s));
  const parallel = opts.parallel || 3;
  const warteschlange = [...profile];
  const res = [];
  await Promise.all(Array.from({ length: Math.min(parallel, profile.length) }, async () => {
    while (warteschlange.length) {
      const p = warteschlange.shift();
      const knoten = lk.profile[p].knoten.filter((n) => n.ansicht !== 'dialog' && (!opts.nur || opts.nur.some((x) => n.schluessel.includes(x))) && (!opts.genau || opts.genau.includes(n.schluessel)));
      const t = Date.now();
      res.push(await laufeProfil({ browser, basis, variante, profil: p, knoten, breiten, schriften, schriftBytes, mitBildern: opts.mitBildern !== false, log }));
      log(`  ${variante} ${p}: ${knoten.length} Zustände, ${Math.round((Date.now() - t) / 1000)} s`);
    }
  }));
  await browser.close();
  server.close();
  const json = { variante, engine: v.titel, schrift: v.schriftName, breiten: breiten.map((g) => g.b), schriften,
    sekunden: Math.round((Date.now() - t0) / 1000), profile: res.sort((a, b) => a.profil.localeCompare(b.profil)) };
  return json;
}

import { pathToFileURL } from 'node:url';
const istHaupt = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (istHaupt) {
  const varianten = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(VARIANTEN);
  const opts = {
    profile: process.env.GM_PROFIL ? process.env.GM_PROFIL.split(',') : undefined,
    breiten: process.env.GM_BREITEN ? process.env.GM_BREITEN.split(',').map(Number) : undefined,
    schriften: process.env.GM_SCHRIFT ? process.env.GM_SCHRIFT.split(',').map(Number) : undefined,
    nur: process.env.GM_NUR ? process.env.GM_NUR.split(',') : undefined,
    genau: process.env.GM_ZUSTAENDE ? process.env.GM_ZUSTAENDE.split(',') : undefined,
    parallel: Number(process.env.GM_PARALLEL || 3),
  };
  fs.mkdirSync(AUSGABE, { recursive: true });
  for (const v of varianten) {
    const json = await laufeVariante(v, opts);
    const datei = path.join(AUSGABE, `ergebnis-${v}.json`);
    fs.writeFileSync(datei, JSON.stringify(json, null, 1) + '\n');
    const alle = json.profile.flatMap((p) => p.ergebnisse);
    const nach = {};
    for (const e of alle) nach[e.typ] = (nach[e.typ] || 0) + 1;
    const ausn = {};
    for (const a of json.profile.flatMap((p) => p.ausnahmen || [])) ausn[a.ausnahme] = (ausn[a.ausnahme] || 0) + 1;
    console.log(`${v}: ${alle.length} Einzelbefunde ${JSON.stringify(nach)}, Ausnahmen ${Object.values(ausn).reduce((x, y) => x + y, 0)} ${JSON.stringify(ausn)}, nicht erreicht ${json.profile.reduce((s, p) => s + p.nichtErreicht.length, 0)}, `
      + `Verstöße ${json.profile.reduce((s, p) => s + p.verstoesse.length, 0)}, ${json.sekunden} s -> ${datei}`);
  }
}
