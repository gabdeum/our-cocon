# Feature Specification: Recipe settings and family defaults

**Feature Branch**: `027-recipe-settings-defaults` · **Status**: Ready · **Depends on**: 009, 012
**Input**: Family-wide cooking defaults that each recipe can override.
**Design**: canvas `OC-RecipeSettings`, `OC-SettingsRecipes` (the Recipes settings page, `design/ui/OC-SettingsRecipes.md`); components Switch (with "Changed for this recipe · Reset"), SegmentedControl, Card.

## User Scenarios & Testing

### User Story 1 — Set our kitchen once (P1)
**Acceptance**: **Given** the Recipes settings page (`/settings/recipes`), **When** I turn off "I have a thermometer", **Then** temperature checks disappear from every recipe.

### User Story 2 — An exception for one recipe (P1)
**Given** the quiche's settings, **When** I turn "Thermometer checks" on, **Then** it shows "Changed for this recipe · Reset", and only the quiche shows its check.

### User Story 3 — Units (P1)
**Given** a recipe's Units set to Imperial, **Then** its page, steps and cooking mode use imperial, while other recipes follow the family default.

## Requirements

- **FR-001**: Settings: keep screen on (bool), kitchen scale (bool), thermometer (bool), units (metric | imperial). The family stores the defaults; a recipe stores overrides (null = use the default).
- **FR-002**: The recipe settings screen shows each setting with "Same as default" or "Changed for this recipe · Reset"; units use a three-way control: Default · Metric · Imperial.
- **FR-003**: The kitchen-scale switch and the Metric · Imperial toggle in the "…" panel (spec 013) are per-device quick overrides on top of these. They never change the setting for anyone else. They're saved only once tapped (`RecipeChoices.kitchenScale` / `system`, null = follow the setting); pass the recipe's or family's setting as `formatOf(choices, settings)` in the recipe page and cooking mode.
- **FR-004**: The recipe settings screen also lists variants with "Edit" and "Add a variant" (spec 017).
- **FR-006 Recipes settings page**: build `/settings/recipes` (screen `OC-SettingsRecipes`): back link, title "Recipes", lead "Used for every recipe, for the whole family. Each recipe can change them in its own settings.", then the Cooking defaults card. Until spec 029 builds the Menu, link it from the current Settings screen as a row "Recipes" / "Cooking defaults, units" ›; don't add a Cooking defaults section to Settings. The recipe settings lead reads "These only change this recipe. Your family defaults are in Menu › Recipes."
- **FR-005**: Defaults are per family, and a recipe can override them, including units. There are no per-member settings in V1.

## Key Entities
- **FamilySettings**: family_id, keep_awake, has_scale, has_thermometer, units, store_profile, round_to_packs.
- **RecipeSettings**: recipe_id, keep_awake?, has_scale?, has_thermometer?, units?.

## Success Criteria
- **SC-001**: Each setting resolves correctly for every override combination (table test).

## Tracking (PostHog)
| Event | Properties |
| --- | --- |
| `recipe_setting_changed` | setting |
| `family_default_changed` | setting |

## Warnings and errors
All copy is in the States tables of the UI specs for: OC-RecipeSettings, OC-SettingsRecipes. New messages go there and in `strings/en.ts` first.

## Needs your attention
None.

## Changelog
- 2026-10-13: Ready. Decisions 1–34 applied; tracking added.
- 2026-10-26: Family defaults get their own Recipes settings page (`/settings/recipes`), which the Menu (spec 029) links to; FR-006 added. The Settings screen gets no Cooking defaults section.
