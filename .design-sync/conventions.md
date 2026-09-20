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
| Fläche, Seite | `.card` `.card-pad` · `.page-head` `.page-head-row` `.pg-back` `.h1row` `.role-pill` · `.section-title` (klein: `.sec-mini`) · `.empty` |
| Textbausteine | `.lbl` (11px Großbuchstaben) · `.rs` (12px Nebentext) · `.num` (gleiche Ziffernbreite) |
| Kennzahlen | `.kpi-grid` (`.kpi-3`) `.kpi` `.kpi-label` `.kpi-value` `.kpi-sub` `.kpi-amt` `.kpi-tapbar` · `.is-warn` · Geldzeilen: `.geld-rows` `.geld` `.geld-main` `.geld-lbl` `.geld-wert` `.geld-chev` |
| Termine | `.event-list` (`.is-past`) · **Terminkarte** `.tk` (`.is-cancelled`): `.tk-kopf` `.tk-datum` `.d-wd` `.d-day` `.d-mon` · `.tk-kopf-main` `.tk-oben` `.tk-bdg` `.tk-zeit` `.tk-titel` `.tk-tags` · `.tk-menue` · `.tk-body` `.tk-feld` · `.tk-ort` `.tk-ort-ic` `.tk-ort-main` `.tk-ort-n` `.tk-ort-a` `.tk-route` · `.tk-rsvp` `.tk-btn` `.tk-abgesagt` `.tk-grund` · `.tk-frist` `.tk-warn` `.tk-bfv` `.tk-notiz` · `.tk-zusagen` `.tk-z-kopf` `.tk-z-lbl` `.tk-z-offen` `.tk-bar` `.tk-z-zahlen` · `.tk-kacheln` `.tk-kachel` `.tk-k-lbl` `.tk-k-wert` `.tk-chev` · Kalenderkopf: `.kal-seg` `.kal-seg-b` `.kal-neu` `.kal-abo` `.kal-abo-ic` `.kal-abo-main` `.kal-abo-t` `.kal-abo-s` `.kal-abo-chev` · Abo-Blatt: `.abo-karten` `.abo-karte` `.abo-k-t` `.abo-btn` `.abo-hinweis` `.cal-copied` `.cal-reset` · `.frist` `.frist-label` `.frist-warn` |
| Übersicht | Hero ist dieselbe `.tk` wie im Kalender · Danach-Liste: `.dn-liste` `.dn-zeile` `.dn-main` `.dn-t` `.dn-s` `.dn-zust` (`.is-zu` `.is-ab` `.is-offen`) · `.st-wahl[data-kompakt]` legt die Statuschips ins 2×2-Raster |
| Zu-/Absage | `.tk-rsvp` `.tk-btn` (Absage zusätzlich `.is-ab`, gewählt `.is-on`) · `.tk-grund`. Gewählt heißt Tint: heller Grund, Schrift und 1px-Rand in der dunklen Variante derselben Farbe. Das Dunkelgrün bleibt der Handlung vorbehalten. |
| Aufgaben | `.task-list` `.task-row` (`.is-pay` `.is-lineup` `.is-rsvp`) `.task-num` `.task-main` `.task-title` `.task-sub` `.task-go` |
| Aktionen | `.btn` + `.btn-primary` `.btn-soft` `.btn-danger` `.btn-ghost` · `.icon-btn` `.icon-ok` · `.link-btn` · `.chips` `.chip` (`.is-active`) |
| Status | `.st-badge` + `.st-amber` `.st-red` `.st-grau` · `.tag` + `.tag-friendly` `.tag-cancelled` `.tag-manuell` · `.badge` + `.badge-open` `.badge-paid` `.badge-cancel` `.badge-auto` `.badge-self` · `.cd` + `.cd-neutral` `.cd-amber` `.cd-red` `.cd-due` `.cd-capped` |
| Fitnessstatus | `.st-wahl` `.st-chips` `.st-choice` + `.st-fit` `.st-angeschlagen` `.st-verletzt` `.st-urlaub` · `.st-felder` `.st-feld` |
| Kader | `.kad-list` `.kad-row` (`.is-raus`) `.kad-kopf` `.kad-name` · `.laz-list` `.laz-row` `.laz-main` `.laz-name` `.laz-note` · `.avatar` |
| Trainer-Ansicht | `.tv-head` · `.tv-next` `.tv-next-kopf` `.tv-next-lbl` `.tv-next-bdg` `.tv-next-zeile` `.tv-next-datum` `.tv-next-main` `.tv-next-t` `.tv-next-m` `.tv-next-zahlen` `.tv-nz` `.tv-next-fuss` `.tv-next-btn` · `.tv-kader` `.tv-kader-kopf` `.tv-kader-t` `.tv-kader-n` `.tv-kbar` `.tv-kleg` `.tv-kstat` `.tv-garrow` · `.tv-glist` `.tv-grow` `.tv-gdate` `.tv-gmain` `.tv-gopp` `.tv-gmeta` `.tv-gchip` (`.is-offen`) · `.tv-tpls` `.tv-tpl` `.tv-tpl-main` `.tv-tpl-n` `.tv-tpl-chip` |
| Platzansicht | `.tv-lu` (`.tv-ro`) `.tv-top` `.tv-ic` `.tv-hi` `.tv-game` `.tv-sub` · `.tv-formbar` `.tv-fpill` `.tv-fmore` · `.tv-field` `.tv-pitch` `.tv-pitch-bg` `.tv-slot` (`.filled` `.sel`) `.tv-disc` `.tv-role` `.tv-pn` · `.tv-bank` `.tv-bank-h` `.tv-bank-row` `.tv-bslot` `.tv-bnr` `.tv-bn` `.tv-bx` `.tv-bplus` `.tv-bfrei` · `.tv-actions` `.tv-primary` `.tv-ghost` `.tv-cta` `.tv-ro-note` |
| Rückmeldungen-Blatt | `.rs2-panel` `.rs2-griff` `.rs2-kopf` `.rs2-kopf-text` `.rs2-titel` `.rs2-sub` `.rs2-zu` · `.rs2-bar` · `.rs2-kacheln` `.rs2-kachel` `.rs2-k-l` `.rs2-k-z` · `.rs2-liste` `.rs2-zeile` `.rs2-av` `.rs2-n` `.rs2-grund` `.rs2-leer` · `.rs2-fuss` `.rs2-btn` `.rs2-btn2` |
| Konto | `.mine-banner` (`.is-clear`) `.mb-label` `.mb-value` `.mb-sub` `.mb-bar` `.mb-note` `.mb-pay` `.mb-pp` `.mb-foot` `.mb-cd` `.pp-word` · `.fine-list` `.fine-row` `.fine-main` `.fine-name` `.fine-desc` `.fine-reason` `.fine-right` `.fine-amt` |
| Kasse | `.kpi-tapbar` `.kasse-toggle` `.kasse-add` `.kasse-lbl` `.kasse-count` `.kasse-players` `.kasse-chip` `.kasse-in` `.kasse-two` `.kasse-sum` `.kasse-sum-row` `.kasse-sum-total` `.kasse-save` · `.ks-tabs` `.ks-bulk` `.ks-deck` `.ks-ghost` `.ks-card` `.ks-av` `.ks-name` `.ks-amt` `.ks-actions` `.ks-dots` `.ks-cap` `.ks-leer` `.ks-leer-t` · `.ks-ichips` `.ks-ichip` · `.krow-list` `.krow` `.krow-head` `.krow-info` `.krow-title` `.krow-strafe` `.krow-right` `.krow-amt` `.krow-actions` `.krow-tun` `.krow-buchen` · `.zart-row` `.zart` |
| Katalog | `.kat-list` `.kat-item` `.kat-name` `.kat-sub` `.kat-amount` (`.is-staffel`) `.kat-actions` `.kat-add` · Bearbeiten: `.kat-edit` `.kat-in` `.kat-fixed` `.kat-eur` `.kat-staffel` `.kat-edit-actions` |
| Formulare | `.termin-form` `.tf-row` `.tf-2col` `.tf-wdh` `.tf-radio` `.tf-bis` `.tf-summary` |
| Tabelle | `.table-wrap` + `.rollen-tbl` `.player-cell` `.rollen-av` `.rollen-name` `.rollen-mail` |
| Anmeldung | `.auth-wrap` `.auth-card` `.auth-crest` `.auth-title` `.auth-sub` `.auth-field` `.auth-submit` `.auth-switch` `.auth-forgot` `.auth-error` `.auth-info` |
| Blätter, Dialoge | `.more-sheet` `.more-backdrop` `.more-panel` `.more-title` `.more-item` · `.modal-ov` `.modal` (`.modal-sm`) `.modal-head` `.modal-x` `.modal-sub` `.modal-text` `.modal-actions` (`.modal-actions-col`) `.modal-hint` · `.ptr-ind` `.ptr-coin` `.ptr-ring` `.ptr-disc` `.ptr-logo` `.ptr-shadow` |
| Einstellungen, Profil | `.set-section` `.set-profile` `.set-row` `.set-label` `.set-val` `.set-verwaltung` `.set-sub` `.set-hint` `.set-greet-name` `.set-greet-role` · `.pr-head` `.pr-av` `.pr-name` `.pr-list` `.pr-row` `.pr-bar` `.pr-main` `.pr-t` · `.sim-bar` `.sim-exit` `.sim-switch-hint` |

