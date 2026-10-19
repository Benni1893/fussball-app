/* Fluessigkeit auf Android, Messung (19.10.2026). Nicht auf der Pflichtliste.
   Stand-in (Admin), 412 x 915, Android-UA, Touch, CPU 4-fach gedrosselt.
   Ablaeufe: Uebersicht scrollen (Touch-Geste), Rueckmeldungen-Blatt oeffnen
   und nach unten wischen, Einfuehrung wischen. Gemessen: Bildabstaende per
   requestAnimationFrame (Mittel, p95, Anteil > 50 ms), lange Tasks, Zeit fuer
   Stil, Layout und Skript (Performance.getMetrics). Je Effekt ein Lauf, in dem
   nur dieser Effekt per CSS abgeschaltet ist; die Differenz zur Basis ist sein
   Anteil. Headless rendert ohne echte GPU: absolute Werte sind schlechter als
   auf dem Handy, verglichen werden nur Laeufe untereinander.
   Aufruf: node .design-sync/shots/perfmess.mjs [wiederholungen=3]            */
import { chromium } from 'playwright';
import fs from 'node:fs';
import { starte } from './server.mjs';
import { installiere, daten } from './landkartenmodul.mjs';

const N = +(process.argv[2] || 3);
const ANDROID = 'Mozilla/5.0 (Linux; Android 11; ONEPLUS A5000) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
const VARIANTEN = {
  basis: '',
  'ohne backdrop-filter (Navigation)': '.app-nav{-webkit-backdrop-filter:none!important;backdrop-filter:none!important}',
  'ohne filter: drop-shadow (Logo, Wappen)': '.crest-logo,.crest{filter:none!important}',
  'ohne box-shadow (alle)': '*,*::before,*::after{box-shadow:none!important}',
  'ohne Verlaeufe (alle)': '*,*::before,*::after{background-image:none!important}',
  'ohne Animationen/Uebergaenge': '*,*::before,*::after{animation:none!important;transition:none!important}',
};
const { server, basis } = await starte(process.cwd());
const browser = await chromium.launch({ channel: 'chrome' });

const MESS = `window.__mess = { start() { this.t = []; this.lang = 0; this.an = true; const self = this; let last = performance.now();
  const f = (now) => { if (!self.an) return; self.t.push(now - last); last = now; requestAnimationFrame(f); }; requestAnimationFrame(f);
  try { this.po = new PerformanceObserver((l) => { for (const e of l.getEntries()) self.lang += e.duration; }); this.po.observe({ type: 'longtask' }); } catch (e) {} },
  stop() { this.an = false; try { this.po.disconnect(); } catch (e) {} const t = this.t.slice(1).sort((a, b) => a - b);
    const sum = t.reduce((a, b) => a + b, 0); return { bilder: t.length, mittel: sum / t.length, p95: t[Math.floor(t.length * .95)] || 0, ueber50: t.filter((x) => x > 50).length / t.length, lang: this.lang }; } };`;

async function seite(css) {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.6, isMobile: true, hasTouch: true, userAgent: ANDROID, locale: 'de-DE', timezoneId: 'Europe/Berlin', serviceWorkers: 'block' });
  const page = await ctx.newPage();
  await installiere(page, 'admin', { daten: daten() });
  await page.addInitScript(MESS);
  await page.goto(basis, { waitUntil: 'load' });
  await page.waitForFunction(() => !document.getElementById('splash') && !document.getElementById('__skeleton') && !!document.querySelector('.app-nav'), null, { timeout: 20000 });
  if (css) await page.addStyleTag({ content: css });
  await page.waitForTimeout(400);
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Performance.enable');
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  return { ctx, page, cdp };
}
const metrik = async (cdp) => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
async function miss(page, cdp, tat) {
  const a = await metrik(cdp);
  await page.evaluate(() => window.__mess.start());
  await tat();
  await page.waitForTimeout(300);
  const r = await page.evaluate(() => window.__mess.stop());
  const b = await metrik(cdp);
  r.stil = (b.RecalcStyleDuration - a.RecalcStyleDuration) * 1000; r.layout = (b.LayoutDuration - a.LayoutDuration) * 1000; r.skript = (b.ScriptDuration - a.ScriptDuration) * 1000;
  return r;
}
const ABLAEUFE = {
  'Übersicht scrollen': async (page, cdp) => miss(page, cdp, async () => {
    await cdp.send('Input.synthesizeScrollGesture', { x: 206, y: 700, yDistance: -1400, speed: 1600, gestureSourceType: 'touch', repeatCount: 2, repeatDelayMs: 100, yOverscroll: 0 });
    await cdp.send('Input.synthesizeScrollGesture', { x: 206, y: 300, yDistance: 1400, speed: 1600, gestureSourceType: 'touch' });
  }),
  'Blatt öffnen und wischen': async (page, cdp) => miss(page, cdp, async () => {
    const z = page.locator('[data-rsvp-sheet]').first();
    if (!(await z.count())) return;
    await z.scrollIntoViewIfNeeded(); await z.click();
    await page.waitForTimeout(600);
    const r = await page.evaluate(() => { const p = document.querySelector('#rsvpSheet .rs2-panel, #rsvpSheet [class*="panel"]'); const b = p && p.getBoundingClientRect(); return b ? { x: b.x + b.width / 2, y: b.y + 30 } : null; });
    if (r) await cdp.send('Input.synthesizeScrollGesture', { x: r.x, y: r.y, yDistance: 500, speed: 1200, gestureSourceType: 'touch' });
    await page.waitForTimeout(600);
  }),
  'Einführung wischen': async (page, cdp) => {
    await page.evaluate(() => { location.hash = '#ein=sogehts'; });
    await page.waitForSelector('[data-sg-ef="eigen"]', { timeout: 10000 });
    await page.click('[data-sg-ef="eigen"]'); await page.waitForTimeout(400);
    return miss(page, cdp, async () => {
      for (let i = 0; i < 4; i++) { await cdp.send('Input.synthesizeScrollGesture', { x: 330, y: 500, xDistance: -260, yDistance: 0, speed: 1400, gestureSourceType: 'touch' }); await page.waitForTimeout(250); }
      for (let i = 0; i < 2; i++) { await cdp.send('Input.synthesizeScrollGesture', { x: 80, y: 500, xDistance: 260, yDistance: 0, speed: 1400, gestureSourceType: 'touch' }); await page.waitForTimeout(250); }
    });
  },
};

const median = (xs) => { const s = xs.slice().sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const erg = {};
for (const [v, css] of Object.entries(VARIANTEN)) {
  erg[v] = {};
  for (const [name, tat] of Object.entries(ABLAEUFE)) {
    const runs = [];
    for (let i = 0; i < N; i++) { const { ctx, page, cdp } = await seite(css); try { runs.push(await tat(page, cdp)); } catch (e) { console.log('  Fehler', v, name, e.message.split('\n')[0]); } await ctx.close(); }
    const k = (f) => +median(runs.map((r) => r[f])).toFixed(1);
    erg[v][name] = { mittel: k('mittel'), p95: k('p95'), ueber50: Math.round(median(runs.map((r) => r.ueber50)) * 100), lang: Math.round(median(runs.map((r) => r.lang))), stil: Math.round(median(runs.map((r) => r.stil))), layout: Math.round(median(runs.map((r) => r.layout))), skript: Math.round(median(runs.map((r) => r.skript))) };
    console.log(v.padEnd(42), name.padEnd(26), JSON.stringify(erg[v][name]));
  }
}
fs.writeFileSync('.design-sync/reference/compare/perfmess.json', JSON.stringify(erg, null, 2));
await browser.close(); server.close();
