/* Holt die Kassen-Funktionen WOERTLICH aus app.js und macht sie ohne Browser
   und ohne Datenbank aufrufbar. Damit pruefen und rendern beide Skripte
   dasselbe Markup, das die App ausliefert - nicht einen Nachbau.

   Benutzt von kassepruef.mjs (Logik) und kassebild.mjs (Bilder).          */
import fs from 'node:fs';

const app = fs.readFileSync('app.js', 'utf8');

/* Ein Stueck Quelltext zwischen zwei Ankern. Beide Anker muessen genau
   einmal vorkommen, sonst schneidet das Skript still etwas Falsches
   heraus - genau der Fehler, der eine fruehere Pruefung gruen gelogen hat. */
function stueck(von, bis) {
  const a = app.indexOf(von);
  if (a < 0) throw new Error('Anker nicht gefunden: ' + von);
  if (app.indexOf(von, a + 1) >= 0) throw new Error('Anker mehrfach: ' + von);
  const b = app.indexOf(bis, a);
  if (b < 0) throw new Error('Endanker nicht gefunden: ' + bis);
  return app.slice(a, b);
}

const TEILE = [
  stueck('  const MON = [', '  function fmtWd(iso)'),
  stueck('  function fmtTs(iso) {', '  let playerById = {};'),
  stueck('  function initials(name) {', '  const STATUS_META = {'),
  stueck('  const ZAHLART_LABEL = {', '\n'),
  stueck('  const SVG = ', '  let katEdit = null;'),
  stueck('  const kasse = {', '  function renderKasse() {'),
  // Die Bausteine der Vollbild-Blaetter stehen hinter renderKasse().
  stueck('  function ksSuchfeldHtml(', '  function ksEnsureSheet() {'),
];

/* Was die Kasse aus der uebrigen App braucht. Alles andere kommt woertlich
   aus app.js. Die Stuetzen sind bewusst duenn: was hier nachgebaut werden
   muesste, gehoert nicht in die Kasse. */
const STUETZEN = `
  const HEUTE = "2026-09-25";
  const WT = ["So","Mo","Di","Mi","Do","Fr","Sa"];
  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function euro(n) { return n.toLocaleString("de-DE", { style: "currency", currency: "EUR" }); }
  function navBackChevronHtml() { return ""; }
  function vergehenName(s) { return s.vergehen || ""; }
  function fmtLong(iso) { const d = parseDate(iso); return d.getDate() + ". " + MON_LANG[d.getMonth()] + " " + d.getFullYear(); }
  function fmtTsStub() { return ""; }
  // Sortierschluessel der Spielerliste - in app.js ein Einzeiler weiter oben.
  function nachname(n) { const t = String(n || "").trim().split(/\s+/); return t[t.length - 1] || ""; }
  let playerById = {};
  let DEMO = { katalog: [], strafen: [], players: [] };
`;

const RUECK = `
  return {
    kasse, kasseHtml, krowHtml, ksSagtHtml,
    renderKassePruefen, renderKasseOffen, renderKasseEing,
    kasseBuild, kasseSummaryHtml, zartIconHtml,
    fmtPunkt, fmtKurz, fmtGemeldet,
    KASSE_ZAHLARTEN, ZAHLART_LABEL,
    // Filter und Suche
    ksFilterNeu, ksFiltern, ksSortieren, ksImZeitraum, ksBezugsdatum,
    ksFilterAnzahl, ksFilterChips, ksFilterleisteHtml, ksTrefferHtml,
    ksNorm, ksSucheTrifft, ksSpielerSuchen,
    KS_ZEIT, KS_SORT,
    // Seite „Strafe verhängen"
    ksSeiteHtml, ksSeiteBeruehrt, KS_SEITE_TITEL,
    // Blätter (Markup ohne DOM-Anbindung)
    ksSuchfeldHtml, ksSpielerZeilenHtml, ksGewaehltChipsHtml,
    ICON_LUPE, ICON_FILTER,
    setDaten(p, d) { playerById = p; DEMO = d; },
  };
`;

export function ladeKasse() {
  return new Function(STUETZEN + TEILE.join('\n') + RUECK)();
}

/* ---------------------------------------------------------------------------
   Beispieldaten aus der Vorlage _neukasse.png. Die Namen, Betraege, Vergehen
   und Daten stehen so im Entwurf - damit laesst sich Bild gegen Bild messen.
   --------------------------------------------------------------------------- */
export const SPIELER = [
  { id: 'p1', name: 'Lukas Weber' },
  { id: 'p2', name: 'Daniel Koch' },
  { id: 'p3', name: 'Max Brandl' },
  { id: 'p4', name: 'Jonas Berger' },
  { id: 'p5', name: 'Leon Schmidt' },
  { id: 'p6', name: 'Niklas Fuchs' },
  { id: 'p7', name: 'Felix Huber' },
];

export const SPIELER_BY_ID = Object.fromEntries(SPIELER.map((p) => [p.id, p]));

// „heute, 18:42" der Vorlage - fest verankert am Stichtag der Beispieldaten.
const HEUTE_1842 = new Date();
HEUTE_1842.setHours(18, 42, 0, 0);

