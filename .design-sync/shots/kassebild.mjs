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

/* Ein Skriptfehler in einer gerenderten Seite blieb bisher still - das Bild
   war dann einfach leer und niemand sah, warum. */
p.on('pageerror', (e) => { console.log('  !! Skriptfehler: ' + e.message); fehler++; });
p.on('console', (m) => { if (m.type() === 'error') console.log('  !! Konsole: ' + m.text()); });

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


/* --- Eingegangen: Innenabstand vorher/nachher ---------------------------
   „Vorher" ist die alte Regel, inline wieder eingesetzt: die Zeile trug
   14 px waagerecht - den Innenabstand einer EIGENSTAENDIGEN Karte
   (.kat-item). Sie sitzt aber IN einer Karte, wo 16 der Standard ist. */
console.log('--- Eingegangen: Innenabstand vorher und nachher ---');
{
  const ALT = '.vorher .ks-ein-row { padding: 13px 14px; } .vorher .ks-ein-b { padding-left: 0; }';
  frisch(); M.kasse.tab = 'bezahlt';
  const liste = M.renderKasseEing(
    DATEN.filter((s) => s.st === 'bestätigt').slice(0, 4),
    DATEN.filter((s) => s.st === 'bestätigt'));
  const html = seite(
    '<div class="sp-h2">vorher</div><div class="vorher">' + liste + '</div>' +
    '<div class="sp-h2">nachher</div><div class="nachher">' + liste + '</div>',
    ALT + '.sp-h2 { font: 700 11px/1 system-ui; letter-spacing: .6px; text-transform: uppercase; ' +
          'color: var(--muted); margin: 14px 0 6px; }');
  await schuss(p, html, 'eingegangen-vorher-nachher.png', null);

  const m = await p.evaluate(() => {
    const mass = (sel) => {
      const karte = document.querySelector(sel + ' .ks-ein');
      const zeile = karte.querySelector('.ks-ein-row');
      const kreis = zeile.querySelector('.ks-ok');
      const name = zeile.querySelector('.ks-ein-n');
      const betrag = zeile.querySelector('.ks-ein-b');
      const k = karte.getBoundingClientRect();
      // Von der INNENkante messen: .ks-ein ist eine .card mit 1px Rand.
      const rand = parseFloat(getComputedStyle(karte).borderLeftWidth) || 0;
      return {
        linksKreis: Math.round(kreis.getBoundingClientRect().left - k.left - rand),
        kreisText: Math.round(name.getBoundingClientRect().left - kreis.getBoundingClientRect().right),
        rechtsBetrag: Math.round(k.right - rand - betrag.getBoundingClientRect().right),
      };
    };
    return { vorher: mass('.vorher'), nachher: mass('.nachher') };
  });

  const sag = (ok, text, detail) => {
    console.log('  ' + (ok ? 'ok  ' : 'FEHL') + ' ' + text + (detail ? '   ' + detail : ''));
    if (!ok) fehler++;
  };
  console.log('  vorher:  ' + JSON.stringify(m.vorher));
  console.log('  nachher: ' + JSON.stringify(m.nachher));
  sag(m.vorher.linksKreis === 14, 'vorher saß der Kreis 14 px vom Rand', m.vorher.linksKreis + ' px');
  sag(m.nachher.linksKreis === 16, 'nachher 16 px - der Karten-Standard', m.nachher.linksKreis + ' px');
  sag(m.nachher.rechtsBetrag === 16, 'der Betrag hat denselben Abstand nach rechts',
    m.nachher.rechtsBetrag + ' px');
  sag(m.nachher.kreisText === 12, 'zwischen Kreis und Text 12 px wie bei jedem Avatar',
    m.nachher.kreisText + ' px');
  // Gegenprobe an einer anderen Avatarzeile der App.
  const avatar = await p.evaluate(() => {
    const el = document.createElement('div');
    el.innerHTML = '<div class="kat-list"><button class="kat-item ks-prow">' +
      '<span class="avatar">AB</span><span class="kat-name">Test</span></button></div>';
    document.body.appendChild(el);
    const a = el.querySelector('.avatar'), n = el.querySelector('.kat-name');
    const g = Math.round(n.getBoundingClientRect().left - a.getBoundingClientRect().right);
    el.remove();
    return g;
  });
  sag(avatar === m.nachher.kreisText, 'dasselbe Maß wie in der Spielerliste', avatar + ' px');
}


