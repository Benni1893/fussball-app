/* BFV-Sync: Parser in api/sync-bfv.js, ohne Netz und ohne Datenbank.
   Anlass (05.10.2026, Teilpaket BFV-Sync): die Freundschaftsspiele 2027 heissen
   im Feed "FC Fasanerie-Nord II-...", der Kalendername ist "FC Fasanerie-Nord 2";
   der Parser erkannte die eigene Mannschaft nicht (home leer, ganzer Titel als
   Gegner). Zieht den Parser-Abschnitt aus der Datei und prueft ihn an
   Beispiel-Feeds. Die Sync-Regel selbst (vergangen fehlt -> bleibt, kuenftig
   fehlt -> abgesagt) prueft supabase/checks/0044_bfv_pruef.sql mit echten Zeilen;
   hier nur, dass die Migration sie enthaelt.
   Aufruf: node .design-sync/shots/bfvpruef.mjs                               */
import fs from 'node:fs';

const fehler = [];
const pruefe = (ok, text, detail) => {
  console.log((ok ? '  ok   ' : '  FEHL ') + text + (detail !== undefined ? '   ' + detail : ''));
  if (!ok) fehler.push(text);
};

const quelle = fs.readFileSync('api/sync-bfv.js', 'utf8');
const von = quelle.indexOf('/* ---------- iCal-Parser');
const bis = quelle.indexOf('/* ---------- Handler');
if (von < 0 || bis < 0) { console.log('  FEHL Parser-Abschnitt in api/sync-bfv.js nicht gefunden'); process.exit(1); }
const { parseIcs, teamVarianten } =
  new Function(quelle.slice(von, bis) + '\nreturn { parseIcs, teamVarianten };')();

const feed = (calname, ereignisse) => [
  'BEGIN:VCALENDAR', 'VERSION:2.0', 'X-WR-CALNAME:' + calname,
  ...ereignisse.flatMap((e) => [
    'BEGIN:VEVENT',
    ...(e.uid ? ['UID:' + e.uid] : []),
    'DTSTART:' + (e.dt || '20261018T110000Z'),
    'SUMMARY:' + e.summary,
    'LOCATION:' + (e.location || 'Sportpark\\, Platz 2\\, Musterweg 1\\, 80000 München'),
    'END:VEVENT',
  ]),
  'END:VCALENDAR',
].join('\r\n');

console.log('--- Varianten des Teamnamens ---');
pruefe(JSON.stringify(teamVarianten('FC Fasanerie-Nord 2')) === JSON.stringify(['FC Fasanerie-Nord II', 'FC Fasanerie-Nord 2']),
  '"2" ergibt auch "II", längere zuerst', JSON.stringify(teamVarianten('FC Fasanerie-Nord 2')));
pruefe(JSON.stringify(teamVarianten('FC Fasanerie-Nord III')) === JSON.stringify(['FC Fasanerie-Nord III', 'FC Fasanerie-Nord 3']),
  '"III" ergibt auch "3"', JSON.stringify(teamVarianten('FC Fasanerie-Nord III')));
pruefe(JSON.stringify(teamVarianten('FC Fasanerie-Nord')) === JSON.stringify(['FC Fasanerie-Nord']),
  'ohne Nummer nur der Name selbst');

