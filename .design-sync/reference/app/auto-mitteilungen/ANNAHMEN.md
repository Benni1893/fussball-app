# Annahmen: Automatische Mitteilungen (ab AM3)

Auftrag vom 05.10.2026: Wo eine Entscheidung fehlt, gilt der Vorschlag aus PHASE0.md;
fehlt auch der, eine begründete Annahme. Jede steht hier und kann einzeln
zurückgenommen werden.

## AM3 Termine (Migration 0046)

| # | Annahme | Grund |
|---|---|---|
| T1 | `termin_abgesagt` geht wie `termin_geaendert` (F3) an alle Spieler **außer Urlaub und verletzt**. | Gleiche Logik wie die entschiedene Änderung; wer ausfällt, braucht die Absage nicht. |
| T2 | „Urlaub oder verletzt“ zählt **am Tag des Termins** (`status_until` einschließlich, ohne Datum offen), nicht am Tag der Nachricht. Gilt für alle Termin- und Rückmeldungsnachrichten. | Wer bis Mittwoch verletzt ist, soll die Absage für Samstag bekommen. |
| T3 | `termin_neu` geht an **alle** verknüpften Spieler, auch an Urlaub und verletzt; nur der Auslöser nicht (F1). | Neue Termine liegen meist nach dem Ausfall; der Katalog sagt „alle Spieler“. |
| T4 | Absage mit **2 Minuten Karenz**. „Findet statt“ davor nimmt sie still zurück; danach geht „Findet doch statt“ als `termin_geaendert`. | Ein Fehlklick auf „Fällt aus“ soll keine Push an alle auslösen. |
| T5 | **Löschen** eines Termins erzeugt keine Nachricht; noch nicht gesammelte Meldungen zu ihm verfallen. | Löschen ist meist Korrektur eines Fehlers; „diese und alle folgenden“ einer Serie würde sonst viele Absagen erzeugen. Für echte Ausfälle gibt es „Fällt aus“. |
| T6 | Änderungen werden **je Auslöser 10 Minuten** gesammelt. Mehrere Termine (z. B. Serie) ergeben **eine** Nachricht: „📅 3 Termine geändert“, Text „ab <Datum>: <Änderung>“, bei unterschiedlichen Änderungen die Terminliste. | Eine Serienänderung soll nicht zwanzig Pushs auslösen. |
| T7 | Vorlage `termin_neu`: Titel „📅 {anzahl}“ mit „1 neuer Termin“ / „3 neue Termine“, Text „Jetzt zu- oder absagen: {liste}“. Nur ersetzt, solange der Auslieferungsstand gilt. | Wie K1 (keine „1 neue Termine“); außerdem stand nach dem Datum „..“ („27.09.. Jetzt“). |
| T8 | Ganztägige Termine: `{uhrzeit}` = „ganztägig“. Terminlisten zeigen höchstens 5 Einträge, dann „und N weitere“. | `{uhrzeit}` ist Pflicht in den Vorlagen; Push-Texte sind auf 400 Zeichen begrenzt. |
| T9 | Steht die „neu“-Meldung eines Termins noch aus (30 Minuten), erzeugen Änderung oder Absage dieses Termins **nichts**; die Neu-Meldung zeigt dann den Endstand, bei Absage entfällt sie. | Spieler kennen den Termin noch nicht. |
