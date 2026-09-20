/* Vergleicht fuer jeden Stub-Termin den VEVENT-Block aus dem Abo-Feed mit dem
   aus der Einzeldatei - zeichenweise. Beide muessen identisch sein, sonst legt
   der Kalender beim Speichern einen zweiten Eintrag an, statt den abonnierten
   zu treffen.
   Prueft ausserdem die Unterschiede, die gewollt sind (VCALENDAR-Kopf,
   Kopfzeilen) und die Zugriffssperre.
   Aufruf: node .design-sync/shots/icspruef.mjs                               */
import { renderFunction, TOKEN, EVENTS } from './icsstub.mjs';

const fehler = [];
const pruefe = (bedingung, text, detail) => {
  console.log((bedingung ? '  ok   ' : '  FEHL ') + text + (detail ? '   ' + detail : ''));
  if (!bedingung) fehler.push(text);
};
const vevent = (ics, id) => {
  const marke = 'UID:evt-' + id + '@';
  const bloecke = ics.split('BEGIN:VEVENT').slice(1).map((b) => 'BEGIN:VEVENT' + b.split('END:VEVENT')[0] + 'END:VEVENT');
  return bloecke.find((b) => b.includes(marke)) || null;
};

/* ---- 1. Feed einmal rendern ------------------------------------------- */
const feed = await renderFunction('../../api/calendar.js', { token: TOKEN });
if (feed.status !== 200) { console.error('Feed liefert ' + feed.status); process.exit(1); }

/* ---- 2. Je Termin die Einzeldatei rendern und vergleichen -------------- */
console.log('--- VEVENT-Block: Feed gegen Einzeldatei ---');
for (const e of EVENTS) {
  const einzel = await renderFunction('../../api/event.js', { token: TOKEN, id: e.id });
  const a = vevent(feed.body, e.id);
  const b = vevent(einzel.body, e.id);
  if (!a || !b) { pruefe(false, e.id + ': Block gefunden', (a ? '' : 'Feed fehlt ') + (b ? '' : 'Einzel fehlt')); continue; }
  let stelle = -1;
  for (let i = 0; i < Math.max(a.length, b.length); i++) { if (a[i] !== b[i]) { stelle = i; break; } }
  pruefe(stelle === -1 && a.length === b.length,
    e.id.padEnd(3) + ' zeichengleich (' + a.length + ' Zeichen)',
    stelle === -1 ? '' : 'erste Abweichung bei ' + stelle + ': ' + JSON.stringify(a.slice(stelle, stelle + 24)) + ' / ' + JSON.stringify(b.slice(stelle, stelle + 24)));
  // UID und Zeiten zusaetzlich einzeln nennen, damit der Bericht sie zeigt.
  const zeile = (blk, feld) => (blk.split('\r\n').find((l) => l.startsWith(feld)) || '—');
  if (stelle === -1) console.log('       ' + zeile(a, 'UID:') + '  ' + zeile(a, 'DTSTART') + '  ' + zeile(a, 'SEQUENCE:'));
}

/* ---- 3. Gewollte Unterschiede ----------------------------------------- */
console.log('--- Gewollte Unterschiede im VCALENDAR-Kopf ---');
const einzel1 = await renderFunction('../../api/event.js', { token: TOKEN, id: EVENTS[0].id });
pruefe(feed.body.includes('X-WR-CALNAME:'), 'Feed traegt X-WR-CALNAME');
pruefe(!einzel1.body.includes('X-WR-CALNAME'), 'Einzeldatei traegt KEIN X-WR-CALNAME');
pruefe(einzel1.body.includes('\r\nMETHOD:PUBLISH\r\n'), 'Einzeldatei traegt METHOD:PUBLISH');
pruefe((einzel1.body.match(/BEGIN:VEVENT/g) || []).length === 1, 'Einzeldatei enthaelt genau einen VEVENT');
pruefe(/^text\/calendar/.test(einzel1.kopf['Content-Type'] || ''), 'Content-Type text/calendar', einzel1.kopf['Content-Type']);
const cd = einzel1.kopf['Content-Disposition'] || '';
pruefe(cd.startsWith('attachment;'), 'Content-Disposition attachment', cd);
// eslint-disable-next-line no-control-regex
pruefe(/^[\x20-\x7e]*$/.test(cd), 'Dateiname rein ASCII');
pruefe(feed.kopf['Content-Disposition'].startsWith('inline;'), 'Feed bleibt inline', feed.kopf['Content-Disposition']);

console.log('--- Dateinamen ---');
for (const e of EVENTS) {
  const r = await renderFunction('../../api/event.js', { token: TOKEN, id: e.id });
  console.log('  ' + e.id + '  ' + (r.kopf['Content-Disposition'] || ''));
}

/* ---- 4. Zugriffssperre ------------------------------------------------- */
console.log('--- Zugriff ---');
const fremd = await renderFunction('../../api/event.js', { token: TOKEN, id: 'fremd1' });
pruefe(fremd.status === 404, 'unbekannte Termin-ID -> 404', 'Status ' + fremd.status);
const falscherToken = await renderFunction('../../api/event.js', { token: 'b'.repeat(32), id: EVENTS[0].id });
pruefe(falscherToken.status === 404, 'unbekannter Token -> 404', 'Status ' + falscherToken.status);
const kurzerToken = await renderFunction('../../api/event.js', { token: 'xyz', id: EVENTS[0].id });
pruefe(kurzerToken.status === 404, 'ungueltiger Token -> 404', 'Status ' + kurzerToken.status);
const boeseId = await renderFunction('../../api/event.js', { token: TOKEN, id: 'e1&club_id=neq.x' });
pruefe(boeseId.status === 404, 'ID mit Sonderzeichen -> 404', 'Status ' + boeseId.status);

console.log(fehler.length === 0 ? '\n--- bestanden ---' : '\n--- NICHT bestanden: ' + fehler.length + ' ---');
process.exit(fehler.length === 0 ? 0 : 1);
