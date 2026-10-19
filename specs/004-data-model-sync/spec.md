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
- **Recipe**: family_id, name, description, serves, total_minutes (the time shown everywhere), prep_minutes, cuisine (text holding a key from the list in spec 006 FR-003; empty = Other), source_text, best_months (int[]), photo_path, settings overrides (see 027).
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
From the build (2026-10-18):
- **Assistant names need filling in (spec 023/025).** A write through an AI connection gets its name ("claude") from the server-managed table `oauth_client_sources`, never from the request. Until 023/025 add a row for each connected assistant, such writes are recorded as `mcp`.
- **Realtime speed is measured locally only.** The integration test measured a p95 of about 10 ms on a laptop (the target is 1 s). Staging isn't measured. Check it once 006 or 020 has a real screen on staging.
- **Optional hardening: private-only Realtime.** The app only uses private, members-only channels. The self-hosted Realtime service (the part of Supabase that pushes live changes) could also refuse public channels altogether, in `infra/supabase/cocon.override.yml`. Nothing leaks today; this is a second lock on the door.
- **A removed member keeps hearing change ids until their token expires (up to 1 hour).** Messages carry ids only, never content, and every read still goes through RLS.

## Changelog
- 2026-10-13: Ready. Decisions 1–34 applied; tracking added.
- 2026-10-18: Built.
  - **Tables.** `recipes`, `recipe_ingredients`, `recipe_steps`, `recipe_variants`, `grocery_items` and `activity`, from three migrations (shared, recipes, groceries). `_family_table()` sets up any later module's table the same way.
  - **Security.**
    - Every table has family RLS for read, insert, update and delete, with pgTAP tests for a member, another family's member and a signed-out visitor.
    - Triggers set the family, the author and the source, so the app can't pose as an assistant and nobody can attribute a write to someone else.
    - Recipes can be removed for good only after a soft delete, and the deletion time can't be backdated.
  - **Live updates.**
    - A private channel per family, `family:<id>`, carries ids only. The app refetches what changed.
    - An integration test proves another member hears each write in well under 1 s, and another family can't join the channel.
  - **App.**
    - Offline: data is cached on the device and stays readable. The `warn` banner shows on the tabs and Settings, and Settings' editing controls are disabled.
    - The cache is tied to its owner and wiped for anyone else.
    - `optimisticWrite` reverts a failed save.
  - **Seed.** The quiche with its 2 variants, and the sample grocery list, for a local demo family (`gabriel@cocon.local`).
  - **Deviations:**
    - Grocery `added_by` is `created_by`.
    - Invites keep `used_by`/`used_at` instead of an `updated_by`.
    - Realtime uses private broadcast channels instead of `postgres_changes`, whose deletes would reach every family.
    - Ingredient and variant edits reach others through their recipe's event, not their own.
    - `source` is how a row was created. Each live message carries the current writer's source, and AI changes are in the activity log.
    - "Alex just changed this recipe" is built (`useRecipeChangedBy`, `RecipeChangedBanner`). The recipe screens (008, 014) show it.
    - StatusBanner gained a `warn` tone (`warn` text on `warn-soft`), and its button props are now `actionLabel`/`onAction`. Disabled links use `ink-muted`.
    - The demo variant is named "Make my own dough", as on the canvas.
    - A spec 003 test now finds its family by owner, not by name, so the seeded family doesn't clash.
- 2026-10-19: Clarified: the time shown is `total_minutes`; `cuisine` holds a key from the list in spec 006 (no schema change).
