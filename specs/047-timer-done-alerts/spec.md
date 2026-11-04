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

- **FR-001**: Local notifications (no server): on start, resume, ±1 min or set, (re)schedule one notification at `endsAt` with identifier `timer:{id}`; cancel it on pause, stop, dismiss or clear. Schedule the follow-up `timer:{id}:again` at `endsAt + 120 s`; cancel both when the timer is acted on or the app opens on Timers. Both requests reach the iPhone in the same moment as the action, with nothing waiting in front of them: the phone can be locked right after a timer starts or changes and the alert still comes on time.
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
- The notification sound is bundled into the app (`app.json`), so this needs a new development build, and a `pnpm release:ios` build before it reaches TestFlight; a JS update isn't enough.
- "+1 min" and "Stop" open the app (unlocking if needed) instead of running in the background as FR-003 says. expo-notifications tells iOS the tap is handled before the app's code runs, so in the background iOS can pause the app first and the action would only happen when the app is next opened. Running them without opening the app needs a small native change (032-later L120).
- Background audio is now off (`app.json`, expo-audio): it let the app keep running unseen after the chime. That needs a new development build, and `pnpm release:ios` before TestFlight; the JavaScript fixes work on the current build.
- Device checks on a locked iPhone: the alert within 1 s of zero (SC-001), the chime, breaking through a Focus that allows time-sensitive notifications, and "+1 min" / "Stop" with the app swiped away (fully closed). iOS hands these actions to the app's code when it wakes it in the background; Expo's docs warn this may not happen once the app has been fully closed. If "+1 min" does nothing then, the follow-up still comes, and the fix is to let "+1 min" open the app.

## Changelog
- 2026-11-02: Ready. Does 032-later L18.
- 2026-11-03: Built. Local notifications on the iPhone (`lib/timer-alerts.ts` for the rules, `lib/timer-notifications.ios.ts` for expo-notifications; none on the web): every timer store action schedules or cancels `timer:{id}` at `endsAt` and `timer:{id}:again` 2 minutes later (thread `timers`, `timeSensitive`, category `timer_done`, sound `kitchen-bell.caf`), only while notifications are allowed and "Alert when a timer ends" is on. On start and when the app comes back, the phone's timer notifications are matched to the timers again. "+1 min" and "Stop" run without opening the app, through the timer store when the app is running or straight to the saved timers when it isn't (a store that loads meanwhile waits for that write). Step timers now remember their step number, for "· step 3" (one started before this build says just the recipe). However the session ends (Sign out, expired, signed out elsewhere), every timer notification goes, and an action from one left behind does nothing unless its person is the one signed in (security review; the payload only takes a timer id and a user id in their own formats). Events: `timer_alert_action` (add_minute, stop, open), `timer_alert_followup_sent` (counted when the app next opens, once per follow-up whose time came without being cancelled). Deviations: the follow-up is also cancelled once the in-app alert has played (the app was open when the timer ended, or reopened before the 2 minutes), not only when Timers opens; the sound is the chime twice, 1.4 s apart (2.6 s), like the in-app alert; the Live Activity part of "+1 min" waits for 048 (032-later L119). Lock Screen checks are device checks (Needs your attention).
- 2026-11-03: Fix, after testing on Gabriel's iPhone. Alerts went missing when the phone was locked soon after starting or changing a timer: the app sent its requests to the iPhone one at a time, after other checks, and iOS pauses an app a few seconds after it's locked, so a request still waiting was sent only when the app came back. Now both requests go out in the same moment as the tap (the iPhone takes them in order, so the last change wins), and the re-check when the app comes back runs beside them, leaving alone any timer changed meanwhile. Added to FR-001 at Gabriel's request: no wait before locking the phone.
- 2026-11-03: Fix, after a full review (the fix above didn't work on Gabriel's iPhone; it was pushed before he'd tried it). What was wrong: (1) each launch removed every timer notification: the sign-out clean-up also ran while the session was still loading; (2) the app can keep running unseen in the background (expo-audio turns on background audio by default), and a timer reaching zero then counted as seen in the app, which removed the iPhone's alert as it arrived and cancelled the follow-up; (3) the Timers screen counted done timers as seen while another screen was on top of it, or the phone was locked; (4) iOS drops the fraction of a second, so an alert could come up to 1 s early, and one less than a second away was refused; (5) a follow-up arriving with the app open was hidden. Now: clean-up only after a real sign-out; a timer counts as seen only if the app was on screen and ticking right up to zero, otherwise the iPhone's alert and follow-up stay, and with the app open the iPhone's alert shows when the app won't play its own; the Timers screen counts only while it is the screen in front; alert times are rounded up to the second; the follow-up shows even with the app open; background audio is off (next build). Deviations: "+1 min" and "Stop" open the app (Needs your attention); the follow-up is no longer cancelled by reopening the app, only as FR-001 says (acted on, or Timers opened).
- 2026-11-03: Security review of the fix: switching straight from one person to another also removes the last one's alerts; with the app open, the iPhone's banner shows only alerts this phone scheduled for whoever is signed in; the sign-out clean-up runs after any Lock Screen action already under way. Tested on Gabriel's iPhone before this review (development build with background audio still on).
