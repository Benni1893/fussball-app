/* Abbildungen der Einfuehrung und von "So geht's" als ECHTES HTML aus der App
   (Block 2, 19.10.2026): Die laufende App im Stand-in (feste Beispieldaten)
   rendert die Bausteine; dieses Skript schneidet den entscheidenden
   Ausschnitt heraus und schreibt ihn als HTML-Text in den Block
   EF-ABB in app.js. Keine Bilddateien.

   Je Ausschnitt: Element per Selektor, dazu die Klassen der Vorfahren bis
   #view als Huellen (damit alle Regeln aus styles.css greifen). Entfernt
   werden: id, data-*, aria-controls, tabindex, href, on*-Attribute, Inhalt
   von <script>. Knoepfe bleiben Knoepfe, die Huelle ist inert und aria-hidden.

   Aufruf: node .design-sync/shots/einfuehrungbausteine.mjs [--nur-zeigen]  */
import { chromium } from 'playwright';
import fs from 'node:fs';
import { starte } from './server.mjs';
import { installiere, warteAufApp, daten } from './landkartenmodul.mjs';

const NUR_ZEIGEN = process.argv.includes('--nur-zeigen');

/* Ausschnitte: name -> { profil, hash, vorher (Klicks), sel, nimm (optional: Teilauswahl im Element) } */
const AUSSCHNITTE = {
  terminkarte:    { profil: 'spieler', hash: '#ansicht=dashboard', sel: '.tk' },
  terminkarte_tr: { profil: 'trainer', hash: '#ansicht=dashboard', sel: '.tk' },
  status:         { profil: 'spieler', hash: '#ansicht=dashboard', sel: '.st-wahl' },
  kontobanner:    { profil: 'spieler', hash: '#strafen=offen', vorher: ['[data-kseg="ich"]'], sel: '.mine-banner' },
  rueckmeldungen: { profil: 'trainer', hash: '#ansicht=dashboard', vorher: ['[data-rsvp-sheet]'], sel: '#rsvpSheet .rs2-kacheln' },
  naechstes_spiel:{ profil: 'trainer', hash: '#ansicht=dashboard', vorher: ['[data-view="lineup"]'], sel: '.tv-next' },
  kader:          { profil: 'trainer', hash: '#ansicht=kader', sel: '.kad-liste', zeilen: { sel: '.kad-row', n: 3 } },
  rollen:         { profil: 'trainer', hash: '#ansicht=admin', sel: '#view', teile: ['Offene Anfragen', 'Mitglieder'], zeilen: { sel: '.ein-zeile', n: 3 } },
  kassenbanner:   { profil: 'kassenwart', hash: '#ansicht=dashboard', sel: '.kb' },
  strafe_knopf:   { profil: 'kassenwart', hash: '#kasse=offen', sel: '.ks-neu' },
  katalog:        { profil: 'kassenwart', hash: '#ansicht=katalog', sel: '.kat-list', zeilen: { sel: '.kat-item', n: 2 } },
  kasse_reiter:   { profil: 'kassenwart', hash: '#kasse=pruefen', sel: '.ks-seg' },
  kasse_meldung:  { profil: 'kassenwart', hash: '#kasse=pruefen', sel: '.ks-card' },
  navigation_sp:  { profil: 'spieler', hash: '#ansicht=dashboard', sel: '.app-nav' },
  profilzeile:    { profil: 'spieler', hash: '#ansicht=einstellungen', sel: '.ein-profil' },
  kalender_kopf:  { profil: 'trainer', hash: '#ansicht=kalender', sel: '.kal-kopf' },
};

const { server, basis } = await starte(process.cwd());
const browser = await chromium.launch({ channel: 'chrome' });
const ergebnis = {};
const fehlt = [];

