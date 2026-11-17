# 056 — Reminders: data and rules

**Status**: Ready · **Depends on**: 033 (members), 034 (repeat rules, `@cocon/calendar`), 035 (RLS + live sync patterns)

Reminders are things to *do* (tick off), separate from calendar events. A reminder always has a due date, can repeat, rolls forward when it isn't done, can be snoozed, and can carry notes.

> Naming: "event reminders" (spec 049: table `reminder_deliveries`, SQL function `reminder_candidates`, `remindersDue` in `@cocon/calendar`) already exist and are about calendar events. Everything here uses the `reminders` / `reminder_*` names below and must not reuse or change those.

## Functional requirements

- **FR-001 Table `reminders`** (one row per reminder, not per occurrence):
  `id`, `household_id`, `title` (1–80 chars), `notes` (text, 0–1000 chars, plain text, nullable), `assignee` (member id, or `everyone`), `due_at` (timestamptz, required — the current open occurrence), `has_time` (bool; false = "any time" that day), `repeat_rule` (same format as events, spec 034; null = once), `rollover` (`hour` | `day` | `week` | `none`), `snoozed_until` (timestamptz, nullable), `completed_at` (nullable; only set on non-repeating reminders), `deleted_at`, `created_by`, `created_via` (`app` | `assistant`), `created_at`, `updated_at`.
- **FR-002 Table `reminder_occurrences`**: history of each occurrence that was closed: `reminder_id`, `due_at`, `status` (`done` | `missed` | `skipped`), `closed_at`, `closed_by`. Unique (`reminder_id`, `due_at`).
- **FR-003 One open occurrence per reminder.** A repeating reminder is one row whose `due_at` moves forward. Future repeats are never stored.
- **FR-004 Done.** Non-repeating: set `completed_at`. Repeating: write a `done` occurrence, then set `due_at` to the first scheduled date strictly after the current `due_at` (from the schedule, not from the completion date) and clear `snoozed_until`. Undo (within the session) reverses both.
- **FR-005 Missed.** When the next scheduled date of a repeating reminder arrives and the open occurrence isn't done, write a `missed` occurrence and move `due_at` to that date. Runs in the notifier tick (059) and is also applied lazily on read, so the app is right even if the worker was down.
- **FR-006 Late.** `late_from = coalesce(snoozed_until, due_at)`. A reminder is late when now is past `late_from` (for `has_time = false`: from the next day). Late badge = whole days late ("1d late"); under a day with a time = hours ("3h late").
- **FR-007 Snooze.** Sets `snoozed_until`; `due_at` is unchanged. While `now < snoozed_until` the reminder is hidden from Home, the lists (except "Snoozed") and gets no notifications. When it comes back it has no late badge (FR-006 measures from the snooze date). Options: In 1 hour (only with a time), Tomorrow, Next week, Next month, Pick a date. Snoozing a repeating reminder past its next scheduled dates marks those as `skipped`, not `missed`.
- **FR-008 Rollover.** Controls where an open, late reminder shows and how often it nudges (059):
  - `hour` (only allowed when `has_time`): stays on today, nudges hourly.
  - `day`: shows on today; daily nudge.
  - `week`: shows again on the same weekday each week; weekly nudge.
  - `none` ("Leave it"): stays on its due day; appears only under Overdue on the Reminders screen, not on Home; no nudges.
  Default on create: `hour` with a time, `day` without.
- **FR-009 Notes.** Optional, plain text, line breaks kept. Shown in the drawer; edited in the create/edit sheet.
- **FR-010 Permissions.** Household RLS like events (035). Any household member can create, edit, complete, snooze or delete any reminder. No private reminders in this version.
- **FR-011 Live sync** on `reminders` like events, so a tick on one phone updates the others.
- **FR-012 Queries and pagination** (RPCs, keyset on `(sort_at, id)`, never offset):
  - `reminders_home(limit 3)`: open, not snoozed, overdue (oldest first, except `rollover = none`) then due today by time; plus counts (`more_today`, `snoozed`).
  - `reminders_section(section, assignee_filter, cursor, limit)`: section ∈ `overdue`, `today`, `tomorrow`, `later`, `snoozed`. Page size 20; `overdue` and `today` return up to 50 on the first call. Returns `next_cursor` (null when done).
  - `reminders_in_range(from, to)` for the calendar: open occurrences in range. Future repeats in the range are expanded client-side with `@cocon/calendar` (not stored, not returned by the lists).
  - Indexes: (`household_id`, `deleted_at`, `due_at`), (`household_id`, `snoozed_until`).
