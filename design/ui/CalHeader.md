# CalHeader — calendar header (component)

Source `screens/CalHeader.dc.html` (menus open: `CalHeaderView.dc.html`, `CalHeaderPeople.dc.html`) · Spec 036 · used by OC-CalMonth, OC-CalWeek, OC-CalDay, OC-CalAgenda

## Layout
Height 162 (54 top inset, two 44 rows, gap 10, 10 bottom).
1. Row 1: title 28/900 (flex, one line, never wraps) · soft pill "Today" (44).
2. Row 2: view button (white pill 44, "{View}" 15/900 + chevron-down) · people button (white pill 44: stack of up to 3 dots 26 px overlapping by 8 with a 2 px ring, then "All" or "{shown} of {total}" 15/900, chevron-down; sage `#D9E3A8` fill when some are hidden) · spacer · round white "‹" and "›" (44).
3. **View menu** (popover, 200 wide, white, radius 18, padding 6, shadow 0 12 28 / 22%, left 20, just under row 2): "Month" · "Week" · "Day" · "Agenda", rows 48, current one `surface-soft` 16/900 with an olive check, `aria-current="page"`.
4. **People filter** (popover, full width minus 20 px sides, white, radius 20, padding 10 14 12): header "SHOW EVENTS FOR" (13/900 caps, ink-muted) + "Show all" (olive-deep link); rows 52: dot 34, name 16/800, checkbox 26 (on: olive with white check; off: 2 px `line-dashed` border). Members in order, then Everyone ("All" dot) and Others (person icon dot).

## Titles (spec 034 FR-007)
Title space = screen width − 128 px (20 + 20 padding, "Today" 80, gap 8): 192 at 320, 247 at 375, **262 at 390**, 265 at 393, 302 at 430. Use the first format that fits, measured in Nunito 900 28 px (−0.5 px tracking) with the font's own widths and kerning (`titleWidth` in `@cocon/calendar`). Widths below are measured that way (2026-11-02; the first draft's estimates were 8–15% narrow).

| View | Formats, longest first | Worst case (width) | Fits from screen width |
| --- | --- | --- | --- |
| Month, this year | MMMM | "September" (144) | always |
| Month, other year | MMMM YYYY → MMM YYYY | "September 2027" (217) → "Mar. 2027" (131) | 345 → always |
| Week, one month | MMMM d – d → MMM d – d | "September 13 – 19" (245) → "Mar. 15 – 21" (159) | 374 → always |
| Week, two months | MMMM d – MMMM d → MMM d – MMM d | "November 29 – December 5" (360) → "Nov. 29 – Dec. 5" (207) | 488 → 335 |
| Week, other year | … + ", YYYY" (full, then short) → short without year | "September 13 – 19, 2027" (325) → "Feb. 28 – Mar. 6, 2027" (284) | 454 → 412 → as the week rows above |
| Day | EEEE, MMMM d → EEE, MMMM d → EEE, MMM d | "Wednesday, September 16" (350) → "Wed, September 16" (260) → "Wed, Sep. 16" (172) | 479 → 388 → always |
| Day, other year | … + ", YYYY" (each) → EEE, MMM d | "Wednesday, September 16, 2027" (430) → "Wed, September 16, 2027" (340) → "Wed, Sep. 16, 2027" (252) | 559 → 468 → 381 → always |
| Agenda | "Coming up" | — | always |

What a 390 px phone shows (title space 262): "October" · "January 2027" · "October 25 – 31" · "Nov. 29 – Dec. 5" · "January 3 – 9, 2027" · "Dec. 27 – Jan. 2" · "Sunday, October 25" · "Wed, October 28" · "Wed, September 16" · "Fri, January 8, 2027".
Under 335 px (iPhone SE 1st generation, 320) a two-month week's shortest title ("Nov. 29 – Dec. 5", 207) is wider than the space.
Short months: Jan. Feb. Mar. Apr. May Jun. Jul. Aug. Sep. Oct. Nov. Dec. Never "…".

## Interactions
"‹"/"›": previous/next month, week or day (accessible names "Previous week" etc.). "Today": back to today. The view and people buttons open their popovers (`aria-haspopup`, `aria-expanded`); outside tap or Escape closes. Picking a view closes the menu; the people filter stays open while ticking. The filter is remembered per user per device.

Member colors: `member-*` tokens; Everyone `member-everyone` (coral) with label "All"; Others `member-others` (light sand) with a person-outline icon and a `line-handle` outline. Two-member items split 50/50; initials always shown ("G·J").
