/* Prueft das Geruest der zweistufigen Einstellungen - ohne Browser und ohne
   Testkonto. Die Funktionen kommen woertlich aus app.js (einmodul.mjs); was
   sich nur im Quelltext zeigt (Verteiler, popstate, Migration), wird am Text
   geprueft.

   Aufruf: node .design-sync/shots/einpruef.mjs                            */
import fs from 'node:fs';
import { ladeEin } from './einmodul.mjs';

const app = fs.readFileSync('app.js', 'utf8');
const css = fs.readFileSync('styles.css', 'utf8');
const E = ladeEin();

let fehler = 0, gut = 0;
function pruefe(ok, text, zusatz) {
  if (ok) { gut++; console.log('  ok   ' + text); }
  else { fehler++; console.log('  FEHL ' + text + (zusatz ? '  [' + zusatz + ']' : '')); }
}
function gleich(a, b, text) {
  const x = JSON.stringify(a), y = JSON.stringify(b);
  pruefe(x === y, text, x === y ? '' : x + ' statt ' + y);
}

/* ===== 1. Hash-Routen ================================================== */
console.log('--- Adressen der Unterseiten ---');
{
  E.setRollen(['admin', 'player']);
  gleich(E.einZielAusHash('#ein=mitteilungen'), 'mitteilungen', 'Mitteilungen');
  gleich(E.einZielAusHash('#ein=ruhezeiten'), 'ruhezeiten', 'Ruhezeiten');
  gleich(E.einZielAusHash('#ein=kalender'), 'kalender', 'Kalender-Abo');
  gleich(E.einZielAusHash('#ein=bfv'), 'bfv', 'Spielplan als Admin');
  gleich(E.einZielAusHash('ein=mitteilungen'), 'mitteilungen', 'auch ohne Raute');

  gleich(E.einZielAusHash(''), null, 'leerer Hash fuehrt nirgendwohin');
  gleich(E.einZielAusHash('#ein='), null, 'ohne Wert fuehrt nirgendwohin');
  gleich(E.einZielAusHash('#ein=quatsch'), null, 'unbekannte Seite fuehrt nirgendwohin');
  gleich(E.einZielAusHash('#ein=Mitteilungen'), null, 'Grossschreibung zaehlt nicht als Treffer');
  gleich(E.einZielAusHash('#ansicht=einstellungen'), null, 'die alte Sammeladresse ist keine Unterseite');
  gleich(E.einZielAusHash('#ein=mitteilungen&x=1'), null, 'kein Anhaengsel');

  // Rolle entscheidet mit: der Spielplan gehoert dem Admin.
  E.setRollen(['player']);
  gleich(E.einZielAusHash('#ein=bfv'), null, 'Spieler kommt nicht auf den Spielplan');
  pruefe(!E.einSeiteErlaubt('bfv'), 'einSeiteErlaubt sperrt bfv fuer Spieler');
  pruefe(E.einSeiteErlaubt('mitteilungen'), 'Mitteilungen bleiben fuer alle offen');
  E.setRollen(['admin', 'player']);
  pruefe(E.einSeiteErlaubt('bfv'), 'Admin darf auf den Spielplan');
}

