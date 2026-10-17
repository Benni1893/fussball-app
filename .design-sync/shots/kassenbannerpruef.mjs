// Kassenbanner: beide Stellen (Übersicht, Konto › Mannschaft), alle Zustände,
// Spieler und Kassenwart, 390 px, Stand-in ohne Datenbank.
// Aufruf aus dem Repo: node .design-sync/shots/kassenbannerpruef.mjs [bilderordner]
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
  // lange Betraege: 12.345,00 in der Kasse, 9.876,50 offen, 12.345,00 gemeldet
  gross: (d) => { d.strafen = d.strafen.map((s, i) => frisch(s, i === 0 ? ['offen', 9876.5] : i === 1 ? ['bestätigt', 12345] : i === 2 ? ['gemeldet', 12345] : null)); return d; },
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
const ns = (t) => String(t).replace(/ /g, ' ');
// "1.234,50 €" -> 1234.5 (erster Betrag im Text)
const zahl = (t) => { const m = String(t).match(/[\d.]+,\d{2}/); return m ? Number(m[0].replace(/\./g, '').replace(',', '.')) : NaN; };
const BETRAG = /^[\d.]+,\d{2} €$/;

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
  kb.scrollIntoView({ block: 'center' });
  const q = (s) => (kb.querySelector(s) || {}).textContent || '';
  const r = kb.getBoundingClientRect();
  const klein = [...kb.querySelectorAll('*')].filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && parseFloat(getComputedStyle(e).fontSize) < 13);
  // Trefferflaeche je Ziel: senkrecht durch die Mitte abtasten (beim Offen-Ziel ueber dem Betrag).
  const treffer = (el) => {
    const bez = el.dataset.kbZiel === 'offen' ? kb.querySelector('.kb-offen-amt') : el;
    const rr = bez.getBoundingClientRect(), x = rr.left + rr.width / 2;
    let n = 0; for (let y = Math.floor(r.top); y < r.bottom; y++) { const t = document.elementFromPoint(x, y); if (t && t.closest('[data-kb-ziel]') === el) n++; }
    return n;
  };
  const knoepfe = [...kb.querySelectorAll('[data-kb-ziel]')].map((b) => ({ z: b.dataset.kbZiel, tag: b.tagName, h: treffer(b), l: b.getAttribute('aria-label') }));
  const verschachtelt = !!kb.querySelector('button button, button [data-kb-ziel]');
  const wert = kb.querySelector('.kb-value');
  // Gemeldet-Zeile: einzeilig, nicht abgeschnitten, kein Ueberlappen mit dem Betrag
  const g = kb.querySelector('.kb-offen-gem'); let gem = null;
  if (g) {
    const gr = g.getBoundingClientRect(), lh = parseFloat(getComputedStyle(g).lineHeight) || 17, amt = kb.querySelector('.kb-offen-amt').getBoundingClientRect();
    gem = { text: g.textContent.replace('›', '').trim(), h: Math.round(gr.height), lh, einzeilig: gr.height < lh * 1.5,
            // nur dort, wo gekuerzt werden kann (Spieler: overflow hidden + Ellipse); beim Knopf ragt das ::after bewusst hinaus
            abgeschnitten: getComputedStyle(g).overflow !== 'visible' && g.scrollWidth > g.clientWidth + 1,
            ueberlappt: gr.right > amt.left + 0.5, pfeil: !!g.querySelector('.kb-gem-chev'), farbe: getComputedStyle(g).color,
            grund: getComputedStyle(kb.querySelector('.kb-offen')).backgroundImage + ' ' + getComputedStyle(kb.querySelector('.kb-offen')).backgroundColor };
  }
  return { klasse: kb.className, wert: q('.kb-value').replace('›', '').trim(), pct: q('.kb-pct'), t: q('.kb-offen-t'), sub: q('.kb-offen-sub'), amt: q('.kb-offen-amt'), gem,
    fill: kb.querySelector('.kb-bar-fill').style.width,
    haken: !!kb.querySelector('.kb-check'), pfeile: kb.querySelectorAll('.kb-chev, .kb-offen-chev').length, knoepfe, verschachtelt,
    cursor: getComputedStyle(kb.querySelector('.kb-offen')).cursor, h: Math.round(r.height),
    klein: klein.map((e) => e.className + ':' + getComputedStyle(e).fontSize), umbruch: wert.scrollWidth > wert.clientWidth + 1 || wert.getBoundingClientRect().height > 60,
    hscroll: document.documentElement.scrollWidth > 390 };
});
// WCAG-Kontrast: Schriftfarbe gegen jede Farbe im Hintergrund (Verlaufsstopps), der schlechteste Wert zaehlt.
function kontrast(farbe, grund) {
  const rgb = (s) => s.match(/rgba?\(([^)]+)\)/g).map((x) => x.match(/[\d.]+/g).slice(0, 4).map(Number));
  const L = ([r, g, b]) => { const c = [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const f = rgb(farbe)[0];
  const stopps = rgb(grund).filter((c) => c.length < 4 || c[3] > 0);
  return Math.min(...stopps.map((c) => { const a = L(f), b = L(c); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); }));
}

