# TabBar — tab bar v2

Source `screens/TabBar.dc.html` · Specs 002, 036

## Layout
Five destinations in this order: Home · Calendar · Recipes · Groceries · Menu. Icons: home, calendar, recipes, groceries, menu (three equal bars). Accessible names = the labels.

## Sizes
- Bar 68 tall, radius 34, ink, padding 8, gap 4.
- **Selected tab: fixed 132 px wide**, 16 px side padding, radius 26, honey fill, icon 24 + label 15/800, gap 6, no wrapping. It never grows or shrinks.
- Unselected tabs share the remaining width (min 44 px), icon only in `on-ink`.
- TimerPill above the bar when timers exist (unchanged).

## Behaviour
"Menu" opens `/menu` (spec 029: Apps and Settings). Calendar opens the member's default view (spec 029).
