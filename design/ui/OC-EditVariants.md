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
