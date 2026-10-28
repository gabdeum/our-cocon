# Feature Specification: Calendar — month view

**Feature Branch**: `037-calendar-month` · **Status**: Ready · **Depends on**: 035, 036
**Input**: A continuously scrolling month grid that shows who and what on each day.
**Design**: canvas `OC-CalMonth`; components CalendarHeader, MonthGrid, EventChip, EventBar, Toast (hint), IconButton (floating add).

## User Scenarios & Testing

### User Story 1 — Read the month at a glance (P1)
**Given** October, **Then** each day shows up to two chips in the member's color with initials and a short title ("J Baby swim"), "+N" for more, and multi-day events as one pill across the days.

### User Story 2 — Scroll through months (P1)
**Given** the grid, **When** Gabriel scrolls down, **Then** weeks scroll continuously into November with the weekday row fixed at the top, and the header title changes to "Nov. 2026" once November fills the grid.

### User Story 3 — Drill into a day (P1)
**Given** a day cell, **When** tapped, **Then** Day view opens on that day (spec 039); tapped on an event chip, that event opens (spec 042; changed 2026-10-28). Long-press opens Add event for that day (spec 041).

## Requirements

- **FR-001**: One vertical scroll of week rows (virtualised), loading ±6 months around the visible range; opens with the current month's first week at the top and today visible. The S M T W T F S row is sticky.
- **FR-002**: Day cells are a fixed 96 px tall. The 1st of each month shows an ink pill "Nov 1". Today: olive circle on the date and a 2.5 px olive inset outline. Past days use `surface-page` and muted dates (setting in spec 029).
- **FR-003**: Chips: member color (two-member events split 50/50; Everyone coral; Others light with a `line-handle` outline), text "{initials} {title}", 11/800, 4 px padding both sides, text clipped at the padding with no ellipsis. Order: multi-day first, then by slot. Two chips max, then "+N".
- **FR-004**: Multi-day events are one EventBar per week row drawn over the grid (z above cells) from the first to the last day in that row, so the title runs the full width; the continuation in the next row reads "{title} (cont.)". The days underneath keep that row empty.
- **FR-005**: Header title follows the month that fills the grid (the Wednesday of the second visible row).
- **FR-006**: First visit only: sage hint card above the grid, left of the floating add button: "Tap a day to see details. Each color is a family member." with "Got it".
- **FR-007**: Floating olive add button (60 px, "Add event") opens Add event for today.

## Tracking (PostHog)
| Event | Properties |
| --- | --- |
| `calendar_day_opened` | from_view |
| `calendar_first_hint_dismissed` | — |

## Warnings and errors
Empty month: no special state; the grid shows empty days. Copy for the hint is in `design/ui/OC-CalMonth.md`.

## Needs your attention
None.

## Changelog
- 2026-10-25: Ready. Written from the calendar brief and the reviewed canvas (page "Our Cocon · Calendar"). Renumbered on 2026-10-26: Home and Settings for all modules are 028 and 029.
- 2026-10-27: Built. Month grid (MonthGrid, EventChip, EventBar ported to packages/ui; Toast with its hint variant; IconButton `fab`; `FloatingAdd`), `layoutSpans` in @cocon/calendar for stacked multi-day bars, events loaded for the visible quarter ±6 months and refetched live. Deviations: the weekday row is drawn fixed above the list instead of CSS sticky (same look); two-color chips are two flat halves, not a gradient; the hint is remembered per member on this device (032-later L94); new shadow tokens `shadow-lift` (add button and hint; the hint's 0.2 shadow uses the button's 0.25) and `shadow-sticky`; the grid scrolls 5 years either side of today. Leaving Month for another view opens it on the month in view (today in the current month). Long-press, + and bars link to routes 041 and 042 build (L91, L92).
- 2026-10-28 (041): tapping an event chip in a day opens that event (`MonthGrid` `onChipPress`, `EventChip` `onPress`); the rest of the cell still opens the day, as Gabriel asked. The event page comes with 042.
