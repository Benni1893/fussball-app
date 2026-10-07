/* Findet und entfernt tote CSS-Klassen (Schritt 4 des Pakets "Final Alle Screens").
   Eine Klasse gilt als lebendig, wenn ihr Name irgendwo in app.js, index.html,
   db.js oder sw.js vorkommt, oder wenn sie aus einem Praefix und einem Wert
   zusammengesetzt wird, die beide im Quelltext stehen (z. B. "wf-" + "hero",
   "is-" + art). Tot sind nur Klassen, fuer die beides nicht zutrifft.
   Aufruf: node .design-sync/shots/totecss.mjs [--entfernen]
   Ohne Schalter nur die Liste; mit Schalter werden Selektorteile mit toten
   Klassen gestrichen und leere Regeln entfernt.                          */
import fs from 'node:fs';

const QUELLEN = ['app.js', 'index.html', 'db.js', 'sw.js'].map((f) => fs.readFileSync(f, 'utf8')).join('\n');
const CSS = fs.readFileSync('styles.css', 'utf8');
const literale = new Set([...QUELLEN.matchAll(/["'`]([a-z0-9-]{1,40})["'`]/g)].map((m) => m[1]));
// Werte, die in Vorlagen-Strings stehen (${...} wird separat betrachtet)
const woerter = new Set([...QUELLEN.matchAll(/[a-z0-9]+/g)].map((m) => m[0]));

function lebt(k) {
  if (QUELLEN.includes(k)) return true;
  // Praefix + Wert: "is-" + "gruen", "wf-" + "hero", "tk-kopf is-" + art ...
  const teile = k.split('-');
  for (let i = 1; i < teile.length; i++) {
    const praefix = teile.slice(0, i).join('-') + '-';
    const rest = teile.slice(i).join('-');
    if (QUELLEN.includes(praefix) && (literale.has(rest) || woerter.has(rest))) return true;
  }
  return false;
}

// --- CSS zerlegen (Kommentare, Strings, verschachtelte @-Bloecke) ---------
function zerlege(text, ab, bis) {
  const regeln = [];
  let i = ab, start = ab;
  while (i < bis) {
    const c = text[i];
    if (c === '/' && text[i + 1] === '*') { const e = text.indexOf('*/', i + 2); i = e < 0 ? bis : e + 2; continue; }
    if (c === '"' || c === "'") { const e = text.indexOf(c, i + 1); i = e < 0 ? bis : e + 1; continue; }
    if (c === '{') {
      let tiefe = 1, j = i + 1;
      while (j < bis && tiefe) {
        const d = text[j];
        if (d === '/' && text[j + 1] === '*') { const e = text.indexOf('*/', j + 2); j = e < 0 ? bis : e + 2; continue; }
        if (d === '"' || d === "'") { const e = text.indexOf(d, j + 1); j = e < 0 ? bis : e + 1; continue; }
        if (d === '{') tiefe++; else if (d === '}') tiefe--;
        j++;
      }
      const prelude = text.slice(start, i);
      regeln.push({ start, kopfStart: start, kopfEnde: i, ende: j, prelude, innen: [i + 1, j - 1] });
      i = j; start = j; continue;
    }
    if (c === ';' ) { i++; start = i; continue; }   // @import, @charset
    i++;
  }
  return regeln;
}
function teileSelektor(sel) {
  const teile = []; let tiefe = 0, akt = '';
  for (const ch of sel) {
    if (ch === '(') tiefe++; else if (ch === ')') tiefe--;
    if (ch === ',' && tiefe === 0) { teile.push(akt); akt = ''; } else akt += ch;
  }
  teile.push(akt);
  return teile;
}
const ohneKommentar = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');

const tote = new Set();
const alleKlassen = new Set();
function sammle(ab, bis) {
  for (const r of zerlege(CSS, ab, bis)) {
    const p = ohneKommentar(r.prelude).trim();
    if (p.startsWith('@media') || p.startsWith('@supports')) { sammle(r.innen[0], r.innen[1] + 1); continue; }
    if (p.startsWith('@')) continue;
    for (const k of p.match(/\.[A-Za-z_][\w-]*/g) || []) { const n = k.slice(1); alleKlassen.add(n); if (!lebt(n)) tote.add(n); }
  }
}
sammle(0, CSS.length);
const liste = [...tote].sort();
console.log(alleKlassen.size + ' Klassen im Stylesheet, ' + liste.length + ' tot:');
console.log(liste.join(' '));

if (process.argv.includes('--entfernen')) {
  // Von hinten nach vorn ersetzen, damit die Positionen stimmen.
  const ersetzungen = [];
  function plane(ab, bis) {
    for (const r of zerlege(CSS, ab, bis)) {
      const roh = r.prelude;
      const p = ohneKommentar(roh).trim();
      if (p.startsWith('@media') || p.startsWith('@supports')) { plane(r.innen[0], r.innen[1] + 1); continue; }
      if (p.startsWith('@') || !p) continue;
      const teile = teileSelektor(p);
      const bleiben = teile.filter((t) => !(t.match(/\.[A-Za-z_][\w-]*/g) || []).some((k) => tote.has(k.slice(1))));
      if (bleiben.length === teile.length) continue;
      // Kommentar vor dem Selektor (im prelude) bleibt erhalten.
      const kommentar = (roh.match(/^\s*(\/\*[\s\S]*?\*\/\s*)+/) || [''])[0];
      if (!bleiben.length) ersetzungen.push([r.start, r.ende, kommentar.trimEnd() ? kommentar : '']);
      else ersetzungen.push([r.start, r.kopfEnde, kommentar + bleiben.map((t) => t.trim()).join(', ') + ' ']);
    }
  }
  plane(0, CSS.length);
  ersetzungen.sort((a, b) => b[0] - a[0]);
  let neu = CSS;
  for (const [a, b, t] of ersetzungen) neu = neu.slice(0, a) + (t ? '\n' + t : '\n') + neu.slice(b);
  neu = neu.replace(/\n{3,}/g, '\n\n');
  fs.writeFileSync('styles.css', neu);
  console.log(ersetzungen.length + ' Regeln angepasst oder entfernt.');
}
