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
- **FR-003**: The temperature check text is stored in °C and displayed in both scales (constitution V).
- **FR-004**: Step photos, when present, show full-width at radius 16 above the text.

## Success Criteria
- **SC-001**: For every serving size from 1 to 16, amounts in steps equal those in the ingredient tab (property test).

## Tracking (PostHog)
| Event | Properties |
| --- | --- |
| `step_timer_started` | step_index |

## Warnings and errors
All copy is in the States tables of the UI specs for: OC-RecipeSteps. New messages go there and in `strings/en.ts` first.

## Needs your attention
None.

## Changelog
- 2026-10-13: Ready. Decisions 1–34 applied; tracking added.
