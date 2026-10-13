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
