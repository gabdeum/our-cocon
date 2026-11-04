# Feature Specification: Timers on the Lock Screen and in the Dynamic Island

**Feature Branch**: `048-timer-live-activity` · **Status**: Ready · **Depends on**: 010, 011, 046, 047
**Input**: While a timer runs, a Live Activity keeps it on the Lock Screen and in the Dynamic Island, counting down by itself, with "+1 min" and "Pause".
**Design**: `design/ui/OC-Notifications.md` › Live timer; screens `OC-NotifLockTimer`, `OC-NotifIsland`, `OC-NotifLockDone` (done state).

## User Scenarios & Testing

### User Story 1 — Glance at the locked phone (P1)
**Acceptance**: **Given** "Blind bake" (4:12 left) and "Pasta water" (11:40) are running, **When** I lock the phone, **Then** the Lock Screen shows the Timers card: "Blind bake", "Leek & bacon quiche · step 3", a countdown 4:12 that ticks every second, a honey progress bar, "Pasta water 11:40" below, and "−1 min" · "+1 min" · "Pause".

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
- **FR-004 Buttons** (iOS 17+, App Intents run without opening the app): "+1 min" adds 60 s to the primary timer, "−1 min" takes 60 s off (never below 0:30, as in the app); "Pause" / "Resume" toggles it. All update the timer store, the alert schedule (047) and the activity. Tapping elsewhere opens the timer's step in cooking mode (`/timers` for a quick timer); the "{n} running" pill opens `/timers`.
- **FR-005 Tech**: build it with `expo-widgets` (SDK 57+; Live Activity layout in `@expo/ui/swift-ui`, no `widgets[]` entry). Before building, check that it can render a self-updating timer text and interactive buttons; if either is missing, write the Live Activity as a small native SwiftUI target instead (e.g. with `@bacons/apple-targets`) and keep starting/updating it from JS. No push updates needed: timers live on the device.

## Success Criteria
- **SC-001**: The Lock Screen countdown never drifts more than 1 s from the in-app timer over 30 minutes (device test).
- **SC-002**: "+1 min" from the Lock Screen updates the card, the in-app timer and the alert within 1 s.

## Tracking (PostHog)
| Event | Properties |
| --- | --- |
| `timer_live_activity_started` | timer_count |
| `timer_live_activity_action` | action (add_minute, remove_minute, pause, resume) |

## Warnings and errors
No error copy; if the system refuses to start the activity, nothing is shown and the app keeps working.

## Needs your attention
- FR-005 check: expo-widgets can draw the self-updating countdown and progress bar, but its buttons can't do FR-004. A button's `onPress` runs only inside the widget and can't reach the app, so a "+1 min" with the phone locked would move the card while the timer and its alert stayed on the old time (SC-002). So the card is a small native SwiftUI target (`@bacons/apple-targets`, `apps/app/targets/timer-activity`), started and updated from the app through its own module (`apps/app/modules/live-timer`). Its buttons are Live Activity intents, which iOS runs in the app even with the phone locked and the app closed.
- This needs a new development build, and a `pnpm release:ios` build before it reaches TestFlight: a new widget extension, a native module and `NSSupportsLiveActivities` in `app.json`. The widget's Swift is compiled only by that build (there's no Xcode on the laptop), so the first build is also its first compile.
- Device checks (development build, then TestFlight): the countdown on the Lock Screen and in the Dynamic Island, the honey done card at zero with the phone locked, "+1 min" and "Pause" with the app swiped away (then open the app: same time on the Timers screen, and the alert comes at the new time), no drift over 30 minutes (SC-001), and Nunito in the card (if iOS doesn't load it in the widget, the card shows the system font).
- iPhones on iOS 16 get no card (the buttons need iOS 17); alerts (047) still work there.

## Changelog
- 2026-11-02: Ready. From Gabriel's notifications brief ("a permanent notification while timers are on").
- 2026-11-04: Built. One Live Activity per phone for all timers (`lib/live-activity.ts` decides what it shows; `targets/timer-activity` draws it in SwiftUI; `modules/live-timer` starts, updates and ends it). It starts with the first timer while the app is on screen, follows every timer store change, re-attaches on launch, and ends when nothing is running or recently done, when "Timer on Lock Screen" is off, on sign-out (however the session ended) and when someone else signs in. iOS counts down and fills the bar from `endsAt`; at zero it turns the card done by itself (stale date), so no updates are sent while the app sleeps. "+1 min" and "Pause"/"Resume" (iOS 17+) change the card and move the timer's two alerts (047) at once, then the timer store applies each tap as at the moment of the tap when the app's code next runs (at once if it's running). Taps from someone else's card are dropped. Every word comes from `strings/en.ts` › `liveTimer`; colours are tokens, generated into `Theme.swift` and the widget's icons by `pnpm theme`. Events: `timer_live_activity_started` (timer_count), `timer_live_activity_action` (add_minute, pause, resume, counted when the app reads the tap). Also does 032-later L119. Deviations: native target instead of expo-widgets (FR-005, see Needs your attention); iOS 17+ only; the content state is FR-002 plus the primary timer's id, its words and its alerts, and `others` holds only the next timer (`othersCount` counts them all); with the app asleep, a done timer's 10 minutes, a second timer reaching zero and the order after "+1 min" catch up only when the app next runs (032-later L121); the progress bar is the system's, stretched to the drawn height; the island's colours (#CFC6B0, #3A3A3A, #2E2E2E) became tokens `island-sub`, `island-track`, `island-button`; copy not drawn is in `design/ui/OC-Notifications.md` ("{n} paused" when every timer is paused, the bell and "{label} is done" in the island once done).
- 2026-11-04: Security review. Sign-out (however the session ended) or a switch to another person ends the card, and a sync already under way can no longer bring it back with the last person's timers; the app updates only the signed-in person's card and ends anyone else's; the card's two buttons aren't offered in Shortcuts, Siri or Spotlight. Left as is: a button on a card left from a session that expired while the app was closed still moves that person's alerts until the app next opens and removes them (the app drops the tap).
- 2026-11-04: After testing on Gabriel's iPhone. The card lost its top and bottom padding: iOS cuts a Lock Screen Live Activity at 160 pt and the drawn card is about 205, so its gaps are tightened (padding 12, gaps 6, mark 24, header 26, buttons 36; the words keep their sizes). A tap shows on the card faster (the card changes before the alerts move). Opening the app after a tap on the card shows the new time at once: the taps are applied before the timers are shown on the card again (the old time used to come back for a moment). A paused timer showed 0:00 on the card: the stopped time is now plain text. Added at Gabriel's request: "−1 min" on the card and in the island (`remove_minute` in `timer_live_activity_action`); a tap on the card opens the timer's step in cooking mode (Timers for a quick timer), and "{n} running" became a pill that opens Timers (screens and UI spec updated). With three buttons, the next timer's line on the card has less room and may be cut short.
