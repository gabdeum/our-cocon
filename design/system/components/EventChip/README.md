# EventChip

A one-line event in a month cell.

Reference: `design/screens/OC-CalMonth.dc.html` (inline styles are the exact values; build with tokens).

## Specs

| Part | Spec |
| --- | --- |
| Chip | 15 tall, radius 4, padding 0 3 (both sides), 10/800 ink, text clipped inside the padding (no ellipsis) |
| Fill | member color; two members split 50/50 (linear-gradient); Others adds 1 px `line-handle` inset outline |
| Text | Under 430 px wide: the title only ("Surprise"). From 430 px: "{initials} {title}" ("G·J Surprise"); Others contributes no initials |
| Overflow | up to 5 rows per cell; more than 5: 4 rows, then "+N" 10/900 ink-muted |

## Rules

- Private events of others read "Busy" (spec 043).
