// Gemeinsame iCal-Bausteine fuer api/calendar.js (Abo-Feed) und api/event.js
// (einzelner Termin). Der Unterstrich am Dateianfang haelt die Datei aus dem
// Routing heraus - Vercel macht daraus keinen Endpunkt.
//
// Warum gemeinsam: beide Ausgaben beschreiben denselben Termin. Waeren UID
// oder Zeitumrechnung auch nur um ein Zeichen verschieden, legte der Kalender
// beim Speichern einen zweiten Eintrag an, statt den vorhandenen zu treffen.
// Eine Kopie haette genau diese Abweichung frueher oder spaeter erzeugt.
//
// Keine externen Abhaengigkeiten (globales fetch, Node 18+).

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

// Aufgeraeumte Adresse fuer den Feed: Platz-Bezeichnungen als EXAKTE Abschnitte
// zwischen Kommas entfernen (nicht Teile von Strassennamen). location_raw in der
// DB bleibt unveraendert.
const PLATZ_DROP = new Set([
  "rasenplatz", "kunstrasenplatz", "kunstrasen", "nebenplatz", "hauptplatz", "halle", "stadion",
  "platz 1", "platz 2", "platz 3", "platz 4", "platz 5", "platz 6", "platz 7", "platz 8", "platz 9",
]);
function cleanAddr(raw) {
  return String(raw || "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !PLATZ_DROP.has(s.toLowerCase()))
    .join(", ")
    .replace(/\s{2,}/g, " ")
    .trim();
}
// Abgleichschluessel: klein, ohne Diakritika/Sonderzeichen (identisch in der UI).
function normAddr(s) {
  return String(s || "").toLowerCase().replace(/ä/g,"a").replace(/ö/g,"o").replace(/ü/g,"u").replace(/ß/g,"ss").replace(/[^a-z0-9]+/g, "");
}
function venueName(spielstaette, cleaned) {
  if (spielstaette && String(spielstaette).trim()) return String(spielstaette).trim();
  const first = String(cleaned || "").split(",")[0];
  return first ? first.trim() : "";
}

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

// Supabase-Lesezugriff mit dem Service-Key. Gibt eine gebundene Funktion
// zurueck, damit die Schluessel nicht durch jede Signatur gereicht werden.
function macheSb(supabaseUrl, serviceKey) {
  return async function sb(path) {
    const r = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    });
    if (!r.ok) throw new Error("DB HTTP " + r.status);
    return r.json();
  };
}

// Titel des Termins. Beim Spiel steht die Heimmannschaft vorn.
function summaryFor(e, teamName) {
  if (e.type === "spiel") {
    const opp = e.opponent || "";
    if (e.home === true) return `${teamName} - ${opp}`;
    if (e.home === false) return `${opp} - ${teamName}`;
    return e.title || `${teamName} - ${opp}`;
  }
  return e.title || "Termin";
}

// Die Zeilen EINES Termins, ungefaltet - Falten macht der Aufrufer am Schluss
// ueber alle Zeilen. Genau diese Funktion benutzen Feed und Einzeldatei, damit
// beide denselben VEVENT erzeugen.
//   e      Datensatz aus der Tabelle events
//   opts   { teamName, coord, now }  coord: Koordinaten je normalisierter
//          Adresse, now: DTSTAMP als bereits formatierter UTC-String
function veventLines(e, opts) {
  const teamName = opts.teamName;
  const coord = opts.coord || {};
  const now = opts.now;
  const lines = [];

  lines.push("BEGIN:VEVENT");
  lines.push("UID:evt-" + e.id + "@" + UID_HOST);
  lines.push("DTSTAMP:" + now);
  lines.push("LAST-MODIFIED:" + (e.updated_at ? fmtUtc(new Date(e.updated_at)) : now));

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

  lines.push("SUMMARY:" + esc(summaryFor(e, teamName)));

  if (e.location_raw && String(e.location_raw).trim()) {
    const cleaned = cleanAddr(e.location_raw);           // aufgeraeumte Feed-Adresse
    lines.push("LOCATION:" + esc(cleaned));
    // Falls Koordinaten vorliegen: GEO + Apple-Struktur -> antippbarer Ort.
    const geo = coord[normAddr(e.location_raw)];
    if (geo) {
      const lat = String(geo.lat), lng = String(geo.lng);
      const addr = cleaned.replace(/"/g, "");            // keine DQUOTE im Parameterwert
      const title = (venueName(e.spielstaette, cleaned) || cleaned).replace(/"/g, "");
      lines.push("GEO:" + lat + ";" + lng);
      lines.push(`X-APPLE-STRUCTURED-LOCATION;VALUE=URI;X-ADDRESS="${addr}";X-APPLE-RADIUS=100;X-TITLE="${title}":geo:${lat},${lng}`);
    }
  }
  if (e.note && String(e.note).trim()) lines.push("DESCRIPTION:" + esc(e.note));
  if (e.status === "abgesagt") lines.push("STATUS:CANCELLED");
  lines.push("SEQUENCE:" + (Number(e.ical_seq) || 0));
  lines.push("END:VEVENT");
  return lines;
}

// Die Spalten, die veventLines() liest - damit beide Endpunkte dasselbe holen.
const EVENT_SELECT =
  "id,type,title,opponent,home,date,time,ende,starts_at,location_raw,spielstaette,note,status,ical_seq,updated_at";

module.exports = {
  PRODID, UID_HOST, EVENT_SELECT, PLATZ_DROP,
  pad, fmtUtc, dateCompact, nextDayCompact, toMin,
  cleanAddr, normAddr, venueName, esc, fold,
  macheSb, summaryFor, veventLines,
};
