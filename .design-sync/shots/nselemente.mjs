/* Messvorschriften für nsmess.mjs (Paket „Nachschliff Oktober“).
   soll: figur (id in der Vorlage), rahmen (Index der Telefonrahmen in der Figur),
         wurzel (Funktion als Text: Rahmen -> Element)
   ist:  profil, schluessel (Landkarten-Zustand) und/oder vorbereitung(page), wurzel (Selektor)
   ersetze: Ist-Text -> Soll-Text (andere Testdaten); ohne: Soll-Texte, die nicht verglichen werden. */
import { daten } from './landkartenmodul.mjs';

export const NS_ELEMENTE = {
  // D1: erste Kachel (Betrag offen). Betrag aus dem Stand-in, daher ersetzt.
  D1: {
    soll: { figur: 'D1', rahmen: 0, wurzel: '(f) => f.children[1]' },
    ist: { profil: 'spieler', schluessel: 'dashboard', wurzel: '.kasse-kachel' },
    ersetze: { '37,00 €': '4.606,00 €' }, breiteFrei: ['4.606,00 €'],
  },
  // D1, Zustand nichts offen: Betrag grün (--green-800).
  'D1 null': {
    soll: { figur: 'D1', rahmen: 0, wurzel: '(f) => f.children[3]' },
    ist: { profil: 'spieler', schluessel: 'dashboard', wurzel: '.kasse-kachel', daten: () => { const d = daten(); d.strafen = d.strafen.filter((x) => x.status !== 'offen'); return d; } },
  },
};
