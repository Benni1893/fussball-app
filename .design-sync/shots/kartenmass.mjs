/* Misst Bausteine in einer Vorschaukarte - kein Zugriff auf die laufende App. */
import { chromium } from 'playwright';
import { starte } from './server.mjs';
const [karte, ...sel] = process.argv.slice(2);
const { server, basis } = await starte(process.cwd());
const b = await chromium.launch({ channel: 'chrome' });
const p = await (await b.newContext({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })).newPage();
await p.goto(basis + '/ds-bundle/components/' + karte, { waitUntil: 'networkidle' });
await p.waitForTimeout(400);
console.log(await p.evaluate((s) => s.map((x) => {
  const el = [...document.querySelectorAll(x)];
  if (!el.length) return x.padEnd(22) + 'FEHLT';
  return x.padEnd(22) + el.map((e) => { const r = e.getBoundingClientRect();
    return r.height.toFixed(1) + '×' + r.width.toFixed(0); }).join('  ');
}).join('\n'), sel));
await b.close(); server.close();
