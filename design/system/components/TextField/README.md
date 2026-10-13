# TextField

Labelled inputs for forms and search, with a hint line and a friendly warning state.

## Specs

| Part | Spec |
| --- | --- |
| Label | 15/900 above the input, 6 gap; "(optional)" in ink-muted 600 |
| Input | 54 tall, radius 16, 2 px `line-strong`, white, padding 0 16, 17/700 ink; placeholder ink-muted 600 |
| Focus | border `olive` |
| Small | `--sm` 46 tall, radius 12, 16 px text (ingredient rows, timer fields) |
| Textarea | min 76 tall, padding 12 16, 16/600, line-height 1.45 |
| Hint | 13/600 ink-muted under the input; can include a counter "54 / 140" |
| Warning | border `warn-border`, fill `warn-soft`, text `warn`; message 14/700 `warn` with a 18 px warning icon |
| Search | 52 tall, radius 18, 20 px search icon in ink-muted, 10 gap, borderless input, hint below: "Try “leek”, “quick” or “Mia's”" |

## Rules

- Always a visible label (search: visually hidden label + placeholder).
- Warn, don't block typing. Explain the fix: "Pick a unit so we can convert and scale it."
- Numeric fields use `inputmode="decimal"`.
