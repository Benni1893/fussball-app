// Push-Versand (Vercel Serverless Function, Node runtime).
// ===========================================================================
// Wird von pg_cron ueber pg_net angestossen - aber nur, wenn in der Outbox
// wirklich etwas faellig ist (push_dispatch_tick in Migration 0034). Der
// Endpunkt ist nicht oeffentlich: er verlangt den Header x-push-secret mit
// demselben Wert, der im Supabase Vault liegt.
//
// Ablauf:
//   1. push_claim() nimmt faellige Zeilen in Bearbeitung (for update skip
//      locked) - zwei ueberlappende Laeufe greifen sich nicht dieselbe.
//   2. Zeilen mit gleichem bundle_key werden zu EINER Nachricht
//      zusammengefasst.
//   3. Versand an alle Geraete des Profils, mit Urgency und TTL.
//   4. 404/410 loescht das Geraet sofort, andere Fehler zaehlen hoch und
//      loeschen ab dem fuenften Versuch.
//
// Jede Nachricht traegt einen sichtbaren Titel und Text: iOS entzieht die
// Berechtigung, wenn eine Push keine Notification erzeugt. Der Service Worker
// zeigt deshalb immer etwas an, notfalls einen Ersatztext.
//
// Einzige Abhaengigkeit: web-push (RFC 8291 Verschluesselung, RFC 8292 VAPID).

const webpush = require("web-push");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const VAPID_PUBLIC  = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT;
const DISPATCH_SECRET = process.env.PUSH_DISPATCH_SECRET;

const MAX_PRO_LAUF = 200;
const MAX_PAYLOAD  = 3000;   // Bytes. Unter dem 4-KB-Limit der Push-Dienste.

// Zeitgleiche Zeichenfolgen vergleichen, damit die Laufzeit nichts verraet.
function gleichSicher(a, b) {
  const x = String(a || ""), y = String(b || "");
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}

async function rpc(name, args) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args || {}),
  });
  if (!r.ok) throw new Error(`RPC ${name}: HTTP ${r.status} ${await r.text()}`);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

async function tabelle(pfad) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${pfad}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  if (!r.ok) throw new Error(`GET ${pfad}: HTTP ${r.status}`);
  return r.json();
}

/* Zeilen mit gleichem bundle_key zu einer Nachricht zusammenfassen.
   Ohne bundle_key bleibt jede Zeile fuer sich.
   Die Sammelnachricht traegt den tag der ersten Zeile und renotify:true -
   sie ERSETZT damit die vorherige, statt sich daneben zu stapeln.          */
function buendeln(zeilen) {
  const einzeln = [];
  const gruppen = new Map();
  for (const z of zeilen) {
    if (!z.bundle_key) { einzeln.push({ zeilen: [z] }); continue; }
    const k = z.profile_id + "|" + z.bundle_key;
    if (!gruppen.has(k)) gruppen.set(k, []);
    gruppen.get(k).push(z);
  }
  for (const g of gruppen.values()) einzeln.push({ zeilen: g });

  return einzeln.map((b) => {
    const z = b.zeilen;
    const erste = z[0];
    if (z.length === 1) return { zeilen: z, nachricht: erste };
    // Mehrere: Titel der ersten behalten, Texte aneinanderreihen.
    return {
      zeilen: z,
      nachricht: Object.assign({}, erste, {
        titel: erste.titel,
        text: z.map((x) => x.text).join(" · "),
        // Die dringlichste Stufe der Gruppe gewinnt, ebenso die kuerzeste TTL.
        urgency: z.some((x) => x.urgency === "high") ? "high" : "normal",
        ttl_seconds: Math.min.apply(null, z.map((x) => x.ttl_seconds)),
      }),
    };
  });
}

