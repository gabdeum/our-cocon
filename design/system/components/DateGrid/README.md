# DateGrid

One month of days to pick a date from, in a BottomSheet: the add sheet's "Other day" and "Ends: On a date" (spec 041).

No drawn screen: built from Extending.md with the MonthGrid's weekday row and the DayChip's selected look.

## Specs

| Part | Spec |
| --- | --- |
| Header | soft IconButtons ‹ › (44) around the month title 17/900 ("November 2026") |
| Weekday row | 12/900 ink-muted letters, in the member's week order |
| Day | 44 × 44 circle, 16/700 ink tabular; gap 4 between weeks |
| Selected | olive fill, white 16/900 |
| Today | 2.5 px olive ring, 16/900 |
| Disabled | `opacity-dimmed`, not tappable (days before the event for "Ends on a date") |

## Rules

- Each day is a button labelled with its full date ("Saturday, Oct 31"); `aria-pressed` on the pick, `aria-current="date"` on today.
- Picking a day closes the sheet; the sheet's title says what's being picked ("Pick a date", "Ends on").
