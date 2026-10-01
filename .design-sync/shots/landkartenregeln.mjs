/* Regeln der App-Landkarte (Paket L, Schritt L2) - ohne Browser.
   Hier steht, WAS als Ausloeser zaehlt und WORAN ein Zustand erkannt wird.
   landkarte.mjs faehrt damit die App ab; die Drift-Pruefung (L4) liest
   dieselbe Liste.                                                        */

/* ---- Auslöser ----------------------------------------------------------
   art      Name in der Landkarte
   sel      CSS-Selektor; bei nachWert der Attributname dahinter
   attr     Attribut, dessen Wert den Auslöser unterscheidet (nachWert)
   global   nur vom Startzustand aus verfolgen (Tabs, Zahnrad, 5. Tab)
   wert     nur diese Werte (z. B. Diagnose, nicht "App neu laden")
   vorher   erst dieses Element antippen (schaltet einen gesperrten
            Auslöser frei); der Auslöser zählt auch, solange er gesperrt ist */
export const AUSLOESER = [
  // Globale Navigation
  { art: 'tab',          sel: '#appNav .nav-btn[data-view]:not(#navMore)', attr: 'data-view', global: true },
  { art: 'tab5',         sel: '#navMore', global: true },
  { art: 'zahnrad',      sel: '#hdrGear', global: true },
  // Mehr-Menü (index.html)
  { art: 'mehr',         sel: '#moreSheet [data-view]', attr: 'data-view' },
  // Sprünge zwischen Ansichten
  { art: 'goto',         sel: '[data-goto]', attr: 'data-goto' },
  { art: 'view-jump',    sel: '[data-view-jump]', attr: 'data-view-jump' },
  { art: 'nav',          sel: '[data-nav]', attr: 'data-nav' },
  { art: 'task-pay',     sel: '[data-task-pay]' },
  { art: 'lineup-edit',  sel: '[data-lineup-edit]' },
  // Einstellungen
  { art: 'ein',          sel: '[data-ein]', attr: 'data-ein' },
  { art: 'ein-tat',      sel: '[data-ein-tat]', attr: 'data-ein-tat', wert: ['diagnose'] },
  { art: 'logout',       sel: '[data-logout]' },
  // Kasse
  { art: 'kstab',        sel: '[data-kstab]', attr: 'data-kstab' },
  { art: 'ks-wahl',      sel: '[data-ks-wahl]' },
  { art: 'ks-modus',     sel: '[data-ks-modus]', attr: 'data-ks-modus' },
  // "Weiter" ist gesperrt, bis ein Spieler gewählt ist: vorher den ersten
  // Spieler antippen (Formularschritt, kein eigener Knoten).
  { art: 'ks-weiter',    sel: '[data-ks-weiter]', vorher: '[data-ks-player]' },
  { art: 'ks-buchen',    sel: '[data-ks-buchen]' },
  { art: 'ks-det',       sel: '[data-ks-det]' },
  // Termine und Rückmeldungen
  { art: 'cal-sheet',    sel: '[data-cal-sheet]' },
  { art: 'rsvp-sheet',   sel: '[data-rsvp-sheet]' },
  { art: 'tkmenu',       sel: '[data-tkmenu]' },
  { art: 'termin-new',   sel: '[data-termin-new]' },
  { art: 'termin-edit',  sel: '[data-termin-edit]' },
  { art: 'kader-info',   sel: '[data-kader-info]' },
  { art: 'rs-teilen',    sel: '[data-rs-teilen]' },
  // Konto
  { art: 'paid-self',    sel: '[data-paid-self]' },
  // Aufstellung
  { art: 'tvgame',       sel: '[data-tvgame]' },
  { art: 'tvslot',       sel: '[data-tvslot]' },
  { art: 'tvbankadd',    sel: '[data-tvbankadd]' },
  { art: 'tvmoreform',   sel: '[data-tvmoreform]' },
  { art: 'tvmenu',       sel: '[data-tvmenu]' },
  // Vor der Anmeldung
  { art: 'auth',         sel: '[data-auth]', attr: 'data-auth' },
];

