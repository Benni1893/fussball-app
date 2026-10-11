# Anmeldung und Onboarding: Abschluss

Nachtlauf 11.10.2026. Branch **`onboarding`**, nicht auf main gemergt.
Grundlage ist main 6c10752. Die Bestandsaufnahme steht in
[PHASE0.md](PHASE0.md).

## Ergebnis in Kürze

- **O0 bis O9 sind umgesetzt**:
  - O0 Bestandsaufnahme und O1 Datenbank mit je eigenem Commit;
  - O2 bis O9 in einem gemeinsamen Frontend-Commit (Begründung unter
    „Annahmen“, A1).
- **Migration 0061** zuerst als Probe mit Zurückrollen bestanden, danach
  eingespielt. Prüfskript `0061_onboarding_pruef.sql`: **101/101** (je Rolle
  und für „wartet auf Freigabe“).
- **Alle Prüfskripte 0042 bis 0061 grün.** Nachgezogen sind 0050, 0051,
  0056 und 0059.
- **End-to-End-Lauf gegen die echte Datenbank:** `onboarding_e2e.mjs`
  **47/47**. Danach sind alle Testdaten gelöscht, die Datenbank steht wieder
  im Ausgangsstand (Abschnitt 6).
- **Pflichtliste 25/25 grün**, neu ist `onboardingpruef`.
- **390-px-Abgleich:** bestehende Screens unverändert, 27/27, Bauteile 17/17.
- **Gerätematrix-Teillauf** über 22 neue und geänderte Zustände: **0 Befunde** außerhalb der Ausnahmeliste, nach zwei Runden.
- **Wichtig für dich:** Im Supabase-Dashboard ist die **Registrierung
  abgeschaltet** („Allow new users to sign up“). Solange das so bleibt,
  scheitert jede Registrierung über den Einladungslink mit „Registrieren ist
  im Moment gesperrt“. Abschnitt 4, Schritt 1.

## 1. Stand je Teilpaket

| Teil | Stand | Inhalt |
|---|---|---|
| O0 | fertig (de9ec4a) | PHASE0.md: Anmeldeweg, Rollen und RLS (live gelesen), PayPal fest im Code, BFV nur in der Oberfläche auf Admin begrenzt, eine Mannschaft (`fcfn`), Push und Home-Bildschirm, Datenschutzliste |
| O1 | fertig (21f04a3) | Migration 0061, siehe Abschnitt 3 |
| O2 | fertig | „Rollen verwalten“ › **Einladung**: Link anzeigen, teilen (dasselbe Teilen-Fenster wie „Übersicht teilen“), kopieren, erneuern (mit Rückfrage; der alte Link wird ungültig). Erreichbar für Trainer und Admin |
| O3 | fertig | Link `…/#einladung=<token>` öffnet die Registrierung mit **Name, E-Mail, Passwort**. Ohne gültigen Link gibt es keine Registrierung: Die Maske zeigt „Registrieren geht nur über den Einladungslink“, und serverseitig bricht der Trigger ohne Token ab. Ein ungültiger oder erneuerter Link bekommt einen eigenen Hinweis |
| O4 | fertig | Schritte Datenschutz → Position → Zum Home-Bildschirm (iPhone und Android getrennt; entfällt in der Home-Bildschirm-App) → Mitteilungen erlauben (nur in der Home-Bildschirm-App) → Wartebildschirm. „Später weitermachen“ meldet ab; der Stand bleibt erhalten (Einwilligung und Position auf dem Server, Home und Push auf dem Gerät) |
| O5 | fertig | „Rollen verwalten“ › **Offene Anfragen**. Das Blatt zeigt E-Mail, Position und die Zuordnung zu „Neuer Kadereintrag“ oder einem Kadereintrag ohne Konto, dazu Freigeben und Ablehnen. Push `anfrage_neu` an Trainer und Admin, `konto_freigegeben` an die Person; Vorlagen unter Push-Texte, Ruhezeiten über `notification_due` |
| O6 | fertig | **Mitglieder** mit Rollen-Blatt: Schalter Trainer und Kassenwart, Admin nur für den Admin. Dazu „Aus der Mannschaft entfernen“ und das **Protokoll**. Schutzregeln liegen auf dem Server. Push `rolle_geaendert` an die Person. BFV-Spielplan für Trainer freigeschaltet (Oberfläche, `set_ical_url`, `/api/sync-bfv`) |
| O7 | fertig | PayPal-Link als Einstellung der Mannschaft (`team_settings.paypal_name`, vorbelegt mit dem bisherigen Wert). Pflege durch Kassenwart und Admin (Profil › PayPal bzw. Rollen verwalten › Kasse). Ein neuer Kassenwart wird beim Öffnen gefragt. Verliert der Hinterleger die Rolle, fällt der Link weg, und Spieler sehen statt des Zahlknopfs einen Hinweis |
| O8 | fertig | Hauptposition Torwart, Abwehr, Mittelfeld, Sturm. Im Profil ersetzt sie die Rückennummer und ist änderbar. Sie bestimmt die Positionsgruppe in Aufstellung und Spielerauswahl. Kader: siehe Annahme A6 |
| O9 | fertig | Seiten `datenschutz.html` und `impressum.html` mit Platzhaltern, erreichbar vor und nach der Anmeldung. Einwilligung Gesundheitsstatus im Onboarding und im Profil, mit Widerruf (löscht Status, Notiz und Datum). Am Notizfeld der Hinweis „optional, keine Diagnosen“. Einmalige Datenschutzfrage für bestehende Konten. „Konto löschen“ im Profil und auf dem Wartebildschirm |

