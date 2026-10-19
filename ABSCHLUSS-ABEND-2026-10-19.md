# Abschluss Abend 19.10.2026

Produktion: https://fasanerie-nord-2.vercel.app mit Build **`2026-10-19-F`**, letzter Commit auf `main` ist `4a5b987`.
Heute Abend gab es keine Migration, kein Testkonto und keine Änderung an Echtdaten. Benjamin Lauck und die Termine sind unberührt.

## Was live ist

| Schritt | Stand | Commit | Build | Prüfung |
|---|---|---|---|---|
| 1 Build D | live | `6f29548` | `2026-10-19-D` | Pflichtliste 32/32, validate, check-conventions grün. `db.js` nicht committet (nur Zeilenenden). |
| 2 Logo in der Kopfzeile | live | `78e18df` | `2026-10-19-E` | 33/33 grün, neu `logopruef`. Auf der Produktion nachgesehen: Logo im Cache des Service Workers. |
| 3 Doku Rechte-Entscheidungen | im Repo | `992df58` | unverändert | nur Doku |
| 4 Android als echte App | live | `431aca5` | `2026-10-19-F` | 34/34 grün, neu `androidpruef`. Chromes Installationsprüfung auf der Produktion ohne Fehler. |
| 5 Untere Leiste | **nicht geändert** | – | – | siehe unten |
| 6 Flüssigkeit | gemessen, nichts umgebaut | `4a5b987` | unverändert | siehe unten |

### 1 Build D

- 24-Stunden-Regel in der App, Auge an allen Passwortfeldern, `startregelnpruef`, `RECHTE.md`, `rechtetabelle.mjs`.
- Die Prüfrunde lief komplett neu in einer frischen Prüfkopie.
- Zwei Stolpersteine, beide von der Prüfkopie und nicht vom Code:
  - `rechtpruef` liest `.design-sync/rechtliches/`. Der Ordner ist bewusst nicht im Repo und fehlte deshalb. Ich habe ihn hineinkopiert, danach war `rechtpruef` grün.
  - Die lokalen Landkarten-Bilder vom 15.10. waren zu alt für den Bundle-Bau. Ich habe sie mit dem Crawl neu erzeugt, `landkarte.json` blieb dabei unverändert. Die neuen Bilder liegen jetzt auch im Arbeitsverzeichnis.
- `HANDOFF.md` habe ich gelöscht, dieser Bericht ersetzt sie.

### 2 Logo

- **Ursache:** Beim Kaltstart der Home-Bildschirm-App scheitert die erste Anfrage an `assets/logo.png`. Ein gescheitertes Bild lädt nie neu. Mit `alt="FC Fasanerie-Nord"` und automatischer Breite stand dann der Name im kaputten Bildsymbol und gleich daneben noch einmal als Titel. Die Anmeldeseite wird später gezeichnet und lud deshalb. Der Service Worker hatte das Logo bisher nicht im Cache.
- **Behoben:**
  - Kopfzeilen-Logo mit `alt=""` und festen Maßen.
  - Bei einem Fehler ist das Bild unsichtbar statt kaputt. Es lädt neu nach 1,5 s und nach 5 s, sobald das Netz zurück ist und wenn die App wieder in den Vordergrund kommt.
  - `logo.png` und das Splash-Icon liegen im Cache des Service Workers (Cache zuerst).
- **Bereits installierte Geräte:** Die neue Worker-Version holt das Logo beim Update in den Cache, eine Neuinstallation ist nicht nötig. Das prüft `logopruef` mit einem Gerät, das noch den alten Worker hat.
- **iPhone:** Gemeldet war das Problem nur auf Android. Ob das iPhone auch betroffen war, kann ich ohne Gerät nicht belegen; möglich wäre es, denn es gilt derselbe Mechanismus. Die Lösung wirkt dort genauso, `logopruef` ist in WebKit (Safari-Engine) grün.
- Die Anmeldeseite habe ich nicht geändert: Das Logo dort hat feste Maße und lädt.

### 3 Doku

- In `RECHTE.md` sind die Entscheidungen oben vermerkt und die Soll-Spalte angepasst:
  - Jeder Trainer darf Trainer vergeben.
  - „Ich bin Trainer“ kommt nach dem Start.
  - Spieler sehen weiter die offenen Strafen aller und den Kassenstand.
