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

- **FR-001**: Row fields: name, quantity (decimal or fraction like "1½" or "1/2"), unit (g, kg, ml, l, tsp, tbsp, cup, oz, lb, pieces, pinch), weight per piece (pieces only), and piece noun singular and plural (auto-derived, editable in advanced mode).
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