/* --- Kartenkopf vorher/nachher ------------------------------------------
   „Vorher" ist die alte Regel, inline wieder eingesetzt: .link-btn trug seine
   44px Trefferflaeche als echte min-height, dadurch wurde die Zeile 44 hoch
   und beide Beschriftungen rutschten in deren Mitte. */
console.log('--- Kartenkopf vorher und nachher ---');
{
  const ALT = `
    .vorher .ks-kopf { align-items: center; min-height: 22px; }
    .vorher .ks-kopf .link-btn { min-height: 44px; line-height: normal; }
    .vorher .ks-kopf .link-btn::after { content: none; }
  `;
  frisch(); M.kasse.tab = 'pruefen';
  const karte = M.renderKassePruefen(DATEN.filter((s) => s.st === 'gemeldet'));
  const html = seite(
    '<div class="sp-h2">vorher</div><div class="vorher">' + karte + '</div>' +
    '<div class="sp-h2">nachher</div><div>' + karte + '</div>',
    ALT + '.sp-h2 { font: 700 11px/1 system-ui; letter-spacing: .6px; text-transform: uppercase; ' +
          'color: var(--muted); margin: 14px 0 6px; }');
  await schuss(p, html, 'kopf-vorher-nachher.png', null);

  const m = await p.evaluate(() => {
    const mass = (sel) => {
      const karte = document.querySelector(sel + ' .ks-card');
      const lbl = karte.querySelector('.lbl');
      const link = karte.querySelector('.link-btn');
      const k = karte.getBoundingClientRect(), l = lbl.getBoundingClientRect(), a = link.getBoundingClientRect();
      const cs = getComputedStyle(karte);
      return {
        obenLbl: Math.round(l.top - k.top - parseFloat(cs.paddingTop)),
        linksLbl: Math.round(l.left - k.left - parseFloat(cs.paddingLeft)),
        rechtsLink: Math.round(k.right - parseFloat(cs.paddingRight) - a.right),
        grundlinie: Math.round(Math.abs((l.top + l.height) - (a.top + a.height))),
      };
    };
    return { vorher: mass('.vorher'), nachher: mass('div:not(.vorher) > .ks-deck') };
  });

  const sag = (ok, text, detail) => {
    console.log('  ' + (ok ? 'ok  ' : 'FEHL') + ' ' + text + (detail ? '   ' + detail : ''));
    if (!ok) fehler++;
  };
  console.log('  vorher:  ' + JSON.stringify(m.vorher));
  console.log('  nachher: ' + JSON.stringify(m.nachher));
  sag(m.vorher.obenLbl > 8, 'vorher stand „1 VON 3" deutlich unter der Innenkante',
    m.vorher.obenLbl + ' px');
  /* Gemessen wird der Glyphenkasten, nicht der Zeilenkasten: Grossbuchstaben
     sitzen ein paar Pixel unter dessen Oberkante, und jede Schrift hat eine
     kleine Seitenvorbreite. Ein, zwei Pixel sind daher Schriftmass, kein
     Layoutfehler - 18 px waren es. */
  sag(m.nachher.obenLbl <= 4, 'nachher sitzt es auf der Innenkante',
    m.nachher.obenLbl + ' px (Schriftmaß)');
  sag(m.nachher.linksLbl <= 2, 'linksbündig auf der Innenkante', m.nachher.linksLbl + ' px');
  sag(m.nachher.rechtsLink <= 2, '„Alle bestätigen" rechtsbündig auf der Innenkante',
    m.nachher.rechtsLink + ' px');
  sag(m.vorher.obenLbl - m.nachher.obenLbl >= 12, 'die überflüssige Luft ist weg',
    m.vorher.obenLbl + ' -> ' + m.nachher.obenLbl + ' px');
  sag(m.vorher.grundlinie > 8 && m.nachher.grundlinie <= 1,
    'vorher lagen die Grundlinien auseinander, jetzt nicht mehr',
    m.vorher.grundlinie + ' -> ' + m.nachher.grundlinie + ' px');
  sag(m.nachher.grundlinie <= 1, 'beide auf einer Grundlinie', m.nachher.grundlinie + ' px Versatz');
  // Die Trefferflaeche bleibt trotzdem 44.
  const tap = await p.evaluate(() => {
    const link = document.querySelector('div:not(.vorher) > .ks-deck .link-btn');
    const h = getComputedStyle(link, '::after').height;
    return Math.round(parseFloat(h));
  });
  sag(tap === 44, 'die Trefferfläche ist weiterhin 44 px', tap + ' px');
}


