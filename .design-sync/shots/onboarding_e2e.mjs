/* Onboarding: Durchlauf des ganzen Wegs gegen die ECHTE Datenbank (lokal
   ausgeliefert, echte config.js). NICHT auf der Pflichtliste: legt
   Testkonten an (Gmail-Plus-Adressen) und raeumt am Ende alles wieder weg.

   Schutz:
   - Die fuenf Push-Vorlagen des Onboardings und der Kasse sind waehrend des Laufs aus
     (aktiv = false): keine Mitteilung an echte Geraete.
   - Kein Testkonto wird einem echten Kadereintrag zugeordnet; die Zuordnung
     laeuft auf einen eigens angelegten Testeintrag.
   - PayPal-Name der Mannschaft und Vorlagen werden am Ende wiederhergestellt.
   - Aufraeumen auch bei Fehlern (finally) und Vergleich mit dem Ausgangsstand.

   Aufruf: node .design-sync/shots/onboarding_e2e.mjs <bilderordner>        */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { starte } from './server.mjs';

const SQLWERK = 'C:/Users/Benjamin/fussball-app-db/werkzeug/sql.mjs';
const OUT = process.argv[2] || '.';
const lauf = crypto.randomBytes(3).toString('hex');
const mail = (wer) => `wplauck+fne2e${lauf}${wer}@gmail.com`;
const PW = 'E2e-' + crypto.randomBytes(9).toString('base64url');
const cfg = fs.readFileSync('config.js', 'utf8');
const SUPA_URL = (cfg.match(/SUPABASE_URL\s*=\s*["']([^"']+)/) || [])[1];
const SUPA_KEY = (cfg.match(/SUPABASE_KEY\s*=\s*["']([^"']+)/) || [])[1];

const ergebnis = [];
const pruefe = (ok, text, detail) => { ergebnis.push({ ok: !!ok, text, detail: ok ? undefined : detail }); console.log((ok ? '  ok   ' : '  FEHL ') + text + (detail !== undefined && !ok ? '   ' + detail : '')); };
function sql(text) {
  const aus = execFileSync('node', [SQLWERK, '-e', text], { encoding: 'utf8' });
  const zeilen = aus.split(/\r?\n/).filter((z) => z.trim() && !/^\(\d+ Zeilen?\)$/.test(z.trim()) && !/^-- /.test(z) && !/^NOTICE/.test(z));
  return zeilen.slice(1).map((z) => z.split(' | ').map((x) => x.trim()));
}
const eins = (text) => { const r = sql(text); return r.length ? r[0][0] : null; };
async function rest(pfad, token, body) {
  const r = await fetch(SUPA_URL + '/rest/v1/' + pfad, {
    method: body ? 'POST' : 'GET',
    headers: { apikey: SUPA_KEY, Authorization: 'Bearer ' + (token || SUPA_KEY), 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  let daten = null; try { daten = await r.json(); } catch (e) {}
  return { status: r.status, daten };
}
const bild = (page, name) => page.screenshot({ path: path.join(OUT, name + '.png'), fullPage: true }).catch(() => {});

const STAND = `select (select count(*) from auth.users) || '/' || (select count(*) from profiles) || '/' || (select count(*) from players) || '/' || (select count(*) from fines) || '/' || (select count(*) from rsvps) || '/' || (select count(*) from player_status) || '/' || (select count(*) from einladungen) || '/' || (select count(*) from konto_protokoll) || '/' || (select count(*) from einwilligungen) || '/' || (select count(*) from notification_outbox) || '/' || (select count(*) from notification_sammler) || '/' || (select paypal_name || ':' || coalesce(paypal_von::text, '-') from team_settings) || '/' || (select string_agg(aktiv::text, ',' order by kategorie) from notification_templates where kategorie in ('anfrage_neu','konto_freigegeben','rolle_geaendert','kasse_neu','kasse_abgegeben'))`;
const vorher = eins(STAND);
// Eindeutige Spaltennamen: sql.mjs fasst gleichnamige Spalten zusammen.
const paypalAlt = sql("select paypal_name as n, coalesce(paypal_von::text, '') as v, coalesce(paypal_am::text, '') as a from team_settings")[0];
console.log('PayPal vorher', JSON.stringify(paypalAlt));
const start = eins("select now()::text");
console.log('Ausgangsstand', vorher);

const { server, basis } = await starte(process.cwd());
const browser = await chromium.launch({ channel: 'chrome' });
const neueSeite = async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'de-DE', timezoneId: 'Europe/Berlin', serviceWorkers: 'block' });
  const page = await ctx.newPage();
  page.on('dialog', (d) => { console.log('  dialog ' + d.message().replace(/\s+/g, ' ').slice(0, 160)); d.accept().catch(() => {}); });
  return { ctx, page };
};
async function anmelden(page, email) {
  await page.goto(basis); await page.waitForSelector('#authForm', { timeout: 20000 });
  await page.fill('input[name=email]', email); await page.fill('input[name=password]', PW);
  await page.click('.auth-submit'); await page.waitForTimeout(2500);
}
// Warten, bis das Element sichtbar ist, dann klicken (gegen die echte Datenbank laden Listen unterschiedlich schnell).
const klick = async (page, sel) => { await page.waitForSelector(sel, { state: 'visible', timeout: 20000 }); await page.click(sel); };
const titel = (page) => page.evaluate(() => (document.querySelector('#view h1') || {}).textContent || '');
const token = (page) => page.evaluate(() => { for (const k of Object.keys(localStorage)) if (/-auth-token$/.test(k)) { try { return JSON.parse(localStorage.getItem(k)).access_token; } catch (e) {} } return null; });

let trainerId = null, aId = null, bId = null, frei = null, trPl = null;
let admId = null, tlId = null, kw1Id = null, kw2Id = null;
// Testkonto mit Passwort direkt anlegen (Registrierung ist im Dashboard gesperrt); derselbe Trigger handle_new_user prueft den Link.
function anlegen(wer, meta) {
  const id = crypto.randomUUID();
  sql(`insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change, email_change_token_current, phone_change, phone_change_token, reauthentication_token)
       values ('${id}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '${mail(wer)}', extensions.crypt('${PW}', extensions.gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}', '${JSON.stringify(meta)}', now(), now(), '', '', '', '', '', '', '', '')`);
  sql(`insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
       values (gen_random_uuid(), '${id}', '${id}', jsonb_build_object('sub', '${id}', 'email', '${mail(wer)}', 'email_verified', true), 'email', now(), now(), now())`);
  return id;
}
try {
  // ---- Aufbau --------------------------------------------------------------
  sql("update notification_templates set aktiv = false where kategorie in ('anfrage_neu','konto_freigegeben','rolle_geaendert','kasse_neu','kasse_abgegeben')");
  const t0 = 'e2e' + crypto.randomBytes(12).toString('hex');
  sql(`insert into einladungen (club_id, token) select id, '${t0}' from clubs where slug = 'fcfn'`);
  // Test-Trainer direkt anlegen (ohne Mail), Kadereintrag nur fuer den Test.
  trainerId = crypto.randomUUID();
  sql(`insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change, email_change_token_current, phone_change, phone_change_token, reauthentication_token)
       values ('${trainerId}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '${mail('trainer')}', extensions.crypt('${PW}', extensions.gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}', '{"name":"E2E Trainer","einladung":"${t0}"}', now(), now(), '', '', '', '', '', '', '', '')`);
  sql(`insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
       values (gen_random_uuid(), '${trainerId}', '${trainerId}', jsonb_build_object('sub', '${trainerId}', 'email', '${mail('trainer')}', 'email_verified', true), 'email', now(), now(), now())`);
  trPl = eins(`insert into players (club_id, code, name, hauptposition) select id, 'e2etr${lauf}', 'E2E Trainer', 'mittelfeld' from clubs where slug = 'fcfn' returning id`);
  sql(`update profiles set freigabe = 'aktiv', player_id = '${trPl}' where id = '${trainerId}'`);
  sql(`insert into user_roles (user_id, role, club_id) select '${trainerId}', 'coach', id from clubs where slug = 'fcfn'`);
  frei = eins(`insert into players (club_id, code, name) select id, 'e2efr${lauf}', 'E2E Kader Frei' from clubs where slug = 'fcfn' returning id`);

  // ---- 1) Trainer: einmalige Datenschutzfrage, Einladung, Link erneuern ----
  const T = await neueSeite();
  await anmelden(T.page, mail('trainer'));
  pruefe(await titel(T.page) === 'Datenschutz', 'bestehendes Konto ohne Zustimmung: einmalige Datenschutzfrage', await titel(T.page));
  await bild(T.page, '01_trainer_datenschutz');
  await T.page.click('[data-ob-ds]'); await T.page.click('[data-ob="datenschutz"]'); await T.page.waitForTimeout(3000);
  pruefe(await T.page.evaluate(() => !!document.querySelector('.app-nav') && getComputedStyle(document.querySelector('.app-nav')).display !== 'none'), 'nach Zustimmung die App');
  await T.page.evaluate(() => { location.hash = '#ansicht=admin'; }); await T.page.waitForTimeout(3000);
  const link0 = await T.page.evaluate(() => { const e = [...document.querySelectorAll('.ein-schalter-s')].find((x) => /#einladung=/.test(x.textContent)); return e ? e.textContent : ''; });
  pruefe(link0.endsWith('#einladung=' + t0), 'Rollen verwalten zeigt den Einladungslink', link0);
  await bild(T.page, '02_trainer_rollen');
  await T.page.click('[data-mf="erneuern"]'); await T.page.waitForTimeout(2500);
  const link1 = await T.page.evaluate(() => { const e = [...document.querySelectorAll('.ein-schalter-s')].find((x) => /#einladung=/.test(x.textContent)); return e ? e.textContent : ''; });
  const t1 = (link1.split('#einladung=')[1] || '').trim();
  pruefe(t1 && t1 !== t0, 'Link erneuert', link1);
  const p0 = await rest('rpc/einladung_pruefen', null, { p_token: t0 }), p1 = await rest('rpc/einladung_pruefen', null, { p_token: t1 });
  pruefe(p0.daten && p0.daten.gueltig === false && p1.daten && p1.daten.gueltig === true, 'alter Link ungültig, neuer gültig (anon per API)', JSON.stringify([p0, p1]));

  // ---- 2) Registrierung mit altem Link scheitert, mit neuem klappt --------
  const X = await neueSeite();
  await X.page.goto(basis + '#einladung=' + t0); await X.page.waitForTimeout(3000);
  const xFehler = await X.page.evaluate(() => (document.querySelector('.auth-error') || {}).textContent || '');
  pruefe(/nicht mehr gültig/.test(xFehler) && await titel(X.page) === 'Anmelden', 'alter Link: Hinweis, keine Registrierung', xFehler);
  await bild(X.page, '03_alter_link');
  await X.ctx.close();

  const A = await neueSeite();
  await A.page.goto(basis + '#einladung=' + t1); await A.page.waitForTimeout(3000);
  pruefe(await titel(A.page) === 'Konto erstellen', 'neuer Link: Registrierung mit Name', await titel(A.page));
  await bild(A.page, '04_registrieren');
  await A.page.fill('input[name=name]', 'E2E Spieler'); await A.page.fill('input[name=email]', mail('spieler')); await A.page.fill('input[name=password]', PW);
  await A.page.click('.auth-submit'); await A.page.waitForTimeout(4000);
  aId = eins(`select id from auth.users where email = '${mail('spieler')}'`);
  const regFehler = await A.page.evaluate(() => (document.querySelector('.auth-error') || {}).textContent || '');
  if (!aId && /gesperrt/.test(regFehler)) {
    // Supabase-Dashboard: "Allow new users to sign up" ist aus (signup_disabled).
    // Die Maske meldet das verstaendlich; das Konto wird dann mit denselben
    // Metadaten per SQL angelegt - derselbe Trigger handle_new_user prueft
    // Einladung und Namen. Dashboard-Schritt im Bericht.
    pruefe(true, 'Registrierung im Dashboard gesperrt: verständliche Meldung in der Maske');
    console.log('  info  Registrierung im Supabase-Dashboard gesperrt, Konto per SQL mit Einladung angelegt');
    aId = crypto.randomUUID();
    sql(`insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
          confirmation_token, recovery_token, email_change_token_new, email_change, email_change_token_current, phone_change, phone_change_token, reauthentication_token)
         values ('${aId}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '${mail('spieler')}', extensions.crypt('${PW}', extensions.gen_salt('bf')), now(),
          '{"provider":"email","providers":["email"]}', '{"name":"E2E Spieler","einladung":"${t1}"}', now(), now(), '', '', '', '', '', '', '', '')`);
    sql(`insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
         values (gen_random_uuid(), '${aId}', '${aId}', jsonb_build_object('sub', '${aId}', 'email', '${mail('spieler')}', 'email_verified', true), 'email', now(), now(), now())`);
    await anmelden(A.page, mail('spieler'));
  } else {
    pruefe(!!aId, 'Konto über die Registrierung angelegt', regFehler);
    const info = await A.page.evaluate(() => (document.querySelector('.auth-info') || {}).textContent || '');
    const mitBestaetigung = /bestätige/.test(info);
    console.log('  info  E-Mail-Bestätigung im Dashboard ' + (mitBestaetigung ? 'AN (Konto per SQL bestätigt, nur Testkonto)' : 'AUS'));
    if (mitBestaetigung) { sql(`update auth.users set email_confirmed_at = now() where id = '${aId}'`); await anmelden(A.page, mail('spieler')); }
  }
  pruefe(eins(`select freigabe || '/' || anzeigename from profiles where id = '${aId}'`) === 'wartet/E2E Spieler', 'neues Konto wartet, Name aus der Registrierung');
  pruefe(await titel(A.page) === 'Datenschutz', 'Onboarding beginnt mit Datenschutz', await titel(A.page));
  pruefe(await A.page.evaluate(() => document.querySelector('[data-ob="datenschutz"]').disabled), 'ohne Zustimmung kein Weiter');
  await A.page.click('[data-ob-ds]'); await A.page.click('[data-ob-ge]'); await bild(A.page, '05_ob_datenschutz');
  await A.page.click('[data-ob="datenschutz"]'); await A.page.waitForTimeout(2500);
  pruefe(await titel(A.page) === 'Deine Position', 'Schritt Position', await titel(A.page));
  await A.page.click('[data-ob-pos="abwehr"]'); await A.page.click('[data-ob="position"]'); await A.page.waitForTimeout(2500);
  pruefe(await titel(A.page) === 'Zum Home-Bildschirm', 'Schritt Home-Bildschirm (im Browser, nicht installiert)', await titel(A.page));
  await bild(A.page, '06_ob_home');
  // Abbrechen und spaeter fortsetzen
  await A.page.click('[data-ob="spaeter"]'); await A.page.waitForTimeout(2000);
  pruefe(await titel(A.page) === 'Anmelden', 'Später weitermachen meldet ab');
  await anmelden(A.page, mail('spieler'));
  pruefe(await titel(A.page) === 'Zum Home-Bildschirm', 'Fortsetzen beim offenen Schritt', await titel(A.page));
  await A.page.click('[data-ob="home"]'); await A.page.waitForTimeout(1500);
  pruefe(await titel(A.page) === 'Warte auf Freigabe', 'Wartebildschirm', await titel(A.page));
  await bild(A.page, '07_ob_warten');
  pruefe(eins(`select wunsch_position || '/' || freigabe from profiles where id = '${aId}'`) === 'abwehr/wartet', 'Position und Freigabestatus gespeichert');
  pruefe(eins(`select count(*) from einwilligungen where profile_id = '${aId}' and widerrufen_am is null`) === '2', 'zwei Einwilligungen mit Fassung gespeichert');

  // ---- 3) Wartendes Konto: kein Datenzugriff, auch direkt per API ----------
  const ta = await token(A.page);
  const api = {};
  for (const t of ['events', 'players', 'fines', 'fine_catalog', 'rsvps', 'player_status', 'team_settings', 'clubs', 'lineups']) {
    const r = await rest(t + '?select=*', ta); api[t] = Array.isArray(r.daten) ? r.daten.length : r.status;
  }
  pruefe(Object.values(api).every((x) => x === 0), 'wartendes Konto liest per API nichts', JSON.stringify(api));
  const rl = await rest('rpc/anfragen_liste', ta, {}), rr = await rest('rpc/my_roles', ta, {}), rk = await rest('rpc/my_calendar_token', ta, {});
  pruefe(rl.status >= 400 && Array.isArray(rr.daten) && rr.daten.length === 0 && rk.status >= 400, 'Anfragen, Rollen, Kalender-Token gesperrt', JSON.stringify([rl.status, rr.daten, rk.status]));

  // ---- 4) Zweite Anfrage (per SQL angelegt) wird abgelehnt -----------------
  bId = crypto.randomUUID();
  sql(`insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values ('${bId}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '${mail('abgelehnt')}', '{"name":"E2E Abgelehnt","einladung":"${t1}"}', now(), now())`);
  await T.page.evaluate(() => { location.hash = '#ansicht=dashboard'; }); await T.page.waitForTimeout(800);
  await T.page.evaluate(() => { location.hash = '#ansicht=admin'; }); await T.page.waitForTimeout(3000);
  const anfragen = await T.page.evaluate(() => [...document.querySelectorAll('[data-mf-anfrage]')].map((e) => e.dataset.mfAnfrage));
  pruefe(anfragen.indexOf(aId) >= 0 && anfragen.indexOf(bId) >= 0, 'beide Anfragen in der Liste', JSON.stringify(anfragen));
  await T.page.click(`[data-mf-anfrage="${bId}"]`); await T.page.waitForTimeout(1500);
  await bild(T.page, '08_freigabe_blatt');
  await T.page.click('#freigabeBlatt [data-fg="ablehnen"]'); await T.page.waitForTimeout(3000);
  pruefe(eins(`select freigabe from profiles where id = '${bId}'`) === 'abgelehnt', 'Ablehnung gespeichert');
  // ---- 5) Freigabe mit Zuordnung zum Testeintrag -----------------------------
  await T.page.click(`[data-mf-anfrage="${aId}"]`); await T.page.waitForTimeout(1500);
  const wahlDa = await T.page.evaluate((id) => !!document.querySelector(`#freigabeBlatt [data-fg-wahl="${id}"]`), frei);
  pruefe(wahlDa, 'Testeintrag ohne Konto steht zur Wahl');
  await T.page.click(`#freigabeBlatt [data-fg-wahl="${frei}"]`); await T.page.click('#freigabeBlatt [data-fg="freigeben"]'); await T.page.waitForTimeout(3500);
  pruefe(eins(`select freigabe || '/' || player_id from profiles where id = '${aId}'`) === 'aktiv/' + frei, 'freigegeben und dem Kadereintrag zugeordnet');
  pruefe(eins(`select hauptposition from players where id = '${frei}'`) === 'abwehr', 'Position aus dem Onboarding im Kader');
  // ---- 6) Abgelehnt sieht seinen Bildschirm ---------------------------------
  // ---- 7) Spieler nach Freigabe ----------------------------------------------
  await A.page.click('[data-ob="pruefen"]'); await A.page.waitForTimeout(4000);
  pruefe(await A.page.evaluate(() => !!document.querySelector('.app-nav') && getComputedStyle(document.querySelector('.app-nav')).display !== 'none'), 'nach Freigabe: App mit Navigation');
  const apiNach = await rest('events?select=id', await token(A.page));
  pruefe(Array.isArray(apiNach.daten) && apiNach.daten.length > 0, 'nach Freigabe liest das Konto die Termine');
  await bild(A.page, '09_spieler_app');
  // ---- 8) Rollenvergabe: Kassenwart, PayPal-Frage, Entzug --------------------
  await T.page.click(`[data-mf-mitglied="${aId}"]`); await T.page.waitForTimeout(1200);
  await bild(T.page, '10_rolle_blatt');
  await T.page.click('#rolleBlatt [data-rl="treasurer"]'); await T.page.waitForTimeout(2500);
  pruefe(eins(`select count(*) from user_roles where user_id = '${aId}' and role = 'treasurer'`) === '1', 'Trainer vergibt Kassenwart');
  pruefe(!(await T.page.evaluate(() => !!document.querySelector('#rolleBlatt [data-rl="admin"]'))), 'Trainer sieht keinen Admin-Schalter');
  await T.page.click('#rolleBlatt [data-nsb-zu].nsb-prim'); await T.page.waitForTimeout(800);
  await A.page.reload(); await A.page.waitForTimeout(5000);
  pruefe(await A.page.evaluate(() => !!document.getElementById('paypalBlatt')), 'neuer Kassenwart wird nach dem PayPal-Link gefragt');
  await bild(A.page, '11_paypal_frage');
  await A.page.fill('#paypalBlatt [data-pp-name]', 'https://paypal.me/E2ETestKasse'); await A.page.click('#paypalBlatt [data-pp-speichern]'); await A.page.waitForTimeout(2500);
  pruefe(eins(`select paypal_name || '/' || paypal_von from team_settings`) === 'E2ETestKasse/' + aId, 'PayPal-Link der Kasse gesetzt');
  await T.page.click(`[data-mf-mitglied="${aId}"]`); await T.page.waitForTimeout(1200);
  await T.page.click('#rolleBlatt [data-rl="treasurer"]'); await T.page.waitForTimeout(2500);
  pruefe(eins(`select coalesce(paypal_name, '-') from team_settings`) === '-', 'Rollenentzug: Link des bisherigen Kassenwarts weg');
  await T.page.click('#rolleBlatt [data-nsb-zu].nsb-prim'); await T.page.waitForTimeout(800);
  // ---- 9) Einwilligung Gesundheit: Status setzen, widerrufen, erneut fragen -----
  await A.page.reload(); await A.page.waitForTimeout(5000);
  await A.page.click('.st-knopf.st-verletzt'); await A.page.waitForTimeout(1000);
  pruefe(await A.page.evaluate(() => !!document.getElementById('statusFenster')), 'mit Einwilligung: Status-Blatt');
  pruefe(await A.page.evaluate(() => document.querySelector('[data-sf-notiz]').placeholder) === 'optional, keine Diagnosen', 'Hinweis am Notizfeld');
  await A.page.fill('[data-sf-notiz]', 'Test'); await A.page.click('[data-sf-speichern]'); await A.page.waitForTimeout(2500);
  pruefe(eins(`select status || '/' || coalesce(status_note, '-') from player_status where player_id = '${frei}'`) === 'verletzt/Test', 'Status verletzt gespeichert');
  await A.page.evaluate(() => { location.hash = '#ein=profil'; }); await A.page.waitForTimeout(1500);
  await bild(A.page, '12_profil');
  const bisVorher = eins(`select coalesce(status_until::text, '-') from player_status where player_id = '${frei}'`);
  await A.page.click('[data-pr-gesundheit]'); await A.page.waitForTimeout(3500);
  // Nacharbeit 2 (0062): Widerruf wandelt in "nicht verfügbar", Notiz weg, Datum bleibt.
  pruefe(eins(`select status || '/' || coalesce(status_note, '-') || '/' || coalesce(status_until::text, '-') from player_status where player_id = '${frei}'`) === 'nicht_verfuegbar/-/' + bisVorher, 'Widerruf wandelt in nicht verfügbar, Notiz weg, Datum bleibt');
  pruefe(eins(`select count(*) from einwilligungen where profile_id = '${aId}' and art = 'gesundheit' and widerrufen_am is not null`) === '1', 'Widerruf mit Zeitpunkt gespeichert');
  await A.page.evaluate(() => { location.hash = '#ansicht=dashboard'; }); await A.page.waitForTimeout(1500);
  const ohneE = await A.page.evaluate(() => ({ k: [...document.querySelectorAll('.st-raster .st-knopf')].map((b) => b.dataset.wert), h: !!document.querySelector('[data-st-erlauben]') }));
  pruefe(JSON.stringify(ohneE.k) === JSON.stringify(['fit', 'nicht_verfuegbar', 'urlaub']) && ohneE.h, 'ohne Einwilligung: nur fit, nicht verfügbar, Urlaub und Hinweis', JSON.stringify(ohneE));
  const verletztApi = await rest('rpc/set_player_status', await token(A.page), { p_player_id: frei, p_status: 'verletzt', p_note: null, p_until: null });
  pruefe(verletztApi.status >= 400, 'ohne Einwilligung: verletzt auch per API abgelehnt', verletztApi.status);
  await A.page.click('[data-st-erlauben]'); await A.page.waitForTimeout(800);
  pruefe(await A.page.evaluate(() => !!document.getElementById('gesundheitBlatt')), 'Erlauben öffnet die Einwilligung');
  await A.page.click('#gesundheitBlatt [data-nsb-zu].nsb-sek'); await A.page.waitForTimeout(500);
  // Position im Profil aendern
  await A.page.evaluate(() => { location.hash = '#ein=profil'; }); await A.page.waitForTimeout(1500);
  await A.page.click('[data-pr-position]'); await A.page.waitForTimeout(800);
  await A.page.click('#positionBlatt [data-po="sturm"]'); await A.page.click('#positionBlatt [data-po-speichern]'); await A.page.waitForTimeout(2500);
  pruefe(eins(`select hauptposition from players where id = '${frei}'`) === 'sturm', 'Position im Profil geändert');
  // ---- 10) Konto loeschen mit Anonymisierung ------------------------------------
  sql(`insert into fines (club_id, player_id, date, offense, base_amount, status, note) select id, '${frei}', current_date, 'E2E Strafe', 5, 'offen', 'privat' from clubs where slug = 'fcfn'`);
  sql(`insert into rsvps (club_id, event_id, player_id, status) select c.id, (select id from events order by date desc limit 1), '${frei}', 'zu' from clubs c where c.slug = 'fcfn'`);
  await A.page.click('[data-pr-konto-weg]'); await A.page.waitForTimeout(800);
  await bild(A.page, '13_konto_loeschen');
  await A.page.click('#kontoWegBlatt [data-kl]'); await A.page.waitForTimeout(4000);
  pruefe(/gelöscht/.test(await A.page.evaluate(() => (document.querySelector('.auth-info') || {}).textContent || '')), 'nach dem Löschen: Anmeldung mit Hinweis');
  pruefe(eins(`select count(*) from auth.users where id = '${aId}'`) === '0', 'Konto gelöscht');
  pruefe(eins(`select name || '/' || (ausgeschieden_am is not null) || '/' || coalesce(number::text, '-') from players where id = '${frei}'`) === 'Ehemaliger Spieler/true/-', 'Kadereintrag anonymisiert');
  pruefe(eins(`select sum(base_amount)::text || '/' || count(note) from fines where player_id = '${frei}'`) === '5.00/0', 'Kasse behält den Betrag ohne Notiz');
  pruefe(eins(`select count(*) from rsvps where player_id = '${frei}'`) === '0', 'Rückmeldungen gelöscht');
  pruefe(eins(`select count(*) from konto_protokoll where ziel = '${aId}' and ziel_name <> 'gelöschtes Konto'`) === '0', 'Protokoll ohne Namen des gelöschten Kontos');
  // ---- 11) Protokoll beim Trainer ------------------------------------------------
  await T.page.evaluate(() => { location.hash = '#ansicht=dashboard'; }); await T.page.waitForTimeout(800);
  await T.page.evaluate(() => { location.hash = '#ansicht=admin'; }); await T.page.waitForTimeout(3000);
  const prot = await T.page.evaluate(() => document.body.innerText);
  pruefe(/Konto gelöscht/.test(prot) && /freigegeben/.test(prot) && /abgelehnt/.test(prot) && /Rolle vergeben/.test(prot) && /Einladungslink erneuert/.test(prot), 'Protokoll zeigt Freigabe, Ablehnung, Rolle, Einladung, Löschung');
  await bild(T.page, '14_protokoll');
  await A.ctx.close();

  // ======================= Onboarding Nacharbeit =======================
  // ---- 12) Keine fremden Hosts beim Start (vor der Anmeldung) -----------------
  {
    const H = await neueSeite();
    const hosts = new Set();
    H.page.on('request', (r) => { try { hosts.add(new URL(r.url()).host); } catch (e) {} });
    await H.page.goto(basis); await H.page.waitForTimeout(3500);
    const eigen = new URL(basis).host;
    const fremd = [...hosts].filter((h) => h !== eigen);
    pruefe(fremd.length === 0, 'Start ohne fremde Hosts (nur ' + eigen + ')', JSON.stringify([...hosts]));
    await H.ctx.close();
  }

  // ---- 13) Trainer kann den PayPal-Link nicht ändern (API) ----------------------
  {
    const tt = await token(T.page);
    const r1 = await rest('rpc/paypal_setzen', tt, { p_name: 'E2ETrainerKasse' });
    const r2 = await fetch(SUPA_URL + '/rest/v1/team_settings?club_id=not.is.null', { method: 'PATCH',
      headers: { apikey: SUPA_KEY, Authorization: 'Bearer ' + tt, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({ paypal_name: 'E2ETrainerKasse' }) });
    const r2d = await r2.json().catch(() => null);
    pruefe(r1.status >= 400 && Array.isArray(r2d) && r2d.length === 0 && eins("select coalesce(paypal_name, '-') from team_settings") !== 'E2ETrainerKasse',
      'Trainer ändert den PayPal-Link weder per RPC noch direkt', JSON.stringify([r1.status, r2.status, r2d]));
    await T.page.evaluate(() => { location.hash = '#ein=profil'; }); await T.page.waitForTimeout(1500);
    pruefe(!(await T.page.evaluate(() => !!document.querySelector('[data-pr-paypal]'))), 'Trainer sieht keinen PayPal-Link zum Ändern');
    const selbst = await rest('rpc/rolle_setzen', tt, { p_profil: trainerId, p_rolle: 'treasurer', p_an: true, p_trotzdem: false });
    pruefe(selbst.status >= 400 && eins(`select count(*) from user_roles where user_id = '${trainerId}' and role = 'treasurer'`) === '0', 'Trainer gibt sich nicht selbst Kassenwart (Umweg zum PayPal-Link, 0069)', selbst.status);
  }

  // ---- 14) Trainer-Link: nur Admin, einmalig, abgelaufen, widerrufen -------------
  admId = anlegen('admin', { name: 'E2E Admin', einladung: t1 });
  sql(`update profiles set freigabe = 'aktiv' where id = '${admId}'`);
  sql(`insert into user_roles (user_id, role, club_id) select '${admId}', 'admin', id from clubs where slug = 'fcfn'`);
  sql(`insert into einwilligungen (profile_id, art, fassung) values ('${admId}', 'datenschutz', 'DS-2026-10')`);
  const AD = await neueSeite();
  await anmelden(AD.page, mail('admin'));
  await AD.page.evaluate(() => { location.hash = '#ansicht=admin'; }); await AD.page.waitForTimeout(3500);
  pruefe(await AD.page.evaluate(() => [...document.querySelectorAll('.group-head h2')].some((e) => e.textContent === 'Trainer-Links')), 'Admin sieht Trainer-Links');
  const trSieht = await T.page.evaluate(async () => { location.hash = '#ansicht=dashboard'; await new Promise((r) => setTimeout(r, 600)); location.hash = '#ansicht=admin'; await new Promise((r) => setTimeout(r, 3000));
    return [...document.querySelectorAll('.group-head h2')].some((e) => e.textContent === 'Trainer-Links'); });
  pruefe(!trSieht, 'Trainer sieht keine Trainer-Links');
  const trApi = await rest('rpc/trainer_link_erzeugen', await token(T.page), {});
  pruefe(trApi.status >= 400, 'Trainer erzeugt per API keinen Trainer-Link', trApi.status);
  await klick(AD.page, '[data-mf="tl-neu"]'); await AD.page.waitForTimeout(2500);
  await bild(AD.page, '15_trainer_link');
  const tlLink = await AD.page.evaluate(() => ((document.querySelector('#tlBlatt .tl-link') || {}).textContent || '').trim());
  const tlTok = (tlLink.split('#einladung=')[1] || '').trim();
  pruefe(tlTok.length >= 32 && eins(`select art || '/' || (gueltig_bis between now() + interval '6 days 23 hours' and now() + interval '7 days 1 minute') from einladungen where token = '${tlTok}'`) === 'trainer/true', 'Trainer-Link erzeugt, gilt 7 Tage', tlLink);
  await klick(AD.page, '#tlBlatt [data-nsb-zu].nsb-prim'); await AD.page.waitForTimeout(500);
  // Registrierungsmaske ueber den Trainer-Link
  const R = await neueSeite();
  await R.page.goto(basis + '#einladung=' + tlTok); await R.page.waitForTimeout(3000);
  const rm = await R.page.evaluate(() => ({ h: (document.querySelector('#view h1') || {}).textContent, sub: (document.querySelector('.auth-sub') || {}).textContent, kw: !!document.querySelector('input[name=kassenwart]') }));
  pruefe(rm.h === 'Konto erstellen' && /als Trainer/.test(rm.sub) && !rm.kw, 'Trainer-Link: Registrierung als Trainer, ohne Kassenwart-Haken', JSON.stringify(rm));
  await R.ctx.close();
  tlId = anlegen('trainerlink', { name: 'E2E Neuer Trainer', einladung: tlTok });
  pruefe(eins(`select p.freigabe || '/' || p.onboarding_offen || '/' || coalesce(p.player_id::text, '-') || '/' || (select string_agg(role, ',' order by role) from user_roles where user_id = p.id) from profiles p where p.id = '${tlId}'`) === 'aktiv/true/-/coach,player',
    'über Trainer-Link: sofort Spieler und Trainer, ohne Freigabe, ohne Kader');
  pruefe((await rest('rpc/einladung_pruefen', null, { p_token: tlTok })).daten.gueltig === false, 'Trainer-Link danach verbraucht');
  let zweimal = false; try { anlegen('trainerlink2', { name: 'E2E Zweiter', einladung: tlTok }); } catch (e) { zweimal = true; }
  pruefe(zweimal && eins(`select count(*) from auth.users where email = '${mail('trainerlink2')}'`) === '0', 'zweite Registrierung mit demselben Link scheitert');
  const TL = await neueSeite();
  await anmelden(TL.page, mail('trainerlink'));
  pruefe(await titel(TL.page) === 'Datenschutz', 'Trainer-Link-Konto: Onboarding beginnt mit Datenschutz', await titel(TL.page));
  {
    // Gegenpruefung (0069): vor der Datenschutz-Zustimmung keine Mannschaftsdaten, auch per API
    const ttl = await token(TL.page);
    const fz = await rest('fines?select=id&limit=5', ttl), az = await rest('rpc/anfragen_liste', ttl, {});
    pruefe(Array.isArray(fz.daten) && fz.daten.length === 0 && az.status >= 400, 'Trainer-Link-Konto vor der Zustimmung: keine Strafen, keine Anfragen (API)', JSON.stringify([fz.status, fz.daten && fz.daten.length, az.status]));
  }
  await klick(TL.page, '[data-ob-ds]'); await klick(TL.page, '[data-ob="datenschutz"]'); await TL.page.waitForTimeout(2500);
  await klick(TL.page, '[data-ob-pos="mittelfeld"]'); await klick(TL.page, '[data-ob="position"]'); await TL.page.waitForTimeout(3000);
  pruefe(await titel(TL.page) === 'Spielst du mit?', 'Schritt Spielst du mit', await titel(TL.page));
  await bild(TL.page, '16_spielst_du_mit');
  await klick(TL.page, '[data-ob-kader="neu"]'); await klick(TL.page, '[data-ob="kader"]'); await TL.page.waitForTimeout(2500);
  pruefe(eins(`select pl.name || '/' || pl.hauptposition from profiles p join players pl on pl.id = p.player_id where p.id = '${tlId}'`) === 'E2E Neuer Trainer/mittelfeld', 'neuer Kadereintrag mit Name und Position');
  await klick(TL.page, '[data-ob="home"]'); await TL.page.waitForTimeout(1500);
  pruefe(await titel(TL.page) === 'Alles bereit', 'Abschluss ohne Wartebildschirm', await titel(TL.page));
  await klick(TL.page, '[data-ob="fertig"]'); await TL.page.waitForTimeout(5000);
  pruefe(await TL.page.evaluate(() => !!document.querySelector('.app-nav') && getComputedStyle(document.querySelector('.app-nav')).display !== 'none') &&
         eins(`select onboarding_offen from profiles where id = '${tlId}'`) === 'false', 'danach die App, Onboarding abgeschlossen');
  // abgelaufen
  const tAb = (await rest('rpc/trainer_link_erzeugen', await token(AD.page), {})).daten.token;
  sql(`update einladungen set gueltig_bis = now() - interval '1 minute' where token = '${tAb}'`);
  let abgelaufen = false; try { anlegen('trainerlink3', { name: 'E2E Zu Spaet', einladung: tAb }); } catch (e) { abgelaufen = true; }
  pruefe(abgelaufen && (await rest('rpc/einladung_pruefen', null, { p_token: tAb })).daten.gueltig === false, 'abgelaufener Trainer-Link: ungültig, Registrierung scheitert');
  // widerrufen ueber die Oberflaeche
  await klick(AD.page, '[data-mf="tl-neu"]'); await AD.page.waitForTimeout(2500);
  const tWi = ((await AD.page.evaluate(() => ((document.querySelector('#tlBlatt .tl-link') || {}).textContent || ''))).split('#einladung=')[1] || '').trim();
  await klick(AD.page, '#tlBlatt [data-tl="widerrufen"]'); await AD.page.waitForTimeout(3000);
  let widerrufen = false; try { anlegen('trainerlink4', { name: 'E2E Widerrufen', einladung: tWi }); } catch (e) { widerrufen = true; }
  pruefe(widerrufen && eins(`select (widerrufen_am is not null)::text from einladungen where token = '${tWi}'`) === 'true', 'widerrufener Trainer-Link: Registrierung scheitert');
  await bild(AD.page, '17_trainer_links');

  // ---- 15) Kassenwart-Wunsch: bestätigt und abgelehnt ------------------------------
  const RK = await neueSeite();
  await RK.page.goto(basis + '#einladung=' + t1); await RK.page.waitForTimeout(3000);
  pruefe(await RK.page.evaluate(() => !!document.querySelector('#authForm input[name=kassenwart]')), 'Spieler-Link: Haken "Ich bin Kassenwart"');
  await bild(RK.page, '18_registrieren_kassenwart');
  await RK.ctx.close();
  kw1Id = anlegen('kasseja', { name: 'E2E Kasse Ja', einladung: t1, kassenwart: true });
  kw2Id = anlegen('kassenein', { name: 'E2E Kasse Nein', einladung: t1, kassenwart: true });
  const K2 = await neueSeite();
  await anmelden(K2.page, mail('kassenein'));
  const tk2 = await token(K2.page);
  const vorEntscheid = {};
  for (const t of ['fines', 'fine_status_log', 'team_settings']) { const r = await rest(t + '?select=*', tk2); vorEntscheid[t] = Array.isArray(r.daten) ? r.daten.length : r.status; }
  const ko = await rest('rpc/kassenwart_offen', tk2, { p_profil: kw2Id }), pp = await rest('rpc/paypal_setzen', tk2, { p_name: 'E2EWunsch' });
  pruefe(Object.values(vorEntscheid).every((x) => x === 0) && ko.status >= 400 && pp.status >= 400, 'unbestätigter Wunsch: per API keine Kassendaten, kein PayPal', JSON.stringify([vorEntscheid, ko.status, pp.status]));
  await T.page.evaluate(() => { location.hash = '#ansicht=dashboard'; }); await T.page.waitForTimeout(800);
  await T.page.evaluate(() => { location.hash = '#ansicht=admin'; }); await T.page.waitForTimeout(3000);
  const marken = await T.page.evaluate((ids) => ids.map((id) => !!document.querySelector(`[data-mf-anfrage="${id}"] .fg-kw-marke`)), [kw1Id, kw2Id]);
  pruefe(marken[0] && marken[1], 'Anfragen: Kassenwart-Wunsch deutlich markiert', JSON.stringify(marken));
  await bild(T.page, '19_anfragen_wunsch');
  await klick(T.page, `[data-mf-anfrage="${kw1Id}"]`); await T.page.waitForTimeout(1500);
  await klick(T.page, '#freigabeBlatt [data-fg-kw]'); await T.page.waitForTimeout(300);
  await bild(T.page, '20_freigabe_kassenwart');
  await klick(T.page, '#freigabeBlatt [data-fg="freigeben"]'); await T.page.waitForTimeout(3500);
  await bild(T.page, '20b_nach_freigabe');  // Beleg: Blatt zu, Liste neu geladen
  await T.page.waitForSelector('#freigabeBlatt', { state: 'detached', timeout: 20000 });
  await klick(T.page, `[data-mf-anfrage="${kw2Id}"]`); await T.page.waitForTimeout(1500);
  await klick(T.page, '#freigabeBlatt [data-fg="freigeben"]'); await T.page.waitForTimeout(3500);
  pruefe(eins(`select string_agg(p.anzeigename || ':' || p.freigabe || ':' || p.paypal_frage || ':' || (select count(*) from user_roles r where r.user_id = p.id and r.role = 'treasurer'), ',' order by p.anzeigename) from profiles p where p.id in ('${kw1Id}', '${kw2Id}')`) ===
    'E2E Kasse Ja:aktiv:true:1,E2E Kasse Nein:aktiv:false:0', 'bestätigt: Spieler und Kassenwart; nicht bestätigt: nur Spieler');
  const kaderTausch = await rest('rpc/set_my_player', await token(K2.page), { p_player_id: frei });
  pruefe(kaderTausch.status >= 400, 'Spieler wechselt seinen Kadereintrag nicht selbst (E6, 0069)', kaderTausch.status);
  const nachEntscheid = await rest('fine_status_log?select=id&limit=1', await token(K2.page));
  pruefe(Array.isArray(nachEntscheid.daten) && nachEntscheid.daten.length === 0, 'nicht bestätigt: auch nach der Freigabe kein Kassenverlauf');

  // ---- 16) Kassenwart-Wechsel ---------------------------------------------------------
  const K1 = await neueSeite();
  await anmelden(K1.page, mail('kasseja'));
  await klick(K1.page, '[data-ob-ds]'); await klick(K1.page, '[data-ob="datenschutz"]'); await K1.page.waitForTimeout(5000);
  pruefe(await K1.page.evaluate(() => !!document.getElementById('paypalBlatt')), 'bestätigter Kassenwart wird nach dem PayPal-Link gefragt');
  await K1.page.fill('#paypalBlatt [data-pp-name]', 'E2EKasseEins'); await klick(K1.page, '#paypalBlatt [data-pp-speichern]'); await K1.page.waitForTimeout(2500);
  // ohne offene Meldungen: Entziehen ohne Rueckfrage, dann wieder vergeben
  await klick(T.page, `[data-mf-mitglied="${kw1Id}"]`); await T.page.waitForTimeout(1200);
  await klick(T.page, '#rolleBlatt [data-rl="treasurer"]'); await T.page.waitForTimeout(3000);
  pruefe(!(await T.page.evaluate(() => !!document.getElementById('kwBlatt'))) && eins(`select count(*) from user_roles where user_id = '${kw1Id}' and role = 'treasurer'`) === '0' &&
    eins("select coalesce(paypal_name, '-') from team_settings") === '-', 'ohne offene Meldungen: Entzug ohne Rückfrage, Link weg');
  await klick(T.page, '#rolleBlatt [data-rl="treasurer"]'); await T.page.waitForTimeout(3000);
  pruefe(eins(`select count(*) from user_roles where user_id = '${kw1Id}' and role = 'treasurer'`) === '1', 'Trainer vergibt Kassenwart wieder');
  await klick(T.page, '#rolleBlatt [data-nsb-zu].nsb-prim'); await T.page.waitForTimeout(800);
  await K1.page.reload(); await K1.page.waitForTimeout(5000);
  await K1.page.fill('#paypalBlatt [data-pp-name]', 'E2EKasseEins'); await klick(K1.page, '#paypalBlatt [data-pp-speichern]'); await K1.page.waitForTimeout(2500);
  // Spieler (Wunsch nicht bestaetigt) zahlt per PayPal an Kasse Eins
  const k2pl = eins(`select player_id from profiles where id = '${kw2Id}'`);
  sql(`insert into fines (club_id, player_id, date, offense, base_amount, status) select id, '${k2pl}', current_date, 'E2E Zuspaet', 6, 'offen' from clubs where slug = 'fcfn'`);
  await K2.page.reload(); await K2.page.waitForTimeout(5000);
  await klick(K2.page, '[data-ob-ds]').catch(() => {}); await klick(K2.page, '[data-ob="datenschutz"]').catch(() => {}); await K2.page.waitForTimeout(4000);
  await K2.page.evaluate(() => { location.hash = '#ansicht=strafen'; }); await K2.page.waitForTimeout(2000);
  const zahlA = await K2.page.evaluate(() => { const a = document.querySelector('.mb-pay'); return a ? a.getAttribute('href') : ''; });
  pruefe(/paypal\.me\/E2EKasseEins\//.test(zahlA), 'Spieler zahlt an den Link von Kasse Eins', zahlA);
  const gemeldet = await rest('rpc/report_my_payment', await token(K2.page), { p_method: 'paypal', p_note: null });
  pruefe(gemeldet.status < 300 && eins(`select zahlung_an_name || '/' || zahlung_an_paypal from fines where player_id = '${k2pl}'`) === 'E2E Kasse Ja/E2EKasseEins', 'Meldung hält Kassenwart und PayPal-Link fest', JSON.stringify(gemeldet));
  // mit offener Meldung: Rueckfrage, abbrechen
  await klick(T.page, `[data-mf-mitglied="${kw1Id}"]`); await T.page.waitForTimeout(1200);
  await klick(T.page, '#rolleBlatt [data-rl="treasurer"]'); await T.page.waitForTimeout(2500);
  const frage = await T.page.evaluate(() => ((document.querySelector('#kwBlatt .ob-blatt-text') || {}).textContent || ''));
  pruefe(/1 gemeldete Zahlung über 6,00\s?€ an E2E Kasse Ja/.test(frage), 'Rückfrage mit Anzahl und Summe', frage);
  await bild(T.page, '21_kasse_wechsel_frage');
  await klick(T.page, '#kwBlatt [data-nsb-zu].nsb-sek'); await T.page.waitForTimeout(1500);
  pruefe(eins(`select count(*) from user_roles where user_id = '${kw1Id}' and role = 'treasurer'`) === '1' && eins(`select an_vorherigen from fines where player_id = '${k2pl}'`) === 'false', 'Abbrechen: nichts geändert');
  await klick(T.page, '#rolleBlatt [data-nsb-zu].nsb-prim'); await T.page.waitForTimeout(800);
  // neuer Kassenwart: das Trainer-Link-Konto, dann trotzdem wechseln
  await T.page.evaluate(() => { location.hash = '#ansicht=dashboard'; }); await T.page.waitForTimeout(800);
  await T.page.evaluate(() => { location.hash = '#ansicht=admin'; }); await T.page.waitForTimeout(3000);
  await klick(T.page, `[data-mf-mitglied="${tlId}"]`); await T.page.waitForTimeout(1200);
  await klick(T.page, '#rolleBlatt [data-rl="treasurer"]'); await T.page.waitForTimeout(2500);
  await klick(T.page, '#rolleBlatt [data-nsb-zu].nsb-prim'); await T.page.waitForTimeout(800);
  await klick(T.page, `[data-mf-mitglied="${kw1Id}"]`); await T.page.waitForTimeout(1200);
  await klick(T.page, '#rolleBlatt [data-rl="treasurer"]'); await T.page.waitForTimeout(2500);
  await klick(T.page, '#kwBlatt [data-kw-trotzdem]'); await T.page.waitForTimeout(3500);
  pruefe(eins(`select count(*) from user_roles where user_id = '${kw1Id}' and role = 'treasurer'`) === '0' &&
    eins(`select status || '/' || an_vorherigen || '/' || zahlung_an_name from fines where player_id = '${k2pl}'`) === 'gemeldet/true/E2E Kasse Ja' &&
    eins("select coalesce(paypal_name, '-') from team_settings") === '-', 'Trotzdem wechseln: Meldung bleibt, markiert, alter Link weg');
  pruefe(eins(`select count(*) from konto_protokoll where ziel = '${kw1Id}' and aktion = 'kassenwart_gewechselt'`) === '1', 'Wechsel protokolliert');
  await klick(T.page, '#rolleBlatt [data-nsb-zu].nsb-prim'); await T.page.waitForTimeout(800);
  // neuer Link erst nach dem Setzen
  await K2.page.reload(); await K2.page.waitForTimeout(5000);
  await K2.page.evaluate(() => { location.hash = '#ansicht=strafen'; }); await K2.page.waitForTimeout(2000);
  sql(`insert into fines (club_id, player_id, date, offense, base_amount, status) select id, '${k2pl}', current_date, 'E2E Zweite', 4, 'offen' from clubs where slug = 'fcfn'`);
  await K2.page.reload(); await K2.page.waitForTimeout(5000);
  await K2.page.evaluate(() => { location.hash = '#ansicht=strafen'; }); await K2.page.waitForTimeout(2000);
  const ohneLink = await K2.page.evaluate(() => ({ knopf: !!document.querySelector('.mb-pay'), hinweis: [...document.querySelectorAll('.mb-pp')].map((e) => e.textContent).join('|') }));
  pruefe(!ohneLink.knopf && /neuen PayPal-Link/.test(ohneLink.hinweis), 'bis zum neuen Link: kein Zahlknopf, Hinweis', JSON.stringify(ohneLink));
  await bild(K2.page, '22_ohne_link');
  await TL.page.reload(); await TL.page.waitForTimeout(5000);
  pruefe(await TL.page.evaluate(() => !!document.getElementById('paypalBlatt')), 'neuer Kassenwart wird nach dem PayPal-Link gefragt');
  await TL.page.fill('#paypalBlatt [data-pp-name]', 'E2EKasseZwei'); await klick(TL.page, '#paypalBlatt [data-pp-speichern]'); await TL.page.waitForTimeout(2500);
  await K2.page.reload(); await K2.page.waitForTimeout(5000);
  await K2.page.evaluate(() => { location.hash = '#ansicht=strafen'; }); await K2.page.waitForTimeout(2000);
  const zahlB = await K2.page.evaluate(() => { const a = document.querySelector('.mb-pay'); return a ? a.getAttribute('href') : ''; });
  pruefe(/paypal\.me\/E2EKasseZwei\//.test(zahlB), 'danach zahlt der Spieler an den neuen Link', zahlB);
  // neue Kasse sieht die Meldung markiert, Verlauf nennt das Ziel
  await TL.page.evaluate(() => { location.hash = '#kasse=pruefen'; }); await TL.page.waitForTimeout(3000);
  const mark = await TL.page.evaluate(() => ((document.querySelector('.ks-vorher') || {}).textContent || ''));
  pruefe(/An vorherigen Kassenwart gezahlt: E2E Kasse Ja/.test(mark), 'neue Kasse: Meldung markiert "an vorherigen Kassenwart gezahlt"', mark);
  await bild(TL.page, '23_kasse_markiert');
  await klick(TL.page, '.ks-card[data-ks-det]'); await TL.page.waitForTimeout(2500);
  const verlauf = await TL.page.evaluate(() => ((document.getElementById('ksBlHist') || {}).textContent || ''));
  pruefe(/an E2E Kasse Ja \(paypal\.me\/E2EKasseEins\)/.test(verlauf), 'Verlauf nennt Kassenwart und PayPal-Link der Zahlung', verlauf);
  await bild(TL.page, '24_verlauf_ziel');
  await AD.ctx.close(); await TL.ctx.close(); await K1.ctx.close(); await K2.ctx.close();
  await T.ctx.close();
} catch (e) {
  pruefe(false, 'Durchlauf abgebrochen', e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : String(e));
} finally {
  // ---- Aufraeumen: alle Testdaten, Ausgangsstand wiederherstellen -----------
  const ids = [trainerId, aId, bId, admId, tlId, kw1Id, kw2Id].filter(Boolean).map((x) => `'${x}'`).join(',') || "'00000000-0000-0000-0000-000000000000'";
  // Kadereintraege der Testkonten (Freigabe mit neuem Eintrag, Trainer-Link) gehoeren mit zum Aufraeumen.
  const eigenePl = sql(`select player_id from profiles where player_id is not null and (id in (${ids}) or email like 'wplauck+fne2e${lauf}%')`).map((z) => z[0]);
  const pls = [trPl, frei].concat(eigenePl).filter(Boolean).map((x) => `'${x}'`).join(',') || "'00000000-0000-0000-0000-000000000000'";
  // Sammeleintraege (z. B. zahlung_gemeldet an den ECHTEN Kassenwart) aus Testmeldungen zuerst, sonst kaeme ein Push.
  sql(`delete from notification_sammler where ausloeser in (${ids}) or (daten->>'fine_id')::uuid in (select id from fines where player_id in (${pls}))`);
  sql(`delete from fines where player_id in (${pls})`);
  sql(`delete from rsvps where player_id in (${pls})`);
  sql(`delete from player_status where player_id in (${pls})`);
  sql(`delete from auth.users where id in (${ids}) or email like 'wplauck+fne2e${lauf}%'`);
  sql(`delete from players where id in (${pls})`);
  sql(`delete from einladungen where erstellt_am >= '${start}' or token like 'e2e%'`);
  sql(`delete from konto_protokoll where zeit >= '${start}'`);
  sql(`update team_settings set paypal_name = ${paypalAlt[0] ? `'${paypalAlt[0]}'` : 'null'}, paypal_von = ${paypalAlt[1] ? `'${paypalAlt[1]}'` : 'null'}, paypal_am = ${paypalAlt[2] ? `'${paypalAlt[2]}'` : 'now()'}`);
  sql("update notification_templates set aktiv = true where kategorie in ('anfrage_neu','konto_freigegeben','rolle_geaendert','kasse_neu','kasse_abgegeben')");
  const nachher = eins(STAND);
  console.log('Ausgangsstand  ', vorher);
  console.log('nach Aufräumen ', nachher);
  pruefe(nachher === vorher, 'Aufräumen: Datenbank wieder im Ausgangsstand', nachher);
  await browser.close(); server.close();
  fs.writeFileSync(path.join(OUT, 'ergebnis.json'), JSON.stringify({ lauf, vorher, nachher, ergebnis }, null, 1));
  const f = ergebnis.filter((x) => !x.ok).length;
  console.log(f ? `--- NICHT bestanden: ${f} von ${ergebnis.length} ---` : `--- bestanden (${ergebnis.length} Prüfungen) ---`);
  process.exit(f ? 1 : 0);
}
