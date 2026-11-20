# CookStepList

Every step of the recipe beside cooking mode from 960 (spec 066, OC-CookResponsive): see where you are and jump to any step. It replaces the Progress `--cook` bars at that width.

## Specs

| Part | Spec |
| --- | --- |
| Card | fills the width it's given (CookLayout: 260 to 300, with the window), full height, its rows scroll inside, `surface-card`, `radius-xl` (22), padding 10, gap 4; a `navigation` landmark named "All steps" |
| Heading | "All steps" 13/900 ink-muted uppercase, letter-spacing 0.7, padding 6 8 4 |
| Row | min height 56, `radius-lg` (16), padding 6 10, gap 12, 2 px transparent border; a button |
| Badge | 32 round, number 15/900. Current: `olive`, white number. Done: `olive-muted` with a 16 check. To do: `surface-soft` |
| Name | 16, 800 (current 900); ink, done ones ink-muted; the step number's "Step N" when it has no name |
| Time | when the step has a timer: 13/900 tabular, padding 3 8, pill. Running: `ink` with `on-ink` text, what's left. Not started or paused: `line-strong` with `ink-muted` text (the full time, or what's left) |

## States

Current: `surface-soft` fill, 2 px `olive` border, `aria-current="step"`. Pressed: `surface-soft`. Focus: 3 px olive outline, offset 2.

## Rules

- A row's screen-reader label is "Go to step 3: Bake", plus ", timer 12:30" when it has a timer.
- Tapping a row scrolls the steps to it, smoothly (instantly with Reduce Motion), like the bars.
- The list keeps the current row in sight: when it changes, or on opening at a later step, the list scrolls to centre it if it isn't fully shown.
