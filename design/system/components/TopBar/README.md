# TopBar

One bar at the top of every pushed screen: round back button left, title centered, up to two round actions right. Sticky.

Reference: `design/screens/OC-SettingsGroceries.dc.html` (title always), `OC-CalEvent.dc.html` (detail: title on scroll, ✎ and ⋯ actions), `OC-Recipe.dc.html` (over a photo), `OC-Cook.dc.html` (✕ exit).

## Specs

| Part | Spec |
| --- | --- |
| Bar | sticky top 0, `surface-page` background, padding safe-area (52) / 16 / 8, grid `1fr auto 1fr`, gap 8 |
| Scrolled | 1.5 px `line` bottom border + `shadow-bar` = 0 6px 14px -10px rgba(42,36,20,0.35) |
| Round button | 48 × 48, radius 50%, white, ink icon 20–22, `shadow-button` = 0 4px 14px rgba(42,36,20,0.18) |
| Title | 17/900, centered on the screen, one line, ellipsis, max 214 at 390 |
| Back | chevron-left 22, label "Back to {parent}"; cooking mode: ✕ 20, "Exit cooking mode" |
| Actions | right, gap 8, max 2 (Share + Settings on a recipe; Edit + More on an event) |

## Rules

- `titleMode="always"` on settings and list screens (no other h1 on the page; the lead sentence is the first content line).
- `titleMode="onScroll"` on detail screens: the big heading lives in the content; the bar title fades in once it scrolls under the bar.
- Over a photo (recipe), the bar background is transparent until the photo has scrolled away, then turns `surface-page`.
- Sheets, dialogs and the Cancel/Save forms keep their own headers.
