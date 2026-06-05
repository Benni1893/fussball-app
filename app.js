/* ===========================================================================
   FC Fasanerie-Nord – Mannschafts-App · Anwendungslogik
   Reines Vanilla-JS, keine Abhängigkeiten. Zustand wird im localStorage
   gespeichert, damit Ab-/Zusagen und bezahlte Strafen erhalten bleiben.
   =========================================================================== */
(function () {
  "use strict";

  const STORE_KEY = "fcfn_app_state_v2"; // neuer Schlüssel -> startet sauber mit Demo-Daten

  // Wandelt ein Date in einen lokalen ISO-Datumsstring (YYYY-MM-DD) um.
  function toISODate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  const HEUTE = toISODate(new Date()); // echtes heutiges Datum

  // PayPal.Me-Link (Betrag wird übergeben). Phase 4: echte Integration/Checkout.
  // 🔧 Hier später den echten PayPal-Benutzernamen des Vereins eintragen:
  const PAYPAL_ME = "fcfasanerienord";
  function paypalMeLink(betrag) {
    const amount = Number(betrag).toFixed(2).replace(".", ","); // z. B. 12,50
    return `https://paypal.me/${PAYPAL_ME}/${amount}EUR`;
  }

  /* ---------------------------------------------------------------------------
     Zustand laden / speichern
     state = {
       currentPlayerId,
       rsvp:  { "<eventId>|<playerId>": { status:"zu"|"ab", grund? } },
       paid:  { "<strafeId>": true|false }   // Überschreibungen ggü. Demo
     }
     --------------------------------------------------------------------------- */
  function defaultState() {
    const rsvp = {};
    DEMO.rsvpSeed.forEach((r) => {
      rsvp[r.eventId + "|" + r.playerId] = { status: r.status, grund: r.grund || "" };
    });
    const paid = {};
    DEMO.strafen.forEach((s) => { paid[s.id] = s.bezahlt; });
    return { currentPlayerId: DEMO.currentPlayerId, rsvp, paid };
  }

  let state;
  try {
    const raw = localStorage.getItem(STORE_KEY);
    state = raw ? JSON.parse(raw) : defaultState();
  } catch (e) { state = defaultState(); }

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {}
  }

  /* ---------------------------------------------------------------------------
     Hilfsfunktionen
     --------------------------------------------------------------------------- */
  const WT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
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

  const playerById = Object.fromEntries(DEMO.players.map((p) => [p.id, p]));
  const katById    = Object.fromEntries(DEMO.katalog.map((k) => [k.id, k]));

  function initials(name) {
    return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // effektiver Bezahlt-Status (Demo + lokale Änderungen)
  function istBezahlt(strafe) {
    return state.paid[strafe.id] !== undefined ? state.paid[strafe.id] : strafe.bezahlt;
  }
  function strafeBetrag(strafe) { return katById[strafe.katalogId].betrag; }

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
    if (currentView === "dashboard") renderDashboard();
    else if (currentView === "kalender") renderKalender();
    else if (currentView === "katalog") renderKatalog();
    else if (currentView === "strafen") renderStrafen();
  }

  /* ---------- Übersicht ----------------------------------------------------- */
  function renderDashboard() {
    const me = playerById[state.currentPlayerId];
    const naechste = DEMO.events.filter((e) => isFuture(e.datum)).sort((a, b) => a.datum.localeCompare(b.datum));
    const naechstes = naechste[0];

    const offene = DEMO.strafen.filter((s) => !istBezahlt(s));
    const offeneGesamt = offene.reduce((sum, s) => sum + strafeBetrag(s), 0);
    const meineOffen = offene.filter((s) => s.playerId === me.id).reduce((sum, s) => sum + strafeBetrag(s), 0);

    const naechsteSpiele = naechste.filter((e) => e.typ === "spiel").length;

    viewEl.innerHTML = `
      <div class="page-head">
        <h1>Servus, ${esc(me.name.split(" ")[0])}! 👋</h1>
        <p>Hier ist dein Überblick für die ${esc(DEMO.verein.team)} · ${esc(DEMO.verein.saison)}.</p>
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
              const p = playerById[s.playerId]; const k = katById[s.katalogId];
              return `<div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--line)">
                <span class="avatar">${initials(p.name)}</span>
                <div style="flex:1;min-width:0">
                  <div style="font-weight:600">${esc(p.name)}</div>
                  <div style="font-size:.82rem;color:var(--muted)">${esc(k.vergehen)}</div>
                </div>
                <div style="text-align:right">
                  <div class="amount">${euro(k.betrag)}</div>
                  <span class="badge ${istBezahlt(s) ? "badge-paid" : "badge-open"}">${istBezahlt(s) ? "bezahlt" : "offen"}</span>
                </div>
              </div>`;
            }).join("")}
          </div>
        </div>
      </div>
    `;
  }

  /* ---------- Kalender ------------------------------------------------------ */
  let kalFilter = "alle";

  function renderKalender() {
    const filters = [
      { k: "alle", label: "Alle" },
      { k: "spiel", label: "⚽ Spiele" },
      { k: "training", label: "🏃 Trainings" },
      { k: "event", label: "🎉 Team-Events" },
    ];
    const liste = DEMO.events
      .filter((e) => kalFilter === "alle" || e.typ === kalFilter)
      .sort((a, b) => a.datum.localeCompare(b.datum));
    const kommend = liste.filter((e) => isFuture(e.datum));
    const vergangen = liste.filter((e) => !isFuture(e.datum));

    viewEl.innerHTML = `
      <div class="page-head">
        <h1>Kalender</h1>
        <p>Spiele, Trainings und Team-Events – sag direkt zu oder ab.</p>
      </div>
      <div class="toolbar">
        ${filters.map((f) => `<button class="chip ${kalFilter === f.k ? "is-active" : ""}" data-filter="${f.k}">${f.label}</button>`).join("")}
      </div>
      ${kommend.length ? `<div class="event-list">${kommend.map((e) => eventCard(e, true)).join("")}</div>`
                       : `<div class="empty"><div class="em-ico">📭</div>Keine kommenden Termine in dieser Auswahl.</div>`}
      ${vergangen.length ? `
        <div class="section-title" style="margin-top:28px"><h2>Vergangene Termine</h2></div>
        <div class="event-list" style="opacity:.72">${vergangen.map((e) => eventCard(e, false)).join("")}</div>` : ""}
    `;
  }

  function eventTitel(e) {
    if (e.typ === "spiel") return `${e.titel}${e.gegner ? " · " + (e.heim ? "FCFN" : e.gegner) + " gegen " + (e.heim ? e.gegner : "FCFN") : ""}`;
    return e.titel;
  }

  function eventCard(e, withRsvp = true) {
    const tagMap = {
      spiel:    `<span class="tag tag-spiel">Spiel</span>`,
      training: `<span class="tag tag-training">Training</span>`,
      event:    `<span class="tag tag-event">Team-Event</span>`,
    };
    const heimTag = e.typ === "spiel"
      ? (e.heim ? `<span class="tag tag-heim">Heim</span>` : `<span class="tag tag-ausw">Auswärts</span>`)
      : "";
    const titel = e.typ === "spiel" && e.gegner
      ? `FC Fasanerie-Nord <span style="color:var(--muted);font-weight:600">vs.</span> ${esc(e.gegner)}`
      : esc(e.titel);

    // RSVP-Zähler
    const zusagen = DEMO.players.filter((p) => (state.rsvp[e.id + "|" + p.id] || {}).status === "zu").length;
    const r = state.rsvp[e.id + "|" + state.currentPlayerId] || {};
    const future = isFuture(e.datum);

    let rsvpHtml = "";
    if (withRsvp && future) {
      rsvpHtml = `
        <div class="rsvp">
          <div class="rsvp-buttons">
            <button class="btn btn-zu ${r.status === "zu" ? "is-on" : ""}" data-rsvp="zu" data-event="${e.id}">✓ Zusage</button>
            <button class="btn btn-ab ${r.status === "ab" ? "is-on" : ""}" data-rsvp="ab" data-event="${e.id}">✗ Absage</button>
          </div>
          <div class="rsvp-count"><b>${zusagen}</b> / ${DEMO.players.length} zugesagt</div>
          ${r.status === "ab" && r.grund ? `<div class="rsvp-reason">Grund: ${esc(r.grund)}</div>` : ""}
        </div>`;
    } else {
      rsvpHtml = `<div class="rsvp"><div class="rsvp-count"><b>${zusagen}</b> / ${DEMO.players.length} dabei</div></div>`;
    }

    return `
      <div class="event typ-${e.typ}">
        <div class="event-date">
          <span class="d-wd">${fmtWd(e.datum)}</span>
          <span class="d-day">${fmtDay(e.datum)}</span>
          <span class="d-mon">${fmtMon(e.datum)}</span>
        </div>
        <div class="event-main">
          <div class="e-title">${titel} ${tagMap[e.typ]} ${heimTag}</div>
          <div class="e-meta">
            <span>🕑 ${e.zeit} Uhr</span>
            <span>📍 ${esc(e.ort)}</span>
          </div>
          ${e.note ? `<div class="e-note">ℹ️ ${esc(e.note)}</div>` : ""}
        </div>
        ${rsvpHtml}
      </div>`;
  }

  /* ---------- Strafenkatalog ------------------------------------------------ */
  function renderKatalog() {
    const kategorien = [...new Set(DEMO.katalog.map((k) => k.kategorie))];
    viewEl.innerHTML = `
      <div class="page-head">
        <h1>Strafenkatalog</h1>
        <p>Verbindlich beschlossen von der Mannschaft – gilt für die ${esc(DEMO.verein.saison)}.</p>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Vergehen</th><th>Kategorie</th><th class="num">Betrag</th></tr></thead>
          <tbody>
            ${DEMO.katalog.map((k) => `
              <tr>
                <td style="font-weight:600">${esc(k.vergehen)}</td>
                <td><span class="kat-chip">${esc(k.kategorie)}</span></td>
                <td class="num amount">${euro(k.betrag)}</td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>
      <p style="color:var(--muted);font-size:.85rem;margin-top:14px">
        ${DEMO.katalog.length} Positionen in ${kategorien.length} Kategorien · Einnahmen fließen in die Mannschaftskasse.
      </p>
    `;
  }

  /* ---------- Strafen-Konto ------------------------------------------------- */
  let strafenFilter = "offen"; // offen | bezahlt | alle | meine

  function renderStrafen() {
    const me = playerById[state.currentPlayerId];

    const alle = DEMO.strafen.map((s) => ({
      ...s,
      betrag: strafeBetrag(s),
      bezahlt: istBezahlt(s),
      player: playerById[s.playerId],
      kat: katById[s.katalogId],
    }));

    const offenGesamt   = alle.filter((s) => !s.bezahlt).reduce((a, s) => a + s.betrag, 0);
    const bezahltGesamt = alle.filter((s) =>  s.bezahlt).reduce((a, s) => a + s.betrag, 0);
    const meineOffen    = alle.filter((s) => s.playerId === me.id && !s.bezahlt).reduce((a, s) => a + s.betrag, 0);
    const meineGesamt   = alle.filter((s) => s.playerId === me.id).reduce((a, s) => a + s.betrag, 0);

    let gefiltert = alle;
    if (strafenFilter === "offen")   gefiltert = alle.filter((s) => !s.bezahlt);
    if (strafenFilter === "bezahlt") gefiltert = alle.filter((s) =>  s.bezahlt);
    if (strafenFilter === "meine")   gefiltert = alle.filter((s) => s.playerId === me.id);
    gefiltert.sort((a, b) => Number(a.bezahlt) - Number(b.bezahlt) || b.datum.localeCompare(a.datum));

    const filters = [
      { k: "offen",   label: "Offen" },
      { k: "bezahlt", label: "Beglichen" },
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
          <div class="bar-sub">${t.offen > 0 ? euro(t.offen) + " offen" : "alles bezahlt ✓"}</div>
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
        <p>Offene und beglichene Strafen der Mannschaft.</p>
      </div>

      <div class="mine-banner">
        <div class="mb-left">
          <small>Dein Konto · ${esc(me.name)}</small>
          <strong>${meineOffen > 0 ? "Du hast noch offene Strafen" : "Du bist schuldenfrei 🎉"}</strong>
        </div>
        <div class="mb-right">
          <div class="mb-amount">
            <span class="v">${euro(meineOffen)}</span>
            <small>offen · ${euro(meineGesamt)} gesamt</small>
          </div>
          ${meineOffen > 0 ? `<div class="mb-pay">
            <button class="paypal-btn" data-paypal="${meineOffen}" aria-label="Mit PayPal bezahlen">
              <svg class="pp-mark" viewBox="0 0 384 512" width="15" height="19" aria-hidden="true">
                <path fill="#003087" d="M111.4 295.9c-3.5 19.2-17.4 108.7-21.5 134-.3 1.8-1 2.5-3 2.5H12.3c-7.6 0-13.1-6.6-12.1-13.9L58.8 46.6c1.5-9.6 10.1-16.9 20-16.9 152.3 0 165.1-3.7 204 11.4 60.1 23.3 65.6 79.5 44 140.3-21.5 62.6-72.5 89.5-140.1 90.3-43.4 .7-69.5-7-75.3 24.2zM357.1 152c-1.8-1.3-2.5-1.8-3 1.3-2 11.4-5.1 22.5-8.8 33.6-39.9 113.8-150.5 103.9-204.5 103.9-6.1 0-10.1 3.3-10.9 9.4-22.6 140.4-27.1 169.7-27.1 169.7-1 7.1 3.5 12.9 10.6 12.9h63.5c8.6 0 15.7-6.3 17.4-14.9 .7-5.4-1.1 6.1 14.4-91.3 4.6-22 14.3-19.7 29.3-19.7 71 0 126.4-28.8 142.9-112.3 6.5-34.8 4.6-71.4-23.3-91.9z"/>
              </svg>
              <span class="pp-word"><span class="pp1">Pay</span><span class="pp2">Pal</span></span>
            </button>
            <span class="mb-pay-cap">🔒 Sicher bezahlen</span>
          </div>` : ""}
        </div>
      </div>

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
                <td><div class="player-cell"><span class="avatar">${initials(s.player.name)}</span>${esc(s.player.name)}</div></td>
                <td>${esc(s.kat.vergehen)}${s.note ? `<div style="font-size:.78rem;color:var(--muted)">${esc(s.note)}</div>` : ""}</td>
                <td style="color:var(--muted);white-space:nowrap">${fmtWd(s.datum)}, ${fmtDay(s.datum)}. ${fmtMon(s.datum)}</td>
                <td class="num amount">${euro(s.betrag)}</td>
                <td><span class="badge ${s.bezahlt ? "badge-paid" : "badge-open"}">${s.bezahlt ? "beglichen" : "offen"}</span></td>
                <td style="text-align:right">
                  <button class="btn" data-toggle-paid="${s.id}">${s.bezahlt ? "Als offen" : "Als bezahlt"}</button>
                </td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>` : `<div class="empty"><div class="em-ico">✅</div>Keine Strafen in dieser Auswahl.</div>`}
    `;
  }

  /* ---------------------------------------------------------------------------
     Interaktion (Event-Delegation)
     --------------------------------------------------------------------------- */
  viewEl.addEventListener("click", (ev) => {
    const t = ev.target.closest("[data-rsvp],[data-filter],[data-sfilter],[data-toggle-paid],[data-goto],[data-paypal]");
    if (!t) return;

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

    // Ab-/Zusage
    if (t.dataset.rsvp) {
      const eventId = t.dataset.event;
      const key = eventId + "|" + state.currentPlayerId;
      const cur = state.rsvp[key] || {};
      const status = t.dataset.rsvp;
      if (cur.status === status) {
        delete state.rsvp[key]; // erneuter Klick = Rückmeldung zurücknehmen
      } else if (status === "ab") {
        const grund = window.prompt("Grund für die Absage (optional):", cur.grund || "");
        if (grund === null) return; // „Abbrechen" -> Absage NICHT speichern
        state.rsvp[key] = { status: "ab", grund: grund.trim() };
      } else {
        state.rsvp[key] = { status: "zu", grund: "" };
      }
      save();
      renderKalender();
      return;
    }

    // Strafe bezahlt umschalten
    if (t.dataset.togglePaid) {
      const id = t.dataset.togglePaid;
      const strafe = DEMO.strafen.find((s) => s.id === id);
      state.paid[id] = !istBezahlt(strafe);
      save();
      renderStrafen();
      return;
    }
  });

  /* ---------------------------------------------------------------------------
     Navigation, Spielerauswahl, Reset
     --------------------------------------------------------------------------- */
  function switchView(view) {
    currentView = view;
    document.querySelectorAll(".nav-btn").forEach((b) =>
      b.classList.toggle("is-active", b.dataset.view === view));
    window.scrollTo({ top: 0, behavior: "smooth" });
    render();
  }

  document.getElementById("appNav").addEventListener("click", (ev) => {
    const b = ev.target.closest(".nav-btn");
    if (b) switchView(b.dataset.view);
  });

  const sel = document.getElementById("playerSelect");
  sel.innerHTML = DEMO.players
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((p) => `<option value="${p.id}">${esc(p.name)} (#${p.nr})</option>`)
    .join("");
  sel.value = state.currentPlayerId;
  sel.addEventListener("change", () => {
    state.currentPlayerId = sel.value;
    save();
    render();
  });

  document.getElementById("resetBtn").addEventListener("click", () => {
    if (window.confirm("Alle lokalen Eingaben (Ab-/Zusagen, bezahlte Strafen) auf die Demo-Daten zurücksetzen?")) {
      state = defaultState();
      save();
      sel.value = state.currentPlayerId;
      render();
    }
  });

  /* ---------------------------------------------------------------------------
     Sticky-Navigation: top dynamisch an die tatsächliche Header-Höhe koppeln
     (CSS nutzt var(--header-h)). Wird bei Laden & Größenänderung aktualisiert.
     --------------------------------------------------------------------------- */
  function syncHeaderHeight() {
    const header = document.querySelector(".app-header");
    if (header) {
      document.documentElement.style.setProperty("--header-h", header.offsetHeight + "px");
    }
  }
  syncHeaderHeight();
  window.addEventListener("resize", syncHeaderHeight);

  /* ---------------------------------------------------------------------------
     Start
     --------------------------------------------------------------------------- */
  render();
})();
