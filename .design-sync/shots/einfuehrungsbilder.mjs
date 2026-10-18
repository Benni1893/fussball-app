/* Referenzbilder fuer Claude Design (Einfuehrung, 18.10.2026).
   Stand-in ohne Datenbank (SV Musterhausen, 16 Spieler, Termine, offene,
   gemeldete und bezahlte Strafen), 390 px, keine Verbindung zur Produktion.
   Je Rolle die Ansichten der Einfuehrung als ganze Seite, dazu Einzel-
   ausschnitte der Bausteine. Zustaende kommen aus der App-Landkarte
   (Klickweg je Schluessel, wie nsmess.mjs).
   Ausgabe: .design-sync/reference/einfuehrung/ist/<rolle>_<ansicht>.png,
            baustein_<name>.png und INDEX.md
   Aufruf:  node .design-sync/shots/einfuehrungsbilder.mjs                      */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { starte } from './server.mjs';
import { installiere, warteAufApp } from './landkartenmodul.mjs';
import { AUSLOESER, UEBERLAGERUNGEN, zustandImBrowser } from './landkartenregeln.mjs';
import { kandidatenImBrowser } from './landkarte.mjs';

const AUS = '.design-sync/reference/einfuehrung/ist';
fs.mkdirSync(AUS, { recursive: true });
for (const f of fs.readdirSync(AUS)) if (f.endsWith('.png')) fs.unlinkSync(path.join(AUS, f));
const lk = JSON.parse(fs.readFileSync('.design-sync/landkarte/landkarte.json', 'utf8'));

// Rollen der Einfuehrung -> Stand-in-Profil (+ Optionen) und Landkarten-Profil fuer die Klickwege
const ROLLEN = {
  spieler:        { titel: 'Spieler', profil: 'spieler', lk: 'spieler' },
  trainer:        { titel: 'Trainer (ohne Spielerrolle)', profil: 'trainer', lk: 'trainer', opts: { rollen: ['coach'], ohneSpieler: true } },
  kassenwart:     { titel: 'Kassenwart', profil: 'kassenwart', lk: 'kassenwart' },
  spielertrainer: { titel: 'Spielertrainer (Spieler + Trainer)', profil: 'trainer', lk: 'trainer' },
};

// Ansicht -> Landkarten-Schluessel, Nachbereitung, Beschreibung; nur fuer Rollen, die sie haben
const ANSICHTEN = [
  ['uebersicht', 'dashboard', null, 'Übersicht mit Hero (nächster Termin, Zu-/Absage), Danach, Mein Status, Kassenbanner'],
  ['kalender', 'kalender', null, 'Kalender mit Terminkarten und Zusage/Absage'],
  ['kalender-abo', 'kalender+calSheet', null, 'Blatt „Termine abonnieren“ (iPhone / Android)'],
  ['mein-status', 'dashboard+statusFenster', null, 'Mein Status: Blatt „Voraussichtlich bis“ mit Datum und Notiz'],
  ['konto-ich', 'strafen', async (p) => { const b = await p.$('[data-kseg="ich"]'); if (b) { await b.click(); await p.waitForTimeout(400); } }, 'Konto, Reiter Ich: Kontobanner, Chips, eigene Strafen'],
  ['konto-mannschaft', 'strafen', async (p) => { await p.click('[data-kseg="team"]'); await p.waitForTimeout(400); }, 'Konto, Reiter Mannschaft: Kassenbanner, Chips, Strafenliste des Teams'],
  ['rueckmeldungen', 'dashboard+rsvpSheet', null, 'Rückmeldungen-Blatt: Balken, Kacheln, Namenslisten, Push senden'],
  ['rueckmeldungen-push', 'dashboard+rsvpSheet+pushModal', null, 'Rückmeldungen-Blatt: Bestätigung „Push senden“'],
  ['trainer-spiel-waehlen', 'trainer', null, 'Trainer-Ansicht: Spiel wählen, Kader-Kachel, Vorlagen'],
  ['trainer-platz', 'trainer/spiel', null, 'Trainer-Ansicht: Platz mit Formation und Bank'],
  ['trainer-bank', 'trainer/spiel+tvSheetKader#bank', null, 'Trainer-Ansicht: Blatt Spieler für die Bank'],
  ['trainer-formation', 'trainer/spiel+tvSheetForm', null, 'Trainer-Ansicht: Formation wählen'],
  ['trainer-vorlagen', 'trainer+tvTplMenu', null, 'Trainer-Ansicht: Menü einer Vorlage'],
  ['kader', 'kader', null, 'Kader mit Kennzahlen und Status je Spieler'],
  ['kader-status', 'kader+statusBlatt', null, 'Kader: Status eines Spielers setzen'],
  ['einladung-anfragen', 'rollen-verwalten', null, 'Rollen verwalten: Einladung, Offene Anfragen, Mitglieder, Protokoll'],
  ['anfrage-freigeben', 'rollen-verwalten+freigabeBlatt', null, 'Blatt Anfrage freigeben mit Kader-Zuordnung'],
  ['kasse-pruefen', 'kasse/pruefen', null, 'Kasse, Reiter Prüfen und verbuchen'],
  ['kasse-offen', 'kasse/offen', null, 'Kasse, Reiter Offen'],
  ['kasse-eingegangen', 'kasse/bezahlt', null, 'Kasse, Reiter Eingegangen'],
  ['strafe-verhaengen', 'kasse/strafe-katalog+ksSeite', null, 'Strafe verhängen (Spieler und Strafen wählen)'],
  ['einstellungen', 'einstellungen', null, 'Einstellungen, Übersicht'],
  ['einstellungen-mitteilungen', 'einstellungen/mitteilungen', null, 'Einstellungen › Mitteilungen'],
  ['einstellungen-ruhezeiten', 'einstellungen/ruhezeiten', null, 'Einstellungen › Ruhezeiten'],
  ['einstellungen-kalender', 'einstellungen/kalender', null, 'Einstellungen › Kalender abonnieren'],
  ['einstellungen-bfv', 'einstellungen/bfv', null, 'Einstellungen › Spielplan BFV'],
  ['einstellungen-profil', 'einstellungen/profil', null, 'Einstellungen › Profil'],
  ['einstellungen-paypal', 'einstellungen/profil+paypalBlatt', null, 'Einstellungen › Profil › PayPal-Link'],
];

