# Feature Specification: Calendar — week view

**Feature Branch**: `038-calendar-week` · **Status**: Ready · **Depends on**: 035, 036
**Input**: An hour grid for one week with overlapping events side by side, swiped left/right to change week.
**Design**: canvas `OC-CalWeek`; components CalendarHeader, HourGrid, EventBlock, EventBar.

## User Scenarios & Testing

### User Story 1 — See overlaps clearly (P1)
**Given** Sunday has "Baby swim" 14:30–16:30 and "Coffee" 16:00–17:00, **Then** both blocks show at their exact times, side by side where they overlap.

### User Story 2 — Swipe to next week (P1)
**Given** the week of Oct. 25, **When** Gabriel swipes left, **Then** the grid follows his finger, slides in "Nov. 1 – 7", and the header updates. Swiping right goes back; a drag under 60 px snaps back.

## Requirements

- **FR-001**: Day header row (letter + date, today in an olive circle; tap → Day view), an "All day" row (all-day and multi-day bars spanning columns), then a 06:00–24:00 hour grid, 36 px per hour, hour labels on the left (38 px column).
- **FR-002**: Slot events are drawn over their slot's hours and labelled with the slot name; custom events at their exact times with a 3 px ink left edge and their start time. Overlaps use `layoutDay` lanes (spec 034); in a lane the label shows initials only.
- **FR-003**: Today's column has a light honey tint and an olive "now" line.
- **FR-004**: Horizontal swipe (pointer or touch, vertical scroll still works) and the header arrows move one week; "Today" returns to this week. Commit threshold 60 px; the new week slides in from the swipe side (220 ms ease-out). Reduced-motion setting: no slide.
- **FR-005**: Tap a block → event detail (spec 042). Tap an empty slot → Add event pre-filled with that day and time.

## Tracking (PostHog)
| Event | Properties |
| --- | --- |
| `calendar_week_swiped` | direction |
| `calendar_day_opened` | from_view |

## Warnings and errors
No user-facing errors.

## Needs your attention
None.

## Changelog
- 2026-10-25: Ready. Written from the calendar brief and the reviewed canvas (page "Our Cocon · Calendar"). Renumbered on 2026-10-26: Home and Settings for all modules are 028 and 029.
