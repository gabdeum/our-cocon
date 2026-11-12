# Feature Specification: Grocery list review (catalog gaps, Other in store units, recipe card, clear buttons)

**Feature Branch**: `052-grocery-review` · **Status**: Ready · **Depends on**: 020, 021, 022, 031
**Input**: Gabriel's grocery review (2026-11-12):
1. Add the ingredients from current recipes that the catalog doesn't know, so they stop landing in Other.
2. Show items in Other in store units, as if bought by weight.
3. Tapping a recipe card on the list opens the recipe.
4. The bottom buttons read "Clear done" and "Clear all" (red), at the same size.
5. The recipe card's Servings sheet shows Cancel and Save from the start.

**Design**: canvas page "Our Cocon · Recipes & Groceries": `OC-Groceries` (US store), `OC-GroceriesEU` (Europe store), `OC-GroceryRecipeMenu`. The `OC-Groceries` board has been redrawn to match what's built (020/021/022 changelogs): rows read "Name: buy (need …)", each row has a "…" button, and the settings button sits beside "Add item". Update `design/ui/OC-Groceries.md` to match this spec.

## User Scenarios & Testing

### User Story 1 — Fewer things in Other (P1)
**Acceptance**: **Given** the unmatched list from prod (`unmatched-ingredients.sql`), **When** the new catalog version ships, **Then** those ingredients match. Existing recipe lines and grocery items pick up their catalog entry and aisle. An item a family moved by hand stays where they put it.

### User Story 2 — Buy unknown things by weight (P1)
1. **Given** a US store and "Za'atar 50 g" (not in the catalog), **Then** the row reads "Za'atar: 2 oz (need 50 g)".
2. **Given** a US store and "Guanciale 400 g", **Then** it reads "Guanciale: 1 lb (need 400 g)".
3. **Given** a Europe store and "Guanciale 400 g", **Then** it reads "Guanciale: 400 g".
4. **Given** "Gochujang 3 tbsp", **Then** it reads "2 fl oz (need 3 tbsp)" in the US and "50 ml (need 3 tbsp)" in Europe.
5. **Given** "Banana leaves 4", **Then** it reads "Banana leaves: 4 pieces", unchanged.

### User Story 3 — Recipe card opens the recipe (P1)
**Given** "Leek & bacon quiche" on the list, **When** I tap the card, **Then** the recipe opens. The "…" at the card's right opens the recipe menu.

### User Story 4 — Clear buttons (P1)
**Then** the list ends with two equal buttons side by side: "Clear done" (soft) and "Clear all" (red outline). Both keep their current behaviour (Clear all is confirmed, with Undo).

### User Story 5 — Servings with Cancel and Save from the start (P1)
**Given** I open the quiche's "…", **Then** the sheet shows Servings 6, "On the list for 6", "Remove its items", and at the bottom Cancel and a disabled Save. **When** I tap + once, **Then** the hint reads "Was 6" and Save becomes "Save for 7".

### Edge cases
- Other items with no quantity ("Salt"): just the name.
- Other items in pinches: unchanged ("1 pinch").
- An unknown item a family gave its own pack size (spec 031 custom ingredient with packs): the pack engine wins, and the rules in FR-004 don't apply.
- Mixed units that don't add up ("11 pieces + 600 g", spec 022): each part is converted on its own ("11 pieces + 1¼ lb").
- "Round up to store packs" off (spec 021): convert to the store's units, rounded to one decimal, without stepping up ("1.8 oz (need 50 g)").

## Requirements

### 1 · Catalog gaps
- **FR-001 Query**: `specs/052-grocery-review/unmatched-ingredients.sql` is read-only and runs in the Supabase dashboard. It lists unmatched names from live recipes (`catalog_key is null`) and from grocery items, with counts and example recipes.
- **FR-002 Catalog version**:
  - Gabriel saves the export as `data/catalog/unmatched-2026-11.csv`.
  - Claude Code drafts a catalog entry for every row that's a real ingredient. Each entry follows spec 031 FR-002 (aisle, density when known, piece sizes, packs for us and eu, a `source`).
  - Rows that are only a typo or a variant of an existing entry become **synonyms** of that entry instead of new entries.
  - Rows that aren't ingredients ("salt and pepper to taste", "water") are listed for Gabriel to decide on.
  - Ships as catalog version N+1 through `pnpm catalog`.
