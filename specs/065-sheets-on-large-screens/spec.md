# Feature Specification: Bottom sheets on larger screens: popover or centred card

**Feature Branch**: `065-sheets-on-large-screens` · **Status**: Ready · **Depends on**: 063, 002

Screens: `design/screens/OC-SheetPopover.dc.html` (cooking settings as a popover) and `OC-SheetCard.dc.html` (Share as a centred card). UI spec: `design/ui/OC-LargeScreens.md` § Sheets.

> The content inside both mockups is the existing phone sheet content (cooking settings is a guess at its rows; Share is copied from the phone). Keep each sheet's real content exactly as it is. Only the way it's presented changes.

## Functional requirements
- **FR-001 One component, three presentations.** `BottomSheet` gets a `presentation` decided by tier, so screens don't change their code:
  - `compact`: the bottom sheet, exactly as today.
  - `medium` / `expanded` + `kind: "menu"`: **popover** anchored to the button that opened it.
  - `medium` / `expanded` + `kind: "flow"`: **centred card**.
  Each existing sheet declares `kind` once. Default `flow`.
- **FR-002 Popover** (short choices: cooking settings, recipe ⋯ / More options, grocery item ⋯, grocery settings, calendar view menu, units). 360 px wide; `surface-page` background; 1.5 px `line` border; 22 px radius; `shadow-float`; 16 px padding. It opens 12 px below the anchor, with its right edge 16 px from the screen edge, or under the anchor's left edge when there's room. A 14 px arrow points at the **centre of the anchor button**: compute it from the anchor's centre, not from the popover's edge. No backdrop: the screen behind stays readable. Tapping outside or pressing Esc closes it. The opening button shows its active state (honey fill) while open.
- **FR-003 Centred card** (longer flows: Share, Add to groceries, Edit recipe, Add / edit event, delete confirmations). 540 px wide (max: window − 48), max height window − 96 with inner scroll. `surface-page`, 32 px radius on all corners, 20 / 24 / 22 px padding. Same `scrim` backdrop as the phone; tapping it closes. The drag handle is replaced by a 44 px round close button (soft fill) at the top right of the title row. Content and buttons are unchanged.
- **FR-004 Keyboard on iPad.** When a text field in a centred card is focused, the card moves up to stay above the keyboard (or scrolls inside); it never sits behind it.
- **FR-005 Calendar day sheet** (month view): replaced at medium and expanded by the inline selected-day panel in 070, so it never opens there.

## Success criteria
- **SC-001** Every sheet in the app opens with the right presentation at 390, 820 and 1180 (checklist in the PR).
- **SC-002** The popover arrow's centre is within 1 px of the anchor button's centre at all sizes.

## Tracking (PostHog)
Existing sheet events gain `presentation: sheet | popover | card`.

## Needs your attention
- Defaults for `kind`: listed in FR-002 / FR-003. Move any sheet between the lists if it feels wrong.

## Changelog
- 2026-11-19: Ready.
