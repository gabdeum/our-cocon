# 058 — Reminders in the calendar

**Status**: Ready · **Depends on**: 056, 057, 039 (day view), 040 (agenda)

Screen: `design/screens/OC-CalAgendaReminders.dc.html`. Only the reminder rows and the "Reminders" toggle are new; header, events and tab bar stay as they are.

## Functional requirements
- **FR-001 Agenda and Day views** list reminders mixed with events, sorted by time (any-time reminders first in the day, then by time). A reminder row has a tick box instead of the event colour stripe and avatar, so the two never look alike. Tapping it opens the reminder drawer (057 FR-005).
- **FR-002 Today** starts with overdue reminders (late badge on the right), oldest first, except `rollover = none`, which stays on its due day.
- **FR-003 Future repeats** in the visible range are drawn from the repeat rule (client-side, 056 FR-012) and can't be ticked before their day (tick box disabled, "Not yet" on tap).
- **FR-004 "Reminders" toggle** pill in the agenda header shows/hides reminders. Remembered per device. Default on.
- **FR-005 Month and Week views**: not in this version.

## Success criteria
- **SC-001** Ticking a reminder in the agenda updates Home and the Reminders screen without a reload.

## Tracking (PostHog)
| Event | Properties |
| --- | --- |
| `calendar_reminders_toggled` | on |

## Needs your attention
- Month/Week don't show reminders yet. Say if you want a small count per day there.

## Changelog
- 2026-11-15: Ready.
