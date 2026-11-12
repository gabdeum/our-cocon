# OC-CookDone — Done cooking (sheet)

Source `screens/OC-CookDone.dc.html` · No route of its own: a BottomSheet over Recipes or the recipe page · Spec 051 (FR-005)

## Where it opens
- Done on an In progress card (OC-Recipes), over Recipes.
- Done on the recipe page's in-progress card, or its main button "Done cooking" (OC-Recipe), over the recipe page.
- "Done cooking" on cooking mode's last step (OC-Cook): cooking mode closes, then it opens over the recipe page.

By the time it shows, the cook is already logged as done (`finished_at`, `finished_by`).

## Layout
1. BottomSheet (close label "Close"), its content centred.
2. Sage disc 72 with a check.
3. Title "{recipe} is done!" (22/900).
4. Body "Logged as cooked today by {member}. That’s {n} times now." ("Logged as cooked today by {member}. That’s the first time." when n = 1). {n} counts every done cook of the recipe, this one included.
5. Underlined ink link "Undo" (15/900).
6. Footer: ink "Back to the recipe", full width.

## Behaviour
| Element | Result |
| --- | --- |
| Undo | puts the cook back in progress at the same step; the sheet then reads title "Still in progress", body "It’s back at the top of Recipes, at step {k}.", link "Mark as done" |
| Mark as done | logs it as done again; back to the first title and body |
| Back to the recipe, the scrim or a swipe | closes the sheet (over Recipes, it stays on Recipes) |

## States
| State | Copy and behaviour |
| --- | --- |
| Undo or Mark as done in progress | the link waits (off) until it's saved |
| Undo or Mark as done failed | "Couldn't save. Check your connection and try again." in warn (14/700) under the link; the sheet stays as it was |
| Done itself failed (before the sheet) | no sheet; toast warn "Couldn't save. Check your connection and try again." |

## Accessibility
The sheet's content is a status region, so the title and body are read when it opens and again after Undo or Mark as done.

## Changelog
- 2026-11-12 (051): new. "That’s the first time." is Claude's copy (the design only draws "That’s {n} times now.").
