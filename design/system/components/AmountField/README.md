# AmountField

A big number input with a unit picker beside it: how much you have, or what to convert (OC-ScaleIng, OC-Units).

## Specs

| Part | Spec |
| --- | --- |
| Label | 15/900 above, 6 gap ("2. How much do you have?", "Convert") |
| Input | `lg`: 56 tall, radius 16, 22/900 · `xl`: 60 tall, radius 18, 26/900; 2 px `line-strong`, white, padding 0 16; focus `olive`; `inputmode="decimal"` |
| Unit button | same height and radius, 96 wide (`xl` 100), 17/800 (`xl` 18/800) + chevron-down 16; 8 gap from the input |
| Unit menu | opens under the field: white, radius 16, one row per unit (44 tall, radio 26, 16/700; chosen 800), `line` dividers |
| Hint | 13/600 ink-muted under the field ("Enter how much you have") |

## States

Pressed: the unit button shows `surface-soft`. Focus: 3 px olive outline. With one unit the button has no chevron and no menu (disabled). The button says "Unit: g" to screen readers and is `aria-expanded` while the menu is open; the menu is a radiogroup.

## Rules

- Offer only the units that fit what's measured (no ml for lardons).
- Never block typing; say what's missing in the hint.
