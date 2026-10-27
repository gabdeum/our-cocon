# HourGrid

Week view time grid with overlap lanes.

Reference: `design/screens/OC-CalWeek.dc.html` (inline styles are the exact values; build with tokens).

## Specs

| Part | Spec |
| --- | --- |
| Grid | 06:00–24:00, 36 px/hour, 1 px `line` hour lines, 38 px hour-label column (10/800 ink-muted) |
| Block (slot) | radius 7, padding 3, member fill, 1.5 px inset ink 18% outline; top line "{initials} {Slot}" 10/900, title 11/800 |
| Block (custom) | same, with 3 px ink inset left edge; top line "{initials} {start}" |
| Overlaps | lanes from `@cocon/calendar` layoutDay; width = column / lanes; in lanes the top line is initials only |
| Today | column tint `calendar-today-tint`; 2 px olive now-line |

## Rules

- Swipeable horizontally (see Swipeable).
