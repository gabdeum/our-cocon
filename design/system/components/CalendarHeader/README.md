# CalendarHeader

Shared header for the four calendar views.

Reference: `design/screens/CalHeader.dc.html` (inline styles are the exact values; build with tokens).

## Specs

| Part | Spec |
| --- | --- |
| Row 1 | title 28/900 one line (flex) + soft pill "Today" (44) |
| Row 2 | view button (white pill, label + chevron) · people button (dot stack + "All" / "{n} of {total}" + chevron; sage when filtered) · spacer · IconButton ‹ › (44, white) |
| View menu | Popover: Month · Week · Day · Agenda, 48 px rows, check on current |
| People filter | Popover: "Show events for" + "Show all", MemberChip (row) per member + Everyone + Others with checkboxes |
| Padding | 54 top, 20 sides, 10 bottom; gap 10; total 162 |

## Rules

- Month titles: "October" in the current year (any width); other years "Jan. 2027" under 430 px, "January 2027" above.
