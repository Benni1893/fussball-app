/* Paket „Einstellungen v2“: Belege mit dem echten Testkonto und Messung
   gegen die Vorlage über den Landkarten-Stand-in.

   Modus "beleg" (echtes Konto, echte Datenbank, NUR LESEND):
     APP_USER=... APP_PASS=... node .design-sync/shots/einv2mess.mjs beleg <spieler|admin>
   - meldet sich am ARBEITSSTAND an (lokaler Server, echte Supabase),
   - täuscht installierte App, erteilte Berechtigung und ein Push-Abo vor,
     damit die Seite Mitteilungen im Zustand „aktiv“ erscheint,
   - fängt JEDEN schreibenden Aufruf an die Datenbank ab (POST/PATCH/PUT/
     DELETE auf /rest/v1, außer den lesenden RPCs my_roles und
     notification_infos) und protokolliert ihn nur. Das vorgetäuschte Abo
     landet so nie in push_subscriptions.
   - nimmt Hauptseite und Mitteilungen auf und prüft im DOM, ob
     „Push-Texte“ und „Testnachricht senden“ da sind.
   Bilder: .design-sync/reference/compare/einv2-beleg-<rolle>-*.png
   (nicht versioniert). Zugangsdaten nur aus der Umgebung.                    */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { starte } from './server.mjs';

const MODUS = process.argv[2];
const OUT = path.join(process.cwd(), '.design-sync', 'reference', 'compare');
fs.mkdirSync(OUT, { recursive: true });

const fehler = [];
const pruefe = (ok, text, detail) => {
  console.log((ok ? '  ok   ' : '  FEHL ') + text + (detail !== undefined ? '   ' + detail : ''));
  if (!ok) fehler.push(text);
};

const IPHONE = {
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 '
           + '(KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
};

/* Installierte App + erteiltes Recht + Push-Abo vortäuschen. Nur im Browser
   dieses Laufs; nichts davon erreicht den Server (siehe Abfangen unten). */
const PUSH_AKTIV = () => {
  try { Object.defineProperty(navigator, 'standalone', { get: () => true }); } catch (e) {}
  const mm = window.matchMedia.bind(window);
  window.matchMedia = (q) => (/display-mode:\s*standalone/.test(q)
    ? { matches: true, media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }
    : mm(q));
  const abo = {
    endpoint: 'https://beleg.invalid/einv2mess',
    expirationTime: null,
    getKey: () => null,
    toJSON: () => ({ endpoint: 'https://beleg.invalid/einv2mess', keys: { p256dh: 'x', auth: 'x' } }),
    unsubscribe: async () => true,
  };
  if (window.PushManager) {
    PushManager.prototype.getSubscription = async () => abo;
    PushManager.prototype.subscribe = async () => abo;
  }
};

