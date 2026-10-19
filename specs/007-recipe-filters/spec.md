# Feature Specification: Recipe filters

**Feature Branch**: `007-recipe-filters` · **Status**: Ready · **Depends on**: 006
**Input**: Narrow recipes by season, time, cuisine and author.
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
- Recipes with no total time match every time option ("Under 30 min", "30–60 min" and "Over 1 hour").
- No recipe has a cuisine yet: the Cuisine group is hidden.
- A selected cuisine stays visible when the sheet reopens, even if it is outside the first 10.

## Requirements

- **FR-001**: Filters: best months (multi), total time on `total_minutes` (Under 30 min | 30–60 min | Over 1 hour, single), cuisine (multi), added by (family members, multi).
- **FR-002**: Within a group the logic is OR; across groups it is AND.
- **FR-003**: Quick pills on the list ("In season", "Under 30 min") mirror the same filter state.
- **FR-004**: The Cuisine group lists only the cuisines used by at least one of the family's recipes (not deleted), as their labels from the list in spec 006 FR-003, most recipes first, then alphabetical. The first 10 show; a pill "Show {n} more" expands the rest in place. A pill "Other" comes last when at least one recipe has no cuisine (empty or unknown value) and matches those recipes.
- **FR-006**: Filtering is one function in `packages/schemas`, used by the app and the MCP `search_recipes` tool (spec 023).
- **FR-005**: Filters persist for the session and reset on app restart.

## Success Criteria
- **SC-001**: The count updates under 100 ms after each tap.

## Tracking (PostHog)
| Event | Properties |
| --- | --- |
| `recipe_filters_applied` | filter_keys (`months`, `time`, `cuisine`, `added_by`), result_count |

## Warnings and errors
All copy is in the States tables of the UI specs for: OC-Filters. New messages go there and in `strings/en.ts` first.

## Needs your attention
None.

## Changelog
- 2026-10-13: Ready. Decisions 1–34 applied; tracking added.
- 2026-10-19: Diet filters removed ("Vegetarian", "Has a vegetarian variant", "Dairy-free"); Cuisine group added (FR-004), built from the family's recipes with top 10, "Show {n} more" and "Other". Recipes with no total time match every time option. Filtering shared with MCP (FR-006).
