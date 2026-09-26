/* Kasse: Summen, Filter, Reiterzaehlungen, „Strafe verhaengen" und die
   Angabe des Spielers (Migration 0040). Die geprueften Funktionen kommen
   WOERTLICH aus app.js (kassemodul.mjs) - kein Nachbau.

   Aufruf: node .design-sync/shots/kassepruef.mjs                            */
import fs from 'node:fs';
import { ladeKasse, SPIELER, SPIELER_BY_ID, beispielDaten, KATALOG } from './kassemodul.mjs';

const fehler = [];
const pruefe = (ok, text, detail) => {
  console.log((ok ? '  ok   ' : '  FEHL ') + text + (detail !== undefined ? '   ' + detail : ''));
  if (!ok) fehler.push(text);
};
const gleich = (ist, soll, text) => {
  const ok = JSON.stringify(ist) === JSON.stringify(soll);
  pruefe(ok, text, ok ? undefined : 'erwartet ' + JSON.stringify(soll) + ', bekommen ' + JSON.stringify(ist));
};

const app = fs.readFileSync('app.js', 'utf8');
const db  = fs.readFileSync('db.js', 'utf8');
const css = fs.readFileSync('styles.css', 'utf8');

// Wie die App schreibt: das schmale Leerzeichen vor dem Euro wird ein normales.
const euroTxt = (n) => n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }).replace(/\s/g, ' ');

const M = ladeKasse();
M.setDaten(SPIELER_BY_ID, { katalog: KATALOG, strafen: [], players: SPIELER });
const DATEN = beispielDaten();
const frisch = () => {
  M.kasse.tab = 'pruefen'; M.kasse.seite = null;
  M.kasse.bloecke = { katalog: false, indiv: false };
  M.kasse.players = []; M.kasse.items = {}; M.kasse.bezug = {}; M.kasse.indiv = [];
  M.kasse.indivBetrag = ''; M.kasse.indivGrund = ''; M.kasse.comment = '';
};

/* ===== 1. Kennzahlen und Summen ========================================= */
console.log('--- Kennzahlen ---');
{
  frisch();
  const h = M.kasseHtml(DATEN);
  // Die Betraege der Vorlage _neukasse.png. Weichen sie ab, rechnet die
  // Kasse anders als der Entwurf - dann stimmt eine der beiden Seiten nicht.
  pruefe(h.includes('3.090,00 €'), 'Offen: 3.090,00 € wie in der Vorlage');
  pruefe(h.includes('36,00 €'),    'Gemeldet: 36,00 €');
  pruefe(h.includes('548,00 €'),   'Eingegangen: 548,00 €');
  pruefe(h.includes('>140 Strafen<'),  'Offen: 140 Strafen');
  pruefe(h.includes('>3 zu prüfen<'),  'Gemeldet: 3 zu prüfen');
  pruefe(h.includes('>31 Zahlungen<'), 'Eingegangen: 31 Zahlungen');
  // Die Kachel „Eingegangen" trug frueher „Saison" statt einer Zahl.
  pruefe(!h.includes('Saison'), 'keine Ersatzzeile „Saison" mehr');
  // Stornierte Strafen zaehlen nirgends mit.
  const mitStorno = DATEN.concat([{ ...DATEN[3], id: 'x1', st: 'storniert', betrag: 999 }]);
  pruefe(M.kasseHtml(mitStorno).includes('3.090,00 €'), 'storniert erhöht die Offen-Summe nicht');
}

console.log('--- Einzahl und Mehrzahl ---');
{
  frisch();
  const eine = DATEN.filter((s) => s.st === 'offen').slice(0, 1);
  const h1 = M.kasseHtml(eine);
  pruefe(h1.includes('>1 Strafe<'), 'eine Strafe, nicht „1 Strafen"');
  pruefe(h1.includes('>0 Zahlungen<'), 'null Zahlungen im Plural');
  const eineZ = DATEN.filter((s) => s.st === 'bestätigt').slice(0, 1);
  pruefe(M.kasseHtml(eineZ).includes('>1 Zahlung<'), 'eine Zahlung, nicht „1 Zahlungen"');
}

/* ===== 2. Reiter ======================================================== */
console.log('--- Reiterzählungen ---');
{
  frisch();
  const h = M.kasseHtml(DATEN);
  pruefe(/Zu prüfen <span class="ks-seg-n">3<\/span>/.test(h), 'Reiter „Zu prüfen" trägt 3');
  pruefe(/Offen <span class="ks-seg-n">140<\/span>/.test(h),    'Reiter „Offen" trägt 140');
  pruefe(/Eingegangen <span class="ks-seg-n">31<\/span>/.test(h), 'Reiter „Eingegangen" trägt 31');
  pruefe(!/\(\d+\)/.test(h.slice(h.indexOf('ks-seg'), h.indexOf('</div>', h.indexOf('ks-seg')))),
    'die Zahlen stehen ohne Klammern, wie in der Vorlage');
  // Der gewaehlte Reiter ist genau einer.
  const an = (h.match(/ks-seg-b is-on/g) || []).length;
  gleich(an, 1, 'genau ein Reiter ist gewählt');
  pruefe(h.includes('aria-selected="true"'), 'der gewählte Reiter meldet sich als gewählt');
}

console.log('--- Der Reiter entscheidet, was gezeigt wird ---');
{
  for (const [tab, drin, draussen] of [
    ['pruefen', 'ks-card', 'krow-list'],
    ['offen',   'krow-list', 'ks-card'],
    ['bezahlt', 'ks-ein-row', 'krow-list'],
  ]) {
    frisch(); M.kasse.tab = tab;
    const h = M.kasseHtml(DATEN);
    pruefe(h.includes(drin), tab + ': ' + drin + ' wird gerendert');
    pruefe(!h.includes(draussen), tab + ': ' + draussen + ' wird NICHT gerendert');
  }
}

/* ===== 3. Reihenfolge der Listen und die Namenssuche ==================== */
console.log('--- Keine Filter mehr ---');
{
  frisch();
  for (const tab of ['pruefen', 'offen', 'bezahlt']) {
    M.kasse.tab = tab;
    const h = M.kasseHtml(DATEN);
    pruefe(!h.includes('data-ks-fl-auf'), tab + ': keine Filterleiste');
    pruefe(!h.includes('ks-fl-chip'), tab + ': keine Filter-Chips');
    pruefe(!h.includes('ks-treffer'), tab + ': keine Zeile „x von y"');
  }
  // Auch im Quelltext ist nichts davon übrig.
  for (const rest of ['ksFilterNeu', 'ksFiltern(', 'ksFilterAnzahl', 'ksFilterChips',
                      'ksFilterleisteHtml', 'ksTrefferHtml', 'ksIstFaellig', 'ksImZeitraum',
                      'ksSaisonStart', 'kasse.filter', 'flEntwurf', 'ksFlRender', 'ksSuRender',
                      'data-ks-fl', 'KS_ZEIT', 'KS_FAELLIG_TAGE']) {
    pruefe(!app.includes(rest), 'app.js kennt „' + rest + '" nicht mehr');
  }
  for (const rest of ['.ks-fl-', '.ks-za', '.ks-treffer', '.is-hell', '.ks-wahlz']) {
    pruefe(!css.includes(rest), 'styles.css kennt „' + rest + '" nicht mehr');
  }
}