- Die beiden Fragen sind als beantwortet markiert.
- In `NOTES.md` steht die Liste „Nach dem Start“ mit deinen 9 Punkten in deiner Reihenfolge. Dazu kommen Punkt 10 (Flüssigkeit am Gerät messen) und Punkt 11 (untere Leiste am Gerät prüfen).

### 4 Android als echte App

- **Befund:** Die Produktion war für Chrome **schon vorher installierbar**. Chromes eigene Prüfung über das DevTools-Protokoll fand keine Fehler. Manifest, Icons 192 und 512 und der Service Worker mit fetch-Handler waren in Ordnung.
- Das Chrome-Symbol am Icon heißt: Die App wurde als **Verknüpfung** angelegt und nicht als echte App (WebAPK). Wahrscheinlich ging das über „Zum Startbildschirm hinzufügen“, so stand es bisher in unserem Onboarding.
- Eine Verknüpfung wird nie von selbst zur App. **Auf deinem OnePlus musst du sie entfernen und neu installieren** (Testliste unten).
- **Gebaut:**
  - Eigenes maskable Icon `assets/icon-maskable-512.png`. Bisher war das maskable Icon dieselbe Datei wie das normale 512er-Icon. Weil das Wappen dort bis an den Rand reicht, hätte Android den Schriftring abgeschnitten.
  - Das Onboarding nennt nur noch „⋮ › App installieren“.
  - In der Einführung steht auf der Seite „Auf den Home-Bildschirm“ der Knopf **„App installieren“**, sobald Chrome die Installation anbietet. Daneben steht „Nicht jetzt“.
  - „So geht's › Neues Handy“ nennt den Weg je System.
- **Beleg:** Lighthouse hat seit Version 12 keine PWA-Prüfung mehr. Ich habe deshalb dieselbe Prüfung genommen, die Chrome vor dem Installieren macht (`Page.getInstallabilityErrors`): auf Build F installierbar, keine Fehler, alle drei Icons 200.

### 5 Untere Leiste: so gelassen

- `viewport-fit=cover` ist schon gesetzt, und die Navigation hat schon einen Safe-Area-Abstand nach unten (`max(8px, env(safe-area-inset-bottom))`).
- Zeichnet Chrome die Seite bis unter den Wischstrich (Edge-to-Edge), reicht das Weiß also von selbst bis unten. Färbt Chrome die Systemleiste selbst, hängt die Farbe von der Chrome-Version ab und davon, ob die App als echte App oder als Verknüpfung läuft. Das kann ich ohne Gerät weder auslösen noch prüfen.
- Jede weitere CSS-Änderung wäre geraten und könnte auf dem iPhone etwas verschlechtern. Deshalb habe ich nichts geändert.
- Bitte erst nach der Neuinstallation als echte App ansehen (Testliste). Steht unter „Nach dem Start“ als Punkt 11.

### 6 Flüssigkeit

- Gemessen mit `perfmess.mjs`:
  - Admin-Ansicht bei 412 px, Android, Touch-Gesten, CPU 4-fach gedrosselt.
  - Je Wert der Median aus 3 Läufen.
  - Headless ohne echte GPU, parallel lief dein Video-Rendern. Die absoluten Werte sind deshalb nur ein Anhalt.

| Ablauf | Bildabstand Mittel | p95 | Bilder über 50 ms |
|---|---|---|---|
| Übersicht scrollen | 18,1 ms | 35 ms | 1 % |
| Blatt öffnen und wischen | 20,1 ms | 37 ms | 2 % |
| Einführung wischen | 19,5 ms | 41 ms | 3 % |

- Je Effekt gab es einen Lauf, in dem nur dieser Effekt abgeschaltet war: backdrop-filter der Navigation, drop-shadow an Logo und Wappen, alle Schatten, alle Verläufe, alle Animationen.
- **Kein Effekt war messbar teuer**, alle Varianten lagen im Rauschen. Deshalb habe ich nichts umgebaut.
- Kandidaten mit Messwerten stehen in `NOTES.md` unter „Nach dem Start“:
  - Einführung: Jeder Seitenwechsel baut die Karte neu auf, Layout etwa 20 ms je Wechsel.
  - Rückmeldungen-Blatt: eine lange Task um 50 ms beim Öffnen.
  - backdrop-filter der Navigation: auf echten Android-GPUs prüfen.

