# Anmeldung und Onboarding: Phase 0

Stand 11.10.2026, Branch `onboarding` (von main 6c10752). Nur gelesen,
nichts geändert. Quellen: Code im Repo, Migrationen 0001 bis 0060 und die
Live-Datenbank (lesend über den MCP).

## 1. Heutiger Anmeldeweg

- **Zeichnen:** `renderLogin()` (app.js um 8137) kennt drei Modi:
  - `login` (E-Mail, Passwort);
  - `register` (E-Mail, Passwort, mindestens 6 Zeichen);
  - `forgot` (E-Mail).
  Dazu kommt `renderResetPassword()` für den Link aus der Reset-Mail.
  Einen Namen oder Einladungscode fragt die App nicht ab.
- **db.js:**
  - `signIn` → `auth.signInWithPassword`;
  - `signUp` → `auth.signUp({email, password})`, ohne Optionen und ohne
    Metadaten;
  - `resetPassword` → `resetPasswordForEmail(..., {redirectTo: Seite})`;
  - `updatePassword`, `onPasswordRecovery`.
  Kommt nach `signUp` keine Sitzung zurück, zeigt die App „Bitte bestätige
  deine E-Mail“. Die E-Mail-Bestätigung ist im Dashboard also vermutlich an.
- **Datenbank:** Der Trigger `on_auth_user_created` → `handle_new_user()`
  (letzte Fassung 0004) legt `profiles(id, email, club_id = fcfn)` und die
  Rolle `user_roles(player)` an; ein Folgetrigger legt `notification_prefs`
  an. Metadaten nutzt er nicht.
- **Spielerzuordnung heute:** Ohne `player_id` zeigt `init()` das Raster
  `renderPlayerLink()` mit allen Spielern.
  - Ein Tipp ruft `set_my_player(p_player_id)` (0002) auf; die Funktion
    prüft nur, ob der Spieler frei ist.
  - **Damit kann sich heute jeder, der sich registriert, jeden freien
    Kadereintrag nehmen und sieht danach alles.**

## 2. Rollenmodell und RLS

- **Rollen:** `user_roles(user_id, role ∈ player|coach|treasurer|admin,
  club_id)`, als Zusätze kombinierbar. Das Feld `profiles.role` ist ein
  Altfeld ohne Wirkung.
- **Hilfsfunktionen:** `has_role(r)`, `is_admin()`, `my_roles()`,
  `my_player_id()`, alle security definer, ohne Vereinsbezug.
- **Frontend:** `Roles` (app.js um 8027) mit `real`, Simulation für echte
  Admins (`data-sim`), `canManageEvents` (coach, admin) und
  `canManageFines` (treasurer, admin).
- **Live-Rollen:** admin 1, player 3, treasurer 1, coach 0. Es gibt 3 Profile
  bei 16 Spielern, nur das Admin-Konto ist mit einem Spieler verknüpft.
- **RLS heute (live gelesen):**
  - **Für jeden Angemeldeten lesbar** (`using (true)`): `clubs`, `events`,
    `fines`, `fine_catalog`, `players`, `team_settings`; `sportstaetten` auch
    für anon.
  - Mit Bedingung lesbar:
    - `rsvps`: nur eigene, oder coach/admin;
    - `player_status`: eigener, oder coach/admin;
    - `lineups`: coach/admin;
    - `fine_status_log`: treasurer/admin;
    - `notification_templates`: admin;
    - `profiles`, `user_roles`: eigene Zeilen, oder admin.
  - Geschrieben wird nur über Rollenprüfung oder RPCs.
  - **Folge:** Ein Konto ohne Freigabe sähe heute alle Termine, Strafen und
    Spieler. Das schließt O1 serverseitig.
- **Rechte an Funktionen:** Seit 0042b ist alles gesperrt, außer einer
  Positivliste für authenticated (heute 29 Funktionen). Neue RPCs brauchen
  ein ausdrückliches `grant`.

## 3. „Rollen verwalten“

- **Ort:** `renderAdmin()` (app.js um 8201), Ansicht `admin`, nur für Admins
  (Mehr-Menü und Einstellungen › „Rollen“).
- **Inhalt:** Simulations-Chips und eine Tabelle Mitglied × Häkchen für
  coach, treasurer und admin.
- **Zugriff:** Die Seite schreibt direkt auf `user_roles` (Insert und
  Delete, RLS nur Admin), ohne RPC.
- **Lücken:** Es gibt keinen Schutz für den letzten Admin und kein
  Protokoll.

## 4. PayPal-Link

- Er ist **fest im Code**: `PAYPAL_ME = "Teamkassefasanerie"` (app.js:25).
  `paypalMeLink(betrag)` baut daraus `paypal.me/<name>/<betrag>EUR`, das ist
  der Zahlknopf `mb-pay` im Konto.
- Datenbank: keine Spalte, keine Einstellung. `team_settings` hat nur die
  Meldefristen.

## 5. BFV-Einstellungen

- **Daten:** `clubs.ical_url` und `ical_synced_at`.
- **Oberfläche:** Einstellungen › „Spielplan BFV“, `darf: isAdmin`.
- **Server:**
  - `set_ical_url` erlaubt coach, treasurer und admin (0051);
  - `/api/sync-bfv` prüft dieselben drei Rollen;
  - `sync_bfv_matches` darf nur service_role.
- Der Server ist also heute lockerer als die Oberfläche.

## 6. Bindung an eine Mannschaft

- Fast alle Tabellen haben `club_id`, praktisch ist aber alles fest an
  `slug = 'fcfn'` gebunden (`handle_new_user`, `set_ical_url`,
  `sync_bfv_matches`).
