import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chrome' });
const ctx = await b.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
});
const p = await ctx.newPage();
await p.setContent('<h1 style="font:800 22px Inter,sans-serif">Test</h1>');
console.log('Chrome läuft:', await p.evaluate(() => navigator.userAgent.slice(0,40)));
console.log('DPR:', await p.evaluate(() => window.devicePixelRatio));
await b.close();
