# Feature Specification: Recipes review (cooking in progress, ingredient detail, source, actions)

**Feature Branch**: `051-recipes-review` · **Status**: Ready · **Depends on**: 004, 006, 008, 012, 014, 015, 020, 022, 023, 027, 031
**Input**: Gabriel's recipes review (2026-11-11): keep recipes being cooked at the top until they're done or cancelled, log when we cooked them, show the ingredient detail (the part after the comma), one Source instead of "via {assistant}", Share + Edit on the recipe page, and icon actions. Notes after cooking (review item 6) are deferred.
**Design**: canvas page "Our Cocon · Recipes & Groceries": `OC-Recipes`, `OC-Recipe` (+ `OC-RecipeSteps`), `OC-RecipeWide` (430 px, in progress), `OC-Cook`, `OC-CookDone`, `OC-EditBasics`, `OC-EditIngredients`, `OC-AddGroceries`, `OC-Groceries`. `OC-RecipeSettings` is retired.
**Not in scope**: cooking notes and the morning-after question (deferred; `cook_sessions` is the place to hang them later). 

## User Scenarios & Testing

### User Story 1 — Cooking stays open until it's finished (P1)
**Acceptance**:
1. **Given** I start the quiche and leave cooking mode at step 3, **Then** Recipes shows an "In progress · 1" section at the top with "Leek & bacon quiche · Step 3 of 6 · Gabriel · since 18:40", a 6-segment progress bar, and Cancel · Done · Resume.
2. **Given** the quiche page, **Then** an "In progress" card sits under the title chips, and the main button reads "Resume · step 3".
3. **Given** I tap Resume, **Then** cooking mode opens at step 3 with the same variant, servings and running timers.
4. **Given** I tap Cancel, **Then** the session ends as cancelled: it leaves the section and isn't counted as cooked. A toast offers Undo.
5. **Given** I reach the last step, **Then** the main button reads "Done cooking" and opens the Done sheet.

### User Story 2 — We know when we cooked it (P1)
**Given** I tap Done, **Then** the session is saved as done with `finished_at`, a sheet confirms "Leek & bacon quiche is done! Logged as cooked today by Gabriel." with Undo, and the recipe page shows "Cooked 4 times · last by Eva, 3 weeks ago". The first time it reads "Cooked once · today".

### User Story 3 — See the detail without clutter (P1)
**Given** "Gruyère, grated", **Then** the recipe page shows "Gruyère" with "grated" on a smaller, muted line under it. The grocery row shows "Gruyère" with "In recipe: grated". When two recipes need butter, the row reads "In recipes: for the pan · cold, cubed".

### User Story 4 — Edit the detail (P1)
**Given** the ingredient editor, **Then** each row has a "Detail (optional)" field under the quantity. Pasting "100 g Gruyère, grated" fills name "Gruyère" and detail "grated".

### User Story 5 — Straight to editing (P1)
**Given** the recipe page, **Then** the top bar shows Back on the left and Share + Edit (pencil) on the right. Edit opens the edit form directly. The per-recipe settings and Delete live at the bottom of its Details tab, under "This recipe".

### User Story 6 — Where it came from (P1)
1. **Given** I photograph page 48 of "La Cuisine de Mamie" and ask Claude to save it, **Then** the recipe's Source is "La Cuisine de Mamie · p. 48". The list and page show that; nothing says "via Claude".
2. **Given** ChatGPT saves a recipe with no other source, **Then** Source is "ChatGPT".

### Edge cases
- **Two cooks at once:** one open session per recipe per family. Starting a recipe that's already in progress offers "Resume Gabriel's" or "Start over". Start over cancels the old session. Different recipes can be in progress at the same time; the section lists them all, newest first.
- **Stale sessions:** a session untouched for 24 h stays in the section with "Started yesterday". After 72 h it's auto-cancelled with `cancel_reason = 'stale'`.
- **Done without cooking mode:** the Done button on the card works from any step, including "Step 1 of 6".
- **Deleted recipe:** its open session is cancelled.
- **Ingredients without detail:** no second line. A grocery item from a recipe whose ingredient has no detail shows no source line at all; the recipe card above the list still links the recipe.

