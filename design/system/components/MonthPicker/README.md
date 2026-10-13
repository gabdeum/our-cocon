# MonthPicker

A 6 × 2 grid of month toggles, for when a recipe is best (form) and for in-season filtering (filters).

## Specs

| Part | Spec |
| --- | --- |
| Grid | 6 equal columns, gap 6 |
| Cell | 40 tall, radius 12, surface-soft, 14/700 ink, three-letter month |
| Selected | olive fill, white 900 (`aria-pressed="true"`) |
| Hint | 13/600 ink-muted under it: "Leave empty if it's good all year." |

## Rules

- Multi-select. Ranges can wrap the year (Oct → Mar). Show them elsewhere as "Best Oct – Mar".
- Month names follow the device locale.
- Cells are 40 tall, but the full grid row counts as the 44 touch target.
