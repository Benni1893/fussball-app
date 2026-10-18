# Starttag: so kommt die Mannschaft in die App

Produktion: https://fasanerie-nord-2.vercel.app · Stand 18.10.2026 (Build `2026-10-18-D`)

Ausgangslage nach der Bereinigung:
- **Kader:** nur dein Eintrag „Benjamin Lauck“, keine Strafen, keine Zusagen.
- **Termine:** die BFV-Spiele und die künftigen Trainings stehen schon drin.
- **Rollen:** Du bist Admin, Spieler und Kassenwart. Es gibt noch **keinen Trainer**.

## Vorbereitung

**Erledigt:**

- [x] Kontaktadresse `teamkabine-app@gmx.de` in Datenschutz (2×) und Impressum (1×), live seit Build `2026-10-18-D`.
- [x] SMTP in Supabase eingerichtet: GMX, Absender `teamkabine-app@gmx.de`, Name „Teamkabine“.
- [x] Supabase Auth: „Confirm email“ aus, „Allow new users to sign up“ an.
- [x] Site URL und Redirect URLs geprüft, stimmen.
- [x] Strafe vom 18.10., 00:26 Uhr, war ein bewusster Test; das Löschen bei der Bereinigung war richtig.
- [x] Backup auf USB-Stick: Projekt (`D:asanerie-backup-2026-10-18`) und `fussball-app-db` (`D:ussball-app-db`).

**Noch offen (Benni, vor dem Starttag):**

1. Konto `rascha.k@yahoo.com` löschen (Einstellungen › Rollen › Mitglieder › Konto › „Aus der Mannschaft entfernen“).
2. Auftragsverarbeitungsverträge (DPA) mit Supabase und Vercel abschließen.
3. Passwort-Mail testen: Abmelden › „Passwort vergessen?“ mit deiner Adresse. Die Mail muss von „Teamkabine“ kommen, und der Link muss in die App führen.
4. Künftige Termine prüfen (13 BFV-Spiele, Training 20., 22., 27., 29.10., Mannschaftsabend 13.11.).
5. Trainer festlegen (Schritt 1 unten).
6. **Gerätetest** nach `.design-sync/GERAETETEST-START.md`, mindestens Abschnitt 1, 2, 10 und 11.

## Ablauf am Starttag

| # | Wer | Wo in der App | Was |
|---|---|---|---|
| 1 | **Du (Admin)** | Einstellungen (Zahnrad) › Rollen › **Trainer-Links** › „Trainer-Link erzeugen · einmal, 7 Tage“ | Link erzeugen und **privat** per „Link teilen“ an den Trainer schicken. Der Link gilt einmal und 7 Tage. Wer sich darüber anmeldet, ist sofort Spieler und Trainer, ohne Freigabe. |
| 1b | *oder* du selbst als Spielertrainer | Einstellungen › Rollen › **Mitglieder** › du › „Trainer“ einschalten | Nur, wenn du selbst Trainer bist. |
| 2 | **Trainer** | Link öffnen › „Konto erstellen“ › Datenschutz › Position › **„Spielst du mit?“** › Home-Bildschirm › Mitteilungen erlauben › „Alles bereit“ | Bei „Spielst du mit?“: „Ich spiele nicht mit“ oder „Neuer Kadereintrag“. Danach die App **vom Home-Bildschirm** öffnen und dort neu anmelden; nur dort kommen auf dem iPhone Mitteilungen an. |
| 3 | **Du oder Trainer** | Einstellungen › Rollen › **Einladung** › „Link teilen“ | Den Spieler-Link in die WhatsApp-Gruppe. Er gilt, bis jemand „Link erneuern“ tippt. |
| 4 | **Spieler** | Link öffnen › „Konto erstellen“ (Name, E-Mail, Passwort; den Haken „Ich bin Kassenwart“ nur der Kassenwart) › Datenschutz › Position › Home-Bildschirm › Mitteilungen › „Warte auf Freigabe“ | Gesundheitsangaben (verletzt/angeschlagen) sind freiwillig und brauchen den Alters-Haken. |
| 5 | **Du oder Trainer** | Mitteilung „📋 Neue Anfrage: Name“ antippen, oder Einstellungen › Rollen › **Offene Anfragen** › Anfrage | „Dem Kader zuordnen“: **„Neuer Kadereintrag“** lassen (der Kader ist leer, das ist richtig) › **Freigeben**. Der Spieler bekommt „✅ Du bist freigegeben“. |
| 6 | **Du oder Trainer** | In derselben Anfrage, wenn sie den Kassenwart-Wunsch trägt | Schalter **„Als Kassenwart bestätigen“** einschalten, dann Freigeben. Die Person bekommt „🔑 Du bist jetzt Kassenwart“. Später geht das auch über Rollen › Mitglieder › Person › „Kassenwart“. |
| 7 | **Kassenwart** | Wird beim ersten Öffnen nach dem PayPal-Link gefragt, sonst Einstellungen › Profil › **PayPal** | Nur den Namen hinter `paypal.me/` eintragen. Aktuell steht noch `Teamkassefasanerie` (von dir); gibst du die Kasse ab, wird er nicht mehr angezeigt. |
| 8 | **Du** | Einstellungen › Rollen › Mitglieder · Mehr › Kader | Kontrolle: Alle sind da, Rollen stimmen, im Kader steht jeder genau einmal. |