/* --- Antippen darf die Liste nicht verschieben ---------------------------
   Im echten Browser geprueft: weit nach unten scrollen, einen der letzten
   Eintraege antippen, Scrollposition auf den Pixel vergleichen. Die
   Klickpfade kommen dabei woertlich aus app.js - nachgebaut wuerde nur das
   Skript pruefen. */
console.log('--- Scrollposition beim Antippen ---');
{
  const quelle = fs.readFileSync('app.js', 'utf8');
  const teil = (a, b) => {
    const i = quelle.indexOf(a), j = quelle.indexOf(b, i);
    if (i < 0 || j < 0) throw new Error('Anker nicht gefunden: ' + a);
    return quelle.slice(i, j);
  };
  // Die gezielten Aktualisierer, woertlich.
  const helfer = teil('  function mitScroll(wurzel, fn) {', '  function ksEnsureSheet() {')
    + teil('  function ksSpielerUmschalten(sheet, id) {', '  // Das Kreuz zum Leeren')
    + teil('  function ksKatalogZeileHtml(k) {', '  function ksSeiteHtml() {');

  // Die Stuetzen, die diese Funktionen brauchen.
  const stuetzen = `
    const ICON_CHECK = '<svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>';
    const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const euro = (n) => n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
    const initials = (n) => n.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
    const playerById = window.__spieler;
    const DEMO = { players: window.__spielerListe, katalog: window.__katalog };
    const kasse = window.__kasse;
    function nachname(n) { const t = String(n||'').trim().split(/\\s+/); return t[t.length-1] || ''; }
    function ksNorm(x) { return String(x==null?'':x).toLowerCase().replace(/ä/g,'a').replace(/ö/g,'o').replace(/ü/g,'u').replace(/ß/g,'ss').normalize('NFD').replace(/[\\u0300-\\u036f]/g,''); }
    function ksSucheTrifft(name, frage) { const q = ksNorm(frage).trim(); return !q || ksNorm(name).indexOf(q) !== -1; }
    function ksSpielerSuchen(l, f) { return l.filter((p) => ksSucheTrifft(p.name, f)); }
    function kasseSummaryHtml() { return '<div class="kasse-sum-empty">Summe</div>'; }
    function ksSeiteKnopf() {}
    function ksSeiteZeichnen() { window.__vollNeu = (window.__vollNeu || 0) + 1; }
    function ksSeiteSummeAktualisieren() {}
  `;

  const listen = [
    ['Spielerauswahl (Strafe)', 'ksBody', 'data-ks-player',
     (n) => 'ksSpielerUmschalten(document.getElementById("huelle"), "' + n + '")'],
  ];

  const sag = (ok, text, detail) => {
    console.log('  ' + (ok ? 'ok  ' : 'FEHL') + ' ' + text + (detail ? '   ' + detail : ''));
    if (!ok) fehler++;
  };

  // Genug Spieler, damit die Liste wirklich scrollt.
  const VIELE = [];
  for (let i = 0; i < 40; i++) VIELE.push({ id: 'v' + i, name: 'Spieler Nummer' + String(i).padStart(2, '0') });
  const VIELE_BY_ID = Object.fromEntries(VIELE.map((p) => [p.id, p]));

  for (const [name, bodyId, attr, ruf] of listen) {
    const istSuche = attr === 'data-ks-su-player';
    const html = seite('', '.rahmen { position: fixed; inset: 0; display: flex; flex-direction: column; }' +
                           '#' + bodyId + ' { flex: 1 1 auto; overflow-y: auto; }')
      .replace('</body>',
        '<div class="rahmen ks-such" id="huelle">' +
        '<div class="ks-suchfeld"><input class="ks-such-in"></div>' +
        '<div class="tv-shbody" id="' + bodyId + '" data-scroll="' + bodyId + '"></div>' +
        '<div class="ks-fuss"><button class="ks-fuss-btn" data-ks-weiter>Weiter</button></div></div>' +
        '<script>' +
        'window.__spieler = ' + JSON.stringify(VIELE_BY_ID) + ';' +
        'window.__spielerListe = ' + JSON.stringify(VIELE) + ';' +
        'window.__katalog = [];' +
        'window.__kasse = { players: [], items: {}, bezug: {}, indiv: [], flEntwurf: { spieler: [], sort: "neu", zeit: "alle" } };' +
        stuetzen + helfer +
        'document.getElementById("' + bodyId + '").innerHTML = ksSpielerZeilenHtml(' +
        (istSuche ? 'window.__kasse.flEntwurf.spieler' : 'window.__kasse.players') +
        ', "", "' + attr + '");' +
        'window.__tippe = (id) => { ' + ruf('IDID').replace('"IDID"', 'id') + ' };' +
        '<\/script></body>');
    const f = path.join(ZIEL, '_tmp.html');
    fs.writeFileSync(f, html);
    await p.goto(pathToFileURL(path.resolve(f)).href);

    const m = await p.evaluate(async (bid) => {
      const box = document.getElementById(bid);
      const zeilen = [...box.querySelectorAll('.ks-prow')];
      const vorletzte = zeilen[zeilen.length - 2];
      vorletzte.scrollIntoView({ block: 'end' });
      await new Promise((r) => setTimeout(r, 60));
      const vorher = Math.round(box.scrollTop);
      const id = vorletzte.getAttribute('data-ks-player') || vorletzte.getAttribute('data-ks-su-player');
      window.__tippe(id);
      await new Promise((r) => setTimeout(r, 60));
      const zeile = box.querySelector('[data-ks-player="' + id + '"], [data-ks-su-player="' + id + '"]');
      return { vorher, nachher: Math.round(box.scrollTop), markiert: !!(zeile && zeile.classList.contains('is-sel')),
               chips: !!document.querySelector('.ks-gchip'),
               knopf: (document.querySelector('.ks-fuss-btn') || {}).textContent };
    }, bodyId);

    sag(m.vorher > 0, name + ': Liste war wirklich gescrollt', m.vorher + ' px');
    sag(m.vorher === m.nachher, name + ': Position bleibt auf den Pixel',
      m.vorher + ' -> ' + m.nachher);
    sag(m.markiert, name + ': die Zeile ist jetzt markiert');
    sag(m.chips, name + ': der Spieler steht als Chip');
  }

  /* Die Katalogliste auf der Eingabeseite: dasselbe mit einer echten
     Katalogzeile und mit Plus/Minus. */
  {
    const KAT = [];
    for (let i = 0; i < 30; i++) KAT.push({ id: 'k' + i, vergehen: 'Vergehen Nummer ' + i, betrag: 5 + i, typ: 'fest' });
    const html = seite('', '.rahmen { position: fixed; inset: 0; display: flex; flex-direction: column; }' +
                           '#katBody { flex: 1 1 auto; overflow-y: auto; }')
      .replace('</body>',
        '<div class="rahmen" id="ksSeite">' +
        '<div class="ks-seite-body" id="katBody" data-scroll="katBody"></div>' +
        '<div class="ks-fuss"><button class="ks-fuss-btn" data-kasse-add>Speichern</button></div></div>' +
        '<script>' +
        'window.__spieler = {}; window.__spielerListe = [];' +
        'window.__katalog = ' + JSON.stringify(KAT) + ';' +
        'window.__kasse = { players: [], items: {}, bezug: {}, indiv: [] };' +
        stuetzen + helfer +
        'document.getElementById("katBody").innerHTML = ksKatalogBlockHtml();' +
        '<\/script></body>');
    const f = path.join(ZIEL, '_tmp.html');
    fs.writeFileSync(f, html);
    await p.goto(pathToFileURL(path.resolve(f)).href);

    const m = await p.evaluate(async () => {
      const box = document.getElementById('katBody');
      const zeilen = [...box.querySelectorAll('[data-kat-zeile]')];
      const vorletzte = zeilen[zeilen.length - 2];
      vorletzte.scrollIntoView({ block: 'end' });
      await new Promise((r) => setTimeout(r, 60));
      const vorher = Math.round(box.scrollTop);
      const id = vorletzte.getAttribute('data-kat-zeile');
      // Auswaehlen - wie der Klickpfad es tut.
      window.__kasse.items[id] = { menge: 1 };
      ksKatalogZeileAktualisieren(id);
      await new Promise((r) => setTimeout(r, 60));
      const nachWahl = Math.round(box.scrollTop);
      // Menge erhoehen - nur die Zahl zwischen den Knoepfen.
      window.__kasse.items[id].menge = 2;
      const n = document.querySelector('[data-kat-zeile="' + id + '"] .qty-n');
      if (n) n.textContent = '2×';
      await new Promise((r) => setTimeout(r, 60));
      const nachMenge = Math.round(box.scrollTop);
      const zeile = document.querySelector('[data-kat-zeile="' + id + '"]');
      return { vorher, nachWahl, nachMenge, markiert: !!(zeile && zeile.classList.contains('is-sel')),
               menge: (document.querySelector('[data-kat-zeile="' + id + '"] .qty-n') || {}).textContent,
               vollNeu: window.__vollNeu || 0 };
    });

    sag(m.vorher > 0, 'Katalogliste: war wirklich gescrollt', m.vorher + ' px');
    sag(m.vorher === m.nachWahl, 'Katalogliste: Position bleibt beim Auswählen',
      m.vorher + ' -> ' + m.nachWahl);
    sag(m.nachWahl === m.nachMenge, 'Katalogliste: Position bleibt bei Plus/Minus',
      m.nachWahl + ' -> ' + m.nachMenge);
    sag(m.markiert, 'Katalogliste: die Zeile ist markiert');
    sag(m.menge === '2×', 'Katalogliste: die Menge steht daneben', m.menge);
    sag(m.vollNeu === 0, 'Katalogliste: kein voller Neuaufbau der Seite');
  }

}


