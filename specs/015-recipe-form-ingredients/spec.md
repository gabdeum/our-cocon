# Feature Specification: Recipe form — ingredients

**Feature Branch**: `015-recipe-form-ingredients` · **Status**: Ready · **Depends on**: 005, 014, 031
**Catalog**: the name field suggests catalog entries; picking one fills the aisle, the piece sizes (small/medium/large) and the default weight (spec 031).
**Input**: Add, edit, reorder and paste ingredients, with weights for counted items.
**Design**: canvas `OC-EditIngredients`; components Card (`--attention`), TextField (`--sm`, warning), IconButton, Button (dashed, soft).

## User Scenarios & Testing

### User Story 1 — Add ingredients quickly (P1)
**Acceptance**: **Given** I tap "Paste a list" and paste "200 g lardons, 3 eggs, 300 ml cream", **Then** 3 rows appear with quantity, unit and name filled in.

### User Story 2 — Counted items know their weight (P1)
**Given** "2 pieces Leeks", **Then** an "each ≈ ___ g" field appears; with 150 entered, steps show "2 leeks (300 g)". A sensible default weight is suggested for known items.

### User Story 3 — Fix problems before saving (P1)
**Given** a row with a quantity but no unit, **Then** the row gets a warning border and "Pick a unit so we can convert and scale it." Save is blocked and scrolls to the first problem.

### Edge cases
- "Salt and pepper to taste": quantity is empty; allowed without a unit.
- Deleting an ingredient used in steps: warn "Used in step 3. Remove it there too?" with Remove and Cancel.

## Requirements

- **FR-001**: Row fields: name, quantity (decimal or fraction like "1½" or "1/2"), unit (g, kg, ml, l, tsp, tbsp, cup, oz, lb, pieces, pinch), weight per piece (pieces only), and piece noun singular and plural (derived: from the pasted line, else the catalog, else the name; not edited in the form).
- **FR-002**: Rows reorder by drag handle (and Move up/down for accessibility) and delete with ×.
- **FR-003**: The paste parser splits on commas and new lines and understands "200 g lardons", "3 eggs", "1½ cups flour" and "2 small onions". English only in V1; keep the parser's word lists in one module so French can be added later.
- **FR-004**: The header shows "For N servings" (from Details).

## Success Criteria
- **SC-001**: The parser correctly splits 90% of a test set of 100 real-world ingredient lines.

## Tracking (PostHog)
| Event | Properties |
| --- | --- |
| `ingredient_line_added` | parsed (true/false) |

## Warnings and errors
All copy is in the States tables of the UI specs for: OC-EditIngredients. New messages go there and in `strings/en.ts` first.

## Needs your attention
None.

## Changelog
- 2026-10-13: Ready. Decisions 1–34 applied; tracking added.
- 2026-10-20: Built. The Ingredients section of the recipe form per OC-EditIngredients: cards with name, quantity (decimals and fractions), unit list (with small/medium/large for catalog items with sizes) and "each ≈ g" for pieces; drag to reorder (plus Move up/down for screen readers and arrow keys on the web) and ×; "Paste a list" with the parser in `@cocon/quantity` (word lists in `words.en.ts`; 98 of 100 test lines right); catalog suggestions while typing, matching on blur and after a paste (default piece weights), and "New ingredient. Pick its aisle:" saving to the family's ingredients. Save checks Details, then Ingredients, and scrolls to the first warned row. Ingredients save in one call, `save_recipe_ingredients` (new migration), which also takes removed ingredients out of the steps. Piece nouns are derived from the name and editable in advanced mode. New components IngredientEditCard and ReorderList; `labelHidden` on TextField, `scrollEnabled` on FormScreen. Deviations: the remove dialog uses the UI spec's copy ("Remove {name}?" · "It's used in step {n}. We'll take it out of that step too.") instead of this spec's edge-case wording; the drag handle is `ink-muted` (the screen's #A89C78 isn't a token); the unit button's "▾" is the chevron-down icon; a new recipe starts with no rows (no empty state is drawn); one pasted row reads "Added 1 ingredient."; the card's inputs and × are its own (46 tall, radius 12 as drawn) rather than TextField and IconButton, whose sizes differ. Copy written for undrawn states (unit, paste and aisle sheets, suggestions, extra row warnings, noun fields) is in OC-EditIngredients.md.
- 2026-10-21: FR-001 changed with Gabriel: the piece nouns are no longer editable in advanced mode (the "Name for one" and "Name for several" fields are gone). They come from the pasted line ("2 cloves garlic"), else the catalog's noun, else the name; renaming a row drops nouns it had. The catalog's noun is now used (linked garlic saves as "cloves", not "garlics").
- 2026-10-21: With Gabriel: amount fields only take what makes a number (quantity: digits, a point, "/", spaces, "-", ½-style fractions; weight of one: digits and a point), every row field has a placeholder ("Ingredient, like leeks", "Amount", "Unit", "?"), and a new recipe opens with one empty row instead of none.