function strafe(o) {
  return {
    id: o.id, playerId: o.p, datum: o.datum, vergehen: o.vergehen,
    grundbetrag: o.betrag, zuschlag: 0, betrag: o.betrag,
    st: o.st, status: o.st, auto: !!o.auto,
    zahlart: o.zahlart || null, paidAt: o.paidAt || null,
    sagtZahlart: o.sagt || null, sagtNote: o.note || null,
    gemeldetAm: o.st === 'gemeldet' ? HEUTE_1842.toISOString() : null,
    ablehnGrund: o.ablehn || null,
    player: SPIELER_BY_ID[o.p],
  };
}

/* Genau die Zeilen, die die Vorlage zeigt - plus so viele weitere offene
   Strafen, dass die Kennzahlen der Vorlage (140 / 3 / 31) aufgehen. */
export function beispielDaten() {
  const liste = [];

  // Zu pruefen: 3 Meldungen, zusammen 36,00 EUR
  liste.push(strafe({ id: 'g1', p: 'p1', datum: '2026-09-20', vergehen: 'Zu spät zum Spiel / Treffpunkt',
    betrag: 10, st: 'gemeldet', sagt: 'paypal', note: 'Per PayPal an die Kasse geschickt.' }));
  // p3/p6 sortieren hinter Lukas Weber - die Vorlage zeigt ihn als „1 von 3".
  liste.push(strafe({ id: 'g2', p: 'p3', datum: '2026-09-18', vergehen: 'Gelbe Karte wegen Meckern',
    betrag: 10, st: 'gemeldet', sagt: 'ueberweisung' }));
  liste.push(strafe({ id: 'g3', p: 'p6', datum: '2026-09-17', vergehen: 'Handy im Mannschaftskreis',
    betrag: 16, st: 'gemeldet', sagt: 'bar', note: 'Bringe ich Donnerstag mit.' }));

  // Offen: die beiden Zeilen der Vorlage, dann auffuellen auf 140 / 3.090,00 EUR
  liste.push(strafe({ id: 'o1', p: 'p2', datum: '2026-09-16', vergehen: 'Zu spät zum Training',
    betrag: 10, st: 'offen', sagt: 'bar', note: 'zahle bar am Donnerstag' }));
  liste.push(strafe({ id: 'o2', p: 'p3', datum: '2026-09-14', vergehen: 'Gelbe Karte wegen Meckern',
    betrag: 10, st: 'offen' }));
  const VERGEHEN = ['Zu spät zum Training', 'Zu spät zum Spiel / Treffpunkt', 'Gelbe Karte wegen Meckern',
    'Handy im Mannschaftskreis', 'Unentschuldigt gefehlt', 'Duschzeug vergessen'];
  let rest = 3090 - 20;                 // 138 weitere Strafen ergeben 3.070,00
  for (let i = 0; i < 138; i++) {
    const b = i === 137 ? rest : (i % 3 === 0 ? 25 : i % 3 === 1 ? 20 : 22);
    if (i < 137) rest -= b;
    liste.push(strafe({ id: 'o' + (i + 3), p: SPIELER[i % SPIELER.length].id,
      datum: '2026-0' + (8 + (i % 2)) + '-' + String((i % 27) + 1).padStart(2, '0'),
      vergehen: VERGEHEN[i % VERGEHEN.length], betrag: b, st: 'offen', auto: i % 17 === 0 }));
  }

  // Eingegangen: die sechs Zeilen der Vorlage, dann auffuellen auf 31 / 548,00
  const EING = [
    { p: 'p1', b: 15, art: 'bar',          paid: '2026-09-22' },
    { p: 'p1', b: 10, art: 'ueberweisung', paid: '2026-09-22' },
    { p: 'p4', b: 17, art: 'paypal',       paid: '2026-09-20' },
    { p: 'p5', b: 5,  art: 'bar',          paid: '2026-09-20' },
    { p: 'p6', b: 12, art: 'bar',          paid: '2026-09-18' },
    { p: 'p7', b: 15, art: 'ueberweisung', paid: '2026-08-29' },
  ];
  let restE = 548 - EING.reduce((a, x) => a + x.b, 0);
  EING.forEach((x, i) => liste.push(strafe({ id: 'b' + i, p: x.p, datum: x.paid,
    vergehen: VERGEHEN[i % VERGEHEN.length], betrag: x.b, st: 'bestätigt',
    zahlart: x.art, paidAt: x.paid + 'T19:05:00Z' })));
  for (let i = 0; i < 25; i++) {
    const b = i === 24 ? restE : 19;
    if (i < 24) restE -= b;
    liste.push(strafe({ id: 'b' + (i + 6), p: SPIELER[i % SPIELER.length].id,
      datum: '2026-08-' + String((i % 27) + 1).padStart(2, '0'),
      vergehen: VERGEHEN[i % VERGEHEN.length], betrag: b, st: 'bestätigt',
      zahlart: ['bar', 'ueberweisung', 'paypal'][i % 3], paidAt: '2026-08-' + String((i % 27) + 1).padStart(2, '0') + 'T19:05:00Z' }));
  }

  return liste;
}

export const KATALOG = [
  { id: 'k1', vergehen: 'Zu spät zum Training', betrag: 5,  typ: 'fest' },
  { id: 'k2', vergehen: 'Zu spät zum Spiel / Treffpunkt', betrag: 10, typ: 'fest' },
  { id: 'k3', vergehen: 'Gelbe Karte wegen Meckern', betrag: 10, typ: 'fest' },
  { id: 'k4', vergehen: 'Verspätete Rückmeldung', typ: 'staffel', proEinheit: 2, schritt: 1, einheit: 'Stunden', maxBetrag: 20 },
];
