# Feature Specification: Design system package and app shell

**Feature Branch**: `002-design-system-shell` · **Status**: Ready · **Depends on**: 001
**Input**: Port the Our Cocon Design System (`design/system/`) to `packages/ui` and build the navigation shell with the floating tab bar.
**Design**: Design System (all components, Patterns.md); canvas `TabBar`.

## User Scenarios & Testing

### User Story 1 — Every screen looks like the design (P1)
A developer builds any screen only from `packages/ui` components and theme tokens, and it matches the canvas pixel for pixel at 390 px.
**Independent test**: the `/dev/gallery` route renders every component in every state next to the design-system previews.

**Acceptance scenarios**
1. **Given** tokens.json, **When** the theme is generated, **Then** every token is available as `theme.color.*`, `theme.space.*`, `theme.radius.*`, `theme.shadow.*`, `theme.size.*` and `theme.text.*`.
2. **Given** the gallery, **When** compared with each design-system preview, **Then** sizes, colours, radii and type match exactly.

### User Story 2 — Move between the four main areas (P1)
A family member taps Home, Recipes, Groceries or Settings in the floating tab bar.

**Acceptance scenarios**
1. **Given** any tab screen, **When** a tab is tapped, **Then** that screen shows and its tab expands with a honey fill and its label.
2. **Given** a pushed screen, sheet, form or cooking mode, **Then** the tab bar is hidden.

### Edge cases
- Largest system text size: tab labels still fit (the active label may shrink to 13 px, never wrap).
- Web wider than 720 px: content is centred at max 720 px wide and the tab bar stays bottom-centred at the same max width.

## Requirements

- **FR-001**: `pnpm theme` MUST generate the NativeWind (Tailwind) theme config and `packages/ui/theme.ts` from `design/system/tokens.json`; CI fails if the generated files are out of date. Components port `bundle.css` 1:1 using these classes.
- **FR-002**: `packages/ui` MUST export every design-system component with the variants and states its README lists (Button, IconButton, Pill, Tag, Switch, SegmentedControl, Stepper, TextField, MonthPicker, ListRow, Card, RecipeItem, StatTile, Callout, Avatar, StatusBanner, StepCard, TimerCard, TimerPill, TabBar, BottomSheet, Dialog, Progress, ScreenHeader).
- **FR-003**: Nunito (500–900) MUST load before first paint; icons are the design system's SVGs via `react-native-svg`.
- **FR-004**: Routing MUST use Expo Router with the four tabs, plus stack screens and modal sheets as in Patterns.md.
- **FR-005**: The tab bar container MUST reserve space for the TimerPill (spec 011) and screens pad their content 180 px at the bottom.
- **FR-006**: Light theme only in V1; dark mode is out of scope.

## Success Criteria
- **SC-001**: Zero hard-coded colour or size literals outside `packages/ui` (enforced by a lint rule).
- **SC-002**: Gallery screenshots taken at 390 px are reviewed side by side with the design-system previews (automated screenshot regression comes with Playwright later).

## Tracking (PostHog)
| Event | Properties |
| --- | --- |
| `tab_selected` | tab (home, recipes, groceries, settings) |

## Warnings and errors
All copy is in the States tables of the UI specs for: TabBar. New messages go there and in `strings/en.ts` first.

## Needs your attention
None.

## Changelog
- 2026-10-13: Ready. Decisions 1–34 applied; tracking added.
- 2026-10-16: Built. `pnpm theme` generates `packages/ui/theme.ts`, the Tailwind theme and the icons from `design/system`; CI fails when they're stale (`pnpm theme --check`). Colours are theme variables, so a second theme (e.g. dark) only needs values in tokens.json. All 24 components in `packages/ui` (ported from each README, bundle.css section and preview), shown at `/dev/gallery` (local and staging only). Expo Router shell: four tabs behind the floating TabBar, sheet and full-screen-modal presentations, centred 720 px frame on web; `tab_selected` tracked; SC-001 lint rule `cocon/no-design-literals`. Deviations: Nunito 400 also loads (`body-lg` is weight 400); `rounded-full` added for circles (bundle.css uses 50%); text links have a 44 px touch height; on iOS, amount highlights inside step text can't have padding or rounded corners (React Native limit); placeholder text keeps the input's weight (React Native can't style it separately); the active tab label's shrink to 13 px works on iOS only (web keeps it on one line); `design/ui/TabBar.md` was missing and is added. Tests check behaviour and accessibility (NativeWind doesn't run under Vitest); visuals were checked from 390 px screenshots.
