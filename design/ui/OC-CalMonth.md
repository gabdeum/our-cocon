# OC-CalMonth — Calendar, month

Source `screens/OC-CalMonth.dc.html` (interactive: scroll it, tap a day), `screens/OC-CalMonthSheet.dc.html` (sheet open) · Route `/calendar` (`?view=month`) · Specs 037, 036

## Layout
1. CalHeader (Month). Title follows the month that fills the grid.
2. White card, scrolling vertically as one continuous grid of weeks (late August → December in the mock). Sticky weekday row "S M T W T F S" (12/900 muted) with a soft bottom shadow.
3. Day cell 120 px, padding 3 3 4, gap 2: date 11/800 in an 18 px row or, on the 1st of a month, an 18 px ink pill "Nov 1" (white 11/900, clipped with no "…"; olive when the 1st is today); today = 18 px olive date circle + 2.5 px olive inset outline; past days on surface-page with muted dates.
4. Up to five chips (15 tall, radius 4, 10/800, 3 px padding both sides, clipped text, no "…"), or four and "+N" (10/900 muted) when there are more. Under 430 px wide the title only ("Baby swim"); from 430 px "{initials} {title}", e.g. "J Baby swim", "G·E School night". The cell's label lists each event with its people: "October 25: Baby swim (James)".
5. Multi-day events: one pill per week row drawn over the cells, styled like a chip, 23 px from the top of the row ("Grandma visits", next row "Grandma visits (cont.)"; with initials from 430 px: "All Grandma visits"); square ends where it continues.
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

## Accessibility (spec 030)
- **Outlines:** chips, bars and dots have a 1 px outline in their member colour's edge tone (`member-*-edge`, 3:1 against white).
- **Largest text sizes** (135% and up): a cell shows its first chip, then a small dot per further event (and "+N"); the date and chip text stop growing at 135%. The cell's label still names every event; the day sheet shows them at full size.
- **Initials:** under 430 px wide, chips keep the title only, as drawn; their label names who.
- **Reduce Motion:** ‹ ›, Today and month jumps are instant.
- **Bars:** "{title}, {who}, {from} to {to}".
