/* Nacharbeit Nachschliff Punkt 2: Popover (Termin-Menü hinter ⋯) schließt
   beim Scrollen (Wischen, Mausrad), bei Tipp daneben, beim Ansichtswechsel,
   beim Drehen und bei geänderter Fenstergröße. Es bleibt offen, solange
   nichts davon passiert, auch direkt nach dem Öffnen (das Sperren des
   Hintergrunds löst selbst scroll/resize aus) und bei leichtem Zittern
   (unter 8 px) beim Tippen. Gemeinsamer Weg: popoverBinden/popoverLoesen.
   Aufruf: node .design-sync/shots/popoverpruef.mjs                       */
import { chromium } from 'playwright';
import fs from 'node:fs';
import { starte } from './server.mjs';
import { installiere, warteAufApp } from './landkartenmodul.mjs';

const fehler = [];
const pruefe = (ok, text, detail) => { console.log((ok ? '  ok   ' : '  FEHL ') + text + (detail !== undefined && !ok ? '   ' + detail : '')); if (!ok) fehler.push(text); };
const app = fs.readFileSync('app.js', 'utf8');
pruefe(/popoverBinden\(closeTkMenu\)/.test(app), 'Termin-Menü nutzt den gemeinsamen Popover-Weg');
pruefe(/function switchView\(view\) \{\s*popoverZu\(\);/.test(app), 'Ansichtswechsel schließt offene Popover');

const { server, basis } = await starte(process.cwd());
const browser = await chromium.launch({ channel: 'chrome' });
const offen = (page) => page.evaluate(() => !!document.getElementById('tkMenu'));
async function mitMenue(profil, fall, tat) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage(); await installiere(page, profil);
  await page.goto(basis); await warteAufApp(page);
  await page.click('[data-tkmenu]'); await page.waitForTimeout(500);
  const vorher = await offen(page);
  await tat(page);
  await page.waitForTimeout(300);
  const nachher = await offen(page);
  await ctx.close();
  return { vorher, nachher };
}
const touch = (page, schritte) => page.evaluate((s) => {
  const ziel = document.querySelector('.tkp-fang');
  const mk = (x, y) => new Touch({ identifier: 1, target: ziel, clientX: x, clientY: y });
  ziel.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [mk(s[0][0], s[0][1])], changedTouches: [mk(s[0][0], s[0][1])] }));
  for (const [x, y] of s.slice(1)) ziel.dispatchEvent(new TouchEvent('touchmove', { bubbles: true, touches: [mk(x, y)], changedTouches: [mk(x, y)] }));
  ziel.dispatchEvent(new TouchEvent('touchend', { bubbles: true, touches: [], changedTouches: [mk(s[s.length - 1][0], s[s.length - 1][1])] }));
}, schritte);

const FAELLE = [
  ['bleibt offen ohne Eingriff (auch nach dem Sperren des Hintergrunds)', true, async () => {}],
  ['bleibt offen bei Zittern unter 8 px', true, (p) => touch(p, [[100, 700], [103, 704]])],
  ['schließt beim Wischen (Scrollversuch)', false, (p) => touch(p, [[100, 700], [100, 680], [100, 640]])],
  ['schließt beim Mausrad', false, (p) => p.mouse.move(60, 750).then(() => p.mouse.wheel(0, 200))],
  ['schließt bei Tipp daneben', false, (p) => p.click('.tkp-fang', { position: { x: 30, y: 760 } })],
  ['schließt beim Ansichtswechsel (Hash)', false, (p) => p.evaluate(() => { location.hash = '#ansicht=kalender'; })],
  ['schließt beim Drehen', false, (p) => p.evaluate(() => window.dispatchEvent(new Event('orientationchange')))],
  ['schließt bei geänderter Fenstergröße', false, (p) => p.setViewportSize({ width: 844, height: 390 })],
];
for (const profil of ['trainer', 'spieler']) {
  for (const [fall, bleibt, tat] of FAELLE) {
    const r = await mitMenue(profil, fall, tat);
    pruefe(r.vorher && r.nachher === bleibt, profil + ': ' + fall, JSON.stringify(r));
  }
}
// Ein Eintrag lässt sich weiter antippen (das Menü schließt und löst aus).
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage(); await installiere(page, 'trainer');
  await page.goto(basis); await warteAufApp(page);
  await page.click('[data-tkmenu]'); await page.waitForTimeout(400);
  await page.click('#tkMenu [data-termin-edit]'); await page.waitForTimeout(500);
  const z = await page.evaluate(() => ({ menue: !!document.getElementById('tkMenu'), formular: !!document.getElementById('terminModal') }));
  pruefe(!z.menue && z.formular, 'Eintrag „Termin bearbeiten“ wirkt weiter', JSON.stringify(z));
  await ctx.close();
}
await browser.close(); server.close();
console.log(fehler.length ? '--- NICHT bestanden: ' + fehler.length + ' ---' : '--- bestanden ---');
process.exit(fehler.length ? 1 : 0);