Zustände hängen sich als zweite Klasse an: `.tk-btn.is-ab.is-on`, `.kpi.is-warn`,
`.tk.is-cancelled`. Geschlossene Blätter tragen `hidden`, nicht `display:none`.

## Farben nur über Tokens

Nie ein Hex ins Markup. Alles liegt in `tokens/tokens.css` (138 Tokens):

- Vereinsgrün `--green-990` bis `--green-050` — Kopfzeile, Primäraktion, Erfolg.
  `--green-700` trägt jede Primäraktion, `--green-800` Zahlen und Verweise.
- Gold `--gold-700` bis `--gold-050` plus `--gold-ink` — Akzent, Spiele, Datumswürfel.
  Schrift auf Goldflächen immer `--gold-ink` oder `--gold-ink-2`, nie Weiß.
- Signal: `--red-600` `--red-050` (offen, abgesagt, verletzt) · `--amber-600`
  `--amber-050` (wartet auf Bestätigung, gewählter Filter), dazu `--amber-700`
  überall dort, wo der Ton als Text auf hellem Grund steht und 4,5:1 halten muss ·
  `--dot-off` (Urlaub — kein eigenes Bunt, sondern dasselbe Grau wie im Balken
  der Kaderkachel).
- Neutral `--ink` `--muted` `--line` `--bg` `--card`. `--muted` erreicht auf Weiß
  4,7:1 und ist die dunkelste erlaubte Nebenfarbe.
