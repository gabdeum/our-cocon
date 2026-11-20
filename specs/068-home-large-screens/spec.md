# Feature Specification: Home on larger screens

**Feature Branch**: `068-home-large-screens` · **Status**: Ready · **Depends on**: 063, 064, 028, 057

Screen: `design/screens/OC-HomeResponsive.dc.html` (pass `w`/`h`: 390, 820, 1180). UI spec: `design/ui/OC-LargeScreens.md` § Home.

> The mockup's "Today" card is a stand-in for the app's calendar Home card, and it doesn't show the Reminders card. Use the real cards: header, calendar card, reminders card, latest recipe, stat tiles, latest activity. Only the column layout is new.

## Functional requirements
- **FR-001 Compact**: unchanged.
- **FR-002 Medium and expanded (≥ 600)**: two columns (`1.1fr` / `1fr`), gap 18 (14 at expanded), each a stacked list read top to bottom:
  - Left: the reminders card (when shown), the calendar card, the latest recipe card (photo 200 px; 160 px at expanded).
  - Right: the two stat tiles, then Latest activity (shows 5 rows instead of 4).
  Content max 1200, 24 px gutter (063).
- **FR-003 Expanded header**: the rail shows the logo, so the logo row goes. The date and "Hi {name}" move up into the row with the family avatars (greeting left, avatars right). Top padding 20.
- **FR-004** Order and visibility rules of each card are unchanged (hidden cards leave no gap).

## Success criteria
- **SC-001** At 820 and 1180, nothing on Home needs scrolling to reach the first activity row (with sample data).

## Tracking (PostHog)
None new.

## Needs your attention
- Reminders card placement on wide screens: top of the left column, above the calendar card (same order as phone). Say if it should go on the right.

## Changelog
- 2026-11-19: Ready.
- 2026-11-20: Shipped. From 600 Home sits in two columns (1.1 / 1, gap 18, 14 from 960): on the left the Reminders card, the calendar card and the latest recipe (or the cooking cards, or "What's for dinner?"), with the photo at 200 (160 from 960); on the right the stat tiles, Latest activity with 5 rows, and the invite card for a family of one. From 960 the logo row goes: the date and "Hi {name}" sit left of the family avatars, still in the pinned row (050 FR-007). Below 600 nothing changes. Home always loads 5 activity rows and shows 4 on the phone, so rotating or resizing never refetches. `HeroCard` gains `photoHeight`, `BrandRow` a `lead` slot. "Needs your attention": the Reminders card stays at the top of the left column. Deviations: the top padding stays 24 under the safe area, like every tab screen from 600 (063; the screen source draws 24 too, the spec said 20); the space between the pinned row and the columns stays 18; on a native iPad wider than 1304 the content isn't capped at 1200 (032-later L165). No new events. An update is enough (no native change).
- 2026-11-20: After Gabriel's review, Home's Reminders and calendar cards are tighter at every size: `CalCard` padding 12 16 8 and gap 8 (was 14 16 12, 12), 6 above the footer link (was 10); the small event row min 50, padding 4 (was 58, 6); a new `ReminderRow size="sm"` for Home's card, min 50, padding 2 (the Reminders screen keeps 58); the week view 8 under the strip (was 10). Touch targets stay 44.
