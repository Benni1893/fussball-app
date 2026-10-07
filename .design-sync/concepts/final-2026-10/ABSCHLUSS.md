# Abschluss: Übernahme „Final Alle Screens“

Stand 07.10.2026, Build **2026-10-07-D**. Vorlage: Claude-Design-Projekt
„FC Fasanerie-Nord Design-Review“, Datei „Final Alle Screens“, gespiegelt
unter `.design-sync/concepts/final-2026-10/`. Ausführliche Deltas in
`DELTA.md`, Messregeln je Screen in `.design-sync/shots/finalscreens.mjs`.

Ergebnis: **Design übernommen.** Alle 27 gemessenen Screens sind bei 390 px
grün (Toleranz ±1 px, Ausnahmen je Screen in `finalscreens.mjs` begründet).

## 1. Screens

Messung: `node .design-sync/shots/finalmess.mjs alle` (Soll aus der Vorlage,
Ist aus der App mit dem Vorlagen-Datensatz im Stand-in). Vergleichsbild je
Screen (Soll | Ist) unter
`.design-sync/concepts/final-2026-10/vergleich/<Screen>.png` (lokal, per
`.gitignore` nicht versioniert; neu erzeugbar mit dem Messlauf).

| Screen | Teil | Status | Messung |
|---|---|---|---|
| 01 Übersicht | A | übernommen | grün, 75 Texte zugeordnet; vergleich/01 Übersicht.png |
| 02 Kalender | A | übernommen | grün, 49 Texte zugeordnet; vergleich/02 Kalender.png |
| 03 Termin anlegen (Blatt) | A | übernommen, mit Treffzeit (Migration 0058) | grün, 19 Texte zugeordnet; vergleich/03 Termin anlegen.png |
| 04 Rückmeldungen-Blatt | A | übernommen, drei Knöpfe nach Vorgabe | grün, 23 Texte zugeordnet; vergleich/04 Rückmeldungen.png |
| 06 Trainer · Spielauswahl | B | übernommen | grün, 48 Texte zugeordnet; vergleich/06 Trainer.png |
| 07 Platz und Bank | B | übernommen | grün, 44 Texte zugeordnet; vergleich/07 Platz.png |
| 07b Platz · Position frei | B | übernommen (neu) | grün, 28 Texte zugeordnet; vergleich/07b Platz frei.png |
| 07c Blatt · Spieler für die Position | B | übernommen (neu) | grün, 34 Texte zugeordnet; vergleich/07c Position besetzen.png |
| 08 Blatt · Spieler für die Bank | B | übernommen | grün, 28 Texte zugeordnet; vergleich/08 Bank-Blatt.png |
| 09 Kader | B | übernommen | grün, 39 Texte zugeordnet; vergleich/09 Kader.png |
| 10 Blatt · Status ändern | B | übernommen (neu) | grün, 8 Texte zugeordnet; vergleich/10 Status-Blatt.png |
| 11 Konto, Ich | C | übernommen | grün, 25 Texte zugeordnet; vergleich/11 Konto Ich.png |
| 12 Konto, Mannschaft | C | übernommen | grün, 32 Texte zugeordnet; vergleich/12 Konto Mannschaft.png |
| 13 Kasse, Gemeldet | C | übernommen | grün, 21 Texte zugeordnet; vergleich/13 Kasse Gemeldet.png |
| 14 Kasse, Offen | C | übernommen | grün, 37 Texte zugeordnet; vergleich/14 Kasse Offen.png |
| 15 Blatt Buchen | C | übernommen (neu) | grün, 17 Texte zugeordnet; vergleich/15 Buchen.png |
| 16 Strafe verhängen (Blatt) | C | übernommen | grün, 22 Texte zugeordnet; vergleich/16 Strafe verhängen.png |
| 17 Strafenkatalog | C | übernommen | grün, 36 Texte zugeordnet; vergleich/17 Katalog.png |
| 18 Einstellungen | D | übernommen | grün, 34 Texte zugeordnet; vergleich/18 Einstellungen.png |
| 19 Mitteilungen | D | übernommen | grün, 11 Texte zugeordnet; vergleich/19 Mitteilungen.png |
| 20 Kalender abonnieren | D | übernommen | grün, 15 Texte zugeordnet; vergleich/20 Kalender-Abo.png |
| 21 Profil | D | übernommen (Rückennummer statt Position) | grün, 12 Texte zugeordnet; vergleich/21 Profil.png |
| 22 Anmeldung | – | **ausgenommen**, Folgepaket | – |
| 23 Ruhezeiten | E | übernommen | grün, 12 Texte zugeordnet; vergleich/E 23 Ruhezeiten.png |
| 24 Spielplan BFV | E | übernommen | grün, 18 Texte zugeordnet; vergleich/E 24 Spielplan BFV.png |
| 25 Push-Texte (nur Admin) | E | übernommen | grün, 13 Texte zugeordnet; vergleich/E 25 Push-Texte.png |
| 26 Rollen, Mehr-Blatt | – | **ausgenommen** (Vorlage markiert entfallen) | – |
| 27 Diagnose | E | übernommen | grün, 14 Texte zugeordnet; vergleich/E 27 Diagnose.png |
| 28 Blatt · Anleitung Google | E | übernommen | grün, 13 Texte zugeordnet; vergleich/E 28 Blatt · Anleitung Google.png |