## Requirements

### Cooking sessions (item 1)
- **FR-001 Entity:** `cook_sessions`: id, family_id, recipe_id, started_by, started_at, last_active_at, current_step (0-based), variant_id?, servings, status (`in_progress` | `done` | `cancelled`), finished_at?, finished_by?, cancel_reason? (`user` | `stale` | `replaced` | `recipe_deleted`). A partial unique index keeps one `in_progress` session per (family_id, recipe_id). RLS: family members only.
- **FR-002 Start and update:** "Start recipe" creates the session. Cooking mode writes `current_step` and `last_active_at`, debounced to 2 s, and on leaving. Timers keep their spec 011 store, keyed by session. Leaving cooking mode (✕, aria "Leave cooking mode, stays in progress") never ends the session.
- **FR-003 Recipes list:** an "In progress · {n}" section above "In season", only when n > 0. Each card shows photo, name, "Step {k} of {n} · {member} · since {HH:mm}" (or "· started yesterday"), the step bar, and Cancel · Done · Resume. Realtime: other members see it too.
- **FR-004 Recipe page:** while in progress, show the card under the chips (Cancel · Done · Resume), and label the main action "Resume · step {k}".
- **FR-005 Done:** sets `status = done`, `finished_at` and `finished_by`, then opens the Done sheet (`OC-CookDone`): title, "Logged as cooked today by {member}. That's {n} times now.", Undo (back to in progress at the same step), "Back to the recipe". The page meta line reads "Cooked {count} times · last by {member}, {relative}" ("Cooked once · today"). It's derived from done sessions; don't store a counter.
- **FR-006 Cancel:** sets `cancelled` and shows a toast "Cancelled · Undo" for 5 s.

### Ingredient detail (items 2, 3)
- **FR-007 Data:** the detail is `recipe_ingredients.prep_note` (spec 031).
  - **Migration:** for rows where `prep_note` is empty and `name` contains a comma, move the text after the first comma into `prep_note` and trim the name. Brackets stay in the name.
  - From then on the name never holds the detail.
