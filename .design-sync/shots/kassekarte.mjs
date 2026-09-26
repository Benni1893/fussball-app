/* Schreibt die Vorschaukarte der Kasse. Das Markup kommt aus denselben
   Funktionen wie die App (kassemodul.mjs) - die Karte kann dadurch nicht
   auseinanderlaufen. Nur die Beispielwerte sind fest.

   Aufruf: node .design-sync/shots/kassekarte.mjs                            */
import fs from 'node:fs';
import { ladeKasse, SPIELER, SPIELER_BY_ID, beispielDaten, KATALOG } from './kassemodul.mjs';

const M = ladeKasse();
M.setDaten(SPIELER_BY_ID, { katalog: KATALOG, strafen: [], players: SPIELER });
/* Die Vorschaukarte zeigt eine gekuerzte Mannschaft: die vollen 140 offenen
   Strafen der Vorlage ergaeben eine Karte von ueber 2000 Zeilen, in der man
   nichts mehr wiederfindet. Die Zahlen in den Kacheln rechnen sich aus dieser
   kurzen Liste - sie sind also richtig, nur kleiner als im Entwurf. */
const ALLE = beispielDaten();
const DATEN = [
  ...ALLE.filter((s) => s.st === 'gemeldet'),
  ...ALLE.filter((s) => s.st === 'offen').slice(0, 4),
  ...ALLE.filter((s) => s.st === 'bestätigt').slice(0, 6),
];

function frisch() {
  M.kasse.tab = 'pruefen'; M.kasse.seite = null;
  M.kasse.bloecke = { katalog: false, indiv: false };
  M.kasse.players = []; M.kasse.items = {}; M.kasse.bezug = {}; M.kasse.indiv = [];
  M.kasse.indivBetrag = ''; M.kasse.indivGrund = ''; M.kasse.comment = '';
}
function reiter(tab) { frisch(); M.kasse.tab = tab; return M.kasseHtml(DATEN); }
function leer(tab)   { frisch(); M.kasse.tab = tab; return M.kasseHtml([]); }
function seiteHtml(modus) {
  frisch();
  M.kasse.seite = modus;
  M.kasse.bloecke = { katalog: modus === 'katalog', indiv: modus === 'indiv' };
  M.kasse.players = ['p1', 'p2', 'p4'];
  if (modus === 'katalog') M.kasse.items = { k1: { menge: 2 } };
  else M.kasse.indiv = [{ betrag: '7,50', grund: 'Trikot vergessen' }];
  const h = M.kasseHtml(DATEN);
  frisch();
  return h;
}

const s = DATEN.find((x) => x.id === "o1") || DATEN.find((x) => x.st === "offen");
const euro = (n) => n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }).replace(/\s/g, ' ');

const buchenBlatt =
  '<div class="ks-bl-sum"><div class="ks-bl-top"><span class="ks-bl-n">' + s.player.name + '</span>' +
  '<span class="ks-bl-b num">' + euro(s.betrag) + '</span></div>' +
  '<div class="ks-bl-s">' + s.vergehen + ' · ' + M.fmtKurz(s.datum) + '</div></div>' +
  '<div class="lbl ks-bl-lbl">Zahlart</div><div class="zart-row">' +
  M.KASSE_ZAHLARTEN.map(([k, label]) =>
    '<button type="button" class="zart' + (k === s.sagtZahlart ? ' is-on' : '') + '">' +
    M.zartIconHtml(k) + '<span>' + label + '</span></button>').join('') + '</div>' +
  '<div class="ks-bl-h">Vorausgewählt nach Angabe des Spielers.</div>' +
  '<button class="btn btn-primary ks-bl-cta">' + euro(s.betrag) + ' bar buchen</button>';

