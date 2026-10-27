# Toast

Short confirmation with Undo, above the tab bar.

Reference: `design/screens/OC-CalDay.dc.html` (inline styles are the exact values; build with tokens).

## Specs

| Part | Spec |
| --- | --- |
| Toast | min 56, radius 18, ink, padding 8 8 8 16, white 15/700, shadow; honey "Undo" button 44 |
| Position | 16 from the sides, 108 from the bottom; hides the floating add button while shown |
| Timing | 5 s, then fades; `role="status"` |

## Rules

- Text format: "{title} added for {when}, {time range}."
