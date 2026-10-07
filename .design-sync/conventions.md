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
| Fläche, Seite | `.card` `.card-pad` · `.page-head` `.pg-back` `.h1row` `.role-pill` · `.section-title` (klein: `.sec-mini`) · `.empty` |
| Textbausteine | `.lbl` (11px Großbuchstaben) · `.rs` (12px Nebentext) · `.num` (gleiche Ziffernbreite) |
| Kennzahlen | `.kpi-grid` (`.kpi-3`) `.kpi` `.kpi-label` `.kpi-value` `.kpi-sub` `.kpi-amt` · `.is-warn` · Geldzeilen: `.geld-rows` `.geld` `.geld-main` `.geld-lbl` `.geld-wert` `.geld-chev` |
| Termine | `.event-list` (`.is-past`) · **Terminkarte** `.tk` (`.is-cancelled`): `.tk-kopf` · `.tk-kopf-main` `.tk-oben` `.tk-zeit` `.tk-titel` · `.tk-menue` · `.tk-body` · `.tk-ort` `.tk-ort-ic` `.tk-ort-n` `.tk-route` · `.tk-rsvp` `.tk-btn` `.tk-abgesagt` `.tk-grund` · `.tk-warn` `.tk-bfv` `.tk-notiz` · `.tk-bar` · `.tk-chev` · Kalenderkopf: `.kal-seg` `.kal-seg-b` `.kal-neu` `.kal-abo-wrap` (`.is-weg`) `.kal-abo` (`.hat-x`) `.kal-abo-ic` `.kal-abo-main` `.kal-abo-t` `.kal-abo-chev` `.kal-abo-x` · Abo-Blatt: `.abo-karten` `.abo-karte` `.abo-k-t` `.abo-hinweis` `.abo-schritte` `.abo-btn` `.abo-fuss` `.cal-copied` `.cal-reset` · Benachrichtigungen: derselbe `.set-section`-Aufbau wie die übrigen Einstellungen, plus `.abo-schritte` für die Anleitungen und `.kal-abo-wrap` für den einmaligen Hinweis auf der Übersicht · Push-Katalog (nur Admin): `.pkat-liste` `.pkat-karte` `.pkat-kopf` `.pkat-name` `.pkat-marken` `.pkat-wer` `.pkat-vorschau` `.pkat-feld` `.pkat-lbl` `.pkat-zahl` (`.is-lang`) `.pkat-in` `.pkat-platz` `.pkat-knoepfe`, dazu die nachgebauten Mitteilungen `.mt` `.mt-ios` `.mt-android` mit `.mt-ic` `.mt-main` `.mt-kopf` `.mt-app` `.mt-zeit` `.mt-leiste` `.mt-badge` `.mt-t` `.mt-x` · `.frist` `.frist-label` `.frist-warn` |
| Übersicht | Hero ist dieselbe `.tk` wie im Kalender · Danach-Liste: `.dn-liste` `.dn-zeile` `.dn-main` `.dn-t` `.dn-s` (`.is-zu` `.is-ab` `.is-offen`) · `.st-wahl[data-kompakt]` legt die Statuschips ins 2×2-Raster |
| Zu-/Absage | `.tk-rsvp` `.tk-btn` (Absage zusätzlich `.is-ab`, gewählt `.is-on`) · `.tk-grund`. Gewählt heißt Tint: heller Grund, Schrift und 1px-Rand in der dunklen Variante derselben Farbe. Das Dunkelgrün bleibt der Handlung vorbehalten. |
| Aufgaben | `.task-list` `.task-row` (`.is-pay` `.is-lineup` `.is-rsvp`) `.task-num` `.task-main` `.task-title` `.task-sub` `.task-go` |
| Aktionen | `.btn` + `.btn-primary` `.btn-soft` `.btn-danger` `.btn-ghost` · `.icon-btn` `.icon-ok` · `.link-btn` · `.chips` `.chip` (`.is-active`) |
| Status | `.st-badge` + `.st-amber` `.st-red` `.st-grau` · `.tag` + `.tag-cancelled` `.tag-manuell` · `.badge` + `.badge-open` `.badge-paid` `.badge-cancel` `.badge-auto` `.badge-self` · `.cd` + `.cd-neutral` `.cd-amber` `.cd-red` `.cd-due` `.cd-capped` |
| Fitnessstatus | `.st-wahl` `.st-chips` `.st-choice` + `.st-fit` `.st-angeschlagen` `.st-verletzt` `.st-urlaub` · `.st-felder` `.st-feld` |
| Kader | `.kad-list` `.kad-row` (`.is-raus`) `.kad-kopf` `.kad-name` · · `.avatar` |
| Trainer-Ansicht | `.tv-head` · `.tv-next` `.tv-next-kopf` `.tv-next-lbl` `.tv-next-zeile` `.tv-next-datum` `.tv-next-main` `.tv-next-t` `.tv-next-m` `.tv-next-zahlen` `.tv-next-fuss` `.tv-next-btn` · `.tv-kader` `.tv-kader-kopf` `.tv-kader-t` `.tv-kader-n` `.tv-kbar` `.tv-kleg` `.tv-kstat` · `.tv-glist` `.tv-grow` `.tv-gchip` (`.is-offen`) · `.tv-tpls` `.tv-tpl` `.tv-tpl-main` `.tv-tpl-n` `.tv-tpl-chip` |
| Platzansicht | `.tv-lu` (`.tv-ro`) `.tv-top` `.tv-ic` `.tv-hi` `.tv-game` `.tv-sub` · `.tv-formbar` `.tv-fpill` `.tv-fmore` · `.tv-field` `.tv-pitch` `.tv-pitch-bg` `.tv-slot` (`.filled` `.sel`) `.tv-disc` `.tv-role` `.tv-pn` · `.tv-bank` `.tv-bank-h` `.tv-bank-row` `.tv-bslot` `.tv-bnr` `.tv-bn` `.tv-bx` · `.tv-actions` `.tv-primary` `.tv-ghost` `.tv-cta` `.tv-ro-note` |
| Rückmeldungen-Blatt | `.rs2-panel` `.rs2-griff` `.rs2-kopf` `.rs2-kopf-text` `.rs2-titel` `.rs2-sub` `.rs2-zu` · `.rs2-bar` · `.rs2-kacheln` `.rs2-kachel` `.rs2-k-l` `.rs2-k-z` · `.rs2-liste` `.rs2-zeile` `.rs2-av` `.rs2-n` `.rs2-grund` `.rs2-leer` · `.rs2-fuss` `.rs2-btn` |
| Konto | `.mine-banner` (`.is-clear`) `.mb-label` `.mb-value` `.mb-sub` `.mb-bar` `.mb-note` `.mb-pay` `.mb-pp` `.mb-foot` `.mb-cd` `.pp-word` · `.fine-list` `.fine-row` `.fine-main` `.fine-name` `.fine-desc` `.fine-reason` `.fine-right` `.fine-amt` |
| Kasse | `.ks-neu` `.kasse-add` `.kasse-lbl` `.kasse-players` `.kasse-chip` `.kasse-in` `.kasse-sum` `.kasse-sum-row` `.kasse-sum-total` `.kasse-save` `.ks-auch` · Reiter: `.ks-seg` `.ks-seg-b` (`.is-on`) `.ks-seg-n` · Suche: `.ks-such` `.ks-suchfeld` `.ks-such-in` `.ks-such-x` `.ks-gewaehlt` `.ks-gchip` · Eingabeseite: `.ks-seite` `.ks-seite-kopf` `.ks-seite-zur` `.ks-seite-t` `.ks-seite-x` `.ks-seite-body` · gemeinsamer Fuß: `.ks-fuss` `.ks-fuss-btn` · Prüfkarte: `.ks-deck` `.ks-card` `.ks-kopf` `.ks-av` `.ks-name` `.ks-amt` `.ks-meta` `.ks-zitat` `.ks-actions` · Offen: `.krow` `.ks-buchen` · Eingegangen: `.ks-ein` `.ks-ein-row` `.ks-ok` `.ks-ein-main` `.ks-ein-n` `.ks-ein-m` `.ks-ein-b` · Angabe des Spielers: `.ks-sag` `.ks-zi` (`.is-pp`) · Blatt: `.ks-bl` `.ks-bl-sum` `.ks-bl-top` `.ks-bl-n` `.ks-bl-b` `.ks-bl-s` `.ks-bl-lbl` `.ks-bl-h` `.ks-bl-cta` · Wähler: `.ks-wahl` `.ks-wahl-b` `.ks-wahl-t` `.ks-wahl-s` `.ks-wahl-f` · Zahlung melden: `.zm-lbl` `.zm-opt` `.zm-zahl` (`.is-lang`) `.zm-note` · `.ks-leer` `.ks-leer-t` · `.ks-ichips` `.ks-ichip` · `.zart-row` `.zart` (`.is-on`) |
| Katalog | `.kat-list` `.kat-item` `.kat-name` `.kat-sub` `.kat-amount` (`.is-staffel`) `.kat-actions` `.kat-add` · Bearbeiten: `.kat-edit` `.kat-in` `.kat-fixed` `.kat-eur` `.kat-staffel` |
| Final-Bausteine (Paket Final Alle Screens) | `.group-head` · `.row` `.row-av` `.row-main` `.row-t` `.row-s` `.row-end` `.row-chev` · `.mark` (`.is-gruen` `.is-rot` `.is-amber` `.is-urlaub` `.is-gold`) `.mark-dot` · `.add-btn` · `.seg` `.seg-b` · Goldwürfel `.wf` `.wf-hero` `.wf-karte` `.wf-klein` · Terminkarte `.tk-kopf` (`.is-hero` `.is-spiel` `.is-training` `.is-sonstiges` `.is-gold`) `.tk-pille` `.tk-ring` `.tk-rueck` `.tk-felder` `.tk-feld2` `.tk-unten` · Danach `.dn-zeile` `.dn-strich` · Termin-Blatt `.tf-blatt` `.tf-art` `.tf-liste` `.tf-z` `.tf-l` `.tf-nat` `.tf-seg` · Platz `.tv-ring` `.tv-frei-hinweis` `.tv-frei-l` `.tv-krow` `.tv-knr` · Kader `.kad-kpis` `.kad-pille` `.sb-panel` `.sb-k` · Konto `.kt-seg` `.kt-kpi` `.kt-chip` `.kt-row` · Kasse `.ks-geist` `.ks-summe` `.ks-zeile` `.ks-bz` `.ks-box` `.ks-sum` `.ks-katzeile` · Katalog `.kat-blatt` · Einstellungen `.ein-status` `.ein-schritt` `.ein-gefahr` `.ein-wertzeile` `.pr-kopf` `.pr-zeile` |
| Formulare | `.tf-wdh` `.tf-summary` |
| Tabelle | `.table-wrap` + `.rollen-tbl` `.player-cell` `.rollen-av` `.rollen-name` `.rollen-mail` |
| Anmeldung | `.auth-wrap` `.auth-card` `.auth-crest` `.auth-title` `.auth-sub` `.auth-field` `.auth-submit` `.auth-switch` `.auth-forgot` `.auth-error` `.auth-info` |
| Blätter, Dialoge | `.more-sheet` `.more-backdrop` `.more-panel` `.more-title` `.more-item` · `.modal-ov` `.modal` (`.modal-sm`) `.modal-head` `.modal-x` `.modal-sub` `.modal-text` `.modal-actions` (`.modal-actions-col`) `.modal-hint` · `.ptr-ind` `.ptr-coin` `.ptr-ring` `.ptr-disc` `.ptr-logo` `.ptr-shadow` |
| Einstellungen, Profil | `.set-section` `.set-label` `.set-val` `.set-verwaltung` `.set-sub` `.set-hint` · `.pr-head` `.pr-av` `.pr-name` `.pr-list` `.pr-row` `.pr-bar` `.pr-main` `.pr-t` · `.sim-bar` `.sim-exit` `.sim-switch-hint` |

