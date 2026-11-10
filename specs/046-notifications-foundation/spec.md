# Feature Specification: Notifications foundation, permission and settings

**Feature Branch**: `046-notifications-foundation` · **Status**: Ready · **Depends on**: 003, 029
**Input**: Everything the three notification features share: asking for permission at the right moment, a Notifications page in the Menu, registering each phone for push, sending pushes from the server, and opening the right screen when a notification is tapped. iPhone first; the data and sender are platform-neutral so Android can follow (032-later L72).
**Design**: `design/ui/OC-SettingsNotif.md`, `design/ui/OC-Notifications.md`; screens `OC-NotifAsk`, `OC-SettingsNotif`, `OC-SettingsNotifOff`, `OC-Menu` (new row); components BottomSheet, Button, SettingRow (switch), SegmentedControl, ListRow, StatusBanner.

## User Scenarios & Testing

### User Story 1 — Asked once, when it makes sense (P1)
**Acceptance**: **Given** notifications were never asked on this phone, **When** Gabriel starts his first timer (or saves his first event with a reminder), **Then** the sheet "Know when it’s done" explains why; "Turn on notifications" shows the iPhone permission prompt; "Not now" closes it. The app never asks at launch.

### User Story 2 — Control it in one place (P1)
**Given** Menu › Notifications, **Then** Gabriel sees Timers (Timer on Lock Screen, Alert when a timer ends), Event reminders (on/off, Remind me about: Events I’m on · All family events, Default for new events), all saved instantly for him on this phone (the default reminder follows him on every phone).

### User Story 3 — Turned off in iPhone Settings (P1)
**Given** notifications are off for Our Cocon in iPhone Settings, **Then** the page shows the warning card "Notifications are off for Our Cocon" with "Open iPhone Settings", and the switches are dimmed.

### User Story 4 — Tap goes to the right place (P1)
**Given** any Our Cocon notification, **When** tapped, **Then** the app opens on its screen: a timer → Timers; an event reminder → that event (that occurrence).

### Edge cases
- "Not now": the sheet can show once more, no sooner than 14 days later, at the same moments; after that only the Notifications page offers it.
- Denied in the system prompt: no more sheets; the page shows the off state.
- Signed out: this phone's push registration is removed, so reminders stop.
- Two family members on one iPad: registration follows whoever is signed in.
- Web: the Menu row shows; the page says "Notifications work in the iPhone app." (browser notifications are later).

## Requirements

- **FR-001 Build**: `expo-notifications` (and, for 048, `expo-widgets`) need a development build; Expo Go is no longer enough for the iPhone app (constitution I and II updated). Capabilities: Push Notifications, Time Sensitive Notifications. APNs key and Expo access token are EAS/CI secrets (`EXPO_ACCESS_TOKEN` on the server, never in the app).
- **FR-002 Ask** (OC-NotifAsk): triggers = first timer start, first time an event with a reminder is saved, or the page's "Turn on". Copy in `OC-Notifications.md`. Stored per device: `asked_at`, `asked_count` (max 2), last result.
- **FR-003 Page** `/settings/notifications` (Menu › Settings, first card, after AI assistants: "Notifications" / "Timers, event reminders" ›): per-device preferences `timers_live` (default on), `timers_alert` (on), `reminders_on` (on), `reminders_scope` mine|all (mine); per-member `default_reminder` (none|minutes_15|hour_before|morning_of|day_before, default none) used to pre-fill the Reminder in Add event (spec 041).
- **FR-004 Devices**: table `push_devices` (id, member_id, device_id, platform ios|android, expo_push_token, live_activity_start_token?, prefs jsonb, app_version, last_seen_at, disabled_at) — RLS: a member reads and writes only their own rows. Registered after permission is granted and on every app start (token refresh, `last_seen_at`); deleted on sign-out; disabled when Expo reports `DeviceNotRegistered`.
- **FR-005 Sender**: one server module `packages/notify` (Expo Push API: batches of 100, tickets, receipts checked after 15 minutes), run by a small worker `apps/notifier` on Hetzner beside the MCP server (one per environment, `-staging` host suffix as usual). Uses the service role; logs every send in `notification_log` (kind, member_id, device_id, ref, sent_at, status).
- **FR-006 Payload**: every notification carries `data: { kind: "timer_done" | "reminder", route }`. Tapping opens `route` with Expo Router (cold start included). While the app is open, the foreground handler shows no system banner: timers use the in-app alert (spec 010), reminders a StatusBanner with the same text.
- **FR-007 Privacy**: notification text never reveals a private event of someone else or a surprise to its hidden person (spec 043); the lock screen shows titles, so reminders for private events go only to their owner.

