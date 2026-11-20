# MiniMonth

A small month beside Day view from 960 wide (spec 070 FR-007), to jump to another day without leaving Day view.

Reference: `design/screens/OC-CalendarResponsive.dc.html` (`view` day at 1180), `design/ui/OC-LargeScreens.md` › Calendar (inline styles are the exact values; build with tokens).

## Specs

| Part | Spec |
| --- | --- |
| Card | white (`surface-card`), radius 22, padding 12 / 12 / 10, in the 300 px (`layout-day-aside`) side column |
| Title | the month, 16/900, padding 0 4 6 ("October", "January 2027" outside this year) |
| Weekdays | the week letters 12/900 ink-muted, from the first day of the week |
| Day | 38 tall, radius 12, 14 px (700; 900 when shown), 2 px gaps; days outside the month in `ink-soft` |
| Shown day | `ink` fill, white text |
| Today | `olive` fill, white text (unless it's the day shown) |
| Dot | 5 px under the number on days with visible events: `olive`, `honey` on the dark cells |

## Variants and states

Default, pressed (`surface-soft`), focused (focus ring), the day shown (`aria-current="date"`), today, outside the month, with events.

## Rules

- The month of the day Day view shows; tapping a day opens it in Day view (`calendar_day_selected`, source `mini_month`).
- Each day is a button named by its date, plus ", has events" when it has a dot (the dot is never the only cue for screen readers).
- Events follow the header's people filter and `viewFor`, as the views do.
