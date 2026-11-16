# ReminderRow

A reminder in a list: tick it off, see who it's for, when it's due and how late it is (spec 057).

Reference: `design/screens/OC-HomeReminders.dc.html` and `OC-Reminders.dc.html` (inline styles are the exact values; build with tokens). Behaviour: `design/ui/OC-Reminders.md` › Reminder row.

## Specs

| Part | Spec |
| --- | --- |
| Row | min 58, padding 4 0, 1.5 px `line` divider between rows (none under the last) |
| Tick box | 24, radius 8, 2.5 px `line-dashed` border on surface-card; done = olive fill with a white check. `role="checkbox"`, target 40 × 44 ("Mark done: {title}" / "Mark not done: {title}") |
| Member dot | 28 circle in the member colour with its edge ring; initial 13/900, "All" 10/900; 50 % opacity when done. `role="img"` named after the member |
| Text | 10 after the dot. Title 16/800 one line with ellipsis (done: struck through, ink-muted); detail 13/700 ink-muted one line |
| Icons | Reminders screen only: `repeat` and `note`, 14, ink-muted, before the detail, each with a name ("Repeats", "Has notes"); hidden when done |
| Late badge | warn-soft pill, padding 3 8, 12/900 `warn` ("2d late", "3h late"), 8 before; hidden when done |
| ⋮ | 20 px `more-vertical`, 36 × 44, flush right: `trailing`, an ActionMenu `trigger="dots"` on Home; or `more`, a button opening the drawer on the Reminders screen (`aria-haspopup="dialog"`, "Open {title}") |

| Pill (`MemberPill`) | the drawer's who: the member's name 13/900 on their colour, 24 tall, padding 0 9, pill radius, edge ring |

| Show more (`ReminderMore`) | inside a section's card after its last row: 48 tall, 1.5 px `line` divider above, "Show more" 15/800 olive-deep (no count: the lists come in pages, 032-later) |

## Variants and states

| State | Look |
| --- | --- |
| Open | as above |
| Done | box olive ✓, title struck, dot 50 %, no icons or badge; the detail reads "Done just now" until the screen is left |
| Openable (`onOpen`) | title and detail are one button ("Open {title}"), pressed surface-soft |
| Snoozed | no tick box (the Reminders screen's Snoozed rows) |
| Offline | tick box keeps its look, `aria-disabled`, not pressable |

## Rules

- One row per reminder, never per repeat: a repeating reminder shows only its open date.
- The tick is optimistic; a failed save puts it back and shows "Couldn't save. Try again."
