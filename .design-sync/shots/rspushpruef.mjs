/* Nachschliff C2: „Push senden“ im Rückmeldungen-Blatt (Stand-in).
   Angebunden ist die vorhandene serverseitige Erinnerung P1
   (send_rsvp_reminder, Migration 0050): Empfänger ohne Zu- oder Absage,
   ohne verletzt/Urlaub, 12-Stunden-Sperre je Termin, Text aus Push-Texte.
   Geprüft wird die Oberfläche: nur echte Trainer/Admins, Bestätigung mit
   Anzahl, danach „An N gesendet“, kein zweites Senden (gesperrt, Zeit des
   letzten Versands sichtbar), deaktiviert ohne offene Spieler, „Rückmeldung
   teilen“ entfällt, „Übersicht teilen“ bleibt.
   Aufruf: node .design-sync/shots/rspushpruef.mjs                        */
import { chromium } from 'playwright';
import fs from 'node:fs';
import { starte } from './server.mjs';
import { installiere, warteAufApp, daten } from './landkartenmodul.mjs';

const fehler = [];
const pruefe = (ok, text, detail) => { console.log((ok ? '  ok   ' : '  FEHL ') + text + (detail !== undefined && !ok ? '   ' + detail : '')); if (!ok) fehler.push(text); };
const app = fs.readFileSync('app.js', 'utf8');
const mig = fs.readFileSync('supabase/migrations/0050_rueckmeldung_nachfrage.sql', 'utf8');
pruefe(/notify_spieler_faellt_aus_am\(pl\.id, e\.date\)/.test(mig) && /not exists \(select 1 from public\.rsvps rv where rv\.event_id = e\.id and rv\.player_id = pl\.id\)/.test(mig),
  'P1 (0050): nur Spieler ohne Zu- oder Absage, ohne verletzt/Urlaub am Termintag');
pruefe(/interval '12 hours'/.test(mig), 'P1 (0050): Sperre 12 Stunden je Termin');
pruefe(/rueckmeldung_nachfrage: "Nachfrage per Push"/.test(app), 'Text unter Push-Texte änderbar (rueckmeldung_nachfrage)');
pruefe(!/data-rs-erinnern/.test(app), '„Rückmeldung teilen“ entfällt');

const { server, basis } = await starte(process.cwd());
const browser = await chromium.launch({ channel: 'chrome' });
async function blatt(profil, antwort, vorher) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await installiere(page, profil);
  await page.goto(basis); await warteAufApp(page);
  await page.addStyleTag({ content: '*{transition:none!important}' });
  if (antwort) await page.evaluate((a) => {
    const orig = window.DB.sendRsvpReminder;
    window.__rsAufrufe = [];
    window.DB.sendRsvpReminder = async (id, nur) => { window.__rsAufrufe.push(nur ? 'zaehlen' : 'senden'); return nur ? a.zaehlen : a.senden; };
  }, antwort);
  if (vorher) await vorher(page);
  const da = await page.evaluate(() => !!document.querySelector('[data-rsvp-sheet]'));
  if (da) { await page.click('[data-rsvp-sheet]'); await page.waitForTimeout(500); }
  return { ctx, page, da };
}
const fuss = (page) => page.evaluate(() => {
  const f = document.querySelector('#rsvpSheet .rs2-fuss'); if (!f) return null;
  const push = f.querySelector('.rs2-push-b');
  return { knoepfe: [...f.querySelectorAll('.rs2-knoepfe .btn')].map((b) => b.textContent.trim()), push: push ? { aus: push.disabled, aktiv: push.hasAttribute('data-rs-push') } : null,
    hinweis: (f.querySelector('.rs2-hinweis') || {}).textContent || '', meldung: (f.querySelector('.rs2-meldung') || {}).textContent || '' };
});
const ANTWORT = { zaehlen: { offen: 5, ausgenommen: 1, ohne_konto: 0, ohne_abo: 1, abgeschaltet: 0, gesendet: 3, gesperrt: false, letzte: null, naechste_moeglich: null },
  senden: { offen: 5, ausgenommen: 1, ohne_konto: 0, ohne_abo: 1, abgeschaltet: 0, gesendet: 3, in_ruhezeit: 0, gesperrt: true, letzte: '2026-10-02T16:00:00Z', naechste_moeglich: '2026-10-03T04:00:00Z' } };

