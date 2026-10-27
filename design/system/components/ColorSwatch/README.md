# ColorSwatch

Member color picker tile.

Reference: `design/screens/OC-CalSettings.dc.html` (inline styles are the exact values; build with tokens).

## Specs

| Part | Spec |
| --- | --- |
| Grid | 4 × 2 in a white card, padding 14, gap 10 |
| Swatch | 60 tall, radius 18, member color; taken = initial 18/900; mine = 3 px white + 3 px ink ring |
| A11y | `role="radio"`, names "Sky, taken" / "Lilac, free" / "Honey, your color" |

## Rules

- Taken swatches can't be picked.
