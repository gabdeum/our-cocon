# OC-CalMonth — Calendar, month

Source `screens/OC-CalMonth.dc.html` (interactive: scroll it, tap a day), `screens/OC-CalMonthSheet.dc.html` (sheet open) · Route `/calendar` (`?view=month`) · Specs 037, 036

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
Tap anywhere on a day (chips and bars included) → day sheet. Long-press a day → OC-CalAdd for that day. "+" → OC-CalAdd (today).

## Day sheet
Scrim ink 38%; sheet `surface-page`, radius 28 top, padding 10 20 34, max 640 tall. Handle 44×5 `line-handle`. Title "Sunday, October 25" 22/900; count "3 events" · "1 event" · "Nothing planned" 14/700 muted; close (44, soft, ✕, "Close"). Rows: white, radius 20, padding 12 14 12 12, 6 px stripe, 36 avatar (initials, "All"), title 17/800, time line 14/700 muted ("Lunch", "14:30", "All day", "All day · day 2 of 4"). Empty: "Nothing planned yet." (16/700 muted). Round olive add (60) bottom-right, 20 from the side and 34 from the bottom, "Add event on Sunday, October 25" → OC-CalAdd for that day. Row → OC-CalEvent.
