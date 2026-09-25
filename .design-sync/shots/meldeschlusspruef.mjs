/* Meldeschluss: rechnen wirklich alle Verbraucher dieselbe Frist?
   Geprueft werden vier Behauptungen:
     1. Das Frontend rechnet gar nicht mehr, es reicht events.deadline_at durch.
     2. Die eine Rechnung in compute_deadline liefert fuer jeden Fall genau das,
        was die alte ausgeschriebene Regel geliefert haette.
     3. Die Rechnung ist sommerzeitfest, weil sie in STUNDEN rechnet und nicht
        in Tagen - bei timestamptz ist das der Unterschied zwischen absoluter
        und kalendarischer Arithmetik.
     4. apply_event_fines und rsvp_late_cancel_fine lesen die Spalte und haben
        keine eigene Fristrechnung mehr.
   Kein Browser, kein Testkonto, kein Netz.
   Aufruf: node .design-sync/shots/meldeschlusspruef.mjs                       */
import fs from 'node:fs';

const fehler = [];
const pruefe = (ok, text, detail) => {
  console.log((ok ? '  ok   ' : '  FEHL ') + text + (detail !== undefined ? '   ' + detail : ''));
  if (!ok) fehler.push(text);
};
const gleich = (ist, soll, text) => pruefe(
  JSON.stringify(ist) === JSON.stringify(soll), text,
  JSON.stringify(ist) === JSON.stringify(soll) ? undefined : 'erwartet ' + JSON.stringify(soll) + ', bekommen ' + JSON.stringify(ist));

/* ===== 1. Das Frontend reicht nur durch ================================= */
console.log('--- Frontend: meldeschlussMs woertlich aus app.js ---');
const appjs = fs.readFileSync('app.js', 'utf8');
const a = appjs.indexOf('  function meldeschlussMs(e) {');
const b = appjs.indexOf('\n  }', a) + 4;
if (a < 0) { console.error('meldeschlussMs nicht gefunden.'); process.exit(1); }
const meldeschlussMs = new Function(appjs.slice(a, b) + '\n return meldeschlussMs;')();

const ISO = '2027-03-20T10:30:00.000Z';
const MS  = Date.parse(ISO);
gleich(meldeschlussMs({ deadlineAt: ISO }), MS, 'gibt die Spalte zurueck');
// Der eigentliche Beweis: widerspruechliche Begleitdaten aendern nichts.
gleich(meldeschlussMs({ deadlineAt: ISO, typ: 'spiel',     startsAt: '2030-01-01T00:00:00Z' }), MS, 'ignoriert startsAt');
gleich(meldeschlussMs({ deadlineAt: ISO, typ: 'training',  startsAt: '2030-01-01T00:00:00Z' }), MS, 'ignoriert den Typ');
gleich(meldeschlussMs({ deadlineAt: ISO, typ: 'sonstiges' }), MS, 'auch bei sonstiges - der Filter sitzt in der DB');
gleich(meldeschlussMs({ deadlineAt: null, typ: 'spiel', startsAt: ISO }), null, 'ohne Spalte keine Frist, trotz Spiel mit Zeit');
gleich(meldeschlussMs({ typ: 'spiel', startsAt: ISO }), null, 'Feld fehlt ganz');
gleich(meldeschlussMs({ deadlineAt: 'kein Datum' }), null, 'unlesbarer Wert');
gleich(meldeschlussMs(null), null, 'kein Termin');
pruefe(!/24 \* 60 \* 60 \* 1000|\? 24 : 3/.test(appjs.slice(a, b)), 'keine Stundenrechnung mehr im Rumpf');

/* ===== 2. Die eine Rechnung gegen die alte Regel ======================== */
console.log('--- compute_deadline gegen die alte, ausgeschriebene Regel ---');
const STD = 3600000;
// Nachbau von compute_deadline (0033) in JS.
const neu = (typ, startsAt, override, einst) => {
  if (typ !== 'spiel' && typ !== 'training') return null;
  if (!startsAt) return null;
  const std = override != null ? override : (typ === 'spiel' ? einst.spiel : einst.training);
  return Date.parse(startsAt) - std * STD;
};
// Nachbau der alten Regel - inklusive des Typfilters, der ihr voranstand.
const alt = (typ, startsAt) => {
  if (typ !== 'spiel' && typ !== 'training') return null;   // 0008 Z. 73, 0009 Z. 34, 0010 Z. 27 und 86
  if (!startsAt) return null;
  return Date.parse(startsAt) - (typ === 'spiel' ? 24 : 3) * STD;
};
const EINST = { spiel: 24, training: 3 };   // die Vorgabewerte aus team_settings

