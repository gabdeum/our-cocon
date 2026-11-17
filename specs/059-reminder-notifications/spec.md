# 059 — Reminder notifications

**Status**: Ready · **Depends on**: 056, 046 (permission, `push_devices`, `apps/notifier`, `packages/notify`), 049 (event reminder delivery pattern)

Screen: `design/screens/OC-NotifLockTodo.dc.html` (content and order only; iOS draws the chrome).

## Functional requirements
- **FR-001 Schedule** for the open occurrence (measured from `late_from`, 056 FR-006):
  - With a time: 1 hour before ("In 1 hour: {title}"), at the time ("Now: {title}").
  - Without a time: 09:00 on the day ("Today: {title}").
  - Then, while not done, per `rollover`: `hour` every hour on the hour after the due time ("Still to do: {title}"); `day` once each morning at 09:00; `week` once a week at 09:00 on the weekday; `none` nothing more.
  Bodies: before → "Due at {time} · for {name}"; at time → "Nudges every hour until it’s done." (hour rollover) or "Due now"; nudges → "Was due at {time} · {n} hours late" or "Was due {day}". Untimed: "Due today". Names only when the recipient isn’t the only one on it.
- **FR-002 Quiet hours.** Per user, default 22:00–07:00. Nudges that fall inside are dropped; one nudge is sent at the end of quiet hours if the reminder is still open. The "1 hour before" and "at time" notifications are also held to the end of quiet hours.
- **FR-003 Recipients.** The assignee only, on every enabled device. `everyone` → every member with the app. A managed member without the app (James) → everyone with the app (same rule as event reminders).
- **FR-004 Actions** on the notification: "Done", "In 1 hour" (only with a time), "Tomorrow". Run without opening the app (background action calling the same RPCs). Tapping the notification opens the Reminders screen with the drawer open (`/reminders?open={id}`).
- **FR-005 Stop rules.** Done, snooze, delete, or the assignee changing cancels pending nudges for that reminder. Snoozed reminders get nothing until `snoozed_until` (then FR-001 restarts from there).
- **FR-006 Sending.** `apps/notifier` minute tick: apply FR-005 of 056 (missed), compute the nudges due now (at their time, never before), skip ones already in `reminder_nudges` (`reminder_id`, `late_from`, `kind`, `slot_at`, `member_id` — unique), send through `packages/notify` with thread `reminders-todo`, interruption level `active`.
- **FR-007 Settings.** Menu › Notifications gets a "Reminders" card: switch "Reminders" / "Things to do, and nudges until they're done"; row "Quiet hours" → "22:00–07:00" › (two time pickers). Web shows the existing "Notifications work in the iPhone app." line.

## Success criteria
- **SC-001** Unit test: for a table of reminders (timed/untimed × each rollover × snoozed × quiet hours), the scheduler returns exactly the expected sends.
- **SC-002** No duplicate for the same slot and person after a worker restart.
- **SC-003** "Done" from the Lock Screen closes the reminder and stops nudges within one tick.

## Tracking (PostHog)
| Event | Properties |
| --- | --- |
| `reminder_notification_sent` (server) | kind (before, due, nudge), rollover |
| `reminder_notification_action` | action (done, hour, tomorrow) |

## Needs your attention
- Untimed reminders notify at 09:00. Change if you prefer another time.
- Hourly nudges continue all day until done (outside quiet hours). Say if you want a cap.

## Changelog
- 2026-11-15: Ready.
- 2026-11-17: Built. The rules in `@cocon/reminders` (`notifications.ts`, words in `words.en.ts`), a `todo` job in `apps/notifier` (catch-up per family, then the sends, claimed in the new `reminder_nudges`), quiet hours per person (`member_calendar_settings.quiet_from` / `quiet_to`), the "Reminders" switch per phone (`push_devices.prefs.todo_on`), the Reminders card and Quiet hours sheet in Menu › Notifications, the Lock Screen actions, and `/reminders?open={id}` for any open reminder. Tests: SC-001 `packages/reminders/notifications.test.ts`; SC-002 `apps/notifier/src/todo.integration.test.ts` (plus `supabase/tests/059_reminder_notifications.test.sql`); SC-003 in two halves: the action ticks the reminder (`apps/app/lib/todo-actions.test.ts`), and a ticked reminder gets nothing on the next tick (`todo.integration.test.ts`). Deviations:
  - The actions open the app and run at once, as 047's do: expo-notifications runs action taps in the background only on Android, so on iOS the app can be paused before the write (032-later L120). SC-003 holds once the app has opened.
  - No thread `reminders-todo`: Expo's push API has no thread id (032-later L122).
  - A "Next week" nudge with a time comes at its time on the weekday, not 09:00: spec 058 rests it in Snoozed until then, and nothing is sent while snoozed.
  - Several sends held to the end of quiet hours are one, the furthest along (a reminder due at 06:00 gets one "Still to do" at 07:00). A send up to 10 minutes late still goes (a slow tick, a restart); one before the reminder was added never does.
  - Hourly nudges are on the hour in the home time zone. Nudges under a day late with a time say hours ("18 hours late" the next morning); later ones say the day ("Was due yesterday", "Was due Wed, Nov 11"). "for {name}" never follows "Nudges every hour until it’s done.".
  - The Reminders card and the Quiet hours sheet aren't drawn: their copy is in `OC-SettingsNotif.md`. Quiet hours apply on every phone (they decide when the server sends); the switch is per phone like the others. Changes are tracked as `notification_settings_changed` (`todo_on`, `quiet_hours` with value `changed`, never the times).
  - Existing events gain a value: `reminder_completed` and `reminder_snoozed` with source `notification` (the actions), `reminder_drawer_opened` with source `notification` (a tap). `reminder_notification_action` is sent only with someone signed in.
  - The sheet's line (L149) gains "then each morning" / "then once a week while it’s late" for "Next day" and "Next week".
- 2026-11-16: Fix. Notifications go out at their time, never before: they used to go out on the tick up to 2 minutes early ("Now: …" at 22:28 for 22:30). Event reminders (049) work the same way now.
- 2026-11-16: Fix. Adding a reminder never asked for notifications (046's ask came only from a timer or an event): the first reminder added now shows the ask sheet, "Get reminded on time" / "Turn on notifications so your reminders reach your phone at their time, even when Our Cocon is closed." (OC-Notifications.md). `notifications_ask_shown` and `notifications_permission_result` gain trigger `todo`.