async function beleg(erwartet) {
  const USER = process.env.APP_USER || '';
  const PASS = process.env.APP_PASS || '';
  if (!USER || !PASS) { console.error('APP_USER und APP_PASS fehlen.'); process.exit(2); }
  if (!['spieler', 'admin'].includes(erwartet)) { console.error('Rolle: spieler oder admin'); process.exit(2); }

  const { server, basis } = await starte(process.cwd());
  const browser = await chromium.launch({ channel: 'chrome' });
  const ctx = await browser.newContext(IPHONE);
  await ctx.grantPermissions(['notifications'], { origin: basis.replace(/\/$/, '') });
  await ctx.addInitScript(PUSH_AKTIV);

  const abgefangen = [];
  await ctx.route(/\/rest\/v1\//, async (route) => {
    const r = route.request();
    const m = r.method();
    const lesend = m === 'GET' || m === 'HEAD'
      || (m === 'POST' && /\/rest\/v1\/rpc\/(my_roles|notification_infos)(\?|$)/.test(r.url()));
    if (lesend) return route.continue();
    abgefangen.push(m + ' ' + r.url().replace(/^https:\/\/[^/]+/, '').split('?')[0]);
    return route.fulfill({ status: 200, contentType: 'application/json', body: 'null' });
  });

  const page = await ctx.newPage();
  const seitenfehler = [];
  page.on('pageerror', (e) => seitenfehler.push(e.message));
  const ruhe = (ms = 700) => page.waitForTimeout(ms);

  await page.goto(basis, { waitUntil: 'networkidle' });
  await ruhe(1000);
  await page.fill('input[type="email"]', USER);
  await page.fill('input[type="password"]', PASS);
  await page.click('.auth-submit');
  await page.waitForSelector('.app-nav', { timeout: 25000 });
  await ruhe(2000);

  const imSpielerLink = await page.evaluate(() => !!document.querySelector('[data-pick-player]'));
  pruefe(!imSpielerLink, 'Konto ist mit einem Spieler verknüpft (sonst bleibt die App auf der Spielerzuordnung)');
  if (imSpielerLink) { await browser.close(); server.close(); return; }

  const rollen = await page.evaluate(() => {
    const t = document.querySelector('.ein-profil-rolle'); return t ? t.textContent : null;
  });

  // Hauptseite
  await page.click('#hdrGear');
  await ruhe(900);
  const haupt = await page.evaluate(() => ({
    rolle: (document.querySelector('.ein-profil-rolle') || {}).textContent || '',
    zeilen: [...document.querySelectorAll('.ein-zeile-t')].map((e) => e.textContent),
    titel: [...document.querySelectorAll('.ein-titel')].map((e) => e.textContent),
    pushTexte: !!document.querySelector('[data-goto="pushkatalog"]'),
  }));
  await page.screenshot({ path: path.join(OUT, `einv2-beleg-${erwartet}-hauptseite.png`), fullPage: true });

  // Mitteilungen
  await page.click('[data-ein="mitteilungen"]');
  await ruhe(1200);
  const mitt = await page.evaluate(() => ({
    aktiv: !!document.querySelector('[data-pn-haupt][aria-checked="true"]'),
    gruppen: [...document.querySelectorAll('.pn-kopf-t')].map((e) => e.textContent),
    testKnopf: !!document.querySelector('[data-push-test]'),
    testText: /Testnachricht senden/.test(document.body.innerText),
  }));
  await page.screenshot({ path: path.join(OUT, `einv2-beleg-${erwartet}-mitteilungen.png`), fullPage: true });

  console.log('--- Beleg als ' + erwartet + ' ---');
  console.log('  Rollenzeile:  ' + haupt.rolle);
  console.log('  Gruppen:      ' + haupt.titel.join(', '));
  console.log('  Zeilen:       ' + haupt.zeilen.join(', '));
  console.log('  Mitteilungen: ' + mitt.gruppen.join(', ') + (mitt.aktiv ? '  (Push aktiv vorgetäuscht)' : ''));
  pruefe(mitt.aktiv, 'Mitteilungen im Zustand „aktiv“ (nur dort steht die Testnachricht)');
  if (erwartet === 'spieler') {
    pruefe(!haupt.pushTexte && !haupt.zeilen.includes('Push-Texte'), 'Push-Texte nicht vorhanden');
    pruefe(!haupt.titel.includes('Verwaltung'), 'keine Gruppe VERWALTUNG');
    pruefe(!mitt.testKnopf && !mitt.testText, 'Testnachricht senden nicht vorhanden (auch nicht ausgegraut)');
  } else {
    pruefe(haupt.pushTexte && haupt.zeilen.includes('Push-Texte'), 'Push-Texte vorhanden');
    pruefe(mitt.testKnopf, 'Testnachricht senden vorhanden');
  }
  pruefe(seitenfehler.length === 0, 'keine Seitenfehler', seitenfehler.join(' | ') || undefined);
  console.log('  abgefangene Schreibaufrufe (nicht gesendet): ' + (abgefangen.length ? '\n    ' + abgefangen.join('\n    ') : 'keine'));

  await browser.close(); server.close();
}

/* ---------------------------------------------------------------------------
   Modus "soll": schneidet Panels aus den Vorlagen.
     node .design-sync/shots/einv2mess.mjs soll [panel ...]
   Die Vorlagen sind Bildschirmfotos aus Claude Design im Maßstab 1:1: jeder
   Rahmen 390 x 844 CSS-Pixel, Mittenabstand 422 px, Kopfleiste 60 px
   (vermessen am 04.10.2026 über die dunkle Kopfleiste).
   --------------------------------------------------------------------------- */
