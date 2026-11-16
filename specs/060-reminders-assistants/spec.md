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
