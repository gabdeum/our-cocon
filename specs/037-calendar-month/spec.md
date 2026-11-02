# Feature Specification: Calendar — month view

**Feature Branch**: `037-calendar-month` · **Status**: Ready · **Depends on**: 035, 036
**Input**: A continuously scrolling month grid that shows who and what on each day.
**Design**: canvas `OC-CalMonth`, `OC-CalMonthSheet` (day sheet open); components CalendarHeader, MonthGrid, EventChip, EventBar, BottomSheet, SlotBand event row, Toast (hint), IconButton (floating add).

## User Scenarios & Testing

### User Story 1 — Read the month at a glance (P1)
**Given** October, **Then** each day shows up to two chips in the member's color with initials and a short title ("J Baby swim"), "+N" for more, and multi-day events as one pill across the days.

### User Story 2 — Scroll through months (P1)
**Given** the grid, **When** Gabriel scrolls down, **Then** weeks scroll continuously into November with the weekday row fixed at the top, and the header title changes to "Nov. 2026" once November fills the grid.

### User Story 3 — Drill into a day (P1)
**Given** a day cell, **When** tapped anywhere (date, chips or a multi-day bar), **Then** a sheet slides up from the bottom with that day: title "Sunday, October 25", "3 events", one row per event (as in the day view) and the round olive add button. Tapping a row opens the event (spec 042); the add button opens Add event for that day (spec 041). Long-press on a cell still opens Add event for that day.

## Requirements

- **FR-001**: One vertical scroll of week rows (virtualised), loading ±6 months around the visible range; opens with the current month's first week at the top and today visible. The S M T W T F S row is sticky.
- **FR-002**: Day cells are a fixed 96 px tall. The 1st of each month shows an ink pill "Nov 1". Today: olive circle on the date and a 2.5 px olive inset outline. Past days use `surface-page` and muted dates (setting in spec 029).
- **FR-003**: Chips: member color (two-member events split 50/50; Everyone coral; Others light with a `line-handle` outline), text "{initials} {title}", 11/800, 4 px padding both sides, text clipped at the padding with no ellipsis. Order: multi-day first, then by slot. Two chips max, then "+N".
- **FR-004**: Multi-day events are one EventBar per week row drawn over the grid (z above cells) from the first to the last day in that row, so the title runs the full width; the continuation in the next row reads "{title} (cont.)". The days underneath keep that row empty.
- **FR-005**: Header title follows the month that fills the grid (the Wednesday of the second visible row).
- **FR-006**: First visit only: sage hint card above the grid, left of the floating add button: "Tap a day to see details. Each color is a family member." with "Got it".
- **FR-007**: Floating olive add button (60 px, "Add event") opens Add event for today.
- **FR-008 Tap a day**: the whole cell is one target (`button`, label "{Month} {d}: {titles}" or ": nothing planned"); chips and multi-day bars aren't tappable on their own (bars let the tap through to the cell under them). A tap opens the **day sheet**; long-press (500 ms) opens Add event for that day. The month view no longer opens the Day view directly.
- **FR-009 Day sheet** (BottomSheet, `role="dialog"`, over the tab bar with a 38% ink scrim): handle; title "{Weekday}, {Month} {d}" 22/900 + count "{n} events" / "1 event" / "Nothing planned" 14/700 muted; round close button (44, soft). Rows like the day view's event row (stripe, 36 px avatar, title 17/800, time line 14/700: slot name, start time, "All day", or "All day · day 2 of 4"), ordered all-day/multi-day first then by time; each opens the event. Empty: "Nothing planned yet." The round olive add button (60, "Add event on {day}") sits bottom-right inside the sheet and opens Add event pre-filled with that day. Max height 640 px, list scrolls; closes on scrim tap, close button, swipe down or Escape. Private events of others read "Busy" (spec 043); hidden members (filter) are left out.

## Tracking (PostHog)
| Event | Properties |
| --- | --- |
| `calendar_day_sheet_opened` | events (count) |
| `calendar_day_opened` | from_view (Week since 038; Month no longer sends it) |
| `calendar_first_hint_dismissed` | — |

## Warnings and errors
Empty month: no special state; the grid shows empty days. Copy for the hint is in `design/ui/OC-CalMonth.md`.

## Needs your attention
None.

## Changelog
- 2026-10-25: Ready. Written from the calendar brief and the reviewed canvas (page "Our Cocon · Calendar"). Renumbered on 2026-10-26: Home and Settings for all modules are 028 and 029.
- 2026-10-27: Built. Month grid (MonthGrid, EventChip, EventBar ported to packages/ui; Toast with its hint variant; IconButton `fab`; `FloatingAdd`), `layoutSpans` in @cocon/calendar for stacked multi-day bars, events loaded for the visible quarter ±6 months and refetched live. Deviations: the weekday row is drawn fixed above the list instead of CSS sticky (same look); two-color chips are two flat halves, not a gradient; the hint is remembered per member on this device (032-later L94); new shadow tokens `shadow-lift` (add button and hint; the hint's 0.2 shadow uses the button's 0.25) and `shadow-sticky`; the grid scrolls 5 years either side of today. Leaving Month for another view opens it on the month in view (today in the current month). Long-press, + and bars link to routes 041 and 042 build (L91, L92).
- 2026-10-28 (041): tapping an event chip in a day opens that event (`MonthGrid` `onChipPress`, `EventChip` `onPress`); the rest of the cell still opens the day, as Gabriel asked. The event page comes with 042.
- 2026-10-29: The 1st of each month is a dark beige banner (`line-handle`, ink text) across the top of its cell, clipped with no "…", so a new month always stands out (replaces the "Nov 1" pill).
- 2026-11-02: Gabriel's direction: tapping a day opens a day sheet (events + add button) instead of the Day view; chips and bars are no longer separate tap targets (too fiddly); long-press still adds. Week and Day views unchanged. Built: `MonthGrid` cells are buttons (`aria-haspopup="dialog"`) with no `onChipPress`/`onBarPress`; month bars draw only (`EventBar` without `onPress` lets taps through); `DaySheet` (BottomSheet with the day view's `DayEventRow`, built by `layoutDaySheet`) and BottomSheet's new `floating` slot for the round add button. Opening an event or Add closes the sheet first. Event `calendar_day_sheet_opened`; Month no longer sends `calendar_day_opened`. Deviations: the sheet keeps BottomSheet's look (title 24/900, lead 15/600, radius 32, bottom padding 28) rather than the screen's 22/900, 14/700, 28 and 34; rows also show the day view's place, "takes" and "Now" lines.
