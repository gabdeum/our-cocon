# ActionMenu

A round ⋯ button that opens a short menu of actions under it. Used where a screen has more actions than the top bar's two buttons hold.

Reference: `design/screens/OC-CalEvent.dc.html` (`dialog: menu`): Duplicate · Share a view-only link · Delete event. `OC-HomeReminders.dc.html`: a reminder's ⋮ (spec 057).

## Specs

| Part | Spec |
| --- | --- |
| Button | IconButton `--round` (40, `shadow-button`), icon `more`, `aria-haspopup`, `aria-expanded` |
| Menu | 236 wide, 8 under the button, right edges aligned; surface-card, radius 18, padding 6, `shadow-popover` |
| Item | min height 48, padding 0 12, radius 12, 16/700 ink; pressed surface-soft |
| Danger item | 16/800 `danger` ("Delete event"); its action is confirmed by a Dialog |
| Heading (optional) | 13/900 ink-muted, uppercase, padding 8 12 4: "Snooze until" (spec 057) |
| Item detail (optional) | 14/700 ink-muted at the right ("Thu 12"); the item reads "Tomorrow, Thu 12" |
| Separator (optional) | 1 px `line`, margin 2 10, above an item, between groups |
| Dots trigger | `trigger="dots"`: a plain vertical ⋮ (`more-vertical`, 20), 36 × 44, radius 12, surface-soft while open; (not used since spec 058 took the ⋮ off Home's reminder rows) at the end of a ReminderRow on Home |

## Rules

- `role="menu"` with `menuitem`s. Closes on a pick, an outside tap or Escape; focus goes back to the button.
- Three items at most, except a grouped menu with a heading and separators (Home's reminder ⋮: the snooze times, then Pick a date…, Edit and Delete reminder). More than that belongs in a sheet.
- Off while the screen is read-only (offline): the button is disabled.
