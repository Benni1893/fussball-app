/* Rechte-Uebersicht, Teil "sichtbar" (19.10.2026): erzeugt Markdown-Tabellen
   aus der App-Landkarte (.design-sync/landkarte/landkarte.json) und aus app.js
   (So geht's: SG_FRAGEN, Einfuehrung: EF_RANG). Ausgabe auf stdout; die
   Datei .design-sync/RECHTE.md bindet sie zwischen den Markern ein.
   Aufruf: node .design-sync/shots/rechtetabelle.mjs > tabelle.md          */
import fs from 'node:fs';

const L = JSON.parse(fs.readFileSync('.design-sync/landkarte/landkarte.json', 'utf8'));
const app = fs.readFileSync('app.js', 'utf8');
const SP = [['spieler', 'Spieler'], ['kassenwart', 'Kassenwart'], ['trainer', 'Spielertrainer'], ['trainerkassenwart', 'Trainer + Kasse'], ['admin', 'Admin']];
const ja = (b) => (b ? 'ja' : '–');
const out = [];

// 1) Ansichten und Blaetter (Knoten der Landkarte)
const knoten = new Map();
for (const [k] of SP) for (const n of L.profile[k].knoten) {
  const key = n.schluessel.replace(/^[a-z]+\//, '');
  if (!knoten.has(key)) knoten.set(key, { name: n.name, strang: n.strang, in: new Set() });
  knoten.get(key).in.add(k);
}
out.push('### Ansichten und Blätter (aus der Landkarte)', '', '| Ansicht / Blatt | Strang | ' + SP.map((s) => s[1]).join(' | ') + ' |', '|---|---|' + SP.map(() => '---').join('|') + '|');
for (const [key, v] of [...knoten.entries()].sort((a, b) => (a[1].strang + a[1].name).localeCompare(b[1].strang + b[1].name, 'de')))
  out.push('| ' + v.name + ' | ' + v.strang + ' | ' + SP.map(([k]) => ja(v.in.has(k))).join(' | ') + ' |');

// 2) Knoepfe und Menueeintraege (Kanten der Landkarte, nach Text)
const kanten = new Map();
for (const [k] of SP) for (const e of L.profile[k].kanten) {
  const text = String(e.text || e.wert || '').replace(/\s+/g, ' ').trim();
  if (!text) continue;
  const key = text + '|' + e.art;
  if (!kanten.has(key)) kanten.set(key, { text, art: e.art, ziel: e.wert, in: new Set() });
  kanten.get(key).in.add(k);
}
out.push('', '### Knöpfe und Menüeinträge (aus der Landkarte)', '', '| Knopf / Eintrag | Art | ' + SP.map((s) => s[1]).join(' | ') + ' |', '|---|---|' + SP.map(() => '---').join('|') + '|');
for (const v of [...kanten.values()].sort((a, b) => a.text.localeCompare(b.text, 'de')))
  out.push('| ' + v.text.replace(/\|/g, '/') + ' | ' + v.art + ' | ' + SP.map(([k]) => ja(v.in.has(k))).join(' | ') + ' |');

// 3) So geht's: Fragen je Rolle (Logik wie sgFragenFuer, ohne Admin-Vorschau)
const SG = new Function(/\/\* SG-FRAGEN-ANFANG \*\/([\s\S]*?)\/\* SG-FRAGEN-ENDE \*\//.exec(app)[1] + '\nreturn SG_FRAGEN;')();
const HAT = { Spieler: { spieler: 1 }, Kassenwart: { spieler: 1, kassenwart: 1 }, 'Trainer (ohne Kader)': { trainer: 1 }, Spielertrainer: { spieler: 1, trainer: 1 }, Admin: { spieler: 1, trainer: 1, kassenwart: 1, admin: 1 } };
const SPALTEN = Object.keys(HAT);
out.push('', "### So geht's: Fragen je Rolle (aus app.js)", '', '| Frage | für | ' + SPALTEN.join(' | ') + ' |', '|---|---|' + SPALTEN.map(() => '---').join('|') + '|');
for (const f of SG) out.push('| ' + f.frage + ' | ' + f.fuer.join(', ') + ' | ' + SPALTEN.map((s) => ja(HAT[s].admin || f.fuer.some((x) => x === 'alle' || HAT[s][x]))).join(' | ') + ' |');

// 4) Einfuehrung: Seiten je Rolle (EF_RANG, erstes Mal, iPhone in Safari)
const rang = new Function(/const EF_RANG = (\{[\s\S]*?\});/.exec(app)[1].replace(/^/, 'return ') )();
const titel = {};
for (const m of app.matchAll(/^\s{4}([a-z_]+):\s+\{ titel: "([^"]+)"/gm)) titel[m[1]] = m[2];
titel.home = 'Auf den Home-Bildschirm'; titel.push = 'Mitteilungen erlauben';
const folge = { Spieler: 'spieler', Kassenwart: 'kassenwart', 'Trainer (ohne Kader)': 'trainer', Spielertrainer: 'spielertrainer', Admin: 'spielertrainer_kasse' };
const seiten = new Set(); for (const r of Object.values(rang)) r.forEach((s) => seiten.add(s)); seiten.add('home'); seiten.add('push');
out.push('', '### Einführung: Seiten je Rolle (aus app.js, erstes Mal, höchstens 6)', '', '| Seite | ' + SPALTEN.join(' | ') + ' |', '|---|' + SPALTEN.map(() => '---').join('|') + '|');
for (const s of seiten) out.push('| ' + (titel[s] || s) + ' (`' + s + '`) | ' + SPALTEN.map((sp) => {
  const r = rang[folge[sp]].slice(0, 4); return ja(s === 'home' || s === 'push' || r.indexOf(s) >= 0);
}).join(' | ') + ' |');
console.log(out.join('\n'));
