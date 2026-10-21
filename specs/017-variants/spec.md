# Feature Specification: Variants

**Feature Branch**: `017-variants` · **Status**: Ready · **Depends on**: 016
**Input**: Store versions and options of a recipe as a list of changes, instead of copies.
**Design**: canvas `OC-EditVariants`, `OC-RecipeSettings` (list), `OC-Recipe` (pills and switch); components Card, Tag (`--honey`, `--sage`), Button.

## User Scenarios & Testing

### User Story 1 — A vegetarian version (P1)
**Acceptance**: **Given** I create the variant "Vegetarian" with "Swap Bacon lardons → 250 g sliced mushrooms", **Then** the recipe page shows Classic and Vegetarian pills, and choosing Vegetarian swaps the ingredient in the list and in every step that mentions it.

### User Story 2 — An optional extra (P1)
**Acceptance**: **Given** the option "Make my own dough" (swap pastry → flour, cold butter, ice water; add step "Make the dough" before step 1 with a 30 min timer), **Then** the recipe page shows it as a switch, and turning it on applies both changes.

### User Story 3 — Combine (P2)
**Given** Vegetarian plus Make my own dough, **Then** both apply, and the counts read "Ingredients · 11 / Steps · 7".

### Edge cases
- Two options change the same ingredient: the later one in the list wins, and the editor warns "Also changed by <variant>".
- A change refers to an ingredient or step that no longer exists: the change is shown as broken in the editor and skipped on the page.

## Requirements

- **FR-001**: A variant has a name, a kind (`version`: pick one, mutually exclusive, the base counts as "Classic"; `option`: an on/off switch) and an ordered list of changes.
- **FR-002**: Change types: swap ingredient (one → one or more), add ingredient, remove ingredient, add step (before or after step N), change step (new body, timer or temperature), remove step.
- **FR-003**: Applying variants is a pure function in `@cocon/schemas`, used by the app and the MCP server.
- **FR-004**: Everything a variant adds or changes carries a "Variant" tag on the recipe page.
- **FR-005**: The editor summarises each change in plain words ("~~Shortcrust pastry~~ → 200 g flour, 100 g cold butter, 50 ml ice water").
- **FR-006**: Variants change only ingredients and steps. Servings, time and best months always come from the base recipe.

## Key Entities
- **Variant**: id, recipe_id, name, kind, position, changes (JSON validated by a shared schema).

## Success Criteria
- **SC-001**: Every variant combination of the seed recipe renders correct amounts (snapshot test).

## Tracking (PostHog)
| Event | Properties |
| --- | --- |
| `variant_created` | change_count |

## Warnings and errors
All copy is in the States tables of the UI specs for: OC-EditVariants, OC-RecipeSettings. New messages go there and in `strings/en.ts` first.

## Needs your attention
None.

## Changelog
- 2026-10-13: Ready. Decisions 1–34 applied; tracking added.
- 2026-10-21: Built. The Variants section of the recipe form (OC-EditVariants): collapsed rows with their change count, one open variant with "Variant name", "Shown as" (A version · An option), "What changes" in plain words (FR-005) with honey/sage tags, the conflict line "Also changed by “…”" and the broken line with "Remove change", six "Add a change" buttons opening inline editors that reuse the ingredient cards (with catalog suggestions and matching) and the step editor (`StepFieldsEditor`, taken out of the Steps section), "+ New variant", "Delete this variant". Saved in one call by the new `save_recipe_variants` (at most 20 variants, 50 changes each, every change of a known type: database checks plus `MAX_VARIANTS`); a change step saves only what differs from the base step; untouched changes are written back as they were. Recipe settings at `/recipes/[id]/settings` with "Edit recipe" (032 L25) and the Variants list (icon tile, name, one-line summary, "Edit", "Add a variant"), each opening the form at Variants (`&variant=<id>` or `new`). Shared: `brokenChanges`, `variantConflicts` and `parseVariantChanges` in `@cocon/schemas`; a changed step now carries the Variant tag (FR-004). Event `variant_created`. New components: IconTile, Button `tile`. Deviations: US3 reads "Ingredients · 10 / Steps · 7" (the seed Classic has 8 ingredients, as in 008); the settings switches are spec 027 and "Delete this recipe" is 018; a variant's added step offers Timer, Temperature check and Tip but no Photo (032 L36); the inline editors, pickers, change warnings and the delete-variant dialog weren't drawn (copy added to OC-EditVariants.md and OC-RecipeSettings.md); summaries follow the recipe's data ("100 g cubed cold butter", "Make the dough · 30 min timer", and the dough option's line ends "· changes step 1"); settings cards use the Card radius (22). The 009 test that a changed step has no tag now expects one. Security review: the database also caps `changes` at 256 KB (members can write the table directly); Save writes back changes the form can't read instead of dropping them; a removed variant step's photo is cleaned up once saved; the 20-variant cap is kept in the app too.
