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


---

# Nachtrag: Onboarding Nacharbeit (11.10.2026)

Branch **`onboarding`**, nicht auf main gemergt, gepusht bis zum
Berichts-Commit. Stash auf main unberührt. Im Supabase-Dashboard und bei
Vercel habe ich nichts geändert.

## N0. Ergebnis in Kürze

- **Punkte 1 bis 7 umgesetzt**, je ein Commit (Tabelle N1). Punkt 3 brauchte
  keine Korrektur, nur Prüfungen.
- **Neun Migrationen (0062 bis 0070)**, jede erst als Probe mit
  Zurückrollen, vorher eine Sicherung unter `sicherungen/`. Drei davon sind
  Korrekturen aus meinen Prüfungen (0066, 0067, 0068), zwei aus der Gegenprüfung (0069, 0070; N3, N4).
- **Alle 29 Prüfskripte grün**, auch die älteren 0042 bis 0061. Nachgezogen
  wurden 0050, 0056, 0059 und 0061.
- **E2E gegen die echte Datenbank:** `onboarding_e2e.mjs` **89/89** (47
  bisherige plus 42 neue). Danach sind alle Testdaten weg, der Stand ist wie
  vorher, die 20 Push-Vorlagen sind gleich (N6).
- **Ein Beinahe-Push an dein Konto ist abgefangen** (N6, Vorfall). Es wurde
  kein Push versandt.
- **Pflichtliste 26/26** (neu: `hostpruef`), 390 px **27/27**, Bauteile
  **17/17**, bei jedem Commit.
- **Gerätematrix-Teillauf** über 20 neue und geänderte Zustände: nach Korrektur **0 Befunde** außerhalb der Ausnahmeliste (N6).
- **Gegenprüfung** durch einen getrennten Agenten: 7 Befunde in Runde 1. Vier sind behoben (0069), eine Lücke daraus in Runde 2 ebenfalls (0070). Drei bleiben offen: Live-App auf main, alte Meldungen, Kleinigkeiten (N4, N12).
- **Beim App-Start gibt es keine fremden Hosts mehr**, nur die eigene
  Adresse (N8).

## N1. Stand je Punkt

| Punkt | Inhalt | Commit | Build | Stand |
|---|---|---|---|---|
| 1 | Schrift (Inter) und supabase-js selbst ausgeliefert, Service Worker cacht sie, `hostpruef` | 251dd6b | 2026-10-11-C | fertig |
| 2 | Gesundheitsstatus nur mit Einwilligung, „nicht verfügbar“ (0062) | 73fb672 | 2026-10-11-D | fertig |
| 3 | PayPal nur Kassenwart und Admin: Prüfung, keine Korrektur nötig | c029c0f | (keiner, App unverändert) | fertig |
| 4 | Trainer-Link (0063) | b858b5e | 2026-10-11-E | fertig |
| 5 | Kassenwart-Wunsch (0064) | 817b39f | 2026-10-11-F | fertig |
| 6 | Kassenwart-Wechsel (0065) und Korrekturen (0066 bis 0068) | 457a787 | 2026-10-11-G | fertig |
| (Gegenprüfung) | Korrekturen aus der Gegenprüfung (0069, 0070), Gerätematrix-Befunde | e8b8d77 | 2026-10-11-H | fertig |
| 7 | Berichte: Nachtlauf, Vercel-Region, dieser Nachtrag | (dieser Commit) | (keiner) | fertig |

**Punkt 1:** Inter v20 (latin, latin-ext) liegt in `fonts/`, supabase-js
2.117.3 in `vendor/`. Das ist byte-gleich mit dem bisherigen jsDelivr-Original
ohne dessen Kopfkommentar. Der Service Worker legt beides beim Installieren
in den Cache und liefert es von dort. Neu gegen neu ist die Darstellung
pixelgleich. Gegen die alte Fassung sind die fünf verglichenen Ansichten
pixelgleich, sobald Google Fonts geladen hatte.

**Punkt 2:**
- **Ohne Einwilligung** (auch für Spieler ohne Konto) gibt es nur fit,
  Urlaub und „nicht verfügbar“, jeweils ohne Notiz, mit „voraussichtlich
  bis“. Verletzt und angeschlagen gehen nur mit Einwilligung. Das prüft der
  Server (`set_player_status`), die Notiz wird ohne Einwilligung immer
  verworfen.
- **Migration 0062** hat die eine bestehende verletzt-Zeile ohne
  Einwilligung in „nicht verfügbar“ umgewandelt. Die Notiz ist weg, das
  Datum ist geblieben.
- **Ein Widerruf** macht dasselbe.
- **„Nicht verfügbar“ zählt wie verletzt** bei der Status-Ablauf-Mitteilung
  (0059), beim Rückmelde-Push (Nachfrage geht nicht an ihn) und in der
  Aufstellung (Bank-Grund).
- **Trainer:** Bei Spielern ohne Einwilligung zeigt das Status-Blatt nur
  die drei erlaubten Status, mit Hinweis und ohne Notizfeld. Der Spieler
  selbst sieht „Erlauben“.

**Punkt 3:**
- `paypal_setzen` lehnt alle außer Kassenwart und Admin ab, schon seit
  0061.
