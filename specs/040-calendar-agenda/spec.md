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
