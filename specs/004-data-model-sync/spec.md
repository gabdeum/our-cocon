# Feature Specification: Data model, security and sync

**Feature Branch**: `004-data-model-sync` · **Status**: Ready · **Depends on**: 003
**Input**: The database schema for recipes, groceries, settings and activity, with family-scoped security and realtime updates.

## User Scenarios & Testing

### User Story 1 — Changes appear for everyone (P1)
When Alex ticks a grocery item or edits a recipe, Mia's open app shows it within a second.
**Acceptance**: **Given** two signed-in members, **When** one writes, **Then** the other's screen updates without refreshing.

### User Story 2 — Families are private (P1)
**Acceptance**: **Given** two families, **When** a member of one queries any table, **Then** no row of the other family is returned.

### Edge cases
- Two members edit the same recipe field at once: the last save wins, and the other person sees "Alex just changed this recipe" with Reload.
- Offline: cached data stays readable, editing controls are disabled, and a banner reads “You're offline. You can read, but changes need a connection.” No queued writes in V1.

## Requirements

- **FR-001**: Tables MUST be created by migrations with RLS on, and every policy checks family membership.
- **FR-002**: Realtime MUST be enabled for `grocery_items`, `recipes`, `recipe_steps` and `activity`. Timers are personal and stay on the device (spec 010).
- **FR-003**: Every table has `created_by`, `updated_by`, `source` (`app` | `claude` | `chatgpt` | `gemini` | other MCP client) and timestamps.
- **FR-004**: Deletes of recipes are soft (`deleted_at`), see spec 018.
- **FR-005**: A seed script loads the reference data: the leek & bacon quiche with its 2 variants (classic/vegetarian, homemade dough) and the sample grocery list from the canvas.

## Key Entities
- **Recipe**: family_id, name, description, serves, total_minutes, prep_minutes, cuisine, source_text, best_months (int[]), photo_path, settings overrides (see 027).
- **Ingredient**: recipe_id, position, name, catalog_key (nullable, spec 031), quantity, unit (g, kg, ml, l, tsp, tbsp, cup, oz, lb, piece, pinch), size_word (small | medium | large, pieces only), weight_per_piece_g (snapshot taken on save), piece_noun singular/plural, prep_note ("finely chopped").
- **Step**: recipe_id, position, name, body (rich text with ingredient tokens, see 016), timer_seconds, timer_label, temp_check_c, temp_check_text, tip, photo_path.
- **Variant**: recipe_id, name, kind (option | version), changes[] (see 017).
- **GroceryItem**: family_id, name, catalog_key (nullable), quantity, unit, aisle (from the catalog or the family override), checked, checked_by, recipe_id (nullable), added_by, source.
- **Catalog tables** (global ingredient facts, pack sizes, family overrides): see spec 031.
- **FamilySettings / RecipeSettings**: see 027 and 021.
- **Activity**: family_id, actor_id, source, action, target, payload (for undo), created_at (see 026).

## Success Criteria
- **SC-001**: A realtime update arrives in under 1 s at p95.
- **SC-002**: The RLS test suite covers every table for read, insert, update and delete.

## Tracking (PostHog)
| Event | Properties |
| --- | --- |
| `offline_banner_shown` | screen |

## Warnings and errors
Offline: StatusBanner "You're offline. You can read, but changes need a connection." (design system Patterns.md). A failed write reverts and shows "Couldn't save. Try again."

## Needs your attention
None.

## Changelog
- 2026-10-13: Ready. Decisions 1–34 applied; tracking added.
