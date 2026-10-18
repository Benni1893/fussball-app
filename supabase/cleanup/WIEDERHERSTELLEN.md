# Wiederherstellen nach der Startbereinigung (18.10.2026)

Die Sicherungen liegen **nur lokal** (per `.gitignore` nicht im Repo):

| Datei | Inhalt |
|---|---|
| `supabase/cleanup/backup-2026-10-18/full.dump` | Vollsicherung `pg_dump` 17.6, Custom-Format, alle Schemas (auch `auth`), 62 Datenblöcke, 1 876 277 Byte, SHA-256 `3a92a744…6cbea3fa`, Stand 18.10.2026 10:53 |
| `supabase/cleanup/backup-2026-10-18/*.json` | Gruppe A vor der Bereinigung: `fines` (317), `fine_status_log` (291), `players` (16), `player_status` (16), `rsvps` (38), `lineups` (11), `events` (33 gelöschte), `konto_protokoll` (1), dazu `meta.json` |

Zurückspielen ist ein Schreibzugriff auf die Produktion. Vorher eine **neue** Sicherung ziehen, damit
der Stand nach der Bereinigung nicht verloren geht.

## Werkzeug

`pg_restore` ist nicht installiert. Die offiziellen EDB-Binärdateien holen und nur `bin/` entpacken:

```sh
mkdir -p /c/Users/Benjamin/fussball-app-db/pgtools && cd /c/Users/Benjamin/fussball-app-db/pgtools
curl -sSL -o pg.zip "https://get.enterprisedb.com/postgresql/postgresql-17.6-1-windows-x64-binaries.zip"
unzip -q pg.zip "pgsql/bin/*"
```

Die Verbindung steht in `.env.local` (`SUPABASE_DB_URL`). Nie ausgeben, nie in Dateien schreiben:

```sh
URL=$(grep -E '^SUPABASE_DB_URL=' .env.local | cut -d= -f2- | tr -d '\r')
PG=/c/Users/Benjamin/fussball-app-db/pgtools/pgsql/bin
```

## A) Einzelne Tabellen aus `full.dump` zurück (empfohlen)

Nur die Daten der betroffenen Tabellen, ohne Schema. Reihenfolge wegen der Fremdschlüssel:
`players` → `player_status` → `events` → `fines` → `fine_status_log` → `rsvps` → `lineups` → `konto_protokoll`.

```sh
# 1. Inhalt ansehen (liest nur):
$PG/pg_restore -l supabase/cleanup/backup-2026-10-18/full.dump | grep "TABLE DATA public"

# 2. Die heutigen Zeilen der Zieltabellen müssen vorher weg (sonst Schlüsselkonflikte).
#    Achtung Trigger: Einfügen in fines legt "Neue Strafe"-Mitteilungen an, Einfügen in
#    rsvps kann Auto-Strafen auslösen. Deshalb mit abgeschalteten Triggern zurückspielen:
$PG/pg_restore -d "$URL" --data-only --disable-triggers --single-transaction \
  -t players -t player_status -t events -t fines -t fine_status_log -t rsvps -t lineups -t konto_protokoll \
  supabase/cleanup/backup-2026-10-18/full.dump
```

`--disable-triggers` braucht Superuser-Rechte. Scheitert das, Variante B nehmen.

Danach prüfen: `notification_outbox` und `notification_sammler` ohne neue unversandte Einträge.

## B) Einzelne Zeilen aus den JSON-Dateien zurück

Jede JSON-Datei ist ein Array der Zeilen genau so, wie sie in der Tabelle standen. Zurückspielen in
**einer** Transaktion mit `jsonb_populate_recordset`. Muster für eine Tabelle, als Datei ausführen mit
`node C:/Users/Benjamin/fussball-app-db/werkzeug/sql.mjs <datei.sql>`:

```sql
begin;
-- Inhalt von players.json einsetzen (bei großen Dateien per Skript erzeugen):
insert into public.players
select * from jsonb_populate_recordset(null::public.players, $json$ [ ...Inhalt von players.json... ] $json$::jsonb)
on conflict (id) do nothing;
commit;
```

Reihenfolge wie bei A. Für `fines` und `rsvps` vorher prüfen, was die Trigger anlegen
(`notify_fines_ereignis`, `rsvp_late_cancel_fine`), und Mitteilungen danach aus dem Postausgang
entfernen, bevor `push-dispatch` (jede Minute) sie versendet. Am sichersten: vorher den Cron-Job
`push-dispatch` kurz anhalten (`select cron.alter_job(<jobid>, active => false)`), danach wieder an.

Geänderte Zeilen, die nicht gelöscht wurden:
- `players` „Benjamin Lauck“ (`efec0956-…`) hieß vorher „Lukas Weber“: `update public.players set name = 'Lukas Weber' where id = 'efec0956-6ef2-4def-b06c-f37b1522b1a9';`
- `player_status` dieses Eintrags: alter Wert in `player_status.json`.
- Vorlage „4-3-3 Standard“: alte Belegung (`slots`, `bank`) in `lineups.json`.

## C) Ganze Datenbank zurück

Nur im Notfall, überschreibt auch alles, was nach dem 18.10. 10:53 entstanden ist (Konten,
Rückmeldungen, Strafen der echten Mannschaft):

```sh
$PG/pg_restore -d "$URL" --clean --if-exists --no-owner --single-transaction supabase/cleanup/backup-2026-10-18/full.dump
```

Supabase-eigene Schemas (`auth`, `storage`, `cron`) können dabei Rechte-Fehler werfen; dann nur
`-n public` zurückspielen.

Nach jedem Zurückspielen: `pgtools/` wieder löschen.
