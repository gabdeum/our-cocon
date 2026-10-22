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

## Warnings and errors
All copy is in the States tables of the UI specs for: OC-AddGroceries. New messages go there and in `strings/en.ts` first.

## Needs your attention
None.

## Changelog
- 2026-10-13: Ready. Decisions 1–34 applied; tracking added.
- 2026-10-22: Built. "Add to groceries…" opens the sheet at `/recipes/[id]/add-to-groceries` with every ingredient ticked at the page's servings (or scale by an ingredient), variants and units; "Add {n} items" / "Add 1 item" / disabled "Nothing selected"; merge notes "Already on the list ({existing}) → will be {total}"; success state with Undo, "Back to recipe" and "See the list". Merging (FR-002) is `planGroceryAdds` in `@cocon/quantity`, planned against the list as it is when Add is pressed, so two lines of the same thing make one row and a second add only updates (SC-001); pinches now merge with pinches. Undo clears the added rows (the usual soft delete) and puts merged items back. Also did 032-later L39: `grocery_items.from_recipe`, set by the database, so items read "From a deleted recipe" once their recipe is in Recently deleted or purged. Deviations: an unticked row's name is ink-muted, not the drawn faint colour (too light to read, constitution IV); volumes show without their weight here ("300 ml"), as drawn, while counted items keep theirs ("2 · 300 g"); counts go on the list rounded up to whole ones ("1⅓ leeks" → 2); copy written for states not drawn (adding, add or undo failed, offline) is in OC-AddGroceries.md. `grocery_item_added` isn't sent per item: `groceries_added_from_recipe` is the one event.