/* Überlagerungen, die einen eigenen Zustand ergeben.
   blatt: offen über die Klasse "open" (blattAuf/blattZu, app.js 2508ff.)
   sonst: offen, solange vorhanden, sichtbar und nicht [hidden].          */
export const UEBERLAGERUNGEN = [
  { id: 'moreSheet' }, { id: 'calSheet' }, { id: 'rsvpSheet' }, { id: 'tkMenu' },
  { id: 'terminModal' }, { id: 'scopeModal' }, { id: 'shareModal' }, { id: 'tvUnsaved' },
  { id: 'ksSeite' },
  { id: 'ksWahl', blatt: true }, { id: 'ksSheet', blatt: true }, { id: 'ksBl', blatt: true },
  { id: 'zmBl', blatt: true },
  { id: 'tvSheetKader', blatt: true }, { id: 'tvSheetForm', blatt: true }, { id: 'tvSheetMenu', blatt: true },
];

/* Läuft im Browser: liefert den Zustand der Seite.
   ansicht  Hash-Route, sonst aktiver Haupt-Tab, sonst Überschrift
   unter    Unterseite (#ein=, #strafe=, Kassen-Reiter, Login-Modus)
   oben     offene Überlagerungen in DOM-Reihenfolge                     */
export function zustandImBrowser(ueberlagerungen) {
  const slug = (s) => (s || '').toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const sichtbar = (el) => {
    if (!el || el.hidden) return false;
    const cs = getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden';
  };
  const h1 = document.querySelector('#view h1');
  const h1t = h1 ? h1.textContent.trim() : '';
  let ansicht = null, unter = null;

  const submit = document.querySelector('.auth-submit');
  const hash = location.hash || '';
  if (h1t === 'Diagnose') ansicht = 'diagnose';
  else if (submit) { ansicht = 'anmeldung'; unter = slug(submit.textContent); }
  else if (/^#ein=/.test(hash)) { ansicht = 'einstellungen'; unter = hash.slice(5); }
  else if (/^#strafe=/.test(hash)) { ansicht = 'kasse'; unter = 'strafe-' + hash.slice(8); }
  else if (/^#lineup=/.test(hash)) { ansicht = 'trainer'; unter = 'spiel'; }
  else {
    const tab = document.querySelector('#appNav .nav-btn.is-active[data-view]:not(#navMore)');
    if (tab) ansicht = tab.getAttribute('data-view');
    else if (h1t) ansicht = slug(h1t);
    else if (document.querySelector('.tv-wrap, [data-tvgame], [data-tvslot]')) ansicht = 'trainer';
  }
  if (ansicht === 'trainer' && !unter && document.querySelector('[data-tvslot]')) unter = 'spiel';

  const oben = [];
  for (const u of ueberlagerungen) {
    const el = document.getElementById(u.id);
    if (!el) continue;
    if (u.blatt ? el.classList.contains('open') : sichtbar(el)) oben.push(u.id);
  }
  // Kassen-Reiter nur ohne offenes Blatt: "Strafe verhängen" & Co. sind in
  // jedem Reiter dasselbe Blatt und sollen nicht dreifach auf der Karte stehen.
  if (ansicht === 'kasse' && !unter && !oben.length) {
    const r = document.querySelector('.ks-seg-b.is-on[data-kstab]');
    if (r) unter = r.getAttribute('data-kstab');
  }
  const ueberschrift = h1t || null;
  return { ansicht, unter, oben, ueberschrift, hash };
}

export function schluessel(z) {
  if (!z || !z.ansicht) return null;
  return z.ansicht + (z.unter ? '/' + z.unter : '') + (z.oben.length ? '+' + z.oben.join('+') : '');
}
