# ListRow

A row inside a white list group: grocery items, picker items, settings links and ingredients.

## Specs

| Part | Spec |
| --- | --- |
| List group | surface-card, radius 22, overflow hidden; preceded by an `oc-overline` group label (13/900 uppercase ink-muted, 6 gap) |
| Row | min 60 tall, padding 10 14, gap 12, 1.5 px `line` divider (none on the last row) |
| Flush (`--flush`) | inside a card's padding: no side padding, min 52 tall (the recipe page's "…" panel) |
| Leading | checkbox or radio 26 × 26 (olive), an avatar 40, or nothing |
| Title | 16/800 ink; done: line-through + `ink-faint` |
| Sub-line | 13/600 ink-muted (source: "For Leek & bacon quiche", "Alex via ChatGPT"); warn 700 for merge notes ("Already on the list (100 ml) → will be 400 ml") |
| Trailing (groceries) | Buy 15/900 ink over Need 12/700 ink-muted, right-aligned, max 140 wide: "Buy 1 pint carton" / "Need 300 ml · ~170 ml left over" |
| Trailing (other) | value 15/800 ink-muted, a 13/700 status, or a chevron-right 18 |
| Ingredient row (`oc-ingredient`) | no card; padding 12 0, divider `line`; amount column 104 wide 17/900; name 16/700; weight sub-line 13/600; optional Tag at the end |

## Rules

- The whole row is the tap target (label wraps the checkbox).
- Ticking a grocery row updates it for everyone at once; it stays in place, struck through, until the list is cleared.