- **FR-003 Backfill**: a data migration runs `match_ingredients` again on every `recipe_ingredients` and `grocery_items` row whose `catalog_key` is null.
  - **Recipe lines:** a recipe line that matches gets `catalog_key`, plus piece weight and size word when it's counted in pieces. That's the snapshot rule from spec 031; it's taken once, now.
  - **Grocery items:** a grocery item that matches gets `catalog_key` and the catalog aisle, unless the family has an aisle override for that name (`family_ingredients`). The override wins.
  - **Custom ingredients:** a family's custom ingredient whose name now matches keeps its overrides and is linked to the catalog key.
  - **Report:** the migration logs how many rows matched, per table.

### 2 · Other in store units
- **FR-004 Store units for items without packs** (no catalog entry, or a catalog entry with no packs for the profile, or a custom ingredient without packs). Rounding is always up.
  - **Weight, US:** under 4 oz, whole oz (1 oz minimum). From 4 oz, steps of ¼ lb, written "¼ lb", "½ lb", "¾ lb", "1 lb", "1¼ lb".
  - **Weight, Europe:** under 100 g, steps of 10 g; up to 1 kg, steps of 50 g; above 1 kg, steps of 0.1 kg ("1.3 kg").
  - **Volume, US** (ml, l, tsp, tbsp, cup): under 32 fl oz, whole fl oz (1 fl oz minimum); from 32 fl oz, quarts in steps of ½ ("1½ qt").
  - **Volume, Europe:** under 1 L, steps of 50 ml; from 1 L, steps of 0.25 L ("1.25 L").
  - **Pieces, pinches, no quantity:** unchanged.
  - Conversions use the `@cocon/quantity` constants. No density is needed, because weight stays weight and volume stays volume.
- **FR-005 Row text**: "{name}: {store amount} (need {original})", following the spec 021 rule that "(need …)" is left out when the two are the same ("Guanciale: 400 g").
  - Lives in `groceryQuantity` / `pickPacks` as the fallback when there are no packs, so the add sheet (022) and assistants (024) show the same text.
  - Unit test table: the five examples in US2, plus the rounding boundaries (3.9 oz → 4 oz → ¼ lb, 99 g, 100 g, 1 kg, 31 fl oz, 32 fl oz).

### 3 · Recipe card
- **FR-006**: The card has two hit areas.
  - **Body:** photo, name, "{k} items on the list · serves {n}" and a chevron. Tapping it opens `/recipes/{id}` at the card's servings. Screen-reader name: "Open {recipe}".
  - **"…" button:** 48 × 60 at the card's right. It opens the recipe menu. Screen-reader name: "More for {recipe}".
  - "Open recipe" is removed from the menu.
  - A recipe in Recently deleted: the body does nothing and shows "From a deleted recipe" (spec 022), and the "…" keeps only "Remove its items".

### 4 · Clear buttons
- **FR-007**: At the end of the list, a two-column grid with a 10 px gap. Each button is 52 px high and fully rounded.
  - **Left button:** "Clear done", soft, using `Button --soft`.
  - **Right button:** "Clear all", with a 2 px danger outline and danger text, using `Button --danger-outline`. Add it to the design system if it doesn't exist.
  - Screen-reader names: "Clear done items" and "Clear all items".
  - "Clear done" is disabled when nothing is ticked; "Clear all" is disabled when the list is empty.
  - Events are unchanged.

### 5 · Recipe menu sheet
- **FR-008**: The recipe menu (`OC-GroceryRecipeMenu`) is a standard sheet, laid out like Edit item.
  - **Header:** photo, recipe name, "{k} items on the list".
  - **Servings:** the "Servings" section with a Stepper and the hint "On the list for {n}", which becomes "Was {n}" once changed. Under it: "Changes this recipe's items still to buy. Ticked items stay as they are."
  - **Remove its items:** a red text button with a trash icon. Same flow as today.
  - **Footer** (always visible): Cancel (1 fr) and Save (2 fr). Save is disabled ("Save") until the number changes, then reads "Save for {n}". Saving runs the existing rescale (spec 022) and closes the sheet.