Schritt 4: Design-System-Karten nachgezogen. Die 13 Karten unter
`.design-sync/cards/Ansichten/` werden jetzt aus dem echten Markup der App
erzeugt (`.design-sync/shots/kartenbau.mjs`); Bausteine und Grundlagen von
Hand auf die neuen Klassen gezogen. 126 tote CSS-Regeln entfernt
(`.design-sync/shots/totecss.mjs`), dazu die Tokens `--gold-600`,
`--gold-050`, `--muted-2`, `--grad-tk-kopf`, `--tk-menue`,
`--bdg-venue-bg/-line/-fg`. `validate.sh` und `check-conventions.sh` OK.

## 2. Bewusste Abweichungen von der Vorlage

1. **Bottom-Nav** Übersicht, Kalender, Katalog, Konto plus fünfter Tab nach Rolle (Vorgabe).
2. **Rückmeldungen-Blatt**: „Push senden“ mit Empfängerzahl, Bestätigung und sichtbarer 12-Stunden-Sperre (`send_rsvp_reminder`), dazu „Teilen“ und „Übersicht teilen“ (Vorgabe).
3. **Push-Texte und Testnachricht** nur für Admin (Vorgabe).
4. **Zähler der Aufgabenzeilen** (D3) behalten die Goldfläche, weil die Vorlagenfarbe nur 2,93:1 bzw. 3,97:1 erreicht.
5. **Hero-Pille „Nächster Termin“** und „LV frei“ dunkel statt hell (D4), Kontrast 4,5:1.
6. **Zahlart im Buchen-Blatt** dreiteilig (Bar, PayPal, Überweisung); die Vorlage zeigt nur Bar und PayPal, Überweisung ist eine bestehende Funktion.
7. **Formationschips** über dem Hinweis statt darunter (Platz), damit der Hinweis an der freien Position steht.
8. **Menge** in „Strafe verhängen“ als Stepper mit 44-px-Knöpfen.
9. **Diagnose** behält die Gruppe „Hilfe“ (Online, Letzter Fehler, Cache leeren, Protokoll).
10. **„Spieltag“** in Ruhezeiten ist der bestehende Schalter „Dringendes zustellen“.
11. **„Aufstellung veröffentlicht“** (19, 25) nicht gebaut (D6), Folgepaket.
12. **Profil**: Rückennummer statt Position (ausgenommen); Abmelden unten im Profil.
13. **„App neu laden“** ohne Chevron (K6, Regel „› nur, wenn die Zeile wegführt“).
14. **Typografische Anführungszeichen** statt der geraden der Vorlage; keine Gedankenstriche und keine ASCII-Umlaute in Texten.
15. **Zielgrößen 44 px** auch dort, wo die Vorlage kleiner zeichnet (Liste in `DELTA.md`, Abschnitt 5).
16. **Funktionen ohne Vorlage** bleiben im Stil der Vorlage erhalten (Liste in `DELTA.md`, „Funktionen, die heute existieren …“), u. a. Termin absagen, BFV-Felder, Vorlagen umbenennen und löschen, Individuelle Strafe, Push-Texte „Alle senden“ und „Vorschauen löschen“.
17. **Ungereimtheiten im Vorlagen-Datensatz** (Summen, Zähler) wurden nicht nachgebaut; die App rechnet aus den Daten.

