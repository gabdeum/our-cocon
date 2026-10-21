# ReorderList

A list whose rows are reordered by dragging a handle: ingredients (spec 015) and steps (spec 016) in the recipe form.

## Specs

| Part | Spec |
| --- | --- |
| Rows | gap 12 (8 or 10 allowed) |
| Handle | 44 tall, 22 wide, radius 12; "⋮⋮" 18/900 in `ink-muted`; placed by the row (the list hands it over) |
| Dragging | the row follows the finger, slightly see-through (92%) and above the others; the others slide to show where it will land |

## States

Focus on the handle: 3 px olive outline. While a row is dragged the screen doesn't scroll.

## Rules

- Always reorderable without dragging: screen readers get "Move up" and "Move down" on the handle, and the arrow keys move the row on the web.
- The handle's screen-reader name says what it does ("Drag to reorder").
