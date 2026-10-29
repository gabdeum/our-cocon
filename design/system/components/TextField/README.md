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
| Picker | looks like the input, value 17/700 ink (placeholder 600 ink-muted), 18 px chevron-right ink-muted at the right (padding 0 12 0 16); tapping it opens a BottomSheet of choices (`PickerField`; OC-EditBasics › Cuisine) |
| On a card | `--on-card`: the input is `surface-page` (cream) instead of white, for fields inside a white card (OC-CalAddMore's surprise card, spec 043) |
| Search | 52 tall, radius 18, 20 px search icon in ink-muted, 10 gap, borderless input, hint below: "Try “leek” or “quick”" |

## Rules

- Always a visible label (search: visually hidden label + placeholder). Exception: rows the design labels by place (IngredientEditCard) hide it with `labelHidden` and keep it for screen readers.
- Warn, don't block typing. Explain the fix: "Pick a unit so we can convert and scale it."
- Numeric fields use `inputmode="decimal"`.
- Title (`size="title"`, spec 041): 56 tall, 18/800, for the add sheet's "What's happening?". The warning line is `role="alert"`.