const detailBlatt =
  '<div class="ks-bl-sum"><div class="ks-bl-top"><span class="ks-bl-n">' + s.player.name + '</span>' +
  '<span class="ks-bl-b num">' + euro(s.betrag) + '</span></div>' +
  '<div class="ks-bl-s">' + s.vergehen + ' · ' + M.fmtKurz(s.datum) + '</div></div>' +
  M.ksSagtHtml(s) +
  '<div class="lbl ks-bl-lbl">Verlauf</div><div class="fine-hist-body">' +
  '<div class="hist-line">16.09.2026, 09:12 · angelegt → offen</div>' +
  '<div class="hist-line">22.09.2026, 18:42 · offen → gemeldet · bar</div></div>';

const waehler =
  '<div class="tv-sh"><strong>Strafe verhängen</strong>' +
  '<button class="tv-shx" aria-label="Schließen">&times;</button></div>' +
  '<div class="tv-shbody">' +
  '<button type="button" class="ks-wahl-b"><span class="ks-wahl-t">Strafe aus Katalog hinzufügen</span>' +
  '<span class="ks-wahl-s">Aus dem Strafenkatalog wählen, mit Menge oder Bezugsgröße.</span></button>' +
  '<button type="button" class="ks-wahl-b"><span class="ks-wahl-t">Individuelle Strafe</span>' +
  '<span class="ks-wahl-s">Freier Grund und freier Betrag.</span></button></div>' +
  '<div class="ks-wahl-f"><button type="button" class="btn">Schließen</button></div>';

const melden =
  '<div class="ks-bl-sum"><div class="ks-bl-top"><span class="ks-bl-n">Offener Betrag</span>' +
  '<span class="ks-bl-b num">128,50 €</span></div>' +
  '<div class="ks-bl-s">7 Strafen werden als gemeldet markiert.</div></div>' +
  '<div class="lbl ks-bl-lbl">Zahlart</div><div class="zart-row">' +
  M.KASSE_ZAHLARTEN.map(([k, label]) =>
    '<button type="button" class="zart' + (k === 'bar' ? ' is-on' : '') + '">' +
    M.zartIconHtml(k) + '<span>' + label + '</span></button>').join('') + '</div>' +
  '<div class="lbl ks-bl-lbl zm-lbl">Notiz <span class="zm-opt">freiwillig</span>' +
  '<span class="zm-zahl">23/140</span></div>' +
  '<textarea class="kasse-in zm-note" rows="2">zahle bar am Donnerstag</textarea>' +
  '<button class="btn btn-primary ks-bl-cta">Zahlung melden</button>';

function blatt(kopf, body, fuss = '') {
  return '<div class="blatt-demo"><div class="tv-sh"><span class="tv-grip"></span><strong>' + kopf +
    '</strong><button class="tv-shx" aria-label="Schließen">&times;</button></div>' +
    '<div class="tv-shbody">' + body + '</div>' + fuss + '</div>';
}

const HAKEN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
  'stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';

const PERSON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
  'stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.6"/>' +
  '<path d="M5.5 20c0-3.4 2.9-5.6 6.5-5.6s6.5 2.2 6.5 5.6"/></svg>';
const KREUZ = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
  'stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';

const auswahl = (gewaehlt) =>
  '<div class="tv-sh"><strong>Spieler auswählen</strong>' +
  '<button class="tv-shx" aria-label="Schließen">&times;</button></div>' +
  M.ksSuchfeldHtml('ksSuche', '', 'Suchen') +
  M.ksGewaehltChipsHtml(gewaehlt, 'data-weg') +
  '<div class="tv-shbody">' + M.ksSpielerZeilenHtml(gewaehlt, '', 'data-p') + '</div>' +
  '<div class="ks-fuss"><button type="button" class="btn btn-primary ks-fuss-btn"' +
  (gewaehlt.length ? '' : ' disabled') + '>' +
  (gewaehlt.length ? 'Weiter mit ' + gewaehlt.length + (gewaehlt.length === 1 ? ' Spieler' : ' Spielern') : 'Weiter') +
  '</button></div>';

