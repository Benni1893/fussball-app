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
};