- `team_settings` hat für angemeldete Nutzer keine Schreib-Policy.
- Die einzige weitere Funktion, die den Link anfasst, ist `rolle_setzen`:
  Sie blendet ihn beim Entzug der Kassenwart-Rolle aus (E8).
- Neu: Prüfskript `0061_paypal_rechte_pruef.sql` (22/22), Playwright im
  Stand-in und gegen die echte Datenbank.

**Punkt 4:**
- **Rechte:** Trainer-Links erzeugt, listet und widerruft nur der Admin.
  Jeder Link gilt genau einmal und 7 Tage.
- **Verbrauch:** Der Link wird im Registrierungs-Trigger verbraucht. Wer zu
  spät kommt (benutzt, abgelaufen, widerrufen), bekommt kein Konto.
- **Konto:** sofort aktiv mit Spieler und Trainer, ohne Freigabe.
- **Onboarding:** dasselbe wie sonst (Datenschutz, Position, Home,
  Push), dazu „Spielst du mit?“:
  - freien Kadereintrag wählen;
  - neuen anlegen, mit Name und Position;
  - „Ich spiele nicht mit“, dann ohne Kadereintrag.
  - Danach „Alles bereit“ statt Wartebildschirm.
- **Oberfläche:** Abschnitt „Trainer-Links“ auf Rollen verwalten, nur für
  den Admin (auch nicht in der Admin-Vorschau als Trainer). Dort erzeugen,
  teilen, kopieren und widerrufen; benutzte und abgelaufene Links stehen
  mit Datum darunter.
- **Spieler-Link** bleibt einer je Mannschaft bis zum Widerruf (E9). Das
  Erneuern lässt Trainer-Links stehen.

**Punkt 5:**
- **Registrierung:** Haken „Ich bin Kassenwart“ nur beim Spieler-Link. Er
  ist nur ein Wunsch, ohne jedes Recht.
- **Anfragen:** Die Liste zeigt die Marke „Kassenwart?“.
- **Freigabe-Blatt:** Der Trainer entscheidet getrennt: freigeben oder
  ablehnen und „Als Kassenwart bestätigen“ (aus als Vorgabe).
- **Bestätigung:** Erst sie vergibt die Rolle und setzt die PayPal-Frage
  (E8).
- **Protokoll:** bestätigt und nicht bestätigt; bei Ablehnung verfällt der
  Wunsch.
- **Ohne Bestätigung** gibt es keinen Zugriff auf Kassendaten: kein
  Verlauf, kein `kassenwart_offen`, kein PayPal, kein Bestätigen. Geprüft
  per API, vor und nach der Freigabe.

**Punkt 6:**
- **Zahlungsziel:** Jede Meldung und jede Bestätigung hält Kassenwart und
  PayPal-Link fest (Trigger). Der Verlauf der Strafe zeigt sie, z. B.
  „Gemeldet · an Mara Vogt (paypal.me/…)“.
- **Entzug mit offenen Meldungen:** Rückfrage „N gemeldete Zahlungen über X
  € an Name“, dann Abbrechen oder „Trotzdem wechseln“. Beim Wechsel bleiben
  die Meldungen gemeldet und tragen „An vorherigen Kassenwart gezahlt: Name“
  auf der Meldekarte und im Blatt.
- **Ohne offene Meldungen** gibt es keine Rückfrage.
- **Mehrere Kassenwarte:** Entzieht der Trainer einem von ihnen die Rolle,
  bleibt der Link des anderen.
- **Pushs:**
  - `kasse_neu` an den neuen Kassenwart („Bitte hinterlege deinen
    PayPal-Link“);
  - `kasse_abgegeben` an den alten, mit Anzahl übergebener Meldungen;
  - beide 🔑 nach dem Emoji-System, in Push-Texte unter „Konto“;
  - Ruhezeiten gelten über `notification_due`.
- **Bis zum neuen Link** zeigt der Zahlknopf den Hinweis (E8). Danach zahlt
  der Spieler an den neuen Link. Geprüft gegen die echte Datenbank.

## N2. Annahmen

- **N-A1 Spieler ohne Konto:** Für sie gelten dieselben Regeln wie ohne
  Einwilligung (fit, Urlaub, nicht verfügbar, ohne Notiz), weil niemand
  einwilligen kann.
- **N-A2 Live-App auf main und „nicht verfügbar“:** Die Live-App kennt den
  neuen Status nicht. Sie zeigt ihn als „nicht fit“ ohne Marke und stürzt
  nicht ab. Bis zum Merge tritt er nur auf, wenn jemand die Vorschau nutzt
  oder widerruft.
- **N-A3 Punkt 3 ohne neuen Build:** Nur Prüfungen, keine App-Änderung,
  deshalb keine neue Build-Kennung.
- **N-A4 Position vor „Spielst du mit?“:** Der Trainer-Link-Weg fragt die
  Position wie jedes Onboarding, auch wenn die Person nicht mitspielt. Sie
  geht in einen neu angelegten Kadereintrag ein.
- **N-A5 Trainer-Links in der Liste:** Gezeigt werden die letzten 60 Tage.
  Den Link selbst (Token) gibt die Liste nur bei offenen Links heraus.
