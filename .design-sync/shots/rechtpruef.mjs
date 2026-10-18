/* Paket Rechtliches (14.10.2026): Impressum und Datenschutzerklaerung im
   Stand-in, ohne Datenbank.
   - beide Seiten ohne Anmeldung erreichbar, Inhalt aus der Vorlage, Kontakt-
     adresse statt Platzhalter [E-MAIL], Text mindestens 13 px, 390 px ohne
     waagerechtes Scrollen
   - Verweise aus Anmeldung, Registrierung (Einladungslink), Wartet auf
     Freigabe und Einstellungen fuehren auf die Seiten
   - Einwilligung Gesundheitsstatus: Verweis auf Abschnitt 3d, ohne
     Alters-Haken keine Einwilligung (Dialog und Onboarding)
   - keine Anfrage an einen fremden Host
   Bilder beider Seiten bei 390 px nach .design-sync/rechtliches/.
   Aufruf: node .design-sync/shots/rechtpruef.mjs                         */
import { chromium } from 'playwright';
import fs from 'node:fs';
import { starte } from './server.mjs';
import { installiere, daten } from './landkartenmodul.mjs';

const fehler = [];
const pruefe = (ok, text, detail) => { console.log((ok ? '  ok   ' : '  FEHL ') + text + (detail !== undefined && !ok ? '   ' + detail : '')); if (!ok) fehler.push(text); };

const { server, basis } = await starte(process.cwd());
const eigenerHost = new URL(basis).host;
const fremd = new Set();
const browser = await chromium.launch({ channel: 'chrome' });
async function kontext() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  ctx.on('request', (r) => { const u = new URL(r.url()); if (/^https?:$/.test(u.protocol) && u.host !== eigenerHost) fremd.add(u.host); });
  return ctx;
}
async function seite(profil, opts, hash) {
  const ctx = await kontext();
  const page = await ctx.newPage();
  page.on('dialog', (d) => d.accept().catch(() => {}));
  await installiere(page, profil, opts);
  await page.goto(basis + (hash || '')); await page.waitForTimeout(1500);
  await page.addStyleTag({ content: '*{transition:none!important}' });
  return { ctx, page };
}
const h1 = (page) => page.evaluate(() => (document.querySelector('h1') || {}).textContent || '');
// Verweis antippen und pruefen, wo man landet.
async function folge(page, selektor, datei, titel, ort) {
  const el = await page.$(selektor);
  if (!el) { pruefe(false, ort + ': Verweis ' + datei, 'nicht gefunden: ' + selektor); return; }
  await Promise.all([page.waitForURL('**/' + datei + '*', { timeout: 5000 }).catch(() => {}), el.click()]);
  await page.waitForTimeout(300);
  pruefe(page.url().includes(datei) && await h1(page) === titel, ort + ': Verweis ' + datei, page.url() + ' / ' + await h1(page));
}