// Bausteine als Einzelausschnitt: [name, rolle, schluessel, selektor, beschreibung, nachbereitung]
const BAUSTEINE = [
  ['zusage-knoepfe', 'spieler', 'dashboard', '.tk .tk-rsvp', 'Zusage/Absage-Knöpfe der Terminkarte'],
  ['terminkarte', 'spieler', 'dashboard', '.tk', 'Terminkarte (Hero) mit Kopf, Ort, Meldeschluss, Zu-/Absage'],
  ['terminkarte-kalender', 'spieler', 'kalender', '.event-list .tk, .tk', 'Terminkarte im Kalender'],
  ['kassenbanner-spieler', 'spieler', 'dashboard', '.kb', 'Kassenbanner, Spieler-Sicht (nur lesend)'],
  ['kassenbanner-kassenwart', 'kassenwart', 'dashboard', '.kb', 'Kassenbanner, Kassenwart-Sicht (Pfeile, drei Sprungziele)'],
  ['status-chips', 'spieler', 'dashboard', '.st-wahl', 'Mein Status: Status-Chips (fit, angeschlagen, verletzt, Urlaub)'],
  ['kontobanner', 'spieler', 'strafen', '.mine-banner', 'Kontobanner (Reiter Ich)'],
  ['strafen-zeile', 'spieler', 'strafen', '.kt-row', 'Strafen-Zeile mit Betrag in Statusfarbe', async (p) => { await p.click('[data-kseg="team"]'); await p.waitForTimeout(400); }],
  ['mitteilungen-zeile', 'spieler', 'einstellungen/mitteilungen', '.sw', 'Mitteilungen-Zeile mit Schalter (.sw)', null, true],
  ['danach-liste', 'spieler', 'dashboard', '.dn-liste', 'Danach-Liste der nächsten Termine'],
  ['aufgaben', 'kassenwart', 'dashboard', '.task-list', 'Aufgabenblock'],
  ['bottom-nav-spieler', 'spieler', 'dashboard', '.app-nav', 'Untere Navigation, Spieler'],
  ['bottom-nav-trainer', 'trainer', 'dashboard', '.app-nav', 'Untere Navigation, Trainer'],
  ['bottom-nav-kassenwart', 'kassenwart', 'dashboard', '.app-nav', 'Untere Navigation, Kassenwart'],
  ['bottom-nav-spielertrainer', 'spielertrainer', 'dashboard', '.app-nav', 'Untere Navigation, Spielertrainer'],
];

const { server, basis } = await starte(process.cwd());
const browser = await chromium.launch({ channel: 'chrome' });
const index = [];
const fehlt = [];

