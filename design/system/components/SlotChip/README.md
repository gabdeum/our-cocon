# SlotChip

Time-of-day picker chip in the add sheet.

Reference: `design/screens/OC-CalAdd.dc.html` (inline styles are the exact values; build with tokens).

## Specs

| Part | Spec |
| --- | --- |
| Chip | min 92 × 66, radius 18, padding 0 12, label 15/900 over hours 12/700 |
| Off | white, ink label, ink-muted hours |
| On | olive, white label and hours |
| Row | horizontal scroll, gap 8, bleeds to the sheet edges |

## Rules

- Adjacent slots combine; All day stands alone. No Custom chip (2026-10-28): the Starts / Ends fields under the row are always shown and take typed times.
