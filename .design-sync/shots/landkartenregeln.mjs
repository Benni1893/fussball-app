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
  { art: 'ks-spieler-w', sel: '[data-ks-open-players]' },
  // "Weiter" ist gesperrt, bis ein Spieler gewählt ist: vorher den ersten
  // Spieler antippen (Formularschritt, kein eigener Knoten).
  { art: 'ks-weiter',    sel: '[data-ks-weiter]', vorher: '[data-ks-player]' },
  { art: 'ks-spieler',   sel: '[data-ks-spieler]' },
  { art: 'ks-zmenu',     sel: '[data-ks-zmenu]' },
  { art: 'ks-det',       sel: '[data-ks-det]' },
  // Termine und Rückmeldungen
  { art: 'cal-sheet',    sel: '[data-cal-sheet]' },
  { art: 'rsvp-sheet',   sel: '[data-rsvp-sheet]' },
  { art: 'tkmenu',       sel: '[data-tkmenu]' },
  { art: 'termin-new',   sel: '[data-termin-new]' },
  { art: 'termin-edit',  sel: '[data-termin-edit]' },
  { art: 'kader-info',   sel: '[data-kader-info]' },
  { art: 'rs-teilen',    sel: '[data-rs-teilen]' },
  { art: 'rs-push',      sel: '[data-rs-push]' },
  { art: 'status-blatt', sel: '[data-status-blatt]' },
  { art: 'status-fenster', sel: '[data-status-fenster]' },   // Mein Status: Blatt Voraussichtlich bis (Nachschliff D4)
  { art: 'tvtplmenu',    sel: '[data-tvtplmenu]' },
  { art: 'tvfill',       sel: '[data-tvfill]' },
  // Konto
  { art: 'paid-self',    sel: '[data-paid-self]' },
  { art: 'kseg',         sel: '[data-kseg]', attr: 'data-kseg' },
  { art: 'pw-aendern',   sel: '[data-pw-aendern]' },
  // Katalog
  { art: 'kat-edit',     sel: '[data-kat-edit]' },
  { art: 'kat-add',      sel: '[data-kat-add]' },
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
  { id: 'terminModal' }, { id: 'scopeModal' }, { id: 'shareModal' }, { id: 'tvUnsaved' }, { id: 'pushModal' }, { id: 'statusBlatt' }, { id: 'tvTplMenu' }, { id: 'katBlatt' }, { id: 'ksZMenu' }, { id: 'pwBlatt' }, { id: 'statusFenster' },
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

  /* titel: die sichtbare Überschrift dessen, was oben liegt - im obersten
     Blatt die erste sichtbare Überschrift, bei Kassen-Reitern Ansicht und
     Reiter, sonst die h1. Quelle für den sprechenden Namen (knotenName). */
  const textVon = (e) => (e.textContent || '').replace(/\s+/g, ' ').trim();
  const ersteUeberschrift = (root) => {
    for (const e of root.querySelectorAll('h1, h2, h3, h4, [class*="title"], [class*="titel"], strong')) {
      if (!e.getClientRects().length) continue;
      const t = textVon(e);
      if (t && t.length <= 40) return t;
    }
    return null;
  };
  let titel = h1t || null;
  if (oben.length) titel = ersteUeberschrift(document.getElementById(oben[oben.length - 1]));
  else if (ansicht === 'kasse' && unter) {
    const r = document.querySelector('.ks-seg-b.is-on[data-kstab]');
    titel = h1t && r ? h1t + ' · ' + textVon(r) : titel;
  }
  return { ansicht, unter, oben, ueberschrift, titel, hash };
}

export function schluessel(z) {
  if (!z || !z.ansicht) return null;
  return z.ansicht + (z.unter ? '/' + z.unter : '') + (z.oben.length ? '+' + z.oben.join('+') : '');
}

/* ---- Stränge (L3b/L4) -------------------------------------------------
   Strang = Ansicht des Zustands. Sheets und Unterseiten gehören zur
   Ansicht darunter, das Mehr-Menü ist ein eigener Strang, native Dialoge
   gehören zur Ansicht, aus der sie kommen. Vor der Anmeldung: ein Strang. */
export const STRAENGE = {
  anmeldung: 'Anmeldung', uebersicht: 'Übersicht', mehr: 'Mehr', einstellungen: 'Einstellungen',
  kalender: 'Kalender', katalog: 'Katalog', konto: 'Konto', trainer: 'Trainer', kasse: 'Kasse',
  kader: 'Kader', profil: 'Profil', diagnose: 'Diagnose', 'push-nachrichten': 'Push-Nachrichten',
  'rollen-verwalten': 'Rollen verwalten',
};
const STRANG_DER_ANSICHT = { dashboard: 'uebersicht', strafen: 'konto' };

/* knoten: Liste eines Profils, kanten: dessen Kanten. Liefert schluessel -> Strang. */
export function straengeVon(profilName, knoten, kanten) {
  const nach = new Map(knoten.map((n) => [n.schluessel, n]));
  const roh = (n, tiefe = 0) => {
    if (profilName === 'anmeldung') return 'anmeldung';
    if (n.oben.includes('moreSheet')) return 'mehr';
    if (n.ansicht === 'dialog' && tiefe < 5) {
      const k = kanten.find((x) => x.nach === n.schluessel);
      if (k) return roh(nach.get(k.von), tiefe + 1);
    }
    return STRANG_DER_ANSICHT[n.ansicht] || n.ansicht;
  };
  return new Map(knoten.map((n) => [n.schluessel, roh(n)]));
}