const ANSICHTEN = [
  ['1 · Zu prüfen — genau eine Meldung im Blick', reiter('pruefen'),
   'Die Stapeltiefe trägt „1 von 3", nicht mehr Geisterkarten und Punkte. „Alle bestätigen" sitzt in der Karte, nicht darüber. Gewischt wird weiterhin.'],
  ['2 · Offen — eine Karte je Strafe', reiter('offen'),
   'Kein Avatar, keine Zustandsmarke: in diesem Reiter ist der Zustand immer derselbe. Der bernsteinfarbene Balken ist die Angabe des Spielers aus Migration 0040; er überlebt eine Ablehnung.'],
  ['3 · Eingegangen — eine Karte mit Zeilen', reiter('bezahlt'),
   'Zeilen statt Karten. Die Zahlart steht mit eigenem Symbol; PayPal trägt als einzige ihre Hausfarbe, weil es eine Marke ist.'],
  ['4 · Leer — je Reiter ein eigener Satz', leer('offen'),
   'Leer und „keine Treffer" sind zwei verschiedene Meldungen: die erste heißt, es gibt nichts, die zweite, der Filter greift.'],
  ['5 · Strafe verhängen: Katalog-Seite', '<div class="seite-demo">' + seiteHtml('katalog') + '</div>',
   'Eine eigene Seite, kein Abschnitt im Feed: ohne Kennzahlen, ohne Reiter, ohne untere Navigation. Kopf oben fest, Speichern unten fest mit Anzahl und Summe.'],
  ['9 · Strafe verhängen: Individuell-Seite', '<div class="seite-demo">' + seiteHtml('indiv') + '</div>',
   'Spiegelbildlich aufgebaut. Der Link unten holt den jeweils anderen Block dazu — gemischte Vorgänge bleiben in einem create_fines_batch.'],
];

const html = `<!-- @dsCard group="Ansichten" -->
<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Kasse</title>
<link rel="stylesheet" href="../../../styles.css">
<style>
  /* Nur Geruest der Vorschaukarte - gehoert nicht zum Design-System. */
  body { padding: 0; min-height: 0; background: var(--bg-1); }
  .sp { padding: 20px; display: flex; flex-direction: column; gap: 22px; }
  .sp-h { font-size: .72rem; font-weight: 700; text-transform: uppercase; letter-spacing: .6px; color: var(--muted); margin-bottom: 8px; }
  .meta { font-size: .7rem; color: var(--muted); font-family: ui-monospace, Menlo, monospace; margin-top: 7px; line-height: 1.6; }
  .frame { width: 390px; max-width: 100%; padding: 12px 16px 16px; background: var(--grad-app); border-radius: 12px; }
  /* Die Blaetter liegen in der App fest am unteren Rand. Fuer die Karte
     werden sie an Ort und Stelle gezeigt, sonst sieht man sie nicht. */
  .blatt-demo { background: var(--card); border-radius: 18px 18px 0 0; box-shadow: var(--shadow-sm); padding-bottom: 16px; }
  .blatt-demo .tv-sh { position: relative; }
  .blatt-demo .tv-shbody { padding: 0 16px; }
  .wahl-demo { background: var(--card); border-radius: 12px; height: 520px; display: flex; flex-direction: column; overflow: hidden; }
  .wahl-demo .tv-shbody { flex: 1 1 auto; display: flex; flex-direction: column; justify-content: center; gap: 14px; padding: 16px; }
  .wahl-demo .ks-wahl-b { flex: 1 1 0; max-height: 300px; }
  /* Die Eingabeseite liegt in der App ueber dem ganzen Bildschirm. */
  .seite-demo { position: relative; height: 620px; border-radius: 12px; overflow: hidden; }
  .seite-demo .ks-seite { position: absolute; }
  .seite-demo .ks-seite-kopf { padding-top: 12px; }
  .such-demo { background: var(--card); border-radius: 12px; height: 520px; display: flex; flex-direction: column; overflow: hidden; }
  .such-demo .tv-shbody { flex: 1 1 auto; }
</style>
</head>
<body>
<div class="sp">

  <div>
    <div class="sp-h">Was diese Ansicht trägt</div>
    <div class="card card-pad">
      <p class="rs">Die Kasse folgt <b>_neukasse.png</b>. Drei Kennzahlen, ein gefüllter grüner
      Knopf, die Überschrift „Prüfen und verbuchen", darunter eine Segmentleiste mit drei Reitern.
      Jeder Reiter hat einen eigenen Aufbau — Karte im Stapel, Karte je Strafe, Zeilen in einer Karte.</p>
      <p class="rs">Gebucht wird im <b>Blatt</b>, nicht in der Zeile: dort ist Platz für Zahlart mit
      Symbol und den Hinweis, was der Spieler angegeben hat. <b>Verlauf</b> und
      <b>Buchung rückgängig</b> stehen im Detail-Blatt, das ein Tipp auf die Karte öffnet —
      dadurch bleibt die Liste so ruhig wie in der Vorlage.</p>
    </div>
  </div>

${ANSICHTEN.map(([t, inhalt, m]) => `  <div>
    <div class="sp-h">${t}</div>
    <div class="frame">${inhalt}</div>
    <div class="meta">${m}</div>
  </div>
