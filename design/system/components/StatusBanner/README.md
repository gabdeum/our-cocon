# StatusBanner

Short live feedback: the card the Toast floats (a confirmation with Undo), the offline notice, and small presence or "screen on" chips.

## Specs

| Variant | Spec |
| --- | --- |
| Confirmation (`oc-status`) | sage, radius 18, min 54 tall, padding 8 8 8 16, 15/800 text (wraps, never cut); trailing round buttons as in the Toast README (Undo, Try again, ✕; spec 053); `role="status"` |
| Offline (`oc-status--warn`) | as Confirmation, in `warn-soft` with `warn` text, no button: "You're offline. You can read, but changes need a connection." (Patterns.md › Offline) |
| Presence (`oc-presence`) | sage pill, padding 7 12, 13/800, 8 px olive dot: "Mia is shopping" |
| Screen on (`oc-awake`) | sage pill, padding 8 12, 13/800 olive-deep, 16 px screen-on icon: "Screen stays on" |
| Full-screen success | 72 sage disc with a 34 check, title 22/900, body 15/600 muted, Undo link, then two buttons (see Add to groceries) |

## Rules

- Confirmations and failures are shown with the Toast (Toast README): the card floats at the top and goes after 5 s, or 8 s with Undo; a failure stays until ✕. For AI changes, Undo stays available for 7 days from the activity feed.
- In the layout, only states that last: offline, "Alex just changed this recipe" with "Reload", and a recipe deleted by someone. Never "save failed" (spec 053).
- Never stack two. A new one replaces the old.
