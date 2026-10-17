// Kassenbanner: beide Stellen, drei Zustaende, Spieler und Kassenwart, 390 px.
// Aufruf aus dem Repo: node <pfad>/kbpruef.mjs <bilderordner>
import { chromium } from 'playwright';



import { starte } from './server.mjs';
import { installiere, daten } from './landkartenmodul.mjs';
const OUT = process.argv[2];

const fehler = [];
const pruefe = (ok, t, d) => { console.log((ok ? '  ok   ' : '  FEHL ') + t + (!ok && d !== undefined ? '   ' + d : '')); if (!ok) fehler.push(t); };
const { server, basis } = await starte(process.cwd());
const browser = await chromium.launch({ channel: 'chrome' });

const ZUSTAND = {
  normal: (d) => d,
  klar: (d) => { d.strafen = d.strafen.map((s) => s.status === 'storniert' ? s : { ...s, status: 'bestätigt', bezahlt: true }); return d; },
  leer: (d) => { d.strafen = []; return d; },
  // lange Betraege: 12.345,00 EUR in der Kasse, 9.876,50 EUR offen
  gross: (d) => { d.strafen = d.strafen.map((s, i) => i === 0 ? { ...s, status: 'offen', bezahlt: false, grundbetrag: 9876.5 } : i === 1 ? { ...s, status: 'bestätigt', bezahlt: true, grundbetrag: 12345 } : { ...s, status: 'storniert' }); return d; },
  // wie normal, aber ohne gemeldete Strafen (gemeldet -> offen): Banner 282 px, 4 Eintraege sichtbar
  ohnegemeldet: (d) => { d.strafen = d.strafen.map((s) => s.status === 'gemeldet' ? { ...s, status: 'offen', selfReported: false } : s); return d; },
  // (a) nur gemeldet, nichts offen: 7,50 gemeldet, 20,00 eingegangen
  nurgemeldet: (d) => { d.strafen = d.strafen.map((s, i) => frisch(s, i === 0 ? ['gemeldet', 7.5] : i === 1 ? ['bestätigt', 20] : null)); return d; },
  // (b) gemischt: 10,00 offen, 7,50 gemeldet, 20,00 eingegangen = 37,50 gesamt
  gemischt: (d) => { d.strafen = d.strafen.map((s, i) => frisch(s, i === 0 ? ['offen', 10] : i === 1 ? ['gemeldet', 7.5] : i === 2 ? ['bestätigt', 20] : null)); return d; },
};
// Strafe mit Status und Betrag, Datum kurz vor der festen Uhr (kein Mahnzuschlag); null = storniert.
function frisch(s, w) {
  if (!w) return { ...s, status: 'storniert' };
  const [status, betrag] = w;
  return { ...s, status, grundbetrag: betrag, zuschlag: 0, bezahlt: status === 'bestätigt', selfReported: status === 'gemeldet',
    datum: '2026-10-01', createdAt: '2026-10-01T12:00:00Z' };
}
// "1.234,50 €" -> 1234.5
const zahl = (t) => { const m = String(t).match(/[\d.]+,\d{2}/); return m ? Number(m[0].replace(/\./g, '').replace(',', '.')) : NaN; };
async function seite(profil, zustand) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await installiere(page, profil, { daten: ZUSTAND[zustand](daten()) });
  await page.goto(basis); await page.waitForTimeout(1500);
  await page.addStyleTag({ content: '*{transition:none!important}' });
  return { ctx, page };
}
const lies = (page) => page.evaluate(() => {
  const kb = document.querySelector('.kb'); if (!kb) return null;
  const q = (s) => (kb.querySelector(s) || {}).textContent || '';
  const r = kb.getBoundingClientRect();
  const klein = [...kb.querySelectorAll('*')].filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && parseFloat(getComputedStyle(e).fontSize) < 13);
  const knoepfe = [...kb.querySelectorAll('button')].map((b) => ({ z: b.dataset.kbZiel, h: b.getBoundingClientRect().height, l: b.getAttribute('aria-label') }));
  const wert = kb.querySelector('.kb-value');
  return { klasse: kb.className, wert: q('.kb-value').replace('›', '').trim(), pct: q('.kb-pct'), t: q('.kb-open-t'), sub: q('.kb-open-sub'), amt: q('.kb-open-amt'), gem: q('.kb-open-gem'),
    fill: kb.querySelector('.kb-bar-fill').style.width, fillFarbe: getComputedStyle(kb.querySelector('.kb-bar-fill')).backgroundColor,
    haken: !!kb.querySelector('.kb-check'), pfeile: kb.querySelectorAll('.kb-chev, .kb-open-chev').length, knoepfe,
    cursor: getComputedStyle(kb.querySelector('.kb-open')).cursor, h: Math.round(r.height), w: Math.round(r.width),
    klein: klein.map((e) => e.className + ':' + getComputedStyle(e).fontSize), umbruch: wert.scrollWidth > wert.clientWidth + 1 || wert.getBoundingClientRect().height > 60,
    hscroll: document.documentElement.scrollWidth > 390 };
});

