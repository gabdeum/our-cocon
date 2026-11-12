# CookSessionCard

A recipe someone is cooking (spec 051): it stays "in progress" until it's marked done or cancelled, so anyone in the family can pick it up again. Added because no card had a progress bar and three actions together.

## Specs

| Variant | Spec |
| --- | --- |
| Container | `surface-card`, 2 px `honey` border (warm highlight: something happening now), radius 22 (`radius-xl`) |
| List (OC-Recipes › In progress) | padding 10, gap 10. Top part is a link that resumes: photo 60 × 60 radius 14 (peach placeholder without one), name 16/900, line 13/700 ink-muted ("Step 3 of 6 · Gabriel · since 18:40"), then the step bar (Progress › Step bar) 7 below |
| Page (OC-Recipe, under the chips) | padding 14, gap 12, `role="status"`: 40 px honey disc with the `pot` icon (20, ink), title 16/900 ("Cooking now · step 3 of 6"), line 13/600 ink-muted ("Gabriel started at 18:40 · Classic, serves 6") |
| Actions | a row, gap 8, widths 1 : 1 : 1.4: Cancel and Done (`soft` Button), Resume (`ink` Button; the list's with the `play` icon, as drawn), all `sm` (44 tall) |

## States

| State | Look |
| --- | --- |
| Default | as above |
| Pressed | each Button's pressed fill; the list's top part has no fill change (it's a link, focus ring on keyboard) |
| Disabled (offline) | the three Buttons disabled (`on-ink` fill, ink-muted text); the top link doesn't respond |

## Rules

- The design draws the list's buttons 42 tall; they're 44 here, the minimum touch target.
- On the list, each action's screen-reader name says the recipe ("Cancel cooking Leek & bacon quiche"), since several cards can show.
- The step bar is hidden from screen readers; the line says the step.