## 2. Annahmen

- **A1 Commits.** O2 bis O9 hängen an denselben Stellen von app.js: Start,
  Anmeldung, Profil, Rollen-Seite. Einzeln wäre kein Zwischenstand
  lauffähig; eine Registrierung ohne Onboarding führte zum Beispiel ins
  Leere. Deshalb ein gemeinsamer Frontend-Commit, die Teile stehen einzeln
  in der Commit-Nachricht. O0 und O1 sind eigene Commits.
- **A2 Ort der neuen Verwaltung.** Einladung, Anfragen, Mitglieder,
  Protokoll und PayPal liegen auf der vorhandenen Seite **„Rollen
  verwalten“**. In den Einstellungen sehen Trainer und Admin die Zeile
  „Rollen“, der Admin wie bisher. Neue Zeilen in den Einstellungen hätten den
  bestehenden Screen 18 verändert.
- **A3 Registrierung sperren.**
  - `handle_new_user` lehnt jedes neue Konto ohne gültiges Token ab.
  - Das gilt auch für die alte Registrierung der Live-App auf main und für
    „Nutzer anlegen“ im Supabase-Dashboard (gewollt nach E1).
  - Konten für Tests oder Ausnahmen gehen nur mit Token in den Metadaten.
- **A4 Live-App bleibt.** Die drei Konten sind `aktiv`, ihre Rollen und
  Sicht sind unverändert. Neue Lese-Policies, `has_role` und `my_roles`
  verlangen „Mitglied“, das erfüllen alle drei. Die Live-App nutzt weiter
  ihre PayPal-Konstante.
- **A5 Datenbank geteilt.** Vorschau und Live-App nutzen dieselbe
  Datenbank. Alles, was die Vorschau schreibt (Einwilligungen, Position,
  PayPal), ist live.
  - Beim ersten Öffnen der Vorschau fragt die App dein Konto einmal nach
    der Datenschutz-Zustimmung. Die Live-App fragt nicht.
- **A6 Kader.** Die Kader-Ansicht behält Aufbau und Sortierung, sonst hätte
  sich der bestehende Screen 09 geändert.
  - Die Position fließt in die Aufstellung: `pos` wird aus der
    Hauptposition abgeleitet, die Spielerauswahl gruppiert schon nach
    Position.
  - Sie fließt auch ins Status-Blatt im Kader.
  - Eine Sortierung des Kaders nach Position wäre ein eigener Auftrag.
- **A7 Gesundheitsstatus ohne Konto.** Für Spieler mit Konto verlangt der
  Server die Einwilligung des Kontos. Spieler **ohne Konto** (heute 15 von
  16) können wie bisher vom Trainer auf angeschlagen oder verletzt gesetzt
  werden, weil sie nicht einwilligen können. Das gehört in die
  Datenschutzerklärung oder muss geklärt werden (offener Punkt).
- **A8 Datenschutz-Zustimmung** lässt sich nur durch Löschen des Kontos
  zurücknehmen. Ohne sie ist keine Nutzung möglich.