## 3. Gekippte frühere Entscheidungen

- **Urlaub blau** statt grau (D2, Festlegung vom 18.09.2026).
- **Tokens der Vorlage** gelten, darunter `--bg-1`, `--bg-2`, `--shadow-card` mit langem Auslauf (D1, K8; die offene Schattenfrage aus Paket A ist damit entschieden).
- **Übersicht**: Karte „Nächstes Spiel“ entfällt, das Spiel steht unter „Danach“ (D9).
- **Kasse**:
  - Zusammenfassung hell statt dunkel.
  - Knopf nur mit Verb („Strafe speichern“, „Als bezahlt buchen“), das Ergebnis steht in der Zusammenfassung.
  - „Offen“ je Spieler nach Betrag statt älteste Strafe zuerst.
  - Geisterkarten im Prüfstapel wieder da.
  - Zahlart als Segment statt Chips mit Symbol.
  - Kennzahl-Kacheln oben entfallen.
  - Zähler nur an „Gemeldet“.
  - Gruppenkopf „Prüfen und verbuchen“ entfällt.
  - „In der Kasse“ zeigt nur bezahlte Strafen.
  - „Strafe verhängen“ als Blatt statt Vollbildseite.
- **Konto**:
  - Kennzahl getönt statt mit rotem Streifen.
  - Banner ohne Fortschrittsbalken.
  - Countdown als rote Marke.
  - Avatar der Prüfkarte mit Verlauf.
- **Katalog**: Bearbeiten im Blatt statt inline.
- **Einstellungen** (K1 bis K18):
  - Symbolkacheln einheitlich hell (K1).
  - Kalender-Abo auf einer Ebene (K2).
  - Gruppentitel grau (K3).
  - Zeilenmaße der Vorlage (K4).
  - Profilzeile kompakt (K5).
  - Abmelden ins Profil (K7).
  - Schalter flach (K9).
  - Ruhezeiten als „Nachts stumm“ und „Ausnahmen“ (K10).
  - Mitteilungen und Push-Texte nach Thema statt nach Rolle, der Rollenfilter bleibt (K11, K12).
  - Push-Texte ohne Kopf, die Funktionen bleiben (K13).
  - Diagnose mit den Gruppen App und Gerät (K14).
  - Zurück als einfacher Verweis (K15).
  - BFV mit Statuskarte und „Jetzt abgleichen“ (K16).
  - Titel „Kalender abonnieren“ und „Spielplan BFV“ (K17).
  - Profil als Unterseite (K18).

## 4. Annahmen

1. Die Treffzeit ist eine optionale Uhrzeit je Termin (HH:MM) und muss vor dem Anstoß liegen.
2. „Push senden“ steht nur echten Trainern und Admins vor Terminbeginn zur Verfügung, nicht in der Admin-Simulation.
3. Die Empfängerzahl im Push-Knopf zählt dieselben Spieler, die `send_rsvp_reminder` erreicht (Probelauf mit `nurZaehlen`).
4. `#kasse=pruefen` und `#strafen=meine` zeigen auf „Gemeldet“ bzw. das Segment „Ich“, weil Push-Vorlagen darauf verlinken (D8).
5. „Neuer oder geänderter Termin“ in Mitteilungen schaltet beide bestehenden Kategorien gemeinsam.
6. Die Rollen-Zeile in den Einstellungen sieht nur der Admin, die Mitgliederzahl erscheint nach dem Laden.
7. Der Kontobetrag steht in 52 px wie gezeichnet, andere Beträge in 40 px (D10).
8. Ein erneuter Tipp auf einen aktiven Konto-Chip setzt den Filter auf „Alle“ zurück.
9. Die Build-Kennung steht nur noch in der Diagnose.
10. Der Vorlagen-Datensatz im Stand-in gilt als Messgrundlage, echte Daten wurden für die Messung nicht verwendet.

