# Rechte-Übersicht (Stand 19.10.2026)

Erzeugt aus `app.js`, den RLS-Regeln und den Datenbankfunktionen in der Produktion sowie aus der App-Landkarte. Es ist ein reiner Prüfstand, nichts wurde geändert.

## So liest du die Tabellen

**Spalten**

| Spalte | Wer das ist |
|---|---|
| Spieler | Spieler mit Kadereintrag |
| Kassenwart | Spieler und Kassenwart |
| Trainer | Trainer ohne Kadereintrag („spielt nicht mit“) |
| Spielertrainer | Spieler und Trainer |
| Admin | Admin. Benjamin ist zusätzlich Spieler und Kassenwart. |

**Werte in den Zellen**
- „sichtbar“ heißt: Die App zeigt den Knopf oder die Ansicht (`Roles.*` in `app.js`, bei Sichtbarkeit immer mit der Admin-Vorschau gerechnet).
- „Server“ heißt: Die Datenbank erlaubt die Aktion (RLS-Regel oder Rollenprüfung in der Funktion).
- Die Form „sichtbar/Server“ steht in Teil 1, zum Beispiel `ja/ja`.
- ⚠ markiert eine Abweichung von der Soll-Logik oder einen Unterschied zwischen sichtbar und Server.

**Was die Prüffunktionen bedeuten**

| Funktion | Bedeutung |
|---|---|
| `ist_leitung()` | Trainer oder Admin |
| `ist_mitglied()` | freigegebenes Konto |
| `canManageEvents` | Trainer oder Admin |
| `canManageFines` | Kassenwart oder Admin |

Die Spalte „Trainer (ohne Kader)“ ist aus dem Code abgeleitet, denn die Landkarte kennt dieses Profil nicht. Sie ist wie „Spielertrainer“, nur ohne eigene Zusage, ohne Mein Status und ohne Konto › Ich.

## Teil 1: Aktionen (von Hand aus Code und RLS)

