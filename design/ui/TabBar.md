# TabBar — Floating tab bar

Source `screens/TabBar.dc.html` · Shown on `/`, `/recipes`, `/groceries`, `/settings` · Specs 002, 011

## Layout
1. TimerPill, centred 10 above the bar, while any timer exists (spec 011).
2. Dark navigation pill, 16 from the sides and 26 from the bottom (plus the home-indicator safe area), named "Main" for screen readers.
3. Four tabs in this order: "Home" · "Recipes" · "Groceries" · "Settings".
   - Active tab: honey fill, icon and label.
   - Other tabs: icon only, named by their label for screen readers.

## States
| State | Copy |
| --- | --- |
| Active tab | Its label shows next to its icon; it is announced as the current page |
| Largest text size | The active label stays on one line and may shrink to 13 px; it never wraps |
| Timers running | TimerPill above the bar: "{n} timers running. Open timers" (spec 011) |
| No timers | Bar only |
| Pushed screen, sheet, form, cooking mode | No tab bar |
| Web wider than 720 px | Bar stays bottom-centred inside the 720 px column |

Tapping the current tab does nothing. Tapping another tab opens its screen and sends `tab_selected` with the tab.
