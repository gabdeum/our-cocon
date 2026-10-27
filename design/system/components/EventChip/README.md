# EventChip

A one-line event in a month cell.

Reference: `design/screens/OC-CalMonth.dc.html` (inline styles are the exact values; build with tokens).

## Specs

| Part | Spec |
| --- | --- |
| Chip | 20 tall, radius 6, padding 0 4 (both sides), 11/800 ink, text clipped inside the padding (no ellipsis) |
| Fill | member color; two members split 50/50 (linear-gradient); Others adds 1 px `line-handle` inset outline |
| Text | "{initials} {title}" ("G·J Surprise"); Others contributes no initials |
| Overflow | max 2 chips per cell, then "+N" 11/900 ink-muted |

## Rules

- Private events of others read "Busy" (spec 043).
