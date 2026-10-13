# OC-ScaleIng — Scale by an ingredient (sheet)

Source `screens/OC-ScaleIng.dc.html` · Route `/recipes/[id]/scale` · Spec 013

## Layout
1. Title "Scale by an ingredient"; lead "Only have a certain amount of something? Pick it and enter what you have. Everything else adjusts."
2. "1. Which ingredient?": radio rows (name left, current amount right), the first 3 shown, then the link "Show all {n} ingredients". The selected row has a 2 px olive border.
3. "2. How much do you have?": large number input (22/900) and a unit dropdown (only units that match the ingredient).
4. Sage result card: "Recipe × {factor} → about {servings} servings", then a line with 4 scaled amounts ("Leeks 2½ (375 g) · Eggs 4 (190 g) · …"), then the note (olive-deep 13/700) "Eggs are rounded to whole numbers. Bake time stays the same."
5. Footer: soft "Cancel" and ink "Apply to recipe".

## Dynamic copy
| Case | Copy |
| --- | --- |
| Empty or 0 | result card hidden; Apply disabled; hint under the input "Enter how much you have" |
| Factor < 0.25 or > 4 | warn line in the card: "That's a big change. Check cooking times." |
| No whole items | note shows only "Cooking times stay the same." |

## Interactions
Apply sets the recipe's factor and closes the sheet; the recipe shows the chip "Scaled by {ingredient} · Reset". Cancel or a swipe closes the sheet without changes.
