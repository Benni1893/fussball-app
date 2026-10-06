/* Messvorschriften für finalmess.mjs: je Screen der Vorlage „Final Alle Screens“
   das Profil im Landkarten-Stand-in und wie die App dorthin kommt.
   ausnahmen: Texte, deren Lage bewusst abweicht (Begründung im Kommentar).
   ohneText:  Soll-Texte, die im Stand-in andere Daten haben (Namen, Beträge).
   erlaubt:   Befunde (Zeilenanfang), die als bewusste Abweichung gelten (ABSCHLUSS.md).
   daten:     Anpassung des Vorlagen-Datensatzes für diesen Screen.            */

const klick = (sel) => async (page) => { await page.click(sel); await page.waitForTimeout(500); };
const ohne = (...ids) => (d) => Object.assign(d, { events: d.events.filter((e) => !ids.includes(e.id)) });

export const SCREENS = {
  // D3: Zähler „Elf aufstellen“ weiß auf --grad-chip-gold (Vorlage: dunkle Schrift auf Gold, 2,9:1).
  '01 Übersicht': { profil: 'admin', erlaubt: ['"1": farbe'] },
  // Die Vorlage zeigt im Kalender das Training am Do 8. Okt nicht (in 01 schon).
  // Menü ··· auch an der Sonstiges-Karte (In Kalender speichern, Pflege): Kopftext schmaler.
  '02 Kalender': { profil: 'admin', vorbereitung: klick('[data-view="kalender"]'), daten: ohne('e-tr2'),
    erlaubt: ['"Sonstiges": w 268→212', '"Mannschaftsabend": w 268→212', '"20:00 Uhr": w 268→212'] },
};
