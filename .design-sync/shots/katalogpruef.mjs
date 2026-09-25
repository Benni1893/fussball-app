/* Push-Katalog. Zwei Teile:
     1. Das Rendern im Frontend (katRender aus app.js), gegen dieselbe Matrix,
        die render_vorlage() in der Datenbank abdecken muss.
     2. Die Zusicherungen, die nur die Datenbank geben kann - dass "An mich
        senden" niemanden ausser den Aufrufer erreicht und dass ein
        Nicht-Admin weder lesen noch aendern noch senden darf. Die werden
        statisch am Migrationstext geprueft, weil hier keine Datenbank laeuft;
        was damit NICHT bewiesen ist, steht unten im Bericht.
   Aufruf: node .design-sync/shots/katalogpruef.mjs                          */
import fs from 'node:fs';

const fehler = [];
const pruefe = (ok, text, detail) => {
  console.log((ok ? '  ok   ' : '  FEHL ') + text + (detail !== undefined ? '   ' + detail : ''));
  if (!ok) fehler.push(text);
};
const gleich = (ist, soll, text) => pruefe(
  JSON.stringify(ist) === JSON.stringify(soll), text,
  JSON.stringify(ist) === JSON.stringify(soll) ? undefined : 'erwartet ' + JSON.stringify(soll) + ', bekommen ' + JSON.stringify(ist));

const app = fs.readFileSync('app.js', 'utf8');
const a = app.indexOf('  function katRender(vorlage, daten, erlaubt) {');
const b = app.indexOf('\n  }', app.indexOf('return { text: out };', a)) + 4;
if (a < 0) { console.error('katRender nicht gefunden.'); process.exit(1); }
const katRender = new Function(app.slice(a, b) + '\n return katRender;')();

const ERL = ['betrag', 'grund', 'datum', 'namen', 'anzahl'];

/* ===== 1. Jeder Platzhalter ============================================ */
console.log('--- Platzhalter ersetzen ---');
gleich(katRender('Neue Strafe: {betrag}', { betrag: '8,00 €' }, ERL),
  { text: 'Neue Strafe: 8,00 €' }, 'einer');
gleich(katRender('{grund}, {datum}', { grund: 'Verspätete Rückmeldung', datum: '20.09.2026' }, ERL),
  { text: 'Verspätete Rückmeldung, 20.09.2026' }, 'zwei');
gleich(katRender('{anzahl}x {betrag} von {namen} am {datum} wegen {grund}',
  { anzahl: '3', betrag: '24,00 €', namen: 'Max Bauer', datum: '20.09.', grund: 'Absage' }, ERL),
  { text: '3x 24,00 € von Max Bauer am 20.09. wegen Absage' }, 'fünf');
gleich(katRender('{betrag} und nochmal {betrag}', { betrag: '8,00 €' }, ERL),
  { text: '8,00 € und nochmal 8,00 €' }, 'derselbe zweimal');
gleich(katRender('Ohne Platzhalter', {}, ERL), { text: 'Ohne Platzhalter' }, 'gar keiner');
gleich(katRender('', {}, ERL), { text: '' }, 'leere Vorlage');
gleich(katRender(null, {}, ERL), { text: '' }, 'null');

/* ===== 2. Fehlender Wert =============================================== */
console.log('--- Fehlender Wert: nicht senden ---');
pruefe(!!katRender('Neue Strafe: {betrag}', {}, ERL).fehler, 'Wert fehlt ganz');
pruefe(!!katRender('Neue Strafe: {betrag}', { betrag: '' }, ERL).fehler, 'Wert leer');
pruefe(!!katRender('Neue Strafe: {betrag}', { betrag: '   ' }, ERL).fehler, 'Wert nur Leerzeichen');
pruefe(!!katRender('Neue Strafe: {betrag}', { betrag: null }, ERL).fehler, 'Wert null');
pruefe(katRender('{grund}, {datum}', { grund: 'Absage' }, ERL).fehler.indexOf('{datum}') > 0,
  'Fehlermeldung nennt den fehlenden Platzhalter');
pruefe(katRender('Neue Strafe: {betrag}', {}, ERL).text === undefined,
  'im Fehlerfall KEIN halb ersetzter Text - sonst stünde {betrag} auf dem Sperrbildschirm');

/* ===== 3. Unbekannter Platzhalter ====================================== */
console.log('--- Unbekannter Platzhalter ---');
pruefe(!!katRender('Summe {summe}', { summe: '8,00 €' }, ERL).fehler,
  'nicht in der Liste, obwohl ein Wert da ist');
pruefe(katRender('Summe {summe}', { summe: '8' }, ERL).fehler.indexOf('{summe}') > 0,
  'Fehlermeldung nennt ihn');
gleich(katRender('Summe {summe}', { summe: '8,00 €' }, []),
  { text: 'Summe 8,00 €' }, 'leere Erlaubnisliste prüft nicht (test-Kategorie)');

/* ===== 4. Sonderzeichen ================================================ */
console.log('--- Sonderzeichen ---');
gleich(katRender('{betrag}', { betrag: '128,50 €' }, ERL), { text: '128,50 €' }, 'Euro');
gleich(katRender('{grund}', { grund: 'Verspätete Rückmeldung über Ostern' }, ERL),
  { text: 'Verspätete Rückmeldung über Ostern' }, 'Umlaute');
