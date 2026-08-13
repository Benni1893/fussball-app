/* ===========================================================================
   FC Fasanerie-Nord – Mannschafts-App · Anwendungslogik
   Reines Vanilla-JS. Daten kommen aus Supabase (siehe db.js); Zu-/Absagen und
   der bezahlt-Status werden direkt in der Datenbank gespeichert.
   =========================================================================== */
(function () {
  "use strict";

  // Wandelt ein Date in einen lokalen ISO-Datumsstring (YYYY-MM-DD) um.
  function toISODate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  const HEUTE = toISODate(new Date()); // echtes heutiges Datum

  // PayPal.Me-Link (Betrag wird übergeben). Phase 4: echte Integration/Checkout.
  // Hier später den echten PayPal-Benutzernamen des Vereins eintragen:
  const PAYPAL_ME = "Teamkassefasanerie";
  function paypalMeLink(betrag) {
    const amount = Number(betrag).toFixed(2).replace(".", ","); // z. B. 12,50
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
  function statusInfo(status) {
    if (status === "verletzt")    return { label: "verletzt", cls: "st-red" };
    if (status === "angeschlagen") return { label: "angeschlagen", cls: "st-amber" };
    return null; // fit -> kein Badge
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

  // effektiver Bezahlt-Status (Demo + lokale Änderungen)
  function istBezahlt(strafe) {
    return state.paid[strafe.id] !== undefined ? state.paid[strafe.id] : strafe.bezahlt;
  }
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

  // Offene Gesamtsumme eines Spielers – ebenfalls nur über strafeBetrag.
  function summeOffenSpieler(playerId) {
    return DEMO.strafen
      .filter((s) => s.playerId === playerId && !istBezahlt(s))
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

  function render() {
    stopCountdowns(); // Timer der vorigen Ansicht sauber aufräumen
    if (currentView === "dashboard") renderDashboard();
    else if (currentView === "kalender") renderKalender();
    else if (currentView === "katalog") renderKatalog();
    else if (currentView === "strafen") renderStrafen();
    else if (currentView === "einstellungen") renderEinstellungen();
    else if (currentView === "profil") renderProfil();
    else if (currentView === "lineup") { if (Roles.canManageEvents()) renderLineup(); else renderDashboard(); }
    else if (currentView === "admin") { if (Roles.isAdmin()) renderAdmin(); else renderDashboard(); }
  }

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
  function renderDashboard() {
    const me = playerById[state.currentPlayerId];
    const naechste = DEMO.events.filter((e) => isFuture(e.datum)).sort((a, b) => a.datum.localeCompare(b.datum));
    const naechstes = naechste[0];

    const offene = DEMO.strafen.filter((s) => !istBezahlt(s));
    const offeneGesamt = offene.reduce((sum, s) => sum + strafeBetrag(s), 0);
    const meineOffen = summeOffenSpieler(me.id);

    const naechsteSpiele = naechste.filter((e) => e.typ === "spiel").length;

    // Trainer/Admin: Lazarett + Kader-Status
    const lazarett = DEMO.players
      .filter((p) => p.status && p.status !== "fit")
      .sort((a, b) =>
        (a.status === "verletzt" ? 0 : 1) - (b.status === "verletzt" ? 0 : 1) ||
        nachname(a.name).localeCompare(nachname(b.name), "de"));
    const kaderSort = [...DEMO.players].sort((a, b) => nachname(a.name).localeCompare(nachname(b.name), "de"));

    const trainerHtml = Roles.canManageEvents() ? `
      <div class="grid-2" style="margin-top:8px">
        <div>
          <div class="section-title"><h2>Lazarett</h2></div>
          <div class="card card-pad">
            ${lazarett.length ? lazarett.map((p) => `
              <div class="laz-row">
                <span class="avatar">${initials(p.name)}</span>
                <div style="flex:1;min-width:0">
                  <div style="font-weight:600">${esc(p.name)}${statusBadge(p)}</div>
                  <div style="font-size:.8rem;color:var(--muted)">
                    ${p.statusSince ? "seit " + fmtDay(p.statusSince) + ". " + fmtMon(p.statusSince) : ""}${p.statusUntil ? " · vor. zurück " + fmtDay(p.statusUntil) + ". " + fmtMon(p.statusUntil) : ""}${p.statusNote ? " · " + esc(p.statusNote) : ""}
                  </div>
                </div>
              </div>`).join("") : `<div class="empty" style="padding:14px 0">Alle fit – kein Eintrag</div>`}
          </div>
        </div>
        <div>
          <div class="section-title"><h2>Kader-Status</h2></div>
          <div class="card card-pad kader-status">
            ${kaderSort.map((p) => `
              <div class="ks-row">
                <span class="ks-name">${esc(p.name)}${statusBadge(p)}</span>
                <select class="ks-select" data-status-player="${p.id}">
                  <option value="fit" ${p.status === "fit" ? "selected" : ""}>fit</option>
                  <option value="angeschlagen" ${p.status === "angeschlagen" ? "selected" : ""}>angeschlagen</option>
                  <option value="verletzt" ${p.status === "verletzt" ? "selected" : ""}>verletzt</option>
                </select>
              </div>`).join("")}
          </div>
        </div>
      </div>` : "";

    viewEl.innerHTML = `
      <div class="page-head">
        <h1>Servus, ${esc(me.name.split(" ")[0])}!</h1>
      </div>

      <div class="kpi-grid">
        <div class="kpi">
          <div class="kpi-label">Nächster Termin</div>
          <div class="kpi-value" style="font-size:1.25rem">${naechstes ? fmtLong(naechstes.datum).split(",")[0] + ", " + fmtDay(naechstes.datum) + ". " + fmtMon(naechstes.datum) : "–"}</div>
          <div class="kpi-sub">${naechstes ? esc(eventTitel(naechstes)) + " · " + naechstes.zeit + " Uhr" : "Keine Termine"}</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">Kommende Spiele</div>
          <div class="kpi-value">${naechsteSpiele}</div>
          <div class="kpi-sub">in der Restsaison</div>
        </div>
        <div class="kpi ${meineOffen > 0 ? "is-warn" : ""}">
          <div class="kpi-label">Meine offenen Strafen</div>
          <div class="kpi-value">${euro(meineOffen)}</div>
          <div class="kpi-sub">${meineOffen > 0 ? "bitte begleichen" : "alles bezahlt – top!"}</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">Mannschaftskasse offen</div>
          <div class="kpi-value">${euro(offeneGesamt)}</div>
          <div class="kpi-sub">${offene.length} offene Strafen im Team</div>
        </div>
      </div>

      <div class="grid-2">
        <div>
          <div class="section-title"><h2>Nächste Termine</h2>
            <button class="link-btn" data-goto="kalender">Alle anzeigen →</button></div>
          <div class="event-list">
            ${naechste.slice(0, 4).map((e) => eventCard(e)).join("")}
          </div>
        </div>
        <div>
          <div class="section-title"><h2>Zuletzt verhängte Strafen</h2>
            <button class="link-btn" data-goto="strafen">Konto →</button></div>
          <div class="card card-pad">
            ${[...DEMO.strafen].sort((a,b)=>b.datum.localeCompare(a.datum)).slice(0,5).map((s) => {
              const p = playerById[s.playerId];
              return `<div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--line)">
                <span class="avatar">${initials(p.name)}</span>
                <div style="flex:1;min-width:0">
                  <div style="font-weight:600">${esc(p.name)}${statusBadge(p)}</div>
                  <div style="font-size:.82rem;color:var(--muted)">${esc(vergehenName(s))}</div>
                </div>
                <div style="text-align:right">
                  <div class="amount">${euro(strafeBetrag(s))}</div>
                  <span class="badge ${istBezahlt(s) ? "badge-paid" : "badge-open"}">${istBezahlt(s) ? "bezahlt" : "offen"}</span>
                </div>
              </div>`;
            }).join("")}
          </div>
        </div>
      </div>

      ${trainerHtml}
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
  // Kalender-Icon (mit +) für die Kopfzeile der Kalenderansicht.
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

  function renderKalender() {
    const filters = [
      { k: "alle", label: "Alle" },
      { k: "spiel", label: "Spiele" },
      { k: "training", label: "Trainings" },
      { k: "mannschaftsabend", label: "Abende" },
      { k: "sonstiges", label: "Sonstiges" },
    ];
    const liste = DEMO.events
      .filter((e) => kalFilter === "alle" || e.typ === kalFilter)
      .sort((a, b) => a.datum.localeCompare(b.datum));
    const kommend = liste.filter((e) => isFuture(e.datum));
    const vergangen = liste.filter((e) => !isFuture(e.datum));

    viewEl.innerHTML = `
      <div class="page-head page-head-row">
        <h1>Kalender</h1>
        <div class="kal-actions">
          <button class="kal-icon-btn" data-cal-sheet type="button" aria-label="In meinen Kalender">${ICON_CAL_ADD}</button>
          ${Roles.canManageSchedule() ? `<button class="btn btn-primary btn-termin-new" data-termin-new>+ Termin</button>` : ""}
        </div>
      </div>
      <div class="toolbar">
        ${filters.map((f) => `<button class="chip ${kalFilter === f.k ? "is-active" : ""}" data-filter="${f.k}">${f.label}</button>`).join("")}
      </div>
      ${kommend.length ? `<div class="event-list">${kommend.map((e) => eventCard(e, true)).join("")}</div>`
                       : `<div class="empty">Keine kommenden Termine in dieser Auswahl.</div>`}
      ${vergangen.length ? `
        <div class="section-title" style="margin-top:28px"><h2>Vergangene Termine</h2></div>
        <div class="event-list" style="opacity:.72">${vergangen.map((e) => eventCard(e, false)).join("")}</div>` : ""}
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
    const verwaltung = Roles.canManageSchedule();
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
          <button class="set-logout-link" data-logout>Abmelden</button>
          <div class="set-row"><span class="set-label">E-Mail</span><span class="set-val">${esc(email)}</span></div>
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
    `;
  }

  /* ---------- Profil (Spieler-Tab): eigener Fitnessstatus ------------------- */
  function renderProfil() {
    document.body.classList.remove("auth-mode");
    const u = currentProfile || {};
    const player = u.player_id ? playerById[u.player_id] : null;
    const name = player ? player.name : (u.email || "—");
    const roleText = Roles.list.length ? Roles.list.map((r) => ROLE_LABEL[r] || r).join(" · ") : "Spieler";
    const st = player ? (player.status || "fit") : null;
    const opt = (val, label) => `<button class="chip st-choice ${st === val ? "is-on st-" + val : ""}" data-my-status="${val}">${label}</button>`;
    viewEl.innerHTML = `
      <div class="page-head"><h1>Profil</h1></div>
      <div class="set-greeting">
        <div class="set-greet-name">${esc(name)}</div>
        <div class="set-greet-role">${esc(roleText)}</div>
      </div>
      ${player ? `
      <div class="set-section">
        <div class="section-title"><h2>Mein Fitnessstatus</h2></div>
        <div class="card card-pad">
          <p class="set-hint">Sag dem Trainerteam, wie es dir geht.</p>
          <div class="status-choose">
            ${opt("fit", "fit")}${opt("angeschlagen", "angeschlagen")}${opt("verletzt", "verletzt")}
          </div>
        </div>
      </div>` : `<div class="empty" style="padding:24px 0">Dein Konto ist noch keinem Spieler zugeordnet. Melde dich beim Trainerteam.</div>`}
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

  function eventTitel(e) {
    if (e.typ === "spiel") return e.gegner ? paarungText(e) : e.titel;
    return e.titel;
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

  function eventCard(e, withRsvp = true) {
    const tagMap = {
      spiel:            ``,  // kein "Spiel"-Label – die Paarung macht den Typ ohnehin klar
      training:         `<span class="tag tag-training">Training</span>`,
      mannschaftsabend: `<span class="tag tag-mannschaftsabend">Mannschaftsabend</span>`,
      sonstiges:        ``,  // freier Titel steht ohnehin da
    };
    // Heim/Auswärts wird NICHT mehr als Text-Tag gezeigt, sondern als Farbbalken
    // links an der Kachel (Klassen is-home / is-away).
    const heimCls = e.typ === "spiel"
      ? (e.heim === true ? " is-home" : e.heim === false ? " is-away" : "")
      : "";
    const titel = (e.typ === "spiel" && e.gegner)
      ? (() => { const p = paarung(e); return `${p.home} <span class="vs">–</span> ${p.away}`; })()
      : esc(e.titel);

    // RSVP-Zähler
    const zusagen = DEMO.players.filter((p) => (state.rsvp[e.id + "|" + p.id] || {}).status === "zu").length;
    const r = state.rsvp[e.id + "|" + state.currentPlayerId] || {};
    const future = isFuture(e.datum);
    const cancelled = e.status === "abgesagt";
    const friendlyTag = (e.typ === "spiel" && e.wettbewerb && /freundschaft/i.test(e.wettbewerb))
      ? `<span class="tag tag-friendly">Freundschaft</span>` : "";
    const cancelledTag = cancelled ? `<span class="tag tag-cancelled">Abgesagt</span>` : "";

    // BFV: manuell geändert + Drift-Hinweis
    const istBfv = e.quelle === "bfv";
    const mb = e.manuellBearbeitet || {}, bn = e.bfvNeu || {};
    const manuellTag = (istBfv && (mb.start || mb.ort)) ? `<span class="tag tag-manuell">manuell geändert</span>` : "";
    const bfvBlock = (istBfv && Roles.canManageSchedule()) ? (() => {
      const parts = [];
      if (bn.date || bn.time) {
        const t = bn.time || e.zeit || "";
        const dd = bn.date ? ddmm(bn.date) + " " : "";
        parts.push(`<div class="bfv-drift">BFV meldet abweichende Zeit: ${esc(dd + t)} <button class="link-btn" data-bfv-take="${e.id}" data-take-group="start">BFV-Wert übernehmen</button></div>`);
      }
      if (bn.location_raw) {
        parts.push(`<div class="bfv-drift">BFV meldet abweichende Adresse. <button class="link-btn" data-bfv-take="${e.id}" data-take-group="ort">BFV-Wert übernehmen</button></div>`);
      }
      if (mb.start || mb.ort) {
        parts.push(`<button class="link-btn bfv-reset" data-bfv-reset="${e.id}">Zurücksetzen auf BFV-Daten</button>`);
      }
      return parts.length ? `<div class="e-bfv">${parts.join("")}</div>` : "";
    })() : "";

    // Meldeschluss-Hinweis/Countdown (nur Spiele & Trainings mit aktiver Automatik)
    let fristHtml = "";
    if (future && e.auto !== false && (e.typ === "spiel" || e.typ === "training")) {
      const dl = meldeschlussMs(e);
      const start = eventStartMs(e);
      const now = Date.now();
      if (dl != null && now < dl) {
        fristHtml = `<div class="frist"><span class="frist-label">Meldeschluss:</span> <span class="cd" data-cd-deadline="${new Date(dl).toISOString()}"></span></div>`;
      } else if (start != null && now < start) {
        const noResp = e.typ === "spiel" ? "25 €" : "15 €";
        fristHtml = `<div class="frist frist-warn">Meldeschluss vorbei – Rückmeldung jetzt kostet 8 €, keine Rückmeldung ${noResp}.</div>`;
      }
    }

    // Zusagen-Zahlen nur fuer Trainer/Admin. Spieler sehen nur ihren eigenen Status.
    const showCount = Roles.canManageEvents();
    let rsvpHtml = "";
    if (cancelled) {
      rsvpHtml = `<div class="rsvp"><span class="rsvp-cancelled">Abgesagt</span></div>`;
    } else if (withRsvp && future) {
      rsvpHtml = `
        <div class="rsvp">
          <div class="rsvp-buttons">
            <button class="btn btn-zu ${r.status === "zu" ? "is-on" : ""}" data-rsvp="zu" data-event="${e.id}">Zusage</button>
            <button class="btn btn-ab ${r.status === "ab" ? "is-on" : ""}" data-rsvp="ab" data-event="${e.id}">Absage</button>
          </div>
          ${showCount ? `<div class="rsvp-count"><b>${zusagen}</b> / ${DEMO.players.length} zugesagt</div>` : ""}
          ${r.status === "ab" && r.grund ? `<div class="rsvp-reason">Grund: ${esc(r.grund)}</div>` : ""}
        </div>`;
    } else if (showCount) {
      rsvpHtml = `<div class="rsvp"><div class="rsvp-count"><b>${zusagen}</b> / ${DEMO.players.length} dabei</div></div>`;
    }

    const venue = venueHtml(e);
    return `
      <div class="event typ-${e.typ}${heimCls}${cancelled ? " is-cancelled" : ""}">
        <div class="event-date">
          <span class="d-wd">${fmtWd(e.datum)}</span>
          <span class="d-day">${fmtDay(e.datum)}</span>
          <span class="d-mon">${fmtMon(e.datum)}</span>
        </div>
        <div class="event-main">
          <div class="e-title">${titel} ${tagMap[e.typ] || ""} ${friendlyTag} ${cancelledTag} ${manuellTag}</div>
          ${e.zeit ? `<div class="e-time">${e.zeit}${e.ende ? "&#8211;" + esc(e.ende) : ""} Uhr</div>` : ""}
          ${venue ? `<div class="e-meta">${venue}</div>` : ""}
          ${e.note ? `<div class="e-note">${esc(e.note)}</div>` : ""}
          ${fristHtml}
          ${bfvBlock}
          ${(() => {
            const acts = [];
            if (e.typ === "spiel" && Roles.canManageEvents())
              acts.push(`<button class="btn btn-soft" data-kader-info="${e.id}">Kader-Info erstellen</button>`);
            // Trainer/Kassenwart/Admin: jeden Termin bearbeiten (auch BFV-Spiele).
            if (Roles.canManageSchedule())
              acts.push(`<button class="icon-btn" title="Termin bearbeiten" aria-label="Termin bearbeiten" data-termin-edit="${e.id}">${ICON_PENCIL}</button>`);
            return acts.length ? `<div class="e-trainer">${acts.join("")}</div>` : "";
          })()}
        </div>
        ${rsvpHtml}
      </div>`;
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
              <option value="mannschaftsabend">Mannschaftsabend</option>
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
      return { modus: "aufstellung", startelf: startelf, bank: bank, dabei: startelf };
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
    const namen = (arr) => arr.map((p) => p.name).join(", ");

    const zeilen = [];
    zeilen.push(`Kader für ${wt}, ${e.zeit} Uhr, ${spielTyp}${ort}.`);
    if (e.note) zeilen.push(e.note + (/[.!?]$/.test(e.note) ? "" : "."));

    const q = kaderQuelle(e);
    if (q.modus === "aufstellung") {
      zeilen.push(`Startelf: ${namen(q.startelf) || "–"}.`);
      if (q.bank.length) zeilen.push(`Bank: ${namen(q.bank)}.`);
    } else {
      zeilen.push(q.dabei.length ? `Es spielen: ${namen(q.dabei)}.` : `Es haben noch keine Spieler zugesagt.`);
    }
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
    ov.querySelector("[data-wa]").addEventListener("click", () => {
      window.open("https://wa.me/?text=" + encodeURIComponent(ta.value), "_blank", "noopener");
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
      { key:"TW", role:"TW", x:50, y:92 },
      { key:"LV", role:"AV", x:16, y:74 }, { key:"LIV", role:"IV", x:38, y:78 }, { key:"RIV", role:"IV", x:62, y:78 }, { key:"RV", role:"AV", x:84, y:74 },
      { key:"LM", role:"ZM", x:16, y:50 }, { key:"LZM", role:"ZM", x:38, y:52 }, { key:"RZM", role:"ZM", x:62, y:52 }, { key:"RM", role:"ZM", x:84, y:50 },
      { key:"LST", role:"ST", x:36, y:22 }, { key:"RST", role:"ST", x:64, y:22 },
    ],
    "4-3-3": [
      { key:"TW", role:"TW", x:50, y:92 },
      { key:"LV", role:"AV", x:16, y:74 }, { key:"LIV", role:"IV", x:38, y:78 }, { key:"RIV", role:"IV", x:62, y:78 }, { key:"RV", role:"AV", x:84, y:74 },
      { key:"LZM", role:"ZM", x:30, y:54 }, { key:"ZM", role:"ZM", x:50, y:58 }, { key:"RZM", role:"ZM", x:70, y:54 },
      { key:"LA", role:"OM", x:18, y:26 }, { key:"ST", role:"ST", x:50, y:18 }, { key:"RA", role:"OM", x:82, y:26 },
    ],
    "4-2-3-1": [
      { key:"TW", role:"TW", x:50, y:92 },
      { key:"LV", role:"AV", x:16, y:76 }, { key:"LIV", role:"IV", x:38, y:80 }, { key:"RIV", role:"IV", x:62, y:80 }, { key:"RV", role:"AV", x:84, y:76 },
      { key:"LDM", role:"ZM", x:38, y:60 }, { key:"RDM", role:"ZM", x:62, y:60 },
      { key:"LOM", role:"OM", x:20, y:38 }, { key:"ZOM", role:"OM", x:50, y:40 }, { key:"ROM", role:"OM", x:80, y:38 },
      { key:"ST", role:"ST", x:50, y:18 },
    ],
    "3-5-2": [
      { key:"TW", role:"TW", x:50, y:92 },
      { key:"LIV", role:"IV", x:28, y:78 }, { key:"CIV", role:"IV", x:50, y:80 }, { key:"RIV", role:"IV", x:72, y:78 },
      { key:"LM", role:"AV", x:12, y:52 }, { key:"LZM", role:"ZM", x:34, y:56 }, { key:"ZM", role:"ZM", x:50, y:58 }, { key:"RZM", role:"ZM", x:66, y:56 }, { key:"RM", role:"AV", x:88, y:52 },
      { key:"LST", role:"ST", x:38, y:22 }, { key:"RST", role:"ST", x:62, y:22 },
    ],
  };

  let lb = { eventId: null, lineupId: null, name: "", formation: "4-4-2", assign: {}, sel: null, gaps: [], msg: "" };
  let lbDrag = null;

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
            ? `<div class="field-pl${mism ? " is-mismatch" : ""}" draggable="true" data-slot-player="${s.key}" title="${mism ? "Position passt nicht: " + p.pos + " auf " + s.role : esc(p.name)}">
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
      return;
    }
    const varianten = (DEMO.lineups || []).filter((l) => l.eventId === lb.eventId && !l.isTemplate);
    const vorlagen  = (DEMO.lineups || []).filter((l) => l.isTemplate);
    const aktiv     = varianten.find((l) => l.isActive);
    const istAktiv  = aktiv && aktiv.id === lb.lineupId;

    const placed = new Set(Object.values(lb.assign).filter(Boolean));
    const verletztIds = new Set(DEMO.players.filter((p) => p.status === "verletzt").map((p) => p.id));
    const frei = DEMO.players.filter((p) => !verletztIds.has(p.id) && !placed.has(p.id));
    const zu = (p) => (state.rsvp[lb.eventId + "|" + p.id] || {}).status === "zu";
    const bank    = frei.filter(zu).sort(byName);
    const weitere = frei.filter((p) => !zu(p)).sort(byName);
    const lazarett = DEMO.players.filter((p) => p.status === "verletzt" && !placed.has(p.id)).sort(byName);

    const evOpt = spiele.map((e) =>
      `<option value="${e.id}" ${e.id === lb.eventId ? "selected" : ""}>${fmtDay(e.datum)}. ${fmtMon(e.datum)} · ${e.heim ? "vs." : "@"} ${esc(e.gegner || e.titel)}</option>`).join("");
    const formOpt = Object.keys(FORMATIONS).map((f) =>
      `<option value="${f}" ${f === lb.formation ? "selected" : ""}>${f}</option>`).join("");
    const varOpt = `<option value="new" ${!lb.lineupId ? "selected" : ""}>Neue Aufstellung</option>` +
      varianten.map((l) => `<option value="${l.id}" ${l.id === lb.lineupId ? "selected" : ""}>${esc(l.name)}${l.isActive ? " (aktiv)" : ""}</option>`).join("");
    const tplOpt = `<option value="">Vorlage wählen …</option>` +
      vorlagen.map((l) => `<option value="${l.id}">${esc(l.name)} (${l.formation})</option>`).join("");

    viewEl.innerHTML = `
      <div class="page-head"><h1>Aufstellung</h1>
        <p>Team per Ziehen (Maus) oder Tippen (Handy) aufstellen. ${istAktiv ? '<span class="lu-activebadge">aktiv</span>' : ""}</p></div>

      <div class="lu-controls card card-pad">
        <div class="lu-row">
          <label>Spiel <select class="lu-select" data-lu-event>${evOpt}</select></label>
          <label>Formation <select class="lu-select" data-lu-formation>${formOpt}</select></label>
          <label>Variante <select class="lu-select" data-lu-variant>${varOpt}</select></label>
        </div>
        <div class="lu-row">
          <input class="lu-name" data-lu-name type="text" placeholder="Name der Variante (z. B. „Plan B ohne Lukas")" value="${esc(lb.name)}">
          <button class="btn btn-primary" data-lu-save>Speichern</button>
          <button class="btn" data-lu-active>${istAktiv ? "Aktiv" : "Aktiv setzen"}</button>
          <button class="btn" data-lu-tplsave>Als Vorlage</button>
          <button class="btn btn-danger" data-lu-delete>Löschen</button>
        </div>
        <div class="lu-row">
          <label>Vorlage anwenden <select class="lu-select" data-lu-template>${tplOpt}</select></label>
          <button class="btn btn-soft" data-lu-apply>Anwenden</button>
          ${lb.msg ? `<span class="lu-msg">${esc(lb.msg)}</span>` : ""}
        </div>
      </div>

      <div class="lu-main">
        <div class="lu-pitch-wrap">${renderPitch(lb.formation, lb.assign)}</div>
        <div class="lu-side">
          <div class="lu-group">
            <h3>Bank · Zusagen <span class="lu-count">${bank.length}</span></h3>
            <div class="pl-pool" data-bank-drop>
              ${bank.length ? bank.map((p) => poolChip(p)).join("") : '<div class="pl-empty">Alle Zusagen sind aufgestellt</div>'}
            </div>
          </div>
          <details class="lu-group">
            <summary>Ohne Rückmeldung / abgesagt <span class="lu-count">${weitere.length}</span></summary>
            <div class="pl-pool">${weitere.length ? weitere.map((p) => poolChip(p)).join("") : '<div class="pl-empty">–</div>'}</div>
          </details>
          ${lazarett.length ? `<div class="lu-group">
            <h3>Verletzt <span class="lu-count">${lazarett.length}</span></h3>
            <div class="pl-pool">${lazarett.map((p) => poolChip(p, { injured: true })).join("")}</div>
          </div>` : ""}
        </div>
      </div>
    `;
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

  // --- Tippen-zum-Zuweisen ----------------------------------------------------
  function lbTapPool(id) {
    if (!id) return;
    lb.sel = (lb.sel && lb.sel.kind === "pool" && lb.sel.id === id) ? null : { kind: "pool", id: id };
    renderLineup();
  }
  function lbTapSlot(key) {
    if (lb.sel) {
      if (lb.sel.kind === "pool") lbPlace(key, lb.sel.id);
      else if (lb.sel.kind === "slot") lbSwap(lb.sel.key, key);
      lb.sel = null;
    } else if (lb.assign[key]) {
      lb.sel = { kind: "slot", key: key };
    }
    renderLineup();
  }
  function lbTapBank() {
    if (lb.sel && lb.sel.kind === "slot") lbRemove(lb.sel.key);
    lb.sel = null;
    renderLineup();
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
  function lbChangeFormation(val) {
    const placed = [];
    (FORMATIONS[lb.formation] || []).forEach((s) => { if (lb.assign[s.key]) placed.push(lb.assign[s.key]); });
    lb.formation = val;
    lb.assign = {}; lb.gaps = [];
    (FORMATIONS[val] || []).forEach((s, i) => { if (i < placed.length) lb.assign[s.key] = placed[i]; });
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
    const nameEl = viewEl.querySelector("[data-lu-name]");
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
    const nameEl = viewEl.querySelector("[data-lu-name]");
    let nm = window.prompt("Name der Vorlage:", ((nameEl ? nameEl.value : lb.name) || "").trim() || "Vorlage");
    if (nm === null) return;
    try {
      await DB.saveLineup({ clubId: DEMO.clubId, eventId: null, name: (nm.trim() || "Vorlage"),
        formation: lb.formation, slots: cleanAssign(lb.assign), bank: [], isTemplate: true });
      lb.msg = "Als Vorlage gespeichert."; await reloadData();
    } catch (err) { window.alert("Vorlage speichern fehlgeschlagen: " + ((err && err.message) || err)); }
  }
  function lbApplyTemplate() {
    const sel = viewEl.querySelector("[data-lu-template]");
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
      if (pl && pl.status !== "verletzt" && zuSet.has(pid)) lb.assign[s.key] = pid;
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

  /* ---------- Strafenkatalog ------------------------------------------------ */
  const SVG = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
  const ICON_EDIT  = `<svg ${SVG}><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>`;
  const ICON_TRASH = `<svg ${SVG}><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"/></svg>`;
  const ICON_CHECK = `<svg ${SVG}><path d="M20 6 9 17l-5-5"/></svg>`;
  const ICON_X     = `<svg ${SVG}><path d="M18 6 6 18M6 6l12 12"/></svg>`;
  const ICON_PLUS  = `<svg ${SVG}><path d="M12 5v14M5 12h14"/></svg>`;

  let katEdit = null; // null | Katalog-id (Bearbeiten) | "new" (Hinzufügen)

  function katRowView(k, canEdit) {
    return `<div class="kat-item">
      <span class="kat-name">${esc(k.vergehen)}</span>
      <span class="kat-amount">${euro(k.betrag)}</span>
      ${canEdit ? `<div class="kat-actions">
        <button class="icon-btn" data-kat-edit="${k.id}" aria-label="Bearbeiten">${ICON_EDIT}</button>
        <button class="icon-btn" data-kat-del="${k.id}" aria-label="Löschen">${ICON_TRASH}</button>
      </div>` : ""}
    </div>`;
  }
  function katRowEdit(id, name, betrag) {
    const amt = (betrag != null) ? String(betrag).replace(".", ",") : "";
    return `<div class="kat-item kat-edit">
      <input class="kat-in kat-in-name" data-kat-input="name" type="text" placeholder="Bezeichnung" value="${esc(name)}">
      <div class="kat-edit-row2">
        <input class="kat-in kat-in-amount" data-kat-input="amount" type="text" inputmode="decimal" placeholder="Betrag" value="${esc(amt)}">
        <span class="kat-eur">€</span>
        <button class="icon-btn icon-ok" data-kat-save="${id}" aria-label="Speichern">${ICON_CHECK}</button>
        <button class="icon-btn" data-kat-cancel aria-label="Abbrechen">${ICON_X}</button>
      </div>
    </div>`;
  }
  function renderKatalog() {
    const canEdit = Roles.canEditCatalog();
    viewEl.innerHTML = `
      <div class="page-head"><h1>Strafenkatalog</h1></div>
      <div class="kat-list">
        ${DEMO.katalog.map((k) => katEdit === k.id
          ? katRowEdit(k.id, k.vergehen, k.betrag)
          : katRowView(k, canEdit)).join("")}
        ${katEdit === "new" ? katRowEdit("new", "", null) : ""}
      </div>
      ${canEdit && katEdit !== "new" ? `<button class="kat-add" data-kat-add>${ICON_PLUS}<span>Strafe hinzufügen</span></button>` : ""}
    `;
    const nameInput = viewEl.querySelector(".kat-in-name");
    if (nameInput) nameInput.focus();
  }

  /* ---------- Strafen-Konto ------------------------------------------------- */
  let strafenFilter = "offen"; // offen | bezahlt | alle | meine

  function renderStrafen() {
    const me = playerById[state.currentPlayerId];
    // Ist das eingeloggte Konto wirklich mit einem Spieler verknüpft?
    // Nur dann zeigen wir „Dein Konto" + die Bezahl-/Selbstmeldungs-Buttons –
    // sonst würde ein Fallback-Spieler fälschlich als „du" erscheinen.
    const linked = !!(currentProfile && currentProfile.player_id && me);
    // „Als bezahlt" nur für Kassenwart/Admin (UI-Komfort; echte Sperre = RLS)
    const canPay = Roles.canManageFines();

    const alle = DEMO.strafen.map((s) => ({
      ...s,
      betrag: strafeBetrag(s),
      bezahlt: istBezahlt(s),
      player: playerById[s.playerId],
      kat: katById[s.katalogId],
    }));

    const offenGesamt   = alle.filter((s) => !s.bezahlt).reduce((a, s) => a + s.betrag, 0);
    const bezahltGesamt = alle.filter((s) =>  s.bezahlt).reduce((a, s) => a + s.betrag, 0);
    const meineOffen    = linked ? summeOffenSpieler(me.id) : 0;
    const meineGesamt   = linked ? alle.filter((s) => s.playerId === me.id).reduce((a, s) => a + s.betrag, 0) : 0;
    const meinZuschlag  = linked ? alle.filter((s) => s.playerId === me.id && !s.bezahlt).reduce((a, s) => a + zuschlagBetrag(s), 0) : 0;

    // Für den Banner: meine offene Strafe mit der KÜRZESTEN Restzeit (nicht gedeckelt).
    let bannerCd = null;
    if (linked) {
      const jetzt = Date.now();
      alle.filter((s) => s.playerId === me.id && !s.bezahlt).forEach((s) => {
        const info = mahnCountdown(s, jetzt);
        if (info.capped) return;
        if (bannerCd === null || info.remMs < bannerCd.remMs) {
          bannerCd = { remMs: info.remMs, createdAt: s.createdAt };
        }
      });
    }

    let gefiltert = alle;
    if (strafenFilter === "offen")   gefiltert = alle.filter((s) => !s.bezahlt);
    if (strafenFilter === "bezahlt") gefiltert = alle.filter((s) =>  s.bezahlt);
    if (strafenFilter === "selbst")  gefiltert = alle.filter((s) =>  s.bezahlt && s.selfReported);
    if (strafenFilter === "meine")   gefiltert = linked ? alle.filter((s) => s.playerId === me.id) : [];
    gefiltert.sort((a, b) => Number(a.bezahlt) - Number(b.bezahlt) || b.datum.localeCompare(a.datum));

    const filters = [
      { k: "offen",   label: "Offen" },
      { k: "bezahlt", label: "Beglichen" },
      { k: "selbst",  label: "Selbst gemeldet" },
      { k: "meine",   label: "Meine Strafen" },
      { k: "alle",    label: "Alle" },
    ];

    /* --- Daten für die Diagramme ------------------------------------------ */
    const gesamt = offenGesamt + bezahltGesamt;
    const pctBezahlt = gesamt ? Math.round((bezahltGesamt / gesamt) * 100) : 0;
    const donut = donutChart(
      [{ value: bezahltGesamt, color: "#d4af37" }, { value: offenGesamt, color: "#c0392b" }],
      { centerTop: pctBezahlt + "%", centerBottom: "bezahlt" }
    );

    // Top-Beitragende (Summe je Spieler, aufgeteilt in bezahlt/offen)
    const perPlayer = {};
    alle.forEach((s) => {
      const id = s.player.id;
      if (!perPlayer[id]) perPlayer[id] = { name: s.player.name, total: 0, offen: 0 };
      perPlayer[id].total += s.betrag;
      if (!s.bezahlt) perPlayer[id].offen += s.betrag;
    });
    const top = Object.values(perPlayer).sort((a, b) => b.total - a.total).slice(0, 6);
    const maxTotal = Math.max(...top.map((t) => t.total), 1);
    const barsHtml = top.map((t) => {
      const widthPct = Math.max(8, Math.round((t.total / maxTotal) * 100));
      const paidShare = t.total ? ((t.total - t.offen) / t.total) * 100 : 0;
      const openShare = t.total ? (t.offen / t.total) * 100 : 0;
      return `
        <div class="bar-row">
          <div class="bar-head"><span>${esc(t.name)}</span><b>${euro(t.total)}</b></div>
          <div class="bar-track">
            <div class="bar-fill" style="width:${widthPct}%">
              <span class="seg seg-paid" style="width:${paidShare}%"></span><span class="seg seg-open" style="width:${openShare}%"></span>
            </div>
          </div>
          <div class="bar-sub">${t.offen > 0 ? euro(t.offen) + " offen" : "alles bezahlt"}</div>
        </div>`;
    }).join("");

    const chartRow = `
      <div class="grid-2 chart-row">
        <div class="card card-pad chart-card">
          <div class="chart-title">Bezahlt vs. Offen</div>
          <div class="donut-wrap">
            ${donut}
            <ul class="chart-legend">
              <li><span class="lg-dot" style="background:#d4af37"></span>Bezahlt <b>${euro(bezahltGesamt)}</b></li>
              <li><span class="lg-dot" style="background:#c0392b"></span>Offen <b>${euro(offenGesamt)}</b></li>
              <li><span class="lg-dot" style="background:#eef2ef"></span>Gesamt <b>${euro(gesamt)}</b></li>
            </ul>
          </div>
        </div>
        <div class="card card-pad chart-card">
          <div class="chart-title">Top-Beitragende zur Kasse</div>
          <div class="bars">${barsHtml || '<div class="empty">Keine Daten</div>'}</div>
          <div class="bars-legend">
            <span><span class="lg-dot" style="background:#d4af37"></span>bezahlt</span>
            <span><span class="lg-dot" style="background:#c0392b"></span>offen</span>
          </div>
        </div>
      </div>`;

    viewEl.innerHTML = `
      <div class="page-head">
        <h1>Strafen-Konto</h1>
      </div>

      ${!linked ? `
      <div class="mine-banner">
        <div class="mb-top">
          <span class="mb-label">Dein Konto</span>
          <span class="mb-state">Noch keinem Spieler zugeordnet</span>
        </div>
        <div class="mb-note">Bitte einen Trainer/Admin um die Zuordnung – danach siehst du hier deine Strafen.</div>
      </div>
      ` : `
      <div class="mine-banner">
        <div class="mb-top">
          <span class="mb-label">Dein Konto · ${esc(me.name)}</span>
          <span class="mb-state">${meineOffen > 0 ? "Du hast noch offene Strafen" : "Du bist schuldenfrei"}</span>
        </div>
        <div class="mb-figure">
          <span class="mb-value">${euro(meineOffen)}</span>
          <span class="mb-sub">offen · ${euro(meineGesamt)} gesamt</span>
        </div>
        ${meinZuschlag > 0 ? `<div class="mb-note">inkl. ${euro(meinZuschlag)} Mahnzuschlag</div>` : ""}
        ${bannerCd ? `<div class="mb-countdown">
          <span class="mb-cd-label">Nächste Erhöhung in</span>
          <span class="cd" data-cd-created="${bannerCd.createdAt}" data-cd-step="${faelligeStufen({ createdAt: bannerCd.createdAt }, Date.now())}"></span>
        </div>` : ""}
        ${meineOffen > 0 ? `<div class="mb-actions">
          <span class="mb-pay-cap">Offenen Betrag begleichen · bitte als „Freunde &amp; Familie" senden</span>
          <button class="paypal-btn" data-paypal="${meineOffen}" aria-label="Mit PayPal bezahlen">
            <svg class="pp-mark" viewBox="0 0 384 512" width="15" height="19" aria-hidden="true">
              <path fill="#003087" d="M111.4 295.9c-3.5 19.2-17.4 108.7-21.5 134-.3 1.8-1 2.5-3 2.5H12.3c-7.6 0-13.1-6.6-12.1-13.9L58.8 46.6c1.5-9.6 10.1-16.9 20-16.9 152.3 0 165.1-3.7 204 11.4 60.1 23.3 65.6 79.5 44 140.3-21.5 62.6-72.5 89.5-140.1 90.3-43.4 .7-69.5-7-75.3 24.2zM357.1 152c-1.8-1.3-2.5-1.8-3 1.3-2 11.4-5.1 22.5-8.8 33.6-39.9 113.8-150.5 103.9-204.5 103.9-6.1 0-10.1 3.3-10.9 9.4-22.6 140.4-27.1 169.7-27.1 169.7-1 7.1 3.5 12.9 10.6 12.9h63.5c8.6 0 15.7-6.3 17.4-14.9 .7-5.4-1.1 6.1 14.4-91.3 4.6-22 14.3-19.7 29.3-19.7 71 0 126.4-28.8 142.9-112.3 6.5-34.8 4.6-71.4-23.3-91.9z"/>
            </svg>
            <span class="pp-word"><span class="pp1">Pay</span><span class="pp2">Pal</span></span>
          </button>
          <button class="paid-self-btn" data-paid-self>Ich habe bezahlt</button>
        </div>` : ""}
      </div>
      `}

      <div class="kpi-grid">
        <div class="kpi is-warn">
          <div class="kpi-label">Offen im Team</div>
          <div class="kpi-value">${euro(offenGesamt)}</div>
          <div class="kpi-sub">${alle.filter((s)=>!s.bezahlt).length} Strafen</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">Bereits beglichen</div>
          <div class="kpi-value">${euro(bezahltGesamt)}</div>
          <div class="kpi-sub">${alle.filter((s)=>s.bezahlt).length} Strafen</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">Kassenstand (Soll)</div>
          <div class="kpi-value">${euro(offenGesamt + bezahltGesamt)}</div>
          <div class="kpi-sub">Gesamtvolumen Saison</div>
        </div>
      </div>

      ${chartRow}

      <div class="toolbar">
        ${filters.map((f) => `<button class="chip ${strafenFilter === f.k ? "is-active" : ""}" data-sfilter="${f.k}">${f.label}</button>`).join("")}
      </div>

      ${gefiltert.length ? `
      <div class="table-wrap">
        <table>
          <thead><tr><th>Spieler</th><th>Vergehen</th><th>Datum</th><th class="num">Betrag</th><th>Status</th><th></th></tr></thead>
          <tbody>
            ${gefiltert.map((s) => `
              <tr>
                <td><div class="player-cell"><span class="avatar">${initials(s.player.name)}</span>${esc(s.player.name)}${statusBadge(s.player)}</div></td>
                <td>${esc(vergehenName(s))}${s.auto ? ` <span class="badge badge-auto">automatisch</span>` : ""}${s.note ? `<div style="font-size:.78rem;color:var(--muted)">${esc(s.note)}</div>` : ""}</td>
                <td style="color:var(--muted);white-space:nowrap">${fmtWd(s.datum)}, ${fmtDay(s.datum)}. ${fmtMon(s.datum)}</td>
                <td class="num amount">${euro(s.betrag)}${
                  zuschlagBetrag(s) > 0 ? `<div class="amt-sub">inkl. ${euro(zuschlagBetrag(s))} Mahnzuschlag</div>` : ""
                }${
                  !s.bezahlt ? `<div class="cd-wrap"><span class="cd" data-cd-created="${s.createdAt}" data-cd-step="${faelligeStufen(s, Date.now())}"></span></div>` : ""
                }</td>
                <td>${!s.bezahlt
                  ? `<span class="badge badge-open">offen</span>`
                  : s.selfReported
                    ? `<span class="badge badge-self">selbst gemeldet</span>${s.paidAt ? `<div style="font-size:.7rem;color:var(--muted)">${fmtTs(s.paidAt)}</div>` : ""}`
                    : `<span class="badge badge-paid">beglichen</span>`}</td>
                <td style="text-align:right;white-space:nowrap">
                  ${canPay ? `<button class="btn" data-toggle-paid="${s.id}">${s.bezahlt ? "Als offen" : "Als bezahlt"}</button>` : ""}
                  ${s.auto && Roles.canDeleteAutoFine() ? `<button class="btn btn-danger" data-del-fine="${s.id}" title="Auto-Strafe entfernen (z. B. entschuldigt)">Entfernen</button>` : ""}
                </td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>` : `<div class="empty">Keine Strafen in dieser Auswahl.</div>`}
    `;

    startCountdowns(); // Live-Timer für alle Countdown-Felder dieser Ansicht
  }

  /* ---------------------------------------------------------------------------
     Interaktion (Event-Delegation)
     --------------------------------------------------------------------------- */
  viewEl.addEventListener("click", async (ev) => {
    // Aufstellungs-Builder zuerst (eigene Tap-/Button-Logik)
    if (currentView === "lineup") {
      const lu = ev.target.closest("[data-player],[data-slot],[data-bank-drop],[data-lu-save],[data-lu-active],[data-lu-tplsave],[data-lu-apply],[data-lu-delete]");
      if (lu) {
        if (lu.hasAttribute("data-player")) lbTapPool(lu.dataset.player);
        else if (lu.hasAttribute("data-slot")) lbTapSlot(lu.dataset.slot);
        else if (lu.hasAttribute("data-bank-drop") && ev.target.closest("[data-slot-player]") == null) lbTapBank();
        else if (lu.hasAttribute("data-lu-save")) lbSave();
        else if (lu.hasAttribute("data-lu-active")) lbActivate();
        else if (lu.hasAttribute("data-lu-tplsave")) lbSaveTemplate();
        else if (lu.hasAttribute("data-lu-apply")) lbApplyTemplate();
        else if (lu.hasAttribute("data-lu-delete")) lbDeleteCurrent();
        return;
      }
    }

    const t = ev.target.closest("[data-rsvp],[data-filter],[data-sfilter],[data-toggle-paid],[data-del-fine],[data-kader-info],[data-sim],[data-kat-edit],[data-kat-del],[data-kat-save],[data-kat-cancel],[data-kat-add],[data-bfv-connect],[data-bfv-change],[data-bfv-cancel],[data-bfv-sync],[data-goto],[data-paypal],[data-auth],[data-pick-player],[data-paid-self],[data-termin-new],[data-termin-edit],[data-bfv-reset],[data-bfv-take],[data-cal-sheet],[data-koord-save],[data-my-status],[data-logout]");
    if (!t) return;

    // Spieler: eigenen Fitnessstatus setzen (RLS/RPC erlauben nur die eigene Zeile)
    if (t.dataset.myStatus) {
      const pid = currentProfile && currentProfile.player_id;
      if (!pid) return;
      try { await DB.setPlayerStatus(pid, t.dataset.myStatus, null, null); await reloadData(); }
      catch (err) { window.alert("Status konnte nicht gesetzt werden: " + ((err && err.message) || err)); }
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
      const nameEl = viewEl.querySelector('[data-kat-input="name"]');
      const amtEl  = viewEl.querySelector('[data-kat-input="amount"]');
      const name = (nameEl ? nameEl.value : "").trim();
      const amount = parseFloat(String(amtEl ? amtEl.value : "").replace(",", ".").replace(/[^0-9.]/g, ""));
      if (!name) { window.alert("Bitte eine Bezeichnung eingeben."); return; }
      if (!isFinite(amount) || amount <= 0) { window.alert("Bitte einen gültigen Betrag größer 0 eingeben."); return; }
      try {
        if (t.dataset.katSave === "new") await DB.insertCatalog(DEMO.clubId, name, amount);
        else await DB.updateCatalog(t.dataset.katSave, name, amount);
        katEdit = null;
        await reloadData();
      } catch (err) { window.alert("Speichern fehlgeschlagen: " + ((err && err.message) || err)); }
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

    // PayPal.Me-Link in neuem Tab öffnen (Betrag wird übergeben). Phase 4: echte Integration.
    if (t.dataset.paypal) {
      window.open(paypalMeLink(t.dataset.paypal), "_blank", "noopener");
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
      if (!window.confirm("Bestätige, dass du den offenen Betrag per PayPal gesendet hast.\n\nDeine offenen Strafen werden dann als bezahlt (selbst gemeldet) markiert.")) return;
      t.disabled = true;
      try {
        await DB.reportMyPayment();
        await reloadData();
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
  function switchView(view) {
    currentView = view;
    // Bereiche im „Mehr"-Menü (Aufstellung/Rollen) markieren den Mehr-Tab als aktiv.
    // Bereiche, die im Admin-„Mehr"-Sheet liegen (dann ist der Mehr-Tab aktiv).
    const sheetViews = ["admin", "einstellungen", "lineup"];
    document.querySelectorAll(".nav-btn").forEach((b) => {
      const active = b.hasAttribute("data-more")
        ? sheetViews.indexOf(view) !== -1
        : (b.dataset.view === view);
      b.classList.toggle("is-active", active);
    });
    window.scrollTo(0, 0);
    render();
  }

  function openMoreSheet()  { const s = document.getElementById("moreSheet"); if (s) s.hidden = false; }
  function closeMoreSheet() { const s = document.getElementById("moreSheet"); if (s) s.hidden = true; }

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
    if (header) {
      document.documentElement.style.setProperty("--header-h", header.offsetHeight + "px");
    }
  }
  window.addEventListener("resize", syncHeaderHeight);
  window.addEventListener("load", syncHeaderHeight);
  window.addEventListener("orientationchange", () => setTimeout(syncHeaderHeight, 200));

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
  function updateGearDot() {
    const dot = document.getElementById("hdrGearDot");
    if (dot) dot.hidden = !Roles.isSimulating();
  }
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
    // Spielplan/BFV: Trainer, Kassenwart oder Admin.
    canManageSchedule() { return this.canManageEvents() || this.canManageFines(); },
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

  // 5. Tab (unten rechts) nach höchster EFFEKTIVER Rolle: Admin „Mehr", Trainer
  // „Trainer" (Aufstellung), Spieler „Profil". Effektiv = inkl. Admin-Vorschau
  // (Simulation ist admin-only und rein Anzeige; die echte Absicherung ist RLS).
  function setupPrimaryNavTab() {
    const btn = document.getElementById("navMore");
    if (!btn) return;
    const roles = Roles.list || [];
    const high = roles.indexOf("admin") !== -1 ? "admin" : roles.indexOf("coach") !== -1 ? "coach" : "player";
    btn.style.display = "";
    if (high === "admin") {
      btn.setAttribute("data-more", ""); btn.removeAttribute("data-view");
      btn.innerHTML = `${ICON_NAV_DOTS}<span class="nav-label">Mehr</span>`;
    } else if (high === "coach") {
      btn.removeAttribute("data-more"); btn.setAttribute("data-view", "lineup");
      btn.innerHTML = `${ICON_NAV_PITCH}<span class="nav-label">Trainer</span>`;
    } else {
      btn.removeAttribute("data-more"); btn.setAttribute("data-view", "profil");
      btn.innerHTML = `${ICON_NAV_PERSON}<span class="nav-label">Profil</span>`;
    }
  }

  // „Angemeldet als …" + Abmelden im Kopfbereich.
  function fillIdentity() {
    // Header trägt keinen Namen/keine Rolle mehr (steht in den Einstellungen).
    // Sheet-Inhalte (nur Admin nutzt das „Mehr"-Sheet – Trainer hat den Trainer-Tab).
    const moreLineup = document.getElementById("moreLineup");
    const moreAdmin  = document.getElementById("moreAdmin");
    if (moreLineup) moreLineup.style.display = Roles.isAdmin() ? "" : "none";
    if (moreAdmin)  moreAdmin.style.display  = Roles.isAdmin() ? "" : "none";
    setupPrimaryNavTab(); // 5. Tab je nach höchster ECHTER Rolle
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
            <input type="email" name="email" autocomplete="email" required></label>
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
          <button class="chip" data-sim="admin">Admin (normal)</button>
        </div>
        <div class="sim-switch-hint">Reine Anzeige-Vorschau – ändert nichts an deinen Rechten oder Daten. Alle Zugriffe bleiben serverseitig per RLS abgesichert.</div>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>Mitglied</th>
          <th style="text-align:center">Trainer</th>
          <th style="text-align:center">Kassenwart</th>
          <th style="text-align:center">Admin</th></tr></thead>
        <tbody>
          ${members.map((m) => {
            const name = nameOf(m);
            return `<tr>
              <td><div class="player-cell"><span class="avatar">${initials(name)}</span>
                <div><div style="font-weight:600">${esc(name)}</div>
                <div style="font-size:.78rem;color:var(--muted)">${esc(m.email || "")}</div></div></div></td>
              ${cell(m, "coach")}${cell(m, "treasurer")}${cell(m, "admin")}
            </tr>`;
          }).join("")}
        </tbody>
      </table></div>
      <p style="color:var(--muted);font-size:.85rem;margin-top:12px">${members.length} Mitglied(er) · Neue erscheinen hier, sobald sie sich registriert haben.</p>`;
  }

  // Status setzen (Trainer/Admin) per Auswahl im Kader-Status.
  viewEl.addEventListener("change", async (ev) => {
    const sel = ev.target.closest("[data-status-player]");
    if (!sel) return;
    const playerId = sel.dataset.statusPlayer;
    const status = sel.value;
    const p = playerById[playerId] || {};
    const prev = p.status || "fit";
    let note = null, until = null;
    if (status !== "fit") {
      note = window.prompt("Notiz (optional, z. B. „Muskelfaserriss“):", p.statusNote || "");
      if (note === null) { sel.value = prev; return; }        // Abbrechen
      const u = window.prompt("Voraussichtliche Rückkehr (optional, JJJJ-MM-TT):", p.statusUntil || "");
      if (u === null) { sel.value = prev; return; }
      until = (u && /^\d{4}-\d{2}-\d{2}$/.test(u.trim())) ? u.trim() : null;
    }
    sel.disabled = true;
    try {
      await DB.setPlayerStatus(playerId, status, note, until);
      await reloadData();
    } catch (err) {
      sel.value = prev;
      window.alert("Status konnte nicht gesetzt werden: " + ((err && err.message) || err));
    } finally {
      sel.disabled = false;
    }
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
  async function init() {
    // App über einen Passwort-Reset-Link geöffnet? -> direkt neues Passwort setzen.
    if (recoveryMode || window.location.hash.indexOf("type=recovery") !== -1) {
      recoveryMode = true;
      renderResetPassword();
      return;
    }
    document.body.classList.remove("auth-mode");
    viewEl.innerHTML = `<div class="empty">Lädt …</div>`;

    let session = null;
    try { session = await DB.getSession(); } catch (e) { session = null; }
    if (!session) { renderLogin(); return; }

    try {
      DEMO = await DB.loadAll();
      playerById = Object.fromEntries(DEMO.players.map((p) => [p.id, p]));
      katById    = Object.fromEntries(DEMO.katalog.map((k) => [k.id, k]));
      buildStateFromData();
      currentUserId = session.user.id;
      currentProfile = await DB.loadProfile(session.user.id);
      if (!currentProfile) currentProfile = { email: session.user.email, role: "player", player_id: null };
      if (!currentProfile.email) currentProfile.email = session.user.email;
      try { Roles.set(await DB.myRoles()); } catch (e) { Roles.set([]); }

      if (!currentProfile.player_id) { renderPlayerLink(); return; }

      state.currentPlayerId = currentProfile.player_id;
      fillIdentity();
      syncHeaderHeight();
      render();
    } catch (err) {
      document.body.classList.remove("auth-mode");
      viewEl.innerHTML = `<div style="margin:20px;padding:18px;border:2px solid #c0392b;border-radius:12px;background:#fff;color:#7a1d14;font:12px/1.6 monospace;white-space:pre-wrap">Fehler beim Laden der App:\n\n${esc((err && err.message) || String(err))}\n\n${esc((err && err.stack) ? err.stack : "")}</div>`;
    }
  }

  // App über Passwort-Reset-Link geöffnet? (Supabase meldet PASSWORD_RECOVERY)
  DB.onPasswordRecovery(() => { recoveryMode = true; renderResetPassword(); });

  init();
})();
