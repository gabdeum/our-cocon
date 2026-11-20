# CookStepList

Every step of the recipe beside cooking mode from 960 (spec 066, OC-CookResponsive): see where you are and jump to any step. It replaces the Progress `--cook` bars at that width.

## Specs

| Part | Spec |
| --- | --- |
| Card | `layout-step-list` (260) wide, full height, its rows scroll inside, `surface-card`, `radius-xl` (22), padding 10, gap 4; a `navigation` landmark named "All steps" |
| Heading | "All steps" 13/900 ink-muted uppercase, letter-spacing 0.7, padding 6 8 4 |
| Row | min height 56, `radius-lg` (16), padding 6 10, gap 12, 2 px transparent border; a button |
| Badge | 32 round, number 15/900. Current: `olive`, white number. Done: `olive-muted` with a 16 check. To do: `surface-soft` |
| Name | 16, 800 (current 900); ink, done ones ink-muted; the step number's "Step N" when it has no name |
| Time | while the step's timer runs or is paused: ink pill, 13/900 `on-ink` tabular, padding 3 8 |

## States

Current: `surface-soft` fill, 2 px `olive` border, `aria-current="step"`. Pressed: `surface-soft`. Focus: 3 px olive outline, offset 2.

## Rules

- A row's screen-reader label is "Go to step 3: Bake", plus ", timer 12:30" while its timer shows.
- Tapping a row scrolls the steps to it, smoothly (instantly with Reduce Motion), like the bars.
