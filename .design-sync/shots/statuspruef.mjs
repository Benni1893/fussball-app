/* Nachschliff C1: Mein Status (Übersicht und Profil) im Stand-in.
   Fit setzt direkt; Angeschlagen, Verletzt, Urlaub öffnen das Blatt
   „Voraussichtlich bis“; Speichern schreibt Status, Notiz und Datum in EINEM
   Aufruf über den vorhandenen Weg (DB.setPlayerStatus -> set_player_status,
   Migration 0031: p_note, p_until); Abbrechen schreibt nichts; „Ändern“
   öffnet das Blatt mit den gespeicherten Werten; gewählter Status farbig.
   Aufruf: node .design-sync/shots/statuspruef.mjs                         */
import { chromium } from 'playwright';
import fs from 'node:fs';
import { starte } from './server.mjs';
import { installiere, warteAufApp, daten } from './landkartenmodul.mjs';

const fehler = [];
const pruefe = (ok, text, detail) => { console.log((ok ? '  ok   ' : '  FEHL ') + text + (detail !== undefined && !ok ? '   ' + detail : '')); if (!ok) fehler.push(text); };
const app = fs.readFileSync('app.js', 'utf8');
const mig = fs.readFileSync('supabase/migrations/0031_status_urlaub.sql', 'utf8');
pruefe(/set_player_status\(\s*p_player_id\s+uuid,\s*p_status\s+text,\s*p_note\s+text default null,\s*p_until\s+date default null/.test(mig), 'set_player_status hat Notiz und Datum (0031)');
pruefe(/DB\.setPlayerStatus\(playerId, status, note, until\)/.test(app), 'die App schreibt über den vorhandenen Weg (DB.setPlayerStatus)');

const { server, basis } = await starte(process.cwd());
const browser = await chromium.launch({ channel: 'chrome' });
async function seite(d, ziel) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await installiere(page, 'spieler', d ? { daten: d } : undefined);
  await page.goto(basis); await warteAufApp(page);
  if (ziel) { await page.evaluate((h) => { location.hash = h; }, ziel); await page.waitForTimeout(500); }
  await page.addStyleTag({ content: '*{transition:none!important}' });
  return { ctx, page };
}
const letzte = (page) => page.evaluate(() => (window.__dbProtokoll || []).filter((x) => x.methode === 'setPlayerStatus'));

