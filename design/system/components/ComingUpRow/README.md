# ComingUpRow

One of the next three days under the MiniMonth, beside Day view from 960 wide (spec 070 FR-007): what's planned, at a glance.

Reference: `design/screens/OC-CalendarResponsive.dc.html` (`view` day at 1180), `design/ui/OC-LargeScreens.md` › Calendar.

## Specs

| Part | Spec |
| --- | --- |
| Label above the rows | "Coming up" 13/900 ink-muted, uppercase, 8 above the rows |
| Row | white (`surface-card`), radius 18, padding 10 / 12, gap 10, at least 44 tall |
| Date | 44 wide, centred: weekday 12/900 ink-muted over the number 20/900 |
| Text | the day's event titles 14/700 ink-muted joined by " · ", or "Nothing planned" |

## Variants and states

Default, pressed (`surface-card-pressed`), focused (focus ring).

## Rules

- The row is one button, read "Monday October 26: Run · Baby yoga"; tapping it opens that day in Day view (`calendar_day_selected`, source `coming_up`).
- Titles follow the header's people filter and `viewFor` (someone else's private event reads "Busy").
