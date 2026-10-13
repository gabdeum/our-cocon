# BottomSheet

A sheet that slides up over a dimmed screen for focused tasks: filters, scaling, the converter, sharing, picking groceries.

## Specs

| Part | Spec |
| --- | --- |
| Scrim | `scrim` over the whole screen; tapping it closes the sheet (unless there are unsaved changes) |
| Sheet | surface-page, top radius 32, padding 12 20 28, gap 16; hugs content up to 92% of the screen height |
| Handle | 44 × 5, radius 3, line-handle, centred |
| Header | title 24/900; optional lead 15/600 muted; optional close IconButton `--soft` or a "Clear all" link on the right |
| Body | scrolls if it overflows; sections start with 15–16/900 headings ("1. Which ingredient?") |
| Footer | fixed: one full-width ink button, or soft Cancel (≈110) + ink primary |

## Rules

- One task per sheet. The primary button states the result: "Show 12 recipes", "Apply to recipe", "Add 3 items".
- Swipe down closes. Focus moves to the title on open.