console.log('--- Feste Reihenfolge ---');
{
  gleich(M.KS_REIHENFOLGE, { offen: 'alt', bezahlt: 'neu' },
    'Offen älteste zuerst, Eingegangen neueste zuerst');

  const offen = DATEN.filter((s) => s.st === 'offen');
  const alt = M.ksSortieren(offen, 'alt', 'offen');
  pruefe(alt[0].datum <= alt[alt.length - 1].datum, 'Offen: aufsteigend nach Datum');
  gleich(alt[0].datum, Math.min(...offen.map((s) => s.datum)) === Infinity
    ? alt[0].datum : offen.map((s) => s.datum).sort()[0], 'die älteste Strafe steht oben');

  const bez = DATEN.filter((s) => s.st === 'bestätigt');
  const neu = M.ksSortieren(bez, 'neu', 'bezahlt');
  pruefe(String(neu[0].paidAt) >= String(neu[neu.length - 1].paidAt),
    'Eingegangen: absteigend nach Buchungsdatum');

  // Sortieren wirft nichts weg und verändert die Eingabe nicht.
  gleich(alt.length, offen.length, 'Sortieren verliert keine Zeile');
  const vorher = offen.map((s) => s.id).join();
  M.ksSortieren(offen, 'neu', 'offen');
  gleich(offen.map((s) => s.id).join(), vorher, 'die übergebene Liste bleibt unangetastet');

  // Gleiches Datum: der Name entscheidet, damit die Reihenfolge nicht springt.
  const gleichTag = [
    { datum: '2026-09-10', player: { name: 'Zeta Zulu' }, playerId: 'z' },
    { datum: '2026-09-10', player: { name: 'Alpha Anton' }, playerId: 'a' },
  ];
  gleich(M.ksSortieren(gleichTag, 'alt', 'offen').map((s) => s.playerId), ['a', 'z'],
    'bei gleichem Datum entscheidet der Name');

  // „Eingegangen" ordnet nach dem Buchungsdatum, nicht nach dem Strafendatum.
  gleich(M.ksBezugsdatum({ datum: '2026-01-01', paidAt: '2026-09-22T19:05:00Z' }, 'bezahlt'),
    '2026-09-22', 'Eingegangen: Buchungsdatum zählt');
  gleich(M.ksBezugsdatum({ datum: '2026-01-01', paidAt: '2026-09-22T19:05:00Z' }, 'offen'),
    '2026-01-01', 'Offen: Datum der Strafe zählt');
  gleich(M.ksBezugsdatum({ datum: '2026-01-01', paidAt: null }, 'bezahlt'),
    '2026-01-01', 'ohne Buchungsdatum fällt es auf das Strafendatum zurück');

  // Und die Liste in der Ansicht kommt in dieser Reihenfolge an.
  frisch(); M.kasse.tab = 'offen';
  const h = M.kasseHtml(DATEN);
  const daten = [...h.matchAll(/verhängt (\d{2})\.(\d{2})\.(\d{4})/g)]
    .map((m) => m[3] + m[2] + m[1]);
  pruefe(daten.length > 1 && daten[0] <= daten[1] && daten[0] <= daten[daten.length - 1],
    'die gerenderte Liste beginnt mit der ältesten Strafe', daten[0] + ' … ' + daten[daten.length - 1]);
  frisch();
}

console.log('--- Spielersuche (Spielerauswahl) ---');


{
  const liste = [
    { id: 'a', name: 'Lukas Müller' },
    { id: 'b', name: 'Jörg Weiß' },
    { id: 'c', name: 'Daniel Koch' },
    { id: 'd', name: 'Tobias Köhler' },
    { id: 'e', name: 'René Dupont' },
  ];
  const n = (q) => M.ksSpielerSuchen(liste, q).map((p) => p.id);

  gleich(n(''), ['a', 'b', 'c', 'd', 'e'], 'leere Frage zeigt alle');
  gleich(n('   '), ['a', 'b', 'c', 'd', 'e'], 'nur Leerzeichen ebenso');
  // Teilstrings, nicht nur Wortanfänge.
  gleich(n('och'), ['c'], 'Teilstring mitten im Wort');
  gleich(n('ko'), ['c', 'd'], 'ein Teilstring, zwei Treffer');
  gleich(n('koch'), ['c'], 'Nachname');
  gleich(n('daniel'), ['c'], 'Vorname');
  gleich(n('DANIEL'), ['c'], 'Großschreibung egal');
  // Umlaute in beide Richtungen.
  gleich(n('müller'), ['a'], 'mit Umlaut geschrieben');
  gleich(n('muller'), ['a'], 'ohne Umlaut geschrieben');
  gleich(n('köhler'), ['d'], 'ö mit Umlaut');
  gleich(n('kohler'), ['d'], 'ö ohne Umlaut');
  gleich(n('jorg'), ['b'], 'ö am Wortanfang ohne Umlaut');
  gleich(n('weiss'), ['b'], 'ß als ss');
  gleich(n('weiß'), ['b'], 'ß als ß');
  gleich(n('rene'), ['e'], 'Akzent ohne Akzent gesucht');
  gleich(n('rené'), ['e'], 'Akzent mit Akzent gesucht');
  gleich(n('gibtesnicht'), [], 'kein Treffer');

  // Die Normalisierung selbst.
  gleich(M.ksNorm('Müller'), 'muller', 'ä ö ü werden aufgelöst');
  gleich(M.ksNorm('Weiß'), 'weiss', 'ß wird ss');
  gleich(M.ksNorm('René'), 'rene', 'Akzente fallen weg');
  gleich(M.ksNorm(null), '', 'null ergibt leer, keinen Fehler');
}

