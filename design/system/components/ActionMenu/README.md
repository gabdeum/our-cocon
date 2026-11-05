# ActionMenu

A round ⋯ button that opens a short menu of actions under it. Used where a screen has more actions than the top bar's two buttons hold.

Reference: `design/screens/OC-CalEvent.dc.html` (`dialog: menu`): Duplicate · Share a view-only link · Delete event.

## Specs

| Part | Spec |
| --- | --- |
| Button | IconButton `--round` (48, `shadow-button`), icon `more`, `aria-haspopup`, `aria-expanded` |
| Menu | 236 wide, 8 under the button, right edges aligned; surface-card, radius 18, padding 6, `shadow-popover` |
| Item | min height 48, padding 0 12, radius 12, 16/700 ink; pressed surface-soft |
| Danger item | 16/800 `danger` ("Delete event"); its action is confirmed by a Dialog |

## Rules

- `role="menu"` with `menuitem`s. Closes on a pick, an outside tap or Escape; focus goes back to the button.
- Three items at most. More than that belongs in a sheet.
- Off while the screen is read-only (offline): the button is disabled.