- **A9 Ablehnung.**
  - Ein abgelehntes Konto bleibt bestehen und sieht nur „Anfrage
    abgelehnt“, Abmelden und „Konto löschen“.
  - Trainer und Admin sehen es nicht mehr in der Liste der Anfragen.
- **A10 Löschen und Entfernen.**
  - **Gelöscht wird:** Konto (auth), Profil, Rollen, Push-Geräte,
    Einstellungen, Einwilligungen, Status, Rückmeldungen sowie Notizen an
    Strafen.
  - **Anonymisiert wird:** Der Kadereintrag bleibt als „Ehemaliger Spieler“
    mit neutralem Code. Er ist aus Kader und Aufstellung ausgeblendet, die
    Kasse behält die Beträge.
  - **Protokoll:** Einträge zum Konto heißen danach „gelöschtes Konto“.
- **A11 PayPal „Später“.** Der neue Kassenwart wird bei jedem Öffnen wieder
  gefragt, bis er einen Link speichert.
- **A12 Push an Admin.** `anfrage_neu` geht an Trainer und Admin. Den
  Schalter „Neue Anfragen“ sehen nur Trainer; für einen reinen Admin ist die
  Mitteilung immer an, sonst hätte sich der bestehende Screen 19 verändert.
- **A13 Build-Kennung.** O0 ist reine Dokumentation, ohne neue Kennung.
  O1 hat 2026-10-11-A, das Frontend 2026-10-11-B.
- **A14 Teststand der Registrierung.** Da die Registrierung im Dashboard
  gesperrt ist, prüft der End-to-End-Lauf die Maske bis zur Meldung. Das
  Konto entsteht dann mit denselben Metadaten per SQL; derselbe Trigger
  prüft Token und Namen. Nach dem Freischalten (Abschnitt 4) bitte einmal
  echt testen (iPhone-Liste, Punkt 2).

## 3. Migrationen und Prüfskripte

**0061_onboarding.sql** (ein `do`-Block, Gegenprobe mit zwei
zurückgerollten Durchgängen). Sicherung vorher:
`C:/Users/Benjamin/fussball-app-db/sicherungen/2026-10-11_vor-onboarding`
(18 Tabellen, 797 Zeilen).

| Bereich | Neu |
|---|---|
| Spalten | `profiles`: `freigabe` (bestehend aktiv, neu wartet), `anzeigename`, `angefragt_am`, `wunsch_position`, `eingeladen_ueber`, `entschieden_von/_am`, `paypal_frage`. `players`: `hauptposition`, `ausgeschieden_am`. `team_settings`: `paypal_name`, `paypal_von`, `paypal_am`. `notification_prefs`: `anfrage_neu` |
| Tabellen (RLS an, keine Policies) | `einladungen` (ein gültiger Link je Mannschaft), `konto_protokoll`, `einwilligungen` (Art, Fassung, erteilt, widerrufen) |
| Mitgliedschaft | `ist_mitglied()`, `ist_leitung()`, `leitung_anzahl()`; `has_role`/`my_roles` nur für Mitglieder; Lese-Policies von clubs, events, fines, fine_catalog, players und team_settings nur für Mitglieder; `set_my_player`, Kalender-Token nur für Mitglieder |
| Registrierung | `handle_new_user`: gültiges Token und Name Pflicht, Konto wartet, Protokoll, Push an die Leitung |
| RPCs | `einladung_pruefen` (auch anon), `einladung_holen`, `einladung_erneuern`, `mein_konto`, `einwilligung_setzen`, `meine_position_setzen`, `anfragen_liste`, `kader_frei`, `anfrage_freigeben`, `anfrage_ablehnen`, `mitglieder_liste`, `rolle_setzen`, `protokoll_liste`, `paypal_setzen`, `paypal_frage_erledigt`, `konto_loeschen`, `mitglied_entfernen` |
| Geändert | `set_player_status` (Gesundheit nur mit Einwilligung), `set_ical_url` (nur Trainer und Admin), `kategorie_rolle`/`kategorie_erlaubt` (Rolle `leitung`), `notification_due`, `set_notification_prefs` |
| Push | Kategorien `anfrage_neu` (📋), `konto_freigegeben` (✅), `rolle_geaendert` (🔑), Vorlagen unter Push-Texte änderbar |