console.log('--- Spielerliste im Blatt ---');
{
  const h = M.ksSpielerZeilenHtml(['p1'], '', 'data-ks-player');
  pruefe(h.includes('data-ks-player="p1"'), 'jede Zeile trägt ihre Kennung');
  pruefe(h.includes('is-sel'), 'der gewählte Spieler ist markiert');
  const leer = M.ksSpielerZeilenHtml([], 'zzzz', 'data-ks-player');
  pruefe(leer.includes('Kein Treffer'), 'ohne Treffer eine eigene Meldung');
  pruefe(!leer.includes('data-ks-player='), 'und keine Zeilen');
  // Mehrfachauswahl: zwei markierte Zeilen.
  const zwei = M.ksSpielerZeilenHtml(['p1', 'p2'], '', 'data-ks-player');
  gleich((zwei.match(/is-sel/g) || []).length, 2, 'Mehrfachauswahl ist möglich');
  // Chips der gewählten Spieler.
  const chips = M.ksGewaehltChipsHtml(['p1', 'p2'], 'data-ks-player-weg');
  pruefe(chips.includes('Lukas Weber') && chips.includes('Daniel Koch'), 'Chips nennen die Namen');
  gleich((chips.match(/data-ks-player-weg/g) || []).length, 2, 'jeder Chip ist einzeln abwählbar');
  gleich(M.ksGewaehltChipsHtml([], 'x'), '', 'ohne Auswahl keine Chipleiste');
  // Das Suchfeld.
  const feld = M.ksSuchfeldHtml('ksSuche', '', 'Name eingeben');
  pruefe(feld.includes('id="ksSuche"'), 'das Suchfeld trägt seine Kennung');
  pruefe(!feld.includes('ks-such-x'), 'leer: kein Kreuz zum Leeren');
  pruefe(M.ksSuchfeldHtml('ksSuche', 'ko', 'x').includes('ks-such-x'), 'gefüllt: Kreuz zum Leeren');
}

/* ===== 4. Leerzustaende ================================================= */
console.log('--- Leerzustände ---');
{
  for (const [tab, text] of [['pruefen', 'Nichts zu prüfen'], ['offen', 'Keine offenen Posten'],
                             ['bezahlt', 'Noch keine Zahlungen']]) {
    frisch(); M.kasse.tab = tab;
    const h = M.kasseHtml([]);
    pruefe(h.includes(text), tab + ': „' + text + '"');
    pruefe(h.includes('ks-leer'), tab + ': im Kartenstil, nicht als loser Text');
  }
  // Leer heisst nicht "keine Treffer" - das ist der Filterfall.
  frisch(); M.kasse.tab = 'offen';
  pruefe(!M.kasseHtml([]).includes('Keine Treffer'), 'leer und gefiltert sind zwei Meldungen');
}

/* ===== 5. Angabe des Spielers (0040) ==================================== */
console.log('--- Angabe des Spielers ---');
{
  const s = (o) => ({ betrag: 10, st: 'offen', datum: '2026-09-16', vergehen: 'X',
                      player: { name: 'A B' }, id: 'i', ...o });
  pruefe(M.ksSagtHtml(s({})) === '', 'ohne Angabe kein Balken');
  pruefe(M.ksSagtHtml(s({ sagtZahlart: 'bar', sagtNote: 'zahle bar am Donnerstag' }))
    .includes('Spieler: „zahle bar am Donnerstag"'), 'Notiz erscheint als Zitat');
  pruefe(M.ksSagtHtml(s({ sagtZahlart: 'paypal' })).includes('gezahlt per PayPal'),
    'nur Zahlart: eigener Wortlaut');
  pruefe(M.ksSagtHtml(s({ sagtZahlart: 'paypal' })).includes('is-pp'),
    'PayPal trägt seine Hausfarbe');
  // Fremder Text darf kein Markup einschleusen.
  const boes = M.ksSagtHtml(s({ sagtNote: '<img src=x onerror=alert(1)>' }));
  pruefe(!boes.includes('<img'), 'die Notiz wird maskiert');
  pruefe(boes.includes('&lt;img'), 'und erscheint als Text');

  // In „Zu prüfen": Zahlart und Meldezeitpunkt in einer Zeile, dann das Zitat.
  frisch(); M.kasse.tab = 'pruefen';
  const h = M.kasseHtml(DATEN);
  pruefe(h.includes('PayPal · gemeldet heute,'), 'Prüfkarte: Zahlart und Meldezeitpunkt');
  pruefe(h.includes('„Per PayPal an die Kasse geschickt."'), 'Prüfkarte: Zitat des Spielers');
  // Ohne Angabe bleibt die Zeile weg, statt leer zu stehen.
  const ohne = DATEN.filter((x) => x.st === 'gemeldet').map((x) => ({ ...x, sagtZahlart: null, sagtNote: null, gemeldetAm: null }));
  pruefe(!M.kasseHtml(ohne).includes('ks-meta'), 'ohne Angabe keine leere Zeile');

  // In „Offen" haengt der Balken an der Karte.
  frisch(); M.kasse.tab = 'offen';
  pruefe(M.kasseHtml(DATEN).includes('ks-sag'), 'Offen: Balken an der Karte');
  frisch();
}

/* ===== 6. Die Zeile im Reiter „Offen" =================================== */
console.log('--- Zeile „Offen" ---');
{
  const s = { id: 'o9', betrag: 10, st: 'offen', datum: '2026-09-16',
              vergehen: 'Zu spät zum Training', player: { name: 'Daniel Koch' } };
  const h = M.krowHtml(s);
  pruefe(h.includes('verhängt 16.09.2026'), 'Datum mit Jahr, Wort „verhängt"');
  pruefe(h.includes('Als bezahlt buchen'), 'Knopf heißt „Als bezahlt buchen"');
  pruefe(h.includes('data-kasse-cancel="o9"'), 'Storno ist da');
  pruefe(!h.includes('data-kasse-del'), 'kein Entfernen bei einer normalen Strafe');
  pruefe(!h.includes('avatar'), 'kein Avatar - die Vorlage zeigt keinen');
  pruefe(!h.includes('badge'), 'keine Zustandsmarke');
  pruefe(h.includes('data-ks-det="o9"'), 'die Karte öffnet das Detail-Blatt');
  pruefe(!h.includes('data-kasse-pay'), 'gebucht wird über das Blatt, nicht aus der Zeile');
  pruefe(!h.includes('zart-row'), 'keine Zahlart-Chips mehr in der Zeile');

  const auto = M.krowHtml({ ...s, auto: true });
  pruefe(auto.includes('data-kasse-del="o9"'), 'automatische Strafe: Entfernen statt Storno');
  pruefe(!auto.includes('data-kasse-cancel'), 'automatische Strafe: kein Storno');
  pruefe(auto.includes('· automatisch'), 'automatische Strafe ist als solche erkennbar');

  const abgelehnt = M.krowHtml({ ...s, ablehnGrund: 'Kein Eingang gefunden' });
  pruefe(abgelehnt.includes('Abgelehnt: Kein Eingang gefunden'), 'Ablehnungsgrund bleibt sichtbar');
}

