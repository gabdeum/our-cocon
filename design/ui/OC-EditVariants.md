# OC-EditVariants — Recipe form: Variants

Source `screens/OC-EditVariants.dc.html` · Route `…/edit?section=variants` · Spec 017

## Layout
1. Title "Variants (optional)"; lead "A variant changes a few things in the recipe. People pick it with one tap on the recipe page."
2. Collapsed variant rows: name, "{n} change(s)", chevron.
3. The expanded variant (2 px olive border):
   - "Variant name" input
   - **(add, not drawn)** "Shown as": segmented "A version (pick one)" · "An option (on/off)"
   - "What changes": one block per change, with a type tag (honey "Replace ingredient" / sage "Add step · before step 1") and a summary ("~~Shortcrust pastry~~ → 200 g flour, 100 g cold butter, 50 ml ice water")
   - "Add a change": buttons "Swap ingredient", "Add ingredient", "Remove ingredient", "Add a step", "Change a step", "Remove a step"; each opens an inline editor reusing the ingredient and step editors
4. Dashed "+ New variant".
5. Ink "Save recipe".
6. Danger link with trash icon "Delete this recipe" (edit mode only) → delete dialog.

## Validation copy
| Case | Message |
| --- | --- |
| Name empty | "Give this variant a name" |
| Variant with no changes | "Add at least one change, or delete this variant" |
| Conflict | warn line "Also changed by “{other variant}”" |
| Broken change | warn line "This change points to something that was removed." + "Remove change" |

## Not drawn (spec 017 build)
Copy written for states and editors the screen doesn't draw; it lives in `strings/en.ts` › `recipeForm.variants`.

| Where | Copy |
| --- | --- |
| Collapsed row, screen reader | "{name}, {n} change(s). Tap to edit." |
| Name placeholder | "Like Vegetarian" |
| Change tags | honey "Replace ingredient", sage "Add ingredient", honey "Remove ingredient", sage "Add step · before/after step {n}", honey "Change step {n}", honey "Remove step {n}"; a step that's gone: "Step removed" |
| Summaries | swap "~~{old}~~ → {amounts and names}"; add "{amount} {name}"; remove "~~{name}~~"; add step "{name} · {30 min} timer"; change step "“{new text}” · {25 min} timer · No timer · Temperature check {reading} · No temperature check"; nothing yet "Nothing changed yet" |
| Change editor | heading = the tag; pickers "Which ingredient?" / "Which step?" (radio list, "Step {n} · {name}"); "Where": "Before" · "After"; "Replace with" + ingredient rows + "+ Add another ingredient"; "New step" (name, Instructions, Timer, Temperature check, Chef's tip); "The step with this variant" (Instructions, Timer, Temperature check); soft "Done" and danger link "Remove change". Nothing to pick: "Add ingredients to the recipe first." / "Add steps to the recipe first." |
| Change warnings | "Pick the ingredient this changes" · "Pick the step this changes" · "Add what goes in its place" · "Name the ingredient to add" · "Write the step, or remove this change" · "Change something in the step, or remove this change" · "Check the ingredients below" · "Check the step below" |
| Delete a variant | danger link "Delete this variant" → Dialog "Delete this variant?" · "Its changes go with it. Nothing is saved until you tap Save." · "Delete" · "Keep it" |

Variant ingredient rows are matched against the catalog like the Ingredients section's (suggestions while typing, matching on blur), but never ask for an aisle.
