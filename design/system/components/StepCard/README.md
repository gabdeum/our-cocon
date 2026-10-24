# StepCard

One recipe step on the recipe page: number, name, instructions with highlighted amounts, and optional temperature check, timer and chef's tip.

## Specs

| Part | Spec |
| --- | --- |
| Card | surface-card, radius 22, padding 16, gap 12 |
| Head | number badge 32 circle honey 15/900 · name 18/900 · optional `Variant` Tag on the right |
| Text | 17/400, line-height 1.55 |
| Amount highlight (`oc-amount`) | 900 weight, surface-soft fill, radius 6, padding 1 4. In cooking mode: honey fill, padding 0 4 |
| Missing ingredient | a token whose ingredient was deleted: the plain name, same size and weight as the text, ink-muted, no highlight |
| Order inside | photo (full width, 13:8, radius 16, when it has one) → text → temperature Callout → timer row → tip Callout |
| Timer row | `oc-timer-btn` (flex 1, 52 tall, radius 16, honey; running: olive and white) holding a timer icon 20, the label ("Start timer", "Pause", "Resume", "Done!") and a clock 17 tabular on the right; then two 52-wide `oc-timer-adj` buttons "−1" and "+1" (surface-soft, 15/900) |
| Footnote | under the list: "−1 / +1 changes a timer by a minute, even while it runs." 13/600 muted, centred |

## Amount text format

Amounts come from the quantity engine, never typed: "20 g butter", "2 leeks (300 g)", "1 pinch of nutmeg", "about ¾ cup flour" (scale off), "180 °C (350 °F)".

## Rules

- −1 never goes below 0:30. Starting a timer adds it to the TimerPill.
- The clock is never a live region (it would talk every second). `announcement` fills a hidden polite region: "1 minute left" at 1:00 and "{name} is done" at zero.
- Steps added by a variant carry the `Variant` tag.

## StepRow

The recipe page's Steps tab lists each step as a StepRow: a quick look that opens cooking mode at that step. The full StepCard stays on the shared page.

| Part | Spec |
| --- | --- |
| Row | surface-card, radius 16, min-height 60, padding 10 10 10 14, gap 10; pressed `surface-card-pressed`; role link |
| Left | number badge (as in StepCard) |
| Title | the step's name, or its text when it has none: 16/800, one line, cut short |
| Timer chip | only for a step with a timer: honey pill, padding 4 10, timer icon 16 and the length ("12:00") 14/800 tabular |
| Right | chevron-right 20, ink-muted |
| Label | "Open step {n} in cooking mode" |