- **N-A6 Kassenwart-Bestätigung ohne Wunsch:** Der Schalter erscheint nur
  bei einem Wunsch. Serverseitig vergibt `anfrage_freigeben` die Rolle nur,
  wenn ein Wunsch vorlag. Ohne Wunsch geht es wie bisher über „Rollen
  verwalten“.
- **N-A7 Kein eigener Push bei bestätigtem Wunsch:** Die Person bekommt
  „Du bist freigegeben“, und die PayPal-Frage erscheint beim Öffnen. Ein
  zweiter Push im selben Moment wäre doppelt.
- **N-A8 Zahlungsziel:**
  - **Bei Meldung** gilt, wer den angezeigten PayPal-Link hinterlegt hat.
  - **Bei direkter Bestätigung** (bar, ohne Meldung) ist es die
    bestätigende Person.
  - **Ohne hinterlegten Link** bleibt die Meldung ohne Ziel.
- **N-A9 Alte Meldungen ohne Ziel** (fünf, vom 28.09.) zählen zu niemandem
  und werden beim Wechsel nicht markiert (0066). Wem sie damals galten, ist
  nicht gespeichert. Raten hätte bestehende Strafen verändert.
- **N-A10 Push-Vorlagen:** 0065 hat die zwei Vorlagen `kasse_neu` und
  `kasse_abgegeben` neu angelegt, aktiv. „Ausgangszustand“ heißt hier: Die
  Tests haben keine Vorlage verändert. Vorher-nachher-Abfrage in N6.
- **N-A11 „Offene Meldungen“ fehlt in der Landkarte:** Das Blatt öffnet ein
  Rollenschalter, und die Landkarte schaltet keine Rollen. Ich habe es per
  Stand-in-Prüfung (`onboardingpruef`), per E2E und per Bild bei 390 px
  geprüft.
- **N-A12 Neues Landkarten-Profil** „Neuer Trainer (Link)“ für das offene
  Onboarding eines Trainer-Link-Kontos. Zwei Warnungen „Pfad nicht
  wiederholbar“ wie beim Profil „Wartet auf Freigabe“: Das Stand-in merkt
  sich den Schritt.

## N3. Migrationen und Prüfskripte

Jede Migration ist **ein** `do`-Block mit Gegenprobe. Vor jeder lief die
Probe mit `rollback` und eine Sicherung unter
`C:/Users/Benjamin/fussball-app-db/sicherungen/2026-10-11_vor-00xx-…`.

| Migration | Inhalt | Probe | Prüfskript |
|---|---|---|---|
| 0062 | Status „nicht verfügbar“, Gesundheit nur mit Einwilligung, Umwandlung (1 Zeile), Widerruf | bestanden | 0062: 28/28 |
| 0063 | Trainer-Link: Art, gültig bis, einmalig, Admin-RPCs, Registrierung, Onboarding-Kader | bestanden | 0063: 59/59 |
| 0064 | Kassenwart-Wunsch: Spalte, Registrierung, Anfragen, getrennte Bestätigung | bestanden | 0064: 39/39 |
| 0065 | Zahlungsziel (Trigger), offene Meldungen, Rollen mit Übergabe, Pushs `kasse_neu`/`kasse_abgegeben` | bestanden (2. Probe, 1. scheiterte an der Erwartung der Gegenprobe) | 0065: 40/40 |
| 0066 | **Korrektur:** kein Rückfall für Meldungen ohne Ziel | bestanden | 0066: 5/5 (Fälle auch in 0065) |
| 0067 | **Korrektur:** Konto löschen anonymisiert Zahlungsziel und Trainer-Link | bestanden | 0067: 5/5 (Fall auch in 0065) |
| 0068 | **Korrektur:** Code neuer Kadereinträge | bestanden | 0068: 4/4 |
| 0069 | **Gegenprüfung:** Rechte erst nach Datenschutz-Zustimmung im Trainer-Link-Onboarding, keine Selbstvergabe von Kassenwart (außer Admin), Entfernen/Löschen eines Kassenwarts markiert offene Meldungen, kein eigener Wechsel des Kadereintrags | bestanden | 0069: 15/15 |
| 0070 | **Gegenprüfung Runde 2:** Onboarding-Abschluss nur mit Zustimmung; Trainer-Link-Konten brauchen sie immer | bestanden | 0070: 3/3 (Fälle auch in 0069) |
| (keine) | Punkt 3 | | `0061_paypal_rechte_pruef`: 22/22 |

Die drei Korrekturen:
- **0066:** 0065 rechnete Meldungen ohne Ziel dem aktuellen Link-Halter zu.
  Hätte ein Testkonto den Link gesetzt, wären die fünf echten Meldungen ihm
  zugeordnet und beim Wechsel markiert worden. Das habe ich vor jedem
  Test bemerkt; es wurde nichts markiert.
- **0067:** Beim Löschen des Kassenwarts wären sein Name und PayPal-Name an
  den Strafen stehen geblieben (gegen E11).
