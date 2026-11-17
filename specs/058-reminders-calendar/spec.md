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
- None. Gabriel chose the toggle's place, the marks in Month and Week, and Week's day sheet (2026-11-16).

## Changelog
- 2026-11-15: Ready.
- 2026-11-16: Built. Agenda and Day list reminders among the events from `reminders_in_range` (one list per day: late ones first, oldest first, then any time with the all-day events, then by time, events first at the same minute). Late ones come to Today with their badge ("Gabriel · was due Mon"), "Leave it" ones stay on their day, "Next week" ones show on their weekday, snoozed ones on the day they come back; the header's people filter applies. Later repeats are drawn with `repeatDatesBetween` (new in `@cocon/reminders`) and say "Not yet: it's due {date}." when their box is pressed. A tick or a title opens 057's actions and drawer (`reminder_completed` and `reminder_drawer_opened` with `calendar`); ticked rows stay struck through until the tab is left, and Home and the Reminders screen refetch (SC-001). The "Reminders" pill (FR-004) is remembered per person on this device, on at first, and sends `calendar_reminders_toggled`. New in the design system: `ReminderListRow`, `DayReminderRow`, `TogglePill` and the `check-square` icon. Deviations:
  - The pill sits in its own row at the top of the agenda list (beside "Coming up" it overflows the header at 390 px); Day always shows reminders, so the pill is Agenda's only (Gabriel, 2026-11-16). The agenda's "+" stays Add event.
  - Day view isn't drawn: late and any-time reminders go under "All day" (after the all-day events, late ones first), timed ones in their band; a band with only reminders has no add row.
  - On the web a pressable box can't be marked `aria-disabled`, so a later repeat's box is named "Not yet: {title}" (half opacity) instead.
  - Reminders load for at most 366 days from where Agenda starts (L153).
  - Any-time reminders come before the day's timed rows, as FR-001 says; the screen's Tomorrow sample draws "Pay the daycare" after a 06:30 run.
- 2026-11-16: Changed after Gabriel's review (FR-004 and FR-005 differ from the text above):
  - The toggle is a round icon button (`check-square`, still named "Reminders"), olive when on. In Agenda and Day it's in the header's second row after the people button, where ‹ › were (the row can't hold both at 390 px; Day swipes, Agenda scrolls and has Today). Day now follows it too.
  - Month and Week (was FR-005, not in this version): days with reminders get a `check-square` the size of the date number (11 px in Month, 15 in Week), and the day's label says "2 reminders". No toggle in their header.
  - The day sheet lists the day's reminders among its events (Agenda's order; "2 events · 1 reminder"), with the toggle left of ✕. Week now opens the same sheet on a tap (it opened Day view, spec 038), so it sends `calendar_day_sheet_opened` instead of `calendar_day_opened`.
  - The icon stays `check-square`: reminders are ticked off, and the bell already means an event's reminder (Home's calendar card, the event page).
  - Reminders load from at most half a year back (only "Leave it" ones show before today).
  - Without ‹ ›, Day and Agenda page with ← → on the web and with "Previous day" / "Next day" ("… week" in Agenda) as VoiceOver actions on the header title (Gabriel chose this over keeping ‹ › in Day). Web screen readers in browse mode don't pass ← → through, so for them Day changes only through Today or Month and Week's day sheets.
  - `calendar_day_sheet_opened` still counts events only. `calendar_reminders_toggled` is sent from the header and from the day sheet alike (`on` only).
- 2026-11-16: The reminders icon is now `alarm` (an alarm clock), as Gabriel asked: the toggle, the day sheet's toggle and the marks in Month and Week. `check-square` is gone; `clock` stays an event's time and `bell` an event's reminder.
- 2026-11-16: The alarm marks are a little larger than the date, as Gabriel asked: 13 px in Month (date 11), 17 in Week (date 15).
- 2026-11-16: When the alarm clock doesn't fit beside the date it goes on the line below, as Gabriel asked. Week: under the number (the head row grows; at 390 px that's today's). Month: on the first chip row, and that whole week's chips and bars start one row lower so the bars stay lined up (Gabriel chose this over moving only that day); its days show one chip fewer. Month works out the fit from the font's widths (`textWidth`, new in `@cocon/calendar`), the cell's width and the text size.
- 2026-11-16: More changes from Gabriel's review:
  - Month: only the day whose alarm clock doesn't fit beside the date moves it to its first row (its chips start one row lower, and a bar in the top lane is drawn around that day so it never covers the clock). Week: if one day's clock doesn't fit beside its number, every day's goes under its number.
  - Done today (also 057's screens): a ticked reminder goes to the bottom of Today, struck through, and stays there until midnight, after a reload too ("Done at 15:20"): on the Reminders screen, in Agenda's Today, under a "Done" heading after Day view's bands, and in the day sheet. Ticking it again reopens it. A repeat's next date shows as usual. Home drops it once left or reloaded. Month and Week marks count only what's still to do. New in `@cocon/data`: `loadRemindersDoneToday` (each repeat's done date and the one-offs completed today, with their Undo); a repeat's earlier date, when a later one was done after it, can't be unticked.
  - Home and the Reminders screen: no ⋮ on rows; everything right of the member dot opens the drawer (the Home ⋮ menu is gone: snooze, edit and delete are in the drawer).
  - The drawer's who pill was clipped by the list (a −10 px pull); it now sits fully under the title. Sheet titles and their right button (✕, "Edit") are centred on each other in every BottomSheet (the Share sheet too); a lead runs under both.
  - The Reminders screen's lists lost the Card's padding and row gaps (the class names conflicted): plain white cards, padding 0 14.
  - Security review of done-today: Undo is offered only while nobody changed the reminder since the tick (no snooze, no edit, still on the date right after), so it can't overwrite someone else's change; a refused Undo leaves the row done and says "Couldn't save. Try again."; the reads keep the latest 100. Ticks and Undo aren't in the activity log yet (032-later L144, with 060).
- 2026-11-16: Home flashed a reminder done since (the copy saved on the device for offline showed first, then the fresh one). Online, Home, the Reminders screen and the calendar now show reminders only once fetched again since they opened; offline they still show the saved copy (decision 11). Home's card appears once its list is in.