// 1) Beide Seiten ohne Anmeldung (keine Sitzung, kein Stand-in)
const vorlage = fs.readFileSync('.design-sync/rechtliches/datenschutz-impressum.md', 'utf8');
for (const [datei, titel] of [['impressum.html', 'Impressum'], ['datenschutz.html', 'Datenschutzerklärung']]) {
  const ctx = await kontext();
  const page = await ctx.newPage();
  const res = await page.goto(basis + datei); await page.waitForTimeout(500);
  pruefe(res.status() === 200 && await h1(page) === titel, datei + ': ohne Anmeldung erreichbar', res.status() + ' ' + await h1(page));
  const m = await page.evaluate(() => {
    const txt = [...document.querySelectorAll('main *')].filter((e) => e.childNodes.length && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()));
    return {
      klein: txt.filter((e) => parseFloat(getComputedStyle(e).fontSize) < 13).map((e) => e.tagName + ':' + getComputedStyle(e).fontSize),
      breit: document.documentElement.scrollWidth, text: document.querySelector('main').innerText,
      platzhalter: (document.querySelector('main').textContent.match(/\[E-MAIL\]/g) || []).length,
      prompt: /Prompt für Claude|Noch zu erledigen/.test(document.body.textContent),
    };
  });
  pruefe(m.klein.length === 0, datei + ': aller Text mindestens 13 px', m.klein.join(', '));
  pruefe(m.breit <= 390, datei + ': 390 px ohne waagerechtes Scrollen', m.breit);
  // seit 18.10.2026 echte Kontaktadresse statt [E-MAIL]: Datenschutz zweimal, Impressum einmal
  const adresse = (m.text.match(/teamkabine-app@gmx\.de/g) || []).length;
  pruefe(m.platzhalter === 0 && adresse === (datei === 'datenschutz.html' ? 2 : 1), datei + ': Kontaktadresse eingetragen, kein Platzhalter mehr', m.platzhalter + '/' + adresse);
  pruefe(!m.prompt, datei + ': ohne Prompt und To-do-Liste');
  await page.screenshot({ path: '.design-sync/rechtliches/' + datei.replace('.html', '') + '-390.png', fullPage: true });
  if (datei === 'datenschutz.html') {
    // Kernsaetze der Vorlage stehen unveraendert auf der Seite
    for (const satz of ['einschließlich Notizen zur Strafe', 'Mitteilungen enthalten keine Gesundheitsangaben.', 'Bayerisches Landesamt für Datenschutzaufsicht',
                        'Zusagen, Absagen und Absagegründe anderer Spieler sehen nur Trainer und Admin', 'Den Status sehen nur Sie selbst, Trainer und Admin.']) {
      pruefe(vorlage.includes(satz) && m.text.includes(satz), 'Satz aus der Vorlage: ' + satz);
    }
    const ziele = await page.evaluate(() => ['konto', 'termine', 'strafen', 'spielerstatus', 'mitteilungen', 'kalender', 'technik', 'lokal'].filter((id) => !document.getElementById(id)));
    pruefe(ziele.length === 0, 'Abschnitte 3a bis 3h als Sprungziele', ziele.join(','));
    await page.goto(basis + 'datenschutz.html#spielerstatus'); await page.waitForTimeout(300);
    const z = await page.evaluate(() => ({ t: (document.getElementById('spielerstatus') || {}).textContent, y: Math.round(document.getElementById('spielerstatus').getBoundingClientRect().top) }));
    pruefe(z.t === 'd) Spielerstatus' && z.y >= 0 && z.y < 100, 'Sprungziel #spielerstatus ist Abschnitt 3d', JSON.stringify(z));
  }
  await ctx.close();
}

// 2) Verweise aus Anmeldung, Registrierung, Wartet auf Freigabe, Einstellungen
for (const [datei, titel] of [['datenschutz.html', 'Datenschutzerklärung'], ['impressum.html', 'Impressum']]) {
  {
    const { ctx, page } = await seite('anmeldung');
    pruefe(await h1(page) === 'Anmelden', 'Anmeldeseite steht');
    await folge(page, `#authForm .ob-recht a[href="${datei}"]`, datei, titel, 'Anmeldung');
    await ctx.close();
  }
  {
    const { ctx, page } = await seite('anmeldung', null, '#einladung=landkarte-einladung');
    pruefe(await h1(page) === 'Konto erstellen', 'Registrierung über Einladungslink steht');
    await folge(page, `#authForm .ob-recht a[href="${datei}"]`, datei, titel, 'Registrierung');
    await ctx.close();
  }
  {
    const { ctx, page } = await seite('wartend');
    await page.evaluate(() => { try { localStorage.setItem('fn_ob_home', '1'); } catch (e) {} });
    await page.click('[data-ob-ds]'); await page.click('[data-ob="datenschutz"]'); await page.waitForTimeout(400);
    await page.click('[data-ob-pos="sturm"]'); await page.click('[data-ob="position"]'); await page.waitForTimeout(400);
    pruefe(await h1(page) === 'Warte auf Freigabe', 'Wartet auf Freigabe steht', await h1(page));
    await folge(page, `.ob-card .ob-recht a[href="${datei}"]`, datei, titel, 'Wartet auf Freigabe');
    await ctx.close();
  }
  {
    const { ctx, page } = await seite('spieler');
    // Einstellungen -> Profil ansehen -> Abschnitt Datenschutz
    await page.click('.hdr-gear'); await page.waitForTimeout(600);
    pruefe(await page.evaluate(() => (document.querySelector('#view h1') || {}).textContent) === 'Einstellungen', 'Einstellungen stehen');
    await page.click('[data-ein="profil"]'); await page.waitForTimeout(600);
    await folge(page, `.pr-zeile[data-pr-link="${datei.replace('.html', '')}"]`, datei, titel, 'Einstellungen › Profil');
    await ctx.close();
  }
}

