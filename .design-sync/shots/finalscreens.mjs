/* Messvorschriften für finalmess.mjs: je Screen der Vorlage „Final Alle Screens“
   das Profil im Landkarten-Stand-in und wie die App dorthin kommt.
   ausnahmen: Texte, deren Lage bewusst abweicht (Begründung im Kommentar).
   ohneText:  Soll-Texte, die im Stand-in andere Daten haben (Namen, Beträge).   */

const klick = (sel) => async (page) => { await page.click(sel); await page.waitForTimeout(500); };

export const SCREENS = {
  '01 Übersicht': { profil: 'admin' },
  '02 Kalender': { profil: 'admin', vorbereitung: klick('[data-view="kalender"]') },
};