const VORLAGEN = '.design-sync/reference/app/einstellungen-v2/';
const SOLL = '.design-sync/reference/soll/';
const PANELS = {
  '1':  { datei: 'einst1.png', x: 32,  y: 40,  name: '1-admin',              profil: 'admin',   scroll: 'oben' },
  '1b': { datei: 'einst1.png', x: 454, y: 40,  name: '1b-admin-ende',        profil: 'admin',   scroll: 'unten' },
  '2':  { datei: 'einst1.png', x: 876, y: 40,  name: '2-spieler',            profil: 'spieler', scroll: 'oben' },
  '3':  { datei: 'einst2.png', x: 23,  y: 100, name: '3-mitteilungen',         profil: 'admin', seite: 'mitteilungen', push: true, scroll: 'oben' },
  // Panel 4: so weit gescrollt, dass "Termin geändert" wie in der Vorlage
  // steht (Glyphen oben bei 264, Element oben bei 260), Titel kompakt.
  '4':  { datei: 'einst2.png', x: 445, y: 100, name: '4-mitteilungen-kompakt', profil: 'admin', seite: 'mitteilungen', push: true, scroll: { text: 'Termin geändert', y: 260 } },
  // Kein eigenes Panel: Gruppen Trainer und Kasse, die die Vorlage in den
  // Mitteilungen nicht zeigt. Links zum Vergleich Panel 8 (Quelle der
  // Trainer-Symbole), das Soll-Bild entsteht nur unter compare/.
  '3t': { datei: 'einst3.png', x: 856, y: 34, name: '3t-mitteilungen-trainer-kasse', profil: 'trainerkassenwart', seite: 'mitteilungen', push: true, scroll: { text: 'Kurzfristige Absagen', y: 400 }, nurVergleich: true },
  '5':  { datei: 'einst2.png', x: 867, y: 100, name: '5-ruhezeiten',           profil: 'admin', seite: 'ruhezeiten', push: true, scroll: 'oben' },
  '6':  { datei: 'einst3.png', x: 12,  y: 34,  name: '6-kalender-abo' },
  '7':  { datei: 'einst3.png', x: 434, y: 34,  name: '7-spielplan-bfv' },
  '8':  { datei: 'einst3.png', x: 856, y: 34,  name: '8-push-texte' },
  '9':  { datei: 'einst4.png', x: 34,  y: 53,  name: '9-push-text-bearbeiten' },
  '10': { datei: 'einst4.png', x: 456, y: 53,  name: '10-diagnose' },
};
const sollPfad = (id) => SOLL + '07_einstellungen-v2_' + PANELS[id].name + '.png';

async function mitLeinwand(fn) {
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage();
  try { return await fn(page); } finally { await browser.close(); }
}

async function soll(ids) {
  fs.mkdirSync(SOLL, { recursive: true });
  await mitLeinwand(async (page) => {
    for (const id of ids) {
      const p = PANELS[id];
      if (!p) { pruefe(false, 'unbekanntes Panel ' + id); continue; }
      const b64 = fs.readFileSync(VORLAGEN + p.datei).toString('base64');
      const png = await page.evaluate(async ([d, x, y]) => {
        const img = new Image(); await new Promise((ok) => { img.onload = ok; img.src = 'data:image/png;base64,' + d; });
        const c = document.createElement('canvas'); c.width = 390; c.height = 844;
        c.getContext('2d').drawImage(img, x, y, 390, 844, 0, 0, 390, 844);
        return c.toDataURL('image/png').split(',')[1];
      }, [b64, p.x, p.y]);
      fs.writeFileSync(sollPfad(id), Buffer.from(png, 'base64'));
      pruefe(true, 'Soll ' + id + ' -> ' + sollPfad(id));
    }
  });
}

/* ---------------------------------------------------------------------------
   Modus "mess": App über den Landkarten-Stand-in (kein Supabase, erfundene
   Daten) bei 390 x 844, deviceScaleFactor 1, damit Soll und Ist Pixel für
   Pixel nebeneinanderliegen.
     node .design-sync/shots/einv2mess.mjs mess [panel ...]
   Ausgabe je Panel:
   - Bänder (Zeilen, in denen zwischen x 16 und 374 etwas anderes als der
     Seitenhintergrund steht) für Soll und Ist, paarweise mit Abweichung,
   - Werte aus dem DOM der App für die Bausteine der Seite,
   - Bild Soll | Ist nebeneinander unter reference/compare/.
   --------------------------------------------------------------------------- */
