#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# design-sync Bundle-Bau fuer die FC-Fasanerie-Nord-App.
#
# Diese App ist KEIN Komponenten-Repo (kein package.json, kein Build, kein
# React), deshalb ist der mitgelieferte design-sync-Konverter nicht anwendbar.
# Dieses Skript erzeugt das Upload-Layout stattdessen deterministisch aus den
# echten Quellen: styles.css (Design-Sprache) und index.html (App-Rahmen).
#
# Aufruf aus dem Repo-Wurzelverzeichnis:  bash .design-sync/build.sh
# ---------------------------------------------------------------------------
set -euo pipefail

SRC_CSS="styles.css"
OUT="ds-bundle"
CARDS=".design-sync/cards"
TOKEN_FIRST=5      # Zeile ":root {"
TOKEN_LAST=167   # zugehoerige "}"

[ -f "$SRC_CSS" ] || { echo "FEHLER: $SRC_CSS nicht gefunden - bitte aus dem Repo-Wurzelverzeichnis starten." >&2; exit 1; }

# Sicherheitsnetz: verschiebt sich der :root-Block, bricht der Bau ab statt
# stillschweigend die falschen Zeilen zu schneiden.
sed -n "${TOKEN_FIRST}p" "$SRC_CSS" | grep -q ':root' \
  || { echo "FEHLER: Zeile $TOKEN_FIRST ist nicht ':root {' - tokenBlockLines in config.json pruefen." >&2; exit 1; }
sed -n "${TOKEN_LAST}p" "$SRC_CSS" | grep -q '^}' \
  || { echo "FEHLER: Zeile $TOKEN_LAST ist nicht die schliessende Klammer - tokenBlockLines in config.json pruefen." >&2; exit 1; }

rm -rf "$OUT"
mkdir -p "$OUT/tokens" "$OUT/fonts" "$OUT/components"

# --- 1. Tokens: der :root-Block, woertlich aus der App -----------------------
{
  echo "/* FC Fasanerie-Nord - Design-Tokens."
  echo "   Woertlich aus styles.css (Zeilen ${TOKEN_FIRST}-${TOKEN_LAST}) uebernommen."
  echo "   Einzige Definitionsstelle: _ds_app.css enthaelt diesen Block NICHT mehr. */"
  sed -n "${TOKEN_FIRST},${TOKEN_LAST}p" "$SRC_CSS"
} > "$OUT/tokens/tokens.css"

# --- 2. Maschinenlesbare Tokenliste -----------------------------------------
sed -n "${TOKEN_FIRST},${TOKEN_LAST}p" "$SRC_CSS" \
| sed 's|/\*.*\*/||' \
| grep -oE '^\s*--[a-z0-9-]+:[^;]+;' \
| sed -E 's|^\s*--([a-z0-9-]+):\s*(.*);\s*$|  "\1": "\2",|' \
| sed -E 's/[[:space:]]+"$/"/' \
| awk 'BEGIN{print "{"} {lines[NR]=$0} END{for(i=1;i<=NR;i++){ if(i==NR) sub(/,$/,"",lines[i]); print lines[i]} print "}"}' \
> "$OUT/tokens/tokens.json"

# --- 3. App-Stylesheet ohne den Tokenblock ----------------------------------
sed "${TOKEN_FIRST},${TOKEN_LAST}d" "$SRC_CSS" > "$OUT/_ds_app.css"

# --- 4. Schrift --------------------------------------------------------------
cat > "$OUT/fonts/inter.css" <<'CSS'
/* Inter - genau die Schnitte, die die App in index.html laedt (400-800).
   Faellt das CDN aus, greift der Fallback-Stack aus der body-Regel:
   system-ui, -apple-system, Segoe UI, Roboto, sans-serif. */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
CSS

# --- 5. Einstiegs-Stylesheet -------------------------------------------------
# Entwuerfe bekommen NUR die @import-Huelle dieser Datei - alles Sichtbare
# muss also von hier aus erreichbar sein.
cat > "$OUT/styles.css" <<'CSS'
/* ===========================================================================
   FC Fasanerie-Nord - Mannschafts-App - Design-System (Einstieg)
   Reihenfolge ist bindend: Schrift, dann Tokens, dann die Regeln, die sie nutzen.
   =========================================================================== */
@import url('./fonts/inter.css');
@import url('./tokens/tokens.css');
@import url('./_ds_app.css');
CSS

# --- 6. Bundle-Platzhalter ---------------------------------------------------
cat > "$OUT/_ds_bundle.js" <<'JS'
/* FC Fasanerie-Nord - Mannschafts-App.
 *
 * Dieses Design-System ist bewusst CSS-only: die App baut ihr Markup
 * imperativ in app.js (innerHTML) auf und besitzt keine JS-Komponenten-
 * bibliothek. Es gibt hier also nichts zu exportieren - gebaut wird mit
 * echtem HTML und den Klassen aus styles.css (siehe README.md).
 */
