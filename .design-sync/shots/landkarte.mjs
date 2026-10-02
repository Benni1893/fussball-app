/* App-Landkarte, Schritt L2: Crawler mit Zustandserkennung und Kanten.

   Faehrt die echte App je Profil ab (Stand-in aus landkartenmodul.mjs,
   Regeln aus landkartenregeln.mjs), Breitensuche bis zur Tiefengrenze.
   Jeder Zustand wird frisch erreicht: Seite neu laden, Klickpfad
   wiederholen. Je Zustand und Ausloeser-Art ein Beispielelement.

   Ausgabe
     .design-sync/landkarte/landkarte.json          versioniert
     .design-sync/landkarte/bilder/<profil>/*.png   nicht versioniert

   Je Knoten zusaetzlich (L4): strang, name und nameQuelle (ueberschrift
   oder liste), Regeln in landkartenregeln.mjs.

   Rot (Rueckgabewert 1): Request an Supabase, Seitenfehler, Klick ohne
   erkennbaren Zustand, Knoten ohne sprechenden Namen oder doppelter Name
   im selben Strang.
   Warnung: Ausloeser, die nur wegen der Tiefengrenze nicht verfolgt wurden.

   Aufruf: node .design-sync/shots/landkarte.mjs [profil ...]
           LANDKARTE_TIEFE=n setzt die Tiefengrenze (Standard 6).
   Als Modul: crawle({ profile, mitBildern }) - landkartendrift.mjs crawlt
   damit ohne Bilder und ohne etwas zu schreiben.                         */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { starte } from './server.mjs';
import { PROFILE, JETZT, installiere, neuerKontext, warteAufApp } from './landkartenmodul.mjs';
import { AUSLOESER, UEBERLAGERUNGEN, zustandImBrowser, schluessel,
  STRAENGE, straengeVon, knotenName, pruefeNamen } from './landkartenregeln.mjs';

const MAX_TIEFE = Number(process.env.LANDKARTE_TIEFE || 6);
const ZIEL = '.design-sync/landkarte';
const BILDER = path.join(ZIEL, 'bilder');
const RUHE_MS = 450;