const PCT = /^\d{1,2} % der Strafen bezahlt$/;
const ERW = {
  normal:       { klar: false, pct: PCT, t: 'Noch offen', gem: true },
  ohnegemeldet: { klar: false, pct: PCT, t: 'Noch offen', gem: false },
  klar:         { klar: true,  pct: /^100 % der Strafen bezahlt$/, t: 'Alles bezahlt', gem: false },
  leer:         { klar: true,  pct: /^Noch keine Strafen$/, t: 'Nichts offen', gem: false },
  gross:        { klar: false, pct: PCT, t: 'Noch offen', gem: true },
  nurgemeldet:  { klar: false, pct: PCT, t: 'Nichts offen', gem: true },
  gemischt:     { klar: false, pct: PCT, t: 'Noch offen', gem: true },
};
let kontrastGemessen = null;
for (const profil of ['spieler', 'kassenwart']) {
  const kw = profil === 'kassenwart';
  // Erwarteter Text der Gemeldet-Zeile je Rolle
  const gemText = (betrag) => kw ? betrag + ' zu prüfen' : 'davon ' + betrag + ' gemeldet';
  for (const zustand of Object.keys(ZUSTAND)) {
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
      pruefe(m.klasse.includes('is-clear') === e.klar && e.pct.test(m.pct) && m.t === e.t, n + ': Zustand ' + m.t + ' / ' + ns(m.pct), JSON.stringify(m));
      pruefe(BETRAG.test(m.wert) && BETRAG.test(m.amt), n + ': Beträge deutsch ' + ns(m.wert) + ' / ' + ns(m.amt));
      if (zustand === 'leer') pruefe(ns(m.wert) === '0,00 €' && m.fill === '0%' && m.haken, n + ': leer 0,00 €, Balken leer, Haken');
      if (zustand === 'klar') pruefe(m.fill === '100%' && m.haken && ns(m.amt) === '0,00 €' && m.sub === 'Kein Spieler hat offene Strafen', n + ': klar 100 %, Haken, 0,00 €', JSON.stringify(m));
      if (zustand === 'gross') pruefe(ns(m.wert) === '12.345,00 €' && ns(m.amt) === '9.876,50 €' && m.sub === '1 Strafe · 1 Spieler' && m.gem && ns(m.gem.text) === gemText('12.345,00 €'),
        n + ': lange Beträge, Singular ' + ns(m.wert) + ' / ' + ns(m.amt) + ' / ' + (m.gem && ns(m.gem.text)), JSON.stringify(m.gem));
      if (zustand === 'normal' || zustand === 'ohnegemeldet') pruefe(/^\d+ Strafen? · \d+ Spieler$/.test(m.sub) && !m.haken, n + ': Unterzeile ' + m.sub);
      if (zustand === 'ohnegemeldet') pruefe(m.h === 282, n + ': ohne Gemeldet-Zeile Höhe ' + m.h);
      // Gemeldet-Zeile: da genau dann, wenn es gemeldete Strafen gibt; einzeilig, nicht abgeschnitten
      pruefe(!!m.gem === e.gem, n + ': Gemeldet-Zeile ' + (e.gem ? 'da' : 'fehlt'), JSON.stringify(m.gem));
      if (m.gem) {
        pruefe(m.gem.einzeilig && !m.gem.abgeschnitten && !m.gem.ueberlappt, n + ': Gemeldet-Zeile einzeilig (' + m.gem.h + ' px) ' + ns(m.gem.text), JSON.stringify(m.gem));
        pruefe(m.gem.pfeil === kw && new RegExp('^' + (kw ? '' : 'davon ') + '[\\d.]+,\\d{2} € ' + (kw ? 'zu prüfen' : 'gemeldet') + '$').test(m.gem.text),
          n + ': Wortlaut je Rolle ' + ns(m.gem.text), JSON.stringify(m.gem));
        const k = kontrast(m.gem.farbe, m.gem.grund);
        if (kontrastGemessen === null || k < kontrastGemessen) kontrastGemessen = k;
      }
      if (zustand === 'nurgemeldet') pruefe(ns(m.amt) === '0,00 €' && m.sub === 'Kein Spieler hat offene Strafen' && !m.haken && ns(m.pct) === '73 % der Strafen bezahlt' && ns(m.gem.text) === gemText('7,50 €'),
        n + ': nur gemeldet, Offen 0,00 €, 73 %', JSON.stringify(m));
      if (zustand === 'gemischt') {
        const summe = zahl(m.wert) + zahl(m.amt) + zahl(m.gem.text);
        pruefe(ns(m.wert) === '20,00 €' && ns(m.amt) === '10,00 €' && ns(m.gem.text) === gemText('7,50 €') && Math.abs(summe - 37.5) < 0.001 && m.sub === '1 Strafe · 1 Spieler' && ns(m.pct) === '53 % der Strafen bezahlt',
          n + ': Eingegangen + Offen + Gemeldet = Summe 37,50 € (' + summe + ')', JSON.stringify(m));
      }
      pruefe(m.klein.length === 0 && !m.umbruch && !m.hscroll && m.h >= 282, n + ': ≥13px, kein Umbruch, kein H-Scroll, Höhe ' + m.h, JSON.stringify(m));
      pruefe(!m.verschachtelt, n + ': kein Knopf im Knopf');
      if (!kw) pruefe(m.knoepfe.length === 0 && m.pfeile === 0 && m.cursor !== 'pointer', n + ': Spieler nur lesend');
      else {
        const ziele = m.knoepfe.map((k) => k.z).sort().join(',');
        const soll = e.gem ? 'bezahlt,offen,pruefen' : 'bezahlt,offen';
        pruefe(ziele === soll && m.pfeile === 2 && m.knoepfe.every((k) => k.h >= 44 && k.l && k.tag === 'BUTTON'),
          n + ': Kassenwart-Knöpfe ' + ziele + ', Trefferflächen ' + m.knoepfe.map((k) => k.z + ' ' + k.h).join(' / '), JSON.stringify(m.knoepfe));
      }
      if (ort === 'team') {
        const sicht = await page.evaluate(() => {
          window.scrollTo(0, 0); document.querySelector('#scrollArea') && (document.querySelector('#scrollArea').scrollTop = 0);
          const nav = document.querySelector('.app-nav'); const unten = nav ? nav.getBoundingClientRect().top : innerHeight;
          return { rows: [...document.querySelectorAll('.kt-liste .row')].filter((r) => r.getBoundingClientRect().top < unten - 20).length,
                   leer: (document.querySelector('.empty') || {}).textContent || '' };
        });
        // 390 x 844: ohne Gemeldet-Zeile 4 Eintraege, mit ihr (Banner + eine Zeile) 3
        if (['normal', 'ohnegemeldet', 'gross', 'gemischt'].includes(zustand)) pruefe(sicht.rows >= (zustand === 'ohnegemeldet' ? 4 : zustand === 'normal' ? 3 : 1), n + ': Listeneinträge unter dem Banner sichtbar: ' + sicht.rows, JSON.stringify(sicht));
        else pruefe(sicht.leer === 'Keine offenen Strafen', n + ': Leerzustand ' + sicht.leer);
      }
      if (OUT && (ort === 'team' || zustand !== 'leer')) {
        const kb = await page.$('.kb'); await kb.scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${OUT}/kb-${profil}-${zustand}-${ort}.png` });
      }
      if (kw && zustand === 'normal') {
        for (const [ziel, reiter] of [['offen', 'offen'], ['bezahlt', 'bezahlt'], ['pruefen', 'pruefen']]) {
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
// Eigener Prueffall: Kontrast der Gemeldet-Zeile, schlechtester Wert ueber alle Faelle
pruefe(kontrastGemessen !== null && kontrastGemessen >= 4.5, 'Kontrast Gemeldet-Zeile auf der Offen-Fläche: ' + (kontrastGemessen || 0).toFixed(2) + ':1 (Soll ≥ 4,5:1)');
await browser.close(); server.close();
console.log(fehler.length ? `--- ${fehler.length} Beanstandung(en) ---` : '--- bestanden ---');
process.exit(fehler.length ? 1 : 0);
