# TimeRange

The "Starts" and "Ends" times side by side: typed on the web, picked with the system's own time picker on the phone (the add sheet, OC-CalAdd).

## Specs

| Part | Spec |
| --- | --- |
| Row | two equal columns, gap 8 |
| Label | 15/900 above each field, 6 gap (as TextField) |
| Web | two TextFields, "18:30", numbers keyboard, 5 characters at most |
| Phone field | looks like the TextField input: 54 tall, radius 16, 2 px `line-strong`, white, padding 0 16; the time 17/700 ink, tabular, in the person's clock ("6:30 PM" in 12-hour); empty for none |
| iOS picker | the system wheel (`spinner`), full width under the row, 8 below it; 5-minute steps; text `ink` |
| Android picker | the system clock dialog, 24-hour or 12-hour as the person's clock |

## States

- Picking (iOS): that field's border is `olive`, like a focused input; tapping it again, or emptying it (All day), closes the wheel. Tapping the other field moves the wheel to it.
- Empty: tapping fills the field with the time the picker opens on (the caller's `fallback`), since the wheel always shows a time.
- Warning: as TextField (`warn-border`, `warn-soft`, the time in `warn`, the message under the field).
- Pressed: `surface-soft` fill. Focus: 3 px olive outline, offset 2.

## Rules

- Values are always "HH:MM" in 24 hours; only the shown text follows the person's clock.
- The phone never types a time: no keyboard over the sheet, and no "Use a time like 18:30" mistakes.
- Screen-reader label: "Starts: 6:30 PM", or "Starts" when empty; on iOS the field says whether its wheel is open.
- The picker is native, so it needs a new app build when added or upgraded (CLAUDE.md › Releasing).
