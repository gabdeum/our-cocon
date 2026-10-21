# OC-EditIngredients — Recipe form: Ingredients

Source `screens/OC-EditIngredients.dc.html` · Route `…/edit?section=ingredients` · Specs 015, 031

## Layout
1. Title "Ingredients"; right "For {n} servings".
2. Lead "For things you count (eggs, leeks), add the weight of one too. Then steps can show both: “2 leeks (300 g)”."
3. One white card per ingredient:
   - drag handle, name input (with catalog suggestions, spec 031), remove "×" ("Remove {name}")
   - quantity input, unit dropdown, and for pieces the "each ≈ {g} g" field, prefilled from the catalog's medium size
   - for catalog items with sizes, the unit dropdown offers "small", "medium", "large" pieces (e.g. "1 small onion")
4. Buttons: dashed "+ Add ingredient" and soft "Paste a list".
5. Hint "Tip: paste “200 g lardons, 3 eggs…” and we'll split it into rows."
6. Ink "Next: Steps".

## Interactions (spec 015; not drawn)
- **Unit button:** opens a BottomSheet titled "Unit" with choice pills: "No unit", g, kg, ml, L, tsp, tbsp, cup, oz, lb, pieces, pinch, then "small", "medium", "large" when the catalog has sizes. Picking one closes it. With no unit yet, the button reads "Unit ▾" (muted).
- **Suggestions:** while a name is typed (2 letters or more), up to 5 catalog names show under it, in a list read as "Suggestions". Tapping one fills the name and links the row to the catalog.
- **Paste a list:** a BottomSheet titled "Paste a list" with the field "Your ingredients", hint "One per line, or separated by commas.", and ink "Add ingredients". A comma part that only says how to prepare ("finely chopped", "to taste") stays with its line.
- **Aisle:** "New ingredient. Pick its aisle:" is followed by an olive link "Pick an aisle" (or the aisle picked), opening a BottomSheet titled "Aisle" with the aisles in store order (OC-Groceries › Aisles).
- **Advanced mode, pieces:** two small fields under the name, "Name for one" and "Name for several", with what we'd use as placeholders ("leek", "leeks").
- **Reorder:** drag the handle (screen-reader name "Drag to reorder"); screen readers also get the actions "Move up" and "Move down", and the arrow keys move the row on the web.
- **Remove:** "×" removes the row at once unless a step uses it (then the dialog below).
- Fields are labelled for screen readers only: "Ingredient name", "Quantity", "Unit", "Weight of one (g)". A row with no name yet has the remove label "Remove ingredient".

## Validation copy
| Case | Message |
| --- | --- |
| Quantity without a unit | card border warn-border; unit button warn "Unit? ▾"; message "Pick a unit so we can convert and scale it." |
| Removing an ingredient used in steps | Dialog "Remove {name}?" · "It's used in step {n}. We'll take it out of that step too." · danger "Remove" · soft "Cancel" |
| Name not in the catalog | muted sub-line "New ingredient. Pick its aisle:" + aisle dropdown (spec 031) |
| Paste result | StatusBanner "Added {n} ingredients. Check the amounts." |
| Removing an ingredient used in several steps | Dialog "Remove {name}?" · "It's used in steps {2 and 4}. We'll take it out of those steps too." · danger "Remove" · soft "Cancel" |
| Quantity unreadable | quantity field warn; "Type an amount like 2, 1½ or 1/2." |
| A unit but no quantity | quantity field warn; "Add an amount, or pick “No unit”." |
| Weight of one unreadable | "each ≈" box warn; "Type the weight of one in grams, like 150." |
| An amount but no name | name field warn; "Give this ingredient a name." |
| Paste added one row | StatusBanner "Added 1 ingredient. Check the amounts." |
| Paste found nothing | StatusBanner "We couldn't find any ingredients in that." |

Save checks Details first, then Ingredients: with a problem, it opens Ingredients and scrolls to the first warned row. Rows left completely empty are dropped.
