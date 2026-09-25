/* Service Worker der Mannschafts-App.
   ===========================================================================
   BEWUSST MINIMAL. Gecacht wird genau EINE Datei: die Offline-Seite. Alles
   andere geht unberuehrt ans Netz.

   Warum kein Precache der App-Dateien: Diese App hat keinen Build-Schritt und
   liefert index.html, app.js, styles.css bewusst mit no-cache-Headern aus
   (vercel.json). Die ganze Build-Stempel-Mechanik existiert, weil veraltete
   Dateien hier schon einmal Aerger gemacht haben. Ein Service Worker, der
   App-Dateien zwischenspeichert, waere genau dieser Aerger noch einmal - nur
   diesmal mit einem Cache, den der Nutzer nicht sieht und nicht leeren kann.

   Der fetch-Handler ist trotzdem ECHT und nicht leer: Chrome verlangt fuer
   das Installations-Angebot (beforeinstallprompt) einen Handler, der offline
   eine gueltige Antwort liefert, und ignoriert absichtlich leere Handler.
   Er greift nur bei Navigationen und nur, wenn das Netz ausfaellt.

   Push- und notificationclick-Handler kommen in Phase 1b dazu. Sie haengen
   an der Registrierung, nicht an dieser Datei - ein Update des Workers
   verliert das Push-Abo also nicht.
   =========================================================================== */

const VERSION = "fn-sw-1";     // Cache-Name; aendert sich der Wert, wird alles Alte verworfen
const OFFLINE = "offline.html";

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    // cache: "reload" -> die Offline-Seite kommt frisch vom Netz, nicht aus
    // einem HTTP-Cache, der sie schon veraltet haben koennte.
    await c.add(new Request(OFFLINE, { cache: "reload" }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) {
      if (k !== VERSION) await caches.delete(k);
    }
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  // Nur Seitenaufrufe, nur GET. Alles andere - app.js, styles.css, die
  // Supabase-Aufrufe, /api/* - laeuft ohne respondWith am Worker vorbei und
  // behaelt seine normale Cache-Semantik.
  if (req.method !== "GET" || req.mode !== "navigate") return;
  e.respondWith((async () => {
    try {
      return await fetch(req);
    } catch (err) {
      const seite = await caches.match(OFFLINE);
      if (seite) return seite;
      return new Response("Offline", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
  })());
});
