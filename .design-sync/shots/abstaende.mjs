/* C7: misst die Abstaende zwischen Abschnitten, innerhalb von Abschnitten und
   zwischen Karten - in der Vorlage UND in der App, Screen fuer Screen. */
import { chromium } from 'playwright';
import { starte } from './server.mjs';
const { server, basis, port } = await starte(process.cwd());
const b = await chromium.launch({ channel: 'chrome' });

const luft = `(p) => {
  const x = document.querySelector(p.a), y = document.querySelector(p.b);
  if (!x || !y) return null;
  return Math.round(y.getBoundingClientRect().top - x.getBoundingClientRect().bottom);
}`;

// Vorlage
const cv = await b.newContext({ viewport: { width: 1400, height: 900 } });
const pv = await cv.newPage();
await pv.addInitScript(() => document.addEventListener('DOMContentLoaded', () => {
  const s = document.createElement('style'); s.textContent = 'x-dc{display:block}helmet{display:none}';
  document.head.appendChild(s);
}));
await pv.goto(`http://127.0.0.1:${port}/.design-sync/concepts/${encodeURIComponent('App in 2a - High End.dc.html')}`, { waitUntil: 'networkidle' });
await pv.waitForTimeout(700);

const messen = async (titel, paare) => {
  console.log('\n' + titel);
  for (const [name, a, c] of paare) {
    const v = await pv.evaluate(new Function('return ' + luft)(), { a, b: c });
    console.log('  ' + name.padEnd(34) + (v == null ? '(nicht gefunden)' : v + 'px'));
  }
};

await messen('Vorlage 1a (Uebersicht Trainer)', [
  ['Anrede -> Hero',            '#f-uebersicht-trainer .h1row', '#f-uebersicht-trainer .card.ag'],
  ['Hero -> Abschnitt',         '#f-uebersicht-trainer .card.ag', '#f-uebersicht-trainer .sec'],
  ['Abschnitt -> Liste',        '#f-uebersicht-trainer .sec', '#f-uebersicht-trainer .list'],
  ['Aufgabenzeile -> Zeile',    '#f-uebersicht-trainer .list .row:nth-child(1)', '#f-uebersicht-trainer .list .row:nth-child(2)'],
  ['Liste -> Geldkacheln',      '#f-uebersicht-trainer .list', '#f-uebersicht-trainer .stack'],
  ['Geldkachel -> Kachel',      '#f-uebersicht-trainer .stack .card:nth-child(1)', '#f-uebersicht-trainer .stack .card:nth-child(2)'],
]);
await messen('Vorlage 2a (Kalender)', [
  ['Chips -> Knoepfe',          '#f-kalender .chips', '#f-kalender .stack'],
  ['Knoepfe -> Terminliste',    '#f-kalender .stack:nth-of-type(1)', '#f-kalender .stack:nth-of-type(2)'],
  ['Terminkarte -> Karte',      '#f-kalender .stack:nth-of-type(2) > .card:nth-child(1)', '#f-kalender .stack:nth-of-type(2) > .card:nth-child(2)'],
]);
await messen('Vorlage 3a (Konto)', [
  ['Kontoblock -> Kacheln',     '#f-konto .bd > .card', '#f-konto .kpis'],
  ['Kacheln -> Chips',          '#f-konto .kpis', '#f-konto .chips'],
  ['Chips -> Liste',            '#f-konto .chips', '#f-konto .list'],
]);
await messen('Vorlage 3b (Katalog)', [
  ['Begleitsatz -> Liste',      '#f-katalog .sub', '#f-katalog .list'],
  ['Liste -> Knopf',            '#f-katalog .list', '#f-katalog .btn.sec2'],
]);
await messen('Vorlage 3c (Kasse)', [
  ['Kacheln -> Abschnitt',      '#f-kasse .kpis', '#f-kasse .sec'],
  ['Abschnitt -> Karte',        '#f-kasse .sec', '#f-kasse .card'],
]);
await b.close(); server.close();
