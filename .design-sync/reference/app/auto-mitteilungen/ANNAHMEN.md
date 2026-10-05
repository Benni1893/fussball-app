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

## AM4 Rückmeldung (Migration 0048)

| # | Annahme | Grund |
|---|---|---|
| R1 | Vorlage `absage_kurzfristig`: Titel „🚨 {anzahl}“ mit „1 kurzfristige Absage“ / „2 kurzfristige Absagen“. Nur ersetzt, solange der Auslieferungsstand gilt. | Wie K1. |
| R2 | Die Erinnerung gilt für **alle** Spiele und Trainings mit Meldeschluss, auch ohne Auto-Strafe (alle BFV-Spiele). Der Satz „Ohne Antwort wird's teuer.“ kommt seit 0052 (Entscheidung 06.10.2026) über den Platzhalter `{strafhinweis}` nur bei Terminen mit Auto-Strafe. | Eine Erinnerung hilft auch ohne Strafe. |
| R3 | Erinnerungsfenster: Meldeschluss in **22 bis 24 Stunden** bzw. in **0 bis 2 Stunden**, Cron alle 5 Minuten, je Termin, Spieler und Stufe höchstens einmal. Ein spät angelegter Termin bekommt nur die Stufen, deren Fenster noch kommt. | Vorschlag aus PHASE0.md, mit Spielraum für einen ausgefallenen Cron-Lauf. |
| R4 | Übersicht nach Meldeschluss: einmal je Termin, wenn der Meldeschluss höchstens eine Stunde zurückliegt und der Termin noch nicht begonnen hat. „Offen“ = Spieler des Vereins ohne Rückmeldung, **ohne** Urlaub/verletzt am Termintag. | Ein Spieler im Urlaub ist nicht „offen“. |
| R5 | Kurzfristige Absage: jede neue Absage („ab“, auch Wechsel von „zu“) zwischen Meldeschluss und Beginn; an die Trainer, 10 Minuten gesammelt; wer in der Zeit wieder zusagt, fällt aus der Liste. | Vorschlag aus PHASE0.md. |

## AM5 Offene Strafen (Migration 0049) und Hinweis

| # | Annahme | Grund |
|---|---|---|
| S1 | Auslöser: mindestens eine **offene** Strafe, die vor mehr als **28 Tagen angelegt** wurde (`created_at`, wie der Mahnzuschlag). Betrag und Anzahl über **alle** offenen Strafen des Spielers (nicht gemeldet, nicht storniert), Datum = ältestes Vergehen (`date`). | Katalog „offen älter als 4 Wochen“; die Frist der App zählt ab Anlage. |
| S2 | Vorlage `strafen_offen`: Text „{anzahl}, älteste vom {datum}.“ mit „1 Strafe“ / „9 Strafen“. Nur ersetzt, solange der Auslieferungsstand gilt. | Wie K1. |
| S3 | Zeitpunkt: am **1. jedes Monats um 16:00 UTC** (18:00 Sommerzeit, 17:00 Winterzeit); höchstens einmal im Monat je Spieler. Zugestellt nur mit eingeschaltetem Schalter (Standard aus). | Vorschlag aus PHASE0.md („am 1., 18:00 Ortszeit“); pg_cron rechnet in UTC. |
| S4 | Der Hinweis auf der Seite Mitteilungen verschwindet über die vorgesehene Konstante `AUTO_MITTEILUNGEN_AKTIV = true` (Build 2026-10-05-C). Live erst mit dem Push nach deinem OK. | Vorgabe AM5. |

## P1 serverseitig (Migration 0050) und Texte (0051)

| # | Annahme | Grund |
|---|---|---|
| N1 | Wer die Nachfrage auslöst und selbst ohne Rückmeldung ist (Spielertrainer), bekommt sie nicht (F1) und zählt nur unter „offen“. | Grundregel F1. |
| N2 | Die 12-Stunden-Sperre beginnt erst, wenn mindestens eine Nachricht eingereiht wurde. Erreicht eine Nachfrage niemanden (alle ohne Gerät), darf sofort erneut gefragt werden. | Sonst sperrt ein Versuch ohne Wirkung zwölf Stunden. |
| N3 | Text: Datum kurz, Uhrzeit optional (ganztägig: ohne), Meldeschluss nur als optionaler Platzhalter (steht nicht im Text). Rückgabe zusätzlich `nur_zaehlen`, `letzte`. | Vorschlag aus einstellungen-v2/PHASE0.md, Abschnitt e). |
| N4 | Die mit P1 beschlossenen Textkorrekturen stehen in einer **eigenen** Migration 0051 (aus den Live-Definitionen erzeugt, nur die Meldungstexte geändert). `set_ical_url` sagt jetzt „Nur Trainer, Kassenwart oder Admin dürfen die iCal-URL setzen.“ (Schrägstriche durch Komma und „oder“). | Kleinere, getrennt prüfbare Migration. |