/* ===== 2. Werte rechts in den Zeilen =================================== */
console.log('--- Werte in der Uebersicht ---');
{
  // Lesart (a): "An", wenn auf DIESEM Geraet zugestellt wird.
  E.setPush('aktiv');        gleich(E.einMitteilungenWert(), 'An', 'zugestellt -> An');
  E.setPush('verweigert');   gleich(E.einMitteilungenWert(), 'Aus', 'blockiert -> Aus');
  E.setPush('bereit');       gleich(E.einMitteilungenWert(), 'Nicht eingerichtet', 'bereit -> Nicht eingerichtet');
  E.setPush('ios-install');  gleich(E.einMitteilungenWert(), 'Nicht eingerichtet', 'erst installieren -> Nicht eingerichtet');
  E.setPush('nicht-unterstuetzt'); gleich(E.einMitteilungenWert(), 'Nicht eingerichtet', 'alter Browser -> Nicht eingerichtet');
  E.setPush('inapp');        gleich(E.einMitteilungenWert(), 'Nicht eingerichtet', 'fremder In-App-Browser');
  E.setPush('aktiv');

  E.setPrefs({ quiet_from: '22:00', quiet_to: '08:00' });
  gleich(E.einRuhezeitWert(), '22:00 bis 08:00', 'Zeitspanne');
  E.setPrefs({ quiet_from: '22:00:00', quiet_to: '08:00:00' });
  gleich(E.einRuhezeitWert(), '22:00 bis 08:00', 'Sekunden werden abgeschnitten');
  // Gleiche Von- und Bis-Zeit heisst "keine Ruhezeit" - so rechnet in_quiet_hours().
  E.setPrefs({ quiet_from: '00:00', quiet_to: '00:00' });
  gleich(E.einRuhezeitWert(), 'Aus', 'gleiche Zeiten heissen Aus');
  E.setPrefs(null);
  gleich(E.einRuhezeitWert(), 'Aus', 'ohne geladene Einstellungen steht Aus');
  E.setPrefs({ quiet_from: '22:00', quiet_to: '08:00' });
}

/* ===== 3. Die Uebersicht selbst ======================================== */
console.log('--- Aufbau der Uebersicht ---');
{
  E.setRollen(['admin', 'player']);
  const h = E.uebersichtHtml();

  for (const z of ['Mitteilungen', 'Ruhezeiten', 'Kalender-Abo', 'Spielplan (BFV)',
                   'Strafenkatalog', 'Push-Texte', 'Diagnose', 'App neu laden']) {
    pruefe(h.includes('>' + z + '<'), 'Zeile "' + z + '" steht da');
  }
  pruefe((h.match(/class="ein-zeile"/g) || []).length === 8, 'acht Zeilen, nicht mehr');
  pruefe((h.match(/data-logout/g) || []).length === 1, 'genau ein Abmelden');
  pruefe(h.includes('data-view-jump="profil"'), 'die Profilkarte fuehrt ins Profil');
  pruefe(!h.includes('Profil öffnen'), 'der alte Knopf "Profil öffnen" ist weg');
  pruefe(!h.includes('?debug=1'), 'die Diagnose haengt nicht mehr am Neustart-Link');
  pruefe(h.includes('data-ein-tat="diagnose"'), 'Diagnose ist eine eigene Zeile');
  pruefe(h.includes('Build '), 'die Build-Nummer steht im Fuss');

  // Spielersicht
  E.setRollen(['player']);
  const s = E.uebersichtHtml();
  pruefe(!s.includes('Verwaltung'), 'Spieler sieht keine Verwaltung');
  for (const z of ['Spielplan (BFV)', 'Strafenkatalog', 'Push-Texte']) {
    pruefe(!s.includes('>' + z + '<'), 'Spieler sieht "' + z + '" nicht');
  }
  pruefe((s.match(/class="ein-zeile"/g) || []).length === 5, 'Spieler hat fuenf Zeilen');

  // Trainer: Verwaltung ja, aber kein Spielplan und keine Push-Texte (beides Admin).
  E.setRollen(['coach']);
  const c = E.uebersichtHtml();
  pruefe(c.includes('Strafenkatalog'), 'Trainer kommt an den Strafenkatalog');
  pruefe(!c.includes('Spielplan (BFV)'), 'Trainer sieht den Spielplan nicht');
  pruefe(!c.includes('Push-Texte'), 'Trainer sieht die Push-Texte nicht');
  E.setRollen(['admin', 'player']);
}