Zustände hängen sich als zweite Klasse an: `.tk-btn.is-ab.is-on`, `.kpi.is-warn`,
`.tk.is-cancelled`. Geschlossene Blätter tragen `hidden`, nicht `display:none`.

## Farben nur über Tokens

Nie ein Hex ins Markup. Alles liegt in `tokens/tokens.css` (151 Tokens):

- Vereinsgrün `--green-990` bis `--green-050` — Kopfzeile, Primäraktion, Erfolg.
  `--green-700` trägt jede Primäraktion, `--green-800` Zahlen und Verweise.
- Gold `--gold-700` bis `--gold-100` plus `--gold-ink` — Akzent, Spiele, Datumswürfel.
  Schrift auf Goldflächen immer `--gold-ink` oder `--gold-ink-2`, nie Weiß.
- Signal: `--red-600` `--red-050` (offen, abgesagt, verletzt) · `--amber-600`
  `--amber-050` (wartet auf Bestätigung, gemeldet, angeschlagen), Schrift darauf
  `--amber-ink` (4,5:1) · Urlaub blau: `--blau-600` (Punkt), `--blau-050`
  `--blau-700` `--blau-line` (Vorlage Final, ersetzt das frühere Grau).
- Neutral `--ink` `--muted` `--line` `--bg` `--card`. `--muted` (#5c6a63) hält
  5,7:1 auf Weiß und 4,7:1 auf `--bg-2`; es gibt nur noch diese eine Nebenfarbe.
- `--seg-bg` ist der Kasten der Segmentleiste (`.ks-seg`, `.zart-row`): eine
  Fläche, kein Rand, auch wenn der Wert mit `--line` zusammenfällt.
- Verläufe `--grad-card` `--grad-btn` `--grad-chip` `--grad-edge-green`
  `--grad-edge-gold` `--grad-edge-red` und weitere. Die gefüllten Statuschips
  tragen eigene, dunklere Verläufe — `--grad-chip-on` `--grad-chip-gold`
  `--grad-chip-red` `--grad-urlaub` —, weil weiße Schrift auf den hellen
  Kantenverläufen keine 4,5:1 erreicht. Der Kopf der Terminkarte richtet sich nach
  der Art: Spiel dunkel (`--green-800` bis `--green-900`), Training hell
  (`--grad-task-green`), Sonstiges gold (`--grad-task-gold`); der nächste Termin
  trägt die Goldlinie (`--gold-400` bis `--gold-700`).
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

### Vorlagen für Einstellungen und Kader

Die vier Bilder dieses Pakets liegen zusammen in
`.design-sync/reference/app/einstellungen-kader/`:

| Datei | Panels |
| --- | --- |
| `einstellungenneu.png` | 1 Übersicht Admin · 1b ans Ende gescrollt · 2 Übersicht Spieler · 8 Abmelden bestätigen |
| `einstellungenneu1.png` | 7 Spielplan (BFV) |
| `einstellungenneu2.png` | 3 Mitteilungen · 4 gescrollt mit kompaktem Titel · 5 Ruhezeiten · 6 Kalender-Abo |
| `kaderneu.png` | A1 Liste · A2 Status ändern |

Die Panelnummern laufen über die Dateien hinweg durch und ergeben einen Satz.
`einstellungenneu2.png` hieß ursprünglich `einstellungenneu .png` — mit einem
Leerzeichen vor der Endung, das jedes Skript stolpern ließ.

## Wo die Wahrheit steht

`styles.css` und die drei Dateien, die es zieht — `tokens/tokens.css` (Tokens),
`fonts/inter.css` (Schrift), `_ds_app.css` (alle Regeln, nach Bereichen kommentiert).
Vor größeren Entwürfen dort nachsehen; die Karten unter `components/` zeigen jedes
Muster fertig aufgebaut — `Grundlagen` die Sprache, `App-Rahmen` das Gerüst,
`Bausteine` die einzelnen Teile, `Ansichten` ganze Seiten bei 390px Breite.

## Emoji-System der Push-Nachrichten

Jeder Push-Titel beginnt mit **genau einem** Zeichen. Immer dasselbe für
dieselbe Art von Nachricht — wer häufig Push bekommt, erkennt die Art vor dem
Lesen. Neue Kategorien folgen diesem System, statt sich ein eigenes Zeichen zu
suchen.

| | Bedeutung | Kategorien |
|---|---|---|
| 🚨 | dringend, Trainer muss reagieren | `absage_kurzfristig`, `unterbesetzung` |
| ⏳ | Frist läuft | `rueckmeldung_erinnerung`, `rueckmeldung_nachfrage` |
| 💸 | Spieler schuldet Geld | `strafe_neu`, `strafen_offen` |
| 💰 | Geld zu prüfen | `zahlung_gemeldet` |
| ✅ | erledigt | `zahlung_bestaetigt` |
| ⚠️ | Problem | `zahlung_abgelehnt` |
| 📅 | Termin-Info | `termin_geaendert`, `termin_neu` |
| ❌ | Ausfall | `termin_abgesagt` |
| 📋 | Übersicht | `meldeschluss_uebersicht` |
| 🔔 | Test | `test` |

Im **Text** sind Emojis sparsam erlaubt, wo sie Zahlen gliedern — etwa
`✅ 12 · ❌ 3 · ❓ 4` in der Meldeschluss-Übersicht. Nicht zur Dekoration.

**Gezählt wird in Graphemen, nicht in UTF-16-Einheiten.** `⚠️` besteht aus zwei
Codepunkten (Zeichen + Variantenselektor), ist auf dem Bildschirm aber eines.
Die Grenzen sind **40 Zeichen im Titel** und **110 im Text**; darüber kürzen die
Sperrbildschirme. Der Zähler im Push-Katalog benutzt `Intl.Segmenter`, die
Gegenprobe in der Migration rechnet ersatzweise ohne Variantenselektor und
Zero-Width-Joiner.

## Schalter: `.sw`

Der **Standard für An/Aus-Einstellungen**. Ein `<button class="sw" role="switch"
aria-checked="…">` ohne Beschriftung im Knopf; der Name steht in der Zeile
daneben und noch einmal als `aria-label`.

`aria-checked` kennt drei Werte: `true`, `false` und **`mixed`** — letzteres
für den Sammelschalter einer Gruppe, in der manches an und manches aus ist.
Ein Druck auf „gemischt" schaltet alles **an**.

Sichtbar 46×28, Trefferfläche **44** über das `::after` — so bleibt die Zeile
schmal, ohne die Regel zu brechen. `disabled` graut ihn aus; die Zeile daneben
bekommt dann `.pn-liste.is-aus`, das **nur den Titel** auf `--muted` setzt. Die
Unterzeile bleibt, wie sie ist — sonst fiele sie unter 4,5:1.

Nur vorhandene Tokens: `--grad-chip-on` an, `--grad-chip` gemischt,
`--surface-3` aus, `--line` und `--green-900` als Rahmen.

**Für neue An/Aus-Einstellungen wird `.sw` benutzt**, kein Chip und kein
Knopfpaar.

### Bestehende Chips, geprüft — kein Umbau nötig

Alle heutigen Chip-Zustände sind **Einfachauswahl oder Filter**, nicht An/Aus:

| | Art |
|---|---|
| `data-filter`, `data-sfilter`, `data-rsfilter`, `data-kstab` | Filter/Reiter — genau einer aktiv |
| `data-status-set` (fit/angeschlagen/verletzt/Urlaub) | Einfachauswahl |
| `data-ks-zart` / `data-zm-zart` (Zahlart), `data-tvform` (Formation), `data-sim` (Rollen-Vorschau) | Einfachauswahl |
| `.role-box` (Rollenvergabe im Admin) | echte `<input type="checkbox">` — bereits richtig |

Keiner davon ist semantisch ein Schalter. Es gibt also **nichts umzustellen**;
`.sw` gilt ab hier für Neues.

## Zahlart-Symbole

Drei eigene Zeichnungen, weil `_neukasse.png` sie an drei Stellen verlangt: im
Buchen-Blatt, in der Zeile „Eingegangen" und vor der Angabe des Spielers.

| Zahlart | Zeichnung | Farbe |
|---|---|---|
| `bar` | Geldschein (Rechteck mit Kreis) | erbt von der Zeile |
| `ueberweisung` | Bankgebäude (Giebel auf Säulen) | erbt von der Zeile |
| `paypal` | PayPal-`P`, zweistufig | `--pp-blue`, auf gefülltem Chip weiß |

Getragen werden sie von `.ks-zi` — 16×16, `flex: none`, `currentColor`. PayPal
ist die einzige Ausnahme (`.ks-zi.is-pp`), weil es eine Marke ist; bar und
Überweisung sind Sachbegriffe und nehmen die Farbe ihrer Zeile an. Auf dem
gefüllten Chip (`.zart.is-on`) wird auch PayPal weiß, sonst wäre Blau auf
Dunkelgrün nicht lesbar.

## Angabe des Spielers

Der bernsteinfarbene Balken `.ks-sag` zeigt, was der Spieler beim Melden gesagt
hat (`reported_method`, `reported_note`, Migration 0040) — eine **Behauptung**,
keine Buchung. Gebucht steht in `payment_method`. Der Balken teilt die Geometrie
mit `.tk-warn` und tauscht nur die Farbfamilie: `--grad-task-gold`,
`--gold-line-2`, `--gold-ink-2`.

Er überlebt eine Ablehnung: abgelehnt heißt, der Kassenwart widerspricht der
Behauptung, nicht dass sie nie gemacht wurde. Deshalb kann eine wieder offene
Strafe den Balken und den Ablehnungsgrund gleichzeitig tragen.

## Blätter: eine Steuerung, nicht elf

Jedes Bottom-Sheet und jedes Vollbild-Blatt geht durch `blattAuf(scrimId,
sheetId)` und `blattZu(...)`. Niemand setzt `classList.add("open")` mehr selbst —
`kassepruef.mjs` prüft das.

Was die Steuerung leistet:

- **`lockBodyScroll()`** fixiert den `body` (`position: fixed`, `top:
  -<scrollY>px`) und stellt die Scrollposition beim Schließen wieder her.
  `overflow: hidden` allein reicht auf iOS im Standalone-Modus nicht. Der
  Zähler darin erlaubt ein Blatt über einem Blatt.
- **`body.blatt-offen`** fährt die untere Navigation weg (`translateY(110%)`,
  `pointer-events: none`, danach `visibility: hidden`). Sie kommt erst zurück,
  wenn das letzte Blatt zu ist.
- Das Blatt sitzt seither am **unteren Bildschirmrand** (`bottom: 0`), nicht
  mehr über der Navigationsleiste. Der letzte Block darin hält die Safe-Area
  selbst frei.
- `overscroll-behavior: contain` auf `.tv-shbody` und `.ks-seite-body`: Scrollen
  im Blatt schlägt nicht auf den Hintergrund durch.

Die `.more-sheet`-Blätter (Kalender-Abo, Rückmeldungen, Termin-Menü) und die
Dialoge (`.modal-ov`) sperrten schon vorher und liegen mit z-index 70 bzw. 1000
ohnehin über der Navigation — sie bleiben, wie sie sind.

## Eine Seite statt eines Abschnitts

`Strafe verhängen` ist keine Sektion im Kassen-Feed mehr, sondern eine eigene
Seite (`.ks-seite`, `position: fixed`): Kopf oben fest, Speichern unten fest,
dazwischen scrollt der Vorgang. `body.ks-seite-offen` blendet die untere
Navigation aus — die Seite ist ein Vorgang mit Anfang und Ende, kein Ziel zum
Hinspringen.

Derselbe Aufbau eignet sich für jeden mehrstufigen Vorgang. Der Knopf unten
trägt das Ergebnis, nicht nur das Verb: **„3 Strafen · 30,00 € speichern"**.

## Vollbild-Flächen gehören an `<body>`

Eine Fläche mit `position: fixed`, die den Bildschirm füllt, wird **an
`<body>` gehängt**, nie in `#view`. Grund: Pull-to-Refresh verschiebt den
Scroll-Container beim Ziehen per `transform`. Ein transformierter Vorfahre
wird zum Bezugsrahmen für `position: fixed` — die Fläche rutscht dann unter
die Kopfzeile und fällt auf die Höhe ihres Containers zusammen. Gemessen:
im transformierten Container landet sie bei `top 224, height 0`, an `<body>`
bei `top 0, height 844`.

Dazu gehört:

- `ueberlagerungOffen()` kennt die Fläche, damit Pull-to-Refresh gar nicht
  erst anläuft.
- `overscroll-behavior-y: contain` auf `body` und auf dem Scrollbereich,
  solange sie offen ist.
- Ihr Zustand steht im Hash (`#strafe=katalog`), damit ein Neuladen auf einer
  leeren, benutzbaren Fläche landet statt auf einem halben Formular.
- `renderKasse()` blendet sie nur ein und aus; neu gezeichnet wird sie nur bei
  eigenen Änderungen. Ein Hintergrund-Neuladen der Daten lässt Eingaben stehen.

## Bestätigen sitzt unten

Kein „Fertig" oben rechts: bei 6,7 Zoll kommt der Daumen dort nicht mehr hin.
Stattdessen `.ks-fuss` mit `.ks-fuss-btn` über die volle Breite, als
Flex-Geschwister des Scrollbereichs — dadurch kann er den letzten
Listeneintrag nicht verdecken. Der Knopf trägt das Ergebnis, nicht das Verb:
**„Weiter mit 3 Spielern"**, **„3 Strafen · 30,00 € speichern"**; bei leerer
Auswahl ist er `disabled`.

Bei offener Tastatur endet die ganze Vollbildfläche über ihr: `--kb` kommt aus
`visualViewport` (`innerHeight − height − offsetTop`, erst ab 90 px als
Tastatur gewertet), und `.tv-kfull` wie `.ks-seite` setzen `bottom: var(--kb)`.

## Suchfelder ohne Kontaktvorschläge

iOS blendet über der Tastatur „Kontakt autom. ausfüllen" samt echtem Namen
ein, sobald es ein Feld für ein Namensfeld hält. Es schließt das aus Feldtyp,
`name`, `id`, Platzhalter **und** Beschriftung. Ein Suchfeld trägt deshalb:

```html
<input class="ks-such-in" id="ksSuche" name="ks-q" type="search"
  inputmode="search" enterkeyhint="search"
  autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
  data-1p-ignore data-lpignore="true"
  placeholder="Suchen" aria-label="Suchen">
```

Der Platzhalter sagt **„Suchen"**, nicht „Name eingeben" — das Wort allein
reicht iOS als Hinweis. Enter schickt nichts ab, es schließt nur die Tastatur
(die Liste filtert schon beim Tippen).

## Antippen baut keine Liste neu

Ein `innerHTML` auf einem Scroll-Container erzeugt ihn neu — und ein neuer
Container startet bei `scrollTop: 0`. Wer weit unten in einer Liste etwas
antippt, landet dann wieder oben. Deshalb gilt:

**Beim Umschalten wird nur ausgetauscht, was sich ändert.** Für jede Liste gibt
es eine Funktion für *eine* Zeile (`ksSpielerZeileHtml`, `ksKatalogZeileHtml`),
und der Klickpfad ersetzt genau diese Zeile plus die Anzeigen außerhalb des
Scrollbereichs: Chipleiste, Zusammenfassung, Knopf.

Bleibt ein voller Neuaufbau unvermeidbar (ein ganzer Block kommt dazu), läuft
er durch `mitScroll(wurzel, fn)`: sichert `scrollTop` jedes `[data-scroll]`
und setzt ihn danach zurück. Jeder Scrollbereich trägt deshalb ein
`data-scroll="…"`.

Dasselbe gilt für den Fokus: ein Feld, das beim Neuaufbau verschwindet und
wiederkommt, verliert ihn — die Tastatur klappt zu und wieder auf.

## Übergänge zwischen Blättern

Beim Wechsel von einem Blatt zum nächsten wird **zuerst das neue geöffnet,
dann das alte geschlossen**. Andersherum leert sich der Blattstapel für einen
Moment: `unlockBodyScroll()` gibt den Hintergrund frei und springt zur
gemerkten Position, `body.blatt-offen` fällt weg und die untere Navigation
fährt ein — alles sofort wieder zurück. Das ist das Flackern.

Und jede Ansicht wird **genau einmal** aufgebaut. `ksSeiteSync()` zeichnet nur,
wenn noch nichts da ist; ein zusätzliches `ksSeiteZeichnen()` daneben wäre ein
sichtbarer zweiter Aufbau.

Vollbildflächen bekommen **keinen Fokus beim Öffnen**. Ein automatisch
fokussiertes Feld holt die Tastatur und mit ihr die iOS-Formularleiste (Pfeile
und Haken) hoch, bevor die Ansicht steht. Wer suchen will, tippt das Feld an.

## Kasse: Reihenfolge statt Filter

Die Kasse hat **keine Filter**. Ein Amateurkader ist klein genug, dass man in
den Listen scrollt statt zu filtern — und jede Filterleiste nimmt oben Platz
weg, der der Liste fehlt. Was bleibt, ist eine feste Reihenfolge:

| Reiter | Reihenfolge |
|---|---|
| Zu prüfen | Kartenstapel, nach Namen |
| Offen | **älteste zuerst** — die drängen am meisten |
| Eingegangen | **neueste Buchung zuerst** |

Bei gleichem Datum entscheidet der Name, damit die Reihenfolge nicht springt.
`KS_REIHENFOLGE` hält die beiden Werte an einer Stelle.

## Zeilen in einer Karte: 16, nicht 14

`.kat-item` ist eine **eigenständige Karte** und trägt 16 px
waagerecht. Eine Zeile **innerhalb** einer Karte (`.ks-ein-row`) nimmt dagegen
den Karten-Standard **16 px** — wie `.card-pad` und `.ks-card`. Der Abstand
zwischen Avatar bzw. Symbolkreis und Text bleibt in beiden Fällen **12 px**;
das ist das Maß aller Avatarzeilen der App.

## Neue Datenbankfunktionen: ausdrückliches `grant`

Seit Migration 0042 (03.10.2026) bekommt eine neue Funktion in `public`
**kein** EXECUTE mehr von selbst: die Default Privileges für Objekte von
`postgres` (so laufen Migrationen im SQL-Editor) sind für `PUBLIC` global und
für `anon`/`authenticated` im Schema `public` entzogen. Deshalb steht in jeder
Migration direkt unter der Funktion, wer sie aufrufen darf:

- Ruft die App sie auf: `grant execute on function public.<name>(<argumente>) to authenticated;`
- Braucht sie nur der Server (`api/*.js` mit Service-Key): `… to service_role;`
- Nur Trigger, Cron oder andere Funktionen: kein `grant`.

**Auch Funktionen, die niemand direkt aufruft, brauchen ein `grant`**, sobald
sie mit den Rechten des Lesenden ausgeführt werden:

- in einer **RLS-Policy** (`using (...)`, `with check (...)`, z. B. `is_admin()`, `has_role()`, `my_player_id()`),
- in einer Sicht mit **`security_invoker = true`**,
- in einem **Spalten-Default** (`default meine_funktion()`),
- in einem **Check-Constraint**.

Dann gilt `grant execute … to authenticated` (und `to anon`, falls die Tabelle
ohne Anmeldung gelesen oder beschrieben wird). Fehlt es, scheitert nicht nur
der Aufruf, sondern **jede Abfrage auf die betroffene Tabelle** mit
`permission denied for function …` – bei einer Policy-Funktion also das
Lesen der ganzen Tabelle.

**Prüfschritt in jeder Migration mit neuer Funktion:** im SQL-Editor als
`authenticated` (Muster: `supabase/checks/0042_rechtepruef.sql`, `set local role
authenticated` plus `request.jwt.claims`, in einer Untertransaktion, die
zurückgerollt wird) die neue Funktion aufrufen bzw. die betroffene Tabelle
lesen und schreiben. Erst wenn das gelingt, gilt die Migration als fertig.

`anon` bekommt nur in begründeten Ausnahmen etwas. Fehlt das `grant`, scheitert
der Aufruf aus der App mit `permission denied` (42501) – das ist gewollt und
fällt beim ersten Test auf, statt still offen zu stehen. Rollenprüfungen
(`is_admin()`, `has_role(...)`) gehören zusätzlich **in** die Funktion; das
`grant` regelt nur, wer anklopfen darf.

## Migrationen: ein einziger `do`-Block

Der Supabase-SQL-Editor führt `begin; … commit;` **nicht verlässlich als eine
Transaktion** aus. Jede Migration mit Gegenprobe läuft deshalb als **ein
einziger `do`-Block** (oder anders nachweislich atomar): Änderungen und
Gegenprobe in derselben Anweisung, neue oder geänderte Funktionen dort per
`execute $ddl$ create or replace function … $ddl$`. Schlägt die Gegenprobe
fehl, rollt die eine Anweisung alles zurück, egal wie der Editor sie schickt.

Vorfall 0044 (05.10.2026): Die Migration bestand aus `begin`, einer temporären
Hilfstabelle mit den Ausgangszählern, `create or replace function`, der
Datenkorrektur, dem `do`-Block mit der Gegenprobe und `commit`. Funktion und
Datenkorrektur wurden festgeschrieben, danach fand die Gegenprobe ihre
Hilfstabelle nicht mehr (`42P01`) und lief nie. Das Ergebnis war zufällig
richtig, die Absicherung hat gefehlt; nachgeholt mit
`supabase/checks/0044_bfv_pruef.sql`.

Dazu:

- **Keine temporären Tabellen über Anweisungen hinweg** in Migrationen.
  Ausgangswerte gehören in Variablen des `do`-Blocks.
- Prüfskripte (`supabase/checks/*.sql`) ändern nichts und dürfen beim Muster
  „temporäre Ergebnistabelle, `do`-Block, `select`“ bleiben; jeder Fall rollt
  in einer Untertransaktion zurück.
- `x = any((select arr from t))`: Postgres liest auch die doppelt geklammerte
  Form als Unterabfrage und vergleicht `uuid = uuid[]`. Stattdessen
  `x in (select unnest(arr) from t)` oder eine Array-Variable.
- Eine Abfrage sieht nicht, was eine Funktion **in derselben Anweisung**
  schreibt (Snapshot). In Prüffällen den Aufruf als eigene Anweisung davor
  ausführen.
- Nach dem Einspielen lesend nachsehen, ob der Stand der Datei entspricht;
  ein fehlerfreier Lauf allein belegt die Gegenprobe nicht.

## Erzeuger für Mitteilungen

Seit 0043 gibt es die Bausteine für automatische Mitteilungen (Plan:
`reference/app/auto-mitteilungen/PHASE0.md`). Ein Erzeuger (Trigger oder
Cron-Funktion ab AM2) benutzt sie so und nicht anders:

- **Empfänger** nur über `notify_profile_von_spieler`, `notify_profile_mit_rolle`
  und `notify_profile_alle_spieler(true)`. `true` lässt Urlaub und verletzt
  weg (F3, F6).
- **Auslöser** (`auth.uid()` beim Ereignis) immer mitgeben; ob ein Profil
  die Nachricht bekommt, entscheidet allein `notify_empfaenger_ok` (F1:
  Auslöser bekommt nichts, außer `strafe_neu`). Keine eigene Abfrage dafür.
- **Einzelnachricht:** `notify_enqueue(...)`. **Mehrere Ereignisse zu einer
  Nachricht** (`{anzahl}`, `{namen}`, `{liste}`): `notify_sammeln(...)`
  und eine Funktion `notify_flush_<kategorie>()`, die der Cron-Job
  `notify-sammler` alle 2 Minuten findet. Das Bündeln im Dispatcher hängt nur
  Texte aneinander und ist dafür nicht gedacht.
- **Aus dem nächtlichen BFV-Sync** frühestens 08:00 Ortszeit:
  `not_before = notify_nicht_vor_acht(now())` (F2, F5).
- **Verfall:** Vorlagen mit `ttl_regel = 'bis_zeitpunkt'` bekommen `p_ttl_bis`
  (z. B. Meldeschluss); `notification_due` lässt abgelaufene Zeilen weg.
- **Texte** über `notify_datum_kurz`, `notify_datum_lang`, `notify_uhrzeit`,
  `notify_termin_titel`, `notify_betrag`; keine Gedankenstriche.
- **Rechte:** kein `grant` an `anon` oder `authenticated`; Erzeuger laufen als
  Trigger oder Cron. Jede Erzeuger-Migration hat Prüffälle mit echten Zeilen
  (Muster `supabase/checks/0043_auto_pruef.sql`), darunter: Auslöser bekommt
  nichts, Urlaub bekommt nichts, nichts rückwirkend für vergangene Termine.
