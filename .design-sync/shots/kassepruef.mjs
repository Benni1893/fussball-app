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

const M = ladeKasse();
M.setDaten(SPIELER_BY_ID, { katalog: KATALOG, strafen: [], players: SPIELER });
const DATEN = beispielDaten();
const frisch = () => {
  M.kasse.tab = 'pruefen'; M.kasse.seite = null;
  M.kasse.bloecke = { katalog: false, indiv: false };
  M.kasse.players = []; M.kasse.items = {}; M.kasse.bezug = {}; M.kasse.indiv = [];
  M.kasse.indivBetrag = ''; M.kasse.indivGrund = ''; M.kasse.comment = '';
  M.kasse.filter = { offen: M.ksFilterNeu(), bezahlt: M.ksFilterNeu() };
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

/* ===== 3. Filter: Leiste, Sortierung, Zeitraum, Kombination ============= */
console.log('--- Filterleiste ---');
{
  frisch(); M.kasse.tab = 'offen';
  pruefe(M.kasseHtml(DATEN).includes('data-ks-fl-auf'), 'Filterleiste steht in „Offen"');
  M.kasse.tab = 'bezahlt';
  pruefe(M.kasseHtml(DATEN).includes('data-ks-fl-auf'), 'Filterleiste steht in „Eingegangen"');
  M.kasse.tab = 'pruefen';
  pruefe(!M.kasseHtml(DATEN).includes('data-ks-fl-auf'), 'Filterleiste steht NICHT in „Zu prüfen"');

  // Ohne Filter keine Zahl und keine Chips.
  frisch(); M.kasse.tab = 'offen';
  const leer = M.kasseHtml(DATEN);
  pruefe(!leer.includes('ks-fl-n'), 'ohne Filter keine Zahl an der Leiste');
  pruefe(!leer.includes('ks-fl-chip'), 'ohne Filter keine Chips');
  pruefe(!leer.includes('ks-treffer'), 'ohne Filter keine Zeile „x von y"');
}

console.log('--- Zählung der aktiven Filter ---');
{
  const z = (f) => M.ksFilterAnzahl(f);
  gleich(z(M.ksFilterNeu()), 0, 'Standard zählt als kein Filter');
  gleich(z({ spieler: ['p1'], sort: 'neu', zeit: 'alle' }), 1, 'ein Spieler');
  gleich(z({ spieler: ['p1', 'p2'], sort: 'neu', zeit: 'alle' }), 2, 'zwei Spieler zählen zweimal');
  gleich(z({ spieler: [], sort: 'neu', zeit: '7' }), 1, 'Zeitraum');
  gleich(z({ spieler: [], sort: 'betrag', zeit: 'alle' }), 1, 'abweichende Sortierung');
  gleich(z({ spieler: ['p1'], sort: 'alt', zeit: '30' }), 3, 'alles zusammen');
  gleich(z(null), 0, 'kein Filterobjekt');
}

console.log('--- Sortierung ---');
{
  const offen = DATEN.filter((s) => s.st === 'offen');
  const datum = (l) => l.map((s) => s.datum);
  const neu = M.ksSortieren(offen, 'neu', 'offen');
  const alt = M.ksSortieren(offen, 'alt', 'offen');
  pruefe(datum(neu)[0] >= datum(neu)[datum(neu).length - 1], 'Neueste zuerst: absteigend');
  pruefe(datum(alt)[0] <= datum(alt)[datum(alt).length - 1], 'Älteste zuerst: aufsteigend');
  gleich(datum(neu)[0], datum(alt)[datum(alt).length - 1], 'die beiden Enden tauschen');
  const betrag = M.ksSortieren(offen, 'betrag', 'offen');
  pruefe(betrag[0].betrag >= betrag[betrag.length - 1].betrag, 'Höchster Betrag zuerst');
  gleich(betrag[0].betrag, Math.max(...offen.map((s) => s.betrag)), 'der größte Betrag steht oben');
  // Sortieren darf nichts wegwerfen und die Eingabe nicht verändern.
  gleich(neu.length, offen.length, 'Sortieren verliert keine Zeile');
  const vorher = offen.map((s) => s.id).join();
  M.ksSortieren(offen, 'betrag', 'offen');
  gleich(offen.map((s) => s.id).join(), vorher, 'die übergebene Liste bleibt unangetastet');
  // Gleiches Datum: der Name entscheidet, damit die Reihenfolge stabil ist.
  const gleichTag = [
    { datum: '2026-09-10', betrag: 5, player: { name: 'Zeta Zulu' }, playerId: 'z' },
    { datum: '2026-09-10', betrag: 5, player: { name: 'Alpha Anton' }, playerId: 'a' },
  ];
  gleich(M.ksSortieren(gleichTag, 'neu', 'offen').map((s) => s.playerId), ['a', 'z'],
    'bei gleichem Datum entscheidet der Name');

  // „Eingegangen" sortiert nach dem Buchungsdatum, nicht nach dem Strafendatum.
  gleich(M.ksBezugsdatum({ datum: '2026-01-01', paidAt: '2026-09-22T19:05:00Z' }, 'bezahlt'),
    '2026-09-22', 'Eingegangen: Buchungsdatum zählt');
  gleich(M.ksBezugsdatum({ datum: '2026-01-01', paidAt: '2026-09-22T19:05:00Z' }, 'offen'),
    '2026-01-01', 'Offen: Datum der Strafe zählt');
  gleich(M.ksBezugsdatum({ datum: '2026-01-01', paidAt: null }, 'bezahlt'),
    '2026-01-01', 'ohne Buchungsdatum fällt es auf das Strafendatum zurück');
}

console.log('--- Zeiträume ---');
{
  const H = '2026-09-25';
  const z = (iso, was) => M.ksImZeitraum(iso, was, H);
  pruefe(z('2026-01-01', 'alle'), 'Alle lässt alles durch');
  pruefe(z(H, 'heute'), 'Heute: heute');
  pruefe(!z('2026-09-24', 'heute'), 'Heute: gestern nicht');
  // „Letzte 7 Tage" = heute und die sechs Tage davor.
  pruefe(z(H, '7'), '7 Tage: heute');
  pruefe(z('2026-09-19', '7'), '7 Tage: der sechste Tag davor zählt noch');
  pruefe(!z('2026-09-18', '7'), '7 Tage: der siebte Tag davor nicht mehr');
  pruefe(z('2026-08-27', '30'), '30 Tage: die Untergrenze');
  pruefe(!z('2026-08-26', '30'), '30 Tage: ein Tag darüber hinaus nicht');
  // Ein Datum in der Zukunft gehört in keinen Rückblick.
  pruefe(!z('2026-09-26', '7'), 'morgen liegt nicht in den letzten 7 Tagen');
  pruefe(!z(null, '7'), 'ohne Datum kein Treffer');
  pruefe(z(null, 'alle'), 'ohne Datum, aber ohne Zeitraum: Treffer');
}

console.log('--- Filtern, auch kombiniert ---');
{
  const H = '2026-09-25';
  const offen = DATEN.filter((s) => s.st === 'offen');
  const f = (o) => M.ksFiltern(offen, { ...M.ksFilterNeu(), ...o }, 'offen', H);

  gleich(f({}).length, offen.length, 'ohne Filter bleibt alles');

  const nurKoch = f({ spieler: ['p2'] });
  pruefe(nurKoch.length > 0 && nurKoch.every((s) => s.playerId === 'p2'), 'Spielerfilter greift',
    nurKoch.length + ' Zeilen');
  const zwei = f({ spieler: ['p2', 'p3'] });
  pruefe(zwei.every((s) => s.playerId === 'p2' || s.playerId === 'p3'), 'zwei Spieler: beide durch');
  pruefe(zwei.length > nurKoch.length, 'zwei Spieler ergeben mehr Zeilen als einer');

  const sep = f({ zeit: '30' });
  pruefe(sep.every((s) => s.datum >= '2026-08-27'), 'Zeitraum greift',
    sep.length + ' Zeilen');

  // Kombination: beides muss gelten, nicht eines von beidem.
  const komb = f({ spieler: ['p2'], zeit: '30' });
  pruefe(komb.every((s) => s.playerId === 'p2' && s.datum >= '2026-08-27'),
    'Spieler UND Zeitraum, nicht ODER');
  pruefe(komb.length <= nurKoch.length && komb.length <= sep.length,
    'die Kombination ist nie größer als ihre Teile', komb.length + ' Zeilen');

  // Kombination mit Sortierung.
  const ks = f({ spieler: ['p2', 'p3'], sort: 'betrag' });
  pruefe(ks.length > 1 && ks[0].betrag >= ks[1].betrag, 'gefiltert UND sortiert');

  // Ein Spieler ohne Treffer ergibt eine leere Liste, keinen Fehler.
  gleich(f({ spieler: ['gibt-es-nicht'] }).length, 0, 'unbekannter Spieler: leer');
}

console.log('--- Was die Leiste anzeigt ---');
{
  frisch();
  M.kasse.tab = 'offen';
  M.kasse.filter.offen = { spieler: ['p2'], sort: 'betrag', zeit: '30' };
  const h = M.kasseHtml(DATEN);
  pruefe(h.includes('<span class="ks-fl-n">3</span>'), 'die Leiste nennt drei aktive Filter');
  pruefe(h.includes('Daniel Koch'), 'der Spieler steht als Chip');
  pruefe(h.includes('Letzte 30 Tage'), 'der Zeitraum steht als Chip');
  pruefe(h.includes('Höchster Betrag zuerst'), 'die Sortierung steht als Chip');
  pruefe(h.includes('data-ks-fl-weg="sp:p2"'), 'der Spieler-Chip ist einzeln abwählbar');
  pruefe(h.includes('data-ks-fl-weg="zeit"') && h.includes('data-ks-fl-weg="sort"'),
    'Zeitraum und Sortierung ebenso');

  // Die Kennzahlen und die Reiterzahlen bleiben ungefiltert.
  pruefe(h.includes('3.090,00 €'), 'die Kennzahl bleibt die Gesamtsumme');
  pruefe(/Offen <span class="ks-seg-n">140<\/span>/.test(h), 'die Reiterzahl bleibt 140');

  // „x von y" zählt die gezeigten gegen die gesamten.
  const gezeigt = (h.match(/class="krow"/g) || []).length;
  const m = h.match(/class="ks-treffer">(\d+) von (\d+)</);
  pruefe(!!m, 'die Zeile „x von y" steht da');
  if (m) {
    gleich(Number(m[1]), gezeigt, 'x ist die Zahl der gezeigten Karten');
    gleich(Number(m[2]), DATEN.filter((s) => s.st === 'offen').length, 'y ist die Gesamtzahl');
  }
  frisch();
}

console.log('--- Filter je Reiter getrennt ---');
{
  frisch();
  M.kasse.filter.offen   = { spieler: ['p2'], sort: 'neu', zeit: 'alle' };
  M.kasse.filter.bezahlt = M.ksFilterNeu();
  M.kasse.tab = 'bezahlt';
  const h = M.kasseHtml(DATEN);
  pruefe(!h.includes('ks-fl-n'), '„Eingegangen" ist ungefiltert, obwohl „Offen" einen Filter hat');
  M.kasse.tab = 'offen';
  pruefe(M.kasseHtml(DATEN).includes('ks-fl-n'), 'und „Offen" hat ihn weiterhin');
  frisch();
}

console.log('--- Gefilterte Liste ohne Treffer ---');
{
  frisch(); M.kasse.tab = 'offen';
  // Eine Strafe von vorgestern, Filter auf „Heute" - garantiert kein Treffer,
  // unabhaengig davon, wie die Beispieldaten gerade streuen.
  const alteStrafe = DATEN.filter((s) => s.st === 'offen').slice(0, 1)
    .map((s) => ({ ...s, datum: '2026-01-02' }));
  M.kasse.filter.offen = { spieler: [], sort: 'neu', zeit: 'heute' };
  const h = M.kasseHtml(alteStrafe);
  pruefe(h.includes('Keine Treffer'), 'eigene Meldung statt des Leerzustands');
  pruefe(!h.includes('Keine offenen Posten'), 'nicht mit „gar nichts da" verwechselt');
  frisch();
}

console.log('--- Spielersuche ---');
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
  M.kasse.filter.offen = { spieler: ['p2'], sort: 'neu', zeit: 'alle' };
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

/* ===== 7. „Strafe verhaengen": Waehler und die zwei Seiten ============== */
console.log('--- Strafe verhängen: der Weg dorthin ---');
{
  frisch();
  const zu = M.kasseHtml(DATEN);
  pruefe(zu.includes('data-ks-wahl'), 'auf der Startseite öffnet der Knopf den Wähler');
  pruefe(!zu.includes('ks-seite'), 'die Startseite zeigt keine Eingabeseite');
  pruefe(!zu.includes('kasse-catlist'), 'und keinen Katalog');
}

console.log('--- Die Seite ersetzt den Kassen-Feed ---');
{
  for (const modus of ['katalog', 'indiv']) {
    frisch();
    M.kasse.seite = modus;
    M.kasse.bloecke = { katalog: modus === 'katalog', indiv: modus === 'indiv' };
    const h = M.kasseHtml(DATEN);
    pruefe(h.includes('class="ks-seite"'), modus + ': eigene Seite');
    // Genau das, was laut Auftrag NICHT mehr da sein darf.
    pruefe(!h.includes('kpi-grid'), modus + ': keine Kennzahl-Kacheln');
    pruefe(!h.includes('Prüfen und verbuchen'), modus + ': keine Überschrift „Prüfen und verbuchen"');
    pruefe(!h.includes('ks-seg-b'), modus + ': keine Reiterleiste');
    pruefe(!h.includes('data-ks-fl-auf'), modus + ': keine Filterleiste');
    pruefe(!h.includes('krow-list') && !h.includes('ks-ein-row'), modus + ': keine Liste');
    // Und das, was dazukommt.
    pruefe(h.includes('data-ks-seite-zurueck'), modus + ': Zurück zur Auswahl');
    pruefe(h.includes('data-ks-seite-zu'), modus + ': Schließen zur Kasse');
    pruefe(h.includes('ks-seite-fuss'), modus + ': Speichern sitzt fest am unteren Rand');
  }
}

console.log('--- Aufbau je Seite ---');
{
  frisch();
  M.kasse.seite = 'katalog'; M.kasse.bloecke = { katalog: true, indiv: false };
  const k = M.kasseHtml(DATEN);
  pruefe(k.includes('Strafe aus Katalog'), 'Katalog-Seite trägt ihren Titel');
  pruefe(k.includes('kasse-catlist'), 'Katalog-Seite: Katalogliste');
  pruefe(k.includes('data-kasse-catrow'), 'Katalog-Seite: Katalogzeilen zum Antippen');
  // Die Mengensteuerung erscheint erst an der gewählten Zeile.
  M.kasse.items = { k1: { menge: 2 } };
  const kMenge = M.kasseHtml(DATEN);
  pruefe(kMenge.includes('data-kasse-qty="k1"'), 'Katalog-Seite: Mengen-Plus/Minus an der gewählten Zeile');
  pruefe(kMenge.includes('>2×<'), 'Katalog-Seite: die Menge steht daneben');
  M.kasse.items = {};
  pruefe(!k.includes('data-kasse-indiv-add'), 'Katalog-Seite: kein Individuell-Block');
  pruefe(k.includes('data-ks-auch="indiv"'), 'Katalog-Seite: Link „Auch individuelle Strafe"');

  frisch();
  M.kasse.seite = 'indiv'; M.kasse.bloecke = { katalog: false, indiv: true };
  const i = M.kasseHtml(DATEN);
  pruefe(i.includes('Individuelle Strafe'), 'Individuell-Seite trägt ihren Titel');
  pruefe(i.includes('data-kasse-indiv-add'), 'Individuell-Seite: Betrag und Grund');
  pruefe(!i.includes('kasse-catlist'), 'Individuell-Seite: keine Katalogliste');
  pruefe(i.includes('data-ks-auch="katalog"'), 'Individuell-Seite: Link „Auch aus dem Katalog"');

  // Der gewählte Weg steht oben.
  frisch();
  M.kasse.seite = 'indiv'; M.kasse.bloecke = { katalog: true, indiv: true };
  const b = M.kasseHtml(DATEN);
  pruefe(b.indexOf('Individuelle Strafe<') < b.indexOf('Aus dem Katalog'),
    'auf der Individuell-Seite steht der individuelle Block oben');
  pruefe(!b.includes('data-ks-auch'), 'sind beide Blöcke da, verschwindet der Link');

  // Spielerauswahl, Datum, Kommentar und Zusammenfassung gehören auf beide.
  for (const [name, h] of [['Katalog', k], ['Individuell', i]]) {
    pruefe(h.includes('data-ks-open-players'), name + ': Spielerauswahl');
    pruefe(h.includes('data-kasse-date'), name + ': Datum');
    pruefe(h.includes('data-kasse-input="comment"'), name + ': Kommentar');
    pruefe(h.includes('id="kasseSummary"'), name + ': Zusammenfassung');
    pruefe(h.includes('data-kasse-add'), name + ': Speichern');
  }
  frisch();
}

console.log('--- Der Speichern-Knopf ---');
{
  frisch();
  M.kasse.seite = 'katalog'; M.kasse.bloecke = { katalog: true, indiv: false };
  // Ohne Spieler und ohne Strafe: deaktiviert.
  let h = M.kasseHtml(DATEN);
  pruefe(/data-kasse-add disabled/.test(h), 'ohne alles deaktiviert');
  pruefe(h.includes('>Strafe speichern<'), 'und trägt den schlichten Text');

  // Nur Spieler, keine Strafe: weiterhin deaktiviert.
  M.kasse.players = ['p1', 'p2', 'p3'];
  h = M.kasseHtml(DATEN);
  pruefe(/data-kasse-add disabled/.test(h), 'nur Spieler: noch deaktiviert');

  // Nur Strafe, kein Spieler: ebenfalls.
  M.kasse.players = []; M.kasse.items = { k1: { menge: 1 } };
  h = M.kasseHtml(DATEN);
  pruefe(/data-kasse-add disabled/.test(h), 'nur Strafe: noch deaktiviert');

  // Beides: aktiv, mit Anzahl und Summe.
  M.kasse.players = ['p1', 'p2', 'p3'];
  h = M.kasseHtml(DATEN);
  pruefe(!/data-kasse-add disabled/.test(h), 'Spieler und Strafe: aktiv');
  pruefe(h.includes('3 Strafen · 15,00 € speichern'), 'Knopf nennt Anzahl und Summe',
    (h.match(/ks-seite-save"[^>]*>([^<]+)</) || [])[1]);

  // Zwei Strafen je Spieler: die Anzahl zählt die Einträge, nicht die Spieler.
  M.kasse.items = { k1: { menge: 1 }, k2: { menge: 1 } };
  h = M.kasseHtml(DATEN);
  pruefe(h.includes('6 Strafen · 45,00 € speichern'), '3 Spieler × 2 Strafen = 6 Einträge');

  // Einzahl.
  M.kasse.players = ['p1']; M.kasse.items = { k1: { menge: 1 } };
  h = M.kasseHtml(DATEN);
  pruefe(h.includes('1 Strafe · 5,00 € speichern'), 'eine Strafe im Singular');
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
  // Gemischt: 2 Spieler x (1 Katalogstrafe x2 + 1 freie Strafe)
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

  // Staffel ohne Bezugsgroesse blockiert - unveraendert.
  M.kasse.items = { k4: { menge: 1 } };
  M.kasse.indiv = [];
  pruefe(M.kasseBuild().incomplete, 'Staffel ohne Bezugsgröße: unvollständig');
  pruefe(!M.kasseBuild().valid, 'und damit nicht speicherbar');
  M.kasse.bezug = { k4: '7' };
  const st = M.kasseBuild();
  gleich(st.proSpieler, 14, 'Staffel: 7 Stunden × 2,00 = 14,00');
  M.kasse.bezug = { k4: '30' };
  gleich(M.kasseBuild().proSpieler, 20, 'Staffel: Deckel bei 20,00 greift');

  // Ohne Spieler kein Vorgang.
  M.kasse.players = [];
  pruefe(!M.kasseBuild().valid, 'ohne Spieler nicht speicherbar');
  frisch();
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
  // Der alte Fehler: jede Bestaetigung wurde als PayPal gebucht.
  pruefe(!/confirmFines\([^)]*"paypal"/.test(app), 'kein fest verdrahtetes „paypal" beim Bestätigen mehr');
  pruefe(/confirmFines\(\[conf\.dataset\.kasseConfirm\], \(s && s\.sagtZahlart\) \|\| "bar"\)/.test(app),
    'einzeln bestätigen bucht die Angabe des Spielers, sonst bar');
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
  pruefe(/\.ks-ein-row \{[^}]*padding: 13px 14px/.test(css), 'Zeile „Eingegangen" mit 13+13 über 32 px Kreis = 58');
  pruefe(/\.zart \{[^}]*min-height: 64px/.test(css), 'Zahlart-Chips 64 px (Symbol über dem Text)');
  pruefe(/\.ks-fl-b \{[^}]*min-height: var\(--tap\)/.test(css), 'Filterleiste 44 px');
  pruefe(/\.ks-wahlz \{[^}]*min-height: var\(--h-row\)/.test(css), 'Zeilen im Filterblatt 52 px');
  pruefe(/\.ks-such-in \{[^}]*min-height: var\(--h-in\)/.test(css), 'Suchfeld 46 px');
  pruefe(/\.ks-such-in \{[^}]*font-size: var\(--fs-input\)/.test(css),
    'Suchfeld mit 16px - sonst zoomt Safari beim Fokus');
  pruefe(/\.ks-fl-chip > button::after \{[^}]*width: var\(--tap\)/.test(css),
    'das x am Filterchip hat 44 px Trefferfläche');
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
    ['ksFlScrim', 'ksFlBl', 'Kasse: Filter'],
    ['ksSuScrim', 'ksSuBl', 'Kasse: Spieler suchen'],
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