- **FR-013 Delete** is soft (`deleted_at`); for a repeating reminder it deletes the whole series.

## Success criteria
- **SC-001** Unit tests (table-driven) for FR-004–FR-008: done on time/late, missed after 1 and 3 skipped weeks, snooze before/after next occurrence, every rollover mode, with and without time, across a DST change.
- **SC-002** A household with 500 reminders (300 repeating) loads Home and the first page of each section in < 300 ms on staging.
- **SC-003** RLS test: a member of another household can't read or change any `reminders` or `reminder_occurrences` row.

## Tracking (PostHog)
| Event | Properties |
| --- | --- |
| `reminder_completed` | repeating, late_days, source (home, list, drawer, calendar, notification, assistant) |
| `reminder_snoozed` | option (hour, tomorrow, week, month, date), source |
| `reminder_missed` (server) | — |

## Warnings and errors
Copy in `design/ui/OC-Reminders.md`. A failed tick/snooze rolls back the optimistic change and shows the standard "Couldn't save. Try again." toast.

## Needs your attention
- None. "Leave it" stays; private reminders can wait (Gabriel, 2026-11-16).

## Changelog
- 2026-11-15: Ready. From the reminders design canvas.
- 2026-11-16: Built. Tables `reminders` and `reminder_occurrences` (family RLS; `reminders` live), the rules in a new package `@cocon/reminders` (Done, Missed and Skipped, Snooze, defaults, on `@cocon/calendar`'s `expand`), the reads and writes in `@cocon/data` (`reminders.ts`), the three events in `analytics.ts`, a nightly purge of reminders deleted over 30 days ago, and six seed reminders. Deviations:
  - The repo's names: `family_id` (not `household_id`) and `source` ('app' or the assistant's name, not `created_via`). `assignee` is `assignee_id`, null for Everyone; a member who leaves turns theirs into Everyone's.
  - Two more columns: `repeat_from` (the repeat's first date, for "every 2 weeks" and "after N times") and `next_due_at` (the next scheduled time, written with each change, so the database finds missed reminders without a repeat engine). Missed reminders are closed on read by `@cocon/data` before each list (FR-005); the notifier does it in 059.
  - Late, sections, Home and their order are worked out in the database (`_reminder_state`), once for the app, assistants and the notifier. Lateness never counts from before the due time, so a reminder snoozed before it's due isn't late early. The badge starts at 1 hour. "Any time" reminders come after the timed ones that day. A late "Next week" reminder is on Home only on its weekday (always under Overdue on the Reminders screen).
  - FR-012 RPCs: `reminders_home(p_tz)`, `reminders_section(section, mine, limit, after_sort, after_id, p_tz)` ("Mine" = mine and Everyone's) and `reminders_in_range(from, to, p_tz)`; `next_cursor` is built in `@cocon/data`. `p_tz` is the device's time zone, used only until the family has a home one. Done and its Undo go through `reminder_apply` / `reminder_revert`, which do nothing when another phone moved the reminder first.
  - The last date of a repeat is closed as done, then the reminder is completed. "Every hour" without a time silently becomes "Next day" (OC-Reminders.md).
  - Deletes are soft, as for events: a member can remove a reminder for good only once it's deleted.
  - `reminder_missed` is typed but sent by the notifier (059, 032-later L146). SC-002 is about 5 ms locally; staging is L145.
- 2026-11-16: Gabriel keeps "Leave it", is fine without private reminders for now, and accepts the open choices above ("any time" after timed ones, "Next week" on Home only on its weekday, the badge from 1 hour).
- 2026-11-16 (058): a late "Next week" reminder rests in Snoozed between its weekdays (back on its weekday at its time, then Overdue and on Home with its badge), instead of Overdue all week but on Home only that day (Gabriel). `_reminder_state` reports it as `snoozed` with `snoozed_until` set to its return; nothing is written, and a real snooze still wins. The notifier (059) reads the same state, so it nudges weekly. Migration `reminders_next_week_rests`; `056_reminders.test.sql` covers it, and its "Mine" test no longer depends on today's date.
- 2026-11-16 (058): no Snoozed section: `_reminder_state` places a snoozed reminder in Today, Tomorrow or Later by when it's back and flags it (`snoozed`); `reminders_section('snoozed')` still returns every snoozed one, and Home's count uses the flag. Migration `reminders_snoozed_in_lists`.
