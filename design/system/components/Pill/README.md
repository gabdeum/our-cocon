# Pill

Rounded toggles for filters, mutually exclusive choices (variants) and people.

## Specs

| Variant | Height | Fill / text | Use |
| --- | --- | --- | --- |
| filter (`oc-pill`) | 40 | surface-soft / ink 14/700; selected honey, 800 | Quick filters, diet and time filters |
| filter button (`--ink`) | 40 | ink / white 14/800 + filter icon + count | "Filters · 1" opens the filter sheet |
| choice (`oc-choice`) | 44 | surface-soft / ink 15/800; selected olive / white | Recipe version: Classic · Vegetarian |
| person (`oc-person`) | 44 | surface-soft; 32 avatar + name 14/700 | Filter by who added a recipe |

Padding is 0 14 (choice 0 18); gap 8 in a row. Rows of filter pills scroll horizontally, choices wrap.

## States

`aria-pressed` drives the selected look. Focus: 3 px olive outline.

## Rules

- Honey for multi-select filters, olive for a single choice that changes content. Don't mix them in one row.
