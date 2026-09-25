/* Anzeige-Logik des Abo-Hinweises. Die Entscheidungsfunktionen werden
   woertlich aus app.js gezogen und mit Stubs gefahren - kein Browser, kein
   Testkonto, kein Netz. Dasselbe Muster wie icspruef.mjs.
   Aufruf: node .design-sync/shots/abopruef.mjs                              */
import fs from 'node:fs';

const quelle = fs.readFileSync('app.js', 'utf8');
const schnitt = (von, bis) => {
  const a = quelle.indexOf(von);
  const b = quelle.indexOf(bis, a);
  if (a < 0 || b < 0) throw new Error('Nicht gefunden: ' + von);
  return quelle.slice(a, b);
};

/* hatEigeneRueckmeldung() und aboHinweisPlatz() am Stueck */
const code = schnitt('  function hatEigeneRueckmeldung() {', '  // Serverseitig merken.');
const bauen = (state) => new Function('state', code + '\n return { hatEigeneRueckmeldung, aboHinweisPlatz };')(state);

const fehler = [];
const pruefe = (ist, soll, text) => {
  const ok = JSON.stringify(ist) === JSON.stringify(soll);
  console.log((ok ? '  ok   ' : '  FEHL ') + text + (ok ? '' : '\n         erwartet ' + JSON.stringify(soll) + ', bekommen ' + JSON.stringify(ist)));
  if (!ok) fehler.push(text);
};

const LEER   = {};                                                   // frisches Profil
const WEG    = { calendar_hint_dismissed_at: '2026-09-25T10:00:00Z' };
const ABO    = { calendar_subscribe_started_at: '2026-09-25T10:00:00Z' };
const BEIDES = Object.assign({}, WEG, ABO);
const LISTE  = { ort: 'liste', eventId: null };
const KARTE  = { ort: 'karte', eventId: 'e1' };

/* ---- 1. hatEigeneRueckmeldung: nur eigene Zeilen zaehlen ---------------- */
console.log('--- eigene Rueckmeldung erkennen ---');
{
  const f = (rsvp, pid) => bauen({ currentPlayerId: pid, rsvp }).hatEigeneRueckmeldung();
  pruefe(f({}, 'p1'), false, 'gar keine Rueckmeldung');
  pruefe(f({ 'e1|p1': { status: 'zu' } }, 'p1'), true, 'eigene Zusage');
  pruefe(f({ 'e1|p1': { status: 'ab' } }, 'p1'), true, 'eigene Absage zaehlt auch');
  pruefe(f({ 'e1|p2': { status: 'zu' } }, 'p1'), false, 'fremde Zusage zaehlt nicht (coach sieht sie)');
  pruefe(f({ 'e1|p2': { status: 'zu' }, 'e2|p1': { status: 'ab' } }, 'p1'), true, 'eigene neben fremden');
  pruefe(f({ 'e1|p1': {} }, 'p1'), false, 'Zeile ohne Status zaehlt nicht');
  pruefe(f({ 'e1|p1': { status: 'zu' } }, null), false, 'ohne Spielerverknuepfung nie');
  // Spieler-IDs sind UUIDs; der Schluessel wird am ersten | getrennt.
  pruefe(f({ '11111111-1111-1111-1111-111111111111|22222222-2222-2222-2222-222222222222': { status: 'zu' } },
            '22222222-2222-2222-2222-222222222222'), true, 'UUID-Schluessel');
}

/* ---- 2. aboHinweisPlatz: die vier geforderten Zustaende ----------------- */
console.log('--- Anzeige-Logik ---');
{
  const f = bauen({ currentPlayerId: 'p1', rsvp: {} }).aboHinweisPlatz;
  pruefe(f(LEER,   false, null), null,  'vor der ersten Rueckmeldung: nichts');
  pruefe(f(LEER,   true,  null), LISTE, 'nach der ersten Rueckmeldung: ueber der Liste');
  pruefe(f(LEER,   true,  KARTE), KARTE, 'Rueckmeldung in dieser Sitzung: unter der Karte');
  pruefe(f(WEG,    true,  null), null,  'nach X: nichts mehr');
  pruefe(f(ABO,    true,  null), null,  'nach Abo-Start: nichts mehr');
  pruefe(f(BEIDES, true,  KARTE), null, 'X und Abo: nichts, auch mit Sitzungsplatz');
  pruefe(f(LEER,   true,  false), null, 'in dieser Sitzung erledigt: nichts mehr');
  pruefe(f(LEER,   false, KARTE), KARTE, 'Sitzungsplatz gilt auch ohne geladene Rueckmeldung');
  pruefe(f(null,   true,  null), null,  'ohne Profil: nichts');
  pruefe(f(WEG,    false, null), null,  'X ohne Rueckmeldung: erst recht nichts');
}

/* ---- 3. Der Platz bleibt, wo er ist ------------------------------------ */
console.log('--- Platz bleibt stehen ---');
{
  const f = bauen({ currentPlayerId: 'p1', rsvp: {} }).aboHinweisPlatz;
  const erst = f(LEER, true, { ort: 'karte', eventId: 'e1' });
  const dann = f(LEER, true, { ort: 'karte', eventId: 'e1' });   // zweite Rueckmeldung, Latch unveraendert
  pruefe(erst, dann, 'zweites Ja verschiebt den Hinweis nicht');
}

console.log(fehler.length === 0 ? '\n--- bestanden (' + 19 + ' Faelle) ---' : '\n--- NICHT bestanden: ' + fehler.length + ' ---');
process.exit(fehler.length === 0 ? 0 : 1);
