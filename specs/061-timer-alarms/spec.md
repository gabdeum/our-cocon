# Feature Specification: Timer alarms that always ring (iOS 26)

**Feature Branch**: `061-timer-alarms` · **Status**: Ready · **Depends on**: 047, 048
**Input**: Gabriel: "Move the kitchen alarms to use AlarmKit for iPhones on iOS 26+, so it always rings (even when on mute)."
**Design**: `design/ui/OC-Notifications.md` › Timer alarm; the ringing card is OC-NotifLockDone's done card.

## User Scenarios & Testing

### User Story 1 — It rings, even on silent (P1)
**Acceptance**: **Given** an iPhone on iOS 26 with alarms allowed, its silent switch on and a Focus on, **When** "Blind bake" reaches zero (locked, in another app, or with Our Cocon open), **Then** the phone rings with the kitchen-bell chime and shows "Blind bake is done" until "Stop" or "+1 min" is tapped.

### User Story 2 — One more minute, or stop (P1)
**Given** the ringing alarm, **When** I tap "+1 min", **Then** it stops, the timer runs again for a minute (the Lock Screen card too) and rings again at its end, without opening the app. **When** I tap "Stop", **Then** it stops and the done timer is dismissed.

### User Story 3 — The app open (P1)
**Given** Our Cocon is open when a timer ends, **Then** the alarm rings (the app plays no chime of its own) and the app shows its "Blind bake is done" toast. Opening Timers doesn't stop it; Dismiss or "Add 1 more minute" there does.

### Edge cases
- iOS before 26, or alarms refused: spec 047's notifications, as before.
- First timer started: iOS asks for alarms. Refused, the app's notifications question (spec 046) follows; allowed, it doesn't come.
- A timer started before alarms were allowed (its notification was already set): at the next check its notification goes and its alarm is set.
- "Alert when a timer ends" off: no alarm. Sign-out, or another person signing in: every alarm goes.
- Paused, stopped, dismissed, cleared: the alarm is cancelled at once (spec 047 SC-002).
- No follow-up: the alarm rings until it's stopped.

## Requirements

- **FR-001**: With alarms allowed, each running timer has one AlarmKit alarm at `endsAt` (rounded up to the second, none under a second away) in place of spec 047's two notifications, through the same scheduler: start, resume, ±1 min and set (re)schedule it; pause, stop, dismiss and clear cancel it. Calls reach the phone in the order the app made them.
- **FR-002 Permission**: asked on the first timer started (`NSAlarmKitUsageDescription`: "Our Cocon rings when a kitchen timer ends, even when your iPhone is on silent."). Read again whenever the app comes back.
- **FR-003 Content**: title "{label} is done"; sub "{recipe} · step {n}" or "{n}-minute kitchen timer"; buttons "+1 min" and "Stop"; sound `kitchen-bell.caf` (spec 047's, in the app bundle); tint honey.
- **FR-004 Buttons**: App Intents in the app (iOS runs them in the app's process, locked or closed). They stop the alarm and, as the Lock Screen card's buttons do (spec 048), move the card if it shows that timer and leave a tap the timer store applies as at its moment. "Stop" = Dismiss; "+1 min" = "Add 1 more minute", with a new alarm.
- **FR-005 Live Activity**: the widget extension draws the ringing alarm's Live Activity (AlarmKit needs it; without one the Dynamic Island shows an empty pill), as OC-Notifications › Timer alarm.
- **FR-006**: The app never hides a ringing alarm: a timer ending on screen, and Timers being open, leave it ringing. The in-app chime and vibration don't play while alarms are in use; the toast still shows.

## Success Criteria
- **SC-001**: On a locked iPhone on silent with a Focus on, the alarm rings within 1 s of `endsAt` (device test).
- **SC-002**: No alarm ever rings for a paused or stopped timer (unit tests on the scheduler, as 047 SC-002).

## Tracking (PostHog)
| Event | Properties |
| --- | --- |
| `timer_alarms_permission_result` | granted |
| `timer_alert_action` (047's, from the alarm's buttons) | action (add_minute, stop) |

## Warnings and errors
No error copy. If iOS refuses an alarm, the timer still works in the app.

## Needs your attention
- This needs a new build (`pnpm release:ios`, and a new development build for `pnpm dev:phone`): a new Info.plist key, native code in the app module and the widget, and the app target now compiles `TimerAlarms.swift`. A JS update alone changes nothing on phones: the app sees no alarm module and keeps notifications.
- The Swift was written without Xcode (none on the laptop): the EAS build is its first compile. Points to check if it fails: the `AlarmPresentation.Alert` initializers (26.0 with `stopButton`, 26.1+ without), `AlarmManager.AlarmConfiguration.alarm(schedule:attributes:stopIntent:secondaryIntent:sound:)`, and `import CoconLiveTimer` from the app target (the app's side of the bridge; if that import isn't seen there, the build still passes but the app sees no alarms).
- Device checks on iOS 26 (development build, then TestFlight): the alarm on a locked phone on silent and in a Focus (SC-001); the kitchen bell rather than iOS's default tone (developers report AlarmKit sometimes falls back to its own); "+1 min" and "Stop" with the app swiped away, then open the app (same time on Timers, the card moved); with the app open at zero (one sound, the toast); the ringing card on the Lock Screen and in the Dynamic Island; the first-timer question; an iPhone on iOS 18 still gets 047's notifications.
- From iOS 26.1 the system draws its own "Stop" on the alarm (the word can't be set). Some developers report the Stop intent may not run when the alarm is stopped from an unlocked phone: the timer then stays "Done!" in the app until dismissed (nothing rings again).

## Changelog
- 2026-11-17: Ready, from Gabriel's request. Built. AlarmKit alarms in place of 047's notifications on iOS 26 once allowed (`lib/timer-alarms.ts`: the rules and permission; `targets/timer-activity/_shared/TimerAlarms.swift`: the alarms, their intents and the app's side of the bridge; `modules/live-timer/ios/TimerAlarmsBridge.swift`: the module finds the app's class by name, as a pod can't see the app's types; `targets/timer-activity/TimerAlarmWidget.swift`: the ringing Live Activity). `createTimerAlerts` takes `alarms` (one alert, no follow-up, `rings`); the timer store leaves a ringing alarm alone; the Lock Screen card's buttons move the alarm; alarm taps go through the card's tap queue with `source: 'alarm'` and count as `timer_alert_action`. `Theme.swift` moved to `_shared` so the app target has the tokens too (`pnpm theme` writes it there). Events: `timer_alarms_permission_result`. Deviations: none from this spec; Settings' timer switch with alarms is left for later (032-later L157).
- 2026-11-17: Security review. Sign-out (however the session ended) or a switch to another person clears every alarm natively (`TimerAlarms.clear`), and a "+1 min" tap already under way, on the alarm or the Lock Screen card, can no longer set an alarm after it (an epoch read when the tap began). If iOS can't list the alarms, the saved list is kept, so clearing still cancels each one. Taps from someone else's alarm were already dropped by the app (owner check, as 048's).
- 2026-11-17: First EAS build: `import CoconLiveTimer` in `TimerAlarms.swift` is now `internal import`, as Expo's generated module list imports it (Swift refuses a module imported at two access levels).
