# Merge onboarding → main: Vorbereitung

Stand 11.10.2026. **Nicht gemergt.** Erst nach deinem OK, nach der
iPhone-Testliste (ABSCHLUSS.md, N11).

## Ausgangslage

- **main** steht auf `6c10752`, unverändert seit dem Abzweig.
- **onboarding** liegt 14 Commits darüber; der letzte ist `9fe764f`
  (0071) bzw. der Commit dieser Datei.
- **Merge-Art:** Fast-Forward. Es gibt **keine Konflikte**, main bekommt
  genau den Stand von onboarding.
- **Datenbank:** Alle Migrationen 0061 bis 0071 sind schon live. Der Merge
  ändert an der Datenbank nichts.
- **Stash auf main** (`stash@{0}`, Nachtlauf 09.10.): Der Merge berührt ihn
  nicht.
  - Willst du ihn später anwenden, gibt es genau einen Konflikt in
    `.gitignore`: Beide hängen eine Zeile ans Ende an.
  - Lösung: beide Zeilen behalten
    (`.design-sync/geraetematrix/onboarding-*/befunde/` und
    `.design-sync/geraetematrix/nachtlauf-*/befunde/`).

## Reihenfolge

1. **iPhone-Testliste** auf der Vorschau. Danach die Testkonten löschen und
   den PayPal-Link prüfen (N11, Schritt 6).
2. **Vercel › Settings › Functions › Function Region: `fra1`** (Frankfurt).
   Das geht schon vor dem Merge, dann läuft der Produktions-Deploy gleich in
   Frankfurt. Die Supabase-Datenbank liegt in **eu-central-1 (Frankfurt)**.
3. **Supabase › Authentication:**
   - Confirm email aus (E3);
   - Site URL und Redirect URLs auf die Live-Adresse (ABSCHLUSS.md,
     Abschnitt 4);
   - „Allow new users to sign up“ **erst unmittelbar vor oder nach dem
     Merge** einschalten.
   - Bis zum Merge kennt die Live-App keinen Einladungslink. Eine
     Registrierung ist dort ohnehin nur mit gültigem Link möglich, die
     Datenbank lehnt alles andere ab.
4. **Merge**, durch mich nach deinem OK:
   ```
   git checkout main
   git merge --ff-only onboarding
   git push origin main
   git checkout onboarding
   ```
5. **Vercel baut die Produktion aus main**, etwa 1 Minute. Danach stehen
   auf der Live-Adresse Build `2026-10-11-H` und SW
   `fn-sw-2026-10-11-H`.
6. **Rauchtest auf Produktion**, durch mich mit Playwright, ohne
   Schreiben:
   - Start ohne fremde Hosts (hostpruef `ECHT=1` gegen die Live-Adresse);
   - Anmeldeseite, Einladungslink prüfen (anon);
   - Build-Kennung.
7. **Einladungslink teilen** (Rollen verwalten › Link teilen).

## Was beim Deploy passiert

- **Service Worker:** Die neue Version aktiviert sich sofort (`skipWaiting`,
  `clients.claim`).
  - Offene Apps holen die neue Fassung beim nächsten Laden bzw. Wechsel in
    die App.
  - Schrift (Inter) und supabase-js kommen ab dann aus dem eigenen Cache,
    nicht mehr von Google und jsDelivr.
- **Bestehende Konten**, alle drei bleiben aktiv mit ihren Rollen:
  - **Zwei Konten haben noch keine Datenschutz-Zustimmung.** Sie sehen beim
    ersten Start einmal die Datenschutzfrage, dann die App.
  - **Zwei Konten haben noch keinen Kadereintrag.** Sie sehen wie bisher
    „Welcher Spieler bin ich?“ und wählen einmal. Das bleibt für Konten
    ohne Eintrag erlaubt; danach ordnet nur noch der Trainer um.
  - **Dein Konto** (Admin, Kassenwart) ist unverändert. Neu ist auf Rollen
    verwalten: Einladung, Anfragen, Trainer-Links und Protokoll.
- **Was sich mit dem Merge erledigt:**
  - „Nicht verfügbar“ wird in der Live-App richtig angezeigt und in der
    Aufstellung wie verletzt behandelt. Damit ist Befund 1 der
    Gegenprüfung gelöst.
  - Gesundheitsstatus gibt es nur noch mit Einwilligung. Ohne sie bleiben
    fit, Urlaub und nicht verfügbar.
  - Der PayPal-Link kommt aus den Teameinstellungen, nicht mehr aus dem
    Code. Heute steht dort `Teamkassefasanerie`, der Zahlknopf bleibt also
    gleich.
- **Kasse:**
  - Die fünf Meldungen vom 28.09. zählen jetzt zu deinem Konto (0071).
    Gibst du die Rolle Kassenwart ab, fragt die App nach.
  - Neue Meldungen halten Kassenwart und Link fest.
- **API:**
  - `api/sync-bfv.js` erlaubt den BFV-Abgleich nur noch Trainer und Admin,
    nicht mehr dem Kassenwart (E5).
  - Sonst ist an den Funktionen nichts geändert, es gibt keine neuen
    Umgebungsvariablen.
- **Cron und Push:**
  - Unverändert.
  - Neue Kategorien `kasse_neu` und `kasse_abgegeben` gehen nur bei
    Rollenwechseln raus.
  - Ruhezeiten gelten.
- **Rückweg:**
  - Vercel › Deployments › vorheriges Produktions-Deployment ›
    „Instant Rollback“.
  - Die Datenbank bleibt dabei, wie sie ist. Die alte App läuft dagegen
    wie bis heute, mit den bekannten Lücken: „nicht verfügbar“ als fit,
    verletzt nur mit Einwilligung.
  - Ein Zurückdrehen der Migrationen ist nicht nötig.

## Nicht Teil des Merges

- Push von main, Merge und Dashboard-Schalter nur mit deinem OK bzw. durch
  dich.
- `.design-sync/onboarding/*` und `.design-sync/shots/*` gehen mit nach
  main, ändern aber nichts an der App.
