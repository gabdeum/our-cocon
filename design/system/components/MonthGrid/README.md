# MonthGrid

The continuous, vertically scrolling month grid.

Reference: `design/screens/OC-CalMonth.dc.html` (inline styles are the exact values; build with tokens).

## Specs

| Part | Spec |
| --- | --- |
| Weekday row | sticky top, white, 12/900 ink-muted, padding 8 0 6, bottom `line` + soft shadow |
| Cell | fixed 120 tall, padding 3 3 4, gap 2, 1 px `line` right/bottom; past days `surface-page`; up to 5 chips, or 4 + "+N" (10/900) |
| Date | 11/800 in an 18 px row; today: 18 olive circle white 11/900 + 2.5 px olive inset outline on the cell; 1st of month: 18 px ink pill (padding 0 5) "Nov 1" white 11/900, clipped with no "…"; olive when the 1st is today. A day with reminders: a 13 px olive `alarm` 2 after the date (ink-muted on faded past days), and the cell's label ends ", 2 reminders" (spec 058). When it doesn't fit beside the date (the 1st's pill, narrow phones, large text; worked out from the font's widths), it goes on that day's first chip row: its chips start one row lower (one fewer, the rest in "+N"), and a multi-day bar in the top lane skips that day (it's drawn around it), so it never covers the clock |
| Scroll | virtualised weeks, ±6 months; header title follows the Wednesday of the second visible row |

## Rules

- The cell's accessible label lists each event with its people: "October 25: Baby swim (James), Movie night (Everyone)".
- Tap anywhere on a cell = day sheet (chips and bars aren't separate targets); long-press = add event for that day (also offered to screen readers as an "Add event" action).
- The weekday row is drawn fixed above the scrolling rows (`shadow-sticky`), which looks the same as the sticky row in the screen source.

## From 600 wide: `wide` (spec 070)

The same continuous vertical scroll as the phone, in a card, with the selected day's panel under it (medium) or beside it (expanded). Reference: `design/screens/OC-CalendarResponsive.dc.html` (`view` month at 820 and 1180).

| Part | Spec |
| --- | --- |
| Card | white, radius 22, clips; the weekday row fixed over the scrolling rows |
| Weekdays | "Sun … Sat" 13/900 ink-muted, 1.5 px `line` under |
| Row | 124 at medium; at expanded `max(96, (available − 40) / 5)` |
| Cell | padding 6; date 14 in a 24 row (today: olive 24 circle; the 1st: ink pill "Nov 1") |
| Chips | EventChip `wide`: 20 tall, 12 text, radius 6, padding 6; as many as fit (`(row − 30) / 22`), then "+N" 12/900 |
| Bars | EventBar `month-wide`: same size, from 32, 22 apart |
| Selected | 2.5 px ink inset (`aria-pressed`); today keeps its olive ring when not selected |

- Tap = select the day (no sheet); long-press = add event, as on the phone.
