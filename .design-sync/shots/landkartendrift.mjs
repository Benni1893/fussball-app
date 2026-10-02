/* App-Landkarte, Schritt L4: Drift-Pruefung (Pflichtliste).

   Crawlt alle sechs Profile frisch (ohne Bilder, schreibt nichts) und
   vergleicht mit dem versionierten Stand.

   Rot (Rueckgabewert 1):
     - Request an Supabase, Seitenfehler, Klick ohne erkennbaren Zustand
     - frischer Crawl weicht von landkarte.json ab (Knoten, Kanten, Namen,
       Straenge, Klickpfade, Ueberschriften ...)
     - ein Knoten ohne sprechenden Namen oder ein Name doppelt im Strang
       (in landkarte.json oder im frischen Crawl)
     - landkarte.html ist nicht die Generatorausgabe aus landkarte.json

   Bei gewollter Aenderung der Oberflaeche: landkarte.mjs und
   landkartenlayout.mjs neu laufen lassen, landkarte.json und
   landkarte.html committen (siehe NOTES.md, Abschnitt App-Landkarte).

   Aufruf: node .design-sync/shots/landkartendrift.mjs                    */
import fs from 'node:fs';
import path from 'node:path';
import { crawle } from './landkarte.mjs';
import { STRAENGE, pruefeNamen } from './landkartenregeln.mjs';
import { seite, jsonSha, ohneCR, pruefeDaten } from './landkartenlayout.mjs';

const ZIEL = '.design-sync/landkarte';
const t0 = Date.now();
let rot = 0;
const befund = (t) => { console.log('ROT  ' + t); rot++; };
const kurz = (v) => { const s = JSON.stringify(v); return s && s.length > 90 ? s.slice(0, 89) + '…' : s; };

const text = fs.readFileSync(path.join(ZIEL, 'landkarte.json'), 'utf8');
const alt = JSON.parse(text);

/* 1. Versionierter Stand in sich: Form, Namen, landkarte.html. */
for (const b of pruefeDaten(alt)) befund('landkarte.json: ' + b);
for (const [p, v] of Object.entries(alt.profile)) for (const b of pruefeNamen(v.titel, v.knoten)) befund('landkarte.json: ' + b);
const html = ohneCR(fs.readFileSync(path.join(ZIEL, 'landkarte.html'), 'utf8'));
if (html !== seite(alt, jsonSha(text), null)) befund('landkarte.html ist nicht aus landkarte.json erzeugt (node .design-sync/shots/landkartenlayout.mjs)');

/* 2. Frischer Crawl ohne Bilder. */
const { json: neu, ergebnisse, laufzeit } = await crawle({ mitBildern: false });
for (const e of ergebnisse) {
  for (const v of e.verstoesse) befund(`[${e.titel}] ${v}`);
  for (const f of e.fehler) befund(`[${e.titel}] ${f}`);
  for (const u of e.unbekannt) befund(`[${e.titel}] Klick ohne erkennbaren Zustand: ${JSON.stringify(u)}`);
  for (const b of e.namenBefunde) befund('Crawl: ' + b);
}

/* 3. Vergleich, erst grob (Text), dann je Profil im Einzelnen. */
if (JSON.stringify(neu, null, 2) + '\n' !== ohneCR(text)) {
  let einzeln = 0;
  const melde = (t) => { befund('Drift: ' + t); einzeln++; };
  for (const k of ['jetzt', 'maxTiefe', 'straenge', 'nichtErreichteAusloeser']) {
    if (JSON.stringify(alt[k]) !== JSON.stringify(neu[k])) melde(`${k}: ${kurz(alt[k])} -> ${kurz(neu[k])}`);
  }
  const profile = [...new Set([...Object.keys(alt.profile), ...Object.keys(neu.profile)])];
  for (const p of profile) {
    const a = alt.profile[p], b = neu.profile[p];
    if (!a || !b) { melde(`Profil ${p} ${a ? 'fehlt im Crawl' : 'neu im Crawl'}`); continue; }
    const ka = new Map(a.knoten.map((n) => [n.schluessel, n])), kb = new Map(b.knoten.map((n) => [n.schluessel, n]));
    for (const [k, n] of kb) if (!ka.has(k)) melde(`[${b.titel}] neuer Zustand ${k} ("${n.name}")`);
    for (const [k, n] of ka) if (!kb.has(k)) melde(`[${a.titel}] Zustand fehlt: ${k} ("${n.name}")`);
    for (const [k, na] of ka) {
      const nb = kb.get(k);
      if (!nb) continue;
      for (const f of new Set([...Object.keys(na), ...Object.keys(nb)])) {
        if (JSON.stringify(na[f]) !== JSON.stringify(nb[f])) melde(`[${a.titel}] ${k}.${f}: ${kurz(na[f])} -> ${kurz(nb[f])}`);
      }
    }
    const kante = (x) => `${x.von} -> ${x.nach} (${x.art}${x.wert ? '=' + x.wert : ''} "${x.text}")`;
    const ea = new Set(a.kanten.map(kante)), eb = new Set(b.kanten.map(kante));
    for (const x of eb) if (!ea.has(x)) melde(`[${b.titel}] neue Kante ${x}`);
    for (const x of ea) if (!eb.has(x)) melde(`[${a.titel}] Kante fehlt: ${x}`);
    for (const f of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (f === 'knoten' || f === 'kanten') continue;
      if (JSON.stringify(a[f]) !== JSON.stringify(b[f])) melde(`[${a.titel}] ${f}: ${kurz(a[f])} -> ${kurz(b[f])}`);
    }
  }
  if (!einzeln) melde('landkarte.json weicht nur in der Formatierung ab');
}

const nKnoten = Object.values(neu.profile).reduce((s, v) => s + v.knoten.length, 0);
const nKanten = Object.values(neu.profile).reduce((s, v) => s + v.kanten.length, 0);
const nStraenge = Object.values(neu.profile).reduce((s, v) => s + new Set(v.knoten.map((n) => n.strang)).size, 0);
console.log(`Crawl: ${nKnoten} Zustände, ${nKanten} Kanten, ${nStraenge} Stränge (${Object.keys(STRAENGE).length} bekannt), ${laufzeit} s`);
console.log(`Laufzeit gesamt: ${Math.round((Date.now() - t0) / 1000)} s`);
console.log(rot ? `--- ROT: ${rot} Befund(e) ---` : '--- gruen: keine Drift ---');
process.exit(rot ? 1 : 0);
