/* Design-System-Karten "Ansichten" aus dem echten Markup der App (Paket
   "Final Alle Screens", Schritt 4, frueher F14).
   Jede Karte zeigt die Screens der Vorlage so, wie die App sie rendert: der
   Stand-in laedt den Vorlagen-Datensatz, finalscreens.mjs navigiert dorthin,
   das Markup wird abgegriffen. Klassen ohne eigene CSS-Regel (reine
   Klickanker) werden entfernt, damit validate.sh nur echte Bausteine sieht.
   Aufruf: node .design-sync/shots/kartenbau.mjs                            */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { starte } from './server.mjs';
import { installiere, warteAufApp } from './landkartenmodul.mjs';
import { SCREENS } from './finalscreens.mjs';
import { vorlageDaten, JETZT_VORLAGE } from './finaldaten.mjs';

const KARTEN = [
  ['Uebersicht', 'Übersicht', 'Termin-Hero, Heute zu tun, Mein Konto, Danach, Mein Status (Vorlage Final 01).', ['01 Übersicht']],
  ['Kalender', 'Kalender', 'Kopf mit „+ Termin“, Segment, Abo-Zeile, Terminkarten je Art; Blatt „Termin anlegen“ (Final 02, 03).', ['02 Kalender', '03 Termin anlegen']],
  ['Rueckmeldungen-Blatt', 'Rückmeldungen-Blatt', 'Balken, Kacheln Zu/Ab/Offen, Namensraster, Fuß mit Push senden, Teilen, Übersicht teilen (Final 04).', ['04 Rückmeldungen']],
  ['Trainer-Spielauswahl', 'Trainer · Spielauswahl', 'Nächstes Spiel, Kaderkarte, weitere Spiele, Vorlagen (Final 06).', ['06 Trainer']],
  ['Platzansicht', 'Platz und Bank', 'Platz, freie Position, Blätter „Spieler für die Position“ und „Spieler für die Bank“ (Final 07 bis 08).', ['07 Platz', '07b Platz frei', '07c Position besetzen', '08 Bank-Blatt']],
  ['Kader-und-Status', 'Kader und Status', 'Getönte Kennzahlen, Fällt aus, Einsatzbereit, Blatt „Status ändern“ (Final 09, 10).', ['09 Kader', '10 Status-Blatt']],
  ['Konto', 'Strafen-Konto', 'Segment Ich / Mannschaft, Kontobanner, Chips mit Anzahl, Listen (Final 11, 12).', ['11 Konto Ich', '12 Konto Mannschaft']],
  ['Kasse', 'Kasse', 'Stapel „Gemeldet“, Offen je Spieler, Blatt „Buchen“, Blatt „Strafe verhängen“ (Final 13 bis 16).', ['13 Kasse Gemeldet', '14 Kasse Offen', '15 Buchen', '16 Strafe verhängen']],
  ['Katalog', 'Strafenkatalog', 'Kacheln mit „›“, Bearbeiten im Blatt (Final 17).', ['17 Katalog']],
  ['Einstellungen-und-Profil', 'Einstellungen und Profil', 'Übersicht, Kalender abonnieren, Für Google, Profil, Spielplan BFV, Diagnose (Final 18, 20, 21, 24, 27, 28).', ['18 Einstellungen', '20 Kalender-Abo', 'E 28 Blatt · Anleitung Google', '21 Profil', 'E 24 Spielplan BFV', 'E 27 Diagnose']],
  ['Benachrichtigungen', 'Mitteilungen', 'Hauptschalter mit Gerät, Gruppen nach Thema (Final 19).', ['19 Mitteilungen']],
  ['Benachrichtigungs-Schalter', 'Ruhezeiten', 'Nachts stumm, Ausnahmen (Final 23).', ['E 23 Ruhezeiten']],
  ['Push-Katalog', 'Push-Texte', 'Gruppen nach Thema, Zeile mit Textvorlage (Final 25).', ['E 25 Push-Texte']],
];

