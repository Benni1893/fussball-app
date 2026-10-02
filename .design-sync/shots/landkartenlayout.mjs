/* App-Landkarte, Schritt L3/L3b: Layout aus landkarte.json.

   Liest .design-sync/landkarte/landkarte.json (Ergebnis von landkarte.mjs)
   und baut daraus eine Seite ohne externe Abhaengigkeiten.

   Ansichten (im URL gemerkt, direkt verlinkbar)
     (ohne)                         Gesamtkarte: eine Spalte je Rolle, eine
                                    Zeile je Ebene (Tiefe im Klickpfad)
     ?rolle=<profil>                eine Rolle
     ?rolle=<profil>&strang=<s>     ein Strang: alle Zustaende einer Ansicht
                                    (Sheets und Unterseiten gehoeren zur Ansicht
                                    darunter, das Mehr-Menue ist der Strang
                                    "mehr"), Zugaenge und Ausgaenge als Stummel
     ?rolle=<profil>&weg=<knoten>   Weg vom Start bis zum Knoten plus alles,
                                    was von dort tiefer weitergeht
     &druck=1                       ohne Zoom, fuer die PNGs
   Bedienung: Mausrad/Zwei-Finger-Geste zoomt, Ziehen verschiebt, Pinch am
   Handy; Knoepfe -, +, Alles zeigen. Weit herausgezoomt Kurzlabels, Pfeile
   ohne Beschriftung. Ueberfahren hebt die Kanten einer Karte hervor, Klick
   vergroessert das Bild (Klickpfad, Ausgaenge, Eingaenge, Weg, Strang).

   Ausgabe
     .design-sync/landkarte/landkarte.html                      versioniert,
         Bilder relativ verlinkt (bilder/<profil>/*.png)
     .design-sync/landkarte/bilder/rollen/<profil>.png          nicht versioniert,
         eine Spalte je Bild
     .design-sync/landkarte/bilder/rollen/strang-trainer-kalender.png
         Kontrollbild der Strang-Ansicht, nicht versioniert
     .design-sync/landkarte/bilder/landkarte-komplett.html      nicht versioniert,
         eigenstaendig: alle Bilder als JPEG eingebettet (Vorschau 300 px,
         gross 480 px), muss unter 15 MB bleiben

   Braucht die Bilder aus einem Lauf von landkarte.mjs. Kein Request nach
   aussen: die Seite hat keine externen Abhaengigkeiten, der Server ist lokal.

   Rot (Rueckgabewert 1): Bild fehlt, Seitenfehler, Kante ohne Knoten,
   Strang-Ansicht mit falscher Kartenzahl, Bedienung ohne Wirkung,
   eigenstaendige Fassung 15 MB oder groesser.

   Kartentitel, Kurzlabels und Straenge kommen aus landkarte.json (name,
   strang; Regeln in landkartenregeln.mjs). Beide Seiten tragen den
   Fingerabdruck von landkarte.json als <meta name="landkarte-json">.

   Aufruf: node .design-sync/shots/landkartenlayout.mjs
   Als Modul: seite(), jsonSha(), pruefeDaten() fuer landkartendrift.mjs. */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
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

/* Fingerabdruck von landkarte.json, Zeilenenden egal (Git wandelt sie unter
   Windows). Steht als <meta name="landkarte-json"> in beiden Seiten;
   build.sh und landkartendrift.mjs vergleichen ihn. */
export const ohneCR = (text) => text.replace(/\r\n/g, '\n');
export const jsonSha = (text) => crypto.createHash('sha256').update(ohneCR(text)).digest('hex').slice(0, 16);

/* Befunde zur Form von landkarte.json (leer = in Ordnung). */
export function pruefeDaten(daten) {
  const befunde = [];
  for (const p of REIHENFOLGE) if (!daten.profile[p]) befunde.push('Profil fehlt in landkarte.json: ' + p);
  if (befunde.length) return befunde;
  for (const p of Object.keys(daten.profile)) if (!REIHENFOLGE.includes(p)) befunde.push('Profil ohne Spalte: ' + p);
  for (const p of REIHENFOLGE) {
    const da = new Set(daten.profile[p].knoten.map((n) => n.schluessel));
    for (const k of daten.profile[p].kanten) if (!da.has(k.von) || !da.has(k.nach)) befunde.push(`Kante ohne Knoten in ${p}: ${k.von} -> ${k.nach}`);
    for (const n of daten.profile[p].knoten) if (!n.strang || !daten.straenge || !daten.straenge[n.strang]) befunde.push(`Knoten ohne bekannten Strang in ${p}: ${n.schluessel}`);
  }
  return befunde;
}

