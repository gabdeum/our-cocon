# Feature Specification: Recipe list and search

**Feature Branch**: `006-recipe-list-search` · **Status**: Ready · **Depends on**: 002, 004
**Input**: Browse and search all family recipes.
**Design**: canvas `OC-Recipes`; components ScreenHeader, TextField (search), Pill, RecipeItem, Button (olive sm "New").

## User Scenarios & Testing

### User Story 1 — Find a recipe by name or ingredient (P1)
**Acceptance**:
1. **Given** 32 recipes, **When** I type "leek", **Then** the quiche appears because it contains leeks, and the list updates as I type.
2. **Given** no match, **Then** an empty state says "No recipes match “xyz”. Try another word, or add one." with a New button.

### User Story 2 — See what's new (P2)
**Given** Alex adds a recipe via ChatGPT, **Then** it appears at the top of my open list with "Alex · via ChatGPT".

### Edge cases
- No recipes yet: empty state "Your family's recipes will live here." plus "New recipe" and an AI hint Callout.
- Accents and case are ignored in search ("gruyere" matches "Gruyère").

## Requirements

- **FR-001**: The list shows RecipeItem: photo (or placeholder), name, meta "time · Serves N · {k} variants | Vegetarian", and author (with "via <assistant>" when AI-made).
- **FR-002**: Search matches name, description and ingredient names; it is accent- and case-insensitive with a 150 ms debounce.
- **FR-003**: Under the search field, the hint "Try “leek”, “quick” or “Mia's”" shows until the person types.
- **FR-004**: Quick-filter pills ("In season", "Under 30 min", "Vegetarian") and the Filters button sit under the search (logic in spec 007).
- **FR-005**: The default grouping shows "In season in <Month> · N" first, then "All recipes". Within each group, the most recently added recipes come first.
- **FR-006**: Tapping an item opens the recipe page (spec 008); "New" opens the create form (spec 014).

## Success Criteria
- **SC-001**: Results appear under 200 ms for 500 recipes.
- **SC-002**: A user finds a known recipe in under 10 s in usability tests.

## Tracking (PostHog)
| Event | Properties |
| --- | --- |
| `recipes_searched` | query_length, result_count (never the query text) |
| `recipe_opened` | from (list, search, home, link) |

## Warnings and errors
All copy is in the States tables of the UI specs for: OC-Recipes. New messages go there and in `strings/en.ts` first.

## Needs your attention
None.

## Changelog
- 2026-10-13: Ready. Decisions 1–34 applied; tracking added.
