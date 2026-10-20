# Later: tasks deferred from other specs

**Status**: Living list · **Depends on**: the spec named in each row
**Input**: Work a build found but left for later: hardening, follow-ups, checks that need a later spec.

This spec is never built in one go. Each task is done by the spec in its **Do with** column (its `/build-spec` plan picks it up), or on its own when it has none. Every spec build adds, edits or removes rows here (see `.claude/skills/build-spec`).

## Priority
- **P1**: before the public launch.
- **P2**: soon; ideally with the spec in **Do with**.
- **P3**: when there's time, or only if it becomes a problem.

## Tasks

| # | Priority | Task | From | Do with |
| --- | --- | --- | --- | --- |
| L1 | P1 | **Name the assistants.** Add a row to `oauth_client_sources` for each assistant that connects, so its writes read "via Claude" or "via ChatGPT" instead of "via an AI assistant" (`mcp`). | 004 | 023, 025 |
| L2 | P1 | **Rate-limit the invite preview.** `invite_status` can be called signed out with no request limit (constitution VI). It needs a rate-limit plugin in Caddy, the web server in front of everything; share links need the same. | 003 | 019 |
| L3 | P1 | **Google sign-in credentials.** Create the OAuth client in Google Cloud Console and pass it to `provision.sh` (docs/operations.md › First-time setup, step 5). Until then only the email link works. Gabriel does this. | 003 | none |
| L4 | P2 | **Measure realtime speed on staging.** Locally a change reaches other members in about 10 ms (target: 1 s). Check it on staging now that the Recipes list updates live. | 004 | none (006 makes it testable) |
| L5 | P2 | **Check cuisine in the database.** Only the shared schema checks `recipes.cuisine` against the Cuisine list; the database accepts any text up to 40 characters. Add `check (cuisine in (…))` and a `supabase/tests` test that compares it with `Cuisine.options`. | 006 | the next recipes migration (014 or 023) |
| L9 | P2 | **MCP input for filters.** `RecipeFilters` (`packages/schemas/recipe-filters.ts`) needs all four fields, which suits the app. For `search_recipes`, derive an input where each field is optional and defaults to `emptyFilters`. Check `addedBy` ids against the caller's family, so an unknown id gets a clear error instead of no results. | 007 | 023 |
| L10 | P1 | **Show recipe photos everywhere they're drawn.** 014 adds the upload (FR-004), but no spec goes back to the screens built before it. Add one shared `recipePhotoUrl(photo_path)` helper for the bucket and use it in the recipe list (RecipeItem, 006) and the recipe header (`RecipePage`, 008; today it always draws `PhotoPlaceholder`). Step photos (009), the share preview (019) and the Home hero (028) use the same helper when they're built. | 006, 008 | 014 |
| L11 | P2 | **Match variant ingredients against the catalog.** A variant's ingredients live in `recipe_variants.changes` (jsonb), and no spec says to run them through the 031 matcher when they're saved. Without a `catalog_key` they get no density or piece sizes: "Ice water 50 ml" shows no grams (found testing 008). Match them in the variant form and in the MCP tools, like base ingredients. | 008 | 017, 023 |
| L6 | P3 | **Private-only Realtime.** Make the self-hosted Realtime service refuse public channels (`infra/supabase/cocon.override.yml`). The app uses only private channels, so this is a second lock, not a fix. | 004 | none |
| L7 | P3 | **Keep invite tokens out of Auth logs.** A signed-out invitee's sign-in link carries `next=/join/<token>`, which shows in Supabase Auth's server logs until it's used or expires (7 days). Option: keep the token on the device instead. | 003 | none |
| L8 | P3 | **Cut off removed members' live updates sooner.** A removed member keeps receiving change ids (never content; reads still go through RLS) until their token expires, up to 1 hour. | 004 | none |

## Changelog
- 2026-10-19: Created. Seeded with the open items from the Needs your attention sections of 003, 004 and 006.
- 2026-10-19: 007 built; it had no tasks here. Added L9 (filter input for MCP).
- 2026-10-19: 008 built; it had no tasks here. Added L10 (show photos on screens built before 014).
- 2026-10-19: Added L11 (variant ingredients need catalog matching), found while testing 008.
