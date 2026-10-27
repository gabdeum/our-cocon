# EventBar

A multi-day or all-day event spanning several days, drawn over the grid.

Reference: `design/screens/OC-CalMonth.dc.html` (inline styles are the exact values; build with tokens).

## Specs

| Part | Spec |
| --- | --- |
| Month | 20 tall, top 29 inside the week row, inset 4 px each side, radius 6 at real start/end, square where it continues; z-index above cells |
| Week all-day row | 28 tall, radius 8, padding 0 6, spans grid columns |
| Text | 11/800, "{initials} {title}"; continuation row "{title} (cont.)" |

## Rules

- Cells under a bar keep that row empty so chips sit below it.
