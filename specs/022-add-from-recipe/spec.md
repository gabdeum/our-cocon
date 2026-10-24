# Feature Specification: Add groceries from a recipe

**Feature Branch**: `022-add-from-recipe` · **Status**: Ready · **Depends on**: 008, 020, 021
**Input**: Pick which of a recipe's ingredients to add to groceries. There's no pantry: every ingredient starts ticked and you untick what you already have.
**Design**: `design/ui/OC-AddGroceries.md`, `design/screens/OC-AddGroceries.dc.html`

## User Scenarios & Testing

### User Story 1 — Only add what I need (P1)
**Acceptance**: **Given** the quiche for 6, **When** I open "Add to groceries…", **Then** all 8 ingredients are ticked with their amounts and the button reads "Add 8 items". When I untick butter, eggs and nutmeg, it reads "Add 5 items".

### User Story 2 — No duplicates (P1)
**Given** 100 ml cream already on the list, **Then** the cream row says "Already on the list (100 ml) → will be 400 ml", and adding updates that item instead of creating a second one.

### User Story 3 — Confirm and undo (P1)
**Given** I tap Add, **Then** the sheet shows "Added 5 items to groceries" with Undo, "Back to recipe" and "See the list".

### Edge cases
- Nothing ticked: the button reads "Nothing selected" and is disabled.
- Quantities follow the recipe page's current servings and variants.
- Ingredients with no quantity ("Salt and pepper") are listed and added as plain items.

## Requirements

- **FR-001**: Every ingredient is ticked by default. No pantry list is stored or learned in V1.
- **FR-002**: Merging matches on catalog key (spec 031), or on normalised name for custom ingredients, with compatible units; amounts are summed with `@cocon/quantity`.
- **FR-003**: Added items carry `recipe_id` so they show "For Leek & bacon quiche".
- **FR-004**: Undo removes exactly the added items and reverts the merges.

## Success Criteria
- **SC-001**: Adding the same recipe twice never creates duplicate rows (test).

## Tracking (PostHog)
| Event | Properties |
| --- | --- |
| `groceries_added_from_recipe` | ingredient_count, unticked_count |
| `grocery_recipe_removed` | item_count |
| `grocery_recipe_servings_changed` | from, to |

## Warnings and errors
All copy is in the States tables of the UI specs for: OC-AddGroceries. New messages go there and in `strings/en.ts` first.

## Needs your attention
None.

## Changelog
- 2026-10-13: Ready. Decisions 1–34 applied; tracking added.
- 2026-10-22: Built. "Add to groceries…" opens the sheet at `/recipes/[id]/add-to-groceries` with every ingredient ticked at the page's servings (or scale by an ingredient), variants and units; "Add {n} items" / "Add 1 item" / disabled "Nothing selected"; merge notes "Already on the list ({existing}) → will be {total}"; success state with Undo, "Back to recipe" and "See the list". Merging (FR-002) is `planGroceryAdds` in `@cocon/quantity`, planned against the list as it is when Add is pressed, so two lines of the same thing make one row and a second add only updates (SC-001); pinches now merge with pinches. Undo clears the added rows (the usual soft delete) and puts merged items back. Also did 032-later L39: `grocery_items.from_recipe`, set by the database, so items read "From a deleted recipe" once their recipe is in Recently deleted or purged. Deviations: an unticked row's name is ink-muted, not the drawn faint colour (too light to read, constitution IV); volumes show without their weight here ("300 ml"), as drawn, while counted items keep theirs ("2 · 300 g"); counts go on the list rounded up to whole ones ("1⅓ leeks" → 2); copy written for states not drawn (adding, add or undo failed, offline) is in OC-AddGroceries.md. `grocery_item_added` isn't sent per item: `groceries_added_from_recipe` is the one event.
- 2026-10-22 (after Gabriel's test): the list shows one row per thing still to buy, whoever added it (my 11 apples and the crumble's 600 g read "Apple: 15 pieces · For Classic French apple crumble · Added by Mia"), with amounts added up through the catalog (`combineAmounts` in `@cocon/quantity`, "11 pieces + 600 g" when they don't convert); a row ticks, is removed and is edited as one. Rows are in alphabetical order in each aisle. The sheet has "Untick all" / "Tick all" and its notes read as the combined row will. Fixed: after adding, "See the list" left the sheet over Groceries and nothing could be tapped; the sheet now goes away before leaving, and "See the list" uses `dismissTo`. The crumble's apples (saved in grams, shown as 3½) now show their weight in the sheet. OC-Groceries.md and OC-AddGroceries.md updated. From the review: Edit of a row whose amounts don't add up to one changes only its first item; the clear events (`done_items_cleared`, `all_items_cleared`, `clear_done_undone`) now count rows, as the screen does.
- 2026-10-22 (after Gabriel's second test): adding apples to Mia's apples merged into her item, so the row read only "Added by Mia". Now an add merges only into the same person's item (or, from a recipe, that recipe's), and each keeps its own source; the row combines them and reads "Added manually" when several people typed it in. Typing something already on the list still says "Already on the list. Updated to {row total}." FR-002 deviation: a recipe's lines no longer merge into someone's own item, only show with it as one row; SC-001 still holds per recipe.
- 2026-10-23: Rows of one ingredient are one line in the sheet, with their total, named as the recipe page shows them (no brackets or prep note); when the amounts don't add up, each keeps its line.
- 2026-10-24: With Gabriel: the recipe card menu on the grocery list (the card's vertical "…"): "Open recipe"; "Servings" with a Stepper, where "Save for {n}" rescales the recipe's items still to buy by new ÷ old (counts round up; ticked items stay; `rescaleGroceryAmount` in `@cocon/quantity`, which shares `groceryQuantity` with the add); and "Remove its items" (all of them, with Undo). New table `grocery_recipes` (servings per recipe per family, live, RLS, never deleted by people, a row's recipe never changes, purged with the recipe; assistants have no access until 024), backfilled with each listed recipe's own servings. "Add to groceries…" records the servings (whole, 8 after a scale to 7½): added to the stored ones while the recipe still has items on the list, started again otherwise; Undo puts them back. The card reads "serves {n}" from it. Events `grocery_recipe_removed`, `grocery_recipe_servings_changed`. Rescaling from rounded counts can drift by one (1 leek for 4 → 2 servings → 4 servings reads 2 leeks). OC-Groceries.md › Recipe card menu.
