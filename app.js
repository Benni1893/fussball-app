/* ===========================================================================
   FC Fasanerie-Nord – Mannschafts-App · Anwendungslogik
   Reines Vanilla-JS. Daten kommen aus Supabase (siehe db.js); Zu-/Absagen und
   der bezahlt-Status werden direkt in der Datenbank gespeichert.
   =========================================================================== */
(function () {
  "use strict";

  // Build-Kennung (muss zur HTML-Build-Kennung in index.html passen). Bei jedem Deploy hochziehen.
  var APP_BUILD = "2026-10-09-K";
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
  // 16.09.2026 - die Kasse schreibt das Jahr aus, weil offene Strafen aelter
  // als eine Saison werden koennen und "16. Sep." dann mehrdeutig ist.
  function fmtPunkt(iso) {
    const dt = parseDate(iso);
    return String(dt.getDate()).padStart(2, "0") + "." + String(dt.getMonth() + 1).padStart(2, "0") + "." + dt.getFullYear();
  }
  // 22.09. - die kurze Form fuer Zeilen, in denen das Jahr aus dem Zusammenhang folgt.
  function fmtKurz(iso) {
    const dt = parseDate(iso);
    return String(dt.getDate()).padStart(2, "0") + "." + String(dt.getMonth() + 1).padStart(2, "0") + ".";
  }
  /* „heute, 18:42" / „gestern, 18:42" / „20.09., 18:42" - fuer den Zeitpunkt
     der Meldung. Arbeitet auf einem Zeitstempel, nicht auf einem Datum. */
  function fmtGemeldet(ts) {
    let dt;
    try { dt = new Date(ts); } catch (e) { return ""; }
    if (!dt || isNaN(dt.getTime())) return "";
    const uhr = dt.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
    const tag = (d) => d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
    const heute = new Date();
    const gestern = new Date(heute.getTime() - 86400000);
    if (tag(dt) === tag(heute))   return "heute, " + uhr;
    if (tag(dt) === tag(gestern)) return "gestern, " + uhr;
    return String(dt.getDate()).padStart(2, "0") + "." + String(dt.getMonth() + 1).padStart(2, "0") + "., " + uhr;
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
    ["fit", "Fit"],
    ["angeschlagen", "Angeschlagen"],
    ["verletzt", "Verletzt"],
    ["urlaub", "Urlaub"],
  ];
  // "urlaub" zaehlt ueberall wie verletzt: nicht einsatzbereit.
  function istFit(p) { return !p || !p.status || p.status === "fit"; }

  /* Mein Status (Nachschliff D4): Raster 2 × 2. Nicht gewählt mit Punkt in der
     Statusfarbe, gewählt mit Fläche, 1,5 px Rand und Haken in der Statusfarbe.
     Fit setzt direkt; Angeschlagen, Verletzt und Urlaub öffnen das Blatt mit
     „Voraussichtlich bis“ und Notiz (openStatusFenster). Nach dem Speichern
     steht statt der Felder eine Zeile „Voraussichtlich bis …“ mit „Ändern“. */
  const ST_HAKEN = '<svg class="st-haken" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  function statusBisText(iso) {
    if (!iso) return "";
    const dt = parseDate(iso);
    return WT[dt.getDay()] + ", " + dt.getDate() + ". " + MON[dt.getMonth()];
  }
  function statusWahlHtml(p, opts) {
    opts = opts || {};
    const st = p.status || "fit";
    const knoepfe = STATUS_WAHL.map(([wert, label]) => {
      const an = st === wert;
      // Fit setzt direkt, die anderen öffnen das Blatt (auch der schon gewählte: dort ändern).
      const attr = wert === "fit" ? `data-status-set="${p.id}"` : `data-status-fenster="${p.id}"`;
      return `<button type="button" class="st-knopf st-${wert}${an ? " is-on" : ""}" ${attr} data-wert="${wert}" aria-pressed="${an}">` +
        (an ? ST_HAKEN : '<span class="st-dot" aria-hidden="true"></span>') + `${label}</button>`;
    }).join("");
    const zeile = istFit(p) ? "" : `
      <div class="card st-zeile">
        <span class="st-zeile-main"><span class="st-zeile-t">${p.statusUntil ? "Voraussichtlich bis " + statusBisText(p.statusUntil) : "Ohne Enddatum"}</span>${p.statusNote ? `<span class="st-zeile-s">${esc(p.statusNote)}</span>` : ""}</span>
        <button type="button" class="st-aendern" data-status-fenster="${p.id}" data-wert="${esc(st)}">Ändern</button>
      </div>`;
    return `<div class="st-wahl"${opts.kompakt ? ' data-kompakt=""' : ""}>
      <div class="st-raster">${knoepfe}</div>${zeile}
    </div>`;
  }

  /* Blatt „Voraussichtlich bis“ (D4, Muster D3): Titel = Status mit Punkt,
     Datum (formatierte Anzeige über dem nativen Feld) und Notiz, Fuß
     Abbrechen | Speichern. Speichern schreibt Status, Datum und Notiz in einem
     Aufruf (set_player_status); Abbrechen ändert nichts. */
  function closeStatusFenster() {
    const ex = document.getElementById("statusFenster");
    if (ex) ex.remove();
    unlockBodyScroll();
  }
  function openStatusFenster(playerId, wert) {
    const p = playerById[playerId];
    if (!p) return;
    closeStatusFenster();
    const label = (STATUS_WAHL.find(([w]) => w === wert) || [])[1] || wert;
    const gleich = p.status === wert;
    const bis = gleich ? (p.statusUntil || "") : "";
    const notiz = gleich ? (p.statusNote || "") : "";
    const ov = document.createElement("div");
    ov.className = "nsb-ov"; ov.id = "statusFenster";
    ov.innerHTML = '<button type="button" class="nsb-hg" data-sf-zu aria-label="Schließen"></button>' +
      '<div class="nsb" role="dialog" aria-modal="true" aria-label="' + esc(label) + '">' +
        '<span class="nsb-griff" aria-hidden="true"></span>' +
        '<div class="nsb-titel sf-titel"><span>' + esc(label) + '</span><span class="sf-punkt st-' + esc(wert) + '" aria-hidden="true"></span></div>' +
        '<div class="nsb-felder">' +
          '<label class="nsb-feld"><span class="nsb-l">Voraussichtlich bis</span>' +
            '<span class="nsb-in sf-datum"><span class="sf-datum-t' + (bis ? "" : " is-leer") + '" data-sf-anz>' + (bis ? esc(tfDatumText(bis)) : "Datum wählen") + '</span>' +
            '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>' +
            '<input type="date" data-sf-bis value="' + esc(bis) + '" aria-label="Voraussichtlich bis"></span></label>' +
          '<label class="nsb-feld"><span class="nsb-l">Notiz</span><input class="nsb-in" type="text" data-sf-notiz maxlength="80" placeholder="optional" value="' + esc(notiz) + '"></label>' +
        '</div>' +
        '<div class="nsb-fuss"><button type="button" class="btn nsb-sek" data-sf-zu>Abbrechen</button>' +
          '<button type="button" class="btn btn-primary nsb-prim" data-sf-speichern>Speichern</button></div>' +
      '</div>';
    document.body.appendChild(ov);
    lockBodyScroll();
    const datum = ov.querySelector("[data-sf-bis]"), anz = ov.querySelector("[data-sf-anz]");
    datum.addEventListener("change", () => { anz.textContent = datum.value ? tfDatumText(datum.value) : "Datum wählen"; anz.classList.toggle("is-leer", !datum.value); });
    ov.addEventListener("click", async (ev) => {
      if (ev.target.closest("[data-sf-zu]")) { closeStatusFenster(); return; }
      if (ev.target.closest("[data-sf-speichern]")) {
        const until = datum.value || null;
        const note = ov.querySelector("[data-sf-notiz]").value.trim() || null;
        closeStatusFenster();
        await statusSpeichern(playerId, wert, { until, note });
      }
    });
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

  /* Meldeschluss. Gerechnet wird er NICHT mehr hier, sondern einmal in der
     Datenbank (Migration 0033: compute_deadline -> events.deadline_at).
     Vorher stand die Regel "Spiel 24 h, Training 3 h" an fuenf Stellen -
     viermal in SQL, einmal hier. An dieser Frist haengt Geld; liefen die
     Kopien auseinander, erinnerte die App nach der einen Regel und
     bestrafte nach der anderen.
     Das Feld kann null sein: bei Terminen ohne Uhrzeit und bei allen Typen
     ausser Spiel und Training. Genau dann gibt es auch keine Frist.       */
  function meldeschlussMs(e) {
    if (!e || !e.deadlineAt) return null;
    const t = new Date(e.deadlineAt).getTime();
    return isFinite(t) ? t : null;
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
          if (currentView === "dashboard") { renderDashboard(); return; }
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
          el.textContent = (el.getAttribute("data-cd-prefix") || "") + fmtRestzeit(info.remMs, compact) + (compact || el.hasAttribute("data-cd-prefix") ? "" : " bis +2 €");
          el.classList.add(dringlichkeitClass(info.remMs));
        }
      } else {
        const target = new Date(el.getAttribute("data-cd-deadline")).getTime();
        const rem = isFinite(target) ? target - now : 0;
        if (rem <= 0) { el.textContent = "abgelaufen"; el.classList.add("cd-due"); }
        else if (el.getAttribute("data-cd-format") === "in") { el.textContent = (el.getAttribute("data-cd-prefix") || "") + fmtIn(rem); el.classList.add(dringlichkeitClass(rem)); }
        else { el.textContent = fmtRestzeit(rem, compact); el.classList.add(dringlichkeitClass(rem)); }
      }
    });
  }
  // Restzeit kurz und relativ: "in 21 h", "in 40 min", "in 3 Tagen".
  function fmtIn(ms) {
    const min = Math.floor(ms / 60000);
    if (min < 60) return "in " + Math.max(1, min) + " min";
    const h = Math.floor(min / 60);
    if (h < 48) return "in " + h + " h";
    return "in " + Math.floor(h / 24) + " Tagen";
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
  const SHEET_VIEWS = ["admin", "einstellungen", "lineup", "kader", "pushkatalog", "kasse"];

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
      else if (currentView === "pushkatalog") { if (Roles.isAdmin()) renderPushKatalog(); else renderDashboard(); }
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
    const r = Roles.isAdmin() ? "Admin"
      : Roles.has("coach") ? "Trainer"
      : Roles.has("treasurer") ? "Kassenwart" : "";
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
          art: "mine", zahl: "!", titel: "Rückmeldung fehlt",
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
          sub: "Kasse · " + seit, attr: "data-task-pay",
        });
      }
    }

    // --- Trainer/Admin: fehlende Rueckmeldungen + Spiele ohne volle Elf ---------
    if (Roles.canManageEvents()) {
      if (offenTermin) {
        const ohne = ohneRueckmeldung(naechstes).length;
        if (ohne > 0) {
          zeilen.push({
            art: "rsvp", zahl: ohne, titel: "Ohne Rückmeldung",
            sub: (naechstes.typ === "spiel" ? "Spiel " : naechstes.typ === "training" ? "Training " : esc(naechstes.titel) + " ")
              + fmtWd(naechstes.datum) + " · Erinnerung senden",
            attr: 'data-rsvp-sheet="' + naechstes.id + '"',
          });
        }
      }
      const offeneElf = DEMO.events
        .filter((e) => e.typ === "spiel" && istOffen(e) && e.status !== "abgesagt" && !aufstellungStand(e).steht)
        .sort((a, b) => (eventStartMs(a) || 0) - (eventStartMs(b) || 0));
      if (offeneElf.length) {
        const sp = offeneElf[0];
        zeilen.push({
          art: "lineup", zahl: offeneElf.length, titel: "Elf aufstellen",
          sub: fmtWd(sp.datum) + " " + fmtDay(sp.datum) + ".\u00a0" + fmtMon(sp.datum) + " · " + esc(sp.gegner || sp.titel),
          attr: 'data-lineup-edit="' + sp.id + '"',
        });
      }
    }

    // Keine Zeile fuer Schuldenfreiheit: der Block zeigt nur, was zu tun ist.
    // Trifft nichts zu, entfaellt er samt Ueberschrift.
    return zeilen;
  }
  // Kurzbezeichnung eines Termins fuer die Unterzeile der Aufgabenliste.
  function eventKurz(e) {
    const wann = fmtWd(e.datum) + " " + fmtDay(e.datum) + ".\u00a0" + fmtMon(e.datum);
    if (e.typ === "spiel") return wann + " · " + (e.heim ? "vs. " : "@ ") + esc(e.gegner || e.titel);
    return wann + " · " + esc(e.titel);
  }
  function aufgabenBlockHtml(naechstes) {
    const zeilen = aufgabenZeilen(naechstes);
    if (!zeilen.length) return "";
    return `
      <div class="group-head"><h2>Heute zu tun</h2></div>
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

    // „Danach": die naechsten drei Termine nach dem Hero (D9: keine eigene
    // Spieltag-Karte mehr, das Spiel steht hier in der Liste).
    const danach = naechste.filter((e) => !naechstes || e.id !== naechstes.id).slice(0, 2);

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
    /* Kachel Mannschaftskasse (Nachschliff D1): alle Rollen, gleicher Inhalt.
       Betrag 26/800 rot, bei 0,00 € grün; führt nach Konto › Mannschaft.
       „Meine Strafen“ bleibt als eigene Zeile für Konten ohne Spielerzuordnung. */
    const teamZeile = `${!kontoVerknuepft ? `<div class="card dn-liste geld-liste">
          <button class="row geld" data-nav="meine-strafen">
            <span class="row-main"><span class="row-t">Meine Strafen</span></span>
            <span class="row-end num">${euro(meinOffen)}</span><span class="row-chev" aria-hidden="true">›</span>
          </button>
        </div>` : ""}
        <button type="button" class="card kasse-kachel" data-nav="kasse" aria-label="Mannschaftskasse, ${esc(euro(teamOffen))} offen im Team">
          <span class="kk-main"><span class="kk-betrag num${teamOffen > 0 ? "" : " is-null"}">${euro(teamOffen)}</span>
            <span class="kk-text"><b>Mannschaftskasse</b> · offen im Team</span></span>
          <span class="kk-chev" aria-hidden="true">›</span>
        </button>`;

    viewEl.innerHTML = `
      <div class="page-head h1row">
        <h1>Servus, ${esc(me.name.split(" ")[0])}</h1>
        ${rollenPillHtml()}
      </div>
      ${pushHinweisHtml()}

      ${naechstes ? terminKarteHtml(naechstes, { hero: true })
        : `<div class="card card-pad"><div class="lbl">Nächster Termin</div><div class="empty">Keine kommenden Termine.</div></div>`}

      ${aufgabenBlockHtml(naechstes)}

      ${eigenerBlock ? `<div class="group-head"><h2>Mein Konto</h2><button class="link-btn" data-goto="strafen">Alle Strafen ›</button></div>
      ${eigenerBlock}` : ""}

      ${danach.length ? `<div class="group-head"><h2>Danach</h2><button class="link-btn" data-goto="kalender">Kalender ›</button></div>
      <div class="card dn-liste">${danach.map(danachZeileHtml).join("")}</div>` : ""}

      ${kontoVerknuepft ? `<div class="group-head"><h2>Mein Status</h2></div>
      ${statusWahlHtml(me, { kompakt: true })}` : ""}

      ${teamZeile ? `<div class="group-head"><h2>Kasse</h2></div>${teamZeile}` : ""}
    `;

    startCountdowns(); // Meldeschluss-Countdown im Hero und in der Spieltag-Karte
  }

  /* ---------- Kader (Trainer/Admin) -----------------------------------------
     Status setzen ueber dieselben vier Chips wie auf der Uebersicht und im
     Profil - ein Baustein, drei Orte. Bei allem ausser "fit" stehen Datum und
     Notiz inline unter der Zeile und speichern beim Verlassen des Feldes.
     Schranke ist die Datenbank: player_status liest nur coach/admin
     vollstaendig, geschrieben wird ausschliesslich ueber set_player_status(). */
  /* Kader (Vorlage Final 09): vier getoente Kennzahlen, Gruppe "Faellt aus"
     oben (Nebenzeile Grund, seit, bis), darunter "Einsatzbereit". Jede Zeile
     oeffnet das Blatt "Status aendern" (10). */
  const STATUS_PILLE = {
    fit: ["Fit", "is-gruen"], angeschlagen: ["Angeschlagen", "is-amber"],
    verletzt: ["Verletzt", "is-rot"], urlaub: ["Urlaub", "is-urlaub"],
  };
  function statusPilleHtml(p) {
    const st = STATUS_PILLE[p.status || "fit"] || STATUS_PILLE.fit;
    return '<span class="mark kad-pille ' + st[1] + '"><span class="mark-dot" aria-hidden="true"></span>' + st[0] + ' ▾</span>';
  }
  function renderKader() {
    const zahl = { fit: 0, angeschlagen: 0, verletzt: 0, urlaub: 0 };
    DEMO.players.forEach((p) => { const st = zahl[p.status] !== undefined ? p.status : "fit"; zahl[st]++; });
    // Faellt aus: alle nicht Fitten, Urlaub eingeschlossen; nach Rueckkehrdatum.
    const raus = DEMO.players.filter((p) => !istFit(p)).sort((a, b) => {
      const x = a.statusUntil || "9999-12-31", y = b.statusUntil || "9999-12-31";
      return x.localeCompare(y) || nachname(a.name).localeCompare(nachname(b.name), "de");
    });
    const fit = DEMO.players.filter(istFit).sort((a, b) => nachname(a.name).localeCompare(nachname(b.name), "de"));
    const kpi = (k, label, cls) => '<div class="kpi kad-kpi ' + cls + '"><span class="kpi-label">' + label + '</span><span class="kpi-value">' + zahl[k] + '</span></div>';
    const zeile = (p) => {
      const neben = istFit(p) ? "" : [p.statusNote ? esc(p.statusNote) : "",
        p.statusSince ? "seit " + fmtDay(p.statusSince) + ".\u00a0" + fmtMon(p.statusSince) : "",
        p.statusUntil ? "bis " + fmtDay(p.statusUntil) + ".\u00a0" + fmtMon(p.statusUntil) : ""].filter(Boolean).join(" · ");
      return '<button class="row kad-row' + (neben ? " is-zwei" : "") + '" data-status-blatt="' + p.id + '" aria-label="Status von ' + esc(p.name) + ' ändern">' +
        '<span class="row-av">' + (neben ? esc(initials(p.name)) : '<span>' + esc(initials(p.name)) + '</span>') + '</span>' +
        '<span class="row-main"><span class="row-t">' + esc(p.name) + '</span>' + (neben ? '<span class="row-s">' + neben + '</span>' : "") + '</span>' +
        '<span class="row-end">' + statusPilleHtml(p) + '</span></button>';
    };
    viewEl.innerHTML = `
      <div class="page-head">${navBackChevronHtml()}<h1>Kader</h1></div>
      <div class="kad-kpis">
        ${kpi("fit", "Fit", "is-gruen")}${kpi("angeschlagen", "Angeschlagen", "is-amber")}
        ${kpi("verletzt", "Verletzt", "is-rot")}${kpi("urlaub", "Urlaub", "is-urlaub")}
      </div>
      ${raus.length ? `<div class="group-head"><h2>Fällt aus</h2></div><div class="card kad-liste">${raus.map(zeile).join("")}</div>` : ""}
      <div class="group-head"><h2>Einsatzbereit · ${fit.length}</h2></div>
      ${fit.length ? `<div class="card kad-liste">${fit.map(zeile).join("")}</div>` : '<div class="empty">Gerade ist niemand einsatzbereit.</div>'}
    `;
  }

  /* Blatt "Status aendern" (Vorlage Final 10): Kopf mit Avatar, Name und
     "IV · Nr. 5", vier Statusknoepfe (gewaehlt getoent mit Rand), Grund und
     voraussichtliches Ende (nicht in der Vorlage, bleibt), Speichern. */
  function openStatusBlatt(playerId) {
    const p = playerById[playerId];
    if (!p) return;
    const ex = document.getElementById("statusBlatt"); if (ex) { ex.remove(); unlockBodyScroll(); }
    let wahl = p.status || "fit";
    const ov = document.createElement("div");
    ov.className = "more-sheet"; ov.id = "statusBlatt";
    const knoepfe = () => STATUS_WAHL.map(([wert, label]) =>
      '<button type="button" class="sb-k st-' + wert + (wahl === wert ? " is-on" : "") + '" data-sb-wert="' + wert + '" aria-pressed="' + (wahl === wert) + '">' +
      '<span class="st-dot" aria-hidden="true"></span>' + label + '</button>').join("");
    ov.innerHTML = '<button class="more-backdrop" data-sheet-close aria-label="Schließen"></button>' +
      '<div class="more-panel sb-panel" role="dialog" aria-modal="true" aria-label="Status ändern">' +
        '<span class="sb-griff" aria-hidden="true"></span>' +
        '<div class="sb-kopf"><span class="row-av sb-av">' + esc(initials(p.name)) + '</span>' +
          '<span class="sb-kopf-t"><span class="sb-name">' + esc(p.name) + '</span>' +
          '<span class="sb-sub">' + [p.pos ? esc(p.pos) : "", p.nr != null ? "Nr. " + p.nr : ""].filter(Boolean).join(" · ") + '</span></span></div>' +
        '<div class="sb-knoepfe">' + knoepfe() + '</div>' +
        '<div class="sb-felder">' +
          '<input class="sb-feld" type="text" data-sb-note value="' + esc(p.statusNote || "") + '" placeholder="Grund (optional)" aria-label="Grund">' +
          '<label class="sb-feld sb-datum"><span class="sb-datum-l">Voraussichtlich bis</span>' +
            '<input type="date" data-sb-until value="' + esc(p.statusUntil || "") + '" aria-label="Voraussichtlich bis"></label>' +
        '</div>' +
        '<button class="btn btn-primary sb-speichern" data-sb-speichern>Speichern</button>' +
      '</div>';
    document.body.appendChild(ov);
    lockBodyScroll();
    const felder = ov.querySelector(".sb-felder");
    const sync = () => {
      ov.querySelector(".sb-knoepfe").innerHTML = knoepfe();
      felder.hidden = wahl === "fit";
    };
    sync();
    const zu = () => { if (ov.parentNode) { ov.remove(); unlockBodyScroll(); } };
    ov.addEventListener("click", async (ev) => {
      if (ev.target === ov || ev.target.closest("[data-sheet-close]")) { zu(); return; }
      const k = ev.target.closest("[data-sb-wert]");
      if (k) { wahl = k.dataset.sbWert; sync(); return; }
      if (ev.target.closest("[data-sb-speichern]")) {
        const note = ov.querySelector("[data-sb-note]").value.trim();
        const until = ov.querySelector("[data-sb-until]").value || null;
        zu();
        await statusSpeichern(p.id, wahl, { note: wahl === "fit" ? null : (note || null), until: wahl === "fit" ? null : until });
      }
    });
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
  // Glocke fuer den Benachrichtigungs-Hinweis und spaeter die Kopfzeile.
  const ICON_GLOCKE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>`;
  const ICON_CAL_ADD = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M3 9h18M8 2.5v4M16 2.5v4M12 13v4M10 15h4"/></svg>`;

  /* Einzelner Termin als Datei. Der Endpunkt antwortet mit
     Content-Disposition: attachment, das System uebergibt die Datei der
     Kalender-App. Kein webcal, kein Abo - der Termin wird einmal
     gespeichert. Gleiche UID wie im Abo-Feed, damit ein spaeter
     eingerichtetes Abo denselben Eintrag trifft statt einen zweiten. */
  async function termindateiLaden(eventId) {
    const t = await ensureCalendarToken();
    if (!t) { window.alert("Der Kalender-Link steht noch nicht bereit. Bitte gleich noch einmal versuchen."); return; }
    window.location.assign(window.location.origin + "/api/event/" + encodeURIComponent(t) +
      "/" + encodeURIComponent(eventId) + ".ics");
  }

  /* ---------- Abo-Hinweis: wann und wo ------------------------------------
     Die Abo-Kachel stand frueher dauerhaft im Kalender und nahm Platz weg,
     auch fuer Spieler, die laengst abonniert haben. Jetzt erscheint sie erst,
     wenn der Nutzer sich das erste Mal zu einem Termin zurueckgemeldet hat -
     dann ist der Kalender fuer ihn ein Thema. Weg ist sie, sobald er sie
     wegtippt oder den Abo-Weg beschreitet; beides merkt sich der Server am
     Profil, damit der Hinweis nicht auf jedem Geraet neu auftaucht.
     Dauerhaft erreichbar bleibt das Abo ueber die Einstellungen.          */

  // In dieser Sitzung festgelegter Platz. null = noch nicht ausgeloest,
  // false = in dieser Sitzung erledigt (weggetippt oder Abo begonnen).
  let aboSitzung = null;

  // Hat der Nutzer ueberhaupt schon einmal zugesagt ODER abgesagt? Nur die
  // eigenen Zeilen zaehlen - coach/admin sehen ueber die RLS auch fremde.
  function hatEigeneRueckmeldung() {
    const pid = state.currentPlayerId;
    if (!pid) return false;
    return Object.keys(state.rsvp).some((k) => {
      const r = state.rsvp[k];
      return k.slice(k.indexOf("|") + 1) === pid && r && (r.status === "zu" || r.status === "ab");
    });
  }

  /* Wo steht der Hinweis? Rein rechnend, damit pruefbar.
       profil    { calendar_hint_dismissed_at, calendar_subscribe_started_at }
       rueckm    hat der Nutzer irgendeine eigene Rueckmeldung
       sitzung   was in dieser Sitzung schon festgelegt wurde (null | false | Platz)
     Rueckgabe: null oder { ort: "karte"|"liste", eventId }
     Einmal festgelegt bleibt der Platz - ein zweites Ja soll den Hinweis
     nicht an eine andere Karte springen lassen.                          */
  function aboHinweisPlatz(profil, rueckm, sitzung) {
    if (!profil) return null;
    if (profil.calendar_hint_dismissed_at || profil.calendar_subscribe_started_at) return null;
    if (sitzung === false) return null;
    if (sitzung) return sitzung;
    if (!rueckm) return null;
    return { ort: "liste", eventId: null };
  }

  // Serverseitig merken. Fehlschlaege bleiben still und werden im Hintergrund
  // wiederholt - der Nutzer hat die Kachel weggetippt, das ist seine Antwort,
  // eine Fehlermeldung waere hier nur im Weg.
  function hinweisMerken(dismissed, subscribed) {
    if (currentProfile) {
      if (dismissed  && !currentProfile.calendar_hint_dismissed_at)    currentProfile.calendar_hint_dismissed_at = new Date().toISOString();
      if (subscribed && !currentProfile.calendar_subscribe_started_at) currentProfile.calendar_subscribe_started_at = new Date().toISOString();
    }
    aboSitzung = false;
    const versuch = (n) => {
      DB.setCalendarHint(dismissed, subscribed).catch(() => {
        if (n < 3) setTimeout(() => versuch(n + 1), 2000 * n);
      });
    };
    versuch(1);
  }

  // Die Kachel selbst. hinweis = true gibt ihr das X und den kuerzeren Titel.
  function aboKachelHtml(hinweis) {
    if (hinweis) {
      return '<div class="card kal-abo-wrap kal-abo-zeile">' +
        '<button class="kal-abo-z" data-cal-sheet type="button">' +
          '<span class="kal-abo-zic" aria-hidden="true">' + ICON_CAL_ADD + '</span>' +
          '<span class="kal-abo-zt">Kalender abonnieren ›</span>' +
        '</button>' +
        '<button class="kal-abo-zx" data-cal-hide type="button" aria-label="Hinweis ausblenden">' +
          '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
        '</div>';
    }
    const titel = "Termine im Kalender abonnieren";
    return '<div class="kal-abo-wrap">' +
      '<button class="card kal-abo' + (hinweis ? " hat-x" : "") + '" data-cal-sheet type="button">' +
        '<span class="kal-abo-ic" aria-hidden="true">' + ICON_CAL_ADD + '</span>' +
        '<span class="kal-abo-main"><span class="kal-abo-t">' + titel + '</span></span>' +
        '<span class="kal-abo-chev" aria-hidden="true">›</span>' +
      '</button>' +
      (hinweis ? '<button class="kal-abo-x" data-cal-hide type="button" aria-label="Hinweis ausblenden">✕</button>' : "") +
      '</div>';
  }
  function closeCalSheet() { const ex = document.getElementById("calSheet"); if (ex) { ex.remove(); unlockBodyScroll(); } }

  // Apple nimmt webcal: systemweit an. Android nicht - und der Umweg ueber
  // calendar.google.com/r?cid= hilft dort auch nicht: Android faengt den Link
  // ab und uebergibt ihn der Google-Kalender-App, die kein Abo per URL anlegt.
  // Bleibt der ehrliche Weg: Link kopieren, einmal in die Web-Oberflaeche.
  function istAppleGeraet() {
    const ua = navigator.userAgent || "";
    return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && (navigator.maxTouchPoints || 0) > 1);
  }
  // Direktseite fuer "Per URL" in der Web-Oberflaeche. Fester Pfad, kein
  // Parameter: der Link selbst wird dort eingefuegt.
  const GOOGLE_ADD_URL = "https://calendar.google.com/calendar/u/0/r/settings/addbyurl";

  /* Bottom-Sheet „Termine abonnieren“ (aus der Kalender-Kopfzeile geöffnet).
     Zwei Karten, weil die beiden Systeme verschiedene Wege brauchen. Die Karte
     des erkannten Systems steht oben; ausgeblendet wird keine - es gibt
     Leihgeräte, Tablets und den Desktop-Browser. Der ICS-Endpunkt bleibt
     unberührt, beide Wege zeigen auf dieselbe Adresse. */
  async function openCalSheet() {
    closeCalSheet();
    await ensureCalendarToken();
    const https  = calendarSubscribeUrl();
    const webcal = https ? https.replace(/^https?:/i, "webcal:") : "#";
    const aus    = https ? "" : ' aria-disabled="true"';

    const karteApple = `
      <section class="abo-karte">
        <div class="abo-k-t">iPhone und iPad</div>
        <a class="btn btn-primary abo-btn" data-cal-open href="${esc(webcal)}"${aus}>Zum Kalender hinzufügen</a>
      </section>`;
    const karteAndroid = `
      <section class="abo-karte">
        <div class="abo-k-t">Android / Google Kalender</div>
        <p class="abo-hinweis">Das Abo lässt sich nur einmalig über die Web-Oberfläche anlegen,
        danach erscheint der Kalender automatisch in deiner Kalender-App.</p>
        <ol class="abo-schritte">
          <li>Link kopieren.</li>
          <li>calendar.google.com im Browser öffnen, ggf. auf „Desktop-Version“ umschalten,
          links bei „Weitere Kalender“ auf das Plus, dann „Per URL“.</li>
          <li>Link einfügen, „Kalender hinzufügen“.</li>
        </ol>
        <button class="btn btn-primary abo-btn" data-cal-copy type="button"${aus}>Link kopieren</button>
        <a class="btn btn-soft abo-btn" data-cal-google href="${GOOGLE_ADD_URL}" target="_blank" rel="noopener noreferrer">calendar.google.com öffnen</a>
        <p class="abo-fuss">Änderungen erscheinen bei Google mit bis zu 24 Stunden Verzögerung.</p>
      </section>`;
    const zuerstAndroid = /Android/i.test(navigator.userAgent || "") && !istAppleGeraet();

    const ov = document.createElement("div");
    ov.className = "more-sheet"; ov.id = "calSheet";
    ov.innerHTML = `
      <button class="more-backdrop" data-sheet-close aria-label="Schließen"></button>
      <div class="more-panel" role="dialog" aria-modal="true" aria-label="Termine abonnieren">
        <div class="more-title">Termine abonnieren</div>
        <p class="sheet-desc">Alle Termine automatisch in deinem Handy-Kalender.</p>
        <div class="abo-karten">${zuerstAndroid ? karteAndroid + karteApple : karteApple + karteAndroid}</div>
        <div class="cal-copied" data-cal-copied hidden></div>
        <div class="sheet-links"><button class="link-btn cal-reset" data-cal-regen>Link zurücksetzen</button></div>
      </div>`;
    document.body.appendChild(ov);
    lockBodyScroll();
    const q = (sel) => ov.querySelector(sel);
    const feedback = (txt) => { const fb = q("[data-cal-copied]"); if (fb) { fb.textContent = txt; fb.hidden = false; setTimeout(() => { fb.hidden = true; }, 1800); } };

    ov.addEventListener("click", (e) => { if (e.target === ov || e.target.closest("[data-sheet-close]")) closeCalSheet(); });
    sheetSwipeToClose(ov.querySelector(".more-panel"), null, closeCalSheet);
    // Erst eine dieser drei Handlungen gilt als "Abo begonnen" - das blosse
    // Oeffnen des Blattes nicht. Auf Android besteht das Abonnieren aus
    // Kopieren plus Handarbeit in der Weboberflaeche; ein beobachtbares
    // "fertig" gibt es dort nicht. Wer nur hineinschaut, soll den Hinweis
    // wiedersehen.
    q("[data-cal-open]").addEventListener("click", () => { hinweisMerken(false, true); setTimeout(closeCalSheet, 150); }); // nach dem Abo-Sprung schließen
    const go = q("[data-cal-google]"); if (go) go.addEventListener("click", () => hinweisMerken(false, true));
    // Der Google-Weg öffnet einen neuen Tab; das Blatt bleibt offen, damit
    // „Link kopieren“ danach noch erreichbar ist.
    q("[data-cal-copy]").addEventListener("click", async () => {
      const url = calendarSubscribeUrl(); if (!url) return;
      hinweisMerken(false, true);
      feedback((await copyText(url)) ? "Link kopiert" : "Kopieren nicht möglich");
    });
    q("[data-cal-regen]").addEventListener("click", async () => {
      if (!window.confirm("Der alte Link funktioniert danach nicht mehr. Wirklich zurücksetzen?")) return;
      try {
        calendarToken = await DB.regenerateCalendarToken();
        const nu = calendarSubscribeUrl();
        if (nu) {
          // Nur der webcal-Knopf traegt die Adresse. Der Google-Knopf zeigt auf
          // eine feste Seite und haengt nicht am Token.
          const auf = q("[data-cal-open]"), kop = q("[data-cal-copy]");
          if (auf) { auf.setAttribute("href", nu.replace(/^https?:/i, "webcal:")); auf.removeAttribute("aria-disabled"); }
          if (kop) kop.removeAttribute("aria-disabled");
        }
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
  // "Training · Do 8. Okt · 19:30" (Dialog „Push senden“, Nachschliff D6)
  function rsTerminZeile(e) {
    return [e.typ === "spiel" ? (e.gegner || e.titel) : (e.titel || "Training"), fmtWd(e.datum) + " " + fmtDay(e.datum) + ". " + fmtMon(e.datum), e.zeit || ""].filter(Boolean).join(" · ");
  }
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
      + (list.length ? "\n" + list.map((x) => x.p.name + (x.grund ? ", " + x.grund : "")).join("\n") : "\nniemand");
    return kopf + block("Zugesagt", g.zu) + block("Abgesagt", g.ab) + block("Offen", g.offen);
  }

  function rsvpSheetHtml(e) {
    const g = rsGruppen(e.id);
    const gesamt = DEMO.players.length;
    const pz = gesamt ? (g.zu.length / gesamt) * 100 : 0;
    const pa = gesamt ? (g.ab.length / gesamt) * 100 : 0;
    const liste = rsFilter === "zu" ? g.zu : rsFilter === "ab" ? g.ab : g.offen;

    const kachel = (schl, label, n) =>
      '<button class="rs2-kachel is-' + schl + (rsFilter === schl ? " is-on" : "") + '" data-rsfilter="' + schl + '"' +
      ' aria-pressed="' + (rsFilter === schl ? "true" : "false") + '">' +
      '<span class="rs2-k-l">' + label + '</span><span class="rs2-k-z">' + n + '</span></button>';

    const zeile = (x) => '<div class="rs2-zeile">' +
      '<span class="rs2-av"><span>' + initials(x.p.name) + '</span></span>' +
      '<span class="rs2-n">' + esc(x.p.name) +
      (x.grund ? '<span class="rs2-grund">' + esc(x.grund) + '</span>' : "") + '</span></div>';

    return '<button class="more-backdrop" data-sheet-close aria-label="Schließen"></button>' +
      '<div class="more-panel rs2-panel" role="dialog" aria-modal="true" aria-label="Rückmeldungen">' +
      '<div class="rs2-griff" aria-hidden="true"></div>' +
      '<div class="rs2-kopf"><div class="rs2-kopf-text">' +
        '<div class="rs2-titel">Rückmeldungen</div>' +
        '<div class="rs2-sub">' + esc(rsKopfzeile(e)) + '</div></div>' +
        '<button class="rs2-zu" data-sheet-close aria-label="Schließen">' + ICON_X + '</button></div>' +
      '<div class="rs2-bar" role="img" aria-label="' + g.zu.length + ' zugesagt, ' + g.ab.length + ' abgesagt, von ' + gesamt + '">' +
        '<i class="is-zu" style="width:' + pz.toFixed(2) + '%"></i><i class="is-ab" style="width:' + pa.toFixed(2) + '%"></i></div>' +
      '<div class="rs2-kacheln">' +
        kachel("zu", "Zu", g.zu.length) +
        kachel("ab", "Ab", g.ab.length) +
        kachel("offen", "Offen", g.offen.length) + '</div>' +
      '<div class="rs2-liste">' +
        (liste.length ? liste.map(zeile).join("")
                      : '<div class="rs2-leer empty">Niemand in dieser Gruppe.</div>') + '</div>' +
      '<div class="rs2-fuss">' + rsFussHtml(e, g) + '</div></div>';
  }

  /* Fuss des Blatts (verbindliche Vorgabe, Abschnitt 4 im DELTA):
     "Push senden" (send_rsvp_reminder aus 0050, mit Empfaengerzahl,
     Bestaetigung und sichtbarer 12-h-Sperre), darunter "Teilen" (der
     bisherige Erinnern-Text) und "Übersicht teilen". Push nur fuer die echte
     Rolle Trainer oder Admin, nie in der Rollenvorschau; der Server prueft
     die Rolle ohnehin selbst.                                                */
  let rsPush = null;   // { eventId, laden, daten, fehler, meldung }
  function rsDarfPush(e) {
    return !Roles.isSimulating() && (Roles.real.indexOf("coach") !== -1 || Roles.isRealAdmin()) &&
      e.status !== "abgesagt" && (eventStartMs(e) || 0) > Date.now();
  }
  function rsUhr(iso) {
    const d = new Date(iso);
    const hm = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
    const heute = new Date(); heute.setHours(0, 0, 0, 0);
    const tag = new Date(d); tag.setHours(0, 0, 0, 0);
    const diff = Math.round((tag - heute) / 86400000);
    return diff === 0 ? hm : diff === 1 ? "morgen " + hm : diff === -1 ? "gestern " + hm : WT[d.getDay()] + " " + hm;
  }
  /* Fuß des Blatts (Nachschliff D6): Kader-Verweis als ganze Zeile über den
     Knöpfen, darunter zwei gleich breite Knöpfe „Übersicht teilen“
     (sekundär) und „Push senden“ (primär, send_rsvp_reminder aus 0050 mit
     Bestätigung und 12-h-Sperre). „Rückmeldung teilen“ entfällt. Push nur für
     die echte Rolle Trainer oder Admin, nie in der Rollenvorschau; ohne
     Berechtigung steht „Übersicht teilen“ allein. Sind keine Spieler offen,
     ist Push senden deaktiviert. */
  const RS_IC_TEILEN = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M7.5 7.5 12 3l4.5 4.5M5 12v7.5A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V12"/></svg>';
  const RS_IC_GLOCKE = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0"/></svg>';
  const RS_IC_KADER = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.8a3.5 3.5 0 0 1 0 6.4M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/></svg>';
  // Stand wie in der Vorlage („15 fit · 1 verletzt“): fit und die Ausfälle; angeschlagen
  // bleibt einsatzbereit und steht hier nicht, damit die Zeile kurz bleibt.
  function rsKaderStand() {
    const n = (st) => DEMO.players.filter((p) => (p.status || "fit") === st).length;
    const teile = [n("fit") + " fit"];
    if (n("verletzt")) teile.push(n("verletzt") + " verletzt");
    if (n("urlaub")) teile.push(n("urlaub") + " Urlaub");
    return teile.join(" · ");
  }
  function rsFussHtml(e, g) {
    const kader = '<div class="rs2-kader-b"><button type="button" class="rs2-kader" data-rs-kader>' + RS_IC_KADER +
      '<span class="rs2-kader-t">Kader</span><span class="rs2-kader-s">' + esc(rsKaderStand()) + '</span><span class="rs2-kader-c" aria-hidden="true">›</span></button></div>';
    const uebersicht = '<button type="button" class="btn rs2-sek" data-rs-teilen="' + e.id + '">' + RS_IC_TEILEN + '<span>Übersicht teilen</span></button>';
    if (!rsDarfPush(e)) return kader + '<div class="rs2-knoepfe is-eins">' + uebersicht + '</div>';
    const p = (rsPush && rsPush.eventId === e.id) ? rsPush : { laden: !!g.offen.length };
    const d = p.daten;
    let bereit = false, hinweis = "";
    if (!g.offen.length) hinweis = "";
    else if (p.laden) hinweis = "";
    else if (p.fehler) hinweis = p.fehler;
    else if (d && d.gesperrt) hinweis = "Erinnert " + (d.letzte ? rsUhr(d.letzte) : "") + (d.naechste_moeglich ? " · wieder ab " + rsUhr(d.naechste_moeglich) : "");
    else if (d && !d.gesendet) hinweis = "Niemand per Push erreichbar" + rsGruende(d, true);
    else bereit = !!d;
    const push = '<button type="button" class="btn btn-primary rs2-push-b" ' + (bereit ? 'data-rs-push="' + e.id + '"' : "disabled") +
      (p.laden && g.offen.length ? ' aria-busy="true"' : "") + '>' + RS_IC_GLOCKE + 'Push senden</button>';
    return kader + '<div class="rs2-knoepfe">' + uebersicht + push + '</div>' +
      (p.meldung ? '<div class="rs2-meldung" role="status">' + esc(p.meldung) + '</div>' : "") +
      (hinweis ? '<div class="rs2-hinweis">' + esc(hinweis) + '</div>' : "");
  }
  // ", 2 ohne Push-Abo, 1 ohne Konto" (nur Werte > 0)
  function rsGruende(d, mitKomma) {
    const t = [];
    if (d.ohne_abo) t.push(d.ohne_abo + " ohne Push-Abo");
    if (d.ohne_konto) t.push(d.ohne_konto + " ohne Konto");
    if (d.abgeschaltet) t.push(d.abgeschaltet + (d.abgeschaltet === 1 ? " hat" : " haben") + " Erinnerungen abgeschaltet");
    if (d.ausgenommen) t.push(d.ausgenommen + " im Urlaub oder verletzt, ausgenommen");
    return t.length ? (mitKomma ? ": " : "") + t.join(", ") : "";
  }
  function rsFehlerText(err) {
    if (err && err.code === "42501") return "Keine Berechtigung.";
    return "Push nicht möglich: " + ((err && err.message) || err);
  }
  async function rsPushZaehlen(e, neuZeichnen) {
    rsPush = { eventId: e.id, laden: true };
    try {
      const d = await DB.sendRsvpReminder(e.id, true);
      if (!rsPush || rsPush.eventId !== e.id) return;
      rsPush = { eventId: e.id, laden: false, daten: d };
    } catch (err) {
      if (!rsPush || rsPush.eventId !== e.id) return;
      rsPush = { eventId: e.id, laden: false, fehler: rsFehlerText(err) };
    }
    neuZeichnen();
  }
  /* Bestätigung vor dem Senden (Nachschliff D6): mittiger Dialog mit
     Glocke, Frage mit Anzahl N, Termin darunter, Abbrechen | Senden. */
  function rsPushBestaetigen(d, e) {
    return new Promise((resolve) => {
      const ov = document.createElement("div");
      ov.className = "modal-ov"; ov.id = "pushModal";
      ov.innerHTML = `
        <div class="modal push-best" role="dialog" aria-modal="true" aria-label="Push senden">
          <span class="push-best-ic" aria-hidden="true">${RS_IC_GLOCKE.replace('width="18" height="18"', 'width="22" height="22"')}</span>
          <div class="push-best-t">Push an ${d.gesendet} offene${d.gesendet === 1 ? "n Spieler" : " Spieler"} senden?</div>
          <div class="push-best-s">${e ? esc(rsTerminZeile(e)) : ""}</div>
          <div class="push-best-k">
            <button type="button" class="btn nsb-sek" data-push-abbr>Abbrechen</button>
            <button type="button" class="btn btn-primary nsb-prim" data-push-ok>Senden</button>
          </div>
        </div>`;
      document.body.appendChild(ov);
      const zu = (wert) => { ov.remove(); resolve(wert); };
      ov.addEventListener("click", (ev) => {
        if (ev.target.closest("[data-push-ok]")) zu(true);
        else if (ev.target === ov || ev.target.closest("[data-push-abbr]")) zu(false);
      });
    });
  }
  async function rsPushSenden(e, neuZeichnen) {
    const d0 = rsPush && rsPush.daten;
    if (!d0 || !d0.gesendet || d0.gesperrt) return;
    if (!(await rsPushBestaetigen(d0, e))) return;
    rsPush = { eventId: e.id, laden: true };
    neuZeichnen();
    try {
      const d = await DB.sendRsvpReminder(e.id, false);
      let meldung;
      if (d.gesendet > 0) {
        meldung = "An " + d.gesendet + " gesendet";
        if (d.ohne_abo) meldung += " · " + d.ohne_abo + " ohne Push-Abo";
        if (d.in_ruhezeit) meldung += " · " + d.in_ruhezeit + " in der Ruhezeit, Zustellung ab " + (d.zustellung_ab || "Ende der Ruhezeit");
      } else if (d.gesperrt) {
        meldung = "Nicht gesendet: heute schon erinnert.";
      } else {
        meldung = "Nicht gesendet: niemand per Push erreichbar.";
      }
      rsPush = { eventId: e.id, laden: false, daten: d, meldung };
    } catch (err) {
      rsPush = { eventId: e.id, laden: false, fehler: rsFehlerText(err) };
    }
    neuZeichnen();
  }

  function openRsvpSheet(eventId) {
    if (!Roles.canManageEvents()) return;   // zweite Schranke; RLS ist die erste
    const e = DEMO.events.find((x) => x.id === eventId);
    if (!e) return;
    closeRsvpSheet();
    rsFilter = "offen";
    rsPush = null;

    const ov = document.createElement("div");
    ov.className = "more-sheet"; ov.id = "rsvpSheet";
    ov.innerHTML = rsvpSheetHtml(e);
    document.body.appendChild(ov);
    lockBodyScroll();

    const neuZeichnen = () => {
      if (!document.body.contains(ov)) return;
      const liste = ov.querySelector(".rs2-liste");
      const pos = liste ? liste.scrollTop : 0;
      ov.innerHTML = rsvpSheetHtml(e);
      const neu = ov.querySelector(".rs2-liste");
      if (neu) neu.scrollTop = pos;
      sheetSwipeToClose(ov.querySelector(".more-panel"), ov.querySelector(".rs2-liste"), closeRsvpSheet);
    };
    ov.addEventListener("click", (ev) => {
      const f = ev.target.closest("[data-rsfilter]");
      if (f) { rsFilter = f.dataset.rsfilter; neuZeichnen(); return; }
      if (ev.target.closest("[data-rs-push]")) { rsPushSenden(e, neuZeichnen); return; }
      if (ev.target.closest("[data-rs-kader]")) { closeRsvpSheet(); navJumpTo("kader"); return; }
      if (ev.target.closest("[data-rs-teilen]")) { openShareModal("Rückmeldungen", rueckmeldeText(e)); return; }
      if (ev.target === ov || ev.target.closest("[data-sheet-close]")) closeRsvpSheet();
    });
    sheetSwipeToClose(ov.querySelector(".more-panel"), ov.querySelector(".rs2-liste"), closeRsvpSheet);
    if (rsDarfPush(e) && rsGruppen(e.id).offen.length) rsPushZaehlen(e, neuZeichnen);
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
    // Der naechste Termin (noch nicht vorbei) traegt Goldlinie und grosse Knoepfe.
    const naechsterTermin = kommend.filter((e) => istOffen(e) && e.status !== "abgesagt")
      .sort((a, b) => (eventStartMs(a) || 0) - (eventStartMs(b) || 0))[0];
    const naechsterId = naechsterTermin ? naechsterTermin.id : null;

    // Abo-Hinweis: unter der gerade beantworteten Karte, wenn die Rueckmeldung
    // in dieser Sitzung fiel und die Karte im aktuellen Filter auch sichtbar
    // ist - sonst ueber der Liste.
    let platz = aboHinweisPlatz(currentProfile, hatEigeneRueckmeldung(), aboSitzung);
    if (platz && platz.ort === "karte" && !kommend.some((e) => e.id === platz.eventId)) {
      platz = { ort: "liste", eventId: null };
    }

    viewEl.innerHTML = `
      <div class="page-head h1row kal-kopf">${navBackChevronHtml()}<h1>Kalender</h1>${Roles.canManageSchedule() ? `<button class="link-btn kal-plus" data-termin-new type="button">+ Termin</button>` : ""}</div>
      <div class="kal-seg" role="tablist">
        ${filters.map((f) => `<button class="kal-seg-b ${kalFilter === f.k ? "is-on" : ""}" role="tab" aria-selected="${kalFilter === f.k}" data-filter="${f.k}">${f.label}</button>`).join("")}
      </div>
      ${platz && platz.ort === "liste" ? aboKachelHtml(true) : ""}
      ${kommend.length ? `<div class="event-list">${kommend.map((e) => terminKarteHtml(e, { naechster: !!naechsterId && e.id === naechsterId }) +
          ((platz && platz.ort === "karte" && platz.eventId === e.id) ? aboKachelHtml(true) : "")).join("")}</div>`
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
    const msg = bfvMsg ? `<p class="ein-hinweis bfv-msg">${esc(bfvMsg)}</p>` : "";
    // Zeitpunkt relativ: "heute, 14:30", "gestern, 08:27", sonst "02.10., 08:27".
    const wann = (() => {
      if (!DEMO.icalSyncedAt) return "noch nie";
      const d = new Date(DEMO.icalSyncedAt); if (isNaN(d)) return "noch nie";
      const hm = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
      const heute = new Date(); heute.setHours(0, 0, 0, 0);
      const tag = new Date(d); tag.setHours(0, 0, 0, 0);
      const diff = Math.round((heute - tag) / 86400000);
      return (diff === 0 ? "heute" : diff === 1 ? "gestern" : String(d.getDate()).padStart(2, "0") + "." + String(d.getMonth() + 1).padStart(2, "0") + ".") + ", " + hm;
    })();
    const status = (an) => '<div class="card ein-status ein-status-eng">' +
      '<div class="ein-status-kopf"><span class="ein-status-t">Verbindung</span>' +
        '<span class="mark ' + (an ? "is-gruen" : "") + '"><span>' + (an ? "Verbunden" : "Nicht verbunden") + '</span></span></div>' +
      (an ? '<p class="ein-status-s">Zuletzt abgeglichen ' + esc(wann) + '</p>' : "") + '</div>';
    if (configured) {
      const team = (DEMO.teamName || "").trim();
      const verein = team.replace(/\s+\d+$/, "") || team;
      const jetzt = new Date();
      const startJahr = jetzt.getMonth() >= 6 ? jetzt.getFullYear() : jetzt.getFullYear() - 1;   // Saison Juli bis Juni
      const saison = startJahr + "/" + String((startJahr + 1) % 100).padStart(2, "0");
      const wert = (titel, w, attr) => '<' + (attr ? 'button type="button" ' + attr : 'div') + ' class="ein-schalter ein-wertzeile">' +
        '<span class="ein-schalter-main"><span class="ein-schalter-t">' + titel + '</span></span>' +
        '<span class="ein-zeit-wert">' + esc(w) + '</span>' +
        (attr ? '<span class="ein-chev" aria-hidden="true">\u203A</span>' : "") + '</' + (attr ? 'button' : 'div') + '>';
      return status(true) +
        '<div class="group-head"><h2>Mannschaft</h2></div>' +
        '<div class="ein-gruppe ein-gruppe-gross">' +
          wert("Verein", verein) + wert("Mannschaft", team || "Ohne Namen", "data-bfv-change") + wert("Saison", saison) +
        '</div>' +
        '<div class="group-head"><h2>Verbindung</h2></div>' +
        '<button class="card ein-gefahr ein-gefahr-gross" data-bfv-trennen type="button">' +
          '<span class="ein-gefahr-main"><span class="ein-gefahr-t">Verbindung trennen</span>' +
          '<span class="ein-gefahr-s">Bereits übernommene Spiele bleiben.</span></span>' +
          '<span class="ein-chev is-rot" aria-hidden="true">›</span></button>' +
        '<button class="btn btn-primary ein-voll bfv-abgleich" data-bfv-sync type="button"><span>Jetzt abgleichen</span></button>' +
        '<p class="ein-hinweis">Läuft zusätzlich täglich automatisch.</p>' + msg;
    }
    return status(false) +
      '<div class="group-head"><h2>Adresse</h2></div>' +
      '<input id="bfvUrl" class="sb-feld bfv-url" data-ical-input type="url" inputmode="url" autocapitalize="off" spellcheck="false" placeholder="https://www.bfv.de/mannschaften/…" aria-label="Adresse der Mannschaftsseite von bfv.de">' +
      '<p class="ein-hinweis">Adresse der Mannschaftsseite von bfv.de hier einfügen.</p>' + msg +
      '<button class="btn btn-primary ein-voll bfv-abgleich" data-bfv-connect type="button">Verbinden</button>' +
      (DEMO.icalUrl ? '<button class="btn btn-soft ein-voll bfv-abbr" data-bfv-cancel type="button">Abbrechen</button>' : "");
  }

  /* ---------- Push-Katalog (nur Admin) ---------------------------------------
     Jede Nachricht einmal ansehen, bevor sie an die Mannschaft geht - und die
     Texte aendern koennen, ohne zu deployen. Die Vorlagen liegen in
     notification_templates; hier stehen keine Texte, nur ihre Darstellung.

     Die nachgebauten Mitteilungen imitieren absichtlich iOS und Android und
     nicht unser Design: eine Vorschau in Vereinsgruen saehe huebsch aus und
     zeigte nicht, was der Nutzer tatsaechlich sieht.                        */

  let katVorlagen = null;      // geladene Zeilen aus notification_templates
  let katEntwurf  = {};        // kategorie -> { titel, text }, ungespeichert
  let katMeldung  = "";

  // Ab diesen Laengen kuerzen die Sperrbildschirme. Gemessen an der Praxis,
  // nicht an einer Spezifikation - beide Systeme kuerzen geraeteabhaengig.
  const KAT_TITEL_MAX = 40;
  const KAT_TEXT_MAX  = 110;

  /* Dieselbe Regel wie render_vorlage() in der Datenbank. Rein rechnend.
     Rueckgabe: { text } oder { fehler } - nie ein halb ersetzter Text.     */
  function katRender(vorlage, daten, erlaubt, optional) {
    const roh = String(vorlage == null ? "" : vorlage);
    const namen = [];
    const re = /\{([a-zA-Z0-9_]+)\}/g;
    let m;
    while ((m = re.exec(roh)) !== null) if (namen.indexOf(m[1]) < 0) namen.push(m[1]);
    let out = roh;
    let geleert = false;
    for (const n of namen) {
      if (erlaubt && erlaubt.length && erlaubt.indexOf(n) < 0) {
        return { fehler: "Unbekannter Platzhalter {" + n + "}" };
      }
      const w = daten ? daten[n] : null;
      if (w == null || String(w).trim() === "") {
        // Optional: raus damit und den Satz danach aufraeumen.
        if (optional && optional.indexOf(n) >= 0) {
          out = out.split("{" + n + "}").join("");
          geleert = true;
          continue;
        }
        return { fehler: "Kein Wert für {" + n + "}" };
      }
      out = out.split("{" + n + "}").join(String(w));
    }
    if (geleert) {
      out = out.replace(/\s+([.,;:!?])/g, "$1")
               .replace(/\s{2,}/g, " ")
               .replace(/([.!?])\s*\1+/g, "$1")
               .trim();
    }
    return { text: out };
  }

  /* Zeichen zaehlen, wie der Nutzer sie sieht: ein Emoji ist EIN Zeichen,
     auch wenn es aus mehreren UTF-16-Einheiten besteht. "⚠️" hat length 2,
     ist aber ein Graphem. Intl.Segmenter gibt es ab Safari 16.4 - also
     ueberall, wo Push ueberhaupt laeuft; der Notnagel deckt aeltere
     Browser ab, in denen der Admin die Seite oeffnet. */
  const katSeg = (typeof Intl !== "undefined" && Intl.Segmenter)
    ? new Intl.Segmenter("de", { granularity: "grapheme" }) : null;
  function katLaenge(t) {
    const x = String(t == null ? "" : t);
    if (katSeg) { let n = 0; for (const _ of katSeg.segment(x)) n++; return n; }
    return Array.from(x.replace(/[\uFE0F\u200D]/g, "")).length;
  }

  // Aktueller Stand einer Kategorie: ungespeicherter Entwurf schlaegt die
  // gespeicherte Vorlage.
  function katStand(v) {
    const e = katEntwurf[v.kategorie] || {};
    return { titel: e.titel !== undefined ? e.titel : v.titel_vorlage,
             text:  e.text  !== undefined ? e.text  : v.text_vorlage,
             geaendert: e.titel !== undefined || e.text !== undefined };
  }

  function katZaehler(laenge, max) {
    const zuviel = laenge > max;
    return '<span class="pkat-zahl' + (zuviel ? " is-lang" : "") + '">' + laenge + "/" + max +
      (zuviel ? " · wird abgeschnitten" : "") + "</span>";
  }

  /* Nachgebaute Mitteilung. art = "ios" | "android". */
  function katMitteilungHtml(art, titel, text) {
    if (art === "ios") {
      return '<div class="mt mt-ios">' +
        '<span class="mt-ic" aria-hidden="true"><img src="assets/icon-192.png" alt=""></span>' +
        '<span class="mt-main">' +
          '<span class="mt-kopf"><span class="mt-app">FASANERIE</span><span class="mt-zeit">jetzt</span></span>' +
          '<span class="mt-t">' + esc(titel) + '</span>' +
          '<span class="mt-x">' + esc(text) + '</span>' +
        '</span></div>';
    }
    return '<div class="mt mt-android">' +
      '<span class="mt-leiste"><span class="mt-badge" aria-hidden="true">' +
        '<img src="assets/badge-96.png" alt=""></span>' +
        '<span class="mt-app">Fasanerie · jetzt</span></span>' +
      '<span class="mt-t">' + esc(titel) + '</span>' +
      '<span class="mt-x">' + esc(text) + '</span>' +
      '</div>';
  }

  function katZeileHtml(v) {
    const st = katStand(v);
    const rt = katRender(st.titel, v.beispiel_daten, v.platzhalter, v.platzhalter_optional);
    const rx = katRender(st.text,  v.beispiel_daten, v.platzhalter, v.platzhalter_optional);
    const fehler = rt.fehler || rx.fehler;
    const titel = rt.text || st.titel;
    const text  = rx.text || st.text;

    return '<div class="card card-pad pkat-karte" data-kat="' + esc(v.kategorie) + '">' +
      '<div class="pkat-kopf">' +
        '<span class="pkat-name">' + esc(v.kategorie) + '</span>' +
        '<span class="pkat-marken">' +
          (v.urgency === "high" ? '<span class="tag tag-cancelled">zeitkritisch</span>' : "") +
          (v.aktiv ? "" : '<span class="tag tag-manuell">aus</span>') +
        '</span>' +
      '</div>' +
      '<p class="set-hint pkat-wer"><b>An:</b> ' + esc(v.empfaenger_beschreibung) + '<br>' +
        '<b>Wann:</b> ' + esc(v.ausloeser_beschreibung) + '</p>' +

      (fehler ? '<div class="tk-warn">' + esc(fehler) + '</div>' : "") +

      '<div class="pkat-vorschau">' +
        katMitteilungHtml("ios", titel, text) +
        katMitteilungHtml("android", titel, text) +
      '</div>' +

      '<label class="pkat-feld"><span class="pkat-lbl">Titel ' +
        katZaehler(katLaenge(titel), KAT_TITEL_MAX) + '</span>' +
        '<input class="pkat-in" data-pkat-titel="' + esc(v.kategorie) + '" value="' + esc(st.titel) + '"></label>' +
      '<label class="pkat-feld"><span class="pkat-lbl">Text ' +
        katZaehler(katLaenge(text), KAT_TEXT_MAX) + '</span>' +
        '<textarea class="pkat-in" rows="2" data-pkat-text="' + esc(v.kategorie) + '">' + esc(st.text) + '</textarea></label>' +
      katStrafhinweisHtml(v) +
      '<p class="set-hint pkat-platz">Platzhalter: ' +
        (v.platzhalter && v.platzhalter.length
          ? v.platzhalter.map((p) => {
              const opt = (v.platzhalter_optional || []).indexOf(p) >= 0;
              return "<code" + (opt ? ' class="is-opt" title="darf fehlen"' : "") +
                ">{" + esc(p) + "}" + (opt ? "?" : "") + "</code>";
            }).join(" ")
          : "keine") + '</p>' +

      '<div class="pkat-knoepfe">' +
        (st.geaendert
          ? '<button class="btn btn-primary" data-pkat-save="' + esc(v.kategorie) + '" type="button">Vorlage speichern</button>' +
            '<button class="btn btn-soft" data-pkat-reset="' + esc(v.kategorie) + '" type="button">Verwerfen</button>'
          : '<button class="btn btn-primary" data-pkat-send="' + esc(v.kategorie) + '" type="button"' +
            (fehler ? " disabled" : "") + '>An mich senden</button>') +
      '</div>' +
      '</div>';
  }

  /* Wortlaut von {strafhinweis} (Erinnerung an Zu- oder Absage, Migration
     0052/0056): steht in den Beispieldaten der Vorlage und gilt fuer Vorschau
     und Versand. Nur Termine mit Auto-Strafe bekommen ihn. */
  function katStrafhinweisHtml(v) {
    if (v.kategorie !== "rueckmeldung_erinnerung") return "";
    const wert = (v.beispiel_daten && v.beispiel_daten.strafhinweis) || "";
    return '<label class="pkat-feld"><span class="pkat-lbl">Strafhinweis (nur bei Terminen mit Auto-Strafe)</span>' +
        '<input class="pkat-in" maxlength="80" data-pkat-hinweis value="' + esc(wert) + '"></label>' +
      '<div><button class="btn btn-soft" data-pkat-hinweis-save type="button">Strafhinweis speichern</button></div>';
  }

  /* Push-Texte als Unterseite (Vorlage Final 25): Gruppen nach Thema wie in
     den Mitteilungen, Zeile mit sichtbarem Namen und Textvorlage, Marken
     "zeitkritisch"/"aus"; Tippen oeffnet die dritte Ebene mit Vorschau,
     Feldern, Strafhinweis und Senden. "Alle senden" und "Vorschauen loeschen"
     bleiben. "Zu wenig Zusagen" bleibt ausgeblendet (kein Erzeuger). */
  const KAT_NAME = {
    termin_neu: "Neuer Termin", termin_geaendert: "Termin geändert", rueckmeldung_erinnerung: "Erinnerung vor Meldeschluss",
    rueckmeldung_nachfrage: "Nachfrage per Push", termin_abgesagt: "Termin fällt aus",
    strafe_neu: "Neue Strafe", zahlung_bestaetigt: "Zahlung bestätigt", zahlung_abgelehnt: "Zahlung abgelehnt",
    strafen_offen: "Monatliche Erinnerung an offene Strafen", absage_kurzfristig: "Kurzfristige Absagen",
    meldeschluss_uebersicht: "Übersicht nach Meldeschluss", zahlung_gemeldet: "Zahlung gemeldet", test: "Testnachricht",
  };
  const KAT_THEMEN = [
    ["Termine", ["termin_neu", "termin_geaendert", "rueckmeldung_erinnerung", "rueckmeldung_nachfrage", "termin_abgesagt"]],
    ["Strafen", ["strafe_neu", "zahlung_bestaetigt", "zahlung_abgelehnt", "strafen_offen"]],
    ["Für Trainer", ["absage_kurzfristig", "meldeschluss_uebersicht"]],
    ["Für die Kasse", ["zahlung_gemeldet"]],
  ];
  function pushTexteHtml() {
    if (katVorlagen === null) {
      DB.loadNotificationTemplates()
        .then((v) => { katVorlagen = v; render(); })
        .catch((e) => { katVorlagen = []; katMeldung = "Laden fehlgeschlagen: " + ((e && e.message) || e); render(); });
      return '<p class="ein-hinweis">Vorlagen werden geladen …</p>';
    }
    const vorh = katVorlagen.filter((v) => v.kategorie !== "unterbesetzung");
    const bekannt = new Set(KAT_THEMEN.flatMap(([, ks]) => ks));
    const themen = KAT_THEMEN.concat([["System", vorh.map((v) => v.kategorie).filter((k) => !bekannt.has(k))]]);
    const zeile = (v) => '<button class="ein-schalter ein-wertzeile pkat-zeile" type="button" data-ein="pushtext" data-ein-param="' + esc(v.kategorie) + '">' +
      '<span class="ein-schalter-main"><span class="ein-schalter-t">' + esc(KAT_NAME[v.kategorie] || v.kategorie) + '</span>' +
      '<span class="ein-schalter-s pkat-vorlage">' + esc(v.text_vorlage || "") + '</span></span>' +
      (v.urgency === "high" ? '<span class="mark is-rot">zeitkritisch</span>' : "") +
      (v.aktiv ? "" : '<span class="mark">aus</span>') +
      '<span class="ein-chev" aria-hidden="true">\u203A</span></button>';
    return themen.map(([titel, ks]) => {
      const liste = ks.map((k) => vorh.find((v) => v.kategorie === k)).filter(Boolean);
      return liste.length ? '<div class="group-head"><h2>' + esc(titel) + '</h2></div><div class="ein-gruppe ein-gruppe-gross">' + liste.map(zeile).join("") + '</div>' : "";
    }).join("") +
      '<div class="group-head"><h2>Vorschauen</h2></div>' +
      '<div class="ein-gruppe">' + einZeileHtml({ attr: "data-pkat-clear", titel: "Vorschauen löschen", chev: false }) + '</div>' +
      '<p class="ein-hinweis">„Alle senden“ und „An mich senden“ gehen nur an dich, ohne Ruhezeit.</p>' +
      '<div class="cal-copied" data-pkat-meldung' + (katMeldung ? "" : " hidden") + '>' + esc(katMeldung) + '</div>';
  }
  function pushTextHtml(kat) {
    if (katVorlagen === null) return pushTexteHtml();
    const v = katVorlagen.find((x) => x.kategorie === kat);
    if (!v) return '<p class="ein-hinweis">Diese Vorlage gibt es nicht.</p>';
    return katZeileHtml(v) + '<div class="cal-copied" data-pkat-meldung' + (katMeldung ? "" : " hidden") + '>' + esc(katMeldung) + '</div>';
  }

  function renderPushKatalog() {
    // Alte Ansicht "Push-Nachrichten": leitet auf die Unterseite der Einstellungen um.
    if (Roles.isAdmin()) { switchView("einstellungen"); einOeffnen("pushtexte"); return; }
    renderDashboard();
    return;
  }
  function katSag(txt) {
    const el = document.querySelector("[data-pkat-meldung]");
    if (!el) return;
    el.textContent = txt; el.hidden = false;
  }

  /* "Alle an mich senden": nacheinander mit fuenf Sekunden Abstand. Ohne den
     Abstand legt das System sie als einen Stapel zusammen und man sieht nur
     die letzte. Nur aktive Kategorien. */
  async function katAlleSenden() {
    const liste = (katVorlagen || []).filter((v) => v.aktiv);
    for (let i = 0; i < liste.length; i++) {
      try { await DB.sendPreviewNotification(liste[i].kategorie); }
      catch (e) { katSag("Fehlgeschlagen bei " + liste[i].kategorie + ": " + ((e && e.message) || e)); return; }
      katSag((i + 1) + " von " + liste.length + " unterwegs: " + liste[i].kategorie);
      if (i < liste.length - 1) await new Promise((r) => setTimeout(r, 5000));
    }
    katSag(liste.length + " Vorschauen unterwegs. Sie kommen im Minutentakt des Versands an.");
  }

  /* ---------- Benachrichtigungen --------------------------------------------
     Standard Web Push, ein Weg fuer beide Systeme. Die Endpunkte
     (web.push.apple.com, fcm.googleapis.com, Mozilla) unterscheidet nur der
     Server; hier ist alles gleich.

     Die Plattformen setzen enge Grenzen, und fast jede davon scheitert STILL,
     wenn man sie verletzt - deshalb stehen sie hier ausgeschrieben:
       * iOS kennt Push erst ab 16.4 und NUR in der vom Home-Bildschirm
         gestarteten App. Im Safari-Tab gibt es kein PushManager-Objekt.
       * requestPermission() und subscribe() duerfen ausschliesslich direkt im
         Klick-Handler laufen. Beim Laden aufgerufen lehnt iOS wortlos ab.
       * userVisibleOnly: true, und der Service Worker MUSS zu jeder Push eine
         Notification zeigen. Sonst entzieht iOS die Berechtigung.
       * Aktionsknoepfe ignoriert iOS - kein Weg haengt an ihnen.
       * Deinstallieren und neu installieren macht das Abo ungueltig. Beim
         Start wird deshalb abgeglichen, ob der Server dieses Geraet kennt.  */

  // Oeffentlicher VAPID-Schluessel. Darf im Frontend stehen; der private liegt
  // ausschliesslich in der Vercel-Umgebung.
  const VAPID_PUBLIC = "BKCO7dmXu3KFwWoVhubEw_nhJJj-LTwx291RtsSfvu3ktS3nIFlyiT-p0cTiQe5rQhbOb8KHAYFFRdLrwPCP118";

  function b64urlZuBytes(s64) {
    const rest = "=".repeat((4 - (s64.length % 4)) % 4);
    const roh = atob((s64 + rest).replace(/-/g, "+").replace(/_/g, "/"));
    const b = new Uint8Array(roh.length);
    for (let i = 0; i < roh.length; i++) b[i] = roh.charCodeAt(i);
    return b;
  }

  /* ---- Umgebung erkennen ---- */
  function istStandalone() {
    try {
      return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches)
        || window.navigator.standalone === true;
    } catch (e) { return false; }
  }
  // In-App-Browser von WhatsApp, Instagram, Facebook und Co. Dort laesst sich
  // nicht installieren und Push nicht einrichten. Heuristik ueber die Kennung -
  // mehr gibt die Plattform nicht her.
  function istInAppBrowser(ua) {
    const u = ua || navigator.userAgent || "";
    if (/FBAN|FBAV|FB_IAB|Instagram|Line\/|Twitter|MicroMessenger|Snapchat|Pinterest|TikTok/i.test(u)) return true;
    if (/\bwv\b/.test(u)) return true;                       // Android WebView
    if (/Android.*Version\/[\d.]+\s+Chrome/i.test(u)) return true;   // WebView alter Bauart
    return false;
  }
  function pushUnterstuetzt() {
    return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  }

  /* Der Zustand der Einstellungsansicht. Rein rechnend, damit pruefbar.
     Reihenfolge ist Absicht: der handlungsleitende Hinweis gewinnt.        */
  function pushZustand(u) {
    if (u.inApp) return "inapp";                       // kann weder installieren noch abonnieren
    if (u.apple && !u.standalone) return "ios-install"; // erst installieren, dann Push
    if (!u.unterstuetzt) return "nicht-unterstuetzt";   // alter Browser, iOS unter 16.4
    if (u.permission === "denied") return "verweigert";
    if (u.permission === "granted" && u.abo) return "aktiv";
    return "bereit";
  }

  let pushAbo = null;            // aktuelle PushSubscription dieses Geraets
  let installPrompt = null;      // beforeinstallprompt, wenn der Browser ihn anbietet
  let pushPrefs = null;          // Zeile aus notification_prefs

  async function pushAboLesen() {
    if (!pushUnterstuetzt()) return null;
    try {
      const reg = await navigator.serviceWorker.ready;
      return await reg.pushManager.getSubscription();
    } catch (e) { return null; }
  }

  function pushUmgebung() {
    return {
      unterstuetzt: pushUnterstuetzt(),
      apple: istAppleGeraet(),
      standalone: istStandalone(),
      inApp: istInAppBrowser(),
      permission: ("Notification" in window) ? Notification.permission : "default",
      abo: !!pushAbo,
    };
  }

  /* Anmelden. NUR aus einem Klick-Handler heraus aufrufen. */
  async function pushAnmelden() {
    if (!pushUnterstuetzt()) return "nicht-unterstuetzt";
    let erlaubnis;
    try { erlaubnis = await Notification.requestPermission(); }
    catch (e) { erlaubnis = Notification.permission; }
    if (erlaubnis !== "granted") return erlaubnis;   // "denied" oder "default"

    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,                        // Pflicht, iOS verlangt es
        applicationServerKey: b64urlZuBytes(VAPID_PUBLIC),
      });
    }
    await DB.upsertPushSubscription(sub, istAppleGeraet() ? "ios" : "android");
    pushAbo = sub;
    // Der Hinweis hat seinen Zweck erfuellt.
    pushHinweisMerken();
    return "granted";
  }

  async function pushAbmelden() {
    const sub = await pushAboLesen();
    if (!sub) { pushAbo = null; return; }
    try { await DB.deletePushSubscription(sub.endpoint); } catch (e) { /* Server raeumt sonst selbst auf */ }
    try { await sub.unsubscribe(); } catch (e) {}
    pushAbo = null;
  }

  /* Beim Start abgleichen. Nur wenn die Berechtigung schon erteilt ist - ein
     subscribe() ohne Nutzergeste waere genau der Fehler, den iOS bestraft.
     Faelle, die das faengt: App geloescht und neu installiert, Abo vom Browser
     erneuert, Zeile serverseitig aufgeraeumt. */
  async function pushAbgleich() {
    if (!pushUnterstuetzt()) return;
    if (Notification.permission !== "granted") return;
    try {
      const sub = await pushAboLesen();
      if (!sub) { pushAbo = null; return; }
      pushAbo = sub;
      const bekannt = await DB.pushSubscriptionBekannt(sub.endpoint);
      if (!bekannt) await DB.upsertPushSubscription(sub, istAppleGeraet() ? "ios" : "android");
    } catch (e) { /* stillschweigend - der Nutzer hat nichts angefordert */ }
  }

  /* Einmaliger Hinweis, dass es Benachrichtigungen gibt. Wie beim
     Kalender-Hinweis serverseitig gemerkt, damit er nicht auf jedem Geraet
     neu auftaucht. Fehlschlaege bleiben still. */
  let pushHinweisSitzung = null;   // false = in dieser Sitzung erledigt
  function pushHinweisMerken() {
    if (pushPrefs && !pushPrefs.hint_dismissed_at) pushPrefs.hint_dismissed_at = new Date().toISOString();
    pushHinweisSitzung = false;
    const versuch = (n) => {
      DB.setNotificationPrefs({ hint_dismissed: true }).catch(() => {
        if (n < 3) setTimeout(() => versuch(n + 1), 2000 * n);
      });
    };
    versuch(1);
  }
  /* Zeigen? Nur wenn es serverseitig noch nicht erledigt ist, die Plattform
     ueberhaupt kann und noch nichts eingerichtet wurde. Rein rechnend.     */
  function pushHinweisZeigen(prefs, zustand, sitzung) {
    if (sitzung === false) return false;
    if (!prefs || prefs.hint_dismissed_at) return false;
    return zustand === "bereit" || zustand === "ios-install";
  }

  // Der einmalige Hinweis auf der Uebersicht. Gleiche Kachel wie beim
  // Kalender-Abo, damit kein neues Bauteil entsteht.
  function pushHinweisHtml() {
    const z = pushZustand(pushUmgebung());
    if (!pushHinweisZeigen(pushPrefs, z, pushHinweisSitzung)) return "";
    const titel = z === "ios-install"
      ? "Benachrichtigungen? Erst zum Home-Bildschirm"
      : "Nichts mehr verpassen?";
    return '<div class="kal-abo-wrap">' +
      '<button class="card kal-abo hat-x" data-view-jump="einstellungen" type="button">' +
        '<span class="kal-abo-ic" aria-hidden="true">' + ICON_GLOCKE + '</span>' +
        '<span class="kal-abo-main"><span class="kal-abo-t">' + titel + '</span></span>' +
        '<span class="kal-abo-chev" aria-hidden="true">›</span>' +
      '</button>' +
      '<button class="kal-abo-x" data-push-hinweis-weg type="button" aria-label="Hinweis ausblenden">✕</button>' +
      '</div>';
  }

  /* ---------- Schalter je Kategorie ------------------------------------------
     Die Namen stehen hier, die BESCHREIBUNG kommt aus dem Katalog
     (notification_infos) - sonst stuende sie zweimal und liefe auseinander.

     Die Gliederung folgt den Rollen. Was jemand nicht ist, sieht er nicht -
     und bekommt es auch dann nicht, wenn ein alter Schalter noch an steht:
     kategorie_erlaubt() in der Datenbank prueft die Rolle unabhaengig davon
     (Migration 0039). Die Einstellung bleibt gespeichert und greift wieder,
     sobald die Rolle zurueckkommt.                                          */
  const PN_GRUPPEN = [
    { rolle: "spieler", titel: "Spieler", kategorien: [
      // [Kategorie, Symbol (einIcon), Name, Kachelton]. Symbole und Toene aus
      // der Vorlage einst2.png, Trainer aus Panel 8 (einst3.png).
      ["strafe_neu",              "euro",        "Neue Strafe",                             "gold"],
      ["zahlung_bestaetigt",      "haken",       "Zahlung bestätigt",                       "gruen"],
      ["zahlung_abgelehnt",       "warnung",     "Zahlung abgelehnt",                       "rot"],
      ["rueckmeldung_erinnerung", "uhr",         "Erinnerung an Zu- oder Absage",           "dunkelgruen"],
      ["termin_abgesagt",         "kal-x",       "Termin fällt aus",                        "rot"],
      ["termin_geaendert",        "kal-stift",   "Termin geändert",                         "dunkelgruen"],
      ["termin_neu",              "kal-plus",    "Neue Termine",                            "gruen"],
      ["strafen_offen",           "wiederholen", "Monatliche Erinnerung an offene Strafen", "gold"],
    ] },
    { rolle: "coach", titel: "Trainer", kategorien: [
      ["absage_kurzfristig",      "glocke",      "Kurzfristige Absagen",                    "rot"],
      // "Zu wenig Zusagen" (unterbesetzung) folgt erst mit einer Mindestzahl je
      // Termintyp (F4); ohne Erzeuger kein Schalter (Konsistenzpruefung 06.10.2026).
      ["meldeschluss_uebersicht", "klemmbrett",  "Übersicht nach Meldeschluss",             "dunkelgruen"],
    ] },
    { rolle: "treasurer", titel: "Kasse", kategorien: [
      ["zahlung_gemeldet",        "boerse",      "Zahlung gemeldet",                        "gold"],
    ] },
  ];

  /* Welche Gruppen sieht dieser Nutzer? Rein rechnend, damit pruefbar.
       rollen      Liste aus my_roles()
       hatSpieler  mit einem Spieler verknuepft (profiles.player_id)         */
  function pnGruppenFuer(rollen, hatSpieler) {
    const r = rollen || [];
    return PN_GRUPPEN.filter((g) =>
      g.rolle === "spieler" ? !!hatSpieler : r.indexOf(g.rolle) >= 0);
  }

  /* Zustand des Sammelschalters einer Gruppe: "true", "false" oder "mixed". */
  function pnSammelZustand(gruppe, prefs) {
    if (!prefs) return "false";
    const werte = gruppe.kategorien.map((k) => !!prefs[k[0]]);
    if (werte.every(Boolean)) return "true";
    if (werte.every((v) => !v)) return "false";
    return "mixed";
  }

  let pnInfos = null;     // Zeilen aus notification_infos()

  function pnInfo(kategorie) {
    const i = (pnInfos || []).find((x) => x.kategorie === kategorie);
    return i ? i.ausloeser_beschreibung : "";
  }

  /* Einen Wert setzen. Optimistisch: erst lokal, dann speichern. Scheitert es
     endgueltig, geht der Schalter zurueck und sagt es - alles andere waere
     eine Luege auf dem Bildschirm. */
  function pnSetzen(felder, beiFehler) {
    if (!pushPrefs) return;
    const alt = {};
    for (const k of Object.keys(felder)) { alt[k] = pushPrefs[k]; pushPrefs[k] = felder[k]; }
    render();
    const versuch = (n) => {
      DB.setNotificationPrefs(felder).catch(() => {
        if (n < 3) { setTimeout(() => versuch(n + 1), 1500 * n); return; }
        for (const k of Object.keys(alt)) pushPrefs[k] = alt[k];
        render();
        pushMeldung(beiFehler || "Konnte nicht gespeichert werden");
      });
    };
    versuch(1);
  }

  function pnSchalterHtml(attrs, zustand, aus) {
    return '<button class="sw" role="switch" aria-checked="' + zustand + '"' +
      (aus ? " disabled" : "") + " " + attrs + ' type="button"></button>';
  }

  /* Eine Schalterzeile in einer Karte: Kachel, Titel, Unterzeile, Schalter
     (Vorlage einst2.png, Panel 3 und 4). Auch fuer "Push auf diesem Geraet". */
  function einSchalterZeileHtml(o) {
    return '<div class="ein-schalter' + (o.ic ? "" : " ohne-ic") + '">' +
      (o.ic ? '<span class="ein-ic ' + esc(o.ton || "gruen") + '" aria-hidden="true">' + einIcon(o.ic) + '</span>' : "") +
      '<span class="ein-schalter-main"><span class="ein-schalter-t">' + esc(o.titel) + '</span>' +
      (o.sub ? '<span class="ein-schalter-s">' + esc(o.sub) + '</span>' : "") + '</span>' +
      o.schalter +
      '</div>';
  }

  /* Anzeige nach Thema (Vorlage Final 19). Eine Zeile kann mehrere
     Kategorien schalten ("Neuer oder geänderter Termin"). Gezeigt wird eine
     Zeile nur, wenn alle ihre Kategorien zu den Rollen des Nutzers passen. */
  const PN_THEMEN = [
    { id: "termine", titel: "Termine", zeilen: [
      [["termin_neu", "termin_geaendert"], "Neuer oder geänderter Termin"],
      [["rueckmeldung_erinnerung"], "Erinnerung vor Meldeschluss"],
      [["termin_abgesagt"], "Termin fällt aus"],
    ] },
    { id: "strafen", titel: "Strafen", zeilen: [
      [["strafe_neu"], "Neue Strafe"],
      [["zahlung_bestaetigt"], "Zahlung bestätigt"],
      [["zahlung_abgelehnt"], "Zahlung abgelehnt"],
      [["strafen_offen"], "Monatliche Erinnerung an offene Strafen"],
    ] },
    { id: "trainer", titel: "Für Trainer", zeilen: [
      [["absage_kurzfristig"], "Kurzfristige Absagen"],
      [["meldeschluss_uebersicht"], "Übersicht nach Meldeschluss"],
    ] },
    { id: "kasse", titel: "Für die Kasse", zeilen: [
      [["zahlung_gemeldet"], "Zahlung gemeldet"],
    ] },
  ];
  function pnThemenFuer(rollen, hatSpieler) {
    const erlaubt = new Set(pnGruppenFuer(rollen, hatSpieler).flatMap((g) => g.kategorien.map((k) => k[0])));
    return PN_THEMEN.map((t) => ({ ...t, zeilen: t.zeilen.filter(([ks]) => ks.every((k) => erlaubt.has(k))) }))
      .filter((t) => t.zeilen.length);
  }
  function pnZeileHtml(z, aus, prefs) {
    const [ks, name] = z;
    const an = !!prefs && ks.every((k) => prefs[k]);
    return einSchalterZeileHtml({ titel: name,
      schalter: pnSchalterHtml('data-pn-kat="' + esc(ks.join(",")) + '" aria-label="' + esc(name) + '"', an ? "true" : "false", aus) });
  }

  function pnGruppenHtml(aus) {
    const rollen = (Roles.list || []);
    const hatSpieler = !!(currentProfile && currentProfile.player_id);
    return pnThemenFuer(rollen, hatSpieler).map((t) => {
      const ks = t.zeilen.flatMap(([k]) => k);
      const alleAn = !!pushPrefs && ks.every((k) => pushPrefs[k]);
      // Sammelschalter als Textverweis rechts im Gruppenkopf (bleibt aus der Vorversion).
      return '<div class="group-head ein-themenkopf"><h2>' + esc(t.titel) + '</h2>' +
          (aus || t.zeilen.length < 2 ? "" : '<button class="link-btn ein-alle" data-pn-thema="' + t.id + '" type="button">' + (alleAn ? "Alle aus" : "Alle an") + '</button>') +
        '</div>' +
        '<div class="ein-gruppe ein-gruppe-schalter' + (aus ? " is-aus" : "") + '">' +
          t.zeilen.map((z) => pnZeileHtml(z, aus, pushPrefs)).join("") +
        '</div>';
    }).join("");
  }

  /* Hinweis, solange es noch keine automatischen Nachrichten gibt (Paket
     "Automatische Mitteilungen" in PLAN.md). Eine Stelle: mit dem Paket wird
     die Konstante true, und der Hinweis ist weg. */
  const AUTO_MITTEILUNGEN_AKTIV = true;   // seit AM5 (05.10.2026): alle Erzeuger live
  function pnAutoHinweisHtml() {
    if (AUTO_MITTEILUNGEN_AKTIV) return "";
    return '<p class="ein-hinweis ein-hinweis-auto">Automatisch kommen bisher nur Nachrichten zur Kasse. ' +
      'Termine und Rückmeldungen folgen.</p>';
  }

  /* Ruhezeiten. Es gibt keine eigene Ja/Nein-Spalte: gleiche Von- und
     Bis-Zeit bedeutet "keine Ruhezeit" - so rechnet es in_quiet_hours()
     ohnehin. Ausschalten setzt beide auf 00:00, Einschalten auf 22:00/08:00.
     Nebenwirkung, die ich nicht verstecke: eigene Zeiten gehen beim
     Ausschalten verloren. */
  function pnRuhezeitHtml(aus) {
    const p = pushPrefs || {};
    const von = (p.quiet_from || "22:00").slice(0, 5);
    const bis = (p.quiet_to   || "08:00").slice(0, 5);
    const an  = von !== bis;
    const istAus = aus ? " is-aus" : "";
    // Vorlage Final 23: Gruppe "Nachts stumm" (Schalter, Von, Bis), darunter der
    // Hinweis (Folge nicht sichtbar), Gruppe "Ausnahmen" mit "Dringendes zustellen"
    // (bestehender Schalter quiet_override_urgent; "Spieltag" gibt es nicht).
    return '<div class="group-head"><h2>Nachts stumm</h2></div>' +
      '<div class="ein-gruppe ein-gruppe-schalter ein-gruppe-gross' + istAus + '">' +
        einSchalterZeileHtml({ titel: "Ruhezeiten aktiv",
          schalter: pnSchalterHtml('data-pn-ruhe aria-label="Ruhezeiten aktiv"', an ? "true" : "false", aus) }) +
        (an ? pnZeitZeileHtml("Von", "data-pn-von", von, aus) + pnZeitZeileHtml("Bis", "data-pn-bis", bis, aus) : "") +
      '</div>' +
      '<p class="ein-hinweis">In diesem Zeitraum kommt nichts an. Was liegen bleibt, wird danach zugestellt.</p>' +
      (an ? '<div class="group-head"><h2>Ausnahmen</h2></div>' +
        '<div class="ein-gruppe ein-gruppe-schalter ein-gruppe-gross' + istAus + '">' +
          einSchalterZeileHtml({ titel: "Dringendes zustellen", sub: "Absagen, Ausfall, Änderung, Erinnerung",
            schalter: pnSchalterHtml('data-pn-dringend aria-label="Dringendes trotzdem zustellen"',
              (pushPrefs && pushPrefs.quiet_override_urgent) ? "true" : "false", aus) }) +
        '</div>' : "");
  }

  /* Zeile mit Zeit-Pille. Die Pille zeigt den gespeicherten Wert selbst an,
     immer 24 Stunden ("22:00"). Darueber liegt das native Zeitfeld,
     unsichtbar und 44 px hoch: Tippen oeffnet die Auswahl des Systems, und
     ein "10:00 PM" auf einem englisch eingestellten iPhone kann die Pille
     nicht sprengen. 16 px Schrift, sonst zoomt iOS beim Fokus. */
  function pnZeitZeileHtml(titel, attr, wert, aus) {
    // Final 23: Zeile mit Wert rechts und Chevron; das native Zeitfeld liegt
    // unsichtbar ueber der ganzen Zeile (16 px, sonst zoomt iOS).
    return '<label class="ein-schalter ein-zeitzeile">' +
      '<span class="ein-schalter-main"><span class="ein-schalter-t">' + esc(titel) + '</span></span>' +
      '<span class="ein-zeit-wert" aria-hidden="true">' + esc(wert) + '</span>' +
      '<span class="ein-chev" aria-hidden="true">\u203A</span>' +
      '<input class="ein-zeit" type="time" ' + attr + ' value="' + esc(wert) + '"' +
        ' aria-label="Ruhezeit ' + esc(titel.toLowerCase()) + '"' + (aus ? " disabled" : "") + '>' +
    '</label>';
  }

  function pnAdminHtml() {
    if (!Roles.isAdmin()) return "";
    return '<p class="ein-hinweis ein-hinweis-admin">Keine eigenen Kategorien für Admins. Als Admin bekommst du, ' +
      'was deine übrigen Rollen vorsehen.</p>';
  }

  /* Der ganze Block. Erscheint in "bereit" und "aktiv": ohne eingeschalteten
     Hauptschalter stehen die Kategorien ausgegraut da, damit man sieht, was
     einen erwartet. Die Kategorien gelten fuer ALLE Geraete des Nutzers, der
     Hauptschalter nur fuer dieses - deshalb sind es zwei Ebenen. */
  function pnAbschnittHtml(zustand, teil) {
    if (zustand !== "bereit" && zustand !== "aktiv") return "";
    if (!pushPrefs) return "";
    const aus = zustand !== "aktiv";
    // Die Ruhezeiten haben seit dem neuen Aufbau eine eigene Unterseite. Der
    // Vorgabewert "alles" haelt den Baustein fuer jeden anderen Aufrufer heil.
    teil = teil || "alles";
    if (teil === "ruhezeiten") return pnRuhezeitHtml(aus);
    // Mitteilungen (Vorlage einst2.png, Panel 3 und 4): einzelne Karten auf
    // dem Grund, Hinweise darunter, kein Rahmen um alles.
    const geraet = istAppleGeraet() ? "iPhone" : "Gerät";
    return '<div class="ein-gruppe ein-gruppe-schalter ein-gruppe-erste ein-haupt">' +
        einSchalterZeileHtml({ titel: "Mitteilungen erlauben", sub: "Auf diesem " + geraet + (aus ? " aus" : " aktiv"),
          schalter: pnSchalterHtml('data-ein-haupt aria-label="Mitteilungen auf diesem ' + geraet + ' erlauben"', aus ? "false" : "true", false) }) +
      '</div>' +
      pnAutoHinweisHtml() +
      pnGruppenHtml(aus) +
      (teil === "alles" ? pnRuhezeitHtml(aus) : "") +
      pnAdminHtml();
  }

  /* Schlusshinweis der Mitteilungen; steht in der Vorlage unter dem Knopf
     "Testnachricht senden" (ohne den Knopf direkt unter den Gruppen). */
  function pnSchlussHinweisHtml() {
    return '<p class="ein-hinweis">Die Liste in der App zeigt alles, was du hier eingeschaltet hast, ' +
      'auch ohne Push auf diesem Gerät.</p>';
  }

  /* „Testnachricht senden" gibt es nur fuer Admins. Fuer alle anderen Rollen
     steht hier gar nichts, auch kein ausgegrauter Knopf. Der Server lehnt den
     Aufruf fuer Nicht-Admins ohnehin ab (send_test_notification, 0042).
     Rein rechnend, damit pushpruef.mjs es je Rolle pruefen kann. */
  function pnTestKnopfHtml(rollen) {
    if (!rollen || rollen.indexOf("admin") < 0) return "";
    return '<div class="group-head"><h2>Test</h2></div><div class="ein-gruppe ein-gruppe-aktion">' +
      '<button class="ein-zeile ein-zeile-aktion" data-push-test type="button">' +
        '<span class="ein-ic" aria-hidden="true">' + einIcon("senden") + '</span>' +
        '<span class="ein-zeile-t">Testnachricht senden</span>' +
      '</button></div>';
  }

  /* ---- Die Anzeige je Zustand ---- */
  function pushAbschnittHtml(teil) {
    teil = teil || "alles";
    const u = pushUmgebung();
    const z = pushZustand(u);
    // Auf einer Unterseite steht der Name schon als h1 darueber.
    const kopf = teil === "alles" ? '<div class="section-title"><h2>Benachrichtigungen</h2></div>' : "";
    let inhalt;

    /* Ruhezeiten setzen voraus, dass ueberhaupt zugestellt werden kann.
       Steht das noch aus, hat die Unterseite nichts zu schalten und sagt
       stattdessen, was zuerst zu tun ist. */
    if (teil === "ruhezeiten" && z !== "bereit" && z !== "aktiv") {
      return '<div class="card card-pad"><p class="set-hint">Ruhezeiten gelten für Benachrichtigungen. ' +
        'Die sind auf diesem Gerät noch nicht eingerichtet.</p>' +
        '<button class="btn" data-ein="mitteilungen" type="button">Zu den Mitteilungen</button></div>';
    }

    if (z === "inapp") {
      inhalt = '<p class="set-hint">Diese Seite läuft gerade im Browser einer anderen App. ' +
        'Dort lassen sich Benachrichtigungen nicht einrichten.</p>' +
        '<p class="set-hint"><b>' + (u.apple ? "In Safari öffnen" : "In Chrome öffnen") +
        '</b>, über das Menü oben rechts, und dort noch einmal hierherkommen.</p>';
    } else if (z === "ios-install") {
      inhalt = '<p class="set-hint">Auf dem iPhone gibt es Benachrichtigungen nur, wenn die App ' +
        'auf dem Home-Bildschirm liegt und von dort gestartet wird.</p>' +
        '<ol class="abo-schritte">' +
        '<li>Unten in Safari auf das Teilen-Symbol tippen.</li>' +
        '<li>In der Liste „Zum Home-Bildschirm" wählen, dann „Hinzufügen".</li>' +
        '<li>Die App vom Home-Bildschirm starten und hier wieder herkommen.</li>' +
        '</ol>';
    } else if (z === "nicht-unterstuetzt") {
      inhalt = '<p class="set-hint">Dieser Browser kann keine Benachrichtigungen. ' +
        'Die Liste in der App zeigt trotzdem alles an. Du verpasst nichts.</p>';
    } else if (z === "verweigert") {
      inhalt = '<p class="set-hint">Benachrichtigungen sind für diese App blockiert. ' +
        'Das lässt sich nur in den Systemeinstellungen zurücknehmen:</p>' +
        (u.apple
          ? '<ol class="abo-schritte"><li>Einstellungen öffnen.</li>' +
            '<li>Nach unten zu „Fasanerie" blättern.</li>' +
            '<li>„Mitteilungen" antippen und „Mitteilungen erlauben" einschalten.</li></ol>'
          : '<ol class="abo-schritte"><li>Im Browser auf das Schloss-Symbol neben der Adresse tippen.</li>' +
            '<li>„Berechtigungen" bzw. „Website-Einstellungen" öffnen.</li>' +
            '<li>„Benachrichtigungen" auf „Zulassen" stellen.</li></ol>') +
        '<p class="set-hint">Danach hier wieder herkommen.</p>';
    } else if (z === "aktiv") {
      inhalt = pnAbschnittHtml("aktiv", teil) +
        (teil === "ruhezeiten" ? "" : pnTestKnopfHtml(Roles.list) + pnSchlussHinweisHtml()) +
        '<div class="cal-copied" data-push-meldung hidden></div>';
    } else {   // "bereit"
      inhalt = (teil === "ruhezeiten" ? "" :
        '<p class="ein-hinweis ein-hinweis-oben">Kurzfristige Absagen, Terminänderungen und ' +
        'Rückmelde-Erinnerungen direkt aufs Handy.</p>') +
        pnAbschnittHtml("bereit", teil) +
        (teil === "ruhezeiten" ? "" : pnSchlussHinweisHtml()) +
        (installPrompt && !u.standalone
          ? '<button class="btn btn-soft" data-push-install type="button">App installieren</button>' : "") +
        '<div class="cal-copied" data-push-meldung hidden></div>';
    }

    // Mitteilungen mit Schaltern (aktiv, bereit): Karten direkt auf dem Grund,
    // wie in der Vorlage. Die Hinweis-Zustaende behalten ihre Karte.
    if (teil === "mitteilungen" && (z === "aktiv" || z === "bereit") && pushPrefs) {
      return '<div class="ein-mitteilungen" data-push-karte>' + inhalt + '</div>';
    }
    // Ruhezeiten (Vorlage einst2.png, Panel 5): ebenso Karten auf dem Grund.
    if (teil === "ruhezeiten" && (z === "aktiv" || z === "bereit") && pushPrefs) {
      return '<div class="ein-ruhezeiten" data-push-karte>' + inhalt + '</div>';
    }
    return '<div class="set-section">' + kopf +
      '<div class="card card-pad" data-push-karte>' + inhalt + '</div></div>';
  }

  function pushMeldung(txt) {
    const el = document.querySelector("[data-push-meldung]");
    if (!el) { if (txt) window.alert(txt); return; }
    el.textContent = txt; el.hidden = false;
    setTimeout(() => { el.hidden = true; }, 2600);
  }

  /* ---------- Deep Link aus einer Benachrichtigung ---------------------- */
  // Der Service Worker holt ein offenes Fenster nach vorn und schickt das Ziel
  // per postMessage. Kalter Start laeuft ueber den Hash und routeDeepLink().
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", (e) => {
      const d = e.data || {};
      if (d.typ === "deep-link" && d.ziel) routeDeepLink(d.ziel);
    });
  }

  // App-Symbol-Zaehler, wo die Plattform ihn kennt. Rein kosmetisch.
  function appBadgeSetzen(n) {
    try {
      if (n > 0 && navigator.setAppBadge) navigator.setAppBadge(n);
      else if (navigator.clearAppBadge) navigator.clearAppBadge();
    } catch (e) {}
  }
  /* ---------- Einstellungen: Unterseiten ------------------------------------
     Die Einstellungen sind ab hier zweistufig: eine Uebersicht aus Zeilen und
     vier Unterseiten. Jede Unterseite hat eine eigene Adresse, damit
     Browser-Zurueck, die Wischgeste und Deep Links aus einer Benachrichtigung
     dasselbe tun.

     WARUM HASH UND KEIN PFAD: vercel.json hat bewusst keine Catch-all-Regel
     auf index.html - ein echter Pfad wie /einstellungen/mitteilungen liefe
     beim Neuladen in einen 404. Die ganze App routet ueber Hashes
     (#ansicht=, #termin=, #kasse=, #strafe=), und genau die stehen auch in
     den Push-Vorlagen. #ein=<seite> reiht sich da ein.

     Der Hash BLEIBT stehen, solange eine Unterseite offen ist: er IST der
     Zustand. Nach einem Neuladen geht dieselbe Seite wieder auf.

     currentView bleibt dabei "einstellungen". Dadurch bleibt die Reiterleiste
     stehen, "Mehr" bleibt aktiv, und SHEET_VIEWS muss nichts wissen.
     -------------------------------------------------------------------------- */
  const EIN_SEITEN = {
    mitteilungen: { titel: "Mitteilungen",     darf: () => true },
    ruhezeiten:   { titel: "Ruhezeiten",       darf: () => true },
    kalender:     { titel: "Kalender abonnieren", darf: () => true },
    bfv:          { titel: "Spielplan BFV",    darf: () => Roles.isAdmin() },
    // Final 21, 25, 27: Profil, Push-Texte und Diagnose als Unterseiten.
    profil:       { titel: "Profil",           darf: () => true, ohneTitel: true },
    pushtexte:    { titel: "Push-Texte",       darf: () => Roles.isAdmin() },
    pushtext:     { titel: "Push-Text",        darf: () => Roles.isAdmin(), zurueck: "Push-Texte", mitParam: true },
    diagnose:     { titel: "Diagnose",         darf: () => true },
    // Final 28: Anleitung fuer Google, eine Ebene unter "Kalender abonnieren".
    google:       { titel: "Für Google",       darf: () => true, zurueck: "Kalender abonnieren" },
  };
  // Ab dieser Scrollhoehe klappt die grosse Ueberschrift in die Zurueck-Leiste
  // (Vorlage einstellungenneu2.png, Panel 4). Gemessen am Abstand von der
  // Leiste bis zur Unterkante der h1.
  const EIN_KOMPAKT_AB = 40;

  const einst = {
    seite:   null,   // null = Uebersicht, sonst Schluessel aus EIN_SEITEN
    param:   null,   // Zusatz der dritten Ebene (Kategorie bei "pushtext")
    scroll:  0,      // Scrollposition der Uebersicht, solange eine Unterseite offen ist
    kompakt: false,  // Titel steckt in der Zurueck-Leiste
    richtung: "rein",// fuer die Richtung des Uebergangs
  };

  function einSeiteErlaubt(id) {
    const s = EIN_SEITEN[id];
    return !!(s && s.darf());
  }

  /* Zerlegt einen Hash zu einer Unterseite. Rein rechnend, damit pruefbar. */
  function einZielAusHash(roh) {
    const h = String(roh == null ? (location.hash || "") : roh);
    const m = /^#?ein=([a-z]+)(?:\/([a-z_]+))?$/.exec(h);
    if (!m) return null;
    return einSeiteErlaubt(m[1]) ? m[1] : null;
  }

  /* Eine Unterseite oeffnen. Merkt die Scrollposition der Uebersicht, setzt
     einen Verlaufseintrag (damit Zurueck und Wischen funktionieren) und
     rendert. */
  function einParamAusHash() {
    const m = /^#?ein=[a-z]+\/([a-z_]+)$/.exec(location.hash || "");
    return m ? m[1] : null;
  }
  function einOeffnen(id, param) {
    if (!einSeiteErlaubt(id) || (einst.seite === id && einst.param === (param || null))) return;
    if (!einst.seite) einst.scroll = window.scrollY || window.pageYOffset || 0;
    einst.richtung = "rein";
    try { history.pushState({ einSeite: id }, "", "#ein=" + id + (param ? "/" + param : "")); } catch (e) {}
    einst.seite = id;
    einst.param = param || null;
    einst.kompakt = false;
    render();
    window.scrollTo(0, 0);
    einFokusAufTitel();
  }

  /* Zurueck zur Uebersicht - immer ueber den Verlauf, damit der Chevron
     dasselbe tut wie die Wischgeste und kein toter Eintrag zurueckbleibt. */
  function einZurueck() {
    if (!einst.seite) return;
    if (history.state && history.state.einSeite) { history.back(); return; }
    // Direkt per Deep Link hereingekommen: es gibt keinen Eintrag zum Zurueckgehen.
    try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {}
    einVerlassen();
  }

  function einVerlassen() {
    einst.seite = null;
    einst.param = null;
    einst.kompakt = false;
    einst.richtung = "zurueck";
    render();
    window.scrollTo(0, einst.scroll || 0);
  }

  /* Einzige Wahrheit ist der Hash. Wird bei popstate UND hashchange gerufen
     und tut nichts, wenn der Zustand schon stimmt - sonst rendert es zweimal. */
  function einSyncAusHash() {
    if (currentView !== "einstellungen") return false;
    const soll = einZielAusHash();
    const param = einParamAusHash();
    if (soll === einst.seite && param === einst.param) return false;
    if (!soll) { einVerlassen(); return true; }
    einst.richtung = "rein";
    einst.seite = soll;
    einst.param = param;
    einst.kompakt = false;
    render();
    window.scrollTo(0, 0);
    einFokusAufTitel();
    return true;
  }

  /* Vorlesesoftware soll die neue Ebene ansagen. Der Titel traegt dafuer
     tabindex="-1"; sichtbar passiert nichts (kein Fokusring auf einer
     Ueberschrift). */
  function einFokusAufTitel() {
    requestAnimationFrame(() => {
      const h = viewEl.querySelector(".ein-h1");
      if (h) { try { h.focus({ preventScroll: true }); } catch (e) {} }
    });
  }

  /* Titel klappt beim Scrollen in die Leiste. Nur eine Klasse umschalten,
     nicht neu rendern - ein Neuaufbau setzt die Scrollposition zurueck. */
  function einScrollBeobachter() {
    if (!einst.seite) return;
    const kopf = document.querySelector(".ein-kopf");
    if (!kopf) return;
    const an = (window.scrollY || window.pageYOffset || 0) > EIN_KOMPAKT_AB;
    if (an === einst.kompakt) return;
    einst.kompakt = an;
    kopf.classList.toggle("is-kompakt", an);
  }
  window.addEventListener("scroll", einScrollBeobachter, { passive: true });

  /* Kopf einer Unterseite: Zurueck-Leiste mit dem Namen der VORIGEN Ebene,
     darunter die grosse Ueberschrift. Beim Scrollen wandert der Titel in die
     Leiste (.is-kompakt). */
  function einKopfHtml(titel, zurueck) {
    return '<div class="ein-kopf">' +
      '<button class="ein-back" data-ein-back type="button">\u2039 ' + esc(zurueck || "Einstellungen") + '</button>' +
      '<span class="ein-kopf-t" aria-hidden="true">' + esc(titel) + '</span>' +
    '</div>';
  }

  /* Eine Zeile der Uebersicht: farbige Symbolkachel, Titel, optionaler Wert
     rechts, Chevron. Ganze Zeile ist die Tippflaeche. */
  function einZeileHtml(opts) {
    const ziel = opts.ein ? ' data-ein="' + esc(opts.ein) + '"'
               : opts.goto ? ' data-goto="' + esc(opts.goto) + '"'
               : opts.jump ? ' data-view-jump="' + esc(opts.jump) + '"'
               : opts.tat ? ' data-ein-tat="' + esc(opts.tat) + '"'
               // Freies Datenattribut fuer Aktionen mit eigenem Handler
               // (Kalender-Abo: data-cal-sheet, data-cal-copy-profil).
               : opts.attr ? ' ' + opts.attr : "";
    // Chevron nur, wo eine Ebene dahinter liegt. Eine reine Aktion ("App neu
    // laden") traegt keinen (README der Vorlage: "› nur, wenn die Zeile wegfuehrt").
    const chev = opts.chev !== false;
    return '<button class="ein-zeile' + (opts.aktion ? " ein-zeile-aktion" : "") + (opts.ic ? "" : " ohne-ic") + '" type="button"' + ziel + '>' +
      (opts.ic ? '<span class="ein-ic" aria-hidden="true">' + opts.ic + '</span>' : "") +
      '<span class="ein-zeile-t">' + esc(opts.titel) + '</span>' +
      (opts.wert != null && opts.wert !== "" ? '<span class="ein-zeile-w"' + (opts.wertAttr ? " " + opts.wertAttr : "") + '>' + esc(opts.wert) + '</span>' : "") +
      (chev ? '<span class="ein-chev" aria-hidden="true">\u203A</span>' : "") +
    '</button>';
  }

  /* ---------- Einstellungen (Tab „Mehr") ------------------------------------
     Zwei Ebenen: Uebersicht aus Zeilen, dahinter die Unterseiten. Welche
     Ebene gerendert wird, entscheidet einst.seite - gesetzt wird das
     ausschliesslich aus dem Hash (siehe einSyncAusHash). */
  function renderEinstellungen() {
    document.body.classList.remove("auth-mode");
    // Rolle kann sich geaendert haben, waehrend eine Unterseite offen war.
    if (einst.seite && !einSeiteErlaubt(einst.seite)) einst.seite = null;
    if (einst.seite) renderEinUnterseite(einst.seite);
    else renderEinUebersicht();
  }

  /* Symbole der Uebersichtszeilen. Als Funktion, nicht als Konstante: SVG
     steht weiter unten in der Datei und waere beim Auswerten noch nicht da. */
  function einIcon(name) {
    if (name === "glocke")   return `<svg ${SVG}><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5h4"/></svg>`;
    if (name === "buch")     return `<svg ${SVG}><path d="M5 4h14v16H7a2 2 0 0 1-2-2zM5 18a2 2 0 0 1 2-2h12M9 8h6M9 11h4"/></svg>`;
    if (name === "person")   return `<svg ${SVG}><path d="M12 12a4 4 0 1 0 0-8a4 4 0 0 0 0 8zM4 20a8 8 0 0 1 16 0"/></svg>`;
    if (name === "mond")     return `<svg ${SVG}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8"/></svg>`;
    if (name === "kalender") return `<svg ${SVG}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/></svg>`;
    if (name === "tabelle")  return `<svg ${SVG}><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M3 14h18M8 4v16"/></svg>`;
    if (name === "liste")    return `<svg ${SVG}><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/></svg>`;
    if (name === "sprech")   return `<svg ${SVG}><path d="M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z"/><path d="M8 9h8M8 13h5"/></svg>`;
    if (name === "info")     return `<svg ${SVG}><circle cx="12" cy="12" r="9"/><path d="M12 16v-5M12 8h.01"/></svg>`;
    if (name === "puls")     return `<svg ${SVG}><path d="M3 12h4l2.5-6 5 12 2.5-6H21"/></svg>`;
    // Mitteilungen (einst2.png, einst3.png)
    if (name === "euro")     return `<svg ${SVG}><circle cx="12" cy="12" r="9"/><path d="M15.5 8.5a4 4 0 1 0 0 7M7.5 10.5h6M7.5 13.5h6"/></svg>`;
    if (name === "haken")    return `<svg ${SVG}><circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.8 2.8L16.5 9.5"/></svg>`;
    if (name === "warnung")  return `<svg ${SVG}><path d="M12 3.5 2.8 19.5h18.4z"/><path d="M12 10v4M12 17h.01"/></svg>`;
    if (name === "uhr")      return `<svg ${SVG}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`;
    if (name === "kal-x")    return `<svg ${SVG}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M10 13.5l4 4M14 13.5l-4 4"/></svg>`;
    if (name === "kal-stift") return `<svg ${SVG}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M9.5 17.5l.5-2 4-4 1.5 1.5-4 4z"/></svg>`;
    if (name === "kal-plus") return `<svg ${SVG}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M12 13v5M9.5 15.5h5"/></svg>`;
    if (name === "wiederholen") return `<svg ${SVG}><path d="M17 3l3 3-3 3"/><path d="M4 11V9a3 3 0 0 1 3-3h13"/><path d="M7 21l-3-3 3-3"/><path d="M20 13v2a3 3 0 0 1-3 3H4"/></svg>`;
    if (name === "personen") return `<svg ${SVG}><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14a6.5 6.5 0 0 1 3.5 6"/></svg>`;
    if (name === "klemmbrett") return `<svg ${SVG}><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3"/></svg>`;
    if (name === "boerse")   return `<svg ${SVG}><rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 10h18M16 15h2"/></svg>`;
    if (name === "kal-haken") return `<svg ${SVG}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M9 15l2 2 4-4"/></svg>`;
    if (name === "link")     return `<svg ${SVG}><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.2 1.2"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2"/></svg>`;
    if (name === "senden")   return `<svg ${SVG}><path d="M21 3 10 14"/><path d="M21 3l-7 18-4-7-7-4z"/></svg>`;
    if (name === "neu")      return `<svg ${SVG}><path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/></svg>`;
    return "";
  }

  /* Wert rechts in der Zeile „Mitteilungen". Lesart: „An", wenn auf DIESEM
     Geraet zugestellt wird; „Aus", wenn der Nutzer es blockiert hat; sonst
     ist es schlicht noch nicht eingerichtet. */
  function einMitteilungenWert() {
    const z = pushZustand(pushUmgebung());
    if (z === "aktiv") return "An";
    if (z === "verweigert") return "Aus";
    return "Nicht eingerichtet";
  }

  /* Wert rechts in der Zeile „Ruhezeiten". Gleiche Von- und Bis-Zeit heisst
     „keine Ruhezeit" - so rechnet auch in_quiet_hours(). */
  function einRuhezeitWert() {
    const p = pushPrefs || {};
    const von = (p.quiet_from || "22:00").slice(0, 5);
    const bis = (p.quiet_to   || "08:00").slice(0, 5);
    if (!pushPrefs || von === bis) return "Aus";
    // "22:00" -> "22", "08:30" -> "8:30" (Vorlage "22 bis 8 Uhr")
    const kurz = (t) => { const [h, m] = t.split(":"); return String(parseInt(h, 10)) + (m === "00" ? "" : ":" + m); };
    return kurz(von) + " bis " + kurz(bis) + " Uhr";
  }

  /* Rollenzeile der Profilkarte: hoechste Rolle zuerst, unabhaengig davon, in
     welcher Reihenfolge my_roles() sie liefert („Administrator · Spieler“,
     Vorlage einst1.png). Unbekannte Rollen hinten, ohne Rolle „Spieler“.
     Rein rechnend, damit einpruef.mjs es pruefen kann. */
  const EIN_ROLLEN_FOLGE = ["admin", "coach", "treasurer", "player"];
  function einRollenText(rollen) {
    const r = (rollen || []).slice();
    if (!r.length) return "Spieler";
    const rang = (x) => { const i = EIN_ROLLEN_FOLGE.indexOf(x); return i < 0 ? 99 : i; };
    r.sort((a, b) => rang(a) - rang(b));
    return r.map((x) => ROLE_LABEL[x] || x).join(" · ");
  }
  const ROLLE_KURZ = { admin: "Admin", coach: "Trainer", treasurer: "Kassenwart", player: "Spieler" };
  function einRollenKurz(rollen) {
    const r = (rollen || []).slice();
    if (!r.length) return "Spieler";
    const rang = (x) => { const i = EIN_ROLLEN_FOLGE.indexOf(x); return i < 0 ? 99 : i; };
    r.sort((a, b) => rang(a) - rang(b));
    return r.map((x) => ROLLE_KURZ[x] || x).join(" · ");
  }
  // Mitgliederzahl fuer die Zeile "Rollen": erst nach dem Laden, kein Warten beim Oeffnen.
  let einMitglieder = null;
  function einMitgliederLaden() {
    if (!Roles.isAdmin() || einMitglieder != null || !DB.listMembers) return;
    DB.listMembers().then((m) => {
      einMitglieder = Array.isArray(m) ? m.length : null;
      const el = viewEl.querySelector("[data-ein-rollen]");
      if (el && einMitglieder != null) el.textContent = String(einMitglieder);
    }).catch(() => {});
  }

  /* Einstellungen (Vorlage Final 18): Profilzeile, "Für mich", "Verwaltung"
     (nur mit Recht), "Info". Abmelden steht im Profil, die Build-Kennung in
     der Diagnose. */
  function renderEinUebersicht() {
    const u = currentProfile || {};
    const player = u.player_id ? playerById[u.player_id] : null;
    const name = player ? player.name : (u.email || "Ohne Namen");
    const verwaltung = Roles.canManageSchedule() || Roles.canEditCatalog();
    const aboAn = !!(u.calendar_subscribe_started_at);
    einMitgliederLaden();

    viewEl.innerHTML = `
      <div class="page-head ein-start"><h1>Einstellungen</h1></div>

      <button class="ein-profil" type="button" data-ein="profil">
        <span class="avatar ein-profil-av">${initials(name)}</span>
        <span class="ein-profil-main">
          <span class="ein-profil-name">${esc(name)}</span>
          <span class="ein-profil-rolle">${esc(einRollenKurz(Roles.list))} · Profil ansehen</span>
        </span>
        <span class="ein-chev" aria-hidden="true">\u203A</span>
      </button>

      <div class="group-head"><h2>Für mich</h2></div>
      <div class="ein-gruppe">
        ${einZeileHtml({ ein: "mitteilungen", ic: einIcon("glocke"),   titel: "Mitteilungen", wert: einMitteilungenWert() })}
        ${einZeileHtml({ ein: "ruhezeiten",   ic: einIcon("mond"),     titel: "Ruhezeiten",  wert: einRuhezeitWert() })}
        ${einZeileHtml({ ein: "kalender",     ic: einIcon("kalender"), titel: "Kalender abonnieren", wert: aboAn ? "An" : "Aus" })}
      </div>

      ${verwaltung ? `
      <div class="group-head"><h2>Verwaltung</h2></div>
      <div class="ein-gruppe">
        ${Roles.isAdmin() ? einZeileHtml({ ein: "bfv", ic: einIcon("tabelle"), titel: "Spielplan BFV", wert: (DEMO && DEMO.icalUrl) ? "Verbunden" : "Nicht verbunden" }) : ""}
        ${einZeileHtml({ goto: "katalog", ic: einIcon("buch"), titel: "Strafenkatalog" })}
        ${Roles.isAdmin() ? einZeileHtml({ ein: "pushtexte", ic: einIcon("sprech"), titel: "Push-Texte" }) : ""}
        ${Roles.isAdmin() ? einZeileHtml({ goto: "admin", ic: einIcon("person"), titel: "Rollen", wert: einMitglieder != null ? String(einMitglieder) : "", wertAttr: "data-ein-rollen" }) : ""}
      </div>` : ""}

      <div class="group-head"><h2>Info</h2></div>
      <div class="ein-gruppe">
        ${einZeileHtml({ ein: "diagnose", ic: einIcon("puls"), titel: "Diagnose" })}
        ${einZeileHtml({ tat: "neuladen", ic: einIcon("neu"),  titel: "App neu laden", chev: false })}
      </div>
    `;
    // Rollen-Wert nachtragen, falls die Zahl schon da ist, aber das Element leer gerendert wurde
    if (einMitglieder != null) { const el = viewEl.querySelector("[data-ein-rollen]"); if (el) el.textContent = String(einMitglieder); }
  }

  /* Eine Unterseite. Kopf immer gleich, Inhalt je Seite - der Inhalt selbst
     kommt aus den Bausteinen, die es schon gibt. */
  function renderEinUnterseite(id) {
    const s = EIN_SEITEN[id];
    let inhalt = "";

    if (id === "mitteilungen") {
      inhalt = pushAbschnittHtml("mitteilungen");
    } else if (id === "ruhezeiten") {
      inhalt = pushAbschnittHtml("ruhezeiten");
    } else if (id === "kalender") {
      // Final 20: eine Ebene. Statuskarte, iPhone-Abo direkt, Link kopieren,
      // Anleitung fuer Google, Link zuruecksetzen.
      const an = !!(currentProfile && currentProfile.calendar_subscribe_started_at);
      inhalt =
        '<div class="card ein-status">' +
          '<div class="ein-status-kopf"><span class="ein-status-t">Status</span>' +
            '<span class="mark ' + (an ? "is-gruen" : "") + '">' + (an ? "Eingerichtet" : "Nicht eingerichtet") + '</span></div>' +
          '<p class="ein-status-s">Termine erscheinen im Handy-Kalender und bleiben aktuell.</p>' +
        '</div>' +
        '<div class="group-head"><h2>iPhone und iPad</h2></div>' +
        '<a class="btn btn-primary ein-voll" data-cal-open-ein href="#" aria-disabled="true">Im iPhone-Kalender abonnieren</a>' +
        '<div class="group-head"><h2>Android und Google</h2></div>' +
        '<button class="btn btn-soft ein-voll" data-cal-copy-profil type="button">Link kopieren</button>' +
        '<div class="cal-copied ein-rueckmeldung" data-cal-copied-profil hidden></div>' +
        '<div class="ein-fusszeile"><span>Google übernimmt Änderungen bis zu 24 h später.</span>' +
          '<button class="link-btn" data-ein="google" type="button">Anleitung ›</button></div>' +
        '<button class="card ein-gefahr" data-cal-regen-ein type="button">' +
          '<span class="ein-gefahr-main"><span class="ein-gefahr-t">Link zurücksetzen</span>' +
          '<span class="ein-gefahr-s">Der alte Link funktioniert danach nicht mehr.</span></span>' +
          '<span class="ein-chev is-rot" aria-hidden="true">›</span></button>';
    } else if (id === "google") {
      const schritt = (n, t, sub) => '<div class="ein-schritt"><span class="ein-schritt-n"><span>' + n + '</span></span>' +
        '<span class="ein-schritt-main"><span class="ein-schritt-t">' + t + '</span><span class="ein-schritt-s">' + sub + '</span></span></div>';
      inhalt =
        '<div class="group-head"><h2>In drei Schritten</h2></div>' +
        '<div class="ein-gruppe ein-schritte">' +
          schritt(1, "Link kopieren", "Mit dem Knopf unten.") +
          schritt(2, "calendar.google.com öffnen", "Im Browser, links bei „Weitere Kalender“ auf Plus, dann „Per URL“.") +
          schritt(3, "Link einfügen", "Mit „Kalender hinzufügen“ bestätigen.") +
        '</div>' +
        '<a class="btn btn-primary ein-voll" data-cal-google-ein href="' + GOOGLE_ADD_URL + '" target="_blank" rel="noopener noreferrer"><span>calendar.google.com öffnen</span></a>' +
        '<button class="btn btn-soft ein-voll" data-cal-copy-profil type="button"><span>Link kopieren</span></button>' +
        '<div class="cal-copied ein-rueckmeldung" data-cal-copied-profil hidden></div>' +
        '<p class="ein-fuss-mitte"><span>Google übernimmt Änderungen bis zu 24 h später.</span></p>' +
        '<p class="ein-hinweis ein-hinweis-mitte">Am Handy ggf. „Desktop-Version“ wählen. Das Abo lässt sich nur einmalig über die Web-Oberfläche anlegen, danach erscheint der Kalender in deiner Kalender-App.</p>';
    } else if (id === "diagnose") {
      inhalt = diagnoseHtml();
    } else if (id === "pushtexte") {
      inhalt = pushTexteHtml();
    } else if (id === "pushtext") {
      inhalt = pushTextHtml(einst.param);
    } else if (id === "profil") {
      inhalt = profilInhaltHtml();
    } else if (id === "bfv") {
      inhalt = bfvSectionHtml();
    }

    viewEl.innerHTML =
      einKopfHtml(s.titel, s.zurueck) +
      '<div class="ein-body ' + (einst.richtung === "zurueck" ? "ein-anim-zurueck" : "ein-anim-rein") + '">' +
        (s.ohneTitel ? "" : (id === "pushtexte"
          ? '<div class="ein-h1-zeile"><h1 class="ein-h1" tabindex="-1">' + esc(s.titel) + '</h1><button class="link-btn kal-plus" data-pkat-alle type="button">Alle senden</button></div>'
          : '<h1 class="ein-h1" tabindex="-1">' + esc(id === "pushtext" ? (KAT_NAME[einst.param] || s.titel) : s.titel) + '</h1>')) +
        inhalt +
      '</div>';
    if (id === "kalender") einAboAdresseNachtragen();
  }

  /* Diagnose als Unterseite (Vorlage Final 27): App (Version, Zuletzt geladen,
     Offline-Speicher), Gerät (Mitteilungen, Als App installiert), "Bericht
     kopieren". Darunter bleibt "Hilfe": Online, Letzter Fehler, Cache leeren
     und neu laden, Protokoll (die vollständige Diagnose aus index.html, die
     auch ohne app.js da ist). */
  function diagnoseHtml() {
    const L = window.__bootL || { phases: [], errors: [] };
    const wert = (titel, w, sub, attr, chev) => '<' + (attr ? 'button type="button" ' + attr : 'div') + ' class="ein-schalter ein-wertzeile">' +
      '<span class="ein-schalter-main"><span class="ein-schalter-t">' + titel + '</span>' + (sub ? '<span class="ein-schalter-s is-rot">' + sub + '</span>' : "") + '</span>' +
      (w != null ? '<span class="ein-zeit-wert">' + esc(w) + '</span>' : "") +
      (chev ? '<span class="ein-chev" aria-hidden="true">\u203A</span>' : "") + '</' + (attr ? 'button' : 'div') + '>';
    const html = window.__HTML_BUILD;
    const geladen = (() => {
      const d = new Date(L.at || Date.now()); if (isNaN(d)) return "unbekannt";
      const hm = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
      const heute = new Date(); heute.setHours(0, 0, 0, 0); const tag = new Date(d); tag.setHours(0, 0, 0, 0);
      const diff = Math.round((heute - tag) / 86400000);
      return (diff === 0 ? "heute" : diff === 1 ? "gestern" : d.getDate() + "." + (d.getMonth() + 1) + ".") + ", " + hm;
    })();
    const offline = (navigator.serviceWorker && navigator.serviceWorker.controller) ? "Aktiv" : "Aus";
    const erlaubnis = !("Notification" in window) ? "Nicht möglich"
      : Notification.permission === "granted" ? "Erlaubt" : Notification.permission === "denied" ? "Blockiert" : "Nicht gefragt";
    const fehler = (L.errors && L.errors.length) ? String(L.errors[L.errors.length - 1]).slice(0, 40) : "Keiner";
    return '<div class="group-head"><h2>App</h2></div>' +
      '<div class="ein-gruppe ein-gruppe-gross">' +
        wert("Version", APP_BUILD, (html && html !== APP_BUILD) ? "HTML " + esc(html) + ", Cache prüfen" : "") +
        wert("Zuletzt geladen", geladen) +
        wert("Offline-Speicher", offline) +
      '</div>' +
      '<div class="group-head"><h2>Gerät</h2></div>' +
      '<div class="ein-gruppe ein-gruppe-gross">' +
        wert("Mitteilungen", erlaubnis) +
        wert("Als App installiert", istStandalone() ? "Ja" : "Nein") +
      '</div>' +
      '<button class="btn btn-soft ein-voll diag-bericht" data-diag-bericht type="button"><span>Bericht kopieren</span></button>' +
      '<p class="ein-fuss-mitte"><span>Für Rückfragen an den Admin.</span></p>' +
      '<div class="cal-copied ein-rueckmeldung" data-diag-meldung hidden></div>' +
      '<div class="group-head"><h2>Hilfe</h2></div>' +
      '<div class="ein-gruppe">' +
        wert("Online", navigator.onLine === false ? "Nein" : "Ja") +
        wert("Letzter Fehler", fehler) +
        wert("Cache leeren und neu laden", null, "", "data-diag-cache") +
        wert("Protokoll dieses Starts", null, "", 'data-ein-tat="diagnose"', true) +
      '</div>';
  }
  async function diagBerichtKopieren() {
    let prev = null; try { prev = localStorage.getItem("fnboot_prev"); } catch (e) {}
    const bericht = JSON.stringify({ app: APP_BUILD, html: window.__HTML_BUILD || null, aktuell: window.__bootL || null,
      vorher: prev, online: navigator.onLine, standalone: istStandalone(), ua: navigator.userAgent }, null, 2);
    const ok = await copyText(bericht);
    const el = document.querySelector("[data-diag-meldung]");
    if (el) { el.textContent = ok ? "Bericht kopiert" : "Kopieren nicht möglich"; el.hidden = false; setTimeout(() => { el.hidden = true; }, 1800); }
  }

  // Abo-Adresse kommt asynchron (Kalender-Token): Knopf freischalten, sobald da.
  function einAboAdresseNachtragen() {
    ensureCalendarToken().then(() => {
      const url = calendarSubscribeUrl();
      const a = viewEl.querySelector("[data-cal-open-ein]");
      if (a && url) { a.setAttribute("href", url.replace(/^https?:/i, "webcal:")); a.removeAttribute("aria-disabled"); }
    }).catch(() => {});
  }

  /* ---------- Profil (Spieler-Tab): eigener Fitnessstatus ------------------- */
  /* ---------- Profil (Vorlage 4b) -------------------------------------------
     Kopfkarte mit Avatar und Rueckennummer, eigener Fitnessstatus, darunter die
     eigenen Rueckmeldungen zu den naechsten Terminen. */
  /* Profil (Vorlage Final 21): zentrierter Kopf mit Avatar, Name und
     Rollenpillen, Gruppe "Konto" (E-Mail, Rückennummer, Passwort ändern).
     Darunter bleiben "Mein Status" und "Meine Rückmeldungen"; Abmelden ganz
     unten. Als Unterseite #ein=profil und als Ansicht "profil" (Mehr). */
  const ROLLE_PILLE = { admin: ["Admin", "is-gold"], coach: ["Trainer", "is-gruen"], treasurer: ["Kassenwart", "is-amber"], player: ["Spieler", ""] };
  function profilInhaltHtml() {
    const u = currentProfile || {};
    const player = u.player_id ? playerById[u.player_id] : null;
    const name = player ? player.name : (u.email || "Ohne Namen");
    const rollen = (Roles.list && Roles.list.length ? Roles.list.slice() : ["player"]);
    if (player && rollen.indexOf("player") < 0) rollen.push("player");
    const rang = (x) => { const i = EIN_ROLLEN_FOLGE.indexOf(x); return i < 0 ? 99 : i; };
    rollen.sort((a, b) => rang(a) - rang(b));
    const pillen = rollen.map((r) => { const p = ROLLE_PILLE[r] || [r, ""]; return '<span class="mark ' + p[1] + '">' + esc(p[0]) + '</span>'; }).join("");

    let rueck = "";
    if (player) {
      const kommend = DEMO.events.filter((e) => isFuture(e.datum))
        .sort((a, b) => a.datum.localeCompare(b.datum)).slice(0, 5);
      if (kommend.length) {
        rueck = '<div class="group-head"><h2>Meine Rückmeldungen</h2></div><div class="card dn-liste">' +
          kommend.map(danachZeileHtml).join("") + '</div>';
      }
    }
    const zeile = (l, w, attr) => '<' + (attr ? 'button type="button" ' + attr : 'div') + ' class="pr-zeile"><span class="pr-l">' + l + '</span>' +
      '<span class="pr-w">' + w + '</span>' + (attr ? '<span class="ein-chev" aria-hidden="true">›</span>' : "") + '</' + (attr ? 'button' : 'div') + '>';
    return `
      <div class="pr-kopf">
        <span class="avatar pr-av">${initials(name)}</span>
        <div class="pr-name">${esc(name)}</div>
        <div class="pr-rollen">${pillen}</div>
      </div>
      <div class="group-head"><h2>Konto</h2></div>
      <div class="ein-gruppe pr-konto">
        ${zeile("E-Mail", esc(u.email || "Keine E-Mail"))}
        ${player ? zeile("Rückennummer", player.nr != null ? String(player.nr) : "Keine") : ""}
        ${zeile("Passwort", "Ändern", 'data-pw-aendern')}
      </div>
      ${player ? `
      <div class="group-head"><h2>Mein Status</h2></div>
      ${statusWahlHtml(player, { kompakt: true })}
      ${rueck}` : `<div class="empty" style="padding:24px 0">Dein Konto ist noch keinem Spieler zugeordnet. Melde dich beim Trainerteam.</div>`}
      <button class="btn btn-soft pr-abmelden" data-logout type="button">Abmelden</button>
    `;
  }
  function renderProfil() {
    document.body.classList.remove("auth-mode");
    viewEl.innerHTML = '<div class="page-head"><h1>Profil</h1></div>' + profilInhaltHtml();
  }

  /* Blatt "Neues Passwort" (Profil › Passwort ändern). */
  function openPasswortBlatt() {
    const ex = document.getElementById("pwBlatt"); if (ex) { ex.remove(); unlockBodyScroll(); }
    const ov = document.createElement("div");
    ov.className = "more-sheet"; ov.id = "pwBlatt";
    ov.innerHTML = '<button class="more-backdrop" data-sheet-close aria-label="Schließen"></button>' +
      '<div class="more-panel sb-panel" role="dialog" aria-modal="true" aria-label="Neues Passwort">' +
        '<span class="sb-griff" aria-hidden="true"></span>' +
        '<div class="sb-name">Neues Passwort</div>' +
        '<div class="sb-felder">' +
          '<input class="sb-feld" type="password" autocomplete="new-password" data-pw-neu placeholder="Neues Passwort (mindestens 6 Zeichen)" aria-label="Neues Passwort">' +
          '<input class="sb-feld" type="password" autocomplete="new-password" data-pw-wdh placeholder="Wiederholen" aria-label="Passwort wiederholen">' +
        '</div>' +
        '<div class="tf-hint" data-pw-hint></div>' +
        '<button class="btn btn-primary sb-speichern" data-pw-speichern type="button">Passwort speichern</button>' +
      '</div>';
    document.body.appendChild(ov);
    lockBodyScroll();
    const zu = () => { if (ov.parentNode) { ov.remove(); unlockBodyScroll(); } };
    const hint = ov.querySelector("[data-pw-hint]");
    ov.addEventListener("click", async (ev) => {
      if (ev.target === ov || ev.target.closest("[data-sheet-close]")) { zu(); return; }
      if (!ev.target.closest("[data-pw-speichern]")) return;
      const a = ov.querySelector("[data-pw-neu]").value, b = ov.querySelector("[data-pw-wdh]").value;
      if (a.length < 6) { hint.textContent = "Mindestens 6 Zeichen."; return; }
      if (a !== b) { hint.textContent = "Die beiden Eingaben stimmen nicht überein."; return; }
      try { await DB.updatePassword(a); zu(); tvToast("Passwort geändert"); }
      catch (e) { hint.textContent = "Nicht gespeichert: " + ((e && e.message) || e); }
    });
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
      return `<div class="frist frist-warn">Meldeschluss vorbei. Rückmeldung jetzt kostet 8 €, keine Rückmeldung ${noResp}.</div>`;
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
    const suche = query || name;
    return {
      name: name || query,
      adresse: staette ? (adr || fallback) : "",
      url: "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(suche),
      // Vollstaendig fuer title und Vorlesehilfe - in der Zeile steht beides gekuerzt.
      voll: [name || query, staette ? (adr || fallback) : ""].filter(Boolean).join(", "),
    };
  }
  /* Zeile unter „Danach" (Vorlage Final 01): Goldwuerfel 42 x 56 mit Monat,
     kurzer Farbstrich links (Spiel dunkel, Training hell, Sonstiges gold),
     Titel, Nebenzeile und rechts die eigene Rueckmeldung als Marke. Alle
     Zeilen liegen in EINER Karte mit Trennlinien. */
  function danachZeileHtml(e) {
    const r = state.rsvp[e.id + "|" + state.currentPlayerId] || {};
    const zustand = r.status === "zu" ? ["Zugesagt", "is-gruen"]
                  : r.status === "ab" ? ["Abgesagt", ""] : ["Offen", "is-rot"];
    const spiel = e.typ === "spiel";
    const titel = spiel ? esc(e.gegner || e.titel) : esc(e.titel);
    const zeit = e.zeit ? esc(e.zeit) + "\u00a0Uhr" : "ganztägig";
    const neben = spiel
      ? "Spiel · " + zeit + (e.heim != null ? " · " + (e.heim ? "Heim" : "Auswärts") : "")
      : e.typ === "sonstiges" ? "Sonstiges · " + zeit : zeit;
    const abgesagt = e.status === "abgesagt";
    return `<button class="dn-zeile is-${e.typ}" data-nav-event="${e.id}">
      <span class="dn-strich" aria-hidden="true"></span>
      ${wuerfelHtml(e, "klein")}
      <span class="dn-main"><span class="dn-t${spiel ? " is-spiel" : ""}">${titel}</span>
        <span class="dn-s num">${neben}</span></span>
      ${abgesagt ? `<span class="mark">Fällt aus</span>` : `<span class="mark ${zustand[1]}">${zustand[0]}</span>`}
    </button>`;
  }

  /* Goldwuerfel: Wochentag, Tag, Monat. groesse "hero" 56 x 66, "karte" 48 x 56,
     "klein" 42 x 56. */
  function wuerfelHtml(e, groesse) {
    return `<span class="wf wf-${groesse}"><span class="wf-wd">${fmtWd(e.datum)}</span>` +
      `<span class="wf-day num">${fmtDay(e.datum)}</span><span class="wf-mon">${fmtMon(e.datum)}</span></span>`;
  }

  /* Relativer Tag fuer Kopfzeilen: "Heute", "Morgen", "In 3 Tagen", sonst null. */
  function relTag(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    const ziel = new Date(y, m - 1, d);
    const heute = new Date(); heute.setHours(0, 0, 0, 0);
    const tage = Math.round((ziel - heute) / 86400000);
    if (tage === 0) return "Heute";
    if (tage === 1) return "Morgen";
    if (tage > 1 && tage < 7) return "In " + tage + " Tagen";
    return null;
  }
  // "19:30 bis 21:00 Uhr", "13:30 Uhr · Treffen 12:45", "ganztägig"
  function zeitText(e) {
    if (!e.zeit) return "ganztägig";
    const z = esc(e.zeit) + (e.ende ? " bis " + esc(e.ende) : "") + "\u00a0Uhr";
    return z + (e.treffen ? " · Treffen " + esc(e.treffen) : "");
  }

  /* Rueckmeldungen eines Termins (nur fuer Trainer lesbar, RLS). */
  function rueckZahlen(e) {
    const gesamt = DEMO.players.length;
    const zu = DEMO.players.filter((p) => (state.rsvp[e.id + "|" + p.id] || {}).status === "zu").length;
    const ab = DEMO.players.filter((p) => (state.rsvp[e.id + "|" + p.id] || {}).status === "ab").length;
    return { gesamt, zu, ab, offen: gesamt - zu - ab };
  }
  function rueckZahlenHtml(z) {
    return `<b>${z.zu}</b> zu · <b>${z.ab}</b> ab · <b>${z.offen}</b> offen`;
  }
  // Aufstellung eines Spiels: gesetzte Plaetze und Gesamtzahl.
  function aufstellungStand(e) {
    const lu = (DEMO.lineups || []).find((l) => l.eventId === e.id && l.isActive && !l.isTemplate);
    const slots = lu ? (FORMATIONS[lu.formation] || []) : [];
    const gesetzt = lu ? slots.map((s) => (lu.slots || {})[s.key]).filter(Boolean).length : 0;
    return { lu, gesetzt, gesamt: slots.length || 11, steht: !!(lu && slots.length && gesetzt === slots.length) };
  }
  // Meldeschluss als Countdown "in 21 h" (laeuft per startCountdowns weiter).
  function meldeschlussHtml(e) {
    if (!isFuture(e.datum) || e.auto === false || (e.typ !== "spiel" && e.typ !== "training")) return "";
    const dl = meldeschlussMs(e);
    const start = eventStartMs(e);
    const now = Date.now();
    if (dl != null && now < dl) {
      return `<span class="tk-ms cd" data-cd-deadline="${new Date(dl).toISOString()}" data-cd-format="in" data-cd-prefix="Meldeschluss ">Meldeschluss ${fmtIn(dl - now)}</span>`;
    }
    if (start != null && now < start) return `<span class="tk-ms">Meldeschluss vorbei</span>`;
    return "";
  }


  /* ---------- Terminkarte (Vorlage Final 01 und 02) ----------------------------
     EINE Komponente fuer Kalender und Uebersicht.
     - opts.hero: Termin-Hero der Uebersicht. Dunkler Kopf mit Goldlinie, Pille
       "Naechster Termin", Menue ···, grosser Wuerfel; darunter Ortszeile,
       Zu-/Absage, Zeile Rueckmeldungen (oeffnet das Blatt) und fuer Trainer
       Aufstellung und Kader.
     - opts.naechster (Kalender): der naechste Termin traegt die Goldlinie und
       die grossen Zu-/Absage-Knoepfe.
     Kopf nach Art: Spiel dunkel, Training hellgruen, Sonstiges gold.
     "In Kalender speichern", Kader-Info, Bearbeiten und Loeschen liegen im
     Menue ··· (fuer alle Rollen geoeffnet; Pflege nur mit Recht).            */
  function terminKarteHtml(e, opts) {
    opts = opts || {};
    const cancelled = e.status === "abgesagt";
    const future    = isFuture(e.datum);
    const trainer   = Roles.canManageEvents();
    const spiel     = e.typ === "spiel";
    const hero      = !!opts.hero;
    const gross     = hero || !!opts.naechster;
    const r         = state.rsvp[e.id + "|" + state.currentPlayerId] || {};
    const verknuepft = !!(currentProfile && currentProfile.player_id && playerById[state.currentPlayerId]);
    const art = hero ? "hero" : (spiel ? "spiel" : e.typ === "training" ? "training" : "sonstiges");

    // --- Kopf ------------------------------------------------------------------
    const titel = spiel ? esc(e.gegner || e.titel) : esc(e.titel);
    const heimText = (spiel && e.heim != null) ? (e.heim ? "Heim" : "Auswärts") : "";
    const rel = relTag(e.datum);
    let oben = "", zeile = zeitText(e);
    if (hero) {
      zeile = [rel, spiel && heimText ? heimText : "", zeitText(e)].filter(Boolean).join(" · ");
    } else if (opts.naechster) {
      oben = "Nächster Termin" + (rel ? " · " + rel.toLowerCase() : "");
    } else if (spiel) {
      oben = "Spiel" + (heimText ? " · " + heimText : "");
    } else if (e.typ === "sonstiges") {
      oben = "Sonstiges";
    }
    const istBfv = e.quelle === "bfv";
    const mb = e.manuellBearbeitet || {}, bn = e.bfvNeu || {};
    const marken = [];
    if (cancelled) marken.push('<span class="mark is-rot">Fällt aus</span>');
    if (spiel && e.wettbewerb && /freundschaft/i.test(e.wettbewerb)) marken.push('<span class="mark">Freundschaft</span>');
    if (istBfv && (mb.start || mb.ort)) marken.push('<span class="mark is-amber">manuell geändert</span>');

    const menue = '<button class="tk-menue" data-tkmenu="' + e.id + '" aria-label="Mehr zu diesem Termin">' +
      '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.9"/><circle cx="12" cy="12" r="1.9"/><circle cx="19" cy="12" r="1.9"/></svg></button>';

    const kopf = '<div class="tk-kopf is-' + art + ((gross && !cancelled) ? " is-gold" : "") + '">' +
      (hero ? '<span class="tk-ring" aria-hidden="true"></span>' +
        '<div class="tk-heroleiste"><span class="tk-pille">Nächster Termin</span>' + menue + '</div>' : "") +
      '<div class="tk-kopfzeile">' +
        wuerfelHtml(e, hero ? "hero" : "karte") +
        '<span class="tk-kopf-main">' +
          (oben ? '<span class="tk-oben">' + oben + '</span>' : "") +
          '<span class="tk-titel">' + titel + '</span>' +
          '<span class="tk-zeit num">' + zeile + '</span>' +
        '</span>' +
        (hero ? "" : menue) +
      '</div>' +
      '</div>';

    // --- Koerper ---------------------------------------------------------------
    const teile = [];
    const ort = ortTeile(e);
    if (ort && (hero || spiel)) {
      const inhalt = '<span class="tk-ort-ic" aria-hidden="true">' + VENUE_PIN + '</span>' +
        '<span class="tk-ort-n">' + esc(ort.name) + '</span>' +
        (ort.url ? '<span class="tk-route" aria-hidden="true">Route ›</span>' : "");
      teile.push(ort.url
        ? '<a class="tk-ort" href="' + ort.url + '" target="_blank" rel="noopener noreferrer"' +
          ' title="' + esc(ort.voll) + '" aria-label="Route zu ' + esc(ort.voll) + '">' + inhalt + '</a>'
        : '<div class="tk-ort">' + inhalt + '</div>');
    }
    if (marken.length) teile.push('<div class="tk-marken">' + marken.join("") + '</div>');

    const unten = [];   // Zeile unter Zu-/Absage im Kalender
    if (cancelled) {
      teile.push('<div class="tk-abgesagt">Dieser Termin fällt aus.</div>');
    } else {
      if (future && verknuepft) {
        teile.push('<div class="tk-rsvp' + (gross ? " is-gross" : "") + '">' +
          '<button class="tk-btn' + (r.status === "zu" ? " is-on" : "") + '" data-rsvp="zu" data-event="' + e.id + '">' + (r.status === "zu" ? "Zugesagt" : "Zusage") + '</button>' +
          '<button class="tk-btn is-ab' + (r.status === "ab" ? " is-on" : "") + '" data-rsvp="ab" data-event="' + e.id + '">' + (r.status === "ab" ? "Abgesagt" : "Absage") + '</button>' +
          '</div>');
        if (r.status === "ab" && r.grund) teile.push('<div class="tk-grund">Grund: ' + esc(r.grund) + '</div>');
        // Nach dem Meldeschluss: was eine spaete Rueckmeldung kostet.
        const frist = fristBlockHtml(e);
        if (frist.indexOf("frist-warn") >= 0) teile.push('<div class="tk-warn">' + frist.replace(/<\/?div[^>]*>/g, "") + '</div>');
      }
      const ms = meldeschlussHtml(e);
      if (hero) {
        // Zeile Rueckmeldungen: Trainer sehen Balken und Zahlen und oeffnen das Blatt.
        if (trainer) {
          const z = rueckZahlen(e);
          const pz = z.gesamt ? (z.zu / z.gesamt) * 100 : 0, pa = z.gesamt ? (z.ab / z.gesamt) * 100 : 0;
          teile.push('<button class="tk-rueck" data-rsvp-sheet="' + e.id + '">' +
            '<span class="tk-rueck-main"><span class="tk-rueck-kopf"><span class="tk-rueck-t">Rückmeldungen</span>' + ms + '</span>' +
            '<span class="tk-bar" role="img" aria-label="' + z.zu + ' zugesagt, ' + z.ab + ' abgesagt, ' + z.offen + ' offen">' +
              '<i class="is-zu" style="width:' + pz.toFixed(2) + '%"></i><i class="is-ab" style="width:' + pa.toFixed(2) + '%"></i></span>' +
            '<span class="tk-rueck-z">' + rueckZahlenHtml(z) + '</span></span>' +
            '<span class="tk-chev" aria-hidden="true">›</span></button>');
        } else if (ms) {
          teile.push('<div class="tk-rueck is-still"><span class="tk-rueck-main"><span class="tk-rueck-kopf">' +
            '<span class="tk-rueck-t">Rückmeldung</span>' + ms + '</span></span></div>');
        }
        if (trainer) {
          // Aufstellung des naechsten Spiels und fitter Kader.
          const sp = spiel ? e : DEMO.events.filter((x) => x.typ === "spiel" && istOffen(x) && x.status !== "abgesagt")
            .sort((a, b) => (eventStartMs(a) || 0) - (eventStartMs(b) || 0))[0];
          const st = sp ? aufstellungStand(sp) : null;
          const fit = DEMO.players.filter(istFit).length;
          teile.push('<div class="tk-felder">' +
            (st ? '<button class="tk-feld2" data-lineup-edit="' + sp.id + '"><span class="tk-f-main"><span class="tk-f-lbl">Aufstellung</span>' +
              '<span class="tk-f-wert num is-gold">' + st.gesetzt + ' von ' + st.gesamt + '</span></span><span class="tk-chev" aria-hidden="true">›</span></button>' : "") +
            '<button class="tk-feld2" data-nav="kader"><span class="tk-f-main"><span class="tk-f-lbl">Kader</span>' +
              '<span class="tk-f-wert num">' + fit + ' fit</span></span><span class="tk-chev" aria-hidden="true">›</span></button>' +
            '</div>');
        }
      } else {
        if (trainer && (e.typ === "spiel" || e.typ === "training")) {
          unten.push('<button class="tk-unten-l" data-rsvp-sheet="' + e.id + '">' + rueckZahlenHtml(rueckZahlen(e)) + ' ›</button>');
        }
        if (spiel && trainer) {
          const st = aufstellungStand(e);
          unten.push('<button class="tk-unten-r is-gold" data-lineup-edit="' + e.id + '">' + (st.steht ? "Elf steht ›" : "Elf aufstellen ›") + '</button>');
        } else if (ms) {
          unten.push('<span class="tk-unten-r">' + ms + '</span>');
        }
        if (unten.length) teile.push('<div class="tk-unten">' + unten.join("") + '</div>');
      }
    }

    // BFV meldet eine Abweichung: Hinweis sichtbar, Uebernehmen als Textverweis.
    if (istBfv && trainer && !hero) {
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

    return '<div class="card tk is-' + art + (cancelled ? " is-cancelled" : "") + '" id="ev-' + e.id + '">' +
      kopf + (teile.length ? '<div class="tk-body">' + teile.join("") + '</div>' : "") + '</div>';
  }

  /* Kleines Aktionsblatt fuer Zeilen mit Menue ··· (Vorlagen). Die Zeilen
     tragen dieselben data-Attribute wie frueher die Knoepfe in der Zeile und
     laufen ueber den Klickpfad der Ansicht (Kopie, siehe openTkMenu). */
  function openZeilenMenue(id, titel, zeilen) {
    const ex = document.getElementById(id); if (ex) { ex.remove(); unlockBodyScroll(); }
    const ov = document.createElement("div");
    ov.className = "more-sheet"; ov.id = id;
    ov.innerHTML = '<button class="more-backdrop" data-sheet-close aria-label="Schließen"></button>' +
      '<div class="more-panel" role="dialog" aria-modal="true" aria-label="' + esc(titel) + '">' +
      '<div class="more-title">' + esc(titel) + '</div>' + zeilen.join("") + '</div>';
    document.body.appendChild(ov);
    lockBodyScroll();
    const zu = () => { if (ov.parentNode) { ov.remove(); unlockBodyScroll(); } };
    ov.addEventListener("click", (ev) => {
      if (ev.target === ov || ev.target.closest("[data-sheet-close]")) { zu(); return; }
      const it = ev.target.closest(".more-item");
      if (!it) return;
      zu();
      const kopie = it.cloneNode(true);
      kopie.hidden = true;
      viewEl.appendChild(kopie);
      kopie.click();
      kopie.remove();
    });
  }

  /* ⋯-Menue der Terminkarte: fuer alle Rollen. "In Kalender speichern" fuer
     jeden; Kader-Info fuer Trainer bei Spielen; Pflege nur mit Recht. */
  /* Termin-Menü hinter ⋯ als Popover (Nachschliff D2): rechtsbündig 6 px unter
     dem Knopf, öffnet nach oben, wenn unten weniger als 200 px frei sind.
     Keine Abdunklung; Tippen daneben schließt (unsichtbare Fangfläche, sie
     sperrt zugleich das Scrollen dahinter, A7). Destruktive Einträge stehen
     gemeinsam im roten Block unter dem Trennband; Spieler sehen nur „In
     Kalender speichern“ (ohne Band). */
  const TKP_IC = {
    kal: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4M12 13v5M9.5 15.5h5"/></svg>',
    teilen: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M7.5 7.5 12 3l4.5 4.5M5 12v7.5A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V12"/></svg>',
    stift: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4"/></svg>',
    zurueck: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12a8 8 0 0 1 14-5.3M20 4v4h-4M20 12a8 8 0 0 1-14 5.3M4 20v-4h4"/></svg>',
    muell: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12.5A1.5 1.5 0 0 0 8.5 21h7a1.5 1.5 0 0 0 1.5-1.5L18 7M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7"/></svg>',
  };
  function closeTkMenu() {
    const ex = document.getElementById("tkMenu");
    if (ex) ex.remove();
    document.querySelectorAll(".tk-menue.is-offen").forEach((b) => { b.classList.remove("is-offen"); b.setAttribute("aria-expanded", "false"); });
    unlockBodyScroll();
  }
  function openTkMenu(eventId, knopf) {
    const e = DEMO.events.find((x) => x.id === eventId);
    if (!e) return;
    closeTkMenu();
    const darfPflegen = Roles.canManageSchedule();
    const mb = e.manuellBearbeitet || {};
    const eintrag = (attr, ic, text, rot) => '<button type="button" class="tkp-item' + (rot ? " is-rot" : "") + '" ' + attr + '>' + TKP_IC[ic] + '<span>' + text + '</span></button>';
    const oben = [eintrag('data-ics-event="' + e.id + '"', "kal", "In Kalender speichern")];
    if (Roles.canManageEvents() && e.typ === "spiel") oben.push(eintrag('data-kader-info="' + e.id + '"', "teilen", "Kader-Info teilen"));
    const rot = [];
    if (darfPflegen) {
      oben.push(eintrag('data-termin-edit="' + e.id + '"', "stift", "Termin bearbeiten"));
      if (e.quelle === "bfv" && (mb.start || mb.ort)) oben.push(eintrag('data-bfv-reset="' + e.id + '"', "zurueck", "Zurücksetzen auf BFV-Daten"));
      rot.push(eintrag('data-termin-del="' + e.id + '"', "muell", "Termin löschen", true));
    }
    const titel = (e.typ === "spiel" ? esc(e.gegner || e.titel) : esc(e.titel)) + " · " + fmtDay(e.datum) + ". " + fmtMon(e.datum);
    const ov = document.createElement("div");
    ov.className = "tkp-ov"; ov.id = "tkMenu"; ov.setAttribute("data-sperrt", "");
    ov.innerHTML = '<button type="button" class="tkp-fang" data-sheet-close aria-label="Menü schließen"></button>' +
      '<div class="tkp" role="menu" aria-label="Termin">' +
        '<div class="tkp-kopf tkp-titel">' + titel + '</div>' +
        oben.join('<div class="tkp-linie" aria-hidden="true"></div>') +
        (rot.length ? '<div class="tkp-band" aria-hidden="true"></div>' + rot.join('<div class="tkp-linie" aria-hidden="true"></div>') : "") +
      '</div>';
    document.body.appendChild(ov);
    // Lage: am geöffneten Knopf, sonst am ersten ⋯ dieses Termins.
    const b = knopf || document.querySelector('.tk-menue[data-tkmenu="' + e.id + '"]');
    const pop = ov.querySelector(".tkp");
    const W = document.documentElement.clientWidth, H = window.innerHeight;
    if (b) {
      b.classList.add("is-offen"); b.setAttribute("aria-expanded", "true");
      const r = b.getBoundingClientRect();
      const breite = pop.offsetWidth, hoehe = pop.offsetHeight;
      pop.style.left = Math.max(8, Math.min(W - breite - 8, r.right - breite)) + "px";
      if (H - r.bottom < 200 && r.top > hoehe + 12) pop.style.top = (r.top - 6 - hoehe) + "px";
      else pop.style.top = Math.min(r.bottom + 6, H - hoehe - 8) + "px";
    } else {
      pop.style.left = Math.max(8, W - pop.offsetWidth - 16) + "px"; pop.style.top = "80px";
    }
    lockBodyScroll();
    ov.addEventListener("click", (ev) => {
      if (ev.target.closest("[data-sheet-close]")) { closeTkMenu(); return; }
      const it = ev.target.closest(".tkp-item");
      if (!it) return;
      // Das Menü hängt am body, der Klickpfad der Ansicht aber an viewEl:
      // die Zeile kurz in die Ansicht legen und dort auslösen.
      closeTkMenu();
      const kopie = it.cloneNode(true);
      kopie.hidden = true;
      viewEl.appendChild(kopie);
      kopie.click();
      kopie.remove();
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

  /* Hintergrund-Scroll-Sperre für alle Fenster und Blätter (iOS-fest: body
     fixieren, Position merken). Nachschliff A7: Die Sperre gleicht sich selbst
     ab - sie gilt, solange irgendeine Ebene aus SPERR_SEL sichtbar ist. Vorher
     zählte jeder Dialog selbst mit; wer das vergaß (Katalog-Blatt „Strafe
     hinzufügen“), ließ den Hintergrund mitscrollen. lockBodyScroll() und
     unlockBodyScroll() bleiben als Aufrufe erhalten und stoßen nur den
     Abgleich an; ein Beobachter fängt Ebenen ohne eigenen Aufruf.          */
  const SPERR_SEL = ".modal-ov, .more-sheet, .kat-blatt-ov, .nsb-ov, .tv-sheet.open, #ksSeite, #terminModal, [data-sperrt]";
  let _gesperrt = false, _scrollLockY = 0, _sperrPlan = 0;
  function ebeneOffen() {
    for (const el of document.querySelectorAll(SPERR_SEL)) {
      if (el.hidden || !el.getClientRects().length) continue;
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") continue;
      return true;
    }
    return false;
  }
  function sperreAbgleichen() {
    _sperrPlan = 0;
    const offen = ebeneOffen();
    const b = document.body.style;
    if (offen && !_gesperrt) {
      _gesperrt = true;
      _scrollLockY = window.scrollY || window.pageYOffset || 0;
      b.position = "fixed"; b.top = `-${_scrollLockY}px`; b.left = "0"; b.right = "0"; b.width = "100%";
    } else if (!offen && _gesperrt) {
      _gesperrt = false;
      b.position = ""; b.top = ""; b.left = ""; b.right = ""; b.width = "";
      window.scrollTo(0, _scrollLockY);
    }
  }
  function sperrePlanen() { if (!_sperrPlan) _sperrPlan = requestAnimationFrame(sperreAbgleichen); }
  function lockBodyScroll() { sperrePlanen(); }
  function unlockBodyScroll() { sperrePlanen(); }
  try {
    new MutationObserver(sperrePlanen).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "hidden"] });
  } catch (e) { /* ohne Beobachter greifen die direkten Aufrufe */ }

  /* --------------------------------------------------------------------------
     Blatt-Steuerung: EIN Weg, ein Bottom-Sheet zu oeffnen und zu schliessen.

     Vorher hat jedes Blatt selbst `classList.add("open")` gerufen. Die
     Dialoge und die .more-sheet-Blaetter sperrten dabei den Hintergrund,
     die .tv-sheet-Blaetter nicht - dort scrollte der Feed unter dem offenen
     Blatt weiter. Auf iOS im Standalone-Modus reicht `overflow: hidden` auf
     dem body nicht; lockBodyScroll() fixiert ihn und stellt die Scrollposition
     beim Schliessen wieder her. Genau das haengt jetzt an jedem Blatt.

     `body.blatt-offen` blendet zusaetzlich die untere Navigation aus. Der
     Scrim liegt zwar ohnehin darueber (z-index 90 gegen 60), aber eine
     durchscheinende Navigationsleiste unter einem Blatt sieht aus wie ein
     Bedienfehler.

     Der Stapel erlaubt ein Blatt ueber einem Blatt (Filter -> Spielersuche);
     die Navigation kommt erst zurueck, wenn das letzte zu ist.             */
  const BLATT_STAPEL = [];
  function blattAuf(scrimId, sheetId) {
    const s = document.getElementById(scrimId), p = document.getElementById(sheetId);
    if (!p || p.classList.contains("open")) return;
    if (s) s.classList.add("open");
    p.classList.add("open");
    BLATT_STAPEL.push({ scrim: scrimId, sheet: sheetId });
    document.body.classList.add("blatt-offen");
    lockBodyScroll();
  }
  function blattZu(scrimId, sheetId) {
    const s = document.getElementById(scrimId), p = document.getElementById(sheetId);
    // Nur zaehlen, wenn wirklich etwas offen war - sonst laeuft der Zaehler
    // von lockBodyScroll() aus dem Tritt und der body bleibt fixiert.
    const war = !!(p && p.classList.contains("open"));
    if (s) s.classList.remove("open");
    if (p) p.classList.remove("open");
    if (!war) return;
    const i = BLATT_STAPEL.findIndex((x) => x.sheet === sheetId);
    if (i >= 0) BLATT_STAPEL.splice(i, 1);
    if (!BLATT_STAPEL.length) document.body.classList.remove("blatt-offen");
    unlockBodyScroll();
  }
  // Alles zu, z. B. beim Ansichtswechsel. Rueckwaerts, damit der Stapel stimmt.
  function blattAlleZu() {
    for (const b of BLATT_STAPEL.slice().reverse()) blattZu(b.scrim, b.sheet);
  }
  function blattOffen(sheetId) {
    return BLATT_STAPEL.some((x) => x.sheet === sheetId);
  }

  function closeTerminModal() { const ex = document.getElementById("terminModal"); if (ex) { ex.remove(); unlockBodyScroll(); } }

  // existing = null -> anlegen; sonst bearbeiten (Event-Objekt aus DEMO.events).
  /* Blatt "Termin anlegen" (Vorlage Final 03): Terminart als drei Kacheln,
     Felder als gruppierte Liste (Label links), Datum und Uhrzeiten als
     formatierte Anzeige mit dem nativen Feld darueber, Wiederholung als
     Segment. Ende bleibt erhalten: bei Training und Sonstiges rechts in der
     Zeile "Beginn", bei Spielen als eigene Zeile, sobald eine Endzeit besteht.
     Treffzeit (0058) rechts in der Zeile "Anstoss" bei Spielen.              */
  const TF_ARTEN = [["spiel", "Spiel"], ["training", "Training"], ["sonstiges", "Sonstiges"]];
  const TF_LABEL = { datum: "Datum", zeit: "Beginn", treffen: "Treffzeit", ende: "Ende", ende2: "Ende", bis: "Wiederholen bis" };
  function tfDatumText(iso) {
    if (!iso) return "";
    const dt = parseDate(iso);
    return WT[dt.getDay()] + ", " + dt.getDate() + ". " + MON[dt.getMonth()] + " " + dt.getFullYear();
  }
  function openTerminModal(existing) {
    closeTerminModal();
    const isEdit = !!existing;
    const e = existing || {};
    const isBfv = isEdit && e.quelle === "bfv"; // BFV-Spiel: Gegner/Wettbewerb gesperrt
    let typ = e.typ || "training";
    const titel0 = e.titel != null ? e.titel : (typ === "training" ? "Training" : "");
    const datum0 = e.datum || HEUTE;
    const zeile = (label, inhalt, extra) =>
      `<div class="tf-z${extra ? " " + extra : ""}"><span class="tf-l">${label}</span>${inhalt}</div>`;
    // Anzeige plus unsichtbares natives Feld darueber (Datum, Uhrzeit).
    const nativ = (key, type, anz) =>
      `<span class="tf-nat"><span class="tf-anz" data-tf-anz="${key}">${anz}</span>` +
      `<input type="${type}" data-tf="${key}" aria-label="${TF_LABEL[key]}"></span>`;

    const ov = document.createElement("div");
    ov.className = "modal-ov tf-ov"; ov.id = "terminModal";
    ov.innerHTML = `
      <div class="tf-blatt" role="dialog" aria-modal="true" aria-label="Termin">
        <div class="tf-kopf">
          <span class="tf-griff" aria-hidden="true"></span>
          <div class="tf-kopfzeile">
            <span class="tf-titel">${isBfv ? "Spiel bearbeiten" : (isEdit ? "Termin bearbeiten" : "Termin anlegen")}</span>
            <button type="button" class="tf-x" aria-label="Schließen">${ICON_X}</button>
          </div>
        </div>
        <form class="termin-form tf-koerper" novalidate>
          ${isBfv ? "" : `
          <div class="tf-arten" role="radiogroup" aria-label="Terminart">
            ${TF_ARTEN.map(([k, l]) => `<button type="button" class="tf-art is-${k}" data-tf-typ="${k}" role="radio"><span class="tf-art-strich" aria-hidden="true"></span><span class="tf-art-l">${l}</span></button>`).join("")}
          </div>`}
          <div class="tf-liste">
            ${isBfv ? `
            <div class="tf-z tf-bfv">
              <span class="tf-bfv-paar">${(() => { const p = paarung(e); return `${p.home} <span class="vs">gegen</span> ${p.away}`; })()}</span>
              ${e.wettbewerb ? `<span class="tf-bfv-sub">${esc(e.wettbewerb)}${e.liga ? " · " + esc(e.liga) : ""}</span>` : ""}
              <span class="tf-bfv-sub">Gegner und Wettbewerb kommen vom BFV und sind gesperrt.</span>
            </div>` : `
            ${zeile("Titel", `<input class="tf-in" type="text" data-tf="titel" placeholder="z. B. Abschlusstraining">`, "tf-nurtermin")}
            ${zeile("Gegner", `<input class="tf-in" type="text" data-tf="gegner" placeholder="Gegnerischer Verein">`, "tf-nurspiel")}
            ${zeile("Spielort", `<span class="tf-seg" role="radiogroup" aria-label="Spielort"><button type="button" class="tf-seg-b" data-tf-heim="true">Heim</button><button type="button" class="tf-seg-b" data-tf-heim="false">Auswärts</button></span>`, "tf-nurspiel")}`}
            ${zeile("Datum", nativ("datum", "date", ""))}
            <div class="tf-z tf-zeiten"><span class="tf-l" data-tf-beginn>Beginn</span>${nativ("zeit", "time", "")}
              <span class="tf-rechts tf-nurspiel">${nativ("treffen", "time", "")}</span>
              <span class="tf-rechts tf-nurtermin">${nativ("ende", "time", "")}</span></div>
            ${zeile("Ende", nativ("ende2", "time", ""), "tf-nurspiel tf-ende-spiel")}
            ${zeile("Ort", `<input class="tf-in" type="text" data-tf="ort" placeholder="Straße, Ort">`)}
            ${zeile("Notiz", `<textarea class="tf-in" data-tf="notiz" rows="1" placeholder="Für die Spieler"></textarea>`)}
          </div>
          ${isEdit ? "" : `
          <div class="tf-gruppe">
            <div class="group-head"><h2>Wiederholung</h2></div>
            <div class="seg tf-wdh" role="radiogroup" aria-label="Wiederholung">
              <button type="button" class="seg-b" data-tf-wdh="einmalig">Einmalig</button>
              <button type="button" class="seg-b" data-tf-wdh="woechentlich">Wöchentlich</button>
            </div>
            <div class="tf-liste" data-tf-bisrow hidden>${zeile("Bis", nativ("bis", "date", ""))}</div>
            <div class="tf-summary" data-tf-summary hidden></div>
          </div>`}
          <div class="tf-fuss">
            <div class="tf-hint" aria-live="polite" data-tf-hint></div>
            <button type="submit" class="btn btn-primary tf-submit">${isEdit ? "Speichern" : "Termin anlegen"}</button>
            ${(isEdit && !isBfv) ? `<div class="tf-neben">
              <button type="button" class="btn btn-soft" data-tf-cancel-toggle>${e.status === "abgesagt" ? "Findet statt" : "Absagen"}</button>
              <button type="button" class="btn btn-soft btn-danger" data-tf-delete>Löschen</button>
            </div>` : ""}
          </div>
        </form>
      </div>`;
    document.body.appendChild(ov);
    lockBodyScroll();

    const q = (sel) => ov.querySelector(sel);
    const set = (sel, val) => { const el = q(sel); if (el) el.value = val; };
    let heim = e.heim === false ? false : true;
    let woech = false;
    set('[data-tf="titel"]', titel0);
    set('[data-tf="datum"]', datum0);
    set('[data-tf="zeit"]', e.zeit || "");
    set('[data-tf="ende"]', e.ende || "");
    set('[data-tf="ende2"]', e.ende || "");
    set('[data-tf="treffen"]', e.treffen || "");
    set('[data-tf="ort"]', e.locationRaw || e.ort || "");
    set('[data-tf="notiz"]', e.note || "");
    set('[data-tf="gegner"]', e.gegner || "");
    set('[data-tf="bis"]', SAISON_ENDE);
    const hint = q('[data-tf-hint]');
    const spielEnde0 = !!e.ende && typ === "spiel";

    // Formatierte Anzeigen der nativen Felder
    function anzeigen() {
      const anz = (k, txt, leer) => {
        const el = q(`[data-tf-anz="${k}"]`); if (!el) return;
        el.textContent = txt || leer; el.classList.toggle("is-leer", !txt);
      };
      const v = (k) => { const el = q(`[data-tf="${k}"]`); return el ? el.value : ""; };
      anz("datum", tfDatumText(v("datum")), "Datum wählen");
      anz("zeit", v("zeit"), "Uhrzeit");
      anz("treffen", v("treffen") ? "Treffen " + v("treffen") : "", "Treffen");
      anz("ende", v("ende") ? "bis " + v("ende") : "", "Ende");
      anz("ende2", v("ende2"), "Uhrzeit");
      anz("bis", tfDatumText(v("bis")), "Datum wählen");
    }
    function syncTypUI() {
      const spiel = (isBfv ? "spiel" : typ) === "spiel";
      ov.querySelectorAll("[data-tf-typ]").forEach((b) => {
        const an = b.dataset.tfTyp === typ;
        b.classList.toggle("is-on", an); b.setAttribute("aria-checked", String(an));
      });
      ov.querySelectorAll(".tf-nurspiel").forEach((el) => { el.hidden = !spiel; });
      ov.querySelectorAll(".tf-nurtermin").forEach((el) => { el.hidden = spiel; });
      const ende2 = q(".tf-ende-spiel");
      if (ende2) ende2.hidden = !(spiel && (spielEnde0 || isBfv && !!e.ende));
      q("[data-tf-beginn]").textContent = spiel ? "Anstoß" : "Beginn";
      ov.querySelectorAll("[data-tf-heim]").forEach((b) => {
        const an = (b.dataset.tfHeim === "true") === heim;
        b.classList.toggle("is-on", an); b.setAttribute("aria-checked", String(an));
      });
      const titelEl = q('[data-tf="titel"]');
      if (titelEl && typ === "training" && !titelEl.value.trim()) titelEl.value = "Training";
      if (!isEdit) q(".tf-submit").textContent = typ === "spiel" ? "Spiel anlegen" : typ === "training" ? "Training anlegen" : "Termin anlegen";
    }
    function summary() {
      if (isEdit) return;
      ov.querySelectorAll("[data-tf-wdh]").forEach((b) => {
        const an = (b.dataset.tfWdh === "woechentlich") === woech;
        b.classList.toggle("is-on", an); b.setAttribute("aria-checked", String(an));
      });
      const box = q('[data-tf-summary]');
      q('[data-tf-bisrow]').hidden = !woech;
      const start = q('[data-tf="datum"]').value, bis = q('[data-tf="bis"]').value, zeit = q('[data-tf="zeit"]').value;
      if (!woech || !start || !bis || bis < start) { box.hidden = true; return; }
      const dates = weeklyDates(start, bis);
      box.hidden = false;
      box.textContent = `Es werden ${dates.length} Termine angelegt, ${weekdayPluralOf(start)}${zeit ? " " + zeit : ""}, vom ${ddmm(start)} bis ${ddmm(bis)}`;
    }

    syncTypUI(); summary(); anzeigen();
    ov.addEventListener("input", () => { anzeigen(); summary(); });
    ov.addEventListener("change", () => { anzeigen(); summary(); });
    ov.addEventListener("click", (ev) => {
      if (ev.target === ov) { closeTerminModal(); return; }
      const art = ev.target.closest("[data-tf-typ]");
      if (art) { typ = art.dataset.tfTyp; syncTypUI(); return; }
      const hb = ev.target.closest("[data-tf-heim]");
      if (hb) { heim = hb.dataset.tfHeim === "true"; syncTypUI(); return; }
      const wb = ev.target.closest("[data-tf-wdh]");
      if (wb) { woech = wb.dataset.tfWdh === "woechentlich"; summary(); return; }
    });
    q(".tf-x").addEventListener("click", closeTerminModal);

    const val = (sel, dflt) => { const el = q(sel); return el ? el.value : dflt; };
    function collect() {
      const t = isBfv ? (e.typ || "spiel") : typ;
      const spielEndeSichtbar = !q(".tf-ende-spiel").hidden;
      return {
        typ: t,
        titel: val('[data-tf="titel"]', e.titel || "").trim(),
        datum: q('[data-tf="datum"]').value,
        zeit: q('[data-tf="zeit"]').value,
        ende: t === "spiel" ? (spielEndeSichtbar ? q('[data-tf="ende2"]').value : (isEdit ? (e.ende || "") : "")) : q('[data-tf="ende"]').value,
        treffen: t === "spiel" ? q('[data-tf="treffen"]').value : "",
        ort: q('[data-tf="ort"]').value.trim(),
        notiz: q('[data-tf="notiz"]').value.trim(),
        gegner: val('[data-tf="gegner"]', e.gegner || "").trim(),
        heim: isBfv ? (e.heim === true) : heim,
        wdh: !isEdit && woech,
        bis: isEdit ? "" : q('[data-tf="bis"]').value,
      };
    }

    q(".termin-form").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const b = collect();
      const err = validateTermin(b);
      if (err) { hint.textContent = err; return; }
      const saveBtn = q(".tf-submit"); saveBtn.disabled = true;
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
    if (b.zeit && b.treffen && b.treffen > b.zeit) return "Die Treffzeit liegt nach dem Anstoß.";
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
      date: dateISO, time: b.zeit || null, ende: b.ende || null, treffen: isSpiel ? (b.treffen || null) : null,
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
      time: b.zeit || null, ende: b.ende || null, treffen: isSpiel ? (b.treffen || null) : null,
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
    const patch = { ende: b.ende || null, note: b.notiz || null, treffen: b.treffen || null };

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
    if (e.treffen) zeilen.push(`Treffen um ${e.treffen} Uhr.`);
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
      { key:"LST", role:"ST", x:34.8, y:22 }, { key:"RST", role:"ST", x:65.2, y:22 },
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
      ? `${fmtDay(ev.datum)}.\u00a0${fmtMon(ev.datum)}${ev.zeit ? " · " + ev.zeit + " Uhr" : ""} · ${ev.heim ? "vs." : "@"} ${esc(ev.gegner || ev.titel)}`
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
      `<option value="${e.id}" ${e.id === lb.eventId ? "selected" : ""}>${fmtDay(e.datum)}.\u00a0${fmtMon(e.datum)} · ${e.heim ? "vs." : "@"} ${esc(e.gegner || e.titel)}</option>`).join("");
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
    blattAuf("luScrim", "luPanel");
    const grp = slot ? lbTeamPart(slot.role) : null;
    if (grp) { const h = document.querySelector('#luPanelBody [data-grp="' + grp + '"]'); if (h) h.scrollIntoView({ block: "start" }); }
  }
  function lbClosePanel() { blattZu("luScrim", "luPanel"); }
  function lbOpenMore() { lbEnsurePanels(); lbRenderMoreBody(); blattAuf("luMoreScrim", "luMore"); }
  function lbCloseMore() { blattZu("luMoreScrim", "luMore"); }

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
      '<div class="page-head tv-head"><h1>Trainer</h1></div>' +
      (naechstes ? tvNextHtml(naechstes)
                 : '<div class="empty">Kein anstehendes Spiel. Sobald im Kalender ein Spiel angelegt ist, baust du hier die Elf.</div>') +
      // K3: Der Kader steht als eigene Karte unter dem naechsten Spiel. Ein
      // reiner Trainer kommt ueber den 5. Tab direkt hierher und haette sonst
      // keinen Weg dorthin.
      tvKaderKarteHtml() +
      (weitere.length
        ? '<div class="group-head"><h2>Weitere Spiele</h2>' +
          (weitere.length > 2
            ? '<button class="link-btn" data-tvallgames>' + (tv.alleSpiele ? "Weniger" : "Alle") + ' &rsaquo;</button>'
            : "") +
          '</div><div class="card dn-liste tv-glist">' +
          (tv.alleSpiele ? weitere : weitere.slice(0, 2)).map(tvGameRow).join("") + '</div>'
        : "") +
      tvTemplatesHtml();
  }

  // "in 6 Tagen" - die Vorlage nennt den Abstand, nicht das Datum;
  // das steht im Goldwuerfel links daneben.
  function anpfiffText(iso) {
    const tage = Math.round((parseDate(iso) - parseDate(HEUTE)) / 86400000);
    if (tage <= 0) return "heute";
    if (tage === 1) return "morgen";
    return "in " + tage + " Tagen";
  }
  /* Karte "Naechstes Spiel" (Vorlage Final 06): dunkler Kopf mit Goldwuerfel
     und Goldlinie, darunter die Zeile Rueckmeldungen (oeffnet das Blatt 04)
     und der eine Primaerknopf "Elf aufstellen". */
  function tvNextHtml(e) {
    const z = rueckZahlen(e);
    const pz = z.gesamt ? (z.zu / z.gesamt) * 100 : 0, pa = z.gesamt ? (z.ab / z.gesamt) * 100 : 0;
    const meta = (e.zeit ? esc(e.zeit) + "\u00a0Uhr · " : "") + anpfiffText(e.datum);
    const oben = "Nächstes Spiel" + (e.heim == null ? "" : " · " + (e.heim ? "Heim" : "Auswärts"));
    return '<div class="card tv-next">' +
      '<div class="tk-kopf is-hero is-gold tv-next-kopf"><div class="tk-kopfzeile">' +
        wuerfelHtml(e, "hero") +
        '<span class="tk-kopf-main"><span class="tk-oben">' + oben + '</span>' +
        '<span class="tk-titel">' + esc(e.gegner || e.titel) + '</span>' +
        '<span class="tk-zeit">' + meta + '</span></span>' +
      '</div></div>' +
      '<button class="tk-rueck tv-rueck" data-rsvp-sheet="' + e.id + '">' +
        '<span class="tk-rueck-main"><span class="tk-rueck-kopf"><span class="tk-rueck-t">Rückmeldungen</span></span>' +
        '<span class="tk-bar" role="img" aria-label="' + z.zu + ' zugesagt, ' + z.ab + ' abgesagt, ' + z.offen + ' offen">' +
          '<i class="is-zu" style="width:' + pz.toFixed(2) + '%"></i><i class="is-ab" style="width:' + pa.toFixed(2) + '%"></i></span>' +
        '<span class="tk-rueck-z">' + rueckZahlenHtml(z) + '</span></span>' +
        '<span class="tk-chev" aria-hidden="true">›</span></button>' +
      '<div class="tv-next-fuss"><button class="btn btn-primary tv-next-btn" data-tvgame="' + e.id + '">Elf aufstellen</button></div>' +
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
    const legende = KADER_STATUS.filter(([wert]) => zahl[wert] > 0).map(([wert, cls, label]) =>
      '<span class="tv-kstat ' + cls + '"><b>' + zahl[wert] + '</b> ' + label + '</span>'
    ).join('<span class="tv-ksep" aria-hidden="true"> · </span>');
    const gelesen = KADER_STATUS.map(([wert, , label]) => zahl[wert] + " " + label).join(", ");

    return '<button class="card tv-kader" data-goto="kader">' +
      '<span class="tv-kader-kopf"><span class="tv-kader-t">Kader</span>' +
      '<span class="tv-kader-n">' + gesamt + ' Spieler ›</span></span>' +
      '<span class="tv-kbar" role="img" aria-label="' + esc(gelesen) + '">' + balken + '</span>' +
      '<span class="tv-kleg">' + legende + '</span>' +
      '</button>';
  }


  /* Zeile in "Weitere Spiele" (Final 06): Strich, Goldwuerfel, Gegner,
     Zeit und Ort, Marke "Elf steht" / "Elf offen", Pfeil. */
  function tvGameRow(e) {
    const steht = aufstellungStand(e).steht;
    return '<button class="dn-zeile is-spiel tv-grow" data-tvgame="' + e.id + '">' +
      '<span class="dn-strich" aria-hidden="true"></span>' + wuerfelHtml(e, "klein") +
      '<span class="dn-main"><span class="dn-t">' + esc(e.gegner || e.titel) + '</span>' +
        '<span class="dn-s">' + (e.zeit ? esc(e.zeit) + " Uhr · " : "") + (e.heim ? "Heim" : "Auswärts") + '</span></span>' +
      '<span class="mark ' + (steht ? "is-gruen" : "is-amber") + '">' + (steht ? "Elf steht" : "Elf offen") + '</span>' +
      '<span class="row-chev tv-chev" aria-hidden="true">›</span></button>';
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
    const kopf = '<div class="group-head"><h2>Vorlagen</h2>' +
      (naechstes ? '<button class="link-btn" data-tvtplnew="' + naechstes.id + '">+ Neu</button>' : "") +
      '</div>';
    // A6: Der Abschnitt steht immer da. Ohne Vorlage sagt er, wie man eine anlegt -
    // sonst sucht man den Weg vergeblich.
    if (!tpl.length) {
      return kopf + '<div class="empty tv-tpl-leer">Noch keine Vorlage. Speichere eine Aufstellung über das Menü ··· als Vorlage.</div>';
    }
    return kopf + '<div class="card tv-tpls">' + tpl.map(l =>
      '<div class="tv-tpl"><span class="tv-tpl-main"><span class="tv-tpl-n">' + esc(l.name) + '</span>' +
      '<span class="tv-tpl-s">' + esc(l.formation) + ' · ' + tvTplStand(l) + '</span></span>' +
      '<button class="tk-menue tv-tpl-menue" data-tvtplmenu="' + l.id + '" aria-label="Mehr zur Vorlage ' + esc(l.name) + '">' +
        '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.9"/><circle cx="12" cy="12" r="1.9"/><circle cx="19" cy="12" r="1.9"/></svg></button></div>'
    ).join("") + '</div>';
  }
  // Die Vorlage schreibt „zuletzt genutzt"; die Tabelle kennt nur updated_at,
  // also steht hier ehrlich „geändert am".
  function tvTplStand(l) {
    if (!l.updatedAt) return "Vorlage";
    const d = new Date(l.updatedAt);
    if (isNaN(d)) return "Vorlage";
    return "geändert " + d.getDate() + ".\u00a0" + MON[d.getMonth()];
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
    tvToast(weg ? ((weg === 1 ? "1 Platz" : weg + " Plätze") + " leer, ohne Zusage oder verletzt") : "Vorlage angewendet");
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
    window.scrollTo(0, 0);   // die Platzansicht beginnt oben, egal wo die Spielzeile stand
  }
  function tvPlacedAll() { return new Set([].concat(Object.values(tv.assign).filter(Boolean), tv.bank)); }

  /* ---- Zustand 2: Aufstellung ---- */
  function tvPitchBg() {
    return '<div class="tv-pitch-bg" aria-hidden="true"><i class="tv-pl-rand"></i><i class="tv-pl-mitte"></i><i class="tv-pl-kreis"></i>' +
      '<i class="tv-pl-raum is-oben"></i><i class="tv-pl-raum is-unten"></i></div>';
  }
  // Anzeigeposition: die Vorlage staffelt die Reihen weiter (Abstand 24 %),
  // der Torwart bleibt bei 88 %; Seitenspieler 8 % weiter innen.
  function tvSlotPos(sl) {
    const x = 50 + (sl.x - 50) * 0.92;
    const y = sl.key === "TW" ? sl.y : 19.8 + (sl.y - 22) * (24.1 / 22);
    return 'left:' + x.toFixed(2) + '%;top:' + y.toFixed(2) + '%';
  }
  function tvPitchHtml(n) {
    const slots = FORMATIONS[tv.formation]; let h = tvPitchBg();
    slots.forEach(sl => {
      const pid = tv.assign[sl.key], p = pid ? playerById[pid] : null;
      const sel = ((tv.sel && tv.sel.key === sl.key) || (tv.mark && tv.mark.art === 'feld' && tv.mark.key === sl.key)) ? " sel" : "";
      h += '<div class="tv-slot' + (p ? " filled" : " is-frei") + sel + '" data-tvslot="' + sl.key + '" style="' + tvSlotPos(sl) + '"' +
        (p ? "" : ' role="button" aria-label="' + esc(posLang(sl.key)) + ' besetzen"') + '>' +
        (p ? '<div class="tv-disc"><span>' + (p.nr != null ? p.nr : "") + '</span></div><span class="tv-pn">' + esc(tvLastName(p.name)) + '</span>'
           : '<span class="tv-ring">+</span>' + (n ? '<span class="tv-frei-l">' + esc(sl.key) + ' frei</span>' : '')) + '</div>';
    });
    return h;
  }
  function tvFormbarHtml() {
    // Die Vorlage zeichnet die Formationspille als reinen Text. Das
    // Mini-Diagramm steht weiter in der Formationsauswahl im Blatt.
    return tvFav.map(f => '<button class="tv-fpill' + (f === tv.formation ? " on" : "") + '" data-tvform="' + f + '">' + f + '</button>').join("") +
      '<button class="tv-fpill tv-fmore" data-tvmoreform>Weitere</button>';
  }
  /* Langname einer Position (Blatt 07c, Hinweis 07b). */
  const POS_LANG = {
    TW: "Torwart", LV: "Linksverteidiger", RV: "Rechtsverteidiger",
    LIV: "Innenverteidiger links", RIV: "Innenverteidiger rechts", CIV: "Innenverteidiger zentral",
    LWB: "Linker Schienenspieler", RWB: "Rechter Schienenspieler",
    DM: "Defensives Mittelfeld", LDM: "Defensives Mittelfeld links", RDM: "Defensives Mittelfeld rechts",
    ZM: "Zentrales Mittelfeld", LZM: "Zentrales Mittelfeld links", RZM: "Zentrales Mittelfeld rechts",
    LM: "Linkes Mittelfeld", RM: "Rechtes Mittelfeld",
    OM: "Offensives Mittelfeld", LOM: "Offensives Mittelfeld links", ROM: "Offensives Mittelfeld rechts", ZOM: "Offensives Mittelfeld zentral",
    LA: "Linksaußen", RA: "Rechtsaußen", ST: "Stürmer", LST: "Stürmer links", RST: "Stürmer rechts",
  };
  const posLang = (key) => POS_LANG[key] || key;
  // Freie Positionen der offenen Aufstellung in Reihenfolge der Formation.
  function tvFreieKeys() { return (FORMATIONS[tv.formation] || []).filter((x) => !tv.assign[x.key]).map((x) => x.key); }
  const ICON_ZURUECK = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
  const ICON_PUNKTE = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.9"/><circle cx="12" cy="12" r="1.9"/><circle cx="19" cy="12" r="1.9"/></svg>';

  /* Platzansicht (Vorlage Final 07 und 07b): Unterkopf, Formationschips,
     Hinweis auf freie Positionen (1 bis 10 gesetzt), Platz 358 x 440, Bank im
     4er-Raster, darunter der eine Primaerknopf "Aufstellung speichern". */
  function tvViewLineup() {
    const e = DEMO.events.find(x => x.id === tv.eventId);
    if (!e) { tvViewGames(); return; }
    const n = tvPlaced().size, last = tvLastLineup(), ro = tv.readonly;
    const backLbl = tv.origin != null ? "Zurück" : "Zurück zur Spielauswahl";
    const frei = tvFreieKeys();
    const stand = n < 11 ? '<b class="tv-stand is-offen">' + n + ' von 11</b>' : n + " von 11";
    const hinweis = (!ro && n >= 1 && frei.length >= 1)
      ? '<button class="tv-frei-hinweis" data-tvfill>' +
          '<span class="tv-frei-dot" aria-hidden="true"></span>' +
          '<span class="tv-frei-t">' + (frei.length === 1 ? "1 Position frei: " + esc(posLang(frei[0])) : frei.length + " Positionen frei") + '</span>' +
          '<span class="tv-frei-go">' + (frei.length === 1 ? "Besetzen ›" : "Nächste besetzen ›") + '</span></button>'
      : "";
    viewEl.innerHTML =
      '<div class="tv-lu' + (ro ? " tv-ro" : "") + '">' +
        '<div class="tv-top">' +
          '<button class="tv-ic" data-tvback aria-label="' + backLbl + '">' + ICON_ZURUECK + '</button>' +
          '<div class="tv-hi"><div class="tv-game">vs. ' + esc(e.gegner || e.titel) + '</div>' +
            '<div class="tv-sub">' + fmtWd(e.datum) + ' ' + fmtDay(e.datum) + '. ' + fmtMon(e.datum) + (e.zeit ? " · " + e.zeit : "") + ' · ' + stand + (ro ? ' · nur ansehen' : '') + '</div></div>' +
          (ro ? '<span class="tv-ic" aria-hidden="true"></span>' : '<button class="tv-ic" data-tvmenu aria-label="Mehr">' + ICON_PUNKTE + '</button>') +
        '</div>' +
        '<div class="tv-formbar">' + tvFormbarHtml() + '</div>' +
        hinweis +
        '<div class="tv-field"><div class="tv-pitch">' + tvPitchHtml(n) +
          ((!ro && n === 0 && last && !tv.hideCta) ? '<div class="tv-cta-ov">' + tvEmptyCta(last) + '</div>' : "") +
          '</div></div>' +
        tvBankHtml() +
        (ro
          ? '<div class="tv-actions"><div class="tv-ro-note">Vergangenes Spiel. Nur ansehen.</div></div>'
          : '<div class="tv-actions"><button class="btn btn-primary tv-save" data-tvsave>Aufstellung speichern</button></div>') +
      '</div>';
  }
  function tvEmptyCta(last) {
    return '<div class="tv-cta"><p>Vom letzten Spiel übernehmen<br><b>' + esc("vs. " + (last.event.gegner || last.event.titel)) + '</b>. Fehlende Spieler werden automatisch durch verfügbare ersetzt.</p>' +
      '<button class="btn btn-primary" data-tvadopt>Übernehmen &amp; anpassen</button>' +
      '<button class="tv-ghost" data-tvfresh>Leer starten</button></div>';
  }
  // Auswechselbank (Final 07): Gruppenkopf mit Verweis, 4er-Raster, 7 Plaetze.
  function tvBankHtml() {
    const ro = tv.readonly;
    let h = '<div class="tv-bank"><div class="group-head tv-bank-kopf"><h2>Bank · ' + tv.bank.length + ' von ' + TV_BANK_MAX + '</h2>' +
      (ro ? "" : '<button class="link-btn" data-tvbankadd>Spieler wählen ›</button>') + '</div><div class="tv-bank-row">';
    const slots = ro ? tv.bank.length : TV_BANK_MAX;   // nur ansehen: keine Leer-Slots
    for (let i = 0; i < slots; i++) {
      const pid = tv.bank[i], p = pid ? playerById[pid] : null;
      if (p && ro) {
        h += '<span class="tv-bslot filled"><b class="tv-bnr">' + (p.nr != null ? p.nr : "") + '</b><span class="tv-bn">' + esc(tvLastName(p.name)) + '</span></span>';
      } else if (p) {
        // Tippen markiert oder tauscht; das Kreuz nimmt von der Bank (nicht in der Vorlage, bleibt).
        const markiert = (tv.mark && tv.mark.art === 'bank' && tv.mark.idx === i) ? ' sel' : '';
        h += '<button class="tv-bslot filled' + markiert + '" data-tvbanktap="' + i + '" aria-label="' + esc(p.name) + ' tauschen">' +
             '<b class="tv-bnr">' + (p.nr != null ? p.nr : "") + '</b><span class="tv-bn">' + esc(tvLastName(p.name)) + '</span>' +
             '<span class="tv-bx" data-tvbankdel="' + pid + '" role="button" aria-label="' + esc(p.name) + ' von der Bank nehmen">' +
             '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></span></button>';
      } else {
        h += '<button class="tv-bslot is-frei" data-tvbankadd aria-label="Bankspieler hinzufügen">+ frei</button>';
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
    // Einstellungs-Unterseite zuerst: wer von einer Kachel in die Einstellungen
    // gesprungen ist UND dort eine Unterseite geoeffnet hat, will mit dem ersten
    // Zurueck die Unterseite schliessen, nicht den ganzen Sprung ruecknehmen.
    if (einSyncAusHash()) return;
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
      '<div class="tv-sheet tv-ksheet" id="tvSheetKader" role="dialog" aria-modal="true" aria-label="Spieler wählen"><span class="tv-grip"></span><div class="tv-sh"><div class="tv-sh-text"><strong id="tvKaderTitle">Spieler wählen</strong><div class="tv-shsub" id="tvKaderSub"></div></div><button class="tv-shx" data-tvclose="kader" aria-label="Schließen">' + ICON_X + '</button><button type="button" class="tvb-fertig" data-tvclose="kader">Fertig</button></div><div class="tv-shbody" id="tvKaderBody"></div><div class="tv-kfuss" id="tvKaderFuss"></div></div>' +
      '<div class="tv-scrim" id="tvScrimForm" data-tvclose="form"></div>' +
      '<div class="tv-sheet" id="tvSheetForm" role="dialog" aria-modal="true" aria-label="Formationen"><div class="tv-sh"><span class="tv-grip"></span><div><strong id="tvFormTitle">Formation wechseln</strong><div class="tv-shsub" id="tvFormSub"></div></div><button class="tv-shx" data-tvclose="form" aria-label="Schließen">&times;</button></div><div class="tv-shbody"><div class="tv-fgrid" id="tvFgrid"></div></div><div class="tv-shactions" id="tvFormActions"></div></div>' +
      '<div class="tv-scrim" id="tvScrimMenu" data-tvclose="menu"></div>' +
      '<div class="tv-sheet tvm" id="tvSheetMenu" role="dialog" aria-modal="true" aria-label="Aufstellung"><span class="nsb-griff" aria-hidden="true"></span><div class="tvm-kopf"><span class="tvm-titel">Aufstellung</span><span class="tvm-sub" id="tvMenuSub"></span></div><div class="tv-shbody tvm-body" id="tvMenuBody"></div></div>' +
      '<div class="tv-toast" id="tvToast"></div>';
    document.body.appendChild(w);
    w.addEventListener("click", tvPanelClick);
    // E1: Blatt „Mehr“ ohne Kreuz - Wischen nach unten schließt.
    sheetSwipeToClose(document.getElementById("tvSheetMenu"), document.getElementById("tvMenuBody"), () => tvCloseMenu());

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
  function tvClosePanels() {
    blattZu("tvScrimKader", "tvSheetKader");
    blattZu("tvScrimForm",  "tvSheetForm");
    blattZu("tvScrimMenu",  "tvSheetMenu");
  }

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
    tv.fillQueue = null; tvOpenKader(key);       // leer und nichts markiert
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

  /* Blatt 07c "Spieler fuer die Position": gruppiert nach Eignung.
     Laeuft bei mehreren freien Positionen der Reihe nach (tv.fillQueue). */
  function tvOpenKader(key) {
    document.getElementById("tvSheetKader").classList.remove("is-bankmodus");
    tv.sel = { key: key }; tvViewLineup();
    const g = tvPosGruppen(key);
    document.getElementById("tvKaderTitle").textContent = posLang(key);
    const passen = g.passt.length;
    document.getElementById("tvKaderSub").textContent = (tv.assign[key] ? "Belegt" : "Position frei") + " · " +
      (passen === 1 ? "1 Zugesagter passt" : passen + " Zugesagte passen");
    tvRenderKaderBody(key);
    document.getElementById("tvKaderFuss").innerHTML = '<button class="btn btn-soft tv-leer" data-tvempty>' +
      (tv.assign[key] ? "Position leeren" : "Position leer lassen") + '</button>';
    blattAuf("tvScrimKader", "tvSheetKader");
    const b = document.getElementById("tvKaderBody"); if (b) b.scrollTop = 0;
  }
  // Kader-Auswahl fuer die BANK (Blatt 08): nach Mannschaftsteil.
  function tvOpenBank() {
    if (tv.bank.length >= TV_BANK_MAX) { tvToast("Bank ist voll (" + TV_BANK_MAX + ")"); return; }
    tv.sel = { bank: true }; tv.fillQueue = null; tvBankZeigen = false; tvViewLineup();
    document.getElementById("tvKaderTitle").textContent = "Spieler für die Bank";
    document.getElementById("tvSheetKader").classList.add("is-bankmodus");
    tvRenderBank();
    blattAuf("tvScrimKader", "tvSheetKader");
    const b = document.getElementById("tvKaderBody"); if (b) b.scrollTop = 0;
  }
  // Kandidaten fuer "Alle freien Zugesagten setzen": zugesagt und fit, nicht vergeben.
  function tvBankCandidates() {
    const placed = tvPlacedAll();
    const list = [];
    LB_GROUPS.forEach(([gk]) => {
      DEMO.players.filter(p => lbTeamPart(p.pos) === gk && tvAvail(p) === null && !placed.has(p.id))
        .sort(byName).forEach(p => list.push(p));
    });
    return list;
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
  function tvCloseKader() { tv.sel = null; blattZu("tvScrimKader", "tvSheetKader"); }

  // Gruppen fuer eine Position: passt, weitere Zugesagte, ohne Rueckmeldung, nicht verfuegbar.
  function tvPosGruppen(key) {
    const slot = FORMATIONS[tv.formation].find(x => x.key === key);
    const imFeld = tvPlaced(), bank = new Set(tv.bank);
    const g = { passt: [], weitere: [], ohne: [], weg: [] };
    DEMO.players.forEach(p => {
      if (imFeld.has(p.id)) return;                       // steht schon auf dem Platz
      const av = tvAvail(p);
      if (av && av.rank >= 3) { g.weg.push(p); return; }   // abgesagt, verletzt, Urlaub
      if (av && av.rank === 2) { g.ohne.push(p); return; } // ohne Rueckmeldung
      const r = slot ? lbAffRank(p.pos, slot.role) : -1;
      if (!bank.has(p.id) && r >= 0 && r <= 1) g.passt.push({ p, r }); else g.weitere.push(p);
    });
    g.passt = g.passt.sort((a, b) => (a.r - b.r) || byName(a.p, b.p)).map(x => x.p);
    g.weitere.sort((a, b) => ((bank.has(b.id) ? 1 : 0) - (bank.has(a.id) ? 1 : 0)) || byName(a, b));
    g.ohne.sort(byName); g.weg.sort(byName);
    return g;
  }
  // Nebenzeile: "AV · zugesagt" (angeschlagen dazu), sonst nur die Position.
  function tvNeben(p) {
    const r = tvRsvp(p.id), teile = [];
    if (p.pos) teile.push(esc(p.pos));
    if (tv.bank.indexOf(p.id) !== -1 || tvPlaced().has(p.id)) return teile.join("");   // vergeben: nur die Position
    const av = tvAvail(p);
    if (r === "zu" && (!av || av.rank <= 1)) teile.push("zugesagt");
    else if (!r && (!av || av.rank === 2)) teile.push("keine Rückmeldung");
    if (p.status === "angeschlagen") teile.push("angeschlagen");
    return teile.join(" · ");
  }
  function tvMarke(p) {
    if (tvPlaced().has(p.id)) return '<span class="mark"><span>Auf dem Platz</span></span>';
    if (tv.bank.indexOf(p.id) !== -1) return '<span class="mark is-gruen"><span>Auf der Bank</span></span>';
    if (p.status === "verletzt") return '<span class="mark is-rot"><span>Verletzt</span></span>';
    if (p.status === "urlaub") return '<span class="mark is-urlaub"><span>Urlaub</span></span>';
    if (tvRsvp(p.id) === "ab") return '<span class="mark"><span>Abgesagt</span></span>';
    return "";
  }
  /* Zeile im Blatt. links: Avatar (07c) oder Rueckennummer (08). Waehlbar:
     "+"; vergeben: Marke ohne Aktion; nicht verfuegbar: Marke, antippbar mit
     Rueckfrage (keine Funktion faellt weg). */
  function tvZeile(p, mitAvatar) {
    const vergeben = tvPlacedAll().has(p.id) && !(tv.sel && tv.sel.key && tv.bank.indexOf(p.id) !== -1);
    const marke = tvMarke(p);
    const av = tvAvail(p), gesperrt = av && av.rank >= 3;
    const links = mitAvatar ? '<span class="row-av"><span>' + esc(initials(p.name)) + '</span></span>'
                            : '<span class="tv-knr"><span>' + (p.nr != null ? p.nr : "") + '</span></span>';
    const rechts = vergeben ? marke : (marke || '<span class="add-btn" aria-hidden="true">+</span>');
    const attr = vergeben ? "" : ' data-tvplayer="' + p.id + '"' + (gesperrt ? ' data-tvtrotzdem=""' : "") + ' role="button" tabindex="0"';
    return '<div class="row tv-krow' + (mitAvatar ? "" : " is-bank") + (vergeben ? " is-vergeben" : "") + '"' + attr + '>' + links +
      '<span class="row-main"><span class="row-t">' + esc(p.name) + '</span><span class="row-s">' + tvNeben(p) + '</span></span>' +
      '<span class="row-end">' + rechts + '</span></div>';
  }
  /* Blatt „Spieler für die Bank“ (Nachschliff E2, Vorlage D8): die Liste
     zeigt nur, wer auf die Bank kann - frei oder schon auf der Bank. Auf dem
     Platz, verletzt und im Urlaub fallen raus und stehen in der Fußzeile
     („Ausgeblendet: 11 auf dem Platz · 1 verletzt · 1 Urlaub · Anzeigen“);
     „Anzeigen“ blendet sie blass und einzeilig ein. Angeschlagene bleiben
     wählbar und tragen eine Pille. Kopf mit 7 Platzmarken und „Fertig“ statt
     Kreuz; das Blatt bleibt nach jedem Tipp offen, bis die Bank voll ist. */
  let tvBankZeigen = false;
  const TV_HAKEN_W = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>';
  function tvBankKopf() {
    const sub = document.getElementById("tvKaderSub"); if (!sub) return;
    const n = tv.bank.length;
    let marken = "";
    for (let i = 0; i < TV_BANK_MAX; i++) marken += '<span class="tvb-mark' + (i < n ? " is-voll" : "") + '"></span>';
    sub.innerHTML = '<span class="tvb-marken" aria-hidden="true">' + marken + '</span><span class="tvb-stand"><b>' + n + '</b> von ' + TV_BANK_MAX + ' belegt</span>';
  }
  function tvBankGrund(p) {
    if (tv.bank.indexOf(p.id) !== -1) return null;
    if (tvPlacedAll().has(p.id)) return "platz";
    if (p.status === "verletzt") return "verletzt";
    if (p.status === "urlaub") return "urlaub";
    return null;
  }
  function tvBankZeile(p) {
    const aufBank = tv.bank.indexOf(p.id) !== -1;
    const r = tvRsvp(p.id);
    const neben = [p.pos ? esc(p.pos) : "", aufBank ? "auf der Bank" : r === "zu" ? "zugesagt" : r === "ab" ? "abgesagt" : "keine Rückmeldung"].filter(Boolean).join(" · ");
    const pille = !aufBank && p.status === "angeschlagen" ? '<span class="tvb-pille">angeschlagen</span>' : "";
    const knopf = aufBank ? '<span class="tvb-kreis is-an">' + TV_HAKEN_W + '</span>' : '<span class="tvb-kreis">+</span>';
    const attr = aufBank ? "" : ' data-tvplayer="' + p.id + '" role="button" tabindex="0" aria-label="' + esc(p.name) + ' auf die Bank"';
    return '<div class="tvb-zeile' + (aufBank ? " is-bank" : "") + '"' + attr + '><span class="tvb-nr">' + (p.nr != null ? p.nr : "") + '</span>' +
      '<span class="tvb-main"><span class="tvb-name">' + esc(p.name) + '</span><span class="tvb-neben">' + neben + '</span></span>' + pille +
      '<span class="tvb-knopf" aria-hidden="true">' + knopf + '</span></div>';
  }
  function tvBankBodyHtml() {
    const frei = TV_BANK_MAX - tv.bank.length, n = Math.min(frei, tvBankCandidates().length);
    let h = n > 0 ? '<div class="tvb-alle"><button type="button" class="btn btn-soft tv-kall" data-tvbankall>Alle ' + n + ' freien Zugesagten setzen</button></div>' : "";
    const aus = { platz: 0, verletzt: 0, urlaub: 0 };
    const blass = [];
    LB_GROUPS.forEach(([gk, label]) => {
      const alle = DEMO.players.filter((p) => lbTeamPart(p.pos) === gk).sort(byName);
      const waehlbar = alle.filter((p) => !tvBankGrund(p));
      alle.forEach((p) => { const g = tvBankGrund(p); if (g) { aus[g]++; blass.push(p); } });
      if (waehlbar.length) h += '<div class="tvb-gruppe">' + label + ' · ' + waehlbar.length + '</div>' + waehlbar.map(tvBankZeile).join("");
    });
    if (tvBankZeigen && blass.length) h += '<div class="tvb-gruppe">Ausgeblendet</div>' + blass.map((p) =>
      '<div class="tvb-zeile is-blass"><span class="tvb-nr">' + (p.nr != null ? p.nr : "") + '</span><span class="tvb-name">' + esc(p.name) + '</span>' +
      '<span class="tvb-grund">' + ({ platz: "auf dem Platz", verletzt: "verletzt", urlaub: "Urlaub" })[tvBankGrund(p)] + '</span></div>').join("");
    const teile = [aus.platz ? '<b>' + aus.platz + '</b> auf dem Platz' : "", aus.verletzt ? '<b>' + aus.verletzt + '</b> verletzt' : "", aus.urlaub ? '<b>' + aus.urlaub + '</b> Urlaub' : ""].filter(Boolean);
    const fuss = teile.length ? '<div class="tvb-fuss"><span class="tvb-fuss-t">Ausgeblendet: ' + teile.join(" · ") + '</span>' +
      '<button type="button" class="tvb-zeigen" data-tvbankzeigen>' + (tvBankZeigen ? "Ausblenden" : "Anzeigen") + '</button></div>' : "";
    return { body: h || '<div class="empty">Kein Spieler frei.</div>', fuss };
  }
  function tvRenderBank() {
    const body = document.getElementById("tvKaderBody"), fuss = document.getElementById("tvKaderFuss");
    if (!body) return;
    const r = tvBankBodyHtml();
    body.innerHTML = r.body;
    if (fuss) fuss.innerHTML = r.fuss;
    tvBankKopf();
  }
  function tvRenderKaderBody(key) {
    const body = document.getElementById("tvKaderBody"); if (!body) return;
    if (!DEMO.players.length) { body.innerHTML = '<div class="empty">Kein Kader vorhanden.</div>'; return; }
    const gruppe = (titel, list, avatar) => list.length
      ? '<div class="group-head"><h2>' + titel + '</h2></div><div class="card tv-kcard">' + list.map(p => tvZeile(p, avatar)).join("") + '</div>' : "";
    let h = "";
    if (key) {
      const g = tvPosGruppen(key);
      h = gruppe("Passt zur Position", g.passt, true) + gruppe("Weitere Zugesagte", g.weitere, true) +
          gruppe("Ohne Rückmeldung", g.ohne, true) + gruppe("Nicht verfügbar", g.weg, true);
      if (!h) h = '<div class="empty">Kein Spieler frei.</div>';
    } else {
      const frei = TV_BANK_MAX - tv.bank.length, n = Math.min(frei, tvBankCandidates().length);
      if (n > 0) h += '<button class="btn btn-soft tv-kall" data-tvbankall>Alle ' + n + ' freien Zugesagten setzen</button>';
      const placed = tvPlacedAll();
      const rang = (p) => placed.has(p.id) ? 2 : ((tvAvail(p) || { rank: 0 }).rank >= 3 ? 1 : 0);
      LB_GROUPS.forEach(([gk, label]) => {
        const list = DEMO.players.filter(p => lbTeamPart(p.pos) === gk).sort((a, b) => (rang(a) - rang(b)) || byName(a, b));
        h += gruppe(label + " · " + list.length, list, false);
      });
    }
    body.innerHTML = h;
  }

  function tvOpenForm(edit) {
    tvFavMode = !!edit;
    document.getElementById("tvFormTitle").textContent = tvFavMode ? "Favoriten bearbeiten" : "Formation wechseln";
    document.getElementById("tvFormSub").textContent = tvFavMode ? "2 bis 4 markieren" : "Tippen zum Wechseln · Stern = Favorit";
    tvRenderFgrid(); tvRenderFormActions();
    blattAuf("tvScrimForm", "tvSheetForm");
  }
  function tvCloseForm() { blattZu("tvScrimForm", "tvSheetForm"); }
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

  /* Blatt „Mehr“ der Aufstellung (Nachschliff E1, Vorlage D7): Blatt auf --bg
     mit drei Gruppen in weißen Karten - Aktionen, Vorlagen, Leeren. Kopf mit
     Titel und Spiel; „Favoriten bearbeiten“ (Formations-Editor) steht im Kopf
     der Vorlagen-Gruppe. Das Kreuz entfällt (Griff, Wischen, Tippen daneben). */
  const TVM_IC = {
    holen: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12a8 8 0 0 1 14-5.3M20 4v4h-4M20 12a8 8 0 0 1-14 5.3M4 20v-4h4"/></svg>',
    merken: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3.5h12v17l-6-4-6 4z"/></svg>',
    muell: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12.5A1.5 1.5 0 0 0 8.5 21h7a1.5 1.5 0 0 0 1.5-1.5L18 7M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7"/></svg>',
  };
  function tvOpenMenu() {
    const tpl = (DEMO.lineups || []).filter(l => l.isTemplate);
    const ev = DEMO.events.find((x) => x.id === tv.eventId);
    const sub = document.getElementById("tvMenuSub");
    if (sub) sub.textContent = ev ? ["vs. " + (ev.gegner || ev.titel), fmtWd(ev.datum) + " " + fmtDay(ev.datum) + ".\u00a0" + fmtMon(ev.datum)].join(" · ") : "";
    const zeile = (attr, ic, text) => '<button type="button" class="tvm-zeile" ' + attr + '>' + TVM_IC[ic] + '<span class="tvm-zt">' + text + '</span><span class="tvm-chev" aria-hidden="true">›</span></button>';
    document.getElementById("tvMenuBody").innerHTML =
      '<div class="tvm-karte">' + zeile("data-tvadopt", "holen", "Vom letzten Spiel übernehmen") + '<div class="tvm-linie" aria-hidden="true"></div>' +
        zeile("data-tvtplsave", "merken", "Als Vorlage speichern") + '</div>' +
      '<div class="tvm-gruppe"><span class="tvm-gt">Vorlage anwenden</span><button type="button" class="tvm-fav" data-tvfavedit>Favoriten bearbeiten</button></div>' +
      '<div class="tvm-karte">' + (tpl.length ? tpl.map((l) =>
        '<button type="button" class="tvm-vorlage" data-tvtplapply="' + l.id + '"><span class="tvm-form num">' + esc(l.formation) + '</span>' +
        '<span class="tvm-vn">' + esc(l.name) + '</span><span class="tvm-anw">Anwenden</span></button>').join('<div class="tvm-linie" aria-hidden="true"></div>')
        : '<div class="tvm-leer">Noch keine Vorlage gespeichert.</div>') + '</div>' +
      '<button type="button" class="tvm-karte tvm-leeren" data-tvclear>' + TVM_IC.muell + '<span>Aufstellung leeren</span></button>';
    blattAuf("tvScrimMenu", "tvSheetMenu");
  }
  function tvCloseMenu() { blattZu("tvScrimMenu", "tvSheetMenu"); }

  let tvToastT = 0;
  function tvToast(msg) { const t = document.getElementById("tvToast"); if (!t) return; t.textContent = msg; t.classList.add("show"); clearTimeout(tvToastT); tvToastT = setTimeout(() => t.classList.remove("show"), 2000); }

  function tvPanelClick(ev) {
    const t = ev.target;
    const cl = t.closest("[data-tvclose]"); if (cl) { const w = cl.dataset.tvclose; if (w === "kader") { tvCloseKader(); tvViewLineup(); } else if (w === "form") tvCloseForm(); else tvCloseMenu(); return; }
    if (t.closest("[data-tvempty]")) {
      if (tv.sel && tv.sel.key && tv.assign[tv.sel.key]) { delete tv.assign[tv.sel.key]; tv.dirty = true; }
      const naechste = tvNaechsteFreie(tv.sel && tv.sel.key);
      tvCloseKader();
      if (naechste) tvOpenKader(naechste); else tvViewLineup();
      return;
    }
    if (t.closest("[data-tvbankall]")) { tvBankFillAll(); return; }
    const pl = t.closest("[data-tvplayer]");
    if (pl) {
      if (pl.hasAttribute("data-tvtrotzdem")) {
        const p = playerById[pl.dataset.tvplayer];
        if (!window.confirm((p ? p.name : "Spieler") + " ist nicht verfügbar. Trotzdem aufstellen?")) return;
      }
      const key = tv.sel && tv.sel.key;
      if (tv.sel && tv.sel.bank) {
        tvAddBank(pl.dataset.tvplayer);
        if (tv.bank.length < TV_BANK_MAX) { tvViewLineup(); tvRenderBank(); return; }   // E2: Blatt bleibt offen, bis die Bank voll ist
      } else if (key) tvAssign(key, pl.dataset.tvplayer);
      const naechste = key ? tvNaechsteFreie(key) : null;
      tvCloseKader();
      if (naechste) tvOpenKader(naechste); else { tv.fillQueue = null; tvViewLineup(); }
      return;
    }
    if (t.closest("[data-tvbankzeigen]")) { tvBankZeigen = !tvBankZeigen; tvRenderBank(); return; }
    const star = t.closest("[data-tvstar]"); if (star) { ev.stopPropagation(); tvToggleFav(star.dataset.tvstar); tvRenderFgrid(); tvRenderFormActions(); return; }
    const fc = t.closest("[data-tvfcard]"); if (fc) { const f = fc.dataset.tvfcard; if (tvFavMode) { tvToggleFav(f); tvRenderFgrid(); tvRenderFormActions(); } else { tvSwitchFormation(f); tvCloseForm(); tvViewLineup(); } return; }
    if (t.closest("[data-tvfavdone]")) { if (tvFav.length < 2) return; if (!tvFav.includes(tv.formation)) tv.formation = tvFav[0]; tvCloseForm(); tvViewLineup(); return; }
    if (t.closest("[data-tvfavedit]")) { tvCloseMenu(); tvOpenForm(true); return; }
    if (t.closest("[data-tvadopt]")) { tvCloseMenu(); tvAdopt(); return; }
    if (t.closest("[data-tvtplsave]")) { tvCloseMenu(); tvSaveTemplate(); return; }
    const ta = t.closest("[data-tvtplapply]"); if (ta) { tvApplyTemplate(ta.dataset.tvtplapply); return; }
    if (t.closest("[data-tvclear]")) { tvCloseMenu(); tv.assign = {}; tv.sel = null; tv.dirty = true; tvViewLineup(); return; }
  }
  // Naechste freie Position der Warteschlange (Hinweis 07b), sonst null.
  function tvNaechsteFreie(aktuell) {
    if (!tv.fillQueue) return null;
    tv.fillQueue = tv.fillQueue.filter(k => k !== aktuell && !tv.assign[k]);
    if (!tv.fillQueue.length) { tv.fillQueue = null; return null; }
    return tv.fillQueue[0];
  }
  function tvViewClick(ev) {
    const t = ev.target;
    if (t.closest("[data-tvfill]")) { tv.fillQueue = tvFreieKeys(); if (tv.fillQueue.length) tvOpenKader(tv.fillQueue[0]); return true; }
    if (t.closest("[data-tvallgames]")) { tv.alleSpiele = !tv.alleSpiele; tvViewGames(); return true; }
    const td = t.closest("[data-tvtpldel]"); if (td) { tvDeleteTemplate(td.dataset.tvtpldel); return true; }
    const tm = t.closest("[data-tvtplmenu]");
    if (tm) {
      const l = (DEMO.lineups || []).find((x) => x.id === tm.dataset.tvtplmenu);
      if (l) openZeilenMenue("tvTplMenu", "Vorlage " + l.name, ['<button class="more-item is-danger" data-tvtpldel="' + l.id + '">Vorlage löschen</button>']);
      return true;
    }
    // „Neu" bei den Vorlagen: eine Vorlage entsteht nur aus einer offenen
    // Aufstellung, also geht es in die Platzansicht des naechsten Spiels.
    const tn = t.closest("[data-tvtplnew]");
    if (tn) { tvOpenGame(tn.dataset.tvtplnew); tvToast("Elf bauen, dann im Menü ··· als Vorlage speichern"); return true; }
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

  /* Katalogkachel (Vorlage Final 17): Name links (zweizeilig erlaubt), bei
     Staffel "je 5 Minuten · max 10,00 €" darunter; Betrag rechts, "›" fuer
     Bearbeitende (ganze Kachel oeffnet das Blatt). Spieler: nur Ansicht. */
  function katRowView(k, canEdit) {
    const staffel = k.typ === "staffel";
    const amt = euro(staffel ? (k.proEinheit || 0) : k.betrag);
    const unten = staffel ? ["je " + (k.schritt || 1) + " " + esc(k.einheit || ""), k.maxBetrag != null ? "max " + euro(k.maxBetrag) : ""].filter(Boolean).join(" · ") : "";
    const inhalt = '<span class="kat-main"><span class="kat-name">' + esc(k.vergehen) + '</span>' + (unten ? '<span class="kat-sub">' + unten + '</span>' : "") + '</span>' +
      '<span class="kat-amount">' + amt + '</span>';
    return canEdit
      ? '<button type="button" class="kat-item is-tap" data-kat-edit="' + k.id + '" aria-label="' + esc(k.vergehen) + ' bearbeiten">' + inhalt + '<span class="row-chev" aria-hidden="true">›</span></button>'
      : '<div class="kat-item">' + inhalt + '</div>';
  }
  /* Blatt „Strafe bearbeiten / hinzufügen“ (Nachschliff D3, Muster für alle
     Blätter): Griff, Titel 20/800, beschriftete Felder (Label 12/700, Feld 46),
     Art als Segment Festbetrag | Staffel, bei Staffel je, Einheit und max im
     selben Feldmuster darunter. Fuß Abbrechen | Speichern in zwei gleich
     breiten Spalten; Löschen als roter Textknopf darunter (nur Bearbeiten).
     Das Kreuz entfällt, Abbrechen übernimmt. */
  const NSB_MUELL = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12.5A1.5 1.5 0 0 0 8.5 21h7a1.5 1.5 0 0 0 1.5-1.5L18 7M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7"/></svg>';
  function katBlattHtml(k) {
    const isStaffel = !!(k && k.typ === "staffel");
    const nm = (n) => (n == null ? "" : String(n).replace(".", ","));
    const betrag = k ? (isStaffel ? k.proEinheit : k.betrag) : null;
    const feld = (label, inner, extra) => '<label class="nsb-feld' + (extra ? " " + extra : "") + '"><span class="nsb-l">' + label + '</span>' + inner + '</label>';
    return `<div class="kat-blatt nsb" role="dialog" aria-modal="true" aria-label="${k ? "Strafe bearbeiten" : "Strafe hinzufügen"}">
          <span class="nsb-griff" aria-hidden="true"></span>
          <div class="nsb-titel"><span>${k ? "Strafe bearbeiten" : "Strafe hinzufügen"}</span></div>
          <div class="nsb-felder kat-edit${isStaffel ? " is-staffel" : ""}">
            ${feld("Bezeichnung", `<input class="nsb-in" data-kat-input="name" type="text" placeholder="z. B. Zu spät zum Training" value="${esc(k ? k.vergehen : "")}">`)}
            <div class="nsb-feld"><span class="nsb-l" id="katArtL">Art</span>
              <div class="nsb-seg" role="radiogroup" aria-labelledby="katArtL">
                <button type="button" class="nsb-seg-b${!isStaffel ? " is-on" : ""}" role="radio" aria-checked="${!isStaffel}" data-kat-art="fixed">Festbetrag</button>
                <button type="button" class="nsb-seg-b${isStaffel ? " is-on" : ""}" role="radio" aria-checked="${isStaffel}" data-kat-art="staffel">Staffel</button>
              </div>
              <input type="hidden" data-kat-type value="${isStaffel ? "staffel" : "fixed"}"></div>
            ${feld("Betrag", `<span class="nsb-in nsb-eur"><input data-kat-input="amount" type="text" inputmode="decimal" placeholder="0,00" value="${esc(nm(betrag))}" aria-label="Betrag"><span aria-hidden="true">€</span></span>`)}
            ${feld("je", `<input class="nsb-in" data-kat-input="schritt" inputmode="numeric" placeholder="z. B. 5" value="${esc(k && k.schritt != null ? String(k.schritt) : "")}">`, "kat-staffel")}
            ${feld("Einheit", `<input class="nsb-in" data-kat-input="einheit" type="text" placeholder="z. B. Minuten" value="${esc(k ? (k.einheit || "") : "")}">`, "kat-staffel")}
            ${feld("max", `<span class="nsb-in nsb-eur"><input data-kat-input="maxBetrag" inputmode="decimal" placeholder="optional" value="${esc(nm(k ? k.maxBetrag : null))}" aria-label="Höchstbetrag"><span aria-hidden="true">€</span></span>`, "kat-staffel")}
          </div>
          <div class="nsb-fuss">
            <button type="button" class="btn nsb-sek" data-kat-cancel>Abbrechen</button>
            <button type="button" class="btn btn-primary nsb-prim kat-speichern" data-kat-save="${k ? k.id : "new"}">Speichern</button>
          </div>
          ${k ? `<button type="button" class="nsb-del kat-del-btn" data-kat-del="${k.id}">${NSB_MUELL}<span>Strafe löschen</span></button>` : ""}
        </div>`;
  }

  function renderKatalog() {
    const canEdit = Roles.canEditCatalog();
    const blatt = canEdit && katEdit != null;
    const k = blatt && katEdit !== "new" ? DEMO.katalog.find((x) => x.id === katEdit) : null;
    viewEl.innerHTML = `
      <div class="page-head h1row kal-kopf"><h1>Strafenkatalog</h1>${canEdit ? `<button class="link-btn kal-plus" data-kat-add type="button">+ Strafe</button>` : ""}</div>
      <div class="kat-list">
        ${DEMO.katalog.map((x) => katRowView(x, canEdit)).join("")}
      </div>
      ${blatt ? `
      <div class="kat-blatt-ov" id="katBlatt">
        <button class="kat-blatt-hg" data-kat-cancel aria-label="Schließen"></button>
        ${katBlattHtml(k)}
      </div>` : ""}
    `;
    // Kein Autofokus beim Oeffnen (Konvention: keine Tastatur ohne Tipp).
  }

  /* ---------- Strafen-Konto ------------------------------------------------- */
  let strafenFilter = "offen"; // offen | gemeldet | bezahlt | alle (alle Status)
  let kontoSeg = null;          // "ich" | "team"; null = nach Verknuepfung (Final 11/12)

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
        <div class="mb-note">Bitte einen Trainer oder Admin um die Zuordnung. Danach siehst du hier deine Strafen.</div>
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

    const meineOffenZahl = meine.filter((s) => fineStatus(s) === "offen").length;
    const unter = [];
    if (meineOffenZahl) unter.push(meineOffenZahl + (meineOffenZahl === 1 ? " Strafe offen" : " Strafen offen"));
    if (meineGemeldet) unter.push('<b class="mb-gem">' + meineGemeldet + " gemeldet</b>");

    return `<div class="mine-banner${meineOffen > 0 ? "" : " is-clear"}">
        <div class="mb-label">Dein Konto · ${esc(me.name)}</div>
        <div class="mb-value num">${euro(meineOffen)}</div>
        <div class="mb-sub">${meineOffen > 0 ? unter.join(" · ")
          : meineGemeldet > 0 ? "Zahlung gemeldet, wartet auf Bestätigung" : "Du bist schuldenfrei"}</div>
        ${meinZuschlag > 0 ? `<div class="mb-note">inkl. ${euro(meinZuschlag)} Mahnzuschlag</div>` : ""}
        ${meineOffen > 0 ? `
          <a class="btn btn-primary mb-pay" href="${paypalMeLink(meineOffen)}" target="_blank" rel="noopener noreferrer">${euro(meineOffen)} jetzt bezahlen</a>
          <div class="mb-pp">über <b class="pp-word">Pay<span>Pal</span></b> · Freunde &amp; Familie</div>
          <div class="mb-foot">
            <button class="link-btn" data-paid-self>Zahlung melden ›</button>
            ${bannerCd ? `<span class="mark is-rot mb-cd cd" data-cd-prefix="Erhöhung in " data-cd-created="${bannerCd.createdAt}" data-cd-step="${faelligeStufen({ createdAt: bannerCd.createdAt }, Date.now())}">Erhöhung in ${fmtRestzeit(bannerCd.remMs, true)}</span>` : ""}
          </div>` : ""}
      </div>`;
  }

  /* ---------- „Zahlung melden" (Spieleransicht) ------------------------------
     Blatt im Stil des Buchen-Blatts der Kasse: drei Zahlart-Chips (Pflicht) und
     eine freiwillige Notiz. Beides landet in reported_method / reported_note
     (Migration 0040) und steht dem Kassenwart in der Kasse vor Augen, bevor er
     bestaetigt oder ablehnt. */
  const ZM_MAX = 140;
  const zm = { zahlart: "", note: "" };

  function zmEnsure() {
    if (document.getElementById("zmBl")) return;
    const scrim = document.createElement("div");
    scrim.className = "tv-scrim"; scrim.id = "zmScrim";
    const sheet = document.createElement("div");
    sheet.className = "tv-sheet ks-bl"; sheet.id = "zmBl";
    sheet.setAttribute("role", "dialog"); sheet.setAttribute("aria-modal", "true");
    sheet.setAttribute("aria-label", "Zahlung melden");
    document.body.appendChild(scrim); document.body.appendChild(sheet);
    scrim.addEventListener("click", zmClose);
    sheet.addEventListener("click", async (ev) => {
      if (ev.target.closest("[data-zm-close]")) { zmClose(); return; }
      const z = ev.target.closest("[data-zm-zart]");
      if (z) { zm.zahlart = z.dataset.zmZart; zmRender(); return; }
      if (ev.target.closest("[data-zm-send]")) { await zmSenden(); return; }
    });
    // Der Zaehler laeuft mit, ohne das Feld neu zu zeichnen - sonst springt
    // der Cursor bei jedem Zeichen an den Anfang.
    sheet.addEventListener("input", (ev) => {
      if (!ev.target.matches("[data-zm-note]")) return;
      zm.note = ev.target.value;
      const z = sheet.querySelector(".zm-zahl");
      if (z) z.outerHTML = zmZaehlerHtml();
      // Der Knopf muss mitlaufen: sonst laesst sich ein zu langer Text
      // abschicken und die Datenbank kuerzt ihn stillschweigend.
      const btn = sheet.querySelector("[data-zm-send]");
      if (btn) btn.disabled = !zm.zahlart || katLaenge(zm.note) > ZM_MAX;
    });
  }

  function zmZaehlerHtml() {
    const n = katLaenge(zm.note);
    return '<span class="zm-zahl' + (n > ZM_MAX ? " is-lang" : "") + '">' + n + "/" + ZM_MAX + "</span>";
  }

  function zmRender() {
    const sheet = document.getElementById("zmBl");
    if (!sheet) return;
    const me = playerById[state.currentPlayerId];
    const offen = me ? summeOffenSpieler(me.id) : 0;
    const anzahl = me ? aktiveStrafen().filter((s) => s.playerId === me.id && fineStatus(s) === "offen").length : 0;
    const chips = KASSE_ZAHLARTEN.map(([k, label]) =>
      `<button type="button" class="zart${zm.zahlart === k ? " is-on" : ""}" data-zm-zart="${k}">${zartIconHtml(k)}<span>${label}</span></button>`).join("");
    const zuviel = katLaenge(zm.note) > ZM_MAX;
    sheet.innerHTML =
      '<div class="tv-sh"><span class="tv-grip"></span><strong>Zahlung melden</strong>' +
      '<button class="tv-shx" data-zm-close aria-label="Schließen">&times;</button></div>' +
      '<div class="tv-shbody">' +
        '<div class="ks-bl-sum"><div class="ks-bl-top"><span class="ks-bl-n">Offener Betrag</span>' +
        '<span class="ks-bl-b num">' + euro(offen) + '</span></div>' +
        '<div class="ks-bl-s">' + anzahl + (anzahl === 1 ? " Strafe" : " Strafen") + ' werden als gemeldet markiert.</div></div>' +
        '<div class="lbl ks-bl-lbl">Zahlart</div>' +
        '<div class="zart-row">' + chips + '</div>' +
        '<div class="lbl ks-bl-lbl zm-lbl">Notiz <span class="zm-opt">freiwillig</span>' + zmZaehlerHtml() + '</div>' +
        '<textarea class="kasse-in zm-note" data-zm-note rows="2" maxlength="' + (ZM_MAX + 40) + '" ' +
        'placeholder="zahle bar am Donnerstag" aria-label="Notiz zur Zahlung">' + esc(zm.note) + '</textarea>' +
        '<button class="btn btn-primary ks-bl-cta" data-zm-send' + (zm.zahlart && !zuviel ? "" : " disabled") + '>Zahlung melden</button>' +
      '</div>';
  }

  function zmOpen() {
    zmEnsure();
    zm.zahlart = ""; zm.note = "";
    zmRender();
    blattAuf("zmScrim", "zmBl");
  }
  function zmClose() {
    blattZu("zmScrim", "zmBl");
  }

  async function zmSenden() {
    if (!zm.zahlart || katLaenge(zm.note) > ZM_MAX) return;
    const btn = document.querySelector("[data-zm-send]"); if (btn) btn.disabled = true;
    try {
      const n = await DB.reportMyPayment(zm.zahlart, zm.note.trim() || null);
      zmClose();
      await reloadData();
      tvToast((n || 0) + ((n === 1) ? " Strafe gemeldet" : " Strafen gemeldet"));
    } catch (err) {
      if (btn) btn.disabled = false;
      window.alert("Konnte die Zahlung nicht melden: " + ((err && err.message) || err));
    }
  }

  /* Strafen-Konto (Vorlage Final 11 und 12): Segment Ich / Mannschaft.
     Ich: Kontobanner, Chips Offen / Gemeldet / Bezahlt mit Anzahl, eigene
     Strafen in einer Karte. Mannschaft: Kacheln "Offen" und "In der Kasse",
     dieselben Chips ueber das ganze Team, Liste mit Avatar. Ein erneuter Tipp
     auf den aktiven Chip zeigt alle Status (bisher Chip "Alle"). */
  function renderStrafen() {
    const me = playerById[state.currentPlayerId];
    const linked = !!(currentProfile && currentProfile.player_id && me);
    // Altlast der Sprungziele: "meine" heisst Segment Ich mit Chip Offen.
    if (strafenFilter === "meine") { kontoSeg = "ich"; strafenFilter = "offen"; }
    const seg = kontoSeg || (linked ? "ich" : "team");

    const alle = aktiveStrafen().map((x) => ({
      ...x, betrag: strafeBetrag(x), st: fineStatus(x), player: playerById[x.playerId],
    })).filter((x) => x.player);
    const imSeg = seg === "ich" ? (linked ? alle.filter((x) => x.playerId === me.id) : []) : alle;
    const anz = (st) => imSeg.filter((x) => x.st === st).length;
    const stKey = { offen: "offen", gemeldet: "gemeldet", bezahlt: "bestätigt" };
    const gefiltert = (strafenFilter === "alle" ? imSeg.slice() : imSeg.filter((x) => x.st === stKey[strafenFilter]));
    const stRank = { offen: 0, gemeldet: 1, "bestätigt": 2 };
    gefiltert.sort((a, b) => (stRank[a.st] - stRank[b.st]) || b.datum.localeCompare(a.datum));

    const summe = (st) => alle.filter((x) => x.st === st).reduce((a, x) => a + x.betrag, 0);
    const anzahl = (st) => alle.filter((x) => x.st === st).length;
    const chips = [["offen", "Offen"], ["gemeldet", "Gemeldet"], ["bezahlt", "Bezahlt"]];
    const betragKl = (x) => x.st === "offen" ? "is-rot" : x.st === "gemeldet" ? "is-amber" : "is-gruen";
    const zeile = (x) => {
      const datum = fmtDay(x.datum) + ".\u00a0" + fmtMon(x.datum) + (x.auto ? " · automatisch" : "");
      const grund = x.st === "offen" && x.ablehnGrund ? '<span class="row-s is-rot">Abgelehnt: ' + esc(x.ablehnGrund) + '</span>' : "";
      return seg === "ich"
        ? '<div class="row kt-row"><span class="row-main"><span class="row-t">' + esc(vergehenName(x)) + '</span>' +
            '<span class="row-s">' + datum + '</span>' + grund + '</span>' +
            '<span class="row-end kt-betrag ' + betragKl(x) + '">' + euro(x.betrag) + '</span></div>'
        : '<div class="row kt-row"><span class="row-av"><span>' + esc(initials(x.player.name)) + '</span></span>' +
            '<span class="row-main"><span class="row-t">' + esc(x.player.name) + '</span>' +
            '<span class="row-s">' + esc(vergehenName(x)) + ' · ' + datum + '</span>' + grund + '</span>' +
            '<span class="row-end kt-betrag ' + betragKl(x) + '">' + euro(x.betrag) + '</span></div>';
    };

    viewEl.innerHTML = `
      <div class="page-head">${navBackChevronHtml()}<h1>Strafen-Konto</h1></div>
      <div class="seg kt-seg" role="tablist">
        <button class="seg-b${seg === "ich" ? " is-on" : ""}" role="tab" aria-selected="${seg === "ich"}" data-kseg="ich">Ich</button>
        <button class="seg-b${seg === "team" ? " is-on" : ""}" role="tab" aria-selected="${seg === "team"}" data-kseg="team">Mannschaft</button>
      </div>
      ${seg === "ich" ? kontoBlockHtml() : `
      <div class="kt-kacheln">
        <div class="kpi kt-kpi is-rot"><span class="kt-karte" aria-hidden="true"></span><span class="kpi-label">Offen</span><span class="kpi-value">${euro(summe("offen"))}</span><span class="kt-anz">${anzahl("offen") === 1 ? "1 Strafe" : anzahl("offen") + " Strafen"}</span></div>
        <div class="kpi kt-kpi is-gruen"><span class="kt-ball" aria-hidden="true"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><circle cx="12" cy="12" r="9.5"/><path d="M12 8.2l3.6 2.6-1.4 4.2H9.8L8.4 10.8z" fill="currentColor"/><path d="M12 8.2V2.6M15.6 10.8l5.2-1.8M14.2 15l3.2 4.4M9.8 15l-3.2 4.4M8.4 10.8 3.2 9"/></svg></span><span class="kpi-label">In der Kasse</span><span class="kpi-value">${euro(summe("bestätigt"))}</span><span class="kt-anz">${anzahl("bestätigt") === 1 ? "1 Zahlung" : anzahl("bestätigt") + " Zahlungen"}</span></div>
      </div>`}
      <div class="kt-chips">
        ${chips.map(([k, l]) => `<button class="chip kt-chip${strafenFilter === k ? " is-active" : ""}" data-sfilter="${k}" aria-pressed="${strafenFilter === k}">${l} ${anz(stKey[k])}</button>`).join("")}
      </div>
      ${gefiltert.length ? `<div class="card kt-liste">${gefiltert.map(zeile).join("")}</div>`
        : `<div class="empty">${seg === "ich" && !linked ? "Dein Konto ist noch keinem Spieler zugeordnet." : "Keine Strafen in dieser Auswahl."}</div>`}
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
    tab: "pruefen",
    pruefIdx: 0,       // welche Meldung im Kartenstapel gerade vorn liegt
    zahlart: {},       // gewaehlte Zahlart je Strafe, Vorgabe: Angabe des Spielers
    // Welche eigene Seite offen ist: null | "katalog" | "indiv".
    seite: null,
    // Gewaehlter Weg, solange die Spielerauswahl noch laeuft. Erst „Weiter"
    // macht daraus kasse.seite - vorher gibt es nichts, was man verlieren kann.
    wartet: null,
    // Welche Bloecke die Seite zeigt. Der Vollbild-Waehler setzt einen,
    // der Link „Auch ..." holt den zweiten dazu - gemischte Vorgaenge bleiben
    // moeglich, weil beide Bloecke in denselben kasseBuild() laufen.
    bloecke: { katalog: false, indiv: false },
    suche: "",         // Frage im Suchfeld der Spielerauswahl
  };

  /* Zahlart-Symbole. Die Vorlage zeigt sie im Buchen-Blatt, in der Zeile
     „Eingegangen" und vor der Angabe des Spielers. Bewusst drei eigene
     Zeichnungen statt eines Sammelsymbols: der Geldschein, das Bankgebaeude
     und das PayPal-P sind auf 16 px noch auseinanderzuhalten. */
  const ICON_BAR = `<svg ${SVG}><rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.4"/></svg>`;
  const ICON_UEBERWEISUNG = `<svg ${SVG}><path d="M3 9.5 12 4l9 5.5"/><path d="M4.5 9.5v9M9.5 9.5v9M14.5 9.5v9M19.5 9.5v9"/><path d="M2.5 21h19"/></svg>`;
  const ICON_PAYPAL = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8.6 3h6.1c2.9 0 4.6 1.5 4.2 4.1-.4 2.8-2.4 4.3-5.4 4.3h-2.2l-.8 5.1H7.2L8.6 3Zm2.6 2.3-.6 3.8h1.7c1.5 0 2.4-.7 2.6-2 .2-1.2-.4-1.8-1.8-1.8h-1.9Z"/><path d="M6.3 7.6h5.5c2.6 0 4.1 1.4 3.7 3.7-.4 2.5-2.2 3.9-4.9 3.9H8.5L7.8 20H5.1l1.2-8.1.8-4.3Z" opacity=".55"/></svg>`;
  const ZAHLART_ICON = { bar: ICON_BAR, ueberweisung: ICON_UEBERWEISUNG, paypal: ICON_PAYPAL };
  function zartIconHtml(art) {
    const ic = ZAHLART_ICON[art];
    if (!ic) return "";
    // PayPal traegt seine Hausfarbe, wie in der Vorlage. Bar und Ueberweisung
    // nehmen die Farbe der Zeile an - es sind keine Marken.
    return `<span class="ks-zi${art === "paypal" ? " is-pp" : ""}" aria-hidden="true">${ic}</span>`;
  }

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
    const namen = kasse.players.map((id) => playerById[id] && playerById[id].name).filter(Boolean);
    const wer = nSp === 1 ? namen[0] : nSp + " Spieler";
    const n = b.entries;
    return `<div class="kasse-sum ks-sum"><span>${n === 1 ? "1 Strafe" : n + " Strafen"} für ${esc(wer)}</span>
        <b>${euro(b.total)}</b></div>`;
  }

  /* Eine Zeile des Audit-Verlaufs. Der Verlauf selbst steht seit dem neuen
     Kassendesign im Detail-Blatt (ksBlattVerlauf), nicht mehr unter jeder
     Zeile - die Vorlage zeigt die Liste ohne Zusatzzeilen. */

  /* Die Angabe des Spielers (Migration 0040): Zahlart und freier Text. Sie
     ueberlebt eine Ablehnung bewusst - abgelehnt heisst, der Kassenwart
     widerspricht der Behauptung, nicht dass sie nie gemacht wurde. */
  function ksSagtHtml(s) {
    if (!s.sagtNote && !s.sagtZahlart) return "";
    const text = s.sagtNote
      ? `Spieler: „${esc(s.sagtNote)}"`
      : `Spieler: gezahlt per ${esc(ZAHLART_LABEL[s.sagtZahlart] || s.sagtZahlart)}`;
    return `<div class="ks-sag">${zartIconHtml(s.sagtZahlart)}<span>${text}</span></div>`;
  }

  /* „Prüfen & verbuchen" als Kartenstapel (Vorlage 3c): immer genau EINE
     Meldung im Blick, dahinter zwei Geisterkarten als Stapeltiefe. Nach jeder
     Entscheidung wird die Liste kuerzer, der Index bleibt stehen - dadurch
     rueckt die naechste Meldung von selbst nach. */
  function renderKassePruefen(list) {
    if (!list.length) return `<div class="card card-pad ks-leer"><div class="ks-leer-t">Nichts gemeldet</div><div class="rs">Sobald jemand eine Zahlung meldet, liegt sie hier.</div></div>`;
    const sorted = list.slice().sort((a, b) => a.player.name.localeCompare(b.player.name));
    if (kasse.pruefIdx >= sorted.length || kasse.pruefIdx < 0) kasse.pruefIdx = 0;
    const i = kasse.pruefIdx, s = sorted[i];
    const summe = sorted.reduce((a, x) => a + x.betrag, 0);
    // Zahlart und Zeitpunkt der Meldung in einer Zeile. Die Zahlart ist die
    // Angabe des Spielers (0040), der Zeitpunkt kommt aus fine_status_log.
    const art = s.sagtZahlart ? (ZAHLART_LABEL[s.sagtZahlart] || s.sagtZahlart) : "";
    const wann = s.gemeldetAm ? fmtGemeldet(s.gemeldetAm) : "";
    const meta = [art, wann ? "gemeldet " + wann : ""].filter(Boolean).join(" · ");
    return `
      <div class="group-head ks-stapelkopf"><h2>${i + 1} von ${sorted.length} · ${euro(summe)}</h2>
        ${sorted.length > 1 ? `<button class="link-btn" data-kasse-confirm-all>Alle bestätigen</button>` : ""}</div>
      <div class="ks-deck${sorted.length > 1 ? " is-stapel" : ""}">
        ${sorted.length > 2 ? '<div class="ks-geist is-2" aria-hidden="true"></div>' : ""}${sorted.length > 1 ? '<div class="ks-geist is-1" aria-hidden="true"></div>' : ""}
        <div class="card ks-card" data-ks-det="${s.id}" role="button" tabindex="0" aria-label="Meldung von ${esc(s.player.name)} im Detail">
          <span class="avatar ks-av">${initials(s.player.name)}</span>
          <div class="ks-name">${esc(s.player.name)}</div>
          <div class="ks-grund">${esc(vergehenName(s))}</div>
          <div class="ks-amt">${euro(s.betrag)}</div>
          ${meta ? `<div class="ks-meta">${zartIconHtml(s.sagtZahlart)}<span>${esc(meta)}</span></div>` : ""}
          ${s.sagtNote ? `<div class="ks-zitat">„${esc(s.sagtNote)}"</div>` : ""}
          <div class="ks-actions">
            <button class="btn btn-soft btn-danger" data-kasse-reject="${s.id}">Ablehnen</button>
            <button class="btn btn-primary" data-kasse-confirm="${s.id}">Bestätigen</button>
          </div>
        </div>
      </div>`;
  }

  /* Reihenfolge der Auswahl: PayPal, Bar, Überweisung. Überall gleich - im
     Buchen-Blatt, beim Melden und in jeder künftigen Stelle. Die Beschriftung
     ist die kurze: „Überweisung" passt bei 390 px nicht in ein Drittel, ohne
     abzuschneiden. In Listen und im Verlauf steht weiterhin das lange Wort,
     dafür gibt es ZAHLART_LABEL. */
  const KASSE_ZAHLARTEN = [["paypal", "PayPal"], ["bar", "Bar"], ["ueberweisung", "Überweisung"]];

  /* Offen je Spieler (Vorlage Final 14): rein rechnend, ohne DOM (pruefbar).
     Summe ueber strafeBetrag (mit Mahnzuschlag), Anzahl, aelteste Strafe;
     sortiert nach Betrag absteigend, bei Gleichstand nach Name. */
  function ksOffenNachSpieler(liste) {
    const m = new Map();
    liste.forEach((x) => {
      const g = m.get(x.playerId) || { player: x.player, playerId: x.playerId, summe: 0, anzahl: 0, aelteste: x.datum };
      g.summe += x.betrag; g.anzahl += 1; if (x.datum < g.aelteste) g.aelteste = x.datum;
      m.set(x.playerId, g);
    });
    return [...m.values()].sort((a, b) => (b.summe - a.summe) || a.player.name.localeCompare(b.player.name, "de"));
  }
  function renderKasseOffen(list) {
    if (!list.length) return `<div class="card card-pad ks-leer"><div class="ks-leer-t">Keine offenen Posten</div><div class="rs">Alles verbucht.</div></div>`;
    const gruppen = ksOffenNachSpieler(list);
    const summe = list.reduce((a, x) => a + x.betrag, 0);
    return `<div class="ks-summe"><span class="ks-summe-l">${list.length} ${list.length === 1 ? "Strafe" : "Strafen"} · ${gruppen.length} Spieler</span>
        <span class="ks-summe-b is-rot">${euro(summe)}</span></div>
      <div class="card ks-liste">${gruppen.map((g) => `<button type="button" class="row ks-zeile" data-ks-spieler="${g.playerId}" aria-label="${esc(g.player.name)} buchen">
          <span class="row-av"><span>${esc(initials(g.player.name))}</span></span>
          <span class="row-main"><span class="row-t">${esc(g.player.name)}</span>
            <span class="row-s">${g.anzahl === 1 ? "1 Strafe · " + fmtDay(g.aelteste) + ".\u00a0" + fmtMon(g.aelteste) : g.anzahl + " Strafen · älteste " + fmtDay(g.aelteste) + ".\u00a0" + fmtMon(g.aelteste)}</span></span>
          <span class="row-end ks-betrag is-rot">${euro(g.summe)}</span>
          <span class="row-chev" aria-hidden="true">›</span></button>`).join("")}</div>`;
  }

  /* Reiter „Bezahlt": eine Karte mit Zeilen (Stil wie Offen), neueste Buchung
     zuerst. Antippen oeffnet das Blatt mit Verlauf und Rueckgaengig. */
  function renderKasseEing(list) {
    if (!list.length) return `<div class="card card-pad ks-leer"><div class="ks-leer-t">Noch keine Zahlungen</div><div class="rs">Bezahlte Strafen stehen hier.</div></div>`;
    const summe = list.reduce((a, x) => a + x.betrag, 0);
    return `<div class="ks-summe"><span class="ks-summe-l">${list.length} ${list.length === 1 ? "Zahlung" : "Zahlungen"}</span>
        <span class="ks-summe-b is-gruen">${euro(summe)}</span></div>
      <div class="card ks-liste ks-ein">${list.map((x) => {
      const art = x.zahlart ? (ZAHLART_LABEL[x.zahlart] || x.zahlart) : "";
      const wann = x.paidAt ? fmtKurz(String(x.paidAt).slice(0, 10)) : fmtKurz(x.datum);
      return `<button type="button" class="row ks-zeile ks-ein-row" data-ks-det="${x.id}">
        <span class="row-av"><span>${esc(initials(x.player.name))}</span></span>
        <span class="row-main"><span class="row-t">${esc(x.player.name)}</span>
          <span class="row-s">${[esc(art), wann].filter(Boolean).join(" · ")}</span></span>
        <span class="row-end ks-betrag is-gruen">${euro(x.betrag)}</span>
      </button>`;
    }).join("")}</div>`;
  }

  /* ==========================================================================
     Reihenfolge der Listen

     Von den Filtern ist nur die Sortierung geblieben, und die steht fest:
     „Offen" zeigt die ältesten Schulden zuerst - sie drängen am meisten -,
     „Eingegangen" die jüngste Buchung zuerst. Beides rein rechnend und ohne
     DOM, damit es ohne Browser prüfbar bleibt.
     ========================================================================== */
  const KS_REIHENFOLGE = { offen: "alt", bezahlt: "neu" };

  /* Worauf sich die Reihenfolge bezieht: in „Eingegangen" das Buchungsdatum.
     Fehlt es (Altbestand), fällt es auf das Strafendatum zurück, statt die
     Zeile ans Ende zu schieben. */
  function ksBezugsdatum(s, tab) {
    if (tab === "bezahlt") return s.paidAt ? String(s.paidAt).slice(0, 10) : s.datum;
    return s.datum;
  }

  function ksSortieren(liste, sort, tab) {
    const d = (x) => ksBezugsdatum(x, tab);
    const name = (x) => (x.player && x.player.name) || "";
    const kopie = liste.slice();
    const alt = sort === "alt";
    return kopie.sort((a, b) => {
      const v = String(d(a)).localeCompare(String(d(b)));
      if (v !== 0) return alt ? v : -v;
      // Gleicher Tag: der Name entscheidet, damit die Reihenfolge nicht springt.
      return name(a).localeCompare(name(b));
    });
  }

  /* Namenssuche für die Spielerauswahl: Groß- und Kleinschreibung egal,
     Umlaute tolerant in beide Richtungen („muller" findet „Müller", „Müller"
     findet „Muller"), und es zählt jeder Teilstring, nicht nur der
     Wortanfang. */
  function ksNorm(x) {
    return String(x == null ? "" : x).toLowerCase()
      .replace(/ä/g, "a").replace(/ö/g, "o").replace(/ü/g, "u").replace(/ß/g, "ss")
      .normalize("NFD").replace(/[̀-ͯ]/g, "");
  }
  function ksSucheTrifft(name, frage) {
    const q = ksNorm(frage).trim();
    if (!q) return true;
    return ksNorm(name).indexOf(q) !== -1;
  }
  function ksSpielerSuchen(liste, frage) {
    return liste.filter((p) => ksSucheTrifft(p.name, frage));
  }

  const ICON_LUPE = `<svg ${SVG}><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>`;

  /* ==========================================================================
     „Strafe verhängen" als eigene Seite

     Der Vollbild-Wähler führt nicht mehr in den Kassen-Feed zurück, sondern auf
     eine von zwei fokussierten Seiten: ohne Kennzahlen, ohne Reiter, ohne
     untere Navigation. Beide teilen sich Kopf, Fuß und die Blöcke - nur die
     Vorauswahl unterscheidet sie, und der Link unten holt den anderen Block
     dazu. Der Schreibpfad bleibt kasseBuild() plus create_fines_batch.
     ========================================================================== */
  const KS_SEITE_TITEL = { katalog: "Strafe aus Katalog", indiv: "Individuelle Strafe" };

  // Steht schon etwas drin? Entscheidet, ob „Schließen" nachfragt.
  function ksSeiteBeruehrt() {
    return !!(kasse.players.length || Object.keys(kasse.items).length || kasse.indiv.length
      || String(kasse.indivBetrag).trim() || String(kasse.indivGrund).trim() || kasse.comment.trim());
  }

  /* Eine Katalogzeile. Eigene Funktion, damit ein Tipp genau diese Zeile
     austauschen kann statt der ganzen Liste - sonst springt die Seite an den
     Anfang. */
  function ksKatalogZeileHtml(k) {
    const on = !!kasse.items[k.id];
    const menge = (kasse.items[k.id] && kasse.items[k.id].menge) || 1;
    const preis = euro(k.typ === "staffel" ? (k.proEinheit || 0) : k.betrag);
    const neben = k.typ === "staffel"
      ? ["je " + (k.schritt || 1) + " " + esc(k.einheit || ""), k.maxBetrag != null ? "max " + euro(k.maxBetrag) : ""].filter(Boolean).join(" · ")
      : "";
    return `<div class="kasse-catrow ks-katzeile${on ? " is-sel" : ""}" data-kat-zeile="${k.id}">
      <button type="button" class="kasse-catpick" data-kasse-catrow="${k.id}" role="checkbox" aria-checked="${on}">
        <span class="ks-box${on ? " is-an" : ""}" aria-hidden="true">${on ? ICON_CHECK : ""}</span>
        <span class="row-main"><span class="ks-kat-n">${esc(k.vergehen)}</span>${neben ? `<span class="row-s">${neben}</span>` : ""}</span>
        <span class="ks-kat-b">${preis}</span>
      </button>
      ${on && k.typ === "staffel" ? `<div class="kasse-bezugwrap">
        <input class="kasse-in kasse-bezug" data-kasse-bezug="${k.id}" inputmode="decimal" placeholder="${esc(k.einheit || "Menge")}" value="${esc(kasse.bezug[k.id] || "")}">
        ${k.maxBetrag != null ? `<span class="kasse-staffel-hint">max ${euro(k.maxBetrag)}</span>` : ""}
      </div>` : ""}
      ${on && k.typ !== "staffel" ? `<div class="kasse-qty">
        <button type="button" class="qty-btn" data-kasse-qty="${k.id}" data-d="-1" aria-label="weniger">−</button>
        <span class="qty-n">${menge}×</span>
        <button type="button" class="qty-btn" data-kasse-qty="${k.id}" data-d="1" aria-label="mehr">+</button>
      </div>` : ""}
    </div>`;
  }

  function ksKatalogBlockHtml() {
    return `
      <div class="group-head"><h2>Aus dem Katalog</h2><button type="button" class="link-btn" data-ks-auch="indiv">${kasse.bloecke.indiv ? "Individuell ausblenden" : "Individuell ›"}</button></div>
      <div class="card ks-katliste">
        ${DEMO.katalog.map(ksKatalogZeileHtml).join("")}
      </div>`;
  }

  /* Nur diese eine Zeile neu setzen, dann Summe und Knopf nachziehen. Findet
     sich die Zeile nicht, wird doch komplett gezeichnet - aber mit gesicherter
     Scrollposition. */
  function ksKatalogZeileAktualisieren(id) {
    const k = (DEMO.katalog || []).find((x) => x.id === id);
    const alt = document.querySelector('#ksSeite [data-kat-zeile="' + id + '"]');
    if (!k || !alt) { ksSeiteZeichnen(); return; }
    alt.outerHTML = ksKatalogZeileHtml(k);
    ksSeiteSummeAktualisieren();
  }

  function ksSeiteSummeAktualisieren() {
    const sum = document.getElementById("kasseSummary");
    if (sum) sum.innerHTML = kasseSummaryHtml();
    ksSeiteKnopf();
  }

  /* Die freien Strafen: nur die Chipleiste und die beiden Felder anfassen. */
  function ksIndivChipsHtml() {
    if (!kasse.indiv.length) return "";
    return `<div class="ks-ichips">${kasse.indiv.map((e, i) => `
      <span class="ks-ichip">${esc(e.grund)} · ${euro(parseFloat(String(e.betrag).replace(",", ".")) || 0).replace(/\s/g, " ")}
        <button type="button" class="chip-x" data-kasse-indiv-del="${i}" aria-label="entfernen">×</button></span>`).join("")}</div>`;
  }

  function ksIndivAktualisieren() {
    const host = document.getElementById("ksSeite");
    if (!host) return;
    const neu = ksIndivChipsHtml();
    const alt = host.querySelector(".ks-ichips");
    if (alt && neu) alt.outerHTML = neu;
    else if (alt) alt.remove();
    else if (neu) {
      const knopf = host.querySelector("[data-kasse-indiv-add]");
      if (knopf) knopf.insertAdjacentHTML("afterend", neu);
    }
    const b = host.querySelector('[data-kasse-input="betrag"]');
    const g = host.querySelector('[data-kasse-input="grund"]');
    if (b) b.value = kasse.indivBetrag;
    if (g) g.value = kasse.indivGrund;
    ksSeiteSummeAktualisieren();
  }

  /* Die Spielerauswahl hat sich geaendert: Kopfzeile, Chips, Summe, Knopf.
     Die Bloecke darunter bleiben stehen - samt Scrollposition und Eingaben. */
  function ksSeiteSpielerAktualisieren() {
    const host = document.getElementById("ksSeite");
    if (!host || !host.firstChild) return;
    const namen = kasse.players.map((id) => playerById[id] && playerById[id].name).filter(Boolean);
    const txt = host.querySelector(".kasse-picker-txt");
    if (txt) txt.textContent = namen.length ? namen.length + " Spieler gewählt" : "Spieler auswählen";
    const sh = host.querySelector(".ks-spieler-host");
    if (sh) sh.innerHTML = ksGewaehltChipsHtml(kasse.players, "data-ks-seite-sp-weg") || '<div class="ks-keiner">Noch niemand ausgewählt.</div>';
    else ksChipsAktualisieren(host, kasse.players, "data-ks-seite-sp-weg");
    ksSeiteSummeAktualisieren();
  }

  function ksIndivBlockHtml() {
    return `
      <div class="group-head"><h2>Individuell</h2></div>
      <div class="card tf-liste ks-indiv">
        <label class="tf-z"><span class="tf-l">Betrag</span><input class="tf-in" data-kasse-input="betrag" inputmode="decimal" placeholder="0,00 €" value="${esc(kasse.indivBetrag)}"></label>
        <label class="tf-z"><span class="tf-l">Grund</span><input class="tf-in" data-kasse-input="grund" type="text" placeholder="Wofür?" value="${esc(kasse.indivGrund)}"></label>
      </div>
      <button type="button" class="btn btn-soft kasse-addbtn" data-kasse-indiv-add>Hinzufügen</button>
      ${ksIndivChipsHtml()}`;
  }

  function ksSeiteHtml() {
    const build = kasseBuild();
    // Katalog steht immer da; "Individuell ›" holt den Freitext-Block dazu.
    const bloecke = [ksKatalogBlockHtml(), kasse.bloecke.indiv ? ksIndivBlockHtml() : ""];
    return `
      <button type="button" class="ks-seite-ov" data-ks-seite-zu aria-label="Schließen"></button>
      <div class="ks-seite" role="dialog" aria-modal="true" aria-label="Strafe verhängen">
        <div class="ks-seite-kopf">
          <span class="tf-griff" aria-hidden="true"></span>
          <div class="tf-kopfzeile">
            <strong class="tf-titel ks-seite-t">Strafe verhängen</strong>
            <button type="button" class="tf-x ks-seite-x" data-ks-seite-zu aria-label="Schließen">${ICON_X}</button>
          </div>
        </div>

        <div class="ks-seite-body" data-scroll="ksSeiteBody">
          <div class="group-head"><h2>Spieler</h2><button type="button" class="link-btn" data-ks-open-players>Auswählen ›</button></div>
          <div class="ks-spieler-host">${ksGewaehltChipsHtml(kasse.players, "data-ks-seite-sp-weg") || '<div class="ks-keiner">Noch niemand ausgewählt.</div>'}</div>

          ${bloecke.join("")}

          <div class="group-head"><h2>Datum und Kommentar</h2></div>
          <div class="card tf-liste ks-dk">
            <label class="tf-z"><span class="tf-l">Datum</span><span class="tf-nat"><span class="tf-anz" data-ks-datum-anz>${tfDatumText(kasse.date)}</span><input type="date" data-kasse-date value="${kasse.date}" aria-label="Datum"></span></label>
            <label class="tf-z"><span class="tf-l">Kommentar</span><input class="tf-in" data-kasse-input="comment" type="text" placeholder="Optional" value="${esc(kasse.comment)}" aria-label="Kommentar"></label>
          </div>

          <div id="kasseSummary">${kasseSummaryHtml()}</div>
        </div>
        <!-- Nachschliff A5: Fuß fest am Blattende, nicht mehr sticky im Scrollbereich -->
        <div class="ks-fuss">
          <button class="btn btn-primary ks-fuss-btn" data-kasse-add${build.valid ? "" : " disabled"}>Strafe speichern</button>
        </div>
      </div>`;
  }

  function kasseHtml(alle) {
    const offen    = alle.filter((s) => s.st === "offen");
    const gemeldet = alle.filter((s) => s.st === "gemeldet");
    const bezahlt  = alle.filter((s) => s.st === "bestätigt");
    /* Gefiltert wird nur die Liste. Die Reiterzahlen und die Kennzahlen oben
       bleiben die Gesamtzahlen - sonst wüsste man nicht mehr, wovon man einen
       Ausschnitt sieht. */
    const offenSort   = ksSortieren(offen,   KS_REIHENFOLGE.offen,   "offen");
    const bezahltSort = ksSortieren(bezahlt, KS_REIHENFOLGE.bezahlt, "bezahlt");
    const REITER = [["pruefen", "Gemeldet"], ["offen", "Offen"], ["bezahlt", "Bezahlt"]];

    return `
      <div class="page-head">${navBackChevronHtml()}<h1>Kasse</h1></div>
      <button type="button" class="btn btn-primary ks-neu" data-ks-wahl>+ Strafe verhängen</button>
      <div class="ks-pane">
        <div class="seg ks-seg" role="tablist">
          ${REITER.map(([k, label]) => `<button class="seg-b ks-seg-b${kasse.tab === k ? " is-on" : ""}" role="tab"
            aria-selected="${kasse.tab === k}" data-kstab="${k}">${label}${k === "pruefen" && gemeldet.length ? ` <b class="ks-seg-n">${gemeldet.length}</b>` : ""}</button>`).join("")}
        </div>
        ${kasse.tab === "pruefen" ? renderKassePruefen(gemeldet) : ""}
        ${kasse.tab === "offen" ? renderKasseOffen(offenSort) : ""}
        ${kasse.tab === "bezahlt" ? renderKasseEing(bezahltSort) : ""}
      </div>
    `;
  }

  /* ==========================================================================
     Die Eingabeseite hängt an <body>, nicht in der Ansicht

     Vorher lag sie in #view, also im Container, den Pull-to-Refresh beim Ziehen
     per `transform: translateY(...)` verschiebt. Ein transformierter Vorfahre
     macht aus `position: fixed` eine Positionierung relativ zu ihm: die Seite
     rutschte unter die Kopfzeile und fiel auf die Höhe ihres Containers
     zusammen - der sichtbare Scherbenhaufen aus scrollbug.webp.

     An <body> gehängt kann kein Vorfahre sie mehr verbiegen. Zweiter Gewinn:
     ein Hintergrund-Neuladen zeichnet nur den Feed dahinter neu, das offene
     Formular bleibt stehen und behält seine Eingaben.
     ========================================================================== */
  let ksSeiteGesperrt = false;

  function ksSeiteEnsure() {
    let host = document.getElementById("ksSeite");
    if (host) return host;
    host = document.createElement("div");
    host.id = "ksSeite";
    host.hidden = true;
    document.body.appendChild(host);
    host.addEventListener("click", ksSeiteKlick);
    host.addEventListener("input", ksSeiteEingabe);
    host.addEventListener("change", (ev) => {
      if (!ev.target.matches("[data-kasse-date]")) return;
      kasse.date = ev.target.value || new Date().toISOString().slice(0, 10);
      const anz = document.querySelector("#ksSeite [data-ks-datum-anz]");
      if (anz) anz.textContent = tfDatumText(kasse.date);
      const sum = document.getElementById("kasseSummary");
      if (sum) sum.innerHTML = kasseSummaryHtml();
      ksSeiteKnopf();
    });
    return host;
  }

  // Zeichnet die Seite neu. Nur aufrufen, wenn sich ihr Inhalt geändert hat -
  // nicht bei jedem renderKasse(), sonst gehen Eingaben verloren.
  function ksSeiteZeichnen() {
    const host = ksSeiteEnsure();
    host.innerHTML = ksSeiteHtml();
    ksSeiteKnopf();
  }

  /* Ein- und Ausblenden, ohne den Inhalt anzufassen. renderKasse() ruft das
     bei jedem Durchlauf; neu gezeichnet wird nur, wenn noch nichts da ist. */
  function ksSeiteSync() {
    const host = document.getElementById("ksSeite");
    if (!kasse.seite) {
      if (host) { host.hidden = true; host.innerHTML = ""; }
      document.body.classList.remove("ks-seite-offen");
      if (ksSeiteGesperrt) { ksSeiteGesperrt = false; unlockBodyScroll(); }
      ksSeiteHash(null);
      return;
    }
    const h = ksSeiteEnsure();
    if (h.hidden || !h.firstChild) { h.hidden = false; ksSeiteZeichnen(); }
    document.body.classList.add("ks-seite-offen");
    if (!ksSeiteGesperrt) { ksSeiteGesperrt = true; lockBodyScroll(); }
    ksSeiteHash(kasse.seite);
  }

  /* Der Zustand steht im Hash. Ein Neuladen - ob vom Nutzer, vom Browser oder
     nach einem Update der App - landet dann auf einer leeren, funktionsfähigen
     Seite statt auf einem halben Formular. replaceState, damit die
     Zurück-Taste nicht durch die Zwischenstände läuft. */
  function ksSeiteHash(modus) {
    const soll = modus ? "#strafe=" + (modus === "indiv" ? "individuell" : "katalog") : "";
    const ist = location.hash || "";
    if (ist === soll) return;
    // Fremde Hashes nicht anfassen - die gehören einem Deep Link.
    if (!soll && !/^#strafe=/.test(ist)) return;
    try { history.replaceState(null, "", location.pathname + location.search + soll); } catch (e) {}
  }

  /* Der Knopf unten trägt das Ergebnis. Er wird einzeln nachgezogen, damit ein
     Antippen im Katalog nicht die ganze Seite neu baut (und die Tastatur
     zuklappt). */
  function ksSeiteKnopf() {
    const btn = document.querySelector("#ksSeite [data-kasse-add]");
    if (!btn) return;
    const b = kasseBuild();
    btn.disabled = !b.valid;
    btn.textContent = "Strafe speichern";
  }

  function ksSeiteEingabe(ev) {
    const el = ev.target;
    if (!el || !el.dataset) return;
    if (el.matches("[data-kasse-bezug]")) { kasse.bezug[el.dataset.kasseBezug] = el.value; ksSeiteKnopf(); return; }
    const f = el.dataset.kasseInput;
    if (!f) return;
    if (f === "betrag") kasse.indivBetrag = el.value;
    else if (f === "grund") kasse.indivGrund = el.value;
    else if (f === "comment") kasse.comment = el.value;
    const sum = document.getElementById("kasseSummary");
    if (sum) sum.innerHTML = kasseSummaryHtml();
    ksSeiteKnopf();
  }

  async function ksSeiteKlick(ev) {
    // Kopf
    if (ev.target.closest("[data-ks-seite-zurueck]")) {
      if (ksSeiteBeruehrt() && !window.confirm("Zurück zur Auswahl? Die Eingaben gehen verloren.")) return;
      ksSeiteLeeren(); renderKasse(); ksWahlOpen(); return;
    }
    if (ev.target.closest("[data-ks-seite-zu]")) {
      if (ksSeiteBeruehrt() && !window.confirm("Schließen? Die Eingaben gehen verloren.")) return;
      ksSeiteLeeren(); renderKasse(); return;
    }
    // Spieler ändern
    if (ev.target.closest("[data-ks-open-players]")) { ksOpenPlayers(); return; }
    // Blöcke
    const auch = ev.target.closest("[data-ks-auch]");
    if (auch) {
      kasse.bloecke[auch.dataset.ksAuch] = !kasse.bloecke[auch.dataset.ksAuch];
      // Ein ganzer Block kommt dazu - hier muss die Seite neu, aber die
      // Scrollposition bleibt.
      mitScroll(document.getElementById("ksSeite"), ksSeiteZeichnen);
      return;
    }
    /* Ab hier wird nur ausgetauscht, was sich aendert. Ein ksSeiteZeichnen()
       wuerde den Scrollbereich neu erzeugen - und der startet bei 0. */
    const crow = ev.target.closest("[data-kasse-catrow]");
    if (crow) {
      const id = crow.dataset.kasseCatrow;
      if (kasse.items[id]) { delete kasse.items[id]; delete kasse.bezug[id]; }
      else kasse.items[id] = { menge: 1 };
      ksKatalogZeileAktualisieren(id); return;
    }
    const qty = ev.target.closest("[data-kasse-qty]");
    if (qty) {
      const id = qty.dataset.kasseQty, d = parseInt(qty.dataset.d, 10) || 0;
      if (kasse.items[id]) {
        kasse.items[id].menge = Math.max(1, (parseInt(kasse.items[id].menge, 10) || 1) + d);
        // Nur die Zahl zwischen den Knoepfen, damit der Finger auf dem Plus
        // bleiben kann und nichts darunter wegrutscht.
        const n = document.querySelector('#ksSeite [data-kat-zeile="' + id + '"] .qty-n');
        if (n) { n.textContent = kasse.items[id].menge + "×"; ksSeiteSummeAktualisieren(); }
        else ksKatalogZeileAktualisieren(id);
      }
      return;
    }
    if (ev.target.closest("[data-kasse-indiv-add]")) {
      const b = parseFloat(String(kasse.indivBetrag).replace(",", "."));
      if (!isFinite(b) || b < 0 || !kasse.indivGrund.trim()) { window.alert("Bitte Betrag und Grund eingeben."); return; }
      kasse.indiv.push({ betrag: kasse.indivBetrag, grund: kasse.indivGrund.trim() });
      kasse.indivBetrag = ""; kasse.indivGrund = ""; ksIndivAktualisieren(); return;
    }
    const idel = ev.target.closest("[data-kasse-indiv-del]");
    if (idel) { kasse.indiv.splice(parseInt(idel.dataset.kasseIndivDel, 10), 1); ksIndivAktualisieren(); return; }
    const spWeg = ev.target.closest("[data-ks-seite-sp-weg]");
    if (spWeg) {
      const i = kasse.players.indexOf(spWeg.dataset.ksSeiteSpWeg);
      if (i >= 0) kasse.players.splice(i, 1);
      ksSeiteSpielerAktualisieren(); return;
    }
    if (ev.target.closest("[data-kasse-add]")) { await kasseSave(); return; }
  }

  /* Die Seite verlassen: Eingaben und Blockwahl fallen zurueck, damit der
     naechste Vorgang wieder sauber ueber den Waehler geht. */
  // "+ Strafe verhaengen": direkt in das Blatt (der Waehler zweier Wege entfaellt).
  function ksSeiteNeu(modus) {
    ksSeiteLeeren();
    kasse.bloecke = { katalog: true, indiv: modus === "indiv" };
    kasse.seite = modus === "indiv" ? "indiv" : "katalog";
    ksSeiteSync();
  }
  function ksSeiteLeeren() {
    kasse.seite = null; kasse.wartet = null;
    kasse.bloecke = { katalog: false, indiv: false };
    kasse.players = []; kasse.items = {}; kasse.bezug = {}; kasse.indiv = [];
    kasse.indivBetrag = ""; kasse.indivGrund = ""; kasse.comment = "";
  }

  function renderKasse() {
    const alle = aktiveStrafen()
      .map((s) => ({ ...s, betrag: strafeBetrag(s), st: fineStatus(s), player: playerById[s.playerId] }))
      .filter((s) => s.player);
    viewEl.innerHTML = kasseHtml(alle);
    ksSeiteSync();
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
    const btn = document.querySelector("#ksSeite [data-kasse-add]"); if (btn) btn.disabled = true;
    try {
      await DB.createFinesBatch(rows, kasse.comment.trim() || null);
      const n = rows.length;
      ksSeiteLeeren();
      // Zurueck zur Kassen-Startseite und gleich dorthin, wo die neuen
      // Strafen liegen.
      kasse.tab = "offen";
      await reloadData();                          // rendert Kasse neu (aktualisierte Listen)
      tvToast(n + (n === 1 ? " Strafe verhängt" : " Strafen verhängt"));
    } catch (e) {
      if (btn) btn.disabled = false;
      try { console.error("Strafen anlegen fehlgeschlagen:", { code: e && e.code, message: e && e.message, details: e && e.details, hint: e && e.hint }); } catch (x) {}
      window.alert("Speichern fehlgeschlagen: " + ((e && e.message) || e) + ((e && e.hint) ? "\n(Hinweis: " + e.hint + ")" : ""));
    }
  }

  /* ---- Vollbild-Spielerauswahl der Kasse (Stil wie die Trainer-Kaderauswahl) ---- */
  /* Setzt den Fokus in ein Suchfeld, sobald das Blatt steht. Zwei Anläufe:
     iOS gibt die Tastatur nur frei, wenn der Fokus aus einer Nutzergeste
     kommt - der zweite Anlauf nach dem Aufbau fängt die Fälle ab, in denen
     das Feld im ersten Moment noch nicht im Dokument hing. */
  function ksFokusSuche(id) {
    const setz = () => {
      const el = document.getElementById(id);
      if (!el) return;
      try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
      try { el.setSelectionRange(el.value.length, el.value.length); } catch (e) {}
    };
    setz();
    requestAnimationFrame(setz);
  }

  /* Suchfeld im Kopf eines Vollbild-Blattes.

     Die vielen Attribute sind kein Zierrat: iOS blendet über der Tastatur
     „Kontakt autom. ausfüllen" samt echtem Namen ein, sobald es ein Feld für
     ein Namensfeld hält (abstandundkontakt.webp). Es schließt das aus
     Feldtyp, name, id, Platzhalter und Beschriftung. Deshalb heißen Feld und
     Name neutral (ks-q, nicht „name" oder „spieler"), und der Platzhalter
     sagt „Suchen" statt „Name eingeben". */
  function ksSuchfeldHtml(id, wert, platz) {
    return `<div class="ks-suchfeld">
      <span class="ks-zi" aria-hidden="true">${ICON_LUPE}</span>
      <input class="ks-such-in" id="${id}" name="ks-q" type="search"
        inputmode="search" enterkeyhint="search"
        autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
        data-1p-ignore data-lpignore="true"
        value="${esc(wert || "")}" placeholder="${esc(platz)}" aria-label="Suchen">
      ${wert ? `<button type="button" class="ks-such-x" data-ks-such-leer aria-label="Suche leeren">&times;</button>` : ""}
    </div>`;
  }

  /* ==========================================================================
     Antippen darf die Liste nicht neu bauen

     Vorher hat jeder Tipp auf eine Zeile das ganze Blatt bzw. die ganze Seite
     per innerHTML neu gesetzt. Ein frisch erzeugter Scroll-Container startet
     bei scrollTop 0 - deshalb sprang die Ansicht an den Anfang, und ein
     fokussiertes Feld verlor nebenbei den Fokus.

     Ab hier wird nur ausgetauscht, was sich wirklich geaendert hat: die eine
     Zeile, die Chipleiste, die Zusammenfassung, der Knopf. Wo ein voller
     Neuaufbau unvermeidbar bleibt, sichert mitScroll() die Position.
     ========================================================================== */

  // Merkt die Scrollposition aller Scrollbereiche eines Elements und stellt
  // sie nach dem Neuaufbau wieder her - ohne sichtbaren Sprung.
  function mitScroll(wurzel, fn) {
    if (!wurzel) { fn(); return; }
    const vorher = [...wurzel.querySelectorAll("[data-scroll]")].map((e) => [e.dataset.scroll, e.scrollTop]);
    const eigen = wurzel.scrollTop;
    fn();
    for (const [schluessel, oben] of vorher) {
      const e = wurzel.querySelector('[data-scroll="' + schluessel + '"]');
      if (e) e.scrollTop = oben;
    }
    if (eigen) wurzel.scrollTop = eigen;
  }

  function ksSpielerZeileHtml(p, on, attr) {
    return `<button type="button" class="kat-item ks-prow${on ? " is-sel" : ""}" ${attr}="${p.id}">
      <span class="avatar">${initials(p.name)}</span>
      <span class="kat-name">${esc(p.name)}</span>
      <span class="ks-check" aria-hidden="true">${on ? ICON_CHECK : ""}</span>
    </button>`;
  }

  function ksSpielerZeilenHtml(gewaehlt, frage, attr) {
    const alle = [...DEMO.players].sort((a, b) => nachname(a.name).localeCompare(nachname(b.name), "de"));
    const treffer = ksSpielerSuchen(alle, frage);
    if (!treffer.length) {
      return `<div class="card card-pad ks-leer"><div class="ks-leer-t">Kein Treffer</div>
        <div class="rs">Kein Spieler heißt so.</div></div>`;
    }
    return `<div class="kat-list ks-plist">${treffer.map((p) =>
      ksSpielerZeileHtml(p, gewaehlt.indexOf(p.id) !== -1, attr)).join("")}</div>`;
  }

  /* Eine Zeile umschalten, ohne die Liste anzufassen. Haken und Markierung
     sitzen in der Zeile - mehr aendert sich dort nicht. */
  function ksZeileUmschalten(wurzel, attr, id, an) {
    const zeile = wurzel && wurzel.querySelector("[" + attr + '="' + id + '"]');
    if (!zeile) return;
    zeile.classList.toggle("is-sel", an);
    const haken = zeile.querySelector(".ks-check");
    if (haken) haken.innerHTML = an ? ICON_CHECK : "";
  }

  // Die Chipleiste steht ueber dem Scrollbereich; sie darf voll neu.
  function ksChipsAktualisieren(wurzel, ids, attr) {
    if (!wurzel) return;
    const neu = ksGewaehltChipsHtml(ids, attr);
    const alt = wurzel.querySelector(".ks-gewaehlt");
    if (alt && neu) { alt.outerHTML = neu; return; }
    if (alt && !neu) { alt.remove(); return; }
    if (!alt && neu) {
      // Die Chips stehen unter dem Suchfeld der Vollbild-Blaetter.
      const davor = wurzel.querySelector(".ks-suchfeld");
      if (davor) davor.insertAdjacentHTML("afterend", neu);
    }
  }

  function ksGewaehltChipsHtml(ids, attr) {
    if (!ids.length) return "";
    return `<div class="ks-gewaehlt">${ids.map((id) => {
      const p = playerById[id];
      if (!p) return "";
      return `<span class="ks-gchip">${esc(p.name)}<button type="button" ${attr}="${id}"
        aria-label="${esc(p.name)} entfernen">&times;</button></span>`;
    }).join("")}</div>`;
  }

  /* Der Knopf unten in Daumenreichweite - nicht „Fertig" oben rechts, wo der
     Daumen bei sieben Zoll nicht mehr hinkommt. Er trägt die Zahl, damit vor
     dem Tippen klar ist, was weitergeht. */
  function ksWeiterText(n) {
    return n ? "Weiter mit " + n + (n === 1 ? " Spieler" : " Spielern") : "Weiter";
  }
  function ksWeiterKnopfHtml(n) {
    return `<div class="ks-fuss">
      <button type="button" class="btn btn-primary ks-fuss-btn" data-ks-weiter${n ? "" : " disabled"}>${ksWeiterText(n)}</button>
    </div>`;
  }
  function ksWeiterAktualisieren(wurzel, n) {
    const btn = wurzel && wurzel.querySelector("[data-ks-weiter]");
    if (!btn) return;
    btn.disabled = !n;
    btn.textContent = ksWeiterText(n);
  }
  function ksEnsureSheet() {
    if (document.getElementById("ksSheet")) return;
    const scrim = document.createElement("div"); scrim.className = "tv-scrim"; scrim.id = "ksScrim"; scrim.setAttribute("data-ks-close", "");
    const sheet = document.createElement("div"); sheet.className = "tv-sheet tv-kfull ks-such"; sheet.id = "ksSheet";
    document.body.appendChild(scrim); document.body.appendChild(sheet);
    scrim.addEventListener("click", ksClosePlayers);
    sheet.addEventListener("click", (ev) => {
      if (ev.target.closest("[data-ks-weiter]")) { ksWeiter(); return; }
      if (ev.target.closest("[data-ks-abbruch]")) { ksAbbruch(); return; }
      if (ev.target.closest("[data-ks-such-leer]")) {
        // Leeren heisst weitersuchen: hier ist der Fokus erwuenscht.
        kasse.suche = "";
        const b = document.getElementById("ksBody");
        if (b) b.innerHTML = ksSpielerZeilenHtml(kasse.players, "", "data-ks-player");
        const feld = sheet.querySelector(".ks-such-in");
        if (feld) feld.value = "";
        ksSuchKreuz(sheet);
        ksFokusSuche("ksSuche");
        return;
      }
      const weg = ev.target.closest("[data-ks-player-weg]");
      if (weg) { ksSpielerUmschalten(sheet, weg.dataset.ksPlayerWeg); return; }
      const row = ev.target.closest("[data-ks-player]");
      if (row) { ksSpielerUmschalten(sheet, row.dataset.ksPlayer); }
    });
    /* Tippen filtert die Liste, ohne das Feld neu zu zeichnen - sonst
       verliert es den Fokus und die Tastatur klappt zu. */
    sheet.addEventListener("input", (ev) => {
      if (!ev.target.matches("#ksSuche")) return;
      kasse.suche = ev.target.value;
      const b = document.getElementById("ksBody");
      if (b) b.innerHTML = ksSpielerZeilenHtml(kasse.players, kasse.suche, "data-ks-player");
      ksSuchKreuz(sheet);
    });
    sheet.addEventListener("keydown", ksSuchEnter);
  }

  /* Einen Spieler an- oder abwaehlen. Angefasst werden genau drei Dinge: die
     Zeile, die Chipleiste und der Knopf. Die Liste selbst bleibt stehen - und
     damit auch die Scrollposition. */
  function ksSpielerUmschalten(sheet, id) {
    const i = kasse.players.indexOf(id);
    if (i === -1) kasse.players.push(id); else kasse.players.splice(i, 1);
    ksZeileUmschalten(sheet, "data-ks-player", id, i === -1);
    ksChipsAktualisieren(sheet, kasse.players, "data-ks-player-weg");
    ksWeiterAktualisieren(sheet, kasse.players.length);
  }

  // Das Kreuz zum Leeren erscheint und verschwindet mit dem Inhalt.
  function ksSuchKreuz(sheet) {
    const x = sheet.querySelector(".ks-such-x");
    const in_ = sheet.querySelector(".ks-such-in");
    const leer = !in_ || !in_.value;
    if (!leer && !x) {
      const f = sheet.querySelector(".ks-suchfeld");
      if (f) f.insertAdjacentHTML("beforeend",
        '<button type="button" class="ks-such-x" data-ks-such-leer aria-label="Suche leeren">&times;</button>');
    } else if (leer && x) { x.remove(); }
  }

  /* Enter schliesst nur die Tastatur. Es gibt nichts abzuschicken - die Liste
     filtert schon beim Tippen. */
  function ksSuchEnter(ev) {
    if (ev.key !== "Enter" || !ev.target.matches(".ks-such-in")) return;
    ev.preventDefault();
    ev.target.blur();
  }

  function ksRenderPlayers() {
    const sheet = document.getElementById("ksSheet"); if (!sheet) return;
    sheet.innerHTML =
      '<div class="tv-sh"><strong>Spieler auswählen</strong>' +
      '<button class="tv-shx" data-ks-abbruch aria-label="Schließen">&times;</button></div>' +
      ksSuchfeldHtml("ksSuche", kasse.suche, "Suchen") +
      ksGewaehltChipsHtml(kasse.players, "data-ks-player-weg") +
      '<div class="tv-shbody" id="ksBody" data-scroll="ksBody">' +
      ksSpielerZeilenHtml(kasse.players, kasse.suche, "data-ks-player") + '</div>' +
      ksWeiterKnopfHtml(kasse.players.length);
  }

  /* Bewusst OHNE Fokus: ein automatisch fokussiertes Feld holt die Tastatur
     und mit ihr die iOS-Formularleiste (Pfeile und Haken) hoch, noch bevor die
     Ansicht steht - das war das Flackern aus flackernbalken.webp. Wer suchen
     will, tippt das Feld an. */
  function ksOpenPlayers() { ksEnsureSheet(); kasse.suche = ""; ksRenderPlayers(); blattAuf("ksScrim", "ksSheet"); }

  /* „Weiter": aus dem Wähler heraus geht es auf die Seite, von der Seite aus
     ist es schlicht ein Bestätigen. */
  function ksWeiter() {
    if (!kasse.players.length) return;
    const ziel = kasse.wartet;
    kasse.wartet = null;
    if (ziel) {
      /* Erst die Seite aufbauen und sperren, dann das Blatt schliessen -
         der Stapel faellt dabei nie auf null. ksSeiteSync() zeichnet die
         Seite genau einmal; ein zweites ksSeiteZeichnen() waere ein
         sichtbarer zweiter Aufbau. */
      kasse.seite = ziel;
      ksSeiteSync();
      blattZu("ksScrim", "ksSheet");
      return;
    }
    // Von der Seite aus geoeffnet: nur die geaenderte Auswahl nachziehen.
    blattZu("ksScrim", "ksSheet");
    ksSeiteSpielerAktualisieren();
  }

  /* Abbruch mit dem Kreuz. Kam man aus dem Wähler, gibt es noch keine Seite -
     dann zurück zur Kasse. Kam man von der Seite, bleibt sie stehen. */
  function ksAbbruch() {
    if (kasse.wartet) { kasse.wartet = null; kasse.players = []; kasse.bloecke = { katalog: false, indiv: false }; }
    ksClosePlayers();
  }

  function ksClosePlayers() {
    blattZu("ksScrim", "ksSheet");
    if (kasse.seite) { ksSeiteSpielerAktualisieren(); return; }
    if (currentView === "kasse") renderKasse();
  }

  /* ---- Vollbild-Waehler „Strafe verhaengen" --------------------------------
     Genau zwei Wege, gleich gross, beide fuehren in dasselbe Formular - nur
     mit unterschiedlich vorbelegten Bloecken. Der jeweils andere Block laesst
     sich dort per Link dazuholen, damit gemischte Vorgaenge moeglich bleiben. */
  function ksWahlEnsure() {
    if (document.getElementById("ksWahl")) return;
    const scrim = document.createElement("div");
    scrim.className = "tv-scrim"; scrim.id = "ksWahlScrim";
    const sheet = document.createElement("div");
    sheet.className = "tv-sheet tv-kfull ks-wahl"; sheet.id = "ksWahl";
    sheet.setAttribute("role", "dialog"); sheet.setAttribute("aria-modal", "true");
    sheet.setAttribute("aria-label", "Strafe verhängen");
    sheet.innerHTML =
      '<div class="tv-sh"><strong>Strafe verhängen</strong>' +
      '<button class="tv-shx" data-ks-wahl-close aria-label="Schließen">&times;</button></div>' +
      '<div class="tv-shbody">' +
        '<button type="button" class="ks-wahl-b" data-ks-modus="katalog">' +
          '<span class="ks-wahl-t">Strafe aus Katalog hinzufügen</span>' +
          '<span class="ks-wahl-s">Aus dem Strafenkatalog wählen, mit Menge oder Bezugsgröße.</span></button>' +
        '<button type="button" class="ks-wahl-b" data-ks-modus="indiv">' +
          '<span class="ks-wahl-t">Individuelle Strafe</span>' +
          '<span class="ks-wahl-s">Freier Grund und freier Betrag.</span></button>' +
      '</div>' +
      '<div class="ks-wahl-f"><button type="button" class="btn" data-ks-wahl-close>Schließen</button></div>';
    document.body.appendChild(scrim); document.body.appendChild(sheet);
    scrim.addEventListener("click", ksWahlClose);
    sheet.addEventListener("click", (ev) => {
      if (ev.target.closest("[data-ks-wahl-close]")) { ksWahlClose(); return; }
      const m = ev.target.closest("[data-ks-modus]");
      if (!m) return;
      const modus = m.dataset.ksModus;
      kasse.bloecke = { katalog: modus === "katalog", indiv: modus === "indiv" };
      // Nicht direkt auf die Seite: zuerst die Spielerauswahl. Ohne Spieler
      // kann man dort ohnehin nichts speichern, und der Umweg ueber einen
      // zusaetzlichen Tipp auf „Spieler auswählen" entfaellt.
      kasse.wartet = modus;
      kasse.players = [];
      /* Erst das neue Blatt auf, dann das alte zu. Andersherum leert sich der
         Blattstapel fuer einen Moment: die Scroll-Sperre faellt, der
         Hintergrund springt an seine gemerkte Position, die Navigation faehrt
         ein - und alles sofort wieder zurueck. Genau das flackerte. */
      ksOpenPlayers();
      ksWahlClose();
    });
  }
  function ksWahlOpen() {
    ksWahlEnsure();
    blattAuf("ksWahlScrim", "ksWahl");
  }
  function ksWahlClose() {
    blattZu("ksWahlScrim", "ksWahl");
  }

  /* ---- Blatt: buchen und Detail -------------------------------------------
     Ein Blatt, zwei Inhalte. „buchen" ist die Vorlage 3 (Zahlart waehlen und
     buchen), „detail" traegt Verlauf und Rueckgaengig - beides hing frueher
     als Zusatzzeile unter jeder Karte und macht die Liste unruhig. */
  const ksBlatt = { art: null, id: null, auswahl: null, zahlart: null };

  function ksBlattEnsure() {
    if (document.getElementById("ksBl")) return;
    const scrim = document.createElement("div");
    scrim.className = "tv-scrim"; scrim.id = "ksBlScrim";
    const sheet = document.createElement("div");
    sheet.className = "tv-sheet ks-bl"; sheet.id = "ksBl";
    sheet.setAttribute("role", "dialog"); sheet.setAttribute("aria-modal", "true");
    document.body.appendChild(scrim); document.body.appendChild(sheet);
    scrim.addEventListener("click", ksBlattClose);
    sheet.addEventListener("click", async (ev) => {
      if (ev.target.closest("[data-ks-bl-close]")) { ksBlattClose(); return; }
      const z = ev.target.closest("[data-ks-zart]");
      if (z) { ksBlatt.zahlart = z.dataset.ksZart; ksBlattRender(); return; }
      const m = ev.target.closest("[data-ks-zmenu]");
      if (m) { ksZeilenMenue(m.dataset.ksZmenu); return; }
      const w = ev.target.closest("[data-ks-wahl-id]");
      if (w) {
        const id = w.dataset.ksWahlId;
        if (ksBlatt.auswahl.has(id)) ksBlatt.auswahl.delete(id); else ksBlatt.auswahl.add(id);
        ksBlattRender(); return;
      }
      if (ev.target.closest("[data-ks-bl-buchen]")) { await ksBlattBuchen(); return; }
      if (ev.target.closest("[data-ks-bl-unpay]")) { await ksBlattUnpay(); return; }
    });
  }

  function ksStrafeById(id) {
    const s = (DEMO.strafen || []).find((x) => x.id === id);
    if (!s) return null;
    const player = playerById[s.playerId];
    if (!player) return null;
    return { ...s, betrag: strafeBetrag(s), st: fineStatus(s), player: player };
  }

  /* Blatt "Buchen" (Vorlage Final 15): alle offenen Strafen eines Spielers,
     vorausgewaehlt; Kaestchen schaltet, Menue ··· je Zeile (Storno bzw.
     Entfernen, Verlauf); Zahlart als Segment Bar / PayPal / Ueberweisung;
     Zusammenfassung und "Als bezahlt buchen" (ein Aufruf mark_fines_paid). */
  function ksSpielerOffen(pid) {
    return aktiveStrafen().filter((x) => x.playerId === pid && fineStatus(x) === "offen")
      .map((x) => ({ ...x, betrag: strafeBetrag(x), st: "offen", player: playerById[x.playerId] }))
      .sort((a, b) => a.datum.localeCompare(b.datum));
  }
  const KS_BUCH_ARTEN = [["bar", "Bar"], ["paypal", "PayPal"], ["ueberweisung", "Überweisung"]];
  function ksBlattSpielerHtml() {
    const p = playerById[ksBlatt.id];
    const liste = ksSpielerOffen(ksBlatt.id);
    if (!p) return "";
    // Auswahl nur auf Strafen, die es noch gibt (nach Storno faellt eine weg).
    ksBlatt.auswahl = new Set([...ksBlatt.auswahl].filter((id) => liste.some((x) => x.id === id)));
    const gewaehlt = liste.filter((x) => ksBlatt.auswahl.has(x.id));
    const summe = gewaehlt.reduce((a, x) => a + x.betrag, 0);
    const gesamt = liste.reduce((a, x) => a + x.betrag, 0);
    const art = ksBlatt.zahlart;
    const zeilen = liste.map((x) => {
      const an = ksBlatt.auswahl.has(x.id);
      const neben = [fmtDay(x.datum) + ".\u00a0" + fmtMon(x.datum), x.auto ? "automatisch" : "",
        x.sagtZahlart ? "Spieler: " + esc(ZAHLART_LABEL[x.sagtZahlart] || x.sagtZahlart) : ""].filter(Boolean).join(" · ");
      return '<div class="row ks-bz" data-ks-wahl-id="' + x.id + '" role="checkbox" aria-checked="' + an + '" tabindex="0">' +
        '<span class="ks-box' + (an ? " is-an" : "") + '" aria-hidden="true">' + (an ? ICON_CHECK : "") + '</span>' +
        '<span class="row-main"><span class="row-t">' + esc(vergehenName(x)) + '</span><span class="row-s">' + neben + '</span>' +
          (x.ablehnGrund ? '<span class="row-s is-rot">Abgelehnt: ' + esc(x.ablehnGrund) + '</span>' : "") + '</span>' +
        '<span class="row-end ks-bz-b">' + euro(x.betrag) + '</span>' +
        '<button type="button" class="tk-menue ks-bz-menue" data-ks-zmenu="' + x.id + '" aria-label="Mehr zu ' + esc(vergehenName(x)) + '">' +
          '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.9"/><circle cx="12" cy="12" r="1.9"/><circle cx="19" cy="12" r="1.9"/></svg></button></div>';
    }).join("");
    return '<span class="tv-grip ks-grip"></span>' +
      '<div class="tv-sh ks-bl-kopf"><span class="row-av ks-bl-av">' + esc(initials(p.name)) + '</span>' +
        '<div class="tv-sh-text"><strong>' + esc(p.name) + '</strong><div class="tv-shsub">' +
          (liste.length === 1 ? "1 offene Strafe" : liste.length + " offene Strafen") + ' · ' + euro(gesamt) + '</div></div>' +
        '<button class="tv-shx" data-ks-bl-close aria-label="Schließen">' + ICON_X + '</button></div>' +
      '<div class="tv-shbody ks-bl-body">' +
        (liste.length ? '<div class="card ks-bz-liste">' + zeilen + '</div>' : '<div class="empty">Keine offenen Strafen mehr.</div>') +
        '<div class="group-head"><h2>Zahlart</h2></div>' +
        '<div class="seg ks-buchart-seg" role="radiogroup" aria-label="Zahlart">' + KS_BUCH_ARTEN.map(([k, l]) =>
          '<button type="button" class="seg-b' + (art === k ? " is-on" : "") + '" data-ks-zart="' + k + '" aria-checked="' + (art === k) + '" role="radio">' + l + '</button>').join("") + '</div>' +
        (gewaehlt.length ? '<div class="ks-bz-sum"><span>' + (gewaehlt.length === 1 ? "1 Strafe" : gewaehlt.length + " Strafen") + ', ' +
          esc((ZAHLART_LABEL[art] || art).replace(/^./, (c) => c.toLowerCase())) + '</span><b>' + euro(summe) + '</b></div>' : "") +
        '<button class="btn btn-primary ks-bl-cta" data-ks-bl-buchen' + (gewaehlt.length ? "" : " disabled") + '>Als bezahlt buchen</button>' +
      '</div>';
  }
  // Menue ··· einer Zeile im Buchen-Blatt.
  function ksZeilenMenue(id) {
    const x = (DEMO.strafen || []).find((f) => f.id === id);
    if (!x) return;
    openZeilenMenue("ksZMenu", vergehenName(x), [
      x.auto ? '<button class="more-item is-danger" data-kasse-del="' + id + '">Entfernen</button>'
             : '<button class="more-item is-danger" data-kasse-cancel="' + id + '">Storno</button>',
      '<button class="more-item" data-ks-det="' + id + '">Verlauf</button>']);
  }
  function ksBlattRender() {
    const sheet = document.getElementById("ksBl");
    if (!sheet) return;
    if (ksBlatt.art === "spieler") {
      sheet.classList.add("ks-bl-spieler");
      sheet.innerHTML = ksBlattSpielerHtml();
      sheet.setAttribute("aria-label", "Als bezahlt buchen");
      return;
    }
    sheet.classList.remove("ks-bl-spieler");
    const s = ksStrafeById(ksBlatt.id);
    if (!s) return;
    /* Blatt „Strafe“ (Nachschliff E3, Vorlage D9): Kopf mit Avatar, Name und
       Strafe; Betragsfeld in der Statusfarbe mit Zahlweg und Pille (ersetzt den
       gelben Hinweis); Zeitleiste aus fine_status_log; „Buchung rückgängig“
       als Sekundärknopf in Rot. Titel „Strafe“ und Kreuz entfallen. */
    const zw = (art) => art === "paypal" ? '<b class="ksd-pp">Pay<span>Pal</span></b>' : esc(ZAHLART_LABEL[art] || art || "");
    const tag = (iso) => iso ? fmtKurz(String(iso).slice(0, 10)) : "";
    const st = s.st;
    const feld = st === "bestätigt"
      ? { kl: "is-gruen", pille: "Eingegangen", zeile: (s.zahlart ? "gezahlt per " + zw(s.zahlart) : "gezahlt") + (s.paidAt ? " · " + tag(s.paidAt) : "") }
      : st === "gemeldet"
        ? { kl: "is-amber", pille: "Gemeldet", zeile: s.sagtZahlart ? "gemeldet per " + zw(s.sagtZahlart) : "vom Spieler gemeldet" }
        : st === "storniert" ? { kl: "is-grau", pille: "Storniert", zeile: "storniert" }
        : { kl: "is-rot", pille: "Offen", zeile: s.ablehnGrund ? "Abgelehnt: " + esc(s.ablehnGrund) : "noch nicht bezahlt" };
    sheet.innerHTML =
      '<span class="nsb-griff" aria-hidden="true"></span>' +
      '<div class="ksd-kopf"><span class="ksd-av">' + esc(initials(s.player.name)) + '</span>' +
        '<span class="ksd-kopf-main"><span class="ksd-name">' + esc(s.player.name) + '</span><span class="ksd-sub">' + esc(vergehenName(s)) + ' · ' + fmtKurz(s.datum) + '</span></span></div>' +
      '<div class="tv-shbody ksd-body">' +
        '<div class="ksd-feld ' + feld.kl + '"><span class="ksd-feld-main"><span class="ksd-betrag">' + euro(s.betrag) + '</span>' +
          '<span class="ksd-zeile">' + feld.zeile + '</span></span><span class="ksd-pille">' + feld.pille + '</span></div>' +
        (s.sagtNote ? '<div class="ksd-notiz">Spieler: „' + esc(s.sagtNote) + '“</div>' : "") +
        '<div class="ksd-gruppe">Verlauf</div>' +
        '<div class="ksd-verlauf" id="ksBlHist"><div class="ksd-laedt">lädt…</div></div>' +
      '</div>' +
      (st === "bestätigt" ? '<div class="ksd-fuss"><button type="button" class="btn ksd-zurueck" data-ks-bl-unpay>' +
        '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>' +
        'Buchung rückgängig</button></div>' : "");
    sheet.setAttribute("aria-label", "Strafe " + vergehenName(s));
    ksBlattVerlauf(s.id);
  }
  /* Zeitleiste: ein Schritt je Statuswechsel. Punkt in der Statusfarbe,
     Linie zum nächsten Schritt, der letzte Schritt hervorgehoben. */
  function ksdSchritt(h) {
    const art = h.method ? (ZAHLART_LABEL[h.method] || h.method) : "";
    if (!h.from && h.to === "offen") return { t: "Angelegt", d: "offen", kl: "is-rot" };
    if (h.to === "gemeldet") return { t: "Gemeldet", d: "Spieler meldet Zahlung", kl: "is-amber" };
    if (h.to === "bestätigt") return { t: "Eingegangen", d: art || "bezahlt", kl: "is-gruen" };
    if (h.to === "storniert") return { t: "Storniert", d: h.reason || "", kl: "is-grau" };
    if (h.from === "gemeldet" && h.to === "offen") return { t: "Abgelehnt", d: h.reason || "wieder offen", kl: "is-rot" };
    if (h.from === "bestätigt" && h.to === "offen") return { t: "Zurückgenommen", d: "wieder offen", kl: "is-rot" };
    return { t: (STATUS_META[h.to] && STATUS_META[h.to].label) || h.to, d: art, kl: "is-grau" };
  }
  function ksdZeit(iso) {
    try { const d = new Date(iso); if (isNaN(d)) return ""; return String(d.getDate()).padStart(2, "0") + "." + String(d.getMonth() + 1).padStart(2, "0") + ". · " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); }
    catch (e) { return ""; }
  }
  function ksdVerlaufHtml(rows) {
    return rows.map((h, i) => {
      const x = ksdSchritt(h), letzter = i === rows.length - 1;
      return '<div class="ksd-schritt' + (letzter ? " is-letzter" : "") + '"><span class="ksd-spur"><span class="ksd-punkt ' + x.kl + '"></span>' + (letzter ? "" : '<span class="ksd-linie"></span>') + '</span>' +
        '<span class="ksd-s-main"><span class="ksd-s-t">' + esc(x.t) + '</span>' + (x.d ? '<span class="ksd-s-d">' + esc(x.d) + '</span>' : "") + '</span>' +
        '<span class="ksd-s-z">' + ksdZeit(h.at) + '</span></div>';
    }).join("");
  }
  async function ksBlattVerlauf(id) {
    const box = document.getElementById("ksBlHist");
    if (!box) return;
    try {
      const rows = await DB.fineHistory(id);
      if (!document.getElementById("ksBlHist")) return;
      document.getElementById("ksBlHist").innerHTML =
        rows.length ? ksdVerlaufHtml(rows) : `<div class="ksd-laedt">Kein Verlauf.</div>`;
    } catch (e) {
      const b = document.getElementById("ksBlHist");
      if (b) b.innerHTML = `<div class="ksd-laedt">Verlauf nicht ladbar.</div>`;
    }
  }

  function ksBlattOpen(art, id) {
    ksBlattEnsure();
    ksBlatt.art = art; ksBlatt.id = id;
    if (art === "spieler") {
      const liste = ksSpielerOffen(id);
      ksBlatt.auswahl = new Set(liste.map((x) => x.id));   // alle vorausgewaehlt
      // Zahlart: gemeinsame Angabe der Spieler-Meldungen, sonst Bar (Vorlage).
      const angaben = [...new Set(liste.map((x) => x.sagtZahlart).filter(Boolean))];
      ksBlatt.zahlart = angaben.length === 1 ? angaben[0] : "bar";
    }
    ksBlattRender();
    blattAuf("ksBlScrim", "ksBl");
  }
  function ksBlattClose() {
    blattZu("ksBlScrim", "ksBl");
    ksBlatt.art = null; ksBlatt.id = null;
  }

  async function ksBlattBuchen() {
    if (ksBlatt.art !== "spieler") return;
    const ids = [...(ksBlatt.auswahl || [])];
    if (!ids.length) return;
    const method = ksBlatt.zahlart || "bar";
    const btn = document.querySelector("[data-ks-bl-buchen]"); if (btn) btn.disabled = true;
    try {
      const n = await DB.markFinesPaid(ids, method);
      ksBlattClose();
      await reloadData();
      if (typeof n === "number" && n !== ids.length) tvToast(n + " von " + ids.length + " gebucht, der Rest war nicht mehr offen");
      else tvToast(ids.length === 1 ? "1 Strafe gebucht" : ids.length + " Strafen gebucht");
    } catch (e) {
      if (btn) btn.disabled = false;
      window.alert("Buchen fehlgeschlagen: " + ((e && e.message) || e));
    }
  }

  async function ksBlattUnpay() {
    const id = ksBlatt.id;
    if (!window.confirm("Buchung rückgängig machen? Die Strafe steht wieder als offen.")) return;
    try {
      await DB.setFinePaid(id, false);
      ksBlattClose();
      await reloadData();
      tvToast("Zurückgesetzt");
    } catch (e) { window.alert("Rückgängig fehlgeschlagen: " + ((e && e.message) || e)); }
  }

  /* ---------------------------------------------------------------------------
     Interaktion (Event-Delegation)
     --------------------------------------------------------------------------- */
  // Katalog: Typ-Umschalter blendet die Staffel-Felder ein/aus (ohne Re-Render -> Eingaben bleiben).
  /* Tippen im Push-Katalog: Entwurf merken und NUR die betroffene Karte
     auffrischen. Ein voller render() bei jedem Zeichen nimmt dem Feld den
     Fokus und setzt den Cursor an den Anfang. */
  // Ruhezeiten: auf change, nicht auf input - sonst speichert jede Ziffer.
  viewEl.addEventListener("change", (ev) => {
    const el = ev.target;
    if (!el || !el.dataset) return;
    if (el.hasAttribute("data-pn-von")) pnSetzen({ quiet_from: el.value || "22:00" });
    else if (el.hasAttribute("data-pn-bis")) pnSetzen({ quiet_to: el.value || "08:00" });
  });

  viewEl.addEventListener("input", (ev) => {
    const el = ev.target;
    if (!el || !el.dataset) return;
    const k = el.dataset.pkatTitel || el.dataset.pkatText;
    if (!k) return;
    const v = (katVorlagen || []).find((x) => x.kategorie === k);
    if (!v) return;
    katEntwurf[k] = katEntwurf[k] || {};
    if (el.dataset.pkatTitel) katEntwurf[k].titel = el.value;
    else katEntwurf[k].text = el.value;

    const karte = el.closest(".pkat-karte");
    if (!karte) return;
    const st = katStand(v);
    const rt = katRender(st.titel, v.beispiel_daten, v.platzhalter, v.platzhalter_optional);
    const rx = katRender(st.text,  v.beispiel_daten, v.platzhalter, v.platzhalter_optional);
    const fehler = rt.fehler || rx.fehler;
    const titel = rt.text || st.titel;
    const text  = rx.text || st.text;

    const vs = karte.querySelector(".pkat-vorschau");
    if (vs) vs.innerHTML = katMitteilungHtml("ios", titel, text) + katMitteilungHtml("android", titel, text);

    const zahlen = karte.querySelectorAll(".pkat-lbl");
    if (zahlen[0]) zahlen[0].innerHTML = "Titel " + katZaehler(katLaenge(titel), KAT_TITEL_MAX);
    if (zahlen[1]) zahlen[1].innerHTML = "Text " + katZaehler(katLaenge(text), KAT_TEXT_MAX);

    let warn = karte.querySelector(".tk-warn");
    if (fehler && !warn && vs) {
      warn = document.createElement("div"); warn.className = "tk-warn";
      karte.insertBefore(warn, vs);
    }
    if (warn) { warn.textContent = fehler || ""; warn.hidden = !fehler; }

    const kn = karte.querySelector(".pkat-knoepfe");
    if (kn) kn.innerHTML = st.geaendert
      ? '<button class="btn btn-primary" data-pkat-save="' + esc(k) + '" type="button">Vorlage speichern</button>' +
        '<button class="btn btn-soft" data-pkat-reset="' + esc(k) + '" type="button">Verwerfen</button>'
      : '<button class="btn btn-primary" data-pkat-send="' + esc(k) + '" type="button"' + (fehler ? " disabled" : "") + '>An mich senden</button>';
  });

  // D3: Art als Segment; das versteckte Feld data-kat-type trägt den Wert für Speichern.
  viewEl.addEventListener("click", (ev) => {
    const b = currentView === "katalog" && ev.target.closest("[data-kat-art]");
    if (!b) return;
    const felder = b.closest(".kat-edit"), typ = b.dataset.katArt;
    if (!felder) return;
    felder.classList.toggle("is-staffel", typ === "staffel");
    felder.querySelector("[data-kat-type]").value = typ;
    felder.querySelectorAll("[data-kat-art]").forEach((x) => { const an = x === b; x.classList.toggle("is-on", an); x.setAttribute("aria-checked", String(an)); });
  });
  /* Die Karten in „Zu prüfen" und „Offen" sind antippbar, aber keine echten
     Knöpfe - sie enthalten selbst welche, und ein Knopf im Knopf ist kein
     gültiges HTML. Deshalb tragen sie role="button" und bekommen die Tastatur
     von Hand. */
  viewEl.addEventListener("keydown", (ev) => {
    if (currentView !== "kasse") return;
    if (ev.key !== "Enter" && ev.key !== " ") return;
    const karte = ev.target.closest && ev.target.closest("[data-ks-det][role='button']");
    if (!karte || karte !== ev.target) return;
    ev.preventDefault();
    ksBlattOpen("detail", karte.dataset.ksDet);
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
      // --- „Strafe verhängen" öffnet den Vollbild-Wähler. Alles Weitere
      //     passiert auf der Seite, die an <body> hängt (ksSeiteKlick). ---
      if (ev.target.closest("[data-ks-wahl]")) { ksSeiteNeu("katalog"); return; }

      // --- Reiter ---
      const tab = ev.target.closest("[data-kstab]");
      if (tab) { kasse.tab = tab.dataset.kstab; renderKasse(); return; }

      // --- Blatt: buchen (aus der Zeile) bzw. Detail mit Verlauf (Tipp auf die Karte) ---
      const sp = ev.target.closest("[data-ks-spieler]");
      if (sp) { ksBlattOpen("spieler", sp.dataset.ksSpieler); return; }
      const det = ev.target.closest("[data-ks-det]");
      if (det && !ev.target.closest("button:not([data-ks-det])")) { ksBlattOpen("detail", det.dataset.ksDet); return; }

      // --- Prüfen: bestätigen / ablehnen / alle bestätigen ---
      // Gebucht wird, was der Spieler angegeben hat - frueher stand hier fest
      // "paypal", wodurch jede Barzahlung als PayPal in den Buechern landete.
      const conf = ev.target.closest("[data-kasse-confirm]");
      if (conf) {
        const s = ksStrafeById(conf.dataset.kasseConfirm);
        try { await DB.confirmFines([conf.dataset.kasseConfirm], (s && s.sagtZahlart) || "paypal"); await reloadData(); tvToast("Bestätigt"); }
        catch (e) { window.alert("Bestätigen fehlgeschlagen: " + ((e && e.message) || e)); }
        return;
      }
      if (ev.target.closest("[data-kasse-confirm-all]")) {
        const liste = aktiveStrafen().filter((s) => fineStatus(s) === "gemeldet");
        if (!liste.length) return;
        if (!window.confirm(liste.length + " gemeldete Strafen bestätigen?")) return;
        try {
          // Je Zahlart ein Aufruf, damit jede Strafe mit ihrer eigenen Angabe
          // gebucht wird und nicht alle mit der des ersten Spielers.
          const nachArt = {};
          liste.forEach((s) => {
            const a = s.sagtZahlart || "paypal";
            (nachArt[a] = nachArt[a] || []).push(s.id);
          });
          for (const a of Object.keys(nachArt)) await DB.confirmFines(nachArt[a], a);
          await reloadData(); tvToast(liste.length + " bestätigt");
        } catch (e) { window.alert("Bestätigen fehlgeschlagen: " + ((e && e.message) || e)); }
        return;
      }
      const rej = ev.target.closest("[data-kasse-reject]");
      if (rej) {
        const grund = window.prompt("Grund der Ablehnung (der Spieler sieht ihn):");
        if (grund == null || !grund.trim()) return;
        try { await DB.rejectFine(rej.dataset.kasseReject, grund.trim()); await reloadData(); tvToast("Abgelehnt"); } catch (e) { window.alert("Ablehnen fehlgeschlagen: " + ((e && e.message) || e)); }
        return;
      }

      // --- Offen: stornieren / automatische Strafe entfernen ---
      const canc = ev.target.closest("[data-kasse-cancel]");
      if (canc) {
        if (!window.confirm("Diese Strafe stornieren? Sie zählt dann nicht mehr.")) return;
        try { await DB.cancelFine(canc.dataset.kasseCancel); await reloadData(); if (ksBlatt.art === "spieler") ksBlattRender(); tvToast("Storniert"); } catch (e) { window.alert("Stornieren fehlgeschlagen: " + ((e && e.message) || e)); }
        return;
      }
      const del = ev.target.closest("[data-kasse-del]");
      if (del) { if (window.confirm("Diese automatische Strafe wirklich entfernen?")) { try { await DB.deleteFine(del.dataset.kasseDel); await reloadData(); if (ksBlatt.art === "spieler") ksBlattRender(); tvToast("Entfernt"); } catch (e) { window.alert("Löschen fehlgeschlagen: " + ((e && e.message) || e)); } } return; }
      // „Buchung rückgängig" steht jetzt im Detail-Blatt (ksBlattUnpay).
    }

    const t = ev.target.closest("[data-remind],[data-nav-event],[data-rsvp],[data-filter],[data-sfilter],[data-kseg],[data-toggle-paid],[data-del-fine],[data-kader-info],[data-rsvp-sheet],[data-tkmenu],[data-task-focus],[data-task-pay],[data-lineup-edit],[data-nav],[data-nav-back],[data-sim],[data-kat-edit],[data-kat-del],[data-kat-save],[data-kat-cancel],[data-kat-add],[data-bfv-connect],[data-bfv-change],[data-bfv-cancel],[data-bfv-trennen],[data-bfv-sync],[data-goto],[data-paypal],[data-auth],[data-pick-player],[data-paid-self],[data-termin-new],[data-termin-edit],[data-termin-del],[data-view-jump],[data-bfv-reset],[data-bfv-take],[data-cal-sheet],[data-cal-hide],[data-cal-copy-profil],[data-cal-open-ein],[data-cal-google-ein],[data-cal-regen-ein],[data-push-an],[data-push-aus],[data-push-test],[data-push-install],[data-push-hinweis-weg],[data-ein-haupt],[data-pn-kat],[data-ein-alle],[data-pn-thema],[data-pn-ruhe],[data-pn-dringend],[data-pkat-save],[data-pkat-reset],[data-pkat-send],[data-pkat-alle],[data-pkat-clear],[data-pkat-hinweis-save],[data-ics-event],[data-koord-save],[data-status-set],[data-status-fenster],[data-status-blatt],[data-pw-aendern],[data-logout],[data-ein],[data-ein-back],[data-ein-tat],[data-diag-bericht],[data-diag-cache]");
    if (!t) return;

    // Fitnessstatus setzen. Wer das darf, entscheidet die Datenbank:
    // Spieler nur sich selbst, coach/admin alle (set_player_status).
    if (t.dataset.statusBlatt) { openStatusBlatt(t.dataset.statusBlatt); return; }
    if (t.hasAttribute("data-pw-aendern")) { openPasswortBlatt(); return; }
    if (t.dataset.statusFenster) { openStatusFenster(t.dataset.statusFenster, t.dataset.wert); return; }
    if (t.dataset.statusSet) {
      await statusSpeichern(t.dataset.statusSet, t.dataset.wert);
      return;
    }

    /* Einstellungen: eine Ebene tiefer, eine Ebene zurueck, oder eine der
       beiden Aktionen aus dem Info-Block. */
    if (t.dataset.ein) { einOeffnen(t.dataset.ein, t.dataset.einParam); return; }
    if (t.hasAttribute("data-ein-back")) { einZurueck(); return; }
    if (t.dataset.einTat === "diagnose") {
      // Die Diagnoseseite liegt inline in index.html und ist auch dann da,
      // wenn app.js nicht laedt. Direkt aufrufen statt ueber ?debug=1 - das
      // waere ein Neustart der App, nur um eine Seite zu zeigen.
      if (typeof window.__showDiag === "function") window.__showDiag("Einstellungen");
      else location.href = "?debug=1";
      return;
    }
    if (t.dataset.einTat === "neuladen") { location.reload(); return; }
    if (t.hasAttribute("data-diag-bericht")) { diagBerichtKopieren(); return; }
    if (t.hasAttribute("data-diag-cache")) {
      // wie in der Diagnose aus index.html: Caches leeren, den Service Worker aber behalten (Push-Abo)
      try { if (window.caches && caches.keys) caches.keys().then((ks) => ks.forEach((k) => { if (k.indexOf("fn-sw-") !== 0) caches.delete(k); })); } catch (e) {}
      setTimeout(() => location.reload(), 400);
      return;
    }

    // Abmelden (in den Einstellungen) – prominent platziert, daher mit Rückfrage.
    if (t.hasAttribute("data-logout")) {
      if (!window.confirm("Abmelden?\n\nDu wirst auf diesem Gerät abgemeldet.")) return;
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

    // Benachrichtigungen. requestPermission und subscribe laufen hier drin,
    // also direkt im Klick - alles andere lehnt iOS wortlos ab.
    if (t.hasAttribute("data-push-an")) {
      (async () => {
        try {
          const r = await pushAnmelden();
          if (r === "granted") { render(); pushMeldung("Benachrichtigungen sind aktiv"); }
          else if (r === "denied") { render(); }
          else pushMeldung("Nicht bestätigt, nichts geändert");
        } catch (err) {
          pushMeldung("Einrichten fehlgeschlagen: " + ((err && err.message) || err));
        }
      })();
      return;
    }
    if (t.hasAttribute("data-push-aus")) {
      (async () => { await pushAbmelden(); render(); })();
      return;
    }
    if (t.hasAttribute("data-push-test")) {
      if (!Roles.isAdmin()) return;   // zweite Schranke; der Server ist die erste
      (async () => {
        try { await DB.sendTestNotification(); pushMeldung("Testnachricht unterwegs, sie kommt in bis zu einer Minute"); }
        catch (err) { pushMeldung("Fehlgeschlagen: " + ((err && err.message) || err)); }
      })();
      return;
    }
    // Push-Katalog.
    if (t.hasAttribute("data-pkat-hinweis-save")) {
      const feld = document.querySelector("[data-pkat-hinweis]");
      const text = feld ? feld.value : "";
      DB.setNotificationStrafhinweis(text)
        .then((neu) => {
          const v = (katVorlagen || []).find((x) => x.kategorie === "rueckmeldung_erinnerung");
          if (v) v.beispiel_daten = Object.assign({}, v.beispiel_daten, { strafhinweis: neu });
          katMeldung = "Strafhinweis gespeichert.";
          render();
        })
        .catch((e) => katSag("Speichern fehlgeschlagen: " + ((e && e.message) || e)));
      return;
    }
    if (t.dataset.pkatSave) {
      const k = t.dataset.pkatSave;
      const v = (katVorlagen || []).find((x) => x.kategorie === k);
      const st = v ? katStand(v) : null;
      if (st) {
        (async () => {
          try {
            await DB.setNotificationTemplate(k, st.titel, st.text);
            v.titel_vorlage = st.titel; v.text_vorlage = st.text;
            delete katEntwurf[k];
            katMeldung = k + " gespeichert";
            render();
          } catch (err) { katSag("Speichern fehlgeschlagen: " + ((err && err.message) || err)); }
        })();
      }
      return;
    }
    if (t.dataset.pkatReset) { delete katEntwurf[t.dataset.pkatReset]; render(); return; }
    if (t.dataset.pkatSend) {
      const k = t.dataset.pkatSend;
      (async () => {
        try { await DB.sendPreviewNotification(k); katSag(k + " unterwegs – kommt in bis zu einer Minute"); }
        catch (err) { katSag("Fehlgeschlagen: " + ((err && err.message) || err)); }
      })();
      return;
    }
    if (t.hasAttribute("data-pkat-alle")) { katAlleSenden(); return; }
    if (t.hasAttribute("data-pkat-clear")) {
      (async () => {
        try { const n = await DB.deletePreviewNotifications(); katSag(n + " Vorschauen gelöscht"); }
        catch (err) { katSag("Fehlgeschlagen: " + ((err && err.message) || err)); }
      })();
      return;
    }

    // Schalter der Benachrichtigungen.
    if (t.hasAttribute("data-ein-haupt")) {
      // Der Hauptschalter ist geraetebezogen: an heisst anmelden, aus heisst abmelden.
      (async () => {
        if (t.getAttribute("aria-checked") === "true") { await pushAbmelden(); render(); return; }
        try {
          const r = await pushAnmelden();
          render();
          if (r !== "granted" && r !== "denied") pushMeldung("Nicht bestätigt, nichts geändert");
        } catch (err) { pushMeldung("Einrichten fehlgeschlagen: " + ((err && err.message) || err)); }
      })();
      return;
    }
    if (t.dataset.pnKat) {
      const ks = t.dataset.pnKat.split(",");
      const neu = !(pushPrefs && ks.every((k) => pushPrefs[k]));
      const f = {}; ks.forEach((k) => { f[k] = neu; });
      pnSetzen(f);
      return;
    }
    if (t.dataset.pnThema) {
      const th = PN_THEMEN.find((x) => x.id === t.dataset.pnThema);
      if (th) {
        const ks = th.zeilen.flatMap(([k]) => k).filter((k) => pushPrefs && k in pushPrefs);
        const neu = !(pushPrefs && ks.every((k) => pushPrefs[k]));
        const f = {}; ks.forEach((k) => { f[k] = neu; });
        pnSetzen(f);
      }
      return;
    }
    if (t.dataset.pnAlle) {
      const g = PN_GRUPPEN.find((x) => x.rolle === t.dataset.pnAlle);
      if (g) {
        // Gemischt zaehlt als aus: der naechste Druck schaltet alles an.
        const neu = pnSammelZustand(g, pushPrefs) !== "true";
        const f = {}; g.kategorien.forEach((k) => { f[k[0]] = neu; });
        pnSetzen(f);
      }
      return;
    }
    if (t.hasAttribute("data-pn-ruhe")) {
      const an = t.getAttribute("aria-checked") === "true";
      pnSetzen(an ? { quiet_from: "00:00", quiet_to: "00:00" }
                  : { quiet_from: "22:00", quiet_to: "08:00" });
      return;
    }
    if (t.hasAttribute("data-pn-dringend")) {
      pnSetzen({ quiet_override_urgent: !(pushPrefs && pushPrefs.quiet_override_urgent) });
      return;
    }

    if (t.hasAttribute("data-push-install")) {
      if (installPrompt) { installPrompt.prompt(); installPrompt = null; }
      return;
    }
    if (t.hasAttribute("data-push-hinweis-weg")) {
      const wrap = t.closest(".kal-abo-wrap");
      pushHinweisMerken();
      if (wrap) {
        wrap.classList.add("is-weg");
        const weg = () => { if (wrap.parentNode) wrap.remove(); };
        wrap.addEventListener("transitionend", weg, { once: true });
        setTimeout(weg, 400);
      }
      return;
    }

    // X an der Abo-Kachel: erst einklappen, dann aus dem Baum nehmen.
    if (t.hasAttribute("data-cal-hide")) {
      const wrap = t.closest(".kal-abo-wrap");
      hinweisMerken(true, false);
      if (wrap) {
        wrap.classList.add("is-weg");
        const weg = () => { if (wrap.parentNode) wrap.remove(); };
        wrap.addEventListener("transitionend", weg, { once: true });
        setTimeout(weg, 400);   // falls die Animation ausgeschaltet ist
      }
      return;
    }

    // "Link kopieren" im Einstellungs-Abschnitt (im Blatt haengt es am Blatt).
    if (t.hasAttribute("data-cal-open-ein")) {
      if (t.getAttribute("aria-disabled") === "true") { ev.preventDefault(); return; }
      hinweisMerken(false, true);
      return;   // der Link selbst oeffnet den Kalender (webcal:)
    }
    if (t.hasAttribute("data-cal-google-ein")) { hinweisMerken(false, true); return; }
    if (t.hasAttribute("data-cal-regen-ein")) {
      if (!window.confirm("Der alte Link funktioniert danach nicht mehr. Wirklich zurücksetzen?")) return;
      try {
        calendarToken = await DB.regenerateCalendarToken();
        einAboAdresseNachtragen();
        const fb = document.querySelector("[data-cal-copied-profil]");
        if (fb) { fb.textContent = "Neuer Link erstellt"; fb.hidden = false; setTimeout(() => { fb.hidden = true; }, 1800); }
      } catch (err) { window.alert("Fehlgeschlagen: " + ((err && err.message) || err)); }
      return;
    }
    if (t.hasAttribute("data-cal-copy-profil")) {
      (async () => {
        const fb = document.querySelector("[data-cal-copied-profil]");
        const sag = (txt) => { if (fb) { fb.textContent = txt; fb.hidden = false; setTimeout(() => { fb.hidden = true; }, 1800); } };
        await ensureCalendarToken();
        const url = calendarSubscribeUrl();
        if (!url) { sag("Link steht noch nicht bereit"); return; }
        hinweisMerken(false, true);
        sag((await copyText(url)) ? "Link kopiert" : "Kopieren nicht möglich");
      })();
      return;
    }
    if (t.hasAttribute("data-ics-event")) { termindateiLaden(t.getAttribute("data-ics-event")); return; }

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
        bfvMsg = `Verbunden, ${rr.parsed} Spiele gefunden.`;
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
    // Final 24: Verbindung trennen. Uebernommene Spiele bleiben (der Abgleich laeuft ohne Adresse nicht).
    if (t.hasAttribute("data-bfv-trennen")) {
      if (!window.confirm("Verbindung zum BFV trennen? Bereits übernommene Spiele bleiben erhalten.")) return;
      try { await DB.setIcalUrl(""); bfvMsg = "Verbindung getrennt."; await reloadData(); }
      catch (err) { window.alert("Trennen fehlgeschlagen: " + ((err && err.message) || err)); }
      return;
    }
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
          const proE = num(gv("amount"));   // D3: ein Betragsfeld, bei Staffel je Schritt
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
    if (t.dataset.tkmenu) { openTkMenu(t.dataset.tkmenu, t); return; }

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
        navJumpTo("strafen", { strafenFilter: "offen", kontoSeg: "team" });
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
    if (t.dataset.sfilter) { strafenFilter = (strafenFilter === t.dataset.sfilter) ? "alle" : t.dataset.sfilter; renderStrafen(); return; }
    if (t.dataset.kseg) { kontoSeg = t.dataset.kseg; renderStrafen(); return; }

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
      // Erste eigene Rueckmeldung dieser Sitzung: der Hinweis bekommt seinen
      // Platz direkt unter dieser Karte. Zuruecknehmen zaehlt nicht.
      if (aboSitzung === null && state.rsvp[key] && aboHinweisPlatz(currentProfile, true, null)) {
        aboSitzung = { ort: "karte", eventId: eventId };
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

    // Selbstmeldung „Ich habe bezahlt" -> Blatt mit Zahlart und Notiz
    if (t.hasAttribute("data-paid-self")) { zmOpen(); return; }
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
    if (opts.strafenFilter) kontoSeg = opts.kontoSeg || (opts.strafenFilter === "alle" ? "team" : (opts.strafenFilter === "meine" ? "ich" : null));
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

  /* ---------- Deep Links ----------------------------------------------------
     Aus einer Benachrichtigung heraus soll die App an der richtigen Stelle
     aufgehen - auch beim KALTSTART der installierten App, wo es noch kein
     offenes Fenster gibt und der Start ueber start_url plus Hash laeuft.

     Schema (alles hinter dem #):
       ansicht=<name>   dashboard | kalender | strafen | kasse | einstellungen
                        | profil | kader | katalog | admin
       termin=<id>      Kalender, zum Termin scrollen und kurz hervorheben
       strafen=<filter> offen | gemeldet | bezahlt | alle | meine
       kasse=<reiter>   pruefen | offen | bezahlt
       strafe=<weg>     katalog | individuell - oeffnet die Eingabeseite.
                        Anders als die uebrigen bleibt dieser Hash stehen,
                        solange die Seite offen ist: ein Neuladen landet dann
                        auf einer leeren, funktionsfaehigen Seite statt auf
                        einem halben Formular.
       lineup=<id>      bestehend, unveraendert

     Der Hash wird nach dem Sprung entfernt, damit ein Reload nicht in der
     Zielansicht haengen bleibt - dasselbe Verhalten wie bisher bei lineup=.
     Unbekannte oder unzulaessige Ziele landen still auf der Standardansicht;
     eine Benachrichtigung darf nie in einer Fehlermeldung enden.          */
  const DEEP_ANSICHTEN = ["dashboard", "kalender", "strafen", "kasse", "einstellungen", "profil", "kader", "katalog", "admin"];

  // Darf die aktuelle Rolle diese Ansicht sehen? Spiegelt render().
  function deepErlaubt(ansicht) {
    if (ansicht === "kader" || ansicht === "lineup") return Roles.canManageEvents();
    if (ansicht === "kasse") return Roles.canManageFines();
    if (ansicht === "admin") return Roles.isAdmin();
    return DEEP_ANSICHTEN.indexOf(ansicht) !== -1;
  }

  /* Zerlegt einen Hash in { art, wert }. Rein rechnend, damit pruefbar. */
  function deepLinkZiel(roh) {
    const h = String(roh || "").replace(/^#/, "");
    if (!h) return null;
    const i = h.indexOf("=");
    if (i < 1) return null;
    const art = h.slice(0, i);
    let wert = h.slice(i + 1);
    try { wert = decodeURIComponent(wert); } catch (e) { /* roh lassen */ }
    if (!wert) return null;
    if (art === "ansicht" && DEEP_ANSICHTEN.indexOf(wert) !== -1) return { art: "ansicht", wert: wert };
    if (art === "termin") return { art: "termin", wert: wert };
    if (art === "strafen" && ["offen", "gemeldet", "bezahlt", "alle", "meine"].indexOf(wert) !== -1) return { art: "strafen", wert: wert };
    if (art === "kasse" && ["pruefen", "offen", "bezahlt"].indexOf(wert) !== -1) return { art: "kasse", wert: wert };
    if (art === "strafe" && ["katalog", "individuell"].indexOf(wert) !== -1) return { art: "strafe", wert: wert };
    if (art === "ein" && Object.prototype.hasOwnProperty.call(EIN_SEITEN, wert)) return { art: "ein", wert: wert };
    if (art === "lineup") return { art: "lineup", wert: wert };
    return null;
  }

  // Hash wegraeumen, ohne einen Eintrag in der Verlaufsliste zu hinterlassen.
  function deepLinkHashWeg() {
    if (!location.hash) return;
    try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {}
  }

  function routeDeepLink(roh) {
    const ziel = deepLinkZiel(roh === undefined ? location.hash : roh);
    if (!ziel) { deepLinkHashWeg(); return false; }
    if (ziel.art === "lineup") { tvRouteInitialHash(); return true; }   // raeumt selbst auf
    /* strafe= bleibt stehen: der Hash IST der Zustand der Eingabeseite.
       Nach einem Neuladen geht sie dadurch leer und benutzbar wieder auf -
       nie mit halb gefuelltem Formular, denn das lebte nur im Speicher. */
    if (ziel.art === "strafe") {
      if (!Roles.canManageFines()) { deepLinkHashWeg(); return false; }
      const modus = ziel.wert === "individuell" ? "indiv" : "katalog";
      ksSeiteLeeren();
      kasse.seite = modus;
      kasse.bloecke = { katalog: modus === "katalog", indiv: modus === "indiv" };
      navJumpTo("kasse", {});
      return true;
    }
    /* Wie bei strafe= bleibt der Hash stehen: er IST der Zustand der
       Unterseite. Neuladen fuehrt dadurch wieder genau dorthin. */
    if (ziel.art === "ein") {
      if (!einSeiteErlaubt(ziel.wert)) { deepLinkHashWeg(); switchView("einstellungen"); return true; }
      einst.scroll = 0;
      if (currentView !== "einstellungen") switchView("einstellungen");   // setzt einst.seite zurueck
      einst.richtung = "rein";
      einst.seite = ziel.wert;
      einst.kompakt = false;
      render();
      window.scrollTo(0, 0);
      return true;
    }
    deepLinkHashWeg();
    if (ziel.art === "ansicht") {
      if (!deepErlaubt(ziel.wert)) return false;
      switchView(ziel.wert);
      return true;
    }
    if (ziel.art === "termin") {
      const e = (DEMO && DEMO.events || []).find((x) => x.id === ziel.wert);
      if (!e) { switchView("kalender"); return true; }   // Termin geloescht: Kalender statt Fehler
      navJumpTo("kalender", { kalFilter: "alle", eventId: ziel.wert });
      return true;
    }
    if (ziel.art === "strafen") {
      navJumpTo("strafen", { strafenFilter: ziel.wert });
      return true;
    }
    if (ziel.art === "kasse") {
      if (!Roles.canManageFines()) return false;
      kasse.tab = ziel.wert; kasse.pruefIdx = 0;
      navJumpTo("kasse", {});
      return true;
    }
    return false;
  }
  function switchView(view) {
    currentView = view;
    if (view === "lineup") { tv.view = "games"; tv.eventId = null; tv.sel = null; tv.mark = null; tv.alleSpiele = false; } // v2 startet immer bei der Spielauswahl
    // Kachel-Sprung-Zustand (Ursprung/Readonly/Hash) beim normalen Tab-Wechsel verwerfen.
    tv.origin = null; tv.readonly = false; tv.dirty = false; navReturn = null;
    // Kasse-Vollbild-Auswahl beim Tab-Wechsel schließen.
    blattAlleZu();
    /* Eine offene Einstellungs-Unterseite ueberlebt den Ansichtswechsel nicht -
       und ihr Hash auch nicht. Bliebe er stehen, zeigte die Adresse eine Seite,
       die gar nicht mehr offen ist, und ein Neuladen landete wieder dort. */
    if (einst.seite) {
      einst.seite = null; einst.kompakt = false; einst.scroll = 0;
      if (/^#?ein=/.test(location.hash || "")) {
        try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {}
      }
    }
    // Die „Strafe verhängen"-Seite ueberlebt keinen Ansichtswechsel - sonst
    // faende man sie beim naechsten Aufruf der Kasse halb ausgefuellt vor.
    if (kasse.seite) { ksSeiteLeeren(); ksSeiteSync(); }
    kasse.wartet = null;
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

  // Aendert sich der Hash bei laufender App, ist das ein Deep Link von aussen.
  window.addEventListener("hashchange", function () {
    if (einSyncAusHash()) return;   // popstate war schneller oder es kam von aussen
    routeDeepLink();
  });

  // Android bietet die Installation an. Den Vorschlag aufheben, damit er an
  // der richtigen Stelle als Knopf erscheint statt als Browserbanner.
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault(); installPrompt = e;
  });

  /* Liegt irgendetwas ueber der Seite? Sheets, Dialoge, Aufstellungs-Panels.
     Pull-to-Refresh darf dann NICHT ausloesen – sonst zieht die Geste die Seite
     hinter dem offenen Sheet neu. Vorher wurde nur .tv-sheet geprueft; Abo-,
     Rueckmeldungs- und Mehr-Sheet nutzen aber .more-sheet und fielen durch. */
  function ueberlagerungOffen() {
    return !!(document.querySelector(".more-sheet:not([hidden])")
           || document.querySelector(".tv-sheet.open")
           || document.querySelector(".modal-ov")
           || document.querySelector("#ksSheet.open")
           // Die Eingabeseite liegt ueber allem. Zoege man hier, verschoebe
           // der Pull-to-Refresh den Container - und ein transformierter
           // Vorfahre macht aus position:fixed eine Positionierung relativ zu
           // ihm. Genau so ist scrollbug.webp entstanden.
           || document.querySelector("#ksSeite:not([hidden])"));
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

  /* Wie viel verdeckt die Tastatur?

     `position: fixed` misst unter iOS am LAYOUT-Viewport, nicht am sichtbaren.
     Ein Knopf am unteren Rand einer Vollbildflaeche liegt deshalb hinter der
     Tastatur. visualViewport sagt, wie viel unten fehlt; der Wert steht als
     --kb im Dokument, und die Vollbildflaechen enden dort statt bei 0.

     Kein visualViewport (aelteres Android, Desktop): --kb bleibt 0 und alles
     verhaelt sich wie vorher. */
  (function () {
    const vv = window.visualViewport;
    if (!vv) return;
    let t = 0;
    function abgleich() {
      const unten = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      // Unter ~90px ist es keine Tastatur, sondern die schrumpfende Adressleiste.
      document.documentElement.style.setProperty("--kb", (unten > 90 ? unten : 0) + "px");
    }
    const geplant = () => { cancelAnimationFrame(t); t = requestAnimationFrame(abgleich); };
    vv.addEventListener("resize", geplant);
    vv.addEventListener("scroll", geplant);
    abgleich();
  })();

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
      routeDeepLink();        // Deep-Link aus Benachrichtigung/Verweis (nach dem ersten Render)
      // Push: Zustand dieses Geraets abgleichen und Einstellungen holen.
      // Beides ohne Nutzergeste und deshalb ohne subscribe().
      try { pushPrefs = await DB.loadNotificationPrefs(); } catch (e) { pushPrefs = null; }
      try { pnInfos = await DB.loadNotificationInfos(); } catch (e) { pnInfos = []; }
      pushAbo = await pushAboLesen();
      pushAbgleich();
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
