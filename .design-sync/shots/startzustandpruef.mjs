/* Startzustand nach der Bereinigung (18.10.2026): Stand-in mit dem neuen
   Datenstand - ein Spieler ("Benjamin Lauck", fit), keine Strafen, keine
   Rueckmeldungen, Termine, Vorlage "4-3-3 Standard" ohne Belegung.
   Alle Rollen, 390 px. Geprueft: Kassenbanner im Saisonstart (0,00 EUR),
   Leerzustaende (Konto, Kasse, Kader, Rueckmeldungen, Trainer), Mein Status
   fit, Hero mit naechstem Termin, nirgends "undefined"/"NaN"/"null", keine
   Fehler im Startprotokoll und im Stand-in.
   Bilder: .design-sync/reference/app/startzustand/<rolle>_<ansicht>.png
   Aufruf: node .design-sync/shots/startzustandpruef.mjs                      */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { starte } from './server.mjs';
import { installiere, warteAufApp, daten } from './landkartenmodul.mjs';

const AUS = '.design-sync/reference/app/startzustand';
fs.mkdirSync(AUS, { recursive: true });
const fehler = [];
const pruefe = (ok, t, d) => { console.log((ok ? '  ok   ' : '  FEHL ') + t + (!ok && d !== undefined ? '   ' + d : '')); if (!ok) fehler.push(t); };

function sauber() {
  const d = daten();
  d.players = d.players.filter((p) => p.id === 'p06').map((p) => ({ ...p, name: 'Benjamin Lauck', status: 'fit', statusNote: null, statusUntil: null, statusSince: null }));
  d.strafen = [];
  d.rsvps = [];
  d.lineups = [{ id: 'l-vorlage', eventId: null, name: '4-3-3 Standard', formation: '4-3-3', slots: {}, bank: [], isActive: false, isTemplate: true, updatedAt: '2026-10-18T09:00:00Z' }];
  d.gesundheitIds = ['p06'];
  return d;
}

const ROLLEN = {
  spieler: { profil: 'spieler' },
  trainer: { profil: 'trainer', opts: { rollen: ['coach'], ohneSpieler: true } },
  kassenwart: { profil: 'kassenwart' },
  spielertrainer: { profil: 'trainer' },
  admin: { profil: 'admin' },
};

const { server, basis } = await starte(process.cwd());
const browser = await chromium.launch({ channel: 'chrome' });

async function oeffne(rolle) {
  const R = ROLLEN[rolle];
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'de-DE' });
  const page = await ctx.newPage();
  page.on('dialog', (d) => d.dismiss().catch(() => {}));
  const inst = await installiere(page, R.profil, { ...(R.opts || {}), daten: sauber() });
  await page.goto(basis, { waitUntil: 'load' }); await warteAufApp(page);
  await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation:none!important}' });
  return { ctx, page, inst };
}
// Text der sichtbaren Ansicht (inkl. offener Blaetter) auf kaputte Werte pruefen
const kaputt = (page) => page.evaluate(() => {
  const t = document.body.innerText;
  const treffer = (t.match(/[^\n]{0,30}\b(undefined|NaN|null|\[object Object\])\b[^\n]{0,30}/g) || []);
  return { treffer, leer: (document.getElementById('view') || {}).innerText?.trim().length || 0 };
});
async function bild(page, name) { await page.screenshot({ path: path.join(AUS, name + '.png'), fullPage: true }); }
async function hash(page, h) { await page.evaluate((h) => { location.hash = h; }, h); await page.waitForTimeout(700); }

