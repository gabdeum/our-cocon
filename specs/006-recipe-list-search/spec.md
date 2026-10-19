# Feature Specification: Recipe list and search

**Feature Branch**: `006-recipe-list-search` · **Status**: Ready · **Depends on**: 002, 004
**Input**: Browse and search all family recipes.
**Design**: canvas `OC-Recipes`; components ScreenHeader, TextField (search), Pill, RecipeItem, Button (olive sm "New").

## User Scenarios & Testing

### User Story 1 — Find a recipe by name or ingredient (P1)
**Acceptance**:
1. **Given** 32 recipes, **When** I type "leek", **Then** the quiche appears because it contains leeks, and the list updates as I type.
2. **Given** no match, **Then** the empty state reads "No recipes match “xyz”." · "Try another word, or add it as a new recipe." with a "Clear search" button (OC-Recipes, States).

### User Story 2 — See what's new (P2)
**Given** Alex adds a recipe via ChatGPT, **Then** it appears at the top of my open list with "Alex · via ChatGPT".

### Edge cases
- No recipes yet: empty state "Your family's recipes will live here." plus "New recipe" and an AI hint Callout.
- Accents and case are ignored in search ("gruyere" matches "Gruyère", "LEEK" matches "leeks").
- A recipe with no total time, or with no cuisine, leaves that part out of its meta line ("Serves 8" alone is valid).

## Requirements

- **FR-001**: The list shows RecipeItem: photo (or placeholder), name, meta line and author ("{name}", or "{name} · via {assistant}" when AI-made). The meta line is "{time} · Serves {n} · {cuisine} · {k} variants", and any part without a value is left out with its separator: no `total_minutes` → no time; no cuisine (Other) → no cuisine; no variants → no variants count ("1 variant" when one). Example: "40 min · Serves 4 · Italian", "1 h 10 · Serves 6 · French · 2 variants".
- **FR-002**: Time is always the recipe's `total_minutes` (never `prep_minutes`), formatted by one shared function also used by specs 008 and 028: under 60 → "{m} min"; otherwise "{h} h", or "{h} h {mm}" with two-digit minutes ("1 h 10", "1 h 05", "2 h").
- **FR-003**: Cuisine is a key from one fixed list in `packages/schemas/recipes.ts` (`Cuisine`), stored as text in `recipes.cuisine` (no database change: the column stays text, and the list is validated by the shared schema in the app and the MCP server). Labels live in `strings/en.ts`. V1 keys: `american`, `british`, `caribbean`, `chinese`, `french`, `german`, `greek`, `indian`, `italian`, `japanese`, `korean`, `latin_american`, `mexican`, `middle_eastern`, `moroccan`, `portuguese`, `scandinavian`, `spanish`, `thai`, `turkish`, `vietnamese`, `west_african`. An empty or unknown value means **Other**: it is never shown on the recipe, and it matches the "Other" filter (spec 007). Reading a row never fails on an unknown value.
- **FR-004**: Search matches name, description and ingredient names, ignoring accents and case (both sides are lowercased and stripped of diacritics, so "gruyere" = "Gruyère"), with a 150 ms debounce. It runs in the app over the family's recipes and their ingredient names already loaded for the list; there is no database search and no `unaccent` extension. The normalise-and-match function lives in `packages/schemas` so the MCP `search_recipes` tool (spec 023) uses the same one.
- **FR-005**: Under the search field, the hint "Try “leek” or “quick”" shows until the person types.
- **FR-006**: Quick-filter pills ("In season", "Under 30 min") and the Filters button sit under the search (logic in spec 007).
- **FR-007**: The default grouping shows "In season in <Month> · N" first (recipes whose best months include the current month), then "All recipes · N" with the rest, including recipes with no best months. Within each group, the most recently added recipes come first.
- **FR-008**: Tapping an item opens the recipe page (spec 008); "New" opens the create form (spec 014).

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
None. The cuisine database check is task L5 in `specs/032-later`.

## Changelog
- 2026-10-13: Ready. Decisions 1–34 applied; tracking added.
- 2026-10-19: Diet removed everywhere (meta line, "Vegetarian" quick pill); cuisine from a fixed key list replaces it (FR-003), "Other" when empty. Time is `total_minutes` with one shared format (FR-002) and is hidden when empty. Meta line order fixed (FR-001). Search runs in the app, accent- and case-insensitive, shared with MCP (FR-004). No-match copy aligned with OC-Recipes; "All recipes · N" count and the In season group rule made explicit (FR-007).
- 2026-10-19: Built. List, search (shared `recipeMatches` in `@cocon/schemas`, 150 ms debounce), In season / All recipes groups, meta and author lines (one `formatTotalTime` in `apps/app/lib/recipe-format.ts` for 008 and 028), `Cuisine` key list (`RecipeInput.cuisine` now only accepts its keys), empty, no-match, loading, load-failed and offline states, events `recipes_searched` and `recipe_opened`. RecipeItem gained a Loading state (`RecipeItemSkeleton`). Until later specs: the quick pills toggle but don't filter and Filters does nothing (007); "New" and recipe taps go to routes built in 014 and 008; photos show the placeholder (014). Copy added to OC-Recipes.md: load failed, "Former member", "via an AI assistant", screen-reader "Loading recipes". Seed quiche gets cuisine `french`.
- 2026-10-19: Search hint changed to "Try “leek” or “quick”" ("Mia's" removed: search doesn't look at who added a recipe). Cuisine database check moved to `specs/032-later` (L5).
