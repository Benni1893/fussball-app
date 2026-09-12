# FC Fasanerie-Nord – Mannschafts-App

Design-System einer Vereins-App für eine Amateur-Fußballmannschaft: Termine, Zu- und
Absagen, Aufstellung, Strafenkasse. **Oberflächensprache ist durchgehend Deutsch.**
Gebaut wird für das iPhone, benutzt wird am Spielfeldrand — im Stehen, mit einer Hand.

## Es gibt keine JS-Komponenten

Dieses System ist **CSS-only**. `_ds_bundle.js` exportiert absichtlich nichts:
Die App baut ihr Markup imperativ in `app.js` auf und besitzt keine
Komponentenbibliothek. Gebaut wird mit **echtem HTML plus den Klassen unten** —
kein Import, kein Provider, kein Wrapper.

Einziges Setup: `styles.css` einbinden. Von dort hängen Schrift (Inter), Tokens und
alle Regeln. Nichts anderes wird gebraucht.

```html
<link rel="stylesheet" href="styles.css">
```

## Der App-Rahmen

Kopfzeile und Navigation sind `position: fixed`; `body` hält mit Innenabstand den
Platz frei. Wer eine ganze Ansicht baut, übernimmt dieses Gerüst unverändert:

```html
<header class="app-header">
  <span class="hdr-logo"><img class="crest-logo" src="assets/logo.png" alt=""></span>
  <span class="hdr-title">FC Fasanerie-Nord</span>
  <button class="hdr-gear" aria-label="Einstellungen öffnen"><svg …></svg></button>
</header>

<div class="scroll-area">
  <main class="view">
    <div class="page-head"><h1>Übersicht</h1><p>Kurzer Begleitsatz.</p></div>
    <!-- Inhalt -->
  </main>
  <footer class="app-footer"><button class="link-btn">Neu laden</button></footer>
</div>

<nav class="app-nav">
  <button class="nav-btn is-active"><svg class="nav-ic" …></svg><span class="nav-label">Übersicht</span></button>
  …
</nav>
```

`.view` zentriert bei max. 1080px. Die Höhe der Kopfzeile trägt die App zur Laufzeit
in `--header-h` ein; ohne JS greift der Fallback in der `body`-Regel.
`body.auth-mode` blendet Navigation und Fußzeile aus (abgemeldet).

## Die Klassensprache

Semantische Klassen, **keine Utilities**. Es gibt kein `p-4`, kein `text-sm`, kein
`flex` — solche Namen erfinden heißt: unsichtbar ungestylt ausliefern. Eigenes
Layout-Beiwerk kommt als `style="…"` mit Tokens oder als neue, sprechende Klasse.

| Zweck | Klassen |
|---|---|
| Fläche, Seite | `.card` `.card-pad` · `.page-head` `.page-head-row` `.pg-back` · `.section-title` · `.grid-2` · `.empty` `.em-ico` |
| Kennzahlen | `.kpi-grid` `.kpi` `.kpi-label` `.kpi-value` `.kpi-sub` · antippbar: `.kpi-tap` `.kpi-body` `.kpi-go` `.kpi-amt` · `.is-warn` |
| Termine | `.event-list` `.event` · Art: `.typ-spiel` `.typ-training` `.typ-sonstiges` · `.is-home` `.is-away` `.is-cancelled` · `.event-date` `.d-day` `.d-mon` `.d-wd` · `.event-main` `.e-title` `.e-time` `.e-meta` `.e-note` · `.team-own` `.team-opp` `.vs` · `.venue-link` `.venue-pin` · `.frist` `.frist-label` `.frist-warn` |
| Zu-/Absage | `.rsvp` `.rsvp-buttons` `.rsvp-count` `.rsvp-reason` `.rsvp-cancelled` |
| Aktionen | `.btn` + `.btn-primary` `.btn-soft` `.btn-danger` `.btn-ghost` `.btn-sm` `.btn-zu` `.btn-ab` (Zustand `.is-on`) · `.icon-btn` `.icon-ok` · `.link-btn` · `.toolbar` `.chip` (`.is-active`) |
| Status | `.tag` + `.tag-spiel` `.tag-training` `.tag-heim` `.tag-ausw` `.tag-friendly` `.tag-cancelled` `.tag-manuell` · `.badge` + `.badge-open` `.badge-paid` `.badge-cancel` `.badge-auto` `.badge-self` · `.cd` + `.cd-neutral` `.cd-amber` `.cd-red` `.cd-due` `.cd-capped` |
| Listen, Zahlen | `.table-wrap` + `<table>` · `.num` `.amount` `.amt-sub` · `.kat-list` `.kat-item` `.kat-name` `.kat-amount` `.kat-actions` |
| Formulare | `.termin-form` `.tf-row` `.tf-2col` `.tf-wdh` `.tf-radio` `.tf-bis` `.tf-summary` |
| Anmeldung | `.auth-wrap` `.auth-card` `.auth-crest` `.auth-title` `.auth-sub` `.auth-field` `.auth-submit` `.auth-switch` `.auth-forgot` `.auth-error` `.auth-info` |
| Sheets, Rollen | `.more-sheet` `.more-backdrop` `.more-panel` `.more-title` `.more-item` · `.sim-bar` `.sim-exit` |

Zustände hängen sich als zweite Klasse an: `.btn.btn-zu.is-on`, `.kpi.is-warn`,
`.event.typ-spiel.is-home`. Geschlossene Sheets tragen `hidden`, nicht `display:none`.

## Farben nur über Tokens

Nie ein Hex ins Markup. Alles liegt in `tokens/tokens.css` (127 Tokens):

- Vereinsgrün `--green-900 … --green-050` — Kopfzeile, Primäraktion, Erfolg
- Gold `--gold-600 --gold-500 --gold-050` — Akzent, Spiele, KPI-Kante
- Signal `--red-600 --red-050` (offen, abgesagt), `--amber-600 --amber-050` (Warnung)
- Neutral `--ink --muted --line --bg --card`
- Form `--radius` (14px), `--shadow`, `--shadow-sm`
- Fachlich `--spiel-heim --spiel-ausw --typ-training --typ-sonstiges --fs-event-time`

## Zwei harte Regeln

1. **Alles Antippbare mindestens 44px hoch.** Gilt auch für Textlinks in Zeilen.
2. **Eingabefelder auf 16px Schriftgröße.** Darunter zoomt iOS beim Fokus hinein.

Waagerecht wird nie gescrollt: Listen stapeln (`.kat-list` statt Tabelle), breite
Tabellen kommen in `.table-wrap`.

## Wo die Wahrheit steht

`styles.css` und die drei Dateien, die es zieht — `tokens/tokens.css` (Tokens),
`fonts/inter.css` (Schrift), `_ds_app.css` (alle Regeln, nach Bereichen kommentiert).
Vor größeren Entwürfen dort nachsehen; die Karten unter `components/` zeigen jedes
Muster fertig aufgebaut.
