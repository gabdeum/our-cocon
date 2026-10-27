# ChecklistRow

Tickable item on an event ("Bring").

Reference: `design/screens/OC-CalEvent.dc.html` (inline styles are the exact values; build with tokens).

## Specs

| Part | Spec |
| --- | --- |
| Row | min 52, full-width button `role="checkbox"`, gap 12, 1.5 px `line` divider |
| Box | 26, radius 8: off 2 px `line-dashed` border; on olive with white ✓ |
| Label | 16/700; done = strike-through + ink-muted |

## Rules

- Anyone in the family can tick; syncs in real time.
