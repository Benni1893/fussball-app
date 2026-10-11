/* Onboarding (Migration 0061) im Stand-in, ohne Datenbank: Registrierung
   ueber den Einladungslink, Onboarding-Schritte und Wartebildschirm eines
   Kontos ohne Freigabe, Seite "Rollen verwalten" (Einladung, Anfragen,
   Mitglieder, Protokoll) fuer Trainer und Admin, Profil mit Position,
   Datenschutz und "Konto loeschen", Zahlknopf ohne PayPal-Link.
   Den echten Weg gegen die Datenbank prueft onboarding_e2e.mjs (nicht auf
   der Pflichtliste, legt Testkonten an und raeumt sie wieder weg).
   Aufruf: node .design-sync/shots/onboardingpruef.mjs                    */
import { chromium } from 'playwright';
import fs from 'node:fs';
import { starte } from './server.mjs';
import { installiere, daten } from './landkartenmodul.mjs';

const fehler = [];
const pruefe = (ok, text, detail) => { console.log((ok ? '  ok   ' : '  FEHL ') + text + (detail !== undefined && !ok ? '   ' + detail : '')); if (!ok) fehler.push(text); };
const app = fs.readFileSync('app.js', 'utf8');
const db = fs.readFileSync('db.js', 'utf8');
pruefe(/options: \{ data: meta \|\| \{\}/.test(db), 'signUp gibt Name und Einladung als Metadaten mit');
pruefe(!/PAYPAL_ME\s*=/.test(app), 'PayPal-Link nicht mehr fest im Code (E8)');
pruefe(/placeholder="optional, keine Diagnosen"/.test(app), 'Hinweis am Notizfeld des Status (E11)');
pruefe(fs.existsSync('datenschutz.html') && fs.existsSync('impressum.html'), 'Seiten Datenschutzerklärung und Impressum vorhanden');

const { server, basis } = await starte(process.cwd());
const browser = await chromium.launch({ channel: 'chrome' });
async function seite(profil, opts, hash) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on('dialog', (d) => d.accept().catch(() => {}));
  await installiere(page, profil, opts);
  await page.goto(basis + (hash || '')); await page.waitForTimeout(1500);
  await page.addStyleTag({ content: '*{transition:none!important}' });
  return { ctx, page };
}
const h1 = (page) => page.evaluate(() => (document.querySelector('#view h1') || {}).textContent || '');