const dateiname = (k) => k.replace(/\//g, '__').replace(/\+/g, '--').replace(/[^a-zA-Z0-9_.-]/g, '-') + '.png';
const slug = (s) => (s || '').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

/* Läuft im Browser: sichtbare Auslöser im aktuellen Zustand.
   Ist eine Überlagerung offen, zählt nur, was in der obersten liegt.
   Geschlossene Überlagerungen und unsichtbare Elemente zählen nicht.   */
function kandidatenImBrowser({ ausloeser, ueberlagerungen, oben, istStart, nurArt, nurWert }) {
  const offen = new Set(oben);
  const zu = ueberlagerungen.map((u) => document.getElementById(u.id)).filter((el) => el && !offen.has(el.id));
  const bereich = oben.length ? document.getElementById(oben[oben.length - 1]) : document;
  const sichtbar = (el, gesperrtOk) => {
    if (zu.some((z) => z.contains(el))) return false;
    if (!el.getClientRects().length) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none' && (gesperrtOk || !el.disabled);
  };
  const text = (el) => (el.getAttribute('aria-label') || el.textContent || el.getAttribute('title') || '')
    .replace(/\s+/g, ' ').trim().slice(0, 48);
  const liste = [];
  for (const a of ausloeser) {
    if (a.global && !istStart) continue;
    if (nurArt && a.art !== nurArt) continue;
    const gesehen = new Set();
    for (const el of bereich.querySelectorAll(a.sel)) {
      if (!sichtbar(el, !!a.vorher)) continue;
      const wert = a.attr ? el.getAttribute(a.attr) : null;
      if (a.wert && !a.wert.includes(wert)) continue;
      if (nurArt && (nurWert ?? null) !== (wert ?? null)) continue;
      const k = a.attr ? wert : '';
      if (gesehen.has(k)) continue;
      gesehen.add(k);
      if (nurArt) { el.setAttribute('data-landkarte-ziel', '1'); return [{ art: a.art }]; }
      liste.push({ art: a.art, wert, text: text(el) });
    }
  }
  return liste;
}

async function crawleProfil(browser, basis, name, mitBildern) {
  const t0 = Date.now();
  const ctx = await neuerKontext(browser);
  const page = await ctx.newPage();
  const lauf = await installiere(page, name);
  let dialog = null;
  page.on('dialog', async (d) => { dialog = { typ: d.type(), text: d.message() }; await d.dismiss().catch(() => {}); });

  const knoten = new Map(), kanten = [], tiefengrenze = [], ohneWirkung = [], unbekannt = [], nichtWiederholbar = [];
  const gefundeneArten = new Set();
  if (mitBildern) fs.mkdirSync(path.join(BILDER, name), { recursive: true });

  const lese = () => page.evaluate(zustandImBrowser, UEBERLAGERUNGEN);
  async function start() {
    dialog = null;
    await page.goto(basis, { waitUntil: 'load' });
    await warteAufApp(page);
  }
  async function klick(schritt) {
    const z = await lese();
    const treffer = await page.evaluate(kandidatenImBrowser, {
      ausloeser: AUSLOESER, ueberlagerungen: UEBERLAGERUNGEN, oben: z.oben,
      istStart: schritt.global === true, nurArt: schritt.art, nurWert: schritt.wert,
    });
    if (!treffer.length) {
      if (process.env.LANDKARTE_DEBUG) console.log('DEBUG klick fehlt', name, JSON.stringify(schritt), page.url(), JSON.stringify(z));
      return false;
    }
    const vorher = (AUSLOESER.find((a) => a.art === schritt.art) || {}).vorher;
    await page.evaluate(async (vorher) => {
      const el = document.querySelector('[data-landkarte-ziel]');
      el.removeAttribute('data-landkarte-ziel');
      if (vorher) {
        const v = [...document.querySelectorAll(vorher)].find((x) => x.getClientRects().length);
        if (v) { v.click(); await new Promise((r) => setTimeout(r, 200)); }
      }
      el.click();
    }, vorher || null);
    await page.waitForTimeout(RUHE_MS);
    return true;
  }
  async function erreiche(pfad) {
    await start();
    for (const s of pfad) if (!(await klick(s))) return false;
    return true;
  }
  async function bild(k) {
    const datei = path.join(BILDER, name, dateiname(k));
    if (mitBildern) await page.screenshot({ path: datei });
    return path.relative(ZIEL, datei).replace(/\\/g, '/');
  }
  const schritt = (c, istStart) => ({ art: c.art, wert: c.wert ?? null, text: c.text,
    global: istStart && !!(AUSLOESER.find((a) => a.art === c.art) || {}).global });

  await start();
  const z0 = await lese();
  const k0 = schluessel(z0);
  if (!k0) unbekannt.push({ von: null, ausloeser: 'Start' });
  knoten.set(k0, { schluessel: k0, ...z0, tiefe: 0, pfad: [], bild: await bild(k0) });
  const schlange = [{ k: k0, pfad: [] }];

  while (schlange.length) {
    const { k, pfad } = schlange.shift();
    const istStart = pfad.length === 0;
    if (!(await erreiche(pfad))) { nichtWiederholbar.push({ knoten: k }); continue; }
    const z = await lese();
    const kand = await page.evaluate(kandidatenImBrowser, {
      ausloeser: AUSLOESER, ueberlagerungen: UEBERLAGERUNGEN, oben: z.oben, istStart, nurArt: null, nurWert: null,
    });
    kand.forEach((c) => gefundeneArten.add(c.art));
    if (pfad.length >= MAX_TIEFE) {
      kand.forEach((c) => tiefengrenze.push({ von: k, art: c.art, wert: c.wert ?? null, text: c.text }));
      continue;
    }
    for (const c of kand) {
      const s = schritt(c, istStart);
      if (!(await erreiche(pfad))) { nichtWiederholbar.push({ knoten: k }); break; }
      dialog = null;
      if (!(await klick(s))) { nichtWiederholbar.push({ knoten: k, art: c.art, wert: c.wert ?? null }); continue; }
      const kante = { von: k, art: c.art, wert: c.wert ?? null, text: c.text };
      if (dialog) {
        const dk = 'dialog:' + slug(dialog.text.split('\n')[0]);
        if (!knoten.has(dk)) knoten.set(dk, { schluessel: dk, ansicht: 'dialog', unter: null, oben: [], ueberschrift: null,
          hash: '', dialog: { typ: dialog.typ, text: dialog.text }, tiefe: pfad.length + 1, pfad: [...pfad, s], bild: null });
        kanten.push({ ...kante, nach: dk });
        continue;
      }
      const z2 = await lese();
      const k2 = schluessel(z2);
      if (!k2) { unbekannt.push({ ...kante, ueberschrift: z2.ueberschrift, hash: z2.hash }); continue; }
      if (k2 === k) { ohneWirkung.push(kante); continue; }
      kanten.push({ ...kante, nach: k2 });
      if (!knoten.has(k2)) {
        knoten.set(k2, { schluessel: k2, ...z2, tiefe: pfad.length + 1, pfad: [...pfad, s], bild: await bild(k2) });
        schlange.push({ k: k2, pfad: [...pfad, s] });
      }
    }
  }

  const bericht = await lauf.bericht();
  await ctx.close();
  const sortiere = (a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b));
  const ohneHash = (n) => { const { hash, ...rest } = n; return rest; };
  const liste = [...knoten.values()].map(ohneHash).sort((a, b) => a.tiefe - b.tiefe || a.schluessel.localeCompare(b.schluessel));
  /* Strang und sprechender Name je Knoten (L4). */
  const strang = straengeVon(name, liste, kanten);
  const benannt = liste.map((n) => {
    const s = strang.get(n.schluessel);
    const { name: nm, quelle } = knotenName(n, STRAENGE[s]);
    return { ...n, strang: s, name: nm, nameQuelle: quelle };
  });
  const namenBefunde = [
    ...benannt.filter((n) => !STRAENGE[n.strang]).map((n) => `${PROFILE[name].titel}: ${n.schluessel} in unbekanntem Strang "${n.strang}" (STRAENGE ergänzen)`),
    ...pruefeNamen(PROFILE[name].titel, benannt),
  ];
  return {
    name, titel: PROFILE[name].titel, rollen: PROFILE[name].rollen,
    knoten: benannt,
    kanten: kanten.sort(sortiere),
    tiefengrenze: tiefengrenze.sort(sortiere),
    ohneWirkung: ohneWirkung.sort(sortiere),
    unbekannt, nichtWiederholbar,
    gefundeneArten: [...gefundeneArten].sort(),
    schreibaufrufe: [...new Set(bericht.protokoll.map((p) => p.methode))].sort(),
    verstoesse: bericht.verstoesse, fehler: bericht.fehler, hinweise: [...new Set(bericht.hinweise)], namenBefunde,
    sekunden: Math.round((Date.now() - t0) / 1000),
  };
}

