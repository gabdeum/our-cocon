# Feature Specification: Responsive foundation: layout tiers, spacing, iPad support

**Feature Branch**: `063-responsive-foundation` · **Status**: Ready · **Depends on**: 002, 036

Larger screens are an extension of the phone app: same screens, same data, same components, more of them visible at once. **No new data, tables, API calls, MCP tools or business logic in any of specs 063–070.** This spec adds the shared plumbing specs 064–070 use.

UI spec: `design/ui/OC-LargeScreens.md` (binding for breakpoints, sizes and spacing).

## Functional requirements
- **FR-001 Layout tiers by window width, never by device.** One hook, `useLayoutTier()`, built on `useWindowDimensions()`:
  - `compact` < 600 px — iPhone, iPad Slide Over, iPad split view at ⅓ or ½ on 11", narrow browser windows.
  - `medium` 600–959 px — iPad mini and iPad upright, ½ split on 13" iPad, ⅔ split views.
  - `expanded` ≥ 960 px — iPad sideways, laptop and desktop browsers.
  The hook returns `{ tier, width, height }` and updates live on rotation, split-view resizing and browser resizing, with no reload and no lost state (a running timer, a scroll position, an open step).
- **FR-002 Compact is today's app.** At `compact`, every screen renders exactly as it does now. Specs 064–070 only add branches for `medium` and `expanded`. The one phone change: cooking mode's timer pill moves to the bottom (066 FR-001).
- **FR-003 Spacing tokens** added to the theme (and to `design/ds` tokens if the repo mirrors them):
  - `layout.gutter`: 20 at compact, 24 at medium and expanded. Measured from the screen edge, or from the side rail when it shows.
  - `layout.top`: as today on phone (safe area), 24 below the safe area at medium and expanded.
  - `layout.maxContent`: 1200. Content grows with the window up to 1200, then centres. On iPads it always fills the width.
  - `layout.panel`: 290 (medium side panels), 320 (expanded side panels).
  - `layout.rail`: 104 (side rail, 064).
- **FR-004 Two-column lists read by column.** Shared helper `splitColumns(items, columns, weight)` (in `packages/ui` or the shared utils). It keeps the order and fills column 1 top to bottom, then column 2. It breaks where the running weight passes the next equal share, so columns end at about the same height. Used by 068, 069, 070 and any future two-column list. Never lay out a list in a grid that reads left to right.
- **FR-005 Web.** The rule "mobile layout centred at 720 px" is replaced by the tiers: below 600 the phone layout (centred, max 560); from 600 the medium and expanded layouts. Same components, same hook.
- **FR-006 iPad app.** In `app.json` / `app.config`: `ios.supportsTablet: true`, `ios.requireFullScreen: false` (allows Split View and Slide Over), `orientation: "default"` (all orientations on iPad; iPhone keeps portrait if that's today's setting). No iPad-only screens and no `Platform.isPad` branches: tiers only.
- **FR-007 Text sizes don't grow.** Type styles stay the design-system styles at every tier. More space shows more content, not bigger text. The only exceptions are listed per screen in the UI doc (e.g. calendar month chips).
- **FR-008 Touch targets** stay ≥ 44 px at every tier. Pointer hover states on web and iPad trackpad use the existing pressed styles.

## Success criteria
- **SC-001** Unit test: `useLayoutTier` returns compact/medium/expanded at 599/600/959/960 px.
- **SC-002** Unit test: `splitColumns` keeps order, never leaves column 1 empty, and its column heights differ by at most one item's weight from the best split.
- **SC-003** On an iPad simulator, rotating and resizing a split view while cooking keeps the running timers and the current step.
- **SC-004** Visual check: every existing phone screen is pixel-identical at 390 px before and after this spec (cooking mode changes later, in 066).

## Tracking (PostHog)
| Event | Properties |
| --- | --- |
| (super property on every event) | `layout_tier` (compact, medium, expanded), `device_class` (phone, tablet, desktop) |

## Warnings and errors
None new.

## Needs your attention
- Breakpoints 600 / 960 are by window width, so a ½ split on an 11" iPad (about 590 px) shows the phone layout. That was intended in the mockups. Say if you want 560 instead.
- `requireFullScreen: false` makes iPadOS require all four orientations. Check your iPhone orientation setting isn't affected (it's per device family).

## Changelog
- 2026-11-19: Ready. From the "Cocon — iPad & Laptop" design canvas.
- 2026-11-19: Gabriel confirmed the phone's one change is cooking mode's timer pill at the bottom (066 FR-001).
- 2026-11-19: Shipped. `useLayoutTier()`, `layoutTier()`, `gutterFor()` and `splitColumns()` in `packages/ui/layout.ts`; layout tokens; AppFrame and the screen layouts in `packages/ui/components/Layout.tsx` use the tiers; iPad support in `app.json`; `layout_tier` and `device_class` super properties. Deviations: the tokens are a flat `layout` group in `design/system/tokens.json` (`theme.layout.medium`, `expanded`, `gutter`, `gutterWide`, `topWide`, `phoneMax`, `maxContent`, `panelMedium`, `panelExpanded`, `rail`) and `theme.layout.maxWidth` (720) is gone. The 560 / 1200 frame caps apply on the web only; the iPhone and iPad app always fill the window. BottomSheet, Toast and Dialog cap at 560 until 065. FR-006: the iPhone keeps `orientation: "portrait"` and the iPad gets all four orientations through `UISupportedInterfaceOrientations~ipad`, rather than `orientation: "default"`. `Platform.isPad` is read only for the `device_class` analytics value, never for layout. Super properties go through a new `Tracker.register` (optional on the transport; the MCP server and the shared-page tracker don't send them) and are registered again after sign-out. Until 064–070 ship, web windows from 600 wide show the phone screens stretched up to 1200, with a 24 gutter. Needs a new iPhone build (`pnpm release:ios`).