function nutzlast(n) {
  const p = {
    titel: n.titel,
    text: n.text,
    deep_link: n.deep_link || null,
    tag: n.tag || n.kategorie,
    kategorie: n.kategorie,
  };
  let s = JSON.stringify(p);
  if (Buffer.byteLength(s, "utf8") > MAX_PAYLOAD) {
    // Notfalls den Text kuerzen, nie den Titel oder den Link.
    const zuviel = Buffer.byteLength(s, "utf8") - MAX_PAYLOAD;
    p.text = p.text.slice(0, Math.max(0, p.text.length - zuviel - 3)) + "...";
    s = JSON.stringify(p);
  }
  return s;
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Nur POST." });
    if (!SUPABASE_URL || !SERVICE_KEY) return res.status(500).json({ error: "Supabase-Zugang fehlt." });
    if (!VAPID_PUBLIC || !VAPID_PRIVATE || !VAPID_SUBJECT) {
      return res.status(500).json({ error: "VAPID-Konfiguration fehlt." });
    }
    if (!DISPATCH_SECRET || !gleichSicher(req.headers["x-push-secret"], DISPATCH_SECRET)) {
      // Kein Hinweis darauf, was gefehlt hat.
      return res.status(404).send("Not found");
    }

    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

    const zeilen = (await rpc("push_claim", { p_limit: MAX_PRO_LAUF })) || [];
    if (zeilen.length === 0) return res.status(200).json({ geholt: 0, gesendet: 0 });

    // Geraete aller betroffenen Profile in einem Zug holen.
    const profile = [...new Set(zeilen.map((z) => z.profile_id))];
    const abos = await tabelle(
      "push_subscriptions?select=profile_id,endpoint,p256dh,auth" +
      "&profile_id=in.(" + profile.join(",") + ")");
    const proProfil = new Map();
    for (const a of abos) {
      if (!proProfil.has(a.profile_id)) proProfil.set(a.profile_id, []);
      proProfil.get(a.profile_id).push(a);
    }

    const buendel = buendeln(zeilen);
    const fertig = [];      // ids, die als gesendet gelten
    let zugestellt = 0, entfernt = 0, fehlerhaft = 0;

    for (const b of buendel) {
      const n = b.nachricht;
      const geraete = proProfil.get(n.profile_id) || [];

      if (geraete.length === 0) {
        // Kein Geraet: die Zeile bleibt als In-App-Eintrag stehen und gilt als
        // erledigt - sonst haengt sie fuer immer in der Warteschlange.
        fertig.push.apply(fertig, b.zeilen.map((z) => z.id));
        continue;
      }

      const body = nutzlast(n);
      let einZustellungGeglueckt = false;

      for (const g of geraete) {
        try {
          await webpush.sendNotification(
            { endpoint: g.endpoint, keys: { p256dh: g.p256dh, auth: g.auth } },
            body,
            { TTL: n.ttl_seconds, urgency: n.urgency }
          );
          einZustellungGeglueckt = true;
          zugestellt++;
          await rpc("push_subscription_ok", { p_endpoint: g.endpoint });
        } catch (err) {
          const code = err && err.statusCode;
          const weg = code === 404 || code === 410;
          if (weg) entfernt++; else fehlerhaft++;
          try { await rpc("push_subscription_failed", { p_endpoint: g.endpoint, p_gone: !!weg }); }
          catch (e) { /* Aufraeumen darf den Lauf nicht kippen */ }
        }
      }

      if (einZustellungGeglueckt) {
        fertig.push.apply(fertig, b.zeilen.map((z) => z.id));
      } else {
        // Kein Geraet erreichbar. Die Zeile bekommt einen Fehler und wird
        // wieder frei - der naechste Lauf versucht es erneut.
        for (const z of b.zeilen) {
          try { await rpc("push_mark_error", { p_id: z.id, p_error: "keine Zustellung" }); }
          catch (e) {}
        }
      }
    }

    if (fertig.length) await rpc("push_mark_sent", { p_ids: fertig });

    return res.status(200).json({
      geholt: zeilen.length,
      buendel: buendel.length,
      gesendet: fertig.length,
      zustellungen: zugestellt,
      geraeteEntfernt: entfernt,
      fehlversuche: fehlerhaft,
    });
  } catch (err) {
    console.error("dispatch-push:", err);
    return res.status(500).json({ error: String((err && err.message) || err) });
  }
};
