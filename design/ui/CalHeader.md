# CalHeader — calendar header (component)

Source `screens/CalHeader.dc.html` (menus open: `CalHeaderView.dc.html`, `CalHeaderPeople.dc.html`) · Spec 036 · used by OC-CalMonth, OC-CalWeek, OC-CalDay, OC-CalAgenda

## Layout
Height 162 (54 top inset, two 44 rows, gap 10, 10 bottom).
1. Row 1: title 28/900 (flex, one line, never wraps) · soft pill "Today" (44).
2. Row 2: view button (white pill 44, "{View}" 15/900 + chevron-down) · people button (white pill 44: stack of up to 3 dots 26 px overlapping by 8 with a 2 px ring, then "All" or "{shown} of {total}" 15/900, chevron-down; sage `#D9E3A8` fill when some are hidden) · spacer · round white "‹" and "›" (44).
3. **View menu** (popover, 200 wide, white, radius 18, padding 6, shadow 0 12 28 / 22%, left 20, just under row 2): "Month" · "Week" · "Day" · "Agenda", rows 48, current one `surface-soft` 16/900 with an olive check, `aria-current="page"`.
4. **People filter** (popover, full width minus 20 px sides, white, radius 20, padding 10 14 12): header "SHOW EVENTS FOR" (13/900 caps, ink-muted) + "Show all" (olive-deep link); rows 52: dot 34, name 16/800, checkbox 26 (on: olive with white check; off: 2 px `line-dashed` border). Members in order, then Everyone ("All" dot) and Others (person icon dot).

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
"‹"/"›": previous/next month, week or day (accessible names "Previous week" etc.). "Today": back to today. The view and people buttons open their popovers (`aria-haspopup`, `aria-expanded`); outside tap or Escape closes. Picking a view closes the menu; the people filter stays open while ticking. The filter is remembered per user per device.

Member colors: `member-*` tokens; Everyone `member-everyone` (coral) with label "All"; Others `member-others` (light sand) with a person-outline icon and a `line-handle` outline. Two-member items split 50/50; initials always shown ("G·J").
