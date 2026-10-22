# OC-AddGroceries — Add to groceries (sheet)

Source `screens/OC-AddGroceries.dc.html` · Route `/recipes/[id]/add-to-groceries` · Spec 022

## Layout
1. Title "Add to groceries"; lead "{recipe name} · serves {n}. Untick what you already have at home."; on the right of the title, an olive link "Untick all" (when anything is ticked) or "Tick all" (when nothing is). Not drawn; added at Gabriel's request.
2. One list group, overline "From this recipe", right note "All ticked to start". One checkbox row per ingredient (current servings, variants and units): name, amount on the right.
   - When the item is already on the grocery list, the sub-line (warn 13/700) reads "Already on the list ({existing}) → will be {total}", with the amounts as the list's combined row will show them ("Already on the list (6 pieces) → will be 9 pieces").
3. Footer: soft "Cancel" (110 wide) and ink "Add {n} items".

## Dynamic copy
| Case | Button |
| --- | --- |
| n = 1 | "Add 1 item" |
| n = 0 | disabled "Nothing selected" |

## Success state (same sheet)
Sage disc with check · "Added {n} items to groceries" · "The whole family can see them now." · underlined "Undo" · buttons soft "Back to recipe" and ink "See the list".

## States not drawn
| State | Copy |
| --- | --- |
| Unticked row | name in ink-muted (not the drawn faint colour, which is too light to read), no strike-through, no merge note |
| Adding | the Add button keeps its width and reads "Adding…" |
| Add failed | Callout warn "Couldn't add these items. Check your connection and try again."; the ticks stay as they were |
| Undo failed | Callout warn "Couldn't undo. Try again." over the success state |
| Offline | the offline StatusBanner; the list stays readable, the Add button is off |
| Leaving | "Back to recipe", "See the list", Cancel and the scrim take the sheet away before the next screen shows |

## Rules
- Every ingredient starts ticked; there's no pantry. Untick what you have.
- Items with no quantity ("Salt and pepper") are listed with no amount, ticked like the rest.
- Amounts follow the recipe page (servings, scale by an ingredient, version and options, units). Counted items show their weight ("2 · 300 g"); the list gets whole counts, rounded up.
