# Feature Specification: Accessibility and hints pass

**Feature Branch**: `030-accessibility-hints` · **Status**: Ready · **Depends on**: 001–029
**Input**: A final sweep to make sure every screen works for every family member, from kids to grandparents.

## User Scenarios & Testing

### User Story 1 — Screen-reader users can cook (P1)
**Acceptance**: **Given** VoiceOver on iOS (and a screen reader on the web), **Then** a user can find the quiche, set servings, add items to groceries, start cooking, run a timer and finish, using only the screen reader.

### User Story 2 — Big text still works (P1)
**Given** the largest system text size, **Then** no screen clips text or amounts; rows wrap; the tab bar labels shrink but stay readable.

### User Story 3 — Nobody gets stuck (P1)
**Given** any form or setting, **Then** confusing fields have hints, every error says what to do, and every empty state offers the next action.

## Requirements

- **FR-001**: Audit every screen against the constitution's section IV, and fix anything that fails.
- **FR-002**: Timers announce politely at 1 minute left and at zero; changes to servings announce the new count.
- **FR-003**: Focus order follows the visual order; sheets and dialogs trap focus and return it on close.
- **FR-004**: Respect Reduce Motion (no smooth scrolling in cooking mode; instant jumps instead).
- **FR-005**: Meet WCAG 2.2 AA on web and iOS.

## Success Criteria
- **SC-001**: Automated checks (axe on the web, the iOS Accessibility Inspector) report zero critical issues.
- **SC-002**: Usability test with one child (8–12) and one older adult (70+): both complete the main story without help.

## Tracking (PostHog)
No new events; this pass checks existing ones carry no user content.

## Warnings and errors
Checks that every state in every UI spec has its copy, hint and screen-reader label.

## Needs your attention
None.

## Changelog
- 2026-10-13: Ready. Decisions 1–34 applied; tracking added.
