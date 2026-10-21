# OC-RecipeSettings — Recipe settings

Source `screens/OC-RecipeSettings.dc.html` · Route `/recipes/[id]/settings` · Specs 027, 017

## Layout
1. Back link: "{recipe name}".
2. Title "Recipe settings"; lead "These only change this recipe. Your family defaults are in Settings."
3. **(Add, not drawn)** a ListRow "Edit recipe ›" opening the edit modal at Details.
4. Settings card, each row a Switch row:
   - "Keep screen on"
   - "I'll use a kitchen scale", hint "Shows “100 g” instead of “about 1 cup”"
   - "Thermometer checks"
   - "Units": segmented "Default" · "Metric" · "Imperial"
   Each switch's hint reads "Same as default" or, in warn, "Changed for this recipe · Reset".
5. "Variants" heading with the link "Edit"; lead "Variants are versions of this recipe. They swap ingredients or add steps without making a copy."
6. One card per variant: an icon tile (sage swap icon for versions, honey plus icon for options), name, a one-line summary of its changes ("Replaces bacon lardons with 250 g sliced mushrooms").
7. Dashed button "Add a variant".

## Interactions
Switches save instantly. Reset clears the override. "Edit", a variant card and "Add a variant" open the edit modal at Variants.

## Not drawn (spec 017 build)
| Where | Copy |
| --- | --- |
| Variant line | the changes in order, joined by " · ", first letter capital: "replaces {old} with {amount name}" (or "with {n} ingredients"), "adds {amount name}", "removes {name}", "adds step “{name}”", "changes step {n}", "removes step {n}"; none: "No changes yet". Changes pointing at something removed are left out. |
| Card, screen reader | "{name}. {line}. Tap to edit." |
| "Edit", screen reader | "Edit variants" |
| Loading | "Loading recipe settings" (skeleton) |
| Couldn't load | "We couldn't open this recipe." · "It may have been deleted, or you're offline." · "Try again" |

Links: "Edit" → `…/edit?section=variants`; a card → `&variant={id}` (opens it); "Add a variant" → `&variant=new` (starts one).