## Success Criteria
- **SC-001**: After the catalog update and backfill, running query 1 again on prod returns at most the rows Gabriel chose not to add.
- **SC-002**: For every rounding boundary in FR-005's table, the result is never less than the need.

## Tracking (PostHog)
| Event | Properties |
| --- | --- |
| `grocery_recipe_opened` | from (card) |
| `ingredient_backfill_matched` | table, count (sent once, from the migration's script) |

Existing events are unchanged. `grocery_recipe_servings_changed` still fires on Save.

## Warnings and errors
- Save fails: show the sheet's inline error "Couldn't update. Try again.", and the sheet stays open.

## Needs your attention
- Run `unmatched-ingredients.sql` on prod and add the CSV to the repo before `/build-spec 052`. FR-002 depends on it.
- The rounding steps in FR-004 are my proposal (a deli-style ¼ lb in the US, 50 g in Europe). Change them if they don't match how you shop.
- The query reads every family's recipes. It only exports ingredient names and counts. Recipe names appear in `example_recipes`, so drop that column if you'd rather not have them in the CSV.

## Changes to other specs (apply as changelog lines there)
- **020:** the recipe card opens the recipe; the bottom buttons are "Clear done" and "Clear all" (FR-006, FR-007).
- **021:** store units for items without packs (FR-004, FR-005).
- **022:** the recipe card menu loses "Open recipe"; its Servings sheet shows Cancel and Save from the start (FR-008).
- **031:** new catalog version from prod gaps, plus the backfill (FR-002, FR-003).

## Changelog
- 2026-11-12: Written from Gabriel's grocery review (items 1–5).
- 2026-11-12: Built.
  - **Catalog (FR-002):** version 5 from `data/catalog/unmatched-2026-11.csv` (query 1, 11 names): new entries Canadian bacon, Crispy fried onions, English muffin, Head of garlic (separate from Garlic, which counts cloves; Gabriel's call), Lamb shoulder, Pearl onion and Tuna steak; synonyms "beef" (Stewing beef), "japanese short grain rice" (Rice) and "shelled edamame" (Peas). "Sourdough starter" stays in Other (Gabriel).
  - **Backfill (FR-003):** `match_ingredients` now calls `_match_ingredients(family, queries)` (owner only), so the backfill uses the app's own matching rule. The backfill is TypeScript (`scripts/backfill-catalog-matches.ts`, names are read by `parseIngredientText`), run by `scripts/migrate.ts` right after the `backfill_catalog_matches` migration, in the same transaction; `pnpm db:backfill` runs it locally. Recipes keep their "updated" time; a grocery item someone moved out of Other stays put; a custom ingredient whose exact name the catalog now knows is linked and keeps its aisle, sizes and packs (not on a close match: linking rewrites the family's own entry). Deviation: `ingredient_backfill_matched` isn't sent (the migration container has no PostHog key); the counts are in the deploy log (032-later L138).
  - **Store units (FR-004, FR-005):** `storeAmount` in `@cocon/quantity`, used by `rowAmounts` for anything with no pack known, so the app and assistants read the same. The edge case of a custom ingredient with its own pack size can't happen yet: Store size is for catalog items only (spec 021), so every custom item gets store units. A catalog item whose packs haven't loaded yet still shows only what's needed. US2's "Guanciale" and "Gochujang" are catalog synonyms (pancetta, hot sauce) and get packs; the tests use other unknown names with the same amounts.
  - **Recipe card (FR-006):** new `GroceryRecipeCard` (RecipeItem README › Grocery card). The body opens `/recipes/{id}?servings={n}`; the page starts at those servings once, without saving them over the device's choice. Cards now show for recipes in Recently deleted too (they were hidden), with "From a deleted recipe" and a menu with only "Remove its items".
  - **Clear buttons (FR-007):** new Button size `pair` (52 px, label 16). Both buttons always show, each disabled when it has nothing to clear (before, they were hidden).
  - **Recipe menu (FR-008):** the footer is the standard SheetFooter (Cancel 110 px, Save the rest), close to the drawn 1 fr / 2 fr.
  - **Not changed:** the board draws Grocery settings beside "Add item"; it stays at the title's right (spec 050 FR-007), as the spec doesn't ask to move it.
- 2026-11-12 (after Gabriel's test): the recipe card has no chevron (FR-006 and the board draw one); tapping its body still opens the recipe.