// 1) Registrierung nur mit gueltigem Link
{
  const { ctx, page } = await seite('anmeldung', null, '#einladung=landkarte-einladung');
  pruefe(await h1(page) === 'Konto erstellen', 'gültiger Link: Registrierung', await h1(page));
  const f = await page.evaluate(() => [...document.querySelectorAll('#authForm input')].map((i) => i.name));
  pruefe(JSON.stringify(f) === JSON.stringify(['name', 'email', 'password']), 'Felder Name, E-Mail, Passwort', JSON.stringify(f));
  pruefe(await page.evaluate(() => /Datenschutz/.test(document.querySelector('.ob-recht').textContent)), 'Datenschutz und Impressum vor der Anmeldung erreichbar');
  await ctx.close();
}
{
  const { ctx, page } = await seite('anmeldung', null, '#einladung=ungueltig-123');
  const t = await page.evaluate(() => ({ h: (document.querySelector('#view h1') || {}).textContent, f: (document.querySelector('.auth-error') || {}).textContent || '', reg: !!document.querySelector('[data-auth="register"]') }));
  pruefe(t.h === 'Anmelden' && /nicht mehr gültig/.test(t.f) && !t.reg, 'ungültiger Link: Hinweis, keine Registrierung', JSON.stringify(t));
  await ctx.close();
}
// 2) Onboarding und Warten ohne Mannschaftsdaten
{
  const { ctx, page } = await seite('wartend');
  pruefe(await h1(page) === 'Datenschutz', 'Schritt 1 Datenschutz');
  pruefe(await page.evaluate(() => !document.querySelector('.tk-btn, .card.tk, [data-rsvp]') && getComputedStyle(document.querySelector('.app-nav')).display === 'none'), 'keine Termine, keine Navigation');
  pruefe(await page.evaluate(() => document.querySelector('[data-ob="datenschutz"]').disabled), 'Weiter erst nach Zustimmung');
  await page.click('[data-ob-ds]'); await page.click('[data-ob-ge]'); await page.click('[data-ob="datenschutz"]'); await page.waitForTimeout(400);
  const w = await page.evaluate(() => (window.__dbProtokoll || []).filter((x) => x.methode === 'einwilligungSetzen').map((x) => x.argumente[0] + ':' + x.argumente[1]));
  pruefe(JSON.stringify(w) === JSON.stringify(['datenschutz:true', 'gesundheit:true']), 'Einwilligungen Datenschutz und Gesundheit getrennt gespeichert', JSON.stringify(w));
  pruefe(await h1(page) === 'Deine Position', 'Schritt 2 Position');
  const pos = await page.evaluate(() => [...document.querySelectorAll('[data-ob-pos]')].map((b) => b.dataset.obPos));
  pruefe(JSON.stringify(pos) === JSON.stringify(['torwart', 'abwehr', 'mittelfeld', 'sturm']), 'vier Hauptpositionen (E7)', JSON.stringify(pos));
  await page.click('[data-ob-pos="sturm"]'); await page.click('[data-ob="position"]'); await page.waitForTimeout(400);
  pruefe(await h1(page) === 'Zum Home-Bildschirm', 'Schritt 3 Home-Bildschirm (im Browser)');
  pruefe(await page.evaluate(() => [...document.querySelectorAll('.ob-anl-t')].map((e) => e.textContent).join('|')) === 'iPhone (Safari)|Android (Chrome)' ||
         await page.evaluate(() => [...document.querySelectorAll('.ob-anl-t')].length === 2), 'iPhone und Android getrennt erklärt');
  await page.click('[data-ob="home"]'); await page.waitForTimeout(300);
  pruefe(await h1(page) === 'Warte auf Freigabe', 'Wartebildschirm');
  pruefe(await page.evaluate(() => !!document.querySelector('[data-ob="konto-weg"]') && !!document.querySelector('[data-ob="abmelden"]')), 'Abmelden und Konto löschen auf dem Wartebildschirm');
  const geladen = await page.evaluate(() => (window.__dbProtokoll || []).length);
  pruefe(geladen === 3, 'nur Einwilligungen und Position geschrieben', geladen);
  await ctx.close();
}
// 3) Rollen verwalten: Trainer und Admin
for (const profil of ['trainer', 'admin']) {
  const { ctx, page } = await seite(profil);
  await page.evaluate(() => { location.hash = '#ansicht=admin'; }); await page.waitForTimeout(800);
  const t = await page.evaluate(() => ({ h: (document.querySelector('#view h1') || {}).textContent, gruppen: [...document.querySelectorAll('.group-head h2')].map((e) => e.textContent),
    link: [...document.querySelectorAll('.ein-schalter-s')].some((e) => /#einladung=landkarte-einladung$/.test(e.textContent)) }));
  pruefe(t.h === 'Rollen verwalten' && t.link, profil + ': Rollen verwalten mit Einladungslink', JSON.stringify(t));
  pruefe(['Einladung', 'Offene Anfragen', 'Mitglieder', 'Protokoll'].every((g) => t.gruppen.indexOf(g) >= 0), profil + ': Einladung, Anfragen, Mitglieder, Protokoll', JSON.stringify(t.gruppen));
  await page.click('[data-mf-anfrage]'); await page.waitForTimeout(400);
  const fg = await page.evaluate(() => ({ da: !!document.getElementById('freigabeBlatt'), wahl: document.querySelectorAll('#freigabeBlatt [data-fg-wahl]').length }));
  pruefe(fg.da && fg.wahl === 4, profil + ': Freigabe-Blatt mit neuem Eintrag und drei freien Kadereinträgen', JSON.stringify(fg));
  await page.click('#freigabeBlatt [data-fg-wahl="p03"]'); await page.click('#freigabeBlatt [data-fg="freigeben"]'); await page.waitForTimeout(600);
  const fr = await page.evaluate(() => (window.__dbProtokoll || []).filter((x) => x.methode === 'anfrageFreigeben').map((x) => x.argumente));
  pruefe(fr.length === 1 && fr[0][0] === 'u-anfrage' && fr[0][1] === 'p03', profil + ': Freigabe mit Zuordnung zum Kadereintrag', JSON.stringify(fr));
  await page.click('[data-mf-mitglied]'); await page.waitForTimeout(400);
  const rl = await page.evaluate(() => [...document.querySelectorAll('#rolleBlatt [data-rl]')].map((e) => e.dataset.rl));
  pruefe(JSON.stringify(rl) === JSON.stringify(profil === 'admin' ? ['coach', 'treasurer', 'admin'] : ['coach', 'treasurer']), profil + ': Rollen-Schalter' + (profil === 'admin' ? ' mit Admin' : ' ohne Admin'), JSON.stringify(rl));
  await ctx.close();
}
// 4) Spieler: kein Zugang zu Rollen verwalten
{
  const { ctx, page } = await seite('spieler');
  await page.evaluate(() => { location.hash = '#ansicht=admin'; }); await page.waitForTimeout(800);
  pruefe(await h1(page) !== 'Rollen verwalten', 'Spieler kommt nicht auf Rollen verwalten');
  await ctx.close();
}
// 5) Profil: Position statt Rueckennummer, Datenschutz, Konto loeschen
{
  const { ctx, page } = await seite('spieler', null, '#ein=profil');
  const pr = await page.evaluate(() => [...document.querySelectorAll('.pr-zeile .pr-l')].map((e) => e.textContent));
  pruefe(pr.indexOf('Position') >= 0 && pr.indexOf('Rückennummer') < 0, 'Profil: Position statt Rückennummer', JSON.stringify(pr));
  pruefe(['Datenschutz', 'Impressum', 'Konto'].every((x) => pr.indexOf(x) >= 0), 'Profil: Datenschutz, Impressum, Konto löschen', JSON.stringify(pr));
  pruefe(await page.evaluate(() => !!document.querySelector('[data-pr-gesundheit]')), 'Profil: Schalter Gesundheitsstatus');
  await page.click('[data-pr-position]'); await page.waitForTimeout(300);
  pruefe(await page.evaluate(() => document.querySelectorAll('#positionBlatt [data-po]').length === 4), 'Position im Profil änderbar');
  await page.click('#positionBlatt [data-nsb-zu].nsb-sek'); await page.waitForTimeout(200);
  await page.click('[data-pr-konto-weg]'); await page.waitForTimeout(300);
  pruefe(await page.evaluate(() => !!document.querySelector('#kontoWegBlatt [data-kl]')), 'Konto löschen fragt mit Blatt nach');
  await ctx.close();
}
// 6) Zahlknopf ohne PayPal-Link (E8)
{
  const d = daten(); d.paypalName = null;
  const { ctx, page } = await seite('spieler', { daten: d }, '#ansicht=strafen');
  await page.waitForTimeout(500);
  const z = await page.evaluate(() => ({ knopf: !!document.querySelector('.mb-pay'), hinweis: [...document.querySelectorAll('.mb-pp')].map((e) => e.textContent).join('|') }));
  pruefe(!z.knopf && /neuen PayPal-Link/.test(z.hinweis), 'ohne Link: kein Zahlknopf, Hinweis', JSON.stringify(z));
  await ctx.close();
}
await browser.close(); server.close();
console.log(fehler.length ? '--- NICHT bestanden: ' + fehler.length + ' ---' : '--- bestanden ---');
process.exit(fehler.length ? 1 : 0);