/* ===== 4. Was nur im Quelltext steht =================================== */
console.log('--- Verdrahtung ---');
{
  pruefe(/if \(art === "ein" &&/.test(app), 'deepLinkZiel kennt ein=');
  pruefe(app.includes('if (ziel.art === "ein")'), 'routeDeepLink behandelt ein=');
  // Der Hash BLEIBT stehen - sonst geht die Unterseite beim Neuladen verloren.
  // Nur der ein-Zweig, nicht das gemeinsame Aufraeumen der anderen Zweige
  // dahinter - das steht hinter dem return und gilt fuer ansicht/termin/strafen.
  const zweigAb = app.indexOf('if (ziel.art === "ein")');
  const zweig = app.slice(zweigAb, app.indexOf('\n    deepLinkHashWeg();', zweigAb));
  // Genau ein deepLinkHashWeg() im Zweig, und das steht in der Absage fuer eine
  // gesperrte Seite. Im erlaubten Fall bleibt der Hash stehen - sonst ginge die
  // Unterseite beim Neuladen verloren.
  pruefe((zweig.match(/deepLinkHashWeg\(\)/g) || []).length === 1,
    'der Hash wird nur bei gesperrter Seite abgeraeumt');
  pruefe(/einSeiteErlaubt\(ziel\.wert\)\) \{ deepLinkHashWeg\(\)/.test(zweig),
    'und zwar genau dort');

  // Zurueck-Geste: die Unterseite muss VOR dem Kachel-Sprung drankommen.
  const pop = app.slice(app.indexOf('window.addEventListener("popstate"'));
  pruefe(pop.indexOf('einSyncAusHash()') < pop.indexOf('navReturn'),
    'popstate fragt zuerst die Unterseite');
  pruefe(/hashchange", function \(\) \{\s*\n\s*if \(einSyncAusHash\(\)\) return;/.test(app),
    'hashchange fragt zuerst die Unterseite');
  // Nur der Rumpf von switchView - "if (einst.seite)" steht auch im Verteiler
  // von renderEinstellungen, und der ist hier nicht gemeint.
  const sv = app.indexOf('function switchView(view) {');
  const wechsel = app.slice(sv, app.indexOf('window.scrollTo(0, 0);', sv));
  pruefe(wechsel.includes('einst.seite = null;'), 'ein Ansichtswechsel verlaesst die Unterseite');
  // Sonst zeigte die Adresse eine Seite, die gar nicht mehr offen ist.
  pruefe(/\^#\?ein=/.test(wechsel) && wechsel.includes('replaceState'),
    'und raeumt den Hash der Unterseite mit weg');

  for (const a of ['[data-ein]', '[data-ein-back]', '[data-ein-tat]']) {
    pruefe(app.includes(a), 'der Klick-Verteiler kennt ' + a);
  }
  pruefe(app.includes('Du wirst auf diesem Gerät abgemeldet.'), 'Abmelden fragt zweizeilig nach');

  // Doppelte Einstiege zu den Push-Texten sind zusammengefuehrt.
  pruefe(!app.includes('Push-Nachrichten verwalten'), 'kein zweiter Einstieg im Mitteilungsblock');
  pruefe(!app.includes('Push-Nachrichten öffnen'), 'kein dritter Einstieg in der Verwaltung');
  // Die Zeile baut data-goto erst zur Laufzeit; im Quelltext steht der Schluessel.
  pruefe((app.match(/goto: "pushkatalog"/g) || []).length === 1, 'genau ein Weg zu den Push-Texten');

  // Der Baustein der Statuschips bleibt fuer Uebersicht und Profil unangetastet.
  pruefe((app.match(/statusWahlHtml\(/g) || []).length >= 4, 'statusWahlHtml ist unveraendert in Gebrauch');
}

/* ===== 5. Stil ========================================================= */
console.log('--- Stil ---');
{
  for (const kl of ['.ein-kopf', '.ein-back', '.ein-kopf-t', '.ein-h1', '.ein-body',
                    '.ein-profil', '.ein-gruppe', '.ein-titel', '.ein-zeile', '.ein-ic',
                    '.ein-chev', '.ein-abmelden', '.ein-build']) {
    pruefe(css.includes(kl + ' ') || css.includes(kl + '.') || css.includes(kl + ','),
      'styles.css kennt ' + kl);
  }
  // Keine neue Farbe: die Kacheln greifen auf den Tokenblock zu.
  const ic = css.slice(css.indexOf('.ein-ic.gruen'), css.indexOf('.ein-zeile-t'));
  pruefe(!/#[0-9a-f]{3,6}/i.test(ic), 'Kachelfarben stehen als Token, nicht als Hexwert', ic.trim());
  pruefe(css.includes('prefers-reduced-motion'), 'der Uebergang laesst sich abbestellen');
  // Die klebende Leiste haengt an der gemessenen Kopfhoehe.
  pruefe(/\.ein-kopf \{[^}]*position: sticky/s.test(css), 'die Zurueck-Leiste klebt');
  pruefe(/\.ein-kopf \{[^}]*--header-h/s.test(css), 'sie klebt unter der Kopfzeile, nicht bei 0');
}

/* ===== 6. Migration 0041 =============================================== */
console.log('--- Migration 0041 ---');
{
  const sql = fs.readFileSync('supabase/migrations/0041_texte_und_deeplink.sql', 'utf8');
  pruefe(/update public\.notification_templates/.test(sql), 'sie fasst nur die Vorlagen an');
  pruefe(!/create table|alter table|drop /i.test(sql), 'kein DDL');
  pruefe(!/create policy|drop policy/i.test(sql), 'keine Policy');
  pruefe(sql.includes('„Termin geändert“'), 'der sichtbare Name steht in Anfuehrungszeichen');
  const oben = sql.slice(0, sql.indexOf('RUECKBAU'));
  pruefe(!/laufen über termin_geaendert/.test(oben.replace(/^--.*$/gm, '')),
    'der interne Bezeichner steht nicht mehr im neuen Text');
  pruefe(sql.includes("deep_link_vorlage = '#ein=mitteilungen'"), 'die Testnachricht fuehrt auf die Mitteilungen');
  pruefe(sql.includes('RUECKBAU'), 'es gibt einen Rueckbau-Teil');
  // Ab dem Zeilenanfang schneiden, sonst zaehlt die Ueberschrift als Befehl.
  const rueck = sql.slice(sql.lastIndexOf('\n', sql.indexOf('RUECKBAU')) + 1);
  pruefe(rueck.includes("'#ansicht=einstellungen'"), 'der Rueckbau stellt den alten Deep Link her');
  pruefe(rueck.includes('laufen über termin_geaendert'), 'der Rueckbau stellt den alten Text her');
  pruefe(rueck.split('\n').filter((l) => l.trim() && !l.trim().startsWith('--')).length === 0,
    'der Rueckbau laeuft nicht versehentlich mit');
}

/* ===== 7. Die Vorlagen liegen eindeutig ================================ */
console.log('--- Vorlagen ---');
{
  const ordner = '.design-sync/reference/app/einstellungen-kader';
  pruefe(fs.existsSync(ordner), 'der Ordner einstellungen-kader existiert');
  const dat = fs.existsSync(ordner) ? fs.readdirSync(ordner) : [];
  for (const f of ['einstellungenneu.png', 'einstellungenneu1.png', 'einstellungenneu2.png', 'kaderneu.png']) {
    pruefe(dat.includes(f), f + ' liegt dort');
  }
  pruefe(!dat.some((f) => /\s/.test(f)), 'kein Dateiname mit Leerzeichen');
  pruefe(!fs.existsSync('.design-sync/reference/app/einstellungenneu .png'), 'die alte Datei mit Leerzeichen ist weg');
  const konv = fs.readFileSync('.design-sync/conventions.md', 'utf8');
  pruefe(konv.includes('einstellungen-kader/'), 'conventions.md nennt den Ordner');
  pruefe(konv.includes('einstellungenneu2.png'), 'conventions.md nennt den neuen Namen');
}

console.log('');
console.log(fehler ? '--- ' + fehler + ' Beanstandung(en), ' + gut + ' ok ---'
                   : '--- bestanden (' + gut + ' Pruefungen) ---');
process.exit(fehler ? 1 : 0);