- **0068:** Echter Fehler seit 0061, im E2E-Lauf gefunden:
  - Der Code neuer Kadereinträge war `p` plus `lpad(max(Ziffern aller
    Codes)+1, 2)`.
  - Der Code eines anonymisierten Ehemaligen (`x` plus md5-Teil) ergab eine
    große Zahl, und `lpad` kürzte sie auf zwei Stellen.
  - Folge: Nach der ersten Kontolöschung wäre eine Freigabe mit „Neuer
    Kadereintrag“ an einem doppelten Code gescheitert.
  - Jetzt zählen nur Codes `p<Zahl>`, und der Code wird nie gekürzt.

**Alle Prüfskripte** (je Rolle anon, wartet, Spieler, Kassenwart, Trainer,
Admin, Trainer-Link-Konto, Wunsch, intern; jeder Fall zurückgerollt):

| | | | |
|---|---|---|---|
| 0042: 166/166 | 0043: 83/83 | 0044: 13/13 | 0045: 57/57 |
| 0046: 50/50 | 0048: 37/37 | 0049: 13/13 | 0050: 23/23 |
| 0051: 10/10 | 0052: 13/13 | 0053: 9/9 | 0054: 17/17 |
| 0056: 21/21 | 0057: 21/21 | 0058: 8/8 | 0059: 25/25 |
| 0060: 12/12 | 0061: 101/101 | 0061 PayPal: 22/22 | 0062: 28/28 |
| 0063: 62/62 | 0064: 39/39 | 0065: 40/40 | 0066: 5/5 |
| 0067: 5/5 | 0068: 4/4 | 0069: 15/15 | 0070: 3/3 |

Nachgezogen:
- 0050 und 0059: 55 statt 48 Funktionen für angemeldete Nutzer (0062: 1,
  0063: 5, 0065: 1);
- 0056: 20 Vorlagen, Emoji 🔑 für die zwei neuen;
- 0061: Entzug mit Übergabe;
- 0063: Trainer-Link-Konto erst nach der Zustimmung mit Leitung und Abschluss (0069, 0070).

## N4. Gegenprüfung

Ein getrennter Agent, der nichts gebaut hat, hat nur den Auftrag, E1 bis
E11, den Diff seit 45f2ce6 und die Migrationen gelesen. Er hat per Versuch
geprüft: Transaktionen mit Rollback und Rollen wie bei PostgREST, dazu
HTTP-Aufrufe als anon. Den Bericht hat er nicht gelesen. Stand und
Prüfsummen waren vor und nach beiden Runden gleich.

**Runde 1: sieben Befunde.**

| # | Befund | Schwere | Ergebnis |
|---|---|---|---|
| 1 | Live-App auf main kennt „nicht verfügbar“ nicht: Kader zeigt „Fit“, Aufstellung zählt ihn als verfügbar. Für Spieler ohne Konto lehnt der Server jetzt verletzt ab (Punkt 2), die Live-App zeigt dann einen Fehler | hoch | **offen**, Entscheidung bei dir (N12, 1) |
| 2 | Trainer-Link-Konto hat Trainerrechte vor der Datenschutz-Zustimmung (nur in der Oberfläche erzwungen) | mittel | **behoben** (0069, 0070) |
| 3 | Trainer gibt sich selbst Kassenwart und ändert dann den PayPal-Link (Umweg um Punkt 3) | mittel | **behoben** (0069): Selbstvergabe nur Admin |
| 4 | Entfernen oder Löschen eines Kassenwarts übergeht offene Meldungen (keine Markierung) | mittel | **behoben** (0069), Rückfragen nennen sie |
| 5 | Die fünf alten Meldungen zählen beim Wechsel nicht | mittel | **offen**, bewusst (0066), Entscheidung bei dir (N12, 2) |
| 6 | `set_my_player` (alt, 0061) lässt freigegebene Konten ihren Kadereintrag selbst tauschen (gegen E6) | mittel | **behoben** (0069). Konten ohne Eintrag wählen weiter |
| 7 | (a) kein `kasse_neu`-Push bei bestätigtem Wunsch; (b) Kader-Wahl im Onboarding bis zum Abschluss änderbar; (c) Verlauf nennt das Ziel nur beim letzten Schritt | niedrig | dokumentiert: N-A7, gewollt, N12 |

Ohne Befund geprüft:
- Punkt 1: im Code; Netzwerk und Pixel hat er nicht selbst gemessen.
- Punkt 4.
- Punkt 5: ohne Bestätigung keine Kassendaten, über alle Wege.
- Grenzen: kein Merge, Stash da, nur neue Migrationen, keine neuen Dienste
  oder Datenarten, einzige Datenänderung ist die erlaubte Umwandlung.
- Testdaten und Vorlagen im Ausgangszustand.

**Runde 2:**
- Befunde 3, 4 und 6 bestätigt behoben.
- Befund 2 war umgehbar: Ein direkter Aufruf von `onboarding_abschliessen()`
  setzte das Onboarding ohne Zustimmung auf erledigt. Behoben mit 0070,
  danach von mir geprüft (0069-Fälle 14/15, 0070, E2E 89/89).
- Nichts Neues kaputt:
  - Bestandskonten bleiben Mitglied mit allen Rollen, auch die zwei ohne
    Einwilligung;
  - Konten ohne Eintrag nutzen `set_my_player` weiter;
  - ein Trainer gibt anderen Kassenwart;
  - das Trainer-Link-Onboarding läuft nach der Zustimmung durch.
