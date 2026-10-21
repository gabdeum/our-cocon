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
| L9 | P2 | **MCP input for filters.** `RecipeFilters` (`packages/schemas/recipe-filters.ts`) needs all four fields, which suits the app. For `search_recipes`, derive an input where each field is optional and defaults to `emptyFilters`. Check `addedBy` ids against the caller's family, so an unknown id gets a clear error instead of no results. | 007 | 023 |
| L11 | P2 | **Assistants save variants the same way.** The recipe form now saves variants through `save_recipe_variants` (017: one transaction, at most 20 variants and 50 changes each, ids kept) and matches their ingredients against the catalog (suggestions and `match_ingredients` on blur), so "Ice water 50 ml" gets its grams. The MCP recipe tools should do both: validate each change with `VariantChange`, run variant ingredients through the 031 matcher, and save with `save_recipe_variants`. | 008, 017 | 023 |
| L12 | P3 | **Keep proper nouns capitalised in step text.** The quantity engine lower-cases an ingredient's first letter in phrases ("5 g dijon mustard", "100 g gruyère"). Catalog names are all sentence case, so nothing tells a proper noun apart: add a `keep_capital` flag to the catalog (and the recipe's own nouns) and use it in `format`. Found again in 009. | 008, 009 | none |
| L18 | P3 | **Alerts when the app is closed.** V1 alerts only while the app is open (decision 19); a timer that ends while closed shows "Done!" on return. Schedule a phone notification at `endsAt` with the iPhone app. | 010 | none (V2) |
| L14 | P1 | **Pass the thermometer setting to the recipe page and cooking mode.** `RecipePage` takes `thermometer` and `CookScreen` takes `cooking.thermometer` (both default on); give them the recipe's setting, or the family default. | 009, 012 | 027 |
| L20 | P1 | **A way into Timers when nothing is running.** The TimerPill only shows while a timer is running (011), so with every timer paused or done, or none yet, Timers (`/timers`) can't be reached, apart from the "Open timers" button on the done banner. Paused timers then can't be resumed, and the quick kitchen timers can't be started. Gabriel decides the entry point (for example Home, the recipe page or Settings). | 011 | none (Gabriel decides) |
| L16 | P2 | **Tell assistants about `{temp}`.** The step tool description says `temp_check_text` may hold `{temp}` where the reading goes, and results render it with `renderTemperatureCheck`. | 009 | 023 |
| L21 | P1 | **Pass "Keep screen on" to cooking mode.** `CookScreen` takes `cooking.keepAwake` (default on, `defaultCooking` in `lib/recipe-view.ts`); give it the setting, so turning it off leaves the screen free to lock and hides the "Screen stays on" chip (OC-Cook › States). | 012 | 027 |
| L24 | P3 | **Open the converter on the amount you tapped.** OC-Units says the converter opens on the tab of the last tapped amount, but ingredient amounts on the recipe page can't be tapped, so it always opens on Volume and talks about the first ingredient with a density. Make IngredientRow amounts tappable (open the converter with that amount, unit and ingredient). | 013 | none |
| L26 | P1 | **Photos on the shared view.** The `recipe-photos` bucket is private (014): photos show through signed links, which only family members can make. The signed-out share page needs its own way, e.g. the share endpoint returns a short-lived signed link for the recipe's photo and step photos. Sign only paths under `<recipe.family_id>/<recipe.id>/` (the database already checks `photo_path` this way). | 014 | 019 |
| L27 | P2 | **The Home hero's photo.** Use `useRecipePhotoUrls` (`apps/app/lib/recipe-photo.ts`) for the latest recipe's photo in HeroCard (`photoUri`), as the recipe list does. | 014 | 028 |
| L28 | P3 | **Clean up unused photos.** The form removes photos it replaced or didn't keep, but best effort: a photo uploaded just before the app closed, or whose removal failed, stays in storage with nothing pointing to it. A scheduled job could remove files in `recipe-photos` that no recipe or step names and are over a day old. | 014 | none |
| L6 | P3 | **Private-only Realtime.** Make the self-hosted Realtime service refuse public channels (`infra/supabase/cocon.override.yml`). The app uses only private channels, so this is a second lock, not a fix. | 004 | none |
| L7 | P3 | **Keep invite tokens out of Auth logs.** A signed-out invitee's sign-in link carries `next=/join/<token>`, which shows in Supabase Auth's server logs until it's used or expires (7 days). Option: keep the token on the device instead. | 003 | none |
| L8 | P3 | **Cut off removed members' live updates sooner.** A removed member keeps receiving change ids (never content; reads still go through RLS) until their token expires, up to 1 hour. | 004 | none |
| L30 | P3 | **More shapes for the paste parser.** It reads 98 of the 100 test lines; it misses multiplied packs ("2 x 400 g cans tomatoes") and an amount in brackets after the count ("1 (14 oz) can coconut milk"). French words go in a `words.fr.ts` beside `packages/quantity/words.en.ts`, with the same shape. | 015 | none |
| L31 | P3 | **Learn a family's piece weights.** A weight of one typed in the form ("each ≈ 170 g") stays with that recipe. It could also become the family's correction for that ingredient (`family_ingredients.size_medium_g`, spec 031), so the next recipe suggests it. | 015 | none |
| L32 | P2 | **Assistants save ingredients the same way.** The MCP recipe tools should save a recipe's ingredients through `save_recipe_ingredients` (one transaction, steps tidied) and read pasted lines with `parsePastedList` from `@cocon/quantity`, validating rows with `IngredientInput` (`packages/schemas`) before the call, so the app and assistants agree. | 015 | 023 |
| L33 | P2 | **Assistants save steps the same way.** The MCP recipe tools should save a recipe's steps through `save_recipe_steps` (one transaction, at most 100), turn typed temperatures into tokens with `tokenizeTemperatures` from `@cocon/quantity`, and validate rows with `StepInput` (`packages/schemas`), so a step written by an assistant reads like one written in the app. | 016 | 023 |
| L34 | P2 | **Check the step editor on the iPhone.** The Instructions editor (TokenEditor) draws its chips under a see-through text field; on the web the caret lines up with the letters. iOS text fields lay out text a little differently, so check the caret and chips line up in Expo Go, and adjust the field's inset if they don't. | 016 | none (with the iPhone app) |
| L35 | P3 | **Move a chip without retyping it.** In the step editor a chip can be deleted or inserted, not dragged to another place in the text; with VoiceOver it reads as its name. A "Move" action on chips would help. | 016 | 030 |
| L36 | P3 | **Photos on a variant's added step.** A step a variant adds can carry `photo_path` (an assistant may set one, and the form keeps it), but the form offers no Photo add-on for it: it would need the step-photo upload and clean-up path of 016 for steps that live in `recipe_variants.changes`. | 017 | none |
| L37 | P2 | **Undo for removed steps and variants.** `save_recipe_steps` (016) and `save_recipe_variants` (017) delete the rows a save leaves out for good, and nothing records who removed them or through what. For the AI activity log and its undo (decision 33), record what an assistant removed (an `after delete` trigger writing to the activity table, with the caller and source) so it can be restored. | 017 | 026 |

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
- 2026-10-20 (014): did L5 (cuisine checked in the database) and L10 (photos in the recipe list, header and steps); added L25 ("Edit recipe" in recipe settings, 017), L26 (photos on the shared view, 019), L27 (Home hero photo, 028) and L28 (clean up unused photos).
- 2026-10-20 (015): it had no tasks here. Added L29 (variants naming a removed ingredient, 017), L30 (more parser shapes and French), L31 (learn piece weights) and L32 (MCP saves ingredients the same way, 023).
- 2026-10-21 (016): did L15 (`{temp}` in the check's text) and L23 (a step limit: 100 steps, `MAX_TRACKED_STEPS` for events); added L33 (MCP saves steps the same way, 023), L34 (check the step editor on the iPhone) and L35 (move a chip, 030).
- 2026-10-21 (017): did L25 ("Edit recipe" in recipe settings) and L29 (a variant change pointing at a removed ingredient shows as broken, with "Remove change"); did the app half of L11 and reworded it for the MCP server (023); added L36 (photos on a variant's added step) and L37 (undo for removed steps and variants, 026).
