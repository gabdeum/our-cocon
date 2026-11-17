# 060 — Reminder tools for AI assistants

**Status**: Ready · **Depends on**: 056, 044 (calendar tools and permissions pattern), 026 (activity + undo)

## Functional requirements
- **FR-001 Tools** on the MCP server:
  - `list_reminders(section?, assignee?, cursor?, limit≤50)` → reminders with id, title, notes, assignee, due, has_time, repeat, rollover, late_days, snoozed_until, plus `next_cursor`.
  - `create_reminder(title, due_date, time?, repeat?, rollover?, assignee?, notes?)`
  - `update_reminder(id, …same fields)`
  - `complete_reminder(id)`, `snooze_reminder(id, until)`, `delete_reminder(id)`
- **FR-002 Permission.** New per-assistant permission "Add & change reminders" (on by default, like "Add & change events"), next to "Add & change events" in Menu › AI assistants. Read is allowed whenever the assistant is connected.
- **FR-003** Every write sets `created_via = assistant` where relevant and appears in Home › Latest activity with Undo (026).
- **FR-004** Same validation as the app (title length, due required, `hour` rollover needs a time); errors return a plain sentence the assistant can repeat.

## Success criteria
- **SC-001** Contract tests for each tool, including pagination with `next_cursor` and a refused write without the permission.

## Tracking (PostHog)
| Event | Properties |
| --- | --- |
| `assistant_reminder_action` | tool, assistant |

## Changelog
- 2026-11-15: Ready.
- 2026-11-15: The "Add & change reminders" permission is on by default, like events (Gabriel).
- 2026-11-17: Built. Six tools in `apps/mcp/tools/reminders`, the "Add & change reminders" switch after "Add & change events", assistant writes in Latest activity with Undo (a delete with Restore for 30 days, like events), and 032-later L144: the family's own reminder changes are there too (added, edited, ticked off, reopened, snoozed, deleted, restored; catching up on missed repeats isn't). Deviations: `list_reminders` doesn't catch up on missed repeats (reads never write; the notifier does it), and lists every section in order when none is given, with a cursor that runs across sections; each row also has its `section` and a `link` to its drawer. FR-004: "hour" without a time is refused with a sentence, where the app's sheet quietly makes it "day". Undo of an assistant's add removes the reminder for good, as for events. New event: `assistant_reminder_action`; complete and snooze also send `reminder_completed` and `reminder_snoozed` with source `assistant`, and create sends `reminder_created`.
