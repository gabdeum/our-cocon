# TabBar

The floating dark navigation pill with five destinations: Home, Calendar, Recipes, Groceries, Menu.

## Specs

| Part | Spec |
| --- | --- |
| Bar | 68 tall, radius 34, ink, padding 8, gap 4, `shadow-nav`; 16 from the sides, 26 from the bottom or the safe area if larger (34 on the iPhone). The bar and pill's container is max 520 wide (side padding included), centred (spec 064) |
| Item | flex 1 1 0, min-width 44, radius 26, icon 24 in `on-ink`, label hidden |
| Active item | **fixed 132 wide** (fits "Groceries"), padding 0 16, honey fill, ink icon + label 15/800, gap 6, no wrap (`aria-current="page"`) |
| Icons | home, calendar, recipes, groceries, menu (three equal bars) |
| Container | 160 tall when timers exist (TimerPill above it), 100 otherwise; screens pad their content 180 at the bottom |

## Rules

- Order is fixed: Home · Calendar · Recipes · Groceries · Menu. "Menu" opens the Menu (`/menu`, spec 029); until 029 it opens Settings.
- Shown on the five tab screens only; hidden on pushed screens, sheets, forms and cooking mode.
- Below 960 wide only. From 960 the NavRail takes its place, with the same items (spec 064).
- Icon-only items carry `aria-label` = the label.