- Randbemerkung: Wählt ein Trainer-Link-Konto einen bestehenden Eintrag,
  bleibt dessen Hauptposition; die Onboarding-Position füllt nur leere
  Einträge. So war es auch bei der Freigabe in 0061.

Zwei Runden waren erlaubt. Die Lücke aus Runde 2 habe ich danach selbst
behoben und geprüft, eine dritte Gegenprüfung gab es nicht.

## N5. Rechtlich offen

Keine Lösung wurde wegen rechtlicher Zweifel weggelassen. Zu klären bleibt:

1. **Vercel-Funktionsregion `iad1` (Washington, USA).**
   - Betroffen: Push-Versand (`api/dispatch-push`: Titel und Text, oft mit
     Namen, und Push-Endpunkte), Kalender-Abo und BFV-Abgleich. Diese
     Funktionen laufen in den USA.
   - Das ist eine Übermittlung in ein Drittland: Vercel-DPA mit
     Standardvertragsklauseln bzw. Data Privacy Framework.
   - Empfehlung: Region auf Frankfurt (`fra1`) stellen (N7, Schritt 3).
     Den Code habe ich nicht geändert (`vercel.json` hat kein `regions`),
     weil das eine Einstellung des Projekts ist.
2. **Zahlungsziel an der Strafe** (Name und PayPal-Name des Kassenwarts):
   - Das ist keine neue Datenart; beides war schon in der App gespeichert
     (Profilname, `team_settings`).
   - Es ist aber jetzt dauerhaft je Zahlung gespeichert. Beim Löschen des
     Kontos wird es anonymisiert (0067).
   - In der Datenschutzerklärung unter „Strafen und Zahlungen“ erwähnen.
3. **„Nicht verfügbar“:** Bewusst ohne Notiz und ohne Grund, damit daraus
   keine Gesundheitsangabe wird. Die Umwandlung bestehender Angaben (eine
   Zeile) hat der Auftrag vorgegeben.
4. **Unverändert aus dem Vorpaket:** Texte für Datenschutzerklärung und
   Impressum (Platzhalter), SMTP-Anbieter (EU) für Mails.

## N6. Prüfung

**E2E gegen die echte Datenbank** (`onboarding_e2e.mjs`, lokal mit echter
`config.js`): **86/86.** Neu sind diese Fälle:

- **Start:** keine fremden Hosts vor der Anmeldung.
- **Trainer und PayPal:** Der Trainer ändert den Link weder per RPC noch
  direkt (PATCH: 0 Zeilen) und sieht ihn nicht zum Ändern.
- **Trainer-Link:**
  - Nur der Admin sieht und erzeugt ihn; per API lehnt der Server den
    Trainer ab.
  - Er gilt 7 Tage. Die Maske zeigt „als Trainer“ und keinen
    Kassenwart-Haken.
  - Das Konto ist sofort Spieler und Trainer, ohne Kader; danach ist der
    Link verbraucht.
  - Eine zweite Registrierung scheitert, ebenso abgelaufen und widerrufen
    (Widerruf über das Blatt).
  - Onboarding: Datenschutz, Position, „Spielst du mit?“ mit neuem
    Kadereintrag (Name, Position), „Alles bereit“, App.
- **Kassenwart-Wunsch:**
  - Haken in der Maske, Marke in den Anfragen.
  - Vor der Entscheidung per API: keine Strafen, kein Verlauf, keine
    Teameinstellungen, kein `kassenwart_offen`, kein PayPal.
  - Bestätigt: Spieler und Kassenwart, PayPal-Frage.
  - Nicht bestätigt: nur Spieler, auch danach kein Kassenverlauf.
- **Kassenwart-Wechsel:**
  - PayPal-Frage, Link gesetzt.
  - Ohne offene Meldungen: Entzug ohne Rückfrage, Link weg, Rolle wieder
    vergeben.
  - Der Spieler zahlt an den Link, die Meldung hält Kassenwart und Link
    fest.
  - Mit offener Meldung: Rückfrage „1 gemeldete Zahlung über 6,00 € an …“.
    Abbrechen ändert nichts.
  - Neuer Kassenwart, dann trotzdem wechseln: Die Meldung bleibt, ist
    markiert, der alte Link ist weg, der Wechsel protokolliert.
  - Bis zum neuen Link kein Zahlknopf, mit Hinweis. Der neue Kassenwart
    wird gefragt; danach zahlt der Spieler an den neuen Link.
  - Die neue Kasse sieht die Markierung, und der Verlauf nennt Kassenwart
    und Link.
- **Gesundheit (angepasst an Punkt 2):**
  - Der Widerruf wandelt in „nicht verfügbar“, Notiz weg, Datum bleibt.
  - Ohne Einwilligung drei Status mit Hinweis.
  - Verletzt lehnt der Server auch per API ab; „Erlauben“ öffnet die
    Einwilligung.

**Testkonten** (Gmail-Plus: `wplauck+fne2e<lauf>trainer/spieler/abgelehnt/
admin/trainerlink/kasseja/kassenein@…`) sind per SQL angelegt, weil die
Registrierung im Dashboard gesperrt ist. Der Lauf hat keine Mails versandt.
Während des Laufs waren die fünf Vorlagen `anfrage_neu`,
`konto_freigegeben`, `rolle_geaendert`, `kasse_neu` und `kasse_abgegeben`
aus.