- Keine RLS-Policy filtert nach `club_id`; `has_role` kennt keinen Verein.
- Es gibt eine Mannschaft, Mehrmannschaften wären ein eigener Umbau (nicht
  Teil dieses Pakets).

## 7. Push und Home-Bildschirm

- **Erkennung:** `istStandalone()` (app.js um 1741) prüft
  `display-mode: standalone` oder `navigator.standalone`. `pushZustand()`
  liefert inapp, ios-install, nicht-unterstuetzt, verweigert, aktiv oder
  bereit.
- **Anmelden:** `pushAnmelden()` ruft `Notification.requestPermission`,
  `pushManager.subscribe` (VAPID) und die RPC `upsert_push_subscription`
  (Plattform ios/android) auf.
- **Installation:**
  - iOS: Text-Anleitung in `pushAbschnittHtml`.
  - Android: `beforeinstallprompt` wird gemerkt, der Knopf
    `data-push-install` ruft `prompt()` auf.
- **Manifest:** `start_url ./`, `scope ./`, `display standalone`.
- **Versand:** `/api/dispatch-push` (Vercel, Cron jede Minute) mit `web-push`
  an die Push-Dienste der Geräte.
- **iOS:** Safari und die Home-Bildschirm-App haben getrennte Speicher, nach
  dem Hinzufügen muss man sich dort neu anmelden. Das ist der Grund für die
  Reihenfolge in O4.

## 8. Datenschutz: Region, Dienste, Datenarten

**Region der Datenbank:** Supabase, AWS **eu-central-1 (Frankfurt)**. Das
ist aus dem Pooler-Host der Verbindung gelesen, Projekt `pjgkgsepjsvewwkffzsm`.

| Dienst | Rolle | Personenbezogene Daten |
|---|---|---|
| **Supabase** (Datenbank, Auth; Frankfurt) | Auftragsverarbeiter | E-Mail, Passwort-Hash, Anmeldezeiten und IP in den Auth-Logs; Spielername, Rückennummer bzw. Position; Rückmeldungen (Zu-/Absage, Grund); Status mit Notiz und Datum (Gesundheitsdaten bei verletzt/angeschlagen); Strafen und Zahlungen samt Zahlart und Notiz; Push-Endpunkte und Gerätekennung (User-Agent); Einstellungen der Mitteilungen; Kalender-Token; künftig Einwilligungen und Protokoll |
| **Vercel** (Hosting, API-Funktionen) | Auftragsverarbeiter | IP-Adresse und Browserdaten jedes Aufrufs (Logs). Die API-Funktionen verarbeiten Push-Inhalte (Titel, Text, oft mit Namen), Kalenderdaten (per Token) und den BFV-Abgleich. Server-Region im Projekt prüfen (siehe ABSCHLUSS) |
| **Apple Push Notification Service** (iPhone) | Empfänger | Push-Endpunkt, verschlüsselter Inhalt (Titel, Text, Link; Ende-zu-Ende nach RFC 8291), Zeitpunkt, Gerätezuordnung bei Apple |
| **Google Firebase Cloud Messaging** (Android/Chrome) | Empfänger | wie Apple |
| **Google Fonts** (fonts.googleapis.com, fonts.gstatic.com) | Dritter | **IP-Adresse und Browserdaten bei jedem App-Start**, die Schrift wird direkt von Google geladen (index.html:7–9) |
| **jsDelivr** (cdn.jsdelivr.net) | Dritter | IP-Adresse und Browserdaten beim Laden von supabase-js (index.html:283) |
| **PayPal** (paypal.me) | eigener Verantwortlicher | nur wenn ein Spieler auf „Zahlen“ tippt: Aufruf mit Betrag, danach Daten bei PayPal |
| **BFV** (Spielplan-iCal) | Datenquelle | keine Personendaten der Nutzer, der Server ruft den Feed ab |

Die beiden Dritten ohne Vertrag (Google Fonts und jsDelivr) lassen sich
vermeiden, indem man die Dateien selbst ausliefert. Das steht als offener
Punkt im Bericht.

## 9. Folgerungen für den Bau

Diese Folgerungen gelten verbindlich für O1 bis O9, die Begründungen
stehen unter „Annahmen“ in ABSCHLUSS.md.

1. **Freigabestatus** `profiles.freigabe` mit den Werten `wartet`, `aktiv`
   und `abgelehnt`. Der Standard beim Anlegen der Spalte ist `aktiv`, damit
   die drei bestehenden Konten unverändert bleiben. Danach wird der
   Standard auf `wartet` umgestellt.
2. **Mitgliedsprüfung** `ist_mitglied()` = eigenes Profil `aktiv`.
   - `has_role()` und `my_roles()` gelten nur noch für Mitglieder. Damit
     greifen alle Rollen-Policies für wartende Konten nicht.
   - Die Lese-Policies `using (true)` werden `using (ist_mitglied())`.
   - `set_my_player` und das Kalender-Token sind für Wartende gesperrt.
   - Für die bestehenden Konten ändert sich nichts, die Live-App auf main
     läuft weiter.
3. **Registrierung nur mit gültigem Einladungstoken:** `handle_new_user`
   prüft `raw_user_meta_data.einladung` und bricht ohne gültiges Token ab.
   Das sperrt auch die alte Registrierung der Live-App (gewollt nach E1).
4. **Neue Funktionen** nur als RPC mit Rollenprüfung. Neue Tabellen haben
   RLS ohne Policies, also kein Direktzugriff.
5. **PayPal** als `team_settings.paypal_name`, vorbelegt mit dem heutigen
   Wert. Die Live-App nutzt weiter ihre Konstante.
6. **Position** als neue Spalte `players.hauptposition` (torwart, abwehr,
   mittelfeld, sturm). Sie wird aus der bisherigen Kürzelspalte `position`
   abgeleitet, und `position` und `number` bleiben unverändert.
