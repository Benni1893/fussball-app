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

const VERSION = "fn-sw-2";     // Cache-Name; aendert sich der Wert, wird alles Alte verworfen
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

/* ---------------------------------------------------------------------------
   Push. Ab Phase 1b.

   EISERNE REGEL: jede eingehende Push MUSS eine sichtbare Notification
   erzeugen. iOS entzieht die Berechtigung, wenn das ausbleibt - stillschweigend
   und ohne Weg zurueck ausser Neuinstallation. Deshalb gibt es unten einen
   Ersatztext fuer den Fall, dass die Nutzlast fehlt oder unlesbar ist.
   --------------------------------------------------------------------------- */

const ICON  = "assets/icon-192.png";
const BADGE = "assets/badge-96.png";   // monochrom, transparent - Android faerbt es weiss

self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = {}; }

  const titel = d.titel || "FC Fasanerie-Nord";
  const text  = d.text  || "Neue Nachricht in der App.";

  e.waitUntil(self.registration.showNotification(titel, {
    body: text,
    icon: ICON,
    badge: BADGE,
    // tag + renotify: eine aktualisierte Sammelnachricht ERSETZT die alte,
    // statt sich daneben zu stapeln.
    tag: d.tag || d.kategorie || "fcfn",
    renotify: true,
    data: { deep_link: d.deep_link || null, kategorie: d.kategorie || null },
    // Aktionsknoepfe ignoriert iOS. Sie sind hier bewusst NICHT gesetzt -
    // kein Weg darf von ihnen abhaengen, also gibt es sie gar nicht erst.
  }));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const ziel = (e.notification.data && e.notification.data.deep_link) || "";

  e.waitUntil((async () => {
    const liste = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    // Laeuft die App schon? Dann Fenster nach vorn holen und dorthin schicken -
    // kein zweites Fenster, kein Neuladen.
    for (const c of liste) {
      if ("focus" in c) {
        await c.focus();
        if (ziel) { try { c.postMessage({ typ: "deep-link", ziel: ziel }); } catch (err) {} }
        return;
      }
    }
    // Kalter Start: die installierte App oeffnen, Ziel im Hash. Der Router in
    // app.js wertet ihn nach dem ersten Rendern aus.
    const url = ziel ? ("./" + (ziel.charAt(0) === "#" ? ziel : "#" + ziel)) : "./";
    if (self.clients.openWindow) await self.clients.openWindow(url);
  })());
});
