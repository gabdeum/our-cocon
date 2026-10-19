# OC-Recipe — Recipe page (Ingredients tab)

Source `screens/OC-Recipe.dc.html` (shared with the Steps tab) · Route `/recipes/[id]` · Specs 008, 013

## Layout
1. Photo header 240: IconButtons "Back to recipes" (left); "Share recipe", "Recipe settings" (right).
2. TimerPill, sticky at the top centre, only when a timer exists.
3. Content sheet: title, description, chips "{time}" (`total_minutes`, hidden when empty), "{cuisine}" (hidden when Other), "Best {Mon} – {Mon}" (hidden if all year), sage "{author} · via {assistant}".
4. "Version": choice pills ("Classic" + each version variant); then a switch row per option variant: title (e.g. "Make my own dough"), hint describing its changes (e.g. "Adds 3 ingredients and 1 step").
5. Servings card: "Servings", Stepper, "More options" square button (…). When open, the panel shows, in order:
   - Switch "I'm using a kitchen scale" with hint "Showing exact weights, like 100 g" / "Showing cups and spoons, like about ¾ cup"
   - Row "Scale by an ingredient ›"
   - Row "Unit converter ›"
   - Row "Units: {Metric|Imperial}" with sub-line "Change in recipe settings ›"
6. Dark tabs: "Ingredients · {n}" | "Steps · {n}".
7. Ingredient rows: amount (17/900), name, optional weight sub-line, optional sage tag "Variant".
8. Outline button with cart icon "Add to groceries…".
9. Ink button 60 with play icon "Start cooking".

## Dynamic copy
- The amount format comes from spec 005 ("2", "300 ml", "about ¾ cup", "1 pinch"), with sub-line weights like "300 g".
- When scaled by an ingredient: a chip under Servings, "Scaled by {ingredient} · Reset".
- Best months: "Best Oct – Mar" for one run (it may wrap round the new year), "Best Apr" for a single month, "Best Jan, May – Jun" for several runs.
- Option hint: "Adds {n} ingredient(s) and {n} step(s)", then ". Removes …" and ". Changes {n} step(s)" when the option does those. A swap counts what it brings in as added.
- A size word moves from the amount into the name: "3" · "Large eggs". A prep note follows the name: "Mushrooms, sliced".

## States not drawn
| State | Copy |
| --- | --- |
| No photo | peach block with the recipe's first letter (32/900, peach-ink) |
| Recipe deleted while open | Dialog-less banner: "This recipe was deleted by {name}." with link "Back to recipes" |
| Loading | photo and three-row skeleton (screen reader: "Loading recipe") |
| Couldn't load (nothing cached) or not found | "We couldn't open this recipe." / "It may have been deleted, or you're offline." with soft button "Try again" |

## Interactions
| Element | Result |
| --- | --- |
| Back | → previous screen |
| Share | → share sheet |
| Recipe settings | → `/recipes/[id]/settings` |
| Version pill / option switch | applies the variant (spec 017), updates ingredients, steps and counts |
| − / + | servings 1–16, live update |
| … | toggles the panel (button turns honey) |
| Scale by an ingredient | → scale sheet |
| Unit converter | → convert sheet |
| Units row | → recipe settings |
| Tabs | switch Ingredients / Steps in place, keeping scroll |
| Add to groceries… | → add-to-groceries sheet |
| Start cooking | → `/recipes/[id]/cook` |
