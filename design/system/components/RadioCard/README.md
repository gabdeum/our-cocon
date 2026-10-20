# RadioCard

One choice of a short single-choice list, each on its own white card: "1. Which ingredient?" (OC-ScaleIng).

## Specs

| Part | Spec |
| --- | --- |
| Card | white, radius 16, min 52 tall, padding 0 14, gap 12; 8 between cards |
| Radio | 26 × 26 olive (as ListRow) |
| Label | 16/700 ink; 800 when chosen |
| Value | right-aligned 16/600 ink-muted ("200 g", "2 (300 g)") |
| Chosen | 2 px `olive` border |

## States

Pressed: `surface-soft`. Focus: 3 px olive outline. `role="radio"` with `aria-checked`, inside a labelled `radiogroup`.

## Rules

- Use when each choice needs room for a value; for settings in a list use ListRow with a radio.
