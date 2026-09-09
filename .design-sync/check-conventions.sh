#!/usr/bin/env bash
# Prueft jeden Klassen- und Token-Namen aus .design-sync/conventions.md gegen
# das gebaute Bundle. Der Text landet im Systemprompt des Design-Agenten -
# ein Name, den es nicht gibt, produziert dort stillschweigend ungestyltes UI.
set -uo pipefail
OUT="ds-bundle"; DOC=".design-sync/conventions.md"
grep -oE '\.[A-Za-z][A-Za-z0-9_-]*' "$OUT/_ds_app.css" | sed 's/^\.//' | sort -u > /tmp/c-def.txt

fehlt=0
# Klassennamen stehen im Dokument als `.name` in Backticks oder im HTML-Beispiel.
for c in $(grep -oE '`\.[a-z][a-z0-9-]*`' "$DOC" | tr -d '`.' | sort -u); do
  grep -qx "$c" /tmp/c-def.txt || { echo "FEHLT (Klasse): .$c"; fehlt=$((fehlt+1)); }
done
for c in $(grep -oE 'class="[^"]+"' "$DOC" | sed 's/class="//;s/"//' | tr ' ' '\n' | sort -u | grep -v '^$'); do
  grep -qx "$c" /tmp/c-def.txt || { echo "FEHLT (Beispiel-Markup): .$c"; fehlt=$((fehlt+1)); }
done
for t in $(grep -oE '\-\-[a-z][a-z0-9-]*' "$DOC" | sed 's/^--//' | sort -u); do
  grep -q -- "--$t:" "$OUT/tokens/tokens.css" || grep -q -- "--$t" "$OUT/_ds_app.css" \
    || { echo "FEHLT (Token): --$t"; fehlt=$((fehlt+1)); }
done
# Im Text genannte Dateien muessen im Bundle liegen.
for f in styles.css tokens/tokens.css fonts/inter.css _ds_app.css _ds_bundle.js; do
  [ -f "$OUT/$f" ] || { echo "FEHLT (Datei): $f"; fehlt=$((fehlt+1)); }
done
# Behauptete Tokenanzahl gegenpruefen.
n=$(grep -cE '^\s*--[a-z0-9-]+:' "$OUT/tokens/tokens.css")
grep -q "($n Tokens)" "$DOC" || { echo "FALSCH: conventions.md nennt nicht die echten $n Tokens"; fehlt=$((fehlt+1)); }

[ "$fehlt" -gt 0 ] && { echo "--- $fehlt Namen ohne Deckung. Korrigieren oder streichen. ---" >&2; exit 1; }
echo "OK: alle in conventions.md genannten Klassen, Tokens und Dateien existieren im Bundle."