// Ersatzwege, wenn der Klickweg der Landkarte (aufgezeichnet fuer Spieler + Trainer)
// beim reinen Trainer nicht passt: Sprungadresse bzw. Knopf direkt.
const ERSATZ = {
  'kader': async (p) => { await p.evaluate(() => { location.hash = '#ansicht=kader'; }); await p.waitForTimeout(800); return !!(await p.$('.kad-list, .kad-row')); },
  'dashboard+rsvpSheet': async (p) => { await p.click('[data-rsvp-sheet]'); await p.waitForTimeout(600); return !!(await p.$('#rsvpSheet .rs2-panel, .rs2-panel')); },
  'dashboard+rsvpSheet+pushModal': async (p) => { await p.click('[data-rsvp-sheet]'); await p.waitForTimeout(600); await p.click('[data-rs-push]'); await p.waitForTimeout(500); return !!(await p.$('#pushModal')); },
};

async function zustand(rolle, schluessel, initSkript) {
  const R = ROLLEN[rolle];
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    locale: 'de-DE', timezoneId: 'Europe/Berlin' });
  const page = await ctx.newPage();
  page.on('dialog', (d) => d.dismiss().catch(() => {}));
  if (initSkript) await page.addInitScript(initSkript);
  const inst = await installiere(page, R.profil, R.opts);
  await page.goto(basis, { waitUntil: 'load' });
  await warteAufApp(page);
  await page.evaluate(() => document.fonts.ready);
  if (schluessel) {
    const n = lk.profile[R.lk].knoten.find((k) => k.schluessel === schluessel);
    if (!n) { await ctx.close(); return null; }
    for (const s of n.pfad) {
      const z = await page.evaluate(zustandImBrowser, UEBERLAGERUNGEN);
      const ok = await page.evaluate(kandidatenImBrowser, { ausloeser: AUSLOESER, ueberlagerungen: UEBERLAGERUNGEN, oben: z.oben, istStart: s.global === true, nurArt: s.art, nurWert: s.wert });
      const gefunden = await page.evaluate(() => { const e = document.querySelector('[data-landkarte-ziel]'); if (!e) return false; e.removeAttribute('data-landkarte-ziel'); e.click(); return true; });
      if (!gefunden) {
        if (ERSATZ[schluessel]) {
          await page.goto(basis, { waitUntil: 'load' }); await warteAufApp(page);
          try { if (await ERSATZ[schluessel](page)) break; } catch (e) {}
        }
        await ctx.close(); return null;
      }
      await page.waitForTimeout(450);
    }
  }
  await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation:none!important;caret-color:transparent!important}' });
  await page.waitForTimeout(250);
  return { ctx, page, inst };
}

// Ganze Seite: das Dokument ist der Scrollbereich; offene Blaetter werden im Bildschirm aufgenommen
async function ganzeSeite(page, datei) {
  const blatt = await page.evaluate(() => !!document.querySelector('.more-sheet:not([hidden]), .nsb-ov, .tv-sheet.open, .rs2-panel, .modal-ov:not([hidden]), .ks-seite:not([hidden]), body.blatt-offen'));
  await page.screenshot({ path: datei, fullPage: !blatt });
}

for (const [rolle, R] of Object.entries(ROLLEN)) {
  for (const [name, schluessel, nach, text] of ANSICHTEN) {
    // Nur, was es fuer die Rolle wirklich gibt (Klickweg in der Landkarte vorhanden)
    if (!lk.profile[R.lk].knoten.some((k) => k.schluessel === schluessel)) continue;
    if (rolle === 'trainer' && /status|konto-ich|statusFenster/.test(name + schluessel)) continue;   // ohne Kadereintrag kein eigener Status
    const z = await zustand(rolle, schluessel);
    if (!z) { fehlt.push(rolle + '/' + name + ' (Klickweg ' + schluessel + ' nicht nachspielbar' + (rolle === 'trainer' ? ', Ansicht gleich wie spielertrainer_' + name + '.png' : '') + ')'); continue; }
    if (nach) { try { await nach(z.page); } catch (e) { fehlt.push(rolle + '/' + name + ': ' + e.message.split('\n')[0]); await z.ctx.close(); continue; } }
    const datei = `${rolle}_${name}.png`;
    await ganzeSeite(z.page, path.join(AUS, datei));
    const b = await z.inst.bericht();
    index.push([datei, R.titel, text + (b.fehler.length ? ' (Hinweis Stand-in: ' + b.fehler.length + ' Fehler)' : '')]);
    console.log('Bild  ' + datei);
    await z.ctx.close();
  }
}