| Bereich | Aktion | Spieler | Kassenwart | Trainer | Spielertrainer | Admin | Soll | Befund |
|---|---|---|---|---|---|---|---|---|
| Termine | eigene Zu- und Absage | ja/ja | ja/ja | –/– (kein Kader) | ja/ja | ja/ja | alle Spieler | ok |
| Termine | Rückmeldung für andere setzen | –/– | –/– | –/ja | –/ja | –/ja | – | Der Server erlaubt Trainer und Admin (RLS `rsvps`), die App bietet es nicht an. Unkritisch. |
| Termine | Rückmeldungen-Blatt, „Push senden“ | –/– | –/– | ja/ja | ja/ja | ja/ja | Trainerfenster | ok |
| Termine | Termin anlegen, bearbeiten, absagen, löschen | –/– | **–/ja** | ja/ja | ja/ja | ja/ja | Trainer | ⚠ RLS `events_ins/upd/del` und `sportstaetten` erlauben auch dem **Kassenwart**. Die App zeigt es ihm nicht. |
| Termine | Spielplan BFV verbinden | –/– | –/– | ja/ja | ja/ja | ja/ja | Trainer | ok (`set_ical_url`: `ist_leitung`) |
| Termine | Kalender-Abo, Termin in Kalender | ja/ja | ja/ja | ja/ja | ja/ja | ja/ja | alle | ok |
| Status | eigener Status | ja/ja | ja/ja | –/– | ja/ja | ja/ja | alle Spieler | ok |
| Status | Status anderer Spieler (Kader) | –/– | –/– | ja/ja | ja/ja | ja/ja | Trainerfenster | ok (`set_player_status`) |
| Trainer | Kader, Aufstellung, Vorlagen, Kader-Info teilen | –/– | –/– | ja/ja | ja/ja | ja/ja | Trainerfenster | ok (RLS `lineups`: Trainer oder Admin) |
| Kasse | Kassenbanner auf der Übersicht (Kassenstand, Offenes) | ja/ja | ja/ja | ja/ja | ja/ja | ja/ja | ? | ⚠ Spieler sehen Kassenstand und Summen der Mannschaft. Siehe Frage 4. |
| Kasse | Konto › Mannschaft (offene Strafen aller mit Namen) | ja/ja | ja/ja | ja/ja | ja/ja | ja/ja | Spieler: nur eigene Sachen | ⚠ RLS `read_fines` ist `ist_mitglied()`: Jeder sieht die offenen Strafen aller. So gebaut, aber gegen „nur eigene Sachen“. Siehe Frage 4. |
| Kasse | eigene Strafen bezahlen, „Zahlung melden“ | ja/ja | ja/ja | –/– | ja/ja | ja/ja | alle Spieler | ok (`report_my_payment`) |
| Kasse | Kasse öffnen, Strafe verhängen, prüfen und verbuchen, Storno, Buchung rückgängig | –/– | ja/ja | –/– | –/– | ja/ja | Kassenwart | ok (`create_fines_batch`, `confirm_fines`, `mark_fines_paid`, `reject_fine`, `cancel_fine`, `undo_fine_payment`: Kassenwart oder Admin) |
| Kasse | automatische Strafe entfernen | –/– | ja/ja | **–/ja** | **–/ja** | ja/ja | Kassenwart | ⚠ RLS `fines_del` erlaubt Trainern das Löschen automatischer Strafen. `Roles.canDeleteAutoFine` ist definiert, wird aber nirgends benutzt: kein Knopf. |
| Kasse | PayPal-Link der Kasse | –/– | ja/ja | –/– | –/– | ja/ja | Kassenwart | ok (`paypal_setzen`) |
| Kasse | Strafenkatalog ansehen | ja/ja | ja/ja | ja/ja | ja/ja | ja/ja | alle | ok |
| Kasse | Strafenkatalog bearbeiten | –/– | ja/ja | –/– | –/– | ja/ja | Kassenwart (nicht genannt) | ok |
| Einladung | Einladungslink sehen, teilen, kopieren, erneuern | –/– | –/– | ja/ja | ja/ja | ja/ja | Trainer (Admin: alles) | ok (`einladung_holen/erneuern`: `ist_leitung`). Ort: Rollen verwalten › Einladung. |
| Freigabe | Offene Anfragen, Freigeben, Ablehnen, Kadereintrag zuordnen, „Ohne Kadereintrag“ | –/– | –/– | ja/ja | ja/ja | ja/ja | Trainer und Admin gleichberechtigt | ok (`anfrage_freigeben/ablehnen`: `ist_leitung`) |
| Freigabe | „Als Kassenwart bestätigen“ (Wunsch aus der Registrierung) | –/– | –/– | ja/ja | ja/ja | ja/ja | Trainer bestätigt | ok, der Admin darf es auch. |
| Freigabe | „Ich bin Trainer“ bei der Registrierung, Bestätigung durch den Admin | – | – | – | – | – | Admin bestätigt | ⚠ **Gibt es nicht.** Bei der Registrierung gibt es nur „Ich bin Kassenwart“. |
| Rollen | Trainer vergeben oder entziehen (Mitglieder › Person › „Trainer“) | –/– | –/– | ja/ja | ja/ja | ja/ja | Trainer vergeben; „Admin bestätigt neue Trainer“ | ⚠ Heute macht **jeder Trainer** ohne Admin andere zu Trainern (`rolle_setzen`: `ist_leitung`). Widerspruch im Soll, siehe Frage 1. Den letzten Trainer ändert nur der Admin (0076). |
| Rollen | Kassenwart vergeben oder entziehen | –/– | –/– | ja/ja | ja/ja | ja/ja | Trainer | ok. Sich selbst zum Kassenwart machen darf nur der Admin. |
| Rollen | Admin vergeben | –/– | –/– | –/– | –/– | ja/ja | Admin | ok |
| Rollen | Mitglied entfernen | –/– | –/– | ja/ja | ja/ja | ja/ja | Trainer (Admin) | ok. Den Admin entfernt nur der Admin, den letzten Trainer nur der Admin. |
| Rollen | Mitglieder, Protokoll ansehen | –/– | –/– | ja/ja | ja/ja | ja/ja | Trainer | ok (`mitglieder_liste`, `protokoll_liste`: `ist_leitung`) |
| Rollen | „Ansicht testen als“ (Vorschau) | –/– | –/– | –/– | –/– | ja/(nur Anzeige) | Admin | ok. Sie ändert nur die Anzeige, der Server prüft weiter die echten Rollen. |
| Kader | sich selbst einem freien Kadereintrag zuordnen („Spieler wählen“) | ja*/ja | ja*/ja | ja*/ja | ja*/ja | ja*/ja | – | ⚠ Altlast `set_my_player`. Nur erreichbar mit freigegebenem Konto ohne Kadereintrag, das nicht „spielt nicht mit“ gewählt hat. Seit den Freigaben über `anfrage_freigeben` praktisch nicht mehr erreichbar. |
| Einstellungen | Mitteilungen, Ruhezeiten, Kalender abonnieren, Profil, Diagnose, So geht's | ja/ja | ja/ja | ja/ja | ja/ja | ja/ja | eigene Einstellungen | ok |
| Einstellungen | „Testnachricht senden“ (nur an sich, Sperre) | ja/ja | ja/ja | ja/ja | ja/ja | ja/ja | eigene Einstellungen | ok (0077). Sichtbar nur, wenn Mitteilungen auf dem Gerät an sind. |
| Einstellungen | Verwaltung › Spielplan BFV | –/– | –/– | ja/ja | ja/ja | ja/ja | Trainer | ok |
| Einstellungen | Verwaltung › Strafenkatalog (bearbeiten) | –/– | ja/ja | –/– | –/– | ja/ja | Kassenwart | ok. Die Gruppe „Verwaltung“ sieht ein Kassenwart nur mit dieser einen Zeile. |
| Einstellungen | Verwaltung › Rollen | –/– | –/– | ja/ja | ja/ja | ja/ja | Trainer | ok. Siehe Frage 3 zum Ort. |
| Einstellungen | Verwaltung › Push-Texte | –/– | –/– | –/– | –/– | ja/ja | Admin | ok (`set_notification_template`: `is_admin`) |
| Navigation | 5. Reiter | – (4 Reiter) | „Kasse“ | „Trainer“ | „Trainer“ | „Mehr“ (Kader, Trainer, Kasse, Rollen, Einstellungen, Profil) | – | Spieler und Kasse sowie Spielertrainer und Kasse bekommen „Mehr“ ohne „Rollen“. |
| Einführung | Einführung ansehen (eigene) | ja | ja | ja | ja | ja | – | ⚠ nutzt die **echten** Rollen, nicht „Ansicht testen als“ |
| Einführung | Einführung der Rollen (alle vier) | – | – | ja | ja | ja | Trainer und Admin | ok. Nutzt die Vorschau, verschwindet also bei „Ansicht testen als Spieler“. |

