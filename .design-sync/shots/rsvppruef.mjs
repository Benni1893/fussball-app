/* Nacharbeit Nachschliff Punkt 1: Zusage/Absage hat an jedem Ort dasselbe
   Maß (Baustein am Ende von styles.css, Token --rsvp-luft).
   Gemessen bei 390 px an jeder Knopfzeile .tk-rsvp in Übersicht und Kalender,
   als Spieler und als Trainer, mit und ohne Rückmeldezeile darunter:
     zwischen  Abstand der beiden Knöpfe = 8 px (Vorlage)
     oben      bis zur Trennlinie, zum Kopf oder zur Ortszeile darüber
     unten     bis zur Folgezeile bzw. zur Innenkante der Karte
   oben und unten müssen dem Token entsprechen (Toleranz 0,5 px).
   Aufruf: node .design-sync/shots/rsvppruef.mjs                          */
import { chromium } from 'playwright';
import fs from 'node:fs';
import { starte } from './server.mjs';
import { installiere, warteAufApp, daten } from './landkartenmodul.mjs';

const fehler = [];
const pruefe = (ok, text, detail) => { console.log((ok ? '  ok   ' : '  FEHL ') + text + (detail !== undefined && !ok ? '   ' + detail : '')); if (!ok) fehler.push(text); };
const css = fs.readFileSync('styles.css', 'utf8');
const token = (css.match(/--rsvp-luft:\s*(\d+)px/) || [])[1];
pruefe(token === '14', 'Token --rsvp-luft = 14 px im Token-Block', token);
// Keine ortsabhängigen Sonderwerte mehr an der Knopfzeile außerhalb des Bausteins.
const vorBaustein = css.slice(0, css.indexOf('Baustein Zusage/Absage (Nacharbeit'));
pruefe(!/\.tk-rsvp[^{]*\{[^}]*padding-bottom/.test(vorBaustein) && !/\.tk-rsvp[^{]*:last-child/.test(vorBaustein),
  'keine eigenen Abstandsregeln für .tk-rsvp vor dem Baustein');
const LUFT = Number(token || 14);

const { server, basis } = await starte(process.cwd());
const browser = await chromium.launch({ channel: 'chrome' });
const gesehen = new Set();
for (const profil of ['spieler', 'trainer']) {
  for (const ohne of [false, true, 'grund']) {
    for (const ziel of ['dashboard', 'kalender']) {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
      const page = await ctx.newPage();
      const d = daten();
      if (ohne === true) d.events.forEach((e) => { e.auto = false; });   // ohne Meldeschluss keine Rückmeldezeile
      if (ohne === 'grund') d.events.forEach((e) => { d.rsvps = d.rsvps.filter((r) => !(r.eventId === e.id && r.playerId === 'p06')); d.rsvps.push({ eventId: e.id, playerId: 'p06', status: 'ab', grund: 'Arbeit' }); });
      await installiere(page, profil, { daten: d });
      await page.goto(basis); await warteAufApp(page);
      if (ziel !== 'dashboard') { await page.click('#appNav [data-view="' + ziel + '"]'); await page.waitForTimeout(500); }
      const liste = await page.evaluate(() => [...document.querySelectorAll('.tk-rsvp')].map((x) => {
        const card = x.closest('.card'); const b = x.querySelectorAll('.tk-btn');
        const r0 = b[0].getBoundingClientRect(), r1 = b[1].getBoundingClientRect();
        const prev = x.previousElementSibling, next = x.nextElementSibling;
        const rc = card.getBoundingClientRect(), rb = x.parentElement.getBoundingClientRect();
        const oben = prev ? prev.getBoundingClientRect().bottom : rb.top;
        const unten = next ? next.getBoundingClientRect().top : rc.bottom - parseFloat(getComputedStyle(card).borderBottomWidth);
        return { art: (card.className.match(/is-(hero|spiel|training|sonstiges)/) || [, '?'])[1] + (x.classList.contains('is-gross') ? '-gross' : ''),
          nach: next ? next.className.split(' ')[0] : 'kartenende', zwischen: r1.left - r0.right, oben: r0.top - oben, unten: unten - r0.bottom };
      }));
      pruefe(liste.length > 0, profil + ' ' + ziel + (ohne === true ? ' ohne Zeile' : ohne ? ' mit Grund' : '') + ': Knopfzeilen gefunden', liste.length);
      for (const m of liste) {
        const name = profil + ' · ' + ziel + ' · ' + m.art + ' → ' + m.nach;
        if (gesehen.has(name)) continue; gesehen.add(name);
        const ok = Math.abs(m.zwischen - 8) <= 0.5 && Math.abs(m.oben - LUFT) <= 0.5 && Math.abs(m.unten - LUFT) <= 0.5;
        pruefe(ok, name + ': 8 / ' + LUFT + ' / ' + LUFT, 'zwischen ' + m.zwischen + ', oben ' + m.oben + ', unten ' + m.unten);
      }
      await ctx.close();
    }
  }
}
await browser.close(); server.close();
console.log(fehler.length ? '--- NICHT bestanden: ' + fehler.length + ' ---' : '--- bestanden ---');
process.exit(fehler.length ? 1 : 0);