Reihenfolge: Erst Trainer (1 und 2), dann den Spieler-Link (3). Dann kann der Trainer selbst freigeben,
und die Mitteilungen „Neue Anfrage“ gehen an ihn und an dich.

## Wenn etwas schiefgeht

**Spieler falsch zugeordnet** (falscher Kadereintrag gewählt):
- In der App lässt sich die Zuordnung nach der Freigabe nicht ändern.
- Weg 1: Einstellungen › Rollen › Mitglieder › Person › „Aus der Mannschaft entfernen“. Das Konto wird gelöscht, die Person registriert sich über den Spieler-Link neu. Strafen bleiben ohne Namen.
- Weg 2, wenn schon Strafen oder Zusagen dranhängen: nicht entfernen, sondern die Zuordnung in der Datenbank korrigieren lassen (`profiles.player_id`).
- Vorbeugen: Beim Freigeben immer „Neuer Kadereintrag“ lassen. Freie Einträge gibt es außer deinem keine.

**„Dieser Einladungslink ist nicht mehr gültig“:**
- Spieler-Link: Jemand hat „Link erneuern“ getippt. Einstellungen › Rollen › Einladung › „Link teilen“ schickt den aktuellen Link.
- Trainer-Link: schon benutzt oder älter als 7 Tage. Unter Trainer-Links den alten widerrufen und einen neuen erzeugen.
- Öffnet der Link nur die Anmeldung: Seite einmal neu laden. Ein Link im selben Tab wird sonst verworfen (bekannte Kante).

**Push kommt nicht an:**
1. **iPhone:** Mitteilungen gibt es nur in der App vom Home-Bildschirm (iOS 16.4 oder neuer), nicht in Safari.
2. In der App: Einstellungen › Mitteilungen. Steht dort „aktiv“? Sonst „Mitteilungen erlauben“. Dann „Testnachricht senden“; sie kommt innerhalb einer Minute.
3. Ruhezeiten in der App prüfen (Einstellungen › Ruhezeiten). In dieser Zeit kommen keine Mitteilungen, dringende nur, wenn „Dringendes zustellen“ an ist.
4. Gerät: iOS-Einstellungen › Mitteilungen › Fasanerie erlaubt? Fokus/„Nicht stören“ aus? Android: Chrome bzw. App-Mitteilungen erlaubt, Energiesparen für Chrome aus.
5. Kommt die Testnachricht, aber andere Mitteilungen nicht: Schalter der jeweiligen Art unter Einstellungen › Mitteilungen.
6. Hat jemand die Erlaubnis einmal verweigert: in den Geräte-Einstellungen wieder erlauben. Auf dem iPhone hilft notfalls nur, die App vom Home-Bildschirm zu löschen und neu hinzuzufügen.

**Anmelden klappt nicht / Passwort vergessen:** „Passwort vergessen?“ schickt eine Mail. Kommt sie nicht an:
Spam prüfen und ein paar Minuten warten. Versand läuft über GMX (Absender „Teamkabine“,
`teamkabine-app@gmx.de`); GMX begrenzt die Mails pro Stunde. Bei Bedarf setzt du das Passwort im
Supabase-Dashboard (Authentication › Users) zurück.
