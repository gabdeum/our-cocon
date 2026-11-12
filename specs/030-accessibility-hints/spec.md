# Feature Specification: Accessibility and hints pass

**Feature Branch**: `030-accessibility-hints` · **Status**: Built · **Depends on**: 001–029, 033–044
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
- 2026-11-11: Built.
  - **Announcements (FR-002):** `announce()` in `@cocon/ui` (VoiceOver/TalkBack on the phone, one polite live region on the web). The timer store says "1 minute left on {timer}" once as any timer passes 60 s; every toast is now heard on the phone too, so "{timer} is done" is said at zero. Servings say "5 servings", cooking mode says "Step 3 of 7: Bake" after Next, Back or a segment, and a recipe search says how many it found.
  - **Toggles:** chips, pills, day and slot chips read as selected on the phone too (`pressedState`: `aria-pressed` on the web, `selected` on iOS).
  - **Calendar labels (FR-006):** every event names who it's for: "Poker night, Gabriel, Sunday October 25, Evening" (week), "Busy, Eva, …" for a private event, "Brunch, Everyone, Lunch · Grandma's house" (day and agenda rows, whose date is their heading). Home's week strip reads "Today, October 25: Brunch, Baby swim" instead of a count of colours.
  - **Outlines (FR-007):** new tokens `member-*-edge`, a deeper tone of each member colour at ≥ 3:1 against white and the page, drawn as a 1 px outline on chips, bars, week blocks, Home's dots and colour swatches. The widget's `Theme.swift` leaves the edges out, so no new iPhone build is needed.
  - **Large text (User Story 3):** at 135% text size and up, a month cell shows its first chip, then a dot per further event (its label still names them all); its date and chip text stop growing at that size. Buttons wrap to two lines and grow; step and recipe titles aren't cut; timer buttons and the Stepper grow with their text.
  - **Reduce Motion (FR-004):** month jumps, Agenda's Today, cooking mode's step scroll and dimming, a grocery row's swipe back and Dialog's fade are instant; the setting is followed while the app is open.
  - **Focus (FR-003):** sheets and dialogs already trapped focus (react-native-web's Modal on the web, `aria-modal` on the phone). BottomSheet and Dialog now take `returnFocusRef` to give focus back to the button that opened them, wired on cooking mode's options; sheets opened as routes (add to groceries, scale, share, add event) get it from navigation. The other in-place sheets and dialogs are 032 L131.
  - **Smaller fixes:** warning Callouts are alerts; the recipe header photo reads "Photo of {recipe}" and the grocery card's thumbnail is skipped; step rows read "Step 3: Bake, 35:00 timer. Opens in cooking mode"; the Timers screen's buttons and progress bars name their timer ("Pause: Blind bake"); the event page's ⋯ menu has a "Close" backdrop; the timer pill's ✕ is 44 to tap; Filter and quick pills are 44 to tap; a setting's hint is linked to its control; "Units" in recipe settings is said once; a ListGroup's pressable rows are list items, and a control at the end of a pressable row (Restore) sits beside it rather than inside.
  - **Audit (FR-001, User Story 4):** the earlier specs' hints, errors and empty states held up: every form field the UI specs mark as confusing has its hint, every error says what to do ("Check your connection and try again"), and every empty state offers the next action (Recipes, Groceries, Timers, Agenda, Home). What the audit did find is fixed above, or is in 032 (L129, L130).
  - **Tests:** axe-core (dev only) runs in one main test of every screen and sheet that has a screen test, 34 in all (`apps/app/test/axe.ts`, zero critical or serious). It caught the list-item and nested-button issues above, unnamed timer progress bars, and the converter's results, which the web didn't read at all (now one element each, "20 tablespoons"). Token contrast is in `scripts/theme.test.ts`.
  - **Deviations:** focus return is wired on cooking mode only (L131). Month chips under 430 px keep the title only, as drawn (Gabriel's choice; screen-reader labels name who, 032 L128). The month cell label keeps "Brunch (Eva)" rather than titles alone, so who is still said. Day and agenda rows don't repeat the date their heading gives. The "each ≈ ? g" field gets no extra hint: the screen's lead already explains it.
- 2026-11-12: From Gabriel's check: every person badge gets the outline too (Avatar, member chips' badges, the activity rows' badge) through a shared `EdgeRing` inside the circle, so the Avatar's surface-page ring and stacked badges' rings stay. Others' `line-handle` outline becomes its edge tone. Photo avatars and the AI badge (olive border) are unchanged.
