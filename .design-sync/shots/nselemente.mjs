/* Messvorschriften für nsmess.mjs (Paket „Nachschliff Oktober“).
   soll: figur (id in der Vorlage), rahmen (Index der Telefonrahmen in der Figur),
         wurzel (Funktion als Text: Rahmen -> Element)
   ist:  profil, schluessel (Landkarten-Zustand) und/oder vorbereitung(page), wurzel (Selektor)
   ersetze: Ist-Text -> Soll-Text (andere Testdaten); ohne: Soll-Texte, die nicht verglichen werden. */
import { daten } from './landkartenmodul.mjs';

// Kader wie in der Vorlage D6: alle fit, einer verletzt (15 fit · 1 verletzt)
const kaderD6 = () => { const d = daten(); d.players.forEach((p) => Object.assign(p, p.id === 'p05' ? { status: 'verletzt' } : { status: 'fit', statusNote: null, statusUntil: null })); return d; };
// Bank wie in der Vorlage D8: niemand im Urlaub (Fußzeile: auf dem Platz · verletzt)
const bankD8 = () => { const d = daten(); d.players.forEach((p) => { if (p.status === 'urlaub') Object.assign(p, { status: 'fit', statusNote: null, statusUntil: null }); }); return d; };
// Bezahlte Strafe wie in der Vorlage D9 (f03: gemeldet und per PayPal eingegangen)
const strafeD9 = () => { const d = daten(); const x = d.strafen.find((y) => y.id === 'f03'); Object.assign(x, { vergehen: 'Rote Karte (unsportlich)', betrag: 22, datum: '2026-09-26', createdAt: '2026-09-26T19:48:00Z', gemeldetAm: '2026-09-28T14:42:00Z', paidAt: '2026-10-07T07:26:00Z', zahlart: 'paypal' }); return d; };
// Eigener Spieler (p06) mit dem Status aus der Vorlage D4
const mitStatus = () => { const d = daten(); const p = d.players.find((x) => x.id === 'p06'); Object.assign(p, { status: 'angeschlagen', statusNote: 'Wade zu', statusUntil: '2026-10-18', statusSince: '2026-10-01' }); return d; };

export const NS_ELEMENTE = {
  // D1: Kassenbanner unten auf der Uebersicht (ersetzt seit 15.10.2026 die Kachel
  // Mannschaftskasse). Fuer das Banner gibt es keine Figur in der Vorlage: soll: null,
  // nsmess prueft die Ist-Wurzel und die erwarteten Texte und legt das Ist-Bild ab.
  D1: {
    soll: null,
    ist: { profil: 'spieler', schluessel: 'dashboard', wurzel: '.kb' },
    texte: ['In der Kasse', 'Noch offen'],
  },
  // D1, Zustand nichts offen und nichts gemeldet: Alles bezahlt.
  'D1 null': {
    soll: null,
    ist: { profil: 'spieler', schluessel: 'dashboard', wurzel: '.kb.is-clear', daten: () => { const d = daten(); d.strafen = d.strafen.filter((x) => x.status !== 'offen' && x.status !== 'gemeldet'); return d; } },
    texte: ['In der Kasse', 'Alles bezahlt', 'Kein Spieler hat offene Strafen'],
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
  // D5: Kassenbanner in Konto › Mannschaft (ersetzt seit 15.10.2026 die Kacheln Offen
  // und In der Kasse), Kassenwart-Sicht mit beiden Knoepfen. Ohne Vorlage-Figur wie D1.
  D5: {
    soll: null,
    ist: { profil: 'kassenwart', schluessel: 'strafen', wurzel: '.kb',
      vorbereitung: async (page) => { await page.click('[data-kseg="team"]'); await page.waitForTimeout(400); } },
    texte: ['In der Kasse', 'Noch offen'], knoepfe: 2,
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
  // E2 (Vorlage D8): Bank-Blatt, Kopf, freie Zeile, Bank-Zeile, Fußzeile.
  'E2 Kopf': {
    soll: { figur: 'D8', rahmen: 0, wurzel: '(f) => f.children[1].children[1]' },
    ist: { profil: 'admin', schluessel: 'trainer/spiel+tvSheetKader#bank', wurzel: '#tvSheetKader .tv-sh' },
    breite: 390,
  },
  'E2 Zeile frei': {
    soll: { figur: 'D8', rahmen: 0, wurzel: '(f) => f.children[1].children[3]' },
    ist: { profil: 'admin', schluessel: 'trainer/spiel+tvSheetKader#bank', wurzel: '#tvSheetKader .tvb-zeile:not(.is-bank)' },
    breite: 390, ersetze: { '6': '1', 'Felix Oberhaus': 'Tobias Wagner', 'ZM · keine Rückmeldung': 'TW · keine Rückmeldung' }, breiteFrei: ['Tobias Wagner', 'TW · keine Rückmeldung', '1'],
  },
  'E2 Zeile Bank': {
    soll: { figur: 'D8', rahmen: 0, wurzel: '(f) => f.children[1].children[5]' },
    ist: { profil: 'admin', schluessel: 'trainer/spiel+tvSheetKader#bank', wurzel: '#tvSheetKader .tvb-zeile.is-bank' },
    breite: 390, ersetze: { '12': '5', 'Oskar Zierer': 'Leon Schmidt', 'TW · auf der Bank': 'IV · auf der Bank' }, breiteFrei: ['Leon Schmidt', 'IV · auf der Bank', '5'],
  },
  'E2 Fuß': {
    soll: { figur: 'D8', rahmen: 0, wurzel: '(f) => f.children[1].lastElementChild' },
    ist: { profil: 'admin', schluessel: 'trainer/spiel+tvSheetKader#bank', wurzel: '#tvSheetKader .tvb-fuss', daten: () => bankD8() },
    breite: 390,
  },
  // E3 (Vorlage D9): Kasse › Bezahlt › Blatt Strafe.
  E3: {
    soll: { figur: 'D9', rahmen: 0, wurzel: '(f) => f.children[1]' },
    ist: { profil: 'kassenwart', schluessel: 'kasse/bezahlt', wurzel: '#ksBl', daten: () => strafeD9(),
      vorbereitung: async (page) => { await page.click('[data-ks-det="f03"]'); await page.waitForTimeout(500); } },
    breite: 390, ersetze: { 'FO': 'LW', 'Felix Oberhaus': 'Lukas Weber', '3,00 €': '22,00 €' }, breiteFrei: ['Lukas Weber', '22,00 €'],
  },
};
