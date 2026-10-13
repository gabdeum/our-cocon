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

## Validation copy
| Case | Message |
| --- | --- |
| Quantity without a unit | card border warn-border; unit button warn "Unit? ▾"; message "Pick a unit so we can convert and scale it." |
| Removing an ingredient used in steps | Dialog "Remove {name}?" · "It's used in step {n}. We'll take it out of that step too." · danger "Remove" · soft "Cancel" |
| Name not in the catalog | muted sub-line "New ingredient. Pick its aisle:" + aisle dropdown (spec 031) |
| Paste result | StatusBanner "Added {n} ingredients. Check the amounts." |
