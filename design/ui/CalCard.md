# CalCard — Home calendar card

Sources `screens/CalCard.dc.html` (today, interactive toggle), `screens/OC-CalCardWeek.dc.html`, `screens/OC-CalCardEmpty.dc.html` · on `/` (OC-Home) · Spec 028

## Layout (white card, radius 26, 350 wide at 390)
1. Header: segmented "Today" · "This week" (only when there are events today) or title "This week" / "Calendar"; olive "+" (44, "Add event").
2. **Today**: birthday banner (soft, cake icon) "Eva’s birthday is on Tuesday" (within 3 days); event rows (58): stripe, 32 avatar, title 16/800, sub 13/700 ("Lunch · Grandma’s house", "Afternoon · Gabriel takes James"), "Now" tag.
3. **This week**: 7-day strip (62 tiles: letter, date, up to 3 color dots; today soft + olive ring; empty days transparent and muted), then up to 5 rows "Tue · Yoga · Eva · Evening" and link "See all (6 more)".
4. **Empty**: "No events in the next 7 days. Add one?" + ink "+ Add event" (56). No footer.
5. Footer: "Open calendar ›" (top divider).

## Interactions
Toggle switches Today / This week (not remembered). Rows → OC-CalEvent. Strip day → OC-CalDay. "+" → OC-CalAdd (today, or the next free day in This week). "Open calendar" → Calendar tab.
