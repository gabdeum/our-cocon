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
- **FR-006**: Temperatures typed in the step body ("180 °C", "350°F", "180C") become temperature tokens on save (spec 005: `{temp:<°C>}`, built with `temperatureToken`), with °F converted to °C, so every reader sees both scales. They show as chips like ingredient tokens. They are oven temperatures (nearest 25 °F) unless marked as a thermometer reading (`{temp:<°C>:food}`, nearest 5 °F), e.g. sugar at 115 °C.

## Success Criteria
- **SC-001**: Every token renders identically in the form preview and on the recipe page.

## Tracking (PostHog)
| Event | Properties |
| --- | --- |
| `recipe_step_added` | has_timer, has_temperature, has_tip |

## Warnings and errors
All copy is in the States tables of the UI specs for: OC-EditSteps. New messages go there and in `strings/en.ts` first.

## Needs your attention
- Done in the build: the temperature chip, the "Oven · Thermometer" choice and the temperature check fields are now in `design/ui/OC-EditSteps.md` (Temperatures). Oven temperatures go in the step's text; the Temperature check add-on is for thermometer readings.

## Changelog
- 2026-10-13: Ready. Decisions 1–34 applied; tracking added.
- 2026-10-18: FR-006 added from spec 005: temperatures in the step body are stored as `{temp:…}` tokens.
- 2026-10-21: Built. Steps section of the recipe form: ingredient chips by "@" or "+ Leeks" with a live Preview (shared renderer with the recipe page, SC-001), Timer, Temperature check (°C or °F, stored in °C, `{temp}` places the reading: 032 L15), Chef's tip, Photo, reorder, "+ Add a step", "Remove step". Saved in one call by the new `save_recipe_steps`; at most 100 steps (032 L23, database check plus `MAX_STEPS`). Typed temperatures become `{temp:…}` chips (`tokenizeTemperatures` in `@cocon/quantity`). Event `recipe_step_added`. New components StepEditCard, TokenEditor, ToggleTile; Tag `soft`. Deviations: chips are drawn at the text's weight with no side padding (a real text field can't hold padded chips); step cards get a drag handle on the left; the temperature check preview reads "center reaches 71 °C (160 °F)" (as US3 and the recipe page) instead of "→ shows (160 °F) automatically"; "+ Eggs" chips are Pills (40 tall); "Remove step", the temperature fields and the Oven · Thermometer choice weren't drawn (copy added to the UI spec). Event bounds now use one `MAX_TRACKED_STEPS` (200); `step_timer_started` takes 0–199 and its sender caps it, like cooking mode. Security review: Discard after a save that failed partway keeps the header photo that save wrote, and the form never removes a photo a variant's added step uses.
- 2026-10-21: Fixed dragging to reorder (steps, and ingredients from 015): on the web a dropped row went back where it started, because ReorderList read the drag distance after React Native had reset it. Covered by a ReorderList test; checked in headless Chrome on both lists.
- 2026-10-21: A closed step shows every add-on as a pill on the right, in the toggles' order ("35 min", "Temp check", "Tip", "Photo"), instead of the drawn sage temperature line under step 5 (Gabriel's call). UI spec and StepEditCard README updated.