const faelle = [
  ['spiel  mit Zeit',        'spiel',     '2027-03-21T11:30:00Z'],
  ['training mit Zeit',      'training',  '2027-03-22T18:30:00Z'],
  ['spiel  ohne Zeit',       'spiel',     null],
  ['training ohne Zeit',     'training',  null],
  ['sonstiges mit Zeit',     'sonstiges', '2027-04-03T17:00:00Z'],
  ['sonstiges ohne Zeit',    'sonstiges', null],
  ['unbekannter Typ',        'turnier',   '2027-04-03T17:00:00Z'],
];
for (const [name, typ, s] of faelle) {
  gleich(neu(typ, s, null, EINST), alt(typ, s), name);
}

console.log('--- Ausnahme je Termin ---');
gleich(neu('training', '2027-03-22T18:30:00Z', 12, EINST),
       Date.parse('2027-03-22T18:30:00Z') - 12 * STD, 'override 12 h sticht den Standard');
gleich(neu('spiel', '2027-03-21T11:30:00Z', 0, EINST),
       Date.parse('2027-03-21T11:30:00Z'), 'override 0 h = Frist bei Anpfiff');
pruefe(neu('sonstiges', '2027-04-03T17:00:00Z', 5, EINST) === null,
       'override zieht bei sonstiges NICHT - der Typfilter kommt zuerst');

console.log('--- geaenderte Teameinstellung ---');
gleich(neu('training', '2027-03-22T18:30:00Z', null, { spiel: 24, training: 4 }),
       Date.parse('2027-03-22T18:30:00Z') - 4 * STD, 'Training auf 4 h wirkt');
gleich(neu('spiel', '2027-03-21T11:30:00Z', null, { spiel: 24, training: 4 }),
       alt('spiel', '2027-03-21T11:30:00Z'), 'Spiel bleibt davon unberuehrt');

/* ===== 3. Sommerzeit ==================================================== */
console.log('--- Sommerzeit Europe/Berlin ---');
// 2027: Umstellung auf Sommerzeit am 28.03. (02:00 -> 03:00 MEZ->MESZ),
//       zurueck am 31.10. (03:00 -> 02:00).
const berlin = (iso) => new Date(iso).toLocaleString('de-DE', { timeZone: 'Europe/Berlin', hour12: false });
const ueber = [
  ['Spiel am Tag NACH der Vorstellung', 'spiel',    '2027-03-28T09:30:00Z', 24],
  ['Training in der Nacht der Vorstellung', 'training', '2027-03-28T01:30:00Z', 3],
  ['Spiel am Tag der Rueckstellung',    'spiel',    '2027-10-31T10:30:00Z', 24],
];
for (const [name, typ, s, std] of ueber) {
  const d = neu(typ, s, null, EINST);
  const echteStunden = (Date.parse(s) - d) / STD;
  pruefe(echteStunden === std, name, echteStunden + ' echte Stunden vorher · Anpfiff ' + berlin(s) + ' · Frist ' + berlin(new Date(d).toISOString()));
}
console.log('  Hinweis: die Ortszeit-Differenz darf dabei abweichen - gezaehlt werden echte Stunden.');

/* ===== 4. Die SQL-Verbraucher lesen die Spalte ========================== */
console.log('--- SQL: apply_event_fines und rsvp_late_cancel_fine ---');
const sql = fs.readFileSync('supabase/migrations/0033_meldeschluss.sql', 'utf8');
const rumpf = (name) => {
  const von = sql.indexOf('create or replace function public.' + name);
  if (von < 0) return '';
  const bis = sql.indexOf('\n$$;', von);
  return sql.slice(von, bis);
};
for (const fn of ['apply_event_fines', 'rsvp_late_cancel_fine']) {
  const r = rumpf(fn);
  pruefe(r.length > 0, fn + ' in 0033 neu angelegt');
  pruefe(/deadline_at/.test(r), fn + ' liest deadline_at');
  pruefe(!/interval '24 hours'|interval '3 hours'/.test(r), fn + ' rechnet die Frist NICHT mehr selbst');
}
const cd = rumpf('compute_deadline');
pruefe(/interval '1 hour'/.test(cd), 'compute_deadline rechnet in Stunden');
pruefe(!/interval '1 day'/.test(cd),
  "compute_deadline rechnet NICHT in Tagen - bei timestamptz waere das kalendarisch und ueber die Zeitumstellung eine Stunde daneben");

console.log(fehler.length === 0 ? '\n--- bestanden ---' : '\n--- NICHT bestanden: ' + fehler.length + ' ---');
process.exit(fehler.length === 0 ? 0 : 1);
