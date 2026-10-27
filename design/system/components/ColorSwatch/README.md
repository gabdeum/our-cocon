# ColorSwatch

Member color picker tile.

Reference: `design/screens/OC-CalSettings.dc.html` (inline styles are the exact values; build with tokens). Used on the Family page: My color, and the Add and Change color sheets (spec 033).

## Specs

| Part | Spec |
| --- | --- |
| Grid | 4 × 2 in a white card, padding 14, gap 10 |
| Swatch | 60 tall, radius 18, member color; taken = initial 18/900; mine = 3 px white + 3 px ink ring |
| Picked (not mine) | same double ring, "Lilac, picked" (choosing a color for someone else) |
| A11y | `role="radio"` in a `radiogroup`, names "Sky, taken" / "Lilac, free" / "Honey, your color" |

## Rules

- Taken swatches can't be picked.
- When adding someone, free swatches come first (the caller orders the options).