**Schutzregeln, serverseitig:**
- Trainer vergeben und entziehen nur Trainer und Kassenwart; Admin vergibt
  nur der Admin.
- Es bleibt immer mindestens ein aktives Konto mit Trainer oder Admin. Das
  gilt beim Rollenentzug, beim Löschen des eigenen Kontos und beim Entfernen.
- Den Admin entfernt nur der Admin.
- Jede Freigabe, Ablehnung, Rollenänderung, Löschung und Entfernung sowie
  jede Änderung an Einladung und PayPal wird protokolliert (wer, wann, was).

**Prüfskripte:**
- `0061_onboarding_pruef.sql`: 101/101. Es deckt anon, Wartend, Spieler,
  Trainer, Kassenwart, Admin und intern ab, jede neue RPC und Tabelle, die
  Schutzregeln, Freigabe, Ablehnung, Anonymisierung, erneuerten Link,
  Registrierung ohne Token und ohne Namen sowie den Erhalt der bestehenden
  Konten.
- Nachgezogen:
  - 0050 und 0059 (48 Funktionen für authenticated);
  - 0051 (BFV nur für Trainer und Admin);
  - 0056 (16 Kategorien plus test, Emoji, Deep Links, 18/18 Vorlagen).

## 4. Dashboard-Schritte für dich (Supabase und Vercel)

Ich habe im Dashboard nichts geändert.

**Supabase** › Projekt `pjgkgsepjsvewwkffzsm` › Authentication:

1. **Sign In / Providers › „Allow new users to sign up“ einschalten.** Heute
   ist es aus (Antwort `signup_disabled`). Die Einladung schützt
   serverseitig: Ohne gültigen Link legt die Datenbank kein Konto an.
2. **Email › „Confirm email“ ausschalten** (E3: die Freigabe ersetzt die
   Bestätigung). Bleibt sie an, bekommt jede neue Person eine
   Bestätigungsmail und muss erst klicken. Das funktioniert auch, ist aber
   ein Schritt mehr; die App zeigt dann „Bitte bestätige deine E-Mail“.
3. **URL Configuration:**
   - **Site URL** auf die Live-Adresse.
   - Unter **Redirect URLs** ergänzen:
     - die Live-Adresse;
     - die Vorschau-Adresse des Branches
       `https://fasanerie-nord-2-git-onboarding-benni1893s-projects.vercel.app/**`;
     - für die Vorschauen allgemein
       `https://fasanerie-nord-2-*-benni1893s-projects.vercel.app/**`.
   - Nötig ist das für den Passwort-Reset, der auf die aktuelle Seite
     zurückführt.
4. **Eigener Mailversand vor dem breiten Einsatz** (Project Settings ›
   Authentication › SMTP Settings):
   - Der eingebaute Versand ist stark begrenzt (wenige Mails pro Stunde) und
     nur für Tests gedacht.
   - Einen Anbieter eintragen (z. B. Brevo, Postmark, Mailjet; EU-Server
     wählen): Host, Port, Benutzer, Passwort, Absender (z. B.
     `app@<vereinsdomain>`).
   - Danach unter Rate Limits die Mailgrenze passend setzen.
   - Für Passwort-Reset (und Bestätigung, falls an) ist das Pflicht.
5. **Email Templates** (optional): Texte für „Reset Password“ auf Deutsch.

**Vercel** › Projekt `fasanerie-nord-2`:

6. Die Vorschau hat dieselben Umgebungsvariablen wie die Produktion nur,
   wenn sie für „Preview“ angehakt sind. Das betrifft `SUPABASE_URL`, die
   Schlüssel, `VAPID_*` und `CRON_SECRET`. Ohne sie funktionieren in der
   Vorschau der BFV-Abgleich und der Push-Versand nicht. Die App selbst läuft
   trotzdem, weil sie `config.js` nutzt.
7. Ist der **Deployment-Schutz** an, braucht die Vorschau ein Vercel-Login.
   Für den Test auf dem iPhone mit dem eigenen Konto ist das kein Problem.
   Andere Testpersonen brauchen einen Freigabe-Link (Settings › Deployment
   Protection › Shareable Link).

## 5. Datenschutz: Region, Dienste, Datenarten