/* ===== 7. „Strafe verhaengen": Waehler, Spielerauswahl, zwei Seiten ===== */
console.log('--- Strafe verhängen: der Weg dorthin ---');
{
  frisch();
  const zu = M.kasseHtml(DATEN);
  pruefe(zu.includes('data-ks-wahl'), 'auf der Startseite öffnet der Knopf den Wähler');
  pruefe(!zu.includes('ks-seite'), 'die Startseite zeigt keine Eingabeseite');
  pruefe(!zu.includes('kasse-catlist'), 'und keinen Katalog');
  // Die Seite haengt nicht mehr im Feed - kasseHtml zeigt immer die Liste.
  M.kasse.seite = 'katalog';
  pruefe(!M.kasseHtml(DATEN).includes('ks-seite'), 'auch mit offener Seite rendert kasseHtml den Feed');
  pruefe(M.kasseHtml(DATEN).includes('kpi-grid'), 'der Feed bleibt vollständig, er liegt nur darunter');
  frisch();
}

console.log('--- Der Wähler führt direkt in die Spielerauswahl ---');
{
  // Der Klickpfad im Waehler setzt kasse.wartet und oeffnet die Auswahl -
  // er setzt NICHT kasse.seite. Ohne Spieler gibt es nichts zu verlieren.
  const waehler = app.slice(app.indexOf('const m = ev.target.closest("[data-ks-modus]")'),
                            app.indexOf('function ksWahlOpen'));
  pruefe(waehler.includes('kasse.wartet = modus;'), 'der Wähler merkt sich den Weg');
  pruefe(waehler.includes('ksOpenPlayers();'), 'und öffnet sofort die Spielerauswahl');
  pruefe(!/kasse\.seite = modus/.test(waehler), 'die Seite wird dort noch nicht geöffnet');
  pruefe(waehler.includes('kasse.players = [];'), 'die Auswahl startet leer');

  // „Weiter" macht aus dem gemerkten Weg die Seite.
  const weiter = app.slice(app.indexOf('function ksWeiter()'), app.indexOf('function ksAbbruch()'));
  pruefe(weiter.includes('if (!kasse.players.length) return;'), 'ohne Spieler passiert nichts');
  pruefe(weiter.includes('kasse.seite = ziel;'), '„Weiter" öffnet die Seite');
  pruefe(weiter.includes('blattZu("ksScrim", "ksSheet")'), 'und schließt die Auswahl');

  // Das Kreuz bricht ab, solange nur die Auswahl lief.
  const ab = app.slice(app.indexOf('function ksAbbruch()'), app.indexOf('function ksClosePlayers()'));
  pruefe(ab.includes('kasse.wartet = null;') && ab.includes('kasse.players = [];'),
    'Abbruch aus dem Wähler heraus räumt auf');
}

console.log('--- Spielerauswahl: Knopf unten statt Fertig oben ---');
{
  frisch();
  const knopf = app.slice(app.indexOf('function ksWeiterText'), app.indexOf('function ksEnsureSheet'));
  pruefe(/data-ks-weiter/.test(knopf), 'der Knopf trägt data-ks-weiter');
  pruefe(/class="ks-fuss"/.test(knopf), 'er sitzt im gemeinsamen Fuß');
  pruefe(/n \? "" : " disabled"/.test(knopf), 'bei null Spielern ist er deaktiviert');
  pruefe(/"Weiter mit " \+ n/.test(knopf), 'und nennt die Zahl');
  pruefe(/n === 1 \? " Spieler" : " Spielern"/.test(knopf), 'Einzahl und Mehrzahl');
  // Oben rechts steht kein Fertig mehr.
  const render = app.slice(app.indexOf('function ksRenderPlayers()'), app.indexOf('function ksOpenPlayers()'));
  pruefe(!render.includes('data-ks-done'), 'kein „Fertig" oben rechts');
  pruefe(render.includes('data-ks-abbruch'), 'stattdessen ein Kreuz zum Abbrechen');
  pruefe(render.includes('ksWeiterKnopfHtml(kasse.players.length)'), 'der Fuß kennt die Zahl');
}

console.log('--- Suchfeld: keine Kontaktvorschläge ---');
{
  const feld = M.ksSuchfeldHtml('ksSuche', '', 'Suchen');
  for (const attr of ['type="search"', 'autocomplete="off"', 'autocorrect="off"',
                      'autocapitalize="off"', 'spellcheck="false"', 'enterkeyhint="search"',
                      'inputmode="search"']) {
    pruefe(feld.includes(attr), 'Suchfeld: ' + attr);
  }
  // iOS schliesst aus name, id, Platzhalter und Beschriftung auf ein Namensfeld.
  const verdaechtig = /name|kontakt|contact|user|benutzer|vorname|nachname/i;
  const name = (feld.match(/name="([^"]*)"/) || [])[1] || '';
  const id = (feld.match(/id="([^"]*)"/) || [])[1] || '';
  const platz = (feld.match(/placeholder="([^"]*)"/) || [])[1] || '';
  const aria = (feld.match(/aria-label="([^"]*)"/) || [])[1] || '';
  pruefe(!verdaechtig.test(name), 'name ohne verräterisches Wort', name);
  pruefe(!verdaechtig.test(id), 'id ohne verräterisches Wort', id);
  pruefe(!verdaechtig.test(platz), 'Platzhalter ohne „Name"', platz);
  pruefe(!verdaechtig.test(aria), 'Beschriftung ohne „Name"', aria);
  pruefe(feld.includes('data-1p-ignore'), 'auch Passwortmanager bleiben draußen');
  // Enter schliesst nur die Tastatur.
  const enter = app.slice(app.indexOf('function ksSuchEnter'), app.indexOf('function ksRenderPlayers'));
  pruefe(enter.includes('ev.preventDefault();') && enter.includes('ev.target.blur();'),
    'Enter schließt nur die Tastatur');
  // Abstand nach oben.
  pruefe(/\.ks-suchfeld \{[^}]*margin: 14px 16px 10px/.test(css), 'das Suchfeld klebt nicht mehr am Kopf');
}

console.log('--- Die Seite: was NICHT mehr drauf ist ---');
{
  for (const modus of ['katalog', 'indiv']) {
    frisch();
    M.kasse.seite = modus;
    M.kasse.bloecke = { katalog: modus === 'katalog', indiv: modus === 'indiv' };
    const h = M.ksSeiteHtml();
    pruefe(h.includes('class="ks-seite"'), modus + ': eigene Seite');
    pruefe(!h.includes('kpi-grid'), modus + ': keine Kennzahl-Kacheln');
    pruefe(!h.includes('Prüfen und verbuchen'), modus + ': keine Überschrift „Prüfen und verbuchen"');
    pruefe(!h.includes('ks-seg-b'), modus + ': keine Reiterleiste');
    pruefe(!h.includes('data-ks-fl-auf'), modus + ': keine Filterleiste');
    pruefe(!h.includes('krow-list') && !h.includes('ks-ein-row'), modus + ': keine Liste');
    pruefe(h.includes('data-ks-seite-zurueck'), modus + ': Zurück zur Auswahl');
    pruefe(h.includes('data-ks-seite-zu'), modus + ': Schließen zur Kasse');
    pruefe(h.includes('class="ks-fuss"'), modus + ': Speichern im gemeinsamen Fuß');
  }
  frisch();
}

