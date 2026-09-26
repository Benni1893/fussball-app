/* Deep-Link-Router: deepLinkZiel() woertlich aus app.js gezogen und mit Stubs
   gefahren. Kein Browser, kein Testkonto. Muster wie abopruef.mjs.
   Aufruf: node .design-sync/shots/deeplinkpruef.mjs                          */
import fs from 'node:fs';

const quelle = fs.readFileSync('app.js', 'utf8');
const a = quelle.indexOf('  const DEEP_ANSICHTEN =');
const b = quelle.indexOf('  // Hash wegraeumen', a);
if (a < 0 || b < 0) { console.error('Router nicht gefunden.'); process.exit(1); }
const code = quelle.slice(a, b);

const bauen = (rollen) => new Function('Roles', code + '\n return { deepLinkZiel, deepErlaubt, DEEP_ANSICHTEN };')({
  canManageEvents: () => rollen.includes('coach') || rollen.includes('admin'),
  canManageFines:  () => rollen.includes('treasurer') || rollen.includes('admin'),
  isAdmin:         () => rollen.includes('admin'),
});

const fehler = [];
let geprueft = 0;
const pruefe = (ist, soll, text) => {
  geprueft++;
  const ok = JSON.stringify(ist) === JSON.stringify(soll);
  console.log((ok ? '  ok   ' : '  FEHL ') + text + (ok ? '' : '\n         erwartet ' + JSON.stringify(soll) + ', bekommen ' + JSON.stringify(ist)));
  if (!ok) fehler.push(text);
};

const f = bauen(['player']).deepLinkZiel;

console.log('--- gueltige Ziele ---');
pruefe(f('#ansicht=kalender'), { art: 'ansicht', wert: 'kalender' }, 'ansicht=kalender');
pruefe(f('ansicht=strafen'),   { art: 'ansicht', wert: 'strafen' },  'ohne Raute');
pruefe(f('#termin=abc-123'),   { art: 'termin',  wert: 'abc-123' },  'termin=<id>');
pruefe(f('#strafen=meine'),    { art: 'strafen', wert: 'meine' },    'strafen=meine');
pruefe(f('#kasse=pruefen'),    { art: 'kasse',   wert: 'pruefen' },  'kasse=pruefen');
pruefe(f('#lineup=xyz'),       { art: 'lineup',  wert: 'xyz' },      'lineup bleibt bestehen');
pruefe(f('#strafe=katalog'),      { art: 'strafe',  wert: 'katalog' },     'strafe=katalog');
pruefe(f('#strafe=individuell'),  { art: 'strafe',  wert: 'individuell' }, 'strafe=individuell');
pruefe(f('#termin=' + encodeURIComponent('a b/c')), { art: 'termin', wert: 'a b/c' }, 'prozentkodierter Wert');

console.log('--- ungueltige Ziele landen still auf null ---');
for (const [h, t] of [
  ['', 'leerer Hash'], ['#', 'nur Raute'], ['#kalender', 'ohne Gleichheitszeichen'],
  ['#=kalender', 'ohne Art'], ['#ansicht=', 'ohne Wert'],
  ['#ansicht=geheim', 'unbekannte Ansicht'], ['#strafen=alles', 'unbekannter Filter'],
  ['#kasse=irgendwas', 'unbekannter Reiter'], ['#quatsch=1', 'unbekannte Art'],
  ['#strafe=indiv', 'der interne Name ist kein gueltiger Link'],
  ['#strafe=', 'ohne Weg'],
  ['#ansicht=kalender&x=1', 'Anhaengsel macht den Wert unbekannt'],
]) pruefe(f(h), null, t);
pruefe(f(null), null, 'null');
pruefe(f(undefined), null, 'undefined');

console.log('--- Rollenpruefung ---');
{
  const spieler = bauen(['player']).deepErlaubt;
  const trainer = bauen(['coach']).deepErlaubt;
  const kasse   = bauen(['treasurer']).deepErlaubt;
  const admin   = bauen(['admin']).deepErlaubt;
  pruefe(spieler('kalender'), true,  'Spieler darf Kalender');
  pruefe(spieler('strafen'),  true,  'Spieler darf Strafen-Konto');
  pruefe(spieler('kasse'),    false, 'Spieler darf NICHT Kasse');
  pruefe(spieler('kader'),    false, 'Spieler darf NICHT Kader');
  pruefe(spieler('admin'),    false, 'Spieler darf NICHT Admin');
  pruefe(trainer('kader'),    true,  'Trainer darf Kader');
  pruefe(trainer('kasse'),    false, 'Trainer darf NICHT Kasse');
  pruefe(kasse('kasse'),      true,  'Kassenwart darf Kasse');
  pruefe(kasse('admin'),      false, 'Kassenwart darf NICHT Admin');
  pruefe(admin('kasse'),      true,  'Admin darf Kasse');
  pruefe(admin('kader'),      true,  'Admin darf Kader');
  pruefe(admin('geheim'),     false, 'unbekannte Ansicht nie');
}

console.log(fehler.length === 0 ? '\n--- bestanden (' + geprueft + ' Faelle) ---' : '\n--- NICHT bestanden: ' + fehler.length + ' ---');
process.exit(fehler.length === 0 ? 0 : 1);
