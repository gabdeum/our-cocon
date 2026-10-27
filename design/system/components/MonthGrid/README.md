# MonthGrid

The continuous, vertically scrolling month grid.

Reference: `design/screens/OC-CalMonth.dc.html` (inline styles are the exact values; build with tokens).

## Specs

| Part | Spec |
| --- | --- |
| Weekday row | sticky top, white, 12/900 ink-muted, padding 8 0 6, bottom `line` + soft shadow |
| Cell | fixed 96 tall, padding 4 4 6, gap 3, 1 px `line` right/bottom; past days `surface-page` |
| Date | 12/800; today: 22 olive circle white 12/900 + 2.5 px olive inset outline on the cell; 1st of month: ink pill "Nov 1" (padding 0 7, white 12/900) |
| Scroll | virtualised weeks, ±6 months; header title follows the Wednesday of the second visible row |

## Rules

- Tap = day view; long-press = add event for that day.