// 3) Einwilligungsdialog Gesundheitsstatus
{
  const d = daten(); d.gesundheitIds = [];
  const { ctx, page } = await seite('spieler', { daten: d });
  await page.click('[data-st-erlauben]'); await page.waitForTimeout(400);
  const vor = await page.evaluate(() => {
    const ov = document.getElementById('gesundheitBlatt');
    const a = ov && ov.querySelector('a[href]');
    return { offen: !!ov, link: a && a.getAttribute('href'), haken: !!(ov && ov.querySelector('input[type=checkbox][data-ge-alter]')),
             text: ov && ov.querySelector('.auth-check span').textContent, gesperrt: ov && ov.querySelector('[data-ge-ja]').disabled };
  });
  pruefe(vor.offen && vor.link === 'datenschutz.html#spielerstatus', 'Dialog: Verweis auf Abschnitt 3d', JSON.stringify(vor));
  pruefe(vor.haken && vor.text === 'Ich bin mindestens 16 Jahre alt oder ein Erziehungsberechtigter ist einverstanden.', 'Dialog: Pflicht-Haken mit dem Wortlaut', vor.text);
  pruefe(vor.gesperrt, 'Dialog: Erlauben gesperrt ohne Haken');
  await page.click('[data-ge-ja]', { force: true }); await page.waitForTimeout(300);
  await page.evaluate(() => { const b = document.querySelector('[data-ge-ja]'); b.disabled = false; b.click(); });   // auch erzwungen kein Aufruf
  await page.waitForTimeout(300);
  const ohne = await page.evaluate(() => (window.__dbProtokoll || []).filter((x) => x.methode === 'einwilligungSetzen').length);
  pruefe(ohne === 0, 'Dialog: ohne Haken keine Einwilligung', ohne);
  await page.click('#gesundheitBlatt .auth-check'); await page.waitForTimeout(200);
  pruefe(await page.evaluate(() => !document.querySelector('[data-ge-ja]').disabled), 'Dialog: mit Haken Erlauben frei');
  await page.click('[data-ge-ja]'); await page.waitForTimeout(500);
  const mit = await page.evaluate(() => (window.__dbProtokoll || []).filter((x) => x.methode === 'einwilligungSetzen').map((x) => x.argumente[0] + ':' + x.argumente[1]));
  pruefe(JSON.stringify(mit) === JSON.stringify(['gesundheit:true']), 'Dialog: mit Haken Einwilligung gespeichert', JSON.stringify(mit));
  await ctx.close();
}
{
  // Onboarding: Gesundheit an, ohne Haken kein Weiter; ohne Gesundheit kein Haken noetig
  const { ctx, page } = await seite('wartend');
  await page.click('[data-ob-ds]');
  pruefe(await page.evaluate(() => !document.querySelector('[data-ob="datenschutz"]').disabled && document.querySelector('[data-ob-alter-wrap]').hidden), 'Onboarding: ohne Gesundheit kein Haken nötig');
  await page.click('[data-ob-ge]');
  pruefe(await page.evaluate(() => document.querySelector('[data-ob="datenschutz"]').disabled), 'Onboarding: Gesundheit an, Weiter gesperrt ohne Haken');
  pruefe(await page.evaluate(() => (document.querySelector('[data-ob-alter-wrap] a') || {}).getAttribute && document.querySelector('[data-ob-alter-wrap] a').getAttribute('href')) === 'datenschutz.html#spielerstatus', 'Onboarding: Verweis auf Abschnitt 3d');
  await page.screenshot({ path: '.design-sync/rechtliches/einwilligung-onboarding-390.png', fullPage: true });
  await page.click('.ob-card .auth-check'); await page.click('[data-ob="datenschutz"]'); await page.waitForTimeout(400);
  const w = await page.evaluate(() => (window.__dbProtokoll || []).filter((x) => x.methode === 'einwilligungSetzen').map((x) => x.argumente[0] + ':' + x.argumente[1]));
  pruefe(JSON.stringify(w) === JSON.stringify(['datenschutz:true', 'gesundheit:true']), 'Onboarding: mit Haken beide Einwilligungen', JSON.stringify(w));
  await ctx.close();
}

