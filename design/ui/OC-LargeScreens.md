# Our Cocon on larger screens: UI spec (binding)

For specs 063–070. The phone app stays the reference. Larger screens show more of the same screens, components and data side by side. When this doc and a screen source disagree, this doc wins. When either disagrees with an existing component's behaviour, the existing component wins: keep it and tell Gabriel.

## How to read the screen sources

Each source in `design/screens/` is **one responsive component** that takes `w` and `h` props (and `view` for the calendar). Preview it at the sizes listed per section to see each tier. Inside each source:
- **New and binding**: the column layout, panel widths, spacing, what appears at which width, the step list, the timers panel, quick timers, the nav rail, the inline calendar day panel, mini month, "Coming up", the popover and centred card frames.
- **Placeholders, keep the app's real version**: tab bar, timer pill, timer cards, step sections, recipe header block and options, ingredient and step rows, Home cards (the "Today" card stands in for the calendar card; the Reminders card isn't drawn), grocery rows and recipe cards, calendar chips, event rows and header, sheet contents (the cooking-settings rows are a guess), sample data and dates (October 2026).

| Source | Shows |
| --- | --- |
| `OC-CookResponsive.dc.html` | 066 cooking mode at every tier |
| `OC-RecipeResponsive.dc.html` | 067 recipe page (and list at ≥ 960) |
| `OC-HomeResponsive.dc.html` | 068 Home |
| `OC-GroceriesResponsive.dc.html` | 069 Groceries |
| `OC-CalendarResponsive.dc.html` | 070 calendar, `view` = month / week / day |
| `OC-NavResponsive.dc.html` | 064 tab bar (`mode="bar"`) and rail (`mode="rail"`) |
| `OC-SheetPopover.dc.html` | 065 popover (cooking settings over cooking mode at 820) |
| `OC-SheetCard.dc.html` | 065 centred card (Share over the recipe at 820) |

## Tiers (063)

| Tier | Window width | Typical | Navigation |
| --- | --- | --- | --- |
| compact | < 600 | iPhone, Slide Over, ½ split on 11" iPad (≈ 590) | tab bar (today) |
| medium | 600–959 | iPad mini upright 744, iPad upright 820–834, ⅔ split | tab bar, capped 520 and centred |
| expanded | ≥ 960 | iPad sideways 1133–1366, laptop | side rail 104 |

Width only, never device type. Live on resize and rotation.

## Spacing

- Gutter: 20 phone, **24 from 600**, measured from the screen edge or the rail.
- Top: safe area + 24 from 600 (phone keeps its current top).
- Content max width **1200**, centred only past that.
- Panels: 290 (medium), 320 (expanded). Gaps between columns: 16–28 as noted per screen.
- Cards, radii, colours, type styles, touch targets: the design system, unchanged. Type does not scale up.

## Two-column lists

Always **read by column**: fill column 1 top to bottom, then column 2 (`splitColumns`, 063 FR-004). Applies to grocery aisles, the calendar Day sections, the selected-day rows in Month at medium, and any future two-column list. Never a left-to-right grid of list items.

## Navigation (064)

- < 960: existing tab bar, max 520 wide, centred; timer pill above it as today.
- ≥ 960: rail. 12 px margin top/bottom/left, 30 radius, ink, `shadow-nav`. Logo tile 40 (honey, 12 radius) then 12 px gap. Items 76 × 64, radius 20, icon 24 over a 13 px label; active honey/ink 900, inactive `on-ink` 700. Timer button at the bottom: 76 wide, white, 2 px honey border, radius 20: clock 20, time 16/900 tabular, "+N" honey badge.

## Sheets (065)

- Popover: 360 wide, `surface-page`, 1.5 px `line` border, radius 22, `shadow-float`, padding 16, title 18/900. Top = anchor bottom + 12. Arrow 14 × 14 rotated square with the same border on two sides, **centred on the anchor button's centre**. No scrim. The anchor shows honey fill while open.
- Centred card: 540 wide (≤ window − 48), radius 32, padding 20 / 24 / 22, `scrim` behind, 44 px round close button (soft) in the title row instead of the handle.
- Toasts from 600: max 420 wide, still 12 below the safe area, centred (phone: 560 − 32).

## Cooking (066) · preview 390 × 844, 590 × 820, 744 × 1133, 820 × 1180, 1180 × 820

