/* Rendert die neue Kasse mit den Beispieldaten der Vorlage bei 390 px und
   legt die Bilder neben _neukasse.png ab. Das Markup kommt woertlich aus
   app.js (kassemodul.mjs), nicht aus einem Nachbau - sonst misst die
   Gegenprobe das Skript und nicht die App.

   Aufruf: node .design-sync/shots/kassebild.mjs                            */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ladeKasse, SPIELER, SPIELER_BY_ID, beispielDaten, KATALOG } from './kassemodul.mjs';

const ZIEL = '.design-sync/reference/compare';
fs.mkdirSync(ZIEL, { recursive: true });

const M = ladeKasse();
M.setDaten(SPIELER_BY_ID, { katalog: KATALOG, strafen: [], players: SPIELER });
const DATEN = beispielDaten();
const HAKEN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
  'stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';

// Zustand zurueck auf Anfang, damit kein Bild vom vorigen erbt.
function frisch() {
  M.kasse.tab = 'pruefen'; M.kasse.seite = null;
  M.kasse.bloecke = { katalog: false, indiv: false };
  M.kasse.players = []; M.kasse.items = {}; M.kasse.bezug = {}; M.kasse.indiv = [];
  M.kasse.indivBetrag = ''; M.kasse.indivGrund = ''; M.kasse.comment = '';
  M.kasse.filter = { offen: M.ksFilterNeu(), bezahlt: M.ksFilterNeu() };
}

/* Der Rahmen der App: Kopfband, Inhaltsspalte, Bottom-Nav. Nur so viel, dass
   die Kasse an derselben Stelle sitzt wie in der Vorlage. */
function seite(inhalt, extra = '') {
  return `<!doctype html>
<html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="../../../styles.css">
<style>
  html, body { margin: 0; }
  body { background: var(--grad-app); }
  .huelle { width: 390px; padding: 0 16px 24px; }
  .kopf { height: 56px; background: var(--grad-hd); margin: 0 -16px 0; }
  ${extra}
</style></head>
<body><div class="huelle"><div class="kopf"></div>${inhalt}</div></body></html>`;
}

async function schuss(p, html, datei, hoehe) {
  const f = path.join(ZIEL, '_tmp.html');
  fs.writeFileSync(f, html);
  await p.goto(pathToFileURL(path.resolve(f)).href);
  await p.waitForTimeout(180);
  await p.setViewportSize({ width: 390, height: hoehe || 844 });
  await p.screenshot({ path: path.join(ZIEL, datei), fullPage: !hoehe });
  console.log('  ' + datei);
}

/* Waagerechter Ueberlauf ist ein harter Fehler: auf dem iPhone wackelt sonst
   die ganze Seite. Wird je Ansicht geprueft, nicht nur einmal. */
async function ueberlauf(p, name) {
  const b = await p.evaluate(() => ({
    doc: document.documentElement.scrollWidth,
    fenster: window.innerWidth,
    schuldige: [...document.querySelectorAll('*')]
      .filter((e) => e.getBoundingClientRect().right > window.innerWidth + 0.5)
      .slice(0, 5).map((e) => e.className || e.tagName),
  }));
  if (b.doc > b.fenster + 0.5) {
    console.log('  !! waagerechter Überlauf in ' + name + ': ' + b.doc + ' > ' + b.fenster +
      (b.schuldige.length ? ' (' + b.schuldige.join(', ') + ')' : ''));
    return 1;
  }
  return 0;
}

/* Ein fester Knopf am unteren Rand nuetzt nichts, wenn er unter der Tastatur
   liegt. Geprueft wird am gerenderten Bild, nicht an der Absicht. */
async function knopfSichtbar(p, sel, name) {
  const m = await p.evaluate((s) => {
    const b = document.querySelector(s);
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { unten: Math.round(r.bottom), fenster: window.innerHeight, ok: r.bottom <= window.innerHeight + 1 };
  }, sel);
  if (!m) { console.log('  !! ' + name + ': Knopf nicht gefunden'); return 1; }
  if (!m.ok) { console.log('  !! ' + name + ': liegt bei ' + m.unten + ', Fenster ' + m.fenster); return 1; }
  console.log('  ' + name + ' sitzt bei ' + m.unten + ' von ' + m.fenster + ' px');
  return 0;
}

const br = await chromium.launch({ channel: 'chrome' });
const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
  isMobile: true, hasTouch: true });
const p = await ctx.newPage();
let fehler = 0;

