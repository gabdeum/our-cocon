# TimeField

One time at the end of a row, small: the reminder sheet's "Set a time" (spec 057). For a start and an end, use TimeRange.

Reference: `design/screens/OC-ReminderEdit.dc.html` (inline styles are the exact values; build with tokens).

## Specs

| Part | Spec |
| --- | --- |
| Field | 84 × 44, radius 12, 2 px `line-strong` border on surface-page, 17/900 centred; focused border olive |
| Web | typed, "15:00" (5 characters), checked by the screen |
| iPhone | the system's compact time button, minutes by 5, in the member's 12/24 h clock |
| Android | a button showing the time; opens the clock dialog |

## States

| State | Look |
| --- | --- |
| Invalid (web) | `warn-border`, warn-soft fill, warn text; the screen says what to fix |

## Rules

- Named for screen readers ("Time"); the row's label says what it's for.
