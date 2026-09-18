/* ===========================================================================
   FC Fasanerie-Nord – Mannschafts-App · Anwendungslogik
   Reines Vanilla-JS. Daten kommen aus Supabase (siehe db.js); Zu-/Absagen und
   der bezahlt-Status werden direkt in der Datenbank gespeichert.
   =========================================================================== */
(function () {
  "use strict";

  // Build-Kennung (muss zur HTML-Build-Kennung in index.html passen). Bei jedem Deploy hochziehen.
  var APP_BUILD = "2026-09-18-H";
  try { window.__APP_BUILD = APP_BUILD; window.__boot && window.__boot("app.js:loaded (build " + APP_BUILD + ")"); } catch (e) {}
  function boot(ph) { try { window.__boot && window.__boot(ph); } catch (e) {} }

  // Wandelt ein Date in einen lokalen ISO-Datumsstring (YYYY-MM-DD) um.
  function toISODate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  const HEUTE = toISODate(new Date()); // echtes heutiges Datum

  // PayPal.Me-Link (Betrag wird übergeben). Echter Vereins-/Kassen-Name (paypal.me/Teamkassefasanerie,
  // Konto "Benjamin Lauck") – verifiziert gueltig. Betrag MUSS mit Punkt (12.50), nie mit Komma.
  const PAYPAL_ME = "Teamkassefasanerie";
  function paypalMeLink(betrag) {
    // PayPal.Me erwartet den Betrag mit PUNKT (12.50), NICHT mit Komma -> sonst leere/kaputte Seite.
    const n = Number(String(betrag).replace(",", "."));
    const amount = (isFinite(n) && n > 0 ? n : 0).toFixed(2);   // "12.50"
    return `https://paypal.me/${PAYPAL_ME}/${amount}EUR`;
  }

  /* ---------------------------------------------------------------------------
     Datenzustand
       DEMO  = aus Supabase geladene Daten (gleiche Form wie früher data.js)
       state = { currentPlayerId,
                 rsvp:  { "<eventId>|<playerId>": { status:"zu"|"ab", grund? } },
                 paid:  { "<strafeId>": true|false } }
     --------------------------------------------------------------------------- */
  let DEMO = null;
  let state = { currentPlayerId: null, rsvp: {}, paid: {} };

  // Baut den App-Zustand aus den frisch aus Supabase geladenen Daten auf.
  function buildStateFromData() {
    state.rsvp = {};
    DEMO.rsvps.forEach((r) => {
      state.rsvp[r.eventId + "|" + r.playerId] = { status: r.status, grund: r.grund || "" };
    });
    state.paid = {};
    DEMO.strafen.forEach((s) => { state.paid[s.id] = s.bezahlt; });
    // Standard-Spieler: Lukas Weber (Code p10), sonst der erste im Kader.
    const def = DEMO.players.find((p) => p.code === "p10") || DEMO.players[0];
    state.currentPlayerId = def ? def.id : null;
  }

  /* ---------------------------------------------------------------------------
     Hilfsfunktionen
     --------------------------------------------------------------------------- */
  const WT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
  const WT_LANG = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
  const MON = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
  const MON_LANG = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];

  function parseDate(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  function fmtDay(iso)   { return parseDate(iso).getDate(); }
  function fmtMon(iso)   { return MON[parseDate(iso).getMonth()]; }
  function fmtWd(iso)    { return WT[parseDate(iso).getDay()]; }
  function fmtLong(iso)  { const dt = parseDate(iso); return `${WT[dt.getDay()]}, ${dt.getDate()}. ${MON_LANG[dt.getMonth()]} ${dt.getFullYear()}`; }
  function isFuture(iso) { return iso >= HEUTE; }
  function euro(n)       { return n.toLocaleString("de-DE", { style: "currency", currency: "EUR" }); }
  function fmtTs(iso) {
    try { return new Date(iso).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }); }
    catch (e) { return ""; }
  }

  let playerById = {};  // wird in init() nach dem Laden befüllt
  let katById    = {};

  function initials(name) {
    return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  /* ---- Fitness-/Verletztenstatus ----------------------------------------- */
  /* ---------- Fitnessstatus: eine Quelle fuer alle drei Orte ----------------
     Uebersicht ("Mein Status"), Profil und Kader zeichnen dieselben vier Chips
     und dieselben Zusatzfelder. Geschrieben wird ausschliesslich ueber
     set_player_status(); die Datenbank entscheidet, wer darf - Spieler nur sich
     selbst, coach/admin alle (Migration 0026, erweitert in 0031 um "urlaub").
     -------------------------------------------------------------------------- */
  const STATUS_WAHL = [
    ["fit", "fit"],
    ["angeschlagen", "angeschlagen"],
    ["verletzt", "verletzt"],
    ["urlaub", "Urlaub"],
  ];
  // "urlaub" zaehlt ueberall wie verletzt: nicht einsatzbereit.
  function istFit(p) { return !p || !p.status || p.status === "fit"; }

  /* Chips plus - bei allem ausser "fit" - Datum und Notiz. Die Felder speichern
     beim Verlassen, es gibt keinen Knopf. */
  function statusWahlHtml(p, opts) {
    opts = opts || {};
    const st = p.status || "fit";
    const chips = STATUS_WAHL.map(([wert, label]) =>
      `<button class="chip st-choice${st === wert ? " is-on st-" + wert : ""}" data-status-set="${p.id}" data-wert="${wert}">${label}</button>`
    ).join("");
    const felder = istFit(p) ? "" : `
      <div class="st-felder">
        <label class="st-feld">
          <span class="lbl">voraussichtlich bis</span>
          <input class="kasse-in" type="date" data-status-until="${p.id}" value="${esc(p.statusUntil || "")}" aria-label="voraussichtlich bis">
        </label>
        <label class="st-feld">
          <span class="lbl">Notiz</span>
          <input class="kasse-in" type="text" data-status-note="${p.id}" value="${esc(p.statusNote || "")}" placeholder="optional" aria-label="Notiz zum Status">
        </label>
      </div>`;
    return `<div class="st-wahl"${opts.kompakt ? ' data-kompakt=""' : ""}>
      <div class="chips st-chips">${chips}</div>${felder}
    </div>`;
  }

  /* Status schreiben und kurz bestaetigen. Datum und Notiz kommen aus den
     Feldern derselben Gruppe, damit ein Chipwechsel sie nicht verwirft. */
  async function statusSpeichern(playerId, status, opts) {
    opts = opts || {};
    const feld = (was) => {
      const el = viewEl.querySelector(`[data-status-${was}="${playerId}"]`);
      return el ? el.value : null;
    };
    const until = status === "fit" ? null : (opts.until !== undefined ? opts.until : feld("until"));
    const note  = status === "fit" ? null : (opts.note  !== undefined ? opts.note  : feld("note"));
    try {
      await DB.setPlayerStatus(playerId, status, note, until);
      await reloadData();
      render();
      tvToast("gespeichert");
    } catch (err) {
      window.alert("Status konnte nicht gesetzt werden: " + ((err && err.message) || err));
    }
  }

  function statusInfo(status) {
    if (status === "verletzt")     return { label: "verletzt", cls: "st-red" };
    if (status === "angeschlagen") return { label: "angeschlagen", cls: "st-amber" };
    if (status === "urlaub")       return { label: "Urlaub", cls: "st-grau" };
    return null; // fit -> keine Marke
  }
  // Kleines Status-Badge neben einem Spielernamen (leer, wenn fit).
  function statusBadge(player) {
    const i = player && statusInfo(player.status);
    if (!i) return "";
    return ` <span class="st-badge ${i.cls}" title="${i.label}">${i.label}</span>`;
  }
  // Nachname für die alphabetische Sortierung (letztes Wort des Namens).
  function nachname(name) {
    const parts = String(name).trim().split(/\s+/);
    return parts[parts.length - 1] || name;
  }
  // Bezeichnung einer Strafe: Schnappschuss bevorzugt, sonst Katalog (falls noch da).
  function vergehenName(s) {
    if (s.vergehen) return s.vergehen;
    const k = katById[s.katalogId];
    return (k && k.vergehen) || "—";
  }

  /* ---- Statusmodell (Migration 0030): offen | gemeldet | bestätigt | storniert ----
     Der Status kommt aus der DB. istBezahlt bedeutet ab jetzt „bestätigt eingegangen". */
  function fineStatus(strafe) {
    return strafe.status || (strafe.bezahlt ? (strafe.selfReported ? "gemeldet" : "bestätigt") : "offen");
  }
  function istBezahlt(strafe) { return fineStatus(strafe) === "bestätigt"; }
  function istStorniert(strafe) { return fineStatus(strafe) === "storniert"; }
  // Aktive Strafen = alles außer storniert (zählt für Summen/Listen).
  function aktiveStrafen() { return DEMO.strafen.filter((s) => !istStorniert(s)); }
  const STATUS_META = {
    offen:      { label: "offen",           cls: "badge-open" },
    gemeldet:   { label: "gemeldet",        cls: "badge-self" },
    "bestätigt": { label: "eingegangen",    cls: "badge-paid" },
    storniert:  { label: "storniert",       cls: "badge-cancel" },
  };
  function statusBadgeHtml(strafe) {
    const m = STATUS_META[fineStatus(strafe)] || STATUS_META.offen;
    return `<span class="badge ${m.cls}">${m.label}</span>`;
  }
  const ZAHLART_LABEL = { bar: "bar", ueberweisung: "Überweisung", paypal: "PayPal" };
  /* =========================================================================
     MAHNZUSCHLAG – EINE zentrale Logik für Betrag UND Countdown.
     Diese Formel ist 1:1 identisch zur SQL-Funktion apply_fine_surcharges()
     (siehe Migration 0007). Frist startet ab created_at (Anlage durch den
     Kassenwart), NICHT ab dem Vergehens-Datum. Regel: ab 7 Tagen +2 €, je
     weitere angefangene Woche +2 €, Deckel 5 Stufen / 10 €.
     ========================================================================= */
  const MAHN_STUFE_EUR  = 2;
  const MAHN_MAX_STUFEN = 5;
  const WOCHE_MS        = 7 * 24 * 60 * 60 * 1000;

  // Fällige Stufen zum Zeitpunkt nowMs (gleiche Floor-Schwelle wie der Cron).
  function faelligeStufen(strafe, nowMs) {
    if (!strafe.createdAt) return 0;
    const start = new Date(strafe.createdAt).getTime();
    if (!isFinite(start)) return 0;
    const elapsed = nowMs - start;
    if (elapsed <= 0) return 0;
    return Math.min(MAHN_MAX_STUFEN, Math.floor(elapsed / WOCHE_MS));
  }

  // Grundbetrag: gespeicherter Schnappschuss, sonst aktueller Katalogwert.
  function grundBetrag(strafe) {
    if (strafe.grundbetrag != null) return strafe.grundbetrag;
    const k = katById[strafe.katalogId];
    return k ? k.betrag : 0;
  }
  // Mahnzuschlag in €: OFFEN -> live aus created_at; BEZAHLT -> eingefrorener
  // DB-Wert (der Trigger fines_settle_on_paid friert genau diesen Wert ein).
  function zuschlagBetrag(strafe) {
    if (istBezahlt(strafe)) return Number(strafe.zuschlag) || 0;
    return faelligeStufen(strafe, Date.now()) * MAHN_STUFE_EUR;
  }
  // >>> DIE EINZIGE Betragsfunktion der App: Grundbetrag + Mahnzuschlag. <<<
  function strafeBetrag(strafe) { return grundBetrag(strafe) + zuschlagBetrag(strafe); }

  // Offene Gesamtsumme eines Spielers – nur strikt OFFENE (nicht gemeldet/storniert).
  function summeOffenSpieler(playerId) {
    return DEMO.strafen
      .filter((s) => s.playerId === playerId && fineStatus(s) === "offen")
      .reduce((a, s) => a + strafeBetrag(s), 0);
  }

  /* ---- Countdown bis zur nächsten Erhöhung (Anzeige) --------------------- */
  // Liefert { capped } ODER { capped:false, remMs } – Restzeit bis +2 €.
  function mahnCountdown(strafe, nowMs) {
    const stufen = faelligeStufen(strafe, nowMs);
    if (stufen >= MAHN_MAX_STUFEN) return { capped: true };
    const start = new Date(strafe.createdAt).getTime();
    const ziel  = start + (stufen + 1) * WOCHE_MS; // Zeitpunkt der nächsten Stufe
    return { capped: false, remMs: ziel - nowMs };
  }
  // Restzeit hübsch formatieren. compact = mobile Kurzform (z. B. „3T 14h").
  function fmtRestzeit(ms, compact) {
    let s = Math.floor(ms / 1000);
    const d = Math.floor(s / 86400); s -= d * 86400;
    const h = Math.floor(s / 3600);  s -= h * 3600;
    const m = Math.floor(s / 60);    s -= m * 60;
    const p2 = (n) => String(n).padStart(2, "0");
    if (compact) {
      if (d > 0) return `${d}T ${h}h`;
      if (h > 0) return `${h}h ${p2(m)}m`;
      return `${p2(m)}:${p2(s)}`;
    }
    return `${d}T ${p2(h)}:${p2(m)}:${p2(s)}`;
  }
  // Startzeitpunkt eines Termins in ms (bevorzugt der Server-Wert starts_at).
  function eventStartMs(e) {
    if (e.startsAt) { const t = new Date(e.startsAt).getTime(); if (isFinite(t)) return t; }
    const zeit = (e.zeit && /^\d{1,2}:\d{2}$/.test(e.zeit)) ? e.zeit : "00:00";
    const t = new Date(`${e.datum}T${zeit}:00`).getTime();
    return isFinite(t) ? t : null;
  }
  // Meldeschluss: Spiel 24 h, Training 3 h vor Beginn. null, wenn nicht relevant.
  /* Ende eines Termins in Millisekunden. Mit hinterlegtem Ende genau das,
     sonst Beginn plus 2 h beim Spiel und plus 1,5 h beim Training. Ohne Zeit
     laeuft der Termin bis Mitternacht. (A1) */
  function terminEndeMs(e) {
    const start = eventStartMs(e);
    const tagEnde = parseDate(e.datum).getTime() + 24 * 60 * 60 * 1000;
    if (start == null) return tagEnde;
    if (!e.zeit) return tagEnde;
    if (e.ende && /^\d{1,2}:\d{2}$/.test(e.ende)) {
      const t = new Date(`${e.datum}T${e.ende}:00`).getTime();
      if (isFinite(t)) return t > start ? t : t + 24 * 60 * 60 * 1000;   // ueber Mitternacht
    }
    return start + (e.typ === "spiel" ? 120 : 90) * 60 * 1000;
  }
  // Termin laeuft noch oder steht bevor.
  function istOffen(e) { return terminEndeMs(e) > Date.now(); }

  function meldeschlussMs(e) {
    if (e.typ !== "spiel" && e.typ !== "training") return null;
    const start = eventStartMs(e);
    if (start == null) return null;
    return start - (e.typ === "spiel" ? 24 : 3) * 60 * 60 * 1000;
  }

  function dringlichkeitClass(ms) {
    if (ms < 24 * 60 * 60 * 1000) return "cd-red";    // < 24 h
    if (ms < 3 * 24 * 60 * 60 * 1000) return "cd-amber"; // < 3 Tage
    return "cd-neutral";
  }

  /* ---- Live-Timer: aktualisiert alle Countdown-Felder sekündlich ---------
     Zwei Typen:
       [data-cd-created] = Mahnzuschlag (wochenbasiert, Strafen-Konto)
       [data-cd-deadline] = Meldeschluss-Countdown (fixer Zielzeitpunkt, Kalender) */
  let countdownTimer = null;
  function stopCountdowns() {
    if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
  }
  function tickCountdowns() {
    const now = Date.now();
    const els = viewEl.querySelectorAll("[data-cd-created],[data-cd-deadline]");
    // 1) Neuzeichnen nötig? (Mahn-Stufe erreicht ODER Meldeschluss vorbei)
    for (const el of els) {
      if (el.hasAttribute("data-cd-created")) {
        const liveStufe = faelligeStufen({ createdAt: el.getAttribute("data-cd-created") }, now);
        if (liveStufe > Number(el.getAttribute("data-cd-step") || "0")) {
          if (currentView === "strafen") { renderStrafen(); return; } // Betrag springt live mit
        }
      } else {
        const target = new Date(el.getAttribute("data-cd-deadline")).getTime();
        if (isFinite(target) && now >= target) {
          if (currentView === "kalender") { renderKalender(); return; } // Karte schaltet auf Warnung
        }
      }
    }
    // 2) Texte/Farben aktualisieren
    const compact = window.innerWidth < 560;
    els.forEach((el) => {
      el.classList.remove("cd-neutral", "cd-amber", "cd-red", "cd-capped", "cd-due");
      if (el.hasAttribute("data-cd-created")) {
        const info = mahnCountdown({ createdAt: el.getAttribute("data-cd-created") }, now);
        if (info.capped) {
          el.textContent = "Max. Zuschlag erreicht"; el.classList.add("cd-capped");
        } else if (info.remMs <= 0) {
          el.textContent = "Erhöhung steht an"; el.classList.add("cd-due");
        } else {
          el.textContent = fmtRestzeit(info.remMs, compact) + (compact ? "" : " bis +2 €");
          el.classList.add(dringlichkeitClass(info.remMs));
        }
      } else {
        const target = new Date(el.getAttribute("data-cd-deadline")).getTime();
        const rem = isFinite(target) ? target - now : 0;
        if (rem <= 0) { el.textContent = "abgelaufen"; el.classList.add("cd-due"); }
        else { el.textContent = fmtRestzeit(rem, compact); el.classList.add(dringlichkeitClass(rem)); }
      }
    });
  }
  function startCountdowns() {
    stopCountdowns();
    if (!viewEl.querySelector("[data-cd-created],[data-cd-deadline]")) return;
    tickCountdowns();                 // sofort füllen (kein 1-Sekunden-Flash)
    countdownTimer = setInterval(tickCountdowns, 1000);
  }

  /* ---------------------------------------------------------------------------
     Mini-Diagramme (reines SVG, ohne Bibliothek)
     --------------------------------------------------------------------------- */
  // Ring-/Donut-Diagramm aus Segmenten [{ value, color }]
  function donutChart(segments, opts = {}) {
    const size = 170, thick = 26;
    const total = segments.reduce((a, s) => a + s.value, 0) || 1;
    const r = (size - thick) / 2, c = size / 2, circ = 2 * Math.PI * r;
    let offset = 0;
    const arcs = segments.map((s) => {
      const dash = (s.value / total) * circ;
      const el = `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${s.color}" stroke-width="${thick}" stroke-dasharray="${dash.toFixed(2)} ${(circ - dash).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}"></circle>`;
      offset += dash;
      return el;
    }).join("");
    return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" class="donut" role="img" aria-label="Diagramm">
      <g transform="rotate(-90 ${c} ${c})">
        <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="#eef2ef" stroke-width="${thick}"></circle>
        ${arcs}
      </g>
      ${opts.centerTop ? `<text x="${c}" y="${c - 2}" text-anchor="middle" class="donut-top">${opts.centerTop}</text>` : ""}
      ${opts.centerBottom ? `<text x="${c}" y="${c + 20}" text-anchor="middle" class="donut-bot">${opts.centerBottom}</text>` : ""}
    </svg>`;
  }

  /* ---------------------------------------------------------------------------
     Ansichten
     --------------------------------------------------------------------------- */
  const viewEl = document.getElementById("view");
  let currentView = "dashboard";
  // Ansichten, die im „Mehr"-Menü liegen: dort bleibt der Mehr-Tab aktiv markiert.
  // EINE Liste für beide Stellen (tvSetNavActive und switchView) – vorher standen
  // hier zwei Kopien, was bei jeder neuen Ansicht still auseinanderlaufen konnte.
  const SHEET_VIEWS = ["admin", "einstellungen", "lineup", "kader"];

  // Fallback-Ansicht statt weißem Bildschirm, wenn beim Rendern etwas wirft.
  function renderErrorBoundary(err) {
    try { console.error("Render-Fehler:", err); } catch (e) {}
    try {
      viewEl.innerHTML =
        '<div class="page-head"><h1>Etwas ist schiefgelaufen</h1></div>' +
        '<div class="card card-pad"><p style="margin:0 0 12px">Diese Ansicht konnte nicht geladen werden.</p>' +
        '<p style="margin:0 0 14px;color:var(--muted);font-size:.85rem">' + esc((err && err.message) || String(err)) + '</p>' +
        '<button class="btn btn-primary" data-goto="dashboard">Zurück zur Übersicht</button></div>';
    } catch (e) {}
  }
  function render() {
    stopCountdowns(); // Timer der vorigen Ansicht sauber aufräumen
    closeAllSheets(); // kein Sheet darf über der neuen Ansicht hängen bleiben
    try {
      if (currentView !== "lineup") { lbTeardownPanels(); tvTeardownPanels(); } // Aufstellungs-Panels nur dort
      if (currentView === "dashboard") renderDashboard();
      else if (currentView === "kalender") renderKalender();
      else if (currentView === "katalog") renderKatalog();
      else if (currentView === "strafen") renderStrafen();
      else if (currentView === "einstellungen") renderEinstellungen();
      else if (currentView === "profil") renderProfil();
      else if (currentView === "kader") { if (Roles.canManageEvents()) renderKader(); else renderDashboard(); }
      else if (currentView === "lineup") { if (Roles.canManageEvents()) { if (LINEUP_V2) renderLineupV2(); else renderLineup(); } else renderDashboard(); }
      else if (currentView === "kasse") { if (Roles.canManageFines()) renderKasse(); else renderDashboard(); }
      else if (currentView === "admin") { if (Roles.isAdmin()) renderAdmin(); else renderDashboard(); }
    } catch (err) { renderErrorBoundary(err); }
  }

  // (Globales Fehler-Logging + Diagnose-Seite liegen inline in index.html — auch aktiv, wenn app.js fehlt.)

  // Daten frisch aus Supabase holen und die aktuelle Ansicht neu rendern.
  async function reloadData() {
    DEMO = await DB.loadAll();
    playerById = Object.fromEntries(DEMO.players.map((p) => [p.id, p]));
    katById    = Object.fromEntries(DEMO.katalog.map((k) => [k.id, k]));
    buildStateFromData();
    if (currentProfile && currentProfile.player_id) state.currentPlayerId = currentProfile.player_id;
    render();
  }

  /* ---------- Übersicht ----------------------------------------------------- */
  let bfvMsg = ""; // letzte Rückmeldung des Spielplan-Syncs
  let bfvEditing = false; // BFV-Eingabefeld sichtbar (statt Mannschaftsname)

  // Aus einer eingefügten bfv.de-Adresse die 32-stellige teamPermanentId ziehen.
  function extractTeamId(input) {
    const parts = String(input || "").split(/[^0-9a-zA-Z]+/);
    return parts.find((p) => p.length === 32) || null;
  }
  function bfvIcalUrl(id) { return "https://service.bfv.de/rest/icsexport/teammatches/teamPermanentId/" + id; }
  /* Termin-Hero der Übersicht (Paket 3). Baut auf den vorhandenen Bausteinen auf:
     RSVP-Logik (data-rsvp/data-event), Spielstätten-Link, Meldeschluss-Helfer.
     Trainer/Admin sehen Zusagezähler + Absprünge, Spieler den eigenen Meldeschluss. */
  /* ---------- Uebersicht (Vorlage 1a/1b) ------------------------------------
     1a = Trainer/Kassenwart, 1b = Spieler. Beide teilen Hero, Aufgabenblock und
     Spieltag-Karte; unterschiedlich sind nur die Knopfzeile im Hero und der
     Geldblock (Trainer: zwei Kacheln, Spieler: voller Kontoblock).
     -------------------------------------------------------------------------- */

  // "Heute Abend" / "Morgen" / "Sonntag" - die Vorlage beschriftet den Hero
  // umgangssprachlich, nicht mit einem Datum.
  function wannLabel(e) {
    const d = parseDate(e.datum);
    const heute = parseDate(HEUTE);
    const tage = Math.round((d - heute) / 86400000);
    const std = e.zeit ? parseInt(String(e.zeit).slice(0, 2), 10) : NaN;
    const abend = !isNaN(std) && std >= 17;
    if (tage === 0) return abend ? "Heute Abend" : "Heute";
    if (tage === 1) return abend ? "Morgen Abend" : "Morgen";
    return WT_LANG[d.getDay()];
  }
  // Kurzer Name des Termins fuer Hero und Spieltag-Karte: beim Spiel der Gegner,
  // sonst der Titel. (Die volle Paarung steht auf der Terminkarte im Kalender.)
  function terminName(e) {
    return esc(e.typ === "spiel" ? (e.gegner || e.titel) : e.titel);
  }
  function heimLabel(e) {
    if (e.typ !== "spiel" || e.heim == null) return "";
    return e.heim ? "Heim" : "Auswärts";
  }
  // Spieler ohne Rueckmeldung zu einem Termin, nach Nachnamen sortiert.
  function ohneRueckmeldung(e) {
    return DEMO.players
      .filter((p) => !(state.rsvp[e.id + "|" + p.id] || {}).status)
      .sort((a, b) => nachname(a.name).localeCompare(nachname(b.name), "de"));
  }
  // Rollen-Plakette neben der Anrede. Hoechste Rolle gewinnt, Spieler tragen keine.
  function rollenPillHtml() {
    const r = Roles.isAdmin() ? "ADMIN"
      : Roles.has("coach") ? "TRAINER"
      : Roles.has("treasurer") ? "KASSENWART" : "";
    return r ? `<span class="role-pill">${r}</span>` : "";
  }

  /* „N erinnern" (Gate S2, Weg b): kein Versand-Backend, sondern ein fertiger
     Text zum Teilen - dieselbe Mechanik wie „Kader-Info erstellen". */
  function erinnernText(e) {
    const offen = ohneRueckmeldung(e);
    const kopf = (e.typ === "spiel" ? (e.heim ? "Heimspiel gegen " : "Auswärtsspiel bei ") + (e.gegner || e.titel) : e.titel)
      + "\n" + fmtWd(e.datum) + " " + fmtDay(e.datum) + ". " + fmtMon(e.datum)
      + (e.zeit ? " · " + e.zeit + " Uhr" : "");
    if (!offen.length) return kopf + "\n\nAlle haben sich zurückgemeldet.";
    return kopf + "\n\nBitte noch zurückmelden:\n" + offen.map((p) => p.name).join("\n");
  }


  /* Aufgabenblock „Was heute liegt".
     Datengetrieben: jede Zeile erscheint nur, wenn die Rolle zustaendig ist UND
     die Datenlage sie erfordert. Zeilen kombinieren sich frei; wer mehrere Rollen
     hat, sieht die Summe. Ohne zutreffende Zeile entfaellt der Block ganz.
     lineups sind fuer Spieler per RLS nicht lesbar - die Aufstellungszeile wird
     fuer sie deshalb gar nicht erst gebaut. */
  function aufgabenZeilen(naechstes) {
    const zeilen = [];
    const me = playerById[state.currentPlayerId];
    const linked = !!(currentProfile && currentProfile.player_id && me);
    const offenTermin = naechstes && naechstes.status !== "abgesagt";

    // --- Spieler: eigene Rueckmeldung fehlt -----------------------------------
    if (linked && offenTermin) {
      const r = state.rsvp[naechstes.id + "|" + me.id] || {};
      if (!r.status) {
        zeilen.push({
          art: "rsvp", zahl: "!", titel: "Rückmeldung fehlt",
          sub: eventKurz(naechstes), attr: 'data-task-focus="rsvp"',
        });
      }
    }

    // --- Kassenwart/Admin: gemeldete Zahlungen pruefen -------------------------
    if (Roles.canManageFines()) {
      const gemeldet = aktiveStrafen().filter((s) => fineStatus(s) === "gemeldet");
      if (gemeldet.length) {
        // A4: „seit N Tagen" aus dem Verlauf - der Wechsel nach „gemeldet",
        // geladen in db.js aus fine_status_log. Ohne Verlaufseintrag (alte
        // Meldungen vor Migration 0030) bleibt die Zeitangabe weg.
        const marken = gemeldet.map((s) => s.gemeldetAm).filter(Boolean).sort();
        let seit = "warten auf Eingang";
        if (marken.length) {
          const tage = Math.floor((Date.now() - new Date(marken[0]).getTime()) / 86400000);
          seit = tage <= 0 ? "seit heute" : tage === 1 ? "seit einem Tag" : "seit " + tage + " Tagen";
        }
        zeilen.push({
          art: "pay", zahl: gemeldet.length,
          titel: gemeldet.length === 1 ? "Zahlung bestätigen" : "Zahlungen bestätigen",
          sub: "Kassenwart · " + seit, attr: "data-task-pay",
        });
      }
    }

    // --- Trainer/Admin: unvollstaendige Aufstellung + fehlende Rueckmeldungen ---
    if (Roles.canManageEvents()) {
      const spiel = DEMO.events
        .filter((e) => e.typ === "spiel" && istOffen(e) && e.status !== "abgesagt")
        .sort((a, b) => (eventStartMs(a) || 0) - (eventStartMs(b) || 0))[0];
      if (spiel) {
        const lu = (DEMO.lineups || []).find((l) => l.eventId === spiel.id && l.isActive && !l.isTemplate);
        const slots = lu ? (FORMATIONS[lu.formation] || []) : [];
        const gesetzt = lu ? slots.map((s) => (lu.slots || {})[s.key]).filter(Boolean).length : 0;
        const vollstaendig = !!(lu && slots.length && gesetzt === slots.length);
        if (!vollstaendig) {
          zeilen.push({
            art: "lineup", zahl: gesetzt,
            titel: "Aufstellung " + fmtWd(spiel.datum) + " " + fmtDay(spiel.datum) + ". " + fmtMon(spiel.datum),
            sub: gesetzt + " von " + (slots.length || 11) + " gesetzt",
            attr: 'data-lineup-edit="' + spiel.id + '"',
          });
        }
      }
      if (offenTermin) {
        const ohne = ohneRueckmeldung(naechstes).length;
        if (ohne > 0) {
          zeilen.push({
            art: "rsvp", zahl: ohne, titel: "Ohne Rückmeldung",
            sub: "Erinnerung senden", attr: 'data-rsvp-sheet="' + naechstes.id + '"',
          });
        }
      }
    }

    // Keine Zeile fuer Schuldenfreiheit: der Block zeigt nur, was zu tun ist.
    // Trifft nichts zu, entfaellt er samt Ueberschrift.
    return zeilen;
  }
  // Kurzbezeichnung eines Termins fuer die Unterzeile der Aufgabenliste.
  function eventKurz(e) {
    const wann = fmtWd(e.datum) + " " + fmtDay(e.datum) + ". " + fmtMon(e.datum);
    if (e.typ === "spiel") return wann + " · " + (e.heim ? "vs. " : "@ ") + esc(e.gegner || e.titel);
    return wann + " · " + esc(e.titel);
  }
  function aufgabenBlockHtml(naechstes) {
    const zeilen = aufgabenZeilen(naechstes);
    if (!zeilen.length) return "";
    return `
      <div class="section-title"><h2>Was heute liegt</h2></div>
      <div class="task-list">
        ${zeilen.map((z) => `
          <div class="task-row is-${z.art}"${z.attr ? " " + z.attr + ' role="button" tabindex="0"' : ""}>
            <span class="task-num">${z.zahl}</span>
            <div class="task-main">
              <div class="task-title">${z.titel}</div>
              ${z.sub ? `<div class="task-sub">${z.sub}</div>` : ""}
            </div>
            ${z.attr ? `<span class="task-go" aria-hidden="true">›</span>` : ""}
          </div>`).join("")}
      </div>`;
  }

  /* Spieltag-Karte: das naechste Spiel mit Gegner, Ort, Kennzahlen und den
     Handlungen der jeweiligen Rolle. Trainer bekommt Aufstellung und Kader-Info,
     Spieler seine Zu-/Absage samt Meldeschluss. */


  function renderDashboard() {
    const me = playerById[state.currentPlayerId];
    // A1: „naechster Termin" heisst noch nicht zu Ende, nicht „heute oder
    // spaeter". Sonst steht ein Spiel von 15:00 abends um acht noch als HEUTE
    // im Hero. Sortiert wird nach Beginn, nicht nur nach Datum.
    const naechste = DEMO.events.filter(istOffen)
      .sort((a, b) => (eventStartMs(a) || 0) - (eventStartMs(b) || 0));
    const naechstes = naechste[0];
    const trainer = Roles.canManageEvents();

    // Naechstes Spiel fuer die Spieltag-Karte. Ist es bereits der Hero-Termin,
    // entfaellt die Karte - sonst stuende derselbe Termin zweimal untereinander.
    const spiel = naechste.find((e) => e.typ === "spiel" && e.status !== "abgesagt");
    const spieltag = (spiel && naechstes && spiel.id === naechstes.id) ? null : spiel;

    // „Danach": alles nach dem Hero, ohne den Termin der Spieltag-Karte.
    const danach = naechste
      .filter((e) => (!naechstes || e.id !== naechstes.id) && (!spieltag || e.id !== spieltag.id))
      .slice(0, 3);

    const kontoVerknuepft = !!(currentProfile && currentProfile.player_id && me);
    const meinOffen  = kontoVerknuepft ? summeOffenSpieler(me.id) : 0;
    // A2: der Filter stand auf "bezahlt", der Status heisst aber "bestätigt" -
    // die Summe war deshalb immer 0,00 EUR. Die Zeile zeigt jetzt, was sie
    // verspricht: die offenen Strafen des Teams.
    const teamOffen = aktiveStrafen()
      .filter((s) => fineStatus(s) === "offen")
      .reduce((a, s) => a + strafeBetrag(s), 0);

    // A3: Wer verknuepft ist und offene Strafen hat, sieht den Kontoblock mit
    // dem Bezahlweg - auch als Trainer oder Kassenwart.
    // A5: Die Zeile "Meine Strafen" gibt es nur noch fuer Konten OHNE
    // Spielerzuordnung. Ist verknuepft und offen, traegt der Kontoblock den
    // Betrag; ist verknuepft und nichts offen, sagt das die gruene Zeile im
    // Aufgabenblock - eine Null-Zeile daneben waere leeres Gewicht.
    const eigenerBlock = (kontoVerknuepft && meinOffen > 0) ? kontoBlockHtml() : "";
    const teamZeile = (trainer || Roles.canManageFines())
      ? `<div class="geld-rows">
          ${!kontoVerknuepft ? `<button class="card geld" data-nav="meine-strafen">
            <span class="geld-main"><span class="geld-lbl">Meine Strafen</span>
            <span class="geld-wert num">${euro(meinOffen)}</span></span>
            <span class="geld-chev" aria-hidden="true">›</span>
          </button>` : ""}
          <button class="card geld" data-nav="kasse">
            <span class="geld-main"><span class="geld-lbl">Mannschaftskasse</span>
            <span class="geld-wert num${teamOffen > 0 ? " is-warn" : ""}">${euro(teamOffen)}</span></span>
            <span class="geld-chev" aria-hidden="true">›</span>
          </button>
        </div>`
      : "";
    const geld = eigenerBlock + teamZeile;

    viewEl.innerHTML = `
      <div class="page-head h1row">
        <h1>Servus, ${esc(me.name.split(" ")[0])}</h1>
        ${rollenPillHtml()}
      </div>

      ${naechstes ? terminKarteHtml(naechstes, { hero: true })
        : `<div class="card card-pad"><div class="lbl">Nächster Termin</div><div class="empty">Keine kommenden Termine.</div></div>`}

      ${aufgabenBlockHtml(naechstes)}

      ${(!trainer && !Roles.canManageFines() && eigenerBlock)
        ? `<div class="section-title"><h2>Mein Konto</h2><button class="link-btn" data-goto="strafen">Alle Strafen</button></div>` : ""}
      ${geld}

      ${spieltag ? `<div class="section-title sec-mini"><h2>Nächstes Spiel</h2><button class="link-btn" data-goto="kalender">Kalender &rsaquo;</button></div>
      ${terminKarteHtml(spieltag, { hero: true })}` : ""}

      ${danach.length ? `<div class="section-title sec-mini"><h2>Danach</h2>${spieltag ? "" : `<button class="link-btn" data-goto="kalender">Kalender &rsaquo;</button>`}</div>
      <div class="card dn-liste">${danach.map(danachZeileHtml).join("")}</div>` : ""}

      ${kontoVerknuepft ? `<div class="section-title sec-mini"><h2>Mein Status</h2></div>
      ${statusWahlHtml(me, { kompakt: true })}` : ""}
    `;

    startCountdowns(); // Meldeschluss-Countdown im Hero und in der Spieltag-Karte
  }

  /* ---------- Kader (Trainer/Admin) -----------------------------------------
     Status setzen ueber dieselben vier Chips wie auf der Uebersicht und im
     Profil - ein Baustein, drei Orte. Bei allem ausser "fit" stehen Datum und
     Notiz inline unter der Zeile und speichern beim Verlassen des Feldes.
     Schranke ist die Datenbank: player_status liest nur coach/admin
     vollstaendig, geschrieben wird ausschliesslich ueber set_player_status(). */
  function renderKader() {
    const kaderSort = [...DEMO.players].sort((a, b) => nachname(a.name).localeCompare(nachname(b.name), "de"));
    // Lazarett: alle nicht Fitten - Urlaub eingeschlossen. Sortiert nach
    // Rueckkehrdatum; wer keines hat, steht hinten.
    const lazarett = DEMO.players
      .filter((p) => !istFit(p))
      .sort((a, b) => {
        const x = a.statusUntil || "9999-12-31", y = b.statusUntil || "9999-12-31";
        return x.localeCompare(y) || nachname(a.name).localeCompare(nachname(b.name), "de");
      });
    const fit = DEMO.players.filter(istFit).length;

    viewEl.innerHTML = `
      <div class="page-head">${navBackChevronHtml()}<h1>Kader</h1></div>

      <div class="kpi-grid kpi-3">
        <div class="kpi">
          <div class="kpi-label">Spieler</div>
          <div class="kpi-value">${DEMO.players.length}</div>
          <div class="kpi-sub">im Kader</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">Fit</div>
          <div class="kpi-value">${fit}</div>
          <div class="kpi-sub">einsatzbereit</div>
        </div>
        <div class="kpi ${lazarett.length ? "is-warn" : ""}">
          <div class="kpi-label">Nicht fit</div>
          <div class="kpi-value">${lazarett.length}</div>
          <div class="kpi-sub">angeschlagen, verletzt oder im Urlaub</div>
        </div>
      </div>

      <div class="section-title"><h2>Kader-Status</h2></div>
      <div class="kad-list">
        ${kaderSort.map((p) => `
          <div class="card kad-row${istFit(p) ? "" : " is-raus"}">
            <div class="kad-kopf">
              <span class="avatar">${initials(p.name)}</span>
              <span class="kad-name">${esc(p.name)}${statusBadge(p)}</span>
            </div>
            ${statusWahlHtml(p)}
          </div>`).join("")}
      </div>

      <div class="section-title"><h2>Lazarett</h2></div>
      ${lazarett.length ? `<div class="laz-list">
        ${lazarett.map((p) => {
          const i = statusInfo(p.status);
          const zeilen = [
            p.statusSince ? "seit " + fmtDay(p.statusSince) + ". " + fmtMon(p.statusSince) : "",
            p.statusUntil ? "zurück " + fmtDay(p.statusUntil) + ". " + fmtMon(p.statusUntil) : "offenes Ende",
          ].filter(Boolean).join(" · ");
          return `<div class="card laz-row">
            <span class="avatar">${initials(p.name)}</span>
            <div class="laz-main">
              <div class="laz-name">${esc(p.name)}</div>
              <div class="rs">${zeilen}</div>
              ${p.statusNote ? `<div class="laz-note">${esc(p.statusNote)}</div>` : ""}
            </div>
            ${i ? `<span class="st-badge ${i.cls}">${i.label}</span>` : ""}
          </div>`;
        }).join("")}
      </div>` : `<div class="card card-pad"><div class="empty">Alle fit – kein Eintrag</div></div>`}
    `;
  }

  // Adress-Bereinigung + Norm-Schlüssel – IDENTISCH zur Feed-Funktion in api/calendar.js,
  // damit die Koordinaten-Zuordnung matcht.
  const PLATZ_DROP = new Set([
    "rasenplatz", "kunstrasenplatz", "kunstrasen", "nebenplatz", "hauptplatz", "halle", "stadion",
    "platz 1", "platz 2", "platz 3", "platz 4", "platz 5", "platz 6", "platz 7", "platz 8", "platz 9",
  ]);
  function cleanAddr(raw) {
    return String(raw || "").split(",").map((s) => s.trim())
      .filter((s) => s.length > 0 && !PLATZ_DROP.has(s.toLowerCase()))
      .join(", ").replace(/\s{2,}/g, " ").trim();
  }
  function normAddr(s) {
    return String(s || "").toLowerCase().replace(/ä/g, "a").replace(/ö/g, "o").replace(/ü/g, "u").replace(/ß/g, "ss").replace(/[^a-z0-9]+/g, "");
  }
  // Sportstätten aus dem Spielplan, denen noch Koordinaten fehlen.
  function missingCoordVenues() {
    const hasCoord = {};
    for (const s of (DEMO.sportstaetten || [])) if (s.lat != null && s.lng != null) hasCoord[s.norm] = true;
    const seen = {}, list = [];
    for (const e of DEMO.events) {
      const raw = (e.locationRaw || "").trim();
      if (!raw) continue;
      const norm = normAddr(raw);
      if (!norm || seen[norm] || hasCoord[norm]) continue;
      seen[norm] = true;
      const cleaned = cleanAddr(raw);
      const name = (e.spielstaette && e.spielstaette.trim()) || (cleaned.split(",")[0] || "").trim();
      list.push({ norm, name, adresse: cleaned });
    }
    return list.sort((a, b) => a.name.localeCompare(b.name, "de"));
  }
  function sportstaettenCardHtml() {
    const list = missingCoordVenues();
    return `
      <div class="section-title set-sub"><h3>Sportstätten-Koordinaten</h3></div>
      <div class="card card-pad koord-card">
        <p class="koord-desc">Damit Adressen im abonnierten Kalender antippbar werden, brauchen sie Koordinaten. In Google Maps: Ort lange drücken/rechtsklicken → die zwei Zahlen sind <b>lat</b> (Breite) und <b>lng</b> (Länge).</p>
        ${list.length ? list.map((v) => `
          <div class="koord-row" data-koord-norm="${esc(v.norm)}" data-koord-name="${esc(v.name)}" data-koord-adresse="${esc(v.adresse)}">
            <div class="koord-info"><div class="koord-name">${esc(v.name)}</div><div class="koord-adr">${esc(v.adresse)}</div></div>
            <div class="koord-inputs">
              <input class="koord-lat" type="text" inputmode="decimal" placeholder="lat" aria-label="Breitengrad">
              <input class="koord-lng" type="text" inputmode="decimal" placeholder="lng" aria-label="Längengrad">
              <button class="btn btn-primary koord-save" data-koord-save>Speichern</button>
            </div>
          </div>`).join("") : `<div class="empty" style="padding:14px 0">Alle Sportstätten im Spielplan haben Koordinaten.</div>`}
      </div>`;
  }

  /* ---------- Kalender ------------------------------------------------------ */
  let kalFilter = "alle";

  // Persoenlicher iCal-Feed ("In meinen Kalender")
  let calendarToken = null;
  function calendarSubscribeUrl() {
    return calendarToken ? window.location.origin + "/api/calendar/" + calendarToken + ".ics" : "";
  }
  async function ensureCalendarToken() {
    if (calendarToken) return calendarToken;
    try { calendarToken = await DB.myCalendarToken(); } catch (e) { calendarToken = null; }
    return calendarToken;
  }
  // Kalender-Icon (mit +) für den Abo-Button. (Plus-Icon: siehe ICON_PLUS weiter unten.)
  const ICON_CAL_ADD = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M3 9h18M8 2.5v4M16 2.5v4M12 13v4M10 15h4"/></svg>`;

  function closeCalSheet() { const ex = document.getElementById("calSheet"); if (ex) { ex.remove(); unlockBodyScroll(); } }
  // Bottom-Sheet „In meinen Kalender" (aus der Kalender-Kopfzeile geöffnet).
  async function openCalSheet() {
    closeCalSheet();
    await ensureCalendarToken();
    const https = calendarSubscribeUrl();
    const webcal = https ? https.replace(/^https?:/i, "webcal:") : "#";
    const ov = document.createElement("div");
    ov.className = "more-sheet"; ov.id = "calSheet";
    ov.innerHTML = `
      <button class="more-backdrop" data-sheet-close aria-label="Schließen"></button>
      <div class="more-panel" role="dialog" aria-modal="true">
        <div class="more-title">In meinen Kalender</div>
        <p class="sheet-desc">Alle Termine automatisch in deinem Handy-Kalender.</p>
        <a class="btn btn-primary cal-add" data-cal-open href="${esc(webcal)}"${https ? "" : ' aria-disabled="true"'}>Zum Kalender hinzufügen</a>
        <div class="cal-copied" data-cal-copied hidden></div>
        <div class="sheet-links">
          <button class="link-btn" data-cal-copy>Link kopieren</button>
          <button class="link-btn cal-reset" data-cal-regen>Link zurücksetzen</button>
        </div>
      </div>`;
    document.body.appendChild(ov);
    lockBodyScroll();
    const q = (s) => ov.querySelector(s);
    const feedback = (txt) => { const fb = q("[data-cal-copied]"); if (fb) { fb.textContent = txt; fb.hidden = false; setTimeout(() => { fb.hidden = true; }, 1800); } };

    ov.addEventListener("click", (e) => { if (e.target === ov || e.target.closest("[data-sheet-close]")) closeCalSheet(); });
    sheetSwipeToClose(ov.querySelector(".more-panel"), null, closeCalSheet);
    q("[data-cal-open]").addEventListener("click", () => setTimeout(closeCalSheet, 150)); // nach dem Abo-Sprung schließen
    q("[data-cal-copy]").addEventListener("click", async () => {
      const url = calendarSubscribeUrl(); if (!url) return;
      feedback((await copyText(url)) ? "Link kopiert" : "Kopieren nicht möglich");
    });
    q("[data-cal-regen]").addEventListener("click", async () => {
      if (!window.confirm("Der alte Link funktioniert danach nicht mehr. Wirklich zurücksetzen?")) return;
      try {
        calendarToken = await DB.regenerateCalendarToken();
        const nu = calendarSubscribeUrl();
        const open = q("[data-cal-open]");
        if (open && nu) { open.setAttribute("href", nu.replace(/^https?:/i, "webcal:")); open.removeAttribute("aria-disabled"); }
        feedback("Neuer Link erstellt");
      } catch (err) { window.alert("Fehlgeschlagen: " + ((err && err.message) || err)); }
    });
  }

  /* ---------- Rückmeldungen-Blatt (Trainer/Admin) ---------------------------
     Aufbau nach .design-sync/reference/trainer-sheet-v2.png, alle Masse dort
     gemessen. Die drei Kacheln sind zugleich der Filter: angetippt zeigt die
     Liste genau diese Gruppe. Die Vorlage zeigt „Offen" ausgewaehlt, und das
     ist auch der Zustand, mit dem das Blatt aufgeht - dort ist etwas zu tun.
     Daten liegen bereits im Speicher. Die eigentliche Schranke ist die RLS:
     rsvps_sel (Migration 0024) gibt fremde Antworten nur an coach/admin
     heraus - ein Spieler bekaeme hier gar keine fremden Zeilen. */
  var rsFilter = "offen";

  function closeRsvpSheet() {
    const ex = document.getElementById("rsvpSheet");
    if (ex) { ex.remove(); unlockBodyScroll(); }
  }

  // Gruppen eines Termins, jeweils nach Nachnamen sortiert.
  function rsGruppen(eventId) {
    const zu = [], ab = [], offen = [];
    DEMO.players.forEach((p) => {
      const r = state.rsvp[eventId + "|" + p.id] || {};
      if (r.status === "zu") zu.push({ p: p, grund: "" });
      else if (r.status === "ab") ab.push({ p: p, grund: r.grund || "" });
      else offen.push({ p: p, grund: "" });
    });
    const byName = (a, b) => nachname(a.p.name).localeCompare(nachname(b.p.name), "de");
    [zu, ab, offen].forEach((l) => l.sort(byName));
    return { zu: zu, ab: ab, offen: offen };
  }

  // Unterzeile: Datum, Art und - wenn die Automatik laeuft - die Frist.
  function rsKopfzeile(e) {
    const teile = [fmtWd(e.datum) + " " + fmtDay(e.datum) + ". " + fmtMon(e.datum),
                   e.typ === "spiel" ? ((e.gegner || e.titel)) : (e.titel || "Training")];
    const dl = meldeschlussMs(e);
    if (dl != null && Date.now() < dl) {
      const d = new Date(dl);
      teile.push("Frist " + WT[d.getDay()] + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"));
    }
    return teile.join(" · ");
  }

  /* Vollstaendige Uebersicht zum Teilen - dieselbe Mechanik wie
     „Kader-Info erstellen" und „N erinnern" (Gate S2, Weg b). */
  function rueckmeldeText(e) {
    const g = rsGruppen(e.id);
    const kopf = (e.typ === "spiel" ? (e.heim ? "Heimspiel gegen " : "Auswärtsspiel bei ") + (e.gegner || e.titel) : e.titel)
      + "\n" + fmtWd(e.datum) + " " + fmtDay(e.datum) + ". " + fmtMon(e.datum)
      + (e.zeit ? " · " + e.zeit + " Uhr" : "");
    const block = (titel, list) => "\n\n" + titel + " (" + list.length + ")"
      + (list.length ? "\n" + list.map((x) => x.p.name + (x.grund ? " – " + x.grund : "")).join("\n") : "\n–");
    return kopf + block("Zugesagt", g.zu) + block("Abgesagt", g.ab) + block("Offen", g.offen);
  }

  function rsvpSheetHtml(e) {
    const g = rsGruppen(e.id);
    const gesamt = DEMO.players.length;
    const pz = gesamt ? (g.zu.length / gesamt) * 100 : 0;
    const liste = rsFilter === "zu" ? g.zu : rsFilter === "ab" ? g.ab : g.offen;

    const kachel = (schl, label, n) =>
      '<button class="rs2-kachel' + (rsFilter === schl ? " is-on" : "") + '" data-rsfilter="' + schl + '"' +
      ' aria-pressed="' + (rsFilter === schl ? "true" : "false") + '">' +
      '<span class="rs2-k-l">' + label + '</span><span class="rs2-k-z num">' + n + '</span></button>';

    const zeile = (x) => '<div class="rs2-zeile">' +
      '<span class="rs2-av">' + initials(x.p.name) + '</span>' +
      '<span class="rs2-n">' + esc(x.p.name) +
      (x.grund ? '<span class="rs2-grund">' + esc(x.grund) + '</span>' : "") + '</span></div>';

    return '<button class="more-backdrop" data-sheet-close aria-label="Schließen"></button>' +
      '<div class="more-panel rs2-panel" role="dialog" aria-modal="true" aria-label="Rückmeldungen">' +
      '<div class="rs2-griff" aria-hidden="true"></div>' +
      '<div class="rs2-kopf"><div class="rs2-kopf-text">' +
        '<div class="rs2-titel">Rückmeldungen</div>' +
        '<div class="rs2-sub num">' + esc(rsKopfzeile(e)) + '</div></div>' +
        '<button class="rs2-zu" data-sheet-close aria-label="Schließen">&#10005;</button></div>' +
      '<div class="rs2-bar" role="img" aria-label="' + g.zu.length + ' von ' + gesamt + ' zugesagt">' +
        '<i style="width:' + pz.toFixed(2) + '%"></i></div>' +
      '<div class="rs2-kacheln">' +
        kachel("zu", "Zugesagt", g.zu.length) +
        kachel("ab", "Abgesagt", g.ab.length) +
        kachel("offen", "Offen", g.offen.length) + '</div>' +
      '<div class="rs2-liste">' +
        (liste.length ? liste.map(zeile).join("")
                      : '<div class="rs2-leer">niemand in dieser Gruppe</div>') + '</div>' +
      '<div class="rs2-fuss">' +
        (g.offen.length
          ? '<button class="rs2-btn" data-rs-erinnern="' + e.id + '">Alle ' + g.offen.length + ' erinnern</button>'
          : "") +
        '<button class="rs2-btn2' + (g.offen.length ? "" : " is-weit") + '" data-rs-teilen="' + e.id + '">Teilen</button>' +
      '</div></div>';
  }

  function openRsvpSheet(eventId) {
    if (!Roles.canManageEvents()) return;   // zweite Schranke; RLS ist die erste
    const e = DEMO.events.find((x) => x.id === eventId);
    if (!e) return;
    closeRsvpSheet();
    rsFilter = "offen";

    const ov = document.createElement("div");
    ov.className = "more-sheet"; ov.id = "rsvpSheet";
    ov.innerHTML = rsvpSheetHtml(e);
    document.body.appendChild(ov);
    lockBodyScroll();

    const neuZeichnen = () => {
      ov.innerHTML = rsvpSheetHtml(e);
      sheetSwipeToClose(ov.querySelector(".more-panel"), ov.querySelector(".rs2-liste"), closeRsvpSheet);
    };
    ov.addEventListener("click", (ev) => {
      const f = ev.target.closest("[data-rsfilter]");
      if (f) { rsFilter = f.dataset.rsfilter; neuZeichnen(); return; }
      if (ev.target.closest("[data-rs-erinnern]")) { openShareModal("Erinnerung", erinnernText(e)); return; }
      if (ev.target.closest("[data-rs-teilen]")) { openShareModal("Rückmeldungen", rueckmeldeText(e)); return; }
      if (ev.target === ov || ev.target.closest("[data-sheet-close]")) closeRsvpSheet();
    });
    sheetSwipeToClose(ov.querySelector(".more-panel"), ov.querySelector(".rs2-liste"), closeRsvpSheet);
  }

  function renderKalender() {
    const filters = [
      { k: "alle", label: "Alle" },
      { k: "spiel", label: "Spiele" },
      { k: "training", label: "Training" },
      { k: "sonstiges", label: "Sonstiges" },
    ];
    const liste = DEMO.events
      .filter((e) => kalFilter === "alle" || e.typ === kalFilter)
      .sort((a, b) => a.datum.localeCompare(b.datum));
    const kommend = liste.filter((e) => isFuture(e.datum));
    const vergangen = liste.filter((e) => !isFuture(e.datum));

    viewEl.innerHTML = `
      <div class="page-head">${navBackChevronHtml()}<h1>Kalender</h1></div>
      <div class="seg" role="tablist">
        ${filters.map((f) => `<button class="seg-b ${kalFilter === f.k ? "is-on" : ""}" role="tab" aria-selected="${kalFilter === f.k}" data-filter="${f.k}">${f.label}</button>`).join("")}
      </div>
      ${Roles.canManageSchedule() ? `<button class="btn btn-primary kal-neu" data-termin-new>${ICON_PLUS}<span>Termin hinzufügen</span></button>` : ""}
      <button class="card kal-abo" data-cal-sheet type="button">
        <span class="kal-abo-ic" aria-hidden="true">${ICON_CAL_ADD}</span>
        <span class="kal-abo-main"><span class="kal-abo-t">In meinen Kalender</span>
        <span class="kal-abo-s">Alle Termine im iPhone-Kalender abonnieren</span></span>
        <span class="kal-abo-chev" aria-hidden="true">›</span>
      </button>
      ${kommend.length ? `<div class="event-list">${kommend.map((e) => terminKarteHtml(e)).join("")}</div>`
                       : `<div class="empty">Keine kommenden Termine in dieser Auswahl.</div>`}
      ${vergangen.length ? `
        <div class="section-title kal-past-title"><h2>Vergangene Termine</h2></div>
        <div class="event-list is-past">${vergangen.map((e) => terminKarteHtml(e)).join("")}</div>` : ""}
    `;

    startCountdowns(); // Meldeschluss-Countdowns dieser Ansicht live halten
  }

  // Spielplan-BFV-Bereich (nur Admin). Zwei Zustände: konfiguriert (Mannschaftsname
  // + Zeitstempel + Aktualisieren) oder Eingabe (bfv.de-Adresse einfügen).
  function bfvSectionHtml() {
    const configured = DEMO.icalUrl && !bfvEditing;
    const syncTxt = DEMO.icalSyncedAt ? fmtTs(DEMO.icalSyncedAt) + " Uhr" : "noch nie";
    const msg = bfvMsg ? `<div class="bfv-msg">${esc(bfvMsg)}</div>` : "";
    const body = configured ? `
        <div class="bfv-team">
          <div><span class="set-label">Mannschaft</span><div class="bfv-team-name">${esc(DEMO.teamName || "—")}</div></div>
          <button class="link-btn bfv-change" data-bfv-change>Ändern</button>
        </div>
        <div class="bfv-hint">Zuletzt aktualisiert: ${esc(syncTxt)}. Läuft zusätzlich täglich automatisch.</div>
        ${msg}
        <div class="bfv-actions"><button class="btn btn-primary" data-bfv-sync>Jetzt aktualisieren</button></div>
      ` : `
        <label class="bfv-label" for="bfvUrl">Adresse der Mannschaftsseite von bfv.de hier einfügen</label>
        <input id="bfvUrl" class="bfv-url" data-ical-input type="url" inputmode="url" autocapitalize="off" spellcheck="false"
               placeholder="https://www.bfv.de/mannschaften/…">
        ${msg}
        <div class="bfv-actions">
          <button class="btn btn-primary" data-bfv-connect>Speichern</button>
          ${DEMO.icalUrl ? `<button class="btn" data-bfv-cancel>Abbrechen</button>` : ""}
        </div>
      `;
    return `
      <div class="section-title set-sub"><h3>Spielplan (BFV)</h3></div>
      <div class="card card-pad bfv-card">${body}</div>`;
  }

  /* ---------- Einstellungen (Tab „Mehr") ------------------------------------ */
  function renderEinstellungen() {
    document.body.classList.remove("auth-mode");
    const u = currentProfile || {};
    const player = u.player_id ? playerById[u.player_id] : null;
    const name = player ? player.name : (u.email || "—");
    const email = u.email || "—";
    const roleText = Roles.list.length ? Roles.list.map((r) => ROLE_LABEL[r] || r).join(" · ") : "Spieler";
    const verwaltung = Roles.canManageSchedule() || Roles.canEditCatalog();
    // Phase 3: Sportstaetten-Koordinaten-Verwaltung ausgeblendet (DB + Feed bleiben aktiv).
    // ZUM REAKTIVIEREN diese eine Zeile auf sportstaettenCardHtml() setzen:
    const sportstaettenCard = ""; /* = sportstaettenCardHtml(); */

    viewEl.innerHTML = `
      <div class="page-head"><h1>Einstellungen</h1></div>

      <div class="set-section">
        <div class="section-title"><h2>Mein Profil</h2></div>
        <div class="card card-pad set-profile">
          <div class="set-greet-name">Angemeldet als ${esc(name)}</div>
          <div class="set-greet-role">${esc(roleText)}</div>
          <div class="set-row"><span class="set-label">E-Mail</span><span class="set-val">${esc(email)}</span></div>
          ${u.player_id ? `<button class="btn" data-view-jump="profil" style="width:100%;margin-top:12px">Profil öffnen</button>` : ""}
          <button class="btn set-logout" data-logout>Abmelden</button>
        </div>
      </div>

      ${verwaltung ? `
      <div class="set-verwaltung">
        <div class="section-title"><h2>Verwaltung</h2></div>

        ${Roles.isAdmin() ? bfvSectionHtml() : ""}

        ${sportstaettenCard}

        <div class="section-title set-sub"><h3>Strafenkatalog</h3></div>
        <div class="card card-pad">
          <p class="set-hint">Vergehen und Beträge werden im Katalog gepflegt.</p>
          <button class="btn" data-goto="katalog">Strafenkatalog öffnen</button>
        </div>
      </div>` : ""}
      <p class="set-hint" style="text-align:center;margin-top:22px;opacity:.6">Build ${esc(APP_BUILD)}${(window.__HTML_BUILD && window.__HTML_BUILD !== APP_BUILD) ? " · HTML " + esc(window.__HTML_BUILD) + " (Versionen unterschiedlich – evtl. Cache)" : ""} · <a href="?debug=1" style="color:inherit">Diagnose</a></p>
    `;
  }

  /* ---------- Profil (Spieler-Tab): eigener Fitnessstatus ------------------- */
  /* ---------- Profil (Vorlage 4b) -------------------------------------------
     Kopfkarte mit Avatar und Rueckennummer, eigener Fitnessstatus, darunter die
     eigenen Rueckmeldungen zu den naechsten Terminen. */
  function renderProfil() {
    document.body.classList.remove("auth-mode");
    const u = currentProfile || {};
    const player = u.player_id ? playerById[u.player_id] : null;
    const name = player ? player.name : (u.email || "—");
    const roleText = Roles.list.length ? Roles.list.map((r) => ROLE_LABEL[r] || r).join(" · ") : "Spieler";
    const nr = player && player.nr != null ? " · Nr. " + player.nr : "";

    // Eigene Rueckmeldungen zu den naechsten Terminen. Zugesagt gruen,
    // abgesagt rot, ohne Antwort gold - dieselben Toene wie ueberall sonst.
    let rueck = "";
    if (player) {
      const kommend = DEMO.events.filter((e) => isFuture(e.datum))
        .sort((a, b) => a.datum.localeCompare(b.datum)).slice(0, 5);
      if (kommend.length) {
        rueck = `
          <div class="section-title"><h2>Meine Rückmeldungen</h2></div>
          <div class="pr-list">
            ${kommend.map((e) => {
              const r = state.rsvp[e.id + "|" + player.id] || {};
              const art = r.status === "zu" ? "zu" : r.status === "ab" ? "ab" : "offen";
              const badge = art === "zu" ? `<span class="badge badge-paid">Zusage</span>`
                : art === "ab" ? `<span class="badge badge-open">Absage</span>`
                : `<span class="badge badge-self">offen</span>`;
              const titel = (e.typ === "spiel" ? "Spiel " : e.typ === "training" ? "Training " : "")
                + fmtWd(e.datum) + " " + fmtDay(e.datum) + ". " + fmtMon(e.datum);
              const sub = art === "offen" ? "Noch keine Rückmeldung"
                : (art === "zu" ? "Zugesagt" : "Abgesagt") + (r.grund ? " · " + esc(r.grund) : "");
              return `<div class="pr-row">
                <span class="pr-bar is-${art}" aria-hidden="true"></span>
                <div class="pr-main"><div class="pr-t">${esc(titel)}</div><div class="rs">${sub}</div></div>
                ${badge}
              </div>`;
            }).join("")}
          </div>`;
      }
    }

    viewEl.innerHTML = `
      <div class="page-head"><h1>Profil</h1></div>
      <div class="card pr-head">
        <span class="avatar pr-av">${initials(name)}</span>
        <div><div class="pr-name">${esc(name)}</div><div class="rs">${esc(roleText)}${nr}</div></div>
      </div>
      ${player ? `
      <div class="section-title"><h2>Mein Fitnessstatus</h2></div>
      <div class="card card-pad">
        <p class="rs">Sag dem Trainerteam, wie es dir geht.</p>
        ${statusWahlHtml(player)}
      </div>
      ${rueck}` : `<div class="empty" style="padding:24px 0">Dein Konto ist noch keinem Spieler zugeordnet. Melde dich beim Trainerteam.</div>`}
    `;
  }

  // Eigener Teamname aus den Einstellungen (Fallback, falls noch nicht gesynct).
  function ownTeamName() { return (DEMO && DEMO.teamName) || "FC Fasanerie-Nord"; }
  // Gemeinsame Paarungs-Darstellung: IMMER "Heim – Gast"; eigenes Team fett (HTML).
  function paarung(e) {
    const ownHtml = `<span class="team-own">${esc(ownTeamName())}</span>`;
    const oppHtml = `<span class="team-opp">${esc(e.gegner || "Gegner")}</span>`;
    return e.heim ? { home: ownHtml, away: oppHtml } : { home: oppHtml, away: ownHtml };
  }
  // Reine Textvariante (KPI/Nachrichten), gleiche Reihenfolge.
  function paarungText(e) {
    const own = ownTeamName(), gegner = e.gegner || "Gegner";
    return e.heim ? `${own} – ${gegner}` : `${gegner} – ${own}`;
  }

  // Spielstätte als Karten-Link (Google Maps). Nur wenn Spielstätte UND Adresse
  // vorhanden sind -> sonst normaler Text (kein toter Link).
  const VENUE_PIN = `<svg class="venue-pin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-6-5.3-6-10a6 6 0 0 1 12 0c0 4.7-6 10-6 10z"/><circle cx="12" cy="11" r="2.2"/></svg>`;
  const ICON_PENCIL = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>`;
  function venueHtml(e) {
    const staette  = (e.spielstaette || "").trim();
    const adr      = (e.adresse || "").trim();
    const fallback = (e.ort || "").trim();
    const raw      = (e.locationRaw || "").trim();
    // Für den Maps-Link ausschließlich den vollständigen Rohwert verwenden.
    // Fallback (staette + adresse) nur für Spiele, die noch vor dem Nachfüllen
    // von location_raw importiert wurden.
    const query = raw || (staette && adr ? staette + ", " + adr : "");
    if (query) {
      const label = staette || fallback || query; // Sportanlagen-Name bleibt sichtbar
      const url = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(query);
      return `<a class="venue-link" href="${url}" target="_blank" rel="noopener noreferrer" title="${esc(query)}">${VENUE_PIN}<span>${esc(label)}</span></a>`;
    }
    const text = fallback || staette || adr;
    return text ? `<span>${esc(text)}</span>` : "";
  }

  // Meldeschluss-Hinweis/Countdown (nur Spiele & Trainings mit aktiver Automatik).
  // Gemeinsam genutzt von der Terminkarte und vom Termin-Hero der Übersicht –
  // damit beide Orte dieselbe Frist zeigen und nur eine Stelle gepflegt wird.
  function fristBlockHtml(e) {
    if (!isFuture(e.datum) || e.auto === false || (e.typ !== "spiel" && e.typ !== "training")) return "";
    const dl = meldeschlussMs(e);
    const start = eventStartMs(e);
    const now = Date.now();
    if (dl != null && now < dl) {
      return `<div class="frist"><span class="frist-label">Meldeschluss:</span> <span class="cd" data-cd-deadline="${new Date(dl).toISOString()}"></span></div>`;
    }
    if (start != null && now < start) {
      const noResp = e.typ === "spiel" ? "25 €" : "15 €";
      return `<div class="frist frist-warn">Meldeschluss vorbei – Rückmeldung jetzt kostet 8 €, keine Rückmeldung ${noResp}.</div>`;
    }
    return "";
  }
  /* Ort fuer die Terminkarte: Name, Adresse und der Weg zur Karten-App.
     Gibt die Teile einzeln zurueck, weil die Vorlage sie in drei Spalten legt. */
  function ortTeile(e) {
    const staette  = (e.spielstaette || "").trim();
    const adr      = (e.adresse || "").trim();
    const fallback = (e.ort || "").trim();
    const raw      = (e.locationRaw || "").trim();
    const query = raw || (staette && adr ? staette + ", " + adr : "");
    const name  = staette || fallback || adr;
    if (!name && !query) return null;
    return {
      name: name || query,
      adresse: staette ? (adr || fallback) : "",
      url: query ? "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(query) : "",
    };
  }
  /* Zeile unter „Danach" (Vorlage termin-und-kalender-v2): cremefarbene
     Datumskachel, Titel, Zeit und rechts der eigene Zustand. Alle Zeilen
     liegen in EINER Karte mit Haarlinien dazwischen. */
  function danachZeileHtml(e) {
    const r = state.rsvp[e.id + "|" + state.currentPlayerId] || {};
    const zustand = r.status === "zu" ? ["Zugesagt", "is-zu"]
                  : r.status === "ab" ? ["Abgesagt", "is-ab"] : ["Offen", "is-offen"];
    const zeit = e.zeit ? esc(e.zeit) + (e.ende ? " &#8211; " + esc(e.ende) : "") + " Uhr" : "";
    const titel = e.typ === "spiel" ? esc(e.gegner || e.titel) : esc(e.titel);
    const heim = (e.typ === "spiel" && e.heim != null) ? (e.heim ? "Heim" : "Auswärts") : "";
    return `<button class="dn-zeile" data-nav-event="${e.id}">
      <span class="tk-datum"><span class="d-wd">${fmtWd(e.datum)}</span>
        <span class="d-day num">${fmtDay(e.datum)}</span>
        <span class="d-mon">${fmtMon(e.datum)}</span></span>
      <span class="dn-main"><span class="dn-t">${titel}</span>
        <span class="dn-s num">${heim ? `<b>${heim}</b> · ` : ""}${zeit}</span></span>
      <span class="dn-zust ${zustand[1]}">${zustand[0]}</span>
    </button>`;
  }


  /* ---------- Terminkarte (Vorlage termin-und-kalender-v2.png) ---------------
     EINE Komponente fuer Kalender und Uebersicht. Was sie zeigt, haengt an der
     Rolle: Trainer bekommt Zaehler, Zusagen-Balken, Aufstellung und Kader-Info,
     der Spieler seine Zu-/Absage samt Meldeschluss. Zu-/Absage steht in beiden
     Faellen da - wer Trainer UND Spieler ist, meldet sich hier zurueck (K7 ist
     damit ueberholt, die eigene Zeile im Hero entfaellt).
     opts.hero = true laesst den Kalender-Werkzeugkram weg; er gehoert in den
     Kalender, nicht auf die Uebersicht.                                       */
  function terminKarteHtml(e, opts) {
    opts = opts || {};
    const cancelled = e.typ !== "spiel" ? e.status === "abgesagt" : e.status === "abgesagt";
    const future    = isFuture(e.datum);
    const trainer   = Roles.canManageEvents();
    const spiel     = e.typ === "spiel";
    const r         = state.rsvp[e.id + "|" + state.currentPlayerId] || {};
    const verknuepft = !!(currentProfile && currentProfile.player_id && playerById[state.currentPlayerId]);

    // --- Kopfband ---------------------------------------------------------
    const zeit = e.zeit ? esc(e.zeit) + (e.ende ? " &#8211; " + esc(e.ende) : "") + " Uhr" : "";
    const titel = spiel ? esc(e.gegner || e.titel) : esc(e.titel);
    const bdg = (spiel && e.heim != null) ? '<span class="tk-bdg">' + (e.heim ? "Heim" : "Auswärts") + '</span>' : "";

    const istBfv = e.quelle === "bfv";
    const mb = e.manuellBearbeitet || {}, bn = e.bfvNeu || {};
    const tags = [];
    if (spiel && e.wettbewerb && /freundschaft/i.test(e.wettbewerb)) tags.push('<span class="tag tag-friendly">Freundschaft</span>');
    if (cancelled) tags.push('<span class="tag tag-cancelled">Abgesagt</span>');
    if (istBfv && (mb.start || mb.ort)) tags.push('<span class="tag tag-manuell">manuell geändert</span>');

    const kopf = '<div class="tk-kopf">' +
      '<span class="tk-datum"><span class="d-wd">' + fmtWd(e.datum) + '</span>' +
      '<span class="d-day num">' + fmtDay(e.datum) + '</span>' +
      '<span class="d-mon">' + fmtMon(e.datum) + '</span></span>' +
      '<span class="tk-kopf-main">' +
        (bdg || zeit ? '<span class="tk-oben">' + bdg + (zeit ? '<span class="tk-zeit num">' + zeit + '</span>' : "") + '</span>' : "") +
        '<span class="tk-titel">' + titel + '</span>' +
        (tags.length ? '<span class="tk-tags">' + tags.join("") + '</span>' : "") +
      '</span>' +
      ((trainer && !opts.hero) ? '<button class="tk-menue" data-tkmenu="' + e.id + '" aria-label="Mehr zu diesem Termin">⋯</button>' : "") +
      '</div>';

    // --- Koerper ----------------------------------------------------------
    const teile = [];

    const ort = ortTeile(e);
    if (ort) {
      teile.push('<div class="tk-feld tk-ort">' +
        '<span class="tk-ort-ic" aria-hidden="true">' + VENUE_PIN + '</span>' +
        '<span class="tk-ort-main"><span class="tk-ort-n">' + esc(ort.name) + '</span>' +
        (ort.adresse ? '<span class="tk-ort-a">' + esc(ort.adresse) + '</span>' : "") + '</span>' +
        (ort.url ? '<a class="tk-route" href="' + ort.url + '" target="_blank" rel="noopener noreferrer">Route</a>' : "") +
        '</div>');
    }

    if (cancelled) {
      teile.push('<div class="tk-abgesagt">Abgesagt</div>');
    } else if (future && verknuepft) {
      teile.push('<div class="tk-rsvp">' +
        '<button class="tk-btn' + (r.status === "zu" ? " is-on" : "") + '" data-rsvp="zu" data-event="' + e.id + '">Zusage</button>' +
        '<button class="tk-btn is-ab' + (r.status === "ab" ? " is-on" : "") + '" data-rsvp="ab" data-event="' + e.id + '">Absage</button>' +
        '</div>');
      if (r.status === "ab" && r.grund) teile.push('<div class="tk-grund">Grund: ' + esc(r.grund) + '</div>');
      // Meldeschluss und die Acht-Euro-Warnung direkt unter der Knopfzeile.
      const frist = fristBlockHtml(e);
      if (frist) teile.push(frist.indexOf("frist-warn") >= 0
        ? '<div class="tk-warn">' + frist.replace(/<\/?div[^>]*>/g, "") + '</div>'
        : '<div class="tk-frist">' + frist.replace(/<\/?div[^>]*>/g, "") + '</div>');
    }

    if (trainer && !cancelled) {
      const gesamt = DEMO.players.length;
      const zu = DEMO.players.filter((p) => (state.rsvp[e.id + "|" + p.id] || {}).status === "zu").length;
      const ab = DEMO.players.filter((p) => (state.rsvp[e.id + "|" + p.id] || {}).status === "ab").length;
      const offen = gesamt - zu - ab;
      const pz = gesamt ? (zu / gesamt) * 100 : 0;
      const pa = gesamt ? (ab / gesamt) * 100 : 0;
      teile.push('<button class="tk-feld tk-zusagen" data-rsvp-sheet="' + e.id + '">' +
        '<span class="tk-z-kopf"><span class="tk-z-lbl">Zusagen</span>' +
        '<span class="tk-z-offen num">' + offen + ' offen<span class="tk-chev">›</span></span></span>' +
        '<span class="tk-bar" role="img" aria-label="' + zu + ' zugesagt, ' + ab + ' abgesagt, ' + offen + ' offen">' +
          '<i class="is-zu" style="width:' + pz.toFixed(2) + '%"></i>' +
          '<i class="is-ab" style="width:' + pa.toFixed(2) + '%"></i></span>' +
        '<span class="tk-z-zahlen num"><b>' + zu + '</b> zugesagt · <b>' + ab + '</b> abgesagt · <b>' + offen + '</b> offen</span>' +
        '</button>');

      if (spiel) {
        const lu = (DEMO.lineups || []).find((l) => l.eventId === e.id && l.isActive && !l.isTemplate);
        const slots = lu ? (FORMATIONS[lu.formation] || []) : [];
        const gesetzt = lu ? slots.map((s) => (lu.slots || {})[s.key]).filter(Boolean).length : 0;
        teile.push('<div class="tk-kacheln">' +
          '<button class="tk-feld tk-kachel" data-lineup-edit="' + e.id + '">' +
            '<span class="tk-k-lbl">Aufstellung</span>' +
            '<span class="tk-k-wert num">' + gesetzt + '/' + (slots.length || 11) + '<span class="tk-chev">›</span></span></button>' +
          '<button class="tk-feld tk-kachel" data-kader-info="' + e.id + '">' +
            '<span class="tk-k-lbl">Kader-Info</span>' +
            '<span class="tk-k-wert num">' + DEMO.players.length + ' <small>Spieler</small><span class="tk-chev">›</span></span></button>' +
          '</div>');
      }
    }

    // BFV meldet eine Abweichung: der Hinweis steht sichtbar in der Karte, das
    // Uebernehmen als Textlink direkt daneben - nicht erst im ⋯-Menue.
    if (istBfv && trainer && !opts.hero) {
      if (bn.date || bn.time) {
        const t = bn.time || e.zeit || "";
        const dd = bn.date ? ddmm(bn.date) + " " : "";
        teile.push('<div class="tk-bfv">BFV meldet abweichende Zeit: ' + esc(dd + t) +
          ' <button class="link-btn" data-bfv-take="' + e.id + '" data-take-group="start">übernehmen</button></div>');
      }
      if (bn.location_raw) {
        teile.push('<div class="tk-bfv">BFV meldet eine abweichende Adresse. ' +
          '<button class="link-btn" data-bfv-take="' + e.id + '" data-take-group="ort">übernehmen</button></div>');
      }
    }
    if (e.note) teile.push('<div class="tk-notiz">' + esc(e.note) + '</div>');

    return '<div class="card tk' + (cancelled ? " is-cancelled" : "") + '" id="ev-' + e.id + '">' +
      kopf + (teile.length ? '<div class="tk-body">' + teile.join("") + '</div>' : "") + '</div>';
  }

  /* ⋯-Menue der Terminkarte: die Pflegefunktionen, die die Vorlage nicht
     zeichnet, aber ohne die der Kalender nicht pflegbar waere. */
  function closeTkMenu() {
    const ex = document.getElementById("tkMenu");
    if (ex) { ex.remove(); unlockBodyScroll(); }
  }
  function openTkMenu(eventId) {
    const e = DEMO.events.find((x) => x.id === eventId);
    if (!e || !Roles.canManageEvents()) return;
    closeTkMenu();
    const darfPflegen = Roles.canManageSchedule();
    const mb = e.manuellBearbeitet || {};
    const zeilen = [];
    if (darfPflegen) {
      zeilen.push('<button class="more-item" data-termin-edit="' + e.id + '">Termin bearbeiten</button>');
      if (e.quelle === "bfv" && (mb.start || mb.ort))
        zeilen.push('<button class="more-item" data-bfv-reset="' + e.id + '">Zurücksetzen auf BFV-Daten</button>');
      zeilen.push('<button class="more-item is-danger" data-termin-del="' + e.id + '">Termin löschen</button>');
    }
    if (!zeilen.length) return;
    const ov = document.createElement("div");
    ov.className = "more-sheet"; ov.id = "tkMenu";
    ov.innerHTML = '<button class="more-backdrop" data-sheet-close aria-label="Schließen"></button>' +
      '<div class="more-panel" role="dialog" aria-modal="true" aria-label="Termin">' +
      '<div class="more-title">' + (e.typ === "spiel" ? esc(e.gegner || e.titel) : esc(e.titel)) +
      ' · ' + fmtDay(e.datum) + '. ' + fmtMon(e.datum) + '</div>' + zeilen.join("") + '</div>';
    document.body.appendChild(ov);
    lockBodyScroll();
    ov.addEventListener("click", (ev) => {
      if (ev.target === ov || ev.target.closest("[data-sheet-close]")) { closeTkMenu(); return; }
      if (ev.target.closest(".more-item")) closeTkMenu();   // Aktion laeuft ueber den globalen Klickpfad weiter
    });
  }


  /* ---------- Termine anlegen / bearbeiten (Trainer/Kassenwart) ------------- */
  const SAISON_ENDE = "2026-06-30"; // Vorschlag "Ende der laufenden Saison"
  const WD_PLURAL = ["sonntags","montags","dienstags","mittwochs","donnerstags","freitags","samstags"];

  // Wochentermine von start (inkl.) bis until (inkl.), Schrittweite 7 Tage.
  function weeklyDates(startISO, untilISO) {
    const [ys, ms, ds] = startISO.split("-").map(Number);
    const [yu, mu, du] = untilISO.split("-").map(Number);
    const cur = new Date(ys, ms - 1, ds);
    const end = new Date(yu, mu - 1, du);
    const out = [];
    let guard = 0;
    while (cur <= end && guard++ < 400) { out.push(toISODate(cur)); cur.setDate(cur.getDate() + 7); }
    return out;
  }
  function ddmm(iso) { const p = iso.split("-"); return `${p[2]}.${p[1]}.`; }
  function weekdayPluralOf(iso) { const [y,m,d] = iso.split("-").map(Number); return WD_PLURAL[new Date(y, m-1, d).getDay()]; }

  // Hintergrund-Scroll-Sperre für Dialoge (iOS-fest: body fixieren, Position merken).
  // Zählerbasiert, damit verschachtelte Dialoge (z. B. Serien-Abfrage über dem
  // Termin-Dialog) korrekt bleiben.
  let _scrollLocks = 0, _scrollLockY = 0;
  function lockBodyScroll() {
    if (_scrollLocks++ > 0) return;
    _scrollLockY = window.scrollY || window.pageYOffset || 0;
    const b = document.body.style;
    b.position = "fixed"; b.top = `-${_scrollLockY}px`; b.left = "0"; b.right = "0"; b.width = "100%";
  }
  function unlockBodyScroll() {
    if (_scrollLocks === 0) return;
    if (--_scrollLocks > 0) return;
    const b = document.body.style;
    b.position = ""; b.top = ""; b.left = ""; b.right = ""; b.width = "";
    window.scrollTo(0, _scrollLockY);
  }

  function closeTerminModal() { const ex = document.getElementById("terminModal"); if (ex) { ex.remove(); unlockBodyScroll(); } }

  // existing = null -> anlegen; sonst bearbeiten (Event-Objekt aus DEMO.events).
  function openTerminModal(existing) {
    closeTerminModal();
    const isEdit = !!existing;
    const e = existing || {};
    const isBfv = isEdit && e.quelle === "bfv"; // BFV-Spiel: Gegner/Wettbewerb gesperrt
    const typ0   = e.typ || "training";
    const titel0 = e.titel != null ? e.titel : (typ0 === "training" ? "Training" : "");
    const datum0 = e.datum || HEUTE;

    const ov = document.createElement("div");
    ov.className = "modal-ov"; ov.id = "terminModal";
    ov.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true">
        <div class="modal-head"><strong>${isBfv ? "Spiel bearbeiten" : (isEdit ? "Termin bearbeiten" : "Termin anlegen")}</strong>
          <button class="modal-x" aria-label="Schließen">&times;</button></div>
        <form class="termin-form" novalidate>
          ${isBfv ? `
          <div class="bfv-ro">
            <div class="bfv-ro-line">${(() => { const p = paarung(e); return `${p.home} <span class="vs">–</span> ${p.away}`; })()}</div>
            ${e.wettbewerb ? `<div class="bfv-ro-sub">${esc(e.wettbewerb)}${e.liga ? " · " + esc(e.liga) : ""}</div>` : ""}
            <div class="bfv-ro-hint">Gegner und Wettbewerb kommen vom BFV und sind gesperrt.</div>
          </div>` : `
          <label class="tf-row">Typ
            <select data-tf="typ">
              <option value="training">Training</option>
              <option value="spiel">Spiel</option>
              <option value="sonstiges">Sonstiges</option>
            </select>
          </label>
          <label class="tf-row" data-tf-titelrow>Titel
            <input type="text" data-tf="titel" placeholder="z. B. Abschlusstraining">
          </label>
          <div data-tf-spiel hidden>
            <label class="tf-row">Gegner
              <input type="text" data-tf="gegner" placeholder="Gegnerischer Verein"></label>
            <label class="tf-row">Heim/Auswärts
              <select data-tf="heim"><option value="true">Heimspiel</option><option value="false">Auswärtsspiel</option></select></label>
          </div>`}
          <label class="tf-row">Datum<input type="date" data-tf="datum"></label>
          <div class="tf-2col">
            <label class="tf-row">Start<input type="time" data-tf="zeit"></label>
            <label class="tf-row">Ende<input type="time" data-tf="ende"></label>
          </div>
          <label class="tf-row">Ort (vollständige Adresse)
            <input type="text" data-tf="ort" placeholder="z. B. Sportanlage Lechelstraße, Lechelstr. 35, 80997 München"></label>
          <label class="tf-row">Notiz für die Spieler (optional)
            <textarea data-tf="notiz" rows="2" placeholder="optional"></textarea></label>
          ${isEdit ? "" : `
          <fieldset class="tf-wdh">
            <legend>Wiederholung</legend>
            <label class="tf-radio"><input type="radio" name="wdh" value="einmalig" checked> einmalig</label>
            <label class="tf-radio"><input type="radio" name="wdh" value="woechentlich"> wöchentlich</label>
            <label class="tf-row tf-bis" data-tf-bisrow hidden>Wiederholen bis
              <input type="date" data-tf="bis" value="${SAISON_ENDE}"></label>
          </fieldset>
          <div class="tf-summary" data-tf-summary hidden></div>`}
          <div class="modal-actions">
            ${(isEdit && !isBfv) ? `<button type="button" class="btn btn-danger" data-tf-delete>Löschen</button>` : ""}
            ${(isEdit && !isBfv) ? `<button type="button" class="btn" data-tf-cancel-toggle>${e.status === "abgesagt" ? "Findet statt" : "Fällt aus"}</button>` : ""}
            <button type="submit" class="btn btn-primary">${isEdit ? "Speichern" : "Anlegen"}</button>
          </div>
          <div class="modal-hint" aria-live="polite" data-tf-hint></div>
        </form>
      </div>`;
    document.body.appendChild(ov);
    lockBodyScroll();

    const q = (sel) => ov.querySelector(sel);
    const set = (sel, val) => { const el = q(sel); if (el) el.value = val; };
    const typSel = q('[data-tf="typ"]');
    if (typSel) typSel.value = typ0;
    set('[data-tf="titel"]', titel0);
    set('[data-tf="datum"]', datum0);
    set('[data-tf="zeit"]', e.zeit || "");
    set('[data-tf="ende"]', e.ende || "");
    set('[data-tf="ort"]', e.locationRaw || e.ort || "");
    set('[data-tf="notiz"]', e.note || "");
    set('[data-tf="gegner"]', e.gegner || "");
    set('[data-tf="heim"]', e.heim === false ? "false" : "true");
    const hint = q('[data-tf-hint]');

    function syncTypUI() {
      if (!typSel) return; // BFV: keine Typ-/Titel-/Gegner-Felder
      const typ = typSel.value;
      q('[data-tf-spiel]').hidden = typ !== "spiel";
      q('[data-tf-titelrow]').hidden = typ === "spiel"; // Spiel: Titel = Paarung
      const titelEl = q('[data-tf="titel"]');
      if (typ === "training" && !titelEl.value.trim()) titelEl.value = "Training";
    }
    function summary() {
      if (isEdit) return;
      const box = q('[data-tf-summary]');
      const woech = ov.querySelector('input[name="wdh"]:checked').value === "woechentlich";
      q('[data-tf-bisrow]').hidden = !woech;
      const start = q('[data-tf="datum"]').value, bis = q('[data-tf="bis"]').value, zeit = q('[data-tf="zeit"]').value;
      if (!woech || !start || !bis || bis < start) { box.hidden = true; return; }
      const dates = weeklyDates(start, bis);
      box.hidden = false;
      box.textContent = `Es werden ${dates.length} Termine angelegt, ${weekdayPluralOf(start)}${zeit ? " " + zeit : ""}, vom ${ddmm(start)} bis ${ddmm(bis)}.`;
    }

    syncTypUI(); summary();
    if (typSel) typSel.addEventListener("change", syncTypUI);
    ov.querySelectorAll('input[name="wdh"]').forEach((r) => r.addEventListener("change", summary));
    ["datum","bis","zeit"].forEach((k) => { const el = q(`[data-tf="${k}"]`); if (el) el.addEventListener("input", summary); });

    ov.addEventListener("click", (ev) => { if (ev.target === ov) closeTerminModal(); });
    q(".modal-x").addEventListener("click", closeTerminModal);

    const val = (sel, dflt) => { const el = q(sel); return el ? el.value : dflt; };
    function collect() {
      return {
        typ: typSel ? typSel.value : (e.typ || "spiel"),
        titel: val('[data-tf="titel"]', e.titel || "").trim(),
        datum: q('[data-tf="datum"]').value,
        zeit: q('[data-tf="zeit"]').value,
        ende: q('[data-tf="ende"]').value,
        ort: q('[data-tf="ort"]').value.trim(),
        notiz: q('[data-tf="notiz"]').value.trim(),
        gegner: val('[data-tf="gegner"]', e.gegner || "").trim(),
        heim: q('[data-tf="heim"]') ? q('[data-tf="heim"]').value === "true" : (e.heim === true),
        wdh: !isEdit && ov.querySelector('input[name="wdh"]:checked').value === "woechentlich",
        bis: isEdit ? "" : q('[data-tf="bis"]').value,
      };
    }

    q(".termin-form").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const b = collect();
      const err = validateTermin(b);
      if (err) { hint.textContent = err; return; }
      const saveBtn = q(".termin-form button[type=submit]"); saveBtn.disabled = true;
      try {
        if (!isEdit) await createTermine(b);
        else if (isBfv) await saveBfvEdit(existing, b);
        else await saveTerminEdit(existing, b);
        closeTerminModal(); await reloadData();
      } catch (e2) { hint.textContent = /Abgebrochen/.test(e2 && e2.message) ? "" : "Fehler: " + ((e2 && e2.message) || e2); saveBtn.disabled = false; }
    });

    const delBtn = q('[data-tf-delete]');
    if (delBtn) delBtn.addEventListener("click", async () => {
      try { await deleteTermin(existing); closeTerminModal(); await reloadData(); }
      catch (e2) { if (!/Abgebrochen/.test(e2 && e2.message)) hint.textContent = "Fehler: " + ((e2 && e2.message) || e2); }
    });
    const cancelToggle = q('[data-tf-cancel-toggle]');
    if (cancelToggle) cancelToggle.addEventListener("click", async () => {
      const neu = existing.status === "abgesagt" ? "geplant" : "abgesagt";
      try { await DB.updateEvent(existing.id, { status: neu }); closeTerminModal(); await reloadData(); }
      catch (e2) { hint.textContent = "Fehler: " + ((e2 && e2.message) || e2); }
    });
  }

  function validateTermin(b) {
    if (!b.datum) return "Bitte ein Datum wählen.";
    if (b.typ === "spiel") { if (!b.gegner) return "Bitte den Gegner angeben."; }
    else if (!b.titel) return "Bitte einen Titel angeben.";
    if (b.zeit && b.ende && b.ende <= b.zeit) return "Die Endzeit muss nach der Startzeit liegen.";
    if (b.wdh) {
      if (!b.bis) return "Bitte ein Enddatum für die Wiederholung angeben.";
      if (b.bis < b.datum) return "Das Enddatum liegt vor dem Startdatum.";
    }
    return "";
  }

  function terminRow(b, dateISO, serieId) {
    const isSpiel = b.typ === "spiel";
    return {
      club_id: DEMO.clubId, type: b.typ,
      title: isSpiel ? null : (b.titel || null),
      opponent: isSpiel ? (b.gegner || null) : null,
      home: isSpiel ? b.heim : null,
      date: dateISO, time: b.zeit || null, ende: b.ende || null,
      location: b.ort || null, location_raw: b.ort || null, note: b.notiz || null,
      quelle: "manuell", status: "geplant",
      serie_id: serieId, serie_geaendert: false, auto_fine: false,
    };
  }

  async function createTermine(b) {
    if (b.wdh) {
      const dates = weeklyDates(b.datum, b.bis);
      const serieId = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : null;
      await DB.insertEvents(dates.map((d) => terminRow(b, d, serieId)));
    } else {
      await DB.insertEvents([terminRow(b, b.datum, null)]);
    }
  }

  // Bearbeiten. Bei Serien Bereich abfragen; Vergangenheit nie mitändern.
  async function saveTerminEdit(e, b) {
    const isSpiel = b.typ === "spiel";
    const commonPatch = {
      type: b.typ,
      title: isSpiel ? null : (b.titel || null),
      opponent: isSpiel ? (b.gegner || null) : null,
      home: isSpiel ? b.heim : null,
      time: b.zeit || null, ende: b.ende || null,
      location: b.ort || null, location_raw: b.ort || null, note: b.notiz || null,
    };
    if (e.serieId == null) { await DB.updateEvent(e.id, Object.assign({ date: b.datum }, commonPatch)); return; }
    const scope = await askSeriesScope("ändern");
    if (scope === null) throw new Error("Abgebrochen.");
    if (scope === "single") {
      await DB.updateEvent(e.id, Object.assign({ date: b.datum, serie_geaendert: true }, commonPatch));
    } else {
      const from = e.datum > HEUTE ? e.datum : HEUTE;   // Vergangenheit schützen
      await DB.updateEvent(e.id, commonPatch);          // aktuellen immer mitnehmen
      await DB.updateSeriesFrom(e.serieId, from, commonPatch);
    }
  }

  // BFV-Spiel bearbeiten: geänderte Gruppen (start/ort) als manuell markieren,
  // ursprünglichen BFV-Wert einfrieren; Notiz/Ende sind reine Zusatzfelder.
  async function saveBfvEdit(e, b) {
    const mb = Object.assign({}, e.manuellBearbeitet || {});
    const orig = Object.assign({}, e.bfvOriginal || {});
    const neu = Object.assign({}, e.bfvNeu || {});
    const patch = { ende: b.ende || null, note: b.notiz || null };

    const startChanged = (b.datum !== e.datum) || ((b.zeit || null) !== (e.zeit || null));
    if (startChanged) {
      orig.date = (neu.date != null ? neu.date : (orig.date != null ? orig.date : e.datum));
      orig.time = (neu.time != null ? neu.time : (orig.time != null ? orig.time : (e.zeit || null)));
      mb.start = true;
      delete neu.date; delete neu.time;
      patch.date = b.datum; patch.time = b.zeit || null;
    }
    const oldOrt = (e.locationRaw || e.ort) || null;
    const ortChanged = (b.ort || null) !== oldOrt;
    if (ortChanged) {
      orig.location_raw = (neu.location_raw != null ? neu.location_raw : (orig.location_raw != null ? orig.location_raw : e.locationRaw));
      orig.spielstaette = (neu.spielstaette != null ? neu.spielstaette : (orig.spielstaette != null ? orig.spielstaette : e.spielstaette));
      orig.adresse = (neu.adresse != null ? neu.adresse : (orig.adresse != null ? orig.adresse : e.adresse));
      mb.ort = true;
      delete neu.location_raw; delete neu.spielstaette; delete neu.adresse;
      patch.location_raw = b.ort || null; patch.location = b.ort || null;
      patch.spielstaette = null; patch.adresse = null;
    }
    patch.manuell_bearbeitet = mb; patch.bfv_original = orig; patch.bfv_neu = neu;
    await DB.updateEvent(e.id, patch);
  }

  // „Zurücksetzen auf BFV-Daten": alle Overrides raus, Werte = aktueller BFV.
  function bfvResetPatch(e) {
    const mb = e.manuellBearbeitet || {}, orig = e.bfvOriginal || {}, neu = e.bfvNeu || {};
    const patch = { manuell_bearbeitet: {}, bfv_original: {}, bfv_neu: {} };
    if (mb.start) {
      patch.date = (neu.date != null ? neu.date : orig.date) || e.datum;
      patch.time = (neu.time != null ? neu.time : orig.time) || null;
    }
    if (mb.ort) {
      const lr = (neu.location_raw != null ? neu.location_raw : orig.location_raw) || null;
      patch.location_raw = lr; patch.location = lr;
      patch.spielstaette = (neu.spielstaette != null ? neu.spielstaette : orig.spielstaette) || null;
      patch.adresse = (neu.adresse != null ? neu.adresse : orig.adresse) || null;
    }
    return patch;
  }

  // „BFV-Wert übernehmen": nur die gedriftete Gruppe auf den neuen BFV-Wert setzen.
  function bfvTakePatch(e, group) {
    const mb = Object.assign({}, e.manuellBearbeitet || {});
    const orig = Object.assign({}, e.bfvOriginal || {});
    const neu = Object.assign({}, e.bfvNeu || {});
    const patch = {};
    if (group === "start") {
      if (neu.date != null) patch.date = neu.date;
      if (neu.time != null) patch.time = neu.time;
      delete mb.start; delete orig.date; delete orig.time; delete neu.date; delete neu.time;
    } else if (group === "ort") {
      const lr = neu.location_raw;
      if (lr != null) { patch.location_raw = lr; patch.location = lr; }
      patch.spielstaette = (neu.spielstaette != null ? neu.spielstaette : null);
      patch.adresse = (neu.adresse != null ? neu.adresse : null);
      delete mb.ort; delete orig.location_raw; delete orig.spielstaette; delete orig.adresse;
      delete neu.location_raw; delete neu.spielstaette; delete neu.adresse;
    }
    patch.manuell_bearbeitet = mb; patch.bfv_original = orig; patch.bfv_neu = neu;
    return patch;
  }

  async function deleteTermin(e) {
    const zusagen = DEMO.players.filter((p) => (state.rsvp[e.id + "|" + p.id] || {}).status === "zu").length;
    const warn = zusagen > 0 ? `\n\n${zusagen} Spieler ${zusagen === 1 ? "hat" : "haben"} bereits zugesagt.` : "";
    if (e.serieId == null) {
      if (!window.confirm(`Diesen Termin wirklich löschen?${warn}`)) throw new Error("Abgebrochen.");
      await DB.deleteEvent(e.id); return;
    }
    const scope = await askSeriesScope("löschen");
    if (scope === null) throw new Error("Abgebrochen.");
    if (scope === "single") {
      if (!window.confirm(`Nur diesen Termin löschen?${warn}`)) throw new Error("Abgebrochen.");
      await DB.deleteEvent(e.id);
    } else {
      const from = e.datum > HEUTE ? e.datum : HEUTE;
      if (!window.confirm(`Diesen und alle folgenden Termine löschen? Vergangene bleiben erhalten.${warn}`)) throw new Error("Abgebrochen.");
      await DB.deleteSeriesFrom(e.serieId, from);
    }
  }

  // Serien-Bereichs-Dialog. Promise: "single" | "following" | null (Abbruch).
  function askSeriesScope(verb) {
    return new Promise((resolve) => {
      const ov = document.createElement("div");
      ov.className = "modal-ov"; ov.id = "scopeModal";
      ov.innerHTML = `
        <div class="modal modal-sm" role="dialog" aria-modal="true">
          <div class="modal-head"><strong>Serientermin ${verb}</strong></div>
          <p class="modal-sub">Dieser Termin gehört zu einer Serie.</p>
          <div class="modal-actions modal-actions-col">
            <button class="btn" data-scope="single">Nur diesen Termin</button>
            <button class="btn btn-primary" data-scope="following">Diesen und alle folgenden</button>
            <button class="btn btn-ghost" data-scope="cancel">Abbrechen</button>
          </div>
        </div>`;
      document.body.appendChild(ov);
      lockBodyScroll();
      const done = (val) => { ov.remove(); unlockBodyScroll(); resolve(val); };
      ov.addEventListener("click", (ev) => {
        if (ev.target === ov) return done(null);
        const b = ev.target.closest("[data-scope]");
        if (!b) return;
        done(b.dataset.scope === "cancel" ? null : b.dataset.scope);
      });
    });
  }

  /* ---------- Kader-Info (vorgefertigte Nachricht) -------------------------- */
  // Austauschbare Kaderquelle: liefert die Spieler für die Nachricht.
  // v1 = Zusagen. Sobald es Aufstellungen gibt, kann hier { modus:"aufstellung",
  // startelf, bank } zurückgegeben werden – buildKaderInfoText nutzt das automatisch.
  function kaderQuelle(e) {
    // Gibt es eine AKTIVE Aufstellung für dieses Spiel? Dann Startelf/Bank daraus.
    const lu = (DEMO.lineups || []).find((l) => l.eventId === e.id && l.isActive);
    if (lu) {
      const slots = FORMATIONS[lu.formation] || [];
      const startelf = slots.map((s) => (lu.slots || {})[s.key]).filter(Boolean).map((id) => playerById[id]).filter(Boolean);
      const bank = (lu.bank || []).map((id) => playerById[id]).filter(Boolean);
      // Nur eine VOLLSTAENDIGE Aufstellung (jede Position der Formation besetzt)
      // taugt als Kaderquelle. Halb gefuellt waere die Nachricht irrefuehrend –
      // dann sind die Zusagen die ehrlichere Grundlage.
      if (slots.length && startelf.length === slots.length) {
        return { modus: "aufstellung", startelf: startelf, bank: bank, dabei: startelf };
      }
    }
    const dabei = DEMO.players
      .filter((p) => (state.rsvp[e.id + "|" + p.id] || {}).status === "zu")
      .sort((a, b) => nachname(a.name).localeCompare(nachname(b.name), "de"));
    return { modus: "zusagen", startelf: [], bank: [], dabei: dabei };
  }

  // Baut den fertigen Nachrichtentext aus echten Termindaten + Kaderquelle.
  // OHNE Verletzungs-Details und OHNE Absagegründe.
  function buildKaderInfoText(e) {
    const wt = WT_LANG[parseDate(e.datum).getDay()];
    const ort = e.ort ? ` (${e.ort})` : "";
    const gegner = e.gegner || "unbekannt";
    const spielTyp = e.heim ? `Heimspiel gegen ${gegner}` : `Auswärtsspiel bei ${gegner}`;

    const zeilen = [];
    zeilen.push(`Kader für ${wt}, ${e.zeit} Uhr, ${spielTyp}${ort}.`);
    if (e.note) zeilen.push(e.note + (/[.!?]$/.test(e.note) ? "" : "."));

    const q = kaderQuelle(e);
    // Ein Name pro Zeile – gleiche Form in beiden Faellen, ohne Ueberschriften
    // und ohne Trennzeile. Aufstellung: Elf zuerst, dann Bank. Sonst: alle Zusagen.
    const alle = q.modus === "aufstellung" ? q.startelf.concat(q.bank) : q.dabei;
    if (alle.length) alle.forEach((p) => zeilen.push(p.name));
    else zeilen.push("Es haben noch keine Spieler zugesagt.");
    zeilen.push("Bitte pünktlich sein!");
    return zeilen.join("\n");
  }

  /* ---------- Teilen-Dialog (WhatsApp / Kopieren) --------------------------- */
  function closeShareModal() {
    const ex = document.getElementById("shareModal");
    if (ex) { ex.remove(); unlockBodyScroll(); }
  }
  async function copyText(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (e) { /* Fallback unten */ }
    try {
      const ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.focus(); ta.select();
      const ok = document.execCommand("copy"); ta.remove();
      return ok;
    } catch (e) { return false; }
  }
  function openShareModal(title, text) {
    closeShareModal();
    const ov = document.createElement("div");
    ov.className = "modal-ov"; ov.id = "shareModal";
    ov.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true">
        <div class="modal-head"><strong>${esc(title)}</strong>
          <button class="modal-x" aria-label="Schließen">×</button></div>
        <p class="modal-sub">Text frei anpassen, dann teilen oder kopieren.</p>
        <textarea class="modal-text" rows="11" spellcheck="false"></textarea>
        <div class="modal-actions">
          <button class="btn btn-primary" data-wa>Per WhatsApp teilen</button>
          <button class="btn" data-copy>Text kopieren</button>
        </div>
        <div class="modal-hint" aria-live="polite"></div>
      </div>`;
    document.body.appendChild(ov);
    lockBodyScroll();
    const ta = ov.querySelector(".modal-text");
    ta.value = text;
    const hint = ov.querySelector(".modal-hint");
    ov.addEventListener("click", (e) => { if (e.target === ov) closeShareModal(); });
    ov.querySelector(".modal-x").addEventListener("click", closeShareModal);
    ov.querySelector("[data-wa]").addEventListener("click", async () => {
      const msg = ta.value;
      // 1) Natives Teilen (iOS Share-Sheet): sauberer Ruecksprung in die App, KEIN leerer
      //    In-App-Browser-Tab. WhatsApp ist im Sheet als Ziel waehlbar.
      if (navigator.share) {
        try { await navigator.share({ text: msg }); closeShareModal(); return; }
        catch (e) { if (e && e.name === "AbortError") return; } // Nutzer hat abgebrochen -> Modal offen lassen
      }
      // 2) Fallback: WhatsApp direkt per App-Schema (oeffnet ebenfalls keinen Browser-Tab).
      window.location.href = "whatsapp://send?text=" + encodeURIComponent(msg);
    });
    ov.querySelector("[data-copy]").addEventListener("click", async () => {
      const ok = await copyText(ta.value);
      hint.textContent = ok ? "In die Zwischenablage kopiert"
                            : "Konnte nicht automatisch kopieren – bitte Text markieren und kopieren.";
    });
  }

  /* =========================================================================
     AUFSTELLUNGS-BUILDER (nur Trainer/Admin)
     ========================================================================= */
  // Formationen als erweiterbare Konfiguration. Koordinaten in % des Feldes
  // (Hochformat: y=0 oben/gegnerisches Tor, y=100 unten/eigenes Tor).
  const FORMATIONS = {
    "4-4-2": [
      { key:"TW", role:"TW", x:50, y:88 },
      { key:"LV", role:"AV", x:10, y:66 }, { key:"LIV", role:"IV", x:37, y:66 }, { key:"RIV", role:"IV", x:63, y:66 }, { key:"RV", role:"AV", x:90, y:66 },
      { key:"LM", role:"ZM", x:10, y:44 }, { key:"LZM", role:"ZM", x:37, y:44 }, { key:"RZM", role:"ZM", x:63, y:44 }, { key:"RM", role:"ZM", x:90, y:44 },
      { key:"LST", role:"ST", x:37, y:22 }, { key:"RST", role:"ST", x:63, y:22 },
    ],
    "4-3-3": [
      { key:"TW", role:"TW", x:50, y:88 },
      { key:"LV", role:"AV", x:10, y:66 }, { key:"LIV", role:"IV", x:37, y:66 }, { key:"RIV", role:"IV", x:63, y:66 }, { key:"RV", role:"AV", x:90, y:66 },
      { key:"LZM", role:"ZM", x:26, y:44 }, { key:"ZM", role:"ZM", x:50, y:44 }, { key:"RZM", role:"ZM", x:74, y:44 },
      { key:"LA", role:"OM", x:12, y:22 }, { key:"ST", role:"ST", x:50, y:22 }, { key:"RA", role:"OM", x:88, y:22 },
    ],
    "4-2-3-1": [
      { key:"TW", role:"TW", x:50, y:88 },
      { key:"LV", role:"AV", x:10, y:71.5 }, { key:"LIV", role:"IV", x:37, y:71.5 }, { key:"RIV", role:"IV", x:63, y:71.5 }, { key:"RV", role:"AV", x:90, y:71.5 },
      { key:"LDM", role:"ZM", x:34, y:55 }, { key:"RDM", role:"ZM", x:66, y:55 },
      { key:"LOM", role:"OM", x:12, y:38.5 }, { key:"ZOM", role:"OM", x:50, y:38.5 }, { key:"ROM", role:"OM", x:88, y:38.5 },
      { key:"ST", role:"ST", x:50, y:22 },
    ],
    "3-5-2": [
      { key:"TW", role:"TW", x:50, y:88 },
      { key:"LIV", role:"IV", x:24, y:66 }, { key:"CIV", role:"IV", x:50, y:66 }, { key:"RIV", role:"IV", x:76, y:66 },
      { key:"LM", role:"AV", x:9, y:44 }, { key:"LZM", role:"ZM", x:30, y:44 }, { key:"ZM", role:"ZM", x:50, y:44 }, { key:"RZM", role:"ZM", x:70, y:44 }, { key:"RM", role:"AV", x:91, y:44 },
      { key:"LST", role:"ST", x:37, y:22 }, { key:"RST", role:"ST", x:63, y:22 },
    ],
    "3-4-3": [
      { key:"TW", role:"TW", x:50, y:88 },
      { key:"LIV", role:"IV", x:24, y:66 }, { key:"CIV", role:"IV", x:50, y:66 }, { key:"RIV", role:"IV", x:76, y:66 },
      { key:"LWB", role:"AV", x:9, y:44 }, { key:"LZM", role:"ZM", x:37, y:44 }, { key:"RZM", role:"ZM", x:63, y:44 }, { key:"RWB", role:"AV", x:91, y:44 },
      { key:"LA", role:"FL", x:12, y:22 }, { key:"ST", role:"ST", x:50, y:22 }, { key:"RA", role:"FL", x:88, y:22 },
    ],
    "4-1-4-1": [
      { key:"TW", role:"TW", x:50, y:88 },
      { key:"LV", role:"AV", x:10, y:71.5 }, { key:"LIV", role:"IV", x:37, y:71.5 }, { key:"RIV", role:"IV", x:63, y:71.5 }, { key:"RV", role:"AV", x:90, y:71.5 },
      { key:"DM", role:"DM", x:50, y:55 },
      { key:"LM", role:"FL", x:9, y:38.5 }, { key:"LZM", role:"ZM", x:37, y:38.5 }, { key:"RZM", role:"ZM", x:63, y:38.5 }, { key:"RM", role:"FL", x:91, y:38.5 },
      { key:"ST", role:"ST", x:50, y:22 },
    ],
    "5-3-2": [
      { key:"TW", role:"TW", x:50, y:88 },
      { key:"LWB", role:"AV", x:9, y:66 }, { key:"LIV", role:"IV", x:29, y:66 }, { key:"CIV", role:"IV", x:50, y:66 }, { key:"RIV", role:"IV", x:71, y:66 }, { key:"RWB", role:"AV", x:91, y:66 },
      { key:"LZM", role:"ZM", x:29, y:44 }, { key:"ZM", role:"ZM", x:50, y:44 }, { key:"RZM", role:"ZM", x:71, y:44 },
      { key:"LST", role:"ST", x:37, y:22 }, { key:"RST", role:"ST", x:63, y:22 },
    ],
    "4-4-1-1": [
      { key:"TW", role:"TW", x:50, y:88 },
      { key:"LV", role:"AV", x:10, y:71.5 }, { key:"LIV", role:"IV", x:37, y:71.5 }, { key:"RIV", role:"IV", x:63, y:71.5 }, { key:"RV", role:"AV", x:90, y:71.5 },
      { key:"LM", role:"FL", x:9, y:55 }, { key:"LZM", role:"ZM", x:37, y:55 }, { key:"RZM", role:"ZM", x:63, y:55 }, { key:"RM", role:"FL", x:91, y:55 },
      { key:"OM", role:"OM", x:50, y:38.5 }, { key:"ST", role:"ST", x:50, y:22 },
    ],
    "3-4-1-2": [
      { key:"TW", role:"TW", x:50, y:88 },
      { key:"LIV", role:"IV", x:24, y:71.5 }, { key:"CIV", role:"IV", x:50, y:71.5 }, { key:"RIV", role:"IV", x:76, y:71.5 },
      { key:"LWB", role:"AV", x:9, y:55 }, { key:"LZM", role:"ZM", x:37, y:55 }, { key:"RZM", role:"ZM", x:63, y:55 }, { key:"RWB", role:"AV", x:91, y:55 },
      { key:"OM", role:"OM", x:50, y:38.5 }, { key:"LST", role:"ST", x:37, y:22 }, { key:"RST", role:"ST", x:63, y:22 },
    ],
    "4-5-1": [
      { key:"TW", role:"TW", x:50, y:88 },
      { key:"LV", role:"AV", x:10, y:66 }, { key:"LIV", role:"IV", x:37, y:66 }, { key:"RIV", role:"IV", x:63, y:66 }, { key:"RV", role:"AV", x:90, y:66 },
      { key:"LM", role:"FL", x:9, y:44 }, { key:"LZM", role:"ZM", x:30, y:44 }, { key:"ZM", role:"ZM", x:50, y:44 }, { key:"RZM", role:"ZM", x:70, y:44 }, { key:"RM", role:"FL", x:91, y:44 },
      { key:"ST", role:"ST", x:50, y:22 },
    ],
  };

  let lb = { eventId: null, lineupId: null, name: "", formation: "4-4-2", assign: {}, sel: null, gaps: [], msg: "" };
  let lbDrag = null;

  // Rollen-Affinität: Ziel-Rolle -> akzeptierte Quell-Rollen nach Ähnlichkeit (Index = Rang).
  const LB_AFF = { TW:["TW"], IV:["IV","AV","DM"], AV:["AV","IV","FL","ZM"], DM:["DM","ZM","IV"],
    ZM:["ZM","DM","OM"], OM:["OM","ZM","FL","ST"], FL:["FL","OM","AV","ST"], ST:["ST","OM","FL"] };
  function lbAffRank(from, to) { const l = LB_AFF[to] || [to]; return l.indexOf(from); }
  // Mannschaftsteil aus Positionskürzel.
  function lbTeamPart(pos) {
    const p = String(pos || "").toUpperCase();
    if (p === "TW") return "TW";
    if (p === "ST" || p[0] === "S") return "STU";
    if (p.indexOf("V") !== -1) return "ABW";  // IV, AV, LV, RV …
    return "MIT";
  }
  const LB_GROUPS = [["TW","Tor"], ["ABW","Abwehr"], ["MIT","Mittelfeld"], ["STU","Angriff"]];
  // Verfügbarkeit für Kader-Panel: null = verfügbar; sonst {cls,label,rank}. Höherer Rang = weiter hinten.
  function lbAvail(p) {
    if (p.status === "verletzt") return { cls:"verl", label:"verletzt", rank:4 };
    const r = (state.rsvp[lb.eventId + "|" + p.id] || {}).status;
    if (r === "ab") return { cls:"abw", label:"abgesagt", rank:3 };
    if (r !== "zu") return { cls:"none", label:"o. Rückm.", rank:2 };
    if (p.status === "angeschlagen") return { cls:"ang", label:"angeschlagen", rank:1 };
    return null;
  }

  function shortName(name) {
    const p = String(name).trim().split(/\s+/);
    return p.length > 1 ? p[0][0] + ". " + p[p.length - 1] : name;
  }
  const byName = (a, b) => nachname(a.name).localeCompare(nachname(b.name), "de");
  function zusagenIds(eventId) {
    return DEMO.players.filter((p) => (state.rsvp[eventId + "|" + p.id] || {}).status === "zu").map((p) => p.id);
  }
  function cleanAssign(a) { const o = {}; Object.keys(a).forEach((k) => { if (a[k]) o[k] = a[k]; }); return o; }
  function lbBankIds() {
    const placed = new Set(Object.values(lb.assign).filter(Boolean));
    return zusagenIds(lb.eventId).filter((id) => !placed.has(id));
  }

  function lbNew() { lb.lineupId = null; lb.name = ""; lb.assign = {}; lb.gaps = []; lb.sel = null; }
  function lbLoad(l) {
    lb.lineupId = l.id; lb.name = l.name; lb.formation = l.formation;
    lb.assign = Object.assign({}, l.slots || {}); lb.gaps = []; lb.sel = null;
  }
  function lbLoadActiveOrNew() {
    const act = (DEMO.lineups || []).find((l) => l.eventId === lb.eventId && l.isActive);
    if (act) lbLoad(act); else lbNew();
  }
  function lbInitIfNeeded() {
    const spiele = DEMO.events.filter((e) => e.typ === "spiel");
    if (!lb.eventId || !spiele.some((e) => e.id === lb.eventId)) {
      const fut = spiele.filter((e) => isFuture(e.datum)).sort((a, b) => a.datum.localeCompare(b.datum));
      const def = fut[0] || spiele[spiele.length - 1] || spiele[0];
      lb.eventId = def ? def.id : null;
      lbLoadActiveOrNew();
    }
  }

  // --- Feld (reine Funktion: Formation + Belegung -> SVG/HTML) ----------------
  function pitchBgSvg() {
    return `<svg class="pitch-bg" viewBox="0 0 68 105" preserveAspectRatio="none" aria-hidden="true">
      <rect x="0" y="0" width="68" height="105" fill="#2e7d46"/>
      <g fill="none" stroke="rgba(255,255,255,.6)" stroke-width="0.5">
        <rect x="2" y="2" width="64" height="101"/>
        <line x1="2" y1="52.5" x2="66" y2="52.5"/>
        <circle cx="34" cy="52.5" r="9"/>
        <rect x="14" y="2" width="40" height="16"/><rect x="24" y="2" width="20" height="6"/>
        <rect x="14" y="87" width="40" height="16"/><rect x="24" y="97" width="20" height="6"/>
      </g>
      <circle cx="34" cy="52.5" r="0.8" fill="rgba(255,255,255,.6)"/>
    </svg>`;
  }
  function renderPitch(formation, assign) {
    const slots = FORMATIONS[formation] || FORMATIONS["4-4-2"];
    return `<div class="pitch">
      ${pitchBgSvg()}
      ${slots.map((s) => {
        const pid = assign[s.key];
        const p = pid ? playerById[pid] : null;
        const mism = p && p.pos !== s.role;
        const gap = lb.gaps.indexOf(s.key) !== -1;
        const selCls = (lb.sel && lb.sel.kind === "slot" && lb.sel.key === s.key) ? " is-selected" : "";
        return `<div class="slot${p ? " is-filled" : ""}${selCls}${gap ? " is-gap" : ""}" data-slot="${s.key}" style="left:${s.x}%;top:${s.y}%">
          ${p
            ? `<div class="field-pl${mism ? " is-mismatch" : ""}" title="${mism ? "Position passt nicht: " + p.pos + " auf " + s.role : esc(p.name)}">
                 <span class="fp-nr">${p.nr != null ? p.nr : ""}</span>
                 <span class="fp-name">${esc(shortName(p.name))}</span>
                 ${mism ? '<span class="fp-warn">!</span>' : ""}
               </div>`
            : `<span class="slot-role">${s.role}${gap ? " !" : ""}</span>`}
        </div>`;
      }).join("")}
    </div>`;
  }

  function poolChip(p, opts) {
    opts = opts || {};
    const st = statusInfo(p.status);
    if (opts.injured) {
      return `<div class="pl-chip is-injured" title="verletzt – nicht aufstellbar">
        <span class="pl-nr">${p.nr != null ? p.nr : "–"}</span><span class="pl-name">${esc(p.name)}</span>
        <span class="pl-pos">${esc(p.pos || "")}</span><span class="pl-st">verletzt</span></div>`;
    }
    const selCls = (lb.sel && lb.sel.kind === "pool" && lb.sel.id === p.id) ? " is-selected" : "";
    return `<div class="pl-chip${selCls}${st ? " " + st.cls : ""}" draggable="true" data-player="${p.id}">
      <span class="pl-nr">${p.nr != null ? p.nr : "–"}</span><span class="pl-name">${esc(p.name)}</span>
      <span class="pl-pos">${esc(p.pos || "")}</span>${st ? `<span class="pl-st" title="${st.label}">${st.label}</span>` : ""}</div>`;
  }

  function renderLineup() {
    lbInitIfNeeded();
    const spiele = DEMO.events.filter((e) => e.typ === "spiel").sort((a, b) => a.datum.localeCompare(b.datum));
    if (!spiele.length) {
      viewEl.innerHTML = `<div class="page-head"><h1>Aufstellung</h1></div>
        <div class="empty">Noch keine Spiele angelegt.</div>`;
      lbTeardownPanels();
      return;
    }
    lbEnsurePanels();
    const ev        = DEMO.events.find((e) => e.id === lb.eventId);
    const varianten = (DEMO.lineups || []).filter((l) => l.eventId === lb.eventId && !l.isTemplate);
    const aktiv     = varianten.find((l) => l.isActive);
    const istAktiv  = aktiv && aktiv.id === lb.lineupId;
    const placedN   = Object.values(lb.assign).filter(Boolean).length;

    const formOpt = Object.keys(FORMATIONS).map((f) =>
      `<option value="${f}" ${f === lb.formation ? "selected" : ""}>${f}</option>`).join("");
    const gameLine = ev
      ? `${fmtDay(ev.datum)}. ${fmtMon(ev.datum)}${ev.zeit ? " · " + ev.zeit + " Uhr" : ""} · ${ev.heim ? "vs." : "@"} ${esc(ev.gegner || ev.titel)}`
      : "Kein Spiel gewählt";
    const chip = aktiv
      ? `<span class="lu2-chip is-on">● Aktiv: ${esc(aktiv.name)}</span>`
      : `<span class="lu2-chip">Noch keine aktive Aufstellung</span>`;

    viewEl.innerHTML = `
      <div class="lu2">
        <div class="lu2-head">
          <div class="lu2-game">${gameLine}</div>
          <div class="lu2-row2">
            ${chip}
            <div class="lu2-tools">
              <select class="lu-select lu2-form" data-lu-formation aria-label="Formation">${formOpt}</select>
              <button class="lu2-more" data-lu-more aria-label="Mehr: Spiel, Varianten, Vorlagen">⋯</button>
            </div>
          </div>
        </div>
        <div class="lu2-field">${renderPitch(lb.formation, lb.assign)}</div>
        <div class="lu2-actions">
          <button class="btn btn-primary lu2-primary" data-lu-saveactive>
            <span>${istAktiv ? "Aktiv ✓ – Änderungen speichern" : "Speichern &amp; aktiv setzen"}</span>
            <small>${placedN}/11 gesetzt</small>
          </button>
        </div>
      </div>`;

    lbRenderMoreBody();
    if (document.getElementById("luPanel") && document.getElementById("luPanel").classList.contains("open") && lb.sel && lb.sel.kind === "slot") {
      lbRenderPanelBody(lb.sel.key);
    }
  }

  // --- Mutationen -------------------------------------------------------------
  function lbPlace(key, id) {
    if (!id) return;
    Object.keys(lb.assign).forEach((k) => { if (lb.assign[k] === id) lb.assign[k] = null; });
    lb.assign[key] = id;
    lb.gaps = lb.gaps.filter((g) => g !== key);
  }
  function lbSwap(k1, k2) {
    if (k1 === k2) return;
    const a = lb.assign[k1] || null, b = lb.assign[k2] || null;
    lb.assign[k1] = b; lb.assign[k2] = a;
  }
  function lbRemove(key) { lb.assign[key] = null; }

  // --- Tippen-zum-Zuweisen (Variante B) --------------------------------------
  // Slot antippen -> Position merken + Kader-Panel von unten einfahren.
  function lbTapSlot(key) {
    lb.sel = { kind: "slot", key: key };
    renderLineup();      // markiert die gewählte Position auf dem Feld
    lbOpenPanel(key);    // Panel (persistiert in body) sanft einfahren
  }
  // Spieler im Panel antippen -> setzen, Panel wieder ausfahren.
  function lbTapPool(id) {
    if (!id) return;
    if (lb.sel && lb.sel.kind === "slot") { lbPlace(lb.sel.key, id); lb.sel = null; lbClosePanel(); renderLineup(); }
  }

  // --- Drag & Drop ------------------------------------------------------------
  function lbDropOnSlot(key) {
    if (!lbDrag) return;
    if (lbDrag.kind === "pool") lbPlace(key, lbDrag.id);
    else if (lbDrag.kind === "slot") lbSwap(lbDrag.key, key);
    lbDrag = null; lb.sel = null; renderLineup();
  }
  function lbDropOnBank() {
    if (lbDrag && lbDrag.kind === "slot") lbRemove(lbDrag.key);
    lbDrag = null; lb.sel = null; renderLineup();
  }

  // --- Steuerung --------------------------------------------------------------
  // Formationswechsel: gesetzte Spieler nach Rollen-Affinität auf die ähnlichste
  // Position übernehmen (Flügel->Außenbahn, 10er->9er …), nur transform-freie Neuzuordnung.
  function lbChangeFormation(val) {
    const oldSlots = FORMATIONS[lb.formation] || [];
    const placed = [];
    oldSlots.forEach((s) => { const pid = lb.assign[s.key]; if (pid) placed.push({ pid: pid, role: s.role, x: s.x }); });
    const nsl = FORMATIONS[val] || [];
    const pairs = [];
    placed.forEach((pl) => {
      nsl.forEach((s) => { const r = lbAffRank(pl.role, s.role); if (r < 0) return; pairs.push({ pid: pl.pid, key: s.key, cost: r * 1000 + Math.abs(pl.x - s.x) }); });
    });
    pairs.sort((a, b) => a.cost - b.cost);
    const usedP = new Set(), usedK = new Set(), na = {};
    pairs.forEach((p) => { if (usedP.has(p.pid) || usedK.has(p.key)) return; na[p.key] = p.pid; usedP.add(p.pid); usedK.add(p.key); });
    lb.formation = val; lb.assign = na; lb.gaps = []; lb.sel = null;
  }
  function lbChangeVariant(val) {
    if (val === "new") lbNew();
    else { const l = (DEMO.lineups || []).find((x) => x.id === val); if (l) lbLoad(l); }
  }
  function defaultVariantName() {
    const n = (DEMO.lineups || []).filter((l) => l.eventId === lb.eventId && !l.isTemplate).length;
    return "Variante " + String.fromCharCode(65 + n);
  }
  async function lbSave() {
    const nameEl = document.querySelector("[data-lu-name]");
    lb.name = ((nameEl ? nameEl.value : lb.name) || "").trim() || defaultVariantName();
    if (!lb.eventId) { window.alert("Bitte zuerst ein Spiel wählen."); return; }
    try {
      const row = await DB.saveLineup({
        id: lb.lineupId, clubId: DEMO.clubId, eventId: lb.eventId,
        name: lb.name, formation: lb.formation, slots: cleanAssign(lb.assign), bank: lbBankIds(), isTemplate: false,
      });
      lb.lineupId = row.id; lb.msg = "Gespeichert.";
      await reloadData();
    } catch (err) { window.alert("Speichern fehlgeschlagen: " + ((err && err.message) || err)); }
  }
  async function lbActivate() {
    if (!lb.lineupId) await lbSave();
    if (!lb.lineupId) return;
    try { await DB.setLineupActive(lb.lineupId); lb.msg = "Als aktive Aufstellung gesetzt."; await reloadData(); }
    catch (err) { window.alert("Konnte nicht aktiv setzen: " + ((err && err.message) || err)); }
  }
  async function lbSaveTemplate() {
    const nameEl = document.querySelector("[data-lu-name]");
    let nm = window.prompt("Name der Vorlage:", ((nameEl ? nameEl.value : lb.name) || "").trim() || "Vorlage");
    if (nm === null) return;
    try {
      await DB.saveLineup({ clubId: DEMO.clubId, eventId: null, name: (nm.trim() || "Vorlage"),
        formation: lb.formation, slots: cleanAssign(lb.assign), bank: [], isTemplate: true });
      lb.msg = "Als Vorlage gespeichert."; await reloadData();
    } catch (err) { window.alert("Vorlage speichern fehlgeschlagen: " + ((err && err.message) || err)); }
  }
  function lbApplyTemplate() {
    const sel = document.querySelector("[data-lu-template]");
    const id = sel ? sel.value : "";
    if (!id) { window.alert("Bitte zuerst eine Vorlage wählen."); return; }
    const tpl = (DEMO.lineups || []).find((l) => l.id === id && l.isTemplate);
    if (!tpl) return;
    lb.lineupId = null; lb.name = tpl.name; lb.formation = tpl.formation;
    lb.assign = {}; lb.gaps = []; lb.sel = null;
    const zuSet = new Set(zusagenIds(lb.eventId));
    let dropped = 0;
    (FORMATIONS[tpl.formation] || []).forEach((s) => {
      const pid = (tpl.slots || {})[s.key];
      if (!pid) return;
      const pl = playerById[pid];
      if (pl && istFit(pl) && zuSet.has(pid)) lb.assign[s.key] = pid;
      else { lb.gaps.push(s.key); dropped++; }
    });
    lb.msg = dropped ? (dropped + " Slot(s) leer – Spieler ohne Zusage/verletzt weggelassen.") : "Vorlage angewendet.";
    renderLineup();
  }
  async function lbDeleteCurrent() {
    if (!lb.lineupId) { lbNew(); renderLineup(); return; }
    if (!window.confirm("Diese Aufstellung wirklich löschen?")) return;
    try { await DB.deleteLineup(lb.lineupId); lbNew(); lb.msg = "Gelöscht."; await reloadData(); }
    catch (err) { window.alert("Löschen fehlgeschlagen: " + ((err && err.message) || err)); }
  }

  // Primär-Aktion: aktuelle Aufstellung speichern UND als aktive setzen (ein Tap).
  async function lbSaveActivate() {
    if (!lb.eventId) { window.alert("Bitte zuerst ein Spiel wählen (Menü ⋯)."); return; }
    const nameEl = document.querySelector("[data-lu-name]");
    lb.name = ((nameEl ? nameEl.value : lb.name) || "").trim() || defaultVariantName();
    try {
      const row = await DB.saveLineup({
        id: lb.lineupId, clubId: DEMO.clubId, eventId: lb.eventId,
        name: lb.name, formation: lb.formation, slots: cleanAssign(lb.assign), bank: lbBankIds(), isTemplate: false,
      });
      lb.lineupId = row.id;
      await DB.setLineupActive(lb.lineupId);
      lb.msg = "Gespeichert & aktiv gesetzt.";
      await reloadData();
    } catch (err) { window.alert("Fehlgeschlagen: " + ((err && err.message) || err)); }
  }

  /* ---- Kader-Panel + „Mehr"-Sheet (persistieren in body -> flüssiges Ein-/Ausfahren) ---- */
  function lbEnsurePanels() {
    if (document.getElementById("luPanels")) return;
    const wrap = document.createElement("div");
    wrap.id = "luPanels";
    wrap.innerHTML =
      '<div class="lu-scrim" id="luScrim" data-lu-panel-close></div>' +
      '<div class="lu-sheet" id="luPanel" role="dialog" aria-modal="true" aria-label="Spieler wählen">' +
        '<div class="lu-sheet-head"><span class="lu-grip"></span>' +
          '<div><strong id="luPanelTitle">Spieler wählen</strong><div class="lu-sheet-sub" id="luPanelSub"></div></div>' +
          '<button class="lu-sheet-x" data-lu-panel-close aria-label="Schließen">&times;</button></div>' +
        '<div class="lu-sheet-body" id="luPanelBody"></div></div>' +
      '<div class="lu-scrim" id="luMoreScrim" data-lu-more-close></div>' +
      '<div class="lu-sheet" id="luMore" role="dialog" aria-modal="true" aria-label="Mehr">' +
        '<div class="lu-sheet-head"><span class="lu-grip"></span>' +
          '<div><strong>Mehr</strong><div class="lu-sheet-sub">Spiel, Varianten &amp; Vorlagen</div></div>' +
          '<button class="lu-sheet-x" data-lu-more-close aria-label="Schließen">&times;</button></div>' +
        '<div class="lu-sheet-body" id="luMoreBody"></div></div>';
    document.body.appendChild(wrap);

    wrap.addEventListener("click", (ev) => {
      const t = ev.target;
      if (t.closest("[data-lu-panel-close]")) { lb.sel = null; lbClosePanel(); renderLineup(); return; }
      const pl = t.closest("[data-player]"); if (pl) { lbTapPool(pl.dataset.player); return; }
      if (t.closest("[data-lu-empty]")) { if (lb.sel && lb.sel.kind === "slot") lbRemove(lb.sel.key); lb.sel = null; lbClosePanel(); renderLineup(); return; }
      if (t.closest("[data-lu-more-close]")) { lbCloseMore(); return; }
      if (t.closest("[data-lu-save]"))    { lbCloseMore(); lbSave(); return; }
      if (t.closest("[data-lu-tplsave]")) { lbCloseMore(); lbSaveTemplate(); return; }
      if (t.closest("[data-lu-apply]"))   { lbCloseMore(); lbApplyTemplate(); return; }
      if (t.closest("[data-lu-delete]"))  { lbCloseMore(); lbDeleteCurrent(); return; }
    });
    wrap.addEventListener("change", (ev) => {
      const t = ev.target;
      if (t.matches("[data-lu-event]"))   { lb.eventId = t.value; lbLoadActiveOrNew(); renderLineup(); }
      else if (t.matches("[data-lu-variant]")) { lbChangeVariant(t.value); renderLineup(); }
    });
  }
  function lbTeardownPanels() { const w = document.getElementById("luPanels"); if (w && w.parentNode) w.parentNode.removeChild(w); }

  function lbRenderPanelBody(selKey) {
    const body = document.getElementById("luPanelBody"); if (!body) return;
    const placedSet = new Set(Object.values(lb.assign).filter(Boolean));
    const slot = (FORMATIONS[lb.formation] || []).find((s) => s.key === selKey);
    let html = "";
    if (slot && lb.assign[selKey]) html += '<button class="lu-empty-btn" data-lu-empty>Position „' + esc(slot.role) + '" leeren</button>';
    LB_GROUPS.forEach(([gk, label]) => {
      const list = DEMO.players.filter((p) => lbTeamPart(p.pos) === gk)
        .sort((a, b) => ((lbAvail(a) || { rank: 0 }).rank - (lbAvail(b) || { rank: 0 }).rank) || byName(a, b));
      if (!list.length) return;
      html += '<div class="lu-kgroup" data-grp="' + gk + '"><h4>' + label + ' <span>' + list.length + '</span></h4><div class="lu-klist">';
      list.forEach((p) => {
        const placed = placedSet.has(p.id);
        const av = lbAvail(p);
        const tap = !placed;   // Verletzte/Abgesagte bleiben setzbar; nur bereits Aufgestellte nicht.
        const tag = placed ? '<span class="lu-ptag placed">aufgestellt</span>'
          : (av ? '<span class="lu-ptag ' + av.cls + '">' + av.label + '</span>' : '<span class="lu-ptag ok">verfügbar</span>');
        html += '<div class="lu-pchip' + (placed ? " is-placed" : "") + (av ? " is-off" : "") + '"' + (tap ? ' data-player="' + p.id + '"' : "") + '>' +
          '<span class="lu-pnr">' + (p.nr != null ? p.nr : "–") + '</span>' +
          '<span class="lu-pwho"><span class="lu-pname">' + esc(p.name) + '</span><span class="lu-pmeta">' + esc(p.pos || "") + '</span></span>' +
          tag + '</div>';
      });
      html += '</div></div>';
    });
    body.innerHTML = html;
  }
  function lbRenderMoreBody() {
    const body = document.getElementById("luMoreBody"); if (!body) return;
    const spiele = DEMO.events.filter((e) => e.typ === "spiel").sort((a, b) => a.datum.localeCompare(b.datum));
    const varianten = (DEMO.lineups || []).filter((l) => l.eventId === lb.eventId && !l.isTemplate);
    const vorlagen  = (DEMO.lineups || []).filter((l) => l.isTemplate);
    const evOpt = spiele.map((e) =>
      `<option value="${e.id}" ${e.id === lb.eventId ? "selected" : ""}>${fmtDay(e.datum)}. ${fmtMon(e.datum)} · ${e.heim ? "vs." : "@"} ${esc(e.gegner || e.titel)}</option>`).join("");
    const varOpt = `<option value="new" ${!lb.lineupId ? "selected" : ""}>Neue Aufstellung</option>` +
      varianten.map((l) => `<option value="${l.id}" ${l.id === lb.lineupId ? "selected" : ""}>${esc(l.name)}${l.isActive ? " (aktiv)" : ""}</option>`).join("");
    const tplOpt = `<option value="">Vorlage wählen …</option>` +
      vorlagen.map((l) => `<option value="${l.id}">${esc(l.name)} (${l.formation})</option>`).join("");
    body.innerHTML =
      `<label class="lu-mfield">Spiel<select class="lu-select" data-lu-event>${evOpt}</select></label>` +
      `<label class="lu-mfield">Variante<select class="lu-select" data-lu-variant>${varOpt}</select></label>` +
      `<label class="lu-mfield">Name der Variante<input class="lu-name" data-lu-name type="text" value="${esc(lb.name)}" placeholder="z. B. Plan B ohne Lukas"></label>` +
      `<button class="btn" data-lu-save>Als weitere Variante speichern</button>` +
      `<button class="btn" data-lu-tplsave>Als Vorlage speichern</button>` +
      `<label class="lu-mfield">Vorlage verwenden<select class="lu-select" data-lu-template>${tplOpt}</select></label>` +
      `<button class="btn btn-soft" data-lu-apply>Vorlage anwenden</button>` +
      `<button class="btn btn-danger" data-lu-delete>Aufstellung löschen</button>` +
      (lb.msg ? `<div class="lu-msg">${esc(lb.msg)}</div>` : "");
  }
  function lbOpenPanel(key) {
    lbEnsurePanels();
    const slot = (FORMATIONS[lb.formation] || []).find((s) => s.key === key);
    const tt = document.getElementById("luPanelTitle"); if (tt) tt.textContent = "Spieler für " + (slot ? slot.role : "Position");
    const ss = document.getElementById("luPanelSub"); if (ss) ss.textContent = lb.assign[key] ? "Ersetzen oder Position leeren" : "Passenden Spieler antippen";
    lbRenderPanelBody(key);
    document.getElementById("luScrim").classList.add("open");
    document.getElementById("luPanel").classList.add("open");
    const grp = slot ? lbTeamPart(slot.role) : null;
    if (grp) { const h = document.querySelector('#luPanelBody [data-grp="' + grp + '"]'); if (h) h.scrollIntoView({ block: "start" }); }
  }
  function lbClosePanel() {
    const p = document.getElementById("luPanel"), s = document.getElementById("luScrim");
    if (p) p.classList.remove("open"); if (s) s.classList.remove("open");
  }
  function lbOpenMore() { lbEnsurePanels(); lbRenderMoreBody(); document.getElementById("luMoreScrim").classList.add("open"); document.getElementById("luMore").classList.add("open"); }
  function lbCloseMore() { const m = document.getElementById("luMore"), s = document.getElementById("luMoreScrim"); if (m) m.classList.remove("open"); if (s) s.classList.remove("open"); }

  /* =========================================================================
     AUFSTELLUNG v2 (Neubau). Aktiv bei LINEUP_V2 = true; die Legacy-Seite
     (renderLineup) bleibt via Flag erhalten, wird aber nicht mehr geroutet.
     ========================================================================= */
  const LINEUP_V2 = true;
  const TV_FAV_KEY = "fn_lineup_favs";
  const tv = { view: "games", eventId: null, formation: "4-4-2", assign: {}, bank: [], sel: null, hideCta: false,
               origin: null, originScroll: 0, readonly: false, dirty: false,
               alleSpiele: false,     // C1: Liste auf drei Spiele gekuerzt
               mark: null };          // C2: markierte Position zum Tauschen
  const TV_BANK_MAX = 7;
  let tvFavMode = false;
  let tvFav = (function () {
    try { const s = JSON.parse(localStorage.getItem(TV_FAV_KEY)); if (Array.isArray(s) && s.length >= 2) return s.slice(0, 4); } catch (e) {}
    return ["4-4-2", "4-2-3-1", "4-3-3"];
  })();
  function tvSaveFav() { try { localStorage.setItem(TV_FAV_KEY, JSON.stringify(tvFav)); } catch (e) {} }

  function tvPlaced() { return new Set(Object.values(tv.assign).filter(Boolean)); }
  function tvRsvp(pid) { return (state.rsvp[tv.eventId + "|" + pid] || {}).status; }
  function tvAvail(p) {
    if (p.status === "verletzt") return { cls: "verl", label: "verletzt", rank: 4 };
    if (p.status === "urlaub")   return { cls: "url", label: "Urlaub", rank: 4 };
    const r = tvRsvp(p.id);
    if (r === "ab") return { cls: "abw", label: "abgesagt", rank: 3 };
    if (r !== "zu") return { cls: "none", label: "o. Rückm.", rank: 2 };
    if (p.status === "angeschlagen") return { cls: "ang", label: "angeschlagen", rank: 1 };
    return null;
  }
  // Auto-Aufstellen: verfügbar, angeschlagen ODER ohne Rückmeldung sind nutzbar.
  // Nicht nutzbar nur abgesagt (rank 3) und verletzt (rank 4).
  function tvUsableForAuto(p) { const a = tvAvail(p); return !a || a.rank <= 2; }
  function tvMini(f) { const s = FORMATIONS[f] || []; return '<span class="tv-mini">' + s.map(x => '<i style="left:' + x.x + '%;top:' + x.y + '%"></i>').join("") + '</span>'; }
  function tvLastName(n) { const q = String(n || "").trim().split(/\s+/); return q[q.length - 1] || String(n || ""); }

  // Jüngstes vergangenes Spiel mit aktiver Aufstellung (für „übernehmen & anpassen").
  function tvLastLineup() {
    // Referenz = juengstes Spiel MIT aktiver Aufstellung, dessen Datum VOR dem gerade
    // bearbeiteten Spiel liegt (nicht vor heute) -> passt sich dem geoeffneten Spiel an.
    const cur = DEMO.events.find(e => e.id === tv.eventId);
    const curDate = cur ? cur.datum : null;
    const cand = DEMO.events
      .filter(e => e.typ === "spiel" && e.id !== tv.eventId && (!curDate || e.datum < curDate))
      .sort((a, b) => b.datum.localeCompare(a.datum));
    for (const e of cand) {
      const lu = (DEMO.lineups || []).find(l => l.eventId === e.id && l.isActive && !l.isTemplate);
      if (lu && FORMATIONS[lu.formation]) return { event: e, formation: lu.formation, slots: lu.slots || {} };
    }
    return null;
  }

  function renderLineupV2() {
    tvEnsurePanels();
    if (!DEMO) { viewEl.innerHTML = '<div class="empty">Lädt …</div>'; return; }
    if (tv.view === "lineup" && tv.eventId != null) tvViewLineup(); else tvViewGames();
  }

  /* ---- Zustand 1: Spiel wählen (Vorlage trainer-sheet-v2.png) --------------
     Aufbau gemessen aus dem Bild: Karte „Nächstes Spiel", Kaderkarte,
     Abschnitt „Weitere Spiele" mit Verweis „Alle", Abschnitt „Vorlagen" mit
     Verweis „Neu". Alle Masse stehen im Stylesheet, jeweils mit Messwert.   */
  function tvViewGames() {
    tv.view = "games"; tv.dirty = false; tv.readonly = false; tvClosePanels();
    const up = DEMO.events.filter(e => e.typ === "spiel" && isFuture(e.datum)).sort((a, b) => a.datum.localeCompare(b.datum));
    const naechstes = up[0];
    const weitere = up.slice(1);
    viewEl.innerHTML =
      '<div class="page-head tv-head"><h1>Trainer</h1>' +
      '<p>Spiel wählen, danach baust du die Elf auf dem Platz.</p></div>' +
      (naechstes ? tvNextHtml(naechstes)
                 : '<div class="card card-pad"><div class="empty">Kein anstehendes Spiel. Sobald im Kalender ein Spiel angelegt ist, kannst du hier die Aufstellung bauen.</div></div>') +
      // K3: Der Kader steht als eigene Karte unter dem naechsten Spiel. Ein
      // reiner Trainer kommt ueber den 5. Tab direkt hierher und haette sonst
      // keinen Weg dorthin.
      tvKaderKarteHtml() +
      (weitere.length
        ? '<div class="section-title sec-mini"><h2>Weitere Spiele</h2>' +
          (weitere.length > 2
            ? '<button class="link-btn" data-tvallgames>' + (tv.alleSpiele ? "Weniger" : "Alle") + ' &rsaquo;</button>'
            : "") +
          '</div><div class="card tv-glist">' +
          (tv.alleSpiele ? weitere : weitere.slice(0, 2)).map(tvGameRow).join("") + '</div>'
        : "") +
      tvTemplatesHtml();
  }

  // „Anpfiff in 3 Tagen" - die Vorlage nennt den Abstand, nicht das Datum;
  // das steht im Datumsblock links daneben.
  function anpfiffText(iso) {
    const tage = Math.round((parseDate(iso) - parseDate(HEUTE)) / 86400000);
    if (tage <= 0) return "Anpfiff heute";
    if (tage === 1) return "Anpfiff morgen";
    return "Anpfiff in " + tage + " Tagen";
  }
  /* Karte „Nächstes Spiel" (Vorlage trainer-kacheln-v2.png): Marke und
     Plakette, Datumsblock mit Gegner, drei Kennzahlen aus den Rückmeldungen
     und der Knopf in die Platzansicht. Der Aufstellungsstand steht nicht mehr
     hier - er bleibt als Plakette „Elf steht" / „offen" in der Spielliste. */
  function tvNextHtml(e) {
    const gesamt = DEMO.players.length;
    const zu = DEMO.players.filter((p) => (state.rsvp[e.id + "|" + p.id] || {}).status === "zu").length;
    const ab = DEMO.players.filter((p) => (state.rsvp[e.id + "|" + p.id] || {}).status === "ab").length;
    const offen = gesamt - zu - ab;
    const meta = (e.zeit ? esc(e.zeit) + " Uhr · " : "") + anpfiffText(e.datum);

    return '<div class="card tv-next">' +
      '<div class="tv-next-kopf"><span class="tv-next-lbl">Nächstes Spiel</span>' +
      (e.heim == null ? "" : '<span class="tv-next-bdg">' + (e.heim ? "Heim" : "Auswärts") + '</span>') +
      '</div>' +
      '<div class="tv-next-zeile">' +
        '<span class="tv-next-datum"><b class="num">' + fmtDay(e.datum) + '</b><i>' + fmtMon(e.datum) + '</i></span>' +
        '<span class="tv-next-main"><span class="tv-next-t">' + esc(e.gegner || e.titel) + '</span>' +
        '<span class="tv-next-m num">' + meta + '</span></span>' +
      '</div>' +
      '<div class="tv-next-zahlen">' +
        '<div class="tv-nz"><b class="num is-zu">' + zu + '</b><span>Zugesagt</span></div>' +
        '<div class="tv-nz"><b class="num is-ab">' + ab + '</b><span>Abgesagt</span></div>' +
        '<div class="tv-nz"><b class="num is-of">' + offen + '</b><span>Offen</span></div>' +
      '</div>' +
      '<div class="tv-next-fuss"><button class="tv-next-btn" data-tvgame="' + e.id + '">Elf aufstellen</button></div>' +
      '</div>';
  }

  /* Kaderkarte: Kopfzeile mit Spielerzahl, darunter ein Balken im Verhältnis
     der vier Statuswerte und die Legende dazu. Die Zahlen kommen aus
     player_status, das die App ohnehin geladen hat. */
  const KADER_STATUS = [
    ["fit",          "is-fit",  "fit"],
    ["angeschlagen", "is-ang",  "angeschlagen"],
    ["verletzt",     "is-verl", "verletzt"],
    ["urlaub",       "is-url",  "Urlaub"],
  ];
  function tvKaderKarteHtml() {
    const gesamt = DEMO.players.length;
    const zahl = {};
    KADER_STATUS.forEach(([wert]) => { zahl[wert] = 0; });
    DEMO.players.forEach((p) => {
      const s = (p.status && zahl[p.status] !== undefined) ? p.status : "fit";
      zahl[s]++;
    });
    const anteil = (n) => gesamt ? (n / gesamt) * 100 : 0;

    const balken = KADER_STATUS.map(([wert, cls]) =>
      zahl[wert] ? '<i class="' + cls + '" style="width:' + anteil(zahl[wert]).toFixed(2) + '%"></i>' : ""
    ).join("");
    const legende = KADER_STATUS.map(([wert, cls, label]) =>
      '<span class="tv-kstat"><i class="' + cls + '"></i><b class="num">' + zahl[wert] + '</b><span>' + label + '</span></span>'
    ).join("");
    const gelesen = KADER_STATUS.map(([wert, , label]) => zahl[wert] + " " + label).join(", ");

    return '<button class="card tv-kader" data-goto="kader">' +
      '<span class="tv-kader-kopf"><span class="tv-kader-t">Kader</span>' +
      '<span class="tv-kader-n num">' + gesamt + ' Spieler</span>' +
      '<span class="tv-garrow">›</span></span>' +
      '<span class="tv-kbar" role="img" aria-label="' + esc(gelesen) + '">' + balken + '</span>' +
      '<span class="tv-kleg">' + legende + '</span>' +
      '</button>';
  }


  /* Zeile in „Weitere Spiele": Datum, Gegner, Zeit und Ort, Plakette, Chevron. */
  function tvGameRow(e) {
    const lu = (DEMO.lineups || []).find((l) => l.eventId === e.id && l.isActive && !l.isTemplate);
    const slots = lu ? (FORMATIONS[lu.formation] || []) : [];
    const gesetzt = lu ? slots.map((s) => (lu.slots || {})[s.key]).filter(Boolean).length : 0;
    const steht = !!(lu && slots.length && gesetzt === slots.length);
    return '<button class="tv-grow" data-tvgame="' + e.id + '">' +
      '<span class="tv-gdate"><span class="d-day num">' + fmtDay(e.datum) + '</span>' +
        '<span class="d-mon">' + fmtMon(e.datum) + '</span></span>' +
      '<span class="tv-gmain"><span class="tv-gopp">' + esc(e.gegner || e.titel) + '</span>' +
        '<span class="tv-gmeta num">' + (e.zeit ? esc(e.zeit) + " · " : "") + (e.heim ? "Heim" : "Auswärts") + '</span></span>' +
      '<span class="tv-gchip' + (steht ? "" : " is-offen") + '">' + (steht ? "Elf steht" : "offen") + '</span>' +
      '<span class="tv-garrow">›</span></button>';
  }

  /* Vorlagen (K1). Gespeichert werden sie in der Platzansicht ueber das
     ⋯-Menue, angewendet ebenfalls dort. Hier stehen sie zum Nachsehen und zum
     Loeschen - damit ist der Kreis aus Speichern, Anwenden und Loeschen
     geschlossen. Zwei Abweichungen von der Vorlage, beide notiert:
     der Papierkorb bleibt (sonst waere keine Vorlage mehr loeschbar), und
     „Neu" fuehrt in die Platzansicht des naechsten Spiels, weil eine Vorlage
     nur aus einer offenen Aufstellung entstehen kann. */
  function tvTemplatesHtml() {
    const tpl = (DEMO.lineups || []).filter(l => l.isTemplate);
    const naechstes = DEMO.events.filter(e => e.typ === "spiel" && isFuture(e.datum))
      .sort((a, b) => a.datum.localeCompare(b.datum))[0];
    const kopf = '<div class="section-title sec-mini"><h2>Vorlagen</h2>' +
      (naechstes ? '<button class="link-btn" data-tvtplnew="' + naechstes.id + '">Neu &rsaquo;</button>' : "") +
      '</div>';
    // A6: Der Abschnitt steht immer da. Ohne Vorlage sagt er, wie man eine anlegt -
    // sonst sucht man den Weg vergeblich.
    if (!tpl.length) {
      return kopf + '<div class="card card-pad tv-tpl-leer"><p class="rs">Noch keine Vorlage. ' +
        'Speichere eine Aufstellung über das Menü ⋯ als Vorlage.</p></div>';
    }
    return kopf + '<div class="card tv-tpls">' + tpl.map(l =>
      '<div class="tv-tpl"><span class="tv-tpl-main"><span class="tv-tpl-n">' + esc(l.name) + '</span>' +
      '<span class="rs">' + tvTplStand(l) + '</span></span>' +
      '<span class="tv-tpl-chip num">' + esc(l.formation) + '</span>' +
      '<button class="icon-btn" data-tvtpldel="' + l.id + '" title="Vorlage löschen" aria-label="Vorlage ' + esc(l.name) + ' löschen">' + ICON_TRASH + '</button></div>'
    ).join("") + '</div>';
  }
  // Die Vorlage schreibt „zuletzt genutzt"; die Tabelle kennt nur updated_at,
  // also steht hier ehrlich „geändert am".
  function tvTplStand(l) {
    if (!l.updatedAt) return "Vorlage";
    const d = new Date(l.updatedAt);
    if (isNaN(d)) return "Vorlage";
    return "geändert am " + d.getDate() + ". " + MON[d.getMonth()];
  }
  async function tvSaveTemplate() {
    const nm = window.prompt("Name der Vorlage:", tv.formation + " Standard");
    if (nm === null) return;
    try {
      await DB.saveLineup({ clubId: DEMO.clubId, eventId: null, name: (nm.trim() || "Vorlage"),
        formation: tv.formation, slots: tvCleanAssign(), bank: [], isTemplate: true });
      await reloadData(); tvToast("Als Vorlage gespeichert");
    } catch (err) { window.alert("Vorlage speichern fehlgeschlagen: " + ((err && err.message) || err)); }
  }
  async function tvDeleteTemplate(id) {
    const l = (DEMO.lineups || []).find(x => x.id === id && x.isTemplate);
    if (!l) return;
    if (!window.confirm("Vorlage „" + l.name + "“ wirklich löschen?")) return;
    try { await DB.deleteLineup(id); await reloadData(); render(); tvToast("Vorlage gelöscht"); }
    catch (err) { window.alert("Löschen fehlgeschlagen: " + ((err && err.message) || err)); }
  }
  /* Vorlage auf das offene Spiel anwenden. Spieler ohne Zusage oder mit
     Verletzung bleiben weg - dieselbe Regel wie beim Uebernehmen vom letzten
     Spiel, damit man nie versehentlich einen Verletzten aufstellt. */
  function tvApplyTemplate(id) {
    const tpl = (DEMO.lineups || []).find(l => l.id === id && l.isTemplate);
    if (!tpl || !FORMATIONS[tpl.formation]) return;
    tvCloseMenu();
    const zu = new Set(zusagenIds(tv.eventId));
    const a = {}; let weg = 0;
    FORMATIONS[tpl.formation].forEach(s => {
      const pid = (tpl.slots || {})[s.key];
      if (!pid) return;
      const p = playerById[pid];
      if (p && istFit(p) && zu.has(pid)) a[s.key] = pid; else weg++;
    });
    tv.formation = tpl.formation; tv.assign = a; tv.bank = []; tv.sel = null;
    tv.dirty = true; tv.hideCta = true;
    renderLineupV2();
    tvToast(weg ? ((weg === 1 ? "1 Platz" : weg + " Plätze") + " leer – ohne Zusage oder verletzt") : "Vorlage angewendet");
  }

  function tvOpenGame(eventId) {
    tv.eventId = eventId; tv.sel = null; tv.hideCta = false; tv.dirty = false;
    const lu = (DEMO.lineups || []).find(l => l.eventId === eventId && l.isActive && !l.isTemplate);
    if (lu && FORMATIONS[lu.formation]) {
      tv.formation = lu.formation;
      const a = {}; FORMATIONS[lu.formation].forEach(s => { const pid = (lu.slots || {})[s.key]; if (pid && playerById[pid]) a[s.key] = pid; });
      tv.assign = a;
      const placed = new Set(Object.values(a));
      tv.bank = (Array.isArray(lu.bank) ? lu.bank : []).filter(id => playerById[id] && !placed.has(id)).slice(0, TV_BANK_MAX);
    } else { tv.formation = tvFav[0] || "4-4-2"; tv.assign = {}; tv.bank = []; }
    tv.view = "lineup"; renderLineupV2();
  }
  function tvPlacedAll() { return new Set([].concat(Object.values(tv.assign).filter(Boolean), tv.bank)); }

  /* ---- Zustand 2: Aufstellung ---- */
  function tvPitchBg() {
    return '<svg class="tv-pitch-bg" viewBox="0 0 68 105" preserveAspectRatio="none" aria-hidden="true"><rect width="68" height="105" fill="#2e7d46"/><g fill="none" stroke="rgba(255,255,255,.3)" stroke-width="0.3"><rect x="2" y="2" width="64" height="101"/><line x1="2" y1="52.5" x2="66" y2="52.5"/><circle cx="34" cy="52.5" r="9"/><rect x="14" y="2" width="40" height="16"/><rect x="24" y="2" width="20" height="6"/><rect x="14" y="87" width="40" height="16"/><rect x="24" y="97" width="20" height="6"/></g><circle cx="34" cy="52.5" r="0.7" fill="rgba(255,255,255,.35)"/></svg>';
  }
  function tvPitchHtml() {
    const slots = FORMATIONS[tv.formation]; let h = tvPitchBg();
    slots.forEach(s => {
      const pid = tv.assign[s.key], p = pid ? playerById[pid] : null;
      const sel = ((tv.sel && tv.sel.key === s.key) || (tv.mark && tv.mark.art === 'feld' && tv.mark.key === s.key)) ? " sel" : "";
      h += '<div class="tv-slot' + (p ? " filled" : "") + sel + '" data-tvslot="' + s.key + '" style="left:' + s.x + '%;top:' + s.y + '%">' +
        '<div class="tv-disc">' + (p ? ('<span>' + (p.nr != null ? p.nr : "") + '</span>') : ('<span class="tv-role">' + s.role + '</span>')) + '</div>' +
        (p ? ('<span class="tv-pn">' + esc(tvLastName(p.name)) + '</span>') : '') + '</div>';
    });
    return h;
  }
  function tvFormbarHtml() {
    // Die Vorlage zeichnet die Formationspille als reinen Text. Das
    // Mini-Diagramm steht weiter in der Formationsauswahl im Blatt.
    return tvFav.map(f => '<button class="tv-fpill' + (f === tv.formation ? " on" : "") + '" data-tvform="' + f + '"><span>' + f + '</span></button>').join("") +
      '<button class="tv-fmore" data-tvmoreform>Weitere ›</button>';
  }
  function tvViewLineup() {
    const e = DEMO.events.find(x => x.id === tv.eventId);
    if (!e) { tvViewGames(); return; }
    const n = tvPlaced().size, last = tvLastLineup(), ro = tv.readonly;
    const backLbl = tv.origin != null ? "Zurück" : "Zurück zur Spielauswahl";
    viewEl.innerHTML =
      '<div class="tv-lu' + (ro ? " tv-ro" : "") + '">' +
        '<div class="tv-top">' +
          '<button class="tv-ic" data-tvback aria-label="' + backLbl + '">‹</button>' +
          '<div class="tv-hi"><div class="tv-game">' + (e.heim ? "vs. " : "@ ") + esc(e.gegner || e.titel) + '</div>' +
            '<div class="tv-sub">' + fmtDay(e.datum) + '. ' + fmtMon(e.datum) + (e.zeit ? " · " + e.zeit : "") + ' · ' + tv.formation + ' · ' + n + '/11' + (ro ? ' · nur ansehen' : '') + '</div></div>' +
          (ro ? '<span class="tv-ic" aria-hidden="true"></span>' : '<button class="tv-ic" data-tvmenu aria-label="Mehr">⋯</button>') +
        '</div>' +
        '<div class="tv-formbar">' + tvFormbarHtml() + '</div>' +
        '<div class="tv-field"><div class="tv-pitch">' + tvPitchHtml() +
          ((!ro && n === 0 && last && !tv.hideCta) ? '<div class="tv-cta-ov">' + tvEmptyCta(last) + '</div>' : "") +
          '</div></div>' +
        tvBankHtml() +
        (ro
          ? '<div class="tv-actions"><div class="tv-ro-note">Vergangenes Spiel – nur ansehen, nicht bearbeiten</div></div>'
          : '<div class="tv-actions"><button class="tv-primary" data-tvsave><span>Aufstellung speichern</span><small>' + n + '/11 gesetzt</small></button></div>') +
      '</div>';
  }
  function tvEmptyCta(last) {
    return '<div class="tv-cta"><p>Vom letzten Spiel übernehmen<br><b>' + esc((last.event.heim ? "vs. " : "@ ") + (last.event.gegner || last.event.titel)) + '</b> – fehlende Spieler werden automatisch durch verfügbare ersetzt.</p>' +
      '<button class="tv-primary" data-tvadopt><span>Übernehmen &amp; anpassen</span></button>' +
      '<button class="tv-ghost" data-tvfresh>Leer starten</button></div>';
  }
  // Auswechselbank: 7 kompakte Slots. Optional, unabhaengig von der Startelf.
  function tvBankHtml() {
    const ro = tv.readonly;
    let h = '<div class="tv-bank"><div class="tv-bank-h">Bank<span>' + tv.bank.length + '/' + TV_BANK_MAX + '</span></div><div class="tv-bank-row">';
    const slots = ro ? tv.bank.length : TV_BANK_MAX;   // nur ansehen: keine Leer-Slots
    for (let i = 0; i < slots; i++) {
      const pid = tv.bank[i], p = pid ? playerById[pid] : null;
      if (p && ro) {
        h += '<span class="tv-bslot filled"><span class="tv-bnr">' + (p.nr != null ? p.nr : "") + '</span><span class="tv-bn">' + esc(tvLastName(p.name)) + '</span></span>';
      } else if (p) {
        // C2: Tap markiert oder tauscht; das Kreuz nimmt von der Bank.
        const markiert = (tv.mark && tv.mark.art === 'bank' && tv.mark.idx === i) ? ' sel' : '';
        h += '<button class="tv-bslot filled' + markiert + '" data-tvbanktap="' + i + '" aria-label="' + esc(p.name) + ' tauschen">' +
             '<span class="tv-bnr">' + (p.nr != null ? p.nr : "") + '</span><span class="tv-bn">' + esc(tvLastName(p.name)) + '</span>' +
             '<span class="tv-bx" data-tvbankdel="' + pid + '" role="button" aria-label="' + esc(p.name) + ' von der Bank nehmen">&times;</span></button>';
      } else {
        h += '<button class="tv-bslot" data-tvbankadd aria-label="Bankspieler hinzufügen">' +
             '<span class="tv-bplus">+</span><span class="tv-bfrei">frei</span></button>';
      }
    }
    if (ro && !tv.bank.length) h += '<div class="tv-bank-empty">Keine Bank hinterlegt</div>';
    return h + '</div></div>';
  }

  function tvSwitchFormation(nf) {
    if (!FORMATIONS[nf]) return;
    const oldS = FORMATIONS[tv.formation], placed = [];
    oldS.forEach(s => { const pid = tv.assign[s.key]; if (pid) placed.push({ pid, role: s.role, x: s.x }); });
    const ns = FORMATIONS[nf], pairs = [];
    placed.forEach(pl => ns.forEach(s => { const r = lbAffRank(pl.role, s.role); if (r < 0) return; pairs.push({ pid: pl.pid, key: s.key, cost: r * 1000 + Math.abs(pl.x - s.x) }); }));
    pairs.sort((a, b) => a.cost - b.cost);
    const up = new Set(), uk = new Set(), na = {};
    pairs.forEach(p => { if (up.has(p.pid) || uk.has(p.key)) return; na[p.key] = p.pid; up.add(p.pid); uk.add(p.key); });
    tv.formation = nf; tv.assign = na; tv.sel = null; tv.dirty = true;
  }
  function tvAdopt() {
    tv.hideCta = true;                       // Dialog in jedem Fall schließen
    const last = tvLastLineup(); if (!last) { renderLineupV2(); tvToast("Kein Referenzspiel mit Aufstellung"); return; }
    tv.formation = last.formation;
    const slots = FORMATIONS[last.formation], used = new Set(), na = {};
    // 1) Spieler aus dem Referenzspiel, die jetzt einsetzbar sind, auf ihre Position.
    slots.forEach(s => { const pid = last.slots[s.key], p = pid ? playerById[pid] : null; if (p && tvUsableForAuto(p) && !used.has(pid)) { na[s.key] = pid; used.add(pid); } });
    // 2) Leere Positionen mit passenden verfügbaren Spielern auffüllen (Rollen-Affinität).
    slots.forEach(s => {
      if (na[s.key]) return;
      const cand = DEMO.players.filter(p => tvUsableForAuto(p) && !used.has(p.id)).map(p => ({ p, r: lbAffRank(p.pos, s.role) })).filter(x => x.r >= 0).sort((a, b) => a.r - b.r || byName(a.p, b.p))[0];
      if (cand) { na[s.key] = cand.p.id; used.add(cand.p.id); }
    });
    tv.assign = na; tv.sel = null; tv.dirty = true; renderLineupV2();
    const n = Object.keys(na).length;
    tvToast(n ? ("Übernommen – " + n + "/11 gesetzt") : "Keine verfügbaren Spieler zum Übernehmen");
  }
  function tvAssign(key, pid) {
    Object.keys(tv.assign).forEach(k => { if (tv.assign[k] === pid) delete tv.assign[k]; });
    const bi = tv.bank.indexOf(pid); if (bi !== -1) tv.bank.splice(bi, 1);   // nicht gleichzeitig auf der Bank
    tv.assign[key] = pid; tv.dirty = true;
  }
  function tvAddBank(pid) {
    if (!pid || tv.bank.length >= TV_BANK_MAX || tv.bank.indexOf(pid) !== -1) return;
    if (Object.values(tv.assign).indexOf(pid) !== -1) return;                // nicht gleichzeitig in der Startelf
    tv.bank.push(pid); tv.dirty = true;
  }
  function tvBankDel(pid) { const i = tv.bank.indexOf(pid); if (i !== -1) { tv.bank.splice(i, 1); tv.dirty = true; } }
  function tvCleanAssign() { const o = {}; Object.keys(tv.assign).forEach(k => { if (tv.assign[k]) o[k] = tv.assign[k]; }); return o; }
  // Nur persistieren (DB) + Daten neu laden. Keine Navigation. Wirft bei Fehler weiter.
  async function tvSavePersist() {
    if (!tv.eventId) return;
    const existing = (DEMO.lineups || []).find(l => l.eventId === tv.eventId && !l.isTemplate);
    const placedIds = new Set(Object.values(tv.assign).filter(Boolean));
    const bank = tv.bank.filter(id => id && playerById[id] && !placedIds.has(id)).slice(0, TV_BANK_MAX); // explizit gewaehlte Bank
    const row = await DB.saveLineup({ id: existing ? existing.id : null, clubId: DEMO.clubId, eventId: tv.eventId,
      name: existing && existing.name ? existing.name : "Aufstellung", formation: tv.formation, slots: tvCleanAssign(), bank: bank, isTemplate: false });
    await DB.setLineupActive(row.id);
    tv.dirty = false;
    await reloadData();                  // DEMO aktualisieren (Kachel/Fortschritt zeigen neuen Stand)
  }

  async function tvSave() {
    if (!tv.eventId) return;
    const btn = viewEl.querySelector("[data-tvsave]"); if (btn) btn.disabled = true;
    try {
      await tvSavePersist();
      tvToast("Gespeichert & aktiv gesetzt");
      if (tv.origin != null) { history.back(); }   // Kachel-Sprung: zurück zum Ursprung (popstate -> tvLeaveToOrigin, dirty schon false)
      else { tv.view = "games"; render(); }        // Nav-Einstieg: zurück zur Spielauswahl
    } catch (err) { if (btn) btn.disabled = false; window.alert("Speichern fehlgeschlagen: " + ((err && err.message) || err)); }
  }

  /* ---- Sprung aus Spiel-Kachel + Zurück-Navigation (Ursprung, Scroll, ungespeichert) ---- */
  function tvSetNavActive(view) {
    document.querySelectorAll(".nav-btn").forEach((b) => {
      const active = b.hasAttribute("data-more") ? SHEET_VIEWS.indexOf(view) !== -1 : (b.dataset.view === view);
      b.classList.toggle("is-active", active);
    });
  }

  // Aufstellung eines konkreten Spiels betreten (Feld-Ansicht direkt, Spielauswahl übersprungen).
  function tvEnterGame(eventId, readonly) {
    tv.readonly = !!readonly;
    currentView = "lineup"; tvSetNavActive("lineup");
    tvOpenGame(eventId);   // setzt tv.view="lineup", tv.eventId, dirty=false
  }

  // Klick auf "Aufstellung …" in einer Spiel-Kachel.
  function tvJumpFromCard(eventId) {
    const e = (DEMO.events || []).find(x => x.id === eventId);
    if (!e || e.typ !== "spiel" || !Roles.canManageEvents()) { if (Roles.canManageEvents()) window.alert("Spiel nicht gefunden."); return; }
    tv.origin = currentView; tv.originScroll = window.scrollY || window.pageYOffset || 0;
    try { history.pushState({ tvLineup: eventId }, "", "#lineup=" + encodeURIComponent(eventId)); } catch (er) {}
    tvEnterGame(eventId, !isFuture(e.datum));
  }

  // Aufstellung verlassen und zur Ursprungsseite (Übersicht/Kalender) samt Scrollposition zurück.
  function tvLeaveToOrigin() {
    const origin = tv.origin || "dashboard", scroll = tv.originScroll || 0;
    tv.origin = null; tv.readonly = false; tv.dirty = false; tv.eventId = null; tv.view = "games"; tv.sel = null;
    tvClosePanels();
    if (location.hash) { try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {} }
    currentView = origin; tvSetNavActive(origin);
    render();
    window.scrollTo(0, scroll);
  }

  // Zurück-Pfeil oben links.
  function tvBack() {
    if (tv.origin != null) { history.back(); return; }   // Kachel-Sprung: über History (popstate erledigt dirty + leave)
    // Nav-Einstieg: zurück zur Spielauswahl, mit Nachfrage bei ungespeicherten Änderungen.
    if (tv.dirty && !tv.readonly) {
      tvUnsavedDialog(function () { tvSavePersist().then(function () { tv.view = "games"; render(); }).catch(function (err) { window.alert("Speichern fehlgeschlagen: " + ((err && err.message) || err)); }); },
                      function () { tv.dirty = false; tvViewGames(); }, null);
    } else { tvViewGames(); }
  }

  // 3-Wege-Dialog: Speichern / Verwerfen / Abbrechen.
  function tvUnsavedDialog(onSave, onDiscard, onCancel) {
    const prev = document.getElementById("tvUnsaved"); if (prev) prev.remove();
    const ov = document.createElement("div");
    ov.className = "modal-ov"; ov.id = "tvUnsaved";
    ov.innerHTML =
      '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="tvUnsH">' +
        '<div class="modal-head"><strong id="tvUnsH">Ungespeicherte Änderungen</strong></div>' +
        '<p class="modal-sub">Möchtest du die Aufstellung speichern, bevor du zurückgehst?</p>' +
        '<div class="modal-actions modal-actions-col">' +
          '<button class="btn btn-primary" data-uns="save">Speichern</button>' +
          '<button class="btn btn-danger" data-uns="discard">Verwerfen</button>' +
          '<button class="btn" data-uns="cancel">Abbrechen</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(ov);
    ov.addEventListener("click", function (e) {
      const b = e.target.closest("[data-uns]");
      if (!b && e.target !== ov) return;           // Klick daneben im Modal-Inhalt ignorieren
      const act = b ? b.dataset.uns : "cancel";     // Klick auf Overlay = Abbrechen
      ov.remove();
      if (act === "save") { onSave && onSave(); }
      else if (act === "discard") { onDiscard && onDiscard(); }
      else { onCancel && onCancel(); }
    });
  }

  // Browser-/Hardware-Zurück aus einer per Kachel gesprungenen Aufstellung.
  window.addEventListener("popstate", function () {
    // Aufstellungs-Sprung von einer Spiel-Karte (ggf. mit ungespeicherten Änderungen).
    if (currentView === "lineup" && tv.origin != null) {
      if (tv.dirty && !tv.readonly) {
        tvUnsavedDialog(
          function () { tvSavePersist().then(function () { tvLeaveToOrigin(); }).catch(function (err) { window.alert("Speichern fehlgeschlagen: " + ((err && err.message) || err)); }); },
          function () { tvLeaveToOrigin(); },
          function () { try { history.pushState({ tvLineup: tv.eventId }, "", "#lineup=" + encodeURIComponent(tv.eventId)); } catch (e) {} }  // Abbrechen: wieder rein (kein Reload -> Änderungen bleiben)
        );
      } else { tvLeaveToOrigin(); }
      return;
    }
    // Allgemeiner Kachel-Sprung (Kalender/Strafen) -> zurück zur Übersicht mit Scrollposition.
    if (navReturn) { navReturnTo(); return; }
  });

  // Deep-Link / direkter Aufruf mit #lineup=<id> beim Start.
  function tvRouteInitialHash() {
    const m = /^#?lineup=(.+)$/.exec(location.hash || ""); if (!m) return;
    const id = decodeURIComponent(m[1]);
    const e = (DEMO && DEMO.events || []).find(x => x.id === id);
    try { history.replaceState(null, "", location.pathname + location.search); } catch (er) {}   // Hash bereinigen (Reload bleibt nicht hängen)
    if (!e || e.typ !== "spiel" || !Roles.canManageEvents()) {
      if (Roles.canManageEvents()) window.alert("Aufstellung: Spiel nicht gefunden oder nicht verfügbar.");
      return;   // bleibt auf der Standardansicht, kein Absturz
    }
    tv.origin = "dashboard"; tv.originScroll = 0;
    try { history.pushState({ tvLineup: id }, "", "#lineup=" + encodeURIComponent(id)); } catch (er) {}
    tvEnterGame(id, !isFuture(e.datum));
  }

  /* ---- Panels (persistieren in body -> flüssiges Ein-/Ausfahren) ---- */
  function tvEnsurePanels() {
    if (document.getElementById("tvPanels")) return;
    const w = document.createElement("div"); w.id = "tvPanels";
    w.innerHTML =
      '<div class="tv-scrim" id="tvScrimKader" data-tvclose="kader"></div>' +
      '<div class="tv-sheet tv-kfull" id="tvSheetKader" role="dialog" aria-modal="true" aria-label="Spieler wählen"><div class="tv-sh"><span class="tv-grip"></span><div><strong id="tvKaderTitle">Spieler wählen</strong><div class="tv-shsub" id="tvKaderSub"></div></div><button class="tv-shx" data-tvclose="kader" aria-label="Schließen">&times;</button></div><div class="tv-kaction" id="tvKaderAction"></div><div class="tv-shbody" id="tvKaderBody"></div></div>' +
      '<div class="tv-scrim" id="tvScrimForm" data-tvclose="form"></div>' +
      '<div class="tv-sheet" id="tvSheetForm" role="dialog" aria-modal="true" aria-label="Formationen"><div class="tv-sh"><span class="tv-grip"></span><div><strong id="tvFormTitle">Formation wechseln</strong><div class="tv-shsub" id="tvFormSub"></div></div><button class="tv-shx" data-tvclose="form" aria-label="Schließen">&times;</button></div><div class="tv-shbody"><div class="tv-fgrid" id="tvFgrid"></div></div><div class="tv-shactions" id="tvFormActions"></div></div>' +
      '<div class="tv-scrim" id="tvScrimMenu" data-tvclose="menu"></div>' +
      '<div class="tv-sheet" id="tvSheetMenu" role="dialog" aria-modal="true" aria-label="Mehr"><div class="tv-sh"><span class="tv-grip"></span><div><strong>Mehr</strong></div><button class="tv-shx" data-tvclose="menu" aria-label="Schließen">&times;</button></div><div class="tv-shbody" id="tvMenuBody"></div></div>' +
      '<div class="tv-toast" id="tvToast"></div>';
    document.body.appendChild(w);
    w.addEventListener("click", tvPanelClick);

    // Kader-Vollbild: Wisch-nach-unten zum Schließen (nur wenn Liste oben steht).
    var panel = document.getElementById("tvSheetKader");
    var body  = document.getElementById("tvKaderBody");
    var sy = 0, dragging = false, dy = 0;
    panel.addEventListener("touchstart", function (e) {
      if (!panel.classList.contains("open") || e.touches.length !== 1 || body.scrollTop > 0) { dragging = false; return; }
      sy = e.touches[0].clientY; dy = 0; dragging = true; panel.style.transition = "none";
    }, { passive: true });
    panel.addEventListener("touchmove", function (e) {
      if (!dragging) return;
      dy = e.touches[0].clientY - sy;
      if (dy <= 0 || body.scrollTop > 0) { panel.style.transform = "translateY(0)"; return; }
      e.preventDefault();
      panel.style.transform = "translateY(" + dy + "px)";
    }, { passive: false });
    panel.addEventListener("touchend", function () {
      if (!dragging) return;
      dragging = false; panel.style.transition = ""; panel.style.transform = "";
      if (dy > 90) { tvCloseKader(); tvViewLineup(); }
    }, { passive: true });
  }
  function tvTeardownPanels() { const w = document.getElementById("tvPanels"); if (w && w.parentNode) w.parentNode.removeChild(w); }
  function tvClosePanels() { ["tvScrimKader","tvSheetKader","tvScrimForm","tvSheetForm","tvScrimMenu","tvSheetMenu"].forEach(id => { const e = document.getElementById(id); if (e) e.classList.remove("open"); }); }

  /* C2: Tauschen per Tap.
     Erster Tap auf eine BESETZTE Position markiert sie (goldener Ring).
     Zweiter Tap auf eine besetzte Position tauscht beide, auf eine leere
     verschiebt er den Spieler dorthin. Tap auf die markierte Position selbst
     hebt die Markierung auf. Ohne Markierung oeffnet eine leere Position wie
     bisher das Kader-Vollbild. Bankplaetze spielen mit: ein markierter
     Feldspieler und ein Bankplatz tauschen ebenso. */
  function tvSlotTap(key) {
    const belegt = !!tv.assign[key];
    const m = tv.mark;

    if (m && m.art === "feld" && m.key === key) { tv.mark = null; tvViewLineup(); return; }

    if (m) {
      if (m.art === "feld") {
        const a = tv.assign[m.key], b = tv.assign[key];
        if (b) tv.assign[m.key] = b; else delete tv.assign[m.key];
        if (a) tv.assign[key] = a; else delete tv.assign[key];
      } else {                                   // Bankplatz <-> Feldposition
        const bankId = tv.bank[m.idx], feldId = tv.assign[key];
        if (feldId) tv.bank[m.idx] = feldId; else tv.bank.splice(m.idx, 1);
        if (bankId) tv.assign[key] = bankId; else delete tv.assign[key];
      }
      tv.mark = null; tv.dirty = true; tvViewLineup();
      return;
    }

    if (belegt) { tv.mark = { art: "feld", key: key }; tvViewLineup(); return; }
    tvOpenKader(key);                            // leer und nichts markiert
  }

  // Tap auf einen besetzten Bankplatz: markieren bzw. mit der Markierung tauschen.
  function tvBankTap(idx) {
    const m = tv.mark;
    if (m && m.art === "bank" && m.idx === idx) { tv.mark = null; tvViewLineup(); return; }
    if (m && m.art === "feld") {
      const feldId = tv.assign[m.key], bankId = tv.bank[idx];
      if (bankId) tv.assign[m.key] = bankId; else delete tv.assign[m.key];
      tv.bank[idx] = feldId;
      tv.mark = null; tv.dirty = true; tvViewLineup();
      return;
    }
    tv.mark = { art: "bank", idx: idx }; tvViewLineup();
  }

  function tvOpenKader(key) {
    tv.sel = { key: key }; tvViewLineup();
    const slot = FORMATIONS[tv.formation].find(s => s.key === key);
    document.getElementById("tvKaderTitle").textContent = "Spieler für " + (slot ? slot.role : "Position");
    document.getElementById("tvKaderSub").textContent = tv.assign[key] ? "Ersetzen oder Position leeren" : "Passenden Spieler antippen";
    document.getElementById("tvKaderAction").innerHTML = "";   // Sammel-Button nur im Bank-Modus
    tvRenderKaderBody(key);
    document.getElementById("tvScrimKader").classList.add("open");
    document.getElementById("tvSheetKader").classList.add("open");
    const grp = slot ? lbTeamPart(slot.role) : null;
    if (grp) { const el = document.querySelector('#tvKaderBody [data-tvgrp="' + grp + '"]'); if (el) el.scrollIntoView({ block: "start" }); }
  }
  // Kader-Auswahl fuer die BANK: alle Spieler, keine Positions-Vorfilterung.
  function tvOpenBank() {
    if (tv.bank.length >= TV_BANK_MAX) { tvToast("Bank ist voll (" + TV_BANK_MAX + ")"); return; }
    tv.sel = { bank: true }; tvViewLineup();
    document.getElementById("tvKaderTitle").textContent = "Spieler für die Bank";
    document.getElementById("tvKaderSub").textContent = "Ersatzspieler antippen (" + tv.bank.length + "/" + TV_BANK_MAX + ")";
    tvRenderKaderAction();
    tvRenderKaderBody(null);
    document.getElementById("tvScrimKader").classList.add("open");
    document.getElementById("tvSheetKader").classList.add("open");
  }
  // Sammel-Button „Alle Zugesagten auf die Bank" (nur Bank-Modus, fest über der Liste).
  function tvBankCandidates() {
    const placed = tvPlacedAll();
    const list = [];
    LB_GROUPS.forEach(([gk]) => {
      DEMO.players.filter(p => lbTeamPart(p.pos) === gk && tvAvail(p) === null && !placed.has(p.id))
        .sort(byName).forEach(p => list.push(p));   // zugesagt+fit, nicht vergeben; nach Mannschaftsteil
    });
    return list;
  }
  function tvRenderKaderAction() {
    const el = document.getElementById("tvKaderAction"); if (!el) return;
    const free = TV_BANK_MAX - tv.bank.length;
    const cand = tvBankCandidates();
    const n = Math.min(free, cand.length);
    const disabled = free <= 0 || cand.length === 0;
    const reason = free <= 0 ? "Bank ist voll" : (cand.length === 0 ? "Keine zugesagten Spieler frei" : "");
    el.innerHTML = '<button class="tv-kall" data-tvbankall' + (disabled ? " disabled" : "") + '>Alle Zugesagten auf die Bank' + (n > 0 ? " (" + n + ")" : "") + '</button>' +
      (disabled ? '<div class="tv-kall-reason">' + reason + '</div>' : '');
  }
  function tvBankFillAll() {
    const free = TV_BANK_MAX - tv.bank.length; if (free <= 0) return;
    const take = tvBankCandidates().slice(0, free);
    if (!take.length) { tvToast("Keine zugesagten Spieler zum Setzen"); return; }
    const left = tvBankCandidates().length - take.length;
    take.forEach(p => tv.bank.push(p.id)); tv.dirty = true;
    tvCloseKader(); tvViewLineup();
    tvToast(left > 0 ? (take.length + " gesetzt · " + left + " passten nicht mehr") : (take.length + " Zugesagte auf die Bank"));
  }
  function tvCloseKader() { tv.sel = null; const s = document.getElementById("tvScrimKader"), p = document.getElementById("tvSheetKader"); if (s) s.classList.remove("open"); if (p) p.classList.remove("open"); }
  function tvRenderKaderBody(key) {
    const body = document.getElementById("tvKaderBody"); if (!body) return;
    const placed = tvPlacedAll();                                      // Startelf UND Bank = vergeben
    const slot = key ? FORMATIONS[tv.formation].find(s => s.key === key) : null;
    let h = "";
    if (key && tv.assign[key]) h += '<button class="tv-emptybtn" data-tvempty>Position „' + (slot ? slot.role : "") + '" leeren</button>';
    if (!DEMO.players.length) { body.innerHTML = h + '<div class="empty">Kein Kader vorhanden.</div>'; return; }
    LB_GROUPS.forEach(([gk, label]) => {
      const list = DEMO.players.filter(p => lbTeamPart(p.pos) === gk).sort((a, b) => ((tvAvail(a) || { rank: 0 }).rank - (tvAvail(b) || { rank: 0 }).rank) || byName(a, b));
      if (!list.length) return;
      h += '<div class="tv-kg" data-tvgrp="' + gk + '"><h4>' + label + ' <span>' + list.length + '</span></h4><div class="tv-kl">';
      list.forEach(p => {
        const isPl = placed.has(p.id), av = tvAvail(p), tap = !isPl;
        // Dezente Status-Zeilenfarbe. Farbe ist nie die einzige Info -> Badge bleibt.
        const scls = av ? (av.rank === 4 ? " s-verl" : av.rank === 3 ? " s-abw" : av.rank === 2 ? " s-none" : " s-ang") : " s-zu";
        const tag = isPl ? '<span class="tv-tag placed">vergeben</span>' : (av ? '<span class="tv-tag ' + av.cls + '">' + av.label + '</span>' : '<span class="tv-tag ok">verfügbar</span>');
        h += '<div class="tv-pchip' + scls + (isPl ? " placed" : "") + '"' + (tap ? ' data-tvplayer="' + p.id + '"' : "") + '>' +
          '<span class="tv-pnr">' + (p.nr != null ? p.nr : "–") + '</span><span class="tv-pw"><span class="tv-pnm">' + esc(p.name) + '</span><span class="tv-pmeta">' + esc(p.pos || "") + '</span></span>' + tag + '</div>';
      });
      h += '</div></div>';
    });
    body.innerHTML = h;
  }

  function tvOpenForm(edit) {
    tvFavMode = !!edit;
    document.getElementById("tvFormTitle").textContent = tvFavMode ? "Favoriten bearbeiten" : "Formation wechseln";
    document.getElementById("tvFormSub").textContent = tvFavMode ? "2 bis 4 markieren" : "Tippen zum Wechseln · Stern = Favorit";
    tvRenderFgrid(); tvRenderFormActions();
    document.getElementById("tvScrimForm").classList.add("open");
    document.getElementById("tvSheetForm").classList.add("open");
  }
  function tvCloseForm() { const s = document.getElementById("tvScrimForm"), p = document.getElementById("tvSheetForm"); if (s) s.classList.remove("open"); if (p) p.classList.remove("open"); }
  function tvRenderFgrid() {
    document.getElementById("tvFgrid").innerHTML = Object.keys(FORMATIONS).map(f => {
      const fav = tvFav.includes(f), on = (!tvFavMode && f === tv.formation) || (tvFavMode && fav);
      return '<div class="tv-fcard' + (on ? " on" : "") + '" data-tvfcard="' + f + '"><button class="tv-star' + (fav ? " fav" : "") + '" data-tvstar="' + f + '" aria-label="Favorit">' + (fav ? "★" : "☆") + '</button>' + tvMini(f) + '<span class="tv-fn">' + f + '</span></div>';
    }).join("");
  }
  function tvRenderFormActions() {
    document.getElementById("tvFormActions").innerHTML = tvFavMode
      ? '<button class="btn btn-primary" data-tvfavdone>Fertig (' + tvFav.length + '/4)</button>'
      : '<button class="btn" data-tvfavedit>Favoriten bearbeiten</button>';
  }
  function tvToggleFav(f) { const i = tvFav.indexOf(f); if (i >= 0) { if (tvFav.length > 2) tvFav.splice(i, 1); } else if (tvFav.length < 4) tvFav.push(f); tvSaveFav(); }

  function tvOpenMenu() {
    const tpl = (DEMO.lineups || []).filter(l => l.isTemplate);
    document.getElementById("tvMenuBody").innerHTML =
      '<button class="tv-mi" data-tvadopt>Vom letzten Spiel übernehmen &amp; anpassen</button>' +
      '<button class="tv-mi" data-tvtplsave>Als Vorlage speichern</button>' +
      (tpl.length ? '<div class="tv-mgroup">Vorlage anwenden</div>' + tpl.map(l =>
        '<button class="tv-mi tv-mi-sub" data-tvtplapply="' + l.id + '">' + esc(l.name) +
        '<small>' + esc(l.formation) + '</small></button>').join("") : "") +
      '<button class="tv-mi" data-tvfavedit>Favoriten bearbeiten</button>' +
      '<button class="tv-mi danger" data-tvclear>Aufstellung leeren</button>';
    document.getElementById("tvScrimMenu").classList.add("open");
    document.getElementById("tvSheetMenu").classList.add("open");
  }
  function tvCloseMenu() { const s = document.getElementById("tvScrimMenu"), p = document.getElementById("tvSheetMenu"); if (s) s.classList.remove("open"); if (p) p.classList.remove("open"); }

  let tvToastT = 0;
  function tvToast(msg) { const t = document.getElementById("tvToast"); if (!t) return; t.textContent = msg; t.classList.add("show"); clearTimeout(tvToastT); tvToastT = setTimeout(() => t.classList.remove("show"), 2000); }

  function tvPanelClick(ev) {
    const t = ev.target;
    const cl = t.closest("[data-tvclose]"); if (cl) { const w = cl.dataset.tvclose; if (w === "kader") { tvCloseKader(); tvViewLineup(); } else if (w === "form") tvCloseForm(); else tvCloseMenu(); return; }
    if (t.closest("[data-tvempty]")) { if (tv.sel) { delete tv.assign[tv.sel.key]; tv.dirty = true; } tvCloseKader(); tvViewLineup(); return; }
    if (t.closest("[data-tvbankall]")) { tvBankFillAll(); return; }
    const pl = t.closest("[data-tvplayer]"); if (pl) { if (tv.sel && tv.sel.bank) tvAddBank(pl.dataset.tvplayer); else if (tv.sel) tvAssign(tv.sel.key, pl.dataset.tvplayer); tvCloseKader(); tvViewLineup(); return; }
    const star = t.closest("[data-tvstar]"); if (star) { ev.stopPropagation(); tvToggleFav(star.dataset.tvstar); tvRenderFgrid(); tvRenderFormActions(); return; }
    const fc = t.closest("[data-tvfcard]"); if (fc) { const f = fc.dataset.tvfcard; if (tvFavMode) { tvToggleFav(f); tvRenderFgrid(); tvRenderFormActions(); } else { tvSwitchFormation(f); tvCloseForm(); tvViewLineup(); } return; }
    if (t.closest("[data-tvfavdone]")) { if (tvFav.length < 2) return; if (!tvFav.includes(tv.formation)) tv.formation = tvFav[0]; tvCloseForm(); tvViewLineup(); return; }
    if (t.closest("[data-tvfavedit]")) { tvCloseMenu(); tvOpenForm(true); return; }
    if (t.closest("[data-tvadopt]")) { tvCloseMenu(); tvAdopt(); return; }
    if (t.closest("[data-tvtplsave]")) { tvCloseMenu(); tvSaveTemplate(); return; }
    const ta = t.closest("[data-tvtplapply]"); if (ta) { tvApplyTemplate(ta.dataset.tvtplapply); return; }
    if (t.closest("[data-tvclear]")) { tvCloseMenu(); tv.assign = {}; tv.sel = null; tv.dirty = true; tvViewLineup(); return; }
  }
  function tvViewClick(ev) {
    const t = ev.target;
    if (t.closest("[data-tvallgames]")) { tv.alleSpiele = !tv.alleSpiele; tvViewGames(); return true; }
    const td = t.closest("[data-tvtpldel]"); if (td) { tvDeleteTemplate(td.dataset.tvtpldel); return true; }
    // „Neu" bei den Vorlagen: eine Vorlage entsteht nur aus einer offenen
    // Aufstellung, also geht es in die Platzansicht des naechsten Spiels.
    const tn = t.closest("[data-tvtplnew]");
    if (tn) { tvOpenGame(tn.dataset.tvtplnew); tvToast("Elf bauen, dann im Menü ⋯ als Vorlage speichern"); return true; }
    const g = t.closest("[data-tvgame]"); if (g) { tvOpenGame(g.dataset.tvgame); return true; }
    if (t.closest("[data-tvback]")) { tvBack(); return true; }
    if (tv.readonly) return true;   // vergangenes Spiel: nur ansehen, keine Bearbeitung
    if (t.closest("[data-tvmenu]")) { tvOpenMenu(); return true; }
    if (t.closest("[data-tvsave]")) { tvSave(); return true; }
    const sl = t.closest("[data-tvslot]"); if (sl) { tvSlotTap(sl.dataset.tvslot); return true; }
    if (t.closest("[data-tvbankadd]")) { tvOpenBank(); return true; }
    // Das Kreuz liegt IM Bankplatz - es muss vor dem Tausch geprueft werden.
    const bd = t.closest("[data-tvbankdel]"); if (bd) { tvBankDel(bd.dataset.tvbankdel); tv.mark = null; tvViewLineup(); return true; }
    const bt = t.closest("[data-tvbanktap]"); if (bt) { tvBankTap(Number(bt.dataset.tvbanktap)); return true; }
    const fp = t.closest("[data-tvform]"); if (fp) { tvSwitchFormation(fp.dataset.tvform); tvViewLineup(); return true; }
    if (t.closest("[data-tvmoreform]")) { tvOpenForm(false); return true; }
    if (t.closest("[data-tvadopt]")) { tvAdopt(); return true; }
    if (t.closest("[data-tvfresh]")) { tv.hideCta = true; tvViewLineup(); return true; }
    return false;
  }

  /* ---------- Strafenkatalog ------------------------------------------------ */
  const SVG = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
  const ICON_EDIT  = `<svg ${SVG}><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>`;
  const ICON_TRASH = `<svg ${SVG}><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"/></svg>`;
  const ICON_CHECK = `<svg ${SVG}><path d="M20 6 9 17l-5-5"/></svg>`;
  const ICON_X     = `<svg ${SVG}><path d="M18 6 6 18M6 6l12 12"/></svg>`;
  const ICON_PLUS  = `<svg ${SVG}><path d="M12 5v14M5 12h14"/></svg>`;

  let katEdit = null; // null | Katalog-id (Bearbeiten) | "new" (Hinzufügen)

  function katRowView(k, canEdit) {
    // Vorlage 3b: Bezeichnung links, darunter die Kategorie (K5) und bei
    // Staffelstrafen der Deckel in derselben Zeile; Betrag rechts.
    const staffel = k.typ === "staffel";
    const amt = staffel
      ? `${euro(k.proEinheit || 0).replace(/\s/g, " ")} / ${k.schritt || 1} ${esc(k.einheit || "")}`
      : euro(k.betrag).replace(/\s/g, " ");
    // K5 endgueltig: keine Kategorie in der Anzeige. Die Spalte bleibt in der
    // Datenbank, wird aber weder gelesen noch geschrieben. Als Unterzeile steht
    // nur der Deckel einer Staffelstrafe.
    const unten = (staffel && k.maxBetrag != null)
      ? "max " + euro(k.maxBetrag).replace(/\s/g, " ") : "";
    return `<div class="kat-item">
      <span class="kat-name">${esc(k.vergehen)}${staffel ? ` <span class="badge badge-self">gestaffelt</span>` : ""}${unten ? `<span class="kat-sub">${unten}</span>` : ""}</span>
      <span class="kat-amount${staffel ? " is-staffel" : ""}">${amt}</span>
      ${canEdit ? `<div class="kat-actions">
        <button class="icon-btn" data-kat-edit="${k.id}" aria-label="Bearbeiten">${ICON_EDIT}</button>
        <button class="icon-btn" data-kat-del="${k.id}" aria-label="Löschen">${ICON_TRASH}</button>
      </div>` : ""}
    </div>`;
  }
  function katRowEdit(k) {
    const id = k ? k.id : "new";
    const isStaffel = !!(k && k.typ === "staffel");
    const nm = (n) => (n == null ? "" : String(n).replace(".", ","));
    return `<div class="kat-item kat-edit${isStaffel ? " is-staffel" : ""}">
      <input class="kat-in kat-in-name" data-kat-input="name" type="text" placeholder="Bezeichnung" value="${esc(k ? k.vergehen : "")}">
      <select class="kat-in kat-type" data-kat-type>
        <option value="fixed"${!isStaffel ? " selected" : ""}>Festbetrag</option>
        <option value="staffel"${isStaffel ? " selected" : ""}>Gestaffelt</option>
      </select>
      <div class="kat-fixed">
        <input class="kat-in kat-in-amount" data-kat-input="amount" type="text" inputmode="decimal" placeholder="Betrag" value="${esc(isStaffel ? "" : nm(k ? k.betrag : null))}">
        <span class="kat-eur">€</span>
      </div>
      <div class="kat-staffel">
        <input class="kat-in" data-kat-input="proEinheit" inputmode="decimal" placeholder="Betrag je Schritt (€)" value="${esc(nm(k ? k.proEinheit : null))}">
        <input class="kat-in" data-kat-input="schritt" inputmode="numeric" placeholder="je angefangene … (z. B. 5)" value="${esc(k && k.schritt != null ? String(k.schritt) : "")}">
        <input class="kat-in" data-kat-input="einheit" type="text" placeholder="Einheit (z. B. Minuten)" value="${esc(k ? (k.einheit || "") : "")}">
        <input class="kat-in" data-kat-input="maxBetrag" inputmode="decimal" placeholder="Höchstbetrag € (optional)" value="${esc(nm(k ? k.maxBetrag : null))}">
      </div>
      <div class="kat-edit-actions">
        <button class="icon-btn icon-ok" data-kat-save="${id}" aria-label="Speichern">${ICON_CHECK}</button>
        <button class="icon-btn" data-kat-cancel aria-label="Abbrechen">${ICON_X}</button>
      </div>
    </div>`;
  }
  function renderKatalog() {
    const canEdit = Roles.canEditCatalog();
    viewEl.innerHTML = `
      <div class="page-head"><h1>Strafenkatalog</h1>
        <p>Beträge gelten für die ganze Mannschaft. Änderungen wirken ab sofort.</p></div>
      <div class="kat-list">
        ${DEMO.katalog.map((k) => katEdit === k.id
          ? katRowEdit(k)
          : katRowView(k, canEdit)).join("")}
        ${katEdit === "new" ? katRowEdit(null) : ""}
      </div>
      ${canEdit && katEdit !== "new" ? `<button class="kat-add" data-kat-add>${ICON_PLUS}<span>Strafe hinzufügen</span></button>` : ""}
    `;
    const nameInput = viewEl.querySelector(".kat-in-name");
    if (nameInput) nameInput.focus();
  }

  /* ---------- Strafen-Konto ------------------------------------------------- */
  let strafenFilter = "offen"; // offen | bezahlt | alle | meine

  /* Kontoblock „Dein Konto" – gemeinsam von der Konto-Ansicht und der Übersicht
     genutzt. Rechnet sich selbst aus den geladenen Strafen aus, damit beide Orte
     zwingend dieselbe Zahl zeigen und nicht auseinanderlaufen koennen. */
  function kontoBlockHtml() {
    const me = playerById[state.currentPlayerId];
    const linked = !!(currentProfile && currentProfile.player_id && me);
    if (!linked) {
      return `<div class="mine-banner">
        <div class="mb-top">
          <span class="mb-label">Dein Konto</span>
          <span class="mb-state">Noch keinem Spieler zugeordnet</span>
        </div>
        <div class="mb-note">Bitte einen Trainer/Admin um die Zuordnung – danach siehst du hier deine Strafen.</div>
      </div>`;
    }
    const meine = aktiveStrafen().filter((s) => s.playerId === me.id);
    const meineOffen    = summeOffenSpieler(me.id);
    const meineGesamt   = meine.reduce((a, s) => a + strafeBetrag(s), 0);
    const meineGemeldet = meine.filter((s) => fineStatus(s) === "gemeldet").length;
    const meinZuschlag  = meine.filter((s) => fineStatus(s) === "offen").reduce((a, s) => a + zuschlagBetrag(s), 0);
    // Offene Strafe mit der kuerzesten Restzeit (nicht gedeckelt) treibt den Countdown.
    let bannerCd = null;
    const jetzt = Date.now();
    meine.filter((s) => fineStatus(s) === "offen").forEach((s) => {
      const info = mahnCountdown(s, jetzt);
      if (info.capped) return;
      if (bannerCd === null || info.remMs < bannerCd.remMs) bannerCd = { remMs: info.remMs, createdAt: s.createdAt };
    });

    // Fortschritt: welcher Anteil der eigenen Strafen ist schon erledigt?
    const anteil = meineGesamt > 0 ? Math.round(((meineGesamt - meineOffen) / meineGesamt) * 100) : 100;

    return `<div class="mine-banner${meineOffen > 0 ? "" : " is-clear"}">
        <div class="mb-label">Dein Konto · ${esc(me.name)}</div>
        <div class="mb-value">${euro(meineOffen)}</div>
        <div class="mb-sub">${meineOffen > 0
          ? `offen von ${euro(meineGesamt)} · ${meine.length} ${meine.length === 1 ? "Strafe" : "Strafen"}`
          : meineGemeldet > 0 ? "Zahlung gemeldet – wartet auf Bestätigung" : "Du bist schuldenfrei"}</div>
        <div class="mb-bar" role="img" aria-label="${anteil}% erledigt"><i style="width:${anteil}%"></i></div>
        ${meinZuschlag > 0 ? `<div class="mb-note">inkl. ${euro(meinZuschlag)} Mahnzuschlag</div>` : ""}
        ${meineOffen > 0 ? `
          <a class="btn btn-primary mb-pay" href="${paypalMeLink(meineOffen)}" target="_blank" rel="noopener noreferrer">${euro(meineOffen)} jetzt bezahlen</a>
          <div class="mb-pp"><span class="rs">über</span><span class="pp-word"><span class="pp1">Pay</span><span class="pp2">Pal</span></span><span class="rs">· Freunde &amp; Familie</span></div>
          <div class="mb-foot">
            <button class="link-btn" data-paid-self>Zahlung melden</button>
            ${bannerCd ? `<span class="mb-cd">Erhöhung in <span class="cd" data-cd-created="${bannerCd.createdAt}" data-cd-step="${faelligeStufen({ createdAt: bannerCd.createdAt }, Date.now())}"></span></span>` : ""}
          </div>` : ""}
        ${meineGemeldet > 0 ? `<div class="mb-note">${meineGemeldet} ${meineGemeldet === 1 ? "Strafe gemeldet" : "Strafen gemeldet"} · Kassenwart bestätigt den Eingang</div>` : ""}
      </div>`;
  }

  function renderStrafen() {
    const me = playerById[state.currentPlayerId];
    // Ist das eingeloggte Konto wirklich mit einem Spieler verknüpft?
    // Nur dann zeigen wir „Dein Konto" + die Bezahl-/Selbstmeldungs-Buttons –
    // sonst würde ein Fallback-Spieler fälschlich als „du" erscheinen.
    const linked = !!(currentProfile && currentProfile.player_id && me);
    // „Als bezahlt" nur für Kassenwart/Admin (UI-Komfort; echte Sperre = RLS)
    const canPay = Roles.canManageFines();

    const alle = aktiveStrafen().map((s) => ({
      ...s,
      betrag: strafeBetrag(s),
      bezahlt: istBezahlt(s),
      st: fineStatus(s),
      player: playerById[s.playerId],
      kat: katById[s.katalogId],
    }));

    const offenGesamt   = alle.filter((s) => s.st === "offen").reduce((a, s) => a + s.betrag, 0);
    const bezahltGesamt = alle.filter((s) => s.st === "bestätigt").reduce((a, s) => a + s.betrag, 0);

    let gefiltert = alle;
    if (strafenFilter === "offen")    gefiltert = alle.filter((s) => s.st === "offen");
    if (strafenFilter === "gemeldet") gefiltert = alle.filter((s) => s.st === "gemeldet");
    if (strafenFilter === "bezahlt")  gefiltert = alle.filter((s) => s.st === "bestätigt");
    if (strafenFilter === "meine")    gefiltert = linked ? alle.filter((s) => s.playerId === me.id) : [];
    const stRank = { offen: 0, gemeldet: 1, "bestätigt": 2 };
    gefiltert.sort((a, b) => (stRank[a.st] - stRank[b.st]) || b.datum.localeCompare(a.datum));

    const filters = [
      { k: "offen",    label: "Offen" },
      { k: "gemeldet", label: "Gemeldet" },
      { k: "bezahlt",  label: "Eingegangen" },
      { k: "meine",    label: "Meine" },   // kurz, damit die Reihe in eine Zeile passt
      { k: "alle",     label: "Alle" },
    ];

    /* --- Daten für die Diagramme ------------------------------------------ */
    // Diagramme entfernt (Entscheidung): Konto zeigt nur Kontostand, Summe offen und die Liste.
    viewEl.innerHTML = `
      <div class="page-head">
        ${navBackChevronHtml()}<h1>Strafen-Konto</h1>
      </div>

      ${kontoBlockHtml()}

      <div class="kpi-grid">
        <div class="kpi is-warn">
          <div class="kpi-label">Summe offen</div>
          <div class="kpi-value kpi-amt">${euro(offenGesamt).replace(/\s/g, " ")}</div>
          <div class="kpi-sub">${alle.filter((s)=>s.st==="offen").length} offene Strafen</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">Kontostand</div>
          <div class="kpi-value kpi-amt">${euro(offenGesamt + bezahltGesamt).replace(/\s/g, " ")}</div>
          <div class="kpi-sub">Gesamtvolumen Saison</div>
        </div>
      </div>

      <div class="chips" style="margin-bottom:12px">
        ${filters.map((f) => `<button class="chip ${strafenFilter === f.k ? "is-active" : ""}" data-sfilter="${f.k}">${f.label}</button>`).join("")}
      </div>

      ${gefiltert.length ? `
      <div class="fine-list">
        ${gefiltert.map((s) => `
          <div class="fine-row">
            <span class="avatar">${initials(s.player.name)}</span>
            <div class="fine-main">
              <div class="fine-name">${esc(s.player.name)}</div>
              <div class="fine-desc">${esc(vergehenName(s))} · ${fmtDay(s.datum)}. ${fmtMon(s.datum)}${s.auto ? " · automatisch" : ""}</div>
              ${s.st === "offen" && s.ablehnGrund ? `<div class="fine-reason">Abgelehnt: ${esc(s.ablehnGrund)}</div>` : ""}
            </div>
            <div class="fine-right">
              <div class="fine-amt${s.st === "offen" ? " is-warn" : ""}">${euro(s.betrag).replace(/\s/g, " ")}</div>
              ${statusBadgeHtml(s)}
            </div>
          </div>`).join("")}
      </div>` : `<div class="empty">Keine Strafen in dieser Auswahl.</div>`}
    `;

    startCountdowns(); // Live-Timer für alle Countdown-Felder dieser Ansicht
  }

  /* =========================================================================
     KASSE (nur Kassenwart/Admin). View-Guard ist Komfort; die echte Sperre
     ist RLS: fines/fine_catalog SCHREIBEN nur treasurer/admin.
     ========================================================================= */
  // Mehrfachauswahl: mehrere Spieler × mehrere Strafen (Katalog mit Menge + freie Einträge).
  //   items:  { catId -> { menge } }   (Festbetrag: Menge = Anzahl; multipliziert den Betrag)
  //   bezug:  { catId -> "n" }         (Staffel: Bezugsgröße, z. B. Minuten/Gramm)
  //   indiv:  [ { betrag, grund } ]    (bereits hinzugefügte freie Strafen)
  const kasse = {
    players: [], items: {}, bezug: {}, indiv: [],
    indivBetrag: "", indivGrund: "",
    date: new Date().toISOString().slice(0, 10), comment: "",
    tab: "pruefen", bezFilter: "",
    pruefIdx: 0,       // welche Meldung im Kartenstapel gerade vorn liegt
    zahlart: {},       // gewaehlte Zahlart je Strafe (B3), Vorgabe "bar"
    formOpen: false,   // „Strafe verhaengen" ist eingeklappt, bis jemand es oeffnet
  };

  // Baut die Strafzeilen (je Zeile = eine Strafe pro gewähltem Spieler).
  function kasseBuild() {
    const lines = [];
    let incomplete = false;
    DEMO.katalog.forEach((k) => {
      if (!kasse.items[k.id]) return;
      if (k.typ === "staffel") {
        const n = parseFloat(String(kasse.bezug[k.id] || "").replace(",", "."));
        if (!isFinite(n) || n <= 0) { incomplete = true; return; }
        const step = Math.max(1, k.schritt || 1);
        let betrag = Math.ceil(n / step) * (k.proEinheit || 0);
        if (k.maxBetrag != null) betrag = Math.min(betrag, k.maxBetrag);
        lines.push({ catId: k.id, offense: k.vergehen + " (" + n + " " + (k.einheit || "") + ")", betrag: betrag });
      } else {
        const menge = Math.max(1, parseInt(kasse.items[k.id].menge, 10) || 1);
        lines.push({ catId: k.id, offense: menge > 1 ? k.vergehen + " ×" + menge : k.vergehen, betrag: k.betrag * menge });
      }
    });
    kasse.indiv.forEach((e) => {
      const b = parseFloat(String(e.betrag).replace(",", "."));
      if (!isFinite(b) || b < 0 || !String(e.grund).trim()) return;
      lines.push({ catId: null, offense: String(e.grund).trim(), betrag: b });
    });
    const nSp = kasse.players.length;
    const proSpieler = lines.reduce((a, l) => a + l.betrag, 0);
    return {
      lines: lines, incomplete: incomplete,
      valid: nSp > 0 && lines.length > 0 && !incomplete,
      entries: nSp * lines.length, total: nSp * proSpieler, proSpieler: proSpieler,
    };
  }

  function kasseSummaryHtml() {
    const b = kasseBuild();
    const nSp = kasse.players.length;
    if (!nSp) return `<div class="kasse-sum-empty">Erst Spieler auswählen.</div>`;
    if (!b.lines.length && !b.incomplete) return `<div class="kasse-sum-empty">${nSp} Spieler · Strafe(n) auswählen</div>`;
    if (b.incomplete) return `<div class="kasse-sum-empty">${nSp} Spieler · Bezugsgröße bei gestaffelten Strafen eingeben</div>`;
    return `<div class="kasse-sum">
        <div class="kasse-sum-row"><span>Vorgang</span><b>${nSp} Spieler × ${b.lines.length} ${b.lines.length === 1 ? "Strafe" : "Strafen"} = ${b.entries} ${b.entries === 1 ? "Eintrag" : "Einträge"}</b></div>
        <div class="kasse-sum-row"><span>Betrag je Spieler</span><b>${euro(b.proSpieler).replace(/\s/g, " ")}</b></div>
        <div class="kasse-sum-row"><span>Datum</span><b>${fmtLong(kasse.date)}</b></div>
        ${kasse.comment.trim() ? `<div class="kasse-sum-row"><span>Kommentar</span><b>${esc(kasse.comment.trim())}</b></div>` : ""}
        <div class="kasse-sum-row kasse-sum-total"><span>Summe gesamt</span><b>${euro(b.total).replace(/\s/g, " ")}</b></div>
      </div>`;
  }

  // Audit-Verlauf einer Strafe: aufklappbar, wird beim Öffnen einmalig geladen.
  function kasseHistHtml(id) {
    return `<div class="fine-hist"><button type="button" class="linklike" data-kasse-hist="${id}">Verlauf ▾</button>
      <div class="fine-hist-body" id="hist-${id}" hidden></div></div>`;
  }
  function histLineHtml(h) {
    const lab = (st) => (STATUS_META[st] && STATUS_META[st].label) || st || "neu";
    const arrow = (h.from ? lab(h.from) : "angelegt") + " → " + lab(h.to);
    const extra = [h.method ? (ZAHLART_LABEL[h.method] || h.method) : "", h.reason ? ("Grund: " + h.reason) : ""].filter(Boolean).join(" · ");
    return `<div class="hist-line">${fmtTs(h.at)} · ${esc(arrow)}${extra ? " · " + esc(extra) : ""}</div>`;
  }

  // Eine Karte im Prüf-/Verbuch-Bereich – in allen drei Tabs identisch aufgebaut:
  //   oben: Spieler + Strafe · rechts: Betrag rechtsbündig
  //   darunter: Datum + Status(-Badge)
  //   unten: Aktionsbuttons in einer Reihe · optional Audit-Verlauf
  // strafeText/metaText/actions sind bereits fertiges HTML.
  function krowHtml(s, strafeText, metaText, actions) {
    // Aufbau wie die Strafenzeile im Konto: Avatar, Name, Vergehen mit Datum,
    // rechts Betrag ueber Zustandsmarke. Aktionen darunter.
    return `<div class="krow">
      <div class="krow-head">
        <span class="avatar">${initials(s.player.name)}</span>
        <div class="krow-info">
          <div class="krow-title">${esc(s.player.name)}</div>
          <div class="krow-strafe">${strafeText}${metaText ? " · " + metaText : ""}</div>
          ${s.ablehnGrund && s.st === "offen" ? `<div class="fine-reason">Abgelehnt: ${esc(s.ablehnGrund)}</div>` : ""}
        </div>
        <div class="krow-right">
          <div class="krow-amt">${euro(s.betrag).replace(/\s/g, " ")}</div>
          ${statusBadgeHtml(s)}
        </div>
      </div>
      ${actions ? `<div class="krow-actions">${actions}</div>` : ""}
      ${kasseHistHtml(s.id)}
    </div>`;
  }

  /* „Prüfen & verbuchen" als Kartenstapel (Vorlage 3c): immer genau EINE
     Meldung im Blick, dahinter zwei Geisterkarten als Stapeltiefe. Nach jeder
     Entscheidung wird die Liste kuerzer, der Index bleibt stehen - dadurch
     rueckt die naechste Meldung von selbst nach. */
  function renderKassePruefen(list) {
    if (!list.length) return `<div class="ks-deck"><div class="card ks-card ks-leer"><div class="lbl">Prüfen &amp; verbuchen</div><div class="ks-leer-t">Nichts zu prüfen</div><div class="rs">Sobald jemand eine Zahlung meldet, liegt sie hier.</div></div></div>`;
    const sorted = list.slice().sort((a, b) => a.player.name.localeCompare(b.player.name));
    if (kasse.pruefIdx >= sorted.length || kasse.pruefIdx < 0) kasse.pruefIdx = 0;
    const i = kasse.pruefIdx, s = sorted[i], rest = sorted.length - 1;
    const zahlart = s.zahlart ? (ZAHLART_LABEL[s.zahlart] || s.zahlart) : "";
    // Die Vorlage zeigt fuenf Punkte. Ab neun Meldungen traegt der Zaehler
    // die Aussage besser als eine Punktreihe, die nicht mehr in die Zeile passt.
    const dots = sorted.length > 1 && sorted.length <= 8
      ? `<div class="ks-dots">${sorted.map((_, n) => `<span class="${n === i ? "is-on" : ""}"></span>`).join("")}</div>` : "";
    return `
      ${sorted.length > 1 ? `<div class="ks-bulk"><button class="link-btn" data-kasse-confirm-all>Alle ${sorted.length} bestätigen</button></div>` : ""}
      <div class="ks-deck">
        ${rest >= 2 ? `<div class="ks-ghost ks-ghost-2" aria-hidden="true"></div>` : ""}
        ${rest >= 1 ? `<div class="ks-ghost ks-ghost-1" aria-hidden="true"></div>` : ""}
        <div class="card ks-card">
          <div class="lbl">Meldung ${i + 1} von ${sorted.length}</div>
          <span class="avatar ks-av">${initials(s.player.name)}</span>
          <div class="ks-name">${esc(s.player.name)}</div>
          <div class="rs">${esc(vergehenName(s))} · Strafe vom ${fmtDay(s.datum)}. ${fmtMon(s.datum)}</div>
          <div class="ks-amt num">${euro(s.betrag).replace(/\s/g, " ")}</div>
          <div class="rs">${zahlart ? "per " + esc(zahlart) + " gemeldet" : "Zahlung gemeldet"}</div>
          <div class="ks-actions">
            <button class="btn" data-kasse-reject="${s.id}">Ablehnen</button>
            <button class="btn btn-primary" data-kasse-confirm="${s.id}">Eingang bestätigen</button>
          </div>
          ${kasseHistHtml(s.id)}
        </div>
      </div>
      ${dots}
      <div class="ks-cap">Nach jeder Entscheidung rückt die nächste Meldung nach</div>`;
  }

  /* B3: Reiter „Offen" - Zeilen im Stil der Stapelkarte statt eines Formulars.
     Die Zahlart steht als drei kleine Chips (ausgewaehlter gefuellt), nicht
     mehr als Auswahlfeld; gebucht wird mit dem Primaerknopf daneben. */
  const KASSE_ZAHLARTEN = [["bar", "bar"], ["ueberweisung", "Überweisung"], ["paypal", "PayPal"]];
  function renderKasseOffen(list) {
    if (!list.length) return `<div class="card card-pad ks-leer"><div class="ks-leer-t">Keine offenen Posten</div></div>`;
    const sorted = list.slice().sort((a, b) => a.player.name.localeCompare(b.player.name));
    return `<div class="krow-list">${sorted.map((s) => {
      const gewaehlt = kasse.zahlart[s.id] || "bar";
      const arten = KASSE_ZAHLARTEN.map(([k, label]) =>
        `<button class="zart${gewaehlt === k ? " is-on" : ""}" data-kasse-zart="${s.id}" data-wert="${k}">${label}</button>`).join("");
      return krowHtml(
        s,
        `${esc(vergehenName(s))}${s.auto ? " · automatisch" : ""}`,
        `${fmtDay(s.datum)}. ${fmtMon(s.datum)}`,
        `<div class="zart-row">${arten}</div>
         <div class="krow-tun">
           <button class="btn btn-primary krow-buchen" data-kasse-pay="${s.id}">Buchen</button>
           ${s.auto
             ? `<button class="link-btn is-danger" data-kasse-del="${s.id}">Entfernen</button>`
             : `<button class="link-btn is-danger" data-kasse-cancel="${s.id}">Storno</button>`}
         </div>`
      );
    }).join("")}</div>`;
  }

  function renderKasseBezahlt(list, all) {
    if (!all.length) return `<div class="card card-pad ks-leer"><div class="ks-leer-t">Noch keine bestätigten Zahlungen</div></div>`;
    const players = [...new Set(all.map((s) => s.playerId))].map((id) => playerById[id]).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));
    const filter = `<label class="kasse-filter"><span class="lbl">Spieler</span>
      <select class="kasse-in kasse-bezfilter" data-kasse-bezfilter>
        <option value="">Alle Spieler</option>
        ${players.map((p) => `<option value="${p.id}"${kasse.bezFilter === p.id ? " selected" : ""}>${esc(p.name)}</option>`).join("")}
      </select></label>`;
    const body = list.length ? `<div class="krow-list">${list.map((s) => krowHtml(
      s,
      esc(vergehenName(s)),
      `${s.paidAt ? fmtTs(s.paidAt) : (fmtDay(s.datum) + ". " + fmtMon(s.datum))}${s.zahlart ? " · " + (ZAHLART_LABEL[s.zahlart] || esc(s.zahlart)) : ""}`,
      `<div class="krow-tun"><button class="link-btn" data-kasse-unpay="${s.id}">Rückgängig</button></div>`
    )).join("")}</div>` : `<div class="card card-pad ks-leer"><div class="ks-leer-t">Keine Treffer</div></div>`;
    return filter + body;
  }

  function renderKasse() {
    const alle = aktiveStrafen().map((s) => ({ ...s, betrag: strafeBetrag(s), st: fineStatus(s), player: playerById[s.playerId] })).filter((s) => s.player);
    const offen    = alle.filter((s) => s.st === "offen");
    const gemeldet = alle.filter((s) => s.st === "gemeldet");
    const bezahlt  = alle.filter((s) => s.st === "bestätigt").sort((a, b) => (b.paidAt || "").localeCompare(a.paidAt || ""));
    const offenGesamt    = offen.reduce((a, s) => a + s.betrag, 0);
    const gemeldetGesamt = gemeldet.reduce((a, s) => a + s.betrag, 0);
    const bezahltGesamt  = bezahlt.reduce((a, s) => a + s.betrag, 0);
    const chosen = kasse.players.map((id) => playerById[id] && playerById[id].name).filter(Boolean);
    const build = kasseBuild();
    const bezahltGef = kasse.bezFilter ? bezahlt.filter((s) => s.playerId === kasse.bezFilter) : bezahlt;

    viewEl.innerHTML = `
      <div class="page-head">${navBackChevronHtml()}<h1>Kasse</h1></div>

      <div class="kpi-grid kpi-3">
        <button type="button" class="kpi is-warn kpi-tapbar" data-kstab="offen">
          <div class="kpi-label">Offen</div>
          <div class="kpi-value kpi-amt">${euro(offenGesamt).replace(/\s/g, " ")}</div>
          <div class="kpi-sub">${offen.length} Strafen</div>
        </button>
        <button type="button" class="kpi kpi-tapbar" data-kstab="pruefen">
          <div class="kpi-label">Gemeldet</div>
          <div class="kpi-value kpi-amt">${euro(gemeldetGesamt).replace(/\s/g, " ")}</div>
          <div class="kpi-sub">${gemeldet.length} zu prüfen</div>
        </button>
        <button type="button" class="kpi kpi-tapbar" data-kstab="bezahlt">
          <div class="kpi-label">Eingegangen</div>
          <div class="kpi-value kpi-amt">${euro(bezahltGesamt).replace(/\s/g, " ")}</div>
          <div class="kpi-sub">Saison</div>
        </button>
      </div>

      ${!kasse.formOpen ? `
      <button type="button" class="kasse-toggle" data-kasse-toggle>
        ${ICON_PLUS}<span>Strafe verhängen</span>
      </button>` : `
      <div class="section-title"><h2>Strafe verhängen</h2>
        <button class="link-btn" data-kasse-toggle>Schließen</button></div>
      <div class="card card-pad kasse-add">
        <button type="button" class="kasse-picker" data-ks-open-players>
          <span class="kasse-picker-txt">${chosen.length ? chosen.length + " Spieler gewählt" : "Spieler auswählen"}</span>
          <span class="kasse-picker-arrow" aria-hidden="true">›</span>
        </button>
        ${chosen.length ? `<div class="kasse-chosen">${chosen.map(esc).join(", ")}</div>` : ""}

        <div class="kasse-sub">Aus dem Katalog <span class="kasse-sub-hint">antippen zum Auswählen</span></div>
        <div class="kat-list kasse-catlist">
          ${DEMO.katalog.map((k) => {
            const on = !!kasse.items[k.id];
            const menge = (kasse.items[k.id] && kasse.items[k.id].menge) || 1;
            const preis = k.typ === "staffel"
              ? euro(k.proEinheit || 0).replace(/\s/g, " ") + " / " + (k.schritt || 1) + " " + esc(k.einheit || "")
              : euro(k.betrag).replace(/\s/g, " ");
            return `<div class="kasse-catrow${on ? " is-sel" : ""}">
              <button type="button" class="kasse-catpick" data-kasse-catrow="${k.id}">
                <span class="ks-check" aria-hidden="true">${on ? ICON_CHECK : ""}</span>
                <span class="kat-name">${esc(k.vergehen)}${k.typ === "staffel" ? ` <span class="badge badge-auto">gestaffelt</span>` : ""}</span>
                <span class="kat-amount">${preis}</span>
              </button>
              ${on && k.typ === "staffel" ? `<div class="kasse-bezugwrap">
                <input class="kasse-in kasse-bezug" data-kasse-bezug="${k.id}" inputmode="decimal" placeholder="${esc(k.einheit || "Menge")}" value="${esc(kasse.bezug[k.id] || "")}">
                ${k.maxBetrag != null ? `<span class="kasse-staffel-hint">max ${euro(k.maxBetrag).replace(/\s/g, " ")}</span>` : ""}
              </div>` : ""}
              ${on && k.typ !== "staffel" ? `<div class="kasse-qty">
                <button type="button" class="qty-btn" data-kasse-qty="${k.id}" data-d="-1" aria-label="weniger">−</button>
                <span class="qty-n">${menge}×</span>
                <button type="button" class="qty-btn" data-kasse-qty="${k.id}" data-d="1" aria-label="mehr">+</button>
              </div>` : ""}
            </div>`;
          }).join("")}
        </div>

        <div class="kasse-sub">Individuelle Strafe</div>
        <input class="kasse-in" data-kasse-input="betrag" inputmode="decimal" placeholder="Betrag €" value="${esc(kasse.indivBetrag)}">
        <input class="kasse-in" data-kasse-input="grund" type="text" placeholder="Grund" value="${esc(kasse.indivGrund)}">
        <button type="button" class="btn kasse-addbtn" data-kasse-indiv-add>Hinzufügen</button>
        ${kasse.indiv.length ? `<div class="ks-ichips">${kasse.indiv.map((e, i) => `
          <span class="ks-ichip">${esc(e.grund)} · ${euro(parseFloat(String(e.betrag).replace(",", ".")) || 0).replace(/\s/g, " ")}
            <button type="button" class="chip-x" data-kasse-indiv-del="${i}" aria-label="entfernen">×</button></span>`).join("")}</div>` : ""}

        <div class="kasse-sub">Datum &amp; Kommentar</div>
        <input class="kasse-in" type="date" data-kasse-date value="${kasse.date}" aria-label="Datum">
        <textarea class="kasse-in kasse-comment" data-kasse-input="comment" rows="2" placeholder="Kommentar (optional)" aria-label="Kommentar">${esc(kasse.comment)}</textarea>

        <div id="kasseSummary">${kasseSummaryHtml()}</div>
        <button class="tv-primary kasse-save" data-kasse-add${build.valid ? "" : " disabled"}>Strafen speichern</button>
      </div>`}

      <div class="section-title kasse-verbuchen"><h2>Prüfen &amp; verbuchen</h2></div>
      <div class="ks-pane">
        <div class="chips ks-tabs">
          <button class="chip ${kasse.tab === "pruefen" ? "is-active" : ""}" data-kstab="pruefen">Zu prüfen (${gemeldet.length})</button>
          <button class="chip ${kasse.tab === "offen" ? "is-active" : ""}" data-kstab="offen">Offen (${offen.length})</button>
          <button class="chip ${kasse.tab === "bezahlt" ? "is-active" : ""}" data-kstab="bezahlt">Eingegangen (${bezahlt.length})</button>
        </div>
        ${kasse.tab === "pruefen" ? renderKassePruefen(gemeldet) : ""}
        ${kasse.tab === "offen"   ? renderKasseOffen(offen) : ""}
        ${kasse.tab === "bezahlt" ? renderKasseBezahlt(bezahltGef, bezahlt) : ""}
      </div>
    `;
    ksAttachSwipe();
    startCountdowns();
  }

  /* A4: Der Wisch blaettert im Kartenstapel zur naechsten oder vorigen Meldung -
     nicht mehr durch die Reiter (K4 damit revidiert). Die Reiter wechselt man
     per Tap auf die Chips. Die Karte wandert dabei kurz zur Seite und kommt von
     der anderen zurueck. */
  const KS_TABS = ["pruefen", "offen", "bezahlt"];
  function ksAttachSwipe() {
    const deck = viewEl.querySelector(".ks-deck");
    if (!deck) return;
    const karte = deck.querySelector(".ks-card");
    if (!karte || karte.classList.contains("ks-leer")) return;

    let x0 = 0, y0 = 0, aktiv = false;
    deck.addEventListener("touchstart", (ev) => {
      if (ev.touches.length !== 1) { aktiv = false; return; }
      x0 = ev.touches[0].clientX; y0 = ev.touches[0].clientY; aktiv = true;
    }, { passive: true });
    deck.addEventListener("touchend", (ev) => {
      if (!aktiv) return;
      aktiv = false;
      const t = ev.changedTouches && ev.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - x0, dy = t.clientY - y0;
      if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      ksBlaettern(dx < 0 ? 1 : -1, karte);
    }, { passive: true });
  }

  /* Eine Meldung weiter oder zurueck, mit kurzer Bewegung. Der Stapel ist
     ringfoermig: hinter der letzten kommt wieder die erste. */
  function ksBlaettern(richtung, karte) {
    const anzahl = aktiveStrafen().filter((s) => fineStatus(s) === "gemeldet").length;
    if (anzahl < 2) return;
    const neu = (kasse.pruefIdx + richtung + anzahl) % anzahl;
    if (neu === kasse.pruefIdx) return;
    const fertig = () => { kasse.pruefIdx = neu; renderKasse(); };
    if (!karte || !karte.animate) { fertig(); return; }
    const weg = richtung > 0 ? -70 : 70;
    karte.animate(
      [{ transform: "translateX(0)", opacity: 1 },
       { transform: `translateX(${weg}px)`, opacity: 0 }],
      { duration: 130, easing: "ease-in" }
    ).addEventListener("finish", () => {
      fertig();
      const neueKarte = viewEl.querySelector(".ks-card");
      if (neueKarte && neueKarte.animate) {
        neueKarte.animate(
          [{ transform: `translateX(${-weg}px)`, opacity: 0 },
           { transform: "translateX(0)", opacity: 1 }],
          { duration: 160, easing: "ease-out" }
        );
      }
    });
  }

  // Vorgang speichern: pro Spieler × Zeile ein Eintrag – alles in EINER Transaktion
  // (gemeinsame batch_id) über die RPC create_fines_batch (all-or-none).
  async function kasseSave() {
    const build = kasseBuild();
    if (!build.valid) return;
    const rows = [];
    kasse.players.forEach((pid) => {
      build.lines.forEach((l) => {
        rows.push({ playerId: pid, catalogId: l.catId, offense: l.offense, betrag: l.betrag, date: kasse.date });
      });
    });
    const btn = viewEl.querySelector("[data-kasse-add]"); if (btn) btn.disabled = true;
    try {
      await DB.createFinesBatch(rows, kasse.comment.trim() || null);
      kasse.players = []; kasse.items = {}; kasse.bezug = {}; kasse.indiv = [];
      kasse.formOpen = false;                      // nach dem Speichern wieder einklappen
      kasse.indivBetrag = ""; kasse.indivGrund = ""; kasse.comment = "";
      await reloadData();                          // rendert Kasse neu (aktualisierte Listen)
      tvToast(rows.length + (rows.length > 1 ? " Einträge" : " Eintrag") + " gespeichert");
    } catch (e) {
      if (btn) btn.disabled = false;
      try { console.error("Strafen anlegen fehlgeschlagen:", { code: e && e.code, message: e && e.message, details: e && e.details, hint: e && e.hint }); } catch (x) {}
      window.alert("Speichern fehlgeschlagen: " + ((e && e.message) || e) + ((e && e.hint) ? "\n(Hinweis: " + e.hint + ")" : ""));
    }
  }

  /* ---- Vollbild-Spielerauswahl der Kasse (Stil wie die Trainer-Kaderauswahl) ---- */
  function ksEnsureSheet() {
    if (document.getElementById("ksSheet")) return;
    const scrim = document.createElement("div"); scrim.className = "tv-scrim"; scrim.id = "ksScrim"; scrim.setAttribute("data-ks-close", "");
    const sheet = document.createElement("div"); sheet.className = "tv-sheet tv-kfull"; sheet.id = "ksSheet";
    sheet.innerHTML =
      '<div class="tv-sh"><strong>Spieler auswählen</strong><button class="ks-done" data-ks-done>Fertig</button></div>' +
      '<div class="tv-shbody" id="ksBody"></div>';
    document.body.appendChild(scrim); document.body.appendChild(sheet);
    scrim.addEventListener("click", ksClosePlayers);
    sheet.addEventListener("click", (ev) => {
      if (ev.target.closest("[data-ks-done]")) { ksClosePlayers(); return; }
      const row = ev.target.closest("[data-ks-player]");
      if (row) { const id = row.dataset.ksPlayer; const i = kasse.players.indexOf(id); if (i === -1) kasse.players.push(id); else kasse.players.splice(i, 1); ksRenderPlayers(); }
    });
    // Wisch-nach-unten zum Schließen (nur wenn oben in der Liste).
    let sy = 0, dragging = false;
    sheet.addEventListener("touchstart", (e) => { const b = document.getElementById("ksBody"); if (e.touches.length !== 1 || (b && b.scrollTop > 0)) { dragging = false; return; } sy = e.touches[0].clientY; dragging = true; sheet.style.transition = "none"; }, { passive: true });
    sheet.addEventListener("touchmove", (e) => { if (!dragging) return; const dy = e.touches[0].clientY - sy; if (dy <= 0) { sheet.style.transform = "translateY(0)"; return; } sheet.style.transform = "translateY(" + dy + "px)"; }, { passive: true });
    sheet.addEventListener("touchend", (e) => { if (!dragging) return; dragging = false; sheet.style.transition = ""; const dy = (e.changedTouches[0].clientY - sy); sheet.style.transform = ""; if (dy > 90) ksClosePlayers(); }, { passive: true });
  }
  function ksRenderPlayers() {
    const body = document.getElementById("ksBody"); if (!body) return;
    const spieler = [...DEMO.players].sort((a, b) => nachname(a.name).localeCompare(nachname(b.name), "de"));
    body.innerHTML = `<div class="kat-list ks-plist">${spieler.map((p) => {
      const on = kasse.players.includes(p.id);
      return `<button type="button" class="kat-item ks-prow${on ? " is-sel" : ""}" data-ks-player="${p.id}">
        <span class="avatar">${initials(p.name)}</span>
        <span class="kat-name">${esc(p.name)}</span>
        <span class="ks-check" aria-hidden="true">${on ? ICON_CHECK : ""}</span>
      </button>`;
    }).join("")}</div>`;
  }
  function ksOpenPlayers() { ksEnsureSheet(); ksRenderPlayers(); const s = document.getElementById("ksScrim"), p = document.getElementById("ksSheet"); if (s) s.classList.add("open"); if (p) p.classList.add("open"); }
  function ksClosePlayers() { const s = document.getElementById("ksScrim"), p = document.getElementById("ksSheet"); if (s) s.classList.remove("open"); if (p) p.classList.remove("open"); if (currentView === "kasse") renderKasse(); }

  /* ---------------------------------------------------------------------------
     Interaktion (Event-Delegation)
     --------------------------------------------------------------------------- */
  // Katalog: Typ-Umschalter blendet die Staffel-Felder ein/aus (ohne Re-Render -> Eingaben bleiben).
  viewEl.addEventListener("change", (ev) => {
    if (currentView === "katalog" && ev.target.matches("[data-kat-type]")) {
      const row = ev.target.closest(".kat-edit");
      if (row) row.classList.toggle("is-staffel", ev.target.value === "staffel");
    }
  });
  viewEl.addEventListener("input", (ev) => {
    if (currentView !== "kasse") return;
    const t = ev.target;
    // Staffel-Bezugsgröße je Katalogeintrag (ohne Re-Render -> Fokus bleibt).
    if (t.matches("[data-kasse-bezug]")) { kasse.bezug[t.dataset.kasseBezug] = t.value; }
    else if (t.matches("[data-kasse-input]")) {
      const f = t.dataset.kasseInput;
      if (f === "betrag") kasse.indivBetrag = t.value;
      else if (f === "grund") kasse.indivGrund = t.value;
      else if (f === "comment") kasse.comment = t.value;
    } else return;
    const sum = document.getElementById("kasseSummary"); if (sum) sum.innerHTML = kasseSummaryHtml();
    const btn = viewEl.querySelector("[data-kasse-add]"); if (btn) btn.disabled = !kasseBuild().valid;
  });
  // Datum (change) + Spielerfilter im „Eingegangen"-Tab.
  viewEl.addEventListener("change", (ev) => {
    if (currentView !== "kasse") return;
    if (ev.target.matches("[data-kasse-date]")) {
      kasse.date = ev.target.value || new Date().toISOString().slice(0, 10);
      const sum = document.getElementById("kasseSummary"); if (sum) sum.innerHTML = kasseSummaryHtml();
    } else if (ev.target.matches("[data-kasse-bezfilter]")) {
      kasse.bezFilter = ev.target.value; renderKasse();
    }
  });
  viewEl.addEventListener("click", async (ev) => {
    // Aufstellungs-Builder zuerst (eigene Tap-/Button-Logik)
    if (currentView === "lineup") {
      if (LINEUP_V2) { if (tvViewClick(ev)) return; }
      else {
        const lu = ev.target.closest("[data-slot],[data-lu-saveactive],[data-lu-more]");
        if (lu) {
          if (lu.hasAttribute("data-slot")) lbTapSlot(lu.dataset.slot);
          else if (lu.hasAttribute("data-lu-saveactive")) lbSaveActivate();
          else if (lu.hasAttribute("data-lu-more")) lbOpenMore();
          return;
        }
      }
    }

    // Kasse-Interaktionen (Statuswechsel laufen über RPCs -> serverseitig erzwungen).
    if (currentView === "kasse") {
      if (ev.target.closest("[data-ks-open-players]")) { ksOpenPlayers(); return; }

      // --- Anlage: Katalog auswählen / Menge / Individuell ---
      const crow = ev.target.closest("[data-kasse-catrow]");
      if (crow) {
        const id = crow.dataset.kasseCatrow;
        if (kasse.items[id]) { delete kasse.items[id]; delete kasse.bezug[id]; }
        else kasse.items[id] = { menge: 1 };
        renderKasse(); return;
      }
      const qty = ev.target.closest("[data-kasse-qty]");
      if (qty) {
        const id = qty.dataset.kasseQty, d = parseInt(qty.dataset.d, 10) || 0;
        if (kasse.items[id]) { kasse.items[id].menge = Math.max(1, (parseInt(kasse.items[id].menge, 10) || 1) + d); renderKasse(); }
        return;
      }
      if (ev.target.closest("[data-kasse-indiv-add]")) {
        const b = parseFloat(String(kasse.indivBetrag).replace(",", "."));
        if (!isFinite(b) || b < 0 || !kasse.indivGrund.trim()) { window.alert("Bitte Betrag und Grund eingeben."); return; }
        kasse.indiv.push({ betrag: kasse.indivBetrag, grund: kasse.indivGrund.trim() });
        kasse.indivBetrag = ""; kasse.indivGrund = ""; renderKasse(); return;
      }
      const idel = ev.target.closest("[data-kasse-indiv-del]");
      if (idel) { kasse.indiv.splice(parseInt(idel.dataset.kasseIndivDel, 10), 1); renderKasse(); return; }
      if (ev.target.closest("[data-kasse-add]")) { await kasseSave(); return; }

      // --- „Strafe verhängen" auf-/zuklappen (Zustand gilt, solange die Ansicht offen ist) ---
      if (ev.target.closest("[data-kasse-toggle]")) { kasse.formOpen = !kasse.formOpen; renderKasse(); return; }

      // --- Tabs ---
      const tab = ev.target.closest("[data-kstab]");
      if (tab) { kasse.tab = tab.dataset.kstab; renderKasse(); return; }

      // --- Audit-Verlauf aufklappen (einmalig laden) ---
      const hist = ev.target.closest("[data-kasse-hist]");
      if (hist) {
        const id = hist.dataset.kasseHist, box = document.getElementById("hist-" + id);
        if (!box) return;
        if (!box.hidden) { box.hidden = true; hist.textContent = "Verlauf ▾"; return; }
        box.hidden = false; hist.textContent = "Verlauf ▴";
        if (!box.dataset.loaded) {
          box.innerHTML = `<div class="hist-line">lädt…</div>`;
          try { const rows = await DB.fineHistory(id); box.dataset.loaded = "1";
            box.innerHTML = rows.length ? rows.map(histLineHtml).join("") : `<div class="hist-line">Kein Verlauf.</div>`;
          } catch (e) { box.innerHTML = `<div class="hist-line">Verlauf nicht ladbar.</div>`; }
        }
        return;
      }

      // --- Prüfen: bestätigen / ablehnen / alle bestätigen ---
      const conf = ev.target.closest("[data-kasse-confirm]");
      if (conf) { try { await DB.confirmFines([conf.dataset.kasseConfirm], "paypal"); await reloadData(); tvToast("Bestätigt"); } catch (e) { window.alert("Bestätigen fehlgeschlagen: " + ((e && e.message) || e)); } return; }
      if (ev.target.closest("[data-kasse-confirm-all]")) {
        const ids = aktiveStrafen().filter((s) => fineStatus(s) === "gemeldet").map((s) => s.id);
        if (!ids.length) return;
        if (!window.confirm(ids.length + " gemeldete Strafen bestätigen?")) return;
        try { await DB.confirmFines(ids, "paypal"); await reloadData(); tvToast(ids.length + " bestätigt"); } catch (e) { window.alert("Bestätigen fehlgeschlagen: " + ((e && e.message) || e)); }
        return;
      }
      const rej = ev.target.closest("[data-kasse-reject]");
      if (rej) {
        const grund = window.prompt("Grund der Ablehnung (der Spieler sieht ihn):");
        if (grund == null || !grund.trim()) return;
        try { await DB.rejectFine(rej.dataset.kasseReject, grund.trim()); await reloadData(); tvToast("Abgelehnt"); } catch (e) { window.alert("Ablehnen fehlgeschlagen: " + ((e && e.message) || e)); }
        return;
      }

      // --- Offen: als bezahlt buchen (mit Zahlart) / stornieren / Auto entfernen ---
      // B3: Zahlart als Chips - ein Tap merkt sie, der naechste bucht.
      const zart = ev.target.closest("[data-kasse-zart]");
      if (zart) {
        kasse.zahlart[zart.dataset.kasseZart] = zart.dataset.wert;
        renderKasse();
        return;
      }
      const pay = ev.target.closest("[data-kasse-pay]");
      if (pay) {
        const id = pay.dataset.kassePay;
        const method = kasse.zahlart[id] || "bar";
        try { await DB.markFinesPaid([id], method); await reloadData(); tvToast("Als bezahlt gebucht"); } catch (e) { window.alert("Buchen fehlgeschlagen: " + ((e && e.message) || e)); }
        return;
      }
      const canc = ev.target.closest("[data-kasse-cancel]");
      if (canc) {
        if (!window.confirm("Diese Strafe stornieren? Sie zählt dann nicht mehr.")) return;
        try { await DB.cancelFine(canc.dataset.kasseCancel); await reloadData(); tvToast("Storniert"); } catch (e) { window.alert("Stornieren fehlgeschlagen: " + ((e && e.message) || e)); }
        return;
      }
      const del = ev.target.closest("[data-kasse-del]");
      if (del) { if (window.confirm("Diese automatische Strafe wirklich entfernen?")) { try { await DB.deleteFine(del.dataset.kasseDel); await reloadData(); tvToast("Entfernt"); } catch (e) { window.alert("Löschen fehlgeschlagen: " + ((e && e.message) || e)); } } return; }

      // --- Eingegangen: Buchung rückgängig (zurück auf offen) ---
      const unpay = ev.target.closest("[data-kasse-unpay]");
      if (unpay) { if (!window.confirm("Buchung rückgängig machen? Die Strafe steht wieder als offen.")) return; try { await DB.setFinePaid(unpay.dataset.kasseUnpay, false); await reloadData(); tvToast("Zurückgesetzt"); } catch (e) { window.alert("Rückgängig fehlgeschlagen: " + ((e && e.message) || e)); } return; }
    }

    const t = ev.target.closest("[data-remind],[data-nav-event],[data-rsvp],[data-filter],[data-sfilter],[data-toggle-paid],[data-del-fine],[data-kader-info],[data-rsvp-sheet],[data-tkmenu],[data-task-focus],[data-task-pay],[data-lineup-edit],[data-nav],[data-nav-back],[data-sim],[data-kat-edit],[data-kat-del],[data-kat-save],[data-kat-cancel],[data-kat-add],[data-bfv-connect],[data-bfv-change],[data-bfv-cancel],[data-bfv-sync],[data-goto],[data-paypal],[data-auth],[data-pick-player],[data-paid-self],[data-termin-new],[data-termin-edit],[data-termin-del],[data-view-jump],[data-bfv-reset],[data-bfv-take],[data-cal-sheet],[data-koord-save],[data-status-set],[data-logout]");
    if (!t) return;

    // Fitnessstatus setzen. Wer das darf, entscheidet die Datenbank:
    // Spieler nur sich selbst, coach/admin alle (set_player_status).
    if (t.dataset.statusSet) {
      await statusSpeichern(t.dataset.statusSet, t.dataset.wert);
      return;
    }

    // Abmelden (in den Einstellungen) – prominent platziert, daher mit Rückfrage.
    if (t.hasAttribute("data-logout")) {
      if (!window.confirm("Wirklich abmelden?")) return;
      await logout();
      return;
    }

    // Sportstätte: Koordinaten speichern (Trainer/Kassenwart – zusätzlich per RLS)
    if (t.hasAttribute("data-koord-save")) {
      const row = t.closest("[data-koord-norm]");
      if (!row) return;
      const lat = parseFloat(String(row.querySelector(".koord-lat").value).replace(",", ".").trim());
      const lng = parseFloat(String(row.querySelector(".koord-lng").value).replace(",", ".").trim());
      if (!isFinite(lat) || !isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        window.alert("Bitte gültige Koordinaten eingeben.\nlat zwischen -90 und 90, lng zwischen -180 und 180."); return;
      }
      try {
        await DB.upsertSportstaette({ name: row.dataset.koordName, adresse: row.dataset.koordAdresse, adresse_norm: row.dataset.koordNorm, lat, lng });
        await reloadData();
      } catch (err) { window.alert("Speichern fehlgeschlagen: " + ((err && err.message) || err)); }
      return;
    }

    // Kalender-Abo-Sheet öffnen (Icon in der Kalender-Kopfzeile)
    if (t.hasAttribute("data-cal-sheet")) { openCalSheet(); return; }

    // Termin anlegen / bearbeiten (Trainer/Kassenwart – zusätzlich per RLS erzwungen)
    if (t.hasAttribute("data-termin-new")) { if (Roles.canManageSchedule()) openTerminModal(null); return; }
    // B3: Loeschen direkt von der Karte (bisher nur im Bearbeiten-Dialog).
    if (t.dataset.viewJump) { switchView(t.dataset.viewJump); return; }
    if (t.dataset.terminDel) {
      const ev = DEMO.events.find((x) => x.id === t.dataset.terminDel);
      if (ev) await deleteTermin(ev);
      return;
    }
    if (t.dataset.terminEdit) {
      const e = DEMO.events.find((x) => x.id === t.dataset.terminEdit);
      if (e && Roles.canManageSchedule()) openTerminModal(e);
      return;
    }
    // BFV: manuelle Änderungen verwerfen (zurück auf BFV-Daten)
    if (t.dataset.bfvReset) {
      const e = DEMO.events.find((x) => x.id === t.dataset.bfvReset);
      if (!e || !Roles.canManageSchedule()) return;
      if (!window.confirm("Manuelle Änderungen verwerfen und wieder die BFV-Daten anzeigen?")) return;
      try { await DB.updateEvent(e.id, bfvResetPatch(e)); await reloadData(); }
      catch (err) { window.alert("Fehlgeschlagen: " + ((err && err.message) || err)); }
      return;
    }
    // BFV: neuen abweichenden BFV-Wert einer Gruppe übernehmen
    if (t.dataset.bfvTake) {
      const e = DEMO.events.find((x) => x.id === t.dataset.bfvTake);
      if (!e || !Roles.canManageSchedule()) return;
      try { await DB.updateEvent(e.id, bfvTakePatch(e, t.dataset.takeGroup)); await reloadData(); }
      catch (err) { window.alert("Fehlgeschlagen: " + ((err && err.message) || err)); }
      return;
    }

    // Spielplan (BFV): Mannschaftsseite einfügen -> teamPermanentId ziehen -> speichern -> sofort syncen
    if (t.hasAttribute("data-bfv-connect")) {
      const el = viewEl.querySelector("[data-ical-input]");
      const id = extractTeamId(el ? el.value : "");
      if (!id) { bfvMsg = "Keine gültige BFV-Adresse erkannt. Bitte die komplette Adresse der Mannschaftsseite von bfv.de einfügen."; render(); return; }
      t.disabled = true; const old = t.textContent; t.textContent = "Verbinde …";
      try {
        await DB.setIcalUrl(bfvIcalUrl(id));
        const rr = await DB.syncNow();
        bfvMsg = `Verbunden – ${rr.parsed} Spiele gefunden.`;
        bfvEditing = false;
        await reloadData();
      } catch (err) {
        bfvMsg = "Verbindung fehlgeschlagen: " + ((err && err.message) || err);
        t.disabled = false; t.textContent = old;
        render();
      }
      return;
    }
    // Spielplan (BFV): Eingabefeld öffnen / schließen
    if (t.hasAttribute("data-bfv-change")) { bfvEditing = true; bfvMsg = ""; render(); return; }
    if (t.hasAttribute("data-bfv-cancel")) { bfvEditing = false; bfvMsg = ""; render(); return; }
    // Spielplan (BFV): jetzt aktualisieren
    if (t.hasAttribute("data-bfv-sync")) {
      const el = viewEl.querySelector("[data-ical-input]");
      const url = el ? el.value.trim() : "";
      t.disabled = true; const old = t.textContent; t.textContent = "Aktualisiere …";
      try {
        if (url && url !== (DEMO.icalUrl || "")) await DB.setIcalUrl(url); // ungespeicherte URL zuerst sichern
        const rr = await DB.syncNow();
        bfvMsg = `${rr.updated} aktualisiert, ${rr.new} neu, ${rr.cancelled} abgesagt.`;
        await reloadData();
      } catch (err) {
        bfvMsg = "Fehler: " + ((err && err.message) || err);
        t.disabled = false; t.textContent = old;
        render(); // BFV-Karte liegt jetzt in den Einstellungen -> aktuelle Ansicht neu zeichnen
      }
      return;
    }

    // Strafenkatalog bearbeiten (nur treasurer/admin – zusätzlich per RLS erzwungen)
    if (t.dataset.katEdit) { katEdit = t.dataset.katEdit; renderKatalog(); return; }
    if (t.hasAttribute("data-kat-cancel")) { katEdit = null; renderKatalog(); return; }
    if (t.hasAttribute("data-kat-add")) { katEdit = "new"; renderKatalog(); return; }
    if (t.dataset.katSave) {
      const gv = (sel) => { const el = viewEl.querySelector(`[data-kat-input="${sel}"]`); return el ? el.value : ""; };
      const num = (s) => parseFloat(String(s).replace(",", ".").replace(/[^0-9.]/g, ""));
      const typeEl = viewEl.querySelector("[data-kat-type]");
      const typ = typeEl && typeEl.value === "staffel" ? "staffel" : "fixed";
      const name = gv("name").trim();
      if (!name) { window.alert("Bitte eine Bezeichnung eingeben."); return; }
      try {
        if (typ === "staffel") {
          const proE = num(gv("proEinheit"));
          const schritt = parseInt(String(gv("schritt")).replace(/[^0-9]/g, ""), 10);
          const einheit = gv("einheit").trim();
          const maxRaw = String(gv("maxBetrag")).trim();
          const maxB = maxRaw ? num(maxRaw) : null;
          if (!isFinite(proE) || proE < 0) { window.alert("Bitte einen gültigen Betrag je Schritt eingeben."); return; }
          if (!isFinite(schritt) || schritt < 1) { window.alert("Bitte eine gültige Schrittweite (mindestens 1) eingeben."); return; }
          if (!einheit) { window.alert("Bitte eine Einheit angeben (z. B. Minuten)."); return; }
          const opts = { typ: "staffel", einheit, proEinheit: proE, schritt, maxBetrag: (maxB != null && isFinite(maxB)) ? maxB : null };
          if (t.dataset.katSave === "new") await DB.insertCatalog(DEMO.clubId, name, 0, opts);
          else await DB.updateCatalog(t.dataset.katSave, name, 0, opts);
        } else {
          const amount = num(gv("amount"));
          if (!isFinite(amount) || amount <= 0) { window.alert("Bitte einen gültigen Betrag größer 0 eingeben."); return; }
          if (t.dataset.katSave === "new") await DB.insertCatalog(DEMO.clubId, name, amount, { typ: "fixed" });
          else await DB.updateCatalog(t.dataset.katSave, name, amount, { typ: "fixed" });
        }
        katEdit = null;
        await reloadData();
        tvToast("Gespeichert");
      } catch (err) {
        try { console.error("Katalog speichern fehlgeschlagen:", { code: err && err.code, message: err && err.message, details: err && err.details, hint: err && err.hint }); } catch (e) {}
        const raw = (err && err.message) || String(err);
        const staffelMissing = typ === "staffel" && /schema cache|fine_type|unit_(label|amount|step)|max_amount/i.test(raw + " " + ((err && err.details) || ""));
        window.alert(staffelMissing
          ? "Gestaffelte Strafen brauchen eine einmalige Datenbank-Aktualisierung (Migration 0029 in Supabase). Ein Festbetrag lässt sich schon jetzt speichern."
          : "Speichern fehlgeschlagen: " + raw + ((err && err.hint) ? "\n(Hinweis: " + err.hint + ")" : ""));
      }
      return;
    }
    if (t.dataset.katDel) {
      if (!window.confirm("Strafe wirklich aus dem Katalog entfernen?\n\nBereits eingetragene Strafen bleiben erhalten.")) return;
      try { await DB.deleteCatalog(t.dataset.katDel); katEdit = null; await reloadData(); }
      catch (err) { window.alert("Löschen fehlgeschlagen: " + ((err && err.message) || err)); }
      return;
    }

    // Admin: Ansicht als andere Rolle simulieren (nur Anzeige, keine Rechteänderung)
    if (t.dataset.sim) {
      if (!Roles.isRealAdmin()) return; // Sicherheitsnetz: nur echte Admins
      const map = { player: ["player"], coach: ["player", "coach"], treasurer: ["player", "treasurer"], admin: null };
      Roles.simulate(map[t.dataset.sim]);
      applySimUI();
      switchView("dashboard");
      return;
    }

    // Kader-Info erstellen (Trainer/Admin) -> Vorschau-Dialog
    if (t.dataset.kaderInfo) {
      const e = DEMO.events.find((x) => x.id === t.dataset.kaderInfo);
      if (e) openShareModal("Kader-Info · " + (e.gegner ? (e.heim ? "vs. " : "@ ") + e.gegner : e.titel), buildKaderInfoText(e));
      return;
    }

    // Rückmeldungen ansehen (Trainer/Admin) -> Bottom-Sheet
    if (t.dataset.rsvpSheet) { openRsvpSheet(t.dataset.rsvpSheet); return; }
    if (t.dataset.tkmenu) { openTkMenu(t.dataset.tkmenu); return; }

    // Aufgabenblock: eigene Rückmeldung -> zum Hero scrollen und Zusage fokussieren.
    if (t.dataset.taskFocus) {
      const hero = viewEl.querySelector(".tk");
      const zu = hero && hero.querySelector('[data-rsvp="zu"]');
      if (hero) {
        try { hero.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (e) { hero.scrollIntoView(); }
        hero.classList.add("is-flash");
        setTimeout(() => hero.classList.remove("is-flash"), 1600);
      }
      if (zu) try { zu.focus({ preventScroll: true }); } catch (e) { zu.focus(); }
      return;
    }

    // Aufgabenblock: gemeldete Zahlungen -> Kasse, Reiter „Zu prüfen".
    if (t.hasAttribute("data-task-pay")) { kasse.tab = "pruefen"; switchView("kasse"); return; }

    // Aus einer Spiel-Kachel direkt in die Aufstellung springen (Trainer/Admin; RLS schützt zusätzlich).
    if (t.dataset.lineupEdit) { tvJumpFromCard(t.dataset.lineupEdit); return; }

    // Login <-> Registrieren umschalten
    if (t.dataset.auth) { authMode = t.dataset.auth; authError = ""; authInfo = ""; renderLogin(); return; }

    // Spieler-Verknüpfung wählen (einmalig nach erstem Login)
    if (t.dataset.pickPlayer) {
      try { await DB.setMyPlayer(t.dataset.pickPlayer); authError = ""; init(); }
      catch (err) { authError = (err && err.message) || String(err); renderPlayerLink(); }
      return;
    }

    // Navigation per Link
    if (t.dataset.goto) { switchView(t.dataset.goto); return; }

    // Zurück-Chevron in einer Ziel-Kopfzeile (nach einem Kachel-Sprung) -> zur Übersicht + Scroll.
    if (t.hasAttribute("data-nav-back")) { navBack(); return; }

    // Übersichts-Kachel angetippt -> passendes Ziel + Reiter öffnen (Ursprung/Scroll gemerkt).
    // „N erinnern" (Gate S2, Weg b): fertiger Text mit den Namen der Offenen
    // zum Teilen - es gibt in der App keinen Versandweg, also gibt sie den Text.
    if (t.dataset.remind) {
      const ev = DEMO.events.find((x) => x.id === t.dataset.remind);
      if (ev) openShareModal("Erinnerung", erinnernText(ev));
      return;
    }
    // Kompakte Terminzeile der Uebersicht -> Kalender, zum Termin gescrollt.
    if (t.dataset.navEvent) {
      navJumpTo("kalender", { kalFilter: "alle", eventId: t.dataset.navEvent });
      return;
    }
    if (t.dataset.nav) {
      const kind = t.dataset.nav;
      if (kind === "termin") {
        // Allgemeiner Termin (jeder Typ) -> Standardreiter "Alle", damit der Eintrag in der Liste ist.
        const next = DEMO.events.filter((e) => isFuture(e.datum)).sort((a, b) => a.datum.localeCompare(b.datum))[0];
        navJumpTo("kalender", next ? { kalFilter: "alle", eventId: next.id } : { kalFilter: "alle" });
      } else if (kind === "spiele") {
        navJumpTo("kalender", { kalFilter: "spiel" });   // Reiter "Spiele"
      } else if (kind === "meine-strafen") {
        navJumpTo("strafen", { strafenFilter: "meine" });
      } else if (kind === "kasse") {
        navJumpTo("strafen", { strafenFilter: "offen" });
      }
      return;
    }

    // PayPal.Me-Link in neuem Tab öffnen (Betrag wird übergeben). Phase 4: echte Integration.
    if (t.dataset.paypal) {
      if (!PAYPAL_ME) { window.alert("PayPal ist noch nicht eingerichtet."); return; }   // nur bei leerem Namen
      window.open(paypalMeLink(t.dataset.paypal), "_blank", "noopener,noreferrer");
      return;
    }

    // Kalenderfilter
    if (t.dataset.filter) { kalFilter = t.dataset.filter; renderKalender(); return; }

    // Strafenfilter
    if (t.dataset.sfilter) { strafenFilter = t.dataset.sfilter; renderStrafen(); return; }

    // Ab-/Zusage -> nach Supabase schreiben
    if (t.dataset.rsvp) {
      const eventId = t.dataset.event;
      const playerId = state.currentPlayerId;
      const key = eventId + "|" + playerId;
      const cur = state.rsvp[key] || {};
      const status = t.dataset.rsvp;
      const ev = DEMO.events.find((x) => x.id === eventId);
      // Rückmeldung nach Meldeschluss? -> zählt als verspätet (8 €, server-seitig).
      const dl = ev ? meldeschlussMs(ev) : null;
      const start = ev ? eventStartMs(ev) : null;
      const spaet = dl != null && Date.now() > dl && (start == null || Date.now() < start);
      const spaetWarn = (verb) =>
        !window.confirm(`Der Meldeschluss ist vorbei. Deine Rückmeldung zählt jetzt als verspätet und kostet 8 €.\n\nTrotzdem ${verb}?`);
      try {
        if (cur.status === status) {
          await DB.deleteRsvp(eventId, playerId);     // erneuter Klick = zurücknehmen
          delete state.rsvp[key];
        } else if (status === "ab") {
          if (spaet && spaetWarn("absagen")) return;
          const grund = window.prompt("Grund für die Absage (optional):", cur.grund || "");
          if (grund === null) return;                  // „Abbrechen" -> nichts speichern
          await DB.setRsvp(DEMO.clubId, eventId, playerId, "ab", grund.trim());
          state.rsvp[key] = { status: "ab", grund: grund.trim() };
        } else {
          if (spaet && spaetWarn("zusagen")) return;
          await DB.setRsvp(DEMO.clubId, eventId, playerId, "zu", "");
          state.rsvp[key] = { status: "zu", grund: "" };
        }
      } catch (err) {
        window.alert("Speichern fehlgeschlagen: " + ((err && err.message) || err));
        return;
      }
      await reloadData();   // Konto/Strafen sofort frisch (z. B. neue Auto-Absagestrafe)
      return;
    }

    // Strafe bezahlt/offen umschalten (Kassenwart/Admin) -> nach Supabase schreiben
    if (t.dataset.togglePaid) {
      const id = t.dataset.togglePaid;
      const strafe = DEMO.strafen.find((s) => s.id === id);
      const neu = !istBezahlt(strafe);
      try {
        await DB.setFinePaid(id, neu);
        await reloadData();
      } catch (err) {
        window.alert("Speichern fehlgeschlagen: " + ((err && err.message) || err));
      }
      return;
    }

    // Auto-Strafe entfernen (Trainer/Kassenwart/Admin) -> Spieler war entschuldigt
    if (t.dataset.delFine) {
      if (!window.confirm("Diese automatische Strafe wirklich entfernen?")) return;
      try {
        await DB.deleteFine(t.dataset.delFine);
        await reloadData();
      } catch (err) {
        window.alert("Löschen fehlgeschlagen: " + ((err && err.message) || err));
      }
      return;
    }

    // Selbstmeldung „Ich habe bezahlt" -> eigene offene Strafen melden
    if (t.hasAttribute("data-paid-self")) {
      if (!window.confirm("Bestätige, dass du den offenen Betrag gesendet hast.\n\nDeine offenen Strafen werden als gemeldet markiert. Der Kassenwart bestätigt den Eingang.")) return;
      t.disabled = true;
      try {
        const n = await DB.reportMyPayment();
        await reloadData();
        tvToast((n || 0) + ((n === 1) ? " Strafe gemeldet" : " Strafen gemeldet"));
      } catch (err) {
        window.alert("Konnte die Zahlung nicht melden: " + ((err && err.message) || err));
        t.disabled = false;
      }
      return;
    }
  });

  // Aufstellungs-Builder: Auswahlfelder (Spiel/Formation/Variante)
  viewEl.addEventListener("change", (ev) => {
    if (currentView !== "lineup") return;
    const t = ev.target;
    if (t.matches("[data-lu-event]")) { lb.eventId = t.value; lbLoadActiveOrNew(); renderLineup(); }
    else if (t.matches("[data-lu-formation]")) { lbChangeFormation(t.value); renderLineup(); }
    else if (t.matches("[data-lu-variant]")) { lbChangeVariant(t.value); renderLineup(); }
  });

  // Aufstellungs-Builder: Drag & Drop (Maus)
  viewEl.addEventListener("dragstart", (ev) => {
    if (currentView !== "lineup") return;
    const pool = ev.target.closest("[data-player]");
    const fld  = ev.target.closest("[data-slot-player]");
    if (pool) { lbDrag = { kind: "pool", id: pool.dataset.player }; }
    else if (fld) { lbDrag = { kind: "slot", key: fld.dataset.slotPlayer }; }
    else return;
    if (ev.dataTransfer) { ev.dataTransfer.effectAllowed = "move"; ev.dataTransfer.setData("text/plain", "x"); }
  });
  viewEl.addEventListener("dragover", (ev) => {
    if (currentView !== "lineup" || !lbDrag) return;
    if (ev.target.closest("[data-slot],[data-bank-drop]")) ev.preventDefault();
  });
  viewEl.addEventListener("drop", (ev) => {
    if (currentView !== "lineup" || !lbDrag) return;
    const slot = ev.target.closest("[data-slot]");
    const bank = ev.target.closest("[data-bank-drop]");
    if (slot) { ev.preventDefault(); lbDropOnSlot(slot.dataset.slot); }
    else if (bank) { ev.preventDefault(); lbDropOnBank(); }
  });
  viewEl.addEventListener("dragend", () => { lbDrag = null; });

  /* ---------------------------------------------------------------------------
     Navigation, Spielerauswahl, Reset
     --------------------------------------------------------------------------- */
  /* ---- Kachel-Sprung von der Übersicht (Ursprung + Scroll + Zurück-Chevron/History) ---- */
  let navReturn = null;   // { view, scroll } wenn man von einer Übersichts-Kachel kam, sonst null

  function navBackChevronHtml() {
    return navReturn ? '<button class="pg-back" data-nav-back aria-label="Zurück zur Übersicht">‹</button>' : "";
  }
  // Von einer Kachel zu einem Tab-Ziel springen: Ursprung+Scroll merken, History-Eintrag setzen
  // (Browser-/Wisch-Zurück -> popstate -> navReturnTo), Ziel-Tab aktiv, Ziel rendern.
  function navJumpTo(target, opts) {
    opts = opts || {};
    navReturn = { view: currentView, scroll: window.scrollY || window.pageYOffset || 0 };
    // Reiter/Filter VOR dem Render setzen -> steht beim ERSTEN Rendern korrekt, kein sichtbarer Sprung.
    if (opts.strafenFilter) strafenFilter = opts.strafenFilter;
    if (opts.kalFilter) kalFilter = opts.kalFilter;
    try { history.pushState({ navJump: true }, ""); } catch (e) {}
    currentView = target; tvSetNavActive(target);
    window.scrollTo(0, 0);
    render();                                   // 1) Reiter steht schon; page-head zeigt Zurück-Chevron
    if (opts.eventId) navScrollToEvent(opts.eventId);   // 2) scrollen 3) hervorheben (in navScrollToEvent)
  }
  function navReturnTo() {
    if (!navReturn) return;
    const ret = navReturn; navReturn = null;
    currentView = ret.view; tvSetNavActive(ret.view);
    render();
    window.scrollTo(0, ret.scroll || 0);        // Scrollposition der Übersicht wiederherstellen
  }
  function navBack() { if (navReturn) history.back(); }   // Chevron -> wie Browser-Zurück (popstate erledigt den Rest)

  // Im Kalender zum gewählten Termin scrollen und ihn kurz hervorheben (nach ~2,5s weich aus).
  function navScrollToEvent(eventId) {
    requestAnimationFrame(() => {
      const el = document.getElementById("ev-" + eventId);
      if (!el) return;                          // Termin zwischenzeitlich weg -> einfach kein Scroll, kein Absturz
      try { el.scrollIntoView({ block: "center", behavior: "auto" }); } catch (e) { el.scrollIntoView(); }
      el.classList.add("ev-highlight");
      setTimeout(() => el.classList.remove("ev-highlight"), 2500);
    });
  }

  function switchView(view) {
    currentView = view;
    if (view === "lineup") { tv.view = "games"; tv.eventId = null; tv.sel = null; tv.mark = null; tv.alleSpiele = false; } // v2 startet immer bei der Spielauswahl
    // Kachel-Sprung-Zustand (Ursprung/Readonly/Hash) beim normalen Tab-Wechsel verwerfen.
    tv.origin = null; tv.readonly = false; tv.dirty = false; navReturn = null;
    // Kasse-Vollbild-Auswahl beim Tab-Wechsel schließen.
    const kss = document.getElementById("ksScrim"), ksh = document.getElementById("ksSheet");
    if (kss) kss.classList.remove("open"); if (ksh) ksh.classList.remove("open");
    if (/^#?lineup=/.test(location.hash || "")) { try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {} }
    // Bereiche im „Mehr"-Menü (Aufstellung/Rollen) markieren den Mehr-Tab als aktiv.
    // Bereiche, die im Admin-„Mehr"-Sheet liegen (dann ist der Mehr-Tab aktiv).
    document.querySelectorAll(".nav-btn").forEach((b) => {
      const active = b.hasAttribute("data-more")
        ? SHEET_VIEWS.indexOf(view) !== -1
        : (b.dataset.view === view);
      b.classList.toggle("is-active", active);
    });
    window.scrollTo(0, 0);
    render();
  }

  /* Liegt irgendetwas ueber der Seite? Sheets, Dialoge, Aufstellungs-Panels.
     Pull-to-Refresh darf dann NICHT ausloesen – sonst zieht die Geste die Seite
     hinter dem offenen Sheet neu. Vorher wurde nur .tv-sheet geprueft; Abo-,
     Rueckmeldungs- und Mehr-Sheet nutzen aber .more-sheet und fielen durch. */
  function ueberlagerungOffen() {
    return !!(document.querySelector(".more-sheet:not([hidden])")
           || document.querySelector(".tv-sheet.open")
           || document.querySelector(".modal-ov")
           || document.querySelector("#ksSheet.open"));
  }

  /* Wisch nach unten schliesst ein Bottom-Sheet, wie unter iOS gewohnt.
     Gemeinsam genutzt von Abo- und Rueckmeldungs-Sheet. Greift nur, wenn der
     Inhalt schon ganz oben steht – sonst gewinnt das Scrollen im Sheet. */
  function sheetSwipeToClose(panel, scrollEl, onClose) {
    let sy = 0, dy = 0, dragging = false;
    panel.addEventListener("touchstart", (e) => {
      if (e.touches.length !== 1 || (scrollEl && scrollEl.scrollTop > 0)) { dragging = false; return; }
      sy = e.touches[0].clientY; dy = 0; dragging = true; panel.style.transition = "none";
    }, { passive: true });
    panel.addEventListener("touchmove", (e) => {
      if (!dragging) return;
      dy = e.touches[0].clientY - sy;
      if (dy <= 0 || (scrollEl && scrollEl.scrollTop > 0)) { panel.style.transform = "translateY(0)"; return; }
      e.preventDefault();                       // sonst zieht iOS die Seite dahinter mit
      panel.style.transform = "translateY(" + dy + "px)";
    }, { passive: false });
    panel.addEventListener("touchend", () => {
      if (!dragging) return;
      dragging = false; panel.style.transition = ""; panel.style.transform = "";
      if (dy > 90) onClose();                   // weit genug gezogen -> schliessen
    }, { passive: true });
  }

  // Mehr-Sheet sperrt den Hintergrund-Scroll wie die anderen Sheets auch.
  // Paarweise und nur bei echtem Zustandswechsel, damit der Zaehler in
  // lockBodyScroll()/unlockBodyScroll() nicht aus dem Tritt geraet.
  function openMoreSheet()  { const s = document.getElementById("moreSheet"); if (s && s.hidden)  { s.hidden = false; lockBodyScroll(); } }
  function closeMoreSheet() { const s = document.getElementById("moreSheet"); if (s && !s.hidden) { s.hidden = true;  unlockBodyScroll(); } }

  /* Alle Bottom-Sheets schliessen. Laeuft am Anfang von render(), damit bei JEDEM
     Ansichtswechsel keins ueber der neuen Seite haengen bleibt – Bottom-Nav,
     Mehr-Menue, Kachel-Sprung und vor allem die Zurueck-Geste (popstate), die
     sonst am Sheet vorbei die Ansicht wechselt.
     Entscheidend wegen lockBodyScroll(): ohne das passende close() liefe
     unlockBodyScroll() nie und der body bliebe fixiert – die neue Seite waere
     dann nicht mehr scrollbar. Beide close()-Funktionen pruefen intern auf
     Existenz, laufen also folgenlos ins Leere, wenn nichts offen ist. */
  function closeAllSheets() {
    closeMoreSheet();
    closeCalSheet();
    closeRsvpSheet();
    closeTkMenu();
  }

  document.getElementById("appNav").addEventListener("click", (ev) => {
    const b = ev.target.closest(".nav-btn");
    if (!b) return;
    if (b.hasAttribute("data-more")) { openMoreSheet(); return; }
    switchView(b.dataset.view);
  });

  const moreSheetEl = document.getElementById("moreSheet");
  if (moreSheetEl) {
    moreSheetEl.addEventListener("click", (ev) => {
      if (ev.target.closest("[data-more-close]")) { closeMoreSheet(); return; }
      const it = ev.target.closest(".more-item");
      if (it && it.dataset.view) { closeMoreSheet(); switchView(it.dataset.view); }
    });
  }

  // Pinch-Zoom (iOS ignoriert das Viewport-Tag teils) zusätzlich per JS unterbinden.
  ["gesturestart", "gesturechange", "gestureend"].forEach((evt) =>
    document.addEventListener(evt, (e) => e.preventDefault(), { passive: false }));

  // Footer-Button: Daten frisch aus Supabase neu laden.
  const resetBtn = document.getElementById("resetBtn");
  resetBtn.textContent = "Neu laden";
  resetBtn.title = "Daten neu aus Supabase laden";
  resetBtn.addEventListener("click", () => { init(); });

  /* ---------------------------------------------------------------------------
     Pull-to-Refresh (wiederverwendbares Modul)
     attachPullToRefresh(container, onRefresh):
       container = Element, das beim Ziehen verschoben wird (hier .scroll-area)
       onRefresh = async () => {}  -> laedt Daten neu (hier reloadData)
     Scroll = Fenster; Geste nur bei window.scrollY === 0. Nur transform/opacity.
     --------------------------------------------------------------------------- */
  function attachPullToRefresh(container, onRefresh) {
    if (!container) return;
    const THRESHOLD = 70;   // ab hier wird refresht
    const MAX = 120;        // maximaler sichtbarer Zug
    const REST = 64;        // Halteposition waehrend des Ladens
    const MIN_SPIN = 500;   // Mindest-Spinnerdauer, damit es nicht zuckt
    const TIMEOUT = 8000;   // Abbruch nach 8s
    const SPRING = "transform 280ms cubic-bezier(.22,1,.36,1)";
    const reduce = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

    // Indikator + Hinweis einmalig erzeugen (ausserhalb von #view).
    const ind = document.createElement("div");
    ind.className = "ptr-ind"; ind.setAttribute("aria-hidden", "true");
    // Schatten ZUERST (liegt hinter der Muenze), dann die Muenze (Ring + rund beschnittenes Wappen).
    ind.innerHTML = '<div class="ptr-shadow"></div><div class="ptr-coin"><div class="ptr-ring"></div><div class="ptr-disc"><img class="ptr-logo" src="assets/icon-512.png" width="30" height="30" alt="" draggable="false"></div></div>';
    const coin = ind.querySelector(".ptr-coin");
    document.body.appendChild(ind);
    const hint = document.createElement("div");
    hint.className = "ptr-hint"; hint.setAttribute("role", "status"); hint.setAttribute("aria-live", "polite");
    document.body.appendChild(hint);

    let startY = 0, startX = 0, pull = 0, tracking = false, decided = false, active = false, refreshing = false, hintT = 0;

    // Positionen/Deckkraft von Container + Indikator (OHNE Muenzkippung - die laeuft getrennt).
    function renderPull(px) {
      if (reduce) { // kein Feder-Feeling: nur hart ein-/ausblenden
        container.style.transform = "";
        ind.style.opacity = (px >= THRESHOLD || refreshing) ? "1" : "0";
        ind.style.transform = "translateX(-50%)";
        return;
      }
      container.style.transform = "translateY(" + px + "px)";
      ind.style.opacity = String(Math.min(1, px / THRESHOLD));
      ind.style.transform = "translateX(-50%) translateY(" + (px * 0.45) + "px)";
    }
    // Zieh-Update gebuendelt per requestAnimationFrame (nicht direkt im touchmove): Position UND
    // Muenzkippung. Kippung 0deg -> 55deg proportional zur Distanz, ohne Transition -> finger-genau.
    let rafPending = false;
    function scheduleDrag() { if (!rafPending) { rafPending = true; requestAnimationFrame(applyDrag); } }
    function applyDrag() {
      rafPending = false;
      renderPull(pull);
      if (!reduce) coin.style.transform = "rotateY(" + Math.min(55, (pull / THRESHOLD) * 55) + "deg)";
    }
    function clearTransition() {
      container.style.transition = "none"; ind.style.transition = "none";
      coin.style.transition = "none"; coin.style.willChange = "transform"; // waehrend der Geste
    }
    function springTo(px) {
      container.style.transition = SPRING;
      ind.style.transition = "opacity 200ms ease, " + SPRING;
      renderPull(px);
    }
    // Weiche, zusammenhaengende Rueckkehr nach oben: Inhalt UND Indikator in EINER
    // Bewegung (300ms ease-out). Erzwungener Reflow committet den Startwert, damit iOS
    // die Transition nicht ueberspringt (sonst harter Sprung). Spinner-Rotation erst
    // NACH dem Ausblenden stoppen -> kein sichtbarer Snap.
    function springBack() {
      if (reduce) { ind.classList.remove("is-spinning"); container.style.transform = ""; ind.style.opacity = "0"; coin.style.transform = ""; coin.style.willChange = ""; pull = 0; return; }
      const RET = "300ms cubic-bezier(.22,1,.36,1)";
      container.style.transition = "transform " + RET;
      ind.style.transition = "transform " + RET + ", opacity " + RET;
      coin.style.transition = "transform " + RET;
      void container.offsetHeight;                         // Startwert (Halteposition) sicher committen
      container.style.transform = "translateY(0px)";       // Inhalt weich nach oben ...
      ind.style.opacity = "0";                             // ... Indikator gleichzeitig aus (eine Bewegung)
      ind.style.transform = "translateX(-50%) translateY(0px)";
      coin.style.transform = "rotateY(0deg)";              // ... Muenze weich in die Mittelstellung
      pull = 0;
      setTimeout(() => {
        ind.classList.remove("is-spinning");               // Animation erst nach dem Ausblenden stoppen (kein Snap)
        // Nur wenn KEINE neue Geste/kein Refresh laeuft: harter, vollstaendiger Reset in den
        // versteckten Grundzustand. Verhindert einen stehen bleibenden/„mitscrollenden" Indikator,
        // falls die CSS-Transition auf Deckkraft 0 unterbrochen wurde.
        if (!tracking && !refreshing) hardHide();
      }, 320);
    }
    // Harter Reset in den versteckten Grundzustand (Deckkraft 0, keine Transforms/Transition).
    function hardHide() {
      ind.classList.remove("is-spinning");
      ind.style.transition = "none"; ind.style.opacity = "0"; ind.style.transform = "translateX(-50%)";
      coin.style.transition = "none"; coin.style.transform = ""; coin.style.willChange = "";
      container.style.transition = "none"; container.style.transform = "";
    }
    function showHint(msg) {
      hint.textContent = msg; hint.classList.add("show");
      clearTimeout(hintT); hintT = setTimeout(() => hint.classList.remove("show"), 2600);
    }

    async function startRefresh() {
      refreshing = true;
      // Nahtloser Uebergang: Kippung beim Loslassen ist 55deg (Distanz >= Schwelle -> gedeckelt) und
      // exakt der 0%-Frame von @keyframes ptr-rotate. Inline-55deg als Fallback setzen, Animation greift
      // -> kein Sprung in die Mitte. Keine Transition (Animation uebernimmt).
      coin.style.transition = "";
      if (!reduce) coin.style.transform = "rotateY(55deg)";
      ind.classList.add("is-spinning");      // -> selbstaendiges Pendeln ab der aktuellen Kippstellung
      if (reduce) ind.style.opacity = "1"; else springTo(REST);
      const started = Date.now();
      let settled = false; // markiert, ob bereits abgeschlossen (Timeout ODER fertig)
      const to = setTimeout(() => { if (settled) return; settled = true; finish(false); }, TIMEOUT);
      try {
        await onRefresh();
        const el = Date.now() - started;
        if (el < MIN_SPIN) await new Promise((r) => setTimeout(r, MIN_SPIN - el));
        if (!settled) { settled = true; clearTimeout(to); finish(true); }
      } catch (e) {
        if (!settled) { settled = true; clearTimeout(to); finish(false); }
      }
    }
    function finish(ok) {
      // Daten sind hier bereits im DOM (onRefresh wurde davor awaited). Bei voller Drehung faded die
      // Muenze im Spin aus (is-spinning bleibt bis NACH dem Ausblenden -> kein Snap); springBack
      // uebernimmt das weiche Zurueckfahren nach oben.
      if (!ok) showHint("Konnte nicht aktualisiert werden");
      springBack();
      setTimeout(() => { refreshing = false; }, reduce ? 0 : 320);
    }

    // --- Touch-Handling -----------------------------------------------------
    window.addEventListener("touchstart", (e) => {
      if (refreshing || e.touches.length !== 1) { tracking = false; return; }
      if (document.body.classList.contains("auth-mode")) { tracking = false; return; } // nicht auf Login/Reset
      if (ueberlagerungOffen()) { tracking = false; return; }                            // nicht, solange irgendetwas darueber liegt
      if (window.scrollY > 0) { tracking = false; return; }                             // nur ganz oben
      startY = e.touches[0].clientY; startX = e.touches[0].clientX;
      tracking = true; decided = false; active = false; pull = 0;
      hardHide();  // stale/haengengebliebenen Indikator vor einer neuen Geste sicher verstecken
    }, { passive: true });

    window.addEventListener("touchmove", (e) => {
      if (!tracking || refreshing) return;
      const dy = e.touches[0].clientY - startY;
      const dx = e.touches[0].clientX - startX;
      if (!decided) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;                 // Richtung noch nicht eindeutig
        if (Math.abs(dx) >= Math.abs(dy) || dy <= 0) { tracking = false; return; } // horizontal ODER nach oben -> normal scrollen
        decided = true; active = true; clearTransition();                // eindeutig vertikal nach unten -> unsere Geste
      }
      if (window.scrollY > 0) { tracking = false; springBack(); return; } // zwischendrin doch gescrollt
      if (dy <= 0) { pull = 0; scheduleDrag(); return; }
      e.preventDefault();                                                 // nativen Bounce unterdruecken
      pull = dy / (1 + dy / MAX);                                         // Gummiband-Widerstand
      scheduleDrag();                                                     // Position + Kippung im naechsten Frame
    }, { passive: false });

    function end() {
      if (!tracking || refreshing) { tracking = false; return; }
      tracking = false;
      if (!active) return;
      if (pull >= THRESHOLD) startRefresh(); else springBack();
    }
    window.addEventListener("touchend", end, { passive: true });
    window.addEventListener("touchcancel", () => {
      if (tracking && active && !refreshing) springBack();
      tracking = false;
    }, { passive: true });
  }

  // Einmal registrieren: ein Scroll-Container (Fenster/.scroll-area), eine globale
  // Refresh-Funktion. Alle Seiten teilen sich das, weil sie in denselben Container
  // rendern und dieselbe Datenquelle (DEMO) nutzen. Modul bleibt generisch fuer
  // spaetere Seiten mit eigenem Scroll-Container.
  attachPullToRefresh(document.getElementById("scrollArea"), reloadData);

  /* Tastatur-Fix (iOS): sobald ein Eingabefeld fokussiert ist, die unteren fixen Leisten
     (Nav + Simulations-Bar) ausblenden -> kein Spalt, durch den Inhalt durchscheint. Nach dem
     Schliessen wieder einblenden. Zusaetzlich das aktive Feld in den sichtbaren Bereich holen. */
  (function () {
    const isField = (el) => !!(el && el.matches && el.matches("input, textarea, select") && el.type !== "checkbox" && el.type !== "radio");
    let blurT = 0;
    document.addEventListener("focusin", (e) => {
      if (!isField(e.target)) return;
      clearTimeout(blurT);
      document.body.classList.add("kb-open");
      setTimeout(() => { try { e.target.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (x) {} }, 260);
    });
    document.addEventListener("focusout", (e) => {
      if (!isField(e.target)) return;
      blurT = setTimeout(() => { if (!isField(document.activeElement)) document.body.classList.remove("kb-open"); }, 120);
    });
  })();

  // Simulations-Vorschau beenden -> zurück zur echten Admin-Ansicht.
  const simExitBtn = document.getElementById("simExit");
  if (simExitBtn) simExitBtn.addEventListener("click", () => {
    Roles.simulate(null);
    applySimUI();
    switchView("admin");
  });

  /* ---------------------------------------------------------------------------
     Höhe der festen Kopfzeile messen -> als --header-h (Platz darunter im Body)
     --------------------------------------------------------------------------- */
  function syncHeaderHeight() {
    const header = document.querySelector(".app-header");
    // Waehrend des Splash ist die Kopfzeile ausgeblendet (offsetHeight 0) -> NICHT auf 0 setzen,
    // sonst rutscht der Inhalt unter die Kopfzeile. Fallback-Padding behalten, spaeter nachmessen.
    if (header && header.offsetHeight > 0) {
      document.documentElement.style.setProperty("--header-h", header.offsetHeight + "px");
    }
  }
  window.addEventListener("resize", syncHeaderHeight);
  window.addEventListener("load", syncHeaderHeight);
  window.addEventListener("orientationchange", () => setTimeout(syncHeaderHeight, 200));
  window.addEventListener("fn:chrome-shown", syncHeaderHeight); // nach dem Splash: echte Kopfzeilenhoehe nachmessen

  /* ===========================================================================
     AUTHENTIFIZIERUNG (Oberfläche)
     =========================================================================== */
  let currentProfile = null;
  let authMode = "login";   // "login" | "register" | "forgot"
  let authError = "";
  let authInfo = "";        // grüne Hinweis-/Erfolgsmeldung
  let recoveryMode = false;  // true, wenn App über Passwort-Reset-Link geöffnet
  let currentUserId = null;  // Auth-User-ID des eingeloggten Nutzers
  const ROLE_LABEL = { admin: "Administrator", coach: "Trainer", treasurer: "Kassenwart", player: "Spieler" };
  // Zahnrad im Header öffnet die Einstellungen.
  const hdrGear = document.getElementById("hdrGear");
  if (hdrGear) hdrGear.addEventListener("click", () => switchView("einstellungen"));
  // Farbiger Punkt am Zahnrad, solange die Admin-Rollensimulation aktiv ist.
  // Gate 24: der Punkt am Zahnrad entfaellt. Dass eine Rollen-Vorschau laeuft,
  // sagt das Banner ueber der Seite deutlicher als ein 6px-Punkt.
  function updateGearDot() {}
  // Vollständiges Abmelden (aus den Einstellungen). Beendet Simulation, setzt zurück.
  async function logout() {
    try { await DB.signOut(); } catch (e) {}
    currentProfile = null;
    Roles.set([]);
    Roles.simulate(null); applySimUI();
    authMode = "login"; authError = "";
    init();
  }

  /* Zentrale Rollen-/Rechte-Prüfung (nur UI-Komfort – echte Sperre = RLS!).
     Mehrfach-Rollen werden vereinigt: wer mehrere Rollen hat, hat alle Rechte. */
  const Roles = {
    real: [],          // echte Rollen aus der DB (nie durch Simulation verändert)
    sim: null,         // simulierte Rollen für die ANZEIGE (Admin-Vorschau), sonst null
    set(arr) { this.real = Array.isArray(arr) ? arr.slice() : []; },
    // Effektive Rollen für die UI: im Simulationsmodus die simulierten, sonst die echten.
    get list() { return this.sim || this.real; },
    has(r) { return this.list.indexOf(r) !== -1; },
    isAdmin() { return this.has("admin"); },
    isRealAdmin() { return this.real.indexOf("admin") !== -1; },
    isSimulating() { return this.sim !== null; },
    simulate(arr) { this.sim = arr ? arr.slice() : null; }, // null = Simulation aus
    canManageEvents() { return this.has("coach") || this.isAdmin(); },
    canEditCatalog() { return this.has("treasurer") || this.isAdmin(); },
    canManageFines() { return this.has("treasurer") || this.isAdmin(); },
    // Auto-Strafen darf auch der Trainer entfernen (Spieler war entschuldigt).
    canDeleteAutoFine() { return this.canManageFines() || this.canManageEvents(); },
    // Spielplan und Terminpflege: Trainer oder Admin. Der Kassenwart hat
    // hier nichts zu bearbeiten (A1).
    canManageSchedule() { return this.canManageEvents(); },
  };

  function authErrorText(msg) {
    if (/Invalid login credentials/i.test(msg)) return "E-Mail oder Passwort ist falsch.";
    if (/already registered|already exists/i.test(msg)) return "Diese E-Mail ist bereits registriert.";
    if (/Password should be at least/i.test(msg)) return "Passwort muss mindestens 6 Zeichen haben.";
    if (/Email not confirmed/i.test(msg)) return "Bitte bestätige zuerst deine E-Mail (Link in der Mail).";
    if (/valid email/i.test(msg)) return "Bitte eine gültige E-Mail-Adresse eingeben.";
    return msg;
  }

  // Icons für den 5. Nav-Tab (gleicher Stil/Größe wie die anderen Tabs).
  const ICON_NAV_DOTS  = `<svg class="nav-ic" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>`;
  const ICON_NAV_PITCH = `<svg class="nav-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M12 5v14"/><circle cx="12" cy="12" r="2.4"/><path d="M3 9.5h3v5H3M21 9.5h-3v5h3"/></svg>`;
  const ICON_NAV_PERSON = `<svg class="nav-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6"/></svg>`;
  // Muenzstapel (Provisorium Variante A: 3 gestapelte Muenzen; A/B siehe Preview).
  const ICON_NAV_COIN  = `<svg class="nav-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="6.8" rx="7" ry="2.6"/><path d="M5 6.8v8.4M19 6.8v8.4"/><path d="M5 15.2a7 2.6 0 0 0 14 0"/><path d="M5 10a7 2.6 0 0 0 14 0"/><path d="M5 12.6a7 2.6 0 0 0 14 0"/></svg>`;

  // 5. Tab (unten rechts) nach höchster EFFEKTIVER Rolle: Admin „Mehr", Trainer
  // „Trainer" (Aufstellung), Spieler „Profil". Effektiv = inkl. Admin-Vorschau
  // (Simulation ist admin-only und rein Anzeige; die echte Absicherung ist RLS).
  function setupPrimaryNavTab() {
    const btn = document.getElementById("navMore");
    if (!btn) return;
    btn.style.display = "";
    // Zugaengliche Spezialbereiche (fuers Mehr-Menue + zum Zaehlen der Mehrfachrollen).
    const specials = [];
    if (Roles.canManageEvents()) specials.push("lineup");   // Trainer/Admin
    if (Roles.canManageFines())  specials.push("kasse");     // Kassenwart/Admin
    if (Roles.isAdmin())         specials.push("admin");     // Rollen
    // Icon/Label = hoechste Rolle. Reihenfolge admin > coach > treasurer > player.
    const icon = Roles.isAdmin() ? [ICON_NAV_DOTS, "Mehr"]
      : Roles.has("coach") ? [ICON_NAV_PITCH, "Trainer"]
      : Roles.has("treasurer") ? [ICON_NAV_COIN, "Kasse"]
      : [ICON_NAV_PERSON, "Profil"];
    btn.innerHTML = `${icon[0]}<span class="nav-label">${icon[1]}</span>`;
    // Mehrere Spezialbereiche ODER Admin -> 5. Tab oeffnet das Mehr-Menue (alles Zugaengliche).
    // Genau EIN Spezialbereich -> direkt dorthin. Kein Spezialbereich -> Profil.
    if (specials.length >= 2 || Roles.isAdmin()) {
      btn.setAttribute("data-more", ""); btn.removeAttribute("data-view");
    } else if (specials.length === 1) {
      btn.removeAttribute("data-more"); btn.setAttribute("data-view", specials[0]);
    } else {
      // A2: reine Spieler haben vier Tabs. Das Profil erreichen sie ueber
      // das Zahnrad in der Kopfzeile, nicht ueber einen fuenften Tab.
      btn.style.display = "none";
    }
  }

  // „Angemeldet als …" + Abmelden im Kopfbereich.
  function fillIdentity() {
    // Header trägt keinen Namen/keine Rolle mehr (steht in den Einstellungen).
    // Sheet-Inhalte (nur Admin nutzt das „Mehr"-Sheet – Trainer hat den Trainer-Tab).
    const moreKader  = document.getElementById("moreKader");
    const moreLineup = document.getElementById("moreLineup");
    const moreKasse  = document.getElementById("moreKasse");
    const moreAdmin  = document.getElementById("moreAdmin");
    // Mehr-Menue zeigt ALLES Zugaengliche (Mehrfachrollen erreichen so ihre weiteren Bereiche).
    if (moreKader)  moreKader.style.display  = Roles.canManageEvents() ? "" : "none";
    if (moreLineup) moreLineup.style.display = Roles.canManageEvents() ? "" : "none";
    if (moreKasse)  moreKasse.style.display  = Roles.canManageFines()  ? "" : "none";
    if (moreAdmin)  moreAdmin.style.display  = Roles.isAdmin() ? "" : "none";
    setupPrimaryNavTab(); // 5. Tab je nach höchster Rolle; Menue-Inhalt je nach Rechten
    // Teamname mittig im Header (aus den Einstellungen, Fallback ohne Zusatz).
    const titleEl = document.getElementById("hdrTitle");
    if (titleEl && typeof DEMO !== "undefined" && DEMO) titleEl.textContent = DEMO.teamName || "FC Fasanerie-Nord";
    updateGearDot();
    syncHeaderHeight(); // Platz unter der festen Kopfzeile an die echte Höhe koppeln
  }

  /* Rollen-Simulation (nur Anzeige!): blendet die Hinweisleiste ein/aus und
     aktualisiert Navigation + Kopfzeile anhand der EFFEKTIVEN Rollen.
     Es werden keinerlei Daten- oder Rechteänderungen ausgelöst – jeder DB-Zugriff
     läuft weiterhin mit der echten Sitzung, die serverseitig per RLS geprüft wird. */
  function applySimUI() {
    const sim = Roles.isSimulating();
    document.body.classList.toggle("simulating", sim);
    const simBar = document.getElementById("simBar");
    if (simBar) simBar.hidden = !sim;
    if (sim) {
      const simRoleEl = document.getElementById("simRole");
      if (simRoleEl) {
        const l = Roles.list;
        simRoleEl.textContent = l.indexOf("coach") !== -1 ? "Trainer"
          : l.indexOf("treasurer") !== -1 ? "Kassenwart" : "Spieler";
      }
    }
    fillIdentity();
  }

  // Login-/Registrier-Seite.
  function renderLogin() {
    document.body.classList.add("auth-mode");
    const mode = authMode; // "login" | "register" | "forgot"
    const titles  = { login: "Anmelden", register: "Konto erstellen", forgot: "Passwort zurücksetzen" };
    const submits = { login: "Anmelden", register: "Registrieren", forgot: "Reset-Link senden" };
    const needPw = mode !== "forgot";
    viewEl.innerHTML = `
      <div class="auth-wrap">
        <form class="auth-card" id="authForm" data-mode="${mode}">
          <div class="auth-crest"><img src="assets/logo.png" alt="FC Fasanerie-Nord" /></div>
          <h1 class="auth-title">${titles[mode]}</h1>
          <p class="auth-sub">FC Fasanerie-Nord · Mannschaftsbereich</p>
          ${authError ? `<div class="auth-error">${esc(authError)}</div>` : ""}
          ${authInfo ? `<div class="auth-info">${esc(authInfo)}</div>` : ""}
          <label class="auth-field"><span>E-Mail</span>
            <input type="email" name="email" autocomplete="email" placeholder="name@example.de" required></label>
          ${needPw ? `<label class="auth-field"><span>Passwort</span>
            <input type="password" name="password" minlength="6"
              autocomplete="${mode === "login" ? "current-password" : "new-password"}" required></label>` : ""}
          <button type="submit" class="auth-submit">${submits[mode]}</button>
          ${mode === "login" ? `<button type="button" class="link-btn auth-forgot" data-auth="forgot">Passwort vergessen?</button>` : ""}
          <div class="auth-switch">${
            mode === "login"    ? `Noch kein Konto? <button type="button" class="link-btn" data-auth="register">Jetzt registrieren</button>`
            : mode === "register" ? `Schon ein Konto? <button type="button" class="link-btn" data-auth="login">Hier anmelden</button>`
            : `<button type="button" class="link-btn" data-auth="login">Zurück zur Anmeldung</button>`}</div>
        </form>
      </div>`;
  }

  // Formular zum Setzen eines neuen Passworts (nach Klick auf den Reset-Link).
  function renderResetPassword() {
    document.body.classList.add("auth-mode");
    viewEl.innerHTML = `
      <div class="auth-wrap">
        <form class="auth-card" id="authForm" data-mode="reset">
          <div class="auth-crest"><img src="assets/logo.png" alt="FC Fasanerie-Nord" /></div>
          <h1 class="auth-title">Neues Passwort</h1>
          <p class="auth-sub">Bitte vergib ein neues Passwort.</p>
          ${authError ? `<div class="auth-error">${esc(authError)}</div>` : ""}
          <label class="auth-field"><span>Neues Passwort</span>
            <input type="password" name="password" minlength="6" autocomplete="new-password" required></label>
          <label class="auth-field"><span>Wiederholen</span>
            <input type="password" name="password2" minlength="6" autocomplete="new-password" required></label>
          <button type="submit" class="auth-submit">Passwort speichern</button>
        </form>
      </div>`;
  }

  // Einmalige Auswahl „Welcher Spieler bin ich?".
  function renderPlayerLink() {
    document.body.classList.remove("auth-mode");
    fillIdentity();
    const opts = DEMO.players.slice().sort((a, b) => a.name.localeCompare(b.name))
      .map((p) => `<button class="pick-player" data-pick-player="${p.id}">` +
        `<span class="avatar">${initials(p.name)}</span>` +
        `<span class="pick-name">${esc(p.name)} <small>#${p.nr}</small></span></button>`).join("");
    viewEl.innerHTML = `
      <div class="page-head"><h1>Willkommen!</h1>
        <p>Bitte wähle einmalig, welcher Spieler du bist — dann ordnen wir dir Strafen, Termine und Zu-/Absagen korrekt zu.</p></div>
      ${authError ? `<div class="auth-error">${esc(authError)}</div>` : ""}
      <div class="pick-grid">${opts}</div>`;
  }

  // Admin: Rollen verwalten (Mitglieder-Liste + Rollen-Häkchen).
  async function renderAdmin() {
    document.body.classList.remove("auth-mode");
    viewEl.innerHTML = `<div class="page-head"><h1>Rollen verwalten</h1></div>
      <div class="empty">Lade Mitglieder …</div>`;
    let members;
    try { members = await DB.listMembers(); }
    catch (err) {
      viewEl.innerHTML = `<div class="page-head"><h1>Rollen verwalten</h1></div>
        <div class="empty">${esc((err && err.message) || String(err))}</div>`;
      return;
    }
    const nameOf = (m) => (m.playerId && playerById[m.playerId]) ? playerById[m.playerId].name : (m.email || "—");
    members.sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
    const cell = (m, role) =>
      `<td style="text-align:center"><input type="checkbox" class="role-box" data-user="${m.userId}" data-role="${role}" ${m.roles.indexOf(role) !== -1 ? "checked" : ""}></td>`;
    viewEl.innerHTML = `
      <div class="page-head"><h1>Rollen verwalten</h1></div>
      <div class="sim-switch card card-pad">
        <div class="sim-switch-label">Ansicht testen als</div>
        <div class="sim-switch-btns">
          <button class="chip" data-sim="player">Spieler</button>
          <button class="chip" data-sim="coach">Trainer</button>
          <button class="chip" data-sim="treasurer">Kassenwart</button>
          <button class="chip" data-sim="admin">Admin</button>
        </div>
        <div class="sim-switch-hint">Reine Anzeige-Vorschau – ändert nichts an deinen Rechten oder Daten. Alle Zugriffe bleiben serverseitig per RLS abgesichert.</div>
      </div>
      <div class="card table-wrap"><table class="rollen-tbl">
        <thead><tr><th>Mitglied</th>
          <th style="text-align:center"><abbr title="Trainer">Tr</abbr></th>
          <th style="text-align:center"><abbr title="Kassenwart">Ka</abbr></th>
          <th style="text-align:center"><abbr title="Admin">Ad</abbr></th></tr></thead>
        <tbody>
          ${members.map((m) => {
            const name = nameOf(m);
            return `<tr>
              <td><div class="player-cell"><span class="avatar rollen-av">${initials(name)}</span>
                <div><div class="rollen-name">${esc(name)}</div>
                <div class="rollen-mail">${esc(m.email || "")}</div></div></div></td>
              ${cell(m, "coach")}${cell(m, "treasurer")}${cell(m, "admin")}
            </tr>`;
          }).join("")}
        </tbody>
      </table></div>
      <p style="color:var(--muted);font-size:.85rem;margin-top:12px">${members.length} Mitglied(er) · Neue erscheinen hier, sobald sie sich registriert haben.</p>`;
  }

  // Status setzen (Trainer/Admin) per Auswahl im Kader-Status.
  /* Datum und Notiz speichern beim Verlassen des Feldes - kein extra Knopf.
     Der Status selbst kommt aus den Chips; hier wird er unveraendert
     mitgeschickt, damit die Funktion nichts zurueckstellt. */
  viewEl.addEventListener("change", async (ev) => {
    const feld = ev.target.closest("[data-status-until],[data-status-note]");
    if (!feld) return;
    const playerId = feld.dataset.statusUntil || feld.dataset.statusNote;
    const p = playerById[playerId];
    if (!p || istFit(p)) return;          // bei "fit" gibt es keine Felder
    await statusSpeichern(playerId, p.status);
  });

  // Rolle per Häkchen vergeben/entziehen.
  viewEl.addEventListener("change", async (ev) => {
    const box = ev.target.closest(".role-box");
    if (!box) return;
    const userId = box.dataset.user, role = box.dataset.role, want = box.checked;
    if (!want && role === "admin" && userId === currentUserId) {
      if (!window.confirm("Dir selbst die Admin-Rolle entziehen? Du verlierst dann die Admin-Rechte.")) {
        box.checked = true; return;
      }
    }
    box.disabled = true;
    try {
      if (want) await DB.grantRole(userId, role, DEMO.clubId);
      else await DB.revokeRole(userId, role);
      if (userId === currentUserId) {
        try { Roles.set(await DB.myRoles()); } catch (e) {}
        fillIdentity();
        if (!Roles.isAdmin()) { switchView("dashboard"); return; }
      }
    } catch (err) {
      box.checked = !want;
      window.alert("Konnte Rolle nicht ändern: " + ((err && err.message) || err));
    } finally {
      box.disabled = false;
    }
  });

  // Login-/Registrier-Formular absenden.
  viewEl.addEventListener("submit", async (ev) => {
    const form = ev.target.closest("#authForm");
    if (!form) return;
    ev.preventDefault();
    const mode = form.dataset.mode;
    const email = form.email ? form.email.value.trim() : "";
    const btn = form.querySelector(".auth-submit");
    const orig = btn.textContent;
    btn.disabled = true; btn.textContent = "Bitte warten …";
    try {
      if (mode === "login") {
        await DB.signIn(email, form.password.value);
        authError = ""; authInfo = ""; init(); return;
      }
      if (mode === "register") {
        const res = await DB.signUp(email, form.password.value);
        if (!res.session) {
          authMode = "login"; authError = "";
          authInfo = "Konto erstellt! Bitte bestätige deine E-Mail (Link in der Mail) und melde dich dann an.";
          renderLogin(); return;
        }
        authError = ""; authInfo = ""; init(); return;
      }
      if (mode === "forgot") {
        await DB.resetPassword(email);
        authMode = "login"; authError = "";
        authInfo = "Falls ein Konto existiert, haben wir dir einen Link zum Zurücksetzen geschickt. Bitte ins Postfach schauen.";
        renderLogin(); return;
      }
      if (mode === "reset") {
        const p1 = form.password.value, p2 = form.password2.value;
        if (p1 !== p2) {
          authError = "Die Passwörter stimmen nicht überein.";
          btn.disabled = false; btn.textContent = orig; renderResetPassword(); return;
        }
        await DB.updatePassword(p1);
        recoveryMode = false;
        try { await DB.signOut(); } catch (e) {}
        if (window.history && window.history.replaceState) {
          window.history.replaceState(null, "", window.location.pathname);
        }
        authMode = "login"; authError = "";
        authInfo = "Passwort geändert. Du kannst dich jetzt anmelden.";
        renderLogin(); return;
      }
    } catch (err) {
      authError = authErrorText((err && err.message) || String(err));
      authInfo = "";
      btn.disabled = false; btn.textContent = orig;
      if (mode === "reset") renderResetPassword(); else renderLogin();
    }
  });

  /* ===========================================================================
     START: Sitzung prüfen -> Login ODER App laden
     =========================================================================== */
  // Ein hängender await (z. B. Netzwerk nach Resume aus PayPal) wirft sonst NIE -> Reject erzwingen.
  function withTimeout(promise, ms, label) {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error((label || "Anfrage") + " – Zeitüberschreitung. Bitte Internetverbindung prüfen und neu laden.")), ms);
      Promise.resolve(promise).then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
    });
  }
  async function init() {
    const hideSplash = () => { try { window.__hideSplash && window.__hideSplash(); } catch (e) {} };
    // App über einen Passwort-Reset-Link geöffnet? -> direkt neues Passwort setzen.
    if (recoveryMode || window.location.hash.indexOf("type=recovery") !== -1) {
      recoveryMode = true;
      renderResetPassword();
      boot("ui:recovery");
      hideSplash();
      return;
    }
    document.body.classList.remove("auth-mode");
    viewEl.innerHTML = `<div class="empty" id="__skeleton">Lädt …</div>`;   // Marker behalten, bis eine echte Ansicht rendert

    let session = null;
    try { session = await withTimeout(DB.getSession(), 8000, "Sitzung laden"); boot("session:" + (session ? "ok" : "none")); } catch (e) { session = null; boot("session:fail (" + ((e && e.message) || e) + ")"); }
    if (!session) { renderLogin(); boot("ui:login"); hideSplash(); return; }

    try {
      DEMO = await withTimeout(DB.loadAll(), 15000, "Daten laden");
      boot("loadAll:ok");
      playerById = Object.fromEntries(DEMO.players.map((p) => [p.id, p]));
      katById    = Object.fromEntries(DEMO.katalog.map((k) => [k.id, k]));
      buildStateFromData();
      currentUserId = session.user.id;
      currentProfile = await DB.loadProfile(session.user.id);
      if (!currentProfile) currentProfile = { email: session.user.email, role: "player", player_id: null };
      if (!currentProfile.email) currentProfile.email = session.user.email;
      try { Roles.set(await DB.myRoles()); } catch (e) { Roles.set([]); }

      if (!currentProfile.player_id) { renderPlayerLink(); boot("ui:playerlink"); hideSplash(); return; }

      state.currentPlayerId = currentProfile.player_id;
      fillIdentity();
      syncHeaderHeight();
      render();
      boot("render:ok");
      hideSplash();
      tvRouteInitialHash();   // Deep-Link #lineup=<id> direkt öffnen (nach dem ersten Render)
    } catch (err) {
      boot("boot:error (" + ((err && err.message) || err) + ")");
      document.body.classList.remove("auth-mode");
      viewEl.innerHTML = `<div style="margin:20px;padding:18px;border:2px solid #c0392b;border-radius:12px;background:#fff;color:#7a1d14;font:12px/1.6 monospace;white-space:pre-wrap">Fehler beim Laden der App:\n\n${esc((err && err.message) || String(err))}\n\n${esc((err && err.stack) ? err.stack : "")}</div>`;
      hideSplash();
    }
  }

  // App über Passwort-Reset-Link geöffnet? (Supabase meldet PASSWORD_RECOVERY)
  DB.onPasswordRecovery(() => { recoveryMode = true; renderResetPassword(); try { window.__hideSplash && window.__hideSplash(); } catch (e) {} });

  init();
  // Boot-Watchdog + Diagnose-Seite liegen jetzt INLINE in index.html (laufen auch, wenn app.js gar nicht lädt).
})();