window.FCFN = window.FCFN || {};
JS

# --- 7. Vorschau-Karten ------------------------------------------------------
# Handgeschrieben unter .design-sync/cards/<Gruppe>/<Name>.html, hier nur
# an die vom Design-System erwartete Stelle gelegt.
find "$CARDS" -name '*.html' | sort | while read -r card; do
  rel="${card#$CARDS/}"          # <Gruppe>/<Name>.html
  group="${rel%%/*}"
  name="$(basename "$rel" .html)"
  mkdir -p "$OUT/components/$group/$name"
  cp "$card" "$OUT/components/$group/$name/$name.html"
done

# --- 7b. Markenzeichen ------------------------------------------------------
# Das echte Vereinswappen, damit Kopfzeile und Anmeldung in den Karten
# (und in daraus gebauten Entwuerfen) nicht mit Platzhaltern arbeiten.
mkdir -p "$OUT/assets"
cp assets/logo.png     "$OUT/assets/logo.png"
cp assets/icon-192.png "$OUT/assets/icon-192.png"

# --- 9. README --------------------------------------------------------------
# conventions.md (handgeschrieben, gehoert den Autoren) + generiertes Verzeichnis.
{
  if [ -f .design-sync/conventions.md ]; then
    cat .design-sync/conventions.md
    echo
  fi
  echo "## Inhalt dieses Bundles"
  echo
  echo "| Datei | Was drin steht |"
  echo "|---|---|"
  echo "| \`styles.css\` | Einstieg. Zieht Schrift, Tokens und Regeln — mehr wird nicht gebraucht. |"
  echo "| \`tokens/tokens.css\` | Die $(grep -cE '^\s*--[a-z0-9-]+:' "$OUT/tokens/tokens.css") Design-Tokens, woertlich aus der App. |"
  echo "| \`tokens/tokens.json\` | Dieselben Tokens maschinenlesbar. |"
  echo "| \`fonts/inter.css\` | Inter 400–800. Faellt das CDN aus, greift der System-Stack. |"
  echo "| \`_ds_app.css\` | Alle Regeln der App, nach Bereichen kommentiert. |"
  echo "| \`_ds_bundle.js\` | Leer — dieses System hat bewusst keine JS-Komponenten. |"
  echo "| \`assets/\` | Vereinswappen. |"
  echo
  echo "## Vorschaukarten"
  echo
  cur=""
  for card in $(find "$OUT/components" -name '*.html' | sort); do
    rel="${card#$OUT/components/}"; group="${rel%%/*}"; name="$(basename "$rel" .html)"
    if [ "$group" != "$cur" ]; then echo; echo "**$group**"; echo; cur="$group"; fi
    title=$(grep -m1 -oE '<title>[^<]+</title>' "$card" | sed 's|</\?title>||g')
    echo "- \`components/$group/$name/$name.html\` — $title"
  done
  echo
  echo "---"
  echo
  echo "Erzeugt von \`.design-sync/build.sh\` aus \`styles.css\` und \`index.html\` des App-Repos."
  echo "Geprueft von \`.design-sync/validate.sh\` und \`.design-sync/check-conventions.sh\`."
} > "$OUT/README.md"

# --- 8. Sentinel -------------------------------------------------------------
printf '%s' '{"by":"design-sync-fcfn"}' > "$OUT/_ds_needs_recompile"

# --- 10. Sync-Anker ----------------------------------------------------------
# Haelt fest, aus welchen Quellen dieses Bundle stammt. Ein spaeterer Lauf
# vergleicht die Hashes und sieht sofort, was sich ueberhaupt geaendert hat.
# Wird beim Upload ZULETZT geschrieben - er darf nur fuer einen vollstaendig
# angekommenen Stand buergen.
{
  echo '{'
  echo '  "shape": "fcfn-css-only",'
  echo '  "builtBy": ".design-sync/build.sh",'
  echo "  \"styleSha\": \"$(sha256sum "$SRC_CSS" | cut -c1-16)\","
  echo "  \"shellSha\": \"$(sha256sum index.html | cut -c1-16)\","
  echo "  \"conventionsSha\": \"$(test -f .design-sync/conventions.md && sha256sum .design-sync/conventions.md | cut -c1-16 || echo none)\","
  echo '  "cardShas": {'
  last=$(find "$CARDS" -name '*.html' | sort | tail -1)
  find "$CARDS" -name '*.html' | sort | while read -r card; do
    rel="${card#$CARDS/}"; sep=","; [ "$card" = "$last" ] && sep=""
    echo "    \"${rel%.html}\": \"$(sha256sum "$card" | cut -c1-16)\"$sep"
  done
  echo '  }'
  echo '}'
} > "$OUT/_ds_sync.json"

echo "Bau fertig:"
echo "  Tokens:  $(grep -c -- '--' "$OUT/tokens/tokens.css") Zeilen mit Token-Definitionen"
echo "  Karten:  $(find "$OUT/components" -name '*.html' | wc -l)"
