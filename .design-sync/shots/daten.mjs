import { chromium } from 'playwright';
import { starte } from './server.mjs';
const { server, basis } = await starte(process.cwd());
const b = await chromium.launch({ channel: 'chrome' });
const ctx = await b.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:3, isMobile:true, hasTouch:true,
  userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' });
const p = await ctx.newPage();
await p.goto(basis, { waitUntil:'networkidle' }); await p.waitForTimeout(1200);
await p.fill('input[type="email"]', process.env.APP_USER);
await p.fill('input[type="password"]', process.env.APP_PASS);
await p.click('.auth-submit');
await p.waitForSelector('.app-nav', { timeout:25000 }); await p.waitForTimeout(2500);

const geh = async (id) => { await p.evaluate(() => document.querySelector('.nav-btn[data-view="dashboard"]').click()); await p.waitForTimeout(400);
  await p.evaluate(() => document.getElementById('navMore').click()); await p.waitForTimeout(400);
  await p.evaluate((i) => document.getElementById(i).click(), id); await p.waitForTimeout(1400); };
await geh('moreProfil');
console.log('PROFIL   : ' + await p.evaluate(() => {
  const t = document.querySelector('.pr-name'), st = document.querySelector('.status-choose'), rl = document.querySelector('.pr-list');
  const leer = document.querySelector('.empty');
  return (t ? 'Name="' + t.textContent.trim() + '"' : 'keine Kopfkarte')
    + ' Fitness=' + (st ? 'da' : 'fehlt') + ' Rueckmeldungen=' + (rl ? rl.children.length + ' Zeilen' : 'fehlt')
    + (leer ? ' | Hinweis: ' + leer.textContent.trim().slice(0,60) : '');
}));
await p.evaluate(() => document.querySelector('.nav-btn[data-view="strafen"]').click()); await p.waitForTimeout(1400);
console.log('KONTO    : ' + await p.evaluate(() => {
  const v = document.querySelector('.mb-value'), l = document.querySelector('.mb-label');
  return (v ? 'Betrag="' + v.textContent.trim() + '"' : 'kein Betrag')
    + ' Marke="' + (l ? l.textContent.trim() : '-') + '" Zeilen=' + document.querySelectorAll('.fine-row').length;
}));
await geh('moreKasse');
console.log('KASSE    : ' + await p.evaluate(() => {
  const d = document.querySelector('.ks-deck'), c = document.querySelector('.ks-card .lbl');
  return (d ? 'Stapel da, ' + (c ? c.textContent.trim() : '?') : 'kein Stapel')
    + ' | Chips: ' + [...document.querySelectorAll('.ks-tabs .chip')].map(x=>x.textContent.trim()).join(' / ');
}));
await geh('moreLineup');
console.log('TRAINER  : ' + await p.evaluate(() => {
  const t = document.querySelector('.tv-tpls');
  return t ? t.querySelectorAll('.tv-tpl').length + ' Vorlagen' : 'keine Vorlagenliste';
}));
await b.close(); server.close();
