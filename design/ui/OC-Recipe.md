# OC-Recipe — Recipe page (Ingredients tab)

Source `screens/OC-Recipe.dc.html` (shared with the Steps tab; at 430 wide, in progress: `screens/OC-RecipeWide.dc.html`) · Route `/recipes/[id]` · Specs 008, 013, 051

## Layout
1. Photo header 240 under the TopBar (spec 050, `titleMode="onScroll"`): round "Back to recipes" (left); "Share recipe" and "Edit recipe" (pencil) (right). The bar is see-through over the photo, turns `surface-page` with its hairline once the photo has scrolled away, and the recipe name fades into it once the title is under it.
2. TimerPill, sticky at the top centre, only when a timer exists.
3. Content sheet: title, description, chips "{time}" (`total_minutes`, hidden when empty), "{cuisine}" (hidden when Other), "Best {Mon} – {Mon}" (hidden if all year), then the sage Source chip with a book icon (spec 051 FR-015; as OC-Recipes › Source line, never "via").
   - Meta line under the chips: "Cooked {n} times · last by {member}, {relative}", or "Cooked once · {relative}"; none when it was never cooked. {relative} is "today", "yesterday", "{n} days ago", "{n} weeks ago", "{n} months ago" or "over a year ago".
   - While someone is cooking it, the in-progress card under the meta line (role status): a honey disc with a pot icon, "Cooking now · step {k} of {n}", "{member} started at {HH:mm} · {variant}, serves {n}" ("{member} started at {HH:mm} · Serves {n}" with no version; "{member} started yesterday · …" after a day), then Cancel · Done · Resume (44 tall).
4. "Version": choice pills ("Classic" + each version variant); then a switch row per option variant: title (e.g. "Make my own dough"), hint describing its changes (e.g. "Adds 3 ingredients and 1 step").
5. Servings card: "Servings", Stepper, "More options" square button (…). When open, the panel shows, in order:
   - Switch "I'm using a kitchen scale" with hint "Showing exact weights, like 100 g" / "Showing cups and spoons, like about ¾ cup"
   - Row "Scale by an ingredient ›"
   - Row "Unit converter ›"
   - Link row "Units: {Metric|Imperial}" with the sub-line "Change in Edit › This recipe"
6. Dark tabs: "Ingredients · {n}" | "Steps · {n}".
7. Ingredient rows: amount (17/900), name, then the detail on its own line when it has one ("grated"; 13/600 ink-soft `#7A6F55`, line-height 1.35), then the optional weight sub-line, optional sage tag "Variant".
8. A sticky action bar at the bottom (on both tabs), on a cream fade, padding 14/16/28 (spec 051 FR-014):
   - Cart button 60: icon only, named "Add to groceries" for screen readers; from 430 px wide it shows the icon and "Add to groceries".
   - Then the main ink button (the rest of the width) with a play icon: "Start recipe", "Resume · step {k}" while it's in progress, or "Done cooking" when the cook is on its last step.
   At 390 the cart and "Resume · step 10" fit without wrapping.

