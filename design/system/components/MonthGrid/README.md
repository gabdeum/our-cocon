# MonthGrid

The continuous, vertically scrolling month grid.

Reference: `design/screens/OC-CalMonth.dc.html` (inline styles are the exact values; build with tokens).

## Specs

| Part | Spec |
| --- | --- |
| Weekday row | sticky top, white, 12/900 ink-muted, padding 8 0 6, bottom `line` + soft shadow |
| Cell | fixed 96 tall, padding 4 4 6, gap 3, 1 px `line` right/bottom; past days `surface-page` |
| Date | 12/800; today: 22 olive circle white 12/900 + 2.5 px olive inset outline on the cell; 1st of month: dark beige (`line-handle`) banner across the top of the cell, edge to edge (26 tall over the cell padding, padding 0 7), "Nov 1" ink 12/900, one line clipped with no "…"; olive when the 1st is today |
| Scroll | virtualised weeks, ±6 months; header title follows the Wednesday of the second visible row |

## Rules

- Tap = day view; tap on an event chip = that event (2026-10-28); long-press = add event for that day (also offered to screen readers as an "Add event" action).
- The weekday row is drawn fixed above the scrolling rows (`shadow-sticky`), which looks the same as the sticky row in the screen source.