## Teil 2: Antworten zu deinen Fragen

**Sieht ein Spieler in „So geht's“ Fragen zu Aufstellung, Freigeben, Rollen oder Strafe verhängen?**
- Nein. Ein Spieler sieht 9 Fragen:
  - Zusage oder Absage ändern
  - Verletzt oder im Urlaub
  - Strafen bezahlen
  - Keine Mitteilungen?
  - Termine im Handy-Kalender
  - „Noch nicht freigegeben“
  - Passwort vergessen
  - Neues Handy
  - Konto löschen oder Datenauskunft
- Die Liste der Rollen steht unten in Teil 4.
- **Du siehst alle 18, weil du Admin bist.** Das war die Vorgabe „Admin sieht alle“.
- Mit „Ansicht testen als Spieler“ sieht auch der Admin nur die 9.
- Kleiner Befund ⚠: Die Spielerfrage „Noch nicht freigegeben“ endet mit „Trainer finden Anfragen unter Einstellungen › Rollen.“ Das ist für Spieler unnötig.

**Wenden „So geht's“ und die Einführung „Ansicht testen als“ an?**
- „So geht's“: ja. Die Fragen und die Liste „Einführung der Rollen“ folgen der Vorschau.
- Die Einführung („Einführung ansehen“): **nein** ⚠. Sie rechnet mit den echten Rollen. Als Admin bekommst du immer die Admin-Folge: Spielertrainer und Kasse.
- Die automatische Einführung nach der Freigabe nutzt ebenfalls die echten Rollen. Das ist richtig so.

**Wo ist die Rollenverwaltung, die „So geht's“ beschreibt?**
- Sie heißt „**Rollen verwalten**“. Es gibt zwei Wege dorthin:
  1. Einstellungen (Zahnrad) › Gruppe „**Verwaltung**“ › Zeile „**Rollen**“. Das gilt für Trainer und Admin.
  2. Für den Admin zusätzlich: 5. Reiter „**Mehr**“ › „**Rollen**“.
