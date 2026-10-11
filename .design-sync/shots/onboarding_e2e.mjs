/* Onboarding: Durchlauf des ganzen Wegs gegen die ECHTE Datenbank (lokal
   ausgeliefert, echte config.js). NICHT auf der Pflichtliste: legt
   Testkonten an (Gmail-Plus-Adressen) und raeumt am Ende alles wieder weg.

   Schutz:
   - Die drei Push-Vorlagen des Onboardings sind waehrend des Laufs aus
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

const STAND = `select (select count(*) from auth.users) || '/' || (select count(*) from profiles) || '/' || (select count(*) from players) || '/' || (select count(*) from fines) || '/' || (select count(*) from rsvps) || '/' || (select count(*) from player_status) || '/' || (select count(*) from einladungen) || '/' || (select count(*) from konto_protokoll) || '/' || (select count(*) from einwilligungen) || '/' || (select count(*) from notification_outbox) || '/' || (select paypal_name || ':' || coalesce(paypal_von::text, '-') from team_settings) || '/' || (select string_agg(aktiv::text, ',' order by kategorie) from notification_templates where kategorie in ('anfrage_neu','konto_freigegeben','rolle_geaendert'))`;
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
  page.on('dialog', (d) => d.accept().catch(() => {}));
  return { ctx, page };
};
async function anmelden(page, email) {
  await page.goto(basis); await page.waitForSelector('#authForm', { timeout: 20000 });
  await page.fill('input[name=email]', email); await page.fill('input[name=password]', PW);
  await page.click('.auth-submit'); await page.waitForTimeout(2500);
}
const titel = (page) => page.evaluate(() => (document.querySelector('#view h1') || {}).textContent || '');
const token = (page) => page.evaluate(() => { for (const k of Object.keys(localStorage)) if (/-auth-token$/.test(k)) { try { return JSON.parse(localStorage.getItem(k)).access_token; } catch (e) {} } return null; });

let trainerId = null, aId = null, bId = null, frei = null, trPl = null;
try {
  // ---- Aufbau --------------------------------------------------------------
  sql("update notification_templates set aktiv = false where kategorie in ('anfrage_neu','konto_freigegeben','rolle_geaendert')");
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
  await A.page.click('[data-pr-gesundheit]'); await A.page.waitForTimeout(3500);
  pruefe(eins(`select status || '/' || coalesce(status_note, '-') || '/' || coalesce(status_until::text, '-') from player_status where player_id = '${frei}'`) === 'fit/-/-', 'Widerruf löscht Status, Notiz und Datum');
  pruefe(eins(`select count(*) from einwilligungen where profile_id = '${aId}' and art = 'gesundheit' and widerrufen_am is not null`) === '1', 'Widerruf mit Zeitpunkt gespeichert');
  await A.page.evaluate(() => { location.hash = '#ansicht=dashboard'; }); await A.page.waitForTimeout(1500);
  await A.page.click('.st-knopf.st-verletzt'); await A.page.waitForTimeout(1000);
  pruefe(await A.page.evaluate(() => !!document.getElementById('gesundheitBlatt') && !document.getElementById('statusFenster')), 'ohne Einwilligung: erst die Frage, kein Status');
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
  await T.ctx.close(); await A.ctx.close();
} catch (e) {
  pruefe(false, 'Durchlauf abgebrochen', e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : String(e));
} finally {
  // ---- Aufraeumen: alle Testdaten, Ausgangsstand wiederherstellen -----------
  const ids = [trainerId, aId, bId].filter(Boolean).map((x) => `'${x}'`).join(',') || "'00000000-0000-0000-0000-000000000000'";
  const pls = [trPl, frei].filter(Boolean).map((x) => `'${x}'`).join(',') || "'00000000-0000-0000-0000-000000000000'";
  sql(`delete from fines where player_id in (${pls})`);
  sql(`delete from rsvps where player_id in (${pls})`);
  sql(`delete from player_status where player_id in (${pls})`);
  sql(`delete from auth.users where id in (${ids}) or email like 'wplauck+fne2e${lauf}%'`);
  sql(`delete from players where id in (${pls})`);
  sql(`delete from einladungen where erstellt_am >= '${start}' or token like 'e2e%'`);
  sql(`delete from konto_protokoll where zeit >= '${start}'`);
  sql(`update team_settings set paypal_name = ${paypalAlt[0] ? `'${paypalAlt[0]}'` : 'null'}, paypal_von = ${paypalAlt[1] ? `'${paypalAlt[1]}'` : 'null'}, paypal_am = ${paypalAlt[2] ? `'${paypalAlt[2]}'` : 'now()'}`);
  sql("update notification_templates set aktiv = true where kategorie in ('anfrage_neu','konto_freigegeben','rolle_geaendert')");
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
