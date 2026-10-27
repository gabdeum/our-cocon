# OC-CalDay — Calendar, day

Source `screens/OC-CalDay.dc.html` (interactive: swipe it, Undo) · Route `/calendar?view=day&date=` · Specs 039, 036

## Layout
1. CalHeader (Day).
2. Busy chips (36): avatar dot + "{name} {count}" for each member with events that day, then "Everyone {count}".
3. "All day" (18/900) when any: full-width 52 rows in the member color, title 17/800, tag right ("Birthday", "Day 2 of 3").
4. Bands: title 18/900 + hours 14/700 muted ("Lunch 12:00–14:00"). Event row (white, radius 20): 6 px color stripe, 36 avatar, title 17/800, time line 14/700 muted, optional driver line (olive-deep, car icon) "Gabriel takes James", "Now" honey tag.
5. Empty band: dashed row "+ Add in the early morning" / "morning" / "lunch slot" / "afternoon" / "evening".
6. Toast after saving (ink, radius 18, above the tab bar): "Poker night added for tonight, 18:00–22:00." · honey "Undo". The add button hides while the toast shows.

## Time line rule
Band name when the event starts at the band's start (Lunch at 12:00 → "Lunch · Grandma's house"); otherwise the start time ("14:30 · Aquatic Center").

## Interactions
Swipe left/right (or ‹ ›): next/previous day, same feel as the week. Tap row → OC-CalEvent. Tap "+ Add in the …" → OC-CalAdd with that day and slot.
