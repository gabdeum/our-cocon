# Feature Specification: Timer-done alerts when the app is closed

**Feature Branch**: `047-timer-done-alerts` · **Status**: Ready · **Depends on**: 010, 011, 046
**Input**: When a timer ends while the phone is locked or the app is in the background, the iPhone chimes and shows "Blind bake is done", with "+1 min" and "Stop". Does 032-later L18.
**Design**: `design/ui/OC-Notifications.md` › Timer done; screen `OC-NotifLockDone`.

## User Scenarios & Testing

### User Story 1 — Hear it from the other room (P1)
**Acceptance**: **Given** "Blind bake" is running and the phone is locked, **When** it reaches zero, **Then** the phone plays the kitchen-bell chime and shows "Blind bake is done" / "Leek & bacon quiche · step 3", breaking through a Focus that allows time-sensitive alerts.

### User Story 2 — One more minute (P1)
**Given** the notification, **When** I long-press it and tap "+1 min", **Then** the timer runs again for 1 minute without opening the app, and a new alert is scheduled. "Stop" ends the timer.

### User Story 3 — Didn't see it (P2)
**Given** nobody acted on the alert, **Then** 2 minutes later one follow-up arrives: "Still waiting: Blind bake" / "Done 2 minutes ago." Never more than one.

### Edge cases
- App open: no system notification; the in-app alert of spec 010 plays instead.
- Paused, stopped, dismissed or cleared timers: their pending alert is cancelled at once.
- Two timers ending together: two notifications, grouped in one stack ("timers" thread).
- "Alert when a timer ends" off, or notifications off: no alert; the timer shows "Done!" on return (as today).
- Phone restarted: pending local notifications survive; the timer store reloads from `endsAt` (spec 010 FR-003).

## Requirements

- **FR-001**: Local notifications (no server): on start, resume, ±1 min or set, (re)schedule one notification at `endsAt` with identifier `timer:{id}`; cancel it on pause, stop, dismiss or clear. Schedule the follow-up `timer:{id}:again` at `endsAt + 120 s`; cancel both when the timer is acted on or the app opens on Timers.
- **FR-002 Content**: title "{label} is done"; body "{recipe name} · step {n}" for step timers, "{n}-minute kitchen timer" for quick timers. Follow-up: "Still waiting: {label}" / "Done {n} minutes ago." Thread `timers`, interruption level `timeSensitive`, sound `kitchen-bell.caf` (the spec 010 chime, ≤ 30 s, in the app bundle).
- **FR-003 Actions** (category `timer_done`): "+1 min" (runs in the background: adds 60 s, reschedules, updates the Live Activity of spec 048) and "Stop" (destructive). Tapping the notification opens `/timers`.
- **FR-004**: Timers stay per person per device (spec 010): alerts only on the phone that started the timer.

## Success Criteria
- **SC-001**: The alert fires within 1 s of `endsAt` with the phone locked (device test on TestFlight).
- **SC-002**: No alert ever fires for a paused or stopped timer (unit tests on the schedule/cancel calls for every store action).

## Tracking (PostHog)
| Event | Properties |
| --- | --- |
| `timer_alert_action` | action (add_minute, stop, open) |
| `timer_alert_followup_sent` | — |

## Warnings and errors
No error copy. If scheduling fails (permission revoked meanwhile), the timer still works in the app.

## Needs your attention
None.

## Changelog
- 2026-11-02: Ready. Does 032-later L18.