`).join('\n')}
  <div>
    <div class="sp-h">7 · Blatt „Als bezahlt buchen"</div>
    <div class="frame">${blatt('Als bezahlt buchen', buchenBlatt)}</div>
    <div class="meta">Die Zahlart ist nach der Angabe des Spielers vorbelegt; der Hinweis darunter sagt, warum. Der Knopf trägt Betrag und Zahlart, damit vor dem Tippen klar ist, was gebucht wird.</div>
  </div>

  <div>
    <div class="sp-h">8 · Detail-Blatt mit Verlauf</div>
    <div class="frame">${blatt('Strafe', detailBlatt)}</div>
    <div class="meta">Öffnet sich beim Tippen auf eine Karte. Bei einer bestätigten Zahlung steht hier zusätzlich „Buchung rückgängig".</div>
  </div>

  <div>
    <div class="sp-h">9 · Vollbild-Wähler „Strafe verhängen"</div>
    <div class="frame"><div class="wahl-demo ks-wahl">${waehler}</div></div>
    <div class="meta">Genau zwei Wege, gleich groß. Beide führen in dasselbe Formular, nur mit unterschiedlich vorbelegten Blöcken; ein Link dort holt den anderen dazu, damit gemischte Vorgänge möglich bleiben.</div>
  </div>

  <div>
    <div class="sp-h">10 · Danach sofort: Spieler auswählen</div>
    <div class="frame"><div class="such-demo ks-such">${auswahl([])}</div></div>
    <div class="meta">Ohne Spieler lässt sich nichts speichern, also fragt der Ablauf zuerst danach — kein zusätzlicher Tipp auf „Spieler auswählen". „Weiter" unten in Daumenreichweite, bei null gesperrt.</div>
  </div>

  <div>
    <div class="sp-h">11 · Drei gewählt</div>
    <div class="frame"><div class="such-demo ks-such">${auswahl(['p1', 'p2', 'p4'])}</div></div>
    <div class="meta">Die Gewählten stehen oben als Chips und sind dort einzeln abwählbar. Der Knopf trägt die Zahl.</div>
  </div>

  <div>
    <div class="sp-h">13 · Spieleransicht „Zahlung melden"</div>
    <div class="frame">${blatt('Zahlung melden', melden)}</div>
    <div class="meta">Die Gegenseite zum Buchen-Blatt: der Spieler sagt, wie er gezahlt hat, und darf einen Satz dazuschreiben. Beides landet in reported_method und reported_note und steht dem Kassenwart vor Augen.</div>
  </div>

</div>
</body>
</html>
`;

fs.writeFileSync('.design-sync/cards/Ansichten/Kasse.html', html);
console.log('Karte geschrieben, ' + html.split('\n').length + ' Zeilen');
