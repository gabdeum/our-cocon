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
- 2026-11-19: Shipped. `NavRail` (new, `packages/ui`) from 960 wide, fed by the same `TABS` as the `TabBar`; the TabBar is capped at 520 and centred; the TimerPill gets a `vertical` form for the rail (time and "+N", no ✕; its label names the timer: "2 timers running. Blind bake 11:42. Open timers"); tab screens start after the rail through the tab navigator's `sceneStyle`, so switching bar ↔ rail remounts nothing; `tab_selected` gains `nav`. Deviations: the logo tile shows the real Our Cocon mark in ink (the mockup's house outline is a placeholder); the rail's top and bottom margins are 12 or the safe area when larger; from 960 tab screens (and the calendar views) pad 28 at the bottom instead of 180, since nothing floats there; on the web the frame caps at 1200 + 104 from 960, so content beside the rail still reaches 1200 and the rail sits inside the centred frame (not pinned to the window's left edge on windows wider than 1304). An update is enough (no native change).
