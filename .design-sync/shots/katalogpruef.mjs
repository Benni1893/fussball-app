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
const a = app.indexOf('  function katRender(vorlage, daten, erlaubt, optional) {');
const b = app.indexOf('\n  }', app.indexOf('return { text: out };', a)) + 4;
if (a < 0) { console.error('katRender nicht gefunden.'); process.exit(1); }
const katRender = new Function(app.slice(a, b) + '\n return katRender;')();
// katLaenge steht direkt hinter katRender im selben Block.
const la = app.indexOf('  function katLaenge(t) {');
const lb = app.indexOf('\n  }', la) + 4;
const katSegQuelle = app.slice(app.indexOf('  const katSeg ='), lb);
const katLaenge = new Function(katSegQuelle + '\n return katLaenge;')();

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

/* ===== 5b. Emojis und Graphemzaehlung ================================== */
console.log('--- Emojis ---');
gleich(katLaenge('abc'), 3, 'einfacher Text');
gleich(katLaenge(''), 0, 'leer');
gleich(katLaenge(null), 0, 'null');
gleich(katLaenge('Übermäßig'), 9, 'Umlaute und Eszett');
// Die Zeichen aus dem System, einzeln.
for (const [e, name] of [['\u{1F6A8}','dringend'], ['\u23F3','Frist'], ['\u{1F4B8}','schuldet'],
     ['\u{1F4B0}','zu pruefen'], ['\u2705','erledigt'], ['\u26A0\uFE0F','Problem'],
     ['\u{1F4C5}','Termin'], ['\u274C','Ausfall'], ['\u{1F4CB}','Uebersicht'], ['\u{1F514}','Test']]) {
  gleich(katLaenge(e), 1, 'Emoji ' + name + ' zaehlt als 1');
}
// Der eigentliche Punkt: UTF-16 zaehlt anders.
pruefe('\u26A0\uFE0F'.length === 2 && katLaenge('\u26A0\uFE0F') === 1,
  'Warnzeichen: length 2, aber ein Graphem');
gleich(katLaenge('\u26A0\uFE0F Zahlung nicht bestätigt'), 25, 'Titel mit Variantenselektor');
gleich(katLaenge('\u2705 {zusagen} \u00b7 \u274C {absagen} \u00b7 \u2753 {offen}'), 37, 'Text mit drei Emojis');   // nachgezaehlt: 3 Emojis + 2 Trenner + 3 Platzhalter

/* ===== 5c. Optionale Platzhalter ======================================= */
console.log('--- Optionale Platzhalter ---');
{
  const ERL2 = ['termin_titel', 'datum', 'uhrzeit', 'grund'];
  const OPT  = ['grund'];
  const V    = '{datum} {uhrzeit}. {grund}';
  gleich(katRender(V, { datum: '20.09.2026', uhrzeit: '12:30 Uhr', grund: 'Platz gesperrt.' }, ERL2, OPT),
    { text: '20.09.2026 12:30 Uhr. Platz gesperrt.' }, 'mit Grund');
  gleich(katRender(V, { datum: '20.09.2026', uhrzeit: '12:30 Uhr' }, ERL2, OPT),
    { text: '20.09.2026 12:30 Uhr.' }, 'ohne Grund - kein leerer Punkt, kein Abstand am Ende');
  gleich(katRender(V, { datum: '20.09.2026', uhrzeit: '12:30 Uhr', grund: '' }, ERL2, OPT),
    { text: '20.09.2026 12:30 Uhr.' }, 'Grund leer');
  gleich(katRender(V, { datum: '20.09.2026', uhrzeit: '12:30 Uhr', grund: '   ' }, ERL2, OPT),
    { text: '20.09.2026 12:30 Uhr.' }, 'Grund nur Leerzeichen');
  // Ohne Optionsliste bleibt es ein Fehler - die Strenge gilt weiter.
  pruefe(!!katRender(V, { datum: '20.09.', uhrzeit: '12:30' }, ERL2, []).fehler,
    'nicht als optional erklaert: weiterhin Fehler');
  pruefe(!!katRender(V, { datum: '20.09.' }, ERL2, OPT).fehler,
    'ein PFLICHT-Platzhalter fehlt: weiterhin Fehler, auch wenn ein anderer optional ist');
  gleich(katRender('{grund} danach', {}, ERL2, OPT), { text: 'danach' }, 'am Anfang weggefallen');
}

