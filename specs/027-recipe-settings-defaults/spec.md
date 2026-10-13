# Feature Specification: Recipe settings and family defaults

**Feature Branch**: `027-recipe-settings-defaults` · **Status**: Ready · **Depends on**: 009, 012
**Input**: Family-wide cooking defaults that each recipe can override.
**Design**: canvas `OC-RecipeSettings`, `OC-Settings` (Cooking defaults); components Switch (with "Changed for this recipe · Reset"), SegmentedControl, Card.

## User Scenarios & Testing

### User Story 1 — Set our kitchen once (P1)
**Acceptance**: **Given** Settings › Cooking defaults, **When** I turn off "I have a thermometer", **Then** temperature checks disappear from every recipe.

### User Story 2 — An exception for one recipe (P1)
**Given** the quiche's settings, **When** I turn "Thermometer checks" on, **Then** it shows "Changed for this recipe · Reset", and only the quiche shows its check.

### User Story 3 — Units (P1)
**Given** a recipe's Units set to Imperial, **Then** its page, steps and cooking mode use imperial, while other recipes follow the family default.

## Requirements

- **FR-001**: Settings: keep screen on (bool), kitchen scale (bool), thermometer (bool), units (metric | imperial). The family stores the defaults; a recipe stores overrides (null = use the default).
- **FR-002**: The recipe settings screen shows each setting with "Same as default" or "Changed for this recipe · Reset"; units use a three-way control: Default · Metric · Imperial.
- **FR-003**: The kitchen-scale switch in the "…" panel (spec 013) is a per-device quick override on top of these. It never changes the setting for anyone else.
- **FR-004**: The recipe settings screen also lists variants with "Edit" and "Add a variant" (spec 017).
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
All copy is in the States tables of the UI specs for: OC-RecipeSettings, OC-Settings. New messages go there and in `strings/en.ts` first.

## Needs your attention
None.

## Changelog
- 2026-10-13: Ready. Decisions 1–34 applied; tracking added.