for (const [name, a] of Object.entries(AUSSCHNITTE)) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'de-DE', timezoneId: 'Europe/Berlin' });
  const page = await ctx.newPage();
  await installiere(page, a.profil, { daten: daten() });
  await page.goto(basis + a.hash, { waitUntil: 'load' }); await warteAufApp(page);
  await page.waitForTimeout(600);
  for (const k of a.vorher || []) { await page.click(k).catch(() => {}); await page.waitForTimeout(700); }
  const html = await page.evaluate((a) => {
    const el = document.querySelector(a.sel);
    if (!el) return null;
    let c = el.cloneNode(true);
    // Teilauswahl: bei "teile" nur die genannten Gruppen (Ueberschrift plus folgende Gruppe)
    if (a.teile) {
      const neu = document.createElement('div');
      for (const h of el.querySelectorAll('.group-head')) {
        if (a.teile.indexOf(h.textContent.trim().replace(/\s+/g, ' ')) < 0 && a.teile.map((t) => t.toUpperCase()).indexOf(h.textContent.trim().toUpperCase()) < 0) continue;
        neu.appendChild(h.cloneNode(true));
        const g = h.nextElementSibling; if (g) neu.appendChild(g.cloneNode(true));
      }
      c = neu;
    }
    if (a.zeilen) {
      const zs = [...c.querySelectorAll(a.zeilen.sel)];
      // je Gruppe hoechstens n Zeilen
      const proEltern = new Map();
      for (const z of zs) { const p = z.parentElement; const n = (proEltern.get(p) || 0) + 1; proEltern.set(p, n); if (n > a.zeilen.n) z.remove(); }
    }
    // aufraeumen
    const alle = [c, ...c.querySelectorAll('*')];
    for (const x of alle) {
      for (const at of [...x.attributes]) {
        if (at.name === 'id' || at.name.startsWith('data-') || at.name.startsWith('on') || ['aria-controls', 'tabindex', 'href', 'target', 'rel', 'aria-expanded', 'aria-pressed'].indexOf(at.name) >= 0) x.removeAttribute(at.name);
      }
      if (x.tagName === 'SCRIPT') x.remove();
    }
    // Vorfahren bis #view (bzw. body) als Huellen mit ihren Klassen
    const huellen = [];
    for (let p = el.parentElement; p && p.id !== 'view' && p !== document.body; p = p.parentElement) {
      if (p.className && typeof p.className === 'string') huellen.unshift(p.className.trim());
    }
    return { html: c.outerHTML, huellen, breite: Math.round(el.getBoundingClientRect().width) };
  }, a);
  if (!html) fehlt.push(name); else ergebnis[name] = html;
  console.log((html ? '  ok   ' : '  FEHL ') + name + (html ? '  ' + html.html.length + ' Zeichen, Breite ' + html.breite + ', Huellen: ' + html.huellen.join(' > ') : ''));
  await ctx.close();
}
await browser.close(); server.close();

fs.writeFileSync('.design-sync/concepts/einfuehrung/abbildungen.json', JSON.stringify(ergebnis, null, 1));
if (!NUR_ZEIGEN && !fehlt.length) {
  const app = fs.readFileSync('app.js', 'utf8');
  const m = /(\/\* EF-ABB-ANFANG \*\/\n)[\s\S]*?(\n\s*\/\* EF-ABB-ENDE \*\/)/.exec(app);
  if (!m) { console.error('Block EF-ABB in app.js fehlt'); process.exit(1); }
  const zeilen = Object.entries(ergebnis).map(([k, v]) => '    ' + k + ': ' + JSON.stringify({ h: v.huellen, html: v.html }) + ',');
  const neu = app.replace(m[0], m[1] + '  const EF_ABB = {\n' + zeilen.join('\n') + '\n  };' + m[2]);
  fs.writeFileSync('app.js', neu);
  console.log('app.js: Block EF-ABB mit ' + zeilen.length + ' Abbildungen geschrieben');
}
process.exit(fehlt.length ? 1 : 0);