console.log('--- Die drei Reiter mit den Zahlen der Vorlage ---');
for (const [tab, datei] of [['pruefen', 'neu-1-pruefen.png'], ['offen', 'neu-2-offen.png'], ['bezahlt', 'neu-4-eingegangen.png']]) {
  frisch(); M.kasse.tab = tab;
  await schuss(p, seite(M.kasseHtml(DATEN)), datei, tab === 'offen' ? 900 : 844);
  fehler += await ueberlauf(p, tab);
}

console.log('--- Leerzustand je Reiter ---');
for (const [tab, datei] of [['pruefen', 'leer-pruefen.png'], ['offen', 'leer-offen.png'], ['bezahlt', 'leer-eingegangen.png']]) {
  M.kasse.tab = tab;
  await schuss(p, seite(M.kasseHtml([])), datei, 640);
  fehler += await ueberlauf(p, 'leer-' + tab);
}

console.log('--- Sehr langer Name ---');
{
  const lang = JSON.parse(JSON.stringify(DATEN.filter((s) => s.st === 'offen').slice(0, 3)));
  const name = 'Maximilian Konstantin von Hohenberg-Lichtenstein';
  lang.forEach((s) => { s.player = { id: 'pX', name: name }; s.playerId = 'pX'; });
  M.setDaten({ ...SPIELER_BY_ID, pX: { id: 'pX', name: name } }, { katalog: KATALOG, strafen: [], players: SPIELER });
  M.kasse.tab = 'offen';
  await schuss(p, seite(M.kasseHtml(lang)), 'lang-offen.png', 640);
  fehler += await ueberlauf(p, 'langer Name offen');
  const langB = JSON.parse(JSON.stringify(DATEN.filter((s) => s.st === 'bestätigt').slice(0, 4)));
  langB.forEach((s) => { s.player = { id: 'pX', name: name }; s.playerId = 'pX'; });
  M.kasse.tab = 'bezahlt';
  await schuss(p, seite(M.kasseHtml(langB)), 'lang-eingegangen.png', 520);
  fehler += await ueberlauf(p, 'langer Name eingegangen');
  const langP = JSON.parse(JSON.stringify(DATEN.filter((s) => s.st === 'gemeldet')));
  langP.forEach((s) => { s.player = { id: 'pX', name: name }; s.playerId = 'pX'; });
  M.kasse.tab = 'pruefen';
  await schuss(p, seite(M.kasseHtml(langP)), 'lang-pruefen.png', 700);
  fehler += await ueberlauf(p, 'langer Name pruefen');
  M.setDaten(SPIELER_BY_ID, { katalog: KATALOG, strafen: [], players: SPIELER });
}

console.log('--- 140 offene Strafen, ganze Länge ---');
{
  M.kasse.tab = 'offen';
  await schuss(p, seite(M.kasseHtml(DATEN)), 'offen-140-ganz.png', null);
  const h = await p.evaluate(() => document.documentElement.scrollHeight);
  console.log('  Gesamthöhe ' + h + ' px bei 140 Einträgen');
}

/* --- Blatt und Wähler ---------------------------------------------------
   Die Blaetter haengen im echten Bauteil (.tv-sheet). Fuer das Bild wird das
   Markup so eingesetzt, wie ksBlattRender() es erzeugt - wortgleich aus
   app.js gelesen, damit kein zweiter Aufbau entsteht. */
const appQuelle = fs.readFileSync('app.js', 'utf8');
function blattMarkup(art, s, zahlart) {
  const euro = (n) => n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }).replace(/\s/g, ' ');
  const summe = `<div class="ks-bl-sum">
        <div class="ks-bl-top"><span class="ks-bl-n">${s.player.name}</span><span class="ks-bl-b num">${euro(s.betrag)}</span></div>
        <div class="ks-bl-s">${s.vergehen} · ${M.fmtKurz(s.datum)}</div>
      </div>`;
  if (art === 'buchen') {
    const chips = M.KASSE_ZAHLARTEN.map(([k, label]) =>
      `<button type="button" class="zart${zahlart === k ? ' is-on' : ''}">${M.zartIconHtml(k)}<span>${label}</span></button>`).join('');
    return summe + `<div class="lbl ks-bl-lbl">Zahlart</div><div class="zart-row">${chips}</div>` +
      (s.sagtZahlart ? '<div class="ks-bl-h">Vorausgewählt nach Angabe des Spielers.</div>' : '') +
      `<button class="btn btn-primary ks-bl-cta">${euro(s.betrag)} ${M.ZAHLART_LABEL[zahlart]} buchen</button>`;
  }
  return summe + M.ksSagtHtml(s) +
    '<div class="lbl ks-bl-lbl">Verlauf</div><div class="fine-hist-body">' +
    '<div class="hist-line">16.09.2026, 09:12 · angelegt → offen</div>' +
    '<div class="hist-line">22.09.2026, 18:42 · offen → gemeldet · bar</div></div>' +
    (s.st === 'bestätigt' ? '<button class="btn ks-bl-cta">Buchung rückgängig</button>' : '');
}

