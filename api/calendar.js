// Persoenlicher iCal-Feed (Vercel Serverless Function, Node runtime).
// Oeffentliche URL: /api/calendar/<token>.ics  -> per Rewrite in vercel.json
// auf /api/calendar?token=<token> abgebildet (dynamische [param]-Routen im
// /api-Ordner werden bei diesem Nicht-Framework-Projekt nicht zuverlaessig
// erkannt). Kein Login: der Token IST die Berechtigung.
// Liefert alle Team-Termine (vergangene 30 Tage + alle zukuenftigen) als
// RFC-5545-Kalender. KEINE personenbezogenen Daten (keine Namen anderer
// Spieler, keine RSVPs, keine Strafen).
// Keine externen Abhaengigkeiten (globales fetch, Node 18+).

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

const PRODID   = "-//FC Fasanerie-Nord//Mannschafts-App//DE";
const UID_HOST = "fasanerie-nord.app";

function pad(n) { return String(n).padStart(2, "0"); }
function fmtUtc(d) {
  return d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) +
    "T" + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds()) + "Z";
}
function dateCompact(iso) { return String(iso).slice(0, 10).replace(/-/g, ""); }
function nextDayCompact(iso) {
  const d = new Date(String(iso).slice(0, 10) + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return fmtUtc(d).slice(0, 8);
}
function toMin(t) { const m = /^(\d{1,2}):(\d{2})/.exec(t || ""); return m ? (+m[1]) * 60 + (+m[2]) : null; }

// RFC 5545 Text-Escaping: Backslash zuerst, dann ; , und Zeilenumbrueche.
function esc(s) {
  return String(s == null ? "" : s)
    .replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}
// Zeilen auf 75 Oktette falten; Folgezeilen beginnen mit einem Leerzeichen
// (dieses zaehlt mit -> Folgezeilen auf 74 Oktette Inhalt begrenzt).
function fold(line) {
  if (Buffer.byteLength(line, "utf8") <= 75) return line;
  const pieces = [];
  let cur = "", curBytes = 0, limit = 75;
  for (const ch of line) {
    const b = Buffer.byteLength(ch, "utf8");
    if (curBytes + b > limit) { pieces.push(cur); cur = ch; curBytes = b; limit = 74; }
    else { cur += ch; curBytes += b; }
  }
  pieces.push(cur);
  return pieces.join("\r\n ");
}

async function sb(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  if (!r.ok) throw new Error("DB HTTP " + r.status);
  return r.json();
}

module.exports = async function handler(req, res) {
  try {
    if (!SUPABASE_URL || !SERVICE_KEY) return res.status(500).end();

    // Token aus der Query (Rewrite), ".ics" sicherheitshalber abschneiden, streng validieren.
    const token = String((req.query && req.query.token) || "").replace(/\.ics$/i, "").trim();
    if (!/^[a-f0-9]{32,128}$/i.test(token)) return res.status(404).send("Not found");

    // Token nachschlagen. Kein Treffer -> 404 ohne Existenz-Hinweis.
    const profs = await sb(`profiles?calendar_token=eq.${encodeURIComponent(token)}&select=club_id`);
    if (!Array.isArray(profs) || profs.length === 0) return res.status(404).send("Not found");
    let clubId = profs[0].club_id;

    // Verein (Teamname fuer X-WR-CALNAME / SUMMARY der Spiele).
    let club = null;
    if (clubId) {
      const c = await sb(`clubs?id=eq.${clubId}&select=team_name,name`);
      club = c && c[0];
    }
    if (!club) {
      const c = await sb(`clubs?slug=eq.fcfn&select=id,team_name,name`);
      club = c && c[0];
      if (club && !clubId) clubId = club.id;
    }
    const teamName = (club && (club.team_name || club.name)) || "FC Fasanerie-Nord";

    // Termine: vergangene 30 Tage + alle zukuenftigen.
    const cut = new Date(Date.now() - 30 * 86400000);
    const cutoff = `${cut.getUTCFullYear()}-${pad(cut.getUTCMonth() + 1)}-${pad(cut.getUTCDate())}`;
    const events = await sb(
      `events?club_id=eq.${clubId}&date=gte.${cutoff}` +
      `&select=id,type,title,opponent,home,date,time,ende,starts_at,location_raw,note,status,ical_seq` +
      `&order=date.asc`
    );

    const now = fmtUtc(new Date());
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:" + PRODID,
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:" + esc(teamName),
      "X-WR-TIMEZONE:Europe/Berlin",
      "X-PUBLISHED-TTL:PT2H",
      "REFRESH-INTERVAL;VALUE=DURATION:PT2H",
    ];

    for (const e of (events || [])) {
      lines.push("BEGIN:VEVENT");
      lines.push("UID:evt-" + e.id + "@" + UID_HOST);
      lines.push("DTSTAMP:" + now);

      const hasTime = e.time && String(e.time).trim() !== "";
      if (hasTime && e.starts_at) {
        const start = new Date(e.starts_at);
        const sMin = toMin(e.time), eMin = toMin(e.ende);
        let dur = (eMin != null && sMin != null) ? (eMin - sMin) : 120; // Default 2 h
        if (dur <= 0) dur += 1440; // ueber Mitternacht
        const end = new Date(start.getTime() + dur * 60000);
        lines.push("DTSTART:" + fmtUtc(start));
        lines.push("DTEND:" + fmtUtc(end));
      } else {
        // Ganztaegig (keine Startzeit)
        lines.push("DTSTART;VALUE=DATE:" + dateCompact(e.date));
        lines.push("DTEND;VALUE=DATE:" + nextDayCompact(e.date));
      }

      let summary;
      if (e.type === "spiel") {
        const opp = e.opponent || "";
        if (e.home === true) summary = `${teamName} - ${opp}`;
        else if (e.home === false) summary = `${opp} - ${teamName}`;
        else summary = e.title || `${teamName} - ${opp}`;
      } else {
        summary = e.title || "Termin";
      }
      lines.push("SUMMARY:" + esc(summary));

      if (e.location_raw && String(e.location_raw).trim()) lines.push("LOCATION:" + esc(e.location_raw));
      if (e.note && String(e.note).trim()) lines.push("DESCRIPTION:" + esc(e.note));
      if (e.status === "abgesagt") lines.push("STATUS:CANCELLED");
      lines.push("SEQUENCE:" + (Number(e.ical_seq) || 0));
      lines.push("END:VEVENT");
    }

    lines.push("END:VCALENDAR");

    const ics = lines.map(fold).join("\r\n") + "\r\n";
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", 'inline; filename="fasanerie-nord.ics"');
    res.setHeader("Cache-Control", "public, max-age=3600");
    return res.status(200).send(ics);
  } catch (err) {
    console.error("Kalender-Feed Fehler:", err);
    return res.status(500).end();
  }
};