/* Crawlt die gewaehlten Profile parallel und baut das JSON der Landkarte.
   mitBildern=false: keine Screenshots, bilder/ bleibt unberuehrt. */
export async function crawle({ profile = Object.keys(PROFILE), mitBildern = true } = {}) {
  for (const p of profile) if (!PROFILE[p]) throw new Error('Unbekanntes Profil: ' + p);
  const t0 = Date.now();
  const { server, basis } = await starte(process.cwd());
  const browser = await chromium.launch({ channel: 'chrome' });
  if (mitBildern) for (const p of profile) fs.rmSync(path.join(BILDER, p), { recursive: true, force: true });
  const ergebnisse = await Promise.all(profile.map((p) => crawleProfil(browser, basis, p, mitBildern)));
  await browser.close();
  server.close();
  const laufzeit = Math.round((Date.now() - t0) / 1000);

  const alleArten = new Set(ergebnisse.flatMap((e) => e.gefundeneArten));
  const nichtErreicht = AUSLOESER.map((a) => a.art).filter((a) => !alleArten.has(a));
  const json = {
    erzeugtVon: '.design-sync/shots/landkarte.mjs',
    jetzt: JETZT,
    maxTiefe: MAX_TIEFE,
    straenge: STRAENGE,
    profile: Object.fromEntries(ergebnisse.map((e) => {
      const { name, verstoesse, fehler, hinweise, namenBefunde, sekunden, ...rest } = e;
      return [name, rest];
    })),
    nichtErreichteAusloeser: nichtErreicht,
  };
  return { json, ergebnisse, laufzeit };
}

