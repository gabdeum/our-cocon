# OC-AddGroceries — Add to groceries (sheet)

Source `screens/OC-AddGroceries.dc.html` · Route `/recipes/[id]/add-to-groceries` · Spec 022

## Layout
1. Title "Add to groceries"; lead "{recipe name} · serves {n}. Untick what you already have at home."
2. One list group, overline "From this recipe", right note "All ticked to start". One checkbox row per ingredient (current servings, variants and units): name, amount on the right.
   - When the item is already on the grocery list, the sub-line (warn 13/700) reads "Already on the list ({existing}) → will be {total}".
3. Footer: soft "Cancel" (110 wide) and ink "Add {n} items".

## Dynamic copy
| Case | Button |
| --- | --- |
| n = 1 | "Add 1 item" |
| n = 0 | disabled "Nothing selected" |

## Success state (same sheet)
Sage disc with check · "Added {n} items to groceries" · "The whole family can see them now." · underlined "Undo" · buttons soft "Back to recipe" and ink "See the list".

## Rules
- Every ingredient starts ticked; there's no pantry. Untick what you have.
- Items with no quantity ("Salt and pepper") are listed with no amount, ticked like the rest.