**Beleg nach dem Aufräumen**:
- Stand: Konten/Profile/Spieler/Strafen/Rückmeldungen/Status/Einladungen/
  Protokoll/Einwilligungen/Outbox/**Sammler**/PayPal/Vorlagen;
- Vorlagen: `select kategorie, aktiv from notification_templates`.

```
vorher   3/3/16/308/37/16/0/0/2/35/0/Teamkassefasanerie:799234a7-…/true,true,true,true,true
nachher  3/3/16/308/37/16/0/0/2/35/0/Teamkassefasanerie:799234a7-…/true,true,true,true,true
Vorlagen vorher = nachher: alle 20 aktiv außer unterbesetzung (false)
```

**Vorfall, abgefangen:**
- **Was passiert ist:** Im ersten vollständigen Lauf hat die Testmeldung
  einer Zahlung über `report_my_payment` einen Sammeleintrag
  `zahlung_gemeldet` angelegt. Empfänger war dein echtes Konto (Kassenwart),
  fällig 14:39 Uhr.
- **Warum der Vergleich das nicht zeigte:** `notification_sammler` gehörte
  nicht zum Vergleichsstand. Er war deshalb trotzdem „gleich“.
- **Gefunden:** über ein rotes Prüfskript (0045).
- **Behoben:** Ich habe die Zeile um 14:27 Uhr gelöscht. Auslöser und
  Teststrafe waren schon weg. In der Outbox stand nichts, es kam **kein
  Push**.
- **Jetzt:** Der E2E räumt Sammeleinträge mit Testauslöser auf, und der
  Vergleichsstand enthält die Sammler. Der Lauf danach: vorher und nachher
  0.

**E2E-Durchgänge:**
1. 3,5 s Wartezeit zu kurz.
2. Die Freigabe scheiterte am Kadercode: Das war der Fehler, den 0068
   behebt.
3. 86/86.
4. 86/86 mit Sammler im Stand.
5. Nach der Gegenprüfung: 89/89, drei Fälle dazu (Trainer-Link-Konto vor der Zustimmung ohne Daten, keine Selbstvergabe von Kassenwart, kein eigener Kaderwechsel).

Die Korrekturen der Läufe 1 und 2 betrafen Werkzeug und Datenbank, nicht
die Oberfläche.

**Stand-in, Pflichtliste, Landkarte:**
- **`onboardingpruef`** um diese Fälle erweitert:
  - ohne Einwilligung;
  - PayPal je Rolle;
  - Trainer-Link: Maske, Onboarding mit beiden Kader-Wegen, Admin-Blatt,
    Trainer ohne Abschnitt;
  - Kassenwart-Haken, Marke, getrennte Bestätigung;
  - Rückfrage beim Wechsel mit Abbrechen und Trotzdem;
  - Markierung und Verlauf.
- **Neu auf der Pflichtliste:** `hostpruef`.
- **Landkarte:**
  - neues Profil „Neuer Trainer (Link)“ (Datenschutz, Position, Spielst du
    mit?, Home, Alles bereit);
  - Blatt „Trainer-Link“;
  - Marke „Kassenwart?“ in den Anfragen;
  - Markierung „An vorherigen Kassenwart gezahlt“ in Kasse prüfen und im
    Strafen-Blatt.
  - Gesamtkarte 14,9 MB (Grenze 15 MB).

**Gerätematrix-Teillauf:**

- **Zustände:** 20 Schlüssel über alle Rollen, je 9 Breiten × 2 Schriftgrößen × 3 Varianten:
  - Registrierung;
  - Onboarding (Datenschutz, Position, Spielst du mit?, Alles bereit, Home);
  - Rollen verwalten mit Trainer-Link-, Freigabe- und Rollen-Blatt;
  - Kasse prüfen und Strafen-Blatt;
  - Kader und Status-Blatt;
  - Übersicht mit Status, Profil mit Status- und Konto-löschen-Blatt.
- **Runde 1:** 113 Einzelbefunde in 5 Gruppen, alle in neuen Teilen:
  - Markierung „An vorherigen Kassenwart gezahlt“ abgeschnitten und mit Überlauf (320 und 360 px, 130 %);
  - Schritt „Spielst du mit?“ mit waagerechtem Überlauf: Der Name in der Zeile „Neuer Kadereintrag“ schrumpfte nicht;
  - Trefferfläche des Kassenwart-Hakens 22 px.
- **Behoben:**
  - Markierung darf umbrechen;
  - Zeile „Neuer Kadereintrag“ ohne Namen, Werte kürzen mit Auslassungspunkten;
  - Haken als unsichtbares 44-px-Feld über einem gezeichneten Kästchen.
- **Runde 2:** **0 Befunde.** Ausnahmen: `zone-alle-bestaetigen` 156, `feld-status-datum` 3 (WebKit).
- **Runde 3** (nach den Gegenprüfungs-Korrekturen): **0 Befunde**, dieselben Ausnahmen.
- Ergebnisse unter `.design-sync/geraetematrix/nacharbeit-2026-10-11-n/`, `…-n-r2/` und `…-n-r3/`, Befundbilder nur lokal.

## N7. Dashboard-Schritte für dich