console.log('--- Aufbau je Seite ---');
{
  frisch();
  M.kasse.seite = 'katalog'; M.kasse.bloecke = { katalog: true, indiv: false };
  const k = M.ksSeiteHtml();
  pruefe(k.includes('Strafe aus Katalog'), 'Katalog-Seite trägt ihren Titel');
  pruefe(k.includes('kasse-catlist'), 'Katalog-Seite: Katalogliste');
  pruefe(k.includes('data-kasse-catrow'), 'Katalog-Seite: Katalogzeilen zum Antippen');
  M.kasse.items = { k1: { menge: 2 } };
  const kMenge = M.ksSeiteHtml();
  pruefe(kMenge.includes('data-kasse-qty="k1"'), 'Katalog-Seite: Mengen-Plus/Minus an der gewählten Zeile');
  pruefe(kMenge.includes('>2×<'), 'Katalog-Seite: die Menge steht daneben');
  M.kasse.items = {};
  pruefe(!k.includes('data-kasse-indiv-add'), 'Katalog-Seite: kein Individuell-Block');
  pruefe(k.includes('data-ks-auch="indiv"'), 'Katalog-Seite: Link „Auch individuelle Strafe"');

  frisch();
  M.kasse.seite = 'indiv'; M.kasse.bloecke = { katalog: false, indiv: true };
  const i = M.ksSeiteHtml();
  pruefe(i.includes('Individuelle Strafe'), 'Individuell-Seite trägt ihren Titel');
  pruefe(i.includes('data-kasse-indiv-add'), 'Individuell-Seite: Betrag und Grund');
  pruefe(!i.includes('kasse-catlist'), 'Individuell-Seite: keine Katalogliste');
  pruefe(i.includes('data-ks-auch="katalog"'), 'Individuell-Seite: Link „Auch aus dem Katalog"');

  frisch();
  M.kasse.seite = 'indiv'; M.kasse.bloecke = { katalog: true, indiv: true };
  const b = M.ksSeiteHtml();
  pruefe(b.indexOf('Individuelle Strafe<') < b.indexOf('Aus dem Katalog'),
    'auf der Individuell-Seite steht der individuelle Block oben');
  pruefe(!b.includes('data-ks-auch'), 'sind beide Blöcke da, verschwindet der Link');

  for (const [name, h] of [['Katalog', k], ['Individuell', i]]) {
    pruefe(h.includes('data-ks-open-players'), name + ': Spieler ändern');
    pruefe(h.includes('data-kasse-date'), name + ': Datum');
    pruefe(h.includes('data-kasse-input="comment"'), name + ': Kommentar');
    pruefe(h.includes('id="kasseSummary"'), name + ': Zusammenfassung');
    pruefe(h.includes('data-kasse-add'), name + ': Speichern');
  }
  // Die gewaehlten Spieler stehen oben als Chips und sind antippbar.
  frisch();
  M.kasse.seite = 'katalog'; M.kasse.bloecke = { katalog: true, indiv: false };
  M.kasse.players = ['p1', 'p2'];
  const mitSpielern = M.ksSeiteHtml();
  pruefe(mitSpielern.includes('ks-gchip'), 'gewählte Spieler stehen als Chips');
  pruefe(mitSpielern.includes('Lukas Weber') && mitSpielern.includes('Daniel Koch'), 'mit Namen');
  pruefe(mitSpielern.includes('2 Spieler gewählt'), 'die Zeile darüber nennt die Zahl');
  frisch();
}

console.log('--- Der Speichern-Knopf ---');
{
  frisch();
  M.kasse.seite = 'katalog'; M.kasse.bloecke = { katalog: true, indiv: false };
  let h = M.ksSeiteHtml();
  pruefe(/data-kasse-add disabled/.test(h), 'ohne alles deaktiviert');
  pruefe(h.includes('>Strafe speichern<'), 'und trägt den schlichten Text');

  M.kasse.players = ['p1', 'p2', 'p3'];
  pruefe(/data-kasse-add disabled/.test(M.ksSeiteHtml()), 'nur Spieler: noch deaktiviert');

  M.kasse.players = []; M.kasse.items = { k1: { menge: 1 } };
  pruefe(/data-kasse-add disabled/.test(M.ksSeiteHtml()), 'nur Strafe: noch deaktiviert');

  M.kasse.players = ['p1', 'p2', 'p3'];
  h = M.ksSeiteHtml();
  pruefe(!/data-kasse-add disabled/.test(h), 'Spieler und Strafe: aktiv');
  pruefe(h.includes('3 Strafen · 15,00 € speichern'), 'Knopf nennt Anzahl und Summe');

  M.kasse.items = { k1: { menge: 1 }, k2: { menge: 1 } };
  pruefe(M.ksSeiteHtml().includes('6 Strafen · 45,00 € speichern'), '3 Spieler × 2 Strafen = 6 Einträge');

  M.kasse.players = ['p1']; M.kasse.items = { k1: { menge: 1 } };
  pruefe(M.ksSeiteHtml().includes('1 Strafe · 5,00 € speichern'), 'eine Strafe im Singular');
  frisch();
}

console.log('--- Nachfragen beim Verlassen ---');
{
  frisch();
  M.kasse.seite = 'katalog';
  pruefe(!M.ksSeiteBeruehrt(), 'leere Seite: keine Nachfrage nötig');
  M.kasse.players = ['p1'];
  pruefe(M.ksSeiteBeruehrt(), 'gewählter Spieler zählt als Eingabe');
  frisch(); M.kasse.seite = 'katalog'; M.kasse.items = { k1: { menge: 1 } };
  pruefe(M.ksSeiteBeruehrt(), 'gewählte Katalogstrafe zählt');
  frisch(); M.kasse.seite = 'indiv'; M.kasse.indivGrund = 'Trikot vergessen';
  pruefe(M.ksSeiteBeruehrt(), 'angefangener Grund zählt');
  frisch(); M.kasse.seite = 'indiv'; M.kasse.comment = 'nach dem Spiel';
  pruefe(M.ksSeiteBeruehrt(), 'angefangener Kommentar zählt');
  frisch(); M.kasse.seite = 'katalog'; M.kasse.comment = '   ';
  pruefe(!M.ksSeiteBeruehrt(), 'nur Leerzeichen zählen nicht');
  frisch();
}

