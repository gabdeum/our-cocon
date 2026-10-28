# ListRow

A row inside a white list group: grocery items, picker items, settings links and ingredients.

## Specs

| Part | Spec |
| --- | --- |
| List group | surface-card, radius 22, overflow hidden; preceded by an `oc-overline` group label (13/900 uppercase ink-muted, 6 gap), optionally with a 12/700 ink-muted note on its right ("All ticked to start", OC-AddGroceries) |
| Row | min 60 tall, padding 10 14, gap 12, 1.5 px `line` divider (none on the last row) |
| Flush (`--flush`) | inside a card's padding: no side padding, min 52 tall (the recipe page's "…" panel) |
| Leading | checkbox or radio 26 × 26 (olive), an avatar 40, an IconTile with letters (an assistant, OC-Connect), or nothing |
| Title | 16/800 ink; done: line-through + `ink-faint`; dim (an unticked row in Add to groceries): `ink-muted`, no line-through, so it stays readable |
| Disabled | unchanged look, not pressable, `aria-disabled` (offline grocery rows keep their tick) |
| Sub-line | 13/600 ink-muted (source: "For Leek & bacon quiche", "Alex via ChatGPT"); warn 700 for merge notes ("Already on the list (100 ml) → will be 400 ml"); olive-deep 700 for a good status ("Connected · used 2 h ago", OC-Connect) |
| Title detail (groceries) | on the title line: ": {to buy}" in 16/800 ink, then " (need {amount})" in 15/600 ink-muted; both struck through when done: "Heavy cream: 1 pint carton (need 300 ml)" |
| Action (groceries) | a 44 × 44 icon button at the end of the row, vertically centred: `more-vertical` (vertical "…") 22 in ink-muted, pressed `surface-card-pressed` circle, 6 from the edge. It sits beside the row's tap target rather than inside it, so it never ticks the row; its screen-reader name says what it does ("Edit Heavy cream"). The divider runs under both |
| Trailing (other) | value 15/800 ink-muted (olive-deep when a setting is on: "Allowed"), a 13/700 status, or a chevron-right 18 (optionally after a status: "1 recipe ›", olive-deep when it's good news: "2 connected ›") |
| Ingredient row (`oc-ingredient`) | no card; padding 12 0, divider `line`; amount column 104 wide 17/900; name 16/700; weight sub-line 13/600; optional Tag at the end |
| Compact ingredient row (`oc-ingredient--compact`) | the shared recipe page (OC-SharedView): padding 10 0, divider `line`; name 16/400 on the left (optional Tag after it), "{amount} · {weight}" 16/900 on the right |
| Event row (`EventListRow`, OC-CalAgenda) | a day's white card (`EventListGroup`: radius 22, padding 4 14 4 10) under an 18/900 heading ("Today · Sun, Oct 25"); rows min 64, padding 8 0, gap 12, 1.5 px `line` divider: 6 px stripe and 36 avatar in the member colors (as SlotBand's event row), title 17/800, sub-line 14/700 ink-muted ("14:30 · Gabriel takes James"), optional Tag `md` at the end: "Now" honey, "Surprise" sage, "Birthday" / "Day 1 of 3" soft. The row is a link to the event |

## Rules

- The whole row is the tap target (label wraps the checkbox).
- Ticking a grocery row updates it for everyone at once; it stays in place, struck through, until the list is cleared.
- A grocery row's menu (Edit, Move to…, Remove) opens from its vertical "…" button, and also on long-press, a swipe to the left (the row follows the finger, then springs back), right-click, or the keyboard's menu key (Shift+F10). Its choices are also the row's screen-reader actions.
