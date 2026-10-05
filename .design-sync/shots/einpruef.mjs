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

/* ===== 8. Paket Einstellungen v2, E3: Hauptseite nach einst1.png ========= */
console.log('--- Einstellungen v2: Hauptseite (E3) ---');
{
  const T = E.einRollenText;
  const gleich = (ist, soll, text) => pruefe(ist === soll, text, ist === soll ? undefined : ist);
  gleich(T(['player', 'admin']), 'Administrator · Spieler', 'Rollenzeile: hoechste Rolle zuerst, auch wenn my_roles() anders sortiert');
  gleich(T(['admin', 'player']), 'Administrator · Spieler', 'Rollenzeile: Admin + Spieler');
  gleich(T(['player', 'treasurer', 'coach']), 'Trainer · Kassenwart · Spieler', 'Rollenzeile: Trainer vor Kassenwart vor Spieler');
  gleich(T(['player']), 'Spieler', 'Rollenzeile: nur Spieler');
  gleich(T([]), 'Spieler', 'Rollenzeile ohne Rolle: Spieler');

  E.setRollen(['player', 'admin']);
  const h = E.uebersichtHtml();
  pruefe(h.includes('Administrator · Spieler'), 'Uebersicht zeigt die sortierte Rollenzeile');
  pruefe(/class="page-head ein-start"/.test(h), 'Ueberschrift traegt ein-start (26 px nur hier)');
  const zeilen = h.split('<button class="ein-zeile"').slice(1);
  const zeile = (t) => zeilen.find((z) => z.includes('>' + t + '<')) || '';
  pruefe(zeile('Diagnose').includes('M3 12h4l2.5-6'), 'Diagnose mit Puls-Symbol (Vorlage)');
  pruefe(!zeile('Diagnose').includes('<circle'), 'Diagnose nicht mehr mit Info-Kreis');
  pruefe(zeile('Diagnose').includes('ein-chev'), 'Diagnose behaelt den Chevron (Ebene dahinter)');
  pruefe(zeile('App neu laden') !== '' && !zeile('App neu laden').includes('ein-chev'), 'App neu laden ohne Chevron (reine Aktion)');
  pruefe(zeilen.filter((z) => z.includes('ein-chev')).length === zeilen.length - 1, 'alle anderen Zeilen behalten den Chevron');

  const css = fs.readFileSync('styles.css', 'utf8');
  const regel = (sel) => { const i = css.indexOf(sel + ' {'); return i < 0 ? '' : css.slice(i, css.indexOf('}', i)); };
  pruefe(/font-size: 26px/.test(regel('.page-head.ein-start h1')), 'Ueberschrift 26 px');
  pruefe(/width: 54px; height: 54px/.test(regel('.ein-profil .ein-profil-av')), 'Avatar 54 px, doppelte Klasse gegen .avatar');
  pruefe(regel('.ein-titel').includes('color: var(--green-700)') && regel('.ein-titel').includes('padding: 0 15px'), 'Gruppentitel gruen und auf Kachelhoehe eingerueckt');
  pruefe(/min-height: 48px/.test(regel('.ein-zeile')), 'Zeilen 48 px');
  pruefe(/font-size: 16px; font-weight: 500/.test(regel('.ein-zeile-t')), 'Zeilentitel 16 px / 500');
  pruefe(css.includes('.ein-ic.grau        { background: var(--muted); }'), 'graue Kachel --muted');
  pruefe(regel('.ein-chev').includes('color: var(--muted)') && !regel('.ein-chev').includes('gold'), 'Chevron grau statt gold');

  const v2 = '.design-sync/reference/app/einstellungen-v2';
  for (const f of ['einst1.png', 'einst2.png', 'einst3.png', 'einst4.png']) pruefe(fs.existsSync(v2 + '/' + f), 'Vorlage ' + f + ' liegt in einstellungen-v2');
  pruefe(!fs.readdirSync('.design-sync/reference').some((f) => /^einstd?.PNG$/.test(f)), 'keine lose Vorlage mehr in reference/');
  for (const n of ['1-admin', '1b-admin-ende', '2-spieler']) {
    const f = '.design-sync/reference/soll/07_einstellungen-v2_' + n + '.png';
    const b = fs.existsSync(f) ? fs.readFileSync(f) : null;
    pruefe(!!b && b.readUInt32BE(16) === 390 && b.readUInt32BE(20) === 844, 'Soll-Ausschnitt ' + n + ' (390 x 844)');
  }
  E.setRollen(['admin', 'player']);
}