function blattSeite(kopf, body, extraKlasse = '', fuss = '') {
  return seite('', `
    .tv-scrim { opacity: 1; }
    .tv-sheet { transform: translateY(0); }
  `).replace('</div></body>',
    '</div><div class="tv-scrim open"></div>' +
    '<div class="tv-sheet ks-bl ' + extraKlasse + ' open"><div class="tv-sh"><span class="tv-grip"></span><strong>' + kopf +
    '</strong><button class="tv-shx" aria-label="Schließen">&times;</button></div>' +
    '<div class="tv-shbody">' + body + '</div>' + fuss + '</div></body>');
}

/* Ein Vollbild-Blatt (tv-kfull), fuer „Spieler suchen" und den Waehler. */
function vollbildSeite(inhalt, extraKlasse = '') {
  return seite('', `
    .tv-scrim { opacity: 1; }
    .tv-sheet.tv-kfull { transform: translateY(0); }
  `).replace('</div></body>',
    '</div><div class="tv-scrim open"></div>' +
    '<div class="tv-sheet tv-kfull ' + extraKlasse + ' open">' + inhalt + '</div></body>');
}

console.log('--- Blatt „Als bezahlt buchen" und Detail ---');
{
  const s = DATEN.find((x) => x.id === 'o1');
  await schuss(p, blattSeite('Als bezahlt buchen', blattMarkup('buchen', s, s.sagtZahlart)), 'neu-3-buchen.png', 844);
  fehler += await ueberlauf(p, 'Buchen-Blatt');
  const b = DATEN.find((x) => x.st === 'bestätigt');
  await schuss(p, blattSeite('Strafe', blattMarkup('detail', b, null)), 'blatt-detail.png', 844);
  fehler += await ueberlauf(p, 'Detail-Blatt');
}

console.log('--- Vollbild-Wähler „Strafe verhängen" ---');
{
  const waehler = vollbildSeite(
      '<div class="tv-sh"><strong>Strafe verhängen</strong><button class="tv-shx" aria-label="Schließen">&times;</button></div>' +
      '<div class="tv-shbody">' +
        '<button type="button" class="ks-wahl-b"><span class="ks-wahl-t">Strafe aus Katalog hinzufügen</span>' +
        '<span class="ks-wahl-s">Aus dem Strafenkatalog wählen, mit Menge oder Bezugsgröße.</span></button>' +
        '<button type="button" class="ks-wahl-b"><span class="ks-wahl-t">Individuelle Strafe</span>' +
        '<span class="ks-wahl-s">Freier Grund und freier Betrag.</span></button></div>' +
      '<div class="ks-wahl-f"><button type="button" class="btn">Schließen</button></div>', 'ks-wahl');
  await schuss(p, waehler, 'waehler.png', 844);
  fehler += await ueberlauf(p, 'Wähler');
}

console.log('--- Spieleransicht „Zahlung melden" ---');
for (const [art, note, datei] of [[null, '', 'zm-leer.png'], ['bar', 'zahle bar am Donnerstag', 'zm-gefuellt.png']]) {
  const chips = M.KASSE_ZAHLARTEN.map(([k, label]) =>
    `<button type="button" class="zart${art === k ? ' is-on' : ''}">${M.zartIconHtml(k)}<span>${label}</span></button>`).join('');
  const body =
    '<div class="ks-bl-sum"><div class="ks-bl-top"><span class="ks-bl-n">Offener Betrag</span>' +
    '<span class="ks-bl-b num">128,50 €</span></div>' +
    '<div class="ks-bl-s">7 Strafen werden als gemeldet markiert.</div></div>' +
    '<div class="lbl ks-bl-lbl">Zahlart</div><div class="zart-row">' + chips + '</div>' +
    '<div class="lbl ks-bl-lbl zm-lbl">Notiz <span class="zm-opt">freiwillig</span>' +
    '<span class="zm-zahl">' + note.length + '/140</span></div>' +
    '<textarea class="kasse-in zm-note" rows="2" placeholder="zahle bar am Donnerstag">' + note + '</textarea>' +
    '<button class="btn btn-primary ks-bl-cta"' + (art ? '' : ' disabled') + '>Zahlung melden</button>';
  await schuss(p, blattSeite('Zahlung melden', body), datei, 844);
  fehler += await ueberlauf(p, 'Zahlung melden ' + (art || 'leer'));
}