- Die Seite beginnt **für den Admin mit „Ansicht testen als“**. Erst darunter folgen:
  - „Einladung“ mit Link teilen, kopieren und erneuern
  - „Offene Anfragen“
  - „Mitglieder“ mit Rollen und „Aus der Mannschaft entfernen“
  - „Kasse“
  - „Protokoll“
- Steht in den Einstellungen gar keine Gruppe „Verwaltung“, ist vermutlich eine Vorschau als Spieler aktiv. Dann rechnet die App wie für einen Spieler.
- ⚠ Unglücklich: Die Vorschau ganz oben verdeckt, dass das die Rollenverwaltung ist.

**Wer sieht heute „Einladungslink teilen“, „kopieren“ und „erneuern“?**
- Trainer, Spielertrainer und Admin, unter Rollen verwalten › „Einladung“.
- Der Server erlaubt dasselbe (`ist_leitung`).
- Spieler und reine Kassenwarte sehen es nicht und dürfen es nicht.

**Gibt es „Ich bin Trainer“ bei der Registrierung, und wer bestätigt?**
- Nein ⚠. Es gibt nur „Ich bin Kassenwart“. Den Wunsch bestätigt ein Trainer oder der Admin bei der Freigabe.
- Trainer wird man heute nur, wenn ein Trainer oder der Admin unter Mitglieder „Trainer“ einschaltet.

**Sind sichtbar und serverseitig erlaubt irgendwo verschieden?** Ja, in diesen Fällen:
1. **Termine** anlegen, ändern, löschen und Sportstätten: Der Server erlaubt das auch dem **Kassenwart**, die App nicht ⚠. Über die Schnittstelle könnte ein Kassenwart Termine löschen.
2. **Automatische Strafe entfernen**: Der Server erlaubt das Trainern, die App hat dafür keinen Knopf (`canDeleteAutoFine` ist unbenutzt) ⚠.
3. **Rückmeldung für andere setzen**: Der Server erlaubt Trainern und Admin, die App bietet es nicht an. Unkritisch.
4. **Sich selbst einem Kadereintrag zuordnen** (`set_my_player`): Die Altlast ist kaum erreichbar, steht aber serverseitig offen ⚠.
5. **„Ansicht testen als“** ändert nur die Anzeige. Das ist so gewollt: Der Admin darf serverseitig trotzdem alles.

In der umgekehrten Richtung habe ich keinen Fall gefunden: Kein sichtbarer Knopf wird vom Server abgelehnt. Ausnahme sind die gewollten Sperren, etwa der letzte Trainer, Kassenwart für sich selbst und die Sperre der Testnachricht.

## Teil 3: Vorschlag, um die Soll-Logik herzustellen

### Vor dem Start nötig

| # | Änderung | Dateien | Aufwand |
|---|---|---|---|
| 1 | **„Ich bin Trainer“ bei der Registrierung**, bestätigt nur vom Admin. Haken wie bei „Ich bin Kassenwart“. In der Freigabe sieht der Admin den Schalter „Als Trainer bestätigen“, ein Trainer sieht dort nur die Marke „Trainer?“. Er kann freigeben, aber nicht zum Trainer machen. Der Admin bekommt bei Trainer-Wunsch die Mitteilung „Neue Anfrage“ ohnehin. | Migration: `profiles.trainer_wunsch`, `handle_new_user`, `anfragen_liste`, `anfrage_freigeben` mit `p_trainer`, nur `is_admin`. `app.js`: Registrierung, Freigabe-Blatt, Marke. Prüfskript, Stand-in, FAQ und Einführung. | 2,5 bis 3 Std. |
| 2 | **Wer vergibt „Trainer“ unter Mitglieder?** Hängt von Frage 1 ab. Variante A: nur noch der Admin (`rolle_setzen` coach nur `is_admin`, Schalter für Trainer ausgeblendet). Variante B: wie heute jeder Trainer. | Migration `rolle_setzen`, `app.js` (`rolleOeffnen`), `onboardingpruef`, FAQ | A: ca. 1 Std. |
| 3 | **Termine und Sportstätten** serverseitig nur für Trainer und Admin, nicht mehr für den Kassenwart. | Migration RLS `events`, `sportstaetten`, Prüfskript | ca. 30 Min. |
| 4 | **Rollen verwalten klarer**: „Ansicht testen als“ ans Ende der Seite oder in die Einstellungen › Info. Oben stehen dann Einladung und Anfragen. | `app.js` (`mannschaftHtml`), Landkarte neu | ca. 30 Min. |

