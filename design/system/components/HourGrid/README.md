# HourGrid

Week view time grid with overlap lanes.

Reference: `design/screens/OC-CalWeek.dc.html` (inline styles are the exact values; build with tokens).

## Specs

| Part | Spec |
| --- | --- |
| Grid | 06:00–24:00, 36 px/hour, 1 px `line` hour lines, 38 px hour-label column (10/800 ink-muted) |
| Block (slot) | radius 7, padding 3, member fill, 1.5 px inset `event-outline` (ink 18%); top line "{initials} {Slot}" 10/900, title 11/800 |
| Block (custom) | same, with 3 px ink inset left edge; top line "{initials} {start}" |
| Overlaps | lanes from `@cocon/calendar` layoutDay; width = column / lanes; in lanes the top line is initials only |
| Today | column tint `calendar-today-tint`; 2 px olive now-line |

## Rules

- Swipeable horizontally (see Swipeable).
- The day row and the "All day" row stay at the top of the card (`shadow-sticky` under them, as Month's weekday row); only the hours scroll.
- Day letters link to Day view; a block opens its event; tapping an empty part of a day opens Add event at that hour (screen readers get one "Add event, {day}" button per day).
- The "All day" row holds all-day events and anything spanning more than one day, as week EventBars stacked 30 px apart (`layoutSpans`).
- Blocks are never shorter than 22 px, and lanes count that drawn height, so a short block doesn't cover the next. An event before 06:00 is drawn from 06:00.
- React Native has no inset shadow: the slot outline and the 3 px left edge are drawn over the fill. Same look.
