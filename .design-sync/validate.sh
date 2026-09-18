#!/usr/bin/env bash
# Prueft, dass jede in den Vorschaukarten verwendete Klasse im Design-System
# wirklich existiert. Erfundene Klassen wuerden sonst still ungestylt landen.
# Aufruf aus dem Repo-Wurzelverzeichnis:  bash .design-sync/validate.sh
set -uo pipefail

OUT="ds-bundle"
CSS="$OUT/_ds_app.css"
SCAFFOLD="sp sp-h meta bar row duo sw sw-grid frame f-nav f-sheet"   # nur Kartengeruest
# Echte App-Klassen ohne eigene CSS-Regel. Stehen so in index.html bzw. app.js; sie erben
# ihre Darstellung vom Elternelement. Bewusst in den Karten behalten, damit das
# Markup dem der App entspricht - siehe NOTES.md.
BEKANNT_UNGESTYLT="sim-text mb-top mb-state ks-pane kat-in-name kat-type"

[ -f "$CSS" ] || { echo "FEHLER: $CSS fehlt - erst 'bash .design-sync/build.sh' laufen lassen." >&2; exit 1; }

# Alle im Stylesheet definierten Klassen einsammeln.
grep -oE '\.[A-Za-z][A-Za-z0-9_-]*' "$CSS" | sed 's/^\.//' | sort -u > /tmp/ds-defined.txt

fehlt=0
for card in $(find "$OUT/components" -name '*.html' | sort); do
  # class="..."-Werte einsammeln, Geruest-Klassen abziehen.
  used=$(grep -oE 'class="[^"]+"' "$card" | sed 's/class="//;s/"//' | tr ' ' '\n' | sort -u | grep -v '^$')
  for c in $used; do
    case " $SCAFFOLD " in *" $c "*) continue;; esac
    case " $BEKANNT_UNGESTYLT " in *" $c "*) continue;; esac
    if ! grep -qx "$c" /tmp/ds-defined.txt; then
      echo "FEHLT: .$c  (verwendet in ${card#$OUT/components/})"
      fehlt=$((fehlt+1))
    fi
  done
done

# Tokens: jede var(--x) in den Karten muss in tokens.css definiert sein.
grep -oE 'var\(--[a-z0-9-]+\)' $(find "$OUT/components" -name '*.html') 2>/dev/null \
  | sed -E 's/.*var\(--([a-z0-9-]+)\).*/\1/' | sort -u > /tmp/ds-used-tokens.txt
while read -r t; do
  [ -z "$t" ] && continue
  grep -q -- "--$t:" "$OUT/tokens/tokens.css" || { echo "FEHLT: Token --$t"; fehlt=$((fehlt+1)); }
done < /tmp/ds-used-tokens.txt

if [ "$fehlt" -gt 0 ]; then
  echo "--- $fehlt unbekannte Namen. Karte korrigieren oder Namen streichen. ---" >&2
  exit 1
fi
echo "OK: alle Klassen und Tokens der $(find "$OUT/components" -name '*.html' | wc -l) Karten sind im Design-System definiert."

# --- @import-Huelle und Karten-Pfade ----------------------------------------
# Entwuerfe bekommen NUR das, was von styles.css aus per @import erreichbar
# ist. Bricht ein Glied der Kette, bleibt alles ungestylt - ohne Fehlermeldung.
pfad_fehlt=0
for imp in $(grep -oE "@import url\('\./[^']+'\)" "$OUT/styles.css" | sed -E "s|@import url\('\./([^']+)'\)|\1|"); do
  if [ -f "$OUT/$imp" ]; then
    echo "  Kette OK: styles.css -> $imp"
  else
    echo "FEHLT in der @import-Kette: $imp"; pfad_fehlt=$((pfad_fehlt+1))
  fi
done
# Die Karten liegen drei Ebenen tief; ihre relativen Verweise muessen von dort greifen.
for card in $(find "$OUT/components" -name '*.html' | sort); do
  dir=$(dirname "$card")
  for ref in $(grep -oE '(href|src)="\.\./\.\./\.\./[^"]+"' "$card" | sed -E 's/.*"(.*)"/\1/' | sort -u); do
    [ -f "$dir/$ref" ] || { echo "TOTER VERWEIS: $ref in ${card#$OUT/components/}"; pfad_fehlt=$((pfad_fehlt+1)); }
  done
done
[ "$pfad_fehlt" -gt 0 ] && { echo "--- $pfad_fehlt kaputte Pfade. ---" >&2; exit 1; }
echo "OK: @import-Kette und alle Karten-Verweise loesen auf."
