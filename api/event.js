// Einzelner Termin als .ics-Datei (Vercel Serverless Function, Node runtime).
// Oeffentliche URL: /api/event/<token>/<id>.ics -> per Rewrite in vercel.json
// auf /api/event?token=<token>&id=<id> abgebildet.
//
// Ergaenzt das Abo, ersetzt es nicht: auf Android laesst sich ein Abo nur
// ueber die Web-Oberflaeche von Google anlegen, ein einzelner Termin dagegen
// direkt speichern. Kein webcal, kein Abo - eine Datei, die das System an die
// Kalender-App uebergibt.
//
// Zwei bewusste Unterschiede zum Feed:
//   - KEIN X-WR-CALNAME. Mit Kalendernamen behandeln Android und iOS die Datei
//     als neuen Kalender; ohne ihn als Import in den bestehenden.
//   - Content-Disposition: attachment mit sprechendem, ASCII-bereinigtem Namen.
// Der VEVENT selbst kommt aus derselben Funktion wie im Feed (api/_ical.js),
// damit UID und Zeiten zeichengleich sind und der Kalender den abonnierten
// Termin trifft statt einen zweiten anzulegen.
//
// Berechtigung wie beim Feed: der Token IST die Berechtigung. Ein Termin, der
// nicht zum Verein des Tokens gehoert, existiert fuer diesen Endpunkt nicht.

const {
  PRODID, EVENT_SELECT, fmtUtc, fold, macheSb, summaryFor, veventLines,
} = require("./_ical.js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Dateiname aus Datum und Titel, streng ASCII: Umlaute ausgeschrieben, alles
// Uebrige auf Bindestriche. Reine Kosmetik - der Inhalt haengt nicht daran.
function dateiName(summary, datum) {
  const ascii = String(summary || "Termin")
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue")
    .replace(/Ä/g, "Ae").replace(/Ö/g, "Oe").replace(/Ü/g, "Ue")
    .replace(/ß/g, "ss")
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")   // restliche Diakritika
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  const tag = String(datum || "").slice(0, 10);
  return [tag, ascii].filter(Boolean).join("-").replace(/-+/g, "-") + ".ics";
}

module.exports = async function handler(req, res) {
  try {
    if (!SUPABASE_URL || !SERVICE_KEY) return res.status(500).end();
    const sb = macheSb(SUPABASE_URL, SERVICE_KEY);

    const q = req.query || {};
    const token = String(q.token || "").replace(/\.ics$/i, "").trim();
    const id    = String(q.id || "").replace(/\.ics$/i, "").trim();
    if (!/^[a-f0-9]{32,128}$/i.test(token)) return res.status(404).send("Not found");
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(id))  return res.status(404).send("Not found");

    // Token nachschlagen. Kein Treffer -> 404 ohne Existenz-Hinweis.
    const profs = await sb(`profiles?calendar_token=eq.${encodeURIComponent(token)}&select=club_id`);
    if (!Array.isArray(profs) || profs.length === 0) return res.status(404).send("Not found");
    let clubId = profs[0].club_id;

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

    // Der Vereinsfilter IST die Zugriffspruefung: ein fremder Termin liefert
    // keine Zeile und damit 404, ohne seine Existenz zu verraten.
    const rows = await sb(
      `events?id=eq.${encodeURIComponent(id)}&club_id=eq.${clubId}` +
      `&select=${EVENT_SELECT}&limit=1`
    );
    if (!Array.isArray(rows) || rows.length === 0) return res.status(404).send("Not found");
    const e = rows[0];

    // Koordinaten nur fuer diese eine Adresse holen.
    const coord = {};
    if (e.location_raw && String(e.location_raw).trim()) {
      try {
        const orte = await sb("sportstaetten?select=adresse_norm,lat,lng,name,adresse");
        for (const o of (orte || [])) {
          if (o.lat != null && o.lng != null) coord[o.adresse_norm] = o;
        }
      } catch (err) { /* ohne Koordinaten -> nur LOCATION, kein Fehler */ }
    }

    const now = fmtUtc(new Date());
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:" + PRODID,
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
    ];
    for (const l of veventLines(e, { teamName, coord, now })) lines.push(l);
    lines.push("END:VCALENDAR");

    const ics = lines.map(fold).join("\r\n") + "\r\n";
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="' + dateiName(summaryFor(e, teamName), e.date) + '"');
    res.setHeader("Cache-Control", "private, max-age=0, must-revalidate");
    return res.status(200).send(ics);
  } catch (err) {
    console.error("Einzeltermin-Fehler:", err);
    return res.status(500).end();
  }
};

module.exports.dateiName = dateiName;   // fuer die Pruefung
