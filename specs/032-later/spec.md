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
| L10 | P1 | **Show recipe photos everywhere they're drawn.** 014 adds the upload (FR-004), but no spec goes back to the screens built before it. Add one shared `recipePhotoUrl(photo_path)` helper for the bucket and use it in the recipe list (RecipeItem, 006) and the recipe header (`RecipePage`, 008; today it always draws `PhotoPlaceholder`). Also step photos (009 FR-004: full width, radius 16, above the text; `photo_path` is loaded but not drawn). The share preview (019) and the Home hero (028) use the same helper when they're built. | 006, 008, 009 | 014 |
| L11 | P2 | **Match variant ingredients against the catalog.** A variant's ingredients live in `recipe_variants.changes` (jsonb), and no spec says to run them through the 031 matcher when they're saved. Without a `catalog_key` they get no density or piece sizes: "Ice water 50 ml" shows no grams (found testing 008). Match them in the variant form and in the MCP tools, like base ingredients. | 008 | 017, 023 |
| L12 | P3 | **Keep proper nouns capitalised in step text.** The quantity engine lower-cases an ingredient's first letter in phrases ("5 g dijon mustard", "100 g gruyère"). Catalog names are all sentence case, so nothing tells a proper noun apart: add a `keep_capital` flag to the catalog (and the recipe's own nouns) and use it in `format`. Found again in 009. | 008, 009 | none |
| L18 | P3 | **Alerts when the app is closed.** V1 alerts only while the app is open (decision 19); a timer that ends while closed shows "Done!" on return. Schedule a phone notification at `endsAt` with the iPhone app. | 010 | none (V2) |
| L14 | P1 | **Pass the thermometer setting to the recipe page and cooking mode.** `RecipePage` takes `thermometer` and `CookScreen` takes `cooking.thermometer` (both default on); give them the recipe's setting, or the family default. | 009, 012 | 027 |
| L20 | P1 | **A way into Timers when nothing is running.** The TimerPill only shows while a timer is running (011), so with every timer paused or done, or none yet, Timers (`/timers`) can't be reached, apart from the "Open timers" button on the done banner. Paused timers then can't be resumed, and the quick kitchen timers can't be started. Gabriel decides the entry point (for example Home, the recipe page or Settings). | 011 | none (Gabriel decides) |
| L15 | P2 | **Place the temperature in the check's text.** The form's "center reaches" text can say where the reading goes with `{temp}` (009 FR-003); without it, the reading follows the text. The preview uses `renderTemperatureCheck`. | 009 | 016 |
| L16 | P2 | **Tell assistants about `{temp}`.** The step tool description says `temp_check_text` may hold `{temp}` where the reading goes, and results render it with `renderTemperatureCheck`. | 009 | 023 |
| L21 | P1 | **Pass "Keep screen on" to cooking mode.** `CookScreen` takes `cooking.keepAwake` (default on, `defaultCooking` in `lib/recipe-view.ts`); give it the setting, so turning it off leaves the screen free to lock and hides the "Screen stays on" chip (OC-Cook › States). | 012 | 027 |
| L24 | P3 | **Open the converter on the amount you tapped.** OC-Units says the converter opens on the tab of the last tapped amount, but ingredient amounts on the recipe page can't be tapped, so it always opens on Volume and talks about the first ingredient with a density. Make IngredientRow amounts tappable (open the converter with that amount, unit and ingredient). | 013 | none |
| L23 | P2 | **Limit the number of steps in a recipe.** Nothing caps steps (schemas or database), but events cap step counts at 200 and `track` throws on invalid props. Cooking mode caps what it sends (012); `step_timer_started` (009) doesn't. Add a maximum (e.g. 100) to the recipe schema and a database check, and use it as the events' bound. | 012 (security review) | 016 |
| L6 | P3 | **Private-only Realtime.** Make the self-hosted Realtime service refuse public channels (`infra/supabase/cocon.override.yml`). The app uses only private channels, so this is a second lock, not a fix. | 004 | none |
| L7 | P3 | **Keep invite tokens out of Auth logs.** A signed-out invitee's sign-in link carries `next=/join/<token>`, which shows in Supabase Auth's server logs until it's used or expires (7 days). Option: keep the token on the device instead. | 003 | none |
| L8 | P3 | **Cut off removed members' live updates sooner.** A removed member keeps receiving change ids (never content; reads still go through RLS) until their token expires, up to 1 hour. | 004 | none |

## Changelog
- 2026-10-19: Created. Seeded with the open items from the Needs your attention sections of 003, 004 and 006.
- 2026-10-19: 007 built; it had no tasks here. Added L9 (filter input for MCP).
- 2026-10-19: 008 built; it had no tasks here. Added L10 (show photos on screens built before 014).
- 2026-10-19: Added L11 (variant ingredients need catalog matching), found while testing 008.
- 2026-10-19: Added L12 (capitalised names in step text), found while adding sample recipes in 008.
- 2026-10-19 (009): L10 now covers step photos too; L12 edited (needs a catalog flag, Do with none); added L13 (step timers, 010/011), L14 (thermometer setting, 027), L15 (`{temp}` in the step form, 016), L16 (`{temp}` for assistants, 023).
- 2026-10-19 (010): L13 cut down to the TimerPill on the recipe page (011); the step timers work. Added L17 ("Open timers" on the done banner, 011) and L18 (alerts when the app is closed, V2).
- 2026-10-19 (011): removed L13 (TimerPill on the recipe page) and L17 ("Open timers" on the done banner), both built.
- 2026-10-20 (011): added L19 ("Go to step" on a step timer's card, 012).
- 2026-10-20 (011): added L20 (a way into Timers when no timer is running).
- 2026-10-20 (012): did L19 ("Go to step" on a step timer's card); L14 now covers cooking mode too; added L21 (Keep screen on, 027), L22 (units in cooking mode, 013) and L23 (a step limit, 016).
- 2026-10-20 (013): did L22 (units in cooking mode); added L24 (open the converter on a tapped amount).