## Was ausgelassen wurde und warum

- **Schritt 5:** Ohne Gerät nicht sauber prüfbar, Risiko fürs iPhone (siehe oben).
- **Schritt 6, Umbauten:** Kein Effekt war messbar teuer, also gab es nichts Risikoarmes mit Nutzen.
- **Anmeldeseite, Alt-Text:** Nicht geändert, das Logo lädt dort und hat feste Maße.
- **`theme_color`:** Im Manifest steht `#144a37`, im Meta-Tag `#17573f`. Das ist kein Installationskriterium. Eine Angleichung würde die Statusleiste sichtbar ändern, deshalb habe ich es gelassen.

## Offene Fragen an dich

1. **Android-Neuinstallation:** Soll ich für den Start einen Hinweis für Android-Nutzer ergänzen, etwa: „Zeigt dein App-Symbol ein kleines Chrome-Zeichen, entferne es und installiere über ⋮ › App installieren neu.“? Am Starttag installieren alle zum ersten Mal, betroffen ist vermutlich nur dein Gerät.
2. **`theme_color` angleichen:** Sollen Manifest und Meta-Tag dieselbe Farbe bekommen? Wenn ja, welche, `#144a37` (dunkler) oder `#17573f`? Das ändert sichtbar die Statusleiste.
3. **backdrop-filter der Navigation:** Darf er nach dem Start weg, falls er auf dem OnePlus messbar bremst? Optisch fast gleich, die Navigation ist zu 94 % deckend weiß.
4. **Datenauskunft in der App:** Sie steht weder vor noch nach dem Start in deiner Liste. Soll sie in „Nach dem Start“, und an welche Stelle?
5. **`rechtpruef` und `.design-sync/rechtliches/`:** Das Pflichtskript liest eine Datei aus einem Ordner, der bewusst nicht im Repo liegt. Soll nur `datenschutz-impressum.md` ins Repo? Oder soll das Skript ohne den Ordner auskommen?
6. **Alt-Text der Anmeldeseite:** Soll er auch `alt=""` bekommen? Der Vereinsname steht dort direkt darunter.

## Testliste für morgen

**Android (OnePlus, Chrome)**
1. Altes App-Symbol (mit Chrome-Zeichen) lange drücken › Entfernen.
2. https://fasanerie-nord-2.vercel.app in Chrome öffnen › Menü ⋮ › **App installieren** › Installieren.
3. Das neue Symbol hat kein Chrome-Zeichen. Unter Einstellungen › Apps steht „FC Fasanerie-Nord“.
4. App öffnen: Logo in der Kopfzeile ist da, der Name steht nur einmal.
5. App schließen (aus der App-Übersicht wischen) und neu öffnen, dreimal hintereinander: Logo jedes Mal da.
6. Flugmodus an, App öffnen: Offline-Seite erscheint. Flugmodus aus, „Neu laden“: Logo erscheint.
7. Untere Leiste ansehen: Ist unter der weißen Navigation noch ein grüner Streifen? Bitte Foto.
8. Übersicht scrollen, Rückmeldungen-Blatt öffnen und nach unten wischen, Einführung wischen (Einstellungen › So geht's › Einführung ansehen): ruckelt etwas?
9. Einstellungen › So geht's › „Neues Handy“: Text nennt „⋮ › App installieren“.

**iPhone (App vom Home-Bildschirm)**
1. App öffnen: Logo in der Kopfzeile da, Name nur einmal.
2. App schließen und neu öffnen: Logo da.
3. Untere Navigation: unverändert, nichts verschoben oder abgeschnitten.
4. Einführung (Einstellungen › So geht's › Einführung ansehen), Seite „Auf den Home-Bildschirm“: Knopf „Weiter“ wie bisher, kein „App installieren“.
5. Anmelden, Passwort-Auge, Zusage und Absage wie gewohnt.

## Aufgeräumt

- Prüfkopie `C:/Users/Benjamin/fussball-app-db/wt-d`: Junction gelöst, Worktree entfernt.
- Logs der Prüfrunden: `C:/Users/Benjamin/fussball-app-db/pflicht-D1`, `pflicht-E1`, `pflicht-F1`.
- Weiter nicht im Repo: `db.js` (nur Zeilenenden), `.design-sync/onboarding/ABNAHME.md`, `.design-sync/rechtliches/`.
