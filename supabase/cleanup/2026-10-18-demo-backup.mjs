// Startbereinigung 18.10.2026, Schritt 1: Sicherung der Gruppe A als JSON.
// Schreibt jede zu loeschende Zeile nach supabase/cleanup/backup-2026-10-18/
// (per .gitignore ausgeschlossen) und prueft die Zeilenzahlen gegen den Befund
// aus Phase 0. Liest nur, aendert nichts.
//
//   node supabase/cleanup/2026-10-18-demo-backup.mjs
//
// Verbindung aus SUPABASE_DB_URL in .env.local (nie ausgegeben). pg kommt aus
// C:/Users/Benjamin/fussball-app-db/werkzeug/node_modules.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire('C:/Users/Benjamin/fussball-app-db/werkzeug/package.json');
const pg = require('pg');

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ZIEL = path.join(REPO, 'supabase', 'cleanup', 'backup-2026-10-18');

// Gruppe A: alles, was geloescht oder geaendert wird, mit erwarteter Zeilenzahl
// (Befund 18.10.2026, Entscheidungen aus dem Nachtlauf-Auftrag)
const HEUTE = "(now() at time zone 'Europe/Berlin')::date";
const A = [
  ['fines',            'select * from public.fines order by id', 317],   // 316 im Befund + 1 am 18.10. 00:26 (Demo-Spieler)
  ['fine_status_log',  'select * from public.fine_status_log order by id', 291],
  ['players',          'select * from public.players order by id', 16],            // 15 geloescht, 1 umbenannt (alter Stand)
  ['player_status',    'select * from public.player_status order by player_id', 16], // 15 geloescht, 1 auf fit (alter Stand)
  ['rsvps',            'select * from public.rsvps order by id', 38],              // alle geloescht
  ['lineups',          'select * from public.lineups order by id', 11],            // 10 geloescht, Vorlage geleert (alter Stand)
  ['events',           `select * from public.events where quelle = 'manuell' and date < ${HEUTE} and starts_at < now() order by date`, 33],
  ['konto_protokoll',  "select * from public.konto_protokoll where aktion = 'zahlungsziel_nachgetragen' order by id", 1],
];

const url = (fs.readFileSync(path.join(REPO, '.env.local'), 'utf8').match(/^SUPABASE_DB_URL=(.+)$/m) || [])[1];
if (!url) { console.error('SUPABASE_DB_URL fehlt in .env.local'); process.exit(2); }
const c = new pg.Client({ connectionString: url.trim(), ssl: { rejectUnauthorized: false }, application_name: 'fn-cleanup-backup' });

fs.mkdirSync(ZIEL, { recursive: true });
let fehler = 0;
try {
  await c.connect();
  await c.query('begin isolation level repeatable read read only');   // eine Momentaufnahme fuer alle Tabellen
  const meta = { zeitpunkt: new Date().toISOString(), tabellen: {} };
  for (const [tab, sql, soll] of A) {
    const { rows } = await c.query(sql);
    fs.writeFileSync(path.join(ZIEL, tab + '.json'), JSON.stringify(rows, null, 1), 'utf8');
    const ok = rows.length === soll;
    if (!ok) fehler++;
    meta.tabellen[tab] = { zeilen: rows.length, erwartet: soll, ok };
    console.log((ok ? 'ok   ' : 'FEHL ') + tab.padEnd(16) + ' ' + rows.length + ' Zeilen (erwartet ' + soll + ')');
  }
  await c.query('commit');
  fs.writeFileSync(path.join(ZIEL, 'meta.json'), JSON.stringify(meta, null, 1), 'utf8');
} catch (e) {
  console.error('FEHLER: ' + String(e.message || e).split(url.trim()).join('<URL>'));
  fehler++;
} finally {
  try { await c.end(); } catch {}
}
console.log(fehler ? `--- ${fehler} Abweichung(en): Loeschen NICHT ausfuehren ---` : '--- Sicherung vollstaendig ---');
process.exit(fehler ? 1 : 0);
