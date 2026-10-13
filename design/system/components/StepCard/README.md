# StepCard

One recipe step on the recipe page: number, name, instructions with highlighted amounts, and optional temperature check, timer and chef's tip.

## Specs

| Part | Spec |
| --- | --- |
| Card | surface-card, radius 22, padding 16, gap 12 |
| Head | number badge 32 circle honey 15/900 · name 18/900 · optional `Variant` Tag on the right |
| Text | 17/400, line-height 1.55 |
| Amount highlight (`oc-amount`) | 900 weight, surface-soft fill, radius 6, padding 1 4. In cooking mode: honey fill, padding 0 4 |
| Order inside | text → temperature Callout → timer row → tip Callout |
| Timer row | `oc-timer-btn` (flex 1, 52 tall, radius 16, honey; running: olive and white) holding a timer icon 20, the label ("Start timer", "Pause", "Resume", "Done!") and a clock 17 tabular on the right; then two 52-wide `oc-timer-adj` buttons "−1" and "+1" (surface-soft, 15/900) |
| Footnote | under the list: "−1 / +1 changes a timer by a minute, even while it runs." 13/600 muted, centred |

## Amount text format

Amounts come from the quantity engine, never typed: "20 g butter", "2 leeks (300 g)", "1 pinch of nutmeg", "about ¾ cup flour" (scale off), "180 °C (350 °F)".

## Rules

- −1 never goes below 0:30. Starting a timer adds it to the TimerPill.
- Steps added by a variant carry the `Variant` tag.