/* Die Eingabeseite haengt in der App an <body>, nicht in der Ansicht. Fuer das
   Bild wird sie genauso eingehaengt: direkt im <body>, ohne Huelle. */
function seiteVollbild(inhalt) {
  return seite('').replace('</body>', inhalt + '</body>');
}

console.log('--- Die beiden „Strafe verhängen"-Seiten ---');
for (const [modus, datei] of [['katalog', 'seite-katalog.png'], ['indiv', 'seite-indiv.png']]) {
  frisch();
  M.kasse.seite = modus;
  M.kasse.bloecke = { katalog: modus === 'katalog', indiv: modus === 'indiv' };
  M.kasse.players = ['p1', 'p2', 'p4'];
  if (modus === 'katalog') M.kasse.items = { k1: { menge: 2 } };
  else M.kasse.indiv = [{ betrag: '7,50', grund: 'Trikot vergessen' }];
  await schuss(p, seiteVollbild(M.ksSeiteHtml()), datei, 844);
  fehler += await ueberlauf(p, 'Seite ' + modus);
}

/* Mit offener Tastatur: iOS verkleinert das sichtbare Fenster, es bleiben rund
   420 px. Der Speichern-Knopf muss auch dann erreichbar bleiben. */
console.log('--- Die Seiten mit offener Tastatur (420 px hoch) ---');
for (const [modus, datei] of [['katalog', 'seite-katalog-tastatur.png'], ['indiv', 'seite-indiv-tastatur.png']]) {
  frisch();
  M.kasse.seite = modus;
  M.kasse.bloecke = { katalog: modus === 'katalog', indiv: modus === 'indiv' };
  M.kasse.players = ['p1', 'p2', 'p4'];
  if (modus === 'katalog') M.kasse.items = { k1: { menge: 1 } };
  else { M.kasse.indivBetrag = '7,50'; M.kasse.indivGrund = 'Trikot'; }
  await p.setViewportSize({ width: 390, height: 420 });
  await schuss(p, seiteVollbild(M.ksSeiteHtml()), datei, 420);
  fehler += await knopfSichtbar(p, '.ks-fuss-btn', 'Speichern (' + modus + ')');
  await p.setViewportSize({ width: 390, height: 844 });
}
frisch();

console.log('--- Filter: Leiste, gefilterte Liste, ohne Treffer ---');
{
  frisch();
  M.kasse.tab = 'offen';
  M.kasse.filter.offen = { spieler: ['p2'], sort: 'betrag', zeit: '30' };
  await schuss(p, seite(M.kasseHtml(DATEN)), 'filter-offen.png', 844);
  fehler += await ueberlauf(p, 'Filter offen');

  M.kasse.tab = 'bezahlt';
  M.kasse.filter.bezahlt = { spieler: ['p1'], sort: 'neu', zeit: 'alle' };
  await schuss(p, seite(M.kasseHtml(DATEN)), 'filter-eingegangen.png', 700);
  fehler += await ueberlauf(p, 'Filter eingegangen');

  // Leerzustand einer gefilterten Liste - nicht zu verwechseln mit „nichts da".
  M.kasse.tab = 'offen';
  M.kasse.filter.offen = { spieler: ['p7'], sort: 'neu', zeit: 'heute' };
  const alt = DATEN.filter((s) => s.st !== 'offen')
    .concat(DATEN.filter((s) => s.st === 'offen').slice(0, 5).map((s) => ({ ...s, datum: '2026-01-02' })));
  await schuss(p, seite(M.kasseHtml(alt)), 'filter-leer.png', 700);
  fehler += await ueberlauf(p, 'Filter ohne Treffer');
  frisch();
}

