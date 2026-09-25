/* Schalter je Kategorie: Sichtbarkeit nach Rolle, Sammelschalter, und was
   die Datenbank unabhaengig vom Schalter erzwingt.
   pnGruppenFuer() und pnSammelZustand() kommen woertlich aus app.js.
   Aufruf: node .design-sync/shots/prefspruef.mjs                            */
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
const von = app.indexOf('  const PN_GRUPPEN = [');
const bis = app.indexOf('  let pnInfos = null;', von);
if (von < 0 || bis < 0) { console.error('PN-Block nicht gefunden.'); process.exit(1); }
const M = new Function(app.slice(von, bis) +
  '\n return { PN_GRUPPEN, pnGruppenFuer, pnSammelZustand };')();

const namen = (g) => g.map((x) => x.rolle);

/* ===== 1. Sichtbarkeit je Rollenkombination ============================ */
console.log('--- Welche Abschnitte sieht wer ---');
gleich(namen(M.pnGruppenFuer(['player'], true)), ['spieler'], 'nur Spieler');
gleich(namen(M.pnGruppenFuer(['player', 'coach'], true)), ['spieler', 'coach'], 'Spieler + Trainer');
gleich(namen(M.pnGruppenFuer(['player', 'treasurer'], true)), ['spieler', 'treasurer'], 'Spieler + Kasse');
gleich(namen(M.pnGruppenFuer(['coach'], false)), ['coach'],
  'Trainer OHNE Spielerverknüpfung: kein Spieler-Abschnitt');
gleich(namen(M.pnGruppenFuer(['admin', 'player'], true)), ['spieler'],
  'Admin + Spieler: Admin bringt keine eigenen Kategorien');
gleich(namen(M.pnGruppenFuer(['player', 'coach', 'treasurer', 'admin'], true)),
  ['spieler', 'coach', 'treasurer'], 'alle vier Rollen');
gleich(namen(M.pnGruppenFuer([], false)), [], 'keine Rolle, keine Verknüpfung');
gleich(namen(M.pnGruppenFuer(['admin'], false)), [],
  'Admin ohne alles: keine Kategorien, nur der Verwalten-Link');
gleich(namen(M.pnGruppenFuer(null, true)), ['spieler'], 'Rollenliste fehlt');
// Die Reihenfolge ist festgelegt, nicht zufaellig.
gleich(namen(M.pnGruppenFuer(['treasurer', 'coach', 'player'], true)),
  ['spieler', 'coach', 'treasurer'], 'Reihenfolge Spieler, Trainer, Kasse - unabhängig von der Eingabe');

/* ===== 2. Vollstaendigkeit =============================================== */
console.log('--- Deckt die Gliederung alle Kategorien ab? ---');
{
  const ALLE = ['strafe_neu','zahlung_bestaetigt','zahlung_abgelehnt','zahlung_gemeldet',
    'absage_kurzfristig','termin_geaendert','termin_abgesagt','termin_neu',
    'rueckmeldung_erinnerung','unterbesetzung','meldeschluss_uebersicht','strafen_offen'];
  const gezeigt = M.PN_GRUPPEN.flatMap((g) => g.kategorien.map((k) => k[0]));
  const fehlend = ALLE.filter((k) => gezeigt.indexOf(k) < 0);
  const zuviel  = gezeigt.filter((k) => ALLE.indexOf(k) < 0);
  pruefe(fehlend.length === 0, 'jede Kategorie hat einen Schalter', fehlend.join(', ') || undefined);
  pruefe(zuviel.length === 0, 'kein Schalter ohne Kategorie', zuviel.join(', ') || undefined);
  pruefe(new Set(gezeigt).size === gezeigt.length, 'keine Kategorie zweimal');
  // Die Zuordnung muss zu kategorie_rolle() in 0039 passen, sonst zeigt die
  // App einen Schalter, den der Server nie beachtet.
  const sql = fs.readFileSync('supabase/migrations/0039_kategorie_rollen.sql', 'utf8');
  for (const g of M.PN_GRUPPEN) {
    for (const [kat] of g.kategorien) {
      const re = new RegExp("when '" + kat + "'\\s+then '" + g.rolle + "'");
      pruefe(re.test(sql), kat + ' -> ' + g.rolle + ' stimmt mit kategorie_rolle() überein');
    }
  }
}

