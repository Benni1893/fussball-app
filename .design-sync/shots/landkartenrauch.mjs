/* Rauchtest fuer das Landkarten-Stand-in (Paket L, Schritt L1).
   Laedt die echte App je Profil mit landkartenmodul.mjs statt db.js und
   prueft: App startet, 5. Tab passt zur Rolle, keine Diagnose-Seite, kein
   Request an Supabase, Schreibaufrufe landen nur im Protokoll. Ohne Konto,
   ohne Datenbank. Steht seit L4 (02.10.2026) auf der Pflichtliste.

   Aufruf: node .design-sync/shots/landkartenrauch.mjs
   Bilder je Profil (lokal, nicht versioniert) nach
   .design-sync/reference/compare/landkarte-rauch-<profil>.png             */
import fs from 'node:fs';
import { chromium } from 'playwright';
import { starte } from './server.mjs';
import { PROFILE, installiere, neuerKontext, warteAufApp, stubQuelle } from './landkartenmodul.mjs';

let fehler = 0, gut = 0;
function pruefe(ok, text, zusatz) {
  if (ok) { gut++; console.log('  ok   ' + text); }
  else { fehler++; console.log('  FEHL ' + text + (zusatz ? '  [' + zusatz + ']' : '')); }
}

/* ===== 1. Methodenliste: Stand-in deckt db.js genau ===================== */
console.log('--- Stand-in gegen db.js ---');
const echteNamen = (() => {
  const src = fs.readFileSync('db.js', 'utf8');
  const m = src.match(/\n  return \{([\s\S]*?)\};\n\}\)\(\);/);
  if (!m) throw new Error('Rueckgabeliste in db.js nicht gefunden');
  return m[1].split(/[\s,]+/).filter(Boolean).sort();
})();
const standinNamen = (() => {
  const fenster = {};
  new Function('window', stubQuelle('admin'))(fenster);
  return Object.keys(fenster.DB).sort();
})();
const fehlt = echteNamen.filter((n) => !standinNamen.includes(n));
const zuviel = standinNamen.filter((n) => !echteNamen.includes(n));
pruefe(fehlt.length === 0, 'jede Methode aus db.js hat ein Gegenstueck', fehlt.join(', '));
pruefe(zuviel.length === 0, 'das Stand-in erfindet keine Methode', zuviel.join(', '));
pruefe(['loadAll', 'getSession', 'myRoles', 'setRsvp'].every((n) => echteNamen.includes(n)),
       'Liste aus db.js gelesen (' + echteNamen.length + ' Namen)');

/* ===== 2. App je Profil ================================================= */
/* Erwarteter 5. Tab (app.js setupPrimaryNavTab): Beschriftung und Ziel. */
const TAB5 = {
  spieler:           { sichtbar: false },
  trainer:           { sichtbar: true, text: 'Trainer', ziel: 'view:lineup' },
  kassenwart:        { sichtbar: true, text: 'Kasse',   ziel: 'view:kasse' },
  trainerkassenwart: { sichtbar: true, text: 'Trainer', ziel: 'more' },
  admin:             { sichtbar: true, text: 'Mehr',    ziel: 'more' },
};

const { server, basis } = await starte(process.cwd());
const browser = await chromium.launch({ channel: 'chrome' });
fs.mkdirSync('.design-sync/reference/compare', { recursive: true });