console.log('--- Spiele mit Kalendername "FC Fasanerie-Nord 2 (Herren)" ---');
const r = parseIcs(feed('FC Fasanerie-Nord 2 (Herren)', [
  { uid: 'a', summary: 'FC Fasanerie-Nord 2 - SC Grüne Heide 2, Meisterschaften, Kreisklasse 5' },
  { uid: 'b', summary: 'FC Teutonia Mün. 2 - FC Fasanerie-Nord 2, Meisterschaften, Kreisklasse 5' },
  { uid: 'c', summary: 'FC Fasanerie-Nord II-TSV Schwabhausen II, Freundschaftsspiele' },
  { uid: 'd', summary: 'ATSV Kirchseeon II-FC Fasanerie-Nord II, Freundschaftsspiele' },
  { uid: 'e', summary: 'FC Fasanerie-Nord III-TSV Irgendwo, Freundschaftsspiele' },
  { summary: 'ohne UID - FC Fasanerie-Nord 2, Meisterschaften' },
  { uid: 'f', dt: '20261122T130000Z', summary: 'FC Fasanerie-Nord 2 - FC Eintracht Mü. 2, Meisterschaften, Kreisklasse 5' },
]));
const m = Object.fromEntries(r.matches.map((x) => [x.bfv_uid, x]));
pruefe(r.ownTeam === 'FC Fasanerie-Nord 2', 'eigene Mannschaft aus dem Kalendernamen, ohne Klammerteil', r.ownTeam);
pruefe(r.matches.length === 6, 'Termin ohne UID wird übersprungen', r.matches.length);
pruefe(m.a.heim === true && m.a.gegner === 'SC Grüne Heide 2', 'Heimspiel arabisch', `${m.a.heim} / ${m.a.gegner}`);
pruefe(m.a.wettbewerb === 'Meisterschaften' && m.a.liga === 'Kreisklasse 5', 'Wettbewerb und Liga', `${m.a.wettbewerb} / ${m.a.liga}`);
pruefe(m.b.heim === false && m.b.gegner === 'FC Teutonia Mün. 2', 'Auswärtsspiel arabisch', `${m.b.heim} / ${m.b.gegner}`);
pruefe(m.c.heim === true && m.c.gegner === 'TSV Schwabhausen II', 'Heimspiel römisch, Bindestrich ohne Leerzeichen', `${m.c.heim} / ${m.c.gegner}`);
pruefe(m.d.heim === false && m.d.gegner === 'ATSV Kirchseeon II', 'Auswärtsspiel römisch', `${m.d.heim} / ${m.d.gegner}`);
pruefe(m.e.heim === null && m.e.gegner === 'FC Fasanerie-Nord III-TSV Irgendwo', '"III" ist eine andere Mannschaft, nicht erkannt', `${m.e.heim} / ${m.e.gegner}`);
pruefe(r.warnings.length === 1 && /Team nicht erkannt/.test(r.warnings[0]), 'genau eine Warnung (die III)', r.warnings.length);

console.log('--- Zeit und Ort ---');
pruefe(m.a.date === '2026-10-18' && m.a.time === '13:00', 'Sommerzeit: 11:00Z wird 13:00', `${m.a.date} ${m.a.time}`);
pruefe(m.f.date === '2026-11-22' && m.f.time === '14:00', 'Winterzeit: 13:00Z wird 14:00', `${m.f.date} ${m.f.time}`);
pruefe(m.a.spielstaette === 'Sportpark' && m.a.adresse === 'Platz 2, Musterweg 1, 80000 München', 'LOCATION aufgeteilt, Escapes aufgelöst', `${m.a.spielstaette} | ${m.a.adresse}`);
pruefe(m.a.location_raw === 'Sportpark, Platz 2, Musterweg 1, 80000 München', 'location_raw vollständig');
const schluessel = 'adresse,bfv_uid,date,gegner,heim,liga,location_raw,spielstaette,time,wettbewerb';
pruefe(Object.keys(m.a).sort().join(',') === schluessel, 'Felder wie sync_bfv_matches sie liest', Object.keys(m.a).sort().join(','));

console.log('--- Kalendername römisch ---');
const r2 = parseIcs(feed('FC Fasanerie-Nord II', [
  { uid: 'x', summary: 'FC Fasanerie-Nord 2 - SV Am Hart Mün., Meisterschaften' },
]));
pruefe(r2.matches[0].heim === true && r2.matches[0].gegner === 'SV Am Hart Mün.', 'Kalender "II", Spiel "2" wird erkannt',
  `${r2.matches[0].heim} / ${r2.matches[0].gegner}`);

console.log('--- Gefaltete Zeile ---');
const gefaltet = feed('FC Fasanerie-Nord 2', [{ uid: 'g', summary: 'FC Fasanerie-Nord 2 - TSV Moosach-Hartmanns' }])
  .replace('Hartmanns', 'Hartmanns\r\n hofen 2, Meisterschaften');
pruefe(parseIcs(gefaltet).matches[0].gegner === 'TSV Moosach-Hartmannshofen 2', 'Fortsetzungszeile wird angehängt',
  parseIcs(gefaltet).matches[0].gegner);

console.log('--- Sync-Regel in der Migration (Inhalt, nicht Wirkung) ---');
const mig = fs.readFileSync('supabase/migrations/0044_bfv_sync_absagen.sql', 'utf8');
const absage = (mig.match(/set status = 'abgesagt'[\s\S]*?get diagnostics/) || [''])[0];
pruefe(/not \(bfv_uid = any\(v_uids\)\)/.test(absage) && /\) > now\(\)/.test(absage),
  'Absage nur für fehlende UND künftige Termine');
pruefe(/if array_length\(v_uids, 1\) is not null/.test(mig), 'leerer Feed sagt nichts ab (Schutz bleibt)');

console.log(fehler.length === 0 ? '\n--- bestanden ---' : '\n--- NICHT bestanden: ' + fehler.length + ' ---');
process.exit(fehler.length === 0 ? 0 : 1);
