# Starttag: so kommt die Mannschaft in die App

Produktion: https://fasanerie-nord-2.vercel.app · Stand 19.10.2026 (Build `2026-10-19-A`)

Ausgangslage nach der Bereinigung:
- **Kader:** nur dein Eintrag „Benjamin Lauck“, keine Strafen, keine Zusagen.
- **Termine:** die BFV-Spiele und die künftigen Trainings stehen schon drin.
- **Rollen:** Du bist Admin, Spieler und Kassenwart. Es gibt noch **keinen Trainer**. Weitere Konten gibt es nicht.

## Vorbereitung

**Erledigt:**

- [x] Kontaktadresse `teamkabine-app@gmx.de` in Datenschutz (2×) und Impressum (1×), live seit Build `2026-10-18-D`.
- [x] SMTP in Supabase eingerichtet: GMX, Absender `teamkabine-app@gmx.de`, Name „Teamkabine“.
- [x] Supabase Auth: „Confirm email“ aus, „Allow new users to sign up“ an.
- [x] Site URL und Redirect URLs geprüft, stimmen.
- [x] Strafe vom 18.10., 00:26 Uhr, war ein bewusster Test; das Löschen bei der Bereinigung war richtig.
- [x] Backup auf USB-Stick: Projekt (`D:\fasanerie-backup-2026-10-18`) und `fussball-app-db` (`D:\fussball-app-db`).
- [x] Konto `rascha.k@yahoo.com` gelöscht (19.10.2026). Vorher geprüft: kein Kadereintrag, keine Zusagen, keine Strafen.
- [x] Künftige Termine geprüft und bestätigt. Am 19.10. kam über den BFV-Abgleich ein Spiel dazu: Auswärtsspiel bei VfB Sparta München, 18.04.2027.
- [x] Einführung je Rolle nach der ersten Anmeldung. Wieder aufrufbar unter Einstellungen › So geht's.
- [x] „So geht's“ mit häufigen Fragen nach Rolle in Einstellungen.

**Noch offen (Benni, vor dem Starttag):**

1. Auftragsverarbeitungsverträge (DPA) mit Supabase und Vercel abschließen.
2. Passwort-Mail testen: Abmelden › „Passwort vergessen?“ mit deiner Adresse. Die Mail muss von „Teamkabine“ kommen, und der Link muss in die App führen.
3. **Gerätetest** nach `.design-sync/GERAETETEST-START.md`, mindestens Abschnitt 1, 2, 10 und 11. Dazu Einführung und „So geht's“.
4. Punkte aus „Fehlt in der App“ (`.design-sync/concepts/einfuehrung/PLAN.md`).

## Ablauf am Starttag: ein Link für alle

Alle, auch Trainer und Kassenwart, registrieren sich über **denselben Spieler-Link**. Die Rollen vergibst du danach in der App.

| # | Wer | Wo in der App | Was |
|---|---|---|---|
| 1 | **Du (Admin)** | Einstellungen (Zahnrad) › Rollen › **Einladung** › „Link teilen“ | Den Spieler-Link in die WhatsApp-Gruppe. Er gilt, bis jemand „Link erneuern“ tippt. |
| 2 | **Alle** | Link öffnen › „Konto erstellen“ (Name, E-Mail, Passwort; den Haken „Ich bin Kassenwart“ nur der Kassenwart) › Datenschutz › Position › Home-Bildschirm › Mitteilungen › „Warte auf Freigabe“ | Gesundheitsangaben (verletzt/angeschlagen) sind freiwillig und brauchen den Alters-Haken. |
| 3 | **Du** | Mitteilung „📋 Neue Anfrage: Name“ antippen, oder Einstellungen › Rollen › **Offene Anfragen** › Anfrage | „Dem Kader zuordnen“: **„Neuer Kadereintrag“** lassen (der Kader ist leer, das ist richtig). Wer **nicht mitspielt** (z. B. ein Trainer): **„Ohne Kadereintrag (spielt nicht mit)“**. Dann › **Freigeben**. Die Person bekommt „✅ Du bist freigegeben“. |
| 4 | **Du** | In derselben Anfrage, wenn sie den Kassenwart-Wunsch trägt | Schalter **„Als Kassenwart bestätigen“** einschalten, dann Freigeben. Später geht das auch über Rollen › Mitglieder › Person › „Kassenwart“. |
| 5 | **Du** | Einstellungen › Rollen › **Mitglieder** › Person › Schalter **„Trainer“** | Trainer vergeben, gern mehrere. Die Person bekommt „Du bist jetzt Trainer.“ Ab dann kann jeder Trainer selbst freigeben und Rollen ändern, auch Trainer vergeben und abnehmen. |
| 6 | **Alle** | Beim nächsten Öffnen nach der Freigabe | Die **Einführung** zur eigenen Rolle erscheint einmal. Wer später Trainer oder Kassenwart wird, sieht beim nächsten Öffnen nur den neuen Teil. Wieder aufrufbar unter Einstellungen › So geht's. |
| 7 | **Kassenwart** | Wird beim ersten Öffnen nach dem PayPal-Link gefragt, sonst Einstellungen › Profil › **PayPal** | Nur den Namen hinter `paypal.me/` eintragen. Aktuell steht noch `Teamkassefasanerie` (von dir). Gibst du die Kasse ab, wird er nicht mehr angezeigt. |
| 8 | **Du** | Einstellungen › Rollen › Mitglieder · Mehr › Kader | Kontrolle: Alle sind da, Rollen stimmen, im Kader steht jeder genau einmal. |

Hinweise zum Ablauf:
- Bis zum ersten Trainer gibst nur du frei. Die Mitteilung „Neue Anfrage“ geht an alle Trainer und an dich.
- Sobald es einen Trainer gibt, bleibt mindestens einer: Der letzte Trainer kann seine Rolle nicht abgeben, sein Konto nicht löschen und nicht entfernt werden. Das kann nur der Admin ändern. Zusätzlich muss immer ein Konto Trainer oder Admin bleiben.
- **Trainer, der nicht mitspielt:** Bei der Freigabe „Ohne Kadereintrag (spielt nicht mit)“ wählen, danach unter Mitglieder „Trainer“ einschalten. Er taucht nicht im Kader auf, sagt nicht zu oder ab und bekommt keine automatischen Strafen.
- **Trainer-Links gibt es nicht mehr** (seit Build `2026-10-19-A`). Alle kommen über den Spieler-Link; früher erzeugte Trainer-Links sind ungültig.

## Wenn etwas schiefgeht

**Spieler falsch zugeordnet** (falscher Kadereintrag gewählt):
- In der App lässt sich die Zuordnung nach der Freigabe nicht ändern.
- Weg 1: Einstellungen › Rollen › Mitglieder › Person › „Aus der Mannschaft entfernen“. Das Konto wird gelöscht, die Person registriert sich über den Spieler-Link neu. Strafen bleiben ohne Namen.
- Weg 2, wenn schon Strafen oder Zusagen dranhängen: nicht entfernen, sondern die Zuordnung in der Datenbank korrigieren lassen (`profiles.player_id`).
- Vorbeugen: Beim Freigeben „Neuer Kadereintrag“ lassen, für Nicht-Spieler „Ohne Kadereintrag“. Freie Einträge gibt es außer deinem keine.

**„Dieser Einladungslink ist nicht mehr gültig“:**
- Spieler-Link: Jemand hat „Link erneuern“ getippt. Einstellungen › Rollen › Einladung › „Link teilen“ schickt den aktuellen Link.
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