console.log('--- Der Vorgang rechnet weiter wie bisher ---');
{
  frisch();
  M.kasse.players = ['p1', 'p2'];
  M.kasse.items = { k1: { menge: 2 } };
  M.kasse.indiv = [{ betrag: '7,50', grund: 'Trikot vergessen' }];
  const b = M.kasseBuild();
  gleich(b.lines.length, 2, 'zwei Zeilen: Katalog und frei');
  gleich(b.proSpieler, 17.5, 'je Spieler 2×5 + 7,50 = 17,50');
  gleich(b.total, 35, 'zwei Spieler: 35,00');
  gleich(b.entries, 4, 'vier Einträge');
  pruefe(b.valid, 'der Vorgang ist gültig');
  pruefe(b.lines[0].offense === 'Zu spät zum Training ×2', 'die Menge steht im Text-Schnappschuss');

  M.kasse.items = { k4: { menge: 1 } };
  M.kasse.indiv = [];
  pruefe(M.kasseBuild().incomplete, 'Staffel ohne Bezugsgröße: unvollständig');
  pruefe(!M.kasseBuild().valid, 'und damit nicht speicherbar');
  M.kasse.bezug = { k4: '7' };
  gleich(M.kasseBuild().proSpieler, 14, 'Staffel: 7 Stunden × 2,00 = 14,00');
  M.kasse.bezug = { k4: '30' };
  gleich(M.kasseBuild().proSpieler, 20, 'Staffel: Deckel bei 20,00 greift');

  M.kasse.players = [];
  pruefe(!M.kasseBuild().valid, 'ohne Spieler nicht speicherbar');
  frisch();
}

console.log('--- Pull-to-Refresh und Neuladen ---');
{
  // Die Seite haengt an <body>, nicht in #view. Genau das war die Ursache:
  // Pull-to-Refresh setzt einen transform auf den Container, und ein
  // transformierter Vorfahre macht aus position:fixed etwas anderes.
  pruefe(/host\.id = "ksSeite";/.test(app) && /document\.body\.appendChild\(host\)/.test(app),
    'die Eingabeseite hängt an <body>');
  pruefe(!/viewEl\.innerHTML = ksSeiteHtml/.test(app), 'sie wird nicht mehr in #view gerendert');
  pruefe(/container\.style\.transform = "translateY\("/.test(app),
    'Pull-to-Refresh verschiebt weiterhin den Container (das war die Ursache)');
  pruefe(/#ksSeite:not\(\[hidden\]\)/.test(
    app.slice(app.indexOf('function ueberlagerungOffen'), app.indexOf('function sheetSwipeToClose'))),
    'und wird blockiert, solange die Seite offen ist');
  pruefe(/#ksSheet\.open/.test(
    app.slice(app.indexOf('function ueberlagerungOffen'), app.indexOf('function sheetSwipeToClose'))),
    'ebenso bei offener Spielerauswahl');
  // Kein Gummiband nach aussen.
  pruefe(/body\.blatt-offen, body\.ks-seite-offen \{ overscroll-behavior-y: contain; \}/.test(css),
    'CSS: overscroll-behavior-y contain auf dem body');
  pruefe(/\.tv-kfull \.tv-shbody, \.ks-seite-body \{ overscroll-behavior-y: contain; \}/.test(css),
    'CSS: und auf den Scrollbereichen');

  // Der Zustand steht im Hash, damit ein Neuladen sauber landet.
  pruefe(/art === "strafe" && \["katalog", "individuell"\]/.test(app), 'Deep Link strafe= ist bekannt');
  pruefe(/"#strafe=" \+ \(modus === "indiv" \? "individuell" : "katalog"\)/.test(app),
    'die offene Seite schreibt ihren Hash');
  pruefe(/history\.replaceState/.test(app.slice(app.indexOf('function ksSeiteHash'), app.indexOf('function ksSeiteKnopf'))),
    'per replaceState - die Zurück-Taste bleibt sauber');
  const route = app.slice(app.indexOf('if (ziel.art === "strafe")'), app.indexOf('deepLinkHashWeg();\n    if (ziel.art === "ansicht")'));
  pruefe(route.includes('ksSeiteLeeren();'), 'nach dem Neuladen startet die Seite leer');
  pruefe(route.includes('Roles.canManageFines()'), 'und nur, wenn die Rolle es darf');

  // Ein Hintergrund-Neuladen darf das Formular nicht neu zeichnen.
  const sync = app.slice(app.indexOf('function ksSeiteSync'), app.indexOf('function ksSeiteHash'));
  pruefe(sync.includes('if (h.hidden || !h.firstChild)'),
    'renderKasse zeichnet die Seite nur, wenn noch nichts da ist');
  const rk = app.slice(app.indexOf('function renderKasse()'), app.indexOf('const KS_TABS'));
  pruefe(rk.includes('ksSeiteSync();') && !rk.includes('ksSeiteZeichnen();'),
    'renderKasse ruft nur den Abgleich, nie das Neuzeichnen');
}


/* ===== 8. Datumsformate ================================================= */
console.log('--- Datumsformate ---');
{
  gleich(M.fmtPunkt('2026-09-16'), '16.09.2026', 'verhängt-Datum mit Jahr');
  gleich(M.fmtPunkt('2026-01-05'), '05.01.2026', 'führende Nullen');
  gleich(M.fmtKurz('2026-09-22'), '22.09.', 'kurze Form');
  const heute = new Date(); heute.setHours(18, 42, 0, 0);
  pruefe(M.fmtGemeldet(heute.toISOString()).startsWith('heute, '), 'heute wird als „heute" geschrieben');
  const gestern = new Date(heute.getTime() - 86400000);
  pruefe(M.fmtGemeldet(gestern.toISOString()).startsWith('gestern, '), 'gestern als „gestern"');
  const alt = new Date(heute.getTime() - 5 * 86400000);
  pruefe(/^\d{2}\.\d{2}\., \d{2}:\d{2}$/.test(M.fmtGemeldet(alt.toISOString())), 'älter: Datum und Uhrzeit');
  gleich(M.fmtGemeldet('quatsch'), '', 'unlesbarer Zeitstempel ergibt nichts, keinen Fehler');
}

