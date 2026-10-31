# OC-CalMonth — Calendar, month

Source `screens/OC-CalMonth.dc.html` (interactive: scroll it) · Route `/calendar` (`?view=month`) · Specs 037, 036

## Layout
1. CalHeader (Month). Title follows the month that fills the grid.
2. White card, scrolling vertically as one continuous grid of weeks (late August → December in the mock). Sticky weekday row "S M T W T F S" (12/900 muted) with a soft bottom shadow.
3. Day cell 96 px: date (12/800) or, on the 1st of a month, a dark beige (`line-handle`) banner across the top of the cell, edge to edge, "Nov 1" in ink 12/900 clipped with no "…" (decided 2026-10-29; olive when the 1st is today); today = olive date circle + 2.5 px olive inset outline; past days on surface-page with muted dates.
4. Up to two chips (20 tall, radius 6, 11/800, 4 px padding both sides, clipped text, no "…"): "{initials} {title}", e.g. "J Baby swim", "G·E School night". Then "+N" (11/900 muted).
5. Multi-day events: one pill per week row drawn over the cells ("All Grandma visits", next row "All Grandma visits (cont.)"); square ends where it continues.
6. First-visit hint (sage card, above the tab bar, left of the add button): "Tap a day to see details. Each color is a family member." · "Got it".
7. Floating olive add button 60 ("Add event"); TabBar (Calendar active).

## States
| State | Copy |
| --- | --- |
| Hint dismissed | hidden for good for this member |
| Event hidden by filter | not drawn; "+N" counts only visible events |
| Private event of someone else | chip "Busy" in their color |

## Interactions
Tap a day (anywhere but on an event) → OC-CalDay for that day. Tap an event chip → OC-CalEvent (decided 2026-10-28). Long-press day → OC-CalAdd for that day. Tap a pill → OC-CalEvent. "+" → OC-CalAdd (today).