for (const name of Object.keys(PROFILE)) {
  console.log('--- Profil ' + PROFILE[name].titel + ' ---');
  const ctx = await neuerKontext(browser);
  const page = await ctx.newPage();
  const lauf = await installiere(page, name);
  await page.goto(basis, { waitUntil: 'load' });
  let gestartet = true;
  try { await warteAufApp(page); } catch (e) { gestartet = false; }
  pruefe(gestartet, 'App ist gestartet');

  const zustand = await page.evaluate(() => {
    const nav = document.querySelector('.app-nav');
    const m = document.getElementById('navMore');
    const h1 = document.querySelector('#view h1');
    return {
      login: !!document.querySelector('.auth-submit'),
      nav: !!nav && getComputedStyle(nav).display !== 'none',
      diagnose: !!h1 && h1.textContent.trim() === 'Diagnose',
      titel: h1 ? h1.textContent.trim() : null,
      tab5: m ? { sichtbar: getComputedStyle(m).display !== 'none',
                  text: ((m.querySelector('.nav-label') || {}).textContent || '').trim(),
                  ziel: m.hasAttribute('data-more') ? 'more' : 'view:' + m.getAttribute('data-view') } : null,
      uhr: new Date().toISOString(),
      countdown: document.querySelectorAll('[data-cd-deadline]').length,
      zusageKnopf: !!document.querySelector('[data-rsvp="zu"]'),
      ohneRueckmeldung: !!document.querySelector('[data-rsvp-sheet]'),
      aufstellung: !!document.querySelector('[data-lineup-edit]'),
    };
  });
  pruefe(!zustand.diagnose, 'keine Diagnose-Seite');
  pruefe(zustand.uhr === '2026-10-02T16:00:00.000Z', 'Uhr steht auf Fr 02.10.2026, 18:00', zustand.uhr);

  if (name === 'anmeldung') {
    pruefe(zustand.login, 'Login-Maske steht');
    pruefe(!zustand.nav, 'keine Navigation vor der Anmeldung');
  } else if (PROFILE[name].freigabe === 'wartet') {
    // Onboarding (0061): ohne Freigabe nur die Schritte, keine Mannschaftsdaten.
    pruefe(!zustand.nav && !zustand.login, 'Onboarding statt Navigation');
    pruefe(zustand.titel === 'Datenschutz', 'erster Schritt Datenschutz', zustand.titel);
    pruefe(!zustand.zusageKnopf && !zustand.ohneRueckmeldung, 'keine Termine, keine Rückmeldungen');
  } else {
    pruefe(zustand.nav && !zustand.login, 'Navigation steht, keine Login-Maske');
    const soll = TAB5[name], ist = zustand.tab5 || {};
    if (!soll.sichtbar) pruefe(ist.sichtbar === false, '5. Tab ausgeblendet');
    else pruefe(ist.sichtbar && ist.text === soll.text && ist.ziel === soll.ziel,
                '5. Tab "' + soll.text + '" -> ' + soll.ziel, JSON.stringify(ist));
    pruefe(zustand.countdown > 0, 'Meldeschluss-Countdown sichtbar (' + zustand.countdown + ')');
    pruefe(zustand.zusageKnopf, 'Zusage-Knopf sichtbar (eigene Rueckmeldung offen)');
    const trainer = PROFILE[name].rollen.some((r) => r === 'coach' || r === 'admin');
    if (trainer) {
      pruefe(zustand.ohneRueckmeldung, 'offene Rueckmeldungen fuer Trainer sichtbar');
      pruefe(zustand.aufstellung, 'Aufstellung zum Spiel erreichbar');
    }
    await page.screenshot({ path: `.design-sync/reference/compare/landkarte-rauch-${name}.png`, fullPage: true });

    if (name === 'spieler') {
      await page.click('[data-rsvp="zu"]');
      await page.waitForTimeout(600);
      const prot = await lauf.protokoll();
      const rs = prot.find((x) => x.methode === 'setRsvp');
      pruefe(!!rs && rs.argumente[3] === 'zu', 'Zusage landet nur im Protokoll', JSON.stringify(prot));
    }
  }
  if (name === 'anmeldung') await page.screenshot({ path: '.design-sync/reference/compare/landkarte-rauch-anmeldung.png', fullPage: true });

  const b = await lauf.bericht();
  pruefe(b.verstoesse.length === 0, 'kein Request an Supabase', b.verstoesse.join(' | '));
  pruefe(b.fehler.length === 0, 'keine Seitenfehler, keine lokalen Fehlrequests', b.fehler.join(' | '));
  if (b.hinweise.length) console.log('  Hinweis: ' + b.hinweise.join(' | '));
  await ctx.close();
}

await browser.close();
server.close();
console.log(fehler ? `\n--- ${fehler} Beanstandung(en), ${gut} ok ---` : `\n--- bestanden (${gut} Pruefungen) ---`);
process.exit(fehler ? 1 : 0);
