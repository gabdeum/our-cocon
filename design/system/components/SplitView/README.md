# SplitView

A list beside the item it opened, on windows 960 wide and up (spec 067): the side rail, the list in a column, and the item in a framed panel that scrolls on its own. Below 960 the item fills the screen as before. Recipes uses it first; any list → detail pair can.

Reference: `design/screens/OC-RecipeResponsive.dc.html` (at 1180), `design/ui/OC-LargeScreens.md` › Recipe (inline styles are the exact values; build with tokens).

## Specs

| Part | Spec |
| --- | --- |
| Rail slot | `layout-rail` (104): the NavRail (NavRail README) |
| List column (`ColumnScreen`) | `layout-panel-expanded` (320); padding 28 under the safe area / 12 / 16 / 20, 12 apart; the header (title + New) and the pinned search and pills stay, the rows scroll, 8 apart |
| Panel | the rest of the width; 12 margin top, right and bottom (the safe area when larger), radius 28 (`radius-2xl`), 2 px `line-strong` border, `surface-page`, clips its content and scrolls inside |
| Open item | its row in the list is marked (RecipeItem › Small: 2 px olive border, `aria-current="page"`) |

## Rules

- The panel holds a whole screen (`PhotoScreen`, `PushedScreen`). It already clears the safe area, so the screen inside sees none: its TopBar sits 24 from the panel's top.
- No back button in the panel: the list and the rail are the way out.
- Picking another item swaps the panel on the same route (the URL changes on the web, no push); the list stays mounted, so its search, filters and scroll stay.
- Crossing 960 doesn't remount the item: it keeps its place in the tree and its scroll.
- No timer pill floats over the panel: the rail shows the timers.