/* ---- Sprechende Namen (L4) --------------------------------------------
   Bevorzugt aus der sichtbaren Überschrift (titel aus zustandImBrowser).
   Die Liste NAMEN gilt nur dort, wo die Überschrift fehlt, Testdaten
   enthält, einen Knoten im selben Strang nicht unterscheidet oder zu
   allgemein ist ("Strafe", "Mehr"); sie hat dann Vorrang. Neue Einträge
   nur für solche Fälle.                                                   */
export const NAMEN = {
  'dashboard': 'Übersicht',                                // h1 ist die Begrüßung
  'dialog:abmelden': 'Abmelden bestätigen',                // nativer Dialog, keine Überschrift
  'trainer/spiel': 'Aufstellung',                          // Aufstellung ohne Überschrift
  'kalender+tkMenu': 'Termin-Menü',                        // Überschrift ist der Termin (Testdaten)
  'dashboard+tkMenu': 'Termin-Menü',                       // Menü ··· am Termin-Hero (Final 01)
  'kalender+rsvpSheet+shareModal': 'Rückmeldungen teilen', // Überschrift wie das Blatt darunter
  'dashboard+rsvpSheet+shareModal': 'Rückmeldungen teilen',
  'kalender+rsvpSheet+pushModal': 'Push bestätigen',         // Bestätigung ohne eigene Überschrift (Final 04)
  'dashboard+rsvpSheet+pushModal': 'Push bestätigen',
  'kader+statusBlatt': 'Status ändern',
  'dashboard+statusFenster': 'Mein Status · Voraussichtlich bis',   // Überschrift ist der gewählte Status
  'einstellungen/profil+statusFenster': 'Mein Status · Voraussichtlich bis',
  'profil+statusFenster': 'Mein Status · Voraussichtlich bis',                     // Überschrift ist der Spielername (Testdaten)
  'trainer+rsvpSheet+pushModal': 'Push bestätigen',
  'trainer+rsvpSheet+shareModal': 'Rückmeldungen teilen',
  'trainer+tvTplMenu': 'Vorlagen-Menü',
  'einstellungen/profil': 'Profil',                         // Final 21: Unterseite ohne Seitentitel
  'einstellungen/profil+pwBlatt': 'Neues Passwort',
  'profil+pwBlatt': 'Neues Passwort',                     // Überschrift ist der Vorlagenname (Testdaten)
  'kasse+ksBl': 'Strafe buchen',                           // Überschrift nur "Strafe"
  'trainer/spiel+tvSheetMenu': 'Aufstellungs-Menü',        // Überschrift nur "Mehr"
};
const TESTDATEN = /Musterhausen|Beispielstadt|Probedorf|Testhausen/;
const DATUM = /\b\d{1,2}\.\s?(Jan|Feb|Mär|Apr|Mai|Jun|Jul|Aug|Sep|Okt|Nov|Dez)/;
const GRUSS = /^(Servus|Hallo|Hi|Moin|Guten (Morgen|Tag|Abend))\b/;

/* Überschrift ohne Zähler ("Offen 4" -> "Offen"); bei Blättern nur der
   erste Teil ("Kader-Info · vs. TSV …" -> "Kader-Info"). */
export function ausUeberschrift(n) {
  if (!n.titel) return null;
  let teile = n.titel.split(' · ').map((t) => t.replace(/\s+\d+$/, '').trim()).filter(Boolean);
  if (n.oben.length) teile = teile.slice(0, 1);
  return teile.join(' · ') || null;
}

/* Grund, warum name nicht sprechend ist, sonst null. */
export function nichtSprechend(name, n, strangName) {
  if (!name) return 'kein Name';
  if (name.length > 40) return 'zu lang';
  if (/^[a-z][a-z0-9]*[A-Z]/.test(name) || /^[a-z0-9]+(-[a-z0-9]+)*$/.test(name) || /^dialog:/.test(name)) return 'interner Bezeichner';
  if (GRUSS.test(name)) return 'Begrüßung';
  if (TESTDATEN.test(name) || DATUM.test(name)) return 'enthält Testdaten';
  if (n.oben.length && name === n.ueberschrift) return 'wie die Ansicht darunter';
  if (n.unter && name === strangName) return 'wie die Ansicht darunter';
  return null;
}

export function knotenName(n, strangName) {
  if (NAMEN[n.schluessel]) return { name: NAMEN[n.schluessel], quelle: 'liste' };
  const t = ausUeberschrift(n);
  if (t && !nichtSprechend(t, n, strangName)) return { name: t, quelle: 'ueberschrift' };
  return { name: null, quelle: null };
}

/* Befunde zu den Namen eines Profils: fehlend, nicht sprechend, doppelt im Strang. */
export function pruefeNamen(profilTitel, knoten) {
  const befunde = [], jeStrang = new Map();
  for (const n of knoten) {
    const grund = nichtSprechend(n.name, n, STRAENGE[n.strang]);
    if (grund) befunde.push(`${profilTitel}: ${n.schluessel} ohne sprechenden Namen (${grund}${n.titel ? ', Überschrift "' + n.titel + '"' : ''})`);
    const k = n.strang + '|' + n.name;
    if (n.name && jeStrang.has(k)) befunde.push(`${profilTitel}: Name "${n.name}" doppelt im Strang ${STRAENGE[n.strang] || n.strang} (${jeStrang.get(k)}, ${n.schluessel})`);
    else jeStrang.set(k, n.schluessel);
  }
  return befunde;
}
