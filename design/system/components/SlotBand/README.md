# SlotBand

A time-of-day section in the day view.

Reference: `design/screens/OC-CalDay.dc.html` (inline styles are the exact values; build with tokens).

## Specs

| Part | Spec |
| --- | --- |
| Header | title 18/900 + hours 14/700 ink-muted, baseline aligned, gap 8 |
| Event row | white, radius 20, padding 12 14 12 12, gap 12: 6 px stripe, 36 avatar, title 17/800, time line 14/700 ink-muted, driver line 14/800 olive-deep with car icon, "Now" honey tag |
| Reminder row (`DayReminderRow`, spec 058) | the ListRow's reminder in the calendar (tick box, title 17/800, sub-line, late badge) in a white card, radius 20, padding 6 14 6 12, min 64. Sits in the band of its time among the events, or in All day when it has no time or is late. A band with only reminders has no add row |
| Empty | 52 tall dashed 2 px `line-dashed`, radius 18, olive-deep 15/800 "+ Add in the {band}" |

## Rules

- Time line: band name if the event starts at the band start, otherwise the start time.
