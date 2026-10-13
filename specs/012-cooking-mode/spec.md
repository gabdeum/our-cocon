# Feature Specification: Cooking mode

**Feature Branch**: `012-cooking-mode` · **Status**: Ready · **Depends on**: 009, 010
**Input**: A distraction-free, scrolling, step-by-step view for cooking at the counter.
**Design**: canvas `OC-Cook`; Patterns.md "Cooking mode"; components Progress (`--cook`), TimerCard (dark), Callout, StatusBanner (`oc-awake`), TimerPill, Button.

## User Scenarios & Testing

### User Story 1 — Follow steps hands-free-ish (P1)
**Acceptance**:
1. **Given** step 1 is current, **When** I tap "Next step", **Then** the page scrolls smoothly so step 2 is at the top, step 2 is full opacity and the others are dimmed.
2. **Given** I swipe up, **Then** the step bar and "Step N of M" follow the step whose top passes 35% of the scroll area.
3. **Given** I tap the 5th segment of the bar, **Then** it jumps to step 5.

### User Story 2 — Timers right in the step (P1)
**Given** a timed step, **Then** a large dark TimerCard with −1/+1 and Start/Pause sits in it, and started timers show in the header pill.

### User Story 3 — The screen doesn't sleep (P1)
**Given** cooking mode is open and "Keep screen on" applies (spec 027), **Then** the screen doesn't lock, and the header shows "Screen stays on" when no timer pill is shown.

### Edge cases
- The last step's Next button reads "Finish": it closes cooking mode and returns to the recipe, with no prompt.
- Cooking mode uses the recipe page's current servings, variants and units.
- On the web the screen stays on through the Wake Lock API where supported; otherwise a muted hint explains it.

## Requirements

- **FR-001**: Fixed header (Exit, pill or awake chip, step bar, "Step N of M · Serves 6"); scrolling body with scroll-snap; fixed footer (Back ⅓, Next ⅔, 60 tall).
- **FR-002**: Each step section is at least 500 px tall; non-current steps are at `opacity-dimmed` with a 250 ms transition.
- **FR-003**: Step text uses `body-cook` (21/600) with honey amount highlights.
- **FR-004**: Programmatic scrolling from Next, Back or a bar tap suppresses scroll-tracking for 700 ms to avoid flicker.
- **FR-005**: Keep-awake turns on when entering and off when leaving.

## Success Criteria
- **SC-001**: In testing, users complete a 6-step recipe without touching anything but Next, timers and Exit.

## Tracking (PostHog)
| Event | Properties |
| --- | --- |
| `cooking_started` | step_count |
| `cooking_finished` | step_count, minutes |
| `cooking_exited` | at_step, step_count |

## Warnings and errors
All copy is in the States tables of the UI specs for: OC-Cook. New messages go there and in `strings/en.ts` first.

## Needs your attention
None.

## Changelog
- 2026-10-13: Ready. Decisions 1–34 applied; tracking added.
