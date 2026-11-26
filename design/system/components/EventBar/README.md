# EventBar

A multi-day or all-day event spanning several days, drawn over the grid.

Reference: `design/screens/OC-CalMonth.dc.html` (inline styles are the exact values; build with tokens).

## Specs

| Part | Spec |
| --- | --- |
| Month | 15 tall, top 23 inside the week row, inset 3 px each side (the cell padding), padding 0 3, radius 4 at real start/end, square where it continues; z-index above cells |
| Week all-day row | 28 tall, radius 8 at real start/end, padding 0 6, spans grid columns (1 px inset each side for the 2 px gap); `size="week"` |
| Text | Month: 10/800, the title only under 430 px wide, "{initials} {title}" from 430 px; week: 11/800 "{initials} {title}". Continuation row "{title} (cont.)" |

## Rules

- Cells under a bar keep that row empty so chips sit below it.
- Overlapping bars stack 17 px apart (`layoutSpans` in @cocon/calendar); a month cell shows five rows, or four and "+N", so a bar in a row the cell doesn't show counts in its "+N" (a fifth-row bar is drawn only over the days that show five rows).
- Month: not a tap target; the tap goes to the day cell under it (day sheet).

## From 600 wide (spec 070)

- `month-wide`: 20 tall, 12/800, radius 6, inset 6; first lane at 32 from the row's top, then 22 apart.
- `week-wide`: the week's All day row, 32 tall, 14/800, 34 apart.

## Back-to-back trips (2026-11-26)

When the same people have two multi-day Travel events where one ends the day the next starts, the two bars share a row: the first stops at the middle of that day (rounded end) and the next starts there (rounded start), so they never stack. In the day view, that day shows one All day row split in the middle (2 px gap), each half opening its own trip.
