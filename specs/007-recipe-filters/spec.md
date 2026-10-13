# Feature Specification: Recipe filters

**Feature Branch**: `007-recipe-filters` · **Status**: Ready · **Depends on**: 006
**Input**: Narrow recipes by season, time, diet and author.
**Design**: canvas `OC-Filters`; components BottomSheet, MonthPicker, Pill, Pill (person), Button (ink "Show N recipes").

## User Scenarios & Testing

### User Story 1 — What can we cook this season? (P1)
**Acceptance**: **Given** October, **When** I tap "In season", **Then** only recipes whose best months include October (or that have none) show.

### User Story 2 — Combine filters (P1)
**Acceptance**:
1. **Given** the sheet open, **When** I pick Oct + "Under 30 min" + Alex, **Then** the button reads "Show N recipes" with the live count.
2. **Given** filters are active, **Then** the Filters pill shows "Filters · 3" and "Clear all" resets them.

### Edge cases
- A combination with 0 results: the button reads "No recipes match" (disabled) with the hint "Try removing a filter".
- Recipes with no months count as "good all year" and match every month.

## Requirements

- **FR-001**: Filters: best months (multi), total time (Under 30 min | 30–60 min | Over 1 hour, single), diet (Vegetarian, Has a vegetarian variant, Dairy-free, multi), added by (family members, multi).
- **FR-002**: Within a group the logic is OR; across groups it is AND.
- **FR-003**: Quick pills on the list mirror the same filter state.
- **FR-004**: Diet values are inferred from the catalog's diet flags of the recipe's ingredients (spec 031): no meat or fish = Vegetarian; no dairy = Dairy-free. "Has a vegetarian variant" applies when a variant makes the recipe vegetarian. The advanced form's diet pills (spec 014) can override.
- **FR-005**: Filters persist for the session and reset on app restart.

## Success Criteria
- **SC-001**: The count updates under 100 ms after each tap.

## Tracking (PostHog)
| Event | Properties |
| --- | --- |
| `recipe_filters_applied` | filter_keys, result_count |

## Warnings and errors
All copy is in the States tables of the UI specs for: OC-Filters. New messages go there and in `strings/en.ts` first.

## Needs your attention
None.

## Changelog
- 2026-10-13: Ready. Decisions 1–34 applied; tracking added.
