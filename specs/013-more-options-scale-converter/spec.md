# Feature Specification: More options — kitchen scale, scale by ingredient, unit converter

**Feature Branch**: `013-more-options-scale-converter` · **Status**: Ready · **Depends on**: 005, 008
**Input**: The "…" panel under Servings and its two sheets.
**Design**: canvas `OC-Recipe` (panel), `OC-ScaleIng`, `OC-Units`; components IconButton (`--square`), Switch, ListRow, BottomSheet, SegmentedControl, TextField, Callout.

## User Scenarios & Testing

### User Story 1 — No scale at home (P1)
**Acceptance**: **Given** I open "…" and turn off "I'm using a kitchen scale", **Then** weights with a cup weight become cups and spoons ("about ¾ cup flour"), pieces drop their weight, and the hint changes to "Showing cups and spoons, like about ¾ cup".

### User Story 2 — I only have 250 g of lardons (P1)
**Acceptance**:
1. **Given** the sheet, **When** I pick Bacon lardons and enter 250 g, **Then** the preview reads "Recipe × 1.25 → about 7½ servings" with a few scaled amounts.
2. **When** I tap "Apply to recipe", **Then** the page uses factor 1.25, servings shows 7½, and a chip "Scaled by lardons · Reset" appears.

### User Story 3 — Quick conversion (P2)
**Given** the converter on Volume with 300 ml, **Then** it shows 1¼ cups, 20 tbsp, 61 tsp and 10.1 fl oz, plus a note for this recipe: "300 ml heavy cream weighs about 300 g."

### Edge cases
- Eggs and other whole items round to whole numbers when scaling by ingredient, and the preview says so.
- Entering 0 or nothing disables Apply with the hint "Enter how much you have".
- A unit that doesn't match the ingredient (ml for lardons) only offers matching units.

## Requirements

- **FR-001**: The panel opens inline under Servings, with the "…" button in honey while open. Rows: kitchen-scale switch, "Scale by an ingredient ›", "Unit converter ›", "Units: Metric › Change in recipe settings".
- **FR-002**: The kitchen-scale choice applies to this recipe on this device and starts from the recipe or family setting (spec 027).
- **FR-003**: Scale by ingredient lists 3 ingredients plus "Show all N ingredients"; pinch ingredients are excluded.
- **FR-004**: Converter tabs: Weight, Volume, Oven temp, with a unit dropdown and 4 result tiles (the first in honey).
- **FR-005**: Converter results use `@cocon/quantity` only.

## Success Criteria
- **SC-001**: All conversions match spec 005's test tables.

## Tracking (PostHog)
| Event | Properties |
| --- | --- |
| `kitchen_scale_toggled` | on |
| `scaled_by_ingredient` | — |
| `unit_converter_used` | from_unit, to_unit |

## Warnings and errors
All copy is in the States tables of the UI specs for: OC-Recipe, OC-ScaleIng, OC-Units. New messages go there and in `strings/en.ts` first.

## Needs your attention
None.

## Changelog
- 2026-10-13: Ready. Decisions 1–34 applied; tracking added.
