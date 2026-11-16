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
- **FR-006 Sending.** `apps/notifier` minute tick: apply FR-005 of 056 (missed), compute due nudges for the next 2 minutes, skip ones already in `reminder_nudges` (`reminder_id`, `late_from`, `kind`, `slot_at`, `member_id` — unique), send through `packages/notify` with thread `reminders-todo`, interruption level `active`.
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