/* ===== 3. Sammelschalter =============================================== */
console.log('--- Sammelschalter ---');
{
  const g = M.PN_GRUPPEN.find((x) => x.rolle === 'coach');
  const alle = (v) => ({ absage_kurzfristig: v, unterbesetzung: v, meldeschluss_uebersicht: v });
  gleich(M.pnSammelZustand(g, alle(true)), 'true', 'alle an');
  gleich(M.pnSammelZustand(g, alle(false)), 'false', 'alle aus');
  gleich(M.pnSammelZustand(g, { absage_kurzfristig: true, unterbesetzung: false, meldeschluss_uebersicht: false }),
    'mixed', 'einer an');
  gleich(M.pnSammelZustand(g, { absage_kurzfristig: true, unterbesetzung: true, meldeschluss_uebersicht: false }),
    'mixed', 'zwei an');
  gleich(M.pnSammelZustand(g, {}), 'false', 'nichts gesetzt zählt als aus');
  gleich(M.pnSammelZustand(g, null), 'false', 'keine Einstellungen geladen');
  // Eine Gruppe mit nur einer Kategorie kennt kein "gemischt".
  const kasse = M.PN_GRUPPEN.find((x) => x.rolle === 'treasurer');
  gleich(M.pnSammelZustand(kasse, { zahlung_gemeldet: true }), 'true', 'Kasse an');
  gleich(M.pnSammelZustand(kasse, { zahlung_gemeldet: false }), 'false', 'Kasse aus');
}

console.log('--- Rückwirkung des Sammelschalters ---');
{
  // Der Klickpfad: gemischt zaehlt als aus, der naechste Druck schaltet alles an.
  const naechster = (z) => (z !== 'true');
  pruefe(naechster('true') === false, 'alle an -> alles aus');
  pruefe(naechster('false') === true, 'alle aus -> alles an');
  pruefe(naechster('mixed') === true, 'gemischt -> alles an');
  pruefe(/pnSammelZustand\(g, pushPrefs\) !== "true"/.test(app),
    'so steht es auch im Klickpfad');
}

/* ===== 4. Was der Server erzwingt ====================================== */
console.log('--- Server: Rolle sticht den Schalter ---');
{
  const sql = fs.readFileSync('supabase/migrations/0039_kategorie_rollen.sql', 'utf8');
  pruefe(/and \(o\.ist_vorschau or public\.kategorie_erlaubt\(o\.profile_id, o\.kategorie\)\)/.test(sql),
    'die fällige Sicht prüft die Rolle zusätzlich zum Schalter');
  pruefe(/where id = p_profile and player_id is not null/.test(sql),
    'spieler heißt: mit einem Spieler verknüpft');
  pruefe(/from public\.user_roles\s*\n?\s*where user_id = p_profile and role = v_rolle/.test(sql),
    'coach und treasurer kommen aus user_roles');
  pruefe(!/is_admin\(\)/.test(sql.slice(sql.indexOf('kategorie_erlaubt'), sql.indexOf('grant execute on function public.kategorie_rolle'))),
    'Admin bekommt NICHT automatisch alles');
  pruefe(/if v_rolle is null then return false/.test(sql),
    'unbekannte Kategorie: niemand bekommt sie');
}

/* ===== 5. Ausgegraut, aber erhalten ==================================== */
console.log('--- Hauptschalter aus ---');
pruefe(/pnAbschnittHtml\("bereit"\)/.test(app), 'der Block erscheint auch im Zustand bereit');
pruefe(/const aus = zustand !== "aktiv";/.test(app), 'dort ausgegraut');
pruefe(/\.pn-liste\.is-aus \.pn-t \{ color: var\(--muted\)/.test(fs.readFileSync('styles.css', 'utf8')),
  'ausgegraut färbt nur den Titel um - die Unterzeile bleibt lesbar');
pruefe(!/delete .*pushPrefs|pushPrefs = \{\}/.test(app),
  'die Einstellungen werden beim Ausschalten nicht verworfen');

/* ===== 6. Der Schalter als Bauteil ===================================== */
console.log('--- .sw ---');
{
  const css = fs.readFileSync('styles.css', 'utf8');
  pruefe(/role="switch"/.test(app), 'role="switch"');
  pruefe(/aria-checked="' \+ zustand \+ '"/.test(app), 'aria-checked traegt den Zustand');
  pruefe(/\.sw::after \{[\s\S]{0,160}width: var\(--tap\); height: var\(--tap\)/.test(css),
    'Trefferfläche 44 über ::after');
  pruefe(/\.sw\[aria-checked="mixed"\]/.test(css), 'gemischt ist gestaltet');
  pruefe(/\.sw\[disabled\]/.test(css), 'ausgegraut ist gestaltet');
  pruefe(!/#[0-9a-fA-F]{6}/.test(css.slice(css.indexOf('.sw {'), css.indexOf('.pn-gruppe + .pn-gruppe'))
    .replace(/background: #fff;/g, '')), 'keine neuen Farben im Schalter (ausser Weiss)');
}

console.log(fehler.length === 0 ? '\n--- bestanden ---' : '\n--- NICHT bestanden: ' + fehler.length + ' ---');
process.exit(fehler.length === 0 ? 0 : 1);