const DOM_MESSUNG = () => {
  const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { y: Math.round(b.top * 10) / 10, h: Math.round(b.height * 10) / 10, x: Math.round(b.left * 10) / 10, w: Math.round(b.width * 10) / 10 }; };
  const s = (el, ...k) => { if (!el) return null; const c = getComputedStyle(el); return Object.fromEntries(k.map((x) => [x, c[x]])); };
  const q = (sel) => document.querySelector(sel);
  const alle = (sel) => [...document.querySelectorAll(sel)];
  return {
    kopf: r(q('.app-header, header')),
    h1: { ...r(q('.page-head h1')), ...s(q('.page-head h1'), 'fontSize', 'fontWeight', 'lineHeight', 'color') },
    profil: { ...r(q('.ein-profil')), ...s(q('.ein-profil'), 'borderRadius', 'paddingTop', 'paddingLeft', 'boxShadow') },
    avatar: { ...r(q('.ein-profil-av')), ...s(q('.ein-profil-av'), 'fontSize', 'fontWeight', 'color', 'backgroundColor') },
    name: { ...r(q('.ein-profil-name')), ...s(q('.ein-profil-name'), 'fontSize', 'fontWeight', 'lineHeight') },
    rolle: { ...r(q('.ein-profil-rolle')), ...s(q('.ein-profil-rolle'), 'fontSize', 'color'), text: (q('.ein-profil-rolle') || {}).textContent },
    mail: { ...r(q('.ein-profil-mail')), ...s(q('.ein-profil-mail'), 'fontSize', 'color') },
    gruppen: alle('.ein-gruppe').map((g) => ({ ...r(g), ...s(g, 'borderRadius', 'boxShadow', 'marginTop') })),
    titel: alle('.ein-titel').map((t) => ({ text: t.textContent, ...r(t), ...s(t, 'fontSize', 'fontWeight', 'letterSpacing', 'color') })),
    zeilen: alle('.ein-zeile').map((z) => ({ text: (z.querySelector('.ein-zeile-t') || {}).textContent, ...r(z),
      ic: r(z.querySelector('.ein-ic')), icRadius: (s(z.querySelector('.ein-ic'), 'borderRadius') || {}).borderRadius,
      t: s(z.querySelector('.ein-zeile-t'), 'fontSize', 'fontWeight'),
      wert: s(z.querySelector('.ein-zeile-w'), 'fontSize', 'color'),
      chevron: !!z.querySelector('.ein-chev') })),
    abmelden: { ...r(q('.ein-abmelden')), ...s(q('.ein-abmelden'), 'fontSize', 'fontWeight', 'color') },
    build: { ...r(q('.ein-build')), ...s(q('.ein-build'), 'fontSize', 'color'), text: (q('.ein-build') || {}).textContent },
    nav: r(q('.app-nav')),
    scrollY: window.scrollY,
  };
};

const DOM_MITTEILUNGEN = () => {
  const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { y: Math.round(b.top * 10) / 10, h: Math.round(b.height * 10) / 10, x: Math.round(b.left * 10) / 10, w: Math.round(b.width * 10) / 10 }; };
  const s = (el, ...k) => { if (!el) return null; const c = getComputedStyle(el); return Object.fromEntries(k.map((x) => [x, c[x]])); };
  const q = (sel) => document.querySelector(sel);
  const alle = (sel) => [...document.querySelectorAll(sel)];
  return {
    zustand: q('.ein-mitteilungen') ? 'karten' : (q('[data-push-karte]') ? 'karte' : 'fehlt'),
    kopf: { ...r(q('.ein-kopf')), kompakt: !!q('.ein-kopf.is-kompakt') },
    h1: { ...r(q('.ein-h1')), ...s(q('.ein-h1'), 'fontSize', 'fontWeight', 'lineHeight') },
    zeitzeilen: alle('.ein-zeitzeile').map((z) => ({ ...r(z), t: r(z.querySelector('.ein-zeitzeile-t')), pille: { ...r(z.querySelector('.ein-zeit-pille')), ...s(z.querySelector('.ein-zeit-pille'), 'fontSize', 'fontWeight', 'borderRadius', 'backgroundColor') }, feld: r(z.querySelector('.ein-zeit')) })),
    gruppen: alle('[data-push-karte] .ein-gruppe').map((g) => ({ ...r(g), klasse: g.className })),
    hinweise: alle('[data-push-karte] .ein-hinweis').map((h) => ({ ...r(h), ...s(h, 'fontSize', 'lineHeight', 'color'), text: h.textContent.slice(0, 40) })),
    gkopf: alle('.ein-gkopf').map((k) => ({ ...r(k), t: { ...r(k.querySelector('.ein-gkopf-t')), ...s(k.querySelector('.ein-gkopf-t'), 'fontSize', 'color') },
      alle: s(k.querySelector('.ein-gkopf-alle span'), 'fontSize', 'fontWeight', 'color'), sw: r(k.querySelector('.sw')) })),
    zeilen: alle('.ein-schalter').map((z) => ({ text: (z.querySelector('.ein-schalter-t') || {}).textContent, ...r(z),
      ic: r(z.querySelector('.ein-ic')), t: { ...r(z.querySelector('.ein-schalter-t')), ...s(z.querySelector('.ein-schalter-t'), 'fontSize', 'fontWeight', 'lineHeight') },
      s: { ...r(z.querySelector('.ein-schalter-s')), ...s(z.querySelector('.ein-schalter-s'), 'fontSize', 'lineHeight') },
      sw: r(z.querySelector('.sw')) })),
    aktion: { ...r(q('.ein-gruppe-aktion')), t: s(q('.ein-zeile-aktion .ein-zeile-t'), 'fontSize', 'fontWeight', 'color') },
    nav: r(q('.app-nav')),
    scrollY: window.scrollY,
  };
};

