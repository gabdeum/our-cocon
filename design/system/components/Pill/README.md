# Pill

Rounded toggles for filters, mutually exclusive choices (variants) and people.

## Specs

| Variant | Height | Fill / text | Use |
| --- | --- | --- | --- |
| filter (`oc-pill`) | 40 | surface-soft / ink 14/700; selected honey, 800 | Quick filters, cuisine and time filters |
| filter button (`--ink`) | 40 | ink / white 14/800 + filter icon + count | "Filters · 1" opens the filter sheet |
| choice (`oc-choice`) | 44 | surface-soft / ink 15/800; selected olive / white | Recipe version: Classic · Vegetarian |
| person (`oc-person`) | 44 | surface-soft; 32 avatar + name 14/700 | Filter by who added a recipe |
| suggestion | 40 | surface-soft; "{title}" ink 14/800, then " · {detail}" ink-muted 14/600 | A past choice to pick again: event titles with their start, "**Swim** · Morning" (spec 053). A row of them scrolls horizontally |
| toggle (`TogglePill`) | 44 × 44 | round; on: olive with a white 20 px icon; off: surface-card with an ink icon. No visible word: `label` names it for screen readers | Shows or hides something, remembered on the device: the calendar's "Reminders" with `alarm`, in CalendarHeader's row 2 (Agenda, Day) and beside the day sheet's title (spec 058). `aria-pressed` |

Padding is 0 14 (choice 0 18); gap 8 in a row. Rows of filter pills scroll horizontally (`RowScroll`: on the web a mouse wheel scrolls them sideways too), choices wrap.

## States

`aria-pressed` drives the selected look. Focus: 3 px olive outline.

## Rules

- Honey for multi-select filters, olive for a single choice that changes content. Don't mix them in one row.