- **FR-008 Recipe page:** under the ingredient name, show the detail at 13 px, weight 600, `#7A6F55`, line-height 1.35. The weight sub-line from spec 013 stays as its own line after it. Steps keep their own phrasing (`sn`).
- **FR-009 Groceries** (replaces spec 020 FR-003 "For <recipe>" and spec 022's "For …"):
  - Row source line:
    - From one recipe: "In recipe: {detail}".
    - From several recipes: "In recipes: {detail} · {detail}", unique details in recipe order.
    - From recipes but with no detail: no line.
    - Added by hand: "Added by {member}" (an assistant adding by hand also shows the member, not the assistant).
  - The item sheet still lists the recipes by name.
  - The recipe card above the list reads "{recipe} · {k} items on the list · serves {n}".
- **FR-010 Add-to-groceries sheet:** each row shows "In recipe: {detail}" under the name.
- **FR-011 Ingredient editor:**
  - New field "Detail (optional)": 42 px high, placeholder "Detail (optional) · sliced, at room temp…", max 80 characters.
  - Paste-a-list and the parser split at the first comma: before goes to the name, after to the detail.
  - Lead text: "…Detail is how it's prepared; it shows under the name and on the grocery list."

### Recipe page header and actions (items 4, 7)
- **FR-012 Top bar:** Back, then on the right Share and Edit (pencil icon, aria "Edit recipe"). Edit goes to `/recipes/{id}/edit`, Details tab. Remove the settings button.
- **FR-013 "This recipe" section** at the bottom of the edit form's Details tab (edit only, never on New recipe):
  - Contents: the four spec 027 settings with "Same as default" or "Changed for this recipe · Reset", then "Delete recipe" (spec 018 flow).
  - The settings save with the form's Save, like every other field.
  - Retire the `/recipes/{id}/settings` route; it redirects to the edit form.
  - Variants stay in their tab (spec 017).
  - The "…" panel row "Units: {x}" now reads "Change in Edit › This recipe" and opens the form scrolled to the section.
- **FR-014 Action bar:** a sticky bar at the bottom of the recipe page, on both tabs. Padding 14/16/28, on a cream fade.
  - **Cart button:** 60 px. Below 430 px wide it shows the icon only (aria "Add to groceries"); at 430 px and up it shows icon + "Add to groceries".
  - **Main button:** flex, ink, with a play icon: "Start recipe", or "Resume · step {k}".
  - This replaces the full-width "Add to groceries" button under the ingredients and the "Start cooking" button.

### Source (item 5)
- **FR-015 Display:** list author line, recipe chip (book icon) and share view (spec 019) all show `source_text`. If it's empty: the creator's name (manual recipe) or the assistant's name (AI-made, as the fallback for older rows).
  - Never "{name} · via {assistant}" on recipes or grocery rows.
  - The activity log (spec 026) keeps "via {assistant}", because it describes who made the change.
- **FR-016 MCP:** `create_recipe` / `update_recipe` `source_text` param description, verbatim:
  > "Where the recipe comes from, shown to the family as its Source. Use the most specific real source you know: a book's title and page ('La Cuisine de Mamie · p. 48'), a website's name or URL, a person ('Grandma Jeanne'), a show. If the user gives you a photo or text from a book, magazine or site, put that here. Only if there's no other source, leave it empty and we use your name."
  - The server fills the assistant's name when it's empty on create.
  - `update_recipe` never overwrites a non-empty source unless the user asks for it.
## Key Entities
- **CookSession** (new, FR-001).
- **RecipeIngredient**: `prep_note` is now shown and edited (migration FR-007).
- **RecipeSettings** (spec 027): unchanged; edited from the form now.

## Success Criteria
- **SC-001**: Leaving cooking mode at any step and reopening Recipes on another member's phone shows the card within 2 s (Realtime).
- **SC-002**: After the migration, no ingredient name in seed or staging contains a comma, and every split row has its detail in `prep_note` (count check before and after).
- **SC-003**: At 390 px the action bar fits the cart icon plus "Resume · step 10" without wrapping. At 430 px it fits "Add to groceries" plus "Start recipe".
## Tracking (PostHog)
| Event | Properties |
| --- | --- |
| `cook_started` | recipe_id, resumed_existing (bool) |
| `cook_resumed` | from (list · recipe), step |
| `cook_finished` | status (done · cancelled), cancel_reason, steps_seen, minutes |
| `recipe_edit_opened` | from (top_bar · units_row) |

## Warnings and errors
- Starting while a session for that recipe is open: a sheet with "Gabriel is cooking this (step 3)", "Resume" and "Start over".

## Needs your attention
- **Detail column (checked 2026-11-12):** both were in use. `prep_note` held it for seeded rows, MCP text lines and variants; the app's paste, the form's name field and MCP object rows kept it after a comma in the name, and every reader fell back to the comma. Locally no name had a comma; staging and prod may. The FR-007 migration moves them, and from now on the app, the paste and the MCP server all split at the first comma outside brackets (`splitIngredientDetail`). Spec 023's changelog has a 051 line saying so.
- Stale timing: 24 h before showing "started yesterday" and 72 h before auto-cancel are guesses. Adjust them if they feel wrong.
- `cook_started` sends the recipe's id (a uuid, as the Tracking table lists): the first event to carry a record id. Fine by the "no user content" rule, but say if you'd rather it didn't.
- The iPhone app needs a new build for this release: `pnpm theme` added the `ink-soft` colour to the Lock Screen widget's Swift theme, which changes the native fingerprint (`pnpm --dir apps/app exec eas fingerprint:compare` to confirm).

## Changes to other specs (apply as changelog lines there)
- **006:**
  - FR-001's author line is now the source (FR-015).
  - User Story 2's "Alex · via ChatGPT" becomes "ChatGPT", or the real source.
  - New "In progress" section (FR-003).
- **008:**
  - Header buttons are now Share + Edit (FR-012).
  - The chip is the Source.
  - Ingredient detail line (FR-008).
  - Sticky action bar (FR-014).
  - Cooked meta line (FR-005).
- **012:** leaving keeps the session; the last step's button is "Done cooking" (FR-002, FR-005).
- **014:**
  - Source field hint: "Book and page, a website, or a person. Assistants fill this in, or put their own name if there's nothing else."
  - "This recipe" section (FR-013).
- **015:** Detail field and comma parsing (FR-011).
- **020:** FR-003 and FR-004 copy replaced by FR-009.
- **022:** "For …" replaced by FR-009.
- **023:** FR-005 records the client's name in the activity log only. Recipes get `source_text` per FR-016. `get_recipe` adds `cooking: { times_cooked, last_cooked_at }`.
- **027:** FR-002 and FR-004 move to the edit form (FR-013). The `OC-RecipeSettings` screen is retired.
## Changelog
- 2026-11-11: Written from Gabriel's recipes review (items 1–7).
- 2026-11-12: Item 6 (cooking notes, morning push, MCP notes tools) dropped for now.
- 2026-11-12: Built. `cook_sessions` (RLS, one open per recipe, live, server-stamped who and when; a deleted recipe cancels its cook; the nightly purge cancels stale ones via `cancel_stale_cook_sessions`), the In progress section and card (new `CookSessionCard`, Progress `StepBar`), the Done sheet (OC-CookDone), "Done cooking", Resume with the cook's step, version and servings, the "already cooking" sheet, the Cooked meta line, the ingredient detail (FR-007 migration, Detail field, paste split, `grocery_items.recipe_detail` copied on add), the Source (list, page chip with a new `book` icon, shared page, MCP fill on create), the Edit pencil, "This recipe" in the form (saved with Save), the action bar, and `get_recipe`'s `cooking`. New token `ink-soft` (#7A6F55, 4.7:1 on the page) for detail and source lines. Deviations: the screens were ported from the canvas update, keeping each file's newer baseline (cuisine chip, StepRows, Cooking options, the grocery card and "…" menus); on the grocery list only the source line changed, as Gabriel asked, so FR-009's card copy and item sheet are 032-later L133. The Cancel toast stays 8 s (the design system's time for a toast with Undo), not 5. Timers stay keyed by recipe and step on the device (they survive a resume as is). A cook remembers its version, not its options (L135). The list card's buttons are 44 tall (the design's 42 is under the touch minimum). Detail fields are white (the canvas's #FFFCF2 isn't a token). The shared page shows the Source as a chip under the description (OC-SharedView has no drawn place for it). "That’s the first time." is new copy for a first cook. Units now follow the recipe's own setting: the "…" panel's Metric · Imperial toggle from 013 became the "Units: …" link (FR-013), so a device choice saved before no longer counts and `units_toggled` is retired; `cooking_finished` is replaced by `cook_finished`. The stale cancel runs nightly, so a cook can show for up to a day past 72 hours in the database; the app hides it from 72 hours.
- 2026-11-12: After review. The database keeps the cooking log honest: an ended cook only comes back in progress by Undo, within the hour, never after the nightly job or a delete ended it, and a deleted recipe can't be started. Starting a recipe ends a cook left untouched for 72 hours first (so it never blocks a restart before the nightly job). The shared page returns who added it only when there's no source. The page card is off offline, its Resume has no play icon (as drawn), the Done sheet reads its title and text out on open and after Undo, and "Mark as done" after Undo doesn't send `cook_finished` twice.
- 2026-11-12: Changed with Gabriel after trying the build. Units are each member's own (new `member_recipe_settings`, "For you › Units" on Menu › Recipes, also used for the grocery list's amounts; the family's old setting until they pick). The "…" Metric · Imperial toggle is back on the recipe page and in cooking mode, for the visit only (kept in memory, forgotten when the recipe page closes, `units_toggled` again). "This recipe" no longer has Units, and a recipe's `units` no longer counts. So FR-013's "Units: {x} · Change in Edit › This recipe" row is gone, and `recipe_edit_opened` only comes `from: top_bar`. New event `my_units_changed` (system). The ingredient detail sits after the name on its line ("Gruyère · grated", the detail muted) instead of its own line (FR-008). Also fixed: the cooking-mode timer's −1/+1 buttons (a spec 030 change sized their disc `h-full` inside a minimum-only parent, which stretched the timer card on the iPhone and squashed the buttons on the web), and 019's share-link test now lists the new shared fields.