const ERW = {
  normal: { klar: false, pctRe: /^\d{1,2} % der Strafen bezahlt$/, t: 'Noch offen' },
  klar:   { klar: true,  pctRe: /^100 % der Strafen bezahlt$/,    t: 'Alles bezahlt' },
  leer:   { klar: true,  pctRe: /^Noch keine Strafen$/,                t: 'Nichts offen' },
  gross:  { klar: false, pctRe: null, t: 'Noch offen' },   // pctRe wie normal, unten gesetzt
};
ERW.gross.pctRe = ERW.normal.pctRe;
ERW.ohnegemeldet = { ...ERW.normal };
ERW.nurgemeldet ={ klar: false, pctRe: ERW.normal.pctRe, t: 'Nichts offen' };
ERW.gemischt = { klar: false, pctRe: ERW.normal.pctRe, t: 'Noch offen' };
for (const profil of ['spieler', 'kassenwart']) {
  for (const zustand of ['normal', 'ohnegemeldet', 'klar', 'leer', 'gross', 'nurgemeldet', 'gemischt']) {
    for (const ort of ['dashboard', 'team']) {
      const { ctx, page } = await seite(profil, zustand);
      if (ort === 'team') {
        await page.evaluate(() => { location.hash = '#strafen=offen'; }); await page.waitForTimeout(800);
        await page.click('[data-kseg="team"]'); await page.waitForTimeout(500);
      }
      const n = `${profil}/${zustand}/${ort}`;
      const m = await lies(page);
      if (!m) { pruefe(false, n + ': Banner da'); await ctx.close(); continue; }
      const e = ERW[zustand];
      pruefe(m.klasse.includes('is-clear') === e.klar && e.pctRe.test(m.pct) && m.t === e.t, n + ': Zustand ' + m.t + ' / ' + m.pct, JSON.stringify(m));
      pruefe(/^[\d.]+,\d{2} €$/.test(m.wert) && /^[\d.]+,\d{2} €$/.test(m.amt), n + ': Beträge deutsch ' + m.wert + ' / ' + m.amt);
      if (zustand === 'leer') pruefe(m.wert === '0,00 €' && m.fill === '0%' && m.haken, n + ': leer 0,00 €, Balken leer, Haken');
      if (zustand === 'klar') pruefe(m.fill === '100%' && m.haken && m.amt === '0,00 €' && m.sub === 'Kein Spieler hat offene Strafen', n + ': klar 100 %, Haken, 0,00 €', JSON.stringify(m));
      if (zustand === 'gross') pruefe(m.wert === '12.345,00 €' && m.amt === '9.876,50 €' && m.sub === '1 Strafe · 1 Spieler', n + ': lange Beträge, Singular ' + m.wert + ' / ' + m.amt + ' / ' + m.sub);
      if (zustand === 'normal') pruefe(/^\d+ Strafen? · \d+ Spieler$/.test(m.sub) && !m.haken, n + ': Unterzeile ' + m.sub);
      // Stand-in "normal" hat gemeldete Strafen (Zeile da); klar, leer, gross haben keine.
      if (zustand === 'ohnegemeldet') pruefe(m.h === 282 && /^\d+ Strafen? · \d+ Spieler$/.test(m.sub), n + ': ohne Gemeldet-Zeile Höhe ' + m.h);
      if (['klar', 'leer', 'gross', 'ohnegemeldet'].includes(zustand)) pruefe(m.gem === '', n + ': keine Gemeldet-Zeile ohne gemeldete Strafen', m.gem);
      if (zustand === 'normal') pruefe(/^davon [\d.]+,\d{2} € gemeldet, wartet auf Bestätigung$/.test(m.gem), n + ': Gemeldet-Zeile ' + m.gem);
      const ns = (t) => String(t).replace(/ /g, ' ');
      if (zustand === 'nurgemeldet') {
        pruefe(ns(m.amt) === '0,00 €' && m.sub === 'Kein Spieler hat offene Strafen' && !m.haken && ns(m.pct) === '73 % der Strafen bezahlt',
          n + ': nur gemeldet, Offen 0,00 €, 73 %', JSON.stringify(m));
        pruefe(ns(m.gem) === 'davon 7,50 € gemeldet, wartet auf Bestätigung', n + ': Gemeldet-Zeile sichtbar: ' + m.gem);
      }
      if (zustand === 'gemischt') {
        const summe = zahl(m.wert) + zahl(m.amt) + zahl(m.gem);
        pruefe(ns(m.wert) === '20,00 €' && ns(m.amt) === '10,00 €' && ns(m.gem) === 'davon 7,50 € gemeldet, wartet auf Bestätigung' && Math.abs(summe - 37.5) < 0.001 && m.sub === '1 Strafe · 1 Spieler' && ns(m.pct) === '53 % der Strafen bezahlt',
          n + ': Eingegangen + Offen + Gemeldet = Summe 37,50 € (' + summe + ')', JSON.stringify(m));
      }
      pruefe(m.klein.length === 0 && !m.umbruch && !m.hscroll && m.h >= 282, n + ': ≥13px, kein Umbruch, kein H-Scroll, Höhe ' + m.h, JSON.stringify(m));
      if (profil === 'spieler') pruefe(m.knoepfe.length === 0 && m.pfeile === 0 && m.cursor !== 'pointer', n + ': Spieler nur lesend');
      else pruefe(m.knoepfe.length === 2 && m.pfeile === 2 && m.knoepfe.every((k) => k.h >= 44 && k.l), n + ': Kassenwart 2 Knöpfe ≥44 mit Label, 2 Pfeile', JSON.stringify(m.knoepfe));
      if (ort === 'team') {
        const sicht = await page.evaluate(() => {
          const nav = document.querySelector('.app-nav'); const unten = nav ? nav.getBoundingClientRect().top : innerHeight;
          return { rows: [...document.querySelectorAll('.kt-liste .row')].filter((r) => r.getBoundingClientRect().top < unten - 20).length,
                   leer: (document.querySelector('.empty') || {}).textContent || '' };
        });
        // 390 x 844: ohne Gemeldet-Zeile 4 Eintraege, mit ihr (Banner +22 px) 3
        if (['normal', 'ohnegemeldet', 'gross', 'gemischt'].includes(zustand)) pruefe(sicht.rows >= (zustand === 'ohnegemeldet' ? 4 : zustand === 'normal' ? 3 : 1), n + ': Listeneinträge unter dem Banner sichtbar: ' + sicht.rows, JSON.stringify(sicht));
        else pruefe(sicht.leer === 'Keine offenen Strafen', n + ': Leerzustand ' + sicht.leer);
      }
      if (OUT && (ort === 'team' || zustand !== 'leer')) {
        const kb = await page.$('.kb'); await kb.scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${OUT}/kb-${profil}-${zustand}-${ort}.png`, fullPage: ort === 'team' ? false : false });
      }
      if (profil === 'kassenwart' && zustand === 'normal') {
        for (const [ziel, reiter] of [['offen', 'offen'], ['bezahlt', 'bezahlt']]) {
          await page.click(`.kb [data-kb-ziel="${ziel}"]`); await page.waitForTimeout(600);
          const r = await page.evaluate(() => ({ h: (document.querySelector('#view h1') || {}).textContent, on: (document.querySelector('.ks-seg-b.is-on') || {}).dataset?.kstab }));
          pruefe(r.on === reiter, n + ': Tipp ' + ziel + ' → Kasse Reiter ' + reiter, JSON.stringify(r));
          if (ort === 'team') { await page.evaluate(() => { location.hash = '#strafen=offen'; }); await page.waitForTimeout(700); await page.click('[data-kseg="team"]'); await page.waitForTimeout(400); }
          else { await page.evaluate(() => { location.hash = '#ansicht=dashboard'; }); await page.waitForTimeout(700); }
        }
      }
      await ctx.close();
    }
  }
}
await browser.close(); server.close();
console.log(fehler.length ? `--- ${fehler.length} Beanstandung(en) ---` : '--- bestanden ---');
process.exit(fehler.length ? 1 : 0);