for (const rolle of Object.keys(ROLLEN)) {
  console.log('\n--- ' + rolle + ' ---');
  const { ctx, page, inst } = await oeffne(rolle);
  const kw = rolle === 'kassenwart' || rolle === 'admin';
  const tr = rolle === 'trainer' || rolle === 'spielertrainer' || rolle === 'admin';
  const linked = rolle !== 'trainer';

  // Uebersicht
  const ue = await page.evaluate(() => ({
    hero: !!document.querySelector('.tk'), heroTitel: (document.querySelector('.tk .tk-titel') || {}).textContent || '',
    kb: (document.querySelector('.kb') || {}).className || '', wert: ((document.querySelector('.kb-value') || {}).textContent || '').replace('›', '').trim(),
    pct: (document.querySelector('.kb-pct') || {}).textContent || '', offenT: (document.querySelector('.kb-offen-t') || {}).textContent || '',
    status: !!document.querySelector('.st-knopf.st-fit.is-on'), boot: (window.__bootL || {}).errors || [] }));
  pruefe(ue.hero && ue.heroTitel.trim().length > 0, rolle + ': Hero zeigt den nächsten Termin (' + ue.heroTitel.trim() + ')');
  pruefe(/is-clear/.test(ue.kb) && ue.wert.replace(/ /g, ' ') === '0,00 €' && ue.pct === 'Noch keine Strafen' && ue.offenT === 'Nichts offen', rolle + ': Kassenbanner Saisonstart 0,00 €', JSON.stringify(ue));
  if (linked) pruefe(ue.status, rolle + ': Mein Status fit');
  pruefe(ue.boot.length === 0, rolle + ': keine Fehler im Startprotokoll', JSON.stringify(ue.boot));
  let k = await kaputt(page); pruefe(k.treffer.length === 0, rolle + ': Übersicht ohne undefined/NaN/null', JSON.stringify(k.treffer));
  await bild(page, rolle + '_uebersicht');

  // Konto: Ich (falls verknuepft) und Mannschaft
  await hash(page, '#strafen=offen');
  if (linked) {
    await page.click('[data-kseg="ich"]').catch(() => {}); await page.waitForTimeout(400);
    k = await kaputt(page);
    const ich = await page.evaluate(() => ({ leer: (document.querySelector('.empty') || {}).textContent || '', banner: !!document.querySelector('.mine-banner') }));
    pruefe(k.treffer.length === 0 && (ich.leer || ich.banner), rolle + ': Konto › Ich mit Leerzustand (' + ich.leer + ')', JSON.stringify([ich, k.treffer]));
    await bild(page, rolle + '_konto-ich');
  }
  await page.click('[data-kseg="team"]'); await page.waitForTimeout(400);
  k = await kaputt(page);
  const team = await page.evaluate(() => ({ leer: (document.querySelector('.empty') || {}).textContent || '', zeilen: document.querySelectorAll('.kt-row').length }));
  pruefe(k.treffer.length === 0 && team.zeilen === 0 && team.leer === 'Keine offenen Strafen', rolle + ': Konto › Mannschaft leer („' + team.leer + '“)', JSON.stringify([team, k.treffer]));
  await bild(page, rolle + '_konto-mannschaft');

  // Kasse (Kassenwart/Admin): alle Reiter
  if (kw) {
    for (const reiter of ['pruefen', 'offen', 'bezahlt']) {
      await hash(page, '#kasse=' + reiter);
      k = await kaputt(page);
      const ks = await page.evaluate(() => ({ text: (document.getElementById('view') || {}).innerText || '', leer: [...document.querySelectorAll('.ks-leer, .empty, .ks-leer-t')].map((e) => e.textContent.trim()).filter(Boolean) }));
      pruefe(k.treffer.length === 0 && ks.leer.length > 0, rolle + ': Kasse › ' + reiter + ' mit Leerzustand (' + ks.leer.join(' / ') + ')', JSON.stringify([ks.leer, k.treffer, ks.text.slice(0, 200)]));
      await bild(page, rolle + '_kasse-' + reiter);
    }
  }

  // Trainer: Kader, Rueckmeldungen-Blatt, Trainer-Ansicht mit leerer Vorlage
  if (tr) {
    await hash(page, '#ansicht=kader');
    k = await kaputt(page);
    const kad = await page.evaluate(() => ({ zeilen: document.querySelectorAll('.kad-row, .row.kad-row').length, text: ((document.getElementById('view') || {}).innerText || '').slice(0, 300) }));
    pruefe(k.treffer.length === 0 && kad.zeilen === 1, rolle + ': Kader mit genau einem Spieler', JSON.stringify([kad, k.treffer]));
    await bild(page, rolle + '_kader');

    await hash(page, '#ansicht=dashboard');
    const rs = await page.$('[data-rsvp-sheet]');
    if (rs) {
      await rs.click(); await page.waitForTimeout(600);
      k = await kaputt(page);
      const blatt = await page.evaluate(() => ({ namen: document.querySelectorAll('#rsvpSheet .rs2-zeile').length, leer: (document.querySelector('#rsvpSheet .rs2-leer') || {}).textContent || '',
        kacheln: [...document.querySelectorAll('#rsvpSheet .rs2-k-z')].map((e) => e.textContent) }));
      pruefe(k.treffer.length === 0 && (blatt.namen === 1 || blatt.leer), rolle + ': Rückmeldungen-Blatt mit einem Spieler', JSON.stringify([blatt, k.treffer]));
      await page.screenshot({ path: path.join(AUS, rolle + '_rueckmeldungen.png') });
      await page.click('#rsvpSheet [data-sheet-close], #rsvpSheet .rs2-zu').catch(() => {}); await page.waitForTimeout(400);
    } else pruefe(rolle === 'trainer', rolle + ': Rückmeldungen-Blatt erreichbar');

    // Trainer-Ansicht: ueber das Menue "Trainer"
    await page.evaluate(() => { const b = document.querySelector('[data-view="lineup"]'); if (b) b.click(); });
    await page.waitForTimeout(800);
    k = await kaputt(page);
    const tv = await page.evaluate(() => ({ text: ((document.getElementById('view') || {}).innerText || ''), vorlage: /4-3-3 Standard/.test(document.body.innerText) }));
    pruefe(k.treffer.length === 0 && tv.text.trim().length > 20, rolle + ': Trainer-Ansicht ohne kaputte Werte' + (tv.vorlage ? ', Vorlage sichtbar' : ''), JSON.stringify([k.treffer, tv.text.slice(0, 200)]));
    await bild(page, rolle + '_trainer');
  }

  const b = await inst.bericht();
  pruefe(b.fehler.length === 0 && b.verstoesse.length === 0, rolle + ': Stand-in ohne Fehler', JSON.stringify(b.fehler.concat(b.verstoesse).slice(0, 3)));
  await ctx.close();
}
await browser.close(); server.close();
console.log(fehler.length ? `\n--- ${fehler.length} Beanstandung(en) ---` : '\n--- bestanden ---');
process.exit(fehler.length ? 1 : 0);
