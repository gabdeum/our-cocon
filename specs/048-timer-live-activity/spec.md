# Feature Specification: Timers on the Lock Screen and in the Dynamic Island

**Feature Branch**: `048-timer-live-activity` · **Status**: Ready · **Depends on**: 010, 011, 046, 047
**Input**: While a timer runs, a Live Activity keeps it on the Lock Screen and in the Dynamic Island, counting down by itself, with "+1 min" and "Pause".
**Design**: `design/ui/OC-Notifications.md` › Live timer; screens `OC-NotifLockTimer`, `OC-NotifIsland`, `OC-NotifLockDone` (done state).

## User Scenarios & Testing

### User Story 1 — Glance at the locked phone (P1)
**Acceptance**: **Given** "Blind bake" (4:12 left) and "Pasta water" (11:40) are running, **When** I lock the phone, **Then** the Lock Screen shows the Timers card: "Blind bake", "Leek & bacon quiche · step 3", a countdown 4:12 that ticks every second, a honey progress bar, "Pasta water 11:40" below, and "+1 min" · "Pause".

### User Story 2 — Dynamic Island (P1)
**Given** an iPhone with a Dynamic Island and the app in the background, **Then** the island shows the timer icon and "4:12" (compact); a ring when another app shares the island (minimal); long-press expands it with name, countdown, progress and the two buttons.

### User Story 3 — It's done (P1)
**Given** "Blind bake" ends, **Then** the card turns honey: "Blind bake is done" with "Pasta water · 7:28 left" below; it stays until the done timer is dismissed, or 10 minutes, then shows the next running timer (or ends).

### Edge cases
- Paused (all timers): the card shows "Paused", the frozen time and "Resume" instead of "Pause".
- More than 2 timers: the card shows the most urgent (spec 010 FR-004) and "{label} {time} · +{n} more".
- Hidden timer pill (spec 011 FR-008) doesn't hide the Live Activity.
- "Timer on Lock Screen" off, or Live Activities off for the app in iPhone Settings: nothing is shown; alerts (047) still work.
- iOS ends a Live Activity after 8 hours; a timer longer than that keeps its alert.

## Requirements

- **FR-001**: One Live Activity per device for all timers. Start it when the first timer starts (the app is in the foreground then), update it on every store change, end it when no running or done timer is left. Re-attach on app launch (`getInstances()`).
- **FR-002 Content state**: `{ primary: { label, sub, endsAt?, pausedRemaining?, totalSeconds, state }, others: { label, endsAt? }[], othersCount }`. The countdown and progress are drawn by the system from `endsAt` (SwiftUI timer text and `ProgressView(timerInterval:)`), so the app sends no per-second updates.
- **FR-003 Layouts** (as drawn): Lock Screen card on `surface-page` (done: honey); Dynamic Island compact (timer icon in honey + time), minimal (honey progress ring), expanded (icon, name, "{recipe} · +{n} more", time, progress, buttons on `#2E2E2E`).
- **FR-004 Buttons** (iOS 17+, App Intents run without opening the app): "+1 min" adds 60 s to the primary timer; "Pause" / "Resume" toggles it. Both update the timer store, the alert schedule (047) and the activity. Tapping elsewhere opens `/timers`.
- **FR-005 Tech**: build it with `expo-widgets` (SDK 57+; Live Activity layout in `@expo/ui/swift-ui`, no `widgets[]` entry). Before building, check that it can render a self-updating timer text and interactive buttons; if either is missing, write the Live Activity as a small native SwiftUI target instead (e.g. with `@bacons/apple-targets`) and keep starting/updating it from JS. No push updates needed: timers live on the device.

## Success Criteria
- **SC-001**: The Lock Screen countdown never drifts more than 1 s from the in-app timer over 30 minutes (device test).
- **SC-002**: "+1 min" from the Lock Screen updates the card, the in-app timer and the alert within 1 s.

## Tracking (PostHog)
| Event | Properties |
| --- | --- |
| `timer_live_activity_started` | timer_count |
| `timer_live_activity_action` | action (add_minute, pause, resume) |

## Warnings and errors
No error copy; if the system refuses to start the activity, nothing is shown and the app keeps working.

## Needs your attention
- Confirm the FR-005 check result in the PR description (expo-widgets vs native target).

## Changelog
- 2026-11-02: Ready. From Gabriel's notifications brief ("a permanent notification while timers are on").
