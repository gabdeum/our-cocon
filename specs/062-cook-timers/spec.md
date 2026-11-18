# Feature Specification: Timers from cooking mode

**Feature Branch**: `062-cook-timers` · **Status**: Ready · **Depends on**: 011, 012
**Input**: Gabriel: "Add the access to quick timers from the cooking mode (brings the timer drawer), put it in a round button next to the settings button on the top right corner (on the left of the settings button)." Gabriel chose the sheet's content: running timers and the quick timers.
**Design**: `design/ui/OC-Cook.md` (header, item 6); screen `OC-Cook` (the button).

## User Scenarios & Testing

### User Story 1 — A quick timer without leaving the steps (P1)
**Acceptance**: **Given** cooking mode, **When** I tap the round timer button left of "Cooking options", **Then** the "Timers" sheet opens with every timer (as on Timers) and "Quick kitchen timer" 5 · 10 · 15 · 30 min; **When** I tap "10 min", **Then** a 10-minute kitchen timer starts and its card shows in the sheet.

### User Story 2 — Manage the timers going (P1)
**Given** "Blind bake" running, **When** I open the sheet, **Then** its card has −1/+1, Pause and Stop, and "Go to step", which closes the sheet and goes to that step.

### Edge cases
- No timers: "No timers running. Start one from any recipe step." above the quick timers.
- A timer from another recipe, or a kitchen timer: no "Go to step".
- Done timers shown in the open sheet count as seen (spec 047), as on Timers.

## Requirements
- **FR-001**: An IconButton `--round` with the timer icon, label "Timers", between the TimerPill and "Cooking options" (CookLayout `timersLabel`, `onTimers`).
- **FR-002**: BottomSheet "Timers" (close label "Close timers") with the Timers screen's list (`TimerList`, shared with `/timers`).
- **FR-003**: "Go to step" only for this recipe's timers whose step is shown; it closes the sheet and jumps there.

## Success Criteria
- **SC-001**: A quick timer starts in two taps from any step.

## Tracking (PostHog)
| Event | Properties |
| --- | --- |
| `cook_timers_opened` | timer_count |

Starting a timer from the sheet sends the store's own events, as on Timers.

## Warnings and errors
None.

## Needs your attention
None. A JS update is enough (no native change).

## Changelog
- 2026-11-17: Ready and built. `components/timers/TimerList.tsx` (the cards, the empty line and the quick timers, with `useSeenDone`) is now used by the Timers screen and by cooking mode's "Timers" sheet; CookLayout has the optional timer button (README updated); OC-Cook.dc.html has the button, and OC-Cook.md the button and the sheet (the screen source draws no sheets, as for "Cooking options"). Event: `cook_timers_opened`.
