# TimePresets

A labelled row of dashed buttons, one per length of time, that each start something right away: the quick kitchen timers on the Timers screen.

## Specs

| Part | Spec |
| --- | --- |
| Label | 15/800 ink-muted, 8 above the row ("Quick kitchen timer"); also names the group for screen readers |
| Row | 4 equal columns, gap 8 |
| Button | `control-lg` (54) tall, `radius-md`, transparent, 2 px dashed `line-dashed`; label 16/800 olive-deep, one line ("5 min") |

## States

Pressed: `surface-soft` fill. Focus: 3 px olive outline, offset 2. No disabled or selected state: every button is always available and nothing stays chosen.

## Rules

- Dashed because each button adds something (Button README › dashed), like the single "Add …" button it replaces.
- Each button's screen-reader label says what it does: "Start a 5 min kitchen timer".
- Keep it to 4 choices so the labels never shrink at the largest text size on a 390 screen.