gleich(katRender('{grund}', { grund: 'Grund: „zu spät"' }, ERL),
  { text: 'Grund: „zu spät"' }, 'deutsche Anführungszeichen');
gleich(katRender('{grund}', { grund: 'Er sagte "nein" & ging' }, ERL),
  { text: 'Er sagte "nein" & ging' }, 'gerade Anführungszeichen und kaufmännisches Und');
gleich(katRender('{namen}', { namen: "O'Brien, Müller-Lüdenscheidt" }, ERL),
  { text: "O'Brien, Müller-Lüdenscheidt" }, 'Apostroph und Bindestrich');
gleich(katRender('{grund}', { grund: '100% erledigt \\ fertig' }, ERL),
  { text: '100% erledigt \\ fertig' }, 'Prozent und Backslash');
// Ein Wert, der selbst wie ein Platzhalter aussieht, darf keine zweite Runde ausloesen.
gleich(katRender('{grund}', { grund: '{betrag}' }, ERL),
  { text: '{betrag}' }, 'Wert sieht aus wie ein Platzhalter - keine zweite Ersetzung');

/* ===== 5. Kuerzung ===================================================== */
console.log('--- Längen ---');
{
  const TMAX = Number(/const KAT_TITEL_MAX = (\d+)/.exec(app)[1]);
  const XMAX = Number(/const KAT_TEXT_MAX  = (\d+)/.exec(app)[1]);
  pruefe(TMAX === 40, 'Titelgrenze 40', String(TMAX));
  pruefe(XMAX === 110, 'Textgrenze 110', String(XMAX));
  const lang = katRender('{grund}', { grund: 'x'.repeat(200) }, ERL);
  pruefe(lang.text.length === 200, 'Rendern kürzt NICHT - das tut erst die Anzeige', String(lang.text.length));
  pruefe(/is-lang/.test(app), 'der Zähler markiert Überlänge');
}

/* ===== 6. Was nur die Datenbank zusichert ============================== */
console.log('--- Zusicherungen im Migrationstext 0036 ---');
const sql = fs.readFileSync('supabase/migrations/0036_push_katalog.sql', 'utf8');
const rumpf = (name) => {
  const von = sql.indexOf('create or replace function public.' + name);
  if (von < 0) return '';
  return sql.slice(von, sql.indexOf('\n$$;', von));
};

{
  const f = rumpf('send_preview_notification');
  pruefe(f.length > 0, 'send_preview_notification vorhanden');
  pruefe(/if not public\.is_admin\(\) then raise exception/.test(f), 'prüft is_admin() als Erstes');
  pruefe(/p_profile\s*=>\s*auth\.uid\(\)/.test(f),
    'Ziel ist fest auth.uid() - der Aufrufer kann kein fremdes Profil angeben');
  pruefe(!/p_profile\s*(uuid|=>\s*p_)/.test(f.split('returns')[0] + f.split('begin')[0]),
    'die Funktion nimmt kein Profil als Parameter entgegen');
  pruefe(/p_vorschau\s*=>\s*true/.test(f), 'markiert die Zeile als Vorschau');
  pruefe(/vorschau:/.test(f) && /clock_timestamp/.test(f),
    'dedup_key mit Präfix vorschau: und Zeitstempel - mehrfaches Testen geht');
  pruefe(/p_tag\s*=>\s*'vorschau-'/.test(f),
    'eigener tag je Kategorie - sonst ersetzt die nächste Vorschau die vorige');
}
{
  const f = rumpf('set_notification_template');
  pruefe(/if not public\.is_admin\(\) then raise exception/.test(f), 'Vorlage ändern: nur Admin');
  pruefe(/render_vorlage/.test(f), 'prüft die Vorlage vorab gegen die Beispieldaten');
}
pruefe(/create policy notif_tpl_sel on public\.notification_templates\s*\n\s*for select to authenticated using \(public\.is_admin\(\)\)/.test(sql),
  'Lesen der Vorlagen: nur Admin (RLS)');
pruefe(!/for (insert|update|delete)[\s\S]{0,80}notification_templates/.test(sql),
  'keine Schreib-Policy auf notification_templates');
{
  const f = rumpf('notify_enqueue');
  pruefe(/exception when others then/.test(f) && /v_fehler/.test(f),
    'Renderfehler landen in error statt im Versand');
  pruefe(/drop function if exists public\.notify_enqueue\(/.test(sql),
    'die alte Signatur wird gelöscht, nicht überladen');
}
pruefe(/o\.ist_vorschau or o\.kategorie = 'test'/.test(sql),
  'Vorschau umgeht Ruhezeiten und Kategorie-Schalter');

console.log('');
console.log('NICHT hiermit bewiesen, weil keine Datenbank laeuft: dass die Policy und');
console.log('die is_admin()-Pruefungen zur Laufzeit greifen. Das zeigt erst der Versuch');
console.log('mit einem Nicht-Admin-Konto - siehe Handy-Checkliste.');

console.log(fehler.length === 0 ? '\n--- bestanden ---' : '\n--- NICHT bestanden: ' + fehler.length + ' ---');
process.exit(fehler.length === 0 ? 0 : 1);
