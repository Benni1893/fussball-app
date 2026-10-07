/* Messvorschriften für finalmess.mjs: je Screen der Vorlage „Final Alle Screens“
   das Profil im Landkarten-Stand-in und wie die App dorthin kommt.
   ausnahmen: Texte, deren Lage bewusst abweicht (Begründung im Kommentar).
   ohneText:  Soll-Texte, die im Stand-in andere Daten haben (Namen, Beträge).
   erlaubt:   Befunde (Zeilenanfang), die als bewusste Abweichung gelten (ABSCHLUSS.md).
   daten:     Anpassung des Vorlagen-Datensatzes für diesen Screen.            */

const klick = (sel) => async (page) => { await page.click(sel); await page.waitForTimeout(500); };
const ohne = (...ids) => (d) => Object.assign(d, { events: d.events.filter((e) => !ids.includes(e.id)) });

// Termin-Blatt wie in der Vorlage ausfüllen: Spiel, Gegner, Auswärts, 11.10., 13:30, Treffen 12:45.
const terminBlatt = async (page) => {
  await page.click('[data-view="kalender"]'); await page.waitForTimeout(400);
  await page.click('[data-termin-new]'); await page.waitForTimeout(300);
  await page.click('[data-tf-typ="spiel"]');
  await page.click('[data-tf-heim="false"]');
  await page.evaluate(() => {
    const setze = (k, v) => { const el = document.querySelector('#terminModal [data-tf="' + k + '"]'); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
    setze('gegner', 'FC Teutonia Mün. 2'); setze('datum', '2026-10-11'); setze('zeit', '13:30'); setze('treffen', '12:45');
    document.activeElement && document.activeElement.blur();
  });
  await page.waitForTimeout(300);
};

// 04: Training Di 6. Okt mit 7 zu, 2 ab, 7 offen (Vorlage).
const rueckmeldungen04 = (d) => {
  const zu = ['p01', 'p02', 'p03', 'p04', 'p06', 'p11', 'p12'], ab = ['p05', 'p16'];
  d.rsvps = d.rsvps.filter((r) => r.eventId !== 'e-tr1')
    .concat(zu.map((p) => ({ eventId: 'e-tr1', playerId: p, status: 'zu', grund: null })))
    .concat(ab.map((p) => ({ eventId: 'e-tr1', playerId: p, status: 'ab', grund: null })));
  return d;
};

// Admin: über Mehr in die Trainer-Ansicht.
const zuTrainer = async (page) => { await page.click('#navMore'); await page.waitForTimeout(300); await page.click('#moreLineup'); await page.waitForTimeout(500); };

// Platz (07 bis 08): Spielernamen und Aufstellung wie in der Vorlage.
const NAMEN07 = { p13: 'Daniel Morawe', p14: 'Simon Ulbrich', p07: 'Max Thamm', p06: 'Lukas Pallas', p08: 'Jonas Quast',
  p15: 'Tim Wendt', p09: 'Niklas Rennert', p10: 'Felix Sauter' };
const ELF = { TW: 'p01', LV: 'p02', LIV: 'p13', RIV: 'p14', RV: 'p03', LM: 'p07', LZM: 'p06', RZM: 'p08', RM: 'p15', LST: 'p09', RST: 'p10' };
const platz = (event, slots, bank, namen, extra) => (d) => {
  d.players.forEach((p) => { if (namen[p.id]) p.name = namen[p.id]; });
  if (extra) extra(d);
  d.lineups = d.lineups.filter((l) => l.eventId !== event).concat([{ id: 'l-mess', eventId: event, name: 'Mess', formation: '4-4-2',
    slots, bank, isActive: true, isTemplate: false, updatedAt: '2026-10-04T10:00:00Z' }]);
  return d;
};
const ohneKey = (o, ...keys) => Object.fromEntries(Object.entries(o).filter(([k]) => !keys.includes(k)));
// 07c/08: Moritz Vogler (IV, Urlaub) statt Florian Huber; alle Übrigen haben zugesagt.
const vogler = (d) => {
  d.players.forEach((p) => { if (p.id === 'p11') Object.assign(p, { name: 'Moritz Vogler', pos: 'IV', status: 'urlaub', statusSince: '2026-10-01' }); });
  d.rsvps = d.rsvps.filter((r) => r.eventId !== 'e-sp3').concat(['p01','p02','p03','p04','p06','p07','p08','p09','p10','p12','p13','p14','p15','p16']
    .map((p) => ({ eventId: 'e-sp3', playerId: p, status: 'zu', grund: null })));
};
const spielOeffnen = (id, danach) => async (page) => { await zuTrainer(page); await page.click('[data-tvgame="' + id + '"]'); await page.waitForTimeout(500); if (danach) await danach(page); };

const zuKasse = async (page) => { await page.click('#navMore'); await page.waitForTimeout(300); await page.click('#moreKasse'); await page.waitForTimeout(400); };

export const SCREENS = {
  // D3: Zähler „Elf aufstellen“ weiß auf --grad-chip-gold (Vorlage: dunkle Schrift auf Gold, 2,9:1).
  '01 Übersicht': { profil: 'admin', erlaubt: ['"1": farbe'] },
  // Die Vorlage zeigt im Kalender das Training am Do 8. Okt nicht (in 01 schon).
  // Menü ··· auch an der Sonstiges-Karte (In Kalender speichern, Pflege): Kopftext schmaler.
  '02 Kalender': { profil: 'admin', vorbereitung: klick('[data-view="kalender"]'), daten: ohne('e-tr2'),
    erlaubt: ['"Sonstiges": w 268→212', '"Mannschaftsabend": w 268→212', '"20:00 Uhr": w 268→212'] },
  // Eingabewerte stehen im Feld, nicht als Text: Gegner und Platzhalter.
  '03 Termin anlegen': { profil: 'admin', vorbereitung: terminBlatt, wurzel: '#terminModal', ohneText: ['FC Teutonia Mün. 2', 'Straße, Ort', 'Für die Spieler'] },
  // Fuß nach Vorgabe des Nutzers mit drei Knöpfen (Push senden, Teilen, Übersicht teilen),
  // 60 px höher als die Vorlage: Fenster 60 höher, damit die Blattoberkante gleich liegt.
  '04 Rückmeldungen': { profil: 'admin', daten: rueckmeldungen04, hoehe: 600, wurzel: '#rsvpSheet',
    vorbereitung: async (page) => { await page.click('[data-rsvp-sheet]'); await page.waitForTimeout(500); },
    ohneText: ['Alle 7 erinnern'], erlaubt: ['"Teilen":'] },
  // Vorlage: Gegner "SV Am Hart Mün." (in 01 "SV Am Hart"), Daten je Screen.
  '06 Trainer': { profil: 'admin', vorbereitung: zuTrainer,
    daten: (d) => {
      d.events.forEach((e) => { if (e.id === 'e-sp3') { e.gegner = 'SV Am Hart Mün.'; e.titel = e.gegner; } });
      // Die Vorlage zeigt „Alle ›“: es gibt mehr als zwei weitere Spiele.
      const sp4 = Object.assign({}, d.events.find((e) => e.id === 'e-sp3'), { id: 'e-sp4', datum: '2026-11-01', gegner: 'TSV Moosach 2', titel: 'TSV Moosach 2', heim: true, startsAt: new Date('2026-11-01T13:00:00+01:00').toISOString() });
      d.events.push(sp4); return d;
    } },
  // Chipbreiten: Ziffern der Schrift 1 bis 3 px schmaler als in der Vorlage (gleiches Innenmaß).
  '07 Platz': { profil: 'admin', daten: platz('e-sp1', ELF, ['p12'], NAMEN07), vorbereitung: spielOeffnen('e-sp1'),
    erlaubt: ['"4-4-2": w', '"4-2-3-1": x', '"4-2-3-1": w', '"4-3-3": x', '"Weitere": x', '"Weitere": w'] },
  // Formationschips bleiben über dem Hinweis (Funktion); alles darunter 50 px tiefer.
  // "LV frei" auf dunkler Pille (Kontrast, D4).
  '07b Platz frei': { profil: 'admin', daten: platz('e-sp3', ohneKey(ELF, 'LV'), [], NAMEN07, (d) => { d.events.forEach((e) => { if (e.id === 'e-sp3') { e.gegner = 'SV Am Hart Mün.'; e.titel = e.gegner; } }); }), vorbereitung: spielOeffnen('e-sp3'),
    versatz: [{ ab: 120, dy: 50 }], erlaubt: ['"LV frei":'] },
  '07c Position besetzen': { profil: 'admin', wurzel: '#tvSheetKader',
    daten: platz('e-sp3', ohneKey(ELF, 'LV', 'RV', 'LM'), ['p12'], Object.assign({}, NAMEN07, { p13: 'Daniel Koch', p07: 'Max Bauer' }),
      // Die Vorlage kennt in 07c keinen weiteren freien Stürmer (Paul Ebert).
      (d) => { vogler(d); d.players = d.players.filter((p) => p.id !== 'p16'); }),
    vorbereitung: spielOeffnen('e-sp3', async (page) => { await page.click('[data-tvfill]'); await page.waitForTimeout(500); }) },
  '08 Bank-Blatt': { profil: 'admin', wurzel: '#tvSheetKader',
    daten: platz('e-sp3', ohneKey(ELF, 'LM'), ['p12'], { }, vogler),
    vorbereitung: spielOeffnen('e-sp3', async (page) => { await page.click('.tv-bank-kopf [data-tvbankadd]'); await page.waitForTimeout(500); }),
    ohneText: ['Abwehr · 6'] },
  // Die Vorlage zeigt einen Ausschnitt der Liste (ohne Ebert, Feldmann, Kessler): beide sortieren nach hinten.
  '09 Kader': { profil: 'admin', daten: (d) => { d.players.forEach((p) => { if (p.id === 'p16') p.name = 'Paul Wagner'; if (p.id === 'p01') p.name = 'Anton Zeller'; if (p.id === 'p02') p.name = 'Bruno Seidl'; }); return d; },
    vorbereitung: async (page) => { await zuTrainer(page); await page.click('[data-goto="kader"]'); await page.waitForTimeout(500); } },
  // Feld „Voraussichtlich bis“ bleibt (Funktion): Blatt 64 px höher, Fenster ebenso; Speichern 64 tiefer.
  '10 Status-Blatt': { profil: 'admin', hoehe: 584, wurzel: '#statusBlatt', versatz: [{ ab: 440, dy: 64 }],
    vorbereitung: async (page) => { await zuTrainer(page); await page.click('[data-goto="kader"]'); await page.waitForTimeout(400);
      await page.click('[data-status-blatt="p05"]'); await page.waitForTimeout(400); },
    ohneText: ['Knie'] },
  // 11: Liste der Vorlage mit zwei offenen Strafen (Banner sagt 3, Vorlage in sich uneinig).
  '11 Konto Ich': { profil: 'admin', vorbereitung: klick('[data-view="strafen"]'),
    daten: (d) => { d.strafen = d.strafen.filter((x) => x.id !== 'f03'); d.strafen.forEach((x) => { if (x.id === 'f01') { x.betrag = 10; x.grundbetrag = 10; x.vergehen = 'Zu spät zum Spiel'; } }); return d; },
    ohneText: ['3 Strafen offen ·', 'Offen 3', 'Bezahlt 24'],
    // Der Kontobanner ist in 11 einen Pixel niedriger gezeichnet als in 01; die App nutzt einen Baustein (01 maßgeblich).
    versatz: [{ ab: 220, dy: 1, bis: 680 }, { ab: 420, dy: 1, bis: 680 }], erlaubt: ['"Vergessene Zahlung Mannschaftskasse": w', '"Gemeldet 8": x'] },
  // 12: Ausschnitt der Vorlage (ohne die eigenen offenen Strafen, Gründe wie in der Vorlage).
  '12 Konto Mannschaft': { profil: 'admin', vorbereitung: async (page) => { await page.click('[data-view="strafen"]'); await page.waitForTimeout(300); await page.click('[data-kseg="team"]'); await page.waitForTimeout(300); },
    daten: (d) => { d.strafen = d.strafen.filter((x) => !(x.playerId === 'p06' && x.status === 'offen'));
      d.strafen.forEach((x) => { if (x.id === 'f12') Object.assign(x, { datum: '2026-09-26', vergehen: 'Gelb-Rote Karte', katalogId: null, betrag: 12, grundbetrag: 12 });
        if (x.id === 'f14') Object.assign(x, { vergehen: 'Wer', katalogId: null }); if (x.id === 'f16') Object.assign(x, { vergehen: 'Verspätete Absage', katalogId: null });
        if (x.id === 'f15') Object.assign(x, { vergehen: 'Vergessene Zahlung' }); if (x.id === 'f11') Object.assign(x, { vergehen: 'Duschen mit Socken' });
        if (['f11', 'f12', 'f14', 'f16'].includes(x.id)) x.createdAt = '2026-10-01T12:00:00Z'; });   // ohne Mahnzuschlag wie in der Vorlage
      return d; },
    ohneText: ['4.586,00 €', '1.058,00 €', 'Offen 238', 'Bezahlt 58'], erlaubt: ['"Gemeldet 8": x', '"12,00 €":'] },
  // Kasse: Daten je Screen aus der Vorlage nur teilweise nachgebildet (Summen, Anzahlen).
  // Zahlart-Symbol vor der Meta-Zeile bleibt (Konvention), Text daher 12 px weiter rechts.
  '13 Kasse Gemeldet': { profil: 'admin', vorbereitung: zuKasse, erlaubt: ['"PayPal · gemeldet 28.09., 16:42": x', '"8": x'],
    daten: (d) => { d.strafen.forEach((x) => { if (x.status === 'gemeldet') { x.gemeldetAm = '2026-09-28T14:42:00Z'; x.createdAt = '2026-10-01T12:00:00Z'; } }); return d; } },
  // 14: offene Strafen je Spieler wie in der Vorlage (Summen, Anzahl, älteste); Gesamtzahl der Vorlage 238/41.
  '14 Kasse Offen': { profil: 'admin', vorbereitung: async (page) => { await zuKasse(page); await page.click('[data-kstab="offen"]'); await page.waitForTimeout(300); },
    daten: (d) => {
      const neu = (id, p, betrag, datum) => ({ id, playerId: p, katalogId: null, datum, bezahlt: false, note: null, selfReported: false, paidAt: null, status: 'offen',
        batchId: null, zahlart: null, ablehnGrund: null, sagtZahlart: null, sagtNote: null, gemeldetAm: null, grundbetrag: betrag, zuschlag: 0, zuschlagAt: null,
        createdAt: '2026-10-04T12:00:00Z', eventId: null, auto: false, vergehen: 'Strafe', betrag });
      const plan = [['p10', [20, 12, 10, 10, 10, 10], '2026-05-10'], ['p15', [25, 13, 10, 10], '2026-05-10'], ['p11', [22, 12, 10], '2026-09-26'], ['p06', [10, 10, 10], '2026-10-01'], ['p07', [20], '2026-10-01']];
      d.strafen = d.strafen.filter((x) => x.status !== 'offen');
      plan.forEach(([p, betraege, aelteste]) => betraege.forEach((b, i) => d.strafen.push(neu('o-' + p + i, p, b, i === 0 ? aelteste : '2026-10-02'))));
      return d; },
    ohneText: ['238 Strafen · 41 Spieler', '4.586,00 €'], erlaubt: ['"8": x'] },
  '15 Buchen': { profil: 'admin', wurzel: '#ksBl',
    vorbereitung: async (page) => { await zuKasse(page); await page.click('[data-kstab="offen"]'); await page.waitForTimeout(300);
      await page.click('[data-ks-spieler="p10"]'); await page.waitForTimeout(500);
      await page.click('#ksBl .row.ks-bz:nth-child(2) .row-main'); await page.waitForTimeout(300); },
    // Reihenfolge nach Datum (Vorlage: 10. Mai, 26. Sep, 22. Sep); Zahlart dreiteilig (Überweisung bleibt).
    daten: (d) => { d.strafen.forEach((x) => { if (['f10', 'f11', 'f12'].includes(x.id)) x.createdAt = '2026-10-04T12:00:00Z'; if (x.id === 'f10') x.vergehen = 'Gelb-Rote Karte (Meckern)'; }); return d; },
    ohneText: ['6 offene Strafen · 72,00 €', '25,00 €'],
    erlaubt: ['"Duschen mit Socken": y', '"26. Sep": y', '"Zu spät zum Training": y', '"22. Sep": y', '"Bar": w', '"PayPal": x', '"5,00 €": y', '"12,00 €": y'] },
  // 16: Katalog der Vorlage (vier Einträge), Paul Ebert gewählt, Handy in der Kabine angehakt, Datum 2. Okt.
  // Menge (−, 1×, +) unter der gewählten Zeile bleibt (Funktion, nicht in der Vorlage): Blatt 56 höher.
  '16 Strafe verhängen': { profil: 'admin', wurzel: '#ksSeite', hoehe: 874, versatz: [{ ab: 440, dy: 56 }],
    daten: (d) => { d.katalog = [
      { id: 'k1', vergehen: 'Verspätete Rückmeldung', betrag: 8, typ: 'fixed' },
      { id: 'k2', vergehen: 'Zu spät zum Training', betrag: 0, typ: 'staffel', einheit: 'Minuten', proEinheit: 1, schritt: 5, maxBetrag: null },
      { id: 'k3', vergehen: 'Handy in der Kabine', betrag: 5, typ: 'fixed' },
      { id: 'k4', vergehen: 'Trikot vergessen', betrag: 3, typ: 'fixed' }].map((k) => Object.assign({ kategorie: null, einheit: null, proEinheit: null, schritt: null, maxBetrag: null }, k)); return d; },
    vorbereitung: async (page) => { await zuKasse(page); await page.click('[data-ks-wahl]'); await page.waitForTimeout(400);
      await page.click('[data-ks-open-players]'); await page.waitForTimeout(400);
      await page.click('[data-ks-player="p16"]'); await page.waitForTimeout(200);
      await page.click('[data-ks-weiter]').catch(() => {}); await page.waitForTimeout(400);
      await page.click('[data-kasse-catrow="k3"]'); await page.waitForTimeout(200);
      await page.evaluate(() => { const el = document.querySelector('[data-kasse-date]'); el.value = '2026-10-02'; el.dispatchEvent(new Event('change', { bubbles: true })); });
      await page.waitForTimeout(300); },
    ohneText: ['Optional'], erlaubt: ['"Fr, 2. Okt 2026": w', '"5,00 €": x 291'] },
  '17 Katalog': { profil: 'admin', vorbereitung: klick('[data-view="katalog"]'),
    daten: (d) => { d.katalog.forEach((k) => { if (k.id === 'k5') k.maxBetrag = null; if (k.id === 'k7') k.betrag = 10; }); return d; } },
};
