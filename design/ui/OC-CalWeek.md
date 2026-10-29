# OC-CalWeek — Calendar, week

Source `screens/OC-CalWeek.dc.html` (interactive: swipe it) · Route `/calendar?view=week` · Specs 038, 036

## Layout
1. CalHeader (Week).
2. White card: day header row (letter 12/900 muted, date 15/800; today olive circle; 38 px left gutter); "All day" row (label 10/900) with bars spanning their days ("E Birthday", "E Lyon trip", "All Thanksgiving"); hour grid 06:00–24:00, 36 px per hour, labels "06:00"… in a 38 px column, 1 px `line` hour lines.
3. Blocks: slot events over the slot's hours, top line "{initials} {Slot}" (10/900), title 11/800, 1.5 px inner outline; custom events at exact times with a 3 px ink left edge and "{initials} {start}". Overlapping events share the column side by side (lanes); then the top line is initials only.
4. Today's column: honey tint 12%; olive 2 px "now" line.
5. Floating add button; TabBar.

## Interactions
Swipe left/right (or ‹ ›): next/previous week; content follows the finger and slides in (220 ms); < 60 px snaps back. "Today" → this week. Tap a day letter → OC-CalDay. Tap a block → OC-CalEvent. Tap an empty part of a day → OC-CalDay (decided 2026-10-28). Long-press an empty hour → OC-CalAdd for that day and time.