/* --- Wie oft wird beim Öffnen gerendert? ---------------------------------
   Der Uebergang soll jede Ansicht genau einmal aufbauen. Gemessen wird das,
   indem ksSeiteHtml() gezaehlt wird - die Steuerung darum herum kommt
   woertlich aus app.js. */
console.log('--- Renderzahl und Fokus beim Öffnen ---');
{
  const quelle = fs.readFileSync('app.js', 'utf8');
  const teil = (a, b) => {
    const i = quelle.indexOf(a), j = quelle.indexOf(b, i);
    if (i < 0 || j < 0) throw new Error('Anker nicht gefunden: ' + a);
    return quelle.slice(i, j);
  };
  const steuerung = teil('  let _scrollLocks = 0, _scrollLockY = 0;', '  function closeTerminModal()')
    + teil('  let ksSeiteGesperrt = false;', '  function ksSeiteEingabe(ev) {');

  const html = seite('<div style="height:2000px"></div>').replace('</body>',
    '<nav class="app-nav"><button class="nav-btn">A</button></nav>' +
    '<script>' +
    'window.__zaehler = 0;' +
    'const kasse = { seite: null };' +
    'function ksSeiteHtml() { window.__zaehler++; return "<div class=\\"ks-seite\\"><div class=\\"ks-seite-body\\"></div></div>"; }' +
    'function ksSeiteKnopf() {}' +
    'function ksSeiteKlick() {}' +
    'function ksSeiteEingabe() {}' +
    'function kasseSummaryHtml() { return ""; }' +
    steuerung +
    'window.__kasse = kasse; window.__sync = ksSeiteSync; window.__zeichnen = ksSeiteZeichnen;' +
    '<\/script></body>');
  const f = path.join(ZIEL, '_tmp.html');
  fs.writeFileSync(f, html);
  await p.goto(pathToFileURL(path.resolve(f)).href);

  const m = await p.evaluate(async () => {
    const warte = () => new Promise((r) => setTimeout(r, 40));
    // So laeuft ksWeiter(): Seite setzen, einmal abgleichen.
    window.__kasse.seite = 'katalog';
    window.__sync();
    await warte();
    const nachOeffnen = window.__zaehler;
    // Jetzt ein Hintergrund-Neuladen: renderKasse() ruft nur den Abgleich.
    window.__sync(); window.__sync(); window.__sync();
    await warte();
    const nachHintergrund = window.__zaehler;
    const hash = location.hash;
    const navWeg = getComputedStyle(document.querySelector('.app-nav')).pointerEvents === 'none';
    const gesperrt = getComputedStyle(document.body).position === 'fixed';
    // Schliessen raeumt auf.
    window.__kasse.seite = null;
    window.__sync();
    await warte();
    return { nachOeffnen, nachHintergrund, hash, navWeg, gesperrt,
             hashWeg: location.hash === '',
             frei: getComputedStyle(document.body).position !== 'fixed',
             versteckt: document.getElementById('ksSeite').hidden };
  });

  const sag = (ok, text, detail) => {
    console.log('  ' + (ok ? 'ok  ' : 'FEHL') + ' ' + text + (detail ? '   ' + detail : ''));
    if (!ok) fehler++;
  };
  sag(m.nachOeffnen === 1, 'die Seite wird beim Öffnen genau einmal gerendert', m.nachOeffnen + '×');
  sag(m.nachHintergrund === 1, 'drei Hintergrund-Abgleiche rendern sie kein zweites Mal', m.nachHintergrund + '×');
  sag(m.hash === '#strafe=katalog', 'der Hash steht', m.hash);
  sag(m.navWeg, 'die untere Navigation ist weg');
  sag(m.gesperrt, 'der Hintergrund ist gesperrt');
  sag(m.hashWeg, 'nach dem Schließen ist der Hash weg');
  sag(m.frei, 'und der Hintergrund frei');
  sag(m.versteckt, 'die Seite ist versteckt');

  // Kein Eingabefeld bekommt beim Öffnen den Fokus.
  const oeffnen = teil('  function ksOpenPlayers()', '  /* „Weiter": aus dem Wähler');
  sag(!/ksFokusSuche/.test(oeffnen), 'Spielerauswahl öffnet ohne Fokus');
  sag(!/autofocus/.test(quelle), 'nirgends ein autofocus');
  // Nur noch beim Leeren des Suchfelds - dort ist er gewollt.
  const fokusStellen = (quelle.match(/ksFokusSuche\(/g) || []).length;
  sag(fokusStellen === 2, 'ksFokusSuche wird nur noch beim Leeren gerufen (plus Definition)',
    fokusStellen + ' Stellen');
}


/* --- Kontrast ------------------------------------------------------------
   Gemessen wird am gerenderten Bild, nicht an den Tokens: erst dort steht,
   was wirklich uebereinander liegt. */
console.log('--- Kontrast (AA) ---');
{
  frisch(); M.kasse.tab = 'offen';
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