### Kann warten

| # | Änderung | Aufwand |
|---|---|---|
| 5 | „Einführung ansehen“ folgt der Vorschau („Ansicht testen als“) | ca. 30 Min. |
| 6 | Spielerfrage „Noch nicht freigegeben“ ohne den Hinweis für Trainer | 5 Min. |
| 7 | Automatische Strafe entfernen: entweder RLS nur Kassenwart und Admin oder einen Knopf für Trainer | ca. 30 Min. |
| 8 | `set_my_player` schließen (nur Trainer oder Admin, oder ganz entfernen) | ca. 30 Min. |
| 9 | Konto › Mannschaft und Kassenbanner für Spieler: entscheiden, ob Spieler die offenen Strafen aller sehen sollen (Frage 4) | je nach Entscheidung 1 bis 2 Std. |

### Vorgemerkt (nicht gebaut)

**Einführung ohne senkrechtes Scrollen.** Jede Seite passt auf den Bildschirm, auch bei 375 px Breite (kleines iPhone). Das Scrollen innerhalb der Einführung wird abgeschaltet.
- Dafür nötig: kleinere Abbildungen und mehr Zoom auf kleinen Höhen, Karte mit fester Höhe, `overflow: hidden`.
- Prüfung bei 375 × 667 px (iPhone SE) und 390 × 844 px.

### Fragen an dich

1. **Trainer vergeben:** Das Soll sagt beides, „Trainer vergeben Rollen (Trainer, Kassenwart)“ und „Admin bestätigt neue Trainer“. Gilt die Bestätigung durch den Admin nur für „Ich bin Trainer“ bei der Registrierung (Variante B), oder darf außer dem Admin niemand Trainer machen (Variante A)?
2. **Kassenbanner und Konto › Mannschaft:** Sollen Spieler weiter die offenen Strafen und den Kassenstand der Mannschaft sehen? Heute ja.

## Teil 4: Sichtbarkeit aus der Landkarte und aus `app.js`

Erzeugt mit `node .design-sync/shots/rechtetabelle.mjs`. Die Landkarte ist der Stand von Build `2026-10-19-A`; Block 2 und 3 haben keine Ansichten hinzugefügt, nur Inhalte. Die Spalte „Trainer + Kasse“ ist das Profil Spielertrainer mit Kasse.

<!-- TABELLE-ANFANG -->
### Ansichten und Blätter (aus der Landkarte)

