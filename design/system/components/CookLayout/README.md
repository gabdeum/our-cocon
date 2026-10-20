# CookLayout

The cooking-mode frame (Patterns.md › Cooking mode, OC-Cook): a fixed header, one scrolling column of steps, and a fixed footer. `CookSection` is one step in it.

## Specs

| Part | Spec |
| --- | --- |
| Header | padding 50 20 12, gap 12, `surface-page`, 1.5 px `line` bottom border |
| Exit | soft pill 44 tall, padding 0 14 0 8, gap 4, close icon 20, "Exit" 15/800 |
| Status | right of Exit: the TimerPill (48 tall), else the `oc-awake` chip, else a muted 13/700 hint |
| Progress | Progress `--cook` under the top row |
| Body | scrolls, padding 0 20, `scroll-snap-type: y proximity` (iPhone: snaps to the steps' tops) |
| End | "Bon appétit!" olive 18/900, centred, 280 tall with 30 on top |
| Footer | padding 12 20 28, gap 10, 1.5 px `line` top border; Button soft `--lg` (⅓) and olive `--lg` (⅔) |
| `CookSection` | min height 500, padding 24 0 28, gap 16, 1.5 px dashed `line-strong` bottom border, snaps to its start |
| Overline | "Step N" 13/900 olive uppercase, letter-spacing 0.8 |
| Title | 28/900, letter-spacing −0.5; left out when the step has no name |

## Rules

- The current step is at full opacity, the others at `opacity-dimmed`, with a 250 ms transition.
- In a section: step text (`body-cook`), then the dark TimerCard, the temperature Callout and the tip Callout (both in their cooking-mode sizes).
- The app decides which step is current and scrolls to it (spec 012); the layout only draws.
