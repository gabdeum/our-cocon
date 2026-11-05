# MonthGrid

The continuous, vertically scrolling month grid.

Reference: `design/screens/OC-CalMonth.dc.html` (inline styles are the exact values; build with tokens).

## Specs

| Part | Spec |
| --- | --- |
| Weekday row | sticky top, white, 12/900 ink-muted, padding 8 0 6, bottom `line` + soft shadow |
| Cell | fixed 120 tall, padding 3 3 4, gap 2, 1 px `line` right/bottom; past days `surface-page`; up to 5 chips, or 4 + "+N" (10/900) |
| Date | 11/800 in an 18 px row; today: 18 olive circle white 11/900 + 2.5 px olive inset outline on the cell; 1st of month: 18 px ink pill (padding 0 5) "Nov 1" white 11/900, clipped with no "…"; olive when the 1st is today |
| Scroll | virtualised weeks, ±6 months; header title follows the Wednesday of the second visible row |

## Rules

- The cell's accessible label lists each event with its people: "October 25: Baby swim (James), Movie night (Everyone)".
- Tap anywhere on a cell = day sheet (chips and bars aren't separate targets); long-press = add event for that day (also offered to screen readers as an "Add event" action).
- The weekday row is drawn fixed above the scrolling rows (`shadow-sticky`), which looks the same as the sticky row in the screen source.