const css = fs.readFileSync('styles.css', 'utf8');
const definiert = new Set((css.match(/\.[A-Za-z][A-Za-z0-9_-]*/g) || []).map((x) => x.slice(1)));
const SOLL = path.join('.design-sync', 'concepts', 'final-2026-10', 'soll');

function saeubere(html) {
  return html
    .replace(/ class="([^"]*)"/g, (m, k) => { const b = k.split(/\s+/).filter((c) => c && definiert.has(c)); return b.length ? ' class="' + b.join(' ') + '"' : ''; })
    .replace(/ data-[a-z0-9-]+(="[^"]*")?/g, '')
    .replace(/ (id|tabindex|aria-[a-z]+|role|style)="[^"]*"/g, (m, a) => (a === 'style' ? m : ''))
    .replace(/src="assets\//g, 'src="../../../assets/')
    .replace(/\n\s*\n/g, '\n');
}

const { server, basis } = await starte(process.cwd());
const browser = await chromium.launch();
for (const [datei, titel, text, screens] of KARTEN) {
  const teile = [];
  for (const name of screens) {
    const cfg = SCREENS[name];
    const soll = JSON.parse(fs.readFileSync(path.join(SOLL, name + '.json'), 'utf8'));
    const hoehe = cfg.hoehe || (soll.hoehe - 2);
    const ctx = await browser.newContext({ viewport: { width: 390, height: hoehe }, deviceScaleFactor: 1, isMobile: true, hasTouch: true,
      locale: 'de-DE', timezoneId: 'Europe/Berlin', serviceWorkers: 'block' });
    const page = await ctx.newPage();
    if (cfg.vorStart) await cfg.vorStart(page);
    await installiere(page, cfg.profil, cfg.landkartenDaten ? undefined : { daten: cfg.daten ? cfg.daten(vorlageDaten()) : vorlageDaten(), jetzt: JETZT_VORLAGE });
    await page.goto(basis, { waitUntil: 'networkidle' });
    await warteAufApp(page);
    if (cfg.vorbereitung) await cfg.vorbereitung(page);
    await page.waitForTimeout(cfg.warte || 400);
    const html = await page.evaluate((sel) => (sel ? document.querySelector(sel).outerHTML : document.getElementById('view').innerHTML), cfg.wurzel || null);
    const blatt = !!cfg.wurzel;
    teile.push(`  <div>
    <div class="sp-h">${name.replace(/^E /, '')}</div>
    <div class="frame${blatt ? ' frame-blatt' : ''}"${blatt ? ` style="height:${hoehe}px"` : ''}>
${saeubere(html)}
    </div>
  </div>`);
    await ctx.close();
  }
  const karte = `<!-- @dsCard group="Ansichten" -->
<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${titel}</title>
<link rel="stylesheet" href="../../../styles.css">
<style>
  /* Nur Geruest der Vorschaukarte - gehoert nicht zum Design-System. */
  body { padding: 0; min-height: 0; background: var(--bg-1); }
  .sp { padding: 20px; display: flex; flex-direction: column; gap: 18px; }
  .sp-h { font-size: .72rem; font-weight: 700; text-transform: uppercase; letter-spacing: .6px; color: var(--muted); margin-bottom: 8px; }
  .meta { font-size: .7rem; color: var(--muted); font-family: ui-monospace, Menlo, monospace; margin-top: 7px; line-height: 1.6; }
  .frame { width: 390px; max-width: 100%; padding: 20px 16px; background: var(--grad-app); border-radius: 12px; }
  /* Blaetter liegen in der App fest am Bildschirmrand; transform macht den Rahmen zum Bezug. */
  .frame-blatt { position: relative; padding: 0; overflow: hidden; transform: translateZ(0); }
</style>
</head>
<body>
<div class="sp">
  <div>
    <div class="sp-h">${titel}</div>
    <p class="meta">${text} Erzeugt aus dem Markup der App (kartenbau.mjs).</p>
  </div>
${teile.join('\n')}
</div>
</body>
</html>
`;
  fs.writeFileSync(path.join('.design-sync', 'cards', 'Ansichten', datei + '.html'), karte);
  console.log('Karte', datei, screens.length + ' Screens');
}
await browser.close(); server.close();
