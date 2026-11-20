# NavRail

The TabBar as a side rail on windows 960 wide and up (spec 064): the same five destinations, icons, order, routes and active rules, with every label shown. Below 960 the TabBar is used instead.

Reference: `design/screens/OC-NavResponsive.dc.html` (`mode="rail"`), `design/ui/OC-LargeScreens.md` › Navigation (inline styles are the exact values; build with tokens).

## Specs

| Part | Spec |
| --- | --- |
| Slot | `layout-rail` (104) on the left of the frame; the rail floats in it, 12 from the left, 12 from the top and bottom (or the safe area when larger) |
| Rail | ink, radius 30, padding 14 8, gap 6, items centred, `shadow-nav` |
| Logo tile | 40 × 40, honey, radius 12, the Our Cocon mark 24 in ink; 12 below it. Decorative |
| Item | 76 × 64, radius 20, icon 24 over a 13 px label (gap 3), label always shown, one line (shrinks to 11 at the largest text size). Inactive: `on-ink`, 700 |
| Active item | honey fill, ink icon and label 900 (`aria-current="page"`; iOS selected trait) |
| Timer | at the bottom, only while a timer runs: the TimerPill's vertical form (TimerPill README › Rail) |

## Rules

- Order is fixed: Home · Calendar · Recipes · Groceries · Menu, from the same config as the TabBar. No settings or profile entry: everything stays in Menu.
- Shown on the five tab screens only, like the TabBar; hidden on pushed screens, sheets, forms and cooking mode.
- The rail is a `nav` landmark labelled "Main". Each item's `aria-label` is its label.
- Tab screens start their content after the 104 slot (then the 24 gutter) and pad 28 at the bottom, as nothing floats there.
