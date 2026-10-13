# Feature Specification: Recipe form — steps

**Feature Branch**: `016-recipe-form-steps` · **Status**: Ready · **Depends on**: 009, 015
**Input**: Write steps with live ingredient tokens and optional timer, temperature check, tip and photo.
**Design**: canvas `OC-EditSteps`; components Card (`--selected`), TextField, Pill-like toggle buttons, Callout (`--temp`), Button (dashed).

## User Scenarios & Testing

### User Story 1 — Amounts that scale by themselves (P1)
**Acceptance**: **Given** I type "@le" in a step, **Then** a list suggests "Leeks"; picking it inserts a Leeks chip, and the Preview line shows "…Add 2 leeks (300 g)…".

### User Story 2 — Add a timer to a step (P1)
**Given** I toggle "Timer" on, **Then** fields for minutes and label appear (label defaults to the step name), and the step's collapsed card shows "8 min".

### User Story 3 — Add a temperature check (P2)
**Given** I toggle "Temperature check" and enter 71 °C with "center reaches", **Then** the preview shows "center reaches 71 °C (160 °F)".

### Edge cases
- Only one step is expanded at a time; the others collapse to number, name and badges (Tip, 12 min).
- A chip whose ingredient is later deleted shows a warning chip "Missing ingredient".

## Requirements

- **FR-001**: Step body is stored as text with tokens `{ing:<ingredientId>}`; the editor shows tokens as chips and never lets them be partially edited.
- **FR-002**: Tokens are inserted with "@" autocomplete or the "+ <ingredient>" chips for ingredients not yet used.
- **FR-003**: Optional add-ons per step: Timer (minutes plus label), Temperature check (°C or °F input, stored in °C, plus text), Chef's tip (max 200), Photo.
- **FR-004**: Steps reorder by drag (and Move up/down) and are added with "+ Add a step".
- **FR-005**: Temperature input accepts either scale and converts on save.

## Success Criteria
- **SC-001**: Every token renders identically in the form preview and on the recipe page.

## Tracking (PostHog)
| Event | Properties |
| --- | --- |
| `recipe_step_added` | has_timer, has_temperature, has_tip |

## Warnings and errors
All copy is in the States tables of the UI specs for: OC-EditSteps. New messages go there and in `strings/en.ts` first.

## Needs your attention
None.

## Changelog
- 2026-10-13: Ready. Decisions 1–34 applied; tracking added.
