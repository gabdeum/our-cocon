# DayChip

"When" tiles in the add sheet.

Reference: `design/screens/OC-CalAdd.dc.html` (inline styles are the exact values; build with tokens).

## Specs

| Part | Spec |
| --- | --- |
| Tile | flex 1, min 60, radius 16, label 15/900 over date 12/700; selected olive/white |
| Start-aligned (`align="start"`) | padding 6 12, left-aligned, label 16/900 over date 13/700: the reminder drawer's "Snooze until" tiles, two per row (spec 057, `OC-ReminderDrawer.dc.html`) |

## Rules

- Three tiles: Today, Tomorrow, Other day (opens a date picker). The reminder sheet's "Due" uses the same three.