Unverändert offen aus dem Vorpaket (Abschnitt 4): Registrierung
einschalten, E-Mail-Bestätigung aus, Redirect-URLs, SMTP. Neu:

1. **Supabase:** nichts Neues. Trainer-Link und Kassenwart-Wunsch laufen
   über dieselbe Registrierung. Solange „Allow new users to sign up“ aus
   ist, scheitern auch sie mit „Registrieren ist im Moment gesperrt“.
2. **Vercel › Projekt `fasanerie-nord-2` › Settings › Functions › Function
   Region:** `Frankfurt, Germany (fra1)` wählen und neu deployen. Heute steht
   dort `iad1` (Washington). Alternativ in `vercel.json`
   `"regions": ["fra1"]`, wenn du das im Code haben willst.
3. Danach in den Vercel-Logs einmal `api/dispatch-push` und
   `api/calendar` prüfen. Die Supabase-Datenbank liegt in Frankfurt, also
   werden die Wege kürzer.

## N8. Hosts beim App-Start

Gemessen mit Playwright (`hostpruef`, Pflicht, und im E2E mit echter
`config.js`):
- vor der Anmeldung (Anmeldeseite);
- nach der Anmeldung als Spieler, Trainer und Admin (Stand-in);
- Datenschutz und Impressum.

**Ergebnis:** Es gibt nur Anfragen an die eigene Adresse.
`fonts.googleapis.com`, `fonts.gstatic.com` und `cdn.jsdelivr.net` kommen
nicht mehr vor. Nach der Anmeldung spricht die App mit Supabase (Frankfurt),
das ist der eigene Dienst. Vor der Anmeldung gibt es keinen Aufruf an
Supabase, außer beim Prüfen eines Einladungslinks.

## N9. Gerätematrix-Nachtlauf 09.10. (Stash, nur gelesen)

Der Stash `stash@{0}` („Nachtlauf 09.10. Bericht und Ergebnisse, wartet auf
Entscheidung“) liegt unverändert auf main. Ich habe ihn nur gelesen, nicht
angewandt.

- **Umfang:**
  - Build 2026-10-09-R, 200 Zustände: vor der Anmeldung 3, Spieler 19,
    Kassenwart 28, Trainer 40, Trainer+Kassenwart 53, Admin 57;
  - je 9 Breiten × 2 Schriftgrößen × 3 Varianten = 10 800 Kombinationen.
  - Ohne Codeänderung, ohne Datenbank, ohne Push.
- **Befunde außerhalb der Ausnahmeliste: 0**, in allen drei Varianten.
  Treffer auf Ausnahmen:

  | Variante | Treffer |
  |---|---|
  | Chromium · Inter | 302 |
  | Chromium · Roboto | 278 |
  | WebKit · Inter | 283 |
- **Ausnahmen ohne Treffer:**
  - **`zone-danach`:** Der Selektor ist richtig, der Fall besteht weiter.
    Er wird aber nie gemessen, weil „Kalender ›“ über der Danach-Liste
    unterhalb des ersten Bildschirms liegt. Das ist eine Lücke im Werkzeug
    (die Trefferprüfung misst nur den ersten Bildschirm); den Text der
    Ausnahme könnte man aktualisieren.
  - **`feld-katalogname`:** Der Selektor ist veraltet, das Feld gibt es
    seit Nachschliff D3 nicht mehr. Die Ausnahme kann entfallen, wenn du
    das freigibst.
- Neue Befunde: keine.

## N10. Vercel-Vorschau

- Branch-Adresse:
  **https://fasanerie-nord-2-git-onboarding-benni1893s-projects.vercel.app**
- Stand e8b8d77 (Build 2026-10-11-H): Deployment
  **https://fasanerie-nord-2-non39vkyp-benni1893s-projects.vercel.app**
  (READY).
- Der Berichts-Commit danach ändert nur diese Datei.

## N11. iPhone-Testliste (Nacharbeit)

Auf der Vorschau, keine Pushs an Spieler. Vorher Abschnitt 4, Schritte 1
bis 3 (Registrierung an), sonst geht keine Registrierung.

1. **Start ohne fremde Server:**
   - Safari › Einstellungen › Erweitert › Website-Daten löschen;
   - Vorschau öffnen. Die Schrift ist Inter wie bisher, auch offline nach
     dem ersten Start.
2. **Gesundheitsstatus:**
   - Profil › Gesundheitsstatus aus. Ein verletzt wird zu „nicht
     verfügbar“, die Notiz ist weg, das Datum bleibt.
   - Übersicht › Mein Status zeigt fit, Nicht verfügbar, Urlaub und
     „Erlauben“.
3. **Trainer-Link** (mit deinem Admin-Konto):
   - Rollen verwalten › Trainer-Links › „Trainer-Link erzeugen“ › Link
     teilen, z. B. an dich selbst.
   - Den Link in einem privaten Tab öffnen. Die Maske zeigt „Einladung als
     Trainer“, ohne Kassenwart-Haken.
   - Mit einer Gmail-Plus-Adresse registrieren, z. B.
     `wplauck+trainer1@gmail.com`.
   - Datenschutz, Position, „Spielst du mit?“ › „Ich spiele nicht mit“,
     Home, „Alles bereit“ › Zur App. Die Trainer-Ansicht steht sofort,
     ohne Freigabe.
   - Denselben Link noch einmal öffnen: „nicht mehr gültig“.
   - Einen zweiten Link erzeugen und widerrufen; auch er ist dann ungültig.