// Push-Erlaubnis-Schritt der Einfuehrung: neues Konto, gestartet als Home-Bildschirm-App
{
  const standalone = () => {
    const mm = window.matchMedia.bind(window);
    window.matchMedia = (q) => (/display-mode:\s*standalone/.test(q) ? { matches: true, media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} } : mm(q));
    try { localStorage.setItem('fn_ob_home', '1'); } catch (e) {}
  };
  const R = ROLLEN.spieler;
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'de-DE' });
  const page = await ctx.newPage();
  await page.addInitScript(standalone);
  await installiere(page, 'wartend');
  await page.goto(basis, { waitUntil: 'load' }); await warteAufApp(page);
  const schritte = [['datenschutz', 'Einführung Schritt Datenschutz (Zustimmung, Gesundheitsangaben mit Alters-Haken)'],
                    ['position', 'Einführung Schritt Position'], ['push', 'Einführung Schritt Mitteilungen erlauben (Home-Bildschirm-App)']];
  for (const [s, text] of schritte) {
    const ist = await page.evaluate(() => (document.querySelector('[data-ob-schritt]') || {}).dataset?.obSchritt || '');
    if (ist !== s) { fehlt.push('einfuehrung/' + s + ' (Schritt ist ' + (ist || 'keiner') + ')'); break; }
    await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation:none!important}' });
    const datei = `neu_einfuehrung-${s}.png`;
    await page.screenshot({ path: path.join(AUS, datei), fullPage: true });
    index.push([datei, 'Neues Mitglied', text]);
    console.log('Bild  ' + datei);
    if (s === 'datenschutz') { await page.click('[data-ob-ds]'); await page.click('[data-ob="datenschutz"]'); }
    if (s === 'position') { await page.click('[data-ob-pos="mittelfeld"]'); await page.click('[data-ob="position"]'); }
    await page.waitForTimeout(500);
  }
  // Wartebildschirm ohne Push (Schritt ueberspringen)
  const p2 = await page.$('[data-ob="push-spaeter"]'); if (p2) { await p2.click(); await page.waitForTimeout(500); }
  if (await page.evaluate(() => (document.querySelector('[data-ob-schritt]') || {}).dataset?.obSchritt === 'warten')) {
    await page.screenshot({ path: path.join(AUS, 'neu_einfuehrung-warten.png'), fullPage: true });
    index.push(['neu_einfuehrung-warten.png', 'Neues Mitglied', 'Einführung: Warte auf Freigabe']);
  }
  await ctx.close();
}

// Bausteine
for (const [name, rolle, schluessel, sel, text, nach, zeile] of BAUSTEINE) {
  const z = await zustand(rolle, schluessel);
  if (!z) { fehlt.push('baustein/' + name); continue; }
  if (nach) await nach(z.page);
  let el = await z.page.$(sel);
  if (el && zeile) el = await el.evaluateHandle((e) => e.closest('.ein-schalter-zeile, .ein-zeile, .pn-zeile, .row, li, div') || e);
  if (!el) { fehlt.push('baustein/' + name + ' (' + sel + ' nicht gefunden)'); await z.ctx.close(); continue; }
  await el.evaluate((e) => e.scrollIntoView({ block: 'center' }));
  const datei = `baustein_${name}.png`;
  await el.screenshot({ path: path.join(AUS, datei) });
  index.push([datei, ROLLEN[rolle].titel, text]);
  console.log('Bild  ' + datei);
  await z.ctx.close();
}

await browser.close(); server.close();

const proRolle = {};
for (const [d] of index) { const r = d.split('_')[0]; proRolle[r] = (proRolle[r] || 0) + 1; }
const md = ['# Referenz für Claude Design: Einführung, Ist-Stand der App', '',
  'Erzeugt mit `.design-sync/shots/einfuehrungsbilder.mjs` am ' + new Date().toLocaleString('de-DE', { timeZone: 'Europe/Berlin' }) + '.',
  'Stand-in ohne Datenbank: erfundene Mannschaft „SV Musterhausen 2“, 16 Spieler, mehrere Termine, offene, gemeldete und bezahlte Strafen.',
  'Breite 390 px, Faktor 2. Ganze Seiten als `<rolle>_<ansicht>.png`, offene Blätter im Bildschirmausschnitt, Bausteine als `baustein_<name>.png`.', '',
  'Rollen: Spieler · Trainer (ohne Spielerrolle) · Kassenwart · Spielertrainer (Spieler + Trainer) · Neues Mitglied (Einführung).', '',
  '| Datei | Rolle | Zu sehen |', '|---|---|---|',
  ...index.map(([d, r, t]) => `| \`${d}\` | ${r} | ${t} |`), '',
  '## Anzahl je Rolle', '', ...Object.entries(proRolle).map(([r, n]) => `- ${r}: ${n}`), '',
  ...(fehlt.length ? ['## Nicht aufgenommen', '', ...fehlt.map((f) => '- ' + f), ''] : [])];
fs.writeFileSync(path.join(AUS, 'INDEX.md'), md.join('\n'), 'utf8');
console.log('\n' + index.length + ' Bilder, ' + fehlt.length + ' nicht aufgenommen');
for (const f of fehlt) console.log('  fehlt: ' + f);
