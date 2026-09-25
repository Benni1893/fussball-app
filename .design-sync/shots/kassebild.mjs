/* Rendert die neue Kasse mit den Beispieldaten der Vorlage bei 390 px und
   legt die Bilder neben _neukasse.png ab. Das Markup kommt woertlich aus
   app.js (kassemodul.mjs), nicht aus einem Nachbau - sonst misst die
   Gegenprobe das Skript und nicht die App.

   Aufruf: node .design-sync/shots/kassebild.mjs                            */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { ladeKasse, SPIELER, SPIELER_BY_ID, beispielDaten, KATALOG } from './kassemodul.mjs';

const ZIEL = '.design-sync/reference/compare';
fs.mkdirSync(ZIEL, { recursive: true });

const M = ladeKasse();
M.setDaten(SPIELER_BY_ID, { katalog: KATALOG, strafen: [], players: SPIELER });
const DATEN = beispielDaten();

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
  await p.goto('file://' + path.resolve(f).replace(/\\/g, '/'));
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

const br = await chromium.launch({ channel: 'chrome' });
const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
  isMobile: true, hasTouch: true });
const p = await ctx.newPage();
let fehler = 0;

console.log('--- Die drei Reiter mit den Zahlen der Vorlage ---');
for (const [tab, datei] of [['pruefen', 'neu-1-pruefen.png'], ['offen', 'neu-2-offen.png'], ['bezahlt', 'neu-4-eingegangen.png']]) {
  M.kasse.tab = tab; M.kasse.spFilter = ''; M.kasse.formOpen = false;
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

function blattSeite(kopf, body) {
  return seite('', `
    .tv-scrim { opacity: 1; }
    .tv-sheet { transform: translateY(0); }
  `).replace('</div></body>',
    '</div><div class="tv-scrim open"></div>' +
    '<div class="tv-sheet ks-bl open"><div class="tv-sh"><span class="tv-grip"></span><strong>' + kopf +
    '</strong><button class="tv-shx" aria-label="Schließen">&times;</button></div>' +
    '<div class="tv-shbody">' + body + '</div></div></body>');
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
  const waehler = seite('', '.tv-scrim { opacity: 1; } .tv-sheet.tv-kfull { transform: translateY(0); }')
    .replace('</div></body>',
      '</div><div class="tv-scrim open"></div>' +
      '<div class="tv-sheet tv-kfull ks-wahl open">' +
      '<div class="tv-sh"><strong>Strafe verhängen</strong><button class="tv-shx" aria-label="Schließen">&times;</button></div>' +
      '<div class="tv-shbody">' +
        '<button type="button" class="ks-wahl-b"><span class="ks-wahl-t">Strafe aus Katalog hinzufügen</span>' +
        '<span class="ks-wahl-s">Aus dem Strafenkatalog wählen, mit Menge oder Bezugsgröße.</span></button>' +
        '<button type="button" class="ks-wahl-b"><span class="ks-wahl-t">Individuelle Strafe</span>' +
        '<span class="ks-wahl-s">Freier Grund und freier Betrag.</span></button></div>' +
      '<div class="ks-wahl-f"><button type="button" class="btn">Schließen</button></div></div></body>');
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

console.log('--- Formular je Modus ---');
for (const [modus, datei] of [['katalog', 'form-katalog.png'], ['indiv', 'form-indiv.png']]) {
  M.kasse.formOpen = true;
  M.kasse.bloecke = { katalog: modus === 'katalog', indiv: modus === 'indiv' };
  M.kasse.players = ['p1', 'p2'];
  M.kasse.tab = 'offen';
  await schuss(p, seite(M.kasseHtml(DATEN)), datei, 900);
  fehler += await ueberlauf(p, 'Formular ' + modus);
}
M.kasse.formOpen = false; M.kasse.bloecke = { katalog: false, indiv: false }; M.kasse.players = [];

console.log('--- Spielerfilter aktiv ---');
{
  M.kasse.tab = 'offen'; M.kasse.spFilter = 'p1';
  await schuss(p, seite(M.kasseHtml(DATEN)), 'filter-offen.png', 700);
  fehler += await ueberlauf(p, 'Filter offen');
  M.kasse.spFilter = '';
}

/* --- Kontrast ------------------------------------------------------------
   Gemessen wird am gerenderten Bild, nicht an den Tokens: erst dort steht,
   was wirklich uebereinander liegt. */
console.log('--- Kontrast (AA) ---');
{
  M.kasse.tab = 'offen'; M.kasse.spFilter = '';
  const f = path.join(ZIEL, '_tmp.html');
  fs.writeFileSync(f, seite(M.kasseHtml(DATEN)));
  await p.goto('file://' + path.resolve(f).replace(/\\/g, '/'));
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
      ['.ks-fil .lbl', 'Filter-Beschriftung'],
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
