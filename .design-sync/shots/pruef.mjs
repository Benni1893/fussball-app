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
await p.waitForSelector('.app-nav', { timeout:25000 }); await p.waitForTimeout(2000);
const zeig = async (was) => console.log(was.padEnd(22) + await p.evaluate(() => {
  const h = document.querySelector('.page-head h1, .tv-game');
  const n = document.querySelector('.nav-btn.is-active .nav-label');
  return (h ? '"'+h.textContent.trim()+'"' : '(kein Titel)') + '  Tab=' + (n?n.textContent:'-')
       + '  Hoehe=' + document.documentElement.scrollHeight;
}));
for (const [id, name] of [['moreAdmin','rollen'],['moreProfil','profil'],['moreKader','kader'],['moreKasse','kasse']]) {
  await p.evaluate(() => document.querySelector('.nav-btn[data-view="dashboard"]').click()); await p.waitForTimeout(500);
  await p.evaluate(() => document.getElementById('navMore').click()); await p.waitForTimeout(400);
  await p.evaluate((i) => document.getElementById(i).click(), id); await p.waitForTimeout(1200);
  await zeig(name);
}
// Rollenvorschau -> Spieler
await p.evaluate(() => document.querySelector('.nav-btn[data-view="dashboard"]').click()); await p.waitForTimeout(400);
await p.evaluate(() => document.getElementById('navMore').click()); await p.waitForTimeout(400);
await p.evaluate(() => document.getElementById('moreAdmin').click()); await p.waitForTimeout(1200);
const hat = await p.evaluate(() => !!document.querySelector('[data-sim="player"]'));
console.log('Rollenvorschau-Schalter vorhanden: ' + hat);
if (hat) { await p.evaluate(() => document.querySelector('[data-sim="player"]').click()); await p.waitForTimeout(1600);
  await p.evaluate(() => document.querySelector('.nav-btn[data-view="dashboard"]').click()); await p.waitForTimeout(900);
  await zeig('uebersicht-spieler');
  console.log('  Tabs: ' + await p.evaluate(() => [...document.querySelectorAll('.nav-btn')].filter(b=>b.offsetParent!==null).map(b=>b.textContent.trim()).join(' | ')));
}
await b.close(); server.close();