## 5. Migrationen, Commits, Build

- **Migration** `supabase/migrations/0058_treffen.sql`: Spalte `events.treffen` (Text, Prüfung HH:MM). Ein `do`-Block mit Gegenprobe, eingespielt. Prüfskript `supabase/checks/0058_treffen_pruef.sql` 8/8 PASS. Keine Rechte- oder RLS-Änderung, keine bestehenden Nutzerdaten verändert.
- **DB-Prüfskripte** 0042 bis 0058 grün (Push-Automatik intakt).
- **Commits**:
  - `ed2ce23` Teil A: Übersicht, Kalender;
  - `6f31019` Teil A: Termin anlegen, Rückmeldungen, Migration 0058;
  - `a9df92f` Teil B: Trainer, Kader;
  - `894bd04` Teil C: Konto, Kasse, Katalog;
  - `dafab32` Teil D und E: Einstellungen und Unterseiten;
  - Commit „Final Schritt 4“ (mit diesem Bericht): Design-System-Karten, tote Klassen und Tokens.
- **Build** 2026-10-07-D.

## 6. iPhone-Testliste

**Teil A: Übersicht, Kalender, Termin, Rückmeldungen**
1. Übersicht: Hero zeigt den nächsten Termin mit Goldwürfel, Countdown „in … h“ läuft, Zu- und Absage reagiert sofort.
2. Kalender: „+ Termin“ öffnet das Blatt, Spiel mit Treffzeit anlegen, Treffzeit erscheint in der Karte.
3. Treffzeit nach dem Anstoß eingeben: Hinweis „Treffzeit liegt nach dem Anstoß“, Speichern gesperrt.
4. Rückmeldungen-Blatt als Trainer: „Push senden (N)“, Bestätigung, danach 12-Stunden-Sperre sichtbar (erst nach 08:00 testen).
5. „Teilen“ und „Übersicht teilen“ öffnen das Teilen-Menü von iOS.

**Teil B: Trainer und Kader**
1. Trainer: nächstes Spiel, Vorlage über ··· umbenennen und löschen.
2. Platz: Position antippen, Blatt „Spieler für die Position“, Spieler setzen; freie Position zeigt den Ring.
3. Bank-Blatt: Spieler hinzufügen und entfernen.
4. Kader: Status eines Spielers im Blatt „Status ändern“ setzen (Notiz und „bis“ erscheinen nur außer „fit“).

**Teil C: Konto, Kasse, Katalog**
1. Konto: Ich und Mannschaft wechseln, Chip antippen und erneut antippen (zurück auf Alle).
2. Kasse Gemeldet: Meldung bestätigen und ablehnen, Geisterkarten darunter.
3. Kasse Offen: Spieler antippen, im Blatt Buchen Strafen wählen, Zahlart wählen, „Als bezahlt buchen“.
4. Strafe verhängen: Katalogstrafe mit Menge 2 und individuelle Strafe.
5. Katalog: Eintrag antippen, im Blatt ändern und löschen.

**Teil D und E: Einstellungen**
1. Mitteilungen: Hauptschalter, einzelne Themen; Testnachricht nur als Admin sichtbar.
2. Kalender abonnieren: Abo direkt in iOS-Kalender öffnen, Link kopieren.
3. Profil: Passwort ändern im Blatt, Abmelden.
4. Ruhezeiten: Von und Bis ändern, „Dringendes zustellen“ schalten.
5. Diagnose: „Bericht kopieren“, „Cache leeren“.

## 7. Offen wegen Freigabe

Nichts. Kein Schritt brauchte in der Nacht eine Freigabe.

Weiter offen und unabhängig davon: Live-Test der Push-Automatik wartet auf
„Live-Test jetzt“ (08:00 bis 21:30). Folgepaket „Anmeldung und Onboarding“
ist in `PLAN.md` vorgemerkt.
