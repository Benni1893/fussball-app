// Serverseitiger BFV-Spielplan-Sync (Vercel Serverless Function, Node runtime).
// - Auth: entweder Cron (Authorization: Bearer CRON_SECRET) ODER eingeloggter
//   Nutzer mit Rolle coach/treasurer/admin (dessen Supabase-JWT).
// - Holt die iCal-URL aus clubs, ruft den Feed ab, parst ihn (Unfolding,
//   Escaping, Team-Erkennung, Europe/Berlin) und ruft die DB-Funktion
//   sync_bfv_matches() mit dem service_role-Key auf.
// Keine externen Abhaengigkeiten (globales fetch, Node 18+).

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY     = process.env.SUPABASE_ANON_KEY;
const CRON_SECRET  = process.env.CRON_SECRET;

/* ---------- iCal-Parser (identisch zur validierten Logik) ----------------- */
function unfold(text) {
  const raw = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const out = [];
  for (const line of raw) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && out.length) out[out.length - 1] += line.slice(1);
    else out.push(line);
  }
  return out;
}
function unescapeText(v) {
  return v.replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
}
function propName(line) { const i = line.search(/[:;]/); return i === -1 ? line : line.slice(0, i); }
function propValue(line) { const i = line.indexOf(":"); return i === -1 ? "" : line.slice(i + 1); }
function berlinLocal(dt) {
  const m = (dt || "").match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]));
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
  const p = Object.fromEntries(fmt.formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}
function parseIcs(text) {
  const lines = unfold(text);
  let calname = "";
  for (const l of lines) if (propName(l) === "X-WR-CALNAME") calname = unescapeText(propValue(l));
  const ownTeam = calname.replace(/\s*\(.*\)\s*$/, "").trim();

  const events = [];
  let cur = null;
  for (const l of lines) {
    const name = propName(l);
    if (l.trim() === "BEGIN:VEVENT") cur = {};
    else if (l.trim() === "END:VEVENT") { if (cur) events.push(cur); cur = null; }
    else if (cur) {
      if (name === "UID") cur.uid = propValue(l).trim();
      else if (name === "DTSTART") cur.dtstart = propValue(l).trim();
      else if (name === "SUMMARY") cur.summary = unescapeText(propValue(l));
      else if (name === "LOCATION") cur.location = unescapeText(propValue(l));
    }
  }

  const matches = [];
  const warnings = [];
  for (const g of events) {
    if (!g.uid) continue;
    const parts = (g.summary || "").split(",").map((s) => s.trim());
    const teams = parts[0] || "";
    const wettbewerb = parts[1] || "";
    const liga = parts.slice(2).join(", ");
    let heim = null, gegner = null;
    if (ownTeam && teams.startsWith(ownTeam)) {
      heim = true;  gegner = teams.slice(ownTeam.length).replace(/^\s*-\s*/, "").trim();
    } else if (ownTeam && teams.endsWith(ownTeam)) {
      heim = false; gegner = teams.slice(0, teams.length - ownTeam.length).replace(/\s*-\s*$/, "").trim();
    } else {
      heim = null; gegner = teams;
      warnings.push("Team nicht erkannt: " + JSON.stringify(g.summary || ""));
    }
    const w = berlinLocal(g.dtstart);
    const loc = (g.location || "").split(",").map((s) => s.trim());
    matches.push({
      bfv_uid: g.uid, gegner, heim, wettbewerb, liga,
      date: w && w.date, time: w && w.time,
      spielstaette: loc[0] || "", adresse: loc.slice(1).join(", "),
      // Vollständiges LOCATION-Feld unverändert für den Karten-Link (nichts abschneiden).
      location_raw: g.location || "",
    });
  }
  return { ownTeam, matches, warnings };
}

/* ---------- Handler ------------------------------------------------------- */
module.exports = async function handler(req, res) {
  try {
    if (!SUPABASE_URL || !SERVICE_KEY) {
      return res.status(500).json({ ok: false, error: "Serverkonfiguration fehlt (SUPABASE_URL / SERVICE_ROLE_KEY)." });
    }
    const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();

    // Autorisierung: Cron-Secret ODER eingeloggter coach/treasurer/admin
    let allowed = false;
    if (CRON_SECRET && token && token === CRON_SECRET) {
      allowed = true;
    } else if (token && ANON_KEY) {
      const rr = await fetch(`${SUPABASE_URL}/rest/v1/rpc/my_roles`, {
        method: "POST",
        headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: "{}",
      });
      if (rr.ok) {
        const roles = await rr.json();
        if (Array.isArray(roles) && roles.some((r) => r === "coach" || r === "treasurer" || r === "admin")) allowed = true;
      }
    }
    if (!allowed) return res.status(401).json({ ok: false, error: "Nicht autorisiert." });

    // iCal-URL aus den Einstellungen
    const cr = await fetch(`${SUPABASE_URL}/rest/v1/clubs?slug=eq.fcfn&select=ical_url`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    });
    const clubs = await cr.json();
    const icalUrl = clubs && clubs[0] && clubs[0].ical_url;
    if (!icalUrl) return res.status(400).json({ ok: false, error: "Keine iCal-URL in den Einstellungen gesetzt." });

    // Feed abrufen
    const ic = await fetch(icalUrl, { headers: { "User-Agent": "fcfn-app-sync/1.0" } });
    if (!ic.ok) return res.status(502).json({ ok: false, error: "iCal-Abruf fehlgeschlagen: HTTP " + ic.status });
    const icsText = await ic.text();
    if (!icsText || icsText.length < 20) return res.status(502).json({ ok: false, error: "Leerer iCal-Feed." });

    const { matches, warnings, ownTeam } = parseIcs(icsText);
    warnings.forEach((w) => console.warn("BFV-Sync:", w));

    // Eigenen Teamnamen (aus X-WR-CALNAME) in den Einstellungen ablegen
    if (ownTeam) {
      await fetch(`${SUPABASE_URL}/rest/v1/clubs?slug=eq.fcfn`, {
        method: "PATCH",
        headers: {
          apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`,
          "Content-Type": "application/json", Prefer: "return=minimal",
        },
        body: JSON.stringify({ team_name: ownTeam }),
      });
    }

    // DB-Reconciliation (service_role)
    const sr = await fetch(`${SUPABASE_URL}/rest/v1/rpc/sync_bfv_matches`, {
      method: "POST",
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_matches: matches }),
    });
    const result = await sr.json();
    if (!sr.ok) return res.status(500).json({ ok: false, error: "DB-Sync fehlgeschlagen.", detail: result });

    // Zeitpunkt der letzten erfolgreichen Synchronisierung festhalten.
    await fetch(`${SUPABASE_URL}/rest/v1/clubs?slug=eq.fcfn`, {
      method: "PATCH",
      headers: {
        apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json", Prefer: "return=minimal",
      },
      body: JSON.stringify({ ical_synced_at: new Date().toISOString() }),
    });

    return res.status(200).json({
      ok: true, ownTeam, parsed: matches.length, warnings: warnings.length,
      updated: result.updated, new: result.new, cancelled: result.cancelled,
    });
  } catch (err) {
    console.error("BFV-Sync Fehler:", err);
    return res.status(500).json({ ok: false, error: String((err && err.message) || err) });
  }
};
