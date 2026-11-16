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
- Month/Week don't show reminders yet. Say if you want a small count per day there (032-later L152).
- The "Reminders" pill is in its own row at the top of the agenda list, and Day always shows reminders (Gabriel, 2026-11-16).

## Changelog
- 2026-11-15: Ready.
- 2026-11-16: Built. Agenda and Day list reminders among the events from `reminders_in_range` (one list per day: late ones first, oldest first, then any time with the all-day events, then by time, events first at the same minute). Late ones come to Today with their badge ("Gabriel · was due Mon"), "Leave it" ones stay on their day, "Next week" ones show on their weekday, snoozed ones on the day they come back; the header's people filter applies. Later repeats are drawn with `repeatDatesBetween` (new in `@cocon/reminders`) and say "Not yet: it's due {date}." when their box is pressed. A tick or a title opens 057's actions and drawer (`reminder_completed` and `reminder_drawer_opened` with `calendar`); ticked rows stay struck through until the tab is left, and Home and the Reminders screen refetch (SC-001). The "Reminders" pill (FR-004) is remembered per person on this device, on at first, and sends `calendar_reminders_toggled`. New in the design system: `ReminderListRow`, `DayReminderRow`, `TogglePill` and the `check-square` icon. Deviations:
  - The pill sits in its own row at the top of the agenda list (beside "Coming up" it overflows the header at 390 px); Day always shows reminders, so the pill is Agenda's only (Gabriel, 2026-11-16). The agenda's "+" stays Add event.
  - Day view isn't drawn: late and any-time reminders go under "All day" (after the all-day events, late ones first), timed ones in their band; a band with only reminders has no add row.
  - On the web a pressable box can't be marked `aria-disabled`, so a later repeat's box is named "Not yet: {title}" (half opacity) instead.
  - Reminders load for at most 366 days from where Agenda starts (L153).
  - Any-time reminders come before the day's timed rows, as FR-001 says; the screen's Tomorrow sample draws "Pay the daycare" after a 06:30 run.
