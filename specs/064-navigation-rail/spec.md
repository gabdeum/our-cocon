# Feature Specification: Navigation on larger screens: tab bar, then side rail

**Feature Branch**: `064-navigation-rail` · **Status**: Ready · **Depends on**: 063, 036, 011

Screen: `design/screens/OC-NavResponsive.dc.html` (`mode="bar"` and `mode="rail"`). UI spec: `design/ui/OC-LargeScreens.md` § Navigation.

> The mockup redraws the tab bar and timer pill. Use the app's existing `TabBar` and timer pill. Only the width cap and the rail are new.

## Functional requirements
- **FR-001 Below 960: the existing tab bar**, unchanged, capped at 520 px wide and centred horizontally. The floating timer pill above it stays as today.
- **FR-002 From 960: side rail** (`NavRail`, new component, extends `TabBar`: same items, icons, order, routes and active rules). Rail 104 px wide, floating on the left: 12 px margin top, bottom and left, ink background, 30 px radius, `shadow-nav`.
  - Top: the Our Cocon logo tile (40 px honey square).
  - Items: Home, Calendar, Recipes, Groceries, Menu. Each 76 × 64 with the 24 px icon over a 13 px label, labels always shown. Active item: honey fill, ink 900 label. Others: `on-ink` 700.
  - Bottom (only while timers run): the timer pill in vertical form, 76 px wide, white with the 2 px honey border: clock icon, the first timer's time (16 px, tabular), the "+N" badge. Opens the timers screen. Hidden on cooking screens (they show timers themselves).
- **FR-003 Screens reserve space.** At `expanded`, screen content starts after the rail (104 px). Below 960, content keeps its bottom padding for the floating bar (as today).
- **FR-004 Accessibility.** The rail is a `nav` landmark labelled "Main", and the active item has `aria-current="page"` (iOS: selected trait).

## Success criteria
- **SC-001** Resizing from 959 to 960 swaps bar ↔ rail without losing the current route or scroll position.
- **SC-002** The rail's items and badges come from the same config as `TabBar` (one source).

## Tracking (PostHog)
No new events. Existing `tab_selected` gains `nav: bar | rail`.

## Needs your attention
- The rail has no settings or profile entry; everything stays in Menu, as on the phone.

## Changelog
- 2026-11-19: Ready.
