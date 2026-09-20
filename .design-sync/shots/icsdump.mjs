/* Rendert den Abo-Feed mit dem festen Stub-Datensatz in eine Datei.
   Dient als Vorher/Nachher-Beleg bei Umbauten an der Function.
   Aufruf: node .design-sync/shots/icsdump.mjs <zieldatei>                    */
import fs from 'node:fs';
import { renderFunction, TOKEN, EVENTS } from './icsstub.mjs';

const ziel = process.argv[2];
if (!ziel) { console.error('Zieldatei fehlt.'); process.exit(1); }

const r = await renderFunction('../../api/calendar.js', { token: TOKEN });
if (r.status !== 200) { console.error('Status ' + r.status + ' statt 200.'); process.exit(1); }
fs.writeFileSync(ziel, r.body, 'utf8');

const n = (r.body.match(/BEGIN:VEVENT/g) || []).length;
console.log(ziel);
console.log('  Status      ' + r.status);
console.log('  Bytes       ' + Buffer.byteLength(r.body, 'utf8'));
console.log('  VEVENTs     ' + n + ' von ' + EVENTS.length + ' Stub-Terminen');
console.log('  GEO         ' + (r.body.match(/\r\nGEO:/g) || []).length);
console.log('  ganztaegig  ' + (r.body.match(/DTSTART;VALUE=DATE:/g) || []).length);
console.log('  CANCELLED   ' + (r.body.match(/STATUS:CANCELLED/g) || []).length);
console.log('  gefaltet    ' + (r.body.match(/\r\n /g) || []).length + ' Folgezeilen');
console.log('  Kopf        ' + JSON.stringify(r.kopf));