| Ansicht / Blatt | Strang | Spieler | Kassenwart | Spielertrainer | Trainer + Kasse | Admin |
|---|---|---|---|---|---|---|
| Diagnose | diagnose | ja | ja | ja | ja | ja |
| Abmelden bestätigen | einstellungen | ja | ja | ja | ja | ja |
| Einstellungen | einstellungen | ja | ja | ja | ja | ja |
| Einwilligung widerrufen | einstellungen | ja | ja | ja | ja | ja |
| Für Google | einstellungen | ja | ja | ja | ja | ja |
| Konto löschen | einstellungen | ja | ja | ja | ja | ja |
| Mein Status · Voraussichtlich bis | einstellungen | ja | ja | ja | ja | ja |
| Mitteilungen | einstellungen | ja | ja | ja | ja | ja |
| Neuer Termin | einstellungen | – | – | – | – | ja |
| Neues Passwort | einstellungen | ja | ja | ja | ja | ja |
| PayPal-Link der Kasse | einstellungen | – | ja | – | ja | ja |
| Position | einstellungen | ja | ja | ja | ja | ja |
| Profil | einstellungen | ja | ja | ja | ja | ja |
| Push-Texte | einstellungen | – | – | – | – | ja |
| Ruhezeiten | einstellungen | ja | ja | ja | ja | ja |
| So geht's | einstellungen | ja | ja | ja | ja | ja |
| Spielplan BFV | einstellungen | – | – | ja | ja | ja |
| Kader | kader | – | – | ja | ja | ja |
| Status ändern | kader | – | – | ja | ja | ja |
| Kader-Info | kalender | – | – | ja | ja | ja |
| Kalender | kalender | ja | ja | ja | ja | ja |
| Push bestätigen | kalender | – | – | ja | ja | ja |
| Rückmeldungen | kalender | – | – | ja | ja | ja |
| Rückmeldungen teilen | kalender | – | – | ja | ja | ja |
| Termin anlegen | kalender | – | – | ja | ja | ja |
| Termin-Menü | kalender | ja | ja | ja | ja | ja |
| Termine abonnieren | kalender | ja | ja | ja | ja | ja |
| Ilja Rennert | kasse | – | ja | – | ja | ja |
| Kasse · Bezahlt | kasse | – | ja | – | ja | ja |
| Kasse · Gemeldet | kasse | – | ja | – | ja | ja |
| Kasse · Offen | kasse | – | ja | – | ja | ja |
| Spieler auswählen | kasse | – | ja | – | ja | ja |
| Strafe buchen | kasse | – | ja | – | ja | ja |
| Strafe mit Verlauf | kasse | – | ja | – | ja | ja |
| Strafe verhängen | kasse | – | ja | – | ja | ja |
| Strafe bearbeiten | katalog | – | ja | – | ja | ja |
| Strafenkatalog | katalog | ja | ja | ja | ja | ja |
| Strafen-Konto | konto | ja | ja | ja | ja | ja |
| Zahlung melden | konto | ja | ja | ja | ja | ja |
| Mehr | mehr | – | – | – | ja | ja |
| Anfrage freigeben | rollen-verwalten | – | – | ja | ja | ja |
| Einladung teilen | rollen-verwalten | – | – | ja | ja | ja |
| Einladungslink erneuern | rollen-verwalten | – | – | ja | ja | ja |
| PayPal-Link der Kasse | rollen-verwalten | – | – | – | ja | ja |
| Rollen eines Mitglieds | rollen-verwalten | – | – | ja | ja | ja |
| Rollen verwalten | rollen-verwalten | – | – | ja | ja | ja |
| Aufstellung | trainer | – | – | ja | ja | ja |
| Aufstellungs-Menü | trainer | – | – | ja | ja | ja |
| Bank-Blatt | trainer | – | – | ja | ja | ja |
| Formation wechseln | trainer | – | – | ja | ja | ja |
| Push bestätigen | trainer | – | – | ja | ja | ja |
| Rückmeldungen | trainer | – | – | ja | ja | ja |
| Rückmeldungen teilen | trainer | – | – | ja | ja | ja |
| Trainer | trainer | – | – | ja | ja | ja |
| Vorlagen-Menü | trainer | – | – | ja | ja | ja |
| Kader-Info | uebersicht | – | – | ja | ja | ja |
| Mein Status · Voraussichtlich bis | uebersicht | ja | ja | ja | ja | ja |
| Push bestätigen | uebersicht | – | – | ja | ja | ja |
| Rückmeldungen | uebersicht | – | – | ja | ja | ja |
| Rückmeldungen teilen | uebersicht | – | – | ja | ja | ja |
| Spiel bearbeiten | uebersicht | – | – | ja | ja | ja |
| Termin-Menü | uebersicht | ja | ja | ja | ja | ja |
| Übersicht | uebersicht | ja | ja | ja | ja | ja |
| Zahlung melden | uebersicht | ja | ja | ja | ja | ja |

### Knöpfe und Menüeinträge (aus der Landkarte)

