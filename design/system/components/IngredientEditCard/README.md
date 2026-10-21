# IngredientEditCard

One ingredient being edited in the recipe form: drag handle, name and remove, then quantity, unit and, for pieces, the weight of one (OC-EditIngredients).

## Specs

| Part | Spec |
| --- | --- |
| Card | `surface-card`, radius 20, padding 12, gap 8; no shadow |
| Top row | handle (22 wide, from ReorderList), name input (flex), remove button; gap 8 |
| Inputs | TextField `--sm` look: 46 tall, radius 12, 2 px `line-strong`, 16 px text (name 700, quantity 800); focus border `olive` |
| Remove | 44 square, radius 12, `surface-soft`, 18 px close icon in `ink-muted`; label "Remove {name}" |
| Second row | indented 30 (under the name): quantity 1fr, unit button 1.2fr, weight box 1.4fr; gap 8 |
| Unit button | 46 tall, radius 12, 2 px `line-strong`, white; 15/800 label and a 16 px chevron-down; no unit: label in `ink-muted` |
| Weight box | 46 tall, radius 12, `surface-soft`, padding 0 10: "each ≈" 14/700, the value input 16/900, "g" 14/700 |
| Extra content | under the name row, indented 30: suggestions, the aisle line, advanced fields |
| Warning | card border 2 px `warn-border`; the field at fault in warn style (`warn-border`, `warn-soft`, `warn` text); message 14/700 `warn` with an 18 px warning icon, indented 30, `role="alert"` |

## States

Default, focused field (olive border), warning (above). The unit button presses to `surface-soft`. Remove presses to `surface-soft-pressed`.

## Rules

- Every input has a screen-reader label even though the design shows none ("Ingredient name", "Quantity", "Unit: pieces", "Weight of one (g)").
- Warn, don't block typing: the message says how to fix it ("Pick a unit so we can convert and scale it.").
- The weight box only shows for pieces.