- Phone header: close (left) · Timers + Settings round 48 buttons (right, white, `0 4px 14px rgba(42,36,20,.18)`). Settings icon = sliders (three lines with dials).
- Phone timer pill: bottom-centred, 12 above the Back / Next bar, 50 tall, white, 2 px honey border, `shadow-float`, icon 20 · name 15/800 · time 17/900 · "+N" 13/900 honey.
- ≥ 600 header: close · recipe title 20/900 + "Serves 6 · Classic" 14/700 · Settings button. Header padding 28 top (no status-bar offset) / 20 sides.
- ≥ 600 body: padding 16 / 20 / 20, gap 16. Steps column takes the rest of the width, max 960 (the app: the design's 640 left large iPads centred, spec 066 changelog); Back / Next under it (grid 1fr 2fr, 60 tall).
- Timers panel: 290 (medium) / 320 (expanded), growing to 24 % of the window, max 380 (the app). Title 22/900 + summary 15/700. Existing timer cards (state colours: running sage, paused soft, done honey + 2 px ink). Quick timer: label 13/900 uppercase muted; 4 equal buttons, 48 tall, radius 14, 2 px dashed `line-dashed`, olive-deep 15/900: "5 min", "10 min", "15 min", "30 min". Hint 13/600 centred.
- Step list (≥ 960): 260 wide white card (the app: 18 % of the window, max 300), radius 22, padding 10. Rows min 56, radius 16, gap 12: badge 32 (current olive/white; done `olive-muted` + tick; upcoming soft), name 16 (current 900), running time pill (ink, 13/900, tabular).
- Step photo: square 72 (phone) / 96 (≥ 600), radius 16, right of the title, top-aligned; only when present.
- Step section min height: 500 (phone) / max(500, 60 % of window height).
- Copy not drawn (066): the full-screen step photo is a dialog "Photo for {step name}" with a round ✕ "Close photo"; a step with no name reads "Step {n}" in the step list and "See the photo for step {n} larger" on its photo. Step list rows read "Go to step {n}: {name}", plus ", timer {time}" while its timer shows. The header's line is "Serves {n}" alone when the recipe has no versions.

## Recipe (067) · preview 390 × 844, 744 × 1133, 1180 × 820

- ≥ 600: hero 280; sheet padding 24 sides; two equal columns, the ingredients one never under 260 (Gabriel, 067; the source draws `minmax(260px, .8fr) minmax(0, 1.2fr)`), gap 28. Column titles 20/900 ("Ingredients · 9", "Steps · 6"), and "Version" too (Gabriel, 067; the source draws it 16). No tabs.
- More options link: under the Servings card (−10 margin), olive 15/800, sliders icon 18, 44 tall.
- Step card (all sizes): white, radius 22, padding 10 / 12 / 10 / 14, min 64, gap 12: badge 32 honey · title 18/900 · Variant tag · timer pill (soft, clock 16 olive, 14/800 tabular, "12 min") · photo 48 radius 12 · chevron 18. Whole card is the tap target → cooking mode at that step. Hint above: "Tap a step to open it in cooking mode" 13/600 muted.
- ≥ 960: rail 104 · list column 320 (padding 28 / 12 / 16 / 20; rows 64 thumb, radius 20, 2 px olive border on the open one) · recipe panel with 12 margin (top/right/bottom), radius 28, 2 px `line-strong` border, internal scroll, no back button.
- Footer ≥ 600: right-aligned, max 520, cart button with label.
- Copy not drawn (067): the options popover is titled "More options" and its close is "Close options" (screen readers). A step card's label is "Step {n}: {name}", then ", Variant" and ", {12 min} timer" when they show, then ". Opens in cooking mode". A step a variant changes carries the Variant tag too, as in cooking mode.

## Home (068) · preview 390 × 844, 820 × 1180, 1180 × 820

- ≥ 600: grid `1.1fr / 1fr`, gap 18 (14 at ≥ 960). Left: reminders card, calendar card, latest recipe (hero 200; 160 at ≥ 960). Right: stat tiles, Latest activity (5 rows).
- ≥ 960 header: no logo row; greeting block (date 15/700 olive + "Hi Gabriel" 32/900) on the left of the avatars row; top padding 20.

## Groceries (069) · preview 390 × 844, 820 × 1180, 1180 × 820

- Header row (all sizes): title + count left; shopping pill + round 48 settings button right.
- ≥ 600: recipe cards 2-column grid; aisles 2 columns by column, gap 14, both columns top-aligned; Clear done / Clear all a centred pair, max 420. ≥ 960 adds only the rail.

## Calendar (070) · preview month / week / day at 390 × 844, 820 × 1180, 1180 × 820

- Header ≥ 600 row 1: title 32/900 · ‹ (44 round white) · Today (soft pill) · › · "+ Event" (olive pill 44). Row 2: segmented views (soft track, white selected with `shadow-segment`, items 44 tall, padding 18) · people chips right: 40 tall, white, padding 0 12 0 4, 30 px colour dot with initial, label 14/800; hidden = transparent with 2 px `line-strong` inset, pale dot, muted struck label.
- Month ≥ 600: weekday labels 13/900 "Sun…Sat"; cell padding 6; day number 14 (today: olive 24 circle); chips 20 tall / 12 text / radius 6; "+N" 12/900; multi-day bars same size at top 32. Selected day: 2.5 inset ink.
  - Medium: row 124; selected-day panel under the grid: title 22/900, count 14/700, rows (phone sheet rows) in 2 columns by column, gap 8, dashed add button 52.
  - Expanded: row = max(96, (available − 40) / weeks); panel 320 beside the grid, one column.
- Week ≥ 600: hour 44 px, gutter 52 with 12 px labels; day header weekday 13/900 + number 18 (today olive 34 circle); all-day chips 32 tall 14/800; event cards padding 5 / 6, radius 10, "who · time" 12/900, title 14/800.
- Day ≥ 600: sections in 2 columns by column, gap 16. Expanded side column 300: mini month card (white, radius 22, padding 12; cells 38 tall radius 12, 14 px; selected ink, today olive, 5 px dot for days with events: olive, honey on dark cells), then "Coming up" label (13/900 uppercase) and 3 white rows (radius 18, padding 10 / 12: weekday 12/900 muted over date 20/900, then titles 14/700 muted).

## Copy (new strings only)

- "Tap a step to jump to it" · "Quick timer" · "{n} min" · "{n} min timer" · "Tap a step to open it in cooking mode" · "More options · scale, units" · "+ Event" · "+ Add on {Sun 25}" · "Coming up" · "Nothing planned" · "All steps"
