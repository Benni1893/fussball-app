// Persoenlicher iCal-Feed (Vercel Serverless Function, Node runtime).
// Oeffentliche URL: /api/calendar/<token>.ics  -> per Rewrite in vercel.json
// auf /api/calendar?token=<token> abgebildet (dynamische [param]-Routen im
// /api-Ordner werden bei diesem Nicht-Framework-Projekt nicht zuverlaessig
// erkannt). Kein Login: der Token IST die Berechtigung.
// Liefert alle Team-Termine (vergangene 30 Tage + alle zukuenftigen) als
// RFC-5545-Kalender. KEINE personenbezogenen Daten (keine Namen anderer
// Spieler, keine RSVPs, keine Strafen).
// Die iCal-Bausteine liegen in api/_ical.js, geteilt mit api/event.js.
// Keine externen Abhaengigkeiten (globales fetch, Node 18+).

const {
  PRODID, EVENT_SELECT, pad, fmtUtc, normAddr, esc, fold, macheSb, veventLines,
} = require("./_ical.js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

module.exports = async function handler(req, res) {
  try {
    if (!SUPABASE_URL || !SERVICE_KEY) return res.status(500).end();
    const sb = macheSb(SUPABASE_URL, SERVICE_KEY);

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
      `&select=${EVENT_SELECT}` +
      `&order=date.asc`
    );

    // Koordinaten je Sportstaette (Abgleich ueber normalisierte Adresse).
    const coord = {};
    try {
      const orte = await sb("sportstaetten?select=adresse_norm,lat,lng,name,adresse");
      for (const o of (orte || [])) {
        if (o.lat != null && o.lng != null) coord[o.adresse_norm] = o;
      }
    } catch (e) { /* ohne Koordinaten -> nur LOCATION, kein Fehler */ }

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
      for (const l of veventLines(e, { teamName, coord, now })) lines.push(l);
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
