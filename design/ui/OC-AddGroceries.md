# OC-AddGroceries — Add to groceries (sheet)

Source `screens/OC-AddGroceries.dc.html` · Route `/recipes/[id]/add-to-groceries` · Specs 022, 051

## Layout
1. Title "Add to groceries"; lead "{recipe name} · serves {n}. Untick what you already have at home."; on the right of the title, an olive link "Untick all" (when anything is ticked) or "Tick all" (when nothing is). Not drawn; added at Gabriel's request.
2. One list group, overline "From this recipe", right note "All ticked to start". One checkbox row per ingredient (current servings, variants and units): name, amount on the right.
   - When the ingredient has a detail, "In recipe: {detail}" under the name (13/600 ink-soft; spec 051 FR-010).
   - When the item is already on the grocery list, a sub-line of its own (warn 13/700) reads "Already on the list ({existing}) → will be {total}", with the amounts as the list's combined row will show them ("Already on the list (6 pieces) → will be 9 pieces").
3. Footer: soft "Cancel" (110 wide) and ink "Add {n} items".

## Dynamic copy
| Case | Button |
| --- | --- |
| n = 1 | "Add 1 item" |
| n = 0 | disabled "Nothing selected" |

## Once added
Add closes the sheet at once. While the items are being added, the grocery list shows the recipe's card at the top with "Adding {n} items…" (announced politely, no "…" menu) and up to 3 skeleton rows under it (OC-Groceries). Once they're in, a toast (Toast README) says "Added {n} items to groceries", with a text button "See the list" (→ Groceries), round Undo and ✕. No success state in the sheet.

## States not drawn
| State | Copy |
| --- | --- |
| Unticked row | name in ink-muted (not the drawn faint colour, which is too light to read), no strike-through, no merge note |
| Adding | the sheet has closed; the grocery list shows the recipe's pending card (above) |
| Add failed | warn toast "Couldn't add these items. Check your connection and try again." with Try again, which adds the same items again |
| Undo failed | warn toast "Couldn't undo. Try again." |
| Offline | the offline StatusBanner; the list stays readable, the Add button is off |
| Leaving | Add (once saved), Cancel and the scrim take the sheet away before the next screen shows |

## Rules
- Every ingredient starts ticked; there's no pantry. Untick what you have.
- Items with no quantity ("Salt and pepper") are listed with no amount, ticked like the rest.
- Amounts follow the recipe page (servings, scale by an ingredient, version and options, units). Counted items show their weight ("2 · 300 g"); the list gets whole counts, rounded up.

## Changelog
- 2026-11-12 (051 FR-010): "In recipe: {detail}" under the name; the merge note stays its own line.
- 2026-11-17 (Gabriel's ask): the success state is replaced by a toast, "Added {n} items to groceries" · See the list · Undo · ✕; "Back to recipe" and "The whole family can see them now." removed.
- 2026-11-25 (Gabriel): Add closes the sheet at once; the list shows the recipe's card with "Adding {n} items…" and skeleton rows until the items are in; the toast follows. A failure is a warn toast with Try again.
