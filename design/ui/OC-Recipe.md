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
   - Row "Units" with a pill SegmentedControl "Metric" · "Imperial"
6. Dark tabs: "Ingredients · {n}" | "Steps · {n}".
7. Ingredient rows: amount (17/900), name, optional weight sub-line, optional sage tag "Variant".
8. A footer bar fixed at the bottom (on both tabs), in reach wherever the page is scrolled, with two buttons side by side, half each, with no icons: outline 60 "Add groceries" (left) and ink 60 "Start cooking" (right). Both fit at 390 wide. On a narrower screen (or larger text), when either label doesn't fit on one line, both read short, "Groceries" and "Cook"; labels never wrap or get cut. Screen readers always hear "Add groceries" and "Start cooking".

## Dynamic copy
- The amount format comes from spec 005 ("2", "300 ml", "about ¾ cup", "1 pinch"), with sub-line weights like "300 g".
- When scaled by an ingredient: Servings shows the scaled number to the nearest ½ ("7½"), and a sage chip under Servings reads "Scaled by {ingredient}" (name in lower case, "bacon lardons") with a "Reset" link beside it (screen reader: "Reset the scale by {ingredient}").
- The kitchen scale and units are quick toggles for this recipe on this device. Until one is toggled, the recipe's or family's setting applies (spec 027); toggling it overrides that setting on this device only. Units change amounts, weights and temperatures at once, in the list, the steps and cooking mode.
- Best months: "Best Oct – Mar" for one run (it may wrap round the new year), "Best Apr" for a single month, "Best Jan, May – Jun" for several runs.
- Option hint: "Adds {n} ingredient(s) and {n} step(s)", then ". Removes …" and ". Changes {n} step(s)" when the option does those. A swap counts what it brings in as added.
- The default size is never named ("2½" · "Leeks"); another size moves from the amount into the name: "2" · "Small eggs".
- A volume shows its weight as the sub-line when the density is known: "350 ml" · "Heavy cream" · "350 g".
- Names read without brackets or what follows a comma: "Onion (sauce)" and "Mushrooms, sliced" read "Onion" and "Mushrooms". How it's prepared shows in the step instead ("250 g mushrooms, sliced").
- Rows of one ingredient (same catalog item, or the same name read that way) are one line with their amounts added: "Onion (sauce)" 1 and "Onion (topping)" 2 read "3" · "Onion". When they don't add up (a weight and a volume with no density), the amounts sit side by side: "100 g + 250 ml". The line has the Variant tag when any of its rows comes from a variant, and the Ingredients tab counts lines.

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
| Kitchen scale switch | weights ↔ cups and spoons at once, on this device |
| Metric · Imperial | switches units at once, on this device |
| Reset (scaled chip) | back to the servings from before the scale |
| − / + while scaled | from 7½: − to 7, + to 8; the scale ends |
| Tabs | switch Ingredients / Steps in place, keeping scroll |
| Add groceries | → add-to-groceries sheet |
| Start cooking | → `/recipes/[id]/cook` |
