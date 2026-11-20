# BottomSheet

A sheet that slides up over a dimmed screen for focused tasks: filters, scaling, the converter, sharing, picking groceries. From 600 wide it shows as a popover or a centred card instead (spec 065, `design/ui/OC-LargeScreens.md` § Sheets); its content and buttons don't change.

## Presentations

Each sheet declares its `kind` once; the window's tier picks the presentation (`sheetPresentation` in `packages/ui/layout.ts`).

| Tier | `kind: "menu"` (short choices) | `kind: "flow"` (default, longer tasks) |
| --- | --- | --- |
| compact (< 600) | bottom sheet | bottom sheet |
| medium, expanded | popover | centred card |

| Part | Popover | Centred card |
| --- | --- | --- |
| Box | 360 wide (≤ window − 32, `layout-popover`), surface-page, 1.5 `line` border, radius 22, `shadow-float`, padding 16, gap 12 | 540 wide (≤ window − 48, `layout-card`), max height window − 96 (the body scrolls), surface-page, radius 32 all round, padding 20 / 24 / 22, gap 16 |
| Place | 12 below the anchor; under its left edge when there's room, else its right edge 16 from the window's. Above the anchor (arrow at the bottom) only when it doesn't fit below and there's more room above | centred |
| Arrow | 14 × 14 rotated square, same fill, the border on its two outer sides, its centre on the anchor's centre | none |
| Behind | nothing: the screen stays readable; an outside tap or Escape closes it | `scrim`; tapping it closes the card |
| Header | title 18/900, no handle, no ✕ | title 24/900; a 44 soft ✕ on the right of the title row in place of the handle |
| Anchor | the button that opened it (`anchorRef`, else `returnFocusRef`) shows honey (`expanded`) while open. No anchor: it opens as a card | — |
| Keyboard (iPad) | keeps clear of it | moves up above it; the body scrolls if it must |

Unsaved changes (`dirty`) keep an outside or scrim tap from closing either. Swiping is the bottom sheet's only.

Menus today: cooking mode's settings, a grocery item's ⋮ menu (and its Move to… and Store size), grocery settings. Every other sheet is a flow. Confirmations stay `Dialog`.

## Specs

| Part | Spec |
| --- | --- |
| Scrim | `scrim` over the whole screen; tapping it closes the sheet (unless there are unsaved changes) |
| Sheet | surface-page, top radius 32, padding 12 20 28, gap 16; hugs content up to 92% of the screen height |
| Handle | 44 × 5, radius 3, line-handle, centred |
| Header | title 24/900; optional lead 15/600 muted, under the title and its button; optional close IconButton `--soft` (`closeButton`) or a "Clear all" / "Edit" link on the right, vertically centred on the title (spec 058); optional leading Avatar 48 before the title, centred on it (OC-CalBusy, spec 043); or a hero above it (IconTile `xl`), with the title and lead centred under it (OC-NotifAsk, spec 046) |
| Body | scrolls if it overflows; sections start with 15–16/900 headings ("1. Which ingredient?") |
| Footer | fixed: one full-width ink button, or soft Cancel (≈110) + ink primary |
| Floating | optional round button (IconButton `fab`) over the bottom-right, 20 from the side and 34 from the bottom; the body keeps 72 px clear under it (the month's day sheet, spec 037) |

## Rules

- One task per sheet. The primary button states the result: "Show 12 recipes", "Apply to recipe", "Add 3 items".
- Swipe down closes. Focus moves to the title on open.
- A sheet whose field takes focus on open (`fieldFocus`, the add sheet's title so the keyboard opens at once) doesn't move focus to its title.
- On the iPhone the sheet rises above the keyboard (KeyboardAvoidingView), so the field being typed in stays in view (spec 030).
- `returnFocusRef`: the button that opened it gets focus back on close (spec 030 FR-003). Keep the sheet mounted with `visible` for this to work.
- `titleSwitch`: a pill SegmentedControl in place of the title, between related sheets that keep one sheet open (the calendar's "New event · New reminder"). `title` still names the dialog.
