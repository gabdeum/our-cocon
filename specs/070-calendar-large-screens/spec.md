# Feature Specification: Calendar on larger screens: month, week, day

**Feature Branch**: `070-calendar-large-screens` · **Status**: Ready · **Depends on**: 063, 064, 065, 036, 037, 038, 039, 058

Screen: `design/screens/OC-CalendarResponsive.dc.html` (pass `w`/`h`/`view`: month, week, day at 390, 820, 1180). UI spec: `design/ui/OC-LargeScreens.md` § Calendar.

> Use the app's existing calendar: `CalHeader`, month grid, chips and multi-day bars, day sheet rows, week time grid, day time-of-day sections, event rows, member colours, add flow. The header at ≥ 600, the inline day panel, the mini month and "Coming up" are new. The Agenda view isn't in this spec.

## Functional requirements
- **FR-001 Compact**: unchanged (view and people behind their buttons, day sheet, floating + button).
- **FR-002 Header (≥ 600)**, two rows:
  - Row 1: title (32 px, full formats: "October", "October 25 – 31", "Sunday, October 25"), then ‹ · Today · › and the olive "+ Event" button (replaces the floating + button).
  - Row 2: the views as a segmented control (Month · Week · Day · Agenda when it exists), then, right-aligned, the **people filter as chips**: one per member + Everyone + Others. Tapping a chip shows or hides that member. A hidden member shows a pale dot, muted struck label and outlined chip. The same filter state as the phone's people menu.
- **FR-003 Month, medium**: the grid fills the width (weekday labels "Sun…Sat"). Rows 124 px; chips 20 px tall, 12 px text, 6 px padding, as many as fit then "+N"; multi-day bars at the same size. Tapping a day **selects** it (2.5 px ink inset; today keeps its olive ring) and shows the **selected-day panel under the grid**: day title, count, the same rows as the phone day sheet in **2 columns read by column**, and a dashed "+ Add on {Sun 25}" button. No sheet.
- **FR-004 Month, expanded**: rail + grid + the selected-day panel **beside** the grid (320 px, one column). Row height fills the window: `(available height − 40) / weeks`, min 96 px, so more chips fit.
- **FR-005 Week (≥ 600)**: same grid, hour height 44 px (phone 36), 52 px hour gutter with 12 px labels, day headers "Sun 25" at 18 px, event cards with 12 px "who · time" and 14 px titles; overlapping events side by side (as phone). Tapping a day works as today (spec 058) and as in Month: it opens that day's rows, reminders and add button, never Day view. Week has no inline panel, so from 600 that's the day sheet as a centred card (065). Expanded adds only the rail.
- **FR-006 Day, medium**: the phone's "who's busy" chips and all-day rows, then the time-of-day sections (Early morning → Evening) in **2 columns read by column** (063 `splitColumns`, weight = 1 + events). Empty sections keep their dashed "+ Add in the {section}".
- **FR-007 Day, expanded**: as medium, plus a 300 px side column: a **mini month** (current month; selected day ink, today olive, a 5 px dot under days with events; tap to go to that day) and **Coming up** (the next 3 days, each with weekday, date and event titles joined by " · ", or "Nothing planned"; tap opens that day).
- **FR-008** Event detail and add / edit event use 065 (centred card at ≥ 600).

## Success criteria
- **SC-001** At 820, tapping a day in Month updates the panel below without opening a sheet or moving the grid.
- **SC-002** Hiding a member with a chip hides their events in every view and is remembered like the phone filter.

## Tracking (PostHog)
| Event | Properties |
| --- | --- |
| `calendar_day_selected` | view, source (grid, mini_month, coming_up) |
| `calendar_filter_changed` (existing) | + source `chips` |

## Needs your attention
- The Agenda view isn't designed for large screens yet; at ≥ 600 it can reuse the medium Day layout per day. Not in this spec.

## Changelog
- 2026-11-19: Ready.
- 2026-11-19: FR-005 changed with Gabriel: tapping a day in Week keeps today's behaviour, the same as Month (the day sheet), instead of opening Day view.
