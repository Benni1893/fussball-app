---
name: mobile-ui
description: iPhone-/Mobile-Regeln der FC-Fasanerie-Nord-App. Greift bei jeder Änderung an styles.css, index.html (Viewport, Layout) oder an fixierten/scrollbaren Elementen, Formularen, Buttons, Bottom-Nav. Enthält eine Diagnose-Checkliste für weißer Balken unten, Zoom beim Fokus, horizontaler Overflow, Inhalt hinter der Nav.
---

# Mobile-UI (iPhone-first)

Ziel-Gerät: iPhone, Safari. Getestet wird per QR/URL auf dem echten Handy.

## Feste Regeln
- **Eingabefelder mind. `font-size: 16px`** — kleiner ⇒ Safari zoomt beim Fokus rein. Gilt für `input/select/textarea` (bestehend: `.bfv-url`, `#s-*`-Felder).
- **Touch-Flächen mind. 44px** (`min-height: 44px`) an Buttons, Links, Tab-Elementen (bestehend: `.btn`, `.venue-link`, `.bfv-actions .btn`).
- **`env(safe-area-inset-*)` an ALLEN fixierten Elementen**:
  - Header: `padding-top: calc(env(safe-area-inset-top) + …)`
  - Bottom-Nav / Toast / More-Sheet: `…-bottom`
- **Hintergrund auf `html` UND `body`**, nicht nur auf inneren Containern:
  - `html { background: var(--green-900) }` — füllt Overscroll-/Safe-Area, nie weiß
  - `body { background: var(--bg) }` — heller Inhalt
- **`overflow-x: hidden`** am `body` — kein horizontales Scrollen.
- **`overscroll-behavior: none`** am `body` — kein Gummiband/Bounce.
- **Höhe: `100dvh` statt `100vh`** — `html`/`body` nutzen `min-height: 100dvh` (mit `100vh`-Fallback). `vh`/`%` werden auf iOS beim ersten Paint falsch berechnet (Adressleiste noch nicht eingerechnet) → heller Streifen unten „beim ersten Öffnen". `dvh` fixt das. Nie auf `100%`/`100vh` als Höhenbasis zurückfallen.
- Weiter vorhanden und beizubehalten: `-webkit-text-size-adjust: 100%`, `touch-action: manipulation`, `-webkit-tap-highlight-color: transparent`, Viewport `viewport-fit=cover`.

## Layout-Prinzip dieser App
- Header und Bottom-Nav sind **`position: fixed`** (nicht `sticky`).
  Grund: `position: sticky` bricht, sobald der `body` `overflow-x: hidden` hat.
- `body` bekommt oben/unten **Padding in Höhe von Header bzw. Nav** (Header-Höhe wird per JS in `--header-h` gemessen), damit Inhalt frei steht.

## Diagnose-Checkliste (Reihenfolge einhalten)

### Weißer Balken am unteren Rand
1. `html`-Hintergrund gesetzt? Wenn `body` heller ist als `html`/darunter, blitzt es durch → `html` einfärben.
2. Kurze Views: `body min-height:100%` + heller `body`-Hintergrund füllt bis unter die feste Nav → auf kurzen Seiten sieht man den hellen Streifen über der weißen Nav. Fix **einheitlich für alle Tabs**, nicht per Sonder-CSS für einen Tab.
3. Nav deckt die Safe-Area unten ab? `.app-nav { padding-bottom: env(safe-area-inset-bottom) }` in Nav-Farbe.
4. Nav-Farbe == Farbe darunter? Sonst sichtbare Kante.

### Zoom beim Fokussieren eines Feldes
1. Feld `< 16px`? → auf 16px. (Häufigste Ursache.)
2. Fehlt `viewport-fit=cover`/Viewport-Meta?

### Horizontaler Overflow
1. `body overflow-x: hidden` vorhanden?
2. Element breiter als Viewport (feste `width`, `100vw`, negative Margins, lange Tabellen)? Tabellen in `.table-wrap { overflow-x: auto }`.
2. `max-width: 100%` an Bildern/Boxen.

### Inhalt verschwindet hinter der Bottom-Nav
1. `body padding-bottom` ≥ Nav-Höhe **+** `env(safe-area-inset-bottom)`?
2. Sonderzustände bedacht? (z. B. `body.simulating` erhöht das Padding um die Simulations-Leiste.)