/* ===== 9. Schreibpfade: was NICHT passieren darf ======================== */
console.log('--- Schreibpfade ---');
{
  // Die Statuswechsel laufen weiter ueber dieselben RPCs.
  for (const rpc of ['confirmFines', 'markFinesPaid', 'rejectFine', 'cancelFine',
                     'deleteFine', 'setFinePaid', 'createFinesBatch']) {
    pruefe(app.includes('DB.' + rpc + '('), 'DB.' + rpc + ' wird weiter benutzt');
  }
  /* Der alte Fehler: jede Bestaetigung wurde fest als „paypal" gebucht, egal
     was der Spieler gesagt hatte. PayPal ist jetzt wieder der Wert - aber als
     RUECKFALL hinter der Angabe des Spielers, nicht als fester Wert. Genau
     das wird hier unterschieden. */
  pruefe(/confirmFines\(\[conf\.dataset\.kasseConfirm\], \(s && s\.sagtZahlart\) \|\| "paypal"\)/.test(app),
    'einzeln bestätigen bucht die Angabe des Spielers, sonst PayPal');
  pruefe(!/confirmFines\(\s*\[[^\]]*\]\s*,\s*"[a-z]+"\s*\)/.test(app),
    'nirgends eine fest verdrahtete Zahlart beim Bestätigen');
  pruefe(/nachArt\[a\] = nachArt\[a\] \|\| \[\]/.test(app),
    '„Alle bestätigen" gruppiert nach Zahlart statt alle gleich zu buchen');

  // 0040 aendert die Meldefunktion, nicht die Kassen-RPCs.
  const sql = fs.readFileSync('supabase/migrations/0040_zahlungsangabe_spieler.sql', 'utf8');
  for (const f of ['confirm_fines', 'mark_fines_paid', 'reject_fine', 'create_fines_batch',
                   'cancel_fine', 'cancel_batch']) {
    pruefe(!new RegExp('function public\\.' + f).test(sql), '0040 fasst ' + f + ' nicht an');
  }
  pruefe(/reported_method/.test(sql) && /reported_note/.test(sql), '0040 legt beide Spalten an');
  pruefe(/p_method not in \('bar','ueberweisung','paypal'\)/.test(sql), '0040 prüft die Zahlart');
  pruefe(/length\(v_note\) > 140/.test(sql), '0040 begrenzt die Notiz auf 140 Zeichen');
  pruefe(/pronargs = 0/.test(sql), '0040 sichert die alte Signatur ab');

  // Der Client ruft die neue Signatur auf - und die alte nirgends mehr.
  pruefe(/p_method: method, p_note: note \|\| null/.test(db), 'db.js übergibt Zahlart und Notiz');
  pruefe(/DB\.reportMyPayment\(zm\.zahlart, zm\.note\.trim\(\) \|\| null\)/.test(app),
    'app.js ruft mit beiden Werten auf');
  const ohneArg = [...app.matchAll(/reportMyPayment\(\s*\)/g)].length
                + [...db.matchAll(/rpc\("report_my_payment"\)/g)].length;
  gleich(ohneArg, 0, 'die argumentlose Signatur wird nirgends mehr aufgerufen');

  // Push-Ausloeser und Outbox bleiben unberuehrt.
  pruefe(!/notification_outbox|notification_due|dispatch/.test(sql), '0040 rührt die Outbox nicht an');
}

/* ===== 10. Bauteile und Namen ========================================== */
console.log('--- Bauteile ---');
{
  // Jede in der Kasse benutzte Klasse muss eine Regel haben.
  frisch();
  const seiten = [];
  for (const tab of ['pruefen', 'offen', 'bezahlt']) {
    M.kasse.tab = tab; seiten.push(M.kasseHtml(DATEN)); seiten.push(M.kasseHtml([]));
  }
  M.kasse.formOpen = true; M.kasse.bloecke = { katalog: true, indiv: true };
  seiten.push(M.kasseHtml(DATEN));
  frisch();
  const benutzt = new Set();
  for (const h of seiten) {
    for (const m of h.matchAll(/class="([^"]+)"/g)) m[1].split(/\s+/).forEach((c) => c && benutzt.add(c));
  }
  /* Drei Klassen tragen bewusst keine eigene Regel: sie erben vom
     Elternelement und stehen nur als Haken im Markup. Dieselbe Liste fuehrt
     validate.sh unter BEKANNT_UNGESTYLT - beide muessen zusammenpassen. */
  const OHNE_REGEL = ['ks-pane', 'kasse-picker-txt', 'kasse-catlist', 'ks-plist'];
  const fehlend = [...benutzt]
    .filter((c) => OHNE_REGEL.indexOf(c) < 0)
    .filter((c) => !new RegExp('\\.' + c.replace(/[-]/g, '\\-') + '[\\s,.:{\\[]').test(css));
  pruefe(fehlend.length === 0, 'jede benutzte Klasse hat eine CSS-Regel', fehlend.join(', ') || undefined);
  const vs = fs.readFileSync('.design-sync/validate.sh', 'utf8');
  for (const c of OHNE_REGEL) {
    if (c === 'ks-pane') pruefe(vs.includes(c), c + ' steht auch in validate.sh');
  }

  // Trefferflaechen: was angetippt wird, ist gross genug.
  pruefe(/\.ks-seg-b \{[^}]*min-height: 44px/.test(css), 'Reiter 44 px');
  pruefe(/\.ks-ein-row \{[^}]*padding: 13px 16px/.test(css),
    'Zeile „Eingegangen": 16 waagerecht wie der Karten-Standard, 13 senkrecht über 32 px Kreis = 58');
  pruefe(/\.ks-ein-row \{[^}]*gap: 12px/.test(css),
    'und 12 px zwischen Kreis und Text - das Maß aller Avatarzeilen');
  pruefe(/\.zart \{[^}]*min-height: 64px/.test(css), 'Zahlart-Chips 64 px (Symbol über dem Text)');
  pruefe(/\.ks-such-in \{[^}]*min-height: var\(--h-in\)/.test(css), 'Suchfeld 46 px');
  pruefe(/\.ks-such-in \{[^}]*font-size: var\(--fs-input\)/.test(css),
    'Suchfeld mit 16px - sonst zoomt Safari beim Fokus');
  pruefe(/\.ks-neu \{[^}]*min-height: 52px/.test(css), '„Strafe verhängen" 52 px');
  pruefe(/\.ks-wahl-b \{[^}]*min-height: 120px/.test(css), 'die zwei Wege sind große Flächen');

  // Die abgeschafften Bauteile sind auch aus dem Stylesheet verschwunden.
  for (const tot of ['ks-ghost', 'ks-dots', 'ks-cap', 'krow-tun', 'krow-buchen',
                     'kasse-filter', 'kasse-toggle', 'krow-head', 'krow-right']) {
    pruefe(!css.includes('.' + tot + ' '), 'keine Regel mehr für .' + tot);
    pruefe(!app.includes('"' + tot), 'kein Markup mehr für .' + tot);
  }
}

