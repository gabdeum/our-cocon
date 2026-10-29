# Toast

Short confirmation with Undo, above the tab bar.

Reference: `design/screens/OC-CalDay.dc.html` (inline styles are the exact values; build with tokens).

## Specs

| Part | Spec |
| --- | --- |
| Toast | min 56, radius 18, ink, padding 8 8 8 16, white 15/700, shadow; honey "Undo" button 44 |
| Position | 16 from the sides, 108 from the bottom; hides the floating add button while shown |
| Timing | 5 s, then fades; `role="status"` |
| Hint | sage, radius 20, padding 12 14, 14/800 ink (line-height 1.35), white "Got it" pill 44 (15/900), `shadow-lift`; 16 from the left, 92 from the right (beside the add button), 112 from the bottom. Stays until "Got it" (OC-CalMonth, spec 037) |
| Floating add | IconButton `--fab`, 20 from the right and 112 from the bottom (`FloatingAdd` in packages/ui places it with the hint) |

## Rules

- Hint: one first-visit tip, then gone for good for that person.
- Text format: "{title} added for {when}, {time range}."
- A toast without Undo only tells: "Couldn't undo. Check your connection and try again." when an Undo fails (spec 042, 032-later L99).
- Built in `packages/ui`: `UndoToast` (the ink toast, spec 041; the caller times it; `onUndo` left out for one that only tells), `Toast` (the hint) and `FloatingAdd` (`hidden` while a toast shows).
