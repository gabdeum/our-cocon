# Progress

Segmented bars showing where you are: form sections (labelled), cooking steps (tappable) and a cook in progress (display only).

## Specs

| Variant | Spec |
| --- | --- |
| Segments | equal columns, gap 6; done `olive-muted`, current `olive`, to do `line-strong` |
| Form sections (`oc-formnav__item`) | bar 6 tall, radius 3, label under it 13/700 ink-muted (current: ink 900, `aria-current="step"`); each is a link to that section |
| Cooking (`--cook`) | bar 8 tall, radius 4, inside a 24-tall button (44 touch area with padding); tapping jumps to that step; label "Step N of M" 14/900 olive uppercase below, plus a hint on the right 14/700 muted |
| Step bar (spec 051) | bar 5 tall, radius 3, gap 3, display only (hidden from screen readers; the text beside it says the step): a cook's progress on its `CookSessionCard` |

## Rules

The bar follows scrolling in cooking mode: the step whose top passes 35% of the scroll area becomes current.
