# Feature Specification: Timer pill and Timers screen

**Feature Branch**: `011-timer-pill-and-screen` · **Status**: Ready · **Depends on**: 010
**Input**: An always-visible pill for running timers, opening a screen that lists and controls all of them.
**Design**: canvas `TabBar` (pill), `OC-Timers`; components TimerPill, TimerCard (Timers screen variant), Button (dashed), ScreenHeader (back link).

## User Scenarios & Testing

### User Story 1 — See my timer from anywhere (P1)
**Acceptance**: **Given** a running timer, **Then** the pill shows its name and clock above the tab bar on tab screens, sticky at the top of the recipe page, and in the cooking-mode header. With 2 or more timers it shows "+N".

### User Story 2 — Control all timers in one place (P1)
**Acceptance**: **Given** I tap the pill, **Then** the Timers screen lists every timer with progress, −1/+1, Edit (5 · 10 · 15 · 30 min), Pause/Resume and Stop. Done timers show "Add 1 more minute" and Dismiss.

### Edge cases
- No timers: the pill is hidden; the Timers screen shows "No timers running. Start one from any recipe step." plus the quick kitchen timer.
- The pill's label truncates at 14 characters with an ellipsis; the clock never truncates.

## Requirements

- **FR-001**: The pill renders the store's "most urgent" timer (spec 010) and updates every second.
- **FR-002**: The Timers screen header reads "Timers" with "N running · M total".
- **FR-003**: Card colours by state: running sage, paused surface-soft, done honey with a 2 px ink border.
- **FR-004**: "+ Quick kitchen timer (5 min)" adds and starts one.
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
