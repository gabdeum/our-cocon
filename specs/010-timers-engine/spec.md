# Feature Specification: Timers engine

**Feature Branch**: `010-timers-engine` · **Status**: Ready · **Depends on**: 002
**Input**: App-wide timers that keep running across screens and reloads, can be adjusted while running, and alert at zero.

## User Scenarios & Testing

### User Story 1 — Several things cooking at once (P1)
**Acceptance**: **Given** "Blind bake" (12 min) and "Soften leeks" (8 min) are running, **When** I go to Groceries and back, **Then** both are still counting and correct.

### User Story 2 — Adjust on the fly (P1)
**Acceptance**:
1. **Given** a running timer at 05:10, **When** I tap +1, **Then** it shows 06:10 and keeps running.
2. **Given** 00:50, **When** I tap −1, **Then** it shows 00:30 (the minimum when reducing).
3. **Given** a timer, **When** I choose Edit › 15 min, **Then** it resets to 15:00 with the same running state.

### User Story 3 — Know when it's done (P1)
**Given** a timer reaches 0, **Then** a sound plays, the phone vibrates, an in-app banner "Blind bake is done" appears on any screen, and the timer shows "Done!".

### Edge cases
- Reload or app restart: timers resume from their stored end times; one that ended while closed shows "Done!" right away.
- Timers are personal: they live on the device that started them and aren't shared with the family.
- Background alerts when the app is closed come with phone notifications in V2; V1 alerts only while the app is open.

## Requirements

- **FR-001**: The timer store keeps `{id, label, recipeId?, stepId?, totalSeconds, endsAt | remainingSeconds, state: running|paused|done}`, persisted to device storage.
- **FR-002**: Actions: start, pause, resume, add(±60 s), set(seconds), stop, dismiss, and quick kitchen timer (5 min, label "Kitchen timer").
- **FR-003**: Time is computed from `endsAt`, never by decrementing, so it stays accurate when the app sleeps.
- **FR-004**: The store exposes a selector for "most urgent": running with the least time left, otherwise paused with the least time left.
- **FR-005**: The alert is a soft kitchen-bell chime (a short royalty-free sound in the app's assets), played twice. Sound and vibration follow the device's silent mode.

## Success Criteria
- **SC-001**: Drift is under 1 s over 60 minutes.
- **SC-002**: 10 simultaneous timers run without visible lag.

## Tracking (PostHog)
| Event | Properties |
| --- | --- |
| `timer_started` | from (step, quick) |
| `timer_adjusted` | delta_min |
| `timer_finished` | — |

## Warnings and errors
No copy; Timers screen and TimerPill (spec 011) own the messages.

## Needs your attention
None.

## Changelog
- 2026-10-13: Ready. Decisions 1–34 applied; tracking added.
