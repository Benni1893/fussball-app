/* Messvorschriften für nsmess.mjs (Paket „Nachschliff Oktober“).
   soll: figur (id in der Vorlage), rahmen (Index der Telefonrahmen in der Figur),
         wurzel (Funktion als Text: Rahmen -> Element)
   ist:  profil, schluessel (Landkarten-Zustand) und/oder vorbereitung(page), wurzel (Selektor)
   ersetze: Ist-Text -> Soll-Text (andere Testdaten); ohne: Soll-Texte, die nicht verglichen werden. */
import { daten } from './landkartenmodul.mjs';

// Kader wie in der Vorlage D6: alle fit, einer verletzt (15 fit · 1 verletzt)
const kaderD6 = () => { const d = daten(); d.players.forEach((p) => Object.assign(p, p.id === 'p05' ? { status: 'verletzt' } : { status: 'fit', statusNote: null, statusUntil: null })); return d; };
// Eigener Spieler (p06) mit dem Status aus der Vorlage D4
const mitStatus = () => { const d = daten(); const p = d.players.find((x) => x.id === 'p06'); Object.assign(p, { status: 'angeschlagen', statusNote: 'Wade zu', statusUntil: '2026-10-18', statusSince: '2026-10-01' }); return d; };

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
  // D2: Popover am ⋯ einer Trainingskarte im Kalender (Trainer-Rechte: alle drei Einträge).
  D2: {
    soll: { figur: 'D2', rahmen: 0, wurzel: '(f) => f.children[1]' },
    ist: { profil: 'admin', schluessel: 'kalender', wurzel: '#tkMenu .tkp',
      vorbereitung: async (page) => { await page.click('.tk-kopf.is-training .tk-menue'); await page.waitForTimeout(300); } },
    ersetze: { 'Training · 6. Okt': 'Training · 8. Okt' },
  },
  // D3: Blatt Strafe bearbeiten (Katalog, erste Strafe).
  D3: {
    soll: { figur: 'D3', rahmen: 0, wurzel: '(f) => f.children[2]' },
    ist: { profil: 'admin', schluessel: 'katalog+katBlatt', wurzel: '#katBlatt .kat-blatt' },
    hoehe: 900, breite: 390,
    // Werte stehen in der App in Eingabefeldern (kein Textknoten)
    ohne: ['Zu spät zum Spiel / Treffpunkt', '10,00'],
  },
  // D4: Auswahl, Zeile und Blatt mit dem Stand der Vorlage (angeschlagen bis 18. Okt, Wade zu).
  'D4 Auswahl': {
    soll: { figur: 'D4', rahmen: 0, wurzel: '(f) => f.children[1]' },
    ist: { profil: 'spieler', schluessel: 'dashboard', wurzel: '.st-raster', daten: () => mitStatus() },
  },
  'D4 Zeile': {
    soll: { figur: 'D4', rahmen: 0, wurzel: '(f) => f.children[2]' },
    ist: { profil: 'spieler', schluessel: 'dashboard', wurzel: '.st-zeile', daten: () => mitStatus() },
  },
  'D4 Blatt': {
    soll: { figur: 'D4', rahmen: 1, wurzel: '(f) => f.children[2]' },
    ist: { profil: 'spieler', schluessel: 'dashboard', wurzel: '#statusFenster .nsb', daten: () => mitStatus(),
      vorbereitung: async (page) => { await page.click('.st-knopf.st-angeschlagen'); await page.waitForTimeout(300); } },
    breite: 390, ohne: ['optional'],
  },
  // D5: Kennzahlen in Konto › Mannschaft (Beträge und Anzahlen aus dem Stand-in).
  D5: {
    soll: { figur: 'D5', rahmen: 0, wurzel: '(f) => f.children[1]' },
    ist: { profil: 'kassenwart', schluessel: 'strafen', wurzel: '.kt-kacheln',
      vorbereitung: async (page) => { await page.click('[data-kseg="team"]'); await page.waitForTimeout(400); } },
    ersetze: { '37,00 €': '4.611,00 €', '6,00 €': '1.097,00 €', '4 Strafen': '240 Strafen', '2 Zahlungen': '61 Zahlungen' },
    breiteFrei: ['4.611,00 €', '1.097,00 €', '240 Strafen', '61 Zahlungen'],
  },
  // D6: Fuß des Rückmeldungen-Blatts (Kopf, Balken, Liste bleiben wie Final 04) und Dialog.
  'D6 Kader': {
    soll: { figur: 'D6', rahmen: 0, wurzel: '(f) => f.children[1].children[5]' },
    ist: { profil: 'admin', schluessel: 'dashboard+rsvpSheet', wurzel: '.rs2-kader-b', daten: () => kaderD6() },
    breite: 390,
  },
  'D6 Knöpfe': {
    soll: { figur: 'D6', rahmen: 0, wurzel: '(f) => f.children[1].children[6]' },
    ist: { profil: 'admin', schluessel: 'dashboard+rsvpSheet', wurzel: '.rs2-knoepfe', vorbereitung: async (page) => { await page.waitForTimeout(400); } },
    breite: 390,
  },
  'D6 Dialog': {
    soll: { figur: 'D6', rahmen: 1, wurzel: '(f) => f.children[1]' },
    ist: { profil: 'admin', schluessel: 'dashboard+rsvpSheet', wurzel: '#pushModal .push-best',
      vorbereitung: async (page) => { await page.waitForTimeout(400); await page.click('[data-rs-push]'); await page.waitForTimeout(300); } },
    breite: 390, ersetze: { 'Push an 2 offene Spieler senden?': 'Push an 15 offene Spieler senden?', 'TSV Beispielstadt · So 4. Okt · 15:00': 'Training · Do 8. Okt · 19:30' },
    breiteFrei: ['Push an 15 offene Spieler senden?', 'Training · Do 8. Okt · 19:30'],
  },
  // E1 (Vorlage D7): Blatt Mehr der Aufstellung.
  E1: {
    soll: { figur: 'D7', rahmen: 0, wurzel: '(f) => f.children[2]' },
    ist: { profil: 'admin', schluessel: 'trainer/spiel+tvSheetMenu', wurzel: '#tvSheetMenu' },
    breite: 390, ersetze: { 'vs. TSV Beispielstadt · So 4. Okt': 'vs. FC Teutonia Mün. 2 · So 11. Okt', '4-2-3-1': '4-3-3', 'Grundelf': '4-3-3 Standard' },
    breiteFrei: ['vs. FC Teutonia Mün. 2 · So 11. Okt', '4-3-3', '4-3-3 Standard', 'Anwenden'],
  },
};
