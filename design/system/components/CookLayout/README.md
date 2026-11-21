# CookLayout

The cooking-mode frame (Patterns.md › Cooking mode, OC-Cook): a fixed header, one scrolling column of steps, and a fixed footer. `CookSection` is one step in it.

## Specs

| Part | Spec |
| --- | --- |
| Header | padding safe-area (52) / 16 / 12, gap 12, `surface-page`, 1.5 px `line` bottom border; the progress row inset 4 more, so it stays 20 from the edges |
| Exit | IconButton `--round` (40, `shadow-button`), close icon 20, label "Exit cooking mode"; it sits where the loading state's TopBar put it (TopBar README, spec 050) |
| Right | an IconButton `--round` with the timer icon, "Timers" (spec 062; below 600 only), then one with the settings icon, "Cooking options"; gap 8 |
| Pill (below 600) | the TimerPill (50, with its ✕) while timers run, centred, floating 12 above the footer over the steps (spec 066) |
| Progress | Progress `--cook` under the top row |
| Body | scrolls, padding 0 20, `scroll-snap-type: y mandatory` (iPhone: `snapToOffsets` from `snapPoints`: step tops, and the end of a step taller than the screen) |
| End | "Bon appétit!" olive 18/900, centred, 280 tall with 30 on top |
| Footer | padding 12 20 28, gap 10, 1.5 px `line` top border; Button soft `--lg` (⅓) and olive `--lg` (⅔). The buttons that leave cooking mode are ink: "Exit" with a close icon in Back's place on the first step, "Finish" with a check icon on the last |
| `CookSection` | min height 500, padding 24 0 28, gap 16, 1.5 px dashed `line-strong` bottom border, snaps to its start (`scroll-snap-stop: always`); one taller than the screen also snaps to its end |
| Title | 28/900, letter-spacing −0.5; left out when the step has no name. A step photo (PhotoViewer README › StepPhoto) sits right of it, top-aligned, gap 14 |

## From 600 (spec 066, OC-CookResponsive)

| Part | Spec |
| --- | --- |
| Header | padding top `layout-top-wide` (12, or the safe area when taller) / 20 / 12. Exit · the recipe's name 20/900 (−0.3) with "Serves 6 · Classic" 14/700 ink-muted under it · Settings. No Timers button and no pill: the panel shows them |
| Body | padding 16 20 20, gap 16, in a row: (from 960) the CookStepList, the steps, the timers panel |
| Steps | the rest of the width, up to `layout-reading` (960), centred only past it, padding 0 8; the footer under it at the same width, padding 12 8 0, no border |
| Panel | 24 % of the window, from `layout-panel-medium` (290; `layout-panel-expanded`, 320, from 960) to `layout-panel-max` (380), full height; the content brings its own scrolling, so a title can stay at the top (cooking mode: "Timers" and the running count) |
| `CookSection` | min height 60 % of the window, never under 500, so the next step peeks below |
| Progress | none from 960: the step list replaces the bars and its heading the "Step N of M" line ("All steps · 3 of 6"; 2026-11-21) |

The step list's column is 18 % of the window, `layout-step-list` (260) to `layout-step-list-max` (300). `cookColumns(tier, width)` gives both side widths: the sides grow a little with the window so the steps fill the middle on a large iPad rather than centring, and stay the widest column.

The tree is the same at every width: the steps' scroll and their timers stay when the window changes tier.

## Rules

- The current step is at full opacity, the others at `opacity-dimmed`, with a 250 ms transition.
- In a section: step text (`body-cook`), then the dark TimerCard, the temperature Callout and the tip Callout (both in their cooking-mode sizes).
- The app decides which step is current and scrolls to it (spec 012); the layout only draws.
