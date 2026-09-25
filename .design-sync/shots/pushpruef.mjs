/* Push-Zustandslogik. pushZustand(), istInAppBrowser() und
   pushHinweisZeigen() werden woertlich aus app.js gezogen und mit Stubs
   gefahren - kein Browser, keine Berechtigung, kein Geraet.
   Dazu ein Blick auf die Plattformregeln, die sich statisch pruefen lassen.
   Aufruf: node .design-sync/shots/pushpruef.mjs                             */
import fs from 'node:fs';

const fehler = [];
const pruefe = (ok, text, detail) => {
  console.log((ok ? '  ok   ' : '  FEHL ') + text + (detail !== undefined ? '   ' + detail : ''));
  if (!ok) fehler.push(text);
};
const gleich = (ist, soll, text) => pruefe(ist === soll, text,
  ist === soll ? undefined : 'erwartet ' + JSON.stringify(soll) + ', bekommen ' + JSON.stringify(ist));

const app = fs.readFileSync('app.js', 'utf8');
const schnitt = (von, bis) => {
  const a = app.indexOf(von); const b = app.indexOf(bis, a);
  if (a < 0 || b < 0) throw new Error('nicht gefunden: ' + von);
  return app.slice(a, b);
};

/* istInAppBrowser + pushUnterstuetzt + pushZustand am Stueck */
const code = schnitt('  function istInAppBrowser(ua) {', '  let pushAbo = null;');
const f = new Function('navigator', 'window', code +
  '\n return { istInAppBrowser, pushZustand };')({ userAgent: '' }, {});

