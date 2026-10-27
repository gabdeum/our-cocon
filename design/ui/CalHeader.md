# CalHeader — calendar header (component)

Source `screens/CalHeader.dc.html` · Spec 036 · used by OC-CalMonth, OC-CalWeek, OC-CalDay, OC-CalAgenda

## Layout
1. Row: title 28/900 (one line, never wraps) · round white "‹" and "›" (44) · soft pill "Today".
2. View switcher (segmented links, 44): "Month" · "Week" · "Day" · "Agenda" — current one white with shadow, `aria-current="page"`.
3. Member filter (horizontal scroll, 44 chips): one chip per member (avatar dot 30 with initial + name, 2 px border in the member color), then "Everyone" ("All" dot) and "Others" (person icon dot, `line-handle` border). Group label "Show events for". Pressed = shown.

## Titles (spec 034 FR-007)
| View | Under 430 px | 430 px and wider |
| --- | --- | --- |
| Month, this year | "October" | "October" |
| Month, another year | "Jan. 2027" | "January 2027" |
| Week | "Oct. 25 – 31" · "Nov. 29 – Dec. 5" | "October 25 – 31" |
| Day | "Sun, Oct. 25" | "Sunday, October 25" |
| Agenda | "Coming up" | "Coming up" |
May has no period ("May 2027").

## Interactions
"‹"/"›": previous/next month, week or day (accessible names "Previous week" etc.). "Today": back to today. Filter chips toggle and are remembered per user per device.

Member colors: `member-*` tokens; Everyone `member-everyone` (coral) with label "All"; Others `member-others` (light sand) with a person-outline icon and a `line-handle` outline. Two-member items split 50/50; initials always shown ("G·J").
