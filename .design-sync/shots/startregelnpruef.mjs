/* Startregeln vom 19.10.2026 in der App (Stand-in, Chromium und WebKit, 390 px):
   1. Auge an allen Passwortfeldern: Anmelden, Registrieren, neues Passwort
      (Reset-Link, zwei Felder), Profil › Passwort (zwei Felder). Jedes Feld
      hat den Knopf (mind. 44 px), er schaltet sichtbar/verborgen und schickt
      das Formular nicht ab.
   2. 24-Stunden-Regel (Migration 0078): Uhr 06.10.2026 18:00, Training um
      19:30, Meldeschluss 16:30 vorbei. Freigegeben vor 8 h: kein „kostet 8 €“,
      keine Rueckfrage. Freigegeben vor Wochen: Hinweis und Rueckfrage wie bisher.
   Aufruf: node .design-sync/shots/startregelnpruef.mjs                      */
import { chromium, webkit } from 'playwright';
import { starte } from './server.mjs';
import { installiere, warteAufApp, daten } from './landkartenmodul.mjs';

const fehler = [];
const pruefe = (ok, t, d) => { console.log((ok ? '  ok   ' : '  FEHL ') + t + (!ok && d !== undefined ? '   ' + d : '')); if (!ok) fehler.push(t); };
const { server, basis } = await starte(process.cwd());

async function seite(browser, profil, o) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, locale: 'de-DE', timezoneId: 'Europe/Berlin', serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const dialoge = [];
  page.on('dialog', (d) => { dialoge.push(d.message()); d.dismiss().catch(() => {}); });
  const inst = await installiere(page, profil, { daten: daten(), ...(o.opts || {}) });
  await page.goto(basis + (o.hash || ''), { waitUntil: 'load' });
  await warteAufApp(page).catch(() => {});
  await page.waitForTimeout(600);
  return { ctx, page, inst, dialoge };
}

// Alle Passwortfelder der Ansicht: Auge da, gross genug, schaltet um
async function augenPruefen(page, wo, anzahl) {
  const felder = await page.evaluate(() => [...document.querySelectorAll('input[type="password"]')].map((i) => {
    const b = i.parentElement && i.parentElement.querySelector('[data-pw-auge]');
    const r = b ? b.getBoundingClientRect() : null;
    return { auge: !!b, w: r ? Math.round(r.width) : 0, h: r ? Math.round(r.height) : 0 };
  }));
  pruefe(felder.length === anzahl && felder.every((f) => f.auge && f.w >= 44 && f.h >= 44), `${wo}: ${anzahl} Passwortfeld(er), jedes mit Auge (44 px)`, JSON.stringify(felder));
  for (let i = 0; i < anzahl; i++) {
    const knopf = page.locator('[data-pw-auge]').nth(i);
    await knopf.click(); await page.waitForTimeout(100);
    const an = await page.evaluate((i) => { const b = document.querySelectorAll('[data-pw-auge]')[i]; const f = b.parentElement.querySelector('input'); return { typ: f.type, p: b.getAttribute('aria-pressed'), l: b.getAttribute('aria-label') }; }, i);
    await knopf.click(); await page.waitForTimeout(100);
    const aus = await page.evaluate((i) => { const b = document.querySelectorAll('[data-pw-auge]')[i]; const f = b.parentElement.querySelector('input'); return { typ: f.type, p: b.getAttribute('aria-pressed') }; }, i);
    pruefe(an.typ === 'text' && an.p === 'true' && /verbergen/.test(an.l) && aus.typ === 'password' && aus.p === 'false', `${wo} Feld ${i + 1}: Auge zeigt und verbirgt`, JSON.stringify([an, aus]));
  }
}

for (const [bname, btyp] of [['chromium', chromium], ['webkit', webkit]]) {
  const browser = await btyp.launch(bname === 'chromium' ? { channel: 'chrome' } : {});
  console.log('\n===== ' + bname + ' =====');

  // Anmelden und Registrieren
  {
    const { ctx, page, inst } = await seite(browser, 'anmeldung', {});
    await page.waitForSelector('input[name="password"]');
    await augenPruefen(page, 'Anmelden', 1);
    const prot = (await inst.protokoll()).map((x) => x.methode);
    pruefe(prot.indexOf('signIn') < 0, 'Anmelden: Auge schickt das Formular nicht ab', JSON.stringify(prot));
    await page.click('[data-auth="register"]').catch(() => {}); await page.waitForTimeout(400);
    await augenPruefen(page, 'Registrieren', 1);
    pruefe((await inst.protokoll()).every((x) => x.methode !== 'signUp'), 'Registrieren: Auge schickt das Formular nicht ab');
    await ctx.close();
  }
  // Neues Passwort ueber den Reset-Link
  {
    const { ctx, page } = await seite(browser, 'anmeldung', { hash: '#type=recovery' });
    await page.waitForSelector('#authForm[data-mode="reset"]', { timeout: 10000 }).catch(() => {});
    await augenPruefen(page, 'Neues Passwort', 2);
    await ctx.close();
  }
  // Profil › Passwort
  {
    const { ctx, page } = await seite(browser, 'spieler', { hash: '#ein=profil' });
    await page.click('[data-pw-aendern]'); await page.waitForTimeout(500);
    await augenPruefen(page, 'Profil › Passwort', 2);
    await ctx.close();
  }

  // 24-Stunden-Regel
  for (const [fall, frei, soll] of [['freigegeben vor 8 h', '2026-10-06T08:00:00Z', 'frei'], ['freigegeben vor Wochen', '2026-09-01T10:00:00Z', 'strafe']]) {
    // ohne eigene Rueckmeldung zum Training, damit die Zusage wirklich neu ist
    const d = daten(); d.rsvps = d.rsvps.filter((r) => !(r.eventId === 'e-tr1' && r.playerId === 'p06'));
    const { ctx, page, inst, dialoge } = await seite(browser, 'spieler', { opts: { daten: d, jetzt: '2026-10-06T18:00:00+02:00', freigegebenAm: frei } });
    const t = await page.evaluate(() => document.getElementById('view').innerText);
    const kostet = /kostet 8 €/.test(t), frei8 = /Für dich ohne Strafe/.test(t);
    pruefe(soll === 'frei' ? (!kostet && frei8) : (kostet && !frei8), `${fall}: Hinweis nach Meldeschluss ${soll === 'frei' ? 'ohne' : 'mit'} Strafe`, JSON.stringify({ kostet, frei8 }));
    const zu = await page.$('.tk [data-rsvp="zu"]');
    if (zu) { await zu.click(); await page.waitForTimeout(500); }
    const rs = (await inst.protokoll()).filter((x) => x.methode === 'setRsvp').length;
    pruefe(zu && (soll === 'frei' ? (dialoge.length === 0 && rs === 1) : (dialoge.some((d) => /kostet 8 €/.test(d)) && rs === 0)),
      `${fall}: Zusage ${soll === 'frei' ? 'ohne Rückfrage gespeichert' : 'fragt nach (8 €)'}`, JSON.stringify({ zu: !!zu, dialoge, rs }));
    const b = await inst.bericht();
    pruefe(b.fehler.length === 0 && b.verstoesse.length === 0, `${fall}: Stand-in ohne Fehler`, JSON.stringify(b.fehler.concat(b.verstoesse).slice(0, 3)));
    await ctx.close();
  }
  await browser.close();
}
server.close();
console.log(fehler.length ? `\n--- ${fehler.length} Beanstandung(en) ---` : '\n--- bestanden ---');
process.exit(fehler.length ? 1 : 0);
