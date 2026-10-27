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
Throws typed errors (`NonAdjacentSlots`, `InvalidRecurrence`, `EndBeforeStart`, and `InvalidDate` for a date that isn't one or a range over 3 years); callers show their own copy.

## Needs your attention
- Choices made where the spec is silent (say if you want them changed): all-day events never raise the conflict warning (a birthday or a trip would warn on every event that day); short months are three letters with a period except May ("Sep.", "Jun."); 12-hour times read "2:30 PM"; week titles show no year, even across New Year ("Dec. 27 – Jan. 2").

## Changelog
- 2026-10-25: Ready. Written from the calendar brief and the reviewed canvas (page "Our Cocon · Calendar"). Renumbered on 2026-10-26: Home and Settings for all modules are 028 and 029.
- 2026-10-26 (later): Month titles drop the year in the current year ("October"); other years read "Jan. 2027" under 430 px and "January 2027" above (FR-007).
- 2026-10-27: Built. `@cocon/calendar` (no React, 100% line coverage, checked in CI) with `slotsToRange`, `timeLabel`/`rangeLabel`, `monthTitle`/`weekTitle`/`dayTitle`, `expand` (exceptions included), `layoutDay`, `findConflict`, `viewFor`, `todayIn` and `weekStartFor`; the calendar Zod shapes (`Recurrence`, `SlotKey`, `EventMember`, settings) are in `packages/schemas/calendar.ts` for 035 to build on. Fields are snake_case like spec 035's columns, plus `creator_member_id` (see 032-later L80). Every 2 weeks counts weeks from the Sunday of the start's week, so all devices agree. `viewFor` builds Busy and cover views from an allowlist of fields, keeps the members on a surprise cover (for its color), and shows a surprise with no cover data as Busy. A cancelled occurrence still counts towards "after N times". A weekly repeat starts on the first chosen weekday on or after the start day. The cover view reads as a family event, so it doesn't give the surprise away. Others never conflict (they're no one in particular); a multi-day draft is checked on each of its days. The repeat is stored as `{ freq: daily|weekly|biweekly|monthly|yearly, weekdays?, ends }`. After the security review: a "this event only" change can only replace the fields in the strict `EventOverride` schema (never visibility, creator or surprise); a hidden event is Busy when the viewer or creator is unknown; dates are checked, one call covers at most 3 years, and exceptions far outside the range are skipped. Deviation: a fourth typed error, `InvalidDate`, for dates that aren't dates or a range that's too long. All-day events don't conflict (see Needs your attention).
