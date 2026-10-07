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
};