console.log('--- Filter-Blatt ---');
{
  const wahl = (liste, wert, attr) => `<div class="ks-wahlliste">${liste.map(([k, label]) =>
    `<button type="button" class="ks-wahlz${wert === k ? ' is-on' : ''}" ${attr}="${k}">
      <span>${label}</span><span class="ks-check">${wert === k ? HAKEN : ''}</span></button>`).join('')}</div>`;
  const body =
    '<button type="button" class="ks-fl-suche">' +
      '<span class="ks-zi">' + M.ICON_LUPE + '</span>' +
      '<span class="ks-fl-suche-t">Spieler suchen</span>' +
      '<span class="ks-fl-suche-n">2 gewählt</span>' +
      '<span class="kasse-picker-arrow">›</span></button>' +
    M.ksGewaehltChipsHtml(['p2', 'p4'], 'data-x') +
    '<div class="lbl ks-bl-lbl">Sortierung</div>' + wahl(M.KS_SORT.offen, 'betrag', 'data-s') +
    '<div class="lbl ks-bl-lbl">Zeitraum</div>' + wahl(M.KS_ZEIT, '30', 'data-z') +
    '<div class="ks-fl-hinweis">Der Zeitraum zählt ab dem Datum der Strafe.</div>';
  const fuss =
    '<div class="ks-fl-fuss"><button type="button" class="btn">Filter zurücksetzen</button>' +
    '<button type="button" class="btn btn-primary">Anwenden</button></div>';
  await schuss(p, blattSeite('Filter', body, 'ks-flbl', fuss), 'filter-blatt.png', 844);
  fehler += await ueberlauf(p, 'Filter-Blatt');
}

console.log('--- Vollbild „Spieler suchen" ---');
for (const [frage, gewaehlt, hoehe, datei] of [
  ['',   ['p2'],       844, 'suche-leer.png'],
  ['ko', ['p2', 'p4'], 420, 'suche-tastatur.png'],   // 420 px = Tastatur offen
]) {
  const inhalt =
    '<div class="tv-sh"><strong>Spieler suchen</strong>' +
    '<button class="ks-done">Fertig</button></div>' +
    M.ksSuchfeldHtml('ksSuIn', frage, 'Name eingeben') +
    M.ksGewaehltChipsHtml(gewaehlt, 'data-x') +
    '<div class="tv-shbody">' + M.ksSpielerZeilenHtml(gewaehlt, frage, 'data-p') + '</div>';
  await p.setViewportSize({ width: 390, height: hoehe });
  await schuss(p, vollbildSeite(inhalt, 'ks-such'), datei, hoehe);
  fehler += await ueberlauf(p, 'Spieler suchen ' + (frage || 'leer'));
  await p.setViewportSize({ width: 390, height: 844 });
}

console.log('--- Spielerauswahl ---');
{
  const auswahl = (gewaehlt, frage) =>
    '<div class="tv-sh"><strong>Spieler auswählen</strong>' +
    '<button class="tv-shx" aria-label="Schließen">&times;</button></div>' +
    M.ksSuchfeldHtml('ksSuche', frage, 'Suchen') +
    M.ksGewaehltChipsHtml(gewaehlt, 'data-weg') +
    '<div class="tv-shbody">' + M.ksSpielerZeilenHtml(gewaehlt, frage, 'data-p') + '</div>' +
    '<div class="ks-fuss"><button type="button" class="btn btn-primary ks-fuss-btn"' +
    (gewaehlt.length ? '' : ' disabled') + '>' +
    (gewaehlt.length ? 'Weiter mit ' + gewaehlt.length + (gewaehlt.length === 1 ? ' Spieler' : ' Spielern') : 'Weiter') +
    '</button></div>';

  for (const [gewaehlt, frage, hoehe, datei, name] of [
    [[],                   '',   844, 'auswahl-0.png', 'keiner gewählt'],
    [['p2'],               '',   844, 'auswahl-1.png', 'einer gewählt'],
    [['p1', 'p2', 'p4'],   '',   844, 'auswahl-3.png', 'drei gewählt'],
    [['p2'],               'ko', 420, 'auswahl-tastatur.png', 'mit Tastatur'],
  ]) {
    await p.setViewportSize({ width: 390, height: hoehe });
    await schuss(p, vollbildSeite(auswahl(gewaehlt, frage), 'ks-such'), datei, hoehe);
    fehler += await ueberlauf(p, 'Spielerauswahl, ' + name);
    fehler += await knopfSichtbar(p, '.ks-fuss-btn', 'Weiter (' + name + ')');
    // Der Knopf darf den letzten Listeneintrag nicht verdecken.
    const frei = await p.evaluate(() => {
      const letzte = [...document.querySelectorAll('.ks-prow')].pop();
      const fuss = document.querySelector('.ks-fuss');
      if (!letzte || !fuss) return true;
      return letzte.getBoundingClientRect().bottom <= fuss.getBoundingClientRect().top + 0.5
          || letzte.getBoundingClientRect().top > window.innerHeight;   // ausserhalb: scrollt
    });
    if (!frei) { console.log('  !! der Knopf verdeckt den letzten Eintrag'); fehler++; }
    await p.setViewportSize({ width: 390, height: 844 });
  }
  // Der Knopf ist bei null Spielern wirklich gesperrt.
  await p.setViewportSize({ width: 390, height: 844 });
  await schuss(p, vollbildSeite(auswahl([], ''), 'ks-such'), 'auswahl-0.png', 844);
  const gesperrt = await p.evaluate(() => {
    const b = document.querySelector('.ks-fuss-btn');
    return !!(b && b.disabled);
  });
  console.log('  ' + (gesperrt ? 'ok  ' : 'FEHL') + ' bei null Spielern ist „Weiter" gesperrt');
  if (!gesperrt) fehler++;
}

