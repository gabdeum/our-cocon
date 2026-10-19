# Feature Specification: Home

**Feature Branch**: `028-home` · **Status**: Ready · **Depends on**: 020, 026
**Input**: A warm landing screen showing the latest recipe, what to buy, recipes and recent AI activity.
**Design**: `design/ui/OC-Home.md`, `design/screens/OC-Home.dc.html`

## User Scenarios & Testing

### User Story 1 — See the newest recipe (P1)
**Acceptance**: **Given** the family has recipes, **Then** the hero card shows the most recently added one with the tag "Latest recipe", its photo, name, time (`total_minutes`, hidden when empty), servings and "N to buy" (its ingredients not on the grocery list yet). Tapping it opens the recipe.

### User Story 2 — Jump to what matters (P1)
**Given** Home, **Then** the tiles show "7 to buy" (groceries) and "32 family recipes", each opening its tab, and both update live.

### Edge cases
- No recipes yet: the hero becomes a soft card "What's for dinner?" with "Add your first recipe" (opens the create form) and an AI hint.
- New family: a friendly empty state for each block, plus "Invite your family".

## Requirements

- **FR-001**: The header has the brand mark, "Our Cocon" and the avatar stack; below it the date (olive, 15/700) and the greeting.
- **FR-002**: The hero always shows the most recently added recipe in V1. A later calendar feature will let families schedule recipes; the hero will then show tonight's planned one, so keep the hero's data source behind one function.
- **FR-003**: The latest AI activity entry shows with Undo or Restore (spec 026); hidden when there's none.
- **FR-004**: The greeting changes by time of day: Good morning (5–12), Hi (12–18), Good evening (18–5).

## Success Criteria
- **SC-001**: Home's numbers always match the Groceries and Recipes screens (test).

## Tracking (PostHog)
| Event | Properties |
| --- | --- |
| `home_hero_opened` | — |
| `home_tile_tapped` | tile |
| `first_recipe_cta_tapped` | — |

## Warnings and errors
All copy is in the States tables of the UI specs for: OC-Home. New messages go there and in `strings/en.ts` first.

## Needs your attention
None.

## Changelog
- 2026-10-13: Ready. Decisions 1–34 applied; tracking added.
- 2026-10-19: Hero time chip is `total_minutes`, hidden when empty.
