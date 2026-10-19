# Feature Specification: Recipe page — header, version, servings and ingredients

**Feature Branch**: `008-recipe-page-ingredients` · **Status**: Ready · **Depends on**: 005, 006
**Input**: The recipe page with its photo header, variant choice, servings and ingredient list.
**Design**: canvas `OC-Recipe`; Patterns.md "Pushed screen with photo header"; components IconButton, Tag (meta), Pill (choice), Switch, Stepper, SegmentedControl (`--tabs`), ListRow (`oc-ingredient`), Button.

## User Scenarios & Testing

### User Story 1 — Cook for more people (P1)
**Acceptance**: **Given** the quiche for 6, **When** I tap + three times, **Then** every quantity shows the amount for 9 at once, with no Apply button.

### User Story 2 — Pick a version (P1)
**Acceptance**:
1. **Given** Classic is selected, **When** I tap Vegetarian, **Then** "Bacon lardons 200 g" becomes "Mushrooms, sliced 250 g" with a Variant tag.
2. **Given** "Make my own dough" is switched on, **Then** pastry is replaced by flour, cold butter and ice water, and the Steps tab count goes from 6 to 7.

### User Story 3 — Switch to steps (P1)
Tabs "Ingredients · 9" and "Steps · 6" switch the view; steps are spec 009.

### Edge cases
- Servings range is 1–16; at a limit the button does nothing.
- A recipe with no photo shows the peach placeholder with the recipe's first letter.

## Requirements

- **FR-001**: Header: photo 240 tall; back, share (spec 019) and settings (spec 027) buttons; title, description, meta chips: time (`total_minutes`, format from spec 006 FR-002; hidden when empty), cuisine label (hidden when Other), best months as "Best Oct – Mar" (hidden if all year), author with "via <assistant>".
- **FR-002**: Variants of kind `version` render as choice pills (one selected); variants of kind `option` render as switches with a one-line hint of what they change ("Adds 3 ingredients and 1 step").
- **FR-003**: The servings card shows only Servings and a "More options" (…) button; the options panel is spec 013. Units are not shown here; they come from settings (spec 027).
- **FR-004**: The ingredient list uses `@cocon/quantity` with the active servings, variants, unit system and scale mode. The amount column is 104 px; pieces show their weight as a sub-line.
- **FR-005**: "Add to groceries…" opens the picker (spec 022). "Start cooking" opens cooking mode (spec 012).
- **FR-006**: Servings and variant choices are remembered per recipe per device until changed.

## Success Criteria
- **SC-001**: Changing servings or variant re-renders in under 50 ms.
- **SC-002**: Ingredient amounts match the quantity engine's output for every variant combination (snapshot test).

## Tracking (PostHog)
| Event | Properties |
| --- | --- |
| `servings_changed` | from, to |
| `variant_selected` | variant_count |

## Warnings and errors
All copy is in the States tables of the UI specs for: OC-Recipe. New messages go there and in `strings/en.ts` first.

## Needs your attention
None.

## Changelog
- 2026-10-13: Ready. Decisions 1–34 applied; tracking added.
- 2026-10-19: Cuisine chip added; time chip is `total_minutes` and hidden when empty.
