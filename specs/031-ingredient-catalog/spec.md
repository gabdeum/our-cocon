# Feature Specification: Ingredient catalog

**Feature Branch**: `031-ingredient-catalog` · **Status**: Ready · **Depends on**: 004 · **Build before**: 005, 015, 020, 021
**Input**: One shared catalog of ingredient facts (aisle, density, piece sizes, store packs) that recipes, conversions and groceries all use, plus family corrections.

## How the pieces fit
- **Unit maths is code; ingredient facts are data.** Fixed conversions (g↔oz, ml↔cup, °C↔°F) are constants in `@cocon/quantity`. Facts that depend on the ingredient (how much a cup of flour weighs, how heavy a medium onion is, how cream is sold) live in the catalog.
- **Recipes keep a snapshot.** A recipe ingredient links to a catalog entry, but stores its own piece weight and size word when saved, so editing the catalog never silently changes a recipe.
- **Groceries use the catalog** for the aisle and the pack sizes; recipe amounts are summed in base units (g, ml or pieces) per catalog entry before packs are picked.

## User Scenarios & Testing

### User Story 1 — Typing an ingredient just works (P1)
**Acceptance**: **Given** I type "onion" in the form, **Then** suggestions show "Onion" with sizes small (≈ 70 g), medium (≈ 120 g) and large (≈ 200 g). Picking "1 small onion" stores the size and weight, and steps show "1 small onion (70 g)".

### User Story 2 — Groceries land in the right aisle (P1)
**Given** the quiche is added to groceries, **Then** leeks go to Produce, Gruyère to Dairy & eggs and nutmeg to Spices & baking, with no setup.

### User Story 3 — Unknown items are learned once (P2)
**Given** "Za'atar" isn't in the catalog, **When** it's added, **Then** it lands in Other; after someone moves it to Spices & baking ("Move to…"), it goes there for this family from then on.

### Edge cases
- Descriptors are not part of the match: "finely chopped red onions" matches "Red onion" (which has its own entry) and keeps "finely chopped" as a preparation note.
- Plurals and accents: "Leeks", "poireaux" (if French ships) and "gruyere" all match.
- An AI-created recipe uses the same matcher; unmatched names come back to the assistant in the tool result, which can then ask the person or choose an aisle.

## Requirements

- **FR-001**: The catalog is versioned in the repo (`data/catalog/ingredients.json`), validated by a schema, and loaded by a migration into a read-only global table.
- **FR-002**: Each entry has: `key`, display names (singular and plural) and synonyms, `aisle`, optional `density_g_per_ml`, optional piece sizes `{small, medium, large}` in grams with a default size and piece nouns, `whole_only` (round to whole numbers when scaling, e.g. eggs), diet flags (`meat`, `fish`, `dairy`, `gluten`, used by spec 007), and `packs` per store profile (size, unit, label, loose flag).
- **FR-003**: V1 ships about 200 of the most common home-cooking ingredients. Claude Code drafts the data with sources in comments; a person reviews it before merge.
- **FR-004**: A family override table can change, for this family only: aisle, piece weight, pack sizes, and custom ingredients not in the catalog.
- **FR-005**: The matcher normalises text (lower case, no accents, singular, descriptors stripped into a `prep` note), tries exact name or synonym, then fuzzy matching (pg_trgm similarity ≥ 0.6). Anything else becomes a custom family ingredient in Other.
- **FR-006**: Conversions between weight and volume use `density_g_per_ml` only; when it's missing, the app keeps the author's unit and shows no cup equivalent.
- **FR-007**: Aisle order is fixed: Produce, Bakery, Dairy & eggs, Meat & fish, Dry goods, Spices & baking, Frozen, Drinks, Household, Other.
- **FR-008**: Catalog names are English only in V1. The schema keeps names per language so French can be added later.

## Key Entities
- **CatalogIngredient** (global): key, names, synonyms, aisle, density_g_per_ml, sizes, default_size, nouns, whole_only, diet_flags.
- **PackSize** (global): ingredient_key, profile (us | eu), size, unit, label, loose.
- **FamilyIngredient** (per family): family_id, ingredient_key or custom name, aisle?, piece_weights?, packs?.
- **RecipeIngredient** (spec 004) gains: catalog_key (nullable), size_word (small | medium | large | null), prep_note.

## Success Criteria
- **SC-001**: At least 95% of ingredient lines in a test set of 200 real recipes match a catalog entry.
- **SC-002**: Every catalog entry passes schema validation, and every entry with pieces has a medium size.

## Tracking (PostHog)
| Event | Properties |
| --- | --- |
| `ingredient_unmatched` | — (count only, never the text; helps grow the catalog) |
| `catalog_override_saved` | field |

## Warnings and errors
No user-facing copy; unmatched ingredients fall back to aisle Other.

## Needs your attention
- Review `data/catalog/ingredients.json` before merge (FR-003): 247 entries drafted by Claude Code. Piece weights and densities cite USDA FoodData Central and the King Arthur weight chart per entry. Pack sizes are typical US and EU supermarket listings, not individually sourced. Judgement calls to check: shortcrust pastry in Dairy & eggs (chilled), puff pastry in Frozen, tofu in Produce, lemon medium = 100 g whole.
- SC-001 runs on 200 ingredient lines from 20 common recipes (`data/catalog/test-lines.json`), written with the catalog, not 200 independent real recipes. 197/200 match today. A larger set from real recipes would be a stronger check.
- Spec 005's example says "1 small onion (120 g)"; this catalog uses 70 g for small, as US1 here says.

## Changelog
- 2026-10-13: Ready. Decisions 1–34 applied; tracking added.
- 2026-10-18: Shipped. 247-entry catalog in `data/catalog/ingredients.json`, loaded by migrations that `pnpm catalog` generates (`pnpm catalog --check` in CI). Global read-only tables, `family_ingredients`, views `ingredient_facts` and `ingredient_packs`, and RPCs `match_ingredients` and `suggest_ingredients`. Normalising lives in `packages/schemas/ingredient-text.ts`, shared with the app, the MCP server and the generator. Deviations:
  - JSON has no comments, so sources are a per-entry `source` field.
  - The matcher only reads. `family_ingredients` rows are written, and `ingredient_unmatched` and `catalog_override_saved` are fired, by the specs that save ingredients (015, 020, 021, 023).
  - `catalog_override_saved.field` is `aisle | piece_weight | packs | custom`.
  - A family's pack correction replaces the catalog's packs for every store profile.
  - Corrections are deleted for good, like grocery items ("reset to catalog").
  - US1's "1 small onion (70 g)" text is spec 005's formatting; this spec tests the stored snapshot.
  - The 003 RLS test now skips the three catalog tables, which every signed-in person reads.
