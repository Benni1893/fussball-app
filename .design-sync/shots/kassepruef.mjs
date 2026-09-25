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
  M.kasse.tab = 'pruefen'; M.kasse.spFilter = ''; M.kasse.formOpen = false;
  M.kasse.bloecke = { katalog: false, indiv: false };
  M.kasse.players = []; M.kasse.items = {}; M.kasse.bezug = {}; M.kasse.indiv = [];
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

/* ===== 3. Spielerfilter ================================================= */
console.log('--- Spielerfilter ---');
{
  frisch(); M.kasse.tab = 'offen';
  pruefe(M.kasseHtml(DATEN).includes('data-ks-filter'), 'Filter steht in „Offen"');
  M.kasse.tab = 'bezahlt';
  pruefe(M.kasseHtml(DATEN).includes('data-ks-filter'), 'Filter steht in „Eingegangen"');
  M.kasse.tab = 'pruefen';
  pruefe(!M.kasseHtml(DATEN).includes('data-ks-filter'), 'Filter steht NICHT in „Zu prüfen"');

  // Ein einziger Spieler braucht keinen Filter.
  M.kasse.tab = 'offen';
  const einer = DATEN.filter((s) => s.st === 'offen' && s.playerId === 'p2');
  pruefe(!M.ksFilterHtml(einer).includes('<select'), 'bei einem Spieler kein Auswahlfeld');
  pruefe(M.ksFilterHtml(DATEN.filter((s) => s.st === 'offen')).includes('<select'),
    'bei mehreren Spielern ein Auswahlfeld');

  // Gesetzt filtert er die Liste, nicht die Kennzahlen.
  M.kasse.spFilter = 'p2';
  const h = M.kasseHtml(DATEN);
  pruefe(h.includes('3.090,00 €'), 'die Kennzahl bleibt die Gesamtsumme');
  const namen = [...h.matchAll(/class="krow-title">([^<]+)</g)].map((m) => m[1]);
  pruefe(namen.length > 0 && namen.every((n) => n === 'Daniel Koch'),
    'die Liste zeigt nur den gewählten Spieler', namen.length + ' Zeilen');
  pruefe(h.includes('value="p2" selected'), 'der gewählte Spieler steht im Feld');

  // Ein Spieler ohne Treffer im Reiter bekommt eine eigene Meldung.
  M.kasse.spFilter = 'p9';
  pruefe(M.kasseHtml(DATEN).includes('Keine Treffer'), 'Filter ohne Treffer: eigene Meldung');
  M.kasse.spFilter = '';
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
  frisch(); M.kasse.tab = 'offen'; M.kasse.spFilter = 'p2';
  pruefe(M.kasseHtml(DATEN).includes('ks-sag'), 'Offen: Balken an der Karte');
  M.kasse.spFilter = '';
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

/* ===== 7. „Strafe verhaengen": Waehler und die zwei Bloecke ============= */
console.log('--- Strafe verhängen ---');
{
  frisch();
  const zu = M.kasseHtml(DATEN);
  pruefe(zu.includes('data-ks-wahl'), 'zugeklappt: der Knopf öffnet den Wähler');
  pruefe(!zu.includes('kasse-add'), 'zugeklappt: kein Formular');

  // Katalog-Weg: nur der Katalogblock, dazu der Link auf den anderen.
  M.kasse.formOpen = true; M.kasse.bloecke = { katalog: true, indiv: false };
  const k = M.kasseHtml(DATEN);
  pruefe(k.includes('Aus dem Katalog'), 'Katalog-Modus: Katalogblock da');
  pruefe(!k.includes('data-kasse-indiv-add'), 'Katalog-Modus: kein Individuell-Block');
  pruefe(k.includes('data-ks-auch="indiv"'), 'Katalog-Modus: Link „Auch individuelle Strafe"');
  pruefe(!k.includes('data-ks-auch="katalog"'), 'Katalog-Modus: kein Link auf sich selbst');

  // Individueller Weg: spiegelbildlich.
  M.kasse.bloecke = { katalog: false, indiv: true };
  const i = M.kasseHtml(DATEN);
  pruefe(i.includes('data-kasse-indiv-add'), 'Individuell-Modus: Individuell-Block da');
  pruefe(!i.includes('Aus dem Katalog'), 'Individuell-Modus: kein Katalogblock');
  pruefe(i.includes('data-ks-auch="katalog"'), 'Individuell-Modus: Link „Auch aus dem Katalog"');

  // Beide zusammen - der gemischte Vorgang, der erhalten bleiben sollte.
  M.kasse.bloecke = { katalog: true, indiv: true };
  const b = M.kasseHtml(DATEN);
  pruefe(b.includes('Aus dem Katalog') && b.includes('data-kasse-indiv-add'), 'beide Blöcke zugleich');
  pruefe(!b.includes('data-ks-auch'), 'dann kein Link mehr');

  // Spielerauswahl, Datum und Kommentar gehoeren in jeden Modus.
  for (const [name, h] of [['Katalog', k], ['Individuell', i]]) {
    pruefe(h.includes('data-ks-open-players'), name + ': Spielerauswahl da');
    pruefe(h.includes('data-kasse-date'), name + ': Datum da');
    pruefe(h.includes('data-kasse-input="comment"'), name + ': Kommentar da');
    pruefe(h.includes('data-kasse-add'), name + ': Speichern da');
  }
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
  const OHNE_REGEL = ['ks-pane', 'kasse-picker-txt', 'kasse-catlist'];
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
  pruefe(/\.zart \{[^}]*min-height: 52px/.test(css), 'Zahlart-Chips 52 px');
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

console.log(fehler.length === 0 ? '\n--- bestanden ---' : '\n--- NICHT bestanden: ' + fehler.length + ' ---');
process.exit(fehler.length === 0 ? 0 : 1);