/* ===== 1. In-App-Browser erkennen ====================================== */
console.log('--- In-App-Browser ---');
const UAS = [
  ['Instagram iOS',  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Instagram 300.0', true],
  ['Facebook iOS',   'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 [FBAN/FBIOS;FBAV/450.0]', true],
  ['Android WebView','Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP1A; wv) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36', true],
  ['Safari iOS',     'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1', false],
  ['Chrome Android', 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126.0.0.0 Mobile Safari/537.36', false],
  ['Chrome Desktop', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36', false],
];
for (const [name, ua, soll] of UAS) gleich(f.istInAppBrowser(ua), soll, name);

/* ===== 2. Die sieben Zustaende ========================================= */
console.log('--- Zustaende der Einstellungsansicht ---');
const u = (o) => Object.assign({
  unterstuetzt: true, apple: false, standalone: false, inApp: false,
  permission: 'default', abo: false }, o);

gleich(f.pushZustand(u({ inApp: true })), 'inapp', '1 In-App-Browser');
gleich(f.pushZustand(u({ apple: true, standalone: false })), 'ios-install', '2 iPhone im Safari-Tab');
gleich(f.pushZustand(u({ unterstuetzt: false })), 'nicht-unterstuetzt', '3 alter Browser');
gleich(f.pushZustand(u({ permission: 'denied' })), 'verweigert', '4 Berechtigung verweigert');
gleich(f.pushZustand(u({ permission: 'granted', abo: true })), 'aktiv', '5 eingerichtet');
gleich(f.pushZustand(u({})), 'bereit', '6 Android im Browser, noch nicht gefragt');
gleich(f.pushZustand(u({ apple: true, standalone: true })), 'bereit', '7 iPhone installiert, noch nicht gefragt');
gleich(f.pushZustand(u({ apple: true, standalone: true, permission: 'granted', abo: true })), 'aktiv',
  '8 iPhone installiert und eingerichtet');

console.log('--- Reihenfolge der Pruefungen ---');
// Der handlungsleitende Hinweis muss gewinnen.
gleich(f.pushZustand(u({ inApp: true, apple: true, permission: 'denied' })), 'inapp',
  'In-App schlaegt alles - dort hilft keine Systemeinstellung');
gleich(f.pushZustand(u({ apple: true, standalone: false, unterstuetzt: false })), 'ios-install',
  'iPhone im Tab: installieren, nicht "nicht unterstuetzt"');
gleich(f.pushZustand(u({ apple: true, standalone: true, unterstuetzt: false })), 'nicht-unterstuetzt',
  'iPhone installiert, aber iOS unter 16.4');
gleich(f.pushZustand(u({ permission: 'granted', abo: false })), 'bereit',
  'Berechtigung da, aber kein Abo - z. B. nach Neuinstallation');

/* ===== 3. Der einmalige Hinweis ======================================== */
console.log('--- Einmaliger Hinweis ---');
const hcode = schnitt('  function pushHinweisZeigen(prefs, zustand, sitzung) {', '\n  }') + '\n  }';
const zeigen = new Function(hcode + '\n return pushHinweisZeigen;')();
gleich(zeigen({ hint_dismissed_at: null }, 'bereit', null), true,  'neu und einrichtbar');
gleich(zeigen({ hint_dismissed_at: null }, 'ios-install', null), true, 'neu und iPhone im Tab');
gleich(zeigen({ hint_dismissed_at: null }, 'aktiv', null), false, 'schon eingerichtet');
gleich(zeigen({ hint_dismissed_at: null }, 'verweigert', null), false, 'verweigert - Hinweis waere Hohn');
gleich(zeigen({ hint_dismissed_at: null }, 'inapp', null), false, 'In-App-Browser');
gleich(zeigen({ hint_dismissed_at: null }, 'nicht-unterstuetzt', null), false, 'kann es gar nicht');
gleich(zeigen({ hint_dismissed_at: '2026-09-25T10:00:00Z' }, 'bereit', null), false, 'schon weggetippt');
gleich(zeigen({ hint_dismissed_at: null }, 'bereit', false), false, 'in dieser Sitzung erledigt');
gleich(zeigen(null, 'bereit', null), false, 'Einstellungen noch nicht geladen');

/* ===== 4. Plattformregeln, statisch pruefbar =========================== */
console.log('--- Plattformregeln im Code ---');
const sw = fs.readFileSync('sw.js', 'utf8');
pruefe(/userVisibleOnly:\s*true/.test(app), 'subscribe mit userVisibleOnly: true');
pruefe(/addEventListener\("push"/.test(sw), 'Service Worker hat einen push-Handler');
pruefe(/showNotification/.test(sw), 'push zeigt immer eine Notification - sonst entzieht iOS die Berechtigung');
pruefe(/e\.waitUntil\(self\.registration\.showNotification/.test(sw), 'showNotification in waitUntil');
pruefe(!/actions:/.test(sw), 'keine Aktionsknoepfe - iOS ignoriert sie');
pruefe(/renotify:\s*true/.test(sw), 'renotify: true - Sammelnachricht ersetzt die alte');
pruefe(/badge:\s*BADGE/.test(sw), 'badge-Icon gesetzt');
pruefe(fs.existsSync('assets/badge-96.png'), 'assets/badge-96.png liegt vor');
{
  const b = fs.readFileSync('assets/badge-96.png');
  pruefe(b.readUInt32BE(16) === 96 && b.readUInt32BE(20) === 96, 'Badge ist 96x96', b.readUInt32BE(16) + 'x' + b.readUInt32BE(20));
  pruefe(b[25] === 6, 'Badge hat einen Alphakanal (Farbtyp 6)', 'Farbtyp ' + b[25]);
}
pruefe(/notificationclick/.test(sw), 'notificationclick-Handler vorhanden');
pruefe(/clients\.matchAll/.test(sw) && /openWindow/.test(sw),
  'offenes Fenster fokussieren, sonst neues oeffnen');
pruefe(/postMessage\(\{ typ: "deep-link"/.test(sw), 'Deep Link per postMessage ans offene Fenster');

// requestPermission darf nur im Klickpfad stehen, nie beim Laden.
{
  const i = app.indexOf('Notification.requestPermission');
  const vor = app.slice(Math.max(0, i - 900), i);
  pruefe(/async function pushAnmelden\(\)/.test(vor),
    'requestPermission steht in pushAnmelden, nicht im Startpfad');
  pruefe(app.split('Notification.requestPermission').length - 1 === 1,
    'requestPermission kommt genau einmal vor');
}
// subscribe ebenso.
pruefe(app.split('pushManager.subscribe').length - 1 === 1, 'subscribe kommt genau einmal vor');

/* ===== 5. Dispatcher =================================================== */
console.log('--- Dispatcher ---');
const disp = fs.readFileSync('api/dispatch-push.js', 'utf8');
pruefe(/x-push-secret/.test(disp), 'verlangt den Secret-Header');
pruefe(/gleichSicher/.test(disp), 'Vergleich ohne Laufzeitunterschied');
pruefe(/status\(404\)\.send\("Not found"\)/.test(disp), 'falsches Geheimnis -> 404 ohne Hinweis');
pruefe(/statusCode/.test(disp) && /404 \|\| code === 410/.test(disp), '404/410 loeschen das Geraet');
pruefe(/urgency: n\.urgency/.test(disp) && /TTL: n\.ttl_seconds/.test(disp), 'Urgency und TTL werden mitgegeben');
pruefe(/MAX_PAYLOAD\s*=\s*3000/.test(disp), 'Nutzlast auf 3 KB begrenzt');
pruefe(!/VAPID_PRIVATE_KEY\s*=\s*"/.test(disp), 'kein Schluessel im Quelltext');
{
  const p = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  pruefe(!!(p.dependencies && p.dependencies['web-push']),
    'web-push steht in dependencies, nicht in devDependencies', JSON.stringify(p.dependencies));
}

console.log(fehler.length === 0 ? '\n--- bestanden ---' : '\n--- NICHT bestanden: ' + fehler.length + ' ---');
process.exit(fehler.length === 0 ? 0 : 1);
