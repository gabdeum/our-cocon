# Feature Specification: Calendar — agenda view

**Feature Branch**: `040-calendar-agenda` · **Status**: Ready · **Depends on**: 035, 036
**Input**: A scrolling list of what's coming, grouped by day — the easiest view for older family members.
**Design**: canvas `OC-CalAgenda`; components CalendarHeader, ListRow (event), Tag.

## User Scenarios & Testing

### User Story 1 — Scan the next weeks (P1)
**Given** Agenda, **Then** days from today onward are listed with headers "Today · Sun, Oct 25", "Tomorrow · Mon, Oct 26", then "Tue, Oct 27", each with a white card of event rows.

## Requirements

- **FR-001**: Title "Coming up". Infinite scroll forward (load 4 weeks at a time); days without events are skipped.
- **FR-002**: Row: stripe, avatar, title, sub-line "{time label} · {place or driver}", optional tag: "Now" (honey), "Birthday" and "Day N of M" (soft), "Surprise" (sage, only for people who can see it).
- **FR-003**: Arrows move by one week; the view switcher keeps the scroll position per session.

## Tracking (PostHog)
No new events.

## Warnings and errors
Nothing ahead: "Nothing planned yet. Tap + to add something."

## Needs your attention
None.

## Changelog
- 2026-10-25: Ready. Written from the calendar brief and the reviewed canvas (page "Our Cocon · Calendar"). Renumbered on 2026-10-26: Home and Settings for all modules are 028 and 029.
- 2026-10-28: Built. Agenda under the calendar header: days with events from the day shown (today by default), headed "Today · Sun, Oct 25", "Tomorrow · Mon, Oct 26", then "Tue, Oct 27" (new `dateLabel` in `@cocon/calendar`, no period after the month, decided with Gabriel: 032-later L82), each in a white card of rows (new `EventListGroup` / `EventListRow`, ListRow README › Event row; Tag gains `size="md"`, 13/900). Rows come from `layoutAgenda` (`apps/app/lib/calendar-agenda.ts`), sharing Day view's driver, "Now", "Day N of M" and Birthday rules. 4 weeks load at a time as the list nears its end (up to 39 pages, the engine's 3-year limit); with nothing in the weeks loaded it keeps looking up to a year ahead and meanwhile shows the empty copy. The list keeps its loaded weeks and scroll offset while switching views, in memory for the session (`agenda-session.ts`); "Today" on today's list scrolls back to the top. No new events. Deviations: the screen's sample sub-lines ("Evening · every Tuesday", "All day · until Fri", "Evening · hidden from Eva", "06:30–07:30") follow FR-002 instead: "{time label} · {place or driver}", the place winning over the driver, the time label being the slot name or start time; a row shows one tag, Now › Surprise › Day N of M › Birthday; multi-day and timed events crossing midnight show "All day" on each day, as in Day view; times are 24-hour until 029 (L95); rows open `/calendar/[id]?date=` and "+" `/calendar/new?date=` for the first day shown (042, 041: L92, L91).