// 1) Spieler fit: Fit gewählt, Haken; andere mit Punkt
{
  const { ctx, page } = await seite();
  const r = await page.evaluate(() => [...document.querySelectorAll('.st-raster .st-knopf')].map((b) => ({ w: b.dataset.wert, an: b.classList.contains('is-on'), haken: !!b.querySelector('.st-haken'), punkt: !!b.querySelector('.st-dot'), farbe: getComputedStyle(b).color })));
  pruefe(r.length === 4, 'vier Status-Knöpfe im Raster', JSON.stringify(r));
  pruefe(r[0] && r[0].an && r[0].haken, 'Fit gewählt mit Haken');
  pruefe(r.slice(1).every((x) => !x.an && x.punkt), 'die anderen nicht gewählt, mit Punkt');
  pruefe(r[0] && r[0].farbe === 'rgb(20, 74, 55)', 'Fit gewählt in --green-800', r[0] && r[0].farbe);
  // 2) Verletzt öffnet das Blatt, Abbrechen schreibt nichts
  await page.click('.st-knopf.st-verletzt'); await page.waitForTimeout(300);
  const offen = await page.evaluate(() => ({ da: !!document.getElementById('statusFenster'), titel: (document.querySelector('#statusFenster .sf-titel') || {}).textContent, bis: (document.querySelector('[data-sf-bis]') || {}).value, gesperrt: getComputedStyle(document.body).position === 'fixed' }));
  pruefe(offen.da && /Verletzt/.test(offen.titel), 'Verletzt öffnet das Blatt mit Titel „Verletzt“', JSON.stringify(offen));
  pruefe(offen.bis === '', 'neuer Status: Datum leer');
  pruefe(offen.gesperrt, 'Hintergrund gesperrt, solange das Blatt offen ist');
  await page.click('#statusFenster [data-sf-zu].nsb-sek'); await page.waitForTimeout(300);
  pruefe(!(await page.evaluate(() => !!document.getElementById('statusFenster'))) && (await letzte(page)).length === 0, 'Abbrechen schließt ohne zu schreiben');
  // 3) Urlaub mit Datum und Notiz speichern
  await page.click('.st-knopf.st-urlaub'); await page.waitForTimeout(300);
  await page.fill('[data-sf-bis]', '2026-10-25'); await page.dispatchEvent('[data-sf-bis]', 'change');
  pruefe(/So, 25\. Okt 2026/.test(await page.textContent('[data-sf-anz]')), 'Datum wird lesbar angezeigt (So, 25. Okt 2026)');
  await page.fill('[data-sf-notiz]', 'Mallorca');
  await page.click('[data-sf-speichern]'); await page.waitForTimeout(500);
  const w = await letzte(page);
  pruefe(w.length === 1 && JSON.stringify(w[0].argumente) === JSON.stringify(['p06', 'urlaub', 'Mallorca', '2026-10-25']), 'Speichern: ein Aufruf mit Status, Notiz und Datum', JSON.stringify(w));
  // 4) Fit setzt direkt, ohne Blatt, leert Notiz und Datum
  await page.click('.st-knopf.st-fit'); await page.waitForTimeout(400);
  const w2 = await letzte(page);
  pruefe(!(await page.evaluate(() => !!document.getElementById('statusFenster'))) && w2.length === 2 && JSON.stringify(w2[1].argumente) === JSON.stringify(['p06', 'fit', null, null]), 'Fit setzt direkt und leert Notiz und Datum', JSON.stringify(w2));
  await ctx.close();
}
// 5) Gespeicherter Status: Zeile und Ändern
{
  const d = daten(); Object.assign(d.players.find((p) => p.id === 'p06'), { status: 'angeschlagen', statusNote: 'Wade zu', statusUntil: '2026-10-18', statusSince: '2026-10-01' });
  const { ctx, page } = await seite(d);
  const z = await page.evaluate(() => ({ t: ((document.querySelector('.st-zeile-t') || {}).textContent || '').replace(new RegExp(String.fromCharCode(160), 'g'), ' '), s: (document.querySelector('.st-zeile-s') || {}).textContent,
    an: (document.querySelector('.st-knopf.is-on') || {}).dataset, rand: getComputedStyle(document.querySelector('.st-knopf.is-on')).borderTopColor, schrift: getComputedStyle(document.querySelector('.st-knopf.is-on')).color }));
  pruefe(z.t === 'Voraussichtlich bis So, 18. Okt', 'Zeile „Voraussichtlich bis So, 18. Okt“', z.t);
  pruefe(z.s === 'Wade zu', 'Notiz in der Zeile', z.s);
  pruefe(z.an && z.an.wert === 'angeschlagen' && z.rand === 'rgb(185, 119, 14)' && z.schrift === 'rgb(107, 78, 10)', 'Angeschlagen gewählt: Rand --amber-600, Schrift --gold-ink-2', JSON.stringify(z));
  await page.click('.st-aendern'); await page.waitForTimeout(300);
  const f = await page.evaluate(() => ({ bis: document.querySelector('[data-sf-bis]').value, notiz: document.querySelector('[data-sf-notiz]').value, titel: document.querySelector('#statusFenster .sf-titel').textContent }));
  pruefe(f.bis === '2026-10-18' && f.notiz === 'Wade zu' && /Angeschlagen/.test(f.titel), '„Ändern“ öffnet das Blatt mit den gespeicherten Werten', JSON.stringify(f));
  await ctx.close();
}
// 6) Profil: dieselbe Auswahl, dasselbe Blatt
{
  const { ctx, page } = await seite(null, '#ein=profil');
  const n = await page.evaluate(() => document.querySelectorAll('.st-raster .st-knopf').length);
  pruefe(n === 4, 'Profil zeigt dieselbe Status-Auswahl', n);
  if (n) { await page.click('.st-knopf.st-angeschlagen'); await page.waitForTimeout(300); }
  pruefe(await page.evaluate(() => !!document.getElementById('statusFenster')), 'Profil: Angeschlagen öffnet das Blatt');
  await ctx.close();
}
await browser.close(); server.close();
console.log(fehler.length ? '--- NICHT bestanden: ' + fehler.length + ' ---' : '--- bestanden ---');
process.exit(fehler.length ? 1 : 0);
