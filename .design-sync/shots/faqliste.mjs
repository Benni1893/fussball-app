/* Schreibt die Fragen und Antworten von "So geht's" als Liste nach
   .design-sync/concepts/einfuehrung/FAQ.md. Quelle ist allein der Block
   SG-FRAGEN in app.js, damit App und Liste nicht auseinanderlaufen.
   Aufruf:  node .design-sync/shots/faqliste.mjs [--pruefen]
   --pruefen: schreibt nichts, meldet nur, ob FAQ.md zum Code passt.       */
import fs from 'node:fs';

const ZIEL = '.design-sync/concepts/einfuehrung/FAQ.md';
const app = fs.readFileSync('app.js', 'utf8');
const m = /\/\* SG-FRAGEN-ANFANG \*\/([\s\S]*?)\/\* SG-FRAGEN-ENDE \*\//.exec(app);
if (!m) { console.error('Block SG-FRAGEN nicht gefunden'); process.exit(1); }
const SG_FRAGEN = new Function(m[1] + '\nreturn SG_FRAGEN;')();

const ROLLE = { alle: 'alle', spieler: 'Spieler mit Kadereintrag', trainer: 'Trainer', kassenwart: 'Kassenwart' };
const zeilen = [
  "# So geht's: Fragen und Antworten",
  '',
  "Erzeugt aus `app.js` (Block `SG-FRAGEN`) mit `node .design-sync/shots/faqliste.mjs`. Nicht von Hand ändern.",
  '',
  'In der App: Einstellungen › Info › So geht\'s (`#ein=sogehts`).',
  '',
  'Sichtbarkeit:',
  '- Jede Frage erscheint nur für die genannten Rollen. Admin sieht alle.',
  '- Links öffnen die genannte Stelle in der App.',
  '- Am Ende steht „Frage nicht dabei?“ mit teamkabine-app@gmx.de.',
  '',
];
SG_FRAGEN.forEach((f, i) => {
  zeilen.push('## ' + (i + 1) + '. ' + f.frage, '');
  zeilen.push('Für: ' + f.fuer.map((x) => ROLLE[x] || x).join(', '), '');
  f.schritte.forEach((s, j) => zeilen.push((j + 1) + '. ' + s));
  zeilen.push('');
  if (f.hinweis) zeilen.push('Hinweis: ' + f.hinweis, '');
  if (f.links && f.links.length) {
    zeilen.push('Links:');
    f.links.forEach((l) => zeilen.push('- ' + l[0] + ' (`' + l[1] + '`' + (l[2] ? ', nur ' + (ROLLE[l[2]] || l[2]) : '') + ')'));
    zeilen.push('');
  }
});
const text = zeilen.join('\n');
if (process.argv.includes('--pruefen')) {
  const ist = fs.existsSync(ZIEL) ? fs.readFileSync(ZIEL, 'utf8').replace(/\r\n/g, '\n') : '';
  if (ist !== text) { console.error('FAQ.md passt nicht zu app.js - neu erzeugen.'); process.exit(1); }
  console.log('FAQ.md passt zu app.js (' + SG_FRAGEN.length + ' Fragen).');
} else {
  fs.writeFileSync(ZIEL, text);
  console.log(ZIEL + ': ' + SG_FRAGEN.length + ' Fragen');
}
