# Feature Specification: Recipe page — steps

**Feature Branch**: `009-recipe-page-steps` · **Status**: Ready · **Depends on**: 008
**Input**: The Steps tab: each step with its amounts filled in, temperature check, timer and chef's tip.
**Design**: canvas `OC-RecipeSteps`; components StepCard, Callout (`--temp`, `--tip`), TimerPill.

## User Scenarios & Testing

### User Story 1 — Read a step without scrolling back to ingredients (P1)
**Acceptance**: **Given** 9 servings, imperial, **When** I read step 3, **Then** it says "melt 1 oz butter… Add 3 leeks (15.9 oz)…", with each amount highlighted.

### User Story 2 — Check doneness (P2)
**Acceptance**: **Given** the thermometer setting is on, **Then** step 5 shows "Temperature check: the center should reach 71 °C (160 °F) and barely wobble." **Given** it's off, **Then** that callout is hidden.

### User Story 3 — Start a timer from a step (P1)
**Given** step 2 "Blind bake", **When** I tap "Start timer", **Then** the button turns olive and shows "Pause 11:59", and the TimerPill appears at the top. Timer behaviour is spec 010; −1 and +1 work as spec 010 says.

### Edge cases
- Steps added by a variant carry a Variant tag; removed steps disappear; numbering stays continuous.
- A token whose ingredient was deleted renders the plain name in muted text, plus an edit warning in the form (spec 016).

## Requirements

- **FR-001**: Each step renders as a StepCard: number, name, body via `renderStep` (spec 005), then optional temperature Callout, timer row and tip Callout, in that order.
- **FR-002**: The timer row is a Start/Pause/Resume/Done button with a live clock, plus −1 and +1 buttons; the footnote under the list explains −1/+1.
- **FR-003**: The temperature check text is stored in °C and displayed in both scales (constitution V). `{temp}` in `temp_check_text` marks where the reading goes ("the center should reach {temp} and barely wobble."); without it, the reading follows the text. Rendered by `renderTemperatureCheck` (`@cocon/quantity`).
- **FR-004**: Step photos, when present, show full-width at radius 16 above the text.

## Success Criteria
- **SC-001**: For every serving size from 1 to 16, amounts in steps equal those in the ingredient tab (property test).

## Tracking (PostHog)
| Event | Properties |
| --- | --- |
| `step_timer_started` | step_index (sent from spec 010, when the timer works) |

## Warnings and errors
All copy is in the States tables of the UI specs for: OC-RecipeSteps. New messages go there and in `strings/en.ts` first.

## Needs your attention
- Until spec 010, the timer buttons are drawn but do nothing when tapped (agreed while planning).

## Changelog
- 2026-10-13: Ready. Decisions 1–34 applied; tracking added.
- 2026-10-19: Shipped the Steps tab: StepCards with amounts from the same scaled ingredients as the list (SC-001 checked for 1–16 servings, every variant choice, metric, imperial and scale off), temperature check, timer row and tip, the footnote. Agreed deviations: the timer row is drawn but inactive (disabled for screen readers) and `step_timer_started` moves to spec 010 (US3 with it); step photos (FR-004) wait for spec 014's bucket (032 L10); the thermometer setting is a `RecipePage` prop, on until spec 027. US1's "1 oz butter" reads "1.1 oz" (30 g at the engine's 0.1 oz, like "15.9 oz" in the same sentence). Also: `{temp}` placeholder in temperature check text (FR-003); a variant swap to one ingredient carries the steps' tokens to it; a token whose ingredient is gone shows its last known name, muted, or "an ingredient". Seed: temperature checks reworded with `{temp}`, the quiche's oven temperature is a `{temp:180}` token, and "Make my own dough" rewrites "Preheat and line" ("…with the rolled-out dough…"), so its hint now reads "Adds 3 ingredients and 1 step. Changes 1 step".
- 2026-10-23: With Gabriel: a step reads the ingredient's name without brackets and adds how it's prepared after the amount: the row's prep note, else what follows a comma in its name ("250 g mushrooms, sliced"). One rule for the app, the shared page, cooking mode and assistants (`renderStep`, `ingredientName`/`ingredientNote` in `@cocon/schemas`).