## Success Criteria
- **SC-001**: A first-time cook sees the ask sheet on their first timer and never at launch (test).
- **SC-002**: Tapping a notification from a killed app lands on the right screen in under 2 s on an iPhone 12 or newer.

## Tracking (PostHog)
| Event | Properties |
| --- | --- |
| `notifications_ask_shown` | trigger (timer, reminder, settings) |
| `notifications_permission_result` | granted (bool), trigger |
| `notification_opened` | kind (timer_done, reminder), cold_start (bool) |
| `notification_settings_changed` | setting, value |

## Warnings and errors
All copy is in `design/ui/OC-Notifications.md` and `design/ui/OC-SettingsNotif.md`. New strings go to `strings/en.ts` first.

## Needs your attention
- You need a paid Apple Developer Program membership (for push and Live Activities) and the Time Sensitive Notifications capability on the app ID. Development moves from Expo Go to a development build.

## Changelog
- 2026-11-02: Ready. From Gabriel's notifications brief (timers on the Lock Screen, timer-done alerts, event reminders); iPhone first, Android later (032 L72).
- 2026-11-03: Built. The iPhone app needs a development build now (`expo-notifications`, `expo-device`, `expo-dev-client`; Time Sensitive entitlement in `app.json`; `eas.json`'s `development` profile installs on a phone): `pnpm dev:phone` serves it, README › On an iPhone and docs/operations.md › Notifications say how, and local Supabase also accepts `ourcocon://` sign-in redirects (staging and prod never do, spec 045). Database: `push_devices` (members read their own rows; written only through `register_push_device`, `set_push_prefs` and `unregister_push_device`), `notification_log` (service role only), `member_calendar_settings.default_reminder` (FR-003's per-member default lives with the member's other settings). `@cocon/notify` sends through Expo in batches of 100, logs each send, reads receipts after 15 minutes and turns off phones Apple no longer accepts; `apps/notifier` runs it every minute on the server (image, compose service and deploy check; `infra/VERSION` 6), and `pnpm notify:test <email>` sends a test notification locally. App: the ask sheet on the first timer or the first event saved with a reminder (never at launch; "Not now" once more after 14 days), Menu › Notifications (`/settings/notifications`, "Off" in the Menu when denied), registration on every start, removal on sign-out, and taps open only Timers or one event's date (`NotificationRoute`). Security review: one row per push token (a reinstalled phone never gets the previous person's notifications), a device id moves to another member only with the same token, sign-out also invalidates the token on the phone, the Expo access token is sealed on its own (`<env>-expo-access-token`) and reaches only the notifier. New in the design system: BottomSheet `hero`, IconTile `xl`, Card `warn`. Deviations: the ask sheet uses BottomSheet's title and lead sizes (24/900, 15/600; the screen draws 26 and 16); the warn card's text is the `warn` token (#8A4B00; the screen draws #6B3A00) and the dimmed state is `opacity-dimmed` (0.4; the screen says 45%); the managed-members hint says "them" (no pronouns are stored) and names all of them; the not-asked card and the default-reminder sheet aren't drawn (copy added to OC-SettingsNotif.md); a reminder arriving while the app is open is the Toast with "Open" (OC-Notifications.md). SC-002 (under 2 s from a killed app) is a device check.
- 2026-11-03: Fix. Local iPhone sign-in: Supabase's email templates blank an `ourcocon://` link (`#ZgotmplZ`), so in local development only the sign-in email also shows the link as text to paste into Safari (`apps/app/public/email/sign-in.html`; staging and prod are unchanged). README and `pnpm dev:phone` no longer say to swap `127.0.0.1` in the link (it never had it), and say to restart local Supabase if it predates this spec.
- 2026-11-09: Fix. Saving an event with a reminder (or starting a timer from a sheet) could freeze the app: the ask sheet opened while the sheet it follows was still being dismissed, and iOS left it invisible, taking every tap. The ask now waits until that sheet is gone (600 ms, `afterSheets` in `NotificationsProvider`). Once notifications were allowed, the iPhone re-registered in a loop (about 275 Expo token requests and 45 `register_push_device` calls a second): every token request makes iOS report the token again, which expo-notifications sends as a token event, and FR-004 registered again on it. `onTokenChange` now fires only for a token unlike the last one; a report that arrives while the app is asking is compared with the answer afterwards, so a real change then still re-registers (security review) (`notifications-native.ios.ts`). This loop is the likely cause of TestFlight 0.8.0's slowdowns and crashes (from Nov 4: 1 GB of network cache writes in 10 minutes, memory growing until iOS stopped the app).
