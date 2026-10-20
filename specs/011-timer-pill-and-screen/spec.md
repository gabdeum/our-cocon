# Feature Specification: Timer pill and Timers screen

**Feature Branch**: `011-timer-pill-and-screen` · **Status**: Ready · **Depends on**: 010
**Input**: An always-visible pill for running timers, opening a screen that lists and controls all of them.
**Design**: canvas `TabBar` (pill), `OC-Timers`; components TimerPill, TimerCard (Timers screen variant), TimePresets, ScreenHeader (back link).

## User Scenarios & Testing

### User Story 1 — See my timer from anywhere (P1)
**Acceptance**: **Given** a running timer, **Then** the pill shows its name and clock above the tab bar on tab screens, sticky at the top of the recipe page, and in the cooking-mode header. With 2 or more running timers it shows "+N" (paused and done timers aren't counted).

### User Story 2 — Control all timers in one place (P1)
**Acceptance**: **Given** I tap the pill, **Then** the Timers screen lists every timer with progress, −1/+1, Pause/Resume and Stop. Done timers show "Add 1 more minute" and Dismiss.

### Edge cases
- No timers: the pill is hidden; the Timers screen shows "No timers running. Start one from any recipe step." plus the quick kitchen timers.
- A paused or done timer nobody touches for 3 hours is cleared from the list.
- The pill's label truncates at 14 characters with an ellipsis; the clock never truncates.

## Requirements

- **FR-001**: The pill renders the store's "most urgent" timer (spec 010) and updates every second.
- **FR-002**: The Timers screen header reads "Timers" with "N running · M total".
- **FR-003**: Card colours by state: running sage, paused surface-soft, done honey with a 2 px ink border.
- **FR-004**: "Quick kitchen timer" with 5 · 10 · 15 · 30 min: each adds and starts a "Kitchen timer" of that length.
- **FR-005**: A footnote reads: "Timers keep running when you leave the recipe. You'll hear a chime when one ends."

## Success Criteria
- **SC-001**: The pill is visible on 100% of screens while a timer exists (except sheets and dialogs that cover it).

## Tracking (PostHog)
| Event | Properties |
| --- | --- |
| `timer_pill_tapped` | timer_count |
| `timers_screen_opened` | timer_count |

## Warnings and errors
All copy is in the States tables of the UI specs for: TabBar, OC-Timers. New messages go there and in `strings/en.ts` first.

## Needs your attention
None.

## Changelog
- 2026-10-13: Ready. Decisions 1–34 applied; tracking added.
- 2026-10-19: Built. TimerPill above the tab bar and fixed 108 from the top of the recipe page (an overlay: React Native has no CSS sticky); Timers screen at `/timers`; "Open timers" on the done banner. Events `timer_pill_tapped`, `timers_screen_opened`. Deviations: timers now keep their recipe's name on the device (`recipeName`) for the card's sub-line; once only done timers are left, the pill shows one at 00:00, so it stays while any timer exists (SC-001); TimerCard aligned to `OC-Timers.dc.html` (Edit 13/900, "Set to" label, presets 15/900, Stop/Dismiss white 70%); the quick-timer button is the design-system dashed Button (54 tall, 15 px) instead of the screen's 56/16. The pill in the cooking-mode header comes with 012 (`AppTimerPill compact`).
- 2026-10-20: Changes from Gabriel's review. The pill's "+N" and screen-reader count include running timers only; its right padding is 14 without the "+N" chip. Paused and done timers untouched for 3 hours are cleared (`stoppedAt` on stored timers). Cards lose Edit and its "Set to" presets; the quick kitchen timer becomes "Quick kitchen timer" with 5 · 10 · 15 · 30 min (new component TimePresets). UI specs, screen source and READMEs updated to match.