/* --- Die Ursache des Scroll-Bugs, nachgestellt ---------------------------
   scrollbug.webp entstand so: Pull-to-Refresh setzt beim Ziehen einen
   `transform` auf den Scroll-Container. Ein transformierter Vorfahre wird zum
   Bezugsrahmen fuer `position: fixed` - die Seite darin rutscht unter die
   Kopfzeile und faellt auf die Hoehe ihres Containers zusammen.
   Hier wird beides nebeneinander gemessen: drin kaputt, an <body> heil. */
console.log('--- Warum die Seite an <body> hängt ---');
{
  const html = seite('').replace('</body>',
    '<div id="behaelter" style="transform: translateY(70px)">' +
    '  <div class="ks-seite" id="drin"><div class="ks-seite-kopf">A</div>' +
    '  <div class="ks-seite-body">B</div><div class="ks-fuss">C</div></div>' +
    '</div>' +
    '<div class="ks-seite" id="draussen"><div class="ks-seite-kopf">A</div>' +
    '<div class="ks-seite-body">B</div><div class="ks-fuss">C</div></div>' +
    '</body>');
  const f = path.join(ZIEL, '_tmp.html');
  fs.writeFileSync(f, html);
  await p.goto(pathToFileURL(path.resolve(f)).href);
  const m = await p.evaluate(() => {
    const r = (id) => {
      const b = document.getElementById(id).getBoundingClientRect();
      return { oben: Math.round(b.top), hoehe: Math.round(b.height) };
    };
    return { drin: r('drin'), draussen: r('draussen'), fenster: window.innerHeight };
  });
  const sag = (ok, text, detail) => {
    console.log('  ' + (ok ? 'ok  ' : 'FEHL') + ' ' + text + (detail ? '   ' + detail : ''));
    if (!ok) fehler++;
  };
  sag(m.drin.oben !== 0 || m.drin.hoehe !== m.fenster,
    'im transformierten Container ist position:fixed kaputt',
    'oben ' + m.drin.oben + ', Höhe ' + m.drin.hoehe);
  sag(m.draussen.oben === 0 && m.draussen.hoehe === m.fenster,
    'an <body> füllt sie den Bildschirm',
    'oben ' + m.draussen.oben + ', Höhe ' + m.draussen.hoehe + ' von ' + m.fenster);
}