async function baender(page, b64, vonY, bisY) {
  return page.evaluate(async ([d, von, bis]) => {
    const img = new Image(); await new Promise((ok) => { img.onload = ok; img.src = 'data:image/png;base64,' + d; });
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
    const D = g.getImageData(0, 0, c.width, c.height).data;
    const S = img.width / 390;
    const px = (x, y) => { const i = (Math.round(y) * c.width + Math.round(x)) * 4; return [D[i], D[i + 1], D[i + 2]]; };
    const out = []; let s = null;
    for (let yc = von; yc <= bis; yc++) {
      const y = yc * S;
      const gr = px(8 * S, y);
      let voll = false;
      for (let xc = 16; xc < 374; xc++) {
        const [r, gg, b] = px(xc * S, y);
        if (Math.abs(r - gr[0]) > 6 || Math.abs(gg - gr[1]) > 6 || Math.abs(b - gr[2]) > 6) { voll = true; break; }
      }
      if (voll && s === null) s = yc;
      if (!voll && s !== null) { out.push([s, yc - 1]); s = null; }
    }
    if (s !== null) out.push([s, bis]);
    return out;
  }, [b64, vonY, bisY]);
}

async function nebeneinander(page, aB64, bB64, ziel) {
  const png = await page.evaluate(async ([a, b]) => {
    const lade = async (d) => { const i = new Image(); await new Promise((ok) => { i.onload = ok; i.src = 'data:image/png;base64,' + d; }); return i; };
    const A = await lade(a), B = await lade(b);
    const c = document.createElement('canvas'); c.width = 390 * 2 + 12; c.height = 844;
    const g = c.getContext('2d'); g.fillStyle = '#ff00ff'; g.fillRect(0, 0, c.width, c.height);
    g.drawImage(A, 0, 0, 390, 844); g.drawImage(B, 402, 0, 390, 844);
    return c.toDataURL('image/png').split(',')[1];
  }, [aB64, bB64]);
  fs.writeFileSync(ziel, Buffer.from(png, 'base64'));
}

