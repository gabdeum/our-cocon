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
- "Leave it" (`rollover = none`) was added in design; drop it if you don't want it.
- Reminders can't be private yet. Say if you want "only for me" reminders.

## Changelog
- 2026-11-15: Ready. From the reminders design canvas.
