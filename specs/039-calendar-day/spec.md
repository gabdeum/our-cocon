# Feature Specification: Calendar — day view

**Feature Branch**: `039-calendar-day` · **Status**: Ready · **Depends on**: 035, 036
**Input**: One day grouped by time of day, with one-tap add in empty slots, swiped left/right to change day.
**Design**: canvas `OC-CalDay`; components CalendarHeader, SlotBand, EventRow, MemberChip (count), Toast.

## User Scenarios & Testing

### User Story 1 — What's on today, by time of day (P1)
**Given** Sunday, **Then** I see the people busy today with counts ("Gabriel 2 · James 1 · Everyone 2"), an "All day" section when needed, then Early morning → Evening bands with their events or a dashed "+ Add in the morning" row.

### User Story 2 — Swipe to tomorrow (P1)
**Given** the day view, **When** I swipe left, **Then** "Mon, Oct. 26" slides in.

## Requirements

- **FR-001**: Busy chips: one per member (and Everyone) with at least one event that day, "{name} {count}", computed from that day's visible events.
- **FR-002**: "All day" section (when any): full-width rows in the member color with the title and a tag ("Birthday", "Day 2 of 3").
- **FR-003**: Five bands with title and hours ("Morning 09:00–12:00"). Event rows: color stripe, avatar, title 17/800, time line by spec 034 FR-003 + " · {place}", optional driver line with car icon ("Gabriel takes James"), "Now" tag while it's happening.
- **FR-004**: Empty band: dashed row "+ Add in the {band}" ("lunch slot" for Lunch) → Add event pre-filled with that day and slot.
- **FR-005**: Swipe and arrows move one day; same rules as spec 038 FR-004.
- **FR-006**: After saving from Add event, the toast shows over the tab bar (spec 041 FR-009); the floating add button hides while a toast is visible.

## Tracking (PostHog)
| Event | Properties |
| --- | --- |
| `calendar_day_swiped` | direction |
| `calendar_slot_add_tapped` | slot |

## Warnings and errors
Empty day: every band shows its "+ Add in the …" row; no other message.

## Needs your attention
None.

## Changelog
- 2026-10-25: Ready. Written from the calendar brief and the reviewed canvas (page "Our Cocon · Calendar"). Renumbered on 2026-10-26: Home and Settings for all modules are 028 and 029.
- 2026-10-28: Built. Day view under the calendar header: who's busy (new `MemberCount`, MemberChip README › Count), the All day rows (`AllDayRow`) and the five bands (`SlotBand`, `DayEventRow`) laid out by `layoutDayView`; each event sits in the slot it starts in (new `slotAt` in `@cocon/calendar`: before 06:00 in Early morning, after 22:00 in Evening); swipe and ‹ › move a day through the shared `Swipeable`; new icon `car`; new events `calendar_day_swiped` (swipes only, not arrows) and `calendar_slot_add_tapped`. Busy chips count each event once per member on it, private events ("Busy") included; Others gets no chip. Deviations: FR-006's toast waits for Add event (041, 032-later L96; `FloatingAdd` takes `hidden` for it); an empty band opens `/calendar/new?date=&slot=` and rows open `/calendar/[id]?date=` (041, 042: L91, L92); times are 24-hour until 029 (L95); two-person events show flat halves and "G·E" in the avatar (as Week); anything spanning more than one day goes to All day with "Day N of M", and only Birthday gets a type tag; "Now" is the shared honey Tag (12/900, drawn 13/900).