/* ===== 11. Deep Links bleiben ========================================== */
console.log('--- Deep Links ---');
{
  pruefe(/art === "kasse" && \["pruefen", "offen", "bezahlt"\]/.test(app), 'die drei Reiter sind weiter erreichbar');
  pruefe(/kasse\.tab = ziel\.wert/.test(app), 'der Deep Link setzt den Reiter');
}

/* ===== 12. Blaetter: Scroll-Sperre und Navigation ====================== */
console.log('--- Blätter gehen alle durch dieselbe Steuerung ---');
{
  // Kein Blatt darf die Klasse "open" noch selbst setzen - sonst laeuft die
  // Scroll-Sperre an ihm vorbei und der Feed scrollt darunter weiter.
  // Ab dem Kommentarkopf der Steuerung - er nennt die Klasse selbst.
  const vonSteuerung = app.indexOf('Blatt-Steuerung: EIN Weg');
  const bisSteuerung = app.indexOf('function blattAlleZu');
  const selbst = [...app.matchAll(/classList\.(add|remove)\("open"\)/g)];
  const draussen = selbst.filter((m) => m.index < vonSteuerung || m.index > bisSteuerung);
  pruefe(draussen.length === 0, 'kein Blatt setzt "open" an der Steuerung vorbei',
    draussen.length ? draussen.length + ' Stellen' : undefined);
  pruefe(selbst.length > 0, 'die Steuerung selbst setzt sie');

  // Jedes bekannte Blatt haengt an blattAuf/blattZu.
  const BLAETTER = [
    ['luScrim', 'luPanel', 'Aufstellung: Spieler'],
    ['luMoreScrim', 'luMore', 'Aufstellung: Mehr'],
    ['tvScrimKader', 'tvSheetKader', 'Trainer: Kaderauswahl'],
    ['tvScrimForm', 'tvSheetForm', 'Trainer: Formation'],
    ['tvScrimMenu', 'tvSheetMenu', 'Trainer: Mehr'],
    ['ksScrim', 'ksSheet', 'Kasse: Spieler auswählen'],
    ['ksWahlScrim', 'ksWahl', 'Kasse: Wähler'],
    ['ksBlScrim', 'ksBl', 'Kasse: buchen und Detail'],
    ['zmScrim', 'zmBl', 'Spieler: Zahlung melden'],
  ];
  for (const [scrim, sheet, name] of BLAETTER) {
    pruefe(app.includes('blattAuf("' + scrim + '", "' + sheet + '")'), name + ': öffnet über blattAuf');
    pruefe(app.includes('blattZu("' + scrim + '", "' + sheet + '")'), name + ': schließt über blattZu');
  }

  // Die Steuerung sperrt und entsperrt.
  const auf = app.slice(app.indexOf('function blattAuf'), app.indexOf('function blattZu'));
  const zu  = app.slice(app.indexOf('function blattZu'), app.indexOf('function blattAlleZu'));
  pruefe(auf.includes('lockBodyScroll();'), 'blattAuf sperrt den Hintergrund');
  pruefe(zu.includes('unlockBodyScroll();'), 'blattZu gibt ihn frei');
  pruefe(zu.includes('if (!war) return;'), 'blattZu zählt nur, wenn wirklich etwas offen war');
  pruefe(auf.includes('document.body.classList.add("blatt-offen")'), 'die Navigation wird ausgeblendet');
  pruefe(zu.includes('if (!BLATT_STAPEL.length) document.body.classList.remove("blatt-offen")'),
    'und kommt erst zurück, wenn das letzte Blatt zu ist');
  // Die Sperre selbst: body fixieren statt overflow:hidden - sonst scrollt
  // iOS im Standalone-Modus weiter.
  const sperre = app.slice(app.indexOf('function lockBodyScroll'), app.indexOf('function blattAuf'));
  pruefe(sperre.includes('b.position = "fixed"'), 'die Sperre fixiert den body');
  pruefe(sperre.includes('_scrollLockY = window.scrollY'), 'und merkt sich die Scrollposition');
  pruefe(sperre.includes('window.scrollTo(0, _scrollLockY)'), 'und stellt sie beim Schließen wieder her');
  pruefe(sperre.includes('if (_scrollLocks++ > 0) return;'), 'verschachtelte Blätter zählen mit');
  pruefe(app.includes('blattAlleZu();'), 'beim Ansichtswechsel geht alles zu');

  // CSS dazu.
  const navWeg = css.slice(css.indexOf('body.blatt-offen .app-nav'),
                           css.indexOf('body.blatt-offen .tv-toast'));
  pruefe(navWeg.includes('translateY(110%)'), 'CSS: die Leiste fährt weg');
  pruefe(navWeg.includes('pointer-events: none'), 'CSS: und ist nicht antippbar');
  pruefe(navWeg.includes('visibility: hidden'), 'CSS: und ist auch für Screenreader weg');
  pruefe(/\.tv-shbody \{[^}]*overscroll-behavior: contain/.test(css),
    'CSS: Scrollen im Blatt schlägt nicht auf den Hintergrund durch');
  pruefe(/\.ks-seite-body \{[^}]*overscroll-behavior: contain/.test(css),
    'CSS: dasselbe auf der Eingabeseite');
  pruefe(/\.tv-sheet \{[^}]*bottom: 0;/.test(css), 'CSS: das Blatt sitzt am unteren Rand');
  pruefe(css.includes('body.ks-seite-offen .app-nav'), 'CSS: auch die Eingabeseite blendet die Leiste aus');
}

console.log('--- Zahlart: Reihenfolge und Beschriftung ---');
{
  gleich(M.KASSE_ZAHLARTEN.map((x) => x[0]), ['paypal', 'bar', 'ueberweisung'],
    'PayPal links, Bar Mitte, Überweisung rechts');
  gleich(M.KASSE_ZAHLARTEN.map((x) => x[1]), ['PayPal', 'Bar', 'Überweisung'],
    'die Beschriftung bleibt ungekürzt - „Überweisung" passt in ein Drittel');
  // In Listen und im Verlauf steht weiterhin das lange, kleingeschriebene Wort.
  gleich(M.ZAHLART_LABEL.bar, 'bar', 'die Liste schreibt „bar" klein');
  gleich(M.ZAHLART_LABEL.ueberweisung, 'Überweisung', 'und „Überweisung" aus');
  pruefe(/flex-direction: column/.test(css.slice(css.indexOf('.zart {'), css.indexOf('.zart .ks-zi'))),
    'Symbol über dem Text');
}

console.log(fehler.length === 0 ? '\n--- bestanden ---' : '\n--- NICHT bestanden: ' + fehler.length + ' ---');
process.exit(fehler.length === 0 ? 0 : 1);
