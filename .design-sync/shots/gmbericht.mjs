/* Tabellen für .design-sync/geraetematrix/ABSCHLUSS.md aus den Ergebnissen
   der Gerätematrix. Gleiche Befunde (Typ, Element, Text) werden über Breiten,
   Schriftgrößen und Zustände zusammengefasst; je Zeile ein Beispielbild.
   Aufruf: node .design-sync/shots/gmbericht.mjs <ordner> [> tabelle.md]
   (<ordner> enthält ergebnis-<variante>.json)                              */
import fs from 'node:fs';
import path from 'node:path';

const ordner = process.argv[2] || '.design-sync/geraetematrix';
const TYP = { ueberlauf: 'Waagerechter Überlauf', abgeschnitten: 'Text abgeschnitten', ueberlappung: 'Überlappung',
  treffer: 'Trefferfläche < 44 px', verdeckt: 'Verdeckt (Kopf, Nav, Safe Area)', umbruch: 'Umbruch in Wort/Betrag/Datum', fehler: 'Messfehler' };
const ENGINE = { 'chromium-inter': 'Chromium · Inter', 'chromium-roboto': 'Chromium · Roboto', 'webkit-inter': 'WebKit · Inter' };
const g = new Map();
let gesamt = 0;
for (const f of fs.readdirSync(ordner).filter((x) => /^ergebnis-.*\.json$/.test(x)).sort()) {
  const j = JSON.parse(fs.readFileSync(path.join(ordner, f), 'utf8'));
  for (const p of j.profile) for (const e of p.ergebnisse) {
    gesamt++;
    const el = e.el.replace(/#ev-[\w-]+/g, '').replace(/\.(ein-anim-rein|open|filled|on)\b/g, '');
    const txt = e.typ === 'treffer' || e.typ === 'ueberlauf' ? '' : (e.text || '').replace(/\d+/g, '#');
    const det = (e.detail || '').replace(/\(?\d+×\d+\)?,?/g, '').replace(/-?\d+\.\.-?\d+/, '').trim();
    const k = [e.typ, el, txt, det].join('|');
    if (!g.has(k)) g.set(k, { typ: e.typ, el, text: e.text, det, n: 0, b: new Set(), s: new Set(), v: new Set(), z: new Set(), bild: null });
    const x = g.get(k);
    x.n++; x.b.add(e.breite); x.s.add(e.schrift); x.v.add(j.variante); x.z.add(p.profil + ': ' + e.schluessel);
    if (!x.bild && e.bild) x.bild = e.bild;
  }
}
const esc = (s) => String(s || '').replace(/\|/g, '/').replace(/\n/g, ' ');
const kurz = (el) => el.split(' > ').slice(-2).join(' > ');
const zeilen = [...g.values()].sort((a, b) => a.typ.localeCompare(b.typ) || b.n - a.n);
console.log(`${gesamt} Einzelbefunde in ${zeilen.length} Gruppen.\n`);
console.log('| Befund | Ansicht | Breite | Engine | Schrift | Screenshot |');
console.log('|---|---|---|---|---|---|');
for (const x of zeilen) {
  const ansicht = [...x.z].slice(0, 3).join(', ') + (x.z.size > 3 ? ` (+${x.z.size - 3})` : '');
  const befund = `${TYP[x.typ] || x.typ}: \`${esc(kurz(x.el))}\`${x.text && x.typ !== 'treffer' ? ' „' + esc(x.text).slice(0, 40) + '“' : ''}${x.det ? ' · ' + esc(x.det) : ''}`;
  const breiten = [...x.b].sort((a, b) => a - b);
  console.log(`| ${befund} | ${esc(ansicht)} | ${breiten.length === 9 ? 'alle' : breiten.join(', ')} | ${[...x.v].map((v) => ENGINE[v] || v).join(', ')} | ${[...x.s].sort().join(', ')} % | ${x.bild ? '`' + x.bild.replace('.design-sync/geraetematrix/', '') + '`' : '-'} |`);
}
