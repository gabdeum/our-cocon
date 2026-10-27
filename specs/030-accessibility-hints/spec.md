# Feature Specification: Accessibility and hints pass

**Feature Branch**: `030-accessibility-hints` · **Status**: Ready · **Depends on**: 001–029, 033–044
**Input**: A final sweep to make sure every screen — recipes, groceries, calendar, Home and the Menu with its settings pages — works for every family member, from kids to grandparents.

## User Scenarios & Testing

### User Story 1 — Screen-reader users can cook (P1)
**Acceptance**: **Given** VoiceOver on iOS (and a screen reader on the web), **Then** a user can find the quiche, set servings, add items to groceries, start cooking, run a timer and finish, using only the screen reader.

### User Story 2 — Screen-reader users can plan the week (P1)
**Given** a screen reader, **Then** a user can read what's on today from Home, move between days and weeks without swiping (header arrows), add "Poker night tonight, evening", and hear each event as "Poker night, Gabriel, Sunday October 25, Evening".

### User Story 3 — Big text still works (P1)
**Given** the largest system text size, **Then** no screen clips text or amounts; rows wrap; the tab bar labels shrink but stay readable; month chips fall back to dots plus the first chip.

### User Story 4 — Nobody gets stuck (P1)
**Given** any form or setting, **Then** confusing fields have hints, every error says what to do, and every empty state offers the next action.

## Requirements

- **FR-001**: Audit every screen against the constitution's section IV, and fix anything that fails.
- **FR-002**: Timers announce politely at 1 minute left and at zero; changes to servings announce the new count.
- **FR-003**: Focus order follows the visual order; sheets and dialogs trap focus and return it on close.
- **FR-004**: Respect Reduce Motion: no smooth scrolling in cooking mode, no slide when swiping weeks and days, instant month jumps.
- **FR-005**: Meet WCAG 2.2 AA on web and iOS.
- **FR-006 Calendar**: color is never the only signal (initials or icons on every chip, bar, block and swatch); every swipe has a button alternative (‹ ›, "Today"); day cells, blocks and rows have full labels ("October 25: Brunch, Baby swim, Movie night"); private events read "Busy, Eva"; the Who and filter chips are toggle buttons with pressed state.
- **FR-007**: Event and grocery colors pass 3:1 against white for their outlines, with ink text at 4.5:1 on every member color.

## Success Criteria
- **SC-001**: Automated checks (axe on the web, the iOS Accessibility Inspector) report zero critical issues.
- **SC-002**: Usability test with one child (8–12) and one older adult (70+): both complete the cooking and the planning stories without help.

## Tracking (PostHog)
No new events; this pass checks existing ones carry no user content.

## Warnings and errors
Checks that every state in every UI spec has its copy, hint and screen-reader label.

## Needs your attention
None.

## Changelog
- 2026-10-13: Ready. Decisions 1–34 applied; tracking added.
- 2026-10-26: Extended to the calendar, Home and Settings for all modules; runs last.