## Dynamic copy
- The amount format comes from spec 005 ("2", "300 ml", "about ¾ cup", "1 pinch"), with sub-line weights like "300 g".
- When scaled by an ingredient: Servings shows the scaled number to the nearest ½ ("7½"), and a sage chip under Servings reads "Scaled by {ingredient}" (name in lower case, "bacon lardons") with a "Reset" link beside it (screen reader: "Reset the scale by {ingredient}").
- The kitchen scale is a quick toggle for this recipe on this device. Until it's toggled, the recipe's or family's setting applies (spec 027); toggling it overrides that setting on this device only.
- Units follow the recipe's own setting, else the family's (spec 027); they change amounts, weights and temperatures in the list, the steps and cooking mode. A Metric · Imperial choice saved on a device before spec 051 no longer counts. "Units: {x}" names the units in force.
- Best months: "Best Oct – Mar" for one run (it may wrap round the new year), "Best Apr" for a single month, "Best Jan, May – Jun" for several runs.
- Option hint: "Adds {n} ingredient(s) and {n} step(s)", then ". Removes …" and ". Changes {n} step(s)" when the option does those. A swap counts what it brings in as added.
- The default size is never named ("2½" · "Leeks"); another size moves from the amount into the name: "2" · "Small eggs".
- A volume shows its weight as the sub-line when the density is known: "350 ml" · "Heavy cream" · "350 g".
- Names read without brackets: "Onion (sauce)" reads "Onion".
- Rows of one ingredient (same catalog item, or the same name read that way) are one line with their amounts added: "Onion (sauce)" 1 and "Onion (topping)" 2 read "3" · "Onion". When they don't add up (a weight and a volume with no density), the amounts sit side by side: "100 g + 250 ml". The line has the Variant tag when any of its rows comes from a variant, and the Ingredients tab counts lines.

## States not drawn
| State | Copy |
| --- | --- |
| No photo | peach block with the recipe's first letter (32/900, peach-ink) |
| Recipe deleted while open | Dialog-less banner: "This recipe was deleted by {name}." with link "Back to recipes" |
| Loading | photo and three-row skeleton (screen reader: "Loading recipe") |
| Couldn't load (nothing cached) or not found | "We couldn't open this recipe." / "It may have been deleted, or you're offline." with soft button "Try again" |
| Offline | the in-progress card's Cancel, Done and Resume are off |
| Done or Cancel failed | toast warn "Couldn't save. Check your connection and try again." |

## Interactions
| Element | Result |
| --- | --- |
| Back | → previous screen |
| Share | → share sheet |
| Edit | → `/recipes/[id]/edit?section=details` |
| Version pill / option switch | applies the variant (spec 017), updates ingredients, steps and counts |
| − / + | servings 1–16, live update |
| … | toggles the panel (button turns honey) |
| Scale by an ingredient | → scale sheet |
| Unit converter | → convert sheet |
| Kitchen scale switch | weights ↔ cups and spoons at once, on this device |
| Units: {x} | → the recipe form at This recipe (`…/edit?section=details&focus=this-recipe`) |
| Reset (scaled chip) | back to the servings from before the scale |
| − / + while scaled | from 7½: − to 7, + to 8; the scale ends |
| Tabs | switch Ingredients / Steps in place, keeping scroll |
| Cart | → add-to-groceries sheet |
| Start recipe | → cooking mode at step 1 (`/recipes/[id]/cook`); when someone is already cooking it, the sheet below first |
| Resume · step {k} / card Resume | → cooking mode at the cook's step, with its servings and version |
| Done cooking / card Done | logs it as cooked and opens the Done sheet (OC-CookDone) |
| Card Cancel | ends the cook (not counted); toast "Cancelled" with "Undo" |

## Already being cooked (not drawn)
"Start recipe" while a cook of this recipe is open (started on another phone a moment ago, before the page caught up): a BottomSheet titled "{member} is cooking this (step {k})" ("You're cooking this (step {k})" when it's yours), lead "Pick up where it is, or start again from step 1.", buttons "Resume {member}'s" ("Resume" when it's yours) and "Start over". Start over cancels the open cook and starts a new one at step 1.

## Screen readers (spec 030)
- The header photo: "Photo of {recipe}".
- Servings −/+ say the new count: "5 servings", "7½ servings", "1 serving".
- The Source chip: "Source: {source}". The cart: "Add to groceries".

## Changelog
- 2026-11-12 (051): top bar Back · Share · Edit (no Recipe settings); Source chip; "Cooked …" meta line; in-progress card; ingredient detail line; "Units: {x}" link row; sticky action bar (cart + "Start recipe" / "Resume · step {k}" / "Done cooking") replaces "Add groceries" · "Start cooking".
