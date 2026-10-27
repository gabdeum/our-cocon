# CalendarHeader

Shared header for the four calendar views.

Reference: `design/screens/CalHeader.dc.html` (inline styles are the exact values; build with tokens).

## Specs

| Part | Spec |
| --- | --- |
| Title row | title 28/900 one line + IconButton ‹ › (44, white) + soft pill "Today" (44) |
| View switcher | SegmentedControl links: Month · Week · Day · Agenda |
| Filter row | MemberChip (filter) per member + Everyone + Others, horizontal scroll |
| Padding | 54 top, 20 sides, 10 bottom; gap 12 |

## Rules

- Month titles: "October" in the current year (any width); other years "Jan. 2027" under 430 px, "January 2027" above.