Aus PHASE0.md, als Grundlage für Datenschutzerklärung und Verträge
(Auftragsverarbeitung).

- **Datenbank:** Supabase, **AWS eu-central-1 (Frankfurt)**.

| Dienst | Rolle | Daten |
|---|---|---|
| Supabase (Frankfurt) | Auftragsverarbeiter, AV-Vertrag im Dashboard (DPA) | E-Mail, Passwort-Hash, Anmeldezeiten und IP (Auth-Logs); Name, Position, Rückennummer; Zu- und Absagen mit Grund; Status mit Notiz und Datum (**Gesundheitsdaten**, nur mit Einwilligung); Strafen, Zahlungen, Zahlart, Notizen; Push-Endpunkte und User-Agent; Mitteilungs-Einstellungen; Kalender-Token; Einwilligungen (Art, Fassung, Zeitpunkt); Protokoll (wer, wann, was) |
| Vercel (Hosting, API) | Auftragsverarbeiter, DPA | IP und Browserdaten jedes Aufrufs (Logs); Push-Inhalte (Titel, Text, oft mit Namen) beim Versand; Kalenderdaten per Token; BFV-Abgleich. **Region der Funktionen im Projekt prüfen** (Settings › Functions; Frankfurt `fra1` wählen) |
| Apple Push Notification Service | Empfänger | Push-Endpunkt, verschlüsselter Inhalt, Zeitpunkt |
| Google Firebase Cloud Messaging | Empfänger | wie Apple, für Android und Chrome |
| Google Fonts | Dritter, ohne Vertrag | **IP und Browserdaten bei jedem App-Start** |
| jsDelivr | Dritter, ohne Vertrag | IP und Browserdaten beim Laden von supabase-js |
| PayPal | eigener Verantwortlicher | nur beim Tipp auf „Zahlen“: Betrag und Weiterleitung, danach Daten bei PayPal |
| BFV | Datenquelle | keine Daten der Nutzer |

## 6. Prüfung

**End-to-End gegen die echte Datenbank** (`.design-sync/shots/onboarding_e2e.mjs`,
lokal ausgeliefert mit echter `config.js`, 47/47):

- **Trainer:**
  - einmalige Datenschutzfrage, Einladungslink anzeigen und erneuern;
  - alter Link ungültig, neuer gültig, geprüft per API als anon.
- **Registrierung:**
  - Der alte Link zeigt einen Hinweis, der neue die Maske mit Name.
  - Wegen der Dashboard-Sperre zeigt die Maske die Sperrmeldung. Das Konto
    wird danach mit denselben Metadaten angelegt (A14).
- **Onboarding:**
  - Schritte Datenschutz (Weiter erst nach Zustimmung), Position und
    Home-Bildschirm;
  - „Später weitermachen“ und Fortsetzen beim offenen Schritt;
  - Wartebildschirm. Position, Freigabestatus und zwei Einwilligungen
    stehen in der Datenbank.
- **Wartendes Konto per API:**
  - events, players, fines, fine_catalog, rsvps, player_status,
    team_settings, clubs und lineups: je 0 Zeilen;
  - Anfragenliste und Kalender-Token gesperrt, `my_roles` leer.
- **Freigabe und Ablehnung:**
  - Eine zweite Anfrage wird abgelehnt.
  - Freigabe mit Zuordnung zu einem Kadereintrag ohne Konto (eigens
    angelegter Testeintrag), die Position kommt aus dem Onboarding.
  - Danach liest das Konto die Termine.
- **Rollen:**
  - Der Trainer vergibt Kassenwart und sieht keinen Admin-Schalter.
  - Der neue Kassenwart wird nach PayPal gefragt und speichert den Link.
  - Beim Entzug der Rolle ist der Link weg.
- **Gesundheitsstatus:**
  - Mit Einwilligung lässt sich verletzt speichern; am Notizfeld steht der
    Hinweis.
  - Der Widerruf löscht Status, Notiz und Datum und speichert den Zeitpunkt.
  - Ohne Einwilligung kommt erst die Frage.
- **Position** im Profil geändert.
- **Konto löschen:**
  - Konto weg, Kadereintrag anonymisiert;
  - Strafe bleibt mit Betrag und ohne Notiz;
  - Rückmeldungen gelöscht, Protokoll ohne Namen.