/* Laeuft im Browser: Modell, Ansichten, Zoom, Pfeile. */
function client() {
  const D = JSON.parse(document.getElementById('daten').textContent);
  const NS = 'http://www.w3.org/2000/svg';
  const KARTE = 120, LUECKE = 18, MAX_REIHE = 5;
  const $ =(s) => document.querySelector(s);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const kurz = (t, n) => (t.length > n ? t.slice(0, n - 1) + '…' : t);
  const glatt = (t) => (t || '').replace(/\s+/g, ' ').trim();
  const druck = new URLSearchParams(location.search).has('druck');
  if (druck) document.body.classList.add('druck');

  /* ---------- Modell ---------- */
  const knoten = new Map(), profile = {}, alleKanten = [];
  for (const pid of D.reihenfolge) {
    const p = D.profile[pid];
    const pr = profile[pid] = { id: pid, titel: p.titel, rollen: p.rollen, ids: [], kanten: [], straenge: [], nKanten: p.kanten.length };
    for (const n of p.knoten) { const id = pid + '|' + n.schluessel; knoten.set(id, { ...n, id, profil: pid, aus: [], ein: [] }); pr.ids.push(id); }
    /* Doppelte Kanten (gleiches Paar, andere Ausloeser) zu einer zusammenfassen. */
    const paare = new Map();
    for (const k of p.kanten) {
      const key = k.von + '>' + k.nach;
      if (!paare.has(key)) {
        const neu = { profil: pid, von: pid + '|' + k.von, nach: pid + '|' + k.nach, texte: [] };
        paare.set(key, neu); pr.kanten.push(neu); alleKanten.push(neu);
      }
      const t = glatt(k.text || k.art);
      if (!paare.get(key).texte.includes(t)) paare.get(key).texte.push(t);
    }
  }
  for (const k of alleKanten) { knoten.get(k.von).aus.push(k); knoten.get(k.nach).ein.push(k); }

  /* Strang und Name kommen aus landkarte.json (Regeln in landkartenregeln.mjs). */
  for (const n of knoten.values()) {
    const slug = n.strang, name = D.straenge[slug] || slug;
    const pr = profile[n.profil];
    let s = pr.straenge.find((x) => x.slug === slug);
    if (!s) pr.straenge.push(s = { slug, name, ids: [] });
    s.ids.push(n.id);
  }
  const strangVon = (pid, slug) => profile[pid].straenge.find((s) => s.slug === slug);
  window.__straenge = Object.fromEntries(D.reihenfolge.map((p) => [p, profile[p].straenge.map((s) => ({ slug: s.slug, name: s.name, anzahl: s.ids.length }))]));

  const bild = (n, gross) => (D.bilder ? D.bilder[n.id][gross ? 'g' : 'k'] : n.bild);
  const name = (n) => n.name || n.ueberschrift || n.schluessel;
  const zusatz = (n) => (n.oben.length ? n.oben.join(' › ') : n.unter || (n.tiefe === 0 ? 'Start' : n.ansicht));
  const kurzLabel = name;

  /* Weg vom Start bis id (kuerzester Pfad) plus alles, was von id tiefer weitergeht. */
  function wegZu(id) {
    const n = knoten.get(id);
    const start = profile[n.profil].ids.find((i) => knoten.get(i).tiefe === 0);
    const vor = new Map([[start, null]]), q = [start];
    while (q.length) {
      const c = q.shift();
      if (c === id) break;
      for (const k of knoten.get(c).aus) if (!vor.has(k.nach)) { vor.set(k.nach, c); q.push(k.nach); }
    }
    const pfad = [];
    if (vor.has(id)) for (let c = id; c != null; c = vor.get(c)) pfad.unshift(c); else pfad.push(id);
    const weiter = new Set([id]), q2 = [id];
    while (q2.length) {
      const c = q2.shift();
      for (const k of knoten.get(c).aus) {
        const z = knoten.get(k.nach);
        if (z.tiefe > knoten.get(c).tiefe && !weiter.has(z.id)) { weiter.add(z.id); q2.push(z.id); }
      }
    }
    return { pfad, alle: new Set([...pfad, ...weiter]) };
  }

  /* ---------- Zustand im URL ---------- */
  function lese() {
    const quelle = location.hash.startsWith('#k:') ? new URLSearchParams(location.hash.slice(3)) : new URLSearchParams(location.search);
    let rolle = quelle.get('rolle'), strang = quelle.get('strang'), weg = quelle.get('weg');
    if (!profile[rolle]) rolle = null;
    if (!rolle) strang = weg = null;
    if (strang && !strangVon(rolle, strang)) strang = null;
    if (weg && !knoten.has(rolle + '|' + weg)) weg = null;
    if (weg) strang = null;
    return { rolle, strang, weg };
  }
  let S = lese();
  function geh(neu) {
    S = { rolle: neu.rolle || null, strang: neu.strang || null, weg: neu.weg || null };
    const q = new URLSearchParams();
    if (S.rolle) q.set('rolle', S.rolle);
    if (S.strang) q.set('strang', S.strang);
    if (S.weg) q.set('weg', S.weg);
    if (druck) q.set('druck', '1');
    const s = q.toString();
    try { history.pushState(null, '', location.pathname + (s ? '?' + s : '')); }
    catch (e) { history.pushState(null, '', '#k:' + s); }
    zeigeAn();
  }
  addEventListener('popstate', () => { S = lese(); zeigeAn(); });

  /* ---------- Ansichten ---------- */
  function ansicht() {
    if (!S.rolle) {
      const ps = D.reihenfolge.map((p) => profile[p]);
      const ebenen = Math.max(...ps.flatMap((p) => p.ids.map((i) => knoten.get(i).tiefe))) + 1;
      return {
        labels: Array.from({ length: ebenen }, (_, i) => 'Ebene ' + i),
        spalten: ps.map((p) => ({ titel: p.titel, sub: `${p.ids.length} Zustände · ${p.nKanten} Kanten` + (p.rollen ? ' · ' + p.rollen.join(', ') : ''),
          zeilen: Array.from({ length: ebenen }, (_, i) => p.ids.filter((id) => knoten.get(id).tiefe === i).map((id) => ({ typ: 'knoten', id }))) })),
        kanten: alleKanten,
      };
    }
    const p = profile[S.rolle];
    const nachTiefe = (ids, extra = {}) => {
      const tiefen = [...new Set(ids.map((i) => knoten.get(i).tiefe))].sort((a, b) => a - b);
      return { labels: tiefen.map((t) => 'Ebene ' + t), zeilen: tiefen.map((t) => ids.filter((i) => knoten.get(i).tiefe === t).map((id) => ({ typ: 'knoten', id, ...(extra[id] || {}) }))) };
    };
    if (S.weg) {
      const w = wegZu(S.rolle + '|' + S.weg);
      const ids = p.ids.filter((i) => w.alle.has(i));
      const extra = {};
      for (const i of w.pfad) extra[i] = { aufWeg: true };
      extra[S.rolle + '|' + S.weg] = { aufWeg: true, ziel: true };
      const t = nachTiefe(ids, extra);
      const kanten = p.kanten.filter((k) => w.alle.has(k.von) && w.alle.has(k.nach));
      const z = knoten.get(S.rolle + '|' + S.weg);
      return { labels: t.labels, spalten: [{ titel: `${p.titel} › Weg zu ${name(z)}`, sub: `${w.pfad.length - 1} Klicks vom Start · ${ids.length} Zustände · ${kanten.length} Kanten`, zeilen: t.zeilen }], kanten };
    }
    if (S.strang) {
      const st = strangVon(S.rolle, S.strang);
      const drin = new Set(st.ids);
      const t = nachTiefe(st.ids);
      const stummel = new Map(), kanten = p.kanten.filter((k) => drin.has(k.von) && drin.has(k.nach));
      const stub = (richtung, anderer, text, nid) => {
        const key = richtung + '|' + anderer.strang + '|' + text;
        if (!stummel.has(key)) {
          const ziel = strangVon(S.rolle, anderer.strang);
          stummel.set(key, { typ: 'stummel', id: 'stummel:' + stummel.size, richtung, strang: anderer.strang, name: ziel.name, text, knoten: anderer.id });
        }
        const s = stummel.get(key);
        kanten.push(richtung === 'ein' ? { von: s.id, nach: nid, texte: [], art: 'stummel' } : { von: nid, nach: s.id, texte: [], art: 'stummel' });
      };
      for (const id of st.ids) {
        const n = knoten.get(id);
        for (const k of n.ein) if (!drin.has(k.von)) for (const tx of k.texte) stub('ein', knoten.get(k.von), tx, id);
        for (const k of n.aus) if (!drin.has(k.nach)) for (const tx of k.texte) stub('aus', knoten.get(k.nach), tx, id);
      }
      const ein = [...stummel.values()].filter((s) => s.richtung === 'ein');
      const aus = [...stummel.values()].filter((s) => s.richtung === 'aus');
      const labels = [...(ein.length ? ['Zugänge'] : []), ...t.labels, ...(aus.length ? ['Ausgänge'] : [])];
      const zeilen = [...(ein.length ? [ein] : []), ...t.zeilen, ...(aus.length ? [aus] : [])];
      return { labels, spalten: [{ titel: `${p.titel} › ${st.name}`, sub: `${st.ids.length} Zustände · ${kanten.filter((k) => !k.art).length} Kanten · ${ein.length} Zugänge · ${aus.length} Ausgänge`, zeilen }], kanten, strang: true };
    }
    const t = nachTiefe(p.ids);
    return { labels: t.labels, spalten: [{ titel: p.titel, sub: `${p.ids.length} Zustände · ${p.nKanten} Kanten` + (p.rollen ? ' · ' + p.rollen.join(', ') : ''), zeilen: t.zeilen }], kanten: p.kanten };
  }

  /* ---------- Kopf: Auswahl, Brotkrumen, Zoom ---------- */
  const nKnoten = knoten.size, nKanten = D.reihenfolge.reduce((s, p) => s + profile[p].nKanten, 0);
  $('#meta').textContent = `Stand der Testdaten ${D.jetzt.slice(8, 10)}.${D.jetzt.slice(5, 7)}.${D.jetzt.slice(0, 4)} ${D.jetzt.slice(11, 16)} · ${nKnoten} Zustände · ${nKanten} Kanten · Tiefengrenze ${D.maxTiefe} · erzeugt von ${D.erzeugtVon}`;
  if (D.nichtErreichteAusloeser && D.nichtErreichteAusloeser.length) {
    $('#kopf').append(el('p', 'warnung', 'Nicht verfolgt (Tiefengrenze): ' + D.nichtErreichteAusloeser.map((a) => JSON.stringify(a)).join(', ')));
  }
  const rolleSel = $('#rolle'), strangSel = $('#strang');
  rolleSel.append(new Option('Gesamtkarte', ''));
  for (const p of D.reihenfolge) rolleSel.append(new Option(profile[p].titel, p));
  rolleSel.addEventListener('change', () => geh({ rolle: rolleSel.value }));
  strangSel.addEventListener('change', () => geh({ rolle: S.rolle, strang: strangSel.value }));
  $('#gesamt').addEventListener('click', () => geh({}));

  function kopf() {
    const p = S.rolle && profile[S.rolle];
    $('h1').textContent = 'App-Landkarte' + (p ? ' · ' + p.titel : '');
    rolleSel.value = S.rolle || '';
    strangSel.replaceChildren(new Option(p ? 'Alle Stränge' : '–', ''));
    if (p) for (const s of p.straenge) strangSel.append(new Option(`${s.name} (${s.ids.length})`, s.slug));
    strangSel.disabled = !p;
    const zn = S.weg && knoten.get(S.rolle + '|' + S.weg);
    strangSel.value = S.strang || (zn ? zn.strang : '') || '';
    const kr = $('#krumen');
    kr.replaceChildren();
    const teile = [['Gesamtkarte', {}]];
    if (p) teile.push([p.titel, { rolle: S.rolle }]);
    const st = p && (S.strang || (zn && zn.strang));
    if (st) teile.push([strangVon(S.rolle, st).name, { rolle: S.rolle, strang: st }]);
    if (zn) teile.push(['Weg zu ' + name(zn) + ' · ' + kurz(zusatz(zn), 24), null]);
    teile.forEach(([text, ziel], i) => {
      if (i) kr.append(el('span', 'trenner', '›'));
      if (i === teile.length - 1 || !ziel) kr.append(el('strong', '', text));
      else { const b = el('button', 'krume', text); b.type = 'button'; b.addEventListener('click', () => geh(ziel)); kr.append(b); }
    });
    $('#gesamt').hidden = !p;
  }

  /* ---------- Karte bauen ---------- */
  const welt = $('#welt'), karte = $('#karte'), buehne = $('#buehne');
  const karten = new Map();
  let aktuelleKanten = [];
  function karteEl(n, item) {
    const b = el('button', 'karte' + (n.tiefe === 0 ? ' start' : '') + (item.aufWeg ? ' aufweg' : '') + (item.ziel ? ' ziel' : ''));
    b.type = 'button';
    b.title = n.schluessel;
    let v;
    if (n.dialog) {
      v = el('div', 'dialog');
      v.append(el('small', '', n.dialog.typ), el('p', '', n.dialog.text));
    } else {
      v = el('img');
      v.src = bild(n, false); v.alt = name(n); v.width = KARTE; v.height = Math.round(KARTE * 2532 / 1170); v.draggable = false;
      v.onerror = () => { v.replaceWith(el('span', 'fehlt', 'Bild fehlt – landkarte.mjs laufen lassen')); };
    }
    b.append(v, el('strong', '', name(n)), el('span', '', kurz(zusatz(n), 26)), el('em', 'kurz', kurz(kurzLabel(n), 18)));
    b.addEventListener('mouseenter', () => fokus(n.id, true));
    b.addEventListener('mouseleave', () => fokus(n.id, false));
    b.addEventListener('click', () => zeige(n));
    return b;
  }
  function stummelEl(s) {
    const b = el('button', 'stummel ' + s.richtung);
    b.type = 'button';
    b.title = (s.richtung === 'ein' ? 'Zugang aus ' : 'Ausgang nach ') + s.name + ': ' + s.text;
    b.append(el('b', '', (s.richtung === 'ein' ? '← ' : '→ ') + s.name), el('span', '', kurz(s.text, 34)));
    b.addEventListener('mouseenter', () => fokus(s.id, true));
    b.addEventListener('mouseleave', () => fokus(s.id, false));
    b.addEventListener('click', () => geh({ rolle: S.rolle, strang: s.strang }));
    return b;
  }
  function baue(v) {
    karte.replaceChildren();
    karten.clear();
    karte.classList.toggle('einzeln', v.spalten.length === 1);
    karte.style.gridTemplateColumns = '64px ' + v.spalten.map(() => 'max-content').join(' ');
    karte.append(el('div', 'ecke'));
    for (const sp of v.spalten) {
      const h = el('div', 'spaltenkopf');
      h.append(el('strong', '', sp.titel), el('span', '', sp.sub));
      karte.append(h);
    }
    const breite = v.spalten.map((sp) => {
      const reihe = Math.max(1, Math.min(MAX_REIHE, ...[Math.max(...sp.zeilen.map((z) => z.filter((i) => i.typ === 'knoten').length))]));
      return Math.max(reihe * KARTE + (reihe - 1) * LUECKE, v.spalten.length === 1 ? 3 * KARTE + 2 * LUECKE : 0);
    });
    v.labels.forEach((lab, i) => {
      const band = i % 2 ? ' ungerade' : '';
      karte.append(el('div', 'ebene' + band, lab));
      v.spalten.forEach((sp, j) => {
        const zelle = el('div', 'zelle' + band);
        zelle.style.width = breite[j] + 'px';
        for (const item of sp.zeilen[i] || []) {
          const e = item.typ === 'knoten' ? karteEl(knoten.get(item.id), item) : stummelEl(item);
          karten.set(item.id, e);
          zelle.append(e);
        }
        karte.append(zelle);
      });
    });
    karte.append(svg);
    aktuelleKanten = v.kanten;
  }

  /* ---------- Pfeile ---------- */
  const svg = document.createElementNS(NS, 'svg');
  svg.id = 'pfeile';
  const sicht = new Map();
  function zeichne() {
    svg.replaceChildren();
    sicht.clear();
    svg.setAttribute('width', karte.offsetWidth); svg.setAttribute('height', karte.offsetHeight);
    const defs = document.createElementNS(NS, 'defs');
    for (const id of ['m', 'm-aus', 'm-ein']) defs.insertAdjacentHTML('beforeend',
      `<marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z"/></marker>`);
    svg.append(defs);
    const w = karte.getBoundingClientRect(), s = Z.s;
    const r = (b) => { const q = b.getBoundingClientRect(); return { t: (q.top - w.top) / s, b: (q.bottom - w.top) / s, x: ((q.left + q.right) / 2 - w.left) / s }; };
    const merk = (id, g, wie) => { if (!sicht.has(id)) sicht.set(id, []); sicht.get(id).push([g, wie]); };
    for (const k of aktuelleKanten) {
      const a = karten.get(k.von), b = karten.get(k.nach);
      if (!a || !b) continue;
      const q = r(a), t = r(b);
      let art = k.art;
      if (!art) { const ts = knoten.get(k.von).tiefe, tt = knoten.get(k.nach).tiefe; art = tt > ts ? 'tief' : tt === ts ? 'quer' : 'zurueck'; }
      let d;
      if (t.t > q.b) {
        const c = Math.max(24, (t.t - q.b) / 2);
        d = `M${q.x},${q.b} C${q.x},${q.b + c} ${t.x},${t.t - c} ${t.x},${t.t - 2}`;
      } else if (Math.abs(t.t - q.t) < 2) {
        const h = 26 + Math.abs(t.x - q.x) * 0.12;
        d = `M${q.x},${q.t} C${q.x},${q.t - h} ${t.x},${t.t - h} ${t.x},${t.t - 2}`;
      } else {
        const c = Math.max(24, (q.t - t.b) / 2);
        d = `M${q.x},${q.t} C${q.x},${q.t - c} ${t.x},${t.b + c} ${t.x},${t.b + 2}`;
      }
      const g = document.createElementNS(NS, 'g');
      g.setAttribute('class', 'kante ' + art);
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', d);
      g.append(p);
      svg.append(g);
      if (k.texte.length) {
        const mitte = p.getPointAtLength(p.getTotalLength() / 2);
        const text = document.createElementNS(NS, 'text');
        text.setAttribute('x', mitte.x); text.setAttribute('y', mitte.y - 4);
        text.textContent = kurz(k.texte.join(' / '), 34);
        g.append(text);
      }
      merk(k.von, g, 'aus');
      merk(k.nach, g, 'ein');
    }
  }
  function fokus(id, an) {
    svg.classList.toggle('fokus', an);
    for (const [g, wie] of sicht.get(id) || []) { g.classList.toggle(wie, an); if (an) svg.append(g); }
  }

  /* ---------- Zoom und Verschieben ---------- */
  const Z = { x: 0, y: 0, s: 1 };
  const MIN = 0.08, MAX = 3;
  function anwenden() {
    if (druck) return;
    welt.style.transform = `translate(${Z.x}px, ${Z.y}px) scale(${Z.s})`;
    buehne.classList.toggle('fern', Z.s < 0.4);
    buehne.style.setProperty('--inv', Math.min(3.2, 0.85 / Z.s));
    $('#prozent').textContent = Math.round(Z.s * 100) + ' %';
  }
  function zoomUm(px, py, s2) {
    s2 = Math.min(MAX, Math.max(MIN, s2));
    const wx = (px - Z.x) / Z.s, wy = (py - Z.y) / Z.s;
    Z.s = s2; Z.x = px - wx * s2; Z.y = py - wy * s2;
    anwenden();
  }
  function alles() {
    const bw = buehne.clientWidth, bh = buehne.clientHeight, w = welt.offsetWidth, h = welt.offsetHeight;
    Z.s = Math.min(1, (bw - 32) / w, (bh - 32) / h);
    Z.x = Math.max(16, (bw - w * Z.s) / 2); Z.y = 16;
    anwenden();
  }
  const mitteZoom = (f) => zoomUm(buehne.clientWidth / 2, buehne.clientHeight / 2, Z.s * f);
  $('#plus').addEventListener('click', () => mitteZoom(1.25));
  $('#minus').addEventListener('click', () => mitteZoom(0.8));
  $('#alles').addEventListener('click', alles);
  const lokal = (e) => { const q = buehne.getBoundingClientRect(); return { x: e.clientX - q.left, y: e.clientY - q.top }; };
  buehne.addEventListener('wheel', (e) => {
    if (druck) return;
    e.preventDefault();
    const f = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015) * (e.deltaMode === 1 ? 16 : 1));
    const p = lokal(e);
    zoomUm(p.x, p.y, Z.s * f);
  }, { passive: false });
  const zeiger = new Map();
  let zieh = null, pinch = null, geschoben = false;
  buehne.addEventListener('pointerdown', (e) => {
    if (druck || (e.pointerType === 'mouse' && e.button !== 0)) return;
    zeiger.set(e.pointerId, lokal(e));
    if (zeiger.size === 1) { const p = lokal(e); zieh = { x: p.x, y: p.y, zx: Z.x, zy: Z.y }; geschoben = false; pinch = null; }
    if (zeiger.size === 2) {
      const [a, b] = [...zeiger.values()];
      const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s: Z.s, wx: (m.x - Z.x) / Z.s, wy: (m.y - Z.y) / Z.s };
      zieh = null;
    }
  });
  addEventListener('pointermove', (e) => {
    if (!zeiger.has(e.pointerId)) return;
    const p = lokal(e);
    zeiger.set(e.pointerId, p);
    if (pinch && zeiger.size === 2) {
      const [a, b] = [...zeiger.values()];
      const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      Z.s = Math.min(MAX, Math.max(MIN, pinch.s * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d));
      Z.x = m.x - pinch.wx * Z.s; Z.y = m.y - pinch.wy * Z.s;
      geschoben = true;
      anwenden();
    } else if (zieh) {
      const dx = p.x - zieh.x, dy = p.y - zieh.y;
      if (!geschoben && Math.hypot(dx, dy) < 5) return;
      geschoben = true;
      buehne.classList.add('zieht');
      Z.x = zieh.zx + dx; Z.y = zieh.zy + dy;
      anwenden();
    }
  });
  const los = (e) => {
    zeiger.delete(e.pointerId);
    if (zeiger.size < 2) pinch = null;
    if (zeiger.size === 1) { const p = [...zeiger.values()][0]; zieh = { x: p.x, y: p.y, zx: Z.x, zy: Z.y }; }
    if (!zeiger.size) { zieh = null; buehne.classList.remove('zieht'); }
  };
  addEventListener('pointerup', los);
  addEventListener('pointercancel', los);
  buehne.addEventListener('click', (e) => { if (geschoben) { e.stopPropagation(); e.preventDefault(); geschoben = false; } }, true);

  /* ---------- Vergroesserung ---------- */
  const box = $('#gross');
  function zeige(n) {
    const inhalt = box.querySelector('.inhalt');
    inhalt.replaceChildren();
    let v;
    if (n.dialog) { v = el('div', 'dialog'); v.append(el('small', '', n.dialog.typ), el('p', '', n.dialog.text)); }
    else {
      v = el('img'); v.src = bild(n, true); v.alt = name(n);
      v.onerror = () => { v.replaceWith(el('span', 'fehlt', 'Bild fehlt – landkarte.mjs laufen lassen')); };
    }
    const info = el('div', 'info');
    const st = strangVon(n.profil, n.strang);
    info.append(el('p', 'rolle', `${profile[n.profil].titel} · ${st.name} · Ebene ${n.tiefe}`), el('h2', '', name(n)), el('code', '', n.schluessel));
    const tun = el('div', 'tun');
    const b1 = el('button', 'knopf', 'Nur diesen Weg zeigen'); b1.type = 'button';
    b1.addEventListener('click', () => geh({ rolle: n.profil, weg: n.schluessel }));
    const b2 = el('button', 'knopf leise', `Strang „${st.name}“`); b2.type = 'button';
    b2.addEventListener('click', () => geh({ rolle: n.profil, strang: n.strang }));
    tun.append(b1, b2);
    info.append(tun, el('h3', '', 'Klickpfad'));
    const pfad = el('ol');
    if (!n.pfad.length) pfad.append(el('li', 'leer', 'Startzustand'));
    for (const s of n.pfad) pfad.append(el('li', '', kurz(glatt(s.text || s.art), 60)));
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
    inhalt.append(v, info);
    box.hidden = false;
  }
  const zu = () => { box.hidden = true; };
  box.addEventListener('click', (e) => { if (e.target === box || e.target.classList.contains('schliessen')) zu(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') zu(); });

  /* ---------- Ablauf ---------- */
  function zeigeAn() {
    zu();
    kopf();
    baue(ansicht());
    Z.s = 1; Z.x = 0; Z.y = 0;
    anwenden();
    zeichne();
    if (!druck) alles();
  }
  zeigeAn();
  addEventListener('resize', () => { if (!druck) { zeichne(); } });
  document.fonts.ready.then(() => { zeichne(); window.__fertig = true; });
}

const CSS = `
:root { --grund: #f4f7f5; --flaeche: #ffffff; --band: #e9eeeb; --text: #14211b; --leise: #5d6b64; --linie: #c9d2cd;
  --gruen: #1f7a4d; --aus: #1f7a4d; --ein: #b5541c; --kante: rgba(40, 70, 60, .38); --inv: 1; }
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; background: var(--grund); color: var(--text); font: 14px/1.4 system-ui, -apple-system, 'Segoe UI', sans-serif; }
body { display: flex; flex-direction: column; overflow: hidden; }
#kopf { flex: none; padding: 12px 16px 10px; background: var(--flaeche); border-bottom: 1px solid var(--linie); z-index: 5; }
#kopf h1 { margin: 0; font-size: 20px; }
#kopf p { margin: 2px 0 0; color: var(--leise); font-size: 12px; }
#kopf .warnung { color: #a1361b; }
.steuer { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; margin-top: 8px; }
.steuer select, .knopf, .zoom button { font: inherit; font-size: 13px; padding: 5px 10px; border: 1px solid var(--linie); border-radius: 8px; background: #fff; color: var(--text); cursor: pointer; }
.steuer select:disabled { color: var(--leise); cursor: default; }
.knopf { background: var(--gruen); border-color: var(--gruen); color: #fff; font-weight: 600; }
.knopf.leise { background: #fff; color: var(--gruen); }
#krumen { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; font-size: 13px; }
#krumen .trenner { color: var(--leise); }
.krume { all: unset; cursor: pointer; color: var(--gruen); text-decoration: underline; text-underline-offset: 2px; }
.zoom { display: flex; align-items: center; gap: 4px; margin-left: auto; }
.zoom button { min-width: 34px; }
#prozent { min-width: 48px; text-align: center; font-size: 12px; color: var(--leise); font-variant-numeric: tabular-nums; }
.legende { font-size: 12px; color: var(--leise); }
.legende .l { display: inline-block; width: 24px; height: 0; border-top: 2px solid var(--kante); vertical-align: middle; margin: 0 4px 0 8px; }
.legende .l:first-child { margin-left: 0; }
.legende .l-quer { border-top-style: dotted; } .legende .l-zurueck { border-top-style: dashed; }
#buehne { flex: 1; position: relative; overflow: hidden; touch-action: none; cursor: grab; user-select: none; -webkit-user-select: none; }
#buehne.zieht { cursor: grabbing; }
#welt { position: absolute; left: 0; top: 0; transform-origin: 0 0; width: max-content; }
#karte { position: relative; display: grid; background: var(--flaeche); border: 1px solid var(--linie); border-radius: 12px; overflow: hidden; }
.ecke, .spaltenkopf { background: var(--flaeche); border-bottom: 1px solid var(--linie); }
.spaltenkopf { padding: 12px 20px 10px; border-left: 1px solid var(--linie); max-width: 100%; }
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
.karte.aufweg img, .karte.aufweg .dialog { outline: 3px solid #d39b2a; outline-offset: 1px; }
.karte.ziel img, .karte.ziel .dialog { outline: 4px solid var(--ein); outline-offset: 2px; }
.karte:hover img, .karte:focus-visible img { outline: 3px solid var(--aus); outline-offset: 1px; }
.karte strong { font-size: 12px; margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.karte span { font-size: 11px; color: var(--leise); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.karte .kurz { display: none; position: absolute; left: 50%; top: 80px; transform: translateX(-50%) scale(var(--inv)); transform-origin: 50% 0;
  font-style: normal; font-size: 12px; font-weight: 700; white-space: nowrap; background: rgba(255, 255, 255, .94); color: var(--text);
  padding: 2px 6px; border-radius: 6px; border: 1px solid var(--linie); z-index: 4; pointer-events: none; }
.fern .karte .kurz { display: block; }
.stummel { all: unset; cursor: pointer; display: flex; flex-direction: column; max-width: 220px; padding: 6px 10px; border-radius: 10px; border: 1px dashed var(--leise);
  background: #fff; font-size: 12px; position: relative; z-index: 1; }
.stummel b { font-size: 12px; }
.stummel.ein b { color: var(--ein); } .stummel.aus b { color: var(--aus); }
.stummel span { color: var(--leise); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.stummel:hover { border-style: solid; border-color: var(--text); }
#pfeile { position: absolute; left: 0; top: 0; pointer-events: none; z-index: 3; overflow: visible; }
#pfeile path { fill: none; stroke: var(--kante); stroke-width: 1.4; marker-end: url(#m); vector-effect: non-scaling-stroke; }
#pfeile marker path { fill: var(--kante); stroke: none; }
#m-aus path { fill: var(--aus) !important; } #m-ein path { fill: var(--ein) !important; }
#pfeile .quer path { stroke-dasharray: 2 3; } #pfeile .zurueck path { stroke-dasharray: 6 4; }
#pfeile .stummel path { stroke: rgba(93, 107, 100, .5); stroke-dasharray: 1 3; }
#pfeile text { display: none; font-size: 11px; font-weight: 600; text-anchor: middle; paint-order: stroke; stroke: #fff; stroke-width: 4px; stroke-linejoin: round; }
#pfeile.fokus .kante { opacity: .15; }
#pfeile.fokus .aus, #pfeile.fokus .ein { opacity: 1; }
#pfeile .aus path { stroke: var(--aus); stroke-width: 2.4; marker-end: url(#m-aus); }
#pfeile .ein path { stroke: var(--ein); stroke-width: 2.4; marker-end: url(#m-ein); }
#pfeile .aus text { display: block; fill: var(--aus); } #pfeile .ein text { display: block; fill: var(--ein); transform: translateY(15px); }
.fern #pfeile text { display: none !important; }
#gross { position: fixed; inset: 0; z-index: 10; background: rgba(10, 20, 15, .72); display: flex; align-items: center; justify-content: center; padding: 24px; }
#gross[hidden] { display: none; }
#gross .inhalt { display: flex; gap: 24px; max-height: 100%; background: var(--flaeche); border-radius: 14px; padding: 20px; position: relative; }
#gross .inhalt > img, #gross .inhalt > .fehlt, #gross .inhalt > .dialog { height: min(86vh, 900px); width: auto; aspect-ratio: 1170 / 2532; border-radius: 12px; border: 1px solid var(--linie); }
#gross .info { width: 340px; overflow-y: auto; max-height: min(86vh, 900px); }
#gross .rolle { margin: 0; color: var(--leise); font-size: 12px; }
#gross h2 { margin: 2px 0 4px; font-size: 20px; }
#gross h3 { margin: 16px 0 4px; font-size: 13px; text-transform: uppercase; letter-spacing: .04em; color: var(--leise); }
#gross code { font-size: 12px; color: var(--leise); word-break: break-all; }
#gross .tun { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
#gross ol, #gross ul { margin: 0; padding-left: 20px; }
#gross li { margin: 3px 0; font-size: 13px; }
#gross li span { display: block; color: var(--leise); font-size: 12px; }
#gross .leer { color: var(--leise); list-style: none; margin-left: -20px; }
#gross .sprung { all: unset; cursor: pointer; color: var(--gruen); font-weight: 600; text-decoration: underline; text-underline-offset: 2px; }
#gross .schliessen { position: absolute; top: 8px; right: 12px; border: 0; background: none; font-size: 24px; cursor: pointer; color: var(--leise); }
@media (max-width: 720px) {
  #kopf h1 { font-size: 17px; } #meta, .legende { display: none; }
  .zoom { margin-left: 0; }
  #gross { padding: 8px; }
  #gross .inhalt { flex-direction: column; align-items: center; overflow-y: auto; padding: 14px; }
  #gross .inhalt > img, #gross .inhalt > .fehlt, #gross .inhalt > .dialog { height: 60vh; }
  #gross .info { width: 100%; max-height: none; }
}
/* Druckmodus fuer die PNGs: kein Zoom, normale Seite */
.druck { display: block; overflow: visible; height: auto; }
.druck #kopf { border: 0; background: none; padding: 20px 24px 0; max-width: 760px; }
.druck .steuer { display: none; }
.druck #buehne { overflow: visible; cursor: default; padding: 16px 24px 40px; width: max-content; }
.druck #welt { position: static; }
`;

/* Die Seite als Text. bilder=null: Bilder relativ verlinkt (landkarte.html),
   sonst eingebettet (landkarte-komplett.html). */
export function seite(daten, sha, bilder) {
  const json = JSON.stringify({
    erzeugtVon: daten.erzeugtVon, jetzt: daten.jetzt, maxTiefe: daten.maxTiefe, straenge: daten.straenge,
    nichtErreichteAusloeser: daten.nichtErreichteAusloeser, reihenfolge: REIHENFOLGE, profile: daten.profile, bilder,
  }).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="landkarte-json" content="${sha}">
<title>App-Landkarte</title>
<!-- Erzeugt von .design-sync/shots/landkartenlayout.mjs aus landkarte.json. Nicht von Hand bearbeiten. -->
<style>${CSS}</style>
</head>
<body>
<header id="kopf">
<h1>App-Landkarte</h1>
<p id="meta"></p>
<p class="legende"><span class="l l-tief"></span> eine Ebene tiefer <span class="l l-quer"></span> gleiche Ebene <span class="l l-zurueck"></span> zurück nach oben · Karte überfahren zeigt ihre Auslöser, Klick vergrößert</p>
<div class="steuer">
<select id="rolle" aria-label="Rolle"></select>
<select id="strang" aria-label="Strang"></select>
<nav id="krumen" aria-label="Brotkrumen"></nav>
<button id="gesamt" class="knopf leise" type="button" hidden>Zurück zur Gesamtkarte</button>
<div class="zoom"><button id="minus" type="button" aria-label="Verkleinern">−</button><span id="prozent"></span><button id="plus" type="button" aria-label="Vergrößern">+</button><button id="alles" type="button">Alles zeigen</button></div>
</div>
</header>
<div id="buehne"><div id="welt"><div id="karte"></div></div></div>
<div id="gross" hidden><div class="inhalt"></div><button class="schliessen" type="button" aria-label="Schließen">×</button></div>
<script type="application/json" id="daten">${json}</script>
<script>(${client.toString()})();</script>
</body>
</html>
`;
}

const istHaupt = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (istHaupt) {
  const text = fs.readFileSync(path.join(ZIEL, 'landkarte.json'), 'utf8');
  const daten = JSON.parse(text), sha = jsonSha(text);
  let rot = 0;
  const fehler = (t) => { console.error('ROT  ' + t); rot++; };
  for (const b of pruefeDaten(daten)) fehler(b);
  if (rot) process.exit(1);

  /* Bilder pruefen: ohne Lauf von landkarte.mjs gibt es keine PNGs. */
  const alle = REIHENFOLGE.flatMap((p) => daten.profile[p].knoten.map((n) => ({ p, n })));
  for (const { n } of alle) if (!n.bild && !n.dialog) fehler('Knoten ohne Bild und ohne Dialog: ' + n.schluessel);
  for (const { n } of alle) if (n.bild && !fs.existsSync(path.join(ZIEL, n.bild))) fehler('Bild fehlt: ' + n.bild + ' (zuerst landkarte.mjs laufen lassen)');
  if (rot) process.exit(1);

  fs.writeFileSync(path.join(ZIEL, 'landkarte.html'), seite(daten, sha, null));
  console.log('geschrieben ' + path.join(ZIEL, 'landkarte.html'));

  const { server, basis } = await starte();
  const browser = await chromium.launch({ channel: 'chrome' });
  const url = basis + ZIEL.replace(/\\/g, '/') + '/landkarte.html';

  async function neueSeite(opt = {}) {
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1, ...opt });
    ctx.on('request', (r) => { const u = r.url(); if (!u.startsWith(basis) && !u.startsWith('data:') && !u.startsWith('file:')) fehler('Request nach aussen: ' + u); });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => fehler('Seitenfehler: ' + e.message + ' (' + page.url() + ')'));
    return page;
  }
  async function bereit(page) {
    await page.waitForFunction(() => window.__fertig === true);
    await page.waitForFunction(() => [...document.images].every((i) => i.complete));
    const kaputt = await page.evaluate(() => document.querySelectorAll('.fehlt').length);
    if (kaputt) fehler(kaputt + ' Bilder nicht geladen: ' + page.url());
  }
  const karten = (page) => page.evaluate(() => document.querySelectorAll('#karte .karte').length);

  /* Gesamtansicht: Seitenfehler, Bilder, Strangliste. */
  const page = await neueSeite();
  await page.goto(url, { waitUntil: 'load' });
  await bereit(page);
  const straenge = await page.evaluate(() => window.__straenge);
  console.log('\nStränge je Rolle (Anzahl Zustände)');
  for (const p of REIHENFOLGE) {
    const summe = straenge[p].reduce((s, x) => s + x.anzahl, 0);
    if (summe !== daten.profile[p].knoten.length) fehler(`${p}: Stränge decken ${summe} statt ${daten.profile[p].knoten.length} Zustände ab`);
    console.log(`  ${daten.profile[p].titel.padEnd(20)} ${straenge[p].map((s) => `${s.name} ${s.anzahl}`).join(' · ')}`);
  }
  console.log('');

  /* Bedienung: Zoom per Mausrad, Knoepfe, Ziehen, Klick, Weg, URL. */
  const transform = () => page.evaluate(() => document.getElementById('welt').style.transform);
  const t0 = await transform();
  await page.mouse.move(700, 500);
  await page.mouse.wheel(0, -400);
  const t1 = await transform();
  if (t1 === t0) fehler('Mausrad zoomt nicht');
  await page.mouse.move(700, 500); await page.mouse.down(); await page.mouse.move(820, 560, { steps: 5 }); await page.mouse.up();
  if ((await transform()) === t1) fehler('Ziehen verschiebt nicht');
  await page.click('#plus');
  await page.click('#alles');
  if ((await transform()) !== t0) fehler('Alles zeigen stellt die Ausgangslage nicht her');
  await page.selectOption('#rolle', 'trainer');
  await page.selectOption('#strang', 'kalender');
  if (!page.url().includes('rolle=trainer&strang=kalender')) fehler('Strang-Auswahl nicht im URL: ' + page.url());
  await page.locator('#karte .karte').first().click();
  await page.click('#gross .knopf:not(.leise)');
  if (!/weg=/.test(page.url())) fehler('Nur diesen Weg zeigen ohne Wirkung: ' + page.url());
  await page.goBack();
  if (!page.url().includes('strang=kalender')) fehler('Zurück im Browser ohne Wirkung: ' + page.url());
  await page.click('#gesamt');
  if ((await karten(page)) !== alle.length) fehler('Zurück zur Gesamtkarte zeigt nicht alle Karten');

  /* Jeder Strang und je Rolle der tiefste Weg: Kartenzahl und Seitenfehler. */
  for (const p of REIHENFOLGE) {
    for (const s of straenge[p]) {
      await page.goto(`${url}?rolle=${p}&strang=${s.slug}`, { waitUntil: 'load' });
      await page.waitForFunction(() => window.__fertig === true);
      const n = await karten(page);
      if (n !== s.anzahl) fehler(`${p} › ${s.slug}: ${n} Karten statt ${s.anzahl}`);
    }
    const tief = [...daten.profile[p].knoten].sort((a, b) => b.tiefe - a.tiefe)[0];
    await page.goto(`${url}?rolle=${p}&weg=${encodeURIComponent(tief.schluessel)}`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__fertig === true);
    if ((await karten(page)) < tief.tiefe + 1) fehler(`${p}: Weg zu ${tief.schluessel} zu kurz`);
  }

  /* PNG je Rolle (Druckmodus) und Kontrollbild Trainer › Kalender. */
  fs.rmSync(ROLLEN, { recursive: true, force: true });
  fs.mkdirSync(ROLLEN, { recursive: true });
  const bildSeite = await neueSeite({ deviceScaleFactor: 2 });
  for (const p of REIHENFOLGE) {
    await bildSeite.goto(`${url}?rolle=${p}&druck=1`, { waitUntil: 'load' });
    await bereit(bildSeite);
    await bildSeite.screenshot({ path: path.join(ROLLEN, p + '.png'), fullPage: true });
    console.log('Bild    ' + path.join(ROLLEN, p + '.png'));
  }
  await bildSeite.goto(`${url}?rolle=trainer&strang=kalender`, { waitUntil: 'load' });
  await bereit(bildSeite);
  await bildSeite.screenshot({ path: path.join(ROLLEN, 'strang-trainer-kalender.png') });
  console.log('Bild    ' + path.join(ROLLEN, 'strang-trainer-kalender.png'));

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
  fs.writeFileSync(KOMPLETT, seite(daten, sha, bilder));
  const groesse = fs.statSync(KOMPLETT).size;
  console.log(`geschrieben ${KOMPLETT}  ${(groesse / 1024 / 1024).toFixed(1)} MB (${groesse} Bytes)`);
  if (groesse >= GRENZE) fehler('eigenstaendige Fassung zu gross: ' + groesse + ' Bytes');

  /* Eigenstaendige Fassung ohne Server: Gesamtkarte, Strang per URL, Weg per Klick. */
  const p2 = await neueSeite();
  const datei = pathToFileURL(path.resolve(KOMPLETT)).href;
  await p2.goto(datei, { waitUntil: 'load' });
  await bereit(p2);
  await p2.goto(datei + '?rolle=trainer&strang=kalender', { waitUntil: 'load' });
  await bereit(p2);
  const soll = straenge.trainer.find((s) => s.slug === 'kalender').anzahl;
  if ((await karten(p2)) !== soll) fehler('komplett: Strang Trainer › Kalender falsch');
  await p2.locator('#karte .karte').last().click();
  await p2.click('#gross .knopf:not(.leise)');
  await p2.waitForFunction(() => document.querySelector('#krumen').textContent.includes('Weg zu'));

  await browser.close();
  server.close();
  console.log(rot ? `ROT (${rot})` : 'GRÜN');
  process.exit(rot ? 1 : 0);
}