console.log('--- Scroll-Sperre ---');
{
  const quelle = fs.readFileSync('app.js', 'utf8');
  const teil = (a, b) => {
    const i = quelle.indexOf(a), j = quelle.indexOf(b, i);
    if (i < 0 || j < 0) throw new Error('Anker nicht gefunden: ' + a);
    return quelle.slice(i, j);
  };
  const steuerung = teil('  let _scrollLocks = 0, _scrollLockY = 0;', '  function closeTerminModal()');

  const html = seite('<div style="height:3000px"></div>')
    .replace('</body>',
      '<nav class="app-nav"><button class="nav-btn">A</button></nav>' +
      '<div class="tv-scrim" id="tScrim"></div>' +
      '<div class="tv-sheet" id="tSheet"><div class="tv-shbody" style="height:200px">Blatt</div></div>' +
      '<script>' + steuerung + '\nwindow.blattAuf = blattAuf; window.blattZu = blattZu;<\/script></body>');
  const f = path.join(ZIEL, '_tmp.html');
  fs.writeFileSync(f, html);
  await p.goto(pathToFileURL(path.resolve(f)).href);

  const mess = await p.evaluate(async () => {
    const warte = () => new Promise((r) => setTimeout(r, 60));
    window.scrollTo(0, 300); await warte();
    const vorher = Math.round(window.scrollY);

    window.blattAuf('tScrim', 'tSheet'); await warte();
    const st = getComputedStyle(document.body);
    const navCs = getComputedStyle(document.querySelector('.app-nav'));
    const navWeg = navCs.pointerEvents === 'none' && navCs.transform !== 'none';
    await new Promise((r) => setTimeout(r, 320));   // die Bewegung abwarten
    const navUnsichtbar = getComputedStyle(document.querySelector('.app-nav')).visibility === 'hidden';
    const fixiert = st.position === 'fixed';
    const gemerkt = document.body.style.top;

    // Der Versuch, den Hintergrund zu scrollen, darf nichts bewegen.
    window.scrollTo(0, 1200); await warte();
    const nachVersuch = Math.round(window.scrollY);

    window.blattZu('tScrim', 'tSheet'); await warte();
    const nachher = Math.round(window.scrollY);
    const frei = getComputedStyle(document.body).position !== 'fixed';
    const navDa = getComputedStyle(document.querySelector('.app-nav')).visibility !== 'hidden';
    return { vorher, fixiert, gemerkt, navWeg, navUnsichtbar, nachVersuch, nachher, frei, navDa };
  });

  const sag = (ok, text, detail) => {
    console.log('  ' + (ok ? 'ok  ' : 'FEHL') + ' ' + text + (detail ? '   ' + detail : ''));
    if (!ok) fehler++;
  };
  sag(mess.vorher === 300, 'Ausgangslage: 300 px gescrollt', mess.vorher + ' px');
  sag(mess.fixiert, 'offenes Blatt: body ist fixiert');
  sag(mess.gemerkt === '-300px', 'die Scrollposition ist gemerkt', mess.gemerkt);
  sag(mess.navWeg, 'die untere Navigation fährt weg und ist nicht antippbar');
  sag(mess.navUnsichtbar, 'und ist danach auch für Screenreader weg');
  sag(mess.nachVersuch === 0, 'der Hintergrund lässt sich nicht scrollen', mess.nachVersuch + ' px');
  sag(mess.frei, 'nach dem Schließen ist der body wieder frei');
  sag(mess.navDa, 'und die Navigation zurück');
  sag(mess.nachher === 300, 'die Scrollposition ist exakt wiederhergestellt', mess.nachher + ' px');

  // Verschachtelt: Filter-Blatt, darüber die Spielersuche.
  const stapel = await p.evaluate(async () => {
    const warte = () => new Promise((r) => setTimeout(r, 40));
    window.scrollTo(0, 500); await warte();
    window.blattAuf('tScrim', 'tSheet');
    window.blattAuf('tScrim', 'tSheet2');   // gibt es nicht -> darf nichts zählen
    const nachFalsch = document.body.style.top;
    window.blattZu('tScrim', 'tSheet2');    // ebenso
    const nochFixiert = getComputedStyle(document.body).position === 'fixed';
    window.blattZu('tScrim', 'tSheet'); await warte();
    return { nachFalsch, nochFixiert, zurueck: Math.round(window.scrollY),
             frei: getComputedStyle(document.body).position !== 'fixed' };
  });
  sag(stapel.nochFixiert, 'ein unbekanntes Blatt bringt den Zähler nicht durcheinander');
  sag(stapel.frei && stapel.zurueck === 500, 'danach ist der body frei und die Position zurück',
    stapel.zurueck + ' px');
}


/* --- Kontrast ------------------------------------------------------------
   Gemessen wird am gerenderten Bild, nicht an den Tokens: erst dort steht,
   was wirklich uebereinander liegt. */