// 1) Admin: Knöpfe, Bestätigung, Senden, Sperre
{
  const { ctx, page } = await blatt('admin', ANTWORT);
  let f = await fuss(page);
  pruefe(f && JSON.stringify(f.knoepfe) === JSON.stringify(['Übersicht teilen', 'Push senden']), 'Fuß: Übersicht teilen | Push senden', JSON.stringify(f));
  pruefe(f && f.push && f.push.aktiv && !f.push.aus, 'Push senden bereit (Anzahl vorab gezählt)');
  await page.click('[data-rs-push]'); await page.waitForTimeout(300);
  const dlg = await page.evaluate(() => ({ t: (document.querySelector('#pushModal .push-best-t') || {}).textContent, k: [...document.querySelectorAll('#pushModal .push-best-k .btn')].map((b) => b.textContent.trim()) }));
  pruefe(dlg.t === 'Push an 3 offene Spieler senden?', 'Bestätigung nennt die Anzahl', dlg.t);
  pruefe(JSON.stringify(dlg.k) === JSON.stringify(['Abbrechen', 'Senden']), 'Bestätigung: Abbrechen | Senden', JSON.stringify(dlg.k));
  await page.click('#pushModal [data-push-abbr]'); await page.waitForTimeout(200);
  pruefe(!(await page.evaluate(() => window.__rsAufrufe.includes('senden'))), 'Abbrechen sendet nichts');
  await page.click('[data-rs-push]'); await page.waitForTimeout(200);
  await page.click('#pushModal [data-push-ok]'); await page.waitForTimeout(500);
  f = await fuss(page);
  pruefe(/^An 3 gesendet/.test(f.meldung), 'danach Rückmeldung „An 3 gesendet“', f.meldung);
  pruefe(f.push && f.push.aus && !f.push.aktiv, 'kein zweites Senden: Knopf gesperrt');
  pruefe(/^Zuletzt gesendet .* · wieder ab /.test(f.hinweis), 'Zeit des letzten Versands und Ende der Sperre sichtbar', f.hinweis);
  pruefe((await page.evaluate(() => window.__rsAufrufe.filter((x) => x === 'senden').length)) === 1, 'genau ein Versand');
  await ctx.close();
}
// 2) Sperre schon beim Öffnen (heute gesendet)
{
  const a = { zaehlen: Object.assign({}, ANTWORT.senden), senden: ANTWORT.senden };
  const { ctx, page } = await blatt('admin', a);
  const f = await fuss(page);
  pruefe(f.push && f.push.aus && /^Zuletzt gesendet/.test(f.hinweis), 'gesperrt beim Öffnen: Knopf aus, letzter Versand sichtbar', JSON.stringify(f));
  await ctx.close();
}
// 3) Niemand offen: Push senden deaktiviert
{
  const d = daten(); d.players.forEach((pl) => { d.rsvps = d.rsvps.filter((r) => !(r.eventId === 'e-sp1' && r.playerId === pl.id)); d.rsvps.push({ eventId: 'e-sp1', playerId: pl.id, status: 'zu', grund: null }); });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage(); await installiere(page, 'admin', { daten: d });
  await page.goto(basis); await warteAufApp(page);
  await page.click('[data-rsvp-sheet="e-sp1"]'); await page.waitForTimeout(500);
  const f = await fuss(page);
  pruefe(f && f.push && f.push.aus && !f.push.aktiv, 'niemand offen: Push senden deaktiviert', JSON.stringify(f));
  await ctx.close();
}
// 4) Rollenvorschau und Spieler: kein Push
{
  const { ctx, page, da } = await blatt('spieler', null);
  pruefe(!da || !(await page.evaluate(() => !!document.querySelector('.rs2-push-b'))), 'Spieler: kein Rückmeldungen-Blatt mit Push');
  await ctx.close();
}
pruefe(app.includes('return !Roles.isSimulating() && (Roles.real.indexOf("coach") !== -1 || Roles.isRealAdmin())'), 'Push nur für die echte Rolle Trainer oder Admin, nie in der Rollenvorschau');
await browser.close(); server.close();
console.log(fehler.length ? '--- NICHT bestanden: ' + fehler.length + ' ---' : '--- bestanden ---');
process.exit(fehler.length ? 1 : 0);