- **Protokoll beim Trainer:** Freigabe, Ablehnung, Rolle, Einladung,
  Löschung.

**Testkonten und Aufräumen:**
- Testkonten (Gmail-Plus): `wplauck+fne2e<lauf>trainer@…`,
  `…spieler@…` und `…abgelehnt@…`.
- Es wurden keine Mails versandt, weil die Registrierung gesperrt ist und
  die Konten per SQL entstanden.
- Während des Laufs waren die drei Onboarding-Vorlagen aus, es gab also
  keinen Push.
- Am Ende wurden alle Testkonten, Test-Kadereinträge, Teststrafen,
  Rückmeldungen, Einladungen und Protokolleinträge gelöscht. PayPal und
  Vorlagen sind wiederhergestellt.
- **Beleg** (Konten/Profile/Spieler/Strafen/Rückmeldungen/Status/Einladungen/
  Protokoll/Einwilligungen/Outbox/PayPal/Vorlagen):

  ```
  vorher   3/3/16/308/37/16/0/0/0/35/Teamkassefasanerie:799234a7-…/true,true,true
  nachher  3/3/16/308/37/16/0/0/0/35/Teamkassefasanerie:799234a7-…/true,true,true
  ```

- Zwei frühere Läufe brachen vorher ab (Registrierungssperre entdeckt,
  Blatt-Scrollen behoben). Auch nach ihnen war der Stand gleich. Beim ersten
  musste ich die abgeschalteten Vorlagen von Hand wieder einschalten.

**RLS-Prüfskript:** siehe Abschnitt 3.

**Stand-in, Pflichtliste und Landkarte:**
- Neu: `onboardingpruef` (25. Skript).
- Angepasst: `landkartenrauch` (Profil „Wartet auf Freigabe“), `einpruef`
  (Trainer sieht Spielplan und Rollen), `prefspruef` (`anfrage_neu`).
- Neue Landkarten-Zustände:
  - Profil „Wartet auf Freigabe“: Datenschutz, Deine Position, Zum
    Home-Bildschirm, Warte auf Freigabe;
  - `anmeldung/registrieren`;
  - `rollen-verwalten` mit Freigabe-, Rollen-, PayPal- und Teilen-Blatt;
  - im Profil Position-, PayPal- und Konto-löschen-Blatt;
  - zwei neue Rückfragen.
- Die eingebetteten Bilder der Gesamtkarte sind etwas stärker komprimiert
  (unter 15 MB).

**Gerätematrix-Teillauf**:
- 22 Zustände, je 9 Breiten × 2 Schriftgrößen × 3 Varianten:
  - die vier Onboarding-Schritte;
  - Registrierung und Anmeldung;
  - „Rollen verwalten“ mit vier Blättern;
  - Profil (zwei Wege) mit Position-, Konto-löschen- und PayPal-Blatt;
  - Spielplan BFV, Einstellungen, Mitteilungen.
- **Runde 1:** 74 Befunde in 4 Gruppen:
  - Einladungslink abgeschnitten;
  - Datenschutz-Schritt mit waagerechtem Überlauf bei 320 und 360 px, weil
    lange Einzelwörter in den Schaltertiteln standen;
  - Text dort abgeschnitten (320 px, 130 %);
  - E-Mail im Freigabe-Blatt mitten im Wort umgebrochen.
- **Behoben:**
  - Link und E-Mail kürzen mit Auslassungspunkten;
  - die Schaltertitel heißen „Datenschutz: Ich stimme zu“ und „Verletzt und
    angeschlagen“;
  - unter 375 px hat die Onboarding-Karte weniger Innenrand.
- **Runde 2:** **0 Befunde**. Ausnahmen: nur `teilen-x-unterzeile` (27 Stellen,
  Teilen-Fenster der Einladung).
- Ergebnisse unter `.design-sync/geraetematrix/onboarding-2026-10-11/` und
  `…-r2/`; Befundbilder nur lokal.

## 7. Vercel-Vorschau

- Branch-Adresse:
  **https://fasanerie-nord-2-git-onboarding-benni1893s-projects.vercel.app**
- Letzter Stand: Commit 45f2ce6 (Build 2026-10-11-B), Deployment **https://fasanerie-nord-2-k14lp1mtc-benni1893s-projects.vercel.app** (Status READY).