| Knopf / Eintrag | Art | Spieler | Kassenwart | Spielertrainer | Trainer + Kasse | Admin |
|---|---|---|---|---|---|---|
| + Strafe | kat-add | – | ja | – | ja | ja |
| + Strafe verhängen | ks-wahl | – | ja | – | ja | ja |
| + Termin | termin-new | – | – | ja | ja | ja |
| 2 Zahlungen bestätigen Kasse · seit heute › | task-pay | – | ja | – | ja | ja |
| 9 zu · 2 ab · 5 offen › | rsvp-sheet | – | – | ja | ja | ja |
| Abmelden | logout | ja | ja | ja | ja | ja |
| Alle Strafen › | goto | ja | ja | ja | ja | ja |
| Angeschlagen | status-fenster | ja | ja | ja | ja | ja |
| Anleitung › | ein | ja | ja | ja | ja | ja |
| Aufstellung11 von 11› | lineup-edit | – | – | ja | ja | ja |
| Auswählen › | ks-spieler-w | – | ja | – | ja | ja |
| Bezahlt | kstab | – | ja | – | ja | ja |
| Diagnose› | ein | ja | ja | ja | ja | ja |
| Einstellungen | mehr | – | – | – | ja | ja |
| Einstellungen öffnen | zahnrad | ja | ja | ja | ja | ja |
| Elf aufstellen | tvgame | – | – | ja | ja | ja |
| Elf steht › | lineup-edit | – | – | ja | ja | ja |
| Felix Oberhaus (du)Admin› | mf-mitglied | – | – | ja | ja | ja |
| FO Felix Oberhaus Admin · Spieler · Profil anseh | ein | – | – | – | – | ja |
| FO Felix Oberhaus bar · 13.09. 3,00 € | ks-det | – | ja | – | ja | ja |
| FO Felix Oberhaus Kassenwart · Spieler · Profil | ein | – | ja | – | – | – |
| FO Felix Oberhaus Spieler · Profil ansehen › | ein | ja | – | – | – | – |
| FO Felix Oberhaus Trainer · Kassenwart · Spieler | ein | – | – | – | ja | – |
| FO Felix Oberhaus Trainer · Spieler · Profil ans | ein | – | – | ja | – | – |
| Gemeldet 2 | kstab | – | ja | – | ja | ja |
| Gesundheitsstatus erlauben | pr-gesundheit | ja | ja | ja | ja | ja |
| Ilja Rennert buchen | ks-spieler | – | ja | – | ja | ja |
| Kader | mehr | – | – | – | ja | ja |
| Kader-Info teilen | kader-info | – | – | ja | ja | ja |
| Kader13 fit · 1 verletzt · 1 Urlaub› | rs-kader | – | – | ja | ja | ja |
| Kader13 fit› | nav | – | – | ja | ja | ja |
| Kader16 Spieler ›13 fit · 1 angeschlagen · 1 ver | goto | – | – | ja | ja | ja |
| Kalender | tab | ja | ja | ja | ja | ja |
| Kalender › | goto | ja | ja | ja | ja | ja |
| Kalender abonnieren › | cal-sheet | ja | ja | ja | ja | ja |
| Kalender abonnierenAus› | ein | ja | ja | ja | ja | ja |
| Kasse | tab5 | – | ja | – | – | – |
| Kasse | mehr | – | – | – | ja | ja |
| Katalog | tab | ja | ja | ja | ja | ja |
| Konto | tab | ja | ja | ja | ja | ja |
| KontoLöschen› | pr-konto-weg | ja | ja | ja | ja | ja |
| Lena AnfrageKassenwart?Abwehr› | mf-anfrage | – | – | ja | ja | ja |
| Link erneuernalter wird ungültig | mf | – | – | ja | ja | ja |
| Link teilen | mf | – | – | ja | ja | ja |
| Mehr | tvmenu | – | – | ja | ja | ja |
| Mehr | tab5 | – | – | – | – | ja |
| Mehr zu diesem Termin | tkmenu | ja | ja | ja | ja | ja |
| Mehr zu Verspätete Rückmeldung | ks-zmenu | – | ja | – | ja | ja |
| Mehr zur Vorlage Grundelf | tvtplmenu | – | – | ja | ja | ja |
| Meldung von Bruno Kessler im Detail | ks-det | – | ja | – | ja | ja |
| MitteilungenNicht eingerichtet› | ein | ja | ja | ja | ja | ja |
| Neuer Termin{liste}. Jetzt zu- oder absagen.› | ein | – | – | – | – | ja |
| Offen | kstab | – | ja | – | ja | ja |
| PasswortÄndern› | pw-aendern | ja | ja | ja | ja | ja |
| PayPal-LinkTeamkassefasanerie› | mf | – | – | – | ja | ja |
| PayPalTeamkassefasanerie› | pr-paypal | – | ja | – | ja | ja |
| PositionMittelfeld› | pr-position | ja | ja | ja | ja | ja |
| Profil | mehr | – | – | – | ja | ja |
| Push senden | rs-push | – | – | ja | ja | ja |
| Push-Texte› | ein | – | – | – | – | ja |
| Rollen | mehr | – | – | – | – | ja |
| Rollen› | goto | – | – | ja | ja | ja |
| Rückmeldungen9 zu · 2 ab · 5 offen› | rsvp-sheet | – | – | ja | ja | ja |
| RückmeldungenMeldeschluss in 21 h9 zu · 2 ab · 5 | rsvp-sheet | – | – | ja | ja | ja |
| Ruhezeiten22 bis 8 Uhr› | ein | ja | ja | ja | ja | ja |
| So geht's› | ein | ja | ja | ja | ja | ja |
| Spieler wählen › | tvbankadd | – | – | ja | ja | ja |
| Spielplan BFVVerbunden› | ein | – | – | ja | ja | ja |
| Status von Moritz Vogler ändern | status-blatt | – | – | ja | ja | ja |
| Strafenkatalog› | goto | – | ja | ja | ja | ja |
| Termin bearbeiten | termin-edit | – | – | ja | ja | ja |
| Trainer | tab5 | – | – | ja | ja | – |
| Trainer | mehr | – | – | – | ja | ja |
| Übersicht teilen | rs-teilen | – | – | ja | ja | ja |
| Verspätete Rückmeldung bearbeiten | kat-edit | – | ja | – | ja | ja |
| Weiter | ks-weiter | – | ja | – | ja | ja |
| Weitere | tvmoreform | – | – | ja | ja | ja |
| Zahlung melden › | paid-self | ja | ja | ja | ja | ja |
| Zu den Mitteilungen | ein | ja | ja | ja | ja | ja |