/* ===== 9. Paket Einstellungen v2, E4: Mitteilungen nach einst2.png ======= */
console.log('--- Einstellungen v2: Mitteilungen (E4) ---');
{
  const appQ = fs.readFileSync('app.js', 'utf8');
  const cssQ = fs.readFileSync('styles.css', 'utf8');
  const stueckQ = (von, bis) => { const a = appQ.indexOf(von); const b = appQ.indexOf(bis, a); return a < 0 || b < 0 ? '' : appQ.slice(a, b); };

  // Hinweis "automatische Nachrichten": eine Stelle, mit true weg.
  // Seit AM5 (05.10.2026) sind alle Erzeuger live: Konstante true, kein Hinweis.
  // Der Wortlaut aus AM2 bleibt für den Fall false geprüft.
  const WORT = 'Automatisch kommen bisher nur Nachrichten zur Kasse. Termine und Rückmeldungen folgen.';
  const autoCode = stueckQ('  const AUTO_MITTEILUNGEN_AKTIV = true;', '  function pnAdminHtml() {');
  pruefe(autoCode !== '', 'Konstante AUTO_MITTEILUNGEN_AKTIV = true und pnAutoHinweisHtml stehen beieinander');
  const autoAn = new Function(autoCode + '\n return pnAutoHinweisHtml;')();
  const autoAus = new Function(autoCode.replace(/const AUTO_MITTEILUNGEN_AKTIV = true;[^\n]*/, 'const AUTO_MITTEILUNGEN_AKTIV = false;') + '\n return pnAutoHinweisHtml;')();
  pruefe(autoAn() === '', 'AM5: der Hinweis ist weg (AUTO_MITTEILUNGEN_AKTIV = true)');
  pruefe(autoAus().replace(/<[^>]+>/g, '') === WORT, 'mit false käme der Wortlaut aus AM2');
  pruefe(appQ.split('const AUTO_MITTEILUNGEN_AKTIV').length - 1 === 1, 'die Konstante gibt es genau einmal');
  pruefe(appQ.split('pnAutoHinweisHtml()').length - 1 === 2, 'der Hinweis wird genau an einer Stelle eingebaut');
  pruefe(appQ.split('Automatisch kommen bisher nur').length - 1 === 1, 'der Text steht nur an dieser einen Stelle');
  pruefe(!appQ.includes('Automatische Nachrichten sind noch nicht eingeschaltet'), 'der alte Wortlaut (vor AM2) ist weg');

  // Texte der Vorlage, ohne Gedankenstriche
  pruefe(appQ.includes("Keine eigenen Kategorien für Admins. Als Admin bekommst du, ' +\n      'was deine übrigen Rollen vorsehen."), 'Admin-Hinweis im Wortlaut der Vorlage');
  pruefe(appQ.includes("Die Liste in der App zeigt alles, was du hier eingeschaltet hast, ' +\n      'auch ohne Push auf diesem Gerät."), 'Schlusshinweis mit Komma (Vorlage)');
  const bereich = stueckQ('  const PN_GRUPPEN = [', '  function pushMeldung(txt) {')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  pruefe(bereich !== '' && !bereich.includes('–'), 'keine Gedankenstriche in den Texten der Mitteilungen');
  for (const m of ['Nicht bestätigt, nichts geändert', 'Testnachricht unterwegs, sie kommt in bis zu einer Minute']) {
    pruefe(appQ.includes('pushMeldung("' + m + '")') || appQ.includes('pushMeldung("' + m + '"); }'), 'Meldung ohne Gedankenstrich: ' + m);
  }

  // Gliederung: Symbol und Kachelton je Kategorie
  const pg = new Function(stueckQ('  const PN_GRUPPEN = [', '  /* Welche Gruppen sieht dieser Nutzer?') + '\n return PN_GRUPPEN;')();
  const TOENE = ['gruen', 'dunkelgruen', 'gold', 'grau', 'rot'];
  for (const g of pg) for (const [kat, ic, name, ton] of g.kategorien) {
    pruefe(/^[a-z-]+$/.test(ic) && E.einIcon(ic).includes('<svg'), kat + ': Symbol "' + ic + '" (kein Emoji)');
    pruefe(TOENE.includes(ton) && cssQ.includes('.ein-ic.' + ton + ' '), kat + ': Kachelton "' + ton + '" mit CSS-Regel');
  }

  // Aufbau: Karten auf dem Grund statt eines Rahmens um alles
  pruefe(appQ.includes(`return '<div class="ein-mitteilungen" data-push-karte>' + inhalt + '</div>';`), 'Mitteilungen ohne Rahmen um alles (aktiv, bereit)');
  pruefe(/'<div class="ein-gkopf"><span class="ein-gkopf-t">'/.test(appQ), 'Gruppenkopf mit Sammelschalter über der Karte');
  pruefe(appQ.includes('einSchalterZeileHtml({ ic: "glocke", ton: "gruen", titel: "Push auf diesem Gerät"'), 'Push auf diesem Gerät als Kartenzeile mit Glocke');

  // Stil
  pruefe(/\.sw \{\s*position: relative; flex: none; width: 51px; height: 31px;/.test(cssQ), 'Schalter 51 x 31 (Vorlage)');
  pruefe(/\.ein-h1 \{ font-size: 26px;[^}]*letter-spacing: -\.025em/.test(cssQ), 'Unterseiten-Titel 26 px mit Laufweite wie die Übersicht');
  pruefe(/\.ein-kopf\.is-kompakt \{ background: var\(--bg\)/.test(cssQ), 'kompakte Leiste hell mit Linie');
  for (const n of ['3-mitteilungen', '4-mitteilungen-kompakt']) {
    const pf = '.design-sync/reference/soll/07_einstellungen-v2_' + n + '.png';
    const b = fs.existsSync(pf) ? fs.readFileSync(pf) : null;
    pruefe(!!b && b.readUInt32BE(16) === 390 && b.readUInt32BE(20) === 844, 'Soll-Ausschnitt ' + n + ' (390 x 844)');
  }
}

/* ===== 10. Paket Einstellungen v2, E5: Ruhezeiten nach einst2.png ======== */
console.log('--- Einstellungen v2: Ruhezeiten (E5) ---');
{
  const appQ = fs.readFileSync('app.js', 'utf8');
  const cssQ = fs.readFileSync('styles.css', 'utf8');
  const ohneKommentar = appQ.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:"'`\\])\/\/[^\n]*/g, '$1');

  // Aufbau: drei Karten, Zeitzeilen mit Pille ueber dem nativen Feld
  pruefe(appQ.includes('pnZeitZeileHtml("Von", "data-pn-von", von, aus)') && appQ.includes('pnZeitZeileHtml("Bis", "data-pn-bis", bis, aus)'),
    'Von und Bis als Zeitzeilen mit data-pn-von / data-pn-bis');
  pruefe(appQ.includes(`'<input class="ein-zeit" type="time" ' + attr`), 'natives Zeitfeld (type="time") bleibt');
  pruefe(appQ.includes(`'<span class="ein-zeit-wert" aria-hidden="true">' + esc(wert) + '</span>'`), 'Pille zeigt den gespeicherten Wert (24 Stunden)');
  pruefe(appQ.includes('einSchalterZeileHtml({ titel: "Nachts nicht stören"') && appQ.includes('einSchalterZeileHtml({ titel: "Dringendes trotzdem zustellen"'),
    'Nachts nicht stören und Dringendes als Schalterkarten');
  pruefe(appQ.includes(`return '<div class="ein-ruhezeiten" data-push-karte>' + inhalt + '</div>';`), 'Ruhezeiten ohne Rahmen um alles');
  pruefe(/viewEl\.addEventListener\("change"[\s\S]{0,200}data-pn-von"\)\) pnSetzen\(\{ quiet_from/.test(appQ), 'Speichern über den bestehenden change-Weg');

  // Stil: Trefferflaeche und Pille
  const regel = (sel) => { const i = cssQ.indexOf(sel + ' {'); return i < 0 ? '' : cssQ.slice(i, cssQ.indexOf('}', i)); };
  const feld = regel('.ein-zeit');
  pruefe(/height: 44px/.test(feld) && /opacity: 0/.test(feld) && /font-size: 16px/.test(feld), 'Zeitfeld 44 px hoch, unsichtbar, 16 px (kein Zoom unter iOS)');
  const pille = regel('.ein-zeit-pille');
  pruefe(/width: 70px; height: 36px/.test(pille) && /background: var\(--surface-6\)/.test(pille) && /font-size: 16px; font-weight: 700/.test(pille),
    'Pille 70 x 36, --surface-6, 16/700 (Vorlage)');

  // pn-* ist entfernt
  pruefe(!/class="pn-|"pn-[a-z]+[ "]/.test(ohneKommentar), 'app.js erzeugt keine pn-*-Klassen mehr');
  pruefe(!/\.pn-[a-z]/.test(cssQ), 'styles.css hat keine pn-*-Regeln mehr');

  // Umlaute statt Ersatzschreibung in sichtbaren Texten
  pruefe(appQ.includes('Ruhezeiten gelten für Benachrichtigungen. ') && appQ.includes('Die sind auf diesem Gerät noch nicht eingerichtet.'),
    'Hinweis-Zustand mit Umlauten');
  // Nur einzeilige Zeichenketten mit Leerzeichen (Saetze), Zeile fuer Zeile -
  // Template-Strings ueber mehrere Zeilen wuerden Code mitfassen. Interne
  // Schluessel wie "pruefen" oder "ueberweisung" stehen ohne Leerzeichen.
  const zeichenketten = ohneKommentar.split('\n')
    .flatMap((z) => z.match(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"/g) || [])
    .filter((t) => /\s/.test(t));
  const ersatz = zeichenketten.filter((t) => /\b(fuer|Fuer|ueber|Ueber|Geraet|geraet|koennen|duerfen|muessen|waehlen|loeschen|geloescht|geaendert)\b/.test(t));
  pruefe(ersatz.length === 0, 'keine ASCII-Ersatzschreibung in sichtbaren Texten von app.js', ersatz.slice(0, 3).join(' | ') || undefined);

  const pf = '.design-sync/reference/soll/07_einstellungen-v2_5-ruhezeiten.png';
  const b = fs.existsSync(pf) ? fs.readFileSync(pf) : null;
  pruefe(!!b && b.readUInt32BE(16) === 390 && b.readUInt32BE(20) === 844, 'Soll-Ausschnitt 5-ruhezeiten (390 x 844)');
}

/* ===== 11. Paket Einstellungen v2, E6: Kalender-Abo nach einst3.png ====== */
console.log('--- Einstellungen v2: Kalender-Abo (E6) ---');
{
  const appQ = fs.readFileSync('app.js', 'utf8');
  const zweig = (() => { const a = appQ.indexOf('} else if (id === "kalender") {'); const b = appQ.indexOf('} else if (id === "bfv") {', a); return a < 0 || b < 0 ? '' : appQ.slice(a, b); })();
  pruefe(zweig.includes('einZeileHtml({ attr: "data-cal-sheet"') && zweig.includes('titel: "Termine abonnieren", aktion: true, chev: false'),
    'Termine abonnieren: Aktionszeile (grün), öffnet das Abo-Blatt wie bisher');
  pruefe(zweig.includes('einZeileHtml({ attr: "data-cal-copy-profil"') && zweig.includes('titel: "Link kopieren", chev: false'),
    'Link kopieren: Zeile mit grauer Kachel, kopiert wie bisher');
  pruefe(zweig.indexOf('</div>') < zweig.indexOf('<p class="ein-hinweis">Alle Termine der Mannschaft'), 'Hinweis steht unter der Karte');
  pruefe(zweig.includes('data-cal-copied-profil hidden'), 'Rückmeldung nach dem Kopieren bleibt');
  pruefe(!zweig.includes('btn btn-primary') && !zweig.includes('btn btn-soft'), 'keine Vollknöpfe mehr');
  // einZeileHtml: freies Attribut und Aktionsoptik
  const z = E.einZeileHtml({ attr: 'data-cal-sheet', ic: '<svg></svg>', ton: 'gruen', titel: 'Termine abonnieren', aktion: true, chev: false });
  pruefe(/<button class="ein-zeile ein-zeile-aktion" type="button" data-cal-sheet>/.test(z) && !z.includes('ein-chev'), 'einZeileHtml: attr und aktion, ohne Chevron');
  pruefe(E.einIcon('kal-haken').includes('<svg') && E.einIcon('link').includes('<svg'), 'Symbole Kalender-Haken und Kettenglied');
  const pf = '.design-sync/reference/soll/07_einstellungen-v2_6-kalender-abo.png';
  const b = fs.existsSync(pf) ? fs.readFileSync(pf) : null;
  pruefe(!!b && b.readUInt32BE(16) === 390 && b.readUInt32BE(20) === 844, 'Soll-Ausschnitt 6-kalender-abo (390 x 844)');
}

console.log('');
console.log(fehler ? '--- ' + fehler + ' Beanstandung(en), ' + gut + ' ok ---'
                   : '--- bestanden (' + gut + ' Pruefungen) ---');
process.exit(fehler ? 1 : 0);
