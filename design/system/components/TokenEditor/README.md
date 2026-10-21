# TokenEditor

A text field that shows ingredient and temperature chips in the line: a step's "Instructions" in the recipe form (OC-EditSteps, spec 016).

## Specs

| Part | Spec |
| --- | --- |
| Label | 14/900 above, 6 gap |
| Box | min 76 tall, radius 14, 2 px `line-strong`, white, padding 12; focus border `olive` |
| Text | 16/600, line-height 28, ink |
| Chip | sage fill, radius-xs, same size and weight as the text (ingredient name, or a temperature in both scales: "180 °C (350 °F)") |
| Missing chip | warn-soft fill, `warn` text: "Missing ingredient" |
| Hint | 13/600 `ink-muted` under the box |
| Warning | border `warn-border`, fill `warn-soft`; message 14/700 `warn` with an 18 px warning icon |

## How it works

The chips are drawn under a see-through text field holding the same text, so they sit in the line on web and iOS and the caret lands on the letters. That's why chips keep the text's own weight and have no side padding (the screen draws 800 weight and 8 px padding): any width a chip adds would put the caret in the wrong place. The screen keeps each chip whole: deleting into one removes it, typing inside one lands after it, and a caret placed inside one moves to its end.

## Rules

- Chips are never partly edited.
- Screen readers read the text as it shows, chips by name.
- Warn, don't block typing.