4. **Kassenwart-Wunsch:**
   - Den Spieler-Link in einem privaten Tab öffnen, „Ich bin Kassenwart“
     anhaken, mit `wplauck+kasse1@gmail.com` registrieren, Onboarding bis
     Warten.
   - Mit deinem Konto: Rollen verwalten › Anfrage mit Marke „Kassenwart?“.
     Freigeben einmal mit „Als Kassenwart bestätigen“ an, einmal (zweites
     Testkonto) aus.
   - Das bestätigte Konto wird nach PayPal gefragt; das andere hat keine
     Kasse.
5. **Kassenwart-Wechsel:**
   - Das bestätigte Testkonto setzt einen PayPal-Link.
   - Das zweite Testkonto bekommt eine Strafe (Kasse › Strafe verhängen)
     und meldet die Zahlung.
   - Rollen verwalten › Testkassenwart › Kassenwart aus: Die Rückfrage
     nennt 1 Meldung und den Betrag. Erst „Abbrechen“, dann einem anderen
     Konto Kassenwart geben und „Trotzdem wechseln“.
   - Push „Kasse abgegeben“ und „Du bist jetzt Kassenwart“ kommen außerhalb
     der Ruhezeit.
   - Der Spieler sieht keinen Zahlknopf bis zum neuen Link.
   - Die neue Kasse sieht „An vorherigen Kassenwart gezahlt“; im Verlauf
     der Strafe steht, an wen gezahlt wurde.
6. **Aufräumen:**
   - Testkonten über Profil › Konto löschen oder Rollen verwalten › Aus
     der Mannschaft entfernen.
   - Den PayPal-Link der Kasse wieder auf „Teamkassefasanerie“ setzen.
   - Teststrafen in der Kasse stornieren.
7. **Wie bisher** (Abschnitt 8 oben): Registrierung, Freigabe, Konto
   löschen, Seiten Datenschutz und Impressum.

## N12. Offen nach der Nacharbeit

**Offen nach Gegenprüfung (deine Entscheidung):**

1. **Live-App auf main und „nicht verfügbar“ (E10).**
   - Der eine umgewandelte Status (vorher verletzt) erscheint in der
     Live-App als „Fit“ und gilt in der Aufstellung als verfügbar.
   - Setzt ein Trainer in der Live-App bei einem Spieler ohne Konto
     „verletzt“, kommt eine Fehlermeldung.
   - Beheben ließe sich das nur auf main (verboten), oder ich hätte die
     Umwandlung aus Punkt 2 nicht machen dürfen.
   - Wege: bald mergen (nach deinem Test), oder ein kleiner Hotfix auf main,
     der „nicht verfügbar“ wie verletzt anzeigt und zählt.
2. **Fünf alte Meldungen vom 28.09. ohne Zahlungsziel:** Beim ersten echten
   Kassenwart-Wechsel zählen sie nicht und werden nicht markiert. Wenn du
   willst, ordne ich sie per ausdrücklicher Entscheidung einmalig dem
   heutigen Link-Halter zu.
3. **Kleinere:**
   - kein `kasse_neu`-Push bei bestätigtem Wunsch (N-A7);
   - die Kader-Wahl im Onboarding ist bis „Alles bereit“ änderbar (gewollt,
     Korrektur möglich);
   - der Verlauf nennt das Ziel nur am letzten Melde- oder Buchungsschritt,
     frühere Ziele nach einem „zurück auf offen“ sind nicht gespeichert.

**Sonst offen:**

4. Dashboard-Schritte (N7), vor allem Registrierung einschalten und
   Funktionsregion Frankfurt.
5. Texte Datenschutzerklärung und Impressum, mit Zahlungsziel und
   Vercel-Region (N5).
6. Nachtlauf-Ausnahmen `zone-danach` (Werkzeuglücke) und
   `feld-katalogname` (kann entfallen), N9.
7. Merge auf main erst nach deinem Test.
8. `.design-sync/shots/_p4blick.mjs`: mein Hilfsskript für Sichtbilder,
   nicht committet, kann weg.

## N13. Commits der Nacharbeit

| Commit | Inhalt | Build |
|---|---|---|
| 251dd6b | 1 Schrift und supabase-js selbst ausgeliefert | 2026-10-11-C |
| 73fb672 | 2 Gesundheitsstatus nur mit Einwilligung (0062) | 2026-10-11-D |
| c029c0f | 3 PayPal nur Kassenwart und Admin (Prüfung) | (keiner) |
| b858b5e | 4 Trainer-Link (0063) | 2026-10-11-E |
| 817b39f | 5 Kassenwart-Wunsch (0064) | 2026-10-11-F |
| 457a787 | 6 Kassenwart-Wechsel (0065 bis 0068) | 2026-10-11-G |
| e8b8d77 | Korrekturen aus Gegenprüfung und Gerätematrix (0069, 0070) | 2026-10-11-H |
| (dieser) | 7 dieser Nachtrag | (keiner) |