- Verläufe `--grad-card` `--grad-btn` `--grad-chip` `--grad-edge-green`
  `--grad-edge-gold` `--grad-edge-red` und weitere. Die gefüllten Statuschips
  tragen eigene, dunklere Verläufe — `--grad-chip-on` `--grad-chip-gold`
  `--grad-chip-red` `--grad-urlaub` —, weil weiße Schrift auf den hellen
  Kantenverläufen keine 4,5:1 erreicht. Das Kopfband der Terminkarte trägt
  `--grad-tk-kopf`, der ⋯-Kreis darauf `--tk-menue`.
- Die Plakette HEIM/AUSWÄRTS auf dem Kopfband trägt `--bdg-venue-bg`
  `--bdg-venue-line` `--bdg-venue-fg` — Gold als Tint, nicht als Vollton, damit
  sie hinter Datum, Gegner und Uhrzeit zurücktritt (Schrift 5,60:1). Die drei
  Werte sind aus der Vorlage gelesen und nicht als `color-mix` bestehender
  Tokens ausdrückbar, weil das Kopfband ein Verlauf ist.
- Form: `--radius` (14), `--radius-md` (12), `--radius-btn` (10),
  `--radius-sheet` (18), `--radius-pill`, `--radius-box` (6), `--shadow`,
  `--shadow-card`, `--shadow-sm`.
- Maße: `--tap` (44), `--h-btn` (46), `--h-btn-lg` (48), `--h-btn-xl` (52),
  `--h-in` (46), `--h-row` (52), `--h-nav` (52), `--h-bslot` (54),
  `--fs-input` (16).
- Balkenspuren: `--track` (Konto), `--track-bar` (Karte), `--track-sheet` (Blatt) —
  drei gemessene Töne, kein Versehen.

## Drei harte Regeln

1. **Alles Antippbare mindestens 44px hoch.** Ist ein Element sichtbar kleiner —
   Zahnrad, Chip, Schließen-Kreuz, Textverweis in einer Zeile — liegt die
   Trefferfläche als unsichtbares `::after` mit `--tap` darüber. Das Sichtbare
   wird nicht aufgeblasen; solche Elemente bekommen deshalb auch kein
   `overflow: hidden`, das die Fläche abschneiden würde.
2. **Eingabefelder auf 16px Schriftgröße.** Darunter zoomt iOS beim Fokus hinein.
3. **Waagerecht wird nie gescrollt.** Listen stapeln (`.kat-list` statt Tabelle),
   Filterreihen passen in eine Zeile — notfalls kürzt man die Beschriftung, nicht
   den Abstand. Die eine verbliebene Tabelle steht in `.table-wrap`.

## Maße kommen aus Messungen

Die Vorlagen liegen als Bilder vor. Farben und Abstände werden daraus **gemessen**,
nicht geschätzt: Bild und App auf denselben Maßstab rechnen, Bänder und Kanten
vergleichen, Werte übernehmen. Die Messauflösung liegt bei rund 1 CSS-px;
Abweichungen darunter sind nicht belegbar und werden nicht nachgezogen.
Wo bewusst von der Vorlage abgewichen wird, steht der Grund in `NOTES.md`.

## Wo die Wahrheit steht

`styles.css` und die drei Dateien, die es zieht — `tokens/tokens.css` (Tokens),
`fonts/inter.css` (Schrift), `_ds_app.css` (alle Regeln, nach Bereichen kommentiert).
Vor größeren Entwürfen dort nachsehen; die Karten unter `components/` zeigen jedes
Muster fertig aufgebaut — `Grundlagen` die Sprache, `App-Rahmen` das Gerüst,
`Bausteine` die einzelnen Teile, `Ansichten` ganze Seiten bei 390px Breite.