console.log('--- Kontrast (AA) ---');
{
  // Mit gesetztem Filter, damit Leiste, Chips und „x von y" auch gemessen werden.
  frisch(); M.kasse.tab = 'offen';
  M.kasse.filter.offen = { spieler: ['p2'], sort: 'betrag', zeit: '30' };
  const f = path.join(ZIEL, '_tmp.html');
  fs.writeFileSync(f, seite(M.kasseHtml(DATEN)));
  await p.goto(pathToFileURL(path.resolve(f)).href);
  const werte = await p.evaluate(() => {
    const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    const L = (rgb) => { const [r, g, b] = rgb; return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); };
    const zahl = (s) => s.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number);
    /* Hintergruende einsammeln: das Verlaufsbild deckt die Hintergrundfarbe
       ab, deshalb hat es Vorrang - sonst misst man bei einem <button> die
       graue UA-Farbe buttonface, die man nie sieht. Von einem Verlauf werden
       ALLE Stopps zurueckgegeben; gewertet wird der schlechteste. */
    const gruende = (el) => {
      let e = el;
      while (e) {
        const cs = getComputedStyle(e);
        if (cs.backgroundImage && cs.backgroundImage !== 'none' && /gradient/.test(cs.backgroundImage)) {
          const m = cs.backgroundImage.match(/rgba?\([^)]+\)/g);
          if (m) return m.map(zahl);
        }
        if (cs.backgroundColor && !/rgba\(0, 0, 0, 0\)/.test(cs.backgroundColor)
            && !/transparent/.test(cs.backgroundColor)) {
          // <button> ohne eigene Farbe: buttonface uebergehen, weiter nach oben.
          if (!(e.tagName === 'BUTTON' && cs.backgroundColor === 'rgb(239, 239, 239)')) {
            return [zahl(cs.backgroundColor)];
          }
        }
        e = e.parentElement;
      }
      return [[255, 255, 255]];
    };
    const proben = [
      ['.kpi-label', 'Kennzahl-Beschriftung'],
      ['.kpi-value.is-rot', 'Kennzahl offen'],
      ['.kpi-value.is-gold', 'Kennzahl gemeldet'],
      ['.kpi-grid .kpi:nth-child(3) .kpi-value', 'Kennzahl eingegangen'],
      ['.kpi-sub', 'Kennzahl-Unterzeile'],
      ['.ks-neu', 'Strafe verhängen'],
      ['.ks-seg-b.is-on', 'Reiter gewählt'],
      ['.ks-seg-b:not(.is-on)', 'Reiter ungewählt'],
      ['.krow-title', 'Name'],
      ['.krow-amt', 'Betrag'],
      ['.krow-strafe', 'Vergehen'],
      ['.krow-verh', 'verhängt-Zeile'],
      ['.ks-sag', 'Angabe des Spielers'],
      ['.ks-storno', 'Storno'],
      ['.ks-buchen', 'Als bezahlt buchen'],
      ['.ks-fl-b', 'Filterleiste'],
      ['.ks-fl-n', 'Zahl der aktiven Filter'],
      ['.ks-fl-chip', 'Filter-Chip'],
      ['.ks-treffer', 'Zeile x von y'],
    ];
    return proben.map(([sel, name]) => {
      const el = document.querySelector(sel);
      if (!el) return { name, fehlt: true };
      const cs = getComputedStyle(el);
      const l1 = L(zahl(cs.color));
      let k = Infinity;
      for (const bg of gruende(el)) {
        const l2 = L(bg);
        k = Math.min(k, (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05));
      }
      const px = parseFloat(cs.fontSize);
      const gross = px >= 24 || (px >= 18.66 && parseInt(cs.fontWeight, 10) >= 700);
      return { name, k: Math.round(k * 100) / 100, px, gross, soll: gross ? 3 : 4.5 };
    });
  });
  /* Bekannt und bereits als eigenes Paket vorgemerkt: --grad-btn liegt bei
     3,88:1 und faerbt JEDEN .btn-primary der App, nicht nur die Kasse. Wird
     hier gemeldet, zaehlt aber nicht als neue Beanstandung - sonst waere das
     Skript dauerhaft rot und niemand schaut mehr hin. */
  const BEKANNT = { 'Strafe verhängen': '--grad-btn, Paket .btn-primary-Kontrast',
                    'Als bezahlt buchen': '--grad-btn, Paket .btn-primary-Kontrast' };
  for (const w of werte) {
    if (w.fehlt) { console.log('  ?? ' + w.name + ' nicht gefunden'); fehler++; continue; }
    const ok = w.k >= w.soll;
    const bekannt = !ok && BEKANNT[w.name];
    if (!ok && !bekannt) fehler++;
    console.log('  ' + (ok ? 'ok  ' : bekannt ? 'bek ' : 'FEHL') + ' ' + w.name.padEnd(24) +
      w.k.toFixed(2) + ':1  (' + w.px + 'px' + (w.gross ? ', groß' : '') + ', nötig ' + w.soll + ':1)' +
      (bekannt ? '  <- ' + bekannt : ''));
  }
}

fs.rmSync(path.join(ZIEL, '_tmp.html'), { force: true });
await br.close();
console.log(fehler === 0 ? '\n--- Bilder in ' + ZIEL + ', keine Beanstandung ---'
                         : '\n--- ' + fehler + ' Beanstandung(en) ---');
process.exit(fehler === 0 ? 0 : 1);