async function mess(ids) {
  const { installiere, warteAufApp } = await import('./landkartenmodul.mjs');
  const { server, basis } = await starte(process.cwd());
  const browser = await chromium.launch({ channel: 'chrome' });
  const leinwand = await browser.newPage();
  const ergebnis = {};
  for (const id of ids) {
    const p = PANELS[id];
    if (!p || !p.profil) { pruefe(false, 'Panel ' + id + ' hat noch keine Messvorschrift'); continue; }
    if (p.nurVergleich) {
      const b64v = fs.readFileSync(VORLAGEN + p.datei).toString('base64');
      const png = await leinwand.evaluate(async ([d, x, y]) => {
        const img = new Image(); await new Promise((ok) => { img.onload = ok; img.src = 'data:image/png;base64,' + d; });
        const c = document.createElement('canvas'); c.width = 390; c.height = 844;
        c.getContext('2d').drawImage(img, x, y, 390, 844, 0, 0, 390, 844);
        return c.toDataURL('image/png').split(',')[1];
      }, [b64v, p.x, p.y]);
      fs.writeFileSync(path.join(OUT, 'einv2-soll-' + p.name + '.png'), Buffer.from(png, 'base64'));
    } else if (!fs.existsSync(sollPfad(id))) await soll([id]);
    const ctx = await browser.newContext({ ...IPHONE, deviceScaleFactor: 1, locale: 'de-DE',
      timezoneId: 'Europe/Berlin', serviceWorkers: 'block' });
    if (p.push) {
      await ctx.grantPermissions(['notifications'], { origin: basis.replace(/\/$/, '') });
      await ctx.addInitScript(PUSH_AKTIV);
    }
    const page = await ctx.newPage();
    const inst = await installiere(page, p.profil);
    if (p.push) {
      // Nach dem Service-Worker-Stand-in: dessen pushManager liefert sonst null.
      await page.addInitScript(() => {
        const abo = { endpoint: 'https://mess.invalid/einv2', getKey: () => null,
          toJSON: () => ({ endpoint: 'https://mess.invalid/einv2', keys: { p256dh: 'x', auth: 'x' } }),
          unsubscribe: async () => true };
        if (navigator.serviceWorker && navigator.serviceWorker.ready) {
          navigator.serviceWorker.ready.then((r) => { if (r && r.pushManager) r.pushManager.getSubscription = async () => abo; });
        }
      });
    }
    await page.goto(basis, { waitUntil: 'networkidle' });
    await warteAufApp(page);
    await page.click('#hdrGear');
    await page.waitForTimeout(500);
    if (p.seite) {
      await page.click('[data-ein="' + p.seite + '"]');
      await page.waitForTimeout(700);
    }
    if (p.scroll === 'unten') {
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForTimeout(300);
    } else if (p.scroll && p.scroll.text) {
      await page.evaluate((a) => {
        const el = [...document.querySelectorAll('.ein-schalter-t, .ein-zeile-t')].find((e) => e.textContent === a.text);
        if (el) window.scrollBy(0, el.getBoundingClientRect().top - a.y);
      }, p.scroll);
      await page.waitForTimeout(400);
    }
    const dom = await page.evaluate(p.seite ? DOM_MITTEILUNGEN : DOM_MESSUNG);
    const istB64 = (await page.screenshot()).toString('base64');
    const sollB64 = fs.readFileSync(p.nurVergleich ? path.join(OUT, 'einv2-soll-' + p.name + '.png') : sollPfad(id)).toString('base64');
    const navTop = dom.nav ? Math.floor(dom.nav.y) - 1 : 773;
    const sb = await baender(leinwand, sollB64, 61, 772);
    const ib = await baender(leinwand, istB64, 61, Math.min(772, navTop));
    await nebeneinander(leinwand, sollB64, istB64, path.join(OUT, 'einv2-mess-' + p.name + '.png'));
    fs.writeFileSync(path.join(OUT, 'einv2-ist-' + p.name + '.png'), Buffer.from(istB64, 'base64'));
    const bericht = await inst.bericht();
    pruefe(bericht.verstoesse.length === 0, 'Panel ' + id + ': kein Request an Supabase', bericht.verstoesse.join(' | ') || undefined);
    ergebnis[id] = { soll: sb, ist: ib, dom };
    console.log('\n=== Panel ' + id + ' (' + p.name + ', Profil ' + p.profil + ') ===');
    console.log('  Bänder  Soll y..y (h)        Ist y..y (h)         Δy   Δh');
    const n = Math.max(sb.length, ib.length);
    for (let i = 0; i < n; i++) {
      const a = sb[i], b = ib[i];
      const f = (x) => x ? (x[0] + '..' + x[1] + ' (' + (x[1] - x[0] + 1) + ')').padEnd(20) : '–'.padEnd(20);
      const dy = a && b ? b[0] - a[0] : '';
      const dh = a && b ? (b[1] - b[0]) - (a[1] - a[0]) : '';
      console.log('  ' + String(i + 1).padStart(2) + '      ' + f(a) + ' ' + f(b) + ' ' + String(dy).padStart(4) + ' ' + String(dh).padStart(4));
    }
    console.log('  DOM: ' + JSON.stringify(dom, null, 1).replace(/\n\s*/g, ' '));
    await ctx.close();
  }
  fs.writeFileSync(path.join(OUT, 'einv2-mess.json'), JSON.stringify(ergebnis, null, 1));
  await browser.close(); server.close();
}

if (MODUS === 'beleg') await beleg(process.argv[3]);
else if (MODUS === 'soll') await soll(process.argv.slice(3).length ? process.argv.slice(3) : Object.keys(PANELS));
else if (MODUS === 'mess') await mess(process.argv.slice(3).length ? process.argv.slice(3) : ['1', '1b', '2']);
else { console.error('Aufruf: node .design-sync/shots/einv2mess.mjs beleg <spieler|admin> | soll [panel ...] | mess [panel ...]'); process.exit(2); }

console.log(fehler.length === 0 ? '\n--- bestanden ---' : '\n--- NICHT bestanden: ' + fehler.length + ' ---');
process.exit(fehler.length === 0 ? 0 : 1);
