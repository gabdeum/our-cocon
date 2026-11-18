# OC-CookDone — Done cooking (toast)

Source `screens/OC-CookDone.dc.html` (the old sheet; superseded) · No route of its own: a toast (Toast README) over Recipes, Home or the recipe page · Spec 051 (FR-005)

## Where it shows
- Done on an In progress card (OC-Recipes) or Home's cooking card, over that screen.
- Done on the recipe page's in-progress card, or its main button "Done cooking" (OC-Recipe), over the recipe page.
- "Done cooking" on cooking mode's last step (OC-Cook): cooking mode closes, then it shows over the recipe page.

By the time it shows, the cook is already logged as done (`finished_at`, `finished_by`).

## Layout
The app's toast (sage): "{recipe} is done! That’s {n} times now." ("{recipe} is done! That’s the first time." when n = 1), then round Undo and ✕. {n} counts every done cook of the recipe, this one included.

## Behaviour
| Element | Result |
| --- | --- |
| Undo | puts the cook back in progress at the same step; the toast closes |
| ✕, or 8 s | closes the toast |

## States
| State | Copy and behaviour |
| --- | --- |
| Undo failed | warn toast "Couldn't undo. Check your connection and try again." |
| Done itself failed | no toast of its own; warn toast "Couldn't save. Check your connection and try again." |

## Changelog
- 2026-11-12 (051): new. "That’s the first time." is Claude's copy (the design only draws "That’s {n} times now.").
- 2026-11-17 (Gabriel's ask): the Done sheet becomes the app's toast with Undo and ✕; "Back to the recipe", "Mark as done" and the "Still in progress" state are gone.
