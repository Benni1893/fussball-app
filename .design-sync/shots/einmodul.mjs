/* Holt die Einstellungs-Funktionen WOERTLICH aus app.js und macht sie ohne
   Browser und ohne Datenbank aufrufbar - dasselbe Verfahren wie bei
   kassemodul.mjs. Damit pruefen und rendern beide Skripte das Markup, das
   die App ausliefert, und keinen Nachbau.

   Benutzt von einpruef.mjs (Logik) und einbild.mjs (Bilder).             */
import fs from 'node:fs';

const app = fs.readFileSync('app.js', 'utf8');

function stueck(von, bis) {
  const a = app.indexOf(von);
  if (a < 0) throw new Error('Anker nicht gefunden: ' + von);
  if (app.indexOf(von, a + 1) >= 0) throw new Error('Anker mehrfach: ' + von);
  const b = app.indexOf(bis, a);
  if (b < 0) throw new Error('Endanker nicht gefunden: ' + bis);
  return app.slice(a, b);
}

const TEILE = [
  stueck('  function initials(name) {', '  const STATUS_META = {'),
  stueck('  const SVG = ', '  const ICON_EDIT'),
  // Das Geruest der Unterseiten und die Bausteine der Uebersicht.
  stueck('  const EIN_SEITEN = {', '  function einScrollBeobachter()'),
  stueck('  function einKopfHtml(titel) {', '\n  /* ---------- Einstellungen (Tab'),
  stueck('  function einIcon(name) {', '  function renderEinUnterseite(id)'),
];

/* Was die Einstellungen aus der uebrigen App brauchen. Bewusst duenn. */
const STUETZEN = `
  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  const APP_BUILD = "2026-09-26-G";
  const ROLE_LABEL = { player: "Spieler", coach: "Trainer", treasurer: "Kassenwart", admin: "Administrator" };
  let rollen = ["admin", "player"];
  const Roles = {
    get list() { return rollen; },
    isAdmin: () => rollen.indexOf("admin") >= 0,
    canManageSchedule: () => rollen.some((r) => r === "coach" || r === "admin"),
    canEditCatalog: () => rollen.some((r) => r === "treasurer" || r === "admin"),
    canManageEvents: () => rollen.some((r) => r === "coach" || r === "admin"),
  };
  let currentProfile = { player_id: "p1", email: "lukas.weber@example.de" };
  let playerById = { p1: { id: "p1", name: "Lukas Weber" } };
  let DEMO = { teamName: "FC Fasanerie-Nord 2" };
  let pushPrefs = { quiet_from: "22:00", quiet_to: "08:00" };
  let pushZustandWert = "aktiv";
  function pushUmgebung() { return {}; }
  function pushZustand() { return pushZustandWert; }
  let viewEl = { innerHTML: "", querySelector: () => null };
  let currentView = "einstellungen";
  const location = { hash: "", pathname: "/", search: "" };
  const history = { state: null, pushState() {}, replaceState() {}, back() {} };
  const window = { scrollY: 0, scrollTo() {}, addEventListener() {}, __HTML_BUILD: null };
  const document = { querySelector: () => null };
  function requestAnimationFrame() {}
  function render() {}
`;

const RUECK = `
  return {
    EIN_SEITEN, EIN_KOMPAKT_AB, einst,
    einSeiteErlaubt, einZielAusHash,
    einKopfHtml, einZeileHtml, einIcon,
    einMitteilungenWert, einRuhezeitWert,
    // Die Uebersicht rendert in viewEl.innerHTML; das Markup kommt hier heraus.
    uebersichtHtml() { viewEl.innerHTML = ""; renderEinUebersicht(); return viewEl.innerHTML; },
    setRollen(r) { rollen = r; },
    setPush(z) { pushZustandWert = z; },
    setPrefs(p) { pushPrefs = p; },
    setProfil(p, byId) { currentProfile = p; if (byId) playerById = byId; },
  };
`;

export function ladeEin() {
  return new Function(STUETZEN + TEILE.join('\n') + RUECK)();
}