const istHaupt = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (istHaupt) {
  const auswahl = process.argv.slice(2);
  const profile = auswahl.length ? auswahl : Object.keys(PROFILE);
  for (const p of profile) if (!PROFILE[p]) { console.error('Unbekanntes Profil: ' + p); process.exit(2); }
  const { json, ergebnisse, laufzeit } = await crawle({ profile, mitBildern: true });
  fs.mkdirSync(ZIEL, { recursive: true });
  // Nur bei einem vollen Lauf schreiben - ein Teillauf wuerde Profile loeschen.
  if (!auswahl.length) fs.writeFileSync(path.join(ZIEL, 'landkarte.json'), JSON.stringify(json, null, 2) + '\n');

  let rot = 0, warn = 0;
  console.log('Profil'.padEnd(20) + 'Knoten'.padStart(7) + 'Kanten'.padStart(8) + 'Tiefe'.padStart(7) + 'Sek.'.padStart(6));
  for (const e of ergebnisse) {
    const tiefe = Math.max(...e.knoten.map((n) => n.tiefe));
    console.log(e.titel.padEnd(20) + String(e.knoten.length).padStart(7) + String(e.kanten.length).padStart(8)
      + String(tiefe).padStart(7) + String(e.sekunden).padStart(6));
  }
  for (const e of ergebnisse) {
    const p = '  [' + e.titel + '] ';
    for (const v of e.verstoesse) { rot++; console.log('ROT ' + p + v); }
    for (const f of e.fehler) { rot++; console.log('ROT ' + p + f); }
    for (const u of e.unbekannt) { rot++; console.log('ROT ' + p + 'Klick ohne erkennbaren Zustand: ' + JSON.stringify(u)); }
    for (const b of e.namenBefunde) { rot++; console.log('ROT  ' + b); }
    for (const n of e.nichtWiederholbar) { warn++; console.log('WARNUNG' + p + 'Pfad nicht wiederholbar: ' + JSON.stringify(n)); }
    for (const t of e.tiefengrenze) { warn++; console.log('WARNUNG' + p + 'Tiefengrenze ' + MAX_TIEFE + ', nicht verfolgt: ' + t.von + ' -> ' + t.art + (t.wert ? '=' + t.wert : '') + ' "' + t.text + '"'); }
    for (const h of e.hinweise) console.log('Hinweis' + p + h);
  }
  console.log('Nicht erreichte Auslöser (in keinem Profil sichtbar): ' + (json.nichtErreichteAusloeser.length ? json.nichtErreichteAusloeser.join(', ') : 'keine'));
  console.log(`Laufzeit: ${laufzeit} s, Tiefengrenze ${MAX_TIEFE}` + (auswahl.length ? ' (Teillauf, JSON nicht geschrieben)' : ''));
  console.log(rot ? `--- ROT: ${rot} Befund(e), ${warn} Warnung(en) ---` : `--- gruen, ${warn} Warnung(en) ---`);
  process.exit(rot ? 1 : 0);
}