### So geht's: Fragen je Rolle (aus app.js)

| Frage | für | Spieler | Kassenwart | Trainer (ohne Kader) | Spielertrainer | Admin |
|---|---|---|---|---|---|---|
| Zusage oder Absage ändern | alle | ja | ja | ja | ja | ja |
| Verletzt oder im Urlaub | spieler | ja | ja | – | ja | ja |
| Strafen bezahlen | spieler | ja | ja | – | ja | ja |
| Keine Mitteilungen? | alle | ja | ja | ja | ja | ja |
| Termine im Handy-Kalender | alle | ja | ja | ja | ja | ja |
| „Noch nicht freigegeben“ | alle | ja | ja | ja | ja | ja |
| Passwort vergessen | alle | ja | ja | ja | ja | ja |
| Neues Handy | alle | ja | ja | ja | ja | ja |
| Neuen Spieler einladen | trainer | – | – | ja | ja | ja |
| Jemanden zum Trainer machen | trainer | – | – | ja | ja | ja |
| Spieler verlässt die Mannschaft | trainer | – | – | ja | ja | ja |
| Termin anlegen oder absagen | trainer | – | – | ja | ja | ja |
| Aufstellung erstellen und teilen | trainer | – | – | ja | ja | ja |
| Der Kassenwart wechselt | trainer, kassenwart | – | ja | ja | ja | ja |
| Neue PayPal-Adresse der Kasse | kassenwart, trainer | – | ja | ja | ja | ja |
| Strafe verhängen | kassenwart | – | ja | – | – | ja |
| Strafe falsch eingetragen | kassenwart | – | ja | – | – | ja |
| Konto löschen oder Datenauskunft | alle | ja | ja | ja | ja | ja |

### Einführung: Seiten je Rolle (aus app.js, erstes Mal, höchstens 6)

| Seite | Spieler | Kassenwart | Trainer (ohne Kader) | Spielertrainer | Admin |
|---|---|---|---|---|---|
| Zu- oder absagen (`sp_termin`) | ja | ja | – | – | – |
| Verletzt oder im Urlaub? (`sp_status`) | ja | – | – | – | – |
| Strafen bezahlen (`sp_strafen`) | ja | – | – | – | – |
| Los geht's (`sp_los`) | ja | – | – | – | – |
| Wer kommt? (`tr_rueck`) | – | – | ja | – | – |
| Elf aufstellen (`tr_elf`) | – | – | ja | ja | ja |
| Kader und Status (`tr_kader`) | – | – | ja | ja | – |
| Freigeben und Rollen (`tr_rollen`) | – | – | ja | ja | ja |
| Die Kasse im Blick (`kw_kasse`) | – | ja | – | – | ja |
| Strafe verhängen (`kw_verhaengen`) | – | ja | – | – | – |
| Zahlungen bestätigen (`kw_pruefen`) | – | ja | – | – | – |
| Dein nächster Termin (`st_termin`) | – | – | – | ja | ja |
| Auf den Home-Bildschirm (`home`) | ja | ja | ja | ja | ja |
| Mitteilungen erlauben (`push`) | ja | ja | ja | ja | ja |
<!-- TABELLE-ENDE -->
