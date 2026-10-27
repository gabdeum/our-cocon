# Feature Specification: Calendar engine package

**Feature Branch**: `034-calendar-engine` · **Status**: Ready · **Depends on**: 001, 033
**Input**: Pure TypeScript rules shared by the app and the MCP server: time slots, recurrence, overlaps, conflicts, labels and visibility.
**Design**: no screen; every calendar screen depends on it.

## User Scenarios & Testing

### User Story 1 — Same answer everywhere (P1)
**Given** "Football every Saturday morning" created by an AI assistant, **Then** the app, the Home card and the MCP `list_events` tool all show the same occurrences at the same times.

### User Story 2 — Quick add fills the times (P1)
**Given** the slot "Evening", **Then** the event runs 18:00–22:00 and is labelled "Evening"; picking "Afternoon" + "Evening" gives 14:00–22:00.

## Requirements

- **FR-001**: Package `packages/calendar` (`@cocon/calendar`), no React, 100% unit-tested with table-driven tests.
- **FR-002 Slots**: five family slots with defaults Early morning 06:00–09:00, Morning 09:00–12:00, Lunch 12:00–14:00, Afternoon 14:00–18:00, Evening 18:00–22:00, plus All day and Custom. There is no Night slot. `slotsToRange(slots[])` accepts only adjacent slots; anything later than 22:00 uses Custom.
- **FR-003 Time label rule**: an event shows its slot name only when it starts at that slot's start time ("Lunch" for 12:00); otherwise its own start time ("14:30"). Custom events show "{start}–{end}" in detail views. Times follow the device's 24h/12h setting unless overridden (spec 029).
- **FR-004 Recurrence**: Never, Daily, Weekly (chosen weekdays), Every 2 weeks, Monthly (same date; skips months without it), Yearly. End: never, on a date, after N times. `expand(event, from, to)` returns occurrences; exceptions ("this event only" edits and deletes) override single occurrences.
- **FR-005 Overlap layout**: `layoutDay(events)` groups overlapping events and assigns lanes, so overlapping events sit side by side in the week grid (spec 038).
- **FR-006 Conflicts**: `findConflict(draft, events)` returns the first event that shares a slot or time with the same member (Everyone counts as every member). Used for the soft warning in spec 041.
- **FR-007 Labels**: a month title in the current year is the full month name alone ("October", `MMMM`) at every width. A month in another year adds the year: full ("January 2027", `MMMM YYYY`) when the screen is 430 px or wider, short ("Jan. 2027", `MMM YYYY`) below that. Week and day titles keep the short form under 430 px ("Oct. 25 – 31", "Sun, Oct. 25"); May has no period. "Current year" is the year of today in the family's home time zone. Week start follows the device locale unless overridden (spec 029).
- **FR-008 Home time zone**: all dates are in the family's home time zone (spec 029); travel time zones are out of scope.
- **FR-009 Visibility filter**: `viewFor(event, viewerMemberId)` returns the full event, a "Busy" stub (private), or the surprise cover (spec 043). The app and MCP must call it; never filter visibility in UI code alone (RLS enforces it too, spec 035).

## Tracking (PostHog)
No new events.

## Warnings and errors
Throws typed errors (`NonAdjacentSlots`, `InvalidRecurrence`, `EndBeforeStart`); callers show their own copy.

## Needs your attention
None.

## Changelog
- 2026-10-25: Ready. Written from the calendar brief and the reviewed canvas (page "Our Cocon · Calendar"). Renumbered on 2026-10-26: Home and Settings for all modules are 028 and 029.
- 2026-10-26 (later): Month titles drop the year in the current year ("October"); other years read "Jan. 2027" under 430 px and "January 2027" above (FR-007).
