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
