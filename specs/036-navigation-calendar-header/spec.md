# Feature Specification: Tab bar v2 and calendar header

**Feature Branch**: `036-navigation-calendar-header` · **Status**: Ready · **Depends on**: 002, 034
**Input**: Add Calendar as the second tab, turn Settings into Menu, and build the shared calendar header (title, arrows, view switcher, member filter).
**Design**: canvas `TabBar`, `CalHeader`; components TabBar, SegmentedControl, IconButton, new MemberChip, CalendarHeader.

## User Scenarios & Testing

### User Story 1 — Find the calendar (P1)
**Given** any tab screen, **Then** the tab bar shows Home · Calendar · Recipes · Groceries · Menu, and tapping Calendar opens the user's default view (Month unless changed in spec 029).

### User Story 2 — Show only some people (P1)
**Given** the calendar header, **When** Gabriel taps "Eva" in the filter row, **Then** Eva's events hide (chip unpressed) and the choice is remembered for Gabriel on this device.

## Requirements

- **FR-001 Tab bar** (updates spec 002): order Home, Calendar, Recipes, Groceries, Menu. The last tab has a three-bar menu icon, label and accessible name "Menu", and opens the Menu (`/menu`, spec 029; until 029 is built it opens the existing `/settings` screen). The selected tab has a fixed width of 132 px with 16 px side padding and never grows; unselected tabs share the rest (min 44 px).
- **FR-002 Calendar header** (`CalendarHeader` component): title, previous/next round buttons (accessible names "Previous month/week/day", "Next …"), "Today" pill, view switcher Month · Week · Day · Agenda (links, `aria-current`), member filter row.
- **FR-003**: Title text follows spec 034 FR-007 ("October" this year; "Jan. 2027" under 430 px and "January 2027" above for other years).
- **FR-004 Member filter**: one MemberChip per member in member order, then "Everyone" and "Others" (always present). Pressed = shown. Hiding a member hides events where they're the only member; multi-member events stay while any shown member is on them. The selection is stored per user per device.
- **FR-005**: Arrows and "Today" move the visible range of the current view; swipes do the same in Week and Day (specs 038, 039).
- **FR-006**: Spec 002's `tab_selected` event gains the values `calendar` and `menu` (was `settings`).

## Tracking (PostHog)
| Event | Properties |
| --- | --- |
| `calendar_viewed` | view (month/week/day/agenda), entry (nav, homepage) |
| `calendar_view_changed` | from, to |
| `calendar_member_filter_changed` | members_visible (count) |

## Warnings and errors
No user-facing errors.

## Needs your attention
None.

## Changelog
- 2026-10-25: Ready. Written from the calendar brief and the reviewed canvas (page "Our Cocon · Calendar"). Renumbered on 2026-10-26: Home and Settings for all modules are 028 and 029.
- 2026-10-26 (later): Menu opens `/menu` (spec 029: Apps and Settings).
- 2026-10-27: Built. Tab bar v2 (Home · Calendar · Recipes · Groceries · Menu, selected tab a fixed 132 px; Menu opens `/settings` until 029) and `CalendarHeader` with the new `MemberChip` (filter variant) in `packages/ui`. Titles come from `@cocon/calendar`; the engine gains `shiftAnchor` (‹ › paging) and `shownByFilter` (FR-004's rule, for 037–040 and Home). The member filter is remembered per user on the device (hidden ids only). New icons: calendar, menu, person. Events: `calendar_viewed`, `calendar_view_changed`, `calendar_member_filter_changed`; `tab_selected` gains `calendar` and `menu` (was `settings`). Deviations: the hidden chip isn't drawn, so it follows the Pill's unselected look (032-later L89); ‹ › use the existing icons (stroke 2.4, screen 2.6); "Today" keeps Button's 18 px padding (screen 14); Agenda's arrows move a week ("Previous week"), as the screen's code does; the tab reopens on the last view and day, and the default view comes with 029 (L88). The view bodies are empty until 037–040. `members_visible` counts every shown chip, Everyone and Others included; `offline_banner_shown` gains `calendar`.
- 2026-10-28: Seen on the iPhone (Expo Go): a tab once selected stayed wider than the others, pushing the bar off screen; on the iPhone a tab is now made anew when it's selected or unselected (the web keeps it, for keyboard focus). The bar sat 60 from the bottom (26 + the 34 safe area); it now sits 26 from the bottom or the safe area if larger. TabBar README updated.