// 4) Startprotokoll ohne Tokens (18.10.2026): Reset-/Bestaetigungslink und Einladung
//    duerfen weder im lokalen Speicher (fnboot, fnboot_prev) noch im Protokoll-Objekt
//    noch im Inhalt von "Bericht kopieren" auftauchen. Ein aelteres, unmaskiertes
//    Protokoll wird beim Start bereinigt.
for (const [art, ziel] of [
  ['Reset-Link', '?code=GEHEIM789#access_token=GEHEIM123&expires_in=3600&refresh_token=GEHEIM456&token_type=bearer&type=recovery'],
  ['Einladung', '#einladung=GEHEIMEINL0815'],
]) {
  const ctx = await kontext();
  const page = await ctx.newPage();
  await installiere(page, 'anmeldung');
  await page.goto(basis); await page.waitForTimeout(800);
  await page.evaluate(() => localStorage.setItem('fnboot', JSON.stringify({ build: 'alt', url: 'https://x.example/#access_token=ALTGEHEIM1&refresh_token=ALTGEHEIM2', phases: [], errors: [] })));
  await page.goto(basis + ziel); await page.waitForTimeout(1500);
  await page.reload(); await page.waitForTimeout(1200);   // zweiter Start: das eben geschriebene Protokoll wandert nach fnboot_prev
  const r = await page.evaluate(() => {
    const k = localStorage.getItem('fnboot') || '', p = localStorage.getItem('fnboot_prev') || '';
    // genau das, was "Bericht kopieren" (diagBerichtKopieren) zusammenstellt
    const bericht = JSON.stringify({ app: window.__APP_BUILD, html: window.__HTML_BUILD || null, aktuell: window.__bootL || null, vorher: p });
    return { k, p, bericht, url: (window.__bootL || {}).url || '' };
  });
  const alles = r.k + r.p + r.bericht;
  pruefe(!/GEHEIM/.test(alles), `Startprotokoll ${art}: kein Token in Speicher, Protokoll und Bericht`, (alles.match(/.{30}GEHEIM.{10}/) || [''])[0]);
  pruefe(/(access_token|einladung)=\*\*\*/.test(r.p + r.k), `Startprotokoll ${art}: Token sichtbar maskiert`, r.p.slice(0, 200));
  await ctx.close();
}

// 5) Keine fremden Hosts
pruefe(fremd.size === 0, 'keine Anfrage an einen fremden Host', [...fremd].join(', '));

await browser.close(); server.close();
console.log(fehler.length ? `\n--- ${fehler.length} Beanstandung(en) ---` : '\n--- bestanden ---');
process.exit(fehler.length ? 1 : 0);