/* ===== 6. Was nur die Datenbank zusichert ============================== */
console.log('--- Zusicherungen im Migrationstext 0036 ---');
const sql = fs.readFileSync('supabase/migrations/0036_push_katalog.sql', 'utf8');
// 0037 ersetzt send_preview_notification. Geprueft wird die WIRKSAME Fassung.
const sql37 = fs.readFileSync('supabase/migrations/0037_vorschau_tag.sql', 'utf8');
const sql38 = fs.readFileSync('supabase/migrations/0038_push_texte.sql', 'utf8');
const rumpfIn = (quelle, name) => {
  const von = quelle.indexOf('create or replace function public.' + name);
  if (von < 0) return '';
  return quelle.slice(von, quelle.indexOf('\n$$;', von));
};
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
  // Der tag muss BEIDES leisten: je Kategorie verschieden, damit "Alle an
  // mich senden" nicht zu einer Mitteilung zusammenfaellt, UND je Druck
  // verschieden, damit zweimal dieselbe Kategorie nebeneinander liegt.
  // Die erste Fassung in 0036 konnte nur das Erste - der Test hier hat das
  // durchgehen lassen, weil er nur auf das Praefix sah.
  const wirksam = rumpfIn(sql37, 'send_preview_notification');
  pruefe(wirksam.length > 0, 'send_preview_notification wird in 0037 ersetzt');
  pruefe(/p_tag\s*=>\s*'vorschau-' \|\| p_kategorie \|\| '-' \|\| v_zeit/.test(wirksam),
    'tag traegt Kategorie UND Zeitstempel');
  pruefe(/v_zeit text := extract\(epoch from clock_timestamp/.test(wirksam),
    'ein Zeitstempel fuer tag und dedup_key - beide aus derselben Quelle');
  pruefe(/p_dedup\s*=>[^;]*v_zeit/.test(wirksam), 'dedup_key nutzt denselben Zeitstempel');
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

console.log('--- 0038: termin_abgesagt und Emoji-System ---');
for (const stelle of ['notification_outbox_kat_chk', 'notification_templates_kat_chk']) {
  const i = sql38.indexOf(stelle);
  pruefe(i > 0 && sql38.slice(i, i + 400).indexOf("'termin_abgesagt'") > 0,
    stelle + ' kennt termin_abgesagt');
}
pruefe(/add column if not exists termin_abgesagt boolean not null default true/.test(sql38),
  'eigener Schalter in notification_prefs, Standard an');
pruefe(/when 'termin_abgesagt'\s+then p\.termin_abgesagt/.test(sql38),
  'die faellige Sicht kennt den Schalter');
pruefe(/termin_abgesagt\s*=\s*coalesce\(\(p_werte->>'termin_abgesagt'\)/.test(sql38),
  'set_notification_prefs kann ihn setzen');
pruefe(/array\['grund'\]/.test(sql38), 'grund ist als optional erklaert');
pruefe(/drop function if exists public\.render_vorlage\(text, jsonb, text\[\]\);/.test(sql38),
  'die dreiargumentige render_vorlage wird geloescht, nicht ueberladen');
pruefe(/p_optional text\[\] default/.test(sql38), 'render_vorlage nimmt die Optionsliste');
pruefe(/if v_geleert then/.test(sql38), 'aufgeraeumt wird nur, wenn etwas weggefallen ist');
pruefe(/beispiel_daten - 'grund'/.test(sql38),
  'die Gegenprobe rendert termin_abgesagt auch OHNE Grund');
// Jede Vorlage in 0038 beginnt mit genau einem Zeichen aus dem System.
{
  const ZEICHEN = ['\u{1F6A8}','\u23F3','\u{1F4B8}','\u{1F4B0}','\u2705','\u26A0\uFE0F','\u{1F4C5}','\u274C','\u{1F4CB}','\u{1F514}'];
  const titel = [...sql38.matchAll(/titel_vorlage = '([^']+)'/g)].map((m) => m[1])
    .concat([...sql38.matchAll(/^\s+'(\u274C[^']+)',$/gm)].map((m) => m[1]));
  pruefe(titel.length >= 12, 'alle Titel gefunden', String(titel.length));
  const ohne = titel.filter((t) => !ZEICHEN.some((z) => t.indexOf(z) === 0));
  pruefe(ohne.length === 0, 'jeder Titel beginnt mit einem Zeichen aus dem System',
    ohne.length ? ohne.join(' | ') : undefined);
}

console.log('');
console.log('NICHT hiermit bewiesen, weil keine Datenbank laeuft: dass die Policy und');
console.log('die is_admin()-Pruefungen zur Laufzeit greifen. Das zeigt erst der Versuch');
console.log('mit einem Nicht-Admin-Konto - siehe Handy-Checkliste.');

console.log(fehler.length === 0 ? '\n--- bestanden ---' : '\n--- NICHT bestanden: ' + fehler.length + ' ---');
process.exit(fehler.length === 0 ? 0 : 1);