## 8. iPhone-Testliste

Mit deinem Konto auf der Vorschau, keine Pushs an Spieler. Vorher
Abschnitt 4, Schritte 1 bis 3.

1. **Vorschau in Safari öffnen und anmelden:** Einmalig kommt die
   Datenschutzfrage. Zustimmen, optional den Gesundheitsstatus erlauben,
   danach die gewohnte App.
2. **Rollen verwalten** (Einstellungen › Rollen):
   - Einladungslink teilen, per WhatsApp an dich selbst schicken;
   - in Safari mit einer zweiten Gmail-Plus-Adresse registrieren
     (Name, E-Mail, Passwort).
3. **Onboarding des neuen Kontos:**
   - Datenschutz, Position;
   - „Zum Home-Bildschirm“: Teilen › Zum Home-Bildschirm;
   - die neue App vom Home-Bildschirm öffnen und dort anmelden;
   - Mitteilungen erlauben;
   - Wartebildschirm.
4. **Mit deinem Konto:**
   - Push „Neue Anfrage“ kommt an (außerhalb der Ruhezeit).
   - Rollen verwalten › Offene Anfragen › „Neuer Kadereintrag“ ›
     Freigeben.
5. **Das neue Konto:**
   - Push „Du bist freigegeben“;
   - „Erneut prüfen“ öffnet die App;
   - Konto › Profil zeigt die Position.
6. **Mit deinem Konto:**
   - dem Testkonto Kassenwart geben → das Testkonto wird nach PayPal
     gefragt;
   - Kassenwart wieder entziehen → Push „Deine Rolle hat sich geändert“.
   - Danach unter Rollen verwalten › Kasse den PayPal-Link wieder auf
     „Teamkassefasanerie“ setzen.
7. **Testkonto:**
   - Profil › Gesundheitsstatus aus → Status, Notiz und Datum weg;
   - verletzt antippen → erst die Frage.
8. **Testkonto: Profil › Konto › Löschen.** Danach steht der Kadereintrag
   als „Ehemaliger Spieler“, die Kasse behält eventuelle Beträge.
9. **Link erneuern:** Der alte Link zeigt „nicht mehr gültig“.
10. **Seiten Datenschutz und Impressum** aus Anmeldung und Profil öffnen;
    „Zurück zur App“ führt zurück.

## 9. Offene Punkte

1. **Registrierung im Supabase-Dashboard freischalten** und
   E-Mail-Bestätigung ausschalten (Abschnitt 4). Bis dahin ist die
   Registrierung über den Link nicht möglich.
2. **Eigener Mailversand (SMTP)** vor dem breiten Einsatz.
3. **Texte für Datenschutzerklärung und Impressum** (Platzhalter in
   `datenschutz.html`, `impressum.html`). Bei Textänderungen `DS_FASSUNG` in
   app.js hochzählen; dann fragt die App bei der nächsten Anmeldung nicht neu.
   Eine erneute Zustimmung bei neuer Fassung wäre ein kleiner Zusatz.
4. **Gesundheitsstatus für Spieler ohne Konto** (A7) klären.
5. **Google Fonts und jsDelivr** selbst ausliefern (Inter und supabase-js ins
   Repo). Dann gibt es keine Dritten ohne Vertrag.
6. **Vercel-Funktionsregion** auf Frankfurt prüfen.
7. **Kader nach Position sortieren** (A6), falls gewünscht.
8. **Merge auf main** erst nach deinem Test: Die Live-App würde dann die
   neue Anmeldung, das Onboarding und den PayPal-Link aus den Einstellungen
   nutzen.
9. **Stash auf main:** „Nachtlauf 09.10. Bericht und Ergebnisse (wartet auf
   Entscheidung)“ liegt unverändert im Stash. Er gehört nicht zu diesem
   Paket.

## 10. Commits

| Commit | Inhalt | Build |
|---|---|---|
| de9ec4a | O0 Bestandsaufnahme | (keine) |
| 21f04a3 | O1 Migration 0061, Prüfskripte | 2026-10-11-A |
| 45f2ce6 | O2 bis O9 Frontend, Stand-in, Prüfungen, Bericht | 2026-10-11-B |
| (dieser) | Bericht: Commit und Vorschau nachgetragen | (keine) |
